# Project Map

**用一张可操作的地图，理解 Agent 项目的能力与实现。**

[在线体验](https://witazhang.github.io/project-map/) · [English](README.md) · [演示指南](docs/demo.md) · [参与贡献](CONTRIBUTING.md) · [MIT 许可证](LICENSE)

Skill、Agent、工具、MCP 配置和实现代码往往散落在仓库各处。Project Map 把它们放到同一张画布上，让你从产品能力出发找到源文件，并核对每条关系的依据。

导入项目文件夹或 ZIP，即可在浏览器本地解析。**零 LLM 调用，无需 API key。** 名称和描述来自源码元数据、docstring 与静态字符串。

![Project Map: a concept illustration of capabilities connected to source](docs/assets/project-map-hero.svg)

**当前状态：**早期只读浏览工具，界面为中文。内置项目是合成示例。

## 本地体验

开发环境需要 **Node.js 22.12 或更新版本**和 npm。在本仓库目录运行：

```sh
git clone https://github.com/WItaZhang/project-map.git
cd project-map
npm ci
npm run dev
```

打开 **http://127.0.0.1:4173**，点击「**打开示例**」。体验示例无需准备项目、注册账号、配置模型密钥或安装 Python。

查看自己的项目时，选择「**导入项目 → 选择 ZIP 文件 / 选择项目文件夹**」，也可以直接把 ZIP 拖入应用。浏览器需要支持 ES module Web Worker；如果没有文件夹选择功能，可以使用 ZIP。

## 从能力找到实现

用内置 Career Agent 示例走完一次完整流程：

1. **从 Skill 进入。** 在左侧列表或画布选择 `discover-jobs`，地图会聚焦它的一跳邻居。
2. **核对关系。** 在「**关系**」中找到 `search_jobs`，点击「**出处**」。检查器会展示 `SKILL.md` 中对应的引用、路径和行号，并标明它来自显式声明还是正文提及。
3. **定位实现。** 选择 `search_jobs` 工具节点，进入「**源码**」，查看 `src/server.py` 中高亮的定义位置。复制相对 `路径:行号`，即可在自己的编辑器中定位。
4. **浏览周边结构。** 按名称、原始描述或路径搜索，用类型筛选缩小范围，在「**全览**」和「**聚焦**」之间切换。画布支持平移、缩放、拖动节点和适应视图。
5. **在编辑器中修改，再重新导入。** 地图反映导入时的文件快照，不会写入源码或监听文件系统。


## 能识别什么

解析依靠明确的语法和少量适配规则。识别出某个框架的文件，不代表完整支持该框架。

| 输入 | 提取的对象与关系 | 当前范围 |
| --- | --- | --- |
| `SKILL.md` | Skill 名称、描述、声明的工具，以及文档或工具引用 | YAML frontmatter 与指令中的可识别引用 |
| Agent Markdown | Agent 定义、声明或提及的工具 | `.claude/agents/*.md`、`.codex/agents/*.md`、`.github/agents/*.md`，以及部分名称匹配的 Codex TOML 适配文件 |
| Python | 模块、docstring、项目内导入、装饰器工具和可识别的 MCP 服务实例 | 静态名称的 `@receiver.tool(...)`；特定的 `Toolbox` / `@_tool(...)` 注册模式 |
| JavaScript / TypeScript | 模块、相对导入、工具注册和可识别的 MCP SDK 服务实例 | 顶层 `server.registerTool(...)`、`server.tool(...)`、导出的 `const … = tool(...)`；包含 JSX/TSX 语法解析 |
| MCP 宿主配置 | 配置节点和声明的服务条目 | `.mcp.json`、`mcp.json`、`.codex/config.toml`、`.claude/settings.json` 中的 `mcpServers` 或 `mcp_servers` |
| 项目配置 | 可定位和查看的配置源文件入口 | 根目录 `package.json`、`pyproject.toml`，以及 `config/`、`configs/`、`settings/` 直接下属的 JSON/YAML/TOML 文件 |

源码没有提供描述时，描述保持为空。应用不会生成摘要，也不会根据文件名推测产品架构。

### 每条边都有依据

关系附带源路径、行号，以及可获取的证据原文。

| 依据 | 含义 |
| --- | --- |
| 静态源码 | 源文件中存在可识别的导入、注册或实现位置。 |
| 显式声明 | 指令或配置明确列出了某个工具或服务。 |
| 文本引用 | 指令提到了另一个已识别对象，不代表实际执行。 |
| 注册适配候选 | 受支持的注册模式把候选工具关联到服务；运行配置可能只暴露其中一部分。 |

配置中的 MCP 端点与代码中的服务实例分别保留身份，同名也不会自动合并。应用不会启动或连接它们。名称有歧义、或使用不支持的动态注册时，可能不建立关系。

## 隐私与执行边界

- **本地处理。** ZIP 解压和分析在浏览器 Web Worker 中进行，文件夹通过浏览器文件选择器读取。项目内容不会上传，应用不发起模型或 MCP 请求。
- **仅保留当前会话。** 导入的项目存放在当前页面内存中，没有项目数据库、账号、云同步或持久化工作区。
- **按文本读取。** 不执行导入的代码，也不把 ZIP 内容解压到你的文件系统。
- **明确排除。** 跳过依赖、构建、数据、日志目录，以及 `.env*`、`profile.json` 和已知凭据文件。完整规则见[导入器](src/importer.js)。
- **有限脱敏。** 已识别的 MCP 宿主连接配置保留键名和行位置，隐藏值与注释。普通源码和其他配置不做通用脱敏；这些排除规则不等于密钥扫描器。
- **静态发布。** 生产构建将依赖打包为本地资源，并设置包含 `connect-src 'none'` 的内容安全策略。打开应用时仍需要从托管方加载应用资源。

安全问题的报告方式见 [SECURITY.md](SECURITY.md)。

## 已知限制

| 资源 | 上限 |
| --- | --- |
| 压缩 ZIP | 50 MiB |
| 选中的源文件数 | 2,000 |
| 单个源文件 | 1 MiB；超过则跳过 |
| 选中的文本总量 | 20 MiB |
| ZIP 目录条目 | 50,000 |

源文本和 ZIP 文件名需要 UTF-8 编码。支持普通 Store/Deflate ZIP，不支持加密、分卷和 ZIP64。ZIP 符号链接会被跳过，无效或重复的源路径会被拒绝。

全览最多绘制 36 个对象，聚焦视图展示所选对象及最多 14 个邻居，检查器保留完整关系列表。较大项目可以通过类型和搜索逐步定位。

当前不提供完整调用图、运行时轨迹、依赖注入解析、动态注册发现或可保证完整的改动影响分析。JavaScript 导入关系只解析项目内相对路径。文件变化后需要重新导入；源码编辑、实时文件监听和 GitHub 同步尚未实现。

## 开发与自行托管

```sh
npm test
npm run build
```

静态构建输出到 `dist/`。通过 HTTP(S) 提供该目录，支持站点根路径或 `/project-map/` 这样的子路径；构建资源使用相对路径。最终用户只需要浏览器，无需部署应用后端。

| 文件 | 职责 |
| --- | --- |
| [`src/importer.js`](src/importer.js) | ZIP/文件夹读取、排除规则、路径检查和资源限制 |
| [`src/analyze.js`](src/analyze.js) | 确定性提取对象和带证据的关系 |
| [`src/worker.js`](src/worker.js) | 后台解压和分析 |
| [`src/main.js`](src/main.js) | 导入生命周期、进度、取消和 UI 对接 |
| [`src/ui.js`](src/ui.js)、[`src/style.css`](src/style.css) | 画布、对象浏览器和源码检查器 |
| [`src/demo.js`](src/demo.js) | 合成示例文件 |
| [`tests/`](tests/) | 导入、解析和 DOM 行为测试 |

解析使用 Babel、Lezer Python、YAML 与 smol-toml，ZIP 处理使用 fflate。应用采用原生 JavaScript modules 和 SVG，由 esbuild 打包。

## 参与贡献

开发与提交流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。欢迎补充小范围的解析适配、可复现的关系遗漏案例、画布交互与无障碍改进。

修改解析器时，请提供最小合成样例，同时测试对象识别和证据位置。对不支持的情况明确记录，避免猜测关系。修改 UI 时，请检查空状态、导入中、已加载和导入失败状态，并验证窄屏布局。测试样例、截图和 issue 中请勿包含私人项目内容。

## 后续方向

以下是后续计划方向，当前尚未实现：

- 英文界面与本地化。
- 更多有来源证据和测试样例的注册适配与语言支持。
- 保存布局和导出地图。
- 比较项目快照，查看结构变化。

## 许可证

[MIT](LICENSE)。
