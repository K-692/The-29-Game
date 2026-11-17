import React, { useEffect, useState, useRef } from 'react';
import { CompletedTrick, PlayedCard, PlayerInfo, PlayerPosition, TrumpMode } from '../../engine/types';
import { Suit } from '../../assets/cardManifest';
import { evaluateTrickWinner } from '../../engine/tricks';
import { PlayingCard } from '../card/PlayingCard';
import { soundManager } from '../../common/SoundManager';

interface TrickAreaProps {
  playedCards: PlayedCard[];
  players: PlayerInfo[];
  myPosition: PlayerPosition;
  completedTricks: CompletedTrick[];
  lastCompletedTrick?: CompletedTrick | null;
  dropZoneRef?: React.Ref<HTMLDivElement>;
  currentTrickNumber?: number;
  roundNumber?: number;
  trumpSuit?: Suit | null;
  isTrumpRevealed?: boolean;
  trumpMode?: TrumpMode;
  onTrickWinnerDetermined?: (winnerPos: PlayerPosition | null) => void;
}

const SLOT_ROTATIONS: Record<'bottom' | 'top' | 'left' | 'right', number> = {
  bottom: -2,
  top: 2,
  left: 3,
  right: -3,
};

export const TrickArea: React.FC<TrickAreaProps> = ({
  playedCards,
  players,
  myPosition,
  completedTricks,
  lastCompletedTrick,
  dropZoneRef,
  currentTrickNumber = 1,
  roundNumber = 1,
  trumpSuit = null,
  isTrumpRevealed = false,
  trumpMode = 'suit',
  onTrickWinnerDetermined,
}) => {
  // State for freeze-frame and collective 4-card win animation
  const [frozenCards, setFrozenCards] = useState<PlayedCard[] | null>(null);
  const [isCollecting, setIsCollecting] = useState<boolean>(false);
  const [winningRelPos, setWinningRelPos] = useState<'bottom' | 'left' | 'top' | 'right' | null>(null);
  const [targetVector, setTargetVector] = useState<{ x: number; y: number } | null>(null);
  const [retiredTrickKey, setRetiredTrickKey] = useState<string | null>(null);

  const slotRefs = {
    bottom: useRef<HTMLDivElement>(null),
    top: useRef<HTMLDivElement>(null),
    left: useRef<HTMLDivElement>(null),
    right: useRef<HTMLDivElement>(null),
  };

  const playedCardKeysRef = useRef<Set<string>>(new Set());
  const lastAnimatedTrickKeyRef = useRef<string | null>(null);
  const prevTrickKeyRef = useRef<string | null>(null);
  const timer1Ref = useRef<NodeJS.Timeout | null>(null);
  const timer2Ref = useRef<NodeJS.Timeout | null>(null);

  // Map player absolute position (0..3) to relative table position (bottom, left, top, right)
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

  const currentTrickKey = `R${roundNumber}_T${currentTrickNumber}`;

  // Reset tracking when trick advances
  useEffect(() => {
    if (prevTrickKeyRef.current !== currentTrickKey) {
      prevTrickKeyRef.current = currentTrickKey;
      playedCardKeysRef.current.clear();
      if (timer1Ref.current) clearTimeout(timer1Ref.current);
      if (timer2Ref.current) clearTimeout(timer2Ref.current);
      setFrozenCards(null);
      setIsCollecting(false);
      setWinningRelPos(null);
      setTargetVector(null);
      onTrickWinnerDetermined?.(null);
    }
  }, [currentTrickKey, onTrickWinnerDetermined]);

  // Play placement sound when new card arrives on felt
  useEffect(() => {
    playedCards.forEach((pc) => {
      const key = `${pc.cardId}_${pc.playerIndex}`;
      if (!playedCardKeysRef.current.has(key)) {
        playedCardKeysRef.current.add(key);
        soundManager.playCardPlace();
      }
    });
  }, [playedCards]);

  // Check if a 4-card trick is present
  const isFourCards = playedCards.length === 4;

  useEffect(() => {
    if (!isFourCards) {
      return;
    }

    // Guard: already animated or retired this trick
    if (lastAnimatedTrickKeyRef.current === currentTrickKey || retiredTrickKey === currentTrickKey) {
      return;
    }
    lastAnimatedTrickKeyRef.current = currentTrickKey;

    const cardsToAnimate = [...playedCards];
    setFrozenCards(cardsToAnimate);
    setIsCollecting(false);

    // Evaluate authoritative trick winner
    const getTrickWinner = (): PlayerPosition => {
      if (lastCompletedTrick && lastCompletedTrick.trickNumber === currentTrickNumber) {
        return lastCompletedTrick.winner;
      }
      if (cardsToAnimate.length === 4) {
        try {
          const trickResult = evaluateTrickWinner(
            cardsToAnimate,
            cardsToAnimate[0].playerIndex,
            trumpSuit,
            isTrumpRevealed,
            currentTrickNumber,
            true,
            trumpMode
          );
          return trickResult.winner;
        } catch {
          // Fallback to latest trick or current player
        }
      }
      return lastCompletedTrick?.winner ?? (completedTricks.length > 0 ? completedTricks[completedTricks.length - 1].winner : myPosition);
    };

    const winnerPos = getTrickWinner();
    const targetRelPos = getRelativePosition(winnerPos);
    setWinningRelPos(targetRelPos);

    // Calculate dynamic trajectory vector to winning seat center
    const targetSeatEl = targetRelPos === 'bottom'
      ? (document.querySelector('#player-hand') || document.querySelector('[data-seat="bottom"]'))
      : (document.querySelector(`[data-seat="${targetRelPos}"]`) || document.querySelector(`[data-avatar="${targetRelPos}"]`));

    const trickEl = document.querySelector('#trick-area');
    if (trickEl && targetSeatEl) {
      const trickRect = trickEl.getBoundingClientRect();
      const seatRect = targetSeatEl.getBoundingClientRect();
      const trickCenterX = trickRect.left + trickRect.width / 2;
      const trickCenterY = trickRect.top + trickRect.height / 2;
      const seatCenterX = seatRect.left + seatRect.width / 2;
      const seatCenterY = seatRect.top + seatRect.height / 2;
      setTargetVector({
        x: Math.round(seatCenterX - trickCenterX),
        y: Math.round(seatCenterY - trickCenterY),
      });
    } else {
      switch (targetRelPos) {
        case 'bottom': setTargetVector({ x: 0, y: 260 }); break;
        case 'top': setTargetVector({ x: 0, y: -240 }); break;
        case 'left': setTargetVector({ x: -300, y: 0 }); break;
        case 'right': setTargetVector({ x: 300, y: 0 }); break;
      }
    }

    if (timer1Ref.current) clearTimeout(timer1Ref.current);
    if (timer2Ref.current) clearTimeout(timer2Ref.current);

    // Step 1: Hold all 4 cards on the felt for 750ms so trick outcome is clearly visible
    timer1Ref.current = setTimeout(() => {
      // Step 2: Trigger collection animation where all 4 cards move together towards winning player
      setIsCollecting(true);
      soundManager.playTrickShove();
      onTrickWinnerDetermined?.(winnerPos);
    }, 750);

    // Step 3: At 1350ms (750ms hold + 520ms animation + 80ms cushion), collection finishes and trick is authoritatively retired
    timer2Ref.current = setTimeout(() => {
      setRetiredTrickKey(currentTrickKey);
      setFrozenCards(null);
      setIsCollecting(false);
      setWinningRelPos(null);
      setTargetVector(null);
      onTrickWinnerDetermined?.(null);
    }, 1350);
  }, [
    isFourCards, 
    currentTrickKey, 
    retiredTrickKey, 
    lastCompletedTrick, 
    completedTricks.length, 
    myPosition,
    trumpSuit,
    isTrumpRevealed,
    trumpMode,
    onTrickWinnerDetermined,
  ]);

  useEffect(() => {
    return () => {
      if (timer1Ref.current) clearTimeout(timer1Ref.current);
      if (timer2Ref.current) clearTimeout(timer2Ref.current);
      onTrickWinnerDetermined?.(null);
    };
  }, [onTrickWinnerDetermined]);

  // Cards to render:
  // If this trick has finished collection (retired), render nothing so cards NEVER pop back onto the felt!
  const isRetired = currentTrickKey === retiredTrickKey;
  const cardsToRender = isRetired ? [] : (frozenCards || playedCards);

  // Group cards by their relative slot
  const cardsBySlot: Record<'bottom' | 'top' | 'left' | 'right', PlayedCard | null> = {
    bottom: null,
    top: null,
    left: null,
    right: null,
  };

  cardsToRender.forEach((pc) => {
    const relPos = getRelativePosition(pc.playerIndex);
    cardsBySlot[relPos] = pc;
  });

  return (
    <div
      ref={dropZoneRef}
      id="trick-area"
      className="relative w-72 h-56 sm:w-80 sm:h-64 md:w-92 md:h-72 flex items-center justify-center select-none pointer-events-none"
    >
      {/* Invisible drop target hitbox */}
      <div className="absolute inset-0 pointer-events-auto" />

      {/* Dynamic Trick Group Container: Animates all 4 cards moving together towards winning player */}
      <div
        id="trick-cards-group"
        className={`relative w-full h-full flex items-center justify-center pointer-events-none ${
          isCollecting && winningRelPos ? `animate-trick-win-${winningRelPos}` : ''
        }`}
        style={targetVector ? ({
          '--trick-win-x': `${targetVector.x}px`,
          '--trick-win-y': `${targetVector.y}px`,
        } as React.CSSProperties) : undefined}
      >
        {/* 1. BOTTOM SLOT */}
        <div
          ref={slotRefs.bottom}
          data-trick-slot="bottom"
          className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[4.5rem] h-[6.3rem] sm:w-[5.25rem] sm:h-[7.35rem] md:w-[6rem] md:h-[8.4rem] aspect-[5/7] flex items-center justify-center pointer-events-none"
        >
          {cardsBySlot.bottom && (
            <div
              key={`${cardsBySlot.bottom.cardId}_${cardsBySlot.bottom.playerIndex}`}
              className="w-full h-full flex items-center justify-center animate-card-land-bottom"
            >
              <PlayingCard
                cardId={cardsBySlot.bottom.cardId}
                rotation={SLOT_ROTATIONS.bottom}
                size="table"
                className="shadow-xl"
              />
            </div>
          )}
        </div>

        {/* 2. TOP SLOT */}
        <div
          ref={slotRefs.top}
          data-trick-slot="top"
          className="absolute top-1 left-1/2 -translate-x-1/2 w-[4.5rem] h-[6.3rem] sm:w-[5.25rem] sm:h-[7.35rem] md:w-[6rem] md:h-[8.4rem] aspect-[5/7] flex items-center justify-center pointer-events-none"
        >
          {cardsBySlot.top && (
            <div
              key={`${cardsBySlot.top.cardId}_${cardsBySlot.top.playerIndex}`}
              className="w-full h-full flex items-center justify-center animate-card-land-top"
            >
              <PlayingCard
                cardId={cardsBySlot.top.cardId}
                rotation={SLOT_ROTATIONS.top}
                size="table"
                className="shadow-xl"
              />
            </div>
          )}
        </div>

        {/* 3. LEFT SLOT */}
        <div
          ref={slotRefs.left}
          data-trick-slot="left"
          className="absolute left-2 top-1/2 -translate-y-1/2 w-[4.5rem] h-[6.3rem] sm:w-[5.25rem] sm:h-[7.35rem] md:w-[6rem] md:h-[8.4rem] aspect-[5/7] flex items-center justify-center pointer-events-none"
        >
          {cardsBySlot.left && (
            <div
              key={`${cardsBySlot.left.cardId}_${cardsBySlot.left.playerIndex}`}
              className="w-full h-full flex items-center justify-center animate-card-land-left"
            >
              <PlayingCard
                cardId={cardsBySlot.left.cardId}
                rotation={SLOT_ROTATIONS.left}
                size="table"
                className="shadow-xl"
              />
            </div>
          )}
        </div>

        {/* 4. RIGHT SLOT */}
        <div
          ref={slotRefs.right}
          data-trick-slot="right"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-[4.5rem] h-[6.3rem] sm:w-[5.25rem] sm:h-[7.35rem] md:w-[6rem] md:h-[8.4rem] aspect-[5/7] flex items-center justify-center pointer-events-none"
        >
          {cardsBySlot.right && (
            <div
              key={`${cardsBySlot.right.cardId}_${cardsBySlot.right.playerIndex}`}
              className="w-full h-full flex items-center justify-center animate-card-land-right"
            >
              <PlayingCard
                cardId={cardsBySlot.right.cardId}
                rotation={SLOT_ROTATIONS.right}
                size="table"
                className="shadow-xl"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
