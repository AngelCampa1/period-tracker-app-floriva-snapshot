#!/usr/bin/env bash
#
# Long-tenure visual sweep driver (1.2.0 bug hunt, Phase 3).
#
# Per variant: restarts Metro with the variant's bundle-time env
# (EXPO_PUBLIC_DEV_LAUNCH_PRESET is inlined into the JS bundle when Metro
# serves it — hence a Metro restart with --clear per variant, never an app
# rebuild), then runs e2e/long-tenure-sweep.e2e.js against the already-built
# Detox debug binary and collects artifacts under
# docs/qa/2026-07-06-long-tenure-sweep/<variant>/<platform>/.
#
# Usage:
#   scripts/run-tenure-sweep.sh [variant ...]        # default: all six variants
#   FLORIVA_SWEEP_PLATFORM=android scripts/run-tenure-sweep.sh
#   DETOX_IOS_DEVICE_ID=<udid> scripts/run-tenure-sweep.sh tenure-12mo-regular
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
OUT_ROOT="${FLORIVA_SWEEP_OUT_ROOT:-$APP_DIR/docs/qa/2026-07-06-long-tenure-sweep}"
METRO_LOG_DIR="${FLORIVA_SWEEP_METRO_LOG_DIR:-/tmp/floriva-tenure-sweep-logs}"
mkdir -p "$OUT_ROOT" "$METRO_LOG_DIR"

ALL_VARIANTS=(
  tenure-1mo-new
  tenure-3mo-regular
  tenure-6mo-gap
  tenure-12mo-regular
  tenure-12mo-irregular
  tenure-lapsed
)
# Variants that get the full 17-surface set plus scroll videos.
FULL_SET_VARIANTS="tenure-12mo-regular tenure-12mo-irregular"

if [ "$#" -gt 0 ]; then
  VARIANTS=("$@")
else
  VARIANTS=("${ALL_VARIANTS[@]}")
fi

METRO_PID=""

kill_metro() {
  if [ -n "$METRO_PID" ] && kill -0 "$METRO_PID" 2>/dev/null; then
    kill "$METRO_PID" 2>/dev/null
    wait "$METRO_PID" 2>/dev/null
  fi
  METRO_PID=""
  # Belt and braces: nothing else may hold the dev-server port between variants.
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

FAILED_VARIANTS=()
PASSED_VARIANTS=()

for variant in "${VARIANTS[@]}"; do
  echo "=== [$variant] starting ($PLATFORM) ==="
  kill_metro

  metro_log="$METRO_LOG_DIR/metro-$PLATFORM-$variant.log"
  # --clear guarantees the bundle is re-transformed with this variant's
  # EXPO_PUBLIC_* values instead of a cached bundle from a previous variant.
  env \
    EXPO_PUBLIC_DEV_LAUNCH_PRESET="$variant" \
    EXPO_PUBLIC_BILLING_E2E_MODE=local-purchase-success \
    RCT_NO_LAUNCH_PACKAGER=1 \
    CI=1 \
    corepack pnpm exec expo start --dev-client --port "$PORT" --clear \
    >"$metro_log" 2>&1 </dev/null &
  METRO_PID=$!

  if ! wait_for_metro; then
    echo "!!! [$variant] Metro failed to become ready on port $PORT (log: $metro_log)"
    FAILED_VARIANTS+=("$variant (metro)")
    continue
  fi

  oldest_date="$(corepack pnpm exec tsx scripts/print-tenure-oldest-date.ts "$variant")"
  if [ -z "$oldest_date" ]; then
    echo "!!! [$variant] could not resolve oldest seeded logDate"
    FAILED_VARIANTS+=("$variant (oldest-date)")
    continue
  fi

  case " $FULL_SET_VARIANTS " in
    *" $variant "*) sweep_set="full"; sweep_video="1" ;;
    *) sweep_set="reduced"; sweep_video="0" ;;
  esac

  mkdir -p "$OUT_ROOT/$variant/$PLATFORM"

  echo "--- [$variant] set=$sweep_set video=$sweep_video oldest=$oldest_date"
  env \
    FLORIVA_TENURE_SWEEP=1 \
    FLORIVA_SWEEP_VARIANT="$variant" \
    FLORIVA_SWEEP_OLDEST_DATE="$oldest_date" \
    FLORIVA_SWEEP_SET="$sweep_set" \
    FLORIVA_SWEEP_VIDEO="$sweep_video" \
    FLORIVA_SWEEP_OUT_ROOT="$OUT_ROOT" \
    EXPO_PUBLIC_DEV_LAUNCH_PRESET="$variant" \
    EXPO_DEV_SERVER_PORT="$PORT" \
    corepack pnpm exec detox test -c "$DETOX_CONFIG" e2e/long-tenure-sweep.e2e.js \
    --reuse --loglevel info \
    --artifacts-location "$METRO_LOG_DIR/detox-$PLATFORM-$variant"
  detox_status=$?

  if [ "$detox_status" -ne 0 ]; then
    echo "!!! [$variant] detox exited with $detox_status"
    FAILED_VARIANTS+=("$variant (detox:$detox_status)")
  else
    PASSED_VARIANTS+=("$variant")
  fi
done

kill_metro

echo
echo "=== Sweep summary ($PLATFORM) ==="
echo "Passed: ${PASSED_VARIANTS[*]:-none}"
echo "Failed: ${FAILED_VARIANTS[*]:-none}"
echo "Artifacts: $OUT_ROOT"
echo "Metro/Detox logs: $METRO_LOG_DIR"

if [ "${#FAILED_VARIANTS[@]}" -gt 0 ]; then
  exit 1
fi
