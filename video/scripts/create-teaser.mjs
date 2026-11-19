import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';

// Short excerpts from the delivered film; the full workflow remains in the MP4.
await mkdir('../docs/assets', { recursive: true });
const segments = [[2, 5], [37.8, 40.2], [59.5, 62.8], [79, 82]];
const trims = segments.map(([start, end], i) =>
  `[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS[v${i}]`
);
const inputs = segments.map((_, i) => `[v${i}]`).join('');
const filter = [...trims,
  `${inputs}concat=n=${segments.length}:v=1:a=0,fps=10,scale=960:-1:flags=lanczos,split[a][b]`,
  '[a]palettegen=max_colors=128:stats_mode=diff[p]',
  '[b][p]paletteuse=dither=bayer:bayer_scale=3[out]'
].join(';');
const result = spawnSync(ffmpeg, [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-i', 'output/project-map-walkthrough-zh.mp4',
  '-filter_complex', filter, '-map', '[out]', '-loop', '0',
  '../docs/assets/project-map-demo.gif'
], { stdio: 'inherit' });
if (result.status !== 0) throw new Error('Teaser encoding failed');
console.log('Created 11.7-second README teaser.');
