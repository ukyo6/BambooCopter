const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'node_modules', 'monaco-editor', 'min', 'vs');
const target = path.join(__dirname, '..', 'renderer', 'vendor', 'vs');

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.cpSync(source, target, { recursive: true });
