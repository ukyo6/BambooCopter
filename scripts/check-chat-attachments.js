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
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGNMPLGUgYGBiQEMABWOAdKOQJTaAAAAAElFTkSuQmCC', 'base64');
function attachment(name = '截图.png', bytes = png, mimeType = 'image/png') {
  return { name, mimeType, bytes: Uint8Array.from(bytes).buffer };
}
function temporaryDatabase() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bamboo-chat-image-')), 'practice.db');
}
async function startIpc(file, options = {}) {
  const handlers = new Map();
  const invocations = [];
  const openedImages = [];
  const openedLinks = [];
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
    nativeImage: { createFromBuffer(bytes) { return { isEmpty: () => !!options.invalidImage || bytes.length < 40, getSize: () => ({ width: 1, height: 1 }) }; } },
    shell: {
      openPath: async (value) => { openedImages.push(value); return ''; },
      openExternal: async (value) => { openedLinks.push(value); },
    },
  };
  const mainFile = path.join(__dirname, '..', 'electron', 'main.js');
  const localRequire = createRequire(mainFile);
  const agent = {
    detectLinks: () => [{ id: 'codex', path: '/test/codex', label: 'Codex' }],
    listModels: async () => [{ id: 'model', efforts: [], defaultEffort: '', supportsImages: options.supportsImages }],
    complete: async (_link, payload) => {
      invocations.push(payload);
      if (options.failModel) throw new Error('模型调用失败');
      return '**回复**';
    },
    parseJsonText: localRequire('./agent').parseJsonText,
    reviewSchema: localRequire('./agent').reviewSchema,
  };
  vm.runInNewContext(fs.readFileSync(mainFile, 'utf8'), {
    require: (name) => name === 'electron' ? electron : name === './agent' ? agent : localRequire(name),
    __dirname: path.dirname(mainFile), process, console, Buffer, setTimeout, clearTimeout,
  }, { filename: mainFile });
  await ready;
  return {
    invoke: (channel, payload) => handlers.get(channel)({}, payload),
    db: await openDatabase(file), invocations, openedImages, openedLinks,
  };
}

test('legacy message migration preserves records and defaults attachments to empty', async () => {
  const file = temporaryDatabase();
  const SQL = await initSqlJs();
  const legacy = new SQL.Database();
  legacy.run("CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, role TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'chat')");
  legacy.run('INSERT INTO messages(slug,role,body,created_at) VALUES(?,?,?,?)', ['two-sum', 'user', '旧文字不丢失', 1]);
  fs.writeFileSync(file, Buffer.from(legacy.export()));
  legacy.close();
  const db = await openDatabase(file);
  assert.deepEqual(db.all('SELECT id,body,attachments_json FROM messages'), [{ id: 1, body: '旧文字不丢失', attachments_json: '[]' }]);
  await openDatabase(file);
  assert.equal(db.all('SELECT COUNT(*) AS total FROM messages')[0].total, 1);
});

test('image chat persists exact bytes and history metadata while carrying real image paths', async () => {
  const file = temporaryDatabase();
  const { invoke, db, invocations } = await startIpc(file);
  const result = await invoke('chat:send', { slug: 'two-sum', code: 'class Solution {}', text: '解释图中的指针', attachments: [attachment()] });
  assert.equal(result.ok, true, result.error);
  const history = await invoke('chat:list', { slug: 'two-sum' });
  assert.equal(history.data.length, 2);
  const image = history.data[0].attachments[0];
  assert.match(image.id, /^[a-f0-9-]{36}$/);
  assert.equal(image.name, '截图.png');
  assert.equal(image.mimeType, 'image/png');
  assert.equal(image.size, png.length);
  assert.match(image.url, /^file:\/\//);
  assert.deepEqual(history.data[1].attachments, []);
  const stored = JSON.parse(db.all("SELECT attachments_json FROM messages WHERE role='user'")[0].attachments_json)[0];
  assert.equal(stored.id, image.id);
  assert.ok(!JSON.stringify(stored).includes(path.dirname(file)), 'metadata must not store absolute paths');
  assert.equal(invocations[0].images.length, 1);
  assert.deepEqual(fs.readFileSync(invocations[0].images[0].path), png);
  assert.equal(invocations[0].images[0].mimeType, 'image/png');
  assert.ok(invocations[0].prompt.includes('图片 1'));
  assert.ok(invocations[0].prompt.includes('解释图中的指针'));
  assert.ok(!invocations[0].prompt.includes(invocations[0].images[0].path), 'internal file paths do not belong in prompt text');
});

test('image-only message and subsequent text follow-up share the same image context', async () => {
  const { invoke, invocations } = await startIpc(temporaryDatabase());
  const first = await invoke('chat:send', { slug: 'two-sum', text: '', attachments: [attachment()] });
  assert.equal(first.ok, true, first.error);
  const second = await invoke('chat:send', { slug: 'two-sum', text: '这里的b怎么来的' });
  assert.equal(second.ok, true, second.error);
  assert.equal(invocations[1].images[0].path, invocations[0].images[0].path);
  assert.ok(invocations[1].prompt.includes('图片 1'));
  assert.ok(invocations[1].prompt.includes('这里的b怎么来的'));
  const anotherProblem = await invoke('chat:send', { slug: '3sum', text: '提示' });
  assert.equal(anotherProblem.ok, true, anotherProblem.error);
  assert.equal(invocations[2].images?.length || 0, 0);
});

test('recent image limit and transcript numbering refer to matching files', async () => {
  const { invoke, invocations } = await startIpc(temporaryDatabase());
  for (let index = 0; index < 3; index += 1) {
    const result = await invoke('chat:send', { slug: 'two-sum', text: `消息${index}`, attachments: [attachment(`图${index * 2}.png`), attachment(`图${index * 2 + 1}.png`)] });
    assert.equal(result.ok, true, result.error);
  }
  const latest = invocations[2];
  assert.equal(latest.images.length, 4);
  for (let index = 1; index <= 4; index += 1) assert.ok(latest.prompt.includes(`图片 ${index}: 图${index + 1}.png`));
  assert.ok(!latest.prompt.includes('图片 5'));
  assert.ok(!latest.prompt.includes('图0.png'));
  for (let index = 0; index < 6; index += 1) await invoke('chat:send', { slug: 'two-sum', text: `追问${index}` });
  assert.equal(invocations.at(-1).images?.length || 0, 0, 'images outside the last eight messages do not leak into context');
});

test('invalid formats, renderer paths, sizes and counts are rejected before storing a message', async () => {
  const file = temporaryDatabase();
  const { invoke, db, invocations } = await startIpc(file);
  for (const attachments of [
    [attachment('fake.png', Buffer.from('not an image'))],
    [attachment('fake.jpg', png, 'image/jpeg')],
    [attachment('fake.svg', png, 'image/svg+xml')],
    [attachment('big.png', Buffer.alloc(10 * 1024 * 1024 + 1))],
    [attachment('empty.png', Buffer.alloc(0))],
    [{ name: 'path.png', mimeType: 'image/png', path: '/outside/private.png' }],
    [{ ...attachment(), path: '/outside/private.png' }],
    Array.from({ length: 5 }, () => attachment()),
    'malformed',
  ]) {
    const result = await invoke('chat:send', { slug: 'two-sum', text: '图', attachments });
    assert.equal(result.ok, false);
  }
  assert.equal(invocations.length, 0);
  assert.equal(db.all('SELECT COUNT(*) AS total FROM messages')[0].total, 0);
  assert.ok(!fs.existsSync(path.join(path.dirname(file), 'chat-images')));
  assert.equal((await invoke('chat:send', { slug: 'two-sum', text: '  ' })).ok, false);
});

test('undecodable images are rejected even with an allowed signature', async () => {
  const { invoke, db } = await startIpc(temporaryDatabase(), { invalidImage: true });
  const result = await invoke('chat:send', { slug: 'two-sum', text: '图', attachments: [attachment()] });
  assert.equal(result.ok, false);
  assert.match(result.error, /图片/);
  assert.equal(db.all('SELECT COUNT(*) AS total FROM messages')[0].total, 0);
});

test('model failure preserves the submitted image for history and later retry context', async () => {
  const file = temporaryDatabase();
  const failed = await startIpc(file, { failModel: true });
  const result = await failed.invoke('chat:send', { slug: 'two-sum', text: '看图', attachments: [attachment()] });
  assert.equal(result.ok, false);
  assert.match(result.error, /模型调用失败/);
  const history = await failed.invoke('chat:list', { slug: 'two-sum' });
  assert.equal(history.data.length, 1);
  assert.equal(history.data[0].attachments.length, 1);
  const reopened = await startIpc(file);
  assert.equal((await reopened.invoke('chat:send', { slug: 'two-sum', text: '重新看图' })).ok, true);
  assert.equal(reopened.invocations[0].images.length, 1);
  assert.deepEqual(fs.readFileSync(reopened.invocations[0].images[0].path), png);
});

test('damaged retained files fail clearly rather than dropping the image from a follow-up', async () => {
  const { invoke, invocations } = await startIpc(temporaryDatabase());
  assert.equal((await invoke('chat:send', { slug: 'two-sum', text: '图片', attachments: [attachment()] })).ok, true);
  fs.writeFileSync(invocations[0].images[0].path, Buffer.alloc(png.length));
  const result = await invoke('chat:send', { slug: 'two-sum', text: '继续解释' });
  assert.equal(result.ok, false);
  assert.match(result.error, /不存在或已损坏/);
  assert.equal(invocations.length, 1);
});

test('text-only model rejects new uploads but retains old image history without blocking text', async () => {
  const file = temporaryDatabase();
  const first = await startIpc(file);
  assert.equal((await first.invoke('chat:send', { slug: 'two-sum', text: '图', attachments: [attachment()] })).ok, true);
  const { invoke, db, invocations } = await startIpc(file, { supportsImages: false });
  const before = db.all('SELECT COUNT(*) AS total FROM messages')[0].total;
  const rejected = await invoke('chat:send', { slug: 'two-sum', text: '新图', attachments: [attachment()] });
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /不支持图片/);
  assert.equal(invocations.length, 0);
  assert.equal(db.all('SELECT COUNT(*) AS total FROM messages')[0].total, before);
  fs.renameSync(first.invocations[0].images[0].path, `${first.invocations[0].images[0].path}.missing`);
  const followup = await invoke('chat:send', { slug: 'two-sum', text: '继续讨论文字部分' });
  assert.equal(followup.ok, true, followup.error);
  assert.equal(invocations[0].images?.length || 0, 0);
  assert.ok(invocations[0].prompt.includes('图片未提供'));
  assert.ok(invocations[0].prompt.includes('当前模型不支持图片'));
  assert.ok(invocations[0].prompt.includes('不能假装看到'));
  assert.ok(invocations[0].prompt.includes('继续讨论文字部分'));
  const history = await invoke('chat:list', { slug: 'two-sum' });
  assert.equal(history.data[0].attachments.length, 1, 'history retains its image metadata when the model changes');
  assert.equal(history.data.length, before + 2);
  assert.equal((await invoke('chat:send', { slug: '3sum', text: '纯文字' })).ok, true);
});

test('opening images resolves only stored metadata and rejects traversal or missing files', async () => {
  const { invoke, openedImages } = await startIpc(temporaryDatabase());
  await invoke('chat:send', { slug: 'two-sum', text: '图', attachments: [attachment('../截图.png')] });
  const history = await invoke('chat:list', { slug: 'two-sum' });
  const image = history.data[0].attachments[0];
  assert.equal(image.name, '截图.png');
  assert.equal((await invoke('chat:image-open', { id: image.id })).ok, true);
  assert.match(openedImages[0], new RegExp(`${image.id}\\.png$`));
  for (const id of ['../../private', '00000000-0000-4000-8000-000000000000', openedImages[0]]) {
    assert.equal((await invoke('chat:image-open', { id })).ok, false);
  }
  fs.renameSync(openedImages[0], `${openedImages[0]}.missing`);
  assert.equal((await invoke('chat:image-open', { id: image.id })).ok, false);
});

test('Markdown links open only http and https external URLs', async () => {
  const { invoke, openedLinks } = await startIpc(temporaryDatabase());
  for (const url of ['https://leetcode.cn/problems/two-sum/', 'http://example.com/']) assert.equal((await invoke('link:open', { url })).ok, true);
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,hi', '/relative', 'not a url']) assert.equal((await invoke('link:open', { url })).ok, false);
  assert.equal(openedLinks.length, 2);
});

test('preload exposes image and external-link calls through fixed IPC channels', () => {
  const exposed = {};
  const invoked = [];
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.js'), 'utf8'), {
    require: () => ({ contextBridge: { exposeInMainWorld(name, value) { exposed[name] = value; } }, ipcRenderer: { invoke(channel, payload) { invoked.push({ channel, payload }); } } }),
  });
  exposed.lc.openChatImage('uuid');
  exposed.lc.openExternalLink('https://leetcode.cn/');
  assert.equal(invoked[0].channel, 'chat:image-open');
  assert.equal(invoked[0].payload.id, 'uuid');
  assert.equal(invoked[1].channel, 'link:open');
  assert.equal(invoked[1].payload.url, 'https://leetcode.cn/');
});

(async () => {
  let passed = 0;
  for (const item of tests) {
    try { await item.fn(); passed += 1; console.log(`PASS ${item.name}`); }
    catch (error) { console.error(`FAIL ${item.name}`); throw error; }
  }
  console.log(`Chat attachment checks passed: ${passed}/${tests.length}`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
