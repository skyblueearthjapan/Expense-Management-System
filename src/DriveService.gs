/**
 * SkyBlueEarthJapan 経費管理アプリ
 * DriveService.gs - Google Drive 証憑保存サービス
 */

// ===========================================
// 証憑アップロード
// ===========================================

/**
 * 証憑ファイルをアップロード
 * @param {Object} payload - アップロードデータ
 * @param {string} payload.transactionId - 取引ID
 * @param {string} payload.base64Data - Base64エンコードされたファイルデータ
 * @param {string} payload.filename - ファイル名
 * @param {string} payload.mimeType - MIMEタイプ
 * @returns {Object} アップロード結果
 */
function uploadReceipt(payload) {
  try {
    const { transactionId, base64Data, filename, mimeType } = payload;

    // バリデーション
    if (!transactionId || !base64Data || !filename) {
      return errorResponse(ERROR_MESSAGES.REQUIRED_FIELD_MISSING);
    }

    // 取引が存在するか確認
    const transaction = getTransactionById(transactionId);
    if (!transaction) {
      return errorResponse(ERROR_MESSAGES.TRANSACTION_NOT_FOUND);
    }

    // 保存先フォルダを取得/作成
    const folder = getOrCreateReceiptFolder(transaction.date);
    if (!folder) {
      return errorResponse('証憑フォルダの作成に失敗しました');
    }

    // ファイル名を生成
    const safeFilename = generateReceiptFilename(transaction, filename);

    // Base64をBlobに変換
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64Data),
      mimeType,
      safeFilename
    );

    // Driveに保存
    const file = folder.createFile(blob);
    const fileId = file.getId();
    const fileUrl = file.getUrl();

    // 11_ATTACHMENTSに記録
    saveAttachmentRecord({
      transactionId: transactionId,
      fileId: fileId,
      url: fileUrl,
      filename: safeFilename,
      mimeType: mimeType,
      fileSize: blob.getBytes().length
    });

    // 10_TRANSACTIONSを更新
    updateTransactionReceiptInfo(transactionId, fileId, fileUrl);

    logInfo('Receipt uploaded', { transactionId, fileId, filename: safeFilename });

    return successResponse({
      message: SUCCESS_MESSAGES.RECEIPT_UPLOADED,
      fileId: fileId,
      url: fileUrl,
      filename: safeFilename
    });

  } catch (error) {
    logError('uploadReceipt error', error);
    return errorResponse(ERROR_MESSAGES.UPLOAD_FAILED);
  }
}

/**
 * 証憑のURLを取得
 * @param {string} transactionId - 取引ID
 * @returns {Object} 証憑URL
 */
function getReceiptLink(transactionId) {
  try {
    if (!transactionId) {
      return errorResponse(ERROR_MESSAGES.REQUIRED_FIELD_MISSING);
    }

    const sheet = getSheet(SHEETS.ATTACHMENTS);
    if (!sheet) {
      return errorResponse('Attachments sheet not found');
    }

    const lastRow = getLastRow(sheet);
    if (lastRow < 2) {
      return successResponse({ url: null });
    }

    // 該当する取引IDの証憑を検索
    const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    for (const row of data) {
      if (row[1] === transactionId) {
        return successResponse({
          url: row[3],
          fileId: row[2]
        });
      }
    }

    return successResponse({ url: null });

  } catch (error) {
    logError('getReceiptLink error', error);
    return errorResponse(error.message);
  }
}

// ===========================================
// フォルダ管理
// ===========================================

/**
 * 証憑保存フォルダを取得または作成
 * @param {string} dateStr - 日付文字列（YYYY-MM-DD）
 * @returns {Folder} フォルダオブジェクト
 */
function getOrCreateReceiptFolder(dateStr) {
  try {
    const rootFolderId = getSettingValue('RECEIPT_FOLDER_ID');
    if (!rootFolderId) {
      logError('RECEIPT_FOLDER_ID not set');
      return null;
    }

    const rootFolder = DriveApp.getFolderById(rootFolderId);

    // 日付からYYYY/MMを抽出
    const date = parseDate(dateStr);
    if (!date) {
      return rootFolder; // フォールバック
    }

    const year = date.getFullYear().toString();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // 年フォルダを取得/作成
    let yearFolder = getFolderByName(rootFolder, year);
    if (!yearFolder) {
      yearFolder = rootFolder.createFolder(year);
    }

    // 月フォルダを取得/作成
    let monthFolder = getFolderByName(yearFolder, month);
    if (!monthFolder) {
      monthFolder = yearFolder.createFolder(month);
    }

    return monthFolder;

  } catch (error) {
    logError('getOrCreateReceiptFolder error', error);
    return null;
  }
}

/**
 * 名前でサブフォルダを検索
 * @param {Folder} parentFolder - 親フォルダ
 * @param {string} folderName - フォルダ名
 * @returns {Folder|null} フォルダまたはnull
 */
function getFolderByName(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return null;
}

// ===========================================
// ファイル名生成
// ===========================================

/**
 * 証憑ファイル名を生成
 * 命名規則: {date}_{amount}_{vendor}_{account_title}.{ext}
 * @param {Object} transaction - 取引データ
 * @param {string} originalFilename - 元のファイル名
 * @returns {string} 生成されたファイル名
 */
function generateReceiptFilename(transaction, originalFilename) {
  const ext = getFileExtension(originalFilename);
  const date = transaction.date || getToday();
  const amount = transaction.amount || 0;
  const vendor = sanitizeFilename(transaction.vendor || 'unknown');
  const accountTitle = sanitizeFilename(transaction.accountTitle || transaction.account_title || 'other');

  return `${date}_${amount}_${vendor}_${accountTitle}.${ext}`;
}

/**
 * ファイル拡張子を取得
 * @param {string} filename - ファイル名
 * @returns {string} 拡張子
 */
function getFileExtension(filename) {
  if (!filename) return 'dat';
  const parts = filename.split('.');
  if (parts.length < 2) return 'dat';
  return parts[parts.length - 1].toLowerCase();
}

/**
 * ファイル名に使用できない文字を除去
 * @param {string} str - 文字列
 * @returns {string} サニタイズ済み文字列
 */
function sanitizeFilename(str) {
  if (!str) return '';
  // ファイル名に使用できない文字を除去し、最大20文字に制限
  return String(str)
    .replace(/[\/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 20);
}

// ===========================================
// 証憑レコード保存
// ===========================================

/**
 * 11_ATTACHMENTSに証憑レコードを保存
 * @param {Object} attachmentData - 証憑データ
 */
function saveAttachmentRecord(attachmentData) {
  const sheet = getSheet(SHEETS.ATTACHMENTS);
  if (!sheet) {
    throw new Error('Attachments sheet not found');
  }

  const attachmentId = generateUUID();
  const now = formatDateTime(getNow());

  const row = [
    attachmentId,                        // attachment_id
    attachmentData.transactionId,        // transaction_id
    attachmentData.fileId,               // fileId
    attachmentData.url,                  // url
    attachmentData.filename,             // filename
    attachmentData.mimeType,             // mimeType
    attachmentData.fileSize || 0,        // fileSize
    now                                  // created_at
  ];

  sheet.appendRow(row);
}

/**
 * 取引の証憑情報を更新
 * @param {string} transactionId - 取引ID
 * @param {string} fileId - ファイルID
 * @param {string} url - URL
 */
function updateTransactionReceiptInfo(transactionId, fileId, url) {
  const sheet = getSheet(SHEETS.TRANSACTIONS);
  if (!sheet) return;

  const rowNum = findRowById(sheet, transactionId, COLS_TRANSACTIONS.ID, 2);
  if (rowNum < 0) return;

  // receipt_url と receipt_fileId を更新
  sheet.getRange(rowNum, COLS_TRANSACTIONS.RECEIPT_URL).setValue(url);
  sheet.getRange(rowNum, COLS_TRANSACTIONS.RECEIPT_FILE_ID).setValue(fileId);
  sheet.getRange(rowNum, COLS_TRANSACTIONS.UPDATED_AT).setValue(formatDateTime(getNow()));
}

// ===========================================
// ヘルパー関数
// ===========================================

/**
 * IDで取引を取得（内部用）
 * @param {string} transactionId - 取引ID
 * @returns {Object|null} 取引データ
 */
function getTransactionById(transactionId) {
  const sheet = getSheet(SHEETS.TRANSACTIONS);
  if (!sheet) return null;

  const rowNum = findRowById(sheet, transactionId, COLS_TRANSACTIONS.ID, 2);
  if (rowNum < 0) return null;

  const row = sheet.getRange(rowNum, 1, 1, getLastColumn(sheet)).getValues()[0];
  return rowToObject(row, COLS_TRANSACTIONS);
}
