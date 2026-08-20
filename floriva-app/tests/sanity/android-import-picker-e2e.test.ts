import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..', '..');

describe('Android import file picker native e2e coverage', () => {
  it('bridges the Expo import flow through Android DocumentsUI', () => {
    const spec = fs.readFileSync(
      path.join(projectRoot, 'e2e/android-import-picker.e2e.js'),
      'utf8',
    );

    expect(spec).toContain("device.getPlatform() === 'android' ? describe : describe.skip");
    expect(spec).toContain("device.getPlatform() === 'android' ? '10.0.2.2' : '127.0.0.1'");
    expect(spec).toContain('connectAndroidDevClientIfNeeded');
    expect(spec).toContain('/sdcard/Download/clue-rich-history.cluedata');
    expect(spec).toContain('/sdcard/Download/flo-rich-history.json');
    expect(spec).toContain('/sdcard/Download/floriva-invalid-import.json');
    expect(spec).toContain('/sdcard/Download/floriva-unsupported-import.jpg');
    expect(spec).toContain('com.google.android.documentsui');
    expect(spec).toContain('floriva:///import/source/clue?disableOnboarding=1');
    expect(spec).toContain('floriva:///import/source/flo?disableOnboarding=1');
    expect(spec).toContain('import-choose-file-button');
    expect(spec).toContain('selectAndroidDocumentByName');
    expect(spec).toContain('cancelAndroidDocumentPicker');
    expect(spec).toContain('import-preview-entry-2026-04-12');
    expect(spec).toContain('import-preview-entry-2026-04-14');
    expect(spec).toContain('import-error-card');
    expect(spec).toContain('Floriva could not read that file as a JSON export.');
    expect(spec).toContain('That looks like an image or media file.');
  });
});
