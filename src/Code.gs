/**
 * SkyBlueEarthJapan 経費管理アプリ
 * Code.gs - エントリーポイント（doGet/doPost）
 */

// ===========================================
// Webアプリエントリーポイント
// ===========================================

/**
 * GETリクエストハンドラ（画面表示）
 * @param {Object} e - イベントオブジェクト
 * @returns {HtmlOutput} HTMLページ
 */
function doGet(e) {
  const page = e.parameter.page || 'home';

  try {
    // メインHTMLを返す（SPA）
    const template = HtmlService.createTemplateFromFile('index');
    template.initialPage = page;

    return template.evaluate()
      .setTitle(APP_CONFIG.APP_NAME)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (error) {
    logError('doGet error', error);
    return HtmlService.createHtmlOutput('<h1>エラーが発生しました</h1><p>' + error.message + '</p>');
  }
}

/**
 * POSTリクエストハンドラ（API）
 * @param {Object} e - イベントオブジェクト
 * @returns {TextOutput} JSONレスポンス
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    logInfo(`API Request: ${action}`, data);

    let result;
    switch (action) {
      // 取引関連
      case 'confirmTransaction':
        result = confirmTransaction(data.payload);
        break;
      case 'updateTransaction':
        result = updateTransaction(data.payload);
        break;
      case 'voidTransaction':
        result = voidTransaction(data.payload);
        break;
      case 'getTransaction':
        result = getTransaction(data.payload.id);
        break;
      case 'listTransactions':
        result = listTransactions(data.payload);
        break;

      // 証憑関連
      case 'uploadReceipt':
        result = uploadReceipt(data.payload);
        break;
      case 'getReceiptLink':
        result = getReceiptLink(data.payload.transactionId);
        break;

      // AI関連
      case 'analyzeInput':
        result = analyzeInput(data.payload);
        break;

      // マスタ関連
      case 'getAccountTitles':
        result = getAccountTitles();
        break;
      case 'getVendorHints':
        result = getVendorHints();
        break;

      // 分析関連
      case 'getMonthlySummary':
        result = getMonthlySummary(data.payload);
        break;
      case 'getCategoryBreakdown':
        result = getCategoryBreakdown(data.payload);
        break;
      case 'getMonthlyTrend':
        result = getMonthlyTrend(data.payload);
        break;
      case 'estimateTax':
        result = estimateTax(data.payload);
        break;

      // 会計士共有関連
      case 'syncAccountantExport':
        result = syncAccountantExport(data.payload);
        break;
      case 'resyncAccountantExport':
        result = resyncAccountantExport(data.payload);
        break;

      default:
        result = errorResponse('Unknown action: ' + action);
    }

    return jsonOutput(result);

  } catch (error) {
    logError('doPost error', error);
    return jsonOutput(errorResponse(error.message, HTTP_STATUS.INTERNAL_ERROR));
  }
}

// ===========================================
// HTMLテンプレートヘルパー
// ===========================================

/**
 * 外部ファイルをインクルード
 * @param {string} filename - ファイル名
 * @returns {string} ファイル内容
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ===========================================
// クライアントから呼び出す関数（google.script.run用）
// ===========================================

/**
 * 取引を確定して保存
 * @param {Object} transactionData - 取引データ
 * @returns {Object} 結果
 */
function saveTransaction(transactionData) {
  return confirmTransaction(transactionData);
}

/**
 * 取引を更新
 * @param {Object} updateData - 更新データ
 * @returns {Object} 結果
 */
function updateTransactionFromClient(updateData) {
  return updateTransaction(updateData);
}

/**
 * 取引を無効化
 * @param {string} transactionId - 取引ID
 * @returns {Object} 結果
 */
function voidTransactionFromClient(transactionId) {
  return voidTransaction({ transactionId: transactionId });
}

/**
 * 取引一覧を取得
 * @param {Object} filters - フィルタ条件
 * @returns {Object} 取引一覧
 */
function getTransactions(filters) {
  return listTransactions(filters);
}

/**
 * 取引詳細を取得
 * @param {string} transactionId - 取引ID
 * @returns {Object} 取引詳細
 */
function getTransactionDetail(transactionId) {
  return getTransaction(transactionId);
}

/**
 * AI解析を実行
 * @param {Object} inputData - 入力データ
 * @returns {Object} 解析結果
 */
function analyzeWithAI(inputData) {
  return analyzeInput(inputData);
}

/**
 * 勘定科目一覧を取得
 * @returns {Object} 勘定科目一覧
 */
function getAccountTitleList() {
  return getAccountTitles();
}

/**
 * 取引先ヒント一覧を取得
 * @returns {Object} 取引先ヒント
 */
function getVendorHintList() {
  return getVendorHints();
}

/**
 * 月次サマリーを取得
 * @param {number} year - 年
 * @param {number} month - 月
 * @returns {Object} サマリー
 */
function getSummary(year, month) {
  return getMonthlySummary({ year: year, month: month });
}

/**
 * カテゴリ別内訳を取得
 * @param {number} year - 年
 * @param {number} month - 月
 * @returns {Object} カテゴリ別内訳
 */
function getBreakdown(year, month) {
  return getCategoryBreakdown({ year: year, month: month });
}

/**
 * 月次推移を取得
 * @param {number} months - 取得する月数
 * @returns {Object} 月次推移
 */
function getTrend(months) {
  return getMonthlyTrend({ months: months || 12 });
}

/**
 * 概算税額を取得
 * @returns {Object} 概算税額
 */
function getTaxEstimate() {
  return estimateTax({});
}

/**
 * 証憑をアップロード
 * @param {string} transactionId - 取引ID
 * @param {string} base64Data - Base64エンコードされたファイルデータ
 * @param {string} filename - ファイル名
 * @param {string} mimeType - MIMEタイプ
 * @returns {Object} アップロード結果
 */
function uploadReceiptFile(transactionId, base64Data, filename, mimeType) {
  return uploadReceipt({
    transactionId: transactionId,
    base64Data: base64Data,
    filename: filename,
    mimeType: mimeType
  });
}

/**
 * 設定を取得
 * @returns {Object} 設定
 */
function getAppSettings() {
  return getSettings();
}

// ===========================================
// 設定取得
// ===========================================

/**
 * 01_SETTINGSから設定を読み込む
 * @returns {Object} 設定オブジェクト
 */
function getSettings() {
  try {
    const sheet = getSheet(SHEETS.SETTINGS);
    if (!sheet) {
      return errorResponse('Settings sheet not found');
    }

    const lastRow = getLastRow(sheet);
    if (lastRow < 2) {
      return successResponse({ settings: {} });
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    const settings = {};

    for (const row of data) {
      const key = row[0];
      const value = row[1];
      if (key) {
        settings[key] = value;
      }
    }

    return successResponse({ settings: settings });
  } catch (error) {
    logError('getSettings error', error);
    return errorResponse(error.message);
  }
}

/**
 * 設定値を取得
 * @param {string} key - 設定キー
 * @param {*} defaultValue - デフォルト値
 * @returns {*} 設定値
 */
function getSettingValue(key, defaultValue = null) {
  const result = getSettings();
  if (result.success && result.settings) {
    return result.settings[key] || defaultValue;
  }
  return defaultValue;
}
