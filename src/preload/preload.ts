import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';

type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string };

const invoke = async <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
  const res = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>;
  if (!res.ok) throw new Error(res.error);
  return res.data;
};

const api = {
  settings: {
    get: () => invoke(IPC.settingsGet),
    update: (patch: unknown) => invoke(IPC.settingsUpdate, patch),
  },
  masters: {
    downloadTemplate: (kind: 'customers' | 'suppliers' | 'transporters') =>
      invoke<{ saved: boolean; path?: string }>(IPC.mastersDownloadTemplate, kind),
    import: (kind: 'customers' | 'suppliers' | 'transporters') =>
      invoke<{
        picked: boolean;
        file?: string;
        totalRows: number;
        created: number;
        skipped: number;
        errors: { row: number; reason: string }[];
      }>(IPC.mastersImport, kind),
  },
  customers: {
    list: () => invoke<any[]>(IPC.customersList),
    get: (id: string) => invoke(IPC.customersGet, id),
    create: (input: unknown) => invoke<string>(IPC.customersCreate, input),
    update: (id: string, input: unknown) => invoke(IPC.customersUpdate, id, input),
    remove: (id: string) => invoke(IPC.customersDelete, id),
  },
  suppliers: {
    list: () => invoke<any[]>(IPC.suppliersList),
    get: (id: string) => invoke(IPC.suppliersGet, id),
    create: (input: unknown) => invoke<string>(IPC.suppliersCreate, input),
    update: (id: string, input: unknown) => invoke(IPC.suppliersUpdate, id, input),
    remove: (id: string) => invoke(IPC.suppliersDelete, id),
  },
  transporters: {
    list: () => invoke<any[]>(IPC.transportersList),
    get: (id: string) => invoke(IPC.transportersGet, id),
    create: (input: unknown) => invoke<string>(IPC.transportersCreate, input),
    update: (id: string, input: unknown) => invoke(IPC.transportersUpdate, id, input),
    remove: (id: string) => invoke(IPC.transportersDelete, id),
  },
  trades: {
    list: (search?: string) => invoke<any[]>(IPC.tradesList, search),
    get: (id: string) => invoke(IPC.tradesGet, id),
    create: (input: unknown) => invoke<string>(IPC.tradesCreate, input),
    update: (id: string, input: unknown) => invoke<string>(IPC.tradesUpdate, id, input),
    remove: (id: string) => invoke(IPC.tradesDelete, id),
    recent: (limit?: number) => invoke<any[]>(IPC.tradesRecent, limit),
  },
  ledger: {
    debtorsSummary: () => invoke<any>(IPC.ledgerDebtorsSummary),
    creditorsSummary: () => invoke<any>(IPC.ledgerCreditorsSummary),
    debtorsAging: () => invoke<any[]>(IPC.ledgerDebtorsAging),
    creditorsAging: () => invoke<any[]>(IPC.ledgerCreditorsAging),
    partyEntries: (partyType: 'customer' | 'supplier', partyId: string) =>
      invoke<any[]>(IPC.ledgerPartyEntries, partyType, partyId),
    openInvoices: (partyType: 'customer' | 'supplier', partyId: string) =>
      invoke<any[]>(IPC.ledgerOpenInvoices, partyType, partyId),
    allOpenInvoices: (partyType: 'customer' | 'supplier') =>
      invoke<any[]>(IPC.ledgerAllOpenInvoices, partyType),
    addReceipt: (input: unknown) => invoke<string>(IPC.ledgerAddReceipt, input),
    addPayment: (input: unknown) => invoke<string>(IPC.ledgerAddPayment, input),
    updateEntry: (input: unknown) => invoke(IPC.ledgerUpdateEntry, input),
    deleteEntry: (entryId: string) => invoke(IPC.ledgerDeleteEntry, entryId),
    receiptsPayments: (range?: { from?: string; to?: string }) =>
      invoke<any[]>(IPC.ledgerReceiptsPayments, range),
  },
  purchases: {
    list: () => invoke<any[]>(IPC.purchasesList),
  },
  sales: {
    list: () => invoke<any[]>(IPC.salesList),
  },
  dashboard: {
    metrics: () => invoke<any>(IPC.dashboardMetrics),
    monthlyPnl: (range?: { from?: string; to?: string }) =>
      invoke<any[]>(IPC.dashboardMonthlyPnl, range),
    whoToCall: (limit?: number) => invoke<any[]>(IPC.dashboardWhoToCall, limit),
  },
  report: {
    summary: (range?: { from?: string; to?: string }) => invoke<any>(IPC.reportSummary, range),
    exportExcel: () => invoke<{ saved: boolean; path?: string }>(IPC.reportExportExcel),
    receiptsPaymentsExport: (range: { from?: string; to?: string } | undefined, fmt: 'xlsx' | 'pdf') =>
      invoke<{ saved: boolean; path?: string }>(IPC.reportReceiptsPaymentsExport, range, fmt),
  },
};

try {
  contextBridge.exposeInMainWorld('surya', api);
  console.log('[preload] window.surya exposed');
} catch (err) {
  console.error('[preload] failed to expose API', err);
}

export type SuryaApi = typeof api;
