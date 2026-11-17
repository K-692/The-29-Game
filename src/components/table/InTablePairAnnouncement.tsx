import React, { useEffect, useRef } from 'react';
import { PairDeclaration } from '../../engine/types';
import { PlayingCard } from '../card/PlayingCard';

interface InTablePairAnnouncementProps {
  pair: PairDeclaration;
  playerName: string;
  onDismiss?: () => void;
}

export const InTablePairAnnouncement: React.FC<InTablePairAnnouncementProps> = ({
  pair,
  playerName,
  onDismiss,
}) => {
  // Keep the latest callback in a ref so parent re-renders (e.g. the 1s turn
  // timer) never restart the 2-second display window.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  useEffect(() => {
    const timer = setTimeout(() => onDismissRef.current?.(), 2000);
    return () => clearTimeout(timer);
  }, []);

  const kingId = pair.kingCardId || `K_${pair.suit}`;
  const queenId = pair.queenCardId || `Q_${pair.suit}`;

  return (
    <div className="panel mx-auto w-max max-w-[20rem] px-5 py-4 flex items-center gap-4 pointer-events-none animate-fade-in">
      <div className="flex -space-x-5">
        <PlayingCard cardId={kingId} size="sm" className="shadow-soft -rotate-6" />
        <PlayingCard cardId={queenId} size="sm" className="shadow-soft rotate-6" />
      </div>
      <div>
        <div className="eyebrow">King &amp; Queen</div>
        <div className="panel-title text-lg leading-snug">{playerName} {playerName === 'You' ? 'hold' : 'holds'} the pair</div>
        <p className="text-xs text-cream-300 mt-0.5">
          Target {pair.adjustment > 0 ? 'raised' : 'lowered'} to <span className="text-cream-50 font-semibold">{pair.adjustedTarget}</span>
        </p>
      </div>
    </div>
  );
};
