/*
5/1/2026 - nick decker
ADDED
- isElectron flag exposed to renderer for environment detection
- openFile() IPC bridge for native file open dialog
- saveFile() IPC bridge for native file save dialog
- getAppVersion() IPC bridge for app version lookup
*/
const { contextBridge, clipboard, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  copyToClipboard: (text) => { clipboard.writeText(text); return true; },
  isElectron: true,
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (content) => ipcRenderer.invoke('dialog:saveFile', content),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPendingPayload: () => ipcRenderer.invoke('json:getPendingPayload'),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  onJsonReceived: (callback) => {
    ipcRenderer.on('json:received', (_event, payload) => callback(payload));
  },
});
