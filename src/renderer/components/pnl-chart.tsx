import { cn } from '@/lib/utils';
import type { MonthlyPnlPoint } from '@shared/types';

const formatShort = (paise: number): string => {
  const rupees = paise / 100;
  const abs = Math.abs(rupees);
  const sign = rupees < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs)}`;
};

export const PnlChart = ({ data, height = 240 }: { data: MonthlyPnlPoint[]; height?: number }) => {
  const max = Math.max(
    1,
    ...data.map((d) => Math.max(d.sale, d.purchase, Math.abs(d.profit))),
  );
  const barArea = height - 36;

  return (
    <div>
      <div className="flex items-end gap-3 overflow-x-auto pr-2" style={{ height }}>
        {data.map((d, i) => {
          const saleH = (d.sale / max) * barArea;
          const purchaseH = (d.purchase / max) * barArea;
          const profitH = (Math.abs(d.profit) / max) * barArea;
          return (
            <div
              key={`${d.label}-${i}`}
              className="flex min-w-[44px] flex-1 flex-col items-center justify-end gap-1"
            >
              <div
                className="flex w-full items-end justify-center gap-[3px]"
                style={{ height: barArea }}
                title={`Sale ${formatShort(d.sale)} · Purchase ${formatShort(d.purchase)} · Profit ${formatShort(d.profit)}`}
              >
                <div className="w-1/3 rounded-t-sm bg-emerald-500/80" style={{ height: saleH }} />
                <div className="w-1/3 rounded-t-sm bg-primary/70" style={{ height: purchaseH }} />
                <div
                  className={cn(
                    'w-1/3 rounded-t-sm',
                    d.profit >= 0 ? 'bg-sky-500/80' : 'bg-red-500/80',
                  )}
                  style={{ height: profitH }}
                />
              </div>
              <div className="w-full truncate text-center text-[10px] text-muted-foreground">
                {d.label}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <Legend swatch="bg-emerald-500/80" label="Sales" />
        <Legend swatch="bg-primary/70" label="Purchases" />
        <Legend swatch="bg-sky-500/80" label="Profit" />
      </div>
    </div>
  );
};

const Legend = ({ swatch, label }: { swatch: string; label: string }) => (
  <div className="flex items-center gap-1.5">
    <span className={cn('inline-block h-2.5 w-2.5 rounded-sm', swatch)} />
    <span>{label}</span>
  </div>
);
