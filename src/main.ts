import './styles/tokens.css';
import './styles/app.css';
import './styles/map.css';
import { loadDataset, type HazardEvent } from './data';
import { createStore, isVisible } from './state';
import { createMap } from './map';
import { createRail } from './ui/rail';
import { createPanel } from './ui/panel';
import { createTimeline } from './ui/timeline';

async function main() {
  const data = await loadDataset();
  const store = createStore(data);

  // Selecting an event opens its popup; from the list it also flies the globe there.
  function select(e: HazardEvent | null, fly = true) {
    store.set({ sel: e });
    if (e && fly) map.flyTo(e);
  }

  const map = createMap(document.getElementById('map')!, store, select);
  createRail(document.getElementById('rail')!, store);
  createPanel(store, select);
  createTimeline(document.getElementById('tl')!, store);

  document.getElementById('zin')!.onclick = map.zoomIn;
  document.getElementById('zout')!.onclick = map.zoomOut;
  document.getElementById('reset')!.onclick = () => { select(null); map.home(); };
  addEventListener('keydown', e => { if (e.key === 'Escape') select(null); });

  // Drop the selection when it leaves the time window (fire clusters stay, they summarise the region).
  store.subscribe(s => {
    if (s.sel && s.sel.type !== 'firecluster' && !isVisible(data, s, s.sel)) store.set({ sel: null });
  });

  // Open on the largest recent earthquake, as in the prototype.
  if (innerWidth > 860) {
    const biggest = data.quakes.reduce((m, q) => q.mag > m.mag ? q : m);
    setTimeout(() => select(biggest, false), 400);
  }
}

main();
