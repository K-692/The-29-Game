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

  /** Card placed/dropped onto the table */
  public playCardPlace() {
    this.play('place');
  }

  /** Trick collected/shoved */
  public playTrickShove() {
    this.play('shove');
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

  public playBid() {
    this.playSlide();
  }

  public playChip() {
    this.playSlide();
  }

  public playTrump() {
    this.playSlide();
  }

  public playTrumpReveal() {
    this.playSlide();
  }

  public playTrickWon() {
    this.playTrickShove();
  }

  public playWin() {
    this.playTrickShove();
  }

  public playVictory() {
    this.playTrickShove();
  }

  public playTick() {
    this.playSlide();
  }

  public playError() {
    this.playSlide();
  }
}

export const soundManager = new SoundManager();
