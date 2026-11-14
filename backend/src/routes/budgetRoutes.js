const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budgetController');

router.get('/:year/:month', budgetController.getBudgetByMonth);
router.post('/', budgetController.createBudget);
router.put('/:id', budgetController.updateBudget);

module.exports = router;
