import { BOND_LAY } from './bond';
import { FRAME_LAY } from './frame';
import { GILD_LAY } from './gild';
import { LOG_LAY } from './log';
import { SLAB_LAY } from './marble';
import { ORNATE_LAY } from './ornate';
import { PLANK_LAY } from './plank';
import { RENDER_LAY } from './render';
import { RUBBLE_LAY } from './rubble';
import { STAINED_LAY } from './stained';
import type { Lay, Stock } from './types';

/**
 * Which lay a stock is painted through: one table of hooks per lay, by pattern.
 */

/** Which painter a stock is laid by: its lay, and on a bond what it is laid for. */
export type Pattern = 'rubble' | 'bond' | 'ornate' | 'slab' | 'stained' | 'render' | 'frame' | 'log' | 'plank' | 'gild';

export function patternOf(S: Stock): Pattern {
  if (S.lay !== 'bond') return S.lay;
  return S.stained ? 'stained' : S.slab ? 'slab' : S.ornate ? 'ornate' : 'bond';
}

/** The lay each pattern is painted through, one module to a lay. */
export const LAYS: Record<Pattern, Lay> = {
  rubble: RUBBLE_LAY,
  bond: BOND_LAY,
  ornate: ORNATE_LAY,
  slab: SLAB_LAY,
  stained: STAINED_LAY,
  render: RENDER_LAY,
  frame: FRAME_LAY,
  log: LOG_LAY,
  plank: PLANK_LAY,
  gild: GILD_LAY,
};
