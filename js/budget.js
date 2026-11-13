/**
 * budget.js — Budget Management & Threshold Alert Logic
 */

import {
  calculateSummaryTotals,
  escapeHtml,
  formatCurrency,
  formatMonthLabel,
  getMonthKey,
  groupExpensesByCategory,
} from './transactions.js';

/**
 * Pure calculation for budget utilization and threshold status.
 * Triggers warning at >= 80% and alert when > 100%.
 */
export function calculateBudgetStatus(monthlyExpenses, monthlyLimit) {
  const spent = Math.max(0, Number(monthlyExpenses) || 0);
  const limit = Math.max(0, Number(monthlyLimit) || 0);

  if (limit <= 0) {
    return {
      limit: 0,
      spent,
      remaining: 0,
      utilizationPercent: 0,
      clampedPercent: 0,
      status: 'unset',
    };
  }

  const remaining = limit - spent;
  const utilizationPercent = (spent / limit) * 100;
  const clampedPercent = Math.min(100, Math.max(0, utilizationPercent));

  let status = 'healthy';
  if (utilizationPercent > 100) {
    status = 'exceeded';
  } else if (utilizationPercent >= 80) {
    status = 'warning';
  }

  return {
    limit,
    spent,
    remaining,
    utilizationPercent,
    clampedPercent,
    status,
  };
}

export function renderBudgetAlertBanner(budgetStatus, monthLabel) {
  if (budgetStatus.status === 'unset') {
    return `
      <div class="alert-banner neutral" role="status">
        <div class="alert-banner-content">
          <i data-lucide="info" class="icon-sm"></i>
          <span>No monthly budget target set yet. Configure a limit below to enable 80% warning and overspend alerts.</span>
        </div>
      </div>
    `;
  }

  if (budgetStatus.status === 'exceeded') {
    const overBy = Math.abs(budgetStatus.remaining);
    return `
      <div class="alert-banner exceeded" role="alert">
        <div class="alert-banner-content">
          <i data-lucide="alert-octagon" class="icon-sm"></i>
          <span>
            <strong>Budget Exceeded (${escapeHtml(monthLabel)}):</strong>
            Spending has exceeded your ${formatCurrency(budgetStatus.limit)} budget by
            <strong class="tabular">${formatCurrency(overBy)}</strong>
            (${budgetStatus.utilizationPercent.toFixed(1)}% utilized).
          </span>
        </div>
      </div>
    `;
  }

  if (budgetStatus.status === 'warning') {
    return `
      <div class="alert-banner warning" role="status">
        <div class="alert-banner-content">
          <i data-lucide="alert-triangle" class="icon-sm"></i>
          <span>
            <strong>80% Budget Warning (${escapeHtml(monthLabel)}):</strong>
            You have used <strong class="tabular">${budgetStatus.utilizationPercent.toFixed(1)}%</strong>
            of your monthly budget with <strong class="tabular">${formatCurrency(budgetStatus.remaining)}</strong> remaining.
          </span>
        </div>
      </div>
    `;
  }

  return `
    <div class="alert-banner healthy" role="status">
      <div class="alert-banner-content">
        <i data-lucide="check-circle-2" class="icon-sm"></i>
        <span>
          <strong>On Track (${escapeHtml(monthLabel)}):</strong>
          <strong class="tabular">${budgetStatus.utilizationPercent.toFixed(1)}%</strong>
          of monthly budget utilized. <strong class="tabular">${formatCurrency(budgetStatus.remaining)}</strong> remaining.
        </span>
      </div>
    </div>
  `;
}

/**
 * Feature 5: Budget Management View
 */
export function renderBudgetView(container, context) {
  const { transactions, budget, activeMonth, onSaveBudget } = context;
  const monthLabel = formatMonthLabel(activeMonth);
  const summary = calculateSummaryTotals(transactions, activeMonth);
  const status = calculateBudgetStatus(summary.monthlyExpenses, budget.monthlyLimit);

  const monthExpenses = transactions.filter(
    (tx) => tx.type === 'expense' && getMonthKey(tx.date) === activeMonth
  );
  const categoryBreakdown = groupExpensesByCategory(monthExpenses);

  const fillClass =
    status.status === 'exceeded' ? 'exceeded' : status.status === 'warning' ? 'warning' : '';

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Budget Management</h2>
        <p class="page-subtitle">Set your monthly spending cap and monitor real-time utilization for ${escapeHtml(monthLabel)}.</p>
      </div>
    </div>

    ${renderBudgetAlertBanner(status, monthLabel)}

    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Monthly Budget</span>
        <span class="kpi-value">${status.limit > 0 ? formatCurrency(status.limit) : 'Not Set'}</span>
        <span class="kpi-foot">Target cap per month</span>
      </div>

      <div class="kpi-card">
        <span class="kpi-label">Monthly Expenses</span>
        <span class="kpi-value">${formatCurrency(status.spent)}</span>
        <span class="kpi-foot">${escapeHtml(monthLabel)} total</span>
      </div>

      <div class="kpi-card">
        <span class="kpi-label">${status.remaining < 0 ? 'Over Budget By' : 'Remaining Budget'}</span>
        <span class="kpi-value ${
          status.limit <= 0 ? '' : status.remaining < 0 ? 'negative' : 'positive'
        }">
          ${status.limit > 0 ? formatCurrency(Math.abs(status.remaining)) : '—'}
        </span>
        <span class="kpi-foot">
          ${status.limit > 0 ? (status.remaining < 0 ? 'Exceeded cap' : 'Available to spend') : 'Set a limit first'}
        </span>
      </div>

      <div class="kpi-card">
        <span class="kpi-label">Budget Utilization</span>
        <span class="kpi-value ${
          status.status === 'exceeded' ? 'negative' : status.status === 'warning' ? '' : ''
        }">
          ${status.limit > 0 ? `${status.utilizationPercent.toFixed(1)}%` : '0.0%'}
        </span>
        <span class="kpi-foot">Warning triggers at 80%</span>
      </div>
    </div>

    <div class="form-layout-grid">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Monthly Budget Utilization</h3>
          <span class="card-meta tabular">${formatCurrency(status.spent)} / ${formatCurrency(status.limit)}</span>
        </div>

        <div class="budget-progress-wrap">
          <div class="budget-progress-header">
            <span>Current Usage</span>
            <strong class="tabular">${status.limit > 0 ? `${status.utilizationPercent.toFixed(1)}%` : '0.0%'}</strong>
          </div>
          <div class="budget-track" role="progressbar" aria-valuenow="${Math.round(status.utilizationPercent)}" aria-valuemin="0" aria-valuemax="100">
            <div class="budget-fill ${fillClass}" style="width: ${status.clampedPercent.toFixed(1)}%"></div>
          </div>
          <div class="budget-milestones">
            <span>0%</span>
            <span>80% Warning Threshold</span>
            <span>100% Cap</span>
          </div>
        </div>

        <div class="card-header" style="margin-top: 24px;">
          <h3 class="card-title">Category Impact on Budget</h3>
          <span class="card-meta">${escapeHtml(monthLabel)}</span>
        </div>

        ${
          categoryBreakdown.length === 0
            ? `<p class="card-meta">No expenses recorded in ${escapeHtml(monthLabel)} yet.</p>`
            : `<div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th class="num">Spent</th>
                      <th class="num">% of Budget</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${categoryBreakdown
                      .map((item) => {
                        const pctOfBudget = status.limit > 0 ? (item.total / status.limit) * 100 : 0;
                        return `
                          <tr>
                            <td class="tx-title-cell">${escapeHtml(item.category)}</td>
                            <td class="num tabular">${formatCurrency(item.total)}</td>
                            <td class="num tabular">${status.limit > 0 ? `${pctOfBudget.toFixed(1)}%` : '—'}</td>
                          </tr>
                        `;
                      })
                      .join('')}
                  </tbody>
                </table>
              </div>`
        }
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Set Monthly Budget</h3>
          <span class="card-meta">Persisted locally</span>
        </div>

        <form id="budget-settings-form" novalidate>
          <div class="form-field">
            <label class="form-label" for="monthly-budget-input">Monthly Budget Limit (USD)</label>
            <input
              id="monthly-budget-input"
              name="monthlyLimit"
              type="number"
              step="1"
              min="1"
              class="input-control tabular"
              placeholder="e.g., 3200"
              value="${budget.monthlyLimit > 0 ? budget.monthlyLimit : ''}"
              required
            />
            <span class="form-error" id="budget-limit-error"></span>
          </div>

          <div class="form-field" style="margin-top: 12px;">
            <span class="form-label">Quick Presets</span>
            <div class="filter-group">
              ${[2000, 3000, 4000, 5000]
                .map(
                  (preset) =>
                    `<button type="button" class="btn-secondary budget-preset-btn" data-preset="${preset}">$${preset.toLocaleString()}</button>`
                )
                .join('')}
            </div>
          </div>

          <div class="form-actions" style="margin-top: 20px;">
            <button type="submit" class="btn-primary">
              <i data-lucide="save" class="icon-xs"></i>
              <span>Save Budget</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  const form = container.querySelector('#budget-settings-form');
  const input = container.querySelector('#monthly-budget-input');
  const errEl = container.querySelector('#budget-limit-error');

  container.querySelectorAll('.budget-preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      input.value = btn.dataset.preset;
      errEl.textContent = '';
      input.classList.remove('is-invalid');
    });
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    errEl.textContent = '';
    input.classList.remove('is-invalid');

    const limit = Number(input.value);
    if (!Number.isFinite(limit) || limit <= 0) {
      errEl.textContent = 'Enter a monthly budget greater than $0.';
      input.classList.add('is-invalid');
      return;
    }

    onSaveBudget({ monthlyLimit: Number(limit.toFixed(2)) });
  });
}
