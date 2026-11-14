import React, { useEffect, useState } from 'react';
import { PlayerPosition } from '../../engine/types';
import { PlayingCard } from '../card/PlayingCard';
import { soundManager } from '../../common/SoundManager';

interface CardPlayFlightAnimationProps {
  cardId: string;
  playerIndex: PlayerPosition;
  myPosition: PlayerPosition;
  onAnimationComplete: () => void;
}

export const CardPlayFlightAnimation: React.FC<CardPlayFlightAnimationProps> = ({
  cardId,
  playerIndex,
  myPosition,
  onAnimationComplete,
}) => {
  const [coords, setCoords] = useState<{
    x: number;
    y: number;
    rotation: number;
    scale: number;
  } | null>(null);

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

  useEffect(() => {
    // 1. Measure Start Coordinates from player seat / hand
    const seatEl = document.querySelector(`[data-seat="${relPos}"]`);
    let startX = window.innerWidth / 2;
    let startY = window.innerHeight * 0.85;

    if (relPos === 'bottom') {
      const handEl = document.querySelector('#player-hand');
      if (handEl) {
        const r = handEl.getBoundingClientRect();
        startX = r.left + r.width / 2;
        startY = r.top + r.height / 2;
      } else if (seatEl) {
        const r = seatEl.getBoundingClientRect();
        startX = r.left + r.width / 2;
        startY = r.top + r.height / 2;
      }
    } else if (seatEl) {
      const r = seatEl.getBoundingClientRect();
      startX = r.left + r.width / 2;
      startY = r.top + r.height / 2;
    } else {
      // Fallbacks
      if (relPos === 'top') {
        startX = window.innerWidth / 2;
        startY = 80;
      } else if (relPos === 'left') {
        startX = 80;
        startY = window.innerHeight / 2;
      } else if (relPos === 'right') {
        startX = window.innerWidth - 80;
        startY = window.innerHeight / 2;
      }
    }

    // 2. Measure Target Coordinates in Trick Area
    const trickEl = document.querySelector('#trick-area');
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;

    if (trickEl) {
      const tr = trickEl.getBoundingClientRect();
      const cx = tr.left + tr.width / 2;
      const cy = tr.top + tr.height / 2;
      switch (relPos) {
        case 'bottom':
          targetX = cx;
          targetY = cy + 45;
          break;
        case 'top':
          targetX = cx;
          targetY = cy - 45;
          break;
        case 'left':
          targetX = cx - 55;
          targetY = cy;
          break;
        case 'right':
          targetX = cx + 55;
          targetY = cy;
          break;
      }
    }

    // Initial position
    let initialRotation = 0;
    if (relPos === 'left') initialRotation = 12;
    else if (relPos === 'right') initialRotation = -12;
    else if (relPos === 'top') initialRotation = 6;

    setCoords({
      x: startX,
      y: startY,
      rotation: initialRotation,
      scale: 0.85,
    });

    soundManager.playSlide();

    // Trigger smooth flight in next animation frame
    const raf = requestAnimationFrame(() => {
      const timer = setTimeout(() => {
        let finalRotation = 0;
        if (relPos === 'bottom') finalRotation = -2;
        else if (relPos === 'top') finalRotation = 2;
        else if (relPos === 'left') finalRotation = 3;
        else if (relPos === 'right') finalRotation = -3;

        setCoords({
          x: targetX,
          y: targetY,
          rotation: finalRotation,
          scale: 1,
        });
        soundManager.playCardPlace();
      }, 20);

      return () => clearTimeout(timer);
    });

    // Complete flight and hand off to static trick area
    const completionTimer = setTimeout(() => {
      onAnimationComplete();
    }, 320);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(completionTimer);
    };
  }, [cardId, playerIndex, myPosition, relPos]);

  if (!coords) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-45 overflow-hidden">
      <div
        style={{
          position: 'absolute',
          left: `${coords.x}px`,
          top: `${coords.y}px`,
          transform: `translate(-50%, -50%) rotate(${coords.rotation}deg) scale(${coords.scale})`,
          transition:
            'left 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), top 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.3s ease-out',
        }}
        className="w-16 h-22 sm:w-20 sm:h-28 md:w-24 md:h-34 shadow-2xl rounded-xl ring-1 ring-slate-900/15"
      >
        <PlayingCard cardId={cardId} faceDown={false} size="md" />
      </div>
    </div>
  );
};
