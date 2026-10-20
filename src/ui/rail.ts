import { type LayerKey, type Store } from '../state';
import { ICON } from './icons';

const LAYERS: { key: LayerKey; label: string; color: string; count: boolean }[] = [
  { key: 'quake', label: 'Earthquakes', color: 'var(--quake)', count: true },
  { key: 'fire', label: 'Wildfires', color: 'var(--fire)', count: true },
  { key: 'storm', label: 'Storms', color: 'var(--storm)', count: true },
  { key: 'alert', label: 'Alerts', color: 'var(--lvl-orange)', count: true },
  { key: 'night', label: 'Day / night', color: 'var(--accent)', count: false }
];

/** Left-hand layer toggles. Hover or focus expands them to show labels and counts. */
export function createRail(el: HTMLElement, store: Store) {
  const button = (l: typeof LAYERS[number]) => {
    const b = document.createElement('button');
    b.className = 'layer-btn';
    b.style.setProperty('--c', l.color);
    b.setAttribute('aria-pressed', String(store.get().layers[l.key]));
    b.innerHTML = `${ICON[l.key]}<span class="lbl">${l.label}</span>${l.count ? `<span class="count num" data-count="${l.key}"></span>` : ''}`;
    b.onclick = () => {
      const layers = { ...store.get().layers, [l.key]: !store.get().layers[l.key] };
      b.setAttribute('aria-pressed', String(layers[l.key]));
      store.set({ layers });
    };
    return b;
  };
  const sep = document.createElement('div');
  sep.className = 'rail-sep';
  el.replaceChildren(...LAYERS.slice(0, 4).map(button), sep, button(LAYERS[4]));
}
