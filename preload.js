const { contextBridge, clipboard } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    copyToClipboard: (text) => {
      clipboard.writeText(text);
      return true;
    }
  }
);

// Expose any other APIs or methods needed by the renderer process
