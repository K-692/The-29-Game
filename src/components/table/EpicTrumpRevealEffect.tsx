import React, { useEffect, useState } from 'react';
import { Suit, SUIT_COLORS, SUIT_SYMBOLS } from '../../assets/cardManifest';
import { TrumpMode } from '../../engine/types';

interface EpicTrumpRevealEffectProps {
  suit: Suit | null;
  trumpMode: TrumpMode;
  seventhCardId?: string | null;
  onComplete?: () => void;
}

/**
 * Full-Window Epic Trump-Reveal Effect
 * Strictly 1.0 second (1000ms) total duration.
 * Displays the radiant central revealed trump suit symbol (or No Trump emblem) at the center
 * of the screen for 600ms, then smoothly fades away and dissolves out from the center between 600ms–1000ms.
 * Adheres strictly to the zero-popup rule: NO text banner boxes.
 */
export const EpicTrumpRevealEffect: React.FC<EpicTrumpRevealEffectProps> = ({
  suit,
  trumpMode,
  seventhCardId,
  onComplete,
}) => {
  const [isFading, setIsFading] = useState<boolean>(false);

  useEffect(() => {
    // Stage 1 (0ms-600ms): Vibrant, radiant central presence
    // Stage 2 (600ms-1000ms): Smooth dissolve and fade-away from the center of the screen
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, 600);

    // Stage 3 (1000ms): Exactly 1.0s total duration, unmount cleanly
    const completeTimer = setTimeout(() => {
      onComplete?.();
    }, 1000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  const suitSymbol = suit ? SUIT_SYMBOLS[suit] : '';
  const isRed = suit ? SUIT_COLORS[suit] === 'red' : false;

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden transition-opacity duration-400 ease-out ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* 1. Viewport Edge Radiance */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow: 'inset 0 0 100px 30px rgba(251, 191, 36, 0.45), inset 0 0 40px 10px rgba(255, 255, 255, 0.6)',
        }}
      />

      {/* 2. Central Radiant Golden Aura */}
      <div
        className={`absolute rounded-full transition-all duration-400 ease-out ${
          isFading ? 'scale-125 opacity-0' : 'scale-100 opacity-95'
        }`}
        style={{
          width: '75vmin',
          height: '75vmin',
          background: 'radial-gradient(circle, rgba(254, 243, 199, 0.9) 0%, rgba(251, 191, 36, 0.55) 35%, rgba(245, 158, 11, 0.2) 60%, transparent 80%)',
          filter: 'blur(16px)',
        }}
      />

      {/* 3. Central Luminous Trump Symbol - Smoothly dissolves and fades away from center */}
      <div
        className={`relative flex items-center justify-center select-none text-center transition-all duration-400 ease-out ${
          isFading ? 'scale-115 opacity-0 -translate-y-3' : 'scale-100 opacity-100 translate-y-0'
        }`}
      >
        {trumpMode === 'no-trump' ? (
          <div className="px-8 py-4 rounded-3xl bg-amber-400 text-slate-950 font-black text-3xl sm:text-4xl tracking-widest uppercase shadow-[0_0_60px_rgba(251,191,36,1)] border-4 border-white/90">
            ⚡ NO TRUMP ⚡
          </div>
        ) : (
          <span
            className={`text-8xl sm:text-9xl font-black drop-shadow-[0_0_45px_rgba(255,255,255,1)] drop-shadow-[0_0_75px_rgba(251,191,36,0.9)] ${
              isRed ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {suitSymbol}
          </span>
        )}
      </div>
    </div>
  );
};
