import { db } from ".";

export type Setting<T = string> = Record<string, T>;

const listSettings = async () => {
  const result = await db.select("SELECT * FROM settings");
  return result as Setting[];
};

const getSetting = async <T = string>(key: string) => {
  const result = await db.select("SELECT * FROM settings WHERE key = $1", [key]);
  return result as Setting<T>;
};

const setSetting = async <T = string>(key: string, value: T) => {
  const result = await db.execute(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)",
    [key, value],
  );
  return result.rowsAffected === 1;
};

export default {
  list: listSettings,
  get: getSetting,
  set: setSetting,
};
