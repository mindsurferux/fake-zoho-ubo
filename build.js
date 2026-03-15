import { build } from 'esbuild';
import { cpSync, mkdirSync, writeFileSync, rmSync } from 'fs';

const OUTPUT = '.vercel/output';

// Clean previous output
try { rmSync(OUTPUT, { recursive: true }); } catch {}

// 1. Bundle the Edge function
console.log('[Build] Bundling Edge function...');
await build({
    entryPoints: ['api/index.js'],
    bundle: true,
    outfile: `${OUTPUT}/functions/api/index.func/index.js`,
    format: 'esm',
    target: 'es2022',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    conditions: ['edge-light', 'worker', 'browser', 'module', 'import', 'default'],
    minify: false,
    sourcemap: false,
    external: [],
    banner: {
        js: '// Bundled by esbuild for Vercel Edge Runtime'
    }
});

// 2. Function config (.vc-config.json)
console.log('[Build] Writing function config...');
writeFileSync(`${OUTPUT}/functions/api/index.func/.vc-config.json`, JSON.stringify({
    runtime: 'edge',
    entrypoint: 'index.js'
}, null, 2));

// 3. Copy static files
console.log('[Build] Copying static files...');
mkdirSync(`${OUTPUT}/static`, { recursive: true });
cpSync('public', `${OUTPUT}/static`, { recursive: true });

// 4. Output config (routes)
console.log('[Build] Writing output config...');
writeFileSync(`${OUTPUT}/config.json`, JSON.stringify({
    version: 3,
    routes: [
        { handle: 'filesystem' },
        { src: '/api/(.*)', dest: '/api/index' },
        { src: '/oauth/(.*)', dest: '/api/index' },
        { src: '/admin/(.*)', dest: '/api/index' },
        { src: '/health(.*)', dest: '/api/index' },
        { src: '/', dest: '/api/index' }
    ]
}, null, 2));

console.log('[Build] Done!');
