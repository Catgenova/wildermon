/**
 * The sign-in page's tracks, apart from `playlist.ts` so that page does not
 * carry the island's clock (and the game rules behind it) to read none of it.
 */
import type { Track } from './score';
import { COVE } from './tracks/cove';

export const SIGN_IN_TRACKS: readonly Track[] = [COVE];
