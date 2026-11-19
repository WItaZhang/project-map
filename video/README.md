# Project Map video walkthrough

[Watch or download the MP4](https://github.com/WItaZhang/project-map/releases/download/v0.1.0/project-map-walkthrough-zh.mp4) · [Try Project Map](https://witazhang.github.io/project-map/) · [Follow-along guide](../docs/demo.md)

An editable **84-second, 1920 × 1080, 30 fps** Hyperframes project. Chinese on-screen guidance follows a synthetic Career Agent from ZIP import to `discover-jobs`, relationship evidence, and the `search_jobs` definition at `src/server.py:8`. Original music and interface clicks accompany the film; there is no narration.

The footage comes from real Playwright interactions with Project Map. Recorded actions are followed by still frames and guided close-ups. Only the checked-in [synthetic example](../examples/career-agent-demo.zip) is captured. Project Map parses its contents locally in the browser; no personal project sources are included in the video.

## Reproduce the video

Use **Node.js 22.12 or newer** and npm. The included captures, font, music, and animation library are sufficient to rebuild and render without recapturing the app.

From this directory:

```sh
npm ci
node scripts/build-video.mjs
npx --yes hyperframes@0.9.70 check
npx --yes hyperframes@0.9.70 render --fps 30 --quality delivery --output output/project-map-walkthrough-zh.mp4
```

The composition declares its 1920 × 1080 dimensions and 84-second duration. The recorded Hyperframes check returned **0 errors**; see [REVIEW.md](REVIEW.md) for the review scope and remaining warnings. Recheck and review the rendered frames after editing.

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
node scripts/build-video.mjs
npx --yes hyperframes@0.9.70 check
npx --yes hyperframes@0.9.70 render --fps 30 --quality delivery --output output/project-map-walkthrough-zh.mp4
```

The capture script defaults to `http://127.0.0.1:4173/`. Set `PROJECT_MAP_URL` to use another app address. If using an existing Chromium executable, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its absolute path and omit the browser installation step. These variables apply to app capture.

Capture writes screenshots, `output/raw/walkthrough.webm`, and `output/capture-report.json`. Trimming uses the installed `ffmpeg-static` binary to produce the MP4 action clips and their timing manifest. Browser timings can vary between captures; review the resulting clips and scene boundaries before rendering a new release.

Run `npm run teaser` after rendering to recreate the small README GIF.

## Edit and preview

- [`shots.json`](shots.json) holds scene timing and Chinese copy; [`SPEC.md`](SPEC.md) describes the film.
- [`scripts/build-video.mjs`](scripts/build-video.mjs) controls media selection, camera moves, caption styling, and audio placement. Running it overwrites `index.html` and the generated scene compositions.
- [`assets/clips/manifest.json`](assets/clips/manifest.json) records the action clips; `assets/screens/` holds matching app states. Screenshots use a 1920 × 1080 viewport at 2× pixel density; recordings use 1920 × 1080. The closing reimport still was extracted from the recording at 1920 × 1080.
- [`captions.zh-CN.srt`](captions.zh-CN.srt) is the subtitle sidecar. Keep it in sync when changing the on-screen copy or timing.

From this directory, preview and inspect frames with the pinned CLI:

```sh
npx --yes hyperframes@0.9.70 preview --background
npx --yes hyperframes@0.9.70 preview --status
npx --yes hyperframes@0.9.70 snapshot --at 3,10,18,24,30,38,45,51,59,66,73,80
npx --yes hyperframes@0.9.70 preview --stop
```

The Hyperframes desktop app is optional. With it installed, run `npx --yes hyperframes@0.9.70 open` to open this editable project. Stop the browser preview before editing in the desktop app, and run `npx --yes hyperframes@0.9.70 catch-up` before returning to source edits.

## Assets and licenses

The original music and clicks are covered by [`assets/audio/LICENSE.md`](assets/audio/LICENSE.md). To regenerate their WAV masters, run `python3 video/scripts/generate-audio.py` from the repository root; the composition uses the distributed `music.m4a` copy. The generator uses Python's standard library and contains no third-party audio samples or speech.

The bundled Noto font subset retains its [SIL Open Font License](assets/fonts/OFL.txt). GSAP 3.15.0 retains the notice in [`assets/lib/gsap.min.js`](assets/lib/gsap.min.js) and is subject to the [GSAP standard license](https://gsap.com/standard-license). Project source and the original audio are covered by their MIT licenses.
