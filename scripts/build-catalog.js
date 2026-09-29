const fs = require('fs');
const os = require('os');
const path = require('path');
const initSqlJs = require('sql.js');
const { fetchQuestion } = require('../electron/leetcode');

const root = path.join(os.homedir(), 'Library', 'Application Support', 'Bamboo Copter');
const catalogFile = path.join(__dirname, '..', 'assets', 'catalog.json');
const explainDest = path.join(__dirname, '..', 'assets', 'explains');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadProblems() {
  const SQL = await initSqlJs({
    locateFile: (name) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', name),
  });
  const db = new SQL.Database(fs.readFileSync(path.join(root, 'practice.db')));
  const stmt = db.prepare(
    'SELECT slug, title, translated_title, difficulty, group_name, sort_index, content_html, java_template FROM problems ORDER BY sort_index',
  );
  const problems = [];
  while (stmt.step()) problems.push(stmt.getAsObject());
  stmt.free();
  db.close();
  return problems;
}

async function main() {
  const problems = await loadProblems();
  for (const problem of problems) {
    if (problem.content_html) continue;
    const detail = await fetchQuestion(problem.slug);
    problem.content_html = detail.contentHtml;
    problem.java_template = detail.javaTemplate || problem.java_template;
    if (detail.translatedTitle) problem.translated_title = detail.translatedTitle;
    console.log(`fetched ${problem.slug}`);
    await sleep(350);
  }
  const catalog = {
    problems: problems.map((problem) => ({
      slug: problem.slug,
      title: problem.title,
      translatedTitle: problem.translated_title || '',
      difficulty: problem.difficulty,
      groupName: problem.group_name,
      sortIndex: problem.sort_index,
      contentHtml: problem.content_html || '',
      javaTemplate: problem.java_template || '',
    })),
  };
  const missing = catalog.problems.filter((problem) => !problem.contentHtml).map((problem) => problem.slug);
  if (missing.length) {
    throw new Error(`缺少题面: ${missing.join(', ')}`);
  }
  fs.writeFileSync(catalogFile, JSON.stringify(catalog));
  fs.mkdirSync(explainDest, { recursive: true });
  const explainSrc = path.join(root, 'explains');
  let explains = 0;
  for (const name of fs.readdirSync(explainSrc)) {
    if (!name.endsWith('.json')) continue;
    fs.copyFileSync(path.join(explainSrc, name), path.join(explainDest, name));
    explains += 1;
  }
  console.log(`catalog ${catalog.problems.length} bytes ${fs.statSync(catalogFile).size}`);
  console.log(`explains ${explains}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
