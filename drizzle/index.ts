import { APP_NAME } from "@/constants";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";

const expo = SQLite.openDatabaseSync(`${APP_NAME}.db`, {
  enableChangeListener: true,
});
export const db = drizzle(expo);
