const { spawnSync } = require('child_process');
const spawn = require('cross-spawn');
const fs = require('fs');
const os = require('os');
const path = require('path');

const reviewSchema = path.join(__dirname, 'review-schema.json');
const explainSchema = path.join(__dirname, 'explain-schema.json');
// DeepSeek Harness 0.2 的官方账号模型目录. 账号可用性由 CLI 调用时检查.
const deepseekModels = [
  { id: 'deepseek-flash', label: 'DeepSeek-V41-Flash', defaultEffort: '', efforts: [] },
  { id: 'deepseek-v4-pro', label: 'DeepSeek-V4-Pro', defaultEffort: '', efforts: [] },
];

function which(command) {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], { encoding: 'utf8', env: process.env, windowsHide: true });
  const found = (result.stdout || '').trim().split(/\r?\n/)[0];
  return found || null;
}

function fileExists(file) {
  try {
    return !!file && fs.existsSync(file);
  } catch {
    return false;
  }
}

function detectLinks() {
  const links = [];
  const codex = which('codex');
  if (fileExists(codex)) {
    links.push({ id: 'codex', label: 'Codex', path: codex });
  }
  const candidates = [which('dsh')];
  if (process.platform === 'darwin') {
    for (const root of ['/Applications', path.join(os.homedir(), 'Applications')]) {
      candidates.push(path.join(root, 'DeepSeek Harness.app', 'Contents', 'Resources', 'runtime', 'cli', 'bin', 'dsh'));
    }
  }
  const deepseek = candidates.find(fileExists);
  if (deepseek) links.push({ id: 'deepseek', label: 'DeepSeek CLI', path: deepseek });
  return links;
}

function runProcess(binary, args, { stdin = '', timeoutMs = 180000, cwd = os.tmpdir() } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      if (process.platform === 'win32' && Number.isInteger(child.pid) && child.pid > 0) {
        const result = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        if (result.status !== 0) child.kill('SIGKILL');
      } else {
        child.kill('SIGKILL');
      }
      reject(new Error('模型调用超时'));
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin.write(stdin);
    child.stdin.end();
  });
}

async function listModels(link) {
  if (link.id === 'deepseek') return deepseekModels.map((model) => ({ ...model, efforts: [] }));
  let result = await runProcess(link.path, ['debug', 'models'], { timeoutMs: 30000 });
  if (result.code !== 0) {
    result = await runProcess(link.path, ['debug', 'models', '--bundled'], { timeoutMs: 20000 });
  }
  if (result.code !== 0) {
    throw new Error((result.stderr || result.stdout || '无法读取 Codex 模型').trim());
  }
  const payload = JSON.parse(result.stdout);
  return (payload.models || [])
    .filter((model) => model.visibility === 'list' && model.slug)
    .map((model) => ({
      id: model.slug,
      label: model.display_name || model.slug,
      defaultEffort: model.default_reasoning_level || '',
      efforts: (model.supported_reasoning_levels || []).map((level) => level.effort).filter(Boolean),
    }));
}

function stageSchema(schema) {
  if (!schema) return '';
  const dest = path.join(os.tmpdir(), `lc-schema-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  fs.writeFileSync(dest, fs.readFileSync(schema));
  return dest;
}

async function complete(link, { model, prompt, schema, timeoutMs, reasoning, fast }) {
  if (link.id === 'deepseek') return completeDeepseek(link, { model, prompt, schema, timeoutMs });
  const outputFile = path.join(os.tmpdir(), `lc-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`);
  const stagedSchema = stageSchema(schema);
  try {
    const result = await runProcess(link.path, codexArgs({ model, schema: stagedSchema, outputFile, reasoning, fast }), {
      stdin: prompt,
      timeoutMs,
    });
    const fileText = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, 'utf8').trim() : '';
    const text = fileText || extractMessage(result.stdout);
    if (result.code !== 0 && !text) {
      throw new Error((result.stderr || result.stdout || '模型调用失败').trim().slice(0, 800));
    }
    if (!text) throw new Error('模型没有返回内容');
    return text;
  } finally {
    fs.rmSync(outputFile, { force: true });
    if (stagedSchema) fs.rmSync(stagedSchema, { force: true });
  }
}

async function completeDeepseek(link, { model, prompt, schema, timeoutMs }) {
  if (!deepseekModels.some((item) => item.id === model)) throw new Error('不支持的 DeepSeek 模型, 请重新选择模型');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bamboo-deepseek-'));
  const patchFile = path.join(directory, 'invocation.yml');
  try {
    const patch = fs.readFileSync(path.join(__dirname, 'deepseek-patch.yml'), 'utf8');
    fs.writeFileSync(patchFile, `${patch}\n- id: agent-default-model\n  config:\n    provider: deepseek-account\n    model: ${JSON.stringify(model)}\n`, { mode: 0o600 });
    let input = prompt;
    let shape;
    if (schema) {
      shape = JSON.parse(fs.readFileSync(schema, 'utf8'));
      input += `\n\n输出要求: 只返回符合下列 JSON Schema 的 JSON 对象, 不使用 Markdown 代码围栏, 不添加其他文字.\n${JSON.stringify(shape)}`;
    }
    const result = await runProcess(link.path, ['--profile', 'headless', '--patch', patchFile, '--json', '-'], { stdin: input, timeoutMs });
    const text = extractDeepseek(result);
    if (shape) validateJsonShape(parseJsonText(text), shape);
    return text;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

// 校验应用现有评审与题解 schema 使用的字段约束. CLI 的提示词约束不能代替校验.
function validateJsonShape(value, shape, location = '$') {
  const type = shape.type;
  const valid = type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
    : type === 'array' ? Array.isArray(value)
      : type === 'integer' ? Number.isInteger(value)
        : type === 'null' ? value === null : typeof value === type;
  if (!valid || (shape.enum && !shape.enum.includes(value)) || (shape.minimum !== undefined && value < shape.minimum)) {
    throw deepseekError(`返回的 JSON 格式不符合要求: ${location}`);
  }
  if (type === 'object') {
    const properties = shape.properties || {};
    for (const key of shape.required || []) {
      if (!Object.hasOwn(value, key)) throw deepseekError(`返回的 JSON 缺少字段: ${location}.${key}`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (Object.hasOwn(properties, key)) validateJsonShape(child, properties[key], `${location}.${key}`);
      else if (shape.additionalProperties === false) throw deepseekError(`返回的 JSON 包含额外字段: ${location}.${key}`);
    }
  }
  if (type === 'array' && shape.items) value.forEach((item, index) => validateJsonShape(item, shape.items, `${location}[${index}]`));
}

function deepseekError(message) {
  if (/ACCOUNT_SIGN_IN_REQUIRED|ACCOUNT_TOKEN_INVALID|Sign in to DeepSeek/i.test(message)) {
    return new Error('请先在 DeepSeek Harness 中登录 DeepSeek 账号, 然后重试');
  }
  return new Error(`DeepSeek CLI 调用失败: ${message.trim().slice(0, 800) || '未完成请求'}`);
}

function extractDeepseek({ code, stdout, stderr }) {
  let text = '';
  let failure = '';
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    let event;
    try { event = JSON.parse(trimmed); }
    catch { throw deepseekError('返回的数据不完整, 请重试'); }
    if (event.type === 'error') failure = event.message || 'CLI 返回错误';
    if (event.type === 'status' && event.phase === 'turn_end' && event.reason?.kind !== 'completed') {
      const error = event.reason?.error;
      failure = error ? `${error.code || ''}: ${error.message || '模型请求失败'}` : '请求已取消或未完成';
    }
    if (event.type === 'final' && typeof event.text === 'string') text = event.text.trim();
  }
  if (failure || code !== 0) throw deepseekError(failure || stderr || 'CLI 异常退出');
  if (!text) throw deepseekError('模型没有返回完整答复');
  return text;
}

function codexArgs({ model, schema, outputFile, reasoning, fast }) {
  const args = [
    'exec',
    '--json',
    '--ephemeral',
    '--skip-git-repo-check',
    '--ignore-user-config',
    '--ignore-rules',
    '-s',
    'read-only',
    '-c',
    'approval_policy="never"',
    '-c',
    'sandbox_mode="read-only"',
    '--color',
    'never',
    '-m',
    model,
    '-o',
    outputFile,
  ];
  if (reasoning) args.push('-c', `model_reasoning_effort="${reasoning}"`);
  args.push(fast ? '--enable' : '--disable', 'fast_mode');
  if (schema) args.push('--output-schema', schema);
  args.push('-');
  return args;
}

function extractMessage(stdout) {
  const lines = stdout.split('\n').map((line) => line.trim()).filter(Boolean);
  let text = '';
  for (const line of lines) {
    if (!line.startsWith('{')) continue;
    try {
      const event = JSON.parse(line);
      const item = event.item;
      if (item && (item.type === 'agent_message' || item.type === 'message') && item.text) {
        text = item.text;
      }
      if (event.type === 'message' && event.content) text = event.content;
    } catch {
      // 非 JSON 行忽略.
    }
  }
  return text.trim() || stdout.trim();
}

function parseJsonText(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('模型没有返回可解析的 JSON');
  }
}

module.exports = {
  detectLinks,
  listModels,
  complete,
  parseJsonText,
  reviewSchema,
  explainSchema,
};
