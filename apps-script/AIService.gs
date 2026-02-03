/**
 * SkyBlueEarthJapan 経費管理アプリ
 * AIService.gs - AI連携（OpenAI API）
 */

// ===========================================
// AI解析メイン
// ===========================================

/**
 * 入力テキストをAIで解析
 * @param {Object} payload - { utterance, inputMode }
 * @returns {Object} 解析結果
 */
function analyzeInput(payload) {
  return withErrorHandling(() => {
    const { utterance, inputMode } = payload;

    if (!utterance || utterance.trim() === '') {
      throw validationError('入力がありません');
    }

    // コンテキスト情報を取得
    const context = buildAIContext_();

    // AI呼び出し
    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
      logInfo('No API key, using rule-based analysis');
      return ruleBasedAnalysis_(utterance, context);
    }

    const aiRequest = {
      utterance: utterance,
      input_mode: inputMode || 'text',
      now: getToday(),
      timezone: APP.TIMEZONE,
      context: context
    };

    try {
      const aiResponse = callOpenAI_(apiKey, aiRequest);
      if (aiResponse.success) {
        return successResponse(aiResponse.data);
      }
    } catch (e) {
      logWarn('OpenAI call failed, falling back', e);
    }

    // フォールバック
    return ruleBasedAnalysis_(utterance, context);
  }, 'analyzeInput');
}

// ===========================================
// OpenAI API呼び出し
// ===========================================

function callOpenAI_(apiKey, aiRequest) {
  const systemPrompt = `あなたは個人事業の経理秘書です。
ユーザーの入力（音声の文字起こし/テキスト）から、取引（売上/経費）を構造化します。
必ずJSONのみで出力してください。余計な文章は一切出力しないでください。
不明な項目は推測で埋めず、missing_fields に入れ、最大2つまで質問してください。

出力形式:
{
  "type": "expense" または "revenue",
  "fields": {
    "date": "YYYY-MM-DD形式、不明なら空文字",
    "amount": 数値、不明ならnull,
    "vendor": "取引先名",
    "description": "取引内容",
    "payment_method": "cash/bank/card/other/空文字",
    "account_title_suggestions": [
      {"name": "勘定科目名", "confidence": 0.0-1.0, "reason": "理由"}
    ]
  },
  "missing_fields": ["不足しているフィールド名"],
  "questions": [
    {"id": "質問ID", "text": "質問文", "choices": ["選択肢（任意）"]}
  ],
  "confidence": 0.0-1.0,
  "warnings": []
}`;

  const userPrompt = `次の入力を取引として解釈し、指定のJSON形式で返してください。
${JSON.stringify(aiRequest, null, 2)}`;

  const requestBody = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,
    max_tokens: 1000,
    response_format: { type: 'json_object' }
  };

  const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw externalServiceError('OpenAI', response.getContentText());
  }

  const responseJson = JSON.parse(response.getContentText());
  const content = responseJson.choices[0].message.content;
  const aiOutput = JSON.parse(content);

  return {
    success: true,
    data: normalizeAIResponse_(aiOutput)
  };
}

function normalizeAIResponse_(aiOutput) {
  const fields = aiOutput.fields || {};
  return {
    type: aiOutput.type || TRANSACTION_TYPE.EXPENSE,
    fields: {
      date: fields.date || '',
      amount: fields.amount,
      vendor: fields.vendor || '',
      description: fields.description || '',
      paymentMethod: fields.payment_method || '',
      accountTitleSuggestions: (fields.account_title_suggestions || []).slice(0, 3)
    },
    missingFields: aiOutput.missing_fields || [],
    questions: (aiOutput.questions || []).slice(0, 2),
    confidence: aiOutput.confidence || 0.5,
    warnings: aiOutput.warnings || []
  };
}

// ===========================================
// ルールベース解析（フォールバック）
// ===========================================

function ruleBasedAnalysis_(utterance, context) {
  const text = utterance.toLowerCase();

  const type = detectTransactionType_(text);
  const date = extractDate_(text);
  const amount = extractAmount_(text);
  const vendor = extractVendor_(text, context.vendor_hints);
  const accountTitleSuggestions = suggestAccountTitles_(text, context.account_titles, vendor);

  const missingFields = [];
  const questions = [];

  if (!date) {
    missingFields.push('date');
    questions.push({ id: 'q_date', text: 'いつの取引ですか？', choices: [] });
  }
  if (!amount) {
    missingFields.push('amount');
    questions.push({ id: 'q_amount', text: '金額はいくらですか？', choices: [] });
  }

  let confidence = 0.5;
  if (date) confidence += 0.15;
  if (amount) confidence += 0.15;
  if (vendor) confidence += 0.1;
  if (accountTitleSuggestions.length > 0 && accountTitleSuggestions[0].confidence > 0.6) {
    confidence += 0.1;
  }

  return successResponse({
    type: type,
    fields: {
      date: date || '',
      amount: amount,
      vendor: vendor || '',
      description: extractDescription_(text, vendor),
      paymentMethod: extractPaymentMethod_(text),
      accountTitleSuggestions: accountTitleSuggestions
    },
    missingFields: missingFields,
    questions: questions.slice(0, 2),
    confidence: Math.min(confidence, 1.0),
    warnings: []
  });
}

// ===========================================
// テキスト解析ヘルパー
// ===========================================

function buildAIContext_() {
  const atResult = getAccountTitles();
  const accountTitles = atResult.success
    ? atResult.accountTitles.map(at => ({
      name: at.name,
      keywords: at.keywords ? at.keywords.split(',').map(k => k.trim()) : []
    }))
    : [];

  const vResult = getVendors();
  const vendorHints = vResult.success
    ? vResult.vendors.slice(0, 20).map(v => ({
      vendor: v.name,
      default_account_title: v.defaultAccountTitle
    }))
    : [];

  return {
    business_name: getSetting('BUSINESS_NAME', 'スカイブルーアースジャパン'),
    payment_methods: Object.keys(PAYMENT_METHOD),
    account_titles: accountTitles,
    vendor_hints: vendorHints
  };
}

function detectTransactionType_(text) {
  const revenueKeywords = ['入金', '売上', '報酬', '請求', '振込', '振り込'];
  for (const kw of revenueKeywords) {
    if (text.includes(kw)) return TRANSACTION_TYPE.REVENUE;
  }
  return TRANSACTION_TYPE.EXPENSE;
}

function extractDate_(text) {
  const today = getNow();

  if (text.includes('今日') || text.includes('本日')) return formatDate(today);
  if (text.includes('昨日')) {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return formatDate(d);
  }
  if (text.includes('一昨日') || text.includes('おととい')) {
    const d = new Date(today);
    d.setDate(d.getDate() - 2);
    return formatDate(d);
  }

  const mdMatch = text.match(/(\d{1,2})[\/月](\d{1,2})/);
  if (mdMatch) {
    const month = parseInt(mdMatch[1]);
    const day = parseInt(mdMatch[2]);
    return `${today.getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return null;
}

function extractAmount_(text) {
  const manMatch = text.match(/(\d+(?:\.\d+)?)\s*万(?:円)?/);
  if (manMatch) return Math.floor(parseFloat(manMatch[1]) * 10000);

  const yenMatch = text.match(/([0-9,，]+)\s*円/);
  if (yenMatch) return parseAmount(yenMatch[1]);

  const numMatch = text.match(/([0-9,，]+)/g);
  if (numMatch) {
    for (const num of numMatch) {
      const parsed = parseAmount(num);
      if (parsed && parsed >= 100) return parsed;
    }
  }

  return null;
}

function extractVendor_(text, vendorHints) {
  for (const hint of vendorHints) {
    if (text.includes(hint.vendor.toLowerCase())) return hint.vendor;
  }

  const common = { 'amazon': 'Amazon', 'アマゾン': 'Amazon', '楽天': '楽天', 'セブン': 'セブンイレブン' };
  for (const [kw, name] of Object.entries(common)) {
    if (text.includes(kw)) return name;
  }

  return null;
}

function extractDescription_(text, vendor) {
  const keywords = {
    '事務用品': '事務用品購入', '電車': '交通費', 'タクシー': 'タクシー代',
    '打ち合わせ': '打ち合わせ', '本': '書籍購入'
  };
  for (const [kw, desc] of Object.entries(keywords)) {
    if (text.includes(kw)) return desc;
  }
  return vendor ? `${vendor}での支払い` : '支払い';
}

function extractPaymentMethod_(text) {
  if (text.includes('カード') || text.includes('クレジット')) return PAYMENT_METHOD.CARD;
  if (text.includes('現金')) return PAYMENT_METHOD.CASH;
  if (text.includes('振込') || text.includes('口座')) return PAYMENT_METHOD.BANK;
  return '';
}

function suggestAccountTitles_(text, accountTitles, vendor) {
  const suggestions = [];

  for (const at of accountTitles) {
    let confidence = 0.3;
    let matchedKeyword = null;

    if (at.keywords && at.keywords.length > 0) {
      for (const kw of at.keywords) {
        if (text.includes(kw.toLowerCase())) {
          confidence = 0.7;
          matchedKeyword = kw;
          break;
        }
      }
    }

    if (confidence > 0.3 || matchedKeyword) {
      suggestions.push({
        name: at.name,
        confidence: confidence,
        reason: matchedKeyword ? `「${matchedKeyword}」を含むため` : '汎用的な科目'
      });
    }
  }

  suggestions.sort((a, b) => b.confidence - a.confidence);

  if (suggestions.length === 0) {
    suggestions.push({ name: '雑費', confidence: 0.55, reason: '分類が困難なため' });
  }

  return suggestions.slice(0, 3);
}
