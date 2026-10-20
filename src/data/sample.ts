import type { Alert, Dataset, Fire, FireCluster, Quake, Storm } from './types';
import { DAY, HOUR } from '../time';

/**
 * Sample data shaped like the real feeds (USGS, NASA FIRMS, GDACS).
 * It is seeded, so the same events appear on every load, and placed relative to `now`
 * so the dashboard always looks current. Replace with live feeds in `src/data/index.ts`.
 */
export function sampleDataset(now: number): Dataset {
  let seed = 20261018;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const gauss = () => {
    let u = 0, v = 0;
    while (!u) u = rnd();
    while (!v) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  // [place, lat, lon, magnitude, hours ago, depth km]
  const quakeSources: [string, number, number, number, number, number][] = [
    ['off the east coast of Honshu, Japan', 38.3, 142.4, 6.8, 9, 24],
    ['Tonga Islands', -21.2, -175.1, 5.9, 40, 110],
    ['offshore Coquimbo, Chile', -31.6, -71.8, 5.4, 70, 38],
    ['Andreanof Islands, Aleutians, Alaska', 51.8, -176.3, 5.1, 100, 45],
    ['southern Sumatra, Indonesia', -2.5, 99.8, 5.6, 30, 52],
    ['New Britain region, Papua New Guinea', -5.8, 151.3, 6.1, 55, 60],
    ['near the coast of Oaxaca, Mexico', 15.9, -97.6, 4.9, 20, 18],
    ['eastern Türkiye', 38.1, 37.9, 4.6, 130, 10],
    ['Reykjanes Peninsula, Iceland', 63.9, -22.4, 3.8, 6, 4],
    ['Mindanao, Philippines', 7.1, 126.6, 5.3, 85, 33],
    ['Vanuatu Islands', -16.8, 168.2, 5.0, 150, 200],
    ['near the coast of northern Peru', -9.4, -79.1, 4.7, 60, 41],
    ['Dodecanese Islands, Greece', 36.4, 25.4, 4.4, 26, 12],
    ['central Nepal', 28.2, 84.7, 4.8, 115, 15],
    ['central California', 36.6, -121.2, 3.9, 20, 8],
    ['Kuril Islands', 46.2, 152.1, 5.2, 160, 48],
    ['Cook Strait, New Zealand', -41.6, 174.2, 4.5, 75, 22],
    ['Fiji region', -18.1, -178.4, 5.5, 60, 560]
  ];
  const quakes: Quake[] = [];
  quakeSources.forEach(([place, lat, lon, mag, ageH, depth], i) => {
    const t = now - ageH * HOUR;
    quakes.push({ id: 'q' + i, type: 'quake', place, lat, lon, mag, depth, t });
    // Aftershocks
    const after = mag >= 5.5 ? 6 + Math.floor(rnd() * 6) : Math.floor(rnd() * 3);
    for (let a = 0; a < after; a++) {
      const at = t + rnd() * Math.min(ageH * HOUR, 3 * DAY);
      if (at > now) continue;
      quakes.push({
        id: `q${i}a${a}`, type: 'quake', place,
        lat: lat + gauss() * .35, lon: lon + gauss() * .35,
        mag: Math.round((2.6 + rnd() * (mag - 2.8)) * 10) / 10,
        depth: Math.max(2, Math.round(depth + gauss() * 8)), t: at
      });
    }
  });

  // [region, lat, lon, spread in degrees, detections]
  const fireRegions: [string, number, number, number, number][] = [
    ['Northern Territory, Australia', -14.2, 132.4, 2.2, 90],
    ['Northern California, USA', 39.6, -121.6, .7, 45],
    ['Rondônia, Brazil', -9.4, -62.8, 2.0, 110],
    ['Angola and southern DR Congo', -9.8, 20.5, 3.0, 120],
    ['Sakha Republic, Russia', 61.2, 125.4, 1.8, 40],
    ['British Columbia, Canada', 55.4, -122.6, 1.2, 35],
    ['Central Kalimantan, Indonesia', -1.8, 113.6, 1.0, 50],
    ['Attica and Euboea, Greece', 38.6, 23.6, .5, 18]
  ];
  const fires: Fire[] = [];
  const clusters: FireCluster[] = fireRegions.map(([region, lat, lon, spread, n], ci) => {
    const c: FireCluster = { id: 'f' + ci, type: 'firecluster', region, lat, lon, points: [] };
    for (let k = 0; k < n; k++) {
      const age = Math.pow(rnd(), 1.7) * 7 * DAY;
      const p: Fire = {
        id: `f${ci}-${k}`, type: 'fire', region, clusterId: c.id,
        lat: lat + gauss() * spread * .5, lon: lon + gauss() * spread * .7,
        frp: Math.round(4 + Math.pow(rnd(), 3) * 220), conf: rnd() > .3 ? 'High' : 'Nominal',
        sat: rnd() > .5 ? 'NOAA-20 VIIRS' : 'Suomi NPP VIIRS', t: now - age
      };
      c.points.push(p);
      fires.push(p);
    }
    return c;
  });

  function track(
    id: string, name: string, kind: string, start: [number, number], end: [number, number],
    startAgeH: number, steps: number, cats: number[], forecast: [number, number][]
  ): Storm {
    const pts = [];
    for (let s = 0; s < steps; s++) {
      const f = s / (steps - 1);
      const curve = Math.sin(f * Math.PI) * 2.2;
      pts.push({
        lat: start[0] + (end[0] - start[0]) * f + curve * .4,
        lon: start[1] + (end[1] - start[1]) * f - curve * .3,
        t: now - startAgeH * HOUR + s * 6 * HOUR,
        cat: cats[Math.min(cats.length - 1, Math.floor(f * cats.length))]
      });
    }
    return { id, type: 'storm', name, kind, pts, forecast };
  }
  const storms: Storm[] = [
    track('s0', 'Typhoon 27W', 'Typhoon', [11.8, 146.5], [20.6, 127.2], 120, 21, [1, 2, 3, 4, 4, 3], [[23.2, 123.4], [26.1, 121.0], [29.4, 122.6]]),
    track('s1', 'Hurricane 14L', 'Hurricane', [14.6, -44.8], [21.4, -61.0], 96, 17, [1, 1, 2, 2, 3], [[24.0, -65.2], [27.8, -67.4], [32.5, -66.0]]),
    track('s2', 'Cyclone 03A', 'Tropical storm', [13.5, 66.0], [17.8, 61.2], 60, 11, [0, 1, 1, 0], [[19.0, 58.6]])
  ];

  const alertRows: [string, string, number, number, Alert['level'], number, string][] = [
    ['Flooding', 'Sylhet and Sunamganj, Bangladesh', 24.6, 91.6, 'orange', 70, '1.2 million'],
    ['Flooding', 'Benue and Kogi States, Nigeria', 7.6, 7.4, 'red', 130, '640,000'],
    ['Drought', 'Somali Region, Ethiopia', 6.5, 43.5, 'orange', 160, '2.3 million'],
    ['Volcanic activity', 'Klyuchevskoy, Kamchatka', 56.06, 160.64, 'green', 30, 'Under 1,000'],
    ['Flooding', 'Valencia Region, Spain', 39.3, -0.5, 'orange', 16, '85,000'],
    ['Tropical cyclone', 'Batanes and Babuyan, Philippines', 20.4, 121.9, 'red', 8, '310,000']
  ];
  const alerts: Alert[] = alertRows.map(([title, place, lat, lon, level, ageH, pop], i) => ({
    id: 'a' + i, type: 'alert', title, place, lat, lon, level, pop, t: now - ageH * HOUR
  }));

  return { now, start: now - 7 * DAY, sample: true, quakes, fires, clusters, storms, alerts };
}
