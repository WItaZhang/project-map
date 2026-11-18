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
  const shell = element('div', 'app-shell no-project');
  // This shell contains only fixed UI copy. Imported data is always rendered with textContent.
  shell.innerHTML = `
    <header class="topbar">
      <div class="brand"><div class="brand-mark" aria-hidden="true"><svg viewBox="0 0 28 28" width="28" height="28"><path d="M7 7L21 7M7 7L14 21M21 7L14 21" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="7" cy="7" r="3.4" fill="currentColor"/><circle cx="21" cy="7" r="3.4" fill="currentColor"/><circle cx="14" cy="21" r="3.4" fill="currentColor"/></svg></div><div class="brand-copy"><span class="brand-name">Project Map</span><span class="brand-subtitle">从能力，找到实现</span></div></div>
      <div class="top-actions"><span class="badge demo-badge hidden">合成示例</span><span class="badge local-badge"><i></i>浏览器本地解析</span><button class="btn btn-subtle" data-action="demo">打开示例</button><button class="btn btn-primary" data-action="import" aria-haspopup="menu" aria-expanded="false">＋ 导入项目</button><div class="import-menu hidden" role="menu"><button class="btn btn-subtle" data-action="choose-zip" role="menuitem">选择 ZIP 文件</button><button class="btn btn-subtle" data-action="choose-folder" role="menuitem">选择项目文件夹</button></div></div>
    </header>
    <div class="error-banner hidden" role="alert"><span class="error-message"></span><button class="error-retry btn btn-subtle">重试</button><button class="dismiss-error btn btn-icon" aria-label="关闭错误提示">×</button></div>
    <div class="workspace">
      <aside class="sidebar"><div class="sidebar-head"><div class="project-switch"><div><div class="project-name"></div><div class="project-meta"></div></div><button class="btn btn-icon mobile-only" data-action="close-sidebar" aria-label="关闭对象浏览器">×</button></div><div class="search-box"><span aria-hidden="true">⌕</span><input type="search" autocomplete="off" spellcheck="false" placeholder="搜索名称、路径、描述" aria-label="搜索对象"></div><div class="filter-list" aria-label="对象类型筛选"></div></div><div class="object-list"></div><div class="sidebar-foot"><div class="project-stats"></div><button class="notes-toggle">查看解析说明 ↗</button><div class="notes-content hidden"></div></div></aside>
      <main class="canvas-area">
        <div class="canvas-topbar"><div class="breadcrumb"><button class="btn btn-icon mobile-only" data-action="open-sidebar" aria-label="打开对象浏览器">☰</button><span class="breadcrumb-label">项目概览</span></div><div class="canvas-actions"><div class="view-tabs"><button class="active" data-view="overview">全览</button><button data-view="focus">聚焦</button></div><button class="btn btn-icon" data-action="fit" aria-label="适应画布" title="适应画布">⊡</button><button class="btn btn-icon" data-action="toggle-inspector" aria-label="切换检查器" title="显示或隐藏检查器">◧</button></div></div>
        <div class="canvas-viewport"><svg class="map-svg" tabindex="0" role="img" aria-label="项目关系画布，可拖动平移与滚轮缩放"><defs><marker id="map-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#aebdce"/></marker></defs><g class="map-transform"><g class="map-edges"></g><g class="map-nodes"></g></g></svg><div class="canvas-message hidden"></div></div>
        <div class="canvas-bottom"><div class="legend"></div><div class="zoom-controls"><button class="btn btn-icon" data-action="zoom-out" aria-label="缩小画布">−</button><button class="zoom-value" data-action="zoom-reset" title="重置为 100%">100%</button><button class="btn btn-icon" data-action="zoom-in" aria-label="放大画布">＋</button></div></div>
        <section class="welcome"><div class="welcome-art" aria-hidden="true"><svg viewBox="0 0 270 130" width="270" height="130"><path d="M135 47V74M135 74H48V92M135 74H222V92M135 74V103" stroke="#cdd9e7" stroke-width="1.5" fill="none"/><rect x="86" y="8" width="98" height="42" rx="9" fill="#f3f0fb" stroke="#d8cee9"/><circle cx="105" cy="29" r="5" fill="#9e88c6"/><path d="M120 25H165M120 33H151" stroke="#c5b9dc" stroke-width="3" stroke-linecap="round"/><rect x="11" y="91" width="74" height="28" rx="7" fill="#f0f5fc" stroke="#d0dff0"/><circle cx="26" cy="105" r="4" fill="#80a5d2"/><path d="M38 105H70" stroke="#bdcfe5" stroke-width="3" stroke-linecap="round"/><rect x="185" y="91" width="74" height="28" rx="7" fill="#fbf5ec" stroke="#e8d9c2"/><circle cx="200" cy="105" r="4" fill="#c8a270"/><path d="M212 105H244" stroke="#deceb7" stroke-width="3" stroke-linecap="round"/><circle cx="135" cy="110" r="8" fill="#eef6f2" stroke="#bfd8cd"/></svg></div><div class="welcome-eyebrow">YOUR CODE, IN CONTEXT</div><h1>导入你的项目</h1><p>把文件与能力放在同一张地图上。<br>探索 Skill、工具和代码之间的连接，直接查看来源。</p><div class="dropzone" tabindex="0" role="button" aria-label="选择或拖放项目 ZIP"><div class="dropzone-title"><span aria-hidden="true">↥</span> 拖放项目 ZIP 到这里</div><div class="dropzone-subtitle">在浏览器本地解析 · 无需 API key</div><div class="import-actions"><button class="btn btn-primary" data-action="choose-zip">选择 ZIP</button><button class="btn btn-subtle" data-action="choose-folder">选择文件夹</button></div></div><div class="capabilities"><span class="capability">Python</span><span class="capability">JS / TS</span><span class="capability">Skill</span><span class="capability">MCP 配置</span></div><button class="sample-link" data-action="welcome-demo">先用合成示例探索一下 <span aria-hidden="true">↗</span></button></section>
      </main>
      <aside class="inspector"><div class="inspector-head"><div><div class="inspector-kicker">对象检查器</div><div class="inspector-title">选择一个对象</div></div><button class="btn btn-icon" data-action="close-inspector" aria-label="收起检查器">×</button></div><div class="inspector-tabs"><button data-tab="details" class="active">概览</button><button data-tab="relations">关系</button><button data-tab="source">源码</button></div><div class="inspector-body"></div></aside>
    </div>
    <div class="drawer-scrim hidden"></div>
    <div class="busy-overlay hidden"><div class="busy-card" role="status" aria-live="polite"><div class="busy-spinner"></div><h2 class="busy-title">正在解析项目</h2><p class="busy-message">读取文件…</p><div class="progress-track"><div class="progress-bar"></div></div><button class="btn btn-subtle" data-action="cancel">取消导入</button></div></div>
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
  const state = {
    project: null, nodes: [], nodeMap: new Map(), adjacency: new Map(), query: '', filter: 'all',
    selectedId: null, view: 'overview', inspectorTab: 'details', evidence: null, relationQuery: '',
    positions: new Map(), graphNodes: [], graphEdges: [], transform: { x: 0, y: 0, k: 1 },
    drag: null, busy: false, lastAction: null, sourceOffset: null, toastTimeout: null,
  };

  function toast(message) {
    const target = find('.toast');
    target.textContent = asText(message);
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
    find('.busy-message').textContent = asText(message, '读取与解析项目文件…');
    const bar = find('.progress-bar');
    const hasProgress = typeof progress === 'number' && Number.isFinite(progress);
    const value = hasProgress ? Math.max(0, Math.min(100, progress <= 1 ? progress * 100 : progress)) : 35;
    bar.style.width = `${value}%`;
    bar.classList.toggle('indeterminate', !hasProgress);
    all('[data-action="import"], [data-action="demo"]').forEach(button => { button.disabled = true; });
  }
  function setIdle() {
    state.busy = false;
    find('.busy-overlay').classList.add('hidden');
    all('[data-action="import"], [data-action="demo"]').forEach(button => { button.disabled = false; });
  }
  function setError(message) {
    setIdle();
    find('.error-message').textContent = asText(message, '解析失败，请重试。');
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
      const label = kind === 'all' ? '全部' : typeOf(kind).label;
      const btn = action(`${label} ${kind === 'all' ? state.nodes.length : counts.get(kind)}`, `filter-chip${state.filter === kind ? ' active' : ''}`, () => {
        state.filter = kind; state.view = 'overview'; renderFilters(); renderObjectList(); renderGraph(true);
      });
      if (kind !== 'all') btn.dataset.kind = kind;
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
      const label = element('div', 'object-group', `${typeOf(kind).label} · ${matches.filter(node => node.kind === kind).length}`);
      refs.objectList.append(label);
      for (const node of group) {
        const row = action('', `object-row${node.id === state.selectedId ? ' selected' : ''}`, () => selectNode(node.id, true));
        const dot = element('span', 'kind-dot'); dot.dataset.kind = node.kind;
        const copy = element('span', 'object-copy');
        copy.append(element('span', 'object-name', node.name || node.id), element('span', 'object-path', sourceOf(node).path || node.kind));
        row.append(dot, copy); row.title = `${node.name || node.id}\n${locationOf(sourceOf(node))}`;
        refs.objectList.append(row);
      }
    }
    if (!matches.length) refs.objectList.append(element('div', 'object-more', '没有匹配对象。试试其他名称或路径。'));
    else if (matches.length > shown.length) refs.objectList.append(element('div', 'object-more', `已显示前 ${shown.length} / ${matches.length} 个对象，请搜索缩小范围。`));
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
    state.filter = state.nodes.some(node => node.kind === 'skill') ? 'skill' : 'all';
    state.selectedId = null; state.view = 'overview'; state.inspectorTab = 'details'; state.evidence = null;
    state.positions.clear(); state.relationQuery = ''; state.sourceOffset = null;
    shell.classList.remove('no-project', 'sidebar-open', 'inspector-open'); shell.classList.add('has-project');
    find('.welcome').classList.add('hidden'); find('.drawer-scrim').classList.add('hidden');
    find('.project-name').textContent = asText(project?.meta?.name, '导入的项目');
    find('.project-meta').textContent = `${project?.meta?.isDemo ? '合成示例 · ' : ''}${state.nodes.length} 个对象 · ${(project?.edges || []).length} 条静态关系`;
    find('.demo-badge').classList.toggle('hidden', !project?.meta?.isDemo);
    find('.project-stats').textContent = `${asText(project?.meta?.llmCalls, 0)} 模型调用 · 当前导入快照`;
    const notes = find('.notes-content'); notes.replaceChildren();
    for (const note of project?.meta?.notes || []) notes.append(element('p', '', note));
    if (!notes.childElementCount) notes.append(element('p', '', '关系来自本地静态分析与源文件声明；不表示运行时调用。'));
    notes.classList.add('hidden');
    setIdle(); dismissError(); renderFilters(); renderObjectList(); renderLegend(); renderInspector(); renderGraph(true);
  }
  function renderLegend() {
    const legend = find('.legend'); legend.replaceChildren();
    for (const kind of KIND_ORDER.filter(kind => state.nodes.some(node => node.kind === kind))) {
      const item = element('span', 'legend-item'); const dot = element('i', 'kind-dot'); dot.dataset.kind = kind;
      item.append(dot, document.createTextNode(typeOf(kind).label)); legend.append(item);
    }
  }
  function setView(view) {
    if (view === 'focus' && !state.selectedId) { toast('先选择一个对象，再查看它的一跳关系。'); return; }
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
  function renderGraph(fit = false) {
    if (!state.project) return;
    const selection = graphSelection(); state.graphNodes = selection.nodes;
    const ids = new Set(selection.nodes.map(node => node.id));
    state.graphEdges = (state.project.edges || []).filter(edge => ids.has(edge.from) && ids.has(edge.to)).slice(0, 160);
    state.positions = layoutNodes(selection.nodes, selection.focused);
    refs.svgNodes.replaceChildren(); refs.svgEdges.replaceChildren();
    for (const node of selection.nodes) {
      const pos = state.positions.get(node.id); if (!pos) continue;
      const group = svgElement('g', { class: `graph-node${node.id === state.selectedId ? ' selected' : ''}`, transform: `translate(${pos.x} ${pos.y})`, 'data-id': node.id, 'data-kind': node.kind, tabindex: '0', role: 'button', 'aria-label': `查看 ${node.name || node.id}` });
      const color = typeOf(node.kind).color;
      group.append(svgElement('rect', { width: pos.width, height: pos.height, rx: '10' }));
      group.append(svgElement('circle', { cx: '15', cy: '17', r: '3', fill: color }));
      group.append(svgElement('text', { class: 'node-kind', x: '25', y: '20' }, typeOf(node.kind).label.toUpperCase()));
      group.append(svgElement('text', { class: 'node-title', x: '13', y: '43' }, truncate(node.name || node.id, 25)));
      group.append(svgElement('text', { class: 'node-subtitle', x: '13', y: '64' }, truncate(sourceOf(node).path || rawDescription(node) || node.kind, 36)));
      group.append(svgElement('text', { class: 'node-badge', x: '183', y: '20', 'text-anchor': 'end' }, '⋮⋮'));
      group.append(svgElement('title', {}, `${node.name || node.id}\n${locationOf(sourceOf(node))}\n${rawDescription(node)}`));
      group.addEventListener('pointerdown', event => startNodeDrag(event, node.id));
      group.addEventListener('click', event => { if (event.detail === 0) selectNode(node.id, true); });
      group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectNode(node.id, true); } });
      refs.svgNodes.append(group);
    }
    renderEdges();
    all('[data-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.view === state.view));
    const selected = state.nodeMap.get(state.selectedId);
    find('.breadcrumb-label').textContent = selection.focused ? `${selected?.name || '对象'} / 一跳关系` : `${state.filter === 'all' ? '项目' : typeOf(state.filter).label}概览`;
    const message = find('.canvas-message');
    if (!selection.nodes.length) { message.textContent = '这里还没有匹配对象。调整左侧筛选，或导入其他项目。'; message.classList.remove('hidden'); }
    else if (selection.total > selection.nodes.length) { message.textContent = `画布显示 ${selection.nodes.length} / ${selection.total} 个对象 · ${selection.focused ? '完整关系请见右侧「关系」' : '搜索或分类以查看其他对象'}`; message.classList.remove('hidden'); }
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
      const group = svgElement('g', { class: 'edge-group', role: 'button', tabindex: '0', 'aria-label': `查看关系证据：${edge.label || edge.type}` });
      group.append(svgElement('path', { class: 'edge-line', d: geo.d, 'marker-end': 'url(#map-arrow)' }), svgElement('path', { class: 'edge-hit', d: geo.d }));
      if (state.view === 'focus' || bundles.size <= 16) group.append(svgElement('text', { class: 'edge-label', x: geo.x, y: geo.y, 'text-anchor': 'middle' }, truncate(`${edge.label || edge.type || '关联'}${bundle.length > 1 ? ` +${bundle.length - 1}` : ''}`, 20)));
      group.append(svgElement('title', {}, `${edge.label || edge.type || '关联'}\n${locationOf(edge.evidence || {})}`));
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

  function sectionLabel(container, label) { container.append(element('div', 'section-label', label)); }
  function renderInspector() {
    const node = state.nodeMap.get(state.selectedId); const body = refs.inspectorBody; body.replaceChildren();
    find('.inspector-title').textContent = node?.name || node?.id || '选择一个对象';
    find('.inspector-kicker').textContent = node ? `${typeOf(node.kind).label} · 原文与静态关系` : '对象检查器';
    all('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === state.inspectorTab));
    if (!node) {
      const blank = element('div', 'empty-inspector'); blank.append(element('span', '', '⌖'), element('h3', '', '从地图中选择对象'), element('p', '', '查看它的职责、关联与源文件。每一条连接都可以追溯到来源。')); body.append(blank); return;
    }
    if (state.inspectorTab === 'source') renderSource(body, node);
    else if (state.inspectorTab === 'relations') renderRelations(body, node);
    else renderDetails(body, node);
  }
  function renderDetails(container, node) {
    const attrs = node.attributes || {};
    if (Object.keys(attrs).length) {
      const chips = element('div', 'detail-chips');
      for (const [name, value] of Object.entries(attrs).slice(0, 8)) {
        if (value === null || value === undefined) continue;
        chips.append(element('span', 'detail-chip', `${name}: ${typeof value === 'object' ? JSON.stringify(value) : value}`));
      }
      container.append(chips);
    }
    sectionLabel(container, '原始描述'); container.append(element('p', 'detail-description', rawDescription(node) || '源文件未提供描述。'));
    sectionLabel(container, '可修改项');
    const editable = Array.isArray(node.editable) ? node.editable : [];
    if (editable.length) { const list = element('ul', 'editable-list'); editable.forEach(item => list.append(element('li', '', item))); container.append(list); }
    else container.append(element('p', 'detail-description muted', '定位源文件后，可在你自己的编辑器中继续修改。'));
    sectionLabel(container, '源文件'); container.append(element('div', 'source-location', locationOf(sourceOf(node))));
    const tools = element('div', 'source-toolbar');
    tools.append(action('查看源码 ↗', 'btn btn-primary', () => setInspectorTab('source')), action('复制路径', 'btn btn-subtle', () => copyText(locationOf(sourceOf(node))))); container.append(tools);
    if (Array.isArray(node.sources) && node.sources.length > 1) {
      sectionLabel(container, '其他来源'); for (const source of node.sources.slice(0, 12)) {
        if (source.path === sourceOf(node).path && source.line === sourceOf(node).line) continue;
        container.append(action(locationOf(source), 'related-source', () => { state.evidence = { evidence: source, label: '其他来源' }; setInspectorTab('source'); }));
      }
    }
    sectionLabel(container, `一跳关系 · ${selectedEdges().length}`);
    renderRelationRows(container, selectedEdges().slice(0, 5));
    if (selectedEdges().length > 5) container.append(action(`查看全部 ${selectedEdges().length} 条关系 →`, 'sample-link', () => setInspectorTab('relations')));
    container.append(element('p', 'inspector-note', '静态快照，仅用于浏览和定位。此界面不会执行 Skill、调用工具或改写项目。'));
  }
  function renderRelations(container) {
    container.append(element('p', 'detail-description muted', '箭头保持源文件中的关系方向。点「出处」查看对应的声明或引用。'));
    const search = element('input', 'relation-search'); search.type = 'search'; search.placeholder = '搜索关联对象或关系'; search.value = state.relationQuery; search.setAttribute('aria-label', '搜索一跳关系');
    const list = element('div', 'relation-list');
    const update = () => { list.replaceChildren(); const q = state.relationQuery.toLowerCase().trim(); const filtered = selectedEdges().filter(edge => {
      const other = state.nodeMap.get(neighborId(edge)); return !q || [other?.name, sourceOf(other).path, edge.label, edge.type, edge.evidence?.path].some(v => asText(v).toLowerCase().includes(q));
    }); renderRelationRows(list, filtered); if (!filtered.length) list.append(element('p', 'detail-description muted', '没有匹配的关系。')); };
    search.addEventListener('input', () => { state.relationQuery = search.value; update(); }); container.append(search, list); update();
  }
  function renderRelationRows(container, relations) {
    for (const edge of relations) {
      const other = state.nodeMap.get(neighborId(edge)); const row = element('div', 'relation-row');
      const main = action('', 'relation-main', () => selectNode(neighborId(edge), true));
      main.append(element('span', 'relation-name', `${edge.from === state.selectedId ? '→' : '←'} ${other?.name || other?.id || neighborId(edge)}`), element('span', 'relation-label', edge.label || edge.type || '关联'));
      row.append(main, action('出处', 'relation-evidence', () => showEvidence(edge))); container.append(row);
    }
    if (!relations.length) container.append(element('p', 'detail-description muted', '扫描中未记录该对象的一跳关系。'));
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
      block.append(element('div', 'section-label', evidence.from ? '关系来源' : '来源位置'));
      if (evidence.from) block.append(element('div', 'evidence-title', `${from?.name || evidence.from} → ${evidence.label || evidence.type || '关联'} → ${to?.name || evidence.to}`));
      const bases = { static: '静态解析', declared: '显式声明', 'text-reference': '文本引用' };
      if (evidence.basis) block.append(element('p', 'evidence-basis', `${bases[evidence.basis] || evidence.basis} · 非运行记录`));
      if (evidence.evidence?.text) block.append(element('blockquote', 'evidence-quote', evidence.evidence.text));
      container.append(block);
    }
    container.append(element('div', 'source-location', locationOf(source)));
    const toolbar = element('div', 'source-toolbar'); toolbar.append(action('复制相对路径:行', 'btn btn-subtle', () => copyText(locationOf(source))));
    if (evidence) toolbar.append(action('对象定义', 'btn btn-subtle', () => { state.evidence = null; state.sourceOffset = null; renderInspector(); }));
    container.append(toolbar);
    const files = state.project?.files || {};
    const fileValue = files instanceof Map ? files.get(source.path) : Object.prototype.hasOwnProperty.call(files, source.path || '') ? files[source.path] : undefined;
    const fileText = typeof fileValue === 'string' ? fileValue : undefined;
    if (fileText === undefined) { container.append(element('p', 'source-unavailable', '导入结果未包含此文件的内容。可以复制路径，在本机编辑器中打开。')); return; }
    const lines = fileText.replace(/\r\n/g, '\n').split('\n'); const targetLine = Math.max(1, Number(source.line) || 1);
    const offset = state.sourceOffset === null ? Math.max(0, targetLine - 16) : Math.min(Math.max(0, state.sourceOffset), Math.max(0, lines.length - 1));
    const end = Math.min(lines.length, offset + SOURCE_PAGE_SIZE);
    const range = element('div', 'source-range', `L${offset + 1}–${end} / ${lines.length} 行 · 源文件原文`); container.append(range);
    const pre = element('pre', 'source-code'); const code = element('code', '');
    for (let i = offset; i < end; i++) { const row = element('span', `source-line${i + 1 === targetLine ? ' highlight' : ''}`); row.append(element('span', 'line-number', i + 1), element('span', 'line-text', lines[i])); code.append(row); }
    pre.append(code); container.append(pre);
    if (lines.length > SOURCE_PAGE_SIZE) {
      const pagination = element('div', 'source-pagination');
      const prev = action('← 前 120 行', 'btn btn-subtle', () => { state.sourceOffset = Math.max(0, offset - 120); renderInspector(); }); prev.disabled = offset === 0;
      const target = action('回到定义', 'btn btn-subtle', () => { state.sourceOffset = null; renderInspector(); });
      const next = action('后 120 行 →', 'btn btn-subtle', () => { state.sourceOffset = Math.min(lines.length - 1, offset + 120); renderInspector(); }); next.disabled = end >= lines.length;
      pagination.append(prev, target, next); container.append(pagination);
    }
    container.append(element('p', 'inspector-note', '蓝色行标记所选对象或证据的位置。内容来自当前导入快照。'));
  }
  async function copyText(value) {
    if (!value || value === '未记录源位置') { toast('这个对象没有记录源文件位置。'); return; }
    try { await navigator.clipboard.writeText(value); toast('已复制相对路径与行号'); }
    catch {
      const field = element('textarea', 'copy-fallback'); field.value = value; field.style.cssText = 'position:fixed;left:10px;top:10px;width:1px;height:1px;opacity:0;'; shell.append(field); field.select();
      let success = false; try { success = document.execCommand('copy'); } catch { /* manual fallback below */ }
      field.remove();
      if (success) toast('已复制相对路径与行号'); else {
        const manual = element('input', 'manual-copy'); manual.value = value; manual.readOnly = true; manual.setAttribute('aria-label', '相对路径与行号，按复制快捷键复制'); refs.inspectorBody.prepend(manual); manual.focus(); manual.select(); toast('路径已选中，请按 ⌘C / Ctrl+C 复制');
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
  function bind(name, fn) { all(`[data-action="${name}"]`).forEach(btn => btn.addEventListener('click', fn)); }
  bind('import', event => { event.stopPropagation(); const menu = find('.import-menu'); menu.classList.toggle('hidden'); find('[data-action="import"]').setAttribute('aria-expanded', String(!menu.classList.contains('hidden'))); });
  shell.addEventListener('click', event => { if (!event.target.closest('.import-menu, [data-action="import"]')) closeImportMenu(); }); bind('choose-zip', event => { event.stopPropagation(); chooseZip(); }); bind('choose-folder', event => { event.stopPropagation(); chooseFolder(); });
  bind('demo', () => invoke('onDemo')); bind('welcome-demo', () => invoke('onDemo'));
  bind('cancel', () => { void invoke('onCancel', undefined, false); setIdle(); });
  bind('fit', fitCanvas); bind('zoom-in', () => zoomAt(state.transform.k * 1.2)); bind('zoom-out', () => zoomAt(state.transform.k / 1.2)); bind('zoom-reset', () => zoomAt(1));
  bind('toggle-inspector', toggleInspector); bind('close-inspector', () => { shell.classList.remove('inspector-open'); shell.classList.add('inspector-collapsed'); updateScrim(); requestAnimationFrame(fitCanvas); });
  bind('open-sidebar', () => { shell.classList.add('sidebar-open'); shell.classList.remove('inspector-open'); updateScrim(); }); bind('close-sidebar', () => { shell.classList.remove('sidebar-open'); updateScrim(); });
  find('.drawer-scrim').addEventListener('click', () => { shell.classList.remove('sidebar-open', 'inspector-open'); updateScrim(); });
  all('[data-view]').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
  all('[data-tab]').forEach(btn => btn.addEventListener('click', () => setInspectorTab(btn.dataset.tab)));
  find('.dismiss-error').addEventListener('click', dismissError); find('.error-retry').addEventListener('click', () => state.lastAction?.());
  find('.notes-toggle').addEventListener('click', () => find('.notes-content').classList.toggle('hidden'));
  refs.search.addEventListener('input', () => { state.query = refs.search.value; state.view = 'overview'; renderObjectList(); renderGraph(true); });
  refs.zipInput.addEventListener('change', () => { const file = refs.zipInput.files?.[0]; refs.zipInput.value = ''; if (file) void invoke('onZip', file); });
  refs.folderInput.addEventListener('change', () => { const files = Array.from(refs.folderInput.files || []); refs.folderInput.value = ''; if (files.length) void invoke('onFolder', files); });
  const dropzone = find('.dropzone'); dropzone.addEventListener('click', event => { if (!event.target.closest('button')) chooseZip(); });
  dropzone.addEventListener('keydown', event => { if (event.target === dropzone && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); chooseZip(); } });
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
    if (event.key === 'Escape') { shell.classList.remove('sidebar-open', 'inspector-open'); closeImportMenu(); updateScrim(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && state.project) { event.preventDefault(); shell.classList.add('sidebar-open'); shell.classList.remove('inspector-open'); updateScrim(); refs.search.focus(); }
  });
  renderInspector();
  return { setBusy, setProject, setError, setIdle };
}
