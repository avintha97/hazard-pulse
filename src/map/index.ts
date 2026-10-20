import { AttributionControl, Map as MlMap, Marker, Popup, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre finds its web worker at runtime, which bundlers can't see, so hand Vite the file explicitly.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { HazardEvent } from '../data';
import { type Store, eventLngLat } from '../state';
import { baseStyle, loadWorld, setBasemap, setNight } from './basemap';
import { addHazardLayers } from './hazards';
import { popupContent } from '../ui/popup';
import { cssVar } from '../ui/format';

setWorkerUrl(workerUrl);

const HOME_CENTER: [number, number] = [150, 12];

/** Room the floating panels take up, so the globe centres in the space that is left. */
function padding() {
  const panel = parseFloat(cssVar('--panel-w')) || 0;
  const desktop = panel > 0;
  return { top: desktop ? 60 : 70, right: desktop ? panel + 32 : 0, bottom: desktop ? 110 : 120, left: desktop ? 70 : 0 };
}

/** Zoom at which the globe fills ~88% of the free space. MapLibre's globe radius is 512·2^zoom / 2π px. */
function homeZoom() {
  const p = padding();
  const r = Math.min(innerWidth - p.left - p.right, innerHeight - p.top - p.bottom) * .44;
  return Math.log2(r * 2 * Math.PI / 512);
}

export function createMap(container: HTMLElement, store: Store, select: (e: HazardEvent | null, fly?: boolean) => void) {
  const map = new MlMap({
    container,
    style: baseStyle() as never,
    center: HOME_CENTER,
    zoom: homeZoom(),
    minZoom: .6,
    maxZoom: 9,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false
  });
  map.addControl(new AttributionControl({ compact: true, customAttribution: 'Boundaries: Natural Earth' }), 'bottom-right');
  map.touchZoomRotate.disableRotation();
  map.setPadding(padding());
  addEventListener('resize', () => map.setPadding(padding()));

  let popup: Popup | null = null;
  let popupFor: HazardEvent | null = null;
  /** Open to the right of the event, or to the left when that would run under the side panel. */
  function openPopup(e: HazardEvent, at: [number, number]) {
    const x = map.project(at).x, room = innerWidth - padding().right;
    popup?.remove();
    popup = new Popup({
      closeButton: false, closeOnClick: false, focusAfterOpen: false, className: 'hp-popup', maxWidth: 'none',
      offset: 22, anchor: x + 300 > room ? 'right' : 'left'
    });
    popupFor = e;
    return popup;
  }
  const ringEl = document.createElement('div');
  ringEl.innerHTML = '<div class="sel-ring"></div>';
  const ring = new Marker({ element: ringEl, opacityWhenCovered: '0' });

  let hazards: ReturnType<typeof addHazardLayers> | null = null;

  map.on('load', () => {
    loadWorld(map).catch(err => console.error('Could not load world outlines', err));
    hazards = addHazardLayers(map, store, e => select(e, false));
    setBasemap(map, store.get().basemap, store.get().theme);
    render();
  });

  function render() {
    const s = store.get(), { data } = store;
    if (!hazards) return;
    hazards.update(s);
    setNight(map, s.layers.night ? s.end : null);
    if (s.sel) {
      const at = eventLngLat(data, s, s.sel);
      ring.setLngLat(at).addTo(map);
      const el = popupContent(data, s, s.sel);
      el.querySelector('.x')?.addEventListener('click', () => select(null));
      (popupFor === s.sel && popup ? popup : openPopup(s.sel, at)).setLngLat(at).setDOMContent(el).addTo(map);
    } else {
      ring.remove();
      popup?.remove();
      popup = popupFor = null;
    }
  }

  store.subscribe((s, prev) => {
    if (s.end !== prev.end || s.win !== prev.win || s.layers !== prev.layers || s.sel !== prev.sel) render();
    if (hazards && (s.basemap !== prev.basemap || s.theme !== prev.theme)) setBasemap(map, s.basemap, s.theme);
  });

  return {
    flyTo(e: HazardEvent) {
      map.flyTo({ center: eventLngLat(store.data, store.get(), e), zoom: Math.max(map.getZoom(), 2.6), duration: 1100 });
    },
    zoomIn: () => map.zoomIn(),
    zoomOut: () => map.zoomOut(),
    home: () => map.flyTo({ center: HOME_CENTER, zoom: homeZoom(), duration: 1100 })
  };
}
