import type { Dataset } from './types';
import { sampleDataset } from './sample';
import { HOUR } from '../time';

/**
 * Single entry point for data. Today it returns seeded sample data; live feeds plug in here:
 * - Earthquakes: USGS GeoJSON summary feeds (no key), e.g. all_week.geojson
 * - Wildfires: NASA FIRMS area API (free map key, see .env.example)
 * - Storms and alerts: GDACS event list
 */
export async function loadDataset(): Promise<Dataset> {
  const now = Math.floor(Date.now() / HOUR) * HOUR;
  return sampleDataset(now);
}

export type * from './types';
