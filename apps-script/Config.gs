/**
 * SkyBlueEarthJapan 経費管理アプリ
 * Config.gs - 設定管理（Settingsシートから読み込み）
 *
 * Phase 0: リポジトリ初期化・設定
 */

// ===========================================
// アプリケーション定数
// ===========================================
const APP = {
  NAME: 'SkyBlueEarth経費管理',
  VERSION: '2.0.0',
  TIMEZONE: 'Asia/Tokyo'
};

// ===========================================
// シート名定数（文字列直書き禁止）
// ===========================================
const SHEET_NAMES = {
  // メタ・設定
  README: '00_README',
  SETTINGS: '01_SETTINGS',

  // マスタ
  ACCOUNT_TITLES: '02_MASTER_AccountTitles',
  VENDORS: '03_MASTER_Vendors',
  SUBSCRIPTIONS: '04_MASTER_Subscriptions',

  // トランザクション
  SUBSCRIPTION_POSTINGS: '05_SUBSCRIPTION_POSTINGS',
  TRANSACTIONS: '10_TRANSACTIONS',
  ATTACHMENTS: '11_ATTACHMENTS',
  AUDIT_LOG: '12_AUDIT_LOG',

  // エクスポート
  ACCOUNTANT_EXPORT: '20_ACCOUNTANT_EXPORT',

  // 分析
  DASHBOARD: '30_DASHBOARD'
};

// ===========================================
// 会計士共有用シート名
// ===========================================
const ACCOUNTANT_SHEET_NAMES = {
  README: '00_説明',
  LISTS: '99_LISTS',
  EXPENSES: '01_経費（会計士共有）',
  REVENUE: '02_売上（会計士共有）'
};

// ===========================================
// カラム定義（1始まりのインデックス）
// ===========================================
const COLS = {
  // 01_SETTINGS
  SETTINGS: {
    KEY: 1,
    VALUE: 2,
    DESCRIPTION: 3
  },

  // 02_MASTER_AccountTitles
  ACCOUNT_TITLES: {
    ID: 1,
    NAME: 2,
    TYPE: 3,
    DESCRIPTION: 4,
    KEYWORDS: 5,
    DEFAULT_CONFIDENCE: 6,
    ACTIVE: 7,
    SORT_ORDER: 8
  },

  // 03_MASTER_Vendors
  VENDORS: {
    ID: 1,
    NAME: 2,
    DEFAULT_ACCOUNT_TITLE: 3,
    USAGE_COUNT: 4,
    LAST_USED_AT: 5,
    ACTIVE: 6
  },

  // 04_MASTER_Subscriptions
  SUBSCRIPTIONS: {
    ID: 1,
    TITLE: 2,
    DESCRIPTION: 3,
    VENDOR: 4,
    AMOUNT: 5,
    BILLING_CYCLE: 6,
    PAYMENT_CARD: 7,
    PAYMENT_METHOD: 8,
    ACCOUNT_TITLE: 9,
    ACTIVE: 10,
    START_DATE: 11,
    END_DATE: 12,
    NOTES: 13,
    CREATED_AT: 14,
    UPDATED_AT: 15
  },

  // 05_SUBSCRIPTION_POSTINGS
  SUBSCRIPTION_POSTINGS: {
    ID: 1,
    SUBSCRIPTION_ID: 2,
    MONTH: 3,
    GENERATED_TRANSACTION_ID: 4,
    GENERATED_DATE: 5,
    AMOUNT_SNAPSHOT: 6,
    STATUS: 7,
    CREATED_AT: 8
  },

  // 10_TRANSACTIONS
  TRANSACTIONS: {
    ID: 1,
    TYPE: 2,
    DATE: 3,
    MONTH: 4,
    AMOUNT: 5,
    VENDOR: 6,
    DESCRIPTION: 7,
    ACCOUNT_TITLE: 8,
    PAYMENT_METHOD: 9,
    RECEIPT_URL: 10,
    RECEIPT_FILE_ID: 11,
    MEMO: 12,
    TAGS: 13,
    STATUS: 14,
    AI_RAW: 15,
    AI_CONFIDENCE: 16,
    CREATED_AT: 17,
    UPDATED_AT: 18
  },

  // 11_ATTACHMENTS
  ATTACHMENTS: {
    ID: 1,
    TRANSACTION_ID: 2,
    FILE_ID: 3,
    URL: 4,
    FILENAME: 5,
    MIME_TYPE: 6,
    FILE_SIZE: 7,
    CREATED_AT: 8
  },

  // 12_AUDIT_LOG
  AUDIT_LOG: {
    ID: 1,
    TRANSACTION_ID: 2,
    ACTION: 3,
    BEFORE_JSON: 4,
    AFTER_JSON: 5,
    CHANGED_FIELDS: 6,
    EDITOR: 7,
    TIMESTAMP: 8
  },

  // 20_ACCOUNTANT_EXPORT
  ACCOUNTANT_EXPORT: {
    TRANSACTION_ID: 1,
    DATE: 2,
    ACCOUNT_TITLE: 3,
    AMOUNT: 4,
    VENDOR: 5,
    DESCRIPTION: 6,
    PAYMENT_METHOD: 7,
    RECEIPT_URL: 8,
    MEMO: 9,
    STATUS: 10,
    SYNCED_AT: 11
  },

  // 会計士共有シート（経費/売上共通）
  ACCOUNTANT: {
    DATE: 1,
    ACCOUNT_TITLE: 2,
    AMOUNT: 3,
    VENDOR: 4,
    DESCRIPTION: 5,
    PAYMENT_METHOD: 6,
    RECEIPT_URL: 7,
    MEMO: 8,
    STATUS: 9
  }
};

// 会計士共有シートのデータ開始行
const ACCOUNTANT_DATA_START_ROW = 8;

// ===========================================
// Enum定数
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

const BILLING_CYCLE = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly'
};

const POSTING_STATUS = {
  GENERATED: 'generated',
  SKIPPED: 'skipped',
  VOID: 'void'
};

// ===========================================
// 表示ラベル
// ===========================================
const LABELS = {
  PAYMENT_METHOD: {
    cash: '現金',
    bank: '口座振込',
    card: 'カード',
    other: 'その他'
  },
  TRANSACTION_TYPE: {
    expense: '経費',
    revenue: '売上'
  },
  TRANSACTION_STATUS: {
    draft: '下書き',
    confirmed: '確定',
    void: '無効'
  }
};

// ===========================================
// 設定キャッシュ
// ===========================================
let _settingsCache = null;
let _settingsCacheTime = null;
const SETTINGS_CACHE_TTL = 60000; // 1分

/**
 * 設定を全て取得（キャッシュ付き）
 * @returns {Object} 設定オブジェクト
 */
function getSettings() {
  const now = Date.now();

  // キャッシュが有効ならそれを返す
  if (_settingsCache && _settingsCacheTime && (now - _settingsCacheTime < SETTINGS_CACHE_TTL)) {
    return _settingsCache;
  }

  const sheet = getSheetByName_(SHEET_NAMES.SETTINGS);
  if (!sheet) {
    Logger.log('[WARN] Settings sheet not found');
    return {};
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return {};
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  const settings = {};

  for (const row of data) {
    const key = row[COLS.SETTINGS.KEY - 1];
    const value = row[COLS.SETTINGS.VALUE - 1];
    if (key) {
      settings[key] = value;
    }
  }

  _settingsCache = settings;
  _settingsCacheTime = now;

  return settings;
}

/**
 * 特定の設定値を取得
 * @param {string} key - 設定キー
 * @param {*} defaultValue - デフォルト値
 * @returns {*} 設定値
 */
function getSetting(key, defaultValue = null) {
  const settings = getSettings();
  return settings[key] !== undefined ? settings[key] : defaultValue;
}

/**
 * 設定キャッシュをクリア
 */
function clearSettingsCache() {
  _settingsCache = null;
  _settingsCacheTime = null;
}

/**
 * DBスプレッドシートIDを取得
 */
function getDbSheetId() {
  return getSetting('DB_SHEET_ID', '');
}

/**
 * 会計士共有スプレッドシートIDを取得
 */
function getAccountantSheetId() {
  return getSetting('ACCOUNTANT_SHEET_ID', '');
}

/**
 * 証憑保存フォルダIDを取得
 */
function getReceiptFolderId() {
  return getSetting('RECEIPT_FOLDER_ID', '');
}

/**
 * OpenAI APIキーを取得
 */
function getOpenAIApiKey() {
  return getSetting('OPENAI_API_KEY', '');
}

// ===========================================
// 内部ヘルパー
// ===========================================

/**
 * シートを名前で取得（内部用）
 */
function getSheetByName_(sheetName) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
}
