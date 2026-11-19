import { mkdir, writeFile } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';
import { demoFiles } from '../src/demo.js';

await mkdir('examples', { recursive: true });
const entries = Object.fromEntries(demoFiles.map(({path, text}) => ['career-agent-demo/' + path, strToU8(text)]));
await writeFile('examples/career-agent-demo.zip', zipSync(entries));
console.log('Created examples/career-agent-demo.zip from the synthetic built-in example.');
