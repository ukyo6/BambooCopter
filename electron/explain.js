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
  '页面宽度 100%, 目标内容宽约 640px. 中文标签. 用题目中的示例数据.',
  '优先由真实算法生成不可变的步骤快照, 再逐帧渲染. 输入、指针、临时状态、已确定结果和当前说明必须属于同一步.',
  '展示关键机制而非直接跳到答案: 回溯要显示选择与撤销, 链表要显示实际 next, 动态规划要显示候选比较与状态更新.',
  '重播必须恢复全部数据、文字、颜色、透明度与高亮. 播放、单步、倍速和缩放由外层统一控制, 页面不要重复放播放器按钮.',
  '版式必须紧凑、像桌面讲解, 不要幻灯片大卡片:',
  '- 字号: 正文 13px, 标题 16px, 卡片标签 11-12px, 卡片数值 14px, 字母/数字小字块 14-16px.',
  '- 内边距: main 6-10px, panel/card 8-10px; 圆角 4-6px; 区块间距 6-10px. 少套大盒子.',
  '- 数组/字符串示意用小字块(约 36-40px 宽), 不要 70px 大格占半屏.',
  '- 下标和指针名称放在格子内部的正常文档流里, 不要用 position:absolute 配合 top/bottom 负值把文字甩到盒子外面.',
  '- 禁止 html, body, main 使用 overflow:hidden, 禁止 height:100% 把内容裁掉. 画面可以高于一屏.',
  '- 格子, 卡片, 标签不能互相遮挡. 高亮只改背景, 边框和数字. 不要用 translate 把元素移进别的区块. 每步至少停留 1.5 秒.',
  '- 树和图的连线要精确连接节点, 不用空格排版的 ASCII 线. 柱高、坐标刻度和指针标签都必须落在绘图区内.',
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

const EXPLAIN_THEME = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'explain-theme.css'), 'utf8');
const EXPLAIN_RUNTIME = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'explain-runtime.js'), 'utf8');

function injectHtmlGuard(html) {
  const source = String(html || '');
  if (!source || source.includes('data-lc-theme')) return source;
  const style = `<style data-lc-theme>${EXPLAIN_THEME}</style>`;
  if (/<\/head>/i.test(source)) return source.replace(/<\/head>/i, `${style}</head>`);
  return `${style}${source}`;
}

function injectExplainPlayer(html) {
  const source = String(html || '');
  if (!source || source.includes('data-lc-player')) return source;
  const player = `<script data-lc-player>${EXPLAIN_RUNTIME}</script>`;
  if (/<head[^>]*>/i.test(source)) return source.replace(/<head[^>]*>/i, (tag) => `${tag}${player}`);
  return `${player}${source}`;
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
