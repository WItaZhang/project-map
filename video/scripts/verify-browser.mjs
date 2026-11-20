import { chromium } from 'playwright';
import { getDemoFiles } from '../../src/demo.js';
import { parseArgs } from 'node:util';
const {values}=parseArgs({options:{lang:{type:'string',default:'zh'}}});
const lang=values.lang==='zh-CN'?'zh':values.lang;
if(!['en','zh'].includes(lang)) throw new Error('Use --lang en or --lang zh.');
import { mkdir,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import assert from 'node:assert/strict';
const fixture=resolve(`output/folder-fixture-${lang}/career-agent-demo`);
for(const f of getDemoFiles(lang)){const p=resolve(fixture,f.path);await mkdir(dirname(p),{recursive:true});await writeFile(p,f.text);}
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},locale:lang==='en'?'en-US':'zh-CN'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.PROJECT_MAP_URL || 'https://witazhang.github.io/project-map/');
 await page.locator('[data-input="folder"]').setInputFiles(fixture);
 await page.locator('.project-meta').filter({hasText:lang==='en'?'13 objects':'13 个对象'}).waitFor();
 assert.equal(await page.locator('.filter-chip[data-kind="tool"]').innerText(),lang==='en'?'Tool 3':'工具 3');
 await page.setViewportSize({width:390,height:844});
 await page.locator('[data-action="open-sidebar"]').click();
 await page.locator('.object-row').filter({hasText:'discover-jobs'}).click();
 await page.locator('.app-shell.inspector-open').waitFor();
 assert.equal(await page.locator('.inspector-title').innerText(),'discover-jobs');
 await page.screenshot({path:`output/mobile-qa-${lang}.png`});
 assert.deepEqual(errors,[]);
 await writeFile(`output/browser-qa-${lang}.json`,JSON.stringify({liveURL:page.url(),passed:['App loads JavaScript and Web Worker','Folder import yields13objects3tools','390px sidebar and inspector selection'],pageErrors:errors},null,2));
 console.log('App load, real folder import, and narrow viewport navigation passed.');
}finally{await browser.close();}
