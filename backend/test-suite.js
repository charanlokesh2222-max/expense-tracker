const http = require('http');
const stream = require('stream');
const app = require('./src/server');
const db = require('./src/config/database');

function makeRequest(app, { method = 'GET', url = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const socket = new stream.Duplex({
      read() {},
      write(chunk, enc, cb) { cb(); },
    });

    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;

    let bodyStr = null;
    if (body !== null && body !== undefined) {
      bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    }

    req.headers = {
      host: 'localhost',
      ...(bodyStr ? {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(bodyStr),
      } : {}),
      ...headers,
    };

    const res = new http.ServerResponse(req);
    const chunks = [];
    res.assignSocket(new stream.Writable({
      write(chunk, enc, cb) {
        chunks.push(chunk);
        cb();
      },
    }));

    res.on('finish', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const headerEnd = raw.indexOf('\r\n\r\n');
      const rawHeaders = headerEnd !== -1 ? raw.slice(0, headerEnd) : '';
      const rawBody = headerEnd !== -1 ? raw.slice(headerEnd + 4) : raw;

      let parsedBody = rawBody;
      try {
        parsedBody = JSON.parse(rawBody);
      } catch (e) {
        // Leave as string (e.g. for HTML / CSS)
      }

      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        body: parsedBody,
        rawHeaders,
      });
    });

    res.on('error', reject);

    app.handle(req, res);

    if (bodyStr) {
      req.push(bodyStr);
    }
    req.push(null);
  });
}

async function runTestSuite() {
  const tests = [];
  function assert(name, expected, actual, passed, details = '') {
    tests.push({ name, expected, actual, passed, details });
    const mark = passed ? 'PASS' : 'FAIL';
    console.log(`[${mark}] ${name} -> Expected: ${expected} | Got: ${actual}`);
    if (!passed && details) {
      console.error('       Error Details:', details);
    }
  }

  console.log('====================================================');
  console.log('   LEDGERFLOW BACKEND TEST SUITE - PHASE 8 TESTS    ');
  console.log('====================================================\n');

  // --- HEALTH CHECK ---
  const t1 = await makeRequest(app, { url: '/api/health' });
  assert('GET /api/health (Status Code)', '200', `${t1.status}`, t1.status === 200);
  assert('GET /api/health (Response Body)', '{ success: true, status: ok }', JSON.stringify(t1.body), t1.body?.success === true && t1.body?.status === 'ok');

  // --- GET TRANSACTIONS (LIST) ---
  const t2 = await makeRequest(app, { url: '/api/transactions' });
  assert('GET /api/transactions (Status Code)', '200', `${t2.status}`, t2.status === 200);
  assert('GET /api/transactions (Is Array)', 'true', `${Array.isArray(t2.body?.data)}`, Array.isArray(t2.body?.data));

  // --- VALIDATION: MISSING TITLE ---
  const t3 = await makeRequest(app, {
    method: 'POST',
    url: '/api/transactions',
    body: { amount: 50, category: 'Food', type: 'expense', date: '2026-11-14' },
  });
  assert('POST /api/transactions (Missing Title -> 400)', '400', `${t3.status}`, t3.status === 400 && t3.body?.success === false);

  // --- VALIDATION: NEGATIVE AMOUNT ---
  const t4 = await makeRequest(app, {
    method: 'POST',
    url: '/api/transactions',
    body: { title: 'Coffee', amount: -25, category: 'Food', type: 'expense', date: '2026-11-14' },
  });
  assert('POST /api/transactions (Negative Amount -> 400)', '400', `${t4.status}`, t4.status === 400 && t4.body?.success === false);

  // --- VALIDATION: WRONG TYPE ---
  const t5 = await makeRequest(app, {
    method: 'POST',
    url: '/api/transactions',
    body: { title: 'Bonus', amount: 100, category: 'Salary', type: 'crypto', date: '2026-11-14' },
  });
  assert('POST /api/transactions (Wrong Type -> 400)', '400', `${t5.status}`, t5.status === 400 && t5.body?.success === false);

  // --- VALIDATION: INVALID DATE ---
  const t6 = await makeRequest(app, {
    method: 'POST',
    url: '/api/transactions',
    body: { title: 'Dinner', amount: 45, category: 'Food', type: 'expense', date: 'not-a-date' },
  });
  assert('POST /api/transactions (Invalid Date -> 400)', '400', `${t6.status}`, t6.status === 400 && t6.body?.success === false);

  // --- CREATE INCOME TRANSACTION ---
  const t7 = await makeRequest(app, {
    method: 'POST',
    url: '/api/transactions',
    body: {
      title: 'Freelance Design Retainer',
      amount: 1500.75,
      category: 'Freelance',
      type: 'income',
      date: '2026-11-05',
      description: 'UI consulting contract',
    },
  });
  assert('POST /api/transactions (Create Income -> 201)', '201', `${t7.status}`, t7.status === 201);
  const incomeId = t7.body?.data?.id;
  assert('Created Income has correct values', 'amount=1500.75, type=income', `amount=${t7.body?.data?.amount}, type=${t7.body?.data?.type}`, t7.body?.data?.amount === 1500.75 && t7.body?.data?.type === 'income');

  // --- CREATE EXPENSE TRANSACTION ---
  const t8 = await makeRequest(app, {
    method: 'POST',
    url: '/api/transactions',
    body: {
      title: 'Grocery Superstore',
      amount: 220.50,
      category: 'Food',
      type: 'expense',
      date: '2026-11-08',
      description: 'Weekly groceries',
    },
  });
  assert('POST /api/transactions (Create Expense -> 201)', '201', `${t8.status}`, t8.status === 201);
  const expenseId = t8.body?.data?.id;
  assert('Created Expense has correct values', 'amount=220.5, type=expense', `amount=${t8.body?.data?.amount}, type=${t8.body?.data?.type}`, t8.body?.data?.amount === 220.5 && t8.body?.data?.type === 'expense');

  // --- GET TRANSACTION BY ID ---
  const t9 = await makeRequest(app, { url: `/api/transactions/${incomeId}` });
  assert('GET /api/transactions/:id (Existing -> 200)', '200', `${t9.status}`, t9.status === 200 && t9.body?.data?.id === incomeId);

  // --- GET TRANSACTION WITH NON-EXISTENT ID ---
  const t10 = await makeRequest(app, { url: '/api/transactions/888888' });
  assert('GET /api/transactions/:id (Non-existent -> 404)', '404', `${t10.status}`, t10.status === 404 && t10.body?.success === false);

  // --- GET TRANSACTION WITH INVALID ID (STRING) ---
  const t11 = await makeRequest(app, { url: '/api/transactions/invalid-id' });
  assert('GET /api/transactions/:id (Invalid format -> 400)', '400', `${t11.status}`, t11.status === 400 && t11.body?.success === false);

  // --- PUT UPDATE TRANSACTION ---
  const t12 = await makeRequest(app, {
    method: 'PUT',
    url: `/api/transactions/${incomeId}`,
    body: {
      title: 'Freelance Design Retainer (Updated with bonus)',
      amount: 1800.00,
    },
  });
  assert('PUT /api/transactions/:id (Update -> 200)', '200', `${t12.status}`, t12.status === 200 && t12.body?.data?.amount === 1800);

  // --- PUT UPDATE TRANSACTION WITH INVALID AMOUNT ---
  const t13 = await makeRequest(app, {
    method: 'PUT',
    url: `/api/transactions/${incomeId}`,
    body: { amount: -50 },
  });
  assert('PUT /api/transactions/:id (Negative amount -> 400)', '400', `${t13.status}`, t13.status === 400 && t13.body?.success === false);

  // --- PUT UPDATE TRANSACTION WITH NON-EXISTENT ID ---
  const t14 = await makeRequest(app, {
    method: 'PUT',
    url: '/api/transactions/999999',
    body: { title: 'Does not exist' },
  });
  assert('PUT /api/transactions/:id (Non-existent -> 404)', '404', `${t14.status}`, t14.status === 404 && t14.body?.success === false);

  // --- DELETE TRANSACTION ---
  const t15 = await makeRequest(app, { method: 'DELETE', url: `/api/transactions/${expenseId}` });
  assert('DELETE /api/transactions/:id (Success -> 200)', '200', `${t15.status}`, t15.status === 200 && t15.body?.success === true);

  // --- DELETE TRANSACTION AGAIN (404) ---
  const t16 = await makeRequest(app, { method: 'DELETE', url: `/api/transactions/${expenseId}` });
  assert('DELETE /api/transactions/:id (Already deleted -> 404)', '404', `${t16.status}`, t16.status === 404 && t16.body?.success === false);

  // Clean up any test records for test year 2099 if previously run
  db.prepare('DELETE FROM monthly_budgets WHERE year = 2099').run();

  // --- BUDGETS: POST CREATE BUDGET ---
  const testYear = 2099;
  const testMonth = 5;
  const t17 = await makeRequest(app, {
    method: 'POST',
    url: '/api/budgets',
    body: { year: testYear, month: testMonth, amount: 3500 },
  });
  assert('POST /api/budgets (Create -> 201)', '201', `${t17.status}`, t17.status === 201 && t17.body?.data?.amount === 3500);
  const budgetId = t17.body?.data?.id;

  // --- BUDGETS: POST DUPLICATE BUDGET (409) ---
  const t18 = await makeRequest(app, {
    method: 'POST',
    url: '/api/budgets',
    body: { year: testYear, month: testMonth, amount: 3800 },
  });
  assert('POST /api/budgets (Duplicate year/month -> 409)', '409', `${t18.status}`, t18.status === 409 && t18.body?.success === false);

  // --- BUDGETS: POST INVALID MONTH (400) ---
  const t19 = await makeRequest(app, {
    method: 'POST',
    url: '/api/budgets',
    body: { year: 2026, month: 15, amount: 3000 },
  });
  assert('POST /api/budgets (Month > 12 -> 400)', '400', `${t19.status}`, t19.status === 400 && t19.body?.success === false);

  // --- BUDGETS: GET BY YEAR AND MONTH ---
  const t20 = await makeRequest(app, { url: `/api/budgets/${testYear}/${testMonth}` });
  assert('GET /api/budgets/:year/:month (Found -> 200)', '200', `${t20.status}`, t20.status === 200 && t20.body?.data?.amount === 3500);

  // --- BUDGETS: GET BY YEAR AND MONTH NOT FOUND ---
  const t21 = await makeRequest(app, { url: '/api/budgets/2020/5' });
  assert('GET /api/budgets/:year/:month (Not Found -> 404)', '404', `${t21.status}`, t21.status === 404 && t21.body?.success === false);

  // --- BUDGETS: PUT UPDATE BUDGET ---
  const t22 = await makeRequest(app, {
    method: 'PUT',
    url: `/api/budgets/${budgetId}`,
    body: { amount: 3750 },
  });
  assert('PUT /api/budgets/:id (Update -> 200)', '200', `${t22.status}`, t22.status === 200 && t22.body?.data?.amount === 3750);

  // --- UNKNOWN API ROUTE ---
  const t23 = await makeRequest(app, { url: '/api/unknown-endpoint-xyz' });
  assert('GET /api/unknown-endpoint-xyz (404 JSON)', '404', `${t23.status}`, t23.status === 404 && t23.body?.success === false);

  // --- VERIFY STATIC FRONTEND SERVING CONFIGURATION ---
  const fs = require('fs');
  const path = require('path');
  const frontendDir = path.resolve(__dirname, '../');
  const hasIndexHtml = fs.existsSync(path.join(frontendDir, 'index.html'));
  const hasStyleCss = fs.existsSync(path.join(frontendDir, 'css/style.css'));
  const hasAppJs = fs.existsSync(path.join(frontendDir, 'js/app.js'));

  assert('Frontend Root Files: index.html exists in served directory', 'true', `${hasIndexHtml}`, hasIndexHtml);
  assert('Frontend Static CSS: css/style.css exists in served directory', 'true', `${hasStyleCss}`, hasStyleCss);
  assert('Frontend Static JS: js/app.js exists in served directory', 'true', `${hasAppJs}`, hasAppJs);

  // --- DATABASE PERSISTENCE CHECK ---
  const dbTx = db.prepare('SELECT id, title, amount, type FROM transactions WHERE id = ?').get(incomeId);
  assert('DB Persistence: Transaction saved in SQLite', `amount=1800, type=income`, `amount=${dbTx?.amount}, type=${dbTx?.type}`, dbTx?.amount === 1800 && dbTx?.type === 'income');

  const dbBudget = db.prepare('SELECT id, year, month, amount FROM monthly_budgets WHERE id = ?').get(budgetId);
  assert('DB Persistence: Budget saved in SQLite', `amount=3750, year=2099, month=5`, `amount=${dbBudget?.amount}, year=${dbBudget?.year}, month=${dbBudget?.month}`, dbBudget?.amount === 3750 && dbBudget?.year === 2099 && dbBudget?.month === 5);

  // --- FRONTEND CALCULATION VERIFICATION ---
  const transactionsModule = await import('../js/transactions.js');
  // Load transactions directly from SQLite to test calculation functions
  const allDbTransactions = db.prepare('SELECT * FROM transactions').all();
  const summaryTotals = transactionsModule.calculateSummaryTotals(allDbTransactions, '2026-11');
  assert('Dashboard Calculation: Total Balance = Total Income - Total Expenses', 'true', `${summaryTotals.totalBalance === (summaryTotals.totalIncome - summaryTotals.totalExpenses)}`, summaryTotals.totalBalance === (summaryTotals.totalIncome - summaryTotals.totalExpenses));

  console.log('\n====================================================');
  const allPassed = tests.every(t => t.passed);
  console.log(`TOTAL TESTS: ${tests.length} | PASSED: ${tests.filter(t => t.passed).length} | FAILED: ${tests.filter(t => !t.passed).length}`);
  console.log('====================================================');
  process.exitCode = allPassed ? 0 : 1;
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exitCode = 1;
});
