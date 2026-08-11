type CopyAsync = (options: { from: string; to: string }) => Promise<void>;

export const backupLegacyDatabase = async (
  copyAsync: CopyAsync,
  legacyPath: string,
  backupDirectory: string,
  now = new Date(),
): Promise<string> => {
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const backupPath = `${backupDirectory}/legacy_backup_${timestamp}.db`;
  await copyAsync({ from: legacyPath, to: backupPath });
  return backupPath;
};
