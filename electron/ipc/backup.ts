import { ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import logger from '../../src/utils/logger';

const backupDir = path.join(process.cwd(), 'backups');

export const setupBackupHandlers = () => {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  ipcMain.handle('backup:create', async () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `backup-${timestamp}.db`;
      const backupPath = path.join(backupDir, fileName);
      const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');

      fs.copyFileSync(dbPath, backupPath);

      logger.info(`Backup created: ${fileName}`);
      return { success: true, data: { fileName, path: backupPath } };
    } catch (error) {
      logger.error('Create backup handler error:', error);
      return { success: false, error: 'Failed to create backup' };
    }
  });

  ipcMain.handle('backup:restore', async (_event, filePath: string) => {
    try {
      const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
      fs.copyFileSync(filePath, dbPath);

      logger.info(`Backup restored from: ${filePath}`);
      return { success: true };
    } catch (error) {
      logger.error('Restore backup handler error:', error);
      return { success: false, error: 'Failed to restore backup' };
    }
  });

  ipcMain.handle('backup:getAll', async () => {
    try {
      const files = fs.readdirSync(backupDir);
      const backups = files
        .filter((file) => file.endsWith('.db'))
        .map((file) => {
          const stats = fs.statSync(path.join(backupDir, file));
          return {
            fileName: file,
            path: path.join(backupDir, file),
            size: stats.size,
            createdAt: stats.mtime,
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return { success: true, data: backups };
    } catch (error) {
      logger.error('Get backups handler error:', error);
      return { success: false, error: 'Failed to get backups' };
    }
  });
};
