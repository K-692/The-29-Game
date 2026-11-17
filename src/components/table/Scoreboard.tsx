import React from 'react';
import { PublicGameState, Team } from '../../engine/types';

interface ScoreboardProps {
  publicState: PublicGameState;
  myTeam: Team;
  myPosition?: number;
}

/**
 * Match score + current contract, visible during every phase of the game.
 * Your side is green, opponents red (same as the seats).
 */
export const Scoreboard: React.FC<ScoreboardProps> = ({ publicState, myTeam, myPosition }) => {
  const { matchScore, highestBid, highestBidder, players, dealMultiplier, adjustedTarget, phase, rules } = publicState;
  const us = myTeam === 0 ? matchScore.team0 : matchScore.team1;
  const them = myTeam === 0 ? matchScore.team1 : matchScore.team0;
  const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

  const bidder = highestBidder !== null ? players.find((p) => p.position === highestBidder) : null;
  const bidderName = bidder ? (bidder.position === myPosition ? 'You' : bidder.name) : null;
  const bidderOwnSide = bidder ? (bidder.position % 2) === myTeam : false;
  const target = adjustedTarget ?? highestBid;
  const targetChanged = adjustedTarget != null && adjustedTarget !== highestBid;

  return (
    <div className="flex items-center gap-2 sm:gap-3 rounded-full bg-felt-900/90 border border-cream-100/15 px-3 sm:px-4 py-1.5 text-cream-100 shadow-soft backdrop-blur-md whitespace-nowrap">
      <div className="flex items-baseline gap-1.5" title="Your side">
        <span className="w-2 h-2 rounded-full bg-felt-400 self-center" />
        <span className="hidden sm:inline text-[10px] uppercase tracking-[0.14em] text-cream-300/80">Us</span>
        <span className="font-display text-lg leading-none tabular-nums">{fmt(us)}</span>
      </div>
      <div className="flex items-baseline gap-1.5" title="Opponents">
        <span className="w-2 h-2 rounded-full bg-suit-red self-center" />
        <span className="hidden sm:inline text-[10px] uppercase tracking-[0.14em] text-cream-300/80">Them</span>
        <span className="font-display text-lg leading-none tabular-nums">{fmt(them)}</span>
      </div>
      <span className="text-[10px] text-cream-300/60 hidden sm:inline">to {rules.targetGameScore}</span>

      <span className="w-px h-5 bg-cream-100/15" />

      <div className="flex items-baseline gap-1.5 text-sm">
        {highestBid > 0 ? (
          <>
            <span className="hidden sm:inline text-[10px] uppercase tracking-[0.14em] text-cream-300/80">
              {phase === 'BIDDING' ? 'High' : targetChanged ? 'Target' : 'Bid'}
            </span>
            {targetChanged && <span className="line-through text-cream-300/50 text-xs">{highestBid}</span>}
            <span className="font-display text-lg leading-none tabular-nums">{target}</span>
            {bidderName && (
              <span className={`text-xs truncate max-w-[4.5rem] sm:max-w-none ${bidderOwnSide ? 'text-felt-400' : 'text-[#e36a56]'}`}>{bidderName}</span>
            )}
          </>
        ) : (
          <span className="text-xs text-cream-300/70">{phase === 'BIDDING' ? 'Bidding…' : '—'}</span>
        )}
        {dealMultiplier > 1 && (
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              dealMultiplier === 4 ? 'bg-suit-red text-cream-50' : 'bg-cream-100 text-felt-800'
            }`}
            title={dealMultiplier === 4 ? 'Re-doubled' : 'Doubled'}
          >
            {dealMultiplier}×
          </span>
        )}
      </div>
    </div>
  );
};
