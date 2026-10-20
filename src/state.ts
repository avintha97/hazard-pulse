import type { Dataset, HazardEvent, HazardType, Storm, StormPoint } from './data';
import { DAY, HOUR } from './time';

export type LayerKey = HazardType | 'night';
export type Tab = 'all' | HazardType;
export type Theme = 'dark' | 'light';
export type BasemapId = 'dark' | 'light' | 'satellite' | 'topo' | 'streets';

export interface AppState {
  layers: Record<LayerKey, boolean>;
  /** Time window length in days */
  win: 1 | 3 | 7;
  /** End of the time window (the scrubber position), ms */
  end: number;
  tab: Tab;
  q: string;
  sel: HazardEvent | null;
  playing: boolean;
  theme: Theme;
  basemap: BasemapId;
}

type Listener = (s: AppState, prev: AppState) => void;

/**
 * A tiny store: one state object, `set` merges a patch and notifies every subscriber.
 * Modules compare `s` with `prev` to skip work they don't need.
 */
export function createStore(data: Dataset, look: Pick<AppState, 'theme' | 'basemap'>) {
  let state: AppState = {
    layers: { quake: true, fire: true, storm: true, alert: true, night: true },
    win: 7, end: data.now, tab: 'all', q: '', sel: null, playing: false, ...look
  };
  const listeners = new Set<Listener>();
  return {
    data,
    get: () => state,
    set(patch: Partial<AppState>) {
      const prev = state;
      state = { ...state, ...patch };
      listeners.forEach(l => l(state, prev));
    },
    subscribe(l: Listener) { listeners.add(l); return () => listeners.delete(l); }
  };
}
export type Store = ReturnType<typeof createStore>;

/* ---------- derived values ---------- */

export const windowStart = (data: Dataset, s: AppState) => Math.max(data.start, s.end - s.win * DAY);
export const inWindow = (data: Dataset, s: AppState, t: number) => t >= windowStart(data, s) && t <= s.end;

/** The storm's latest position at the scrubber time, or null if it hasn't formed or has long passed. */
export function stormNow(data: Dataset, s: AppState, storm: Storm): StormPoint | null {
  let cur: StormPoint | null = null;
  for (const p of storm.pts) if (p.t <= s.end) cur = p;
  if (!cur || cur.t < windowStart(data, s) - 6 * HOUR) return null;
  return cur;
}

export function isVisible(data: Dataset, s: AppState, e: HazardEvent): boolean {
  switch (e.type) {
    case 'storm': return s.layers.storm && !!stormNow(data, s, e);
    case 'firecluster': return s.layers.fire && e.points.some(p => inWindow(data, s, p.t));
    default: return s.layers[e.type] && inWindow(data, s, e.t);
  }
}

/** Where to point the map and the popup for an event. */
export function eventLngLat(data: Dataset, s: AppState, e: HazardEvent): [number, number] {
  if (e.type === 'storm') {
    const c = stormNow(data, s, e) ?? e.pts[e.pts.length - 1];
    return [c.lon, c.lat];
  }
  return [e.lon, e.lat];
}
