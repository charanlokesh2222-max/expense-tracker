/**
 * storage.js — Centralized Data Persistence Layer
 *
 * Currently backed by browser LocalStorage.
 * All data operations are isolated here with clean function signatures
 * so they can be swapped for REST API calls (Node.js + Express + SQL)
 * without modifying UI or calculation modules.
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'ledgerflow_transactions_v1',
  BUDGET: 'ledgerflow_budget_v1',
  INITIALIZED: 'ledgerflow_initialized_v1',
};

const DEFAULT_BUDGET = {
  monthlyLimit: 3200,
  updatedAt: '2026-11-01T09:00:00.000Z',
};

const SAMPLE_TRANSACTIONS = [
  {
    id: 'tx_202611_01',
    title: 'Monthly Salary',
    amount: 5400,
    category: 'Salary',
    type: 'income',
    date: '2026-11-01',
    description: 'Primary engineering payroll deposit',
  },
  {
    id: 'tx_202611_02',
    title: 'Apartment Rent',
    amount: 1450,
    category: 'Housing',
    type: 'expense',
    date: '2026-11-02',
    description: 'November monthly lease payment',
  },
  {
    id: 'tx_202611_03',
    title: 'Electric & Fiber Internet',
    amount: 185,
    category: 'Utilities',
    type: 'expense',
    date: '2026-11-04',
    description: 'Monthly electricity bill and gigabit internet',
  },
  {
    id: 'tx_202611_04',
    title: 'UI Architecture Consulting',
    amount: 850,
    category: 'Freelance',
    type: 'income',
    date: '2026-11-06',
    description: 'Design system review retainer',
  },
  {
    id: 'tx_202611_05',
    title: 'Transit & Fuel Pass',
    amount: 140,
    category: 'Transport',
    type: 'expense',
    date: '2026-11-07',
    description: 'Commuter rail pass and fuel top-up',
  },
  {
    id: 'tx_202611_06',
    title: 'Dental & Pharmacy',
    amount: 210,
    category: 'Healthcare',
    type: 'expense',
    date: '2026-11-09',
    description: 'Routine checkup and prescription',
  },
  {
    id: 'tx_202611_07',
    title: 'Office Desk Monitor',
    amount: 390,
    category: 'Shopping',
    type: 'expense',
    date: '2026-11-11',
    description: '27-inch IPS display upgrade',
  },
  {
    id: 'tx_202611_08',
    title: 'Grocery Shopping',
    amount: 325,
    category: 'Food',
    type: 'expense',
    date: '2026-11-13',
    description: 'Weekly groceries and fresh produce',
  },
  {
    id: 'tx_202610_01',
    title: 'Monthly Salary',
    amount: 5400,
    category: 'Salary',
    type: 'income',
    date: '2026-10-01',
    description: 'October payroll deposit',
  },
  {
    id: 'tx_202610_02',
    title: 'Apartment Rent',
    amount: 1450,
    category: 'Housing',
    type: 'expense',
    date: '2026-10-02',
    description: 'October monthly lease payment',
  },
  {
    id: 'tx_202610_03',
    title: 'Whole Foods & Dining',
    amount: 640,
    category: 'Food',
    type: 'expense',
    date: '2026-10-12',
    description: 'Groceries and team lunches',
  },
  {
    id: 'tx_202610_04',
    title: 'Utilities & Water',
    amount: 172,
    category: 'Utilities',
    type: 'expense',
    date: '2026-10-15',
    description: 'Electricity, water, and internet',
  },
  {
    id: 'tx_202610_05',
    title: 'Autumn Conference Trip',
    amount: 480,
    category: 'Travel',
    type: 'expense',
    date: '2026-10-21',
    description: 'Regional rail tickets and hotel stay',
  },
  {
    id: 'tx_202610_06',
    title: 'Dividend Distribution',
    amount: 310,
    category: 'Investments',
    type: 'income',
    date: '2026-10-25',
    description: 'Quarterly index ETF payout',
  },
  {
    id: 'tx_202609_01',
    title: 'Monthly Salary',
    amount: 5200,
    category: 'Salary',
    type: 'income',
    date: '2026-09-01',
    description: 'September payroll deposit',
  },
  {
    id: 'tx_202609_02',
    title: 'Apartment Rent',
    amount: 1450,
    category: 'Housing',
    type: 'expense',
    date: '2026-09-02',
    description: 'September lease payment',
  },
  {
    id: 'tx_202609_03',
    title: 'Groceries & Market',
    amount: 590,
    category: 'Food',
    type: 'expense',
    date: '2026-09-14',
    description: 'Monthly household groceries',
  },
  {
    id: 'tx_202609_04',
    title: 'Technical Course',
    amount: 240,
    category: 'Education',
    type: 'expense',
    date: '2026-09-19',
    description: 'Systems architecture workshop',
  },
  {
    id: 'tx_202609_05',
    title: 'Streaming & Cinema',
    amount: 95,
    category: 'Entertainment',
    type: 'expense',
    date: '2026-09-24',
    description: 'Subscriptions and weekend tickets',
  },
  {
    id: 'tx_202608_01',
    title: 'Monthly Salary',
    amount: 5200,
    category: 'Salary',
    type: 'income',
    date: '2026-08-01',
    description: 'August payroll deposit',
  },
  {
    id: 'tx_202608_02',
    title: 'Apartment Rent',
    amount: 1450,
    category: 'Housing',
    type: 'expense',
    date: '2026-08-02',
    description: 'August lease payment',
  },
  {
    id: 'tx_202608_03',
    title: 'Groceries & Pantry',
    amount: 520,
    category: 'Food',
    type: 'expense',
    date: '2026-08-11',
    description: 'Household pantry restock',
  },
  {
    id: 'tx_202608_04',
    title: 'Commute & Rideshare',
    amount: 165,
    category: 'Transport',
    type: 'expense',
    date: '2026-08-18',
    description: 'Airport transfers and transit',
  },
];

function generateUniqueId() {
  const randomPart = Math.random().toString(36).slice(2, 7);
  return `tx_${Date.now()}_${randomPart}`;
}

function normalizeTransaction(raw) {
  return {
    id: String(raw.id || generateUniqueId()),
    title: String(raw.title || '').trim(),
    amount: Number(raw.amount) || 0,
    category: String(raw.category || 'Other').trim(),
    type: raw.type === 'income' ? 'income' : 'expense',
    date: String(raw.date || '').slice(0, 10),
    description: String(raw.description || '').trim(),
  };
}

/**
 * Initialize LocalStorage on first visit.
 * Uses an explicit INITIALIZED flag so deleting all entries keeps [] across reloads.
 */
export function initStorage() {
  try {
    const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (!initialized) {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(SAMPLE_TRANSACTIONS));
      localStorage.setItem(STORAGE_KEYS.BUDGET, JSON.stringify(DEFAULT_BUDGET));
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    }
  } catch (err) {
    console.error('Failed to initialize storage:', err);
  }
}

/**
 * Retrieve all transactions.
 * Future API equivalent: GET /api/transactions
 */
export function getTransactions() {
  initStorage();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeTransaction) : [];
  } catch (err) {
    console.error('Failed to read transactions from storage:', err);
    return [];
  }
}

/**
 * Persist full transaction list.
 */
export function saveTransactions(transactions) {
  try {
    const normalized = Array.isArray(transactions) ? transactions.map(normalizeTransaction) : [];
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(normalized));
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    return normalized;
  } catch (err) {
    console.error('Failed to save transactions:', err);
    throw err;
  }
}

/**
 * Retrieve a single transaction by ID.
 * Future API equivalent: GET /api/transactions/:id
 */
export function getTransactionById(id) {
  const transactions = getTransactions();
  return transactions.find((tx) => tx.id === id) || null;
}

/**
 * Add a new transaction.
 * Future API equivalent: POST /api/transactions
 */
export function addTransaction(txInput) {
  const transactions = getTransactions();
  const newTransaction = normalizeTransaction({
    ...txInput,
    id: generateUniqueId(),
  });
  transactions.unshift(newTransaction);
  saveTransactions(transactions);
  return newTransaction;
}

/**
 * Update an existing transaction by ID.
 * Future API equivalent: PUT /api/transactions/:id
 */
export function updateTransaction(id, updates) {
  const transactions = getTransactions();
  const index = transactions.findIndex((tx) => tx.id === id);
  if (index === -1) return null;

  const updated = normalizeTransaction({
    ...transactions[index],
    ...updates,
    id,
  });
  transactions[index] = updated;
  saveTransactions(transactions);
  return updated;
}

/**
 * Delete a transaction by ID.
 * Future API equivalent: DELETE /api/transactions/:id
 */
export function deleteTransaction(id) {
  const transactions = getTransactions();
  const next = transactions.filter((tx) => tx.id !== id);
  if (next.length === transactions.length) return false;
  saveTransactions(next);
  return true;
}

/**
 * Retrieve monthly budget configuration.
 * Future API equivalent: GET /api/budget
 */
export function getBudget() {
  initStorage();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BUDGET);
    if (!raw) return { monthlyLimit: 0, updatedAt: null };
    const parsed = JSON.parse(raw);
    return {
      monthlyLimit: Number(parsed.monthlyLimit) || 0,
      updatedAt: parsed.updatedAt || null,
    };
  } catch (err) {
    console.error('Failed to read budget:', err);
    return { monthlyLimit: 0, updatedAt: null };
  }
}

/**
 * Save monthly budget configuration.
 * Future API equivalent: PUT /api/budget
 */
export function saveBudget(budgetData) {
  try {
    const payload = {
      monthlyLimit: Math.max(0, Number(budgetData.monthlyLimit) || 0),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.BUDGET, JSON.stringify(payload));
    return payload;
  } catch (err) {
    console.error('Failed to save budget:', err);
    throw err;
  }
}

/**
 * Restore built-in sample dataset.
 */
export function resetSampleData() {
  saveTransactions(SAMPLE_TRANSACTIONS);
  saveBudget(DEFAULT_BUDGET);
}

/**
 * Clear all transactions while preserving initialized state.
 */
export function clearAllTransactions() {
  saveTransactions([]);
}
