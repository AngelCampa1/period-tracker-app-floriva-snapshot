import migrations from '@/drizzle/migrations';

describe('drizzle migrations manifest', () => {
  it('includes every journal entry in the Expo migrations manifest', () => {
    const expectedKeys = migrations.journal.entries.map(
      (entry, index) => `m${String(index).padStart(4, '0')}`,
    );
    const manifestKeys = Object.keys(migrations.migrations).sort();

    expect(manifestKeys).toEqual(expectedKeys);
    expect(migrations.migrations.m0004).toBeTruthy();
    expect(migrations.migrations.m0005).toBeTruthy();
    expect(migrations.migrations.m0014).toContain('backup_events');
    expect(migrations.migrations.m0015).toContain('birth_control_method');

    for (const key of manifestKeys) {
      expect(migrations.migrations[key as keyof typeof migrations.migrations]).toBeTruthy();
    }
  });
});
