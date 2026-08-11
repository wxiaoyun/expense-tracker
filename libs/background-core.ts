export async function runBackupTask<T>(backup: () => Promise<unknown>, success: T, failed: T, onError?: (error: unknown) => void): Promise<T> {
  try {
    await backup();
    return success;
  } catch (error) {
    onError?.(error);
    return failed;
  }
}
