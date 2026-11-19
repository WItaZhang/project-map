import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createApp } from '../src/ui.js';
import { analyzeProject } from '../src/analyze.js';
import { getDemoFiles } from '../src/demo.js';

function mount(t, handlers = {}) {
  const window = new Window({ url: 'https://example.invalid', settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  window.localStorage.setItem('project-map-language', 'zh');
  const previous = new Map();
  for (const [key, value] of Object.entries({ window, localStorage: window.localStorage, document: window.document, navigator: window.navigator, requestAnimationFrame: window.requestAnimationFrame.bind(window), cancelAnimationFrame: window.cancelAnimationFrame.bind(window), ResizeObserver: window.ResizeObserver })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const root = window.document.createElement('div'); window.document.body.append(root);
  const app = createApp(root, handlers);
  t.after(async () => {
    await window.happyDOM.abort();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return { window, root, app };
}

const project = {
  meta: { name: 'Synthetic Project', llmCalls: 0, notes: ['Text mentions are not execution.'], isDemo: true },
  nodes: [
    { id: 'skill:s', kind: 'skill', name: 'find-jobs', description: '<img src="https://example.invalid/leak"> Original skill.', source: { path: 'skills/find/SKILL.md', line: 3, endLine: 6 }, editable: ['指令正文'], attributes: {} },
    { id: 'tool:t', kind: 'tool', name: 'search_jobs', description: 'Original tool.', source: { path: 'src/tools.py', line: 2, endLine: 4 }, editable: ['函数实现'], attributes: { tier: 'read' } },
  ],
  edges: [{ id: 'e1', from: 'skill:s', to: 'tool:t', label: '正文提及', type: 'mentions-tool', basis: 'text-reference', evidence: { path: 'skills/find/SKILL.md', line: 6, text: 'Use search_jobs.' } }],
  files: { 'skills/find/SKILL.md': '---\nname: find-jobs\ndescription: Original\n---\n# Find jobs\nUse search_jobs.\n', 'src/tools.py': '@tool\ndef search_jobs(query: str):\n    """Original tool."""\n    return []\n' },
};

test('empty workspace exposes ZIP/folder/demo actions and busy cancellation', async t => {
  let demo = 0, cancel = 0;
  const { root, app } = mount(t, { onDemo: () => demo++, onCancel: () => cancel++ });
  assert.match(root.textContent, /打开项目地图/);
  assert.ok(root.querySelector('input[webkitdirectory]'));
  root.querySelector('[data-action="welcome-demo"]').click();
  assert.equal(demo, 1);
  app.setBusy({ message: '正在解析测试', progress: 0.5 });
  assert.equal(root.querySelector('.progress-bar').style.width, '50%');
  root.querySelector('[data-action="cancel"]').click();
  assert.equal(cancel, 1);
  assert.ok(root.querySelector('.busy-overlay').classList.contains('hidden'));
});

test('node selection, source lines, relation evidence, zoom and filtering work in the DOM', t => {
  const { root, app, window } = mount(t);
  app.setProject(project);
  assert.equal(root.querySelectorAll('.object-row').length, 2);
  assert.match(root.querySelector('.filter-chip.active').textContent, /全部 2/);
  root.querySelector('.object-row').click();
  assert.match(root.querySelector('.inspector-body').textContent, /Original skill/);
  assert.equal(root.querySelectorAll('img').length, 0, 'Imported description must remain text');
  assert.equal(root.querySelectorAll('.graph-node').length, 2);
  root.querySelector('[data-tab="source"]').click();
  assert.equal(root.querySelector('.source-line.highlight .line-number').textContent, '3');
  root.querySelector('[data-tab="relations"]').click();
  root.querySelector('.relation-evidence').click();
  assert.match(root.querySelector('.evidence-block').textContent, /文本引用/);
  assert.equal(root.querySelector('.source-line.highlight .line-number').textContent, '6');
  const before = root.querySelector('.zoom-value').textContent;
  root.querySelector('[data-action="zoom-in"]').click();
  assert.notEqual(root.querySelector('.zoom-value').textContent, before);
  root.querySelector('.filter-chip[data-kind="tool"]').click();
  const search = root.querySelector('input[aria-label="搜索对象"]');
  search.value = 'src/tools.py'; search.dispatchEvent(new window.Event('input'));
  assert.equal(root.querySelectorAll('.object-row').length, 1);
  root.querySelector('.object-row').click();
  assert.equal(root.querySelector('.inspector-title').textContent, 'search_jobs');
});

test('failed import retains the current project and loaded import menu supports folders', t => {
  const { root, app } = mount(t);
  app.setProject(project);
  app.setBusy({ message: 'Importing next project' });
  app.setError('Invalid ZIP');
  assert.equal(root.querySelector('.project-name').textContent, 'Synthetic Project');
  assert.match(root.querySelector('.error-message').textContent, /Invalid ZIP/);
  assert.ok(!root.querySelector('.error-banner').classList.contains('hidden'));
  root.querySelector('[data-action="import"]').click();
  const folderAction = root.querySelector('.topbar [data-action="choose-folder"]');
  assert.ok(folderAction, 'Folder import remains reachable after a project is loaded');
});

test('pointer dragging moves nodes and background panning changes the viewport', t => {
  const { root, app, window } = mount(t);
  app.setProject(project);
  root.querySelector('.object-row').click();
  const svg = root.querySelector('.map-svg');
  // Pointer capture is a browser input-routing primitive; emulate only that routing.
  const captures = new Set();
  svg.setPointerCapture = id => captures.add(id);
  svg.hasPointerCapture = id => captures.has(id);
  svg.releasePointerCapture = id => captures.delete(id);
  const event = (name, x, y) => new window.PointerEvent(name, { bubbles: true, pointerId: 1, button: 0, clientX: x, clientY: y });
  const node = root.querySelector('.graph-node');
  const initial = node.getAttribute('transform');
  node.dispatchEvent(event('pointerdown', 10, 10));
  svg.dispatchEvent(event('pointermove', 80, 50));
  svg.dispatchEvent(event('pointerup', 80, 50));
  assert.notEqual(node.getAttribute('transform'), initial);
  const transform = root.querySelector('.map-transform');
  const before = transform.getAttribute('transform');
  svg.dispatchEvent(event('pointerdown', 10, 10));
  svg.dispatchEvent(event('pointermove', 60, 30));
  svg.dispatchEvent(event('pointerup', 60, 30));
  assert.notEqual(transform.getAttribute('transform'), before);
});

test('GitHub dialog inspects once, selects a branch, and connects without opening a file picker', async t => {
  let resolveInspect, inspections = 0, selected;
  const { root, window } = mount(t, {
    onGitHubInspect: (url, { signal }) => {
      inspections++; assert.equal(url, 'https://github.com/example/agent'); assert.equal(signal.aborted, false);
      return new Promise(resolve => { resolveInspect = resolve; });
    },
    onGitHubConnect: input => { selected = input; },
  });
  root.querySelector('.welcome [data-action="connect-github"]').click();
  const input = root.querySelector('#github-url'), form = root.querySelector('.github-form');
  assert.equal(window.document.activeElement, input);
  input.value = 'https://github.com/example/agent';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(inspections, 1, 'A pending inspection cannot be double-submitted');
  resolveInspect({ owner: 'example', repo: 'agent', fullName: 'example/agent', defaultBranch: 'main', branches: ['main', 'feature/jobs'] });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(root.querySelector('.github-submit').textContent, '连接仓库');
  const branch = root.querySelector('#github-branch');
  assert.equal(branch.value, 'main'); branch.value = 'feature/jobs';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  assert.deepEqual(selected, { owner: 'example', repo: 'agent', branch: 'feature/jobs' });
  assert.ok(root.querySelector('.github-overlay').classList.contains('hidden'));
});

test('GitHub errors remain in the dialog; cancelling aborts and ignores late inspection results', async t => {
  let reject = true, finish, signal;
  const { root, app, window } = mount(t, {
    onGitHubInspect: (_url, options) => {
      signal = options.signal;
      if (reject) return Promise.reject(new Error('仓库不存在，或不是公开仓库。'));
      return new Promise(resolve => { finish = resolve; });
    },
  });
  app.setProject(project);
  root.querySelector('[data-action="import"]').click();
  root.querySelector('.import-menu [data-action="connect-github"]').click();
  const input = root.querySelector('#github-url'), form = root.querySelector('.github-form');
  input.value = 'example/missing';
  form.dispatchEvent(new window.Event('submit', { cancelable: true }));
  await Promise.resolve(); await Promise.resolve();
  assert.match(root.querySelector('.github-error').textContent, /不是公开仓库/);
  assert.ok(!root.querySelector('.github-overlay').classList.contains('hidden'));
  assert.ok(root.querySelector('.error-banner').classList.contains('hidden'));
  assert.equal(root.querySelector('.project-name').textContent, 'Synthetic Project');
  reject = false;
  form.dispatchEvent(new window.Event('submit', { cancelable: true }));
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(signal.aborted, true);
  assert.equal(window.document.activeElement, root.querySelector('[data-action="import"]'));
  finish({ owner: 'example', repo: 'agent', defaultBranch: 'main', branches: ['main'] });
  await Promise.resolve(); await Promise.resolve();
  assert.ok(root.querySelector('.github-overlay').classList.contains('hidden'));
  assert.equal(root.querySelector('#github-branch').childElementCount, 0, 'Cancelled results cannot repopulate the dialog');
});

test('GitHub source provenance, refresh, and immutable evidence links follow the loaded project', t => {
  let refreshes = 0;
  const { root, app } = mount(t, { onGitHubRefresh: () => refreshes++ });
  const commit = '0123456789abcdef0123456789abcdef01234567';
  app.setProject({ ...project, meta: { ...project.meta, isDemo: false, source: { type: 'github', owner: 'example', repo: 'agent', branch: 'feature/jobs', commit, htmlURL: 'https://github.com/example/agent' } } });
  assert.match(root.querySelector('.github-provenance').textContent, /example\/agent.*feature\/jobs.*0123456/);
  assert.match(root.querySelector('.project-stats').textContent, /GitHub 快照.*手动刷新/);
  root.querySelector('[data-action="refresh-github"]').click(); assert.equal(refreshes, 1);
  app.setBusy({ message: 'Refreshing' }); assert.equal(root.querySelector('[data-action="refresh-github"]').disabled, true); app.setIdle();
  root.querySelector('.object-row').click();
  assert.equal(root.querySelector('.github-source-link').href, `https://github.com/example/agent/blob/${commit}/skills/find/SKILL.md#L3`);
  root.querySelector('[data-tab="relations"]').click(); root.querySelector('.relation-evidence').click();
  const link = root.querySelector('.github-source-link');
  assert.equal(link.href, `https://github.com/example/agent/blob/${commit}/skills/find/SKILL.md#L6`);
  assert.equal(link.rel, 'noopener noreferrer');
  app.setProject(project);
  assert.ok(root.querySelector('.github-provenance').classList.contains('hidden'));
  assert.ok(root.querySelector('.github-refresh').classList.contains('hidden'));
  root.querySelector('.object-row').click();
  assert.equal(root.querySelector('.github-source-link'), null, 'Local imports do not retain links to the previous repository');
});

test('language controls update product labels, accessibility text and saved preference', t => {
  const { root, app, window } = mount(t);
  assert.equal(app.getLocale(), 'zh');
  root.querySelector('button[data-locale="en"]').click();
  assert.equal(app.getLocale(), 'en');
  assert.equal(window.localStorage.getItem('project-map-language'), 'en');
  assert.equal(window.document.documentElement.lang, 'en');
  assert.equal(root.querySelector('button[data-locale="en"]').getAttribute('aria-pressed'), 'true');
  assert.equal(root.querySelector('button[data-locale="zh"]').getAttribute('aria-pressed'), 'false');
  assert.equal(root.querySelector('.welcome h1').textContent, 'Open your project map');
  assert.equal(root.querySelector('.welcome-github strong').textContent, 'GitHub repository');
  assert.equal(root.querySelector('[data-action="fit"]').getAttribute('aria-label'), 'Fit to canvas');
  assert.equal(root.querySelector('[data-action="fit"]').title, 'Fit to canvas');
  assert.equal(root.querySelector('.search-box input').getAttribute('aria-label'), 'Search objects');
  assert.equal(root.querySelector('.search-box input').placeholder, 'Search names, paths, descriptions…');
  assert.equal(root.querySelector('[data-action="cancel"]').textContent, 'Cancel import');
  assert.equal(root.querySelector('[data-tab="source"]').textContent, 'Source');
  assert.equal(root.querySelector('button[data-locale="zh"]').textContent, '中文', 'The language endonym remains recognizable');
  root.querySelector('button[data-locale="zh"]').click();
  assert.equal(window.localStorage.getItem('project-map-language'), 'zh');
  assert.equal(window.document.documentElement.lang, 'zh-CN');
  assert.equal(root.querySelector('.welcome h1').textContent, '打开项目地图');
  assert.equal(root.querySelector('[data-action="fit"]').getAttribute('aria-label'), '适应画布');
});

test('switching languages preserves selected evidence, search, filter and manual canvas layout', async t => {
  const { root, app, window } = mount(t);
  const imported = structuredClone(project);
  imported.meta.name = '项目名称 — unchanged';
  imported.nodes[0].name = '工具';
  imported.nodes[0].description = '指令正文 <img src="https://example.invalid/leak">';
  imported.files['skills/find/SKILL.md'] = '---\nname: 工具\ndescription: 指令正文\n---\n# 项目\n正在读取项目\n';
  imported.edges[0].evidence.text = '正在读取项目';
  const original = structuredClone(imported);
  app.setProject(imported);
  root.querySelector('.filter-chip[data-kind="skill"]').click();
  const search = root.querySelector('.search-box input');
  search.value = 'skills/find'; search.dispatchEvent(new window.Event('input'));
  root.querySelector('.object-row').click();
  root.querySelector('[data-tab="relations"]').click();
  root.querySelector('.relation-evidence').click();
  await new Promise(resolve => window.requestAnimationFrame(resolve));
  const svg = root.querySelector('.map-svg'), captures = new Set();
  svg.setPointerCapture = id => captures.add(id);
  svg.hasPointerCapture = id => captures.has(id);
  svg.releasePointerCapture = id => captures.delete(id);
  const event = (name, x, y) => new window.PointerEvent(name, { bubbles: true, pointerId: 1, button: 0, clientX: x, clientY: y });
  const node = root.querySelector('.graph-node[data-id="skill:s"]');
  node.dispatchEvent(event('pointerdown', 10, 10));
  svg.dispatchEvent(event('pointermove', 75, 45));
  svg.dispatchEvent(event('pointerup', 75, 45));
  svg.dispatchEvent(event('pointerdown', 10, 10));
  svg.dispatchEvent(event('pointermove', 45, 30));
  svg.dispatchEvent(event('pointerup', 45, 30));
  root.querySelector('[data-action="zoom-in"]').click();
  const transform = root.querySelector('.map-transform').getAttribute('transform');
  const position = node.getAttribute('transform');
  root.querySelector('.object-list').scrollTop = 37;
  root.querySelector('.inspector-body').scrollTop = 51;
  root.querySelector('.source-code').scrollTop = 28;
  root.querySelector('.source-code').scrollLeft = 44;
  for (const locale of ['en', 'zh']) {
    root.querySelector(`button[data-locale="${locale}"]`).click();
    await new Promise(resolve => window.requestAnimationFrame(resolve));
    assert.equal(root.querySelector('.project-name').textContent, '项目名称 — unchanged');
    assert.equal(root.querySelector('.inspector-title').textContent, '工具');
    assert.match(root.querySelector('.object-row.selected').textContent, /工具/);
    assert.equal(root.querySelector('.graph-node.selected').dataset.id, 'skill:s');
    assert.equal(root.querySelector('.filter-chip.active').dataset.kind, 'skill');
    assert.equal(search.value, 'skills/find');
    assert.equal(root.querySelector('.view-tabs .active').dataset.view, 'focus');
    assert.equal(root.querySelector('.inspector-tabs .active').dataset.tab, 'source');
    assert.equal(root.querySelector('.source-line.highlight .line-number').textContent, '6');
    assert.equal(root.querySelector('.source-line.highlight .line-text').textContent, '正在读取项目');
    assert.equal(root.querySelector('.evidence-quote').textContent, '正在读取项目');
    assert.equal(root.querySelector('.map-transform').getAttribute('transform'), transform);
    assert.equal(root.querySelector('.graph-node[data-id="skill:s"]').getAttribute('transform'), position);
    assert.equal(root.querySelector('.object-list').scrollTop, 37);
    assert.equal(root.querySelector('.inspector-body').scrollTop, 51);
    assert.equal(root.querySelector('.source-code').scrollTop, 28);
    assert.equal(root.querySelector('.source-code').scrollLeft, 44);
    assert.match(root.querySelector('.evidence-basis').textContent, locale === 'en' ? /Text reference/ : /文本引用/);
  }
  assert.deepEqual(imported, original, 'Language switching must not mutate imported project data');
  app.setLocale('en');
  root.querySelector('[data-tab="details"]').click();
  assert.equal(root.querySelector('.detail-description').textContent, imported.nodes[0].description);
  assert.equal(root.querySelector('.editable-list').textContent, 'Instructions');
  assert.equal(root.querySelectorAll('img').length, 0);
});

test('language changes preserve relation queries and translate active progress and backend errors', t => {
  const { root, app, window } = mount(t);
  app.setProject(project); root.querySelector('.object-row').click();
  root.querySelector('[data-tab="relations"]').click();
  const search = root.querySelector('.relation-search');
  search.value = 'search_jobs'; search.dispatchEvent(new window.Event('input'));
  app.setLocale('en');
  assert.equal(root.querySelector('.relation-search').value, 'search_jobs');
  assert.equal(root.querySelector('.relation-search').getAttribute('aria-label'), 'Search neighbors');
  assert.equal(root.querySelector('.relation-label').textContent, 'Mentions');
  app.setBusy({ message: '正在从 GitHub 读取源文件', progress: 0.4 });
  assert.equal(root.querySelector('.busy-message').textContent, 'Reading GitHub sources…');
  app.setLocale('zh');
  assert.equal(root.querySelector('.busy-message').textContent, '正在从 GitHub 读取源文件');
  assert.equal(root.querySelector('.progress-bar').style.width, '40%');
  assert.ok(!root.querySelector('.busy-overlay').classList.contains('hidden'));
  app.setError('读取 src/工具.py失败（GitHub HTTP 502）。请重试。');
  app.setLocale('en');
  assert.equal(root.querySelector('.error-message').textContent, 'Could not read src/工具.py (GitHub HTTP 502). Retry.');
  assert.ok(root.querySelector('.busy-overlay').classList.contains('hidden'));
  assert.ok(!root.querySelector('.error-banner').classList.contains('hidden'));
  assert.equal(root.querySelector('.project-name').textContent, 'Synthetic Project');
  assert.equal(root.querySelector('.relation-search').value, 'search_jobs');
});

test('GitHub dialog preserves entered repository and selected branch across language changes', async t => {
  const { root, app, window } = mount(t, {
    onGitHubInspect: async () => ({ owner: 'example', repo: 'agent', fullName: 'example/agent', defaultBranch: 'main', branches: ['main', 'feature/jobs'] }),
  });
  app.setLocale('en');
  root.querySelector('.welcome-github').click();
  assert.equal(root.querySelector('#github-dialog-title').textContent, 'Connect GitHub');
  assert.equal(root.querySelector('[data-action="close-github"]').getAttribute('aria-label'), 'Close GitHub connection');
  const input = root.querySelector('#github-url'); input.value = 'example/agent';
  root.querySelector('.github-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
  await Promise.resolve(); await Promise.resolve();
  assert.equal(root.querySelector('.github-submit').textContent, 'Connect repository');
  root.querySelector('#github-branch').value = 'feature/jobs';
  app.setLocale('zh');
  assert.equal(input.value, 'example/agent');
  assert.equal(root.querySelector('#github-branch').value, 'feature/jobs');
  assert.equal(root.querySelector('.github-submit').textContent, '连接仓库');
  assert.ok(!root.querySelector('.github-overlay').classList.contains('hidden'));
});

test('each welcome preview opens the exact demo object and source shown on its card', async t => {
  const targets = [
    ['skill', 'prepare-application', '.claude/skills/prepare-application/SKILL.md', 1],
    ['agent', 'application-reviewer', '.claude/agents/application-reviewer.md', 1],
    ['tool', 'draft_application', 'src/server.py', 18],
    ['mcp', 'career', 'src/server.py', 5],
    ['module', 'src/server', 'src/server.py', 1],
  ];
  for (const [kind, name, path, line] of targets) {
    await t.test(kind, subtest => {
      let loads = 0;
      const { root, app } = mount(subtest, {
        onDemo() {
          loads++;
          const demo = analyzeProject(getDemoFiles(app.getLocale()), { name: 'Career Agent' });
          demo.meta.isDemo = true;
          app.setProject(demo);
        },
      });
      app.setLocale('en');
      root.querySelector(`button[data-preview="${kind}"]`).click();
      assert.equal(loads, 1);
      assert.equal(root.querySelector('.inspector-title').textContent, name);
      assert.equal(root.querySelector('.source-location').textContent, `${path}:${line}`);
      assert.equal(root.querySelector('.filter-chip.active').dataset.kind, kind);
      assert.equal(root.querySelector('.graph-node.selected').dataset.kind, kind);
      assert.equal(root.querySelector('.view-tabs .active').dataset.view, 'focus');
    });
  }
});

test('only synthesized redaction markers and configuration evidence are translated', t => {
  const { root, app } = mount(t);
  const snapshot = analyzeProject([
    { path: '.mcp.json', text: '{\n  "mcpServers": {\n    "career": {\n      "command": "python",\n      "args": ["src/server.py"]\n    }\n  }\n}\n' },
    { path: 'src/example.ts', text: 'export const label = "[值已隐藏]";\n' },
  ]);
  assert.deepEqual(snapshot.meta.redactedPaths, ['.mcp.json']);
  const original = JSON.stringify(snapshot);
  app.setProject(snapshot); app.setLocale('en');
  const chooseObject = name => Array.from(root.querySelectorAll('.object-row')).find(row => row.querySelector('.object-name').textContent === name).click();
  chooseObject('.mcp.json'); root.querySelector('[data-tab="source"]').click();
  assert.match(root.querySelector('.source-code').textContent, /\[value hidden\]/);
  assert.doesNotMatch(root.querySelector('.source-code').textContent, /值已隐藏/);
  app.setLocale('zh');
  assert.match(root.querySelector('.source-code').textContent, /\[值已隐藏\]/);
  app.setLocale('en');
  root.querySelector('[data-tab="relations"]').click(); root.querySelector('.relation-evidence').click();
  assert.equal(root.querySelector('.evidence-quote').textContent, 'Configured server career (connection values hidden)');
  chooseObject('src/example.ts'); root.querySelector('[data-tab="source"]').click();
  assert.match(root.querySelector('.source-code').textContent, /export const label = "\[值已隐藏\]";/);
  assert.equal(JSON.stringify(snapshot), original, 'Presentation changes never alter the source snapshot');
});
