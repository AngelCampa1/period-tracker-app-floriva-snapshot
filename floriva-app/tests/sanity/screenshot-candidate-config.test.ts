import buildExpoConfig from '@/app.config';
import type { ConfigContext } from 'expo/config';

const environment = process.env as Record<string, string | undefined>;

describe('screenshot candidate Expo config', () => {
  const originalCaptureFlag = environment.FLORIVA_SCREENSHOT_CANDIDATE;
  const originalPreset = environment.EXPO_PUBLIC_DEV_LAUNCH_PRESET;

  afterEach(() => {
    if (originalCaptureFlag === undefined) {
      delete environment.FLORIVA_SCREENSHOT_CANDIDATE;
    } else {
      environment.FLORIVA_SCREENSHOT_CANDIDATE = originalCaptureFlag;
    }
    if (originalPreset === undefined) {
      delete environment.EXPO_PUBLIC_DEV_LAUNCH_PRESET;
    } else {
      environment.EXPO_PUBLIC_DEV_LAUNCH_PRESET = originalPreset;
    }
  });

  it('omits the compiled capture gate from ordinary release config', () => {
    delete environment.FLORIVA_SCREENSHOT_CANDIDATE;
    environment.EXPO_PUBLIC_DEV_LAUNCH_PRESET = 'qa-rich-history';

    const config = buildExpoConfig({ config: {} } as ConfigContext);

    expect(config.extra).not.toHaveProperty('screenshotCandidateEnabled');
  });

  it('bakes the capture gate only when the dedicated build flag is exact', () => {
    environment.FLORIVA_SCREENSHOT_CANDIDATE = '1';
    environment.EXPO_PUBLIC_DEV_LAUNCH_PRESET = 'qa-rich-history';

    const config = buildExpoConfig({ config: {} } as ConfigContext);

    expect(config.extra).toEqual(
      expect.objectContaining({
        screenshotCandidateEnabled: true,
        devLaunchPreset: 'qa-rich-history',
      }),
    );
  });
});
