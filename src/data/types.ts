/** The four hazard layers shown on the map. */
export type HazardType = 'quake' | 'fire' | 'storm' | 'alert';
export type AlertLevel = 'green' | 'orange' | 'red';

export interface Quake {
  id: string;
  type: 'quake';
  place: string;
  lat: number;
  lon: number;
  mag: number;
  /** Depth in km */
  depth: number;
  /** Event time, ms since epoch */
  t: number;
}

/** A single satellite fire detection (one VIIRS pixel). */
export interface Fire {
  id: string;
  type: 'fire';
  region: string;
  clusterId: string;
  lat: number;
  lon: number;
  /** Fire radiative power, MW */
  frp: number;
  conf: 'High' | 'Nominal';
  sat: string;
  t: number;
}

/** Detections grouped by region, used for the event list. */
export interface FireCluster {
  id: string;
  type: 'firecluster';
  region: string;
  lat: number;
  lon: number;
  points: Fire[];
}

export interface StormPoint {
  lat: number;
  lon: number;
  t: number;
  /** Saffir-Simpson category, 0 = tropical storm */
  cat: number;
}

export interface Storm {
  id: string;
  type: 'storm';
  name: string;
  kind: string;
  pts: StormPoint[];
  /** Forecast positions as [lat, lon] */
  forecast: [number, number][];
}

export interface Alert {
  id: string;
  type: 'alert';
  title: string;
  place: string;
  lat: number;
  lon: number;
  level: AlertLevel;
  /** People affected, as published */
  pop: string;
  t: number;
}

export type HazardEvent = Quake | Fire | FireCluster | Storm | Alert;

/** Everything the dashboard draws, for the period [start, now]. */
export interface Dataset {
  now: number;
  start: number;
  /** Where the data came from, shown in popups */
  sample: boolean;
  quakes: Quake[];
  fires: Fire[];
  clusters: FireCluster[];
  storms: Storm[];
  alerts: Alert[];
}
