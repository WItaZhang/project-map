import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { zipSync, strToU8 } from 'fflate';
import assert from 'node:assert/strict';
import { getDemoFiles } from '../../src/demo.js';

const { values } = parseArgs({ options: { lang: { type: 'string', default: 'zh' } } });
const lang = values.lang === 'zh-CN' ? 'zh' : values.lang;
if (!['zh', 'en'].includes(lang)) throw new Error('Use --lang zh or --lang en.');
const url = process.env.PROJECT_MAP_URL || 'http://127.0.0.1:4173/';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const locale = lang === 'zh' ? 'zh-CN' : 'en-US';
const screenDir = `assets/screens/${lang}`, clipDir = `assets/clips/${lang}`, rawDir = `output/raw/${lang}`;
await Promise.all([screenDir, clipDir, rawDir, `output/fixtures/${lang}`].map(path => mkdir(path, { recursive: true })));
const fixture = resolve(`output/fixtures/${lang}/career-agent-demo.zip`);
await writeFile(fixture, zipSync(Object.fromEntries(getDemoFiles(lang).map(file => [`career-agent-demo/${file.path}`, strToU8(file.text)])), { level: 6 }));

const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, locale });
const page = await context.newPage();
const epoch = performance.now();
page.setDefaultTimeout(30000);
const errors = [], requests = [], clips = [], bounds = {};
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => requests.push({ url: request.url(), method: request.method() }));
const wait = ms => page.waitForTimeout(ms);
const snap = async name => { await page.screenshot({ path: `${screenDir}/${name}.png` }); console.log(`${lang}: ${name}`); };
// Each action has its own recording. Waiting for the first delivered frame and
// stopping before the next action avoids wall-clock/video-clock trim offsets.
// No UI overlays or DOM edits are used to mark timing.
const part = async (name, fn, { before = 350, after = 650 } = {}) => {
  const raw = `${rawDir}/${name}.webm`;
  let firstFrame;
  const frames = [];
  const ready = new Promise(resolve => { firstFrame = resolve; });
  await page.screencast.start({ path: raw, size: { width: 1920, height: 1080 }, fps: 30, quality: 90,
    onFrame: ({ timestamp }) => { frames.push(timestamp); firstFrame(); } });
  let readyTimer;
  try { await Promise.race([ready, new Promise((_, reject) => { readyTimer = setTimeout(() => reject(new Error('No screencast frame')), 10000); })]); }
  finally { clearTimeout(readyTimer); }
  const start = (performance.now() - epoch) / 1000;
  await wait(before); await fn(); await wait(after);
  const end = (performance.now() - epoch) / 1000;
  await page.screencast.stop();
  clips.push({ name, raw, start, end, recording: 'per-action; starts at first recorded frame', videoOffset: 0, firstFrameWallTime: frames[0], lastFrameWallTime: frames.at(-1), capturedFrames: frames.length });
  await wait(300);
};
const search = () => page.locator('.search-box input');
const allFilter = () => page.locator('.filter-chip:not([data-kind])');
const projectLoaded = async name => {
  await page.locator('.project-name').filter({ hasText: name }).waitFor();
  await page.waitForFunction(() => document.querySelector('.busy-overlay').classList.contains('hidden'));
};
const point = async (name, selector) => { bounds[name] = await page.locator(selector).first().boundingBox(); };
try {
  await page.goto(url);
  await page.locator('.welcome').waitFor({ state: 'visible' });
  assert.equal(await page.locator('html').getAttribute('lang'), lang === 'zh' ? 'zh-CN' : 'en');
  await page.evaluate(() => document.fonts.ready); await wait(500);
  await snap('01-welcome');
  await point('welcomeInputs', '.welcome-inputs'); await point('welcomePreview', '.welcome-preview');

  await part('welcome', async () => {
    await page.locator('[data-preview="skill"]').click();
    await projectLoaded('Career Agent');
    assert.equal(await page.locator('.inspector-title').innerText(), 'prepare-application');
    await wait(350); await snap('00-preview');
  }, { before: 700, after: 900 });

  // A new local import begins at the welcome screen, after demonstrating the sample map.
  await page.reload(); await page.locator('.welcome').waitFor({ state: 'visible' }); await wait(400);
  await part('import', async () => {
    const choosing = page.waitForEvent('filechooser');
    await page.locator('.welcome [data-action="choose-zip"]').click();
    await (await choosing).setFiles(fixture); await projectLoaded('career-agent-demo');
    assert.equal(await page.locator('.object-row').count(), 13);
    await wait(400); await snap('02-imported');
  });
  await part('overview', async () => {
    await allFilter().click(); await page.locator('[data-view="overview"]').click();
    assert.equal(await page.locator('.graph-node').count(), 13); await wait(150);
    const node = page.locator('.graph-node').first(), box = await node.boundingBox(), before = await node.getAttribute('transform');
    await page.mouse.move(box.x + 60, box.y + 30); await page.mouse.down();
    await page.mouse.move(box.x + 110, box.y + 55, { steps: 12 }); await page.mouse.up();
    assert.notEqual(await node.getAttribute('transform'), before);
    await page.locator('[data-action="zoom-in"]').click(); await wait(250);
    await page.locator('[data-action="fit"]').click(); await wait(200); await snap('03-overview');
  });
  await part('skill', async () => {
    await page.locator('.object-row').filter({ hasText: 'discover-jobs' }).click();
    assert.equal(await page.locator('.inspector-title').innerText(), 'discover-jobs'); await wait(250); await snap('04-skill');
    await point('skillDescription', '.detail-description');
  });
  await part('relations', async () => {
    await page.locator('[data-tab="relations"]').click();
    await page.locator('.relation-row').filter({ hasText: 'search_jobs' }).waitFor(); await wait(250); await snap('05-relations');
    await point('relationRow', '.relation-row');
  });
  await part('evidence', async () => {
    await page.locator('.relation-row').filter({ hasText: 'search_jobs' }).locator('.relation-evidence').click();
    assert.match(await page.locator('.evidence-basis').innerText(), lang === 'zh' ? /文本引用/ : /Text reference/);
    assert.match(await page.locator('.source-location').innerText(), /discover-jobs\/SKILL.md:6/);
    await wait(250); await snap('06-evidence'); await point('evidenceBlock', '.evidence-block'); await point('evidenceLine', '.source-line.highlight');
  });
  await part('search', async () => {
    await page.locator('.filter-chip[data-kind="tool"]').click();
    await search().pressSequentially('search_jobs', { delay: 65 });
    assert.equal(await page.locator('.object-row').count(), 1); await wait(180); await snap('07-search');
  });
  await part('tool', async () => {
    await page.locator('.object-row').filter({ hasText: 'search_jobs' }).click();
    await page.locator('[data-tab="details"]').click();
    assert.match(await page.locator('.detail-description').first().innerText(), lang === 'zh' ? /根据关键词返回职位候选/ : /Return job candidates/);
    await wait(250); await snap('08-tool'); await point('toolDescription', '.detail-description');
  });
  await part('source', async () => {
    await page.locator('[data-tab="source"]').click();
    assert.equal(await page.locator('.source-line.highlight .line-number').innerText(), '8');
    assert.match(await page.locator('.source-line.highlight .line-text').innerText(), /def search_jobs/);
    await wait(350); await snap('09-source'); await point('sourcePath', '.source-location'); await point('sourceLine', '.source-line.highlight');
  });
  await part('mcp', async () => {
    await search().fill(''); await page.locator('.filter-chip[data-kind="mcp"]').click();
    assert.equal(await page.locator('.object-row').count(), 2);
    await page.locator('.object-row').filter({ hasText: '.mcp.json' }).click();
    await page.locator('[data-tab="details"]').click(); await wait(350); await snap('10-mcp'); await point('mcpStatus', '.detail-chips');
  });
  await part('reimport', async () => {
    await page.locator('[data-action="import"]').click(); await wait(350); await snap('11-reimport');
    const choosing = page.waitForEvent('filechooser');
    await page.locator('.import-menu [data-action="choose-zip"]').click(); await (await choosing).setFiles(fixture);
    await projectLoaded('career-agent-demo'); await wait(350); await snap('12-after-reimport');
  });
  const localRequestCount = requests.length;
  assert(requests.every(request => new URL(request.url).origin === new URL(url).origin && request.method === 'GET'), 'Local import made an unexpected network request');

  await part('github', async () => {
    await page.locator('[data-action="import"]').click(); await page.locator('.import-menu [data-action="connect-github"]').click();
    await page.locator('#github-url').fill('https://github.com/WItaZhang/project-map'); await wait(400);
    await page.locator('.github-submit').click();
    await page.locator('#github-branch option[value="main"]').waitFor({ state: 'attached' });
    await page.locator('#github-branch').selectOption('main'); await wait(850); await snap('13a-github-branch');
    await page.locator('.github-submit').click(); await projectLoaded('project-map');
    await page.locator('.github-provenance:not(.hidden)').waitFor();
    assert.match(await page.locator('.github-revision').innerText(), /^main · [a-f0-9]{7}$/);
    await wait(350); await snap('13-github');
    await point('githubProvenance', '.github-provenance'); await point('githubRefresh', '[data-action="refresh-github"]');
  }, { before: 150, after: 500 });

  // Show a real cloud source file while changing language; no project is reloaded.
  await search().fill('scripts/build.mjs');
  await page.locator('.object-row').filter({ hasText: 'scripts/build.mjs' }).first().click();
  await page.locator('[data-tab="source"]').click(); await wait(300);
  await snap('14a-language-before');
  const sourceBefore = await page.locator('.source-code').innerText();
  const selectedBefore = await page.locator('.inspector-title').innerText();
  const sourceLink = await page.locator('.github-source-link').first().getAttribute('href');
  assert.match(sourceLink, /github\.com\/WItaZhang\/project-map\/blob\/[a-f0-9]{40}\/scripts\/build\.mjs#L\d+/);
  const revision = await page.locator('.github-revision').innerText();
  await point('languageSwitch', '.language-switch'); await point('languageTitle', '.inspector-title'); await point('languageTabs', '.inspector-tabs');
  await part('language', async () => {
    await page.locator(`button[data-locale="${lang === 'en' ? 'zh' : 'en'}"]`).click();
    assert.equal(await page.locator('.source-code').innerText(), sourceBefore);
    assert.equal(await page.locator('.inspector-title').innerText(), selectedBefore);
    assert.equal(await page.locator('.github-revision').innerText(), revision);
    await wait(2200); await snap('14b-language-other');
    await page.locator(`button[data-locale="${lang}"]`).click();
    assert.equal(await page.locator('.source-code').innerText(), sourceBefore);
    await wait(250); await snap('14-language');
  }, { before: 550, after: 700 });

  // Refresh is verified outside the film's final language shot.
  const refreshCommit = page.waitForResponse(response => response.url().includes('/commits/main') && response.ok());
  await page.locator('[data-action="refresh-github"]').click(); await refreshCommit; await projectLoaded('project-map');
  await page.waitForFunction(() => !document.querySelector('[data-action="refresh-github"]').disabled);
  assert.deepEqual(errors, []);
  const allowed = new Set([new URL(url).origin, 'https://api.github.com', 'https://raw.githubusercontent.com']);
  assert(requests.every(request => allowed.has(new URL(request.url).origin) && ['GET', 'OPTIONS'].includes(request.method)));
  assert(!requests.some(request => /zipball|archive\/|codeload/.test(request.url)));
  const report = { language: lang, url, fixture: `output/fixtures/${lang}/career-agent-demo.zip`, rawDirectory: rawDir, recording: 'One screencast per action; no cross-action trimming', viewport: '1920x1080', screenshotScale: 2, revision, sourceLink, bounds, clips, localRequestCount, apiRequestCount: requests.filter(r => r.url.startsWith('https://api.github.com/')).length, errors, requests, checks: ['actual localized product UI', 'localized synthetic fixture', 'exact clickable preview target', 'ZIP import 13 objects', '13-node overview', 'actual node drag', 'zoom and fit', 'Skill selection', 'text-reference evidence line 6', 'tool search', 'original tool description', 'source definition line 8', 'two distinct MCP instances', 'reimport', 'real public GitHub repository and branch', 'immutable GitHub source link', 'language switch retains selected source and revision', 'real GitHub refresh', 'no ZIP or clone request', 'no page errors'] };
  await writeFile(`output/capture-report-${lang}.json`, JSON.stringify(report, null, 2));
  await context.close();
  console.log(JSON.stringify({ status: 'passed', language: lang, revision, clips: clips.map(c => ({ name: c.name, duration: c.end - c.start })), errors }));
} finally { await context.close().catch(() => {}); await browser.close(); }
