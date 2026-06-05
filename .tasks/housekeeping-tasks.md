# Housekeeping Tasks — Pre-React Cleanup

## Context
Before migrating to React, we need to clean up the Electron JSON Prettifier app: tighten the CSS naming convention (BEM), restructure the header into organized rows, fix the path/variable display, improve the find widget layout, fix the custom theme system, and move toasts. All changes are in `index.html`, `styles.css`, and `renderer.js`.

**Critical files:**
- `index.html` — HTML structure
- `styles.css` — All CSS
- `renderer.js` — All JS (DOM refs in `ui` object, path functions)

---

## Execution Order

1. ✅ Task 9 — isolated CSS change, easiest warm-up
2. ✅ Task 3 — simple CSS change to control-group
3. ✅ Task 2 — move status bar to footer (HTML + CSS)
4. ✅ Task 1 — BEM rename across all three files (the big systematic pass)
5. ✅ Task 4 — restructure header into three rows (depends on BEM)
6. ✅ Task 7 — confirm find widget fix landed as part of Task 1's `.controls` rename
7. ✅ Task 6 — variable name input styling + JS (depends on Task 4 HTML)
8. ✅ Task 5 — path/accessor chips logic (depends on Tasks 4 & 6)
9. ✅ Task 8 — custom theme toggle (self-contained JS/CSS)
10. ✅ Task 10 — header collapse to 2 rows + right sidebar + UI polish (2026-05-05)

---

## Task 1 — BEM Naming Convention ✅
- [x] Convert all CSS class names to BEM across `index.html`, `styles.css`, and dynamic `className` assignments in `renderer.js`

**Key renames (old → new):**

| Old | New |
|---|---|
| `.header-container` | `.header__container` |
| `.app-title` | `.header__app-title` |
| `.controls` | `.header__controls` ← **critical: resolves Task 7 Monaco conflict** |
| `.control-group` | `.header__control-group` |
| `.breadcrumb-container` | removed (becomes `.header__action-row--three`) |
| `.current-location` | `.header__path-group` |
| `.breadcrumb-wrapper-header` | `.header__breadcrumb-wrapper` |
| `.breadcrumb-display` (both) | `.breadcrumb__display` |
| `.breadcrumb-item` | `.breadcrumb__item` |
| `.breadcrumb-separator` | `.breadcrumb__separator` |
| `.breadcrumb-wrapper` (status-bar) | `.footer__breadcrumb-wrapper` |
| `.status-bar` | `.footer__status-bar` |
| `.error-message` | `.footer__error` |
| `.path-display` | `.footer__path-display` |
| `.path-copy` | `.footer__path-copy` |
| `.default-object-name` | `.footer__variable-name` |
| `.status-text` | `.footer__status-text` |
| `.primary-btn` | `.btn--primary` |
| `.secondary-btn` | `.btn--secondary` |
| `.action-btn` | `.btn--action` |
| `.icon-btn` | `.btn--icon` |
| `.editor-container` | `.editor__container` |
| `.editor` | `.editor__content` |
| `.sidebar-header` | `.sidebar__header` |
| `.sidebar-content` | `.sidebar__content` |
| `.documents-list` | `.sidebar__documents-list` |
| `.document-item` | `.document__item` |
| `.document-item .title` | `.document__item-title` |
| `.document-item .tags` | `.document__item-tags` |
| `.document-item .tag` | `.document__item-tag` |
| `.modal-content` | `.modal__content` |
| `.modal-header` | `.modal__header` |
| `.modal-body` | `.modal__body` |
| `.modal-footer` | `.modal__footer` |
| `.form-group` | `.form__group` |
| `.settings-section` | `.settings__section` |
| `.theme-toggle` | `.theme-toggle` (block, keep) |
| `.theme-switch` | `.theme-toggle__switch` |
| `.theme-slider` | `.theme-toggle__slider` |
| `.theme-label` | `.theme-toggle__label` |
| `.theme-colors` | `.theme-editor__colors` |
| `.color-picker` | `.theme-editor__color-picker` |
| `.theme-preview` | `.theme-editor__preview` |
| `.theme-preview-code` | `.theme-editor__preview-code` |
| `.custom-themes-list` | `.custom-themes__list` |
| `.theme-item` | `.custom-themes__item` |
| `.theme-item.active` | `.custom-themes__item--active` |
| `.theme-color-preview` | `.custom-themes__item-preview` |
| `.theme-name` | `.custom-themes__item-name` |
| `.delete-theme` | `.custom-themes__item-delete` |
| `.toast-message` | `.toast__message` |

**renderer.js locations with dynamic className assignments to update:**
- Line 309: `themeItem.className = 'theme-item'`
- Lines 313, 318, 320: color-preview, theme-name, icon-btn/delete-theme
- Lines 653, 661: breadcrumb-item, breadcrumb-separator
- Line 605: `empty-breadcrumb` in innerHTML
- `updateDocumentsList()` (~lines 246–295): document-item, title, tags, tag classes
- `ui` object (~lines 979–1024): update any querySelector calls referencing old class names

---

## Task 2 — Move Status Bar to `<footer>` ✅
- [x] Move the entire `<div class="status-bar">` block from inside `<main>` into `<footer>`

```html
<!-- After -->
<footer>
  <div class="footer__status-bar">
    ... (existing status-bar contents)
  </div>
</footer>
```

CSS: Remove `height: var(--status-bar-height)` from `.status-bar` and apply it to `footer` instead. The `main` flex layout handles filling the remaining space automatically.

---

## Task 3 — Control Groups: Horizontal Flex with 10px Gap ✅
- [x] Change `.header__control-group` from column flex to row flex

```css
.header__control-group {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
}
```

Remove `width: 100%` from `.control-group select` (no longer needed in row layout).

---

## Task 4 — Three Action Rows in Header ✅
- [x] Replace the single `.header__controls` div with three explicit row divs
- [x] Rename button text: "Saved" → "History", "Save" → "Save To History"

**New HTML structure:**

```html
<header>
  <div class="header__container">
    <h1 class="header__app-title">JSON Prettifier</h1>

    <!-- Row 1 -->
    <div class="header__action-row header__action-row--one">
      <div class="header__control-group">
        <label>Indentation:</label>
        <select id="indentation">...</select>
      </div>
      <div class="header__control-group">
        <label>View Mode:</label>
        <select id="view-mode">...</select>
      </div>
      <button id="expand-all" class="btn--action">...</button>
      <button id="collapse-all" class="btn--action">...</button>
      <button id="sort-json" class="btn--action">...</button>
      <button id="unescape-strings" class="btn--action">...</button>
    </div>

    <!-- Row 2 -->
    <div class="header__action-row header__action-row--two">
      <button id="toggle-sidebar" class="btn--secondary">... History</button>
      <button id="prettify" class="btn--primary">Prettify</button>
      <button id="clear" class="btn--secondary">Clear</button>
      <button id="copy" class="btn--secondary">Copy</button>
      <button id="save-document" class="btn--secondary">... Save To History</button>
    </div>

    <!-- Row 3 (was .breadcrumb-container) -->
    <div class="header__action-row header__action-row--three">
      <div class="theme-toggle">
        <span class="theme-toggle__label">Dark Mode</span>
        <label class="theme-toggle__switch">
          <input type="checkbox" id="theme-toggle">
          <span class="theme-toggle__slider"></span>
        </label>
      </div>
      <div class="header__settings-group">
        <span>Settings</span>
        <button id="settings-btn" class="btn--icon" title="Settings">...</button>
      </div>
      <!-- Variable name + Path (Tasks 5 & 6) -->
      <div class="header__path-group">
        <input id="variable-name" class="header__variable-name-input" value="data">
        <span class="header__path-label">Path:</span>
        <div class="header__breadcrumb-wrapper">
          <div id="breadcrumb-display-header" class="breadcrumb__display"></div>
          <div id="array-accessors" class="header__array-accessors"></div>
        </div>
        <button id="path-copy-header" class="btn--action">Copy Path</button>
      </div>
    </div>
  </div>
</header>
```

**CSS for each row:**
```css
.header__action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 6px 0;
  border-top: 1px solid var(--border-color);
}
```

---

## Task 5 — Fix Current Location / Copy Path ✅
- [x] Fix `generateAccessCode()` to use the variable-name input instead of hardcoded `'data'`
- [x] Add inline accessor chips for array items (Extended 7 methods, each with its own copy button)

**`generateAccessCode` fix** (renderer.js line 681):
```js
function generateAccessCode(path) {
  const varName = document.getElementById('variable-name')?.value?.trim() || 'data';
  if (!path) return varName;
  let code = varName;
  path.split('.').forEach(segment => {
    if (segment.includes('[')) {
      const propName = segment.substring(0, segment.indexOf('['));
      const arrayAccess = segment.substring(segment.indexOf('['));
      code += propName ? `.${propName}${arrayAccess}` : arrayAccess;
    } else {
      code += `.${segment}`;
    }
  });
  return code;
}
```

**New `renderArrayAccessors(arrayBasePath, index, value)` function:**

When cursor is on an array item (path ends in `[n]`), populate `#array-accessors` with chips for 7 patterns:

1. `data.items[0]` — direct index
2. `data.items.find(i => i === 'alpha')` — find first match
3. `data.items.filter(i => i === 'alpha')` — filter all matches
4. `data.items.indexOf('alpha')` — get index of value
5. `data.items.includes('alpha')` — check existence
6. `data.items.map(i => i)` — map (for object arrays: `data.items.map(i => i.key)`)
7. `data.items.findIndex(i => i === 'alpha')` — find index of match

For primitive values (`string`, `number`, `boolean`), comparison uses `=== value`.
For object values, `.find()`, `.filter()`, `.findIndex()` use `i => typeof i === 'object'` as a placeholder.

Each chip structure:
```html
<div class="accessor-chip">
  <code>data.items[0]</code>
  <button class="btn--icon accessor-chip__copy"><i class="fas fa-copy"></i></button>
</div>
```

Clear `#array-accessors` when cursor moves to a non-array path.

Update `updateBreadcrumbs()` to call `renderArrayAccessors()` when path contains `[n]`.

---

## Task 6 — Variable Name Input: Inline Transparent Styling ✅
- [x] Move `#variable-name` from footer into `.header__path-group` in action-row-three (done in Task 4)
- [x] Style as transparent inline text with auto-width

**CSS:**
```css
.header__variable-name-input {
  background: transparent;
  border: none;
  border-bottom: 1px solid transparent;
  color: var(--text-color);
  font-size: inherit;
  font-family: inherit;
  min-width: 2ch;
  padding: 0 2px;
  transition: border-color 0.2s;
}
.header__variable-name-input:focus {
  border-bottom-color: var(--primary-color);
  outline: none;
}
```

**Auto-width JS** (add in `setupEventListeners()`):
```js
const varInput = document.getElementById('variable-name');
const sizeInput = () => { varInput.style.width = (varInput.value.length + 1) + 'ch'; };
varInput.addEventListener('input', () => {
  sizeInput();
  updateBreadcrumbs(currentPath); // refresh accessor chips with new variable name
});
sizeInput(); // run on init
```

Remove the old `.footer__variable-name` div from the footer status bar.

---

## Task 7 — Find/Replace Buttons Position ✅
- [x] Confirm this is resolved by Task 1's `.controls` → `.header__controls` rename
- [x] Add a defensive Monaco CSS reset

**Root cause:** Monaco's internal `.controls` class was being overridden by our global `.controls { width: 100%; margin-bottom: 10px; }` rule, pushing regex/case toggle buttons to the left.

**Fix:** Renaming `.controls` → `.header__controls` in Task 1 eliminates the conflict.

**Defensive reset** to add at the end of `styles.css`:
```css
/* Prevent global styles from leaking into Monaco Editor internals */
.monaco-editor .controls,
.monaco-editor input {
  all: revert;
}
```

---

## Task 8 — Custom Theme Toggle System ✅
- [x] Add `activeCustomThemeId` state variable
- [x] Make theme items toggleable (click active theme to deactivate)
- [x] Add "Clear Theme" button
- [x] Persist active custom theme in user preferences

**State** (add at top of renderer.js with other module state):
```js
let activeCustomThemeId = null;
```

**`applyCustomTheme(theme)` update:**
- If `theme.id === activeCustomThemeId`: deactivate — set `activeCustomThemeId = null`, revert Monaco to `isDarkTheme ? 'vs-dark' : 'vs'`, remove active class from all items, persist
- Otherwise: set `activeCustomThemeId = theme.id`, apply theme, update active class on theme items, persist

**`updateCustomThemesList()` update:**
- Add `.custom-themes__item--active` to the matching theme item
- Add a "Clear Theme" button at the bottom of the list

**`clearCustomTheme()` new function:**
```js
function clearCustomTheme() {
  activeCustomThemeId = null;
  monaco.editor.setTheme(isDarkTheme ? 'vs-dark' : 'vs');
  updateCustomThemesList();
  showToast('Editor theme cleared');
}
```

**Persistence:** Include `activeCustomThemeId` in `saveUserPreferences()`. In `loadUserPreferences()`, after Monaco initializes, apply the saved custom theme if it exists in `customThemes`.

**CSS:**
```css
.custom-themes__item--active {
  border-color: var(--primary-color);
  background-color: rgba(0, 123, 255, 0.1);
}
```

---

## Task 9 — Toast Notifications: Top Right ✅
- [x] Move toast from bottom-right to top-right

**CSS change in `styles.css`:**
```css
.toast {
  position: fixed;
  top: 20px;    /* was: bottom: 20px */
  right: 20px;
  /* remove bottom: 20px */
}
```

---

## Verification Checklist

- [ ] `npm start` — app opens without errors
- [ ] Three distinct header rows with space-between spacing
- [ ] Control groups (Indentation, View Mode) show label and select side by side
- [ ] Find/replace widget: regex and case-sensitive buttons appear inside input on the right
- [ ] Click into a JSON array value — 7 accessor chips appear with individual copy buttons
- [ ] Change variable name input — path chips update to new variable name, input grows with text
- [ ] Apply a custom theme — editor colors change, header/footer chrome unchanged
- [ ] Click same active theme — it deactivates (Monaco reverts to vs/vs-dark)
- [ ] "Clear Theme" button resets editor to default theme
- [ ] Toast appears top-right
- [ ] All class names follow BEM pattern throughout

---

## Bug Fix Time

### Path Feature — 6 Bugs Fixed ✓

**Context:** The dot-notation path display is fully wired up in the HTML/CSS but completely broken at runtime. Nothing shows visually, clicking any key or value does nothing, and the Copy Path button produces nothing. Six distinct bugs compound each other.

**Status: All 6 bugs fixed — 2026-05-04**

---

#### ~~Bug 1 — Cursor listener gated on `currentJson` (renderer.js:854)~~ ✓ FIXED

The `onDidChangeCursorPosition` handler was wrapped in `if (currentJson)`. Pasting raw JSON and clicking anywhere did nothing.

- **Fixed at:** renderer.js:892 — removed the guard, replaced with a content-empty check. Path now updates on every cursor move regardless of prettify state.

---

#### ~~Bug 2 — `getJsonPathAtPosition` drops array indices (renderer.js:571–633)~~ ✓ FIXED

Array indices never appeared in paths. `{"users": [{"id": 1}]}` on `id` returned `"users.id"` instead of `"users[0].id"`.

- **Fixed at:** renderer.js:571–661 — full rewrite using a unified `contextStack` (`{type, baseLen}`). Each `{`/`[` saves `jsonPath.length`; each `}`/`]` restores it. `[` now pushes index `0` immediately. Comma checks `topContext.type === 'array'` instead of the broken objectStack condition.

---

#### ~~Bug 3 — Clicking a key shows no path (renderer.js:571–633)~~ ✓ FIXED

The loop broke before the `:`, so `currentKey` was never pushed. Clicking `"name"` returned empty path.

- **Fixed at:** renderer.js:638–651 — post-loop lookahead: if `isKey` is true at break, scans forward to complete/find the key string. Clicking a key and its value now show the same path.

---

#### ~~Bug 4 — Breadcrumb chips omit variable name prefix (renderer.js:688–704)~~ ✓ FIXED

Chips showed `users > [0] > name` but Copy gave `data.users[0].name`.

- **Fixed at:** renderer.js:716–737 — `populateBreadcrumbs` now prepends the variable name as the first chip. Result: `data > users > [0] > name`.

---

#### ~~Bug 5 — `.breadcrumb__empty` has no CSS (styles.css)~~ ✓ FIXED

"No path selected" placeholder was invisible — class existed in JS but not in CSS.

- **Fixed at:** styles.css — added `.breadcrumb__empty` rule with muted color and italic style after `.breadcrumb__separator`.

---

#### ~~Bug 6 — Copy button silently does nothing with no path (renderer.js:802–813)~~ ✓ FIXED

`setupPathCopyButton` had no `else` branch — no feedback when path is empty.

- **Fixed at:** renderer.js:838–850 — added else toast: "Click inside the editor to select a path".

---

### Verification Checklist — Path Feature

- [ ] Paste `{"name": "Alice"}` (no Prettify) → click `"name"` key → breadcrumbs show `data > name`
- [ ] Click `"Alice"` value → same breadcrumbs `data > name`
- [ ] Change variable name input to `user` → chips update to `user > name`
- [ ] Click Copy Path → clipboard contains `user.name`
- [ ] Click Copy Path with empty editor → toast: "Click inside the editor to select a path"
- [ ] Paste `{"users": [{"id": 1, "name": "Alice"}, {"id": 2}]}` → click `"Alice"` → breadcrumbs: `data > users > [0] > name`
- [ ] Click on the `[0]` array element → 7 accessor chips appear
- [ ] Click second object (`"id": 2`) → breadcrumbs: `data > users > [1] > id`
- [ ] All chips copy correctly to clipboard

---

## Task 10 — Header Collapse, Right Sidebar, UI Polish ✅

**Completed: 2026-05-05**

A multi-part UI pass that simplifies the header from 3 rows to 2, introduces a right-side Options sidebar, and adds several polish items to the path/accessor area.

---

### 10a — Header restructured to 2 rows ✅

**Old:** 3 rows (editor controls / document actions + theme + settings / path)
**New:** 2 rows (title + toolbar / path)

Row 1 is now `.header__title-row`: the app title on the left, all action buttons on the right in `.header__toolbar`.

Buttons in toolbar: History, Prettify, Clear, Copy, Save, Expand/Collapse toggle, Options.

Row 2 is `.header__path-area` wrapping the path row and the array accessor panel.

**Files:** `index.html`, `styles.css` (added `.header__title-row`, `.header__toolbar`)

---

### 10b — Right sidebar: Options ✅

New `#options-sidebar` (`.sidebar.sidebar--right`) positioned `right: 0` inside `<main>`, toggled by `#toggle-options-sidebar` / `#close-options-sidebar`.

**Contains (moved from header rows and settings modal):**
- Indentation select (`#indentation`)
- View Mode select (`#view-mode`)
- Dark Mode toggle (`#theme-toggle`)
- Sort Properties button (`#sort-json`)
- Unescape Strings button (`#unescape-strings`)
- Custom Themes list (`#custom-themes-list`) + Create New Theme button (`#create-theme-btn`)

Controls save instantly (no separate Save Settings button). The old Settings modal (`#settings-modal`) is retired and removed from the HTML.

**CSS:** `.sidebar--right { left: auto; right: 0; border-left: ...; border-right: none; }` plus `.sidebar__section-label`, `.sidebar__option-group`, `.sidebar__tool-btn`.

**JS:** Added `toggleOptionsSidebarBtn`, `closeOptionsSidebarBtn`, `optionsSidebar` to `ui` object. Removed `settingsBtn`, `settingsModal`, `defaultIndentation`, `defaultTheme`, `saveSettingsBtn`, `closeSettingsModal` from `ui` and their event handlers.

---

### 10c — Hover-expand array accessor panel ✅

Array accessor chips moved out of the breadcrumb wrapper into a new `.header__array-panel` div inside `.header__path-area`. The panel is hidden at `max-height: 0` and slides to `max-height: 60px` when `.header__path-area` is hovered AND the panel has the `has-content` class.

`has-content` is added by `renderArrayAccessors()` after populating chips and removed when the path changes to a non-array or is cleared.

**CSS:** Transition on `max-height` and `padding`; border-top appears on expand.

**JS:** `ui.arrayPanel` maps to `document.querySelector('.header__array-panel')`. Three locations toggle `has-content`: `renderArrayAccessors` (add), two clearing branches in `updateBreadcrumbs` (remove).

---

### 10d — Compact breadcrumb dot notation ✅

`.breadcrumb__separator` margin reduced from `0 5px` → `0 1px`.
`.header__breadcrumb-wrapper` gap reduced from `1px` → `0`.

Path now reads `data.nested.items.[1]` with no extra spacing around dots.

---

### 10e — Array chip tooltips ✅

Each accessor chip now shows a 16px tooltip on hover describing what the method does.

**CSS:** `.accessor-chip` gets `position: relative`. New `.accessor-chip__tooltip` is `display: none` by default, shown on `.accessor-chip:hover`. Styled with border, shadow, and a bottom arrow via `::after`.

**JS:** `tooltip` field added to each pattern in `renderArrayAccessors`. A `<div class="accessor-chip__tooltip">` is prepended inside each chip before the `<code>` element.

| Method | Tooltip |
|---|---|
| `[index]` | Access element directly by index |
| `find` | Returns the first element matching the condition |
| `filter` | Returns all matching elements as a new array |
| `indexOf` | Returns the index of the value, or -1 if not found |
| `includes` | Returns true if the array contains this value |
| `map` | Returns a new array by transforming each element |
| `findIndex` | Returns the index of the first match, or -1 |

---

### 10f — Footer simplified ✅

Removed from footer HTML: `#breadcrumb-display` wrapper, `#path-display`, `#path-copy` button.
Footer now contains only `#error-message` + `#status-text`.

Removed from `renderer.js`: `ui.breadcrumbDisplay`, `ui.pathDisplay`, `ui.pathCopyBtn` references and all usages. `updateBreadcrumbs` guard changed to check `ui.breadcrumbDisplayHeader` (the header display is now the only one).

Removed from `styles.css`: `.footer__breadcrumb-wrapper`, `.footer__path-display`, `.footer__path-copy` rules.

---

### 10g — Expand/Collapse toggle button ✅

Replaced separate `#expand-all` / `#collapse-all` buttons with a single `#toggle-fold-all` button. Tracks `isFolded` state locally in the event handler closure. Label and icon flip between "Expand All" / "Collapse All" on each click.

---

### Verification Checklist — Task 10

- [ ] Header shows 2 rows: title+toolbar on top, path row below
- [ ] Clicking "Options" opens right sidebar; clicking ✕ closes it
- [ ] Changing Indentation in sidebar immediately reformats open JSON
- [ ] Dark Mode toggle in sidebar works
- [ ] Sort Properties and Unescape Strings work from sidebar
- [ ] Custom theme create/apply/delete works from sidebar
- [ ] Hover path row with array item selected → chip panel slides down
- [ ] Hover path row with non-array item → no panel appears
- [ ] Hover each chip → 16px tooltip appears above chip
- [ ] Breadcrumb reads `data.nested.items.[1]` (no spaces around dots)
- [ ] Expand All / Collapse All toggle with one button; label updates
- [ ] Footer shows only error area + "Ready" — no breadcrumb, no path text
