/**
 * KreshEdit  modules/rpgmaker_mv.js
 * Handles RPGMaker MV and MZ save files.
 *
 * Format: base64-encoded zlib-deflated JSON string.
 * The JSON is a flat array where index 0 is null and subsequent indices are
 * slot objects (RPGMaker's StorageManager format).
 *
 * Relies on pako (loaded from CDN) for zlib inflate/deflate.
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


// ---- Helpers -----------------------------------------------------------------------

function isZlibMagic(bytes) {
  if (bytes.length < 2) return false;
  return (
    bytes[0] === 0x78 &&
    (bytes[1] === 0x9c || bytes[1] === 0xda || bytes[1] === 0x01 || bytes[1] === 0x5e)
  );
}

// ---- detect ------------------------------------------------------------------------
function detect(buffer) {
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

// ---- decode ------------------------------------------------------------------------
async function decode(buffer) {
  const pako = await window.KreshPako;
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

// ---- encode -----------------------------------------------------------------------
async function encode(text, metadata) {
  const pako = await window.KreshPako;
  const obj  = JSON.parse(text);
  const json = JSON.stringify(obj);

  const jsonBytes  = ENC.encode(json);
  const compressed = pako.deflate(jsonBytes);
  const b64        = bytesToBase64(compressed);

  return ENC.encode(b64);
}

window.KreshModules = window.KreshModules || {};
window.KreshModules.rpgmaker_mv = { detect, decode, encode };
})();
