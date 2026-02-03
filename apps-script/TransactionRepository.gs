/**
 * SkyBlueEarthJapan 経費管理アプリ
 * TransactionRepository.gs - 取引CRUD
 *
 * Phase 1: DBアクセス層
 */

// ===========================================
// 取引の挿入
// ===========================================

/**
 * 取引を挿入
 * @param {Object} data - 取引データ
 * @returns {Object} 結果
 */
function insertTransaction(data) {
  return withErrorHandling(() => {
    // バリデーション
    validateTransactionData_(data);

    const sheet = getSheetOrThrow(SHEET_NAMES.TRANSACTIONS);
    const now = formatDateTime(getNow());

    // ID生成
    const id = generateUUID();

    // 月を自動設定
    const month = formatMonth(parseDate(data.date));

    // 行データ作成
    const row = [
      id,                                           // id
      data.type,                                    // type
      data.date,                                    // date
      month,                                        // month
      parseAmount(data.amount),                     // amount
      safeTrim(data.vendor) || '',                  // vendor
      safeTrim(data.description),                   // description
      safeTrim(data.account_title),                 // account_title
      data.payment_method || '',                    // payment_method
      data.receipt_url || '',                       // receipt_url
      data.receipt_fileId || '',                    // receipt_fileId
      safeTrim(data.memo) || '',                    // memo
      data.tags || '',                              // tags
      data.status || TRANSACTION_STATUS.DRAFT,      // status
      data.ai_raw || '',                            // ai_raw
      data.ai_confidence || '',                     // ai_confidence
      now,                                          // created_at
      now                                           // updated_at
    ];

    // 追加
    sheet.appendRow(row);

    // 取引先の使用回数を更新
    if (data.vendor) {
      updateVendorUsage_(data.vendor, data.account_title);
    }

    // 監査ログ
    writeAuditLog({
      transactionId: id,
      action: AUDIT_ACTION.CREATE,
      before: null,
      after: rowToTransactionObject_(row)
    });

    logInfo('Transaction inserted', { id });

    return successResponse({
      id: id,
      message: '登録しました'
    });
  }, 'insertTransaction');
}

// ===========================================
// 取引の更新
// ===========================================

/**
 * 取引を更新
 * @param {string} transactionId - 取引ID
 * @param {Object} updates - 更新データ
 * @returns {Object} 結果
 */
function updateTransaction(transactionId, updates) {
  return withErrorHandling(() => {
    if (!transactionId) {
      throw requiredFieldError('transactionId');
    }

    const sheet = getSheetOrThrow(SHEET_NAMES.TRANSACTIONS);
    const rowNum = findRowById(sheet, transactionId, COLS.TRANSACTIONS.ID);

    if (rowNum === -1) {
      throw notFoundError('取引');
    }

    // 現在のデータを取得
    const lastCol = getLastColumn(sheet);
    const currentRow = sheet.getRange(rowNum, 1, 1, lastCol).getValues()[0];
    const beforeData = rowToTransactionObject_(currentRow);

    // 更新不可チェック（void済みは更新不可）
    if (beforeData.status === TRANSACTION_STATUS.VOID) {
      throw validationError('無効化された取引は更新できません');
    }

    // 更新データを適用
    const now = formatDateTime(getNow());

    if (updates.type !== undefined) currentRow[COLS.TRANSACTIONS.TYPE - 1] = updates.type;
    if (updates.date !== undefined) {
      currentRow[COLS.TRANSACTIONS.DATE - 1] = updates.date;
      currentRow[COLS.TRANSACTIONS.MONTH - 1] = formatMonth(parseDate(updates.date));
    }
    if (updates.amount !== undefined) currentRow[COLS.TRANSACTIONS.AMOUNT - 1] = parseAmount(updates.amount);
    if (updates.vendor !== undefined) currentRow[COLS.TRANSACTIONS.VENDOR - 1] = safeTrim(updates.vendor);
    if (updates.description !== undefined) currentRow[COLS.TRANSACTIONS.DESCRIPTION - 1] = safeTrim(updates.description);
    if (updates.account_title !== undefined) currentRow[COLS.TRANSACTIONS.ACCOUNT_TITLE - 1] = safeTrim(updates.account_title);
    if (updates.payment_method !== undefined) currentRow[COLS.TRANSACTIONS.PAYMENT_METHOD - 1] = updates.payment_method;
    if (updates.receipt_url !== undefined) currentRow[COLS.TRANSACTIONS.RECEIPT_URL - 1] = updates.receipt_url;
    if (updates.receipt_fileId !== undefined) currentRow[COLS.TRANSACTIONS.RECEIPT_FILE_ID - 1] = updates.receipt_fileId;
    if (updates.memo !== undefined) currentRow[COLS.TRANSACTIONS.MEMO - 1] = safeTrim(updates.memo);
    if (updates.tags !== undefined) currentRow[COLS.TRANSACTIONS.TAGS - 1] = updates.tags;
    if (updates.status !== undefined) currentRow[COLS.TRANSACTIONS.STATUS - 1] = updates.status;

    currentRow[COLS.TRANSACTIONS.UPDATED_AT - 1] = now;

    // 書き戻し
    sheet.getRange(rowNum, 1, 1, currentRow.length).setValues([currentRow]);

    const afterData = rowToTransactionObject_(currentRow);

    // 変更フィールドを特定
    const changedFields = getChangedFields_(beforeData, afterData);

    // 監査ログ
    writeAuditLog({
      transactionId: transactionId,
      action: AUDIT_ACTION.UPDATE,
      before: beforeData,
      after: afterData,
      changedFields: changedFields
    });

    logInfo('Transaction updated', { id: transactionId, changedFields });

    return successResponse({
      id: transactionId,
      message: '変更を保存しました'
    });
  }, 'updateTransaction');
}

// ===========================================
// 取引の無効化（論理削除）
// ===========================================

/**
 * 取引を無効化
 * @param {string} transactionId - 取引ID
 * @returns {Object} 結果
 */
function voidTransaction(transactionId) {
  return withErrorHandling(() => {
    if (!transactionId) {
      throw requiredFieldError('transactionId');
    }

    const sheet = getSheetOrThrow(SHEET_NAMES.TRANSACTIONS);
    const rowNum = findRowById(sheet, transactionId, COLS.TRANSACTIONS.ID);

    if (rowNum === -1) {
      throw notFoundError('取引');
    }

    // 現在のデータを取得
    const lastCol = getLastColumn(sheet);
    const currentRow = sheet.getRange(rowNum, 1, 1, lastCol).getValues()[0];
    const beforeData = rowToTransactionObject_(currentRow);

    // 既にvoidならスキップ
    if (beforeData.status === TRANSACTION_STATUS.VOID) {
      return successResponse({
        id: transactionId,
        message: '既に無効化されています'
      });
    }

    // ステータスを更新
    const now = formatDateTime(getNow());
    currentRow[COLS.TRANSACTIONS.STATUS - 1] = TRANSACTION_STATUS.VOID;
    currentRow[COLS.TRANSACTIONS.UPDATED_AT - 1] = now;

    sheet.getRange(rowNum, 1, 1, currentRow.length).setValues([currentRow]);

    const afterData = rowToTransactionObject_(currentRow);

    // 監査ログ
    writeAuditLog({
      transactionId: transactionId,
      action: AUDIT_ACTION.VOID,
      before: beforeData,
      after: afterData,
      changedFields: ['status']
    });

    logInfo('Transaction voided', { id: transactionId });

    return successResponse({
      id: transactionId,
      message: '取引を無効にしました'
    });
  }, 'voidTransaction');
}

// ===========================================
// 取引の取得（単一）
// ===========================================

/**
 * 取引を1件取得
 * @param {string} transactionId - 取引ID
 * @returns {Object} 結果
 */
function getTransactionById(transactionId) {
  return withErrorHandling(() => {
    if (!transactionId) {
      throw requiredFieldError('transactionId');
    }

    const sheet = getSheetOrThrow(SHEET_NAMES.TRANSACTIONS);
    const rowNum = findRowById(sheet, transactionId, COLS.TRANSACTIONS.ID);

    if (rowNum === -1) {
      throw notFoundError('取引');
    }

    const lastCol = getLastColumn(sheet);
    const row = sheet.getRange(rowNum, 1, 1, lastCol).getValues()[0];
    const transaction = rowToTransactionObject_(row);

    return successResponse({ transaction });
  }, 'getTransactionById');
}

// ===========================================
// 取引の一覧取得
// ===========================================

/**
 * 取引一覧を取得
 * @param {Object} filters - フィルタ条件
 * @returns {Object} 結果
 */
function listTransactions(filters = {}) {
  return withErrorHandling(() => {
    const sheet = getSheetOrThrow(SHEET_NAMES.TRANSACTIONS);
    const lastRow = getLastRow(sheet);

    if (lastRow < 2) {
      return successResponse({ items: [], total: 0 });
    }

    const lastCol = getLastColumn(sheet);
    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    // フィルタ適用
    let items = data.map(row => rowToTransactionObject_(row));

    // 月フィルタ
    if (filters.month) {
      items = items.filter(t => t.month === filters.month);
    }

    // タイプフィルタ
    if (filters.type) {
      items = items.filter(t => t.type === filters.type);
    }

    // ステータスフィルタ（デフォルトでvoid以外）
    if (filters.status) {
      items = items.filter(t => t.status === filters.status);
    } else if (filters.includeVoid !== true) {
      items = items.filter(t => t.status !== TRANSACTION_STATUS.VOID);
    }

    // 勘定科目フィルタ
    if (filters.accountTitle) {
      items = items.filter(t => t.accountTitle === filters.accountTitle);
    }

    // 検索フィルタ（vendor, description）
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      items = items.filter(t =>
        (t.vendor && t.vendor.toLowerCase().includes(searchLower)) ||
        (t.description && t.description.toLowerCase().includes(searchLower))
      );
    }

    // 日付順ソート（新しい順）
    items.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA;
    });

    const total = items.length;

    // ページネーション
    if (filters.offset) {
      items = items.slice(filters.offset);
    }
    if (filters.limit) {
      items = items.slice(0, filters.limit);
    }

    return successResponse({ items, total });
  }, 'listTransactions');
}

// ===========================================
// 内部ヘルパー
// ===========================================

/**
 * 取引データのバリデーション
 */
function validateTransactionData_(data) {
  const { valid, missing } = validateRequired(data, ['type', 'date', 'amount', 'description']);

  if (!valid) {
    throw requiredFieldError(missing[0]);
  }

  if (!isValidTransactionType(data.type)) {
    throw validationError('種別（type）が不正です');
  }

  if (!isValidDateFormat(data.date)) {
    throw validationError('日付形式が不正です（YYYY-MM-DD）');
  }

  const amount = parseAmount(data.amount);
  if (amount === null || amount <= 0) {
    throw validationError('金額は1以上の数値を入力してください');
  }

  if (data.payment_method && !isValidPaymentMethod(data.payment_method)) {
    throw validationError('支払方法が不正です');
  }
}

/**
 * 行データを取引オブジェクトに変換
 */
function rowToTransactionObject_(row) {
  return {
    id: row[COLS.TRANSACTIONS.ID - 1],
    type: row[COLS.TRANSACTIONS.TYPE - 1],
    date: formatDate(row[COLS.TRANSACTIONS.DATE - 1]),
    month: row[COLS.TRANSACTIONS.MONTH - 1],
    amount: row[COLS.TRANSACTIONS.AMOUNT - 1],
    vendor: row[COLS.TRANSACTIONS.VENDOR - 1],
    description: row[COLS.TRANSACTIONS.DESCRIPTION - 1],
    accountTitle: row[COLS.TRANSACTIONS.ACCOUNT_TITLE - 1],
    paymentMethod: row[COLS.TRANSACTIONS.PAYMENT_METHOD - 1],
    receiptUrl: row[COLS.TRANSACTIONS.RECEIPT_URL - 1],
    receiptFileId: row[COLS.TRANSACTIONS.RECEIPT_FILE_ID - 1],
    memo: row[COLS.TRANSACTIONS.MEMO - 1],
    tags: row[COLS.TRANSACTIONS.TAGS - 1],
    status: row[COLS.TRANSACTIONS.STATUS - 1],
    aiRaw: row[COLS.TRANSACTIONS.AI_RAW - 1],
    aiConfidence: row[COLS.TRANSACTIONS.AI_CONFIDENCE - 1],
    createdAt: row[COLS.TRANSACTIONS.CREATED_AT - 1],
    updatedAt: row[COLS.TRANSACTIONS.UPDATED_AT - 1]
  };
}

/**
 * 変更されたフィールドを特定
 */
function getChangedFields_(before, after) {
  const changed = [];
  const keys = Object.keys(before);

  for (const key of keys) {
    if (key === 'createdAt' || key === 'updatedAt') continue;
    if (before[key] !== after[key]) {
      changed.push(key);
    }
  }

  return changed;
}

/**
 * 取引先の使用回数を更新
 */
function updateVendorUsage_(vendorName, accountTitle) {
  try {
    const sheet = getSheet(SHEET_NAMES.VENDORS);
    if (!sheet) return;

    const lastRow = getLastRow(sheet);
    if (lastRow < 2) {
      // 新規追加
      addNewVendor_(sheet, vendorName, accountTitle);
      return;
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    const now = formatDateTime(getNow());

    for (let i = 0; i < data.length; i++) {
      if (data[i][COLS.VENDORS.NAME - 1] === vendorName) {
        // 既存取引先の更新
        const usageCount = (data[i][COLS.VENDORS.USAGE_COUNT - 1] || 0) + 1;
        sheet.getRange(i + 2, COLS.VENDORS.USAGE_COUNT, 1, 2).setValues([[usageCount, now]]);
        return;
      }
    }

    // 見つからなければ新規追加
    addNewVendor_(sheet, vendorName, accountTitle);
  } catch (e) {
    logWarn('Failed to update vendor usage', e);
  }
}

function addNewVendor_(sheet, vendorName, accountTitle) {
  const id = 'V' + generateShortId();
  const now = formatDateTime(getNow());
  sheet.appendRow([id, vendorName, accountTitle || '', 1, now, true]);
}
