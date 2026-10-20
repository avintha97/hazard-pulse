import type { AlertLevel } from '../data';

/** Read a CSS custom property from :root so colours live in one place (tokens.css). */
export const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const COLORS = {
  get quake() { return cssVar('--quake'); },
  get quakeStrong() { return cssVar('--quake-strong'); },
  get fire() { return cssVar('--fire'); },
  get storm() { return cssVar('--storm'); },
  get accent() { return cssVar('--accent'); },
  get fg() { return cssVar('--fg'); },
  get fg3() { return cssVar('--fg-3'); },
  level(l: AlertLevel) { return cssVar(`--lvl-${l}`); }
};

/** Escape text before putting it in innerHTML. Live feeds are untrusted input. */
export function esc(s: string | number): string {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** "38.30°N, 142.40°E" */
export const latLon = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;

export const catLabel = (c: number) => c === 0 ? 'Tropical storm' : `Category ${c}`;
export const windKt = (c: number) => [55, 75, 90, 105, 125, 145][c];
export const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
