# Project Map walkthrough specification

The film shows how a developer can trace a capability to the source line they should inspect next. It follows the synthetic Career Agent through actual Project Map v0.3 interactions, then connects to the public Project Map repository.

| Property | Value |
| --- | --- |
| Format | MP4, 1920 × 1080, 30 fps |
| Duration | 108 seconds; 3,240 frames |
| Editing and rendering | Hyperframes 0.9.70; HTML compositions and GSAP |
| Language | Separate Chinese and English app UI, synthetic sources and guidance; no narration |
| Sound | Original 100 BPM instrumental, 4/4, 45 bars; original interface clicks |
| Product footage | Playwright recordings of the synthetic fixture and the public Project Map repository |

## Story and timing

[`shots.json`](shots.json) contains exact Chinese copy and timings. [`scripts/build-video.mjs`](scripts/build-video.mjs) selects media and generates the composition.

| Time | Scene |
| --- | --- |
| 00:00–00:06 | Introduce the question: where does this capability live? |
| 00:06–00:12 | Show the new welcome screen and open an object from its sample map |
| 00:12–00:20 | Import the synthetic project ZIP |
| 00:20–00:27 | Survey the map; drag a node, zoom, and fit the view |
| 00:27–00:33 | Select `discover-jobs` and inspect its original description |
| 00:33–00:40 | Follow the relationship to `search_jobs` |
| 00:40–00:48 | Inspect the text reference at `discover-jobs/SKILL.md:6` |
| 00:48–00:54 | Filter and search for the tool |
| 00:54–01:00 | Read the tool's original description |
| 01:00–01:09 | Inspect the definition at `src/server.py:8` and the path-copy control |
| 01:09–01:16 | Inspect MCP configuration, distinct from source server instances |
| 01:16–01:22 | Reimport the project to view the current snapshot |
| 01:22–01:34 | Connect to the real public GitHub repository, choose a branch, and show commit/refresh controls |
| 01:34–01:40 | Switch to the other interface language and back, preserving the selected GitHub source |
| 01:40–01:48 | Hold the Project Map name and GitHub URL |

## Picture, motion, and sound

The app occupies the upper 820 pixels, with a separate 260-pixel caption band. The background is `#f6f8fc`, primary text is `#263957`, and the accent is `#4d73c4`. The bundled Noto font subset uses 64-pixel titles and 44-pixel guidance at 1.2 line height; caption side margins are 192 pixels.

Real action clips establish state changes. Matching still frames hold the result while 0.6–0.65-second `power2.inOut` camera moves guide attention to the inspector, source lines, or search field. The film returns to the full workspace for the closing URL. A camera move alone does not represent a product action.

Music and clicks are locally synthesized original audio, with no sampled recordings or generated speech. See the [audio license and generation notes](assets/audio/LICENSE.md). The composition uses the AAC music copy, a soft click track, and a final music fade.

## Capture and review

For each `--lang zh` or `--lang en` edition, the capture workflow is [`scripts/capture.mjs`](scripts/capture.mjs) → [`scripts/trim-captures.mjs`](scripts/trim-captures.mjs) → [`scripts/build-video.mjs`](scripts/build-video.mjs). The capture includes GitHub and language switching. It uses a 1920 × 1080 browser viewport, 2× screenshots, and 1920 × 1080 video, saved in separate language asset directories. Reproduction commands are in [README.md](README.md).

The recordings contain only the synthetic fixture and the already-public `WItaZhang/project-map` repository. Imported source is parsed locally by Project Map. Do not include personal projects, browser tabs, credentials, invented UI, runtime execution claims, or claims that the app edits source or connects to MCP.

Before delivery, run the full Hyperframes check for each language and record the results in [REVIEW.md](REVIEW.md). Inspect scene midpoints and both sides of transitions after changes. Verify source labels, cropping, readable text, the final URL, matching state changes, duration, frame rate, and audio before replacing the release artifact.
