(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BambooReviewUtils = api;
})(typeof globalThis === 'object' ? globalThis : this, function createReviewUtils() {
  function sourceLines(code) {
    return (typeof code === 'string' ? code : '').split(/\r\n|\r|\n/);
  }

  function numberCode(code) {
    return sourceLines(code).map((line, index) => `${index + 1} | ${line}`).join('\n');
  }

  function excerptLocations(excerpt, lines) {
    if (typeof excerpt !== 'string' || !excerpt.trim()) return [];
    const fragments = sourceLines(excerpt.trim()).map((line) => line.trim());
    const locations = [];
    for (let index = 0; index + fragments.length <= lines.length; index += 1) {
      const matches = fragments.length === 1
        ? lines[index].includes(fragments[0])
        : fragments.every((fragment, offset) => {
          const source = lines[index + offset].trim();
          if (offset === 0) return source.endsWith(fragment);
          if (offset === fragments.length - 1) return source.startsWith(fragment);
          return source === fragment;
        });
      if (matches) locations.push({ start: index + 1, end: index + fragments.length });
    }
    return locations;
  }

  function legacyExcerpts(issue) {
    const text = typeof issue.message === 'string' ? issue.message : '';
    const excerpts = [];
    for (const match of text.matchAll(/`([^`]+)`/g)) {
      const excerpt = match[1].trim();
      // 单个标识符只是文字提及, 不能可靠说明错误所在的代码位置.
      if (excerpt && !/^[\w$]+$/.test(excerpt)) excerpts.push(excerpt);
    }
    const constructor = /\bnew\s+(?:[\w$]+\.)*[\w$]+(?:\s*<[^;\n]*?>)?\s*\(/g;
    for (const match of text.matchAll(constructor)) {
      let depth = 1;
      let quote = '';
      let escaped = false;
      for (let index = match.index + match[0].length; index < text.length; index += 1) {
        const character = text[index];
        if (quote) {
          if (escaped) escaped = false;
          else if (character === '\\') escaped = true;
          else if (character === quote) quote = '';
        } else if (character === '"' || character === "'") quote = character;
        else if (character === '(') depth += 1;
        else if (character === ')') depth -= 1;
        if (depth === 0) {
          excerpts.push(text.slice(match.index, index + 1));
          break;
        }
      }
    }
    return [...new Set(excerpts)];
  }

  function normalizeIssue(issue, lines) {
    const normalized = {
      message: typeof issue.message === 'string' ? issue.message : '',
      hint: typeof issue.hint === 'string' ? issue.hint : '',
      line_start: 0,
      line_end: 0,
      code_excerpt: '',
    };
    const hasExcerpt = typeof issue.code_excerpt === 'string' && Boolean(issue.code_excerpt.trim());
    const isLegacy = !Object.prototype.hasOwnProperty.call(issue, 'code_excerpt');
    const excerpts = hasExcerpt ? [issue.code_excerpt.trim()] : isLegacy ? legacyExcerpts(issue) : [];
    const candidates = [];
    for (const excerpt of excerpts) {
      const locations = excerptLocations(excerpt, lines);
      const provided = locations.find((location) => location.start === issue.line_start && location.end === issue.line_end);
      if (provided && hasExcerpt) {
        normalized.line_start = provided.start;
        normalized.line_end = provided.end;
        normalized.code_excerpt = lines.slice(provided.start - 1, provided.end).join('\n').trim();
        return normalized;
      }
      if (isLegacy && locations.length !== 1) return normalized;
      if (locations.length === 1) candidates.push(locations[0]);
    }
    const distinct = new Map(candidates.map((location) => [`${location.start}:${location.end}`, location]));
    if (distinct.size === 1) {
      const [location] = distinct.values();
      normalized.line_start = location.start;
      normalized.line_end = location.end;
      normalized.code_excerpt = lines.slice(location.start - 1, location.end).join('\n').trim();
    }
    return normalized;
  }

  function normalizeIssues(issues, code) {
    if (!Array.isArray(issues)) return [];
    const lines = sourceLines(code);
    return issues
      .filter((issue) => issue && typeof issue === 'object' && !Array.isArray(issue))
      .map((issue) => normalizeIssue(issue, lines));
  }

  function normalizeReview(raw, code) {
    const review = raw && typeof raw === 'object' ? raw : {};
    return {
      verdict: review.verdict === 'pass' ? 'pass' : 'fail',
      summary: typeof review.summary === 'string' ? review.summary : '',
      issues: normalizeIssues(review.issues, code),
    };
  }

  return { numberCode, normalizeIssues, normalizeReview };
});
