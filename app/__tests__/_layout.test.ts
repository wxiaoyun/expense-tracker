const mockGet = jest.fn();
const mockProcessScheduledTemplates = jest.fn();
const mockReplace = jest.fn();

jest.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ get: mockGet }),
      }),
    }),
  },
}));
jest.mock('@/db/schema', () => ({ settings: { key: 'key' } }));
jest.mock('@/db/template', () => ({
  processScheduledTemplates: (...args: unknown[]) => mockProcessScheduledTemplates(...args),
}));
jest.mock('@/libs/preferences', () => ({ loadPreferences: jest.fn() }));
jest.mock('@/libs/background', () => ({}));
jest.mock('@/components/app-root', () => ({ AppRoot: jest.fn() }));
jest.mock('expo-router', () => ({
  Stack: Object.assign(jest.fn(), { Screen: jest.fn() }),
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  usePathname: jest.fn(() => '/'),
}));

// Jest mocks must be installed before this startup module is loaded.
// eslint-disable-next-line import/first
import { initializeApp } from '../_layout';

describe('application startup', () => {
  it('processes scheduled templates once and only after migration is verified', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    mockGet
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue({ value: '1' });
    mockProcessScheduledTemplates.mockResolvedValue([]);

    await initializeApp();
    expect(mockProcessScheduledTemplates).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/migrate');

    mockReplace.mockClear();
    await initializeApp();
    await initializeApp();

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockProcessScheduledTemplates).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      '[app.init][stage=process_templates] processing scheduled templates',
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
