/**
 * KreshEdit - modules/lzstring.js
 * Handles HTML/browser game saves compressed with LZString.
 *
 * Supports both common LZString variants:
 *   - compressToBase64          alphabet: A-Z a-z 0-9 + / =
 *   - compressToEncodedURIComponent  alphabet: A-Z a-z 0-9 + - $  (no padding)
 *
 * Both use the same LZ77 bit-stream algorithm with different 64-char alphabets.
 * LZString is MIT licensed: https://github.com/pieroxy/lz-string
 */

(function () {
const { ENC, bufToString } = window.KreshUtils;

// ---- Bundled LZString core (MIT, pieroxy/lz-string) --------------------------------

const _KEY_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
const _KEY_URI = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$';

function _makeRev(key) {
  const rev = {};
  for (let i = 0; i < key.length; i++) rev[key[i]] = i;
  return rev;
}
const _REV_B64 = _makeRev(_KEY_B64);
const _REV_URI = _makeRev(_KEY_URI);

function _decompress(length, resetValue, getNextValue) {
  const dict = [];
  let enlargeIn = 4, dictSize = 4, numBits = 3, entry = '', w = '', c;
  const result = [];
  const data = { val: getNextValue(0), pos: resetValue, idx: 1 };

  for (let i = 0; i < 3; i++) dict[i] = i;

  function readBits(n) {
    let bits = 0, power = 1;
    const max = 1 << n;
    while (power !== max) {
      const resb = data.val & data.pos;
      data.pos >>= 1;
      if (data.pos === 0) {
        data.pos = resetValue;
        data.val = getNextValue(data.idx++);
      }
      bits |= (resb > 0 ? 1 : 0) * power;
      power <<= 1;
    }
    return bits;
  }

  const next = readBits(2);
  if      (next === 0) c = String.fromCharCode(readBits(8));
  else if (next === 1) c = String.fromCharCode(readBits(16));
  else if (next === 2) return '';
  else return null;

  dict[3] = c;
  w = c;
  result.push(c);

  while (true) {
    if (data.idx > length) return '';

    let tok = readBits(numBits);

    if (tok === 0) {
      dict[dictSize++] = String.fromCharCode(readBits(8));
      tok = dictSize - 1;
      enlargeIn--;
    } else if (tok === 1) {
      dict[dictSize++] = String.fromCharCode(readBits(16));
      tok = dictSize - 1;
      enlargeIn--;
    } else if (tok === 2) {
      return result.join('');
    }

    if (enlargeIn === 0) { enlargeIn = 1 << numBits; numBits++; }

    if (dict[tok])            entry = dict[tok];
    else if (tok === dictSize) entry = w + w[0];
    else return null;

    result.push(entry);
    dict[dictSize++] = w + entry[0];
    enlargeIn--;
    if (enlargeIn === 0) { enlargeIn = 1 << numBits; numBits++; }

    w = entry;
  }
}

function _compress(uncompressed, bitsPerChar, getChar) {
  if (uncompressed == null) return '';
  const dict = {}, dictToCreate = {};
  let w = '', enlargeIn = 2, dictSize = 3, numBits = 2;
  let dataVal = 0, dataPos = 0;
  const out = [];

  function writeBits(value, n) {
    for (let i = 0; i < n; i++) {
      dataVal = (dataVal << 1) | (value & 1);
      value >>= 1;
      if (dataPos === bitsPerChar - 1) {
        dataPos = 0;
        out.push(getChar(dataVal));
        dataVal = 0;
      } else {
        dataPos++;
      }
    }
  }

  function outputToken(word) {
    if (Object.prototype.hasOwnProperty.call(dictToCreate, word)) {
      const code = word.charCodeAt(0);
      if (code < 256) { writeBits(0, numBits); writeBits(code, 8);  }
      else            { writeBits(1, numBits); writeBits(code, 16); }
      enlargeIn--;
      if (enlargeIn === 0) { enlargeIn = 1 << numBits; numBits++; }
      delete dictToCreate[word];
    } else {
      writeBits(dict[word], numBits);
    }
    enlargeIn--;
    if (enlargeIn === 0) { enlargeIn = 1 << numBits; numBits++; }
  }

  for (let ii = 0; ii < uncompressed.length; ii++) {
    const ch = uncompressed[ii];
    if (!Object.prototype.hasOwnProperty.call(dict, ch)) {
      dict[ch] = dictSize++;
      dictToCreate[ch] = true;
    }
    const wc = w + ch;
    if (Object.prototype.hasOwnProperty.call(dict, wc)) {
      w = wc;
    } else {
      outputToken(w);
      dict[wc] = dictSize++;
      w = ch;
    }
  }

  if (w !== '') outputToken(w);

  writeBits(2, numBits);

  while (true) {
    dataVal = (dataVal << 1);
    if (dataPos === bitsPerChar - 1) { out.push(getChar(dataVal)); break; }
    dataPos++;
  }

  return out.join('');
}

// ---- Variant-aware wrappers --------------------------------------------------------

function decompressB64(input) {
  return _decompress(input.length, 32, i => _REV_B64[input[i]] ?? 0);
}

function decompressUri(input) {
  // Spaces may replace + when coming from URL decode — normalise.
  const s = input.replace(/ /g, '+');
  return _decompress(s.length, 32, i => _REV_URI[s[i]] ?? 0);
}

function compressB64(input) {
  const res = _compress(input, 6, a => _KEY_B64[a]);
  const pad = ['', '===', '==', '='][res.length % 4];
  return res + pad;
}

function compressUri(input) {
  return _compress(input, 6, a => _KEY_URI[a]);
}

// ---- Helpers -----------------------------------------------------------------------

// Characters exclusive to each alphabet — used for fast pre-screening.
// Base64: contains '/' or '='     URI-safe: contains '-' or '$'
const _B64_RE  = /^[A-Za-z0-9+/]+=*$/;
const _URI_RE  = /^[A-Za-z0-9+\-$]+$/;

function tryDecompress(str) {
  // Returns { obj, encoding } or null.
  const hasSlashOrEq = /[/=]/.test(str);
  const hasDashOrDollar = /[-$]/.test(str);

  if (!hasDashOrDollar && _B64_RE.test(str)) {
    try {
      const json = decompressB64(str);
      if (json) return { obj: JSON.parse(json), encoding: 'lzstring-base64' };
    } catch (_) {}
  }

  if (!hasSlashOrEq && _URI_RE.test(str)) {
    try {
      const json = decompressUri(str);
      if (json) return { obj: JSON.parse(json), encoding: 'lzstring-uri' };
    } catch (_) {}
  }

  return null;
}

function isStandardBase64Json(str) {
  // True when plain atob → JSON works — that belongs to html.js, not us.
  try {
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    JSON.parse(new TextDecoder().decode(bytes));
    return true;
  } catch (_) {
    return false;
  }
}

// ---- detect ------------------------------------------------------------------------
function detect(buffer) {
  try {
    const str = bufToString(buffer).trim();
    if (!str || str.length < 8) return false;
    // Must look like one of the two alphabets.
    if (!_B64_RE.test(str) && !_URI_RE.test(str)) return false;
    // Leave plain base64 → JSON to html.js.
    if (isStandardBase64Json(str)) return false;
    return tryDecompress(str) !== null;
  } catch (_) {
    return false;
  }
}

// ---- decode ------------------------------------------------------------------------
function decode(buffer) {
  const str = bufToString(buffer).trim();
  const result = tryDecompress(str);
  if (!result) throw new Error('lzstring: failed to decompress or parse as JSON');
  return {
    text:     JSON.stringify(result.obj, null, 2),
    metadata: { encoding: result.encoding },
  };
}

// ---- encode ------------------------------------------------------------------------
function encode(text, metadata) {
  const obj = JSON.parse(text);
  const str = JSON.stringify(obj);
  if (metadata && metadata.encoding === 'lzstring-uri') {
    return ENC.encode(compressUri(str));
  }
  return ENC.encode(compressB64(str));
}

window.KreshModules = window.KreshModules || {};
window.KreshModules.lzstring = { detect, decode, encode };
})();
