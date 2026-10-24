import { hex } from '../core';
import { timberBase } from './base';

/** Timbercraft: a carved truss arch over each bay (a moon bridge), painted rails. */
export const timbercraft = timberBase('timbercraft', {
  parapet: 'painted',
  truss: true,
  rune: 'ingwaz',
  rail: { lit: hex('#f6b9b0'), shade: hex('#9a6a80') },
});
