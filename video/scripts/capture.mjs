import { chromium } from 'playwright';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const url = process.env.PROJECT_MAP_URL || 'http://127.0.0.1:4173/';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
await mkdir('assets/screens', {recursive:true});
await mkdir('output/raw', {recursive:true});
await mkdir('assets/clips', {recursive:true});
const context = await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:2,locale:'zh-CN',recordVideo:{dir:'output/raw',size:{width:1920,height:1080}}});
const epoch = performance.now();
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors=[], requests=[], clips=[];
page.on('pageerror', error=>errors.push(error.message));
page.on('request',req=>requests.push({url:req.url(),method:req.method()}));
const wait=ms=>page.waitForTimeout(ms);
const snap=async name=>{await page.screenshot({path:`assets/screens/${name}.png`});console.log('Captured '+name);};
const part=async (name,fn)=>{const start=(performance.now()-epoch)/1000;await wait(700);await fn();await wait(1600);clips.push({name,start,end:(performance.now()-epoch)/1000});};
try {
 await page.goto(url); await page.locator('.welcome').waitFor({state:'visible'}); await page.evaluate(()=>document.fonts.ready); await wait(800);
 await snap('01-welcome');
 await part('import', async()=>{
  const chooserPromise=page.waitForEvent('filechooser');
  await page.locator('.welcome [data-action="choose-zip"]').click();
  const chooser=await chooserPromise;await chooser.setFiles(resolve('../examples/career-agent-demo.zip'));
  await page.locator('.project-name').filter({hasText:'career-agent-demo'}).waitFor();
  assert.match(await page.locator('.project-meta').innerText(),/13 个对象/);
  await wait(900);await snap('02-imported');
 });
 await part('overview',async()=>{
  await page.locator('.filter-chip').filter({hasText:/^全部/}).click();
  await page.locator('[data-view="overview"]').click();
  assert.equal(await page.locator('.graph-node').count(),13);
  await wait(500);
  const node=page.locator('.graph-node').first();const box=await node.boundingBox();
  const before=await node.getAttribute('transform');
  await page.mouse.move(box.x+70,box.y+35);await page.mouse.down();await page.mouse.move(box.x+115,box.y+62,{steps:16});await page.mouse.up();
  assert.notEqual(await node.getAttribute('transform'),before);
  await page.locator('[data-action="zoom-in"]').click();await wait(400);await page.locator('[data-action="fit"]').click();await wait(500);
  await snap('03-overview');
 });
 await part('skill',async()=>{
  await page.locator('.object-row').filter({hasText:'discover-jobs'}).click();
  assert.equal(await page.locator('.inspector-title').innerText(),'discover-jobs');await wait(500);await snap('04-skill');
 });
 await part('relations',async()=>{
  await page.locator('[data-tab="relations"]').click();await page.locator('.relation-row').filter({hasText:'search_jobs'}).waitFor();await wait(600);await snap('05-relations');
 });
 await part('evidence',async()=>{
  await page.locator('.relation-row').filter({hasText:'search_jobs'}).locator('.relation-evidence').click();
  assert.match(await page.locator('.evidence-basis').innerText(),/文本引用.*非运行记录/);
  assert.match(await page.locator('.source-location').innerText(),/discover-jobs\/SKILL.md:6/);await wait(700);await snap('06-evidence');
 });
 await part('search',async()=>{
  await page.locator('.filter-chip[data-kind="tool"]').click();
  await page.locator('input[aria-label="搜索对象"]').pressSequentially('search_jobs',{delay:100});
  assert.equal(await page.locator('.object-row').count(),1);await wait(500);await snap('07-search');
 });
 await part('tool',async()=>{
  await page.locator('.object-row').filter({hasText:'search_jobs'}).click();await page.locator('[data-tab="details"]').click();
  assert.match(await page.locator('.detail-description').first().innerText(),/根据关键词返回职位候选/);await wait(500);await snap('08-tool');
 });
 await part('source',async()=>{
  await page.locator('[data-tab="source"]').click();
  assert.equal(await page.locator('.source-line.highlight .line-number').innerText(),'8');
  assert.match(await page.locator('.source-line.highlight .line-text').innerText(),/def search_jobs/);
  await wait(800);await snap('09-source');
 });
 await part('mcp',async()=>{
  await page.locator('input[aria-label="搜索对象"]').fill('');await page.locator('.filter-chip[data-kind="mcp"]').click();
  assert.equal(await page.locator('.object-row').count(),2);
  await page.locator('.object-row').filter({hasText:'.mcp.json'}).click();await page.locator('[data-tab="details"]').click();await wait(800);await snap('10-mcp');
 });
 await part('reimport',async()=>{
  await page.locator('[data-action="import"]').click();await page.locator('.import-menu').waitFor({state:'visible'});await wait(600);await snap('11-reimport');
  const chooserPromise=page.waitForEvent('filechooser');await page.locator('.import-menu [data-action="choose-zip"]').click();
  await (await chooserPromise).setFiles(resolve('../examples/career-agent-demo.zip'));
  await page.locator('.project-name').filter({hasText:'career-agent-demo'}).waitFor();await wait(700);
  await page.locator('.filter-chip').filter({hasText:/^全部/}).click();await wait(600);await snap('12-after-reimport');
 });
 assert.deepEqual(errors,[]);
 assert(requests.every(r=>r.url.startsWith(new URL(url).origin)&&r.method==='GET'),'Unexpected network transmission');
 await writeFile('output/capture-report.json',JSON.stringify({url,viewport:'1920x1080',screenshotScale:2,clips,errors,requests,checks:['ZIP import 13 objects','13-node overview','actual node drag','zoom and fit','Skill selection','text-reference evidence line 6','tool search','original tool description','source definition line 8','two distinct MCP instances','reimport','no page errors','GET-only same-origin app asset requests']},null,2));
 await context.close();
 await rename(await page.video().path(),'output/raw/walkthrough.webm');
 console.log(JSON.stringify({status:'passed',clips,errors}));
} finally {await context.close().catch(()=>{});await browser.close();}
