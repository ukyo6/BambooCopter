const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const file = path.join(root, 'renderer', 'chat-markdown.js');
assert(fs.existsSync(file), 'Chat Markdown renderer is missing');
const dom = new JSDOM('<!doctype html><div id="body"></div>', { runScripts: 'outside-only' });
for (const source of ['node_modules/marked/lib/marked.umd.js', 'node_modules/dompurify/dist/purify.min.js', 'renderer/chat-markdown.js']) {
  dom.window.eval(fs.readFileSync(path.join(root, source), 'utf8'));
}
const body = dom.window.document.getElementById('body');
const render = text => dom.window.BambooChatMarkdown.render(body, text);
render('**不一定**.\n\n## 用示例验证\n\n`fast` 每次走两步.\n\n- slow 走一步\n- fast 走两步\n\n| 轮次 | slow | fast |\n|---|---|---|\n| 3 | idx3 | idx3 |\n\n> 相遇点不一定是入环点.\n\n```java\nif (a < b) return "<script>";\n```');
assert.equal(body.querySelector('strong').textContent, '不一定');
assert.equal(body.querySelector('h2').textContent, '用示例验证');
assert.equal(body.querySelectorAll('li').length, 2);
assert.equal(body.querySelectorAll('table tbody tr').length, 1);
assert(body.querySelector('.chat-table-scroll table'));
assert(body.querySelector('blockquote'));
assert.equal(body.querySelector('pre code').textContent.trim(), 'if (a < b) return "<script>";');
assert.equal(body.querySelectorAll('script').length, 0);
render('[官网](https://leetcode.cn/problems/linked-list-cycle-ii/) [坏链接](javascript:alert(1))\n\n<img src=x onerror=alert(1)>\n\n![外部图片](https://example.com/pixel.png)');
assert.equal(body.querySelector('a').href, 'https://leetcode.cn/problems/linked-list-cycle-ii/');
assert.equal(body.querySelector('a').getAttribute('rel'), 'noopener noreferrer');
assert.equal(body.querySelectorAll('[href^="javascript:"],img,[onerror],script,iframe').length, 0);
assert(body.textContent.includes('<img src=x onerror=alert(1)>'));
render('旧聊天也能显示 **粗体**.');
assert.equal(body.querySelectorAll('table').length, 0);
assert.equal(body.querySelector('strong').textContent, '粗体');
dom.window.close();
console.log('Chat Markdown passed: headings, emphasis, lists, tables, quotes, code, links and replacement.');
