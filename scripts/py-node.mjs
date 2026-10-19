import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchPyodide, VENDOR } from './fetch-pyodide.mjs';
import { generate, dataSets } from '../src/data/shopdata.js';
import { PY_PATCH } from '../src/py/patch.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function createPy({ packages = [], data = false } = {}) {
  await fetchPyodide({ quiet: true });
  const { loadPyodide } = await import(pathToFileURL(join(VENDOR, 'pyodide.mjs')).href);
  const py = await loadPyodide({ indexURL: VENDOR + '/' });
  py.runPython(PY_PATCH);
  const src = readFileSync(join(root, 'src/py/harness.py'), 'utf8');
  py.FS.writeFile('/home/pyodide/pq_harness.py', src);
  py.runPython('import sys\nsys.path.insert(0, "/home/pyodide")\nimport pq_harness');
  const loaded = new Set();
  const dataLoaded = new Set();
  const api = () => py.globals.get('pq_harness').api;
  const self = {
    version: py.version,
    runPython: (code) => py.runPython(code),
    async ensure({ packages: pk = [], data: d = false } = {}) {
      const need = pk.filter((p) => !loaded.has(p));
      if (need.length) {
        await py.loadPackage(need, { messageCallback: () => {} });
        need.forEach((p) => loaded.add(p));
        py.runPython(need.map((p) => (p === 'matplotlib' ? 'import matplotlib\nmatplotlib.use("Agg")\n' : '')).join('') + `import ${need.map((p) => ({ 'scikit-learn': 'sklearn', scipy: 'scipy.stats', statsmodels: 'statsmodels.api' })[p] || p).join(', ')}`);
      }
      const sets = dataSets(d).filter((s) => !dataLoaded.has(s));
      if (sets.length) {
        for (const variant of ['public', 'hidden']) {
          py.FS.mkdirTree(`/data/${variant}`);
          for (const [name, csv] of Object.entries(generate(variant, sets))) py.FS.writeFile(`/data/${variant}/${name}.csv`, csv);
        }
        sets.forEach((s) => dataLoaded.add(s));
      }
    },
    call(name, payload) {
      return JSON.parse(api()(name, JSON.stringify(payload)));
    },
  };
  await self.ensure({ packages, data });
  return self;
}
