# Security and privacy

Project Map imports source as untrusted text. The application analyzes it in a browser worker and does not upload it, execute it, connect to MCP servers, or call an LLM. Imported project snapshots are held in memory for the page session. The development server serves app assets; it is not a project ingestion API.

The importer excludes dependency/build/data directories and common credential filenames. Recognized MCP and host configuration values are hidden in the snapshot. These controls are not a general secret detector: a secret embedded in an otherwise accepted source file can still appear in your local inspector. Review screenshots before sharing them.

ZIP imports enforce file and size limits, reject traversal paths, and skip symbolic links. They do not extract files onto disk. The production build bundles dependencies locally and sets a Content Security Policy that disables outbound connections from the app. Browser extensions, the hosting provider's access logs, and modified forks have their own behavior.

## Reporting a vulnerability

Please do not post an exploit containing private source or credentials in a public issue. Email **qianqian.zhang042@gmail.com** with a concise description, a synthetic reproduction, affected version or commit, and expected impact. We do not promise a fixed response time. Report ordinary bugs through GitHub issues.

The current `main` branch is the supported development version. This early release has not had an independent security audit.
