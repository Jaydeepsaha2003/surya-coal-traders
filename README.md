# Surya Coal Traders

Local-first Windows desktop app for a coal trading business — trades (purchase + sale in one lorry trip with auto P&L), masters, debtor/creditor ledgers with aging, and dashboards. Built on Electron + Vite + React + TypeScript + better-sqlite3 + Drizzle + Tailwind/shadcn-ui (same stack as PolicyHub).

## Run

```bash
npm run dev        # Vite dev server + Electron (hot reload)
```

## Build & package

```bash
npm run build      # bundle renderer + compile Electron main
npm run package    # build a Windows NSIS installer (release/)
```

## Data

Stored locally in SQLite at `%APPDATA%/surya-coal-traders/surya_coal.db`. The schema is created automatically on first launch (no migration step). Money is stored as integer paise; quantities as tons.

## Structure

- `src/shared` — IPC channel names, types, Drizzle schema
- `src/main` — Electron main: DB bootstrap, repos (masters, trades, ledger, dashboard), IPC, Excel export
- `src/preload` — context-bridge API exposed as `window.surya`
- `src/renderer` — React UI (pages, shadcn/ui components, hash router)

## Notes

- A **Trade** records both the purchase and sale of one lorry trip; saving it auto-posts the sale to the customer's **Debtor** ledger and the purchase to the supplier's **Creditor** ledger.
- Aging buckets (0–30 / 31–60 / 61–90 / 90+) use FIFO allocation of receipts/payments against the oldest charges.
- `better-sqlite3` is a native module compiled for Electron 22's ABI. If `npm install` fails to build it (no MSVC toolchain), reuse a prebuilt `better_sqlite3.node` from a sibling project on the same Electron version, or run `npm run rebuild`.

_v1.0.0 — stock (buy-now-sell-later) is intentionally out of scope for v1; every trade has both a purchase and a sale._
