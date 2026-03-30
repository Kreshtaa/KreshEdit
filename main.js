/**
 * KreshEdit — main.js
 * Orchestrates file import, module detection, decode/encode, and export.
 */

window.KreshModules = window.KreshModules || {};

// ── Module manifest ──────────────────────────────────────────────────────────
// Order matters: more specific formats first to reduce false-positive risks.
const MODULE_NAMES = [
  'sugarcube',
  'rpgmaker_mv',
  'gzip_json',
  'renpy',
  'unity_json',
  'unreal_json',
  'lzstring',
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

// ── Import flow ───────────────────────────────────────────────────────────────
btnImport.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  fileInput.value = ''; // reset so same file can be re-imported

  activeFilename = file.name || 'edited-save';
  editorFname.textContent = activeFilename;
  editorModule.textContent = '';

  // Modules are already loaded via <script> tags
  const modules = MODULE_NAMES.map(name => window.KreshModules[name]);

  // Safety check
  if (modules.some(m => !m)) {
    setStatus('Some editor modules failed to load. Check index.html <script> tags.', 'error');
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

  // ── Detect + Decode ──────────────────────────────────────────────────────────
  // Modules are tried in order. If detect() passes but decode() throws, we
  // log the failure and continue to the next candidate rather than stopping.
  // This handles cases where detection heuristics overlap (e.g. gzip magic
  // matches both gzip_json and Ren'Py) and lets the correct module win.

  setLoading('Detecting format…');

  let result        = null;
  let matchedModule = null;
  let matchedName   = null;

  for (let i = 0; i < modules.length; i++) {
    const mod  = modules[i];
    const name = MODULE_NAMES[i];

    let detected = false;
    try { detected = mod.detect(buffer); } catch (_) {}
    if (!detected) continue;

    setLoading(`Decoding with ${name}…`);
    try {
      const candidate = await mod.decode(buffer);
      if (candidate && typeof candidate.text === 'string') {
        result        = candidate;
        matchedModule = mod;
        matchedName   = name;
        break;
      }
    } catch (err) {
      console.warn(`[KreshEdit] ${name} detect passed but decode failed — trying next:`, err);
    }
  }

  if (!result) {
    setStatus('This format is currently unsupported.', 'error');
    activeModule   = null;
    activeMetadata = null;
    editor.value   = '';
    editorModule.textContent = '';
    editorFname.textContent  = activeFilename;
    return;
  }

  activeModule   = matchedModule;
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
