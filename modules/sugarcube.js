/**
 * KreshEdit - modules/sugarcube.js
 * Handles Twine/SugarCube .save files.
 *
 * SugarCube saves appear in three forms:
 *   1. Plain JSON
 *   2. Base64-encoded JSON
 *   3. Base64-encoded + zlib-deflated JSON  (most common in SugarCube 2)
 *
 * This module bundles a minimal zlib inflate/deflate via the pako library
 * loaded from a CDN. Pako is MIT licensed: https://github.com/nodeca/pako
 *
 * Because this module is an ES module loaded at runtime, we lazy-load pako
 * once and cache the result.
 */

(function () {
const {
  ENC,
  DEC,
  bufToString,
  base64ToBytes,
  bytesToBase64,
  isLikelyBase64
} = window.KreshUtils;


// ---- Helpers ---------------------------------------------------------------------------

function looksLikeSugarCube(obj) {
  if (typeof obj !== 'object' || obj === null) return false;
  if (!obj.state || typeof obj.state !== 'object') return false;

  // SugarCube 2 always has at least one of these:
  if ('variables' in obj.state) return true;
  if ('history' in obj.state) return true;
  if ('temporary' in obj.state) return true;

  return false;
}

// ---- detect ------------------------------------------------------------------------
function detect(buffer) {
  try {
    const str = bufToString(buffer).trim();

    // 1. Plain JSON
    try {
      const obj = JSON.parse(str);
      if (looksLikeSugarCube(obj)) return true;
    } catch (_) {}

    // 2. Base64 - JSON
    if (isLikelyBase64(str)) {
      try {
        const obj = JSON.parse(DEC.decode(base64ToBytes(str)));
        if (looksLikeSugarCube(obj)) return true;
      } catch (_) {}
    }

    // 3. Base64 - zlib - JSON - requires pako; skip in synchronous detect.
    // We do a cheap heuristic: if the base64 bytes, when decoded, start with
    // zlib magic (0x78 0x9C | 0x78 0xDA | 0x78 0x01 | 0x78 0x5E), flag it.
    if (isLikelyBase64(str)) {
      try {
        const bytes = base64ToBytes(str);
        if (
          bytes.length > 4 &&
          bytes[0] === 0x78 &&
          (bytes[1] === 0x9c || bytes[1] === 0xda || bytes[1] === 0x01 || bytes[1] === 0x5e)
        ) {
          return true; // Very likely zlib; full decode will confirm.
        }
      } catch (_) {}
    }

    return false;
  } catch (_) {
    return false;
  }
}

// ---- decode --------------------------------------------------------------------------------
async function decode(buffer) {
  const str = bufToString(buffer).trim();

  // 1. Plain JSON
  try {
    const obj = JSON.parse(str);
    if (looksLikeSugarCube(obj)) {
      return { text: JSON.stringify(obj, null, 2), metadata: { encoding: 'json' } };
    }
  } catch (_) {}

  // 2. Base64 - JSON
  if (isLikelyBase64(str)) {
    try {
      const obj = JSON.parse(DEC.decode(base64ToBytes(str)));
      if (looksLikeSugarCube(obj)) {
        return { text: JSON.stringify(obj, null, 2), metadata: { encoding: 'base64' } };
      }
    } catch (_) {}
  }

  // 3. Base64 - zlib - JSON
  if (isLikelyBase64(str)) {
    const pako = await window.KreshPako;
    try {
      const compressed = base64ToBytes(str);
      const inflated   = pako.inflate(compressed);
      const json       = DEC.decode(inflated);
      const obj        = JSON.parse(json);
      if (looksLikeSugarCube(obj)) {
        return { text: JSON.stringify(obj, null, 2), metadata: { encoding: 'base64+zlib' } };
      }
    } catch (_) {}
  }

  throw new Error('sugarcube: could not decode buffer in any supported encoding');
}

// ---- encode -----------------------------------------------------------------------
async function encode(text, metadata) {
  const obj = JSON.parse(text);
  const encoding = (metadata && metadata.encoding) || 'json';

  if (encoding === 'json') {
    return ENC.encode(JSON.stringify(obj));
  }

  if (encoding === 'base64') {
    const bytes = ENC.encode(JSON.stringify(obj));
    const b64 = bytesToBase64(bytes);
    return ENC.encode(b64);
  }

  if (encoding === 'base64+zlib') {
    const pako = await window.KreshPako;
    const jsonBytes  = ENC.encode(JSON.stringify(obj));
    const compressed = pako.deflate(jsonBytes);
    return ENC.encode(bytesToBase64(compressed));
  }

  throw new Error(`sugarcube: unknown encoding "${encoding}"`);
}

window.KreshModules = window.KreshModules || {};
window.KreshModules.sugarcube = { detect, decode, encode };
})();
