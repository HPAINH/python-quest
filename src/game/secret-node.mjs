import { createHash } from 'node:crypto';

export const normalizePassword = (s) => String(s).toUpperCase().replace(/[\s_]+/g, '').replace(/[–—]/g, '-');

export function hashPassword(s) {
  return createHash('sha256').update('pq-pass:' + normalizePassword(s)).digest('hex');
}

export function encryptSecret(id, text) {
  const key = createHash('sha256').update('pq-v1:' + id).digest();
  const data = Buffer.from(text, 'utf8');
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ key[i % key.length] ^ (i * 31 & 255);
  return out.toString('base64');
}

export function decryptSecret(id, b64) {
  const key = createHash('sha256').update('pq-v1:' + id).digest();
  const data = Buffer.from(b64, 'base64');
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ key[i % key.length] ^ (i * 31 & 255);
  return out.toString('utf8');
}
