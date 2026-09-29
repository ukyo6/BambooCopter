const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const reviewSchema = path.join(__dirname, 'review-schema.json');
const explainSchema = path.join(__dirname, 'explain-schema.json');

function which(command) {
  const result = spawnSync('which', [command], { encoding: 'utf8', env: process.env });
  const found = (result.stdout || '').trim();
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
  return links;
}

function runProcess(binary, args, { stdin = '', timeoutMs = 180000, cwd = os.tmpdir() } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('模型调用超时'));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
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
