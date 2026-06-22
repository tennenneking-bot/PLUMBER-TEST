// db.js
// This file sets up a tiny local database (SQLite) that lives in a single file
// on disk. It remembers:
//   1. Every conversation with a customer (so the AI has context across texts)
//   2. Every job that gets booked
//
// You don't need to install or run a separate database server - this just works
// out of the box, which is why it's the right choice for getting started fast.

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'receptionist.db'));

// Create tables if they don't already exist (safe to run every time the app starts)
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    phone_number TEXT PRIMARY KEY,
    messages TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT NOT NULL,
    issue_description TEXT,
    scheduled_time TEXT,
    estimated_price TEXT,
    status TEXT NOT NULL DEFAULT 'booked',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

/**
 * Get the conversation history for a phone number.
 * Returns an empty array if this is a brand new conversation.
 */
function getConversation(phoneNumber) {
  const row = db.prepare('SELECT * FROM conversations WHERE phone_number = ?').get(phoneNumber);
  if (!row) return { messages: [], status: 'active' };
  return { ...row, messages: JSON.parse(row.messages) };
}

/**
 * Save an updated conversation (call this after every new message, in or out).
 */
function saveConversation(phoneNumber, messages, status = 'active') {
  const existing = db.prepare('SELECT phone_number FROM conversations WHERE phone_number = ?').get(phoneNumber);
  if (existing) {
    db.prepare(`
      UPDATE conversations
      SET messages = ?, status = ?, updated_at = datetime('now')
      WHERE phone_number = ?
    `).run(JSON.stringify(messages), status, phoneNumber);
  } else {
    db.prepare(`
      INSERT INTO conversations (phone_number, messages, status)
      VALUES (?, ?, ?)
    `).run(phoneNumber, JSON.stringify(messages), status);
  }
}

/**
 * Record a booked job once the AI has confirmed one with the customer.
 */
function createJob({ phoneNumber, issueDescription, scheduledTime, estimatedPrice }) {
  const result = db.prepare(`
    INSERT INTO jobs (phone_number, issue_description, scheduled_time, estimated_price)
    VALUES (?, ?, ?, ?)
  `).run(phoneNumber, issueDescription, scheduledTime, estimatedPrice);
  return result.lastInsertRowid;
}

function getAllJobs() {
  return db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all();
}

module.exports = {
  getConversation,
  saveConversation,
  createJob,
  getAllJobs,
};
