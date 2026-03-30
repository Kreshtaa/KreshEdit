// modules/_utils.js
// Shared helpers for UTF‑8 safe base64 and buffer handling.

export const ENC = new TextEncoder();
export const DEC = new TextDecoder();

// Convert base64 → Uint8Array (UTF‑8 safe)
export function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Convert Uint8Array → base64 (UTF‑8 safe)
export function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// Convert ArrayBuffer/Uint8Array → string
export function bufToString(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return DEC.decode(bytes);
}

// Stricter base64 detection
export function isLikelyBase64(str) {
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
