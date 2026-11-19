import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGitHubURL, inspectGitHub, importGitHub } from '../src/github.js';
import { LIMITS } from '../src/importer.js';

const COMMIT = 'a'.repeat(40), TREE = 'b'.repeat(40);
const blob = (path, text = 'x=1', extra = {}) => ({ path, size: new TextEncoder().encode(text).length, type: 'blob', mode: '100644', sha: 'c'.repeat(40), ...extra });
const json = (body, options) => new Response(JSON.stringify(body), { ...options, headers: { 'content-type': 'application/json', ...options?.headers } });
function fixtureFetch(entries, contents = {}, options = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('/commits/')) return json({ sha: COMMIT, commit: { tree: { sha: TREE } } });
    if (url.includes('/git/trees/')) return json({ tree: entries, truncated: options.truncated || false });
    if (url.startsWith('https://raw.githubusercontent.com/')) {
      const path = decodeURIComponent(new URL(url).pathname.split('/').slice(4).join('/'));
      const content = contents[path] ?? 'x=1';
      return typeof content === 'function' ? content(init) : new Response(content);
    }
    throw Error('Unexpected endpoint: ' + url);
  };
  return { fetchImpl, calls };
}

test('GitHub links accept repository identities and reject credentials or arbitrary endpoints', () => {
  for (const value of ['owner/repo', 'https://github.com/owner/repo', 'https://github.com/owner/repo.git/']) assert.deepEqual(parseGitHubURL(value), { owner: 'owner', repo: 'repo' });
  for (const value of ['https://evil.test/owner/repo', 'http://github.com/owner/repo', 'https://token@github.com/owner/repo', 'https://github.com/owner/repo?token=x', 'https://github.com/owner/repo#x', 'https://github.com/owner/repo/tree/main', 'https://github.com/a/../owner/repo', 'owner/repo/extra', 'owner/%2e%2e', 'owner/..']) assert.throws(() => parseGitHubURL(value), /GitHub 仓库地址/);
});

test('repository inspection reads metadata and paginated branches without source files', async () => {
  const calls = [];
  const result = await inspectGitHub('owner/repo', { fetchImpl: async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/repos/owner/repo')) return json({ full_name: 'Owner/Repo', default_branch: 'main', private: false });
    if (url.endsWith('page=1')) return json([{ name: 'feature/one' }], { headers: { link: '<https://api.github.com/irrelevant>; rel="next"' } });
    return json([{ name: 'main' }, { name: 'feature/two' }]);
  } });
  assert.equal(result.fullName, 'Owner/Repo');
  assert.deepEqual(result.branches, ['main', 'feature/one', 'feature/two']);
  assert.equal(calls.length, 3);
  assert(calls.every(c => c.url.startsWith('https://api.github.com/repos/') && c.init.method === 'GET' && c.init.credentials === 'omit'));
});

test('cloud import pins accepted source reads to one commit and filters before fetching', async () => {
  const entries = [blob('src/main.py'), blob('.claude/skills/test/SKILL.md', 'name: test'), blob('.env.json'), blob('node_modules/lib/a.js'), blob('link.py', '', { mode: '120000' }), blob('submodule', '', { type: 'commit', mode: '160000' }), blob('huge.py', '', { size: LIMITS.fileBytes + 1 }), blob('binary.py', '\0')];
  const { fetchImpl, calls } = fixtureFetch(entries, { '.claude/skills/test/SKILL.md': 'name: test', 'binary.py': new Uint8Array([0, 1, 2]) });
  const progress = [];
  const result = await importGitHub({ owner: 'owner', repo: 'repo', branch: 'feature/new' }, { fetchImpl, onProgress: p => progress.push(p) });
  assert.deepEqual(result.files.map(f => f.path), ['src/main.py', '.claude/skills/test/SKILL.md']);
  assert.equal(result.source.commit, COMMIT);
  assert.equal(result.source.branch, 'feature/new');
  assert.equal(result.stats.skippedFiles, 6);
  assert(calls[0].url.endsWith('/commits/feature%2Fnew'));
  assert(calls[1].url.includes(`/git/trees/${TREE}?recursive=1`));
  const raw = calls.filter(c => c.url.startsWith('https://raw.githubusercontent.com/'));
  assert.equal(raw.length, 3);
  assert(raw.every(c => c.url.includes(`/${COMMIT}/`) && c.init.credentials === 'omit' && c.init.referrerPolicy === 'no-referrer'));
  assert(!calls.some(c => /zipball|archive|\.env|node_modules|huge\.py|link\.py/.test(c.url)));
  assert.equal(progress.at(-1).done, 3);
});

test('truncated trees and collection limits stop before any source request', async () => {
  for (const [entries, options, message] of [
    [[blob('a.py')], { truncated: true }, /不完整/],
    [Array.from({ length: LIMITS.files + 1 }, (_, i) => blob(`${i}.py`)), {}, /上限/],
    [Array.from({ length: 21 }, (_, i) => blob(`${i}.py`, '', { size: LIMITS.fileBytes })), {}, /上限/],
  ]) {
    const { fetchImpl, calls } = fixtureFetch(entries, {}, options);
    await assert.rejects(importGitHub({ owner: 'owner', repo: 'repo', branch: 'main' }, { fetchImpl }), message);
    assert.equal(calls.length, 2);
  }
});

test('GitHub cancellation and rate-limit failures remain explicit', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(importGitHub({ owner: 'owner', repo: 'repo', branch: 'main' }, { signal: controller.signal, fetchImpl: () => { throw Error('must not call'); } }), { name: 'AbortError' });
  for (const [status, headers, expected] of [[404, {}, /公开仓库/], [403, { 'x-ratelimit-remaining': '0' }, /额度/], [429, {}, /频繁/]]) {
    await assert.rejects(inspectGitHub('owner/repo', { fetchImpl: async () => json({}, { status, headers }) }), expected);
  }
});

test('a failed source fetch never returns a partial snapshot', async () => {
  const { fetchImpl } = fixtureFetch([blob('a.py'), blob('b.py')], { 'b.py': () => new Response('', { status: 500 }) });
  await assert.rejects(importGitHub({ owner: 'owner', repo: 'repo', branch: 'main' }, { fetchImpl }), /读取 b.py失败/);
});

test('actual response size is bounded even if the tree advertises a small blob', async () => {
  const { fetchImpl } = fixtureFetch([blob('large.py')], { 'large.py': new Uint8Array(LIMITS.fileBytes + 1).fill(65) });
  await assert.rejects(importGitHub({ owner: 'owner', repo: 'repo', branch: 'main' }, { fetchImpl }), /超过 1 MB/);
});
