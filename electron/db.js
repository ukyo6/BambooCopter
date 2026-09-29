const fs = require('fs');
const initSqlJs = require('sql.js');
const path = require('path');

let db;
let dbFile;

function persist() {
  const data = db.export();
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  fs.writeFileSync(dbFile, Buffer.from(data));
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function run(sql, params = []) {
  db.run(sql, params);
  persist();
}

function runQuiet(sql, params = []) {
  db.run(sql, params);
}

async function openDatabase(file) {
  dbFile = file;
  const SQL = await initSqlJs({
    locateFile: (name) => {
      const file = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', name);
      const unpacked = file.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
      return unpacked !== file && fs.existsSync(unpacked) ? unpacked : file;
    },
  });
  db = fs.existsSync(file) ? new SQL.Database(fs.readFileSync(file)) : new SQL.Database();
  db.exec(`
    CREATE TABLE IF NOT EXISTS problems (
      slug TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      translated_title TEXT,
      difficulty TEXT,
      group_name TEXT,
      sort_index INTEGER NOT NULL,
      content_html TEXT,
      java_template TEXT
    );
    CREATE TABLE IF NOT EXISTS drafts (
      slug TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      code TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      verdict TEXT,
      summary TEXT,
      issues_json TEXT,
      provider TEXT,
      model TEXT
    );
    CREATE TABLE IF NOT EXISTS explanations (
      slug TEXT PRIMARY KEY,
      body TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      role TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  persist();
  return { all, run, runQuiet, flush: persist, getSetting, setSetting };
}

function getSetting(key) {
  const rows = all('SELECT value FROM settings WHERE key = ?', [key]);
  return rows[0] ? rows[0].value : null;
}

function setSetting(key, value) {
  run(
    'INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

module.exports = { openDatabase };
