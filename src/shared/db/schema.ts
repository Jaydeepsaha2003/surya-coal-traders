import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------------------
// Masters
// ---------------------------------------------------------------------------

export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  location: text('location'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  gstin: text('gstin'),
  creditPeriod: integer('credit_period').notNull().default(0), // days allowed to pay
  notes: text('notes'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text('deleted_at'),
});

export const suppliers = sqliteTable('suppliers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  location: text('location'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  gstin: text('gstin'),
  notes: text('notes'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text('deleted_at'),
});

export const transporters = sqliteTable('transporters', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  vehicleNo: text('vehicle_no'),
  location: text('location'),
  notes: text('notes'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text('deleted_at'),
});

// ---------------------------------------------------------------------------
// Trades — one lorry trip = purchase + sale, with auto P&L
// ---------------------------------------------------------------------------

export const trades = sqliteTable('trades', {
  id: text('id').primaryKey(),
  tradeNo: text('trade_no').notNull().unique(),
  date: text('date').notNull(), // yyyy-MM-dd
  lorryNo: text('lorry_no'),
  grade: text('grade'), // E | F | G | G11 | G12
  fromLocation: text('from_location'),
  toLocation: text('to_location'),
  totalPurchase: integer('total_purchase').notNull().default(0), // paise
  totalSale: integer('total_sale').notNull().default(0), // paise
  grossProfit: integer('gross_profit').notNull().default(0), // paise (sale - purchase)
  remarks: text('remarks'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text('deleted_at'),
});

// Purchase and sale line items live in one table, distinguished by `side`.
// A purchase row references a supplier; a sale row references a customer.
export const tradeItems = sqliteTable('trade_items', {
  id: text('id').primaryKey(),
  tradeId: text('trade_id')
    .notNull()
    .references(() => trades.id, { onDelete: 'cascade' }),
  side: text('side').notNull(), // 'purchase' | 'sale'
  partyId: text('party_id'), // supplier id (purchase) or customer id (sale)
  partyName: text('party_name'), // denormalized snapshot for display/export
  particulars: text('particulars'),
  location: text('location'),
  qtyTons: real('qty_tons').notNull().default(0),
  ratePerTon: integer('rate_per_ton').notNull().default(0), // paise
  amount: integer('amount').notNull().default(0), // paise
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// ---------------------------------------------------------------------------
// Unified ledger — debtors (customers) and creditors (suppliers)
// ---------------------------------------------------------------------------
// Sign convention:
//   Customer (debtor): sale -> debit (they owe us); receipt -> credit.
//     Outstanding receivable = sum(debit) - sum(credit).
//   Supplier (creditor): purchase -> credit (we owe them); payment -> debit.
//     Outstanding payable = sum(credit) - sum(debit).

export const ledgerEntries = sqliteTable('ledger_entries', {
  id: text('id').primaryKey(),
  partyType: text('party_type').notNull(), // 'customer' | 'supplier'
  partyId: text('party_id').notNull(),
  tradeId: text('trade_id').references(() => trades.id, { onDelete: 'cascade' }),
  entryType: text('entry_type').notNull(), // 'trade' | 'receipt' | 'payment'
  date: text('date').notNull(), // yyyy-MM-dd
  voucher: text('voucher').notNull(),
  description: text('description'),
  debit: integer('debit').notNull().default(0), // paise
  credit: integer('credit').notNull().default(0), // paise
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// Simple key/value settings (theme, etc.).
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey().default(1),
  theme: text('theme').notNull().default('dark'),
  businessName: text('business_name').notNull().default('Surya Coal Traders'),
});

export type Customer = typeof customers.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Transporter = typeof transporters.$inferSelect;
export type Trade = typeof trades.$inferSelect;
export type TradeItem = typeof tradeItems.$inferSelect;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type Settings = typeof settings.$inferSelect;
