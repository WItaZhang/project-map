import test from 'node:test';
import assert from 'node:assert/strict';
import { getInitialLocale, normalizeLocale, saveLocale, translate } from '../src/i18n.js';
import { demoFiles, demoFilesZH, getDemoFiles } from '../src/demo.js';
import { analyzeProject } from '../src/analyze.js';

function globals(t, values) {
  const previous = new Map();
  for (const [key, descriptor] of Object.entries(values)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
  }
  t.after(() => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
}

test('locale follows saved preference, then browser language, and tolerates blocked storage', t => {
  const stored = new Map();
  globals(t, {
    localStorage: { value: { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) } },
    navigator: { value: { languages: ['zh-Hant', 'en-US'], language: 'en-US' } },
  });
  assert.equal(getInitialLocale(), 'zh');
  saveLocale('en-GB');
  assert.equal(stored.get('project-map-language'), 'en');
  assert.equal(getInitialLocale(), 'en');
  stored.set('project-map-language', 'invalid');
  assert.equal(getInitialLocale(), 'zh');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
  assert.equal(getInitialLocale(), 'zh');
  assert.doesNotThrow(() => saveLocale('en'));
  assert.equal(normalizeLocale('zh-CN'), 'zh');
  assert.equal(normalizeLocale('de-DE'), 'en');
});

test('localized backend failures preserve paths, server names, retry times and HTTP status', () => {
  assert.equal(translate('ZIP 文件校验失败：src/工具 {name}.py', 'en'), 'ZIP checksum failed: src/工具 {name}.py');
  assert.equal(translate('读取 src/工具.py失败（GitHub HTTP 502）。请重试。', 'en'), 'Could not read src/工具.py (GitHub HTTP 502). Retry.');
  assert.equal(translate('读取 GitHub失败。请检查网络连接后重试。', 'en'), 'Could not read GitHub. Check your connection and retry.');
  assert.equal(translate('GitHub 匿名请求额度已用完或请求过于频繁。约 3 分钟后重试。', 'en'), 'GitHub request limit reached. Retry in about 3 minutes.');
  assert.equal(translate('GitHub 匿名请求额度已用完或请求过于频繁。约 1 分钟后重试。', 'en'), 'GitHub request limit reached. Retry in about 1 minute.');
  assert.equal(translate('配置服务 招聘（连接值已隐藏）', 'en'), 'Configured server 招聘 (connection values hidden)');
  assert.equal(translate('src/例子.ts：语法解析未完成，未提取其工具与导入关系。', 'en'), 'src/例子.ts: syntax parsing failed; tools and imports were not extracted.');
});

test('locale storage also works through window when no global localStorage is exposed', t => {
  const stored = new Map([['project-map-language', 'zh']]);
  globals(t, {
    localStorage: { value: undefined },
    window: { value: { localStorage: { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) } } },
  });
  assert.equal(getInitialLocale(), 'zh');
  saveLocale('en');
  assert.equal(stored.get('project-map-language'), 'en');
});

test('translation interpolates values in either language and leaves unknown messages intact', () => {
  assert.equal(translate('{count} items', 'en', { count: 3 }), '3 items');
  assert.equal(translate('{count} 个对象', 'zh', { count: 3 }), '3 个对象');
  assert.equal(translate('Unknown {path}', 'en', { path: 'src/工具.py' }), 'Unknown src/工具.py');
  assert.equal(translate('User-written description: 工具', 'en'), 'User-written description: 工具');
  assert.equal(translate('正在读取项目', 'zh'), '正在读取项目');
  assert.equal(translate('正在读取项目', 'en'), 'Reading project…');
});

test('English synthetic project preserves the same graph and source locations', () => {
  assert.equal(demoFilesZH, demoFiles);
  const english = getDemoFiles('en'), chinese = getDemoFiles('zh');
  assert.deepEqual(english.map(f => f.path), chinese.map(f => f.path));
  assert.ok(english.every(file => !/\p{Script=Han}/u.test(file.text)));
  const en = analyzeProject(english), zh = analyzeProject(chinese);
  const nodeKey = node => [node.kind, node.name, node.source.path, node.source.line];
  assert.deepEqual(en.nodes.map(nodeKey), zh.nodes.map(nodeKey));
  const edges = project => {
    const nodes = new Map(project.nodes.map(node => [node.id, nodeKey(node)]));
    return project.edges.map(edge => [nodes.get(edge.from), nodes.get(edge.to), edge.type]);
  };
  assert.deepEqual(edges(en), edges(zh));
  assert.match(en.nodes.find(n => n.name === 'discover-jobs').description, /Find jobs/);
  assert.match(zh.nodes.find(n => n.name === 'discover-jobs').description, /搜索职位/);
});
