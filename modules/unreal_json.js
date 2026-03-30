/**
 * KreshEdit - modules/unreal_json.js
 * Handles Unreal Engine saves stored as JSON (NOT binary GVAS).
 *
 * Some Unreal games use USaveGame subclasses that serialize to plain JSON
 * rather than (or in addition to) the binary GVAS format  typically via
 * plugins like VaRest, JsonSaveSystem, or custom save managers.
 *
 * Detection heuristic: valid JSON that contains at least one Unreal-ish
 * key pattern. We're deliberately conservative here because this module
 * runs after unity_json in the detection chain.
 *
 * Binary GVAS (.sav files) are explicitly NOT supported and will not be
 * detected by this module.
 */

(function () {
const {
  ENC,
  bufToString
} = window.KreshUtils;

function tryParseJson(str) {
  try { return JSON.parse(str); } catch (_) { return null; }
}

// GVAS magic: "GVAS" at offset 0 - 0x47 0x56 0x41 0x53
function isGvas(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 4) return false;
  return (
    bytes[0] === 0x47 && bytes[1] === 0x56 &&
    bytes[2] === 0x41 && bytes[3] === 0x53
  );
}

const UNREAL_KEY_PATTERNS = [
  /SaveSlot/i,
  /SaveGame/i,
  /PlayerController/i,
  /GameMode/i,
  /WorldSettings/i,
  /ActorTransform/i,
  /bIsNew/i,
  /bIsDead/i,
  /QuestState/i,
  /LevelName/i,
  /PackageName/i,
  /ClassName/i,
  /ue4version/i,
  /engineVersion/i,
  /customVersions/i,
];

function looksLikeUnreal(obj) {
  if (typeof obj !== 'object' || obj === null) return false;
  if (Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  if (keys.length === 0) return false;
  return keys.some(k => UNREAL_KEY_PATTERNS.some(p => p.test(k)));
}

// ---- detect -----------------------------------------------------------------------------
function detect(buffer) {
  try {
    // Explicitly reject GVAS binary saves
    if (isGvas(buffer)) return false;

    const str = bufToString(buffer).trim();
    if (!str) return false;

    const obj = tryParseJson(str);
    if (obj !== null && looksLikeUnreal(obj)) return true;

    return false;
  } catch (_) {
    return false;
  }
}

// ---- decode --------------------------------------------------------------------------------
function decode(buffer) {
  if (isGvas(buffer)) {
    throw new Error('unreal_json: binary GVAS format is not supported');
  }

  const str = bufToString(buffer).trim();
  const obj = tryParseJson(str);
  if (obj === null) throw new Error('unreal_json: file is not valid JSON');

  return {
    text:     JSON.stringify(obj, null, 2),
    metadata: { encoding: 'json' },
  };
}

// ---- encode -----------------------------------------------------------------------
function encode(text, metadata) {
  const obj = JSON.parse(text);
  return ENC.encode(JSON.stringify(obj));
}

window.KreshModules = window.KreshModules || {};
window.KreshModules.unreal_json = { detect, decode, encode };
})();
