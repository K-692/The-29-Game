import React, { useState } from 'react';
import { GamePhase, PlayerPosition, Team } from '../../engine/types';
import { Clock, ShieldAlert, Zap } from 'lucide-react';

interface InTableDoubleDecisionProps {
  phase: GamePhase; // 'DOUBLE_DECISION' | 'REDOUBLE_DECISION'
  highestBidder: PlayerPosition | null;
  highestBid: number;
  myPosition: PlayerPosition;
  remainingSeconds: number;
  doubleVotes?: Partial<Record<PlayerPosition, 'DOUBLE' | 'PASS'>>;
  redoubleVotes?: Partial<Record<PlayerPosition, 'REDOUBLE' | 'PASS'>>;
  onDouble: () => void;
  onPass: () => void;
}

export const InTableDoubleDecision: React.FC<InTableDoubleDecisionProps> = ({
  phase,
  highestBidder,
  highestBid,
  myPosition,
  remainingSeconds,
  doubleVotes,
  redoubleVotes,
  onDouble,
  onPass,
}) => {
  const [submitting, setSubmitting] = useState(false);

  const biddingTeam: Team = (highestBidder === 0 || highestBidder === 2) ? 0 : 1;
  const myTeam: Team = (myPosition === 0 || myPosition === 2) ? 0 : 1;

  const isStage1 = phase === 'DOUBLE_DECISION';
  const isStage2 = phase === 'REDOUBLE_DECISION';

  // In Stage 1: Defending team decides
  // In Stage 2: Bidding team decides
  const canIDecide = isStage1 ? (myTeam !== biddingTeam) : (myTeam === biddingTeam);

  const myVote = isStage1 ? doubleVotes?.[myPosition] : redoubleVotes?.[myPosition];
  const hasVoted = Boolean(myVote) || submitting;

  const handleAction = (action: 'DOUBLE_OR_REDOUBLE' | 'PASS') => {
    if (submitting || myVote) return;
    setSubmitting(true);
    if (action === 'DOUBLE_OR_REDOUBLE') {
      onDouble();
    } else {
      onPass();
    }
  };

  const progressPercent = Math.max(0, Math.min(100, (remainingSeconds / 10) * 100));

  return (
    <div className="relative mx-auto max-w-sm sm:max-w-md w-full bg-slate-950/90 backdrop-blur-md border-2 border-amber-400/90 shadow-[0_0_30px_rgba(251,191,36,0.4)] rounded-3xl p-4 sm:p-5 text-center text-white select-none pointer-events-auto">
      {/* 10s Timer progress bar */}
      <div className="w-full bg-slate-800/80 rounded-full h-1.5 mb-3 overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ${
            remainingSeconds <= 3 ? 'bg-rose-500' : 'bg-amber-400'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-xs font-black tracking-wider uppercase text-amber-300">
          <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>{isStage1 ? 'Stage 1: Double Opportunity' : 'Stage 2: Re-Double Opportunity'}</span>
        </div>
        <div className="flex items-center gap-1 text-xs font-mono font-bold bg-slate-900 border border-slate-700/80 px-2 py-0.5 rounded-full text-amber-300">
          <Clock className="w-3.5 h-3.5" />
          <span>{remainingSeconds}s</span>
        </div>
      </div>

      {/* Title & Description */}
      <h3 className="text-base sm:text-lg font-black tracking-wide text-white mb-1">
        {isStage1 ? 'Defending Team: Challenge the Bid?' : 'Bidding Team: Re-Double the Stakes?'}
      </h3>

      <p className="text-xs text-slate-300 mb-4">
        {isStage1 ? (
          <>
            Contract bid is <span className="font-bold text-amber-300">{highestBid}</span>.
            Doubling doubles match points (<span className="text-amber-400 font-bold">2x</span>: ±2 points).
          </>
        ) : (
          <>
            The contract was doubled! Re-doubling raises the stakes to{' '}
            <span className="text-rose-400 font-bold">4x</span> (±4 match points).
          </>
        )}
      </p>

      {/* Decision Buttons or Waiting Notice */}
      {canIDecide ? (
        hasVoted ? (
          <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-900/90 border border-amber-500/40 text-amber-300 text-xs sm:text-sm font-semibold">
            <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>You passed. Waiting for your teammate to decide...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mt-2">
            {/* Action Button: DOUBLE or REDOUBLE */}
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleAction('DOUBLE_OR_REDOUBLE')}
              className={`cursor-pointer py-2.5 px-3 rounded-2xl font-black text-sm uppercase tracking-wider text-slate-950 shadow-lg transition-all active:scale-95 disabled:opacity-50 ${
                isStage1
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-amber-500/30 ring-2 ring-amber-300/60'
                  : 'bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white shadow-rose-500/30 ring-2 ring-rose-300/60'
              }`}
            >
              {isStage1 ? '⚡ DOUBLE (2x)' : '💥 RE-DOUBLE (4x)'}
            </button>

            {/* PASS Button */}
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleAction('PASS')}
              className="cursor-pointer py-2.5 px-3 rounded-2xl font-bold text-sm uppercase tracking-wider bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-600/80 shadow-md transition-all disabled:opacity-50"
            >
              {isStage1 ? 'PASS (1x)' : 'PASS (Keep 2x)'}
            </button>
          </div>
        )
      ) : (
        <div className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-300 text-xs">
          <ShieldAlert className="w-4 h-4 text-amber-400 animate-spin" />
          <span>
            {isStage1
              ? 'Waiting for Defending Team to decide on Double...'
              : 'Waiting for Bidding Team to decide on Re-Double...'}
          </span>
        </div>
      )}
    </div>
  );
};
