import { CalendarRange, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

export type Range = { from: string; to: string };

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Indian financial year (Apr 1 – Mar 31) containing today.
const currentFy = (): Range => {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { from: `${y}-04-01`, to: `${y + 1}-03-31` };
};

const thisMonth = (): Range => {
  const n = new Date();
  return { from: iso(new Date(n.getFullYear(), n.getMonth(), 1)), to: iso(n) };
};

const last12 = (): Range => {
  const n = new Date();
  return { from: iso(new Date(n.getFullYear(), n.getMonth() - 11, 1)), to: iso(n) };
};

type Props = {
  value: Range;
  onChange: (r: Range) => void;
  presets?: boolean;
};

export const DateRangeFilter = ({ value, onChange, presets }: Props) => {
  const active = value.from || value.to;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarRange className="h-3.5 w-3.5" /> From
        </Label>
        <Input
          type="date"
          className="h-9 w-[150px]"
          value={value.from}
          max={value.to || undefined}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">To</Label>
        <Input
          type="date"
          className="h-9 w-[150px]"
          value={value.to}
          min={value.from || undefined}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
        />
      </div>

      {presets && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => onChange(thisMonth())}>
            This Month
          </Button>
          <Button variant="outline" size="sm" onClick={() => onChange(currentFy())}>
            This FY
          </Button>
          <Button variant="outline" size="sm" onClick={() => onChange(last12())}>
            Last 12M
          </Button>
          <Button variant="outline" size="sm" onClick={() => onChange({ from: '', to: '' })}>
            All Time
          </Button>
        </div>
      )}

      {active && !presets && (
        <Button variant="ghost" size="sm" onClick={() => onChange({ from: '', to: '' })}>
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      )}
    </div>
  );
};
