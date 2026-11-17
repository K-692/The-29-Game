import React, { useState } from 'react';
import { GamePhase, PlayerInfo, PlayerPosition, Team } from '../../engine/types';

interface InTableDoubleDecisionProps {
  phase: GamePhase; // 'DOUBLE_DECISION' | 'REDOUBLE_DECISION'
  highestBidder: PlayerPosition | null;
  highestBid: number;
  myPosition: PlayerPosition;
  remainingSeconds: number;
  doubleVotes?: Partial<Record<PlayerPosition, 'DOUBLE' | 'PASS'>>;
  redoubleVotes?: Partial<Record<PlayerPosition, 'REDOUBLE' | 'PASS'>>;
  players?: PlayerInfo[];
  onDouble: () => Promise<{ success: boolean } | void> | void;
  onPass: () => Promise<{ success: boolean } | void> | void;
}

export const InTableDoubleDecision: React.FC<InTableDoubleDecisionProps> = ({
  phase,
  highestBidder,
  highestBid,
  myPosition,
  remainingSeconds,
  doubleVotes,
  redoubleVotes,
  players = [],
  onDouble,
  onPass,
}) => {
  const [submitting, setSubmitting] = useState<null | 'DOUBLE_OR_REDOUBLE' | 'PASS'>(null);

  const biddingTeam: Team = (highestBidder === 0 || highestBidder === 2) ? 0 : 1;
  const myTeam: Team = (myPosition === 0 || myPosition === 2) ? 0 : 1;

  const isStage1 = phase === 'DOUBLE_DECISION';
  const isStage2 = phase === 'REDOUBLE_DECISION';

  // In Stage 1: Defending team decides
  // In Stage 2: Bidding team decides
  const canIDecide = isStage1 ? (myTeam !== biddingTeam) : (myTeam === biddingTeam);

  const votes = (isStage1 ? doubleVotes : redoubleVotes) || {};
  const myVote = votes[myPosition];
  const hasVoted = Boolean(myVote) || submitting !== null;

  // The team currently deciding, in seat order, with each player's vote status.
  const decidingTeam: Team = isStage1 ? (biddingTeam === 0 ? 1 : 0) : biddingTeam;
  const decidingPositions: PlayerPosition[] = decidingTeam === 0 ? [0, 2] : [1, 3];
  const nameOf = (pos: PlayerPosition) => {
    if (pos === myPosition) return 'You';
    return players.find((p) => p.position === pos)?.name || `Seat ${pos + 1}`;
  };

  const handleAction = async (action: 'DOUBLE_OR_REDOUBLE' | 'PASS') => {
    if (submitting || myVote) return;
    setSubmitting(action);
    const res = action === 'DOUBLE_OR_REDOUBLE' ? await onDouble() : await onPass();
    // If the server rejected the vote (e.g. window just closed), let the player see the real state.
    if (res && res.success === false) setSubmitting(null);
  };

  const progressPercent = Math.max(0, Math.min(100, (remainingSeconds / 10) * 100));
  const iDoubled = submitting === 'DOUBLE_OR_REDOUBLE';

  return (
    <div className="panel relative w-full max-w-sm mx-auto p-4 space-y-3 overflow-hidden animate-fade-in">
      {/* 10s window */}
      <div className="absolute top-0 left-0 h-0.5 bg-cream-100/70 transition-[width] duration-1000 ease-linear" style={{ width: `${progressPercent}%` }} />

      <div className="flex items-center justify-between">
        <div className="panel-title text-lg">{isStage1 ? 'Double?' : 'Re-double?'}</div>
        <span className={`font-mono text-sm tabular-nums ${remainingSeconds <= 3 ? 'text-[#e36a56]' : 'text-cream-300'}`}>
          {remainingSeconds}s
        </span>
      </div>
      <p className="text-xs text-cream-300 -mt-1">
        {isStage1
          ? `Contract is ${highestBid}. Defenders can double the stakes to 2×.`
          : 'The contract was doubled. Bidders can raise it to 4×.'}
      </p>

      <div className="flex items-center gap-1.5 flex-wrap">
        {decidingPositions.map((pos) => {
          const v = votes[pos];
          return (
            <span
              key={pos}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors duration-300 ${
                v === 'PASS'
                  ? 'border-cream-100/15 text-cream-300/70'
                  : v
                  ? 'bg-cream-100 text-felt-800 border-cream-100'
                  : 'border-cream-100/30 text-cream-100 animate-pulse'
              }`}
            >
              {nameOf(pos)} · {v === 'PASS' ? 'passed' : v ? v.toLowerCase() : 'deciding'}
            </span>
          );
        })}
      </div>

      {canIDecide ? (
        hasVoted ? (
          <p className="text-xs text-cream-200 text-center py-1">
            {iDoubled ? (isStage1 ? 'Doubling…' : 'Re-doubling…') : 'You passed — waiting for your partner.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={submitting !== null}
              onClick={() => handleAction('DOUBLE_OR_REDOUBLE')}
              className={isStage1 ? 'btn-primary py-2.5' : 'btn-danger py-2.5'}
            >
              {isStage1 ? 'Double 2×' : 'Re-double 4×'}
            </button>
            <button type="button" disabled={submitting !== null} onClick={() => handleAction('PASS')} className="btn-ghost py-2.5">
              Pass
            </button>
          </div>
        )
      ) : (
        <p className="text-xs text-cream-300 text-center py-1">
          {isStage1 ? 'Waiting for the defenders…' : 'Waiting for the bidding side…'}
        </p>
      )}
    </div>
  );
};
