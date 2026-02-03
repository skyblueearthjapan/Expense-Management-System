/**
 * SkyBlueEarthJapan 経費管理アプリ
 * Utils.gs - 共通ユーティリティ
 *
 * Phase 0: リポジトリ初期化・設定
 */

// ===========================================
// UUID生成
// ===========================================

/**
 * UUID v4を生成
 * @returns {string} UUID文字列
 */
function generateUUID() {
  return Utilities.getUuid();
}

/**
 * 短縮ID生成（8文字）
 * @returns {string} 短縮ID
 */
function generateShortId() {
  return Utilities.getUuid().substring(0, 8);
}

// ===========================================
// 日付処理
// ===========================================

/**
 * 現在日時を取得（JST）
 * @returns {Date}
 */
function getNow() {
  return new Date();
}

/**
 * 日付をYYYY-MM-DD形式でフォーマット
 * @param {Date|string} date - 日付
 * @returns {string} YYYY-MM-DD
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 日付をYYYY-MM形式でフォーマット
 * @param {Date|string} date - 日付
 * @returns {string} YYYY-MM
 */
function formatMonth(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * 日付をISO形式でフォーマット
 * @param {Date|string} date - 日付
 * @returns {string} ISO形式
 */
function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString();
}

/**
 * YYYY-MM-DD文字列からDateを作成
 * @param {string} dateString - YYYY-MM-DD形式
 * @returns {Date|null}
 */
function parseDate(dateString) {
  if (!dateString) return null;
  const parts = String(dateString).split('-');
  if (parts.length !== 3) return null;
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 今日の日付を取得（YYYY-MM-DD）
 * @returns {string}
 */
function getToday() {
  return formatDate(getNow());
}

/**
 * 現在の月を取得（YYYY-MM）
 * @returns {string}
 */
function getCurrentMonth() {
  return formatMonth(getNow());
}

/**
 * 指定月の初日を取得（YYYY-MM-DD）
 * @param {string} month - YYYY-MM形式
 * @returns {string}
 */
function getFirstDayOfMonth(month) {
  if (!month) return '';
  return `${month}-01`;
}

/**
 * 曜日を取得
 * @param {Date|string} date - 日付
 * @returns {string} 曜日（日本語1文字）
 */
function getDayOfWeek(date) {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const d = new Date(date);
  return days[d.getDay()];
}

/**
 * 表示用日付フォーマット（M/D（曜））
 * @param {Date|string} date - 日付
 * @returns {string}
 */
function formatDateDisplay(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()}（${getDayOfWeek(d)}）`;
}

// ===========================================
// 金額処理
// ===========================================

/**
 * 金額をカンマ区切りでフォーマット
 * @param {number} amount - 金額
 * @returns {string}
 */
function formatAmount(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '';
  return Math.floor(amount).toLocaleString('ja-JP');
}

/**
 * 金額を¥付きでフォーマット
 * @param {number} amount - 金額
 * @returns {string}
 */
function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '';
  return '¥' + formatAmount(amount);
}

/**
 * 文字列から金額を抽出
 * @param {string} str - 金額文字列
 * @returns {number|null}
 */
function parseAmount(str) {
  if (str === null || str === undefined) return null;
  const cleaned = String(str).replace(/[,，¥￥円\s]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

// ===========================================
// バリデーション
// ===========================================

/**
 * 必須フィールド検証
 * @param {Object} data - 検証対象
 * @param {string[]} requiredFields - 必須フィールド名配列
 * @returns {{ valid: boolean, missing: string[] }}
 */
function validateRequired(data, requiredFields) {
  const missing = [];
  for (const field of requiredFields) {
    const value = data[field];
    if (value === undefined || value === null || value === '') {
      missing.push(field);
    }
  }
  return { valid: missing.length === 0, missing };
}

/**
 * 取引タイプ検証
 * @param {string} type - タイプ
 * @returns {boolean}
 */
function isValidTransactionType(type) {
  return type === TRANSACTION_TYPE.EXPENSE || type === TRANSACTION_TYPE.REVENUE;
}

/**
 * ステータス検証
 * @param {string} status - ステータス
 * @returns {boolean}
 */
function isValidTransactionStatus(status) {
  return Object.values(TRANSACTION_STATUS).includes(status);
}

/**
 * 支払方法検証
 * @param {string} method - 支払方法
 * @returns {boolean}
 */
function isValidPaymentMethod(method) {
  if (!method) return true; // 空は許可
  return Object.values(PAYMENT_METHOD).includes(method);
}

/**
 * 日付形式検証（YYYY-MM-DD）
 * @param {string} dateStr - 日付文字列
 * @returns {boolean}
 */
function isValidDateFormat(dateStr) {
  if (!dateStr) return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const d = parseDate(dateStr);
  return d !== null;
}

/**
 * 月形式検証（YYYY-MM）
 * @param {string} monthStr - 月文字列
 * @returns {boolean}
 */
function isValidMonthFormat(monthStr) {
  if (!monthStr) return false;
  return /^\d{4}-\d{2}$/.test(monthStr);
}

// ===========================================
// スプレッドシート操作ヘルパー
// ===========================================

/**
 * アクティブスプレッドシート取得
 * @returns {Spreadsheet}
 */
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * シートを名前で取得
 * @param {string} sheetName - シート名
 * @returns {Sheet|null}
 */
function getSheet(sheetName) {
  return getSpreadsheet().getSheetByName(sheetName);
}

/**
 * シートを取得（存在しなければエラー）
 * @param {string} sheetName - シート名
 * @returns {Sheet}
 * @throws {AppError}
 */
function getSheetOrThrow(sheetName) {
  const sheet = getSheet(sheetName);
  if (!sheet) {
    throw sheetNotFoundError(sheetName);
  }
  return sheet;
}

/**
 * シートの最終行を取得
 * @param {Sheet} sheet - シート
 * @returns {number}
 */
function getLastRow(sheet) {
  return sheet.getLastRow();
}

/**
 * シートの最終列を取得
 * @param {Sheet} sheet - シート
 * @returns {number}
 */
function getLastColumn(sheet) {
  return sheet.getLastColumn();
}

/**
 * ID列から行番号を検索
 * @param {Sheet} sheet - シート
 * @param {string} id - 検索ID
 * @param {number} idColumn - ID列番号（1始まり）
 * @param {number} startRow - 開始行（1始まり）
 * @returns {number} 行番号（見つからなければ-1）
 */
function findRowById(sheet, id, idColumn, startRow = 2) {
  const lastRow = getLastRow(sheet);
  if (lastRow < startRow) return -1;

  const range = sheet.getRange(startRow, idColumn, lastRow - startRow + 1, 1);
  const values = range.getValues();

  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === id) {
      return startRow + i;
    }
  }
  return -1;
}

// ===========================================
// 文字列処理
// ===========================================

/**
 * 安全にトリム
 * @param {*} value - 値
 * @returns {string}
 */
function safeTrim(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * JSONを安全にパース
 * @param {string} jsonString - JSON文字列
 * @param {*} defaultValue - デフォルト値
 * @returns {*}
 */
function safeJsonParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    return defaultValue;
  }
}

/**
 * JSONを安全に文字列化
 * @param {*} data - データ
 * @returns {string}
 */
function safeJsonStringify(data) {
  try {
    return JSON.stringify(data);
  } catch (e) {
    return '';
  }
}

// ===========================================
// オブジェクト変換
// ===========================================

/**
 * 行データをオブジェクトに変換
 * @param {Array} row - 行データ配列
 * @param {Object} colDef - カラム定義（{KEY: 列番号}）
 * @param {Object} keyMap - キー変換マップ（省略可）
 * @returns {Object}
 */
function rowToObject(row, colDef, keyMap = null) {
  const obj = {};
  for (const [key, colIndex] of Object.entries(colDef)) {
    const value = row[colIndex - 1];
    // キーをキャメルケースに変換
    const camelKey = keyMap && keyMap[key]
      ? keyMap[key]
      : key.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    obj[camelKey] = value;
  }
  return obj;
}

/**
 * オブジェクトを行データに変換
 * @param {Object} obj - オブジェクト
 * @param {Object} colDef - カラム定義
 * @param {number} totalCols - 総列数
 * @returns {Array}
 */
function objectToRow(obj, colDef, totalCols) {
  const row = new Array(totalCols).fill('');
  for (const [key, colIndex] of Object.entries(colDef)) {
    // スネークケース→キャメルケース変換
    const camelKey = key.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (obj[camelKey] !== undefined) {
      row[colIndex - 1] = obj[camelKey];
    } else if (obj[key] !== undefined) {
      row[colIndex - 1] = obj[key];
    }
  }
  return row;
}
