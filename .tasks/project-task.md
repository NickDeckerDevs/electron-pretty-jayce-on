# Task: Unify JSON Prettifier into a Working Electron Desktop App

## Testing Protocol

**User handles all Electron app testing.** Do not run `npm start` or attempt to verify the running app via terminal output — the Electron window is a GUI and terminal output is not a reliable signal. When testing is needed, describe what to check and let the user report back.

---

## Context

The project had two diverging renderers (`renderer.js` = 397 lines, stripped, no persistence; `web-renderer.js` = 1507 lines, full features, REST API calls) and two nearly-identical HTML files (`index.html` vs `web-index.html`, differing only in `<title>`). The Electron app was loading `web-renderer.js`, which made 9 `fetch('/api/...')` calls to an Express/PostgreSQL server that wasn't running in desktop mode — so persistence silently failed.

The goal: one HTML file, one renderer script, all features working offline, fully packaged as a `.dmg`.

---

## How Electron Works (Mental Model)

Electron runs two separate JavaScript environments:

- **Main process** (`main.js`) — Node.js. Creates windows, accesses the filesystem, handles native OS APIs. No UI.
- **Renderer process** (`index.html` + your JS) — A Chromium browser tab. Renders HTML/CSS/JS exactly like Chrome. Cannot touch the filesystem directly.
- **Preload script** (`preload.js`) — A narrow, secure bridge. Uses `contextBridge.exposeInMainWorld()` to expose specific safe functions to the renderer. The renderer only gets what you explicitly expose (e.g. `window.electron.copyToClipboard()`).
- **IPC** — When the renderer needs Node.js to do something (open a file dialog, write to disk), it calls a function exposed by the preload, which internally calls `ipcRenderer.invoke('channel')`. The main process listens with `ipcMain.handle('channel')`, does the work, returns the result.

**Development workflow — no rebuilds needed for UI changes:**
- `npm start` → `electron .` → loads your files directly off disk
- Edit `renderer.js`, `styles.css`, `index.html` → press `Cmd+R` (reload) in the Electron window → changes appear instantly
- Edit `main.js` or `preload.js` → must quit and `npm start` again (those are not hot-reloaded)
- Uncomment `mainWindow.webContents.openDevTools()` in `main.js` line 27 during development — you get the full Chrome DevTools panel

**Packaging:** `npm run build` bundles everything into a distributable `.dmg` (macOS) / `.exe` (Windows) via electron-builder. Only do this when you want to ship. Day-to-day development never needs a build step.

---

## Architecture Decision: Storage

Replaced the 9 `fetch('/api/...')` calls with **`localStorage`** — no new dependencies, no IPC plumbing, no server.

The renderer manages all data in memory (`savedDocuments`, `customThemes`, `userPreferences` arrays). The API calls were purely the persistence layer. Electron's Chromium persists `localStorage` automatically in `~/Library/Application Support/pretty-jayce-on/` — survives app restarts, fully offline.

---

## Phase 1: Unify Codebase — COMPLETED ✓

| Task | Status |
|------|--------|
| Delete `renderer.js` (stripped 397-line version) | ✓ |
| Delete `web-index.html` (duplicate of index.html) | ✓ |
| Rename `web-renderer.js` → `renderer.js` | ✓ |
| Create `storage.js` (localStorage persistence layer) | ✓ |
| Update `index.html` — CDN → local Monaco + Font Awesome, add storage.js script tag | ✓ |
| Update `renderer.js` — remove session management, update Monaco path, replace 9 fetch calls with Storage.* | ✓ |
| Update `main.js` — add `dialog` + `fs`, fix broken icon ref, add IPC handlers for file open/save | ✓ |
| Update `preload.js` — expand contextBridge with isElectron, openFile, saveFile, getAppVersion | ✓ |
| Update `package.json` — rename app, add start/build scripts, electron-builder config, remove server deps | ✓ |
| Run `npm install` — electron-builder, monaco-editor, @fortawesome/fontawesome-free | ✓ |

**Verified working (user-tested):**
- Electron 36.1.0 binary launches correctly
- Monaco editor loads offline (no CDN)
- Dark mode toggle works
- Prettify works
- Save document — confirmed the save action completes

---

## Phase 2: Fix Saved Documents Sidebar — INVESTIGATED ✓

**Problem:** Saving a document appears to succeed (no error shown), but the saved documents sidebar does not display the saved items. The sidebar exists in the UI but shows no content after saving.

**Investigation needed:**
- Confirm whether `Storage.saveDocument()` is actually writing to `localStorage` correctly (open DevTools → Application → Local Storage and check for a `documents` key)
- Confirm whether `loadSavedDocuments()` is being called on startup and reading back correctly
- Check if the sidebar toggle/open mechanism is wired up — the sidebar may need a button click to become visible (it may be collapsed by default)
- Check whether `updateDocumentsList()` is being triggered after save and correctly rendering items into the DOM
- Look at `renderer.js` around the sidebar open/close logic — there may be a CSS class (`active`) that needs to be toggled

**Likely suspects:**
1. Sidebar is hidden until a toggle button is clicked — the save succeeds but the sidebar panel isn't open
2. `updateDocumentsList()` renders into a DOM element that isn't visible without user interaction
3. A subtle bug in `Storage.saveDocument()` where the id/structure doesn't match what `updateDocumentsList()` expects

### Investigation Results (2026-05-01)

**Storage:** `Storage.saveDocument()` writes correctly to `localStorage`. No bugs in `storage.js`.

Three bugs found — all in `renderer.js` and `index.html`:

1. **No sidebar open button** (`index.html`, `renderer.js:1014-1025`)
   The sidebar is `display: none` by default and only has a close button inside it. The only
   existing open mechanism is an undiscoverable Alt+click on the Save button — completely
   non-obvious. Users are locked out of the sidebar entirely.

2. **Delete button never renders** (`renderer.js:321-354`)
   In `updateDocumentsList()`, a `const actions` element is created with the delete button
   (lines 321–326), but `docItem.innerHTML = '...'` is then assigned (lines 329–333) without
   including it. The `actions` element is never appended to `docItem`, so
   `docItem.querySelector('.delete-doc')` at line 344 always returns `null`. Documents
   cannot be deleted.

3. **Sidebar doesn't auto-open after save** (`renderer.js:780-787`)
   After `confirmSaveBtn` fires, the modal closes and a toast appears — but the sidebar is
   never opened. Users have no visual confirmation that their document is in the list.

### Action Plan To Fix Sidebar / Saved Items

| Fix | File | Location | Change |
|-----|------|----------|--------|
| Add "Saved" toggle button | `index.html` | Line 25, after Save button | `<button id="toggle-sidebar">` |
| Wire up toggle button | `renderer.js` | `setupEventListeners()` | Click handler toggles `.active` on `#sidebar` |
| Remove dead Alt+click workaround | `renderer.js` | Lines 1014-1025 | Delete that listener block |
| Fix delete button rendering | `renderer.js` | Line 334 | `docItem.appendChild(actions)` after innerHTML |
| Auto-open sidebar after save | `renderer.js` | Line 783 | `sidebar.classList.add('active')` after modal close |

---

## Phase 3: Add Changelogs to All Modified Files — COMPLETED ✓

Dated changelog blocks added during the Phase 1 migration (2026-05-01) and the housekeeping refactor (2026-05-07).

Files with changelogs:
- `renderer.js` — 5/1/2026 (Phase 1) + 5/7/2026 (housekeeping)
- `storage.js` — 5/1/2026
- `index.html` — 5/1/2026 + 5/7/2026
- `styles.css` — 5/7/2026 (added during housekeeping, no Phase 1 entry)
- `main.js` — 5/1/2026
- `preload.js` — 5/1/2026
- `package.json` — JSON, noted in summary instead of inline comment

---

## Phase 4: React Migration (Future)

Once Phases 2–3 are complete, optionally migrate to React + electron-vite for a component-based architecture.

**Stack:** `electron-vite` + React + Vite

```bash
npm install electron-vite react react-dom @vitejs/plugin-react
```

**Folder structure:**
- `main.js` → `src/main/index.js`
- `preload.js` → `src/preload/index.js`
- `index.html` + `renderer.js` → `src/renderer/` as React components
- `storage.js` → `src/renderer/lib/storage.js` (unchanged — this is the key benefit of the clean abstraction built in Phase 1)

**Component breakdown from the current renderer:**
- `<App>` — root, holds state (savedDocuments, customThemes, userPreferences)
- `<Header>` — toolbar buttons, theme toggle, settings gear
- `<Sidebar>` — saved documents list, `<DocumentItem>` per doc
- `<Editor>` — Monaco editor wrapper
- `<StatusBar>` — breadcrumb, error message, status text
- `<SaveModal>`, `<SettingsModal>`, `<ThemeEditorModal>` — modal components

**Dev command changes:** `npm run dev` starts Vite with HMR — instant updates without `Cmd+R`. Build is still `npm run build`.
