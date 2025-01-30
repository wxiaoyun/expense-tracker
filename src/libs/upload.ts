import { db, reloadDb } from "@/db";
import { path } from "@tauri-apps/api";
import { download, upload } from "@tauri-apps/plugin-upload";

export type ProgressPayload = {
  progress: number;
  progressTotal: number;
  total: number;
  transferSpeed: number;
};
export type ProgressHandler = (progress: ProgressPayload) => void;

export const uploadDb = async ({
  url,
  headers,
  progressHandler,
  onSuccess = () => {},
  onError = () => {},
}: {
  url: string;
  headers?: Record<string, string>;
  progressHandler?: ProgressHandler;
  onSuccess?: (msg: string) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
}) => {
  try {
    const appDataDir = await path.appDataDir();
    const dbPath = await path.join(appDataDir, DATABASE_FILENAME);
    const headersMap = new Map(Object.entries(headers ?? {}));

    console.info("[UPLOAD] Initiating db upload to", url);

    await upload(url, dbPath, progressHandler, headersMap)
      .then(onSuccess)
      .catch(onError);

    console.info("[UPLOAD] Db upload completed");
    onSuccess("Db upload completed");
  } catch (error) {
    console.error("[UPLOAD] Failed to upload db %o", error);
    onError(error as Error);
  }
};

export const downloadDb = async ({
  url,
  headers,
  progressHandler,
  onSuccess = () => {},
  onError = () => {},
}: {
  url: string;
  headers?: Record<string, string>;
  progressHandler?: ProgressHandler;
  onSuccess?: (msg: string) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
}) => {
  try {
    const appDataDir = await path.appDataDir();
    const dbPath = await path.join(appDataDir, DATABASE_FILENAME);
    const headersMap = new Map(Object.entries(headers ?? {}));

    await db.close();
    await download(url, dbPath, progressHandler, headersMap);
    await reloadDb();

    console.info("[DOWNLOAD] Db download completed");
    onSuccess("Db download completed");
  } catch (error) {
    console.error("[DOWNLOAD] Failed to download db %o", error);
    onError(error as Error);
  }
};
