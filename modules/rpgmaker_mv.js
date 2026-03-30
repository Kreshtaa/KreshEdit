/**
 * KreshEdit — modules/rpgmaker_mv.js
 * Handles RPGMaker MV and MZ save files.
 *
 * Format: base64-encoded zlib-deflated JSON string.
 * The JSON is a flat array where index 0 is null and subsequent indices are
 * slot objects (RPGMaker's StorageManager format).
 *
 * Relies on pako (loaded from CDN) for zlib inflate/deflate.
 */

import {
  ENC,
  DEC,
  bufToString,
  base64ToBytes,
  bytesToBase64,
  isLikelyBase64
} from './_utils.js';

// ── Pako loader ───────────────────────────────────────────────────────────────
let _pako = null;

async function getPako() {
  if (_pako) return _pako;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js';
    s.onload  = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  _pako = window.pako;
  return _pako;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isZlibMagic(bytes) {
  if (bytes.length < 2) return false;
  return (
    bytes[0] === 0x78 &&
    (bytes[1] === 0x9c || bytes[1] === 0xda || bytes[1] === 0x01 || bytes[1] === 0x5e)
  );
}

// ── detect ─────────────────────────────────────────────────────────────────────
export function detect(buffer) {
  try {
    const str = bufToString(buffer).trim();
    if (!str || !isLikelyBase64(str)) return false;

    const bytes = base64ToBytes(str);
    if (!isZlibMagic(bytes)) return false;

    // We won't inflate synchronously here; presence of zlib magic after base64
    // plus no SugarCube-style detection is sufficient for RPGMaker.
    // (SugarCube module runs first and checks for SC-specific keys.)
    return true;
  } catch (_) {
    return false;
  }
}

// ── decode ─────────────────────────────────────────────────────────────────────
export async function decode(buffer) {
  const pako = await getPako();
  const str  = bufToString(buffer).trim();

  if (!isLikelyBase64(str)) throw new Error('rpgmaker_mv: not base64');

  const compressed = base64ToBytes(str);

  if (!isZlibMagic(compressed)) throw new Error('rpgmaker_mv: not zlib compressed');

  const inflated = pako.inflate(compressed);
  const json     = DEC.decode(inflated);
  const obj      = JSON.parse(json);

  return {
    text:     JSON.stringify(obj, null, 2),
    metadata: { encoding: 'base64+zlib' },
  };
}

// ── encode ─────────────────────────────────────────────────────────────────────
export async function encode(text, metadata) {
  const pako = await getPako();
  const obj  = JSON.parse(text);
  const json = JSON.stringify(obj);

  const jsonBytes  = ENC.encode(json);
  const compressed = pako.deflate(jsonBytes);
  const b64        = bytesToBase64(compressed);

  return ENC.encode(b64);
}
