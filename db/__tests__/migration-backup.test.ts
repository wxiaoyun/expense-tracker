/** @jest-environment node */

import { backupLegacyDatabase } from '../migration-backup';

describe('legacy database backup', () => {
  it('copies source to timestamped backup path', async () => {
    const copyAsync = jest.fn().mockResolvedValue(undefined);

    const backupPath = await backupLegacyDatabase(
      copyAsync,
      '/databases/expense_tracker.db',
      '/databases',
      new Date('2026-08-11T00:00:00.000Z'),
    );

    expect(backupPath).toBe('/databases/legacy_backup_2026-08-11T00-00-00-000Z.db');
    expect(copyAsync).toHaveBeenCalledWith({
      from: '/databases/expense_tracker.db',
      to: backupPath,
    });
  });
});
