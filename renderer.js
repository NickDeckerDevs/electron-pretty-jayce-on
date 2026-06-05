/*
5/7/2026 - nick decker
ADDED
- currentPath module-level state — tracked from cursor position so the variable-name input can re-render breadcrumbs without a cursor move
- activeCustomThemeId module-level state — tracks which custom Monaco theme (if any) is applied
- renderArrayAccessors() — builds 7 accessor-pattern chips (index/find/filter/indexOf/includes/map/findIndex) when the cursor sits on an array item
- clearCustomTheme() — resets Monaco theme to vs/vs-dark and persists the cleared state
- variableNameInput / arrayAccessors refs in ui object; auto-width listener for #variable-name that also refreshes breadcrumbs

CHANGED
- generateAccessCode() reads variable name from the #variable-name input instead of hardcoded 'data'
- applyCustomTheme() now toggles — clicking the active theme clears it; otherwise applies and persists
- updateCustomThemesList() marks active item with .custom-themes__item--active and appends a "Clear Theme" button when one is active
- updateBreadcrumbs() detects array-index paths and calls renderArrayAccessors(); clears chips on non-array paths
- loadCustomThemes() restores the persisted activeCustomThemeId after themes are loaded
- saveCurrentPreferences() / settings save handler include activeCustomThemeId in the persisted preferences
- All dynamic className strings updated to BEM (document__item, custom-themes__item, breadcrumb__item, breadcrumb__separator, btn--icon, etc.)
- ui.editorContainer querySelector points at .editor__container
*/

/*
5/1/2026 - nick decker
ADDED
- #toggle-sidebar button click handler to open/close the saved documents sidebar

REMOVED
- 9 fetch('/api/...') calls to Express REST API — replaced with Storage.* localStorage methods
- Session management and Authorization header logic
- Dead Alt+click sidebar toggle listener on the save button

CHANGED
- All document/theme/preference persistence now uses Storage.* localStorage methods
- Monaco Editor loads from local node_modules instead of CDN
- Sidebar auto-opens after a successful document save
- docItem.appendChild(actions) now correctly renders delete buttons in the documents list
- Refactored: flat module structure, all functions defined before DOMContentLoaded entry point
*/

// --- Module-level state ---

let savedDocuments = [];
let customThemes = [];
let currentDocumentId = null;
let userPreferences = null;
let jsonEditor;
let isDarkTheme = false;
let currentJson = null;
let currentViewMode = 'formatted';
let currentPath = '';
let activeCustomThemeId = null;
let ui = null;

// --- Utility helpers ---

function getIndent() {
    return ui.indentationSelect.value === 'tab' ? '\t' : Number(ui.indentationSelect.value);
}

function parseJsonFlexible(rawJson) {
    try {
        return { parsed: JSON.parse(rawJson), wasFixed: false };
    } catch (jsonError) {
        try {
            // Handles unquoted keys and single quotes via JS object notation
            return { parsed: Function('return ' + rawJson)(), wasFixed: false };
        } catch (jsError) {
            const fixedInput = rawJson
                .replace(/'/g, '"')
                .replace(/([{,])\s*(\w+)\s*:/g, '$1"$2":')
                .replace(/,\s*([\]}])/g, '$1');
            try {
                return { parsed: JSON.parse(fixedInput), wasFixed: true };
            } catch (finalError) {
                throw new Error('Could not parse input as JSON or JavaScript object: ' + jsonError.message);
            }
        }
    }
}

function closeModal(modalEl) {
    if (modalEl) modalEl.classList.remove('active');
}

function saveCurrentPreferences() {
    saveUserPreferences({
        theme: isDarkTheme ? 'dark' : 'light',
        indentation: ui.indentationSelect.value === 'tab' ? -1 : Number(ui.indentationSelect.value),
        useSpaces: ui.indentationSelect.value !== 'tab',
        activeCustomThemeId
    });
}

// --- Persistence / data layer ---

async function loadUserPreferences() {
    try {
        const data = await Storage.getPreferences();
        if (data.success && data.preferences) {
            userPreferences = data.preferences;

            if (userPreferences.theme === 'dark') {
                isDarkTheme = true;
                ui.themeToggle.checked = true;
                document.body.classList.add('dark-theme');
                if (jsonEditor) monaco.editor.setTheme('vs-dark');
            }

            if (userPreferences.indentation) {
                const indent = userPreferences.indentation === -1 ? 'tab' : userPreferences.indentation.toString();
                ui.indentationSelect.value = indent;
            }
        }
    } catch (error) {
        console.error('Error loading preferences:', error);
    }
}

async function saveUserPreferences(preferences) {
    try {
        const data = await Storage.savePreferences(preferences);
        if (data.success) {
            userPreferences = data.preferences;
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error saving preferences:', error);
        return false;
    }
}

async function loadCustomThemes() {
    try {
        const data = await Storage.getThemes();
        if (data.success) {
            customThemes = data.themes || [];
            updateCustomThemesList();

            if (userPreferences?.activeCustomThemeId) {
                const savedTheme = customThemes.find(t => t.id === userPreferences.activeCustomThemeId);
                if (savedTheme) applyCustomTheme(savedTheme);
            }
        }
    } catch (error) {
        console.error('Error loading themes:', error);
    }
}

async function saveCustomTheme(theme) {
    try {
        const data = await Storage.saveTheme(theme);
        if (data.success) {
            const index = customThemes.findIndex(t => t.id === data.theme.id);
            if (index >= 0) {
                customThemes[index] = data.theme;
            } else {
                customThemes.push(data.theme);
            }
            updateCustomThemesList();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error saving theme:', error);
        return false;
    }
}

async function deleteCustomTheme(themeId) {
    try {
        const data = await Storage.deleteTheme(themeId);
        if (data.success) {
            customThemes = customThemes.filter(theme => theme.id !== themeId);
            updateCustomThemesList();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting theme:', error);
        return false;
    }
}

async function loadSavedDocuments() {
    try {
        const data = await Storage.getDocuments();
        if (data.success) {
            savedDocuments = data.documents || [];
            updateDocumentsList();
        }
    } catch (error) {
        console.error('Error loading documents:', error);
    }
}

async function loadDocument(documentId) {
    try {
        const data = await Storage.getDocument(documentId);
        if (data.success && data.document) {
            currentDocumentId = data.document.id;
            currentJson = data.document.content;
            jsonEditor.setValue(JSON.stringify(currentJson, null, getIndent()));
            ui.statusText.textContent = `Loaded: ${data.document.title}`;
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error loading document:', error);
        return false;
    }
}

async function saveDocument(document) {
    try {
        if (currentDocumentId) document.id = currentDocumentId;

        const data = await Storage.saveDocument(document);
        if (data.success && data.document) {
            currentDocumentId = data.document.id;

            const index = savedDocuments.findIndex(doc => doc.id === data.document.id);
            if (index >= 0) {
                savedDocuments[index] = data.document;
            } else {
                savedDocuments.push(data.document);
            }

            updateDocumentsList();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error saving document:', error);
        return false;
    }
}

async function deleteDocument(documentId) {
    try {
        const data = await Storage.deleteDocument(documentId);
        if (data.success) {
            savedDocuments = savedDocuments.filter(doc => doc.id !== documentId);

            if (currentDocumentId === documentId) {
                currentDocumentId = null;
                jsonEditor.setValue('');
                ui.statusText.textContent = 'Ready';
            }

            updateDocumentsList();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting document:', error);
        return false;
    }
}

// --- UI helpers ---

function showError(message) {
    ui.errorMessage.textContent = message;
    showToast(message, true);
}

function showToast(message, isError = false, duration = 3000) {
    ui.toast.style.backgroundColor = isError ? 'var(--error-color)' : 'var(--success-color)';
    ui.toastMessage.textContent = message;
    ui.toast.classList.add('show');
    setTimeout(() => ui.toast.classList.remove('show'), duration);
}

function updateDocumentsList() {
    if (!ui.documentsList) return;

    ui.documentsList.innerHTML = '';

    if (savedDocuments.length === 0) {
        ui.documentsList.innerHTML = '<div class="empty-state">No saved documents</div>';
        return;
    }

    const sortedDocs = [...savedDocuments].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    sortedDocs.forEach(doc => {
        const docItem = document.createElement('div');
        docItem.className = 'document__item';
        docItem.dataset.id = doc.id;

        let tagsHtml = '';
        if (doc.tags && doc.tags.length) {
            tagsHtml = '<div class="document__item-tags">' + doc.tags.map(tag => `<span class="document__item-tag">${tag}</span>`).join('') + '</div>';
        }

        const actions = document.createElement('div');
        actions.className = 'actions';
        actions.innerHTML = '<button class="btn--icon delete-doc" title="Delete"><i class="fas fa-trash"></i></button>';

        docItem.innerHTML = `
            <div class="document__item-title">${doc.title}</div>
            ${tagsHtml}
            <div class="updated-at">Last updated: ${new Date(doc.updatedAt).toLocaleString()}</div>
        `;
        docItem.appendChild(actions);

        docItem.addEventListener('click', (e) => {
            if (e.target.closest('.delete-doc')) return;
            loadDocument(doc.id);
            ui.sidebar.classList.remove('active');
        });

        const deleteBtn = docItem.querySelector('.delete-doc');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete document "${doc.title}"?`)) deleteDocument(doc.id);
            });
        }

        ui.documentsList.appendChild(docItem);
    });
}

function updateCustomThemesList() {
    if (!ui.customThemesList) return;

    ui.customThemesList.innerHTML = '';

    if (customThemes.length === 0) {
        ui.customThemesList.innerHTML = '<div class="empty-state">No custom themes</div>';
        return;
    }

    customThemes.forEach(theme => {
        const themeItem = document.createElement('div');
        themeItem.className = 'custom-themes__item' + (theme.id === activeCustomThemeId ? ' custom-themes__item--active' : '');
        themeItem.dataset.id = theme.id;

        const colorPreview = document.createElement('span');
        colorPreview.className = 'custom-themes__item-preview';
        colorPreview.style.backgroundColor = theme.colors.background || '#333';

        const nameEl = document.createElement('span');
        nameEl.className = 'custom-themes__item-name';
        nameEl.textContent = theme.name;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn--icon custom-themes__item-delete';
        deleteBtn.title = 'Delete';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';

        themeItem.addEventListener('click', (e) => {
            if (e.target.closest('.custom-themes__item-delete')) return;
            applyCustomTheme(theme);
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Delete theme "${theme.name}"?`)) deleteCustomTheme(theme.id);
        });

        themeItem.appendChild(colorPreview);
        themeItem.appendChild(nameEl);
        themeItem.appendChild(deleteBtn);
        ui.customThemesList.appendChild(themeItem);
    });

    if (activeCustomThemeId) {
        const clearBtn = document.createElement('button');
        clearBtn.className = 'btn--secondary';
        clearBtn.style.marginTop = '8px';
        clearBtn.textContent = 'Clear Theme';
        clearBtn.addEventListener('click', clearCustomTheme);
        ui.customThemesList.appendChild(clearBtn);
    }
}

function applyCustomTheme(theme) {
    if (theme.id === activeCustomThemeId) {
        activeCustomThemeId = null;
        monaco.editor.setTheme(isDarkTheme ? 'vs-dark' : 'vs');
        updateCustomThemesList();
        saveCurrentPreferences();
        showToast('Editor theme cleared');
        return;
    }

    const colors = theme.colors;

    monaco.editor.defineTheme(theme.name, {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'string', foreground: colors.string || '#ce9178' },
            { token: 'number', foreground: colors.number || '#b5cea8' },
            { token: 'keyword', foreground: colors.property || '#9cdcfe' },
            { token: 'boolean', foreground: colors.boolean || '#569cd6' }
        ],
        colors: {
            'editor.background': colors.background || '#1e1e1e',
            'editor.foreground': colors.text || '#d4d4d4'
        }
    });

    activeCustomThemeId = theme.id;
    monaco.editor.setTheme(theme.name);
    updateCustomThemesList();
    saveCurrentPreferences();
    showToast(`Applied theme: ${theme.name}`);
}

function clearCustomTheme() {
    activeCustomThemeId = null;
    monaco.editor.setTheme(isDarkTheme ? 'vs-dark' : 'vs');
    updateCustomThemesList();
    saveCurrentPreferences();
    showToast('Editor theme cleared');
}

function updateThemePreview() {
    const preview = document.getElementById('theme-preview-code');
    if (!preview) return;

    const bg = document.getElementById('theme-background').value;
    const text = document.getElementById('theme-text').value;
    const string = document.getElementById('theme-string').value;
    const number = document.getElementById('theme-number').value;
    const property = document.getElementById('theme-property').value;
    const boolean = document.getElementById('theme-boolean').value;

    preview.style.backgroundColor = bg;
    preview.style.color = text;
    preview.innerHTML = `{
  <span style="color:${property}">"name"</span>: <span style="color:${string}">"Sample Object"</span>,
  <span style="color:${property}">"active"</span>: <span style="color:${boolean}">true</span>,
  <span style="color:${property}">"count"</span>: <span style="color:${number}">42</span>,
  <span style="color:${property}">"items"</span>: [<span style="color:${string}">"string"</span>, <span style="color:${boolean}">null</span>, <span style="color:${boolean}">false</span>]
}`;
}

// --- Editor & JSON functions ---

function initializeEditors() {
    jsonEditor = monaco.editor.create(document.getElementById('json-editor'), {
        language: 'json',
        minimap: { enabled: true },
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        theme: isDarkTheme ? 'vs-dark' : 'vs',
        fontSize: 14,
        renderWhitespace: 'selection',
        wordWrap: 'on',
        tabSize: 2,
        folding: true,
        foldingStrategy: 'indentation'
    });

    let autoSaveTimer;
    jsonEditor.onDidChangeModelContent(() => {
        ui.statusText.textContent = 'Editing';
        ui.errorMessage.textContent = '';
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
            localStorage.setItem('lastEditorContent', jsonEditor.getValue());
        }, 1000);
    });

    loadInitialContent();

    window.electron.onJsonReceived(async (payload) => {
        if (await applyIncomingPayload(payload)) {
            showToast('JSON loaded from external source!');
        }
    });
}

async function applyIncomingPayload(payload) {
    if (!payload) return false;
    const jsonData = payload.source === 'clipboard'
        ? await window.electron.readClipboard()
        : payload.data;
    if (!jsonData) return false;
    jsonEditor.setValue(jsonData);
    ui.statusText.textContent = 'Loaded from external source';
    if (payload.varName) {
        ui.variableNameInput.value = payload.varName;
        ui.variableNameInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return true;
}

async function loadInitialContent() {
    const payload = await window.electron.getPendingPayload();
    if (await applyIncomingPayload(payload)) {
        return;
    }

    const lastSession = localStorage.getItem('lastEditorContent');
    if (lastSession) {
        jsonEditor.setValue(lastSession);
        ui.statusText.textContent = 'Restored from last session';
        return;
    }

    jsonEditor.setValue('// Paste your JSON here and click "Prettify"');
}

function prettifyContent() {
    const rawJson = jsonEditor.getValue();

    if (!rawJson || rawJson.trim() === '' || rawJson.includes('// Paste your JSON here')) {
        showError('Please enter some JSON content');
        return;
    }

    try {
        const { parsed, wasFixed } = parseJsonFlexible(rawJson);

        if (wasFixed) showToast('Fixed and formatted JavaScript object notation', false, 3000);

        currentJson = parsed;
        jsonEditor.setValue(JSON.stringify(parsed, null, getIndent()));
        ui.statusText.textContent = 'JSON formatted successfully';
        ui.errorMessage.textContent = '';
        showToast('JSON formatted successfully!');

        if (currentViewMode === 'tree') convertToTreeView();
    } catch (error) {
        showError(`Parsing error: ${error.message}`);
        ui.statusText.textContent = 'Error';
    }
}

function processNestedStrings(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    Object.keys(obj).forEach(key => {
        const value = obj[key];

        if (typeof value === 'string' &&
            ((value.startsWith('[') && value.endsWith(']')) ||
                (value.startsWith('{') && value.endsWith('}')))) {
            try {
                obj[key] = JSON.parse(value);
            } catch (e) {
                // not valid JSON, leave as-is
            }
        } else if (typeof value === 'object' && value !== null) {
            processNestedStrings(value);
        }
    });

    return obj;
}

function convertToTreeView() {
    if (!currentJson) return;

    try {
        jsonEditor.setValue(JSON.stringify(currentJson, null, getIndent()));
        jsonEditor.updateOptions({ folding: true, foldingStrategy: 'indentation' });

        setTimeout(() => {
            const foldAction = jsonEditor.getAction('editor.foldLevel2');
            if (foldAction) foldAction.run();
        }, 100);

        showToast('Tree view enabled. Use expand/collapse buttons or click the gutter markers.');
    } catch (error) {
        showError(`Error creating tree view: ${error.message}`);
        ui.viewModeSelect.value = 'formatted';
    }
}

function sortJsonObject(obj) {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
        if (Array.isArray(obj)) {
            return obj.map(item => (item !== null && typeof item === 'object') ? sortJsonObject(item) : item);
        }
        return obj;
    }

    const sortedObj = {};
    Object.keys(obj).sort().forEach(key => {
        const value = obj[key];
        sortedObj[key] = (value !== null && typeof value === 'object') ? sortJsonObject(value) : value;
    });

    return sortedObj;
}

function getJsonPathAtPosition(jsonString, position) {
    try {
        let lineIndex = 0;
        let charPos = 0;
        let jsonPath = [];
        let inString = false;
        let currentKey = '';
        let isKey = false;
        let contextStack = [];  // {type: 'array'|'object', baseLen: number}
        let arrayIndices = [];

        let i = 0;
        for (; i < jsonString.length; i++) {
            const char = jsonString[i];

            if (lineIndex > position.lineNumber - 1 ||
                (lineIndex === position.lineNumber - 1 && charPos >= position.column - 1)) {
                break;
            }

            if (char === '\n') { lineIndex++; charPos = 0; continue; }
            charPos++;

            if (char === '"' && (i === 0 || jsonString[i - 1] !== '\\')) {
                inString = !inString;
                if (!inString && isKey) { isKey = false; }
                continue;
            }

            if (inString) { if (isKey) currentKey += char; continue; }

            const topContext = contextStack[contextStack.length - 1];

            if (char === '{') {
                contextStack.push({ type: 'object', baseLen: jsonPath.length });
                isKey = true; currentKey = '';
            } else if (char === '}') {
                const ctx = contextStack.pop();
                if (ctx) jsonPath.length = ctx.baseLen;
                currentKey = '';
            } else if (char === '[') {
                contextStack.push({ type: 'array', baseLen: jsonPath.length });
                arrayIndices.push(0);
                jsonPath.push(0);
                isKey = false; currentKey = '';
            } else if (char === ']') {
                const ctx = contextStack.pop();
                arrayIndices.pop();
                if (ctx) jsonPath.length = ctx.baseLen;
                isKey = false; currentKey = '';
            } else if (char === ':') {
                isKey = false; jsonPath.push(currentKey); currentKey = '';
            } else if (char === ',') {
                if (topContext && topContext.type === 'array') {
                    jsonPath.pop();
                    const newIdx = arrayIndices.pop() + 1;
                    arrayIndices.push(newIdx);
                    jsonPath.push(newIdx);
                } else {
                    const topCtx = contextStack[contextStack.length - 1];
                    jsonPath.length = topCtx ? topCtx.baseLen : 0;
                    isKey = true;
                }
                currentKey = '';
            }
        }

        // Cursor landed on or before a key string — scan ahead to complete/find it
        if (isKey) {
            let j = i;
            if (!inString) {
                while (j < jsonString.length && jsonString[j] !== '"') j++;
                j++;
                currentKey = '';
            }
            while (j < jsonString.length) {
                if (jsonString[j] === '"' && (j === 0 || jsonString[j - 1] !== '\\')) break;
                currentKey += jsonString[j++];
            }
            if (currentKey) jsonPath.push(currentKey);
        }

        return jsonPath.reduce((path, segment) => {
            if (typeof segment === 'number') return `${path}[${segment}]`;
            return path === '' ? segment : `${path}.${segment}`;
        }, '');
    } catch (e) {
        console.error('Error getting JSON path:', e);
        return '';
    }
}

function updateBreadcrumbs(jsonPath) {
    if (!ui.breadcrumbDisplayHeader) return;

    ui.breadcrumbDisplayHeader.innerHTML = '';

    if (!jsonPath) {
        ui.breadcrumbDisplayHeader.innerHTML = '<div class="breadcrumb__empty">No path selected</div>';
        if (ui.arrayPanel) ui.arrayPanel.classList.remove('has-content');
        return;
    }

    const segments = [];
    let currentPath = '';
    let tempPath = jsonPath;

    while (tempPath.includes('[')) {
        const dotIndex = tempPath.indexOf('.');
        const bracketIndex = tempPath.indexOf('[');

        if (dotIndex === -1 || (bracketIndex !== -1 && bracketIndex < dotIndex)) {
            if (bracketIndex > 0) {
                const propertyName = tempPath.substring(0, bracketIndex);
                currentPath += (currentPath ? '.' : '') + propertyName;
                segments.push({ text: propertyName, path: currentPath, isProperty: true });
                tempPath = tempPath.substring(bracketIndex);
            }

            const closeBracketIndex = tempPath.indexOf(']');
            if (closeBracketIndex !== -1) {
                const arrayIndex = tempPath.substring(1, closeBracketIndex);
                currentPath += `[${arrayIndex}]`;
                segments.push({ text: `[${arrayIndex}]`, path: currentPath, isArray: true });
                tempPath = tempPath.substring(closeBracketIndex + 1);
                if (tempPath.startsWith('.')) tempPath = tempPath.substring(1);
            } else {
                segments.push({ text: tempPath, path: currentPath + tempPath });
                break;
            }
        } else {
            const propertyName = tempPath.substring(0, dotIndex);
            currentPath += (currentPath ? '.' : '') + propertyName;
            segments.push({ text: propertyName, path: currentPath, isProperty: true });
            tempPath = tempPath.substring(dotIndex + 1);
        }
    }

    if (tempPath) {
        currentPath += (currentPath ? '.' : '') + tempPath;
        segments.push({ text: tempPath, path: currentPath, isProperty: true });
    }

    const populateBreadcrumbs = (container) => {
        const varName = ui?.variableNameInput?.value?.trim() || 'data';

        const rootItem = document.createElement('div');
        rootItem.className = 'breadcrumb__item';
        rootItem.dataset.path = '';
        rootItem.textContent = varName;
        rootItem.addEventListener('click', () => navigateToJsonPath(''));
        container.appendChild(rootItem);

        segments.forEach((segment) => {
            const sep = document.createElement('span');
            sep.className = 'breadcrumb__separator';
            sep.textContent = '.';
            container.appendChild(sep);

            const item = document.createElement('div');
            item.className = 'breadcrumb__item';
            item.dataset.path = segment.path;
            item.textContent = segment.text;
            item.addEventListener('click', () => navigateToJsonPath(segment.path));
            container.appendChild(item);
        });
    };

    populateBreadcrumbs(ui.breadcrumbDisplayHeader);

    if (ui.pathCopyHeaderBtn) ui.pathCopyHeaderBtn.dataset.path = jsonPath;

    const arrayMatch = jsonPath.match(/^(.*)\[(\d+)\]$/);
    if (arrayMatch && ui.arrayAccessors) {
        const arrayBasePath = arrayMatch[1];
        const index = parseInt(arrayMatch[2], 10);
        let value = null;
        try {
            let obj = currentJson;
            if (!obj) obj = JSON.parse(jsonEditor.getValue());
            const parts = arrayBasePath ? arrayBasePath.split('.') : [];
            for (const part of parts) {
                const m = part.match(/^(\w+)\[(\d+)\]$/);
                if (m) { obj = obj[m[1]][parseInt(m[2], 10)]; }
                else { obj = obj[part]; }
            }
            if (Array.isArray(obj)) value = obj[index];
        } catch (e) { /* leave value as null */ }
        renderArrayAccessors(arrayBasePath, index, value);
    } else if (ui.arrayAccessors) {
        ui.arrayAccessors.innerHTML = '';
        if (ui.arrayPanel) ui.arrayPanel.classList.remove('has-content');
    }
}

function navigateToJsonPath(path) {
    if (!path && path !== 0) return;
    showToast(`Path: ${generateAccessCode(path)}`, false, 5000);
}

function generateAccessCode(path) {
    const varName = ui?.variableNameInput?.value?.trim() || 'data';
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

function renderArrayAccessors(arrayBasePath, index, value) {
    if (!ui.arrayAccessors) return;
    ui.arrayAccessors.innerHTML = '';

    const varName = ui?.variableNameInput?.value?.trim() || 'data';
    const base = generateAccessCode(arrayBasePath);
    const isObject = value !== null && typeof value === 'object';
    const isPrimitive = !isObject;

    const valRepr = isPrimitive
        ? (typeof value === 'string' ? `'${value}'` : String(value))
        : null;

    const patterns = [
        { label: `${base}[${index}]`, code: `${base}[${index}]`, tooltip: 'Access element directly by index' },
        { label: `find`, code: isObject ? `${base}.find(i => typeof i === 'object')` : `${base}.find(i => i === ${valRepr})`, tooltip: 'Returns the first element matching the condition' },
        { label: `filter`, code: isObject ? `${base}.filter(i => typeof i === 'object')` : `${base}.filter(i => i === ${valRepr})`, tooltip: 'Returns all matching elements as a new array' },
        { label: `indexOf`, code: isObject ? null : `${base}.indexOf(${valRepr})`, tooltip: 'Returns the index of the value, or -1 if not found' },
        { label: `includes`, code: isObject ? null : `${base}.includes(${valRepr})`, tooltip: 'Returns true if the array contains this value' },
        { label: `map`, code: isObject ? `${base}.map(i => i)` : `${base}.map(i => i)`, tooltip: 'Returns a new array by transforming each element' },
        { label: `findIndex`, code: isObject ? `${base}.findIndex(i => typeof i === 'object')` : `${base}.findIndex(i => i === ${valRepr})`, tooltip: 'Returns the index of the first match, or -1' },
    ].filter(p => p.code !== null);

    patterns.forEach(({ label, code, tooltip }) => {
        const chip = document.createElement('div');
        chip.className = 'accessor-chip';

        const tooltipEl = document.createElement('div');
        tooltipEl.className = 'accessor-chip__tooltip';
        tooltipEl.textContent = tooltip;

        const codeEl = document.createElement('code');
        codeEl.textContent = code;

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn--icon accessor-chip__copy';
        copyBtn.title = 'Copy';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(code)
                .then(() => showToast(`Copied: ${code}`))
                .catch(err => showError('Failed to copy: ' + err));
        });

        chip.appendChild(tooltipEl);
        chip.appendChild(codeEl);
        chip.appendChild(copyBtn);
        ui.arrayAccessors.appendChild(chip);
    });

    if (ui.arrayPanel) ui.arrayPanel.classList.add('has-content');
}

function setupPathCopyButton(btn) {
    if (!btn) return;
    btn.addEventListener('click', () => {
        const path = btn.dataset.path;
        if (path !== undefined && path !== null) {
            const accessCode = generateAccessCode(path);
            navigator.clipboard.writeText(accessCode)
                .then(() => showToast(`Copied to clipboard: ${accessCode}`))
                .catch(err => showError('Failed to copy path: ' + err));
        } else {
            showToast('Click inside the editor to select a path', false, 2000);
        }
    });
}

function setupResizeObserver() {
    const resizeObserver = new ResizeObserver(() => {
        if (jsonEditor) jsonEditor.layout();
    });
    resizeObserver.observe(ui.editorContainer);
}

// --- Event listener setup ---

function setupEventListeners() {
    ui.prettifyBtn.addEventListener('click', prettifyContent);

    ui.clearBtn.addEventListener('click', () => {
        jsonEditor.setValue('');
        ui.errorMessage.textContent = '';
        ui.statusText.textContent = 'Ready';
        currentJson = null;
        currentDocumentId = null;
    });

    ui.copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(jsonEditor.getValue())
            .then(() => showToast('Copied to clipboard!'))
            .catch(err => showError('Failed to copy: ' + err));
    });

    ui.themeToggle.addEventListener('change', (e) => {
        isDarkTheme = e.target.checked;
        document.body.classList.toggle('dark-theme', isDarkTheme);
        monaco.editor.setTheme(isDarkTheme ? 'vs-dark' : 'vs');
        saveCurrentPreferences();
    });

    ui.indentationSelect.addEventListener('change', () => {
        if (currentJson) jsonEditor.setValue(JSON.stringify(currentJson, null, getIndent()));
        saveCurrentPreferences();
    });

    jsonEditor.onDidChangeCursorPosition((e) => {
        const content = jsonEditor.getValue();
        if (!content || content.trim() === '') return;
        currentPath = getJsonPathAtPosition(content, e.position);
        updateBreadcrumbs(currentPath);
    });

    setupPathCopyButton(ui.pathCopyHeaderBtn);

    if (ui.unescapeStringsBtn) {
        ui.unescapeStringsBtn.addEventListener('click', () => {
            if (!currentJson) return;
            try {
                currentJson = processNestedStrings(JSON.parse(JSON.stringify(currentJson)));
                jsonEditor.setValue(JSON.stringify(currentJson, null, getIndent()));
                if (currentViewMode === 'tree') convertToTreeView();
                showToast('Strings unescaped successfully');
            } catch (error) {
                showError(`Error while unescaping strings: ${error.message}`);
            }
        });
    }

    if (ui.saveDocumentBtn) {
        ui.saveDocumentBtn.addEventListener('click', () => {
            try {
                parseJsonFlexible(jsonEditor.getValue()); // validate

                if (currentDocumentId) {
                    const currentDoc = savedDocuments.find(doc => doc.id === currentDocumentId);
                    if (currentDoc) {
                        ui.documentTitle.value = currentDoc.title;
                        ui.documentTags.value = currentDoc.tags ? currentDoc.tags.join(', ') : '';
                    }
                } else {
                    ui.documentTitle.value = '';
                    ui.documentTags.value = '';
                }

                ui.saveModal.classList.add('active');
            } catch (error) {
                showError(`Cannot save: ${error.message}`);
            }
        });
    }

    if (ui.confirmSaveBtn) {
        ui.confirmSaveBtn.addEventListener('click', () => {
            if (!ui.documentTitle.value.trim()) {
                showError('Please enter a title for your document');
                return;
            }

            const tags = ui.documentTags.value.split(',').map(t => t.trim()).filter(t => t);

            saveDocument({
                title: ui.documentTitle.value,
                content: JSON.parse(jsonEditor.getValue()),
                tags
            }).then(success => {
                if (success) {
                    showToast('Document saved successfully!');
                    closeModal(ui.saveModal);
                    ui.sidebar.classList.add('active');
                } else {
                    showError('Failed to save document');
                }
            });
        });
    }

    if (ui.cancelSaveBtn) {
        ui.cancelSaveBtn.addEventListener('click', () => closeModal(ui.saveModal));
    }

    if (ui.closeSaveModal) {
        ui.closeSaveModal.addEventListener('click', () => closeModal(ui.saveModal));
    }

    if (ui.toggleOptionsSidebarBtn) {
        ui.toggleOptionsSidebarBtn.addEventListener('click', () => {
            ui.optionsSidebar.classList.toggle('active');
        });
    }

    if (ui.closeOptionsSidebarBtn) {
        ui.closeOptionsSidebarBtn.addEventListener('click', () => {
            ui.optionsSidebar.classList.remove('active');
        });
    }

    if (ui.createThemeBtn) {
        ui.createThemeBtn.addEventListener('click', () => {
            ui.themeName.value = '';
            document.getElementById('theme-background').value = '#1e1e1e';
            document.getElementById('theme-text').value = '#d4d4d4';
            document.getElementById('theme-string').value = '#ce9178';
            document.getElementById('theme-number').value = '#b5cea8';
            document.getElementById('theme-property').value = '#9cdcfe';
            document.getElementById('theme-boolean').value = '#569cd6';
            updateThemePreview();
            ui.themeEditorModal.classList.add('active');
        });
    }

    document.querySelectorAll('.theme-editor__colors input[type="color"]').forEach(picker => {
        picker.addEventListener('input', updateThemePreview);
    });

    if (ui.saveThemeBtn) {
        ui.saveThemeBtn.addEventListener('click', () => {
            if (!ui.themeName.value.trim()) {
                showError('Please enter a name for your theme');
                return;
            }

            saveCustomTheme({
                name: ui.themeName.value,
                isDefault: false,
                colors: {
                    background: document.getElementById('theme-background').value,
                    text: document.getElementById('theme-text').value,
                    string: document.getElementById('theme-string').value,
                    number: document.getElementById('theme-number').value,
                    property: document.getElementById('theme-property').value,
                    boolean: document.getElementById('theme-boolean').value
                }
            }).then(success => {
                if (success) {
                    showToast('Theme saved successfully!');
                    closeModal(ui.themeEditorModal);
                } else {
                    showError('Failed to save theme');
                }
            });
        });
    }

    if (ui.cancelThemeBtn) {
        ui.cancelThemeBtn.addEventListener('click', () => closeModal(ui.themeEditorModal));
    }

    if (ui.closeThemeEditor) {
        ui.closeThemeEditor.addEventListener('click', () => closeModal(ui.themeEditorModal));
    }

    if (ui.viewModeSelect) {
        ui.viewModeSelect.addEventListener('change', () => {
            if (!currentJson) return;
            currentViewMode = ui.viewModeSelect.value;
            if (currentViewMode === 'tree') {
                convertToTreeView();
            } else {
                jsonEditor.setValue(JSON.stringify(currentJson, null, getIndent()));
            }
        });
    }

    if (ui.toggleFoldAllBtn) {
        let isFolded = false;
        ui.toggleFoldAllBtn.addEventListener('click', () => {
            if (!currentJson) return;
            const actionId = isFolded ? 'editor.unfoldAll' : 'editor.foldAll';
            const action = jsonEditor.getAction(actionId);
            if (action) {
                action.run();
                isFolded = !isFolded;
                ui.toggleFoldAllBtn.innerHTML = isFolded
                    ? '<i class="fas fa-compress-alt"></i> Collapse All'
                    : '<i class="fas fa-expand-alt"></i> Expand All';
                showToast(isFolded ? 'Collapsed all nodes' : 'Expanded all nodes');
            }
        });
    }

    if (ui.sortJsonBtn) {
        ui.sortJsonBtn.addEventListener('click', () => {
            if (!currentJson) return;
            try {
                currentJson = sortJsonObject(currentJson);
                jsonEditor.setValue(JSON.stringify(currentJson, null, getIndent()));
                showToast('JSON sorted successfully');
                if (currentViewMode === 'tree') convertToTreeView();
            } catch (error) {
                showError(`Error sorting JSON: ${error.message}`);
            }
        });
    }

    if (ui.toggleSidebarBtn) {
        ui.toggleSidebarBtn.addEventListener('click', () => ui.sidebar.classList.toggle('active'));
    }

    if (ui.closeSidebarBtn) {
        ui.closeSidebarBtn.addEventListener('click', () => ui.sidebar.classList.remove('active'));
    }

    if (ui.variableNameInput) {
        const sizeInput = () => { ui.variableNameInput.style.width = (ui.variableNameInput.value.length + 1) + 'ch'; };
        ui.variableNameInput.addEventListener('input', () => {
            sizeInput();
            updateBreadcrumbs(currentPath);
        });
        sizeInput();
    }

    if (ui.openDevToolsBtn) {
        ui.openDevToolsBtn.addEventListener('click', () => {
            if (window.electron && window.electron.openDevTools) {
                window.electron.openDevTools();
            }
        });
    }

    if (ui.copyJsSnippetBtn) {
        ui.copyJsSnippetBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(buildJsSnippet())
                .then(() => showToast('JS function copied — paste into your site'))
                .catch(err => showError('Failed to copy: ' + err));
        });
    }

    if (ui.copyHublSnippetBtn) {
        ui.copyHublSnippetBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(buildHublSnippet())
                .then(() => showToast('HubL macro copied — paste into your HubSpot module'))
                .catch(err => showError('Failed to copy: ' + err));
        });
    }
}

// --- Integration snippets ---

function buildJsSnippet() {
    return `// Pretty Jayce On — paste this into your site, then call jayceon('myVar', myData)
function jayceon(varName, data) {
  const json = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const qs = 'var_name=' + encodeURIComponent(varName);
  if (json.length < 1500) {
    window.location.href = 'json-prettifier://send?' + qs + '&data=' + encodeURIComponent(json);
  } else {
    navigator.clipboard.writeText(json).then(() => {
      window.location.href = 'json-prettifier://send?' + qs + '&source=clipboard';
    });
  }
}`;
}

function buildHublSnippet() {
    return `{# Pretty Jayce On — paste into a HubSpot module, then call {{ jayceon('myVar', myData) }} #}
{% macro jayceon(var_name, data) %}
  {% set _json = data|tojson %}
  <button
    type="button"
    style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border:1px solid #2563eb;background:#2563eb;color:#fff;border-radius:6px;font:500 13px/1.2 system-ui,sans-serif;cursor:pointer;"
    onclick='(function(j,v){if(j.length<1500){location.href="json-prettifier://send?var_name="+encodeURIComponent(v)+"&data="+encodeURIComponent(j);}else{navigator.clipboard.writeText(j).then(function(){location.href="json-prettifier://send?var_name="+encodeURIComponent(v)+"&source=clipboard";});}})({{ _json|tojson }}, {{ var_name|tojson }})'
  >Open in Pretty Jayce On</button>
{% endmacro %}`;
}

// --- Entry point ---

document.addEventListener('DOMContentLoaded', () => {
    ui = {
        editorContainer: document.querySelector('.editor__container'),
        prettifyBtn: document.getElementById('prettify'),
        clearBtn: document.getElementById('clear'),
        copyBtn: document.getElementById('copy'),
        indentationSelect: document.getElementById('indentation'),
        themeToggle: document.getElementById('theme-toggle'),
        errorMessage: document.getElementById('error-message'),
        statusText: document.getElementById('status-text'),
        toggleFoldAllBtn: document.getElementById('toggle-fold-all'),
        sortJsonBtn: document.getElementById('sort-json'),
        viewModeSelect: document.getElementById('view-mode'),
        sidebar: document.getElementById('sidebar'),
        optionsSidebar: document.getElementById('options-sidebar'),
        documentsList: document.getElementById('documents-list'),
        customThemesList: document.getElementById('custom-themes-list'),
        toggleSidebarBtn: document.getElementById('toggle-sidebar'),
        closeSidebarBtn: document.getElementById('close-sidebar'),
        toggleOptionsSidebarBtn: document.getElementById('toggle-options-sidebar'),
        closeOptionsSidebarBtn: document.getElementById('close-options-sidebar'),
        unescapeStringsBtn: document.getElementById('unescape-strings'),
        saveDocumentBtn: document.getElementById('save-document'),
        saveModal: document.getElementById('save-modal'),
        documentTitle: document.getElementById('document-title'),
        documentTags: document.getElementById('document-tags'),
        confirmSaveBtn: document.getElementById('confirm-save'),
        cancelSaveBtn: document.getElementById('cancel-save'),
        closeSaveModal: document.getElementById('close-save-modal'),
        createThemeBtn: document.getElementById('create-theme-btn'),
        openDevToolsBtn: document.getElementById('open-devtools-btn'),
        themeEditorModal: document.getElementById('theme-editor-modal'),
        themeName: document.getElementById('theme-name'),
        saveThemeBtn: document.getElementById('save-theme'),
        cancelThemeBtn: document.getElementById('cancel-theme'),
        closeThemeEditor: document.getElementById('close-theme-editor'),
        pathCopyHeaderBtn: document.getElementById('path-copy-header'),
        breadcrumbDisplayHeader: document.getElementById('breadcrumb-display-header'),
        toast: document.getElementById('toast'),
        toastMessage: document.getElementById('toast-message'),
        variableNameInput: document.getElementById('variable-name'),
        arrayAccessors: document.getElementById('array-accessors'),
        arrayPanel: document.querySelector('.header__array-panel'),
        copyJsSnippetBtn: document.getElementById('copy-js-snippet'),
        copyHublSnippetBtn: document.getElementById('copy-hubl-snippet'),
    };

    require.config({ paths: { 'vs': './node_modules/monaco-editor/min/vs' } });

    require(['vs/editor/editor.main'], function () {
        initializeEditors();
        loadUserPreferences();
        loadCustomThemes();
        loadSavedDocuments();
        setupEventListeners();
        setupResizeObserver();
    });
});
