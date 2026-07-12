import { ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import supabase from '../../src/database/supabaseClient';
import logger from '../../src/utils/logger';

const backupDir = path.join(process.cwd(), 'backups');

// Order matters: children before parents wouldn't matter for export (plain
// reads), but restore re-inserts in this order so foreign keys resolve.
// Note: `products` is the table SHARED with the website — a restore will
// overwrite the live storefront catalog/stock too, not just desktop-only
// data. Use with care.
const TABLES_IN_DEPENDENCY_ORDER = [
  'roles',
  'permissions',
  'users',
  'categories',
  'brands',
  'units',
  'products',
  'suppliers',
  'customers',
  'purchases',
  'purchase_items',
  'sales',
  'sale_items',
  'inventory_history',
  'stock_adjustments',
  'expense_categories',
  'expenses',
  'settings',
];

export const setupBackupHandlers = () => {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Exports every table to a single JSON file. Since the database now lives
  // in Supabase (not a local file), a "backup" is a full data export rather
  // than a file copy.
  ipcMain.handle('backup:create', async () => {
    try {
      const snapshot: Record<string, any[]> = {};

      for (const table of TABLES_IN_DEPENDENCY_ORDER) {
        const { data, error } = await supabase.from(table).select('*');
        if (error) throw error;
        snapshot[table] = data || [];
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `backup-${timestamp}.json`;
      const backupPath = path.join(backupDir, fileName);

      fs.writeFileSync(backupPath, JSON.stringify(snapshot, null, 2));

      logger.info(`Backup created: ${fileName}`);
      return { success: true, data: { fileName, path: backupPath } };
    } catch (error) {
      logger.error('Create backup handler error:', error);
      return { success: false, error: 'Failed to create backup' };
    }
  });

  // Restores a JSON export back into Supabase via upsert, in FK-safe order.
  ipcMain.handle('backup:restore', async (_event, filePath: string) => {
    try {
      const snapshot = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      for (const table of TABLES_IN_DEPENDENCY_ORDER) {
        const rows = snapshot[table];
        if (!rows || rows.length === 0) continue;

        const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
        if (error) throw error;
      }

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
        .filter((file) => file.endsWith('.json'))
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

  ipcMain.handle('backup:selectAndRestore', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Backup File to Restore',
        filters: [{ name: 'JSON Backups', extensions: ['json'] }],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'Restore cancelled by user' };
      }

      const filePath = result.filePaths[0];
      const snapshot = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      // Quick validation check
      if (typeof snapshot !== 'object') {
        throw new Error('Invalid backup file format');
      }

      for (const table of TABLES_IN_DEPENDENCY_ORDER) {
        const rows = snapshot[table];
        if (!rows || rows.length === 0) continue;

        const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
        if (error) throw error;
      }

      logger.info(`Backup restored from select dialog: ${filePath}`);
      return { success: true };
    } catch (error: any) {
      logger.error('Dialog restore backup handler error:', error);
      return { success: false, error: error?.message || 'Failed to restore backup' };
    }
  });

  ipcMain.handle('backup:delete', async (_event, fileName: string) => {
    try {
      const filePath = path.join(backupDir, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`Backup deleted: ${fileName}`);
        return { success: true };
      }
      return { success: false, error: 'Backup file not found' };
    } catch (error) {
      logger.error('Delete backup handler error:', error);
      return { success: false, error: 'Failed to delete backup file' };
    }
  });
};
