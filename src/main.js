import './style.css';
import { createApp } from './ui.js';
import { importFolder, LIMITS } from './importer.js';
import { demoFiles } from './demo.js';
import { inspectGitHub, importGitHub } from './github.js';

let sequence = 0;
let worker = null;
let reader = null;
let currentSource = null;

function stopTask() {
  sequence++;
  worker?.terminate();
  worker = null;
  reader?.abort();
  reader = null;
  return sequence;
}

function progress(message, id) {
  if (id !== sequence) return;
  const fraction = message.total ? Math.max(0, Math.min(1, message.done / message.total)) : undefined;
  ui.setBusy({ message: message.phase || '正在解析项目…', progress: fraction });
}

function analyze(payload, id, stats = {}, isDemo = false, source = null) {
  if (id !== sequence) return;
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.id !== sequence) return;
    if (data.type === 'progress') progress(data, id);
    else if (data.type === 'result') {
      worker?.terminate(); worker = null;
      if (!data.project.nodes.length) { ui.setError('没有识别到项目对象。请导入包含 Skill、MCP 配置、Python 或 JS/TS 源码的项目。'); return; }
      data.project.meta.stats = { ...data.project.meta.stats, ...stats };
      data.project.meta.isDemo = isDemo;
      data.project.meta.source = source;
      if (isDemo) data.project.meta.name = 'Career Agent · 合成示例';
      currentSource = source;
      ui.setProject(data.project);
    } else if (data.type === 'error') {
      worker?.terminate(); worker = null;
      ui.setError(data.message);
    }
  };
  worker.onerror = () => {
    if (id !== sequence) return;
    worker?.terminate(); worker = null;
    ui.setError('分析线程未能完成。请重试，或选择较小的项目部分。');
  };
  worker.postMessage({ id, ...payload }, payload.buffer ? [payload.buffer] : []);
}

async function connectGitHub(repository) {
  const id = stopTask();
  reader = new AbortController();
  ui.setBusy({ message: '正在连接 GitHub…' });
  try {
    const imported = await importGitHub(repository, {
      signal: reader.signal,
      onProgress: value => progress(value, id),
    });
    if (id !== sequence) return;
    analyze({ mode: 'files', files: imported.files, name: imported.name }, id, imported.stats, false, imported.source);
  } catch (error) {
    if (id === sequence && error.name !== 'AbortError') ui.setError(error.message);
  }
}

const ui = createApp(document.querySelector('#app'), {
  onGitHubInspect(url, options) { return inspectGitHub(url, options); },
  onGitHubConnect: connectGitHub,
  onGitHubRefresh() { if (currentSource?.type === 'github') return connectGitHub(currentSource); },
  async onZip(file) {
    const id = stopTask();
    ui.setBusy({ message: '正在读取 ZIP…' });
    try {
      if (!file || file.size > LIMITS.archiveBytes) throw new Error('请选择小于 50 MB 的项目 ZIP。');
      const buffer = await file.arrayBuffer();
      if (id !== sequence) return;
      analyze({ mode: 'zip', buffer, name: file.name.replace(/\.zip$/i, '') }, id);
    } catch (error) { if (id === sequence) ui.setError(error.message); }
  },
  async onFolder(files) {
    const id = stopTask();
    reader = new AbortController();
    ui.setBusy({ message: '正在读取文件夹…' });
    try {
      const imported = await importFolder(files, { onProgress: value => progress(value, id), signal: reader.signal });
      if (id !== sequence) return;
      analyze({ mode: 'files', files: imported.files, name: imported.rootName || 'My Project' }, id, imported.stats);
    } catch (error) { if (id === sequence && error.name !== 'AbortError') ui.setError(error.message); }
  },
  onDemo() {
    const id = stopTask();
    ui.setBusy({ message: '正在打开合成示例…' });
    analyze({ mode: 'files', files: demoFiles, name: 'Career Agent' }, id, {}, true);
  },
  onCancel() { stopTask(); ui.setIdle(); },
});
