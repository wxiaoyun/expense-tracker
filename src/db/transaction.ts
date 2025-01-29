import { nanoid } from "nanoid";
import { db } from ".";

export const withTransaction = async <TReturn>(fn: () => Promise<TReturn>) => {
  const uid = `"${nanoid()}"`;
  console.info("[DB][withTransaction] Creating savepoint %s", uid);

  try {
    await db.execute(`SAVEPOINT ${uid}`);
    console.info("[DB][withTransaction] Savepoint created %s", uid);

    const res = await fn();
    await db.execute(`RELEASE SAVEPOINT ${uid}`);
    console.info("[DB][withTransaction] Savepoint released %s", uid);

    return res;
  } catch (err) {
    await db.execute(`ROLLBACK TO SAVEPOINT ${uid}`);
    console.error(
      "[DB][withTransaction] Transaction failed %s, error: %o",
      uid,
      err,
    );
    throw err;
  }
};
