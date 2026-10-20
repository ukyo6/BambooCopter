const { randomInt } = require('crypto');
const { defaultJavaTemplate } = require('./leetcode');

const CHALLENGE_DURATION_MS = 15 * 60 * 1000;

function createChallengeStore(api) {
  function get(at = Date.now()) {
    const row = api.all(
      `SELECT c.*, p.title, p.translated_title FROM random_challenges c
       JOIN problems p ON p.slug = c.slug ORDER BY c.id DESC LIMIT 1`,
    )[0];
    if (!row) return null;
    if (row.status === 'active' && at >= row.deadline_at) {
      api.run(
        "UPDATE random_challenges SET status = 'fail', finished_at = deadline_at WHERE id = ? AND status = 'active'",
        [row.id],
      );
      row.status = 'fail';
      row.finished_at = row.deadline_at;
    }
    return row;
  }

  function start() {
    if (get()?.status === 'active') throw new Error('随机挑战进行中, 不能重新抽题');
    const problems = api.all('SELECT slug, java_template FROM problems ORDER BY sort_index');
    if (!problems.length) throw new Error('题库为空, 暂时无法抽题');
    const problem = problems[randomInt(problems.length)];
    const slug = problem.slug;
    const startedAt = Date.now();
    // 新挑战从题目模板开始, 不复用之前的答案.
    api.runQuiet(
      'INSERT INTO drafts(slug, code, updated_at) VALUES(?, ?, ?) ON CONFLICT(slug) DO UPDATE SET code = excluded.code, updated_at = excluded.updated_at',
      [slug, problem.java_template || defaultJavaTemplate(), startedAt],
    );
    api.run(
      "INSERT INTO random_challenges(slug, started_at, deadline_at, status) VALUES(?, ?, ?, 'active')",
      [slug, startedAt, startedAt + CHALLENGE_DURATION_MS],
    );
    return get();
  }

  function assertSelectable(slug) {
    const challenge = get();
    if (challenge?.status === 'active' && challenge.slug !== slug) {
      throw new Error('随机挑战进行中, 当前题目已锁定');
    }
    return challenge;
  }

  function finishReview(id, verdict, submissionId, completedAt) {
    const challenge = get(completedAt);
    if (challenge?.id === id && challenge.status === 'active' && verdict === 'pass') {
      api.run(
        "UPDATE random_challenges SET status = 'pass', finished_at = ?, submission_id = ? WHERE id = ? AND status = 'active'",
        [completedAt, submissionId, id],
      );
      return get(completedAt);
    }
    return challenge;
  }

  return { get, start, assertSelectable, finishReview };
}

module.exports = { createChallengeStore };
