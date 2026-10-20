import type { HazardEvent, HazardType } from '../data';
import { type Store, type Tab, isVisible, stormNow, windowStart } from '../state';
import { MINUTE, ago, fmtClock, fmtDayClock } from '../time';
import { COLORS, cap, catLabel, esc, windKt } from './format';
import { ICON } from './icons';

interface Item { e: HazardEvent; kind: HazardType; color: string; t1: string; t2: string; badge: string; t: number }

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** Right-hand panel: live status, KPI tiles, type tabs and the event list. Also owns the search box. */
export function createPanel(store: Store, select: (e: HazardEvent | null, fly?: boolean) => void) {
  const { data } = store;

  function items(): Item[] {
    const s = store.get(), out: Item[] = [];
    const want = (t: HazardType) => s.tab === 'all' || s.tab === t;
    if (want('quake')) for (const e of data.quakes) {
      // "All" shows only M4.5+, the Earthquakes tab shows everything.
      if (!isVisible(data, s, e) || (s.tab !== 'quake' && e.mag < 4.5)) continue;
      out.push({ e, kind: 'quake', color: e.mag >= 6 ? COLORS.quakeStrong : COLORS.quake, t1: `M ${e.mag.toFixed(1)} ${e.place}`, t2: `${ago(e.t, s.end)} · ${e.depth} km deep`, badge: `M${e.mag.toFixed(1)}`, t: e.t });
    }
    if (want('fire')) for (const c of data.clusters) {
      const pts = c.points.filter(p => isVisible(data, s, p));
      if (!pts.length) continue;
      const latest = Math.max(...pts.map(p => p.t));
      out.push({ e: c, kind: 'fire', color: COLORS.fire, t1: c.region, t2: `Latest ${ago(latest, s.end)}`, badge: `${pts.length} fires`, t: latest });
    }
    if (want('storm')) for (const st of data.storms) {
      const c = stormNow(data, s, st);
      if (!c || !s.layers.storm) continue;
      out.push({ e: st, kind: 'storm', color: COLORS.storm, t1: st.name, t2: `${catLabel(c.cat)} · ${windKt(c.cat)} kt winds`, badge: c.cat ? `Cat ${c.cat}` : 'TS', t: c.t });
    }
    if (want('alert')) for (const a of data.alerts) {
      if (!isVisible(data, s, a)) continue;
      out.push({ e: a, kind: 'alert', color: COLORS.level(a.level), t1: `${a.title} · ${a.place}`, t2: `${ago(a.t, s.end)} · ${a.pop} affected`, badge: cap(a.level), t: a.t });
    }
    const q = s.q.toLowerCase();
    return out.filter(i => !q || `${i.t1} ${i.t2}`.toLowerCase().includes(q)).sort((a, b) => b.t - a.t);
  }

  function renderList() {
    const s = store.get(), list = $('list'), rows = items();
    if (!rows.length) {
      list.innerHTML = `<div class="empty">No events match${s.q ? ` “${esc(s.q)}”` : ''} in this time window.</div>`;
      return;
    }
    list.replaceChildren(...rows.slice(0, 80).map(it => {
      const b = document.createElement('button');
      b.className = 'item' + (s.sel === it.e ? ' sel' : '');
      b.style.setProperty('--c', it.color);
      b.innerHTML = `<span class="ico">${ICON[it.kind]}</span><span class="txt"><div class="t1">${esc(it.t1)}</div><div class="t2">${esc(it.t2)}</div></span><span class="badge">${esc(it.badge)}</span>`;
      b.onclick = () => select(it.e);
      return b;
    }));
  }

  function renderKpis() {
    const s = store.get();
    const q = data.quakes.filter(e => isVisible(data, s, e));
    const big = q.reduce<typeof q[number] | null>((m, e) => !m || e.mag > m.mag ? e : m, null);
    const f = data.fires.filter(e => isVisible(data, s, e));
    const st = data.storms.filter(e => isVisible(data, s, e));
    const al = data.alerts.filter(e => isVisible(data, s, e));
    const strongest = Math.max(...st.map(x => stormNow(data, s, x)!.cat));
    const tiles: [string, string, number, string][] = [
      ['Earthquakes', COLORS.quake, q.length, big ? `Largest M ${big.mag.toFixed(1)}` : 'None in window'],
      ['Fire detections', COLORS.fire, f.length, f.length ? `${new Set(f.map(p => p.region)).size} active regions` : 'None in window'],
      ['Active storms', COLORS.storm, st.length, st.length ? `Strongest ${catLabel(strongest)}` : 'None in window'],
      ['Alerts', COLORS.level('orange'), al.length, `${al.filter(a => a.level === 'red').length} red · ${al.filter(a => a.level === 'orange').length} orange`]
    ];
    $('kpis').innerHTML = tiles.map(([l, c, v, sub]) =>
      `<div class="kpi" style="--c:${c}"><span class="k-lbl"><i></i>${esc(l)}</span><span class="k-val num">${v.toLocaleString('en-US')}</span><span class="k-sub">${esc(sub)}</span></div>`).join('');
    const counts: Record<HazardType, number> = { quake: q.length, fire: f.length, storm: st.length, alert: al.length };
    document.querySelectorAll<HTMLElement>('[data-count]').forEach(el => { el.textContent = String(counts[el.dataset.count as HazardType]); });
  }

  function renderHead() {
    const s = store.get();
    const live = s.end >= data.now - 30 * MINUTE;
    $('eyebrow').textContent = live ? `Live · updated ${fmtClock(data.now)} UTC` : 'Replaying history';
    $('liveDot').style.background = COLORS.level(live ? 'green' : 'orange');
    $('panelTitle').textContent = s.win === 1 ? 'Last 24 hours' : `Last ${s.win} days`;
    $('panelSub').textContent = `${fmtDayClock(windowStart(data, s))} to ${fmtDayClock(s.end)} UTC`;
  }

  /* ---------- controls ---------- */
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach(b => b.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t === b)));
    store.set({ tab: b.dataset.tab as Tab });
  });
  $<HTMLInputElement>('q').addEventListener('input', e => store.set({ q: (e.target as HTMLInputElement).value.trim() }));

  const panel = $('panel'), sheetBtn = $('sheetBtn');
  sheetBtn.onclick = () => {
    const open = panel.classList.toggle('open');
    sheetBtn.setAttribute('aria-expanded', String(open));
    if (open) select(null);
  };

  store.subscribe((s, prev) => {
    const timeOrLayers = s.end !== prev.end || s.win !== prev.win || s.layers !== prev.layers;
    if (timeOrLayers) { renderHead(); renderKpis(); }
    if (timeOrLayers || s.tab !== prev.tab || s.q !== prev.q || s.sel !== prev.sel) renderList();
    if (s.sel && s.sel !== prev.sel) { panel.classList.remove('open'); sheetBtn.setAttribute('aria-expanded', 'false'); }
  });
  renderHead(); renderKpis(); renderList();
}
