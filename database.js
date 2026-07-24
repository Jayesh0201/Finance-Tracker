const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'finance.db'));

// SQLite does not enforce foreign keys unless this pragma is set per connection.
db.exec('PRAGMA foreign_keys = ON;');

// Runs once when the app starts. It creates tables if they do not already exist.
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

function all(sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}
function run(sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function (error) {
    if (error) reject(error); else resolve({ id: this.lastID, changes: this.changes });
  }));
}

module.exports = { all, get, run };
