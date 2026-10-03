(function () {
  if (window.__lcPlayer) return;
  window.__lcPlayer = true;
  const nativeTimeout = window.setTimeout.bind(window);
  const nativeClear = window.clearTimeout.bind(window);
  const jobs = new Map();
  const pausedAnimations = new WeakSet();
  let nextId = 1;
  let rate = 1;
  let paused = false;
  let time = 0;
  let anchor = performance.now();
  let alarm = null;
  let commands = Promise.resolve();
  const history = [];
  const presentationAnimations = new WeakSet();
  let cursor = -1;
  let historyView = null;
  let requestLayout = () => {};
  let historyElapsed = 0;
  let historyAnchor = anchor;

  function reviewing() { return cursor >= 0 && cursor < history.length - 1; }

  function contentText() {
    // iframe 首次绘制前 innerText 可能退化成 textContent, 连脚本文本也包含进去.
    // 用独立文字节点识别算法状态, 避免加载和换行产生虚假的历史帧.
    if (!document.createTreeWalker) return document.body.innerText.replace(/\s+/g, ' ').trim();
    const walker = document.createTreeWalker(document.body, 4);
    const parts = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest('script,style,[data-lc-history]')) continue;
      const text = node.textContent.trim();
      if (text) parts.push(text);
    }
    return parts.join(' ');
  }

  // 历史只负责显示. 原节点、闭包和计时任务保持在最新状态, 不把旧 HTML 写回运行画面.
  function remember() {
    if (reviewing()) return;
    const body = document.body;
    const html = body.children
      ? Array.from(body.children).filter(node => !/^(SCRIPT|STYLE)$/.test(node.tagName) && node !== historyView).map(node => node.outerHTML).join('')
      : body.innerHTML;
    const frame = { html, text: contentText(), time };
    if (!history.length || frame.text !== history[history.length - 1].text) {
      history.push(frame);
      // 自动循环不会无限累积 DOM 快照.
      if (history.length > 200) history.shift();
    } else history[history.length - 1] = { ...frame, time: history[history.length - 1].time };
    cursor = history.length - 1;
  }

  function showHistory() {
    if (!reviewing()) {
      document.body.classList.remove('lc-reviewing');
      historyView?.remove();
      historyView = null;
    } else {
      if (!historyView) {
        historyView = document.createElement('div');
        historyView.setAttribute('data-lc-history', '');
        document.body.appendChild(historyView);
      }
      historyView.innerHTML = history[cursor].html;
      historyView.querySelectorAll('script').forEach(node => node.remove());
      // SVG 箭头与渐变使用自身的 defs, 避免引用被隐藏的原图.
      const definitions = new Map();
      historyView.querySelectorAll('svg defs [id]').forEach(node => {
        definitions.set(node.id, `lc-history-${node.id}`);
        node.id = `lc-history-${node.id}`;
      });
      if (definitions.size) historyView.querySelectorAll('svg *').forEach(node => {
        Array.from(node.attributes).forEach(attribute => {
          let value = attribute.value;
          definitions.forEach((replacement, id) => { value = value.split(`url(#${id})`).join(`url(#${replacement})`); if (value === `#${id}`) value = `#${replacement}`; });
          if (value !== attribute.value) node.setAttribute(attribute.name, value);
        });
      });
      document.body.classList.add('lc-reviewing');
      if (historyView.animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        const animation = historyView.animate([{ opacity: 0.92 }, { opacity: 1 }], { duration: 150, easing: 'cubic-bezier(.22,1,.36,1)' });
        presentationAnimations.add(animation);
      }
    }
    requestLayout();
  }

  async function settle() {
    // async play() 和外层循环都可能继续排入微任务, 要在 reset 后记录完整的一帧.
    for (let i = 0; i < 8; i++) await Promise.resolve();
  }

  function enqueue(action) {
    commands = commands.then(action).catch(error => { report(error.message || String(error)); console.error(error); });
  }

  function now() {
    return time + (paused || reviewing() ? 0 : (performance.now() - anchor) * rate);
  }

  function updateClock() {
    const wall = performance.now();
    if (reviewing() && !paused) historyElapsed += (wall - historyAnchor) * rate;
    time = now();
    anchor = wall;
    historyAnchor = wall;
  }

  function report(error) {
    parent.postMessage({ lcExplainPlayer: true, paused, rate, canBack: cursor > 0, error: error || '' }, '*');
  }

  function schedule() {
    if (alarm !== null) nativeClear(alarm);
    alarm = null;
    if (paused) return;
    if (reviewing()) {
      const delay = Math.max(4, history[cursor + 1].time - history[cursor].time - historyElapsed);
      alarm = nativeTimeout(() => {
        alarm = null;
        enqueue(() => {
          if (paused || !reviewing()) return;
          cursor++;
          historyElapsed = 0;
          historyAnchor = performance.now();
          showHistory();
          if (!reviewing()) anchor = performance.now();
          schedule();
          report();
        });
      }, delay / rate);
      return;
    }
    if (!jobs.size) return;
    const due = Math.min(...Array.from(jobs.values(), (job) => job.due));
    alarm = nativeTimeout(tick, Math.max(0, (due - now()) / rate));
  }

  function fire(job) {
    if (!jobs.has(job.id)) return;
    if (job.kind === 'interval') job.due = time + Math.max(4, job.delay);
    else jobs.delete(job.id);
    try {
      job.fn.apply(window, job.args);
    } catch (error) {
      report(error.message || String(error));
      console.error(error);
    }
  }

  function tick() {
    alarm = null;
    enqueue(async () => {
      if (paused || reviewing()) return;
      remember();
      updateClock();
      const ready = Array.from(jobs.values()).filter((job) => job.due <= time + 0.5);
      ready.sort((a, b) => a.due - b.due || a.id - b.id).forEach(fire);
      await settle();
      remember();
      schedule();
      report();
    });
  }

  function track(kind, fn, delay, args) {
    const ms = Math.max(kind === 'interval' ? 4 : 0, Number(delay) || 0);
    const id = nextId++;
    jobs.set(id, { id, kind, fn, delay: ms, due: now() + ms, args });
    schedule();
    return id;
  }

  function drop(id) {
    jobs.delete(id);
    schedule();
  }

  window.setTimeout = function (fn, delay, ...args) { return track('timeout', fn, delay, args); };
  window.setInterval = function (fn, delay, ...args) { return track('interval', fn, delay, args); };
  window.clearTimeout = drop;
  window.clearInterval = drop;

  function syncAnimations() {
    document.getAnimations().forEach((animation) => {
      animation.playbackRate = rate;
      const timing = animation.effect?.getComputedTiming();
      const entering = timing && timing.iterations === 1 && Number.isFinite(timing.endTime) && timing.endTime <= 1000;
      if (presentationAnimations.has(animation) || entering) return;
      if (paused && animation.playState === 'running') {
        pausedAnimations.add(animation);
        animation.pause();
      } else if (!paused && pausedAnimations.has(animation)) {
        pausedAnimations.delete(animation);
        animation.play();
      }
    });
  }

  function pause() {
    if (!paused) {
      updateClock();
      paused = true;
      schedule();
    }
    syncAnimations();
    report();
  }

  function resume() {
    if (paused) {
      anchor = performance.now();
      historyAnchor = anchor;
      paused = false;
      schedule();
    }
    syncAnimations();
    report();
  }

  function setRate(value) {
    const next = Number(value);
    if (!Number.isFinite(next) || next <= 0 || next > 100) return;
    updateClock();
    rate = next;
    schedule();
    syncAnimations();
    report();
  }

  async function step() {
    remember();
    pause();
    if (reviewing()) {
      cursor++;
      historyElapsed = 0;
      showHistory();
      report();
      return;
    }
    const before = contentText();
    // 跳过调度和高亮清理任务, 停在下一次数据或讲解内容变化.
    for (let attempt = 0; attempt < 12 && jobs.size; attempt += 1) {
      const first = Array.from(jobs.values()).sort((a, b) => a.due - b.due || a.id - b.id)[0];
      time = Math.max(time, first.due);
      Array.from(jobs.values()).filter((job) => job.due <= time).sort((a, b) => a.due - b.due || a.id - b.id).forEach(fire);
      await settle();
      if (contentText() !== before) break;
    }
    remember();
    syncAnimations();
    report();
  }

  function back() {
    remember();
    pause();
    if (cursor > 0) { cursor--; historyElapsed = 0; showHistory(); }
    report();
  }

  window.addEventListener('message', (event) => {
    if (event.source !== parent) return;
    const data = event.data || {};
    if (data.type !== 'lc-player') return;
    if (data.action === 'pause') pause();
    else if (data.action === 'resume') resume();
    else if (data.action === 'step' || data.action === 'back') {
      pause();
      enqueue(data.action === 'step' ? step : back);
    }
    else if (data.action === 'rate') setRate(data.rate);
  });
  window.addEventListener('error', (event) => report(event.message));
  window.addEventListener('unhandledrejection', (event) => report(event.reason?.message || String(event.reason)));
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') parent.postMessage({ lcExplainKey: 'Escape' }, '*');
    else if ([' ', 'ArrowLeft', 'ArrowRight'].includes(event.key) && !event.target?.closest?.('button,select,input,textarea,a,[contenteditable=true]')) {
      event.preventDefault();
      parent.postMessage({ lcExplainKey: event.key }, '*');
    }
  });

  function observeContent() {
    const root = document.querySelector('main') || document.querySelector('.wrap,.app') || document.body;
    root.classList.add('lc-explain-content');
    let queued = false;
    let lastWidth = 0;
    let lastHeight = 0;
    function measure() {
      queued = false;
      const measuredRoot = reviewing() ? historyView : root;
      const children = measuredRoot === document.body ? Array.from(measuredRoot.children) : [measuredRoot, ...measuredRoot.querySelectorAll('*')];
      let right = 0;
      let bottom = 0;
      children.forEach((node) => {
        if (/^(SCRIPT|STYLE)$/.test(node.tagName)) return;
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        const rect = node.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        right = Math.max(right, rect.right + scrollX);
        bottom = Math.max(bottom, rect.bottom + scrollY);
      });
      const width = Math.max(560, Math.ceil(right));
      const height = Math.max(120, Math.ceil(bottom + 16));
      if (width !== lastWidth || height !== lastHeight) {
        lastWidth = width;
        lastHeight = height;
        parent.postMessage({ lcExplain: true, width, height }, '*');
      }
      remember();
      syncAnimations();
    }
    function requestMeasure() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(measure);
    }
    requestLayout = requestMeasure;
    remember();
    new ResizeObserver(requestMeasure).observe(root);
    new MutationObserver(records => {
      if (!reviewing() && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        records.forEach(record => record.addedNodes.forEach(node => {
          if (node.nodeType !== 1 || !node.animate) return;
          const cells = [...(node.matches('.cell,.num,.node,.char,.num-cell') ? [node] : []), ...node.querySelectorAll('.cell,.num,.node,.char,.num-cell')];
          cells.forEach(cell => {
            const opacity = Number(getComputedStyle(cell).opacity);
            if (!opacity) return;
            const animation = cell.animate([{ opacity: opacity * 0.9 }, { opacity }], { duration: 240, easing: 'cubic-bezier(.22,1,.36,1)' });
            presentationAnimations.add(animation);
          });
        }));
      }
      requestMeasure();
    }).observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
    window.addEventListener('resize', requestMeasure);
    requestMeasure();
    report();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeContent);
  else observeContent();
})();
