/**
 * SkyBlueEarthJapan 経費管理アプリ
 * AnalyticsService.gs - 分析・集計サービス
 */

// ===========================================
// 月次サマリー
// ===========================================

/**
 * 月次サマリーを取得
 * @param {Object} payload - { year, month }
 * @returns {Object} サマリー
 */
function getMonthlySummary(payload) {
  try {
    const { year, month } = payload;

    if (!year || !month) {
      return errorResponse('年月を指定してください');
    }

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    const sheet = getSheet(SHEETS.TRANSACTIONS);
    if (!sheet) {
      return successResponse({ revenue: 0, expense: 0, profit: 0 });
    }

    const lastRow = getLastRow(sheet);
    if (lastRow < 2) {
      return successResponse({ revenue: 0, expense: 0, profit: 0 });
    }

    const data = sheet.getRange(2, 1, lastRow - 1, getLastColumn(sheet)).getValues();

    let revenue = 0;
    let expense = 0;

    for (const row of data) {
      const rowMonth = row[COLS_TRANSACTIONS.MONTH - 1];
      const status = row[COLS_TRANSACTIONS.STATUS - 1];
      const type = row[COLS_TRANSACTIONS.TYPE - 1];
      const amount = Number(row[COLS_TRANSACTIONS.AMOUNT - 1]) || 0;

      if (rowMonth === monthStr && status === TRANSACTION_STATUS.CONFIRMED) {
        if (type === TRANSACTION_TYPE.REVENUE) {
          revenue += amount;
        } else if (type === TRANSACTION_TYPE.EXPENSE) {
          expense += amount;
        }
      }
    }

    const profit = revenue - expense;

    return successResponse({
      month: monthStr,
      revenue: revenue,
      expense: expense,
      profit: profit
    });

  } catch (error) {
    logError('getMonthlySummary error', error);
    return errorResponse(error.message);
  }
}

// ===========================================
// カテゴリ別内訳
// ===========================================

/**
 * カテゴリ別経費内訳を取得
 * @param {Object} payload - { year, month }
 * @returns {Object} カテゴリ別内訳
 */
function getCategoryBreakdown(payload) {
  try {
    const { year, month } = payload;

    if (!year || !month) {
      return errorResponse('年月を指定してください');
    }

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    const sheet = getSheet(SHEETS.TRANSACTIONS);
    if (!sheet) {
      return successResponse({ breakdown: [] });
    }

    const lastRow = getLastRow(sheet);
    if (lastRow < 2) {
      return successResponse({ breakdown: [] });
    }

    const data = sheet.getRange(2, 1, lastRow - 1, getLastColumn(sheet)).getValues();

    const categoryTotals = {};

    for (const row of data) {
      const rowMonth = row[COLS_TRANSACTIONS.MONTH - 1];
      const status = row[COLS_TRANSACTIONS.STATUS - 1];
      const type = row[COLS_TRANSACTIONS.TYPE - 1];
      const amount = Number(row[COLS_TRANSACTIONS.AMOUNT - 1]) || 0;
      const accountTitle = row[COLS_TRANSACTIONS.ACCOUNT_TITLE - 1];

      if (rowMonth === monthStr &&
        status === TRANSACTION_STATUS.CONFIRMED &&
        type === TRANSACTION_TYPE.EXPENSE) {
        if (!categoryTotals[accountTitle]) {
          categoryTotals[accountTitle] = 0;
        }
        categoryTotals[accountTitle] += amount;
      }
    }

    // 配列に変換してソート
    const breakdown = Object.entries(categoryTotals)
      .map(([account_title, amount]) => ({ account_title, amount }))
      .sort((a, b) => b.amount - a.amount);

    return successResponse({ breakdown: breakdown });

  } catch (error) {
    logError('getCategoryBreakdown error', error);
    return errorResponse(error.message);
  }
}

// ===========================================
// 月次推移
// ===========================================

/**
 * 月次推移を取得（過去N月分）
 * @param {Object} payload - { months }
 * @returns {Object} 月次推移
 */
function getMonthlyTrend(payload) {
  try {
    const months = payload.months || 12;

    const sheet = getSheet(SHEETS.TRANSACTIONS);
    if (!sheet) {
      return successResponse({ trend: [] });
    }

    const lastRow = getLastRow(sheet);
    if (lastRow < 2) {
      return successResponse({ trend: [] });
    }

    const data = sheet.getRange(2, 1, lastRow - 1, getLastColumn(sheet)).getValues();

    // 過去N月のリストを作成
    const now = getNow();
    const monthList = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthList.push(formatMonth(d));
    }

    // 各月の集計
    const monthlyData = {};
    for (const m of monthList) {
      monthlyData[m] = { revenue: 0, expense: 0, profit: 0 };
    }

    for (const row of data) {
      const rowMonth = row[COLS_TRANSACTIONS.MONTH - 1];
      const status = row[COLS_TRANSACTIONS.STATUS - 1];
      const type = row[COLS_TRANSACTIONS.TYPE - 1];
      const amount = Number(row[COLS_TRANSACTIONS.AMOUNT - 1]) || 0;

      if (monthlyData[rowMonth] && status === TRANSACTION_STATUS.CONFIRMED) {
        if (type === TRANSACTION_TYPE.REVENUE) {
          monthlyData[rowMonth].revenue += amount;
        } else if (type === TRANSACTION_TYPE.EXPENSE) {
          monthlyData[rowMonth].expense += amount;
        }
      }
    }

    // 利益を計算
    const trend = monthList.map(m => {
      const d = monthlyData[m];
      return {
        month: m,
        revenue: d.revenue,
        expense: d.expense,
        profit: d.revenue - d.expense
      };
    });

    return successResponse({ trend: trend });

  } catch (error) {
    logError('getMonthlyTrend error', error);
    return errorResponse(error.message);
  }
}

// ===========================================
// 概算税額
// ===========================================

/**
 * 概算税額を計算
 * @param {Object} payload - オプション
 * @returns {Object} 概算税額
 */
function estimateTax(payload) {
  try {
    // 今月のサマリーを取得
    const now = getNow();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const summaryResult = getMonthlySummary({ year, month });

    if (!summaryResult.success) {
      return summaryResult;
    }

    const monthlyProfit = summaryResult.profit;

    // 年換算（単純に12倍）
    const annualIncome = monthlyProfit * 12;

    // 概算所得税（簡易計算）
    // 実際の税率テーブルに基づく概算
    const incomeTax = calculateIncomeTax(annualIncome);

    // 概算住民税（約10%）
    const residentTax = Math.max(0, Math.floor(annualIncome * 0.1));

    return successResponse({
      monthlyProfit: monthlyProfit,
      annualIncome: annualIncome,
      incomeTax: incomeTax,
      residentTax: residentTax,
      note: '概算です。最終的な税額は会計士・税理士の判断に従ってください。'
    });

  } catch (error) {
    logError('estimateTax error', error);
    return errorResponse(error.message);
  }
}

/**
 * 概算所得税を計算（簡易版）
 * @param {number} income - 年間所得
 * @returns {number} 概算所得税
 */
function calculateIncomeTax(income) {
  if (income <= 0) return 0;

  // 基礎控除（48万円）を引く
  const taxableIncome = Math.max(0, income - 480000);

  // 簡易税率テーブル（2024年版を簡略化）
  // 実際の計算はより複雑
  let tax = 0;

  if (taxableIncome <= 1950000) {
    tax = taxableIncome * 0.05;
  } else if (taxableIncome <= 3300000) {
    tax = taxableIncome * 0.10 - 97500;
  } else if (taxableIncome <= 6950000) {
    tax = taxableIncome * 0.20 - 427500;
  } else if (taxableIncome <= 9000000) {
    tax = taxableIncome * 0.23 - 636000;
  } else if (taxableIncome <= 18000000) {
    tax = taxableIncome * 0.33 - 1536000;
  } else if (taxableIncome <= 40000000) {
    tax = taxableIncome * 0.40 - 2796000;
  } else {
    tax = taxableIncome * 0.45 - 4796000;
  }

  // 復興特別所得税（2.1%）
  tax = tax * 1.021;

  return Math.max(0, Math.floor(tax));
}

// ===========================================
// 前月比較
// ===========================================

/**
 * 前月との比較を取得
 * @param {Object} payload - { year, month }
 * @returns {Object} 前月比較
 */
function getMonthComparison(payload) {
  try {
    const { year, month } = payload;

    // 当月
    const currentResult = getMonthlySummary({ year, month });
    if (!currentResult.success) {
      return currentResult;
    }

    // 前月
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear = year - 1;
    }

    const prevResult = getMonthlySummary({ year: prevYear, month: prevMonth });
    if (!prevResult.success) {
      return prevResult;
    }

    // 差分と変化率を計算
    const calcChange = (current, previous) => {
      const diff = current - previous;
      const rate = previous !== 0 ? Math.round((diff / previous) * 100) : (current > 0 ? 100 : 0);
      return { diff, rate };
    };

    return successResponse({
      current: currentResult,
      previous: prevResult,
      comparison: {
        revenue: calcChange(currentResult.revenue, prevResult.revenue),
        expense: calcChange(currentResult.expense, prevResult.expense),
        profit: calcChange(currentResult.profit, prevResult.profit)
      }
    });

  } catch (error) {
    logError('getMonthComparison error', error);
    return errorResponse(error.message);
  }
}

// ===========================================
// ダッシュボード更新
// ===========================================

/**
 * ダッシュボードシートを更新
 * @param {string} monthStr - YYYY-MM形式の月
 */
function updateDashboardSheet(monthStr) {
  try {
    const sheet = getSheet(SHEETS.DASHBOARD);
    if (!sheet) return;

    const [year, month] = monthStr.split('-').map(Number);

    const summary = getMonthlySummary({ year, month });
    const breakdown = getCategoryBreakdown({ year, month });

    if (!summary.success) return;

    // 既存の行を検索
    const lastRow = getLastRow(sheet);
    let targetRow = lastRow + 1;

    if (lastRow >= 2) {
      const months = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < months.length; i++) {
        if (months[i][0] === monthStr) {
          targetRow = i + 2;
          break;
        }
      }
    }

    // 行データを書き込み
    const row = [
      monthStr,
      summary.revenue,
      summary.expense,
      summary.profit,
      breakdown.success ? JSON.stringify(breakdown.breakdown) : '[]',
      formatDateTime(getNow())
    ];

    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);

  } catch (error) {
    logError('updateDashboardSheet error', error);
  }
}
