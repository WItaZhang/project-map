import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { importZip, inspectZip, importFolder, normalizePath, normalizeFiles, LIMITS } from '../src/importer.js';

test('imports ZIP source, removes wrapper, excludes secrets and dependencies before expansion', () => {
  const zip = zipSync({
    'demo-main/src/index.ts': strToU8('export const name = "demo";'),
    'demo-main/.claude/skills/test/SKILL.md': strToU8('---\nname: test\ndescription: Original\n---'),
    'demo-main/.env': strToU8('SYNTHETIC_SECRET'),
    'demo-main/data/local/profile.json': strToU8('PRIVATE'),
    'demo-main/node_modules/library/index.js': strToU8('DEPENDENCY'),
  });
  const result = importZip(zip);
  assert.equal(result.rootName, 'demo-main');
  assert.equal(result.files.length, 2);
  assert.equal(result.files[0].path, 'src/index.ts');
  assert.equal(result.stats.skippedFiles, 3);
  assert.ok(!JSON.stringify(result).includes('SYNTHETIC_SECRET'));
});

test('retains meaningful src root and preserves source text exactly', () => {
  const text = '// 中文\nexport const n = 2;\n';
  const result = importZip(zipSync({ 'src/index.ts': strToU8(text) }));
  assert.equal(result.files[0].path, 'src/index.ts');
  assert.equal(result.files[0].text, text);
  assert.equal(normalizeFiles([{ path: 'engine/main.py', text }], { stripRoot: false }).files[0].path, 'engine/main.py');
});

test('rejects traversing paths, duplicate normalized files, and broken archives', () => {
  for (const path of ['../oops.py', '/etc/secret.py', 'C:\\private.py', 'src/../secret.py', 'a\0b.py']) assert.throws(() => normalizePath(path));
  assert.throws(() => importZip(zipSync({ '../outside.py': strToU8('bad') })), /路径/);
  assert.throws(() => normalizeFiles([{ path: 'src/x.py', text: '' }, { path: 'src//x.py', text: '' }]), /重名/);
  assert.throws(() => inspectZip(new Uint8Array([1, 2, 3])), /ZIP/);
});

test('skips oversized files and rejects oversized expanded collections', () => {
  const tooBig = new Uint8Array(LIMITS.fileBytes + 1).fill(65);
  const result = importZip(zipSync({ 'src/small.py': strToU8('x=1'), 'src/large.py': tooBig }));
  assert.equal(result.files.length, 1);
  assert.equal(result.stats.skippedFiles, 1);
  assert.throws(() => normalizeFiles(Array.from({ length: LIMITS.files + 1 }, (_, i) => ({ path: `src/${i}.py`, text: 'x=1' }))), /上限/);
});

test('skips ZIP symlinks instead of reading link targets', () => {
  const zip = zipSync({ 'repo/link.py': strToU8('../../secret.py'), 'repo/main.py': strToU8('x=1') }, { level: 0 });
  const view = new DataView(zip.buffer);
  for (let i = 0; i < zip.length - 46; i++) {
    if (view.getUint32(i, true) === 0x02014b50) { view.setUint32(i + 38, 0xa1ff0000, true); break; }
  }
  const result = importZip(zip);
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].path, 'main.py');
});

test('detects corruption of selected ZIP data', () => {
  const zip = zipSync({ 'src/index.py': strToU8('abcdef') }, { level: 0 });
  const view = new DataView(zip.buffer);
  const start = 30 + view.getUint16(26, true) + view.getUint16(28, true);
  zip[start] ^= 1;
  assert.throws(() => importZip(zip), /校验失败/);
});

test('folder import never reads excluded files and supports cancellation', async () => {
  let secretRead = false;
  const files = [
    { name: 'main.py', webkitRelativePath: 'my-project/src/main.py', size: 3, arrayBuffer: async () => strToU8('x=1').buffer },
    { name: '.env', webkitRelativePath: 'my-project/.env', size: 10, arrayBuffer: async () => { secretRead = true; throw Error('MUST NOT READ'); } },
  ];
  const imported = await importFolder(files);
  assert.equal(secretRead, false);
  assert.equal(imported.files[0].path, 'src/main.py');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(importFolder(files, { signal: controller.signal }), { name: 'AbortError' });
});
