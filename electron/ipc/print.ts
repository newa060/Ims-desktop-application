import { ipcMain, BrowserWindow } from 'electron';
import logger from '../../src/utils/logger';

export const setupPrintHandlers = () => {
  ipcMain.handle('print:invoice', async (_event, data) => {
    try {
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: true,
        },
      });

      // Generate HTML for invoice
      const html = generateInvoiceHTML(data);
      
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      
      printWindow.webContents.print(
        {
          silent: false,
          printBackground: true,
          margins: { marginType: 'none' },
        },
        (success) => {
          if (!success) {
            logger.error('Print failed');
          }
          printWindow.close();
        }
      );

      return { success: true };
    } catch (error) {
      logger.error('Print invoice handler error:', error);
      return { success: false, error: 'Failed to print invoice' };
    }
  });

  ipcMain.handle('print:receipt', async (_event, data) => {
    try {
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: true,
        },
      });

      const html = generateReceiptHTML(data);
      
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      
      printWindow.webContents.print(
        {
          silent: false,
          printBackground: true,
        },
        (success) => {
          if (!success) {
            logger.error('Print failed');
          }
          printWindow.close();
        }
      );

      return { success: true };
    } catch (error) {
      logger.error('Print receipt handler error:', error);
      return { success: false, error: 'Failed to print receipt' };
    }
  });
};

function generateInvoiceHTML(data: any): string {
  return `<!DOCTYPE html><html><head><style>body{font-family:Arial}</style></head><body>${data.content}</body></html>`;
}

function generateReceiptHTML(data: any): string {
  return `<!DOCTYPE html><html><head><style>body{font-family:monospace}</style></head><body>${data.content}</body></html>`;
}
