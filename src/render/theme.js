// Tema yardımcıları: renk tonu kaydırma (makine/ürün renkleri tema ile değişir). Önbellekli, her karede ucuz.
import { THEMES } from '../core/config.js';

const cache = new Map();

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0, s = 0;
  if (d > 1e-9) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hx = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return '#' + hx(r) + hx(g) + hx(b);
}

/** Temanın renk kaydırmasını uygular. Tema 'classic' ya da renk #rrggbb değilse aynen döner. */
export function themedColor(themeId, color) {
  const t = THEMES[themeId];
  if (!t || !t.hue || typeof color !== 'string' || color[0] !== '#' || color.length !== 7) return color;
  const key = themeId + color;
  let v = cache.get(key);
  if (!v) {
    const [h, s, l] = hexToHsl(color);
    v = hslToHex((h + t.hue) % 360, s, l);
    cache.set(key, v);
  }
  return v;
}
