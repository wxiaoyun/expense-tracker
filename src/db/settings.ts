import { db } from ".";

export type Setting<T = string> = Record<string, T>;

const listSettings = async () => {
  const result = await db.select("SELECT * FROM settings");

  console.info("[DB][listSettings] result %o", result);
  return result as Setting[];
};

const getSetting = async (key: string, defaultValue?: string) => {
  const result: Setting[] = await db.select(
    "SELECT * FROM settings WHERE key = $1",
    [key],
  );

  if (result.length === 0) {
    console.info(
      "[DB][getSetting] no result found for key %s, returning default",
      key,
    );
    return defaultValue;
  }

  console.info(
    "[DB][getSetting] result found for key %s, returning %s",
    key,
    result[0].value,
  );
  return result[0].value ?? defaultValue;
};

const setSetting = async <T = string>(key: string, value: T) => {
  const existing = await getSetting(key);

  const now = new Date().getTime();

  if (!existing) {
    console.info(
      "[DB][setSetting] no existing result found for key '%s', inserting",
      key,
    );
    const result = await db.execute(
      "INSERT INTO settings (key, value, created_at, updated_at) VALUES ($1, $2, $3, $4)",
      [key, value, now, now],
    );
    return result.rowsAffected === 1;
  }

  console.log(
    "[DB][setSetting] existing result found for key '%s', updating",
    key,
  );
  const result = await db.execute(
    "UPDATE settings SET value = $2, updated_at = $3 WHERE key = $1",
    [key, value, now],
  );
  console.info("[DB][setSetting] result %o", result);
  return result.rowsAffected === 1;
};

const clearSettings = async () => {
  const result = await db.execute("DELETE FROM settings");
  console.info("[DB][clearSettings] result %o", result);
  return result.rowsAffected > 0;
};

export default {
  list: listSettings,
  get: getSetting,
  set: setSetting,
  clear: clearSettings,
};
