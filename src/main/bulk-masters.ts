import { app, dialog } from 'electron';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { createCustomer, createSupplier, createTransporter } from './repo/masters';

export type MasterKind = 'customers' | 'suppliers' | 'transporters';

type Col = { header: string; key: string; width?: number };

const COLUMNS: Record<MasterKind, Col[]> = {
  customers: [
    { header: 'Name*', key: 'name', width: 24 },
    { header: 'Location', key: 'location', width: 18 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Email', key: 'email', width: 22 },
    { header: 'Address', key: 'address', width: 28 },
    { header: 'GSTIN', key: 'gstin', width: 18 },
    { header: 'Credit Period (days)', key: 'creditPeriod', width: 18 },
    { header: 'Opening Balance', key: 'openingBalance', width: 16 },
    { header: 'Opening Date (YYYY-MM-DD)', key: 'openingDate', width: 22 },
  ],
  suppliers: [
    { header: 'Name*', key: 'name', width: 24 },
    { header: 'Location', key: 'location', width: 18 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Email', key: 'email', width: 22 },
    { header: 'Address', key: 'address', width: 28 },
    { header: 'GSTIN', key: 'gstin', width: 18 },
    { header: 'Opening Balance', key: 'openingBalance', width: 16 },
    { header: 'Opening Date (YYYY-MM-DD)', key: 'openingDate', width: 22 },
  ],
  transporters: [
    { header: 'Name*', key: 'name', width: 24 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Vehicle No', key: 'vehicleNo', width: 16 },
    { header: 'Location', key: 'location', width: 18 },
  ],
};

const titles: Record<MasterKind, string> = {
  customers: 'Customers',
  suppliers: 'Suppliers',
  transporters: 'Transporters',
};

export const downloadMasterTemplate = async (
  kind: MasterKind,
): Promise<{ saved: boolean; path?: string }> => {
  const res = await dialog.showSaveDialog({
    title: `${titles[kind]} import template`,
    defaultPath: path.join(app.getPath('documents'), `${kind}-template.xlsx`),
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
  });
  if (res.canceled || !res.filePath) return { saved: false };

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(titles[kind]);
  ws.columns = COLUMNS[kind].map((c) => ({ header: c.header, key: c.key, width: c.width }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  await wb.xlsx.writeFile(res.filePath);
  return { saved: true, path: res.filePath };
};

const str = (v: any): string | undefined => {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'object' && 'text' in v) return String((v as any).text).trim() || undefined;
  const s = String(v).trim();
  return s || undefined;
};
const num = (v: any): number => {
  const n = Number(str(v) ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const importMasters = async (
  kind: MasterKind,
): Promise<{
  picked: boolean;
  file?: string;
  totalRows: number;
  created: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}> => {
  const res = await dialog.showOpenDialog({
    title: `Import ${titles[kind]} from Excel`,
    properties: ['openFile'],
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
  });
  if (res.canceled || !res.filePaths[0]) {
    return { picked: false, totalRows: 0, created: 0, skipped: 0, errors: [] };
  }
  const file = res.filePaths[0];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  const cols = COLUMNS[kind];

  let created = 0;
  let skipped = 0;
  let totalRows = 0;
  const errors: { row: number; reason: string }[] = [];

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    // Build a record from cell positions (1-based).
    const rec: Record<string, any> = {};
    cols.forEach((c, i) => {
      rec[c.key] = row.getCell(i + 1).value;
    });
    const name = str(rec.name);
    // Skip fully-empty rows silently.
    const anyValue = cols.some((c) => str(rec[c.key]) !== undefined);
    if (!anyValue) return;
    totalRows++;
    if (!name) {
      skipped++;
      errors.push({ row: rowNumber, reason: 'Missing Name' });
      return;
    }
    try {
      if (kind === 'customers') {
        createCustomer({
          name,
          location: str(rec.location),
          phone: str(rec.phone),
          email: str(rec.email),
          address: str(rec.address),
          gstin: str(rec.gstin),
          creditPeriod: num(rec.creditPeriod),
          openingBalance: num(rec.openingBalance),
          openingDate: str(rec.openingDate),
        });
      } else if (kind === 'suppliers') {
        createSupplier({
          name,
          location: str(rec.location),
          phone: str(rec.phone),
          email: str(rec.email),
          address: str(rec.address),
          gstin: str(rec.gstin),
          openingBalance: num(rec.openingBalance),
          openingDate: str(rec.openingDate),
        });
      } else {
        createTransporter({
          name,
          phone: str(rec.phone),
          vehicleNo: str(rec.vehicleNo),
          location: str(rec.location),
        });
      }
      created++;
    } catch (err) {
      skipped++;
      errors.push({ row: rowNumber, reason: (err as Error).message });
    }
  });

  return { picked: true, file, totalRows, created, skipped, errors };
};
