/**
 * SkyBlueEarthJapan 経費管理アプリ
 * Config.gs - 定数・設定定義
 */

// ===========================================
// アプリケーション設定
// ===========================================
const APP_CONFIG = {
  APP_NAME: 'SkyBlueEarth経費管理',
  BUSINESS_NAME: 'スカイブルーアースジャパン',
  VERSION: '1.0.0',
  TIMEZONE: 'Asia/Tokyo'
};

// ===========================================
// スプレッドシート設定（01_SETTINGSから読み込む想定）
// ===========================================
const SPREADSHEET_CONFIG = {
  // メインDBスプレッドシートID（実際の運用時に設定）
  DB_SHEET_ID: '',
  // 会計士共有用スプレッドシートID（実際の運用時に設定）
  ACCOUNTANT_SHEET_ID: '',
  // 証憑保存用DriveフォルダID（実際の運用時に設定）
  RECEIPT_FOLDER_ID: ''
};

// ===========================================
// シート名定義（メインDB）
// ===========================================
const SHEETS = {
  README: '00_README',
  SETTINGS: '01_SETTINGS',
  ACCOUNT_TITLES: '02_MASTER_AccountTitles',
  VENDORS: '03_MASTER_Vendors',
  TRANSACTIONS: '10_TRANSACTIONS',
  ATTACHMENTS: '11_ATTACHMENTS',
  AUDIT_LOG: '12_AUDIT_LOG',
  ACCOUNTANT_EXPORT: '20_ACCOUNTANT_EXPORT',
  DASHBOARD: '30_DASHBOARD'
};

// ===========================================
// シート名定義（会計士共有用）
// ===========================================
const ACCOUNTANT_SHEETS = {
  README: '00_説明',
  LISTS: '99_LISTS',
  EXPENSES: '01_経費（会計士共有）',
  REVENUE: '02_売上（会計士共有）'
};

// ===========================================
// 01_SETTINGS カラム定義
// ===========================================
const COLS_SETTINGS = {
  KEY: 1,         // A: 設定キー
  VALUE: 2,       // B: 設定値
  DESCRIPTION: 3  // C: 説明
};

// ===========================================
// 02_MASTER_AccountTitles カラム定義
// ===========================================
const COLS_ACCOUNT_TITLES = {
  ID: 1,                  // A: account_title_id
  NAME: 2,                // B: name（表示名）
  TYPE: 3,                // C: type（expense/revenue）
  DESCRIPTION: 4,         // D: description
  KEYWORDS: 5,            // E: keywords（カンマ区切り）
  DEFAULT_CONFIDENCE: 6,  // F: default_confidence
  ACTIVE: 7,              // G: active
  SORT_ORDER: 8           // H: sort_order
};

// ===========================================
// 03_MASTER_Vendors カラム定義
// ===========================================
const COLS_VENDORS = {
  ID: 1,                    // A: vendor_id
  NAME: 2,                  // B: name
  DEFAULT_ACCOUNT_TITLE: 3, // C: default_account_title
  USAGE_COUNT: 4,           // D: usage_count
  LAST_USED: 5,             // E: last_used_at
  ACTIVE: 6                 // F: active
};

// ===========================================
// 10_TRANSACTIONS カラム定義
// ===========================================
const COLS_TRANSACTIONS = {
  ID: 1,              // A: id (UUID)
  TYPE: 2,            // B: type (expense/revenue)
  DATE: 3,            // C: date (YYYY-MM-DD)
  MONTH: 4,           // D: month (YYYY-MM)
  AMOUNT: 5,          // E: amount
  VENDOR: 6,          // F: vendor
  DESCRIPTION: 7,     // G: description
  ACCOUNT_TITLE: 8,   // H: account_title
  PAYMENT_METHOD: 9,  // I: payment_method
  RECEIPT_URL: 10,    // J: receipt_url
  RECEIPT_FILE_ID: 11,// K: receipt_fileId
  MEMO: 12,           // L: memo
  TAGS: 13,           // M: tags
  STATUS: 14,         // N: status
  AI_RAW: 15,         // O: ai_raw
  AI_CONFIDENCE: 16,  // P: ai_confidence
  CREATED_AT: 17,     // Q: created_at
  UPDATED_AT: 18      // R: updated_at
};

// ===========================================
// 11_ATTACHMENTS カラム定義
// ===========================================
const COLS_ATTACHMENTS = {
  ID: 1,              // A: attachment_id
  TRANSACTION_ID: 2,  // B: transaction_id
  FILE_ID: 3,         // C: fileId
  URL: 4,             // D: url
  FILENAME: 5,        // E: filename
  MIME_TYPE: 6,       // F: mimeType
  FILE_SIZE: 7,       // G: fileSize
  CREATED_AT: 8       // H: created_at
};

// ===========================================
// 12_AUDIT_LOG カラム定義
// ===========================================
const COLS_AUDIT_LOG = {
  ID: 1,              // A: audit_id
  TRANSACTION_ID: 2,  // B: transaction_id
  ACTION: 3,          // C: action (create/update/void)
  BEFORE_JSON: 4,     // D: before_json
  AFTER_JSON: 5,      // E: after_json
  CHANGED_FIELDS: 6,  // F: changed_fields
  EDITOR: 7,          // G: editor
  TIMESTAMP: 8        // H: timestamp
};

// ===========================================
// 20_ACCOUNTANT_EXPORT カラム定義
// ===========================================
const COLS_ACCOUNTANT_EXPORT = {
  TRANSACTION_ID: 1,  // A: transaction_id
  DATE: 2,            // B: 取引日
  ACCOUNT_TITLE: 3,   // C: 勘定科目
  AMOUNT: 4,          // D: 金額
  VENDOR: 5,          // E: 取引先
  DESCRIPTION: 6,     // F: 摘要
  PAYMENT_METHOD: 7,  // G: 支払方法
  RECEIPT_URL: 8,     // H: 証憑URL
  MEMO: 9,            // I: メモ
  STATUS: 10,         // J: ステータス
  SYNCED_AT: 11       // K: synced_at
};

// ===========================================
// 30_DASHBOARD カラム定義
// ===========================================
const COLS_DASHBOARD = {
  MONTH: 1,           // A: month
  TOTAL_REVENUE: 2,   // B: total_revenue
  TOTAL_EXPENSE: 3,   // C: total_expense
  PROFIT: 4,          // D: profit
  EXPENSE_BREAKDOWN: 5, // E: expense_breakdown_json
  UPDATED_AT: 6       // F: updated_at
};

// ===========================================
// 会計士共有用 経費/売上シート カラム定義
// ===========================================
const COLS_ACCOUNTANT = {
  DATE: 1,            // A: 取引日
  ACCOUNT_TITLE: 2,   // B: 勘定科目
  AMOUNT: 3,          // C: 金額（税込）
  VENDOR: 4,          // D: 取引先
  DESCRIPTION: 5,     // E: 摘要（内容）
  PAYMENT_METHOD: 6,  // F: 支払方法
  RECEIPT_URL: 7,     // G: 証憑URL
  MEMO: 8,            // H: メモ
  STATUS: 9           // I: ステータス
};

// 会計士共有シートのデータ開始行
const ACCOUNTANT_DATA_START_ROW = 8;

// ===========================================
// Enum定義
// ===========================================
const TRANSACTION_TYPE = {
  EXPENSE: 'expense',
  REVENUE: 'revenue'
};

const TRANSACTION_STATUS = {
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  VOID: 'void'
};

const PAYMENT_METHOD = {
  CASH: 'cash',
  BANK: 'bank',
  CARD: 'card',
  OTHER: 'other'
};

const AUDIT_ACTION = {
  CREATE: 'create',
  UPDATE: 'update',
  VOID: 'void'
};

// ===========================================
// 支払方法の表示名
// ===========================================
const PAYMENT_METHOD_LABELS = {
  cash: '現金',
  bank: '口座振込',
  card: 'カード',
  other: 'その他'
};

// ===========================================
// 初期勘定科目マスタデータ
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
// APIレスポンス用定数
// ===========================================
const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500
};

// ===========================================
// エラーメッセージ
// ===========================================
const ERROR_MESSAGES = {
  INVALID_REQUEST: 'リクエストが不正です',
  TRANSACTION_NOT_FOUND: '取引が見つかりません',
  REQUIRED_FIELD_MISSING: '必須項目が入力されていません',
  SAVE_FAILED: '保存に失敗しました。通信状況をご確認ください。',
  AI_PARSE_ERROR: 'AIの出力形式が不正です。もう一度お試しください。',
  UPLOAD_FAILED: 'アップロードに失敗しました。もう一度お試しください。'
};

// ===========================================
// 成功メッセージ
// ===========================================
const SUCCESS_MESSAGES = {
  TRANSACTION_SAVED: '登録しました',
  TRANSACTION_UPDATED: '変更を保存しました',
  TRANSACTION_VOIDED: '取引を無効にしました',
  RECEIPT_UPLOADED: 'アップロードしました'
};
