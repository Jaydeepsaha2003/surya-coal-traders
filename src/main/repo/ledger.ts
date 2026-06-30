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
  type OutstandingRow,
  type ReceiptPaymentInput,
} from '../../shared/types';

const today = () => format(new Date(), 'yyyy-MM-dd');

type RawEntry = {
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
      `SELECT date, voucher, description, debit, credit, created_at
         FROM ledger_entries
        WHERE party_type = ? AND party_id = ?
        ORDER BY date ASC, created_at ASC`,
    )
    .all(partyType, partyId) as RawEntry[];
};

// FIFO aging: apply payments to the oldest charges first; whatever charge
// amount is left unpaid is aged by its own date.
const computeAging = (entries: RawEntry[], chargeIsDebit: boolean) => {
  const charges = entries
    .map((e) => ({ date: e.date, amount: chargeIsDebit ? e.debit : e.credit }))
    .filter((c) => c.amount > 0);
  let payments = entries.reduce((s, e) => s + (chargeIsDebit ? e.credit : e.debit), 0);

  let b0_30 = 0;
  let b31_60 = 0;
  let b61_90 = 0;
  let b90 = 0;
  let oldestUnpaidDate: string | null = null;
  const now = today();

  for (const charge of charges) {
    let remaining = charge.amount;
    if (payments > 0) {
      const applied = Math.min(payments, remaining);
      remaining -= applied;
      payments -= applied;
    }
    if (remaining <= 0) continue;
    if (!oldestUnpaidDate) oldestUnpaidDate = charge.date;
    const age = differenceInCalendarDays(new Date(now), new Date(charge.date));
    if (age <= 30) b0_30 += remaining;
    else if (age <= 60) b31_60 += remaining;
    else if (age <= 90) b61_90 += remaining;
    else b90 += remaining;
  }

  const total = b0_30 + b31_60 + b61_90 + b90;
  return { b0_30, b31_60, b61_90, b90, total, oldestUnpaidDate };
};

const listPartyIds = (partyType: LedgerPartyType): { id: string; name: string; location: string | null; phone: string | null }[] => {
  const sqlite = getRawSqlite();
  const table = partyType === 'customer' ? 'customers' : 'suppliers';
  return sqlite
    .prepare(`SELECT id, name, location, phone FROM ${table} WHERE deleted_at IS NULL`)
    .all() as any[];
};

const outstandingFor = (partyType: LedgerPartyType): (OutstandingRow & {
  aging: ReturnType<typeof computeAging>;
})[] => {
  const chargeIsDebit = partyType === 'customer';
  return listPartyIds(partyType)
    .map((p) => {
      const entries = partyEntriesRaw(partyType, p.id);
      const aging = computeAging(entries, chargeIsDebit);
      const ageDays = aging.oldestUnpaidDate
        ? differenceInCalendarDays(new Date(today()), new Date(aging.oldestUnpaidDate))
        : null;
      return {
        partyId: p.id,
        name: p.name,
        location: p.location,
        phone: p.phone,
        outstanding: aging.total,
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
    total: data.reduce((s, r) => s + r.aging.total, 0),
    bucket0_30: data.reduce((s, r) => s + r.aging.b0_30, 0),
    bucket31_90: data.reduce((s, r) => s + r.aging.b31_60 + r.aging.b61_90, 0),
    bucket90Plus: data.reduce((s, r) => s + r.aging.b90, 0),
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
    total: r.aging.total,
  }));

export const partyLedger = (partyType: LedgerPartyType, partyId: string): LedgerLine[] => {
  const entries = partyEntriesRaw(partyType, partyId);
  let balance = 0;
  return entries.map((e) => {
    balance += partyType === 'customer' ? e.debit - e.credit : e.credit - e.debit;
    return {
      date: e.date,
      voucher: e.voucher,
      description: e.description,
      debit: e.debit,
      credit: e.credit,
      balance,
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

export const addReceipt = (input: ReceiptPaymentInput): string => {
  validateAmount(input.amount, input.date);
  const db = getDb();
  const id = uuid();
  db.insert(ledgerEntries)
    .values({
      id,
      partyType: 'customer',
      partyId: input.partyId,
      tradeId: null,
      entryType: 'receipt',
      date: input.date,
      voucher: nextVoucher('RCT'),
      description: input.description?.trim() || 'Payment received',
      debit: 0,
      credit: rupeesToPaise(input.amount),
    })
    .run();
  return id;
};

export const addPayment = (input: ReceiptPaymentInput): string => {
  validateAmount(input.amount, input.date);
  const db = getDb();
  const id = uuid();
  db.insert(ledgerEntries)
    .values({
      id,
      partyType: 'supplier',
      partyId: input.partyId,
      tradeId: null,
      entryType: 'payment',
      date: input.date,
      voucher: nextVoucher('PAY'),
      description: input.description?.trim() || 'Payment made',
      debit: rupeesToPaise(input.amount),
      credit: 0,
    })
    .run();
  return id;
};
