import { v4 as uuid } from 'uuid';
import { getDb, getRawSqlite } from '../db';
import { trades, tradeItems, ledgerEntries } from '../../shared/db/schema';
import { eq } from 'drizzle-orm';
import {
  rupeesToPaise,
  type TradeFormInput,
  type TradeLineInput,
  type TradeRow,
  type TradeWithItems,
} from '../../shared/types';

const now = () => new Date().toISOString();

// Next trade number, zero-padded. Counts every trade ever created so numbers
// are never reused even after a delete.
const nextTradeNo = (): string => {
  const sqlite = getRawSqlite();
  const row = sqlite
    .prepare(
      `SELECT MAX(CAST(SUBSTR(trade_no, INSTR(trade_no, '-') + 1) AS INTEGER)) AS n FROM trades`,
    )
    .get() as { n: number | null };
  const next = (row?.n ?? 0) + 1;
  return `T-${String(next).padStart(4, '0')}`;
};

const lineAmount = (line: TradeLineInput): number =>
  Math.round((Number(line.qtyTons) || 0) * rupeesToPaise(Number(line.ratePerTon) || 0));

export const listTrades = (search?: string): TradeRow[] => {
  const sqlite = getRawSqlite();
  const rows = sqlite
    .prepare(
      `SELECT t.*,
        (SELECT GROUP_CONCAT(DISTINCT ti.party_name)
           FROM trade_items ti
          WHERE ti.trade_id = t.id AND ti.side = 'purchase' AND ti.party_name IS NOT NULL) AS supplier_names,
        (SELECT GROUP_CONCAT(DISTINCT ti.party_name)
           FROM trade_items ti
          WHERE ti.trade_id = t.id AND ti.side = 'sale' AND ti.party_name IS NOT NULL) AS customer_names
       FROM trades t
      WHERE t.deleted_at IS NULL
      ORDER BY t.date DESC, t.trade_no DESC`,
    )
    .all() as any[];

  const mapped: TradeRow[] = rows.map((r) => ({
    id: r.id,
    tradeNo: r.trade_no,
    date: r.date,
    lorryNo: r.lorry_no,
    grade: r.grade,
    fromLocation: r.from_location,
    toLocation: r.to_location,
    totalPurchase: r.total_purchase,
    totalSale: r.total_sale,
    grossProfit: r.gross_profit,
    remarks: r.remarks,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    supplierNames: r.supplier_names ?? '',
    customerNames: r.customer_names ?? '',
  }));

  if (!search?.trim()) return mapped;
  const q = search.trim().toLowerCase();
  return mapped.filter((t) =>
    [t.tradeNo, t.lorryNo, t.fromLocation, t.toLocation, t.supplierNames, t.customerNames]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  );
};

export const recentTrades = (limit = 10): TradeRow[] => listTrades().slice(0, limit);

export const getTrade = (id: string): TradeWithItems | null => {
  const db = getDb();
  const trade = db.select().from(trades).where(eq(trades.id, id)).get();
  if (!trade) return null;
  const items = db.select().from(tradeItems).where(eq(tradeItems.tradeId, id)).all();
  return {
    ...trade,
    purchaseItems: items.filter((i) => i.side === 'purchase'),
    saleItems: items.filter((i) => i.side === 'sale'),
  };
};

// Aggregate item amounts by party so the ledger gets one clean voucher line
// per party per trade.
const groupByParty = (lines: TradeLineInput[]) => {
  const map = new Map<string, { name: string | null; amount: number }>();
  for (const line of lines) {
    if (!line.partyId) continue;
    const amount = lineAmount(line);
    if (amount <= 0) continue;
    const prev = map.get(line.partyId);
    if (prev) prev.amount += amount;
    else map.set(line.partyId, { name: line.partyName ?? null, amount });
  }
  return map;
};

export const createTrade = (input: TradeFormInput): string => {
  if (!input.date) throw new Error('Trade date is required');

  const id = uuid();
  const tradeNo = nextTradeNo();

  const purchaseRows = (input.purchaseItems ?? []).filter(
    (l) => (Number(l.qtyTons) || 0) > 0 || (Number(l.ratePerTon) || 0) > 0 || l.partyId,
  );
  const saleRows = (input.saleItems ?? []).filter(
    (l) => (Number(l.qtyTons) || 0) > 0 || (Number(l.ratePerTon) || 0) > 0 || l.partyId,
  );

  const totalPurchase = purchaseRows.reduce((s, l) => s + lineAmount(l), 0);
  const totalSale = saleRows.reduce((s, l) => s + lineAmount(l), 0);
  const grossProfit = totalSale - totalPurchase;

  const sqlite = getRawSqlite();
  const tx = sqlite.transaction(() => {
    const db = getDb();
    db.insert(trades)
      .values({
        id,
        tradeNo,
        date: input.date,
        lorryNo: input.lorryNo ?? null,
        grade: input.grade || null,
        fromLocation: input.fromLocation ?? null,
        toLocation: input.toLocation ?? null,
        totalPurchase,
        totalSale,
        grossProfit,
        remarks: input.remarks ?? null,
      })
      .run();

    const insertItem = (side: 'purchase' | 'sale', line: TradeLineInput) => {
      db.insert(tradeItems)
        .values({
          id: uuid(),
          tradeId: id,
          side,
          partyId: line.partyId ?? null,
          partyName: line.partyName ?? null,
          particulars: line.particulars ?? null,
          location: line.location ?? null,
          qtyTons: Number(line.qtyTons) || 0,
          ratePerTon: rupeesToPaise(Number(line.ratePerTon) || 0),
          amount: lineAmount(line),
        })
        .run();
    };
    purchaseRows.forEach((l) => insertItem('purchase', l));
    saleRows.forEach((l) => insertItem('sale', l));

    const routeDesc = [input.fromLocation, input.toLocation].filter(Boolean).join(' → ');

    // Purchase side -> credit each supplier (we owe them).
    for (const [partyId, info] of groupByParty(purchaseRows)) {
      db.insert(ledgerEntries)
        .values({
          id: uuid(),
          partyType: 'supplier',
          partyId,
          tradeId: id,
          entryType: 'trade',
          date: input.date,
          voucher: tradeNo,
          description: `Purchase${routeDesc ? ' · ' + routeDesc : ''}`,
          debit: 0,
          credit: info.amount,
        })
        .run();
    }

    // Sale side -> debit each customer (they owe us).
    for (const [partyId, info] of groupByParty(saleRows)) {
      db.insert(ledgerEntries)
        .values({
          id: uuid(),
          partyType: 'customer',
          partyId,
          tradeId: id,
          entryType: 'trade',
          date: input.date,
          voucher: tradeNo,
          description: `Sale${routeDesc ? ' · ' + routeDesc : ''}`,
          debit: info.amount,
          credit: 0,
        })
        .run();
    }
  });
  tx();
  return id;
};

// Hard delete — cascades to trade_items and the trade's ledger postings,
// keeping debtor/creditor balances correct. Receipts/payments (trade_id NULL)
// are untouched.
export const deleteTrade = (id: string) => {
  const db = getDb();
  db.delete(trades).where(eq(trades.id, id)).run();
};
