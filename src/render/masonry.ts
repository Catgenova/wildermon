import { LOG as LOG_HUE, MARBLE as MARBLE_HUE, PLANK as PLANK_HUE } from './materials';
import { CAP_H, TH, TW, channels, lighten } from './masonry/draw';
import { makeKit } from './masonry/kit';
import { LAYS, patternOf } from './masonry/lays';
import { low } from './masonry/low';
import { NEUTRAL, PAVE_N, pave } from './masonry/pave';
import { PAD, archIvyPictures, archPictures, archWeedPictures, basePictures, bayPictures, capPicture, doorIvyPictures, doorPictures, doorWeedPictures, endsFootPicture, endsPicture, facePictures, footPictures, gateIvyPictures, gatePictures, gateWeedPictures, gleamOf, spillPictures, winIvyPictures, winWeedPictures, windowPictures } from './masonry/textures';
import type { Masonry, Stock, Tone } from './masonry/types';
import { VARIANTS } from './masonry/variants';
export { ARCH, BAY, DOOR, DOUBLE, FENCE_GAP, WINDOW } from './masonry/openings';
export type { Low, Masonry } from './masonry/types';

/**
 * Cobblestone, five ways, one seam.
 *
 * A cobblestone wall used to be a flat colour with a few ruled lines on it.
 * What it is now is a picture of one: the blocks a novice laid and the weather
 * has been at since, the ivy that has got over the top of it, the hedge grown
 * up its foot. The pictures are painted once, into canvases, and the renderer
 * fills the wall's faces with them; nothing here knows about the camera.
 *
 * Five of them, and they are interchangeable because they all keep one
 * contract at their edges. Sideways: on three of the four courses, and on the
 * band, a stone straddles the seam, drawn to the same shape and tone in every
 * variant, and the fourth course leaves a joint there no wider than any other,
 * so no two courses have an edge in the same place at a seam. Upwards: each
 * storey is a band course over four courses of blocks, so any variant stacks
 * on any variant and the band reads as the string course at each floor.
 *
 * What grows depends on where in the wall it is, so it is not painted into the
 * face. `spill` is the ivy, which belongs to the top storey, and is painted
 * taller than a face so the crest of it stands above the cap; `base` is the
 * hedge and `foot` the damp, which belong to the ground storey. Nothing that
 * is one variant's own comes within `MARGIN` of a seam.
 *
 * How things are drawn: every mass of growth is lobes the size of leaf
 * clusters under a dark olive line, lit from above -- a pale crown, a green
 * middle, a dark underside -- and every block is two flat tones with a bevel
 * along its top and the dark of its line only where the light leaves it. The
 * greens are sampled off the castle art the island is meant to sit beside.
 */


/* ---- the two masonries -------------------------------------------------- */
/**
 * Cobblestone, sampled off the castle art the island is meant to sit beside.
 */
const RUBBLE_PASTEL: Record<string, string> = {
  grass: '#90cfb1', shade: '#7fbca6', sand: '#f3d192', cream: '#f4ecd5',
  // stone, sampled off the castle: light, mid, and the joints between
  stone: '#cbc0b0', stoneShade: '#aba796', stoneDark: '#a19d8d', joint: '#aeaa9c',
  dark: '#b5b1a0',
  warm: '#ccbea3', warmShade: '#ae9f84',
  /*
   * The stone of an opening, which is stone that was picked over rather
   * than picked up, and the mortar packed in behind it.
   *
   * It is a real step lighter than the field and the mortar a real step
   * darker than the field's, because at the far zoom a ring drawn in the
   * field's own tones is nine pixels of wall doing nothing: the arch goes
   * and a grey slab with a hole in it is left. `reveal` is what the wall's
   * own thickness shows in the way through -- warm, because a face turned
   * from the light loses light and not colour.
   */
  dress: '#ded5c4', dressShade: '#bbb0a0', dressHi: '#efe8dc',
  ringJoint: '#a09a8a', reveal: '#b3ab97',
  /*
   * And the one piece of wood in the whole wall.
   *
   * A window gets a stone lintel and a course of wedges over it because a
   * window is small. A doorway is not, and a man who cannot cut a voussoir
   * is not going to find and dress a stone four feet long either: he lays a
   * baulk of oak across it and builds on top of that. It is the only thing
   * in the picture that is not stone, and that is the point of it.
   */
  beam: '#b0906a', beamShade: '#927757', beamHi: '#c3a681', beamLine: '#6d5840',
  // the lit top bevel of each block: its own lit tone, a step lighter
  stoneHi: '#ddd4c6', warmHi: '#d9cdb3', darkHi: '#bdb9aa', bandHi: '#e3dbcc',
  blush: '#f2c4c0', blushShade: '#dfa39e', blushLine: '#b9797a',
  // moss as a stain: the stone's tones pulled half way to the leaf's
  stain: '#8ca995', stainShade: '#7c9286',
  band: '#d3c9b8', bandShade: '#b5ae9e', line: '#94896c',
  /*
   * Greens. They were sampled off the castle the stone is sampled off, and
   * they have since been turned the same two turns the whole island took:
   * round into the teal, then ten degrees back towards green and darker
   * with it. Sampled off a picture is where they came from and not what
   * they are any more -- a wall stands in this field, not in that one.
   * Their line is still a deeper version of themselves.
   */
  leaf: '#6bac7e', leafShade: '#6d9981', leafDeep: '#5c8273', leafPale: '#7cc38e', leafLine: '#507b5f',
  creamShade: '#dacdb3', creamLine: '#9a8e70',
};

const RUBBLE: Stock = ((P) => ({
  pastel: P,
  tones: {
    '':    { lit: P.stone, shade: P.stoneShade, hi: P.stoneHi },
    warm:  { lit: '#c6bdab', shade: '#a89d8b', hi: '#d3cabb' },
    dress: { lit: P.dress, shade: P.dressShade, hi: P.dressHi },
    brown: { lit: '#c6bba8', shade: '#a89e8c', hi: '#d0c6b5' },
    green: { lit: '#bdc09b', shade: '#a0a37f', hi: '#cccfaa' },
    dark:  { lit: '#bdb9a9', shade: '#a5a192', hi: '#c8c4b5' },
    /*
     * The two the coping needs and the field does not.
     *
     * The wall's four tones sit inside seven steps of luminance of each
     * other, which on a body course is right -- a wall is one heap of stone
     * -- and on a coping is a flat stripe, because there are three times as
     * many stones to the metre and nowhere for the eye to land. `weather` is
     * a stone the rain has had thirty years of, a real thirty-five steps
     * down; `bleach` is one that has been face up at the sun as long.
     */
    weather: { lit: '#a89e8a', shade: '#8e8674', hi: '#bdb29e' },
    bleach:  { lit: '#dcd3c2', shade: '#bdb5a4', hi: '#ece5d7' },
    flat:  { lit: P.band, shade: P.bandShade, hi: P.bandHi },
  },
  lay: 'rubble',
  rows: 4,
  across: 6,
  headers: 0,
  base: ['plinth', 'dress'],
  mortar: 3,
  bandN: 4,
  plinth: 0,
  wear: 1,
  shade: [24, 20, 12],
  shadow: (k) => (1 - k) * 0.85,
  growth: true,
  mix: [['warm', 0.07], ['brown', 0.09], ['green', 0.04], ['dark', 0.1]],
  pairs: ['warm', 'brown'],
  field: [['weather', 0.2], ['bleach', 0.12], ['warm', 0.12], ['brown', 0.1], ['green', 0.1], ['dark', 0.1]],
}))(RUBBLE_PASTEL);

/**
 * And brickwork.
 *
 * The red is the brick itself and everything else on the wall is one cut
 * stone, cool and a step down in value from it: the band at each floor line,
 * the plinth at the ground, the coping of a garden wall, and every jamb,
 * lintel and voussoir of every opening. Two materials, one warm and one cool,
 * and the dressings read at any distance because of it -- which is what a
 * mason is doing when he dresses a brick wall in stone.
 *
 * The greens, the oak of a door head and the road are the cobblestone set's,
 * because ivy is ivy and oak is oak whatever they are growing on.
 */

/**
 * The field brick at seven values two points of lightness apart, for the
 * firing to choose between.
 *
 * `f` is a unit laid flush with its neighbours: the shade along its lower
 * edge is three points down and barely there, because a wall of brick with a
 * dark bevel under every one of them is a wall of sweets. `p` is the odd one
 * standing a hair proud of the face, which is the one that earns the shadow.
 */
function values(base: string, step = 2): Record<string, Tone> {
  const out: Record<string, Tone> = {};
  for (let k = -3; k <= 3; k++) {
    out['f' + k] = { lit: lighten(base, step * k), shade: lighten(base, step * k - 3), hi: lighten(base, step * k + 5) };
    out['p' + k] = { lit: lighten(base, step * k), shade: lighten(base, step * k - 8), hi: lighten(base, step * k + 6) };
  }
  return out;
}

const BRICK_PASTEL: Record<string, string> = {
  ...RUBBLE_PASTEL,
  // the brick itself: the field tone, its shade, and the bevel along its top
  stone: '#c47c6e', stoneShade: '#ad5e52', stoneHi: '#d09080', stoneDark: '#8b514b',
  // a sandier one off the same kiln, and one over-fired grey and gone to mauve
  warm: '#c89e89', warmShade: '#b0816d', warmHi: '#d4b09b',
  dark: '#886364', darkHi: '#9b6f6f',
  // the mortar it is bedded in, a step under the brick, and the ink round every unit
  joint: '#8e6f67', line: '#7e4a44',
  /*
   * The cut stone: the dressings of an opening, and the band at a floor line.
   *
   * A chalky slate, half the saturation the first lavender had. At that
   * chroma the trim was a violet line ruled round every edge of a building
   * -- a brick-textured box outlined in purple -- where cut stone on a brick
   * wall is the quieter of the two materials, not the louder. The band is a
   * step warmer and lighter than the rest, nearer the brick it runs through,
   * so a three-storey face is not a stack of matching stripes.
   */
  dress: '#7f7c8d', dressShade: '#696675', dressHi: '#9491a1',
  band: '#96888f', bandShade: '#7f7178', bandHi: '#a79aa1',
  ringJoint: '#7b5d56', reveal: '#5f5c6a',
  // and brick with moss in it: the field pulled half way to the leaf
  stain: '#a99b7e', stainShade: '#928768',
};

const BRICK: Stock = ((P) => ({
  pastel: P,
  tones: {
    '':      { lit: P.stone, shade: P.stoneShade, hi: P.stoneHi },
    ...values(P.stone),
    /*
     * The units off another part of the kiln, and every one of them inside
     * eight points of the field's own lightness. A swap further off than that
     * is a hole in the wall at the zoom it is played at, and one in three of
     * them was the whole of an art director's first two complaints.
     */
    warm:    { lit: lighten(P.stone, 7), shade: lighten(P.stone, 3), hi: lighten(P.stone, 12) },
    brown:   { lit: '#ad766f', shade: lighten('#ad766f', -4), hi: lighten('#ad766f', 5) },
    burnt:   { lit: '#a77677', shade: lighten('#a77677', -4), hi: lighten('#a77677', 5) },
    weather: { lit: lighten(P.stone, -7), shade: lighten(P.stone, -11), hi: lighten(P.stone, -2) },
    bleach:  { lit: lighten(P.stone, 7), shade: lighten(P.stone, 3), hi: lighten(P.stone, 11) },
    /*
     * And the cut stone. `dark` and `green` are what the openings ask for
     * when they want a darker stone or one with the moss in it, so on a bond
     * they are the dressings' own -- a jamb here takes a brick's tone and it
     * is a brick in the wrong place.
     */
    dress:   { lit: P.dress, shade: P.dressShade, hi: P.dressHi },
    plinth:  { lit: '#6d6b7b', shade: '#5a5865', hi: '#7d7b8e' },
    dark:    { lit: '#6d6b7b', shade: '#5a5865', hi: '#7d7b8e' },
    green:   { lit: '#757f84', shade: '#626b6f', hi: '#879197' },
    flat:    { lit: P.band, shade: P.bandShade, hi: P.bandHi },
    // the top of a course of it, turned up at the sky
    top:     { lit: lighten(P.band, 9), shade: lighten(P.band, 3), hi: lighten(P.band, 14) },
  },
  lay: 'bond',
  /*
   * Ten courses of six, which is a brick of 85 by 30 px -- 66 cm by 23, or
   * about three and a half times life size.
   *
   * Real brick at 128 px to the metre is thirty-one courses of nothing
   * anybody can see, and twelve courses of seven -- the first try at it --
   * was eighty-four outlined units to a section, which at the zoom the game
   * is played at is not a wall but a texture. This is the scale the
   * cobblestone beside it is already drawn at: about three times life, and
   * long and thin enough against those near-square blocks that the two
   * masonries tell apart from across a deed.
   */
  rows: 10,
  across: 6,
  headers: 4,
  base: ['plinth', 'dress'],
  // A brick wall shows more mortar than a rubble one: the joint is most of what
  // says brick, because every unit is the same size and the joints are the drawing.
  mortar: 3,
  bandN: 6,
  /*
   * And a plinth at the ground, six courses of the body tall.
   *
   * It is the one thing the reference has that a wall of one material cannot:
   * a heavy cut-stone base the brick is stood on, which is where the weight
   * of the picture is. It is painted with the ground storey's damp, so it
   * only ever shows out of doors and stops at a doorway, which is where a
   * plinth actually stops.
   */
  plinth: 106,
  /*
   * A sixth of the wear. Rubble is what the field gave up and a frost gets
   * into it; a brick was fired to take that. What it does get is a chipped
   * arris, a crack, and the odd one gone -- not a spalled face, and not a
   * pit or a chip on every other unit, which at a third of rubble's rate was
   * still enough specks across a section to read as grit on the picture.
   */
  wear: 0.17,
  shade: [18, 12, 84],
  shadow: (k) => (1 - k) * 0.85,
  growth: true,
  /*
   * Three units in ten off the field's own tone, not four and a half.
   *
   * At the wider mix the wall came out a mosaic: a pale unit, a sandy one, an
   * olive one and a burnt one all inside two courses, which is a crazy
   * pavement stood on end. What a brick wall actually is is one hue in a
   * dozen values, and the values have to sit close enough that the field
   * reads as a field before any one unit reads as itself.
   */
  // What the end grain rolls, which is the one place a bond still draws on it.
  mix: [['warm', 0.08], ['brown', 0.08], ['burnt', 0.05]],
  pairs: ['warm', 'brown', 'burnt'],
  field: [['weather', 0.3], ['bleach', 0.25], ['warm', 0.25], ['brown', 0.2]],
}))(BRICK_PASTEL);

/**
 * And stone brick: cut stone, dressed square and laid to a line.
 *
 * The heaviest masonry on the island and the tallest it will stand, so the
 * unit is big -- a block a metre long and not quite half a metre high, seven
 * courses to a storey and four blocks to a section, half again the size of a
 * brick at the scale the island is painted at -- and the joint is thin,
 * because a block cut true needs little bedding. It is laid in stretchers
 * only: headers are what a brick wall is bonded with, and a block of stone
 * is bonded through its own depth.
 *
 * The field is a cool, chalky blue-grey, the quarry's own, a dozen values of
 * it with a bed here and there warmer or bluer and the odd block with iron
 * in it. The dressings -- the band at each floor, the quoins, every jamb,
 * lintel, sill and voussoir -- are a pale warm limestone, so a house of it
 * reads as cool stone trimmed in warm, the brick's scheme turned round; and
 * it stands on a plinth of the same blue stone a step darker, where the wet
 * off the ground keeps it.
 */
const STONE_PASTEL: Record<string, string> = {
  ...RUBBLE_PASTEL,
  // the block: its field tone, its shade, the bevel along its top, and its darkest
  stone: '#aeb2c0', stoneShade: '#999dac', stoneHi: '#c2c6d2', stoneDark: '#7c8092',
  // a buff bed out of the same quarry, and a darker blue one
  warm: '#bbb5ad', warmShade: '#a6a098', warmHi: '#cbc6bf',
  dark: '#8e92a2', darkHi: '#9ea2b2',
  // the joint, a step under the block, and the ink round every one
  joint: '#8c8e9c', line: '#6b6d7d',
  // the limestone it is dressed in, and the band of it at a floor line
  dress: '#d8cfbc', dressShade: '#c0b5a1', dressHi: '#e7e0d2',
  band: '#d3c9b5', bandShade: '#b9ae99', bandHi: '#e2dac9',
  ringJoint: '#8c8e9c', reveal: '#7b7e8e',
  // and a block the rain off a band has stained, pulled toward the lichen
  stain: '#b3b5a6', stainShade: '#9ea090',
};

const STONE: Stock = ((P) => ({
  pastel: P,
  tones: {
    '':      { lit: P.stone, shade: P.stoneShade, hi: P.stoneHi },
    ...values(P.stone),
    /*
     * The beds a quarry gives up besides its own, every one inside eight
     * points of the field. The bond asks for them by the kiln's names, and
     * on stone they are the quarry's: `warm` a buff bed, `burnt` a bluer,
     * darker one, and `brown` the odd block with iron in it.
     */
    warm:    { lit: P.warm, shade: P.warmShade, hi: P.warmHi },
    burnt:   { lit: '#9da4b7', shade: lighten('#9da4b7', -5), hi: lighten('#9da4b7', 6) },
    brown:   { lit: '#bdb0a0', shade: lighten('#bdb0a0', -5), hi: lighten('#bdb0a0', 6) },
    weather: { lit: lighten(P.stone, -7), shade: lighten(P.stone, -11), hi: lighten(P.stone, -2) },
    bleach:  { lit: lighten(P.stone, 7), shade: lighten(P.stone, 3), hi: lighten(P.stone, 11) },
    // The limestone, in the two tones its dressings turn about in.
    dress:   { lit: P.dress, shade: P.dressShade, hi: P.dressHi },
    plinth:  { lit: '#cdc2ad', shade: '#b4a894', hi: '#ddd4c3' },
    dark:    { lit: '#cdc2ad', shade: '#b4a894', hi: '#ddd4c3' },
    green:   { lit: P.stain, shade: P.stainShade, hi: lighten(P.stain, 8) },
    // And the footing: the blue stone a step darker, in two beds.
    foot:    { lit: '#8f93a3', shade: '#7b7f8f', hi: '#a1a5b4' },
    footB:   { lit: '#999aa6', shade: '#84858f', hi: '#aaabb6' },
    flat:    { lit: P.band, shade: P.bandShade, hi: P.bandHi },
    top:     { lit: lighten(P.band, 6), shade: lighten(P.band, 1), hi: lighten(P.band, 10) },
  },
  lay: 'bond',
  rows: 7,
  across: 4,
  headers: 0,
  base: ['foot', 'footB'],
  mortar: 2,
  bandN: 4,
  plinth: 96,
  // Cut stone chips at an arris and cracks along a bed; it does not crumble.
  wear: 0.3,
  shade: [30, 28, 74],
  shadow: (k) => (1 - k) * 0.85,
  growth: false,
  mix: [['warm', 0.07], ['burnt', 0.06], ['brown', 0.03]],
  pairs: ['warm', 'burnt'],
  field: [['weather', 0.3], ['bleach', 0.25], ['warm', 0.25], ['burnt', 0.2]],
}))(STONE_PASTEL);

/**
 * And marble: white, and laid by a master.
 *
 * A house of it is faced in great slabs -- two to a section across and two
 * courses to a storey, on joints a hair wide -- and each column of two was
 * sawn from its own block, so its veins run on over the bed joint into the
 * course below: a surface divided by joints rather than built up of them.
 * Nothing in it is matched to anything else, because a wall of slabs
 * opened like a book is a row of ink blots. The white is cool, clouded with
 * grey, and veined in a web of fine crinkled grey threads with hairlines of
 * pale gold. Its dressings -- the moulded band at each floor,
 * the strip down each corner, the architraves, hoods and sills of its
 * openings, and the plinth -- are a dove-grey marble veined a step darker.
 * A garden wall of it is laid in courses of blocks the size of great
 * bricks, each veined on its own, under a cope of the dove grey.
 */
const MARBLE_PASTEL: Record<string, string> = {
  ...RUBBLE_PASTEL,
  // the white, cool: its field tone, its shade, the light along an arris, and its darkest
  stone: MARBLE_HUE.stone, stoneShade: MARBLE_HUE.shade, stoneHi: MARBLE_HUE.hi, stoneDark: MARBLE_HUE.dark,
  // a bed a step whiter and one a step greyer, out of the same quarry: one cool family, never cream
  warm: '#f1f3f5', warmShade: '#e4e7eb', warmHi: '#f9fafb',
  dark: '#e2e5e9', darkHi: '#eef0f3',
  // the joint, a hair wide, and the ink round every piece: a soft cool grey, never dark
  joint: MARBLE_HUE.joint, line: MARBLE_HUE.line,
  // the dove grey it is dressed in, and the band of it at a floor line
  dress: '#bec2c9', dressShade: '#adb1b9', dressHi: '#d1d4da',
  band: '#c6c9d0', bandShade: '#b4b8c0', bandHi: '#d8dbe0',
  ringJoint: '#b6bac1', reveal: '#d3d6db',
  /*
   * The veins, pale as the reference's are: the grey the clouds and the
   * bleed are laid in, a primary's core and its soft edge, a knot where it
   * runs darker, a lesser thread, the gold, and the grey the dove grey's own
   * veins are taken toward.
   */
  veinSoft: '#c9d0da', vein: '#c6cad3', veinEdge: '#d0d4dc', veinDeep: '#b2b7c2', veinFaint: '#d4d8df',
  veinGold: '#e2dbce', veinDark: '#6f7580',
  // the joint between two slabs: a hair on the stone, and a grey only a little under the white
  slabJoint: '#dee2e7',
  stain: '#dcdcd6', stainShade: '#cecfc9',
};

const MARBLE: Stock = ((P) => ({
  pastel: P,
  tones: {
    '':      { lit: P.stone, shade: P.stoneShade, hi: P.stoneHi },
    ...values(P.stone, 1),
    // The beds besides the white, every one within four steps of it at its own hue.
    warm:    { lit: P.warm, shade: P.warmShade, hi: P.warmHi },
    burnt:   { lit: '#e8ebee', shade: lighten('#e8ebee', -5), hi: lighten('#e8ebee', 4) },
    brown:   { lit: '#eaedf0', shade: lighten('#eaedf0', -5), hi: lighten('#eaedf0', 3) },
    weather: { lit: lighten(P.stone, -3), shade: lighten(P.stone, -7), hi: lighten(P.stone, 3) },
    bleach:  { lit: lighten(P.stone, 3), shade: lighten(P.stone, -1), hi: lighten(P.stone, 6) },
    // The dove grey, in the two tones its dressings turn about in.
    dress:   { lit: P.dress, shade: P.dressShade, hi: P.dressHi },
    plinth:  { lit: '#b4b8c0', shade: '#a3a7b0', hi: '#c6c9cf' },
    dark:    { lit: '#b4b8c0', shade: '#a3a7b0', hi: '#c6c9cf' },
    green:   { lit: P.stain, shade: P.stainShade, hi: lighten(P.stain, 6) },
    // And the plinth: the dove grey a step darker, in two beds.
    foot:    { lit: '#aeb2ba', shade: '#9ca0a9', hi: '#c0c3ca' },
    footB:   { lit: '#b6bac2', shade: '#a4a8b0', hi: '#c7cad0' },
    flat:    { lit: P.band, shade: P.bandShade, hi: P.bandHi },
    top:     { lit: lighten(P.band, 6), shade: lighten(P.band, 1), hi: lighten(P.band, 10) },
  },
  lay: 'bond',
  // What a garden wall of it is laid in: blocks of no set length, five to a
  // section, a little under a third of a metre high.
  rows: 9,
  across: 5,
  headers: 0,
  base: ['foot', 'footB'],
  mortar: 2,
  bandN: 2,
  plinth: 72,
  wear: 0.05,
  // A cool blue-grey: white stone turned from the light goes toward the sky's colour, not to grey.
  shade: [42, 46, 74],
  shadow: (k) => (1 - k) * 0.8,
  growth: false,
  mix: [['warm', 0.08], ['burnt', 0.06], ['brown', 0.04]],
  pairs: [],
  field: [['warm', 0.4], ['burnt', 0.35], ['brown', 0.25]],
  master: true,
  slab: true,
}))(MARBLE_PASTEL);

/**
 * And stained glass: panes of coloured glass, a gem ground into each melt,
 * leaded into panels and set in a frame of ivory marble.
 *
 * The glass is the island's own pastels with the light behind them -- pink,
 * peach, lemon, mint, aqua, sky, lilac, rose, sage and cream -- each pane
 * streaked as a sheet of cathedral glass is, in leads of a cool dark grey.
 * The marble round it is warm where the house marble is cool, and its veins
 * run to gold.
 */
const STAINED_PASTEL: Record<string, string> = {
  ...MARBLE_PASTEL,
  stone: '#ebe4d5', stoneShade: '#ddd5c4', stoneHi: '#f6f1e7', stoneDark: '#cfc6b3',
  warm: '#efe9dc', warmShade: '#e1d9c9', warmHi: '#f8f4ec',
  dark: '#e0d8c8', darkHi: '#ece5d8',
  joint: '#cfc7b6', line: '#a39a86',
  dress: '#e6dece', dressShade: '#d6ccb9', dressHi: '#f3eee3',
  band: '#e8e1d1', bandShade: '#d6cdb9', bandHi: '#f5f0e5',
  ringJoint: '#cfc7b6', reveal: '#ddd5c5',
  veinSoft: '#ddd3c2', vein: '#d8cdb9', veinEdge: '#e2d9c9', veinDeep: '#c9bca5', veinFaint: '#e6dece',
  veinGold: '#e3cf9d', veinDark: '#8a7f6c',
  slabJoint: '#e1d9ca',
  stain: '#ddd8c9', stainShade: '#cfc9b9',
  // The glass, pale as a sheet of it is with the light behind it, and the lead it is set in.
  glassPink: '#f4bccb', glassPeach: '#f7d0ae', glassLemon: '#f5e6a2', glassMint: '#bfe5cf', glassAqua: '#a9ddd9',
  glassSky: '#b0caee', glassLilac: '#cdb9e8', glassRose: '#eea9bb', glassSage: '#d3e4b3', glassCream: '#f6eedb',
  lead: '#4c5058',
};

const STAINED: Stock = ((P) => ({
  pastel: P,
  tones: {
    '':      { lit: P.stone, shade: P.stoneShade, hi: P.stoneHi },
    ...values(P.stone, 1),
    warm:    { lit: P.warm, shade: P.warmShade, hi: P.warmHi },
    burnt:   { lit: '#e7e0d1', shade: lighten('#e7e0d1', -5), hi: lighten('#e7e0d1', 4) },
    brown:   { lit: '#e9e2d4', shade: lighten('#e9e2d4', -5), hi: lighten('#e9e2d4', 3) },
    weather: { lit: lighten(P.stone, -3), shade: lighten(P.stone, -7), hi: lighten(P.stone, 3) },
    bleach:  { lit: lighten(P.stone, 3), shade: lighten(P.stone, -1), hi: lighten(P.stone, 6) },
    dress:   { lit: P.dress, shade: P.dressShade, hi: P.dressHi },
    plinth:  { lit: '#d9d0bd', shade: '#c9bfab', hi: '#e6dfd0' },
    dark:    { lit: '#d9d0bd', shade: '#c9bfab', hi: '#e6dfd0' },
    green:   { lit: P.stain, shade: P.stainShade, hi: lighten(P.stain, 6) },
    foot:    { lit: '#d4cab6', shade: '#c3b9a4', hi: '#e2dac9' },
    footB:   { lit: '#dbd2c0', shade: '#cac0ad', hi: '#e7e0d2' },
    flat:    { lit: P.band, shade: P.bandShade, hi: P.bandHi },
    top:     { lit: lighten(P.band, 5), shade: lighten(P.band, 1), hi: lighten(P.band, 8) },
  },
  lay: 'bond',
  rows: 9,
  across: 5,
  headers: 0,
  base: ['foot', 'footB'],
  mortar: 2,
  bandN: 2,
  plinth: 72,
  wear: 0.05,
  shade: [42, 46, 74],
  shadow: (k) => (1 - k) * 0.8,
  growth: false,
  mix: [['warm', 0.08], ['burnt', 0.06], ['brown', 0.04]],
  pairs: [],
  field: [['warm', 0.4], ['burnt', 0.35], ['brown', 0.25]],
  master: true,
  slab: true,
  stained: true,
}))(STAINED_PASTEL);

/**
 * And slate: an ornate black brick, the island's grandest dark masonry.
 *
 * The brick is slate cut to a brick's size, a chalky blue-black -- never
 * black -- a dozen values of it with a plum bed and a green one out of the
 * same quarry, and a sheen along the top of every brick where the dense
 * stone takes the light. It is laid for show: in Flemish bond, a stretcher
 * and a header turn about in every course; the headers picked out in violet
 * slate to draw a diaper of great lozenges over the field; and under the
 * band at the head of every storey a course of dogtooth, the bricks set
 * corner-out so the course is a row of teeth. Its dressings -- the band,
 * the quoins, the jambs and the arches, the sills and the plinth -- are a
 * pale silver-lilac slate, so the dark field is framed wherever it stops.
 */
const SLATE_PASTEL: Record<string, string> = {
  ...RUBBLE_PASTEL,
  // the brick: its field tone, its shade, the sheen along its top, and its darkest
  stone: '#4f5369', stoneShade: '#44475c', stoneHi: '#666a84', stoneDark: '#3b3e51',
  // a plum bed out of the same quarry, and a darker blue one
  warm: '#544f69', warmShade: '#49455d', warmHi: '#686380',
  dark: '#43465a', darkHi: '#555970',
  // the joint, a step over the brick, and the ink round every one: a deep indigo, never black
  joint: '#6a6c84', line: '#34364a',
  // the pale slate it is dressed in, and the band of it at a floor line
  dress: '#aeb0c4', dressShade: '#9799ae', dressHi: '#c4c6d6',
  band: '#b4b6c8', bandShade: '#9ea0b4', bandHi: '#c8cad8',
  ringJoint: '#6a6c84', reveal: '#3a3c50',
  // the violet of the diaper's headers, and a lighter one for the voussoirs that carry it into the dressings
  diaper: '#625d88', vous: '#7b76a0',
  // the dogtooth: the face of a tooth turned to the light, the one turned from it, and the dark between them
  toothLit: '#8d8fa8', toothShade: '#4b4e64', recess: '#303247',
  stain: '#5d6072', stainShade: '#52556a',
};

const SLATE: Stock = ((P) => ({
  pastel: P,
  tones: {
    '':      { lit: P.stone, shade: P.stoneShade, hi: P.stoneHi },
    ...values(P.stone, 1.3),
    /*
     * The beds a quarry gives up besides its own, every one inside a few
     * points of the field: `warm` a plum slate, `burnt` a bluer, darker one,
     * and `brown` a blue one a step off the field. Nothing green: on a wall
     * that carries no planting a green brick is a patch of moss.
     */
    warm:    { lit: P.warm, shade: P.warmShade, hi: P.warmHi },
    burnt:   { lit: '#474b62', shade: lighten('#474b62', -4), hi: lighten('#474b62', 8) },
    brown:   { lit: '#4a4f68', shade: lighten('#4a4f68', -4), hi: lighten('#4a4f68', 8) },
    weather: { lit: lighten(P.stone, -4), shade: lighten(P.stone, -7), hi: lighten(P.stone, 4) },
    bleach:  { lit: lighten(P.stone, 5), shade: lighten(P.stone, 2), hi: lighten(P.stone, 11) },
    // The pale slate, in the two tones its dressings turn about in.
    dress:   { lit: P.dress, shade: P.dressShade, hi: P.dressHi },
    plinth:  { lit: '#9a9cb2', shade: '#8587a0', hi: '#aeb0c4' },
    dark:    { lit: '#9a9cb2', shade: '#8587a0', hi: '#aeb0c4' },
    green:   { lit: P.stain, shade: P.stainShade, hi: lighten(P.stain, 6) },
    diaper:  { lit: P.diaper, shade: lighten(P.diaper, -6), hi: lighten(P.diaper, 8) },
    vous:    { lit: P.vous, shade: lighten(P.vous, -8), hi: lighten(P.vous, 9) },
    // And the footing: the pale slate a step darker, in two beds.
    foot:    { lit: '#8f92a8', shade: '#7c7f96', hi: '#a3a6ba' },
    footB:   { lit: '#9a9db2', shade: '#86899f', hi: '#adb0c2' },
    flat:    { lit: P.band, shade: P.bandShade, hi: P.bandHi },
    top:     { lit: lighten(P.band, 6), shade: lighten(P.band, 1), hi: lighten(P.band, 10) },
  },
  lay: 'bond',
  rows: 12,
  across: 6,
  headers: 0,
  base: ['foot', 'footB'],
  mortar: 3,
  bandN: 4,
  plinth: 96,
  // Slate is hard and dense: an arris knocked here and there, and nothing more.
  wear: 0.15,
  // The island's lilac, and gentler than a pale stone's: a dark face has less to lose.
  shade: [30, 28, 74],
  shadow: (k) => (1 - k) * 0.7,
  growth: false,
  mix: [['warm', 0.08], ['burnt', 0.08], ['brown', 0.05]],
  pairs: ['warm'],
  field: [['weather', 0.3], ['bleach', 0.25], ['warm', 0.25], ['burnt', 0.2]],
  ornate: true,
  master: true,
}))(SLATE_PASTEL);

/**
 * And sandstone: a honey-coloured ashlar dressed in a rose-red one.
 *
 * The field is a pale honey sand, a dozen values of it, in courses turn
 * about tall and short, of blocks no two the same length; every block shows
 * the beds it was laid down in as faint lines across it, and the odd one is
 * banded with iron. Its dressings -- the band at each floor, the quoins, the
 * jambs, lintels, sills and voussoirs, the cope of a garden wall -- are a
 * rose-red sandstone, so a house of it reads as warm stone trimmed in a
 * warmer; and it stands on a footing of the red a step darker, where the wet
 * off the ground keeps it. Time takes sandstone by the grain rather than by
 * the arris: its edges go soft, the salt hollows it into honeycomb where the
 * wall is damp, and it scales off in skins.
 */
const SAND_PASTEL: Record<string, string> = {
  ...RUBBLE_PASTEL,
  // the block: its field tone, its shade, the bevel along its top, and its darkest
  stone: '#e0c6a4', stoneShade: '#cbac8c', stoneHi: '#ecd9be', stoneDark: '#b39278',
  // a rosier bed out of the same quarry, and a paler, bleached one
  warm: '#e3bea6', warmShade: '#cda38c', warmHi: '#eed2c0',
  dark: '#c8a88c', darkHi: '#d8bea4',
  // the joint, a step under the block, and the ink round every one: a rose-brown, never black
  joint: '#c3a58d', line: '#9a7666',
  // the red sandstone it is dressed in, and the band of it at a floor line
  dress: '#d6a494', dressShade: '#bf8c7e', dressHi: '#e4baac',
  band: '#daab9a', bandShade: '#c29382', bandHi: '#e7c0b1',
  ringJoint: '#b8917e', reveal: '#a9826f',
  // the iron that bands the odd block, and the dark edge of a band
  iron: '#cc9474', ironDark: '#b47b64',
  // the hollows of honeycomb, and the rain's wash down a block
  pit: '#8e6c70', stain: '#d3bea4', stainShade: '#bea88f',
};

const SAND: Stock = ((P) => ({
  pastel: P,
  tones: {
    '':      { lit: P.stone, shade: P.stoneShade, hi: P.stoneHi },
    ...values(P.stone),
    /*
     * The beds a quarry gives up besides its own, every one inside eight
     * points of the field. The bond asks for them by the kiln's names, and
     * on sandstone they are the quarry's: `warm` a rosier bed, `burnt` a
     * pale, bleached one, and `brown` a block with iron in it, which is the
     * one that shows its bands.
     */
    warm:    { lit: P.warm, shade: P.warmShade, hi: P.warmHi },
    burnt:   { lit: '#e9d6b9', shade: lighten('#e9d6b9', -6), hi: lighten('#e9d6b9', 5) },
    brown:   { lit: '#dbb492', shade: lighten('#dbb492', -6), hi: lighten('#dbb492', 6) },
    weather: { lit: lighten(P.stone, -7), shade: lighten(P.stone, -11), hi: lighten(P.stone, -2) },
    bleach:  { lit: lighten(P.stone, 6), shade: lighten(P.stone, 2), hi: lighten(P.stone, 9) },
    // The red sandstone, in the two tones its dressings turn about in.
    dress:   { lit: P.dress, shade: P.dressShade, hi: P.dressHi },
    plinth:  { lit: '#cc9888', shade: '#b58274', hi: '#dbae9f' },
    dark:    { lit: '#cc9888', shade: '#b58274', hi: '#dbae9f' },
    green:   { lit: P.stain, shade: P.stainShade, hi: lighten(P.stain, 6) },
    // And the footing: the red a step darker, in two beds.
    foot:    { lit: '#c08a7b', shade: '#a9776b', hi: '#cf9e90' },
    footB:   { lit: '#c99a88', shade: '#b28676', hi: '#d7ad9d' },
    flat:    { lit: P.band, shade: P.bandShade, hi: P.bandHi },
    top:     { lit: lighten(P.stone, 6), shade: lighten(P.stone, 1), hi: lighten(P.stone, 10) },
  },
  lay: 'bond',
  rows: 6,
  across: 3,
  headers: 0,
  base: ['foot', 'footB'],
  mortar: 2,
  bandN: 4,
  plinth: 96,
  // Sandstone weathers: it does not chip, it goes by the grain.
  wear: 0.3,
  // The lilac every shadow on this island is, on a warm stone.
  shade: [36, 28, 80],
  shadow: (k) => (1 - k) * 0.85,
  growth: false,
  mix: [['warm', 0.1], ['burnt', 0.06], ['brown', 0.06]],
  pairs: ['warm', 'burnt'],
  field: [['weather', 0.3], ['bleach', 0.25], ['warm', 0.25], ['burnt', 0.2]],
  grain: true,
  rhythm: 0.3,
}))(SAND_PASTEL);

/**
 * And timbercraft: a frame of oak, pegged together, its panels filled with
 * daub and limewashed.
 *
 * The frame is the drawing, and there is not much of it: posts at every
 * section's ends and one between, a plate along the head of each storey that
 * the storey over it stands on, and here and there a brace keeping it square.
 * The oak is the dark of an old beam weathered to a violet cast, and the
 * limewash between is a warm chalky white, so the whole reads at any distance
 * as dark lines on a pale ground. It stands on a footing of field stone,
 * because oak at the ground rots, and its fences and garden walls are the
 * same frame at their own height.
 */
const FRAME_PASTEL: Record<string, string> = {
  ...RUBBLE_PASTEL,
  // the limewash on the panels: its field, its shade, its light, and where it
  // has worn -- a step under white, so a lit wall sits in the grass the way
  // the cobblestone does rather than standing off it
  stone: '#d7d1c1', stoneShade: '#c3bcaa', stoneHi: '#e2ded2', stoneDark: '#aca28c',
  warm: '#dcd4bf', warmShade: '#c7bea8', warmHi: '#e5e0d1',
  dark: '#cac1ad', darkHi: '#d6cfbd',
  // the oak of the frame: its light, the shade down its far side, and where
  // the light catches it
  dress: '#725c52', dressShade: '#5a4749', dressHi: '#8a7064',
  band: '#725c52', bandShade: '#5a4749', bandHi: '#8a7064',
  // the daub where the limewash is off it, and the ink every member is drawn in
  joint: '#bcb096', line: '#42322f',
  ringJoint: '#4e4a53', reveal: '#624e47',
  stain: '#c1baa1', stainShade: '#aca58c',
  // the footing's field stone, and the lit ledge along its top
  footing: '#7d787a', footingShade: '#686366', footingHi: '#8c888c',
  // the timber of a door, the same oak
  beam: '#8a7163', beamShade: '#6f5a4e', beamHi: '#a28b7c', beamLine: '#4f3d36',
};

const FRAME: Stock = ((P) => ({
  pastel: P,
  tones: {
    '':      { lit: P.stone, shade: P.stoneShade, hi: P.stoneHi },
    ...values(P.stone),
    warm:    { lit: P.warm, shade: P.warmShade, hi: P.warmHi },
    dark:    { lit: P.dress, shade: P.dressShade, hi: P.dressHi },
    weather: { lit: lighten(P.stone, -6), shade: lighten(P.stone, -10), hi: lighten(P.stone, -1) },
    bleach:  { lit: lighten(P.stone, 4), shade: lighten(P.stone, 0), hi: lighten(P.stone, 7) },
    brown:   { lit: lighten(P.dress, 4), shade: lighten(P.dress, -2), hi: lighten(P.dress, 9) },
    burnt:   { lit: lighten(P.dress, -4), shade: lighten(P.dress, -9), hi: lighten(P.dress, 2) },
    green:   { lit: P.stain, shade: P.stainShade, hi: lighten(P.stain, 6) },
    dress:   { lit: P.dress, shade: P.dressShade, hi: P.dressHi },
    plinth:  { lit: P.footingShade, shade: lighten(P.footingShade, -6), hi: P.footing },
    flat:    { lit: P.band, shade: P.bandShade, hi: P.bandHi },
    top:     { lit: lighten(P.band, 8), shade: lighten(P.band, 3), hi: lighten(P.band, 13) },
    foot:    { lit: P.footing, shade: P.footingShade, hi: P.footingHi },
    footB:   { lit: lighten(P.footing, -5), shade: lighten(P.footingShade, -5), hi: lighten(P.footingHi, -4) },
  },
  lay: 'frame',
  rows: 2,
  across: 2,
  headers: 0,
  base: ['foot', 'footB'],
  mortar: 3,
  bandN: 4,
  // The footing of field stone at the ground, in the ground storey's own pixels.
  plinth: 44,
  // Oak checks along its grain as it dries; it does not chip like stone.
  wear: 0,
  /*
   * A chalky lilac, and laid by the coat's curve rather than the stone's
   * line. On the line the oak on the two sides of a corner post came out
   * eighteen points apart and read as one face, and the limewash of two faces
   * turned from the sun fourteen; and toward a dark violet, the shaded
   * limewash came out a plain grey.
   */
  shade: [40, 38, 110],
  shadow: (k) => 2.45 * Math.max(0, 1 - k) ** 1.6,
  growth: false,
  mix: [['brown', 0.2], ['burnt', 0.2]],
  pairs: [],
  field: [['weather', 0.3], ['bleach', 0.3], ['brown', 0.2], ['burnt', 0.2]],
}))(FRAME_PASTEL);

/**
 * And log: round logs laid one on another, the gaps between them chinked
 * with lime, the logs of the two walls at a corner crossing and showing
 * their cut ends, on a footing of field stone.
 *
 * The logs are the drawing, and the chinking between them the pale line
 * that counts them; the cut ends at a corner and at a stopped end, ringed,
 * are what says log at a glance. The wood is pine gone a silvered brown in
 * the weather, a dusty warm grey in the sun and a lilac in the shade; the
 * chinking a chalky cream.
 */
const LOG_PASTEL: Record<string, string> = {
  ...RUBBLE_PASTEL,
  // the chinking between the logs
  stone: '#d4cbb6', stoneShade: '#c0b6a1', stoneHi: '#e0d8c8', stoneDark: '#aa9f89',
  warm: '#d9cfb9', warmShade: '#c4baa3', warmHi: '#e3dccc',
  dark: '#c7bda7', darkHi: '#d3cab6',
  // the logs: their side in the light, their underside, and the light along their top
  dress: LOG_HUE.side, dressShade: LOG_HUE.under, dressHi: LOG_HUE.top,
  band: LOG_HUE.side, bandShade: LOG_HUE.under, bandHi: LOG_HUE.top,
  joint: '#bcb09a', line: LOG_HUE.line,
  // the end grain where a log is cut, and the rings in it
  grain: LOG_HUE.grain, grainRing: LOG_HUE.ring,
  ringJoint: '#4e4a53', reveal: '#6a574e',
  stain: '#c1baa1', stainShade: '#aca58c',
  footing: '#7d787a', footingShade: '#686366', footingHi: '#8c888c',
  // the sawn boards an opening is framed in
  beam: '#a8917a', beamShade: '#806b5c', beamHi: '#c0aa92', beamLine: '#473935',
};

const LOG: Stock = ((P) => ({
  pastel: P,
  tones: {
    '':      { lit: P.stone, shade: P.stoneShade, hi: P.stoneHi },
    ...values(P.stone),
    warm:    { lit: P.warm, shade: P.warmShade, hi: P.warmHi },
    dark:    { lit: P.dress, shade: P.dressShade, hi: P.dressHi },
    weather: { lit: lighten(P.stone, -6), shade: lighten(P.stone, -10), hi: lighten(P.stone, -1) },
    bleach:  { lit: lighten(P.stone, 4), shade: lighten(P.stone, 0), hi: lighten(P.stone, 7) },
    brown:   { lit: lighten(P.dress, 4), shade: lighten(P.dress, -2), hi: lighten(P.dress, 9) },
    burnt:   { lit: lighten(P.dress, -4), shade: lighten(P.dress, -9), hi: lighten(P.dress, 2) },
    green:   { lit: P.stain, shade: P.stainShade, hi: lighten(P.stain, 6) },
    dress:   { lit: P.dress, shade: P.dressShade, hi: P.dressHi },
    plinth:  { lit: P.footingShade, shade: lighten(P.footingShade, -6), hi: P.footing },
    flat:    { lit: P.band, shade: P.bandShade, hi: P.bandHi },
    top:     { lit: lighten(P.band, 7), shade: lighten(P.band, 1), hi: lighten(P.band, 12) },
    foot:    { lit: P.footing, shade: P.footingShade, hi: P.footingHi },
    footB:   { lit: lighten(P.footing, -5), shade: lighten(P.footingShade, -5), hi: lighten(P.footingHi, -4) },
  },
  lay: 'log',
  rows: 2,
  across: 2,
  headers: 0,
  base: ['foot', 'footB'],
  mortar: 3,
  bandN: 4,
  // The footing of field stone at the ground: the height of one course of logs.
  plinth: 48,
  // A log checks along its grain as it dries; it does not chip like stone.
  wear: 0,
  // The frame's chalky lilac, by the same curve.
  shade: [40, 38, 110],
  shadow: (k) => 2.45 * Math.max(0, 1 - k) ** 1.6,
  growth: false,
  mix: [['brown', 0.2], ['burnt', 0.2]],
  pairs: [],
  field: [['weather', 0.3], ['bleach', 0.3], ['brown', 0.2], ['burnt', 0.2]],
}))(LOG_PASTEL);

/**
 * And plank: sawn boards stood on end, a batten over every joint between
 * two, a band along the head of every storey, a board at every corner, on a
 * footing of field stone.
 *
 * The boards are the field, each a pale pine a step off the next, and the
 * battens the upright lines that count them; the bands, the corner boards
 * and the boards an opening is framed in are a darker stained trim, so the
 * wall is a field of one timber in members of another. Eight boards to four
 * metres: at the width a sawmill cuts, the battens came so close they were
 * a barcode.
 */
const PLANK_PASTEL: Record<string, string> = {
  ...RUBBLE_PASTEL,
  // the boards: pine gone pale in the weather
  stone: PLANK_HUE.board, stoneShade: PLANK_HUE.boardShade, stoneHi: PLANK_HUE.boardHi, stoneDark: PLANK_HUE.boardDark,
  warm: '#cdb391', warmShade: '#b89e7d', warmHi: '#dac3a3',
  dark: '#bea789', darkHi: '#ccb697',
  // the battens over the joints, a step darker than the boards
  batten: PLANK_HUE.batten, battenShade: PLANK_HUE.battenShade, battenHi: PLANK_HUE.battenHi,
  // the trim: the band at a storey's head, the corner boards, the skirt
  dress: '#8d7361', dressShade: '#65524f', dressHi: '#a78c78',
  band: '#8d7361', bandShade: '#65524f', bandHi: '#a78c78',
  joint: '#bcb09a', line: '#473935',
  grain: '#c8ad8b', grainRing: '#a38a70',
  ringJoint: '#4e4a53', reveal: '#6a574e',
  stain: '#c1baa1', stainShade: '#aca58c',
  footing: '#7d787a', footingShade: '#686366', footingHi: '#8c888c',
  // the boards an opening is framed in: the trim
  beam: '#8d7361', beamShade: '#6c5850', beamHi: '#a48a76', beamLine: '#473935',
};

const PLANK: Stock = ((P) => ({
  pastel: P,
  tones: {
    '':      { lit: P.stone, shade: P.stoneShade, hi: P.stoneHi },
    ...values(P.stone),
    warm:    { lit: P.warm, shade: P.warmShade, hi: P.warmHi },
    dark:    { lit: P.dress, shade: P.dressShade, hi: P.dressHi },
    weather: { lit: lighten(P.stone, -6), shade: lighten(P.stone, -10), hi: lighten(P.stone, -1) },
    bleach:  { lit: lighten(P.stone, 4), shade: lighten(P.stone, 0), hi: lighten(P.stone, 7) },
    brown:   { lit: lighten(P.dress, 4), shade: lighten(P.dress, -2), hi: lighten(P.dress, 9) },
    burnt:   { lit: lighten(P.dress, -4), shade: lighten(P.dress, -9), hi: lighten(P.dress, 2) },
    green:   { lit: P.stain, shade: P.stainShade, hi: lighten(P.stain, 6) },
    dress:   { lit: P.dress, shade: P.dressShade, hi: P.dressHi },
    plinth:  { lit: P.footingShade, shade: lighten(P.footingShade, -6), hi: P.footing },
    flat:    { lit: P.band, shade: P.bandShade, hi: P.bandHi },
    top:     { lit: lighten(P.band, 8), shade: lighten(P.band, 3), hi: lighten(P.band, 13) },
    foot:    { lit: P.footing, shade: P.footingShade, hi: P.footingHi },
    footB:   { lit: lighten(P.footing, -5), shade: lighten(P.footingShade, -5), hi: lighten(P.footingHi, -4) },
  },
  lay: 'plank',
  rows: 2,
  across: 2,
  headers: 0,
  base: ['foot', 'footB'],
  mortar: 3,
  bandN: 4,
  // The footing of field stone at the ground, as under the frame.
  plinth: 44,
  wear: 0,
  // The frame's chalky lilac, by the same curve.
  shade: [40, 38, 110],
  shadow: (k) => 2.45 * Math.max(0, 1 - k) ** 1.6,
  growth: false,
  mix: [['brown', 0.2], ['burnt', 0.2]],
  pairs: [],
  field: [['weather', 0.3], ['bleach', 0.3], ['brown', 0.2], ['burnt', 0.2]],
}))(PLANK_PASTEL);

/**
 * And silver: a wall of worked silver, every part of it -- panels raised and
 * chased, pilasters fluted, a frieze of egg and dart along the head of every
 * storey, and a plinth of it at the ground.
 *
 * Metal in flat pastel reads by what it reflects and where it catches the
 * light. Each panel's plate shows, faintly, the sky over its upper part, a
 * thin line of the far horizon, and the lawn at its foot; the faces turned
 * up at the sky -- the flat top, the frieze's fillet, sills, the plinth's roll
 * -- take the sky's own pale blue; the faces turned down take the lawn. The
 * chasing is cut in two flat facets, lit and shaded, a step under the
 * architecture, so the frames and pilasters lead; pure white is kept for the
 * few glints where a form turns square to the sun; and the tarnish is a warm
 * violet lying in flat pools in the corners and at the feet of the flutes.
 */
const SILVER_PASTEL: Record<string, string> = {
  ...RUBBLE_PASTEL,
  // the satin of a plate
  stone: '#c6cad6', stoneShade: '#a8acbb', stoneHi: '#dfe2ea', stoneDark: '#8e92a3',
  warm: '#cbcdd6', warmShade: '#adb0bc', warmHi: '#e2e4ea',
  dark: '#b8bccb', darkHi: '#cfd2dc',
  // the polished work: pilasters, frieze, mouldings
  dress: '#c4ccdc', dressShade: '#9da2b3', dressHi: '#eef1f6',
  band: '#c4ccdc', bandShade: '#9da2b3', bandHi: '#eef1f6',
  // a face turned up at the sky; a bevel turned to the light down the left;
  // the reflected dark hard inside a lit edge; an edge turned from the light;
  // a face turned down, which takes the lawn, and the frieze's underside
  sky: '#ccdcf2', horizon: '#8c95ae', rim: '#ccdcf2', edgeHi: '#d6e0f0', core: '#626882', edgeLo: '#8a90a6',
  reflect: '#92a69c', soffit: '#92a69c',
  // a panel's plate: the sky it shows, the line of the horizon, its body, and
  // the lawn at its foot; and a fence's
  plateSky: '#c0cee4', plateLine: '#8c95ae', plate: '#acb5c5', plateFoot: '#96a8a0', plateFlat: '#b0b8c8',
  // chased work in two facets, a step under the architecture; the shade it
  // throws; the sunk ground inside a ring; and its rim
  facetLit: '#ced8e8', facetShade: '#949cb6', reliefLo: '#5c6078', sunk: '#98a0b4', ring: '#c6d0e2',
  // the ground the work stands on, the deep of it beside a pilaster, and the
  // tarnish: on a plate, and in a recess or a flute
  tarnish: '#82889f', groundSky: '#949cb4', groundLine: '#6e748c', groundFoot: '#7a8a86',
  recess: '#4c4e66', patina: '#96909e', pool: '#747084', ruin: '#747084',
  // the plinth's face as chrome shows it: sky, a lip on the horizon, the dark
  // under it and the ground stepping lighter to its foot
  skyHead: '#b8c4d8', skyMid: '#ccd5e5', skyLow: '#dce3ef', lip: '#e8ecf4',
  deep: '#6c7286', groundA: '#8e96aa', groundB: '#a4abbd', groundC: '#b6bccb',
  // a pilaster: its lit flank, its body, its shaded flank, a flute's channel
  // and the lit edge of it
  flankLit: '#d6deec', shaft: '#b4bccc', flankShade: '#8c94a8', flute: '#6e748c', fluteLit: '#dce4f2',
  // a glint, where a form turns square to the sun
  glint: '#fafbfd', crown: '#fafbfd', cup: '#606478',
  // the shade the work throws on the work behind it
  ink: '#3a4052',
  joint: '#9a9dae', line: '#56586b',
  ringJoint: '#6f7184', reveal: '#8a8ea0',
  stain: '#b9bdc9', stainShade: '#a3a7b5',
  footing: '#b4b8c6', footingShade: '#8f93a4', footingHi: '#dde0e8',
  // an opening's architrave, the same polished work
  beam: '#d2d6e0', beamShade: '#9da2b3', beamHi: '#eef1f6', beamLine: '#56586b',
};

/**
 * A wall of worked metal in the palette `P`, a face of it turned from the sun
 * going toward `shade`: the silver, and the gold tinted from it.
 */
const metal = (P: Record<string, string>, shade: [number, number, number]): Stock => ({
  pastel: P,
  tones: {
    '':      { lit: P.stone, shade: P.stoneShade, hi: P.stoneHi },
    ...values(P.stone),
    warm:    { lit: P.warm, shade: P.warmShade, hi: P.warmHi },
    dark:    { lit: P.dress, shade: P.dressShade, hi: P.dressHi },
    weather: { lit: lighten(P.stone, -6), shade: lighten(P.stone, -10), hi: lighten(P.stone, -1) },
    bleach:  { lit: lighten(P.stone, 4), shade: lighten(P.stone, 0), hi: lighten(P.stone, 7) },
    brown:   { lit: lighten(P.dress, 4), shade: lighten(P.dress, -2), hi: lighten(P.dress, 9) },
    burnt:   { lit: lighten(P.dress, -4), shade: lighten(P.dress, -9), hi: lighten(P.dress, 2) },
    green:   { lit: P.stain, shade: P.stainShade, hi: lighten(P.stain, 6) },
    dress:   { lit: P.dress, shade: P.dressShade, hi: P.dressHi },
    plinth:  { lit: P.footingShade, shade: lighten(P.footingShade, -6), hi: P.footing },
    flat:    { lit: P.band, shade: P.bandShade, hi: P.bandHi },
    top:     { lit: P.sky, shade: P.dress, hi: P.glint },
    foot:    { lit: P.footing, shade: P.footingShade, hi: P.footingHi },
    footB:   { lit: lighten(P.footing, -5), shade: lighten(P.footingShade, -5), hi: lighten(P.footingHi, -4) },
  },
  lay: 'gild',
  rows: 2,
  across: 2,
  headers: 0,
  base: ['foot', 'footB'],
  mortar: 3,
  bandN: 4,
  // The plinth of it at the ground, in the ground storey's own pixels:
  // heavy enough that a tall front has a base to it and not three storeys
  // alike.
  plinth: 70,
  wear: 0,
  /*
   * A split between the faces as firm as the stone's and no firmer: at the
   * 0.86 a face three-quarters to the sun is lit to it takes almost none, at
   * the 0.76 of the face turned from it about a quarter, and no face more
   * than half. Its brightest paint is laid again over the shade (`gleam`),
   * so a face turned away keeps its white edges on a darker body. Shaded a
   * third, with the highlights shaded with it, half of every silver house
   * went to grey stone.
   */
  shade,
  shadow: (k) => Math.min(0.5, 2.4 * Math.max(0, 0.87 - k)),
  growth: false,
  mix: [['brown', 0.2], ['burnt', 0.2]],
  pairs: [],
  field: [['weather', 0.3], ['bleach', 0.3], ['brown', 0.2], ['burnt', 0.2]],
});
/** Silver turned from the sun goes to a cool grey: under the lilac the painted walls share, it came out periwinkle. */
const GILD: Stock = metal(SILVER_PASTEL, [40, 46, 58]);

/**
 * And gold: the same worked metal as the silver, tinted.
 *
 * Every tone of the silver keeps its own value and is turned to gold -- a
 * chalky gold through the middle, going to cream in the lights and to a
 * warm violet-brown in the darks, never black -- and each keeps what it
 * reflects over and above the silver's own cool cast, which is the plate's:
 * the sky a little cooler than the gold round it, the lawn olive, the
 * tarnish red. So the light, the reflections, the glints and every line of
 * the chasing are the silver's, and only the metal is changed.
 */
function gilt(hex: string, cast0: [number, number, number]): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const L = 0.299 * r + 0.587 * g + 0.114 * b;
  // toward gold through the middle and the lights, toward a warm violet-brown in the darks; each at no change of value
  const t = Math.max(0, Math.min(1, (L - 70) / 60));
  const dir = [0.55 + (0.46 - 0.55) * t, -0.2 + (-0.03 + 0.2) * t, -0.06 + (-1 + 0.06) * t];
  const k = 56 * Math.max(0.35, Math.min(1, (L - 30) / 100)) * (L > 200 ? Math.max(0.15, 1 - (L - 200) / 70) : 1);
  const cast = [r - L, g - L, b - L];
  const out = [0, 1, 2].map((i) => Math.round(Math.max(0, Math.min(255, L + dir[i] * k + 0.8 * (cast[i] - cast0[i])))));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
}
const GOLD_PASTEL: Record<string, string> = ((P) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(P.plate.slice(i, i + 2), 16));
  const L = 0.299 * r + 0.587 * g + 0.114 * b, cast0: [number, number, number] = [r - L, g - L, b - L];
  return Object.fromEntries(Object.entries(P).map(([key, hex]) => [key, gilt(hex, cast0)]));
})(SILVER_PASTEL);
/** Gold turned from the sun goes to a warm violet-brown, as its darks do. */
const GILT: Stock = metal(GOLD_PASTEL, [64, 48, 56]);

/**
 * And adobe: mud brick, laid in mud, under a coat of mud.
 *
 * There is nothing cut on it and nothing fired. What there is to look at is
 * the coat -- a warm, chalky plaster laid on by hand in a day's patches --
 * and where the weather has had it: a spall where it came away and the brick
 * shows, a streak where the rain runs off the beam ends, a foot the splash
 * has eaten back. Its timber is its dressing: the beam ends of each floor
 * standing out of the wall in a row, a lintel over every opening, a board
 * for a sill. Everything that is not the wall is weathered wood, in the warm
 * brown the window frames are: silvered to a grey, the beam ends read as a
 * row of rivets driven into the coat.
 */
const ADOBE_PASTEL: Record<string, string> = {
  ...RUBBLE_PASTEL,
  /*
   * The coat: its field tone, its shade, and the arris where it turns into
   * the light. A golden sand, the colour of the ground it was dug out of --
   * a step toward pink and a street of it is stucco, not mud.
   */
  stone: '#d0bb9f', stoneShade: '#bba286', stoneHi: '#e0d1b8', stoneDark: '#a17d5e',
  // a day's patch laid a little paler, and one a little darker
  warm: '#d5c6ae', warmShade: '#c2ae93', warmHi: '#e2d6c1',
  dark: '#c6ac90', darkHi: '#d2bca3',
  /*
   * What the coat is on: mud brick, and the mud it is laid in. The same earth
   * as the coat and barely a step under it -- dark, and outlined, it was a
   * brown thing pinned to the wall; where the coat is gone an adobe wall is
   * the same colour, only jointed, and in the shade of the coat's broken edge.
   */
  mud: '#b4967a', mudShade: '#ab8d72', mudHi: '#bd9f83', joint: '#a68a70',
  // the ink round a bare patch and down a crack, and the eaten foot and its damp
  line: '#8a6851', erode: '#b59a82', damp: '#92735d',
  // an opening has no dressings; what lines it is the same coat, rolled in
  dress: '#d0bb9f', dressShade: '#b99f83', dressHi: '#e4d6be',
  band: '#d0bb9f', bandShade: '#bba286', bandHi: '#e0d1b8',
  ringJoint: '#a0836a', reveal: '#b29576',
  // the beam ends of a floor: the log's side, lit along its top, and the paler
  // end grain the saw left, with the darker rim where the bark was
  viga: '#97785d', vigaShade: '#735a47', vigaHi: '#b39373', vigaRing: '#86684f', vigaEnd: '#bb9c78',
  // and every other piece of timber in it, a lintel or a door, the same
  beam: '#98795f', beamShade: '#7f644e', beamHi: '#b29475', beamLine: '#5e4a3b',
  stain: '#b3a589', stainShade: '#a19372',
};

const ADOBE: Stock = ((P) => ({
  pastel: P,
  tones: {
    '':      { lit: P.stone, shade: P.stoneShade, hi: P.stoneHi },
    warm:    { lit: P.warm, shade: P.warmShade, hi: P.warmHi },
    dark:    { lit: P.dark, shade: lighten(P.dark, -6), hi: P.darkHi },
    // the brick under the coat, at a few values, for where the coat is off
    mud:     { lit: P.mud, shade: P.mudShade, hi: P.mudHi },
    mudpale: { lit: lighten(P.mud, 5), shade: lighten(P.mudShade, 5), hi: lighten(P.mudHi, 4) },
    muddark: { lit: lighten(P.mud, -6), shade: lighten(P.mudShade, -6), hi: lighten(P.mudHi, -5) },
    dress:   { lit: P.dress, shade: P.dressShade, hi: P.dressHi },
    flat:    { lit: P.band, shade: P.bandShade, hi: P.bandHi },
    /*
     * The top of the wall, turned up at the sky: the brightest plane on the
     * house by a clear step, because it is. Six points over the face it was
     * a lid the same colour as the box.
     */
    top:     { lit: '#e6d5b9', shade: '#d9c6a8', hi: '#efe2cb' },
    weather: { lit: lighten(P.stone, -7), shade: lighten(P.stone, -12), hi: lighten(P.stone, -2) },
    bleach:  { lit: lighten(P.stone, 6), shade: lighten(P.stone, 1), hi: lighten(P.stone, 10) },
    brown:   { lit: lighten(P.stone, -4), shade: lighten(P.stone, -9), hi: lighten(P.stone, 1) },
    green:   { lit: P.stain, shade: P.stainShade, hi: lighten(P.stain, 6) },
    plinth:  { lit: P.erode, shade: lighten(P.erode, -8), hi: lighten(P.erode, 5) },
  },
  lay: 'render',
  /*
   * The brick the coat is on, where a spall shows it: sun-dried mud is laid
   * in bigger, thicker units than fired brick, so fewer courses of it to the
   * storey than a brick wall has.
   */
  rows: 12,
  across: 7,
  headers: 0,
  base: ['plinth', 'dress'],
  mortar: 3,
  bandN: 6,
  // The foot the splash has eaten back, in the ground storey's own pixels.
  plinth: 64,
  // A coat of mud is not a heap of blocks: nothing on it chips like a stone.
  wear: 0,
  shade: [52, 40, 74],
  /*
   * Steeper than the stone's, and by a curve rather than a line. A face in
   * full sun is untouched either way; the two faces of a house seen from
   * behind, both turned from the light, came out three points of value
   * apart on a plain coat and the corner between them went, where stone and
   * brick have their joints to hold it. This keeps them eight apart.
   */
  shadow: (k) => 2.3 * Math.max(0, 1 - k) ** 1.6,
  growth: false,
  mix: [['mudpale', 0.2], ['muddark', 0.2]],
  pairs: [],
  field: [['weather', 0.3], ['bleach', 0.3], ['brown', 0.2]],
}))(ADOBE_PASTEL);

let painted: Masonry | undefined;
let bricked: Masonry | undefined;
let dressed: Masonry | undefined;
let rendered: Masonry | undefined;
let framed: Masonry | undefined;
let logged: Masonry | undefined;
let planked: Masonry | undefined;
let gilded: Masonry | undefined;
let golden: Masonry | undefined;
let sanded: Masonry | undefined;
let slated: Masonry | undefined;
let marbled: Masonry | undefined;
let leaded: Masonry | undefined;

/**
 * Cobblestone: what a novice lays, out of what the field gave up.
 *
 * It takes a moment, and it is done once: every cobblestone wall on the
 * island shares the result, so the cost of it does not go up with the size of
 * a deed.
 */
export function cobble(): Masonry {
  return painted ??= paint(RUBBLE);
}

/**
 * And brickwork: a kiln-fired unit laid to a line, dressed in cut stone.
 *
 * The same picture in every other respect -- the same ivy over it, the same
 * hedge at its foot, the same arch cut through it -- because those do not
 * care what the wall is made of.
 */
export function brickwork(): Masonry {
  return bricked ??= paint(BRICK);
}

/**
 * And stone brick: cut stone laid to a line, dressed in a paler limestone.
 */
export function stonework(): Masonry {
  return dressed ??= paint(STONE);
}
export function sandstone(): Masonry {
  return sanded ??= paint(SAND);
}
export function slatework(): Masonry {
  return slated ??= paint(SLATE);
}
/** Marble: great white slabs, each veined on its own, dressed in dove grey; its garden walls laid in veined blocks. */
export function marblework(): Masonry {
  return marbled ??= paint(MARBLE);
}
/** Stained glass: a field of leaded coloured panes under a band of ivory marble, its openings dressed in the marble. */
export function glasswork(): Masonry {
  return leaded ??= paint(STAINED);
}

/**
 * And adobe: the same wall again, in mud, with timber for its dressings.
 */
export function adobe(): Masonry {
  return rendered ??= paint(ADOBE);
}

/** And timbercraft: an oak frame on a stone footing, its panels limewashed. */
export function timbercraft(): Masonry {
  return framed ??= paint(FRAME);
}

/** And log: round logs laid on one another, chinked, their ends crossing at the corners. */
export function logwork(): Masonry {
  return logged ??= paint(LOG);
}

/** And plank: boards on end with a batten over every joint, in a trim of darker boards. */
export function planking(): Masonry {
  return planked ??= paint(PLANK);
}

/** And silver: worked silver throughout, chased panels between fluted pilasters. */
export function silverwork(): Masonry {
  return gilded ??= paint(GILD);
}
/** The same worked metal in gold, for a wall of ornate gold. */
export function goldwork(): Masonry {
  return golden ??= paint(GILT);
}

function paint(S: Stock): Masonry {
  const LAY = LAYS[patternOf(S)];
  const kit = makeKit(S, LAY);
  const { TONES, PASTEL } = kit;

  /* ---- the set --------------------------------------------------------------- */
  const FACE = facePictures(kit);
  const ARCHED = archPictures(kit);
  const ARCH_IVY = archIvyPictures(kit);
  const ARCH_WEED = archWeedPictures(kit);
  const WINDOWED = windowPictures(kit);
  const WIN_IVY = winIvyPictures(kit);
  const WIN_WEED = winWeedPictures(kit);
  const BAYED = bayPictures(kit);
  const DOORED = doorPictures(kit);
  const GATED = gatePictures(kit);
  const DOOR_IVY = doorIvyPictures(kit);
  const DOOR_WEED = doorWeedPictures(kit);
  const GATE_IVY = gateIvyPictures(kit);
  const GATE_WEED = gateWeedPictures(kit);
  const SPILL = spillPictures(kit);
  const BASE = basePictures(kit);
  const FOOT = footPictures(kit);
  const CREST = LAY.crest?.(kit);
  const BROW = LAY.brow?.(kit);
  const LOSSES = LAY.losses?.(kit);
  const VIGAS = LOSSES && LAY.vigas?.(kit, LOSSES);
  const CAP_STONE = capPicture(kit);
  const CORNER_STONE = LAY.corner?.(kit);
  const ENDS = endsPicture(kit);
  const ENDS_FOOT = LAY.endsFoot ? endsFootPicture(kit, ENDS) : undefined;

  return {
    face: FACE,
    arch: ARCHED,
    archIvy: ARCH_IVY,
    archWeed: ARCH_WEED,
    window: WINDOWED,
    winIvy: WIN_IVY,
    winWeed: WIN_WEED,
    door: DOORED,
    doorIvy: DOOR_IVY,
    doorWeed: DOOR_WEED,
    gate: GATED,
    gateIvy: GATE_IVY,
    gateWeed: GATE_WEED,
    bay: BAYED,
    quoinL: LAY.quoins?.(kit, -1),
    quoinR: LAY.quoins?.(kit, 1),
    vigas: VIGAS,
    brow: BROW,
    crest: CREST,
    losses: LOSSES,
    soft: !!LAY.soft,
    shadow: S.shadow,
    top: TONES.top && { lit: channels(TONES.top.lit), hi: channels(TONES.top.hi), shade: channels(TONES.top.shade) },
    wrap: !!LAY.wrap,
    scatter: !!LAY.scatter,
    hi: channels(PASTEL.stoneHi),
    low: (k) => low(kit, k),
    piers: LAY.piers,
    spill: SPILL,
    base: BASE,
    foot: FOOT,
    cap: CAP_STONE,
    corner: CORNER_STONE,
    ends: ENDS,
    endsFoot: ENDS_FOOT,
    gleam: LAY.gleam ? (img) => gleamOf(kit, img) : undefined,
    handed: !!LAY.handed,
    post: LAY.post?.(kit),
    reveal: channels(PASTEL.reveal),
    line: channels(PASTEL.line),
    beam: channels(PASTEL.beam),
    beamLine: channels(PASTEL.beamLine),
    w: TW,
    h: TH,
    head: LAY.head,
    plinth: S.plinth,
    shade: S.shade,
    growth: S.growth,
    under: LAY.under?.(kit),
    pad: PAD,
    capH: CAP_H,
    pave: () => pave(kit),
    paveN: PAVE_N,
    neutral: NEUTRAL,
    tells: VARIANTS.map((v) => v.tells),
  };
}

/**
 * Paint it while nobody is waiting on it.
 *
 * The whole set is a tenth of a second's drawing on a desktop and several
 * times that on a phone, and it is all done the first time a wall of it comes
 * into view — which is a frame somebody is looking at. So it is asked for
 * once at boot, on the idle the browser hands out after the first screen is
 * up; whoever gets to a wall before the idle does pays for it as before, and
 * the answer is the same one either way.
 */
export function warmMasonry(): void {
  const idle = globalThis.requestIdleCallback;
  // A set to an idle: painting them back to back is that many pauses at once,
  // and the later ones are only wanted by whoever has built in them.
  const sets = [cobble, brickwork, stonework, sandstone, slatework, marblework, adobe, timbercraft, logwork, planking, silverwork, goldwork, glasswork];
  const next = (i: number): void => {
    if (i >= sets.length) return;
    if (typeof idle === 'function') idle(() => { sets[i](); next(i + 1); });
    else setTimeout(() => { sets[i](); next(i + 1); }, i ? 800 : 1500);
  };
  next(0);
}
