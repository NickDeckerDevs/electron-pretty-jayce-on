/*
5/1/2026 - nick decker
ADDED
- dialog and fs imports for native file system access
- IPC handler dialog:openFile — native open dialog returning JSON file contents
- IPC handler dialog:saveFile — native save dialog writing JSON to disk
- IPC handler app:getVersion — returns app version to renderer
- clipboard import for clipboard relay IPC handler
- pendingPayload + parseProtocolUrl for custom protocol handling
- json-prettifier:// protocol registration (cross-OS)
- Single-instance lock with second-instance handler (Windows/Linux hot injection)
- open-url handler for macOS hot injection
- IPC handler json:getPendingPayload — renderer retrieves cold-start payload
- IPC handler clipboard:read — renderer reads clipboard for large JSON relay

CHANGED
- App icon reference updated to generated-icon.png (fixed broken path)
- app.whenReady() moved inside gotTheLock else block; checks process.argv for cold-start protocol URL
*/
const { app, BrowserWindow, ipcMain, Menu, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

let pendingPayload = null;
let mainWindow;

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

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('json-prettifier', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('json-prettifier');
}

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

  app.whenReady().then(() => {
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

// macOS: open-url can fire before app.whenReady()
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'generated-icon.png')
  });

  mainWindow.loadFile('index.html');

  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => createWindow()
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'About JSON Prettifier',
          click: async () => {
            dialog.showMessageBox(mainWindow, {
              title: 'About JSON Prettifier',
              message: 'JSON Prettifier',
              detail: 'A lightweight JSON formatting tool\nVersion 1.0.0',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('app:getVersion', () => app.getVersion());

ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (canceled) return null;
  return fs.readFileSync(filePaths[0], 'utf8');
});

ipcMain.handle('dialog:saveFile', async (event, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    filters: [{ name: 'JSON', extensions: ['json'] }],
    defaultPath: 'output.json'
  });
  if (canceled) return false;
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
});

ipcMain.handle('json:getPendingPayload', () => {
  const payload = pendingPayload;
  pendingPayload = null;
  return payload;
});

ipcMain.handle('clipboard:read', () => clipboard.readText());
