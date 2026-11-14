const db = require('../config/database');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateTransactionInput(body, isUpdate = false) {
  const { title, amount, category, type, date, description } = body;
  const errors = [];

  if (!isUpdate || title !== undefined) {
    if (!title || typeof title !== 'string' || title.trim() === '') {
      errors.push('Title is required and must be a non-empty string');
    }
  }

  if (!isUpdate || amount !== undefined) {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      errors.push('Amount must be a number greater than 0');
    }
  }

  if (!isUpdate || type !== undefined) {
    if (type !== 'income' && type !== 'expense') {
      errors.push("Type must be either 'income' or 'expense'");
    }
  }

  if (!isUpdate || category !== undefined) {
    if (!category || typeof category !== 'string' || category.trim() === '') {
      errors.push('Category is required and must be a non-empty string');
    }
  }

  if (!isUpdate || date !== undefined) {
    if (!date || typeof date !== 'string' || !DATE_REGEX.test(date)) {
      errors.push('Date is required and must be in YYYY-MM-DD format');
    }
  }

  if (description !== undefined && description !== null && typeof description !== 'string') {
    errors.push('Description must be a string');
  }

  return errors;
}

// GET /api/transactions
function getAllTransactions(req, res, next) {
  try {
    const stmt = db.prepare(`
      SELECT id, title, amount, category, type, date, description, created_at
      FROM transactions
      ORDER BY date DESC, id DESC
    `);
    const transactions = stmt.all();
    res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/transactions/:id
function getTransactionById(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: 'ID must be a valid positive integer',
      });
    }

    const stmt = db.prepare(`
      SELECT id, title, amount, category, type, date, description, created_at
      FROM transactions
      WHERE id = ?
    `);
    const transaction = stmt.get(id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: `Transaction with ID ${id} not found`,
      });
    }

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/transactions
function createTransaction(req, res, next) {
  try {
    const errors = validateTransactionInput(req.body, false);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: errors.join('; '),
      });
    }

    const { title, amount, category, type, date, description } = req.body;
    const stmt = db.prepare(`
      INSERT INTO transactions (title, amount, category, type, date, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      title.trim(),
      Number(Number(amount).toFixed(2)),
      category.trim(),
      type,
      date.trim(),
      description ? description.trim() : null
    );

    const created = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/transactions/:id
function updateTransaction(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: 'ID must be a valid positive integer',
      });
    }

    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `Transaction with ID ${id} not found`,
      });
    }

    const errors = validateTransactionInput(req.body, true);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: errors.join('; '),
      });
    }

    const title = req.body.title !== undefined ? req.body.title.trim() : existing.title;
    const amount = req.body.amount !== undefined ? Number(Number(req.body.amount).toFixed(2)) : existing.amount;
    const category = req.body.category !== undefined ? req.body.category.trim() : existing.category;
    const type = req.body.type !== undefined ? req.body.type : existing.type;
    const date = req.body.date !== undefined ? req.body.date.trim() : existing.date;
    const description = req.body.description !== undefined
      ? (req.body.description ? req.body.description.trim() : null)
      : existing.description;

    const stmt = db.prepare(`
      UPDATE transactions
      SET title = ?, amount = ?, category = ?, type = ?, date = ?, description = ?
      WHERE id = ?
    `);
    stmt.run(title, amount, category, type, date, description, id);

    const updated = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/transactions/:id
function deleteTransaction(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: 'ID must be a valid positive integer',
      });
    }

    const stmt = db.prepare('DELETE FROM transactions WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: `Transaction with ID ${id} not found`,
      });
    }

    res.status(200).json({
      success: true,
      message: `Transaction ${id} deleted successfully`,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};
