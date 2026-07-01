import { getRawSqlite } from '../db';
import type { Settings } from '../../shared/db/schema';

export const readSettings = (): Settings => {
  const sqlite = getRawSqlite();
  const row = sqlite.prepare(`SELECT * FROM settings WHERE id = 1`).get() as Settings;
  return row;
};

export const updateSettings = (
  patch: Partial<Pick<Settings, 'theme' | 'businessName' | 'bankOpeningBalance'>>,
): Settings => {
  const sqlite = getRawSqlite();
  if (patch.theme !== undefined) {
    sqlite.prepare(`UPDATE settings SET theme = ? WHERE id = 1`).run(patch.theme);
  }
  if (patch.businessName !== undefined) {
    sqlite.prepare(`UPDATE settings SET business_name = ? WHERE id = 1`).run(patch.businessName);
  }
  if (patch.bankOpeningBalance !== undefined) {
    sqlite
      .prepare(`UPDATE settings SET bank_opening_balance = ? WHERE id = 1`)
      .run(Math.round(patch.bankOpeningBalance));
  }
  return readSettings();
};
