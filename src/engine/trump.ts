import { Suit } from '../assets/cardManifest';
import { PlayerPosition } from './types';

export interface TrumpState {
  suit: Suit | null;
  isRevealed: boolean;
  revealedBy: PlayerPosition | null;
  revealedAtTrick: number | null;
}

export const initialTrumpState = (): TrumpState => ({
  suit: null,
  isRevealed: false,
  revealedBy: null,
  revealedAtTrick: null,
});

/**
 * Validates bidder's trump selection
 */
export const selectTrump = (
  suit: Suit,
  bidderPosition: PlayerPosition,
  currentTurn: PlayerPosition
): { success: boolean; state?: TrumpState; error?: string } => {
  if (bidderPosition !== currentTurn) {
    return { success: false, error: 'Only the highest bidder can select trump' };
  }

  return {
    success: true,
    state: {
      suit,
      isRevealed: false,
      revealedBy: null,
      revealedAtTrick: null,
    },
  };
};

/**
 * Reveal trump when requested
 */
export const revealTrump = (
  currentState: TrumpState,
  revealedBy: PlayerPosition,
  trickNumber: number
): { success: boolean; state: TrumpState; error?: string } => {
  if (!currentState.suit) {
    return { success: false, state: currentState, error: 'Trump suit has not been selected yet' };
  }

  if (currentState.isRevealed) {
    return { success: false, state: currentState, error: 'Trump has already been revealed' };
  }

  return {
    success: true,
    state: {
      ...currentState,
      isRevealed: true,
      revealedBy,
      revealedAtTrick: trickNumber,
    },
  };
};
