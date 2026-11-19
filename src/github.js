import { isAcceptedPath, normalizePath, LIMITS } from './importer.js';

const API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';
const SHA = /^[a-f0-9]{40}$/i;
const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();
const CONCURRENCY = 6;
const MAX_BRANCH_PAGES = 10;
const URL_ERROR = '请输入公开 GitHub 仓库地址，例如 https://github.com/owner/repo。分支请在下一步选择。';

/** Only repository identities are accepted; callers never supply a fetch URL. */
export function parseGitHubURL(input) {
  if (typeof input !== 'string') throw new Error(URL_ERROR);
  const value = input.trim();
  if (!value || value.length > 300 || /[\s\\?#]/.test(value)) throw new Error(URL_ERROR);
  let path = value;
  if (value.includes('://')) {
    let url;
    try { url = new URL(value); } catch { throw new Error(URL_ERROR); }
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash) throw new Error(URL_ERROR);
    if (value.split('/').some(part => part === '.' || part === '..')) throw new Error(URL_ERROR);
    path = url.pathname.slice(1);
  }
  const parts = path.replace(/\/$/, '').split('/');
  if (parts.length !== 2) throw new Error(URL_ERROR);
  const [owner, rawRepo] = parts;
  const repo = rawRepo.replace(/\.git$/i, '');
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner) || !/^[A-Za-z0-9._-]{1,100}$/.test(repo) || repo === '.' || repo === '..') throw new Error(URL_ERROR);
  return { owner, repo };
}

function checkAbort(signal) {
  if (signal?.aborted) throw new DOMException('GitHub 读取已取消', 'AbortError');
}

function validBranch(branch) {
  return typeof branch === 'string' && branch.length > 0 && branch.length <= 1024 &&
    !/[\x00-\x20\x7f~^:?*\[\\]/.test(branch) && !branch.includes('..') &&
    !branch.includes('@{') && !branch.startsWith('/') && !branch.endsWith('/') &&
    !branch.endsWith('.') && !branch.includes('//') &&
    !branch.split('/').some(part => part.startsWith('.') || part.endsWith('.lock'));
}

function identity(owner, repo) {
  const result = parseGitHubURL(`${owner}/${repo}`);
  if (result.owner !== owner || result.repo !== repo) throw new Error(URL_ERROR);
  return result;
}

function repoPath(owner, repo) {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

function responseError(response, context) {
  if (response.status === 404) return new Error('找不到仓库或分支。请检查链接；当前仅支持公开仓库，私有仓库需要 GitHub 授权。');
  if (response.status === 409) return new Error('这个仓库尚无提交或可读取的分支。');
  if (response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) {
    const reset = Number(response.headers.get('x-ratelimit-reset'));
    const after = Number.isFinite(reset) && reset > Date.now() / 1000
      ? `约 ${Math.max(1, Math.ceil((reset * 1000 - Date.now()) / 60000))} 分钟后重试。` : '请稍后重试。';
    return new Error(`GitHub 匿名请求额度已用完或请求过于频繁。${after}`);
  }
  if (response.status === 403) return new Error('GitHub 拒绝了读取请求。请确认仓库公开且可以访问，或稍后重试。');
  return new Error(`${context}失败（GitHub HTTP ${response.status}）。请重试。`);
}

async function request(url, { signal, fetchImpl, api = true, context = '读取 GitHub' }) {
  checkAbort(signal);
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer',
      redirect: 'error', signal, cache: api ? 'no-store' : 'default',
      headers: api ? { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' } : {},
    });
  } catch (error) {
    checkAbort(signal);
    if (error?.name === 'AbortError') throw error;
    throw new Error(`${context}失败。请检查网络连接后重试。`);
  }
  checkAbort(signal);
  if (!response.ok) throw responseError(response, context);
  return response;
}

async function apiJSON(path, options) {
  const response = await request(API + path, options);
  try { return { data: await response.json(), response }; }
  catch { checkAbort(options.signal); throw new Error('GitHub 返回了无法读取的数据，请稍后重试。'); }
}

/** Discover public repository metadata and branch choices, without source reads. */
export async function inspectGitHub(input, { signal, fetchImpl = fetch } = {}) {
  const { owner, repo } = parseGitHubURL(input);
  const options = { signal, fetchImpl };
  const { data: metadata } = await apiJSON(repoPath(owner, repo), options);
  if (metadata.private || metadata.visibility === 'private') throw new Error('当前仅支持公开 GitHub 仓库；私有仓库需要 GitHub 授权。');
  const canonical = parseGitHubURL(metadata.full_name || `${owner}/${repo}`);
  const base = repoPath(canonical.owner, canonical.repo);
  const branches = [];
  for (let page = 1; page <= MAX_BRANCH_PAGES; page++) {
    const { data, response } = await apiJSON(`${base}/branches?per_page=100&page=${page}`, options);
    if (!Array.isArray(data)) throw new Error('GitHub 分支列表格式无效，请重试。');
    for (const branch of data) if (validBranch(branch.name)) branches.push(branch.name);
    const hasNext = /rel="next"/.test(response.headers.get('link') || '');
    if (!hasNext) break;
    if (page === MAX_BRANCH_PAGES) throw new Error('这个仓库超过 1,000 个分支，暂时无法列出。请选择分支较少的仓库。');
  }
  if (!branches.length || !validBranch(metadata.default_branch)) throw new Error('这个仓库尚无可读取的分支。');
  return {
    ...canonical, fullName: `${canonical.owner}/${canonical.repo}`,
    defaultBranch: metadata.default_branch,
    branches: [...new Set([metadata.default_branch, ...branches])],
    htmlURL: `https://github.com/${canonical.owner}/${canonical.repo}`,
  };
}

async function readSource(response, signal, path) {
  const advertised = Number(response.headers.get('content-length'));
  if (Number.isFinite(advertised) && advertised > LIMITS.fileBytes) throw new Error(`源文件超过 1 MB：${path}`);
  let bytes;
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = []; let length = 0;
    try {
      while (true) {
        checkAbort(signal);
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > LIMITS.fileBytes) throw new Error(`源文件超过 1 MB：${path}`);
        chunks.push(value);
      }
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    finally { reader.releaseLock(); }
    bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  } else {
    bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > LIMITS.fileBytes) throw new Error(`源文件超过 1 MB：${path}`);
  }
  checkAbort(signal);
  if (bytes.includes(0)) return null;
  try { return decoder.decode(bytes).replace(/^\uFEFF/, ''); } catch { return null; }
}

/** Read a consistent cloud snapshot. Sources stay in browser memory only. */
export async function importGitHub({ owner, repo, branch }, { signal, onProgress, fetchImpl = fetch } = {}) {
  identity(owner, repo);
  if (!validBranch(branch)) throw new Error('请选择有效的 GitHub 分支。');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const options = { signal: controller.signal, fetchImpl };
  try {
    onProgress?.({ phase: '正在读取 GitHub 最新提交', done: 0, total: 0 });
    const base = repoPath(owner, repo);
    const { data: commitData } = await apiJSON(`${base}/commits/${encodeURIComponent(branch)}`, options);
    const commit = commitData.sha, treeSHA = commitData.commit?.tree?.sha;
    if (!SHA.test(commit || '') || !SHA.test(treeSHA || '')) throw new Error('GitHub 提交信息无效，无法创建一致的项目快照。');
    const { data: tree } = await apiJSON(`${base}/git/trees/${treeSHA}?recursive=1`, options);
    if (tree.truncated) throw new Error('GitHub 返回的文件目录不完整。此仓库过大，暂时无法完整读取。');
    if (!Array.isArray(tree.tree) || tree.tree.length > LIMITS.entries) throw new Error('仓库目录超过 50,000 条记录，暂时无法读取。');
    const selected = [], seen = new Set();
    let skipped = 0, expectedBytes = 0;
    for (const entry of tree.tree) {
      checkAbort(options.signal);
      if (entry.type === 'tree') continue;
      if (entry.type !== 'blob' || !['100644', '100755'].includes(entry.mode) || !isAcceptedPath(entry.path)) { skipped++; continue; }
      const path = normalizePath(entry.path);
      if (path !== entry.path || seen.has(path)) throw new Error('GitHub 返回了无效或重复的源文件路径。');
      seen.add(path);
      if (!Number.isSafeInteger(entry.size) || entry.size < 0) throw new Error('GitHub 文件大小信息无效。');
      if (entry.size > LIMITS.fileBytes) { skipped++; continue; }
      selected.push({ path, size: entry.size }); expectedBytes += entry.size;
      if (selected.length > LIMITS.files || expectedBytes > LIMITS.totalBytes) throw new Error('仓库超出解析上限：最多 2,000 个源文件、20 MB 文本。');
    }
    if (!selected.length) throw new Error('这个仓库没有可解析的源文件。支持 Skill、MCP 配置、Python 和 JS/TS 等文本。');
    const results = new Array(selected.length);
    let next = 0, done = 0, textBytes = 0;
    onProgress?.({ phase: '正在从 GitHub 读取源文件', done, total: selected.length });
    async function readNext() {
      while (true) {
        checkAbort(options.signal);
        const index = next++;
        if (index >= selected.length) return;
        const entry = selected[index];
        const url = `${RAW}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${commit}/${entry.path.split('/').map(encodeURIComponent).join('/')}`;
        const response = await request(url, { ...options, api: false, context: `读取 ${entry.path}` });
        const text = await readSource(response, options.signal, entry.path);
        if (text === null) skipped++;
        else {
          textBytes += encoder.encode(text).byteLength;
          if (textBytes > LIMITS.totalBytes) throw new Error('仓库文本超过 20 MB，已停止读取。');
          results[index] = { path: entry.path, text };
        }
        done++; onProgress?.({ phase: '正在从 GitHub 读取源文件', done, total: selected.length });
      }
    }
    const tasks = Array.from({ length: Math.min(CONCURRENCY, selected.length) }, readNext);
    try { await Promise.all(tasks); }
    catch (error) { controller.abort(); await Promise.allSettled(tasks); throw error; }
    checkAbort(options.signal);
    const files = results.filter(Boolean);
    if (!files.length) throw new Error('仓库内没有可解析的 UTF-8 文本源文件。');
    return {
      name: repo, files,
      stats: { importedFiles: files.length, textBytes, skippedFiles: skipped },
      source: { type: 'github', owner, repo, branch, commit, htmlURL: `https://github.com/${owner}/${repo}`, fetchedAt: new Date().toISOString() },
    };
  } finally { signal?.removeEventListener('abort', abort); }
}
