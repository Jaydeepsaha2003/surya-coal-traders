import { v4 as uuid } from 'uuid';
import { differenceInCalendarDays, format } from 'date-fns';
import { getDb, getRawSqlite } from '../db';
import { ledgerEntries } from '../../shared/db/schema';
import {
  rupeesToPaise,
  type AgingRow,
  type AgingSummary,
  type LedgerLine,
  type LedgerPartyType,
  type OpenInvoice,
  type OutstandingRow,
  type ReceiptPaymentInput,
} from '../../shared/types';

const today = () => format(new Date(), 'yyyy-MM-dd');

type RawEntry = {
  id: string;
  entryType: string;
  date: string;
  voucher: string;
  description: string | null;
  debit: number;
  credit: number;
  created_at: string;
};

const partyEntriesRaw = (partyType: LedgerPartyType, partyId: string): RawEntry[] => {
  const sqlite = getRawSqlite();
  return sqlite
    .prepare(
      `SELECT id, entry_type AS entryType, date, voucher, description, debit, credit, created_at
         FROM ledger_entries
        WHERE party_type = ? AND party_id = ?
        ORDER BY date ASC, created_at ASC`,
    )
    .all(partyType, partyId) as RawEntry[];
};

// Open (unsettled) invoices/bills, oldest first. A charge is a customer debit
// (sale/opening) or a supplier credit (purchase/opening); remaining = original
// − allocations against it. Pass a partyId to scope to one party, or omit for
// every party of that type (used by the Reports drill-down).
const openInvoicesInternal = (partyType: LedgerPartyType, partyId?: string): OpenInvoice[] => {
  const sqlite = getRawSqlite();
  const chargeCol = partyType === 'customer' ? 'debit' : 'credit';
  const table = partyType === 'customer' ? 'customers' : 'suppliers';
  const clauses = [`le.party_type = ?`, `le.${chargeCol} > 0`, `p.deleted_at IS NULL`];
  const params: string[] = [partyType];
  if (partyId) {
    clauses.push(`le.party_id = ?`);
    params.push(partyId);
  }
  const rows = sqlite
    .prepare(
      `SELECT le.id AS entryId, le.party_id AS partyId, p.name AS partyName,
              le.date, le.voucher, le.description, le.${chargeCol} AS amount,
              COALESCE((SELECT SUM(a.amount) FROM allocations a WHERE a.invoice_entry_id = le.id), 0) AS allocated
         FROM ledger_entries le
         JOIN ${table} p ON p.id = le.party_id
        WHERE ${clauses.join(' AND ')}
        ORDER BY le.date ASC, le.created_at ASC`,
    )
    .all(...params) as any[];
  const now = today();
  return rows
    .map((r) => ({
      entryId: r.entryId,
      partyId: r.partyId,
      partyName: r.partyName,
      date: r.date,
      voucher: r.voucher,
      description: r.description,
      amount: r.amount,
      allocated: r.allocated,
      remaining: r.amount - r.allocated,
      ageDays: differenceInCalendarDays(new Date(now), new Date(r.date)),
    }))
    .filter((r) => r.remaining > 0);
};

export const openInvoices = (partyType: LedgerPartyType, partyId: string): OpenInvoice[] =>
  openInvoicesInternal(partyType, partyId);

// Every open invoice/bill of a party type, newest-age first — for the Reports
// receivable/payable drill-down.
export const allOpenInvoices = (partyType: LedgerPartyType): OpenInvoice[] =>
  openInvoicesInternal(partyType).sort((a, b) => b.ageDays - a.ageDays);

// paymentEntryId -> total allocated (paise), for one party.
const allocatedByPayment = (
  partyType: LedgerPartyType,
  partyId: string,
): Record<string, number> => {
  const sqlite = getRawSqlite();
  const rows = sqlite
    .prepare(
      `SELECT a.payment_entry_id AS pid, SUM(a.amount) AS amt
         FROM allocations a
         JOIN ledger_entries le ON le.id = a.payment_entry_id
        WHERE le.party_type = ? AND le.party_id = ?
        GROUP BY a.payment_entry_id`,
    )
    .all(partyType, partyId) as { pid: string; amt: number }[];
  const map: Record<string, number> = {};
  for (const r of rows) map[r.pid] = r.amt;
  return map;
};

type PartyAging = {
  b0_30: number;
  b31_60: number;
  b61_90: number;
  b90: number;
  grossOpen: number;
  net: number;
  advance: number;
  oldestUnpaidDate: string | null;
};

// Aging from explicit allocations: each open invoice's remaining is aged by
// its own date. `net` = total charges − total payments; `advance` = payments
// not applied to any invoice (on-account/advance money held).
const partyAging = (partyType: LedgerPartyType, partyId: string): PartyAging => {
  const invs = openInvoices(partyType, partyId);
  const now = today();
  let b0_30 = 0;
  let b31_60 = 0;
  let b61_90 = 0;
  let b90 = 0;
  let oldestUnpaidDate: string | null = null;
  for (const inv of invs) {
    if (!oldestUnpaidDate) oldestUnpaidDate = inv.date;
    const age = differenceInCalendarDays(new Date(now), new Date(inv.date));
    if (age <= 30) b0_30 += inv.remaining;
    else if (age <= 60) b31_60 += inv.remaining;
    else if (age <= 90) b61_90 += inv.remaining;
    else b90 += inv.remaining;
  }
  const grossOpen = b0_30 + b31_60 + b61_90 + b90;
  const chargeCol = partyType === 'customer' ? 'debit' : 'credit';
  const payCol = partyType === 'customer' ? 'credit' : 'debit';
  const sqlite = getRawSqlite();
  const sums = sqlite
    .prepare(
      `SELECT COALESCE(SUM(${chargeCol}),0) AS charge, COALESCE(SUM(${payCol}),0) AS pay
         FROM ledger_entries WHERE party_type = ? AND party_id = ?`,
    )
    .get(partyType, partyId) as { charge: number; pay: number };
  const net = sums.charge - sums.pay;
  const advance = grossOpen - net; // payments not applied to open invoices
  return { b0_30, b31_60, b61_90, b90, grossOpen, net, advance, oldestUnpaidDate };
};

const listPartyIds = (partyType: LedgerPartyType): { id: string; name: string; location: string | null; phone: string | null }[] => {
  const sqlite = getRawSqlite();
  const table = partyType === 'customer' ? 'customers' : 'suppliers';
  return sqlite
    .prepare(`SELECT id, name, location, phone FROM ${table} WHERE deleted_at IS NULL`)
    .all() as any[];
};

// Total unapplied receipts/payments held for a party type (advance money).
const advanceTotalFor = (partyType: LedgerPartyType): number => {
  const sqlite = getRawSqlite();
  const payCol = partyType === 'customer' ? 'credit' : 'debit';
  const pay = (
    sqlite
      .prepare(`SELECT COALESCE(SUM(${payCol}),0) AS p FROM ledger_entries WHERE party_type = ?`)
      .get(partyType) as { p: number }
  ).p;
  const alloc = (
    sqlite
      .prepare(
        `SELECT COALESCE(SUM(a.amount),0) AS a FROM allocations a
           JOIN ledger_entries le ON le.id = a.payment_entry_id
          WHERE le.party_type = ?`,
      )
      .get(partyType) as { a: number }
  ).a;
  return Math.max(0, pay - alloc);
};

const outstandingFor = (partyType: LedgerPartyType): (OutstandingRow & {
  aging: PartyAging;
})[] => {
  return listPartyIds(partyType)
    .map((p) => {
      const aging = partyAging(partyType, p.id);
      const ageDays = aging.oldestUnpaidDate
        ? differenceInCalendarDays(new Date(today()), new Date(aging.oldestUnpaidDate))
        : null;
      return {
        partyId: p.id,
        name: p.name,
        location: p.location,
        phone: p.phone,
        outstanding: aging.net,
        oldestUnpaidDate: aging.oldestUnpaidDate,
        ageDays,
        aging,
      };
    })
    .filter((r) => r.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding);
};

export const debtorsSummary = (): { rows: OutstandingRow[]; summary: AgingSummary } =>
  buildSummary('customer');
export const creditorsSummary = (): { rows: OutstandingRow[]; summary: AgingSummary } =>
  buildSummary('supplier');

const buildSummary = (partyType: LedgerPartyType) => {
  const data = outstandingFor(partyType);
  const rows: OutstandingRow[] = data.map(({ aging, ...r }) => r);
  const summary: AgingSummary = {
    total: data.reduce((s, r) => s + r.aging.net, 0),
    bucket0_30: data.reduce((s, r) => s + r.aging.b0_30, 0),
    bucket31_90: data.reduce((s, r) => s + r.aging.b31_60 + r.aging.b61_90, 0),
    bucket90Plus: data.reduce((s, r) => s + r.aging.b90, 0),
    advance: advanceTotalFor(partyType),
  };
  return { rows, summary };
};

export const debtorsAging = (): AgingRow[] => buildAging('customer');
export const creditorsAging = (): AgingRow[] => buildAging('supplier');

const buildAging = (partyType: LedgerPartyType): AgingRow[] =>
  outstandingFor(partyType).map((r) => ({
    partyId: r.partyId,
    name: r.name,
    bucket0_30: r.aging.b0_30,
    bucket31_60: r.aging.b31_60,
    bucket61_90: r.aging.b61_90,
    bucket90Plus: r.aging.b90,
    total: r.aging.grossOpen,
  }));

export const partyLedger = (partyType: LedgerPartyType, partyId: string): LedgerLine[] => {
  const entries = partyEntriesRaw(partyType, partyId);
  const alloc = allocatedByPayment(partyType, partyId);
  let balance = 0;
  return entries.map((e) => {
    balance += partyType === 'customer' ? e.debit - e.credit : e.credit - e.debit;
    const isPayment = e.entryType === 'receipt' || e.entryType === 'payment';
    const payAmount = partyType === 'customer' ? e.credit : e.debit;
    const advance = isPayment ? Math.max(0, payAmount - (alloc[e.id] ?? 0)) : 0;
    return {
      id: e.id,
      date: e.date,
      voucher: e.voucher,
      description: e.description,
      debit: e.debit,
      credit: e.credit,
      balance,
      entryType: e.entryType,
      advance,
    };
  });
};

const nextVoucher = (prefix: string): string => {
  const sqlite = getRawSqlite();
  const row = sqlite
    .prepare(
      `SELECT MAX(CAST(SUBSTR(voucher, INSTR(voucher, '-') + 1) AS INTEGER)) AS n
         FROM ledger_entries WHERE voucher LIKE ?`,
    )
    .get(`${prefix}-%`) as { n: number | null };
  return `${prefix}-${String((row?.n ?? 0) + 1).padStart(4, '0')}`;
};

// Opening balance is stored as a single 'opening' ledger entry per party.
// Customer (debtor): they owe us -> debit. Supplier (creditor): we owe them -> credit.
// It flows into outstanding + aging automatically (aged from the opening date).
export const setOpeningBalance = (
  partyType: LedgerPartyType,
  partyId: string,
  amountRupees: number,
  date?: string,
) => {
  const sqlite = getRawSqlite();
  // Clear any existing opening entry first so this is idempotent (editable).
  sqlite
    .prepare(`DELETE FROM ledger_entries WHERE party_type = ? AND party_id = ? AND entry_type = 'opening'`)
    .run(partyType, partyId);
  if (!amountRupees || amountRupees <= 0) return;
  const amount = rupeesToPaise(amountRupees);
  const db = getDb();
  db.insert(ledgerEntries)
    .values({
      id: uuid(),
      partyType,
      partyId,
      tradeId: null,
      entryType: 'opening',
      date: date || today(),
      voucher: 'OPENING',
      description: 'Opening balance',
      debit: partyType === 'customer' ? amount : 0,
      credit: partyType === 'supplier' ? amount : 0,
    })
    .run();
};

export const getOpeningBalance = (
  partyType: LedgerPartyType,
  partyId: string,
): { amount: number; date: string | null } => {
  const sqlite = getRawSqlite();
  const row = sqlite
    .prepare(
      `SELECT debit, credit, date FROM ledger_entries
        WHERE party_type = ? AND party_id = ? AND entry_type = 'opening' LIMIT 1`,
    )
    .get(partyType, partyId) as { debit: number; credit: number; date: string } | undefined;
  if (!row) return { amount: 0, date: null };
  return { amount: partyType === 'customer' ? row.debit : row.credit, date: row.date };
};

// Map of partyId -> opening balance (paise) + date, for list views.
export const openingBalancesMap = (
  partyType: LedgerPartyType,
): Record<string, { amount: number; date: string }> => {
  const sqlite = getRawSqlite();
  const rows = sqlite
    .prepare(
      `SELECT party_id, debit, credit, date FROM ledger_entries
        WHERE party_type = ? AND entry_type = 'opening'`,
    )
    .all(partyType) as { party_id: string; debit: number; credit: number; date: string }[];
  const map: Record<string, { amount: number; date: string }> = {};
  for (const r of rows) {
    map[r.party_id] = { amount: partyType === 'customer' ? r.debit : r.credit, date: r.date };
  }
  return map;
};

const validateAmount = (amount: number, date: string) => {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero');
  if (date > today()) throw new Error("Date can't be in the future");
};

// Create allocation rows for a receipt/payment according to the clearing mode.
// Any amount left unallocated (advance, or leftover after clearing all
// invoices) simply stays unlinked — that is the "advance" balance.
const applyClearing = (
  paymentEntryId: string,
  partyType: LedgerPartyType,
  partyId: string,
  amountPaise: number,
  mode: 'bill_to_bill' | 'on_account' | 'advance',
  allocInputs?: { invoiceEntryId: string; amount: number }[],
) => {
  if (mode === 'advance') return;
  const invoices = openInvoices(partyType, partyId);
  if (invoices.length === 0) return; // no invoices -> automatically an advance

  const sqlite = getRawSqlite();
  const insert = sqlite.prepare(
    `INSERT INTO allocations (id, payment_entry_id, invoice_entry_id, amount) VALUES (?, ?, ?, ?)`,
  );

  let remainingPay = amountPaise;
  if (mode === 'bill_to_bill') {
    for (const a of allocInputs ?? []) {
      if (remainingPay <= 0) break;
      const inv = invoices.find((i) => i.entryId === a.invoiceEntryId);
      if (!inv) continue;
      const amt = Math.min(rupeesToPaise(a.amount), inv.remaining, remainingPay);
      if (amt <= 0) continue;
      insert.run(uuid(), paymentEntryId, inv.entryId, amt);
      remainingPay -= amt;
    }
  } else {
    // on_account — FIFO across oldest open invoices; leftover becomes advance.
    for (const inv of invoices) {
      if (remainingPay <= 0) break;
      const amt = Math.min(inv.remaining, remainingPay);
      if (amt <= 0) continue;
      insert.run(uuid(), paymentEntryId, inv.entryId, amt);
      remainingPay -= amt;
    }
  }
};

const postEntry = (
  partyType: LedgerPartyType,
  entryType: 'receipt' | 'payment',
  prefix: string,
  input: ReceiptPaymentInput,
): string => {
  validateAmount(input.amount, input.date);
  const amount = rupeesToPaise(input.amount);
  const isCustomer = partyType === 'customer';
  const id = uuid();
  const db = getDb();
  const sqlite = getRawSqlite();
  const tx = sqlite.transaction(() => {
    db.insert(ledgerEntries)
      .values({
        id,
        partyType,
        partyId: input.partyId,
        tradeId: null,
        entryType,
        date: input.date,
        voucher: nextVoucher(prefix),
        description: input.description?.trim() || (isCustomer ? 'Payment received' : 'Payment made'),
        debit: isCustomer ? 0 : amount,
        credit: isCustomer ? amount : 0,
      })
      .run();
    applyClearing(id, partyType, input.partyId, amount, input.mode ?? 'on_account', input.allocations);
  });
  tx();
  return id;
};

export const addReceipt = (input: ReceiptPaymentInput): string =>
  postEntry('customer', 'receipt', 'RCT', input);

export const addPayment = (input: ReceiptPaymentInput): string =>
  postEntry('supplier', 'payment', 'PAY', input);

// Edit a receipt/payment: update date/amount/description, then re-clear the
// (new) amount on-account FIFO. Old allocations are dropped first.
export const updateReceiptPayment = (input: {
  entryId: string;
  date: string;
  amount: number;
  description?: string;
}) => {
  validateAmount(input.amount, input.date);
  const sqlite = getRawSqlite();
  const entry = sqlite
    .prepare(`SELECT party_type AS partyType, party_id AS partyId, entry_type AS entryType FROM ledger_entries WHERE id = ?`)
    .get(input.entryId) as { partyType: LedgerPartyType; partyId: string; entryType: string } | undefined;
  if (!entry) throw new Error('Entry not found');
  if (entry.entryType !== 'receipt' && entry.entryType !== 'payment') {
    throw new Error('Only receipts and payments can be edited here');
  }
  const amount = rupeesToPaise(input.amount);
  const isCustomer = entry.partyType === 'customer';
  const tx = sqlite.transaction(() => {
    sqlite.prepare(`DELETE FROM allocations WHERE payment_entry_id = ?`).run(input.entryId);
    sqlite
      .prepare(
        `UPDATE ledger_entries SET date = ?, description = ?, debit = ?, credit = ? WHERE id = ?`,
      )
      .run(
        input.date,
        input.description?.trim() || (isCustomer ? 'Payment received' : 'Payment made'),
        isCustomer ? 0 : amount,
        isCustomer ? amount : 0,
        input.entryId,
      );
    applyClearing(input.entryId, entry.partyType, entry.partyId, amount, 'on_account', undefined);
  });
  tx();
};

// Delete a receipt/payment (its allocations cascade away).
export const deleteLedgerEntry = (entryId: string) => {
  const sqlite = getRawSqlite();
  const entry = sqlite
    .prepare(`SELECT entry_type AS entryType FROM ledger_entries WHERE id = ?`)
    .get(entryId) as { entryType: string } | undefined;
  if (!entry) return;
  if (entry.entryType !== 'receipt' && entry.entryType !== 'payment') {
    throw new Error('Only receipts and payments can be deleted here');
  }
  sqlite.prepare(`DELETE FROM ledger_entries WHERE id = ?`).run(entryId);
};

// Receipts (from customers) and payments (to suppliers) for the day-book /
// summary export, optionally within a date range.
export const receiptsPaymentsRows = (range?: {
  from?: string;
  to?: string;
}): import('../../shared/types').ReceiptPaymentRow[] => {
  const sqlite = getRawSqlite();
  const clauses = [`le.entry_type IN ('receipt','payment')`];
  const params: string[] = [];
  if (range?.from) {
    clauses.push(`le.date >= ?`);
    params.push(range.from);
  }
  if (range?.to) {
    clauses.push(`le.date <= ?`);
    params.push(range.to);
  }
  const rows = sqlite
    .prepare(
      `SELECT le.id, le.date, le.voucher, le.entry_type AS entryType, le.description,
              le.debit, le.credit, le.party_type AS partyType,
              COALESCE(c.name, s.name) AS partyName
         FROM ledger_entries le
         LEFT JOIN customers c ON c.id = le.party_id AND le.party_type = 'customer'
         LEFT JOIN suppliers s ON s.id = le.party_id AND le.party_type = 'supplier'
        WHERE ${clauses.join(' AND ')}
        ORDER BY le.date ASC, le.created_at ASC`,
    )
    .all(...params) as any[];
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    voucher: r.voucher,
    kind: r.entryType === 'receipt' ? 'receipt' : 'payment',
    partyName: r.partyName ?? '—',
    description: r.description,
    amount: r.entryType === 'receipt' ? r.credit : r.debit,
  }));
};
