import { getRawSqlite } from '../db';
import type { Settings } from '../../shared/db/schema';

export const readSettings = (): Settings => {
  const sqlite = getRawSqlite();
  const row = sqlite.prepare(`SELECT * FROM settings WHERE id = 1`).get() as Settings;
  return row;
};

export const updateSettings = (patch: Partial<Pick<Settings, 'theme' | 'businessName'>>): Settings => {
  const sqlite = getRawSqlite();
  if (patch.theme !== undefined) {
    sqlite.prepare(`UPDATE settings SET theme = ? WHERE id = 1`).run(patch.theme);
  }
  if (patch.businessName !== undefined) {
    sqlite.prepare(`UPDATE settings SET business_name = ? WHERE id = 1`).run(patch.businessName);
  }
  return readSettings();
};
