// IMPORTANT: env.ts must be the very first import so that dotenv populates
// process.env before any module that reads environment variables is loaded.
import './env';

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { autoUpdater } from 'electron-updater';
import { setupIpcHandlers } from './ipc';
import logger from '../src/utils/logger';

let mainWindow: BrowserWindow | null = null;

// ─── Auto-updater configuration ───────────────────────────────────────────────

function configureAutoUpdater() {
  // Don't auto-download — we want to notify the user first and let them
  // decide when to install (so they aren't interrupted mid-sale).
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Route updater logs through the app logger
  autoUpdater.logger = logger;

  autoUpdater.on('checking-for-update', () => {
    logger.info('Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    logger.info(`Update available: v${info.version}`);
    // Notify the renderer so it can show a banner/toast
    mainWindow?.webContents.send('update:available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', () => {
    logger.info('Application is up to date.');
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    logger.info(`Download progress: ${percent}%`);
    mainWindow?.webContents.send('update:download-progress', { percent });
  });

  autoUpdater.on('update-downloaded', (info) => {
    logger.info(`Update downloaded: v${info.version}`);
    mainWindow?.webContents.send('update:downloaded', { version: info.version });
  });

  autoUpdater.on('error', (err) => {
    logger.error('Auto-updater error:', err);
    // "Cannot parse releases feed" / "Unable to find latest" just means the
    // GitHub release isn't published yet (Actions still building). Don't
    // surface this as an alarming error toast for the user.
    const msg = err.message || '';
    const isNoRelease =
      msg.includes('Cannot parse releases feed') ||
      msg.includes('Unable to find latest') ||
      msg.includes('net::ERR_');
    if (!isNoRelease) {
      mainWindow?.webContents.send('update:error', { message: msg });
    }
  });
}

// IPC handlers the renderer calls to drive the update flow
function setupUpdaterIpcHandlers() {
  // User clicked "Download update" in the UI
  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err: any) {
      logger.error('Download update error:', err);
      return { success: false, error: err.message };
    }
  });

  // User clicked "Restart and install"
  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  // Manual check triggered from Settings page
  ipcMain.handle('updater:check', async () => {
    try {
      await autoUpdater.checkForUpdates();
      return { success: true };
    } catch (err: any) {
      logger.error('Check for updates error:', err);
      return { success: false, error: err.message };
    }
  });

  // Renderer asks what version is installed
  ipcMain.handle('updater:getVersion', () => {
    return app.getVersion();
  });
}

// ─── Window ───────────────────────────────────────────────────────────────────

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../../assets/icon.png'),
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logger.error(`Failed to load: ${validatedURL} — ${errorCode} ${errorDescription}`);
  });
};

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  setupIpcHandlers();
  setupUpdaterIpcHandlers();
  configureAutoUpdater();

  // Check for updates 5 seconds after launch (gives the window time to render)
  // Only runs in production builds — autoUpdater is a no-op in dev.
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        logger.error('Initial update check failed:', err);
      });
    }, 5000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  logger.info('Application started');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  logger.info('Application closing');
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

export { mainWindow };
