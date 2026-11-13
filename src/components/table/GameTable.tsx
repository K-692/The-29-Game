import React, { useState } from 'react';
import { 
  GameState, 
  PlayerInfo, 
  PlayerPosition, 
  PublicGameState, 
  Team 
} from '../../engine/types';
import { CARD_MANIFEST, Suit } from '../../assets/cardManifest';
import { canDeclarePair } from '../../engine/scoring';
import { getPlayableCards } from '../../engine/tricks';
import { soundManager } from '../../common/SoundManager';
import { Scoreboard } from './Scoreboard';
import { OpponentSeat } from './OpponentSeat';
import { PlayerHand } from './PlayerHand';
import { TrickArea } from './TrickArea';
import { TrumpIndicator } from './TrumpIndicator';
import { BiddingModal } from './BiddingModal';
import { TrumpModal } from './TrumpModal';
import { DealSummaryModal } from './DealSummaryModal';
import { MatchOverModal } from './MatchOverModal';
import { HowToPlayModal } from '../lobby/HowToPlayModal';
import { 
  ArrowLeft, 
  Crown, 
  HelpCircle, 
  Link, 
  Volume2, 
  VolumeX, 
  Sparkles,
  Share2
} from 'lucide-react';

interface GameTableProps {
  gameState: GameState;
  publicState: PublicGameState;
  myPosition: PlayerPosition;
  isHost: boolean;
  onBid: (bid: number | 'PASS') => void;
  onSelectTrump: (suit: Suit) => void;
  onRevealTrump: () => void;
  onPlayCard: (cardId: string) => void;
  onDeclarePair: () => void;
  onNextRound: () => void;
  onRematch: () => void;
  onLeave: () => void;
}

export const GameTable: React.FC<GameTableProps> = ({
  gameState,
  publicState,
  myPosition,
  isHost,
  onBid,
  onSelectTrump,
  onRevealTrump,
  onPlayCard,
  onDeclarePair,
  onNextRound,
  onRematch,
  onLeave,
}) => {
  const [isMuted, setIsMuted] = useState(soundManager.getMuted());
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const myTeam: Team = (myPosition === 0 || myPosition === 2) ? 0 : 1;
  const isMyTurn = publicState.currentTurn === myPosition;

  // Relative positions mapping (You are bottom 0)
  const partnerPos = ((myPosition + 2) % 4) as PlayerPosition;
  const leftOpponentPos = ((myPosition + 1) % 4) as PlayerPosition;
  const rightOpponentPos = ((myPosition + 3) % 4) as PlayerPosition;

  const partner = publicState.players.find((p) => p.position === partnerPos);
  const leftOpponent = publicState.players.find((p) => p.position === leftOpponentPos);
  const rightOpponent = publicState.players.find((p) => p.position === rightOpponentPos);
  const me = publicState.players.find((p) => p.position === myPosition);

  // Playable cards calculation for current trick
  const leadCardId = publicState.currentTrickCards.length > 0 
    ? publicState.currentTrickCards[0].cardId 
    : null;

  const playableCardIds = getPlayableCards(
    publicState.myHand,
    leadCardId,
    publicState.revealedTrumpSuit,
    publicState.isTrumpRevealed
  );

  // Check if player can reveal trump
  const canRevealTrump = Boolean(
    isMyTurn &&
    publicState.phase === 'TRICK_PLAY' &&
    !publicState.isTrumpRevealed &&
    leadCardId &&
    !publicState.myHand.some((id) => CARD_MANIFEST[id]?.suit === CARD_MANIFEST[leadCardId]?.suit)
  );

  // Check if player can declare Pair/Royals
  const pairCheck = canDeclarePair(
    publicState.myHand,
    myPosition,
    publicState.revealedTrumpSuit,
    publicState.isTrumpRevealed,
    publicState.completedTricks,
    publicState.pairDeclaration
  );

  const handleToggleSound = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const handleCopyInvite = () => {
    const url = window.location.origin + window.location.pathname + `?room=${publicState.roomCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const latestSummary = publicState.roundHistory[publicState.roundHistory.length - 1];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-x-hidden selection:bg-amber-500 selection:text-black">
      {/* Top Navbar */}
      <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-2.5 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={onLeave}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
            title="Leave Game"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-amber-400 text-lg tracking-tight">29</span>
              <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-bold">
                {publicState.roomCode}
              </span>
            </div>
          </div>
        </div>

        {/* Center / Action Controls */}
        <div className="flex items-center gap-2">
          {/* Pair Declaration Banner if eligible */}
          {pairCheck.canDeclare && (
            <button
              onClick={onDeclarePair}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg flex items-center gap-1.5 animate-pulse"
            >
              <Crown className="w-4 h-4 text-amber-300" /> Declare Pair (±4 pts)!
            </button>
          )}

          {/* Copy Invite Link */}
          <button
            onClick={handleCopyInvite}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5 text-amber-400" />
            {copiedLink ? 'Copied!' : 'Invite'}
          </button>

          {/* Sound Mute Toggle */}
          <button
            onClick={handleToggleSound}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-xl transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
          </button>

          {/* How to Play Guide */}
          <button
            onClick={() => setShowHowToPlay(true)}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-xl transition-colors"
            title="How to Play 29"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Table Arena */}
      <main className="flex-1 flex flex-col justify-between p-2 sm:p-4 max-w-6xl mx-auto w-full relative">
        {/* Top Header Row: Scoreboard & Trump Indicator */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full mb-2 z-20">
          <Scoreboard publicState={publicState} myTeam={myTeam} />
          <TrumpIndicator
            publicState={publicState}
            onRevealTrump={onRevealTrump}
            canRevealTrump={canRevealTrump}
          />
        </div>

        {/* Central Card Table Felt */}
        <div className="flex-1 relative flex items-center justify-center my-2 min-h-[360px] sm:min-h-[440px] md:min-h-[500px]">
          {/* Top Seat: Partner */}
          {partner && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
              <OpponentSeat
                player={partner}
                cardCount={publicState.otherHandCounts[partnerPos] || 0}
                isCurrentTurn={publicState.currentTurn === partnerPos}
                isDealer={publicState.dealerIndex === partnerPos}
                isBidder={publicState.highestBidder === partnerPos}
                bidAmount={publicState.highestBid}
                positionLabel="Partner"
              />
            </div>
          )}

          {/* Left Seat: Opponent Left */}
          {leftOpponent && (
            <div className="absolute left-0 sm:left-4 top-1/2 -translate-y-1/2 z-20">
              <OpponentSeat
                player={leftOpponent}
                cardCount={publicState.otherHandCounts[leftOpponentPos] || 0}
                isCurrentTurn={publicState.currentTurn === leftOpponentPos}
                isDealer={publicState.dealerIndex === leftOpponentPos}
                isBidder={publicState.highestBidder === leftOpponentPos}
                bidAmount={publicState.highestBid}
                positionLabel="Opponent Left"
              />
            </div>
          )}

          {/* Right Seat: Opponent Right */}
          {rightOpponent && (
            <div className="absolute right-0 sm:right-4 top-1/2 -translate-y-1/2 z-20">
              <OpponentSeat
                player={rightOpponent}
                cardCount={publicState.otherHandCounts[rightOpponentPos] || 0}
                isCurrentTurn={publicState.currentTurn === rightOpponentPos}
                isDealer={publicState.dealerIndex === rightOpponentPos}
                isBidder={publicState.highestBidder === rightOpponentPos}
                bidAmount={publicState.highestBid}
                positionLabel="Opponent Right"
              />
            </div>
          )}

          {/* Central Trick Arena */}
          <TrickArea
            playedCards={publicState.currentTrickCards}
            players={publicState.players}
            myPosition={myPosition}
            trickNumber={publicState.currentTrickNumber}
          />
        </div>

        {/* Bottom Hand Area (Your Hand) */}
        <div className="w-full flex flex-col items-center z-20">
          <PlayerHand
            cardIds={publicState.myHand}
            playableCardIds={playableCardIds}
            isMyTurn={isMyTurn}
            onPlayCard={onPlayCard}
            disabled={publicState.phase !== 'TRICK_PLAY'}
          />

          {/* My Player Pill */}
          {me && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300 mt-1 shadow">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-bold text-slate-100">{me.name}</span>
              <span className="text-[10px] text-slate-400 font-medium font-mono">
                {publicState.dealerIndex === myPosition ? '(Dealer)' : ''}
                {publicState.highestBidder === myPosition ? `(Bidder: ${publicState.highestBid})` : ''}
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Modals & Overlays */}
      {/* 1. Bidding Modal */}
      {publicState.phase === 'BIDDING' && (
        <BiddingModal
          currentHighestBid={publicState.highestBid}
          highestBidder={publicState.highestBidder}
          players={publicState.players}
          bidsHistory={publicState.bids}
          rules={publicState.rules}
          isMyTurn={isMyTurn}
          myPosition={myPosition}
          isForcedDealer={
            publicState.bids.length === 3 &&
            publicState.bids.every((b) => b.bid === 'PASS') &&
            myPosition === publicState.dealerIndex &&
            publicState.rules.forcedDealerBid
          }
          onPlaceBid={onBid}
        />
      )}

      {/* 2. Trump Selection Modal */}
      {publicState.phase === 'TRUMP_SELECTION' && publicState.highestBidder === myPosition && (
        <TrumpModal
          handCardIds={publicState.myHand}
          highestBid={publicState.highestBid}
          onSelectTrump={onSelectTrump}
        />
      )}

      {/* 3. Deal Summary Modal */}
      {publicState.phase === 'ROUND_ENDED' && latestSummary && (
        <DealSummaryModal
          summary={latestSummary}
          isHost={isHost}
          onNextRound={onNextRound}
        />
      )}

      {/* 4. Match Over Modal */}
      {publicState.phase === 'MATCH_ENDED' && publicState.winnerTeam !== null && (
        <MatchOverModal
          winnerTeam={publicState.winnerTeam}
          myTeam={myTeam}
          finalScore={publicState.matchScore}
          isHost={isHost}
          onRematch={onRematch}
          onExit={onLeave}
        />
      )}

      {/* 5. How to Play Guide Modal */}
      {showHowToPlay && (
        <HowToPlayModal onClose={() => setShowHowToPlay(false)} />
      )}
    </div>
  );
};
