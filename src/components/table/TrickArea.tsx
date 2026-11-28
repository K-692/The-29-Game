import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';
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
  /** Your card, shown immediately on drop (before the server confirms it). */
  pendingOwnCard?: { cardId: string; fromRect: DOMRect | null } | null;
}

const SLOT_ROTATIONS: Record<'bottom' | 'top' | 'left' | 'right', number> = {
  bottom: -2,
  top: 2,
  left: 3,
  right: -3,
};

const FLY_MS = 380;

/**
 * A card arriving on the table. It animates once, on mount, from where it
 * came from: the exact spot you dropped it, or the player's seat. Because the
 * element is keyed by card + player it is never re-created when the server
 * confirms the play, so it never disappears and reappears.
 */
const FlyInCard: React.FC<{
  cardId: string;
  side: 'bottom' | 'top' | 'left' | 'right';
  rotation: number;
  fromRect: DOMRect | null;
  animate: boolean;
}> = ({ cardId, side, rotation, fromRect, animate }) => {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !animate || typeof el.animate !== 'function') return;
    const to = el.getBoundingClientRect();
    if (!to.width) return;

    let from: { x: number; y: number; scale: number; rotate: number };
    if (fromRect && fromRect.width) {
      // Your card: start exactly where you released it.
      from = {
        x: fromRect.left + fromRect.width / 2 - (to.left + to.width / 2),
        y: fromRect.top + fromRect.height / 2 - (to.top + to.height / 2),
        scale: fromRect.width / to.width,
        rotate: 0,
      };
    } else {
      // Someone else's card: start at their seat.
      const seat =
        side === 'bottom'
          ? document.querySelector('#player-hand') || document.querySelector('[data-seat="bottom"]')
          : document.querySelector(`[data-seat="${side}"]`);
      const r = seat?.getBoundingClientRect();
      const fallback = { bottom: [0, 220], top: [0, -220], left: [-260, 0], right: [260, 0] }[side];
      from = r
        ? { x: r.left + r.width / 2 - (to.left + to.width / 2), y: r.top + r.height / 2 - (to.top + to.height / 2), scale: 0.45, rotate: side === 'left' ? -25 : side === 'right' ? 25 : 0 }
        : { x: fallback[0], y: fallback[1], scale: 0.45, rotate: 0 };
    }

    el.animate(
      [
        { transform: `translate(${from.x}px, ${from.y}px) scale(${from.scale}) rotate(${from.rotate}deg)` },
        { transform: 'translate(0, 0) scale(1) rotate(0deg)' },
      ],
      { duration: FLY_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
    );
    // Animate only on first mount; later renders (server confirmation) keep the card still.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center will-change-transform">
      <PlayingCard cardId={cardId} rotation={rotation} size="table" className="shadow-xl" />
    </div>
  );
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
  pendingOwnCard = null,
}) => {
  // Cards already on the table when the view first mounts (e.g. after a refresh) don't fly in.
  const firstPaintRef = useRef(true);
  useEffect(() => {
    firstPaintRef.current = false;
  }, []);
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
    const withPending = pendingOwnCard && !playedCards.some((pc) => pc.cardId === pendingOwnCard.cardId)
      ? [...playedCards, { cardId: pendingOwnCard.cardId, playerIndex: myPosition }]
      : playedCards;
    withPending.forEach((pc) => {
      const key = `${pc.cardId}_${pc.playerIndex}`;
      if (!playedCardKeysRef.current.has(key)) {
        playedCardKeysRef.current.add(key);
        soundManager.playEventOnce(`card_placed_${currentTrickKey}_${key}`, 'place');
      }
    });
  }, [playedCards, currentTrickKey, pendingOwnCard, myPosition]);

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

    // Timeline (server holds the full trick for TRICK_DISPLAY_MS = 1600ms):
    //   0–280ms   4th card lands
    //   280–900ms all 4 cards visible together
    //   900–1420ms cards sweep together to the winner
    //   1460ms    trick retired, ~140ms before the server starts the next trick
    timer1Ref.current = setTimeout(() => {
      // Step 2: Trigger collection animation where all 4 cards move together towards winning player
      setIsCollecting(true);
      soundManager.playEventOnce(`trick_collect_${currentTrickKey}`, 'shove');
      onTrickWinnerDetermined?.(winnerPos);
    }, 900);

    timer2Ref.current = setTimeout(() => {
      setRetiredTrickKey(currentTrickKey);
      setFrozenCards(null);
      setIsCollecting(false);
      setWinningRelPos(null);
      setTargetVector(null);
      onTrickWinnerDetermined?.(null);
    }, 1460);
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
  const baseCards = isRetired ? [] : (frozenCards || playedCards);
  // Show your own card the moment you drop it; the server-confirmed card later
  // renders with the same key, so the very same element stays on the table.
  const showPendingOwn =
    pendingOwnCard &&
    !isRetired &&
    !frozenCards &&
    !baseCards.some((pc) => pc.playerIndex === myPosition || pc.cardId === pendingOwnCard.cardId);
  const cardsToRender: PlayedCard[] = showPendingOwn
    ? [...baseCards, { cardId: pendingOwnCard!.cardId, playerIndex: myPosition }]
    : baseCards;

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
            <FlyInCard
              key={`${cardsBySlot.bottom.cardId}_${cardsBySlot.bottom.playerIndex}`}
              cardId={cardsBySlot.bottom.cardId}
              side="bottom"
              rotation={SLOT_ROTATIONS.bottom}
              fromRect={pendingOwnCard?.cardId === cardsBySlot.bottom.cardId ? pendingOwnCard.fromRect : null}
              animate={!firstPaintRef.current}
            />
          )}
        </div>

        {/* 2. TOP SLOT */}
        <div
          ref={slotRefs.top}
          data-trick-slot="top"
          className="absolute top-1 left-1/2 -translate-x-1/2 w-[4.5rem] h-[6.3rem] sm:w-[5.25rem] sm:h-[7.35rem] md:w-[6rem] md:h-[8.4rem] aspect-[5/7] flex items-center justify-center pointer-events-none"
        >
          {cardsBySlot.top && (
            <FlyInCard
              key={`${cardsBySlot.top.cardId}_${cardsBySlot.top.playerIndex}`}
              cardId={cardsBySlot.top.cardId}
              side="top"
              rotation={SLOT_ROTATIONS.top}
              fromRect={null}
              animate={!firstPaintRef.current}
            />
          )}
        </div>

        {/* 3. LEFT SLOT */}
        <div
          ref={slotRefs.left}
          data-trick-slot="left"
          className="absolute left-2 top-1/2 -translate-y-1/2 w-[4.5rem] h-[6.3rem] sm:w-[5.25rem] sm:h-[7.35rem] md:w-[6rem] md:h-[8.4rem] aspect-[5/7] flex items-center justify-center pointer-events-none"
        >
          {cardsBySlot.left && (
            <FlyInCard
              key={`${cardsBySlot.left.cardId}_${cardsBySlot.left.playerIndex}`}
              cardId={cardsBySlot.left.cardId}
              side="left"
              rotation={SLOT_ROTATIONS.left}
              fromRect={null}
              animate={!firstPaintRef.current}
            />
          )}
        </div>

        {/* 4. RIGHT SLOT */}
        <div
          ref={slotRefs.right}
          data-trick-slot="right"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-[4.5rem] h-[6.3rem] sm:w-[5.25rem] sm:h-[7.35rem] md:w-[6rem] md:h-[8.4rem] aspect-[5/7] flex items-center justify-center pointer-events-none"
        >
          {cardsBySlot.right && (
            <FlyInCard
              key={`${cardsBySlot.right.cardId}_${cardsBySlot.right.playerIndex}`}
              cardId={cardsBySlot.right.cardId}
              side="right"
              rotation={SLOT_ROTATIONS.right}
              fromRect={null}
              animate={!firstPaintRef.current}
            />
          )}
        </div>
      </div>
    </div>
  );
};
