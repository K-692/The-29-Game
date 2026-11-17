import React, { useState } from 'react';
import { RoundSummary, Team } from '../../engine/types';

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
  const theirDelta = myTeam === 0 ? summary.gamePointsDelta.team1 : summary.gamePointsDelta.team0;

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
    summary.dealMultiplier === 4 ? 're-doubled 4×' : summary.dealMultiplier === 2 ? 'doubled 2×' : null;

  void matchScore; // match score is always on the scoreboard above
  void isHost;
  const bidderSide = isBidderMyTeam ? 'Your side' : 'Opponents';

  return (
    <div className="panel w-full max-w-xs mx-auto p-5 space-y-4 text-center animate-fade-in">
      <div>
        <div className="eyebrow">{bidderSide} {isSuccess ? 'made' : 'missed'} {summary.adjustedTarget}</div>
        <div className="panel-title text-3xl mt-1">
          {didMyTeamWinRound ? 'Deal won' : 'Deal lost'}
          {myDelta !== 0 ? (
            <span className={`ml-2 text-xl tabular-nums ${myDelta > 0 ? 'text-felt-400' : 'text-[#e36a56]'}`}>
              {myDelta > 0 ? `+${myDelta}` : myDelta}
            </span>
          ) : (
            <span className={`ml-2 text-base tabular-nums ${theirDelta > 0 ? 'text-[#e36a56]' : 'text-felt-400'}`}>
              them {theirDelta > 0 ? `+${theirDelta}` : theirDelta}
            </span>
          )}
        </div>
        <div className="text-[11px] text-cream-300/80 mt-1 space-x-1.5">
          <span>Bid {summary.contractBid}</span>
          {summary.pairDeclared && <span>· pair {summary.pairDeclared.adjustment > 0 ? '+4' : '−4'}</span>}
          {stakesLabel && <span>· {stakesLabel}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Us', pts: myPoints, last: myLast, color: 'text-felt-400' },
          { label: 'Them', pts: theirPoints, last: theirLast, color: 'text-[#e36a56]' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-cream-100/10 py-2">
            <div className={`text-[10px] uppercase tracking-[0.14em] ${c.color}`}>{c.label}</div>
            <div className="font-display text-2xl tabular-nums">{c.pts}</div>
            <div className="text-[10px] text-cream-300/60 h-3">{c.last ? '+ last trick' : ''}</div>
          </div>
        ))}
      </div>

      <button type="button" onClick={handleStartNextDeal} disabled={isDealing} className="btn-primary w-full">
        {isDealing ? 'Dealing…' : 'Next deal'}
      </button>
    </div>
  );
};
