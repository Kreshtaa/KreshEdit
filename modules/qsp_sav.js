/**
 * KreshEdit - modules/qsp_sav.js
 * Handles QSP engine save files (.sav, version 5.7.0).
 *
 * QSP (Quest Soft Player) saves are UTF-16 LE files with no BOM.
 * Fields are separated by literal \r\n (0x000D 0x000A as UTF-16 LE units).
 * Fields 0-1 (magic + version) are plain text; every other field is
 * obfuscated with a simple additive cipher: encoded = plain - CODREMOV,
 * decoded = encoded + CODREMOV, where CODREMOV = 5. The edge case where
 * plain == CODREMOV encodes to (uint16)-CODREMOV (0xFFFB) and vice versa.
 *
 * Field layout (from qspSaveGameStatusToString / qspOpenGameStatusFromString
 * in the Sonnix QSP engine source):
 *   [0]  "QSPSAVEDGAME"     (plain)
 *   [1]  version            (plain, e.g. "5.7.0")
 *   [2]  CRC of .qsp file   (encoded int)
 *   [3]  game time (ms)     (encoded int)
 *   [4]  curSelAction       (encoded int, -1 = none)
 *   [5]  curSelObject       (encoded int, -1 = none)
 *   [6]  viewPath           (encoded str, may be empty)
 *   [7]  curInput           (encoded str)
 *   [8]  curDesc            (encoded str)
 *   [9]  curVars            (encoded str)
 *   [10] curLoc             (encoded str)
 *   [11] showActs           (encoded int 0/1)
 *   [12] showObjs           (encoded int 0/1)
 *   [13] showVars           (encoded int 0/1)
 *   [14] showInput          (encoded int 0/1)
 *   [15] timerInterval      (encoded int)
 *   [16] playlistCount      (encoded int)
 *   [17..] playlist files   (encoded str each)
 *   [..] includeFilesCount  (encoded int)
 *   [..] include files      (encoded str each)
 *   [..] actionsCount       (encoded int)
 *   for each action:
 *     image, desc, linesCount, [str+lineNum pairs...],
 *     location, actIndex, startLine, isManageLines
 *   [..] objectsCount       (encoded int)
 *   for each object: image, desc
 *   [..] varsCount          (encoded int)
 *   for each variable:
 *     slotIndex, name, valsCount, [num+str pairs...],
 *     indsCount, [index+str pairs...]
 */

(function () {

const QSP_CODREMOV = 5;
const NEG_CODREMOV = (0x10000 - QSP_CODREMOV) & 0xFFFF; // 0xFFFB

// UTF-16 LE bytes for "QSPSAVEDGAME\r\n"
const MAGIC_BYTES = new Uint8Array([
  0x51,0x00, 0x53,0x00, 0x50,0x00, 0x53,0x00,
  0x41,0x00, 0x56,0x00, 0x45,0x00, 0x44,0x00,
  0x47,0x00, 0x41,0x00, 0x4D,0x00, 0x45,0x00,
  0x0D,0x00, 0x0A,0x00,
]);

// ── Low-level UTF-16 LE helpers ──────────────────────────────────────────────

function toU8(buffer) {
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

function bytesToU16(bytes) {
  const len = Math.floor(bytes.length / 2);
  const out = new Uint16Array(len);
  for (let i = 0; i < len; i++)
    out[i] = bytes[2 * i] | (bytes[2 * i + 1] << 8);
  return out;
}

function u16ToBytes(u16) {
  const out = new Uint8Array(u16.length * 2);
  for (let i = 0; i < u16.length; i++) {
    out[2 * i]     = u16[i] & 0xFF;
    out[2 * i + 1] = (u16[i] >> 8) & 0xFF;
  }
  return out;
}

// ── Field split ──────────────────────────────────────────────────────────────

function splitFields(u16) {
  const fields = [];
  let start = 0;
  for (let i = 0; i < u16.length - 1; i++) {
    if (u16[i] === 0x000D && u16[i + 1] === 0x000A) {
      fields.push(u16.slice(start, i));
      start = i + 2;
      i++;
    }
  }
  if (start < u16.length) fields.push(u16.slice(start));
  return fields;
}

// ── Cipher ───────────────────────────────────────────────────────────────────

function decodeField(u16) {
  let s = '';
  for (let i = 0; i < u16.length; i++) {
    let c = u16[i];
    c = (c === NEG_CODREMOV) ? QSP_CODREMOV : (c + QSP_CODREMOV) & 0xFFFF;
    s += String.fromCharCode(c);
  }
  return s;
}

function encodeStr(str) {
  const out = new Uint16Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    out[i] = (c === QSP_CODREMOV) ? NEG_CODREMOV : (c - QSP_CODREMOV + 0x10000) & 0xFFFF;
  }
  return out;
}

function plainToU16(str) {
  const out = new Uint16Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i);
  return out;
}

function u16ToPlain(u16) {
  let s = '';
  for (let i = 0; i < u16.length; i++) s += String.fromCharCode(u16[i]);
  return s;
}

function decodeInt(u16) {
  return parseInt(decodeField(u16), 10);
}

// ── detect ───────────────────────────────────────────────────────────────────

function detect(buffer) {
  try {
    const bytes = toU8(buffer);
    if (bytes.length < MAGIC_BYTES.length) return false;
    for (let i = 0; i < MAGIC_BYTES.length; i++)
      if (bytes[i] !== MAGIC_BYTES[i]) return false;
    return true;
  } catch (_) {
    return false;
  }
}

// ── decode ───────────────────────────────────────────────────────────────────

function decode(buffer) {
  const u16    = bytesToU16(toU8(buffer));
  const fields = splitFields(u16);

  if (u16ToPlain(fields[0]) !== 'QSPSAVEDGAME')
    throw new Error('qsp_sav: magic mismatch');

  const version = u16ToPlain(fields[1]);
  let idx = 2;

  const rd  = () => decodeField(fields[idx++]);
  const ri  = () => decodeInt(fields[idx++]);

  const crc           = ri();
  const gameTime      = ri();
  const curSelAction  = ri();
  const curSelObject  = ri();
  const viewPath      = rd();
  const curInput      = rd();
  const curDesc       = rd();
  const curVars       = rd();
  const curLoc        = rd();
  const showActs      = ri() !== 0;
  const showObjs      = ri() !== 0;
  const showVars      = ri() !== 0;
  const showInput     = ri() !== 0;
  const timerInterval = ri();

  const plCount = ri();
  const playlist = [];
  for (let i = 0; i < plCount; i++) playlist.push(rd());

  const incCount = ri();
  const includeFiles = [];
  for (let i = 0; i < incCount; i++) includeFiles.push(rd());

  const actionsCount = ri();
  const actions = [];
  for (let i = 0; i < actionsCount; i++) {
    const image      = rd();
    const desc       = rd();
    const linesCount = ri();
    const lines      = [];
    for (let j = 0; j < linesCount; j++)
      lines.push({ str: rd(), lineNum: ri() });
    actions.push({
      image,
      desc,
      lines,
      location:      ri(),
      actIndex:      ri(),
      startLine:     ri(),
      isManageLines: ri() !== 0,
    });
  }

  const objectsCount = ri();
  const objects = [];
  for (let i = 0; i < objectsCount; i++)
    objects.push({ image: rd(), desc: rd() });

  const varsCount = ri();
  const vars = {};
  for (let i = 0; i < varsCount; i++) {
    const slotIndex = ri();
    const name      = rd();
    const valsCount = ri();
    const values    = [];
    for (let j = 0; j < valsCount; j++)
      values.push({ num: ri(), str: rd() });
    const indsCount = ri();
    const indices   = [];
    for (let j = 0; j < indsCount; j++)
      indices.push({ index: ri(), str: rd() });
    vars[name] = { slotIndex, values, indices };
  }

  const data = {
    version,
    crc,
    gameTime,
    curSelAction,
    curSelObject,
    viewPath,
    curInput,
    curDesc,
    curVars,
    curLoc,
    showActs,
    showObjs,
    showVars,
    showInput,
    timerInterval,
    playlist,
    includeFiles,
    actions,
    objects,
    vars,
  };

  return {
    text:     JSON.stringify(data, null, 2),
    metadata: { version },
  };
}

// ── encode ───────────────────────────────────────────────────────────────────

const CRLF = new Uint16Array([0x000D, 0x000A]);

function encode(text) {
  const data   = JSON.parse(text);
  const parts  = [];

  const wPlain = str => { parts.push(plainToU16(str)); parts.push(CRLF); };
  const wStr   = str => { parts.push(str ? encodeStr(str) : new Uint16Array(0)); parts.push(CRLF); };
  const wInt   = n   => wStr(String(n));
  const wBool  = b   => wInt(b ? 1 : 0);

  // Plain header
  wPlain('QSPSAVEDGAME');
  wPlain(data.version || '5.7.0');

  // Fixed encoded fields
  wInt(data.crc);
  wInt(data.gameTime);
  wInt(data.curSelAction);
  wInt(data.curSelObject);
  wStr(data.viewPath   || '');
  wStr(data.curInput   || '');
  wStr(data.curDesc    || '');
  wStr(data.curVars    || '');
  wStr(data.curLoc     || '');
  wBool(data.showActs);
  wBool(data.showObjs);
  wBool(data.showVars);
  wBool(data.showInput);
  wInt(data.timerInterval);

  const playlist = data.playlist || [];
  wInt(playlist.length);
  for (const f of playlist) wStr(f);

  const includeFiles = data.includeFiles || [];
  wInt(includeFiles.length);
  for (const f of includeFiles) wStr(f);

  const actions = data.actions || [];
  wInt(actions.length);
  for (const act of actions) {
    wStr(act.image || '');
    wStr(act.desc  || '');
    const lines = act.lines || [];
    wInt(lines.length);
    for (const ln of lines) { wStr(ln.str || ''); wInt(ln.lineNum); }
    wInt(act.location);
    wInt(act.actIndex);
    wInt(act.startLine);
    wBool(act.isManageLines);
  }

  const objects = data.objects || [];
  wInt(objects.length);
  for (const obj of objects) { wStr(obj.image || ''); wStr(obj.desc || ''); }

  // Variables must be written in ascending slotIndex order (engine validates this)
  const vars = data.vars || {};
  const varList = Object.entries(vars)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => a.slotIndex - b.slotIndex);
  wInt(varList.length);
  for (const v of varList) {
    wInt(v.slotIndex);
    wStr(v.name);
    const vals = v.values || [];
    wInt(vals.length);
    for (const val of vals) { wInt(val.num); wStr(val.str || ''); }
    const inds = v.indices || [];
    wInt(inds.length);
    for (const ind of inds) { wInt(ind.index); wStr(ind.str || ''); }
  }

  // Flatten parts into a single Uint16Array then convert to bytes
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint16Array(total);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return u16ToBytes(out);
}

window.KreshModules = window.KreshModules || {};
window.KreshModules.qsp_sav = { detect, decode, encode };
})();
