import {
  defaultAppPreferences,
  defaultUserProfile,
} from '@/src/db/domainDefaults';

describe('defaultAppPreferences', () => {
  it('enables fertility estimates and haptics while keeping tap sounds off by default', () => {
    expect(defaultAppPreferences).toEqual(
      expect.objectContaining({
        showFertilityEstimates: true,
        hapticsEnabled: true,
        tapSoundEnabled: false,
      }),
    );
  });
});

describe('defaultUserProfile', () => {
  it('starts with trying-to-conceive tracking preferences disabled', () => {
    expect((defaultUserProfile as any).ttcTrackingPreferences).toEqual({
      sex: false,
      ovulationTest: false,
      cervicalMucus: false,
      basalBodyTemperature: false,
    });
  });
});
