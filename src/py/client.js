import { dataSets } from '../data/shopdata.js';
export const PYODIDE_URL = new URL('./pyodide/', document.baseURI).href;
export const TIME_LIMITS = { core: 5000, numpy: 15000, pandas: 15000, viz: 15000, stats: 15000, ml: 60000, dl: 60000 };
export const TIME_LIMIT_MS = TIME_LIMITS.core;

const PACKAGE_MB = { numpy: 3, pandas: 5, matplotlib: 9, scipy: 14, 'scikit-learn': 5, statsmodels: 9, seaborn: 0.3 };

let worker = null;
let seq = 0;
const pending = new Map();
let initPromise = null;
let ensured = { packages: new Set(), data: new Set() };
let ensureChain = Promise.resolve();
const listeners = new Set();
let status = { state: 'idle', error: null, info: null, loading: null };

function setStatus(next) {
  status = { ...status, ...next };
  listeners.forEach((f) => f(status));
}

export function onStatus(f) {
  listeners.add(f);
  f(status);
  return () => listeners.delete(f);
}

export const getStatus = () => status;

function spawn() {
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  ensured = { packages: new Set(), data: new Set() };
  worker.onmessage = (ev) => {
    const p = pending.get(ev.data.id);
    if (!p) return;
    pending.delete(ev.data.id);
    clearTimeout(p.timer);
    if (ev.data.ok) p.resolve(ev.data.info ?? ev.data.result);
    else p.reject(new Error(ev.data.error));
  };
  worker.onerror = (e) => {
    for (const [id, p] of pending) { clearTimeout(p.timer); p.reject(new Error(e.message || 'worker error')); pending.delete(id); }
  };
}

function send(msg, timeoutMs) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const entry = { resolve, reject, timer: null };
    if (timeoutMs) {
      entry.timer = setTimeout(() => {
        pending.delete(id);
        restart();
        resolve({ __timeout: true });
      }, timeoutMs);
    }
    pending.set(id, entry);
    worker.postMessage({ ...msg, id });
  });
}

export function ensurePython() {
  if (initPromise) return initPromise;
  if (!worker) spawn();
  setStatus({ state: 'loading', error: null, loading: null });
  const t0 = performance.now();
  initPromise = send({ kind: 'init', url: PYODIDE_URL }, 0)
    .then((info) => { setStatus({ state: 'ready', info: { ...info, ms: Math.round(performance.now() - t0) } }); return info; })
    .catch((e) => { initPromise = null; worker?.terminate(); worker = null; setStatus({ state: 'error', error: e.message }); throw e; });
  return initPromise;
}

export function ensureNeeds(needs = {}) {
  const packages = needs.packages || [];
  const data = dataSets(needs.data);
  ensureChain = ensureChain.catch(() => {}).then(async () => {
    await ensurePython();
    const missing = packages.filter((p) => !ensured.packages.has(p));
    const missingData = data.filter((d) => !ensured.data.has(d));
    if (!missing.length && !missingData.length) return;
    const mb = missing.reduce((s, p) => s + (PACKAGE_MB[p] || 1), 0);
    setStatus({ state: 'packages', loading: { names: missing, mb, data: missingData.length > 0 } });
    try {
      await send({ kind: 'ensure', needs: { packages, data } }, 0);
      missing.forEach((p) => ensured.packages.add(p));
      data.forEach((d) => ensured.data.add(d));
      setStatus({ state: 'ready', loading: null });
    } catch (e) {
      setStatus({ state: 'error', error: e.message, loading: null });
      throw e;
    }
  });
  return ensureChain;
}

function restart() {
  worker?.terminate();
  worker = null;
  for (const [, p] of pending) { clearTimeout(p.timer); p.reject(new Error('restarted')); }
  pending.clear();
  initPromise = null;
  ensureChain = Promise.resolve();
  setStatus({ state: 'restarting' });
  ensurePython().catch(() => {});
}

export function limitFor(track) {
  return TIME_LIMITS[track] || TIME_LIMIT_MS;
}

export async function callPython(name, payload, { timeoutMs = TIME_LIMIT_MS, needs } = {}) {
  await ensurePython();
  if (needs) await ensureNeeds(needs);
  return send({ kind: 'call', name, payload }, timeoutMs);
}

export const checkCode = (task, code, opts) => callPython('check', { task, code }, opts);
export const runCode = (code, stdin, fn, calls, opts = {}) => callPython('run', { code, stdin, function: fn, calls, task: opts.task }, opts);
