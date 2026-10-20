import type { BasemapId, Store, Theme } from '../state';
import { BASEMAPS } from '../map/basemap';
import { esc } from './format';

const KEY = 'hazard-pulse:look';
const SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
const MOON = '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>';

/** The saved theme and basemap, falling back to the dark look. */
export function savedLook(): { theme: Theme; basemap: BasemapId } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const theme: Theme = v.theme === 'light' ? 'light' : 'dark';
    const basemap = BASEMAPS.some(b => b.id === v.basemap) ? v.basemap as BasemapId : theme;
    return { theme, basemap };
  } catch {
    return { theme: 'dark', basemap: 'dark' };
  }
}

/** Put the theme on <html> so the CSS tokens switch. */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#e9eef4' : '#05080d');
}

/** Theme toggle and basemap menu in the map controls. Switching theme also swaps a Dark or Light basemap. */
export function createLookControls(store: Store) {
  const themeBtn = document.getElementById('themeBtn')!;
  const mapBtn = document.getElementById('basemapBtn')!;
  const menu = document.getElementById('basemapMenu')!;

  menu.innerHTML = BASEMAPS.map(b =>
    `<button role="menuitemradio" data-id="${b.id}"><i style="background:${b.swatch}"></i>${esc(b.label)}</button>`).join('');
  const setOpen = (open: boolean) => { menu.hidden = !open; mapBtn.setAttribute('aria-expanded', String(open)); };
  mapBtn.onclick = ev => { ev.stopPropagation(); setOpen(!!menu.hidden); };
  menu.onclick = ev => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-id]');
    if (b) { store.set({ basemap: b.dataset.id as BasemapId }); setOpen(false); }
  };
  document.addEventListener('click', ev => { if (!menu.hidden && !menu.contains(ev.target as Node)) setOpen(false); });
  addEventListener('keydown', ev => { if (ev.key === 'Escape') setOpen(false); });

  themeBtn.onclick = () => {
    const { theme, basemap } = store.get();
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    store.set({ theme: next, basemap: basemap === 'dark' || basemap === 'light' ? next : basemap });
  };

  function render() {
    const { theme, basemap } = store.get();
    const other = theme === 'dark' ? 'light' : 'dark';
    themeBtn.setAttribute('aria-label', `Switch to ${other} theme`);
    themeBtn.title = `Switch to ${other} theme`;
    themeBtn.querySelector('svg')!.innerHTML = theme === 'dark' ? SUN : MOON;
    menu.querySelectorAll('[data-id]').forEach(b => b.setAttribute('aria-checked', String(b.getAttribute('data-id') === basemap)));
    try { localStorage.setItem(KEY, JSON.stringify({ theme, basemap })); } catch { /* storage blocked: the choice just isn't remembered */ }
  }
  store.subscribe((s, prev) => { if (s.theme !== prev.theme || s.basemap !== prev.basemap) render(); });
  render();
}
