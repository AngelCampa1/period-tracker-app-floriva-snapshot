import { createWave5AcceptanceHarness } from '@/tests/helpers/createWave5AcceptanceHarness';

import { renderFlorivaRoute } from './renderFlorivaRoute';

type RouteMap = Parameters<typeof renderFlorivaRoute>[0];

let currentHarness: Awaited<ReturnType<typeof createWave5AcceptanceHarness>> | null = null;

export async function initializeWave5RouteHarness() {
  currentHarness = await createWave5AcceptanceHarness();

  return currentHarness;
}

export function getWave5RouteHarness() {
  if (!currentHarness) {
    throw new Error('Wave 5 route test harness has not been initialized');
  }

  return currentHarness;
}

export function renderWave5Route(routes: RouteMap, initialUrl: string) {
  return renderFlorivaRoute(routes, initialUrl);
}

export function closeWave5RouteHarness() {
  currentHarness?.close();
  currentHarness = null;
}
