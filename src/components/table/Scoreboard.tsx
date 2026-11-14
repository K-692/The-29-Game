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
  const biddingTeamLabel = isBiddingTeam0 ? 'Team A' : isBiddingTeam1 ? 'Team B' : '';

  return (
    <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl px-3 sm:px-4 py-1.5 shadow-md flex items-center gap-3 sm:gap-4 text-xs sm:text-sm select-none text-slate-800">
      {/* Team A Score */}
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
        <span className="font-bold text-slate-800">
          Team A{myTeam === 0 ? ' (You)' : ''}:
        </span>
        <span className={`font-mono font-black ${matchScore.team0 >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
          {matchScore.team0 > 0 ? `+${matchScore.team0}` : matchScore.team0}
        </span>
      </div>

      <span className="text-slate-300 font-light">|</span>

      {/* Team B Score */}
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
        <span className="font-bold text-slate-800">
          Team B{myTeam === 1 ? ' (You)' : ''}:
        </span>
        <span className={`font-mono font-black ${matchScore.team1 >= 0 ? 'text-amber-700' : 'text-red-600'}`}>
          {matchScore.team1 > 0 ? `+${matchScore.team1}` : matchScore.team1}
        </span>
      </div>

      {/* Contract Target & Bidding Team (Permanently visible after bidding completes) */}
      {hasTarget && (
        <>
          <span className="text-slate-300 font-light hidden xs:inline">|</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-700">
              Target: <strong className="text-amber-700 font-black">{highestBid}</strong>
            </span>
            <span className="text-slate-400 font-normal hidden sm:inline">·</span>
            <span className="font-semibold text-slate-600 hidden sm:inline">
              Bidding: <strong className="text-slate-900 font-bold">{biddingTeamLabel}</strong>
            </span>
          </div>
        </>
      )}
    </div>
  );
};
