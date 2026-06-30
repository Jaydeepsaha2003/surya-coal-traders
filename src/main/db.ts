import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../shared/db/schema';

let _db: BetterSQLite3Database<typeof schema> | null = null;
let _sqlite: Database.Database | null = null;
let _dbPath: string | null = null;

export const getDbPath = (): string => {
  if (_dbPath) return _dbPath;
  const dir = app.getPath('userData');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _dbPath = path.join(dir, 'surya_coal.db');
  return _dbPath;
};

export const getDb = () => {
  if (_db) return _db;
  const dbPath = getDbPath();
  _sqlite = new Database(dbPath);
  _sqlite.pragma('journal_mode = WAL');
  _sqlite.pragma('foreign_keys = ON');
  _db = drizzle(_sqlite, { schema });
  applySchema(_sqlite);
  return _db;
};

export const getRawSqlite = () => {
  if (!_sqlite) getDb();
  return _sqlite!;
};

export const closeDb = () => {
  try {
    _sqlite?.close();
  } catch (err) {
    console.error('[db] close failed', err);
  }
  _sqlite = null;
  _db = null;
};

// Inline schema bootstrap (CREATE TABLE IF NOT EXISTS) — keeps the app
// self-installing without a separate migration step.
const applySchema = (sqlite: Database.Database) => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      gstin TEXT,
      credit_period INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      gstin TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS transporters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      vehicle_no TEXT,
      location TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      trade_no TEXT NOT NULL UNIQUE,
      date TEXT NOT NULL,
      lorry_no TEXT,
      grade TEXT,
      from_location TEXT,
      to_location TEXT,
      total_purchase INTEGER NOT NULL DEFAULT 0,
      total_sale INTEGER NOT NULL DEFAULT 0,
      gross_profit INTEGER NOT NULL DEFAULT 0,
      remarks TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(date);

    CREATE TABLE IF NOT EXISTS trade_items (
      id TEXT PRIMARY KEY,
      trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
      side TEXT NOT NULL,
      party_id TEXT,
      party_name TEXT,
      particulars TEXT,
      location TEXT,
      qty_tons REAL NOT NULL DEFAULT 0,
      rate_per_ton INTEGER NOT NULL DEFAULT 0,
      amount INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_trade_items_trade ON trade_items(trade_id);

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id TEXT PRIMARY KEY,
      party_type TEXT NOT NULL,
      party_id TEXT NOT NULL,
      trade_id TEXT REFERENCES trades(id) ON DELETE CASCADE,
      entry_type TEXT NOT NULL,
      date TEXT NOT NULL,
      voucher TEXT NOT NULL,
      description TEXT,
      debit INTEGER NOT NULL DEFAULT 0,
      credit INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ledger_party ON ledger_entries(party_type, party_id, date);

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      theme TEXT NOT NULL DEFAULT 'dark',
      business_name TEXT NOT NULL DEFAULT 'Surya Coal Traders'
    );
    INSERT OR IGNORE INTO settings (id) VALUES (1);
  `);

  // Idempotent upgrade: databases created before credit_limit → credit_period
  // get the new column added so the app keeps working.
  addColumnIfMissing(sqlite, 'customers', 'credit_period', 'INTEGER NOT NULL DEFAULT 0');
};

const addColumnIfMissing = (
  sqlite: Database.Database,
  table: string,
  column: string,
  ddl: string,
) => {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.find((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
};
