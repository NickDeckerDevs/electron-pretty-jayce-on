// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
  // Debug logging for UI elements
  console.log('DOM fully loaded');
  
  // Log all important UI elements to verify they exist
  console.log('Header elements:', {
    expandAll: document.getElementById('expand-all'),
    collapseAll: document.getElementById('collapse-all'),
    sortJson: document.getElementById('sort-json'),
    breadcrumbHeader: document.getElementById('breadcrumb-display-header'),
    pathCopyHeader: document.getElementById('path-copy-header'),
    headerContainer: document.querySelector('.header-container'),
    breadcrumbContainer: document.querySelector('.breadcrumb-container')
  });
  
  // Check if styles are applied
  const headerStyles = window.getComputedStyle(document.querySelector('header'));
  console.log('Header styles:', {
    display: headerStyles.display,
    flexDirection: headerStyles.flexDirection,
    width: headerStyles.width
  });
  
  // Session management
  let sessionId = localStorage.getItem('sessionId');
  if (!sessionId) {
    // Generate a random session ID if none exists
    sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('sessionId', sessionId);
  }
  
  // API headers
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': sessionId
  };
  
  // State variables for documents and themes
  let savedDocuments = [];
  let customThemes = [];
  let currentDocumentId = null;
  let userPreferences = null;
  // Elements
  const prettifyBtn = document.getElementById('prettify');
  const clearBtn = document.getElementById('clear');
  const copyBtn = document.getElementById('copy');
  const indentationSelect = document.getElementById('indentation');
  const themeToggle = document.getElementById('theme-toggle');
  const errorMessage = document.getElementById('error-message');
  const pathDisplay = document.getElementById('path-display');
  const statusText = document.getElementById('status-text');
  
  // Additional debugging - log the buttons we're looking for
  const expandAllBtn = document.getElementById('expand-all');
  const collapseAllBtn = document.getElementById('collapse-all');
  const sortJsonBtn = document.getElementById('sort-json');
  const viewModeSelect = document.getElementById('view-mode');
  
  console.log('Button debug:', {
    expandAllExists: expandAllBtn !== null,
    collapseAllExists: collapseAllBtn !== null,
    sortJsonExists: sortJsonBtn !== null,
    viewModeExists: viewModeSelect !== null
  });

  if (expandAllBtn) console.log('Expand All button found:', expandAllBtn.outerHTML);
  if (collapseAllBtn) console.log('Collapse All button found:', collapseAllBtn.outerHTML);
  if (sortJsonBtn) console.log('Sort JSON button found:', sortJsonBtn.outerHTML);
  
  // Global variables
  let jsonEditor;
  let isDarkTheme = false;
  let currentJson = null;
  let currentViewMode = 'formatted';
  
  // Initialize Monaco Editor
  require.config({
    paths: {
      'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.33.0/min/vs'
    }
  });

  require(['vs/editor/editor.main'], function() {
    initializeEditors();
    loadUserPreferences();
    loadCustomThemes();
    loadSavedDocuments();
    setupEventListeners();
    setupResizeObserver();
  });
  
  // API Functions
  async function loadUserPreferences() {
    try {
      const response = await fetch('/api/preferences', {
        method: 'GET',
        headers
      });
      
      const data = await response.json();
      if (data.success && data.preferences) {
        userPreferences = data.preferences;
        
        // Apply preferences
        if (userPreferences.theme === 'dark') {
          isDarkTheme = true;
          themeToggle.checked = true;
          document.body.classList.add('dark-theme');
          if (jsonEditor) {
            monaco.editor.setTheme('vs-dark');
          }
        }
        
        if (userPreferences.indentation) {
          const indent = userPreferences.indentation === -1 ? 'tab' : userPreferences.indentation.toString();
          indentationSelect.value = indent;
        }
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  }
  
  async function saveUserPreferences(preferences) {
    try {
      const response = await fetch('/api/preferences', {
        method: 'POST',
        headers,
        body: JSON.stringify(preferences)
      });
      
      const data = await response.json();
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
      const response = await fetch('/api/themes', {
        method: 'GET',
        headers
      });
      
      const data = await response.json();
      if (data.success) {
        customThemes = data.themes || [];
        updateCustomThemesList();
      }
    } catch (error) {
      console.error('Error loading themes:', error);
    }
  }
  
  async function saveCustomTheme(theme) {
    try {
      const response = await fetch('/api/themes', {
        method: 'POST',
        headers,
        body: JSON.stringify(theme)
      });
      
      const data = await response.json();
      if (data.success) {
        // Add new theme to list or replace existing one
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
      const response = await fetch(`/api/themes/${themeId}`, {
        method: 'DELETE',
        headers
      });
      
      const data = await response.json();
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
      const response = await fetch('/api/documents', {
        method: 'GET',
        headers
      });
      
      const data = await response.json();
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
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'GET',
        headers
      });
      
      const data = await response.json();
      if (data.success && data.document) {
        currentDocumentId = data.document.id;
        currentJson = data.document.content;
        
        // Update the editor with the document content
        const indent = indentationSelect.value === 'tab' ? '\t' : Number(indentationSelect.value);
        const formatted = JSON.stringify(currentJson, null, indent);
        jsonEditor.setValue(formatted);
        
        // Update status
        statusText.textContent = `Loaded: ${data.document.title}`;
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
      // If we're updating an existing document
      if (currentDocumentId) {
        document.id = currentDocumentId;
      }
      
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers,
        body: JSON.stringify(document)
      });
      
      const data = await response.json();
      if (data.success && data.document) {
        currentDocumentId = data.document.id;
        
        // Update documents list
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
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
        headers
      });
      
      const data = await response.json();
      if (data.success) {
        savedDocuments = savedDocuments.filter(doc => doc.id !== documentId);
        
        if (currentDocumentId === documentId) {
          currentDocumentId = null;
          jsonEditor.setValue('');
          statusText.textContent = 'Ready';
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

  function initializeEditors() {
    // Create JSON editor with Monaco
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

    // Update status when content changes
    jsonEditor.onDidChangeModelContent(() => {
      statusText.textContent = 'Editing';
      errorMessage.textContent = '';
    });

    // Set placeholder text
    jsonEditor.setValue('// Paste your JSON here and click "Prettify"');
  }

  // UI Helper Functions
  function updateDocumentsList() {
    const documentsList = document.getElementById('documents-list');
    if (!documentsList) return;

    // Clear the list
    documentsList.innerHTML = '';

    if (savedDocuments.length === 0) {
      documentsList.innerHTML = '<div class="empty-state">No saved documents</div>';
      return;
    }

    // Sort documents by updated date descending
    const sortedDocs = [...savedDocuments].sort((a, b) => {
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    // Add each document to the list
    sortedDocs.forEach(doc => {
      const docItem = document.createElement('div');
      docItem.className = 'document-item';
      docItem.dataset.id = doc.id;

      // Create document title
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = doc.title;

      // Create tags container if tags exist
      let tagsContainer = '';
      if (doc.tags && doc.tags.length) {
        tagsContainer = '<div class="tags">';
        doc.tags.forEach(tag => {
          tagsContainer += `<span class="tag">${tag}</span>`;
        });
        tagsContainer += '</div>';
      }

      // Create actions container
      const actions = document.createElement('div');
      actions.className = 'actions';
      actions.innerHTML = `
        <button class="icon-btn delete-doc" title="Delete"><i class="fas fa-trash"></i></button>
      `;

      // Add content to document item
      docItem.innerHTML = `
        <div class="title">${doc.title}</div>
        ${tagsContainer || ''}
        <div class="updated-at">Last updated: ${new Date(doc.updatedAt).toLocaleString()}</div>
      `;

      // Add click event to load document
      docItem.addEventListener('click', (e) => {
        // Ignore if clicked on delete button
        if (e.target.closest('.delete-doc')) return;
        loadDocument(doc.id);
        document.getElementById('sidebar').classList.remove('active');
      });

      // Add delete button event
      const deleteBtn = docItem.querySelector('.delete-doc');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`Delete document "${doc.title}"?`)) {
            deleteDocument(doc.id);
          }
        });
      }

      documentsList.appendChild(docItem);
    });
  }

  function updateCustomThemesList() {
    const themesList = document.getElementById('custom-themes-list');
    if (!themesList) return;

    // Clear the list
    themesList.innerHTML = '';

    if (customThemes.length === 0) {
      themesList.innerHTML = '<div class="empty-state">No custom themes</div>';
      return;
    }

    // Add each theme to the list
    customThemes.forEach(theme => {
      const themeItem = document.createElement('div');
      themeItem.className = 'theme-item';
      themeItem.dataset.id = theme.id;

      // Create color preview
      const colorPreview = document.createElement('span');
      colorPreview.className = 'theme-color-preview';
      colorPreview.style.backgroundColor = theme.colors.background || '#333';

      // Create theme name
      const themeName = document.createElement('span');
      themeName.className = 'theme-name';
      themeName.textContent = theme.name;

      // Add delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'icon-btn delete-theme';
      deleteBtn.title = 'Delete';
      deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';

      // Add click event to apply theme
      themeItem.addEventListener('click', (e) => {
        // Ignore if clicked on delete button
        if (e.target.closest('.delete-theme')) return;
        applyCustomTheme(theme);
      });

      // Add delete button event
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete theme "${theme.name}"?`)) {
          deleteCustomTheme(theme.id);
        }
      });

      themeItem.appendChild(colorPreview);
      themeItem.appendChild(themeName);
      themeItem.appendChild(deleteBtn);

      themesList.appendChild(themeItem);
    });
  }

  function applyCustomTheme(theme) {
    // Apply theme to Monaco editor
    // This is a simplified implementation
    const colors = theme.colors;

    // Define a custom theme for Monaco
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

    // Apply the theme
    monaco.editor.setTheme(theme.name);
    showToast(`Applied theme: ${theme.name}`);
  }

  function updateThemePreview() {
    const preview = document.getElementById('theme-preview-code');
    if (!preview) return;

    const backgroundColor = document.getElementById('theme-background').value;
    const textColor = document.getElementById('theme-text').value;
    const stringColor = document.getElementById('theme-string').value;
    const numberColor = document.getElementById('theme-number').value;
    const propertyColor = document.getElementById('theme-property').value;
    const booleanColor = document.getElementById('theme-boolean').value;

    // Apply colors to preview
    preview.style.backgroundColor = backgroundColor;
    preview.style.color = textColor;

    // Create a styled preview
    preview.innerHTML = `{
  <span style="color:${propertyColor}">"name"</span>: <span style="color:${stringColor}">"Sample Object"</span>,
  <span style="color:${propertyColor}">"active"</span>: <span style="color:${booleanColor}">true</span>,
  <span style="color:${propertyColor}">"count"</span>: <span style="color:${numberColor}">42</span>,
  <span style="color:${propertyColor}">"items"</span>: [<span style="color:${stringColor}">"string"</span>, <span style="color:${booleanColor}">null</span>, <span style="color:${booleanColor}">false</span>]
}`;
  }
  
  function setupEventListeners() {
    // Get references to UI elements
    const viewModeSelect = document.getElementById('view-mode');
    const expandAllBtn = document.getElementById('expand-all');
    const collapseAllBtn = document.getElementById('collapse-all');
    const sortJsonBtn = document.getElementById('sort-json');
    let currentViewMode = 'formatted';
    
    // Existing event listeners
    prettifyBtn.addEventListener('click', () => {
      const rawJson = jsonEditor.getValue();
      
      if (!rawJson || rawJson.trim() === '' || rawJson.includes('// Paste your JSON here')) {
        showError('Please enter some JSON content');
        return;
      }
      
      try {
        let parsed;
        
        // First try standard JSON parsing
        try {
          parsed = JSON.parse(rawJson);
          console.log('Successfully parsed as JSON');
        } catch (jsonError) {
          console.log('Standard JSON parsing failed, trying JavaScript object parsing');
          try {
            // Try to evaluate as JavaScript object notation
            // Use Function constructor to safely evaluate JavaScript object
            // This allows for unquoted keys and single quotes
            parsed = Function('return ' + rawJson)();
            console.log('Successfully parsed as JavaScript object');
          } catch (jsError) {
            console.log('JavaScript object parsing failed, trying to fix common issues');
            // If both attempts fail, try to fix common issues and retry
            let fixedInput = rawJson
              // Replace single quotes with double quotes
              .replace(/'/g, '"')
              // Add quotes to unquoted keys
              .replace(/([{,])\s*(\w+)\s*:/g, '$1"$2":')
              // Handle trailing commas
              .replace(/,\s*([\]}])/g, '$1');
              
            try {
              parsed = JSON.parse(fixedInput);
              console.log('Successfully parsed after automatic fixing');
              showToast('Fixed and formatted JavaScript object notation', false, 3000);
            } catch (finalError) {
              throw new Error('Could not parse input as JSON or JavaScript object: ' + jsonError.message);
            }
          }
        }
        
        currentJson = parsed;
        
        // Pretty print with selected indentation
        const indent = indentationSelect.value === 'tab' ? '\t' : Number(indentationSelect.value);
        const formatted = JSON.stringify(parsed, null, indent);
        
        // Update the editor with formatted JSON
        jsonEditor.setValue(formatted);
        
        // Update status
        statusText.textContent = 'JSON formatted successfully';
        errorMessage.textContent = '';
        
        // Show success toast
        showToast('JSON formatted successfully!');
        
        // Update view mode if needed
        if (currentViewMode === 'tree') {
          convertToTreeView();
        }
      } catch (error) {
        // Show error message
        showError(`Parsing error: ${error.message}`);
        statusText.textContent = 'Error';
      }
    });

    // Clear button click handler
    clearBtn.addEventListener('click', () => {
      jsonEditor.setValue('');
      errorMessage.textContent = '';
      statusText.textContent = 'Ready';
      currentJson = null;
      currentDocumentId = null;
      pathDisplay.textContent = '';
    });

    // Copy button click handler
    copyBtn.addEventListener('click', () => {
      const content = jsonEditor.getValue();
      
      // Use browser clipboard API
      navigator.clipboard.writeText(content)
        .then(() => showToast('Copied to clipboard!'))
        .catch(err => showError('Failed to copy: ' + err));
    });

    // Theme toggle handler
    themeToggle.addEventListener('change', (e) => {
      isDarkTheme = e.target.checked;
      document.body.classList.toggle('dark-theme', isDarkTheme);
      monaco.editor.setTheme(isDarkTheme ? 'vs-dark' : 'vs');
      
      // Save theme preference
      saveUserPreferences({
        theme: isDarkTheme ? 'dark' : 'light',
        indentation: indentationSelect.value === 'tab' ? -1 : Number(indentationSelect.value),
        useSpaces: indentationSelect.value !== 'tab'
      });
    });

    // Indentation change handler
    indentationSelect.addEventListener('change', () => {
      if (currentJson) {
        const indent = indentationSelect.value === 'tab' ? '\t' : Number(indentationSelect.value);
        const formatted = JSON.stringify(currentJson, null, indent);
        jsonEditor.setValue(formatted);
      }
      
      // Save indentation preference
      saveUserPreferences({
        theme: isDarkTheme ? 'dark' : 'light',
        indentation: indentationSelect.value === 'tab' ? -1 : Number(indentationSelect.value),
        useSpaces: indentationSelect.value !== 'tab'
      });
    });

    // Cursor position handler to show JSON path
    jsonEditor.onDidChangeCursorPosition((e) => {
      if (currentJson) {
        const position = e.position;
        const path = getJsonPathAtPosition(jsonEditor.getValue(), position);
        pathDisplay.textContent = path ? path : '';
        updateBreadcrumbs(path);
      }
    });
    
    // Path copy button handlers (both in status bar and header)
    const setupPathCopyButton = (buttonId) => {
      const pathCopyBtn = document.getElementById(buttonId);
      if (pathCopyBtn) {
        pathCopyBtn.addEventListener('click', () => {
          const path = pathCopyBtn.dataset.path;
          if (path) {
            const accessCode = generateAccessCode(path);
            navigator.clipboard.writeText(accessCode)
              .then(() => showToast(`Copied to clipboard: ${accessCode}`))
              .catch(err => showError('Failed to copy path: ' + err));
          }
        });
      }
    };
    
    // Setup both copy buttons
    setupPathCopyButton('path-copy');
    setupPathCopyButton('path-copy-header');
    
    // Unescape Strings button handler
    const unescapeStringsBtn = document.getElementById('unescape-strings');
    if (unescapeStringsBtn) {
      unescapeStringsBtn.addEventListener('click', () => {
        if (!currentJson) return;
        
        try {
          // Create a deep copy of the current JSON
          const tempJson = JSON.parse(JSON.stringify(currentJson));
          
          // Function to recursively process objects and arrays
          function processNestedStrings(obj) {
            if (!obj || typeof obj !== 'object') return obj;
            
            // Process each property
            Object.keys(obj).forEach(key => {
              const value = obj[key];
              
              // Check if value is a potentially JSON string (starts and ends with brackets or braces)
              if (typeof value === 'string' && 
                  ((value.startsWith('[') && value.endsWith(']')) || 
                   (value.startsWith('{') && value.endsWith('}'))))
              {
                try {
                  // Try to parse it as JSON
                  const parsed = JSON.parse(value);
                  // If successful, replace the string with the parsed object
                  obj[key] = parsed;
                  console.log(`Unescaped JSON string in property: ${key}`);
                } catch (e) {
                  // Not valid JSON, leave as-is
                  console.log(`Could not parse property ${key} as JSON: ${e.message}`);
                }
              }
              // Recursively process nested objects and arrays
              else if (typeof value === 'object' && value !== null) {
                processNestedStrings(value);
              }
            });
            
            return obj;
          }
          
          // Process the entire JSON structure
          const processedJson = processNestedStrings(tempJson);
          currentJson = processedJson;
          
          // Format with selected indentation
          const indent = indentationSelect.value === 'tab' ? '\t' : Number(indentationSelect.value);
          const formatted = JSON.stringify(processedJson, null, indent);
          
          // Update the editor with processed JSON
          jsonEditor.setValue(formatted);
          
          // Update view mode if needed
          if (currentViewMode === 'tree') {
            convertToTreeView();
          }
          
          showToast('Strings unescaped successfully');
        } catch (error) {
          showError(`Error while unescaping strings: ${error.message}`);
        }
      });
    }
    
    // New event listeners for the additional features
    
    // Save document button
    const saveDocumentBtn = document.getElementById('save-document');
    if (saveDocumentBtn) {
      saveDocumentBtn.addEventListener('click', () => {
        const rawJson = jsonEditor.getValue();
        
        // For saving, use the same parsing logic we use for the prettify button
        try {
          let parsed;
          
          // First try standard JSON parsing
          try {
            parsed = JSON.parse(rawJson);
          } catch (jsonError) {
            // If JSON parsing fails, try to handle JavaScript object notation
            try {
              parsed = Function('return ' + rawJson)();
            } catch (jsError) {
              // If both attempts fail, try to fix common issues and retry
              let fixedInput = rawJson
                // Replace single quotes with double quotes
                .replace(/'/g, '"')
                // Add quotes to unquoted keys
                .replace(/([{,])\s*(\w+)\s*:/g, '$1"$2":')
                // Handle trailing commas
                .replace(/,\s*([\]}])/g, '$1');
                
              try {
                parsed = JSON.parse(fixedInput);
                // First convert to proper JSON format to ensure we'll be able to save it
                rawJson = JSON.stringify(parsed);
                jsonEditor.setValue(rawJson);
                showToast('Converted to standard JSON format', false, 3000);
              } catch (finalError) {
                throw new Error('Could not parse input as JSON or JavaScript object');
              }
            }
          }
          
          // Show save modal
          const saveModal = document.getElementById('save-modal');
          const documentTitleInput = document.getElementById('document-title');
          const documentTagsInput = document.getElementById('document-tags');
          
          // Pre-fill existing document details if editing
          if (currentDocumentId) {
            const currentDoc = savedDocuments.find(doc => doc.id === currentDocumentId);
            if (currentDoc) {
              documentTitleInput.value = currentDoc.title;
              documentTagsInput.value = currentDoc.tags ? currentDoc.tags.join(', ') : '';
            }
          } else {
            documentTitleInput.value = '';
            documentTagsInput.value = '';
          }
          
          saveModal.classList.add('active');
        } catch (error) {
          showError(`Cannot save: ${error.message}`);
        }
      });
    }
    
    // Save confirmation in save modal
    const confirmSaveBtn = document.getElementById('confirm-save');
    if (confirmSaveBtn) {
      confirmSaveBtn.addEventListener('click', () => {
        const documentTitleInput = document.getElementById('document-title');
        const documentTagsInput = document.getElementById('document-tags');
        
        if (!documentTitleInput.value.trim()) {
          showError('Please enter a title for your document');
          return;
        }
        
        // Process tags from comma-separated string
        const tags = documentTagsInput.value
          .split(',')
          .map(tag => tag.trim())
          .filter(tag => tag);
        
        const documentToSave = {
          title: documentTitleInput.value,
          content: JSON.parse(jsonEditor.getValue()),
          tags
        };
        
        saveDocument(documentToSave).then(success => {
          if (success) {
            showToast('Document saved successfully!');
            document.getElementById('save-modal').classList.remove('active');
          } else {
            showError('Failed to save document');
          }
        });
      });
    }
    
    // Cancel save button
    const cancelSaveBtn = document.getElementById('cancel-save');
    if (cancelSaveBtn) {
      cancelSaveBtn.addEventListener('click', () => {
        document.getElementById('save-modal').classList.remove('active');
      });
    }
    
    // Close save modal button
    const closeSaveModalBtn = document.getElementById('close-save-modal');
    if (closeSaveModalBtn) {
      closeSaveModalBtn.addEventListener('click', () => {
        document.getElementById('save-modal').classList.remove('active');
      });
    }
    
    // Settings button
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        // Populate settings form with current values
        document.getElementById('default-indentation').value = indentationSelect.value;
        document.getElementById('default-theme').value = isDarkTheme ? 'dark' : 'light';
        
        // Show settings modal
        document.getElementById('settings-modal').classList.add('active');
      });
    }
    
    // Save settings button
    const saveSettingsBtn = document.getElementById('save-settings');
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', () => {
        const defaultIndentation = document.getElementById('default-indentation').value;
        const defaultTheme = document.getElementById('default-theme').value;
        
        // Apply settings
        indentationSelect.value = defaultIndentation;
        if ((defaultTheme === 'dark' && !isDarkTheme) || (defaultTheme === 'light' && isDarkTheme)) {
          themeToggle.checked = defaultTheme === 'dark';
          themeToggle.dispatchEvent(new Event('change'));
        }
        
        // Save settings to server
        saveUserPreferences({
          theme: defaultTheme,
          indentation: defaultIndentation === 'tab' ? -1 : Number(defaultIndentation),
          useSpaces: defaultIndentation !== 'tab'
        }).then(success => {
          if (success) {
            showToast('Settings saved successfully!');
            document.getElementById('settings-modal').classList.remove('active');
          } else {
            showError('Failed to save settings');
          }
        });
      });
    }
    
    // Close settings modal button
    const closeSettingsModalBtn = document.getElementById('close-settings-modal');
    if (closeSettingsModalBtn) {
      closeSettingsModalBtn.addEventListener('click', () => {
        document.getElementById('settings-modal').classList.remove('active');
      });
    }
    
    // Create theme button
    const createThemeBtn = document.getElementById('create-theme-btn');
    if (createThemeBtn) {
      createThemeBtn.addEventListener('click', () => {
        // Reset theme editor form
        document.getElementById('theme-name').value = '';
        document.getElementById('theme-background').value = '#1e1e1e';
        document.getElementById('theme-text').value = '#d4d4d4';
        document.getElementById('theme-string').value = '#ce9178';
        document.getElementById('theme-number').value = '#b5cea8';
        document.getElementById('theme-property').value = '#9cdcfe';
        document.getElementById('theme-boolean').value = '#569cd6';
        
        // Update preview
        updateThemePreview();
        
        // Show theme editor modal
        document.getElementById('theme-editor-modal').classList.add('active');
      });
    }
    
    // Color picker change event for theme preview
    const colorPickers = document.querySelectorAll('.theme-colors input[type="color"]');
    colorPickers.forEach(picker => {
      picker.addEventListener('input', updateThemePreview);
    });
    
    // Save theme button
    const saveThemeBtn = document.getElementById('save-theme');
    if (saveThemeBtn) {
      saveThemeBtn.addEventListener('click', () => {
        const themeName = document.getElementById('theme-name').value;
        
        if (!themeName.trim()) {
          showError('Please enter a name for your theme');
          return;
        }
        
        const themeToSave = {
          name: themeName,
          isDefault: false,
          colors: {
            background: document.getElementById('theme-background').value,
            text: document.getElementById('theme-text').value,
            string: document.getElementById('theme-string').value,
            number: document.getElementById('theme-number').value,
            property: document.getElementById('theme-property').value,
            boolean: document.getElementById('theme-boolean').value
          }
        };
        
        saveCustomTheme(themeToSave).then(success => {
          if (success) {
            showToast('Theme saved successfully!');
            document.getElementById('theme-editor-modal').classList.remove('active');
          } else {
            showError('Failed to save theme');
          }
        });
      });
    }
    
    // Cancel theme button
    const cancelThemeBtn = document.getElementById('cancel-theme');
    if (cancelThemeBtn) {
      cancelThemeBtn.addEventListener('click', () => {
        document.getElementById('theme-editor-modal').classList.remove('active');
      });
    }
    
    // Close theme editor button
    const closeThemeEditorBtn = document.getElementById('close-theme-editor');
    if (closeThemeEditorBtn) {
      closeThemeEditorBtn.addEventListener('click', () => {
        document.getElementById('theme-editor-modal').classList.remove('active');
      });
    }
    
    // View mode toggle (formatted vs tree view)
    if (viewModeSelect) {
      viewModeSelect.addEventListener('change', () => {
        if (!currentJson) {
          return;
        }

        currentViewMode = viewModeSelect.value;

        if (currentViewMode === 'tree') {
          // For tree view, we'll create a specialized tree view
          convertToTreeView();
        } else {
          // For formatted view, restore the standard JSON
          const indent = indentationSelect.value === 'tab' ? '\t' : Number(indentationSelect.value);
          const formatted = JSON.stringify(currentJson, null, indent);
          jsonEditor.setValue(formatted);
        }
      });
    }

    // Expand all button handler
    if (expandAllBtn) {
      expandAllBtn.addEventListener('click', () => {
        if (!currentJson) return;
        if (currentViewMode === 'tree') {
          // Use Monaco editor's fold actions API to unfold all
          const editorActions = jsonEditor.getAction('editor.unfoldAll');
          if (editorActions) {
            editorActions.run();
            showToast('Expanded all nodes');
          }
        }
      });
    }

    // Collapse all button handler
    if (collapseAllBtn) {
      collapseAllBtn.addEventListener('click', () => {
        if (!currentJson) return;
        if (currentViewMode === 'tree') {
          // Use Monaco editor's fold actions API to fold all
          const editorActions = jsonEditor.getAction('editor.foldAll');
          if (editorActions) {
            editorActions.run();
            showToast('Collapsed all nodes');
          }
        }
      });
    }

    // Sort JSON button handler
    if (sortJsonBtn) {
      sortJsonBtn.addEventListener('click', () => {
        if (!currentJson) return;
        
        try {
          // Sort the JSON object recursively
          const sortedJson = sortJsonObject(currentJson);
          currentJson = sortedJson;
          
          // Update the editor with sorted JSON
          const indent = indentationSelect.value === 'tab' ? '\t' : Number(indentationSelect.value);
          const formatted = JSON.stringify(sortedJson, null, indent);
          jsonEditor.setValue(formatted);
          
          showToast('JSON sorted successfully');
          
          // Update view mode if needed
          if (currentViewMode === 'tree') {
            convertToTreeView();
          }
        } catch (error) {
          showError(`Error sorting JSON: ${error.message}`);
        }
      });
    }
    
    // Sidebar toggle - document button should toggle sidebar
    const saveBtn = document.getElementById('save-document');
    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        // Show sidebar when right-clicking or Alt+clicking the save button
        if (e.altKey || e.button === 2) {
          e.preventDefault();
          document.getElementById('sidebar').classList.toggle('active');
          return false;
        }
      });
    }
    
    // Close sidebar button
    const closeSidebarBtn = document.getElementById('close-sidebar');
    if (closeSidebarBtn) {
      closeSidebarBtn.addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('active');
      });
    }
  }

  // Function to handle window resize
  function setupResizeObserver() {
    const editorContainer = document.querySelector('.editor-container');
    const resizeObserver = new ResizeObserver(() => {
      if (jsonEditor) {
        jsonEditor.layout();
      }
    });
    
    resizeObserver.observe(editorContainer);
  }

  // Helper function to show errors
  function showError(message) {
    errorMessage.textContent = message;
    showToast(message, true);
  }

  // Helper function to show toast notifications
  function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    
    toast.style.backgroundColor = isError ? 'var(--error-color)' : 'var(--success-color)';
    toastMessage.textContent = message;
    
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // Helper function to get JSON path at cursor position
  function getJsonPathAtPosition(jsonString, position) {
    try {
      const lines = jsonString.split('\n');
      let lineIndex = 0;
      let charPos = 0;
      let jsonPath = [];
      let inString = false;
      let currentKey = '';
      let isKey = false;
      let isValue = false;
      let arrayStack = [];
      let objectStack = [];
      
      // Simple parser to track position in JSON
      for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString[i];
        
        // Check if we've passed the cursor position
        if (lineIndex > position.lineNumber - 1 || 
            (lineIndex === position.lineNumber - 1 && charPos >= position.column - 1)) {
            break;
        }
        
        // Update position counters
        if (char === '\n') {
          lineIndex++;
          charPos = 0;
          continue;
        }
        charPos++;
        
        // Handle string literals
        if (char === '"' && (i === 0 || jsonString[i-1] !== '\\')) {
          inString = !inString;
          if (!inString) {
            if (isKey) {
              isKey = false;
              isValue = true;
            }
          }
          continue;
        }
        
        // Skip characters inside strings except for building keys
        if (inString) {
          if (isKey) {
            currentKey += char;
          }
          continue;
        }
        
        // Handle object boundaries
        if (char === '{') {
          objectStack.push(true);
          isKey = true;
          isValue = false;
          currentKey = '';
        } 
        else if (char === '}') {
          objectStack.pop();
          if (jsonPath.length > 0) {
            jsonPath.pop();
          }
          isKey = true;
          isValue = false;
          currentKey = '';
        }
        
        // Handle array boundaries
        else if (char === '[') {
          arrayStack.push(0); // Start array index at 0
          isKey = false;
          isValue = true;
          currentKey = '';
        } 
        else if (char === ']') {
          arrayStack.pop();
          if (jsonPath.length > 0) {
            jsonPath.pop();
          }
          isKey = false;
          isValue = true;
          currentKey = '';
        }
        
        // Handle key-value separator
        else if (char === ':') {
          isKey = false;
          isValue = true;
          jsonPath.push(currentKey);
          currentKey = '';
        }
        
        // Handle item separator
        else if (char === ',') {
          if (arrayStack.length > 0 && objectStack.length === 0) {
            const lastIndex = arrayStack.pop();
            jsonPath.pop(); // Remove last array index
            arrayStack.push(lastIndex + 1); // Increment array index
            jsonPath.push(lastIndex + 1); // Add new array index
          } else {
            isKey = true;
            isValue = false;
            if (jsonPath.length > 0) {
              jsonPath.pop(); // Remove last key as we're moving to the next key
            }
          }
          currentKey = '';
        }
      }
      
      // Format path for display
      return jsonPath.reduce((path, segment, i) => {
        if (typeof segment === 'number') {
          return `${path}[${segment}]`;
        } else {
          return path === '' ? segment : `${path}.${segment}`;
        }
      }, '');
    } catch (e) {
      console.error('Error getting JSON path:', e);
      return '';
    }
  }

  // Helper function to generate breadcrumb elements
  function updateBreadcrumbs(jsonPath) {
    const breadcrumbDisplay = document.getElementById('breadcrumb-display');
    const breadcrumbDisplayHeader = document.getElementById('breadcrumb-display-header');
    if (!breadcrumbDisplay) return;
    
    // Clear both breadcrumb displays
    breadcrumbDisplay.innerHTML = '';
    if (breadcrumbDisplayHeader) {
      breadcrumbDisplayHeader.innerHTML = '';
    }
    
    if (!jsonPath) {
      const emptyMessage = '<div class="empty-breadcrumb">No path selected</div>';
      breadcrumbDisplay.innerHTML = emptyMessage;
      if (breadcrumbDisplayHeader) {
        breadcrumbDisplayHeader.innerHTML = emptyMessage;
      }
      return;
    }
    
    // Split the path into segments
    const segments = [];
    let currentPath = '';
    let tempPath = jsonPath;
    
    // Handle array notation
    while (tempPath.includes('[')) {
      const dotIndex = tempPath.indexOf('.');
      const bracketIndex = tempPath.indexOf('[');
      
      if (dotIndex === -1 || (bracketIndex !== -1 && bracketIndex < dotIndex)) {
        // We have an array notation next
        if (bracketIndex > 0) {
          // There's a property name before the bracket
          const propertyName = tempPath.substring(0, bracketIndex);
          currentPath += (currentPath ? '.' : '') + propertyName;
          segments.push({ 
            text: propertyName, 
            path: currentPath,
            isProperty: true 
          });
          
          tempPath = tempPath.substring(bracketIndex);
        }
        
        // Extract the array index
        const closeBracketIndex = tempPath.indexOf(']');
        if (closeBracketIndex !== -1) {
          const arrayIndex = tempPath.substring(1, closeBracketIndex);
          currentPath += `[${arrayIndex}]`;
          segments.push({ 
            text: `[${arrayIndex}]`, 
            path: currentPath,
            isArray: true 
          });
          
          // Move past the closing bracket
          tempPath = tempPath.substring(closeBracketIndex + 1);
          
          // If the next character is a dot, skip it
          if (tempPath.startsWith('.')) {
            tempPath = tempPath.substring(1);
          }
        } else {
          // Malformed path, just add the rest
          segments.push({ text: tempPath, path: currentPath + tempPath });
          break;
        }
      } else {
        // We have a dot notation next
        const propertyName = tempPath.substring(0, dotIndex);
        currentPath += (currentPath ? '.' : '') + propertyName;
        segments.push({ 
          text: propertyName, 
          path: currentPath,
          isProperty: true 
        });
        
        // Move past the property and dot
        tempPath = tempPath.substring(dotIndex + 1);
      }
    }
    
    // Handle any remaining part (no brackets)
    if (tempPath) {
      currentPath += (currentPath ? '.' : '') + tempPath;
      segments.push({ 
        text: tempPath, 
        path: currentPath,
        isProperty: true 
      });
    }
    
    // Create the breadcrumb elements for both status bar and header
    const createBreadcrumbElements = (container) => {
      segments.forEach((segment, index) => {
        const breadcrumbItem = document.createElement('div');
        breadcrumbItem.className = 'breadcrumb-item';
        breadcrumbItem.dataset.path = segment.path;
        breadcrumbItem.textContent = segment.text;
        
        // Add click event to navigate to that path
        breadcrumbItem.addEventListener('click', () => {
          navigateToJsonPath(segment.path);
        });
        
        container.appendChild(breadcrumbItem);
        
        // Add separator if not the last item
        if (index < segments.length - 1) {
          const separator = document.createElement('span');
          separator.className = 'breadcrumb-separator';
          separator.textContent = '>';
          container.appendChild(separator);
        }
      });
    };
    
    // Create breadcrumbs in the status bar
    createBreadcrumbElements(breadcrumbDisplay);
    
    // Create breadcrumbs in the header if it exists
    if (breadcrumbDisplayHeader) {
      createBreadcrumbElements(breadcrumbDisplayHeader);
    }
    
    // Add copy button event in status bar
    const pathCopyBtn = document.getElementById('path-copy');
    if (pathCopyBtn) {
      pathCopyBtn.dataset.path = jsonPath;
    }
    
    // Add copy button event in header
    const pathCopyBtnHeader = document.getElementById('path-copy-header');
    if (pathCopyBtnHeader) {
      pathCopyBtnHeader.dataset.path = jsonPath;
    }
  }
  
  // Function to navigate to a specific JSON path
  function navigateToJsonPath(path) {
    if (!currentJson || !path) return;
    
    // Generate JavaScript code to access this path
    const accessCode = generateAccessCode(path);
    
    // Show a toast with the access code
    showToast(`Path: ${accessCode}`, false, 5000);
    
    // Future enhancement: Actually navigate to this location in the editor
    // This would require finding the position in the text that corresponds to this path
  }
  
  // Function to generate JavaScript code to access a JSON path
  function generateAccessCode(path) {
    if (!path) return 'data';
    
    let code = 'data';
    const segments = path.split('.');
    
    segments.forEach(segment => {
      if (segment.includes('[')) {
        // This is a property with array access
        const propName = segment.substring(0, segment.indexOf('['));
        const arrayAccess = segment.substring(segment.indexOf('['));
        
        if (propName) {
          code += `.${propName}${arrayAccess}`;
        } else {
          code += arrayAccess;
        }
      } else {
        // This is a simple property
        code += `.${segment}`;
      }
    });
    
    return code;
  }

  // Tree view conversion function
  function convertToTreeView() {
    if (!currentJson) return;
    
    try {
      // We're using Monaco editor's built-in folding capabilities
      // No need to change the actual JSON structure - just make sure folding is enabled
      const indent = indentationSelect.value === 'tab' ? '\t' : Number(indentationSelect.value);
      const formatted = JSON.stringify(currentJson, null, indent);
      
      // Update the editor model with the formatted JSON
      jsonEditor.setValue(formatted);
      
      // Monaco will automatically detect folding regions based on the indentation
      // We just need to ensure folding is enabled in the editor options
      jsonEditor.updateOptions({
        folding: true,
        foldingStrategy: 'indentation'
      });
      
      // Optionally, fold all initially and let user expand as needed
      setTimeout(() => {
        const foldAction = jsonEditor.getAction('editor.foldLevel2');
        if (foldAction) {
          foldAction.run();
        }
      }, 100);
      
      showToast('Tree view enabled. Use expand/collapse buttons or click the gutter markers.');
    } catch (error) {
      showError(`Error creating tree view: ${error.message}`);
      // Fall back to formatted view
      viewModeSelect.value = 'formatted';
    }
  }

  // Function to sort JSON object recursively
  function sortJsonObject(obj) {
    // Base case: if not an object or is null, return as is
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      // For arrays, sort each element recursively
      if (Array.isArray(obj)) {
        return obj.map(item => {
          if (item !== null && typeof item === 'object') {
            return sortJsonObject(item);
          }
          return item;
        });
      }
      return obj;
    }
    
    // Get all keys and sort them alphabetically
    const sortedKeys = Object.keys(obj).sort();
    
    // Create a new sorted object
    const sortedObj = {};
    sortedKeys.forEach(key => {
      const value = obj[key];
      // Recursively sort nested objects
      if (value !== null && typeof value === 'object') {
        sortedObj[key] = sortJsonObject(value);
      } else {
        sortedObj[key] = value;
      }
    });
    
    return sortedObj;
  }
});
