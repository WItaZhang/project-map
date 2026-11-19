# Delivery review

Reviewed on 2026-11-19. Deliveries: `project-map-walkthrough-zh.mp4` and `project-map-walkthrough-en.mp4`, each 96 seconds at 1920 × 1080 and 30 fps. They use separate Chinese/English on-screen guidance over the real Chinese app interface, with original music.

## Creative decisions

The selected story follows one capability through the actual product: import → map → Skill → relationship evidence → search → tool → source → MCP configuration → reimport → GitHub connection. The reverse-order reveal and the progressively growing map in [STORYLINES.md](STORYLINES.md) were not used because the complete import-to-source workflow was the priority.

All product imagery comes from Playwright recordings or screenshots of the synthetic Career Agent and a real connection to the public `WItaZhang/project-map` repository. Camera moves enlarge those captures; they do not depict extra app behavior. The film uses a separate caption band, direct cuts, 0.6–0.65-second camera moves, and restrained original music. No invented UI, stock montage, voiceover, competitor claim, runtime trace, or private project appears.

## Measured checks

- Hyperframes 0.9.70 full `check --json`: passed, zero errors. Runtime, layout, contrast, craft and audio checks passed. Two lint warnings are retained below.
- Real browser capture: ZIP import found 13 objects; all 13 appeared in overview; dragging, zoom/fit, Skill selection, relationship evidence, search, original descriptions, source line 8, the two MCP identities, and reimport passed. There were no page errors. The capture observed only same-origin GET requests for app assets.
- Additional browser QA: real folder import and 390-pixel sidebar/inspector navigation passed locally. This exposed and fixed the mobile menu being hidden with the breadcrumb.
- App validation: all 36 tests passed and the production build succeeded.
- Export: H.264, 1920 × 1080, 30 fps, 2,880 video frames; AAC stereo at 48 kHz. Full-file decode and black-frame detection reported no decode errors or black intervals of at least 0.1 seconds.
- Audio signal analysis: −20.3 LUFS integrated, −10.3 dBTP, zero clipped samples. The short beginning and ending silence correspond to fades. Audio was measured, **not listened to**; musical quality and subjective mix balance were not auditioned.
- README GIF: 960 × 540, 10 fps, 117 frames, 11.7 seconds, under 1 MiB each. It contains selected excerpts; the MP4 contains the full workflow.

## Visual review

For v0.2.0, inspected both languages’ beat and 360-pixel phone sheets. A second reviewer inspected all 12 English cut strips and the GitHub close-ups at 82.8/84/86/87.5 seconds. English text was also measured with the bundled font: the longest line is 1,213 pixels, within the 1,536-pixel content width. Both full language checks passed with zero errors and the same two intentional warnings. The Chinese edition shares the same media and camera paths.

The initial edition was reviewed through beat/phone sheets, all 11 original cut strips, and close-ups at 25.5/32/39/41/47/52.5/61/68 seconds, and eight frames across the source camera move at 58.8–60.2 seconds. Also inspected a contact sheet decoded from the delivered MP4 and its source close-up at 61 seconds. A second reviewer checked the composition and evidence/source frames.

The scene order reads as an actual route through the app. The relationship quote and path precede the highlighted instruction line; the tool path precedes the highlighted implementation line. Captions stay outside the app viewport. Titles were enlarged to 64 pixels, guidance to 44 pixels, and moved up to fit the title-safe boundary. The final URL is `github.com/WItaZhang/project-map`.

The full-map establishing shots remain the weakest shots at phone width: small UI labels are contextual, while the captions and later close-ups carry the explanation. This is a landscape desktop walkthrough. A future social edit should reframe individual panels for a vertical canvas. The final evidence-line hold is brief, but the preceding close-up already exposes the complete quote and source path.

## Warnings kept deliberately

- `timeline_track_too_dense`: the caption composition contains 13 sequential groups. They share one caption host and do not overlap; each scene's text remains directly editable.
- `nested_media_start_basis_ambiguous`: the import clip starts at 1.6 seconds **within** the import scene. The offset intentionally leaves time to read the initial import screen; it is not a global timestamp.

The GitHub recording shows an actual public repository, selected branch and immutable commit, followed by the refresh control. Separate real browser checks exercised refresh, source links, and the deployed app at 390 pixels. There were no archive, clone, or upload requests.

The app is read-only. Reimport shows the same synthetic fixture; the film does not claim to perform an external code edit or compare versions.

The README editions were additionally encoded as H.264/AAC at 1080p, approximately 6.3 MiB each, and uploaded as native GitHub video attachments. The English source close-up was inspected after this compression.

## Continue editing

The source, captures, soundtrack, subtitles and reproduction commands are included in this directory. The [HyperFrames desktop app](https://hyperframes.studio/studio/download?src=cli) is an optional editor; the pinned CLI can also preview and render the project. Raw recordings, local browser reports and review sheets stay in ignored `output/` directories.
