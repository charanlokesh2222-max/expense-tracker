const db = require('../config/database');

// GET /api/budgets/:year/:month
function getBudgetByMonth(req, res, next) {
  try {
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);

    if (isNaN(year) || year < 1000 || year > 9999) {
      return res.status(400).json({
        success: false,
        error: 'Year must be a valid 4-digit integer',
      });
    }

    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        error: 'Month must be an integer between 1 and 12',
      });
    }

    const stmt = db.prepare(`
      SELECT id, month, year, amount, created_at
      FROM monthly_budgets
      WHERE year = ? AND month = ?
    `);
    const budget = stmt.get(year, month);

    if (!budget) {
      return res.status(404).json({
        success: false,
        error: `No budget found for ${year}-${String(month).padStart(2, '0')}`,
      });
    }

    res.status(200).json({
      success: true,
      data: budget,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/budgets
function createBudget(req, res, next) {
  try {
    const { month, year, amount } = req.body;
    const numMonth = parseInt(month, 10);
    const numYear = parseInt(year, 10);
    const numAmount = Number(amount);

    if (isNaN(numMonth) || numMonth < 1 || numMonth > 12) {
      return res.status(400).json({
        success: false,
        error: 'Month is required and must be an integer between 1 and 12',
      });
    }

    if (isNaN(numYear) || numYear < 1000 || numYear > 9999) {
      return res.status(400).json({
        success: false,
        error: 'Year is required and must be a valid 4-digit integer',
      });
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount is required and must be a number greater than 0',
      });
    }

    // Check if budget for (year, month) already exists
    const existing = db
      .prepare('SELECT id FROM monthly_budgets WHERE year = ? AND month = ?')
      .get(numYear, numMonth);

    if (existing) {
      return res.status(409).json({
        success: false,
        error: `A budget already exists for ${numYear}-${String(numMonth).padStart(2, '0')}`,
      });
    }

    const stmt = db.prepare(`
      INSERT INTO monthly_budgets (month, year, amount)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(numMonth, numYear, Number(numAmount.toFixed(2)));

    const created = db
      .prepare('SELECT id, month, year, amount, created_at FROM monthly_budgets WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/budgets/:id
function updateBudget(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: 'ID must be a valid positive integer',
      });
    }

    const existing = db.prepare('SELECT * FROM monthly_budgets WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `Budget with ID ${id} not found`,
      });
    }

    const { amount, month, year } = req.body;
    let newAmount = existing.amount;
    let newMonth = existing.month;
    let newYear = existing.year;

    if (amount !== undefined) {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Amount must be a number greater than 0',
        });
      }
      newAmount = Number(numAmount.toFixed(2));
    }

    if (month !== undefined) {
      const numMonth = parseInt(month, 10);
      if (isNaN(numMonth) || numMonth < 1 || numMonth > 12) {
        return res.status(400).json({
          success: false,
          error: 'Month must be an integer between 1 and 12',
        });
      }
      newMonth = numMonth;
    }

    if (year !== undefined) {
      const numYear = parseInt(year, 10);
      if (isNaN(numYear) || numYear < 1000 || numYear > 9999) {
        return res.status(400).json({
          success: false,
          error: 'Year must be a valid 4-digit integer',
        });
      }
      newYear = numYear;
    }

    // Check conflict if month or year is changing
    if (newMonth !== existing.month || newYear !== existing.year) {
      const conflict = db
        .prepare('SELECT id FROM monthly_budgets WHERE year = ? AND month = ? AND id != ?')
        .get(newYear, newMonth, id);
      if (conflict) {
        return res.status(409).json({
          success: false,
          error: `A budget already exists for ${newYear}-${String(newMonth).padStart(2, '0')}`,
        });
      }
    }

    const stmt = db.prepare(`
      UPDATE monthly_budgets
      SET amount = ?, month = ?, year = ?
      WHERE id = ?
    `);
    stmt.run(newAmount, newMonth, newYear, id);

    const updated = db
      .prepare('SELECT id, month, year, amount, created_at FROM monthly_budgets WHERE id = ?')
      .get(id);

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getBudgetByMonth,
  createBudget,
  updateBudget,
};
