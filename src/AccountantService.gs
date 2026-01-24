/**
 * SkyBlueEarthJapan 経費管理アプリ
 * AccountantService.gs - 会計士共有サービス
 */

// ===========================================
// 単一取引同期
// ===========================================

/**
 * 単一取引を会計士共有シートへ同期
 * @param {Object} payload - { transactionId }
 * @returns {Object} 結果
 */
function syncAccountantExport(payload) {
  try {
    const { transactionId } = payload;

    if (!transactionId) {
      return errorResponse('取引IDが指定されていません');
    }

    // 取引を取得
    const transactionResult = getTransaction(transactionId);
    if (!transactionResult.success) {
      return transactionResult;
    }

    const transaction = transactionResult.transaction;

    // 経費かつconfirmedのみ同期
    if (transaction.type !== TRANSACTION_TYPE.EXPENSE) {
      return successResponse({ message: '売上取引は同期対象外です', synced: false });
    }

    if (transaction.status !== TRANSACTION_STATUS.CONFIRMED) {
      return successResponse({ message: '未確定または無効な取引は同期対象外です', synced: false });
    }

    // 会計士共有シートに書き込み
    const exportSheet = getSheet(SHEETS.ACCOUNTANT_EXPORT);
    if (!exportSheet) {
      return errorResponse('会計士共有シートが見つかりません');
    }

    // 既存の行を検索
    const lastRow = getLastRow(exportSheet);
    let targetRow = lastRow + 1;

    if (lastRow >= 2) {
      const ids = exportSheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (ids[i][0] === transactionId) {
          targetRow = i + 2;
          break;
        }
      }
    }

    // 証憑URLを表示するかどうか
    const showReceipt = getSettingValue('SHOW_RECEIPT_TO_ACCOUNTANT', 'true') === 'true';

    // 行データを作成
    const row = [
      transactionId,                          // transaction_id
      transaction.date,                       // 取引日
      transaction.accountTitle,               // 勘定科目
      transaction.amount,                     // 金額
      transaction.vendor || '',               // 取引先
      transaction.description,                // 摘要
      PAYMENT_METHOD_LABELS[transaction.paymentMethod] || transaction.paymentMethod || '', // 支払方法
      showReceipt ? (transaction.receiptUrl || '') : '', // 証憑URL
      transaction.memo || '',                 // メモ
      transaction.status,                     // ステータス
      formatDateTime(getNow())                // synced_at
    ];

    exportSheet.getRange(targetRow, 1, 1, row.length).setValues([row]);

    logInfo('Transaction synced to accountant export', { transactionId });

    return successResponse({
      message: '会計士共有シートに同期しました',
      synced: true,
      transactionId: transactionId
    });

  } catch (error) {
    logError('syncAccountantExport error', error);
    return errorResponse(error.message);
  }
}

// ===========================================
// 一括再同期
// ===========================================

/**
 * 指定月または全期間を再同期
 * @param {Object} payload - { month } (省略時は全件)
 * @returns {Object} 結果
 */
function resyncAccountantExport(payload) {
  try {
    const { month } = payload || {};

    // 取引シートを取得
    const transactionSheet = getSheet(SHEETS.TRANSACTIONS);
    if (!transactionSheet) {
      return errorResponse('取引シートが見つかりません');
    }

    // 会計士共有シートをクリア（ヘッダー以外）
    const exportSheet = getSheet(SHEETS.ACCOUNTANT_EXPORT);
    if (!exportSheet) {
      return errorResponse('会計士共有シートが見つかりません');
    }

    const exportLastRow = getLastRow(exportSheet);
    if (exportLastRow > 1) {
      exportSheet.getRange(2, 1, exportLastRow - 1, exportSheet.getLastColumn()).clearContent();
    }

    // 取引を取得
    const lastRow = getLastRow(transactionSheet);
    if (lastRow < 2) {
      return successResponse({ message: '同期対象の取引がありません', count: 0 });
    }

    const data = transactionSheet.getRange(2, 1, lastRow - 1, getLastColumn(transactionSheet)).getValues();

    // 証憑URLを表示するかどうか
    const showReceipt = getSettingValue('SHOW_RECEIPT_TO_ACCOUNTANT', 'true') === 'true';

    // 同期対象を抽出
    const rowsToSync = [];
    const now = formatDateTime(getNow());

    for (const row of data) {
      const transactionId = row[COLS_TRANSACTIONS.ID - 1];
      const type = row[COLS_TRANSACTIONS.TYPE - 1];
      const status = row[COLS_TRANSACTIONS.STATUS - 1];
      const rowMonth = row[COLS_TRANSACTIONS.MONTH - 1];

      // 経費かつconfirmedのみ
      if (type !== TRANSACTION_TYPE.EXPENSE) continue;
      if (status !== TRANSACTION_STATUS.CONFIRMED) continue;

      // 月でフィルタ（指定がある場合）
      if (month && rowMonth !== month) continue;

      const date = row[COLS_TRANSACTIONS.DATE - 1];
      const amount = row[COLS_TRANSACTIONS.AMOUNT - 1];
      const vendor = row[COLS_TRANSACTIONS.VENDOR - 1];
      const description = row[COLS_TRANSACTIONS.DESCRIPTION - 1];
      const accountTitle = row[COLS_TRANSACTIONS.ACCOUNT_TITLE - 1];
      const paymentMethod = row[COLS_TRANSACTIONS.PAYMENT_METHOD - 1];
      const receiptUrl = row[COLS_TRANSACTIONS.RECEIPT_URL - 1];
      const memo = row[COLS_TRANSACTIONS.MEMO - 1];

      rowsToSync.push([
        transactionId,
        date,
        accountTitle,
        amount,
        vendor || '',
        description,
        PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod || '',
        showReceipt ? (receiptUrl || '') : '',
        memo || '',
        status,
        now
      ]);
    }

    // 一括書き込み
    if (rowsToSync.length > 0) {
      exportSheet.getRange(2, 1, rowsToSync.length, rowsToSync[0].length).setValues(rowsToSync);
    }

    logInfo('Accountant export resynced', { count: rowsToSync.length, month: month || 'all' });

    return successResponse({
      message: `会計士共有シートを再同期しました（${rowsToSync.length}件）`,
      count: rowsToSync.length
    });

  } catch (error) {
    logError('resyncAccountantExport error', error);
    return errorResponse(error.message);
  }
}

// ===========================================
// 会計士用スプレッドシートへの同期（別シート版）
// ===========================================

/**
 * 別の会計士共有用スプレッドシートへ同期
 * ACCOUNTANT_SHEET_IDが設定されている場合に使用
 * @param {Object} payload - { transactionId } or { month }
 * @returns {Object} 結果
 */
function syncToAccountantSpreadsheet(payload) {
  try {
    const accountantSheetId = getSettingValue('ACCOUNTANT_SHEET_ID');
    if (!accountantSheetId) {
      // 別スプレッドシートが設定されていない場合はスキップ
      return successResponse({ message: '会計士共有用スプレッドシートが設定されていません', synced: false });
    }

    // 別スプレッドシートを開く
    let accountantSS;
    try {
      accountantSS = SpreadsheetApp.openById(accountantSheetId);
    } catch (e) {
      logError('Cannot open accountant spreadsheet', e);
      return errorResponse('会計士共有用スプレッドシートにアクセスできません');
    }

    // 経費シートを取得
    const expenseSheet = accountantSS.getSheetByName(ACCOUNTANT_SHEETS.EXPENSES);
    if (!expenseSheet) {
      return errorResponse('会計士共有用の経費シートが見つかりません');
    }

    // 取引を取得
    const { transactionId, month } = payload || {};

    if (transactionId) {
      // 単一取引の同期
      return syncSingleToAccountantSheet(transactionId, expenseSheet);
    } else {
      // 月次または全件の再同期
      return resyncToAccountantSheet(month, expenseSheet);
    }

  } catch (error) {
    logError('syncToAccountantSpreadsheet error', error);
    return errorResponse(error.message);
  }
}

/**
 * 単一取引を会計士スプレッドシートへ同期
 */
function syncSingleToAccountantSheet(transactionId, expenseSheet) {
  const transactionResult = getTransaction(transactionId);
  if (!transactionResult.success) {
    return transactionResult;
  }

  const t = transactionResult.transaction;

  // 経費かつconfirmedのみ
  if (t.type !== TRANSACTION_TYPE.EXPENSE || t.status !== TRANSACTION_STATUS.CONFIRMED) {
    return successResponse({ message: '同期対象外です', synced: false });
  }

  // 既存行を検索（簡易的に最後に追加）
  const lastRow = expenseSheet.getLastRow();
  const startRow = ACCOUNTANT_DATA_START_ROW;
  const targetRow = Math.max(startRow, lastRow + 1);

  const showReceipt = getSettingValue('SHOW_RECEIPT_TO_ACCOUNTANT', 'true') === 'true';

  const row = [
    t.date,
    t.accountTitle,
    t.amount,
    t.vendor || '',
    t.description,
    PAYMENT_METHOD_LABELS[t.paymentMethod] || t.paymentMethod || '',
    showReceipt ? (t.receiptUrl || '') : '',
    t.memo || '',
    t.status
  ];

  expenseSheet.getRange(targetRow, COLS_ACCOUNTANT.DATE, 1, row.length).setValues([row]);

  return successResponse({ message: '会計士スプレッドシートに同期しました', synced: true });
}

/**
 * 月次または全件を会計士スプレッドシートへ再同期
 */
function resyncToAccountantSheet(month, expenseSheet) {
  // 既存データをクリア
  const lastRow = expenseSheet.getLastRow();
  if (lastRow >= ACCOUNTANT_DATA_START_ROW) {
    expenseSheet.getRange(ACCOUNTANT_DATA_START_ROW, 1, lastRow - ACCOUNTANT_DATA_START_ROW + 1,
      expenseSheet.getLastColumn()).clearContent();
  }

  // 取引を取得
  const transactionSheet = getSheet(SHEETS.TRANSACTIONS);
  if (!transactionSheet) {
    return errorResponse('取引シートが見つかりません');
  }

  const transactionLastRow = getLastRow(transactionSheet);
  if (transactionLastRow < 2) {
    return successResponse({ count: 0 });
  }

  const data = transactionSheet.getRange(2, 1, transactionLastRow - 1,
    getLastColumn(transactionSheet)).getValues();

  const showReceipt = getSettingValue('SHOW_RECEIPT_TO_ACCOUNTANT', 'true') === 'true';

  const rowsToSync = [];

  for (const row of data) {
    const type = row[COLS_TRANSACTIONS.TYPE - 1];
    const status = row[COLS_TRANSACTIONS.STATUS - 1];
    const rowMonth = row[COLS_TRANSACTIONS.MONTH - 1];

    if (type !== TRANSACTION_TYPE.EXPENSE) continue;
    if (status !== TRANSACTION_STATUS.CONFIRMED) continue;
    if (month && rowMonth !== month) continue;

    rowsToSync.push([
      row[COLS_TRANSACTIONS.DATE - 1],
      row[COLS_TRANSACTIONS.ACCOUNT_TITLE - 1],
      row[COLS_TRANSACTIONS.AMOUNT - 1],
      row[COLS_TRANSACTIONS.VENDOR - 1] || '',
      row[COLS_TRANSACTIONS.DESCRIPTION - 1],
      PAYMENT_METHOD_LABELS[row[COLS_TRANSACTIONS.PAYMENT_METHOD - 1]] ||
      row[COLS_TRANSACTIONS.PAYMENT_METHOD - 1] || '',
      showReceipt ? (row[COLS_TRANSACTIONS.RECEIPT_URL - 1] || '') : '',
      row[COLS_TRANSACTIONS.MEMO - 1] || '',
      row[COLS_TRANSACTIONS.STATUS - 1]
    ]);
  }

  if (rowsToSync.length > 0) {
    expenseSheet.getRange(ACCOUNTANT_DATA_START_ROW, COLS_ACCOUNTANT.DATE,
      rowsToSync.length, rowsToSync[0].length).setValues(rowsToSync);
  }

  return successResponse({
    message: `会計士スプレッドシートを再同期しました（${rowsToSync.length}件）`,
    count: rowsToSync.length
  });
}

// ===========================================
// 売上同期（将来用）
// ===========================================

/**
 * 売上を会計士スプレッドシートへ同期
 * （将来の拡張用、現在は経費のみ）
 */
function syncRevenueToAccountant(payload) {
  // 現在は実装なし
  // 必要に応じて経費と同様の仕組みを追加
  return successResponse({ message: '売上の同期は現在サポートされていません' });
}
