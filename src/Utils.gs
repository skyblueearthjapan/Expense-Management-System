/**
 * SkyBlueEarthJapan 経費管理アプリ
 * Utils.gs - 共通ユーティリティ関数
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
 * 短いIDを生成（8文字）
 * @returns {string} 短いID
 */
function generateShortId() {
  return Utilities.getUuid().substring(0, 8);
}

// ===========================================
// 日付処理
// ===========================================

/**
 * 現在の日時を取得（JST）
 * @returns {Date} 現在日時
 */
function getNow() {
  return new Date();
}

/**
 * 日付をYYYY-MM-DD形式にフォーマット
 * @param {Date} date - 日付オブジェクト
 * @returns {string} YYYY-MM-DD形式の文字列
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 日付をYYYY-MM形式にフォーマット（月のみ）
 * @param {Date} date - 日付オブジェクト
 * @returns {string} YYYY-MM形式の文字列
 */
function formatMonth(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * 日付をISO形式にフォーマット
 * @param {Date} date - 日付オブジェクト
 * @returns {string} ISO形式の文字列
 */
function formatDateTime(date) {
  if (!date) return '';
  return new Date(date).toISOString();
}

/**
 * YYYY-MM-DD文字列からDateオブジェクトを作成
 * @param {string} dateString - YYYY-MM-DD形式の文字列
 * @returns {Date} 日付オブジェクト
 */
function parseDate(dateString) {
  if (!dateString) return null;
  const parts = dateString.split('-');
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

/**
 * 今日の日付を取得（YYYY-MM-DD）
 * @returns {string} YYYY-MM-DD形式の今日の日付
 */
function getToday() {
  return formatDate(getNow());
}

/**
 * 昨日の日付を取得（YYYY-MM-DD）
 * @returns {string} YYYY-MM-DD形式の昨日の日付
 */
function getYesterday() {
  const d = getNow();
  d.setDate(d.getDate() - 1);
  return formatDate(d);
}

/**
 * 現在の年月を取得（YYYY-MM）
 * @returns {string} YYYY-MM形式の現在月
 */
function getCurrentMonth() {
  return formatMonth(getNow());
}

/**
 * 曜日を取得
 * @param {Date} date - 日付オブジェクト
 * @returns {string} 曜日（日本語）
 */
function getDayOfWeek(date) {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[new Date(date).getDay()];
}

/**
 * 日付を表示用にフォーマット（M/D（曜））
 * @param {Date|string} date - 日付
 * @returns {string} フォーマット済み文字列
 */
function formatDateDisplay(date) {
  if (!date) return '';
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dow = getDayOfWeek(d);
  return `${month}/${day}（${dow}）`;
}

// ===========================================
// 金額処理
// ===========================================

/**
 * 金額をカンマ区切りでフォーマット
 * @param {number} amount - 金額
 * @returns {string} カンマ区切りの金額文字列
 */
function formatAmount(amount) {
  if (amount === null || amount === undefined) return '';
  return Math.floor(amount).toLocaleString('ja-JP');
}

/**
 * 金額を¥付きでフォーマット
 * @param {number} amount - 金額
 * @returns {string} ¥付きの金額文字列
 */
function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '';
  return '¥' + formatAmount(amount);
}

/**
 * 文字列から数値を抽出
 * @param {string} str - 金額を含む文字列
 * @returns {number|null} 抽出された金額
 */
function parseAmount(str) {
  if (!str) return null;
  // カンマと円記号を除去
  const cleaned = String(str).replace(/[,，¥￥円]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

// ===========================================
// JSONレスポンス
// ===========================================

/**
 * 成功レスポンスを作成
 * @param {Object} data - レスポンスデータ
 * @returns {Object} 成功レスポンス
 */
function successResponse(data = {}) {
  return {
    success: true,
    ...data
  };
}

/**
 * エラーレスポンスを作成
 * @param {string} message - エラーメッセージ
 * @param {number} code - HTTPステータスコード（省略可）
 * @returns {Object} エラーレスポンス
 */
function errorResponse(message, code = HTTP_STATUS.BAD_REQUEST) {
  return {
    success: false,
    error: {
      message: message,
      code: code
    }
  };
}

/**
 * JSONをHTTPレスポンスとして出力
 * @param {Object} data - 出力するデータ
 * @returns {ContentService.TextOutput} JSONレスポンス
 */
function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===========================================
// バリデーション
// ===========================================

/**
 * 必須フィールドの検証
 * @param {Object} data - 検証するオブジェクト
 * @param {Array<string>} requiredFields - 必須フィールド名の配列
 * @returns {Object} { valid: boolean, missing: string[] }
 */
function validateRequired(data, requiredFields) {
  const missing = [];
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missing.push(field);
    }
  }
  return {
    valid: missing.length === 0,
    missing: missing
  };
}

/**
 * 取引タイプの検証
 * @param {string} type - 取引タイプ
 * @returns {boolean} 有効かどうか
 */
function isValidTransactionType(type) {
  return type === TRANSACTION_TYPE.EXPENSE || type === TRANSACTION_TYPE.REVENUE;
}

/**
 * ステータスの検証
 * @param {string} status - ステータス
 * @returns {boolean} 有効かどうか
 */
function isValidStatus(status) {
  return Object.values(TRANSACTION_STATUS).includes(status);
}

/**
 * 支払方法の検証
 * @param {string} method - 支払方法
 * @returns {boolean} 有効かどうか
 */
function isValidPaymentMethod(method) {
  if (!method) return true; // 空は許可
  return Object.values(PAYMENT_METHOD).includes(method);
}

/**
 * 日付形式の検証（YYYY-MM-DD）
 * @param {string} dateStr - 日付文字列
 * @returns {boolean} 有効かどうか
 */
function isValidDateFormat(dateStr) {
  if (!dateStr) return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = parseDate(dateStr);
  return date !== null && !isNaN(date.getTime());
}

// ===========================================
// スプレッドシート操作ヘルパー
// ===========================================

/**
 * アクティブなスプレッドシートを取得
 * @returns {Spreadsheet} スプレッドシート
 */
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * シートを名前で取得
 * @param {string} sheetName - シート名
 * @returns {Sheet} シート
 */
function getSheet(sheetName) {
  const ss = getSpreadsheet();
  return ss.getSheetByName(sheetName);
}

/**
 * シートの最終行を取得
 * @param {Sheet} sheet - シート
 * @returns {number} 最終行番号
 */
function getLastRow(sheet) {
  return sheet.getLastRow();
}

/**
 * シートの最終列を取得
 * @param {Sheet} sheet - シート
 * @returns {number} 最終列番号
 */
function getLastColumn(sheet) {
  return sheet.getLastColumn();
}

/**
 * 指定列からIDで行を検索
 * @param {Sheet} sheet - シート
 * @param {string} id - 検索するID
 * @param {number} idColumn - ID列番号（1始まり）
 * @param {number} startRow - 検索開始行（1始まり）
 * @returns {number} 行番号（見つからない場合は-1）
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

/**
 * 行データをオブジェクトに変換
 * @param {Array} row - 行データの配列
 * @param {Object} colDef - カラム定義オブジェクト
 * @returns {Object} オブジェクト
 */
function rowToObject(row, colDef) {
  const obj = {};
  for (const [key, colIndex] of Object.entries(colDef)) {
    const value = row[colIndex - 1];
    // キーをキャメルケースに変換
    const camelKey = key.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    obj[camelKey] = value;
  }
  return obj;
}

// ===========================================
// 文字列処理
// ===========================================

/**
 * 文字列を安全にトリム
 * @param {*} value - トリムする値
 * @returns {string} トリム済み文字列
 */
function safeTrim(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * JSONを安全にパース
 * @param {string} jsonString - JSON文字列
 * @param {*} defaultValue - パース失敗時のデフォルト値
 * @returns {*} パース結果
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
 * @param {*} data - 文字列化するデータ
 * @returns {string} JSON文字列
 */
function safeJsonStringify(data) {
  try {
    return JSON.stringify(data);
  } catch (e) {
    return '';
  }
}

// ===========================================
// ログ出力
// ===========================================

/**
 * 情報ログを出力
 * @param {string} message - メッセージ
 * @param {*} data - 追加データ（省略可）
 */
function logInfo(message, data = null) {
  if (data) {
    console.log(`[INFO] ${message}`, data);
  } else {
    console.log(`[INFO] ${message}`);
  }
}

/**
 * エラーログを出力
 * @param {string} message - メッセージ
 * @param {Error|*} error - エラーオブジェクト
 */
function logError(message, error = null) {
  if (error) {
    console.error(`[ERROR] ${message}`, error);
  } else {
    console.error(`[ERROR] ${message}`);
  }
}

/**
 * デバッグログを出力（開発時のみ）
 * @param {string} message - メッセージ
 * @param {*} data - 追加データ
 */
function logDebug(message, data = null) {
  // 本番では無効化するか、設定で制御
  if (data) {
    console.log(`[DEBUG] ${message}`, data);
  } else {
    console.log(`[DEBUG] ${message}`);
  }
}
