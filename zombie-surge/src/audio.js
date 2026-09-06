// audio.js — ZOMBIE SURGE 전용 오디오 엔진
// 전자음 비프가 아니라 '레이어드 합성': 총성 = 트랜지언트(노이즈) + 바디(밴드패스) + 저역 펀치 + 컨볼루션 리버브 테일.
// 음악 = 전쟁 긴박감(타이코 킥 · 스네어 롤 · 저역 드론 · 텐션 스트링 · 보스 브라스 스탭), 룩어헤드 스케줄러로 타이밍 정확.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class GameAudio {
  constructor() { this.ctx = null; this.muted = false; this.scene = 'menu'; this._timer = null; }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    // ── 마스터 체인: 버스 → 컴프레서 → 리미터 → 출력
    const master = this.master = ctx.createGain(); master.gain.value = 0.95;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 20; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(master);
    this.mus = ctx.createGain(); this.mus.gain.value = 0.0; this.mus.connect(master);
    // ── 공간감: 생성한 임펄스 응답으로 컨볼루션 리버브(총성 테일 = 야외 다리 반사)
    const rev = this.rev = ctx.createConvolver(); rev.buffer = this._impulse(2.6, 3.0);
    this.revSend = ctx.createGain(); this.revSend.gain.value = 0.5;
    this.revSend.connect(rev); rev.connect(master);
    this.noiseBuf = this._noise(2.0);
    this._t0 = ctx.currentTime + 0.06; this._step = 0; this._startClock();
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.95, this.ctx.currentTime, 0.05); }
  setScene(s) {
    this.scene = s; if (!this.ctx) return;
    const g = { menu: 0.22, wave: 0.30, boss: 0.38, result: 0.16 }[s] ?? 0.25;
    this.mus.gain.setTargetAtTime(g, this.ctx.currentTime, 0.6);
  }
  // ── 유틸 ────────────────────────────────────────────────────────────────
  _noise(sec) { const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
  _impulse(sec, decay) { const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) { const t = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (1 - t * 0.2); } }
    return b; }
  _src(dur) { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    s.playbackRate.value = 0.85 + Math.random() * 0.3; return s; }
  // 노이즈 → 필터 → 엔벨로프
  _noiseHit(t, { type = 'bandpass', f = 1200, q = 1, dur = 0.09, gain = 0.5, f2 = null, rev = 0.3, dest = null }) {
    const ctx = this.ctx, s = this._src(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = type; bp.frequency.setValueAtTime(f, t); bp.Q.value = q;
    if (f2) bp.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(dest || this.sfx);
    if (rev > 0) { const rs = ctx.createGain(); rs.gain.value = rev; g.connect(rs); rs.connect(this.revSend); }
    s.start(t); s.stop(t + dur + 0.05); return g;
  }
  _osc(t, { type = 'sine', f = 120, f2 = null, dur = 0.2, gain = 0.4, rev = 0.15, dest = null }) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx);
    if (rev > 0) { const rs = ctx.createGain(); rs.gain.value = rev; g.connect(rs); rs.connect(this.revSend); }
    o.start(t); o.stop(t + dur + 0.05); return g;
  }
  // ── 총성: 무기별 캐릭터 ──────────────────────────────────────────────────
  shot(weapon = 'rifle') {
    if (!this.ctx || this.muted) return; const ctx = this.ctx; let t = ctx.currentTime;
    // 동시 다발 방지(초당 상한) — 대신 살짝 흩뿌려 '분대 일제사격' 느낌
    this._shotCount = (this._shotCount || 0) + 1;
    if (this._shotGate && t < this._shotGate) return;
    const P = {
      rifle:   { gate: 0.055, f: 1700, q: 0.9, dur: 0.10, g: 0.42, lowF: 150, lowG: 0.5, rev: 0.35 },
      smg:     { gate: 0.030, f: 2100, q: 1.1, dur: 0.06, g: 0.30, lowF: 130, lowG: 0.34, rev: 0.26 },
      shotgun: { gate: 0.130, f: 1000, q: 0.6, dur: 0.20, g: 0.62, lowF: 90,  lowG: 0.85, rev: 0.55 },
      minigun: { gate: 0.022, f: 1500, q: 0.8, dur: 0.05, g: 0.30, lowF: 120, lowG: 0.40, rev: 0.24 },
      laser:   { gate: 0.045, f: 3200, q: 6.0, dur: 0.12, g: 0.26, lowF: 420, lowG: 0.20, rev: 0.40 },
    }[weapon] || {};
    this._shotGate = t + P.gate;
    t += Math.random() * 0.012;
    if (weapon === 'laser') {   // 레이저: 하강 스윕 + 하이Q 노이즈
      this._osc(t, { type: 'sawtooth', f: 2400, f2: 700, dur: 0.13, gain: 0.16, rev: 0.4 });
      this._noiseHit(t, { type: 'bandpass', f: P.f, q: P.q, dur: P.dur, gain: P.g, rev: P.rev });
    } else {
      this._noiseHit(t, { type: 'highpass', f: 2600, dur: 0.022, gain: P.g * 0.9, rev: 0.15 });        // 크랙(트랜지언트)
      this._noiseHit(t, { type: 'bandpass', f: P.f, q: P.q, f2: P.f * 0.35, dur: P.dur, gain: P.g, rev: P.rev }); // 바디
      this._osc(t, { type: 'sine', f: P.lowF, f2: P.lowF * 0.45, dur: 0.09, gain: P.lowG * 0.5, rev: 0.2 });      // 저역 펀치
      if (weapon === 'shotgun') this._noiseHit(t + 0.13, { type: 'bandpass', f: 900, q: 3, dur: 0.07, gain: 0.14, rev: 0.2 }); // 펌프 액션
      if (weapon === 'minigun' && Math.random() < 0.25) this._noiseHit(t, { type: 'bandpass', f: 4200, q: 4, dur: 0.03, gain: 0.10, rev: 0.1 }); // 기계 클릭
    }
  }
  // ── 기타 효과음 ─────────────────────────────────────────────────────────
  zdie() { if (!this.ctx || this.muted) return; const t = this.ctx.currentTime;
    if (this._zGate && t < this._zGate) return; this._zGate = t + 0.07;
    this._noiseHit(t, { type: 'bandpass', f: 380 + Math.random() * 220, q: 1.6, f2: 120, dur: 0.16, gain: 0.20, rev: 0.25 });
    this._osc(t, { type: 'sawtooth', f: 110 + Math.random() * 40, f2: 45, dur: 0.18, gain: 0.10, rev: 0.2 }); }
  hit() { if (!this.ctx || this.muted) return; const t = this.ctx.currentTime;
    if (this._hGate && t < this._hGate) return; this._hGate = t + 0.10;
    this._noiseHit(t, { type: 'lowpass', f: 700, dur: 0.14, gain: 0.34, rev: 0.3 });
    this._osc(t, { type: 'triangle', f: 190, f2: 70, dur: 0.16, gain: 0.22, rev: 0.2 }); }
  card(type) { if (!this.ctx || this.muted) return; const t = this.ctx.currentTime;
    if (type === 'minus') { this._osc(t, { type: 'sawtooth', f: 300, f2: 90, dur: 0.30, gain: 0.26, rev: 0.3 }); this._noiseHit(t, { type: 'lowpass', f: 500, dur: 0.2, gain: 0.2 }); }
    else { [0, 7, 12].forEach((n, i) => this._osc(t + i * 0.055, { type: 'triangle', f: 523.25 * Math.pow(2, n / 12), dur: 0.22, gain: 0.20, rev: 0.4 })); } }
  gateOpen() { if (!this.ctx || this.muted) return; const t = this.ctx.currentTime;
    this._noiseHit(t, { type: 'lowpass', f: 260, dur: 1.1, gain: 0.34, rev: 0.6 });         // 석문 마찰
    this._osc(t, { type: 'sawtooth', f: 70, f2: 42, dur: 1.2, gain: 0.22, rev: 0.5 }); }
  waveStart() { if (!this.ctx || this.muted) return; const t = this.ctx.currentTime;   // 경보 사이렌
    this._osc(t, { type: 'sawtooth', f: 420, f2: 700, dur: 0.5, gain: 0.16, rev: 0.5 });
    this._osc(t + 0.5, { type: 'sawtooth', f: 700, f2: 420, dur: 0.5, gain: 0.16, rev: 0.5 }); }
  roar() { if (!this.ctx || this.muted) return; const ctx = this.ctx, t = ctx.currentTime;
    // 포효: 저역 톱니 + 포먼트 밴드패스 노이즈 + 긴 테일
    this._osc(t, { type: 'sawtooth', f: 105, f2: 58, dur: 1.5, gain: 0.34, rev: 0.7 });
    this._osc(t, { type: 'square', f: 52, f2: 30, dur: 1.6, gain: 0.20, rev: 0.6 });
    this._noiseHit(t, { type: 'bandpass', f: 620, q: 2.2, f2: 240, dur: 1.4, gain: 0.26, rev: 0.8 });
    this._noiseHit(t + 0.06, { type: 'bandpass', f: 1500, q: 3, f2: 700, dur: 1.0, gain: 0.14, rev: 0.6 }); }
  bossDie() { if (!this.ctx || this.muted) return; const t = this.ctx.currentTime;
    this._osc(t, { type: 'sawtooth', f: 140, f2: 26, dur: 1.9, gain: 0.34, rev: 0.9 });
    this._noiseHit(t, { type: 'lowpass', f: 900, f2: 120, dur: 1.6, gain: 0.40, rev: 0.9 });
    this._osc(t + 0.1, { type: 'sine', f: 60, f2: 24, dur: 1.4, gain: 0.30, rev: 0.5 }); }
  clear() { if (!this.ctx || this.muted) return; const t = this.ctx.currentTime;
    [0, 4, 7, 12].forEach((n, i) => { this._osc(t + i * 0.13, { type: 'sawtooth', f: 261.6 * Math.pow(2, n / 12), dur: 0.5, gain: 0.16, rev: 0.6 });
      this._osc(t + i * 0.13, { type: 'triangle', f: 523.2 * Math.pow(2, n / 12), dur: 0.5, gain: 0.10, rev: 0.6 }); });
    this._noiseHit(t, { type: 'bandpass', f: 3000, q: 1, dur: 0.5, gain: 0.10, rev: 0.6 }); }
  fail() { if (!this.ctx || this.muted) return; const t = this.ctx.currentTime;
    [0, -2, -5, -12].forEach((n, i) => this._osc(t + i * 0.22, { type: 'sawtooth', f: 220 * Math.pow(2, n / 12), dur: 0.6, gain: 0.20, rev: 0.6 }));
    this._osc(t, { type: 'sine', f: 80, f2: 35, dur: 1.6, gain: 0.24, rev: 0.5 }); }

  // ── 음악: 룩어헤드 스케줄러(16분음표) ────────────────────────────────────
  _startClock() { if (this._timer) clearInterval(this._timer); this._timer = setInterval(() => this._sched(), 40); }
  stop() { if (this._timer) { clearInterval(this._timer); this._timer = null; } }
  _sched() {
    const ctx = this.ctx; if (!ctx) return; const spb = 60 / 96 / 4;   // 96BPM 16분음표
    while (this._t0 < ctx.currentTime + 0.25) { this._tick(this._t0, this._step); this._t0 += spb; this._step++; }
  }
  _tick(t, s) {
    const b = s % 16, bar = Math.floor(s / 16), boss = this.scene === 'boss', menu = this.scene === 'menu', M = this.mus;
    // 타이코 킥 — 전쟁 북
    if (b === 0 || b === 6 || b === 10 || (boss && b === 13)) {
      this._osc(t, { type: 'sine', f: 130, f2: 42, dur: 0.34, gain: 0.55, rev: 0.25, dest: M });
      this._noiseHit(t, { type: 'lowpass', f: 220, dur: 0.10, gain: 0.30, rev: 0.2, dest: M });
    }
    // 스네어/래틀
    if (b === 4 || b === 12) this._noiseHit(t, { type: 'bandpass', f: 1900, q: 1.2, dur: 0.13, gain: 0.24, rev: 0.45, dest: M });
    if (!menu && (b === 14 || (boss && b % 2 === 1))) this._noiseHit(t, { type: 'bandpass', f: 2600, q: 2, dur: 0.05, gain: 0.10, rev: 0.3, dest: M });
    // 저역 드론(2마디마다 코드 이동) — 긴장감
    if (b === 0 && bar % 2 === 0) {
      const root = [55, 55, 58.27, 51.91][(bar / 2) % 4];   // A · A · Bb · Ab
      for (const det of [0.996, 1.004]) this._osc(t, { type: 'sawtooth', f: root * det, dur: 2.6, gain: boss ? 0.13 : 0.09, rev: 0.5, dest: M });
      this._osc(t, { type: 'sine', f: root / 2, dur: 2.6, gain: 0.14, rev: 0.2, dest: M });
    }
    // 텐션 스트링(보스/웨이브에서 상행)
    if (!menu && b === 8) { const root = [220, 220, 233.08, 207.65][(bar / 2 | 0) % 4];
      this._osc(t, { type: 'sawtooth', f: root, dur: 0.9, gain: 0.055, rev: 0.6, dest: M });
      this._osc(t, { type: 'sawtooth', f: root * 1.5, dur: 0.9, gain: 0.04, rev: 0.6, dest: M }); }
    // 보스: 브라스 스탭
    if (boss && b === 0 && bar % 2 === 1) { [110, 138.6, 164.8].forEach((f) => this._osc(t, { type: 'sawtooth', f, dur: 0.5, gain: 0.09, rev: 0.5, dest: M })); }
  }
}
