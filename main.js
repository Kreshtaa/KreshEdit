/**
 * KreshEdit — main.js
 * Orchestrates file import, module detection, decode/encode, and export.
 */

// ── Module manifest ──────────────────────────────────────────────────────────
// Order matters: more specific formats first to reduce false-positive risks.
const MODULE_NAMES = [
  'sugarcube',
  'rpgmaker_mv',
  'renpy',
  'unity_json',
  'unreal_json',
  'html',
];

// ── State ────────────────────────────────────────────────────────────────────
let activeModule   = null;
let activeMetadata = null;
let activeFilename = 'edited-save';

// ── DOM refs ─────────────────────────────────────────────────────────────────
const btnImport    = document.getElementById('btn-import');
const btnExport    = document.getElementById('btn-export');
const fileInput    = document.getElementById('file-input');
const editor       = document.getElementById('editor');
const statusMsg    = document.getElementById('status-msg');
const editorFname  = document.getElementById('editor-filename');
const editorModule = document.getElementById('editor-module');

// ── Status helpers ────────────────────────────────────────────────────────────
function setStatus(msg, type = 'idle') {
  statusMsg.className = `status-msg status-${type}`;
  statusMsg.textContent = msg;
}

function setLoading(msg = 'Processing…') {
  statusMsg.className = 'status-msg status-idle';
  statusMsg.textContent = '';
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  statusMsg.appendChild(spinner);
  statusMsg.appendChild(document.createTextNode(msg));
}

// ── Module loader ─────────────────────────────────────────────────────────────
const moduleCache = {};

async function loadModule(name) {
  if (moduleCache[name]) return moduleCache[name];
  const mod = await import(`./modules/${name}.js`);
  moduleCache[name] = mod;
  return mod;
}

async function loadAllModules() {
  return Promise.all(MODULE_NAMES.map(loadModule));
}

// ── Import flow ───────────────────────────────────────────────────────────────
btnImport.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  fileInput.value = ''; // reset so same file can be re-imported

  activeFilename = file.name || 'edited-save';
  editorFname.textContent = activeFilename;
  editorModule.textContent = '';

  setLoading('Loading modules…');

  let modules;
  try {
    modules = await loadAllModules();
  } catch (err) {
    setStatus('Failed to load editor modules. Check your connection or file permissions.', 'error');
    console.error(err);
    return;
  }

  let buffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (err) {
    setStatus('Could not read the selected file.', 'error');
    console.error(err);
    return;
  }

  // ── Detect ──────────────────────────────────────────────────────────────────
  setLoading('Detecting format…');

  let matched = null;
  let matchedName = null;

  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i];
    const name = MODULE_NAMES[i];
    try {
      if (mod.detect(buffer)) {
        matched = mod;
        matchedName = name;
        break;
      }
    } catch (_) {
      // detect() must not throw; ignore if it does
    }
  }

  if (!matched) {
    setStatus('This format is currently unsupported.', 'error');
    activeModule = null;
    activeMetadata = null;
    editor.value = '';
    editorModule.textContent = '';
    editorFname.textContent = activeFilename;
    return;
  }

  // ── Decode ──────────────────────────────────────────────────────────────────
  setLoading(`Decoding with ${matchedName}…`);

  let result;
  try {
    result = await matched.decode(buffer);
  } catch (err) {
    setStatus('Failed to decode save file.', 'error');
    console.error(err);
    return;
  }

  if (!result || typeof result.text !== 'string') {
    setStatus('Failed to decode save file.', 'error');
    return;
  }

  activeModule   = matched;
  activeMetadata = result.metadata ?? {};

  editor.value = result.text;
  editorModule.textContent = matchedName;
  setStatus(`Loaded "${activeFilename}" using ${matchedName}.`, 'ok');
});

// ── Export flow ───────────────────────────────────────────────────────────────
btnExport.addEventListener('click', async () => {
  if (!activeModule) {
    setStatus('No save file loaded.', 'error');
    return;
  }

  const text = editor.value;
  setLoading('Encoding…');

  let encoded;
  try {
    encoded = await activeModule.encode(text, activeMetadata);
  } catch (err) {
    setStatus('Failed to encode save file.', 'error');
    console.error(err);
    return;
  }

  if (!encoded) {
    setStatus('Failed to encode save file.', 'error');
    return;
  }

  // ── Trigger download ─────────────────────────────────────────────────────────
  try {
    const blob = new Blob([encoded], { type: 'application/octet-stream' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = activeFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus(`Exported "${activeFilename}".`, 'ok');
  } catch (err) {
    setStatus('Failed to trigger file download.', 'error');
    console.error(err);
  }
});
