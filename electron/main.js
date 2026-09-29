const { app, BrowserWindow, ipcMain, Menu, nativeTheme } = require('electron');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { openDatabase } = require('./db');
const { htmlToText, defaultJavaTemplate } = require('./leetcode');
const {
  detectLinks,
  listModels,
  complete,
  parseJsonText,
  reviewSchema,
} = require('./agent');
const { explainFile, presentExplain } = require('./explain');

nativeTheme.themeSource = 'dark';

function installAppMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        }]
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    ...(!isMac
      ? [{
          label: 'File',
          submenu: [{ role: 'quit' }],
        }]
      : []),
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function readPathLines(file) {
  try {
    return fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
  } catch {
    return [];
  }
}

function macPathDirs() {
  const dirs = readPathLines('/etc/paths');
  try {
    for (const name of fs.readdirSync('/etc/paths.d')) {
      dirs.push(...readPathLines(path.join('/etc/paths.d', name)));
    }
  } catch {
    /* ignore */
  }
  return dirs;
}

function loginShellPath() {
  const shell = process.env.SHELL || '/bin/zsh';
  const result = spawnSync(shell, ['-lc', 'printf %s "$PATH"'], {
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, TERM: 'dumb' },
  });
  if (result.status !== 0) return '';
  return (result.stdout || '').trim();
}

function enrichPath() {
  const current = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const seen = new Set(current);
  const extra = [];
  const add = (dir) => {
    if (!dir || seen.has(dir)) return;
    seen.add(dir);
    extra.push(dir);
  };
  for (const dir of loginShellPath().split(path.delimiter)) add(dir);
  if (process.platform === 'darwin') {
    for (const dir of macPathDirs()) add(dir);
  }
  if (extra.length) process.env.PATH = [...extra, ...current].join(path.delimiter);
}
enrichPath();

function adoptPracticeData() {
  const appData = app.getPath('appData');
  const next = path.join(appData, 'Bamboo Copter');
  const legacy = path.join(appData, 'LC');
  const hasDb = (dir) => fs.existsSync(path.join(dir, 'practice.db'));
  if (hasDb(next) || !hasDb(legacy) || fs.existsSync(next)) return;
  fs.renameSync(legacy, next);
}
adoptPracticeData();

let api;
let modelCache = { key: '', at: 0, models: [], error: '' };

function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, payload) => {
    try {
      return { ok: true, data: await fn(payload || {}) };
    } catch (error) {
      return { ok: false, error: error.message || String(error) };
    }
  });
}

function createWindow() {
  const darwin = process.platform === 'darwin';
  const icon = path.join(__dirname, '..', 'assets', 'icon.png');
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1080,
    minHeight: 680,
    title: 'Bamboo Copter',
    icon,
    backgroundColor: '#171717',
    autoHideMenuBar: true,
    titleBarStyle: darwin ? 'hiddenInset' : 'default',
    trafficLightPosition: darwin ? { x: 12, y: 18 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = (input.key || '').toLowerCase();
    if (key === 'r' && (input.meta || input.control)) {
      event.preventDefault();
    }
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

function activeLink(links) {
  return links.find((link) => link.id === 'codex') || null;
}

async function agentState() {
  const links = detectLinks();
  const link = activeLink(links);
  if (link && api.getSetting('provider') !== link.id) api.setSetting('provider', link.id);
  let models = [];
  let modelError = '';
  if (link) {
    const cacheKey = `${link.id}:${link.path}`;
    if (modelCache.key === cacheKey && Date.now() - modelCache.at < 10 * 60 * 1000) {
      models = modelCache.models;
      modelError = modelCache.error;
    } else {
      try {
        models = await listModels(link);
        modelCache = { key: cacheKey, at: Date.now(), models, error: '' };
      } catch (error) {
        modelError = error.message;
        modelCache = { key: cacheKey, at: Date.now(), models: [], error: modelError };
      }
    }
  }
  let model = api.getSetting('model');
  if (models.length > 0 && !models.some((item) => item.id === model)) {
    model = models[0].id;
    api.setSetting('model', model);
  }
  const current = models.find((item) => item.id === model);
  const efforts = current?.efforts || [];
  let reasoning = api.getSetting('reasoning');
  if (efforts.length > 0 && !efforts.includes(reasoning)) {
    reasoning = efforts.includes(current.defaultEffort) ? current.defaultEffort : efforts[0];
    api.setSetting('reasoning', reasoning);
  }
  if (efforts.length === 0) reasoning = '';
  return {
    links,
    provider: link ? link.id : '',
    model: model || '',
    models,
    modelError,
    reasoning: reasoning || '',
    fast: api.getSetting('fast') === '1',
  };
}

async function requireAgent() {
  const state = await agentState();
  const link = state.links.find((item) => item.id === state.provider);
  if (!link) throw new Error('没有找到 Codex');
  if (!state.model) throw new Error(state.modelError || '没有可用模型');
  return { link, model: state.model, reasoning: state.reasoning, fast: state.fast };
}

function catalogFile() {
  return path.join(__dirname, '..', 'assets', 'catalog.json');
}

function installCatalog() {
  const catalog = JSON.parse(fs.readFileSync(catalogFile(), 'utf8'));
  for (const problem of catalog.problems) {
    api.runQuiet(
      `INSERT INTO problems(slug, title, translated_title, difficulty, group_name, sort_index, content_html, java_template)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET
         title = excluded.title,
         translated_title = excluded.translated_title,
         difficulty = excluded.difficulty,
         group_name = excluded.group_name,
         sort_index = excluded.sort_index,
         content_html = excluded.content_html,
         java_template = excluded.java_template`,
      [
        problem.slug,
        problem.title,
        problem.translatedTitle || '',
        problem.difficulty,
        problem.groupName,
        problem.sortIndex,
        problem.contentHtml || '',
        problem.javaTemplate || '',
      ],
    );
  }
  api.flush();
}

function listProblemRows() {
  return api.all(
    'SELECT slug, title, translated_title, difficulty, group_name, sort_index FROM problems ORDER BY sort_index',
  );
}

async function problemDetail(slug) {
  const rows = api.all('SELECT * FROM problems WHERE slug = ?', [slug]);
  if (rows.length === 0) throw new Error('题目不存在');
  const draft = api.all('SELECT code FROM drafts WHERE slug = ?', [slug])[0];
  return {
    ...rows[0],
    code: draft ? draft.code : rows[0].java_template || defaultJavaTemplate(),
    explanation: presentExplain(readExplain(slug)),
  };
}

function readExplain(slug) {
  if (/^[a-z0-9-]+$/.test(slug)) {
    const bundled = path.join(__dirname, '..', 'assets', 'explains', `${slug}.json`);
    if (fs.existsSync(bundled)) return fs.readFileSync(bundled, 'utf8');
  }
  try {
    const file = explainFile(slug, app.getPath('userData'));
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  } catch {
    // 标识不合法时退回数据库.
  }
  const row = api.all('SELECT body FROM explanations WHERE slug = ?', [slug])[0];
  return row ? row.body : '';
}

function addMessage(slug, role, body) {
  api.run(
    'INSERT INTO messages(slug, role, body, created_at) VALUES(?, ?, ?, ?)',
    [slug, role, body, Date.now()],
  );
}

function contextPrompt(problem, code, instruction) {
  const statement = htmlToText(problem.content_html).slice(0, 6000);
  return [
    instruction,
    `题目: ${problem.translated_title || problem.title} (${problem.title})`,
    `难度: ${problem.difficulty}`,
    '题面:',
    statement || '(题面尚未加载)',
    '当前 Java 代码:',
    code || '(空)',
  ].join('\n\n');
}

app.whenReady().then(async () => {
  const database = await openDatabase(path.join(app.getPath('userData'), 'practice.db'));
  api = database;
  installCatalog();
  handle('agent:state', () => agentState());
  handle('agent:select', async ({ model, reasoning, fast }) => {
    if (model) api.setSetting('model', model);
    if (reasoning) api.setSetting('reasoning', reasoning);
    if (typeof fast === 'boolean') api.setSetting('fast', fast ? '1' : '0');
    return agentState();
  });
  handle('problems:list', () => listProblemRows());
  handle('problems:refresh', () => {
    installCatalog();
    return listProblemRows();
  });
  handle('problems:detail', ({ slug }) => problemDetail(slug));
  handle('draft:save', ({ slug, code }) => {
    api.run(
      'INSERT INTO drafts(slug, code, updated_at) VALUES(?, ?, ?) ON CONFLICT(slug) DO UPDATE SET code = excluded.code, updated_at = excluded.updated_at',
      [slug, code, Date.now()],
    );
    return true;
  });
  handle('records:board', () => practiceBoard());
  handle('history:list', ({ slug }) => api.all(
    'SELECT id, slug, code, created_at, verdict, summary, issues_json, provider, model FROM submissions WHERE slug = ? ORDER BY id DESC',
    [slug],
  ));
  handle('chat:list', ({ slug }) => api.all(
    'SELECT id, role, body, created_at FROM messages WHERE slug = ? ORDER BY id',
    [slug],
  ));
  handle('chat:send', async ({ slug, code, text }) => {
    const problem = await problemDetail(slug);
    const { link, model, reasoning, fast } = await requireAgent();
    addMessage(slug, 'user', text);
    const history = api.all(
      'SELECT role, body FROM messages WHERE slug = ? ORDER BY id DESC LIMIT 8',
      [slug],
    ).reverse();
    const transcript = history.map((item) => `${item.role === 'user' ? '用户' : '助手'}: ${item.body}`).join('\n');
    const prompt = [
      contextPrompt(problem, code, '你在 Bamboo Copter 里协助用户写这道 Hot 100. 用中文回答. 用户没有要求时不要直接给出完整正确代码, 先给提示.'),
      '最近对话:',
      transcript,
    ].join('\n\n');
    const reply = await complete(link, { model, reasoning, fast, prompt, timeoutMs: 180000 });
    addMessage(slug, 'assistant', reply);
    return { reply, model, provider: link.id };
  });
  handle('review:submit', async ({ slug, code }) => {
    const problem = await problemDetail(slug);
    const { link, model, reasoning, fast } = await requireAgent();
    const prompt = contextPrompt(
      problem,
      code,
      '你是算法题评审. 判断这份 Java 代码能否通过该题的全部测试用例. verdict 只能是 pass 或 fail, 必须二选一. 不能确认会通过全部用例时判 fail, 并把原因写进 issues. 不要给出完整正确代码. 不要运行命令. 只输出 schema 要求的 JSON.',
    );
    const text = await complete(link, { model, reasoning, fast, prompt, schema: reviewSchema, timeoutMs: 180000 });
    const review = parseJsonText(text);
    if (review.verdict !== 'pass') review.verdict = 'fail';
    api.run(
      'INSERT INTO submissions(slug, code, created_at, verdict, summary, issues_json, provider, model) VALUES(?, ?, ?, ?, ?, ?, ?, ?)',
      [slug, code, Date.now(), review.verdict, review.summary, JSON.stringify(review.issues || []), link.id, model],
    );
    const lines = [`判断: ${labelVerdict(review.verdict)}`, review.summary || ''];
    for (const issue of review.issues || []) {
      lines.push(`- ${issue.message} 提示: ${issue.hint}`);
    }
    addMessage(slug, 'assistant', lines.filter(Boolean).join('\n'));
    return review;
  });
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(path.join(__dirname, '..', 'assets', 'icon.png'));
  }
  app.setName('Bamboo Copter');
  installAppMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((error) => {
  console.error(error);
  app.quit();
});

function practiceBoard() {
  const totalRow = api.all('SELECT COUNT(*) AS total FROM problems')[0] || { total: 0 };
  const latest = api.all(
    `SELECT s.slug, s.verdict
     FROM submissions s
     JOIN (SELECT slug, MAX(id) AS id FROM submissions GROUP BY slug) latest ON latest.id = s.id`,
  );
  const bySlug = {};
  const counts = { pass: 0, fail: 0 };
  for (const row of latest) {
    const verdict = row.verdict === 'pass' ? 'pass' : 'fail';
    counts[verdict] += 1;
    bySlug[row.slug] = verdict;
  }
  const passedRows = api.all("SELECT DISTINCT slug FROM submissions WHERE verdict = 'pass'");
  const passed = {};
  for (const row of passedRows) passed[row.slug] = true;
  return {
    total: totalRow.total || 0,
    pass: counts.pass,
    fail: counts.fail,
    untouched: Math.max(0, (totalRow.total || 0) - latest.length),
    bySlug,
    passed,
  };
}

function labelVerdict(verdict) {
  if (verdict === 'pass') return '可以通过';
  return '不能通过';
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
