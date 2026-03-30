/**
 * KreshEdit - modules/module_template.js
 * ─────────────────────────────────────────────────────────────────────────────
 * TEMPLATE for writing new KreshEdit modules.
 * Copy this file, rename it, and implement detect / decode / encode.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * HOW THE MODULE SYSTEM WORKS
 * ───────────────────────────
 * Each module is an IIFE that registers itself on window.KreshModules:
 *
 *   window.KreshModules.my_format = { detect, decode, encode };
 *
 * main.js iterates MODULE_NAMES in order. For each name it calls detect().
 * If detect() returns true it calls decode(). If decode() throws, main.js
 * logs the failure and continues to the next module — so it is safe (and
 * sometimes necessary) to throw from decode when the buffer turns out not
 * to match after all.
 *
 * SHARED UTILITIES  (window.KreshUtils)
 * ──────────────────
 *   ENC            — TextEncoder instance
 *   DEC            — TextDecoder instance
 *   base64ToBytes  — base64 string → Uint8Array  (UTF-8 safe)
 *   bytesToBase64  — Uint8Array  → base64 string (UTF-8 safe)
 *   bufToString    — ArrayBuffer|Uint8Array → UTF-8 string
 *   isLikelyBase64 — quick heuristic check for standard base64 strings
 *
 * SHARED PAKO LOADER  (window.KreshPako)
 * ──────────────────────────────────────
 * If your format needs zlib inflate/deflate, await the shared loader instead
 * of injecting your own <script> tag:
 *
 *   const pako = await window.KreshPako;
 *   const inflated = pako.inflate(bytes);
 *
 * ADDING YOUR MODULE TO THE CHAIN
 * ────────────────────────────────
 * 1. Add a <script> tag in index.html (before main.js).
 * 2. Add the module name to MODULE_NAMES in main.js.
 *    Order matters — more specific formats should come before broad ones.
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

/**
 * detect(buffer) → boolean
 *
 * Called synchronously for every file the user imports.
 * Must be FAST and must NEVER throw — return false on any error.
 * Use cheap heuristics: magic bytes, header checks, lightweight string tests.
 * Do NOT fully parse the file here; save that for decode().
 *
 * If your heuristic overlaps with another module (e.g. both match the same
 * magic bytes), it is fine to return true and let decode() throw on mismatch —
 * main.js will continue to the next candidate automatically.
 */
function detect(_buffer) {
  try {
    // Binary magic-byte example:
    // const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    // return bytes.length >= 4 && bytes[0] === 0x12 && bytes[1] === 0x34;

    // Text / JSON example:
    // const str = bufToString(buffer).trim();
    // return isLikelyBase64(str);

    return false; // TODO: implement
  } catch (_) {
    return false;
  }
}

/**
 * decode(buffer) → { text: string, metadata: object }
 *          — or — async version returning the same shape
 *
 * Convert the raw file buffer into an editable JSON string.
 * May throw on genuine parse errors — main.js will catch the error,
 * log it, and try the next module in the chain.
 *
 * Rules:
 *  - Must NOT modify the original buffer.
 *  - metadata must carry everything encode() needs to reconstruct the file
 *    (encoding type, compression flags, etc.).
 */
function decode(_buffer) {
  // Plain JSON example:
  // const str = bufToString(buffer).trim();
  // const obj = JSON.parse(str); // throws → main.js tries next module
  // return {
  //   text:     JSON.stringify(obj, null, 2),
  //   metadata: { encoding: 'json' },
  // };

  throw new Error('module_template: decode() not implemented');
}

/**
 * encode(text, metadata) → Uint8Array
 *             — or —  async version returning Uint8Array
 *
 * Convert the edited JSON string back to the original file format.
 * Use metadata (returned by decode) to reproduce the exact encoding/
 * compression the game expects.
 *
 * Rules:
 *  - Always call JSON.parse(text) first — validates the editor content.
 *  - May throw on invalid input.
 */
function encode(_text, _metadata) {
  // Plain JSON example:
  // const obj = JSON.parse(text);
  // return ENC.encode(JSON.stringify(obj));

  throw new Error('module_template: encode() not implemented');
}

// ── Register ─────────────────────────────────────────────────────────────────
window.KreshModules = window.KreshModules || {};
window.KreshModules.module_template = { detect, decode, encode };
})();
