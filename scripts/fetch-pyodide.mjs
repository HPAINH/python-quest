import { existsSync, mkdirSync, readFileSync, rmSync, createWriteStream, statSync, copyFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'node_modules/pyodide/package.json'), 'utf8'));
const VERSION = pkg.version;
export const VENDOR = join(root, 'vendor', 'pyodide');
export const CORE_FILES = ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];
export const PACKAGES = ['numpy', 'pandas', 'matplotlib', 'scipy', 'scikit-learn', 'statsmodels', 'micropip', 'seaborn'];
export const EXTRA = [
  { name: 'seaborn', version: '0.13.2', file_name: 'seaborn-0.13.2-py3-none-any.whl', depends: ['numpy', 'pandas', 'matplotlib'], imports: ['seaborn'] },
];

function withExtra(lock) {
  for (const e of EXTRA) lock.packages[e.name] ??= { ...e, install_dir: 'site', package_type: 'package', sha256: '', tool: {}, unvendored_tests: false };
  return lock;
}

function installExtra() {
  const lockPath = join(VENDOR, 'pyodide-lock.json');
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  let changed = false;
  for (const e of EXTRA) {
    const src = join(root, 'extra-wheels', e.file_name);
    copyFileSync(src, join(VENDOR, e.file_name));
    const sha256 = createHash('sha256').update(readFileSync(src)).digest('hex');
    if (lock.packages[e.name]?.sha256 !== sha256) {
      lock.packages[e.name] = { ...e, install_dir: 'site', package_type: 'package', sha256, tool: {}, unvendored_tests: false };
      changed = true;
    }
  }
  if (changed) writeFileSync(lockPath, JSON.stringify(lock));
}

export function neededFiles() {
  const lock = withExtra(JSON.parse(readFileSync(join(root, 'node_modules/pyodide/pyodide-lock.json'), 'utf8')));
  const seen = new Set();
  const queue = [...PACKAGES];
  while (queue.length) {
    const name = queue.pop();
    if (seen.has(name)) continue;
    seen.add(name);
    queue.push(...lock.packages[name].depends);
  }
  return [...CORE_FILES, ...[...seen].map((n) => lock.packages[n].file_name)];
}

export async function fetchPyodide({ quiet = false } = {}) {
  const extraFiles = new Set(EXTRA.map((e) => e.file_name));
  const files = neededFiles().filter((f) => !extraFiles.has(f));
  const missing = files.filter((f) => !existsSync(join(VENDOR, f)));
  if (!missing.length) {
    installExtra();
    if (!quiet) console.log(`Pyodide ${VERSION} с пакетами уже в vendor/pyodide`);
    return VENDOR;
  }
  mkdirSync(VENDOR, { recursive: true });
  const url = `https://github.com/pyodide/pyodide/releases/download/${VERSION}/pyodide-${VERSION}.tar.bz2`;
  const tmp = join(root, 'vendor', `pyodide-${VERSION}.tar.bz2`);
  if (!existsSync(tmp) || statSync(tmp).size < 1e8) {
    console.log(`Скачиваю Pyodide ${VERSION} с GitHub (около 340 МБ, один раз)...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Не удалось скачать ${url}: HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
  }
  console.log(`Распаковываю ${files.length} файлов в vendor/pyodide...`);
  execFileSync('tar', ['-xjf', tmp, '-C', join(root, 'vendor'), ...files.map((f) => `pyodide/${f}`)], { stdio: 'inherit' });
  rmSync(tmp, { force: true });
  const still = files.filter((f) => !existsSync(join(VENDOR, f)));
  if (still.length) throw new Error('В архиве не нашлись файлы: ' + still.join(', '));
  installExtra();
  return VENDOR;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  fetchPyodide().catch((e) => { console.error(e.message); process.exit(1); });
}
