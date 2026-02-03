/**
 * SkyBlueEarthJapan 経費管理アプリ
 * Code.gs - エントリーポイント（doGet/doPost）
 *
 * Phase 0: リポジトリ初期化・設定
 */

// ===========================================
// Webアプリ エントリーポイント
// ===========================================

/**
 * GETリクエスト処理
 * @param {Object} e - イベントオブジェクト
 * @returns {HtmlOutput|TextOutput}
 */
function doGet(e) {
  const action = e.parameter.action || 'page';

  // API呼び出しの場合
  if (action === 'api') {
    return handleGetApi(e);
  }

  // HTMLページを返す
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle(APP.NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * POSTリクエスト処理
 * @param {Object} e - イベントオブジェクト
 * @returns {TextOutput}
 */
function doPost(e) {
  return handlePostApi(e);
}

// ===========================================
// GET API ハンドラー
// ===========================================

/**
 * GET APIを処理
 * @param {Object} e - イベントオブジェクト
 * @returns {TextOutput}
 */
function handleGetApi(e) {
  const method = e.parameter.method || '';

  try {
    switch (method) {
      // Health Check
      case 'health':
        return jsonOutput(apiHealth());

      // マスタ取得
      case 'getAccountTitles':
        return jsonOutput(getAccountTitles());
      case 'getVendors':
        return jsonOutput(getVendors());
      case 'getSubscriptions':
        return jsonOutput(listSubscriptions(e.parameter.activeOnly === 'true'));

      // 取引取得
      case 'getTransaction':
        return jsonOutput(getTransactionById(e.parameter.id));
      case 'listTransactions':
        return jsonOutput(listTransactions(parseFilters(e.parameter)));

      // 分析
      case 'getMonthlySummary':
        return jsonOutput(getMonthlySummary({
          year: parseInt(e.parameter.year),
          month: parseInt(e.parameter.month)
        }));
      case 'getCategoryBreakdown':
        return jsonOutput(getCategoryBreakdown({
          year: parseInt(e.parameter.year),
          month: parseInt(e.parameter.month)
        }));

      default:
        return jsonOutput(errorResponse('Unknown method: ' + method, ERROR_CODE.NOT_FOUND));
    }
  } catch (error) {
    logError('GET API error', error);
    return jsonOutput(errorResponse(error.message, ERROR_CODE.INTERNAL_ERROR));
  }
}

// ===========================================
// POST API ハンドラー
// ===========================================

/**
 * POST APIを処理
 * @param {Object} e - イベントオブジェクト
 * @returns {TextOutput}
 */
function handlePostApi(e) {
  let payload = {};

  try {
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }
  } catch (error) {
    return jsonOutput(errorResponse('Invalid JSON payload', ERROR_CODE.VALIDATION_ERROR));
  }

  const method = payload.method || e.parameter.method || '';

  try {
    switch (method) {
      // 取引
      case 'insertTransaction':
        return jsonOutput(insertTransaction(payload.data));
      case 'updateTransaction':
        return jsonOutput(updateTransaction(payload.transactionId, payload.updates));
      case 'voidTransaction':
        return jsonOutput(voidTransaction(payload.transactionId));

      // AI解析
      case 'analyzeInput':
        return jsonOutput(analyzeInput(payload));

      // 証憑
      case 'uploadReceipt':
        return jsonOutput(uploadReceipt(payload));

      // サブスク
      case 'createSubscription':
        return jsonOutput(createSubscription(payload.data));
      case 'updateSubscription':
        return jsonOutput(updateSubscription(payload.subscriptionId, payload.updates));
      case 'deactivateSubscription':
        return jsonOutput(deactivateSubscription(payload.subscriptionId));

      // 会計士同期
      case 'syncAccountant':
        return jsonOutput(syncToAccountant(payload));
      case 'resyncAccountant':
        return jsonOutput(resyncAccountantByMonth(payload.month));

      default:
        return jsonOutput(errorResponse('Unknown method: ' + method, ERROR_CODE.NOT_FOUND));
    }
  } catch (error) {
    logError('POST API error', error);
    if (error instanceof AppError) {
      return jsonOutput(errorResponseFromAppError(error));
    }
    return jsonOutput(errorResponse(error.message, ERROR_CODE.INTERNAL_ERROR));
  }
}

// ===========================================
// Health Check API
// ===========================================

/**
 * ヘルスチェック（Phase 0 Done条件）
 * @returns {Object}
 */
function apiHealth() {
  const settings = getSettings();

  return successResponse({
    status: 'ok',
    app: APP.NAME,
    version: APP.VERSION,
    timestamp: formatDateTime(getNow()),
    config: {
      dbSheetId: settings.DB_SHEET_ID ? 'set' : 'not set',
      accountantSheetId: settings.ACCOUNTANT_SHEET_ID ? 'set' : 'not set',
      receiptFolderId: settings.RECEIPT_FOLDER_ID ? 'set' : 'not set'
    }
  });
}

// ===========================================
// クライアント用関数（google.script.run から呼び出し）
// ===========================================

/**
 * 勘定科目一覧を取得
 */
function getAccountTitleList() {
  return getAccountTitles();
}

/**
 * 取引先ヒント一覧を取得
 */
function getVendorHintList() {
  return getVendors();
}

/**
 * AI解析実行
 */
function analyzeWithAI(payload) {
  return analyzeInput(payload);
}

/**
 * 取引を保存
 */
function saveTransaction(data) {
  // status を confirmed に設定
  data.status = TRANSACTION_STATUS.CONFIRMED;
  return insertTransaction(data);
}

/**
 * 取引一覧を取得
 */
function getTransactions(filters) {
  return listTransactions(filters);
}

/**
 * 取引を更新（クライアント用）
 */
function updateTransactionFromClient(payload) {
  return updateTransaction(payload.transactionId, payload.updates);
}

/**
 * 取引を無効化（クライアント用）
 */
function voidTransactionFromClient(transactionId) {
  return voidTransaction(transactionId);
}

/**
 * 月次サマリーを取得
 */
function getSummary(year, month) {
  return getMonthlySummary({ year, month });
}

/**
 * カテゴリ別内訳を取得
 */
function getBreakdown(year, month) {
  return getCategoryBreakdown({ year, month });
}

/**
 * 税金概算を取得
 */
function getTaxEstimate() {
  return calculateTaxEstimate();
}

/**
 * サブスク一覧を取得
 */
function getSubscriptionList(activeOnly) {
  return listSubscriptions(activeOnly);
}

// ===========================================
// HTMLファイルインクルード
// ===========================================

/**
 * HTMLファイルをインクルード
 * @param {string} filename - ファイル名
 * @returns {string}
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ===========================================
// ヘルパー関数
// ===========================================

/**
 * クエリパラメータからフィルタをパース
 * @param {Object} params - クエリパラメータ
 * @returns {Object}
 */
function parseFilters(params) {
  const filters = {};

  if (params.month) filters.month = params.month;
  if (params.type) filters.type = params.type;
  if (params.status) filters.status = params.status;
  if (params.accountTitle) filters.accountTitle = params.accountTitle;
  if (params.vendor) filters.vendor = params.vendor;
  if (params.search) filters.search = params.search;
  if (params.limit) filters.limit = parseInt(params.limit);
  if (params.offset) filters.offset = parseInt(params.offset);

  return filters;
}

// ===========================================
// カスタムメニュー
// ===========================================

/**
 * スプレッドシートのカスタムメニュー
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('経費管理アプリ')
    .addItem('DB初期化', 'initializeDatabase')
    .addItem('勘定科目マスタをリセット', 'resetAccountTitles')
    .addSeparator()
    .addItem('月次サブスク計上を実行', 'runMonthlySubscriptionPosting')
    .addItem('会計士共有を再同期', 'resyncAccountantAll')
    .addSeparator()
    .addItem('ヘルスチェック', 'showHealthCheck')
    .addToUi();
}

/**
 * ヘルスチェック結果を表示
 */
function showHealthCheck() {
  const health = apiHealth();
  SpreadsheetApp.getUi().alert(JSON.stringify(health, null, 2));
}
