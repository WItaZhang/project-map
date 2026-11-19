# Project Map video walkthrough

[English video](https://github.com/WItaZhang/project-map/releases/latest/download/project-map-walkthrough-en.mp4) · [中文视频](https://github.com/WItaZhang/project-map/releases/latest/download/project-map-walkthrough-zh.mp4) · [Try Project Map](https://witazhang.github.io/project-map/) · [Follow-along guide](../docs/demo.md)

An editable **96-second, 1920 × 1080, 30 fps** Hyperframes project with separate Chinese and English editions. Both follow a synthetic Career Agent from ZIP import to `discover-jobs`, relationship evidence, and the `search_jobs` definition at `src/server.py:8`, then show a GitHub connection. The English edition adds English titles and guidance to recordings of the current Chinese app interface. Original music and interface clicks accompany both films; there is no narration.

The footage comes from real Playwright interactions with Project Map. Recorded actions are followed by still frames and guided close-ups. The local workflow uses the checked-in [synthetic example](../examples/career-agent-demo.zip); the GitHub scene shows the repository connection controls and source status. No personal project sources are included in the video.

## Reproduce the video

Use **Node.js 22.12 or newer** and npm. The included captures, font, music, and animation library are sufficient to rebuild and render without recapturing the app.

From this directory:

```sh
npm ci
npm run build:zh
npm run check
npm run render:zh
npm run teaser:zh

npm run build:en
npm run check
npm run render:en
npm run teaser:en
```

`build:zh` and `build:en` select the active language by overwriting the same HTML compositions. The render commands export the currently built composition to the corresponding filename; they do not change its language or rebuild it. Run the matching build, check, and render commands together. Plain `npm run build`, `npm run render`, and `npm run teaser` use the Chinese defaults.

The composition declares its 1920 × 1080 dimensions and derives its duration from `shots.json`. See [REVIEW.md](REVIEW.md) for the review scope and retained warnings. Recheck and review the rendered frames after editing either language.

### Capture the app again

Start Project Map from the repository root in one terminal:

```sh
npm ci
npm run dev
```

In a second terminal, from the repository root:

```sh
cd video
npm ci
npx playwright install chromium
node scripts/capture.mjs
node scripts/trim-captures.mjs
node scripts/capture-github.mjs
npm run build:zh
npm run check
npm run render:zh
```

The capture script defaults to `http://127.0.0.1:4173/`. Set `PROJECT_MAP_URL` to use another app address. If using an existing Chromium executable, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its absolute path and omit the browser installation step. These variables apply to app capture.

Capture writes screenshots, `output/raw/walkthrough.webm`, and `output/capture-report.json`. Trimming uses the installed `ffmpeg-static` binary to produce the MP4 action clips and their timing manifest. Browser timings can vary between captures; review the resulting clips and scene boundaries before rendering a new release.

Run `npm run teaser:zh` or `npm run teaser:en` after rendering to recreate the corresponding small README GIF. They read `output/project-map-walkthrough-zh.mp4` and `output/project-map-walkthrough-en.mp4`, respectively, and write `docs/assets/project-map-demo.gif` and `docs/assets/project-map-demo-en.gif`.

## Edit and preview

- [`shots.json`](shots.json) holds scene timing and Chinese copy; [`copy.en.json`](copy.en.json) holds English copy keyed by scene ID. [`SPEC.md`](SPEC.md) describes the film.
- [`scripts/build-video.mjs`](scripts/build-video.mjs) controls media selection, camera moves, caption styling, and audio placement. `--lang zh` is the default; `--lang en` merges English copy into the same shots. Running it overwrites `index.html` and the generated scene compositions. Every scene must have English copy so an English edition cannot silently contain untranslated guidance.
- [`assets/clips/manifest.json`](assets/clips/manifest.json) records the action clips; `assets/screens/` holds matching app states. Screenshots use a 1920 × 1080 viewport at 2× pixel density; recordings use 1920 × 1080.
- `captions.zh-CN.srt` and `captions.en.srt` are generated subtitle sidecars. Every build updates both from the scene timing and copy; edit the JSON sources instead of the SRT files.

From this directory, preview and inspect frames with the pinned CLI:

```sh
npx --yes hyperframes@0.9.70 preview --background
npx --yes hyperframes@0.9.70 preview --status
npx --yes hyperframes@0.9.70 snapshot --at 3,10,18,24,30,38,45,51,59,66,73,82,92
npx --yes hyperframes@0.9.70 preview --stop
```

The Hyperframes desktop app is optional. With it installed, run `npx --yes hyperframes@0.9.70 open` to open this editable project. Stop the browser preview before editing in the desktop app, and run `npx --yes hyperframes@0.9.70 catch-up` before returning to source edits.

## Assets and licenses

The original music and clicks are covered by [`assets/audio/LICENSE.md`](assets/audio/LICENSE.md). To regenerate their WAV masters, run `python3 video/scripts/generate-audio.py` from the repository root; the composition uses the distributed `music.m4a` copy. The generator uses Python's standard library and contains no third-party audio samples or speech.

The bundled Noto font subset retains its [SIL Open Font License](assets/fonts/OFL.txt). GSAP 3.15.0 retains the notice in [`assets/lib/gsap.min.js`](assets/lib/gsap.min.js) and is subject to the [GSAP standard license](https://gsap.com/standard-license). Project source and the original audio are covered by their MIT licenses.
