import { getRawSqlite } from '../db';

export type ItemRow = {
  id: string;
  tradeId: string;
  tradeNo: string;
  date: string;
  lorryNo: string | null;
  grade: string | null;
  partyName: string | null;
  particulars: string | null;
  location: string | null;
  qtyTons: number;
  ratePerTon: number;
  amount: number;
};

const listItems = (side: 'purchase' | 'sale'): ItemRow[] => {
  const sqlite = getRawSqlite();
  return sqlite
    .prepare(
      `SELECT ti.id, ti.trade_id AS tradeId, t.trade_no AS tradeNo, t.date AS date,
              t.lorry_no AS lorryNo, t.grade AS grade,
              ti.party_name AS partyName, ti.particulars AS particulars,
              ti.location AS location, ti.qty_tons AS qtyTons,
              ti.rate_per_ton AS ratePerTon, ti.amount AS amount
         FROM trade_items ti
         JOIN trades t ON t.id = ti.trade_id
        WHERE ti.side = ? AND t.deleted_at IS NULL
        ORDER BY t.date DESC, t.trade_no DESC`,
    )
    .all(side) as ItemRow[];
};

export const listPurchaseItems = (): ItemRow[] => listItems('purchase');
export const listSaleItems = (): ItemRow[] => listItems('sale');
