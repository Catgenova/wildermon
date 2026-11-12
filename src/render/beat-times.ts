/**
 * How long a wildermon's acts take to play through, read by its drawing
 * (`beasts.ts`, which says it on) and by its voice (`../audio/voice-*.ts`)
 * alike. A leaf, so a voice can time its sounds without loading the drawing.
 */
import type { BeastAct } from '../game/events';

/** How long each act takes to play through, in seconds. */
export const ACT_SECS: Record<BeastAct, number> = { strike: 0.55, work: 1.1, cast: 0.9, evolve: 1.8 };
