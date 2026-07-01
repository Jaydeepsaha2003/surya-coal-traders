import { app, dialog, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { format } from 'date-fns';
import { listTrades } from './repo/trades';
import { receiptsPaymentsRows } from './repo/ledger';
import type { DateRange } from '../shared/types';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : format(d, 'dd-MM-yyyy');
};
const fmtMoney = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    (paise ?? 0) / 100,
  );
const esc = (s: string) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

const inRange = (date: string, range?: DateRange) =>
  (!range?.from || date >= range.from) && (!range?.to || date <= range.to);

const rangeLabel = (range?: DateRange) =>
  range?.from || range?.to ? `${range?.from || '…'} to ${range?.to || '…'}` : 'All dates';

export const exportFullReport = async (
  range: DateRange | undefined,
): Promise<{ saved: boolean; path?: string }> => {
  const stamp = format(new Date(), 'yyyy-MM-dd');
  const res = await dialog.showSaveDialog({
    title: 'Export full report (PDF)',
    defaultPath: path.join(app.getPath('documents'), `Surya-Full-Report-${stamp}.pdf`),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (res.canceled || !res.filePath) return { saved: false };

  const trades = listTrades().filter((t) => inRange(t.date, range));
  const rp = receiptsPaymentsRows(range);
  const receipts = rp.filter((r) => r.kind === 'receipt');
  const payments = rp.filter((r) => r.kind === 'payment');

  const tSale = trades.reduce((s, t) => s + t.totalSale, 0);
  const tPur = trades.reduce((s, t) => s + t.totalPurchase, 0);
  const tTrans = trades.reduce((s, t) => s + (t.transportCost ?? 0), 0);
  const tProfit = trades.reduce((s, t) => s + t.grossProfit, 0);
  const totReceipts = receipts.reduce((s, r) => s + r.amount, 0);
  const totPayments = payments.reduce((s, r) => s + r.amount, 0);

  const tradeRows = trades
    .map(
      (t) =>
        `<tr><td>${esc(t.tradeNo)}</td><td>${fmtDate(t.date)}</td><td>${esc(t.lorryNo || '')}</td>` +
        `<td>${esc([t.fromLocation, t.toLocation].filter(Boolean).join(' → '))}</td>` +
        `<td>${esc(t.grade || '')}</td><td>${esc(t.supplierNames || '')}</td><td>${esc(t.customerNames || '')}</td>` +
        `<td class="r">${fmtMoney(t.totalPurchase)}</td><td class="r">${fmtMoney(t.totalSale)}</td>` +
        `<td class="r">${fmtMoney(t.transportCost)}</td><td class="r">${fmtMoney(t.grossProfit)}</td></tr>`,
    )
    .join('');

  const txnRows = (rows: typeof receipts) =>
    rows
      .map(
        (r) =>
          `<tr><td>${fmtDate(r.date)}</td><td>${esc(r.voucher)}</td><td>${esc(r.partyName)}</td>` +
          `<td>${esc(r.description || '')}</td><td class="r">${fmtMoney(r.amount)}</td></tr>`,
      )
      .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Segoe UI,Arial,sans-serif;color:#111;margin:20px;font-size:11px}
    h1{font-size:18px;margin:0 0 2px} .sub{color:#666;margin-bottom:14px}
    h2{font-size:13px;margin:16px 0 6px;border-bottom:2px solid #e2b48c;padding-bottom:3px}
    table{width:100%;border-collapse:collapse;margin-bottom:8px}
    th,td{border:1px solid #ddd;padding:4px 6px;text-align:left}
    th{background:#f3ede4;font-size:10px;text-transform:uppercase;letter-spacing:.03em}
    td.r,th.r{text-align:right;font-variant-numeric:tabular-nums}
    tr.total td{font-weight:bold;background:#faf6f0}
    .empty{color:#888;padding:6px 0}
  </style></head><body>
    <h1>Surya Coal Traders — Full Report</h1>
    <div class="sub">${rangeLabel(range)} · generated ${fmtDate(new Date().toISOString())}</div>

    <h2>1. Trades (${trades.length})</h2>
    ${
      trades.length
        ? `<table><thead><tr><th>Trade No</th><th>Date</th><th>Lorry</th><th>Route</th><th>Grade</th><th>Supplier(s)</th><th>Customer(s)</th><th class="r">Purchase</th><th class="r">Sale</th><th class="r">Transport</th><th class="r">Profit</th></tr></thead>
      <tbody>${tradeRows}
      <tr class="total"><td colspan="7">TOTAL</td><td class="r">${fmtMoney(tPur)}</td><td class="r">${fmtMoney(tSale)}</td><td class="r">${fmtMoney(tTrans)}</td><td class="r">${fmtMoney(tProfit)}</td></tr></tbody></table>`
        : '<div class="empty">No trades in this range.</div>'
    }

    <h2>2. Receipts — Collections from customers (${receipts.length})</h2>
    ${
      receipts.length
        ? `<table><thead><tr><th>Date</th><th>Voucher</th><th>Customer</th><th>Description</th><th class="r">Amount</th></tr></thead>
      <tbody>${txnRows(receipts)}
      <tr class="total"><td colspan="4">TOTAL RECEIPTS</td><td class="r">${fmtMoney(totReceipts)}</td></tr></tbody></table>`
        : '<div class="empty">No receipts in this range.</div>'
    }

    <h2>3. Payments — to suppliers (${payments.length})</h2>
    ${
      payments.length
        ? `<table><thead><tr><th>Date</th><th>Voucher</th><th>Supplier</th><th>Description</th><th class="r">Amount</th></tr></thead>
      <tbody>${txnRows(payments)}
      <tr class="total"><td colspan="4">TOTAL PAYMENTS</td><td class="r">${fmtMoney(totPayments)}</td></tr></tbody></table>`
        : '<div class="empty">No payments in this range.</div>'
    }
  </body></html>`;

  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      landscape: true,
      margins: { marginType: 'default' },
    });
    fs.writeFileSync(res.filePath, pdf);
  } finally {
    win.destroy();
  }
  return { saved: true, path: res.filePath };
};
