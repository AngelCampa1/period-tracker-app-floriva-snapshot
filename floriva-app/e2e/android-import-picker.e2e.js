/* global beforeEach, waitFor */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const describeAndroidImportPicker =
  device.getPlatform() === 'android' ? describe : describe.skip;

const devServerPort = process.env.EXPO_DEV_SERVER_PORT ?? '8081';
const devServerHost =
  process.env.EXPO_DEV_SERVER_HOST ??
  (device.getPlatform() === 'android' ? '10.0.2.2' : '127.0.0.1');
const devClientUrl = `exp+floriva://expo-development-client/?url=${encodeURIComponent(
  `http://${devServerHost}:${devServerPort}`,
)}&disableOnboarding=1`;

const clueFixturePath = path.join(
  __dirname,
  '../tests/fixtures/data-portability/import/clue-rich-history.cluedata',
);
const floFixturePath = path.join(
  __dirname,
  '../tests/fixtures/data-portability/import/flo-rich-history.json',
);
const androidClueFixturePath = '/sdcard/Download/clue-rich-history.cluedata';
const androidFloFixturePath = '/sdcard/Download/flo-rich-history.json';
const androidInvalidFixturePath = '/sdcard/Download/floriva-invalid-import.json';
const androidUnsupportedMediaFixturePath = '/sdcard/Download/floriva-unsupported-import.jpg';
const documentsUiPackage = 'com.google.android.documentsui';

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getAndroidDeviceSerial() {
  return process.env.ANDROID_SERIAL ?? device?.id ?? device?._deviceId;
}

function adbBuffer(args) {
  const serial = getAndroidDeviceSerial();
  const resolvedArgs = serial ? ['-s', serial, ...args] : args;

  return execFileSync(process.env.ADB_BINARY ?? 'adb', resolvedArgs);
}

function adb(args) {
  return adbBuffer(args).toString();
}

function openAndroidUrl(url) {
  adb([
    'shell',
    'am',
    'start',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    url,
    'app.floriva',
  ]);
}

function clearAndroidAppData() {
  adb(['shell', 'pm', 'clear', 'app.floriva']);
}

function pushImportFixtures() {
  if (!fs.existsSync(clueFixturePath)) {
    throw new Error(`Missing Clue import fixture at ${clueFixturePath}`);
  }

  if (!fs.existsSync(floFixturePath)) {
    throw new Error(`Missing Flo import fixture at ${floFixturePath}`);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'floriva-import-picker-'));
  const invalidFixturePath = path.join(tempDir, 'floriva-invalid-import.json');
  const unsupportedMediaFixturePath = path.join(tempDir, 'floriva-unsupported-import.jpg');

  try {
    fs.writeFileSync(invalidFixturePath, '{"not": "valid floriva import"');
    fs.writeFileSync(unsupportedMediaFixturePath, 'not a real image, but still a media extension');
    adb(['shell', 'mkdir', '-p', '/sdcard/Download']);
    adb(['push', clueFixturePath, androidClueFixturePath]);
    adb(['push', floFixturePath, androidFloFixturePath]);
    adb(['push', invalidFixturePath, androidInvalidFixturePath]);
    adb(['push', unsupportedMediaFixturePath, androidUnsupportedMediaFixturePath]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getAndroidViewportBounds() {
  const sizeOutput = adb(['shell', 'wm', 'size']);
  const match = sizeOutput.match(/Physical size:\s*(\d+)x(\d+)/);

  if (!match) {
    return { width: 1080, height: 2424 };
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

function resolveVisibleAndroidCenter({ left, top, right, bottom }) {
  const viewport = getAndroidViewportBounds();

  if (right <= 0 || bottom <= 0 || left >= viewport.width || top >= viewport.height) {
    return null;
  }

  return {
    x: Math.round((Math.max(left, 0) + Math.min(right, viewport.width)) / 2),
    y: Math.round((Math.max(top, 0) + Math.min(bottom, viewport.height)) / 2),
  };
}

function getAndroidUiTree() {
  return adb(['exec-out', 'uiautomator', 'dump', '/dev/tty']);
}

function findAndroidElementCenterByPattern(pattern) {
  const uiTree = getAndroidUiTree();

  for (const match of uiTree.matchAll(pattern)) {
    const [, left, top, right, bottom] = match.map(Number);
    const center = resolveVisibleAndroidCenter({ left, top, right, bottom });

    if (center) {
      return center;
    }
  }

  return null;
}

function findAndroidElementCenter(testID) {
  return findAndroidElementCenterByPattern(
    new RegExp(
      `resource-id="${escapeRegExp(testID)}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
      'g',
    ),
  );
}

function findAndroidTextCenter(text) {
  return findAndroidElementCenterByPattern(
    new RegExp(
      `text="${escapeRegExp(text)}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
      'g',
    ),
  );
}

function findAndroidContentDescriptionCenter(description) {
  return findAndroidElementCenterByPattern(
    new RegExp(
      `content-desc="${escapeRegExp(description)}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
      'g',
    ),
  );
}

function tapAndroidPoint({ x, y }) {
  adb(['shell', 'input', 'tap', String(x), String(y)]);
}

async function waitForAndroidElementById(testID, timeoutMs = 15000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const center = findAndroidElementCenter(testID);

    if (center) {
      return center;
    }

    await delay(500);
  }

  throw new Error(`Android element ${testID} was not found in the UI tree.`);
}

async function tapAndroidElementById(testID, timeoutMs = 15000) {
  tapAndroidPoint(await waitForAndroidElementById(testID, timeoutMs));
  await delay(500);
}

async function waitForAndroidElementByIdWithScroll(testID, maxSwipes = 6) {
  for (let attempt = 0; attempt <= maxSwipes; attempt += 1) {
    const center = findAndroidElementCenter(testID);

    if (center) {
      return center;
    }

    adb(['shell', 'input', 'swipe', '540', '1900', '540', '900', '400']);
    await delay(700);
  }

  throw new Error(`Android element ${testID} was not found after scrolling.`);
}

async function tapAndroidTextIfVisible(text) {
  const center = findAndroidTextCenter(text);

  if (!center) {
    return false;
  }

  tapAndroidPoint(center);
  await delay(500);
  return true;
}

async function waitForAndroidText(text, timeoutMs = 10000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (findAndroidTextCenter(text)) {
      return;
    }

    await delay(500);
  }

  throw new Error(`Android text ${text} was not found in the UI tree.`);
}

async function dismissDeveloperMenuIntroIfNeeded() {
  await delay(1000);

  if (getAndroidUiTree().includes('This is the developer menu.')) {
    await tapAndroidTextIfVisible('Continue');
    await delay(1000);
  }

  if (getAndroidUiTree().includes('Connected to:')) {
    const closeCenter = findAndroidContentDescriptionCenter('Close');

    if (closeCenter) {
      tapAndroidPoint(closeCenter);
      await delay(1000);
    }
  }
}

async function connectAndroidDevClientIfNeeded() {
  const serverUrl = `http://${devServerHost}:${devServerPort}`;
  const startTime = Date.now();

  while (Date.now() - startTime < 20000) {
    const uiTree = getAndroidUiTree();

    if (!uiTree.includes('Development Build') && !uiTree.includes('DEVELOPMENT SERVERS')) {
      return;
    }

    const serverCenter = findAndroidTextCenter(serverUrl);

    if (serverCenter) {
      tapAndroidPoint({ x: Math.max(serverCenter.x, 540), y: serverCenter.y });
      await delay(5000);
      continue;
    }

    await delay(500);
  }

  throw new Error(`Expo development client did not connect to ${serverUrl}.`);
}

async function waitForDocumentsUi(timeoutMs = 10000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (getAndroidUiTree().includes(documentsUiPackage)) {
      return;
    }

    await delay(300);
  }

  throw new Error('Android DocumentsUI picker did not open.');
}

async function openDownloadsRootIfNeeded(fileName) {
  if (findAndroidTextCenter(fileName)) {
    return;
  }

  const rootsButtonCenter =
    findAndroidContentDescriptionCenter('Show roots') ??
    findAndroidContentDescriptionCenter('Open navigation drawer');

  if (rootsButtonCenter) {
    tapAndroidPoint(rootsButtonCenter);
    await delay(800);
  }

  const downloadsCenter =
    findAndroidTextCenter('Downloads') ??
    findAndroidTextCenter('Download');

  if (downloadsCenter) {
    tapAndroidPoint(downloadsCenter);
    await delay(1000);
  }
}

async function selectAndroidDocumentByName(fileName) {
  await waitForDocumentsUi();
  await openDownloadsRootIfNeeded(fileName);

  const startTime = Date.now();

  while (Date.now() - startTime < 15000) {
    const center = findAndroidTextCenter(fileName);

    if (center) {
      tapAndroidPoint(center);
      await delay(1000);
      return;
    }

    adb(['shell', 'input', 'swipe', '540', '1900', '540', '900', '400']);
    await delay(700);
  }

  throw new Error(`Android DocumentsUI file ${fileName} was not found.`);
}

async function cancelAndroidDocumentPicker() {
  await waitForDocumentsUi();
  adb(['shell', 'input', 'keyevent', 'KEYCODE_BACK']);
  await delay(1000);
}

async function openClueImportSource() {
  openAndroidUrl('floriva:///import/source/clue?disableOnboarding=1');
  await waitForAndroidElementById('import-source-screen', 30000);
}

async function openFloImportSource() {
  openAndroidUrl('floriva:///import/source/flo?disableOnboarding=1');
  await waitForAndroidElementById('import-source-screen', 30000);
}

describeAndroidImportPicker('Android import picker native coverage', () => {
  beforeAll(async () => {
    pushImportFixtures();
    clearAndroidAppData();
    await device.launchApp({ newInstance: true, delete: true, url: devClientUrl });
    await device.disableSynchronization();
    await dismissDeveloperMenuIntroIfNeeded();
    await connectAndroidDevClientIfNeeded();
    await dismissDeveloperMenuIntroIfNeeded();
    await openClueImportSource();
  });

  beforeEach(async () => {
    await openClueImportSource();
  });

  it('returns to the Clue source screen when the system picker is cancelled', async () => {
    await tapAndroidElementById('import-choose-file-button');
    await cancelAndroidDocumentPicker();
    await waitForAndroidElementById('import-source-screen', 10000);
    await device.takeScreenshot('android-import-picker-cancelled');
  });

  it('selects a real Clue export from Android Downloads and opens the review screen', async () => {
    await tapAndroidElementById('import-choose-file-button');
    await selectAndroidDocumentByName('clue-rich-history.cluedata');
    await waitFor(element(by.id('import-review-screen'))).toBeVisible().withTimeout(30000);
    await waitForAndroidElementByIdWithScroll('import-preview-entry-2026-04-12');
    await waitForAndroidElementByIdWithScroll('import-preview-entry-2026-04-13');
    await device.takeScreenshot('android-import-picker-clue-review');
  });

  it('selects a real Flo export from Android Downloads and opens the review screen', async () => {
    await openFloImportSource();
    await tapAndroidElementById('import-choose-file-button');
    await selectAndroidDocumentByName('flo-rich-history.json');
    await waitFor(element(by.id('import-review-screen'))).toBeVisible().withTimeout(30000);
    await waitForAndroidElementByIdWithScroll('import-preview-entry-2026-04-14');
    await device.takeScreenshot('android-import-picker-flo-review');
  });

  it('surfaces a clear JSON error when an invalid file is selected from Android Downloads', async () => {
    await tapAndroidElementById('import-choose-file-button');
    await selectAndroidDocumentByName('floriva-invalid-import.json');
    await waitForAndroidElementById('import-error-card', 15000);
    await waitForAndroidText(
      'Floriva could not read that file as a JSON export. Choose a .json or .cluedata export file.',
      10000,
    );
    await device.takeScreenshot('android-import-picker-invalid-json');
  });

  it('blocks unsupported media files selected from Android Downloads before parsing', async () => {
    await tapAndroidElementById('import-choose-file-button');
    await selectAndroidDocumentByName('floriva-unsupported-import.jpg');
    await waitForAndroidElementById('import-error-card', 15000);
    await waitForAndroidText(
      'That looks like an image or media file. Choose a Clue or Flo export file to preview in Floriva.',
      10000,
    );
    await device.takeScreenshot('android-import-picker-unsupported-media');
  });
});
