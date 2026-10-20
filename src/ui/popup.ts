import type { Dataset, HazardEvent } from '../data';
import { type AppState, inWindow, stormNow } from '../state';
import { ago, fmtFull } from '../time';
import { COLORS, cap, catLabel, esc, latLon, windKt } from './format';

interface PopupParts { color: string; type: string; title: string; rows: [string, string][]; src: string }

const num = (v: string | number) => `<span class="num">${esc(v)}</span>`;

function parts(data: Dataset, s: AppState, e: HazardEvent): PopupParts {
  const tag = data.sample ? ' (sample)' : '';
  switch (e.type) {
    case 'quake':
      return {
        color: e.mag >= 6 ? COLORS.quakeStrong : COLORS.quake, type: 'Earthquake', title: `M ${e.mag.toFixed(1)} · ${e.place}`,
        rows: [['Time', esc(fmtFull(e.t))], ['Depth', num(`${e.depth} km`)], ['Location', num(latLon(e.lat, e.lon))]],
        src: `Source: USGS earthquake feed${tag}`
      };
    case 'fire':
      return {
        color: COLORS.fire, type: 'Fire detection', title: e.region,
        rows: [['Detected', esc(fmtFull(e.t))], ['Fire power', num(`${e.frp} MW`)], ['Confidence', esc(e.conf)], ['Satellite', esc(e.sat)]],
        src: `Source: NASA FIRMS${tag}`
      };
    case 'firecluster': {
      const pts = e.points.filter(p => inWindow(data, s, p.t));
      const latest = Math.max(...pts.map(p => p.t));
      return {
        color: COLORS.fire, type: 'Wildfire activity', title: e.region,
        rows: [['Detections', num(pts.length)], ['Peak fire power', num(`${Math.max(0, ...pts.map(p => p.frp))} MW`)], ['Latest', pts.length ? esc(ago(latest, s.end)) : '–']],
        src: `Source: NASA FIRMS${tag}`
      };
    }
    case 'storm': {
      const c = stormNow(data, s, e) ?? e.pts[e.pts.length - 1];
      return {
        color: COLORS.storm, type: e.kind, title: e.name,
        rows: [['Strength', esc(catLabel(c.cat))], ['Max wind', num(`${windKt(c.cat)} kt`)], ['Position', num(latLon(c.lat, c.lon))], ['As of', esc(fmtFull(c.t))]],
        src: `Source: GDACS / JTWC tracks${tag}`
      };
    }
    case 'alert':
      return {
        color: COLORS.level(e.level), type: `${cap(e.level)} alert`, title: `${e.title} · ${e.place}`,
        rows: [['Issued', esc(fmtFull(e.t))], ['People affected', esc(e.pop)], ['Location', num(latLon(e.lat, e.lon))]],
        src: `Source: GDACS${tag}`
      };
  }
}

/** Popup body for the selected event. */
export function popupContent(data: Dataset, s: AppState, e: HazardEvent): HTMLElement {
  const p = parts(data, s, e);
  const el = document.createElement('div');
  el.style.setProperty('--c', p.color);
  el.innerHTML = `<button class="x" aria-label="Close">✕</button>
    <div class="p-type">${esc(p.type)}</div>
    <div class="p-title">${esc(p.title)}</div>
    <dl>${p.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>
    <div class="src">${esc(p.src)}</div>`;
  return el;
}
