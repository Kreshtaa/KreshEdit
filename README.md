# KreshEdit
ver. 1.0.0

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
| Generic JSON | Plain JSON, Base64 JSON |

> **Note:** Binary formats (Unreal GVAS, Unity binary serialization, RAGS) are not supported.

> **Note:** Ren'Py support is experimental. Saves composed of standard dicts, lists, and primitives round-trip cleanly. Custom Python classes are represented as annotated JSON and restored as plain dicts - exact fidelity is not guaranteed for all games.

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
- pako from cdnjs (zlib compression, loaded on demand for SugarCube / RPGMaker saves)
- Pyodide from jsDelivr (WebAssembly Python, loaded on demand for Ren'Py saves only)

If you need fully offline operation, the tool works without fonts and pako. Ren'Py support requires a network connection on first use to download Pyodide (~50 MB), after which it is cached by the browser.

## Running Locally

No build step required. Just open `index.html` directly, or serve the folder with any static file server:

```bash
python3 -m http.server
```

Then open `http://localhost:8000` in your browser.

> **Note:** Some browsers block ES module imports from `file://` directly (Chrome requires `--allow-file-access-from-files`). Using a local server avoids this entirely.

## Project Structure

```
KreshEdit/
├── index.html
├── main.js
├── style.css
└── modules/
    ├── _utils.js
    ├── module_template.js
    ├── sugarcube.js
    ├── rpgmaker_mv.js
    ├── renpy.js
    ├── unity_json.js
    ├── unreal_json.js
    └── html.js
```

## Adding a New Format

Copy `modules/module_template.js`, rename it, and implement three functions:

```js
export function detect(buffer) → boolean
export function decode(buffer) → { text: string, metadata: object }
export function encode(text, metadata) → Uint8Array
```

Then add your module's name to the `MODULE_NAMES` array in `main.js`. Modules are tried in order - put more specific formats before broad ones.

See `module_template.js` for the full API contract and guidelines.

## Contact

- kresh@kreshy.com

## License

KreshEdit is licensed under the MIT License.
See the LICENSE file for full details.
