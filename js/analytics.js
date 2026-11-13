/**
 * analytics.js — Feature 4: Expense Analytics
 * Category-wise breakdown, monthly income vs expenses, spending distribution,
 * highest spending category, and total savings with dynamic Chart.js charts.
 */

import {
  buildMonthlySeries,
  escapeHtml,
  formatCurrency,
  formatMonthLabel,
  getMonthKey,
  groupExpensesByCategory,
  shiftMonthKey,
} from './transactions.js';

let incomeVsExpenseChart = null;
let categoryBarChart = null;
let distributionChart = null;
let selectedRange = '6m';

function destroyAnalyticsCharts() {
  if (incomeVsExpenseChart) {
    incomeVsExpenseChart.destroy();
    incomeVsExpenseChart = null;
  }
  if (categoryBarChart) {
    categoryBarChart.destroy();
    categoryBarChart = null;
  }
  if (distributionChart) {
    distributionChart.destroy();
    distributionChart = null;
  }
}

function filterTransactionsByRange(transactions, range, activeMonth) {
  if (range === 'all') return transactions;
  if (range === '1m') {
    return transactions.filter((tx) => getMonthKey(tx.date) === activeMonth);
  }
  const monthsBack = range === '3m' ? 2 : 5;
  const startMonth = shiftMonthKey(activeMonth, -monthsBack);
  return transactions.filter((tx) => {
    const mk = getMonthKey(tx.date);
    return mk >= startMonth && mk <= activeMonth;
  });
}

export function renderAnalyticsView(container, context) {
  const { transactions, activeMonth, onOpenNewModal } = context;
  destroyAnalyticsCharts();

  const scoped = filterTransactionsByRange(transactions, selectedRange, activeMonth);
  let periodIncome = 0;
  let periodExpenses = 0;
  let expenseCount = 0;

  for (const tx of scoped) {
    if (tx.type === 'income') {
      periodIncome += tx.amount;
    } else {
      periodExpenses += tx.amount;
      expenseCount += 1;
    }
  }

  const totalSavings = periodIncome - periodExpenses;
  const savingsRate = periodIncome > 0 ? (totalSavings / periodIncome) * 100 : 0;
  const categoryBreakdown = groupExpensesByCategory(scoped);
  const topCategory = categoryBreakdown[0] || null;
  const avgExpense = expenseCount > 0 ? periodExpenses / expenseCount : 0;

  const seriesMonthsCount = selectedRange === '1m' ? 3 : selectedRange === '3m' ? 3 : 6;
  const monthlySeries = buildMonthlySeries(transactions, seriesMonthsCount, activeMonth);

  const rangeLabelMap = {
    '1m': formatMonthLabel(activeMonth),
    '3m': `Last 3 Months (ending ${formatMonthLabel(activeMonth)})`,
    '6m': `Last 6 Months (ending ${formatMonthLabel(activeMonth)})`,
    all: 'All Recorded History',
  };

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Expense Analytics</h2>
        <p class="page-subtitle">Cashflow efficiency and spending distribution for ${escapeHtml(rangeLabelMap[selectedRange])}.</p>
      </div>

      <div class="segmented-control" role="group" aria-label="Analytics Timeframe">
        <button type="button" class="segment-btn ${selectedRange === '1m' ? 'active' : ''}" data-range="1m">This Month</button>
        <button type="button" class="segment-btn ${selectedRange === '3m' ? 'active' : ''}" data-range="3m">3 Months</button>
        <button type="button" class="segment-btn ${selectedRange === '6m' ? 'active' : ''}" data-range="6m">6 Months</button>
        <button type="button" class="segment-btn ${selectedRange === 'all' ? 'active' : ''}" data-range="all">All Time</button>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Total Savings</span>
        <span class="kpi-value ${totalSavings >= 0 ? 'positive' : 'negative'}">
          ${formatCurrency(totalSavings)}
        </span>
        <span class="kpi-foot">
          ${periodIncome > 0 ? `${savingsRate.toFixed(1)}% savings rate` : 'No income in period'}
        </span>
      </div>

      <div class="kpi-card">
        <span class="kpi-label">Highest Spending Category</span>
        <span class="kpi-value" style="font-family: var(--font-display); font-size: 19px;">
          ${topCategory ? escapeHtml(topCategory.category) : 'None'}
        </span>
        <span class="kpi-foot tabular">
          ${topCategory ? `${formatCurrency(topCategory.total)} (${topCategory.share.toFixed(1)}% of spend)` : 'No expense data'}
        </span>
      </div>

      <div class="kpi-card">
        <span class="kpi-label">Period Expenses</span>
        <span class="kpi-value">${formatCurrency(periodExpenses)}</span>
        <span class="kpi-foot">${expenseCount} expense transactions</span>
      </div>

      <div class="kpi-card">
        <span class="kpi-label">Average Expense</span>
        <span class="kpi-value">${formatCurrency(avgExpense)}</span>
        <span class="kpi-foot">Mean outlay per transaction</span>
      </div>
    </div>

    ${
      scoped.length === 0
        ? `<div class="card">
            <div class="empty-state">
              <div class="empty-state-icon">
                <i data-lucide="bar-chart-3" class="icon-sm"></i>
              </div>
              <h3 class="empty-state-title">No data in this timeframe</h3>
              <p class="empty-state-desc">Switch to All Time or add transactions to inspect category spending and monthly cashflow.</p>
              <button type="button" class="btn-primary" id="analytics-empty-add-btn">Add Transaction</button>
            </div>
          </div>`
        : `<div class="card" style="margin-bottom: 20px;">
            <div class="card-header">
              <div>
                <h3 class="card-title">Monthly Income vs. Expenses</h3>
                <span class="card-meta">Grouped comparison with net monthly savings</span>
              </div>
            </div>
            <div class="chart-container-tall">
              <canvas id="analytics-income-expense-chart" aria-label="Monthly income versus expenses chart"></canvas>
            </div>
          </div>

          <div class="grid-2">
            <div class="card">
              <div class="card-header">
                <div>
                  <h3 class="card-title">Category-Wise Expense Breakdown</h3>
                  <span class="card-meta">Ranked by total spend</span>
                </div>
              </div>
              ${
                categoryBreakdown.length === 0
                  ? `<p class="card-meta">No expense transactions in this range.</p>`
                  : `<div class="chart-container">
                      <canvas id="analytics-category-bar-chart" aria-label="Category wise expense breakdown chart"></canvas>
                    </div>`
              }
            </div>

            <div class="card">
              <div class="card-header">
                <div>
                  <h3 class="card-title">Spending Distribution</h3>
                  <span class="card-meta">Share across expense categories</span>
                </div>
              </div>
              ${
                categoryBreakdown.length === 0
                  ? `<p class="card-meta">No expense transactions in this range.</p>`
                  : `<div class="chart-container">
                      <canvas id="analytics-distribution-chart" aria-label="Spending distribution chart"></canvas>
                    </div>`
              }
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Category Breakdown Ledger</h3>
              <span class="card-meta">${categoryBreakdown.length} active expense categories</span>
            </div>
            ${
              categoryBreakdown.length === 0
                ? `<p class="card-meta">No expenses recorded in this timeframe.</p>`
                : `<div class="table-wrap">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th class="num">Transactions</th>
                          <th class="num">Total Spent</th>
                          <th class="num">Share</th>
                          <th>Distribution</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${categoryBreakdown
                          .map(
                            (item) => `
                          <tr>
                            <td class="tx-title-cell">${escapeHtml(item.category)}</td>
                            <td class="num tabular">${item.count}</td>
                            <td class="num tabular">${formatCurrency(item.total)}</td>
                            <td class="num tabular">${item.share.toFixed(1)}%</td>
                            <td>
                              <div class="proportion-bar" aria-hidden="true">
                                <div class="proportion-fill" style="width: ${item.share.toFixed(1)}%; background-color: ${item.color};"></div>
                              </div>
                            </td>
                          </tr>
                        `
                          )
                          .join('')}
                      </tbody>
                    </table>
                  </div>`
            }
          </div>`
    }
  `;

  container.querySelectorAll('[data-range]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedRange = btn.dataset.range;
      renderAnalyticsView(container, context);
      context.refreshIcons();
    });
  });

  container.querySelector('#analytics-empty-add-btn')?.addEventListener('click', onOpenNewModal);

  if (typeof window.Chart !== 'undefined' && scoped.length > 0) {
    const ieCanvas = container.querySelector('#analytics-income-expense-chart');
    if (ieCanvas) {
      incomeVsExpenseChart = new window.Chart(ieCanvas, {
        type: 'bar',
        data: {
          labels: monthlySeries.map((m) => m.label),
          datasets: [
            {
              label: 'Income',
              data: monthlySeries.map((m) => m.income),
              backgroundColor: '#16a34a',
              borderRadius: 4,
            },
            {
              label: 'Expenses',
              data: monthlySeries.map((m) => m.expenses),
              backgroundColor: '#0f172a',
              borderRadius: 4,
            },
            {
              label: 'Net Savings',
              data: monthlySeries.map((m) => m.savings),
              backgroundColor: '#2563eb',
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              align: 'end',
              labels: {
                boxWidth: 10,
                boxHeight: 10,
                font: { family: "'Public Sans', sans-serif", size: 12 },
              },
            },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { family: "'Public Sans', sans-serif", size: 12 }, color: '#64748b' },
            },
            y: {
              border: { display: false },
              grid: { color: '#f1f5f9' },
              ticks: {
                font: { family: "'JetBrains Mono', monospace", size: 11 },
                color: '#64748b',
                callback: (val) => `$${Number(val).toLocaleString()}`,
              },
            },
          },
        },
      });
    }

    const barCanvas = container.querySelector('#analytics-category-bar-chart');
    if (barCanvas && categoryBreakdown.length > 0) {
      categoryBarChart = new window.Chart(barCanvas, {
        type: 'bar',
        data: {
          labels: categoryBreakdown.map((c) => c.category),
          datasets: [
            {
              label: 'Spent',
              data: categoryBreakdown.map((c) => c.total),
              backgroundColor: categoryBreakdown.map((c) => c.color),
              borderRadius: 4,
              barThickness: 18,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => formatCurrency(ctx.parsed.x),
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              border: { display: false },
              grid: { color: '#f1f5f9' },
              ticks: {
                font: { family: "'JetBrains Mono', monospace", size: 11 },
                color: '#64748b',
                callback: (val) => `$${Number(val).toLocaleString()}`,
              },
            },
            y: {
              grid: { display: false },
              ticks: { font: { family: "'Public Sans', sans-serif", size: 12 }, color: '#0f172a' },
            },
          },
        },
      });
    }

    const distCanvas = container.querySelector('#analytics-distribution-chart');
    if (distCanvas && categoryBreakdown.length > 0) {
      distributionChart = new window.Chart(distCanvas, {
        type: 'doughnut',
        data: {
          labels: categoryBreakdown.map((c) => c.category),
          datasets: [
            {
              data: categoryBreakdown.map((c) => c.total),
              backgroundColor: categoryBreakdown.map((c) => c.color),
              borderWidth: 2,
              borderColor: '#ffffff',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '58%',
          plugins: {
            legend: {
              position: 'right',
              labels: {
                boxWidth: 10,
                boxHeight: 10,
                font: { family: "'Public Sans', sans-serif", size: 12 },
              },
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const item = categoryBreakdown[ctx.dataIndex];
                  return `${item.category}: ${formatCurrency(item.total)} (${item.share.toFixed(1)}%)`;
                },
              },
            },
          },
        },
      });
    }
  }
}
