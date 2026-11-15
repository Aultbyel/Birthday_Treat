import LZString from 'lz-string';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, Math.min(i + chunk, bytes.length)),
    );
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const binary = atob(normalized);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function toBase64Url(value) {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function cleanText(value, max) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

function buildCompact(name, message, image, imageType) {
  const imagePart = image ? `${imageType === 'webp' ? 'w' : 'j'}.${toBase64Url(image)}` : '';
  return `p=${toBase64Url(bytesToBase64(encoder.encode(name)))}.${toBase64Url(
    bytesToBase64(encoder.encode(message)),
  )}.${imagePart}`;
}

/**
 * Hash payload (no leading #). Uses lz-string when it beats a compact
 * base64url encoding — usually on text-only blessings. Photos stay compact,
 * because JPEG/WebP bytes do not shrink usefully a second time.
 */
export function encodeShare({ name, message, image = '', imageType = '' }) {
  const safeName = cleanText(name, 24);
  const safeMessage = cleanText(message, 120);
  const compact = buildCompact(safeName, safeMessage, image, imageType);
  const packed = LZString.compressToEncodedURIComponent(
    JSON.stringify({
      n: safeName,
      m: safeMessage,
      i: image || '',
      t: image ? imageType || 'jpeg' : '',
    }),
  );
  const lz = `z=${packed}`;
  return compact.length <= lz.length ? compact : lz;
}

/** Length of the text-only compact hash, used to budget the portrait. */
export function compactTextHash(name, message) {
  return buildCompact(cleanText(name, 24), cleanText(message, 120), '', '');
}

export function looksLikeShare(hash) {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  return raw.startsWith('p=') || raw.startsWith('z=');
}

export function decodeShare(hash) {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;
  try {
    if (raw.startsWith('z=')) {
      const json = LZString.decompressFromEncodedURIComponent(raw.slice(2));
      if (!json) return null;
      const data = JSON.parse(json);
      const name = cleanText(data.n, 24);
      if (!name) return null;
      const image = typeof data.i === 'string' && data.i.length < 200000 ? data.i : '';
      return {
        name,
        message: cleanText(data.m, 120),
        image,
        imageType: data.t === 'webp' ? 'webp' : 'jpeg',
      };
    }
    if (raw.startsWith('p=')) {
      const parts = raw.slice(2).split('.');
      if (parts.length < 2 || !parts[0]) return null;
      const name = cleanText(decoder.decode(base64ToBytes(parts[0])), 24);
      if (!name) return null;
      const message = cleanText(decoder.decode(base64ToBytes(parts[1] || '')), 120);
      let image = '';
      let imageType = 'jpeg';
      if (parts[2] === 'w' || parts[2] === 'j') {
        imageType = parts[2] === 'w' ? 'webp' : 'jpeg';
        try {
          const urlBytes = parts.slice(3).join('.');
          if (urlBytes.length > 0 && urlBytes.length < 200000) {
            image = bytesToBase64(base64ToBytes(urlBytes));
          }
        } catch {
          image = '';
        }
      }
      return { name, message, image, imageType };
    }
  } catch {
    return null;
  }
  return null;
}

export function imageDataUrl(image, imageType) {
  if (!image) return '';
  const mime = imageType === 'webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${image}`;
}
