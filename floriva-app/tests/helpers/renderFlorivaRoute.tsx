import { renderRouter } from 'expo-router/testing-library';

type RouteMap = Parameters<typeof renderRouter>[0];

export function renderFlorivaRoute(routes: RouteMap, initialUrl: string) {
  return renderRouter(routes, { initialUrl });
}
