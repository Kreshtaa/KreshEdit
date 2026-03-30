/**
 * KreshEdit - modules/gzip_json.js
 * Handles raw gzip-compressed JSON saves.
 *
 * Some custom HTML/JS games and Electron/NW.js games write a gzip-compressed
 * JSON file directly to disk as binary, without a base64 wrapper.
 *
 * Detection: gzip magic bytes 0x1F 0x8B at the start of the file.
 * Decompression: uses the browser-native DecompressionStream API (no CDN needed).
 * Compression: uses the browser-native CompressionStream API.
 *
 * NOTE: this module intentionally runs before renpy.js in the detection chain.
 * Ren'Py also checks for gzip magic (gzip-wrapped pickle), so gzip_json must
 * claim gzip+JSON files first; anything that decompresses to non-JSON falls
 * through to renpy.js.
 */

(function () {
const { ENC } = window.KreshUtils;

// ---- Helpers -----------------------------------------------------------------------

function isGzip(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

async function gunzip(buffer) {
  const ds     = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  writer.write(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
  writer.close();

  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out   = new Uint8Array(total);
  let offset  = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
  return out;
}

async function gzipBytes(data) {
  const cs     = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  const reader = cs.readable.getReader();

  writer.write(data instanceof Uint8Array ? data : new Uint8Array(data));
  writer.close();

  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out   = new Uint8Array(total);
  let offset  = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
  return out;
}

// ---- detect ------------------------------------------------------------------------
function detect(buffer) {
  // Fast synchronous check — full JSON parse happens in decode.
  return isGzip(buffer);
}

// ---- decode ------------------------------------------------------------------------
async function decode(buffer) {
  const decompressed = await gunzip(buffer);
  const str = new TextDecoder().decode(decompressed).trim();
  const obj = JSON.parse(str); // throws on non-JSON — lets renpy.js catch gzip pickle
  return {
    text:     JSON.stringify(obj, null, 2),
    metadata: { encoding: 'gzip-json' },
  };
}

// ---- encode ------------------------------------------------------------------------
async function encode(text, _metadata) {
  const obj       = JSON.parse(text);
  const jsonBytes = ENC.encode(JSON.stringify(obj));
  return gzipBytes(jsonBytes);
}

window.KreshModules = window.KreshModules || {};
window.KreshModules.gzip_json = { detect, decode, encode };
})();
