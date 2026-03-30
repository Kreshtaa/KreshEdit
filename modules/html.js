/**
 * KreshEdit — modules/html.js
 * Handles plain JSON saves and base64-encoded JSON saves.
 * This is a broad fallback module placed last in the detection order.
 */

import { ENC, DEC, bufToString, base64ToBytes, bytesToBase64, isLikelyBase64 } from './_utils.js';


function tryBase64DecodeToJson(str) {
  try {
    const decoded = DEC.decode(base64ToBytes(str));
    return JSON.parse(decoded);
  } catch (_) {
    return null;
  }
}

function tryParseJson(str) {
  try {
    return JSON.parse(str);
  } catch (_) {
    return null;
  }
}

/**
 * detect(buffer) → boolean
 * Returns true if the buffer is valid JSON or base64-encoded JSON.
 */
export function detect(buffer) {
  try {
    const str = bufToString(buffer).trim();
    if (!str) return false;

    // Plain JSON?
    if (tryParseJson(str) !== null) return true;

    // Base64 → JSON?
    if (isLikelyBase64(str) && tryBase64DecodeToJson(str) !== null) return true;

    return false;
  } catch (_) {
    return false;
  }
}

/**
 * decode(buffer) → { text, metadata }
 */
export function decode(buffer) {
  const str = bufToString(buffer).trim();

  // Try plain JSON first
  const plain = tryParseJson(str);
  if (plain !== null) {
    return {
      text:     JSON.stringify(plain, null, 2),
      metadata: { encoding: 'json' },
    };
  }

  // Try base64 → JSON
  if (isLikelyBase64(str)) {
    const obj = tryBase64DecodeToJson(str);
    if (obj !== null) {
      return {
        text:     JSON.stringify(obj, null, 2),
        metadata: { encoding: 'base64' },
      };
    }
  }

  throw new Error('html: could not decode buffer as JSON or base64 JSON');
}

/**
 * encode(text, metadata) → Uint8Array
 */
export function encode(text, metadata) {
  // Validate JSON
  const obj = JSON.parse(text);
  const str = JSON.stringify(obj);

  if (metadata && metadata.encoding === 'base64') {
    const bytes = ENC.encode(str);
    const b64 = bytesToBase64(bytes);
    return ENC.encode(b64);
  }

  return ENC.encode(str);
}
