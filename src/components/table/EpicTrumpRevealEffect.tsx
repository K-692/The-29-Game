import React, { useEffect, useMemo, useRef } from 'react';
import { Suit, SUIT_COLORS, SUIT_SYMBOLS } from '../../assets/cardManifest';
import { TrumpMode } from '../../engine/types';

interface EpicTrumpRevealEffectProps {
  suit: Suit | null;
  trumpMode: TrumpMode;
  seventhCardId?: string | null;
  onComplete?: () => void;
}

/** Total length of the reveal sequence. */
export const TRUMP_REVEAL_MS = 1700;

const SUIT_NAMES: Record<Suit, string> = { DIAMONDS: 'Diamonds', HEARTS: 'Hearts', CLUBS: 'Clubs', SPADES: 'Spades' };

/**
 * Trump reveal: the table dims, a card flips over in the centre to show the
 * trump suit, a shockwave and a burst of suit symbols radiate out, then the
 * card settles away. Never blocks input (pointer-events: none).
 */
export const EpicTrumpRevealEffect: React.FC<EpicTrumpRevealEffectProps> = ({ suit, trumpMode, onComplete }) => {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const t = setTimeout(() => onCompleteRef.current?.(), TRUMP_REVEAL_MS);
    return () => clearTimeout(t);
  }, []);

  const isNoTrump = trumpMode === 'no-trump' || !suit;
  const symbol = !isNoTrump && suit ? SUIT_SYMBOLS[suit] : '🃏';
  const red = !isNoTrump && suit ? SUIT_COLORS[suit] === 'red' : false;
  const title = isNoTrump ? 'No trump' : SUIT_NAMES[suit!];

  // Burst of small suit symbols flying out radially.
  const particles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const angle = (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
        const dist = 160 + Math.random() * 140;
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          rot: (Math.random() - 0.5) * 220,
          delay: 380 + Math.random() * 120,
          size: 16 + Math.random() * 14,
        };
      }),
    []
  );

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden flex items-center justify-center" aria-live="polite">
      <span className="sr-only">Trump revealed: {title}</span>

      {/* Table dim */}
      <div className="absolute inset-0 bg-felt-950 trump-dim" />

      {/* Shockwave rings */}
      <div className="absolute w-40 h-40 rounded-full border-2 border-cream-100 trump-ring" style={{ animationDelay: '380ms' }} />
      <div className="absolute w-40 h-40 rounded-full border border-[#e8c766] trump-ring" style={{ animationDelay: '520ms' }} />

      {/* Suit particles */}
      {particles.map((p, i) => (
        <span
          key={i}
          className={`absolute trump-particle ${red ? 'text-suit-red' : 'text-cream-50'}`}
          style={
            {
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--rot': `${p.rot}deg`,
              animationDelay: `${p.delay}ms`,
              fontSize: `${p.size}px`,
            } as React.CSSProperties
          }
        >
          {symbol}
        </span>
      ))}

      {/* Flipping card */}
      <div className="trump-card-wrap" style={{ perspective: '900px' }}>
        <div className="relative w-36 h-52 sm:w-44 sm:h-64 trump-card" style={{ transformStyle: 'preserve-3d' }}>
          {/* Back */}
          <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-soft" style={{ backfaceVisibility: 'hidden' }}>
            <img src="/assets/cards/card_back.svg" alt="" className="w-full h-full object-cover" />
          </div>
          {/* Face */}
          <div
            className="absolute inset-0 rounded-2xl bg-cream-50 border border-cream-300 shadow-[0_0_60px_rgba(245,240,225,0.55)] flex flex-col items-center justify-center gap-1"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <span className="text-[10px] uppercase tracking-[0.25em] text-felt-600">Trump</span>
            <span className={`leading-none ${isNoTrump ? 'text-6xl' : 'text-8xl sm:text-9xl'} ${red ? 'text-suit-red' : 'text-felt-900'}`}>
              {symbol}
            </span>
            <span className="font-display text-xl text-felt-800">{title}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
