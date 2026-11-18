// Synthetic example. Never include the owner's job-agent source in the deployed app.
export const demoFiles = [
  { path: 'package.json', text: '{"name":"career-agent-demo","description":"A synthetic agent project for exploring the map."}\n' },
  { path: '.claude/skills/discover-jobs/SKILL.md', text: '---\nname: discover-jobs\ndescription: 搜索职位并根据偏好生成候选清单。此项目为合成示例。\n---\n# 发现职位\n使用 `search_jobs(query)` 收集候选，再使用 `rank_jobs(jobs)` 排序。\n候选清单准备好后，参考 `.claude/skills/prepare-application/SKILL.md`。\n' },
  { path: '.claude/skills/prepare-application/SKILL.md', text: '---\nname: prepare-application\ndescription: 根据职位生成申请材料草稿，交由用户检查。\n---\n# 准备申请\n使用 `draft_application(job_id)` 准备草稿。\n交给 `application-reviewer` 检查材料。\n' },
  { path: '.claude/agents/application-reviewer.md', text: '---\nname: application-reviewer\ndescription: 检查申请材料与已有事实是否一致。\ntools: mcp__career__draft_application\n---\n只检查草稿；不发送申请。\n' },
  { path: '.mcp.json', text: '{\n  "mcpServers": {\n    "career": {\n      "command": "python",\n      "args": ["src/server.py"]\n    }\n  }\n}\n' },
  { path: 'src/server.py', text: '"""Tools for the synthetic career agent."""\nfrom mcp.server.fastmcp import FastMCP\nfrom scoring import score\n\nmcp = FastMCP("career")\n\n@mcp.tool()\ndef search_jobs(query: str) -> list:\n    """根据关键词返回职位候选。"""\n    return []\n\n@mcp.tool()\ndef rank_jobs(jobs: list) -> list:\n    """根据已有规则为候选职位排序。"""\n    return sorted(jobs, key=score, reverse=True)\n\n@mcp.tool()\ndef draft_application(job_id: str) -> dict:\n    """准备申请草稿，等待用户检查。"""\n    return {"job_id": job_id, "status": "draft"}\n' },
  { path: 'src/scoring.py', text: '"""Deterministic scoring for the example."""\ndef score(job: dict) -> int:\n    return len(job.get("matched_skills", []))\n' },
  { path: 'configs/default.yaml', text: '# 合成示例的项目配置\nsearch:\n  max_results: 20\napplication:\n  review_required: true\n' },
];
