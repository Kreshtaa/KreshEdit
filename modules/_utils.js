// modules/_utils.js
// Shared helpers for UTF8 safe base64 and buffer handling.

const ENC = new TextEncoder();
const DEC = new TextDecoder();

// Convert base64 - Uint8Array (UTF8 safe)
function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Convert Uint8Array - base64 (UTF8 safe)
function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// Convert ArrayBuffer/Uint8Array - string
function bufToString(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return DEC.decode(bytes);
}

// Stricter base64 detection
function isLikelyBase64(str) {
  const s = str.trim();
  if (s.length < 8) return false; // too short to be meaningful
  if (s.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]+=*$/.test(s)) return false;

  try {
    atob(s);
    return true;
  } catch {
    return false;
  }
}

window.KreshUtils = {
  ENC,
  DEC,
  base64ToBytes,
  bytesToBase64,
  bufToString,
  isLikelyBase64
};

// Shared pako loader — one CDN injection regardless of how many modules need it.
// Usage: const pako = await window.KreshPako;
window.KreshPako = (function () {
  if (window.pako) return Promise.resolve(window.pako);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js';
    s.onload  = () => resolve(window.pako);
    s.onerror = reject;
    document.head.appendChild(s);
  });
})();
