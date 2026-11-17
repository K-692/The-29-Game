/**
 * Timeout fallback: when a human's turn timer expires (or a disconnected
 * player's turn comes up) the server makes the same sensible legal move a
 * computer player would.
 */
export {
  getBotTrumpSelection as getAutoTrumpSelection,
  getBotCardPlay as getAutoCardPlay,
} from './bot';
