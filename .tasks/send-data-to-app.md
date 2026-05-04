# Plan: External HTML → Electron Data Injection

## Context

The app is a standalone Electron JSON prettifier. Currently, JSON enters only via native file dialogs or direct editor typing. The goal is to allow an external HTML page (in any browser, on any OS) to send JSON data into the app — with a protocol-URL trigger mechanism for small payloads and a clipboard-relay mechanism for large ones.

The renderer's `initializeEditors()` already has placeholder logic referencing `dataFromExternalPayload` and `previouslyLoadedData`, but those variables are undefined and the conditional logic is inverted (the placeholder text is shown when data IS present). This plan corrects that and wires up the full data flow.

---

## Recommended Approach: Custom Protocol + Clipboard Relay

### Why this is the best cross-OS solution
- `json-prettifier://` custom protocol works on macOS, Windows, and Linux
- No server required — no port conflicts, no firewall issues
- Large JSON is handled via a clipboard relay (HTML copies to clipboard, protocol URL carries a `source=clipboard` flag)
- macOS and Windows/Linux use different event systems for protocol URLs; both are handled

### URL size limits per OS
| OS | Safe URL limit | Strategy for large JSON |
|----|---------------|------------------------|
| macOS | ~2MB | URL-encode for small; clipboard relay for large |
| Windows | ~32KB | URL-encode for small; clipboard relay for large |
| Linux | ~8KB | URL-encode for small; clipboard relay for large |

**Threshold:** Use URL encoding for JSON ≤ 6KB; clipboard relay for anything larger.

### Two-phase data delivery
1. **Cold start** — app wasn't running when the link was clicked. The URL arrives via `process.argv` (Windows/Linux) or `open-url` fires before the window is ready (macOS). The main process stores a `pendingPayload`, and the renderer retrieves it via IPC on startup.
2. **Hot injection** — app was already running. The `second-instance` event (Windows/Linux) or `open-url` (macOS) fires, and `mainWindow.webContents.send('json:received', payload)` pushes data directly to the renderer.

---

## Data Flow

```
External HTML
  │
  ├── Small JSON (<6KB)
  │     └── json-prettifier://send?data=<encoded>
  │
  └── Large JSON
        ├── navigator.clipboard.writeText(json)
        └── json-prettifier://send?source=clipboard

Electron Main Process (main.js)
  ├── parseProtocolUrl(url) → { source: 'url'|'clipboard', data: string|null }
  ├── Cold start  → pendingPayload (retrieved by renderer via IPC)
  └── Hot inject  → mainWindow.webContents.send('json:received', payload)

Preload (preload.js)
  ├── getPendingPayload()   → ipcRenderer.invoke('json:getPendingPayload')
  ├── readClipboard()       → ipcRenderer.invoke('clipboard:read')
  └── onJsonReceived(cb)    → ipcRenderer.on('json:received', ...)

Renderer (renderer.js)
  └── initializeEditors()
        ├── loadInitialContent()
        │     ├── getPendingPayload() → load if present
        │     ├── localStorage 'lastEditorContent' → restore session
        │     └── default placeholder text
        └── onJsonReceived listener → hot-load into editor
```

---

## Files to Modify

### 1. `main.js`

**Add** `clipboard` to the existing destructure at line 12:
```js
const { app, BrowserWindow, ipcMain, Menu, dialog, clipboard } = require('electron');
```

**Add** above `let mainWindow`:
```js
let pendingPayload = null;

function parseProtocolUrl(url) {
  try {
    const parsed = new URL(url);
    const source = parsed.searchParams.get('source');
    if (source === 'clipboard') return { source: 'clipboard', data: null };
    const data = parsed.searchParams.get('data');
    if (data) return { source: 'url', data: decodeURIComponent(data) };
  } catch (e) {
    console.error('Failed to parse protocol URL:', e);
  }
  return null;
}

// Register custom protocol (must be before app.whenReady)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('json-prettifier', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('json-prettifier');
}

// Enforce single instance (required for second-instance on Windows/Linux)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    const url = commandLine.find(arg => arg.startsWith('json-prettifier://'));
    if (url) {
      const payload = parseProtocolUrl(url);
      if (payload) {
        if (mainWindow) {
          mainWindow.webContents.send('json:received', payload);
        } else {
          pendingPayload = payload;
        }
      }
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
```

**Wrap** the existing `app.whenReady().then(...)` block inside the `else` of `gotTheLock`. Also add a check for protocol URL in `process.argv` (Windows/Linux cold start):
```js
  app.whenReady().then(() => {
    // Check if launched via protocol on Windows/Linux (cold start)
    const protocolUrl = process.argv.find(arg => arg.startsWith('json-prettifier://'));
    if (protocolUrl) {
      pendingPayload = parseProtocolUrl(protocolUrl);
    }

    createWindow();
    app.on('activate', () => {
      if (mainWindow === null) createWindow();
    });
  });
}

// macOS: open-url fires even before app.whenReady()
app.on('open-url', (event, url) => {
  event.preventDefault();
  const payload = parseProtocolUrl(url);
  if (!payload) return;
  if (mainWindow) {
    mainWindow.webContents.send('json:received', payload);
  } else {
    pendingPayload = payload;
  }
});
```

**Add** new IPC handlers (alongside existing ones at the bottom):
```js
ipcMain.handle('json:getPendingPayload', () => {
  const payload = pendingPayload;
  pendingPayload = null;
  return payload;
});

ipcMain.handle('clipboard:read', () => clipboard.readText());
```

**Remove** the orphaned `app.whenReady().then(...)` block at the original location (lines 114–121) since it's now inside the `gotTheLock` block.

---

### 2. `preload.js`

**Add** three entries to the existing `contextBridge.exposeInMainWorld('electron', {...})` object:
```js
getPendingPayload: () => ipcRenderer.invoke('json:getPendingPayload'),
readClipboard: () => ipcRenderer.invoke('clipboard:read'),
onJsonReceived: (callback) => {
  ipcRenderer.on('json:received', (_event, payload) => callback(payload));
},
```

---

### 3. `renderer.js`

**Location:** Inside `initializeEditors()`, starting at line 288 (the `onDidChangeModelContent` handler) and lines 295–305 (the broken placeholder block).

**Add** `let autoSaveTimer;` to the existing state variables block (around line 42–45).

**Replace** the `onDidChangeModelContent` handler and the broken placeholder block (lines 288–305) with:
```js
// Auto-save content for session restore
let autoSaveTimer;
jsonEditor.onDidChangeModelContent(() => {
  statusText.textContent = 'Editing';
  errorMessage.textContent = '';
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    localStorage.setItem('lastEditorContent', jsonEditor.getValue());
  }, 1000);
});

// Load initial content: external payload → last session → placeholder
async function loadInitialContent() {
  const payload = await window.electron.getPendingPayload();
  if (payload) {
    const jsonData = payload.source === 'clipboard'
      ? await window.electron.readClipboard()
      : payload.data;
    if (jsonData) {
      jsonEditor.setValue(jsonData);
      statusText.textContent = 'Loaded from external source';
      return;
    }
  }

  const lastSession = localStorage.getItem('lastEditorContent');
  if (lastSession) {
    jsonEditor.setValue(lastSession);
    statusText.textContent = 'Restored from last session';
    return;
  }

  jsonEditor.setValue('// Paste your JSON here and click "Prettify"');
}

loadInitialContent();

// Hot injection: app already open when protocol URL was clicked
window.electron.onJsonReceived(async (payload) => {
  const jsonData = payload.source === 'clipboard'
    ? await window.electron.readClipboard()
    : payload.data;
  if (jsonData) {
    jsonEditor.setValue(jsonData);
    statusText.textContent = 'Loaded from external source';
    showToast('JSON loaded from external source!');
  }
});
```

---

## Test HTML Blocks

### Test 1: Small JSON (URL-encoded, <6KB)

Open this HTML file in a browser. Clicking the button encodes a small JSON object and opens the protocol URL directly.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test: Send Small JSON to Pretty Jayce On</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 2rem auto; padding: 1rem; }
    button { padding: 0.5rem 1rem; font-size: 1rem; cursor: pointer; }
    pre { background: #f0f0f0; padding: 1rem; border-radius: 4px; overflow: auto; }
  </style>
</head>
<body>
  <h2>Small JSON Test</h2>
  <p>Sends a ~200-byte payload directly via URL encoding.</p>
  <button onclick="sendSmallJson()">Send Small JSON to Pretty Jayce On</button>
  <pre id="preview"></pre>
  <script>
    function sendSmallJson() {
      const json = {
        "name": "Test Payload",
        "version": "1.0",
        "active": true,
        "count": 42,
        "items": ["alpha", "beta", "gamma"],
        "nested": { "key": "value", "flag": false }
      };
      const encoded = encodeURIComponent(JSON.stringify(json));
      document.getElementById('preview').textContent = JSON.stringify(json, null, 2);
      window.location.href = `json-prettifier://send?data=${encoded}`;
    }
  </script>
</body>
</html>
```

### Test 2: Large JSON (clipboard relay)

For payloads over 6KB, the JSON is written to the clipboard first, then the protocol URL signals the app to read from clipboard.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test: Send Large JSON to Pretty Jayce On</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 2rem auto; padding: 1rem; }
    button { padding: 0.5rem 1rem; font-size: 1rem; cursor: pointer; }
    #status { margin-top: 1rem; color: #555; font-style: italic; }
  </style>
</head>
<body>
  <h2>Large JSON Test (clipboard relay)</h2>
  <p>Writes ~50KB of JSON to the clipboard, then triggers the app to read it.</p>
  <button onclick="sendLargeJson()">Send Large JSON (via clipboard)</button>
  <div id="status"></div>
  <script>
    async function sendLargeJson() {
      const status = document.getElementById('status');

      // Generate a ~50KB dataset
      const largeJson = JSON.stringify({
        "dataset": Array.from({ length: 200 }, (_, i) => ({
          "id": i + 1,
          "name": `Record ${i + 1}`,
          "value": parseFloat((Math.random() * 1000).toFixed(4)),
          "active": i % 2 === 0,
          "tags": [`tag-${i % 10}`, `category-${i % 5}`, `group-${i % 3}`],
          "metadata": {
            "createdAt": new Date(Date.now() - i * 86400000).toISOString(),
            "updatedAt": new Date().toISOString(),
            "version": "2.0",
            "checksum": Math.random().toString(36).substring(2, 10)
          }
        }))
      }, null, 2);

      try {
        status.textContent = 'Writing JSON to clipboard…';
        await navigator.clipboard.writeText(largeJson);
        status.textContent = `Copied ${(largeJson.length / 1024).toFixed(1)}KB to clipboard. Opening Pretty Jayce On…`;
        // Small delay to ensure clipboard write completes cross-OS
        setTimeout(() => {
          window.location.href = 'json-prettifier://send?source=clipboard';
        }, 300);
      } catch (err) {
        status.textContent = `Clipboard access denied: ${err.message}. Try running this from a local server (not file://).`;
      }
    }
  </script>
</body>
</html>
```

> **Note on Test 2:** `navigator.clipboard.writeText()` requires either HTTPS or `localhost`. Open the test HTML via a local dev server (e.g. `npx serve .`) rather than double-clicking the file. Alternatively, you can test clipboard write from DevTools console.

---

## Protocol Registration for Built App (electron-builder)

Add to `package.json` under `build`:
```json
"protocols": [
  {
    "name": "JSON Prettifier",
    "schemes": ["json-prettifier"]
  }
]
```

This tells `electron-builder` to register the protocol in `Info.plist` (macOS) and the Windows registry automatically during packaging.

---

## Verification Steps

1. **Start the app:** `npm start`
2. **Test cold start (small JSON):** Quit the app, open `test-small.html` in a browser, click the button → app should launch and load the JSON
3. **Test hot injection (small JSON):** With app running, click the button in `test-small.html` → editor should update with the JSON and show the toast
4. **Test clipboard relay:** Serve `test-large.html` via `npx serve .`, click the button → app should receive and display the large JSON
5. **Test session restore:** Type some JSON in the editor, wait 1s, close the app, reopen → editor should restore the previous content
6. **Test fallback:** Open the app with no prior session → should show the placeholder text

---

## Critical Files

- [main.js](../main.js) — protocol registration, `parseProtocolUrl`, `pendingPayload`, new IPC handlers
- [preload.js](../preload.js) — expose `getPendingPayload`, `readClipboard`, `onJsonReceived`
- [renderer.js](../renderer.js) — `initializeEditors()` fix at lines 288–305, `loadInitialContent()`, hot-receive listener
- [package.json](../package.json) — add `build.protocols` for packaged app registration
