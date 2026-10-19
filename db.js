const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'assistant.db');
const db = new Database(dbPath);

// Enable foreign key constraints in SQLite
db.pragma('foreign_keys = ON');

// Initialize database schema from schema.sql
const schemaPath = path.join(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');
db.exec(schemaSql);

// Seed default user if not present (Student, user_id = 1)
const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
if (userCount === 0) {
  db.prepare('INSERT INTO users(name) VALUES (?)').run('Student');
}

module.exports = db;
