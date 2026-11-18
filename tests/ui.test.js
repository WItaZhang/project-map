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
