import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createApp } from '../src/ui.js';

function mount(t, handlers = {}) {
  const window = new Window({ url: 'https://example.invalid', settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  const previous = new Map();
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator, requestAnimationFrame: window.requestAnimationFrame.bind(window), cancelAnimationFrame: window.cancelAnimationFrame.bind(window), ResizeObserver: window.ResizeObserver })) {
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
  assert.match(root.textContent, /导入你的项目/);
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
  assert.equal(root.querySelectorAll('.object-row').length, 1);
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
