const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { pathToFileURL } = require('url');

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

function imageType(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return '';
}

function validateUploads(inputs, nativeImage) {
  if (inputs === undefined) return [];
  if (!Array.isArray(inputs) || inputs.length > MAX_IMAGES) throw new Error('每条消息最多发送 4 张图片');
  return inputs.map((input) => {
    if (!input || typeof input !== 'object' || input.path !== undefined || input.url !== undefined) throw new Error('图片必须通过文件内容上传');
    if (!extensions[input.mimeType]) throw new Error('图片仅支持 PNG、JPEG 和 WebP');
    const value = input.bytes;
    if (Object.prototype.toString.call(value) !== '[object ArrayBuffer]' && !ArrayBuffer.isView(value)) throw new Error('图片文件内容无效');
    if (!value.byteLength || value.byteLength > MAX_IMAGE_BYTES) throw new Error('单张图片不能为空且不能超过 10 MiB');
    const bytes = ArrayBuffer.isView(value) ? Buffer.from(value.buffer, value.byteOffset, value.byteLength) : Buffer.from(value);
    if (imageType(bytes) !== input.mimeType) throw new Error('图片内容与格式不匹配');
    const decoded = nativeImage.createFromBuffer(bytes);
    const size = decoded.getSize();
    if (decoded.isEmpty() || size.width <= 0 || size.height <= 0) throw new Error('图片无法解码, 请换一张完整的 PNG、JPEG 或 WebP 图片');
    const name = typeof input.name === 'string' ? input.name.split(/[\\/]/).at(-1).replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 120) : '';
    return { name: name || `图片.${extensions[input.mimeType]}`, mimeType: input.mimeType, bytes };
  });
}

function imageDirectory(userData) {
  return path.join(userData, 'chat-images');
}

function parseAttachments(json) {
  let items;
  try { items = JSON.parse(json || '[]'); } catch { throw new Error('聊天图片记录损坏'); }
  if (!Array.isArray(items) || items.length > MAX_IMAGES) throw new Error('聊天图片记录损坏');
  return items.map((item) => {
    if (!item || !idPattern.test(item.id) || !extensions[item.mimeType] || typeof item.name !== 'string' || !Number.isInteger(item.size) || item.size <= 0 || item.size > MAX_IMAGE_BYTES) throw new Error('聊天图片记录损坏');
    return { id: item.id, name: item.name, mimeType: item.mimeType, size: item.size };
  });
}

function attachmentPath(userData, item) {
  if (!idPattern.test(item?.id) || !extensions[item?.mimeType]) throw new Error('图片标识无效');
  return path.join(imageDirectory(userData), `${item.id}.${extensions[item.mimeType]}`);
}

function saveAttachments(userData, uploads) {
  if (!uploads.length) return [];
  fs.mkdirSync(imageDirectory(userData), { recursive: true, mode: 0o700 });
  const saved = [];
  try {
    for (const upload of uploads) {
      const item = { id: randomUUID(), name: upload.name, mimeType: upload.mimeType, size: upload.bytes.length };
      fs.writeFileSync(attachmentPath(userData, item), upload.bytes, { flag: 'wx', mode: 0o600 });
      saved.push(item);
    }
    return saved;
  } catch (error) {
    for (const item of saved) fs.rmSync(attachmentPath(userData, item), { force: true });
    throw error;
  }
}

function presentAttachments(userData, json) {
  return parseAttachments(json).map((item) => ({ ...item, url: pathToFileURL(attachmentPath(userData, item)).href }));
}

function resolveAttachment(userData, item) {
  const file = attachmentPath(userData, item);
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== item.size || stat.size > MAX_IMAGE_BYTES) throw new Error('invalid image');
    if (imageType(fs.readFileSync(file)) !== item.mimeType) throw new Error('invalid image');
  } catch {
    throw new Error(`聊天图片“${item.name}”不存在或已损坏, 请重新发送图片`);
  }
  return { path: file, mimeType: item.mimeType };
}

function buildChatContext(userData, history, includeImages = true) {
  const entries = history.map((item) => ({ ...item, attachments: parseAttachments(item.attachments_json) }));
  const selected = includeImages ? entries.flatMap((item) => item.attachments).slice(-MAX_IMAGES) : [];
  const numbers = new Map(selected.map((item, index) => [item.id, index + 1]));
  const transcript = entries.map((item) => {
    const labels = item.attachments.map((image) => {
      if (!includeImages) return `[图片未提供: ${image.name}; 当前模型不支持图片]`;
      return numbers.has(image.id) ? `[图片 ${numbers.get(image.id)}: ${image.name}]` : '[较早图片已超出本次 4 张图片的上下文限制]';
    });
    return `${item.role === 'user' ? '用户' : '助手'}: ${[item.body, ...labels].filter(Boolean).join('\n')}`;
  }).join('\n');
  return { transcript, images: selected.map((item) => resolveAttachment(userData, item)) };
}

module.exports = { validateUploads, saveAttachments, parseAttachments, presentAttachments, resolveAttachment, buildChatContext };
