// Fabrika sahnesi: yerleşim, arka plan önbelleği, bant/ürün/makine çizimi ve efekt olayları.
import { MACHINES, ZONES, TUNING, SLOTS_PER_ZONE } from '../core/config.js';
import { visualTier, storageCap } from '../core/economy.js';
import { formatNum } from '../core/format.js';
import { FONT, OUT, rr, shade, drawMachine, drawProduct, drawLock } from './draw.js';
import { FX, K, C } from './fx.js';

const PI2 = Math.PI * 2;
const easeOutBack = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.fx = new FX();
    this.zone = 0;
    this.lanes = [];            // bölgedeki makine indeksleri
    this.W = 0; this.H = 0; this.dpr = 1;
    this.bg = document.createElement('canvas');
    this.t = 0;
    this.dockBounce = new Float32Array(SLOTS_PER_ZONE);
    this.lastText = new Float64Array(MACHINES.length);
    this.shake = new Float32Array(SLOTS_PER_ZONE);
    this.hintTime = 0;
    this.o = { color: '#fff', tier: 0, p: 0, t: 0, pulse: 0, auto: false, blocked: false, level: 1 }; // yeniden kullanılan çizim parametresi
    this.setZone(0);
  }

  setZone(z) {
    this.zone = z;
    this.lanes = [];
    for (let i = 0; i < MACHINES.length; i++) if (MACHINES[i].zone === z) this.lanes.push(i);
    this.bgDirty = true;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(200, Math.round(r.width));
    this.H = Math.max(200, Math.round(r.height));
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.wallH = Math.max(44, Math.min(66, this.H * 0.14));
    this.laneH = (this.H - this.wallH - 4) / SLOTS_PER_ZONE;
    this.mw = Math.min(this.laneH * 1.2, this.W * 0.38);
    this.dockW = Math.min(64, this.W * 0.17);
    this.bgDirty = true;
  }

  // ------------------------------------------------------------ yerleşim yardımcıları
  laneTop(k) { return this.wallH + k * this.laneH; }
  baseY(k) { return this.laneTop(k) + this.laneH - 13; }
  machineX() { return 8 + this.mw / 2; }
  beltX0() { return 8 + this.mw * 0.82; }
  beltX1() { return this.W - this.dockW - 10; }

  /** Dokunulan şeridi döndürür: { lane, machine } veya null. */
  hit(x, y) {
    if (y < this.wallH) return null;
    const lane = Math.min(SLOTS_PER_ZONE - 1, Math.floor((y - this.wallH) / this.laneH));
    if (lane >= this.lanes.length) return null;
    return { lane, machine: this.lanes[lane], x, y };
  }

  // ------------------------------------------------------------ arka plan (önbellekli)
  _drawBackground() {
    const W = this.W, H = this.H, z = ZONES[this.zone], wh = this.wallH;
    const b = this.bg;
    b.width = Math.round(W * this.dpr); b.height = Math.round(H * this.dpr);
    const c = b.getContext('2d');
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // duvar
    const g = c.createLinearGradient(0, 0, 0, wh);
    g.addColorStop(0, z.wall); g.addColorStop(1, z.wall2);
    c.fillStyle = g; c.fillRect(0, 0, W, wh);
    c.fillStyle = 'rgba(255,255,255,.12)';
    for (let x = 0; x < W; x += 28) c.fillRect(x, 0, 2, wh);
    this._drawDeco(c, z, W, wh);
    // borular
    c.fillStyle = '#9aa5b1'; c.fillRect(0, wh - 8, W, 6);
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(0, wh - 8, W, 2);
    c.fillStyle = OUT; c.fillRect(0, wh - 2, W, 2);
    // tabela
    c.font = '800 13px ' + FONT; const tw = c.measureText(z.name).width + 26;
    rr(c, W / 2 - tw / 2, 2, tw, 20, 8); c.fillStyle = '#fff7e0'; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = OUT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(z.name, W / 2, 13);
    // zemin
    for (let k = 0; k < SLOTS_PER_ZONE; k++) {
      const y = this.laneTop(k);
      c.fillStyle = k % 2 ? z.floor2 : z.floor;
      c.fillRect(0, y, W, this.laneH + 1);
      c.fillStyle = 'rgba(0,0,0,.05)';
      for (let x = ((k % 2) * 20); x < W; x += 40) c.fillRect(x, y, 20, this.laneH);
      c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(0, y, W, 2);
    }
    this.bgDirty = false;
  }

  /** Duvar süsü: bölgeye göre pencere / yıldız / kristal / saat / neon / galaksi. */
  _drawDeco(c, z, W, wh) {
    const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }; // sabit "rastgele"
    const deco = z.deco;
    if (deco === 'windows') {
      const wins = Math.max(2, Math.floor(W / 110));
      for (let i = 0; i < wins; i++) {
        const wx = (i + 0.5) * (W / wins) - 22;
        rr(c, wx, 8, 44, wh - 22, 6); c.fillStyle = '#bfe6ff'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
        c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(wx + 5, 12, 10, wh - 30);
        c.fillStyle = OUT; c.fillRect(wx + 21, 8, 2, wh - 22);
      }
    } else if (deco === 'stars' || deco === 'galaxy') {
      for (let i = 0; i < 46; i++) {
        c.globalAlpha = 0.4 + rnd(i + 9) * 0.6; c.fillStyle = '#fff';
        const r = rnd(i + 3) * 1.6 + 0.4; c.fillRect(rnd(i) * W, rnd(i + 50) * (wh - 12), r, r);
      }
      c.globalAlpha = 1;
      if (deco === 'stars') { // Dünya
        const px = W * 0.82, py = wh * 0.45, pr = wh * 0.36;
        c.beginPath(); c.arc(px, py, pr, 0, Math.PI * 2); c.fillStyle = '#3d8bff'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
        c.fillStyle = '#4fd37a'; c.beginPath(); c.ellipse(px - pr * 0.3, py - pr * 0.1, pr * 0.35, pr * 0.28, 0.5, 0, Math.PI * 2); c.fill();
      } else { // spiral galaksi
        const gx = W * 0.2, gy = wh * 0.5;
        const g = c.createRadialGradient(gx, gy, 1, gx, gy, wh * 0.7); g.addColorStop(0, 'rgba(255,214,255,.95)'); g.addColorStop(1, 'rgba(160,90,255,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(gx, gy, wh * 0.9, wh * 0.38, -0.3, 0, Math.PI * 2); c.fill();
      }
    } else if (deco === 'crystals') {
      for (let i = 0; i < 9; i++) {
        const cx = (i + 0.5) * (W / 9) + (rnd(i) - 0.5) * 14, h = wh * (0.35 + rnd(i + 20) * 0.45), w = 12 + rnd(i + 40) * 12;
        c.beginPath(); c.moveTo(cx, wh - 8 - h); c.lineTo(cx + w / 2, wh - 8); c.lineTo(cx - w / 2, wh - 8); c.closePath();
        c.fillStyle = i % 2 ? '#c77dff' : '#4cc9f0'; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
        c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.moveTo(cx, wh - 8 - h); c.lineTo(cx + w * 0.1, wh - 8 - h * 0.2); c.lineTo(cx - w * 0.3, wh - 8 - h * 0.2); c.fill();
      }
    } else if (deco === 'clocks') {
      const n = Math.max(2, Math.floor(W / 120));
      for (let i = 0; i < n; i++) {
        const cx = (i + 0.5) * (W / n), cy = wh * 0.45, r = wh * 0.34;
        c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fillStyle = '#fff7e0'; c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
        c.lineWidth = 2; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, cy - r * 0.7); c.moveTo(cx, cy); c.lineTo(cx + r * 0.5, cy + r * 0.2 * (i % 2 ? 1 : -1)); c.stroke();
      }
    } else if (deco === 'neon') {
      c.lineWidth = 1.5; c.strokeStyle = 'rgba(6,214,160,.55)';
      for (let x = 0; x < W; x += 26) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, wh - 8); c.stroke(); }
      for (let y = 6; y < wh - 8; y += 14) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      c.strokeStyle = '#06d6a0'; c.lineWidth = 3; c.beginPath();
      for (let x = 0; x <= W; x += 6) c.lineTo(x, wh * 0.5 + Math.sin(x * 0.07) * wh * 0.22);
      c.stroke();
    }
  }

  // ------------------------------------------------------------------ çerçeve
  frame(dt) {
    if (!this.W) return;
    if (this.bgDirty) this._drawBackground();
    this.t += dt;
    this.fx.update(dt);
    this.hintTime += dt;
    const ctx = this.ctx, game = this.game;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.drawImage(this.bg, 0, 0, this.W, this.H);
    ctx.textBaseline = 'middle';

    for (let k = 0; k < SLOTS_PER_ZONE; k++) {
      if (this.dockBounce[k] > 0) this.dockBounce[k] = Math.max(0, this.dockBounce[k] - dt * 5);
      if (this.shake[k] > 0) this.shake[k] = Math.max(0, this.shake[k] - dt * 4);
      if (k >= this.lanes.length) continue;
      const mi = this.lanes[k], m = game.state.machines[mi];
      if (m.owned) this._drawLane(k, mi, m);
      else this._drawLocked(k, mi);
    }
    this._drawGolden(ctx);
    this.fx.draw(ctx);
  }

  /** Altın Kasa: sahnede zıplayan, dokununca ödül veren kasa. Konum game.golden'dan (0..1). */
  _drawGolden(ctx) {
    const g = this.game.golden;
    if (!g) return;
    const x = g.x * this.W, y = this.wallH + g.y * (this.H - this.wallH) + Math.sin(this.t * 4) * 6;
    const fade = g.ttl < 3 ? (Math.sin(this.t * 18) > 0 ? 1 : 0.35) : 1;
    ctx.save(); ctx.globalAlpha = fade; ctx.translate(x, y);
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
    glow.addColorStop(0, 'rgba(255,236,130,.95)'); glow.addColorStop(1, 'rgba(255,210,63,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 46, 0, PI2); ctx.fill();
    ctx.rotate(Math.sin(this.t * 3) * 0.12);
    rr(ctx, -22, -17, 44, 34, 7); ctx.fillStyle = '#ffc928'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.fillStyle = '#ff9f1c'; ctx.fillRect(-22, -3, 44, 6); ctx.fillStyle = '#fff3a0'; ctx.fillRect(-4, -17, 8, 34);
    ctx.fillStyle = OUT; ctx.font = '800 15px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('$', 0, 11);
    ctx.restore();
  }

  /** Dokunulan nokta Altın Kasaya denk geliyor mu? */
  hitGolden(x, y) {
    const g = this.game.golden;
    if (!g) return false;
    const gx = g.x * this.W, gy = this.wallH + g.y * (this.H - this.wallH);
    return Math.abs(x - gx) < 42 && Math.abs(y - gy) < 42;
  }

  goldenFx(reward, frenzy) {
    this.fx.burst(K.COIN, this.W / 2, this.H * 0.4, 16, 260, 1, 6, C.GOLD);
    this.fx.burst(K.STAR, this.W / 2, this.H * 0.4, 8, 180, 0.9, 9, C.GOLD);
    this.fx.text(frenzy ? 'COŞKU x3!' : '+' + formatNum(reward), this.W / 2, this.H * 0.35, C.GOLD, 24);
  }

  _drawLane(k, mi, m) {
    const ctx = this.ctx, def = MACHINES[mi], r = this.game.rt[mi], z = ZONES[this.zone];
    const by = this.baseY(k), x0 = this.beltX0(), x1 = this.beltX1();
    const selected = this.game.state.selected === mi;

    if (selected) { // seçili şerit vurgusu
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(0, this.laneTop(k) + 2, this.W, this.laneH - 2);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(0, this.laneTop(k) + 2, 4, this.laneH - 2);
    }

    // bant
    const bh = 13, bty = by - bh + 3;
    rr(ctx, x0 - 8, bty, x1 - x0 + 22, bh, 6); ctx.fillStyle = z.belt; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.stroke();
    const moving = m.auto || r.count > 0;
    const off = moving ? (this.t * 34) % 14 : 0;
    ctx.save(); rr(ctx, x0 - 6, bty + 1, x1 - x0 + 18, bh - 2, 5); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    for (let x = x0 - 14 + off; x < x1 + 12; x += 14) { ctx.beginPath(); ctx.moveTo(x, bty + bh - 2); ctx.lineTo(x + 5, bty + bh / 2); ctx.lineTo(x, bty + 2); ctx.lineTo(x + 4, bty + 2); ctx.lineTo(x + 9, bty + bh / 2); ctx.lineTo(x + 4, bty + bh - 2); ctx.fill(); }
    ctx.restore();

    // satış kulübesi
    this._drawDock(k, x1 + 14, by, def);

    // makine
    const o = this.o;
    o.color = def.color; o.tier = visualTier(m.level); o.p = r.progress > 1 ? 1 : r.progress; o.t = this.t;
    o.pulse = r.pulse; o.auto = m.auto; o.blocked = r.blocked; o.level = m.level;
    const mh = Math.min(this.laneH * 0.8, this.mw * 1.0), cx = this.machineX();
    ctx.save();
    const sh = this.shake[k] > 0 ? Math.sin(this.shake[k] * 40) * 4 * this.shake[k] : 0;
    ctx.translate(cx + sh, by);
    const born = r.born < 1 ? easeOutBack(r.born) : 1;
    const sq = r.pulse * 0.06;
    ctx.scale((1 + sq) * born, (1 - sq) * born);
    drawMachine(ctx, def.kind, this.mw * 0.86, mh, o);
    ctx.restore();

    // bant üstündeki ürünler (makine çıkışından satış noktasına)
    const iy = bty - 3, size = Math.min(17, this.laneH * 0.17);
    for (let q = 0; q < r.count; q++) {
      const f = r.ages[q] / TUNING.beltTravelTime;
      const px = x0 + (x1 - x0 + 8) * (f > 1 ? 1 : f);
      drawProduct(ctx, def.product, px, iy - Math.abs(Math.sin(f * 14)) * 1.5, size, def.color);
    }

    // seviye rozeti
    const label = 'Sv.' + m.level;
    ctx.font = '800 11px ' + FONT;
    const lw = ctx.measureText(label).width + 12;
    rr(ctx, 6, this.laneTop(k) + 5, lw, 17, 8); ctx.fillStyle = OUT; ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.textAlign = 'left'; ctx.fillText(label, 12, this.laneTop(k) + 14);

    // ilk dokunuş ipucu
    if (!m.auto && selected && this.game.state.stats.taps < 8 && mi === 0) {
      const bob = Math.sin(this.hintTime * 5) * 4;
      ctx.textAlign = 'center'; ctx.font = '800 15px ' + FONT;
      ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.strokeText('DOKUN!', cx, by - mh - 6 + bob);
      ctx.fillStyle = '#fff'; ctx.fillText('DOKUN!', cx, by - mh - 6 + bob);
    }
    if (r.blocked || (r.count >= storageCap(m) && !m.auto)) { // depo dolu uyarısı
      ctx.textAlign = 'center'; ctx.font = '800 11px ' + FONT;
      ctx.fillStyle = '#ff5252'; ctx.fillText('BANT DOLU', (x0 + x1) / 2, bty - 20);
    }
  }

  _drawDock(k, x, by, def) {
    const ctx = this.ctx, w = this.dockW, bounce = this.dockBounce[k];
    const h = Math.min(this.laneH * 0.62, 56);
    ctx.save();
    ctx.translate(x + w / 2 - 10, by);
    ctx.scale(1 + bounce * 0.12, 1 - bounce * 0.1);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, 1, w * 0.5, 5, 0, 0, PI2); ctx.fill();
    rr(ctx, -w / 2 + 4, -h * 0.7, w - 8, h * 0.7, 5); ctx.fillStyle = '#fff7e0'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.stroke();
    // tente
    const aw = w + 6, ah = h * 0.3;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#fff' : '#ff5d6c';
      ctx.fillRect(-aw / 2 + (aw / 4) * i, -h * 0.7 - ah, aw / 4, ah);
    }
    ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.strokeRect(-aw / 2, -h * 0.7 - ah, aw, ah);
    // altın jetonu
    ctx.beginPath(); ctx.arc(0, -h * 0.34, h * 0.17, 0, PI2); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#b8860b'; ctx.font = '800 ' + Math.round(h * 0.24) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('$', 0, -h * 0.33);
    ctx.restore();
  }

  _drawLocked(k, mi) {
    const ctx = this.ctx, def = MACHINES[mi], game = this.game;
    const top = this.laneTop(k), cx = this.W / 2;
    const block = game.machineBlock(mi);
    const next = game.nextMachineIndex() === mi;           // sıradaki makine
    const levelBlocked = next && block && block.type === 'level';
    const cost = game.machineCost(mi);
    const w = this.W - 28, h = this.laneH - 16, x = 14, y = top + 8;
    const afford = next && !block && game.canAfford(cost);
    ctx.save();
    if (this.shake[k] > 0) ctx.translate(Math.sin(this.shake[k] * 40) * 5 * this.shake[k], 0);
    rr(ctx, x, y, w, h, 14);
    ctx.fillStyle = next ? 'rgba(255,255,255,.4)' : 'rgba(0,0,0,.07)'; ctx.fill();
    ctx.setLineDash([9, 7]); ctx.lineWidth = 3;
    ctx.strokeStyle = afford ? '#2fb86b' : next ? 'rgba(43,45,66,.55)' : 'rgba(43,45,66,.25)';
    ctx.lineDashOffset = -this.t * 12; ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign = 'center';
    if (next) {
      const pulse = afford ? 1 + Math.sin(this.t * 5) * 0.05 : 1;
      ctx.translate(cx, y + h / 2); ctx.scale(pulse, pulse);
      ctx.font = '800 14px ' + FONT; ctx.fillStyle = OUT; ctx.fillText(def.name, 0, -h * 0.3);
      const label = levelBlocked ? 'Önceki makine Sv.' + block.need + ' olmalı (' + block.have + '/' + block.need + ')' : '+ SATIN AL  ' + formatNum(cost);
      ctx.font = '800 ' + (levelBlocked ? 13 : 15) + 'px ' + FONT;
      const bw = Math.min(this.W - 40, ctx.measureText(label).width + 30);
      rr(ctx, -bw / 2, -h * 0.1, bw, 32, 14);
      ctx.fillStyle = afford ? '#35c978' : '#9aa3b5'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillText(label, 0, -h * 0.1 + 17);
      ctx.font = '700 11px ' + FONT; ctx.fillStyle = 'rgba(43,45,66,.65)';
      if (levelBlocked) ctx.fillText('Önceki makineyi yükselt', 0, h * 0.28);
      else if (!afford) ctx.fillText('Daha fazla para biriktir', 0, h * 0.28);
    } else {
      drawLock(ctx, cx, y + h / 2 - 8, 26);
      ctx.font = '700 12px ' + FONT; ctx.fillStyle = 'rgba(43,45,66,.6)';
      ctx.fillText(def.name, cx, y + h / 2 + 24);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ olay -> efekt
  _laneOf(mi) { return this.lanes.indexOf(mi); }

  onEvent(type, a, b, c) {
    const fx = this.fx;
    const k = type === 'zone' ? -1 : this._laneOf(a);
    switch (type) {
      case 'produce': {
        if (k < 0) return;
        const x = this.beltX0(), y = this.baseY(k) - 16;
        fx.burst(K.PUFF, x - 6, y, 3, 22, 0.5, 6, C.WHITE, false);
        break;
      }
      case 'sell': {
        if (k < 0) return;
        this.dockBounce[k] = 1;
        const x = this.beltX1() + this.dockW / 2, y = this.baseY(k) - 40;
        fx.burst(K.COIN, x, y, 3, 130, 0.7, 5, C.GOLD);
        if (this.t - this.lastText[a] > 0.18) {
          this.lastText[a] = this.t;
          fx.text("+" + formatNum(b), Math.min(x - 6, this.W - 34), y - 8, C.GOLD, 15);
        }
        break;
      }
      case 'buyMachine': case 'auto': case 'levelUp': case 'upgrade': {
        if (k < 0) return;
        const x = this.machineX(), y = this.baseY(k) - this.laneH * 0.4;
        if (type === 'buyMachine') { fx.burst(K.CONFETTI, x, y, 26, 230, 1.1, 4, -1); fx.burst(K.STAR, x, y, 8, 160, 0.9, 9, C.GOLD); fx.ring(x, y, 50, C.GOLD); fx.text('YENİ MAKİNE!', x + 20, y - 40, C.GOLD, 18); }
        else if (type === 'auto') { fx.ring(x, y, 44, C.GREEN); fx.burst(K.STAR, x, y, 6, 130, 0.8, 8, C.GREEN); fx.text('OTOMATİK!', x + 20, y - 40, C.GREEN, 16); }
        else if (type === 'levelUp') { fx.ring(x, y, 40, C.WHITE); fx.burst(K.STAR, x, y, 7, 140, 0.8, 8, C.GOLD); fx.text('SEVİYE ' + b + '!', x + 16, y - 36, C.WHITE, 16); }
        else { fx.ring(x, y, 36, C.BLUE); fx.burst(K.STAR, x, y, 5, 120, 0.7, 7, C.BLUE); }
        break;
      }
      case 'questClaimed':
        fx.burst(K.CONFETTI, this.W / 2, this.H * 0.35, 36, 260, 1.3, 4, -1);
        fx.burst(K.COIN, this.W / 2, this.H * 0.35, 10, 220, 1, 6, C.GOLD);
        break;
      case 'zone':
        fx.burst(K.CONFETTI, this.W / 2, this.H * 0.4, 50, 300, 1.4, 5, -1);
        fx.ring(this.W / 2, this.H * 0.4, 80, C.GOLD);
        break;
      case 'deny':
        break;
      default:
    }
  }

  tapEffect(lane, x, y) {
    this.fx.burst(K.SPARK, x, y, 5, 90, 0.4, 5, C.WHITE);
    this.fx.ring(x, y, 22, C.WHITE);
  }

  shakeLane(lane) { if (lane >= 0) this.shake[lane] = 1; }
}
