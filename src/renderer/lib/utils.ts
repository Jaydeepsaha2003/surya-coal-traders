import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatCurrencyPaise = (paise: number | null | undefined) => {
  if (paise === null || paise === undefined) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
};

export const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

export const isoToday = () => new Date().toISOString().slice(0, 10);

export const paiseToRupees = (paise: number | null | undefined): number =>
  paise === null || paise === undefined ? 0 : paise / 100;

// Compact INR display: ₹1.2L, ₹2.3Cr, etc.
export const formatCurrencyCompactPaise = (paise: number | null | undefined): string => {
  if (paise === null || paise === undefined) return '—';
  const rupees = paise / 100;
  const abs = Math.abs(rupees);
  const sign = rupees < 0 ? '-' : '';
  if (abs < 1_000) return `₹${sign}${Math.round(rupees)}`;
  if (abs < 1_00_000) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(rupees);
  }
  if (abs < 1_00_00_000) {
    const lakhs = rupees / 1_00_000;
    return `₹${sign}${Math.abs(lakhs).toFixed(Math.abs(lakhs) >= 10 ? 1 : 2)}L`;
  }
  const crores = rupees / 1_00_00_000;
  return `₹${sign}${Math.abs(crores).toFixed(Math.abs(crores) >= 10 ? 1 : 2)}Cr`;
};
