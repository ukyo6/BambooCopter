const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const initSqlJs = require('sql.js');
const { openDatabase } = require('../electron/db');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
const utilityFile = path.join(__dirname, '..', 'renderer', 'review-utils.js');
function utils() {
  assert.ok(fs.existsSync(utilityFile), 'review-utils must provide verified source locations');
  return require(utilityFile);
}
const code = 'class Solution {\n\n  void solve() {\n    int bad = missing;\n    int next = 1;\n  }\n}';

test('code numbering preserves blank lines and Windows line endings', () => {
  assert.equal(utils().numberCode('first\r\n\r\nlast'), '1 | first\n2 | \n3 | last');
});
test('verified issue range stays anchored to the submitted source', () => {
  const [issue] = utils().normalizeIssues([{ message: '变量未声明', hint: '声明变量', line_start: 4, line_end: 4, code_excerpt: 'int bad = missing;' }], code);
  assert.deepEqual([issue.line_start, issue.line_end, issue.code_excerpt], [4, 4, 'int bad = missing;']);
});
test('wrong model line number relocates a unique source excerpt', () => {
  const [issue] = utils().normalizeIssues([{ message: '变量未声明', hint: '', line_start: 1, line_end: 1, code_excerpt: 'int bad = missing;' }], code);
  assert.deepEqual([issue.line_start, issue.line_end], [4, 4]);
});
test('ambiguous and invented excerpts do not fabricate locations', () => {
  for (const excerpt of ['same();', 'nonexistent();', '']) {
    const [issue] = utils().normalizeIssues([{ message: '错误', hint: '', line_start: 99, line_end: 99, code_excerpt: excerpt }], 'same();\nsame();');
    assert.deepEqual([issue.line_start, issue.line_end, issue.code_excerpt], [0, 0, '']);
  }
});
test('valid provided range can disambiguate repeated excerpts', () => {
  const [issue] = utils().normalizeIssues([{ message: '错误', hint: '', line_start: 2, line_end: 2, code_excerpt: 'same();' }], 'same();\nsame();');
  assert.deepEqual([issue.line_start, issue.line_end], [2, 2]);
});
test('multiline excerpt preserves the original source line range', () => {
  const [issue] = utils().normalizeIssues([{ message: '分支错误', hint: '', line_start: 99, line_end: 99, code_excerpt: 'if (x) {\nreturn;\n}' }], 'void solve() {\n  if (x) {\n    return;\n  }\n}');
  assert.deepEqual([issue.line_start, issue.line_end], [2, 4]);
});
test('legacy quoted code can locate a unique complete source fragment', () => {
  const [issue] = utils().normalizeIssues([{ message: '语法错误: `int bad = missing;`', hint: '' }], code);
  assert.deepEqual([issue.line_start, issue.line_end], [4, 4]);
});
test('legacy constructor errors can locate without backticks', () => {
  const [issue] = utils().normalizeIssues([{ message: 'new ArrayList([first], nums[second], nums[third]) 不符合 Java 语法', hint: '' }], 'class Solution {\n  void solve() {\n    list.add(new ArrayList([first], nums[second], nums[third]));\n  }\n}');
  assert.deepEqual([issue.line_start, issue.line_end], [3, 3]);
});
test('generic identifiers in legacy prose do not invent an error line', () => {
  const [issue] = utils().normalizeIssues([{ message: '变量 missing 未定义', hint: '' }], code);
  assert.deepEqual([issue.line_start, issue.line_end], [0, 0]);
});
test('legacy hints quoting correct example code do not locate an error', () => {
  const [issue] = utils().normalizeIssues([{ message: '第一个循环缺少边界判断', hint: '可以参照第二个循环 `for (int j = 0; j < n; j++) {`' }], 'for (int i = 0; i < n; i++) {\n}\nfor (int j = 0; j < n; j++) {\n}');
  assert.deepEqual([issue.line_start, issue.line_end], [0, 0]);
});
test('legacy ambiguous error fragments are not discarded in favor of unrelated unique code', () => {
  const [issue] = utils().normalizeIssues([{ message: '错误语句 `same();`, 另外声明 `int x=1;`', hint: '' }], 'same();\nsame();\nint x=1;');
  assert.deepEqual([issue.line_start, issue.line_end], [0, 0]);
});
test('explicit unlocated model issue stays unlocated even when prose mentions code', () => {
  const [issue] = utils().normalizeIssues([{ message: '整体思路错误, 不应只调用 `int bad = missing;`', hint: '', line_start: 0, line_end: 0, code_excerpt: '' }], code);
  assert.deepEqual([issue.line_start, issue.line_end], [0, 0]);
});
test('browser UMD exports the same source-location behavior without Node globals', () => {
  assert.ok(fs.existsSync(utilityFile));
  const browser = {};
  vm.runInNewContext(fs.readFileSync(utilityFile, 'utf8'), browser);
  assert.equal(browser.BambooReviewUtils.numberCode('a\n\nb'), '1 | a\n2 | \n3 | b');
});
test('review normalization drops malformed issues and accepts only explicit pass', () => {
  const review = utils().normalizeReview({ verdict: 'maybe', summary: 7, issues: [null, 'bad', { message: '错误', hint: 8 }] }, code);
  assert.equal(review.verdict, 'fail');
  assert.equal(review.summary, '');
  assert.equal(review.issues.length, 1);
  assert.equal(review.issues[0].hint, '');
});

const legacyBody = '判断: 不能通过\nLEGACY_REVIEW_SECRET\n- 未声明变量 提示: 声明变量';
async function writeLegacy(file) {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run('CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, role TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL)');
  db.run('CREATE TABLE submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, code TEXT NOT NULL, created_at INTEGER NOT NULL, verdict TEXT, summary TEXT, issues_json TEXT, provider TEXT, model TEXT)');
  db.run('INSERT INTO submissions VALUES (1, ?, ?, 1000, ?, ?, ?, ?, ?)', ['two-sum', code, 'fail', 'LEGACY_REVIEW_SECRET', JSON.stringify([{ message: '未声明变量', hint: '声明变量' }]), 'codex', 'model']);
  const rows = [
    ['two-sum', 'user', '请给我一个提示', 900],
    ['two-sum', 'assistant', '先考虑哈希表', 950],
    ['two-sum', 'assistant', legacyBody, 1001],
    ['two-sum', 'assistant', legacyBody, 15000],
    ['two-sum', 'assistant', '判断: 不能通过\n这只是普通说明', 1002],
  ];
  for (const row of rows) db.run('INSERT INTO messages(slug, role, body, created_at) VALUES (?, ?, ?, ?)', row);
  fs.writeFileSync(file, Buffer.from(db.export()));
  db.close();
}

test('legacy database preserves all bodies and marks only a reliable review match', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bamboo-review-db-'));
  const file = path.join(dir, 'practice.db');
  await writeLegacy(file);
  const db = await openDatabase(file);
  assert.ok(db.all('PRAGMA table_info(messages)').some((row) => row.name === 'kind'), 'messages need an explicit source kind');
  assert.deepEqual(db.all('SELECT id, kind FROM messages'), [
    { id: 1, kind: 'chat' }, { id: 2, kind: 'chat' }, { id: 3, kind: 'review' }, { id: 4, kind: 'chat' }, { id: 5, kind: 'chat' },
  ]);
  assert.equal(db.all('SELECT body FROM messages WHERE id = 3')[0].body, legacyBody);
  const reopened = await openDatabase(file);
  assert.equal(reopened.all('SELECT COUNT(*) AS total FROM messages')[0].total, 5);
  reopened.run('INSERT INTO messages(slug, role, body, created_at) VALUES (?, ?, ?, ?)', ['two-sum', 'user', '新聊天', 20000]);
  assert.equal(reopened.all('SELECT kind FROM messages WHERE id = 6')[0].kind, 'chat');
});

test('consecutive identical old reviews migrate one message per submission', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bamboo-review-duplicate-'));
  const file = path.join(dir, 'practice.db');
  await writeLegacy(file);
  const SQL = await initSqlJs();
  const legacy = new SQL.Database(fs.readFileSync(file));
  legacy.run('INSERT INTO submissions VALUES (2, ?, ?, 1100, ?, ?, ?, ?, ?)', ['two-sum', code, 'fail', 'LEGACY_REVIEW_SECRET', JSON.stringify([{ message: '未声明变量', hint: '声明变量' }]), 'codex', 'model']);
  legacy.run('INSERT INTO messages(slug, role, body, created_at) VALUES (?, ?, ?, ?)', ['two-sum', 'assistant', legacyBody, 1101]);
  fs.writeFileSync(file, Buffer.from(legacy.export()));
  legacy.close();
  const db = await openDatabase(file);
  assert.deepEqual(db.all("SELECT id FROM messages WHERE kind = 'review' ORDER BY id"), [{ id: 3 }, { id: 6 }]);
});
test('ambiguous full-body legacy matches are preserved as ordinary dialogue', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bamboo-review-ambiguous-'));
  const file = path.join(dir, 'practice.db');
  await writeLegacy(file);
  const SQL = await initSqlJs();
  const legacy = new SQL.Database(fs.readFileSync(file));
  legacy.run('INSERT INTO messages(slug, role, body, created_at) VALUES (?, ?, ?, ?)', ['two-sum', 'assistant', legacyBody, 1003]);
  fs.writeFileSync(file, Buffer.from(legacy.export()));
  legacy.close();
  const db = await openDatabase(file);
  assert.equal(db.all("SELECT COUNT(*) AS total FROM messages WHERE kind = 'review'")[0].total, 0);
  assert.equal(db.all('SELECT COUNT(*) AS total FROM messages')[0].total, 6);
});

async function startIpc(file, complete, options = {}) {
  const handlers = new Map();
  let ready;
  const electron = {
    app: {
      name: 'Bamboo Test', dock: { setIcon() {} },
      getPath: (name) => name === 'appData' ? path.dirname(path.dirname(file)) : path.dirname(file),
      whenReady: () => ({ then(fn) { ready = Promise.resolve().then(fn); return ready; } }),
      setName() {}, on() {}, quit() { throw new Error('Unexpected app quit'); },
    },
    BrowserWindow: class {
      static getAllWindows() { return []; }
      constructor() { this.webContents = { on() {} }; }
      loadFile() {}
    },
    ipcMain: { handle(name, fn) { handlers.set(name, fn); } },
    Menu: { buildFromTemplate: (value) => value, setApplicationMenu() {} }, nativeTheme: {},
  };
  const mainFile = path.join(__dirname, '..', 'electron', 'main.js');
  const localRequire = createRequire(mainFile);
  const agent = {
    detectLinks: options.detectLinks || (() => [{ id: 'codex', path: '/test/codex', label: 'Codex' }]),
    listModels: options.listModels || (async () => [{ id: 'model', efforts: [], defaultEffort: '' }]),
    complete,
    parseJsonText: localRequire('./agent').parseJsonText,
    reviewSchema: localRequire('./agent').reviewSchema,
  };
  vm.runInNewContext(fs.readFileSync(mainFile, 'utf8'), {
    require: (name) => name === 'electron' ? electron : name === './agent' ? agent : localRequire(name),
    __dirname: path.dirname(mainFile), process, console, Buffer, setTimeout, clearTimeout,
  }, { filename: mainFile });
  await ready;
  return { handlers, db: await openDatabase(file) };
}

test('real review IPC writes only a submission and returns verified line numbers and record id', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bamboo-review-ipc-'));
  const file = path.join(dir, 'practice.db');
  let prompt;
  const { handlers, db } = await startIpc(file, async (_link, options) => {
    prompt = options.prompt;
    return JSON.stringify({ verdict: 'fail', summary: 'NEW_REVIEW_SECRET', issues: [{ message: '未声明变量', hint: '', line_start: 1, line_end: 1, code_excerpt: 'int bad = missing;' }] });
  });
  const result = await handlers.get('review:submit')({}, { slug: 'two-sum', code });
  assert.equal(result.ok, true, result.error);
  assert.equal(db.all('SELECT COUNT(*) AS total FROM messages')[0].total, 0, 'submit must not create chat messages');
  assert.equal(db.all('SELECT COUNT(*) AS total FROM submissions')[0].total, 1);
  assert.equal(result.data.submissionId, 1);
  assert.equal(result.data.issues[0].line_start, 4);
  assert.ok(prompt.includes('2 | \n3 |   void solve()'), 'review prompt must retain editor line numbering');
  const saved = JSON.parse(db.all('SELECT issues_json FROM submissions')[0].issues_json);
  assert.equal(saved[0].line_start, 4);
});

test('review fails incorrect comments and retains the original comment line ranges', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bamboo-comment-review-')), 'practice.db');
  const commentedCode = [
    'import java.util.*;',
    'class Solution {',
    '',
    '  // 用哈希表查找补数.',
    '  /* 每个元素最多处理一次.',
    '   * 时间复杂度 O(1), 辅助空间 O(1).',
    '   */',
    '  public int[] twoSum(int[] nums, int target) {',
    '    Map<Integer, Integer> seen = new HashMap<>();',
    '    for (int i = 0; i < nums.length; i++) {',
    '      Integer j = seen.get(target - nums[i]);',
    '      if (j != null) return new int[] {j, i};',
    '      seen.put(nums[i], i);',
    '    }',
    '    return new int[0];',
    '  }',
    '}',
  ].join('\r\n');
  const excerpt = '/* 每个元素最多处理一次.\n   * 时间复杂度 O(1), 辅助空间 O(1).\n   */';
  let prompt;
  const { handlers, db } = await startIpc(file, async (_link, options) => {
    prompt = options.prompt;
    return JSON.stringify({ verdict: 'fail', summary: '代码逻辑可以通过, 但复杂度注释有误, 本次评审不通过.', issues: [{ message: '注释错误: 复杂度不是常数.', hint: '平均时间 O(n), 辅助空间 O(n).', line_start: 2, line_end: 2, code_excerpt: excerpt }] });
  });
  const result = await handlers.get('review:submit')({}, { slug: 'two-sum', code: commentedCode });
  assert.equal(result.ok, true, result.error);
  assert.ok(prompt.includes('4 |   // 用哈希表查找补数.'));
  assert.ok(prompt.includes('5 |   /* 每个元素最多处理一次.\n6 |    * 时间复杂度 O(1), 辅助空间 O(1).\n7 |    */'));
  assert.match(prompt, /同时检查.*注释/, 'review must explicitly request comment correctness');
  assert.ok(prompt.includes('注释有误也必须判 fail'), 'incorrect comments must fail the review even when code is correct');
  assert.equal(result.data.verdict, 'fail');
  assert.deepEqual([result.data.issues[0].line_start, result.data.issues[0].line_end], [5, 7]);
  assert.equal(result.data.issues[0].code_excerpt, excerpt);
  const saved = db.all('SELECT code, verdict, issues_json FROM submissions')[0];
  assert.equal(saved.code, commentedCode);
  assert.equal(saved.verdict, 'fail');
  assert.deepEqual(JSON.parse(saved.issues_json), result.data.issues);
  assert.equal(db.all('SELECT COUNT(*) AS total FROM messages')[0].total, 0);
});

test('real chat IPC excludes marked review messages from UI and LLM context', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bamboo-chat-ipc-'));
  const file = path.join(dir, 'practice.db');
  await writeLegacy(file);
  let prompt;
  const { handlers, db } = await startIpc(file, async (_link, options) => { prompt = options.prompt; return 'NORMAL_CHAT_REPLY'; });
  // 远离提交时间的同文普通消息仍保留, 本用例把它移到其他题以单独检验评审上下文隔离.
  db.run('UPDATE messages SET slug = ? WHERE id = 4', ['three-sum']);
  const listed = await handlers.get('chat:list')({}, { slug: 'two-sum' });
  assert.equal(listed.ok, true);
  assert.equal(listed.data.some((row) => row.id === 3), false, 'old review must be hidden from chat list');
  const result = await handlers.get('chat:send')({}, { slug: 'two-sum', code, text: 'USER_CHAT_ONLY' });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.data.reply, 'NORMAL_CHAT_REPLY');
  assert.ok(prompt.includes('USER_CHAT_ONLY'));
  assert.equal(prompt.includes('LEGACY_REVIEW_SECRET'), false, 'review must not contaminate recent dialogue');
  assert.ok(prompt.includes('4 |     int bad = missing;'), 'chat prompt needs original line numbers');
  assert.equal(db.all('SELECT COUNT(*) AS total FROM messages WHERE kind = ?', ['review'])[0].total, 1);
  assert.equal(db.all('SELECT COUNT(*) AS total FROM messages WHERE kind = ?', ['chat'])[0].total, 6);
});

test('switching the CLI routes both reviews and chat while preserving Codex settings', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bamboo-provider-')), 'practice.db');
  const calls = [];
  const links = [{ id: 'codex', label: 'Codex CLI', path: '/test/codex' }, { id: 'deepseek', label: 'DeepSeek CLI', path: '/test/dsh' }];
  const { handlers, db } = await startIpc(file, async (link, options) => {
    calls.push({ provider: link.id, model: options.model });
    return options.schema ? JSON.stringify({ verdict: 'fail', summary: '错误', issues: [] }) : '普通回复';
  }, { detectLinks: () => links, listModels: async link => link.id === 'codex'
    ? [{ id: 'codex-model', efforts: ['low', 'high'], defaultEffort: 'high' }]
    : [{ id: 'deepseek-flash', efforts: [] }, { id: 'deepseek-v4-pro', efforts: [] }] });
  await handlers.get('agent:select')({}, { provider: 'codex', model: 'codex-model', reasoning: 'low', fast: true });
  const selected = await handlers.get('agent:select')({}, { provider: 'deepseek', model: 'deepseek-v4-pro' });
  assert.equal(selected.ok, true, selected.error);
  assert.equal(selected.data.provider, 'deepseek');
  assert.equal(selected.data.fast, false);
  assert.equal(selected.data.fastSupported, false);
  assert.equal(selected.data.reasoning, '');
  const reviewed = await handlers.get('review:submit')({}, { slug: 'two-sum', code });
  assert.equal(reviewed.ok, true, reviewed.error);
  const chatted = await handlers.get('chat:send')({}, { slug: 'two-sum', code, text: '提示' });
  assert.equal(chatted.data.provider, 'deepseek');
  assert.deepEqual(calls, [{ provider: 'deepseek', model: 'deepseek-v4-pro' }, { provider: 'deepseek', model: 'deepseek-v4-pro' }]);
  assert.equal(db.all('SELECT provider FROM submissions')[0].provider, 'deepseek');
  const restored = await handlers.get('agent:select')({}, { provider: 'codex' });
  assert.equal(restored.data.model, 'codex-model');
  assert.equal(restored.data.reasoning, 'low');
  assert.equal(restored.data.fast, true);
});

test('an unavailable selected CLI never silently falls back to another engine', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bamboo-provider-missing-')), 'practice.db');
  const links = [{ id: 'codex', label: 'Codex', path: '/test/codex' }, { id: 'deepseek', label: 'DeepSeek', path: '/test/dsh' }];
  let calls = 0;
  const { handlers } = await startIpc(file, async () => { calls += 1; return '{}'; }, { detectLinks: () => links });
  await handlers.get('agent:select')({}, { provider: 'deepseek' });
  links.pop();
  const state = await handlers.get('agent:state')({}, {});
  assert.equal(state.data.provider, 'deepseek');
  const result = await handlers.get('review:submit')({}, { slug: 'two-sum', code });
  assert.equal(result.ok, false);
  assert.match(result.error, /DeepSeek/);
  assert.equal(calls, 0);
});

(async () => {
  let failures = 0;
  for (const { name, fn } of tests) {
    try { await fn(); process.stdout.write(`PASS ${name}\n`); }
    catch (error) { failures += 1; process.stderr.write(`FAIL ${name}: ${error.message}\n`); }
  }
  process.stdout.write(`${tests.length - failures}/${tests.length} review checks passed\n`);
  if (failures) process.exitCode = 1;
})();
