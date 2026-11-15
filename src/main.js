import './style.css';
import { createAudio } from './audio.js';
import {
  DEFAULT_BLESSING,
  MESSAGE_MAX,
  NAME_MAX,
  PLACEHOLDER_NAME,
  TARGET_URL_LENGTH,
  WARN_URL_LENGTH,
} from './content.js';
import { compressPortrait, loadBitmap, makePreviewCanvas } from './image.js';
import { createScene } from './scene.js';
import {
  compactTextHash,
  decodeShare,
  encodeShare,
  imageDataUrl,
  looksLikeShare,
} from './share.js';

const panel = document.querySelector('#panel');
const viewer = document.querySelector('#viewer');
const viewerMsg = document.querySelector('#viewer-msg');
const srLive = document.querySelector('#sr-live');
const preview = document.querySelector('#preview-blessing');
const nameInput = document.querySelector('#name');
const messageInput = document.querySelector('#message');
const messageCount = document.querySelector('#message-count');
const fileInput = document.querySelector('#file');
const drop = document.querySelector('#drop');
const thumb = document.querySelector('#thumb');
const removeBtn = document.querySelector('#remove');
const shrinkBtn = document.querySelector('#shrink');
const generateBtn = document.querySelector('#generate');
const shareBox = document.querySelector('#share-box');
const linkInput = document.querySelector('#link');
const copyBtn = document.querySelector('#copy');
const nativeShareBtn = document.querySelector('#native-share');
const openViewBtn = document.querySelector('#open-view');
const statusEl = document.querySelector('#status');
const warnEl = document.querySelector('#warn');
const veil = document.querySelector('#veil');
const replayBtn = document.querySelector('#replay');
const soundBtn = document.querySelector('#sound');
const brand = document.querySelector('#brand');
const createLink = document.querySelector('#create');
const fallback = document.querySelector('#fallback');
const fallbackImg = document.querySelector('#fallback-img');
const fallbackName = document.querySelector('#fallback-name');
const fallbackText = document.querySelector('#fallback-text');
const canvas = document.querySelector('#scene');
const wishToast = document.querySelector('#wish-toast');

const audio = createAudio();
const portrait = {
  bitmap: null,
  image: null,
  pending: null,
  token: 0,
};

let mode = 'edit';
let viewCaptionToken = 0;
let scene = null;
let frameReady = false;
let booted = false;
let launched = false;

function pageUrl(hash) {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  if (hash) url.hash = hash.startsWith('#') ? hash.slice(1) : hash;
  return url.href;
}

function cleanName(value) {
  return value.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

function cleanMessage(value) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, MESSAGE_MAX);
}

function liveName() {
  return cleanName(nameInput.value);
}

function liveBlessing() {
  return cleanMessage(messageInput.value) || DEFAULT_BLESSING;
}

function setStatus(text, tone = 'info') {
  statusEl.textContent = text || '';
  statusEl.className = `status ${tone}`;
}

function formatLen(length) {
  if (length < 1000) return `${length} 字符`;
  return `${(length / 1000).toFixed(1)}k 字符`;
}

function errorText(error) {
  if (error?.code === 'type') return '请换成 JPG、PNG 或 WebP 图片。';
  if (error?.code === 'size') return '图片请小于 12MB。';
  if (error?.code === 'decode') return '这张图片读不出来，换一张试试。';
  return '肖像处理失败，请换一张图片。';
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image'));
    image.src = url;
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

function applyChrome() {
  document.body.dataset.mode = mode;
  const viewing = mode === 'view';
  panel.hidden = viewing;
  viewer.hidden = !viewing;
  replayBtn.hidden = !viewing;
  if (!viewing) viewer.classList.remove('is-on');
  document.documentElement.classList.remove('boot-view');
}

function syncPreview() {
  const name = liveName();
  scene?.setName(name || PLACEHOLDER_NAME, !name);
  const blessing = liveBlessing();
  preview.textContent = blessing;
  preview.classList.toggle('is-default', !cleanMessage(messageInput.value));
  messageCount.textContent = String(messageInput.value.length);
  if (!shareBox.hidden && name) linkInput.value = pageUrl(currentHash());
  if (portrait.image) describePortrait();
}

function currentHash() {
  const name = liveName();
  if (!name) return '';
  return encodeShare({
    name,
    message: liveBlessing(),
    image: portrait.image?.base64 || '',
    imageType: portrait.image?.imageType || '',
  });
}

function describePortrait() {
  if (!portrait.image) {
    warnEl.hidden = true;
    shrinkBtn.hidden = true;
    return null;
  }
  const hash = encodeShare({
    name: liveName() || '名字',
    message: liveBlessing(),
    image: portrait.image.base64,
    imageType: portrait.image.imageType,
  });
  const length = pageUrl(hash).length;
  const size = portrait.image.size;
  const tooLong = length > WARN_URL_LENGTH || portrait.image.overBudget;
  shrinkBtn.hidden = !tooLong || size <= 72;
  if (tooLong) {
    warnEl.hidden = false;
    warnEl.textContent = `链接约 ${formatLen(length)}，部分聊天工具可能会截断。可以换一张色彩更单纯的照片，或改用更小的肖像。`;
  } else {
    warnEl.hidden = true;
  }
  const lead = portrait.image.reduced
    ? `已将肖像缩为 ${size}px 圆形，链接约 ${formatLen(length)}。`
    : `肖像 ${size}px · 链接约 ${formatLen(length)}，适合分享。`;
  return { length, text: lead, tooLong };
}

async function fitPortrait(bitmap, { maxSize = 160, target = TARGET_URL_LENGTH } = {}) {
  const overhead = pageUrl(compactTextHash(liveName() || '名字', liveBlessing())).length;
  const maxChars = Math.max(900, target - overhead - 4);
  return compressPortrait(bitmap, { maxChars, maxSize });
}

function showThumb(canvas) {
  thumb.src = canvas.toDataURL('image/jpeg', 0.86);
  thumb.alt = '已裁成圆形的肖像预览';
  drop.classList.add('has-image');
  removeBtn.hidden = false;
}

async function handleFile(file) {
  const token = ++portrait.token;
  setStatus('正在压缩肖像…');
  generateBtn.disabled = true;
  const job = (async () => {
    const bitmap = await loadBitmap(file);
    if (token !== portrait.token) {
      bitmap.close?.();
      return;
    }
    portrait.bitmap?.close?.();
    portrait.bitmap = bitmap;
    const image = await fitPortrait(bitmap);
    if (token !== portrait.token) return;
    portrait.image = image;
    const previewCanvas = makePreviewCanvas(bitmap);
    scene?.setPortrait(previewCanvas);
    showThumb(previewCanvas);
    const meta = describePortrait();
    setStatus(meta?.text || '肖像已准备好。', meta?.tooLong ? 'warn' : 'ok');
    if (!shareBox.hidden) linkInput.value = pageUrl(currentHash());
  })();
  portrait.pending = job;
  try {
    await job;
  } catch (error) {
    if (token === portrait.token) setStatus(errorText(error), 'error');
  } finally {
    if (token === portrait.token) generateBtn.disabled = false;
  }
}

function clearPortrait() {
  portrait.token += 1;
  portrait.bitmap?.close?.();
  portrait.bitmap = null;
  portrait.image = null;
  portrait.pending = null;
  scene?.setPortrait(null);
  thumb.removeAttribute('src');
  thumb.alt = '';
  drop.classList.remove('has-image');
  removeBtn.hidden = true;
  shrinkBtn.hidden = true;
  warnEl.hidden = true;
}

function clearEditor() {
  nameInput.value = '';
  messageInput.value = '';
  nameInput.removeAttribute('aria-invalid');
  shareBox.hidden = true;
  linkInput.value = '';
  clearPortrait();
  setStatus('');
  syncPreview();
}

async function showView(data) {
  mode = 'view';
  applyChrome();
  const blessing = data.message || DEFAULT_BLESSING;
  viewerMsg.textContent = blessing;
  srLive.textContent = `${data.name}。${blessing}`;
  document.title = `${data.name} · 星诞祝福`;
  fallbackName.textContent = data.name;
  fallbackText.textContent = blessing;
  scene?.setName(data.name, false);
  if (data.image) {
    try {
      const image = await loadImage(imageDataUrl(data.image, data.imageType));
      scene?.setPortrait(image);
      fallbackImg.src = image.src;
      fallbackImg.alt = `${data.name}的肖像`;
      fallbackImg.hidden = false;
    } catch {
      scene?.setPortrait(null);
      fallbackImg.hidden = true;
    }
  } else {
    scene?.setPortrait(null);
    fallbackImg.hidden = true;
  }
  if (launched) scene?.start('view');
  const captionToken = ++viewCaptionToken;
  window.setTimeout(() => {
    if (captionToken === viewCaptionToken && mode === 'view') viewer.classList.add('is-on');
  }, 1200);
}

function showEdit() {
  mode = 'edit';
  applyChrome();
  document.title = '星诞 · 全息生日祝福';
  syncPreview();
  if (launched) scene?.start('edit');
}

function goCreate(event) {
  event?.preventDefault();
  clearEditor();
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  history.pushState({}, '', url.pathname + url.search);
  showEdit();
}

async function route() {
  if (looksLikeShare(location.hash)) {
    const data = decodeShare(location.hash);
    if (data) {
      await showView(data);
      return;
    }
    showEdit();
    setStatus('这条链接不完整，无法打开祝福。你可以制作一份新的。', 'error');
    return;
  }
  showEdit();
}

function launch() {
  if (launched || !booted || !frameReady) return;
  launched = true;
  scene?.start(mode);
  veil.classList.add('is-gone');
}

async function generate() {
  const name = liveName();
  if (!name) {
    nameInput.setAttribute('aria-invalid', 'true');
    setStatus('先写下名字，再生成链接。', 'error');
    nameInput.focus();
    return;
  }
  nameInput.removeAttribute('aria-invalid');
  if (portrait.pending) {
    generateBtn.disabled = true;
    try {
      await portrait.pending;
    } finally {
      generateBtn.disabled = false;
    }
  }
  const hash = currentHash();
  const url = pageUrl(hash);
  linkInput.value = url;
  shareBox.hidden = false;
  const meta = describePortrait();
  const copied = await copyText(url);
  const lengthNote = meta?.text || `链接约 ${formatLen(url.length)}。`;
  if (meta?.tooLong) {
    setStatus(`${lengthNote} 链接已生成，发送前请留意长度。`, 'warn');
  } else {
    setStatus(copied ? `${lengthNote} 已复制。` : `${lengthNote} 请手动复制。`, copied ? 'ok' : 'info');
  }
  linkInput.focus();
  linkInput.select();
}

function bind() {
  nameInput.addEventListener('input', () => {
    nameInput.removeAttribute('aria-invalid');
    syncPreview();
  });
  messageInput.addEventListener('input', syncPreview);
  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      messageInput.focus();
    }
  });
  document.querySelector('#editor-form').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      generate();
    }
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) handleFile(file);
  });
  removeBtn.addEventListener('click', () => {
    clearPortrait();
    setStatus('已移除肖像。');
    if (!shareBox.hidden && liveName()) linkInput.value = pageUrl(currentHash());
  });
  shrinkBtn.addEventListener('click', async () => {
    if (!portrait.bitmap || !portrait.image) return;
    const next = Math.max(72, portrait.image.size - 24);
    setStatus('正在换一张更小的肖像…');
    try {
      portrait.image = await fitPortrait(portrait.bitmap, { maxSize: next, target: 4200 });
      const previewCanvas = makePreviewCanvas(portrait.bitmap);
      scene?.setPortrait(previewCanvas);
      showThumb(previewCanvas);
      const meta = describePortrait();
      setStatus(meta?.text || '已改用更小的肖像。', meta?.tooLong ? 'warn' : 'ok');
      if (!shareBox.hidden && liveName()) linkInput.value = pageUrl(currentHash());
    } catch (error) {
      setStatus(errorText(error), 'error');
    }
  });
  generateBtn.addEventListener('click', generate);
  copyBtn.addEventListener('click', async () => {
    if (!linkInput.value) return;
    const ok = await copyText(linkInput.value);
    setStatus(ok ? '链接已复制。' : '无法自动复制，请长按链接手动复制。', ok ? 'ok' : 'warn');
  });
  openViewBtn.addEventListener('click', () => {
    const url = linkInput.value || (liveName() ? pageUrl(currentHash()) : '');
    if (!url) {
      setStatus('先写下名字，再生成链接。', 'error');
      return;
    }
    const opened = window.open(url, '_blank', 'noopener');
    if (!opened) setStatus('浏览器拦住了新标签，请复制链接后打开。', 'warn');
  });
  if (navigator.share) nativeShareBtn.hidden = false;
  nativeShareBtn.addEventListener('click', async () => {
    const url = linkInput.value;
    if (!url) return;
    try {
      await navigator.share({
        title: `${liveName()} · 星诞祝福`,
        text: liveBlessing(),
        url,
      });
    } catch (error) {
      if (error?.name !== 'AbortError') setStatus('系统分享没有完成，可以改用复制链接。', 'warn');
    }
  });
  replayBtn.addEventListener('click', () => {
    if (mode === 'view') scene?.start('view');
  });
  soundBtn.addEventListener('click', async () => {
    const on = await audio.toggle();
    soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    soundBtn.classList.toggle('is-on', on);
    soundBtn.querySelector('.sound-label').textContent = on ? '声音开' : '声音';
  });
  brand.addEventListener('click', (event) => {
    if (mode === 'view') goCreate(event);
  });
  createLink.addEventListener('click', goCreate);

  let dragDepth = 0;
  window.addEventListener('dragenter', (event) => {
    if (![...event.dataTransfer?.types || []].includes('Files')) return;
    dragDepth += 1;
    drop.classList.add('is-hot');
  });
  window.addEventListener('dragover', (event) => {
    if (![...event.dataTransfer?.types || []].includes('Files')) return;
    event.preventDefault();
  });
  window.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) drop.classList.remove('is-hot');
  });
  window.addEventListener('drop', (event) => {
    if (![...event.dataTransfer?.types || []].includes('Files')) return;
    event.preventDefault();
    dragDepth = 0;
    drop.classList.remove('is-hot');
    const file = event.dataTransfer.files?.[0];
    if (file && mode === 'edit') handleFile(file);
  });

  window.addEventListener('hashchange', () => {
    route();
  });
  window.addEventListener('popstate', () => {
    route();
  });

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  motion.addEventListener?.('change', () => scene?.setReduced(motion.matches));
}

function enableFallback(data) {
  fallback.hidden = false;
  veil.classList.add('is-gone');
  if (!data) {
    fallbackName.textContent = '星诞';
    fallbackText.textContent = '这台设备显示不了立体场景，分享链接仍然可以生成。';
    return;
  }
  fallbackName.textContent = data.name;
  fallbackText.textContent = data.message || DEFAULT_BLESSING;
  if (data.image) {
    fallbackImg.src = imageDataUrl(data.image, data.imageType);
    fallbackImg.alt = `${data.name}的肖像`;
    fallbackImg.hidden = false;
  }
}

async function boot() {
  bind();
  syncPreview();
  try {
    scene = createScene(canvas, {
      onFirstFrame() {
        frameReady = true;
        launch();
      },
      onCaption(visible) {
        viewer.classList.toggle('is-on', visible);
      },
      onContextLost() {
        setStatus('画面中断了，请刷新页面。', 'error');
      },
      onInteract({ text }) {
        wishToast.textContent = text;
        wishToast.classList.add('is-on');
        window.clearTimeout(wishToast._timer);
        wishToast._timer = window.setTimeout(() => wishToast.classList.remove('is-on'), 1400);
        if (audio.enabled) audio.playChime();
      },
    });
  } catch {
    scene = null;
    const data = looksLikeShare(location.hash) ? decodeShare(location.hash) : null;
    if (data) await showView(data);
    else showEdit();
    enableFallback(data);
    booted = true;
    return;
  }

  try {
    await route();
  } catch {
    showEdit();
    setStatus('这条祝福暂时打不开。', 'error');
  }
  booted = true;
  launch();
  window.setTimeout(() => {
    frameReady = true;
    launch();
  }, 2800);
}

boot();
