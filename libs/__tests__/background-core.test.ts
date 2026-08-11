import { runBackupTask } from '../background-core';

describe('background backup worker', () => {
  it('reports success after simulated backup trigger', async () => {
    const backup = jest.fn().mockResolvedValue('/backup.db');
    await expect(runBackupTask(backup, 'success', 'failed')).resolves.toBe('success');
    expect(backup).toHaveBeenCalledTimes(1);
  });

  it('reports failure after simulated backup error', async () => {
    const backup = jest.fn().mockRejectedValue(new Error('disk full'));
    await expect(runBackupTask(backup, 'success', 'failed')).resolves.toBe('failed');
  });
});
