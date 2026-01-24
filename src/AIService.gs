/**
 * SkyBlueEarthJapan 経費管理アプリ
 * AIService.gs - AI連携（OpenAI API）
 */

// ===========================================
// AI解析メイン関数
// ===========================================

/**
 * 入力テキストをAIで解析
 * @param {Object} payload - 解析リクエスト
 * @param {string} payload.utterance - ユーザー入力テキスト
 * @param {string} payload.inputMode - 入力モード（voice/text）
 * @returns {Object} 解析結果
 */
function analyzeInput(payload) {
  try {
    const { utterance, inputMode } = payload;

    if (!utterance || utterance.trim() === '') {
      return errorResponse('入力がありません');
    }

    // コンテキスト情報を取得
    const context = buildAIContext();

    // AIリクエストを構築
    const aiRequest = {
      utterance: utterance,
      input_mode: inputMode || 'text',
      now: getToday(),
      timezone: APP_CONFIG.TIMEZONE,
      context: context
    };

    // OpenAI APIを呼び出し
    const apiKey = getSettingValue('OPENAI_API_KEY');
    if (!apiKey) {
      // APIキーがない場合はルールベースで処理
      logInfo('No API key, using rule-based analysis');
      return ruleBasedAnalysis(utterance, context);
    }

    const aiResponse = callOpenAI(apiKey, aiRequest);

    if (!aiResponse.success) {
      // API呼び出し失敗時はルールベースにフォールバック
      logInfo('API call failed, falling back to rule-based analysis');
      return ruleBasedAnalysis(utterance, context);
    }

    return successResponse(aiResponse.data);

  } catch (error) {
    logError('analyzeInput error', error);
    return errorResponse(ERROR_MESSAGES.AI_PARSE_ERROR);
  }
}

// ===========================================
// コンテキスト構築
// ===========================================

/**
 * AI用のコンテキスト情報を構築
 * @returns {Object} コンテキスト
 */
function buildAIContext() {
  // 勘定科目を取得
  const accountTitlesResult = getAccountTitles();
  const accountTitles = accountTitlesResult.success
    ? accountTitlesResult.accountTitles.map(at => ({
      name: at.name,
      keywords: at.keywords ? at.keywords.split(',').map(k => k.trim()) : []
    }))
    : [];

  // 取引先ヒントを取得
  const vendorHintsResult = getVendorHints();
  const vendorHints = vendorHintsResult.success
    ? vendorHintsResult.vendors.slice(0, 20).map(v => ({
      vendor: v.name,
      default_account_title: v.defaultAccountTitle
    }))
    : [];

  return {
    business_name: APP_CONFIG.BUSINESS_NAME,
    payment_methods: Object.keys(PAYMENT_METHOD_LABELS),
    account_titles: accountTitles,
    vendor_hints: vendorHints
  };
}

// ===========================================
// OpenAI API呼び出し
// ===========================================

/**
 * OpenAI APIを呼び出し
 * @param {string} apiKey - APIキー
 * @param {Object} aiRequest - リクエストデータ
 * @returns {Object} AIレスポンス
 */
function callOpenAI(apiKey, aiRequest) {
  try {
    const systemPrompt = getSystemPrompt();
    const userPrompt = getUserPrompt(aiRequest);

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

    const options = {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode !== 200) {
      logError('OpenAI API error', { code: responseCode, response: responseText });
      return { success: false, error: 'API error: ' + responseCode };
    }

    const responseJson = JSON.parse(responseText);
    const content = responseJson.choices[0].message.content;

    // JSONをパース
    const aiOutput = JSON.parse(content);

    // レスポンスを正規化
    return {
      success: true,
      data: normalizeAIResponse(aiOutput)
    };

  } catch (error) {
    logError('callOpenAI error', error);
    return { success: false, error: error.message };
  }
}

// ===========================================
// プロンプト定義
// ===========================================

/**
 * システムプロンプトを取得
 * @returns {string} システムプロンプト
 */
function getSystemPrompt() {
  return `あなたは個人事業の経理秘書です。
ユーザーの入力（音声の文字起こし/テキスト）から、取引（売上/経費）を構造化します。
必ずJSONのみで出力してください。余計な文章は一切出力しないでください。
不明な項目は推測で埋めず、missing_fields に入れ、最大2つまで質問してください。
税務判断の断定はしません。「一般的には」などの表現も出力しません（UI側で注意書きを出します）。

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
  "warnings": [
    {"code": "警告コード", "text": "警告メッセージ"}
  ]
}`;
}

/**
 * ユーザープロンプトを生成
 * @param {Object} aiRequest - リクエストデータ
 * @returns {string} ユーザープロンプト
 */
function getUserPrompt(aiRequest) {
  return `次の入力を取引として解釈し、指定のJSON形式で返してください。
${JSON.stringify(aiRequest, null, 2)}`;
}

// ===========================================
// AIレスポンス正規化
// ===========================================

/**
 * AIレスポンスを正規化
 * @param {Object} aiOutput - AIの出力
 * @returns {Object} 正規化されたレスポンス
 */
function normalizeAIResponse(aiOutput) {
  const fields = aiOutput.fields || {};

  return {
    type: aiOutput.type || TRANSACTION_TYPE.EXPENSE,
    fields: {
      date: fields.date || '',
      amount: fields.amount !== undefined ? fields.amount : null,
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

/**
 * ルールベースで解析（APIなし時のフォールバック）
 * @param {string} utterance - 入力テキスト
 * @param {Object} context - コンテキスト
 * @returns {Object} 解析結果
 */
function ruleBasedAnalysis(utterance, context) {
  const text = utterance.toLowerCase();

  // 種別判定
  const type = detectTransactionType(text);

  // 日付抽出
  const date = extractDate(text);

  // 金額抽出
  const amount = extractAmount(text);

  // 取引先抽出
  const vendor = extractVendor(text, context.vendor_hints);

  // 勘定科目推定
  const accountTitleSuggestions = suggestAccountTitles(text, context.account_titles, vendor);

  // 不足フィールドを特定
  const missingFields = [];
  const questions = [];

  if (!date) {
    missingFields.push('date');
    questions.push({
      id: 'q_date',
      text: 'いつの取引ですか？（例：昨日、1/20）',
      choices: []
    });
  }

  if (!amount) {
    missingFields.push('amount');
    questions.push({
      id: 'q_amount',
      text: '金額はいくらですか？',
      choices: []
    });
  }

  // 信頼度計算
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
      description: extractDescription(text, vendor),
      paymentMethod: extractPaymentMethod(text),
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

/**
 * 取引種別を検出
 * @param {string} text - テキスト
 * @returns {string} 取引種別
 */
function detectTransactionType(text) {
  const revenueKeywords = ['入金', '売上', '報酬', '請求', '振込', '振り込'];
  const expenseKeywords = ['買った', '払った', '支払', '購入', '使った', '出費'];

  for (const keyword of revenueKeywords) {
    if (text.includes(keyword)) {
      return TRANSACTION_TYPE.REVENUE;
    }
  }

  for (const keyword of expenseKeywords) {
    if (text.includes(keyword)) {
      return TRANSACTION_TYPE.EXPENSE;
    }
  }

  // デフォルトは経費
  return TRANSACTION_TYPE.EXPENSE;
}

/**
 * 日付を抽出
 * @param {string} text - テキスト
 * @returns {string|null} YYYY-MM-DD形式の日付
 */
function extractDate(text) {
  const today = getNow();

  // 今日
  if (text.includes('今日') || text.includes('本日')) {
    return formatDate(today);
  }

  // 昨日
  if (text.includes('昨日')) {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return formatDate(d);
  }

  // 一昨日
  if (text.includes('一昨日') || text.includes('おととい')) {
    const d = new Date(today);
    d.setDate(d.getDate() - 2);
    return formatDate(d);
  }

  // M/D形式
  const mdMatch = text.match(/(\d{1,2})[\/月](\d{1,2})/);
  if (mdMatch) {
    const month = parseInt(mdMatch[1]);
    const day = parseInt(mdMatch[2]);
    const year = today.getFullYear();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // YYYY-MM-DD形式
  const ymdMatch = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${String(ymdMatch[2]).padStart(2, '0')}-${String(ymdMatch[3]).padStart(2, '0')}`;
  }

  return null;
}

/**
 * 金額を抽出
 * @param {string} text - テキスト
 * @returns {number|null} 金額
 */
function extractAmount(text) {
  // 10万、10万円 -> 100000
  const manMatch = text.match(/(\d+(?:\.\d+)?)\s*万(?:円)?/);
  if (manMatch) {
    return Math.floor(parseFloat(manMatch[1]) * 10000);
  }

  // 1万2千円 -> 12000
  const manSenMatch = text.match(/(\d+)\s*万\s*(\d+)\s*千(?:円)?/);
  if (manSenMatch) {
    return parseInt(manSenMatch[1]) * 10000 + parseInt(manSenMatch[2]) * 1000;
  }

  // 12,000円、12000円
  const yenMatch = text.match(/([0-9,，]+)\s*円/);
  if (yenMatch) {
    return parseAmount(yenMatch[1]);
  }

  // 数字のみ（金額っぽいもの）
  const numMatch = text.match(/([0-9,，]+)/g);
  if (numMatch) {
    for (const num of numMatch) {
      const parsed = parseAmount(num);
      if (parsed && parsed >= 100) {
        return parsed;
      }
    }
  }

  return null;
}

/**
 * 取引先を抽出
 * @param {string} text - テキスト
 * @param {Array} vendorHints - 取引先ヒント
 * @returns {string|null} 取引先名
 */
function extractVendor(text, vendorHints) {
  // 既知の取引先をチェック
  for (const hint of vendorHints) {
    if (text.includes(hint.vendor.toLowerCase())) {
      return hint.vendor;
    }
  }

  // よく使われる取引先パターン
  const commonVendors = [
    'amazon', 'アマゾン', '楽天', 'セブン', 'ローソン', 'ファミマ',
    'スタバ', 'マクドナルド', 'jr', '電車', 'タクシー'
  ];

  for (const vendor of commonVendors) {
    if (text.includes(vendor)) {
      // 正式名称に変換
      if (vendor === 'amazon' || vendor === 'アマゾン') return 'Amazon';
      if (vendor === 'セブン') return 'セブンイレブン';
      if (vendor === 'ファミマ') return 'ファミリーマート';
      if (vendor === 'スタバ') return 'スターバックス';
      if (vendor === 'マクドナルド') return 'マクドナルド';
      return vendor;
    }
  }

  // 「〇〇で」「〇〇から」パターン
  const vendorMatch = text.match(/(.{2,10}?)(?:で|から|に)/);
  if (vendorMatch) {
    const candidate = vendorMatch[1].trim();
    // 日付っぽいものは除外
    if (!/^(今日|昨日|一昨日|\d)/.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * 摘要を抽出
 * @param {string} text - テキスト
 * @param {string} vendor - 取引先
 * @returns {string} 摘要
 */
function extractDescription(text, vendor) {
  // キーワードから用途を推定
  const descriptionKeywords = {
    '事務用品': '事務用品購入',
    '文房具': '文房具購入',
    '備品': '備品購入',
    '電車': '交通費',
    'タクシー': 'タクシー代',
    '高速': '高速道路代',
    'ガソリン': 'ガソリン代',
    '打ち合わせ': '打ち合わせ',
    '会議': '会議費',
    '本': '書籍購入',
    '入金': '入金',
    '報酬': '報酬'
  };

  for (const [keyword, desc] of Object.entries(descriptionKeywords)) {
    if (text.includes(keyword)) {
      return desc;
    }
  }

  // 取引先がある場合
  if (vendor) {
    return `${vendor}での支払い`;
  }

  return '支払い';
}

/**
 * 支払方法を抽出
 * @param {string} text - テキスト
 * @returns {string} 支払方法
 */
function extractPaymentMethod(text) {
  if (text.includes('カード') || text.includes('クレジット')) {
    return PAYMENT_METHOD.CARD;
  }
  if (text.includes('現金')) {
    return PAYMENT_METHOD.CASH;
  }
  if (text.includes('振込') || text.includes('振り込') || text.includes('口座')) {
    return PAYMENT_METHOD.BANK;
  }
  return '';
}

/**
 * 勘定科目を推定
 * @param {string} text - テキスト
 * @param {Array} accountTitles - 勘定科目一覧
 * @param {string} vendor - 取引先
 * @returns {Array} 勘定科目候補
 */
function suggestAccountTitles(text, accountTitles, vendor) {
  const suggestions = [];

  for (const at of accountTitles) {
    let confidence = 0.3;
    let matchedKeyword = null;

    // キーワードマッチ
    if (at.keywords && at.keywords.length > 0) {
      for (const keyword of at.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          confidence = Math.max(confidence, 0.7);
          matchedKeyword = keyword;
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

  // 信頼度でソート
  suggestions.sort((a, b) => b.confidence - a.confidence);

  // 候補がない場合は雑費を追加
  if (suggestions.length === 0) {
    suggestions.push({
      name: '雑費',
      confidence: 0.55,
      reason: '分類が困難なため'
    });
  }

  return suggestions.slice(0, 3);
}
