const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'node_modules', 'monaco-editor', 'min', 'vs');
const target = path.join(__dirname, '..', 'renderer', 'vendor', 'vs');

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.cpSync(source, target, { recursive: true });
for (const [sourceFile, name] of [
  ['marked/lib/marked.umd.js', 'marked.js'],
  ['dompurify/dist/purify.min.js', 'purify.js'],
]) {
  fs.copyFileSync(path.join(__dirname, '..', 'node_modules', sourceFile), path.join(__dirname, '..', 'renderer', 'vendor', name));
}
