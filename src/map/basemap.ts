import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import type { Feature, FeatureCollection, GeoJSON, LineString, Polygon } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { feature, mesh } from 'topojson-client';
// Natural Earth 1:50m countries, served as a separate static file so the JS bundle stays small.
import worldUrl from 'world-atlas/countries-50m.json?url';
import { DAY } from '../time';

const RAD = Math.PI / 180;
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * A self-contained dark globe: ocean, graticule, land, borders and a day/night shadow.
 * No tile server or API key is needed, which keeps the GitHub Pages build free to host.
 */
export function baseStyle() {
  return {
    version: 8 as const,
    projection: { type: 'globe' },
    sky: {
      'sky-color': '#05080d',
      'horizon-color': '#1d4a72',
      'fog-color': '#0b1726',
      'sky-horizon-blend': .6,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0]
    },
    sources: {
      graticule: { type: 'geojson' as const, data: graticule() },
      land: { type: 'geojson' as const, data: EMPTY },
      borders: { type: 'geojson' as const, data: EMPTY },
      night: { type: 'geojson' as const, data: EMPTY }
    },
    layers: [
      { id: 'ocean', type: 'background' as const, paint: { 'background-color': '#0e1f33' } },
      { id: 'graticule', type: 'line' as const, source: 'graticule', paint: { 'line-color': 'rgba(140,175,215,.08)', 'line-width': .7 } },
      { id: 'land', type: 'fill' as const, source: 'land', paint: { 'fill-color': '#1b2a3b' } },
      { id: 'land-outline', type: 'line' as const, source: 'land', paint: { 'line-color': 'rgba(160,195,230,.22)', 'line-width': .6 } },
      { id: 'borders', type: 'line' as const, source: 'borders', paint: { 'line-color': 'rgba(150,185,220,.16)', 'line-width': .6 } },
      {
        id: 'night', type: 'fill' as const, source: 'night',
        paint: { 'fill-color': '#02050c', 'fill-opacity': ['get', 'a'], 'fill-antialias': false }
      }
    ]
  };
}

/** Fetch the world outlines and fill the land and border sources. */
export async function loadWorld(map: MlMap): Promise<void> {
  const topo = await (await fetch(worldUrl)).json() as Topology<{ countries: GeometryCollection; land: GeometryCollection }>;
  setData(map, 'land', feature(topo, topo.objects.land));
  setData(map, 'borders', mesh(topo, topo.objects.countries, (a, b) => a !== b));
}

export function setNight(map: MlMap, t: number | null): void {
  setData(map, 'night', t == null ? EMPTY : nightShade(t));
}

function setData(map: MlMap, id: string, data: GeoJSON) {
  map.getSource<GeoJSONSource>(id)?.setData(data);
}

function graticule(): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = [];
  const line = (coordinates: number[][]): Feature<LineString> => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } });
  for (let lon = -180; lon < 180; lon += 10) {
    const c = [];
    for (let lat = -80; lat <= 80; lat += 4) c.push([lon, lat]);
    features.push(line(c));
  }
  for (let lat = -80; lat <= 80; lat += 10) {
    const c = [];
    for (let lon = -180; lon <= 180; lon += 4) c.push([lon, lat]);
    features.push(line(c));
  }
  return { type: 'FeatureCollection', features };
}

/** Approximate sub-solar point: [longitude, declination] in degrees. */
export function sunPosition(t: number): [number, number] {
  const d = new Date(t);
  const doy = (t - Date.UTC(d.getUTCFullYear(), 0, 0)) / DAY;
  const decl = 23.44 * Math.sin(2 * Math.PI * (doy - 81) / 365);
  const hrs = d.getUTCHours() + d.getUTCMinutes() / 60;
  return [-(hrs - 12) * 15, decl];
}

/**
 * Night side as three stacked polygons (sun elevation below 0°, -6° and -12°) for a soft twilight edge.
 * Each polygon runs west to east along the line of equal sun elevation, then closes over the dark pole,
 * so it never crosses the antimeridian.
 */
function nightShade(t: number): FeatureCollection<Polygon> {
  const [sunLon, rawDecl] = sunPosition(t);
  const decl = Math.abs(rawDecl) < .1 ? .1 : rawDecl;
  const darkPole = decl > 0 ? -90 : 90;
  const features = [0, -6, -12].map((elev): Feature<Polygon> => {
    const ring: number[][] = [];
    for (let lon = -180; lon <= 180; lon += 2) {
      // Solve sin(lat)·sin(decl) + cos(lat)·cos(decl)·cos(H) = sin(elev) for lat.
      const a = Math.sin(decl * RAD), b = Math.cos(decl * RAD) * Math.cos((lon - sunLon) * RAD);
      const r = Math.hypot(a, b);
      const s = Math.asin(Math.max(-1, Math.min(1, Math.sin(elev * RAD) / r)));
      const alpha = Math.atan2(b, a);
      // Two solutions; keep the one nearest the terminator (elevation 0), which has a closed form.
      const terminator = Math.atan(-b / a) / RAD;
      const lat = [s - alpha, Math.PI - s - alpha]
        .map(x => Math.atan2(Math.sin(x), Math.cos(x)) / RAD)
        .reduce((p, q) => Math.abs(q - terminator) < Math.abs(p - terminator) ? q : p);
      ring.push([lon, Math.max(-90, Math.min(90, lat))]);
    }
    ring.push([180, darkPole], [-180, darkPole], ring[0]);
    return { type: 'Feature', properties: { a: .12 }, geometry: { type: 'Polygon', coordinates: [ring] } };
  });
  return { type: 'FeatureCollection', features };
}
