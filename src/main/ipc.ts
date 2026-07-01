import { ipcMain } from 'electron';
import { IPC } from '../shared/ipc';
import {
  createCustomer,
  createSupplier,
  createTransporter,
  deleteCustomer,
  deleteSupplier,
  deleteTransporter,
  getCustomer,
  getSupplier,
  getTransporter,
  listCustomers,
  listSuppliers,
  listTransporters,
  updateCustomer,
  updateSupplier,
  updateTransporter,
} from './repo/masters';
import { createTrade, deleteTrade, getTrade, listTrades, recentTrades, updateTrade } from './repo/trades';
import {
  addPayment,
  addReceipt,
  allOpenInvoices,
  creditorsAging,
  creditorsSummary,
  debtorsAging,
  debtorsSummary,
  deleteLedgerEntry,
  openInvoices,
  partyLedger,
  receiptsPaymentsRows,
  updateReceiptPayment,
} from './repo/ledger';
import { dashboardMetrics, monthlyPnl, reportSummary, whoToCall } from './repo/dashboard';
import { listPurchaseItems, listSaleItems } from './repo/items';
import { readSettings, updateSettings } from './repo/settings';
import { exportReportExcel } from './excel-export';
import { downloadMasterTemplate, importMasters, type MasterKind } from './bulk-masters';
import { exportReceiptsPayments } from './receipts-export';
import type { LedgerPartyType } from '../shared/types';

const handle = <T>(channel: string, fn: (...args: any[]) => Promise<T> | T) => {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (err) {
      console.error(`[ipc] ${channel} failed`, err);
      return { ok: false, error: (err as Error).message };
    }
  });
};

export const registerIpc = () => {
  // Settings
  handle(IPC.settingsGet, () => readSettings());
  handle(IPC.settingsUpdate, (patch: any) => updateSettings(patch));

  // Masters bulk
  handle(IPC.mastersDownloadTemplate, (kind: MasterKind) => downloadMasterTemplate(kind));
  handle(IPC.mastersImport, (kind: MasterKind) => importMasters(kind));

  // Customers
  handle(IPC.customersList, () => listCustomers());
  handle(IPC.customersGet, (id: string) => getCustomer(id));
  handle(IPC.customersCreate, (input: any) => createCustomer(input));
  handle(IPC.customersUpdate, (id: string, input: any) => updateCustomer(id, input));
  handle(IPC.customersDelete, (id: string) => deleteCustomer(id));

  // Suppliers
  handle(IPC.suppliersList, () => listSuppliers());
  handle(IPC.suppliersGet, (id: string) => getSupplier(id));
  handle(IPC.suppliersCreate, (input: any) => createSupplier(input));
  handle(IPC.suppliersUpdate, (id: string, input: any) => updateSupplier(id, input));
  handle(IPC.suppliersDelete, (id: string) => deleteSupplier(id));

  // Transporters
  handle(IPC.transportersList, () => listTransporters());
  handle(IPC.transportersGet, (id: string) => getTransporter(id));
  handle(IPC.transportersCreate, (input: any) => createTransporter(input));
  handle(IPC.transportersUpdate, (id: string, input: any) => updateTransporter(id, input));
  handle(IPC.transportersDelete, (id: string) => deleteTransporter(id));

  // Trades
  handle(IPC.tradesList, (search?: string) => listTrades(search));
  handle(IPC.tradesGet, (id: string) => getTrade(id));
  handle(IPC.tradesCreate, (input: any) => createTrade(input));
  handle(IPC.tradesUpdate, (id: string, input: any) => updateTrade(id, input));
  handle(IPC.tradesDelete, (id: string) => deleteTrade(id));
  handle(IPC.tradesRecent, (limit?: number) => recentTrades(limit ?? 10));

  // Ledgers
  handle(IPC.ledgerDebtorsSummary, () => debtorsSummary());
  handle(IPC.ledgerCreditorsSummary, () => creditorsSummary());
  handle(IPC.ledgerDebtorsAging, () => debtorsAging());
  handle(IPC.ledgerCreditorsAging, () => creditorsAging());
  handle(IPC.ledgerPartyEntries, (partyType: LedgerPartyType, partyId: string) =>
    partyLedger(partyType, partyId),
  );
  handle(IPC.ledgerOpenInvoices, (partyType: LedgerPartyType, partyId: string) =>
    openInvoices(partyType, partyId),
  );
  handle(IPC.ledgerAllOpenInvoices, (partyType: LedgerPartyType) => allOpenInvoices(partyType));
  handle(IPC.ledgerAddReceipt, (input: any) => addReceipt(input));
  handle(IPC.ledgerAddPayment, (input: any) => addPayment(input));
  handle(IPC.ledgerUpdateEntry, (input: any) => updateReceiptPayment(input));
  handle(IPC.ledgerDeleteEntry, (entryId: string) => deleteLedgerEntry(entryId));
  handle(IPC.ledgerReceiptsPayments, (range?: any) => receiptsPaymentsRows(range));

  // Purchases / Sales
  handle(IPC.purchasesList, () => listPurchaseItems());
  handle(IPC.salesList, () => listSaleItems());

  // Dashboard
  handle(IPC.dashboardMetrics, () => dashboardMetrics());
  handle(IPC.dashboardMonthlyPnl, (range?: any) => monthlyPnl(range));
  handle(IPC.dashboardWhoToCall, (limit?: number) => whoToCall(limit ?? 6));

  // Reports
  handle(IPC.reportSummary, (range?: any) => reportSummary(range));
  handle(IPC.reportExportExcel, () => exportReportExcel());
  handle(IPC.reportReceiptsPaymentsExport, (range: any, fmt: 'xlsx' | 'pdf') =>
    exportReceiptsPayments(range, fmt),
  );
};
