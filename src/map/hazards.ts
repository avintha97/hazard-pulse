import { Marker, type GeoJSONSource, type Map as MlMap } from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import type { HazardEvent } from '../data';
import { type AppState, type Store, inWindow, stormNow, windowStart } from '../state';
import { COLORS, esc } from '../ui/format';
import { DAY, HOUR } from '../time';

const pt = (lon: number, lat: number, properties: Record<string, unknown>): Feature<Point> =>
  ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: [lon, lat] } });
const fc = <T extends Feature>(features: T[]): FeatureCollection => ({ type: 'FeatureCollection', features });

/** Scale a pixel size with zoom, like the prototype's k^0.35 growth. */
const byZoom = (size: unknown) =>
  ['interpolate', ['linear'], ['zoom'], 0, ['*', size, .8], 3, ['*', size, 1.25], 8, ['*', size, 2.2]] as never;
/** Earthquake circle radius in px from magnitude. */
const QUAKE_R = ['+', 1.6, ['*', 1.7, ['^', ['max', 0, ['-', ['get', 'mag'], 2.5]], 1.55]]];
const FIRE_R = ['+', 1.3, ['/', ['min', ['get', 'frp'], 150], 75]];

const PULSE_LAYERS = ['quake-pulse-a', 'quake-pulse-b'];
/** Circle layers you can click; storms and alerts are HTML markers with their own click handlers. */
const PICKABLE = ['quakes', 'fires'];

/**
 * Hazard layers on top of the basemap. Quakes and fires are GPU circle layers filtered by time;
 * storms are track lines plus an HTML marker; alerts are HTML markers.
 */
export function addHazardLayers(map: MlMap, store: Store, onPick: (e: HazardEvent | null) => void) {
  const { data } = store;
  const byId = new Map<string, HazardEvent>();
  [...data.quakes, ...data.fires, ...data.storms, ...data.alerts].forEach(e => byId.set(e.id, e));

  map.addSource('quakes', {
    type: 'geojson',
    data: fc([...data.quakes].sort((a, b) => a.mag - b.mag).map(q => pt(q.lon, q.lat, { id: q.id, mag: q.mag, t: q.t })))
  });
  map.addSource('fires', { type: 'geojson', data: fc(data.fires.map(f => pt(f.lon, f.lat, { id: f.id, frp: f.frp, t: f.t }))) });
  map.addSource('storm-past', { type: 'geojson', data: fc([]) });
  map.addSource('storm-pts', { type: 'geojson', data: fc([]) });
  map.addSource('storm-forecast', { type: 'geojson', data: fc([]) });

  const storm = COLORS.storm;
  map.addLayer({ id: 'fires-glow', type: 'circle', source: 'fires', paint: { 'circle-radius': byZoom(['*', FIRE_R, 2.6]), 'circle-color': 'rgba(255,90,54,.2)', 'circle-blur': .8 } });
  map.addLayer({ id: 'fires', type: 'circle', source: 'fires', paint: { 'circle-radius': byZoom(FIRE_R), 'circle-color': 'rgba(255,120,70,.9)' } });
  map.addLayer({ id: 'storm-past', type: 'line', source: 'storm-past', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': 'rgba(182,156,255,.85)', 'line-width': 2 } });
  map.addLayer({ id: 'storm-forecast', type: 'line', source: 'storm-forecast', paint: { 'line-color': 'rgba(182,156,255,.55)', 'line-width': 2, 'line-dasharray': [2, 2.5] } });
  map.addLayer({
    id: 'storm-pts', type: 'circle', source: 'storm-pts',
    paint: {
      'circle-radius': ['case', ['get', 'forecast'], 2.5, ['+', 1.8, ['*', ['get', 'cat'], .5]]],
      'circle-color': ['case', ['get', 'forecast'], 'rgba(182,156,255,.4)', storm]
    }
  });
  for (const id of PULSE_LAYERS) {
    map.addLayer({ id, type: 'circle', source: 'quakes', paint: { 'circle-color': 'transparent', 'circle-stroke-width': 1.5 } });
  }
  map.addLayer({
    id: 'quakes', type: 'circle', source: 'quakes',
    layout: { 'circle-sort-key': ['get', 'mag'] },
    paint: {
      'circle-radius': byZoom(QUAKE_R),
      'circle-stroke-width': 1.3,
      'circle-stroke-color': ['case', ['>=', ['get', 'mag'], 6], COLORS.quakeStrong, COLORS.quake]
    }
  });

  /* ---------- storms and alerts as HTML markers ---------- */
  const stormMarkers = new Map<string, { m: Marker; el: HTMLElement; on: boolean }>();
  for (const s of data.storms) {
    const el = document.createElement('div');
    el.className = 'storm-mk';
    el.innerHTML = `<span class="spin"></span><span class="eye"></span><span class="name">${esc(s.name)}</span>`;
    el.addEventListener('click', ev => { ev.stopPropagation(); onPick(s); });
    stormMarkers.set(s.id, { m: new Marker({ element: el, opacityWhenCovered: '0' }).setLngLat([s.pts[0].lon, s.pts[0].lat]), el, on: false });
  }
  const alertMarkers = new Map<string, { m: Marker; on: boolean }>();
  for (const a of data.alerts) {
    const el = document.createElement('div');
    el.className = 'alert-mk';
    el.style.setProperty('--c', COLORS.level(a.level));
    el.setAttribute('aria-label', `${a.level} alert: ${a.title}, ${a.place}`);
    el.innerHTML = '<span>!</span>';
    el.addEventListener('click', ev => { ev.stopPropagation(); onPick(a); });
    alertMarkers.set(a.id, { m: new Marker({ element: el, opacityWhenCovered: '0' }).setLngLat([a.lon, a.lat]), on: false });
  }
  const show = (rec: { m: Marker; on: boolean }, on: boolean) => {
    if (on && !rec.on) rec.m.addTo(map);
    if (!on && rec.on) rec.m.remove();
    rec.on = on;
  };

  /* ---------- time window + layer toggles ---------- */
  function update(s: AppState) {
    const start = windowStart(data, s);
    const timeFilter = ['all', ['>=', ['get', 't'], start], ['<=', ['get', 't'], s.end]] as never;
    map.setFilter('quakes', timeFilter);
    map.setFilter('fires', timeFilter);
    map.setFilter('fires-glow', timeFilter);
    const pulseFilter = ['all', ['>=', ['get', 'mag'], 4.5], ['>=', ['get', 't'], s.end - 12 * HOUR], ['<=', ['get', 't'], s.end]] as never;
    PULSE_LAYERS.forEach(id => map.setFilter(id, pulseFilter));
    // Events from the last 24 h are brighter.
    const recent = ['>=', ['get', 't'], s.end - DAY] as never;
    map.setPaintProperty('quakes', 'circle-color', ['case', ['>=', ['get', 'mag'], 6], 'rgba(255,77,109,.3)', recent, 'rgba(255,210,63,.32)', 'rgba(255,210,63,.16)']);
    map.setPaintProperty('quakes', 'circle-stroke-opacity', ['case', recent, 1, .7]);

    const vis = (on: boolean) => on ? 'visible' : 'none';
    for (const id of ['quakes', ...PULSE_LAYERS]) map.setLayoutProperty(id, 'visibility', vis(s.layers.quake));
    for (const id of ['fires', 'fires-glow']) map.setLayoutProperty(id, 'visibility', vis(s.layers.fire));
    for (const id of ['storm-past', 'storm-pts', 'storm-forecast']) map.setLayoutProperty(id, 'visibility', vis(s.layers.storm));

    // Storm tracks up to the scrubber time; forecasts only when looking at "now".
    const past: Feature<LineString>[] = [], fcst: Feature<LineString>[] = [], dots: Feature<Point>[] = [];
    const live = s.end >= data.now - 3 * HOUR;
    for (const st of data.storms) {
      const cur = s.layers.storm ? stormNow(data, s, st) : null;
      const rec = stormMarkers.get(st.id)!;
      show(rec, !!cur);
      if (!cur) continue;
      const done = st.pts.filter(p => p.t <= s.end);
      past.push(line(done.map(p => [p.lon, p.lat])));
      done.forEach(p => dots.push(pt(p.lon, p.lat, { cat: p.cat, forecast: false })));
      if (live) {
        fcst.push(line([[cur.lon, cur.lat], ...st.forecast.map(([la, lo]) => [lo, la])]));
        st.forecast.forEach(([la, lo]) => dots.push(pt(lo, la, { cat: 0, forecast: true })));
      }
      rec.m.setLngLat([cur.lon, cur.lat]);
      rec.el.style.setProperty('--d', `${(9 + cur.cat * 2) * 2}px`);
    }
    map.getSource<GeoJSONSource>('storm-past')?.setData(fc(past));
    map.getSource<GeoJSONSource>('storm-forecast')?.setData(fc(fcst));
    map.getSource<GeoJSONSource>('storm-pts')?.setData(fc(dots));

    for (const a of data.alerts) show(alertMarkers.get(a.id)!, s.layers.alert && inWindow(data, s, a.t));
  }

  /* ---------- picking ---------- */
  const pickAt = (x: number, y: number) => {
    const f = map.queryRenderedFeatures([[x - 4, y - 4], [x + 4, y + 4]], { layers: PICKABLE });
    return f.length ? byId.get(f[0].properties.id as string) ?? null : null;
  };
  map.on('click', e => onPick(pickAt(e.point.x, e.point.y)));
  map.on('mousemove', e => { map.getCanvas().style.cursor = pickAt(e.point.x, e.point.y) ? 'pointer' : ''; });

  /* ---------- pulse rings on recent strong quakes ---------- */
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastFrame = 0;
  function pulse(now: number) {
    requestAnimationFrame(pulse);
    if (now - lastFrame < 40 || !store.get().layers.quake) return;
    lastFrame = now;
    PULSE_LAYERS.forEach((id, i) => {
      const f = ((now % 2000) / 2000 + i * .5) % 1;
      map.setPaintProperty(id, 'circle-radius', byZoom(['*', QUAKE_R, 1 + f * 2.2]));
      map.setPaintProperty(id, 'circle-stroke-color', ['case', ['>=', ['get', 'mag'], 6], `rgba(255,77,109,${.7 * (1 - f)})`, `rgba(255,210,63,${.6 * (1 - f)})`]);
    });
  }
  if (!reduceMotion) requestAnimationFrame(pulse);

  return { update };
}

function line(coordinates: number[][]): Feature<LineString> {
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } };
}

