/**
 * SkyBlueEarthJapan 経費管理アプリ
 * MasterRepository.gs - マスタデータ管理
 *
 * Phase 1: DBアクセス層
 */

// ===========================================
// 勘定科目
// ===========================================

/**
 * 勘定科目一覧を取得
 * @param {boolean} activeOnly - 有効のみ取得（デフォルトtrue）
 * @returns {Object} 結果
 */
function getAccountTitles(activeOnly = true) {
  return withErrorHandling(() => {
    const sheet = getSheetOrThrow(SHEET_NAMES.ACCOUNT_TITLES);
    const lastRow = getLastRow(sheet);

    if (lastRow < 2) {
      return successResponse({ accountTitles: [] });
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    let accountTitles = data.map(row => ({
      id: row[COLS.ACCOUNT_TITLES.ID - 1],
      name: row[COLS.ACCOUNT_TITLES.NAME - 1],
      type: row[COLS.ACCOUNT_TITLES.TYPE - 1],
      description: row[COLS.ACCOUNT_TITLES.DESCRIPTION - 1],
      keywords: row[COLS.ACCOUNT_TITLES.KEYWORDS - 1],
      defaultConfidence: row[COLS.ACCOUNT_TITLES.DEFAULT_CONFIDENCE - 1],
      active: row[COLS.ACCOUNT_TITLES.ACTIVE - 1],
      sortOrder: row[COLS.ACCOUNT_TITLES.SORT_ORDER - 1]
    }));

    if (activeOnly) {
      accountTitles = accountTitles.filter(at => at.active === true);
    }

    // sortOrderでソート
    accountTitles.sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));

    return successResponse({ accountTitles });
  }, 'getAccountTitles');
}

/**
 * 勘定科目を名前で取得
 * @param {string} name - 勘定科目名
 * @returns {Object|null}
 */
function getAccountTitleByName(name) {
  const result = getAccountTitles(false);
  if (!result.success) return null;

  return result.accountTitles.find(at => at.name === name) || null;
}

/**
 * 勘定科目を追加
 * @param {Object} data - 勘定科目データ
 * @returns {Object} 結果
 */
function addAccountTitle(data) {
  return withErrorHandling(() => {
    const { valid, missing } = validateRequired(data, ['name', 'type']);
    if (!valid) {
      throw requiredFieldError(missing[0]);
    }

    const sheet = getSheetOrThrow(SHEET_NAMES.ACCOUNT_TITLES);

    // ID生成
    const id = 'AT' + generateShortId();

    const row = [
      id,
      data.name,
      data.type,
      data.description || '',
      data.keywords || '',
      data.defaultConfidence || 0.7,
      data.active !== false,
      data.sortOrder || 50
    ];

    sheet.appendRow(row);

    return successResponse({ id, message: '勘定科目を追加しました' });
  }, 'addAccountTitle');
}

// ===========================================
// 取引先
// ===========================================

/**
 * 取引先一覧を取得
 * @param {boolean} activeOnly - 有効のみ取得
 * @returns {Object} 結果
 */
function getVendors(activeOnly = true) {
  return withErrorHandling(() => {
    const sheet = getSheet(SHEET_NAMES.VENDORS);
    if (!sheet) {
      return successResponse({ vendors: [] });
    }

    const lastRow = getLastRow(sheet);
    if (lastRow < 2) {
      return successResponse({ vendors: [] });
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    let vendors = data.map(row => ({
      id: row[COLS.VENDORS.ID - 1],
      name: row[COLS.VENDORS.NAME - 1],
      defaultAccountTitle: row[COLS.VENDORS.DEFAULT_ACCOUNT_TITLE - 1],
      usageCount: row[COLS.VENDORS.USAGE_COUNT - 1] || 0,
      lastUsedAt: row[COLS.VENDORS.LAST_USED_AT - 1],
      active: row[COLS.VENDORS.ACTIVE - 1]
    }));

    if (activeOnly) {
      vendors = vendors.filter(v => v.active !== false);
    }

    // 使用回数でソート（よく使う順）
    vendors.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));

    return successResponse({ vendors });
  }, 'getVendors');
}

/**
 * 取引先ヒント（AI用）
 * @returns {Object} 結果
 */
function getVendorHints() {
  const result = getVendors(true);
  if (!result.success) return result;

  // 上位20件のみ返す
  const hints = result.vendors.slice(0, 20).map(v => ({
    vendor: v.name,
    default_account_title: v.defaultAccountTitle
  }));

  return successResponse({ vendors: hints });
}

/**
 * 取引先を追加
 * @param {Object} data - 取引先データ
 * @returns {Object} 結果
 */
function addVendor(data) {
  return withErrorHandling(() => {
    if (!data.name) {
      throw requiredFieldError('name');
    }

    const sheet = getSheetOrThrow(SHEET_NAMES.VENDORS);

    // 重複チェック
    const existing = getVendors(false);
    if (existing.success && existing.vendors.some(v => v.name === data.name)) {
      return successResponse({ message: '既に登録されています' });
    }

    const id = 'V' + generateShortId();
    const now = formatDateTime(getNow());

    const row = [
      id,
      data.name,
      data.defaultAccountTitle || '',
      0,
      now,
      true
    ];

    sheet.appendRow(row);

    return successResponse({ id, message: '取引先を追加しました' });
  }, 'addVendor');
}

/**
 * 取引先を更新
 * @param {string} vendorId - 取引先ID
 * @param {Object} updates - 更新データ
 * @returns {Object} 結果
 */
function updateVendor(vendorId, updates) {
  return withErrorHandling(() => {
    const sheet = getSheetOrThrow(SHEET_NAMES.VENDORS);
    const rowNum = findRowById(sheet, vendorId, COLS.VENDORS.ID);

    if (rowNum === -1) {
      throw notFoundError('取引先');
    }

    const currentRow = sheet.getRange(rowNum, 1, 1, 6).getValues()[0];

    if (updates.name !== undefined) currentRow[COLS.VENDORS.NAME - 1] = updates.name;
    if (updates.defaultAccountTitle !== undefined) currentRow[COLS.VENDORS.DEFAULT_ACCOUNT_TITLE - 1] = updates.defaultAccountTitle;
    if (updates.active !== undefined) currentRow[COLS.VENDORS.ACTIVE - 1] = updates.active;

    sheet.getRange(rowNum, 1, 1, 6).setValues([currentRow]);

    return successResponse({ message: '取引先を更新しました' });
  }, 'updateVendor');
}
