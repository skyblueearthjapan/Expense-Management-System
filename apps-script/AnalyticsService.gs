/**
 * SkyBlueEarthJapan 経費管理アプリ
 * AnalyticsService.gs - 分析・集計
 */

// ===========================================
// 月次サマリー
// ===========================================

/**
 * 月次サマリーを取得
 * @param {Object} params - { year, month }
 * @returns {Object} 結果
 */
function getMonthlySummary(params) {
  return withErrorHandling(() => {
    const { year, month } = params;
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    // 取引を取得
    const listResult = listTransactions({
      month: monthStr,
      status: TRANSACTION_STATUS.CONFIRMED
    });

    if (!listResult.success) {
      return listResult;
    }

    let totalRevenue = 0;
    let totalExpense = 0;

    for (const t of listResult.items) {
      const amount = Number(t.amount) || 0;
      if (t.type === TRANSACTION_TYPE.REVENUE) {
        totalRevenue += amount;
      } else if (t.type === TRANSACTION_TYPE.EXPENSE) {
        totalExpense += amount;
      }
    }

    const profit = totalRevenue - totalExpense;

    return successResponse({
      month: monthStr,
      revenue: totalRevenue,
      expense: totalExpense,
      profit: profit,
      transactionCount: listResult.items.length
    });
  }, 'getMonthlySummary');
}

// ===========================================
// カテゴリ別内訳
// ===========================================

/**
 * カテゴリ別経費内訳を取得
 * @param {Object} params - { year, month }
 * @returns {Object} 結果
 */
function getCategoryBreakdown(params) {
  return withErrorHandling(() => {
    const { year, month } = params;
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    // 経費のみ取得
    const listResult = listTransactions({
      month: monthStr,
      type: TRANSACTION_TYPE.EXPENSE,
      status: TRANSACTION_STATUS.CONFIRMED
    });

    if (!listResult.success) {
      return listResult;
    }

    // カテゴリ別に集計
    const categoryMap = {};

    for (const t of listResult.items) {
      const category = t.accountTitle || '未分類';
      const amount = Number(t.amount) || 0;

      if (!categoryMap[category]) {
        categoryMap[category] = { account_title: category, amount: 0, count: 0 };
      }
      categoryMap[category].amount += amount;
      categoryMap[category].count++;
    }

    // 金額順でソート
    const breakdown = Object.values(categoryMap).sort((a, b) => b.amount - a.amount);

    // 合計
    const total = breakdown.reduce((sum, item) => sum + item.amount, 0);

    // パーセント計算
    for (const item of breakdown) {
      item.percentage = total > 0 ? Math.round(item.amount / total * 100) : 0;
    }

    return successResponse({
      month: monthStr,
      breakdown: breakdown,
      total: total
    });
  }, 'getCategoryBreakdown');
}

// ===========================================
// 年間推移
// ===========================================

/**
 * 12ヶ月推移を取得
 * @param {Object} params - { year } 省略時は当年
 * @returns {Object} 結果
 */
function getYearlyTrend(params = {}) {
  return withErrorHandling(() => {
    const year = params.year || new Date().getFullYear();
    const trend = [];

    for (let month = 1; month <= 12; month++) {
      const summaryResult = getMonthlySummary({ year, month });
      if (summaryResult.success) {
        trend.push({
          month: `${year}-${String(month).padStart(2, '0')}`,
          revenue: summaryResult.revenue,
          expense: summaryResult.expense,
          profit: summaryResult.profit
        });
      }
    }

    return successResponse({
      year: year,
      trend: trend
    });
  }, 'getYearlyTrend');
}

// ===========================================
// 税金概算
// ===========================================

/**
 * 概算税額を計算
 * @returns {Object} 結果
 */
function calculateTaxEstimate() {
  return withErrorHandling(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // 今年の確定取引を集計
    let totalRevenue = 0;
    let totalExpense = 0;
    let monthsWithData = 0;

    for (let month = 1; month <= currentMonth; month++) {
      const summaryResult = getMonthlySummary({ year: currentYear, month });
      if (summaryResult.success && summaryResult.transactionCount > 0) {
        totalRevenue += summaryResult.revenue;
        totalExpense += summaryResult.expense;
        monthsWithData++;
      }
    }

    // 年換算
    let annualRevenue = totalRevenue;
    let annualExpense = totalExpense;

    if (monthsWithData > 0 && monthsWithData < 12) {
      const avgRevenue = totalRevenue / monthsWithData;
      const avgExpense = totalExpense / monthsWithData;
      annualRevenue = Math.round(avgRevenue * 12);
      annualExpense = Math.round(avgExpense * 12);
    }

    const annualIncome = annualRevenue - annualExpense;

    // 概算税額（簡易計算）
    // 所得税：基礎控除48万、税率5%〜（簡易的に10%で計算）
    const taxableIncome = Math.max(0, annualIncome - 480000);
    const incomeTax = Math.round(taxableIncome * 0.1);

    // 住民税：所得割10%（簡易計算）
    const residentTax = Math.round(taxableIncome * 0.1);

    return successResponse({
      year: currentYear,
      monthsWithData: monthsWithData,
      ytdRevenue: totalRevenue,
      ytdExpense: totalExpense,
      ytdIncome: totalRevenue - totalExpense,
      annualRevenue: annualRevenue,
      annualExpense: annualExpense,
      annualIncome: annualIncome,
      incomeTax: incomeTax,
      residentTax: residentTax,
      totalTax: incomeTax + residentTax,
      disclaimer: 'あくまで概算です。最終的な税額は会計士・税理士の判断に従ってください。'
    });
  }, 'calculateTaxEstimate');
}

// ===========================================
// サブスク固定費サマリー
// ===========================================

/**
 * 月間固定費合計を取得
 * @returns {Object} 結果
 */
function getMonthlyFixedCostSummary() {
  return withErrorHandling(() => {
    const listResult = listSubscriptions(true);
    if (!listResult.success) {
      return listResult;
    }

    let monthlyTotal = 0;
    const items = [];

    for (const sub of listResult.subscriptions) {
      if (sub.billingCycle === BILLING_CYCLE.MONTHLY) {
        monthlyTotal += sub.amount;
        items.push({
          title: sub.title,
          amount: sub.amount,
          accountTitle: sub.accountTitle
        });
      }
    }

    // 金額順ソート
    items.sort((a, b) => b.amount - a.amount);

    return successResponse({
      monthlyTotal: monthlyTotal,
      items: items,
      count: items.length
    });
  }, 'getMonthlyFixedCostSummary');
}
