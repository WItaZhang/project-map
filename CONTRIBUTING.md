# Contributing to Project Map

Project Map helps people navigate agent products through facts already present in their source. Useful contributions include support for another explicit tool registration pattern, clearer relationship evidence, accessible navigation, and UI translations.

## Development

Use Node.js 22.12 or later:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4173. Before sending a pull request, run:

```sh
npm test
npm run build
```

Use the built-in synthetic example for UI work. `npm run example` also produces a small ZIP in `examples/` for testing the import flow. Never commit an imported personal or company project.

## Adding a parser adapter

1. Add the smallest synthetic input demonstrating the declaration to `tests/analyze.test.js`.
2. Extend `src/analyze.js` using syntax or explicit configuration. Keep descriptions as source excerpts; missing metadata should remain empty.
3. Give each node a stable, scoped ID and an exact source location. Do not merge unrelated objects just because their display names match.
4. Every edge needs existing endpoints, a relationship type, and source evidence. A textual mention must not become a claim of runtime execution.
5. Include an ambiguous or dynamic case that stays unlinked. Imported code must never execute, and analysis must not call a model or a server.
6. Update the supported-pattern table in both READMEs when coverage changes.

## UI changes

Keep imported text out of HTML interpolation. Preserve search, keyboard access, the source inspector, and the complete relationship list even when the canvas limits visible nodes. Verify the welcome screen, ZIP import, folder import, an object selection, evidence navigation, and a narrow viewport when relevant.

The UI currently uses Chinese labels. An English UI is a welcome contribution; the English and Chinese documentation should describe the same behavior.

## Pull requests and issues

Describe the problem and the resulting behavior. Include a synthetic reproduction and the checks you ran. Screenshots help with visual changes. Keep changes focused so maintainers can review them independently.

For a missing parser pattern, attach only a minimal public example. Do not include credentials, source from a private repository, job applications, or personal data. Security issues belong in the private reporting channel described in [SECURITY.md](SECURITY.md).

Be respectful and specific in discussions. Contributions are distributed under the project's [MIT license](LICENSE).
