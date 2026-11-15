import React, { useEffect, useState, useRef } from 'react';
import { CompletedTrick, PlayedCard, PlayerInfo, PlayerPosition } from '../../engine/types';
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
}) => {
  // State for freeze-frame and collection animation
  const [frozenCards, setFrozenCards] = useState<PlayedCard[] | null>(null);
  const [isCollecting, setIsCollecting] = useState<boolean>(false);
  const [collectionVectors, setCollectionVectors] = useState<Record<string, { x: number; y: number }>>({});
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
      setCollectionVectors({});
    }
  }, [currentTrickKey]);

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

    const latestTrick = lastCompletedTrick || (completedTricks.length > 0 ? completedTricks[completedTricks.length - 1] : null);
    const winnerPos = latestTrick ? latestTrick.winner : myPosition;
    const targetRelPos = getRelativePosition(winnerPos);

    if (timer1Ref.current) clearTimeout(timer1Ref.current);
    if (timer2Ref.current) clearTimeout(timer2Ref.current);

    // Step 1: Hold all 4 cards on the felt for 800ms so trick outcome is clearly visible
    timer1Ref.current = setTimeout(() => {
      // Step 2: Calculate dynamic trajectory directly into the winning player's avatar center
      const targetAvatarEl =
        document.querySelector(`[data-avatar="${targetRelPos}"]`) ||
        document.querySelector(`[data-seat="${targetRelPos}"]`);
      const targetRect = targetAvatarEl?.getBoundingClientRect();

      const vectors: Record<string, { x: number; y: number }> = {};
      cardsToAnimate.forEach((pc) => {
        const key = `${pc.cardId}_${pc.playerIndex}`;
        const pcRelPos = getRelativePosition(pc.playerIndex);
        const slotEl = slotRefs[pcRelPos].current;

        if (slotEl && targetRect) {
          const slotRect = slotEl.getBoundingClientRect();
          const targetCenterX = targetRect.left + targetRect.width / 2;
          const targetCenterY = targetRect.top + targetRect.height / 2;
          const slotCenterX = slotRect.left + slotRect.width / 2;
          const slotCenterY = slotRect.top + slotRect.height / 2;
          vectors[key] = {
            x: targetCenterX - slotCenterX,
            y: targetCenterY - slotCenterY,
          };
        } else {
          // Dynamic fallback offsets based on table orientation
          switch (targetRelPos) {
            case 'bottom': vectors[key] = { x: 0, y: 360 }; break;
            case 'top': vectors[key] = { x: 0, y: -360 }; break;
            case 'left': vectors[key] = { x: -440, y: 0 }; break;
            case 'right': vectors[key] = { x: 440, y: 0 }; break;
          }
        }
      });

      setCollectionVectors(vectors);
      setIsCollecting(true);
      soundManager.playTrickShove();
    }, 800);

    // Step 3: At 1450ms (800ms hold + 650ms slide), collection finishes and trick is authoritatively retired
    timer2Ref.current = setTimeout(() => {
      setRetiredTrickKey(currentTrickKey);
      setFrozenCards(null);
      setIsCollecting(false);
      setCollectionVectors({});
    }, 1450);
  }, [isFourCards, currentTrickKey, retiredTrickKey, lastCompletedTrick, completedTricks.length, myPosition]);

  useEffect(() => {
    return () => {
      if (timer1Ref.current) clearTimeout(timer1Ref.current);
      if (timer2Ref.current) clearTimeout(timer2Ref.current);
    };
  }, []);

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
      className="relative w-64 h-52 sm:w-72 sm:h-60 md:w-80 md:h-64 flex items-center justify-center select-none pointer-events-none"
    >
      {/* Invisible drop target hitbox */}
      <div className="absolute inset-0 pointer-events-auto" />

      {/* 4 Dedicated Slots with Fixed Anchors */}
      {/* 1. BOTTOM SLOT */}
      <div
        ref={slotRefs.bottom}
        data-trick-slot="bottom"
        className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-[5.6rem] sm:w-[4.5rem] sm:h-[6.3rem] md:w-20 md:h-[7rem] aspect-[5/7] flex items-center justify-center pointer-events-none"
      >
        {cardsBySlot.bottom && (
          <div
            key={`${cardsBySlot.bottom.cardId}_${cardsBySlot.bottom.playerIndex}`}
            className={`w-full h-full flex items-center justify-center ${isCollecting ? '' : 'animate-card-land-bottom'}`}
            style={{
              transform: isCollecting && collectionVectors[`${cardsBySlot.bottom.cardId}_${cardsBySlot.bottom.playerIndex}`]
                ? `translate3d(${collectionVectors[`${cardsBySlot.bottom.cardId}_${cardsBySlot.bottom.playerIndex}`].x}px, ${collectionVectors[`${cardsBySlot.bottom.cardId}_${cardsBySlot.bottom.playerIndex}`].y}px, 0) scale(0.25)`
                : undefined,
              transition: isCollecting
                ? 'transform 0.65s cubic-bezier(0.4, 0.0, 0.2, 1), opacity 0.65s cubic-bezier(0.4, 0.0, 0.2, 1)'
                : undefined,
              opacity: isCollecting ? 0 : 1,
              willChange: 'transform, opacity',
            }}
          >
            <PlayingCard
              cardId={cardsBySlot.bottom.cardId}
              rotation={SLOT_ROTATIONS.bottom}
              size="sm"
              className="rounded-lg shadow-xl"
            />
          </div>
        )}
      </div>

      {/* 2. TOP SLOT */}
      <div
        ref={slotRefs.top}
        data-trick-slot="top"
        className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-[5.6rem] sm:w-[4.5rem] sm:h-[6.3rem] md:w-20 md:h-[7rem] aspect-[5/7] flex items-center justify-center pointer-events-none"
      >
        {cardsBySlot.top && (
          <div
            key={`${cardsBySlot.top.cardId}_${cardsBySlot.top.playerIndex}`}
            className={`w-full h-full flex items-center justify-center ${isCollecting ? '' : 'animate-card-land-top'}`}
            style={{
              transform: isCollecting && collectionVectors[`${cardsBySlot.top.cardId}_${cardsBySlot.top.playerIndex}`]
                ? `translate3d(${collectionVectors[`${cardsBySlot.top.cardId}_${cardsBySlot.top.playerIndex}`].x}px, ${collectionVectors[`${cardsBySlot.top.cardId}_${cardsBySlot.top.playerIndex}`].y}px, 0) scale(0.25)`
                : undefined,
              transition: isCollecting
                ? 'transform 0.65s cubic-bezier(0.4, 0.0, 0.2, 1), opacity 0.65s cubic-bezier(0.4, 0.0, 0.2, 1)'
                : undefined,
              opacity: isCollecting ? 0 : 1,
              willChange: 'transform, opacity',
            }}
          >
            <PlayingCard
              cardId={cardsBySlot.top.cardId}
              rotation={SLOT_ROTATIONS.top}
              size="sm"
              className="rounded-lg shadow-xl"
            />
          </div>
        )}
      </div>

      {/* 3. LEFT SLOT */}
      <div
        ref={slotRefs.left}
        data-trick-slot="left"
        className="absolute left-3 top-1/2 -translate-y-1/2 w-16 h-[5.6rem] sm:w-[4.5rem] sm:h-[6.3rem] md:w-20 md:h-[7rem] aspect-[5/7] flex items-center justify-center pointer-events-none"
      >
        {cardsBySlot.left && (
          <div
            key={`${cardsBySlot.left.cardId}_${cardsBySlot.left.playerIndex}`}
            className={`w-full h-full flex items-center justify-center ${isCollecting ? '' : 'animate-card-land-left'}`}
            style={{
              transform: isCollecting && collectionVectors[`${cardsBySlot.left.cardId}_${cardsBySlot.left.playerIndex}`]
                ? `translate3d(${collectionVectors[`${cardsBySlot.left.cardId}_${cardsBySlot.left.playerIndex}`].x}px, ${collectionVectors[`${cardsBySlot.left.cardId}_${cardsBySlot.left.playerIndex}`].y}px, 0) scale(0.25)`
                : undefined,
              transition: isCollecting
                ? 'transform 0.65s cubic-bezier(0.4, 0.0, 0.2, 1), opacity 0.65s cubic-bezier(0.4, 0.0, 0.2, 1)'
                : undefined,
              opacity: isCollecting ? 0 : 1,
              willChange: 'transform, opacity',
            }}
          >
            <PlayingCard
              cardId={cardsBySlot.left.cardId}
              rotation={SLOT_ROTATIONS.left}
              size="sm"
              className="rounded-lg shadow-xl"
            />
          </div>
        )}
      </div>

      {/* 4. RIGHT SLOT */}
      <div
        ref={slotRefs.right}
        data-trick-slot="right"
        className="absolute right-3 top-1/2 -translate-y-1/2 w-16 h-[5.6rem] sm:w-[4.5rem] sm:h-[6.3rem] md:w-20 md:h-[7rem] aspect-[5/7] flex items-center justify-center pointer-events-none"
      >
        {cardsBySlot.right && (
          <div
            key={`${cardsBySlot.right.cardId}_${cardsBySlot.right.playerIndex}`}
            className={`w-full h-full flex items-center justify-center ${isCollecting ? '' : 'animate-card-land-right'}`}
            style={{
              transform: isCollecting && collectionVectors[`${cardsBySlot.right.cardId}_${cardsBySlot.right.playerIndex}`]
                ? `translate3d(${collectionVectors[`${cardsBySlot.right.cardId}_${cardsBySlot.right.playerIndex}`].x}px, ${collectionVectors[`${cardsBySlot.right.cardId}_${cardsBySlot.right.playerIndex}`].y}px, 0) scale(0.25)`
                : undefined,
              transition: isCollecting
                ? 'transform 0.65s cubic-bezier(0.4, 0.0, 0.2, 1), opacity 0.65s cubic-bezier(0.4, 0.0, 0.2, 1)'
                : undefined,
              opacity: isCollecting ? 0 : 1,
              willChange: 'transform, opacity',
            }}
          >
            <PlayingCard
              cardId={cardsBySlot.right.cardId}
              rotation={SLOT_ROTATIONS.right}
              size="sm"
              className="rounded-lg shadow-xl"
            />
          </div>
        )}
      </div>
    </div>
  );
};
