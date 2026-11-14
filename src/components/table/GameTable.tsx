import React, { useState, useEffect, useRef } from 'react';
import { 
  GameState, 
  PlayerPosition, 
  PublicGameState, 
  Team,
  TrumpSelectionChoice 
} from '../../engine/types';
import { CARD_MANIFEST } from '../../assets/cardManifest';
import { canDeclarePair } from '../../engine/scoring';
import { getPlayableCards } from '../../engine/tricks';
import { soundManager } from '../../common/SoundManager';
import { Scoreboard } from './Scoreboard';
import { OpponentSeat } from './OpponentSeat';
import { PlayerHand } from './PlayerHand';
import { TrickArea } from './TrickArea';
import { RevealedTrumpTopRight, AskToRevealTrumpButton } from './TrumpIndicator';
import { InTableBidding } from './InTableBidding';
import { InTableTrumpSelector } from './InTableTrumpSelector';
import { InTableRoundSummary } from './InTableRoundSummary';
import { MatchOverModal } from './MatchOverModal';
import { RulesDrawer } from './RulesDrawer';
import { DealerDealingAnimation } from './DealerDealingAnimation';
import { InTableNotification } from '../../services/lanClient';
import { 
  ArrowLeft, 
  Crown, 
  HelpCircle, 
  Volume2, 
  VolumeX, 
  Clock,
  Sparkles,
  Wifi
} from 'lucide-react';

interface GameTableProps {
  gameState?: GameState;
  publicState: PublicGameState;
  myPosition: PlayerPosition;
  isHost: boolean;
  remainingSeconds?: number;
  notification?: InTableNotification | null;
  onBid: (bid: number | 'PASS') => void;
  onSelectTrump: (choice: TrumpSelectionChoice) => void;
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
  remainingSeconds = 30,
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
  const [showDealingAnimation, setShowDealingAnimation] = useState(false);

  // Track round for dealer distribution animation
  const lastDealtRoundRef = useRef<number | null>(null);

  useEffect(() => {
    // When a deal starts in BIDDING phase and hasn't animated yet, run dealer animation
    if (publicState.phase === 'BIDDING' && lastDealtRoundRef.current !== publicState.roundNumber) {
      lastDealtRoundRef.current = publicState.roundNumber;
      setShowDealingAnimation(true);
    }
  }, [publicState.phase, publicState.roundNumber]);

  // Drag-and-drop state coordinates between Table and Player Hand
  const dropZoneRef = useRef<HTMLDivElement>(null);
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
  const prevPhaseRef = useRef(publicState.phase);
  const prevTricksCountRef = useRef(publicState.completedTricks.length);
  const prevCardsCountRef = useRef(publicState.myHand.length);

  useEffect(() => {
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
  useEffect(() => {
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

  // Relative positions mapping (You are bottom at seat index 0)
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
    publicState.trumpMode !== 'no-trump' &&
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

  // Determine if it is a human turn for the bottom-right timer
  const isHumanTurn = Boolean(
    publicState.phase !== 'ROUND_ENDED' &&
    publicState.phase !== 'MATCH_ENDED' &&
    (
      (publicState.phase === 'BIDDING' && isMyTurn) ||
      (publicState.phase === 'TRUMP_SELECTION' && publicState.highestBidder === myPosition) ||
      (publicState.phase === 'TRICK_PLAY' && isMyTurn)
    )
  );

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden flex flex-col select-none bg-slate-900">
      {/* 1. Full-screen Edge-to-Edge Table Background */}
      <img
        src="/assets/table.jpg"
        alt="The 29 Game Table"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none z-0"
      />

      {/* 2. Sleek Light Top Bar */}
      <header className="relative z-30 bg-white/85 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-5 py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onLeave}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            title="Leave Game to Lobby"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <img src="/assets/game_logo.png" alt="The 29 Game" className="w-7 h-7 object-contain drop-shadow" />
            <div className="flex items-center gap-1.5 text-xs font-mono bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-xl text-slate-700 font-bold">
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              <span>ROOM: {publicState.roomCode}</span>
            </div>
          </div>
        </div>

        {/* Minimal Scoreboard in Center (Partnership colors, no Team A/B text) */}
        <div className="hidden sm:flex items-center">
          <Scoreboard publicState={publicState} myTeam={myTeam} />
        </div>

        {/* Right Section: Revealed Trump (Top-Right) & Audio Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Revealed Trump Suit indicator at Top-Right (Only visible when officially revealed!) */}
          <div className="hidden xs:block">
            <RevealedTrumpTopRight publicState={publicState} />
          </div>

          {/* Sound Controls */}
          <div className="flex items-center gap-1.5 bg-slate-100/90 border border-slate-200 px-2 py-1 rounded-xl">
            <button
              onClick={handleToggleSound}
              className="p-1 text-slate-600 hover:text-slate-900 transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-600" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-14 sm:w-16 h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-amber-500 hidden sm:block"
              title={`Volume: ${Math.round(volume * 100)}%`}
              aria-label="Volume Slider"
            />
          </div>

          {/* Help Rules Toggle */}
          <button
            onClick={() => setShowRulesDrawer(true)}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            title="Open Rules & Reference (?)"
          >
            <HelpCircle className="w-5 h-5 text-amber-600" />
          </button>
        </div>
      </header>

      {/* Floating Scoreboard & Revealed Trump for Small Mobile Screens */}
      <div className="sm:hidden relative z-20 flex items-center justify-between px-3 pt-2 gap-2">
        <Scoreboard publicState={publicState} myTeam={myTeam} />
        <RevealedTrumpTopRight publicState={publicState} />
      </div>

      {/* Floating In-Table Notification Toast (Non-winner alerts only) */}
      {notification && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 max-w-md w-11/12 animate-fade-in pointer-events-none">
          <div
            className={`px-4 py-2 rounded-2xl border shadow-xl text-xs font-bold text-center flex items-center justify-center gap-2 ${
              notification.type === 'TIMEOUT_AUTO_PLAY'
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : notification.type === 'TRUMP_REVEALED'
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : notification.type === 'PAIR_DECLARED'
                ? 'bg-purple-50 border-purple-300 text-purple-900'
                : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* 3. Full-Screen Table Canvas: Relative distribution of 4 seats and center */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        {/* Top Seat: Partner (Seat 3) */}
        {partner && (
          <div className="absolute top-2 sm:top-4 left-1/2 -translate-x-1/2 z-20">
            <OpponentSeat
              player={partner}
              seatPosition="top"
              isCurrentTurn={publicState.currentTurn === partnerPos}
              isDealer={publicState.dealerIndex === partnerPos}
              isBidder={publicState.highestBidder === partnerPos}
              bidAmount={publicState.highestBid || undefined}
              playerPoints={publicState.playerPoints ? publicState.playerPoints[partnerPos] : 0}
            />
          </div>
        )}

        {/* Left Seat: Opponent Left (Seat 2) */}
        {leftOpponent && (
          <div className="absolute left-2 sm:left-6 top-[44%] -translate-y-1/2 z-20">
            <OpponentSeat
              player={leftOpponent}
              seatPosition="left"
              isCurrentTurn={publicState.currentTurn === leftOpponentPos}
              isDealer={publicState.dealerIndex === leftOpponentPos}
              isBidder={publicState.highestBidder === leftOpponentPos}
              bidAmount={publicState.highestBid || undefined}
              playerPoints={publicState.playerPoints ? publicState.playerPoints[leftOpponentPos] : 0}
            />
          </div>
        )}

        {/* Right Seat: Opponent Right (Seat 4) */}
        {rightOpponent && (
          <div className="absolute right-2 sm:right-6 top-[44%] -translate-y-1/2 z-20">
            <OpponentSeat
              player={rightOpponent}
              seatPosition="right"
              isCurrentTurn={publicState.currentTurn === rightOpponentPos}
              isDealer={publicState.dealerIndex === rightOpponentPos}
              isBidder={publicState.highestBidder === rightOpponentPos}
              bidAmount={publicState.highestBid || undefined}
              playerPoints={publicState.playerPoints ? publicState.playerPoints[rightOpponentPos] : 0}
            />
          </div>
        )}

        {/* IN-TABLE ACTIVE OVERLAYS (STRICTLY NO MODALS!) */}
        {/* A. Bidding Panel with Restored PASS button */}
        {publicState.phase === 'BIDDING' && !showDealingAnimation && (
          <div className="absolute top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-full max-w-lg px-2">
            <InTableBidding
              currentHighestBid={publicState.highestBid}
              highestBidder={publicState.highestBidder}
              activeBidder={publicState.currentTurn}
              players={publicState.players}
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

        {/* B. Trump Selector */}
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

        {/* C. Round Summary with 3s transition */}
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

        {/* D. Central Trick Area (Displayed during Trick Play) */}
        {publicState.phase === 'TRICK_PLAY' && (
          <div className="absolute top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <TrickArea
              playedCards={publicState.currentTrickCards}
              players={publicState.players}
              myPosition={myPosition}
              completedTricks={publicState.completedTricks}
              lastCompletedTrick={publicState.lastCompletedTrick}
              dropZoneRef={dropZoneRef}
            />
          </div>
        )}

        {/* 4. Bottom Area: Player Seat 1 (You) and Hand */}
        <div className="absolute bottom-1 sm:bottom-2 left-0 right-0 z-30 flex flex-col items-center pointer-events-auto">
          {/* Pair Declaration Action Button (if legal) */}
          {pairCheck.canDeclare && (
            <div className="mb-1">
              <button
                type="button"
                onClick={onDeclarePair}
                className="px-4 py-1.5 rounded-2xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs shadow-lg flex items-center gap-2 animate-pulse transition-transform"
              >
                <Crown className="w-4 h-4 text-amber-300" />
                Declare Pair / Royals (±4 pts)!
              </button>
            </div>
          )}

          {/* Bottom Seat (Seat 1 - You) Pill with Blue Partnership accent */}
          {me && (
            <div
              id="seat-bottom"
              data-seat="bottom"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl transition-all duration-150 select-none shadow-md mb-1 ${
                isMyTurn
                  ? 'bg-amber-50/90 border-2 border-amber-400 ring-2 ring-amber-300/60 shadow-lg'
                  : 'bg-white/95 border border-sky-200/90 text-slate-800'
              }`}
            >
              {/* Dealer Badge */}
              {publicState.dealerIndex === myPosition && (
                <span
                  className="bg-amber-400 text-slate-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-md border border-amber-300"
                  title="Dealer"
                >
                  D
                </span>
              )}

              {/* Bidder Badge */}
              {publicState.highestBidder === myPosition && publicState.highestBid && (
                <span
                  className="bg-emerald-600 text-white font-black text-[10px] px-1.5 py-0.5 rounded-full shadow-md"
                  title={`Winning Bidder: ${publicState.highestBid}`}
                >
                  {publicState.highestBid}
                </span>
              )}

              {/* Partnership 1 Blue Dot */}
              <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" title="Your Partnership" />

              {/* Avatar */}
              <span className="text-xl sm:text-2xl leading-none" role="img" aria-label="Avatar">
                {me.avatar || '🦊'}
              </span>

              {/* Name and Trick Points */}
              <div className="flex items-center gap-1.5 text-xs font-bold leading-tight">
                <span className="text-slate-900 truncate max-w-[100px] sm:max-w-[130px]">
                  {me.name} (You)
                </span>
                <span className="text-slate-400 font-normal">·</span>
                <span className="text-amber-700 font-black whitespace-nowrap">
                  {publicState.playerPoints ? publicState.playerPoints[myPosition] : 0} pts
                </span>
              </div>
            </div>
          )}

          {/* Horizontally Spread Player Hand */}
          <PlayerHand
            cardIds={publicState.myHand}
            playableCardIds={playableCardIds}
            isMyTurn={isMyTurn}
            dropTargetRect={dropTargetRect}
            onDragStateChange={handleDragStateChange}
            onPlayCard={onPlayCard}
            disabled={publicState.phase !== 'TRICK_PLAY'}
          />
        </div>
      </main>

      {/* 5. Bottom-Left Control: ASK TO REVEAL TRUMP (Item 10) */}
      <div className="fixed bottom-3 left-3 sm:bottom-4 sm:left-5 z-40">
        <AskToRevealTrumpButton
          canRevealTrump={canRevealTrump}
          onRevealTrump={onRevealTrump}
        />
      </div>

      {/* 6. Bottom-Right Control: 30-Second Human Turn Timer (Item 8) */}
      {isHumanTurn && (
        <div
          className={`fixed bottom-3 right-3 sm:bottom-4 sm:right-5 z-40 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl px-3.5 sm:px-4 py-2 rounded-2xl flex items-center gap-2 select-none text-xs sm:text-sm font-bold transition-all ${
            remainingSeconds <= 5
              ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-300 animate-pulse'
              : 'text-slate-800'
          }`}
          title="30-Second Human Turn Countdown"
        >
          <Clock className={`w-4 h-4 ${remainingSeconds <= 5 ? 'text-rose-600' : 'text-amber-500'}`} />
          <div className="flex flex-col text-left leading-none">
            <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Turn Timer</span>
            <span className="font-mono text-sm sm:text-base font-black">00:{remainingSeconds.toString().padStart(2, '0')}</span>
          </div>
        </div>
      )}

      {/* 7. Dealer Distribution Animation (Item 12: 16 sequential deliveries from dealer) */}
      {showDealingAnimation && (
        <DealerDealingAnimation
          dealerIndex={publicState.dealerIndex}
          myPosition={myPosition}
          onDealingComplete={() => setShowDealingAnimation(false)}
        />
      )}

      {/* Match Over Modal (Shown only when full match concludes at ±6 game points) */}
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
