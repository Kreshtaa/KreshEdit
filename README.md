# KreshEdit
ver. 1.1.0

KreshEdit is a modular, private save editor for visual novels, interactive novels, and other small games.
It runs entirely in your browser - no installs, no servers, no data ever leaves your machine.

Disclaimer: This project was built using AI but implemented by yours truly. Do with that as you will.

## Supported Formats

| Format | Encodings |
|---|---|
| SugarCube / Twine | Plain JSON, Base64 JSON, Base64 + zlib JSON |
| RPGMaker MV / MZ | Base64 + zlib JSON |
| Ren'Py | Pickle (raw + gzip) via Pyodide |
| Unity JSON | Plain JSON, Base64 JSON |
| Unreal JSON | Plain JSON |
| LZString | compressToBase64, compressToEncodedURIComponent |
| Gzip JSON | Raw gzip-compressed JSON |
| Generic JSON | Plain JSON, Base64 JSON |

> **Note:** Binary formats (Unreal GVAS, Unity binary serialization, RAGS) are not supported.

> **Note:** Ren'Py support is experimental. Saves composed of standard dicts, lists, and primitives round-trip cleanly. Custom Python classes are represented as annotated JSON and restored as plain dicts — exact fidelity is not guaranteed for all games.

## Usage

1. Open `index.html` in your browser, or visit [editor.kreshy.com](https://editor.kreshy.com)
2. Click **Import Save** and select your save file
3. KreshEdit will detect the format automatically and display the decoded contents
4. Edit the JSON in the text area
5. Click **Export Save** to download the modified file
6. Drop it back into your game

**Always back up your saves before editing.**

## Privacy

Everything runs locally. No data is uploaded anywhere. The only network requests made are:

- Google Fonts (UI fonts, cosmetic only)
- pako from cdnjs (zlib compression, loaded once on demand for SugarCube / RPGMaker saves)
- Pyodide from jsDelivr (WebAssembly Python, loaded on demand for Ren'Py saves only)

LZString and gzip formats use no external dependencies — they are handled entirely by bundled code and browser-native APIs.

If you need fully offline operation, the tool works without fonts and pako. Ren'Py support requires a network connection on first use to download Pyodide (~50 MB), after which it is cached by the browser.

## Running Locally

No build step required. Just open `index.html` directly, or serve the folder with any static file server:

```bash
python3 -m http.server
```

Then open `http://localhost:8000` in your browser.

> **Note:** Using a local server is recommended. Some browsers restrict CDN requests or file access when opening `index.html` directly via `file://`.

## Project Structure

```
KreshEdit/
├── index.html
├── main.js
├── style.css
└── modules/
    ├── _utils.js          — shared helpers + pako loader (window.KreshUtils, window.KreshPako)
    ├── module_template.js — copy this to add a new format
    ├── sugarcube.js
    ├── rpgmaker_mv.js
    ├── gzip_json.js
    ├── renpy.js
    ├── unity_json.js
    ├── unreal_json.js
    ├── lzstring.js
    └── html.js
```

## Adding a New Format

Copy `modules/module_template.js`, rename it, and implement three functions:

```js
function detect(buffer)              // → boolean         (sync, must not throw)
function decode(buffer)              // → { text, metadata }  (may be async, may throw)
function encode(text, metadata)      // → Uint8Array          (may be async, may throw)
```

Then:

1. Add a `<script>` tag for your file in `index.html` (before `main.js`).
2. Add the module name to `MODULE_NAMES` in `main.js`. Order matters — more specific formats before broader ones.

**How the chain works:** `detect()` is called on every file import. If it returns `true`, `decode()` is called. If `decode()` throws, the error is logged and the next matching module is tried automatically — so it is safe to throw from `decode()` when the file turns out not to match on closer inspection.

**Shared utilities** are available via `window.KreshUtils` (TextEncoder/Decoder, base64 helpers) and `window.KreshPako` (shared pako promise — `const pako = await window.KreshPako`). See `_utils.js` and `module_template.js` for full details.

## Contact

- kresh@kreshy.com

## License

KreshEdit is licensed under the MIT License.
See the LICENSE file for full details.
