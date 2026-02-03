/**
 * SkyBlueEarthJapan 経費管理アプリ
 * AuditRepository.gs - 監査ログ
 *
 * Phase 1: DBアクセス層
 */

// ===========================================
// 監査ログ書き込み
// ===========================================

/**
 * 監査ログを書き込み
 * @param {Object} params - ログパラメータ
 * @param {string} params.transactionId - 取引ID
 * @param {string} params.action - アクション（create/update/void）
 * @param {Object|null} params.before - 変更前データ
 * @param {Object} params.after - 変更後データ
 * @param {string[]} params.changedFields - 変更フィールド配列
 * @returns {Object} 結果
 */
function writeAuditLog(params) {
  try {
    const sheet = getSheet(SHEET_NAMES.AUDIT_LOG);
    if (!sheet) {
      logWarn('Audit log sheet not found');
      return;
    }

    const id = generateUUID();
    const now = formatDateTime(getNow());

    const row = [
      id,                                              // audit_id
      params.transactionId,                            // transaction_id
      params.action,                                   // action
      params.before ? safeJsonStringify(params.before) : '', // before_json
      params.after ? safeJsonStringify(params.after) : '',   // after_json
      params.changedFields ? params.changedFields.join(',') : '', // changed_fields
      getEditorEmail_(),                               // editor
      now                                              // timestamp
    ];

    sheet.appendRow(row);

    logDebug('Audit log written', {
      auditId: id,
      transactionId: params.transactionId,
      action: params.action
    });

  } catch (error) {
    logError('Failed to write audit log', error);
    // 監査ログの失敗で取引を止めない
  }
}

// ===========================================
// 監査ログ取得
// ===========================================

/**
 * 取引IDで監査ログを取得
 * @param {string} transactionId - 取引ID
 * @returns {Object} 結果
 */
function getAuditLogsByTransaction(transactionId) {
  return withErrorHandling(() => {
    const sheet = getSheetOrThrow(SHEET_NAMES.AUDIT_LOG);
    const lastRow = getLastRow(sheet);

    if (lastRow < 2) {
      return successResponse({ logs: [] });
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    const logs = [];

    for (const row of data) {
      if (row[COLS.AUDIT_LOG.TRANSACTION_ID - 1] === transactionId) {
        logs.push({
          auditId: row[COLS.AUDIT_LOG.ID - 1],
          transactionId: row[COLS.AUDIT_LOG.TRANSACTION_ID - 1],
          action: row[COLS.AUDIT_LOG.ACTION - 1],
          before: safeJsonParse(row[COLS.AUDIT_LOG.BEFORE_JSON - 1]),
          after: safeJsonParse(row[COLS.AUDIT_LOG.AFTER_JSON - 1]),
          changedFields: row[COLS.AUDIT_LOG.CHANGED_FIELDS - 1]
            ? row[COLS.AUDIT_LOG.CHANGED_FIELDS - 1].split(',')
            : [],
          editor: row[COLS.AUDIT_LOG.EDITOR - 1],
          timestamp: row[COLS.AUDIT_LOG.TIMESTAMP - 1]
        });
      }
    }

    // 新しい順にソート
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return successResponse({ logs });
  }, 'getAuditLogsByTransaction');
}

/**
 * 期間で監査ログを取得
 * @param {Object} params - パラメータ
 * @param {string} params.startDate - 開始日（YYYY-MM-DD）
 * @param {string} params.endDate - 終了日（YYYY-MM-DD）
 * @param {string} params.action - アクションフィルタ（省略可）
 * @returns {Object} 結果
 */
function getAuditLogsByDateRange(params) {
  return withErrorHandling(() => {
    const sheet = getSheetOrThrow(SHEET_NAMES.AUDIT_LOG);
    const lastRow = getLastRow(sheet);

    if (lastRow < 2) {
      return successResponse({ logs: [] });
    }

    const startDate = params.startDate ? new Date(params.startDate) : null;
    const endDate = params.endDate ? new Date(params.endDate + 'T23:59:59') : null;

    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    const logs = [];

    for (const row of data) {
      const timestamp = new Date(row[COLS.AUDIT_LOG.TIMESTAMP - 1]);
      const action = row[COLS.AUDIT_LOG.ACTION - 1];

      // 日付フィルタ
      if (startDate && timestamp < startDate) continue;
      if (endDate && timestamp > endDate) continue;

      // アクションフィルタ
      if (params.action && action !== params.action) continue;

      logs.push({
        auditId: row[COLS.AUDIT_LOG.ID - 1],
        transactionId: row[COLS.AUDIT_LOG.TRANSACTION_ID - 1],
        action: action,
        before: safeJsonParse(row[COLS.AUDIT_LOG.BEFORE_JSON - 1]),
        after: safeJsonParse(row[COLS.AUDIT_LOG.AFTER_JSON - 1]),
        changedFields: row[COLS.AUDIT_LOG.CHANGED_FIELDS - 1]
          ? row[COLS.AUDIT_LOG.CHANGED_FIELDS - 1].split(',')
          : [],
        editor: row[COLS.AUDIT_LOG.EDITOR - 1],
        timestamp: row[COLS.AUDIT_LOG.TIMESTAMP - 1]
      });
    }

    // 新しい順にソート
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return successResponse({ logs, total: logs.length });
  }, 'getAuditLogsByDateRange');
}

// ===========================================
// ヘルパー
// ===========================================

/**
 * 編集者のメールアドレスを取得
 */
function getEditorEmail_() {
  try {
    return Session.getActiveUser().getEmail() || 'system';
  } catch (e) {
    return 'system';
  }
}
