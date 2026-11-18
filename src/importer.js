import { unzipSync } from 'fflate';

export const LIMITS = Object.freeze({ archiveBytes: 50 * 1024 * 1024, fileBytes: 1024 * 1024, totalBytes: 20 * 1024 * 1024, files: 2000, entries: 50000 });
const EXCLUDED_DIRS = new Set(['.git', '.hg', '.svn', '.venv', 'venv', 'env', 'node_modules', 'vendor', 'dist', 'build', '.next', '.nuxt', '.cache', '__pycache__', '.idea', '.vscode-test', 'data', 'logs', 'artifacts', 'coverage', '__MACOSX']);
const EXCLUDED_FILES = new Set(['profile.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'uv.lock', 'poetry.lock', 'credentials.json', 'secrets.json', 'id_rsa', 'id_ed25519', '.DS_Store']);
const SOURCE_EXT = /\.(py|js|jsx|ts|tsx|mjs|cjs|mts|cts|md|json|yaml|yml|toml)$/i;
const KNOWN_ROOTS = new Set(['src', 'lib', 'app', 'apps', 'packages', 'skills', 'agents', 'tools', 'configs', 'config', '.claude', '.codex', '.agents', 'tests', 'docs']);
const decoder = new TextDecoder('utf-8', { fatal: true });

export function normalizePath(input) {
  if (typeof input !== 'string' || !input || input.length > 1024 || /[\x00-\x1f\x7f]/.test(input)) throw new Error('项目中包含无效路径。');
  const path = input.replaceAll('\\', '/');
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) throw new Error('不支持绝对路径。请导入项目根目录内的相对路径。');
  const segments = path.split('/');
  if (segments.includes('..')) throw new Error('压缩包包含越出项目目录的路径，已停止导入。');
  const clean = segments.filter(p => p && p !== '.').join('/');
  if (!clean) throw new Error('项目中包含空路径。');
  return clean;
}

export function isAcceptedPath(path) {
  let clean;
  try { clean = normalizePath(path); } catch { return false; }
  const parts = clean.split('/');
  const base = parts.at(-1);
  return !parts.some(p => EXCLUDED_DIRS.has(p)) && !base.startsWith('.env') && !base.startsWith('._') && !EXCLUDED_FILES.has(base) && SOURCE_EXT.test(base);
}

function rootPrefix(paths, force = false) {
  if (!paths.length || paths.some(p => !p.includes('/'))) return '';
  const first = paths[0].split('/')[0];
  return paths.every(p => p.startsWith(first + '/')) && (force || !KNOWN_ROOTS.has(first)) ? first + '/' : '';
}

export function normalizeFiles(entries, { stripRoot = 'auto' } = {}) {
  const safe = entries.map(f => ({ ...f, path: normalizePath(f.path) }));
  const prefix = stripRoot === false ? '' : rootPrefix(safe.map(f => f.path), stripRoot === true);
  const seen = new Set();
  const result = [];
  let bytes = 0, skipped = 0;
  for (const item of safe) {
    const path = prefix ? item.path.slice(prefix.length) : item.path;
    if (!isAcceptedPath(path)) { skipped++; continue; }
    if (seen.has(path)) throw new Error('存在重名源文件：' + path);
    seen.add(path);
    const size = new TextEncoder().encode(item.text).byteLength;
    if (size > LIMITS.fileBytes) { skipped++; continue; }
    bytes += size;
    if (result.length >= LIMITS.files || bytes > LIMITS.totalBytes) throw new Error('项目超出解析上限：最多 2,000 个源文件、20 MB 文本。请只导入需要查看的部分。');
    result.push({ path, text: item.text });
  }
  return { files: result, stats: { importedFiles: result.length, textBytes: bytes, skippedFiles: skipped }, rootName: prefix.slice(0, -1) };
}

function decodeSource(bytes) {
  if (bytes.includes(0)) return null;
  try { return decoder.decode(bytes).replace(/^\uFEFF/, ''); } catch { return null; }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Validate ZIP metadata and limits before the decompressor allocates output. */
export function inspectZip(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.byteLength > LIMITS.archiveBytes) throw new Error('ZIP 大于 50 MB。请移除依赖、构建产物和数据目录后重试。');
  if (bytes.byteLength < 22) throw new Error('这不是完整的 ZIP 文件。');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) throw new Error('ZIP 目录损坏，无法读取。');
  const count = view.getUint16(end + 10, true), start = view.getUint32(end + 16, true), size = view.getUint32(end + 12, true);
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || count === 0xffff || start === 0xffffffff || size === 0xffffffff) throw new Error('暂不支持分卷或 ZIP64 压缩包。');
  if (count > LIMITS.entries || start + size > end) throw new Error('ZIP 目录超出大小限制或格式无效。');
  const entries = [], seen = new Set();
  let offset = start, selectedBytes = 0, selectedCount = 0, skipped = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error('ZIP 文件目录不完整。');
    const flags = view.getUint16(offset + 8, true), method = view.getUint16(offset + 10, true);
    const crc = view.getUint32(offset + 16, true), compressedSize = view.getUint32(offset + 20, true), originalSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true), extraLength = view.getUint16(offset + 30, true), commentLength = view.getUint16(offset + 32, true);
    const attrs = view.getUint32(offset + 38, true), local = view.getUint32(offset + 42, true);
    if (offset + 46 + nameLength + extraLength + commentLength > end) throw new Error('ZIP 文件路径记录损坏。');
    let rawName;
    try { rawName = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)); } catch { throw new Error('ZIP 文件名需要 UTF-8 编码。请重新压缩项目。'); }
    const path = normalizePath(rawName);
    const directory = rawName.endsWith('/'), symlink = ((attrs >>> 16) & 0xf000) === 0xa000;
    offset += 46 + nameLength + extraLength + commentLength;
    if (directory || symlink || !isAcceptedPath(path) || originalSize > LIMITS.fileBytes) { skipped++; continue; }
    if (seen.has(path)) throw new Error('ZIP 中存在重名源文件：' + path);
    seen.add(path);
    if (flags & 1) throw new Error('暂不支持加密 ZIP，请导入不带密码的项目压缩包。');
    if (![0, 8].includes(method)) throw new Error('暂只支持普通 ZIP 的 Store / Deflate 压缩方式。');
    if (compressedSize === 0xffffffff || originalSize === 0xffffffff || local + 30 > start) throw new Error('ZIP 文件大小或偏移无效。');
    if (view.getUint32(local, true) !== 0x04034b50) throw new Error('ZIP 内容记录损坏。');
    const localNameLength = view.getUint16(local + 26, true), localExtraLength = view.getUint16(local + 28, true);
    const dataStart = local + 30 + localNameLength + localExtraLength;
    if (dataStart + compressedSize > start) throw new Error('ZIP 内容长度与目录不一致。');
    const localName = decoder.decode(bytes.subarray(local + 30, local + 30 + localNameLength));
    if (localName !== rawName || view.getUint16(local + 8, true) !== method) throw new Error('ZIP 文件名或压缩方式不一致。');
    selectedCount++; selectedBytes += originalSize;
    if (selectedCount > LIMITS.files || selectedBytes > LIMITS.totalBytes) throw new Error('解压后的源文件超过上限：2,000 个文件、20 MB。请导入较小的项目部分。');
    entries.push({ rawName, path, originalSize, crc });
  }
  return { entries, skipped };
}

export function importZip(buffer, { onProgress } = {}) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const inspected = inspectZip(bytes);
  const byName = new Map(inspected.entries.map(e => [e.rawName, e]));
  onProgress?.({ phase: '正在解压源文件', done: 0, total: inspected.entries.length });
  let unzipped;
  try { unzipped = unzipSync(bytes, { filter: file => byName.has(file.name) }); } catch { throw new Error('ZIP 解压失败，文件可能损坏。'); }
  const entries = [];
  let skipped = inspected.skipped;
  for (const record of inspected.entries) {
    const content = unzipped[record.rawName];
    if (!content || content.length !== record.originalSize || crc32(content) !== record.crc) throw new Error('ZIP 文件校验失败：' + record.path);
    const text = decodeSource(content);
    if (text === null) { skipped++; continue; }
    entries.push({ path: record.path, text });
  }
  const result = normalizeFiles(entries);
  result.stats.skippedFiles += skipped;
  if (!result.files.length) throw new Error('没有找到支持的源文件。可导入 Python、JS/TS、Skill 和 MCP 配置。');
  return result;
}

/** Folder contents remain in the browser; excluded files are never read. */
export async function importFolder(fileList, { onProgress, signal } = {}) {
  const candidates = Array.from(fileList, file => ({ file, path: normalizePath(file.webkitRelativePath || file.name) }));
  const prefix = rootPrefix(candidates.map(f => f.path), true);
  let total = 0, skipped = 0;
  const accepted = candidates.filter(({ file, path }) => {
    const relative = prefix ? path.slice(prefix.length) : path;
    if (!isAcceptedPath(relative) || file.size > LIMITS.fileBytes) { skipped++; return false; }
    total += file.size;
    return true;
  });
  if (accepted.length > LIMITS.files || total > LIMITS.totalBytes) throw new Error('项目超过上限：2,000 个源文件、20 MB 文本。');
  const entries = [];
  for (let i = 0; i < accepted.length; i++) {
    if (signal?.aborted) throw new DOMException('导入已取消', 'AbortError');
    const { file, path } = accepted[i];
    const buffer = new Uint8Array(await file.arrayBuffer());
    const text = decodeSource(buffer);
    if (text === null) skipped++;
    else entries.push({ path, text });
    onProgress?.({ phase: '正在读取项目', done: i + 1, total: accepted.length });
  }
  const result = normalizeFiles(entries, { stripRoot: true });
  result.stats.skippedFiles += skipped;
  if (!result.files.length) throw new Error('所选文件夹没有可解析的源文件。');
  return result;
}
