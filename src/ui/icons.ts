import type { HazardType } from '../data';

const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICON: Record<HazardType | 'night', string> = {
  quake: svg('<path d="M2 12h4l2-6 4 13 3-10 2 3h5"/>'),
  fire: svg('<path d="M12 22c4 0 7-2.7 7-7 0-4.5-4-7-5-11-2 2-3 4-3 6-1-1-1.5-2-1.5-3C7 9 5 11.5 5 15c0 4.3 3 7 7 7z"/>'),
  storm: svg('<circle cx="12" cy="12" r="2.5"/><path d="M4.5 9.5C6 4.5 13 3 17.5 6.5"/><path d="M19.5 14.5C18 19.5 11 21 6.5 17.5"/>'),
  alert: svg('<path d="M12 3 22 20H2z"/><path d="M12 10v4.5"/><path d="M12 17.5v.01"/>'),
  night: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>')
};
