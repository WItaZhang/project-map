import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const { values }=parseArgs({options:{lang:{type:'string',default:'zh'}}});
const lang=values.lang==='zh-CN'?'zh':values.lang;
if(!['zh','en'].includes(lang))throw new Error('Use --lang zh or --lang en.');
const sourceShots=JSON.parse(await readFile('shots.json','utf8'));
const englishCopy=JSON.parse(await readFile('copy.en.json','utf8'));
const englishShots=sourceShots.map(s=>{
 const copy=englishCopy[s.id];
 if(!copy?.title||!copy?.caption)throw new Error(`Missing English copy for scene: ${s.id}`);
 return {...s,...copy};
});
const shots=lang==='en'?englishShots:sourceShots;
const duration=Math.max(...shots.map(s=>s.start+s.duration));
const htmlLang=lang==='en'?'en':'zh-CN';
const documentTitle=lang==='en'?'Project Map · From capability to source':'Project Map · 从能力找到实现';
const srtTime=seconds=>{
 const ms=Math.round(seconds*1000);
 return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;
};
const srt=items=>items.map((s,i)=>`${i+1}\n${srtTime(s.start)} --> ${srtTime(s.start+s.duration)}\n${s.title}\n${s.caption}\n`).join('\n');
await writeFile('captions.zh-CN.srt',srt(sourceShots));
await writeFile('captions.en.srt',srt(englishShots));
const manifest=JSON.parse(await readFile(`assets/clips/${lang}/manifest.json`,'utf8'));
if (manifest.language && manifest.language !== lang) throw new Error('Capture language does not match composition.');
const clips=manifest.clips;
const byName=new Map(clips.map(x=>[x.name,x]));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const full={x:230.4,y:0,scale:820/1080};
const focus=(x,y,scale)=>({x:960-x*scale,y:410-y*scale,scale});
const targets={welcome:focus(1732,285,2.8),language:focus(1650,140,2.4),hook:focus(905,530,1.32),import:full,overview:focus(900,555,1.18),skill:focus(1732,285,2.8),relations:focus(1735,302,3),evidence:focus(1735,310,3.2),search:focus(130,215,3),tool:focus(1735,350,2.8),source:focus(1725,245,2.8),mcp:focus(1735,315,2.8),reimport:full,github:focus(135,155,2.8),end:full};
const titleVars=[];
await mkdir('compositions',{recursive:true});
for(const s of shots){
 titleVars.push({id:s.id+'-title',type:'string',label:s.id+' title',default:s.title},{id:s.id+'-caption',type:'string',label:s.id+' caption',default:s.caption});
 const clip=byName.get(s.id);const videoStart={import:1.6,welcome:1.2}[s.id]??0;
 const image=`assets/screens/${lang}/${s.image}`;
 if (clip && videoStart + clip.duration > s.duration) throw new Error(`Clip ${s.id} overruns its scene: ${clip.duration}s`);
 if (!['hook','end'].includes(s.id) && !clip) throw new Error(`Missing actual ${lang} recording: ${s.id}`);
 const media=clip?`<video id="${s.id}-recording" class="clip" data-start="${videoStart}" data-duration="${clip.duration.toFixed(3)}" data-track-index="1" src="${clip.path}" muted playsinline preload="auto"></video>`:'';
 const pre=videoStart?`<img id="${s.id}-before" class="clip" data-start="0" data-duration="${videoStart}" data-track-index="1" src="assets/screens/${lang}/01-welcome.png" alt="Actual project welcome screen" />`:'';
 const initial=s.id==='language'?targets.language:s.id==='welcome'?focus(960,570,1.5):full;
 let moves=`tl.set('#${s.id}-camera',${JSON.stringify(initial)},0);`;
 const moveStart=s.id==='welcome'?videoStart+.95:clip?videoStart+clip.duration+0.12:0.8;
 const target=targets[s.id]??full;
 if(target!==full && s.id!=='language')moves+=`\ntl.to('#${s.id}-camera',{...${JSON.stringify(target)},duration:0.6,ease:'power2.inOut'},${moveStart.toFixed(3)});`;
 if(s.id==='github')moves+=`\ntl.to('#github-camera',{...${JSON.stringify(focus(135,1005,2.8))},duration:0.65,ease:'power2.inOut'},9.1);`;
 if(s.id==='source')moves+=`\ntl.to('#source-camera',{...${JSON.stringify(focus(1735,465,3))},duration:0.65,ease:'power2.inOut'},5.25);`;
 if(s.id==='evidence')moves+=`\ntl.to('#evidence-camera',{...${JSON.stringify(focus(1735,615,3.2))},duration:0.65,ease:'power2.inOut'},6.15);`;
 if(s.id==='end')moves+=`\ntl.fromTo('#end-rule',{scaleX:0},{scaleX:1,duration:0.6,ease:'power2.out'},0.5);`;
 const endRule=s.id==='end'?'<div id="end-rule" style="position:absolute;left:230px;top:810px;width:1459px;height:5px;background:#4d73c4;transform-origin:left center"></div>':'';
 const html=`<template>
<style>
#root{position:absolute;inset:0;background:#f6f8fc;overflow:hidden}
#${s.id}-viewport{position:absolute;inset:0 0 auto;height:820px;overflow:hidden;background:#f6f8fc}
#${s.id}-camera{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0}
#${s.id}-camera img,#${s.id}-camera video{position:absolute;left:0;top:0;width:1920px;height:1080px;object-fit:fill}
#${s.id}-still{z-index:1}#${s.id}-recording{z-index:3}#${s.id}-before{z-index:4}
</style>
<div id="root" data-composition-id="${s.id}" data-width="1920" data-height="1080">
<div id="${s.id}-viewport" data-layout-allow-overflow="true"><div id="${s.id}-camera">
<img id="${s.id}-still" class="clip" data-start="0" data-duration="${s.duration}" data-track-index="0" src="${image}" alt="Actual synthetic Career Agent product state" />${media}${pre}
</div></div>${endRule}
</div>
<script>
const tl=gsap.timeline({paused:true});
${moves}
window.__timelines['${s.id}']=tl;
</script>
</template>\n`;
 await writeFile('compositions/'+s.id+'.html',html);
}
const captionMarkup=shots.map(s=>`<div id="copy-${s.id}" class="clip copy" data-start="${s.start}" data-duration="${s.duration}" data-track-index="0" data-hold="true"><div id="copy-${s.id}-inner"><h1 data-var-text="${s.id}-title">${esc(s.title)}</h1><p data-var-text="${s.id}-caption">${esc(s.caption)}</p></div></div>`).join('\n');
const captionMoves=shots.map(s=>`tl.fromTo('#copy-${s.id}-inner',{opacity:0},{opacity:1,duration:0.18,ease:'none'},${s.start});`).join('\n');
await writeFile('compositions/captions.html',`<template>
<style>
@font-face{font-family:'Project Map Video';src:url('assets/fonts/ProjectMapVideo.woff2') format('woff2');font-weight:100 900;font-display:block}
#root{position:absolute;inset:0;pointer-events:none}
.band{position:absolute;left:0;right:0;top:820px;height:260px;background:#f6f8fc;border-top:1px solid #dce4f0}
.copy{position:absolute;left:192px;right:192px;top:832px;height:170px;font-family:'Project Map Video',sans-serif;color:#263957}
h1{margin:0;font-size:64px;line-height:1.2;font-weight:700;letter-spacing:-1px}
p{margin:10px 0 0;font-size:44px;line-height:1.2;font-weight:400;color:#566c8b}
</style><div id="root" data-composition-id="captions" data-width="1920" data-height="1080"><div class="band"></div>${captionMarkup}</div>
<script>const tl=gsap.timeline({paused:true});${captionMoves}\nwindow.__timelines['captions']=tl;</script>
</template>\n`);
const hosts=shots.map(s=>`<div id="${s.id}" class="clip" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${s.start}" data-duration="${s.duration}" data-track-index="0" data-track-kind="graphics" data-width="1920" data-height="1080"></div>`).join('\n');
await writeFile('index.html',`<!doctype html><html lang="${htmlLang}" data-composition-variables='${JSON.stringify(titleVars).replaceAll("'",'&#39;')}'>
<head><meta charset="UTF-8"><meta name="viewport" content="width=1920,height=1080"><title>${documentTitle}</title><script src="assets/lib/gsap.min.js"></script><style>*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#f6f8fc}#root{position:absolute;inset:0}.clip{position:absolute;inset:0}</style></head>
<body><div id="root" data-composition-id="main" data-start="0" data-duration="${duration}" data-width="1920" data-height="1080" data-fps="30">
${hosts}
<div id="captions" class="clip" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="${duration}" data-track-index="1" data-track-kind="captions" data-width="1920" data-height="1080" style="z-index:30"></div>
<audio id="music" src="assets/audio/music.m4a" data-start="0" data-duration="${duration}" data-track-index="2" data-volume="0.85" data-fade-in="0.7" data-fade-out="2.5"></audio>
${shots.filter(s=>byName.has(s.id)).map(s=>`<audio id="click-${s.id}" src="assets/audio/click-soft.wav" data-start="${s.start+({import:1.6,welcome:1.2}[s.id]??0)+({welcome:.7,github:.15,language:.55}[s.id]??.35)}" data-duration="0.08" data-track-index="3" data-volume="0.35"></audio>`).join('\n')}
</div><script>window.__timelines=window.__timelines||{};window.__timelines.main=gsap.timeline({paused:true});</script></body></html>\n`);
console.log(`Built ${shots.length} scenes in ${htmlLang}, ${duration} seconds, and both subtitle sidecars.`);
