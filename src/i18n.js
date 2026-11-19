import { UI_MESSAGES } from './ui-messages.js';

const STORAGE_KEY = 'project-map-language';

export function normalizeLocale(value) {
  return /^zh/i.test(String(value || '')) ? 'zh' : 'en';
}

export function getInitialLocale() {
  try {
    const saved = (globalThis.localStorage ?? globalThis.window?.localStorage)?.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch { /* Storage can be unavailable in private or embedded contexts. */ }
  const browser = globalThis.navigator ?? globalThis.window?.navigator;
  return normalizeLocale(browser?.languages?.[0] || browser?.language || 'en');
}

export function saveLocale(locale) {
  try { (globalThis.localStorage ?? globalThis.window?.localStorage)?.setItem(STORAGE_KEY, normalizeLocale(locale)); }
  catch { /* Switching language must still work when storage is blocked. */ }
}

// These messages belong to the importer/analyzer, not to imported project text.
// Translate at the UI boundary so changing language never reruns analysis.
const MESSAGES = {
  '项目中包含无效路径。': 'The project contains an invalid path.',
  '不支持绝对路径。请导入项目根目录内的相对路径。': 'Use paths relative to the project root.',
  '压缩包包含越出项目目录的路径，已停止导入。': 'Import stopped: an archive path leaves the project directory.',
  '项目中包含空路径。': 'The project contains an empty path.',
  '项目超出解析上限：最多 2,000 个源文件、20 MB 文本。请只导入需要查看的部分。': 'Project limit: 2,000 source files or 20 MB of text. Import a smaller part.',
  'ZIP 大于 50 MB。请移除依赖、构建产物和数据目录后重试。': 'ZIP exceeds 50 MB. Remove dependencies, build output and data, then retry.',
  '这不是完整的 ZIP 文件。': 'This ZIP file is incomplete.',
  'ZIP 目录损坏，无法读取。': 'The ZIP directory is damaged.',
  '暂不支持分卷或 ZIP64 压缩包。': 'Split archives and ZIP64 are not supported.',
  'ZIP 目录超出大小限制或格式无效。': 'The ZIP directory is too large or invalid.',
  'ZIP 文件目录不完整。': 'The ZIP directory is incomplete.',
  'ZIP 文件路径记录损坏。': 'A ZIP path record is damaged.',
  'ZIP 文件名需要 UTF-8 编码。请重新压缩项目。': 'ZIP filenames must use UTF-8. Recreate the archive.',
  '暂不支持加密 ZIP，请导入不带密码的项目压缩包。': 'Password-protected ZIP files are not supported.',
  '暂只支持普通 ZIP 的 Store / Deflate 压缩方式。': 'Only Store and Deflate ZIP compression are supported.',
  'ZIP 文件大小或偏移无效。': 'The ZIP contains an invalid file size or offset.',
  'ZIP 内容记录损坏。': 'A ZIP content record is damaged.',
  'ZIP 内容长度与目录不一致。': 'ZIP content length does not match its directory.',
  'ZIP 文件名或压缩方式不一致。': 'ZIP filenames or compression methods do not match.',
  '解压后的源文件超过上限：2,000 个文件、20 MB。请导入较小的项目部分。': 'Extracted sources exceed 2,000 files or 20 MB. Import a smaller part.',
  '正在解压源文件': 'Extracting sources…',
  'ZIP 解压失败，文件可能损坏。': 'Could not extract the ZIP. The file may be damaged.',
  '没有找到支持的源文件。可导入 Python、JS/TS、Skill 和 MCP 配置。': 'No supported sources found. Import Python, JS/TS, Skills or MCP configuration.',
  '项目超过上限：2,000 个源文件、20 MB 文本。': 'Project exceeds 2,000 source files or 20 MB of text.',
  '导入已取消': 'Import cancelled',
  '正在读取项目': 'Reading project…',
  '所选文件夹没有可解析的源文件。': 'No supported source files in this folder.',
  '请输入公开 GitHub 仓库地址，例如 https://github.com/owner/repo。分支请在下一步选择。': 'Enter a public repository URL, such as https://github.com/owner/repo. Choose a branch next.',
  'GitHub 读取已取消': 'GitHub connection cancelled',
  '找不到仓库或分支。请检查链接；当前仅支持公开仓库，私有仓库需要 GitHub 授权。': 'Repository or branch not found. Check the link. Only public repositories are supported.',
  '这个仓库尚无提交或可读取的分支。': 'This repository has no commits or readable branches.',
  'GitHub 匿名请求额度已用完或请求过于频繁。请稍后重试。': 'GitHub request limit reached. Try again later.',
  'GitHub 拒绝了读取请求。请确认仓库公开且可以访问，或稍后重试。': 'GitHub denied access. Check that the repository is public, or try again later.',
  'GitHub 返回了无法读取的数据，请稍后重试。': 'GitHub returned invalid data. Try again later.',
  '当前仅支持公开 GitHub 仓库；私有仓库需要 GitHub 授权。': 'Only public GitHub repositories are supported.',
  'GitHub 分支列表格式无效，请重试。': 'GitHub returned an invalid branch list. Retry.',
  '这个仓库超过 1,000 个分支，暂时无法列出。请选择分支较少的仓库。': 'This repository exceeds the 1,000-branch limit.',
  '这个仓库尚无可读取的分支。': 'This repository has no readable branches.',
  '请选择有效的 GitHub 分支。': 'Choose a valid GitHub branch.',
  '正在读取 GitHub 最新提交': 'Reading latest GitHub commit…',
  'GitHub 提交信息无效，无法创建一致的项目快照。': 'GitHub returned invalid commit data. Could not create a consistent snapshot.',
  'GitHub 返回的文件目录不完整。此仓库过大，暂时无法完整读取。': 'GitHub returned an incomplete file tree. This repository is too large to read.',
  '仓库目录超过 50,000 条记录，暂时无法读取。': 'Repository tree exceeds 50,000 entries.',
  'GitHub 返回了无效或重复的源文件路径。': 'GitHub returned an invalid or duplicate source path.',
  'GitHub 文件大小信息无效。': 'GitHub returned an invalid file size.',
  '仓库超出解析上限：最多 2,000 个源文件、20 MB 文本。': 'Repository exceeds 2,000 source files or 20 MB of text.',
  '这个仓库没有可解析的源文件。支持 Skill、MCP 配置、Python 和 JS/TS 等文本。': 'No supported sources found. Supported formats include Skills, MCP configuration, Python and JS/TS.',
  '正在从 GitHub 读取源文件': 'Reading GitHub sources…',
  '仓库文本超过 20 MB，已停止读取。': 'Reading stopped: repository text exceeds 20 MB.',
  '仓库内没有可解析的 UTF-8 文本源文件。': 'No supported UTF-8 source files in this repository.',
  '正在解析项目对象': 'Mapping project…',
  '项目解析失败。': 'Could not analyze the project.',
  '正在解析项目…': 'Mapping project…',
  '正在解析项目': 'Mapping project',
  '读取文件…': 'Reading files…',
  '读取与解析项目文件…': 'Reading and mapping project files…',
  '没有识别到项目对象。请导入包含 Skill、MCP 配置、Python 或 JS/TS 源码的项目。': 'No project objects found. Import Skills, MCP configuration, Python or JS/TS sources.',
  'Career Agent · 合成示例': 'Career Agent · Demo',
  '分析线程未能完成。请重试，或选择较小的项目部分。': 'Analysis could not finish. Retry or import a smaller part.',
  '正在连接 GitHub…': 'Connecting to GitHub…',
  '正在读取 ZIP…': 'Reading ZIP…',
  '请选择小于 50 MB 的项目 ZIP。': 'Choose a project ZIP under 50 MB.',
  '正在读取文件夹…': 'Reading folder…',
  '正在打开合成示例…': 'Opening demo…',
  '名称与 description': 'Name and description',
  '指令正文': 'Instructions',
  '引用资源': 'Referenced resources',
  '角色指令': 'Role instructions',
  '声明的工具清单': 'Declared tools',
  '宿主入口适配': 'Host adapters',
  '函数实现': 'Function implementation',
  '参数定义': 'Parameters',
  '原始描述': 'Original description',
  '注册方式': 'Registration',
  '本地连接配置': 'Local connection settings',
  '服务定义与注册代码': 'Server definitions and registration',
  '模块实现': 'Module implementation',
  '导入关系': 'Imports',
  '配置项': 'Settings',
  '[值已隐藏]': '[value hidden]',
  '重复文件路径只保留第一份。': 'Only the first file is kept for each duplicate path.',
  '实现位于': 'Implemented in',
  '源码注册': 'Registers',
  '解析源码': 'Analyzing sources…',
  '配置已发现 · 未连接服务': 'Configured · Not connected',
  '连接配置': 'Connection configuration',
  '配置声明': 'Configures',
  '宿主适配': 'Host adapter',
  '静态导入': 'Imports',
  'Python 服务实例': 'Python server instance',
  '源码已发现 · 未连接服务': 'Source found · Not connected',
  '服务实现': 'Server implementation',
  '动态工具名称未建立节点；未把函数名猜作注册名。': 'Tools with dynamic names are omitted; function names are not assumed to be registration names.',
  '@_tool 源码声明': '@_tool declaration',
  'Toolbox 注册适配': 'Toolbox registration adapter',
  '源码候选清单；实际暴露集可能受 profile 限制': 'Source candidates; the active profile may expose fewer tools.',
  '源码注册候选': 'Registration candidate',
  'JavaScript 服务实例': 'JavaScript server instance',
  '动态工具名称未建立节点；未推断注册结果。': 'Tools with dynamic names are omitted; registration results are not inferred.',
  '指令声明可用': 'Declared tool',
  '正文提及': 'Mentions',
  '完成': 'Done',
  '名称与描述来自 frontmatter、Python docstring 和静态字符串；缺失时留空，没有生成摘要。': 'Names and descriptions come from frontmatter, Python docstrings and static strings. Missing values stay blank; no summaries are generated.',
  '支持 SKILL.md、常见 Agent 定义、MCP 配置、Python 装饰器工具及顶层 JS/TS 工具注册。': 'Supports SKILL.md, common agent definitions, MCP configuration, decorated Python tools and top-level JS/TS tool registrations.',
  '导入边只解析项目内静态路径；动态注册、运行时调用、依赖注入及完整影响范围未推断。': 'Import links use static paths within the project. Dynamic registration, runtime calls, dependency injection and full change impact are not inferred.',
  '声明可用、正文提及与源码注册均不是运行记录，也不代表宿主已实施工具权限隔离。': 'Declarations, mentions and source registrations are not execution traces or evidence of host permission enforcement.',
  '配置服务与源码实例分别标识；同名服务不自动合并。未启动或连接任何 MCP。': 'Configured servers and source instances stay separate, even when names match. No MCP server is started or connected.',
  '仅已知宿主别名且内容相同的 Skill/Agent 去重；不同位置的同名对象分别保留。': 'Only identical Skills or agents under known host aliases are deduplicated. Other objects with the same name remain separate.',
  '宿主连接配置仅保留解析出的键名，值和注释已隐藏；data、vendor、.env、profile.json 等不扫描。': 'Host connection settings retain parsed key names only; values and comments are hidden. Data, vendor, .env and profile.json are excluded.',
};

const PATTERNS = [
  [/^存在重名源文件：([\s\S]+)$/, (_, path) => `Duplicate source file: ${path}`],
  [/^ZIP 中存在重名源文件：([\s\S]+)$/, (_, path) => `Duplicate source file in ZIP: ${path}`],
  [/^ZIP 文件校验失败：([\s\S]+)$/, (_, path) => `ZIP checksum failed: ${path}`],
  [/^源文件超过 1 MB：([\s\S]+)$/, (_, path) => `Source file exceeds 1 MB: ${path}`],
  [/^GitHub 匿名请求额度已用完或请求过于频繁。约 (\d+) 分钟后重试。$/, (_, minutes) => `GitHub request limit reached. Retry in about ${minutes} ${minutes === '1' ? 'minute' : 'minutes'}.`],
  [/^读取 (GitHub|[\s\S]+)失败（GitHub HTTP (\d{3})）。请重试。$/, (_, target, status) => `Could not read ${target} (GitHub HTTP ${status}). Retry.`],
  [/^读取 (GitHub|[\s\S]+)失败。请检查网络连接后重试。$/, (_, target) => `Could not read ${target}. Check your connection and retry.`],
  [/^([\s\S]+)：语法解析未完成，未提取其工具与导入关系。$/, (_, path) => `${path}: syntax parsing failed; tools and imports were not extracted.`],
  [/^([\s\S]+)：配置解析失败；内容已隐藏，未推断服务。$/, (_, path) => `${path}: configuration parsing failed; content is hidden and no servers were inferred.`],
  [/^([\s\S]+)：frontmatter 解析失败，未生成描述。$/, (_, path) => `${path}: frontmatter parsing failed; no description was generated.`],
  [/^([\s\S]+)：未解析宿主适配元数据。$/, (_, path) => `${path}: host adapter metadata could not be parsed.`],
  [/^配置服务 ([\s\S]+)（连接值已隐藏）$/, (_, name) => `Configured server ${name} (connection values hidden)`],
];

export function translate(message, locale = 'zh', params = {}) {
  const original = String(message ?? '');
  let result = original;
  if (normalizeLocale(locale) === 'en') {
    result = Object.hasOwn(UI_MESSAGES, original) ? UI_MESSAGES[original] : Object.hasOwn(MESSAGES, original) ? MESSAGES[original] : original;
    if (result === original) {
      for (const [pattern, replacement] of PATTERNS) {
        const match = pattern.exec(original);
        if (match) { result = replacement(...match); break; }
      }
    }
  }
  return result.replace(/\{(\w+)\}/g, (token, key) => Object.hasOwn(params, key) ? String(params[key]) : token);
}
