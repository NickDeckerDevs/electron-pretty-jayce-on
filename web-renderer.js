// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
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
    setupEventListeners();
    setupResizeObserver();
  });

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

  function setupEventListeners() {
    // Prettify button click handler
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
    });

    // Indentation change handler
    indentationSelect.addEventListener('change', () => {
      if (currentJson) {
        const indent = indentationSelect.value === 'tab' ? '\t' : Number(indentationSelect.value);
        const formatted = JSON.stringify(currentJson, null, indent);
        jsonEditor.setValue(formatted);
      }
    });

    // Cursor position handler to show JSON path
    jsonEditor.onDidChangeCursorPosition((e) => {
      if (currentJson) {
        const position = e.position;
        const path = getJsonPathAtPosition(jsonEditor.getValue(), position);
        pathDisplay.textContent = path ? path : '';
      }
    });
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
