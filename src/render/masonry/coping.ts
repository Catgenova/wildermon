import type { Pt } from './types';

/**
 * A garden wall's coping: its depth, the stone that straddles a seam, and the seed its cope
 * stones are laid from.
 */

/**
 * A field wall, which is not a house wall cut off at the knees.
 *
 * A fence section is 1.26 m tall against the wall's three, so blitting the
 * wall's picture into it squashed every stone by two and a half and put the
 * band course -- which is the string course at a floor line -- along the top
 * of something that has no floors. What a wall that height actually gets is
 * a coping: a run of stones set on edge along the top, laid last and laid
 * dry, which is the thing that stops the rain getting into the heart of it
 * and the thing that makes a field wall look like a field wall from a
 * hundred yards.
 *
 * It is painted at whatever height the wall type asks for -- a fence, a
 * fence gate and an iron-bound gate are three different heights -- and the
 * number of courses under the coping comes out of the room left over, so
 * the stones are the same size in all of them.
 */
/**
 * How deep the coping is, how deep the levelling course under it is, and
 * the spread of a cope stone's width.
 *
 * The spread is the point. The first coping was twenty stones of one width
 * with one joint between each pair, and twenty of anything at one width is
 * a comb: it read as a picket fence laid on a wall, which is what got the
 * whole asset called sloppy. A dry cope is what came to hand -- a lump, a
 * lump, a packer wedged in sideways because the two lumps did not meet --
 * and the widths have to say that.
 */
/*
 * A fifth of the wall, not a third. A coping is the course that finishes a
 * wall, not a storey of its own: at 42 of 161 it was more than a third of
 * the height and the fence read as two walls, a striped one on a plain one.
 */
export const COPE = 46, LEVEL = 12;

/*
 * How wide a cope stone is, and how far the tops of them vary.
 *
 * A comber is not a tile. It is a stone off the same heap as the wall,
 * stood on edge, and it is comparable in bulk to the stones under it -- at
 * a mean of 22 px against a body stone's 85 it was one to four, which is
 * the ratio of a brick to a block, and the run of them read as a soldier
 * course of brick laid on rubble.
 *
 * `COPE_RISE` is the whole answer to the word sloppy. Every stone had its
 * top at exactly y = 0: four metres of hand-laid dry coping without one
 * stone standing a pixel proud of its neighbour. A machined edge on a thing
 * that is meant to have been laid by eye reads as unfinished, not as neat.
 *
 * And the stones are on edge, which is the whole idea and was the last
 * thing to arrive. At 33 deep and 30 wide every comber came out a loaf
 * lying down -- eleven of twelve wider than tall -- which is a course of
 * small brick, not a cope. A comber is a thin stone stood up, and these
 * are: `COPE` deep against a mean width of `COPE_MEAN`.
 *
 * `PROUD` is the room above the wall the picture is given so that the ones
 * standing over the run have somewhere to be drawn. Without it a stone can
 * only ever sit lower than its neighbours -- twenty-two centimetres of
 * hand-laid variation inside the band and not one pixel of it reaching the
 * sky, so the wall's outline stayed a ruled line and the proud stones read
 * as notches cut into a sawn edge.
 */
export const COPE_MIN = 8, COPE_MEAN = 19, COPE_RISE = 16, PROUD = 10;

/*
 * And the weight of line it is drawn with. At the body's 2.4 px the coping
 * carried twice the ink per unit area of the wall under it -- a quarter of
 * the band was outline -- so from any distance it was a dark busy stripe
 * rather than stone.
 */
export const COPE_INK = 1.1;

/** The one cope stone that straddles a seam, drawn the same in every variant. */
export const COPE_SEAM: Pt = [-14, 17];

/** And the courses of the body that straddle it, as `STRADDLE` does in the tall wall. */
export const LOW_STRADDLE: Record<number, [number, number]> = { 0: [-52, 46], 1: [-38, 62] };

export const LOW_TONE: Record<number, string> = { 0: '', 1: 'brown' };

/** The levelling course straddles too, on a span of its own so the joints stagger. */
export const LEVEL_SEAM: Pt = [-30, 34];

/** The seed a variant's coping is laid from: its widths and its tones, face and top alike. */
export const copeSeed = (v: number): number => v * 911 + 7;
