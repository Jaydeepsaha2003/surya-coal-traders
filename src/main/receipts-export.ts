import { app, dialog, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { format } from 'date-fns';
import ExcelJS from 'exceljs';
import { receiptsPaymentsRows } from './repo/ledger';
import type { DateRange, ReceiptPaymentRow } from '../shared/types';

const INR = '₹#,##,##0';
const rupees = (paise: number) => Math.round(paise) / 100;
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return format(d, 'dd-MM-yyyy');
};
const fmtMoney = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    paise / 100,
  );

type DayGroup = { date: string; rows: ReceiptPaymentRow[]; receipts: number; payments: number };

const groupByDay = (rows: ReceiptPaymentRow[]): DayGroup[] => {
  const map = new Map<string, DayGroup>();
  for (const r of rows) {
    let g = map.get(r.date);
    if (!g) {
      g = { date: r.date, rows: [], receipts: 0, payments: 0 };
      map.set(r.date, g);
    }
    g.rows.push(r);
    if (r.kind === 'receipt') g.receipts += r.amount;
    else g.payments += r.amount;
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
};

const rangeLabel = (range?: DateRange) =>
  range?.from || range?.to ? `${range?.from || '…'} to ${range?.to || '…'}` : 'All dates';

const buildXlsx = async (filePath: string, rows: ReceiptPaymentRow[], range?: DateRange) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Surya Coal Traders';

  const days = groupByDay(rows);

  // Sheet 1 — day-by-day summary
  const ds = wb.addWorksheet('By Day');
  ds.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Receipts (in)', key: 'r', width: 16, style: { numFmt: INR } },
    { header: 'Payments (out)', key: 'p', width: 16, style: { numFmt: INR } },
    { header: 'Net', key: 'n', width: 16, style: { numFmt: INR } },
  ];
  days.forEach((g) =>
    ds.addRow({ date: fmtDate(g.date), r: rupees(g.receipts), p: rupees(g.payments), n: rupees(g.receipts - g.payments) }),
  );
  const totR = rows.filter((r) => r.kind === 'receipt').reduce((s, r) => s + r.amount, 0);
  const totP = rows.filter((r) => r.kind === 'payment').reduce((s, r) => s + r.amount, 0);
  ds.addRow({});
  ds.addRow({ date: 'TOTAL', r: rupees(totR), p: rupees(totP), n: rupees(totR - totP) }).font = {
    bold: true,
  };
  ds.getRow(1).font = { bold: true };

  // Sheet 2 — every entry
  const es = wb.addWorksheet('Entries');
  es.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Voucher', key: 'voucher', width: 12 },
    { header: 'Type', key: 'type', width: 10 },
    { header: 'Party', key: 'party', width: 24 },
    { header: 'Description', key: 'desc', width: 28 },
    { header: 'Receipt (in)', key: 'r', width: 16, style: { numFmt: INR } },
    { header: 'Payment (out)', key: 'p', width: 16, style: { numFmt: INR } },
  ];
  rows.forEach((r) =>
    es.addRow({
      date: fmtDate(r.date),
      voucher: r.voucher,
      type: r.kind === 'receipt' ? 'Receipt' : 'Payment',
      party: r.partyName,
      desc: r.description ?? '',
      r: r.kind === 'receipt' ? rupees(r.amount) : null,
      p: r.kind === 'payment' ? rupees(r.amount) : null,
    }),
  );
  es.getRow(1).font = { bold: true };
  es.views = [{ state: 'frozen', ySplit: 1 }];

  void range;
  await wb.xlsx.writeFile(filePath);
};

const buildPdf = async (filePath: string, rows: ReceiptPaymentRow[], range?: DateRange) => {
  const days = groupByDay(rows);
  const totR = rows.filter((r) => r.kind === 'receipt').reduce((s, r) => s + r.amount, 0);
  const totP = rows.filter((r) => r.kind === 'payment').reduce((s, r) => s + r.amount, 0);

  const dayRows = days
    .map(
      (g) =>
        `<tr><td>${fmtDate(g.date)}</td><td class="r">${fmtMoney(g.receipts)}</td><td class="r">${fmtMoney(
          g.payments,
        )}</td><td class="r">${fmtMoney(g.receipts - g.payments)}</td></tr>`,
    )
    .join('');
  const entryRows = rows
    .map(
      (r) =>
        `<tr><td>${fmtDate(r.date)}</td><td>${r.voucher}</td><td>${
          r.kind === 'receipt' ? 'Receipt' : 'Payment'
        }</td><td>${escapeHtml(r.partyName)}</td><td>${escapeHtml(r.description ?? '')}</td>` +
        `<td class="r">${r.kind === 'receipt' ? fmtMoney(r.amount) : ''}</td>` +
        `<td class="r">${r.kind === 'payment' ? fmtMoney(r.amount) : ''}</td></tr>`,
    )
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Segoe UI,Arial,sans-serif;color:#111;margin:24px;font-size:12px}
    h1{font-size:18px;margin:0 0 2px} .sub{color:#666;margin-bottom:16px}
    h2{font-size:14px;margin:18px 0 6px}
    table{width:100%;border-collapse:collapse;margin-bottom:10px}
    th,td{border:1px solid #ddd;padding:5px 8px;text-align:left}
    th{background:#f3ede4;font-size:11px;text-transform:uppercase;letter-spacing:.03em}
    td.r,th.r{text-align:right;font-variant-numeric:tabular-nums}
    tr.total td{font-weight:bold;background:#faf6f0}
  </style></head><body>
    <h1>Surya Coal Traders — Receipts &amp; Payments</h1>
    <div class="sub">${rangeLabel(range)} · generated ${fmtDate(new Date().toISOString())}</div>
    <h2>Day-by-day summary</h2>
    <table><thead><tr><th>Date</th><th class="r">Receipts (in)</th><th class="r">Payments (out)</th><th class="r">Net</th></tr></thead>
    <tbody>${dayRows || '<tr><td colspan="4">No entries</td></tr>'}
    <tr class="total"><td>TOTAL</td><td class="r">${fmtMoney(totR)}</td><td class="r">${fmtMoney(
      totP,
    )}</td><td class="r">${fmtMoney(totR - totP)}</td></tr></tbody></table>
    <h2>All entries</h2>
    <table><thead><tr><th>Date</th><th>Voucher</th><th>Type</th><th>Party</th><th>Description</th><th class="r">Receipt</th><th class="r">Payment</th></tr></thead>
    <tbody>${entryRows || '<tr><td colspan="7">No entries</td></tr>'}</tbody></table>
  </body></html>`;

  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { marginType: 'default' },
    });
    fs.writeFileSync(filePath, pdf);
  } finally {
    win.destroy();
  }
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export const exportReceiptsPayments = async (
  range: DateRange | undefined,
  fmt: 'xlsx' | 'pdf',
): Promise<{ saved: boolean; path?: string }> => {
  const rows = receiptsPaymentsRows(range);
  const stamp = format(new Date(), 'yyyy-MM-dd');
  const res = await dialog.showSaveDialog({
    title: 'Export Receipts & Payments',
    defaultPath: path.join(app.getPath('documents'), `Receipts-Payments-${stamp}.${fmt}`),
    filters:
      fmt === 'pdf'
        ? [{ name: 'PDF', extensions: ['pdf'] }]
        : [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
  });
  if (res.canceled || !res.filePath) return { saved: false };
  if (fmt === 'pdf') await buildPdf(res.filePath, rows, range);
  else await buildXlsx(res.filePath, rows, range);
  return { saved: true, path: res.filePath };
};
