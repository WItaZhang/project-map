import { getInitialLocale, normalizeLocale, saveLocale, translate } from './i18n.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const KINDS = {
  skill: { label: 'Skill', color: '#8d75c2' },
  agent: { label: 'Agent', color: '#499c9e' },
  tool: { label: '工具', color: '#6494cf' },
  mcp: { label: 'MCP', color: '#c69760' },
  module: { label: '模块', color: '#8b9aaf' },
  config: { label: '配置', color: '#75a586' },
};
const KIND_ORDER = ['skill', 'agent', 'module', 'tool', 'mcp', 'config'];
const MAX_GRAPH_NODES = 36;
const MAX_NEIGHBORS = 14;
const SOURCE_PAGE_SIZE = 180;
const asText = (value, fallback = '') => value == null ? fallback : String(value);
const truncate = (value, length) => {
  const chars = Array.from(asText(value));
  return chars.length > length ? `${chars.slice(0, length - 1).join('')}…` : chars.join('');
};
function element(tag, className, value) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (value !== undefined) result.textContent = asText(value);
  return result;
}
function action(label, className, callback, title) {
  const result = element('button', className, label);
  result.type = 'button';
  if (title) result.title = title;
  if (callback) result.addEventListener('click', callback);
  return result;
}
function svgElement(tag, attributes = {}, value) {
  const result = document.createElementNS(SVG_NS, tag);
  for (const [name, val] of Object.entries(attributes)) result.setAttribute(name, val);
  if (value !== undefined) result.textContent = asText(value);
  return result;
}
function typeOf(kind) { return KINDS[kind] || { label: asText(kind, '对象'), color: '#8b9aaf' }; }
function sourceOf(node) { return node?.source || node?.sources?.[0] || {}; }
function locationOf(source) { return source?.path ? `${source.path}${source.line ? `:${source.line}` : ''}` : '未记录源位置'; }
function rawDescription(node) { return asText(node?.description, '').trim(); }

export function createApp(rootElement, handlers = {}) {
  let locale = getInitialLocale();
  const t = (message, params) => translate(message, locale, params);
  const kindLabel = kind => t(typeOf(kind).label);
  const sourceLocation = source => source?.path ? locationOf(source) : t('未记录源位置');
  const shell = element('div', 'app-shell no-project');
  // This shell contains only fixed UI copy. Imported data is always rendered with textContent.
  shell.innerHTML = `
    <a class="skip-link" href="#project-canvas">跳到项目地图</a>
    <header class="topbar">
      <div class="brand"><div class="brand-mark" aria-hidden="true"><svg viewBox="0 0 28 28" width="28" height="28"><path d="M7 7L21 7M7 7L14 21M21 7L14 21" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="7" cy="7" r="3.4" fill="currentColor"/><circle cx="21" cy="7" r="3.4" fill="currentColor"/><circle cx="14" cy="21" r="3.4" fill="currentColor"/></svg></div><div class="brand-copy"><span class="brand-name" translate="no">Project Map</span></div></div>
      <div class="top-actions"><div class="language-switch" role="group" aria-label="Language / 语言"><button type="button" data-locale="zh" lang="zh-CN" translate="no">中文</button><button type="button" data-locale="en" lang="en" translate="no">EN</button></div><span class="badge demo-badge hidden">示例</span><span class="badge local-badge"><i></i>本地解析</span><button class="btn btn-subtle" data-action="demo">打开示例</button><button class="btn btn-primary" data-action="import" aria-haspopup="menu" aria-expanded="false">＋ 导入项目</button><div class="import-menu hidden" role="menu"><button class="btn btn-subtle" data-action="connect-github" role="menuitem">连接 GitHub</button><button class="btn btn-subtle" data-action="choose-zip" role="menuitem">选择 ZIP 文件</button><button class="btn btn-subtle" data-action="choose-folder" role="menuitem">选择项目文件夹</button></div></div>
    </header>
    <div class="error-banner hidden" role="alert"><span class="error-message"></span><button class="error-retry btn btn-subtle">重试</button><button class="dismiss-error btn btn-icon" aria-label="关闭错误提示">×</button></div>
    <div class="workspace">
      <aside class="sidebar"><div class="sidebar-head"><div class="project-switch"><div><div class="project-name"></div><div class="project-meta"></div><div class="github-provenance hidden"></div></div><button class="btn btn-icon mobile-only" data-action="close-sidebar" aria-label="关闭对象浏览器">×</button></div><div class="search-box"><span aria-hidden="true">⌕</span><input type="search" autocomplete="off" spellcheck="false" name="objects" placeholder="搜索名称、路径、描述…" aria-label="搜索对象"></div><div class="filter-list" aria-label="对象类型筛选"></div></div><div class="object-list"></div><div class="sidebar-foot"><button class="btn btn-subtle github-refresh hidden" data-action="refresh-github">↻ 从 GitHub 刷新</button><div class="project-stats"></div><button class="notes-toggle" aria-expanded="false" aria-controls="analysis-notes">解析详情</button><div id="analysis-notes" class="notes-content hidden"></div></div></aside>
      <main class="canvas-area" id="project-canvas" tabindex="-1">
        <div class="canvas-topbar"><div class="breadcrumb"><button class="btn btn-icon mobile-only" data-action="open-sidebar" aria-label="打开对象浏览器">☰</button><span class="breadcrumb-label">项目概览</span></div><div class="canvas-actions"><div class="view-tabs"><button class="active" data-view="overview">全览</button><button data-view="focus">聚焦</button></div><button class="btn btn-icon" data-action="fit" aria-label="适应画布" title="适应画布">⊡</button><button class="btn btn-icon" data-action="toggle-inspector" aria-label="切换检查器" title="显示或隐藏检查器">◧</button></div></div>
        <div class="canvas-viewport"><svg class="map-svg" tabindex="0" role="img" aria-label="项目关系画布，可拖动平移与滚轮缩放"><defs><marker id="map-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#aebdce"/></marker></defs><g class="map-transform"><g class="map-edges"></g><g class="map-nodes"></g></g></svg><div class="canvas-message hidden"></div></div>
        <div class="canvas-bottom"><div class="legend"></div><div class="zoom-controls"><button class="btn btn-icon" data-action="zoom-out" aria-label="缩小画布">−</button><button class="zoom-value" data-action="zoom-reset" title="重置为 100%">100%</button><button class="btn btn-icon" data-action="zoom-in" aria-label="放大画布">＋</button></div></div>
        <section class="welcome">
          <div class="welcome-layout">
            <div class="welcome-start"><h1>打开项目地图</h1><div class="welcome-inputs">
              <button class="welcome-github source-choice" data-action="connect-github"><svg class="source-choice-icon" aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 19c-4 1-4-2-6-2m12 4v-4a3.5 3.5 0 0 0-1-2.7c3-.4 6-1.5 6-6.3a5 5 0 0 0-1.4-3.5A4.5 4.5 0 0 0 18.5 1s-1 0-3.5 1.8a12 12 0 0 0-6 0C6.5 1 5.5 1 5.5 1a4.5 4.5 0 0 0-.1 3.5A5 5 0 0 0 4 8c0 4.8 3 5.9 6 6.3A3.5 3.5 0 0 0 9 17v4"/></svg><span><strong>GitHub 仓库</strong><span class="choice-meta">公开仓库</span></span><span class="choice-arrow" aria-hidden="true">↗</span></button>
              <div class="dropzone source-choice-local" role="group" aria-label="本地项目"><div class="local-heading"><svg class="source-choice-icon" aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg><strong>本地项目</strong><span class="choice-meta">ZIP / 文件夹</span></div><div class="import-actions"><button class="btn btn-subtle" data-action="choose-zip">选择 ZIP</button><button class="btn btn-subtle" data-action="choose-folder">选择文件夹</button></div><span class="drop-hint">拖放 ZIP</span></div>
            </div></div>
            <div class="welcome-preview"><div class="preview-heading"><span translate="no">Career Agent</span><button class="sample-link" data-action="welcome-demo">打开示例</button></div><div class="preview-map" aria-label="示例地图">
              <svg class="preview-connections" viewBox="0 0 560 360" preserveAspectRatio="none" aria-hidden="true"><path d="M105 90V170M200 55H360M200 210H360M105 245V310H190M455 245V310H370M455 90V130H105V170" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="280" cy="55" r="3" fill="currentColor"/><circle cx="280" cy="210" r="3" fill="currentColor"/></svg>
              <button class="preview-node preview-skill" data-preview="skill" data-preview-name="prepare-application" data-preview-path=".claude/skills/prepare-application/SKILL.md"><span class="preview-kind"><i class="kind-dot" data-kind="skill"></i>Skill</span><strong translate="no">prepare-application</strong><small translate="no">SKILL.md</small></button>
              <button class="preview-node preview-agent" data-preview="agent" data-preview-name="application-reviewer" data-preview-path=".claude/agents/application-reviewer.md"><span class="preview-kind"><i class="kind-dot" data-kind="agent"></i>Agent</span><strong translate="no">application-reviewer</strong><small translate="no">reviewer.md</small></button>
              <button class="preview-node preview-tool" data-preview="tool" data-preview-name="draft_application" data-preview-path="src/server.py"><span class="preview-kind"><i class="kind-dot" data-kind="tool"></i>工具</span><strong translate="no">draft_application</strong><small translate="no">server.py:18</small></button>
              <button class="preview-node preview-mcp" data-preview="mcp" data-preview-name="career" data-preview-path="src/server.py"><span class="preview-kind"><i class="kind-dot" data-kind="mcp"></i>MCP</span><strong translate="no">career</strong><small translate="no">server.py:5</small></button>
              <button class="preview-node preview-module" data-preview="module" data-preview-path="src/server.py"><span class="preview-kind"><i class="kind-dot" data-kind="module"></i>模块</span><strong translate="no">server.py</strong><small translate="no">src/</small></button>
            </div><div class="preview-caption"><span class="badge">示例</span><span class="preview-readonly">只读</span></div></div>
          </div>
        </section>
      </main>
      <aside class="inspector"><div class="inspector-head"><div><div class="inspector-kicker">对象检查器</div><div class="inspector-title">选择一个对象</div></div><button class="btn btn-icon" data-action="close-inspector" aria-label="收起检查器">×</button></div><div class="inspector-tabs"><button data-tab="details" class="active">概览</button><button data-tab="relations">关系</button><button data-tab="source">源码</button></div><div class="inspector-body"></div></aside>
    </div>
    <div class="drawer-scrim hidden"></div>
    <div class="busy-overlay hidden"><div class="busy-card" role="status" aria-live="polite"><div class="busy-spinner"></div><h2 class="busy-title">正在解析项目</h2><p class="busy-message">读取文件…</p><div class="progress-track"><div class="progress-bar"></div></div><button class="btn btn-subtle" data-action="cancel">取消导入</button></div></div>
    <div class="github-overlay hidden">
      <section class="github-dialog" role="dialog" aria-modal="true" aria-labelledby="github-dialog-title">
        <div class="github-dialog-head"><div><div class="github-eyebrow">公开仓库</div><h2 id="github-dialog-title">连接 GitHub</h2></div><button class="btn btn-icon" data-action="close-github" aria-label="关闭 GitHub 连接">×</button></div>
        <div class="github-steps"><span data-step="repository" class="current"><b>1</b> 仓库</span><span data-step="branch"><b>2</b> 分支</span></div>
        <form class="github-form">
          <label for="github-url">仓库链接</label><input id="github-url" name="repository" type="text" autocomplete="off" spellcheck="false" placeholder="https://github.com/owner/repository" required>
          <div class="github-branch-field hidden"><div class="github-repo-name"></div><label for="github-branch">选择分支</label><select id="github-branch" name="branch"></select></div>
          <p class="github-status hidden" role="status" aria-live="polite"></p><p class="github-error hidden" role="alert"></p>
          <div class="github-dialog-actions"><button class="btn btn-subtle" type="button" data-action="close-github">取消</button><button class="btn btn-primary github-submit" type="submit">读取仓库</button></div>
        </form>
      </section>
    </div>
    <div class="toast hidden" role="status" aria-live="polite"></div>
    <input class="drop-input sr-only" type="file" accept=".zip,application/zip" data-input="zip" tabindex="-1"><input class="drop-input sr-only" type="file" webkitdirectory directory multiple data-input="folder" tabindex="-1">
  `;
  rootElement.replaceChildren(shell);
  const find = selector => shell.querySelector(selector);
  const all = selector => Array.from(shell.querySelectorAll(selector));
  const refs = {
    objectList: find('.object-list'), filters: find('.filter-list'), search: find('.search-box input'),
    viewport: find('.canvas-viewport'), svg: find('.map-svg'), transform: find('.map-transform'),
    svgNodes: find('.map-nodes'), svgEdges: find('.map-edges'), inspectorBody: find('.inspector-body'),
    zipInput: find('[data-input="zip"]'), folderInput: find('[data-input="folder"]'),
  };
  const staticText = [];
  const walker = document.createTreeWalker(shell, 4);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent.trim() && !node.parentElement?.closest('[translate="no"]')) staticText.push([node, node.textContent]);
  }
  const staticAttributes = all('[aria-label], [title], [placeholder]').flatMap(node =>
    ['aria-label', 'title', 'placeholder'].filter(attr => node.hasAttribute(attr)).map(attr => [node, attr, node.getAttribute(attr)]));
  const state = {
    project: null, nodes: [], nodeMap: new Map(), adjacency: new Map(), query: '', filter: 'all',
    selectedId: null, view: 'overview', inspectorTab: 'details', evidence: null, relationQuery: '',
    positions: new Map(), graphNodes: [], graphEdges: [], transform: { x: 0, y: 0, k: 1 },
    drag: null, busy: false, busyMessage: '', errorMessage: '', toastMessage: '', lastAction: null, sourceOffset: null, toastTimeout: null, demoTarget: null,
    githubInfo: null, githubPending: false, githubController: null, githubGeneration: 0, githubReturnFocus: null,
  };

  function toast(message) {
    const target = find('.toast');
    state.toastMessage = asText(message); target.textContent = t(state.toastMessage);
    target.classList.remove('hidden');
    clearTimeout(state.toastTimeout);
    state.toastTimeout = setTimeout(() => target.classList.add('hidden'), 2800);
  }
  async function invoke(name, payload, remember = true) {
    if (state.busy && name !== 'onCancel') return;
    if (remember) state.lastAction = () => invoke(name, payload, false);
    dismissError();
    try { await handlers[name]?.(payload); } catch (error) { setError(error?.message || asText(error)); }
  }
  function dismissError() { find('.error-banner').classList.add('hidden'); }
  function setBusy({ message, progress } = {}) {
    state.busy = true;
    find('.busy-overlay').classList.remove('hidden');
    state.busyMessage = asText(message, '读取与解析项目文件…');
    find('.busy-message').textContent = t(state.busyMessage);
    const bar = find('.progress-bar');
    const hasProgress = typeof progress === 'number' && Number.isFinite(progress);
    const value = hasProgress ? Math.max(0, Math.min(100, progress <= 1 ? progress * 100 : progress)) : 35;
    bar.style.width = `${value}%`;
    bar.classList.toggle('indeterminate', !hasProgress);
    all('[data-action="import"], [data-action="demo"], [data-action="welcome-demo"], [data-preview], [data-action="connect-github"], [data-action="choose-zip"], [data-action="choose-folder"], [data-action="refresh-github"]').forEach(button => { button.disabled = true; });
  }
  function setIdle() {
    state.busy = false;
    find('.busy-overlay').classList.add('hidden');
    all('[data-action="import"], [data-action="demo"], [data-action="welcome-demo"], [data-preview], [data-action="connect-github"], [data-action="choose-zip"], [data-action="choose-folder"], [data-action="refresh-github"]').forEach(button => { button.disabled = false; });
  }
  function setError(message) {
    state.demoTarget = null;
    setIdle();
    state.errorMessage = asText(message, '解析失败，请重试。');
    find('.error-message').textContent = t(state.errorMessage);
    find('.error-banner').classList.remove('hidden');
    find('.error-retry').disabled = !state.lastAction;
  }
  function filteredNodes() {
    const q = state.query.toLowerCase().trim();
    return state.nodes.filter(node => (state.filter === 'all' || node.kind === state.filter) && (!q ||
      [node.name, node.id, node.description, sourceOf(node).path, ...(node.aliases || [])]
        .some(value => asText(value).toLowerCase().includes(q))));
  }
  function renderFilters() {
    refs.filters.replaceChildren();
    const counts = new Map();
    state.nodes.forEach(node => counts.set(node.kind, (counts.get(node.kind) || 0) + 1));
    const available = ['all', ...KIND_ORDER.filter(kind => counts.has(kind))];
    for (const kind of available) {
      const label = kind === 'all' ? t('全部') : kindLabel(kind);
      const btn = action(`${label} ${kind === 'all' ? state.nodes.length : counts.get(kind)}`, `filter-chip${state.filter === kind ? ' active' : ''}`, () => {
        state.filter = kind; state.view = 'overview'; renderFilters(); renderObjectList(); renderGraph(true);
      });
      if (kind !== 'all') btn.dataset.kind = kind;
      btn.setAttribute('aria-pressed', String(state.filter === kind));
      refs.filters.append(btn);
    }
  }
  function renderObjectList() {
    refs.objectList.replaceChildren();
    const matches = filteredNodes();
    const shown = matches.slice(0, 220);
    for (const kind of KIND_ORDER) {
      const group = shown.filter(node => node.kind === kind);
      if (!group.length) continue;
      const label = element('div', 'object-group', `${kindLabel(kind)} · ${matches.filter(node => node.kind === kind).length}`);
      refs.objectList.append(label);
      for (const node of group) {
        const row = action('', `object-row${node.id === state.selectedId ? ' selected' : ''}`, () => selectNode(node.id, true));
        const dot = element('span', 'kind-dot'); dot.dataset.kind = node.kind;
        const copy = element('span', 'object-copy');
        copy.setAttribute('translate', 'no'); copy.append(element('span', 'object-name', node.name || node.id), element('span', 'object-path', sourceOf(node).path || node.kind));
        row.append(dot, copy); row.title = `${node.name || node.id}\n${sourceLocation(sourceOf(node))}`;
        refs.objectList.append(row);
      }
    }
    if (!matches.length) refs.objectList.append(element('div', 'object-more', t('没有匹配对象')));
    else if (matches.length > shown.length) refs.objectList.append(element('div', 'object-more', t('已显示 {shown} / {total} 个对象', { shown: shown.length, total: matches.length })));
  }
  function setProject(project) {
    state.project = project;
    state.nodes = Array.isArray(project?.nodes) ? project.nodes : [];
    state.nodeMap = new Map(state.nodes.map(node => [node.id, node]));
    state.adjacency = new Map(state.nodes.map(node => [node.id, []]));
    for (const edge of project?.edges || []) {
      state.adjacency.get(edge.from)?.push(edge);
      if (edge.to !== edge.from) state.adjacency.get(edge.to)?.push(edge);
    }
    state.query = ''; refs.search.value = '';
    state.filter = 'all';
    state.selectedId = null; state.view = 'overview'; state.inspectorTab = 'details'; state.evidence = null;
    state.positions.clear(); state.relationQuery = ''; state.sourceOffset = null;
    shell.classList.remove('no-project', 'sidebar-open', 'inspector-open'); shell.classList.add('has-project');
    find('.welcome').classList.add('hidden'); find('.drawer-scrim').classList.add('hidden');
    find('.notes-content').classList.add('hidden');
    find('.notes-toggle').setAttribute('aria-expanded', 'false');
    renderProjectMeta();
    setIdle(); dismissError(); renderFilters(); renderObjectList(); renderLegend(); renderInspector(); renderGraph(true);
    if (project?.meta?.isDemo && state.demoTarget) {
      const target = state.demoTarget;
      const node = state.nodes.find(node => node.kind === target.kind && sourceOf(node).path === target.path && (!target.name || node.name === target.name));
      state.demoTarget = null;
      if (node) { state.filter = node.kind; renderFilters(); selectNode(node.id, true); }
    }
    state.demoTarget = null;
  }
  function renderProjectMeta() {
    const project = state.project;
    find('.project-name').textContent = asText(project?.meta?.name, t('导入的项目'));
    find('.project-meta').textContent = t('{nodes} 个对象 · {edges} 条关系', { nodes: state.nodes.length, edges: (project?.edges || []).length });
    find('.demo-badge').classList.toggle('hidden', !project?.meta?.isDemo);
    const cloud = githubSource();
    const provenance = find('.github-provenance'); provenance.replaceChildren();
    provenance.classList.toggle('hidden', !cloud);
    find('.github-refresh').classList.toggle('hidden', !cloud);
    if (cloud) {
      const repoLink = element('a', 'github-repo-link', `GitHub · ${cloud.owner}/${cloud.repo}`);
      repoLink.href = `https://github.com/${encodeURIComponent(cloud.owner)}/${encodeURIComponent(cloud.repo)}`;
      repoLink.target = '_blank'; repoLink.rel = 'noopener noreferrer';
      provenance.append(repoLink, element('span', 'github-revision', `${cloud.branch} · ${cloud.commit.slice(0, 7)}`));
    }
    find('.project-stats').textContent = t(cloud ? 'GitHub 快照 · 手动刷新' : '本地快照');
    const notes = find('.notes-content'); notes.replaceChildren();
    for (const note of project?.meta?.notes || []) notes.append(element('p', '', t(note)));
    if (!notes.childElementCount) notes.append(element('p', '', t('关系来自本地静态分析与源文件声明；不表示运行时调用。')));
  }
  function renderLegend() {
    const legend = find('.legend'); legend.replaceChildren();
    for (const kind of KIND_ORDER.filter(kind => state.nodes.some(node => node.kind === kind))) {
      const item = element('span', 'legend-item'); const dot = element('i', 'kind-dot'); dot.dataset.kind = kind;
      item.append(dot, document.createTextNode(kindLabel(kind))); legend.append(item);
    }
  }
  function setView(view) {
    if (view === 'focus' && !state.selectedId) { toast('先选择一个对象'); return; }
    state.view = view; renderGraph(true);
  }
  function selectedEdges() { return state.adjacency.get(state.selectedId) || []; }
  function neighborId(edge) { return edge.from === state.selectedId ? edge.to : edge.from; }
  function selectNode(id, focus = true) {
    if (!state.nodeMap.has(id)) return;
    state.selectedId = id; state.evidence = null; state.inspectorTab = 'details'; state.sourceOffset = null; state.relationQuery = '';
    if (focus) state.view = 'focus';
    shell.classList.remove('inspector-collapsed');
    if (window.matchMedia('(max-width: 1000px)').matches) { shell.classList.add('inspector-open'); shell.classList.remove('sidebar-open'); updateScrim(); }
    renderObjectList(); renderInspector(); renderGraph(focus);
  }
  function graphSelection() {
    if (state.view === 'focus' && state.selectedId) {
      const related = selectedEdges(); const neighbors = [];
      for (const edge of related) {
        const id = neighborId(edge);
        if (id !== state.selectedId && state.nodeMap.has(id) && !neighbors.includes(id)) neighbors.push(id);
      }
      const ids = [state.selectedId, ...neighbors.slice(0, MAX_NEIGHBORS)];
      return { nodes: ids.map(id => state.nodeMap.get(id)), total: neighbors.length + 1, focused: true };
    }
    const matches = filteredNodes();
    return { nodes: matches.slice(0, MAX_GRAPH_NODES), total: matches.length, focused: false };
  }
  function layoutNodes(nodes, focused) {
    const positions = new Map(); const width = 198, height = 78;
    if (focused) {
      const center = nodes.find(node => node.id === state.selectedId);
      if (!center) return positions;
      const others = nodes.filter(node => node.id !== center.id); const left = [], right = [];
      for (const node of others) {
        const incoming = selectedEdges().some(edge => edge.from === node.id && edge.to === center.id);
        const outgoing = selectedEdges().some(edge => edge.from === center.id && edge.to === node.id);
        (incoming && !outgoing ? left : right).push(node);
      }
      while (Math.abs(left.length - right.length) > 2) {
        if (left.length > right.length) right.push(left.pop()); else left.push(right.pop());
      }
      const span = Math.max(left.length, right.length, 1) * 110;
      positions.set(center.id, { x: 310, y: span / 2 - height / 2, width, height });
      for (const [group, x] of [[left, 0], [right, 620]]) group.forEach((node, i) => positions.set(node.id, { x, y: (i + 0.5) * span / group.length - height / 2, width, height }));
      return positions;
    }
    const columns = nodes.length <= 3 ? nodes.length : nodes.length <= 12 ? 3 : 4;
    let index = 0;
    for (const kind of KIND_ORDER) for (const node of nodes.filter(node => node.kind === kind)) {
      positions.set(node.id, { x: (index % Math.max(1, columns)) * 254, y: Math.floor(index / Math.max(1, columns)) * 124, width, height }); index++;
    }
    return positions;
  }
  function renderGraph(fit = false, preserveLayout = false) {
    if (!state.project) return;
    const selection = graphSelection(); state.graphNodes = selection.nodes;
    const ids = new Set(selection.nodes.map(node => node.id));
    state.graphEdges = (state.project.edges || []).filter(edge => ids.has(edge.from) && ids.has(edge.to)).slice(0, 160);
    if (!preserveLayout) state.positions = layoutNodes(selection.nodes, selection.focused);
    refs.svgNodes.replaceChildren(); refs.svgEdges.replaceChildren();
    for (const node of selection.nodes) {
      const pos = state.positions.get(node.id); if (!pos) continue;
      const group = svgElement('g', { class: `graph-node${node.id === state.selectedId ? ' selected' : ''}`, transform: `translate(${pos.x} ${pos.y})`, 'data-id': node.id, 'data-kind': node.kind, tabindex: '0', role: 'button', 'aria-label': t('查看 {name}', { name: node.name || node.id }) });
      const color = typeOf(node.kind).color;
      group.append(svgElement('rect', { width: pos.width, height: pos.height, rx: '10' }));
      group.append(svgElement('circle', { cx: '15', cy: '17', r: '3', fill: color }));
      group.append(svgElement('text', { class: 'node-kind', x: '25', y: '20' }, kindLabel(node.kind)));
      group.append(svgElement('text', { class: 'node-title', x: '13', y: '43' }, truncate(node.name || node.id, 25)));
      group.append(svgElement('text', { class: 'node-subtitle', x: '13', y: '64' }, truncate(sourceOf(node).path || rawDescription(node) || node.kind, 36)));
      group.append(svgElement('text', { class: 'node-badge', x: '183', y: '20', 'text-anchor': 'end' }, '⋮⋮'));
      group.append(svgElement('title', {}, `${node.name || node.id}\n${sourceLocation(sourceOf(node))}\n${rawDescription(node)}`));
      group.addEventListener('pointerdown', event => startNodeDrag(event, node.id));
      group.addEventListener('click', event => { if (event.detail === 0) selectNode(node.id, true); });
      group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectNode(node.id, true); } });
      refs.svgNodes.append(group);
    }
    renderEdges();
    all('[data-view]').forEach(btn => { btn.classList.toggle('active', btn.dataset.view === state.view); btn.setAttribute('aria-pressed', String(btn.dataset.view === state.view)); });
    const selected = state.nodeMap.get(state.selectedId);
    find('.breadcrumb-label').textContent = selection.focused ? t('{name} / 一跳关系', { name: selected?.name || t('对象') }) : t('{kind}概览', { kind: state.filter === 'all' ? t('项目') : kindLabel(state.filter) });
    const message = find('.canvas-message');
    if (!selection.nodes.length) { message.textContent = t('无匹配对象'); message.classList.remove('hidden'); }
    else if (selection.total > selection.nodes.length) { message.textContent = `${t('画布显示 {shown} / {total}', { shown: selection.nodes.length, total: selection.total })} · ${t(selection.focused ? '完整关系见检查器' : '搜索或筛选更多对象')}`; message.classList.remove('hidden'); }
    else message.classList.add('hidden');
    if (fit) requestAnimationFrame(fitCanvas); else applyTransform();
  }
  function edgeGeometry(edge) {
    const a = state.positions.get(edge.from), b = state.positions.get(edge.to);
    if (!a || !b) return null;
    if (edge.from === edge.to) return { d: `M${a.x + a.width * 0.3} ${a.y} C${a.x + 10} ${a.y - 55},${a.x + a.width - 10} ${a.y - 55},${a.x + a.width * 0.7} ${a.y}`, x: a.x + a.width / 2, y: a.y - 38 };
    const right = b.x + b.width / 2 >= a.x + a.width / 2;
    let sx = right ? a.x + a.width : a.x, ex = right ? b.x : b.x + b.width;
    let sy = a.y + a.height / 2, ey = b.y + b.height / 2;
    if (Math.abs(a.x - b.x) < a.width * 0.5) {
      const down = b.y > a.y; sx = a.x + a.width / 2; ex = b.x + b.width / 2;
      sy = down ? a.y + a.height : a.y; ey = down ? b.y : b.y + b.height;
      const my = (sy + ey) / 2;
      return { d: `M${sx} ${sy} C${sx} ${my},${ex} ${my},${ex} ${ey}`, x: (sx + ex) / 2 + 7, y: my };
    }
    const mx = (sx + ex) / 2;
    return { d: `M${sx} ${sy} C${mx} ${sy},${mx} ${ey},${ex} ${ey}`, x: mx, y: (sy + ey) / 2 - 7 };
  }
  function renderEdges() {
    refs.svgEdges.replaceChildren();
    const bundles = new Map();
    for (const edge of state.graphEdges) {
      const key = `${edge.from}\u0000${edge.to}`;
      if (!bundles.has(key)) bundles.set(key, []);
      bundles.get(key).push(edge);
    }
    for (const bundle of bundles.values()) {
      const edge = bundle[0], geo = edgeGeometry(edge); if (!geo) continue;
      const group = svgElement('g', { class: 'edge-group', role: 'button', tabindex: '0', 'aria-label': t('查看关系证据：{label}', { label: t(edge.label || edge.type) }) });
      group.append(svgElement('path', { class: 'edge-line', d: geo.d, 'marker-end': 'url(#map-arrow)' }), svgElement('path', { class: 'edge-hit', d: geo.d }));
      if (state.view === 'focus' || bundles.size <= 16) group.append(svgElement('text', { class: 'edge-label', x: geo.x, y: geo.y, 'text-anchor': 'middle' }, truncate(`${t(edge.label || edge.type || '关联')}${bundle.length > 1 ? ` +${bundle.length - 1}` : ''}`, 20)));
      group.append(svgElement('title', {}, `${t(edge.label || edge.type || '关联')}\n${sourceLocation(edge.evidence || {})}`));
      group.addEventListener('click', event => { event.stopPropagation(); showEvidence(edge); });
      group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showEvidence(edge); } });
      refs.svgEdges.append(group);
    }
  }
  function applyTransform() {
    const { x, y, k } = state.transform;
    refs.transform.setAttribute('transform', `translate(${x} ${y}) scale(${k})`);
    find('.zoom-value').textContent = `${Math.round(k * 100)}%`;
  }
  function fitCanvas() {
    if (!state.positions.size) { state.transform = { x: 30, y: 30, k: 1 }; applyTransform(); return; }
    const points = Array.from(state.positions.values());
    const minX = Math.min(...points.map(p => p.x)) - 36, minY = Math.min(...points.map(p => p.y)) - 50;
    const maxX = Math.max(...points.map(p => p.x + p.width)) + 36, maxY = Math.max(...points.map(p => p.y + p.height)) + 50;
    const width = refs.viewport.clientWidth || 600, height = refs.viewport.clientHeight || 500;
    const k = Math.max(0.22, Math.min(1.15, width / (maxX - minX), height / (maxY - minY)));
    state.transform = { x: (width - (maxX - minX) * k) / 2 - minX * k, y: (height - (maxY - minY) * k) / 2 - minY * k, k };
    applyTransform();
  }
  function zoomAt(next, screenX = refs.viewport.clientWidth / 2, screenY = refs.viewport.clientHeight / 2) {
    const k = Math.min(2.8, Math.max(0.18, next));
    const current = state.transform;
    const worldX = (screenX - current.x) / current.k, worldY = (screenY - current.y) / current.k;
    state.transform = { x: screenX - worldX * k, y: screenY - worldY * k, k }; applyTransform();
  }
  function startNodeDrag(event, id) {
    if (event.button !== 0) return;
    event.stopPropagation(); event.preventDefault();
    const position = state.positions.get(id);
    state.drag = { type: 'node', id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, start: { ...position }, moved: false };
    refs.svg.setPointerCapture(event.pointerId);
  }
  refs.svg.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('.graph-node, .edge-group')) return;
    state.drag = { type: 'pan', pointerId: event.pointerId, x: event.clientX, y: event.clientY, start: { ...state.transform }, moved: false };
    refs.svg.setPointerCapture(event.pointerId); refs.svg.classList.add('panning');
  });
  refs.svg.addEventListener('pointermove', event => {
    const drag = state.drag; if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (drag.type === 'pan') { state.transform.x = drag.start.x + dx; state.transform.y = drag.start.y + dy; applyTransform(); }
    else {
      const pos = state.positions.get(drag.id); if (!pos) return;
      pos.x = drag.start.x + dx / state.transform.k; pos.y = drag.start.y + dy / state.transform.k;
      const group = Array.from(refs.svgNodes.children).find(child => child.dataset.id === drag.id);
      group?.setAttribute('transform', `translate(${pos.x} ${pos.y})`); renderEdges();
    }
  });
  function finishDrag(event) {
    const drag = state.drag; if (!drag || drag.pointerId !== event.pointerId) return;
    state.drag = null; refs.svg.classList.remove('panning');
    if (refs.svg.hasPointerCapture(event.pointerId)) refs.svg.releasePointerCapture(event.pointerId);
    if (event.type !== 'pointercancel' && drag.type === 'node' && !drag.moved) selectNode(drag.id, true);
  }
  refs.svg.addEventListener('pointerup', finishDrag); refs.svg.addEventListener('pointercancel', finishDrag);
  refs.svg.addEventListener('wheel', event => {
    event.preventDefault(); const rect = refs.svg.getBoundingClientRect();
    zoomAt(state.transform.k * Math.exp(-event.deltaY * 0.0013), event.clientX - rect.left, event.clientY - rect.top);
  }, { passive: false });
  refs.svg.addEventListener('keydown', event => {
    if (event.target !== refs.svg) return;
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAt(state.transform.k * 1.2); }
    if (event.key === '-') { event.preventDefault(); zoomAt(state.transform.k / 1.2); }
    if (event.key === '0') { event.preventDefault(); fitCanvas(); }
  });

  function githubSource() {
    const source = state.project?.meta?.source;
    if (source?.type !== 'github' || !/^[A-Za-z0-9-]+$/.test(source.owner || '') || !/^[A-Za-z0-9_.-]+$/.test(source.repo || '') || !/^[a-f0-9]{40}$/i.test(source.commit || '')) return null;
    return source;
  }
  function appendGitHubSourceLink(container, source) {
    const cloud = githubSource(), path = source?.path;
    if (!cloud || typeof path !== 'string' || !path || path.startsWith('/') || path.split('/').some(part => part === '..' || part === '.')) return;
    const line = Number.isInteger(Number(source.line)) && Number(source.line) > 0 ? Number(source.line) : 1;
    const link = element('a', 'btn btn-subtle github-source-link', t('在 GitHub 查看 ↗'));
    link.href = `https://github.com/${encodeURIComponent(cloud.owner)}/${encodeURIComponent(cloud.repo)}/blob/${cloud.commit}/${path.split('/').map(encodeURIComponent).join('/')}#L${line}`;
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    container.append(link);
  }
  function sectionLabel(container, label) { container.append(element('div', 'section-label', t(label))); }
  function renderInspector() {
    const node = state.nodeMap.get(state.selectedId); const body = refs.inspectorBody; body.replaceChildren();
    find('.inspector-title').textContent = node?.name || node?.id || t('选择一个对象');
    find('.inspector-kicker').textContent = node ? kindLabel(node.kind) : t('对象检查器');
    all('[data-tab]').forEach(button => { button.classList.toggle('active', button.dataset.tab === state.inspectorTab); button.setAttribute('aria-pressed', String(button.dataset.tab === state.inspectorTab)); });
    if (!node) {
      const blank = element('div', 'empty-inspector'); blank.append(element('span', '', '⌖'), element('h3', '', t('选择一个对象'))); body.append(blank); return;
    }
    if (state.inspectorTab === 'source') renderSource(body, node);
    else if (state.inspectorTab === 'relations') renderRelations(body, node);
    else renderDetails(body, node);
  }
  function renderDetails(container, node) {
    const attrs = node.attributes || {};
    const labels = { language: '语言', signature: '参数', serverName: '服务', status: '状态', tier: '层级' };
    const visible = Object.entries(attrs).filter(([key, value]) => labels[key] && value !== null && value !== undefined && value !== '');
    if (visible.length) {
      const chips = element('div', 'detail-chips');
      for (const [name, value] of visible) {
        chips.append(element('span', 'detail-chip', `${t(labels[name])}: ${name === 'status' ? t(value) : value}`));
      }
      container.append(chips);
    }
    sectionLabel(container, '原始描述'); container.append(element('p', 'detail-description', rawDescription(node) || t('源文件未提供描述。')));
    sectionLabel(container, '可修改项');
    const editable = Array.isArray(node.editable) ? node.editable : [];
    if (editable.length) { const list = element('ul', 'editable-list'); editable.forEach(item => list.append(element('li', '', t(item)))); container.append(list); }
    else container.append(element('p', 'detail-description muted', t('定位源文件后，可在你自己的编辑器中继续修改。')));
    sectionLabel(container, '源文件'); container.append(element('div', 'source-location', sourceLocation(sourceOf(node))));
    const tools = element('div', 'source-toolbar');
    tools.append(action(t('查看源码 ↗'), 'btn btn-primary', () => setInspectorTab('source')), action(t('复制路径'), 'btn btn-subtle', () => copyText(sourceLocation(sourceOf(node))))); appendGitHubSourceLink(tools, sourceOf(node)); container.append(tools);
    if (Array.isArray(node.sources) && node.sources.length > 1) {
      sectionLabel(container, '其他来源'); for (const source of node.sources.slice(0, 12)) {
        if (source.path === sourceOf(node).path && source.line === sourceOf(node).line) continue;
        container.append(action(sourceLocation(source), 'related-source', () => { state.evidence = { evidence: source, label: '其他来源' }; setInspectorTab('source'); }));
      }
    }
    sectionLabel(container, t('一跳关系 · {count}', { count: selectedEdges().length }));
    renderRelationRows(container, selectedEdges().slice(0, 5));
    if (selectedEdges().length > 5) container.append(action(t('查看全部 {count} 条关系', { count: selectedEdges().length }), 'sample-link', () => setInspectorTab('relations')));
  }
  function renderRelations(container) {
    const search = element('input', 'relation-search'); search.type = 'search'; search.placeholder = t('搜索关联对象或关系…'); search.name = 'relations'; search.autocomplete = 'off'; search.value = state.relationQuery; search.setAttribute('aria-label', t('搜索一跳关系'));
    const list = element('div', 'relation-list');
    const update = () => { list.replaceChildren(); const q = state.relationQuery.toLowerCase().trim(); const filtered = selectedEdges().filter(edge => {
      const other = state.nodeMap.get(neighborId(edge)); return !q || [other?.name, sourceOf(other).path, edge.label, t(edge.label), edge.type, edge.evidence?.path].some(v => asText(v).toLowerCase().includes(q));
    }); renderRelationRows(list, filtered); if (!filtered.length) list.append(element('p', 'detail-description muted', t('没有匹配的关系。'))); };
    search.addEventListener('input', () => { state.relationQuery = search.value; update(); }); container.append(search, list); update();
  }
  function renderRelationRows(container, relations) {
    for (const edge of relations) {
      const other = state.nodeMap.get(neighborId(edge)); const row = element('div', 'relation-row');
      const main = action('', 'relation-main', () => selectNode(neighborId(edge), true));
      main.append(element('span', 'relation-name', `${edge.from === state.selectedId ? '→' : '←'} ${other?.name || other?.id || neighborId(edge)}`), element('span', 'relation-label', t(edge.label || edge.type || '关联')));
      row.append(main, action(t('出处'), 'relation-evidence', () => showEvidence(edge))); container.append(row);
    }
    if (!relations.length) container.append(element('p', 'detail-description muted', t('未发现关联')));
  }
  function showEvidence(edge) {
    if (!state.selectedId || (state.selectedId !== edge.from && state.selectedId !== edge.to)) state.selectedId = state.nodeMap.has(edge.from) ? edge.from : edge.to;
    renderObjectList();
    Array.from(refs.svgNodes.children).forEach(group => group.classList.toggle('selected', group.dataset.id === state.selectedId));
    state.evidence = edge; state.inspectorTab = 'source'; state.sourceOffset = null;
    shell.classList.remove('inspector-collapsed');
    if (window.matchMedia('(max-width: 1000px)').matches) { shell.classList.add('inspector-open'); shell.classList.remove('sidebar-open'); updateScrim(); }
    renderInspector();
  }
  function setInspectorTab(tab) {
    if (tab === 'source' && state.inspectorTab !== 'source') state.sourceOffset = null;
    if (tab === 'details') state.evidence = null;
    state.inspectorTab = tab; renderInspector();
  }
  function renderSource(container, node) {
    const evidence = state.evidence, source = evidence?.evidence?.path ? evidence.evidence : sourceOf(node);
    if (evidence) {
      const block = element('div', 'evidence-block'); const from = state.nodeMap.get(evidence.from), to = state.nodeMap.get(evidence.to);
      block.append(element('div', 'section-label', t(evidence.from ? '关系来源' : '来源位置')));
      if (evidence.from) block.append(element('div', 'evidence-title', `${from?.name || evidence.from} → ${t(evidence.label || evidence.type || '关联')} → ${to?.name || evidence.to}`));
      const bases = { static: '静态解析', declared: '显式声明', 'text-reference': '文本引用', 'registry-adapter': '注册适配' };
      if (evidence.basis) block.append(element('p', 'evidence-basis', t(bases[evidence.basis] || evidence.basis)));
      if (evidence.evidence?.text) block.append(element('blockquote', 'evidence-quote', evidence.type === 'configures' ? t(evidence.evidence.text) : evidence.evidence.text));
      container.append(block);
    }
    container.append(element('div', 'source-location', sourceLocation(source)));
    const toolbar = element('div', 'source-toolbar'); toolbar.append(action(t('复制相对路径:行'), 'btn btn-subtle', () => copyText(sourceLocation(source))));
    appendGitHubSourceLink(toolbar, source);
    if (evidence) toolbar.append(action(t('对象定义'), 'btn btn-subtle', () => { state.evidence = null; state.sourceOffset = null; renderInspector(); }));
    container.append(toolbar);
    const files = state.project?.files || {};
    const fileValue = files instanceof Map ? files.get(source.path) : Object.prototype.hasOwnProperty.call(files, source.path || '') ? files[source.path] : undefined;
    const fileText = typeof fileValue === 'string' ? fileValue : undefined;
    if (fileText === undefined) { container.append(element('p', 'source-unavailable', t('源文件未包含在当前快照中'))); return; }
    const redacted = state.project?.meta?.redactedPaths?.includes(source.path);
    const displayText = redacted ? fileText.replace(/\[值已隐藏\]/g, t('[值已隐藏]')) : fileText;
    const lines = displayText.replace(/\r\n/g, '\n').split('\n'); const targetLine = Math.max(1, Number(source.line) || 1);
    const offset = state.sourceOffset === null ? Math.max(0, targetLine - 16) : Math.min(Math.max(0, state.sourceOffset), Math.max(0, lines.length - 1));
    const end = Math.min(lines.length, offset + SOURCE_PAGE_SIZE);
    const range = element('div', 'source-range', t('{range} / {total} 行', { range: `L${offset + 1}–${end}`, total: lines.length })); container.append(range);
    const pre = element('pre', 'source-code'); pre.setAttribute('translate', 'no'); const code = element('code', '');
    for (let i = offset; i < end; i++) { const row = element('span', `source-line${i + 1 === targetLine ? ' highlight' : ''}`); row.append(element('span', 'line-number', i + 1), element('span', 'line-text', lines[i])); code.append(row); }
    pre.append(code); container.append(pre);
    if (lines.length > SOURCE_PAGE_SIZE) {
      const pagination = element('div', 'source-pagination');
      const prev = action(t('← 前 120 行'), 'btn btn-subtle', () => { state.sourceOffset = Math.max(0, offset - 120); renderInspector(); }); prev.disabled = offset === 0;
      const target = action(t('回到定义'), 'btn btn-subtle', () => { state.sourceOffset = null; renderInspector(); });
      const next = action(t('后 120 行 →'), 'btn btn-subtle', () => { state.sourceOffset = Math.min(lines.length - 1, offset + 120); renderInspector(); }); next.disabled = end >= lines.length;
      pagination.append(prev, target, next); container.append(pagination);
    }
  }
  async function copyText(value) {
    if (!value || value === t('未记录源位置')) { toast('这个对象没有记录源文件位置。'); return; }
    try { await navigator.clipboard.writeText(value); toast('已复制相对路径与行号'); }
    catch {
      const field = element('textarea', 'copy-fallback'); field.value = value; field.style.cssText = 'position:fixed;left:10px;top:10px;width:1px;height:1px;opacity:0;'; shell.append(field); field.select();
      let success = false; try { success = document.execCommand('copy'); } catch { /* manual fallback below */ }
      field.remove();
      if (success) toast('已复制相对路径与行号'); else {
        const manual = element('input', 'manual-copy'); manual.value = value; manual.readOnly = true; manual.setAttribute('aria-label', t('相对路径与行号，按复制快捷键复制')); refs.inspectorBody.prepend(manual); manual.focus(); manual.select(); toast('路径已选中，请按 ⌘C / Ctrl+C 复制');
      }
    }
  }
  function updateScrim() {
    const open = (shell.classList.contains('sidebar-open') && window.matchMedia('(max-width: 700px)').matches) || (shell.classList.contains('inspector-open') && window.matchMedia('(max-width: 1000px)').matches);
    find('.drawer-scrim').classList.toggle('hidden', !open);
  }
  function toggleInspector() {
    if (window.matchMedia('(max-width: 1000px)').matches) { shell.classList.toggle('inspector-open'); shell.classList.remove('sidebar-open'); updateScrim(); }
    else { shell.classList.toggle('inspector-collapsed'); requestAnimationFrame(fitCanvas); }
  }
  function closeImportMenu() { find('.import-menu').classList.add('hidden'); find('[data-action="import"]').setAttribute('aria-expanded', 'false'); }
  function chooseZip() { closeImportMenu(); if (!state.busy) refs.zipInput.click(); }
  function chooseFolder() { closeImportMenu(); if (!state.busy) refs.folderInput.click(); }
  function resetGitHubInspection() {
    state.githubController?.abort(); state.githubController = null;
    state.githubGeneration++; state.githubPending = false; state.githubInfo = null;
    find('.github-form').removeAttribute('aria-busy');
    state.githubError = '';
    find('.github-submit').disabled = false; find('.github-submit').textContent = t('读取仓库');
    find('.github-branch-field').classList.add('hidden');
    find('.github-status').classList.add('hidden'); find('.github-error').classList.add('hidden');
    find('#github-branch').replaceChildren();
    updateGitHubSteps();
  }
  function setDialogBackgroundInert(inert) {
    for (const child of shell.children) if (!child.classList.contains('github-overlay')) child.inert = inert;
  }
  function openGitHub(event) {
    if (state.busy) return;
    const trigger = event?.currentTarget || document.activeElement;
    state.githubReturnFocus = trigger?.closest('.import-menu') ? find('[data-action="import"]') : trigger;
    closeImportMenu(); resetGitHubInspection();
    find('.github-overlay').classList.remove('hidden'); setDialogBackgroundInert(true);
    const input = find('#github-url');
    if (!input.value && githubSource()) input.value = `https://github.com/${githubSource().owner}/${githubSource().repo}`;
    input.focus();
  }
  function closeGitHub() {
    resetGitHubInspection(); find('.github-overlay').classList.add('hidden'); setDialogBackgroundInert(false);
    const trigger = state.githubReturnFocus;
    if (trigger?.isConnected) trigger.focus(); else find('[data-action="import"]').focus();
  }
  async function submitGitHub(event) {
    event.preventDefault();
    if (state.busy || state.githubPending || find('.github-overlay').classList.contains('hidden')) return;
    if (state.githubInfo) {
      const { owner, repo } = state.githubInfo, branch = find('#github-branch').value;
      if (!branch) return;
      closeGitHub(); void invoke('onGitHubConnect', { owner, repo, branch }); return;
    }
    const url = find('#github-url').value.trim();
    const errorBox = find('.github-error'); errorBox.classList.add('hidden');
    if (!url) { state.githubError = '请输入公开 GitHub 仓库链接。'; errorBox.textContent = t(state.githubError); errorBox.classList.remove('hidden'); find('#github-url').focus(); return; }
    const generation = ++state.githubGeneration, controller = new AbortController();
    state.githubController = controller; state.githubPending = true;
    find('.github-form').setAttribute('aria-busy', 'true');
    find('.github-submit').disabled = true; find('.github-submit').textContent = t('正在读取…');
    const status = find('.github-status'); status.textContent = t('正在读取仓库和分支…'); status.classList.remove('hidden');
    try {
      const info = await handlers.onGitHubInspect?.(url, { signal: controller.signal });
      if (controller.signal.aborted || generation !== state.githubGeneration) return;
      if (!info?.owner || !info?.repo || !info?.defaultBranch) throw new Error('未能读取仓库，请稍后重试。');
      const branches = [...new Set([info.defaultBranch, ...(info.branches || [])])].filter(branch => typeof branch === 'string' && branch);
      state.githubInfo = info;
      find('.github-repo-name').textContent = info.fullName || `${info.owner}/${info.repo}`;
      const select = find('#github-branch'); select.replaceChildren();
      for (const branch of branches) { const option = element('option', '', branch); option.value = branch; select.append(option); }
      select.value = info.defaultBranch;
      find('.github-branch-field').classList.remove('hidden');
      status.classList.add('hidden');
      updateGitHubSteps();
      find('.github-submit').textContent = t('连接仓库'); select.focus();
    } catch (error) {
      if (controller.signal.aborted || generation !== state.githubGeneration) return;
      state.githubError = error?.message || '读取仓库失败，请检查链接后重试。'; errorBox.textContent = t(state.githubError); errorBox.classList.remove('hidden');
      status.classList.add('hidden'); find('.github-submit').textContent = t('读取仓库');
    } finally {
      if (generation === state.githubGeneration) {
        state.githubPending = false; state.githubController = null;
        find('.github-form').removeAttribute('aria-busy'); find('.github-submit').disabled = false;
        updateGitHubSteps();
      }
    }
  }
  function bind(name, fn) { all(`[data-action="${name}"]`).forEach(btn => btn.addEventListener('click', fn)); }
  bind('connect-github', openGitHub); bind('close-github', closeGitHub);
  bind('refresh-github', () => invoke('onGitHubRefresh'));
  find('#github-url').addEventListener('input', resetGitHubInspection);
  find('.github-form').addEventListener('submit', submitGitHub);
  find('.github-overlay').addEventListener('click', event => { if (event.target === find('.github-overlay')) closeGitHub(); });
  find('.github-dialog').addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(find('.github-dialog').querySelectorAll('button, input, select, a[href], [tabindex="0"]')).filter(node => !node.disabled && !node.closest('.hidden'));
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  bind('import', event => { event.stopPropagation(); const menu = find('.import-menu'); menu.classList.toggle('hidden'); find('[data-action="import"]').setAttribute('aria-expanded', String(!menu.classList.contains('hidden'))); });
  shell.addEventListener('click', event => { if (!event.target.closest('.import-menu, [data-action="import"]')) closeImportMenu(); }); bind('choose-zip', event => { event.stopPropagation(); chooseZip(); }); bind('choose-folder', event => { event.stopPropagation(); chooseFolder(); });
  bind('demo', () => { state.demoTarget = null; void invoke('onDemo'); }); bind('welcome-demo', () => { state.demoTarget = null; void invoke('onDemo'); });
  bind('cancel', () => { void invoke('onCancel', undefined, false); setIdle(); });
  bind('fit', fitCanvas); bind('zoom-in', () => zoomAt(state.transform.k * 1.2)); bind('zoom-out', () => zoomAt(state.transform.k / 1.2)); bind('zoom-reset', () => zoomAt(1));
  bind('toggle-inspector', toggleInspector); bind('close-inspector', () => { shell.classList.remove('inspector-open'); shell.classList.add('inspector-collapsed'); updateScrim(); requestAnimationFrame(fitCanvas); });
  bind('open-sidebar', () => { shell.classList.add('sidebar-open'); shell.classList.remove('inspector-open'); updateScrim(); }); bind('close-sidebar', () => { shell.classList.remove('sidebar-open'); updateScrim(); });
  find('.drawer-scrim').addEventListener('click', () => { shell.classList.remove('sidebar-open', 'inspector-open'); updateScrim(); });
  all('[data-view]').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
  all('[data-tab]').forEach(btn => btn.addEventListener('click', () => setInspectorTab(btn.dataset.tab)));
  find('.dismiss-error').addEventListener('click', dismissError); find('.error-retry').addEventListener('click', () => state.lastAction?.());
  find('.notes-toggle').addEventListener('click', () => { const hidden = find('.notes-content').classList.toggle('hidden'); find('.notes-toggle').setAttribute('aria-expanded', String(!hidden)); });
  refs.search.addEventListener('input', () => { state.query = refs.search.value; state.view = 'overview'; renderObjectList(); renderGraph(true); });
  refs.zipInput.addEventListener('change', () => { const file = refs.zipInput.files?.[0]; refs.zipInput.value = ''; if (file) void invoke('onZip', file); });
  refs.folderInput.addEventListener('change', () => { const files = Array.from(refs.folderInput.files || []); refs.folderInput.value = ''; if (files.length) void invoke('onFolder', files); });
  const dropzone = find('.dropzone');
  let dragDepth = 0;
  shell.addEventListener('dragenter', event => { if (!event.dataTransfer?.types.includes('Files')) return; event.preventDefault(); dragDepth++; dropzone.classList.add('dragover'); shell.classList.add('file-dragover'); });
  shell.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } });
  shell.addEventListener('dragleave', event => { event.preventDefault(); dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) { dropzone.classList.remove('dragover'); shell.classList.remove('file-dragover'); } });
  shell.addEventListener('drop', event => {
    event.preventDefault(); dragDepth = 0; dropzone.classList.remove('dragover'); shell.classList.remove('file-dragover');
    if (state.busy) return; const files = Array.from(event.dataTransfer?.files || []); const zip = files.find(file => /\.zip$/i.test(file.name));
    if (zip) void invoke('onZip', zip); else setError('请拖放一个 ZIP 文件；导入目录请使用「选择文件夹」。');
  });
  let resizeTimer;
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (state.project && !state.drag) applyTransform(); updateScrim(); }, 80); }) : null;
  observer?.observe(refs.viewport);
  window.addEventListener('keydown', event => {
    if (!find('.github-overlay').classList.contains('hidden')) {
      if (event.key === 'Escape') { event.preventDefault(); closeGitHub(); }
      return;
    }
    if (event.key === 'Escape') { shell.classList.remove('sidebar-open', 'inspector-open'); closeImportMenu(); updateScrim(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && state.project) { event.preventDefault(); shell.classList.add('sidebar-open'); shell.classList.remove('inspector-open'); updateScrim(); refs.search.focus(); }
  });
  function updateGitHubSteps() {
    find('[data-step="repository"]').classList.toggle('current', !state.githubInfo);
    find('[data-step="repository"]').classList.toggle('complete', !!state.githubInfo);
    find('[data-step="branch"]').classList.toggle('current', !!state.githubInfo);
    find('.github-submit').textContent = t(state.githubPending ? '正在读取…' : state.githubInfo ? '连接仓库' : '读取仓库');
  }
  function setLocale(next, persist = true) {
    locale = normalizeLocale(next);
    if (persist) saveLocale(locale);
    shell.dataset.locale = locale;
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    document.title = t('Project Map — 看见项目的结构');
    find('.canvas-area').dataset.dropLabel = t('拖放 ZIP');
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = t('连接 GitHub 仓库或导入本地项目，探索代码、Skill、工具与 MCP 的关系和来源。无需 LLM 或 API key。');
    for (const [node, message] of staticText) if (node.isConnected) {
      const leading = message.match(/^\s*/)[0], trailing = message.match(/\s*$/)[0];
      node.textContent = leading + t(message.trim()) + trailing;
    }
    for (const [node, attr, message] of staticAttributes) if (node.isConnected) node.setAttribute(attr, t(message));
    all('[data-locale]').forEach(button => { button.classList.toggle('active', button.dataset.locale === locale); button.setAttribute('aria-pressed', String(button.dataset.locale === locale)); });
    const listScroll = refs.objectList.scrollTop, inspectorScroll = refs.inspectorBody.scrollTop;
    const sourceScroll = find('.source-code') ? { x: find('.source-code').scrollLeft, y: find('.source-code').scrollTop } : null;
    if (state.project) { renderProjectMeta(); renderFilters(); renderObjectList(); renderLegend(); renderGraph(false, true); }
    renderInspector();
    refs.objectList.scrollTop = listScroll; refs.inspectorBody.scrollTop = inspectorScroll;
    if (sourceScroll && find('.source-code')) { find('.source-code').scrollLeft = sourceScroll.x; find('.source-code').scrollTop = sourceScroll.y; }
    find('.busy-message').textContent = t(state.busyMessage);
    find('.error-message').textContent = t(state.errorMessage);
    find('.toast').textContent = t(state.toastMessage);
    if (state.githubError) find('.github-error').textContent = t(state.githubError);
    find('.github-status').textContent = t('正在读取仓库和分支…');
    updateGitHubSteps();
  }
  all('[data-locale]').forEach(button => button.addEventListener('click', () => setLocale(button.dataset.locale)));
  all('[data-preview]').forEach(button => button.addEventListener('click', () => { state.demoTarget = { kind: button.dataset.preview, name: button.dataset.previewName, path: button.dataset.previewPath }; void invoke('onDemo'); }));
  setLocale(locale, false);
  return { setBusy, setProject, setError, setIdle, setLocale, getLocale: () => locale };

}
