/**
 * SkyBlueEarthJapan 経費管理アプリ
 * Logger.gs - ロガー＆エラーハンドリング
 *
 * Phase 0: リポジトリ初期化・設定
 */

// ===========================================
// カスタムエラークラス
// ===========================================

/**
 * アプリケーションエラー
 * @param {string} message - エラーメッセージ
 * @param {string} code - エラーコード
 * @param {number} httpStatus - HTTPステータスコード
 */
class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', httpStatus = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// ===========================================
// エラーコード定義
// ===========================================
const ERROR_CODE = {
  // バリデーション
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_VALUE: 'INVALID_VALUE',

  // 認証・認可
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // リソース
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // 外部サービス
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  AI_ERROR: 'AI_ERROR',
  DRIVE_ERROR: 'DRIVE_ERROR',

  // システム
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SHEET_NOT_FOUND: 'SHEET_NOT_FOUND',
  CONFIG_ERROR: 'CONFIG_ERROR'
};

// ===========================================
// HTTPステータスコード
// ===========================================
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500
};

// ===========================================
// ログレベル
// ===========================================
const LOG_LEVEL = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// 現在のログレベル（Settingsで変更可能）
let _currentLogLevel = LOG_LEVEL.INFO;

/**
 * ログレベルを設定
 * @param {number} level - ログレベル
 */
function setLogLevel(level) {
  _currentLogLevel = level;
}

// ===========================================
// ロギング関数
// ===========================================

/**
 * デバッグログ
 * @param {string} message - メッセージ
 * @param {*} data - 追加データ
 */
function logDebug(message, data = null) {
  if (_currentLogLevel <= LOG_LEVEL.DEBUG) {
    const log = `[DEBUG] ${message}`;
    if (data !== null) {
      console.log(log, JSON.stringify(data));
    } else {
      console.log(log);
    }
  }
}

/**
 * 情報ログ
 * @param {string} message - メッセージ
 * @param {*} data - 追加データ
 */
function logInfo(message, data = null) {
  if (_currentLogLevel <= LOG_LEVEL.INFO) {
    const log = `[INFO] ${message}`;
    if (data !== null) {
      console.log(log, JSON.stringify(data));
    } else {
      console.log(log);
    }
  }
}

/**
 * 警告ログ
 * @param {string} message - メッセージ
 * @param {*} data - 追加データ
 */
function logWarn(message, data = null) {
  if (_currentLogLevel <= LOG_LEVEL.WARN) {
    const log = `[WARN] ${message}`;
    if (data !== null) {
      console.warn(log, JSON.stringify(data));
    } else {
      console.warn(log);
    }
  }
}

/**
 * エラーログ
 * @param {string} message - メッセージ
 * @param {Error|*} error - エラーオブジェクト
 */
function logError(message, error = null) {
  if (_currentLogLevel <= LOG_LEVEL.ERROR) {
    const log = `[ERROR] ${message}`;
    if (error) {
      if (error instanceof Error) {
        console.error(log, {
          name: error.name,
          message: error.message,
          code: error.code,
          stack: error.stack
        });
      } else {
        console.error(log, JSON.stringify(error));
      }
    } else {
      console.error(log);
    }
  }
}

// ===========================================
// レスポンスヘルパー
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
 * @param {string} code - エラーコード
 * @param {number} httpStatus - HTTPステータスコード
 * @returns {Object} エラーレスポンス
 */
function errorResponse(message, code = ERROR_CODE.INTERNAL_ERROR, httpStatus = HTTP_STATUS.BAD_REQUEST) {
  return {
    success: false,
    error: {
      message: message,
      code: code,
      httpStatus: httpStatus
    }
  };
}

/**
 * AppErrorからエラーレスポンスを作成
 * @param {AppError} appError - AppErrorインスタンス
 * @returns {Object} エラーレスポンス
 */
function errorResponseFromAppError(appError) {
  return errorResponse(appError.message, appError.code, appError.httpStatus);
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
// エラーファクトリ
// ===========================================

/**
 * バリデーションエラーを作成
 * @param {string} message - エラーメッセージ
 * @returns {AppError}
 */
function validationError(message) {
  return new AppError(message, ERROR_CODE.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
}

/**
 * 必須フィールド不足エラーを作成
 * @param {string} fieldName - フィールド名
 * @returns {AppError}
 */
function requiredFieldError(fieldName) {
  return new AppError(
    `必須項目「${fieldName}」が入力されていません`,
    ERROR_CODE.REQUIRED_FIELD_MISSING,
    HTTP_STATUS.BAD_REQUEST
  );
}

/**
 * Not Foundエラーを作成
 * @param {string} resourceName - リソース名
 * @returns {AppError}
 */
function notFoundError(resourceName) {
  return new AppError(
    `${resourceName}が見つかりません`,
    ERROR_CODE.NOT_FOUND,
    HTTP_STATUS.NOT_FOUND
  );
}

/**
 * シート未発見エラーを作成
 * @param {string} sheetName - シート名
 * @returns {AppError}
 */
function sheetNotFoundError(sheetName) {
  return new AppError(
    `シート「${sheetName}」が見つかりません`,
    ERROR_CODE.SHEET_NOT_FOUND,
    HTTP_STATUS.INTERNAL_ERROR
  );
}

/**
 * 外部サービスエラーを作成
 * @param {string} serviceName - サービス名
 * @param {string} detail - 詳細
 * @returns {AppError}
 */
function externalServiceError(serviceName, detail = '') {
  const message = detail
    ? `${serviceName}でエラーが発生しました: ${detail}`
    : `${serviceName}でエラーが発生しました`;
  return new AppError(message, ERROR_CODE.EXTERNAL_SERVICE_ERROR, HTTP_STATUS.INTERNAL_ERROR);
}

// ===========================================
// 共通エラーハンドリングラッパー
// ===========================================

/**
 * 関数をエラーハンドリングでラップ
 * @param {Function} fn - 実行する関数
 * @param {string} operationName - 操作名（ログ用）
 * @returns {Object} 実行結果
 */
function withErrorHandling(fn, operationName = 'operation') {
  try {
    return fn();
  } catch (error) {
    if (error instanceof AppError) {
      logError(`${operationName} failed`, error);
      return errorResponseFromAppError(error);
    } else {
      logError(`${operationName} failed with unexpected error`, error);
      return errorResponse(
        '予期せぬエラーが発生しました',
        ERROR_CODE.INTERNAL_ERROR,
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  }
}
