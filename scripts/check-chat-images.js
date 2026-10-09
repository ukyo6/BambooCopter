const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><form><textarea id="input"></textarea><input id="picker" type="file"><button id="button" type="button"></button><div id="previews" hidden></div></form><div id="message"></div>', { runScripts: 'outside-only' });
const win = dom.window;
let next = 0;
const revoked = new Set();
win.URL.createObjectURL = () => `blob:test-${++next}`;
win.URL.revokeObjectURL = url => revoked.add(url);
win.eval(fs.readFileSync(path.join(__dirname, '..', 'renderer', 'chat-images.js'), 'utf8'));
const errors = [];
let busy = false;
let supportsImages = true;
const controller = win.BambooChatImages.bindComposer({
  input: win.document.getElementById('input'), picker: win.document.getElementById('picker'),
  button: win.document.getElementById('button'), previews: win.document.getElementById('previews'),
  onError: error => errors.push(error), onChange() {}, isBusy: () => busy, canAttach: () => supportsImages,
});
const data = new Uint8Array([137, 80, 78, 71]).buffer;
const image = { name: 'screenshot.png', type: 'image/png', size: 4, arrayBuffer: async () => data };

async function checkComposerIntegration() {
  const root = path.join(__dirname, '..');
  const appDom = new JSDOM(fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8'), {
    runScripts: 'outside-only', url: 'https://bamboo.test/', pretendToBeVisual: true,
  });
  const appWin = appDom.window;
  let agentCalls = 0;
  let chatCalls = 0;
  appWin.require = () => {};
  appWin.require.config = () => {};
  appWin.URL.createObjectURL = () => 'blob:integration';
  appWin.URL.revokeObjectURL = () => {};
  appWin.lc = {
    saveDraft: async () => ({ ok: true }),
    problemDetail: async () => ({ ok: false, error: 'Fixture: no problem body' }),
    selectAgent: async () => { agentCalls += 1; throw new Error('Unexpected agent call'); },
    submitReview: async () => { agentCalls += 1; throw new Error('Unexpected review call'); },
    sendChat: async () => { chatCalls += 1; throw new Error('Unexpected chat call'); },
  };
  appWin.eval(fs.readFileSync(path.join(root, 'renderer', 'chat-images.js'), 'utf8'));
  appWin.eval(`${fs.readFileSync(path.join(root, 'renderer', 'app.js'), 'utf8')}
    editor = { getValue: () => 'code', layout() {} };
    currentSlug = 'a';
    currentAgentState = { provider: 'codex', links: [{id:'codex'}], model: 'image', models: [{id:'image', supportsImages:true}] };
    bindControls();
    window.composerImages = chatImages;
  `);
  try {
    const composer = appWin.document.getElementById('composer');
    const input = appWin.document.getElementById('chatInput');
    appWin.composerImages.add([image]);
    input.value = 'image question';
    let releasePayload;
    appWin.composerImages.payload = () => new Promise(resolve => { releasePayload = resolve; });
    const sending = composer.onsubmit({ preventDefault() {} });
    assert(appWin.document.getElementById('reviewCode').disabled, 'image preparation disables code submission');
    assert(input.readOnly, 'image preparation prevents edits to the outgoing text');
    await appWin.submitReview();
    await appWin.changeAgent({ model: 'other' });
    assert.equal(agentCalls, 0, 'keyboard submission and model changes cannot overlap image preparation');
    await appWin.selectProblem('b');
    await appWin.selectProblem('a');
    releasePayload([{ name: image.name, mimeType: image.type, bytes: data }]);
    await sending;
    assert.equal(chatCalls, 0, 'switching away and back must not send an abandoned image snapshot');
    assert.equal(appWin.document.querySelectorAll('.message').length, 0, 'cancelled preparation creates no phantom message');
    assert.equal(input.value, 'image question');
    assert(!input.readOnly);
    assert(!appWin.document.getElementById('reviewCode').disabled);
  } finally { appDom.window.close(); }
}

(async () => {
  controller.add([image]);
  assert.equal(controller.count(), 1);
  assert.equal(win.document.querySelectorAll('.composer-image img').length, 1);
  const draftUrl = win.document.querySelector('.composer-image img').src;
  const outgoing = controller.previews();
  assert.notEqual(outgoing[0].url, draftUrl);
  const [payload] = await controller.payload();
  assert.equal(payload.mimeType, 'image/png');
  assert.equal(payload.bytes, data);
  busy = true;
  win.document.querySelector('.composer-image button').click();
  assert.equal(controller.count(), 1, 'preparing attachments must not allow removal');
  controller.clear();
  assert(revoked.has(draftUrl));
  assert(!revoked.has(outgoing[0].url), 'clearing input must not invalidate the outgoing bubble');
  const message = win.document.getElementById('message');
  win.BambooChatImages.renderAttachments(message, outgoing);
  assert.equal(message.querySelector('img').src, outgoing[0].url);
  win.BambooChatImages.releasePreviews(message);
  assert(revoked.has(outgoing[0].url));
  controller.restore([image]);
  assert.equal(controller.count(), 1, 'failed outgoing message can restore its draft while busy');
  busy = false;
  win.document.querySelector('.composer-image button').click();
  assert.equal(controller.count(), 0);
  controller.add([{ ...image, type: 'text/plain' }, { ...image, size: 11 * 1024 * 1024 }]);
  assert.equal(controller.count(), 0);
  controller.add([image, image, image, image, image]);
  assert.equal(controller.count(), 4);
  assert.equal(errors.length, 3);
  controller.clear();
  supportsImages = false;
  controller.add([image]);
  controller.restore([image]);
  assert.equal(controller.count(), 0, 'text-only models must not retain hidden image drafts');
  const input = win.document.getElementById('input');
  const paste = new win.Event('paste', { cancelable: true });
  Object.defineProperty(paste, 'clipboardData', { value: {
    items: [{ kind: 'file', getAsFile: () => image }], getData: () => 'normal text',
  } });
  input.dispatchEvent(paste);
  assert(!paste.defaultPrevented, 'text-only models keep ordinary text paste');
  const drop = new win.Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(drop, 'dataTransfer', { value: { types: ['Files'], files: [image] } });
  input.dispatchEvent(drop);
  assert(drop.defaultPrevented, 'unsupported image drop must not navigate away');
  assert.equal(controller.count(), 0);
  assert.equal(errors.length, 3, 'unsupported image input is ignored quietly');
  const textDrop = new win.Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(textDrop, 'dataTransfer', { value: { types: ['text/plain'], files: [] } });
  input.dispatchEvent(textDrop);
  assert(!textDrop.defaultPrevented, 'ordinary text drop keeps its default behavior');
  dom.window.close();
  await checkComposerIntegration();
  console.log('Chat image UI passed: preview, exact bytes, preparation races, draft recovery, model capability, limits and URL lifecycle.');
})().catch(error => { console.error(error); process.exitCode = 1; });
