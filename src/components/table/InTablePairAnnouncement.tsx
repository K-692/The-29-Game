import React, { useEffect } from 'react';
import { PairDeclaration } from '../../engine/types';
import { PlayingCard } from '../card/PlayingCard';
import { Crown } from 'lucide-react';

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
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss?.();
    }, 2000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const kingId = pair.kingCardId || `K_${pair.suit}`;
  const queenId = pair.queenCardId || `Q_${pair.suit}`;

  return (
    <div className="relative flex flex-col items-center justify-center p-3.5 sm:p-4 rounded-3xl bg-slate-950/90 backdrop-blur-md border-2 border-purple-400 shadow-[0_0_35px_rgba(168,85,247,0.5)] text-center select-none pointer-events-none animate-in fade-in zoom-in-95 duration-200 max-w-xs sm:max-w-sm mx-auto">
      {/* Crown Badge */}
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-900/80 border border-purple-400/60 text-amber-300 text-xs font-black uppercase tracking-wider mb-2">
        <Crown className="w-4 h-4 text-amber-300 animate-bounce" />
        <span>King-Queen Pair / Royals!</span>
      </div>

      {/* Side-by-side King and Queen cards */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <PlayingCard cardId={kingId} size="sm" className="shadow-xl ring-2 ring-purple-300/80" />
        <PlayingCard cardId={queenId} size="sm" className="shadow-xl ring-2 ring-purple-300/80" />
      </div>

      {/* Announcement text */}
      <h4 className="text-sm sm:text-base font-black text-white">
        {playerName} holds King &amp; Queen of Trump!
      </h4>
      <p className="text-xs text-purple-200 mt-0.5">
        Target adjusted to <span className="font-bold text-amber-300 text-sm">{pair.adjustedTarget}</span>
        {' '}({pair.adjustment > 0 ? '+4' : '-4'} points)
      </p>
    </div>
  );
};
