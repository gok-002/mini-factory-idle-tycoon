// Prosedürel ses (WebAudio) + titreşim. Dosya gerektirmez; ayarlardan kapatılabilir.
export class Feedback {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.master = null;
    this.last = {};
    this.active = false;   // tarayıcılar titreşimi/sesi ancak ilk dokunuştan sonra kabul eder
  }

  /** Tarayıcılar sesi ancak kullanıcı etkileşiminden sonra başlatır. */
  unlock() {
    this.active = true;
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  }

  _tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0 } = {}) {
    if (!this.settings.sound || !this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _throttle(name, ms) {
    const now = performance.now();
    if (now - (this.last[name] || 0) < ms) return false;
    this.last[name] = now;
    return true;
  }

  vibrate(pattern) {
    if (this.active && this.settings.haptics && typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) { /* desteklenmiyor */ }
    }
  }

  tap()      { if (this._throttle('tap', 40)) { this._tone(220, 0.07, { type: 'square', vol: 0.12, slide: 120 }); this.vibrate(8); } }
  produce()  { if (this._throttle('produce', 90)) this._tone(520, 0.08, { type: 'triangle', vol: 0.12, slide: 200 }); }
  sell()     { if (this._throttle('sell', 70)) { this._tone(880, 0.09, { type: 'sine', vol: 0.16 }); this._tone(1320, 0.12, { type: 'sine', vol: 0.12, delay: 0.06 }); } }
  button()   { if (this._throttle('btn', 30)) this._tone(330, 0.05, { type: 'triangle', vol: 0.1 }); }
  upgrade()  { [523, 659, 784].forEach((f, i) => this._tone(f, 0.14, { type: 'triangle', vol: 0.2, delay: i * 0.07 })); this.vibrate(20); }
  unlock()   { [392, 523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.2, { type: 'square', vol: 0.14, delay: i * 0.08 })); this.vibrate([20, 30, 40]); }
  quest()    { [659, 880, 1175].forEach((f, i) => this._tone(f, 0.18, { type: 'sine', vol: 0.2, delay: i * 0.09 })); this.vibrate([15, 25, 15]); }
  deny()     { if (this._throttle('deny', 150)) { this._tone(160, 0.16, { type: 'sawtooth', vol: 0.14, slide: -50 }); this.vibrate(30); } }
}
