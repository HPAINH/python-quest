import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { neededFiles } from './scripts/fetch-pyodide.mjs';

const vendor = resolve('vendor/pyodide');
const TYPES = { '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.zip': 'application/zip', '.json': 'application/json', '.whl': 'application/zip' };

function pyodideLocal() {
  return {
    name: 'pyodide-local',
    configureServer(server) {
      server.middlewares.use('/pyodide/', (req, res, next) => {
        const file = join(vendor, decodeURIComponent(req.url.split('?')[0]));
        if (!existsSync(file)) return next();
        const ext = file.slice(file.lastIndexOf('.'));
        res.setHeader('Content-Type', TYPES[ext] || 'application/octet-stream');
        res.end(readFileSync(file));
      });
    },
    writeBundle(opts) {
      const out = join(opts.dir, 'pyodide');
      mkdirSync(out, { recursive: true });
      for (const f of neededFiles()) cpSync(join(vendor, f), join(out, f));
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), pyodideLocal()],
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  test: { environment: 'node', include: ['tests/**/*.test.js'], testTimeout: 180000, hookTimeout: 180000 },
});
