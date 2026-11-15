const SIZES = [160, 144, 128, 112, 96, 80, 72];
const QUALITIES = [0.72, 0.6, 0.5, 0.4, 0.32, 0.26];

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, quality);
  });
}

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, Math.min(i + chunk, bytes.length)),
    );
  }
  return { base64: btoa(binary), bytes: bytes.length };
}

let webpSupport;

export async function supportsWebp() {
  if (webpSupport !== undefined) return webpSupport;
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  const blob = await canvasToBlob(canvas, 'image/webp', 0.8);
  webpSupport = !!blob && blob.type === 'image/webp';
  return webpSupport;
}

function coverDraw(ctx, bitmap, size, circular, mime) {
  ctx.clearRect(0, 0, size, size);
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#0b121c';
    ctx.fillRect(0, 0, size, size);
  }
  ctx.save();
  if (circular) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 0.5, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  ctx.restore();
}

async function encodeSquare(bitmap, size, mime, quality, circular) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { alpha: mime !== 'image/jpeg' });
  coverDraw(ctx, bitmap, size, circular, mime);
  const blob = await canvasToBlob(canvas, mime, quality);
  if (!blob) throw new Error('encode');
  const encoded = await blobToBase64(blob);
  return { ...encoded, canvas, mime };
}

/**
 * Center-crop to a circle and compress until the base64 payload fits `maxChars`.
 * Returns the best quality that fits, or the smallest attempt if none do.
 */
export async function compressPortrait(bitmap, { maxChars, maxSize = 160 }) {
  const webp = await supportsWebp();
  const mime = webp ? 'image/webp' : 'image/jpeg';
  const imageType = webp ? 'webp' : 'jpeg';
  const sizes = SIZES.filter((size) => size <= maxSize);
  let smallest = null;

  for (const size of sizes) {
    for (const quality of QUALITIES) {
      const encoded = await encodeSquare(bitmap, size, mime, quality, true);
      const chars = encoded.base64.length;
      const item = {
        base64: encoded.base64,
        bytes: encoded.bytes,
        size,
        quality,
        chars,
        imageType,
        mime,
      };
      smallest = item;
      if (chars <= maxChars) {
        return { ...item, reduced: size < 160, overBudget: false };
      }
    }
  }

  return {
    ...smallest,
    reduced: true,
    overBudget: true,
  };
}

/** Sharp square preview for the live scene, separate from the tiny share image. */
export function makePreviewCanvas(bitmap, size = 384) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { alpha: false });
  coverDraw(ctx, bitmap, size, false, 'image/jpeg');
  return canvas;
}

export async function loadBitmap(file) {
  if (!file || !file.type.startsWith('image/')) {
    const error = new Error('type');
    error.code = 'type';
    throw error;
  }
  if (file.size > 12 * 1024 * 1024) {
    const error = new Error('size');
    error.code = 'size';
    throw error;
  }
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    try {
      return await createImageBitmap(file);
    } catch {
      const error = new Error('decode');
      error.code = 'decode';
      throw error;
    }
  }
}
