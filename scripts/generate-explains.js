const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { detectLinks, listModels, complete, parseJsonText, explainSchema } = require('../electron/agent');
const { fetchQuestion, htmlToText } = require('../electron/leetcode');
const {
  buildExplainPrompt,
  normalizeExplain,
  userDataDir,
  explainsDir,
  explainFile,
} = require('../electron/explain');

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = userDataDir();
  const dbFile = path.join(root, 'practice.db');
  if (!fs.existsSync(dbFile)) throw new Error(`database not found: ${dbFile}`);
  const problems = await loadProblems(dbFile);
  const selected = problems.filter((problem) => options.slugs.length === 0 || options.slugs.includes(problem.slug));
  const pending = selected.filter((problem) => !fs.existsSync(explainFile(problem.slug, root))).slice(0, options.limit);
  const link = await pickLink(options.provider);
  const model = options.model || await pickModel(link, root);
  fs.mkdirSync(explainsDir(root), { recursive: true });
  console.log(`generate start provider=${link.id} model=${model} count=${pending.length}`);
  let failed = 0;
  for (const problem of pending) {
    try {
      const statement = await statementOf(problem);
      const prompt = buildExplainPrompt(problem, statement.slice(0, 6000));
      const text = await complete(link, { model, prompt, schema: explainSchema, timeoutMs: 240000 });
      const body = normalizeExplain(parseJsonText(text));
      const file = explainFile(problem.slug, root);
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, body);
      fs.renameSync(tmp, file);
      fs.rmSync(`${file}.error`, { force: true });
      const kind = JSON.parse(body).kind;
      console.log(`generate ok slug=${problem.slug} kind=${kind}`);
    } catch (error) {
      failed += 1;
      const message = error.message || String(error);
      fs.writeFileSync(`${explainFile(problem.slug, root)}.error`, message);
      console.error(`generate fail slug=${problem.slug} error=${message}`);
    }
  }
  console.log(`generate done failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

function parseArgs(argv) {
  const options = { slugs: [], limit: Infinity, provider: '', model: '' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--slug') options.slugs.push(argv[++i]);
    else if (argv[i] === '--limit') options.limit = Number(argv[++i]);
    else if (argv[i] === '--provider') options.provider = argv[++i];
    else if (argv[i] === '--model') options.model = argv[++i];
  }
  return options;
}

async function loadProblems(dbFile) {
  const SQL = await initSqlJs({
    locateFile: (name) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', name),
  });
  const db = new SQL.Database(fs.readFileSync(dbFile));
  const stmt = db.prepare('SELECT slug, title, translated_title, difficulty, content_html FROM problems ORDER BY sort_index');
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  db.close();
  return rows;
}

async function statementOf(problem) {
  if (problem.content_html) return htmlToText(problem.content_html);
  const detail = await fetchQuestion(problem.slug);
  problem.translated_title = problem.translated_title || detail.translatedTitle;
  return htmlToText(detail.contentHtml);
}

async function pickLink(provider) {
  const links = detectLinks();
  const link = links.find((item) => item.id === (provider || 'codex')) || links[0];
  if (!link) throw new Error('no local agent');
  return link;
}

async function pickModel(link, root) {
  const SQL = await initSqlJs({
    locateFile: (name) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', name),
  });
  const db = new SQL.Database(fs.readFileSync(path.join(root, 'practice.db')));
  let saved = '';
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  stmt.bind(['model']);
  if (stmt.step()) saved = stmt.getAsObject().value || '';
  stmt.free();
  db.close();
  const models = await listModels(link);
  if (saved && models.some((model) => model.id === saved)) return saved;
  if (models[0]) return models[0].id;
  throw new Error('no model');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
