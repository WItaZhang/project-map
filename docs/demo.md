# Project Map — product walkthrough

[Open the live app](https://witazhang.github.io/project-map/) · [Watch the full video](https://github.com/WItaZhang/project-map/releases/download/v0.3.0/project-map-walkthrough-zh.mp4) · [Download the synthetic example](../examples/career-agent-demo.zip) · [中文说明](../README.zh-CN.md)

Follow one synthetic Career Agent project from import to a source definition. The bundled example contains no private project data.

## Watch the walkthrough

[English video](../README.md#watch-the-walkthrough) · [中文视频](../README.zh-CN.md#观看完整演示)

Both 108-second, 1080p editions show real v0.3 interactions: the clickable sample map, ZIP import, map navigation, relationship evidence, source lookup, reimport, and a direct public GitHub connection. Each uses its matching English or Chinese interface, guidance and synthetic source text. A language-switch scene shows the selected source staying in place. Both include original music, without narration.

[English MP4](https://github.com/WItaZhang/project-map/releases/download/v0.3.0/project-map-walkthrough-en.mp4) · [中文 MP4](https://github.com/WItaZhang/project-map/releases/download/v0.3.0/project-map-walkthrough-zh.mp4) · [Editable video project](../video/README.md)

![The synthetic Career Agent project in Project Map](assets/project-map-overview.png)

## Follow along

Use the [live app](https://witazhang.github.io/project-map/), or run `npm ci` and `npm run dev`, then open http://127.0.0.1:4173. Choose **EN** or **中文** in the top bar. Switching preserves your project, selection, search and map position.

| Step | In the app | What you learn |
| --- | --- | --- |
| 1. Import | Select **Choose ZIP** and open `examples/career-agent-demo.zip`; alternatively choose **Open demo** | Your source becomes a local snapshot. No model key is needed. |
| 2. Survey | Select **All** and **Overview** | Skills, agents, tools, MCP instances, modules, and configuration are distinct objects. |
| 3. Choose a capability | Select `discover-jobs` | The original description and nearby objects explain where to explore next. |
| 4. Verify a relationship | Open **Relations**, find `search_jobs`, and choose **Evidence** | The reference is a text mention in `SKILL.md`, with a precise path and line. |
| 5. Find the tool | Select **Tool**, search `search_jobs`, then select it | The tool has its own declaration and source location. |
| 6. Locate the implementation | Open **Source** | `src/server.py:8` is highlighted. **Copy path:line** copies the relative path and line for use in your editor. |
| 7. Inspect MCP | Select **MCP**, then a `career` entry | Configuration discoveries and source server instances remain distinct. No server connection is made. |
| 8. Keep developing | Change files in your editor, then import again | The current version is a read-only snapshot. It does not write changes back. |
| 9. Connect GitHub | Choose **Add project → Connect GitHub**, enter a public repository, then select a branch | The sidebar identifies the branch and commit; **Refresh from GitHub** reads its latest snapshot. |
| 10. Switch languages | Select **中文** or **EN** in the top bar | Your selected source, searches and canvas position stay in place. |

## 中文操作说明

围绕同一个合成求职 Agent 项目，体验新版首页、源码定位、GitHub 连接和中英切换：

[观看或下载完整视频](https://github.com/WItaZhang/project-map/releases/download/v0.3.0/project-map-walkthrough-zh.mp4)：108 秒真实中文界面录屏，中文屏幕说明，原创配乐，无旁白。需要调整画面或重新渲染时，查看[可编辑视频工程](../video/README.md)。

1. 点击首页示例地图中的对象，或「打开示例」；也可导入 `career-agent-demo.zip`。
2. 点「全部」和「全览」，查看六类对象；拖动、缩放画布。
3. 选择 `discover-jobs`，查看原始描述和一跳关系。
4. 在「关系」中找到 `search_jobs`，点「出处」，查看 Skill 中的原文依据。
5. 切到「工具」，搜索 `search_jobs`，再打开「源码」，定位 `src/server.py:8`。
6. 查看 MCP 对象，区分配置中的服务与源码中的实例。
7. 在编辑器修改项目，重新导入查看新快照。
8. 连接公开 GitHub 仓库，选择分支，查看 commit 和刷新入口。
9. 点击顶栏「中文 / EN」，当前选中的源码与位置保持不变。

演示涵盖浏览器本地解析、零 LLM 调用、原始描述提取，以及从关系回到来源的操作。当前版本不执行工具、不连接 MCP，也不修改项目；本地源码修改后重新导入，GitHub 项目推送后点「从 GitHub 刷新」。

