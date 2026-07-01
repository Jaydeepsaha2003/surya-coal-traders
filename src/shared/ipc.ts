// Channel names for IPC. Centralized so renderer and main agree.

export const IPC = {
  // Settings
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',

  // Masters bulk import/template
  mastersDownloadTemplate: 'masters:downloadTemplate',
  mastersImport: 'masters:import',

  // Customers
  customersList: 'customers:list',
  customersGet: 'customers:get',
  customersCreate: 'customers:create',
  customersUpdate: 'customers:update',
  customersDelete: 'customers:delete',

  // Suppliers
  suppliersList: 'suppliers:list',
  suppliersGet: 'suppliers:get',
  suppliersCreate: 'suppliers:create',
  suppliersUpdate: 'suppliers:update',
  suppliersDelete: 'suppliers:delete',

  // Transporters
  transportersList: 'transporters:list',
  transportersGet: 'transporters:get',
  transportersCreate: 'transporters:create',
  transportersUpdate: 'transporters:update',
  transportersDelete: 'transporters:delete',

  // Trades
  tradesList: 'trades:list',
  tradesGet: 'trades:get',
  tradesCreate: 'trades:create',
  tradesUpdate: 'trades:update',
  tradesDelete: 'trades:delete',
  tradesRecent: 'trades:recent',

  // Ledgers (debtors / creditors)
  ledgerDebtorsSummary: 'ledger:debtorsSummary',
  ledgerCreditorsSummary: 'ledger:creditorsSummary',
  ledgerDebtorsAging: 'ledger:debtorsAging',
  ledgerCreditorsAging: 'ledger:creditorsAging',
  ledgerPartyEntries: 'ledger:partyEntries',
  ledgerOpenInvoices: 'ledger:openInvoices',
  ledgerAllOpenInvoices: 'ledger:allOpenInvoices',
  ledgerAddReceipt: 'ledger:addReceipt',
  ledgerAddPayment: 'ledger:addPayment',
  ledgerUpdateEntry: 'ledger:updateEntry',
  ledgerDeleteEntry: 'ledger:deleteEntry',
  ledgerReceiptsPayments: 'ledger:receiptsPayments',

  // Purchases / Sales (line items across trades)
  purchasesList: 'purchases:list',
  salesList: 'sales:list',

  // Dashboard
  dashboardMetrics: 'dashboard:metrics',
  dashboardMonthlyPnl: 'dashboard:monthlyPnl',
  dashboardWhoToCall: 'dashboard:whoToCall',

  // Reports / export
  reportSummary: 'report:summary',
  reportExportExcel: 'report:exportExcel',
  reportReceiptsPaymentsExport: 'report:receiptsPaymentsExport',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
