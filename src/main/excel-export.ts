import { app, dialog } from 'electron';
import path from 'node:path';
import { format } from 'date-fns';
import ExcelJS from 'exceljs';
import { listTrades } from './repo/trades';
import { debtorsSummary, creditorsSummary, debtorsAging, creditorsAging } from './repo/ledger';
import { monthlyPnl } from './repo/dashboard';

const rupees = (paise: number) => Math.round(paise) / 100;
const INR = '₹#,##,##0';

export const exportReportExcel = async (): Promise<{ saved: boolean; path?: string }> => {
  const defaultName = `Surya-Coal-Report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  const res = await dialog.showSaveDialog({
    title: 'Export business report',
    defaultPath: path.join(app.getPath('documents'), defaultName),
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
  });
  if (res.canceled || !res.filePath) return { saved: false };

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Surya Coal Traders';
  wb.created = new Date();

  // ----- Trades -----
  const trades = listTrades();
  const ts = wb.addWorksheet('Trades');
  ts.columns = [
    { header: 'Trade No', key: 'tradeNo', width: 12 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Lorry No', key: 'lorryNo', width: 14 },
    { header: 'From', key: 'from', width: 16 },
    { header: 'To', key: 'to', width: 16 },
    { header: 'Grade', key: 'grade', width: 8 },
    { header: 'Supplier(s)', key: 'sup', width: 22 },
    { header: 'Customer(s)', key: 'cus', width: 22 },
    { header: 'Purchase', key: 'purchase', width: 14, style: { numFmt: INR } },
    { header: 'Sale', key: 'sale', width: 14, style: { numFmt: INR } },
    { header: 'Profit', key: 'profit', width: 14, style: { numFmt: INR } },
  ];
  trades.forEach((t) =>
    ts.addRow({
      tradeNo: t.tradeNo,
      date: t.date,
      lorryNo: t.lorryNo ?? '',
      from: t.fromLocation ?? '',
      to: t.toLocation ?? '',
      grade: t.grade ?? '',
      sup: t.supplierNames,
      cus: t.customerNames,
      purchase: rupees(t.totalPurchase),
      sale: rupees(t.totalSale),
      profit: rupees(t.grossProfit),
    }),
  );

  // ----- Debtors -----
  const deb = debtorsSummary();
  const debAging = debtorsAging();
  const ds = wb.addWorksheet('Debtors');
  ds.columns = [
    { header: 'Customer', key: 'name', width: 24 },
    { header: 'Outstanding', key: 'out', width: 16, style: { numFmt: INR } },
    { header: '0-30', key: 'b1', width: 14, style: { numFmt: INR } },
    { header: '31-60', key: 'b2', width: 14, style: { numFmt: INR } },
    { header: '61-90', key: 'b3', width: 14, style: { numFmt: INR } },
    { header: '90+', key: 'b4', width: 14, style: { numFmt: INR } },
  ];
  debAging.forEach((r) =>
    ds.addRow({
      name: r.name,
      out: rupees(r.total),
      b1: rupees(r.bucket0_30),
      b2: rupees(r.bucket31_60),
      b3: rupees(r.bucket61_90),
      b4: rupees(r.bucket90Plus),
    }),
  );

  // ----- Creditors -----
  const crAging = creditorsAging();
  const cs = wb.addWorksheet('Creditors');
  cs.columns = [
    { header: 'Supplier', key: 'name', width: 24 },
    { header: 'Outstanding', key: 'out', width: 16, style: { numFmt: INR } },
    { header: '0-30', key: 'b1', width: 14, style: { numFmt: INR } },
    { header: '31-60', key: 'b2', width: 14, style: { numFmt: INR } },
    { header: '61-90', key: 'b3', width: 14, style: { numFmt: INR } },
    { header: '90+', key: 'b4', width: 14, style: { numFmt: INR } },
  ];
  crAging.forEach((r) =>
    cs.addRow({
      name: r.name,
      out: rupees(r.total),
      b1: rupees(r.bucket0_30),
      b2: rupees(r.bucket31_60),
      b3: rupees(r.bucket61_90),
      b4: rupees(r.bucket90Plus),
    }),
  );

  // ----- Monthly P&L -----
  const ps = wb.addWorksheet('Monthly P&L');
  ps.columns = [
    { header: 'Month', key: 'm', width: 12 },
    { header: 'Sales', key: 's', width: 16, style: { numFmt: INR } },
    { header: 'Purchases', key: 'p', width: 16, style: { numFmt: INR } },
    { header: 'Profit', key: 'pr', width: 16, style: { numFmt: INR } },
  ];
  monthlyPnl().forEach((pt) =>
    ps.addRow({ m: pt.label, s: rupees(pt.sale), p: rupees(pt.purchase), pr: rupees(pt.profit) }),
  );

  // Header styling on every sheet.
  for (const ws of [ts, ds, cs, ps]) {
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    // Totals row for the summary sheets.
  }
  ds.addRow({});
  ds.addRow({ name: 'TOTAL', out: rupees(deb.summary.total) }).font = { bold: true };
  cs.addRow({});
  cs.addRow({ name: 'TOTAL', out: rupees(creditorsSummary().summary.total) }).font = { bold: true };

  await wb.xlsx.writeFile(res.filePath);
  return { saved: true, path: res.filePath };
};
