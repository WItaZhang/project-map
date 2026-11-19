# Security and privacy

Project Map reads source as untrusted text and analyzes it in a browser worker. It does not execute source, connect to MCP servers, or call an LLM. ZIP and folder imports do not send local project contents over the network. The active project snapshot is held in page memory; there is no project database or persisted workspace. The development server serves app assets, not a project ingestion API.

Connecting or refreshing a public GitHub repository sends read-only GET requests directly from the browser to `api.github.com` and `raw.githubusercontent.com`. GitHub receives repository/file requests and the browser's network connection information. No access token is requested or stored, and no local source is uploaded. File reads are pinned to the selected branch's resolved commit so a snapshot cannot mix commits. Browser HTTP caching may retain immutable GitHub source responses. Private-repository authorization, automatic watching, and writeback are not implemented.

The importer excludes dependency/build/data directories and common credential filenames. Recognized MCP and host configuration values are hidden in the snapshot. These controls are not a general secret detector: a secret embedded in an otherwise accepted source file can still appear in your local inspector. Review screenshots before sharing them.

ZIP imports enforce file and size limits, reject traversal paths, and skip symbolic links. They do not extract files onto disk. GitHub reads apply the same source exclusions and limits before fetching content, skip symlinks/submodules, and reject truncated file trees. Failed reads do not replace the current project with a partial snapshot.

The production build bundles dependencies locally and limits data connections to the GitHub API and raw-source hosts through its Content Security Policy. GitHub's anonymous API quota applies to cloud connections; [GitHub documents the IP-based limit](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api). Browser extensions, the hosting provider's access logs, and modified forks have their own behavior.

## Reporting a vulnerability

Please do not post an exploit containing private source or credentials in a public issue. Email **qianqian.zhang042@gmail.com** with a concise description, a synthetic reproduction, affected version or commit, and expected impact. We do not promise a fixed response time. Report ordinary bugs through GitHub issues.

The current `main` branch is the supported development version. This early release has not had an independent security audit.
