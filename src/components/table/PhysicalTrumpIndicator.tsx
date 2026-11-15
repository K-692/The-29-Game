import React, { useState, useEffect, useRef } from 'react';
import { PublicGameState, PlayerPosition } from '../../engine/types';
import { PlayingCard } from '../card/PlayingCard';
import { soundManager } from '../../common/SoundManager';
import { Crown } from 'lucide-react';

interface PhysicalTrumpIndicatorProps {
  publicState: PublicGameState;
  myPosition: PlayerPosition;
  onTriggerEpicReveal?: () => void;
}

type SeventhCardStage = 'idle' | 'showing-7th' | 'gliding' | 'suit-placeholder';

export const PhysicalTrumpIndicator: React.FC<PhysicalTrumpIndicatorProps> = ({
  publicState,
  myPosition,
  onTriggerEpicReveal,
}) => {
  const {
    phase,
    roundNumber,
    isTrumpRevealed,
    revealedTrumpSuit,
    trumpMode,
    revealedSeventhCard,
    highestBidder,
  } = publicState;

  // Track 7th card 3-stage sequence
  const [seventhCardStage, setSeventhCardStage] = useState<SeventhCardStage>('idle');
  const [glideCoords, setGlideCoords] = useState<{
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const revealedRoundRef = useRef<number | null>(null);
  const prevIsRevealedRef = useRef<boolean>(false);

  // Check if trump has been selected (active during TRICK_PLAY, DEALING_SECOND, or ROUND_ENDED)
  const isTrumpActive = Boolean(
    phase === 'TRICK_PLAY' ||
    phase === 'DEALING_SECOND' ||
    phase === 'ROUND_ENDED' ||
    isTrumpRevealed
  );

  // Map absolute position to relative seat for glide target
  const getRelativePosition = (pos: PlayerPosition): 'bottom' | 'left' | 'top' | 'right' => {
    const diff = (pos - myPosition + 4) % 4;
    switch (diff) {
      case 0: return 'bottom';
      case 1: return 'left';
      case 2: return 'top';
      case 3: return 'right';
      default: return 'bottom';
    }
  };

  // Watch for the official trump reveal event
  useEffect(() => {
    if (!prevIsRevealedRef.current && isTrumpRevealed) {
      // Reveal event just happened!
      if (revealedRoundRef.current !== roundNumber) {
        revealedRoundRef.current = roundNumber;
        soundManager.playEventOnce(`trump_reveal_round_${roundNumber}`, 'deal');
        onTriggerEpicReveal?.();

        if (trumpMode === 'seventh-card' && revealedSeventhCard) {
          // Stage 1: Show original 7th card for 1200ms
          setSeventhCardStage('showing-7th');

          const t1 = setTimeout(() => {
            // Stage 2: Measure coordinates and glide 7th card to owner
            if (containerRef.current) {
              const startRect = containerRef.current.getBoundingClientRect();
              const owner = highestBidder ?? myPosition;
              const relPos = getRelativePosition(owner);

              let targetRect: DOMRect | undefined;
              if (relPos === 'bottom') {
                const handEl = document.querySelector('#player-hand');
                targetRect = handEl?.getBoundingClientRect();
              }
              if (!targetRect) {
                const seatEl = document.querySelector(`[data-seat="${relPos}"]`);
                targetRect = seatEl?.getBoundingClientRect();
              }

              const sx = startRect.left;
              const sy = startRect.top;
              const tx = targetRect ? targetRect.left + targetRect.width / 2 - 32 : window.innerWidth / 2;
              const ty = targetRect ? targetRect.top + targetRect.height / 2 - 45 : window.innerHeight - 100;

              setGlideCoords({ startX: sx, startY: sy, targetX: tx, targetY: ty });
              setSeventhCardStage('gliding');
              soundManager.playSlide();
            } else {
              setSeventhCardStage('suit-placeholder');
            }
          }, 1200);

          const t2 = setTimeout(() => {
            // Stage 3: Replace indicator with 6-number card of that suit
            setSeventhCardStage('suit-placeholder');
            setGlideCoords(null);
          }, 1750);

          return () => {
            clearTimeout(t1);
            clearTimeout(t2);
          };
        }
      }
    } else if (isTrumpRevealed && trumpMode === 'seventh-card') {
      // Already revealed before mount / reconnect
      if (seventhCardStage === 'idle') {
        setSeventhCardStage('suit-placeholder');
      }
    } else if (!isTrumpRevealed) {
      setSeventhCardStage('idle');
      setGlideCoords(null);
    }

    prevIsRevealedRef.current = isTrumpRevealed;
  }, [isTrumpRevealed, trumpMode, revealedSeventhCard, roundNumber, highestBidder, myPosition, onTriggerEpicReveal]);

  // Reset when deal advances
  useEffect(() => {
    if (phase === 'BIDDING' || phase === 'TRUMP_SELECTION') {
      setSeventhCardStage('idle');
      setGlideCoords(null);
      prevIsRevealedRef.current = false;
    }
  }, [phase, roundNumber]);

  if (!isTrumpActive) {
    return null;
  }

  // Determine what is displayed on the face-up side
  const suitDisplayCardId = revealedTrumpSuit ? `6_${revealedTrumpSuit}` : 'CARD_BACK';
  const showFlipped = isTrumpRevealed;

  return (
    <>
      {/* Physical Trump Card Indicator: Sits directly above right player seat (Varun) */}
      <div
        ref={containerRef}
        className="flex flex-col items-center select-none pointer-events-auto"
        title={isTrumpRevealed ? `Revealed Trump: ${revealedTrumpSuit || 'No Trump'}` : 'Concealed Trump Card'}
      >
        {/* 3D Card Container with Flip Animation */}
        <div
          className="relative w-12 h-[4.2rem] sm:w-14 sm:h-[4.9rem] aspect-[5/7] transition-transform duration-300 hover:scale-105"
          style={{ perspective: '800px' }}
        >
          <div
            className="w-full h-full relative transition-transform duration-700 shadow-lg"
            style={{
              transformStyle: 'preserve-3d',
              transform: showFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* FRONT FACE: Concealed Trump (Face-Down Card Back - Strictly NO text on top of card) */}
            <div
              className="absolute inset-0 w-full h-full shadow-md bg-transparent"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              <img
                src="/assets/cards/card_back.svg"
                alt="Concealed Trump Card"
                className="w-full h-full object-contain pointer-events-none"
                loading="eager"
                draggable={false}
              />
            </div>

            {/* BACK FACE: Revealed Trump (Strictly NO text/badges on top of card face) */}
            <div
              className="absolute inset-0 w-full h-full shadow-xl bg-transparent"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              {trumpMode === 'no-trump' ? (
                // Clean Joker / NO TRUMP Card Face
                <div className="w-full h-full bg-linear-to-b from-amber-50 to-white flex flex-col items-center justify-center p-1 text-center border-2 border-amber-400 rounded-sm">
                  <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 mb-0.5" />
                  <span className="text-[9px] sm:text-[10px] font-black text-slate-900 leading-tight tracking-wider">
                    NO
                  </span>
                  <span className="text-[8px] sm:text-[9px] font-black text-amber-700 leading-tight tracking-wider">
                    TRUMP
                  </span>
                </div>
              ) : trumpMode === 'seventh-card' && (seventhCardStage === 'showing-7th' || seventhCardStage === 'gliding') && revealedSeventhCard ? (
                // Stage 1 & 2: Authentic 7th card displayed cleanly without badges on top
                <div className="w-full h-full relative">
                  <PlayingCard cardId={revealedSeventhCard} size="xs" className="w-full h-full" />
                </div>
              ) : (
                // Normal Suit OR 7th Card Stage 3: Clean Six-Number Display Card
                <div className="w-full h-full relative">
                  <PlayingCard cardId={suitDisplayCardId} size="xs" className="w-full h-full" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Clean text "Trump" written strictly BELOW and OUTSIDE of the card */}
        <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-amber-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] mt-1">
          Trump
        </span>
      </div>

      {/* Stage 2: Gliding 7th Card from Trump position to Owner Hand */}
      {seventhCardStage === 'gliding' && revealedSeventhCard && glideCoords && (
        <div
          className="fixed z-50 pointer-events-none transition-all duration-500 ease-out"
          style={{
            left: glideCoords.targetX,
            top: glideCoords.targetY,
            width: 50,
            height: 70,
            transform: 'scale(1.1) rotate(-4deg)',
            filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.35))',
            animation: 'glideToOwner 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
          }}
        >
          <PlayingCard cardId={revealedSeventhCard} size="xs" className="w-full h-full" />
        </div>
      )}
    </>
  );
};
