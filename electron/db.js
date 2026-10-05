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
      created_at INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'chat'
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  if (!all('PRAGMA table_info(messages)').some((column) => column.name === 'kind')) {
    db.run("ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'chat'");
    markLegacyReviewMessages();
  }
  persist();
  return { all, run, runQuiet, flush: persist, getSetting, setSetting };
}

function markLegacyReviewMessages() {
  const submissions = all('SELECT slug, created_at, verdict, summary, issues_json FROM submissions ORDER BY slug, id');
  for (let index = 0; index < submissions.length; index += 1) {
    const submission = submissions[index];
    const next = submissions[index + 1];
    const nextTime = next?.slug === submission.slug ? next.created_at : null;
    let issues;
    try {
      issues = JSON.parse(submission.issues_json || '[]');
      if (!Array.isArray(issues)) continue;
    } catch {
      continue;
    }
    const verdict = submission.verdict === 'pass' ? '可以通过' : '不能通过';
    const lines = [`判断: ${verdict}`, submission.summary || ''];
    for (const issue of issues) {
      if (!issue || typeof issue !== 'object') continue;
      lines.push(`- ${issue.message} 提示: ${issue.hint}`);
    }
    const body = lines.filter(Boolean).join('\n');
    // 只匹配旧提交后紧邻的完整正文, 保留有歧义或仅包含判断字样的普通问答.
    const matches = all(
      `SELECT id FROM messages WHERE slug = ? AND role = 'assistant' AND kind = 'chat'
       AND body = ? AND created_at >= ? AND created_at <= ?
       AND (? IS NULL OR created_at < ?)`,
      [submission.slug, body, submission.created_at, submission.created_at + 5000, nextTime, nextTime],
    );
    if (matches.length === 1) db.run("UPDATE messages SET kind = 'review' WHERE id = ?", [matches[0].id]);
  }
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
