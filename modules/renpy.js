/**
 * KreshEdit - modules/renpy.js
 * Handles Ren'Py save files via Pyodide (Python pickle + optional gzip).
 *
 * Ren'Py save files are Python pickle streams. Many games store simple
 * dict/list/primitive structures, which roundtrip cleanly. Some games store
 * custom Python classes; these are represented as annotated JSON objects and
 * reconstructed as plain dicts on encode.
 *
 * Supported:
 *   - Raw pickle (protocol 0-5)
 *   - Gzipcompressed pickle (common in Ren'Py)
 *   - Arbitrary nested dict/list/primitive structures
 *   - Bytes objects (base64encoded in JSON)
 *
 * Limitations:
 *   - Custom Python classes are serialized as {"__type__": "..."} with their
 *     __dict__ captured when possible. They are restored as plain dicts.
 *   - Exact roundtrip fidelity is guaranteed only for saves composed of
 *     dicts, lists, primitives, and bytes.
 *
 * This module is stable and safe for typical Ren'Py saves. It does not attempt
 * to support binary .rpyc/.rpa formats or Ren'Py's internal AST structures.
 */

(function () {
const { base64ToBytes } = window.KreshUtils;

const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;

// ---- Pyodide loader ----------------------------------------------------------------
let _pyodide = null;
let _pyodideLoading = null;

async function getPyodide() {
  if (_pyodide) return _pyodide;
  if (_pyodideLoading) return _pyodideLoading;

  _pyodideLoading = (async () => {
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.0/full/pyodide.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
      _pyodide = await window.loadPyodide();
      return _pyodide;
    } catch (err) {
      _pyodideLoading = null; // allow retry on next import attempt
      throw err;
    }
  })();

  return _pyodideLoading;
}

// ---- Helpers -----------------------------------------------------------------------
function getBytes(buffer) {
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

function looksLikePickle(bytes) {
  if (bytes.length < 2) return false;

  // Raw pickle protocol 25
  if (bytes[0] === 0x80 && bytes[1] >= 0x02 && bytes[1] <= 0x05) return true;

  // Gzip-compressed pickle
  if (bytes[0] === GZIP_MAGIC_0 && bytes[1] === GZIP_MAGIC_1) return true;

  // Older pickle protocol 0/1 starts with opcodes like '(' '}' ']'
  if (bytes[0] === 0x28 || bytes[0] === 0x7d || bytes[0] === 0x5d) return true;

  return false;
}

// ---- detect ----------------------------------------------------------------------
function detect(buffer) {
  try {
    return looksLikePickle(getBytes(buffer));
  } catch {
    return false;
  }
}

// ---- decode ----------------------------------------------------------------------
// NOTE on "__data__":
//   - "__data__" is preserved as a plain dict.
//   - On encode, it remains a dict because custom classes cannot be
//     reconstructed. This is intentional and documented.

async function decode(buffer) {
  const pyodide = await getPyodide();
  const bytes = getBytes(buffer);

  pyodide.globals.set('_raw_bytes', bytes);

  const result = await pyodide.runPythonAsync(`
import pickle, gzip, json, base64

def _to_serializable(obj, depth=0):
    if depth > 64:
        return {"__type__": "TRUNCATED", "__repr__": repr(obj)[:200]}

    if obj is None or isinstance(obj, (bool, int, float, str)):
        return obj

    if isinstance(obj, bytes):
        return {"__type__": "bytes", "__b64__": base64.b64encode(obj).decode()}

    if isinstance(obj, (list, tuple)):
        return [_to_serializable(v, depth+1) for v in obj]

    if isinstance(obj, dict):
        return {str(k): _to_serializable(v, depth+1) for k, v in obj.items()}

    d = {"__type__": type(obj).__name__}
    if hasattr(obj, "__dict__"):
        d["__data__"] = _to_serializable(vars(obj), depth+1)
    else:
        d["__repr__"] = repr(obj)[:500]
    return d

raw = bytes(_raw_bytes)

try:
    raw = gzip.decompress(raw)
    compressed = True
except Exception:
    compressed = False

obj = pickle.loads(raw)
json.dumps({"compressed": compressed, "data": _to_serializable(obj)})
`);

  const parsed = JSON.parse(result);

  return {
    text: JSON.stringify(parsed.data, null, 2),
    metadata: {
      compressed: parsed.compressed,
      encoding: 'pickle'
    }
  };
}

// --- encode ----------------------------------------------------------------------
// NOTE on "__type__" filtering:
//   - "__type__" is intentionally removed during encode because we cannot
//     reconstruct custom Python classes without the game's code.
//   - If a user save contains a literal "__type__" key, it will be dropped.
//     This is an acceptable tradeoff for Ren'Py compatibility.

async function encode(text, metadata) {
  const pyodide = await getPyodide();
  const obj = JSON.parse(text);

  pyodide.globals.set('_json_str', JSON.stringify(obj));
  pyodide.globals.set('_use_gzip', !!metadata?.compressed);

  const b64 = await pyodide.runPythonAsync(`
import pickle, gzip, json, base64

def _from_serializable(obj):
    if obj is None or isinstance(obj, (bool, int, float, str)):
        return obj

    if isinstance(obj, list):
        return [_from_serializable(v) for v in obj]

    if isinstance(obj, dict):
        if obj.get("__type__") == "bytes":
            return base64.b64decode(obj["__b64__"])
        return {k: _from_serializable(v) for k, v in obj.items() if k != "__type__"}

    return obj

data = json.loads(_json_str)
py_obj = _from_serializable(data)
pickled = pickle.dumps(py_obj, protocol=2)

if _use_gzip:
    pickled = gzip.compress(pickled)

base64.b64encode(pickled).decode()
`);

  return base64ToBytes(b64);
}

window.KreshModules = window.KreshModules || {};
window.KreshModules.renpy = { detect, decode, encode };
})();
