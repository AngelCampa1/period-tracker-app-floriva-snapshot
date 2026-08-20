#!/usr/bin/env bash
#
# UI-lift visual sweep driver (2026-07 UI lift & modernization).
#
# Per preset: restarts Metro with the preset's bundle-time env
# (EXPO_PUBLIC_DEV_LAUNCH_PRESET is inlined into the JS bundle when Metro
# serves it — hence a Metro restart with --clear per preset, never an app
# rebuild), then runs e2e/ui-lift-sweep.e2e.js against the already-built
# Detox debug binary and collects screenshots under
# docs/qa/2026-07-22-ui-lift/baseline/<preset>/<platform>/.
#
# Usage:
#   scripts/run-ui-lift-sweep.sh [preset ...]          # default: all presets
#   FLORIVA_SWEEP_PLATFORM=android scripts/run-ui-lift-sweep.sh
#   FLORIVA_SWEEP_OUT_ROOT=docs/qa/2026-07-22-ui-lift/phase-4 scripts/run-ui-lift-sweep.sh
#   DETOX_IOS_DEVICE_ID=<udid> scripts/run-ui-lift-sweep.sh seeded-tracker
#
# Prereq: a current Detox debug build (pnpm detox:build:ios / :android).

set -uo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

PLATFORM="${FLORIVA_SWEEP_PLATFORM:-ios}"
if [ "$PLATFORM" = "ios" ]; then
  DETOX_CONFIG="ios.sim.debug"
else
  DETOX_CONFIG="android.emu.debug"
fi

PORT="${EXPO_DEV_SERVER_PORT:-8081}"
OUT_ROOT="${FLORIVA_SWEEP_OUT_ROOT:-$APP_DIR/docs/qa/2026-07-22-ui-lift/baseline}"
METRO_LOG_DIR="${FLORIVA_SWEEP_METRO_LOG_DIR:-/tmp/floriva-ui-lift-sweep-logs}"
mkdir -p "$OUT_ROOT" "$METRO_LOG_DIR"

# fresh-install walks onboarding (iOS-only inside the spec; skipped here for
# android so the run does not burn a Metro restart on a no-op).
ALL_PRESETS=(
  fresh-install
  seeded-tracker
  qa-rich-history
  tenure-12mo-regular
  tenure-12mo-irregular
  tenure-lapsed
  locked-app
  import-ready
  backup-ready
  billing-fallback
  save-offer-monthly-active
)

if [ "$#" -gt 0 ]; then
  PRESETS=("$@")
else
  PRESETS=("${ALL_PRESETS[@]}")
fi

METRO_PID=""

kill_metro() {
  if [ -n "$METRO_PID" ] && kill -0 "$METRO_PID" 2>/dev/null; then
    kill "$METRO_PID" 2>/dev/null
    wait "$METRO_PID" 2>/dev/null
  fi
  METRO_PID=""
  # Belt and braces: nothing else may hold the dev-server port between presets.
  lsof -ti "tcp:$PORT" 2>/dev/null | xargs kill 2>/dev/null
  sleep 1
  return 0
}

trap kill_metro EXIT

wait_for_metro() {
  local deadline=$((SECONDS + 180))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if curl -sf "http://127.0.0.1:$PORT/status" >/dev/null 2>&1; then
      return 0
    fi
    if [ -n "$METRO_PID" ] && ! kill -0 "$METRO_PID" 2>/dev/null; then
      return 1
    fi
    sleep 2
  done
  return 1
}

FAILED_PRESETS=()
PASSED_PRESETS=()

for preset in "${PRESETS[@]}"; do
  if [ "$preset" = "fresh-install" ] && [ "$PLATFORM" = "android" ]; then
    echo "=== [$preset] skipped on android (onboarding walk is iOS-only) ==="
    continue
  fi

  echo "=== [$preset] starting ($PLATFORM) ==="
  kill_metro

  metro_log="$METRO_LOG_DIR/metro-$PLATFORM-$preset.log"
  # --clear guarantees the bundle is re-transformed with this preset's
  # EXPO_PUBLIC_* values instead of a cached bundle from a previous preset.
  env \
    EXPO_PUBLIC_DEV_LAUNCH_PRESET="$preset" \
    EXPO_PUBLIC_BILLING_E2E_MODE=local-purchase-success \
    RCT_NO_LAUNCH_PACKAGER=1 \
    CI=1 \
    corepack pnpm exec expo start --dev-client --port "$PORT" --clear \
    >"$metro_log" 2>&1 </dev/null &
  METRO_PID=$!

  if ! wait_for_metro; then
    echo "!!! [$preset] Metro failed to become ready on port $PORT (log: $metro_log)"
    FAILED_PRESETS+=("$preset (metro)")
    continue
  fi

  mkdir -p "$OUT_ROOT/$preset/$PLATFORM"

  env \
    FLORIVA_UILIFT_SWEEP=1 \
    FLORIVA_SWEEP_PRESET="$preset" \
    FLORIVA_SWEEP_OUT_ROOT="$OUT_ROOT" \
    EXPO_PUBLIC_DEV_LAUNCH_PRESET="$preset" \
    EXPO_DEV_SERVER_PORT="$PORT" \
    corepack pnpm exec detox test -c "$DETOX_CONFIG" e2e/ui-lift-sweep.e2e.js \
    --reuse --loglevel info \
    --artifacts-location "$METRO_LOG_DIR/detox-$PLATFORM-$preset"
  detox_status=$?

  if [ "$detox_status" -ne 0 ]; then
    echo "!!! [$preset] detox exited with $detox_status"
    FAILED_PRESETS+=("$preset (detox:$detox_status)")
  else
    PASSED_PRESETS+=("$preset")
  fi
done

kill_metro

echo
echo "=== Sweep summary ($PLATFORM) ==="
echo "Passed: ${PASSED_PRESETS[*]:-none}"
echo "Failed: ${FAILED_PRESETS[*]:-none}"
echo "Artifacts: $OUT_ROOT"
echo "Metro/Detox logs: $METRO_LOG_DIR"

if [ "${#FAILED_PRESETS[@]}" -gt 0 ]; then
  exit 1
fi
