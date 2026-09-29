const fs = require('fs');
const os = require('os');
const path = require('path');

const KINDS = ['html', 'gif', 'image', 'text'];

const EXPLAIN_INSTRUCTION = [
  '为这道固定题目写一份可视化题解. 不要参考用户代码, 也不要给出完整可提交的 Java 代码.',
  '只输出 schema 要求的 JSON. 未使用的字符串字段填空字符串.',
  'caption 用 2 到 4 句中文说明思路, 不要标题党.',
  '按题目选一种形式:',
  '1. html: 过程会变化时用自包含 HTML 动画. html 必须是完整文档, 从 <!DOCTYPE html> 开始.',
  '只用内联 CSS 和 JS, 自动循环播放. 背景 #1c1c1c 或 #171717, 正文 #d4d4d4, 强调 #3794ff, 高亮块 #0e639c.',
  '字体 -apple-system, BlinkMacSystemFont, PingFang SC, sans-serif. 数字用 SF Mono, Monaco, Menlo, monospace.',
  '页面宽度 100%, 目标内容宽约 480-560px, 不要写死超大 max-width. 中文标签. 用题目中的示例数据.',
  '版式必须紧凑、像桌面讲解, 不要幻灯片大卡片:',
  '- 字号: 正文 12px, 标题 14px, 卡片标签 10-11px, 卡片数值 13px, 字母/数字小字块 13-15px.',
  '- 内边距: main 6-10px, panel/card 8-10px; 圆角 4-6px; 区块间距 6-10px. 少套大盒子.',
  '- 数组/字符串示意用小字块(约 36-40px 宽), 不要 70px 大格占半屏.',
  '- 下标和指针名称放在格子内部的正常文档流里, 不要用 position:absolute 配合 top/bottom 负值把文字甩到盒子外面.',
  '- 禁止 html, body, main 使用 overflow:hidden, 禁止 height:100% 把内容裁掉. 画面可以高于一屏.',
  '- 格子, 卡片, 标签不能互相遮挡. 高亮只改背景, 边框和数字. 不要用 translate 把元素移进别的区块. 每步至少停留 1.5 秒.',
  '不要外链, 不要网络请求, 不要 alert, 不要完整解题代码.',
  '2. image: 一张静态图就够时, svg 放完整 <svg>...</svg>, 背景 #1e1e1e, 中文标签. html 和 media 为空字符串.',
  '3. gif: 只有能给出 data:image/gif;base64 开头的内容时才用, 放在 media. 否则不要选 gif.',
  '4. text: 确实无法画出来时才用, 只填 caption.',
].join('\n');

function buildExplainPrompt(problem, statement) {
  return [
    EXPLAIN_INSTRUCTION,
    `题目: ${problem.translated_title || problem.title}`,
    `难度: ${problem.difficulty || ''}`,
    '题面:',
    statement || '(题面尚未加载)',
  ].join('\n\n');
}

function normalizeExplain(data) {
  const kind = KINDS.includes(data.kind) ? data.kind : 'text';
  const caption = String(data.caption || '').trim().slice(0, 2000);
  let html = String(data.html || '').trim();
  let svg = String(data.svg || '').trim();
  let media = String(data.media || '').trim();
  if (html.length > 120000) html = html.slice(0, 120000);
  if (svg.length > 120000) svg = svg.slice(0, 120000);
  if (media.length > 2000000) media = '';
  if (!caption) throw new Error('题解缺少说明文字');
  if (kind === 'html' && !/<\w+/.test(html)) throw new Error('题解缺少 HTML');
  if (kind === 'image' && !/<svg[\s>]/i.test(svg) && !/^data:image\/(png|svg\+xml|jpeg|webp)/i.test(media)) {
    throw new Error('题解缺少静态图');
  }
  if (kind === 'gif' && !/^data:image\/gif/i.test(media)) throw new Error('题解缺少 GIF');
  return JSON.stringify({ kind, caption, html, svg, media });
}

function userDataDir() {
  const candidates = [
    path.join(os.homedir(), 'Library', 'Application Support', 'Bamboo Copter'),
    path.join(os.homedir(), 'Library', 'Application Support', 'lc'),
    path.join(os.homedir(), 'Library', 'Application Support', 'LC'),
  ];
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'practice.db'))) || candidates[0];
}

function explainsDir(root = userDataDir()) {
  return path.join(root, 'explains');
}

const HTML_GUARD = `<style data-lc-polish>
html,body{font-size:12px !important;line-height:1.45 !important;-webkit-user-select:none !important;user-select:none !important;min-height:0 !important;height:auto !important}
html,body,.wrap,.app,main{min-height:0 !important}
.wrap,.app{align-items:flex-start !important;justify-content:flex-start !important}
h1,.title,.title strong,strong.title,.panel-title{font-size:14px !important;font-weight:600 !important;line-height:1.3 !important;margin:0 0 6px !important}
.top{justify-content:flex-start !important;align-items:center !important;gap:8px !important;flex-wrap:wrap !important}
.input{font-size:11px !important;padding:4px 8px !important}
.legend{font-size:11px !important;color:#8d8d8d !important}
.lead,.intro,.hint,.note,.summary,.footer,.foot,.desc,.caption,p,li{
  font-size:12px !important;
  line-height:1.45 !important;
  overflow:visible !important;
  max-height:none !important;
  white-space:normal !important;
}
.metric strong,.metric .value,.metric .num,.stat strong,.card .num,.card .value{font-size:13px !important;line-height:1.25 !important}
.status,.step,.formula,.rule,.explain{font-size:12px !important;line-height:1.45 !important}
html,body{background:#1c1c1c !important}
body{padding:0 !important}
.wrap,.app,main{padding:6px 8px 6px !important;max-width:560px !important}
.panel,section.panel,.board,section{padding:8px 10px !important;border-radius:6px !important;margin-top:8px !important;overflow:visible !important;max-height:none !important;height:auto !important}
.hint,.pointer,.sub,.muted{font-size:10px !important;line-height:1.3 !important}
.card,.metric,.stat{padding:8px 10px !important;border-radius:6px !important;min-height:0 !important}
.card .label,.label,.card-title{font-size:10px !important;line-height:1.3 !important;margin:0 0 4px !important}
.chars,.array,.row{gap:4px !important}
.status-grid,.metrics,.grid{gap:6px !important}
.chars .cell,.array .cell{
  width:38px !important;min-width:38px !important;max-width:42px !important;
  min-height:0 !important;height:auto !important;padding:4px 2px !important;
  border-radius:4px !important;border-width:1px !important;
}
.char,.cell .char{font-size:14px !important;line-height:1.15 !important}
.index,.marker,.label{font-size:10px !important;line-height:1.2 !important}
.rule,.status,.hint{padding:8px 10px !important;gap:8px !important;border-left-width:3px !important;min-height:0 !important;border-radius:0 6px 6px 0 !important}
.pill,.tag,.badge{padding:2px 7px !important;border-radius:4px !important;font-size:11px !important}
.progress,.bar{height:3px !important;border-radius:2px !important;margin-top:8px !important}
.lc-shell{background:transparent !important;border-color:transparent !important;box-shadow:none !important;width:100% !important;max-width:none !important;padding:2px 4px 6px !important}
.lc-shell>.title,.lc-shell>h1{font-size:14px !important;font-weight:650 !important;color:#f3f3f3 !important;margin-top:0 !important}
.lc-shell>.sub,.lc-shell>.intro{color:#8d8d8d !important}
.lc-shell>.hint,.lc-shell>.rule,.lc-shell>.note,.lc-shell>.footer,.lc-shell>.foot{background:transparent !important;border:0 !important;border-radius:0 !important;border-top:1px solid rgba(255,255,255,.08) !important;margin-top:10px !important;padding:8px 0 0 !important;color:#a8a8a8 !important}
.lc-shell .card-title{color:#9b9b9b !important;font-weight:600 !important}
.lc-shell .card{background:rgba(255,255,255,.035) !important;border-color:rgba(255,255,255,.08) !important}
</style>
<script data-lc-guard>
(function () {
  function hasReservedMinHeight(el) {
    const minH = getComputedStyle(el).minHeight;
    if (!minH || minH === '0px' || minH === 'auto') return 0;
    if (minH.includes('%')) return 0;
    const px = parseFloat(minH);
    return Number.isFinite(px) && px > 0 ? px : 0;
  }
  function onlyAbsoluteChildren(el) {
    const kids = Array.from(el.children || []);
    if (!kids.length) return false;
    return kids.every((kid) => {
      const pos = getComputedStyle(kid).position;
      return pos === 'absolute' || pos === 'fixed';
    });
  }
  function loosen(el) {
    if (!el) return;
    el.style.setProperty('max-height', 'none', 'important');
    el.style.setProperty('overflow', 'visible', 'important');
    const reserved = hasReservedMinHeight(el);
    if (reserved > 0) {
      // Keep room for absolute charts/bars. Wiping min-height collapses them to ~0.
      el.style.setProperty('min-height', reserved + 'px', 'important');
      if (onlyAbsoluteChildren(el)) {
        el.style.setProperty('height', Math.max(reserved, el.getBoundingClientRect().height || 0) + 'px', 'important');
      } else {
        el.style.setProperty('height', 'auto', 'important');
      }
      return;
    }
    el.style.setProperty('min-height', '0', 'important');
    el.style.setProperty('height', 'auto', 'important');
  }
  function stickOut(style, hostHeight) {
    if (!style || style.content === 'none') return { top: 0, bottom: 0 };
    if (style.position !== 'absolute' && style.position !== 'fixed') return { top: 0, bottom: 0 };
    const font = parseFloat(style.fontSize) || 13;
    const boxH = parseFloat(style.height) || Math.max(16, font * 1.45);
    const top = style.top === 'auto' ? NaN : parseFloat(style.top);
    const bottom = style.bottom === 'auto' ? NaN : parseFloat(style.bottom);
    let extraTop = 0;
    let extraBottom = 0;
    if (!Number.isNaN(top)) {
      if (top < 0) extraTop = -top;
      const hang = top + boxH - hostHeight;
      if (hang > 0) extraBottom = hang;
    }
    if (!Number.isNaN(bottom) && bottom < 0) extraBottom = Math.max(extraBottom, -bottom + boxH);
    return { top: extraTop, bottom: extraBottom };
  }
  function remember(map, el, top, bottom) {
    if (!el || (top < 1 && bottom < 1)) return;
    const prev = map.get(el) || { top: 0, bottom: 0 };
    prev.top = Math.max(prev.top, top);
    prev.bottom = Math.max(prev.bottom, bottom);
    map.set(el, prev);
  }
  function applyMargin(el, side, extra) {
    const key = side === 'top' ? 'lcBaseTop' : 'lcBaseBottom';
    const prop = side === 'top' ? 'marginTop' : 'marginBottom';
    if (el.dataset[key] == null) el.dataset[key] = String(parseFloat(getComputedStyle(el)[prop]) || 0);
    const base = parseFloat(el.dataset[key]) || 0;
    el.style[prop] = (extra > 1 ? base + extra + 10 : base) + 'px';
  }
  function fit() {
    loosen(document.documentElement);
    loosen(document.body);
    document.body.style.setProperty('min-height', '0', 'important');
    document.querySelectorAll('main,.app,.board,.stage,.grid,.panel,.timeline,.hint,.note,.lead,.intro,.summary,.footer,.foot,.desc').forEach((el) => {
      loosen(el);
    });
    const extras = new Map();
    document.querySelectorAll('body *').forEach((el) => {
      const style = getComputedStyle(el);
      if (style.position === 'absolute' || style.position === 'fixed') {
        const parent = el.offsetParent || el.parentElement;
        if (parent && parent !== document.documentElement) {
          const er = el.getBoundingClientRect();
          const pr = parent.getBoundingClientRect();
          remember(extras, parent, pr.top - er.top, er.bottom - pr.bottom);
        }
      }
      const hostH = el.getBoundingClientRect().height || el.offsetHeight || 0;
      const before = stickOut(getComputedStyle(el, '::before'), hostH);
      const after = stickOut(getComputedStyle(el, '::after'), hostH);
      remember(extras, el, Math.max(before.top, after.top), Math.max(before.bottom, after.bottom));
    });
    extras.forEach((box, el) => {
      applyMargin(el, 'top', box.top);
      applyMargin(el, 'bottom', box.bottom);
    });
  }
  // Prefer the outer main so title / panels / hint siblings stay in one box.
  // Never pick an inner section when main exists; that clipped .hint under .buckets.
  function pickCard() {
    const main = document.querySelector('main');
    if (main) return main;
    const list = Array.from(document.querySelectorAll('section.panel, section.card, .panel, .board, section'));
    let best = null;
    let bestArea = 0;
    list.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (rect.width < 80 || rect.height < 60 || area <= bestArea) return;
      best = el;
      bestArea = area;
    });
    return best || document.body;
  }
  function contentBox(card) {
    const nodes = [card].concat(Array.from(card.querySelectorAll('*')));
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    nodes.forEach((el) => {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      left = Math.min(left, rect.left);
      top = Math.min(top, rect.top);
      right = Math.max(right, rect.right);
      bottom = Math.max(bottom, rect.bottom);
    });
    if (!Number.isFinite(left)) {
      const rect = card.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }
    return {
      left: left,
      top: top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
    };
  }
  let lockedW = 0;
  let postedH = 0;
  let rounds = 0;
  function publishCard() {
    if (window.innerWidth < 40 || rounds > 10) return;
    document.body.style.setProperty('transform', 'none', 'important');
    document.documentElement.style.setProperty('overflow', 'visible', 'important');
    document.body.style.setProperty('overflow', 'visible', 'important');
    document.body.style.setProperty('min-height', '0', 'important');
    document.documentElement.style.setProperty('height', 'auto', 'important');
    document.body.style.setProperty('height', 'auto', 'important');
    document.body.style.setProperty('padding-bottom', '0', 'important');
    document.querySelectorAll('main, .app').forEach((el) => {
      el.style.setProperty('max-height', 'none', 'important');
      el.style.setProperty('overflow', 'visible', 'important');
      const reserved = hasReservedMinHeight(el);
      if (reserved > 0) el.style.setProperty('min-height', reserved + 'px', 'important');
      else el.style.setProperty('height', 'auto', 'important');
    });
    const card = pickCard();
    card.style.setProperty('margin', '0', 'important');
    void document.body.offsetHeight;
    const box = contentBox(card);
    // IMPORTANT: do not use document.scrollHeight here. After the parent sizes the
    // iframe to a previous post, scrollHeight tracks the viewport and ratchets up forever.
    const measured = Math.max(160, Math.min(window.innerWidth, Math.ceil(box.width + 8)));
    const width = lockedW || (window.innerWidth < 520 ? 520 : measured);
    let height = Math.max(120, Math.ceil(box.height + 24));
    const left = Math.max(0, box.left + window.scrollX - 4);
    const top = Math.max(0, box.top + window.scrollY - 4);
    document.body.style.setProperty('margin', '0', 'important');
    document.body.style.setProperty('transform', 'translate(' + (-left) + 'px,' + (-top) + 'px)', 'important');
    document.documentElement.style.setProperty('overflow', 'hidden', 'important');
    document.body.style.setProperty('overflow', 'hidden', 'important');
    document.body.style.setProperty('padding-bottom', '12px', 'important');
    if (!lockedW && window.innerWidth >= 520) lockedW = width;
    const changed = !postedH || Math.abs(height - postedH) > 6 || width !== lockedW;
    postedH = height;
    rounds += 1;
    if (changed) parent.postMessage({ lcExplain: true, width: width, height: height }, '*');
  }
  function markShell() {
    document.querySelectorAll('.lc-shell').forEach((el) => el.classList.remove('lc-shell'));
    const panels = Array.from(document.querySelectorAll('.panel'));
    if (panels.length !== 1) return;
    panels[0].classList.add('lc-shell');
  }
  function run() {
    markShell();
    fit();
    publishCard();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  window.addEventListener('load', function () { setTimeout(run, 60); setTimeout(run, 240); setTimeout(run, 800); });
  window.addEventListener('resize', function () { setTimeout(run, 40); });
})();
</script>`;

function injectHtmlGuard(html) {
  const source = String(html || '');
  if (!source || source.includes('data-lc-guard')) return source;
  if (/<\/body>/i.test(source)) return source.replace(/<\/body>/i, `${HTML_GUARD}</body>`);
  return `${source}${HTML_GUARD}`;
}

const EXPLAIN_PLAYER = `<script data-lc-player>
(function () {
  if (window.__lcPlayer) return;
  window.__lcPlayer = true;
  const nativeTimeout = window.setTimeout.bind(window);
  const nativeClear = window.clearTimeout.bind(window);
  const jobs = new Map();
  let nextId = 1;
  let rate = 1;
  let paused = false;

  function scaled(ms) {
    const delay = Number(ms);
    const base = Number.isFinite(delay) && delay > 0 ? delay : 0;
    return base / (rate || 1);
  }

  function arm(job, wait) {
    job.armedAt = Date.now();
    job.wait = wait;
    job.timer = nativeTimeout(function () {
      job.timer = null;
      if (paused || !jobs.has(job.id)) return;
      try { job.fn.apply(window, job.args); } catch (err) {}
      if (job.kind === 'interval' && jobs.has(job.id) && !paused) arm(job, scaled(job.delay));
      else jobs.delete(job.id);
    }, Math.max(0, wait));
  }

  function track(kind, fn, delay, args) {
    const id = nextId++;
    const job = { id: id, kind: kind, fn: fn, delay: Number(delay) || 0, args: args, timer: null, left: null };
    jobs.set(id, job);
    if (!paused) arm(job, scaled(job.delay));
    return id;
  }

  function drop(id) {
    const job = jobs.get(id);
    if (!job) return;
    if (job.timer) nativeClear(job.timer);
    jobs.delete(id);
  }

  window.setTimeout = function (fn, delay) {
    return track('timeout', fn, delay, Array.prototype.slice.call(arguments, 2));
  };
  window.setInterval = function (fn, delay) {
    return track('interval', fn, delay, Array.prototype.slice.call(arguments, 2));
  };
  window.clearTimeout = drop;
  window.clearInterval = drop;

  function applyAnimations() {
    try {
      document.getAnimations().forEach(function (item) {
        item.playbackRate = rate;
        if (paused) item.pause();
        else item.play();
      });
    } catch (err) {}
  }

  function pause() {
    if (paused) return;
    paused = true;
    const now = Date.now();
    jobs.forEach(function (job) {
      if (!job.timer) return;
      job.left = Math.max(0, job.wait - (now - job.armedAt));
      job.rateWhenLeft = rate;
      nativeClear(job.timer);
      job.timer = null;
    });
    applyAnimations();
  }

  function resume() {
    if (!paused) return;
    paused = false;
    jobs.forEach(function (job) {
      const wait = job.left == null ? scaled(job.delay) : job.left * ((job.rateWhenLeft || rate) / rate);
      job.left = null;
      arm(job, wait);
    });
    applyAnimations();
  }

  function setRate(value) {
    const next = Number(value);
    if (!Number.isFinite(next) || next <= 0) return;
    const prev = rate || 1;
    if (next === prev) {
      applyAnimations();
      return;
    }
    rate = next;
    if (paused) {
      applyAnimations();
      return;
    }
    const now = Date.now();
    jobs.forEach(function (job) {
      if (!job.timer) return;
      const left = Math.max(0, job.wait - (now - job.armedAt));
      nativeClear(job.timer);
      job.timer = null;
      arm(job, left * (prev / rate));
    });
    applyAnimations();
  }

  window.addEventListener('message', function (event) {
    const data = event.data || {};
    if (data.type !== 'lc-player') return;
    if (data.action === 'pause') pause();
    else if (data.action === 'resume') resume();
    else if (data.action === 'rate') setRate(data.rate);
  });
})();
</script>`;

function injectExplainPlayer(html) {
  const source = String(html || '');
  if (!source || source.includes('data-lc-player')) return source;
  // Prefer earliest injection so later explain scripts use wrapped timers.
  if (/<head[^>]*>/i.test(source)) return source.replace(/<head[^>]*>/i, (tag) => `${tag}${EXPLAIN_PLAYER}`);
  if (/<html[^>]*>/i.test(source)) return source.replace(/<html[^>]*>/i, (tag) => `${tag}${EXPLAIN_PLAYER}`);
  return `${EXPLAIN_PLAYER}${source}`;
}

function escapeCtrlInJsonStrings(source) {
  let out = '';
  let inStr = false;
  let esc = false;
  for (const ch of String(source || '')) {
    if (inStr) {
      if (esc) {
        out += ch;
        esc = false;
        continue;
      }
      if (ch === '\\') {
        out += ch;
        esc = true;
        continue;
      }
      if (ch === '"') {
        inStr = false;
        out += ch;
        continue;
      }
      const code = ch.charCodeAt(0);
      if (code < 32) {
        if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else out += `\\u${code.toString(16).padStart(4, '0')}`;
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') inStr = true;
    out += ch;
  }
  return out;
}

function parseExplainBody(body) {
  try {
    return JSON.parse(body);
  } catch {
    return JSON.parse(escapeCtrlInJsonStrings(body));
  }
}

function presentExplain(body) {
  if (!body) return '';
  try {
    const data = parseExplainBody(body);
    if (typeof data.html === 'string' && data.html) {
      data.html = injectHtmlGuard(injectExplainPlayer(data.html));
    }
    return JSON.stringify(data);
  } catch {
    return body;
  }
}

function explainFile(slug, root) {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('题目标识无效');
  return path.join(explainsDir(root), `${slug}.json`);
}

module.exports = {
  EXPLAIN_INSTRUCTION,
  buildExplainPrompt,
  normalizeExplain,
  injectHtmlGuard,
  presentExplain,
  userDataDir,
  explainsDir,
  explainFile,
};
