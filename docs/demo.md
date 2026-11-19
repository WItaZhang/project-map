# Project Map — product walkthrough

[Download the synthetic example](../examples/career-agent-demo.zip) · [中文说明](../README.zh-CN.md)

Follow one synthetic Career Agent project from import to a source definition. The bundled example contains no private project data.

![Project Map import screen](assets/project-map-welcome.png)

## Follow along

Run `npm ci` and `npm run dev`, then open http://127.0.0.1:4173.

| Step | In the app | What you learn |
| --- | --- | --- |
| 1. Import | Choose **选择 ZIP** and open `examples/career-agent-demo.zip`; alternatively choose **打开示例** | Your source becomes a local snapshot. No model key is needed. |
| 2. Survey | Select **全部** and **全览** | Skills, agents, tools, MCP instances, modules, and configuration are distinct objects. |
| 3. Choose a capability | Select `discover-jobs` | The original description and nearby objects explain where to explore next. |
| 4. Verify a relationship | Open **关系**, find `search_jobs`, and choose **出处** | The reference is a text mention in `SKILL.md`, with a precise path and line. |
| 5. Find the tool | Select **工具**, search `search_jobs`, then select it | The tool has its own declaration and source location. |
| 6. Locate the implementation | Open **源码** | `src/server.py:8` is highlighted. **复制相对路径:行** copies the relative path and line for use in your editor. |
| 7. Inspect MCP | Select **MCP**, then a `career` entry | Configuration discoveries and source server instances remain distinct. No server connection is made. |
| 8. Keep developing | Change files in your editor, then import again | The current version is a read-only snapshot. It does not write changes back. |

## 中文操作说明

围绕同一个合成求职 Agent 项目，从导入到源码定位的完整操作流程：

1. 导入 `career-agent-demo.zip`，或者先点「打开示例」。
2. 点「全部」和「全览」，查看六类对象；拖动、缩放画布。
3. 选择 `discover-jobs`，查看原始描述和一跳关系。
4. 在「关系」中找到 `search_jobs`，点「出处」，查看 Skill 中的原文依据。
5. 切到「工具」，搜索 `search_jobs`，再打开「源码」，定位 `src/server.py:8`。
6. 查看 MCP 对象，区分配置中的服务与源码中的实例。
7. 在编辑器修改项目，重新导入查看新快照。

卖点来自已经实现的功能：浏览器本地解析、零 LLM 调用、已有描述直接提取、每条关系可回到来源。当前版本不执行工具、不连接 MCP，也不修改项目。

