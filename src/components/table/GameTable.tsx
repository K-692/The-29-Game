import React, { useState, useEffect } from 'react';
import { 
  GameState, 
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
import { InTableBidding } from './InTableBidding';
import { InTableTrumpSelector } from './InTableTrumpSelector';
import { InTableRoundSummary } from './InTableRoundSummary';
import { MatchOverModal } from './MatchOverModal';
import { RulesDrawer } from './RulesDrawer';
import { InTableNotification } from '../../services/lanClient';
import { 
  ArrowLeft, 
  Crown, 
  HelpCircle, 
  Volume2, 
  VolumeX, 
  Eye, 
  Clock,
  Sparkles,
  Wifi
} from 'lucide-react';

interface GameTableProps {
  gameState: GameState;
  publicState: PublicGameState;
  myPosition: PlayerPosition;
  isHost: boolean;
  remainingSeconds?: number;
  notification?: InTableNotification | null;
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
  publicState,
  myPosition,
  isHost,
  remainingSeconds = 60,
  notification,
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
  const [volume, setVolumeState] = useState(soundManager.getVolume());
  const [showRulesDrawer, setShowRulesDrawer] = useState(false);

  // Drag-and-drop state coordinates between Table and Player Hand
  const dropZoneRef = React.useRef<HTMLDivElement>(null);
  const [dropTargetRect, setDropTargetRect] = useState<DOMRect | null>(null);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    isOverTarget: boolean;
    cardId: string | null;
  }>({
    isDragging: false,
    isOverTarget: false,
    cardId: null,
  });

  // Track state changes to trigger authentic sound effects
  const prevPhaseRef = React.useRef(publicState.phase);
  const prevTricksCountRef = React.useRef(publicState.completedTricks.length);
  const prevCardsCountRef = React.useRef(publicState.myHand.length);

  React.useEffect(() => {
    // 1. Shuffling when round starts or bidding opens
    if (prevPhaseRef.current !== 'BIDDING' && publicState.phase === 'BIDDING') {
      soundManager.playShuffle();
    }
    // 2. Dealing when cards are dealt
    if (publicState.myHand.length > prevCardsCountRef.current && publicState.phase === 'TRICK_PLAY') {
      soundManager.playDeal();
    }
    // 3. Trick shove when a trick is completed
    if (publicState.completedTricks.length > prevTricksCountRef.current) {
      soundManager.playTrickShove();
    }

    // 4. Card placement sound for played cards
    publicState.currentTrickCards.forEach((pc) => {
      soundManager.playEventOnce(`trick_${publicState.currentTrickNumber}_card_${pc.cardId}_${pc.playerIndex}`, 'place');
    });

    prevPhaseRef.current = publicState.phase;
    prevTricksCountRef.current = publicState.completedTricks.length;
    prevCardsCountRef.current = publicState.myHand.length;
  }, [
    publicState.phase,
    publicState.completedTricks.length,
    publicState.currentTrickCards,
    publicState.myHand.length,
    publicState.currentTrickNumber,
  ]);

  // Update drop target bounding rect
  React.useEffect(() => {
    const updateRect = () => {
      if (dropZoneRef.current) {
        setDropTargetRect(dropZoneRef.current.getBoundingClientRect());
      }
    };
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect);
    const timer = setTimeout(updateRect, 150);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
      clearTimeout(timer);
    };
  }, [publicState.phase, publicState.currentTrickCards.length]);

  const handleDragStateChange = (state: { isDragging: boolean; isOverTarget: boolean; cardId: string | null }) => {
    if (state.isDragging && dropZoneRef.current) {
      setDropTargetRect(dropZoneRef.current.getBoundingClientRect());
    }
    setDragState(state);
  };

  const myTeam: Team = (myPosition === 0 || myPosition === 2) ? 0 : 1;
  const isMyTurn = publicState.currentTurn === myPosition;

  // Relative positions mapping (You are bottom at index 0)
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

  // Check if player can legally reveal trump
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

  const handleVolumeChange = (newVol: number) => {
    soundManager.setVolume(newVol);
    setVolumeState(newVol);
    if (newVol > 0 && isMuted) {
      soundManager.setMuted(false);
      setIsMuted(false);
    }
  };

  const latestSummary = publicState.roundHistory[publicState.roundHistory.length - 1];
  const isUrgentTimer = (publicState.phase === 'BIDDING' ? remainingSeconds <= 5 : remainingSeconds <= 15) && isMyTurn;

  const formatTimerLabel = () => {
    const secStr = remainingSeconds.toString().padStart(2, '0');
    if (publicState.phase === 'BIDDING') {
      return `Bidding: 00:${secStr}`;
    }
    if (publicState.phase === 'TRUMP_SELECTION') {
      return `Trump: 00:${secStr}`;
    }
    return isMyTurn ? `Your turn: 00:${secStr}` : `Turn: 00:${secStr}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-x-hidden selection:bg-amber-500 selection:text-black relative">
      {/* Top Navbar */}
      <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-4 py-2 flex items-center justify-between z-30">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onLeave}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
            title="Leave Game to Lobby"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <img src="/assets/game_logo.png" alt="The 29 Game" className="w-8 h-8 object-contain drop-shadow" />
            <div className="flex items-center gap-1 text-[11px] font-mono bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg text-slate-300 font-bold">
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span>ROOM: {publicState.roomCode}</span>
            </div>
          </div>
        </div>

        {/* Live Turn Notification Banner */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Turn Timer Badge */}
          {publicState.phase !== 'ROUND_ENDED' && publicState.phase !== 'MATCH_ENDED' && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-mono text-xs font-bold ${
                isUrgentTimer
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse'
                  : 'bg-slate-900 border border-slate-800 text-slate-300'
              }`}
            >
              <Clock className={`w-3.5 h-3.5 ${isUrgentTimer ? 'text-red-400' : 'text-amber-400'}`} />
              <span>{formatTimerLabel()}</span>
            </div>
          )}

          {/* Sound Volume Slider & Mute Toggle */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-2 py-1 rounded-xl">
            <button
              onClick={handleToggleSound}
              className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-14 sm:w-16 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400 hidden xs:block"
              title={`Volume: ${Math.round(volume * 100)}%`}
              aria-label="Volume Slider"
            />
          </div>

          {/* Non-blocking Rules Drawer Toggle */}
          <button
            onClick={() => setShowRulesDrawer(true)}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-xl transition-colors"
            title="Open Rules & Reference (?)"
          >
            <HelpCircle className="w-5 h-5 text-amber-400" />
          </button>
        </div>
      </header>

      {/* Floating In-Table Notification Toast */}
      {notification && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 max-w-md w-11/12 animate-fade-in pointer-events-none">
          <div
            className={`px-4 py-2 rounded-2xl border shadow-2xl text-xs font-bold text-center flex items-center justify-center gap-2 ${
              notification.type === 'TIMEOUT_AUTO_PLAY'
                ? 'bg-red-950/90 border-red-500/60 text-red-200'
                : notification.type === 'TRUMP_REVEALED'
                ? 'bg-amber-950/90 border-amber-400/80 text-amber-200'
                : notification.type === 'PAIR_DECLARED'
                ? 'bg-purple-950/90 border-purple-400/80 text-purple-200'
                : 'bg-slate-900/90 border-slate-700 text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Main Table Felt Arena */}
      <main className="flex-1 flex flex-col justify-between p-2 sm:p-4 max-w-6xl mx-auto w-full relative">
        {/* Top Header Row: Scoreboard & Trump Indicator */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 w-full mb-1 z-20">
          <Scoreboard publicState={publicState} myTeam={myTeam} />
          <TrumpIndicator
            publicState={publicState}
            onRevealTrump={onRevealTrump}
            canRevealTrump={canRevealTrump}
          />
        </div>

        {/* Central Card Table Arena utilizing table.jpg */}
        <div className="relative w-full max-w-5xl mx-auto my-auto flex-1 flex flex-col justify-center items-center px-1 sm:px-2">
          <div className="relative w-full aspect-[7/4] max-h-[58vh] min-h-[310px] sm:min-h-[380px] md:min-h-[440px] rounded-3xl overflow-visible flex items-center justify-center shadow-2xl">
            {/* Original table.jpg background preserving colors and proportions */}
            <img
              src="/assets/table.jpg"
              alt="The 29 Game Table"
              className="absolute inset-0 w-full h-full object-cover sm:object-fill rounded-3xl pointer-events-none select-none shadow-2xl border-2 sm:border-4 border-amber-950/70"
            />

            {/* Top Seat: Partner (Seat 3) */}
            {partner && (
              <div className="absolute top-1 sm:top-2 left-1/2 -translate-x-1/2 z-20">
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

            {/* Left Seat: Opponent Left (Seat 2) */}
            {leftOpponent && (
              <div className="absolute left-1 sm:left-4 top-[44%] -translate-y-1/2 z-20">
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

            {/* Right Seat: Opponent Right (Seat 4) */}
            {rightOpponent && (
              <div className="absolute right-1 sm:right-4 top-[44%] -translate-y-1/2 z-20">
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

            {/* IN-TABLE ACTIVE OVERLAYS (STRICTLY NO MODALS!) */}
            {/* 1. In-Table Bidding Panel */}
            {publicState.phase === 'BIDDING' && (
              <div className="absolute top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-full max-w-lg px-2">
                <InTableBidding
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
                  remainingSeconds={remainingSeconds}
                  onPlaceBid={onBid}
                />
              </div>
            )}

            {/* 2. In-Table Trump Selector */}
            {publicState.phase === 'TRUMP_SELECTION' && (
              <div className="absolute top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-full max-w-lg px-2">
                <InTableTrumpSelector
                  handCardIds={publicState.myHand}
                  highestBid={publicState.highestBid}
                  highestBidderName={
                    publicState.players.find((p) => p.position === publicState.highestBidder)?.name || 'Bidder'
                  }
                  isMyTurn={publicState.highestBidder === myPosition}
                  remainingSeconds={remainingSeconds}
                  onSelectTrump={onSelectTrump}
                />
              </div>
            )}

            {/* 3. In-Table Round Summary */}
            {publicState.phase === 'ROUND_ENDED' && latestSummary && (
              <div className="absolute top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-full max-w-lg px-2">
                <InTableRoundSummary
                  summary={latestSummary}
                  isHost={isHost}
                  myTeam={myTeam}
                  matchScore={publicState.matchScore}
                  onNextRound={onNextRound}
                />
              </div>
            )}

            {/* Central Trick Arena (Displayed during Trick Play inside green felt) */}
            {publicState.phase === 'TRICK_PLAY' && (
              <div className="absolute top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <TrickArea
                  dropZoneRef={dropZoneRef}
                  isDropTargetActive={dragState.isDragging}
                  isHoveredOverDropTarget={dragState.isOverTarget}
                  playedCards={publicState.currentTrickCards}
                  players={publicState.players}
                  myPosition={myPosition}
                  trickNumber={publicState.currentTrickNumber}
                />
              </div>
            )}
          </div>
        </div>

        {/* Bottom Area: Controls & Player Hand */}
        <div className="w-full flex flex-col items-center z-30 space-y-1.5 overflow-visible">
          {/* In-Table Action Buttons Row (Directly above hand, no modals!) */}
          <div className="flex items-center gap-2.5">
            {/* Trump Reveal Button */}
            {canRevealTrump && (
              <button
                type="button"
                onClick={onRevealTrump}
                className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-xl shadow-amber-500/30 flex items-center gap-2 animate-bounce transition-transform active:scale-95"
              >
                <Eye className="w-4 h-4 text-slate-950" />
                ⚡ Reveal Secret Trump!
              </button>
            )}

            {/* Pair Declaration Button */}
            {pairCheck.canDeclare && (
              <button
                type="button"
                onClick={onDeclarePair}
                className="px-4 py-2 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs shadow-xl shadow-purple-600/30 flex items-center gap-2 animate-pulse transition-transform active:scale-95"
              >
                <Crown className="w-4 h-4 text-amber-300" />
                👑 Declare Pair / Royals (±4 pts)!
              </button>
            )}
          </div>

          {/* Player Hand with Horizontal Overlap & Drag-to-Table */}
          <PlayerHand
            cardIds={publicState.myHand}
            playableCardIds={playableCardIds}
            isMyTurn={isMyTurn}
            dropTargetRect={dropTargetRect}
            onDragStateChange={handleDragStateChange}
            onPlayCard={onPlayCard}
            disabled={publicState.phase !== 'TRICK_PLAY'}
          />

          {/* Bottom Player Status Badge */}
          {me && (
            <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900/95 border border-slate-800 text-xs text-slate-300 shadow">
              <span className={`w-2 h-2 rounded-full ${isMyTurn ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
              <span className="font-bold text-slate-100">{me.name} (You - Seat 1)</span>
              <span className="text-[10px] text-slate-400 font-medium font-mono">
                {publicState.dealerIndex === myPosition ? '• DEALER' : ''}
                {publicState.highestBidder === myPosition ? ` • BIDDER (${publicState.highestBid})` : ''}
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Match Over Modal (Only shown when full match concludes at ±6 game points) */}
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

      {/* Non-Blocking Rules Drawer */}
      <RulesDrawer
        isOpen={showRulesDrawer}
        onClose={() => setShowRulesDrawer(false)}
      />
    </div>
  );
};
