// Prosedürel çizim yardımcıları: makineler, ürünler, küçük simgeler. Harici görsel gerektirmez.
export const FONT = '"Baloo 2","Fredoka","Trebuchet MS","Segoe UI",system-ui,sans-serif';
export const OUT = '#2b2d42';
const PI2 = Math.PI * 2;

const shadeCache = new Map();
/** #rrggbb rengini amt (-1..1) kadar açar/koyulaştırır; sonuç önbelleğe alınır. */
export function shade(hex, amt) {
  const key = hex + amt;
  let v = shadeCache.get(key);
  if (v) return v;
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))));
  v = 'rgb(' + f((n >> 16) & 255) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
  shadeCache.set(key, v);
  return v;
}

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fillStroke(ctx, fill, lw = 2.5) {
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke();
}

// ------------------------------------------------------------------ ürünler
export function drawProduct(ctx, kind, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  switch (kind) {
    case 'ball':
      ctx.beginPath(); ctx.arc(0, 0, s * 0.55, 0, PI2); fillStroke(ctx, color, 2);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(-s * 0.18, -s * 0.2, s * 0.16, 0, PI2); ctx.fill();
      break;
    case 'bot':
      rr(ctx, -s * 0.5, -s * 0.45, s, s * 0.9, s * 0.2); fillStroke(ctx, color, 2);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-s * 0.18, -s * 0.08, s * 0.14, 0, PI2); ctx.arc(s * 0.18, -s * 0.08, s * 0.14, 0, PI2); ctx.fill();
      ctx.fillStyle = OUT; ctx.fillRect(-s * 0.24, -s * 0.12, s * 0.12, s * 0.08); ctx.fillRect(s * 0.12, -s * 0.12, s * 0.12, s * 0.08);
      ctx.fillRect(-s * 0.02, -s * 0.7, s * 0.04, s * 0.25);
      break;
    case 'chip':
      ctx.fillStyle = '#9aa5b1';
      for (let i = -1; i <= 1; i++) { ctx.fillRect(-s * 0.62, i * s * 0.28 - 1.5, s * 1.24, 3); ctx.fillRect(i * s * 0.28 - 1.5, -s * 0.62, 3, s * 1.24); }
      rr(ctx, -s * 0.45, -s * 0.45, s * 0.9, s * 0.9, 3); fillStroke(ctx, color, 2);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(-s * 0.22, -s * 0.22, s * 0.44, s * 0.12);
      break;
    case 'gear': {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI2, a2 = a + PI2 / 16;
        ctx.lineTo(Math.cos(a) * s * 0.62, Math.sin(a) * s * 0.62);
        ctx.lineTo(Math.cos(a2) * s * 0.62, Math.sin(a2) * s * 0.62);
        ctx.lineTo(Math.cos(a2) * s * 0.44, Math.sin(a2) * s * 0.44);
        ctx.lineTo(Math.cos(a + PI2 / 8) * s * 0.44, Math.sin(a + PI2 / 8) * s * 0.44);
      }
      ctx.closePath(); fillStroke(ctx, color, 2);
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(0, 0, s * 0.15, 0, PI2); ctx.fill();
      break;
    }
    case 'box':
      rr(ctx, -s * 0.5, -s * 0.45, s, s * 0.9, 3); fillStroke(ctx, '#d9a066', 2);
      ctx.fillStyle = color; ctx.fillRect(-s * 0.08, -s * 0.45, s * 0.16, s * 0.9);
      break;
    case 'rocket':
      ctx.fillStyle = '#ff5d6c';
      ctx.beginPath(); ctx.moveTo(-s * 0.28, s * 0.2); ctx.lineTo(-s * 0.55, s * 0.6); ctx.lineTo(-s * 0.15, s * 0.45); ctx.fill();
      ctx.beginPath(); ctx.moveTo(s * 0.28, s * 0.2); ctx.lineTo(s * 0.55, s * 0.6); ctx.lineTo(s * 0.15, s * 0.45); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -s * 0.7); ctx.quadraticCurveTo(s * 0.45, -s * 0.2, s * 0.3, s * 0.5);
      ctx.lineTo(-s * 0.3, s * 0.5); ctx.quadraticCurveTo(-s * 0.45, -s * 0.2, 0, -s * 0.7); fillStroke(ctx, color, 2);
      ctx.beginPath(); ctx.arc(0, -s * 0.12, s * 0.15, 0, PI2); ctx.fillStyle = '#bfe6ff'; ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
      break;
    case 'crystal':
      ctx.beginPath(); ctx.moveTo(0, -s * 0.7); ctx.lineTo(s * 0.42, -s * 0.12); ctx.lineTo(0, s * 0.62); ctx.lineTo(-s * 0.42, -s * 0.12); ctx.closePath(); fillStroke(ctx, color, 2);
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.moveTo(0, -s * 0.6); ctx.lineTo(s * 0.2, -s * 0.12); ctx.lineTo(0, -s * 0.12); ctx.fill();
      break;
    case 'star':
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.28 : s * 0.68, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); fillStroke(ctx, color, 2);
      break;
    case 'orb': {
      ctx.globalAlpha = 0.35; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, s * 0.8, 0, PI2); ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, PI2); fillStroke(ctx, color, 2);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(-s * 0.16, -s * 0.18, s * 0.14, 0, PI2); ctx.fill();
      break;
    }
    case 'hourglass':
      ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 0.6); ctx.lineTo(s * 0.4, -s * 0.6); ctx.lineTo(0, 0); ctx.lineTo(s * 0.4, s * 0.6); ctx.lineTo(-s * 0.4, s * 0.6); ctx.lineTo(0, 0); ctx.closePath(); fillStroke(ctx, '#e8f4ff', 2);
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-s * 0.26, s * 0.55); ctx.lineTo(s * 0.26, s * 0.55); ctx.lineTo(0, s * 0.15); ctx.fill();
      ctx.fillStyle = OUT; ctx.fillRect(-s * 0.46, -s * 0.68, s * 0.92, s * 0.1); ctx.fillRect(-s * 0.46, s * 0.58, s * 0.92, s * 0.1);
      break;
    default: // block
      rr(ctx, -s * 0.5, -s * 0.5, s, s, s * 0.18); fillStroke(ctx, color, 2);
      ctx.fillStyle = 'rgba(255,255,255,.45)'; rr(ctx, -s * 0.34, -s * 0.34, s * 0.4, s * 0.16, 3); ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ makineler
// Orijin: makinenin alt-orta noktası. x:[-w/2,w/2], y:[-h,0].
// o: { color, tier, p, t, pulse, auto, blocked, level }
function bodyBox(ctx, w, h, o) {
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  ctx.beginPath(); ctx.ellipse(0, 2, w * 0.54, 7, 0, 0, PI2); ctx.fill();
  const bh = h * 0.5;
  const g = ctx.createLinearGradient(0, -bh, 0, 0);
  g.addColorStop(0, shade(o.color, 0.28)); g.addColorStop(1, shade(o.color, -0.18));
  rr(ctx, -w / 2, -bh, w, bh, 11); fillStroke(ctx, g);
  // ön panel + ilerleme göstergesi
  rr(ctx, -w * 0.38, -bh * 0.74, w * 0.76, bh * 0.4, 6); fillStroke(ctx, '#2f3652', 2);
  const bw = w * 0.68, bx = -bw / 2, by = -bh * 0.66;
  ctx.fillStyle = '#10142a'; rr(ctx, bx, by, bw, bh * 0.24, 4); ctx.fill();
  if (o.p > 0.01) {
    ctx.fillStyle = o.blocked ? '#ff6b6b' : '#7dffa0';
    rr(ctx, bx + 2, by + 2, Math.max(4, (bw - 4) * Math.min(1, o.p)), bh * 0.24 - 4, 3); ctx.fill();
  }
  // ayak/tekerlek
  ctx.fillStyle = OUT; ctx.fillRect(-w * 0.42, -4, w * 0.18, 5); ctx.fillRect(w * 0.24, -4, w * 0.18, 5);
  return bh;
}

function decor(ctx, w, h, o) {
  const bh = h * 0.5, tier = o.tier;
  if (tier >= 2) { // uyarı şeritleri
    ctx.save(); rr(ctx, -w / 2 + 3, -10, w - 6, 7, 3); ctx.clip();
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(-w / 2, -10, w, 7);
    ctx.fillStyle = OUT;
    for (let x = -w / 2 - 6; x < w / 2; x += 12) { ctx.beginPath(); ctx.moveTo(x, -3); ctx.lineTo(x + 6, -3); ctx.lineTo(x + 12, -10); ctx.lineTo(x + 6, -10); ctx.fill(); }
    ctx.restore();
  }
  if (tier >= 3) { // altın çerçeve
    rr(ctx, -w / 2 + 2, -bh + 2, w - 4, bh - 4, 9);
    ctx.lineWidth = 2; ctx.strokeStyle = '#ffd966'; ctx.stroke();
  }
  if (tier >= 1) { // ikaz lambası
    const on = o.auto ? (o.blocked ? '#ff5252' : '#5dff8a') : '#ffc857';
    const blink = 0.6 + 0.4 * Math.sin(o.t * 6);
    ctx.fillStyle = shade(on, -0.4); ctx.fillRect(w / 2 - 17, -bh - 6, 10, 6);
    ctx.globalAlpha = blink; ctx.fillStyle = on; ctx.beginPath(); ctx.arc(w / 2 - 12, -bh - 8, 6, 0, PI2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
  }
  if (tier >= 4) { // parıltı
    const a = 0.35 + 0.25 * Math.sin(o.t * 3);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#fff6b0';
    ctx.translate(-w * 0.36, -h * 0.9);
    ctx.rotate(o.t);
    ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.lineTo(0, -9); ctx.lineTo(2, -2); ctx.rotate(Math.PI / 2); } ctx.fill();
    ctx.restore();
  }
  if (o.auto) { // dönen otomasyon dişlisi
    ctx.save(); ctx.translate(-w / 2 + 14, -bh + 12); ctx.rotate(o.t * 2);
    ctx.fillStyle = '#e8edf5'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5;
    ctx.beginPath(); for (let i = 0; i < 8; i++) { ctx.lineTo(Math.cos(i * 0.785) * 7, Math.sin(i * 0.785) * 7); ctx.lineTo(Math.cos(i * 0.785 + 0.39) * 5, Math.sin(i * 0.785 + 0.39) * 5); }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
}

function pressAnim(p, pulse) {
  let d = 0;
  if (p > 0.72) d = p < 0.84 ? (p - 0.72) / 0.12 : 1 - (p - 0.84) / 0.16;
  return Math.max(d, pulse * 0.85);
}

const KINDS = {
  press(ctx, w, h, o, bh) {
    ctx.fillStyle = '#8d99ae';
    ctx.fillRect(-w * 0.4, -h * 0.98, 9, h * 0.5); ctx.fillRect(w * 0.4 - 9, -h * 0.98, 9, h * 0.5);
    rr(ctx, -w * 0.46, -h * 0.99, w * 0.92, 11, 4); fillStroke(ctx, '#adb5bd');
    const d = pressAnim(o.p, o.pulse), top = -h * 0.88, bot = -bh - 12;
    const py = top + (bot - top) * d;
    ctx.fillStyle = '#ced4da'; ctx.fillRect(-4, -h * 0.88, 8, py + h * 0.88);
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.strokeRect(-4, -h * 0.88, 8, py + h * 0.88);
    rr(ctx, -w * 0.28, py, w * 0.56, 12, 4); fillStroke(ctx, o.color);
  },
  painter(ctx, w, h, o, bh) {
    rr(ctx, -w * 0.44, -h * 0.98, w * 0.3, h * 0.48, 8); fillStroke(ctx, shade(o.color, 0.1));
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-w * 0.4, -h * 0.94, 5, h * 0.4);
    ctx.fillStyle = '#8d99ae'; ctx.fillRect(-w * 0.16, -h * 0.9, w * 0.3, 8);
    rr(ctx, w * 0.08, -h * 0.94, 16, 20, 4); fillStroke(ctx, '#adb5bd');
    const spraying = o.p > 0.2 && o.p < 0.85 || o.pulse > 0.3;
    if (spraying) {
      ctx.fillStyle = shade(o.color, 0.3);
      for (let k = 0; k < 7; k++) {
        const f = ((o.t * 3 + k * 0.17) % 1);
        ctx.globalAlpha = 1 - f;
        ctx.beginPath(); ctx.arc(w * 0.16 + (k % 3 - 1) * f * 9, -h * 0.74 + f * (h * 0.22), 2.5 + (1 - f) * 2, 0, PI2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  },
  arm(ctx, w, h, o, bh) { armShape(ctx, w, h, o, bh, false); },
  welder(ctx, w, h, o, bh) { armShape(ctx, w, h, o, bh, true); },
  printer(ctx, w, h, o, bh) {
    rr(ctx, -w * 0.4, -h * 0.98, w * 0.8, h * 0.5, 9); fillStroke(ctx, shade(o.color, 0.12));
    rr(ctx, -w * 0.32, -h * 0.9, w * 0.64, h * 0.3, 6); fillStroke(ctx, '#10142a', 2);
    const hx = Math.sin(o.p * Math.PI * 6) * w * 0.22;
    ctx.fillStyle = '#9ad0ff'; ctx.fillRect(hx - 6, -h * 0.86, 12, 6);
    if (o.p > 0.05) {
      ctx.globalAlpha = 0.55 + 0.3 * Math.sin(o.t * 20); ctx.fillStyle = '#7dffa0';
      ctx.fillRect(hx - 1, -h * 0.8, 2, h * 0.22); ctx.globalAlpha = 1;
    }
  },
  reactor(ctx, w, h, o, bh) {
    // kafes + nabız atan çekirdek
    ctx.fillStyle = '#8d99ae'; ctx.fillRect(-w * 0.34, -h * 0.9, 8, h * 0.4); ctx.fillRect(w * 0.34 - 8, -h * 0.9, 8, h * 0.4);
    const pulse = 0.85 + 0.15 * Math.sin(o.t * 5) + o.pulse * 0.25, r = w * 0.2 * pulse, cy = -h * 0.72;
    const g = ctx.createRadialGradient(0, cy, 2, 0, cy, r * 1.8);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, o.color); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, cy, r * 1.8, 0, PI2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, cy, r, 0, PI2); fillStroke(ctx, shade(o.color, 0.4), 2);
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
    ctx.save(); ctx.translate(0, cy); ctx.rotate(o.t * (1 + o.p * 2)); ctx.beginPath(); ctx.ellipse(0, 0, r * 1.5, r * 0.5, 0, 0, PI2); ctx.stroke(); ctx.restore();
  },
  portal(ctx, w, h, o, bh) {
    const cy = -h * 0.72, rx = w * 0.2, ry = h * 0.26;
    ctx.fillStyle = '#10062a'; ctx.beginPath(); ctx.ellipse(0, cy, rx, ry, 0, 0, PI2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, cy, rx - 2, ry - 2, 0, 0, PI2); ctx.clip();
    ctx.strokeStyle = o.color; ctx.lineWidth = 2.5;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath(); ctx.ellipse(0, cy, rx * (0.2 + 0.2 * k) * (0.9 + 0.1 * Math.sin(o.t * 4 + k)), ry * (0.2 + 0.2 * k), o.t * (k % 2 ? 1 : -1) * 2, 0, Math.PI * 1.4); ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(0, cy, rx, ry, 0, 0, PI2); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = shade(o.color, 0.4); ctx.stroke();
    ctx.fillStyle = '#8d99ae'; ctx.fillRect(-4, cy + ry, 8, -bh - cy - ry);
  },
  scanner(ctx, w, h, o, bh) {
    ctx.fillStyle = '#8d99ae'; ctx.fillRect(-w * 0.42, -h * 0.98, 10, h * 0.5); ctx.fillRect(w * 0.42 - 10, -h * 0.98, 10, h * 0.5);
    rr(ctx, -w * 0.46, -h * 0.99, w * 0.92, 14, 6); fillStroke(ctx, shade(o.color, 0.15));
    const f = (o.p * 2) % 1, x = -w * 0.32 + f * w * 0.64;
    ctx.globalAlpha = o.p > 0.03 ? 0.7 : 0.25; ctx.fillStyle = '#5dff8a';
    ctx.fillRect(x - 2, -h * 0.86, 4, h * 0.38); ctx.globalAlpha = 0.15; ctx.fillRect(-w * 0.32, -h * 0.84, w * 0.64, h * 0.34); ctx.globalAlpha = 1;
  },
};

function armShape(ctx, w, h, o, bh, torch) {
  ctx.fillStyle = '#6c757d'; ctx.beginPath(); ctx.arc(0, -bh, 11, 0, PI2); fillStroke(ctx, '#8d99ae');
  const s = Math.sin(o.p * PI2) + o.pulse * 0.4;
  const a1 = -1.2 + 0.5 * s, a2 = a1 + 1.1 + 0.6 * Math.cos(o.p * PI2 + 0.8);
  const l1 = h * 0.38, l2 = h * 0.3;
  const x1 = Math.cos(a1) * l1, y1 = -bh + Math.sin(a1) * l1;
  const x2 = x1 + Math.cos(a2) * l2, y2 = y1 + Math.sin(a2) * l2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(0, -bh); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = o.color; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(0, -bh); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.fillStyle = '#ced4da'; ctx.beginPath(); ctx.arc(x1, y1, 5, 0, PI2); fillStroke(ctx, '#ced4da', 2);
  if (torch) {
    ctx.fillStyle = '#ff7b00'; ctx.beginPath(); ctx.arc(x2, y2, 4, 0, PI2); ctx.fill();
    if (o.p > 0.1 || o.pulse > 0.2) {
      ctx.fillStyle = '#fff3a0';
      for (let k = 0; k < 6; k++) {
        const f = (o.t * 5 + k * 0.31) % 1, ang = k * 1.9 + o.t;
        ctx.globalAlpha = 1 - f; ctx.fillRect(x2 + Math.cos(ang) * f * 14 - 1, y2 + Math.sin(ang) * f * 14 - 1, 3, 3);
      }
      ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(x2, y2, 5 + Math.sin(o.t * 30) * 1.5, 0, PI2); ctx.fill(); ctx.globalAlpha = 1;
    }
  } else {
    ctx.strokeStyle = OUT; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x2 - 5, y2 + 7); ctx.lineTo(x2, y2); ctx.lineTo(x2 + 5, y2 + 7); ctx.stroke();
  }
}

export function drawMachine(ctx, kind, w, h, o) {
  const bh = bodyBox(ctx, w, h, o);
  (KINDS[kind] || KINDS.press)(ctx, w, h, o, bh);
  decor(ctx, w, h, o);
}

// ------------------------------------------------------------------ simgeler
export function drawLock(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = '#8a93a6'; ctx.lineWidth = s * 0.14;
  ctx.beginPath(); ctx.arc(0, -s * 0.12, s * 0.28, Math.PI, 0); ctx.stroke();
  rr(ctx, -s * 0.4, -s * 0.12, s * 0.8, s * 0.6, s * 0.1); ctx.fillStyle = '#8a93a6'; ctx.fill();
  ctx.fillStyle = '#5b6377'; ctx.beginPath(); ctx.arc(0, s * 0.14, s * 0.09, 0, PI2); ctx.fill();
  ctx.restore();
}
