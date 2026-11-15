import React, { useState, useEffect, useRef } from 'react';
import { PublicGameState, PlayerPosition } from '../../engine/types';
import { Suit, SUIT_COLORS, SUIT_SYMBOLS } from '../../assets/cardManifest';
import { PlayingCard } from '../card/PlayingCard';
import { soundManager } from '../../common/SoundManager';
import { Sparkles, Crown } from 'lucide-react';

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
      {/* Physical Trump Card Indicator Container at Top-Right */}
      <div
        ref={containerRef}
        className="relative flex items-center gap-1.5 select-none pointer-events-auto"
        title={isTrumpRevealed ? `Revealed Trump: ${revealedTrumpSuit || 'No Trump'}` : 'Concealed Trump Card (Click "Ask to Reveal Trump" when legal)'}
      >
        {/* 3D Card Container with Flip Animation */}
        <div
          className="relative w-12 h-16 sm:w-14 sm:h-20 transition-transform duration-300 hover:scale-105"
          style={{ perspective: '800px' }}
        >
          <div
            className="w-full h-full relative transition-transform duration-700 shadow-md rounded-lg"
            style={{
              transformStyle: 'preserve-3d',
              transform: showFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* FRONT FACE: Concealed Trump (Face-Down Card Back) */}
            <div
              className="absolute inset-0 w-full h-full rounded-lg overflow-hidden border border-amber-300/60 shadow-md bg-white"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              <img
                src="/assets/cards/card_back.svg"
                alt="Concealed Trump"
                className="w-full h-full object-contain pointer-events-none"
                loading="eager"
                draggable={false}
              />
              {/* Subtle Concealed Stamp */}
              <div className="absolute inset-x-0 bottom-0 bg-slate-900/80 backdrop-blur-xs py-0.5 text-center">
                <span className="text-[8px] font-black uppercase tracking-wider text-amber-300">
                  TRUMP
                </span>
              </div>
            </div>

            {/* BACK FACE: Revealed Trump (6-Number Display Card or Clean NO TRUMP Card) */}
            <div
              className="absolute inset-0 w-full h-full rounded-lg overflow-hidden border border-amber-400 shadow-lg bg-white"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              {trumpMode === 'no-trump' ? (
                // Clean Joker / NO TRUMP Card Face
                <div className="w-full h-full bg-linear-to-b from-amber-50 to-white flex flex-col items-center justify-center p-1 text-center border-2 border-amber-400 rounded-lg">
                  <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 mb-0.5" />
                  <span className="text-[9px] sm:text-[10px] font-black text-slate-900 leading-tight tracking-wider">
                    NO
                  </span>
                  <span className="text-[8px] sm:text-[9px] font-black text-amber-700 leading-tight tracking-wider">
                    TRUMP
                  </span>
                </div>
              ) : trumpMode === 'seventh-card' && (seventhCardStage === 'showing-7th' || seventhCardStage === 'gliding') && revealedSeventhCard ? (
                // Stage 1 & 2: Authentic 7th card displayed
                <div className="w-full h-full relative">
                  <PlayingCard cardId={revealedSeventhCard} size="xs" className="w-full h-full rounded-lg" />
                  <div className="absolute top-0 inset-x-0 bg-cyan-600/90 py-0.5 text-center">
                    <span className="text-[7px] font-black uppercase tracking-widest text-white">7TH CARD</span>
                  </div>
                </div>
              ) : (
                // Normal Suit OR 7th Card Stage 3: Six-Number Display Card
                <div className="w-full h-full relative">
                  <PlayingCard cardId={suitDisplayCardId} size="xs" className="w-full h-full rounded-lg" />
                  {revealedTrumpSuit && (
                    <div className="absolute top-0 inset-x-0 bg-slate-900/85 py-0.5 text-center flex items-center justify-center gap-0.5">
                      <span className={`text-[10px] leading-none ${SUIT_COLORS[revealedTrumpSuit] === 'red' ? 'text-rose-500' : 'text-slate-100'}`}>
                        {SUIT_SYMBOLS[revealedTrumpSuit]}
                      </span>
                      <span className="text-[7px] font-black uppercase tracking-widest text-amber-300">
                        TRUMP
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Badge Label next to card */}
        <div className="hidden sm:flex flex-col text-left leading-tight">
          <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500">
            {isTrumpRevealed ? 'Trump' : 'Trump Card'}
          </span>
          <div className="flex items-center gap-1">
            {isTrumpRevealed ? (
              trumpMode === 'no-trump' ? (
                <span className="text-xs font-black text-amber-700">NO TRUMP</span>
              ) : revealedTrumpSuit ? (
                <>
                  <span className={`text-sm font-black ${SUIT_COLORS[revealedTrumpSuit] === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                    {SUIT_SYMBOLS[revealedTrumpSuit]}
                  </span>
                  <span className="text-xs font-black text-slate-800 uppercase">
                    {revealedTrumpSuit}
                  </span>
                </>
              ) : null
            ) : (
              <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Concealed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stage 2: Gliding 7th Card from Top-Right to Owner Hand */}
      {seventhCardStage === 'gliding' && revealedSeventhCard && glideCoords && (
        <div
          className="fixed z-50 pointer-events-none transition-all duration-500 ease-out"
          style={{
            left: glideCoords.targetX,
            top: glideCoords.targetY,
            width: 56,
            height: 80,
            transform: 'scale(1.1) rotate(-4deg)',
            filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.35))',
            animation: 'glideToOwner 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
          }}
        >
          <PlayingCard cardId={revealedSeventhCard} size="xs" className="w-full h-full rounded-lg" />
        </div>
      )}
    </>
  );
};
