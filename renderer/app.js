const difficultyLabel = { EASY: 'easy', MEDIUM: 'mid', HARD: 'hard' };
const effortLabel = { low: '低', medium: '中', high: '高', xhigh: '极高', max: '最大', ultra: '超高' };
const difficultyClass = { EASY: 'diff-easy', MEDIUM: 'diff-medium', HARD: 'diff-hard' };
const verdictLabel = { pass: '可以通过', fail: '不能通过', uncertain: '不确定' };

let editor;
let historyEditor;
let historyDecorations = [];
let historyRequest = 0;
let problems = [];
let currentSlug = '';
let problemSelectionRevision = 0;
let currentJavaTemplate = '';
let recordFilter = '';
let problemQuery = '';
let recordBoard = { total: 0, pass: 0, fail: 0, untouched: 0, bySlug: {}, passed: {} };
let saveTimer = 0;
let stepTimer = 0;
let busy = false;
let agentRequest = 0;
let agentPending = false;
let currentAgentState = null;
let chatImages;
let chatPreparing = false;
let explainNatural = { width: 640, height: 420 };
let explainScale = 1;
let currentExplainHtml = '';
let explainMeasured = false;
let randomChallenge = null;
let challengeLoaded = false;
let challengeStarting = false;
let challengeTimer = 0;
let challengeSyncing = false;

if (/Macintosh/.test(navigator.userAgent)) document.body.classList.add('darwin');

function isMacPlatform() {
  return document.body.classList.contains('darwin') || /Macintosh/.test(navigator.userAgent);
}

let uiTipActive = null;
let refreshUiTip = () => {};
let hideUiTip = () => {};

function setControlTip(el, tip, keys) {
  if (!el) return;
  el.dataset.tip = tip;
  if (keys === undefined) {
    /* keep existing keys */
  } else if (keys) {
    el.dataset.keys = keys;
  } else {
    delete el.dataset.keys;
  }
  el.removeAttribute('title');
  el.setAttribute('aria-label', tip);
  if (uiTipActive === el) refreshUiTip(el);
}

function bindUiTips() {
  let tipEl = null;

  const ensureTip = () => {
    if (tipEl) return tipEl;
    tipEl = document.createElement('div');
    tipEl.id = 'uiTip';
    tipEl.className = 'ui-tip';
    tipEl.hidden = true;
    tipEl.setAttribute('role', 'tooltip');
    tipEl.innerHTML = '<span class="ui-tip-label"></span><kbd class="ui-tip-keys" hidden></kbd>';
    document.body.appendChild(tipEl);
    return tipEl;
  };

  const findTarget = (node) => {
    const el = node?.closest?.('[data-tip]');
    if (!el || !el.dataset.tip) return null;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return null;
    return el;
  };

  const positionTip = (el) => {
    const tip = ensureTip();
    const rect = el.getBoundingClientRect();
    const gap = 8;
    tip.style.left = '0px';
    tip.style.top = '0px';
    const tipRect = tip.getBoundingClientRect();
    let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
    left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
    let top = rect.bottom + gap;
    let placement = 'below';
    if (top + tipRect.height > window.innerHeight - 8) {
      top = rect.top - tipRect.height - gap;
      placement = 'above';
    }
    if (top < 8) top = 8;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
    tip.dataset.placement = placement;
  };

  const fillTip = (el) => {
    const tip = ensureTip();
    const label = tip.querySelector('.ui-tip-label');
    const keys = tip.querySelector('.ui-tip-keys');
    label.textContent = el.dataset.tip || '';
    if (el.dataset.keys) {
      keys.textContent = el.dataset.keys;
      keys.hidden = false;
    } else {
      keys.textContent = '';
      keys.hidden = true;
    }
  };

  hideUiTip = () => {
    if (!tipEl) return;
    if (uiTipActive) uiTipActive.removeAttribute('aria-describedby');
    tipEl.classList.remove('is-visible');
    tipEl.hidden = true;
    uiTipActive = null;
  };

  const showTip = (el) => {
    const tip = ensureTip();
    fillTip(el);
    tip.hidden = false;
    tip.classList.add('is-visible');
    if (uiTipActive && uiTipActive !== el) uiTipActive.removeAttribute('aria-describedby');
    uiTipActive = el;
    el.setAttribute('aria-describedby', 'uiTip');
    positionTip(el);
  };

  refreshUiTip = (el) => {
    if (!el || uiTipActive !== el || !tipEl || tipEl.hidden) return;
    fillTip(el);
    positionTip(el);
  };

  let suppressUntilLeave = null;

  const stillInside = (host, node) => !!(host && node && host.contains(node));

  document.addEventListener('pointerover', (event) => {
    const el = findTarget(event.target);
    if (!el || el === uiTipActive || el === suppressUntilLeave) return;
    showTip(el);
  });

  document.addEventListener('pointerout', (event) => {
    const related = event.relatedTarget;
    if (suppressUntilLeave && !stillInside(suppressUntilLeave, related)) suppressUntilLeave = null;
    if (!uiTipActive) return;
    const el = findTarget(event.target);
    if (el !== uiTipActive) return;
    if (stillInside(uiTipActive, related)) return;
    hideUiTip();
  });

  document.addEventListener('pointerdown', (event) => {
    const el = findTarget(event.target);
    if (el) suppressUntilLeave = el;
    hideUiTip();
  }, true);
  document.addEventListener('focusin', (event) => {
    const el = findTarget(event.target);
    if (el && el.matches(':focus-visible')) showTip(el);
  });
  document.addEventListener('focusout', hideUiTip);
  window.addEventListener('blur', hideUiTip);
  window.addEventListener('resize', hideUiTip);
  document.addEventListener('scroll', hideUiTip, true);
}

bindColumnResizers();
bindExplainPip();
bindProblemListEdge();
bindUiTips();

function bindProblemListEdge() {
  const list = document.getElementById('problemList');
  const sync = () => list.classList.toggle('is-scrolled', list.scrollTop > 0);
  list.addEventListener('scroll', sync, { passive: true });
  sync();
}

function placeResizeGuide(handle, show) {
  let guide = document.getElementById('resizeGuide');
  if (!guide) {
    guide = document.createElement('div');
    guide.id = 'resizeGuide';
    guide.hidden = true;
    document.body.appendChild(guide);
  }
  if (!show) {
    guide.hidden = true;
    guide.style.left = '';
    return;
  }
  const rect = handle.getBoundingClientRect();
  guide.hidden = false;
  guide.style.left = `${rect.left + rect.width / 2}px`;
}

function bindColumnResizers() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem('lc-column-widths') || '{}');
  } catch {
    saved = {};
  }
  for (const handle of document.querySelectorAll('.col-resizer')) {
    const pane = document.querySelector(handle.dataset.pane);
    const width = Number(saved[handle.dataset.pane]);
    if (width) pane.style.width = `${width}px`;
    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      const min = Number(handle.dataset.min);
      const max = Number(handle.dataset.max);
      const startX = event.clientX;
      const startWidth = pane.getBoundingClientRect().width;
      const listResize = handle.dataset.pane === '.list-pane';
      const fromEnd = handle.dataset.edge === 'end';
      let ended = false;
      handle.classList.add('active');
      document.body.classList.add('is-resizing');
      handle.setPointerCapture(event.pointerId);
      const move = (ev) => {
        const delta = ev.clientX - startX;
        const next = Math.round(Math.min(max, Math.max(min, startWidth + (fromEnd ? -delta : delta))));
        pane.style.width = `${next}px`;
        if (listResize) placeResizeGuide(handle, next !== Math.round(startWidth));
        if (fromEnd && editor) editor.layout();
      };
      const end = () => {
        if (ended) return;
        ended = true;
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', end);
        handle.removeEventListener('pointercancel', end);
        handle.classList.remove('active');
        document.body.classList.remove('is-resizing');
        placeResizeGuide(handle, false);
        const current = JSON.parse(localStorage.getItem('lc-column-widths') || '{}');
        current[handle.dataset.pane] = Math.round(pane.getBoundingClientRect().width);
        localStorage.setItem('lc-column-widths', JSON.stringify(current));
        if (editor) editor.layout();
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    });
  }
}

function loadPipState() {
  try {
    return JSON.parse(localStorage.getItem('lc-explain-pip') || 'null');
  } catch {
    return null;
  }
}

function savePipState() {
  const pip = document.getElementById('explainPip');
  localStorage.setItem('lc-explain-pip', JSON.stringify({
    v: 4,
    left: parseFloat(pip.style.left) || 0,
    top: parseFloat(pip.style.top) || 0,
    scale: explainScale,
  }));
}

function bindExplainPip() {
  const saved = loadPipState();
  const hasSaved = saved && saved.v === 4;
  if (hasSaved && saved.scale) explainScale = saved.scale;
  const pip = document.getElementById('explainPip');
  const drag = document.getElementById('explainPipDrag');
  drag.addEventListener('pointerdown', (event) => {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = pip.getBoundingClientRect();
    drag.setPointerCapture(event.pointerId);
    const move = (ev) => {
      const maxLeft = Math.max(16, window.innerWidth - rect.width - 16);
      const maxTop = Math.max(16, window.innerHeight - rect.height - 16);
      const left = clampPip(rect.left + ev.clientX - startX, 16, maxLeft);
      const top = clampPip(rect.top + ev.clientY - startY, 16, maxTop);
      pip.style.left = `${Math.round(left)}px`;
      pip.style.top = `${Math.round(top)}px`;
    };
    const end = () => {
      drag.removeEventListener('pointermove', move);
      drag.removeEventListener('pointerup', end);
      drag.removeEventListener('pointercancel', end);
      savePipState();
    };
    drag.addEventListener('pointermove', move);
    drag.addEventListener('pointerup', end);
    drag.addEventListener('pointercancel', end);
  });
  const handle = document.getElementById('explainPipResize');
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const startScale = explainScale;
    handle.setPointerCapture(event.pointerId);
    const move = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const byX = (explainNatural.width * startScale + dx) / explainNatural.width;
      const byY = (explainNatural.height * startScale + dy) / explainNatural.height;
      const useX = Math.abs(dx / explainNatural.width) >= Math.abs(dy / explainNatural.height);
      explainScale = clampPip(useX ? byX : byY, minExplainScale(), maxExplainScale());
      applyPipScale();
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      savePipState();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  });
  handle.addEventListener('dblclick', fitExplainWindow);
  handle.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Home') fitExplainWindow();
    else changeExplainScale(explainScale + (['ArrowRight', 'ArrowUp'].includes(event.key) ? 0.1 : -0.1));
  });
  document.getElementById('explainZoomOut').onclick = () => changeExplainScale(explainScale - 0.1);
  document.getElementById('explainZoomIn').onclick = () => changeExplainScale(explainScale + 0.1);
  document.getElementById('explainZoomValue').onclick = () => changeExplainScale(1);
  document.getElementById('explainFit').onclick = fitExplainWindow;
  document.getElementById('explainThoughts').onclick = () => setExplainThoughts(document.getElementById('explainDetails').hidden);
  document.getElementById('explainDetailsClose').onclick = () => setExplainThoughts(false, { focus: true });
  pip.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); setExplainOpen(false); return; }
    if (event.target?.closest?.('button,select,input,textarea,a,[role=slider],[contenteditable=true],#explainDetails,#explainComplexity')) return;
    if (handleExplainShortcut(event.key)) event.preventDefault();
  });
  window.addEventListener('message', (event) => {
    const data = event.data;
    const frame = document.querySelector('#explainBody iframe');
    if (!data || !frame || event.source !== frame.contentWindow) return;
    if (data.lcExplainKey === 'Escape') return setExplainOpen(false);
    if (data.lcExplainKey) return handleExplainShortcut(data.lcExplainKey);
    if (data.lcExplainPlayer === true) {
      document.getElementById('explainBack').disabled = data.canBack !== true;
      if (data.error) {
        const error = document.getElementById('explainError');
        error.textContent = '本段演示暂时中断, 请重播后再试.';
        error.hidden = false;
        applyPipScale();
      }
      return;
    }
    if (data.lcExplain !== true) return;
    if (!(data.width > 40) || !(data.height > 40)) return;
    rememberVisualSize(data.width, data.height, 560);
  });
  applyPipScale();
  window.addEventListener('resize', () => {
    applyPipScale();
    clampPipPosition();
  });
  if (hasSaved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
    pip.style.left = `${saved.left}px`;
    pip.style.top = `${saved.top}px`;
    clampPipPosition();
  } else {
    placePipDefault();
  }
}

function clampPip(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function rememberVisualSize(width, height, minWidth = 0) {
  const image = document.querySelector('#explainBody .explain-media');
  explainNatural = {
    width: image ? Math.round(width) : Math.max(minWidth, Math.max(180, Math.min(960, Math.round(width)))),
    height: image ? Math.round(height) : Math.max(100, Math.round(height), explainMeasured ? explainNatural.height : 0),
  };
  explainMeasured = true;
  const saved = loadPipState();
  const hasSaved = saved && saved.v === 4 && Number.isFinite(saved.left) && Number.isFinite(saved.top);
  explainScale = clampPip(explainScale, minExplainScale(), maxExplainScale());
  applyPipScale();
  if (!hasSaved) placePipDefault();
  else clampPipPosition();
}

function minExplainScale() {
  if (document.querySelector('#explainBody .explain-media')) {
    const availableHeight = Math.max(100, window.innerHeight - explainChromeHeight() - 32);
    return Math.min(0.5, 320 / explainNatural.width, (window.innerWidth - 50) / explainNatural.width, availableHeight / explainNatural.height);
  }
  return 0.5;
}

function maxExplainScale() {
  if (document.querySelector('#explainBody .explain-media')) return 1.8;
  return Math.min(1.8, Math.max(minExplainScale(), (window.innerWidth - 48) / explainNatural.width));
}

function changeExplainScale(scale) {
  explainScale = clampPip(scale, minExplainScale(), maxExplainScale());
  applyPipScale();
  savePipState();
}

function explainChromeHeight() {
  const pip = document.getElementById('explainPip');
  return Array.from(pip.children).filter(node => node.id !== 'explainView' && !node.classList.contains('explain-pip-handle')).reduce((height, node) => height + node.offsetHeight, 2);
}

function fitExplainWindow() {
  // 先按候选宽度排版说明, 再量外框, 避免窄窗口的换行使比例估算偏小.
  const fitMaxScale = document.querySelector('#explainBody .explain-media')
    ? Math.min(maxExplainScale(), (window.innerWidth - 50) / explainNatural.width)
    : maxExplainScale();
  explainScale = Math.min(1, fitMaxScale);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    applyPipScale();
    const availableHeight = window.innerHeight - explainChromeHeight() - 32;
    explainScale = clampPip(Math.min(1, fitMaxScale, availableHeight / explainNatural.height), minExplainScale(), maxExplainScale());
  }
  changeExplainScale(explainScale);
}

function defaultExplainScale() {
  if (document.querySelector('#explainBody .explain-media')) {
    const availableHeight = Math.max(100, window.innerHeight - explainChromeHeight() - 32);
    return Math.min(1, Math.min(900, window.innerWidth - 50) / explainNatural.width, availableHeight / explainNatural.height);
  }
  const targetWidth = Math.min(explainNatural.width, window.innerWidth - 48);
  return Math.min(1, targetWidth / explainNatural.width);
}

function applyPipScale() {
  const pip = document.getElementById('explainPip');
  const view = document.getElementById('explainView');
  const body = document.getElementById('explainBody');
  const image = body.querySelector('.explain-media');
  explainScale = clampPip(explainScale, minExplainScale(), maxExplainScale());
  const width = Math.round(explainNatural.width * explainScale);
  const height = Math.round(explainNatural.height * explainScale);
  const shellWidth = Math.max(340, image ? Math.min(width + 2, window.innerWidth - 48) : width);
  pip.style.width = `${shellWidth}px`;
  pip.classList.toggle('is-compact', shellWidth < 520);
  const maxHeight = Math.max(100, window.innerHeight - explainChromeHeight() - 32);
  view.style.width = '100%';
  view.style.height = `${Math.min(height, maxHeight)}px`;
  view.style.padding = '0';
  view.style.overflowX = image ? 'auto' : 'hidden';
  view.style.overflowY = 'auto';
  body.style.width = `${image ? width : explainNatural.width}px`;
  body.style.height = `${image ? height : explainNatural.height}px`;
  body.style.margin = '0';
  body.style.marginLeft = `${Math.max(0, (shellWidth - (image ? 2 : 0) - width) / 2)}px`;
  body.style.zoom = '1';
  body.style.transform = image || explainScale === 1 ? 'none' : `scale(${explainScale})`;
  body.style.transformOrigin = 'top left';
  // Reserve layout space for scaled visuals so the scroller clips cleanly.
  body.style.marginBottom = image || explainScale === 1 ? '0' : `${Math.round(explainNatural.height * (explainScale - 1))}px`;
  body.style.marginRight = image || explainScale === 1 ? '0' : `${Math.round(explainNatural.width * (explainScale - 1))}px`;
  if (image) {
    image.style.width = `${width}px`;
    image.style.height = `${height}px`;
  }
  const frame = body.querySelector('iframe');
  if (frame) {
    frame.style.width = '100%';
    frame.style.height = '100%';
  }
  const percent = Math.round(explainScale * 100);
  document.getElementById('explainZoomValue').textContent = `${percent}%`;
  document.getElementById('explainZoomOut').disabled = explainScale <= minExplainScale() + 0.001;
  document.getElementById('explainZoomIn').disabled = explainScale >= maxExplainScale() - 0.001;
  const handle = document.getElementById('explainPipResize');
  handle.setAttribute('aria-valuenow', String(percent));
  handle.setAttribute('aria-valuemax', String(Math.round(maxExplainScale() * 100)));
  handle.setAttribute('aria-valuetext', `${percent}%`);
  if (pip.style.left) clampPipPosition();
}

function clampPipPosition() {
  const pip = document.getElementById('explainPip');
  const margin = 16;
  const width = pip.offsetWidth || Math.round(explainNatural.width * explainScale);
  const height = pip.offsetHeight || Math.round(explainNatural.height * explainScale) + 64;
  const left = clampPip(parseFloat(pip.style.left) || margin, margin, window.innerWidth - width - margin);
  const top = clampPip(parseFloat(pip.style.top) || margin, margin, window.innerHeight - height - margin);
  pip.style.left = `${Math.round(left)}px`;
  pip.style.top = `${Math.round(top)}px`;
}

function placePipDefault() {
  const pip = document.getElementById('explainPip');
  const width = pip.offsetWidth || Math.round(explainNatural.width * explainScale);
  const height = pip.offsetHeight || Math.round(explainNatural.height * explainScale) + 64;
  const left = Math.round((window.innerWidth - width) / 2);
  const top = Math.round((window.innerHeight - height) / 2);
  pip.style.left = `${Math.max(12, left)}px`;
  pip.style.top = `${Math.max(12, top)}px`;
}

function monacoBase() {
  return new URL('vendor/vs/', window.location.href).href;
}

window.MonacoEnvironment = {
  getWorkerUrl() {
    const source = `self.MonacoEnvironment={baseUrl:'${monacoBase()}'};importScripts('${new URL('vendor/vs/base/worker/workerMain.js', window.location.href).href}');`;
    return URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
  },
};

require.config({ paths: { vs: 'vendor/vs' } });
require(['vs/editor/editor.main'], () => {
  registerJava();
  editor = monaco.editor.create(document.getElementById('editor'), {
    value: '',
    language: 'java',
    theme: 'lc-codex',
    fontSize: 13,
    fontFamily: '"SF Mono", Monaco, Menlo, Courier, monospace',
    minimap: { enabled: false },
    automaticLayout: true,
    tabSize: 4,
    insertSpaces: true,
    autoIndent: 'advanced',
    quickSuggestions: { other: true, comments: false, strings: false },
    suggestOnTriggerCharacters: true,
    wordBasedSuggestions: 'off',
    acceptSuggestionOnEnter: 'smart',
    tabCompletion: 'on',
    parameterHints: { enabled: true, cycle: true },
    scrollBeyondLastLine: false,
    padding: { top: 16, bottom: 16 },
    renderLineHighlight: 'none',
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
  });
  editor.onDidChangeModelContent(() => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 400);
  });
  boot();
});

function registerJava() {
  monaco.editor.defineTheme('lc-codex', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#1e1f22',
      'editor.foreground': '#ececec',
      'editorLineNumber.foreground': '#5c5c5c',
      'editorLineNumber.activeForeground': '#cfcfcf',
      'editor.selectionBackground': '#3a3a3a',
      'editor.inactiveSelectionBackground': '#2a2a2a',
      'editorCursor.foreground': '#f3f3f3',
      'scrollbarSlider.background': '#3a3a3a',
      'scrollbarSlider.hoverBackground': '#4d4d4d',
      'scrollbarSlider.activeBackground': '#4d4d4d',
      'editorWidget.background': '#25282c',
      'editorWidget.border': '#3a3a3a',
    },
  });
  monaco.languages.register({ id: 'java' });
  monaco.languages.setMonarchTokensProvider('java', {
    keywords: ['abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'package', 'private', 'protected', 'public', 'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'try', 'void', 'volatile', 'while', 'var', 'record', 'yield'],
    typeKeywords: ['boolean', 'byte', 'char', 'double', 'float', 'int', 'long', 'short', 'void'],
    operators: ['=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=', '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%', '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=', '%=', '<<=', '>>=', '>>>='],
    tokenizer: {
      root: [
        [/[a-zA-Z_$][\w$]*/, {
          cases: { '@keywords': 'keyword', '@default': 'identifier' },
        }],
        [/[{}()\[\]]/, '@brackets'],
        [/@\s*[a-zA-Z_]\w*/, 'annotation'],
        [/\d[\d_]*/, 'number'],
        [/\/\*/, 'comment', '@comment'],
        [/\/\/.*$/, 'comment'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
      ],
      comment: [[/[^\/*]+/, 'comment'], [/\*\//, 'comment', '@pop'], [/[\/*]/, 'comment']],
      string: [[/[^\\"]+/, 'string'], [/\\./, 'string.escape'], [/"/, 'string', '@pop']],
    },
  });
  if (typeof JavaComplete !== 'undefined' && JavaComplete.register) {
    JavaComplete.register(monaco);
  }
}

async function boot() {
  const started = Date.now();
  bindControls();
  try {
    await loadAgent();
    await loadProblems();
  } finally {
    const wait = 1500 - (Date.now() - started);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    hideBootSkeleton();
  }
}

function hideBootSkeleton() {
  const node = document.getElementById('bootSkeleton');
  if (!node || node.classList.contains('is-done')) return;
  node.classList.add('is-done');
  node.setAttribute('aria-busy', 'false');
  const remove = () => node.remove();
  node.addEventListener('transitionend', remove, { once: true });
  setTimeout(remove, 400);
}

function bindControls() {
  document.getElementById('toggleSidebar').onclick = () => setSidebarOpen(document.body.classList.contains('sidebar-closed'));
  document.getElementById('startChallenge').onclick = startRandomChallenge;
  document.getElementById('closeChallenge').onclick = dismissChallenge;
  const mac = isMacPlatform();
  setControlTip(document.getElementById('toggleSidebar'), '显示/隐藏侧边栏', mac ? '⌘B' : 'Ctrl+B');
  setControlTip(document.getElementById('formatCode'), '格式化', mac ? '⌘⇧F' : 'Ctrl+Shift+F');
  setControlTip(document.getElementById('reviewCode'), '提交', mac ? '⌘Enter' : 'Ctrl+Enter');
  setControlTip(document.getElementById('toggleChat'), '显示/隐藏对话', mac ? '⌘⌥B' : 'Ctrl+Alt+B');
  setControlTip(document.getElementById('toggleExplain'), document.getElementById('toggleExplain').dataset.tip || '题解', mac ? '⌘E' : 'Ctrl+E');
  let leftShiftPressed = false;
  window.addEventListener('keyup', (event) => {
    if (event.code === 'ShiftLeft' || !event.shiftKey) leftShiftPressed = false;
  }, true);
  window.addEventListener('blur', () => { leftShiftPressed = false; });
  window.addEventListener('keydown', (event) => {
    if (event.code === 'ShiftLeft') leftShiftPressed = true;
    else if (!event.shiftKey) leftShiftPressed = false;
    if (event.isComposing) return;
    const command = event.metaKey || event.ctrlKey;
    if (!command) return;
    const key = event.key.toLowerCase();
    const problemCommand = mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
    if ((key === 'b' || event.code === 'KeyB') && problemCommand && event.shiftKey && leftShiftPressed && !event.altKey) {
      if (document.getElementById('historyDialog').open || document.body.classList.contains('is-resizing')) return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) setProblemOpen(document.body.classList.contains('problem-closed'));
      return;
    }
    if ((key === 'b' || event.code === 'KeyB') && event.altKey && !event.shiftKey) {
      if (document.getElementById('historyDialog').open) return;
      event.preventDefault();
      setChatOpen(document.body.classList.contains('chat-closed'), { focus: true });
      return;
    }
    if (key === 'f' && event.shiftKey && !event.altKey) {
      if (document.getElementById('historyDialog').open) return;
      event.preventDefault();
      formatCode();
      return;
    }
    if (event.altKey || event.shiftKey) return;
    if (key === 'b') {
      event.preventDefault();
      setSidebarOpen(document.body.classList.contains('sidebar-closed'));
      return;
    }
    if (key === 'e') {
      if (document.getElementById('historyDialog').open) return;
      event.preventDefault();
      setExplainOpen(document.getElementById('explainPip').classList.contains('is-closed'));
      return;
    }
    if (key === 'enter' && !document.getElementById('historyDialog').open) {
      event.preventDefault();
      event.stopPropagation();
      submitReview();
    }
  }, true);
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.isComposing) return;
    if (document.getElementById('historyDialog').open) return;
    if (isTypingTarget(event.target)) return;
    if (editor && editor.hasTextFocus && editor.hasTextFocus()) return;
    const delta = event.key === 'ArrowUp' ? -1 : 1;
    if (!stepProblem(delta)) return;
    event.preventDefault();
  });
  setSidebarOpen(localStorage.getItem('lc-sidebar') !== '0');
  setProblemOpen(localStorage.getItem('lc-problem-open') !== '0');
  setChatOpen(localStorage.getItem('lc-chat-open') !== '0');
  setExplainOpen(localStorage.getItem('lc-explain-open') === '1');
  const toggleChat = document.getElementById('toggleChat');
  toggleChat.addEventListener('pointerdown', (event) => {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setChatOpen(document.body.classList.contains('chat-closed'), { focus: true });
  });
  requestAnimationFrame(() => document.body.classList.add('motion-ready'));
  const problemSearch = document.getElementById('problemSearch');
  problemSearch.addEventListener('input', () => {
    problemQuery = problemSearch.value;
    renderProblemList();
  });
  problemSearch.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.isComposing) return;
    if (!problemSearch.value) return;
    event.preventDefault();
    problemSearch.value = '';
    problemQuery = '';
    renderProblemList();
  });
  document.getElementById('filterPass').onclick = () => setRecordFilter('pass');
  document.getElementById('filterFail').onclick = () => setRecordFilter('fail');
  document.getElementById('filterTodo').onclick = () => setRecordFilter('todo');
  document.getElementById('clearCode').onclick = clearCode;
  document.getElementById('formatCode').onclick = formatCode;
  document.getElementById('openHistory').onclick = openHistory;
  document.getElementById('closeHistory').onclick = () => closeHistoryDialog();
  const historyDialog = document.getElementById('historyDialog');
  historyDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeHistoryDialog();
  });
  document.getElementById('reviewCode').onclick = submitReview;
  document.getElementById('toggleExplain').onclick = () => {
    setExplainOpen(document.getElementById('explainPip').classList.contains('is-closed'));
  };
  document.getElementById('closeExplain').onclick = () => setExplainOpen(false);
  document.getElementById('explainPause').onclick = () => {
    const button = document.getElementById('explainPause');
    const paused = button.dataset.paused === '1';
    setExplainPaused(!paused);
    postExplainPlayer({ type: 'lc-player', action: paused ? 'resume' : 'pause' });
  };
  document.getElementById('explainReplay').onclick = () => {
    const frame = document.querySelector('#explainBody iframe');
    setExplainPaused(false);
    document.getElementById('explainBack').disabled = true;
    document.getElementById('explainError').hidden = true;
    if (frame && currentExplainHtml) frame.srcdoc = currentExplainHtml;
  };
  document.getElementById('explainBack').onclick = () => {
    setExplainPaused(true);
    postExplainPlayer({ type: 'lc-player', action: 'back' });
  };
  document.getElementById('explainStep').onclick = () => {
    setExplainPaused(true);
    postExplainPlayer({ type: 'lc-player', action: 'step' });
  };
  bindExplainRateButton();
  document.getElementById('providerSelect').onchange = (event) => {
    changeAgent({ provider: event.target.value });
  };
  document.getElementById('modelSelect').onchange = async (event) => {
    await changeAgent({ model: event.target.value });
  };
  document.getElementById('effortSelect').onchange = async (event) => {
    await changeAgent({ reasoning: event.target.value });
  };
  document.getElementById('fastToggle').onclick = async () => {
    const button = document.getElementById('fastToggle');
    await changeAgent({ fast: button.getAttribute('aria-pressed') !== 'true' });
  };
  chatImages = BambooChatImages.bindComposer({
    input: document.getElementById('chatInput'),
    picker: document.getElementById('chatImagePicker'),
    button: document.getElementById('addChatImage'),
    previews: document.getElementById('chatAttachments'),
    onError: setStatus,
    onChange: resizeComposer,
    isBusy: () => busy || agentPending || chatPreparing,
    canAttach: canAttachChatImages,
  });
  document.getElementById('composer').onsubmit = async (event) => {
    event.preventDefault();
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if ((!text && !chatImages.count()) || !currentSlug || busy || agentPending || chatPreparing) return;
    const slug = currentSlug;
    const selectionRevision = problemSelectionRevision;
    let attachments;
    chatPreparing = true;
    syncAgentControls();
    try { attachments = await chatImages.payload(); }
    catch (error) { setStatus(error.message || '读取图片失败.'); return; }
    finally { chatPreparing = false; syncAgentControls(); }
    if (currentSlug !== slug || problemSelectionRevision !== selectionRevision || busy || agentPending) return;
    const code = editor.getValue();
    const files = chatImages.files();
    const previews = chatImages.previews();
    input.value = '';
    resizeComposer();
    appendChatMessage('user', text, Date.now(), previews);
    chatImages.clear();
    const pending = appendPendingAssistant();
    scrollChatToEnd();
    await withStatus('正在回复', async () => {
      try {
        const result = await window.lc.sendChat({ slug, code, text, attachments });
        if (!result.ok) throw new Error(result.error || '发送失败');
        if (currentSlug === slug) await loadChat(slug);
      } catch (error) {
        let errorItem = pending;
        if (currentSlug === slug) {
          await loadChat(slug);
          if (currentSlug === slug) {
            errorItem = appendPendingAssistant();
            scrollChatToEnd();
          }
        }
        if (currentSlug === slug && !input.value && !chatImages.count()) {
          input.value = text;
          chatImages.restore(files);
          resizeComposer();
        }
        if (errorItem.isConnected) {
          const body = errorItem.querySelector('.message-body');
          body.classList.remove('is-pending');
          body.replaceChildren();
          body.textContent = error.message || String(error);
        }
        throw error;
      }
    });
  };
  document.getElementById('chatInput').addEventListener('input', resizeComposer);
  document.getElementById('chatInput').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    document.getElementById('composer').requestSubmit();
  });
}

function resizeComposer() {
  const input = document.getElementById('chatInput');
  input.style.height = 'auto';
  input.style.height = `${Math.min(160, Math.max(52, input.scrollHeight))}px`;
}

async function loadAgent() {
  const request = ++agentRequest;
  syncAgentControls();
  const result = await window.lc.agentState();
  if (request !== agentRequest) return;
  if (!result.ok) {
    setStatus(result.error);
    return;
  }
  renderAgent(result.data);
}

async function changeAgent(settings) {
  if (busy || agentPending || chatPreparing) return;
  const request = ++agentRequest;
  const provider = settings.provider || currentAgentState?.provider || 'codex';
  agentPending = true;
  syncAgentControls();
  try {
    const result = await window.lc.selectAgent({ ...settings, provider });
    if (request !== agentRequest) return;
    if (!result.ok) throw new Error(result.error || '切换 AI 设置失败');
    renderAgent(result.data);
    setStatus('');
  } catch (error) {
    if (request !== agentRequest) return;
    if (currentAgentState) renderAgent(currentAgentState);
    setStatus(error.message || String(error));
  } finally {
    agentPending = false;
    syncAgentControls();
  }
}

function syncAgentControls() {
  const pending = busy || agentPending || chatPreparing || challengeStarting;
  const disabled = pending || !currentAgentState;
  for (const id of ['providerSelect', 'modelSelect', 'effortSelect', 'fastToggle']) {
    document.getElementById(id).disabled = disabled;
  }
  document.getElementById('reviewCode').disabled = pending;
  document.querySelector('#composer .send').disabled = pending;
  document.getElementById('addChatImage').disabled = pending;
  document.getElementById('chatInput').readOnly = chatPreparing || challengeStarting;
  syncChallengeControls();
}

function canAttachChatImages() {
  const state = currentAgentState;
  return Boolean(state?.links.some(link => link.id === state.provider)
    && state.models.find(model => model.id === state.model)?.supportsImages);
}

function renderAgent(state) {
  currentAgentState = state;
  const provider = document.getElementById('providerSelect');
  for (const option of provider.options) {
    option.disabled = !state.links.some((link) => link.id === option.value);
  }
  provider.value = state.provider || 'codex';
  const selectedLink = state.links.find((link) => link.id === provider.value);
  const providerLabel = provider.selectedOptions[0]?.textContent || '所选 CLI';
  document.getElementById('chatTitle').setAttribute('aria-label', providerLabel);
  const model = document.getElementById('modelSelect');
  document.getElementById('agentPath').textContent = selectedLink ? '' : `没有找到 ${providerLabel}, 把它加入 PATH 后重启`;
  model.innerHTML = '';
  model.hidden = !selectedLink || state.models.length === 0;
  for (const item of state.models) model.add(new Option(item.label, item.id));
  if (state.model) model.value = state.model;
  const effort = document.getElementById('effortSelect');
  const activeModel = state.models.find((item) => item.id === state.model);
  document.getElementById('addChatImage').hidden = !canAttachChatImages();
  if (!canAttachChatImages()) chatImages?.clear();
  const efforts = activeModel?.efforts || [];
  effort.innerHTML = '';
  effort.hidden = provider.value !== 'codex' || efforts.length === 0;
  for (const id of efforts) effort.add(new Option(effortLabel[id] || id, id));
  if (state.reasoning) effort.value = state.reasoning;
  const fast = document.getElementById('fastToggle');
  fast.hidden = !selectedLink || !state.fastSupported;
  fast.setAttribute('aria-pressed', state.fast ? 'true' : 'false');
  fitSelect(model);
  fitSelect(effort);
  const notice = document.getElementById('agentNotice');
  if (state.modelError && selectedLink) {
    notice.hidden = false;
    document.getElementById('agentNoticeText').textContent = state.modelError;
    setStatus('');
  } else {
    notice.hidden = true;
    document.getElementById('agentNoticeText').textContent = '';
  }
  syncAgentControls();
}

function fitSelect(select) {
  if (!select || select.hidden) return;
  const probe = document.createElement('span');
  const style = getComputedStyle(select);
  probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;white-space:nowrap;pointer-events:none';
  probe.style.font = style.font;
  probe.textContent = select.selectedOptions[0]?.textContent || '';
  document.body.appendChild(probe);
  const textWidth = Math.ceil(probe.getBoundingClientRect().width);
  probe.remove();
  select.style.width = `${textWidth + 16}px`;
}

async function loadProblems(refresh) {
  setStatus(refresh ? '正在同步题单' : '正在加载题单');
  const result = refresh ? await window.lc.refreshProblems() : await window.lc.listProblems();
  if (!result.ok) {
    setStatus(result.error);
    return;
  }
  problems = result.data;
  await loadBoard();
  await loadChallenge();
  setStatus('');
  if (randomChallenge?.status === 'active' && currentSlug !== randomChallenge.slug) {
    await selectProblem(randomChallenge.slug);
  } else if (!currentSlug && problems[0]) {
    const last = localStorage.getItem('lc-last-slug');
    const initial = problems.find((problem) => problem.slug === last) || problems[0];
    await selectProblem(initial.slug);
  }
}

function syncChallengeControls() {
  const active = randomChallenge?.status === 'active';
  document.getElementById('startChallenge').disabled = !challengeLoaded || !problems.length || active || challengeStarting || busy || agentPending || chatPreparing;
  for (const button of document.querySelectorAll('#problemList .problem-item')) {
    button.disabled = !challengeLoaded || challengeStarting || (active && button.dataset.slug !== randomChallenge.slug);
  }
}

function renderChallenge() {
  const bar = document.getElementById('challengeBar');
  const active = randomChallenge?.status === 'active';
  const dismissed = randomChallenge && localStorage.getItem('lc-dismissed-challenge') === String(randomChallenge.id);
  bar.hidden = !randomChallenge || (!active && dismissed);
  if (randomChallenge) {
    document.getElementById('closeChallenge').hidden = active;
    const passed = randomChallenge.status === 'pass';
    const remaining = Math.max(0, Math.ceil((randomChallenge.deadline_at - Date.now()) / 1000));
    bar.classList.toggle('is-pass', passed);
    bar.classList.toggle('is-fail', randomChallenge.status === 'fail');
    bar.classList.toggle('is-urgent', active && remaining <= 60);
    const title = randomChallenge.translated_title || randomChallenge.title;
    document.getElementById('challengeTitle').textContent = `${active ? '随机挑战' : passed ? '挑战成功' : '挑战失败'} · ${title}`;
    const countdown = document.getElementById('challengeCountdown');
    countdown.hidden = !active;
    countdown.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    const description = active ? '题目已锁定. 必须在倒计时结束前收到通过结果, 评审等待计入时间.'
      : passed ? '已在 15 分钟内通过. 可以继续抽题或自由选择题目.'
        : '15 分钟内未收到通过结果. 本次挑战已记为失败, 可以重新抽题.';
    const message = document.getElementById('challengeDescription');
    if (message.textContent !== description) message.textContent = description;
  }
  syncChallengeControls();
}

function dismissChallenge() {
  if (!randomChallenge || randomChallenge.status === 'active') return;
  localStorage.setItem('lc-dismissed-challenge', String(randomChallenge.id));
  renderChallenge();
  if (editor) editor.layout();
}

function applyChallenge(state) {
  // 已结束的挑战不会被较早发出的状态请求重新变成进行中.
  if (randomChallenge && state && (state.id < randomChallenge.id
    || (state.id === randomChallenge.id && randomChallenge.status !== 'active' && state.status === 'active'))) return;
  randomChallenge = state;
  challengeLoaded = true;
  clearInterval(challengeTimer);
  renderChallenge();
  if (randomChallenge?.status === 'active') {
    challengeTimer = setInterval(() => {
      renderChallenge();
      loadChallenge().catch((error) => setStatus(error.message));
    }, 1000);
  }
}

async function loadChallenge() {
  if (challengeSyncing) return;
  challengeSyncing = true;
  try {
    const result = await window.lc.challengeState();
    if (!result.ok) throw new Error(result.error || '读取随机挑战失败');
    applyChallenge(result.data);
  } finally {
    challengeSyncing = false;
  }
}

async function startRandomChallenge() {
  if (!challengeLoaded || !problems.length || randomChallenge?.status === 'active' || challengeStarting || busy || agentPending || chatPreparing) return;
  challengeStarting = true;
  problemSelectionRevision += 1;
  setBusy(true);
  try {
    clearTimeout(saveTimer);
    await saveDraft();
    const result = await window.lc.startChallenge();
    if (!result.ok) throw new Error(result.error || '随机抽题失败');
    applyChallenge(result.data);
    recordFilter = '';
    problemQuery = '';
    document.getElementById('problemSearch').value = '';
    renderBoard();
    setProblemOpen(true);
    await selectProblem(randomChallenge.slug, { saveCurrentDraft: false });
    editor.focus();
  } catch (error) {
    setStatus(error.message);
  } finally {
    challengeStarting = false;
    setBusy(busy);
  }
}

function statusMark(problem) {
  const circle = '<circle cx="8" cy="8" r="6.15" fill="none" stroke="currentColor" stroke-width="1.35"/>';
  if (recordBoard.passed?.[problem.slug]) {
    return `<svg class="status-mark pass" viewBox="0 0 16 16" width="16" height="16" aria-label="已通过">${circle}<path d="M5.05 8.15 7.05 10.15 11.05 5.9" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  const verdict = recordBoard.bySlug[problem.slug];
  const label = verdict && verdict !== 'pass' ? '未通过' : '未做';
  return `<svg class="status-mark idle" viewBox="0 0 16 16" width="16" height="16" aria-label="${label}">${circle}</svg>`;
}

function renderProblemList() {
  const root = document.getElementById('problemList');
  root.replaceChildren();
  let group = '';
  let visible = 0;
  for (const problem of problems) {
    if (!matchesRecordFilter(problem) || !matchesProblemQuery(problem)) continue;
    visible += 1;
    if (problem.group_name !== group) {
      group = problem.group_name;
      const label = document.createElement('div');
      label.className = 'group-label';
      label.textContent = group;
      root.appendChild(label);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.slug = problem.slug;
    button.className = `problem-item${problem.slug === currentSlug ? ' active' : ''}`;
    button.innerHTML = `<span class="status-slot">${statusMark(problem)}</span><span class="problem-name"><span class="problem-name-text">${escapeHtml(problem.translated_title || problem.title)}</span></span><small class="${difficultyClass[problem.difficulty] || ''}">${difficultyLabel[problem.difficulty] || ''}</small>`;
    button.onclick = () => selectProblem(problem.slug);
    root.appendChild(button);
  }
  if (visible === 0) {
    const empty = document.createElement('div');
    empty.className = 'group-label';
    empty.textContent = recordFilter || problemQuery.trim() ? '没有符合的题目' : '没有题目';
    root.appendChild(empty);
  }
  syncChallengeControls();
}

async function loadBoard() {
  const result = await window.lc.practiceBoard();
  if (!result.ok) return;
  recordBoard = result.data || recordBoard;
  renderBoard();
}

function setRecordFilter(next) {
  recordFilter = recordFilter === next ? '' : next;
  renderBoard();
}

function matchesProblemQuery(problem) {
  const query = problemQuery.trim().toLowerCase();
  if (!query) return true;
  const haystack = [problem.translated_title, problem.title, problem.slug]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/-/g, ' ');
  return query.split(/\s+/).every((part) => haystack.includes(part));
}

function matchesRecordFilter(problem) {
  if (!recordFilter) return true;
  const verdict = recordBoard.bySlug[problem.slug] || '';
  if (recordFilter === 'todo') return !verdict;
  return verdict === recordFilter;
}

function renderBoard() {
  const board = recordBoard;
  const total = board.total || problems.length || 0;
  document.getElementById('recordRatio').textContent = `${board.pass || 0}/${total}`;
  document.querySelector('#filterPass strong').textContent = board.pass || 0;
  document.querySelector('#filterFail strong').textContent = board.fail || 0;
  document.querySelector('#filterTodo strong').textContent = board.untouched || 0;
  for (const [id, key] of [['filterPass', 'pass'], ['filterFail', 'fail'], ['filterTodo', 'todo']]) {
    document.getElementById(id).classList.toggle('active', recordFilter === key);
  }
  renderProblemList();
}

function setActiveProblem(slug) {
  const buttons = document.querySelectorAll('#problemList .problem-item');
  if (!buttons.length) return false;
  let found = false;
  for (const button of buttons) {
    const active = button.dataset.slug === slug;
    button.classList.toggle('active', active);
    if (active) {
      found = true;
      button.scrollIntoView({ block: 'nearest' });
    }
  }
  return found;
}

function visibleProblemSlugs() {
  return [...document.querySelectorAll('#problemList .problem-item')].map((button) => button.dataset.slug).filter(Boolean);
}

function isTypingTarget(target) {
  if (!target || !(target instanceof Element)) return false;
  if (target.closest('textarea, input, select, [contenteditable=""], [contenteditable="true"]')) return true;
  const tag = target.tagName;
  return tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || target.isContentEditable;
}

function stepProblem(delta) {
  if (!currentSlug || busy || challengeStarting || randomChallenge?.status === 'active') return false;
  const slugs = visibleProblemSlugs();
  if (!slugs.length) return false;
  const index = slugs.indexOf(currentSlug);
  if (index < 0) return false;
  const next = index + delta;
  if (next < 0 || next >= slugs.length) return false;
  selectProblem(slugs[next]);
  return true;
}

async function selectProblem(slug, { saveCurrentDraft = true } = {}) {
  if ((challengeStarting && randomChallenge?.status !== 'active')
    || (randomChallenge?.status === 'active' && randomChallenge.slug !== slug)) {
    setStatus('随机挑战进行中, 当前题目已锁定');
    return;
  }
  const selectionRevision = ++problemSelectionRevision;
  if (currentSlug !== slug && chatImages) chatImages.clear();
  if (saveCurrentDraft && currentSlug && editor) await saveDraft();
  if (selectionRevision !== problemSelectionRevision) return;
  clearTimeout(saveTimer);
  currentSlug = slug;
  localStorage.setItem('lc-last-slug', slug);
  if (!setActiveProblem(slug)) renderProblemList();
  setStatus('正在加载题目');
  const result = await window.lc.problemDetail(slug);
  if (selectionRevision !== problemSelectionRevision || currentSlug !== slug) return;
  if (!result.ok) {
    setStatus(result.error);
    return;
  }
  const problem = result.data;
  document.getElementById('problemTitle').textContent = problem.translated_title || problem.title;
  const link = document.getElementById('problemLink');
  link.href = `https://leetcode.cn/problems/${problem.slug}/`;
  document.getElementById('problemBody').innerHTML = sanitize(problem.content_html || '');
  currentJavaTemplate = problem.java_template || '';
  editor.setValue(problem.code || '');
  renderExplain(problem.explanation || '');
  await loadChat(slug);
  setStatus('');
}

function setSidebarOpen(open) {
  const closed = !open;
  const changed = document.body.classList.contains('sidebar-closed') !== closed;
  if (changed) document.body.classList.add('sidebar-anim');
  document.body.classList.toggle('sidebar-closed', closed);
  localStorage.setItem('lc-sidebar', open ? '1' : '0');
  if (editor) editor.layout();
  if (!changed) return;
  const pane = document.querySelector('.list-pane');
  const finish = () => {
    document.body.classList.remove('sidebar-anim');
    if (editor) editor.layout();
  };
  const timer = setTimeout(finish, 220);
  const onEnd = (event) => {
    if (event.target !== pane || event.propertyName !== 'width') return;
    pane.removeEventListener('transitionend', onEnd);
    clearTimeout(timer);
    finish();
  };
  pane.addEventListener('transitionend', onEnd);
}

function setProblemOpen(open) {
  const pane = document.querySelector('.problem-pane');
  const closed = !open;
  const moveFocus = closed && pane.contains(document.activeElement);
  const changed = document.body.classList.contains('problem-closed') !== closed;
  if (changed) document.body.classList.add('problem-anim');
  document.body.classList.toggle('problem-closed', closed);
  pane.inert = closed;
  pane.setAttribute('aria-hidden', closed ? 'true' : 'false');
  localStorage.setItem('lc-problem-open', open ? '1' : '0');
  if (moveFocus && editor) editor.focus();
  if (editor) editor.layout();
  if (!changed) return;
  const finish = () => {
    document.body.classList.remove('problem-anim');
    if (editor) editor.layout();
  };
  const timer = setTimeout(finish, 220);
  const onEnd = (event) => {
    if (event.target !== pane || event.propertyName !== 'width') return;
    pane.removeEventListener('transitionend', onEnd);
    clearTimeout(timer);
    finish();
  };
  pane.addEventListener('transitionend', onEnd);
}

function setChatOpen(open, { focus = false } = {}) {
  const closed = !open;
  const changed = document.body.classList.contains('chat-closed') !== closed;
  if (changed) document.body.classList.add('chat-anim');
  document.body.classList.toggle('chat-closed', closed);
  localStorage.setItem('lc-chat-open', open ? '1' : '0');
  const button = document.getElementById('toggleChat');
  if (button) {
    button.classList.toggle('active', open);
    button.setAttribute('aria-pressed', open ? 'true' : 'false');
  }
  if (open && focus) document.getElementById('chatInput').focus();
  if (editor) editor.layout();
  if (!changed) return;
  const pane = document.querySelector('.chat');
  const finish = () => {
    document.body.classList.remove('chat-anim');
    if (editor) editor.layout();
  };
  const timer = setTimeout(finish, 220);
  const onEnd = (event) => {
    if (event.target !== pane || event.propertyName !== 'width') return;
    pane.removeEventListener('transitionend', onEnd);
    clearTimeout(timer);
    finish();
  };
  pane.addEventListener('transitionend', onEnd);
}

async function saveDraft() {
  if (!currentSlug || !editor) return;
  await window.lc.saveDraft(currentSlug, editor.getValue());
}

async function clearCode() {
  if (!editor || !currentSlug) return;
  clearTimeout(saveTimer);
  editor.setValue(currentJavaTemplate || '');
  await saveDraft();
}

function formatCode() {
  if (!editor) return;
  editor.setValue(formatJava(editor.getValue()));
}

function formatJava(source) {
  const lines = String(source || '').replace(/\t/g, '').split(/\r?\n/);
  let depth = 0;
  const out = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      out.push('');
      continue;
    }
    const indent = /^[}\])]/.test(line) ? Math.max(0, depth - 1) : depth;
    out.push(`${'    '.repeat(indent)}${line}`);
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    depth = Math.max(0, depth + opens - closes);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

function launchFireworks(parent) {
  parent.querySelector('.firework-canvas')?.remove();
  const canvas = document.createElement('canvas');
  canvas.className = 'firework-canvas';
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  parent.prepend(canvas);
  const originX = window.innerWidth / 2;
  const originY = window.innerHeight * 0.38;
  const colors = ['#f6e7b2', '#fff6d8', '#ffffff', '#ffd27a', '#b6f5c8'];
  const sparks = [];
  const burst = (count, scale) => {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.28;
      const speed = (120 + Math.random() * 210) * scale;
      sparks.push({
        x: originX,
        y: originY,
        px: originX,
        py: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.9 + Math.random() * 0.45,
        age: 0,
        color: colors[i % colors.length],
        size: 1.5 + Math.random() * 1.5,
        gravity: 160 + Math.random() * 60,
      });
    }
  };
  burst(28, 1);
  setTimeout(() => burst(16, 0.62), 180);
  let last = performance.now();
  const started = last;
  const frame = (now) => {
    if (!canvas.isConnected) return;
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    let alive = false;
    for (const spark of sparks) {
      spark.age += dt;
      if (spark.age > spark.life) continue;
      alive = true;
      spark.px = spark.x;
      spark.py = spark.y;
      spark.vy += spark.gravity * dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      const fade = 1 - spark.age / spark.life;
      ctx.globalAlpha = fade * 0.9;
      ctx.strokeStyle = spark.color;
      ctx.lineWidth = spark.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(spark.px, spark.py);
      ctx.lineTo(spark.x, spark.y);
      ctx.stroke();
      ctx.globalAlpha = fade;
      ctx.fillStyle = spark.color;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.size * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (alive && now - started < 1900) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

function playVerdictToast(verdict, { detail = false, onDetail, titleText } = {}) {
  document.querySelector('.verdict-layer')?.remove();
  const pass = verdict === 'pass';
  const uncertain = verdict === 'uncertain';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const layer = document.createElement('div');
  layer.className = 'verdict-layer';
  const toast = document.createElement('div');
  toast.className = `verdict-toast ${pass ? 'pass' : uncertain ? 'uncertain' : 'fail'}`;
  const title = document.createElement('div');
  title.className = 'verdict-title';
  title.textContent = titleText || (pass ? '可以通过' : uncertain ? '不确定' : '不能通过');
  const rule = document.createElement('span');
  rule.className = 'verdict-rule';
  const hit = document.createElement('div');
  hit.className = 'verdict-hit';
  hit.append(title, rule);
  toast.appendChild(hit);
  if (!pass && detail) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'verdict-more';
    more.textContent = '查看提交记录';
    more.addEventListener('click', () => {
      dismiss(true);
      if (onDetail) onDetail();
    });
    hit.appendChild(more);
  }
  layer.appendChild(toast);
  document.body.appendChild(layer);
  if (pass && !reduced) launchFireworks(layer);
  const life = reduced ? 1600 : pass ? 2600 : 3800;
  let timer = 0;
  let removed = false;
  const dismiss = (immediate = false) => {
    if (removed) return;
    removed = true;
    clearTimeout(timer);
    if (reduced || immediate) {
      layer.remove();
      return;
    }
    layer.classList.add('is-leaving');
    setTimeout(() => layer.remove(), 340);
  };
  const arm = (ms) => {
    if (removed) return;
    clearTimeout(timer);
    timer = setTimeout(dismiss, ms);
  };
  arm(life);
  layer.addEventListener('click', () => dismiss(true));
  hit.addEventListener('pointerenter', () => clearTimeout(timer));
  hit.addEventListener('pointerleave', () => arm(900));
}

async function submitReview() {
  if (!currentSlug || busy || agentPending || chatPreparing || challengeStarting) return;
  const slug = currentSlug;
  const challengeId = randomChallenge?.status === 'active' ? randomChallenge.id : null;
  const code = editor.getValue();
  const button = document.getElementById('reviewCode');
  button.classList.add('is-loading');
  button.setAttribute('aria-busy', 'true');
  try {
    await withStatus('', async () => {
      clearTimeout(saveTimer);
      await window.lc.saveDraft(slug, code);
      const result = await window.lc.submitReview({ slug, code });
      if (!result.ok) throw new Error(result.error);
      const review = result.data;
      if (Object.hasOwn(review, 'challenge')) applyChallenge(review.challenge);
      await loadBoard();
      const hasReason = Boolean((review.summary || '').trim()) || (review.issues || []).length > 0;
      if (currentSlug !== slug) return;
      const challengeResult = challengeId && review.challenge?.id === challengeId ? review.challenge.status : '';
      const late = challengeResult === 'fail';
      setStatus(late ? '挑战已超时失败. 本次评审仍保存在提交记录中.' : verdictLabel[review.verdict] || '已记录');
      playVerdictToast(late ? 'fail' : review.verdict, {
        titleText: late ? '挑战失败' : challengeResult === 'pass' ? '挑战成功' : '',
        detail: review.verdict !== 'pass' && hasReason,
        onDetail: () => openHistory({ slug, submissionId: review.submissionId }),
      });
    });
  } finally {
    button.classList.remove('is-loading');
    button.removeAttribute('aria-busy');
  }
}

function setExplainOpen(open) {
  document.getElementById('explainPip').classList.toggle('is-closed', !open);
  const button = document.getElementById('toggleExplain');
  const tip = open ? '收起题解' : '题解';
  setControlTip(button, tip);
  button.classList.toggle('active', open);
  localStorage.setItem('lc-explain-open', open ? '1' : '0');
  if (open && !document.getElementById('explainPip').style.left) placePipDefault();
  syncExplainPlayback();
  if (open) document.getElementById('explainPip').focus({ preventScroll: true });
  else if (document.getElementById('explainPip').contains(document.activeElement)) button.focus({ preventScroll: true });
}

function handleExplainShortcut(key) {
  const pip = document.getElementById('explainPip');
  if (pip.classList.contains('is-closed') || document.getElementById('explainPlayer').hidden) return false;
  const action = { ' ': 'explainPause', ArrowLeft: 'explainBack', ArrowRight: 'explainStep' }[key];
  if (!action) return false;
  const button = document.getElementById(action);
  if (!button.disabled) button.click();
  return true;
}

function setExplainThoughts(open, { focus = false, persist = true } = {}) {
  const button = document.getElementById('explainThoughts');
  const expanded = !!open && !button.disabled;
  document.getElementById('explainDetails').hidden = !expanded;
  button.setAttribute('aria-expanded', String(expanded));
  setControlTip(button, expanded ? '收起思路说明' : '查看思路说明');
  if (persist) localStorage.setItem('lc-explain-details-open', expanded ? '1' : '0');
  applyPipScale();
  clampPipPosition();
  if (focus) button.focus({ preventScroll: true });
}

function renderExplainCaption(text) {
  const caption = document.getElementById('explainCaption');
  caption.replaceChildren();
  const paragraphs = String(text || '').trim().split(/(?<=[。！？])\s*|\n+/).filter(Boolean);
  const terms = /(?:prev\.next(?:\.next)?|dummy\.next|O\([^)]+\)|\b(?:dummy|prev|first|second|head|next)\b)/g;
  for (const paragraph of paragraphs) {
    const row = document.createElement('p');
    let start = 0;
    for (const match of paragraph.matchAll(terms)) {
      row.append(document.createTextNode(paragraph.slice(start, match.index)));
      const code = document.createElement('code'); code.textContent = match[0]; row.append(code);
      start = match.index + match[0].length;
    }
    row.append(document.createTextNode(paragraph.slice(start))); caption.append(row);
  }
  document.getElementById('explainThoughts').disabled = !paragraphs.length;
  setExplainThoughts(paragraphs.length && localStorage.getItem('lc-explain-details-open') === '1', { persist: false });
}

function renderExplainComplexity(data = {}) {
  const time = String(data.time_complexity || '').trim();
  const space = String(data.space_complexity || '').trim();
  document.getElementById('explainTimeComplexity').textContent = time;
  document.getElementById('explainSpaceComplexity').textContent = space;
  document.getElementById('explainComplexityNote').textContent = String(data.complexity_note || '').trim();
  document.getElementById('explainComplexity').hidden = !time || !space;
}

function syncExplainPlayback() {
  const hidden = document.getElementById('explainPip').classList.contains('is-closed');
  const paused = document.getElementById('explainPause').dataset.paused === '1';
  postExplainPlayer({ type: 'lc-player', action: hidden || paused ? 'pause' : 'resume' });
}

function renderExplain(body) {
  clearInterval(stepTimer);
  explainMeasured = false;
  document.getElementById('explainError').hidden = true;
  document.getElementById('explainTitle').textContent = document.getElementById('problemTitle').textContent || '算法演示';
  setExplainPlayer(false);
  const root = document.getElementById('explainBody');
  root.replaceChildren();
  renderExplainCaption('');
  renderExplainComplexity();
  if (!body) {
    root.textContent = '本题暂无题解.';
    rememberVisualSize(360, 96);
    return;
  }
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    root.textContent = body;
    rememberVisualSize(360, 120);
    return;
  }
  renderExplainComplexity(data);
  if (data.mode) {
    renderLegacyExplain(root, data);
    return;
  }
  renderExplainCaption(data.caption);
  if ((data.kind === 'html' && data.html) || (data.kind === 'image' && data.svg) || isImageMedia(data.media)) {
    explainNatural = { width: 640, height: 320 };
    const saved = loadPipState();
    explainScale = saved && saved.v === 4 && Number.isFinite(saved.scale) ? saved.scale : defaultExplainScale();
    applyPipScale();
  }
  requestAnimationFrame(() => applyPipScale());
  if (data.kind === 'html' && data.html) {
    const html = isolateHtml(data.html);
    currentExplainHtml = html;
    root.appendChild(explainFrame(html));
    setExplainPlayer(true);
  } else if (data.kind === 'image' && data.svg) {
    root.appendChild(explainFrame(isolateHtml(svgDocument(data.svg))));
  } else if (isImageMedia(data.media)) {
    const img = document.createElement('img');
    img.className = 'explain-media';
    img.alt = `${document.getElementById('explainTitle').textContent}题解`;
    img.onload = () => {
      if (!root.contains(img)) return;
      rememberVisualSize(img.naturalWidth, img.naturalHeight);
      // 图片按阅读宽度初始化, 避免沿用旧动画的像素缩放比例.
      // 说明区随窗口宽度换行, 再测一次可用高度以显示完整图片.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        explainScale = defaultExplainScale();
        applyPipScale();
      }
      const saved = loadPipState();
      if (!saved || saved.v !== 4 || !Number.isFinite(saved.left) || !Number.isFinite(saved.top)) placePipDefault();
    };
    img.onerror = () => {
      if (!root.contains(img)) return;
      root.textContent = '题解图片暂时无法显示.';
      const error = document.getElementById('explainError');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '重新加载';
      retry.onclick = () => renderExplain(body);
      error.replaceChildren('题解图片加载失败, 请重新加载后再试.', retry);
      error.hidden = false;
      rememberVisualSize(420, 120);
    };
    root.appendChild(img);
    img.src = data.media;
  } else {
    rememberVisualSize(420, 120);
  }
}

function renderLegacyExplain(root, data) {
  const text = document.createElement('div');
  text.className = 'explain-caption';
  text.textContent = data.text || '';
  root.appendChild(text);
  requestAnimationFrame(() => rememberVisualSize(Math.max(280, root.scrollWidth), Math.max(80, root.scrollHeight)));
  if (data.mode !== 'steps' || !Array.isArray(data.steps) || data.steps.length === 0) return;
  const caption = document.createElement('div');
  caption.className = 'explain-caption';
  const board = document.createElement('div');
  board.className = 'board';
  root.append(caption, board);
  let index = 0;
  const draw = () => {
    const step = data.steps[index % data.steps.length];
    caption.textContent = step.caption || '';
    board.replaceChildren();
    step.cells.forEach((cellText, cellIndex) => {
      const cell = document.createElement('div');
      cell.className = `cell${(step.active || []).includes(cellIndex) ? ' active' : ''}`;
      cell.textContent = cellText;
      board.appendChild(cell);
    });
    index += 1;
  };
  draw();
  stepTimer = setInterval(draw, 900);
}

function setExplainPlayer(visible) {
  const player = document.getElementById('explainPlayer');
  player.hidden = !visible;
  document.getElementById('explainBack').disabled = true;
  setExplainPaused(false);
  setExplainRate(Number(localStorage.getItem('lc-explain-rate')) || 1, { notify: false });
  if (!visible) currentExplainHtml = '';
}

function setExplainPaused(paused) {
  const button = document.getElementById('explainPause');
  const tip = paused ? '继续播放' : '暂停';
  button.dataset.paused = paused ? '1' : '0';
  button.setAttribute('aria-pressed', String(paused));
  const status = document.getElementById('explainPlaybackStatus');
  status.textContent = document.getElementById('explainPlayer').hidden ? '静态题解' : paused ? '已暂停' : '自动播放';
  status.classList.toggle('is-paused', paused || document.getElementById('explainPlayer').hidden);
  setControlTip(button, tip);
  const icon = button.querySelector('svg');
  if (icon) {
    icon.innerHTML = paused
      ? '<path d="M5.2 3.4 12.2 8 5.2 12.6z" fill="currentColor"/>'
      : '<path d="M5 3.5h2.2v9H5zm3.8 0H11v9H8.8z" fill="currentColor"/>';
  }
}

const EXPLAIN_RATES = [0.5, 1, 1.5, 2];

function normalizeExplainRate(rate) {
  const value = Number(rate);
  if (!Number.isFinite(value) || value <= 0) return 1;
  let best = EXPLAIN_RATES[0];
  let bestGap = Math.abs(value - best);
  for (const item of EXPLAIN_RATES) {
    const gap = Math.abs(value - item);
    if (gap < bestGap) {
      best = item;
      bestGap = gap;
    }
  }
  return best;
}

function explainRateValue() {
  const button = document.getElementById('explainRate');
  return normalizeExplainRate(button?.dataset.rate);
}

function setExplainRate(rate, { notify = true } = {}) {
  const next = normalizeExplainRate(rate);
  const control = document.getElementById('explainRate');
  control.dataset.rate = String(next);
  control.value = String(next);
  setControlTip(control, `播放速度 ${next}×`);
  localStorage.setItem('lc-explain-rate', String(next));
  if (notify) postExplainPlayer({ type: 'lc-player', action: 'rate', rate: next });
  return next;
}

function bindExplainRateButton() {
  document.getElementById('explainRate').onchange = event => setExplainRate(event.target.value);
  for (const id of ['explainPause', 'explainReplay', 'explainBack', 'explainStep', 'explainThoughts', 'closeExplain', 'explainRate']) {
    document.getElementById(id).addEventListener('pointerdown', event => event.stopPropagation());
  }
}

function postExplainPlayer(message) {
  const frame = document.querySelector('#explainBody iframe');
  if (!frame || !frame.contentWindow) return;
  try {
    frame.contentWindow.postMessage(message, '*');
  } catch {
    // Sandboxed srcdoc frames can reject exotic targets; ignore.
  }
}

function explainFrame(html) {
  const frame = document.createElement('iframe');
  frame.className = 'explain-frame';
  frame.title = '算法步骤演示';
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.referrerPolicy = 'no-referrer';
  frame.style.width = '100%';
  frame.style.height = '100%';
  frame.srcdoc = html;
  frame.addEventListener('load', () => {
    const rate = explainRateValue();
    if (rate && rate !== 1) postExplainPlayer({ type: 'lc-player', action: 'rate', rate });
    syncExplainPlayback();
  });
  return frame;
}

function isolateHtml(html) {
  const csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; font-src data:;">';
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (tag) => `${tag}${csp}`);
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${csp}</head><body>${html}</body></html>`;
}

function svgDocument(svg) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#1e1e1e}svg{display:block}</style></head><body>${svg}<script>const box=document.querySelector('svg').getBoundingClientRect();parent.postMessage({lcExplain:true,width:Math.ceil(box.width)||320,height:Math.ceil(box.height)||180},'*');</script></body></html>`;
}

function isImageMedia(value) {
  return /^data:image\/(gif|png|jpeg|webp|svg\+xml)/i.test(value || '')
    || /^\.\.\/assets\/explain-images\/[a-z0-9-]+\.png$/.test(value || '');
}

function formatMessageTime(value) {
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  if (sameDay) return time;
  return `${date.getMonth() + 1}/${date.getDate()} ${time}`;
}

function scrollChatToEnd() {
  const root = document.getElementById('messages');
  if (!root) return;
  root.scrollTop = root.scrollHeight;
  if (editor) editor.layout();
}

const VERDICT_DETAIL_PREF_KEY = 'lc-verdict-detail-open';

function isVerdictDetailOpen() {
  return localStorage.getItem(VERDICT_DETAIL_PREF_KEY) === '1';
}

function setVerdictDetailOpen(open) {
  localStorage.setItem(VERDICT_DETAIL_PREF_KEY, open ? '1' : '0');
}

function parseVerdictMessage(bodyText) {
  const text = String(bodyText || '');
  const match = text.match(/^(判断: (?:可以通过|不能通过))(?:\n([\s\S]*))?$/);
  if (!match) return null;
  const detail = (match[2] || '').trim();
  if (!detail) return null;
  return { headline: match[1], detail };
}

function applyVerdictBodyState(body, open) {
  const detail = body.querySelector('.verdict-msg-detail');
  const toggle = body.querySelector('.verdict-msg-toggle');
  if (!detail || !toggle) return;
  body.classList.toggle('is-expanded', open);
  detail.hidden = !open;
  toggle.textContent = open ? '点击收起说明' : '点开查看说明';
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function syncAllVerdictBodies(open) {
  for (const body of document.querySelectorAll('.message-body.is-verdict')) {
    applyVerdictBodyState(body, open);
  }
}

function fillMessageBody(body, bodyText, { collapsible = false, markdown = false } = {}) {
  const parsed = collapsible ? parseVerdictMessage(bodyText) : null;
  if (!parsed) {
    if (markdown) BambooChatMarkdown.render(body, bodyText);
    else body.textContent = bodyText;
    return;
  }
  body.classList.add('is-verdict');
  const head = document.createElement('div');
  head.className = 'verdict-msg-head';
  const label = document.createElement('span');
  label.className = 'verdict-msg-label';
  label.classList.toggle('fail', parsed.headline === '判断: 不能通过');
  label.textContent = parsed.headline;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'verdict-msg-toggle';
  const detail = document.createElement('div');
  detail.className = 'verdict-msg-detail';
  detail.textContent = parsed.detail;
  toggle.addEventListener('click', () => {
    const next = !body.classList.contains('is-expanded');
    setVerdictDetailOpen(next);
    syncAllVerdictBodies(next);
  });
  head.append(label, toggle);
  body.append(head, detail);
  applyVerdictBodyState(body, isVerdictDetailOpen());
}

function appendChatMessage(role, bodyText, createdAt = Date.now(), attachments = []) {
  const root = document.getElementById('messages');
  const item = document.createElement('div');
  item.className = `message ${role === 'user' ? 'user' : 'assistant'}`;
  const body = document.createElement('div');
  body.className = 'message-body';
  fillMessageBody(body, bodyText, { markdown: role !== 'user' });
  BambooChatImages.renderAttachments(body, attachments);
  const time = document.createElement('time');
  time.className = 'message-time';
  time.dateTime = new Date(Number(createdAt)).toISOString();
  time.textContent = formatMessageTime(createdAt);
  item.append(time, body);
  root.appendChild(item);
  return item;
}

function appendPendingAssistant() {
  const root = document.getElementById('messages');
  const item = document.createElement('div');
  item.className = 'message assistant is-pending';
  item.setAttribute('aria-label', '正在回复');
  const body = document.createElement('div');
  body.className = 'message-body is-pending';
  body.innerHTML = '<span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
  const time = document.createElement('time');
  time.className = 'message-time';
  time.dateTime = new Date().toISOString();
  time.textContent = formatMessageTime(Date.now());
  item.append(time, body);
  root.appendChild(item);
  return item;
}

async function loadChat(slug) {
  const result = await window.lc.listChat(slug);
  if (currentSlug !== slug) return;
  const root = document.getElementById('messages');
  BambooChatImages.releasePreviews(root);
  root.innerHTML = '';
  if (!result.ok) {
    root.textContent = result.error;
    return;
  }
  for (const message of result.data) {
    if (message.kind === 'review') continue;
    appendChatMessage(message.role === 'user' ? 'user' : 'assistant', message.body, message.created_at, message.attachments || []);
  }
  scrollChatToEnd();
}

function ensureHistoryEditor() {
  if (historyEditor) return historyEditor;
  historyEditor = monaco.editor.create(document.getElementById('historyCode'), {
    value: '',
    language: 'java',
    theme: 'lc-codex',
    readOnly: true,
    domReadOnly: true,
    ariaLabel: '本次提交的 Java 代码, 只读',
    fontSize: 13,
    fontFamily: '"SF Mono", Monaco, Menlo, Courier, monospace',
    lineNumbers: 'on',
    minimap: { enabled: false },
    automaticLayout: true,
    tabSize: 4,
    scrollBeyondLastLine: false,
    renderLineHighlight: 'none',
    padding: { top: 12, bottom: 12 },
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    folding: false,
    renderValidationDecorations: 'on',
    scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
  });
  return historyEditor;
}

function disposeHistoryEditor() {
  if (!historyEditor) return;
  const model = historyEditor.getModel();
  historyEditor.dispose();
  model?.dispose();
  historyEditor = undefined;
  historyDecorations = [];
}

function showHistoryState(text) {
  const state = document.getElementById('historyEmpty');
  state.textContent = text;
  state.hidden = false;
  document.getElementById('historyResult').hidden = true;
  document.getElementById('historyCode').hidden = true;
  disposeHistoryEditor();
}

function renderHistoryItem(item) {
  document.getElementById('historyEmpty').hidden = true;
  document.getElementById('historyResult').hidden = false;
  document.getElementById('historyCode').hidden = false;
  const view = ensureHistoryEditor();
  view.setValue(String(item.code || ''));
  view.setScrollTop(0);
  view.setScrollLeft(0);
  const verdict = document.getElementById('historyVerdict');
  verdict.className = item.verdict || '';
  verdict.textContent = verdictLabel[item.verdict] || '已记录';
  const time = document.getElementById('historyTime');
  const date = new Date(Number(item.created_at));
  time.textContent = Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
  if (!Number.isNaN(date.getTime())) time.dateTime = date.toISOString();
  const summary = document.getElementById('historySummary');
  summary.textContent = item.summary || '';
  summary.hidden = !summary.textContent;
  const issues = BambooReviewUtils.normalizeIssues(parseIssues(item.issues_json), item.code || '');
  const list = document.getElementById('historyIssues');
  list.replaceChildren();
  list.hidden = issues.length === 0;
  const markers = [];
  const decorations = [];
  for (const issue of issues) {
    const row = document.createElement('li');
    row.className = 'history-issue';
    const located = issue.line_start > 0;
    const location = document.createElement(located ? 'button' : 'span');
    location.className = located ? 'history-line-link' : 'history-line-unknown';
    location.textContent = located
      ? issue.line_end > issue.line_start ? `第 ${issue.line_start}–${issue.line_end} 行` : `第 ${issue.line_start} 行`
      : '未定位具体行';
    if (located) {
      location.type = 'button';
      location.setAttribute('aria-label', `${location.textContent}, 定位错误代码`);
      location.onclick = () => {
        view.revealLineInCenter(issue.line_start, monaco.editor.ScrollType.Smooth);
        view.setSelection(new monaco.Range(issue.line_start, 1, issue.line_end, view.getModel().getLineMaxColumn(issue.line_end)));
        view.focus();
      };
      markers.push({
        startLineNumber: issue.line_start,
        endLineNumber: issue.line_end,
        startColumn: 1,
        endColumn: view.getModel().getLineMaxColumn(issue.line_end),
        severity: item.verdict === 'fail' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
        message: `${issue.message}${issue.hint ? `\n提示: ${issue.hint}` : ''}`,
      });
      decorations.push({
        range: new monaco.Range(issue.line_start, 1, issue.line_end, 1),
        options: { isWholeLine: true, className: 'history-error-line', linesDecorationsClassName: 'history-error-gutter' },
      });
    }
    const message = document.createElement('p');
    message.textContent = issue.message;
    row.append(location, message);
    if (issue.hint) {
      const hint = document.createElement('p');
      hint.className = 'history-issue-hint';
      hint.textContent = `提示: ${issue.hint}`;
      row.append(hint);
    }
    list.append(row);
  }
  monaco.editor.setModelMarkers(view.getModel(), 'submission-review', markers);
  historyDecorations = view.deltaDecorations(historyDecorations, decorations);
  requestAnimationFrame(() => {
    if (historyEditor === view) view.layout();
  });
}

async function openHistory({ slug = currentSlug, submissionId } = {}) {
  if (!slug) return;
  const request = ++historyRequest;
  const list = document.getElementById('historyList');
  list.replaceChildren();
  showHistoryState('正在加载提交记录');
  const problem = problems.find(item => item.slug === slug);
  document.getElementById('historyTitle').textContent = problem ? `提交记录 · ${problem.translated_title || problem.title}` : '提交记录';
  const dialog = document.getElementById('historyDialog');
  dialog.classList.remove('is-closing');
  if (!dialog.open) dialog.showModal();
  let result;
  try {
    result = await window.lc.listHistory(slug);
  } catch (error) {
    if (request === historyRequest && dialog.open) showHistoryState(error.message || '加载提交记录失败');
    return;
  }
  if (request !== historyRequest || !dialog.open) return;
  if (!result.ok) {
    showHistoryState(result.error || '加载提交记录失败');
  } else if (result.data.length === 0) {
    showHistoryState('这道题还没有提交记录');
  } else {
    let selected;
    for (const item of result.data) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'history-item';
      const time = document.createElement('time');
      time.textContent = new Date(Number(item.created_at)).toLocaleString();
      const label = document.createElement('span');
      label.className = item.verdict || '';
      label.textContent = verdictLabel[item.verdict] || '已记录';
      button.append(time, label);
      button.onclick = () => {
        for (const child of list.children) {
          child.classList.remove('active');
          child.setAttribute('aria-pressed', 'false');
        }
        button.classList.add('active');
        button.setAttribute('aria-pressed', 'true');
        renderHistoryItem(item);
      };
      button.setAttribute('aria-pressed', 'false');
      list.appendChild(button);
      if (String(item.id) === String(submissionId)) selected = button;
    }
    (selected || list.firstChild).click();
  }
}

function closeHistoryDialog() {
  const dialog = document.getElementById('historyDialog');
  if (!dialog.open || dialog.classList.contains('is-closing')) return;
  const closingRequest = ++historyRequest;
  dialog.classList.add('is-closing');
  const finish = () => {
    dialog.removeEventListener('transitionend', onEnd);
    clearTimeout(fallback);
    if (historyRequest !== closingRequest || !dialog.classList.contains('is-closing')) return;
    if (!dialog.open) {
      dialog.classList.remove('is-closing');
      return;
    }
    dialog.close();
    disposeHistoryEditor();
    dialog.classList.remove('is-closing');
  };
  const onEnd = (event) => {
    if (event.target !== dialog || event.propertyName !== 'opacity') return;
    finish();
  };
  dialog.addEventListener('transitionend', onEnd);
  const fallback = setTimeout(finish, 220);
}

function parseIssues(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function withStatus(text, fn) {
  if (busy) return;
  busy = true;
  setBusy(true);
  setStatus(text);
  try {
    await fn();
    if (text) setStatus('');
  } catch (error) {
    setStatus(error.message);
  } finally {
    busy = false;
    setBusy(false);
  }
}

function setBusy(value) {
  for (const id of ['reviewCode', 'clearCode', 'formatCode']) {
    document.getElementById(id).disabled = value;
  }
  syncAgentControls();
}

function setStatus(text) {
  document.getElementById('status').textContent = text || '';
}

function sanitize(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+=(?:"[^"]*"|'[^']*')/gi, '')
    .replace(/javascript:/gi, '');
}

function escapeHtml(text) {
  return String(text || '').replace(/[&<>"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[char]));
}
