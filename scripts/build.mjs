import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

export const options = {
  entryPoints: ['src/main.js', 'src/worker.js'], outdir: 'dist/assets',
  bundle: true, format: 'esm', platform: 'browser', target: ['es2022'],
  minify: true, sourcemap: false, legalComments: 'linked', metafile: true,
};

export async function writeHTML() {
  await mkdir('dist', { recursive: true });
  let html = await readFile('index.html', 'utf8');
  html = html.replace(/(?:\.\/)?(?:\/)?src\/main\.js/g, './assets/main.js');
  if (!html.includes('/assets/main.css')) html = html.replace('</head>', '<link rel="stylesheet" href="./assets/main.css"></head>');
  // Same-origin assets only. No endpoint receives the imported project.
  const policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'";
  html = html.replace('<head>', '<head><meta http-equiv="Content-Security-Policy" content="' + policy + '">');
  await writeFile('dist/index.html', html);
}

if (process.argv[1]?.endsWith('/build.mjs')) {
  const result = await build(options);
  await writeHTML();
  const outputs = Object.entries(result.metafile.outputs).map(([path, value]) => ({ path, bytes: value.bytes }));
  console.log(JSON.stringify({ outputs }));
}
