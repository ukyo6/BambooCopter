const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const agent = require('../electron/agent');

const tests = [];
function test(name, fn, { skip = false } = {}) { tests.push({ name, fn, skip }); }
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'bamboo-agents-'));
let fixtureId = 0;
function cli({ stdout = '', stderr = '', code = 0, inspect = false, delayMs = 0 } = {}) {
  const file = path.join(work, `cli-${fixtureId += 1}.js`);
  fs.writeFileSync(file, `#!/usr/bin/env node\nconst fs=require('fs'); let input=''; process.stdin.setEncoding('utf8'); process.stdin.on('data',s=>input+=s); process.stdin.on('end',()=>{const args=process.argv.slice(2); const at=args.indexOf('--patch'); const patch=at<0?'':fs.readFileSync(args[at+1],'utf8'); const text=${inspect ? "JSON.stringify({args,input,cwd:process.cwd(),patch,patchFile:args[at+1]})" : JSON.stringify(stdout)}; setTimeout(()=>{process.stdout.write(text); process.stderr.write(${JSON.stringify(stderr)}); process.exit(${code});},${delayMs});});\n`, { mode: 0o700 });
  return { id: 'deepseek', path: file };
}
function windowsShim(link, extension) {
  const directory = path.join(work, 'CLI wrappers with spaces', 'node_modules', '.bin');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `cli-${fixtureId}${extension}`);
  const script = path.relative(directory, link.path);
  fs.writeFileSync(file, `@echo off\r\nsetlocal DisableDelayedExpansion\r\n"${process.execPath}" "%~dp0${script}" %*\r\nexit /b %errorlevel%\r\n`);
  return { ...link, path: file };
}
function stream(events) { return events.map((event) => JSON.stringify(event)).join('\n') + '\n'; }
function answer(text, reason = { kind: 'completed' }) {
  return stream([{ type: 'status', phase: 'turn_end', reason }, { type: 'final', text }]);
}

function imageFiles() {
  const files = ['image with spaces.png', 'second-image.png'].map((name) => path.join(work, name));
  const data = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=', 'base64');
  for (const file of files) fs.writeFileSync(file, data);
  return files.map((file) => ({ path: file, mimeType: 'image/png' }));
}

function sdkCli({ reason = { kind: 'completed' }, errorMethod = '', invalidJson = false, hang = false, earlyExit = false, exitCode = 0, splitBytes = false, emptyAnswer = false } = {}) {
  const capture = path.join(work, `sdk-${fixtureId + 1}.json`);
  const link = cli();
  fs.writeFileSync(link.path, `#!/usr/bin/env node
const fs=require('fs'); const readline=require('readline'); const args=process.argv.slice(2); const at=args.indexOf('--patch');
const request={args,patchFile:args[at+1],patch:fs.readFileSync(args[at+1],'utf8'),frames:[],pid:process.pid};
const save=()=>fs.writeFileSync(${JSON.stringify(capture)},JSON.stringify(request)); save();
const emit=value=>{const bytes=Buffer.from(JSON.stringify(value)+'\\n'); if(${splitBytes}){for(let i=0;i<bytes.length;i++)process.stdout.write(bytes.subarray(i,i+1));}else process.stdout.write(bytes);};
readline.createInterface({input:process.stdin}).on('line',line=>{
 const frame=JSON.parse(line); request.frames.push(frame); save();
 if(frame.method===${JSON.stringify(errorMethod)}){emit({jsonrpc:'2.0',id:frame.id,error:{code:-32603,message:'SDK fixture error'}});return;}
 if(frame.method==='initialize'){emit({jsonrpc:'2.0',id:frame.id,result:{serverInfo:{name:'deepseek-harness-sdk-runtime',version:'0.0.1'}}});return;}
 if(frame.method==='session/prompt'){
   const sessionId=frame.params.sessionId;
   emit({jsonrpc:'2.0',method:'session.event',params:{sessionId:'unrelated-session',event:{type:'turn/end',data:{reason:{kind:'completed'}}}}});
   if(${invalidJson}){process.stdout.write('{truncated\\n');return;}
   if(${hang})return;
   emit({jsonrpc:'2.0',method:'session.event',params:{sessionId,event:{type:'turn/start',data:{}}}});
   emit({jsonrpc:'2.0',method:'session.event',params:{sessionId,event:{type:'assistant/message',data:{message:{content:[{type:'reasoning',text:'PRIVATE_THINKING'},{type:'text',text:${JSON.stringify(emptyAnswer ? ' ' : '图片中文答复')}}]}}}}});
   emit({jsonrpc:'2.0',method:'session.event',params:{sessionId:'unrelated-session',event:{type:'assistant/message',data:{message:{content:[{type:'text',text:'WRONG_SESSION'}]}}}}});
   emit({jsonrpc:'2.0',method:'session.event',params:{sessionId,event:{type:'turn/end',data:{reason:${JSON.stringify(reason)}}}}});
   if(${earlyExit}){process.exit(0);return;}
   emit({jsonrpc:'2.0',id:frame.id,result:{messageId:'message-fixture'}});return;
 }
 if(frame.method==='shutdown'){emit({jsonrpc:'2.0',id:frame.id,result:{}});setImmediate(()=>process.exit(${exitCode}));}
});
`, { mode: 0o700 });
  return { link, capture };
}

test('Codex sends every image through real --image arguments while keeping prompt on stdin', async () => {
  const capture = path.join(work, 'codex-image-request.json');
  const link = cli({ inspect: true });
  link.id = 'codex';
  fs.writeFileSync(link.path, fs.readFileSync(link.path, 'utf8').replace('process.stdout.write(text);', `fs.writeFileSync(${JSON.stringify(capture)},text); fs.writeFileSync(args[args.indexOf('-o')+1],'image answer');`));
  const images = imageFiles();
  assert.equal(await agent.complete(link, { model: 'codex-model', prompt: '图文问题', images }), 'image answer');
  const request = JSON.parse(fs.readFileSync(capture, 'utf8'));
  const paths = request.args.flatMap((arg, index) => arg === '--image' ? [request.args[index + 1]] : []);
  assert.deepEqual(paths, images.map((image) => image.path));
  assert.equal(request.input, '图文问题');
});

test('DeepSeek SDK transmits image bytes, isolates its session, and shuts down after a completed turn', async () => {
  const { link, capture } = sdkCli({ splitBytes: true });
  const images = imageFiles();
  assert.equal(await agent.complete(link, { model: 'deepseek-flash', prompt: '图文问题', images, timeoutMs: 1500 }), '图片中文答复');
  const request = JSON.parse(fs.readFileSync(capture, 'utf8'));
  assert.deepEqual(request.args, ['--profile', 'sdk', '--patch', request.patchFile]);
  assert.deepEqual(request.frames.map((frame) => frame.method), ['initialize', 'session/prompt', 'shutdown']);
  assert.equal(request.frames[0].params.provider, 'deepseek-account');
  assert.equal(request.frames[0].params.model, 'deepseek-flash');
  assert.equal(request.frames[1].params.contentBlocks[0].text, '图文问题');
  assert.match(request.frames[1].params.sessionId, /^bamboo-/);
  assert.deepEqual(request.frames[1].params.contentBlocks.slice(1), images.map((image) => ({ type: 'image', data: fs.readFileSync(image.path).toString('base64'), mimeType: image.mimeType })));
  assert.equal(fs.existsSync(request.patchFile), false);
  const builderRequire = createRequire(require.resolve('electron-builder'));
  const rows = builderRequire('js-yaml').load(request.patch);
  for (const id of ['agent-instructions', 'tool-bash', 'tool-fs', 'tool-subagent', 'session-title-llm']) assert.equal(rows.find((row) => row.id === id)?.disabled, true);
  const directory = path.dirname(request.patchFile);
  assert.equal(rows.find((row) => row.id === 'session-persistence-jsonl').config.root, path.join(directory, 'sessions'));
  assert.equal(rows.find((row) => row.id === 'attachment-local').config.dshHome, directory);
  assert.equal(rows.find((row) => row.id === 'storage-json').config.root, path.join(directory, 'storages'));
});

test('DeepSeek SDK rejects failed or cancelled image turns even when partial text exists', async () => {
  for (const reason of [{ kind: 'cancelled' }, { kind: 'error', error: { code: 'IMAGE_ERROR', message: 'image request failed' } }]) {
    const { link, capture } = sdkCli({ reason });
    await assert.rejects(agent.complete(link, { model: 'deepseek-flash', prompt: 'test', images: imageFiles(), timeoutMs: 1500 }), /取消|image request failed/);
    const request = JSON.parse(fs.readFileSync(capture, 'utf8'));
    assert.equal(request.frames.at(-1).method, 'shutdown');
    assert.equal(fs.existsSync(request.patchFile), false);
  }
});

test('DeepSeek SDK rejects JSON-RPC errors during initialize, admission, and shutdown', async () => {
  for (const errorMethod of ['initialize', 'session/prompt', 'shutdown']) {
    const { link, capture } = sdkCli({ errorMethod });
    await assert.rejects(agent.complete(link, { model: 'deepseek-flash', prompt: 'test', images: imageFiles(), timeoutMs: 1500 }), /SDK fixture error/);
    const request = JSON.parse(fs.readFileSync(capture, 'utf8'));
    assert.equal(fs.existsSync(request.patchFile), false);
    assert.throws(() => process.kill(request.pid, 0), { code: 'ESRCH' });
  }
});

test('DeepSeek SDK rejects malformed streams, empty answers, early exits, and nonzero exits', async () => {
  for (const options of [{ invalidJson: true }, { emptyAnswer: true }, { earlyExit: true }, { exitCode: 7 }]) {
    const { link, capture } = sdkCli(options);
    await assert.rejects(agent.complete(link, { model: 'deepseek-flash', prompt: 'test', images: imageFiles(), timeoutMs: 1500 }));
    const request = JSON.parse(fs.readFileSync(capture, 'utf8'));
    assert.equal(fs.existsSync(request.patchFile), false);
  }
});

test('DeepSeek SDK timeout stops the process before cleaning temporary state', async () => {
  const { link, capture } = sdkCli({ hang: true });
  await assert.rejects(agent.complete(link, { model: 'deepseek-flash', prompt: 'test', images: imageFiles(), timeoutMs: 1000 }), /超时/);
  const request = JSON.parse(fs.readFileSync(capture, 'utf8'));
  assert.equal(fs.existsSync(request.patchFile), false);
  assert.throws(() => process.kill(request.pid, 0), { code: 'ESRCH' });
});

test('Windows SDK .cmd preserves Chinese text and base64 images through interactive stdio', async () => {
  const { link, capture } = sdkCli({ splitBytes: true });
  const images = imageFiles();
  const prompt = '中文图文 "$() `literal` %PATH% & | < > ^ ! ( )"';
  assert.equal(await agent.complete(windowsShim(link, '.cmd'), { model: 'deepseek-flash', prompt, images, timeoutMs: 3000 }), '图片中文答复');
  const request = JSON.parse(fs.readFileSync(capture, 'utf8'));
  assert.equal(request.frames[1].params.contentBlocks[0].text, prompt);
  assert.equal(request.frames[1].params.contentBlocks[1].data, fs.readFileSync(images[0].path).toString('base64'));
  assert.equal(fs.existsSync(request.patchFile), false);
}, { skip: process.platform !== 'win32' });

test('DeepSeek rejects image input for a text-only model before launching its CLI', async () => {
  const { link, capture } = sdkCli();
  await assert.rejects(agent.complete(link, { model: 'deepseek-v4-pro', prompt: 'test', images: imageFiles(), timeoutMs: 1500 }), /图片.*Flash|Flash.*图片/);
  assert.equal(fs.existsSync(capture), false);
});

test('Models advertise whether the current CLI route accepts image input', async () => {
  const models = await agent.listModels({ id: 'deepseek', path: '/not-executed' });
  assert.equal(models.find((model) => model.id === 'deepseek-flash').supportsImages, true);
  assert.equal(models.find((model) => model.id === 'deepseek-v4-pro').supportsImages, false);
  const link = cli({ stdout: JSON.stringify({ models: [{ slug: 'codex-model', visibility: 'list' }] }) });
  assert.equal((await agent.listModels({ ...link, id: 'codex' }))[0].supportsImages, true);
});

test('DeepSeek returns only the final answer instead of reasoning or intermediate content', async () => {
  const link = cli({ stdout: stream([
    { type: 'session', sessionId: 'session-test', cwd: work },
    { type: 'thinking', text: 'PRIVATE_THINKING' },
    { type: 'text', text: 'INTERMEDIATE_CONTENT' },
    { type: 'tool_result', status: 'error', result: 'TOOL_OUTPUT' },
    { type: 'status', phase: 'turn_end', reason: { kind: 'completed' } },
    { type: 'final', text: '最终答复' },
  ]) });
  assert.equal(await agent.complete(link, { model: 'deepseek-flash', prompt: 'test' }), '最终答复');
});

test('DeepSeek uses stdin and a temporary invocation patch without Codex flags', async () => {
  const capture = path.join(work, 'request.json');
  const link = cli({ inspect: true });
  // Capture the external boundary, then let the fixture return a normal final event.
  const source = fs.readFileSync(link.path, 'utf8').replace('process.stdout.write(text);', `fs.writeFileSync(${JSON.stringify(capture)},text); process.stdout.write(${JSON.stringify(answer('ok'))});`);
  fs.writeFileSync(link.path, source);
  const prompt = 'source code\nconst value = "$() `literal`";';
  assert.equal(await agent.complete(link, { model: 'deepseek-v4-pro', prompt, reasoning: 'high', fast: true }), 'ok');
  const request = JSON.parse(fs.readFileSync(capture, 'utf8'));
  assert.deepEqual(request.args, ['--profile', 'headless', '--patch', request.patchFile, '--json', '-']);
  assert.equal(request.input, prompt);
  assert.equal(fs.realpathSync(request.cwd), fs.realpathSync(os.tmpdir()));
  assert.equal(fs.existsSync(request.patchFile), false, 'invocation patch must be cleaned up');
  const builderRequire = createRequire(require.resolve('electron-builder'));
  const yaml = builderRequire('js-yaml');
  const rows = yaml.load(request.patch);
  const configuration = new Map(rows.map((row) => [row.id, row]));
  assert.deepEqual(configuration.get('agent-default-model').config, { provider: 'deepseek-account', model: 'deepseek-v4-pro' });
  assert.deepEqual(configuration.get('tools').config, { mode: 'native' });
  for (const id of ['agent-instructions', 'skill-filesystem', 'skill-badge', 'plan-mode', 'mcp-resources', 'tool-skill', 'tool-bash', 'tool-pwsh', 'tool-jobs', 'tool-fs', 'tool-fs-search', 'tool-subagent', 'tool-subagent-fork', 'tool-subagent-control', 'tool-subagent-list-agents', 'tool-workflow', 'tool-todo', 'tool-goal', 'tool-web', 'tool-plugin-manager', 'tool-ralph', 'session-title-llm', 'session-log-deepseek', 'session-telemetry-otel']) {
    assert.equal(configuration.get(id)?.disabled, true, `${id} must not run in code review or chat`);
  }
  assert.equal(request.patch.includes('API_KEY'), false);
});

test('DeepSeek review appends the actual JSON schema to the source prompt', async () => {
  const capture = path.join(work, 'schema-request.json');
  const link = cli({ inspect: true });
  const source = fs.readFileSync(link.path, 'utf8').replace('process.stdout.write(text);', `fs.writeFileSync(${JSON.stringify(capture)},text); process.stdout.write(${JSON.stringify(answer('{"verdict":"pass","summary":"ok","issues":[]}'))});`);
  fs.writeFileSync(link.path, source);
  const text = await agent.complete(link, { model: 'deepseek-flash', prompt: 'REVIEW_CODE', schema: agent.reviewSchema });
  assert.equal(agent.parseJsonText(text).verdict, 'pass');
  const request = JSON.parse(fs.readFileSync(capture, 'utf8'));
  assert.ok(request.input.startsWith('REVIEW_CODE\n'));
  const schema = JSON.parse(fs.readFileSync(agent.reviewSchema, 'utf8'));
  assert.ok(request.input.includes(JSON.stringify(schema)), 'the complete schema must reach the CLI');
  assert.match(request.input, /JSON/);
});

test('DeepSeek rejects incomplete or invalid review JSON instead of saving an empty failure', async () => {
  const issue = { message: 'error', hint: '', line_start: 1, line_end: 1, code_excerpt: 'bad();' };
  const review = { verdict: 'fail', summary: 'error', issues: [issue] };
  for (const invalid of [
    {}, { summary: '', issues: [] }, { verdict: 'pass', issues: [] }, { verdict: 'pass', summary: '' },
    { ...review, verdict: 'maybe' }, { ...review, summary: null }, { ...review, issues: {} }, { ...review, extra: true },
    { ...review, issues: [null] }, { ...review, issues: [{ ...issue, line_start: '1' }] },
    { ...review, issues: [{ ...issue, line_end: 1.5 }] }, { ...review, issues: [{ ...issue, line_start: -1 }] },
    { ...review, issues: [{ message: 'error', hint: '' }] },
  ]) {
    await assert.rejects(agent.complete(cli({ stdout: answer(JSON.stringify(invalid)) }), { model: 'deepseek-flash', prompt: 'test', schema: agent.reviewSchema }), /JSON|格式/);
  }
  const text = await agent.complete(cli({ stdout: answer(JSON.stringify(review)) }), { model: 'deepseek-flash', prompt: 'test', schema: agent.reviewSchema });
  assert.deepEqual(agent.parseJsonText(text), review);
});

test('DeepSeek explanation JSON must include all fields and the supported kind', async () => {
  const explanation = { kind: 'html', caption: 'caption', time_complexity: 'O(n)', space_complexity: 'O(1)', complexity_note: 'n=input', html: '<p>example</p>', svg: '', media: '' };
  for (const invalid of [{ ...explanation, kind: 'unknown' }, { ...explanation, time_complexity: 1 }, { ...explanation, caption: undefined }]) {
    await assert.rejects(agent.complete(cli({ stdout: answer(JSON.stringify(invalid)) }), { model: 'deepseek-flash', prompt: 'test', schema: agent.explainSchema }), /JSON|格式/);
  }
  assert.deepEqual(agent.parseJsonText(await agent.complete(cli({ stdout: answer(JSON.stringify(explanation)) }), { model: 'deepseek-flash', prompt: 'test', schema: agent.explainSchema })), explanation);
});

test('DeepSeek rejects a failed process even if a partial final answer exists', async () => {
  await assert.rejects(agent.complete(cli({ stdout: answer('partial'), stderr: 'network unavailable', code: 1 }), { model: 'deepseek-flash', prompt: 'test' }), /network unavailable/);
});

test('DeepSeek rejects a failed turn even with exit zero and a final answer', async () => {
  const stdout = answer('partial', { kind: 'error', error: { code: 'LLM_ERROR', message: 'provider failed' } });
  await assert.rejects(agent.complete(cli({ stdout }), { model: 'deepseek-flash', prompt: 'test' }), /provider failed/);
});

test('DeepSeek account sign-in errors tell the user which official app to sign in to', async () => {
  const stdout = answer('', { kind: 'error', error: { code: 'ACCOUNT_SIGN_IN_REQUIRED', message: 'Sign in to DeepSeek to use the account provider.' } });
  await assert.rejects(agent.complete(cli({ stdout, code: 1 }), { model: 'deepseek-flash', prompt: 'test' }), /DeepSeek Harness.*登录/);
});

test('DeepSeek error events cannot become a successful reply', async () => {
  const stdout = stream([{ type: 'error', message: 'invalid command option' }, { type: 'final', text: 'partial' }]);
  await assert.rejects(agent.complete(cli({ stdout }), { model: 'deepseek-flash', prompt: 'test' }), /invalid command option/);
});

test('DeepSeek never accepts plain text, intermediate-only, empty, or truncated streams', async () => {
  for (const stdout of ['plain text', stream([{ type: 'text', text: 'only intermediate' }]), answer('  '), '{"type":"final","text":"truncated']) {
    await assert.rejects(agent.complete(cli({ stdout }), { model: 'deepseek-flash', prompt: 'test' }));
  }
});

test('DeepSeek tolerates launcher diagnostics around a valid final event', async () => {
  assert.equal(await agent.complete(cli({ stdout: `launcher diagnostic\n${answer('ok')}launcher exit\n` }), { model: 'deepseek-flash', prompt: 'test' }), 'ok');
});

test('DeepSeek preserves Chinese characters split between stdout byte chunks', async () => {
  const link = cli({ stdout: answer('中文答复') });
  const source = fs.readFileSync(link.path, 'utf8').replace('process.stdout.write(text);', "const data=Buffer.from(text); const index=data.indexOf(Buffer.from('中'))+1; process.stdout.write(data.subarray(0,index)); setTimeout(()=>{process.stdout.write(data.subarray(index)); process.exit(0);},30); return;");
  fs.writeFileSync(link.path, source);
  assert.equal(await agent.complete(link, { model: 'deepseek-flash', prompt: 'test' }), '中文答复');
});

test('DeepSeek does not return another turn after cancellation', async () => {
  const stdout = answer('partial', { kind: 'cancelled' });
  await assert.rejects(agent.complete(cli({ stdout }), { model: 'deepseek-flash', prompt: 'test' }));
});

test('DeepSeek rejects unsupported models before invoking its CLI', async () => {
  await assert.rejects(agent.complete(cli({ stdout: answer('should not run') }), { model: 'codex-model', prompt: 'test' }), /模型/);
});

test('DeepSeek timeout reports failure and cleans up its invocation patch', async () => {
  const capture = path.join(work, 'timeout-request.json');
  const link = cli({ inspect: true, delayMs: 10000 });
  const source = fs.readFileSync(link.path, 'utf8').replace('const text=', `fs.writeFileSync(${JSON.stringify(capture)},JSON.stringify({patchFile:args[at+1]})); const text=`);
  fs.writeFileSync(link.path, source);
  await assert.rejects(agent.complete(link, { model: 'deepseek-flash', prompt: 'test', timeoutMs: 1000 }), /超时/);
  const request = JSON.parse(fs.readFileSync(capture, 'utf8'));
  assert.equal(fs.existsSync(request.patchFile), false);
});

test('DeepSeek model options have no Codex reasoning levels', async () => {
  const models = await agent.listModels({ id: 'deepseek', path: '/not-executed' });
  assert.ok(models.some((model) => model.id === 'deepseek-flash'));
  assert.ok(models.every((model) => model.efforts.length === 0 && model.defaultEffort === ''));
});

test('Codex completion still uses ephemeral read-only exec and schema output', async () => {
  const capture = path.join(work, 'codex-request.json');
  const link = cli({ inspect: true });
  link.id = 'codex';
  const source = fs.readFileSync(link.path, 'utf8').replace('process.stdout.write(text);', `fs.writeFileSync(${JSON.stringify(capture)},text); const atOutput=args.indexOf('-o'); fs.writeFileSync(args[atOutput+1],'codex response');`);
  fs.writeFileSync(link.path, source);
  assert.equal(await agent.complete(link, { model: 'codex-model', prompt: 'test', schema: agent.reviewSchema, reasoning: 'high', fast: true }), 'codex response');
  const request = JSON.parse(fs.readFileSync(capture, 'utf8'));
  assert.equal(request.args[0], 'exec');
  assert.ok(request.args.includes('--ephemeral'));
  assert.ok(request.args.includes('--ignore-user-config'));
  assert.ok(request.args.includes('--ignore-rules'));
  assert.ok(request.args.includes('read-only'));
  assert.ok(request.args.includes('model_reasoning_effort="high"'));
  assert.ok(request.args.includes('--enable'));
  assert.ok(request.args.includes('--output-schema'));
  assert.equal(fs.existsSync(request.args[request.args.indexOf('--output-schema') + 1]), false);
  assert.equal(request.input, 'test');
});

test('Windows npm-style .cmd preserves model arguments and stdin through its wrapper', async () => {
  const capture = path.join(work, 'cmd-request.json');
  const script = cli({ inspect: true });
  const source = fs.readFileSync(script.path, 'utf8').replace('process.stdout.write(text);', `fs.writeFileSync(${JSON.stringify(capture)},text); const atOutput=args.indexOf('-o'); fs.writeFileSync(args[atOutput+1],'cmd response');`);
  fs.writeFileSync(script.path, source);
  const link = { ...windowsShim(script, '.cmd'), id: 'codex' };
  const prompt = '中文源码\nconst text = "$() `literal` %PATH% & | < > ^ ! ( )";';
  for (const model of ['model with spaces', 'quote"and(parentheses)', 'amp&pipe|redirect<>caret^', '%PATH%', 'bang!', 'trailing\\']) {
    assert.equal(await agent.complete(link, { model, prompt, reasoning: 'high', fast: true }), 'cmd response');
    const request = JSON.parse(fs.readFileSync(capture, 'utf8'));
    assert.equal(request.args[request.args.indexOf('-m') + 1], model, 'the wrapper must preserve the model argument');
    assert.ok(request.args.includes('model_reasoning_effort="high"'));
    assert.equal(request.input, prompt, 'source text must stay on stdin without shell expansion');
  }
}, { skip: process.platform !== 'win32' });

test('Windows .bat preserves DeepSeek stdin, final text, and failure exit codes', async () => {
  const capture = path.join(work, 'bat-request.json');
  const script = cli({ inspect: true });
  const source = fs.readFileSync(script.path, 'utf8').replace('process.stdout.write(text);', `fs.writeFileSync(${JSON.stringify(capture)},text); process.stdout.write(${JSON.stringify(answer('批处理中文答复'))});`);
  fs.writeFileSync(script.path, source);
  const prompt = 'source text with spaces\n"quotes" & | < > ^ %PATH% !';
  assert.equal(await agent.complete(windowsShim(script, '.bat'), { model: 'deepseek-flash', prompt }), '批处理中文答复');
  const request = JSON.parse(fs.readFileSync(capture, 'utf8'));
  assert.deepEqual(request.args, ['--profile', 'headless', '--patch', request.patchFile, '--json', '-']);
  assert.equal(request.input, prompt);
  assert.equal(fs.existsSync(request.patchFile), false);
  const failure = windowsShim(cli({ stdout: answer('partial'), stderr: 'bat failure', code: 7 }), '.bat');
  await assert.rejects(agent.complete(failure, { model: 'deepseek-flash', prompt }), /bat failure/);
}, { skip: process.platform !== 'win32' });

test('Windows timeout stops a started npm-shim descendant from writing its ticker', async () => {
  const ticker = path.join(work, 'timeout-ticker.txt');
  const started = path.join(work, 'timeout-descendant.json');
  const parent = path.join(work, 'timeout-parent.json');
  const descendant = path.join(work, 'timeout-descendant.js');
  fs.writeFileSync(descendant, `const fs=require('fs'); const [ticker,started]=process.argv.slice(2); fs.writeFileSync(started,JSON.stringify({pid:process.pid,parentPid:process.ppid})); const until=Date.now()+20000; const timer=setInterval(()=>{fs.appendFileSync(ticker,'tick\\n'); if(Date.now()>=until)clearInterval(timer);},40);`);
  const script = cli();
  fs.writeFileSync(script.path, `#!/usr/bin/env node\nconst fs=require('fs'); const {spawn}=require('child_process'); process.stdin.resume(); process.stdin.on('end',()=>{const args=process.argv.slice(2); fs.writeFileSync(${JSON.stringify(parent)},JSON.stringify({pid:process.pid,patchFile:args[args.indexOf('--patch')+1]})); const child=spawn(process.execPath,[${JSON.stringify(descendant)},${JSON.stringify(ticker)},${JSON.stringify(started)}],{stdio:'ignore',windowsHide:true}); child.on('error',()=>process.exit(1)); setTimeout(()=>process.exit(0),20000);});\n`);
  const invocation = agent.complete(windowsShim(script, '.cmd'), { model: 'deepseek-flash', prompt: 'timeout fixture', timeoutMs: 6000 })
    .then(value => ({ value }), error => ({ error }));
  try {
    const deadline = Date.now() + 5000;
    while ((!fs.existsSync(ticker) || fs.readFileSync(ticker, 'utf8').split('\n').filter(Boolean).length < 2) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    assert(fs.existsSync(started), 'the actual descendant must start before timeout');
    assert(fs.existsSync(ticker) && fs.readFileSync(ticker, 'utf8').split('\n').filter(Boolean).length >= 2, 'the descendant must be actively writing before timeout');
    const processInfo = JSON.parse(fs.readFileSync(started, 'utf8'));
    const request = JSON.parse(fs.readFileSync(parent, 'utf8'));
    assert.equal(processInfo.parentPid, request.pid, 'the ticker must run in a separate descendant process');
    assert.notEqual(processInfo.pid, request.pid);
    const result = await invocation;
    assert.match(result.error?.message || 'completed without timeout', /超时/);
    const stopped = fs.readFileSync(ticker, 'utf8');
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.equal(fs.readFileSync(ticker, 'utf8'), stopped, 'the descendant must stop writing after the shim times out');
    for (const pid of [processInfo.pid, request.pid]) {
      assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' }, 'the descendant and its Node parent must exit before fixture cleanup');
    }
    assert.equal(fs.existsSync(request.patchFile), false);
  } finally {
    await invocation;
    // 只清理本用例记录的进程, 避免失败断言留下测试孙进程.
    for (const file of [started, parent]) {
      if (!fs.existsSync(file)) continue;
      try {
        const { pid } = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (Number.isInteger(pid) && pid > 0) process.kill(pid, 'SIGKILL');
      } catch {
        // 进程已被 taskkill 终止时无需重复清理.
      }
    }
  }
}, { skip: process.platform !== 'win32' });

test('CLI detection retains Codex and discovers the desktop bundled dsh outside PATH', () => {
  const desktop = path.join('/Applications', 'DeepSeek Harness.app', 'Contents', 'Resources', 'runtime', 'cli', 'bin', 'dsh');
  const filename = path.join(__dirname, '..', 'electron', 'agent.js');
  const localRequire = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    require: (name) => name === 'child_process' ? { spawnSync: (_cmd, [command]) => ({ stdout: command === 'codex' ? '/test/codex' : '' }) } : name === 'fs' ? { ...fs, existsSync: (file) => file === '/test/codex' || file === desktop } : localRequire(name),
    module, __dirname: path.dirname(filename), process: { env: {}, platform: 'darwin' }, setTimeout, clearTimeout,
  }, { filename });
  assert.deepEqual(JSON.parse(JSON.stringify(module.exports.detectLinks())), [
    { id: 'codex', label: 'Codex', path: '/test/codex' },
    { id: 'deepseek', label: 'DeepSeek CLI', path: desktop },
  ]);
});

(async () => {
  let failed = 0;
  let skipped = 0;
  try {
    for (const item of tests) {
      if (item.skip) {
        skipped += 1;
        process.stdout.write(`SKIP ${item.name} (requires Windows; current platform: ${process.platform})\n`);
        continue;
      }
      try { await item.fn(); process.stdout.write(`PASS ${item.name}\n`); }
      catch (error) { failed += 1; process.stderr.write(`FAIL ${item.name}\n${error.stack}\n`); }
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  process.stdout.write(`${tests.length - failed - skipped}/${tests.length - skipped} agent checks passed, ${skipped} skipped\n`);
  process.exitCode = failed ? 1 : 0;
})();
