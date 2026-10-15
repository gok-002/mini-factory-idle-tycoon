const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

function trim(s) {
  return s.indexOf('.') >= 0 ? s.replace(/\.?0+$/, '') : s;
}

/** Büyük sayıları kısaltır: 1234 -> 1.23K. Geçersiz değerler "0" olur. */
export function formatNum(n) {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n < 1000) return String(Math.floor(n));
  let tier = Math.floor(Math.log10(n) / 3);
  if (tier >= SUFFIX.length) return n.toExponential(2).replace('e+', 'e');
  let v = n / Math.pow(1000, tier);
  let s = v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0);
  if (parseFloat(s) >= 1000 && tier + 1 < SUFFIX.length) { tier++; v = n / Math.pow(1000, tier); s = v.toFixed(2); }
  return trim(s) + SUFFIX[tier];
}

/** Saniyelik oran: küçük değerlerde ondalık gösterir. */
export function formatRate(n) {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n < 10) return trim(n.toFixed(1));
  return formatNum(n);
}

export function formatDuration(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return h + ' sa ' + m + ' dk';
  if (m > 0) return m + ' dk ' + s + ' sn';
  return s + ' sn';
}

/** Uzun süreler için gün + saat: 3 gün 4 sa; kısalar formatDuration gibi. */
export function formatLong(sec) {
  sec = Math.max(0, Math.floor(sec));
  if (sec < 86400) return formatDuration(sec);
  return Math.floor(sec / 86400) + ' gün ' + Math.floor((sec % 86400) / 3600) + ' sa';
}
