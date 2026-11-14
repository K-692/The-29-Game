import React, { useState, useEffect } from 'react';
import { RoundSummary, Team } from '../../engine/types';
import { CheckCircle2, XCircle, ArrowRight, Trophy, Clock } from 'lucide-react';

interface InTableRoundSummaryProps {
  summary: RoundSummary;
  isHost: boolean;
  myTeam: Team;
  matchScore: { team0: number; team1: number };
  onNextRound: () => void;
}

export const InTableRoundSummary: React.FC<InTableRoundSummaryProps> = ({
  summary,
  isHost,
  myTeam,
  matchScore,
  onNextRound,
}) => {
  const [countdown, setCountdown] = useState<number | null>(null);

  const isBidderMyTeam = summary.biddingTeam === myTeam;
  const isSuccess = summary.biddingTeamWon;
  const didMyTeamWinRound = (isBidderMyTeam && isSuccess) || (!isBidderMyTeam && !isSuccess);
  const myDelta = myTeam === 0 ? summary.gamePointsDelta.team0 : summary.gamePointsDelta.team1;

  const handleStartNextDeal = () => {
    if (countdown !== null) return;
    setCountdown(3);
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      onNextRound();
      return;
    }
    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, onNextRound]);

  const biddingTeamLabel = summary.biddingTeam === myTeam ? 'Your Side' : 'Opponents';

  return (
    <div className="w-full max-w-lg mx-auto bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-3xl p-5 shadow-2xl space-y-4 z-30 animate-fade-in select-none">
      {/* Result Header */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 border border-slate-200">
          {didMyTeamWinRound ? (
            <span className="text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Deal Won ({myDelta >= 0 ? `+${myDelta}` : myDelta} pt)
            </span>
          ) : (
            <span className="text-rose-700 flex items-center gap-1">
              <XCircle className="w-4 h-4 text-rose-600" /> Deal Lost ({myDelta >= 0 ? `+${myDelta}` : myDelta} pt)
            </span>
          )}
        </div>
        <h3 className="text-lg font-black text-slate-800">
          {isSuccess
            ? `${biddingTeamLabel} Fulfilled Contract!`
            : `${biddingTeamLabel} Failed Contract!`}
        </h3>
        <p className="text-xs text-slate-500">
          Target was <strong className="text-slate-800">{summary.adjustedTarget} pts</strong> (Bid: {summary.contractBid})
          {summary.pairDeclared && ` [Pair adjustment: ${summary.pairDeclared.adjustment > 0 ? '+4' : '-4'}]`}
        </p>
      </div>

      {/* Points Breakdown Table */}
      <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
        <div className="text-center border-r border-slate-200 pr-2">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-sky-700 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
            <span>{myTeam === 0 ? 'Your Side' : 'Opponents'}</span>
          </div>
          <div className="text-2xl font-black text-slate-800 mt-1">
            {summary.team0CardPoints} <span className="text-xs text-slate-500 font-normal">pts</span>
          </div>
          <div className="text-[11px] text-slate-500">
            {summary.team0WonLastTrick ? 'Won 8th trick bonus' : ''}
          </div>
        </div>

        <div className="text-center pl-2">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-rose-700 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span>{myTeam === 1 ? 'Your Side' : 'Opponents'}</span>
          </div>
          <div className="text-2xl font-black text-slate-800 mt-1">
            {summary.team1CardPoints} <span className="text-xs text-slate-500 font-normal">pts</span>
          </div>
          <div className="text-[11px] text-slate-500">
            {summary.team1WonLastTrick ? 'Won 8th trick bonus' : ''}
          </div>
        </div>
      </div>

      {/* Match Game Score Progress */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
        <div className="flex items-center gap-1.5 text-slate-700 font-bold">
          <Trophy className="w-4 h-4 text-amber-500" /> Match Score (+6 to Win):
        </div>
        <div className="flex items-center gap-4 font-mono font-bold text-sm">
          <span className="text-sky-700">{matchScore.team0 > 0 ? `+${matchScore.team0}` : matchScore.team0}</span>
          <span className="text-slate-300">|</span>
          <span className="text-rose-700">{matchScore.team1 > 0 ? `+${matchScore.team1}` : matchScore.team1}</span>
        </div>
      </div>

      {/* Next Deal Action with 3-second Transition */}
      {countdown !== null ? (
        <div className="w-full py-3 rounded-xl font-bold text-xs bg-amber-50 border border-amber-300 text-amber-900 shadow-sm flex items-center justify-center gap-2 animate-pulse">
          <Clock className="w-4 h-4 text-amber-600" />
          <span>Next deal starting in {countdown}s...</span>
        </div>
      ) : isHost ? (
        <button
          type="button"
          onClick={handleStartNextDeal}
          className="w-full py-3 rounded-xl font-bold text-xs bg-amber-400 hover:bg-amber-300 active:scale-98 text-slate-950 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          Deal Next Hand <ArrowRight className="w-4 h-4 text-slate-950" />
        </button>
      ) : (
        <div className="text-center py-2 text-xs text-slate-500 italic">
          Waiting for room host to deal the next hand...
        </div>
      )}
    </div>
  );
};
