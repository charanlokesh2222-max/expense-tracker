/**
 * app.js — Main Application Controller & View Router
 */

import { renderAnalyticsView } from './analytics.js';
import { calculateBudgetStatus, renderBudgetView } from './budget.js';
import { renderDashboardView } from './dashboard.js';
import {
  addTransaction,
  deleteTransaction,
  getBudget,
  getTransactionById,
  getTransactions,
  initStorage,
  resetSampleData,
  saveBudget,
  updateTransaction,
} from './storage.js';
import {
  calculateSummaryTotals,
  escapeHtml,
  formatCurrency,
  renderAddView,
  renderTransactionForm,
  renderTransactionsView,
  shiftMonthKey,
} from './transactions.js';

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  add: 'Add Entry',
  transactions: 'Transaction History',
  analytics: 'Expense Analytics',
  budget: 'Budget Management',
};

const state = {
  activeView: 'dashboard',
  activeMonth: '2026-11',
  pendingDeleteId: null,
  isLoading: false,
};

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3200);
}

function updateSidebarBudgetSummary(transactions, budget) {
  const host = document.getElementById('sidebar-budget-mini');
  if (!host) return;

  const summary = calculateSummaryTotals(transactions, state.activeMonth);
  const status = calculateBudgetStatus(summary.monthlyExpenses, budget.monthlyLimit);

  if (status.limit <= 0) {
    host.innerHTML = `
      <div class="sidebar-budget-head">
        <span>Monthly Budget</span>
        <span class="tabular">Not set</span>
      </div>
    `;
    return;
  }

  const fillClass =
    status.status === 'exceeded' ? 'exceeded' : status.status === 'warning' ? 'warning' : '';

  host.innerHTML = `
    <div class="sidebar-budget-head">
      <span>Monthly Budget</span>
      <span class="tabular">${status.utilizationPercent.toFixed(0)}%</span>
    </div>
    <div class="sidebar-budget-track">
      <div class="sidebar-budget-fill ${fillClass}" style="width: ${status.clampedPercent.toFixed(1)}%"></div>
    </div>
    <div class="sidebar-budget-head">
      <span class="tabular">${formatCurrency(status.spent)}</span>
      <span class="tabular">${formatCurrency(status.limit)}</span>
    </div>
  `;
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const menuBtn = document.getElementById('mobile-menu-btn');
  sidebar?.classList.remove('open');
  backdrop?.classList.remove('open');
  menuBtn?.setAttribute('aria-expanded', 'false');
}

function navigateTo(viewName) {
  if (!VIEW_TITLES[viewName]) return;
  state.activeView = viewName;

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  document.querySelectorAll('.view-section').forEach((sec) => {
    const isMatch = sec.id === `view-${viewName}`;
    sec.hidden = !isMatch;
    sec.classList.toggle('active', isMatch);
  });

  const titleEl = document.getElementById('topbar-view-title');
  if (titleEl) {
    titleEl.textContent = VIEW_TITLES[viewName];
  }

  closeMobileSidebar();
  renderCurrentView();
}

function openTransactionModal(transaction = null) {
  const modal = document.getElementById('transaction-modal');
  const modalTitle = document.getElementById('modal-title');
  const formHost = document.getElementById('modal-form-container');
  if (!modal || !formHost || !modalTitle) return;

  const isEdit = Boolean(transaction && transaction.id);
  modalTitle.textContent = isEdit ? 'Edit Transaction' : 'New Transaction';

  const defaultDate = state.activeMonth === '2026-11' ? '2026-11-13' : `${state.activeMonth}-01`;

  renderTransactionForm({
    container: formHost,
    initialData: transaction,
    defaultDate,
    submitLabel: isEdit ? 'Save Changes' : 'Add Transaction',
    onCancel: closeTransactionModal,
    onSubmit: async (data) => {
      try {
        if (isEdit) {
          await updateTransaction(transaction.id, data);
          showToast('Transaction updated.');
        } else {
          await addTransaction(data);
          showToast('Transaction added.');
        }
        closeTransactionModal();
        await renderCurrentView();
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
  });

  modal.hidden = false;
  refreshIcons();
  formHost.querySelector('#tx-title-input')?.focus();
}

function closeTransactionModal() {
  const modal = document.getElementById('transaction-modal');
  if (modal) modal.hidden = true;
}

async function openDeleteConfirmation(id) {
  const tx = await getTransactionById(id);
  if (!tx) return;

  state.pendingDeleteId = id;
  const modal = document.getElementById('confirm-modal');
  const msgEl = document.getElementById('confirm-message');
  if (!modal || !msgEl) return;

  msgEl.innerHTML = `Are you sure you want to delete <strong>${escapeHtml(tx.title)}</strong> (${formatCurrency(tx.amount)})? This action cannot be undone.`;
  modal.hidden = false;
}

function closeDeleteConfirmation() {
  state.pendingDeleteId = null;
  const modal = document.getElementById('confirm-modal');
  if (modal) modal.hidden = true;
}

async function exportTransactionsToCsv() {
  try {
    const transactions = await getTransactions();
    if (transactions.length === 0) {
      showToast('No transactions available to export.', 'error');
      return;
    }

    const headers = ['id', 'title', 'amount', 'category', 'type', 'date', 'description'];
    const csvEscape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = [
      headers.join(','),
      ...transactions.map((tx) => headers.map((h) => csvEscape(tx[h])).join(',')),
    ];

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ledgerflow-transactions-${state.activeMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Exported CSV file.');
  } catch (err) {
    showToast('Failed to export transactions: ' + err.message, 'error');
  }
}

async function renderCurrentView() {
  const container = document.getElementById(`view-${state.activeView}`);
  if (!container) return;

  // Render a clean loading indicator while data is being fetched
  if (!container.innerHTML.trim()) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 40px 16px;">
        <p class="empty-state-desc">Loading data from backend...</p>
      </div>
    `;
  }

  try {
    const [transactions, budget] = await Promise.all([
      getTransactions(),
      getBudget(state.activeMonth),
    ]);

    updateSidebarBudgetSummary(transactions, budget);

    const context = {
      transactions,
      budget,
      activeMonth: state.activeMonth,
      refreshIcons,
      onNavigate: navigateTo,
      onOpenNewModal: () => openTransactionModal(null),
      onEditTransaction: async (id) => {
        try {
          const tx = await getTransactionById(id);
          if (tx) openTransactionModal(tx);
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
      onRequestDelete: openDeleteConfirmation,
      onAddTransaction: async (data) => {
        try {
          await addTransaction(data);
          showToast('Transaction added to ledger.');
          await renderCurrentView();
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
      onSaveBudget: async (budgetData) => {
        try {
          await saveBudget(budgetData, state.activeMonth);
          showToast('Monthly budget updated.');
          await renderCurrentView();
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
    };

    if (state.activeView === 'dashboard') {
      renderDashboardView(container, context);
    } else if (state.activeView === 'add') {
      renderAddView(container, context);
    } else if (state.activeView === 'transactions') {
      renderTransactionsView(container, context);
    } else if (state.activeView === 'analytics') {
      renderAnalyticsView(container, context);
    } else if (state.activeView === 'budget') {
      renderBudgetView(container, context);
    }

    refreshIcons();
  } catch (err) {
    console.error('Failed to render current view:', err);
    container.innerHTML = `
      <div class="alert-banner exceeded" role="alert" style="margin-top: 24px;">
        <div class="alert-banner-content">
          <i data-lucide="alert-octagon" class="icon-sm"></i>
          <span>
            <strong>Backend Connection Error:</strong>
            ${escapeHtml(err.message || 'Unable to communicate with the backend server.')}
          </span>
        </div>
        <button type="button" class="btn-secondary" id="retry-view-btn">Retry</button>
      </div>
    `;
    container.querySelector('#retry-view-btn')?.addEventListener('click', () => {
      renderCurrentView();
    });
    refreshIcons();
    showToast(err.message || 'Backend connection error', 'error');
  }
}

function bindGlobalEvents() {
  // Sidebar navigation
  document.querySelectorAll('#sidebar-nav .nav-item').forEach((btn) => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.view));
  });

  // Mobile menu
  const menuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  menuBtn?.addEventListener('click', () => {
    const isOpen = sidebar?.classList.toggle('open');
    backdrop?.classList.toggle('open', isOpen);
    menuBtn.setAttribute('aria-expanded', String(Boolean(isOpen)));
  });

  backdrop?.addEventListener('click', closeMobileSidebar);

  // Month switcher
  const monthInput = document.getElementById('active-month-input');
  if (monthInput) {
    monthInput.value = state.activeMonth;
    monthInput.addEventListener('change', (e) => {
      if (e.target.value) {
        state.activeMonth = e.target.value;
        renderCurrentView();
      }
    });
  }

  document.getElementById('prev-month-btn')?.addEventListener('click', () => {
    state.activeMonth = shiftMonthKey(state.activeMonth, -1);
    if (monthInput) monthInput.value = state.activeMonth;
    renderCurrentView();
  });

  document.getElementById('next-month-btn')?.addEventListener('click', () => {
    state.activeMonth = shiftMonthKey(state.activeMonth, 1);
    if (monthInput) monthInput.value = state.activeMonth;
    renderCurrentView();
  });

  // Topbar primary CTA
  document.getElementById('topbar-add-btn')?.addEventListener('click', () => {
    openTransactionModal(null);
  });

  // Sidebar footer actions
  document.getElementById('export-csv-btn')?.addEventListener('click', exportTransactionsToCsv);
  document.getElementById('reset-demo-btn')?.addEventListener('click', async () => {
    try {
      await resetSampleData();
      showToast('Sample dataset restored.');
      await renderCurrentView();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Transaction modal close handlers
  document.getElementById('close-modal-btn')?.addEventListener('click', closeTransactionModal);
  document.getElementById('transaction-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'transaction-modal') closeTransactionModal();
  });

  // Confirm delete modal handlers
  document.getElementById('close-confirm-btn')?.addEventListener('click', closeDeleteConfirmation);
  document.getElementById('confirm-cancel-btn')?.addEventListener('click', closeDeleteConfirmation);
  document.getElementById('confirm-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'confirm-modal') closeDeleteConfirmation();
  });
  document.getElementById('confirm-accept-btn')?.addEventListener('click', async () => {
    if (state.pendingDeleteId) {
      try {
        await deleteTransaction(state.pendingDeleteId);
        showToast('Transaction deleted.');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
    closeDeleteConfirmation();
    await renderCurrentView();
  });

  // Escape key closes modals or mobile drawer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTransactionModal();
      closeDeleteConfirmation();
      closeMobileSidebar();
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  bindGlobalEvents();
  try {
    const migrationResult = await initStorage();
    if (migrationResult && migrationResult.migrated && migrationResult.count > 0) {
      showToast(`Imported ${migrationResult.count} records from LocalStorage.`);
    }
  } catch (err) {
    console.error('Initialization error:', err);
  }
  await renderCurrentView();
});
