# Project Map

A browser workspace for exploring an agent project's modules, Skills, tools and MCP declarations. Import a ZIP or folder, navigate the map, inspect the source text and check the evidence behind each relationship.

All project parsing runs locally in the browser, in a Web Worker. The app does not upload source files, execute imported code, contact MCP servers or call an LLM. Imported projects stay in memory for the current page session.

## Run locally

Node.js 22.12+ is required for the development tools.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4173`. You can choose a project ZIP, select a folder, or open the included synthetic example. The deployed app only serves static assets; visitors do not need Node.js or Python.

## Use the workspace

1. Import a ZIP or folder. The app skips dependency, build and data directories, environment files and common credential files.
2. Search by object name, original description or source path; filter by object type.
3. Explore the canvas. Pan, zoom, move nodes, or focus on an object's immediate relationships.
4. Select a node to inspect its metadata and source lines. Select a relationship to inspect its source evidence.
5. Import the project again after changing files. This version is a read-only snapshot explorer, not a source editor or live filesystem watcher.

The example project is synthetic. No personal job-agent source or imported user project is included in the app distribution.

## Boundaries

- Metadata is extracted, not summarized. Missing descriptions stay empty.
- Declaration, text mention and static reference edges do not imply runtime execution.
- The scanner supports explicit Skill/agent frontmatter, MCP JSON/TOML configurations, and selected Python and JS/TS tool-registration patterns. Dynamic registrations may be omitted.
- ZIP uploads are limited to 50 MB compressed, 2,000 selected source files, 1 MB per source file and 20 MB of selected text. ZIP64, encrypted archives and legacy non-UTF-8 filenames are not supported.
- ZIP symbolic links are skipped. There is no extraction onto disk. Imported code is treated as text.
- A relative path from a browser import cannot automatically open a corresponding file in a local editor. The inspector provides source text, line numbers and a copyable location.
- This version does not provide accounts, cloud project storage, GitHub synchronization or AI editing.

## Check and build

```sh
npm test
npm run build
```

The self-contained static build is in `dist/`. Serve that directory over HTTP(S). The built page restricts outbound connections with a Content Security Policy and bundles its dependencies locally. The scanner and ZIP parser have synthetic tests; browser rendering still needs verification when a browser-control environment is available.

## Source layout

- `src/importer.js`: ZIP and folder reading, path checks, exclusions and resource limits.
- `src/analyze.js`: deterministic metadata and source-relationship adapters.
- `src/worker.js`: isolated background analysis.
- `src/main.js`: import lifecycle, cancellation and UI integration.
- `src/ui.js` / `src/style.css`: interactive workspace and source inspector.
- `scripts/build.mjs`: static browser bundles and HTML packaging.
