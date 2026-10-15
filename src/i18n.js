// Çeviri katmanı: oyundaki tüm metinler Türkçe yazılır; İngilizce seçilince DOM ve canvas metinleri çalışma anında çevrilir.
// Mantık: (1) yapıyı değiştiren kurallar (RULES), (2) en uzun ifade önce eşleşen ifade sözlüğü (PHRASES).
import { PHRASES, RULES } from './i18n-en.js';

let lang = 'tr';
const listeners = new Set();
const cache = new Map();
const rec = new WeakMap();           // metin düğümü -> { src: Türkçe kaynak, out: görünen }
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CANVAS', 'NOSCRIPT']);
const ATTRS = ['aria-label', 'placeholder', 'alt', 'title'];
const PLAIN = /^[\d.,\s%x+\-/·]*(?:K|M|B|T|Qa|Qi|Sx|Sp|Oc|No|Dc)?[\d.,\s%]*$/;   // sayı + kısaltma: çeviri gerekmez
let phraseRe = null, observer = null;

const esc = (x) => x.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
function build() {
  const keys = Object.keys(PHRASES).sort((a, b) => b.length - a.length);
  const L = /\p{L}/u;
  const alt = keys.map((k) => (L.test(k[0]) ? '(?<!\\p{L})' : '') + esc(k) + (L.test(k[k.length - 1]) ? '(?!\\p{L})' : ''));
  phraseRe = new RegExp('(?:' + alt.join('|') + ')', 'gu');
}

function translate(str) {
  for (const [re, fn] of RULES) {
    const m = re.exec(str);
    if (m) return fn(m, translate);
  }
  if (/\s·\s/.test(str)) return str.split(/(\s+·\s+)/).map((p, i) => (i % 2 ? p : translate(p))).join('');
  if (!phraseRe) build();
  return str.replace(phraseRe, (m) => PHRASES[m])
    .replace(/([+-])%(\d+(?:[.,]\d+)?)/g, '$1$2%').replace(/%(\d+(?:[.,]\d+)?)/g, '$1%')
    .replace(/(\d),(\d)/g, '$1.$2');
}

/** Metni geçerli dile çevirir (Türkçede aynen döner). Sonuçlar önbelleğe alınır. */
export function t(str) {
  if (lang === 'tr' || !str || typeof str !== 'string') return str;
  let v = cache.get(str);
  if (v === undefined) {
    v = PLAIN.test(str) ? str : translate(str);
    if (cache.size > 4000) cache.clear();
    cache.set(str, v);
  }
  return v;
}

export const getLang = () => lang;

/** Ayar boşsa tarayıcı diline göre seçer (Türkçe dışı = İngilizce). */
export function detectLang(setting) {
  if (setting === 'tr' || setting === 'en') return setting;
  const n = (typeof navigator !== 'undefined' && (navigator.language || '')).toLowerCase();
  return n.startsWith('tr') || !n ? 'tr' : 'en';
}

export function onLangChange(fn) { listeners.add(fn); }

// ------------------------------------------------------------------ DOM
function applyText(n) {
  const cur = n.data;
  let r = rec.get(n);
  if (!r || cur !== r.out) { r = { src: cur, out: cur }; rec.set(n, r); }   // uygulama yeni (Türkçe) metin yazdı
  const out = lang === 'tr' ? r.src : t(r.src);
  r.out = out;
  if (out !== cur) n.data = out;
}

function applyAttrs(el) {
  for (const a of ATTRS) {
    if (!el.hasAttribute || !el.hasAttribute(a)) continue;
    const key = 'data-i18n-' + a;
    if (!el.hasAttribute(key)) el.setAttribute(key, el.getAttribute(a));   // Türkçe kaynağı sakla
    const src = el.getAttribute(key);
    el.setAttribute(a, lang === 'tr' ? src : t(src));
  }
}

function walk(root) {
  if (root.nodeType === 3) { applyText(root); return; }
  if (root.nodeType !== 1) return;
  applyAttrs(root);
  if (SKIP_TAGS.has(root.tagName)) return;
  for (let c = root.firstChild; c; c = c.nextSibling) walk(c);
}

function startObserver() {
  if (observer || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') { if (m.target.parentNode && !SKIP_TAGS.has(m.target.parentNode.tagName)) applyText(m.target); }
      else for (const n of m.addedNodes) walk(n);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

/** Dili değiştirir; sayfayı yeniden çevirir ve dinleyicilere (canvas önbelleği vb.) haber verir. */
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'tr';
  cache.clear();
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  if (lang === 'en') startObserver();
  walk(document.body);
  if (lang === 'tr' && observer) { observer.disconnect(); observer = null; }
  for (const fn of listeners) fn(lang);
}
