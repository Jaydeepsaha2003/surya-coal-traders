import { addMonths, format, startOfMonth, subMonths } from 'date-fns';
import { getRawSqlite } from '../db';
import { debtorsSummary, creditorsSummary } from './ledger';
import type {
  DashboardMetrics,
  DateRange,
  MonthlyPnlPoint,
  ReportSummary,
  WhoToCallRow,
} from '../../shared/types';

// Build a SQL date filter fragment + params from an optional range.
const dateWhere = (range?: DateRange, col = 'date') => {
  const clauses: string[] = [];
  const params: string[] = [];
  if (range?.from) {
    clauses.push(`${col} >= ?`);
    params.push(range.from);
  }
  if (range?.to) {
    clauses.push(`${col} <= ?`);
    params.push(range.to);
  }
  return { sql: clauses.length ? ' AND ' + clauses.join(' AND ') : '', params };
};

export const dashboardMetrics = (): DashboardMetrics => {
  const sqlite = getRawSqlite();
  const receivable = debtorsSummary().summary.total;
  const payable = creditorsSummary().summary.total;

  const tradeCount = (
    sqlite.prepare(`SELECT COUNT(*) AS n FROM trades WHERE deleted_at IS NULL`).get() as {
      n: number;
    }
  ).n;

  const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
  const profitRow = sqlite
    .prepare(
      `SELECT COALESCE(SUM(gross_profit), 0) AS p
         FROM trades WHERE deleted_at IS NULL AND date >= ?`,
    )
    .get(monthStart) as { p: number };

  return {
    totalReceivable: receivable,
    totalPayable: payable,
    totalTrades: tradeCount,
    thisMonthProfit: profitRow.p,
  };
};

// Months covered by a range (capped at 60); falls back to the last 12 months.
const monthsFor = (range?: DateRange): Date[] => {
  if (range?.from && range?.to) {
    const months: Date[] = [];
    let cur = startOfMonth(new Date(range.from));
    const end = startOfMonth(new Date(range.to));
    let guard = 0;
    while (cur <= end && guard < 60) {
      months.push(cur);
      cur = addMonths(cur, 1);
      guard++;
    }
    return months.length ? months : [startOfMonth(new Date(range.from))];
  }
  const base = new Date();
  return Array.from({ length: 12 }, (_, i) => subMonths(base, 11 - i));
};

// Monthly sales, purchases and profit over a range (default: last 12 months).
export const monthlyPnl = (range?: DateRange): MonthlyPnlPoint[] => {
  const sqlite = getRawSqlite();
  const points: MonthlyPnlPoint[] = [];
  for (const d of monthsFor(range)) {
    const ym = format(d, 'yyyy-MM');
    const row = sqlite
      .prepare(
        `SELECT COALESCE(SUM(total_sale),0) AS sale,
                COALESCE(SUM(total_purchase),0) AS purchase,
                COALESCE(SUM(gross_profit),0) AS profit
           FROM trades
          WHERE deleted_at IS NULL AND SUBSTR(date,1,7) = ?`,
      )
      .get(ym) as { sale: number; purchase: number; profit: number };
    points.push({
      label: format(d, 'MMM yy'),
      sale: row.sale,
      purchase: row.purchase,
      profit: row.profit,
    });
  }
  return points;
};

export const reportSummary = (range?: DateRange): ReportSummary => {
  const sqlite = getRawSqlite();
  const f = dateWhere(range);
  const t = sqlite
    .prepare(
      `SELECT COALESCE(SUM(total_sale),0) AS sales,
              COALESCE(SUM(total_purchase),0) AS purchases,
              COALESCE(SUM(gross_profit),0) AS profit,
              COUNT(*) AS trades
         FROM trades WHERE deleted_at IS NULL${f.sql}`,
    )
    .get(...f.params) as { sales: number; purchases: number; profit: number; trades: number };
  const fq = dateWhere(range, 't.date');
  const qty = (
    sqlite
      .prepare(
        `SELECT COALESCE(SUM(qty_tons),0) AS q FROM trade_items ti
           JOIN trades t ON t.id = ti.trade_id
          WHERE ti.side = 'sale' AND t.deleted_at IS NULL${fq.sql}`,
      )
      .get(...fq.params) as { q: number }
  ).q;

  return {
    totalSales: t.sales,
    totalPurchases: t.purchases,
    totalProfit: t.profit,
    totalReceivable: debtorsSummary().summary.total,
    totalPayable: creditorsSummary().summary.total,
    totalTrades: t.trades,
    totalQtyTons: qty,
    avgProfitPerTrade: t.trades > 0 ? Math.round(t.profit / t.trades) : 0,
  };
};

// Top debtors to follow up with.
export const whoToCall = (limit = 6): WhoToCallRow[] =>
  debtorsSummary()
    .rows.slice(0, limit)
    .map((r) => ({
      partyId: r.partyId,
      name: r.name,
      phone: r.phone,
      outstanding: r.outstanding,
      ageDays: r.ageDays,
    }));
