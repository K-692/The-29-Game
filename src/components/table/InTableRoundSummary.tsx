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
  const [isDealing, setIsDealing] = useState(false);

  const isBidderMyTeam = summary.biddingTeam === myTeam;
  const isSuccess = summary.biddingTeamWon;
  const didMyTeamWinRound = (isBidderMyTeam && isSuccess) || (!isBidderMyTeam && !isSuccess);
  const myDelta = myTeam === 0 ? summary.gamePointsDelta.team0 : summary.gamePointsDelta.team1;

  const handleStartNextDeal = () => {
    if (isDealing) return;
    setIsDealing(true);
    onNextRound();
    // Safety fallback: allow retry after 3.5s if round has not transitioned
    setTimeout(() => {
      setIsDealing(false);
    }, 3500);
  };

  const biddingTeamLabel = summary.biddingTeam === myTeam ? 'Your Side' : 'Opponents';
  const ptsLabel = (n: number) => `${n >= 0 ? `+${n}` : n} pt${Math.abs(n) === 1 ? '' : 's'}`;
  const myPoints = myTeam === 0 ? summary.team0CardPoints : summary.team1CardPoints;
  const theirPoints = myTeam === 0 ? summary.team1CardPoints : summary.team0CardPoints;
  const myLast = myTeam === 0 ? summary.team0WonLastTrick : summary.team1WonLastTrick;
  const theirLast = myTeam === 0 ? summary.team1WonLastTrick : summary.team0WonLastTrick;
  const stakesLabel =
    summary.dealMultiplier === 4 ? 'Re-Doubled · 4x' : summary.dealMultiplier === 2 ? 'Doubled · 2x' : null;

  return (
    <div className="w-full max-w-sm sm:max-w-md mx-auto bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-2xl space-y-2.5 z-30 animate-fade-in select-none">
      {/* Result Header */}
      <div className="text-center space-y-0.5">
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-100 border border-slate-200">
            {didMyTeamWinRound ? (
              <span className="text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Deal Won ({ptsLabel(myDelta)})
              </span>
            ) : (
              <span className="text-rose-700 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5 text-rose-600" /> Deal Lost ({ptsLabel(myDelta)})
              </span>
            )}
          </div>
          {stakesLabel && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-50 border border-rose-200 text-rose-700">
              {stakesLabel}
            </span>
          )}
        </div>
        <h3 className="text-base sm:text-lg font-black text-slate-800">
          {isSuccess
            ? `${biddingTeamLabel} Fulfilled Contract!`
            : `${biddingTeamLabel} Failed Contract!`}
        </h3>
        <p className="text-[11px] text-slate-500">
          Target was <strong className="text-slate-800">{summary.adjustedTarget} pts</strong> (Bid: {summary.contractBid})
          {summary.pairDeclared && ` · King-Queen pair ${summary.pairDeclared.adjustment > 0 ? '+4' : '−4'}`}
        </p>
      </div>

      {/* Points Breakdown: your side first, in your side's colour */}
      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
        {[
          { label: 'Your Side', pts: myPoints, last: myLast, dot: 'bg-sky-500', text: 'text-sky-700', border: 'border-r border-slate-200 pr-2' },
          { label: 'Opponents', pts: theirPoints, last: theirLast, dot: 'bg-rose-500', text: 'text-rose-700', border: 'pl-2' },
        ].map((col) => (
          <div key={col.label} className={`text-center ${col.border}`}>
            <div className={`flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider ${col.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${col.dot}`} />
              <span>{col.label}</span>
            </div>
            <div className="text-xl font-black text-slate-800 mt-0.5">
              {col.pts} <span className="text-[10px] text-slate-500 font-normal">pts</span>
            </div>
            <div className="text-[10px] text-slate-500">{col.last ? 'Won 8th trick bonus' : ' '}</div>
          </div>
        ))}
      </div>

      {/* Match Game Score Progress */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px]">
        <div className="flex items-center gap-1 text-slate-700 font-bold">
          <Trophy className="w-3.5 h-3.5 text-amber-500" /> Match Score (+6 to Win):
        </div>
        <div className="flex items-center gap-3 font-mono font-bold text-xs sm:text-sm">
          {(() => {
            const mine = myTeam === 0 ? matchScore.team0 : matchScore.team1;
            const theirs = myTeam === 0 ? matchScore.team1 : matchScore.team0;
            const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);
            return (
              <>
                <span className="text-sky-700" title="Your side">{fmt(mine)}</span>
                <span className="text-slate-300">|</span>
                <span className="text-rose-700" title="Opponents">{fmt(theirs)}</span>
              </>
            );
          })()}
        </div>
      </div>

      {/* Immediate Next Deal Action */}
      {isDealing ? (
        <div className="w-full py-2.5 rounded-xl font-bold text-xs bg-amber-50 border border-amber-300 text-amber-900 shadow-sm flex items-center justify-center gap-2 animate-pulse">
          <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
          <span>Dealing next hand...</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleStartNextDeal}
          className="w-full py-2.5 rounded-xl font-bold text-xs bg-amber-400 hover:bg-amber-300 active:scale-98 text-slate-950 shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          Deal Next Hand <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
        </button>
      )}
    </div>
  );
};
