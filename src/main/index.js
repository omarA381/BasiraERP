import { app, BrowserWindow, session } from 'electron';
import { join } from 'path';
import { hasConfig } from './db/pool.js';
import { registerIpcHandlers } from './ipc/index.js';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    frame: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: process.env.NODE_ENV === 'development',
    },
    title: 'NEXTERP',
    autoHideMenuBar: true,
    icon: undefined,
  });

  if (process.env.NODE_ENV === 'development' || process.env.ELECTRON_RENDERER_URL) {
    const devUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173';
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function setupCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self'",
            "connect-src 'self'",
          ].join('; '),
        ],
      },
    });
  });
}

async function ensureMigrations() {
  try {
    if (!hasConfig()) {
      return { ok: false, reason: 'no-config' };
    }

    const { migrate } = await import('./db/migrate.js');
    const dir = join(__dirname, 'db', 'migrations');
    const result = await migrate(dir);
    return { ok: true, result };
  } catch (error) {
    return { ok: false, reason: 'error', error: error.message };
  }
}

app.whenReady().then(async () => {
  setupCSP();

  // Register all IPC handlers before creating the window
  registerIpcHandlers();

  // Run migrations on startup
  try {
    await ensureMigrations();
  } catch {
    // Non-blocking; user can configure DB later
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

export { mainWindow };
