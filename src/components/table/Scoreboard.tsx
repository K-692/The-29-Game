import React from 'react';
import { PublicGameState, Team } from '../../engine/types';

interface ScoreboardProps {
  publicState: PublicGameState;
  myTeam: Team;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ publicState, myTeam }) => {
  const { matchScore, highestBid, highestBidder } = publicState;

  const isBiddingTeam0 = highestBidder === 0 || highestBidder === 2;
  const isBiddingTeam1 = highestBidder === 1 || highestBidder === 3;
  const hasTarget = highestBid > 0 && highestBidder !== null;

  return (
    <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl px-3 sm:px-4 py-1.5 shadow-md flex items-center gap-3 sm:gap-4 text-xs sm:text-sm select-none text-slate-800">
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

      {/* Contract Target & Bidding Partnership */}
      {hasTarget && (
        <>
          <span className="text-slate-300 font-light hidden xs:inline">|</span>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-bold text-slate-700">
              Target: <strong className="text-slate-900 font-black">{highestBid}</strong>
            </span>
            <span className="text-slate-400 font-normal hidden sm:inline">·</span>
            <span className="font-semibold text-slate-600 hidden sm:inline flex items-center gap-1.5" title="Bidding Team">
              <span className={`w-2 h-2 rounded-full ${isBiddingTeam0 ? 'bg-sky-500' : 'bg-rose-500'}`} />
            </span>
          </div>
        </>
      )}
    </div>
  );
};
