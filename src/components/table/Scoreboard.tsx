import React from 'react';
import { PublicGameState, Team } from '../../engine/types';
import { Crown, Zap } from 'lucide-react';

interface ScoreboardProps {
  publicState: PublicGameState;
  myTeam: Team;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ publicState, myTeam }) => {
  const { matchScore, highestBid, highestBidder, players, dealMultiplier, adjustedTarget } = publicState;
  const bidder = highestBidder !== null ? players.find((p) => p.position === highestBidder) : null;
  const bidderName = bidder?.name;

  const target = adjustedTarget ?? highestBid;
  const hasTargetChanged = adjustedTarget !== undefined && adjustedTarget !== null && adjustedTarget !== highestBid;

  return (
    <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl px-3 sm:px-4 py-1.5 shadow-md flex items-center gap-2 sm:gap-3 text-xs sm:text-sm select-none text-slate-800 whitespace-nowrap">
      {/* Your partnership first (blue), opponents second (coral) — same for every seat */}
      {[
        { label: 'Your Side', short: 'Us', score: myTeam === 0 ? matchScore.team0 : matchScore.team1, dot: 'bg-sky-500', pos: 'text-sky-700' },
        { label: 'Opponents', short: 'Them', score: myTeam === 0 ? matchScore.team1 : matchScore.team0, dot: 'bg-rose-500', pos: 'text-rose-700' },
      ].map((side, idx) => (
        <React.Fragment key={side.label}>
          {idx === 1 && <span className="text-slate-300 font-light">|</span>}
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ${side.dot}`} />
            <span className="font-bold text-slate-800 text-xs sm:text-sm">
              <span className="hidden md:inline">{side.label}:</span>
              <span className="md:hidden">{side.short}:</span>
            </span>
            <span className={`font-mono font-black ${side.score >= 0 ? side.pos : 'text-rose-600'}`}>
              {side.score > 0 ? `+${side.score}` : side.score}
            </span>
          </div>
        </React.Fragment>
      ))}

      <span className="text-slate-300 font-light">|</span>

      {/* Current Round Bid & Target */}
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-slate-800 text-xs sm:text-sm">
          {hasTargetChanged ? 'Target:' : 'Bid:'}
        </span>
        {highestBid > 0 ? (
          <div className="flex items-center gap-1 font-mono font-black text-amber-700">
            {hasTargetChanged ? (
              <>
                <span className="line-through text-slate-400 font-normal text-[11px]">{highestBid}</span>
                <span className="text-purple-700 flex items-center gap-0.5">
                  <Crown className="w-3.5 h-3.5 text-amber-500 inline" />
                  {target}
                </span>
              </>
            ) : (
              <span>{target}</span>
            )}
            {bidderName && <span className="text-slate-500 font-sans font-medium text-[11px]">({bidderName})</span>}
          </div>
        ) : (
          <span className="font-mono text-slate-400">-</span>
        )}
      </div>

      {/* Deal Multiplier Badge (Double / Re-Double) */}
      {dealMultiplier && dealMultiplier > 1 && (
        <>
          <span className="text-slate-300 font-light">|</span>
          <div className="flex items-center gap-1">
            {dealMultiplier === 2 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-xs border border-amber-300">
                <Zap className="w-3 h-3 fill-current" />
                2x DBL
              </span>
            )}
            {dealMultiplier === 4 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-xs border border-rose-300 animate-pulse">
                <Zap className="w-3 h-3 fill-current" />
                4x REDBL
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
};
