import React from 'react';
import { PublicGameState, Team } from '../../engine/types';

interface ScoreboardProps {
  publicState: PublicGameState;
  myTeam: Team;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ publicState, myTeam }) => {
  const { matchScore, highestBid, highestBidder, players } = publicState;
  const bidder = highestBidder !== null ? players.find((p) => p.position === highestBidder) : null;
  const bidderName = bidder?.name;

  return (
    <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl px-3 sm:px-4 py-1.5 shadow-md flex items-center gap-2.5 sm:gap-3.5 text-xs sm:text-sm select-none text-slate-800">
      {/* Partnership 1 (Blue) */}
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0 shadow-xs" />
        <span className="font-bold text-slate-800 text-xs sm:text-sm">
          {myTeam === 0 ? 'Your Side' : 'Opponents'}:
        </span>
        <span className={`font-mono font-black ${matchScore.team0 >= 0 ? 'text-sky-700' : 'text-rose-600'}`}>
          {matchScore.team0 > 0 ? `+${matchScore.team0}` : matchScore.team0}
        </span>
      </div>

      <span className="text-slate-300 font-light">|</span>

      {/* Partnership 2 (Coral) */}
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 shadow-xs" />
        <span className="font-bold text-slate-800 text-xs sm:text-sm">
          {myTeam === 1 ? 'Your Side' : 'Opponents'}:
        </span>
        <span className={`font-mono font-black ${matchScore.team1 >= 0 ? 'text-rose-700' : 'text-rose-600'}`}>
          {matchScore.team1 > 0 ? `+${matchScore.team1}` : matchScore.team1}
        </span>
      </div>

      <span className="text-slate-300 font-light">|</span>

      {/* Current Round Bid */}
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-slate-800 text-xs sm:text-sm">
          Bid:
        </span>
        <span className="font-mono font-black text-amber-700">
          {highestBid > 0 ? (bidderName ? `${highestBid} (${bidderName})` : `${highestBid}`) : '-'}
        </span>
      </div>
    </div>
  );
};
