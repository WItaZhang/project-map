# Delivery review

Reviewed on 2026-11-19 for the v0.3 video refresh. Deliveries are `project-map-walkthrough-zh.mp4` and `project-map-walkthrough-en.mp4`, each **108 seconds, 1920 × 1080, 30 fps and 3,240 frames**, across 15 scenes.

Each edition uses its corresponding Chinese or English product interface, synthetic source text and on-screen guidance. The language scene briefly switches to the other interface language and back. The GitHub footage reads the public Project Map repository at app revision `d1a4e728bcdc1931b8e91b8721a568f431bd0f4d`.

## Creative decisions

The film follows one capability through the actual product: sample map → import → overview → Skill → relationship evidence → search → tool → source → MCP configuration → reimport → GitHub connection → language switching. It extends the existing complete walkthrough rather than adopting the reverse reveal or growing-map alternatives in [STORYLINES.md](STORYLINES.md).

All product imagery comes from real Playwright interactions with the synthetic Career Agent and the already-public Project Map repository. Each action is recorded separately at its original speed. Transcoding resets timestamps and encodes at 30 fps; it retains the complete recorded action, without speed-up or tail trimming. Camera moves enlarge the actual captures and do not imply additional product behavior.

The visual treatment retains the separate caption band, direct cuts, 0.6–0.65-second camera moves, 64-pixel titles and 44-pixel guidance. Original instrumental music runs for 45 bars at 100 BPM, with soft interface clicks. No invented UI, stock montage, narration, runtime trace or private project appears.

## Checks completed

- Both language captures passed: matching UI and synthetic fixture, exact sample-map target, ZIP import with 13 objects, full overview, node dragging, zoom/fit, Skill selection, evidence at `SKILL.md:6`, tool search, original descriptions, source definition at `src/server.py:8`, distinct MCP identities and reimport.
- Both captures exercised a real public GitHub connection and branch selection, a commit-pinned source link, language switching with the selected source and revision preserved, and a separate refresh check. The reports contain no page errors or archive/clone requests.
- Both final Chinese and English Hyperframes full checks passed with zero errors and three reviewed lint warnings. Runtime, layout, motion, contrast, craft and audio checks passed.
- Separate Playwright checks passed for both languages: app loading, real folder import with 13 objects and three tools, and 390-pixel sidebar/inspector navigation. There were no page errors.
- The v0.3 app baseline previously passed 52 tests and its production build. This video-only update does not claim a new app test run.
- The rendered mixes both measure −20.3 LUFS integrated, −10.3 dBTP, and zero clipped samples. The short silence intervals (0–0.41s and 107.23–108.01s) correspond to fades. Audio was measured, **not listened to**; subjective music and mix quality were not auditioned.

Evidence is retained in the ignored `output/` directory: per-language capture reports, per-action raw recordings, clip manifests and media QA, Hyperframes checks, review sheets and close-ups.

## Visual review

Both editions were inspected through their complete beat sheets, 360-pixel phone sheets, all 14 seam strips per language, and detailed source/evidence/GitHub/language close-ups. A second reviewer found no remaining P0/P1 defects after the language-hold correction. The source path, highlighted code line and relationship evidence remain consistent across cuts, and captions stay outside the app viewport.

One P1 was corrected: the alternate interface language originally held for only 950 ms. Both language actions were recaptured with a 2,200 ms wait, giving measured alternate-language holds of 2.330 seconds (English edition) and 2.335 seconds (Chinese edition). The complete clips remain under five seconds. A second reviewer confirmed the English correction at 94.3, 95.3, 96.3, 97.3 and 98.5 seconds, with the same selected source and framing, clean adjacent cuts, and no remaining P0/P1 in the revised scene. All other 24 action clips remained byte-identical.

The full-map establishing shots remain the weakest at phone width: small UI labels provide context while the captions and subsequent close-ups carry the explanation. A separate vertical edit would benefit from framing individual panes. The current delivery keeps the landscape desktop walkthrough requested here.

The app is read-only. Reimport shows the same synthetic fixture; the film does not claim to perform an external code edit, compare snapshots or connect to an MCP service. Its final URL is `github.com/WItaZhang/project-map`.

## Warnings kept deliberately

- `timeline_track_too_dense`: the caption composition has 15 sequential groups in one caption host. They do not overlap, and each scene's text remains editable.
- `nested_media_start_basis_ambiguous`, welcome: the recording begins at **1.2 seconds within the welcome scene**, leaving an initial view of the actual home screen.
- `nested_media_start_basis_ambiguous`, import: the recording begins at **1.6 seconds within the import scene**, leaving time to orient before the import action.

Both offsets are composition-local, not root-global timestamps.

## Export and publication checks

Both delivery MP4s contain H.264 video at 1920 × 1080, 30 fps, 3,240 frames and exactly 108.000 seconds, with 48 kHz stereo AAC. The container/audio duration is 108.010 seconds. Full-file decoding of both original and compressed editions succeeded, with no black interval of at least 0.1 seconds. Hyperframes 0.9.70 rendered locally using its hardware-GPU `drawelement` capture path.

| Edition | Download MP4 | README MP4 | GIF preview |
| --- | ---: | ---: | ---: |
| English | 18,313,745 bytes | 7,511,120 bytes | 1,888,159 bytes |
| 中文 | 17,771,486 bytes | 7,317,584 bytes | 1,868,495 bytes |

README MP4s use H.264 CRF 23, AAC at 128 kbps and faststart metadata. Both remain below 10 MiB. Each GIF is 960 × 540, 10 fps, 126 frames and 12.6 seconds, excerpting the welcome screen, source highlight, language switch and closing card.

A second reviewer inspected 32 decoded full-film frames per edition, including every scene, plus the compressed source close-up at 67 seconds and language changes at 95.3, 96.3 and 98 seconds. The source definition stays legible after compression, the alternate locale persists across the intended hold, and the original language returns with the same selected source. The two GIFs were also inspected at all four excerpts.

The v0.3.0 release contains both original MP4s and both SRT subtitle files. All four uploaded asset sizes and GitHub SHA256 digests match the local files. Native GitHub video attachments supply the README players. Canonical attachment URLs, download URLs, app revision and media SHA256 values are recorded in [published.json](published.json). The existing GitHub profile video links lead to the updated README sections.

Raw recordings, checks, review sheets, decoded-frame audits and publication reports remain in ignored `output/`. The release tag still identifies the app revision filmed here; its release notes link to the separate commit containing the refreshed editable video source.

## Continue editing

The source, captures, soundtrack, subtitles and reproduction commands are included in this directory. The [HyperFrames desktop app](https://hyperframes.studio/studio/download?src=cli) is an optional editor; the pinned CLI can also preview and render the project. Raw recordings, browser reports and review sheets stay in ignored `output/` directories.
