// Renderer-side declaration of the API exposed by preload.

type SuryaApi = {
  settings: {
    get: () => Promise<any>;
    update: (patch: any) => Promise<any>;
  };
  masters: {
    downloadTemplate: (
      kind: 'customers' | 'suppliers' | 'transporters',
    ) => Promise<{ saved: boolean; path?: string }>;
    import: (kind: 'customers' | 'suppliers' | 'transporters') => Promise<{
      picked: boolean;
      file?: string;
      totalRows: number;
      created: number;
      skipped: number;
      errors: { row: number; reason: string }[];
    }>;
  };
  customers: {
    list: () => Promise<any[]>;
    get: (id: string) => Promise<any>;
    create: (input: any) => Promise<string>;
    update: (id: string, input: any) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  suppliers: {
    list: () => Promise<any[]>;
    get: (id: string) => Promise<any>;
    create: (input: any) => Promise<string>;
    update: (id: string, input: any) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  transporters: {
    list: () => Promise<any[]>;
    get: (id: string) => Promise<any>;
    create: (input: any) => Promise<string>;
    update: (id: string, input: any) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  trades: {
    list: (search?: string) => Promise<any[]>;
    get: (id: string) => Promise<any>;
    create: (input: any) => Promise<string>;
    update: (id: string, input: any) => Promise<string>;
    remove: (id: string) => Promise<void>;
    recent: (limit?: number) => Promise<any[]>;
  };
  ledger: {
    debtorsSummary: () => Promise<any>;
    creditorsSummary: () => Promise<any>;
    debtorsAging: () => Promise<any[]>;
    creditorsAging: () => Promise<any[]>;
    partyEntries: (partyType: 'customer' | 'supplier', partyId: string) => Promise<any[]>;
    openInvoices: (partyType: 'customer' | 'supplier', partyId: string) => Promise<any[]>;
    allOpenInvoices: (partyType: 'customer' | 'supplier') => Promise<any[]>;
    addReceipt: (input: any) => Promise<string>;
    addPayment: (input: any) => Promise<string>;
    updateEntry: (input: any) => Promise<void>;
    deleteEntry: (entryId: string) => Promise<void>;
  };
  purchases: {
    list: () => Promise<any[]>;
  };
  sales: {
    list: () => Promise<any[]>;
  };
  dashboard: {
    metrics: () => Promise<any>;
    monthlyPnl: (range?: { from?: string; to?: string }) => Promise<any[]>;
    whoToCall: (limit?: number) => Promise<any[]>;
  };
  report: {
    summary: (range?: { from?: string; to?: string }) => Promise<any>;
    exportExcel: () => Promise<{ saved: boolean; path?: string }>;
    receiptsPaymentsExport: (
      range: { from?: string; to?: string } | undefined,
      fmt: 'xlsx' | 'pdf',
    ) => Promise<{ saved: boolean; path?: string }>;
  };
};

declare global {
  interface Window {
    surya: SuryaApi;
  }
}

export {};
