/**
 * Procedural Web Audio API synthesizer for Hearthplow.
 * Generates cozy alpine pentatonic chimes, tactile snow-scrape noise,
 * warm vintage plow engine purr, turbo boiler whoosh, and shift fanfares.
 */

// Cozy C-major pentatonic scale spanning two octaves (Hz)
const PENTATONIC_HZ = [
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.0,  // A5
  1046.5, // C6
  1174.66,// D6
  1318.51,// E6
  1567.98,// G6
  1760.0, // A6
];

export class CozySynthAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Continuous engine nodes
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  // Continuous snow scrape noise nodes
  private snowFilter: BiquadFilterNode | null = null;
  private snowGain: GainNode | null = null;

  // Cozy winter breeze ambient
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private initialized = false;
  private lastChimeTime = 0;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.72, now, 0.04);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * Must be called inside a user gesture (click / keydown) to unlock Web Audio.
   */
  public unlock(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.72;
      master.connect(ctx.destination);
      this.masterGain = master;

      // Build shared pink-ish noise buffer (2 seconds)
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const out = noiseBuf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
        b6 = white * 0.115926;
      }
      this.noiseBuffer = noiseBuf;

      // 1. Warm Vintage Plow Engine Purr
      const engGain = ctx.createGain();
      engGain.gain.value = 0.001;
      const engFilter = ctx.createBiquadFilter();
      engFilter.type = 'lowpass';
      engFilter.frequency.value = 140;
      engFilter.Q.value = 1.6;

      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.value = 46;

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = 92;

      osc1.connect(engFilter);
      osc2.connect(engFilter);
      engFilter.connect(engGain);
      engGain.connect(master);
      osc1.start();
      osc2.start();

      this.engineOsc1 = osc1;
      this.engineOsc2 = osc2;
      this.engineFilter = engFilter;
      this.engineGain = engGain;

      // 2. Continuous Tactile Snow Scrape Noise
      const snowSrc = ctx.createBufferSource();
      snowSrc.buffer = noiseBuf;
      snowSrc.loop = true;

      const snowFilter = ctx.createBiquadFilter();
      snowFilter.type = 'bandpass';
      snowFilter.frequency.value = 1150;
      snowFilter.Q.value = 0.85;

      const snowGain = ctx.createGain();
      snowGain.gain.value = 0.0;

      snowSrc.connect(snowFilter);
      snowFilter.connect(snowGain);
      snowGain.connect(master);
      snowSrc.start();

      this.snowFilter = snowFilter;
      this.snowGain = snowGain;

      // 3. Soft Winter Breeze Ambient
      const windSrc = ctx.createBufferSource();
      windSrc.buffer = noiseBuf;
      windSrc.loop = true;

      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 320;
      windFilter.Q.value = 0.7;

      const windGain = ctx.createGain();
      windGain.gain.value = 0.035;

      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      windSrc.start();

      this.windFilter = windFilter;
      this.windGain = windGain;
      this.initialized = true;
    } catch {
      // Ignore Web Audio errors on restricted contexts
    }
  }

  /**
   * Updates continuous engine hum and snow-scraping texture every frame.
   */
  public updateContinuous(
    speedRatio: number,
    plowActivity: number,
    isBoosting: boolean,
    isActivePlay: boolean,
    windIntensity = 0.25,
  ): void {
    if (!this.initialized || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    if (this.engineOsc1 && this.engineOsc2 && this.engineFilter && this.engineGain) {
      const targetGain = isActivePlay ? 0.045 + speedRatio * 0.045 + (isBoosting ? 0.035 : 0) : 0.008;
      const baseFreq = isActivePlay ? 44 + speedRatio * 34 + (isBoosting ? 24 : 0) : 38;
      const cutoff = isActivePlay ? 130 + speedRatio * 240 + (isBoosting ? 220 : 0) : 110;

      this.engineGain.gain.setTargetAtTime(targetGain, now, 0.07);
      this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.06);
      this.engineOsc2.frequency.setTargetAtTime(baseFreq * 2.01, now, 0.06);
      this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.08);
    }

    if (this.snowGain && this.snowFilter) {
      const clampedPlow = isActivePlay ? Math.min(1, plowActivity) : 0;
      this.snowGain.gain.setTargetAtTime(clampedPlow * 0.28, now, 0.04);
      this.snowFilter.frequency.setTargetAtTime(900 + speedRatio * 750 + (isBoosting ? 450 : 0), now, 0.06);
    }

    if (this.windGain && this.windFilter) {
      const clampedWind = Math.max(0, Math.min(1.5, windIntensity));
      const baseWind = isActivePlay ? 0.035 + clampedWind * 0.11 : 0.025 + clampedWind * 0.04;
      this.windGain.gain.setTargetAtTime(baseWind, now, 0.22);
      this.windFilter.frequency.setTargetAtTime(280 + clampedWind * 520, now, 0.25);
      this.windFilter.Q.setTargetAtTime(0.65 + clampedWind * 0.75, now, 0.25);
    }
  }

  /**
   * Soft cozy marimba/celesta chime when clearing snow streaks & climbing combos.
   */
  public playSnowChime(comboStep: number, isDeep = false): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastChimeTime < 0.055) return;
    this.lastChimeTime = now;

    const idx = Math.min(PENTATONIC_HZ.length - 1, Math.max(0, comboStep % PENTATONIC_HZ.length));
    const octaveBoost = comboStep >= PENTATONIC_HZ.length ? 1.25 : 1;
    const freq = PENTATONIC_HZ[idx] * octaveBoost;

    const osc = this.ctx.createOscillator();
    const overtone = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(freq * 2, now);

    const overGain = this.ctx.createGain();
    overGain.gain.value = isDeep ? 0.22 : 0.12;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(isDeep ? 0.14 : 0.085, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (isDeep ? 0.36 : 0.22));

    osc.connect(gain);
    overtone.connect(overGain);
    overGain.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    overtone.start(now);
    osc.stop(now + 0.38);
    overtone.stop(now + 0.38);
  }

  /**
   * Rising harmonic chord when reaching a new combo multiplier tier (x2, x3, x5...).
   */
  public playComboTierUp(multiplier: number): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const rootIndex = Math.min(5, Math.max(0, Math.floor(multiplier / 2)));
    const notes = [PENTATONIC_HZ[rootIndex], PENTATONIC_HZ[rootIndex + 2], PENTATONIC_HZ[rootIndex + 4]];

    notes.forEach((hz, i) => {
      if (!this.ctx || !this.masterGain) return;
      const start = now + i * 0.045;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(hz, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.11, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.45);
    });
  }

  /**
   * Punchy cozy snowburst when smashing through a deep snowdrift or snowman.
   */
  public playDeepDriftBurst(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    // Soft low thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.14);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);

    // Crisp snow puff
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1900, now);
      filter.frequency.exponentialRampToValueAtTime(750, now + 0.22);
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.22, now);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      src.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.masterGain);
      src.start(now, Math.random() * 0.8, 0.25);
    }
  }

  /**
   * Golden cocoa crate / frost bell pickup fanfare.
   */
  public playGoldenPickup(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((hz, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + i * 0.05;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(hz, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.52);
    });
  }

  /**
   * Turbo boiler engage whoosh.
   */
  public playTurboIgnite(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(290, now + 0.22);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(1400, now + 0.22);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  /**
   * Gentle wooden bumper thud when nudging fences or cottage posts.
   */
  public playBump(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.11);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  /**
   * Satisfying workshop upgrade chime (warm major-7th chord).
   */
  public playUpgradeBuy(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 987.77, 1046.5];
    chord.forEach((hz, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + i * 0.04;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(hz, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.58);
    });
  }

  /**
   * Celebratory cozy music-box fanfare when a Village Shift is cleared!
   */
  public playShiftComplete(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const melody = [
      { hz: 523.25, t: 0.0, d: 0.35 },
      { hz: 659.25, t: 0.11, d: 0.35 },
      { hz: 783.99, t: 0.22, d: 0.35 },
      { hz: 1046.5, t: 0.34, d: 0.65 },
      { hz: 987.77, t: 0.52, d: 0.3 },
      { hz: 1046.5, t: 0.66, d: 0.85 },
    ];
    melody.forEach((note) => {
      if (!this.ctx || !this.masterGain) return;
      const start = now + note.t;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.hz, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.d);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + note.d + 0.04);
    });
  }

  public dispose(): void {
    try {
      this.engineOsc1?.stop();
      this.engineOsc2?.stop();
      void this.ctx?.close();
    } catch {
      // ignore
    }
    this.initialized = false;
    this.ctx = null;
  }
}
