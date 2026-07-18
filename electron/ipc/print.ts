import { ipcMain, BrowserWindow } from 'electron';
import logger from '../../src/utils/logger';

export const setupPrintHandlers = () => {
  ipcMain.handle('print:invoice', async (_event, data) => {
    try {
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
        },
      });

      const html = generateInvoiceHTML(data);

      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      printWindow.webContents.print(
        {
          silent: false,
          printBackground: true,
          margins: { marginType: 'default' },
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
          nodeIntegration: false,
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

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n: number, symbol = 'Rs.'): string {
  const val = Number(n) || 0;
  return `${symbol} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function generateInvoiceHTML(data: any): string {
  // Legacy: raw HTML body content
  if (typeof data?.content === 'string' && !data.items) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#111}
    </style></head><body>${data.content}</body></html>`;
  }

  const symbol = data.currencySymbol || 'Rs.';
  const business = data.businessName || 'Invoice';
  const footer = data.footer || 'Thank you for your business!';
  const items: any[] = data.items || [];

  const rows = items
    .map((item) => {
      const lineTotal =
        item.total ??
        item.quantity * item.unitPrice - (item.discountAmount || 0);
      return `<tr>
        <td>
          <div class="name">${esc(item.name)}</div>
          ${item.sku ? `<div class="sku">${esc(item.sku)}</div>` : ''}
        </td>
        <td class="c">${esc(item.quantity)}</td>
        <td class="r">${money(item.unitPrice, symbol)}</td>
        <td class="r">${money(lineTotal, symbol)}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${esc(data.saleNumber || '')}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #1a1a1a;
      margin: 0;
      padding: 28px 32px;
      font-size: 13px;
    }
    .header { text-align: center; margin-bottom: 22px; }
    .header h1 { margin: 0; font-size: 22px; letter-spacing: 0.02em; }
    .header .meta { color: #555; margin-top: 4px; font-size: 12px; }
    .info {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
      padding-bottom: 14px;
      border-bottom: 1px solid #ddd;
    }
    .info div { line-height: 1.55; }
    .label { color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th {
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #555;
      border-bottom: 2px solid #222;
      padding: 8px 6px;
    }
    th.c, td.c { text-align: center; }
    th.r, td.r { text-align: right; }
    td { padding: 9px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
    .name { font-weight: 600; }
    .sku { color: #777; font-size: 11px; font-family: ui-monospace, monospace; margin-top: 2px; }
    .totals { width: 260px; margin-left: auto; }
    .totals .row { display: flex; justify-content: space-between; padding: 4px 0; }
    .totals .grand {
      border-top: 2px solid #222;
      margin-top: 6px;
      padding-top: 8px;
      font-size: 15px;
      font-weight: 700;
    }
    .footer {
      margin-top: 28px;
      text-align: center;
      color: #666;
      font-size: 12px;
      border-top: 1px dashed #ccc;
      padding-top: 14px;
    }
    @media print {
      body { padding: 12px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${esc(business)}</h1>
    <div class="meta">SALES INVOICE</div>
  </div>
  <div class="info">
    <div>
      <div class="label">Invoice</div>
      <div><strong>${esc(data.saleNumber || '—')}</strong></div>
      <div>${esc(data.date || '')}</div>
    </div>
    <div>
      <div class="label">Customer</div>
      <div><strong>${esc(data.customerName || 'Walk-in')}</strong></div>
      ${data.customerPhone ? `<div>${esc(data.customerPhone)}</div>` : ''}
    </div>
    <div>
      <div class="label">Payment</div>
      <div class="capitalize">${esc((data.paymentMethod || '').replace(/_/g, ' '))}</div>
      <div>Status: ${esc(data.paymentStatus || 'paid')}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th class="c">Qty</th>
        <th class="r">Price</th>
        <th class="r">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${money(data.subtotal, symbol)}</span></div>
    <div class="row"><span>Tax</span><span>${money(data.taxAmount, symbol)}</span></div>
    <div class="row"><span>Discount</span><span>-${money(data.discountAmount, symbol)}</span></div>
    <div class="row grand"><span>Total</span><span>${money(data.totalAmount, symbol)}</span></div>
    <div class="row"><span>Paid</span><span>${money(data.paidAmount, symbol)}</span></div>
    <div class="row"><span>Change</span><span>${money(data.changeAmount, symbol)}</span></div>
  </div>
  ${data.notes ? `<p style="margin-top:16px;color:#555"><strong>Notes:</strong> ${esc(data.notes)}</p>` : ''}
  <div class="footer">${esc(footer)}</div>
</body>
</html>`;
}

function generateReceiptHTML(data: any): string {
  if (typeof data?.content === 'string' && !data.items) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{font-family:monospace;padding:12px;width:280px}
    </style></head><body>${data.content}</body></html>`;
  }
  // Reuse invoice layout for structured receipt data
  return generateInvoiceHTML(data);
}
