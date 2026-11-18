import { context } from 'esbuild';
import { options, writeHTML } from './build.mjs';

await writeHTML();
const ctx = await context({ ...options, minify: false });
await ctx.watch();
const { port, hosts } = await ctx.serve({ servedir: 'dist', host: '127.0.0.1', port: 4173 });
console.log(`Project Map: http://${hosts[0]}:${port}`);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await ctx.dispose(); process.exit(0); });
