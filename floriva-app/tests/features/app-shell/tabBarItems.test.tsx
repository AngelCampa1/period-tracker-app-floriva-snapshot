import { tabBarItems } from '@/src/features/app-shell/tabBarItems';

describe('tabBarItems', () => {
  it('defines the four tabs in order', () => {
    expect(tabBarItems.map((item) => item.routeName)).toEqual([
      'today',
      'calendar',
      'insights',
      'settings',
    ]);
  });

  it('maps each tab to a localization key and platform icons', () => {
    const today = tabBarItems.find((item) => item.routeName === 'today');
    expect(today).toBeDefined();
    expect(today?.labelKey).toBe('navigation.tabs.today');
    expect(today?.ios).toEqual({
      default: 'circle.circle',
      selected: 'smallcircle.filled.circle',
    });
    expect(today?.androidMaterialName).toBe('radio-button-checked');
  });

  it('gives every tab a stable navigation label key for e2e selection', () => {
    for (const item of tabBarItems) {
      expect(item.labelKey.startsWith('navigation.tabs.')).toBe(true);
      expect(item.ios.default.length).toBeGreaterThan(0);
      expect(item.ios.selected.length).toBeGreaterThan(0);
      expect(item.androidMaterialName.length).toBeGreaterThan(0);
    }
  });
});
