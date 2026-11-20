import { mkdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import ffmpeg from 'ffmpeg-static';

const { values }=parseArgs({options:{lang:{type:'string',default:'zh'}}});
const lang=values.lang==='zh-CN'?'zh':values.lang;
if(!['zh','en'].includes(lang))throw new Error('Use --lang zh or --lang en.');
const input=`output/project-map-walkthrough-${lang}.mp4`;
const output=`../docs/assets/project-map-demo${lang==='en'?'-en':''}.gif`;
// Short excerpts from the delivered film; the full workflow remains in the MP4.
await mkdir('../docs/assets', { recursive: true });
const shots=JSON.parse(await readFile('shots.json','utf8'));
const byId=new Map(shots.map(s=>[s.id,s]));
const excerpt=(id,startOffset,endOffset)=>{
 const shot=byId.get(id);
 if(!shot)throw new Error(`Missing teaser scene: ${id}`);
 return [shot.start+Math.min(startOffset,shot.duration-.1),shot.start+Math.min(endOffset,shot.duration)];
};
const segments=[excerpt('welcome',.3,3.5),excerpt('source',5.5,8.8),excerpt('language',.5,3.6),excerpt('end',3,6)];
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
  '-i', input,
  '-filter_complex', filter, '-map', '[out]', '-loop', '0',
  output
], { stdio: 'inherit' });
if (result.status !== 0) throw new Error('Teaser encoding failed');
console.log(`Created ${segments.reduce((sum,[start,end])=>sum+end-start,0).toFixed(1)}-second ${lang} README teaser: ${output}`);
