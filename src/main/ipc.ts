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
import { createTrade, deleteTrade, getTrade, listTrades, recentTrades } from './repo/trades';
import {
  addPayment,
  addReceipt,
  creditorsAging,
  creditorsSummary,
  debtorsAging,
  debtorsSummary,
  partyLedger,
} from './repo/ledger';
import { dashboardMetrics, monthlyPnl, reportSummary, whoToCall } from './repo/dashboard';
import { listPurchaseItems, listSaleItems } from './repo/items';
import { readSettings, updateSettings } from './repo/settings';
import { exportReportExcel } from './excel-export';
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
  handle(IPC.ledgerAddReceipt, (input: any) => addReceipt(input));
  handle(IPC.ledgerAddPayment, (input: any) => addPayment(input));

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
};
