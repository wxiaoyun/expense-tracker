const mockGet = jest.fn();
const mockProcessScheduledTemplates = jest.fn();
const mockReplace = jest.fn();
const mockLoadPreferences = jest.fn();
const mockResetPreferencesToDefaults = jest.fn();

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
jest.mock('@/libs/preferences', () => ({
  loadPreferences: (...args: unknown[]) => mockLoadPreferences(...args),
  resetPreferencesToDefaults: (...args: unknown[]) => mockResetPreferencesToDefaults(...args),
  preferenceStore: {},
}));
jest.mock('@/libs/background', () => ({}));
jest.mock('@/components/app-root', () => ({ AppRoot: jest.fn() }));
jest.mock('expo-router', () => ({
  Stack: Object.assign(jest.fn(), { Screen: jest.fn() }),
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  usePathname: jest.fn(() => '/'),
}));

// Jest mocks must be installed before this startup module is loaded.
// eslint-disable-next-line import/first
import {
  appQueryClient,
  initializeApp,
  processLaunchTemplatesOnce,
  reinitializeAppRuntime,
  resetLaunchTemplateProcessing,
} from '../_layout';

describe('application startup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it('coalesces concurrent launch processing into one scheduler invocation', async () => {
    await resetLaunchTemplateProcessing();
    let release: (() => void) | undefined;
    mockProcessScheduledTemplates.mockImplementationOnce(() => new Promise<void>((resolve) => {
      release = resolve;
    }));

    const first = processLaunchTemplatesOnce();
    const second = processLaunchTemplatesOnce();
    expect(mockProcessScheduledTemplates).toHaveBeenCalledTimes(1);

    release?.();
    await Promise.all([first, second]);
    expect(mockProcessScheduledTemplates).toHaveBeenCalledTimes(1);
  });

  it('reinitializes reset and imported runtime state in order', async () => {
    await resetLaunchTemplateProcessing();
    const clear = jest.spyOn(appQueryClient, 'clear');
    mockProcessScheduledTemplates.mockResolvedValue([]);

    await reinitializeAppRuntime();
    expect(clear).toHaveBeenCalledTimes(1);
    expect(mockResetPreferencesToDefaults).toHaveBeenCalledTimes(1);
    expect(mockLoadPreferences).toHaveBeenCalledTimes(1);
    expect(mockResetPreferencesToDefaults.mock.calls[0][0]).toBe(mockLoadPreferences.mock.calls[0][0]);
    expect(mockProcessScheduledTemplates).not.toHaveBeenCalled();

    jest.clearAllMocks();
    await reinitializeAppRuntime({ processImportedSchedules: true });
    expect(clear).toHaveBeenCalledTimes(1);
    expect(mockResetPreferencesToDefaults).toHaveBeenCalledTimes(1);
    expect(mockLoadPreferences).toHaveBeenCalledTimes(1);
    expect(mockResetPreferencesToDefaults.mock.calls[0][0]).toBe(mockLoadPreferences.mock.calls[0][0]);
    expect(mockProcessScheduledTemplates).toHaveBeenCalledTimes(1);

    clear.mockRestore();
  });
});
