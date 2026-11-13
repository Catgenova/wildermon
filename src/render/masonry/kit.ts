import { COPE_SEAM } from './coping';
import { BAND, TH, channels, hexA, hexOf, lighten, rand } from './draw';
import { LOGS } from './log';
import type { Block, Lay, Low, Pt, Stock, Tone } from './types';

/**
 * What a masonry's painter reads that depends on the stock it paints: the
 * stock itself, its tones, the lay it is painted through, and the caches
 * kept for one masonry.
 */
export interface Kit {
  S: Stock;
  /** The hooks this stock is painted through. */
  LAY: Lay;
  PASTEL: Record<string, string>;
  TONES: Record<string, Tone>;
  MORTAR: number;
  MUD_CH: number;
  FRAME_OAK: string;
  OAKS: string[];
  LOG_TONES: string[];
  SILVER_INK: string;
  GROUND: string[];
  /** Each marble variant's two columns of slabs, painted once and cut six ways. */
  COLUMNS: Map<number, [HTMLCanvasElement, HTMLCanvasElement]>;
  CSEAM: Pt;
  /** Each picture's gleam (`gleamOf`), worked out once. */
  GLEAMS: WeakMap<HTMLCanvasElement, HTMLCanvasElement>;
  /** Each variant's own stones, as its face was painted: what the foot's moss grows on. */
  STONES: Block[][];
  /** The garden wall at each height asked for, painted once. */
  LOWS: Map<number, Low>;
  /** The road's tiles, once painted. */
  paveTiles: HTMLCanvasElement[] | null;
}

/** The kit for one stock, painted through `LAY`. */
export function makeKit(S: Stock, LAY: Lay): Kit {
  const kit = { S, LAY } as Kit;
  const PASTEL = S.pastel;
  kit.PASTEL = PASTEL;
  const TONES = S.tones;
  kit.TONES = TONES;
  const MORTAR = S.mortar;
  kit.MORTAR = MORTAR;
  /** The height of a course of the brick under the coat. */
  const MUD_CH = (TH - BAND) / S.rows;
  kit.MUD_CH = MUD_CH;
  /** The frame's own oak, which a member that runs through the seams is always cut from. */
  const FRAME_OAK = TONES.dress?.lit ?? PASTEL.dress;
  kit.FRAME_OAK = FRAME_OAK;
  /**
   * The oak one member of the frame is cut from: the frame's own, a step
   * lighter or darker, greyed where it has weathered or warmer where it has
   * not. One brown for every member was a diagram of a frame.
   */
  const OAKS = [
    FRAME_OAK, hexOf(channels(FRAME_OAK).map((c, i) => c + [3, 9, 11][i])), hexOf(channels(FRAME_OAK).map((c, i) => c + [3, -2, -7][i])),
    lighten(FRAME_OAK, 3), lighten(FRAME_OAK, -3),
  ];
  kit.OAKS = OAKS;
  /**
   * The tone a course's log is cut from: pine gone a silvered brown, a step
   * lighter or darker, greyer or warmer, course by course -- the same in
   * every section, so a log runs on through a seam as one log.
   */
  const LOG_TONES = ((): string[] => {
    const R = rand(4391);
    return Array.from({ length: LOGS }, () => {
      const [r, gg, b] = channels(lighten(PASTEL.dress, (R() - 0.5) * 7));
      const warm = (R() - 0.5) * 10;
      return hexOf([r + warm, gg, b - warm]);
    });
  })();
  kit.LOG_TONES = LOG_TONES;
  /** The shade the metal throws on the metal behind it: cool on silver, not the lilac the painted walls share. Only the metals have it. */
  const SILVER_INK = S.lay === 'gild' ? hexA(PASTEL.ink, 0.34) : '';
  kit.SILVER_INK = SILVER_INK;
  /** What the ground behind the panels shows: the sky, the horizon and the lawn, a step off its own satin. */
  const GROUND = [PASTEL.groundSky, PASTEL.groundLine, PASTEL.groundFoot];
  kit.GROUND = GROUND;
  const COLUMNS = new Map<number, [HTMLCanvasElement, HTMLCanvasElement]>();
  kit.COLUMNS = COLUMNS;
  /*
   * And the same on a bond, where the cope is dressed stone in lengths. A
   * straddler the width of a comber between two metre-long copes is a stone
   * somebody dropped in the gap; this one is a length like the rest.
   */
  const CSEAM: Pt = S.lay === 'bond' ? [-46, 52] : COPE_SEAM;
  kit.CSEAM = CSEAM;
  const GLEAMS = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
  kit.GLEAMS = GLEAMS;
  const STONES: Block[][] = [];
  kit.STONES = STONES;
  const LOWS = new Map<number, Low>();
  kit.LOWS = LOWS;
  kit.paveTiles = null;
  return kit;
}
