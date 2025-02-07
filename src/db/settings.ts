import { db, SETTINGS_TABLE, sql } from ".";

export type Setting<T = string> = Record<string, T>;

const listSettings = async () => {
  const builder = sql.select().from(SETTINGS_TABLE);

  const q = builder.toSQL().toNative();
  console.info("[DB][listSettings] query ", q);

  const result = await db.select(q.sql, q.bindings as unknown[]);
  console.info("[DB][listSettings] result %o", result);

  return result as Setting[];
};

const getSetting = async (key: string, defaultValue?: string) => {
  const builder = sql.select().from(SETTINGS_TABLE).where("key", key);

  const q = builder.toSQL().toNative();
  console.info("[DB][getSetting] query ", q);

  const result: Setting[] = await db.select(q.sql, q.bindings as unknown[]);

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

    const builder = sql
      .insert({
        key,
        value,
        created_at: now,
        updated_at: now,
      })
      .into(SETTINGS_TABLE);

    const q = builder.toSQL();
    console.info("[DB][setSetting] query ", q);

    const result = await db.execute(q.sql, q.bindings as unknown[]);
    return result.rowsAffected === 1;
  }

  console.log(
    "[DB][setSetting] existing result found for key '%s', updating",
    key,
  );

  const builder = sql
    .update({
      value,
      updated_at: now,
    })
    .from(SETTINGS_TABLE)
    .where("key", key);

  const q = builder.toSQL().toNative();
  console.info("[DB][setSetting] query ", q);

  const result = await db.execute(q.sql, q.bindings as unknown[]);
  console.info("[DB][setSetting] result %o", result);
  return result.rowsAffected === 1;
};

const clearSettings = async () => {
  const builder = sql.delete().from(SETTINGS_TABLE);

  const q = builder.toSQL().toNative();
  console.info("[DB][clearSettings] query ", q);

  const result = await db.execute(q.sql);
  console.info("[DB][clearSettings] result %o", result);
  return result.rowsAffected > 0;
};

export default {
  list: listSettings,
  get: getSetting,
  set: setSetting,
  clear: clearSettings,
};
