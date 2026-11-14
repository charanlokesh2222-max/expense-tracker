const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const dotenv = require('dotenv');

// Load environment variables from backend/.env
const backendDir = path.resolve(__dirname, '../../');
dotenv.config({ path: path.join(backendDir, '.env') });

const dbRelativePath = process.env.DB_PATH || 'database/expense-tracker.db';
const dbPath = path.resolve(backendDir, dbRelativePath);

// Ensure the directory for the database file exists
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// Initialize SQLite database connection
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Automatically apply schema on startup (using CREATE TABLE IF NOT EXISTS)
const schemaPath = path.resolve(backendDir, 'database/schema.sql');
if (fs.existsSync(schemaPath)) {
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
}

module.exports = db;
