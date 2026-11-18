import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeProject } from '../src/analyze.js';

const file = (path, text) => ({ path, text });
const ofKind = (data, kind) => data.nodes.filter((n) => n.kind === kind);
const named = (data, kind, name) => data.nodes.find((n) => n.kind === kind && n.name === name);
const connected = (data, from, to, type) => data.edges.find((e) => e.from === from.id && e.to === to.id && e.type === type);

test('YAML metadata remains source text, missing descriptions stay empty, aliases are narrow', () => {
  const original = '---\nname: fetch\ndescription: |\n  First line.\n  第二行：保留原文。\n---\nRead the source.\n';
  const data = analyzeProject([
    file('.claude/skills/fetch/SKILL.md', original),
    file('.agents/skills/fetch/SKILL.md', original),
    file('plugins/other/SKILL.md', original),
    file('skills/empty/SKILL.md', '---\nname: empty\n---\nDo work.'),
  ], { name: 'Synthetic' });
  assert.equal(data.meta.name, 'Synthetic');
  assert.equal(data.meta.llmCalls, 0);
  assert.equal(ofKind(data, 'skill').length, 3);
  const canonical = data.nodes.find((n) => n.source.path === '.claude/skills/fetch/SKILL.md');
  assert.equal(canonical.description, 'First line.\n第二行：保留原文。\n');
  assert.deepEqual(canonical.aliases, ['.agents/skills/fetch/SKILL.md']);
  assert.equal(named(data, 'skill', 'empty').description, '');
});

test('different contents in known alias paths are not merged', () => {
  const data = analyzeProject([
    file('.claude/agents/reviewer.md', '---\nname: reviewer\ndescription: Same description.\n---\nFirst instructions.'),
    file('.codex/agents/reviewer.md', '---\nname: reviewer\ndescription: Same description.\n---\nDifferent instructions.'),
  ]);
  assert.equal(ofKind(data, 'agent').length, 2);
});

test('agent aliases and adjacent host adapter preserve source locations without duplicate agents', () => {
  const body = '---\nname: reviewer\ndescription: Review a change.\ntools: [check]\n---\nUse `check`.\n';
  const data = analyzeProject([
    file('.claude/agents/reviewer.md', body),
    file('.codex/agents/reviewer.md', '../../.claude/agents/reviewer.md'),
    file('.codex/agents/reviewer.toml', 'name = "reviewer"\ndescription = "Host adapter"\n'),
  ]);
  assert.equal(ofKind(data, 'agent').length, 1);
  const agent = ofKind(data, 'agent')[0];
  assert.equal(agent.description, 'Review a change.');
  assert.ok(agent.sources.some((s) => s.path === '.codex/agents/reviewer.toml'));
});

test('Lezer reads Python decorators, original docstrings, signatures and function line numbers', () => {
  const code = [
    'from mcp.server.fastmcp import FastMCP as Server',
    'mcp = Server("weather")',
    '@mcp.tool()',
    'async def forecast(city: str, days: int = 3) -> dict:',
    '    """Forecast a place.',
    '',
    '    Preserve this exact second paragraph.',
    '    """',
    '    return {}',
    '',
    '@mcp.tool(name="temperature", description="Temperature, unedited.")',
    'def read_temp(city: str):',
    '    """A different implementation docstring."""',
    '    return 1',
  ].join('\n');
  const data = analyzeProject([file('server.py', code)]);
  const forecast = named(data, 'tool', 'forecast');
  assert.equal(forecast.description, 'Forecast a place.\n\nPreserve this exact second paragraph.');
  assert.equal(forecast.source.line, 4);
  assert.equal(forecast.source.endLine, 9);
  assert.equal(forecast.attributes.signature, '(city: str, days: int = 3)');
  assert.equal(named(data, 'tool', 'temperature').description, 'Temperature, unedited.');
  const link = connected(data, named(data, 'mcp', 'weather'), forecast, 'registers');
  assert.equal(link.evidence.line, 3);
  assert.equal(link.evidence.text, '@mcp.tool()');
});

test('Python parser does not turn strings or comments into tools', () => {
  const code = `example = '''\n@mcp.tool()\ndef fake():\n    pass\n'''\n# @mcp.tool()\ndef ordinary():\n    return 1\n`;
  const data = analyzeProject([file('sample.py', code)]);
  assert.equal(ofKind(data, 'tool').length, 0);
});

test('Toolbox registry requires explicit SERVER_NAME, Toolbox import and add_tool', () => {
  const data = analyzeProject([
    file('src/example/__init__.py', ''),
    file('src/example/tools.py', 'class Toolbox:\n    @_tool("read")\n    def get_item(self, key: str):\n        """Read one item."""\n        return key\n    @_tool("commit")\n    def save_item(self, value: str):\n        """Save one item."""\n        pass\n'),
    file('src/example/mcp_server.py', 'from .tools import Toolbox\nSERVER_NAME = "example"\ndef build(box):\n    for name in names:\n        server.add_tool(getattr(box, name), name=name)\n'),
  ]);
  assert.equal(ofKind(data, 'tool').length, 2);
  assert.equal(ofKind(data, 'mcp').length, 1);
  const server = named(data, 'mcp', 'example');
  const tool = named(data, 'tool', 'get_item');
  assert.equal(tool.attributes.tier, 'read');
  assert.equal(tool.source.line, 3);
  assert.equal(connected(data, server, tool, 'registers').basis, 'registry-adapter');
  assert.equal(connected(data, server, tool, 'registers').evidence.line, 5);
});

test('dynamic names and unknown/reassigned servers are not guessed', () => {
  const data = analyzeProject([
    file('dynamic.py', 'from fastmcp import FastMCP\nmcp = FastMCP("original")\nmcp = make_runtime_server()\n@mcp.tool(name=choose_name())\ndef dynamic_name():\n    """Not the registration name."""\n    pass\n@mcp.tool()\ndef fixed_name():\n    """Known metadata, unknown binding."""\n    pass\n'),
    file('unknown.py', '@server.tool()\ndef other():\n    """Other tool."""\n    pass\n'),
  ]);
  assert.equal(ofKind(data, 'tool').length, 2);
  assert.equal(named(data, 'tool', 'dynamic_name'), undefined);
  assert.equal(ofKind(data, 'mcp').length, 0);
  assert.equal(data.edges.filter((e) => e.type === 'registers').length, 0);
});

test('same display names in separate source/config scopes are not merged', () => {
  const code = 'from fastmcp import FastMCP\nmcp = FastMCP("shared")\n@mcp.tool()\ndef ping():\n    """Ping."""\n    pass\n';
  const data = analyzeProject([
    file('one/server.py', code), file('two/server.py', code),
    file('.mcp.json', JSON.stringify({ mcpServers: { shared: { command: 'first' } } })),
    file('mcp.json', JSON.stringify({ mcpServers: { shared: { command: 'second' } } })),
  ]);
  assert.equal(ofKind(data, 'mcp').length, 4);
  assert.equal(ofKind(data, 'tool').length, 2);
  assert.equal(new Set(ofKind(data, 'mcp').map((n) => n.id)).size, 4);
  assert.equal(data.edges.filter((e) => e.type === 'registers').length, 2);
});

test('host config values and comments cannot enter any returned snapshot; line counts survive', () => {
  const json = '{\n  "mcpServers": {\n    "search": {\n      "command": "JSON_SECRET",\n      "env": { "API_KEY": "ENV_SECRET" }\n    }\n  }\n}';
  const toml = '# COMMENT_SECRET\n[mcp_servers.search]\ncommand = "TOML_SECRET"\nargs = ["ARG_SECRET"]\n[mcp_servers.search.env]\nTOKEN = """\nMULTILINE_SECRET\n[OTHER_SECRET]\n"""\n';
  const invalid = '{"bad": "INVALID_SECRET",';
  const data = analyzeProject([file('.mcp.json', json), file('.codex/config.toml', toml), file('nested/mcp.json', invalid)]);
  const serialized = JSON.stringify(data);
  for (const value of ['JSON_SECRET', 'ENV_SECRET', 'COMMENT_SECRET', 'TOML_SECRET', 'ARG_SECRET', 'MULTILINE_SECRET', 'OTHER_SECRET', 'INVALID_SECRET']) assert.ok(!serialized.includes(value), value);
  assert.equal(data.files['.mcp.json'].split('\n').length, json.split('\n').length);
  assert.equal(data.files['.codex/config.toml'].split('\n').length, toml.split('\n').length);
  assert.ok(data.files['.codex/config.toml'].includes('TOKEN'));
  assert.equal(ofKind(data, 'mcp').length, 2);
});

test('unsafe paths and private/dependency folders are excluded before returning files', () => {
  const badPaths = ['.env', '.env.local', 'profile.json', 'data/local/config.py', 'vendor/server.py', 'node_modules/tool.py', '.git/config.py', '../server.py', '/tmp/server.py', 'C:\\private\\server.py'];
  const data = analyzeProject([...badPaths.map((p) => file(p, 'PRIVATE_SENTINEL')), file('safe.py', '"""Safe module."""\n')]);
  assert.equal(data.meta.stats.skippedFiles, badPaths.length);
  assert.ok(!JSON.stringify(data).includes('PRIVATE_SENTINEL'));
  assert.deepEqual(Object.keys(data.files), ['safe.py']);
});

test('JS/TS source registrations, named descriptions and exported tool objects are extracted', () => {
  const code = `import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';\nimport { tool as aiTool } from 'ai';\nconst server = new McpServer({name: 'catalog', version: '1'});\nserver.registerTool('lookup', {description: 'Find the original item.', inputSchema: {}}, async () => ({}));\nserver.tool('legacy', 'Legacy description.', {}, async () => ({}));\nexport const helper = aiTool({description: 'An exported helper.', parameters: {}, execute: async () => 1});\nconst privateHelper = aiTool({description: 'Private.', execute: () => 1});\nserver.registerTool(getName(), {description: 'Dynamic name'}, () => 1);\n`;
  const data = analyzeProject([file('src/server.ts', code)]);
  assert.equal(ofKind(data, 'tool').length, 3);
  assert.equal(named(data, 'tool', 'lookup').description, 'Find the original item.');
  assert.equal(named(data, 'tool', 'lookup').source.line, 4);
  assert.equal(named(data, 'tool', 'legacy').description, 'Legacy description.');
  assert.equal(named(data, 'tool', 'helper').description, 'An exported helper.');
  assert.equal(named(data, 'tool', 'privateHelper'), undefined);
  assert.equal(data.edges.filter((e) => e.type === 'registers').length, 2);
});

test('relative Python imports resolve aliased submodules and JS imports resolve source files', () => {
  const data = analyzeProject([
    file('src/pkg/__init__.py', ''), file('src/pkg/engine.py', ''), file('src/pkg/nested/__init__.py', ''),
    file('src/pkg/nested/runner.py', 'from .. import engine as engine_alias\nfrom . import helper\n'),
    file('src/pkg/nested/helper.py', ''), file('src/main.ts', "import { run } from './utils.js';\n"), file('src/utils.ts', 'export const run = () => 1;\n'),
  ]);
  const module = (path) => data.nodes.find((n) => n.kind === 'module' && n.source.path === path);
  assert.ok(connected(data, module('src/pkg/nested/runner.py'), module('src/pkg/engine.py'), 'imports'));
  assert.ok(connected(data, module('src/pkg/nested/runner.py'), module('src/pkg/nested/helper.py'), 'imports'));
  assert.ok(connected(data, module('src/main.ts'), module('src/utils.ts'), 'imports'));
});

test('reassigned JS receivers and class-scoped Python receivers do not bind to a different server', () => {
  const data = analyzeProject([
    file('server.js', "import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';\nlet server = new McpServer({name:'first', version:'1'});\nif (flag) server = createOther();\nserver.registerTool('check', {description:'Check.'}, () => 1);\n"),
    file('server.py', 'from fastmcp import FastMCP\nmcp = FastMCP("global")\nclass Service:\n    mcp = make_other()\n    @mcp.tool()\n    def check(self):\n        """Check this instance."""\n        pass\n'),
  ]);
  assert.equal(ofKind(data, 'tool').length, 2);
  assert.equal(data.edges.filter((e) => e.type === 'registers').length, 0);
});

test('tool declarations and text mentions carry exact evidence lines, ambiguous names remain unlinked', () => {
  const server = 'from fastmcp import FastMCP\nmcp = FastMCP("catalog")\n@mcp.tool()\ndef lookup():\n    """Lookup."""\n    pass\n';
  const data = analyzeProject([
    file('server.py', server),
    file('.claude/agents/reviewer.md', '---\nname: reviewer\ntools: mcp__catalog__lookup\n---\nUse `lookup`.\n'),
    file('skills/search/SKILL.md', '---\nname: search\n---\nCall `lookup` here.\n'),
  ]);
  const target = named(data, 'tool', 'lookup');
  const declared = connected(data, named(data, 'agent', 'reviewer'), target, 'declares-tool');
  assert.equal(declared.evidence.line, 3);
  assert.equal(declared.evidence.text, 'tools: mcp__catalog__lookup');
  const mentioned = connected(data, named(data, 'skill', 'search'), target, 'mentions-tool');
  assert.equal(mentioned.evidence.line, 4);
  assert.equal(mentioned.evidence.text, 'Call `lookup` here.');
  const ambiguous = analyzeProject([file('a.py', server), file('b.py', server), file('skills/search/SKILL.md', 'Use `lookup`.')]);
  assert.equal(ambiguous.edges.filter((e) => e.type === 'mentions-tool').length, 0);
});

test('all edges have existing endpoints and progress reporting reaches completion', () => {
  const events = [];
  const data = analyzeProject([file('one.py', '"""One."""')], { onProgress: (event) => events.push(event) });
  const ids = new Set(data.nodes.map((n) => n.id));
  assert.ok(data.edges.every((e) => ids.has(e.from) && ids.has(e.to)));
  assert.equal(events.at(-1).phase, '完成');
  assert.equal(events.at(-1).done, 1);
});
