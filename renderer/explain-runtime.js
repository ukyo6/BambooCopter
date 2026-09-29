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
  let stepping = false;

  function now() {
    return time + (paused ? 0 : (performance.now() - anchor) * rate);
  }

  function updateClock() {
    time = now();
    anchor = performance.now();
  }

  function report(error) {
    parent.postMessage({ lcExplainPlayer: true, paused, rate, error: error || '' }, '*');
  }

  function schedule() {
    if (alarm !== null) nativeClear(alarm);
    alarm = null;
    if (paused || !jobs.size) return;
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
    if (paused) return;
    updateClock();
    const ready = Array.from(jobs.values()).filter((job) => job.due <= time + 0.5);
    ready.sort((a, b) => a.due - b.due || a.id - b.id).forEach(fire);
    schedule();
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
    if (stepping) return;
    stepping = true;
    pause();
    const before = document.body.innerText;
    // 跳过调度和高亮清理任务, 停在下一次数据或讲解内容变化.
    for (let attempt = 0; attempt < 12 && jobs.size; attempt += 1) {
      const first = Array.from(jobs.values()).sort((a, b) => a.due - b.due || a.id - b.id)[0];
      time = Math.max(time, first.due);
      Array.from(jobs.values()).filter((job) => job.due <= time).forEach(fire);
      await Promise.resolve();
      if (document.body.innerText !== before) break;
    }
    document.getAnimations().forEach((animation) => {
      const timing = animation.effect?.getComputedTiming();
      if (timing && Number.isFinite(timing.endTime)) animation.finish();
    });
    syncAnimations();
    stepping = false;
    report();
  }

  window.addEventListener('message', (event) => {
    if (event.source !== parent) return;
    const data = event.data || {};
    if (data.type !== 'lc-player') return;
    if (data.action === 'pause') pause();
    else if (data.action === 'resume') resume();
    else if (data.action === 'step') step();
    else if (data.action === 'rate') setRate(data.rate);
  });
  window.addEventListener('error', (event) => report(event.message));
  window.addEventListener('unhandledrejection', (event) => report(event.reason?.message || String(event.reason)));
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') parent.postMessage({ lcExplainKey: 'Escape' }, '*');
  });

  function observeContent() {
    const root = document.querySelector('main') || document.querySelector('.wrap,.app') || document.body;
    root.classList.add('lc-explain-content');
    let queued = false;
    let lastWidth = 0;
    let lastHeight = 0;
    function measure() {
      queued = false;
      const children = root === document.body ? Array.from(root.children) : [root, ...root.querySelectorAll('*')];
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
      syncAnimations();
    }
    function requestMeasure() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(measure);
    }
    new ResizeObserver(requestMeasure).observe(root);
    new MutationObserver(requestMeasure).observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
    window.addEventListener('resize', requestMeasure);
    requestMeasure();
    report();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeContent);
  else observeContent();
})();
