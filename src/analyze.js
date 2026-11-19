import { parse as parseYaml } from 'yaml';
import { parse as parseToml } from 'smol-toml';
import { parser as pythonParser } from '@lezer/python';
import { parse as parseJavaScript } from '@babel/parser';

const EDITABLE = {
  skill: ['名称与 description', '指令正文', '引用资源'],
  agent: ['角色指令', '声明的工具清单', '宿主入口适配'],
  tool: ['函数实现', '参数定义', '原始描述', '注册方式'],
  mcp: ['本地连接配置', '服务定义与注册代码'],
  module: ['模块实现', '导入关系'],
  config: ['配置项'],
};
const CODE = /\.(?:py|[cm]?[jt]sx?)$/i;
const HOST = /(?:^|\/)(?:\.mcp\.json|mcp\.json|\.codex\/config\.toml|\.claude\/settings\.json)$/;
const DENIED = new Set(['.git', '.venv', 'venv', 'node_modules', 'vendor', 'data', '__pycache__', 'dist', 'build']);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const string = (v) => typeof v === 'string' ? v : '';
const kids = (node) => { const out = []; for (let c = node?.firstChild; c; c = c.nextSibling) out.push(c); return out; };
const child = (node, name) => kids(node).find((n) => n.name === name);
const content = (node, text) => node ? text.slice(node.from, node.to) : '';

function safePath(path) {
  if (typeof path !== 'string' || path.includes('\0')) return null;
  path = path.replaceAll('\\', '/').replace(/^(?:\.\/)+/, '');
  const parts = path.split('/');
  if (!path || path.startsWith('/') || /^[a-z]:/i.test(path) || parts.some((p) => !p || p === '..' || p === '.')) return null;
  if (parts.some((p) => DENIED.has(p.toLowerCase()))) return null;
  const base = parts.at(-1).toLowerCase();
  if (base === 'profile.json' || base.startsWith('.env')) return null;
  return path;
}

function normalizeRelative(path) {
  const out = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (!out.length) return null; out.pop(); } else out.push(part);
  }
  return out.join('/');
}

function sourceInfo(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  const lines = text.split(/\r?\n/);
  return { lines, line(offset) {
    let lo = 0, hi = starts.length;
    while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (starts[mid] <= offset) lo = mid; else hi = mid; }
    return lo + 1;
  } };
}

function frontmatter(text) {
  const match = /^(?:\uFEFF)?---\s*\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|$)/.exec(text);
  if (!match) return {};
  const value = parseYaml(match[1], { maxAliasCount: 0 });
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

// Only synthesized, parsed key names are retained. No original config values or
// comments are copied, including lines inside TOML multiline strings.
function redactConfig(text, parsed) {
  const keys = new Set(), tables = new Set();
  function collect(value, prefix = []) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    for (const key of Object.keys(value)) {
      keys.add(key);
      const parts = [...prefix, key];
      if (value[key] && typeof value[key] === 'object' && !Array.isArray(value[key])) {
        tables.add(parts.join('.'));
        collect(value[key], parts);
      }
    }
  }
  collect(parsed);
  return text.split('\n').map((line) => {
    if (!line.trim()) return '';
    const indent = line.match(/^\s*/)?.[0] ?? '';
    const table = /^\s*\[([\w.-]+)\]\s*(?:#.*)?$/.exec(line);
    if (table && tables.has(table[1])) return `${indent}[${table[1]}]`;
    const key = /^\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|([A-Za-z_][\w-]*))\s*[:=]/.exec(line);
    if (key) {
      let name = key[2] ?? key[3];
      if (key[1] !== undefined) { try { name = JSON.parse(`"${key[1]}"`); } catch { name = null; } }
      if (keys.has(name)) return `${indent}${JSON.stringify(name)}: [值已隐藏]`;
    }
    return `${indent}[值已隐藏]`;
  }).join('\n');
}

function pyString(raw) {
  const match = /^([rRuUbB]*)("""|'''|"|')([\s\S]*)\2$/.exec(raw);
  if (!match || /b/i.test(match[1])) return undefined;
  let value = match[3];
  if (/r/i.test(match[1])) return value;
  value = value.replace(/\\(?:\r?\n|[\\'"abfnrtv]|x[\da-fA-F]{2}|u[\da-fA-F]{4}|U[\da-fA-F]{8}|[0-7]{1,3})/g, (token) => {
    const escaped = token.slice(1);
    const simple = { '\\': '\\', "'": "'", '"': '"', a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v' };
    if (own(simple, escaped)) return simple[escaped];
    if (escaped === '\n' || escaped === '\r\n') return '';
    const number = /^[xuU]/.test(escaped) ? parseInt(escaped.slice(1), 16) : parseInt(escaped, 8);
    return number <= 0x10ffff ? String.fromCodePoint(number) : token;
  });
  return value;
}

function cleanDoc(value) {
  if (typeof value !== 'string') return '';
  const lines = value.replaceAll('\t', '        ').split('\n');
  const indents = lines.slice(1).filter((l) => l.trim()).map((l) => l.length - l.trimStart().length);
  const margin = indents.length ? Math.min(...indents) : 0;
  if (lines.length) lines[0] = lines[0].trimStart();
  for (let i = 1; i < lines.length; i++) lines[i] = lines[i].slice(margin);
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  while (lines.length && !lines[0].trim()) lines.shift();
  return lines.join('\n');
}

function pythonDoc(container, text) {
  const statement = kids(container).find((n) => ![':', 'Comment'].includes(n.name));
  if (statement?.name !== 'ExpressionStatement') return '';
  const strings = kids(statement);
  if (!strings.length || strings.some((n) => n.name !== 'String')) return '';
  const values = strings.map((n) => pyString(content(n, text)));
  return values.every((v) => v !== undefined) ? cleanDoc(values.join('')) : '';
}

function pythonArgs(argList, text, constants = new Map()) {
  const groups = [[]];
  for (const n of kids(argList)) {
    if (['(', ')', 'Comment'].includes(n.name)) continue;
    if (n.name === ',') groups.push([]); else groups.at(-1).push(n);
  }
  const positional = [], named = new Map();
  for (const group of groups.filter((g) => g.length)) {
    let name = null, nodes = group;
    if (group[0].name === 'VariableName' && group[1]?.name === 'AssignOp') { name = content(group[0], text); nodes = group.slice(2); }
    let value;
    if (nodes.length === 1 && nodes[0].name === 'String') value = pyString(content(nodes[0], text));
    if (nodes.length === 1 && nodes[0].name === 'VariableName') value = constants.get(content(nodes[0], text));
    const item = { value, node: nodes[0], raw: nodes.map((n) => content(n, text)).join('') };
    if (name !== null) named.set(name, item); else positional.push(item);
  }
  return { positional, named };
}

function pythonImports(tree, text) {
  const result = [];
  for (const node of kids(tree)) {
    if (node.name !== 'ImportStatement') continue;
    const raw = content(node, text).replace(/#[^\n]*/g, '').replace(/[()\\\r\n]/g, ' ');
    const from = /^from\s+([\w.]+)\s+import\s+([\s\S]+)$/.exec(raw.trim());
    const body = from ? from[2] : raw.replace(/^\s*import\s+/, '');
    for (const part of body.split(',')) {
      const match = /^\s*([\w.*]+)(?:\s+as\s+(\w+))?\s*$/.exec(part);
      if (!match) continue;
      result.push({ source: from ? from[1] : match[1], imported: from ? match[1] : null,
        local: match[2] || (from ? match[1] : match[1].split('.')[0]), from: node.from });
    }
  }
  return result;
}

function pythonAssignments(tree, text) {
  const assignments = new Map();
  for (const node of kids(tree)) {
    if (node.name !== 'AssignStatement') continue;
    const all = kids(node), name = all[0]?.name === 'VariableName' ? content(all[0], text) : null;
    const at = all.findIndex((n) => n.name === 'AssignOp');
    if (name && at >= 0) {
      const list = assignments.get(name) || [];
      list.push({ node, value: all[at + 1] });
      assignments.set(name, list);
    }
  }
  return assignments;
}

function decoratedFunctions(tree, text, prefix = '') {
  const out = [];
  for (const statement of kids(tree)) {
    const wrapper = statement.name === 'DecoratedStatement' ? statement : null;
    const definition = wrapper ? kids(wrapper).find((n) => ['FunctionDefinition', 'ClassDefinition'].includes(n.name)) : statement;
    if (!definition) continue;
    const name = content(child(definition, 'VariableName'), text);
    if (definition.name === 'ClassDefinition') {
      out.push(...decoratedFunctions(child(definition, 'Body'), text, `${prefix}${name}.`));
    } else if (definition.name === 'FunctionDefinition' && wrapper) {
      out.push({ node: definition, name, qualified: prefix + name, className: prefix.replace(/\.$/, ''),
        decorators: kids(wrapper).filter((n) => n.name === 'Decorator') });
    }
  }
  return out;
}

function jsStatic(node) {
  while (node && ['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'TypeCastExpression'].includes(node.type)) node = node.expression;
  if (node?.type === 'StringLiteral') return node.value;
  if (node?.type === 'TemplateLiteral' && !node.expressions.length) return node.quasis[0]?.value.cooked;
  return undefined;
}
function jsProperty(node, name) {
  if (node?.type !== 'ObjectExpression') return undefined;
  const properties = node.properties.filter((p) => p.type === 'ObjectProperty' && !p.computed && (p.key.name ?? p.key.value) === name);
  return properties.length === 1 ? properties[0].value : undefined;
}
function jsReceiver(node) {
  return node?.type === 'Identifier' ? node.name : null;
}

export function analyzeProject(input, { name = 'Project', onProgress } = {}) {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const originals = new Map(), infos = new Map(), nodes = new Map(), edges = new Map(), files = Object.create(null);
  const modules = new Map(), python = new Map(), javascript = new Map(), toolRecords = [], extraNotes = new Set();
  let skipped = 0, parseErrors = 0;
  const progress = (phase, done, total) => onProgress?.({ phase, done, total });
  for (const file of input || []) {
    const path = safePath(file.path);
    if (!path || typeof file.text !== 'string') { skipped++; continue; }
    if (originals.has(path)) { skipped++; extraNotes.add('重复文件路径只保留第一份。'); continue; }
    originals.set(path, file.text);
  }
  const paths = [...originals.keys()].sort();
  for (const path of paths) infos.set(path, sourceInfo(originals.get(path)));

  function useFile(path, text = originals.get(path)) { files[path] = text; }
  function makeNode(id, kind, nodeName, description, path, from = 0, to = from, attributes = {}) {
    const info = infos.get(path), text = originals.get(path);
    const end = Math.max(from, (text.slice(0, to).trimEnd().length || from) - 1);
    const source = { path, line: info.line(from), endLine: info.line(end) };
    const node = { id, kind, name: nodeName, description: string(description), source, sources: [source], attributes, editable: EDITABLE[kind], aliases: [] };
    nodes.set(id, node); useFile(path); return node;
  }
  function edge(from, to, type, label, path, offset = 0, basis = 'static', needle = '', customText) {
    if (from === to || !nodes.has(from) || !nodes.has(to)) return;
    const key = `${from}\0${type}\0${to}`;
    if (edges.has(key)) return;
    const info = infos.get(path), line = info.line(offset);
    let evidence = customText ?? info.lines[line - 1]?.trim() ?? '';
    if (evidence.length > 1200) {
      const at = Math.max(0, evidence.indexOf(needle));
      const start = Math.max(0, at - 180);
      evidence = `${start ? '…' : ''}${evidence.slice(start, start + 1200)}…`;
    }
    edges.set(key, { id: `edge:${edges.size + 1}`, from, to, type, label, basis, evidence: { path, line, text: evidence } });
  }
  function sourceAtLine(path, line) {
    const lines = originals.get(path).split('\n');
    return lines.slice(0, Math.max(0, line - 1)).reduce((n, s) => n + s.length + 1, 0);
  }
  function findLine(path, predicate) {
    const i = infos.get(path).lines.findIndex(predicate);
    return i < 0 ? 0 : sourceAtLine(path, i + 1);
  }
  function tool(path, fnName, displayName, description, from, to, attributes, serverId) {
    const id = `tool:${path}:${fnName}:${from}:${attributes.receiver || ''}:${displayName}`;
    const server = serverId && nodes.get(serverId);
    const n = makeNode(id, 'tool', displayName, description, path, from, to, {
      ...attributes, ...(server ? { serverId, serverName: server.name } : {}),
    });
    edge(id, modules.get(path), 'implemented-in', '实现位于', path, from);
    if (serverId) edge(serverId, id, 'registers', '源码注册', path, attributes.registrationOffset ?? from);
    toolRecords.push(n); return n;
  }

  progress('解析源码', 0, paths.length);
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i], text = originals.get(path);
    if (CODE.test(path)) {
      const id = `module:${path}`;
      modules.set(path, id);
      if (path.endsWith('.py')) {
        const tree = pythonParser.parse(text).topNode;
        const imports = pythonImports(tree, text), assignments = pythonAssignments(tree, text);
        const constants = new Map([...assignments].filter(([, a]) => a.length === 1 && a[0].value?.name === 'String').map(([n, a]) => [n, pyString(content(a[0].value, text))]));
        makeNode(id, 'module', path.replace(/\.py$/, ''), pythonDoc(tree, text), path, 0, text.length, { language: 'Python' });
        python.set(path, { tree, imports, assignments, constants, servers: new Map() });
      } else {
        makeNode(id, 'module', path, '', path, 0, text.length, { language: /\.[cm]?tsx?$/.test(path) ? 'TypeScript' : 'JavaScript' });
        try {
          const ast = parseJavaScript(text, { sourceType: 'unambiguous', plugins: ['typescript', 'jsx', 'decorators-legacy'] });
          javascript.set(path, { ast, servers: new Map() });
        } catch { parseErrors++; extraNotes.add(`${path}：语法解析未完成，未提取其工具与导入关系。`); }
      }
    }
    if (i % 25 === 0) progress('解析源码', i + 1, paths.length);
  }

  const pythonNames = new Map();
  for (const path of python.keys()) {
    const noExt = path.replace(/\.py$/, '').replace(/\/__init__$/, '');
    const variants = new Set([noExt, noExt.replace(/^src\//, '')]);
    const marker = noExt.lastIndexOf('/src/');
    if (marker >= 0) variants.add(noExt.slice(marker + 5));
    for (const variant of variants) {
      const dotted = variant.replaceAll('/', '.');
      if (!pythonNames.has(dotted)) pythonNames.set(dotted, new Set());
      pythonNames.get(dotted).add(path);
    }
  }
  function pythonModule(path, item) {
    let base;
    if (item.source.startsWith('.')) {
      const dots = item.source.match(/^\.+/)[0].length;
      const parent = path.split('/').slice(0, -1);
      if (dots > parent.length + 1) return null;
      const prefix = parent.slice(0, parent.length - dots + 1);
      base = [...prefix, ...item.source.slice(dots).split('.').filter(Boolean)].join('/');
      const candidates = item.imported && item.imported !== '*' ? [`${base}/${item.imported}`] : [];
      candidates.push(base);
      for (const candidate of candidates) for (const suffix of ['.py', '/__init__.py']) if (python.has(candidate + suffix)) return candidate + suffix;
      return null;
    }
    const candidates = item.imported && item.imported !== '*' ? [`${item.source}.${item.imported}`, item.source] : [item.source];
    for (const candidate of candidates) { const matches = pythonNames.get(candidate); if (matches?.size === 1) return [...matches][0]; }
    return null;
  }
  function jsModule(path, specifier) {
    if (!specifier.startsWith('.')) return null;
    const base = normalizeRelative(`${path.split('/').slice(0, -1).join('/')}/${specifier}`);
    if (!base) return null;
    const candidates = [base, ...['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.cts', '.cjs'].map((s) => base + s), ...['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs'].map((s) => `${base}/index${s}`)];
    if (/\.[cm]?js$/.test(base)) candidates.push(base.replace(/js$/, 'ts'), base.replace(/js$/, 'tsx'));
    return candidates.find((p) => modules.has(p)) || null;
  }

  // Configuration endpoints and source instances have separate identities. A
  // matching display name alone never proves that two servers are the same.
  for (const path of paths.filter((p) => HOST.test(p))) {
    const text = originals.get(path);
    let parsed = {};
    try { parsed = path.endsWith('.toml') ? parseToml(text) : JSON.parse(text); }
    catch { parseErrors++; extraNotes.add(`${path}：配置解析失败；内容已隐藏，未推断服务。`); }
    const config = makeNode(`config:${path}`, 'config', path, '', path);
    useFile(path, redactConfig(text, parsed));
    const servers = parsed?.mcpServers ?? parsed?.mcp_servers;
    if (!servers || typeof servers !== 'object' || Array.isArray(servers)) continue;
    for (const serverName of Object.keys(servers)) {
      const offset = findLine(path, (line) => line.includes(JSON.stringify(serverName)) || line.trim().startsWith(`[mcp_servers.${serverName}]`));
      const server = makeNode(`mcp:config:${path}:${serverName}`, 'mcp', serverName, '', path, offset, offset, {
        status: '配置已发现 · 未连接服务', origin: 'configuration', metadataSource: '连接配置', configKeys: Object.keys(servers[serverName] || {}),
      });
      useFile(path, redactConfig(text, parsed));
      edge(config.id, server.id, 'configures', '配置声明', path, offset, 'declared', '', `配置服务 ${serverName}（连接值已隐藏）`);
    }
  }

  const docs = [];
  const canonicalDocs = new Map();
  function canonicalDocument(path) {
    const alias = path.replace(/^\.agents\/skills\//, '.claude/skills/').replace(/^\.codex\/agents\//, '.claude/agents/');
    if (alias === path || !originals.has(alias)) return path;
    const text = originals.get(path), other = originals.get(alias);
    const link = normalizeRelative(`${path.split('/').slice(0, -1).join('/')}/${text.trim()}`);
    return text.replaceAll('\r\n', '\n') === other.replaceAll('\r\n', '\n') || link === alias ? alias : path;
  }
  for (const rawPath of paths) {
    const isSkill = /(?:^|\/)SKILL\.md$/.test(rawPath);
    const isAgent = /(?:^|\/)(?:\.claude|\.codex|\.github)\/agents\/[^/]+\.md$/.test(rawPath);
    if (!isSkill && !isAgent) continue;
    const path = canonicalDocument(rawPath), kind = isSkill ? 'skill' : 'agent';
    const id = `${kind}:${path}`;
    if (canonicalDocs.has(id)) { if (rawPath !== path) nodes.get(id).aliases.push(rawPath); continue; }
    let metadata = {};
    try { metadata = frontmatter(originals.get(path)); } catch { parseErrors++; extraNotes.add(`${path}：frontmatter 解析失败，未生成描述。`); }
    const fallback = isSkill ? path.split('/').at(-2) || 'SKILL' : path.split('/').at(-1).replace(/\.md$/, '');
    const attrs = {};
    for (const key of ['tools', 'allowed-tools', 'model']) if (typeof metadata[key] === 'string' || Array.isArray(metadata[key])) attrs[key] = metadata[key];
    const doc = makeNode(id, kind, string(metadata.name) || fallback, string(metadata.description), path, 0, originals.get(path).length, attrs);
    if (rawPath !== path) doc.aliases.push(rawPath);
    canonicalDocs.set(id, doc); docs.push(doc);
  }
  for (const doc of docs.filter((n) => n.kind === 'agent')) {
    const stem = doc.source.path.split('/').at(-1).replace(/\.md$/, '');
    const adapter = `.codex/agents/${stem}.toml`;
    if (originals.has(adapter)) {
      try {
        const meta = parseToml(originals.get(adapter));
        if (meta.name === doc.name) { doc.sources.push({ path: adapter, line: 1, endLine: infos.get(adapter).lines.length, role: '宿主适配' }); useFile(adapter); }
      } catch { extraNotes.add(`${adapter}：未解析宿主适配元数据。`); }
    }
    doc.aliases = [...new Set(doc.aliases)];
  }

  // Python: direct imports and statically named, single-assignment MCP instances.
  for (const [path, state] of python) {
    const text = originals.get(path);
    for (const item of state.imports) {
      const target = pythonModule(path, item);
      if (target) edge(modules.get(path), modules.get(target), 'imports', '静态导入', path, item.from);
    }
    for (const [binding, assignments] of state.assignments) {
      if (assignments.length !== 1 || assignments[0].value?.name !== 'CallExpression') continue;
      const { node, value } = assignments[0];
      const callee = kids(value).find((n) => n.name !== 'ArgList');
      const spelling = content(callee, text), imported = state.imports.find((x) => x.local === spelling);
      const recognized = imported && /^(?:fastmcp|mcp)(?:\.|$)/.test(imported.source) && ['FastMCP', 'MCPServer', 'Server'].includes(imported.imported);
      if (!recognized) continue;
      const args = pythonArgs(child(value, 'ArgList'), text, state.constants);
      const serverName = (args.named.get('name') || args.positional[0])?.value;
      if (typeof serverName !== 'string') continue;
      const server = makeNode(`mcp:source:${path}:${binding}`, 'mcp', serverName, '', path, node.from, node.to, { binding, origin: 'source', metadataSource: 'Python 服务实例', status: '源码已发现 · 未连接服务' });
      state.servers.set(binding, server.id);
      edge(server.id, modules.get(path), 'implemented-in', '服务实现', path, node.from);
    }
  }

  const tierTools = new Map();
  for (const [path, state] of python) {
    const text = originals.get(path);
    for (const fn of decoratedFunctions(state.tree, text)) {
      for (const decorator of fn.decorators) {
        const argList = child(decorator, 'ArgList');
        const prefix = text.slice(decorator.from + 1, argList?.from ?? decorator.to).trim();
        const args = pythonArgs(argList, text, state.constants);
        let displayName = fn.name, description = pythonDoc(child(fn.node, 'Body'), text), serverId, tier;
        if (prefix === '_tool' && fn.className === 'Toolbox') {
          tier = args.positional[0]?.value;
          if (!['read', 'prepare', 'commit'].includes(tier)) continue;
        } else if (/^[A-Za-z_]\w*\.tool$/.test(prefix)) {
          const nameArg = args.named.get('name') || args.positional[0];
          if (nameArg && typeof nameArg.value !== 'string') { extraNotes.add('动态工具名称未建立节点；未把函数名猜作注册名。'); continue; }
          if (nameArg) displayName = nameArg.value;
          if (args.named.has('description')) description = string(args.named.get('description').value);
          // A class body may shadow a module-level receiver. Without class
          // scope resolution, retain the tool metadata but omit that binding.
          serverId = !fn.className ? state.servers.get(prefix.split('.')[0]) : undefined;
        } else continue;
        const params = child(fn.node, 'ParamList');
        const record = tool(path, fn.qualified, displayName, description, fn.node.from, fn.node.to, {
          symbol: fn.qualified, signature: content(params, text), language: 'Python',
          receiver: tier ? '_tool' : prefix.split('.')[0], registrationOffset: decorator.from,
          ...(tier ? { tier, registry: '@_tool 源码声明' } : { registry: `@${prefix}` }),
        }, serverId);
        if (tier) { if (!tierTools.has(path)) tierTools.set(path, []); tierTools.get(path).push(record); }
      }
    }
  }

  // Explicit Toolbox adapter: require SERVER_NAME, an import of that Toolbox,
  // and add_tool in the same server module. This is a candidate registry, not a
  // claim that a runtime profile exposes every member.
  for (const [path, state] of python) {
    const serverName = state.constants.get('SERVER_NAME');
    if (typeof serverName !== 'string') continue;
    const toolbox = state.imports.filter((item) => item.imported === 'Toolbox').map((item) => pythonModule(path, item)).filter((p) => tierTools.has(p));
    if (toolbox.length !== 1) continue;
    let registration;
    function locate(node) {
      if (registration) return;
      if (node.name === 'CallExpression') {
        const head = kids(node).find((n) => n.name !== 'ArgList');
        if (/\badd_tool$/.test(content(head, originals.get(path)))) registration = node;
      }
      for (const c of kids(node)) locate(c);
    }
    locate(state.tree);
    if (!registration) continue;
    const server = makeNode(`mcp:source:${path}:Toolbox-registry`, 'mcp', serverName, pythonDoc(state.tree, originals.get(path)), path, registration.from, registration.to, {
      origin: 'source', metadataSource: 'Toolbox 注册适配', status: '源码已发现 · 未连接服务', exposure: '源码候选清单；实际暴露集可能受 profile 限制',
    });
    edge(server.id, modules.get(path), 'implemented-in', '服务实现', path, registration.from);
    for (const record of tierTools.get(toolbox[0])) {
      record.attributes.serverId = server.id; record.attributes.serverName = serverName;
      edge(server.id, record.id, 'registers', '源码注册候选', path, registration.from, 'registry-adapter');
    }
  }

  for (const [path, state] of javascript) {
    const text = originals.get(path), body = state.ast.program.body;
    const imports = body.filter((n) => n.type === 'ImportDeclaration');
    for (const declaration of imports) {
      const target = jsModule(path, declaration.source.value);
      if (target) edge(modules.get(path), modules.get(target), 'imports', '静态导入', path, declaration.start);
    }
    const declarations = body.flatMap((n) => n.type === 'ExportNamedDeclaration' ? [{ node: n.declaration, exported: true }] : [{ node: n, exported: false }]);
    const variables = declarations.filter((x) => x.node?.type === 'VariableDeclaration').flatMap((x) => x.node.declarations.map((d) => ({ declaration: d, exported: x.exported, kind: x.node.kind })));
    const bindingCounts = new Map();
    for (const { declaration } of variables) if (declaration.id.type === 'Identifier') bindingCounts.set(declaration.id.name, (bindingCounts.get(declaration.id.name) || 0) + 1);
    const reassigned = new Set();
    function findAssignments(node) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'AssignmentExpression' && node.left?.type === 'Identifier') reassigned.add(node.left.name);
      if (node.type === 'UpdateExpression' && node.argument?.type === 'Identifier') reassigned.add(node.argument.name);
      // Conservatively omit an uncertain receiver, even if a write happens in
      // a nested scope. This is a metadata index, not a control-flow analyzer.
      for (const [key, value] of Object.entries(node)) {
        if (['loc', 'extra', 'comments', 'leadingComments', 'trailingComments', 'innerComments'].includes(key)) continue;
        if (Array.isArray(value)) value.forEach(findAssignments);
        else if (value && typeof value === 'object') findAssignments(value);
      }
    }
    findAssignments(state.ast.program);
    for (const { declaration: d } of variables) {
      if (d.id.type !== 'Identifier' || bindingCounts.get(d.id.name) !== 1 || reassigned.has(d.id.name) || d.init?.type !== 'NewExpression' || d.init.callee.type !== 'Identifier') continue;
      const imported = imports.flatMap((n) => n.specifiers.map((s) => ({ declaration: n, specifier: s }))).find(({ specifier }) => specifier.local.name === d.init.callee.name);
      if (!imported || !imported.declaration.source.value.startsWith('@modelcontextprotocol/sdk/') || !['McpServer', 'Server'].includes(imported.specifier.imported?.name)) continue;
      const serverName = jsStatic(jsProperty(d.init.arguments[0], 'name'));
      if (typeof serverName !== 'string') continue;
      const server = makeNode(`mcp:source:${path}:${d.id.name}`, 'mcp', serverName, '', path, d.start, d.end, { binding: d.id.name, origin: 'source', metadataSource: 'JavaScript 服务实例', status: '源码已发现 · 未连接服务' });
      state.servers.set(d.id.name, server.id); edge(server.id, modules.get(path), 'implemented-in', '服务实现', path, d.start);
    }
    for (const statement of body) {
      const call = statement.type === 'ExpressionStatement' ? statement.expression : null;
      if (call?.type !== 'CallExpression' || call.callee.type !== 'MemberExpression' || call.callee.computed) continue;
      const method = call.callee.property.name, receiver = jsReceiver(call.callee.object);
      if (!receiver || !['registerTool', 'tool'].includes(method)) continue;
      const toolName = jsStatic(call.arguments[0]);
      if (typeof toolName !== 'string') { extraNotes.add('动态工具名称未建立节点；未推断注册结果。'); continue; }
      const description = method === 'registerTool' ? jsStatic(jsProperty(call.arguments[1], 'description')) : jsStatic(call.arguments[1]);
      tool(path, `${receiver}.${method}`, toolName, description, call.start, call.end, {
        language: /tsx?$/.test(path) ? 'TypeScript' : 'JavaScript', receiver, registry: `${receiver}.${method}`, registrationOffset: call.start,
      }, state.servers.get(receiver));
    }
    for (const { declaration: d, exported, kind } of variables) {
      if (!exported || kind !== 'const' || d.id.type !== 'Identifier' || d.init?.type !== 'CallExpression' || d.init.callee.type !== 'Identifier') continue;
      const callee = d.init.callee.name;
      const importedTool = imports.some((n) => n.specifiers.some((s) => s.type === 'ImportSpecifier' && s.local.name === callee && (s.imported.name ?? s.imported.value) === 'tool'));
      if (callee !== 'tool' && !importedTool) continue;
      const object = d.init.arguments[0];
      if (object?.type !== 'ObjectExpression') continue;
      const description = jsStatic(jsProperty(object, 'description'));
      tool(path, d.id.name, d.id.name, description, d.start, d.end, { language: 'JavaScript / TypeScript', symbol: d.id.name, registry: 'export const · tool()', receiver: callee });
    }
  }

  const byToolName = new Map();
  for (const record of toolRecords) { if (!byToolName.has(record.name)) byToolName.set(record.name, []); byToolName.get(record.name).push(record); }
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function targets(token) {
    const mcp = /^mcp__(.+?)__(.+)$/.exec(token);
    let matches = byToolName.get(mcp ? mcp[2] : token) || [];
    if (mcp) matches = matches.filter((n) => n.attributes.serverName === mcp[1]);
    return matches.length === 1 ? matches : [];
  }
  for (const doc of docs) {
    const path = doc.source.path, text = originals.get(path), lines = infos.get(path).lines;
    const declared = [doc.attributes.tools, doc.attributes['allowed-tools']].flatMap((v) => Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,\s]+/) : []).filter((v) => typeof v === 'string');
    for (const token of declared) {
      for (const target of targets(token)) {
        const offset = findLine(path, (line) => line.includes(token));
        edge(doc.id, target.id, 'declares-tool', '指令声明可用', path, offset, 'declared', token);
      }
    }
    let fenced = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*```/.test(line)) { fenced = !fenced; continue; }
      const code = fenced ? [line] : [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
      const tokens = new Set();
      for (const part of code) for (const token of part.matchAll(/[A-Za-z_]\w*(?:[-][A-Za-z_]\w*)*/g)) tokens.add(token[0]);
      for (const mcp of line.matchAll(/mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_-]+/g)) tokens.add(mcp[0]);
      for (const token of tokens) for (const target of targets(token)) {
        if (declared.some((v) => targets(v).some((n) => n.id === target.id))) continue;
        edge(doc.id, target.id, 'mentions-tool', '正文提及', path, sourceAtLine(path, i + 1), 'text-reference', token);
      }
    }
    for (const other of docs) {
      if (other.id === doc.id) continue;
      const patterns = [new RegExp(escape(other.source.path)), ...other.aliases.map((p) => new RegExp(escape(p)))];
      const n = escape(other.name);
      patterns.push(new RegExp(`(?:\\/|\\$)${n}(?![\\w-])`), new RegExp('`' + n + '`'));
      if (other.kind === 'agent' && other.name.includes('-')) patterns.push(new RegExp(`(?<![\\w-])${n}(?![\\w-])`));
      const at = lines.findIndex((line) => patterns.some((p) => p.test(line)));
      if (at >= 0) edge(doc.id, other.id, 'mentions-document', '正文提及', path, sourceAtLine(path, at + 1), 'text-reference', other.name);
    }
  }

  // Useful project config entry points, without pretending they are effective
  // runtime values or attaching them to tools by filename similarity.
  for (const path of paths) {
    if (HOST.test(path) || nodes.has(`config:${path}`)) continue;
    if (!/^(?:package\.json|pyproject\.toml|(?:configs?|settings)\/[^/]+\.(?:ya?ml|json|toml))$/.test(path)) continue;
    makeNode(`config:${path}`, 'config', path, '', path);
  }
  // A later node must never restore an original host config into the file map.
  const redactedPaths = Object.keys(files).filter((p) => HOST.test(p));
  for (const path of redactedPaths) {
    let parsed = {};
    try { parsed = path.endsWith('.toml') ? parseToml(originals.get(path)) : JSON.parse(originals.get(path)); } catch { /* redact even invalid files */ }
    files[path] = redactConfig(originals.get(path), parsed);
  }
  const counts = {};
  for (const node of nodes.values()) counts[node.kind] = (counts[node.kind] || 0) + 1;
  const ended = typeof performance !== 'undefined' ? performance.now() : Date.now();
  progress('完成', paths.length, paths.length);
  return {
    meta: { name, scannedAt: new Date().toISOString(), llmCalls: 0, counts, redactedPaths,
      notes: [
        '名称与描述来自 frontmatter、Python docstring 和静态字符串；缺失时留空，没有生成摘要。',
        '支持 SKILL.md、常见 Agent 定义、MCP 配置、Python 装饰器工具及顶层 JS/TS 工具注册。',
        '导入边只解析项目内静态路径；动态注册、运行时调用、依赖注入及完整影响范围未推断。',
        '声明可用、正文提及与源码注册均不是运行记录，也不代表宿主已实施工具权限隔离。',
        '配置服务与源码实例分别标识；同名服务不自动合并。未启动或连接任何 MCP。',
        '仅已知宿主别名且内容相同的 Skill/Agent 去重；不同位置的同名对象分别保留。',
        '宿主连接配置仅保留解析出的键名，值和注释已隐藏；data、vendor、.env、profile.json 等不扫描。',
        ...extraNotes,
      ], stats: { filesRead: Object.keys(files).length, inputFiles: paths.length, skippedFiles: skipped, edges: edges.size, parseErrors, scanMs: Math.round(ended - started) } },
    nodes: [...nodes.values()], edges: [...edges.values()], files,
  };
}
