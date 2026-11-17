import React, { useState, useEffect, useRef } from 'react';
import { 
  GameState, 
  PlayerPosition, 
  PublicGameState, 
  Team,
  TrumpSelectionChoice 
} from '../../engine/types';
import { CARD_MANIFEST } from '../../assets/cardManifest';
import { getPlayableCards } from '../../engine/tricks';
import { soundManager } from '../../common/SoundManager';
import { Scoreboard } from './Scoreboard';
import { OpponentSeat } from './OpponentSeat';
import { PlayerHand } from './PlayerHand';
import { TrickArea } from './TrickArea';
import { AskToRevealTrumpButton } from './TrumpIndicator';
import { PhysicalTrumpIndicator } from './PhysicalTrumpIndicator';
import { EpicTrumpRevealEffect } from './EpicTrumpRevealEffect';
import { InTableBidding } from './InTableBidding';
import { InTableTrumpSelector } from './InTableTrumpSelector';
import { InTableDoubleDecision } from './InTableDoubleDecision';
import { CentralTrumpAnnouncement } from './CentralTrumpAnnouncement';
import { InTablePairAnnouncement } from './InTablePairAnnouncement';
import { InTableRoundSummary } from './InTableRoundSummary';
import { MatchOverModal } from './MatchOverModal';
import { RulesDrawer } from './RulesDrawer';
import { DealerDealingAnimation } from './DealerDealingAnimation';
import { ConnectionStatus, InTableNotification } from '../../services/lanClient';
import { PairDeclaration } from '../../engine/types';
import { 
  ArrowLeft, 
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
  onDoubleDecision?: (decision: 'DOUBLE' | 'PASS') => Promise<{ success: boolean; error?: string }> | void;
  onRedoubleDecision?: (decision: 'REDOUBLE' | 'PASS') => Promise<{ success: boolean; error?: string }> | void;
  onRevealTrump: (data?: { requestId?: string; playerPosition?: PlayerPosition; roundNumber?: number; trickNumber?: number }) => Promise<any> | void;
  onPlayCard: (cardId: string) => void | Promise<{ success: boolean; error?: string } | void>;
  onDeclarePair?: () => void;
  connectionStatus?: ConnectionStatus;
  onNextRound: () => void;
  onRematch: () => void;
  onLeave: () => void;
}

export const GameTable: React.FC<GameTableProps> = ({
  publicState,
  myPosition,
  isHost,
  remainingSeconds = 15,
  notification,
  onBid,
  onSelectTrump,
  onDoubleDecision,
  onRedoubleDecision,
  onRevealTrump,
  onPlayCard,
  connectionStatus = 'connected',
  onNextRound,
  onRematch,
  onLeave,
}) => {
  const [isMuted, setIsMuted] = useState(soundManager.getMuted());
  const [volume, setVolumeState] = useState(soundManager.getVolume());
  const [showRulesDrawer, setShowRulesDrawer] = useState(false);
  const [showDealingAnimation, setShowDealingAnimation] = useState(false);
  const [trickWinnerPos, setTrickWinnerPos] = useState<PlayerPosition | null>(null);
  const [pairAnnouncement, setPairAnnouncement] = useState<{ pair: PairDeclaration; playerName: string } | null>(null);

  // King-Queen pair announcement: driven only by authoritative state so every
  // client shows it exactly once per deal (no duplicate socket-triggered replays).
  const announcedPairKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const pair = publicState.pairDeclaration;
    if (!pair) return;
    const key = `r${publicState.roundNumber}_p${pair.playerIndex}_${pair.suit}`;
    if (announcedPairKeyRef.current !== key) {
      announcedPairKeyRef.current = key;
      const owner = publicState.players.find((p) => p.position === pair.playerIndex);
      setPairAnnouncement({
        pair,
        playerName: owner ? (owner.position === myPosition ? 'You' : owner.name) : `Player ${pair.playerIndex + 1}`,
      });
    }
  }, [publicState.pairDeclaration, publicState.players, publicState.roundNumber, myPosition]);

  // Clear trick winner state if trick advances or cards are cleared
  useEffect(() => {
    if (publicState.currentTrickCards.length < 4) {
      setTrickWinnerPos(null);
    }
  }, [publicState.currentTrickCards.length, publicState.currentTrickNumber]);

  // Track round for dealer distribution animation
  const lastDealtRoundRef = useRef<number | null>(null);

  useEffect(() => {
    // When a deal starts in BIDDING phase and hasn't animated yet, run dealer animation
    if (publicState.phase === 'BIDDING' && lastDealtRoundRef.current !== publicState.roundNumber) {
      lastDealtRoundRef.current = publicState.roundNumber;
      setShowDealingAnimation(true);
    }
  }, [publicState.phase, publicState.roundNumber]);

  // Epic full-window reveal effect state: Universal across all players
  const [showEpicReveal, setShowEpicReveal] = useState(false);
  const handleTriggerEpicReveal = () => {
    setShowEpicReveal(true);
  };

  const prevIsTrumpRevealedRef = useRef<boolean>(publicState.isTrumpRevealed);
  useEffect(() => {
    if (!prevIsTrumpRevealedRef.current && publicState.isTrumpRevealed) {
      setShowEpicReveal(true);
      soundManager.playEventOnce(`trump_reveal_r${publicState.roundNumber}`, () => soundManager.playTrump());
    }
    prevIsTrumpRevealedRef.current = publicState.isTrumpRevealed;
  }, [publicState.isTrumpRevealed, publicState.roundNumber]);

  useEffect(() => {
    if (publicState.phase === 'BIDDING' || publicState.phase === 'TRUMP_SELECTION') {
      prevIsTrumpRevealedRef.current = false;
      setShowEpicReveal(false);
    }
  }, [publicState.phase, publicState.roundNumber]);

  const handlePlayCard = (cardId: string) => onPlayCard(cardId);

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
    if (publicState.phase === 'BIDDING') {
      soundManager.playEventOnce(`shuffle_r${publicState.roundNumber}`, 'shuffle');
    }
    // 2. Second deal of remaining 4 cards when entering TRICK_PLAY
    if (publicState.myHand.length > 4 && publicState.phase === 'TRICK_PLAY') {
      soundManager.playEventOnce(`deal2_r${publicState.roundNumber}`, 'deal');
    }
    // 3. Double / Re-Double announcements
    if (publicState.doubleStatus === 'DOUBLED') {
      soundManager.playEventOnce(`double_status_r${publicState.roundNumber}`, () => soundManager.playDouble());
    } else if (publicState.doubleStatus === 'REDOUBLED') {
      soundManager.playEventOnce(`redouble_status_r${publicState.roundNumber}`, () => soundManager.playRedouble());
    }
    // 4. Bidding audio for both human and CPU bids
    if (publicState.bids && publicState.bids.length > 0) {
      const lastBid = publicState.bids[publicState.bids.length - 1];
      const bidKey = `bid_r${publicState.roundNumber}_turn${publicState.bids.length}_${lastBid.playerIndex}_${lastBid.bid}`;
      if (lastBid.bid === 'PASS') {
        soundManager.playEventOnce(bidKey, () => soundManager.playPass());
      } else {
        soundManager.playEventOnce(bidKey, () => soundManager.playBid());
      }
    }

    prevPhaseRef.current = publicState.phase;
    prevTricksCountRef.current = publicState.completedTricks.length;
    prevCardsCountRef.current = publicState.myHand.length;
  }, [
    publicState.phase,
    publicState.roundNumber,
    publicState.doubleStatus,
    publicState.bids,
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

  // Check if player has passed the bid (strictly during BIDDING phase only)
  const isBiddingPhase = publicState.phase === 'BIDDING';
  const hasPlayerPassed = (pos: PlayerPosition) =>
    isBiddingPhase && publicState.bids.some((b) => b.playerIndex === pos && b.bid === 'PASS');

  const meHasPassed = hasPlayerPassed(myPosition);
  const leftHasPassed = hasPlayerPassed(leftOpponentPos);
  const partnerHasPassed = hasPlayerPassed(partnerPos);
  const rightHasPassed = hasPlayerPassed(rightOpponentPos);

  // Relative seat position of the player who selected / set the trump
  const getRelativePosition = (pos: PlayerPosition): 'bottom' | 'left' | 'top' | 'right' => {
    const diff = (pos - myPosition + 4) % 4;
    switch (diff) {
      case 0: return 'bottom';
      case 1: return 'left';
      case 2: return 'top';
      case 3: return 'right';
      default: return 'bottom';
    }
  };

  const trumpSetterRelPos = publicState.highestBidder !== null
    ? getRelativePosition(publicState.highestBidder)
    : (publicState.phase === 'BIDDING' ? null : 'right');

  // Playable cards calculation for current trick
  const leadCardId = publicState.currentTrickCards.length > 0 
    ? publicState.currentTrickCards[0].cardId 
    : null;

  const playableCardIds = getPlayableCards(
    publicState.myHand,
    leadCardId,
    publicState.revealedTrumpSuit,
    publicState.isTrumpRevealed,
    publicState.trumpMode
  );

  // Check if player can legally reveal trump (when player cannot follow lead suit)
  const canRevealTrump = Boolean(
    isMyTurn &&
    publicState.phase === 'TRICK_PLAY' &&
    !publicState.isTrumpRevealed &&
    leadCardId &&
    !publicState.myHand.some((id) => CARD_MANIFEST[id]?.suit === CARD_MANIFEST[leadCardId]?.suit)
  );

  const handleRevealTrumpAction = () => {
    const requestId = `reveal_${Date.now()}_pos${myPosition}_r${publicState.roundNumber}_t${publicState.currentTrickNumber}`;
    return onRevealTrump({
      requestId,
      playerPosition: myPosition,
      roundNumber: publicState.roundNumber,
      trickNumber: publicState.currentTrickNumber,
    });
  };

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

  // Authoritative Active Player resolution across all game phases
  const activePlayerPos = 
    publicState.phase === 'TRUMP_SELECTION'
      ? (publicState.highestBidder ?? publicState.currentTurn)
      : publicState.currentTurn;
  // Turn highlights only make sense while someone actually has a turn
  // (not during Double/Re-Double windows, announcements or round summaries).
  const isTurnPhase =
    publicState.phase === 'BIDDING' ||
    publicState.phase === 'TRUMP_SELECTION' ||
    (publicState.phase === 'TRICK_PLAY' && publicState.currentTrickCards.length < 4);
  const isMyActiveTurn = activePlayerPos === myPosition;
  const isBottomTurn = isTurnPhase && activePlayerPos === myPosition;
  const activePlayer = publicState.players.find((p) => p.position === activePlayerPos);
  const activePlayerName = isMyActiveTurn ? 'You' : (activePlayer?.name || 'Player');
  const activePlayerPoints = (publicState.playerPoints && publicState.playerPoints[activePlayerPos] !== undefined)
    ? publicState.playerPoints[activePlayerPos]
    : 0;

  const highestBidderPlayer = publicState.players.find((p) => p.position === publicState.highestBidder);
  const highestBidderName = highestBidderPlayer ? (highestBidderPlayer.position === myPosition ? 'You' : highestBidderPlayer.name) : 'None';

  // Determine if turn countdown timer should be shown
  const showTurnTimer = Boolean(
    publicState.phase === 'BIDDING' ||
    publicState.phase === 'TRUMP_SELECTION' ||
    publicState.phase === 'TRICK_PLAY'
  );

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden flex flex-col select-none bg-slate-900">
      {/* 1. Full-screen Edge-to-Edge Table Background */}
      <img
        src="/assets/table.jpg"
        alt="The 29 Game Table"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none z-0"
      />

      {/* 2. Floating Top Controls (No reserved navbar height, no horizontal strip) */}
      <div className="fixed top-2.5 left-2.5 right-2.5 sm:top-4 sm:left-5 sm:right-5 z-30 flex items-center justify-between pointer-events-none">
        {/* Left Section: Back / Leave + Room Code */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onLeave}
            className="p-2 text-slate-700 hover:text-slate-950 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-md rounded-2xl transition-all active:scale-95 cursor-pointer"
            title="Leave Game to Lobby"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-md px-2.5 sm:px-3 py-1.5 rounded-2xl text-slate-800">
            <img src="/assets/game_logo.png" alt="The 29 Game" className="w-5 h-5 sm:w-6 sm:h-6 object-contain drop-shadow" />
            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-mono font-bold">
              <Wifi className="w-3 h-3 text-emerald-600" />
              <span>ROOM: {publicState.roomCode}</span>
            </div>
          </div>
        </div>

        {/* Center Section: Active Bidder Name & Avatar during Bidding OR Scoreboard during Trick Play */}
        <div className="pointer-events-auto flex items-center">
          {publicState.phase === 'BIDDING' ? (
            <div
              className={`bg-white/95 backdrop-blur-md border shadow-lg px-3.5 py-1.5 rounded-2xl flex items-center gap-2 text-xs sm:text-sm font-black transition-all animate-fade-in ${
                (activePlayer?.team ?? 0) === 0
                  ? 'border-sky-400 ring-2 ring-sky-300/40 text-sky-950'
                  : 'border-rose-400 ring-2 ring-rose-300/40 text-rose-950'
              }`}
            >
              <span className="text-base sm:text-lg leading-none" role="img" aria-label="Bidder Avatar">
                {activePlayer?.avatar || '🦊'}
              </span>
              <span>
                {isMyActiveTurn ? 'Your Turn to Bid' : `${activePlayerName} is bidding`}
              </span>
              {publicState.highestBid > 0 && (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-lg ml-1">
                  High: {publicState.highestBid} ({highestBidderName})
                </span>
              )}
            </div>
          ) : (
            <Scoreboard publicState={publicState} myTeam={myTeam} />
          )}
        </div>

        {/* Right Section: Audio Controls & Help */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Sound Controls */}
          <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-md px-2 py-1.5 rounded-2xl text-slate-700">
            <button
              onClick={handleToggleSound}
              className="p-1 hover:text-slate-950 transition-colors cursor-pointer"
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
              className="w-12 sm:w-16 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500 hidden sm:block"
              title={`Volume: ${Math.round(volume * 100)}%`}
              aria-label="Volume Slider"
            />
          </div>

          {/* Help Rules Toggle */}
          <button
            onClick={() => setShowRulesDrawer(true)}
            className="p-2 text-amber-600 hover:text-amber-700 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-md rounded-2xl transition-all active:scale-95 cursor-pointer"
            title="Open Rules & Reference (?)"
          >
            <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
          </button>
        </div>
      </div>

      {/* 3. Full-Screen Table Canvas: Relative distribution of 4 seats and center */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        {/* Top Seat: Partner (Seat 3) - Ample clearance below top scoreboard */}
        {partner && (
          <div className="absolute top-18 sm:top-20 md:top-22 left-1/2 -translate-x-1/2 z-25">
            {/* If partner set the trump: place Trump Indicator beside partner seat */}
            {trumpSetterRelPos === 'top' && (
              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-auto">
                <PhysicalTrumpIndicator
                  publicState={publicState}
                  myPosition={myPosition}
                  onTriggerEpicReveal={handleTriggerEpicReveal}
                />
              </div>
            )}

            <OpponentSeat
              player={partner}
              seatPosition="top"
              isCurrentTurn={isTurnPhase && activePlayerPos === partnerPos}
              isDealer={publicState.dealerIndex === partnerPos}
              isBidder={publicState.highestBidder === partnerPos}
              bidAmount={publicState.highestBid || undefined}
              playerPoints={publicState.playerPoints ? publicState.playerPoints[partnerPos] : 0}
              hasPassed={partnerHasPassed}
              isTrickWinner={trickWinnerPos === partnerPos}
            />
          </div>
        )}

        {/* Left Seat: Opponent Left (Seat 2) */}
        {leftOpponent && (
          <div className="absolute left-2 sm:left-6 top-[44%] -translate-y-1/2 z-20">
            {/* If left opponent set the trump: place Trump Indicator above left seat */}
            {trumpSetterRelPos === 'left' && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto">
                <PhysicalTrumpIndicator
                  publicState={publicState}
                  myPosition={myPosition}
                  onTriggerEpicReveal={handleTriggerEpicReveal}
                />
              </div>
            )}

            <OpponentSeat
              player={leftOpponent}
              seatPosition="left"
              isCurrentTurn={isTurnPhase && activePlayerPos === leftOpponentPos}
              isDealer={publicState.dealerIndex === leftOpponentPos}
              isBidder={publicState.highestBidder === leftOpponentPos}
              bidAmount={publicState.highestBid || undefined}
              playerPoints={publicState.playerPoints ? publicState.playerPoints[leftOpponentPos] : 0}
              hasPassed={leftHasPassed}
              isTrickWinner={trickWinnerPos === leftOpponentPos}
            />
          </div>
        )}

        {/* Right Seat: Opponent Right (Seat 4, Varun) */}
        {rightOpponent && (
          <div className="absolute right-2 sm:right-6 top-[44%] -translate-y-1/2 z-20">
            {/* If right opponent set the trump (or fallback): place Trump Indicator directly above Varun */}
            {trumpSetterRelPos === 'right' && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto">
                <PhysicalTrumpIndicator
                  publicState={publicState}
                  myPosition={myPosition}
                  onTriggerEpicReveal={handleTriggerEpicReveal}
                />
              </div>
            )}

            <OpponentSeat
              player={rightOpponent}
              seatPosition="right"
              isCurrentTurn={isTurnPhase && activePlayerPos === rightOpponentPos}
              isDealer={publicState.dealerIndex === rightOpponentPos}
              isBidder={publicState.highestBidder === rightOpponentPos}
              bidAmount={publicState.highestBid || undefined}
              playerPoints={publicState.playerPoints ? publicState.playerPoints[rightOpponentPos] : 0}
              hasPassed={rightHasPassed}
              isTrickWinner={trickWinnerPos === rightOpponentPos}
            />
          </div>
        )}

        {/* IN-TABLE ACTIVE OVERLAYS (STRICTLY NO MODALS!) */}
        {/* A. Bidding Panel with Restored PASS button */}
        {publicState.phase === 'BIDDING' && !showDealingAnimation && (
          <div className="absolute top-[44%] sm:top-[46%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-full max-w-lg px-2">
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
          <div className="absolute top-[44%] sm:top-[46%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-full max-w-lg px-2">
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

        {/* B1. Special Trump Announcement (1-second table display for Joker / 7th Card) */}
        {publicState.phase === 'TRUMP_ANNOUNCEMENT' && publicState.specialAnnouncement && (
          <div className="absolute top-[44%] sm:top-[46%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-35 w-full max-w-sm px-2">
            <CentralTrumpAnnouncement announcement={publicState.specialAnnouncement} />
          </div>
        )}

        {/* B2. Double / Re-Double In-Table Decision (10s timers) */}
        {(publicState.phase === 'DOUBLE_DECISION' || publicState.phase === 'REDOUBLE_DECISION') && (
          <div className="absolute top-[44%] sm:top-[46%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-35 w-full max-w-md px-2">
            <InTableDoubleDecision
              key={`${publicState.roundNumber}_${publicState.phase}`}
              players={publicState.players}
              phase={publicState.phase}
              highestBidder={publicState.highestBidder}
              highestBid={publicState.highestBid}
              myPosition={myPosition}
              remainingSeconds={remainingSeconds}
              doubleVotes={publicState.doubleVotes}
              redoubleVotes={publicState.redoubleVotes}
              onDouble={() =>
                publicState.phase === 'DOUBLE_DECISION'
                  ? onDoubleDecision?.('DOUBLE')
                  : onRedoubleDecision?.('REDOUBLE')
              }
              onPass={() =>
                publicState.phase === 'DOUBLE_DECISION'
                  ? onDoubleDecision?.('PASS')
                  : onRedoubleDecision?.('PASS')
              }
            />
          </div>
        )}

        {/* B3. King-Queen Pair / Royals Announcement (2s floating visual) */}
        {pairAnnouncement && (
          <div className="absolute top-[35%] sm:top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-45 w-full max-w-sm px-2">
            <InTablePairAnnouncement
              pair={pairAnnouncement.pair}
              playerName={pairAnnouncement.playerName}
              onDismiss={() => setPairAnnouncement(null)}
            />
          </div>
        )}

        {/* C. Round Summary with 3s transition */}
        {publicState.phase === 'ROUND_ENDED' && latestSummary && (
          <div className="absolute top-[46%] sm:top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-full max-w-lg px-2">
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
              currentTrickNumber={publicState.currentTrickNumber}
              roundNumber={publicState.roundNumber}
              trumpSuit={publicState.revealedTrumpSuit}
              isTrumpRevealed={publicState.isTrumpRevealed}
              trumpMode={publicState.trumpMode}
              onTrickWinnerDetermined={setTrickWinnerPos}
            />
          </div>
        )}

        {/* 4. Bottom Area: Player Seat 1 (You) and Hand */}
        <div className="absolute bottom-1 sm:bottom-2 left-0 right-0 z-30 flex flex-col items-center pointer-events-auto">
          {/* Horizontally Spread Player Hand in Bottom Center */}
          <PlayerHand
            cardIds={publicState.myHand}
            playableCardIds={playableCardIds}
            isMyTurn={isMyTurn}
            dropTargetRect={dropTargetRect}
            onDragStateChange={handleDragStateChange}
            onPlayCard={handlePlayCard}
            disabled={publicState.phase !== 'TRICK_PLAY'}
          />
        </div>
      </main>

      {/* 5. Bottom-Left Area: Trump Indicator (if You set trump) + Ask to Reveal Trump + Krish (You) Player Seat */}
      <div className="fixed bottom-3 left-3 sm:bottom-4 sm:left-5 z-40 flex flex-col items-start gap-2 select-none pointer-events-auto">
        {/* If bottom player (You) set the trump: place Trump Indicator near bottom seat */}
        {trumpSetterRelPos === 'bottom' && (
          <div className="flex flex-col items-start pointer-events-auto mb-1">
            <PhysicalTrumpIndicator
              publicState={publicState}
              myPosition={myPosition}
              onTriggerEpicReveal={handleTriggerEpicReveal}
            />
          </div>
        )}

        <AskToRevealTrumpButton
          canRevealTrump={canRevealTrump}
          onRevealTrump={handleRevealTrumpAction}
        />

        {me && (
          <div
            id="seat-bottom"
            data-seat="bottom"
            className={`relative flex items-center gap-2 px-3 py-1.5 rounded-2xl transition-all duration-200 select-none shadow-md ${
              trickWinnerPos === myPosition
                ? 'bg-amber-50/95 border-2 border-amber-400 ring-4 ring-amber-300/80 shadow-[0_0_24px_rgba(251,191,36,0.85)] text-slate-950 animate-pulse'
                : isBottomTurn
                ? 'bg-sky-50/95 border-2 border-sky-400 ring-2 ring-sky-300/60 shadow-[0_0_18px_rgba(56,189,248,0.5)] text-slate-900'
                : 'bg-white/95 border border-sky-200/90 text-slate-800'
            }`}
          >
            {/* Trick Winner Tag */}
            {trickWinnerPos === myPosition && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider text-slate-950 bg-amber-400 border border-amber-300 shadow-md z-20 animate-bounce">
                WON TRICK
              </span>
            )}

            {/* Dealer Badge */}
            {publicState.dealerIndex === myPosition && (
              <span
                className="absolute -top-2 -left-2 bg-amber-400 text-slate-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-md border border-amber-300 z-10"
                title="Dealer"
              >
                D
              </span>
            )}

            {/* Bidder Badge */}
            {publicState.highestBidder === myPosition && publicState.highestBid && (
              <span
                className="absolute -top-2 -right-2 bg-emerald-600 text-white font-black text-[10px] px-1.5 py-0.5 rounded-full shadow-md z-10"
                title={`Winning Bidder: ${publicState.highestBid}`}
              >
                {publicState.highestBid}
              </span>
            )}

            {/* Turn or Passed Indicator Tag */}
            {!trickWinnerPos && isBottomTurn ? (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider text-white bg-sky-500 shadow-xs z-10">
                TURN
              </span>
            ) : !trickWinnerPos && meHasPassed ? (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider text-slate-700 bg-slate-200/95 border border-slate-300 shadow-xs z-10">
                PASSED
              </span>
            ) : null}

            {/* Partnership 1 Blue Dot */}
            <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" title="Your Partnership" />

            {/* Avatar */}
            <span
              data-avatar="bottom"
              className="text-xl sm:text-2xl leading-none shrink-0"
              role="img"
              aria-label="Avatar"
            >
              {me.avatar || '🦊'}
            </span>

            {/* Name and Trick Points */}
            <div className="flex items-center gap-1.5 text-xs font-bold leading-tight">
              <span className="text-slate-900 truncate max-w-[95px] sm:max-w-[125px]">
                {me.name} (You)
              </span>
              <span className="text-slate-400 font-normal">·</span>
              <span className="text-amber-700 font-black whitespace-nowrap">
                {publicState.playerPoints ? publicState.playerPoints[myPosition] : 0} pts
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 6. Bottom-Right Controls: 30-Second Turn Timer + Active Player Points Box (Item 2) */}
      <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-5 z-40 flex items-center gap-2 select-none pointer-events-auto">
        {/* Turn Timer */}
        {showTurnTimer && (
          <div
            className={`bg-white/95 backdrop-blur-md border shadow-xl px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl flex items-center gap-2 text-xs sm:text-sm font-bold transition-all ${
              remainingSeconds <= 5
                ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-300 animate-pulse'
                : 'border-slate-200/90 text-slate-800'
            }`}
            title="30-Second Turn Countdown"
          >
            <Clock className={`w-4 h-4 ${remainingSeconds <= 5 ? 'text-rose-600' : 'text-amber-500'}`} />
            <div className="flex flex-col text-left leading-none">
              <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Turn Timer</span>
              <span className="font-mono text-sm sm:text-base font-black">00:{remainingSeconds.toString().padStart(2, '0')}</span>
            </div>
          </div>
        )}

        {/* Active Player Points Box (Immediately to the right of Turn Timer) */}
        {publicState.phase !== 'ROUND_ENDED' && publicState.phase !== 'MATCH_ENDED' && (
          <div
            className="bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-800 transition-all"
            title={`${isMyActiveTurn ? 'Your' : activePlayerName} collected trick points`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <div className="flex flex-col text-left leading-none">
              <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">
                {isMyActiveTurn ? 'Your Points' : `${activePlayerName}'s Pts`}
              </span>
              <span className="font-mono text-sm sm:text-base font-black text-amber-600">
                {activePlayerPoints.toString().padStart(2, '0')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 7. LAN connection banner (only while our own socket is down) */}
      {connectionStatus !== 'connected' && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] pointer-events-none animate-fade-in">
          <div className="flex items-center gap-2 bg-rose-600/95 text-white text-xs font-bold px-4 py-2 rounded-2xl shadow-xl border border-rose-300">
            <Wifi className="w-4 h-4 animate-pulse" />
            Connection to the LAN host lost — reconnecting…
          </div>
        </div>
      )}

      {/* 8. Full-Window Epic Trump-Reveal Effect (1000ms golden-white luminous burst) */}
      {showEpicReveal && (
        <EpicTrumpRevealEffect
          suit={publicState.revealedTrumpSuit}
          trumpMode={publicState.trumpMode}
          seventhCardId={publicState.revealedSeventhCard}
          onComplete={() => setShowEpicReveal(false)}
        />
      )}

      {/* 9. Dealer Distribution Animation (16 sequential deliveries from dealer) */}
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
