import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import type { Feature, FeatureCollection, GeoJSON, LineString, Polygon } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { feature, mesh } from 'topojson-client';
// Natural Earth 1:50m countries, served as a separate static file so the JS bundle stays small.
import worldUrl from 'world-atlas/countries-50m.json?url';
import { DAY } from '../time';
import type { BasemapId, Theme } from '../state';

const RAD = Math.PI / 180;
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Colours for the self-contained vector globe, one set per look. */
const VECTOR = {
  dark: {
    sky: '#05080d', horizon: '#1d4a72', fog: '#0b1726', ocean: '#0e1f33', land: '#1b2a3b',
    graticule: 'rgba(140,175,215,.08)', outline: 'rgba(160,195,230,.22)', borders: 'rgba(150,185,220,.16)', night: '#02050c'
  },
  light: {
    sky: '#e4ebf2', horizon: '#9fc6e8', fog: '#eef3f8', ocean: '#9fc2e0', land: '#f7f5ef',
    graticule: 'rgba(40,80,130,.1)', outline: 'rgba(60,85,120,.3)', borders: 'rgba(60,85,120,.25)', night: '#0b1a33'
  }
};

/** Free raster tile services that need no API key. Their tiles only load while that basemap is shown. */
const RASTER: Record<Exclude<BasemapId, 'dark' | 'light'>, { tiles: string[]; attribution: string; maxzoom: number }> = {
  satellite: {
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics', maxzoom: 18
  },
  topo: {
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
    attribution: 'Topographic map © Esri and contributors', maxzoom: 18
  },
  streets: {
    tiles: ['a', 'b', 'c'].map(s => `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png`),
    attribution: '© OpenStreetMap contributors © CARTO', maxzoom: 19
  }
};
const RASTER_IDS = Object.keys(RASTER) as (keyof typeof RASTER)[];

/** Basemap choices in menu order. `swatch` is a CSS background for the little preview square. */
export const BASEMAPS: { id: BasemapId; label: string; swatch: string }[] = [
  { id: 'dark', label: 'Dark', swatch: 'linear-gradient(135deg, #0e1f33 50%, #1b2a3b 50%)' },
  { id: 'light', label: 'Light', swatch: 'linear-gradient(135deg, #9fc2e0 50%, #f7f5ef 50%)' },
  { id: 'satellite', label: 'Satellite', swatch: 'linear-gradient(135deg, #12304a 30%, #3f5a2c 55%, #a08a5a)' },
  { id: 'topo', label: 'Topographic', swatch: 'linear-gradient(135deg, #a9cfe6 40%, #dfe6c8 60%, #c9b48c)' },
  { id: 'streets', label: 'Streets', swatch: 'linear-gradient(135deg, #d4e6f1 45%, #f6f1e7 45%, #f6f1e7 70%, #f2c07a 70%, #f2c07a 76%, #f6f1e7 76%)' }
];

/**
 * The globe style: a self-contained vector globe (ocean, graticule, land, borders, day/night shadow)
 * plus hidden raster layers for the tiled basemaps. The vector globe needs no tile server or API key.
 */
export function baseStyle() {
  const c = VECTOR.dark;
  return {
    version: 8 as const,
    projection: { type: 'globe' },
    sky: skyFor(c),
    sources: {
      graticule: { type: 'geojson' as const, data: graticule() },
      land: { type: 'geojson' as const, data: EMPTY },
      borders: { type: 'geojson' as const, data: EMPTY },
      night: { type: 'geojson' as const, data: EMPTY },
      ...Object.fromEntries(RASTER_IDS.map(id => [id, { type: 'raster' as const, tileSize: 256, ...RASTER[id] }]))
    },
    layers: [
      { id: 'ocean', type: 'background' as const, paint: { 'background-color': c.ocean } },
      ...RASTER_IDS.map(id => ({ id, type: 'raster' as const, source: id, layout: { visibility: 'none' as const } })),
      { id: 'graticule', type: 'line' as const, source: 'graticule', paint: { 'line-color': c.graticule, 'line-width': .7 } },
      { id: 'land', type: 'fill' as const, source: 'land', paint: { 'fill-color': c.land } },
      { id: 'land-outline', type: 'line' as const, source: 'land', paint: { 'line-color': c.outline, 'line-width': .6 } },
      { id: 'borders', type: 'line' as const, source: 'borders', paint: { 'line-color': c.borders, 'line-width': .6 } },
      {
        id: 'night', type: 'fill' as const, source: 'night',
        paint: { 'fill-color': c.night, 'fill-opacity': ['get', 'a'], 'fill-antialias': false }
      }
    ]
  };
}

/** Switch the globe to a basemap. Tiled basemaps take their sky from the page theme. */
export function setBasemap(map: MlMap, id: BasemapId, theme: Theme): void {
  const vector = id === 'dark' || id === 'light';
  const c = VECTOR[vector ? id : theme];
  const vis = (on: boolean) => on ? 'visible' : 'none';
  for (const r of RASTER_IDS) map.setLayoutProperty(r, 'visibility', vis(r === id));
  for (const l of ['graticule', 'land', 'land-outline', 'borders']) map.setLayoutProperty(l, 'visibility', vis(vector));
  map.setPaintProperty('ocean', 'background-color', c.ocean);
  map.setPaintProperty('graticule', 'line-color', c.graticule);
  map.setPaintProperty('land', 'fill-color', c.land);
  map.setPaintProperty('land-outline', 'line-color', c.outline);
  map.setPaintProperty('borders', 'line-color', c.borders);
  map.setPaintProperty('night', 'fill-color', c.night);
  map.setSky(skyFor(c) as never);
}

function skyFor(c: typeof VECTOR.dark) {
  return {
    'sky-color': c.sky,
    'horizon-color': c.horizon,
    'fog-color': c.fog,
    'sky-horizon-blend': .6,
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0]
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
