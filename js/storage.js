/**
 * storage.js — Centralized Data Persistence Layer
 *
 * Backed by Node.js + Express + SQLite REST API.
 * Uses relative API endpoints with consistent JSON payloads.
 */

const API_BASE = '/api';

const STORAGE_KEYS = {
  TRANSACTIONS: 'ledgerflow_transactions_v1',
  BUDGET: 'ledgerflow_budget_v1',
  INITIALIZED: 'ledgerflow_initialized_v1',
  MIGRATED: 'ledgerflow_migrated_to_db_v1',
};

export const SAMPLE_TRANSACTIONS = [
  {
    title: 'Monthly Salary',
    amount: 5400,
    category: 'Salary',
    type: 'income',
    date: '2026-11-01',
    description: 'Primary engineering payroll deposit',
  },
  {
    title: 'Apartment Rent',
    amount: 1450,
    category: 'Housing',
    type: 'expense',
    date: '2026-11-02',
    description: 'November monthly lease payment',
  },
  {
    title: 'Electric & Fiber Internet',
    amount: 185,
    category: 'Utilities',
    type: 'expense',
    date: '2026-11-04',
    description: 'Monthly electricity bill and gigabit internet',
  },
  {
    title: 'UI Architecture Consulting',
    amount: 850,
    category: 'Freelance',
    type: 'income',
    date: '2026-11-06',
    description: 'Design system review retainer',
  },
  {
    title: 'Transit & Fuel Pass',
    amount: 140,
    category: 'Transport',
    type: 'expense',
    date: '2026-11-07',
    description: 'Commuter rail pass and fuel top-up',
  },
  {
    title: 'Dental & Pharmacy',
    amount: 210,
    category: 'Healthcare',
    type: 'expense',
    date: '2026-11-09',
    description: 'Routine checkup and prescription',
  },
  {
    title: 'Office Desk Monitor',
    amount: 390,
    category: 'Shopping',
    type: 'expense',
    date: '2026-11-11',
    description: '27-inch IPS display upgrade',
  },
  {
    title: 'Grocery Shopping',
    amount: 325,
    category: 'Food',
    type: 'expense',
    date: '2026-11-13',
    description: 'Weekly groceries and fresh produce',
  },
  {
    title: 'Monthly Salary',
    amount: 5400,
    category: 'Salary',
    type: 'income',
    date: '2026-10-01',
    description: 'October payroll deposit',
  },
  {
    title: 'Apartment Rent',
    amount: 1450,
    category: 'Housing',
    type: 'expense',
    date: '2026-10-02',
    description: 'October monthly lease payment',
  },
  {
    title: 'Whole Foods & Dining',
    amount: 640,
    category: 'Food',
    type: 'expense',
    date: '2026-10-12',
    description: 'Groceries and team lunches',
  },
  {
    title: 'Utilities & Water',
    amount: 172,
    category: 'Utilities',
    type: 'expense',
    date: '2026-10-15',
    description: 'Electricity, water, and internet',
  },
  {
    title: 'Autumn Conference Trip',
    amount: 480,
    category: 'Travel',
    type: 'expense',
    date: '2026-10-21',
    description: 'Regional rail tickets and hotel stay',
  },
  {
    title: 'Dividend Distribution',
    amount: 310,
    category: 'Investments',
    type: 'income',
    date: '2026-10-25',
    description: 'Quarterly index ETF payout',
  },
  {
    title: 'Monthly Salary',
    amount: 5200,
    category: 'Salary',
    type: 'income',
    date: '2026-09-01',
    description: 'September payroll deposit',
  },
  {
    title: 'Apartment Rent',
    amount: 1450,
    category: 'Housing',
    type: 'expense',
    date: '2026-09-02',
    description: 'September lease payment',
  },
  {
    title: 'Groceries & Market',
    amount: 590,
    category: 'Food',
    type: 'expense',
    date: '2026-09-14',
    description: 'Monthly household groceries',
  },
  {
    title: 'Technical Course',
    amount: 240,
    category: 'Education',
    type: 'expense',
    date: '2026-09-19',
    description: 'Systems architecture workshop',
  },
  {
    title: 'Streaming & Cinema',
    amount: 95,
    category: 'Entertainment',
    type: 'expense',
    date: '2026-09-24',
    description: 'Subscriptions and weekend tickets',
  },
  {
    title: 'Monthly Salary',
    amount: 5200,
    category: 'Salary',
    type: 'income',
    date: '2026-08-01',
    description: 'August payroll deposit',
  },
  {
    title: 'Apartment Rent',
    amount: 1450,
    category: 'Housing',
    type: 'expense',
    date: '2026-08-02',
    description: 'August lease payment',
  },
  {
    title: 'Groceries & Pantry',
    amount: 520,
    category: 'Food',
    type: 'expense',
    date: '2026-08-11',
    description: 'Household pantry restock',
  },
  {
    title: 'Commute & Rideshare',
    amount: 165,
    category: 'Transport',
    type: 'expense',
    date: '2026-08-18',
    description: 'Airport transfers and transit',
  },
];

export const DEFAULT_BUDGET = {
  monthlyLimit: 3200,
};

function parseMonthKey(monthKey) {
  if (monthKey && monthKey.includes('-')) {
    const [yearStr, monthStr] = monthKey.split('-');
    return {
      year: parseInt(yearStr, 10),
      month: parseInt(monthStr, 10),
    };
  }
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

/**
 * One-time migration of existing data from browser LocalStorage into the backend database.
 * Does not delete the original LocalStorage data (preserved as a backup).
 */
export async function migrateLocalStorageIfNeeded() {
  try {
    const migrated = localStorage.getItem(STORAGE_KEYS.MIGRATED);
    if (migrated === 'true') {
      return { migrated: false, count: 0 };
    }

    let importedCount = 0;
    const rawTx = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (rawTx) {
      let parsed = [];
      try {
        parsed = JSON.parse(rawTx);
      } catch (e) {
        parsed = [];
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        for (const item of parsed) {
          try {
            await fetch(`${API_BASE}/transactions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: item.title,
                amount: Number(item.amount),
                category: item.category,
                type: item.type,
                date: item.date,
                description: item.description || null,
              }),
            });
            importedCount += 1;
          } catch (err) {
            console.error('Failed to import transaction item during migration:', item, err);
          }
        }
      }
    }

    // Migrate budget if present
    const rawBudget = localStorage.getItem(STORAGE_KEYS.BUDGET);
    if (rawBudget) {
      try {
        const parsedB = JSON.parse(rawBudget);
        const limit = Number(parsedB.monthlyLimit);
        if (limit > 0) {
          const { year, month } = parseMonthKey('2026-11');
          await fetch(`${API_BASE}/budgets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year, month, amount: limit }),
          });
        }
      } catch (err) {
        console.error('Failed to import budget during migration:', err);
      }
    }

    localStorage.setItem(STORAGE_KEYS.MIGRATED, 'true');
    console.log(`Migration completed: ${importedCount} transactions imported to database.`);
    return { migrated: true, count: importedCount };
  } catch (err) {
    console.error('Error in migrateLocalStorageIfNeeded:', err);
    return { migrated: false, count: 0, error: err };
  }
}

/**
 * Initialize storage and trigger migration if required.
 */
export async function initStorage() {
  return await migrateLocalStorageIfNeeded();
}

/**
 * Retrieve all transactions from the API (ordered newest first).
 */
export async function getTransactions() {
  const response = await fetch(`${API_BASE}/transactions`);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to fetch transactions (HTTP ${response.status})`);
  }
  const result = await response.json();
  return Array.isArray(result.data) ? result.data : [];
}

/**
 * Retrieve a single transaction by ID.
 */
export async function getTransactionById(id) {
  const response = await fetch(`${API_BASE}/transactions/${id}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to fetch transaction ${id}`);
  }
  const result = await response.json();
  return result.data || null;
}

/**
 * Create a new transaction via API.
 */
export async function addTransaction(txInput) {
  const response = await fetch(`${API_BASE}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: txInput.title,
      amount: Number(txInput.amount),
      category: txInput.category,
      type: txInput.type,
      date: txInput.date,
      description: txInput.description || null,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to create transaction (HTTP ${response.status})`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * Update an existing transaction via API.
 */
export async function updateTransaction(id, updates) {
  const response = await fetch(`${API_BASE}/transactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to update transaction ${id}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * Delete a transaction via API.
 */
export async function deleteTransaction(id) {
  const response = await fetch(`${API_BASE}/transactions/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to delete transaction ${id}`);
  }

  return true;
}

/**
 * Retrieve monthly budget configuration for a specific month.
 */
export async function getBudget(monthKey = '2026-11') {
  const { year, month } = parseMonthKey(monthKey);
  const response = await fetch(`${API_BASE}/budgets/${year}/${month}`);

  if (response.status === 404) {
    return {
      id: null,
      monthlyLimit: 0,
      year,
      month,
    };
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to fetch budget for ${year}-${month}`);
  }

  const result = await response.json();
  return {
    id: result.data.id,
    monthlyLimit: Number(result.data.amount) || 0,
    year: result.data.year,
    month: result.data.month,
  };
}

/**
 * Save or update monthly budget configuration for a specific month.
 */
export async function saveBudget(budgetData, monthKey = '2026-11') {
  const { year, month } = parseMonthKey(monthKey);
  const limit = Math.max(0, Number(budgetData.monthlyLimit) || 0);

  // Check if budget exists for this month
  const checkRes = await fetch(`${API_BASE}/budgets/${year}/${month}`);
  if (checkRes.ok) {
    const existing = await checkRes.json();
    const updateRes = await fetch(`${API_BASE}/budgets/${existing.data.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: limit }),
    });

    if (!updateRes.ok) {
      const errorBody = await updateRes.json().catch(() => ({}));
      throw new Error(errorBody.error || 'Failed to update budget');
    }

    const updated = await updateRes.json();
    return {
      id: updated.data.id,
      monthlyLimit: Number(updated.data.amount),
      year: updated.data.year,
      month: updated.data.month,
    };
  }

  // If not found, create new
  const createRes = await fetch(`${API_BASE}/budgets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      year,
      month,
      amount: limit,
    }),
  });

  if (!createRes.ok) {
    const errorBody = await createRes.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Failed to save budget');
  }

  const created = await createRes.json();
  return {
    id: created.data.id,
    monthlyLimit: Number(created.data.amount),
    year: created.data.year,
    month: created.data.month,
  };
}

/**
 * Populate sample dataset into the database.
 */
export async function resetSampleData() {
  for (const sample of SAMPLE_TRANSACTIONS) {
    await addTransaction(sample);
  }
  await saveBudget(DEFAULT_BUDGET, '2026-11');
}
