import React from 'react';
import { RoundSummary } from '../../engine/types';
import { CheckCircle2, Crown, Sparkles, XCircle } from 'lucide-react';

interface DealSummaryModalProps {
  summary: RoundSummary;
  isHost: boolean;
  onNextRound: () => void;
}

export const DealSummaryModal: React.FC<DealSummaryModalProps> = ({
  summary,
  isHost,
  onNextRound,
}) => {
  const {
    roundNumber,
    biddingTeam,
    contractBid,
    adjustedTarget,
    trumpSuit,
    team0CardPoints,
    team1CardPoints,
    biddingTeamWon,
    pairDeclared,
    gamePointsDelta,
    matchScore,
  } = summary;

  const biddingTeamPoints = biddingTeam === 0 ? team0CardPoints : team1CardPoints;
  const isTeam0Bidding = biddingTeam === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6">
        {/* Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider">
            Deal #{roundNumber} Recap
          </div>
          <div className="flex justify-center">
            {biddingTeamWon ? (
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border-2 border-emerald-500/50 shadow-xl">
                <CheckCircle2 className="w-10 h-10" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center border-2 border-red-500/50 shadow-xl">
                <XCircle className="w-10 h-10" />
              </div>
            )}
          </div>
          <h2 className="text-2xl font-black text-slate-100">
            {biddingTeamWon ? 'Contract Fulfilled!' : 'Contract Failed!'}
          </h2>
          <p className="text-sm text-slate-400">
            Team {biddingTeam === 0 ? 'A' : 'B'} bid <span className="text-amber-400 font-bold">{contractBid}</span> and scored <span className="text-slate-100 font-bold">{biddingTeamPoints}</span> card points
            {adjustedTarget !== contractBid ? ` (Target adjusted to ${adjustedTarget} pts by Pair declaration)` : ''}
          </p>
        </div>

        {/* Score comparison grid */}
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className={`p-4 rounded-2xl border ${
            isTeam0Bidding ? 'bg-slate-800/80 border-amber-500/50' : 'bg-slate-950/60 border-slate-800'
          }`}>
            <span className="text-xs text-slate-400 font-bold uppercase block mb-1">
              Team A {isTeam0Bidding && '(Bidder)'}
            </span>
            <div className="text-3xl font-black text-emerald-400">{team0CardPoints}</div>
            <span className="text-xs text-slate-400">pts won</span>
            <div className="mt-2 text-xs font-mono font-bold text-slate-300">
              Match Delta: {gamePointsDelta.team0 > 0 ? `+${gamePointsDelta.team0}` : gamePointsDelta.team0}
            </div>
          </div>

          <div className={`p-4 rounded-2xl border ${
            !isTeam0Bidding ? 'bg-slate-800/80 border-amber-500/50' : 'bg-slate-950/60 border-slate-800'
          }`}>
            <span className="text-xs text-slate-400 font-bold uppercase block mb-1">
              Team B {!isTeam0Bidding && '(Bidder)'}
            </span>
            <div className="text-3xl font-black text-amber-400">{team1CardPoints}</div>
            <span className="text-xs text-slate-400">pts won</span>
            <div className="mt-2 text-xs font-mono font-bold text-slate-300">
              Match Delta: {gamePointsDelta.team1 > 0 ? `+${gamePointsDelta.team1}` : gamePointsDelta.team1}
            </div>
          </div>
        </div>

        {/* Updated Match Score Pill */}
        <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between text-sm">
          <span className="font-bold text-slate-300 flex items-center gap-1.5">
            <Crown className="w-4 h-4 text-amber-400" /> Match Standings (First to +6):
          </span>
          <div className="font-mono font-black text-slate-100 flex items-center gap-3">
            <span className="text-emerald-400">Team A: {matchScore.team0}</span>
            <span className="text-slate-600">|</span>
            <span className="text-amber-400">Team B: {matchScore.team1}</span>
          </div>
        </div>

        {/* Action button */}
        <button
          onClick={onNextRound}
          className="w-full py-3.5 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-xl shadow-amber-500/25 transition-all transform active:scale-95"
        >
          {isHost ? 'Start Next Deal' : 'Ready for Next Deal'}
        </button>
      </div>
    </div>
  );
};

