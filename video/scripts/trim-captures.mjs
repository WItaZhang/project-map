import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
const { values } = parseArgs({ options: { lang: { type: 'string', default: 'zh' }, only: { type: 'string' } } });
const lang = values.lang === 'zh-CN' ? 'zh' : values.lang;
if (!['zh', 'en'].includes(lang)) throw new Error('Use --lang zh or --lang en.');
const report = JSON.parse(await readFile(`output/capture-report-${lang}.json`, 'utf8'));
const directory = `assets/clips/${lang}`;
await mkdir(directory, { recursive: true });
const limits = { welcome: 4.5, import: 5.5, overview: 5, skill: 3.3, relations: 4, evidence: 4, search: 4, tool: 3.5, source: 3.5, mcp: 4, reimport: 5, github: 7.5, language: 5.5 };
const previous = values.only ? JSON.parse(await readFile(`${directory}/manifest.json`, 'utf8')) : null;
if (values.only && !report.clips.some(clip => clip.name === values.only)) throw new Error('Unknown scene: ' + values.only);
for (const clip of report.clips.filter(clip => !values.only || clip.name === values.only)) {
  const rawProbe = spawnSync(ffprobe.path, ['-v', 'error', '-show_entries', 'stream=duration:format=duration', '-of', 'json', clip.raw], { encoding: 'utf8' });
  if (rawProbe.status !== 0) throw new Error('Raw clip probe failed: ' + clip.name);
  const rawInfo = JSON.parse(rawProbe.stdout);
  const rawDuration = Number(rawInfo.format.duration);
  // Keep the entire per-action recording, including its final state hold.
  // An oversized action must be recaptured or its scene explicitly extended.
  const originalDuration = rawDuration;
  const duration = originalDuration;
  const speed = 1;
  if (duration > (limits[clip.name] ?? duration)) throw new Error(`Recapture ${clip.name}: ${duration.toFixed(3)}s exceeds its scene allowance; no frames were dropped or sped up.`);
  const path = `${directory}/${clip.name}.mp4`;
  const filter = `setpts=(PTS-STARTPTS)/${speed.toFixed(8)},fps=30`;
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', clip.raw, '-vf', filter, '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', path];
  const result = spawnSync(ffmpeg, args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Clip encode failed: ' + clip.name);
  const probe = spawnSync(ffprobe.path, ['-v', 'error', '-show_entries', 'stream=start_time,duration', '-of', 'json', path], { encoding: 'utf8' });
  if (probe.status !== 0) throw new Error('Clip probe failed: ' + clip.name);
  const stream = JSON.parse(probe.stdout).streams[0];
  if (Number(stream.start_time) !== 0) throw new Error('Clip must start at zero: ' + clip.name);
  Object.assign(clip, { path, duration: Number(stream.duration), rawDuration, trimmedEncoderTail: 0, originalDuration, speed });
  console.log(`${lang}: ${clip.name} ${clip.duration.toFixed(3)}s${speed > 1 ? ` (${speed.toFixed(3)}×)` : ''}`);
}
await writeFile(`${directory}/manifest.json`, JSON.stringify({ provenance: 'Actual Playwright interactions with Project Map v0.3, localized synthetic Career Agent and public GitHub repository. No application UI modifications.', language: lang, viewport: report.viewport, sourceRevision: report.revision, clips: report.clips.map(clip => !values.only || clip.name === values.only ? clip : previous.clips.find(item => item.name === clip.name)) }, null, 2) + '\n');
