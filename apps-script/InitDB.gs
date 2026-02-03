/**
 * SkyBlueEarthJapan 経費管理アプリ
 * InitDB.gs - データベース初期化
 *
 * Phase 0: リポジトリ初期化・設定
 */

// ===========================================
// 初期勘定科目データ
// ===========================================
const INITIAL_ACCOUNT_TITLES = [
  // 売上系
  { id: 'AT001', name: '売上高', type: 'revenue', description: '本業の売上', keywords: '売上,報酬,請求,入金', confidence: 0.90, sortOrder: 1 },
  { id: 'AT002', name: '雑収入', type: 'revenue', description: 'その他の収入', keywords: '雑収入,その他収入', confidence: 0.70, sortOrder: 2 },

  // 経費系（使用頻度 高）
  { id: 'AT010', name: '消耗品費', type: 'expense', description: '事務用品・備品（10万円未満）', keywords: '文房具,事務用品,Amazon,備品,消耗品', confidence: 0.70, sortOrder: 10 },
  { id: 'AT011', name: '旅費交通費', type: 'expense', description: '移動に関する費用', keywords: '電車,バス,タクシー,高速,駐車場,ガソリン,新幹線,飛行機', confidence: 0.75, sortOrder: 11 },
  { id: 'AT012', name: '通信費', type: 'expense', description: '通信・ネット関連', keywords: '携帯,電話,WiFi,インターネット,プロバイダ,ドメイン,サーバー', confidence: 0.80, sortOrder: 12 },
  { id: 'AT013', name: '会議費', type: 'expense', description: '打ち合わせ・会議', keywords: 'カフェ,打ち合わせ,会議,コワーキング,ミーティング', confidence: 0.65, sortOrder: 13 },
  { id: 'AT014', name: '接待交際費', type: 'expense', description: '取引先との会食等', keywords: '会食,接待,贈答,手土産,お歳暮,お中元', confidence: 0.70, sortOrder: 14 },
  { id: 'AT015', name: '外注費', type: 'expense', description: '業務委託', keywords: '外注,業務委託,デザイン費,制作費,翻訳', confidence: 0.75, sortOrder: 15 },
  { id: 'AT016', name: '広告宣伝費', type: 'expense', description: '広告・PR', keywords: '広告,SNS,チラシ,Google広告,Facebook広告,PR', confidence: 0.70, sortOrder: 16 },
  { id: 'AT017', name: '水道光熱費', type: 'expense', description: '電気・水道・ガス', keywords: '電気,水道,ガス,光熱費', confidence: 0.80, sortOrder: 17 },
  { id: 'AT018', name: '地代家賃', type: 'expense', description: '事務所・作業場', keywords: '家賃,レンタルオフィス,シェアオフィス,賃料', confidence: 0.85, sortOrder: 18 },
  { id: 'AT019', name: '支払手数料', type: 'expense', description: '手数料', keywords: '振込手数料,決済手数料,PayPal手数料,Stripe手数料', confidence: 0.80, sortOrder: 19 },
  { id: 'AT020', name: '新聞図書費', type: 'expense', description: '書籍・資料', keywords: '本,書籍,雑誌,新聞,参考書,電子書籍', confidence: 0.70, sortOrder: 20 },

  // 経費系（頻度 中）
  { id: 'AT021', name: '研修費', type: 'expense', description: '講座・セミナー', keywords: 'セミナー,講座,研修,オンライン講座', confidence: 0.70, sortOrder: 21 },
  { id: 'AT022', name: '修繕費', type: 'expense', description: '修理費', keywords: '修理,メンテナンス,修繕', confidence: 0.70, sortOrder: 22 },
  { id: 'AT023', name: '損害保険料', type: 'expense', description: '保険', keywords: '保険,損害保険,賠償責任保険', confidence: 0.75, sortOrder: 23 },
  { id: 'AT024', name: '福利厚生費', type: 'expense', description: '従業員福利', keywords: '健康診断,福利厚生', confidence: 0.65, sortOrder: 24 },
  { id: 'AT025', name: '車両費', type: 'expense', description: '車関連', keywords: '車検,自動車税,駐車場代', confidence: 0.75, sortOrder: 25 },

  // その他
  { id: 'AT099', name: '雑費', type: 'expense', description: 'その他', keywords: '不明,その他,分類不能', confidence: 0.55, sortOrder: 99 }
];

// ===========================================
// DB初期化メイン
// ===========================================

/**
 * データベースを初期化（全シート作成）
 */
function initializeDatabase() {
  logInfo('Database initialization started');

  const ss = getSpreadsheet();

  // 各シートを作成
  createReadmeSheet_(ss);
  createSettingsSheet_(ss);
  createAccountTitlesSheet_(ss);
  createVendorsSheet_(ss);
  createSubscriptionsSheet_(ss);
  createSubscriptionPostingsSheet_(ss);
  createTransactionsSheet_(ss);
  createAttachmentsSheet_(ss);
  createAuditLogSheet_(ss);
  createAccountantExportSheet_(ss);
  createDashboardSheet_(ss);

  logInfo('Database initialization completed');

  return successResponse({ message: 'Database initialized successfully' });
}

// ===========================================
// シート作成関数
// ===========================================

function createReadmeSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.README);
  const content = [
    ['SkyBlueEarthJapan 経費管理アプリ - データベース'],
    [''],
    ['シート一覧'],
    ['シート名', '用途'],
    [SHEET_NAMES.README, 'このシート（説明）'],
    [SHEET_NAMES.SETTINGS, 'アプリ設定'],
    [SHEET_NAMES.ACCOUNT_TITLES, '勘定科目マスタ'],
    [SHEET_NAMES.VENDORS, '取引先マスタ'],
    [SHEET_NAMES.SUBSCRIPTIONS, 'サブスク台帳'],
    [SHEET_NAMES.SUBSCRIPTION_POSTINGS, 'サブスク計上履歴'],
    [SHEET_NAMES.TRANSACTIONS, '取引台帳'],
    [SHEET_NAMES.ATTACHMENTS, '証憑一覧'],
    [SHEET_NAMES.AUDIT_LOG, '変更履歴'],
    [SHEET_NAMES.ACCOUNTANT_EXPORT, '会計士共有用'],
    [SHEET_NAMES.DASHBOARD, '分析ダッシュボード'],
    [''],
    ['注意事項'],
    ['・シート名を変更しないでください'],
    ['・ヘッダー行を削除しないでください'],
    ['・データの直接編集は推奨しません']
  ];
  sheet.getRange(1, 1, content.length, 2).setValues(content);
  sheet.getRange(1, 1).setFontSize(16).setFontWeight('bold');
  sheet.setColumnWidth(1, 250);
  sheet.setColumnWidth(2, 300);
}

function createSettingsSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.SETTINGS);
  const headers = ['key', 'value', 'description'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader_(sheet, headers.length);

  const settings = [
    ['APP_NAME', 'SkyBlueEarth経費管理', 'アプリ名'],
    ['BUSINESS_NAME', 'スカイブルーアースジャパン', '屋号'],
    ['DB_SHEET_ID', '', 'メインDBスプレッドシートID'],
    ['ACCOUNTANT_SHEET_ID', '', '会計士共有用スプレッドシートID'],
    ['RECEIPT_FOLDER_ID', '', '証憑保存用DriveフォルダID'],
    ['OPENAI_API_KEY', '', 'OpenAI APIキー'],
    ['TIMEZONE', 'Asia/Tokyo', 'タイムゾーン'],
    ['DEFAULT_TAX_CATEGORY', '課税仕入10%', 'デフォルト税区分（CSV出力用）'],
    ['SHOW_RECEIPT_TO_ACCOUNTANT', 'true', '会計士に証憑URLを表示']
  ];
  sheet.getRange(2, 1, settings.length, 3).setValues(settings);
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 350);
  sheet.setColumnWidth(3, 300);
}

function createAccountTitlesSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.ACCOUNT_TITLES);
  const headers = ['account_title_id', 'name', 'type', 'description', 'keywords', 'default_confidence', 'active', 'sort_order'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader_(sheet, headers.length);

  const data = INITIAL_ACCOUNT_TITLES.map(at => [
    at.id, at.name, at.type, at.description, at.keywords, at.confidence, true, at.sortOrder
  ]);
  sheet.getRange(2, 1, data.length, headers.length).setValues(data);
}

function createVendorsSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.VENDORS);
  const headers = ['vendor_id', 'name', 'default_account_title', 'usage_count', 'last_used_at', 'active'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader_(sheet, headers.length);
}

function createSubscriptionsSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.SUBSCRIPTIONS);
  const headers = [
    'subscription_id', 'title', 'description', 'vendor', 'amount',
    'billing_cycle', 'payment_card', 'payment_method', 'account_title',
    'active', 'start_date', 'end_date', 'notes', 'created_at', 'updated_at'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader_(sheet, headers.length);
}

function createSubscriptionPostingsSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.SUBSCRIPTION_POSTINGS);
  const headers = [
    'posting_id', 'subscription_id', 'month', 'generated_transaction_id',
    'generated_date', 'amount_snapshot', 'status', 'created_at'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader_(sheet, headers.length);
}

function createTransactionsSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.TRANSACTIONS);
  const headers = [
    'id', 'type', 'date', 'month', 'amount', 'vendor', 'description',
    'account_title', 'payment_method', 'receipt_url', 'receipt_fileId',
    'memo', 'tags', 'status', 'ai_raw', 'ai_confidence', 'created_at', 'updated_at'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader_(sheet, headers.length);

  // データバリデーション
  const typeValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(['expense', 'revenue']).setAllowInvalid(false).build();
  sheet.getRange(2, COLS.TRANSACTIONS.TYPE, 1000, 1).setDataValidation(typeValidation);

  const statusValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(['draft', 'confirmed', 'void']).setAllowInvalid(false).build();
  sheet.getRange(2, COLS.TRANSACTIONS.STATUS, 1000, 1).setDataValidation(statusValidation);

  const paymentValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(['cash', 'bank', 'card', 'other', '']).setAllowInvalid(false).build();
  sheet.getRange(2, COLS.TRANSACTIONS.PAYMENT_METHOD, 1000, 1).setDataValidation(paymentValidation);
}

function createAttachmentsSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.ATTACHMENTS);
  const headers = ['attachment_id', 'transaction_id', 'fileId', 'url', 'filename', 'mimeType', 'fileSize', 'created_at'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader_(sheet, headers.length);
}

function createAuditLogSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.AUDIT_LOG);
  const headers = ['audit_id', 'transaction_id', 'action', 'before_json', 'after_json', 'changed_fields', 'editor', 'timestamp'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader_(sheet, headers.length);
}

function createAccountantExportSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.ACCOUNTANT_EXPORT);
  const headers = ['transaction_id', '取引日', '勘定科目', '金額', '取引先', '摘要', '支払方法', '証憑URL', 'メモ', 'ステータス', 'synced_at'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader_(sheet, headers.length);
}

function createDashboardSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_NAMES.DASHBOARD);
  const headers = ['month', 'total_revenue', 'total_expense', 'profit', 'expense_breakdown_json', 'updated_at'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader_(sheet, headers.length);
}

// ===========================================
// ヘルパー関数
// ===========================================

function getOrCreateSheet_(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    logInfo(`Created sheet: ${sheetName}`);
  } else {
    sheet.clear();
    logInfo(`Cleared sheet: ${sheetName}`);
  }
  return sheet;
}

function styleHeader_(sheet, numCols) {
  const headerRange = sheet.getRange(1, 1, 1, numCols);
  headerRange.setFontWeight('bold').setBackground('#e3f2fd')
    .setBorder(true, true, true, true, false, false);
  sheet.setFrozenRows(1);
}

/**
 * 勘定科目マスタをリセット
 */
function resetAccountTitles() {
  const ss = getSpreadsheet();
  createAccountTitlesSheet_(ss);
  SpreadsheetApp.getUi().alert('勘定科目マスタをリセットしました');
}
