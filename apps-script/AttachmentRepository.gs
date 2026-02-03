/**
 * SkyBlueEarthJapan 経費管理アプリ
 * AttachmentRepository.gs - 証憑管理
 *
 * Phase 1: DBアクセス層
 */

// ===========================================
// 証憑の追加
// ===========================================

/**
 * 証憑を追加
 * @param {Object} params - パラメータ
 * @param {string} params.transactionId - 取引ID
 * @param {string} params.fileId - DriveファイルID
 * @param {string} params.url - ファイルURL
 * @param {string} params.filename - ファイル名
 * @param {string} params.mimeType - MIMEタイプ
 * @param {number} params.fileSize - ファイルサイズ（バイト）
 * @returns {Object} 結果
 */
function addAttachment(params) {
  return withErrorHandling(() => {
    const { valid, missing } = validateRequired(params, ['transactionId', 'fileId', 'url']);
    if (!valid) {
      throw requiredFieldError(missing[0]);
    }

    const sheet = getSheetOrThrow(SHEET_NAMES.ATTACHMENTS);
    const id = generateUUID();
    const now = formatDateTime(getNow());

    const row = [
      id,                    // attachment_id
      params.transactionId,  // transaction_id
      params.fileId,         // fileId
      params.url,            // url
      params.filename || '', // filename
      params.mimeType || '', // mimeType
      params.fileSize || 0,  // fileSize
      now                    // created_at
    ];

    sheet.appendRow(row);

    // 取引のreceipt_urlを更新
    updateTransactionReceiptUrl_(params.transactionId, params.url, params.fileId);

    logInfo('Attachment added', { attachmentId: id, transactionId: params.transactionId });

    return successResponse({
      attachmentId: id,
      url: params.url,
      message: 'アップロードしました'
    });
  }, 'addAttachment');
}

// ===========================================
// 証憑の取得
// ===========================================

/**
 * 取引IDで証憑を取得
 * @param {string} transactionId - 取引ID
 * @returns {Object} 結果
 */
function getAttachmentsByTransaction(transactionId) {
  return withErrorHandling(() => {
    const sheet = getSheetOrThrow(SHEET_NAMES.ATTACHMENTS);
    const lastRow = getLastRow(sheet);

    if (lastRow < 2) {
      return successResponse({ attachments: [] });
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    const attachments = [];

    for (const row of data) {
      if (row[COLS.ATTACHMENTS.TRANSACTION_ID - 1] === transactionId) {
        attachments.push({
          attachmentId: row[COLS.ATTACHMENTS.ID - 1],
          transactionId: row[COLS.ATTACHMENTS.TRANSACTION_ID - 1],
          fileId: row[COLS.ATTACHMENTS.FILE_ID - 1],
          url: row[COLS.ATTACHMENTS.URL - 1],
          filename: row[COLS.ATTACHMENTS.FILENAME - 1],
          mimeType: row[COLS.ATTACHMENTS.MIME_TYPE - 1],
          fileSize: row[COLS.ATTACHMENTS.FILE_SIZE - 1],
          createdAt: row[COLS.ATTACHMENTS.CREATED_AT - 1]
        });
      }
    }

    return successResponse({ attachments });
  }, 'getAttachmentsByTransaction');
}

/**
 * 証憑を1件取得
 * @param {string} attachmentId - 証憑ID
 * @returns {Object} 結果
 */
function getAttachmentById(attachmentId) {
  return withErrorHandling(() => {
    const sheet = getSheetOrThrow(SHEET_NAMES.ATTACHMENTS);
    const rowNum = findRowById(sheet, attachmentId, COLS.ATTACHMENTS.ID);

    if (rowNum === -1) {
      throw notFoundError('証憑');
    }

    const row = sheet.getRange(rowNum, 1, 1, 8).getValues()[0];

    return successResponse({
      attachment: {
        attachmentId: row[COLS.ATTACHMENTS.ID - 1],
        transactionId: row[COLS.ATTACHMENTS.TRANSACTION_ID - 1],
        fileId: row[COLS.ATTACHMENTS.FILE_ID - 1],
        url: row[COLS.ATTACHMENTS.URL - 1],
        filename: row[COLS.ATTACHMENTS.FILENAME - 1],
        mimeType: row[COLS.ATTACHMENTS.MIME_TYPE - 1],
        fileSize: row[COLS.ATTACHMENTS.FILE_SIZE - 1],
        createdAt: row[COLS.ATTACHMENTS.CREATED_AT - 1]
      }
    });
  }, 'getAttachmentById');
}

// ===========================================
// 証憑の削除
// ===========================================

/**
 * 証憑を削除（Driveからも削除）
 * @param {string} attachmentId - 証憑ID
 * @returns {Object} 結果
 */
function deleteAttachment(attachmentId) {
  return withErrorHandling(() => {
    const sheet = getSheetOrThrow(SHEET_NAMES.ATTACHMENTS);
    const rowNum = findRowById(sheet, attachmentId, COLS.ATTACHMENTS.ID);

    if (rowNum === -1) {
      throw notFoundError('証憑');
    }

    // データ取得
    const row = sheet.getRange(rowNum, 1, 1, 8).getValues()[0];
    const fileId = row[COLS.ATTACHMENTS.FILE_ID - 1];
    const transactionId = row[COLS.ATTACHMENTS.TRANSACTION_ID - 1];

    // Driveから削除
    try {
      if (fileId) {
        DriveApp.getFileById(fileId).setTrashed(true);
      }
    } catch (e) {
      logWarn('Failed to trash file in Drive', e);
    }

    // シートから行削除
    sheet.deleteRow(rowNum);

    // 取引のreceipt_urlをクリア（他の証憑がなければ）
    const remaining = getAttachmentsByTransaction(transactionId);
    if (remaining.success && remaining.attachments.length === 0) {
      updateTransactionReceiptUrl_(transactionId, '', '');
    }

    logInfo('Attachment deleted', { attachmentId, fileId });

    return successResponse({ message: '証憑を削除しました' });
  }, 'deleteAttachment');
}

// ===========================================
// ヘルパー
// ===========================================

/**
 * 取引のreceipt_urlを更新
 */
function updateTransactionReceiptUrl_(transactionId, url, fileId) {
  try {
    const sheet = getSheet(SHEET_NAMES.TRANSACTIONS);
    if (!sheet) return;

    const rowNum = findRowById(sheet, transactionId, COLS.TRANSACTIONS.ID);
    if (rowNum === -1) return;

    sheet.getRange(rowNum, COLS.TRANSACTIONS.RECEIPT_URL).setValue(url);
    sheet.getRange(rowNum, COLS.TRANSACTIONS.RECEIPT_FILE_ID).setValue(fileId);
    sheet.getRange(rowNum, COLS.TRANSACTIONS.UPDATED_AT).setValue(formatDateTime(getNow()));
  } catch (e) {
    logWarn('Failed to update transaction receipt url', e);
  }
}
