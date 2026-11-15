import React, { useEffect, useState, useRef } from 'react';
import { PlayerPosition } from '../../engine/types';
import { PlayingCard } from '../card/PlayingCard';
import { soundManager } from '../../common/SoundManager';

interface CardPlayFlightAnimationProps {
  cardId: string;
  playerIndex: PlayerPosition;
  myPosition: PlayerPosition;
  originRect?: { left: number; top: number; width: number; height: number } | null;
  onAnimationComplete: () => void;
}

const SLOT_ROTATIONS: Record<'bottom' | 'top' | 'left' | 'right', number> = {
  bottom: -2,
  top: 2,
  left: 3,
  right: -3,
};

export const CardPlayFlightAnimation: React.FC<CardPlayFlightAnimationProps> = ({
  cardId,
  playerIndex,
  myPosition,
  originRect,
  onAnimationComplete,
}) => {
  // Map player absolute position to relative seat (bottom, left, top, right)
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

  const relPos = getRelativePosition(playerIndex);

  const [animState, setAnimState] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    deltaX: number;
    deltaY: number;
    targetRotation: number;
    isMoving: boolean;
  } | null>(null);

  const hasCalledCompleteRef = useRef(false);

  useEffect(() => {
    hasCalledCompleteRef.current = false;

    // 1. Measure Exact Target Slot Coordinates
    const slotEl = document.querySelector(`[data-trick-slot="${relPos}"]`);
    let targetX = window.innerWidth / 2 - 40;
    let targetY = window.innerHeight / 2 - 55;
    let slotWidth = 80;
    let slotHeight = 112;

    if (slotEl) {
      const slotRect = slotEl.getBoundingClientRect();
      targetX = slotRect.left;
      targetY = slotRect.top;
      slotWidth = slotRect.width;
      slotHeight = slotRect.height;
    } else {
      const trickEl = document.querySelector('#trick-area');
      if (trickEl) {
        const tr = trickEl.getBoundingClientRect();
        const cx = tr.left + tr.width / 2 - 50;
        const cy = tr.top + tr.height / 2 - 70;
        switch (relPos) {
          case 'bottom': targetX = cx; targetY = cy + 85; break;
          case 'top': targetX = cx; targetY = cy - 85; break;
          case 'left': targetX = cx - 100; targetY = cy; break;
          case 'right': targetX = cx + 100; targetY = cy; break;
        }
      }
    }

    // 2. Determine Exact Start Coordinates
    let startX = targetX;
    let startY = window.innerHeight * 0.85;

    if (originRect && relPos === 'bottom') {
      startX = originRect.left + (originRect.width - slotWidth) / 2;
      startY = originRect.top + (originRect.height - slotHeight) / 2;
    } else {
      const seatEl = document.querySelector(`[data-seat="${relPos}"]`);
      if (relPos === 'bottom') {
        const handEl = document.querySelector('#player-hand');
        if (handEl) {
          const r = handEl.getBoundingClientRect();
          startX = r.left + (r.width - slotWidth) / 2;
          startY = r.top + (r.height - slotHeight) / 2;
        } else if (seatEl) {
          const r = seatEl.getBoundingClientRect();
          startX = r.left + (r.width - slotWidth) / 2;
          startY = r.top + (r.height - slotHeight) / 2;
        }
      } else if (seatEl) {
        const r = seatEl.getBoundingClientRect();
        startX = r.left + (r.width - slotWidth) / 2;
        startY = r.top + (r.height - slotHeight) / 2;
      }
    }

    const targetRotation = SLOT_ROTATIONS[relPos];
    const deltaX = targetX - startX;
    const deltaY = targetY - startY;

    // Set initial position
    setAnimState({
      x: startX,
      y: startY,
      width: slotWidth,
      height: slotHeight,
      deltaX,
      deltaY,
      targetRotation,
      isMoving: false,
    });

    soundManager.playSlide();

    // Trigger transition to target position in next animation frame
    const raf = requestAnimationFrame(() => {
      const timer = setTimeout(() => {
        setAnimState((prev) => (prev ? { ...prev, isMoving: true } : null));
      }, 20);

      return () => clearTimeout(timer);
    });

    // Complete flight and hand off seamlessly to the trick slot
    const completionTimer = setTimeout(() => {
      if (!hasCalledCompleteRef.current) {
        hasCalledCompleteRef.current = true;
        soundManager.playCardPlace();
        onAnimationComplete();
      }
    }, 280);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(completionTimer);
    };
  }, [cardId, playerIndex, myPosition, relPos, originRect, onAnimationComplete]);

  if (!animState) return null;

  return (
    <div
      className="fixed z-40 pointer-events-none select-none"
      style={{
        left: animState.x,
        top: animState.y,
        width: animState.width,
        height: animState.height,
        transform: animState.isMoving
          ? `translate3d(${animState.deltaX}px, ${animState.deltaY}px, 0)`
          : 'translate3d(0, 0, 0)',
        transition: animState.isMoving
          ? 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)'
          : 'none',
        willChange: 'transform',
      }}
    >
      <div className="w-full h-full flex items-center justify-center">
        <PlayingCard
          cardId={cardId}
          rotation={animState.targetRotation}
          size="sm"
          className="rounded-lg shadow-2xl border border-slate-200/40"
        />
      </div>
    </div>
  );
};
