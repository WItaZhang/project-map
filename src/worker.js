import { analyzeProject } from './analyze.js';
import { importZip, normalizeFiles } from './importer.js';

self.onmessage = ({ data }) => {
  const { id, mode, name, buffer, files } = data;
  const onProgress = progress => self.postMessage({ id, type: 'progress', ...progress });
  try {
    const imported = mode === 'zip' ? importZip(buffer, { onProgress }) : normalizeFiles(files, { stripRoot: false });
    onProgress({ phase: '正在解析项目对象', done: 0, total: imported.files.length });
    const project = analyzeProject(imported.files, { name: imported.rootName || name, onProgress });
    project.meta.stats = { ...project.meta.stats, ...imported.stats };
    self.postMessage({ id, type: 'result', project });
  } catch (error) {
    self.postMessage({ id, type: 'error', message: String(error?.message || '项目解析失败。') });
  }
};
