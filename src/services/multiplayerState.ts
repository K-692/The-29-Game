import { RealtimeChannel } from '@supabase/supabase-js';
import { CARD_MANIFEST, Suit } from '../assets/cardManifest';
import { 
  checkBotPairDeclaration, 
  getBotBidDecision, 
  getBotCardPlay, 
  getBotTrumpSelection, 
  shouldBotRequestTrumpReveal 
} from '../engine/bot';
import { 
  applyBid, 
  applyCardPlay, 
  applyPairDeclaration, 
  applyTrumpReveal, 
  applyTrumpSelection, 
  completeTrickTransition,
  createInitialGame, 
  getPublicGameState, 
  startNewRound 
} from '../engine/gameManager';
import { 
  GameState, 
  PlayerInfo, 
  PlayerPosition, 
  PublicGameState 
} from '../engine/types';
import { soundManager } from '../common/SoundManager';
import { isSupabaseConfigured, supabase } from './supabase';

export interface MultiplayerController {
  state: GameState;
  publicState: PublicGameState;
  myPosition: PlayerPosition | null;
  isHost: boolean;
  connected: boolean;
  dispatchBid: (bid: number | 'PASS') => void;
  dispatchTrumpSelection: (suit: Suit) => void;
  dispatchTrumpReveal: () => void;
  dispatchCardPlay: (cardId: string) => void;
  dispatchPairDeclaration: () => void;
  dispatchStartGame: () => void;
  dispatchNextRound: () => void;
  dispatchRestartMatch: () => void;
  cleanup: () => void;
}

const STORAGE_SESSION_TOKEN = 'twenty_nine_session_token';

/**
 * Initializes multiplayer synchronization (Supabase Realtime + BroadcastChannel fallback)
 */
export const initMultiplayerSession = (
  roomCode: string,
  players: PlayerInfo[],
  myPlayerId: string,
  onStateUpdate: (state: GameState, publicState: PublicGameState) => void
): MultiplayerController => {
  // Determine user position
  const myPlayer = players.find((p) => p.id === myPlayerId);
  const myPosition: PlayerPosition | null = myPlayer ? myPlayer.position : null;
  const isHost = myPlayer ? myPlayer.isHost : false;

  // Save session token for reconnection
  if (typeof window !== 'undefined' && myPlayer) {
    localStorage.setItem(
      STORAGE_SESSION_TOKEN,
      JSON.stringify({ roomCode, playerId: myPlayer.id, position: myPlayer.position })
    );
  }

  // Master game state
  let currentGameState: GameState = createInitialGame(roomCode, players);
  let isChannelConnected = false;

  // Supabase Channel or BroadcastChannel
  let supabaseChannel: RealtimeChannel | null = null;
  let localBroadcast: BroadcastChannel | null = null;

  const emitState = (newState: GameState) => {
    currentGameState = newState;
    const publicState = getPublicGameState(newState, myPosition);
    onStateUpdate(newState, publicState);

    // Broadcast action/state to peers
    const payload = {
      type: 'STATE_SYNC',
      state: newState,
      timestamp: Date.now(),
    };

    if (supabaseChannel) {
      supabaseChannel.send({
        type: 'broadcast',
        event: 'game_event',
        payload,
      });
    }

    if (localBroadcast) {
      localBroadcast.postMessage(payload);
    }

    // Check if next turn belongs to a CPU player
    checkAndTriggerCpuTurn(newState);
  };

  // Helper to run Bot turn if active turn belongs to CPU
  const checkAndTriggerCpuTurn = (state: GameState) => {
    if (state.phase === 'WAITING_LOBBY' || state.phase === 'ROUND_ENDED' || state.phase === 'MATCH_ENDED') {
      return;
    }

    const activePlayer = state.players.find((p) => p.position === state.currentTurn);
    if (!activePlayer || !activePlayer.isCpu) {
      return;
    }

    // Only host drives CPU bot actions to ensure consistent deterministic state transitions
    if (!isHost) {
      return;
    }

    const cpuPos = state.currentTurn;
    const cpuHand = state.hands[cpuPos] || [];

    // Realistic human-like reaction delay (500 - 800 ms)
    setTimeout(() => {
      if (currentGameState.currentTurn !== cpuPos) return;

      if (currentGameState.phase === 'BIDDING') {
        const isForcedDealer =
          currentGameState.bids.length === 3 &&
          currentGameState.bids.every((b) => b.bid === 'PASS') &&
          cpuPos === currentGameState.dealerIndex &&
          currentGameState.rules.forcedDealerBid;

        const bid = getBotBidDecision(
          cpuHand,
          currentGameState.highestBid,
          currentGameState.rules,
          isForcedDealer
        );
        const res = applyBid(currentGameState, cpuPos, bid);
        if (res.success) {
          soundManager.playBid();
          emitState(res.state);
        }
      } else if (currentGameState.phase === 'TRUMP_SELECTION') {
        const trumpSuit = getBotTrumpSelection(cpuHand);
        const res = applyTrumpSelection(currentGameState, cpuPos, trumpSuit);
        if (res.success) {
          emitState(res.state);
        }
      } else if (currentGameState.phase === 'TRICK_PLAY') {
        // Check if CPU should declare Pair/Royals first
        const canPair = checkBotPairDeclaration(
          cpuHand,
          cpuPos,
          currentGameState.trumpSuit,
          currentGameState.isTrumpRevealed,
          currentGameState.completedTricks,
          currentGameState.pairDeclaration
        );
        if (canPair) {
          const pairRes = applyPairDeclaration(currentGameState, cpuPos);
          if (pairRes.success) {
            emitState(pairRes.state);
          }
        }

        // Check if CPU should request to reveal trump
        const leadCardId = currentGameState.currentTrickCards.length > 0 
          ? currentGameState.currentTrickCards[0].cardId 
          : null;

        const shouldReveal = shouldBotRequestTrumpReveal(
          cpuHand,
          leadCardId,
          currentGameState.trumpSuit,
          currentGameState.isTrumpRevealed,
          currentGameState.currentTrickCards,
          cpuPos
        );

        if (shouldReveal) {
          const revRes = applyTrumpReveal(currentGameState, cpuPos);
          if (revRes.success) {
            soundManager.playTrumpReveal();
            emitState(revRes.state);
          }
        }

        // Play card
        const cardToPlay = getBotCardPlay(
          cpuHand,
          leadCardId,
          currentGameState.trumpSuit,
          currentGameState.isTrumpRevealed,
          currentGameState.currentTrickCards,
          cpuPos
        );

        const playRes = applyCardPlay(currentGameState, cpuPos, cardToPlay);
        if (playRes.success) {
          soundManager.playCardPlay();
          emitState(playRes.state);
          if (playRes.trickCompleted) {
            setTimeout(() => {
              const completedState = completeTrickTransition(playRes.state, playRes.trickCompleted!);
              emitState(completedState);
            }, 1600);
          }
        }
      }
    }, 650);
  };

  // Setup Realtime connection
  if (isSupabaseConfigured && supabase) {
    try {
      supabaseChannel = supabase.channel(`room:${roomCode}`, {
        config: { broadcast: { self: false } },
      });

      supabaseChannel
        .on('broadcast', { event: 'game_event' }, ({ payload }) => {
          if (payload && payload.state) {
            // Apply peer state if newer version
            if (payload.state.version >= currentGameState.version) {
              currentGameState = payload.state;
              const publicState = getPublicGameState(payload.state, myPosition);
              onStateUpdate(payload.state, publicState);
            }
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            isChannelConnected = true;
          }
        });
    } catch (err) {
      console.warn('Realtime channel subscription error:', err);
    }
  }

  // Cross-tab BroadcastChannel fallback
  if (typeof window !== 'undefined' && window.BroadcastChannel) {
    try {
      localBroadcast = new BroadcastChannel(`twenty_nine_channel_${roomCode}`);
      localBroadcast.onmessage = (e) => {
        if (e.data && e.data.state) {
          if (e.data.state.version >= currentGameState.version) {
            currentGameState = e.data.state;
            const publicState = getPublicGameState(e.data.state, myPosition);
            onStateUpdate(e.data.state, publicState);
          }
        }
      };
    } catch {}
  }

  // Public methods to dispatch player moves
  const dispatchBid = (bid: number | 'PASS') => {
    if (myPosition === null) return;
    const res = applyBid(currentGameState, myPosition, bid);
    if (res.success) {
      soundManager.playBid();
      emitState(res.state);
    }
  };

  const dispatchTrumpSelection = (suit: Suit) => {
    if (myPosition === null) return;
    const res = applyTrumpSelection(currentGameState, myPosition, suit);
    if (res.success) {
      emitState(res.state);
    }
  };

  const dispatchTrumpReveal = () => {
    if (myPosition === null) return;
    const res = applyTrumpReveal(currentGameState, myPosition);
    if (res.success) {
      soundManager.playTrumpReveal();
      emitState(res.state);
    }
  };

  const dispatchCardPlay = (cardId: string) => {
    if (myPosition === null) return;
    const res = applyCardPlay(currentGameState, myPosition, cardId);
    if (res.success) {
      soundManager.playCardPlay();
      emitState(res.state);
      if (res.trickCompleted) {
        setTimeout(() => {
          const completedState = completeTrickTransition(res.state, res.trickCompleted!);
          emitState(completedState);
        }, 1600);
      }
    }
  };

  const dispatchPairDeclaration = () => {
    if (myPosition === null) return;
    const res = applyPairDeclaration(currentGameState, myPosition);
    if (res.success) {
      soundManager.playBid();
      emitState(res.state);
    }
  };

  const dispatchStartGame = () => {
    if (!isHost) return;
    const roundState = startNewRound(currentGameState, 0);
    emitState(roundState);
  };

  const dispatchNextRound = () => {
    if (!isHost) return;
    const nextDealer = ((currentGameState.dealerIndex + 1) % 4) as PlayerPosition;
    const nextRoundState = {
      ...startNewRound(currentGameState, nextDealer),
      roundNumber: currentGameState.roundNumber + 1,
    };
    emitState(nextRoundState);
  };

  const dispatchRestartMatch = () => {
    if (!isHost) return;
    let freshGame = createInitialGame(roomCode, players, currentGameState.rules);
    freshGame = startNewRound(freshGame, 0);
    emitState(freshGame);
  };

  const cleanup = () => {
    if (supabaseChannel && supabase) {
      supabase.removeChannel(supabaseChannel);
    }
    if (localBroadcast) {
      localBroadcast.close();
    }
  };

  // Emit initial state
  const initialPublic = getPublicGameState(currentGameState, myPosition);
  onStateUpdate(currentGameState, initialPublic);

  return {
    state: currentGameState,
    publicState: initialPublic,
    myPosition,
    isHost,
    connected: isChannelConnected || true,
    dispatchBid,
    dispatchTrumpSelection,
    dispatchTrumpReveal,
    dispatchCardPlay,
    dispatchPairDeclaration,
    dispatchStartGame,
    dispatchNextRound,
    dispatchRestartMatch,
    cleanup,
  };
};

