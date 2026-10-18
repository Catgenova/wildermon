import type { BeastAct } from '../game/events';
import { CHIP_VOICE } from './voice-chip';
import { IRON_VOICE } from './voice-iron';
import { SNUFF_VOICE } from './voice-snuff';
import { SPORE_VOICE } from './voice-spore';

/**
 * Wildermon voices.
 *
 * Every sound on the island is made as it is played, out of oscillators and
 * filtered noise (`./kit`), and so is a wildermon's: a voice is a few cues,
 * one for each act it has a sound for -- a strike, a go at its task, its
 * ability, evolving -- each played where it stands, at the stage it is at
 * (a bigger body, a deeper voice) and with a little variety (`v`, nought to
 * one) so a herd is not one animal repeated. A kind with no voice here is
 * heard as it always was: its blows and its work, and nothing of its own.
 */
export type Cue = (ctx: BaseAudioContext, dest: AudioNode, at: number, stage: number, v: number) => void;
export type Voice = Partial<Record<BeastAct, Cue>>;

/** Each kind's voice, by species. */
export const VOICES: Partial<Record<string, Voice>> = {
  // The Snufflet, the Snuffroot and the Snuffthorn.
  rabba: SNUFF_VOICE,
  // The Ironemole, the Ferrodrill and the Oremander.
  mola: IRON_VOICE,
  // The Chiptail, the Quarrybash and the Monolithump.
  quarra: CHIP_VOICE,
  // The Sporeling, the Sporekin and the Sporelord.
  vola: SPORE_VOICE,
};
