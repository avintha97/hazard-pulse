export const MINUTE = 60e3;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number) => String(n).padStart(2, '0');

/** "14:05" */
export const fmtClock = (t: number) => { const d = new Date(t); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
/** "Oct 18" */
export const fmtDay = (t: number) => { const d = new Date(t); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };
/** "Sat Oct 18" */
export const fmtWeekday = (t: number) => `${DAYS[new Date(t).getUTCDay()]} ${fmtDay(t)}`;
/** "Oct 18 14:05" */
export const fmtDayClock = (t: number) => `${fmtDay(t)} ${fmtClock(t)}`;
/** "Oct 18, 14:05 UTC" */
export const fmtFull = (t: number) => `${fmtDay(t)}, ${fmtClock(t)} UTC`;

/** "5 min ago", "3 h ago", "2 days ago", relative to `ref` */
export function ago(t: number, ref: number): string {
  const m = (ref - t) / MINUTE;
  if (m < 60) return `${Math.max(1, Math.round(m))} min ago`;
  if (m < 60 * 36) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
}
