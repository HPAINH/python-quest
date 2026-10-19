import harnessSource from './harness.py?raw';
import { PY_PATCH } from './patch.js';
import { generate, dataSets } from '../data/shopdata.js';

let py = null;
let api = null;
let ready = null;
const loaded = new Set();
const dataLoaded = new Set();
const IMPORT = { 'scikit-learn': 'sklearn', scipy: 'scipy.stats', statsmodels: 'statsmodels.api' };
const PRE = { matplotlib: 'import matplotlib\nmatplotlib.use("Agg")\n' };

async function init(indexURL) {
  const mod = await import(/* @vite-ignore */ indexURL + 'pyodide.mjs');
  py = await mod.loadPyodide({ indexURL });
  py.runPython(PY_PATCH);
  py.FS.writeFile('/home/pyodide/pq_harness.py', harnessSource);
  py.runPython('import sys\nsys.path.insert(0, "/home/pyodide")\nimport pq_harness');
  api = py.globals.get('pq_harness').api;
  return { version: py.version, indexURL };
}

async function ensure({ packages = [], data = false }) {
  await ready;
  const need = packages.filter((p) => !loaded.has(p));
  if (need.length) {
    await py.loadPackage(need, { messageCallback: () => {}, errorCallback: () => {} });
    py.runPython(need.map((p) => PRE[p] || '').join('') + `import ${need.map((p) => IMPORT[p] || p).join(', ')}`);
    need.forEach((p) => loaded.add(p));
  }
  const sets = dataSets(data).filter((s) => !dataLoaded.has(s));
  if (sets.length) {
    for (const variant of ['public', 'hidden']) {
      py.FS.mkdirTree(`/data/${variant}`);
      for (const [name, csv] of Object.entries(generate(variant, sets))) py.FS.writeFile(`/data/${variant}/${name}.csv`, csv);
    }
    sets.forEach((s) => dataLoaded.add(s));
  }
  return { packages: [...loaded], data: [...dataLoaded] };
}

self.onmessage = async (ev) => {
  const { id, kind, name, payload, url, needs } = ev.data;
  try {
    if (kind === 'init') {
      ready = ready || init(url);
      self.postMessage({ id, ok: true, info: await ready });
      return;
    }
    if (kind === 'ensure') {
      self.postMessage({ id, ok: true, info: await ensure(needs) });
      return;
    }
    await ready;
    const t0 = performance.now();
    const res = JSON.parse(api(name, JSON.stringify(payload)));
    self.postMessage({ id, ok: true, result: res, ms: Math.round(performance.now() - t0) });
  } catch (e) {
    if (kind === 'init') ready = null;
    self.postMessage({ id, ok: false, error: String((e && e.message) || e) });
  }
};
