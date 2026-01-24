/**
 * SkyBlueEarthJapan 経費管理アプリ
 * InitDB.gs - データベース初期化
 */

// ===========================================
// DB初期化（メイン関数）
// ===========================================

/**
 * データベースを初期化
 * 全シートを作成し、ヘッダーと初期データを設定
 */
function initializeDatabase() {
  const ss = getSpreadsheet();

  logInfo('Database initialization started');

  // 各シートを作成
  createReadmeSheet(ss);
  createSettingsSheet(ss);
  createAccountTitlesSheet(ss);
  createVendorsSheet(ss);
  createTransactionsSheet(ss);
  createAttachmentsSheet(ss);
  createAuditLogSheet(ss);
  createAccountantExportSheet(ss);
  createDashboardSheet(ss);

  logInfo('Database initialization completed');

  return successResponse({ message: 'Database initialized successfully' });
}

// ===========================================
// 各シート作成関数
// ===========================================

/**
 * 00_READMEシートを作成
 */
function createReadmeSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEETS.README);

  // タイトルと説明
  const content = [
    ['SkyBlueEarthJapan 経費管理アプリ - データベース'],
    [''],
    ['シート一覧'],
    ['シート名', '用途'],
    ['00_README', 'このシート（説明）'],
    ['01_SETTINGS', 'アプリ設定'],
    ['02_MASTER_AccountTitles', '勘定科目マスタ'],
    ['03_MASTER_Vendors', '取引先マスタ'],
    ['10_TRANSACTIONS', '取引台帳（メイン）'],
    ['11_ATTACHMENTS', '証憑一覧'],
    ['12_AUDIT_LOG', '変更履歴'],
    ['20_ACCOUNTANT_EXPORT', '会計士共有用エクスポート'],
    ['30_DASHBOARD', '分析ダッシュボード'],
    [''],
    ['注意事項'],
    ['・シート名を変更しないでください'],
    ['・ヘッダー行（1行目）を削除しないでください'],
    ['・データの直接編集は推奨しません（アプリから操作してください）']
  ];

  sheet.getRange(1, 1, content.length, 2).setValues(content);

  // スタイリング
  sheet.getRange(1, 1).setFontSize(16).setFontWeight('bold');
  sheet.getRange(3, 1).setFontWeight('bold');
  sheet.getRange(4, 1, 1, 2).setFontWeight('bold').setBackground('#e3f2fd');
  sheet.getRange(15, 1).setFontWeight('bold');

  sheet.setColumnWidth(1, 250);
  sheet.setColumnWidth(2, 300);
}

/**
 * 01_SETTINGSシートを作成
 */
function createSettingsSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEETS.SETTINGS);

  // ヘッダー
  const headers = ['key', 'value', 'description'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader(sheet, headers.length);

  // 初期設定値
  const settings = [
    ['APP_NAME', 'SkyBlueEarth経費管理', 'アプリ名'],
    ['BUSINESS_NAME', 'スカイブルーアースジャパン', '屋号'],
    ['DB_SHEET_ID', '', 'メインDBスプレッドシートID（このシート）'],
    ['ACCOUNTANT_SHEET_ID', '', '会計士共有用スプレッドシートID'],
    ['RECEIPT_FOLDER_ID', '', '証憑保存用DriveフォルダID'],
    ['OPENAI_API_KEY', '', 'OpenAI APIキー'],
    ['TIMEZONE', 'Asia/Tokyo', 'タイムゾーン'],
    ['FISCAL_YEAR_START', '1', '会計年度開始月（1-12）'],
    ['SHOW_RECEIPT_TO_ACCOUNTANT', 'true', '会計士に証憑URLを表示するか']
  ];

  sheet.getRange(2, 1, settings.length, 3).setValues(settings);

  // 列幅
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 350);
  sheet.setColumnWidth(3, 300);
}

/**
 * 02_MASTER_AccountTitlesシートを作成
 */
function createAccountTitlesSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEETS.ACCOUNT_TITLES);

  // ヘッダー
  const headers = ['account_title_id', 'name', 'type', 'description', 'keywords', 'default_confidence', 'active', 'sort_order'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader(sheet, headers.length);

  // 初期データを挿入
  const data = INITIAL_ACCOUNT_TITLES.map(at => [
    at.id,
    at.name,
    at.type,
    at.description,
    at.keywords,
    at.confidence,
    true,
    at.sortOrder
  ]);

  if (data.length > 0) {
    sheet.getRange(2, 1, data.length, headers.length).setValues(data);
  }

  // 列幅
  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 80);
  sheet.setColumnWidth(4, 200);
  sheet.setColumnWidth(5, 300);
  sheet.setColumnWidth(6, 120);
  sheet.setColumnWidth(7, 60);
  sheet.setColumnWidth(8, 80);
}

/**
 * 03_MASTER_Vendorsシートを作成
 */
function createVendorsSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEETS.VENDORS);

  // ヘッダー
  const headers = ['vendor_id', 'name', 'default_account_title', 'usage_count', 'last_used_at', 'active'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader(sheet, headers.length);

  // サンプルデータ
  const sampleVendors = [
    ['V001', 'Amazon', '消耗品費', 0, '', true],
    ['V002', 'セブンイレブン', '雑費', 0, '', true],
    ['V003', '楽天', '消耗品費', 0, '', true]
  ];

  sheet.getRange(2, 1, sampleVendors.length, headers.length).setValues(sampleVendors);

  // 列幅
  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 100);
  sheet.setColumnWidth(5, 150);
  sheet.setColumnWidth(6, 60);
}

/**
 * 10_TRANSACTIONSシートを作成
 */
function createTransactionsSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEETS.TRANSACTIONS);

  // ヘッダー
  const headers = [
    'id', 'type', 'date', 'month', 'amount', 'vendor', 'description',
    'account_title', 'payment_method', 'receipt_url', 'receipt_fileId',
    'memo', 'tags', 'status', 'ai_raw', 'ai_confidence', 'created_at', 'updated_at'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader(sheet, headers.length);

  // 列幅設定
  const widths = [280, 80, 100, 80, 100, 150, 200, 100, 100, 250, 250, 200, 100, 80, 300, 80, 150, 150];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  // データバリデーション（type列）
  const typeValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(['expense', 'revenue'])
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 2, 1000, 1).setDataValidation(typeValidation);

  // データバリデーション（status列）
  const statusValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(['draft', 'confirmed', 'void'])
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 14, 1000, 1).setDataValidation(statusValidation);

  // データバリデーション（payment_method列）
  const paymentValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(['cash', 'bank', 'card', 'other', ''])
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 9, 1000, 1).setDataValidation(paymentValidation);
}

/**
 * 11_ATTACHMENTSシートを作成
 */
function createAttachmentsSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEETS.ATTACHMENTS);

  // ヘッダー
  const headers = ['attachment_id', 'transaction_id', 'fileId', 'url', 'filename', 'mimeType', 'fileSize', 'created_at'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader(sheet, headers.length);

  // 列幅
  const widths = [280, 280, 280, 350, 200, 100, 100, 150];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
}

/**
 * 12_AUDIT_LOGシートを作成
 */
function createAuditLogSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEETS.AUDIT_LOG);

  // ヘッダー
  const headers = ['audit_id', 'transaction_id', 'action', 'before_json', 'after_json', 'changed_fields', 'editor', 'timestamp'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader(sheet, headers.length);

  // 列幅
  const widths = [280, 280, 80, 400, 400, 200, 150, 150];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
}

/**
 * 20_ACCOUNTANT_EXPORTシートを作成
 */
function createAccountantExportSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEETS.ACCOUNTANT_EXPORT);

  // ヘッダー
  const headers = ['transaction_id', '取引日', '勘定科目', '金額', '取引先', '摘要', '支払方法', '証憑URL', 'メモ', 'ステータス', 'synced_at'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader(sheet, headers.length);

  // 列幅
  const widths = [280, 100, 100, 100, 150, 200, 80, 250, 200, 80, 150];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
}

/**
 * 30_DASHBOARDシートを作成
 */
function createDashboardSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEETS.DASHBOARD);

  // ヘッダー
  const headers = ['month', 'total_revenue', 'total_expense', 'profit', 'expense_breakdown_json', 'updated_at'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader(sheet, headers.length);

  // 列幅
  const widths = [100, 120, 120, 120, 400, 150];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
}

// ===========================================
// ヘルパー関数
// ===========================================

/**
 * シートを取得または作成
 * @param {Spreadsheet} ss - スプレッドシート
 * @param {string} sheetName - シート名
 * @returns {Sheet} シート
 */
function getOrCreateSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    logInfo(`Created sheet: ${sheetName}`);
  } else {
    // 既存のデータをクリア（初期化時のみ）
    sheet.clear();
    logInfo(`Cleared sheet: ${sheetName}`);
  }
  return sheet;
}

/**
 * ヘッダー行にスタイルを適用
 * @param {Sheet} sheet - シート
 * @param {number} numCols - 列数
 */
function styleHeader(sheet, numCols) {
  const headerRange = sheet.getRange(1, 1, 1, numCols);
  headerRange
    .setFontWeight('bold')
    .setBackground('#e3f2fd')
    .setBorder(true, true, true, true, false, false);

  // ヘッダー行を固定
  sheet.setFrozenRows(1);
}

// ===========================================
// メニュー追加（GASエディタから実行用）
// ===========================================

/**
 * カスタムメニューを追加
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('経費管理アプリ')
    .addItem('DBを初期化', 'initializeDatabase')
    .addItem('勘定科目マスタをリセット', 'resetAccountTitles')
    .addSeparator()
    .addItem('会計士共有を再同期', 'resyncAllAccountantExport')
    .addItem('ダッシュボードを更新', 'updateDashboard')
    .addToUi();
}

/**
 * 勘定科目マスタをリセット
 */
function resetAccountTitles() {
  const ss = getSpreadsheet();
  createAccountTitlesSheet(ss);
  SpreadsheetApp.getUi().alert('勘定科目マスタをリセットしました');
}

/**
 * 会計士共有を全件再同期
 */
function resyncAllAccountantExport() {
  const result = resyncAccountantExport({});
  if (result.success) {
    SpreadsheetApp.getUi().alert(`会計士共有を再同期しました（${result.count}件）`);
  } else {
    SpreadsheetApp.getUi().alert('エラー: ' + result.error.message);
  }
}

/**
 * ダッシュボードを更新
 */
function updateDashboard() {
  // 現在月のサマリーを計算して30_DASHBOARDに保存
  const now = getNow();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const summary = getMonthlySummary({ year, month });
  const breakdown = getCategoryBreakdown({ year, month });

  if (summary.success && breakdown.success) {
    const sheet = getSheet(SHEETS.DASHBOARD);
    const monthStr = formatMonth(now);

    // 既存の月データを検索
    const lastRow = getLastRow(sheet);
    let targetRow = lastRow + 1;

    if (lastRow >= 2) {
      const months = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < months.length; i++) {
        if (months[i][0] === monthStr) {
          targetRow = i + 2;
          break;
        }
      }
    }

    // データを書き込み
    const row = [
      monthStr,
      summary.revenue || 0,
      summary.expense || 0,
      summary.profit || 0,
      JSON.stringify(breakdown.breakdown || []),
      formatDateTime(getNow())
    ];

    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);

    SpreadsheetApp.getUi().alert('ダッシュボードを更新しました');
  } else {
    SpreadsheetApp.getUi().alert('エラーが発生しました');
  }
}
