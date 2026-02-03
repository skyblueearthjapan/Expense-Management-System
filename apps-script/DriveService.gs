/**
 * SkyBlueEarthJapan 経費管理アプリ
 * DriveService.gs - 証憑アップロード
 */

// ===========================================
// 証憑アップロード
// ===========================================

/**
 * 証憑をアップロード
 * @param {Object} payload - アップロードパラメータ
 * @param {string} payload.transactionId - 取引ID
 * @param {string} payload.fileData - Base64エンコードされたファイルデータ
 * @param {string} payload.filename - ファイル名
 * @param {string} payload.mimeType - MIMEタイプ
 * @returns {Object} 結果
 */
function uploadReceipt(payload) {
  return withErrorHandling(() => {
    const { transactionId, fileData, filename, mimeType } = payload;

    // バリデーション
    if (!transactionId) {
      throw requiredFieldError('transactionId');
    }
    if (!fileData) {
      throw requiredFieldError('fileData');
    }

    // 取引の存在確認
    const txResult = getTransactionById(transactionId);
    if (!txResult.success) {
      throw notFoundError('取引');
    }

    const transaction = txResult.transaction;

    // 保存先フォルダを取得/作成
    const folder = getOrCreateReceiptFolder_(transaction.date);

    // ファイル名を決定
    const safeFilename = generateReceiptFilename_(transactionId, filename, mimeType);

    // Base64デコード
    const blob = Utilities.newBlob(
      Utilities.base64Decode(fileData),
      mimeType || 'application/octet-stream',
      safeFilename
    );

    // Driveに保存
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileId = file.getId();
    const fileUrl = file.getUrl();
    const fileSize = file.getSize();

    // Attachmentsに記録
    const attachResult = addAttachment({
      transactionId: transactionId,
      fileId: fileId,
      url: fileUrl,
      filename: safeFilename,
      mimeType: mimeType,
      fileSize: fileSize
    });

    if (!attachResult.success) {
      // ロールバック：ファイル削除
      try {
        file.setTrashed(true);
      } catch (e) {
        logWarn('Failed to rollback uploaded file', e);
      }
      return attachResult;
    }

    logInfo('Receipt uploaded', {
      transactionId,
      fileId,
      filename: safeFilename
    });

    return successResponse({
      fileId: fileId,
      url: fileUrl,
      filename: safeFilename,
      message: 'アップロードしました'
    });
  }, 'uploadReceipt');
}

// ===========================================
// フォルダ管理
// ===========================================

/**
 * 証憑保存フォルダを取得または作成
 * @param {string} date - 取引日（YYYY-MM-DD）
 * @returns {Folder}
 */
function getOrCreateReceiptFolder_(date) {
  const rootFolderId = getReceiptFolderId();

  if (!rootFolderId) {
    throw new AppError(
      '証憑保存フォルダが設定されていません。Settings シートの RECEIPT_FOLDER_ID を設定してください。',
      ERROR_CODE.CONFIG_ERROR,
      HTTP_STATUS.INTERNAL_ERROR
    );
  }

  let rootFolder;
  try {
    rootFolder = DriveApp.getFolderById(rootFolderId);
  } catch (e) {
    throw new AppError(
      '証憑保存フォルダにアクセスできません。フォルダIDを確認してください。',
      ERROR_CODE.DRIVE_ERROR,
      HTTP_STATUS.INTERNAL_ERROR
    );
  }

  // 年月フォルダを取得/作成: {root}/{YYYY}/{MM}/
  const d = parseDate(date) || new Date();
  const year = String(d.getFullYear());
  const month = String(d.getMonth() + 1).padStart(2, '0');

  // 年フォルダ
  let yearFolder = getFolderByName_(rootFolder, year);
  if (!yearFolder) {
    yearFolder = rootFolder.createFolder(year);
  }

  // 月フォルダ
  let monthFolder = getFolderByName_(yearFolder, month);
  if (!monthFolder) {
    monthFolder = yearFolder.createFolder(month);
  }

  return monthFolder;
}

/**
 * 名前でフォルダを検索
 */
function getFolderByName_(parentFolder, name) {
  const folders = parentFolder.getFoldersByName(name);
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
 * @param {string} transactionId - 取引ID
 * @param {string} originalFilename - 元のファイル名
 * @param {string} mimeType - MIMEタイプ
 * @returns {string}
 */
function generateReceiptFilename_(transactionId, originalFilename, mimeType) {
  const shortId = transactionId.substring(0, 8);
  const timestamp = Utilities.formatDate(new Date(), APP.TIMEZONE, 'yyyyMMdd_HHmmss');

  // 拡張子を決定
  let ext = '';
  if (originalFilename) {
    const parts = originalFilename.split('.');
    if (parts.length > 1) {
      ext = '.' + parts[parts.length - 1].toLowerCase();
    }
  }

  if (!ext && mimeType) {
    ext = getExtensionFromMimeType_(mimeType);
  }

  return `receipt_${shortId}_${timestamp}${ext}`;
}

/**
 * MIMEタイプから拡張子を取得
 */
function getExtensionFromMimeType_(mimeType) {
  const mimeMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'image/heic': '.heic',
    'image/heif': '.heif'
  };
  return mimeMap[mimeType] || '';
}

// ===========================================
// ファイル削除
// ===========================================

/**
 * 証憑ファイルを削除（ゴミ箱へ）
 * @param {string} fileId - DriveファイルID
 * @returns {Object} 結果
 */
function deleteReceiptFile(fileId) {
  return withErrorHandling(() => {
    if (!fileId) {
      throw requiredFieldError('fileId');
    }

    try {
      const file = DriveApp.getFileById(fileId);
      file.setTrashed(true);
      logInfo('Receipt file deleted', { fileId });
      return successResponse({ message: 'ファイルを削除しました' });
    } catch (e) {
      logWarn('Failed to delete receipt file', e);
      return errorResponse('ファイルの削除に失敗しました', ERROR_CODE.DRIVE_ERROR);
    }
  }, 'deleteReceiptFile');
}

// ===========================================
// ファイル情報取得
// ===========================================

/**
 * ファイル情報を取得
 * @param {string} fileId - DriveファイルID
 * @returns {Object} 結果
 */
function getFileInfo(fileId) {
  return withErrorHandling(() => {
    if (!fileId) {
      throw requiredFieldError('fileId');
    }

    try {
      const file = DriveApp.getFileById(fileId);
      return successResponse({
        fileInfo: {
          id: file.getId(),
          name: file.getName(),
          url: file.getUrl(),
          mimeType: file.getMimeType(),
          size: file.getSize(),
          createdAt: file.getDateCreated().toISOString(),
          thumbnailUrl: file.getThumbnail() ? `https://drive.google.com/thumbnail?id=${fileId}` : null
        }
      });
    } catch (e) {
      throw notFoundError('ファイル');
    }
  }, 'getFileInfo');
}
