// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
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
  
  // Global variables
  let jsonEditor;
  let isDarkTheme = false;
  let currentJson = null;
  
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
    // Existing event listeners
    prettifyBtn.addEventListener('click', () => {
      const rawJson = jsonEditor.getValue();
      
      if (!rawJson || rawJson.trim() === '' || rawJson.includes('// Paste your JSON here')) {
        showError('Please enter some JSON content');
        return;
      }
      
      try {
        // Try to parse the JSON to validate it
        const parsed = JSON.parse(rawJson);
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
      } catch (error) {
        // Show error message
        showError(`Invalid JSON: ${error.message}`);
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
      }
    });
    
    // New event listeners for the additional features
    
    // Save document button
    const saveDocumentBtn = document.getElementById('save-document');
    if (saveDocumentBtn) {
      saveDocumentBtn.addEventListener('click', () => {
        const rawJson = jsonEditor.getValue();
        
        try {
          // Validate JSON before saving
          const parsed = JSON.parse(rawJson);
          
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
          showError(`Invalid JSON: ${error.message}`);
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
});
