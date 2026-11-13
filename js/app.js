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
    onSubmit: (data) => {
      if (isEdit) {
        updateTransaction(transaction.id, data);
        showToast('Transaction updated.');
      } else {
        addTransaction(data);
        showToast('Transaction added.');
      }
      closeTransactionModal();
      renderCurrentView();
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

function openDeleteConfirmation(id) {
  const tx = getTransactionById(id);
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

function exportTransactionsToCsv() {
  const transactions = getTransactions();
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
}

function renderCurrentView() {
  const transactions = getTransactions();
  const budget = getBudget();
  updateSidebarBudgetSummary(transactions, budget);

  const context = {
    transactions,
    budget,
    activeMonth: state.activeMonth,
    refreshIcons,
    onNavigate: navigateTo,
    onOpenNewModal: () => openTransactionModal(null),
    onEditTransaction: (id) => {
      const tx = getTransactionById(id);
      if (tx) openTransactionModal(tx);
    },
    onRequestDelete: openDeleteConfirmation,
    onAddTransaction: (data) => {
      addTransaction(data);
      showToast('Transaction added to ledger.');
      renderCurrentView();
    },
    onSaveBudget: (budgetData) => {
      saveBudget(budgetData);
      showToast('Monthly budget updated.');
      renderCurrentView();
    },
  };

  const container = document.getElementById(`view-${state.activeView}`);
  if (!container) return;

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
  document.getElementById('reset-demo-btn')?.addEventListener('click', () => {
    resetSampleData();
    showToast('Sample dataset restored.');
    renderCurrentView();
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
  document.getElementById('confirm-accept-btn')?.addEventListener('click', () => {
    if (state.pendingDeleteId) {
      deleteTransaction(state.pendingDeleteId);
      showToast('Transaction deleted.');
    }
    closeDeleteConfirmation();
    renderCurrentView();
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

document.addEventListener('DOMContentLoaded', () => {
  initStorage();
  bindGlobalEvents();
  renderCurrentView();
});
