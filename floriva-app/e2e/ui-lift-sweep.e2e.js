/* global waitFor, system */

// UI-lift visual sweep harness (2026-07 UI lift & modernization).
//
// Adapted from e2e/long-tenure-sweep.e2e.js: drives a preset-seeded
// dev-client build to every sweep surface for that preset, applies a clean
// status bar, and captures a top-of-screen PNG plus an after-scroll-to-bottom
// PNG (`-b.png`) per surface. The `fresh-install` preset instead WALKS the
// onboarding flow (deep links cannot reach onboarding steps — the route guard
// snaps back to the draft's current step) capturing each screen along the
// way; that walk is iOS-only (the Android onboarding path needs pixel taps,
// see e2e/smoke.e2e.js).
//
// Run (driven by scripts/run-ui-lift-sweep.sh, one Metro restart per preset):
//   FLORIVA_UILIFT_SWEEP=1 \
//   FLORIVA_SWEEP_PRESET=seeded-tracker \
//   EXPO_PUBLIC_DEV_LAUNCH_PRESET=seeded-tracker \
//   npx detox test -c ios.sim.debug e2e/ui-lift-sweep.e2e.js --reuse
//
// Gated behind FLORIVA_UILIFT_SWEEP=1 so it never runs in the normal suite.

const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const adbBinary = process.env.ADB_BINARY ?? 'adb';

const devServerPort = process.env.EXPO_DEV_SERVER_PORT ?? '8081';
const devServerHost = process.env.EXPO_DEV_SERVER_HOST ?? '127.0.0.1';
const devClientUrl = `exp+floriva://expo-development-client/?url=${encodeURIComponent(
  `http://${devServerHost}:${devServerPort}`,
)}&disableOnboarding=1`;

const shouldRun = process.env.FLORIVA_UILIFT_SWEEP === '1';
const describeSweep = shouldRun ? describe : describe.skip;

const preset =
  process.env.FLORIVA_SWEEP_PRESET ?? process.env.EXPO_PUBLIC_DEV_LAUNCH_PRESET ?? 'unknown-preset';

const repoRoot = path.resolve(__dirname, '..');
const outRoot = process.env.FLORIVA_SWEEP_OUT_ROOT
  ? path.resolve(process.env.FLORIVA_SWEEP_OUT_ROOT)
  : path.join(repoRoot, 'docs', 'qa', '2026-07-22-ui-lift', 'baseline');

const todayIso = new Date().toISOString().slice(0, 10);

// Surface entry contract:
//   name        capture file base name
//   route       expo-router path (group segments are stripped for the link)
//   waitId      testID Detox waits on before capturing (screen root when the
//               screen has one; a stable child button on the five settings
//               screens whose <Screen> carries no testID)
//   scrollId    explicit `<id>-scroll` container id; `null` = not scrollable
//               (skip the bottom capture); omitted = `${waitId}-scroll`
const TAB_SURFACES = [
  { name: 'today', route: '/(app)/(tabs)/today', waitId: 'today-screen' },
  { name: 'calendar', route: '/(app)/(tabs)/calendar', waitId: 'calendar-screen' },
  { name: 'insights', route: '/(app)/(tabs)/insights', waitId: 'insights-screen' },
  { name: 'settings', route: '/(app)/(tabs)/settings', waitId: 'settings-screen' },
];

const SURFACES_BY_PRESET = {
  // The onboarding walk handles fresh-install (see walkFreshOnboarding).
  'fresh-install': [],
  'seeded-tracker': [
    ...TAB_SURFACES,
    {
      name: 'calendar-day-today',
      route: `/(app)/calendar/day/${todayIso}`,
      waitId: 'calendar-day-screen',
    },
    {
      name: 'settings-reminders',
      route: '/(app)/settings/reminders',
      waitId: 'settings-reminders-screen',
    },
    {
      name: 'settings-birth-control',
      route: '/(app)/settings/birth-control',
      waitId: 'settings-birth-control-screen',
    },
    {
      name: 'settings-cycle-setup',
      route: '/(app)/settings/cycle-setup',
      waitId: 'settings-cycle-setup-screen',
    },
    {
      name: 'settings-tracking-setup',
      route: '/(app)/settings/tracking-setup',
      waitId: 'settings-tracking-setup-screen',
    },
    {
      name: 'settings-ttc-setup',
      route: '/(app)/settings/ttc-setup',
      waitId: 'onboarding-ttc-setup-screen',
    },
    {
      name: 'settings-ttc-expectations',
      route: '/(app)/settings/ttc-expectations',
      waitId: 'onboarding-ttc-expectations-screen',
    },
    {
      name: 'settings-language',
      route: '/(app)/settings/language',
      waitId: 'settings-language-screen',
    },
    { name: 'settings-sounds', route: '/(app)/settings/sounds', waitId: 'settings-sounds-screen' },
    {
      name: 'settings-feedback',
      route: '/(app)/settings/feedback',
      waitId: 'settings-feedback-screen',
    },
    // These five render <Screen> without a testID (no root waitId, no -scroll).
    {
      name: 'settings-subscription',
      route: '/(app)/settings/subscription',
      // Which CTA renders depends on the billing access state (subscribed vs
      // needs-purchase), so accept any of them.
      waitAnyId: [
        'settings-subscription-manage-button',
        'settings-subscription-open-paywall-button',
        'settings-subscription-restore-button',
      ],
      waitId: 'settings-subscription-manage-button',
      scrollId: null,
    },
    {
      name: 'settings-data',
      route: '/(app)/settings/data',
      waitId: 'settings-open-backup-export-button',
      scrollId: null,
    },
    {
      name: 'settings-delete-data',
      route: '/(app)/settings/delete-data',
      waitId: 'settings-delete-data-button',
      scrollId: null,
    },
    {
      name: 'settings-privacy-lock',
      route: '/(app)/settings/privacy-lock',
      waitId: 'settings-setup-biometric-lock-button',
      scrollId: null,
    },
    { name: 'privacy-explainer', route: '/(app)/privacy', waitId: 'privacy-explainer-screen' },
    // Modal last: it presents over whatever is mounted, so nothing else
    // should be captured after it within this preset session.
    { name: 'info-modal', route: '/modal', waitId: 'info-modal-screen' },
  ],
  'qa-rich-history': [
    ...TAB_SURFACES,
    {
      name: 'insights-cycle-pattern',
      route: '/(app)/insights/cycle-pattern',
      waitId: 'insights-cycle-pattern-screen',
    },
    {
      name: 'insights-monthly-briefing',
      route: '/(app)/insights/monthly-briefing',
      waitId: 'insights-monthly-briefing-screen',
    },
    { name: 'insights-ttc', route: '/(app)/insights/ttc', waitId: 'insights-ttc-screen' },
    {
      name: 'calendar-history',
      route: '/(app)/calendar/history',
      waitId: 'calendar-history-screen',
    },
    {
      name: 'timeline',
      route: '/(app)/calendar/timeline',
      waitId: 'calendar-timeline-screen',
      extraScrollStops: true,
    },
    {
      name: 'calendar-about-estimates',
      route: '/(app)/calendar/about-estimates',
      waitId: 'calendar-estimate-screen',
    },
  ],
  'tenure-12mo-regular': [
    ...TAB_SURFACES.filter((surface) => surface.name !== 'settings'),
    {
      name: 'insights-cycle-pattern',
      route: '/(app)/insights/cycle-pattern',
      waitId: 'insights-cycle-pattern-screen',
    },
  ],
  'tenure-12mo-irregular': [
    ...TAB_SURFACES.filter((surface) => surface.name !== 'settings'),
    {
      name: 'insights-cycle-pattern',
      route: '/(app)/insights/cycle-pattern',
      waitId: 'insights-cycle-pattern-screen',
    },
  ],
  'tenure-lapsed': [
    { name: 'today', route: '/(app)/(tabs)/today', waitId: 'today-screen' },
    { name: 'insights', route: '/(app)/(tabs)/insights', waitId: 'insights-screen' },
  ],
  'locked-app': [
    // The guard lands on /lock by itself when the seeded state is locked; the
    // deep link is only a nudge for re-runs.
    { name: 'lock', route: '/lock', waitId: 'lock-screen', landing: 'lock-screen' },
  ],
  'import-ready': [
    { name: 'import', route: '/(app)/import', waitId: 'import-screen' },
    {
      name: 'import-source-clue',
      route: '/(app)/import/source/clue',
      waitId: 'import-source-screen',
    },
    {
      name: 'import-source-flo',
      route: '/(app)/import/source/flo',
      waitId: 'import-source-screen',
    },
  ],
  'backup-ready': [
    { name: 'backup-export', route: '/(app)/backup/export', waitId: 'backup-screen' },
    { name: 'backup-restore', route: '/(app)/backup/restore', waitId: 'backup-screen' },
  ],
  'billing-fallback': [
    // /(app)/subscribe still renders but is orphaned on 1.4.0 — reachable only
    // by deep link, kept so historical links resolve.
    { name: 'paywall', route: '/(app)/subscribe', waitId: 'billing-screen' },
    {
      name: 'settings-subscription',
      route: '/(app)/settings/subscription',
      // `canOpenBillingOptions` is forced false on 1.4.0, so the open-paywall
      // CTA never renders; settings shows the retirement notice instead.
      // Accept whichever control is present.
      waitAnyId: [
        'settings-subscription-manage-button',
        'settings-subscription-open-paywall-button',
        'settings-subscription-restore-button',
      ],
      waitId: 'settings-subscription-restore-button',
      scrollId: null,
    },
  ],
  'save-offer-monthly-active': [
    {
      name: 'save-offer',
      route: '/(app)/settings/subscription/save-offer',
      waitId: 'settings-save-offer-accept-button',
      scrollId: null,
    },
  ],
};

// Optional comma-separated deny-list of surface names (same contract as the
// tenure sweep) for surfaces known to hang a particular run.
const skippedSurfaceNames = new Set(
  (process.env.FLORIVA_SWEEP_SKIP ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

const surfaces = (SURFACES_BY_PRESET[preset] ?? []).filter(
  (surface) => !skippedSurfaceNames.has(surface.name),
);

function settle(ms = 1200) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function platformName() {
  return device.getPlatform();
}

function outDir() {
  return path.join(outRoot, preset, platformName());
}

async function dismissDeveloperMenuIntroIfNeeded() {
  try {
    await waitFor(element(by.text('Continue'))).toBeVisible().withTimeout(3000);
    await element(by.text('Continue')).tap();
  } catch {
    // The intro sheet only appears on some dev-client launches.
  }
}

async function blacklistDevServerIfNeeded() {
  if (device.getPlatform() !== 'ios') {
    return;
  }

  await device.setURLBlacklist([
    '.*127\\.0\\.0\\.1.*',
    '.*localhost.*',
    '.*symbolicate.*',
    '.*/hot.*',
    '.*/message.*',
  ]);
}

async function acceptOpenInAppAlertIfNeeded() {
  if (device.getPlatform() !== 'ios' || typeof system === 'undefined') {
    return;
  }

  try {
    await waitFor(system.element(by.system.label('Open'))).toExist().withTimeout(2000);
    await system.element(by.system.label('Open')).tap();
  } catch {
    // No confirmation alert pending — the scheme was already approved.
  }
}

async function openRoute(routePath) {
  const normalizedPath = routePath
    .replace(/^\/\(app\)\/\(tabs\)\//, '')
    .replace(/^\/\(app\)\//, '')
    .replace(/^\/\(onboarding\)\//, '')
    .replace(/^\//, '');
  const url = `floriva:///${normalizedPath}?disableOnboarding=1`;

  if (device.getPlatform() === 'android') {
    execFileSync(adbBinary, [
      'shell',
      'am',
      'start',
      '-a',
      'android.intent.action.VIEW',
      '-d',
      url,
      'app.floriva',
    ]);
    return;
  }

  await device.openURL({ url });
  await acceptOpenInAppAlertIfNeeded();
}

function applyCleanStatusBarIos() {
  execFileSync('xcrun', [
    'simctl',
    'status_bar',
    device.id,
    'override',
    '--time',
    '9:41',
    '--dataNetwork',
    'wifi',
    '--wifiMode',
    'active',
    '--wifiBars',
    '3',
    '--cellularMode',
    'active',
    '--cellularBars',
    '4',
    '--batteryState',
    'charged',
    '--batteryLevel',
    '100',
  ]);
}

function clearCleanStatusBarIos() {
  try {
    execFileSync('xcrun', ['simctl', 'status_bar', device.id, 'clear']);
  } catch {
    // Best-effort restore.
  }
}

function applyCleanStatusBarAndroid() {
  const demoBroadcast = (extras) =>
    execFileSync(adbBinary, [
      'shell',
      'am',
      'broadcast',
      '-a',
      'com.android.systemui.demo',
      ...extras,
    ]);
  try {
    execFileSync(adbBinary, ['shell', 'settings', 'put', 'global', 'sysui_demo_allowed', '1']);
    demoBroadcast(['-e', 'command', 'enter']);
    demoBroadcast(['-e', 'command', 'clock', '-e', 'hhmm', '0941']);
    demoBroadcast(['-e', 'command', 'battery', '-e', 'plugged', 'false', '-e', 'level', '100']);
    demoBroadcast(['-e', 'command', 'network', '-e', 'wifi', 'show', '-e', 'level', '4']);
    demoBroadcast(['-e', 'command', 'notifications', '-e', 'visible', 'false']);
  } catch {
    // Demo mode unavailable on this image; captures keep the real status bar.
  }
}

function clearCleanStatusBarAndroid() {
  try {
    execFileSync(adbBinary, [
      'shell',
      'am',
      'broadcast',
      '-a',
      'com.android.systemui.demo',
      '-e',
      'command',
      'exit',
    ]);
  } catch {
    // Best-effort restore.
  }
}

function captureScreen(fileBaseName) {
  const target = path.join(outDir(), `${fileBaseName}.png`);
  if (device.getPlatform() === 'android') {
    const png = execFileSync(adbBinary, ['exec-out', 'screencap', '-p'], {
      maxBuffer: 64 * 1024 * 1024,
    });
    writeFileSync(target, png);
    return;
  }
  execFileSync('xcrun', ['simctl', 'io', device.id, 'screenshot', target]);
}

function scrollContainerId(surface) {
  if (surface.scrollId === null) {
    return null;
  }
  return surface.scrollId ?? `${surface.waitId}-scroll`;
}

async function scrollToBottomBestEffort(scrollId) {
  if (!scrollId) {
    return false;
  }
  try {
    await element(by.id(scrollId)).scrollTo('bottom');
    return true;
  } catch {
    return false;
  }
}

async function scrollDownBestEffort(scrollId, dy) {
  if (!scrollId) {
    return;
  }
  try {
    await element(by.id(scrollId)).scroll(dy, 'down');
  } catch {
    // Container shorter than the requested scroll; ignore.
  }
}

async function scrollToTopBestEffort(scrollId) {
  if (!scrollId) {
    return;
  }
  try {
    await element(by.id(scrollId)).scrollTo('top');
  } catch {
    // Already at top / not scrollable; ignore.
  }
}

async function waitForAnyVisible(ids, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    for (const id of ids) {
      try {
        await waitFor(element(by.id(id))).toBeVisible().withTimeout(2500);
        return id;
      } catch {
        // Try the next candidate.
      }
    }
    if (Date.now() > deadline) {
      throw new Error(`None of [${ids.join(', ')}] became visible within ${timeoutMs}ms`);
    }
  }
}

async function openSurface(surface) {
  await openRoute(surface.route);
  if (surface.waitAnyId) {
    await waitForAnyVisible(surface.waitAnyId);
  } else {
    await waitFor(element(by.id(surface.waitId))).toBeVisible().withTimeout(20000);
  }
  // Let entering animations finish before issuing any scroll action (the
  // tenure sweep's LT-14/LT-15 main-thread-wedge lesson).
  await settle(800);
  await scrollToTopBestEffort(scrollContainerId(surface));
  await settle(400);
}

// --- fresh-install onboarding walk (iOS only) -------------------------------
//
// Mirrors the proven minimum fresh-setup path in e2e/smoke.e2e.js, capturing
// each screen before advancing. Purchase succeeds locally because Metro runs
// with EXPO_PUBLIC_BILLING_E2E_MODE=local-purchase-success.

async function tapWhenVisible(id, timeout = 10000) {
  await waitFor(element(by.id(id))).toBeVisible().withTimeout(timeout);
  await element(by.id(id)).tap();
}

// Under disableSynchronization a CTA tap can land while the next screen is
// still mounting; retry the tap until the expected screen appears.
async function tapUntilVisible(actionId, nextScreenId, attempts = 4) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      await element(by.id(actionId)).atIndex(0).tap();
    } catch {
      // Element momentarily gone/duplicated; fall through to the visibility poll.
    }
    try {
      await waitFor(element(by.id(nextScreenId))).toBeVisible().withTimeout(4000);
      return;
    } catch {
      // Not there yet — retry the tap.
    }
  }
  await waitFor(element(by.id(nextScreenId))).toBeVisible().withTimeout(10000);
}

async function captureOnboardingStep(name, screenId) {
  await waitFor(element(by.id(screenId))).toBeVisible().withTimeout(20000);
  await settle(900);
  captureScreen(name);
}

async function walkFreshOnboarding() {
  await openRoute('/welcome');
  await captureOnboardingStep('onb-01-welcome', 'onboarding-welcome-screen');

  await tapUntilVisible('onboarding-welcome-start-button', 'onboarding-start-path-screen');
  await captureOnboardingStep('onb-02-start-path', 'onboarding-start-path-screen');

  await tapWhenVisible('onboarding-start-path-fresh-option');
  await tapUntilVisible(
    'onboarding-start-path-continue-button',
    'onboarding-last-period-start-screen',
  );
  await captureOnboardingStep('onb-03-last-period-start', 'onboarding-last-period-start-screen');

  await tapWhenVisible('onboarding-last-period-start-today');
  await scrollToBottomBestEffort('onboarding-last-period-start-screen-scroll');
  await tapUntilVisible(
    'onboarding-last-period-start-continue-button',
    'onboarding-cycle-length-screen',
  );
  await captureOnboardingStep('onb-04-cycle-length', 'onboarding-cycle-length-screen');

  await scrollToBottomBestEffort('onboarding-cycle-length-screen-scroll');
  await tapWhenVisible('onboarding-cycle-variability-steady-option');
  await tapUntilVisible('onboarding-cycle-length-continue-button', 'onboarding-period-length-screen');
  await captureOnboardingStep('onb-05-period-length', 'onboarding-period-length-screen');

  await tapUntilVisible(
    'onboarding-period-length-continue-button',
    'onboarding-symptom-logging-screen',
  );
  await captureOnboardingStep('onb-06-symptom-logging', 'onboarding-symptom-logging-screen');

  await tapWhenVisible('onboarding-symptom-logging-no-option');
  await tapUntilVisible('onboarding-symptom-logging-continue-button', 'onboarding-ttc-screen');
  await captureOnboardingStep('onb-07-ttc', 'onboarding-ttc-screen');

  await tapWhenVisible('onboarding-ttc-no-option');
  await tapUntilVisible('onboarding-ttc-continue-button', 'onboarding-notifications-screen');
  await captureOnboardingStep('onb-08-notifications', 'onboarding-notifications-screen');

  // 1.4.0 retired the paid gate: `paywall` and `billing-options` were dropped
  // from every onboarding route order (src/features/onboarding/model.ts:69),
  // so skipping notifications now lands directly on completion. The previous
  // paywall step and its plan-selection scroll were removed with it.
  await tapUntilVisible('onboarding-notifications-skip-button', 'onboarding-completion-screen');
  await captureOnboardingStep('onb-09-completion', 'onboarding-completion-screen');

  await tapUntilVisible('onboarding-completion-continue-button', 'today-screen');

  // Post-onboarding empty-state tabs round out the fresh-install story.
  const emptyTabs = [
    { name: 'today-empty', route: '/(app)/(tabs)/today', waitId: 'today-screen' },
    { name: 'calendar-empty', route: '/(app)/(tabs)/calendar', waitId: 'calendar-screen' },
    { name: 'insights-empty', route: '/(app)/(tabs)/insights', waitId: 'insights-screen' },
    { name: 'settings-fresh', route: '/(app)/(tabs)/settings', waitId: 'settings-screen' },
  ];
  for (const surface of emptyTabs) {
    await openSurface(surface);
    await settle();
    captureScreen(surface.name);
    const scrolled = await scrollToBottomBestEffort(scrollContainerId(surface));
    if (scrolled) {
      await settle(800);
      captureScreen(`${surface.name}-b`);
    }
  }
}

// ---------------------------------------------------------------------------

describeSweep(`UI-lift sweep (${preset})`, () => {
  jest.setTimeout(900000);

  beforeAll(async () => {
    mkdirSync(outDir(), { recursive: true });

    const launchOptions =
      device.getPlatform() === 'android'
        ? { newInstance: true, delete: true, url: devClientUrl }
        : { newInstance: true, delete: true };

    await device.launchApp(launchOptions);
    await device.disableSynchronization();
    await blacklistDevServerIfNeeded();
    if (device.getPlatform() !== 'android') {
      await device.openURL({ url: devClientUrl });
      await acceptOpenInAppAlertIfNeeded();
    }
    await dismissDeveloperMenuIntroIfNeeded();

    // Wait for the JS bundle + the preset's landing screen. Seeded presets
    // land on Today; fresh-install lands on Welcome; locked-app on the lock
    // screen.
    const landingId =
      preset === 'fresh-install'
        ? 'onboarding-welcome-screen'
        : preset === 'locked-app'
          ? 'lock-screen'
          : 'today-screen';
    try {
      await waitFor(element(by.id(landingId))).toBeVisible().withTimeout(120000);
    } catch {
      await settle(4000);
    }

    if (device.getPlatform() === 'ios') {
      applyCleanStatusBarIos();
    } else {
      applyCleanStatusBarAndroid();
    }
  });

  afterAll(async () => {
    if (device.getPlatform() === 'ios') {
      clearCleanStatusBarIos();
    } else {
      clearCleanStatusBarAndroid();
    }
  });

  it('captures every sweep surface for the preset', async () => {
    const failures = [];

    if (preset === 'fresh-install') {
      if (device.getPlatform() === 'android') {
        // The Android onboarding walk needs uiautomator pixel taps (see
        // e2e/smoke.e2e.js); fresh-install is iOS-only in this sweep.
        return;
      }
      await walkFreshOnboarding();
      return;
    }

    for (const surface of surfaces) {
      if (surface.iosOnly && device.getPlatform() === 'android') {
        continue;
      }
      try {
        await openSurface(surface);
        await settle();
        captureScreen(surface.name);

        const scrollId = scrollContainerId(surface);
        if (surface.extraScrollStops) {
          await scrollDownBestEffort(scrollId, 1200);
          await settle(800);
          captureScreen(`${surface.name}-mid`);
        }

        const scrolled = await scrollToBottomBestEffort(scrollId);
        if (scrolled) {
          await settle(800);
          captureScreen(`${surface.name}-b`);
        }
      } catch (error) {
        failures.push(`${surface.name}: ${error.message ?? error}`);
      }
    }

    if (failures.length) {
      throw new Error(`Sweep surfaces failed:\n${failures.join('\n')}`);
    }
  });
});
