import type { BeastAct } from '../game/events';

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
export const VOICES: Partial<Record<string, Voice>> = {};
