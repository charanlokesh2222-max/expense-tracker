const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables from backend/.env
const backendDir = path.resolve(__dirname, '../');
dotenv.config({ path: path.join(backendDir, '.env') });

// Require database config to ensure connection & schema initialization
require('./config/database');

const transactionRoutes = require('./routes/transactionRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;
const frontendDir = path.resolve(__dirname, '../../');

// Middlewares
app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(frontendDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);

// 404 handler for unknown /api routes
app.use('/api', notFoundHandler);

// Fallback to index.html for non-API route navigation
app.use((req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// Central error handler
app.use(errorHandler);

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`LedgerFlow server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
