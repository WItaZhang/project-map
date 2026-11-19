# Interface design

Project Map is a workspace for exploring agent projects. The map and source controls should explain the product through use. Keep prose in the README and the collapsed analysis details.

## Skills reviewed

Reviewed on 2026-11-19 from their source instructions; no framework migration or runtime dependency was added.

| Skill | Decision | Use here |
| --- | --- | --- |
| [Anthropic frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) | Applied | Import choices beside an interactive sample map; clear hierarchy, concise actions, restrained styling. |
| [Vercel web-design-guidelines](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md) | Applied | Keyboard focus, labelled controls, language preference, small screens, readable states and reduced motion. [Current rules](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md). |
| [Impeccable](https://github.com/pbakaus/impeccable) | Reviewed for future work | Its distill, harden and polish workflows fit broader iterative design work. The first two cover this focused update. |

## Product decisions

- Put GitHub and local import beside a clickable synthetic project map. Each sample object opens its actual source object.
- Keep the three-pane workspace: objects, map, inspector. Show the whole project after import; selecting an object focuses its neighbors.
- Use short labels and state changes. Keep GitHub's repository and branch steps visible; remove repeated paragraphs.
- Show useful object metadata, source paths and evidence. Hide parser offsets and internal IDs from the inspector.
- Keep **中文 / EN** available in the top bar. Remember the choice locally; otherwise use the browser language.
- Translate product controls and generated analysis messages. Preserve imported names, descriptions, evidence quotes and code. Only synthesized redaction markers and configuration evidence are localized.
- Switching language never reruns analysis. Preserve filters, searches, selection, source position, dragged nodes, zoom and scroll.

Localization uses a small bundled dictionary and native DOM rendering. No translation service, LLM, font download or UI framework is required.
