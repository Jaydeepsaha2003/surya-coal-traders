import { app, BrowserWindow, shell, dialog } from 'electron';
import path from 'node:path';
import { getDb } from './db';
import { registerIpc } from './ipc';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  const preloadPath = path.join(__dirname, '..', 'preload', 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0b0b0f',
    title: 'Surya Coal Traders',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.on('preload-error', (_ev, p, err) => {
    console.error('[main] PRELOAD ERROR in', p, '->', err);
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
  }
};

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  try {
    getDb();
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    console.error('[main] FATAL: getDb() failed', err);
    await dialog.showMessageBox({
      type: 'error',
      title: 'Surya Coal Traders — database init failed',
      message: 'The database could not be opened.',
      detail: `${message}\n\nYour data is at:\n${app.getPath('userData')}`,
      buttons: ['Quit'],
    });
    app.exit(1);
    return;
  }
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) mainWindow.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
