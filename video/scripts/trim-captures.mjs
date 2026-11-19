import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
const report=JSON.parse(await readFile('output/capture-report.json','utf8'));
await mkdir('assets/clips',{recursive:true});
for(const clip of report.clips){
 const duration=clip.end-clip.start;
 const args=['-hide_banner','-loglevel','error','-y','-ss',String(clip.start),'-i','output/raw/walkthrough.webm','-t',String(duration),'-vf','fps=30','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-an','-movflags','+faststart',`assets/clips/${clip.name}.mp4`];
 const result=spawnSync(ffmpeg,args,{stdio:'inherit'});if(result.status!==0)throw Error('Clip encode failed: '+clip.name);
 clip.path=`assets/clips/${clip.name}.mp4`;clip.duration=duration;
 console.log(clip.name+' '+duration.toFixed(3)+'s');
}
await writeFile('assets/clips/manifest.json',JSON.stringify({provenance:'Actual Playwright interactions with the synthetic Career Agent, no application UI modifications.',viewport:report.viewport,clips:report.clips},null,2));
