/**
 * SkyBlueEarthJapan 経費管理アプリ
 * TransactionService.gs - 取引CRUD操作
 */

// ===========================================
// 取引確定（Create）
// ===========================================

/**
 * 取引を確定してDBに保存
 * @param {Object} payload - 取引データ
 * @returns {Object} 結果
 */
function confirmTransaction(payload) {
  try {
    // バリデーション
    const validation = validateRequired(payload, ['type', 'date', 'amount', 'description', 'account_title']);
    if (!validation.valid) {
      return errorResponse(`${ERROR_MESSAGES.REQUIRED_FIELD_MISSING}: ${validation.missing.join(', ')}`);
    }

    if (!isValidTransactionType(payload.type)) {
      return errorResponse('取引種別が不正です');
    }

    if (!isValidDateFormat(payload.date)) {
      return errorResponse('日付形式が不正です（YYYY-MM-DD）');
    }

    const amount = parseAmount(payload.amount);
    if (!amount || amount <= 0) {
      return errorResponse('金額は正の整数で入力してください');
    }

    const sheet = getSheet(SHEETS.TRANSACTIONS);
    if (!sheet) {
      return errorResponse('Transactions sheet not found');
    }

    // UUIDとタイムスタンプを生成
    const transactionId = generateUUID();
    const now = formatDateTime(getNow());
    const monthStr = formatMonth(parseDate(payload.date));

    // 行データを作成
    const row = [
      transactionId,                                      // id
      payload.type,                                       // type
      payload.date,                                       // date
      monthStr,                                           // month
      amount,                                             // amount
      safeTrim(payload.vendor) || '',                     // vendor
      safeTrim(payload.description),                      // description
      safeTrim(payload.account_title),                    // account_title
      payload.payment_method || '',                       // payment_method
      '',                                                 // receipt_url
      '',                                                 // receipt_fileId
      safeTrim(payload.memo) || '',                       // memo
      payload.tags || '',                                 // tags
      TRANSACTION_STATUS.CONFIRMED,                       // status
      payload.ai_raw || '',                               // ai_raw
      payload.ai_confidence || '',                        // ai_confidence
      now,                                                // created_at
      now                                                 // updated_at
    ];

    // DBに追記
    sheet.appendRow(row);

    // 監査ログに記録
    writeAuditLog({
      transactionId: transactionId,
      action: AUDIT_ACTION.CREATE,
      before: null,
      after: rowToTransactionObject(row)
    });

    // 取引先マスタを更新（使用回数カウント）
    updateVendorUsage(payload.vendor, payload.account_title);

    // 会計士共有シートに同期（経費のみ）
    if (payload.type === TRANSACTION_TYPE.EXPENSE) {
      syncAccountantExport({ transactionId: transactionId });
    }

    logInfo('Transaction confirmed', { transactionId, type: payload.type, amount });

    return successResponse({
      message: SUCCESS_MESSAGES.TRANSACTION_SAVED,
      transactionId: transactionId
    });

  } catch (error) {
    logError('confirmTransaction error', error);
    return errorResponse(ERROR_MESSAGES.SAVE_FAILED);
  }
}

// ===========================================
// 取引取得（Read）
// ===========================================

/**
 * 取引一覧を取得
 * @param {Object} filters - フィルタ条件
 * @returns {Object} 取引一覧
 */
function listTransactions(filters = {}) {
  try {
    const sheet = getSheet(SHEETS.TRANSACTIONS);
    if (!sheet) {
      return errorResponse('Transactions sheet not found');
    }

    const lastRow = getLastRow(sheet);
    if (lastRow < 2) {
      return successResponse({ items: [], total: 0 });
    }

    // 全データを取得
    const data = sheet.getRange(2, 1, lastRow - 1, getLastColumn(sheet)).getValues();

    // フィルタリング
    let items = data
      .map(row => rowToTransactionObject(row))
      .filter(t => t.status !== TRANSACTION_STATUS.VOID); // voidは除外

    // 月でフィルタ
    if (filters.month) {
      items = items.filter(t => t.month === filters.month);
    }

    // 種別でフィルタ
    if (filters.type) {
      items = items.filter(t => t.type === filters.type);
    }

    // 勘定科目でフィルタ
    if (filters.account_title) {
      items = items.filter(t => t.accountTitle === filters.account_title);
    }

    // 取引先でフィルタ
    if (filters.vendor) {
      items = items.filter(t => t.vendor && t.vendor.includes(filters.vendor));
    }

    // 支払方法でフィルタ
    if (filters.payment_method) {
      items = items.filter(t => t.paymentMethod === filters.payment_method);
    }

    // 検索（摘要・取引先）
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      items = items.filter(t =>
        (t.description && t.description.toLowerCase().includes(searchLower)) ||
        (t.vendor && t.vendor.toLowerCase().includes(searchLower))
      );
    }

    // ソート（日付降順がデフォルト）
    const sortBy = filters.sortBy || 'date';
    const sortOrder = filters.sortOrder || 'desc';

    items.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (sortBy === 'date') {
        valA = new Date(valA);
        valB = new Date(valB);
      } else if (sortBy === 'amount') {
        valA = Number(valA);
        valB = Number(valB);
      }

      if (sortOrder === 'desc') {
        return valA > valB ? -1 : valA < valB ? 1 : 0;
      } else {
        return valA < valB ? -1 : valA > valB ? 1 : 0;
      }
    });

    // ページネーション
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const total = items.length;
    const startIndex = (page - 1) * limit;

    items = items.slice(startIndex, startIndex + limit);

    return successResponse({
      items: items,
      total: total,
      page: page,
      limit: limit,
      hasMore: startIndex + items.length < total
    });

  } catch (error) {
    logError('listTransactions error', error);
    return errorResponse(error.message);
  }
}

/**
 * 取引詳細を取得
 * @param {string} transactionId - 取引ID
 * @returns {Object} 取引詳細
 */
function getTransaction(transactionId) {
  try {
    if (!transactionId) {
      return errorResponse(ERROR_MESSAGES.REQUIRED_FIELD_MISSING);
    }

    const sheet = getSheet(SHEETS.TRANSACTIONS);
    if (!sheet) {
      return errorResponse('Transactions sheet not found');
    }

    const rowNum = findRowById(sheet, transactionId, COLS_TRANSACTIONS.ID, 2);
    if (rowNum < 0) {
      return errorResponse(ERROR_MESSAGES.TRANSACTION_NOT_FOUND);
    }

    const row = sheet.getRange(rowNum, 1, 1, getLastColumn(sheet)).getValues()[0];
    const transaction = rowToTransactionObject(row);

    return successResponse({ transaction: transaction });

  } catch (error) {
    logError('getTransaction error', error);
    return errorResponse(error.message);
  }
}

// ===========================================
// 取引更新（Update）
// ===========================================

/**
 * 取引を更新
 * @param {Object} payload - 更新データ
 * @returns {Object} 結果
 */
function updateTransaction(payload) {
  try {
    const { transactionId, updates } = payload;

    if (!transactionId) {
      return errorResponse(ERROR_MESSAGES.REQUIRED_FIELD_MISSING);
    }

    const sheet = getSheet(SHEETS.TRANSACTIONS);
    if (!sheet) {
      return errorResponse('Transactions sheet not found');
    }

    const rowNum = findRowById(sheet, transactionId, COLS_TRANSACTIONS.ID, 2);
    if (rowNum < 0) {
      return errorResponse(ERROR_MESSAGES.TRANSACTION_NOT_FOUND);
    }

    // 現在のデータを取得
    const currentRow = sheet.getRange(rowNum, 1, 1, getLastColumn(sheet)).getValues()[0];
    const beforeData = rowToTransactionObject(currentRow);

    // 更新可能なフィールドを更新
    const updatableFields = {
      type: COLS_TRANSACTIONS.TYPE,
      date: COLS_TRANSACTIONS.DATE,
      amount: COLS_TRANSACTIONS.AMOUNT,
      vendor: COLS_TRANSACTIONS.VENDOR,
      description: COLS_TRANSACTIONS.DESCRIPTION,
      account_title: COLS_TRANSACTIONS.ACCOUNT_TITLE,
      payment_method: COLS_TRANSACTIONS.PAYMENT_METHOD,
      memo: COLS_TRANSACTIONS.MEMO,
      tags: COLS_TRANSACTIONS.TAGS
    };

    const changedFields = [];

    for (const [field, colIndex] of Object.entries(updatableFields)) {
      if (updates.hasOwnProperty(field)) {
        let newValue = updates[field];

        // 金額の場合は数値変換
        if (field === 'amount') {
          newValue = parseAmount(newValue);
        }

        // 日付の場合は月も更新
        if (field === 'date' && newValue) {
          sheet.getRange(rowNum, COLS_TRANSACTIONS.MONTH).setValue(formatMonth(parseDate(newValue)));
        }

        sheet.getRange(rowNum, colIndex).setValue(newValue);
        changedFields.push(field);
      }
    }

    // updated_at を更新
    const now = formatDateTime(getNow());
    sheet.getRange(rowNum, COLS_TRANSACTIONS.UPDATED_AT).setValue(now);

    // 更新後のデータを取得
    const updatedRow = sheet.getRange(rowNum, 1, 1, getLastColumn(sheet)).getValues()[0];
    const afterData = rowToTransactionObject(updatedRow);

    // 監査ログに記録
    writeAuditLog({
      transactionId: transactionId,
      action: AUDIT_ACTION.UPDATE,
      before: beforeData,
      after: afterData,
      changedFields: changedFields
    });

    // 会計士共有シートを更新（経費の場合）
    if (afterData.type === TRANSACTION_TYPE.EXPENSE) {
      syncAccountantExport({ transactionId: transactionId });
    }

    logInfo('Transaction updated', { transactionId, changedFields });

    return successResponse({
      message: SUCCESS_MESSAGES.TRANSACTION_UPDATED,
      transactionId: transactionId
    });

  } catch (error) {
    logError('updateTransaction error', error);
    return errorResponse(ERROR_MESSAGES.SAVE_FAILED);
  }
}

// ===========================================
// 取引無効化（Void）
// ===========================================

/**
 * 取引を無効化
 * @param {Object} payload - { transactionId }
 * @returns {Object} 結果
 */
function voidTransaction(payload) {
  try {
    const { transactionId } = payload;

    if (!transactionId) {
      return errorResponse(ERROR_MESSAGES.REQUIRED_FIELD_MISSING);
    }

    const sheet = getSheet(SHEETS.TRANSACTIONS);
    if (!sheet) {
      return errorResponse('Transactions sheet not found');
    }

    const rowNum = findRowById(sheet, transactionId, COLS_TRANSACTIONS.ID, 2);
    if (rowNum < 0) {
      return errorResponse(ERROR_MESSAGES.TRANSACTION_NOT_FOUND);
    }

    // 現在のデータを取得
    const currentRow = sheet.getRange(rowNum, 1, 1, getLastColumn(sheet)).getValues()[0];
    const beforeData = rowToTransactionObject(currentRow);

    // ステータスをvoidに更新
    sheet.getRange(rowNum, COLS_TRANSACTIONS.STATUS).setValue(TRANSACTION_STATUS.VOID);

    const now = formatDateTime(getNow());
    sheet.getRange(rowNum, COLS_TRANSACTIONS.UPDATED_AT).setValue(now);

    // 更新後のデータ
    const afterData = { ...beforeData, status: TRANSACTION_STATUS.VOID, updatedAt: now };

    // 監査ログに記録
    writeAuditLog({
      transactionId: transactionId,
      action: AUDIT_ACTION.VOID,
      before: beforeData,
      after: afterData,
      changedFields: ['status']
    });

    // 会計士共有シートからも削除（実際は同期時にvoidは除外される）
    // syncAccountantExport will skip void transactions

    logInfo('Transaction voided', { transactionId });

    return successResponse({
      message: SUCCESS_MESSAGES.TRANSACTION_VOIDED,
      transactionId: transactionId
    });

  } catch (error) {
    logError('voidTransaction error', error);
    return errorResponse(ERROR_MESSAGES.SAVE_FAILED);
  }
}

// ===========================================
// 監査ログ
// ===========================================

/**
 * 監査ログを書き込み
 * @param {Object} logData - ログデータ
 */
function writeAuditLog(logData) {
  try {
    const sheet = getSheet(SHEETS.AUDIT_LOG);
    if (!sheet) return;

    const auditId = generateUUID();
    const now = formatDateTime(getNow());
    const editor = Session.getActiveUser().getEmail() || 'system';

    const row = [
      auditId,                                          // audit_id
      logData.transactionId,                            // transaction_id
      logData.action,                                   // action
      logData.before ? JSON.stringify(logData.before) : '',  // before_json
      logData.after ? JSON.stringify(logData.after) : '',    // after_json
      (logData.changedFields || []).join(','),          // changed_fields
      editor,                                           // editor
      now                                               // timestamp
    ];

    sheet.appendRow(row);

  } catch (error) {
    logError('writeAuditLog error', error);
  }
}

// ===========================================
// 取引先マスタ更新
// ===========================================

/**
 * 取引先の使用回数を更新
 * @param {string} vendorName - 取引先名
 * @param {string} accountTitle - 勘定科目
 */
function updateVendorUsage(vendorName, accountTitle) {
  if (!vendorName) return;

  try {
    const sheet = getSheet(SHEETS.VENDORS);
    if (!sheet) return;

    const lastRow = getLastRow(sheet);
    if (lastRow < 2) {
      // 新規追加
      addNewVendor(sheet, vendorName, accountTitle);
      return;
    }

    // 既存の取引先を検索
    const data = sheet.getRange(2, COLS_VENDORS.NAME, lastRow - 1, 1).getValues();
    let foundRow = -1;

    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === vendorName) {
        foundRow = i + 2;
        break;
      }
    }

    if (foundRow > 0) {
      // 使用回数をインクリメント
      const currentCount = sheet.getRange(foundRow, COLS_VENDORS.USAGE_COUNT).getValue() || 0;
      sheet.getRange(foundRow, COLS_VENDORS.USAGE_COUNT).setValue(currentCount + 1);
      sheet.getRange(foundRow, COLS_VENDORS.LAST_USED).setValue(formatDateTime(getNow()));
    } else {
      // 新規追加
      addNewVendor(sheet, vendorName, accountTitle);
    }

  } catch (error) {
    logError('updateVendorUsage error', error);
  }
}

/**
 * 新規取引先を追加
 * @param {Sheet} sheet - 取引先シート
 * @param {string} vendorName - 取引先名
 * @param {string} accountTitle - デフォルト勘定科目
 */
function addNewVendor(sheet, vendorName, accountTitle) {
  const vendorId = 'V' + generateShortId();
  const now = formatDateTime(getNow());

  const row = [
    vendorId,       // vendor_id
    vendorName,     // name
    accountTitle,   // default_account_title
    1,              // usage_count
    now,            // last_used_at
    true            // active
  ];

  sheet.appendRow(row);
}

// ===========================================
// ヘルパー関数
// ===========================================

/**
 * 行データを取引オブジェクトに変換
 * @param {Array} row - 行データ
 * @returns {Object} 取引オブジェクト
 */
function rowToTransactionObject(row) {
  return {
    id: row[COLS_TRANSACTIONS.ID - 1],
    type: row[COLS_TRANSACTIONS.TYPE - 1],
    date: row[COLS_TRANSACTIONS.DATE - 1],
    month: row[COLS_TRANSACTIONS.MONTH - 1],
    amount: row[COLS_TRANSACTIONS.AMOUNT - 1],
    vendor: row[COLS_TRANSACTIONS.VENDOR - 1],
    description: row[COLS_TRANSACTIONS.DESCRIPTION - 1],
    accountTitle: row[COLS_TRANSACTIONS.ACCOUNT_TITLE - 1],
    paymentMethod: row[COLS_TRANSACTIONS.PAYMENT_METHOD - 1],
    receiptUrl: row[COLS_TRANSACTIONS.RECEIPT_URL - 1],
    receiptFileId: row[COLS_TRANSACTIONS.RECEIPT_FILE_ID - 1],
    memo: row[COLS_TRANSACTIONS.MEMO - 1],
    tags: row[COLS_TRANSACTIONS.TAGS - 1],
    status: row[COLS_TRANSACTIONS.STATUS - 1],
    aiRaw: row[COLS_TRANSACTIONS.AI_RAW - 1],
    aiConfidence: row[COLS_TRANSACTIONS.AI_CONFIDENCE - 1],
    createdAt: row[COLS_TRANSACTIONS.CREATED_AT - 1],
    updatedAt: row[COLS_TRANSACTIONS.UPDATED_AT - 1]
  };
}

// ===========================================
// マスタ取得
// ===========================================

/**
 * 勘定科目一覧を取得
 * @returns {Object} 勘定科目一覧
 */
function getAccountTitles() {
  try {
    const sheet = getSheet(SHEETS.ACCOUNT_TITLES);
    if (!sheet) {
      return errorResponse('Account titles sheet not found');
    }

    const lastRow = getLastRow(sheet);
    if (lastRow < 2) {
      return successResponse({ accountTitles: [] });
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();

    const accountTitles = data
      .filter(row => row[COLS_ACCOUNT_TITLES.ACTIVE - 1] === true)
      .map(row => ({
        id: row[COLS_ACCOUNT_TITLES.ID - 1],
        name: row[COLS_ACCOUNT_TITLES.NAME - 1],
        type: row[COLS_ACCOUNT_TITLES.TYPE - 1],
        description: row[COLS_ACCOUNT_TITLES.DESCRIPTION - 1],
        keywords: row[COLS_ACCOUNT_TITLES.KEYWORDS - 1],
        defaultConfidence: row[COLS_ACCOUNT_TITLES.DEFAULT_CONFIDENCE - 1],
        sortOrder: row[COLS_ACCOUNT_TITLES.SORT_ORDER - 1]
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return successResponse({ accountTitles: accountTitles });

  } catch (error) {
    logError('getAccountTitles error', error);
    return errorResponse(error.message);
  }
}

/**
 * 取引先ヒント一覧を取得
 * @returns {Object} 取引先ヒント
 */
function getVendorHints() {
  try {
    const sheet = getSheet(SHEETS.VENDORS);
    if (!sheet) {
      return successResponse({ vendors: [] });
    }

    const lastRow = getLastRow(sheet);
    if (lastRow < 2) {
      return successResponse({ vendors: [] });
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();

    const vendors = data
      .filter(row => row[COLS_VENDORS.ACTIVE - 1] === true)
      .map(row => ({
        id: row[COLS_VENDORS.ID - 1],
        name: row[COLS_VENDORS.NAME - 1],
        defaultAccountTitle: row[COLS_VENDORS.DEFAULT_ACCOUNT_TITLE - 1],
        usageCount: row[COLS_VENDORS.USAGE_COUNT - 1]
      }))
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));

    return successResponse({ vendors: vendors });

  } catch (error) {
    logError('getVendorHints error', error);
    return errorResponse(error.message);
  }
}
