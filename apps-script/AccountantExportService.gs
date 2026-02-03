/**
 * SkyBlueEarthJapan 経費管理アプリ
 * AccountantExportService.gs - 会計士共有シート同期
 *
 * Phase 2: 会計士共有シート同期
 *
 * 仕様:
 * - 経費: status=confirmed & type=expense のみ
 * - 売上: status=confirmed & type=revenue のみ
 * - 金額は正（マイナスにしない）
 * - Upsert方式（同じtransactionIdは上書き）
 * - voidした場合は会計士シートからも削除
 */

// ===========================================
// 経費同期
// ===========================================

/**
 * 経費を会計士共有シートへ同期
 * @param {string} transactionId - 取引ID
 * @returns {Object} 結果
 */
function syncExpense(transactionId) {
  return withErrorHandling(() => {
    if (!transactionId) {
      throw requiredFieldError('transactionId');
    }

    // 取引を取得
    const result = getTransactionById(transactionId);
    if (!result.success) {
      return result;
    }

    const transaction = result.transaction;

    // 同期対象チェック
    if (transaction.type !== TRANSACTION_TYPE.EXPENSE) {
      return successResponse({ synced: false, reason: '経費ではありません' });
    }

    if (transaction.status !== TRANSACTION_STATUS.CONFIRMED) {
      // voidの場合は削除
      if (transaction.status === TRANSACTION_STATUS.VOID) {
        return removeFromAccountantExport_(transactionId);
      }
      return successResponse({ synced: false, reason: '未確定の取引です' });
    }

    // 同期実行
    return upsertToAccountantExport_(transaction);
  }, 'syncExpense');
}

// ===========================================
// 売上同期
// ===========================================

/**
 * 売上を会計士共有シートへ同期
 * @param {string} transactionId - 取引ID
 * @returns {Object} 結果
 */
function syncRevenue(transactionId) {
  return withErrorHandling(() => {
    if (!transactionId) {
      throw requiredFieldError('transactionId');
    }

    // 取引を取得
    const result = getTransactionById(transactionId);
    if (!result.success) {
      return result;
    }

    const transaction = result.transaction;

    // 同期対象チェック
    if (transaction.type !== TRANSACTION_TYPE.REVENUE) {
      return successResponse({ synced: false, reason: '売上ではありません' });
    }

    if (transaction.status !== TRANSACTION_STATUS.CONFIRMED) {
      // voidの場合は削除
      if (transaction.status === TRANSACTION_STATUS.VOID) {
        return removeFromAccountantExport_(transactionId);
      }
      return successResponse({ synced: false, reason: '未確定の取引です' });
    }

    // 同期実行
    return upsertToAccountantExport_(transaction);
  }, 'syncRevenue');
}

// ===========================================
// 取引同期（タイプ自動判定）
// ===========================================

/**
 * 取引を会計士共有シートへ同期（タイプ自動判定）
 * @param {Object} payload - { transactionId }
 * @returns {Object} 結果
 */
function syncToAccountant(payload) {
  const transactionId = payload.transactionId;
  if (!transactionId) {
    return errorResponse('transactionIdが指定されていません');
  }

  const result = getTransactionById(transactionId);
  if (!result.success) return result;

  const transaction = result.transaction;

  if (transaction.type === TRANSACTION_TYPE.EXPENSE) {
    return syncExpense(transactionId);
  } else if (transaction.type === TRANSACTION_TYPE.REVENUE) {
    return syncRevenue(transactionId);
  } else {
    return successResponse({ synced: false, reason: '不明な取引タイプです' });
  }
}

// ===========================================
// 月次再同期
// ===========================================

/**
 * 月次で会計士共有シートを再同期
 * @param {string} month - YYYY-MM形式
 * @returns {Object} 結果
 */
function resyncAccountantByMonth(month) {
  return withErrorHandling(() => {
    logInfo('Resync accountant export started', { month });

    // 会計士エクスポートシートを取得
    const exportSheet = getSheetOrThrow(SHEET_NAMES.ACCOUNTANT_EXPORT);

    // 該当月のエントリを削除
    deleteAccountantExportByMonth_(exportSheet, month);

    // 取引を取得
    const listResult = listTransactions({
      month: month,
      status: TRANSACTION_STATUS.CONFIRMED,
      includeVoid: false
    });

    if (!listResult.success) {
      return listResult;
    }

    const transactions = listResult.items;
    let syncedCount = 0;
    const errors = [];

    for (const transaction of transactions) {
      try {
        const syncResult = upsertToAccountantExport_(transaction);
        if (syncResult.synced) {
          syncedCount++;
        }
      } catch (e) {
        errors.push({ id: transaction.id, error: e.message });
        logWarn('Failed to sync transaction', { id: transaction.id, error: e.message });
      }
    }

    // 別スプレッドシートへの同期
    syncToAccountantSpreadsheetByMonth_(month, transactions);

    logInfo('Resync accountant export completed', { month, syncedCount, errors: errors.length });

    return successResponse({
      message: `会計士共有を再同期しました（${syncedCount}件）`,
      count: syncedCount,
      errors: errors.length > 0 ? errors : undefined
    });
  }, 'resyncAccountantByMonth');
}

/**
 * 全件再同期
 */
function resyncAccountantAll() {
  return withErrorHandling(() => {
    logInfo('Resync all accountant export started');

    const exportSheet = getSheetOrThrow(SHEET_NAMES.ACCOUNTANT_EXPORT);

    // 全データクリア（ヘッダー以外）
    const lastRow = getLastRow(exportSheet);
    if (lastRow > 1) {
      exportSheet.getRange(2, 1, lastRow - 1, exportSheet.getLastColumn()).clearContent();
    }

    // 全確定取引を取得
    const listResult = listTransactions({
      status: TRANSACTION_STATUS.CONFIRMED,
      includeVoid: false
    });

    if (!listResult.success) {
      return listResult;
    }

    const transactions = listResult.items;
    let syncedCount = 0;

    for (const transaction of transactions) {
      try {
        const syncResult = upsertToAccountantExport_(transaction);
        if (syncResult.synced) {
          syncedCount++;
        }
      } catch (e) {
        logWarn('Failed to sync transaction', { id: transaction.id, error: e.message });
      }
    }

    logInfo('Resync all accountant export completed', { syncedCount });

    SpreadsheetApp.getUi().alert(`会計士共有を再同期しました（${syncedCount}件）`);

    return successResponse({
      message: `会計士共有を再同期しました（${syncedCount}件）`,
      count: syncedCount
    });
  }, 'resyncAccountantAll');
}

// ===========================================
// 内部関数
// ===========================================

/**
 * 会計士エクスポートシートへUpsert
 */
function upsertToAccountantExport_(transaction) {
  const exportSheet = getSheetOrThrow(SHEET_NAMES.ACCOUNTANT_EXPORT);
  const now = formatDateTime(getNow());

  // 証憑URL表示設定
  const showReceipt = getSetting('SHOW_RECEIPT_TO_ACCOUNTANT', 'true') === 'true';

  // 行データ作成
  const row = [
    transaction.id,                          // transaction_id
    transaction.date,                        // 取引日
    transaction.accountTitle,                // 勘定科目
    Math.abs(transaction.amount),            // 金額（正の値）
    transaction.vendor || '',                // 取引先
    transaction.description,                 // 摘要
    LABELS.PAYMENT_METHOD[transaction.paymentMethod] || transaction.paymentMethod || '', // 支払方法
    showReceipt ? (transaction.receiptUrl || '') : '', // 証憑URL
    transaction.memo || '',                  // メモ
    LABELS.TRANSACTION_STATUS[transaction.status] || transaction.status, // ステータス
    now                                      // synced_at
  ];

  // 既存行を検索
  const lastRow = getLastRow(exportSheet);
  let targetRow = lastRow + 1;

  if (lastRow >= 2) {
    const ids = exportSheet.getRange(2, COLS.ACCOUNTANT_EXPORT.TRANSACTION_ID, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0] === transaction.id) {
        targetRow = i + 2;
        break;
      }
    }
  }

  // 書き込み
  exportSheet.getRange(targetRow, 1, 1, row.length).setValues([row]);

  logDebug('Upserted to accountant export', { transactionId: transaction.id, row: targetRow });

  return { synced: true, row: targetRow };
}

/**
 * 会計士エクスポートシートから削除
 */
function removeFromAccountantExport_(transactionId) {
  try {
    const exportSheet = getSheet(SHEET_NAMES.ACCOUNTANT_EXPORT);
    if (!exportSheet) return successResponse({ synced: false });

    const lastRow = getLastRow(exportSheet);
    if (lastRow < 2) return successResponse({ synced: false });

    const ids = exportSheet.getRange(2, COLS.ACCOUNTANT_EXPORT.TRANSACTION_ID, lastRow - 1, 1).getValues();

    for (let i = ids.length - 1; i >= 0; i--) {
      if (ids[i][0] === transactionId) {
        exportSheet.deleteRow(i + 2);
        logInfo('Removed from accountant export', { transactionId });
        return successResponse({ synced: true, removed: true });
      }
    }

    return successResponse({ synced: false });
  } catch (e) {
    logWarn('Failed to remove from accountant export', e);
    return successResponse({ synced: false });
  }
}

/**
 * 月指定でエントリを削除
 */
function deleteAccountantExportByMonth_(sheet, month) {
  const lastRow = getLastRow(sheet);
  if (lastRow < 2) return;

  const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues(); // transaction_id, date

  // 後ろから削除（インデックスずれ防止）
  for (let i = data.length - 1; i >= 0; i--) {
    const date = data[i][1];
    if (formatMonth(date) === month) {
      sheet.deleteRow(i + 2);
    }
  }
}

/**
 * 別の会計士共有スプレッドシートへ同期（月次）
 */
function syncToAccountantSpreadsheetByMonth_(month, transactions) {
  const accountantSheetId = getAccountantSheetId();
  if (!accountantSheetId) return;

  try {
    const accountantSS = SpreadsheetApp.openById(accountantSheetId);

    // 経費シートに同期
    const expenseSheet = accountantSS.getSheetByName(ACCOUNTANT_SHEET_NAMES.EXPENSES);
    if (expenseSheet) {
      syncTransactionsToAccountantSheet_(
        expenseSheet,
        transactions.filter(t => t.type === TRANSACTION_TYPE.EXPENSE),
        month
      );
    }

    // 売上シートに同期（もし必要なら）
    const revenueSheet = accountantSS.getSheetByName(ACCOUNTANT_SHEET_NAMES.REVENUE);
    if (revenueSheet) {
      syncTransactionsToAccountantSheet_(
        revenueSheet,
        transactions.filter(t => t.type === TRANSACTION_TYPE.REVENUE),
        month
      );
    }

  } catch (e) {
    logWarn('Failed to sync to accountant spreadsheet', e);
  }
}

/**
 * 会計士スプレッドシートの特定シートへ同期
 */
function syncTransactionsToAccountantSheet_(sheet, transactions, month) {
  if (transactions.length === 0) return;

  const showReceipt = getSetting('SHOW_RECEIPT_TO_ACCOUNTANT', 'true') === 'true';
  const startRow = ACCOUNTANT_DATA_START_ROW;

  // 該当月のデータを削除（列Aの日付で判断）
  const lastRow = sheet.getLastRow();
  if (lastRow >= startRow) {
    const dates = sheet.getRange(startRow, COLS.ACCOUNTANT.DATE, lastRow - startRow + 1, 1).getValues();
    for (let i = dates.length - 1; i >= 0; i--) {
      if (formatMonth(dates[i][0]) === month) {
        sheet.deleteRow(startRow + i);
      }
    }
  }

  // データを追加
  const rows = transactions.map(t => [
    t.date,
    t.accountTitle,
    Math.abs(t.amount),
    t.vendor || '',
    t.description,
    LABELS.PAYMENT_METHOD[t.paymentMethod] || t.paymentMethod || '',
    showReceipt ? (t.receiptUrl || '') : '',
    t.memo || '',
    LABELS.TRANSACTION_STATUS[t.status] || t.status
  ]);

  const newStartRow = Math.max(startRow, sheet.getLastRow() + 1);
  if (rows.length > 0) {
    sheet.getRange(newStartRow, COLS.ACCOUNTANT.DATE, rows.length, rows[0].length).setValues(rows);
  }
}
