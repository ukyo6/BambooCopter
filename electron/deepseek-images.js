const { spawnSync } = require('child_process');
const { randomUUID } = require('crypto');
const spawn = require('cross-spawn');
const fs = require('fs');
const os = require('os');

// 安装版 SDK 没有 session/wait. 只读取本次唯一 Session 的已提交答复和 turn/end.
function completeDeepseekImages(binary, { model, prompt, images, patchFile, timeoutMs = 180000 }) {
  const contentBlocks = [
    { type: 'text', text: prompt },
    ...images.map((image) => ({ type: 'image', data: fs.readFileSync(image.path).toString('base64'), mimeType: image.mimeType })),
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ['--profile', 'sdk', '--patch', patchFile], {
      cwd: os.tmpdir(), env: process.env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
    });
    const sessionId = `bamboo-${randomUUID()}`;
    let buffer = '';
    let stderr = '';
    let text = '';
    let failure;
    let started = false;
    let ended = false;
    let promptAccepted = false;
    let shutdownSent = false;
    let shutdownAccepted = false;
    let stopped = false;

    const stop = (error) => {
      failure ||= error;
      if (stopped) return;
      stopped = true;
      // 等 close 后才返回, 使调用补丁和临时附件的清理发生在子进程真正退出之后.
      if (process.platform === 'win32' && Number.isInteger(child.pid) && child.pid > 0) {
        const result = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        if (result.status !== 0) child.kill('SIGKILL');
      } else child.kill('SIGKILL');
    };
    const send = (method, params = {}) => {
      if (stopped) return;
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: method, method, params })}\n`);
    };
    const shutdown = () => {
      if (!ended || !promptAccepted || shutdownSent) return;
      shutdownSent = true;
      send('shutdown');
    };
    const response = (frame) => {
      if (!['initialize', 'session/prompt', 'shutdown'].includes(frame.id)) return;
      if (frame.error) throw new Error(frame.error.message || 'SDK 请求失败');
      if (!Object.hasOwn(frame, 'result')) throw new Error('SDK 返回的数据不完整');
      if (frame.id === 'initialize') {
        if (frame.result?.serverInfo?.name !== 'deepseek-harness-sdk-runtime') throw new Error('SDK 握手失败');
        send('session/prompt', { sessionId, contentBlocks });
      } else if (frame.id === 'session/prompt') {
        if (typeof frame.result?.messageId !== 'string' || !frame.result.messageId) throw new Error('SDK 未接受图文消息');
        promptAccepted = true;
        shutdown();
      } else {
        shutdownAccepted = true;
        child.stdin.end();
      }
    };
    const event = (frame) => {
      if (frame.method !== 'session.event' || frame.params?.sessionId !== sessionId || ended) return;
      const current = frame.params.event;
      if (current?.type === 'turn/start') started = true;
      if (!started) return;
      if (current?.type === 'assistant/message') {
        const content = current.data?.message?.content;
        if (!Array.isArray(content)) throw new Error('SDK 答复的数据不完整');
        const joined = content.filter((block) => block.type === 'text' && typeof block.text === 'string').map((block) => block.text).join('');
        if (joined.trim()) text = joined.trim();
      }
      if (current?.type === 'turn/end') {
        ended = true;
        const reason = current.data?.reason;
        if (reason?.kind !== 'completed') {
          failure = new Error(reason?.error ? `${reason.error.code || ''}: ${reason.error.message || '模型请求失败'}` : '请求已取消或未完成');
        } else if (!text) failure = new Error('模型没有返回完整答复');
        shutdown();
      }
    };
    const receive = (line) => {
      if (stopped || !line.trim()) return;
      try {
        const frame = JSON.parse(line);
        if (frame?.jsonrpc !== '2.0') throw new Error('SDK 返回的数据不完整');
        if (Object.hasOwn(frame, 'id')) response(frame);
        else event(frame);
      } catch (error) { stop(error); }
    };
    const timer = setTimeout(() => stop(new Error('模型调用超时')), timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      for (;;) {
        const newline = buffer.indexOf('\n');
        if (newline < 0) break;
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        receive(line);
      }
    });
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-4000); });
    child.stdin.on('error', stop);
    child.on('error', (error) => { failure ||= error; });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (buffer.trim()) receive(buffer);
      if (failure) reject(failure);
      else if (code !== 0) reject(new Error(stderr.trim() || 'CLI 异常退出'));
      else if (!ended || !promptAccepted || !shutdownAccepted) reject(new Error('SDK 未完成图文请求, 请重试'));
      else resolve(text);
    });
    send('initialize', { cwd: os.tmpdir(), provider: 'deepseek-account', model });
  });
}

module.exports = { completeDeepseekImages };
