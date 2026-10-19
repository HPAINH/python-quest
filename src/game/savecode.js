import { emptyProgress } from './progress.js';

export const PREFIX = 'PQ1-';
const FORMAT = 1;
const EPOCH = Date.UTC(2026, 0, 1);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(str) {
  let c = 0xffffffff;
  for (let i = 0; i < str.length; i++) c = CRC_TABLE[(c ^ str.charCodeAt(i)) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function toB64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s) {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const checksum = (payload) => {
  const c = crc32(payload) & 0xffffff;
  return B64[(c >> 18) & 63] + B64[(c >> 12) & 63] + B64[(c >> 6) & 63] + B64[c & 63];
};

async function pipe(bytes, stream) {
  const s = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(s).arrayBuffer());
}

const deflate = (b) => pipe(b, new CompressionStream('deflate-raw'));
const inflate = (b) => pipe(b, new DecompressionStream('deflate-raw'));

export function packProgress(progress, slots) {
  const tasks = slots.tasks;
  const levels = slots.levels;
  const bytes = [FORMAT, tasks.length >> 8, tasks.length & 255];
  for (const id of tasks) {
    const r = progress.tasks[id];
    if (!r) { bytes.push(0, 0); continue; }
    const b1 = (r.solved ? 1 : 0) | ((r.stars & 3) << 1) | ((Math.min(r.hints || 0, 5) & 7) << 3) | (r.firstTry ? 64 : 0);
    bytes.push(b1, Math.min(r.attempts || 0, 255));
  }
  bytes.push(levels.length);
  for (const code of levels) {
    const l = progress.lessons[code];
    bytes.push(((l?.status || 0) & 3) | (progress.pw[code] ? 4 : 0));
  }
  const days = Math.max(0, Math.floor((Date.now() - EPOCH) / 86400000));
  bytes.push(days >> 8, days & 255);
  return new Uint8Array(bytes);
}

export function unpackProgress(bytes, slots) {
  let i = 0;
  const format = bytes[i++];
  if (format !== FORMAT) throw new Error('format');
  const n = (bytes[i++] << 8) | bytes[i++];
  const p = emptyProgress();
  for (let k = 0; k < n; k++) {
    const b1 = bytes[i++], b2 = bytes[i++];
    if (b1 === undefined || b2 === undefined) throw new Error('short');
    const id = slots.tasks[k];
    if (!id || (b1 === 0 && b2 === 0)) continue;
    p.tasks[id] = { solved: Boolean(b1 & 1), stars: (b1 >> 1) & 3, hints: (b1 >> 3) & 7, firstTry: Boolean(b1 & 64), attempts: b2 };
  }
  const L = bytes[i++];
  if (L === undefined) throw new Error('short');
  for (let k = 0; k < L; k++) {
    const b = bytes[i++];
    if (b === undefined) throw new Error('short');
    const code = slots.levels[k];
    if (!code) continue;
    if (b & 3) p.lessons[code] = { status: b & 3, best: 0, read: [] };
    if (b & 4) p.pw[code] = true;
  }
  const d = (bytes[i++] << 8) | bytes[i++];
  if (Number.isNaN(d) || i > bytes.length) throw new Error('short');
  p.updated = new Date(EPOCH + d * 86400000).toISOString();
  return p;
}

export async function encodeSaveCode(progress, slots) {
  const payload = toB64url(await deflate(packProgress(progress, slots)));
  return PREFIX + payload + checksum(payload);
}

export async function decodeSaveCode(code, slots) {
  const clean = String(code).trim().replace(/\s+/g, '');
  if (!clean.startsWith('PQ')) throw new Error('prefix');
  const m = clean.match(/^PQ(\d+)-([A-Za-z0-9_-]+)$/);
  if (!m) throw new Error('prefix');
  if (Number(m[1]) !== FORMAT) throw new Error('version');
  const body = m[2];
  if (body.length < 5) throw new Error('short');
  const payload = body.slice(0, -4);
  if (checksum(payload) !== body.slice(-4)) throw new Error('checksum');
  return unpackProgress(await inflate(fromB64url(payload)), slots);
}
