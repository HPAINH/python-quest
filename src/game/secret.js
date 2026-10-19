export const normalizePassword = (s) => String(s).toUpperCase().replace(/[\s_]+/g, '').replace(/[–—]/g, '-');

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return new Uint8Array(buf);
}

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function hashPassword(s) {
  return hex(await sha256('pq-pass:' + normalizePassword(s)));
}

export async function decryptSecret(id, b64) {
  const key = await sha256('pq-v1:' + id);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) ^ key[i % key.length] ^ (i * 31 & 255);
  return new TextDecoder().decode(out);
}
