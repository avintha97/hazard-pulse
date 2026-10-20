import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, MarkAreaComponent, MarkLineComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { type Store, windowStart } from '../state';
import { DAY, HOUR, fmtClock, fmtDay, fmtWeekday } from '../time';
import { COLORS, cssVar } from './format';

echarts.use([BarChart, GridComponent, MarkAreaComponent, MarkLineComponent, CanvasRenderer]);

const BIN = 6 * HOUR;
/** A full week plays back in this many ms. */
const PLAY_MS = 9000;

/** Bottom timeline: events per 6 hours (ECharts), a draggable scrubber, play/pause and window chips. */
export function createTimeline(el: HTMLElement, store: Store) {
  const { data } = store;
  const times = [...data.quakes, ...data.fires, ...data.alerts].map(e => e.t);
  const bins: [number, number][] = [];
  for (let b0 = data.start; b0 < data.now; b0 += BIN) bins.push([b0 + BIN / 2, times.filter(t => t >= b0 && t < b0 + BIN).length]);

  const chart = echarts.init(el, null, { renderer: 'canvas' });
  const fg3 = COLORS.fg3, fg = COLORS.fg, font = cssVar('--font-data');

  function render() {
    const s = store.get(), start = windowStart(data, s);
    const narrow = el.clientWidth < 520;
    chart.setOption({
      animation: false,
      grid: { left: 2, right: 2, top: 4, bottom: 14 },
      xAxis: {
        type: 'time', min: data.start, max: data.now,
        axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false },
        axisLabel: {
          color: fg3, fontFamily: font, fontSize: 10, margin: 4, hideOverlap: true,
          interval: narrow ? 1 : 0,
          formatter: (v: number) => fmtDay(v)
        },
        splitNumber: 7
      },
      yAxis: { type: 'value', show: false },
      series: [{
        type: 'bar',
        barCategoryGap: '20%',
        barWidth: '80%',
        data: bins.map(([t, n]) => ({
          value: [t, n],
          itemStyle: {
            borderRadius: 1.5,
            color: t + BIN / 2 > start && t - BIN / 2 < s.end ? 'rgba(108,196,255,.75)' : 'rgba(167,180,196,.22)'
          }
        })),
        markArea: { silent: true, itemStyle: { color: 'rgba(108,196,255,.07)' }, data: [[{ xAxis: start }, { xAxis: s.end }]] },
        markLine: {
          silent: true, symbol: ['none', 'circle'], symbolSize: 9, label: { show: false },
          itemStyle: { color: fg }, lineStyle: { color: fg, width: 2, type: 'solid' },
          data: [{ xAxis: s.end }]
        }
      }]
    }, { lazyUpdate: true });
    document.getElementById('tlTime')!.innerHTML =
      `<span class="num">${fmtWeekday(s.end)}<span class="yr">, ${fmtClock(s.end)} UTC</span></span>`;
  }

  /* ---------- scrubbing ---------- */
  const clampEnd = (t: number) => Math.max(data.start + BIN, Math.min(data.now, t));
  const scrub = (ev: PointerEvent) => {
    const x = ev.clientX - el.getBoundingClientRect().left;
    const t = chart.convertFromPixel({ gridIndex: 0 }, [x, 10])[0];
    if (!Number.isFinite(t)) return;
    if (store.get().playing) setPlaying(false);
    store.set({ end: clampEnd(t) });
  };
  el.addEventListener('pointerdown', ev => { el.setPointerCapture(ev.pointerId); scrub(ev); el.addEventListener('pointermove', scrub); });
  const stop = () => el.removeEventListener('pointermove', scrub);
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);

  /* ---------- playback ---------- */
  const playBtn = document.getElementById('play')!, playIco = document.getElementById('playIco')!;
  let raf = 0;
  function setPlaying(on: boolean) {
    cancelAnimationFrame(raf);
    playBtn.setAttribute('aria-label', on ? 'Pause timeline' : 'Play timeline');
    playIco.setAttribute('d', on ? 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z' : 'M7 4.5v15l13-7.5z');
    const patch: { playing: boolean; end?: number } = { playing: on };
    if (on && store.get().end >= data.now - HOUR) patch.end = data.start + BIN;
    store.set(patch);
    if (!on) return;
    let prev = performance.now();
    const step = (now: number) => {
      const next = store.get().end + (now - prev) * (7 * DAY / PLAY_MS);
      prev = now;
      if (next >= data.now) { store.set({ end: data.now }); setPlaying(false); return; }
      store.set({ end: next });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  playBtn.onclick = () => setPlaying(!store.get().playing);

  document.querySelectorAll<HTMLButtonElement>('.chip').forEach(b => b.onclick = () => {
    document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    store.set({ win: Number(b.dataset.win) as 1 | 3 | 7 });
  });

  store.subscribe((s, prev) => { if (s.end !== prev.end || s.win !== prev.win) render(); });
  new ResizeObserver(() => { chart.resize(); render(); }).observe(el);
  render();
}
