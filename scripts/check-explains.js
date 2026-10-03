const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { normalizeExplain, presentExplain } = require('../electron/explain');

const root = path.join(__dirname, '..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'electron', 'explain-schema.json'), 'utf8'));
const runtime = fs.readFileSync(path.join(root, 'renderer', 'explain-runtime.js'), 'utf8');

function compileScripts(html, filename) {
  let count = 0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    assert(!/\bsrc\s*=/i.test(match[1]), `${filename}: external scripts are not self-contained`);
    count += 1;
    new vm.Script(match[2], { filename: `${filename}:script-${count}` });
  }
  return count;
}

function checkAssets() {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'catalog.json'), 'utf8'));
  assert(Array.isArray(catalog.problems), 'catalog.problems must be an array');
  const slugs = catalog.problems.map((problem) => problem.slug);
  assert.equal(slugs.length, 100, 'catalog must contain all 100 problems');
  assert.equal(new Set(slugs).size, slugs.length, 'catalog contains duplicate slugs');
  slugs.forEach((slug) => assert(/^[a-z0-9-]+$/.test(slug), `Invalid slug: ${slug}`));
  const directory = path.join(root, 'assets', 'explains');
  const files = fs.readdirSync(directory).filter((file) => file.endsWith('.json')).sort();
  assert.deepEqual(files, slugs.map((slug) => `${slug}.json`).sort(), 'catalog and explanation slugs differ');

  let originalScripts = 0;
  let presentedScripts = 0;
  for (const file of files) {
    const body = fs.readFileSync(path.join(directory, file), 'utf8');
    const data = JSON.parse(body);
    assert(data && !Array.isArray(data), `${file}: expected an object`);
    assert.deepEqual(Object.keys(data).sort(), schema.required.slice().sort(), `${file}: invalid fields`);
    for (const key of schema.required) assert.equal(typeof data[key], 'string', `${file}: ${key} must be a string`);
    assert(schema.properties.kind.enum.includes(data.kind), `${file}: invalid kind`);
    assert(data.caption.trim(), `${file}: empty caption`);
    for (const key of ['time_complexity', 'space_complexity', 'complexity_note']) {
      assert(data[key].trim(), `${file}: empty ${key}`);
    }
    const normalized = JSON.parse(normalizeExplain(data));
    assert.equal(normalized.kind, data.kind, `${file}: kind changed during normalization`);
    for (const key of ['time_complexity', 'space_complexity', 'complexity_note']) {
      assert.equal(normalized[key], data[key], `${file}: normalization changed ${key}`);
    }
    const presented = JSON.parse(presentExplain(body));
    assert.equal(presented.caption, data.caption, `${file}: presentation changed the caption`);
    for (const key of ['time_complexity', 'space_complexity', 'complexity_note']) {
      assert.equal(presented[key], data[key], `${file}: presentation changed ${key}`);
    }
    assert.equal(presentExplain(JSON.stringify(presented)), JSON.stringify(presented), `${file}: injection must be idempotent`);
    if (data.kind === 'html') {
      assert(/^<!doctype html>/i.test(data.html.trim()), `${file}: expected a complete HTML document`);
      const count = compileScripts(data.html, file);
      assert(count > 0, `${file}: animated HTML has no inline script`);
      originalScripts += count;
      presentedScripts += compileScripts(presented.html, `presented/${file}`);
      assert.equal((presented.html.match(/<script\s+data-lc-player>/g) || []).length, 1, `${file}: expected one player`);
      assert.equal((presented.html.match(/<style\s+data-lc-theme>/g) || []).length, 1, `${file}: expected one theme`);
    }
  }
  assert.throws(() => normalizeExplain({ kind: 'text', caption: '缺少复杂度' }), /时间或空间复杂度/);
  console.log(`Assets passed: ${files.length} explanations, ${originalScripts} original scripts, ${presentedScripts} presented scripts.`);
}

// 假时钟只提供浏览器的外部时间和任务队列, 被测代码仍执行真实播放器实现.
// DOM 仅提供计时行为需要的正文变化和动画接口, 不代替浏览器布局检查.
function createPlayer() {
  let wallTime = 0;
  let nextTimer = 1;
  const timers = new Map();
  const listeners = new Map();
  const messages = [];
  const errors = [];
  const animations = [];
  const parent = { postMessage: (message) => messages.push(message) };
  let markup = '';
  let historyView = null;
  const classes = new Set();
  const body = {
    get innerHTML() { return markup; },
    set innerHTML(value) { markup = String(value); },
    // 这些固定用例只使用文本及 span, 去除标签即可区分文本变化和 class 变化.
    get innerText() { return (classes.has('lc-reviewing') ? historyView.innerHTML : markup).replace(/<[^>]*>/g, ''); },
    classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
    appendChild(node) { historyView = node; },
  };
  const sandbox = {
    parent,
    performance: { now: () => wallTime },
    console: { error: (error) => errors.push(error) },
    document: {
      readyState: 'loading',
      body,
      addEventListener() {},
      getAnimations: () => animations,
      createElement: () => ({ innerHTML: '', setAttribute() {}, remove() { historyView = null; }, querySelectorAll: () => [] }),
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    setTimeout(fn, delay, ...args) {
      const id = nextTimer++;
      timers.set(id, { due: wallTime + Math.max(0, Number(delay) || 0), fn, args });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(runtime, context, { filename: 'renderer/explain-runtime.js' });

  function emit(type, event) {
    (listeners.get(type) || []).forEach((listener) => listener(event));
  }

  return {
    body, messages, errors, animations,
    run(source) { return vm.runInContext(source, context); },
    emit,
    async command(action, options = {}, source = parent) {
      emit('message', { source, data: { type: 'lc-player', action, ...options } });
      // 单步会等待微任务后再比较正文变化; 不让宿主真实时间参与测试.
      for (let i = 0; i < 256; i += 1) await Promise.resolve();
    },
    async advance(ms) {
      const target = wallTime + ms;
      let fired = 0;
      while (timers.size) {
        const [id, task] = Array.from(timers.entries()).sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
        if (task.due > target) break;
        assert(++fired < 10000, 'Fake clock detected a non-terminating timer loop');
        timers.delete(id);
        wallTime = task.due;
        task.fn(...task.args);
        for (let i = 0; i < 256; i += 1) await Promise.resolve();
      }
      wallTime = target;
    },
  };
}

async function checkPlayer() {
  let count = 0;
  async function check(name, run) {
    await run(createPlayer());
    count += 1;
    console.log(`Player passed: ${name}`);
  }

  await check('pause freezes time and resume preserves the remaining delay', async (player) => {
    player.run('setTimeout(() => { document.body.innerHTML = "fired"; }, 1000);');
    await player.advance(400);
    await player.command('pause');
    await player.advance(5000);
    assert.equal(player.body.innerHTML, '');
    await player.command('resume');
    await player.advance(599);
    assert.equal(player.body.innerHTML, '');
    await player.advance(1);
    assert.equal(player.body.innerHTML, 'fired');
  });

  await check('rate changes preserve elapsed time', async (player) => {
    player.run('setTimeout(() => { document.body.innerHTML = "fired"; }, 1000);');
    await player.advance(200);
    await player.command('rate', { rate: 2 });
    await player.advance(399);
    assert.equal(player.body.innerHTML, '');
    await player.advance(1);
    assert.equal(player.body.innerHTML, 'fired');
  });

  await check('rate changes while paused do not consume the remaining delay', async (player) => {
    player.run('setTimeout(() => { document.body.innerHTML = "fired"; }, 1000);');
    await player.advance(100);
    await player.command('pause');
    await player.command('rate', { rate: 4 });
    await player.advance(5000);
    assert.equal(player.body.innerHTML, '');
    await player.command('resume');
    await player.advance(224);
    assert.equal(player.body.innerHTML, '');
    await player.advance(1);
    assert.equal(player.body.innerHTML, 'fired');
  });

  await check('one step produces one visible state and stays paused', async (player) => {
    player.run('let frames = 0; setInterval(() => { document.body.innerHTML = String(++frames); }, 1000);');
    await player.command('step');
    assert.equal(player.body.innerHTML, '1');
    await player.advance(10000);
    assert.equal(player.body.innerHTML, '1');
    await player.command('step');
    assert.equal(player.body.innerHTML, '2');
    await player.advance(10000);
    assert.equal(player.body.innerHTML, '2');
    assert.equal(player.messages.at(-1).paused, true);
  });

  await check('one step skips a scheduling callback and stops after the visible update', async (player) => {
    player.run('setTimeout(() => { setInterval(() => { document.body.innerHTML += "x"; }, 1000); }, 700);');
    await player.command('step');
    assert.equal(player.body.innerHTML, 'x');
    await player.advance(10000);
    assert.equal(player.body.innerHTML, 'x');
  });

  await check('one step skips highlight cleanup and advances to the next algorithm state', async (player) => {
    // maximum-path-sum 在两帧之间用延时把 active 改为 done, 但节点贡献并未变化.
    player.run(`
      document.body.innerHTML = '<span class="active">Contribution: 9</span>';
      setTimeout(() => {
        document.body.innerHTML = '<span class="done">Contribution: 9</span>';
      }, 1250);
      setTimeout(() => {
        document.body.innerHTML = '<span class="active">Contribution: 15</span>';
        setTimeout(() => {
          document.body.innerHTML = '<span class="done">Contribution: 15</span>';
        }, 1250);
      }, 2100);
    `);
    await player.command('step');
    assert.equal(player.body.innerText, 'Contribution: 15');
    assert.equal(player.body.innerHTML, '<span class="active">Contribution: 15</span>');
    await player.advance(10000);
    assert.equal(player.body.innerHTML, '<span class="active">Contribution: 15</span>');
    assert.equal(player.messages.at(-1).paused, true);
  });

  await check('cancelled timers stay cancelled and timeout arguments are preserved', async (player) => {
    player.run('const timeout = setTimeout(() => { throw Error("cancelled timeout"); }, 20); clearTimeout(timeout); const interval = setInterval(() => { throw Error("cancelled interval"); }, 20); clearInterval(interval); setTimeout((a, b) => { document.body.innerHTML = a + b; }, 30, "a", "b");');
    await player.advance(100);
    assert.equal(player.body.innerHTML, 'ab');
    assert.equal(player.errors.length, 0);
  });

  await check('timer exceptions and browser errors are posted to the parent', async (player) => {
    player.run('setTimeout(() => { throw Error("timer failure"); }, 10);');
    await player.advance(10);
    assert(player.messages.some((message) => message.lcExplainPlayer && message.error === 'timer failure'));
    assert.equal(player.errors.length, 1);
    player.emit('error', { message: 'script failure' });
    player.emit('unhandledrejection', { reason: new Error('rejection failure') });
    assert(player.messages.some((message) => message.error === 'script failure'));
    assert(player.messages.some((message) => message.error === 'rejection failure'));
  });

  await check('foreign messages and invalid rates cannot alter the clock', async (player) => {
    player.run('setTimeout(() => { document.body.innerHTML = "fired"; }, 1000);');
    await player.command('pause', {}, {});
    for (const rate of [0, -1, Infinity, 101, 'invalid']) await player.command('rate', { rate });
    await player.advance(999);
    assert.equal(player.body.innerHTML, '');
    await player.advance(1);
    assert.equal(player.body.innerHTML, 'fired');
  });

  await check('resume only restarts animations paused by the player', async (player) => {
    function animation(playState) {
      return {
        playState, playbackRate: 1,
        pause() { this.playState = 'paused'; },
        play() { this.playState = 'running'; },
      };
    }
    const running = animation('running');
    const alreadyPaused = animation('paused');
    player.animations.push(running, alreadyPaused);
    await player.command('pause');
    assert.equal(running.playState, 'paused');
    await player.command('rate', { rate: 2 });
    await player.command('resume');
    assert.equal(running.playState, 'running');
    assert.equal(alreadyPaused.playState, 'paused');
    assert.equal(running.playbackRate, 2);
  });
  await check('previous step displays history without altering live closures', async (player) => {
    player.run('let frame = 0; document.body.innerHTML = "0"; setInterval(() => { document.body.innerHTML = String(++frame); }, 1000);');
    await player.command('step'); await player.command('step');
    assert.equal(player.body.innerText, '2');
    await player.command('back');
    assert.equal(player.body.innerText, '1');
    assert.equal(player.body.innerHTML, '2', 'live DOM must remain untouched');
    await player.command('step'); assert.equal(player.body.innerText, '2');
    await player.command('step'); assert.equal(player.body.innerText, '3');
  });
  await check('previous at initial state is harmless and disabled', async (player) => {
    player.run('document.body.innerHTML = "initial";');
    await player.command('back');
    assert.equal(player.body.innerText, 'initial');
    assert.equal(player.messages.at(-1).canBack, false);
  });
  await check('autoplay can step back, then resume through cached frames at the selected rate', async (player) => {
    player.run('let frame = 0; document.body.innerHTML = "0"; setInterval(() => { document.body.innerHTML = String(++frame); }, 1000);');
    await player.advance(3000); assert.equal(player.body.innerText, '3');
    await player.command('back'); await player.command('back');
    assert.equal(player.body.innerText, '1');
    await player.advance(5000); assert.equal(player.body.innerText, '1');
    await player.command('rate', { rate: 2 }); await player.command('resume');
    await player.advance(500); assert.equal(player.body.innerText, '2');
    await player.advance(500); assert.equal(player.body.innerText, '3');
    await player.advance(500); assert.equal(player.body.innerText, '4');
  });
  await check('rapid next and previous commands are applied in order', async (player) => {
    player.run('let frame = 0; document.body.innerHTML = "0"; setInterval(() => { document.body.innerHTML = String(++frame); }, 1000);');
    await Promise.all([player.command('step'), player.command('step'), player.command('back')]);
    assert.equal(player.body.innerText, '1');
    await player.command('step'); await player.command('step');
    assert.equal(player.body.innerText, '3');
  });
  await check('finished one-shot animations can still go back and forward', async (player) => {
    player.run('document.body.innerHTML = "start"; setTimeout(() => { document.body.innerHTML = "done"; }, 1000);');
    await player.command('step'); await player.command('back');
    assert.equal(player.body.innerText, 'start');
    await player.command('step'); assert.equal(player.body.innerText, 'done');
    await player.command('step'); assert.equal(player.body.innerText, 'done');
  });
  await check('async loop resets are recorded after nested microtasks settle', async (player) => {
    player.run('const wait = ms => new Promise(r => setTimeout(r, ms)); async function play(){ document.body.innerHTML="reset"; await wait(100); document.body.innerHTML="answer"; await wait(100); } (async()=>{while(true) await play();})();');
    await player.command('step'); assert.equal(player.body.innerText, 'answer');
    await player.command('step'); assert.equal(player.body.innerText, 'reset');
    await player.command('back'); assert.equal(player.body.innerText, 'answer');
    await player.command('step'); assert.equal(player.body.innerText, 'reset');
    await player.command('step'); assert.equal(player.body.innerText, 'answer');
  });
  await check('rate and pause changes during history playback preserve the remaining delay', async (player) => {
    player.run('let frame=0; document.body.innerHTML="0"; setInterval(()=>{document.body.innerHTML=String(++frame)},1000);');
    await player.command('step'); await player.command('step'); await player.command('step');
    await player.command('back'); await player.command('back'); await player.command('resume');
    await player.advance(250); await player.command('rate',{rate:2});
    await player.advance(374); assert.equal(player.body.innerText,'1');
    await player.advance(1); assert.equal(player.body.innerText,'2');
    await player.advance(125); await player.command('pause'); await player.advance(5000);
    await player.command('resume'); await player.advance(374); assert.equal(player.body.innerText,'2');
    await player.advance(1); assert.equal(player.body.innerText,'3');
  });
  await check('short presentation animations settle while algorithm playback is paused', async (player) => {
    const animation={playState:'running',playbackRate:1,effect:{getComputedTiming:()=>({endTime:250,iterations:1})},pause(){this.playState='paused'},play(){this.playState='running'}};
    player.animations.push(animation); await player.command('pause');
    assert.equal(animation.playState,'running');
  });
  await check('cosmetic cleanup preserves the algorithm frame timestamp during history playback', async (player) => {
    player.run('document.body.innerHTML="start"; setTimeout(()=>{document.body.innerHTML="<span class=active>n9</span>"},900); setTimeout(()=>{document.body.innerHTML="<span class=done>n9</span>"},2150); setTimeout(()=>{document.body.innerHTML="n15"},3000);');
    await player.advance(3000); await player.command('back'); assert.equal(player.body.innerText,'n9');
    await player.command('resume'); await player.advance(2099); assert.equal(player.body.innerText,'n9');
    await player.advance(1); assert.equal(player.body.innerText,'n15');
  });
  await check('first paint and script text cannot create phantom algorithm steps', async (player) => {
    player.run(`
      let painted=false; document.body.innerHTML='initial';
      Object.defineProperty(document.body,'innerText',{get(){return document.body.innerHTML+(painted?'':' script contents')}});
      document.createTreeWalker=()=>{
        const nodes=[{textContent:document.body.innerHTML,parentElement:{closest:()=>null}},{textContent:'script contents',parentElement:{closest:()=>true}}];
        return {nextNode:()=>nodes.shift()||null};
      };
      setTimeout(()=>{painted=true},100);
      setTimeout(()=>{document.body.innerHTML='next'},200);
    `);
    await player.command('step'); assert.equal(player.body.innerHTML,'next');
    await player.command('back'); assert.equal(player.messages.at(-1).canBack,false);
  });
  await check('long progress transitions freeze with algorithm playback', async (player) => {
    const animation={constructor:{name:'CSSTransition'},playState:'running',playbackRate:1,effect:{getComputedTiming:()=>({endTime:1700,iterations:1})},pause(){this.playState='paused'},play(){this.playState='running'}};
    player.animations.push(animation); await player.command('pause');
    assert.equal(animation.playState,'paused'); await player.command('resume'); assert.equal(animation.playState,'running');
  });
  await check('canvas keyboard shortcuts are relayed without stealing editable input keys', async (player) => {
    let prevented=0;
    player.emit('keydown',{key:'ArrowRight',target:{closest:()=>null},preventDefault(){prevented++}});
    assert(player.messages.some(m=>m.lcExplainKey==='ArrowRight')); assert.equal(prevented,1);
    const count=player.messages.length;
    player.emit('keydown',{key:' ',target:{closest:()=>({})},preventDefault(){prevented++}});
    assert.equal(player.messages.length,count); assert.equal(prevented,1);
    player.emit('keydown',{key:'Escape'}); assert.equal(player.messages.at(-1).lcExplainKey,'Escape');
  });
  console.log(`Player checks passed: ${count}. DOM layout, CSS rendering, and full explanation playback require browser validation.`);
}

async function main() {
  checkAssets();
  await checkPlayer();
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
