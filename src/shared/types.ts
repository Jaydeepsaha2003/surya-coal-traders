import type {
  Customer,
  LedgerEntry,
  Settings,
  Supplier,
  Trade,
  TradeItem,
  Transporter,
} from './db/schema';

export type { Customer, LedgerEntry, Settings, Supplier, Trade, TradeItem, Transporter };

export type CoalGrade = 'E' | 'F' | 'G' | 'G11' | 'G12';
export const COAL_GRADES: CoalGrade[] = ['E', 'F', 'G', 'G11', 'G12'];

// ----- Masters form inputs -----

export type CustomerFormInput = {
  name: string;
  location?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  creditPeriod?: number; // days the customer is allowed to take to pay
  notes?: string;
  openingBalance?: number; // rupees they owe you at start; converted to paise
  openingDate?: string; // yyyy-MM-dd
};

export type SupplierFormInput = {
  name: string;
  location?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  notes?: string;
  openingBalance?: number; // rupees you owe them at start; converted to paise
  openingDate?: string; // yyyy-MM-dd
};

export type TransporterFormInput = {
  name: string;
  phone?: string;
  vehicleNo?: string;
  location?: string;
  notes?: string;
};

// ----- Trade form input -----

export type TradeLineInput = {
  partyId?: string | null;
  partyName?: string | null;
  particulars?: string;
  location?: string;
  qtyTons: number;
  ratePerTon: number; // rupees from UI; converted to paise
};

export type TradeFormInput = {
  date: string; // yyyy-MM-dd
  lorryNo?: string;
  grade?: CoalGrade | '';
  fromLocation?: string;
  toLocation?: string;
  remarks?: string;
  purchaseItems: TradeLineInput[];
  saleItems: TradeLineInput[];
};

export type TradeWithItems = Trade & {
  purchaseItems: TradeItem[];
  saleItems: TradeItem[];
};

export type TradeRow = Trade & {
  supplierNames: string;
  customerNames: string;
};

// ----- Ledger -----

export type LedgerPartyType = 'customer' | 'supplier';

export type ReceiptPaymentInput = {
  partyId: string;
  date: string; // yyyy-MM-dd
  amount: number; // rupees from UI; converted to paise
  description?: string;
};

export type OutstandingRow = {
  partyId: string;
  name: string;
  location: string | null;
  phone: string | null;
  outstanding: number; // paise
  oldestUnpaidDate: string | null;
  ageDays: number | null;
};

export type AgingRow = {
  partyId: string;
  name: string;
  bucket0_30: number;
  bucket31_60: number;
  bucket61_90: number;
  bucket90Plus: number;
  total: number;
};

export type AgingSummary = {
  total: number;
  bucket0_30: number;
  bucket31_90: number;
  bucket90Plus: number;
};

export type LedgerLine = {
  date: string;
  voucher: string;
  description: string | null;
  debit: number;
  credit: number;
  balance: number; // running balance, paise (signed per party convention)
};

// ----- Dashboard -----

export type DateRange = { from?: string; to?: string };

export type DashboardMetrics = {
  totalReceivable: number; // paise
  totalPayable: number; // paise
  totalTrades: number;
  thisMonthProfit: number; // paise
};

export type MonthlyPnlPoint = {
  label: string; // e.g. "Jun 25"
  sale: number; // paise
  purchase: number; // paise
  profit: number; // paise
};

export type WhoToCallRow = {
  partyId: string;
  name: string;
  phone: string | null;
  outstanding: number; // paise
  ageDays: number | null;
};

export type ReportSummary = {
  totalSales: number; // paise (all time)
  totalPurchases: number;
  totalProfit: number;
  totalReceivable: number;
  totalPayable: number;
  totalTrades: number;
  totalQtyTons: number;
  avgProfitPerTrade: number;
};

// Currency helpers shared by renderer and main.
export const rupeesToPaise = (rupees: number): number => Math.round(rupees * 100);
export const paiseToRupees = (paise: number): number => paise / 100;
