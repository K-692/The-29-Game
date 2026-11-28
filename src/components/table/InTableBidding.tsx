import React, { useState, useEffect } from 'react';
import { BidEntry, GameRulesConfig, PlayerInfo, PlayerPosition } from '../../engine/types';
import { getLegalBidOptions } from '../../engine/bidding';

interface InTableBiddingProps {
  currentHighestBid: number;
  highestBidder: PlayerPosition | null;
  activeBidder?: PlayerPosition;
  players: PlayerInfo[];
  rules: GameRulesConfig;
  isMyTurn: boolean;
  myPosition: PlayerPosition;
  isForcedDealer: boolean;
  remainingSeconds: number;
  onPlaceBid: (bid: number | 'PASS') => void;
  bids?: BidEntry[];
  biddingOrder?: PlayerPosition[];
}

/**
 * Minimal auction panel. It always answers "who am I bidding against?":
 * the current high bid, who holds it and whether they are your partner or an
 * opponent, plus every call so far in bidding order.
 */
export const InTableBidding: React.FC<InTableBiddingProps> = ({
  currentHighestBid,
  highestBidder,
  activeBidder,
  players,
  rules,
  isMyTurn,
  myPosition,
  isForcedDealer,
  remainingSeconds = 15,
  onPlaceBid,
  bids = [],
  biddingOrder = [],
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => setIsSubmitting(false), [activeBidder, isMyTurn]);

  const legalOptions = getLegalBidOptions(currentHighestBid, rules);
  const playerAt = (pos: PlayerPosition | null | undefined) => players.find((p) => p.position === pos);
  const relationOf = (pos: PlayerPosition) =>
    pos === myPosition ? 'you' : pos % 2 === myPosition % 2 ? 'partner' : 'opponent';
  const nameOf = (pos: PlayerPosition) => (pos === myPosition ? 'You' : playerAt(pos)?.name || `Seat ${pos + 1}`);

  const active = playerAt(activeBidder);
  const highRel = highestBidder !== null ? relationOf(highestBidder) : null;

  const handleBidClick = (val: number | 'PASS') => {
    if (isSubmitting || !isMyTurn) return;
    setIsSubmitting(true);
    onPlaceBid(val);
    setTimeout(() => setIsSubmitting(false), 1500);
  };

  const order = biddingOrder.length === 4 ? biddingOrder : ([0, 1, 2, 3] as PlayerPosition[]);
  // Latest call per player (players can raise several times in the auction).
  const callOf = (pos: PlayerPosition) => [...bids].reverse().find((b) => b.playerIndex === pos)?.bid;

  return (
    <div className="panel w-full max-w-sm mx-auto p-4 space-y-3 animate-fade-in">
      {/* Who is bidding + timer */}
      <div className="flex items-center justify-between gap-3">
        <div className="panel-title text-lg">
          {isMyTurn ? 'Your bid' : `${active?.name || 'Player'} is bidding`}
        </div>
        {active?.isCpu && !isMyTurn ? (
          <span className="text-xs text-cream-300/80 animate-pulse">thinking…</span>
        ) : (
          <span className={`font-mono text-sm tabular-nums ${remainingSeconds <= 5 ? 'text-[#e36a56]' : 'text-cream-300'}`}>
            {remainingSeconds}s
          </span>
        )}
      </div>

      {/* Who you are bidding against */}
      <div className="rounded-xl bg-felt-950/50 border border-cream-100/10 px-3 py-2.5 text-sm">
        {currentHighestBid > 0 && highestBidder !== null ? (
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl leading-none tabular-nums">{currentHighestBid}</span>
            <span className="text-cream-200">
              held by <span className="font-semibold text-cream-50">{nameOf(highestBidder)}</span>
            </span>
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                highRel === 'opponent' ? 'bg-suit-red/90 text-cream-50' : 'bg-felt-500 text-cream-50'
              }`}
            >
              {highRel === 'you' ? 'You' : highRel === 'partner' ? 'Partner' : 'Opponent'}
            </span>
          </div>
        ) : (
          <span className="text-cream-300">No bids yet — opening bid is {rules.minBid} or more.</span>
        )}
      </div>

      {/* Calls so far, in bidding order */}
      <div className="grid grid-cols-4 gap-1.5">
        {order.map((pos) => {
          const call = callOf(pos);
          const rel = relationOf(pos);
          const isActive = pos === activeBidder;
          return (
            <div
              key={pos}
              className={`rounded-lg px-1.5 py-1 text-center border transition-colors ${
                isActive ? 'border-cream-100/60 bg-cream-100/10' : 'border-cream-100/10'
              }`}
            >
              <div className={`text-[10px] truncate ${rel === 'opponent' ? 'text-[#e36a56]' : 'text-felt-400'}`}>
                {nameOf(pos)}
              </div>
              <div className="text-sm tabular-nums text-cream-50">
                {call === undefined ? (isActive ? '…' : '–') : call === 'PASS' ? <span className="text-cream-300/70">Pass</span> : call}
              </div>
            </div>
          );
        })}
      </div>

      {isMyTurn && (
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-7 gap-1.5">
            {legalOptions.map((val) => (
              <button
                key={val}
                type="button"
                disabled={isSubmitting}
                onClick={() => handleBidClick(val)}
                className="rounded-lg py-2 text-sm tabular-nums bg-cream-100 text-felt-800 font-semibold hover:bg-cream-50 active:scale-95 transition disabled:opacity-40"
                title={`Bid ${val}`}
              >
                {val}
              </button>
            ))}
          </div>
          {isForcedDealer ? (
            <p className="text-xs text-center text-cream-300">Everyone else passed — you must open.</p>
          ) : (
            <button type="button" disabled={isSubmitting} onClick={() => handleBidClick('PASS')} className="btn-ghost w-full py-2">
              Pass
            </button>
          )}
        </div>
      )}
    </div>
  );
};
