import React from 'react';
import { PublicGameState, Team } from '../../engine/types';
import { SUIT_SYMBOLS, Suit } from '../../assets/cardManifest';
import { Shield, Trophy, Users } from 'lucide-react';

interface ScoreboardProps {
  publicState: PublicGameState;
  myTeam: Team;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ publicState, myTeam }) => {
  const { matchScore, highestBid, highestBidder, roundNumber, completedTricks, currentTrickNumber } = publicState;

  // Calculate points won so far in current deal
  let team0Points = 0;
  let team1Points = 0;
  for (const trick of completedTricks) {
    if (trick.winningTeam === 0) team0Points += trick.points;
    else team1Points += trick.points;
  }

  const isBiddingTeam0 = highestBidder === 0 || highestBidder === 2;
  const isBiddingTeam1 = highestBidder === 1 || highestBidder === 3;

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800/80 rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
      {/* Team A (You & Partner: P0 & P2) */}
      <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all ${
        myTeam === 0 ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300' : 'bg-slate-800/50 border-slate-700/50 text-slate-300'
      }`}>
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <div>
          <div className="font-bold flex items-center gap-1">
            Team A {myTeam === 0 ? '(You)' : ''}
            {isBiddingTeam0 && <span className="bg-amber-500 text-slate-950 text-[10px] px-1 rounded font-black">BIDDER</span>}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Tricks Pts: <span className="font-bold text-amber-400">{team0Points}</span>
          </div>
        </div>
        <div className="ml-2 pl-2 border-l border-slate-700 text-center">
          <span className="text-[10px] text-slate-400 block uppercase">Match</span>
          <span className={`text-base font-black ${matchScore.team0 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {matchScore.team0 > 0 ? `+${matchScore.team0}` : matchScore.team0}
          </span>
        </div>
      </div>

      {/* Center Deal Info */}
      <div className="flex items-center gap-4 text-center px-2">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Deal</span>
          <span className="font-black text-slate-200">#{roundNumber}</span>
        </div>
        <div className="h-6 w-px bg-slate-800" />
        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Trick</span>
          <span className="font-black text-slate-200">{currentTrickNumber} / 8</span>
        </div>
        <div className="h-6 w-px bg-slate-800" />
        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Target</span>
          <span className="font-black text-amber-400">{highestBid > 0 ? highestBid : '-'}</span>
        </div>
      </div>

      {/* Team B (Opponents: P1 & P3) */}
      <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all ${
        myTeam === 1 ? 'bg-amber-950/40 border-amber-500/50 text-amber-300' : 'bg-slate-800/50 border-slate-700/50 text-slate-300'
      }`}>
        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <div>
          <div className="font-bold flex items-center gap-1">
            Team B {myTeam === 1 ? '(You)' : ''}
            {isBiddingTeam1 && <span className="bg-amber-500 text-slate-950 text-[10px] px-1 rounded font-black">BIDDER</span>}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Tricks Pts: <span className="font-bold text-amber-400">{team1Points}</span>
          </div>
        </div>
        <div className="ml-2 pl-2 border-l border-slate-700 text-center">
          <span className="text-[10px] text-slate-400 block uppercase">Match</span>
          <span className={`text-base font-black ${matchScore.team1 >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
            {matchScore.team1 > 0 ? `+${matchScore.team1}` : matchScore.team1}
          </span>
        </div>
      </div>
    </div>
  );
};

