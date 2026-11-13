/**
 * transactions.js — Pure Financial Calculations, Validation,
 * Income/Expense Form, and Transaction History Management
 */

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investments',
  'Business',
  'Rental',
  'Gift',
  'Other Income',
];

export const EXPENSE_CATEGORIES = [
  'Food',
  'Housing',
  'Transport',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Shopping',
  'Education',
  'Travel',
  'Other',
];

export const CATEGORY_COLORS = {
  Food: '#2563eb',
  Housing: '#0f172a',
  Transport: '#0891b2',
  Utilities: '#4f46e5',
  Healthcare: '#059669',
  Entertainment: '#d97706',
  Shopping: '#7c3aed',
  Education: '#0284c7',
  Travel: '#db2777',
  Other: '#64748b',
};

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatCurrency(amount, options = {}) {
  const { showSign = false } = options;
  const num = Number(amount) || 0;
  const absFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(num));

  if (num < 0) return `-${absFormatted}`;
  if (showSign && num > 0) return `+${absFormatted}`;
  return absFormatted;
}

export function formatDate(isoDate) {
  if (!isoDate) return '—';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatMonthLabel(monthKey) {
  if (!monthKey || !monthKey.includes('-')) return monthKey || '';
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatShortMonthLabel(monthKey) {
  if (!monthKey || !monthKey.includes('-')) return monthKey || '';
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: '2-digit',
  }).format(date);
}

export function getMonthKey(isoDate) {
  return String(isoDate || '').slice(0, 7);
}

export function shiftMonthKey(monthKey, delta) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Pure calculation of all-time and monthly financial summary totals.
 * Total Balance = Total Income - Total Expenses.
 */
export function calculateSummaryTotals(transactions, monthKey) {
  let totalIncome = 0;
  let totalExpenses = 0;
  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  let monthlyCount = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;
    const isTargetMonth = monthKey ? getMonthKey(tx.date) === monthKey : false;

    if (tx.type === 'income') {
      totalIncome += amount;
      if (isTargetMonth) {
        monthlyIncome += amount;
        monthlyCount += 1;
      }
    } else {
      totalExpenses += amount;
      if (isTargetMonth) {
        monthlyExpenses += amount;
        monthlyCount += 1;
      }
    }
  }

  return {
    totalIncome,
    totalExpenses,
    totalBalance: totalIncome - totalExpenses,
    monthlyIncome,
    monthlyExpenses,
    monthlySavings: monthlyIncome - monthlyExpenses,
    monthlyCount,
    totalCount: transactions.length,
  };
}

/**
 * Pure filter & sort pipeline for Transaction History.
 */
export function filterAndSortTransactions(transactions, filters = {}) {
  const {
    search = '',
    category = 'all',
    type = 'all',
    month = 'all',
    sortBy = 'date-desc',
  } = filters;

  const query = search.trim().toLowerCase();

  const filtered = transactions.filter((tx) => {
    if (type !== 'all' && tx.type !== type) return false;
    if (category !== 'all' && tx.category !== category) return false;
    if (month !== 'all' && getMonthKey(tx.date) !== month) return false;

    if (query) {
      const haystack = `${tx.title} ${tx.description} ${tx.category} ${tx.amount}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'date-asc') {
      return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
    }
    if (sortBy === 'amount-desc') {
      return b.amount - a.amount || b.date.localeCompare(a.date);
    }
    if (sortBy === 'amount-asc') {
      return a.amount - b.amount || b.date.localeCompare(a.date);
    }
    // Default: date-desc
    return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
  });

  return filtered;
}

/**
 * Pure category aggregation for expense transactions.
 */
export function groupExpensesByCategory(transactions) {
  const map = new Map();
  let grandTotal = 0;

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const amt = Number(tx.amount) || 0;
    grandTotal += amt;
    const prev = map.get(tx.category) || { category: tx.category, total: 0, count: 0 };
    prev.total += amt;
    prev.count += 1;
    map.set(tx.category, prev);
  }

  return Array.from(map.values())
    .sort((a, b) => b.total - a.total)
    .map((item) => ({
      ...item,
      share: grandTotal > 0 ? (item.total / grandTotal) * 100 : 0,
      color: CATEGORY_COLORS[item.category] || '#64748b',
    }));
}

/**
 * Build chronological monthly Income vs Expense series.
 */
export function buildMonthlySeries(transactions, monthsCount = 6, endMonthKey = '2026-11') {
  const keys = [];
  for (let i = monthsCount - 1; i >= 0; i -= 1) {
    keys.push(shiftMonthKey(endMonthKey, -i));
  }

  const map = new Map();
  for (const key of keys) {
    map.set(key, {
      monthKey: key,
      label: formatShortMonthLabel(key),
      income: 0,
      expenses: 0,
      savings: 0,
    });
  }

  for (const tx of transactions) {
    const key = getMonthKey(tx.date);
    const bucket = map.get(key);
    if (!bucket) continue;
    if (tx.type === 'income') {
      bucket.income += Number(tx.amount) || 0;
    } else {
      bucket.expenses += Number(tx.amount) || 0;
    }
  }

  return Array.from(map.values()).map((entry) => ({
    ...entry,
    savings: entry.income - entry.expenses,
  }));
}

/**
 * Validate transaction form fields cleanly without browser alerts.
 */
export function validateTransactionInput(data) {
  const errors = {};
  const title = String(data.title || '').trim();
  const amount = Number(data.amount);
  const type = data.type;
  const category = String(data.category || '').trim();
  const date = String(data.date || '').trim();
  const description = String(data.description || '').trim();

  if (!title) {
    errors.title = 'Enter a transaction title.';
  } else if (title.length > 80) {
    errors.title = 'Title must be 80 characters or fewer.';
  }

  if (type !== 'income' && type !== 'expense') {
    errors.type = 'Select income or expense.';
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Enter an amount greater than 0.';
  } else if (amount > 100000000) {
    errors.amount = 'Amount exceeds maximum supported value.';
  }

  const validCategories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  if (!category || !validCategories.includes(category)) {
    errors.category = 'Select a valid category.';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Select a valid date.';
  }

  if (description.length > 240) {
    errors.description = 'Description must be 240 characters or fewer.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Render reusable Income / Expense Form inside any container (page or modal).
 */
export function renderTransactionForm({
  container,
  initialData = null,
  defaultDate = '2026-11-13',
  submitLabel = 'Save Transaction',
  onSubmit,
  onCancel = null,
}) {
  const isEditing = Boolean(initialData && initialData.id);
  let activeType = initialData?.type || 'expense';

  const getCategoryOptionsHtml = (type, selectedCategory) => {
    const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    return list
      .map(
        (cat) =>
          `<option value="${escapeHtml(cat)}" ${
            cat === selectedCategory ? 'selected' : ''
          }>${escapeHtml(cat)}</option>`
      )
      .join('');
  };

  const initialCategory =
    initialData?.category ||
    (activeType === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);

  container.innerHTML = `
    <form class="tx-form" novalidate>
      <div class="form-grid">
        <div class="form-field full">
          <span class="form-label">Transaction Type</span>
          <div class="type-toggle-group" role="group" aria-label="Transaction Type">
            <button
              type="button"
              class="type-toggle-btn ${activeType === 'expense' ? 'active' : ''}"
              data-type="expense"
            >
              <i data-lucide="arrow-up-right" class="icon-xs"></i>
              <span>Expense</span>
            </button>
            <button
              type="button"
              class="type-toggle-btn ${activeType === 'income' ? 'active' : ''}"
              data-type="income"
            >
              <i data-lucide="arrow-down-left" class="icon-xs"></i>
              <span>Income</span>
            </button>
          </div>
          <span class="form-error" data-error="type"></span>
        </div>

        <div class="form-field full">
          <label class="form-label" for="tx-title-input">Title</label>
          <input
            id="tx-title-input"
            name="title"
            type="text"
            class="input-control"
            placeholder="e.g., Grocery Shopping or Monthly Salary"
            maxlength="80"
            value="${escapeHtml(initialData?.title || '')}"
            required
          />
          <span class="form-error" data-error="title"></span>
        </div>

        <div class="form-field">
          <label class="form-label" for="tx-amount-input">Amount (USD)</label>
          <input
            id="tx-amount-input"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            class="input-control tabular"
            placeholder="0.00"
            value="${initialData?.amount ? Number(initialData.amount) : ''}"
            required
          />
          <span class="form-error" data-error="amount"></span>
        </div>

        <div class="form-field">
          <label class="form-label" for="tx-category-select">Category</label>
          <select id="tx-category-select" name="category" class="select-control" required>
            ${getCategoryOptionsHtml(activeType, initialCategory)}
          </select>
          <span class="form-error" data-error="category"></span>
        </div>

        <div class="form-field full">
          <label class="form-label" for="tx-date-input">Date</label>
          <input
            id="tx-date-input"
            name="date"
            type="date"
            class="input-control tabular"
            value="${escapeHtml(initialData?.date || defaultDate)}"
            required
          />
          <span class="form-error" data-error="date"></span>
        </div>

        <div class="form-field full">
          <label class="form-label" for="tx-description-input">Description (optional)</label>
          <textarea
            id="tx-description-input"
            name="description"
            rows="2"
            maxlength="240"
            class="textarea-control"
            placeholder="Add context such as merchant, invoice number, or note"
          >${escapeHtml(initialData?.description || '')}</textarea>
          <span class="form-error" data-error="description"></span>
        </div>
      </div>

      <div class="form-actions">
        ${
          onCancel
            ? `<button type="button" class="btn-secondary tx-cancel-btn">Cancel</button>`
            : `<button type="reset" class="btn-secondary">Clear</button>`
        }
        <button type="submit" class="btn-primary">
          <i data-lucide="${isEditing ? 'check' : 'plus'}" class="icon-xs"></i>
          <span>${escapeHtml(submitLabel)}</span>
        </button>
      </div>
    </form>
  `;

  const form = container.querySelector('.tx-form');
  const typeBtns = form.querySelectorAll('.type-toggle-btn');
  const categorySelect = form.querySelector('#tx-category-select');
  const cancelBtn = form.querySelector('.tx-cancel-btn');

  const clearErrors = () => {
    form.querySelectorAll('.form-error').forEach((el) => {
      el.textContent = '';
    });
    form.querySelectorAll('.is-invalid').forEach((el) => {
      el.classList.remove('is-invalid');
    });
  };

  typeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextType = btn.dataset.type;
      if (nextType === activeType) return;
      activeType = nextType;
      typeBtns.forEach((b) => b.classList.toggle('active', b.dataset.type === activeType));
      const fallbackCat = activeType === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0];
      categorySelect.innerHTML = getCategoryOptionsHtml(activeType, fallbackCat);
    });
  });

  if (cancelBtn && onCancel) {
    cancelBtn.addEventListener('click', onCancel);
  }

  form.addEventListener('reset', () => {
    clearErrors();
    setTimeout(() => {
      activeType = 'expense';
      typeBtns.forEach((b) => b.classList.toggle('active', b.dataset.type === 'expense'));
      categorySelect.innerHTML = getCategoryOptionsHtml('expense', EXPENSE_CATEGORIES[0]);
      form.querySelector('#tx-date-input').value = defaultDate;
    }, 0);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearErrors();

    const payload = {
      title: form.title.value,
      amount: form.amount.value,
      category: form.category.value,
      type: activeType,
      date: form.date.value,
      description: form.description.value,
    };

    const validation = validateTransactionInput(payload);
    if (!validation.valid) {
      for (const [field, message] of Object.entries(validation.errors)) {
        const errSpan = form.querySelector(`[data-error="${field}"]`);
        if (errSpan) errSpan.textContent = message;
        const inputEl = form.querySelector(`[name="${field}"]`);
        if (inputEl) inputEl.classList.add('is-invalid');
      }
      return;
    }

    onSubmit({
      ...payload,
      title: payload.title.trim(),
      amount: Number(Number(payload.amount).toFixed(2)),
      description: payload.description.trim(),
    });
  });
}

/**
 * Feature 2: Dedicated Add Income / Expense View
 */
export function renderAddView(container, context) {
  const { transactions, activeMonth, onAddTransaction, onEditTransaction, onNavigate } = context;
  const monthTransactions = transactions
    .filter((tx) => getMonthKey(tx.date) === activeMonth)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const summary = calculateSummaryTotals(transactions, activeMonth);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Record Income & Expense</h2>
        <p class="page-subtitle">Add validated transactions directly to your personal ledger.</p>
      </div>
      <button type="button" class="btn-secondary" id="add-view-history-btn">
        <i data-lucide="list-ordered" class="icon-xs"></i>
        <span>View All History</span>
      </button>
    </div>

    <div class="form-layout-grid">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Transaction Details</h3>
          <span class="card-meta">All fields validated before save</span>
        </div>
        <div id="dedicated-tx-form-host"></div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${escapeHtml(formatMonthLabel(activeMonth))} Snapshot</h3>
          <span class="card-meta">${summary.monthlyCount} entries</span>
        </div>

        <div class="filter-summary-strip">
          <span>Month Income</span>
          <strong class="tabular tx-amount income">${formatCurrency(summary.monthlyIncome, { showSign: true })}</strong>
        </div>
        <div class="filter-summary-strip">
          <span>Month Expenses</span>
          <strong class="tabular">${formatCurrency(summary.monthlyExpenses)}</strong>
        </div>
        <div class="filter-summary-strip">
          <span>All-Time Balance</span>
          <strong class="tabular">${formatCurrency(summary.totalBalance)}</strong>
        </div>

        <div class="card-header" style="margin-top: 20px;">
          <h3 class="card-title">Latest in ${escapeHtml(formatMonthLabel(activeMonth))}</h3>
        </div>

        ${
          monthTransactions.length === 0
            ? `<p class="card-meta">No entries recorded for this month yet.</p>`
            : `<div class="table-wrap">
                <table class="data-table">
                  <tbody>
                    ${monthTransactions
                      .map(
                        (tx) => `
                        <tr>
                          <td>
                            <div class="tx-title-cell">${escapeHtml(tx.title)}</div>
                            <div class="tx-desc-sub">${escapeHtml(tx.category)} · ${escapeHtml(formatDate(tx.date))}</div>
                          </td>
                          <td class="num">
                            <span class="tx-amount ${tx.type}">
                              ${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount)}
                            </span>
                          </td>
                          <td class="actions-col">
                            <button type="button" class="icon-btn quick-edit-btn" data-id="${escapeHtml(tx.id)}" aria-label="Edit ${escapeHtml(tx.title)}">
                              <i data-lucide="pencil" class="icon-xs"></i>
                            </button>
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
    </div>
  `;

  const defaultDate = activeMonth === '2026-11' ? '2026-11-13' : `${activeMonth}-01`;
  const formHost = container.querySelector('#dedicated-tx-form-host');
  renderTransactionForm({
    container: formHost,
    defaultDate,
    submitLabel: 'Add Transaction',
    onSubmit: (data) => {
      onAddTransaction(data);
    },
  });

  container.querySelector('#add-view-history-btn')?.addEventListener('click', () => {
    onNavigate('transactions');
  });

  container.querySelectorAll('.quick-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      onEditTransaction(btn.dataset.id);
    });
  });
}

/**
 * Feature 3: Transaction History View (Search, Filters, Sort, Edit, Delete)
 */
const historyFilters = {
  search: '',
  type: 'all',
  category: 'all',
  month: 'all',
  sortBy: 'date-desc',
};

export function renderTransactionsView(container, context) {
  const { transactions, onEditTransaction, onRequestDelete, onOpenNewModal } = context;

  const availableMonths = Array.from(
    new Set(transactions.map((tx) => getMonthKey(tx.date)).filter(Boolean))
  ).sort((a, b) => b.localeCompare(a));

  const allCategories = Array.from(new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]));

  const filtered = filterAndSortTransactions(transactions, historyFilters);

  let filteredIncome = 0;
  let filteredExpenses = 0;
  for (const tx of filtered) {
    if (tx.type === 'income') filteredIncome += tx.amount;
    else filteredExpenses += tx.amount;
  }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Transaction History</h2>
        <p class="page-subtitle">Search, filter, sort, edit, or delete any recorded transaction.</p>
      </div>
      <button type="button" class="btn-primary" id="history-add-btn">
        <i data-lucide="plus" class="icon-xs"></i>
        <span>Add Transaction</span>
      </button>
    </div>

    <div class="card">
      <div class="filter-bar">
        <div class="filter-group" style="flex: 1; min-width: 240px;">
          <div class="search-box">
            <i data-lucide="search" class="search-box-icon"></i>
            <input
              type="search"
              id="history-search-input"
              class="input-control search-input"
              placeholder="Search title, category, description, or amount..."
              value="${escapeHtml(historyFilters.search)}"
              aria-label="Search transactions"
            />
          </div>

          <div class="segmented-control" role="group" aria-label="Filter by transaction type">
            <button type="button" class="segment-btn ${historyFilters.type === 'all' ? 'active' : ''}" data-filter-type="all">All</button>
            <button type="button" class="segment-btn ${historyFilters.type === 'income' ? 'active' : ''}" data-filter-type="income">Income</button>
            <button type="button" class="segment-btn ${historyFilters.type === 'expense' ? 'active' : ''}" data-filter-type="expense">Expense</button>
          </div>
        </div>

        <div class="filter-group">
          <select id="history-category-select" class="select-control" style="width: auto; min-width: 148px;" aria-label="Filter by category">
            <option value="all" ${historyFilters.category === 'all' ? 'selected' : ''}>All Categories</option>
            ${allCategories
              .map(
                (cat) =>
                  `<option value="${escapeHtml(cat)}" ${
                    historyFilters.category === cat ? 'selected' : ''
                  }>${escapeHtml(cat)}</option>`
              )
              .join('')}
          </select>

          <select id="history-month-select" class="select-control" style="width: auto; min-width: 145px;" aria-label="Filter by month">
            <option value="all" ${historyFilters.month === 'all' ? 'selected' : ''}>All Months</option>
            ${availableMonths
              .map(
                (m) =>
                  `<option value="${escapeHtml(m)}" ${
                    historyFilters.month === m ? 'selected' : ''
                  }>${escapeHtml(formatMonthLabel(m))}</option>`
              )
              .join('')}
          </select>

          <select id="history-sort-select" class="select-control" style="width: auto; min-width: 155px;" aria-label="Sort transactions">
            <option value="date-desc" ${historyFilters.sortBy === 'date-desc' ? 'selected' : ''}>Date: Newest First</option>
            <option value="date-asc" ${historyFilters.sortBy === 'date-asc' ? 'selected' : ''}>Date: Oldest First</option>
            <option value="amount-desc" ${historyFilters.sortBy === 'amount-desc' ? 'selected' : ''}>Amount: High to Low</option>
            <option value="amount-asc" ${historyFilters.sortBy === 'amount-asc' ? 'selected' : ''}>Amount: Low to High</option>
          </select>
        </div>
      </div>

      <div class="filter-summary-strip">
        <span>Showing <strong class="tabular">${filtered.length}</strong> of <strong class="tabular">${transactions.length}</strong> transactions</span>
        <div class="filter-summary-metrics">
          <span>Income: <strong class="tabular tx-amount income">${formatCurrency(filteredIncome, { showSign: true })}</strong></span>
          <span>Expenses: <strong class="tabular">${formatCurrency(filteredExpenses)}</strong></span>
          <span>Net: <strong class="tabular">${formatCurrency(filteredIncome - filteredExpenses)}</strong></span>
        </div>
      </div>

      ${
        filtered.length === 0
          ? `<div class="empty-state">
              <div class="empty-state-icon">
                <i data-lucide="receipt" class="icon-sm"></i>
              </div>
              <h3 class="empty-state-title">
                ${transactions.length === 0 ? 'No transactions recorded yet' : 'No matching transactions'}
              </h3>
              <p class="empty-state-desc">
                ${
                  transactions.length === 0
                    ? 'Record your first income or expense entry to start tracking balances and spending trends.'
                    : 'Try clearing your search query or adjusting the category, type, or month filters.'
                }
              </p>
              ${
                transactions.length === 0
                  ? `<button type="button" class="btn-primary" id="empty-add-btn">Log First Transaction</button>`
                  : `<button type="button" class="btn-secondary" id="reset-filters-btn">Reset Filters</button>`
              }
            </div>`
          : `<div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Title & Description</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th class="num">Amount</th>
                    <th class="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered
                    .map(
                      (tx) => `
                    <tr>
                      <td>
                        <div class="tx-title-cell">${escapeHtml(tx.title)}</div>
                        ${
                          tx.description
                            ? `<div class="tx-desc-sub" title="${escapeHtml(tx.description)}">${escapeHtml(tx.description)}</div>`
                            : ''
                        }
                      </td>
                      <td class="tx-meta-inline">${escapeHtml(tx.category)}</td>
                      <td>
                        <span class="tx-type-text ${tx.type}">
                          ${tx.type === 'income' ? 'Income' : 'Expense'}
                        </span>
                      </td>
                      <td class="tx-meta-inline tabular">${escapeHtml(formatDate(tx.date))}</td>
                      <td class="num">
                        <span class="tx-amount ${tx.type}">
                          ${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount)}
                        </span>
                      </td>
                      <td class="actions-col">
                        <div class="row-actions">
                          <button
                            type="button"
                            class="icon-btn tx-edit-btn"
                            data-id="${escapeHtml(tx.id)}"
                            title="Edit transaction"
                            aria-label="Edit ${escapeHtml(tx.title)}"
                          >
                            <i data-lucide="pencil" class="icon-xs"></i>
                          </button>
                          <button
                            type="button"
                            class="icon-btn danger tx-delete-btn"
                            data-id="${escapeHtml(tx.id)}"
                            title="Delete transaction"
                            aria-label="Delete ${escapeHtml(tx.title)}"
                          >
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

  container.querySelector('#history-add-btn')?.addEventListener('click', onOpenNewModal);
  container.querySelector('#empty-add-btn')?.addEventListener('click', onOpenNewModal);

  const searchInput = container.querySelector('#history-search-input');
  searchInput?.addEventListener('input', (e) => {
    const cursor = e.target.selectionStart;
    historyFilters.search = e.target.value;
    renderTransactionsView(container, context);
    context.refreshIcons();
    const nextInput = container.querySelector('#history-search-input');
    if (nextInput) {
      nextInput.focus();
      nextInput.setSelectionRange(cursor, cursor);
    }
  });

  container.querySelectorAll('[data-filter-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      historyFilters.type = btn.dataset.filterType;
      renderTransactionsView(container, context);
      context.refreshIcons();
    });
  });

  container.querySelector('#history-category-select')?.addEventListener('change', (e) => {
    historyFilters.category = e.target.value;
    renderTransactionsView(container, context);
    context.refreshIcons();
  });

  container.querySelector('#history-month-select')?.addEventListener('change', (e) => {
    historyFilters.month = e.target.value;
    renderTransactionsView(container, context);
    context.refreshIcons();
  });

  container.querySelector('#history-sort-select')?.addEventListener('change', (e) => {
    historyFilters.sortBy = e.target.value;
    renderTransactionsView(container, context);
    context.refreshIcons();
  });

  container.querySelector('#reset-filters-btn')?.addEventListener('click', () => {
    historyFilters.search = '';
    historyFilters.type = 'all';
    historyFilters.category = 'all';
    historyFilters.month = 'all';
    historyFilters.sortBy = 'date-desc';
    renderTransactionsView(container, context);
    context.refreshIcons();
  });

  container.querySelectorAll('.tx-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => onEditTransaction(btn.dataset.id));
  });

  container.querySelectorAll('.tx-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => onRequestDelete(btn.dataset.id));
  });
}
