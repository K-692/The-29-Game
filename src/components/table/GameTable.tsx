import React, { useState, useEffect, useRef } from 'react';
import { asset } from '../../common/asset';
import { 
  GameState, 
  PlayerPosition, 
  PublicGameState, 
  Team,
  TrumpSelectionChoice 
} from '../../engine/types';
import { CARD_MANIFEST } from '../../assets/cardManifest';
import { getPlayableCards } from '../../engine/tricks';
import { isForcedOpening } from '../../engine/bidding';
import { soundManager } from '../../common/SoundManager';
import { Scoreboard } from './Scoreboard';
import { SeatBadge } from './SeatBadge';
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
import { ConnectionStatus, InTableNotification } from '../../services/gameClient';
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

  // Your card on its way to the table (shown before the server confirms it).
  const [ownFlight, setOwnFlight] = useState<{ cardId: string; fromRect: DOMRect | null } | null>(null);
  const handlePlayCard = async (cardId: string, fromRect?: DOMRect) => {
    setOwnFlight({ cardId, fromRect: fromRect ?? null });
    const res = await onPlayCard(cardId);
    if (res && res.success === false) {
      setOwnFlight((cur) => (cur?.cardId === cardId ? null : cur));
    }
    return res;
  };
  // Once the server has the card on the table (or the trick has moved on), the
  // confirmed card takes over the same element, so the optimistic copy can go.
  useEffect(() => {
    if (!ownFlight) return;
    const onTable = publicState.currentTrickCards.some((pc) => pc.cardId === ownFlight.cardId);
    const stillInHand = publicState.myHand.includes(ownFlight.cardId);
    if (onTable || !stillInHand) setOwnFlight(null);
  }, [ownFlight, publicState.currentTrickCards, publicState.myHand]);

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

  // Each player's latest call during the auction, shown as a bubble on their seat.
  const bidCallFor = (pos: PlayerPosition): string | null => {
    if (!isBiddingPhase) return null;
    const mine = publicState.bids.filter((b) => b.playerIndex === pos);
    const last = mine[mine.length - 1];
    if (!last) return null;
    return last.bid === 'PASS' ? 'Pass' : String(last.bid);
  };
  const contractBidFor = (pos: PlayerPosition): number | null =>
    !isBiddingPhase && publicState.highestBidder === pos && publicState.highestBid > 0 ? publicState.highestBid : null;

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
  // Computer players answer within ~1s, so a 15s countdown during their turn would only mislead.
  // Hidden while the full trick is being collected (nobody has a turn then).
  const showTurnTimer = Boolean(isTurnPhase && !activePlayer?.isCpu);

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden flex flex-col select-none bg-felt-800">
      {/* 1. Full-screen Edge-to-Edge Table Background */}
      <img
        src={asset('/assets/table.jpg')}
        alt="The 29 Game Table"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none z-0"
      />

      {/* 2. Top bar: leave + room, scoreboard (always visible), sound + rules */}
      <div className="fixed top-2.5 left-2.5 right-2.5 sm:top-4 sm:left-5 sm:right-5 z-30 flex items-start justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onLeave}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-felt-900/85 border border-cream-100/15 text-cream-100 hover:bg-felt-800 shadow-soft transition"
            title="Leave table"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="hidden sm:flex items-center gap-2 h-9 pl-1.5 pr-3 rounded-full bg-felt-900/85 border border-cream-100/15 text-cream-100 shadow-soft">
            <img src={asset('/assets/game_logo.png')} alt="29" className="w-6 h-6 rounded-md" />
            <span className="font-mono text-xs tracking-[0.2em]">{publicState.roomCode}</span>
          </div>
        </div>

        <div className="pointer-events-auto">
          <Scoreboard publicState={publicState} myTeam={myTeam} myPosition={myPosition} />
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={handleToggleSound}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-felt-900/85 border border-cream-100/15 text-cream-100 hover:bg-felt-800 shadow-soft transition"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowRulesDrawer(true)}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-felt-900/85 border border-cream-100/15 text-cream-100 hover:bg-felt-800 shadow-soft transition"
            title="Rules"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table notifications (trump revealed, doubles, errors…) */}
      {notification && (
        <div key={notification.timestamp} className="fixed top-[5.25rem] sm:top-16 left-2.5 sm:left-5 z-[55] pointer-events-none animate-fade-in max-w-[34vw] sm:max-w-[16rem]">
          <div className="rounded-xl bg-felt-900/90 border border-cream-100/15 text-cream-100 text-xs leading-snug px-3 py-2 shadow-soft backdrop-blur-md">
            {notification.message}
          </div>
        </div>
      )}

      {/* 3. Full-Screen Table Canvas: Relative distribution of 4 seats and center */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        {/* Top Seat: Partner (Seat 3) - Ample clearance below top scoreboard */}
        {partner && (
          <div className="absolute top-[4.5rem] sm:top-20 md:top-[5.5rem] left-1/2 -translate-x-1/2 z-[25]">
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

            <SeatBadge
              player={partner}
              seatPosition="top"
              relation={'partner'}
              isCurrentTurn={isTurnPhase && activePlayerPos === partnerPos}
              isDealer={publicState.dealerIndex === partnerPos}
              contractBid={contractBidFor(partnerPos)}
              bidCall={bidCallFor(partnerPos)}
              isHighBid={isBiddingPhase && publicState.highestBidder === partnerPos}
              playerPoints={publicState.playerPoints ? publicState.playerPoints[partnerPos] : 0}
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

            <SeatBadge
              player={leftOpponent}
              seatPosition="left"
              relation={'opponent'}
              isCurrentTurn={isTurnPhase && activePlayerPos === leftOpponentPos}
              isDealer={publicState.dealerIndex === leftOpponentPos}
              contractBid={contractBidFor(leftOpponentPos)}
              bidCall={bidCallFor(leftOpponentPos)}
              isHighBid={isBiddingPhase && publicState.highestBidder === leftOpponentPos}
              playerPoints={publicState.playerPoints ? publicState.playerPoints[leftOpponentPos] : 0}
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

            <SeatBadge
              player={rightOpponent}
              seatPosition="right"
              relation={'opponent'}
              isCurrentTurn={isTurnPhase && activePlayerPos === rightOpponentPos}
              isDealer={publicState.dealerIndex === rightOpponentPos}
              contractBid={contractBidFor(rightOpponentPos)}
              bidCall={bidCallFor(rightOpponentPos)}
              isHighBid={isBiddingPhase && publicState.highestBidder === rightOpponentPos}
              playerPoints={publicState.playerPoints ? publicState.playerPoints[rightOpponentPos] : 0}
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
              isForcedDealer={isForcedOpening(publicState.bids, myPosition, publicState.rules)}
              remainingSeconds={remainingSeconds}
              onPlaceBid={onBid}
              bids={publicState.bids}
              biddingOrder={publicState.biddingOrder}
              dealerIndex={publicState.dealerIndex}
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
          <div className="absolute top-[44%] sm:top-[46%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-[35] w-full max-w-sm px-2">
            <CentralTrumpAnnouncement announcement={publicState.specialAnnouncement} />
          </div>
        )}

        {/* B2. Double / Re-Double In-Table Decision (10s timers) */}
        {(publicState.phase === 'DOUBLE_DECISION' || publicState.phase === 'REDOUBLE_DECISION') && (
          <div className="absolute top-[44%] sm:top-[46%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-[35] w-full max-w-md px-2">
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
          <div className="absolute top-[35%] sm:top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-[45] w-full max-w-sm px-2">
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
              pendingOwnCard={ownFlight}
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
          <SeatBadge
            player={me}
            seatPosition="bottom"
            relation="me"
            isCurrentTurn={isBottomTurn}
            isDealer={publicState.dealerIndex === myPosition}
            contractBid={contractBidFor(myPosition)}
            bidCall={bidCallFor(myPosition)}
            isHighBid={isBiddingPhase && publicState.highestBidder === myPosition}
            playerPoints={publicState.playerPoints ? publicState.playerPoints[myPosition] : 0}
            isTrickWinner={trickWinnerPos === myPosition}
          />
        )}
      </div>

      {/* 6. Turn timer (bottom-right). Shown only while a human has a turn. */}
      {showTurnTimer && (
        <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-5 z-40 pointer-events-none">
          <div
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 shadow-soft border backdrop-blur-md transition-colors ${
              remainingSeconds <= 5
                ? 'bg-suit-red/90 border-cream-100/30 text-cream-50 animate-pulse'
                : 'bg-felt-900/85 border-cream-100/15 text-cream-100'
            }`}
            title="Turn timer"
          >
            <Clock className="w-4 h-4" />
            <span className="text-xs">{isMyActiveTurn ? 'Your turn' : activePlayerName}</span>
            <span className="font-mono text-sm tabular-nums">{remainingSeconds}s</span>
          </div>
        </div>
      )}

      {/* 7. Connection banner (only while we can't reach the game server) */}
      {connectionStatus !== 'connected' && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-[60] pointer-events-none animate-fade-in">
          <div className="flex items-center gap-2 bg-suit-red/95 text-cream-50 text-xs px-4 py-2 rounded-full shadow-soft border border-cream-100/30">
            <Wifi className="w-4 h-4 animate-pulse" />
            Connection lost — reconnecting…
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
