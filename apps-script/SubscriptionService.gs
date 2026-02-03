/**
 * SkyBlueEarthJapan 経費管理アプリ
 * SubscriptionService.gs - サブスク（固定費）管理
 *
 * Phase 2.5: サブスク台帳（DB+CRUD）
 * Phase 2.6: 月次自動計上
 */

// ===========================================
// Phase 2.5: サブスク台帳 CRUD
// ===========================================

/**
 * サブスク一覧を取得
 * @param {boolean} activeOnly - 有効のみ取得
 * @returns {Object} 結果
 */
function listSubscriptions(activeOnly = true) {
  return withErrorHandling(() => {
    const sheet = getSheet(SHEET_NAMES.SUBSCRIPTIONS);
    if (!sheet) {
      return successResponse({ subscriptions: [] });
    }

    const lastRow = getLastRow(sheet);
    if (lastRow < 2) {
      return successResponse({ subscriptions: [] });
    }

    const lastCol = getLastColumn(sheet);
    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    let subscriptions = data.map(row => rowToSubscription_(row));

    if (activeOnly) {
      subscriptions = subscriptions.filter(s => s.active === true);
    }

    // タイトル順でソート
    subscriptions.sort((a, b) => a.title.localeCompare(b.title, 'ja'));

    return successResponse({ subscriptions });
  }, 'listSubscriptions');
}

/**
 * サブスクを1件取得
 * @param {string} subscriptionId - サブスクID
 * @returns {Object} 結果
 */
function getSubscription(subscriptionId) {
  return withErrorHandling(() => {
    const sheet = getSheetOrThrow(SHEET_NAMES.SUBSCRIPTIONS);
    const rowNum = findRowById(sheet, subscriptionId, COLS.SUBSCRIPTIONS.ID);

    if (rowNum === -1) {
      throw notFoundError('サブスク');
    }

    const row = sheet.getRange(rowNum, 1, 1, getLastColumn(sheet)).getValues()[0];
    return successResponse({ subscription: rowToSubscription_(row) });
  }, 'getSubscription');
}

/**
 * サブスクを作成
 * @param {Object} data - サブスクデータ
 * @returns {Object} 結果
 */
function createSubscription(data) {
  return withErrorHandling(() => {
    // バリデーション
    validateSubscriptionData_(data);

    const sheet = getSheetOrThrow(SHEET_NAMES.SUBSCRIPTIONS);
    const id = generateUUID();
    const now = formatDateTime(getNow());

    const row = [
      id,                                         // subscription_id
      safeTrim(data.title),                       // title
      safeTrim(data.description) || '',           // description
      safeTrim(data.vendor) || '',                // vendor
      parseAmount(data.amount),                   // amount
      data.billing_cycle || BILLING_CYCLE.MONTHLY, // billing_cycle
      safeTrim(data.payment_card) || '',          // payment_card
      data.payment_method || PAYMENT_METHOD.CARD, // payment_method
      safeTrim(data.account_title),               // account_title
      data.active !== false,                      // active
      data.start_date || getToday(),              // start_date
      data.end_date || '',                        // end_date
      safeTrim(data.notes) || '',                 // notes
      now,                                        // created_at
      now                                         // updated_at
    ];

    sheet.appendRow(row);

    logInfo('Subscription created', { id, title: data.title });

    return successResponse({
      id: id,
      message: 'サブスクを登録しました'
    });
  }, 'createSubscription');
}

/**
 * サブスクを更新
 * @param {string} subscriptionId - サブスクID
 * @param {Object} updates - 更新データ
 * @returns {Object} 結果
 */
function updateSubscription(subscriptionId, updates) {
  return withErrorHandling(() => {
    if (!subscriptionId) {
      throw requiredFieldError('subscriptionId');
    }

    const sheet = getSheetOrThrow(SHEET_NAMES.SUBSCRIPTIONS);
    const rowNum = findRowById(sheet, subscriptionId, COLS.SUBSCRIPTIONS.ID);

    if (rowNum === -1) {
      throw notFoundError('サブスク');
    }

    const lastCol = getLastColumn(sheet);
    const currentRow = sheet.getRange(rowNum, 1, 1, lastCol).getValues()[0];
    const now = formatDateTime(getNow());

    // 更新適用
    if (updates.title !== undefined) currentRow[COLS.SUBSCRIPTIONS.TITLE - 1] = safeTrim(updates.title);
    if (updates.description !== undefined) currentRow[COLS.SUBSCRIPTIONS.DESCRIPTION - 1] = safeTrim(updates.description);
    if (updates.vendor !== undefined) currentRow[COLS.SUBSCRIPTIONS.VENDOR - 1] = safeTrim(updates.vendor);
    if (updates.amount !== undefined) currentRow[COLS.SUBSCRIPTIONS.AMOUNT - 1] = parseAmount(updates.amount);
    if (updates.billing_cycle !== undefined) currentRow[COLS.SUBSCRIPTIONS.BILLING_CYCLE - 1] = updates.billing_cycle;
    if (updates.payment_card !== undefined) currentRow[COLS.SUBSCRIPTIONS.PAYMENT_CARD - 1] = safeTrim(updates.payment_card);
    if (updates.payment_method !== undefined) currentRow[COLS.SUBSCRIPTIONS.PAYMENT_METHOD - 1] = updates.payment_method;
    if (updates.account_title !== undefined) currentRow[COLS.SUBSCRIPTIONS.ACCOUNT_TITLE - 1] = safeTrim(updates.account_title);
    if (updates.active !== undefined) currentRow[COLS.SUBSCRIPTIONS.ACTIVE - 1] = updates.active;
    if (updates.start_date !== undefined) currentRow[COLS.SUBSCRIPTIONS.START_DATE - 1] = updates.start_date;
    if (updates.end_date !== undefined) currentRow[COLS.SUBSCRIPTIONS.END_DATE - 1] = updates.end_date;
    if (updates.notes !== undefined) currentRow[COLS.SUBSCRIPTIONS.NOTES - 1] = safeTrim(updates.notes);

    currentRow[COLS.SUBSCRIPTIONS.UPDATED_AT - 1] = now;

    sheet.getRange(rowNum, 1, 1, currentRow.length).setValues([currentRow]);

    logInfo('Subscription updated', { id: subscriptionId });

    return successResponse({
      id: subscriptionId,
      message: 'サブスクを更新しました'
    });
  }, 'updateSubscription');
}

/**
 * サブスクを停止（active=false）
 * @param {string} subscriptionId - サブスクID
 * @returns {Object} 結果
 */
function deactivateSubscription(subscriptionId) {
  return updateSubscription(subscriptionId, { active: false });
}

/**
 * サブスクを有効化（active=true）
 * @param {string} subscriptionId - サブスクID
 * @returns {Object} 結果
 */
function activateSubscription(subscriptionId) {
  return updateSubscription(subscriptionId, { active: true });
}

// ===========================================
// Phase 2.6: 月次自動計上
// ===========================================

/**
 * 月次サブスク計上を実行
 * @param {string} targetMonth - 対象月（YYYY-MM）省略時は当月
 * @returns {Object} 結果
 */
function generateMonthlySubscriptions(targetMonth) {
  return withErrorHandling(() => {
    const month = targetMonth || getCurrentMonth();

    if (!isValidMonthFormat(month)) {
      throw validationError('月形式が不正です（YYYY-MM）');
    }

    logInfo('Monthly subscription posting started', { month });

    // 有効なサブスク一覧を取得
    const listResult = listSubscriptions(true);
    if (!listResult.success) {
      return listResult;
    }

    const subscriptions = listResult.subscriptions.filter(s =>
      s.billingCycle === BILLING_CYCLE.MONTHLY
    );

    let generatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const subscription of subscriptions) {
      try {
        // 二重計上チェック
        if (hasPosting(subscription.id, month)) {
          skippedCount++;
          logDebug('Skipped (already posted)', { subscriptionId: subscription.id, month });
          continue;
        }

        // 開始日チェック
        if (subscription.startDate) {
          const startMonth = formatMonth(parseDate(subscription.startDate));
          if (month < startMonth) {
            skippedCount++;
            continue;
          }
        }

        // 終了日チェック
        if (subscription.endDate) {
          const endMonth = formatMonth(parseDate(subscription.endDate));
          if (month > endMonth) {
            skippedCount++;
            continue;
          }
        }

        // 取引を生成
        const transactionResult = generateTransactionFromSubscription_(subscription, month);
        if (transactionResult.success && transactionResult.id) {
          // 計上履歴を記録
          createPosting(subscription.id, month, transactionResult.id, subscription.amount);
          generatedCount++;
        } else {
          errors.push({ subscriptionId: subscription.id, error: transactionResult.error?.message });
        }
      } catch (e) {
        errors.push({ subscriptionId: subscription.id, error: e.message });
        logWarn('Failed to generate subscription posting', { subscriptionId: subscription.id, error: e.message });
      }
    }

    logInfo('Monthly subscription posting completed', {
      month,
      generated: generatedCount,
      skipped: skippedCount,
      errors: errors.length
    });

    return successResponse({
      message: `サブスク計上が完了しました（${generatedCount}件生成、${skippedCount}件スキップ）`,
      generated: generatedCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors : undefined
    });
  }, 'generateMonthlySubscriptions');
}

/**
 * 月次サブスク計上を再実行（欠損補完）
 * @param {string} month - 対象月（YYYY-MM）
 * @returns {Object} 結果
 */
function resyncMonthlySubscriptions(month) {
  if (!month || !isValidMonthFormat(month)) {
    return errorResponse('月を指定してください（YYYY-MM）');
  }

  logInfo('Resync monthly subscriptions', { month });

  // 該当月のpostingsを削除（取引はそのまま）
  deletePostingsByMonth_(month);

  // 再生成
  return generateMonthlySubscriptions(month);
}

/**
 * 月次サブスク計上をトリガーから実行
 */
function runMonthlySubscriptionPosting() {
  const result = generateMonthlySubscriptions();
  if (result.success) {
    logInfo('Scheduled subscription posting completed', result);
  } else {
    logError('Scheduled subscription posting failed', result.error);
  }
}

// ===========================================
// 計上履歴（Postings）管理
// ===========================================

/**
 * 計上履歴が存在するか確認
 * @param {string} subscriptionId - サブスクID
 * @param {string} month - 月（YYYY-MM）
 * @returns {boolean}
 */
function hasPosting(subscriptionId, month) {
  const sheet = getSheet(SHEET_NAMES.SUBSCRIPTION_POSTINGS);
  if (!sheet) return false;

  const lastRow = getLastRow(sheet);
  if (lastRow < 2) return false;

  const data = sheet.getRange(2, COLS.SUBSCRIPTION_POSTINGS.SUBSCRIPTION_ID, lastRow - 1, 2).getValues();

  for (const row of data) {
    if (row[0] === subscriptionId && row[1] === month) {
      return true;
    }
  }

  return false;
}

/**
 * 計上履歴を作成
 * @param {string} subscriptionId - サブスクID
 * @param {string} month - 月
 * @param {string} transactionId - 生成された取引ID
 * @param {number} amountSnapshot - 計上時の金額
 */
function createPosting(subscriptionId, month, transactionId, amountSnapshot) {
  const sheet = getSheetOrThrow(SHEET_NAMES.SUBSCRIPTION_POSTINGS);
  const id = generateUUID();
  const now = formatDateTime(getNow());

  const row = [
    id,                         // posting_id
    subscriptionId,             // subscription_id
    month,                      // month
    transactionId,              // generated_transaction_id
    getFirstDayOfMonth(month),  // generated_date
    amountSnapshot,             // amount_snapshot
    POSTING_STATUS.GENERATED,   // status
    now                         // created_at
  ];

  sheet.appendRow(row);
}

/**
 * 月指定で計上履歴を削除
 */
function deletePostingsByMonth_(month) {
  const sheet = getSheet(SHEET_NAMES.SUBSCRIPTION_POSTINGS);
  if (!sheet) return;

  const lastRow = getLastRow(sheet);
  if (lastRow < 2) return;

  const months = sheet.getRange(2, COLS.SUBSCRIPTION_POSTINGS.MONTH, lastRow - 1, 1).getValues();

  // 後ろから削除
  for (let i = months.length - 1; i >= 0; i--) {
    if (months[i][0] === month) {
      sheet.deleteRow(i + 2);
    }
  }
}

// ===========================================
// 内部ヘルパー
// ===========================================

/**
 * サブスクから取引を生成
 */
function generateTransactionFromSubscription_(subscription, month) {
  const data = {
    type: TRANSACTION_TYPE.EXPENSE,
    date: getFirstDayOfMonth(month),
    amount: subscription.amount,
    vendor: subscription.vendor || subscription.title,
    description: `${subscription.title}（サブスク）`,
    account_title: subscription.accountTitle,
    payment_method: subscription.paymentMethod || PAYMENT_METHOD.CARD,
    memo: `固定費（サブスク） / カード: ${subscription.paymentCard || '未設定'}`,
    status: TRANSACTION_STATUS.CONFIRMED
  };

  const result = insertTransaction(data);

  // 会計士共有に同期
  if (result.success && result.id) {
    syncExpense(result.id);
  }

  return result;
}

/**
 * サブスクデータのバリデーション
 */
function validateSubscriptionData_(data) {
  const { valid, missing } = validateRequired(data, ['title', 'amount', 'account_title']);

  if (!valid) {
    throw requiredFieldError(missing[0]);
  }

  const amount = parseAmount(data.amount);
  if (amount === null || amount <= 0) {
    throw validationError('金額は1以上の数値を入力してください');
  }
}

/**
 * 行データをサブスクオブジェクトに変換
 */
function rowToSubscription_(row) {
  return {
    id: row[COLS.SUBSCRIPTIONS.ID - 1],
    title: row[COLS.SUBSCRIPTIONS.TITLE - 1],
    description: row[COLS.SUBSCRIPTIONS.DESCRIPTION - 1],
    vendor: row[COLS.SUBSCRIPTIONS.VENDOR - 1],
    amount: row[COLS.SUBSCRIPTIONS.AMOUNT - 1],
    billingCycle: row[COLS.SUBSCRIPTIONS.BILLING_CYCLE - 1],
    paymentCard: row[COLS.SUBSCRIPTIONS.PAYMENT_CARD - 1],
    paymentMethod: row[COLS.SUBSCRIPTIONS.PAYMENT_METHOD - 1],
    accountTitle: row[COLS.SUBSCRIPTIONS.ACCOUNT_TITLE - 1],
    active: row[COLS.SUBSCRIPTIONS.ACTIVE - 1],
    startDate: formatDate(row[COLS.SUBSCRIPTIONS.START_DATE - 1]),
    endDate: formatDate(row[COLS.SUBSCRIPTIONS.END_DATE - 1]),
    notes: row[COLS.SUBSCRIPTIONS.NOTES - 1],
    createdAt: row[COLS.SUBSCRIPTIONS.CREATED_AT - 1],
    updatedAt: row[COLS.SUBSCRIPTIONS.UPDATED_AT - 1]
  };
}

// ===========================================
// トリガー設定
// ===========================================

/**
 * 月次トリガーを設定
 */
function setupMonthlySubscriptionTrigger() {
  // 既存のトリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'runMonthlySubscriptionPosting') {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // 毎月1日 AM 9:00 に実行
  ScriptApp.newTrigger('runMonthlySubscriptionPosting')
    .timeBased()
    .onMonthDay(1)
    .atHour(9)
    .create();

  logInfo('Monthly subscription trigger set up');
}

/**
 * 月次トリガーを削除
 */
function removeMonthlySubscriptionTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'runMonthlySubscriptionPosting') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  logInfo('Monthly subscription trigger removed');
}
