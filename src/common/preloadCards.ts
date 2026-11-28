import { CARD_MANIFEST, getCardSvgUrl } from '../assets/cardManifest';

const keep: HTMLImageElement[] = [];

/**
 * Downloads and decodes every card face up front, so a card played by
 * anyone appears with its face immediately instead of an empty frame first.
 */
export const preloadCardImages = (): void => {
  if (typeof window === 'undefined' || keep.length) return;
  const ids = [...Object.keys(CARD_MANIFEST), 'CARD_BACK', '6_HEARTS', '6_SPADES', '6_CLUBS', '6_DIAMONDS'];
  for (const id of ids) {
    const img = new Image();
    img.decoding = 'async';
    img.src = getCardSvgUrl(id);
    img.decode?.().catch(() => {});
    keep.push(img);
  }
};
