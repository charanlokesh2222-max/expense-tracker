/**
 * dashboard.js — Feature 1: Dashboard Overview
 * Dynamic KPI calculations, charts, budget status alert, and recent transactions.
 */

import { calculateBudgetStatus } from './budget.js';
import {
  buildMonthlySeries,
  calculateSummaryTotals,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatMonthLabel,
  getMonthKey,
  groupExpensesByCategory,
} from './transactions.js';

let overviewChartInstance = null;
let categoryChartInstance = null;

function destroyDashboardCharts() {
  if (overviewChartInstance) {
    overviewChartInstance.destroy();
    overviewChartInstance = null;
  }
  if (categoryChartInstance) {
    categoryChartInstance.destroy();
    categoryChartInstance = null;
  }
}

export function renderDashboardView(container, context) {
  const {
    transactions,
    budget,
    activeMonth,
    onNavigate,
    onEditTransaction,
    onRequestDelete,
    onOpenNewModal,
  } = context;

  destroyDashboardCharts();

  const monthLabel = formatMonthLabel(activeMonth);
  const summary = calculateSummaryTotals(transactions, activeMonth);
  const budgetStatus = calculateBudgetStatus(summary.monthlyExpenses, budget.monthlyLimit);

  const monthExpenses = transactions.filter(
    (tx) => tx.type === 'expense' && getMonthKey(tx.date) === activeMonth
  );
  const categoryBreakdown = groupExpensesByCategory(monthExpenses);
  const recentTransactions = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 6);

  const showDashboardAlert =
    budgetStatus.status === 'warning' || budgetStatus.status === 'exceeded';

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Financial Overview</h2>
        <p class="page-subtitle">Dynamic balances and monthly cashflow for ${escapeHtml(monthLabel)}.</p>
      </div>
    </div>

    ${
      showDashboardAlert
        ? `<div class="alert-banner ${budgetStatus.status}" role="alert">
            <div class="alert-banner-content">
              <i data-lucide="${budgetStatus.status === 'exceeded' ? 'alert-octagon' : 'alert-triangle'}" class="icon-sm"></i>
              <span>
                <strong>${budgetStatus.status === 'exceeded' ? 'Budget Exceeded' : 'Budget Warning (80%+)'}:</strong>
                ${escapeHtml(monthLabel)} spending is at
                <strong class="tabular">${budgetStatus.utilizationPercent.toFixed(1)}%</strong>
                (${formatCurrency(budgetStatus.spent)} of ${formatCurrency(budgetStatus.limit)}).
              </span>
            </div>
            <button type="button" class="btn-secondary" id="dash-review-budget-btn">Review Budget</button>
          </div>`
        : ''
    }

    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Total Balance</span>
        <span class="kpi-value ${summary.totalBalance >= 0 ? 'positive' : 'negative'}">
          ${formatCurrency(summary.totalBalance)}
        </span>
        <span class="kpi-foot">Income minus expenses (all-time)</span>
      </div>

      <div class="kpi-card">
        <span class="kpi-label">Total Income</span>
        <span class="kpi-value positive">${formatCurrency(summary.totalIncome)}</span>
        <span class="kpi-foot">${escapeHtml(monthLabel)}: <strong class="tabular">${formatCurrency(summary.monthlyIncome)}</strong></span>
      </div>

      <div class="kpi-card">
        <span class="kpi-label">Total Expenses</span>
        <span class="kpi-value">${formatCurrency(summary.totalExpenses)}</span>
        <span class="kpi-foot">${summary.totalCount} total recorded entries</span>
      </div>

      <div class="kpi-card">
        <span class="kpi-label">Monthly Spending</span>
        <span class="kpi-value ${budgetStatus.status === 'exceeded' ? 'negative' : ''}">
          ${formatCurrency(summary.monthlyExpenses)}
        </span>
        <span class="kpi-foot">
          ${
            budgetStatus.limit > 0
              ? `${budgetStatus.utilizationPercent.toFixed(0)}% of ${formatCurrency(budgetStatus.limit)} budget`
              : `${escapeHtml(monthLabel)} expenses`
          }
        </span>
      </div>
    </div>

    <div class="grid-2-1">
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Monthly Spending Overview</h3>
            <span class="card-meta">6-month income vs. expenses trajectory</span>
          </div>
          <button type="button" class="text-link-btn" id="dash-to-analytics-btn">Full Analytics</button>
        </div>
        <div class="chart-container">
          <canvas id="dash-overview-chart" aria-label="Monthly spending overview chart"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Expense Category Breakdown</h3>
            <span class="card-meta">${escapeHtml(monthLabel)}</span>
          </div>
        </div>
        ${
          categoryBreakdown.length === 0
            ? `<div class="empty-state" style="padding: 28px 12px;">
                <p class="empty-state-desc">No expenses recorded in ${escapeHtml(monthLabel)} yet.</p>
                <button type="button" class="btn-secondary" id="dash-empty-cat-btn">Add Expense</button>
              </div>`
            : `<div class="chart-container" style="height: 190px;">
                <canvas id="dash-category-chart" aria-label="Expense category breakdown chart"></canvas>
              </div>
              <div class="category-legend">
                ${categoryBreakdown
                  .slice(0, 5)
                  .map(
                    (item) => `
                  <div class="legend-row">
                    <div class="legend-left">
                      <span class="legend-swatch" style="background-color: ${item.color};"></span>
                      <span class="legend-name">${escapeHtml(item.category)}</span>
                    </div>
                    <div class="legend-right tabular">
                      <span>${formatCurrency(item.total)}</span>
                      <span>${item.share.toFixed(0)}%</span>
                    </div>
                  </div>
                `
                  )
                  .join('')}
              </div>`
        }
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Recent Transactions</h3>
          <span class="card-meta">Most recent entries across your ledger</span>
        </div>
        <button type="button" class="text-link-btn" id="dash-view-all-btn">View All</button>
      </div>

      ${
        recentTransactions.length === 0
          ? `<div class="empty-state">
              <div class="empty-state-icon">
                <i data-lucide="wallet" class="icon-sm"></i>
              </div>
              <h3 class="empty-state-title">Your ledger is empty</h3>
              <p class="empty-state-desc">Add your first income or expense transaction to populate balances and charts.</p>
              <button type="button" class="btn-primary" id="dash-empty-add-btn">Log First Entry</button>
            </div>`
          : `<div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th class="num">Amount</th>
                    <th class="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${recentTransactions
                    .map(
                      (tx) => `
                    <tr>
                      <td>
                        <div class="tx-title-cell">${escapeHtml(tx.title)}</div>
                        ${
                          tx.description
                            ? `<div class="tx-desc-sub">${escapeHtml(tx.description)}</div>`
                            : ''
                        }
                      </td>
                      <td class="tx-meta-inline">${escapeHtml(tx.category)}</td>
                      <td class="tx-meta-inline tabular">${escapeHtml(formatDate(tx.date))}</td>
                      <td class="num">
                        <span class="tx-amount ${tx.type}">
                          ${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount)}
                        </span>
                      </td>
                      <td class="actions-col">
                        <div class="row-actions">
                          <button type="button" class="icon-btn dash-edit-btn" data-id="${escapeHtml(tx.id)}" aria-label="Edit ${escapeHtml(tx.title)}">
                            <i data-lucide="pencil" class="icon-xs"></i>
                          </button>
                          <button type="button" class="icon-btn danger dash-delete-btn" data-id="${escapeHtml(tx.id)}" aria-label="Delete ${escapeHtml(tx.title)}">
                            <i data-lucide="trash-2" class="icon-xs"></i>
                          </button>
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
    </div>
  `;

  container.querySelector('#dash-review-budget-btn')?.addEventListener('click', () => onNavigate('budget'));
  container.querySelector('#dash-to-analytics-btn')?.addEventListener('click', () => onNavigate('analytics'));
  container.querySelector('#dash-view-all-btn')?.addEventListener('click', () => onNavigate('transactions'));
  container.querySelector('#dash-empty-add-btn')?.addEventListener('click', onOpenNewModal);
  container.querySelector('#dash-empty-cat-btn')?.addEventListener('click', onOpenNewModal);

  container.querySelectorAll('.dash-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => onEditTransaction(btn.dataset.id));
  });
  container.querySelectorAll('.dash-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => onRequestDelete(btn.dataset.id));
  });

  // Render Chart.js visualizations safely
  if (typeof window.Chart !== 'undefined') {
    const overviewCanvas = container.querySelector('#dash-overview-chart');
    if (overviewCanvas) {
      const series = buildMonthlySeries(transactions, 6, activeMonth);
      overviewChartInstance = new window.Chart(overviewCanvas, {
        type: 'bar',
        data: {
          labels: series.map((s) => s.label),
          datasets: [
            {
              label: 'Income',
              data: series.map((s) => s.income),
              backgroundColor: '#16a34a',
              borderRadius: 4,
              barPercentage: 0.65,
              categoryPercentage: 0.65,
            },
            {
              label: 'Expenses',
              data: series.map((s) => s.expenses),
              backgroundColor: '#0f172a',
              borderRadius: 4,
              barPercentage: 0.65,
              categoryPercentage: 0.65,
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
                usePointStyle: false,
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
              beginAtZero: true,
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

    const categoryCanvas = container.querySelector('#dash-category-chart');
    if (categoryCanvas && categoryBreakdown.length > 0) {
      categoryChartInstance = new window.Chart(categoryCanvas, {
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
          cutout: '66%',
          plugins: {
            legend: { display: false },
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
