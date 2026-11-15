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
 * Generates a dramatic, premium luminous golden-white pulse and edge radiance across the viewport.
 * Exactly 1000ms duration.
 */
export const EpicTrumpRevealEffect: React.FC<EpicTrumpRevealEffectProps> = ({
  suit,
  trumpMode,
  seventhCardId,
  onComplete,
}) => {
  const [phase, setPhase] = useState<'flash' | 'glow' | 'fade'>('flash');

  useEffect(() => {
    // Stage 1: Intense luminous flash at 0-200ms
    // Stage 2: Rich radial glow & radiant table aura at 200-700ms
    const timer1 = setTimeout(() => {
      setPhase('glow');
    }, 200);

    // Stage 3: Smooth dissolve to completion at 700-1000ms
    const timer2 = setTimeout(() => {
      setPhase('fade');
    }, 700);

    const timer3 = setTimeout(() => {
      onComplete?.();
    }, 1000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  const suitSymbol = suit ? SUIT_SYMBOLS[suit] : '';
  const isRed = suit ? SUIT_COLORS[suit] === 'red' : false;

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden transition-opacity duration-300 ${
        phase === 'fade' ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}
    >
      {/* 1. Viewport Outer Edge Radiance */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow: 'inset 0 0 100px 30px rgba(251, 191, 36, 0.45), inset 0 0 40px 10px rgba(255, 255, 255, 0.6)',
        }}
      />

      {/* 2. Central Epic Radiant Aura */}
      <div
        className={`absolute rounded-full transition-transform duration-700 ${
          phase === 'flash' ? 'scale-75 opacity-90' : 'scale-125 opacity-100'
        }`}
        style={{
          width: '75vmin',
          height: '75vmin',
          background: 'radial-gradient(circle, rgba(254, 243, 199, 0.85) 0%, rgba(251, 191, 36, 0.5) 40%, rgba(245, 158, 11, 0.2) 65%, transparent 80%)',
          filter: 'blur(16px)',
        }}
      />

      {/* 3. Luminous Central Light Burst */}
      <div className="relative flex flex-col items-center justify-center select-none text-center animate-fade-in">
        {trumpMode === 'no-trump' ? (
          <div className="px-8 py-4 rounded-3xl bg-amber-400/90 text-slate-950 font-black text-3xl sm:text-4xl tracking-widest uppercase shadow-[0_0_50px_rgba(251,191,36,0.9)] border-4 border-white/90">
            ⚡ NO TRUMP ⚡
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <span
              className={`text-8xl sm:text-9xl font-black drop-shadow-[0_0_45px_rgba(255,255,255,0.9)] animate-pulse ${
                isRed ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {suitSymbol}
            </span>
            <span className="mt-2 text-2xl sm:text-3xl font-black tracking-widest uppercase text-amber-950 bg-white/90 px-6 py-1.5 rounded-2xl shadow-xl border-2 border-amber-300">
              {trumpMode === 'seventh-card' ? '7TH CARD TRUMP REVEALED!' : `${suit} REVEALED!`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
