/**
 * KreshEdit — modules/unity_json.js
 * Handles Unity games that persist save data as JSON or base64-encoded JSON.
 *
 * Common patterns:
 *  - PlayerPrefs-exported JSON files
 *  - JsonUtility-serialized files written directly to Application.persistentDataPath
 *  - Third-party save systems (Easy Save, SaveSystem, etc.)
 *
 * Detection uses a heuristic: valid JSON that contains at least one key
 * that looks like a common Unity save pattern (m_, version, saveData, etc.)
 * OR plain base64 that decodes to such JSON.
 */

import {
  ENC,
  DEC,
  bufToString,
  base64ToBytes,
  bytesToBase64,
  isLikelyBase64
} from './_utils.js';

function tryBase64ToJson(str) {
  try {
    const decoded = DEC.decode(base64ToBytes(str));
    return JSON.parse(decoded);
  } catch (_) {
    return null;
  }
}

function tryParseJson(str) {
  try { return JSON.parse(str); } catch (_) { return null; }
}

const UNITY_KEY_PATTERNS = [
  /^m_[A-Z]/,           // Unity serialized field prefix
  /saveData/i,
  /playerData/i,
  /gameData/i,
  /saveFile/i,
  /version/i,
  /levelData/i,
  /inventory/i,
  /health/i,
  /score/i,
  /achievements/i,
  /settings/i,
  /profile/i,
];

function looksLikeUnity(obj) {
  if (typeof obj !== 'object' || obj === null) return false;
  // Arrays are unlikely to be Unity root saves
  if (Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  if (keys.length === 0) return false;
  return keys.some(k => UNITY_KEY_PATTERNS.some(p => p.test(k)));
}

// ── detect ─────────────────────────────────────────────────────────────────────
export function detect(buffer) {
  try {
    const str = bufToString(buffer).trim();
    if (!str) return false;

    // Plain JSON with Unity-like keys?
    const plain = tryParseJson(str);
    if (plain !== null && looksLikeUnity(plain)) return true;

    // Base64 → JSON with Unity-like keys?
    if (isLikelyBase64(str)) {
      const b64obj = tryBase64ToJson(str);
      if (b64obj !== null && looksLikeUnity(b64obj)) return true;
    }

    return false;
  } catch (_) {
    return false;
  }
}

// ── decode ─────────────────────────────────────────────────────────────────────
export function decode(buffer) {
  const str = bufToString(buffer).trim();

  const plain = tryParseJson(str);
  if (plain !== null) {
    return {
      text:     JSON.stringify(plain, null, 2),
      metadata: { encoding: 'json' },
    };
  }

  if (isLikelyBase64(str)) {
    const obj = tryBase64ToJson(str);
    if (obj !== null) {
      return {
        text:     JSON.stringify(obj, null, 2),
        metadata: { encoding: 'base64' },
      };
    }
  }

  throw new Error('unity_json: could not decode buffer');
}

// ── encode ─────────────────────────────────────────────────────────────────────
export function encode(text, metadata) {
  const obj = JSON.parse(text);
  const str = JSON.stringify(obj);

  if (metadata && metadata.encoding === 'base64') {
  const bytes = ENC.encode(str);
  const b64 = bytesToBase64(bytes);
  return ENC.encode(b64);
  }

  return ENC.encode(str);
}
