// Satır içi SVG simgeler (harici dosya yok).
const s = (body, vb = '0 0 24 24') => `<svg viewBox="${vb}" width="1em" height="1em" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  coin: s('<circle cx="12" cy="12" r="10" fill="#ffd23f" stroke="#2b2d42" stroke-width="2"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#e0a800" stroke-width="1.6"/><path d="M12 7.5v9M9.6 10c0-1.2 1-1.8 2.4-1.8s2.4.6 2.4 1.7c0 2.2-4.8 1.1-4.8 3.4 0 1.1 1 1.7 2.4 1.7s2.4-.6 2.4-1.8" fill="none" stroke="#b07d00" stroke-width="1.5" stroke-linecap="round"/>'),
  gear: s('<path d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm8.6 5.1-1.8-.3a7 7 0 0 0-.6-1.4l1.1-1.5-1.8-1.8-1.5 1.1a7 7 0 0 0-1.4-.6L14 7.4h-2.6l-.3 1.8c-.5.1-1 .3-1.4.6L8.2 8.7 6.4 10.5l1.1 1.5c-.3.4-.5.9-.6 1.4l-1.8.3v2.6l1.8.3c.1.5.3 1 .6 1.4l-1.1 1.5 1.8 1.8 1.5-1.1c.4.3.9.5 1.4.6l.3 1.8H14l.3-1.8c.5-.1 1-.3 1.4-.6l1.5 1.1 1.8-1.8-1.1-1.5c.3-.4.5-.9.6-1.4l1.8-.3z" fill="#e8edf5" stroke="#2b2d42" stroke-width="1.6" stroke-linejoin="round" transform="translate(0 -3)"/>'),
  bolt: s('<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z" fill="#ffd23f" stroke="#2b2d42" stroke-width="1.8" stroke-linejoin="round"/>'),
  cart: s('<path d="M3 4h3l2.2 10h9.6L20 7H7" fill="#fff" stroke="#2b2d42" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="9.5" cy="19" r="1.8" fill="#2b2d42"/><circle cx="17" cy="19" r="1.8" fill="#2b2d42"/>'),
  wrench: s('<path d="M14.5 3.5a5 5 0 0 0-4.4 6.8L3.8 16.6a1.9 1.9 0 0 0 2.7 2.7l6.3-6.3a5 5 0 0 0 6.8-4.4l-3 3-2.6-.6-.6-2.6z" fill="#fff" stroke="#2b2d42" stroke-width="1.8" stroke-linejoin="round"/>'),
  target: s('<circle cx="12" cy="12" r="9" fill="#fff" stroke="#2b2d42" stroke-width="2"/><circle cx="12" cy="12" r="5.2" fill="#ff5d6c" stroke="#2b2d42" stroke-width="1.6"/><circle cx="12" cy="12" r="1.8" fill="#fff"/>'),
  map: s('<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" fill="#fff" stroke="#2b2d42" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 4v13.5M15 6.5V20" stroke="#2b2d42" stroke-width="1.6"/>'),
  speed: s('<circle cx="12" cy="13" r="8.5" fill="#4dabf7" stroke="#2b2d42" stroke-width="2"/><path d="M12 13 16.5 8.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="13" r="1.6" fill="#fff"/>'),
  value: s('<path d="M12 3 21 9l-9 12L3 9z" fill="#ff9f43" stroke="#2b2d42" stroke-width="2" stroke-linejoin="round"/><path d="M3 9h18M8 9l4 12 4-12" stroke="#2b2d42" stroke-width="1.4" fill="none"/>'),
  storage: s('<path d="M3 8l9-4 9 4v10l-9 4-9-4z" fill="#d9a066" stroke="#2b2d42" stroke-width="2" stroke-linejoin="round"/><path d="M3 8l9 4 9-4M12 12v10" stroke="#2b2d42" stroke-width="1.6" fill="none"/>'),
  auto: s('<path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6zM10.5 2.5h3l.5 2.4 2 .8 2-1.4 2.1 2.1-1.4 2 .8 2 2.4.5v3l-2.4.5-.8 2 1.4 2-2.1 2.1-2-1.4-2 .8-.5 2.4h-3l-.5-2.4-2-.8-2 1.4-2.1-2.1 1.4-2-.8-2-2.4-.5v-3l2.4-.5.8-2-1.4-2L6 4.9l2 1.4 2-.8z" fill="#35c978" stroke="#2b2d42" stroke-width="1.6" stroke-linejoin="round"/>'),
  check: s('<circle cx="12" cy="12" r="10" fill="#35c978" stroke="#2b2d42" stroke-width="2"/><path d="m7 12.5 3.4 3.4L17 9" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>'),
  lock: s('<rect x="5" y="10" width="14" height="11" rx="2.5" fill="#8a93a6" stroke="#2b2d42" stroke-width="1.8"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="#2b2d42" stroke-width="2"/>'),
  star: s('<path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="#ffd23f" stroke="#2b2d42" stroke-width="1.8" stroke-linejoin="round"/>'),
  medal: s('<path d="M7 2h4l1 6H8zM17 2h-4l-1 6h4z" fill="#ff5d6c" stroke="#2b2d42" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="15" r="7" style="fill:var(--m,#ffc928)" stroke="#2b2d42" stroke-width="2"/><path d="m12 11 1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z" fill="#fff" opacity=".85"/>'),
  gift: s('<rect x="3" y="9" width="18" height="12" rx="2" fill="#ff5d6c" stroke="#2b2d42" stroke-width="1.8"/><rect x="2" y="6" width="20" height="4.5" rx="1.5" fill="#ff8a95" stroke="#2b2d42" stroke-width="1.8"/><path d="M12 6v15" stroke="#ffd23f" stroke-width="3"/><path d="M12 6c-2-4-6-3-5 0M12 6c2-4 6-3 5 0" fill="none" stroke="#2b2d42" stroke-width="1.8"/>'),
};

/** [data-icon] etiketli elemanlara simgeleri yerleştirir. */
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (!el.dataset.done && ICONS[el.dataset.icon]) { el.innerHTML = ICONS[el.dataset.icon]; el.dataset.done = '1'; }
  });
}
