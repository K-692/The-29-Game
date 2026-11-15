/**
 * Sound Manager for The 29 Game
 * Uses authentic OGG sound effects supplied in sound-effects/:
 * - card-shuffle.ogg: Shuffling the deck at start of round/deal
 * - cards-pack-take-out-1.ogg: Taking cards out / dealing phase 1 hand
 * - card-slide-1.ogg: Card drag/slide/lift interaction
 * - card-place-1.ogg: Card dropped/played on the table
 * - card-shove-1.ogg: Collecting and clearing a completed trick
 */

const getBasePath = (): string => {
  const base = import.meta.env?.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
};

export type SoundEffectType = 
  | 'shuffle' 
  | 'deal' 
  | 'slide' 
  | 'place' 
  | 'shove';

const SOUND_FILES: Record<SoundEffectType, string> = {
  shuffle: 'card-shuffle.ogg',
  deal: 'cards-pack-take-out-1.ogg',
  slide: 'card-slide-1.ogg',
  place: 'card-place-1.ogg',
  shove: 'card-shove-1.ogg',
};

class SoundManager {
  private ctx: AudioContext | null = null;
  private audioBuffers: Map<SoundEffectType, AudioBuffer> = new Map();
  private audioElements: Map<SoundEffectType, HTMLAudioElement> = new Map();
  private isMuted: boolean = false;
  private volume: number = 0.8;
  private hasUnlockedAudio: boolean = false;
  private playedEvents: Set<string> = new Set();
  private isPreloading: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.isMuted = localStorage.getItem('twenty_nine_muted') === 'true';
      const storedVol = localStorage.getItem('twenty_nine_volume');
      if (storedVol !== null) {
        const parsed = parseFloat(storedVol);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          this.volume = parsed;
        }
      }

      // Add auto-unlock listener on first user interaction
      const unlock = () => {
        this.initContext();
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        this.hasUnlockedAudio = true;
        this.preloadSounds();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };

      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
    }
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  /**
   * Preloads all original sound files.
   */
  public async preloadSounds() {
    if (this.isPreloading || typeof window === 'undefined') return;
    this.isPreloading = true;
    this.initContext();

    const base = getBasePath();

    for (const [key, filename] of Object.entries(SOUND_FILES) as [SoundEffectType, string][]) {
      const url = `${base}assets/sounds/${filename}`;

      // 1. Attempt Web Audio API buffer decoding for low-latency playback
      if (this.ctx && !this.audioBuffers.has(key)) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const arrayBuf = await res.arrayBuffer();
            const decoded = await this.ctx.decodeAudioData(arrayBuf);
            this.audioBuffers.set(key, decoded);
            continue;
          }
        } catch {
          // Fall back to HTMLAudioElement below
        }
      }

      // 2. Fallback to HTMLAudioElement
      if (!this.audioElements.has(key)) {
        try {
          const audio = new Audio(url);
          audio.preload = 'auto';
          this.audioElements.set(key, audio);
        } catch {}
      }
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('twenty_nine_muted', String(this.isMuted));
    }
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('twenty_nine_muted', String(this.isMuted));
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.volume = clamped;
    if (typeof window !== 'undefined') {
      localStorage.setItem('twenty_nine_volume', String(clamped));
    }
  }

  /**
   * Plays sound effect using Web Audio API buffer or HTML5 Audio fallback.
   */
  public play(type: SoundEffectType) {
    if (this.isMuted || this.volume <= 0 || typeof window === 'undefined') return;
    this.initContext();

    // 1. Play via Web Audio API if buffer is ready
    if (this.ctx && this.audioBuffers.has(type)) {
      try {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        const buffer = this.audioBuffers.get(type)!;
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);

        source.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        source.start(0);
        return;
      } catch {}
    }

    // 2. Play via HTMLAudioElement fallback
    const base = getBasePath();
    const url = `${base}assets/sounds/${SOUND_FILES[type]}`;
    try {
      const audio = this.audioElements.get(type) || new Audio(url);
      audio.volume = this.volume;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {}
  }

  /**
   * Idempotent playback: ensures duplicate network packets or re-renders
   * do not play the same event sound repeatedly.
   */
  public playEventOnce(eventId: string, type: SoundEffectType) {
    if (this.playedEvents.has(eventId)) return;
    this.playedEvents.add(eventId);
    // Keep set bounded
    if (this.playedEvents.size > 100) {
      const first = this.playedEvents.values().next().value;
      if (first) this.playedEvents.delete(first);
    }
    this.play(type);
  }

  // --- Specific Gameplay Audio Methods ---

  /** Deck shuffle at start of round/deal */
  public playShuffle() {
    this.play('shuffle');
  }

  /** Dealing cards (taking pack out) */
  public playDeal() {
    this.play('deal');
  }

  /** Card sliding/dragged/lifted */
  public playSlide() {
    this.play('slide');
  }

  /** Card placed/dropped onto the table (Single crisp card placement) */
  public playCardPlace() {
    this.play('place');
  }

  /** Trick collected/shoved into winner avatar */
  public playTrickShove() {
    this.play('shove');
    this.playToneChord([392, 523.25], 0.25, 'triangle', 0.15); // G4, C5 gentle sweep
  }

  public playCardShove() {
    this.playTrickShove();
  }

  /** Unique crisp chime when a bid is placed */
  public playBid() {
    this.initContext();
    if (this.isMuted || this.volume <= 0 || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime;
      // Fast two-tone rising chime: E5 (659Hz) -> G5 (784Hz)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.08);

      gain.gain.setValueAtTime(this.volume * 0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch {}
  }

  /** Unique subtle wooden tap when a player passes */
  public playPass() {
    this.initContext();
    if (this.isMuted || this.volume <= 0 || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime;
      // Soft low descending tap: 320Hz -> 180Hz
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);

      gain.gain.setValueAtTime(this.volume * 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch {}
  }

  /** Unique shimmering fanfare when a trump suit is selected */
  public playTrumpSelect() {
    this.playToneChord([523.25, 659.25, 783.99], 0.35, 'sine', 0.4); // C5, E5, G5 triad
  }

  /** Unique epic reveal horn/burst when secret trump is revealed */
  public playTrump() {
    this.initContext();
    if (this.isMuted || this.volume <= 0 || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime;
      // Epic trumpet fanfare chord: C4 (261Hz) + G4 (392Hz) + C5 (523Hz)
      const freqs = [261.63, 392.0, 523.25, 659.25];
      freqs.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);

        // Low-pass filter for rich brass warmth
        const filter = this.ctx!.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, now);
        filter.frequency.exponentialRampToValueAtTime(800, now + 0.55);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(this.volume * 0.25, now + 0.05 + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + idx * 0.04);
        osc.stop(now + 0.6);
      });
    } catch {}
  }

  public playTrumpReveal() {
    this.playTrump();
  }

  /** Unique trick win sound effect */
  public playTrickWon() {
    this.playTrickShove();
  }

  /** Unique celebratory victory fanfare */
  public playWin() {
    this.initContext();
    if (this.isMuted || this.volume <= 0 || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(this.volume * 0.4, now + i * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.4);
      });
    } catch {}
  }

  public playVictory() {
    this.playWin();
  }

  /** Subtle wooden timer tick */
  public playTick() {
    this.initContext();
    if (this.isMuted || this.volume <= 0 || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);

      gain.gain.setValueAtTime(this.volume * 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch {}
  }

  public playError() {
    this.initContext();
    if (this.isMuted || this.volume <= 0 || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);

      gain.gain.setValueAtTime(this.volume * 0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch {}
  }

  private playToneChord(frequencies: number[], duration: number, type: OscillatorType = 'sine', gainScale: number = 0.3) {
    this.initContext();
    if (this.isMuted || this.volume <= 0 || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime;
      frequencies.forEach((freq) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(this.volume * (gainScale / frequencies.length), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now);
        osc.stop(now + duration);
      });
    } catch {}
  }

  // Backward compatibility alias methods
  public playCard() {
    this.playCardPlace();
  }

  public playCardPlay() {
    this.playCardPlace();
  }

  public playCardFlip() {
    this.playSlide();
  }

  public playChip() {
    this.playBid();
  }
}

export const soundManager = new SoundManager();
