import { actOf, beastFrame } from './beasts';
import { sunAt } from './sun';
import { gearFrom, wornWire } from '../game/worn';
import { materialOf } from '../game/materials';
import { Camera, MAX_ZOOM, SCULPTED_MAX_ZOOM } from '../engine/camera';
import { emoteAt } from '../game/emotes';
import { ACTION_BY_ID } from '../game/actions';
import type { FullscreenCanvas } from '../engine/canvas';
import { onPhone } from '../engine/device';
import { drawsFast, drawsLow } from '../game/settings';
import { animationsOff, lessMotion, setAnimations } from '../engine/motion';
import type { Game } from '../game/game';
import {
  borderOf,
  borderPoints,
  floorKind,
  isDone,
  bordersRoom,
  MATERIAL_BY_ID,
  progressOf,
  WALL_HEIGHT,
  WALL_THICK,
  FENCE_THICK,
  FLOOR_DEEP,
  WALL_TYPE_BY_ID,
  TOP_LEVELS,
  type Column,
  type Border,
  type FloorTile,
  type StairHand,
  isSpiral,
  type MaterialDef,
  type Side,
  type Wall,
  type Building,
  floorBill,
  roofShapeOf,
  CELLAR_LEVEL,
} from '../game/building';
import { foundationDone } from '../game/foundations';
import { hash2 } from '../world/noise';
import { bareRock, DAMP_SAND, dustiness, FLAT, growth, oreWash, PAVED, ROCK_VARIANTS, SLAB_VARIANTS, STREWN, TileType, TILE_DEFS, COVERED, bushSpecies, slabVariant, trailGround, stonesBed, treeSpecies, treeVariant } from '../world/tiles';
import { drawRunestone, runestoneHit, RunestoneNight, softHole, type NightHole, type OccluderClip } from './runestone';
import { BUSH3D_SPECIES, bush3dFoot, bush3dShadow, formAt, nextSunStep, STUMP3D_SPECIES, SWAY_FRAMES, sunStepOf, swayAt, TREE3D_SPECIES, tree3dFoot, tree3dFrame, tree3dIdle, tree3dShadow, tree3dStats, type TreeView } from './trees3d';
import { drawRuneLantern, drawRuneLanternBloom, drawRuneLanternLive, runeLanternHit, runeLanternNight, runeLanternPool, runeLanternVariant, type RuneLanternLook } from './runelantern';
import { deedTotemBounds, deedTotemHits, deedTotemNight, deedTotemVariant, drawDeedTotem, drawDeedTotemBloom, drawDeedTotemLive } from './deedtotem';
import { drawWorkPost, drawWorkPostLive, drawWorkPostNight, workPostBounds, workPostHit, workPostNight, workPostVariant, type WorkPostLook } from './workpost';
import { isRuneLantern } from '../game/runelantern';
import { isRuneGate } from '../game/runegate';
import { HALF_H, HALF_W, HEIGHT_SCALE, UNITS_PER_TILE } from './iso';
import { ladderBody } from './ladderbody';
import { beastReach, blockAt, flinchAt, stumbleAt, HUNT_REACH, inFightReach, isFightJob, WIND_UP } from '../game/fight';
import { depthOf, type View } from './view';
import type { RoofModel } from './roofshape';
import { isGlasshouse } from '../game/glasshouse';
import type { LightSource } from '../game/light';
import { FLOOR_PPT, FLOOR_TILES, concrete, flooring, slabbing } from './flooring';
import { stairStyle } from './stairing';
import { BEAM_DEEP, drawBeam, drawColumn, drawJettySupports, JOIST_DEEP, PILASTER_PROUD, pilasterHead, type Body, type HeadTone, type Cut } from './framing';
import { jettyBase, outsideStairBase, spiralBase } from '../game/frame';
import { drawSpiralPiece, spiralCapGlow } from './spiralkit';
import { spiralHeading } from '../game/spiral';
import { storeyHeight } from '../game/storeyview';
import { drawSteps, stepsFootAt } from './steps';
import { seasonAt, type Season } from '../world/calendar';
import { drawShine, shines } from './shine';
import { NIGHT_WASH } from './nightwash';
import { type Masonry, adobe, brickwork, cobble, goldwork, logwork, glasswork, marblework, planking, sandstone, silverwork, slatework, stonework, timbercraft } from './masonry';
import { hashOf, mossStrip, PAVE_STAGES, pavingMoss, PPM, slabTopMoss } from './ivy';
import { bridgeGreen, greenNow, greenShows, mossyPiece, pavingGreen, pieceGreen, slabGreen } from '../game/greening';
import { ANVIL_SUBTILES, anvilCentre } from '../game/anvil';
import { postCentre, postLeft, postLife } from '../game/posts';
import { trapCentre } from '../game/traps';
import { ageDef, stageOf } from '../game/creatures';
import { CRATE_DOOR, CREATURE_CRATE } from '../game/creaturecrate';
import { FIRE_CAPACITY, fireCentre } from '../game/campfire';
import { drawCampfireNight } from './kit/campfire';
import { SMELTER_H, SMELTER_W, smelterCentre } from '../game/smelter';
import { anvilBounds, anvilHit, anvilNight, anvilTone, anvilVariant, drawAnvil, drawAnvilLive, drawAnvilNight, drawKiln, drawKilnLive, drawKilnNight, drawSmelter, drawSmelterLive, drawSmelterNight, kilnBounds, kilnHit, smelterBounds, smelterHit } from './forge';
import { KILN_SUBTILES, kilnCentre } from '../game/kiln';
import { furnitureCentre, furnitureDef, hearthCapacity, type PlacedFurniture, facingOf as pieceFacing, furnitureFootprint } from '../game/furniture';
import { UNSEEN, VISIBLE } from '../game/vision';
import { darknessAt, DAWN, deedLevel, deedRadiusAt, DUSK, MAX_DEED_LEVEL } from '../game/game';
import { boatSway, clothInWind, crewOrder, deviceOf, drawFurniture, drawFurnitureLive, driverOn, swayOnScreen, WHEELS, wheelBlur, wheelTrim, steeredByTiller, woodHex, furnitureHoles, helmSeat, reinsTo, rowedPiece, furnitureSpan, FURNITURE_HEIGHT, glowsAtNight, headingView, mossTrim, PIECE_STAGES, pieceView, planterTrim, roseTrim, vineTrim, VINE_VARIANTS, type Air, type Crew, type PieceView } from './furniture';
import { roseStage } from '../game/roses';
import { isTrellis, vineStage } from '../game/vineyard';
import { fieldRate } from '../game/growth';
import { dyeOf, dyeTint } from '../game/dyestuffs';
import { castAt, netReach } from '../game/fishing';
import { sailTrim } from '../game/wind';
import { FURNITURE_BY_ID, isPlanter, rackDeck, rackSpots } from '../game/furniture';
import { isLampPiece, lampBurning } from '../game/lamps';
import { drawLampBloom, piecesFrame } from './furniture';
import { zoomHeld } from './settle';
import { drawMemorial, memorialNight } from './memorial';
import { denHit, denPools, drawDen, drawDenLive, isDen, prewarmDen, type DenLook } from './dens';
import { MEMORIAL } from '../game/memorial';
import { cropDef, type Crop, type CropLook } from '../game/farming';
import { crateCentre, crateKindOfItem, subtileOf, SUBTILES } from '../game/crates';
import { HUNT_SIGHT, inWorld, maxHealth, PLAYER_ATTACKER, SPECIES, threatens, type Creature } from '../game/creatures';
import { rarityOf } from '../game/items';
import { coatOf, formScale } from '../game/wildforms';
/** How big a creature is drawn for how rare it is and its size form (`formScale`). */
const bodySize = (c: { rare?: number; formSize?: 'large' | 'small' | null }): number => rarityOf(c).size * formScale(c);
import { WATER_LIT, waterVeil } from './water';
import { WaterTint } from './watertint';
import { SeaReach, type ReachBox } from './seareach';
import { ShoreField, ShorePainter } from './shore';
import { Wakes } from './wake';
import { foamTexture, SpringWater } from './ponds';
import { drawFountain } from './fountain';
import { fallView } from './falls';
import { AqueductPainter, hullOf } from './aqueducts';
import { drawPool, type Run } from './pools';
import { drawStones, STONES_RISE } from './stones';
import { drawPierFeet, drawPierTile, pierFeetOf, slabOutline, type PierFoot, type PierTile } from './piers';
import { drawPlantsFlat, drawPlantUpright, plantFoot, standsUp, type PlantFrame } from './waterplants';
import type { WaterPlant } from '../world/waterplants';
import type { Swirl } from '../game/motes';
import { drawSwirl, glowSwirl } from './swirls';
import { runestoneAt, stoneCentre, type Runestone } from '../game/runestones';
import type { WaterField } from '../world/springs';
import { Dust, dustTone } from './dust';
import { StructureWatch } from './structwatch';
import { AFTER, BAKED, GroundChunks, LIT, staled, VOID, type GroundLine, type GroundRun } from './groundchunks';
import { BEAST_WALK, Gaits } from './gait';
import type { Peer } from '../game/roster';
import { css, HAZE_REACH, rgba, skyAt, unknownInk, type Sky } from './sky';

/** Ground higher than this at every corner, in height units, is never within reach of the sea's shore: a quick test before `ShoreField` is asked. */
const SHORE_HIGH = 40;

/**
 * How many steps the distance is mixed in. Enough that the banding is under
 * the eye, few enough that a wood builds a handful of copies per sprite
 * rather than one per tree per frame.
 */
const HAZE_STEPS = 6;
/**
 * How far the distance's colour may move, in any channel out of 255, before
 * the tree pictures mixed toward it are made again (`treePicture`): at most
 * 0.62 of it is laid on the furthest tree, so that one is out by under eight.
 */
const HAZE_INK_STEP = 12;
/** Device pixels of tree pictures kept between frames (`drawTree`): about sixty-four megabytes. */
const TREE_PIXELS = 16_000_000;
/** The most device pixels of solid trees' pictures a frame may put down for the wind to move them (`solidFrame`): every frame of it is a picture of its own. */
const SWAY_PIXELS = 6_000_000;
/**
 * How long the zoom has to have held still, in milliseconds, before pictures
 * are made for it (`zoomSettled`). A wheel is a run of notches with a few
 * frames between each, and a picture made at every notch was a whole screen
 * of them thrown away at the next: until then the nearest kept picture is
 * drawn stretched to the size wanted.
 */
const ZOOM_SETTLE = 220;
/** How long, in milliseconds, a frame may spend making tree pictures (`drawTree`) for trees that already have one at another size to stand in. */
const TREE_PICTURE_MS = 6;
/** How long, in milliseconds, a frame may spend making the solid trees' shade pictures afresh (`solidFrame`); the rest lay last frame's. */
const SHADE_MS = 3;
/** The milliseconds a frame is drawn in when it leaves time to spare, for the solid trees' work after it (`tree3dIdle`): under a sixtieth of a second, for the drawing the browser does after. */
const IDLE_FRAME_MS = 10;
/** Seconds before the trees' look turns that its bakes are made ahead (`Renderer.lookAhead`). */
const LOOK_AHEAD_S = 600;
/** How many trees' shade a frame may lay into lines' pictures made again (at zoom one; fewer closer in), and how many device pixels of pictures of solid trees it may make, while older ones can stand in: the clock sees only part of what a picture costs, its drawing being done when it is first copied. */
const SHADE_PARTS = 20;
const SOLID_PICTURE_PX = 250_000;
/** The solid trees' shade pictures' resolution against the screen's: the screen's, as a picture blown up is dear to lay. */
const SHADE_RES = 1;
/** How dark the solid trees' shade is laid in full day: six steps of 0.045 (`solidFrame`). */
const SOLID_ALPHA_DAY = 0.27;
/** How far round a solid tree's foot the darkening right at it reaches, against how far round its foot it stands (`tree3dFoot`), and how dark it is out from the middle (`solidFoot`). */
const FOOT_CONTACT = 0.8;
const FOOT_CONTACT_RAMP: ReadonlyArray<[number, number]> = [[0, 0.45], [0.4, 0.24], [0.75, 0.07], [1, 0]];
/** How long, in milliseconds, a frame may spend making pictures of blocks of the ground (`bakeChunk`); the rest is drawn as it always was. */
const GROUND_BAKE_MS = 4;
/** How many screens' worth of device pixels the ground's pictures keep between them (`GroundChunks`), and the most in all. */
const GROUND_SCREENS = 8;
const GROUND_PIXELS = 16_000_000;
/**
 * The least zoom the ground is laid from pictures at. Further out a tile is a
 * fill and little else, and laying a run of them from a picture cost more
 * than filling them (a far view laid ~1,400 runs and took 45 ms more a frame).
 */
const GROUND_FROM = 0.7;
/** How long the view holds still, in milliseconds, before pictures of the ground are made: on the move a new one is out of date in a moment. */
const GROUND_STILL_MS = 300;
/** About how tall a block of the ground is on the screen, in device pixels; it is as wide as the screen, so a line is laid in a run or two. */
const GROUND_BLOCK_H = 256;
/** The most device pixels one block's picture may have; past it the block is drawn as it always was. */
const GROUND_BLOCK_MOST = 6_000_000;

/** What a frame's blocks of ground are made and laid with (`Renderer.groundFrame`). */
interface GroundFrame {
  V: View;
  zoom: number;
  /** The canvas's scale and offset in device pixels. */
  a: number;
  te: number;
  tf: number;
  /** Where the lattice's first point falls on the screen, in whole device pixels. */
  sx: number;
  sy: number;
  W: number;
  H: number;
  stepW: number;
  stepH: number;
  hs: number;
  off: Float64Array;
  co: View['corners'];
  paveRot: number;
  grassy: boolean;
  hemmed: boolean;
  paved: boolean;
  seamed: boolean;
  grid: boolean;
  water: WaterField | null;
  piers: boolean;
  /** The colour of ground nobody has seen, and whether it is the colour it was last frame (it moves at dusk and dawn). */
  voidInk: string;
  voidSteady: boolean;
  sun: [number, number, number];
}
/**
 * How far a tree's picture at another size is stretched, either way, to
 * stand in for it while the zoom moves (`treePicture`). Past this a picture
 * shrunk goes grainy and one blown up goes soft, so a new one is made at the
 * size it is now, which stands in in its turn: two or three to a tree over
 * the whole of a zoom from closest in to furthest out.
 */
const STAND_IN_MOST = 1.6;
/**
 * How many tiles' edge pictures (`hems`) may be made in a frame, for tiles with none, or none near enough the size
 * wanted while the zoom moves; the rest are drawn as they always were, and have theirs made in the frames after. On
 * the move what is in sight changes with every step, and a block of the ground laid from its picture (`GroundChunks`)
 * goes back to being drawn a tile at a time: up to 315 pictures made in one frame.
 */
export const HEMS_A_FRAME = 32;
/** Device pixels of rescaled sprites (`atSize`) and their hazed copies (`hazed`) kept, across zooms: about sixty-four megabytes. */
const SCALED_PIXELS = 16_000_000;
/** How strongly a hostile creature is laid over in red on top of whatever is in front of it (`drawThreats`), and while it is hunting you. */
export const THREAT_SHADE = 0.5;
export const THREAT_SHADE_HUNTING = 0.7;

/** A tree drawn ready for the screen (`drawTree`), and where in it the foot is. */
interface TreePicture {
  cv: HTMLCanvasElement;
  footX: number;
  footY: number;
  /** The frame it was last put down in. */
  used: number;
  /** Which tree it is of (`treeOwn`), and how far it is mixed toward the distance: what may stand in for it at another size. */
  own: string;
  haze: number;
  /** The colour it was mixed toward, which moves with the hour; and what it is kept under. */
  ink: string;
  key: string;
  /** How tall the whole tree is in it, its empty rows over the top included (`treePicture`). */
  tall: number;
}
/**
 * The twelve borders whose walls can throw their shade on a tile
 * (`groundShade`), as a direction (0 along x, 1 along y) and a step from the
 * tile, three numbers each: its own four, and the eight running on from
 * its corners.
 */
const SHADE_BORDERS = [
  0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0,
  0, -1, 0, 1, 0, -1, 0, 1, 0, 1, 1, -1,
  0, 1, 1, 1, 1, 1, 0, -1, 1, 1, 0, 1,
];
/** A storey's border as one number, for the shade it throws (`shadeOf`): no island is 65536 tiles across, nor a building 4096 storeys tall. */
const shadeKey = (level: number, b: Border): number => ((level * 2 + (b.dir === 'v' ? 1 : 0)) * 65536 + b.x) * 65536 + b.y;
/**
 * How long a wall's or a roof's picture is kept before it is made again
 * whatever happens (`baked`), in seconds, give or take a quarter: what it
 * reads that nothing says has changed -- the ivy growing up it, a pond dug
 * near enough to green it -- moves slower than this.
 */
const BAKE_KEEP = 20;
/**
 * Over how long, in seconds, the pictures are made again when the light
 * they were made in moves on a step (`baked`): each in its own turn, so a
 * village is not all drawn afresh in one frame.
 */
const BAKE_LIFE = 0.5;
/**
 * Device pixels of wall and roof pictures kept on a screen of one device pixel
 * to a CSS pixel, about a hundred and twenty-eight megabytes, and the square
 * of that as many on a sharper one (`bakeRoom`): the same village is four
 * times the pixels at two. Past it, the pictures gone longest undrawn go.
 */
const BAKE_PIXELS = 32_000_000;
/** No one picture is bigger than this; a thing that would be is drawn as it always was. */
const BAKE_MOST = 4_000_000;
/**
 * Pictures made in a frame where an older one can stand in (`baked`): for the
 * zoom once it has settled, and for anything read round it that has changed,
 * the old one drawn until its turn comes.
 */
const BAKES_A_FRAME = 12;
/** And while the zoom moves, for things with no picture near enough this size to stand in. */
const BAKES_MOVING = 6;
/** A floor reads no light: its boards are the colour they are at any hour. Nothing is kept off it, as nothing was when it was drawn afresh after dark. */
const FLOOR_BAKE: BakeAs = { occludes: false, lit: false };
/** The shade on a tile is one ink at any hour, and laid on the ground, which nothing is kept off. */
const SHADE_BAKE: BakeAs = { occludes: false, lit: false };
/** A wall's or a roof's picture, where it was made, where its corner went, when, and how long it is kept. */
interface Baked {
  cv: HTMLCanvasElement;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  at: number;
  life: number;
  /** How long after the light moves on a step this one waits its turn to be made again. */
  wait: number;
  /** The count of the patches of the island it reads (`StructureWatch.version`), the view and the light it was made in. */
  ver: number;
  epoch: number;
  light: number;
  /** The view it was made in less the zoom (`bakeShape`), and the zoom: at another zoom in the same view it stands in, stretched (`baked`). */
  shape: number;
  zoom: number;
  /** The frame it was last drawn in (`bakeRoom`). */
  used: number;
}
/** How many device pixels of tile edge pictures are kept at one device pixel to a CSS pixel, about sixty-four megabytes, and the square of the screen's sharpness times that on one sharper (`hems`); past it, those gone longest undrawn go. */
const HEM_PIXELS = 16_000_000;
/** No one tile's edge picture is bigger than this; a tile that would be is drawn as it always was. */
const HEM_TILE_MOST = 400_000;
/** A tile's ruffled edges as a picture, where it was made, and where its top-left corner went (CSS pixels). */
interface HemPicture {
  cv: HTMLCanvasElement | null;
  px: number;
  py: number;
  bx: number;
  by: number;
  /** The zoom it was made at: at another, it is stretched about the tile's corner while the zoom moves (`hems`) and made again once it stops. */
  zoom: number;
  /** The frame it was last drawn in. */
  used: number;
}

/** The top of a wildermon crate's floor, in pixels at zoom 1: 0.7 units up. */
const CRATE_FLOOR = 0.7 * HEIGHT_SCALE;
/** How big a wildermon is drawn in a crate against out in the world, so a grown one stands inside it. */
const CRATE_SCALE = 0.8;

/**
 * A wildermon shut in a crate is drawn still: one picture of it for each look,
 * facing and size, kept and laid down every frame, rather than its model posed
 * afresh. Asked for: "Do not animate wildermon in crates when placed in the
 * world, leave them still. Having many out hinders fps immensely." Sizes go in
 * quarter-octave steps.
 *
 * A picture costs a posed model, a read of its pad and a crop, some ten
 * milliseconds, and a settlement keeps thirty crates in a row: every quarter
 * octave of a zoom made all thirty in one frame, a third of a second each
 * time. So the picture it had at another size
 * stands in, stretched, while the zoom moves (`stand`), and once it has
 * settled no more than `STILLS_A_FRAME` are made in a frame while one stands in.
 * The longest unused goes first past `STILLS_MOST`.
 */
const STILLS = new Map<string, { canvas: HTMLCanvasElement; ax: number; ay: number; k: number }>();
/** The last size made of each look, by its key less the size: what stands in for it at another. */
const STILL_LAST = new Map<string, string>();
/** Pictures kept before the longest unused is let go. */
const STILLS_MOST = 256;
/** Pictures made in a frame, once the zoom has settled, while another size stands in for each. */
const STILLS_A_FRAME = 3;
/** How far a picture is stretched to stand in: no more than four times or a quarter its size. */
const STILL_STAND_MOST = 4;
/**
 * `stand` is how many more may be made this frame where one at another size
 * could stand in: none while the zoom moves. Made, it comes off the count.
 */
function drawStill(g: CanvasRenderingContext2D, px: number, py: number, zoom: number, pose: CreaturePose, stand: { left: number }): void {
  const t = g.getTransform();
  const dev = Math.hypot(t.a, t.b) || 1;
  const k = 2 ** (Math.round(Math.log2(zoom * dev) * 4) / 4);
  const look = `${pose.species}|${pose.stage ?? 0}|${pose.colors.join(',')}|${pose.facing}|${pose.rare ?? 0}|${pose.fleece}|${pose.scale ?? 1}`;
  const key = `${look}|${k}`;
  let still = STILLS.get(key);
  if (still) {
    STILLS.delete(key);
    STILLS.set(key, still);
  } else {
    const was = STILL_LAST.get(look);
    const other = was === undefined ? undefined : STILLS.get(was);
    if (other && stand.left <= 0 && other.k * STILL_STAND_MOST >= k && k * STILL_STAND_MOST >= other.k) {
      still = other;
    } else {
      if (other) stand.left--;
      while (STILLS.size >= STILLS_MOST) STILLS.delete(STILLS.keys().next().value as string);
      // Drawn on a pad wide enough for the biggest, then cut to what it covers.
      const side = Math.min(2048, Math.ceil(260 * k * (pose.scale ?? 1)));
      const pad = document.createElement('canvas');
      pad.width = side;
      pad.height = side;
      const p = pad.getContext('2d') as CanvasRenderingContext2D;
      const fx = side / 2, fy = side * 0.8;
      drawCreature(p, fx, fy, k, { ...pose, id: undefined });
      const d = p.getImageData(0, 0, side, side).data;
      let x0 = side, y0 = side, x1 = -1, y1 = -1;
      for (let y = 0; y < side; y++) {
        for (let x = 0; x < side; x++) {
          if (d[(y * side + x) * 4 + 3] === 0) continue;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, x1 - x0 + 1);
      canvas.height = Math.max(1, y1 - y0 + 1);
      if (x1 >= 0) (canvas.getContext('2d') as CanvasRenderingContext2D).drawImage(pad, -x0, -y0);
      still = { canvas, ax: fx - x0, ay: fy - y0, k };
      STILLS.set(key, still);
      STILL_LAST.set(look, key);
    }
  }
  const m = zoom / still.k;
  g.drawImage(still.canvas, px - still.ax * m, py - still.ay * m, still.canvas.width * m, still.canvas.height * m);
}
import { FLOAT_COLOURS, Floaters } from './floaters';
import { inkOr, WORLD_INK } from './inks';
import { NameLabels } from './namelabels';
import { drawSpeech } from './bubble';
import { SKILL_BY_ID } from '../game/skills';
import { PUFFS, PUFF_DRIFT, PUFF_RISE, puffAge, puffOf } from './smoke';
import { CROWD, DROWNS, hemOf, ruffle, strew, strewLook, WADES, WADE_DEPTH, type Lobe } from './meadow';
import { SEAM_FROM, seam, seamWash } from './seams';
import { Timings } from './timings';
import { ColourPages, MarkPages } from './pages';
import { trailMask, trailShape, type TrailShape } from './trails';
import { clumpOf, FLOWER_COLOURS, flowerSprite, swayFrame, tileColour } from './flowers';
import { flowerSeason, flowersOn } from '../world/flowers';
import { drawFace, EDGES, ROCK_MOSS, sprigOf, topEdges, type Face } from './outcrops';
import { cropFrame, FIELD_LAYOUTS } from './crops';
import { forgetTrees, grownAt, stumpGrown, spriteScaleFor, bushSprite, crateSprite, cropFlatSprite, cropSprite, drawCampfire, drawCreature, creatureTop, type CreaturePose, drawPlayer, facingOf, lyingSprite, treeSprite, type Sprite, drawTrap, drawDeck, stumpSprite } from './sprites';
import { inkOf, READ_BACK } from './ink';
import { wildermonHead, wildermonSaddle, wildermonSeat, wildermonTop } from './wildermon';
import {
  drawDrawbridgeSpan,
} from './gates';
import { hingeKey, hingeOf, isDrawbridge, landingOf } from '../game/gates';
import { bridgeDone, bridgeLevels, deckHeight, type Bridge } from '../game/bridges';
import { bridgeNight, deckKey, drawBridgePiece, kitBridge, piecesAt, ropeKey, type BridgeFrame } from './bridgekit';
import { SmallLife } from './life';
import { personBody, SpellStage, type Aim, type Told, type Who } from './spells/stage';
import { ActionFx } from './fx/actions';
import { guessTold, type Standing } from './spells/guess';
import { creatureWide, fallGradient, lightHole } from './spells/kit';
import { spellInfo } from './spells/info';
import type { Body as SpellBody } from './spells/kit';
import type { CastAt, CastTold } from '../game/events';
import { lookStep, nextLookAt, yearAt } from './foliage';
import { DAY_SECONDS } from '../game/pace';
import { bodiesFrame, cartSway, drawBodies, FIGURE_TOP, figurePicture, sculptedFigures, sculptedReady, type FigurePose, type GearLook, type GearPiece, type GearSlot, type Seat } from './figure';
/**
 * How much larger a beast in the traces is drawn than one loose: enough that
 * a grown orse, the draught beast, stands a quarter again as tall as a body
 * (`FIGURE_TOP`), as a horse in harness stands over its driver. The rest of a
 * team is drawn up by the same, so a team keeps its kinds' sizes to each other.
 */
/**
 * A rider in the saddle: astride, the seat where the saddle is, and the reins
 * out over the withers to the bit, ahead of the saddle and up at the height
 * of the beast's mouth.
 */
const SADDLE: Seat = { hands: 'reins', up: 0, astride: true, grip: [0, 7.5, 2.5] };
/**
 * How far a rider's legs are drawn up on a mount whose model does not say (`Seat.tuck`), by how high its saddle is
 * (pixels at zoom one): none at `TUCK_NONE` units up or over, where the boots hang clear of the ground, all of it at
 * `TUCK_ALL` or under, where they would stand on it.
 */
const TUCK_NONE = 9, TUCK_ALL = 5;
const saddleTuck = (seat: number): number => Math.max(0, Math.min(1, (TUCK_NONE - seat / HEIGHT_SCALE) / (TUCK_NONE - TUCK_ALL)));
/** Reins: dark leather, inked. */
const REIN_LEATHER = 'rgb(112, 74, 46)';
const REIN_LINE = 'rgba(46, 30, 22, 0.85)';
/** The grown orse's top the draught size was set against, in pixels at zoom one: pinned, so its model changing does not resize every team. */
const DRAUGHT_ORSE_TOP = 31.4;
const TRACES_SCALE = Math.max(1, (1.25 * FIGURE_TOP) / DRAUGHT_ORSE_TOP);
import { cellarFloorHeight } from './cellar';
import { FOG_ALPHA, FOG_COLOR, FOG_INK } from './fog';
import { Picker, type PickHost, type Pick, type HitRect, type HitShape } from './picking';
import { WaterPainter, type WaterHost } from './waterdraw';
import { type Swayed, type Entity, PLAN_COLOR, FLIGHT_STEPS, rgb, type Ghost, type BakeAs } from './drawshared';
import { StairPainter, type StairHost } from './stairdraw';
import { CellarPainter, type CellarHost } from './cellardraw';
import { RoofPainter, type RoofHost } from './roofdraw';
import { WallPainter, type WallHost } from './walldraw';
export { type Ghost } from './drawshared';
export { type Pick } from './picking';
// After the rest: the game's tables are read as these load (`plinth.ts`).
import { drawPlinthRunes, plinthNight } from './plinth';
import { plinthBusy } from '../game/plinth';
import { ENCHANTERS_PLINTH } from '../game/enchant';

/**
 * One piece of a plan over an area, drawn before it is asked for
 * (`planarea.ts`): a wall on a side of a tile on a storey, a floor tile on a
 * storey, a roof tile, or a tile of a footprint on the ground; `ok` is whether
 * it would be planned, and a piece that would not is washed red.
 */
export interface PlanGhostPiece {
  kind: 'wall' | 'floor' | 'roof' | 'tile';
  x: number;
  y: number;
  side?: Side;
  level: number;
  ok: boolean;
}

/** Seconds a cart's rock and bump take to come on as she sets off, and to die away as she stops (`cartRoll`). */
const CART_EASE = 0.4;
/** Seconds the length of a frame is steadied over, for how blurred a cart's wheels are drawn (`wheelTurn`). */
const WHEEL_FRAME_EASE = 0.25;
/** Her roll stood still: given to her driver all the same, so the body takes back what she has, which is nothing (`reinsIn`). */
const CART_LEVEL = { heel: 0, pitch: 0 };
/** Draw through a sway from here on, until the canvas is restored. */
function swayIn(ctx: CanvasRenderingContext2D, w: Swayed): void {
  ctx.save();
  ctx.translate(w.ox, w.oy - w.up);
  ctx.transform(w.a, w.b, w.c, w.d, 0, 0);
  ctx.translate(-w.ox, -w.oy);
}
/** Where a point on the screen goes, drawn through a sway. */
const swayedAt = (w: Swayed | undefined, x: number, y: number): [number, number] =>
  w ? [w.ox + w.a * (x - w.ox) + w.c * (y - w.oy), w.oy - w.up + w.b * (x - w.ox) + w.d * (y - w.oy)] : [x, y];

/**
 * Where the people on a hull stand, for baking her in layers round them
 * (`Crew` in `./furniture`): her helm first, then each passenger's place, in
 * her own units. A hull with a deck of her own to stand on has one, and so
 * does the sailing boat, whose helmsman sits aft under her mast and sail
 * (`helmSeat`): drawn after the whole of her, he was drawn over the mast and
 * the sail from forward, where they are nearer you than he is. A rowing
 * boat's helm sits in her middle under nothing, and is drawn after her.
 */
const crews = new Map<string, Crew | null>();
function crewOf(kind: string): Crew | null {
  let c = crews.get(kind);
  if (c === undefined) {
    const boat = furnitureDef(kind).boat;
    const sat = helmSeat(kind);
    c = boat && (boat.helm || boat.deck?.length) ? {
      tall: FIGURE_TOP / HEIGHT_SCALE,
      at: [
        [(boat.helm?.[0] ?? 0) * UNITS_PER_TILE, (boat.helm?.[1] ?? 0) * UNITS_PER_TILE, boat.seat / HEIGHT_SCALE],
        ...(boat.deck ?? []).map(([along, across]): [number, number, number] => [along * UNITS_PER_TILE, across * UNITS_PER_TILE, (boat.waist ?? boat.seat) / HEIGHT_SCALE]),
      ],
    } : sat ? { tall: FIGURE_TOP / HEIGHT_SCALE, at: [sat] } : null;
    crews.set(kind, c);
  }
  return c;
}

/**
 * A wall drawn after a pilaster it runs out from (`Renderer.pilasterGuard`):
 * from `x` on the screen on, on its `side`, and what of it stands over the
 * pilaster's head nearer the corner inside the box `over` (x0, y0, x1, y1),
 * over the head's line where the pilaster is let go to be seen through.
 */
interface PilasterGuard {
  x: number;
  side: number;
  over: [number, number, number, number] | null;
  /** The pilaster's head's line along the face, where it crosses the box's two sides. */
  head: [number, number] | null;
  /** A head level with the wall's top (`columnSpan`): the pilaster laid again over the wall, kept to its head. */
  cap?: () => void;
}


/** The indices of the points on the convex hull of a handful of points, in order round it (Andrew's monotone chain). */
function convexHull(xs: readonly number[], ys: readonly number[]): number[] {
  const idx = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b] || ys[a] - ys[b]);
  const cross = (o: number, a: number, b: number): number => (xs[a] - xs[o]) * (ys[b] - ys[o]) - (ys[a] - ys[o]) * (xs[b] - xs[o]);
  const lower: number[] = [];
  for (const i of idx) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], i) <= 0) lower.pop();
    lower.push(i);
  }
  const upper: number[] = [];
  for (let k = idx.length - 1; k >= 0; k--) {
    const i = idx[k];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], i) <= 0) upper.pop();
    upper.push(i);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/**
 * A polygon onto a path, its points in `order`, wound the way a tile lying
 * the right way up is wound. Shapes gathered on one path and filled once
 * cover what any of them covers only while they all go round the same way:
 * one wound the other way takes a hole out of the rest where they overlap.
 * A steep tile folded over on itself on the screen comes the other way round.
 */
function windOn(path: Path2D, xs: ArrayLike<number>, ys: ArrayLike<number>, order: ArrayLike<number>): void {
  const n = order.length;
  let area = 0;
  for (let k = 0; k < n; k++) {
    const a = order[k];
    const b = order[(k + 1) % n];
    area += xs[a] * ys[b] - xs[b] * ys[a];
  }
  const at = (k: number): number => order[area >= 0 ? k : (n - k) % n];
  path.moveTo(xs[at(0)], ys[at(0)]);
  for (let k = 1; k < n; k++) path.lineTo(xs[at(k)], ys[at(k)]);
  path.closePath();
}
/** How much of its own colour remembered ground keeps. */
const MEMORY_SATURATION = 0.22;
/** How much of a bed of weed on the sea floor shows however deep it is, so it can be told from the floor (`drawSea`). */
const WEED_SEEN = 0.35;
const GRID_COLOR = 'rgba(0,0,0,0.16)';
const DEED_COLOR = 'rgba(96, 230, 110, 0.9)';
const DEED_SHADOW = 'rgba(0, 40, 0, 0.6)';
/** A previewed settlement the island would refuse (`Game.foundPreview`): its border in this, rather than `DEED_COLOR`. */
const PREVIEW_REFUSED = 'rgba(235, 92, 72, 0.95)';
/** How faint a previewed settlement's border at its last level is drawn, against its first level's. */
export const PREVIEW_MAX_WEIGHT = 0.4;
/** A plan over an area before it is asked for (`drawPlanGhost`): its pieces, and those that would be refused. */
const PLAN_GHOST_FILL = 'rgba(120, 220, 140, 0.32)';
const PLAN_GHOST_REFUSED = 'rgba(214, 58, 42, 0.38)';
const PLAN_GHOST_REFUSED_LINE = 'rgba(214, 58, 42, 0.9)';
/** The shade a wall throws on the ground at its foot: cool, as the shade on a wall's own turned face is. */
const SHADE_INK = 'rgba(50, 44, 70, 0.26)';
/** How much of a spiral staircase in front of the player climbing it is drawn in the window round the body. */
const SPIRAL_SEE_THROUGH = 0.35;
/** The ground under a jetty: open ground with a storey over it, in its shade. */
const JETTY_SHADE = 'rgba(50, 44, 70, 0.13)';
/**
 * Concrete, and the shadow line down a shutter board.
 *
 * A foundation is the one thing in the world whose whole point is that its
 * sides are vertical, so it is drawn as the box it is: a flat top at the level
 * it was poured to, and a face straight down from each edge the camera is on
 * to the corner heights the ground still has. Nothing else in the game has an
 * edge like that, which is exactly why it was asked for.
 */
const CONCRETE: readonly [number, number, number] = [172, 169, 160];
const CONCRETE_TRIM: readonly [number, number, number] = [112, 109, 102];
/** How deep a shutter board is, in height units: the width of one band of a foundation's side. */
const SHUTTER = 3;
/*
 * Scaffolding: what a plan looks like before anything is built on it.
 *
 * Reported as "there's currently nothing at all to show it's a plan", with a
 * picture of a tile whose tooltip said `Part of Oceanport · House · one
 * storey` over ground that looked exactly like the ground beside it. A plan
 * with no walls on it yet drew nothing whatever, because everything drawn for
 * a building hangs off a wall or a floor, and a fresh plan has neither.
 *
 * So the plan itself is drawn: stakes and string round the edge of the
 * footprint, the way a builder marks a site out before a stone is laid. Pale
 * timber for the stakes so they read as something standing there, and the
 * plan's own green for the string, so a run of it says the same word the
 * dashed outline of a planned wall says.
 */
const SCAFFOLD_POST = 'rgba(186, 158, 112, 0.95)';
const SCAFFOLD_TRIM = 'rgba(112, 88, 56, 0.95)';
const SCAFFOLD_LINE = 'rgba(120, 220, 140, 0.75)';
/** How tall a stake stands, as a share of a wall. Waist high on a body. */
const SCAFFOLD_HEIGHT = 0.42;
const SIDES: Side[] = ['n', 'e', 's', 'w'];

/** Which side of a tile a picked point is closest to. */
export function nearestSide(x: number, y: number, wx: number, wy: number): Side {
  const dn = wy - y;
  const ds = y + 1 - wy;
  const dw = wx - x;
  const de = x + 1 - wx;
  const m = Math.min(dn, ds, dw, de);
  return m === dn ? 'n' : m === ds ? 's' : m === dw ? 'w' : 'e';
}

/** A dye's hex, as the three numbers everything else here is drawn from. */
const hexRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** Strap hinges and a door ring: the only iron on a wall made of stone and oak. */
/**
 * Where the meadow starts, which is the zoom the game opens at.
 *
 * Further out than this a tile is sixty pixels across, a tuft is eight and a
 * daisy is two -- which is noise -- and there are three times as many tiles
 * on the screen to draw all of it on. Paving has the same rule at three
 * quarters and the ground speckles at a quarter more, for the same reason:
 * looking at the country is not the same job as standing in it.
 */
const MEADOW_FROM = 1;

/**
 * And where the ruffled join starts, which is further out than that.
 *
 * A clump is a thing in a field and from far enough away it is three pixels
 * of green on green, which is why the meadow waits. A join is the *shape* of
 * the country -- where the field stops and the track begins -- and the eye
 * reads that from a good deal further off than it reads anything standing in
 * it. It is also cheap: a run of lobes along one edge, against a picture
 * blitted per clump per tile.
 *
 * This is the zoom the blended seam it replaces used to start at, so the join
 * between two grounds is drawn over exactly the range it always was.
 */
const RUFFLE_FROM = 0.5;
/** How far up a face from the water the damp reaches, in height units: seven tenths of a metre. */
const DAMP_UNITS = 7;
/** How steep a tile is: the fall across it, as the ground's colour measures it. */
const slopeOf = (w: { getHeight(x: number, y: number): number }, x: number, y: number): number => {
  const h0 = w.getHeight(x, y), h1 = w.getHeight(x + 1, y), h2 = w.getHeight(x + 1, y + 1), h3 = w.getHeight(x, y + 1);
  return Math.hypot((h1 + h2 - h0 - h3) / 2 / UNITS_PER_TILE, (h2 + h3 - h0 - h1) / 2 / UNITS_PER_TILE);
};
/**
 * The zoom from which wildflowers are the painted clumps rather than a speck
 * of colour each: the level of detail everything else drops at, where a
 * clump would be ten pixels and a head two.
 */
const FLOWERS_DRAWN = 0.6;
/**
 * One side of a cut: the polygon in `a` (screen pairs, `n` numbers) kept to
 * the side of the line (x0, y0)-(x1, y1) that (cx, cy) is on, written into
 * `out`, and how many numbers it came to. Sutherland and Hodgman's, a line at
 * a time, which is all a convex tile needs.
 */
function cutByLine(a: Float64Array, n: number, x0: number, y0: number, x1: number, y1: number, cx: number, cy: number, out: Float64Array): number {
  const dx = x1 - x0, dy = y1 - y0;
  const s = dx * (cy - y0) - dy * (cx - x0) >= 0 ? 1 : -1;
  const side = (px: number, py: number): number => s * (dx * (py - y0) - dy * (px - x0));
  let m = 0;
  let px = a[n - 2], py = a[n - 1];
  let ps = side(px, py);
  for (let i = 0; i < n; i += 2) {
    const qx = a[i], qy = a[i + 1];
    const qs = side(qx, qy);
    if ((qs >= 0) !== (ps >= 0) && m + 2 <= out.length) {
      const t = ps / (ps - qs);
      out[m++] = px + (qx - px) * t;
      out[m++] = py + (qy - py) * t;
    }
    if (qs >= 0 && m + 2 <= out.length) {
      out[m++] = qx;
      out[m++] = qy;
    }
    px = qx;
    py = qy;
    ps = qs;
  }
  return m;
}

/** The radius of a lobe of grass along a worn path's edge, in screen pixels at zoom one: a shade under the ruffle's. */
const TRAIL_LOBE = 3.6;
/** From how close a path's grass is drawn with its shade under it as well as itself. */
const TRAIL_NEAR = 1.5;

/** Circles at `at` moved by (dx, dy) and grown by `grow`, filled in one colour as one shape. */
function circles(g: CanvasRenderingContext2D, at: Lobe[], n: number, dx: number, dy: number, grow: number, fill: string): void {
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const [x, y, r] = at[i];
    const rr = Math.max(0.25, r + grow);
    g.moveTo(x + dx + rr, y + dy);
    g.arc(x + dx, y + dy, rr, 0, 7);
  }
  g.fillStyle = fill;
  g.fill();
}
/** And the shade the grass along its edge throws on the path. */
const TRAIL_SHADE = 'rgba(70, 52, 30, 0.13)';

/** Which way is out through a piece's front, and which way its width runs, in the world, by the side it faces. */
const FRONT_OF: Record<Side, [number, number]> = { s: [0, 1], e: [1, 0], n: [0, -1], w: [-1, 0] };
const ACROSS_OF: Record<Side, [number, number]> = { s: [1, 0], e: [0, -1], n: [-1, 0], w: [0, 1] };

/** Specks of grain laid on each tile once you are close enough to see them. */
const GRAIN_SPECKS = 14;
/** The share of the screen's size the lights' holes in the night and their casts are worked out at: soft enough not to show it. */
export const LIGHT_RES = 0.5;
/** A rectangle: x, y, width, height. */
type Box = [number, number, number, number];
/** The colour an outline is drawn in round whatever the cursor is on. */
const HOVER_INK = 'rgb(255, 226, 120)';

export { sunAt } from './sun';

/** How finely the sun's walk is cut up: the ground is re-shaded on each step. */
const SUN_STEPS = 48;
/**
 * How long, in milliseconds, a frame may spend shading the ground afresh for a
 * new step of the sun (`groundColor`); past it a tile keeps the colour it had
 * at the step before until a later frame gets to it.
 */
const SUN_REPAINT_MS = 2;

/**
 * Something standing on the ground that reaches out over the tiles of the
 * lines in front of its own (`standsOn`): its line, the ground under it on
 * the screen and the box round that, and its drawings (`paint`) under the
 * screen's transform, to be drawn again over the ground of those lines there
 * (`footOver`).
 */
interface Foot {
  d: number;
  under: Path2D;
  box: [number, number, number, number];
  shapes: HitShape[];
  at: DOMMatrix;
  /** What was drawn after it where its foot is (`footShy`): drawn again after it, so still in front of it. */
  after: HitShape[];
}

/** How many sides the round a thing stands over is taken as (`footOver`). */
const FOOT_SIDES = 16;
/** How many lines in front of its own a thing's foot is looked for on (`footOver`). */
const FOOT_LINES = 4;
/** How far past its footprint, in tiles, what stands on it is drawn: a wagon's wheels, a smelter's plinth (`standsOn`). */
const FOOT_PAST = 0.12;
/** How far past a tile's edge, in pixels, its ground can have been laid with its smoothing (`outsetTile`): what of a foot is drawn again over it reaches that far. */
const FOOT_SEAM = 1;

/**
 * The wash over everything at this hour: warm at the two ends of the day, cold
 * in the middle of the night, nothing at all at noon. Dusk and dawn overlap
 * with the night's own blue, which is what gives the half-hour after sundown
 * its colour.
 */
export function skyWash(hour: number, dark: number): Array<{ colour: string; alpha: number }> {
  const out: Array<{ colour: string; alpha: number }> = [];
  // A bell on each end of the day, two hours wide.
  const bell = (centre: number): number => Math.max(0, 1 - Math.abs(hour - centre) / 2);
  const dusk = bell(DUSK);
  const dawn = bell(DAWN);
  if (dusk > 0.01) out.push({ colour: '255, 146, 58', alpha: dusk * 0.22 });
  if (dawn > 0.01) out.push({ colour: '255, 168, 146', alpha: dawn * 0.18 });
  if (dark > 0.01) out.push({ colour: NIGHT_WASH.colour, alpha: dark * NIGHT_WASH.alpha });
  return out;
}

/** The washes (`skyWash`) laid one over another, as the one colour they come to. */
function washInk(washes: ReadonlyArray<{ colour: string; alpha: number }>): string {
  let r = 0, g = 0, b = 0, a = 0;
  for (const w of washes) {
    const [wr, wg, wb] = w.colour.split(',').map(Number);
    const k = Math.round(w.alpha * 1000) / 1000;
    r = wr * k + r * (1 - k);
    g = wg * k + g * (1 - k);
    b = wb * k + b * (1 - k);
    a = k + a * (1 - k);
  }
  return a > 0 ? `rgba(${Math.round(r / a)}, ${Math.round(g / a)}, ${Math.round(b / a)}, ${a.toFixed(4)})` : 'rgba(0, 0, 0, 0)';
}

const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

/**
 * Draws the world onto the full-page canvas: terrain quads back to front, one
 * diagonal at a time, with trees and the player slotted in at their depth.
 */

/** The crops whose plants flower, which a butterfly will come to in a planter: the herbs and the fibre crops. */
const FLOWERING_LOOKS: ReadonlySet<CropLook> = new Set<CropLook>(['herb', 'fibre']);

/** How deep the lip `drawDeck` lays under a deck's edges that run left to right is, in zoom-one pixels. */
const DECK_EDGE = 2.5;

/**
 * The outlines a bridge's deck is drawn in on the screen, each as x, y
 * pairs: its tile at the deck's height (`q`, from the deck's middle in
 * zoom-one pixels), a tile's diamond where it has no shape, and the lip
 * `drawDeck` lays under each of its edges that runs left to right.
 */
function deckOutline(q: ReadonlyArray<readonly [number, number]> | undefined, sx: number, sy: number, zoom: number): Float64Array[] {
  const top = q ?? [[0, -24], [48, 0], [0, 24], [-48, 0]];
  const out = [new Float64Array(top.flatMap(([x, y]) => [sx + x * zoom, sy + y * zoom]))];
  top.forEach(([x, y], i) => {
    const [nx, ny] = top[(i + 1) % top.length];
    if (nx - x <= 0) return;
    const ax = sx + x * zoom, ay = sy + y * zoom, bx = sx + nx * zoom, by = sy + ny * zoom;
    out.push(Float64Array.of(ax, ay, bx, by, bx, by + DECK_EDGE * zoom, ax, ay + DECK_EDGE * zoom));
  });
  return out;
}

/** How far down the pier `drawDeck` stands a deck on reaches from just under its middle, in zoom-one pixels: nought for none. */
function deckPier(kind: string, drop: number): number {
  return drop > 2 && kind !== 'rope' ? Math.min(34, drop * 0.8) : 0;
}

/** You, as the spell stage names whoever casts. */
const PLAYER_CASTS: Who = { kind: 'player' };

/** How much of an anvil's rune the night's wash may take off before its rune takes the night off itself (\`Renderer.nightOver\`, \`anvilNight\`). */
const ANVIL_UNDER_WASH = 0.4;

/** Tiles round you within which a fire, a smelter or a kiln has its ring drawn (`drawStationRings`). */
export const RING_REACH = 14;
/** How high over the ground a hearth's ring stands, in the units `drawStationRings` lifts by: a brazier is a bowl, an oven a chest-high dome. */
const HEARTH_LIFT = { brazier: 34, oven: 44 };
/** The zoom below which the rings are left off, as too small to read. */
const RING_ZOOM = 0.55;

/** A field's lip of turned soil where it meets other ground (`fieldLip`): how far in, as a share of the way to the tile's middle, and its tones over the field's. */
const FIELD_LIP = 0.07;
const FIELD_LIP_TOP = 'rgba(255,232,206,0.22)';
const FIELD_LIP_SHADE = 'rgba(70,50,32,0.38)';
const FIELD_LIP_FOOT = 'rgba(58,40,26,0.5)';
/** The most a field's picture is sheared down the screen for each pixel across or down it (`fieldTilt`). */
const FIELD_TILT_MOST = 0.45;

/** Your gear with each enchanted piece marked so (`GearPiece.enchanted`: a sculpted figure's sword and armour glow): your own only, the wire not saying. */
function enchantedFrom(gear: GearLook | undefined, enchantOf: (slot: GearSlot) => unknown): GearLook | undefined {
  if (!gear) return gear;
  const out: GearLook = { ...gear };
  for (const slot of Object.keys(gear) as GearSlot[]) { const p = out[slot]; if (p && enchantOf(slot)) out[slot] = { ...p, enchanted: true }; }
  return out;
}

/** The tool a job is done with as a sculpted figure holds it (`FigurePose.tool`): the one the job uses, in its metal, lit when enchanted. */
function toolPiece(it: { id: string; extra?: string; rare?: number; enchant?: unknown } | undefined): GearPiece | undefined {
  if (!it) return undefined;
  const material = materialOf(it.extra)?.id;
  return { id: it.id, ...(material ? { material } : {}), ...(it.rare ? { rare: it.rare } : {}), ...(it.enchant ? { enchanted: true } : {}) };
}

export class Renderer {
  readonly camera = new Camera();
  /** The drawing clock, seconds: what fades and goes by (numbers rising, dust, pictures kept their time) is timed on it. */
  time = 0;
  /**
   * The clock what moves on its own is drawn at -- the sway, the water, smoke and fire, lights on things, cloth, a boat's
   * roll, a body's idle -- which is the drawing clock's, and stands where it is while animations are off (`held`).
   */
  anim = 0;
  hover: Pick | null = null;
  /** What is being set down, drawn after everything that stands. */
  ghost: Ghost | null = null;
  /** A plan over an area before it is asked for, every piece of it, over everything (`planarea.ts`). */
  planGhost: PlanGhostPiece[] | null = null;
  /** The tile the tile window is looking at, outlined so you can see which it is. */
  selected: { x: number; y: number; down?: boolean; level?: number } | null = null;
  fps = 0;
  private colors: ColourPages;
  /** Which step of the sun's walk the ground was last shaded for. */
  private lastSun = -1;
  /** The sun the ground was last shaded under: at night it holds still across steps (`sunAt`). */
  private sunWas: [number, number, number] | null = null;
  /**
   * The colours and path colours of the step before, laid where this step's
   * are not worked out yet (`SUN_REPAINT_MS`); dropped once a frame has
   * needed none of them. And when this frame's time for working them out is up.
   */
  private colorsWas: ColourPages | null = null;
  private trailPaintWas: ColourPages | null = null;
  private sunRepaintBy = Infinity;
  private sunWasUsed = false;
  /** Where a shadow falls this frame, in screen pixels, and how dark it is. */
  private shadow = { dx: 0, dy: 0, alpha: 0 };
  /*
   * The trees drawn as solids (`./trees3d`): the hour and darkness they are
   * baked for this frame, whether the wind moves them, and the ones drawn
   * last frame, for the shade they throw on the ground this one (`solidFrame`).
   */
  private solidHour = 12;
  private solidDark = 0;
  private solidSway = false;
  private solidPx = 0;
  private solidTurn = -1;
  /** A count of the world's changes, so the trees read off it are read again after one (`solidFrame`). */
  private solidRev = 0;
  /** When the trees' look next turns (`nextLookAt`), and the wall clock it was worked out at. */
  private lookTurns = 0;
  private lookFrom = Infinity;

  /** The look the trees turn to next and the sun's step when they do, once that is under `LOOK_AHEAD_S` away: what is made ahead for it (`tree3dIdle`). */
  private lookAhead(): { season: Season; day: number; step: number } | null {
    const wall = this.game.wallNow();
    if (wall >= this.lookTurns || wall < this.lookFrom) {
      this.lookTurns = nextLookAt(wall);
      this.lookFrom = wall;
    }
    const until = this.lookTurns - wall;
    if (!(until < LOOK_AHEAD_S)) return null;
    const h = (this.solidHour + (until / DAY_SECONDS) * 24) % 24;
    return { ...yearAt(this.lookTurns + 1), step: sunStepOf(h, darknessAt(h)) };
  }
  /** The trees drawn as solids in the shade's window, read off the world, and which of them shade which line under this sun. */
  private solidScan: {
    key: string;
    trees: Array<{ ix: number; iy: number; x: number; y: number; species: number; variant: number; form: number; grew: number; h: number; bush: boolean }>;
    top0: number;
    /** The lowest foot on the screen of the trees on each line: the next line's shade starts no higher, so it is never laid over one. */
    feet: Map<number, number>;
    /** And where each of those trees stands and how far round its foot it stands over the ground (`tree3dFoot`): the next line's shade is laid there before it, not after (`solidFoot`). */
    footAt: Map<number, Array<[number, number, number]>>;
    /** The same by tile (`x * 65536 + y`), with its line. */
    footOf: Map<number, [number, number, number, number]>;
    linesKey: string;
    lines: Map<number, Array<{ cv: HTMLCanvasElement; x: number; y: number; w: number; h: number }>>;
  } = { key: '', trees: [], top0: 0, feet: new Map(), footAt: new Map(), footOf: new Map(), linesKey: '', lines: new Map() };
  /** How dark the solid trees' and bushes' shade is laid this frame (`solidFrame`): 0 when none is. */
  private solidAlpha = 0;
  /** This frame's shade from them, a picture a line, where each is laid (`solidShadeLine`); and the screen's device pixels for a point of the ground's picture, `x * kx + ox`, `y * ky + oy`. */
  private solidShade: { strips: Map<number, { cv: HTMLCanvasElement; x: number; y: number; w: number; h: number; sx: number; sw: number; sh: number }>; kx: number; ox: number; ky: number; oy: number } | null = null;
  /** The darkening right at a solid tree's foot, laid under it (`solidFoot`): one picture, stretched to each. */
  private contactPic: HTMLCanvasElement | null = null;
  /** Each line's picture of that shade, what it shows, and where; and pictures put by to be used again. */
  private solidStripsKept = new Map<number, { sig: string; cv: HTMLCanvasElement; x0: number; top: number; wIso: number; k: number; band: number }>();
  private solidStripsFree: HTMLCanvasElement[] = [];
  /** Tile colours as the map remembers them, for ground nobody is watching. */
  private memColors: ColourPages;
  /**
   * Each tile's path mask plus one (`trails.ts`), worked out from the tiles
   * round it, for ground in sight and ground remembered; the shapes a path's
   * pieces are drawn in, by tile, with the mask they were made for; and the
   * colour of a path's bare earth on each tile in sight, shaded as the ground
   * under it is.
   */
  private trailMarks: MarkPages;
  private trailMemMarks: MarkPages;
  private trailShapes = new Map<number, { mask: number; shape: TrailShape }>();
  private trailPaint: ColourPages;
  /**
   * Each tile's wildflowers plus one: how many clumps, and the colour the
   * patch is mostly, three bits over the count (`flowerAt`). Kept until the
   * tile changes, the season turns, or a building goes up or comes down.
   */
  private flowerMarks: MarkPages;
  private flowerSeasonNow: Season | null = null;
  private flowerBuildings = -1;
  /** Coloured specks for the flowers of a line of ground seen from far off, by colour: x, y pairs. */
  private flowerSpecks: Float32Array[] = FLOWER_COLOURS.map(() => new Float32Array(4096));
  private flowerSpeckN: number[] = FLOWER_COLOURS.map(() => 0);
  /** Each steep tile's face (`outcrops.ts`): its top edges and what grows above them, kept until a tile round it changes. */
  private faces = new Map<number, Face>();
  private lastVision = -1;
  private pts = new Float64Array(8);
  /** The tile's outline in screen pixels from its anchor corner, worked out once a frame. */
  private shapeBuf = new Float64Array(8);
  private cornerBuf = [0, 0, 0, 0];
  /**
   * Corners for working out a colour, kept apart from the ones the draw loop
   * is holding. They used to share a buffer, and since a tile asks its
   * neighbours for their colours to blend the seam, the loop would find a
   * neighbour's heights where its own had been — so a tree stood at the wrong
   * height for a frame whenever a colour had to be worked out again, which is
   * every time the fog moves.
   */
  private colorBuf = [0, 0, 0, 0];
  private ents: Entity[] = [];
  /**
   * Entities are handed out of a pool rather than made fresh.
   *
   * Every tree, pile, crate, fire and animal on screen was an object literal,
   * built and thrown away on every frame — a few thousand of them a second,
   * all of them dead before the next frame starts. They are lent out of here
   * instead and given back when the row is done.
   *
   * `take` blanks every optional field, which is the whole safety of it: a
   * crate handed a creature's slot must not still be carrying that creature.
   * There is exactly one place that can go wrong and it clears the lot.
   */
  private entPool: Entity[] = [];
  private entN = 0;

  /**
   * A Runestone on one of its nine tiles: taken once, on the tile of the nine
   * on the line nearest the viewer (the middle one of those, at a turn where
   * three share it), at the middle of its centre tile, so that it is drawn
   * after everything behind it and before everything in front.
   */
  private takeStone(s: Runestone, x: number, y: number, V: View): void {
    const c = stoneCentre(s, this.game.world.w);
    const depth = (tx: number, ty: number): number => V.d[0] + V.d[1] * tx + V.d[2] * ty;
    let front = -Infinity;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) front = Math.max(front, depth(c.x + dx, c.y + dy));
    if (depth(x, y) !== front) return;
    const along: number[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (depth(c.x + dx, c.y + dy) === front) along.push(V.e[0] + V.e[1] * (c.x + dx) + V.e[2] * (c.y + dy));
    along.sort((a, b) => a - b);
    if (V.e[0] + V.e[1] * x + V.e[2] * y !== along[(along.length - 1) >> 1]) return;
    const cam = this.camera;
    const h = this.game.world.centerHeight(c.x, c.y);
    this.take('runestone', x, y, cam.worldToScreenX(c.x + 0.5, c.y + 0.5), cam.worldToScreenY(c.x + 0.5, c.y + 0.5, h), null).stone = s;
  }

  private take(kind: Entity['kind'], x: number, y: number, sx: number, sy: number, spr: Sprite | null): Entity {
    let e = this.entPool[this.entN];
    if (!e) {
      e = { kind, x, y, sx, sy, spr };
      this.entPool[this.entN] = e;
    } else {
      e.kind = kind;
      e.x = x;
      e.y = y;
      e.sx = sx;
      e.sy = sy;
      e.spr = spr;
    }
    this.entN++;
    e.creature = undefined;
    e.peer = undefined;
    e.crateId = undefined;
    e.fire = undefined;
    e.smelter = undefined;
    e.kiln = undefined;
    e.piece = undefined;
    e.anvil = undefined;
    e.post = undefined;
    e.trap = undefined;
    e.deck = undefined;
    e.plant = undefined;
    e.swirl = undefined;
    e.stone = undefined;
    e.totem = undefined;
    e.lift = undefined;
    e.drawDx = undefined;
    e.drawDy = undefined;
    e.standing = undefined;
    e.seat = undefined;
    e.seatFacing = undefined;
    e.rare = undefined;
    e.view = undefined;
    e.sway = undefined;
    e.layer = undefined;
    e.mote = undefined;
    e.fx = undefined;
    e.aq = undefined;
    e.bp = undefined;
    e.sp = undefined;
    e.spAlpha = undefined;
    e.key = undefined;
    e.tilt = undefined;
    e.clip = undefined;
    this.ents.push(e);
    return e;
  }
  /** The sea, the ponds, their shores and the wakes (`waterdraw.ts`). */
  private readonly waters = new WaterPainter(this.waterHost());
  /** Grain on bare ground, gathered a diagonal at a time so it costs two fills, not two a tile. */
  /**
   * The grain speckles for the row being drawn: three numbers apiece — x, y and
   * size — in two buffers that are filled and emptied rather than replaced.
   *
   * This was two fresh `Path2D` objects per row of the island, every frame,
   * zoomed in. They are filled onto the context's own path instead, which
   * `beginPath` empties for nothing.
   */
  private grainDark = new Float32Array(3 * 4096);
  private grainPale = new Float32Array(3 * 4096);
  private grainN = 0;
  private grainM = 0;
  /** The grass quads of the row being drawn, four corners apiece, for one fill. */
  /** The sea drawn since it was last laid (`layWater`), which a wake is kept to; null while nothing is leaving a wake. */
  private seaPath: Path2D | null = null;
  /** Whether the sea was laid under this frame (`drawSea`), so a tile of it draws nothing of its own. */
  private seaUnder = false;
  /** The tiles of stepping stones on the line of the ground being drawn, as x and y pairs: in sight, and only remembered. */
  private stoneRow: number[] = [];
  private stoneRowDim: number[] = [];
  /** The water round the feet of piers, by the tile in front of each, whose water they wait for (`piers.ts`). */
  private pierFeet = new Map<string, PierFoot[]>();
  /**
   * The lines of the ground with a tile of a building standing on piers in
   * the water, this frame, and those buildings: before each, the swell and
   * the wakes are laid over the water drawn so far (`layWater`).
   */
  private wetPierLines: Set<number> | null = null;
  private wetPierBuildings: Set<number> | null = null;
  /** The width the last tile of ground was edged in: its edge lies half that over the tiles beside it. */
  private groundEdge = 1;
  /** The foam a fountain's falling water lands in, made the first time one is drawn running. */
  private fountainFoam: HTMLCanvasElement | null = null;
  /** The water plants on the line of the ground being drawn, and what their drawing is told this frame. */
  private plantRow: WaterPlant[] = [];
  private plantFrame: PlantFrame | null = null;
  /** The top of the water on a tile as it is drawn this frame -- a pond still rising stands where it has got to -- or null where there is none. */
  private readonly drawnSurface = (x: number, y: number): number | null => {
    const w = this.game.world;
    if (!w.hasWater(x, y)) return null;
    let top = -Infinity;
    if (w.water) for (const p of w.water.pondsAt(x, y)) top = Math.max(top, this.springWater.levelOf(p));
    return top > -Infinity ? top : w.surfaceAt(x, y);
  };
  private readonly groundHere = (x: number, y: number): number => this.game.world.heightAt(x, y);
  /**
   * The water springs have made above the sea: its ponds, streams, falls and
   * wells as they are drawn (`./ponds`). Idle, and free, while there are none.
   */
  readonly springWater = new SpringWater();
  /** The aqueducts: their arches, their channels' water, and the falls at their spouts (`./aqueducts`). */
  private readonly aqueducts = new AqueductPainter();
  /** Which curtain each side of each pool's tiles is part of, worked out once a frame for all the tiles that ask (`runOf`). */
  private readonly poolRuns = new Map<number, Run | null>();
  /**
   * Butterflies, dragonflies, fireflies, and what comes down out of the trees
   * (`./life`): worked out once a frame from what is in view and the clock,
   * sorted in with what stands on each line of the ground, and free while
   * zoomed out past `LIFE_FROM`.
   */
  readonly life = new SmallLife();
  /**
   * Every spell on the screen (`./spells`): cast by you or by anybody in
   * sight, followed wherever its caster and its target go, drawn in among
   * everything else, and lighting the night.
   */
  readonly spells: SpellStage = new SpellStage({
    body: (w) => this.spellBody(w),
    ground: (x, y) => (this.game.world.inBounds(Math.floor(x), Math.floor(y)) ? this.game.world.heightAt(x, y) : 0),
    turn: (w, x, y) => this.spellTurn(w, x, y),
    companion: (w) => {
      if (w.kind !== 'player') return null;
      const c = this.game.creatures.active();
      return c ? this.spellBody({ kind: 'creature', id: c.id }) : null;
    },
    near: (x, y, r) => this.spellsNear(x, y, r),
  });
  /**
   * What bodies' work and blows throw off (`./fx/actions.ts`): fired by the marks on their clips as they are drawn, or
   * at a body for what the island says; drawn on the spells' stage, within its budget.
   */
  readonly actionFx: ActionFx = new ActionFx(this.spells, {
    body: (w) => this.spellBody(w),
    ground: (x, y) => (this.game.world.inBounds(Math.floor(x), Math.floor(y)) ? this.game.world.heightAt(x, y) : 0),
    groundColour: (tx, ty) => (this.game.world.inBounds(tx, ty) ? this.groundColor(tx, ty, true, this.sunNow) : null),
    tile: (tx, ty) => (this.game.world.inBounds(tx, ty) ? this.game.world.viewTile(tx, ty, true) : null),
    creature: (id) => this.game.creatures.get(id) ?? null,
    // Deflect, as the island keeps it on your row (`Player.held`): yours alone, as nobody else's is sent
    deflect: (w) => w.kind === 'player' && (this.game.player.held.deflect?.until ?? -Infinity) > this.game.time,
    foe: (w) => {
      const id = w.kind === 'player' ? this.game.fightTarget : w.kind === 'peer' ? this.game.roster.get(w.id)?.hurtBy : undefined;
      const b = id === null || id === undefined ? null : this.spellBody({ kind: 'creature', id });
      return b ? { x: b.x, y: b.y, z: b.z + b.tall * 0.5 } : null;
    },
    water: (x, y) => (this.game.world.inBounds(Math.floor(x), Math.floor(y)) ? this.drawnSurface(Math.floor(x), Math.floor(y)) : null),
    cast: (w) => {
      const at = w.kind === 'player' ? this.castSpot?.at : null, p = this.game.player;
      return at ? { x: p.x + at[0], y: p.y + at[1] } : null;
    },
    wake: (id, x, y) => {
      const w = this.game.world;
      if (w.inBounds(Math.floor(x), Math.floor(y)) && w.hasWater(Math.floor(x), Math.floor(y))) this.wakes.mark(id, x, y, this.time, 0.3);
    },
  });
  /** The season and its day, for the trees' look (`./foliage`): read once a frame off the wall clock, as the hud reads it. */
  private year = yearAt(Date.now() / 1000);
  /** What the small life asks of the island, made once rather than every frame. */
  private readonly lifeVisible = (x: number, y: number): boolean => this.game.vision.state(x, y) === VISIBLE;
  private readonly lifeCovered = (x: number, y: number): boolean => {
    const g = this.game;
    if (g.foundations.size) {
      const slab = g.slabAt(x, y);
      if (slab && !slab.pool) return true;
    }
    return g.buildings.list.size > 0 && g.buildings.buildingAt(x, y) !== undefined;
  };
  private readonly lifeIndoors = (x: number, y: number): boolean =>
    this.game.buildings.list.size > 0 && this.game.buildings.buildingAt(x, y) !== undefined;
  private readonly lifePieces = function* (this: Renderer): Iterable<{ kind: string; x: number; y: number; id: number; at: readonly [number, number] }> {
    for (const f of this.game.furniture.values()) {
      if (f.kind !== 'planter' && f.kind !== 'fish_pond') continue;
      // A planter only while what grows in it is in flower: a herb or a fibre crop from its growing stage on.
      if (f.kind === 'planter') {
        const c = this.game.planted.get(f.id);
        if (!c || c.stage < 2 || !FLOWERING_LOOKS.has(cropDef(c.id).look)) continue;
      }
      yield { kind: f.kind, x: f.x, y: f.y, id: f.id, at: furnitureCentre(f) };
    }
  }.bind(this);
  /** Every pond's water drawn this frame, so a wake crossing a pond is kept on it; null while nothing is leaving a wake. */
  private pondPath: Path2D | null = null;
  /** The highest of them. */
  private pondTop = 0;
  /** The highest pond the ground on the tile being drawn was laid again beside (`pondBank`), and so is dressed by the slope it has there; -Infinity where none. */
  private bankLevel = -Infinity;
  /** The colour and slope of each tile's ground beside a pond's water, by `y * width + x`, with the level and corner heights they were worked out for (`bankColour`). */
  private bankColours = new Map<number, { pages: ColourPages; level: number; h: number[]; gx: number; gy: number; colour: string }>();
  /** Whether a poured slab stands over a tile, for the water running past it. */
  private readonly slabOver = (x: number, y: number): boolean => !!this.game.slabAt(x, y);
  /** The corner a spring wells up at, for the drawing, by the spring's id. */
  private readonly wellAt = (id: number): readonly [number, number] | null => {
    const s = this.game.springs.list.get(id);
    return s ? [s.cx, s.cy] : null;
  };
  /** What everything on the water has left behind it. */
  readonly wakes = new Wakes();
  /** The colour of the water by its depth at each corner (`watertint.ts`). */
  private readonly tint: WaterTint;
  /** Which water below nought is the sea's and which is walled in from it (`seareach.ts`). */
  private readonly seaReach: SeaReach;
  /** The sea's shore, and the painter of it and of still water's edge (`shore.ts`). */
  private readonly shoreField: ShoreField;
  private readonly shore = new ShorePainter();
  /** Boxes of tiles whose water turned from the sea's to still or back, for the ground's blocks there to be made again (`SeaReach.settle`). */
  private reachMoved: ReachBox[] = [];
  /** What has been kicked up underfoot. */
  readonly dust = new Dust();
  /** Numbers and words standing over what they belong to. */
  readonly floaters = new Floaters();
  /** How long a thing keeps the white of being hit, in seconds. */
  private static readonly FLASH = 0.22;
  /** Which way the wind leans things on screen, and how hard, worked out once a frame. */
  private lean = { x: 0, y: 0, force: 0 };
  /** The light this frame, kept so anything needing a ground colour can ask for one. */
  private sunNow: [number, number, number] = [0, 0, 1];
  /** Everything burning this frame, after dark, for what glows under glass: read once a frame. */
  private lightsNow: LightSource[] = [];
  /** Glass with a light under it, laid over the night once the night is down: see `drawGlassGlow`. */
  /** `dx`, `dy`: how far the faces, worked out where they were, have moved on the screen since (`roofGlass`). */
  private glassNight: Array<{ faces: Array<{ path: Path2D; m: DOMMatrix }>; lights: Array<{ x: number; y: number; r: number; a: number }>; box: [number, number, number, number]; dx: number; dy: number }> = [];
  /** Roofs: pitched and flat, their gables, and their glass (`roofdraw.ts`). */
  private readonly roofs = new RoofPainter(this.roofHost());
  /** The sky this frame, which the haze over the distance is drawn in. */
  private sky: Sky = skyAt(0, 0);
  /** The season this frame, for the pots on a flight of steps and the roses on an arch. */
  private season: Season = 'spring';
  /** How a face of a flight of steps is lit: the light walls are drawn in (`faceLight`). */
  private readonly stepsLight = (ux: number, uy: number): number => this.faceLight(ux, uy);
  /** The wind as the surface sees it, worked out once a frame rather than per tile. */
  private surf = { dirX: 1, dirY: 0, force: 0.5 };
  private drawnTiles = 0;
  /** What is under a point on the screen (`picking.ts`). */
  private readonly picker = new Picker(this.pickHost());
  private playerFacing = 1;
  /** Where the line or the net in hand goes into the water (`castAim`), kept for the go it was found for. */
  private castSpot: { began: number | undefined; job: string; x: number; y: number; at: [number, number] | null } | null = null;
  private creatureHits: HitRect[] = [];
  /** The hostile creatures drawn this frame, and how to draw each again, for marking them over the trees (`drawThreats`). */
  private threats: Array<{ sx: number; sy: number; top: number; hunting: boolean; draw: (g: CanvasRenderingContext2D, px: number, py: number) => void }> = [];
  /** The names over the creatures and the people drawn this frame, laid out and drawn over all of it at the end (`NameLabels`). */
  private names = new NameLabels();
  private peerHits: HitRect[] = [];
  private crateHits: HitRect[] = [];
  private fireHits: HitRect[] = [];
  private smelterHits: HitRect[] = [];
  private kilnHits: HitRect[] = [];
  private furnitureHits: HitRect[] = [];
  /** The drawing order of the hit boxes this frame (`HitRect.seq`). */
  private hitSeq = 0;
  /** What `paint` has drawn of the entity being drawn, and the screen's own transform it is measured from. */
  private entPaints: HitShape[] = [];
  private paintBase: DOMMatrix | null = null;
  /** The line of the ground being drawn (`render`), or null outside that pass: what `standsOn` takes a thing's line from. */
  private lineNow: number | null = null;
  /** What stands on the lines just drawn and reaches over the ground of the lines in front (`standsOn`, `footOver`). */
  private feet: Foot[] = [];
  /** The feet the thing being drawn stands near (`footShy`), or null. */
  private shyOf: Foot[] | null = null;
  /**
   * The pieces drawn this frame with a light of their own -- an altar's stars
   * -- and where, so the night can be taken back off them when it is laid
   * down (`furnitureHoles`): they are drawn in their place among everything
   * else, and shine because the wash is thin over them, not because they are
   * painted over it.
   */
  private glows: Array<{ sx: number; sy: number; kind: string; view: PieceView }> = [];
  /** The mote swirls drawn this frame and where, for their light to be added over the night (`glowSwirl`). */
  private swirlsSeen: Array<{ s: Swirl; x: number; y: number }> = [];
  /**
   * The night taken off the runestones in view, in their runes' shapes and
   * kept off whatever stands in front of them (`RunestoneNight`). Opened at
   * the top of every frame after dark. Whatever draws a runestone in the
   * entity pass calls `stone` on it right after; everything drawn after that
   * in the depth order is kept by it where it falls on a stone -- through
   * `paint`, and a tree's picture in `drawTree` -- and the night pass lays
   * it with `cut`.
   */
  private runeNight = new RunestoneNight();
  /** The clips in force on the screen while the entity being drawn is drawn: under a jetty's floor, a flight's cut (`clipTo`). */
  private occClips: OccluderClip[] = [];

  /**
   * Something drawn now on the line pass that cannot be handed over as one
   * picture -- a wall not kept, a roof with a lamp under it, a pilaster, a
   * drawbridge's gallows -- drawn again by the same drawing onto the
   * runestones' keeping wherever its box (left, top, right, bottom on the
   * screen; everywhere, without one) falls on a stone after dark: the
   * drawing reads `this.canvas.ctx`, so for the length of it that is the
   * keeping, as `baked` makes it the picture.
   */
  private occludeLine(box: [number, number, number, number] | null, draw: () => void): void {
    if (!this.runeNight.keeping) return;
    const ctx = this.canvas.ctx;
    const [x0, y0, x1, y1] = box ?? [-1e5, -1e5, 1e5, 1e5];
    this.runeNight.occludeDraw(ctx, x0, y0, x1 - x0, y1 - y0, (g) => {
      // What the screen's pen was left holding, which the drawing reads without setting.
      g.lineCap = ctx.lineCap;
      g.lineJoin = ctx.lineJoin;
      g.miterLimit = ctx.miterLimit;
      g.lineWidth = ctx.lineWidth;
      g.strokeStyle = ctx.strokeStyle;
      g.fillStyle = ctx.fillStyle;
      g.font = ctx.font;
      g.setLineDash(ctx.getLineDash());
      const canvas = this.canvas as { ctx: CanvasRenderingContext2D };
      canvas.ctx = g;
      try {
        draw();
      } finally {
        canvas.ctx = ctx;
      }
    });
  }

  /**
   * A tile of ground just laid on the line pass, as the four corners in
   * `pts`: on the runestones' keeping wherever it falls on one. Ground in
   * front of a stone is a bank between it and the eye -- a stone at the foot
   * of a rise seen from over it -- and covers it as any wall does. Its quad
   * is the whole of what it covers; what is strewn on it stands inside it
   * but for the tips of the grass.
   */
  /**
   * A tile's outline, every edge moved half a pixel out, onto the path: what
   * a fill and then a stroke a pixel wide in the same colour covered, as one
   * shape. Each corner is where its two moved edges cross, kept to two pixels
   * out at the sharpest. False, and nothing put on the path, for a tile that
   * is not convex on the screen -- folded over on a cliff, or flat to a line.
   */
  private outsetTile(ctx: CanvasRenderingContext2D, pts: ArrayLike<number>, by = 0.5): boolean {
    const turn = this.outsetTurn(pts);
    if (!turn) return false;
    const n = this.outsetNormals;
    for (let i = 0; i < 4; i++) {
      const a = i * 2, b = ((i + 1) & 3) * 2;
      const ex = pts[b] - pts[a], ey = pts[b + 1] - pts[a + 1];
      const l = Math.hypot(ex, ey);
      // Outward, for a path going round clockwise on the screen and for one going the other way.
      n[a] = (turn * ey) / l;
      n[a + 1] = (-turn * ex) / l;
    }
    for (let i = 0; i < 4; i++) {
      const a = i * 2, p = ((i + 3) & 3) * 2;
      const sx = n[p] + n[a], sy = n[p + 1] + n[a + 1];
      // Half a pixel (`by`) out along both edges' normals: that over one plus their dot, kept to four times it.
      const k = Math.min((4 * by) / Math.max(Math.hypot(sx, sy), 1e-6), by / Math.max(1 + n[p] * n[a] + n[p + 1] * n[a + 1], 1e-6));
      const x = pts[a] + sx * k, y = pts[a + 1] + sy * k;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    return true;
  }
  private readonly outsetNormals = new Float64Array(8);

  /** The transform the ground of this line is laid under (`occludeGround`). */
  private groundMatrix: DOMMatrix | undefined;
  /** Which way round a tile goes on the screen, as one or minus one: every corner must turn the same way. Nought for one folded over. */
  private outsetTurn(pts: ArrayLike<number>): number {
    let turn = 0;
    for (let i = 0; i < 4; i++) {
      const a = i * 2, b = ((i + 1) & 3) * 2, c = ((i + 2) & 3) * 2;
      const z = (pts[b] - pts[a]) * (pts[c + 1] - pts[b + 1]) - (pts[b + 1] - pts[a + 1]) * (pts[c] - pts[b]);
      if (Math.abs(z) < 1e-6) return 0;
      const sz = z > 0 ? 1 : -1;
      if (turn && sz !== turn) return 0;
      turn = sz;
    }
    return turn;
  }

  private occludeGround(ctx: CanvasRenderingContext2D, pts: ArrayLike<number>, minY: number, maxY: number): void {
    const minX = Math.min(pts[0], pts[2], pts[4], pts[6]);
    const maxX = Math.max(pts[0], pts[2], pts[4], pts[6]);
    if (!this.runeNight.falls(ctx, minX, minY, maxX - minX, maxY - minY, this.groundMatrix)) return;
    this.runeNight.occludeDraw(ctx, minX, minY, maxX - minX, maxY - minY, (g) => {
      g.beginPath();
      g.moveTo(pts[0], pts[1]);
      g.lineTo(pts[2], pts[3]);
      g.lineTo(pts[4], pts[5]);
      g.lineTo(pts[6], pts[7]);
      g.closePath();
      g.fillStyle = '#000';
      g.fill();
    });
  }
  private anvilHits: HitRect[] = [];
  /** The Runestones and settlement tokens drawn this frame, each the box its standing stone covers, picked as its centre tile. */
  private stoneHits: HitRect[] = [];
  private postHits: HitRect[] = [];
  private trapHits: HitRect[] = [];
  private deckHits: HitRect[] = [];
  /** Painted materials, worked out once each and kept: there are not many. */
  private readonly paints = new Map<string, MaterialDef>();
  /** Which way each beast is turned, so the answer holds still between frames. */
  private readonly beastFacing = new Map<number, number>();
  /**
   * How hard every body on screen is going, read off the ground it covers.
   *
   * Kept by the renderer rather than by the game because it is a drawing
   * question — nothing in the rules cares whether a rabba is trotting — and
   * because reading it here gets a person, a peer and a wildermon all at once
   * without a field on any of them.
   */
  private readonly gaits = new Gaits();
  /** How long the frame being drawn is, for anything worked out per second. */
  private frameDt = 1 / 60;
  /** Whether the fields are waiting out a winter this frame: nothing in one grows, and it is drawn so. */
  private dormant = false;
  private cropStep = 0;
  /**
   * The tiles of the room the player is standing in, for the cutaway.
   *
   * Walls facing the camera used to be taken away — or faded — by *building*:
   * step inside a longhouse and every near wall of the whole house went
   * translucent, the far bedroom's included, though nothing in the bedroom
   * was between you and anything. There are rooms now, so the question can be
   * asked properly: a wall is in your way when it stands on the edge of the
   * room you are actually in.
   *
   * Worked out once a frame rather than once a wall, because it is a flood
   * fill; null when you are out of doors, which is most of the time and
   * costs nothing.
   */
  private roomTiles: Set<string> | null = null;
  /** The storey pinned on the storey control this frame (`Game.pinnedStorey`), or null. */
  private pinned: number | null = null;
  /**
   * The shade each wall throws on the ground, worked out the first time a
   * tile asks for it: up to six tiles ask after the same wall, and every
   * tile near a building asks after twelve. By the storey and the border as
   * one number (`shadeKey`). Kept from frame to frame while the buildings,
   * the ground under them, the view and the cutaway stand as they were
   * (`shadeFor`, `structuresFrame`).
   */
  private shades = new Map<number, Float64Array | null>();
  /** Whether any of those reaches a tile, by its storey and the tile as one number: kept and dropped with them. */
  private shaded = new Map<number, boolean>();
  private shadeFor = '';
  private readonly shadeAsk: Border = { dir: 'h', x: 0, y: 0 };
  /** What has changed about the buildings, and where (`structwatch.ts`): looked over once a frame. */
  private readonly structs = new StructureWatch();
  /** The pitched roofs to lay this frame, by the line of the ground after whose walls each goes on. */
  private roofQueue = new Map<number, Building[]>();
  /**
   * Looking into a cellar this frame (`Game.cellarView`); the buildings over
   * the cellars, which are taken off while you are; every tile of every
   * cellar in the order it was laid; and each one's outline on the screen,
   * from its floor to the ground floor over it, for the dark and for a click.
   */
  private cellarFrame = false;
  private cut = new Set<number>();
  /** Cellars: the view down into one and the openings over them (`cellardraw.ts`). */
  private readonly cellars = new CellarPainter(this.cellarHost());
  private cellarHulls: Array<{ x: number; y: number; hull: Array<[number, number]>; floor: Array<[number, number]> }> = [];
  /** While a cellar's own things are being laid, so a ghost over one is drawn then and not with the ground over it. */
  private inCellarPass = false;
  /** Each building's roof, worked out once for the tiles it covers and kept until they change. */
  private roofShapes = new Map<number, { sig: string; model: RoofModel }>();
  /**
   * Which way a cart, a wagon or a hull was last going, by piece, so it keeps
   * pointing there when it stops. Kept to the nearest sixty-fourth of a turn,
   * finer than a cart can be seen to turn, so one being driven is drawn from
   * a handful of pictures of itself rather than a new one every frame.
   */
  private pieceHeadings = new Map<number, number>();
  /** A floor's picture as a pattern, by material, paint and size. */
  private floorPatterns = new Map<string, CanvasPattern>();
  /** Staircases, spiral staircases and ladders (`stairdraw.ts`). */
  private readonly stairs = new StairPainter(this.stairHost());


  constructor(
    private readonly canvas: FullscreenCanvas,
    private readonly game: Game,
  ) {
    this.colors = new ColourPages(game.world.w);
    this.memColors = new ColourPages(game.world.w);
    this.trailMarks = new MarkPages(game.world.w);
    this.trailMemMarks = new MarkPages(game.world.w);
    this.trailPaint = new ColourPages(game.world.w);
    this.flowerMarks = new MarkPages(game.world.w);
    game.world.onChange((x, y) => this.invalidate(x, y));
    game.world.onChange((x, y) => this.chunks.touch(x, y));
    // The water's colour and its shore, worked out a block of corners at a time (`watertint.ts`, `shore.ts`).
    this.tint = new WaterTint(game.world);
    this.seaReach = new SeaReach(game.world);
    this.shoreField = new ShoreField(game.world, (cx, cy) => this.seaReach.sea(cx, cy));
    game.world.onChange((x, y) => {
      this.tint.touched(x, y);
      this.seaReach.touched(x, y);
      this.shoreField.touched(x, y);
    });
    game.world.onChange(() => { this.solidRev++; });
    // Ground dug under or beside a stream moves the line it runs along.
    game.world.onChange((x, y) => this.springWater.touched(x, y));
    // And what is near a tree or near water, for the fireflies.
    game.world.onChange(() => this.life.touched());
    // And what stands on the ground, or near it: a wall's foot, its shade, how wet it is (`structwatch.ts`).
    game.world.onChange((x, y) => this.structs.ground(x, y));
    // Whatever the game says has changed in the world may be set on a wall or a floor in place (`Buildings.changed`).
    game.events.on('world', () => game.buildings.changed());
    // Damage and skill both go up over the thing they happened to. Damage adds
    // up per target, skill per skill, so a flurry of either reads as one
    // running number rather than a stack of them.
    // what came of your own fishing go, for the fish brought out at the float (`./fx/fishing.ts`)
    game.events.on('log', (e) => this.actionFx.told(e.text));
    game.events.on('hit', (x, y, amount, kind) => {
      const key = `${kind}:${Math.round(x)},${Math.round(y)}`;
      this.floaters.add(x, y, kind, key, amount, this.time, (total) => (total < 0.05 ? 'blocked' : `${kind === 'taken' ? '-' : ''}${total < 10 ? total.toFixed(1) : Math.round(total)}`));
    });
    game.events.on('skill', (id, gain) => {
      if (gain <= 0) return;
      const name = SKILL_BY_ID.get(id)?.name ?? id;
      const p = game.player;
      this.floaters.add(p.x, p.y, 'skill', `skill:${id}`, gain, this.time, (total) => `${name} +${total.toFixed(2)}`);
    });
    // A turn of work throws something up where the work is going: chips off
    // the rock, earth off the spade, in the colour of whatever is there.
    game.events.on('strike', (x, y) => {
      if (this.camera.zoom < 0.6 || this.still || this.held) return;
      const tx = Math.floor(x);
      const ty = Math.floor(y);
      const w = game.world;
      if (!w.inBounds(tx, ty) || w.heightAt(x, y) < w.surfaceAt(tx, ty)) return;
      const tone = dustTone(this.groundColor(tx, ty, true, this.sunNow));
      this.dust.burst(x, y, this.time, tone, Math.max(0.45, dustiness(w.viewTile(tx, ty, true))));
    });
    // A spell cast, yours or anybody's in sight: drawn from whoever cast it at whatever it was cast at.
    game.events.on('cast', (c) => {
      const by: Who = c.by === null ? { kind: 'player' } : { kind: 'peer', id: c.by };
      this.spells.play(c.spell, by, this.spellAim(c.at), {
        mine: c.by === null, companion: c.companion, from: c.from, targetFrom: c.targetFrom, told: c.told && this.spellTold(c.told),
      });
    });
    // Something of a spell's that fired after its cast (a Ward Link's skin going back over somebody), for its cast to draw.
    game.events.on('castFired', (f) => {
      const by: Who = f.by === null ? { kind: 'player' } : { kind: 'peer', id: f.by };
      const on = this.spellAim(f.on);
      this.spells.fired(f.spell, by, on.kind === 'spot' || on.kind === 'self' ? null : on, f.size);
    });
    game.events.on('reset', () => {
      this.spells.clear();
      this.actionFx.clear();
      this.floaters.clear();
      this.dust.clear();
      this.wakes.clear();
      this.gaits.clear();
      this.tint.clear();
      this.seaReach.clear();
      this.shoreField.clear();
    });
    canvas.onResize(() => this.camera.setViewport(canvas.width, canvas.height));
    this.camera.setViewport(canvas.width, canvas.height);
  }

  /** What `walldraw.ts` reaches of the renderer. */
  private wallHost(): WallHost {
    const r = this;
    return {
      atSize: r.atSize.bind(r),
      baked: r.baked.bind(r),
      get bloom() { return r.bloom; },
      get camera() { return r.camera; },
      get canvas() { return r.canvas; },
      get deckHits() { return r.deckHits; },
      get drawbridges() { return r.drawbridges; },
      edgeOn: r.edgeOn.bind(r),
      engagedIn: r.engagedIn.bind(r),
      get ents() { return r.ents; },
      faceLight: r.faceLight.bind(r),
      get frameNo() { return r.frameNo; },
      get game() { return r.game; },
      get gateDeferred() { return r.gateDeferred; },
      get gateIn() { return r.gateIn; },
      get gateLate() { return r.gateLate; },
      get greenAt() { return r.greenAt; },
      get landings() { return r.landings; },
      liftWall: r.liftWall.bind(r),
      get lightsNow() { return r.lightsNow; },
      masonryOf: r.masonryOf.bind(r),
      occludeLine: r.occludeLine.bind(r),
      painted: r.painted.bind(r),
      get project() { return r.project; },
      get runeNight() { return r.runeNight; },
      standing: r.standing.bind(r),
      storeyHidden: r.storeyHidden.bind(r),
      get structs() { return r.structs; },
      get time() { return r.time; },
      get anim() { return r.anim; },
      get wallLift() { return r.wallLift; },
      set wallLift(v) { r.wallLift = v; },
    };
  }

  /** What `roofdraw.ts` reaches of the renderer. */
  private roofHost(): RoofHost {
    const r = this;
    return {
      get bakeEpoch() { return r.bakeEpoch; },
      baked: r.baked.bind(r),
      buildingBase: r.buildingBase.bind(r),
      get camera() { return r.camera; },
      get canvas() { return r.canvas; },
      get cut() { return r.cut; },
      faceLight: r.faceLight.bind(r),
      get game() { return r.game; },
      get glassNight() { return r.glassNight; },
      get lightsNow() { return r.lightsNow; },
      masonryOf: r.masonryOf.bind(r),
      occludeLine: r.occludeLine.bind(r),
      painted: r.painted.bind(r),
      get roofQueue() { return r.roofQueue; },
      get roofShapes() { return r.roofShapes; },
      get roomTiles() { return r.roomTiles; },
      seeThroughCtx: r.seeThroughCtx.bind(r),
      storeyHidden: r.storeyHidden.bind(r),
      get structs() { return r.structs; },
      get sunNow() { return r.sunNow; },
    };
  }

  /** What `cellardraw.ts` reaches of the renderer. */
  private cellarHost(): CellarHost {
    const r = this;
    return {
      get anvilHits() { return r.anvilHits; },
      get camera() { return r.camera; },
      get canvas() { return r.canvas; },
      get cellarHulls() { return r.cellarHulls; },
      get crateHits() { return r.crateHits; },
      get creatureHits() { return r.creatureHits; },
      get deckHits() { return r.deckHits; },
      drawEntities: r.drawEntities.bind(r),
      drawGhost: r.drawGhost.bind(r),
      get entN() { return r.entN; },
      set entN(v) { r.entN = v; },
      get ents() { return r.ents; },
      faceLight: r.faceLight.bind(r),
      get fireHits() { return r.fireHits; },
      flicker: r.flicker.bind(r),
      footAt: r.footAt.bind(r),
      get furnitureHits() { return r.furnitureHits; },
      get game() { return r.game; },
      get ghost() { return r.ghost; },
      get inCellarPass() { return r.inCellarPass; },
      set inCellarPass(v) { r.inCellarPass = v; },
      get kilnHits() { return r.kilnHits; },
      logsAt: r.logsAt.bind(r),
      get names() { return r.names; },
      nightLayer: r.nightLayer.bind(r),
      get peerHits() { return r.peerHits; },
      get postHits() { return r.postHits; },
      get smelterHits() { return r.smelterHits; },
      get stairs() { return r.stairs; },
      take: r.take.bind(r),
      get trapHits() { return r.trapHits; },
      viewOf: r.viewOf.bind(r),
      get year() { return r.year; },
    };
  }

  /** What `stairdraw.ts` reaches of the renderer. */
  private stairHost(): StairHost {
    const r = this;
    return {
      get camera() { return r.camera; },
      get canvas() { return r.canvas; },
      get cut() { return r.cut; },
      faceLight: r.faceLight.bind(r),
      get game() { return r.game; },
      masonryOf: r.masonryOf.bind(r),
      painted: r.painted.bind(r),
      seeThroughCtx: r.seeThroughCtx.bind(r),
      take: r.take.bind(r),
    };
  }

  /** What `waterdraw.ts` reaches of the renderer. */
  private waterHost(): WaterHost {
    const r = this;
    return {
      get bankColours() { return r.bankColours; },
      get bankGx() { return r.bankGx; },
      set bankGx(v) { r.bankGx = v; },
      get bankGy() { return r.bankGy; },
      set bankGy(v) { r.bankGy = v; },
      get bankLevel() { return r.bankLevel; },
      set bankLevel(v) { r.bankLevel = v; },
      get camera() { return r.camera; },
      get canvas() { return r.canvas; },
      get colors() { return r.colors; },
      computeColor: r.computeColor.bind(r),
      get fast() { return r.fast; },
      get frameNo() { return r.frameNo; },
      get game() { return r.game; },
      get memColors() { return r.memColors; },
      get pondPath() { return r.pondPath; },
      set pondPath(v) { r.pondPath = v; },
      get pondTop() { return r.pondTop; },
      set pondTop(v) { r.pondTop = v; },
      get seaPath() { return r.seaPath; },
      set seaPath(v) { r.seaPath = v; },
      get seaReach() { return r.seaReach; },
      get shore() { return r.shore; },
      get shoreField() { return r.shoreField; },
      get springWater() { return r.springWater; },
      get sunNow() { return r.sunNow; },
      get surf() { return r.surf; },
      // The water's clock is the one its swell, its shimmer and its wakes move on: held while animations are off.
      get time() { return r.anim; },
      get tint() { return r.tint; },
      get wakes() { return r.wakes; },
      get wetPierBuildings() { return r.wetPierBuildings; },
      set wetPierBuildings(v) { r.wetPierBuildings = v; },
      get wetPierLines() { return r.wetPierLines; },
      set wetPierLines(v) { r.wetPierLines = v; },
    };
  }

  /** What `picking.ts` reaches of the renderer. */
  private pickHost(): PickHost {
    const r = this;
    return {
      get anvilHits() { return r.anvilHits; },
      get aqueducts() { return r.aqueducts; },
      get camera() { return r.camera; },
      get cellarHulls() { return r.cellarHulls; },
      get crateHits() { return r.crateHits; },
      get creatureHits() { return r.creatureHits; },
      get deckHits() { return r.deckHits; },
      get fireHits() { return r.fireHits; },
      get furnitureHits() { return r.furnitureHits; },
      get game() { return r.game; },
      get kilnHits() { return r.kilnHits; },
      get peerHits() { return r.peerHits; },
      get postHits() { return r.postHits; },
      get pts() { return r.pts; },
      roofFrame: r.roofs.roofFrame.bind(r.roofs),
      get roofQueue() { return r.roofQueue; },
      get roofShapes() { return r.roofShapes; },
      get smelterHits() { return r.smelterHits; },
      get stoneHits() { return r.stoneHits; },
      get trapHits() { return r.trapHits; },
    };
  }

  get tilesDrawn(): number {
    return this.drawnTiles;
  }

  /**
   * Sprites already the size they are about to be drawn.
   *
   * A tree is a canvas drawn at its own scale and then squeezed down to
   * whatever the zoom is, and squeezing a picture is the expensive half of
   * putting one on the screen. A wood is a hundred and seventy trees drawn
   * from about eight pictures, so it was doing that same squeeze a hundred and
   * seventy times a frame for eight answers.
   *
   * Each one is squeezed once, into a canvas of its own at the size the screen
   * wants, and then blitted. It was all thrown away whenever the zoom changed,
   * which made a zoom a couple of hundred new canvases every frame of it, each
   * used once. They are kept across zooms now, the least lately used going
   * past `SCALED_PIXELS`; while the zoom moves the nearest size a sprite
   * already has is stretched to the one wanted, and once it has stopped
   * (`zoomSettled`) each is made again at its own size the first time it is
   * asked for at that zoom.
   *
   * Kept at device pixels rather than CSS ones, because the context is scaled
   * by the display's ratio: a canvas made at CSS size would be blown back up
   * on the way out and come out softer than it does now.
   */
  private scaled = new Map<HTMLCanvasElement, HTMLCanvasElement>();
  /** Rescaled copies of each sprite, kept per eighth of a size. */
  private scaledSizes = new Map<HTMLCanvasElement, Map<number, HTMLCanvasElement>>();
  /** The distance-mixed copies of each rescaled sprite, one per haze step. */
  private hazes = new WeakMap<HTMLCanvasElement, HTMLCanvasElement[]>();
  /** Each rescaled copy, the least lately used first: what it is of, its size step, the zoom it was made at and the frame it was last asked for. */
  private scaledUse = new Map<HTMLCanvasElement, { src: HTMLCanvasElement; step: number; zoom: number; used: number }>();
  /** Device pixels in the rescaled copies and their hazed ones together. */
  private scaledPixels = 0;

  /** The same sprite, already down to `w` by `h` CSS pixels. */
  /**
   * The same picture with the distance mixed into it, at full opacity.
   *
   * Distance used to be done by laying the tree on thinner, which is the
   * obvious thing and the wrong one: a half-transparent tree is a tree you
   * can see through, so the bushes and the conifer fronds standing behind a
   * far crown read straight out through the front of it. Shapes reading as
   * flat cutouts is the first thing this whole look rests on, and a faded
   * tree is not a cutout, it is a stain.
   *
   * So the colours are mixed toward the distance instead and the thing stays
   * solid. `source-atop` does it inside the sprite's own alpha, which is why
   * it has to happen on a canvas of its own -- done straight onto the
   * picture it would wash the ground round the tree as well as the tree.
   *
   * Six steps rather than a continuous amount, and each step kept against
   * the already-scaled canvas, so a wood of a hundred trees builds at most
   * six of these per sprite per zoom instead of one per tree per frame.
   */
  private hazed(ready: HTMLCanvasElement, step: number): HTMLCanvasElement {
    let steps = this.hazes.get(ready);
    if (!steps) {
      steps = [];
      this.hazes.set(ready, steps);
    }
    const had = steps[step];
    if (had) return had;
    const cv = document.createElement('canvas');
    cv.width = ready.width;
    cv.height = ready.height;
    const g = cv.getContext('2d');
    if (g) {
      g.drawImage(ready, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = (step / HAZE_STEPS) * 0.62;
      g.fillStyle = css(this.sky.far);
      g.fillRect(0, 0, cv.width, cv.height);
    }
    steps[step] = cv;
    // Counted with the copy it was made from, and gone with it (`atSize`).
    if (this.scaledUse.has(ready)) this.scaledPixels += cv.width * cv.height;
    return cv;
  }

  /*
   * `w` and `h` used to be taken on trust: the first caller for a sprite got
   * a canvas at its size and every later one got that same canvas back
   * whatever it had asked for. That was true while every tree of a species
   * was drawn at one size, and stopped being true the moment they each grew
   * their own -- an emergent oak was being blown up from a canvas cut for an
   * understorey sapling of the same species, and went soft for it. Kept per
   * eighth of a size now, which is under what the eye picks up and still
   * only a handful of canvases per sprite.
   */
  private atSize(src: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
    const step = Math.max(1, Math.round(w / 8));
    let sizes = this.scaledSizes.get(src);
    if (!sizes) {
      sizes = new Map();
      this.scaledSizes.set(src, sizes);
    }
    const dpr = this.canvas.dpr;
    const zoom = this.camera.zoom;
    const cw = Math.max(1, Math.round(w * dpr));
    // A height of nought means square, which is what a ground picture is.
    const ch = h > 0 ? Math.max(1, Math.round(h * dpr)) : cw;
    const had = sizes.get(step);
    /*
     * The zoom still moving: the size this step had, or failing that the
     * nearest the sprite has within `STAND_IN_MOST` of it, stretched by
     * whoever draws it -- every caller puts it down at the size it asked for.
     * Once it has stopped, a copy made at another zoom is made again, as one
     * made at this zoom for another size in the step is not: that was always
     * the bargain of a step.
     */
    if (!had && !this.zoomSettled && sizes.size) {
      let near: HTMLCanvasElement | undefined;
      let off = Infinity;
      for (const cv of sizes.values()) {
        const by = Math.abs(Math.log(cv.width / cw));
        if (by < off) {
          off = by;
          near = cv;
        }
      }
      if (near && off <= Math.log(STAND_IN_MOST)) return this.scaledUsed(near);
    }
    if (had) {
      const use = this.scaledUse.get(had);
      if (!this.zoomSettled || !use || use.zoom === zoom || (had.width === cw && had.height === ch)) return this.scaledUsed(had);
      this.forgetScaled(had);
    }
    const cv = document.createElement('canvas');
    cv.width = cw;
    cv.height = ch;
    const g = cv.getContext('2d');
    if (g) g.drawImage(src, 0, 0, cv.width, cv.height);
    sizes.set(step, cv);
    this.scaledUse.set(cv, { src, step, zoom, used: this.frameNo });
    this.scaledPixels += cw * ch;
    // Room made by putting away what has gone longest unasked for, and never what this frame has asked for already.
    for (const [old, use] of this.scaledUse) {
      if (this.scaledPixels <= SCALED_PIXELS || use.used === this.frameNo) break;
      this.forgetScaled(old);
    }
    return cv;
  }

  /** A rescaled copy asked for again: to the back of the queue to be put away. */
  private scaledUsed(cv: HTMLCanvasElement): HTMLCanvasElement {
    const use = this.scaledUse.get(cv);
    if (use && use.used !== this.frameNo) {
      use.used = this.frameNo;
      this.scaledUse.delete(cv);
      this.scaledUse.set(cv, use);
    }
    return cv;
  }

  /** A rescaled copy put away, and its hazed copies with it. */
  private forgetScaled(cv: HTMLCanvasElement): void {
    const use = this.scaledUse.get(cv);
    if (!use) return;
    this.scaledUse.delete(cv);
    this.scaledPixels -= cv.width * cv.height;
    for (const hz of this.hazes.get(cv) ?? []) if (hz) this.scaledPixels -= hz.width * hz.height;
    this.hazes.delete(cv);
    const sizes = this.scaledSizes.get(use.src);
    if (sizes?.get(use.step) === cv) sizes.delete(use.step);
    if (sizes && !sizes.size) this.scaledSizes.delete(use.src);
  }

  /** Every rescaled copy put away: the trees have turned with the season and nothing kept is of them any more. */
  private forgetAllScaled(): void {
    this.scaledSizes.clear();
    this.scaledUse.clear();
    this.scaledPixels = 0;
  }

  private invalidate(x: number, y: number): void {
    const w = this.game.world;
    for (let yy = y - 1; yy <= y + 1; yy++) {
      for (let xx = x - 1; xx <= x + 1; xx++) {
        if (w.inBounds(xx, yy)) {
          this.colors.forget(xx, yy);
          this.colorsWas?.forget(xx, yy);
          this.memColors.forget(xx, yy);
          this.trailMarks.forget(xx, yy);
          this.trailMemMarks.forget(xx, yy);
          this.trailPaint.forget(xx, yy);
          this.trailPaintWas?.forget(xx, yy);
          this.trailShapes.delete(yy * w.w + xx);
          this.flowerMarks.forget(xx, yy);
          this.faces.delete(yy * w.w + xx);
          this.bankColours.delete(yy * w.w + xx);
          this.forgetHem(this.hemCache, yy * w.w + xx);
          this.forgetHem(this.hemMemCache, yy * w.w + xx);
        }
      }
    }
  }

  /**
   * One thing's shadow, stretched away from the sun. It is an ellipse squashed
   * along the direction it falls, which is what a round thing's shadow is on
   * flat ground, and it fades out as the sun climbs.
   */
  private castShadow(ctx: CanvasRenderingContext2D, sx: number, sy: number, size: number): void {
    const { dx, dy, alpha } = this.shadow;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return;
    const r = Math.max(3, size * 0.55);
    /*
     * One ellipse turned the way the shadow falls, its middle half the
     * shadow's length out from the foot: what it was when the context was
     * saved, moved, turned and put back for every tree in a wood, which cost
     * more than the ellipse.
     */
    if (alpha !== this.shadowInkFor) {
      this.shadowInkFor = alpha;
      this.shadowInk = `rgba(0,0,0,${alpha.toFixed(3)})`;
    }
    ctx.fillStyle = this.shadowInk;
    ctx.beginPath();
    ctx.ellipse(sx + dx * 0.5, sy + dy * 0.5, len * 0.5 + r, r * 0.42, Math.atan2(dy, dx), 0, Math.PI * 2);
    ctx.fill();
  }
  /** The shadows' ink, for the alpha it was last made for: the same all frame. */
  private shadowInk = '';
  private shadowInkFor = NaN;

  /**
   * How much a light is worth this instant. A fire breathes: two waves out of
   * step, so it never settles into a rhythm you can watch. A steady light —
   * a candle behind cloth, a creature that glows — does not do this at all.
   */
  /**
   * How much of what is drawn at (sx, sy) on the screen the night's wash will
   * take off when it is laid this frame, nought to one: the washes together
   * (\`skyWash\`), less the holes the lights burn in them there, worked out
   * as \`lightLayers\` lays them (a light's hole its strength at its middle,
   * a little over half that at a little over half its reach, nothing at its
   * edge). For something laying light of its own under the wash, to be laid
   * as much stronger (\`drawSmelterNight\`, \`drawDenLive\`).
   */
  private nightOver(sx: number, sy: number, dark: number): number {
    let keep = 1;
    for (const w of skyWash(this.game.hourOfDay(), dark)) keep *= 1 - w.alpha;
    let left = 1;
    const cam = this.camera, zoom = cam.zoom;
    for (const l of this.lightsNow) {
      const r = Math.max(8, l.radius * HALF_W * zoom * this.flicker(l));
      const dx = cam.worldToScreenX(l.x, l.y) - sx;
      if (Math.abs(dx) >= r) continue;
      const dy = cam.worldToScreenY(l.x, l.y, this.standTop(l.x, l.y)) - sy;
      const d = Math.hypot(dx, dy) / r;
      if (d >= 1) continue;
      const s = l.strength * (l.soft ? lightHole(l.radius) : 1);
      const hole = d < 0.55 ? s * (1 - (0.45 * d) / 0.55) : s * 0.55 * ((1 - d) / 0.45);
      left *= 1 - hole;
    }
    return (1 - keep) * left;
  }

  private flicker(l: { x: number; y: number; steady?: boolean }): number {
    if (l.steady || this.calm) return 1;
    const seed = l.x * 0.7 + l.y * 1.3;
    return 1 + 0.055 * Math.sin(this.anim * 6.1 + seed) + 0.035 * Math.sin(this.anim * 11.3 + seed * 2.1);
  }

  /**
   * The scratch canvases the night is mixed on at the screen's size, one for
   * each share of it. Kept between frames and only resized when the window
   * is, since making one every frame at screen size is the sort of thing
   * that costs a night's frame rate.
   */
  private nights = new Map<number, HTMLCanvasElement>();
  /** What the night was last mixed on: the lights' mask at their size, or a layer of its own at the screen's. Read by the crowd check. */
  night: HTMLCanvasElement | null = null;
  /**
   * The layer the cold wash over remembered ground is moved onto while
   * something in sight stands up in front of it (`fogLayer`). Kept between
   * frames at the canvas's own size, as the night is.
   */
  private fogMask: HTMLCanvasElement | null = null;
  /**
   * How far down the screen the wash gathered so far this frame comes, a
   * column of the ground's lattice at a time: two numbers to a column, the
   * lowest it comes at the column's left edge and at its right (`reach`).
   */
  private washFloor = new Float64Array(0);
  /** And how far down what is waiting to take the wash off comes, the same way, since it last did. */
  private liftFloor = new Float64Array(0);
  /** Which column of a tile's own each of the view's four corners falls in, counted from its leftmost; and how many columns a tile is across. */
  private readonly cornerCol = new Int8Array(4);
  private cornerSpan = 2;
  /** A tile's highest or lowest point on each of its column edges, worked out in `reach` and `over`. */
  private readonly colY = new Float64Array(3);
  /** The path a wall drawn now takes the wash off with, while it is drawn for a tile in sight (`liftWall`). */
  private wallLift: Path2D | null = null;
  /** The path a column drawn now takes the wash off with, if one of the tiles round its corner is in sight (`liftColumn`). */
  private columnLift: Path2D | null = null;
  /** The columns' pictures waiting to take the wash off, as they were laid, with `liftPath` (`liftColumn`). */
  private readonly liftPics: Body[] = [];
  /** Where the first of the wash's columns is across the screen this frame, and how wide a column is. */
  private washX0 = 0;
  private washHw = 1;
  /** Whether anything is waiting on the lift path to take the wash off. */
  private lifted = false;

  /**
   * What the lights do to the night, worked out apart from the night itself:
   * `mask`, whose alpha is how much of the wash each spot keeps -- every
   * light's soft hole taken out of it, as the wash used to have them taken
   * out of it directly -- and `warm`, black but for each light's cast, where
   * two overlap the warmer of the two rather than both added, so that a row
   * of lamps lights a street and does not bleach it white. Both are worked
   * out at `LIGHT_RES` of the screen, which their soft edges do not show,
   * and laid over it scaled back up.
   *
   * And kept: what steady lights do -- a lantern, a lamp on a post, an
   * altar, a glowing wildermon -- is kept from one frame to the next while
   * the view, the size of the screen and those lights stand still, and only
   * the ones that flicker, the fires, are worked out again each frame, over a
   * copy of it. How dark it is goes on at the end, so the hour moving does
   * not undo any of it.
   */
  /**
   * The steady lights' layers, made with a margin round the screen and slid
   * with the camera rather than made again for every frame it moves: `cx`
   * and `cy` are where it was when they were made, `pad` the margin in CSS
   * pixels. Made again when the lights change, or the view slides further
   * than the margin.
   */
  private lit: { mask: HTMLCanvasElement; warm: HTMLCanvasElement; sig: number[]; inks: (string | undefined)[]; cx: number; cy: number; pad: number } | null = null;
  private litNow: { mask: HTMLCanvasElement; warm: HTMLCanvasElement } | null = null;

  /** Each rune lantern post's spot at its foot near enough to matter (`runeLanternPool`), as `lights` gathers what burns. */
  private runeLanternPools(): LightSource[] {
    const out: LightSource[] = [];
    const { x: px, y: py, level } = this.game.player;
    if (level < 0) return out;
    for (const f of this.game.furniture.values()) {
      if (!isRuneLantern(f) || (f.level ?? 0) < 0 || Math.abs(f.x - px) >= 60 || Math.abs(f.y - py) >= 60) continue;
      out.push(runeLanternPool(f, this.camera.rotation));
    }
    return out;
  }

  /**
   * The soft light of each wildermon bed's bells near enough to matter
   * (`denPools`), as \`lights\` gathers what burns: a little of the night
   * taken off the bed and round it, lavender, so the bells' own light laid in
   * the bed's place comes up through what is left (`drawDenLive`).
   */
  private denPools(): LightSource[] {
    const out: LightSource[] = [];
    const { x: px, y: py, level } = this.game.player;
    if (level < 0) return out;
    for (const f of this.game.furniture.values()) {
      // Only a bed: every piece in the settlement is looked at every frame.
      if (!isDen(f.kind) || (f.level ?? 0) < 0 || Math.abs(f.x - px) >= 60 || Math.abs(f.y - py) >= 60) continue;
      for (const l of denPools(f.kind, furnitureCentre(f), pieceFacing(f), this.camera.rotation)) out.push(l);
    }
    return out;
  }

  private lightLayers(lights: LightSource[], w: number, h: number): { mask: HTMLCanvasElement; warm: HTMLCanvasElement; box: Box } {
    const cam = this.camera;
    const zoom = cam.zoom;
    const lw = Math.max(1, Math.ceil(w * LIGHT_RES)), lh = Math.max(1, Math.ceil(h * LIGHT_RES));
    const sheet = (had: HTMLCanvasElement | undefined): HTMLCanvasElement => {
      const c = had ?? document.createElement('canvas');
      if (c.width !== lw || c.height !== lh) { c.width = lw; c.height = lh; }
      return c;
    };
    /*
     * Each light where it falls on the screen this frame, and how far it
     * reaches there: worked out once a light a frame, four numbers a light
     * (x, y, reach, what it stands on), and read by everything below.
     */
    const n = lights.length;
    if (this.lightSpots.length < n * 4) this.lightSpots = new Float64Array(n * 8);
    const spots = this.lightSpots;
    for (let i = 0; i < n; i++) {
      const l = lights[i];
      // At what it stands on: the ground, or the finished deck of a tile on piers (`standTop`).
      const top = this.standTop(l.x, l.y);
      spots[i * 4] = cam.worldToScreenX(l.x, l.y);
      spots[i * 4 + 1] = cam.worldToScreenY(l.x, l.y, top);
      // A flame is never steady; a candle behind cloth very nearly is.
      spots[i * 4 + 2] = Math.max(8, l.radius * HALF_W * zoom * this.flicker(l));
      spots[i * 4 + 3] = top;
    }
    /** Whether light `i` falls on a layer `pad` wider than the screen on every side. */
    const shows = (i: number, pad: number): boolean => {
      const sx = spots[i * 4] + pad, sy = spots[i * 4 + 1] + pad, r = spots[i * 4 + 2];
      return !(sx < -r || sy < -r || sx > w + 2 * pad + r || sy > h + 2 * pad + r);
    };
    /*
     * Each light's gradient made once and kept, by its stops, at a reach of
     * one round nothing, and laid moved and scaled to where it falls: they
     * were made afresh for every light every frame.
     */
    const kept = (map: Map<number | string, CanvasGradient>, key: number | string, make: () => CanvasGradient): CanvasGradient => {
      let grad = map.get(key);
      if (!grad) {
        if (map.size >= 64) map.clear();
        grad = make();
        map.set(key, grad);
      }
      return grad;
    };
    /** Light `i`'s disc onto `g`, `pad` in from the layer's corner, in `grad`, squashed up and down by `flat`. */
    const disc = (g: CanvasRenderingContext2D, i: number, pad: number, grad: CanvasGradient, flat: number): void => {
      const r = spots[i * 4 + 2];
      g.setTransform(LIGHT_RES * r, 0, 0, LIGHT_RES * r * flat, LIGHT_RES * (spots[i * 4] + pad), LIGHT_RES * (spots[i * 4 + 1] + pad));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, 1, 0, Math.PI * 2);
      g.fill();
    };
    const holes = (g: CanvasRenderingContext2D, steady: boolean, pad = 0): void => {
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < n; i++) {
        const l = lights[i];
        if (!l.steady !== !steady || !shows(i, pad)) continue;
        let grad: CanvasGradient;
        if (l.soft) {
          // A spell's: falling smoothly to nothing at its edge, and less at its middle the wider it is.
          const a = l.strength * lightHole(l.radius);
          grad = kept(this.softHoleGrads, a, () => fallGradient(g, 0, 0, 1, (f) => `rgba(0,0,0,${(a * f).toFixed(3)})`));
        } else {
          grad = kept(this.holeGrads, l.strength, () => {
            const made = g.createRadialGradient(0, 0, 0, 0, 0, 1);
            made.addColorStop(0, `rgba(0,0,0,${l.strength.toFixed(2)})`);
            made.addColorStop(0.55, `rgba(0,0,0,${(l.strength * 0.55).toFixed(2)})`);
            made.addColorStop(1, 'rgba(0,0,0,0)');
            return made;
          });
        }
        disc(g, i, pad, grad, 1);
      }
      g.setTransform(LIGHT_RES, 0, 0, LIGHT_RES, 0, 0);
      g.globalCompositeOperation = 'source-over';
    };
    /** The part of the layers the casts cover, in their own whole pixels: x, y, width, height. */
    const cover = (): Box => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < n; i++) {
        if (!shows(i, 0)) continue;
        const sx = spots[i * 4], sy = spots[i * 4 + 1], r = spots[i * 4 + 2];
        x0 = Math.min(x0, Math.max(0, Math.floor((sx - r) * LIGHT_RES)));
        y0 = Math.min(y0, Math.max(0, Math.floor((sy - r) * LIGHT_RES)));
        x1 = Math.max(x1, Math.min(lw, Math.ceil((sx + r) * LIGHT_RES)));
        y1 = Math.max(y1, Math.min(lh, Math.ceil((sy + r) * LIGHT_RES)));
      }
      return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : [0, 0, 0, 0];
    };
    const casts = (g: CanvasRenderingContext2D, steady: boolean, pad = 0): void => {
      // Opaque on black, so 'lighten' keeps the larger of what is there and what comes: the warmest light, not the sum.
      g.globalCompositeOperation = 'lighten';
      for (let i = 0; i < n; i++) {
        const l = lights[i];
        if (!l.steady !== !steady || !shows(i, pad)) continue;
        const a = (l.castAlpha ?? 0.16 * l.strength) * (l.soft ? lightHole(l.radius) : 1);
        const rgb = this.castRgb(l.cast ?? '255, 186, 92');
        const r0 = rgb[0] * a, g0 = rgb[1] * a, b0 = rgb[2] * a;
        let grad: CanvasGradient;
        if (l.soft) {
          grad = kept(this.softCastGrads, `${r0},${g0},${b0}`, () => fallGradient(g, 0, 0, 1, (f) => `rgb(${Math.round(r0 * f)}, ${Math.round(g0 * f)}, ${Math.round(b0 * f)})`));
        } else {
          const R = Math.round(r0), G = Math.round(g0), B = Math.round(b0);
          grad = kept(this.castGrads, R * 65536 + G * 256 + B, () => {
            const made = g.createRadialGradient(0, 0, 0, 0, 0, 1);
            made.addColorStop(0, `rgb(${R}, ${G}, ${B})`);
            made.addColorStop(1, 'rgb(0, 0, 0)');
            return made;
          });
        }
        // A pool on the ground flattened as the ground is seen (`LightSource.flat`): laid round its middle squashed up and down.
        disc(g, i, pad, grad, l.flat ?? 1);
      }
      g.setTransform(LIGHT_RES, 0, 0, LIGHT_RES, 0, 0);
      g.globalCompositeOperation = 'source-over';
    };
    const ctxOf = (c: HTMLCanvasElement): CanvasRenderingContext2D => {
      const g = c.getContext('2d') as CanvasRenderingContext2D;
      g.setTransform(LIGHT_RES, 0, 0, LIGHT_RES, 0, 0);
      return g;
    };
    /*
     * Not where the camera is: the layers are slid with it (`lit`). What the
     * steady lights are, as numbers and their colours, against what they
     * were when the layers were made: it was a string a light a frame.
     */
    const sig = this.litSig, inks = this.litInks;
    sig.length = 0;
    inks.length = 0;
    sig.push(lw, lh, zoom, cam.rotation);
    let live = false;
    for (let i = 0; i < n; i++) {
      const l = lights[i];
      if (!l.steady) {
        live = true;
        continue;
      }
      sig.push(l.x, l.y, spots[i * 4 + 3], l.radius, l.strength, l.castAlpha ?? -1, l.flat ?? -1);
      inks.push(l.cast);
    }
    const same = (at: NonNullable<Renderer['lit']>): boolean => {
      if (at.sig.length !== sig.length || at.inks.length !== inks.length) return false;
      for (let i = 0; i < sig.length; i++) if (at.sig[i] !== sig[i]) return false;
      for (let i = 0; i < inks.length; i++) if (at.inks[i] !== inks[i]) return false;
      return true;
    };
    const slid = (at: { cx: number; cy: number }): [number, number] => [(at.cx - cam.cx) * zoom, (at.cy - cam.cy) * zoom];
    const stale = (at: NonNullable<Renderer['lit']>): boolean => {
      const [ox, oy] = slid(at);
      return !same(at) || Math.abs(ox) > at.pad || Math.abs(oy) > at.pad;
    };
    if (!this.lit || stale(this.lit)) {
      // A quarter of the screen spare on every side.
      const pad = Math.ceil(Math.max(w, h) * 0.25);
      const bw = Math.max(1, Math.ceil((w + 2 * pad) * LIGHT_RES)), bh = Math.max(1, Math.ceil((h + 2 * pad) * LIGHT_RES));
      const big = (had: HTMLCanvasElement | undefined): HTMLCanvasElement => {
        const c = had ?? document.createElement('canvas');
        if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; }
        return c;
      };
      const mask = big(this.lit?.mask), warm = big(this.lit?.warm);
      const m = ctxOf(mask), c = ctxOf(warm);
      m.globalCompositeOperation = 'source-over';
      m.fillStyle = '#000';
      m.fillRect(0, 0, w + 2 * pad, h + 2 * pad);
      holes(m, true, pad);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#000';
      c.fillRect(0, 0, w + 2 * pad, h + 2 * pad);
      casts(c, true, pad);
      this.lit = { mask, warm, sig: sig.slice(), inks: inks.slice(), cx: cam.cx, cy: cam.cy, pad };
    }
    // The steady layers where the camera is now, and the fires over them.
    const now = this.litNow ?? (this.litNow = { mask: sheet(undefined), warm: sheet(undefined) });
    const mask = sheet(now.mask), warm = sheet(now.warm);
    const [ox, oy] = slid(this.lit);
    for (const [to, from] of [[mask, this.lit.mask], [warm, this.lit.warm]] as const) {
      const g = to.getContext('2d') as CanvasRenderingContext2D;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'copy';
      g.drawImage(from, (ox - this.lit.pad) * LIGHT_RES, (oy - this.lit.pad) * LIGHT_RES);
      g.globalCompositeOperation = 'source-over';
    }
    if (live) {
      holes(ctxOf(mask), false);
      casts(ctxOf(warm), false);
    }
    return { mask, warm, box: cover() };
  }

  /** Where each light falls this frame (`lightLayers`), four numbers a light. */
  private lightSpots = new Float64Array(64);
  /** The steady lights as numbers and their colours this frame, against the layers' own (`lit`). */
  private litSig: number[] = [];
  private litInks: (string | undefined)[] = [];
  /** The lights' gradients, by their stops, at a reach of one round nothing (`lightLayers`). */
  private holeGrads = new Map<number | string, CanvasGradient>();
  private softHoleGrads = new Map<number | string, CanvasGradient>();
  private castGrads = new Map<number | string, CanvasGradient>();
  private softCastGrads = new Map<number | string, CanvasGradient>();
  private castRgbs = new Map<string, [number, number, number]>();

  /** A light's colour, 'r, g, b', as numbers: read once for each colour. */
  private castRgb(cast: string): [number, number, number] {
    let rgb = this.castRgbs.get(cast);
    if (!rgb) {
      const [r, g, b] = cast.split(',').map(Number);
      rgb = [r, g, b];
      this.castRgbs.set(cast, rgb);
    }
    return rgb;
  }

  /**
   * The wash's layer for this frame: the canvas's own pixels, cleared, drawn
   * on as the world is and in the wash's colour laid solid, so ground gathered
   * on it twice is washed once. It goes over the world at the wash's own
   * strength, `FOG_ALPHA`, at the end.
   */
  private fogLayer(drawnAt: DOMMatrix): HTMLCanvasElement {
    const { width, height } = this.canvas.el;
    if (!this.fogMask || this.fogMask.width !== width || this.fogMask.height !== height) {
      this.fogMask = document.createElement('canvas');
      this.fogMask.width = width;
      this.fogMask.height = height;
    }
    const fc = this.fogMask.getContext('2d') as CanvasRenderingContext2D;
    fc.setTransform(1, 0, 0, 1, 0, 0);
    fc.globalCompositeOperation = 'source-over';
    fc.clearRect(0, 0, width, height);
    fc.setTransform(drawnAt);
    fc.fillStyle = FOG_INK;
    return this.fogMask;
  }

  /** Lay the wash gathered since it was last laid onto its layer, and take off it what in sight was drawn over it. */
  private layWash(wash: HTMLCanvasElement, fog: Path2D | null, lift: Path2D | null): void {
    const fc = wash.getContext('2d') as CanvasRenderingContext2D;
    if (fog) {
      fc.globalCompositeOperation = 'source-over';
      fc.fill(fog);
    }
    if (lift) {
      fc.globalCompositeOperation = 'destination-out';
      fc.fill(lift);
      for (const p of this.liftPics) fc.drawImage(p.c, p.x, p.y, p.w, p.h);
    }
    this.liftPics.length = 0;
  }

  /**
   * Set the wash's columns up for a frame of `cols` columns, none of them
   * reached yet, and where the view's corners fall among a tile's own. Returns
   * the leftmost corner's place across the lattice from the tile's own, which
   * a tile's first column is counted from.
   */
  private washColumns(V: View, cols: number): number {
    if (this.washFloor.length < cols * 2) {
      this.washFloor = new Float64Array(cols * 2);
      this.liftFloor = new Float64Array(cols * 2);
    }
    this.washFloor.fill(-Infinity);
    this.liftFloor.fill(-Infinity);
    let lo = Infinity;
    let hi = -Infinity;
    for (const [sx] of V.shape) {
      lo = Math.min(lo, sx);
      hi = Math.max(hi, sx);
    }
    for (let k = 0; k < 4; k++) this.cornerCol[k] = V.shape[k][0] - lo;
    this.cornerSpan = hi - lo;
    return lo;
  }

  /**
   * Note on `f` how far down the screen something laid over a tile comes --
   * its wash, or what takes the wash off it: as far as its ground does, at
   * each edge of each column it is across, whose first is `at`. Its ground is
   * the lowest of it -- water over it and a floor raised on it are both
   * higher up -- and between two edges of a column a tile's ground runs
   * straight, so the two ends say it all.
   */
  private reach(f: Float64Array, at: number, pts: ArrayLike<number>): void {
    const ys = this.colY;
    ys.fill(-Infinity);
    for (let k = 0; k < 4; k++) {
      const j = this.cornerCol[k];
      if (pts[k * 2 + 1] > ys[j]) ys[j] = pts[k * 2 + 1];
    }
    for (let j = 0; j < this.cornerSpan; j++) {
      const i = (at + j) * 2;
      if (ys[j] > f[i]) f[i] = ys[j];
      if (ys[j + 1] > f[i + 1]) f[i + 1] = ys[j + 1];
    }
  }

  /**
   * Whether a tile, standing up to `top` over its ground (or its ground
   * alone, where null), comes up the screen past what `f` has noted in any
   * column it is across, and so over some of it: a tile in sight over the
   * wash gathered behind it, or remembered ground in front over what is
   * waiting to take the wash off. Ground beside either meets it along an edge
   * and does not come past it: half a pixel is allowed for that.
   */
  private over(f: Float64Array, at: number, pts: ArrayLike<number>, c: ArrayLike<number>, top: number | null, hs: number): boolean {
    const ys = this.colY;
    ys.fill(Infinity);
    for (let k = 0; k < 4; k++) {
      const j = this.cornerCol[k];
      const y = pts[k * 2 + 1] - (top === null ? 0 : Math.max(0, top - c[k]) * hs);
      if (y < ys[j]) ys[j] = y;
    }
    for (let j = 0; j < this.cornerSpan; j++) {
      const i = (at + j) * 2;
      if (ys[j] < f[i] - 0.5 || ys[j + 1] < f[i + 1] - 0.5) return true;
    }
    return false;
  }

  /**
   * Take the wash off a wall drawn for a tile in sight, where the wall comes
   * up the screen past the wash gathered behind it: the wall from its foot to
   * its top, both faces, onto `wallLift`. `px` and `py` are `drawWall`'s own
   * points on it. A wall seen end on covers nothing.
   */
  private liftWall(px: (t: number, k: number, s?: number) => number, py: (t: number, k: number, s?: number) => number): void {
    const path = this.wallLift;
    if (!path) return;
    const ca = Math.round((px(0, 0) - this.washX0) / this.washHw);
    const cb = Math.round((px(1, 0) - this.washX0) / this.washHw);
    if (ca === cb) return;
    const i = Math.min(ca, cb) * 2;
    const f = this.washFloor;
    if (i < 0 || i + 1 >= f.length) return;
    const topA = Math.min(py(0, 1, 1), py(0, 1, -1));
    const topB = Math.min(py(1, 1, 1), py(1, 1, -1));
    if (!((ca < cb ? topA : topB) < f[i] - 0.5 || (ca < cb ? topB : topA) < f[i + 1] - 0.5)) return;
    const xs: number[] = [];
    const ys: number[] = [];
    for (const t of [0, 1]) {
      for (const k of [0, 1]) {
        for (const s of [1, -1]) {
          xs.push(px(t, k, s));
          ys.push(py(t, k, s));
        }
      }
    }
    windOn(path, xs, ys, convexHull(xs, ys));
    // Its foot, at each end, is as far down the screen as it comes.
    const footA = Math.max(py(0, 0, 1), py(0, 0, -1));
    const footB = Math.max(py(1, 0, 1), py(1, 0, -1));
    const lf = this.liftFloor;
    lf[i] = Math.max(lf[i], ca < cb ? footA : footB);
    lf[i + 1] = Math.max(lf[i + 1], ca < cb ? footB : footA);
    this.lifted = true;
  }

  /**
   * The top of a floor raised over a tile's ground on its ground floor -- the
   * deck of a building on piers, a poured slab -- or null where its ground is
   * all there is.
   */
  private raisedTop(x: number, y: number): number | null {
    const deck = this.game.buildings.buildingAt(x, y)?.deck;
    if (deck != null) return deck;
    return this.game.foundations.size ? (this.game.foundationAt(x, y)?.top ?? null) : null;
  }

  /**
   * The screen a tile's ground floor covers, onto a path: its ground, and
   * where a floor is raised over it to `top`, everything between the two --
   * the hull of the tile's four corners at both heights. `pts` is the ground's
   * diamond as drawn, `c` its corners' heights and `hs` the screen's pixels
   * to a unit of height.
   */
  private tileColumn(path: Path2D, pts: ArrayLike<number>, c: ArrayLike<number>, top: number | null, hs: number): void {
    const low = Math.min(c[0], c[1], c[2], c[3]);
    if (top === null || top <= low) {
      // Wound as a tile lying the right way up is, folded over or not (`windOn`), without making four arrays a tile to say so.
      let area = 0;
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) & 3;
        area += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1];
      }
      const step = area >= 0 ? 1 : 3;
      path.moveTo(pts[0], pts[1]);
      for (let k = 1; k < 4; k++) {
        const i = (k * step) & 3;
        path.lineTo(pts[i * 2], pts[i * 2 + 1]);
      }
      path.closePath();
      return;
    }
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < 4; i++) {
      xs.push(pts[i * 2], pts[i * 2]);
      ys.push(pts[i * 2 + 1], pts[i * 2 + 1] - Math.max(0, top - c[i]) * hs);
    }
    windOn(path, xs, ys, convexHull(xs, ys));
  }

  /** The night's layer at `res` of the screen's size: one kept for each size it is mixed at, so going between them makes none. */
  private nightLayer(res = 1): HTMLCanvasElement {
    const w = Math.max(1, Math.ceil(this.canvas.width * res));
    const h = Math.max(1, Math.ceil(this.canvas.height * res));
    let night = this.nights.get(res);
    if (!night || night.width !== w || night.height !== h) {
      night = document.createElement('canvas');
      night.width = w;
      night.height = h;
      this.nights.set(res, night);
    }
    return night;
  }

  /** Flat-shaded colour for a tile: base colour, slope lighting, per-tile variation and depth tint under water; shaded by `heights` in place of its corners' where given. */
  private computeColor(x: number, y: number, type: TileType, data: number, light: [number, number, number], lit = true, own = false, heights?: readonly number[]): string {
    const w = this.game.world;
    // A wood is a field with trees in it and a kelp bed is sand with weed
    // in it, not soils of their own: see `groundAt`. Worked out here, so it
    // is cached and thrown away with the colour it decides rather than being
    // asked again every frame. And a trail is the ground it was worn out of,
    // with the path drawn across it (`drawTrail`) -- unless it is the path's
    // own colour that is wanted, shaded the same -- and stepping stones are
    // the ground they were laid over, under the water with the stones on it.
    const ground = own ? type : COVERED.has(type) || type === TileType.Trail || type === TileType.SteppingStones ? this.groundAt(x, y, lit) : type;
    const def = TILE_DEFS[ground];
    const c = heights ?? w.corners(x, y, this.colorBuf);
    const gx = (c[1] + c[2] - (c[0] + c[3])) / 2 / UNITS_PER_TILE;
    const gy = (c[2] + c[3] - (c[0] + c[1])) / 2 / UNITS_PER_TILE;
    const len = Math.hypot(gx, gy, 1);
    const dot = (-gx * light[0] - gy * light[1] + light[2]) / len;
    let shade = 0.48 + 0.6 * Math.max(0, dot);
    /*
     * A tile of ore is stone with a wash of the metal through it, not the
     * metal. The seam itself is drawn on top of this (`seams/`), and the wash
     * is in its look's own colour. What the wash is for is the other end of the telescope -- from far
     * enough out that the shapes are two pixels, a prospector still has to be
     * able to see that there is something in that hillside.
     */
    const base =
      ground === TileType.Rock
        ? oreWash(seamWash(w.rockFace(x, y)), this.oreBuf)
        : ground === TileType.Slabs
          ? SLAB_VARIANTS[slabVariant(data)].color
          : def.color;
    let r = base[0];
    let g = base[1];
    let b = base[2];
    /*
     * Sand with the sea against it is damp sand. Four reads, and only on the
     * tiles that are actually sand, so the whole of the beach costs what one
     * tile of it used to; and it is worked out here rather than drawn on top
     * because it belongs to the tile's colour, and so it is cached with the
     * colour and thrown away with it when the land moves.
     */
    if (ground === TileType.Sand) {
      let wet = false;
      for (let e = 0; e < 4 && !wet; e++) {
        const nx = x + (e === 1 ? 1 : e === 3 ? -1 : 0);
        const ny = y + (e === 0 ? -1 : e === 2 ? 1 : 0);
        if (nx < 0 || ny < 0 || nx >= w.w || ny >= w.h) continue;
        if (w.heightAt(nx + 0.5, ny + 0.5) < 0) wet = true;
      }
      if (wet) {
        r = DAMP_SAND[0];
        g = DAMP_SAND[1];
        b = DAMP_SAND[2];
      }
    }
    if (this.groundTint) {
      const t = this.tintBuf;
      t[0] = r;
      t[1] = g;
      t[2] = b;
      this.groundTint(x, y, ground, t);
      [r, g, b] = t;
    }
    // Steep ground wears through to the rock under it. A cliff face used to be
    // whatever was growing on the top of it, stretched down the drop, which is
    // the one thing a cliff never looks like.
    if (ground !== TileType.Rock) {
      const bare = bareRock(Math.hypot(gx, gy));
      if (bare > 0) {
        const k = bare * 0.88;
        const face = ROCK_VARIANTS[0].color;
        const grain = 0.88 + hash2(x, y, 23) * 0.26;
        r += (face[0] * grain - r) * k;
        g += (face[1] * grain - g) * k;
        b += (face[2] * grain - b) * k;
      }
    }
    const avg = (c[0] + c[1] + c[2] + c[3]) / 4;
    /*
     * A nudge of brightness per tile, so a wide sheet of one ground is not
     * one flat sheet of colour. The flat grounds get none of it: they are
     * meant to read as one colour with things standing on them, and a tenth
     * either way per tile came out as a chequerboard -- every tile a slightly
     * different green, which is the one thing a meadow never looks like, and
     * a cliff of it looked like a wall somebody had patched.
     */
    if (avg >= 0) shade *= 1 + (hash2(x, y, 9) - 0.5) * (FLAT.has(ground) ? 0 : 0.1);
    else {
      const deep = -avg;
      /*
       * How far under this is, as a share of the depth by which the water
       * has finished taking the ground over: nought at the line and one at
       * `WATER_LIT`.
       */
      const under = Math.min(1, deep / WATER_LIT);
      const keep = 1 - under;
      /*
       * Water takes the red out of what is under it first and the blue out
       * of it last, which is a good half of what makes a sea floor read as
       * being under a sea rather than as a differently coloured field.
       *
       * It used to go on whole the moment a tile's four corners averaged
       * below zero -- twenty-eight per cent of the red gone in one step, at
       * no depth at all. A tile the waterline runs through is one tile with
       * one colour, and the water polygon covers only the part of it that is
       * actually below the line: so the part above the line came out as dry
       * sand painted as though it were drowned, and every beach on the
       * island had a band of grey-green a tile wide along the top of the
       * water. It comes in with depth now, from nothing. The water drawn
       * over the top is already more than half opaque at the line itself
       * (`waterVeil`), so the shallows have never needed this to look wet,
       * and by the time it is fully on there is not much of the floor left
       * showing through to cast.
       */
      const fade = Math.max(0.3, 1 - deep / 80);
      r *= (keep + under * 0.72) * fade;
      g *= (keep + under * 0.86) * fade;
      b *= (keep + under * 0.95) * fade;
      // And the slope lighting fades out over the same depth: see
      // `WATER_LIT`. What looked like the depth ramp banding was the sea
      // floor being faceted like a hillside and showing through water that
      // is not opaque.
      shade = 1 + (shade - 1) * keep;
    }
    /*
     * Ground you are only remembering keeps almost none of its own colour.
     * Colour is what an eye is getting *now*; a memory of a place is the shape
     * of it and how light it was, which is a grey. Done here rather than as
     * another wash because a wash over green is still green, and because both
     * of these are cached per tile — it costs nothing after the first frame.
     */
    if (!lit) {
      const grey = 0.299 * r + 0.587 * g + 0.114 * b;
      r = grey + (r - grey) * MEMORY_SATURATION;
      g = grey + (g - grey) * MEMORY_SATURATION;
      b = grey + (b - grey) * MEMORY_SATURATION;
    }
    return `rgb(${clamp255(r * shade)},${clamp255(g * shade)},${clamp255(b * shade)})`;
  }

  /** A tile's colour as drawn, worked out once and kept until something changes it. */
  private groundColor(x: number, y: number, lit: boolean, sun: [number, number, number]): string {
    const cache = lit ? this.colors : this.memColors;
    let color = cache.get(x, y);
    if (!color) {
      const was = lit ? this.sunStale(this.colorsWas, x, y) : null;
      if (was) return was;
      const w = this.game.world;
      color = this.computeColor(x, y, w.viewTile(x, y, lit), w.viewData(x, y, lit), sun, lit);
      cache.set(x, y, color);
    }
    return color;
  }

  /** A colour from the step of the sun before, where this frame's time for shading tiles afresh is up and there is one. */
  private sunStale(was: ColourPages | null, x: number, y: number): string | null {
    if (!was || this.baking || performance.now() < this.sunRepaintBy) return null;
    const c = was.get(x, y);
    if (c) this.sunWasUsed = true;
    return c;
  }

  /** Scratch for `groundAt`: four neighbours, and no array made per tile. */
  private nearBuf: TileType[] = [];

  /**
   * What ground a tile is, with a wooded one resolved to what it stands in.
   *
   * A tile of Tree, Bush or Stump is a soil somebody's wood is growing out
   * of rather than a soil of its own, so it takes the commonest ground among
   * its four neighbours -- and grass where the wood is thick enough that all
   * four of them are trees too, which is a place nobody can see the ground
   * anyway.
   *
   * It is a function of the two coordinates and nothing else, so the tile on
   * either side of a join works out the same pair of answers and the two of
   * them agree about which way the join runs.
   */
  private groundAt(x: number, y: number, lit: boolean): TileType {
    const world = this.game.world;
    // Stepping stones are laid over a ground and keep which in their data: that ground is what is under the water.
    const t = this.bedOf(x, y, lit);
    // A trail is the ground it was worn out of, which its byte keeps.
    if (t === TileType.Trail) return trailGround(world.viewData(x, y, lit));
    if (!COVERED.has(t)) return t;
    // A tree takes the ground it stands on and weed takes the floor it grows
    // out of, so neither of them is allowed to take the other's.
    const under = world.heightAt(x + 0.5, y + 0.5) < 0;
    const near = this.nearBuf;
    near.length = 0;
    for (let e = 0; e < 4; e++) {
      const nx = x + (e === 1 ? 1 : e === 3 ? -1 : 0);
      const ny = y + (e === 0 ? -1 : e === 2 ? 1 : 0);
      if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h) continue;
      const n = this.bedOf(nx, ny, lit);
      // Not another one of these, and not a road.
      if (COVERED.has(n) || PAVED.has(n)) continue;
      if ((world.heightAt(nx + 0.5, ny + 0.5) < 0) !== under) continue;
      near.push(n);
    }
    // Thick enough wood, or thick enough weed, that all four neighbours were
    // the same as this one: the field it would be, or the shelf it grows on.
    let best: TileType = under ? TileType.Sand : TileType.Grass;
    let most = 0;
    for (const u of near) {
      let n = 0;
      for (const v of near) if (v === u) n++;
      if (n > most || (n === most && u < best)) { best = u; most = n; }
    }
    return best;
  }

  /** What a tile is, with a tile of stepping stones taken for the ground they were laid over. */
  private bedOf(x: number, y: number, lit: boolean): TileType {
    const world = this.game.world;
    const t = world.viewTile(x, y, lit) as TileType;
    return t === TileType.SteppingStones ? stonesBed(world.viewData(x, y, lit)) : t;
  }

  /**
   * The height a body at (x, y) is drawn standing at, on the ground under it
   * with nothing laid over it: the ground, or afloat at the top of the water
   * over it -- the sea's surface or a pond's -- on a flight of garden steps
   * the tread under it, a riser higher at a time, and on stepping stones the
   * stones' tops, however deep the water round them is.
   */
  /**
   * A body on the head of a way down, up top, stands in the hole on the tread
   * under its feet, and not on the air over it at the ground floor: how high
   * that is, and the part of the screen it shows in -- the hole and what is
   * over it, and not the ground in front of the hole, which hides the rest.
   * Null anywhere else.
   */
  private onFlight(px: number, py: number): { h: number; clip: Array<[number, number]> } | null {
    const tx = Math.floor(px), ty = Math.floor(py);
    const f = this.game.buildings.flightDown(tx, ty);
    if (!f) return null;
    const w = this.game.world;
    const cam = this.camera;
    const base = w.getHeight(tx, ty);
    const facing = f.facing ?? 's';
    // How far up the flight from its foot, as `stairPoint` lays it; a ladder is climbed the whole way, a flight a tread at a time.
    const u = px - tx, v = py - ty;
    const s = Math.max(0, Math.min(1, facing === 'n' ? v : facing === 's' ? 1 - v : facing === 'w' ? u : 1 - u));
    const h = floorKind(f) === 'ladder' ? base - WALL_HEIGHT * (1 - s)
      : base - WALL_HEIGHT + (Math.min(FLIGHT_STEPS - 1, Math.floor(s * FLIGHT_STEPS)) + 1) * (WALL_HEIGHT / FLIGHT_STEPS);
    // The hole's corners on the screen, and the run of its edge nearest the camera, from its leftmost corner to its rightmost.
    const hole = ([[tx, ty], [tx + 1, ty], [tx + 1, ty + 1], [tx, ty + 1]] as Array<[number, number]>)
      .map(([cx, cy]): [number, number] => [cam.worldToScreenX(cx, cy), cam.worldToScreenY(cx, cy, w.getHeight(cx, cy))]);
    let left = 0, right = 0;
    for (let i = 1; i < 4; i++) {
      if (hole[i][0] < hole[left][0] - 1e-6 || (Math.abs(hole[i][0] - hole[left][0]) <= 1e-6 && hole[i][1] > hole[left][1])) left = i;
      if (hole[i][0] > hole[right][0] + 1e-6 || (Math.abs(hole[i][0] - hole[right][0]) <= 1e-6 && hole[i][1] > hole[right][1])) right = i;
    }
    const run = (step: number): Array<[number, number]> => {
      const out: Array<[number, number]> = [hole[left]];
      for (let i = left; i !== right;) {
        i = (i + step + 4) % 4;
        out.push(hole[i]);
      }
      return out;
    };
    const mean = (pts: Array<[number, number]>): number => pts.reduce((n, p) => n + p[1], 0) / pts.length;
    const a = run(1), b = run(-1);
    const near = mean(a) >= mean(b) ? a : b;
    const clip: Array<[number, number]> = [[-1e5, near[0][1]], ...near, [1e5, near[near.length - 1][1]], [1e5, -1e5], [-1e5, -1e5]];
    return { h, clip };
  }

  private footAt(x: number, y: number): number {
    const world = this.game.world;
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (world.getTile(tx, ty) === TileType.Steps) return stepsFootAt(world, x, y);
    // On a poured slab, its top, whatever the ground or the water under it does (`dryTop`).
    const slab = this.game.foundations.size ? this.game.dryTop(tx, ty) : null;
    if (slab !== null) return slab;
    const ground = world.heightAt(x, y);
    if (world.stonesAt(tx, ty)) return Math.max(ground, world.hasWater(tx, ty) ? world.surfaceAt(tx, ty) : ground) + STONES_RISE;
    return Math.max(ground, world.surfaceAt(tx, ty) - 4);
  }

  /**
   * The greener ground spilling over the edge of the barer one beside it.
   *
   * This is the only join there is now. Every pair of unlike grounds used to
   * get a wedge of each other's colour washed over the half of the tile
   * nearest the line between them -- which read as a smear where two fields
   * met, and, round any tile that was a different ground only because
   * something was growing on it, as a box of shadow four wedges wide sitting
   * on the meadow. A field against a path somebody wore across it does not
   * fade into it: it thins out and gives up in lumps, and that ragged edge is
   * most of what makes the path read as walked rather than as painted on. So
   * every join is that now, and `growth` says which of the two runs over.
   *
   * The barer tile draws it, into itself, clipped to itself. Which ends of
   * the edge are which swaps at every other quarter turn, so the run is taken
   * in the order the *world's* corners come in rather than the screen's, or
   * the ruffle reads one way round at one rotation and the other at the next
   * and the whole path crawls as the camera comes about.
   */
  /**
   * Each tile's ruffled edges, drawn once into a picture of their own and
   * laid down from it after that.
   *
   * The ruffles were the dearest thing on an ordinary screen of country: some
   * sixty arcs a tile wherever two grounds meet, filled three times over,
   * every frame -- about two fifths of a whole frame on open meadow. They
   * change only when the ground does, so they are drawn once and copied.
   *
   * A copy only lines up with the polygon it sits on if both land on the same
   * fraction of a pixel. `render` puts the camera on a whole device pixel for
   * the frame, so a tile keeps its fraction of a pixel however far the view
   * is panned, and a picture made of it in one frame is the same picture in
   * the next, moved by whole pixels. While the zoom is still moving every
   * picture would be out of date by the next frame, so then the edges are
   * drawn as they always were and nothing is kept.
   *
   * By tile, for ground in sight and ground remembered apart; dropped with the
   * colour, which goes stale at the same moments, and past `HEM_PIXELS` of
   * pictures those gone longest undrawn (`hemRoom`). Each map is kept in the
   * order its pictures were last drawn in, oldest first.
   */
  private hemCache = new Map<number, HemPicture>();
  private hemMemCache = new Map<number, HemPicture>();
  private hemPixels = 0;
  /** The view and screen the pictures were made for, the zoom last frame, and whether the zoom has held still since the last frame. */
  private hemFor = '';
  private hemZoomWas = 0;
  private hemSteady = false;
  /** When the zoom last moved (`performance.now`), and whether it has held still for `ZOOM_SETTLE` since. */
  private zoomMovedAt = -Infinity;
  private zoomSettled = true;
  /** Crated wildermon's pictures still to be made this frame where another size could stand in (`drawStill`). */
  private readonly stillsLeft = { left: 0 };
  /** Tiles' edge pictures made this frame (`HEMS_A_FRAME`). */
  private hemsMade = 0;

  /** The ground kept as pictures a block of lines at a time (`GroundChunks`), and this frame's way of making and laying them. */
  private readonly chunks = new GroundChunks();
  private gf: GroundFrame | null = null;
  /** Whether the ground is laid from them at all: off, every frame is drawn as it always was. */
  private bakeGround = true;
  /** Put up each time the ground's colours are worked out under a new sun, so a block knows it was made under an older one. */
  private sunEpoch = 0;
  /** Where the ground's drawing goes while a block is being made, rather than the screen (`strewTile`, `laidOver`). */
  private groundCtx: CanvasRenderingContext2D | null = null;
  private baking = false;
  /** The line being drawn's blocks, from the first across the screen; and the blocks to be made, by how soon. */
  private lineChunks: Array<GroundLine | null> = [];
  private lineCe0 = 0;
  private lineWant: number[] = [];
  private chunkWants = new Map<number, [number, number, number]>();
  /** The line width, join and cap the grid was stroked in on tiles of blocks wanted this frame, by step (`bakeChunk`). */
  private strokeAt = new Map<number, [number, CanvasLineJoin, CanvasLineCap]>();
  /**
   * Everything a tile's sort (`groundClass`) reads besides the tile and what
   * is in sight, as it stands this frame: a line found as it was made under
   * the same, with nothing in sight changed in its block since, is not asked
   * again. The moss is asked again a minute at a time.
   */
  private groundSig = '';
  /** Where the view was last frame, and when it last moved. */
  private viewWas: [number, number] = [NaN, NaN];
  private viewMovedAt = 0;
  /** Whether it has moved within `GROUND_STILL_MS`: nothing is made, and nothing wanted. */
  private viewMoving = false;
  private voidWas = '';
  /** The box what is in sight last changed in, for the next change to be taken with it (`sightBox`). */
  private sightWas: { x0: number; y0: number; x1: number; y1: number } | null = null;
  /** The moss stage `groundClass` found on the tile it was asked about, or -1. */
  private classMoss = -1;
  private readonly classBuf = [0, 0, 0, 0];
  private readonly classPts = new Float64Array(8);
  /** How far a steep face's ferns reach (`groundReach`), and a tile's box as a block's picture makes room for it. */
  private reach4: [number, number, number, number] | null = null;
  private readonly reachBox = [0, 0, 0, 0];

  private forgetHems(lit?: boolean): void {
    if (lit !== false) this.hemCache.clear();
    if (lit !== true) this.hemMemCache.clear();
    this.hemPixels = 0;
    for (const m of [this.hemCache, this.hemMemCache]) for (const h of m.values()) this.hemPixels += h.cv ? h.cv.width * h.cv.height : 0;
  }

  /** One tile's edges, out of one of the two caches. */
  private forgetHem(cache: Map<number, HemPicture>, key: number): void {
    const h = cache.get(key);
    if (!h) return;
    if (h.cv) this.hemPixels -= h.cv.width * h.cv.height;
    cache.delete(key);
  }

  /** `swardEdges`, from the tile's picture when it has one that fits, making one when it may. */
  private hems(ctx: CanvasRenderingContext2D, V: View, x: number, y: number, pts: Float64Array, zoom: number, lit: boolean): boolean {
    const dpr = this.canvas.dpr;
    const cache = lit ? this.hemCache : this.hemMemCache;
    const key = y * this.game.world.w + x;
    const had = cache.get(key);
    /*
     * While the zoom moves, the picture the tile had, stretched about its
     * corner by as much as the zoom has moved since: the tile's own outline
     * is drawn at the new size underneath it, and a few frames of an edge a
     * fraction of a pixel soft is not something anybody sees in the middle of
     * a zoom. Drawing them afresh was most of what a zoom cost on open
     * country, every frame of it. A tile with none, or with one too far from
     * this size to stretch (`STAND_IN_MOST`), has one made at this size; a
     * tile with no edges has none at any size.
     */
    if (!this.zoomSettled) {
      const r = had ? zoom / had.zoom : 0;
      if (had && (!had.cv || (r <= STAND_IN_MOST && r * STAND_IN_MOST >= 1))) {
        this.hemUsed(cache, key, had);
        if (had.cv) ctx.drawImage(had.cv, pts[0] + (had.bx - had.px) * r, pts[1] + (had.by - had.py) * r, (had.cv.width / dpr) * r, (had.cv.height / dpr) * r);
        return had.cv !== null;
      }
    } else if (had && had.zoom === zoom) {
      const dx = (pts[0] - had.px) * dpr;
      const dy = (pts[1] - had.py) * dpr;
      const rx = Math.round(dx), ry = Math.round(dy);
      if (Math.abs(dx - rx) < 0.02 && Math.abs(dy - ry) < 0.02) {
        this.hemUsed(cache, key, had);
        if (had.cv) ctx.drawImage(had.cv, had.bx + rx / dpr, had.by + ry / dpr, had.cv.width / dpr, had.cv.height / dpr);
        return had.cv !== null;
      }
    }
    // Up to `HEMS_A_FRAME` made a frame, and the edges drawn as they always were past that.
    if (this.hemsMade >= HEMS_A_FRAME) return this.swardEdges(ctx, V, x, y, pts, zoom, lit);
    this.hemsMade++;
    if (had) {
      if (had.cv) this.hemPixels -= had.cv.width * had.cv.height;
      cache.delete(key);
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let k = 0; k < 8; k += 2) {
      x0 = Math.min(x0, pts[k]); x1 = Math.max(x1, pts[k]);
      y0 = Math.min(y0, pts[k + 1]); y1 = Math.max(y1, pts[k + 1]);
    }
    // A pixel either side for the antialiasing along the clip.
    const bx = Math.floor(x0 * dpr) - 1, by = Math.floor(y0 * dpr) - 1;
    const w = Math.ceil(x1 * dpr) + 1 - bx, h = Math.ceil(y1 * dpr) + 1 - by;
    if (w <= 0 || h <= 0 || w * h > HEM_TILE_MOST) return this.swardEdges(ctx, V, x, y, pts, zoom, lit);
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d');
    if (!g) return this.swardEdges(ctx, V, x, y, pts, zoom, lit);
    g.setTransform(dpr, 0, 0, dpr, -bx, -by);
    const drew = this.swardEdges(g, V, x, y, pts, zoom, lit);
    if (drew) this.hemRoom(w * h);
    cache.set(key, { cv: drew ? cv : null, px: pts[0], py: pts[1], bx: bx / dpr, by: by / dpr, zoom, used: this.frameNo });
    if (drew) {
      this.hemPixels += w * h;
      ctx.drawImage(cv, bx / dpr, by / dpr, w / dpr, h / dpr);
    }
    return drew;
  }

  /** A tile's edges drawn from its picture: to the back of the order they are put away in, once a frame. */
  private hemUsed(cache: Map<number, HemPicture>, key: number, h: HemPicture): void {
    if (h.used === this.frameNo) return;
    h.used = this.frameNo;
    cache.delete(key);
    cache.set(key, h);
  }

  /** Room for `need` more pixels of tiles' edges: the pictures gone longest undrawn put away, of either map, and never one drawn this frame. */
  private hemRoom(need: number): void {
    const most = HEM_PIXELS * this.canvas.dpr * this.canvas.dpr;
    if (this.hemPixels + need <= most) return;
    const lit = this.hemCache.entries(), mem = this.hemMemCache.entries();
    let a = lit.next(), b = mem.next();
    while (this.hemPixels + need > most) {
      const fromLit = !a.done && (b.done || a.value[1].used <= b.value[1].used);
      const at = fromLit ? a : b;
      if (at.done || at.value[1].used === this.frameNo) break;
      const [key, h] = at.value;
      if (h.cv) this.hemPixels -= h.cv.width * h.cv.height;
      (fromLit ? this.hemCache : this.hemMemCache).delete(key);
      if (fromLit) a = lit.next();
      else b = mem.next();
    }
  }

  /** One tile's ruffled edges, and one colour's worth of them: reused, never remade. */
  private hemBuf: number[] = [];
  private hemRun: number[] = [];

  /**
   * A field on a slope, as a shear of its flat picture: the plane through its
   * corners' heights, as how far each point goes down the screen for each
   * pixel across and down from the tile's middle, so its furrows lie on the
   * ground and its plants stand on it. Undefined on the flat. `off` is the
   * tile's corners on the screen from its base point, `ox, oy` its middle.
   */
  private fieldTilt(c: ArrayLike<number>, off: ArrayLike<number>, ox: number, oy: number, avg: number, hs: number): [number, number] | undefined {
    if (c[0] === c[1] && c[1] === c[2] && c[2] === c[3]) return undefined;
    let dx = 0, dy = 0, xx = 0, yy = 0;
    for (let i = 0; i < 4; i++) {
      const X = off[i * 2] - ox, Y = off[i * 2 + 1] - oy, D = -(c[i] - avg) * hs;
      dx += D * X; dy += D * Y; xx += X * X; yy += Y * Y;
    }
    // Kept to a plane a field can lie on: past that a picture sheared that far is more stretch than slope.
    const most = FIELD_TILT_MOST;
    return [Math.max(-most, Math.min(most, xx > 0 ? dx / xx : 0)), Math.max(-most, Math.min(most, yy > 0 ? dy / yy : 0))];
  }

  /**
   * A field's edges where it meets anything but field: a lip of turned soil
   * along each, a little raised -- its top lit, a line of shade inside it
   * and its foot outside. Field against field runs on with no edge.
   */
  private fieldLip(ctx: CanvasRenderingContext2D, V: View, x: number, y: number, pts: Float64Array, zoom: number, lit: boolean): boolean {
    const world = this.game.world;
    const cx = (pts[0] + pts[2] + pts[4] + pts[6]) / 4;
    const cy = (pts[1] + pts[3] + pts[5] + pts[7]) / 4;
    const top = new Path2D(), inner = new Path2D(), foot = new Path2D();
    let any = false;
    for (let e = 0; e < 4; e++) {
      const nx = x + V.edges[e][0], ny = y + V.edges[e][1];
      if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h) continue;
      if (this.groundAt(nx, ny, lit) === TileType.Field) continue;
      any = true;
      const f = (e + 1) & 3;
      const ax = pts[e * 2], ay = pts[e * 2 + 1], bx = pts[f * 2], by = pts[f * 2 + 1];
      // The lip's inner line: the edge taken in toward the middle.
      const k = FIELD_LIP;
      const ix = (px: number): number => px + (cx - px) * k, iy = (py: number): number => py + (cy - py) * k;
      top.moveTo(ax, ay); top.lineTo(bx, by); top.lineTo(ix(bx), iy(by)); top.lineTo(ix(ax), iy(ay)); top.closePath();
      inner.moveTo(ix(ax), iy(ay)); inner.lineTo(ix(bx), iy(by));
      foot.moveTo(ax, ay); foot.lineTo(bx, by);
    }
    if (!any) return false;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let k = 1; k < 4; k++) ctx.lineTo(pts[k * 2], pts[k * 2 + 1]);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = FIELD_LIP_TOP;
    ctx.fill(top);
    ctx.lineCap = 'round';
    ctx.strokeStyle = FIELD_LIP_SHADE;
    ctx.lineWidth = Math.max(0.6, 0.9 * zoom);
    ctx.stroke(inner);
    ctx.strokeStyle = FIELD_LIP_FOOT;
    ctx.lineWidth = Math.max(0.8, 1.4 * zoom);
    ctx.stroke(foot);
    ctx.restore();
    return true;
  }

  private swardEdges(ctx: CanvasRenderingContext2D, V: View, x: number, y: number, pts: Float64Array, zoom: number, lit: boolean): boolean {
    const world = this.game.world;
    const co = V.corners;
    const mine = world.heightAt(x + 0.5, y + 0.5);
    const ground = this.groundAt(x, y, lit);
    // A tilled field is cut clean: no sward ruffles over it, and a lip of turned soil along its edge (`fieldLip`).
    if (ground === TileType.Field) return this.fieldLip(ctx, V, x, y, pts, zoom, lit);
    const grew = growth(ground);
    const buf = this.hemBuf;
    buf.length = 0;
    for (let e = 0; e < 4; e++) {
      const nx = x + V.edges[e][0];
      const ny = y + V.edges[e][1];
      if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h) continue;
      const theirs = this.groundAt(nx, ny, lit);
      if (growth(theirs) <= grew) continue;
      const over = world.heightAt(nx + 0.5, ny + 0.5);
      /*
       * And only where the two are at much the same height. A field spills
       * over the lip of a path it is level with; it does not spill over the
       * top of a cliff it is standing twenty feet above, and a ruffle drawn
       * along that edge is a fringe of grass growing out of thin air.
       */
      if (Math.abs(over - mine) > UNITS_PER_TILE * 0.35) continue;
      if (over < 0) continue;
      const f = (e + 1) & 3;
      const a = co[e], b = co[f];
      buf.push(
        pts[e * 2], pts[e * 2 + 1], pts[f * 2], pts[f * 2 + 1],
        // Which ends of the edge are which swaps at every other quarter turn,
        // so the run is taken in the order the *world's* corners come in
        // rather than the screen's, or the ruffle reads one way round at one
        // rotation and the other at the next and the whole path crawls as the
        // camera comes about.
        a[0] * 2 + a[1] > b[0] * 2 + b[1] ? 1 : 0,
        // Off the pair of tiles, so the same join is the same ruffle whatever
        // the camera is doing and whichever of the two is being drawn.
        Math.floor(hash2(x + nx, y + ny, 907) * 0x7fffffff),
        theirs,
      );
    }
    if (!buf.length) return false;
    const cx = (pts[0] + pts[2] + pts[4] + pts[6]) / 4;
    const cy = (pts[1] + pts[3] + pts[5] + pts[7]) / 4;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let k = 1; k < 4; k++) ctx.lineTo(pts[k * 2], pts[k * 2 + 1]);
    ctx.closePath();
    ctx.clip();
    /*
     * A colour at a time. Two sides of a tile with the same field over them
     * go into one path and one set of fills, which is most of what a corner
     * of country where three grounds meet used to cost.
     */
    const run = this.hemRun;
    for (let i = 0; i < buf.length; i += 7) {
      const kind = buf[i + 6];
      let first = true;
      for (let j = 0; j < i; j += 7) if (buf[j + 6] === kind) { first = false; break; }
      if (!first) continue;
      run.length = 0;
      for (let j = i; j < buf.length; j += 7) {
        if (buf[j + 6] !== kind) continue;
        run.push(buf[j], buf[j + 1], buf[j + 2], buf[j + 3], buf[j + 4], buf[j + 5]);
      }
      // In the field's own colour, not the meadow's: a steppe runs out onto a
      // track looking like steppe.
      ruffle(ctx, hemOf(kind as TileType), run, cx, cy, zoom);
    }
    ctx.restore();
    return true;
  }

  /**
   * The wildflowers on a tile, plus one: how many clumps in the low three
   * bits, the colour the patch is mostly over them. Off the island's own rule
   * (`world/flowers.ts`) for the season it is, and none under a building.
   */
  private flowerAt(x: number, y: number): number {
    const had = this.flowerMarks.get(x, y);
    if (had) return had - 1;
    const w = this.game.world;
    const n = this.flowerSeasonNow === null || this.game.buildings.buildingAt(x, y) ? 0
      : flowersOn(w.seed, x, y, w.getTile(x, y), w.getData(x, y), this.flowerSeasonNow);
    const v = n ? n | (tileColour(x, y) << 3) : 0;
    this.flowerMarks.set(x, y, v + 1);
    return v;
  }

  /**
   * A tile's wildflowers: a clump for each its drift gives it, each where the
   * tile's coordinates put it, leaning with the wind and nodding on its own
   * clock (`render/flowers.ts`). From three fifths of a tile's zoom up they
   * are the painted clumps; further out, a speck of colour a clump, laid with
   * the rest of the line's in one fill a colour.
   *
   * What it costs: a kept lookup a tile of grass, and one picture blitted a
   * clump -- a fifth of a meadow flowers in summer and a tenth in spring, two
   * or three clumps a tile -- or a rectangle a clump from far off.
   */
  private drawFlowers(ctx: CanvasRenderingContext2D, x: number, y: number, pts: Float64Array, zoom: number): void {
    const f = this.flowerAt(x, y);
    const n = f & 7;
    if (!n) return;
    const main = f >> 3;
    const [a, b, c, d] = this.cornerAt;
    const ax = pts[a], ay = pts[a + 1], bx = pts[b], by = pts[b + 1];
    const cx = pts[c], cy = pts[c + 1], dx = pts[d], dy = pts[d + 1];
    const far = zoom < FLOWERS_DRAWN;
    const lean = this.lean.x * this.lean.force;
    for (let i = 0; i < n; i++) {
      const [u, v, colour, variant, phase, size] = clumpOf(x, y, i, n, main);
      const sx = (ax + (bx - ax) * u) * (1 - v) + (dx + (cx - dx) * u) * v;
      const sy = (ay + (by - ay) * u) * (1 - v) + (dy + (cy - dy) * u) * v;
      if (far) {
        // Two specks a clump, side by side, a little up off the ground.
        const k = this.flowerSpeckN[colour];
        const buf = this.flowerSpecks[colour];
        if (k + 4 <= buf.length) {
          buf[k] = sx - 2.4 * zoom;
          buf[k + 1] = sy - 3 * zoom;
          buf[k + 2] = sx + 2.2 * zoom;
          buf[k + 3] = sy - 4.4 * zoom;
          this.flowerSpeckN[colour] = k + 4;
        }
        continue;
      }
      const spr = flowerSprite(colour, variant, this.calm ? 0 : swayFrame(lean, this.lean.force, this.anim, phase));
      const k = zoom * size;
      const ready = this.atSize(spr.canvas, spr.w * k, spr.h * k);
      ctx.drawImage(ready, sx - spr.ax * k, sy - spr.ay * k, spr.w * k, spr.h * k);
    }
  }

  /** A steep tile's face, off its corners and the tiles round it: worked out once and kept. */
  private faceAt(x: number, y: number, gx: number, gy: number): Face {
    const w = this.game.world;
    const key = y * w.w + x;
    const had = this.faces.get(key);
    if (had) return had;
    const tops = topEdges(w.getHeight(x, y), w.getHeight(x + 1, y), w.getHeight(x + 1, y + 1), w.getHeight(x, y + 1));
    const face: Face = { tops: [-1, -1, -1, -1], wetTop: false, shade: 0 };
    for (let e = 0; e < 4; e++) {
      if (!tops[e]) continue;
      const nx = x + EDGES[e].dx, ny = y + EDGES[e].dy;
      if (!w.inBounds(nx, ny)) { face.tops[e] = -2; continue; }
      // The ground over the top edge grows, and is the top: not more of the same face going on up.
      const ground = this.groundAt(nx, ny, true);
      const steep = bareRock(slopeOf(w, nx, ny)) > 0;
      face.tops[e] = growth(ground) > 0 && !steep ? ground : -2;
      if (w.hasWater(nx, ny)) face.wetTop = true;
    }
    // Turned from the sun, which is in the south-east: its way down against (1, 1).
    const l = Math.hypot(gx, gy) || 1;
    face.shade = Math.max(0, Math.min(1, (1 + (gx + gy) / l / Math.SQRT2) / 2));
    if (this.faces.size > 16384) this.faces.clear();
    this.faces.set(key, face);
    return face;
  }

  /** Where each edge of a tile's square crosses a height, as (u, v) pairs, in order round it. */
  private crossings(h: readonly number[], level: number, out: number[]): number {
    let n = 0;
    const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) & 3;
      const a = h[i], b = h[j];
      if ((a < level) === (b < level)) continue;
      const t = (level - a) / (b - a);
      out[n++] = sq[i][0] + (sq[j][0] - sq[i][0]) * t;
      out[n++] = sq[i][1] + (sq[j][1] - sq[i][1]) * t;
    }
    return n;
  }

  private faceH = [0, 0, 0, 0];
  private faceCross = [0, 0, 0, 0, 0, 0, 0, 0];
  private faceDamp = [0, 0, 0, 0, 0, 0, 0, 0];

  /**
   * The dressing on a face of steep ground (`outcrops.ts`): its lip of grass,
   * its moss, its cracks and ferns, and the damp where water is at its foot
   * or over its top -- on a tile steep enough to show its rock, turned
   * towards the camera, and only the part of it above any water.
   *
   * What it costs: every tile pays four corner heights it already has and a
   * square root; a face in view pays a fill each for its moss and its lip,
   * and from three fifths of a tile's zoom a stroke of cracks, a fill of
   * damp and the moss's line and the lip's shade, a fern or two from zoom one
   * and the light on the moss and the lip from half as close again
   * (`drawFace`). Only a face with water against it is clipped, to the part
   * above the water. What it is made of is worked out once a face and kept.
   */
  private dressFace(ctx: CanvasRenderingContext2D, x: number, y: number, pts: Float64Array, zoom: number, sea: boolean, pond: boolean): void {
    const w = this.game.world;
    const h = this.faceH;
    h[0] = w.getHeight(x, y);
    h[1] = w.getHeight(x + 1, y);
    h[2] = w.getHeight(x + 1, y + 1);
    h[3] = w.getHeight(x, y + 1);
    // A pond's bank as steep as its ground beside the water is, as it is coloured (`pondBank`).
    const banked = pond && this.bankLevel > -Infinity;
    const gx = banked ? this.bankGx : (h[1] + h[2] - h[0] - h[3]) / 2 / UNITS_PER_TILE;
    const gy = banked ? this.bankGy : (h[2] + h[3] - h[0] - h[1]) / 2 / UNITS_PER_TILE;
    const bare = bareRock(Math.hypot(gx, gy));
    if (bare <= 0) return;
    const face = this.faceAt(x, y, gx, gy);
    const [a, b, c, d] = this.cornerAt;
    const ax = pts[a], ay = pts[a + 1], bx = pts[b], by = pts[b + 1];
    const cx = pts[c], cy = pts[c + 1], dx = pts[d], dy = pts[d + 1];
    const X = (u: number, v: number): number => (ax + (bx - ax) * u) * (1 - v) + (dx + (cx - dx) * u) * v;
    const Y = (u: number, v: number): number => (ay + (by - ay) * u) * (1 - v) + (dy + (cy - dy) * u) * v;
    // Turned towards the camera: its top edges higher on the screen than its middle.
    let up = 0;
    let tops = 0;
    for (let e = 0; e < 4; e++) {
      if (face.tops[e] === -1) continue;
      const E = EDGES[e];
      up += Y((E.a[0] + E.b[0]) / 2, (E.a[1] + E.b[1]) / 2);
      tops++;
    }
    if (!tops || up / tops >= Y(0.5, 0.5) - 1) return;
    // The water against it, if any: the sea's nothing, or a pond's level.
    let level = -Infinity;
    if (pond) level = w.surfaceAt(x, y);
    else if (sea) level = 0;
    const under = (h[0] < level ? 1 : 0) + (h[1] < level ? 1 : 0) + (h[2] < level ? 1 : 0) + (h[3] < level ? 1 : 0);
    if (under === 4) return;
    let waterline: [number, number, number, number] | null = null;
    let dampline: [number, number, number, number] | null = null;
    // Cut off at the water, where there is any against it; a dry face is dressed whole, and not cut at all.
    if (under) {
      ctx.save();
      ctx.beginPath();
      // Only above the water: the corners that stand clear of it and where its edges cross the line.
      const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
      let first = true;
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) & 3;
        if (h[i] >= level) {
          if (first) ctx.moveTo(X(sq[i][0], sq[i][1]), Y(sq[i][0], sq[i][1]));
          else ctx.lineTo(X(sq[i][0], sq[i][1]), Y(sq[i][0], sq[i][1]));
          first = false;
        }
        if ((h[i] < level) !== (h[j] < level)) {
          const t = (level - h[i]) / (h[j] - h[i]);
          const u = sq[i][0] + (sq[j][0] - sq[i][0]) * t, v = sq[i][1] + (sq[j][1] - sq[i][1]) * t;
          if (first) ctx.moveTo(X(u, v), Y(u, v));
          else ctx.lineTo(X(u, v), Y(u, v));
          first = false;
        }
      }
      const cr = this.faceCross, dm = this.faceDamp;
      if (this.crossings(h, level, cr) === 4 && this.crossings(h, level + DAMP_UNITS, dm) === 4) {
        waterline = [cr[0], cr[1], cr[2], cr[3]];
        // The damp line's ends matched to the waterline's, nearest to nearest.
        const flip = Math.hypot(dm[0] - cr[0], dm[1] - cr[1]) > Math.hypot(dm[2] - cr[0], dm[3] - cr[1]);
        dampline = flip ? [dm[2], dm[3], dm[0], dm[1]] : [dm[0], dm[1], dm[2], dm[3]];
      }
      ctx.closePath();
      ctx.clip();
    }
    drawFace(ctx, {
      x, y, face, bare, zoom, X, Y,
      hem: (t) => hemOf(t as TileType),
      moss: ROCK_MOSS,
      sized: (cv, cw, ch) => this.atSize(cv, cw, ch),
      waterline, dampline,
    }, zoom < 0.6 ? 0 : zoom < 1.5 ? 1 : 2);
    if (under) ctx.restore();
  }

  /** Which of a tile's screen corners, times two, is each of its world corners: (0,0), (1,0), (1,1), (0,1). Set each frame. */
  private cornerAt = [0, 2, 4, 6];

  /** A tile's path mask (`trails.ts`), from the tiles round it, kept until one of them changes. */
  private trailMaskAt(x: number, y: number, lit: boolean): number {
    const pages = lit ? this.trailMarks : this.trailMemMarks;
    const had = pages.get(x, y);
    if (had) return had - 1;
    const w = this.game.world;
    const m = trailMask((dx, dy) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < w.w && ny < w.h && w.viewTile(nx, ny, lit) === TileType.Trail;
    });
    pages.set(x, y, m + 1);
    return m;
  }

  /** The colour of a path's bare earth on a tile, shaded as the ground under it is. */
  private trailColor(x: number, y: number, lit: boolean): string {
    if (!lit) return this.computeColor(x, y, TileType.Trail, 0, this.sunNow, false, true);
    let c = this.trailPaint.get(x, y);
    if (!c) {
      const was = this.sunStale(this.trailPaintWas, x, y);
      if (was) return was;
      c = this.computeColor(x, y, TileType.Trail, 0, this.sunNow, true, true);
      this.trailPaint.set(x, y, c);
    }
    return c;
  }

  /** Lobes of grass along a path's edges, placed on screen: written over rather than made afresh. */
  private trailLobes: Lobe[] = [];
  /** The tile a path is cut to, let out, and two buffers to cut its pieces through. */
  private trailQuad = new Float64Array(8);
  private trailCut = [new Float64Array(1024), new Float64Array(1024)];

  /**
   * The part of a worn path that lies on one tile (`trails.ts`): its bare
   * earth, in the path's colour shaded as this tile is, and the lobes of the
   * ground's own green lying over its edges, cut to the tile. The shapes
   * are the tile's own square mapped onto the tile as it lies, so a path
   * follows the ground over a bank and holds still as the view comes round.
   *
   * What it costs: one fill a tile, cut to the tile by hand, and one more
   * for the lobes from three fifths of a tile's zoom up (two from
   * `TRAIL_NEAR`); the shapes are worked out once a tile and kept, and nothing
   * here is asked of a tile with no path on or beside it but its kept mask.
   */
  private drawTrail(ctx: CanvasRenderingContext2D, x: number, y: number, mask: number, pts: Float64Array, lit: boolean, zoom: number): void {
    const world = this.game.world;
    const key = y * world.w + x;
    let kept = this.trailShapes.get(key);
    if (!kept || kept.mask !== mask) {
      if (this.trailShapes.size > 4096) this.trailShapes.clear();
      kept = { mask, shape: trailShape(x, y, mask) };
      this.trailShapes.set(key, kept);
    }
    const { polys, lobes } = kept.shape;
    if (!polys.length) return;
    const [a, b, c, d] = this.cornerAt;
    const ax = pts[a], ay = pts[a + 1], bx = pts[b], by = pts[b + 1];
    const cx = pts[c], cy = pts[c + 1], dx = pts[d], dy = pts[d + 1];
    const X = (u: number, v: number): number => (ax + (bx - ax) * u) * (1 - v) + (dx + (cx - dx) * u) * v;
    const Y = (u: number, v: number): number => (ay + (by - ay) * u) * (1 - v) + (dy + (cy - dy) * u) * v;
    /*
     * Cut to the tile let out by a pixel and a half all round. The tile after
     * this one strokes its own outline in its own colour, and half of that
     * line lies on this tile -- across the path, wherever the path crosses
     * into it, as a thread of grass. This tile's path drawn over the edge lies
     * under the next tile's, which is the same path in the same place. Cut by
     * hand, on the screen, rather than with the canvas's clip: a clip is a
     * mask made and thrown away a tile, and it cost more than all the rest of
     * the path together.
     */
    const mx = (pts[0] + pts[2] + pts[4] + pts[6]) / 4, my = (pts[1] + pts[3] + pts[5] + pts[7]) / 4;
    const quad = this.trailQuad;
    for (let k = 0; k < 4; k++) {
      const ex = pts[k * 2] - mx, ey = pts[k * 2 + 1] - my;
      const el = Math.hypot(ex, ey) || 1;
      quad[k * 2] = pts[k * 2] + (ex / el) * 1.5;
      quad[k * 2 + 1] = pts[k * 2 + 1] + (ey / el) * 1.5;
    }
    ctx.beginPath();
    for (const p of polys) {
      let buf = this.trailCut[0];
      let n = 0;
      for (let i = 0; i < p.length && n + 2 <= buf.length; i += 2) {
        buf[n++] = X(p[i], p[i + 1]);
        buf[n++] = Y(p[i], p[i + 1]);
      }
      for (let k = 0; k < 4 && n; k++) {
        const out = buf === this.trailCut[0] ? this.trailCut[1] : this.trailCut[0];
        n = cutByLine(buf, n, quad[k * 2], quad[k * 2 + 1], quad[((k + 1) & 3) * 2], quad[((k + 1) & 3) * 2 + 1], mx, my, out);
        buf = out;
      }
      if (n < 6) continue;
      ctx.moveTo(buf[0], buf[1]);
      for (let i = 2; i < n; i += 2) ctx.lineTo(buf[i], buf[i + 1]);
      ctx.closePath();
    }
    ctx.fillStyle = this.trailColor(x, y, lit);
    ctx.fill();
    // The grass over its edges, only where there is grass to lie over them,
    // only on ground in sight, and only close enough to see a lobe.
    const ground = this.groundAt(x, y, lit);
    if (lit && zoom >= 0.6 && lobes.length && growth(ground) > 0) {
      const r = TRAIL_LOBE * zoom;
      const at = this.trailLobes;
      let n = 0;
      for (let i = 0; i < lobes.length; i += 3) {
        const lx = X(lobes[i], lobes[i + 1]), ly = Y(lobes[i], lobes[i + 1]), lr = r * lobes[i + 2];
        const had = at[n];
        if (had) { had[0] = lx; had[1] = ly; had[2] = lr; } else at[n] = [lx, ly, lr];
        n++;
      }
      /*
       * No line round them and no light on them: they are the grass itself
       * running to the path's edge, not tufts lying on it, and lit one by one
       * they were a row of beads. Close to, a breath of shade under them
       * first, down and away from the sun, so the grass stands a little proud
       * of the earth it has grown over; from further off the lobes alone, a
       * fill a tile.
       */
      if (zoom >= TRAIL_NEAR) circles(ctx, at, n, r * 0.3, r * 0.35, 0, TRAIL_SHADE);
      circles(ctx, at, n, 0, 0, 0, hemOf(ground).shade);
    }
  }

  /**
   * A square picture laid over a tile, in two triangles.
   *
   * A tile whose four corners stand at four heights is not a parallelogram, so
   * the one transform a wall's face is blitted with will not do: it is cut on
   * the diagonal and each half taken across on its own, which is what every
   * renderer does with a bent quad. The two halves are clipped to exactly the
   * same diagonal and not a pixel over it: a blend laid on twice is not the
   * same as a blend laid on once, so a sliver of overlap where they meet
   * comes out as a bright line straight across every tile in the road.
   *
   * `rot` says which of the four screen corners holds the tile's own (0, 0).
   * The picture is hung off the world's axes rather than off the screen's, so
   * a road holds still when the camera turns and a tile butts its neighbour
   * whichever way round the two of them have come out.
   */
  private laidOver(img: HTMLCanvasElement, pts: Float64Array, rot: number, mode: GlobalCompositeOperation): void {
    const ctx = this.groundCtx ?? this.canvas.ctx;
    const qx: number[] = [];
    const qy: number[] = [];
    for (let i = 0; i < 4; i++) {
      const k = (rot + i) & 3;
      qx.push(pts[k * 2]);
      qy.push(pts[k * 2 + 1]);
    }
    /*
     * Squeezed to the size it is going to be drawn at, once per zoom, so the
     * blit is one device pixel to one. A picture taken down by three as it
     * goes on costs several times what the same picture costs at its own
     * size, and over a field of open country that alone was a third of the
     * frame.
     */
    const ready = this.atSize(img, Math.hypot(qx[1] - qx[0], qy[1] - qy[0]), 0);
    const s = ready.width;
    ctx.save();
    ctx.globalCompositeOperation = mode;
    /*
     * A tile whose four corners lie in a plane comes out on screen as a
     * parallelogram, and a parallelogram is one transform with no clipping at
     * all -- the picture is square, so its own four corners land on the
     * tile's. That is the ordinary case: ground is mostly smooth, and it is
     * the difference between two clipped blits a tile and one bare one, which
     * over a field is the difference between sixty frames a second and
     * fifteen. Anything genuinely bowed falls through to the two halves.
     */
    const bow = Math.abs(qx[0] - qx[1] + qx[2] - qx[3]) + Math.abs(qy[0] - qy[1] + qy[2] - qy[3]);
    if (bow < 0.7) {
      ctx.transform((qx[1] - qx[0]) / s, (qy[1] - qy[0]) / s, (qx[3] - qx[0]) / s, (qy[3] - qy[0]) / s, qx[0], qy[0]);
      ctx.drawImage(ready, 0, 0);
      ctx.restore();
      return;
    }
    const half = (i0: number, i1: number, i2: number, a: number, b: number, c: number, d: number): void => {
      ctx.save();
      ctx.beginPath();
      for (const i of [i0, i1, i2]) ctx.lineTo(qx[i], qy[i]);
      ctx.closePath();
      ctx.clip();
      ctx.transform(a, b, c, d, qx[i0], qy[i0]);
      ctx.drawImage(ready, 0, 0);
      ctx.restore();
    };
    // (0,0) (s,0) (s,s), then (0,0) (s,s) (0,s).
    half(0, 1, 2, (qx[1] - qx[0]) / s, (qy[1] - qy[0]) / s, (qx[2] - qx[1]) / s, (qy[2] - qy[1]) / s);
    half(0, 2, 3, (qx[2] - qx[3]) / s, (qy[2] - qy[3]) / s, (qx[3] - qx[0]) / s, (qy[3] - qy[0]) / s);
    ctx.restore();
  }

  /**
   * What a paved tile is paved with.
   *
   * Asked for after the walls: the same treatment for floors, pavements and
   * roofs. A pavement is the easiest of the three to get wrong, because the
   * ground it sits in is drawn as one flat colour a tile and paving drawn that
   * way is a coloured-in square — you cannot tell a road from a lawn that
   * happens to be grey.
   *
   * So the stones are painted, cobbles and slabs, and laid on in light and
   * shade rather than in a colour of their own: the light, the weather and
   * the cold wash over remembered land are all already in the colour
   * underneath, and none of them has to be worked out twice. Slabs were a
   * grid of squares a shade lighter or darker than each other, which is a
   * chequer; they are cut stones now, their arrises lit, their faces the
   * stone's -- see `slabbing`. Every picture comes off the tile's own
   * coordinates, so a road holds still while you walk down it.
   */
  private paving(t: TileType, x: number, y: number, data: number, pts: Float64Array, rot: number, lit = true): void {
    if (t === TileType.Cobblestone) {
      /*
       * A road is a picture, not a pattern. It was six by six rectangles with
       * every other row shoved half a stone over, tinted light and dark --
       * which says the right thing about how setts are laid and nothing about
       * what a sett is. The picture is painted in light and shade and laid on
       * with `overlay`, so the tile keeps its own colour, its sun and its fog
       * and the road is a shape cut in them.
       */
      const cob = cobble();
      const q = cob.paveN;
      const road = cob.pave();
      const i = (((y % q) + q) % q) * q + (((x % q) + q) % q);
      this.laidOver(road[i], pts, rot, 'overlay');
      if (lit) this.pavingMoss(road, q, i, x, y, pts, rot);
      return;
    }
    // Slabs, laid as their stone splits and in the size it comes off the block in.
    const v = slabVariant(data);
    const tiles = slabbing(v, SLAB_VARIANTS[v].courses);
    const q = FLOOR_TILES;
    const i = (((y % q) + q) % q) * q + (((x % q) + q) % q);
    this.laidOver(tiles[i], pts, rot, 'overlay');
    if (lit) this.pavingMoss(tiles, q, i, x, y, pts, rot);
  }

  /**
   * The moss in a paved tile's joints (`greening.ts`): as far on as the days
   * since it was laid or scrubbed have brought it, a little further by water,
   * and a stage either way tile to tile so a road greens in patches rather
   * than all at one pace. Laid over the paving picture of the same index, in
   * its own colour rather than in the ground's light and shade.
   */
  private pavingMoss(pics: HTMLCanvasElement[], q: number, i: number, x: number, y: number, pts: Float64Array, rot: number): void {
    const stage = this.mossStage(x, y);
    if (stage < 0) return;
    const moss = pavingMoss(pics, q, stage);
    if (moss) this.laidOver(moss[i], pts, rot, 'source-over');
  }

  /** How far on the moss in a paved tile's joints is (`pavingMoss`), or -1 for none. */
  private mossStage(x: number, y: number): number {
    const days = pavingGreen(this.game, x, y, this.greenAt);
    if (!days) return -1;
    const g = greenShows(days, 0, this.walls.wetness(x, y));
    return Math.max(0, Math.min(PAVE_STAGES, Math.round(g * PAVE_STAGES + (hashOf(x, y, 0, 5) - 0.5) * 1.6)));
  }

  /**
   * What grows on a tile of grass, which is the whole of what grass has on it.
   *
   * The field itself is flat colour and stays that way. It carried a texture
   * for a while -- a sward of soft light and shade laid over the lot of it --
   * and flat is better: the ground the references are drawn on is one green
   * with the detail sitting on it in pieces you can count, and a wash over
   * the whole field puts the ground into the same range of light and dark as
   * the things standing in it.
   *
   * Only on ground you can actually see: remembered ground keeps its shape
   * and its trees and nothing else, and a clump you are remembering is not a
   * clump you are looking at.
   */
  private strewTile(type: TileType, x: number, y: number, pts: Float64Array, rot: number, zoom: number, lit: boolean, box?: number[]): void {
    const ctx = this.groundCtx ?? this.canvas.ctx;
    const m = strew(type);
    if (!lit) return;
    // The tile's own corners, so a daisy stays on the same square foot of
    // ground when the camera comes round rather than jumping a corner.
    const A = (rot & 3) * 2, B = ((rot + 1) & 3) * 2, C = ((rot + 2) & 3) * 2, D = ((rot + 3) & 3) * 2;
    const atX = (u: number, v: number): number =>
      (pts[A] * (1 - u) + pts[B] * u) * (1 - v) + (pts[D] * (1 - u) + pts[C] * u) * v;
    const atY = (u: number, v: number): number =>
      (pts[A + 1] * (1 - u) + pts[B + 1] * u) * (1 - v) + (pts[D + 1] * (1 - u) + pts[C + 1] * u) * v;
    const look = m.looks[strewLook(m.cuts, x, y)];
    const lo = look.blobN[0];
    const n = lo + Math.floor(hash2(x, y, 301) * (look.blobN[1] - lo + 1));
    // Where the first one stands. The rest are placed off it rather than off
    // the tile, so a look that says its clumps are crowded together grows
    // them crowded together instead of one in each far corner.
    const u0 = 0.16 + hash2(x, y, 311) * 0.68;
    const v0 = 0.16 + hash2(x, y, 312) * 0.68;
    const crowd = look.spread < CROWD;
    for (let i = 0; i < n; i++) {
      const pick = look.slots ? look.slots[Math.min(i, look.slots.length - 1)] : look.blobs;
      const b = m.blobs[pick[Math.floor(hash2(x, y, 310 + i * 3) * pick.length) % pick.length]];
      let u = u0, v = v0;
      if (i) {
        u = u0 + (hash2(x, y, 311 + i * 3) - 0.5) * 2 * look.spread;
        // In a crowd the later ones come down the screen as well as across,
        // so the one drawn over the top of another is the one in front of it.
        v = crowd
          ? v0 + hash2(x, y, 312 + i * 3) * look.spread
          : v0 + (hash2(x, y, 312 + i * 3) - 0.5) * 2 * look.spread;
        u = Math.min(0.9, Math.max(0.1, u));
        v = Math.min(0.9, Math.max(0.1, v));
      }
      const left = atX(u, v) - b.ax * zoom, top = atY(u, v) - b.ay * zoom;
      // Only where it would go, for a block's picture to make room for it (`bakeChunk`).
      if (box) {
        box[0] = Math.min(box[0], left); box[1] = Math.min(box[1], top);
        box[2] = Math.max(box[2], left + b.w * zoom); box[3] = Math.max(box[3], top + b.h * zoom);
        continue;
      }
      const ready = this.atSize(b.canvas, b.w * zoom, b.h * zoom);
      ctx.drawImage(ready, left, top, b.w * zoom, b.h * zoom);
    }
  }


  /**
   * The ore's colour washed into the stone, which is what a tile of it fills
   * with. Into a buffer, because this is worked out for every rock tile on the
   * screen every time its colour is: a new array apiece was three hundred of
   * them a frame for a number that is the same three numbers each time.
   */
  private oreBuf: [number, number, number] = [0, 0, 0];

  /**
   * Grain on the ground, close up. From a distance a tile is a flat lozenge of
   * colour and that is the right amount of detail for it; at the zoom where
   * you are actually standing on a thing, flat colour reads as paper. Five
   * specks per tile, placed from the tile's own coordinates so they never
   * crawl, laid into a path shared by the whole diagonal.
   *
   * The specks are plain black and white at low alpha rather than a shade of
   * the ground, which means no colour has to be worked out per tile and any
   * ground — sand, rock, a cliff face, a ploughed field — gets grain that
   * suits it.
   */
  private addGrain(x: number, y: number, pts: Float64Array, zoom: number): void {
    const size = Math.max(1, 2.6 * zoom);
    for (let i = 0; i < GRAIN_SPECKS; i++) {
      const a = hash2(x, y, 40 + i * 3);
      const b = hash2(x, y, 41 + i * 3);
      // Bilinear across the quad, so a speck sits on the ground however the
      // corners are pulled about.
      const top = 1 - b;
      const sx = (pts[0] * (1 - a) + pts[2] * a) * top + (pts[6] * (1 - a) + pts[4] * a) * b;
      const sy = (pts[1] * (1 - a) + pts[3] * a) * top + (pts[7] * (1 - a) + pts[5] * a) * b;
      if (hash2(x, y, 42 + i * 3) < 0.5) {
        if (this.grainN + 3 > this.grainDark.length) continue;
        this.grainDark[this.grainN++] = sx - size * 0.5;
        this.grainDark[this.grainN++] = sy - size * 0.5;
        this.grainDark[this.grainN++] = size;
      } else {
        if (this.grainM + 3 > this.grainPale.length) continue;
        this.grainPale[this.grainM++] = sx - size * 0.5;
        this.grainPale[this.grainM++] = sy - size * 0.5;
        this.grainPale[this.grainM++] = size;
      }
    }
  }

  /** Lay a row's worth of speckles down in one fill. */
  private specks(ctx: CanvasRenderingContext2D, buf: Float32Array, n: number, ink: string): void {
    if (!n) return;
    ctx.beginPath();
    for (let i = 0; i < n; i += 3) ctx.rect(buf[i], buf[i + 1], buf[i + 2], buf[i + 2]);
    ctx.fillStyle = ink;
    ctx.fill();
  }

  /** The wall clock, in real seconds, for what greens (`greening.ts`): read once a frame. */
  private greenAt = 0;
  /** What a material bridge's pieces are worked out from this frame: the camera and the ground (`bridgekit.ts`). */
  private bFrame: BridgeFrame | null = null;
  private bridgeFrame(): BridgeFrame {
    if (!this.bFrame) {
      const cam = this.camera, world = this.game.world;
      this.bFrame = {
        rotation: cam.rotation,
        sx: (wx, wy) => cam.worldToScreenX(wx, wy),
        sy: (wx, wy, h) => cam.worldToScreenY(wx, wy, h),
        heightAt: (wx, wy) => world.heightAt(wx, wy),
        greenStage: (b) => Math.round(greenShows(bridgeGreen(this.game, b, this.greenAt) ?? 0, 0, 0) * PAVE_STAGES),
      };
    }
    return this.bFrame;
  }
  /** Whether the ivy is in flower: in spring and summer (`seasonAt`). */
  private bloom = false;

  /**
   * One frame, with the camera put on a whole device pixel for the length of
   * it: everything drawn then lands on the same fraction of a pixel frame
   * after frame however the view is panned, which is what lets a picture made
   * in one frame be laid down unchanged in the next (`hems`). Half a device
   * pixel at most, and put back afterwards for everything that reads the
   * camera between frames.
   */
  render(dt: number): void {
    const cam = this.camera;
    // Closer once the sculpted bodies have loaded; until then, the flat figure's ceiling.
    cam.closest(sculptedReady() ? SCULPTED_MAX_ZOOM : MAX_ZOOM);
    const cx = cam.cx, cy = cam.cy;
    const unit = cam.zoom * this.canvas.dpr;
    cam.cx = Math.round(cx * unit) / unit;
    cam.cy = Math.round(cy * unit) / unit;
    /*
     * The pictures are for one view and one screen, and each knows the zoom
     * it was made at. While the zoom is moving, and for `ZOOM_SETTLE` after,
     * the ground's edges and the trees are put down from the pictures they
     * had, stretched to the size wanted (`hems`, `drawTree`, `atSize`), and
     * none is made for a size that will be gone next frame; walls and roofs
     * are drawn as they always were while it moves (`baked`). Turning the
     * view or resizing the screen drops the edges outright: a picture of a
     * tile from another quarter is not the same tile stretched.
     */
    const fit = `${cam.rotation}|${cam.width}|${cam.height}|${this.canvas.dpr}`;
    const now = performance.now();
    this.hemSteady = cam.zoom === this.hemZoomWas;
    if (!this.hemSteady) this.zoomMovedAt = now;
    this.hemZoomWas = cam.zoom;
    this.zoomSettled = now - this.zoomMovedAt >= ZOOM_SETTLE;
    this.stillsLeft.left = this.zoomSettled ? STILLS_A_FRAME : 0;
    piecesFrame(this.zoomSettled);
    beastFrame();
    bodiesFrame(this.zoomSettled);
    zoomHeld.left = this.zoomSettled ? 1 : 0;
    this.hemsMade = 0;
    if (fit !== this.hemFor) {
      this.hemFor = fit;
      this.forgetHems();
    }
    this.timings.set(this.timed, this.game.settings.timings);
    sculptedFigures(true);
    this.timings.begin();
    try {
      this.renderFrame(dt);
      this.drawBodies();
      // The solid trees' work after the frame, in what is left of it (`tree3dIdle`).
      if ((TREE3D_SPECIES.size || BUSH3D_SPECIES.size) && !this.still) {
        let next = nextSunStep(this.solidHour, darknessAt);
        const look = this.lookAhead();
        // The look turns before the sun next steps: the sun's next step would be made in the look going out.
        if (look && look.step === sunStepOf(this.solidHour, this.solidDark)) next = null;
        tree3dIdle(IDLE_FRAME_MS - (performance.now() - now), next, this.game.player.x, this.game.player.y, look);
      }
    } finally {
      cam.cx = cx;
      cam.cy = cy;
      this.timings.end(performance.now() / 1000);
    }
  }

  /**
   * The bodies the frame asked for, drawn together at its end (`drawBodies` in `./figure`): put down from the next frame.
   * A method of its own so the timings count it with the figures.
   */
  drawBodies(): void {
    drawBodies();
  }

  /** Where the drawing went, layer by layer, while `Settings.timings` is on. */
  readonly timings = new Timings();
  /** What the timings wrap: the renderer and its painters. */
  private readonly timed: readonly object[] = [this, this.waters, this.roofs];

  /** The fast graphics this frame (`Settings.graphics`, or Low power): no swell, no haze, no small life. */
  private fast = false;
  /** The low-end graphics this frame (`drawsLow`, or Low power): no wakes and no dust either, and the solid trees, bushes, stumps, logs and fields drawn flat. */
  private still = false;
  /** Less motion this frame (`lessMotion`), or animations off: no sway in trees, bushes and flowers, no bob or pulse in the markers, steady lights. */
  private calm = false;
  /**
   * Animations off this frame (`Settings.animations`, `animationsOff`): `anim` stood still, every body and creature in its
   * still pose, no wakes or dust raised, a cart's rock and her wheels' turn held, the small life's clock held, a blow's
   * flash on a body not drawn, the action effects off, and the spells' lingering effects held where they are.
   */
  private held = false;
  /** The island's clock the small life was last drawn at (`Life.frame`), held while animations are off. */
  private lifeClock = 0;
  /**
   * Whether the distance is hazed over (`drawHaze`). Off for a view with no
   * distance in it to speak of: the landing page's cove (src/landing/backdrop.ts),
   * a few dozen tiles drawn whole, which the band only greyed.
   */
  hazeOn = true;
  /**
   * A view's own colour for its ground, laid over each tile's base colour
   * before it is lit: given the tile and what it is, it changes `rgb` in
   * place. Null everywhere but the landing page's cove (src/landing/backdrop.ts),
   * whose meadow is drawn a summer green and its sand blended into it by how
   * far each tile is from the water. Read when a tile's colour is worked out
   * and cached with it, so it is set before the first frame.
   */
  groundTint: ((x: number, y: number, ground: TileType, rgb: [number, number, number]) => void) | null = null;
  private readonly tintBuf: [number, number, number] = [0, 0, 0];
  /** A strand of sand drawn along the sea's shore (`ShorePainter.beach`): null but for the landing page's cove. */
  set beach(strand: { reach: number; css: string } | null) {
    this.shore.beach = strand;
  }

  /** Frames drawn, for anything worked out once a frame and asked for more than once in it. */
  private frameNo = 0;

  /** Trees and bushes drawn this frame, and how many of them as solids (`./trees3d`): none with the low-end graphics. */
  readonly drawnTrees = { all: 0, solid: 0 };
  /** Whether the solid trees and bushes move in the wind this frame: never with less motion. */
  get treesSway(): boolean {
    return this.solidSway;
  }

  private renderFrame(dt: number): void {
    this.frameNo++;
    this.drawnTrees.all = this.drawnTrees.solid = 0;
    const phone = onPhone();
    this.fast = drawsFast(this.game.settings, phone);
    this.still = drawsLow(this.game.settings, phone);
    setAnimations(this.game.settings.animations !== 'off');
    this.held = animationsOff();
    this.calm = lessMotion() || this.held;
    this.time += dt;
    if (!this.held) this.anim += dt;
    this.frameDt = dt;
    this.poolRuns.clear();
    this.greenAt = greenNow();
    this.bFrame = null;
    const season = seasonAt(this.greenAt).season;
    this.bloom = season === 'spring' || season === 'summer';
    // Whether the fields are waiting out a winter, which they are drawn doing: asked once a frame, not once a tile.
    this.dormant = fieldRate(this.game.wallNow()) <= 0;
    // And the sun's step the fields are lit at (`fieldBake`), and a new frame's time to bake them in.
    this.cropStep = sunStepOf(this.game.hourOfDay(), this.game.darkness());
    cropFrame();
    // Pinned on a storey nothing is let go to be seen through: the storey is drawn whole (`storeyview.ts`).
    this.pinned = this.game.pinnedStorey();
    this.roomTiles = this.pinned === null ? this.myRoom() : null;
    // The spells first: what they light is among what is burning.
    this.spells.update({ eye: this.camera, now: performance.now() / 1000, dt, fast: this.fast, night: this.game.darkness(), held: this.held });
    // And what bodies' work threw off, on the same stage, after the spells (`./fx/actions.ts`).
    this.actionFx.update({ eye: this.camera, now: performance.now() / 1000, dt, fast: this.fast, night: this.game.darkness(), effects: this.held ? 'off' : this.game.settings.effects, calm: this.calm, me: this.game.player });
    this.game.spellLights = this.spells.lights;
    // What is burning, for glass to glow with at night, and last frame's glow gone.
    if (this.game.darkness() > 0.02) {
      // One list, the lights' own, rather than three spread into a fourth.
      const lights = this.game.lights();
      for (const l of this.runeLanternPools()) lights.push(l);
      for (const l of this.denPools()) lights.push(l);
      this.lightsNow = lights;
    } else this.lightsNow = [];
    this.glassNight.length = 0;
    // Every drawbridge by the border it is hinged on, and the two tiles either side of that border, one of
    // which draws it (`drawGateAt`): a number per tile, so the tiles with none cost one lookup.
    this.drawbridges.clear();
    this.landings.clear();
    this.hingeTiles.clear();
    if (this.game.bridges.size) {
      for (const b of this.game.bridges.values()) {
        if (!isDrawbridge(b)) continue;
        // And the border its far end comes down on, where the crib it lands on is drawn from.
        for (const [border, into] of [[hingeOf(b), this.drawbridges], [landingOf(b), this.landings]] as const) {
          into.set(hingeKey(0, border), b);
          this.hingeTiles.add(border.x * 65536 + border.y);
          this.hingeTiles.add(border.dir === 'h' ? border.x * 65536 + border.y - 1 : (border.x - 1) * 65536 + border.y);
        }
      }
    }
    // Other people are walked along between one word about them and the next,
    // on the drawing clock rather than the world's: it is smoothing, not
    // simulation, and should stay smooth even when nothing is being simulated.
    if (this.game.roster.size) this.game.roster.ease(dt);
    const canvas = this.canvas;
    const ctx = canvas.ctx;
    const W = canvas.width;
    const H = canvas.height;
    const cam = this.camera;
    const world = this.game.world;
    const zoom = cam.zoom;
    // How sharp the sprites want to be, which is a question about how close
    // the camera is. Nothing happens here unless the answer has changed.
    spriteScaleFor(zoom);
    cam.setViewport(W, H);
    canvas.begin();
    // Past the edge of the island is sky and distance rather than a hole. It
    // takes the hour's colour, so the horizon at dusk is the dusk's.
    const hour0 = this.game.hourOfDay();
    const sky = skyAt(this.game.darkness(), Math.max(0, 1 - Math.min(Math.abs(hour0 - DAWN), Math.abs(hour0 - DUSK)) / 2.6));
    this.sky = sky;
    // The island's year, for what flowers and what does not (`seasonAt`): read off the wall clock once a frame.
    this.season = seasonAt(this.game.wallNow()).season;
    const voidInk = css(unknownInk(sky));
    const back = ctx.createLinearGradient(0, 0, 0, H);
    back.addColorStop(0, css(sky.top));
    back.addColorStop(0.62, css(sky.far));
    back.addColorStop(1, css(sky.far));
    ctx.fillStyle = back;
    ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';

    // The ground is walked in the lattice of whichever viewpoint we are at:
    // `d` down the screen a line at a time, `e` along it. The lattice is a
    // root-two step coarser at the diagonals, where a tile is a rectangle
    // rather than a diamond, and denser cells would draw each one twice.
    const V = cam.view;
    const stepW = HALF_W * V.unit;
    const stepH = HALF_H * V.unit;
    const b = cam.isoBounds();
    const eMin = Math.floor(b.left / stepW) - 1;
    const eMax = Math.ceil(b.right / stepW) + 1;
    const eStep = V.staggered ? 2 : 1;
    const dLo = Math.floor((b.top + world.minHeight * HEIGHT_SCALE) / stepH) - 2;
    const dHi = Math.ceil((b.bottom + world.maxHeight * HEIGHT_SCALE) / stepH) + 1;
    // Looking into a cellar, the building over it is taken off, roof and all: see `drawCellarView`.
    this.cellarFrame = this.game.cellarView();
    this.cut.clear();
    if (this.cellarFrame) {
      for (const cel of this.game.buildings.cellars.values()) this.cut.add(cel.building);
      this.stairs.cutInFront();
    }
    this.structuresFrame();
    this.roofs.queueRoofs(V, dLo, dHi);
    // What the spells drew this frame, sorted into the lines it goes down with.
    this.spells.layout(ctx, V, dLo, dHi);
    this.linePilasters.length = 0;
    this.liftPics.length = 0;
    this.frameCuts.clear();
    this.jettyCuts.clear();
    const grid = this.game.settings.grid && zoom >= 0.7;
    const vision = this.game.vision;
    const fogged = this.game.settings.fog;
    /*
     * The wash over remembered ground, gathered a line at a time and laid over
     * the world once at the end, so a remembered wood goes cold with its
     * ground. But what is in sight and stands higher than remembered ground
     * behind it -- a hilltop over the plain behind it, a deck on piers, a
     * poured slab, a wall -- is drawn over that ground, and its wash, laid
     * last, would darken it. So whatever in sight comes up the screen past the
     * wash behind it (`over`) is gathered as well, and at the end the wash goes
     * onto a layer of its own (`fogLayer`) and that is taken off it before it
     * is laid over the world. Remembered ground in front that comes back down
     * over any of that is the one thing that cannot wait: the wash so far is
     * laid, and taken off, before its own goes on. Where nothing in sight
     * comes up past the wash behind it, the wash is the one fill it always
     * was.
     */
    const raising = fogged && (this.game.buildings.pierTiles.size > 0 || this.game.foundations.size > 0);
    const walled = fogged && this.game.buildings.walls.size > 0;
    const columned = fogged && this.game.buildings.columns.size > 0;
    const washAt = fogged ? 1 - eMin + this.washColumns(V, eMax - eMin + 4) : 0;
    const drawnAt = ctx.getTransform();
    let wash: HTMLCanvasElement | null = null;
    let fogPath = new Path2D();
    let lineFog = new Path2D();
    let liftPath = new Path2D();
    // Any wash gathered yet this frame; and any waiting in `fogPath` to be laid.
    let washed = false;
    let gathered = false;
    let lineAny = false;
    // Whether remembered ground on this line came down over something waiting to take the wash off.
    let lineOver = false;
    this.lifted = false;
    this.pierFeet.clear();
    this.waters.wetPiers(cam.view);
    this.plantFrame = this.game.waterPlants.size
      ? { cam, t: this.anim, now: Date.now() / 1000, dark: this.game.darkness(), surface: this.drawnSurface, ground: this.groundHere }
      : null;
    // The swell runs down the wind, and everything crossing open water drags
    // something behind it. Both are worked out once for the frame.
    const wind = this.game.wind();
    this.surf = { dirX: Math.cos(wind.dir), dirY: Math.sin(wind.dir), force: wind.force };
    // Which way the wind pushes on screen. Everything rooted leans this way
    // and smoke drifts this way, so it is worked out once for the frame.
    {
      const lu = cam.rotateX(this.surf.dirX, this.surf.dirY);
      const lv = cam.rotateY(this.surf.dirX, this.surf.dirY);
      const lx = (lu - lv) * HALF_W;
      const ly = (lu + lv) * HALF_H;
      const ll = Math.hypot(lx, ly) || 1;
      this.lean = { x: lx / ll, y: ly / ll, force: wind.force };
    }
    if (!this.still && !this.held) {
      this.waters.markWakes();
      this.markDust();
    }
    // Wildflowers come and go with the season, and none grow inside a building.
    {
      const season = flowerSeason(this.game.wallNow());
      const built = this.game.buildings.list.size;
      if (season !== this.flowerSeasonNow || built !== this.flowerBuildings) {
        this.flowerSeasonNow = season;
        this.flowerBuildings = built;
        this.flowerMarks.clear();
      }
    }
    // A tile last seen a moment ago has a new memory; throw away the colour
    // that was worked out from the old one.
    if (vision.revision !== this.lastVision) {
      /*
       * The blocks' tiles are checked again where what is in sight has changed:
       * one change since the last frame is inside its box and the box before
       * it, and two or more might be anywhere.
       */
      const one = vision.revision === this.lastVision + 1;
      this.lastVision = vision.revision;
      const box = vision.dirty;
      const was = this.sightWas;
      if (one && box && was) {
        this.chunks.sightBox(V, Math.min(box.x0, was.x0) - 3, Math.min(box.y0, was.y0) - 3, Math.max(box.x1, was.x1) + 3, Math.max(box.y1, was.y1) + 3, vision.revision);
      } else this.chunks.sightAll(vision.revision);
      this.sightWas = box ? { ...box } : null;
      if (box) {
        this.memColors.forgetBox(Math.max(0, box.x0), Math.max(0, box.y0),
          Math.min(world.w - 1, box.x1), Math.min(world.h - 1, box.y1));
        this.chunks.forgetBox(V, box.x0, box.y0, box.x1, box.y1, true);
      } else {
        this.memColors.clear();
        this.chunks.forgetMem();
      }
    }
    /*
     * And the edges and path marks of remembered ground, for the tiles
     * remembered afresh and the eight round each, which they read. They were
     * all dropped whenever the sight moved, which on the move is every tile:
     * ~170 edge pictures made again a frame, a frame of up to a second.
     */
    const fresh = world.takeRemembered();
    if (!fresh) {
      this.forgetHems(false);
      this.trailMemMarks.clear();
      this.chunks.forgetMem();
    } else {
      for (const i of fresh) {
        const x = i % world.w, y = (i - x) / world.w;
        // Remembered afresh: what a block drew of it remembered is out of date, and what it drew of it in sight is not.
        this.chunks.forgetBox(V, x - 2, y - 2, x + 2, y + 2, true);
        for (let ny = y - 1; ny <= y + 1; ny++) {
          for (let nx = x - 1; nx <= x + 1; nx++) {
            if (!world.inBounds(nx, ny)) continue;
            this.forgetHem(this.hemMemCache, ny * world.w + nx);
            this.trailMemMarks.forget(nx, ny);
          }
        }
      }
    }
    // The sun moves through the day, so the ground has to be shaded again as it
    // goes. It is cut into steps rather than recomputed every frame: a repaint
    // a few times an in-game hour is nothing, one every frame is not.
    const hour = this.game.hourOfDay();
    const sun = sunAt(hour);
    this.sunNow = sun;
    const sunStep = Math.floor((hour / 24) * SUN_STEPS);
    /*
     * The colours are worked out again a frame's worth of time at a time
     * (`SUN_REPAINT_MS`), the last step's laid where they are not yet: a whole
     * screen of them at once was a frame of up to a tenth of a second every
     * step. Under a sun that has not moved (the night's) there is nothing to
     * work out. The edges' pictures (`hems`) are not shaded by the sun and stay.
     */
    if (sunStep !== this.lastSun) {
      // Only the step before is near enough to stand in: after a jump of the clock, every colour is worked out at once, as ever.
      const next = this.lastSun >= 0 && (sunStep - this.lastSun + SUN_STEPS) % SUN_STEPS === 1;
      this.lastSun = sunStep;
      const was = this.sunWas;
      if (!was || was[0] !== sun[0] || was[1] !== sun[1] || was[2] !== sun[2]) {
        this.sunWas = sun;
        this.colorsWas = next ? this.colors : null;
        this.colors = new ColourPages(world.w);
        this.trailPaintWas = next ? this.trailPaint : null;
        this.trailPaint = new ColourPages(world.w);
        this.sunEpoch += next ? 1 : 2;
      }
    }
    this.sunRepaintBy = this.colorsWas ? performance.now() + SUN_REPAINT_MS : Infinity;
    this.sunWasUsed = false;
    /*
     * Where a shadow falls, and how long it is. Straight down and invisible at
     * noon; away from the sun and two and a half tiles long when the sun is on
     * the horizon. Worked out once for the frame: the projection is linear, so
     * one world vector gives the screen offset for everything on the island.
     */
    const sunUp = Math.max(0, sun[2]);
    const cast = (1 - sunUp) * 2.4;
    const wx = -sun[0] * cast;
    const wy = -sun[1] * cast;
    const du = cam.rotateX(wx, wy);
    const dv = cam.rotateY(wx, wy);
    this.shadow = {
      dx: (du - dv) * HALF_W * zoom,
      dy: (du + dv) * HALF_H * zoom,
      alpha: 0.45 * (1 - sunUp) * (1 - this.game.darkness()),
    };
    // Grain is only worth drawing once a tile is big enough to hold it, and
    // once few enough tiles are on screen for it to be cheap.
    const grain = zoom >= 1.25;
    // Paving is laid rather than poured, and from close enough you can see
    // every joint in it. Cheaper than grain and worth more, so it starts
    // sooner.
    // The squeezed pictures (`atSize`) and the trees' (`drawTree`) are no longer emptied when the zoom changes: each knows the zoom it was made at.
    const paved = zoom >= 0.75;
    /*
     * A seam is shapes in the stone, and below this a band of it is a few
     * pixels wide: the wash of the metal through the tile's own colour is what
     * says there is ore in that hillside from further out than this.
     *
     * It is also where the ground pass is dearest. Every band is pixels filled
     * two or three times over, and a hillside that is ore the whole way across
     * -- which takes some doing, but a miner can make one -- costs twenty-odd
     * milliseconds a frame at zoom one against one and a half for the rich
     * hillside that actually occurs. Below here it costs nothing at all.
     */
    const seamed = zoom >= SEAM_FROM;
    // Grass is flat colour with things growing in it, and a clump of grass
    // painted at a quarter of a tile to the screen is three pixels of green
    // on green. Below this the field says what it has to say with its colour.
    const grassy = zoom >= MEADOW_FROM;
    // The join between two grounds carries further than the things growing in
    // either of them: see `RUFFLE_FROM`.
    const hemmed = zoom >= RUFFLE_FROM;
    // Close enough to be picking things up rather than looking at the country.
    const player = this.game.player;
    // (lain where you fell, you are drawn there: `../game/fell.ts`)
    const fellAt = this.game.lying();
    const playerDepth = fellAt ? depthOf(V, Math.floor(fellAt.x), Math.floor(fellAt.y)) : depthOf(V, player.tileX, player.tileY);
    this.spiralSeen = null;
    // Everybody at the helm of a hull somebody else is steering, or aboard one, is drawn with her; see `takeAboard`.
    this.seated.clear();
    for (const f of this.game.furniture.values()) {
      if (f.helm) this.seated.add(f.helm);
      for (const r of f.riders ?? []) this.seated.add(r.who);
    }
    // And everybody up on a wildermon, who is drawn on its saddle with it (`peerOnMount`): on one only, and not as well as at
    // a wagon's reins. Reported: "I appear double to other players": up on a mount and at the reins at once, drawn in both.
    this.saddled.clear();
    for (const c of this.game.creatures.list.values()) {
      if (!c.riderUid || c.ridden || this.seated.has(c.riderUid) || !this.riderOf(c)) continue;
      this.seated.add(c.riderUid);
      this.saddled.add(c.id);
    }
    // A hull with a deck of her own whose helm I have: I am drawn among her crew, by `takeAboard`, rather than on my own.
    const mine = this.game.driving();
    this.helming = mine && crewOf(mine.kind) ? mine : null;
    const hw = stepW * zoom;
    const hh = stepH * zoom;
    const hs = HEIGHT_SCALE * zoom;
    /*
     * Where a tree drawn as a solid stands on its tile: everything else
     * standing up is put down where the lattice has the tile, which at the
     * diagonal turns is a corner of it, and the next line's ground cut its
     * root flare off flat. A solid tree stands in the middle of its tile.
     */
    const solidX = V.staggered ? 0 : hw / 2, solidY = V.staggered ? 0 : -hh / 2;
    // Where the first of the wash's columns is across the screen, for a wall to find its own by (`liftWall`).
    this.washX0 = (eMin - 1) * hw - cam.cx * zoom + W / 2;
    this.washHw = hw;
    // The tile's screen outline and the world corners it hangs on. Both are
    // fixed for the whole frame: the shape of a tile does not change across
    // the island, only where it sits and how far its corners are lifted.
    const off = this.shapeBuf;
    for (let i = 0; i < 4; i++) {
      off[i * 2] = V.shape[i][0] * hw;
      off[i * 2 + 1] = V.shape[i][1] * hh;
    }
    const co = V.corners;
    /*
     * Which of the four screen corners holds the tile's own (0, 0). The view
     * lists them clockwise from whichever is topmost on screen, and that is a
     * different one of the four at each quarter turn; anything hung off the
     * world's axes rather than the screen's needs to know which.
     */
    const paveRot = co.findIndex((cc) => cc[0] === 0 && cc[1] === 0);
    // And which of the tile's screen corners is each of its world corners, for
    // anything laid on in the tile's own square: (0,0), (1,0), (1,1), (0,1).
    const cornerAt = this.cornerAt;
    for (let k = 0; k < 4; k++) {
      const [cu, cv] = k === 0 ? [0, 0] : k === 1 ? [1, 0] : k === 2 ? [1, 1] : [0, 1];
      cornerAt[k] = co.findIndex((cc) => cc[0] === cu && cc[1] === cv) * 2;
    }
    const bottomMargin = 220 * zoom;
    const pts = this.pts;
    const c = this.cornerBuf;
    this.creatureHits.length = 0;
    this.threats.length = 0;
    this.names.begin(this.game.settings.uiSize);
    this.peerHits.length = 0;
    this.crateHits.length = 0;
    this.fireHits.length = 0;
    this.smelterHits.length = 0;
    this.kilnHits.length = 0;
    this.furnitureHits.length = 0;
    this.hitSeq = 0;
    this.glows.length = 0;
    this.swirlsSeen.length = 0;
    // After dark; and for an altar's stars, whenever the night layer is laid at all (`drawOverlays`), so it can be mixed small.
    const dark0 = this.game.darkness();
    this.runeNight.begin(dark0 > 0.02, skyWash(this.game.hourOfDay(), dark0).length > 0);
    this.anvilHits.length = 0;
    this.stoneHits.length = 0;
    this.postHits.length = 0;
    this.trapHits.length = 0;
    this.deckHits.length = 0;
    // Where the aqueducts are this frame and how their water stands, once, if there are any bridges at all.
    if (this.game.bridges.size) {
      const springs = this.game.springs;
      this.aqueducts.frame({
        cam, world, t: this.anim, now: Date.now(), dark: this.game.darkness(), sunUp: Math.max(0, sun[2]),
        fv: fallView(cam, this.anim, W, H, HEIGHT_SCALE * zoom),
        flowing: (id) => springs.flowingSince(id),
        surface: (x, y) => world.water?.levelAt(x, y) ?? null,
        slab: (x, y) => this.game.slabAt(x, y)?.top ?? null,
        bare: (x, y) => {
          const sl = this.game.foundations.size ? this.game.slabAt(x, y) : undefined;
          return sl && !sl.pool ? sl.top : null;
        },
        pours: (id) => {
          for (const sp of springs.list.values()) {
            const st = sp.chain.streams.find((t) => t.via === id);
            if (st) return st.path.length >= 2 ? [st.path[0], st.path[1]] : null;
          }
          return null;
        },
        foam: world.water ? this.springWater.foam : null,
        mist: (placed) => this.springWater.mistOf(placed),
        moss: (b, x, y, shade) => Math.round(greenShows(bridgeGreen(this.game, b, this.greenAt) ?? 0, shade, this.walls.wetness(x, y)) * PAVE_STAGES),
        fountain: (x, y) => {
          const fu = this.game.furnitureOnTile(x, y).find((p) => p.kind === 'fountain');
          if (!fu) return null;
          const [fx, fy] = furnitureCentre(fu);
          return { x: fx, y: fy, base: this.pieceBase(fu, fx, fy) };
        },
      }, this.game.bridges.values(), world.w);
    }
    this.drawnTiles = 0;
    // The water springs have made, if any: where each pond stands this frame, how far each stream has run, and which line of the ground each piece goes after.
    const water = world.water;
    // Their outline, and the sea's, only matters to a wake, so it is gathered only while something is leaving one.
    const waked = this.wakes.live(this.anim).length > 0;
    this.pondPath = water && waked ? new Path2D() : null;
    this.seaPath = waked ? new Path2D() : null;
    this.tint.begin(cam, this.frameNo, HEIGHT_SCALE);
    // Water that has turned from the sea's to still or back since the last frame: its shore is worked out again.
    for (const b of this.seaReach.settle()) {
      this.shoreField.touchBox(b[0], b[1], b[2], b[3]);
      this.reachMoved.push(b);
    }
    this.shore.begin({ cam, t: this.anim, dirX: this.surf.dirX, dirY: this.surf.dirY });
    // The sea, under everything (`drawSea`).
    this.seaUnder = this.waters.drawSea(ctx, zoom);
    if (water) {
      this.springWater.frame({
        world, cam, view: V, now: Date.now(), t: this.anim, width: W, height: H, dLo, dHi,
        lean: this.lean, sun, dark: this.game.darkness(), wellAt: this.wellAt,
        slab: this.game.foundations.size ? this.slabOver : undefined,
        decked: this.game.buildings.pierTiles.size ? this.pierOver : undefined,
        ...(this.game.bridges.size ? { under: (wx: number, wy: number) => this.aqueducts.under(wx, wy, V), underKey: this.aqueducts.underKey } : {}),
      }, water);
    }
    // The day of the year the trees are dressed for, and what is out in it.
    // When their look turns (`lookStep`), the last look's sprites go, and every copy made of them; the tree pictures stand in while the new look's are made (`treePicture`), and go as they are let go.
    const year = yearAt(this.game.wallNow());
    if (year.season !== this.year.season || lookStep(year.day) !== lookStep(this.year.day)) {
      forgetTrees();
      this.scaled.clear();
      this.forgetAllScaled();
    }
    this.year = year;
    if (!this.fast) this.life.frame({
      world, cam, view: V, dLo, dHi, eMin, eMax, width: W, height: H,
      // The island's clock where there is one, so every player sees the same butterfly in the same place; held while animations are off.
      clock: this.held && this.lifeClock ? this.lifeClock : (this.lifeClock = this.game.islandClock ? this.game.islandClock() : this.game.time),
      hour: hour0, dark: this.game.darkness(), season: this.year.season, day: this.year.day,
      windX: this.surf.dirX, windY: this.surf.dirY, force: this.surf.force,
      visible: this.lifeVisible, covered: this.lifeCovered, indoors: this.lifeIndoors, pieces: this.lifePieces,
    }, zoom);

    // The trees drawn as solids: what they are baked for this frame, and the shade they throw.
    this.solidFrame(ctx, zoom, W, H, V, stepW, stepH, dLo, dHi);
    // The ground laid from pictures of it a block at a time where it can be (`GroundChunks`).
    this.gf = this.groundFrame(V, zoom, W, H, drawnAt, grid, paveRot, grassy, hemmed, paved, seamed, water, sun, voidInk);
    this.feet.length = 0;
    for (let d = dLo; d <= dHi; d++) {
      // A building on piers in the water stands in front of all the water drawn before its line, swell and wakes and all.
      if (this.wetPierLines?.has(d)) this.waters.layWater(ctx, zoom);
      this.lineNow = d;
      // What stood on a line well behind this one reaches no further.
      if (this.feet.length && this.feet[0].d < d - FOOT_LINES) this.feet = this.feet.filter((f) => f.d >= d - FOOT_LINES);
      this.ents.length = 0;
      this.entN = 0;
      // Whether a runestone drawn on a line before this one is lit for the night, so this line's ground is kept off it.
      const stoneLit = this.runeNight.keeping;
      // The ground is laid under one transform: read once a line, not once a tile (`occludeGround`).
      if (stoneLit) this.groundMatrix = ctx.getTransform();
      // Which of this line's tiles are laid from a block's picture (`chunkLine`): none where a runestone is keeping the ground off it.
      const lineRuns = this.gf !== null && this.chunkLine(d, eMin, eMax) && !stoneLit;
      if (grain) {
        this.grainN = 0;
        this.grainM = 0;
      }
      for (let k = 0; k < this.flowerSpeckN.length; k++) this.flowerSpeckN[k] = 0;
      const baseY = (d * stepH - cam.cy) * zoom + H / 2;
      let e = eMin;
      if (V.staggered && ((e + d) & 1) !== 0) e++;
      for (; e <= eMax; e += eStep) {
        const x = V.x[0] + V.x[1] * d + V.x[2] * e;
        const y = V.y[0] + V.y[1] * d + V.y[2] * e;
        if (x < 0 || y < 0 || x >= world.w || y >= world.h) continue;
        c[0] = world.getHeight(x + co[0][0], y + co[0][1]);
        c[1] = world.getHeight(x + co[1][0], y + co[1][1]);
        c[2] = world.getHeight(x + co[2][0], y + co[2][1]);
        c[3] = world.getHeight(x + co[3][0], y + co[3][1]);
        const baseX = (e * stepW - cam.cx) * zoom + W / 2;
        pts[0] = baseX + off[0];
        pts[1] = baseY + off[1] - c[0] * hs;
        pts[2] = baseX + off[2];
        pts[3] = baseY + off[3] - c[1] * hs;
        pts[4] = baseX + off[4];
        pts[5] = baseY + off[5] - c[2] * hs;
        pts[6] = baseX + off[6];
        pts[7] = baseY + off[7] - c[3] * hs;
        const minY = Math.min(pts[1], pts[3], pts[5], pts[7]);
        const maxY = Math.max(pts[1], pts[3], pts[5], pts[7]);
        if (maxY < 0 || minY > H + bottomMargin) continue;
        this.drawnTiles++;

        // Three states: land nobody has seen is not drawn at all, land in sight
        // is drawn as it is, and land only remembered is drawn as it was.
        const fog = vision.state(x, y);
        // Its ground laid already, with the rest of its run, from its block's picture; or the run laid now, at its first tile.
        let run = lineRuns ? this.chunkRun(e) : null;
        if (run && run.laid !== this.frameNo && !this.layRun(ctx, run, drawnAt, Math.floor(d / this.chunks.lines), Math.floor(e / this.chunks.across))) run = null;
        if (this.gf) this.chunkSeen(ctx, d, e, run);
        if (fog === UNSEEN) {
          // Still lay the shape down, flat and empty. A hill drawn behind a
          // hole in the map would otherwise hang its face out over the dark.
          if (!run) {
            ctx.beginPath();
            ctx.moveTo(pts[0], pts[1]);
            ctx.lineTo(pts[2], pts[3]);
            ctx.lineTo(pts[4], pts[5]);
            ctx.lineTo(pts[6], pts[7]);
            ctx.closePath();
            ctx.fillStyle = voidInk;
            ctx.fill();
          }
          if (stoneLit) this.occludeGround(ctx, pts, minY, maxY);
          continue;
        }
        const lit = fog === VISIBLE;
        // With the sea laid under it all, a tile of sea draws none of its own ground, and one the shore crosses only what is above the water.
        const seaFloor = this.seaUnder && (c[0] < 0 || c[1] < 0 || c[2] < 0 || c[3] < 0);
        const color = run || (seaFloor && c[0] < 0 && c[1] < 0 && c[2] < 0 && c[3] < 0) ? '' : this.groundColor(x, y, lit, sun);
        if (!run) ctx.beginPath();
        /*
         * Without the grid, a tile's edge is stroked in its own colour, to
         * close the hairline the smoothing leaves between two tiles; the same
         * is a tile half a pixel bigger all round, in one fill rather than a
         * fill and a stroke (`outsetTile`), and a far view is six thousand
         * tiles. One folded over on a cliff is outlined and stroked as before.
         */
        const outset = !!run || seaFloor || (!grid && this.outsetTile(ctx, pts));
        if (!outset) {
          ctx.moveTo(pts[0], pts[1]);
          ctx.lineTo(pts[2], pts[3]);
          ctx.lineTo(pts[4], pts[5]);
          ctx.lineTo(pts[6], pts[7]);
          ctx.closePath();
        }
        /*
         * A path worn down into the sea: over the sea laid under it, as much as
         * the water over it lets show, and then whole again on the ground above
         * the water, cut to it (`seaLand`).
         */
        const seaTrail = seaFloor && !run ? this.trailMaskAt(x, y, lit) : 0;
        if (seaTrail) {
          ctx.globalAlpha = 1 - waterVeil(Math.max(0, -(c[0] + c[1] + c[2] + c[3]) / 4));
          this.drawTrail(ctx, x, y, seaTrail, pts, lit, zoom);
          ctx.globalAlpha = 1;
        }
        if (seaFloor) {
          if (this.waters.seaLand(ctx, V, x, y, c, color) && seaTrail) {
            ctx.save();
            ctx.clip();
            this.drawTrail(ctx, x, y, seaTrail, pts, lit, zoom);
            ctx.restore();
          }
        } else if (!run) {
          ctx.fillStyle = color;
          ctx.fill();
        }
        if (stoneLit) this.occludeGround(ctx, pts, minY, maxY);
        // Remembered ground's wash comes this far down the screen; ground in sight that comes up past it takes it off what it covers.
        this.wallLift = null;
        // A column in sight takes it off as well, whichever tile round its corner puts it up (`liftColumn`).
        this.columnLift = columned ? liftPath : null;
        if (!lit) {
          if (fogged) {
            lineAny = true;
            this.reach(this.washFloor, e + washAt, pts);
          }
        } else if (washed) {
          // Its ground, and the floor raised on it where there is one.
          const top = raising ? this.raisedTop(x, y) : null;
          if (this.over(this.washFloor, e + washAt, pts, c, top, hs)) {
            this.tileColumn(liftPath, pts, c, top, hs);
            this.reach(this.liftFloor, e + washAt, pts);
            this.lifted = true;
          }
          // And the walls it stands, each as it is drawn (`liftWall`).
          if (walled) this.wallLift = liftPath;
        }
        // Under the sea where a corner is below nothing, and under a pond where its water has risen over a corner of the tile.
        const sea = c[0] < 0 || c[1] < 0 || c[2] < 0 || c[3] < 0;
        const pond = water !== null && water.wet(x, y) && this.waters.pondsOn(water, x, y, c, co);
        const wet = sea || pond;
        /*
         * What is on this tile, and what ground it counts as. For a tile of
         * forest those are two different answers: the first is a tree, the
         * second is the field it stands in (see `groundAt`). Everything about
         * the ground asks the second -- whether it is flat, whether it strews,
         * whether it is paved -- because a wood painted as meadow and then
         * given a wood's grain and a wood's tufts is a meadow with a rash on
         * it in the shape of the trees. The sprite is the only thing that
         * wants the first, and it is the whole of what a wooded tile is.
         */
        const here = world.viewTile(x, y, lit) as TileType;
        const t0 = this.groundAt(x, y, lit);
        // Stepping stones go down after the line's water, over it; remembered ones too, as paving is.
        if (here === TileType.SteppingStones) (lit ? this.stoneRow : this.stoneRowDim).push(x, y);
        if (!outset) {
          ctx.strokeStyle = grid && !wet ? GRID_COLOR : color;
          ctx.stroke();
        }
        // How wide that edge went down, which a deck's shade on this tile has to come back over (`piers.ts`).
        this.groundEdge = ctx.lineWidth;
        // Weed on the bottom goes under the water rather than over it.
        if (!run && grassy && wet && DROWNS.has(here)) {
          // Seen through the water over it, laid under this one (`drawSea`): as much of it as the water lets show.
          if (seaFloor) ctx.globalAlpha = WEED_SEEN + (1 - WEED_SEEN) * (1 - waterVeil(Math.max(0, -(c[0] + c[1] + c[2] + c[3]) / 4)));
          this.strewTile(here, x, y, pts, paveRot, zoom, lit);
          ctx.globalAlpha = 1;
        }
        // The sea's outline, for a wake and remembered ground's wash; and its shore's wet band and the land's side of its foam (`shore.ts`).
        // A remembered tile all under the sea has its wash in the sea's picture already (`seaStill`).
        const seaWashed = this.seaUnder && c[0] < 0 && c[1] < 0 && c[2] < 0 && c[3] < 0 && world.hasSea(x, y);
        if (sea) this.waters.drawWater(V, x, y, c, fogged && !lit && !seaWashed ? lineFog : undefined);
        if ((sea || (c[0] < SHORE_HIGH && c[1] < SHORE_HIGH && c[2] < SHORE_HIGH && c[3] < SHORE_HIGH)) && !this.fast) this.waters.seaShore(V, x, y, c, !run, lit);
        if (pond) {
          this.waters.pondBanks(V, x, y, c, lit);
          // A path worn down into a pond: on its bed, under its water, as much as the water lets show.
          if (!seaFloor && !run) {
            const tm = this.trailMaskAt(x, y, lit);
            if (tm) this.drawTrail(ctx, x, y, tm, pts, lit, zoom);
          }
          this.waters.drawPonds(V, x, y, c, lit, fogged && !lit ? lineFog : undefined);
        }
        // The water lapping round the feet of piers this tile is in front of, now its water is down (`piers.ts`).
        if (wet && this.game.buildings.pierTiles.size && this.game.buildings.onPiers(x, y)) this.pierFeetHere(x, y, V);
        if (this.pierFeet.size) {
          const feet = this.pierFeet.get(`${x},${y}`);
          if (feet) {
            this.shore.flush(ctx);
            drawPierFeet(ctx, cam, feet, this.anim);
            this.pierFeet.delete(`${x},${y}`);
          }
        }

        // A flat ground gets no speckles. A sward is a flat ground with clumps
        // growing in it, and the speckles are what it had instead of clumps:
        // both at once is mud.
        if (grain && !wet && !FLAT.has(t0)) this.addGrain(x, y, pts, zoom);
        /*
         * And what grows on it. Everything on the ground stops at the
         * waterline except the reeds, which wade: see `WADES`. They are laid
         * after the water is, so they stand up out of it.
         *
         * Weed is the other way about -- it is laid before the water, up with
         * `drawWater` above, because it grows on the bottom. And it is asked
         * for by what the tile *is* rather than by what it counts as: a kelp
         * tile counts as the sand it grows out of, and sand-coloured weed is
         * no weed at all.
         */
        const wades = wet && WADES.has(t0) && (c[0] + c[1] + c[2] + c[3]) / 4 > (pond ? Math.max(0, this.pondTop) : 0) - WADE_DEPTH;
        if (!run && grassy && (!wet || wades) && STREWN.has(t0) && here !== TileType.Trail) this.strewTile(t0, x, y, pts, paveRot, zoom, lit);
        // And the wildflowers in it, in their season: see `drawFlowers`.
        if (lit && !wet && here === TileType.Grass) this.drawFlowers(ctx, x, y, pts, zoom);
        /*
         * And where something greener grows beside this, it comes over the
         * edge of it. Paving is left out: a flagstone or a cobble was laid to
         * a line and keeps to it.
         *
         * Most ground has the same ground all round it, and finding that out
         * costs four tile reads and four bounds checks per tile per frame.
         * The answer goes stale exactly when the colour does, so it is kept
         * beside the colour: one means there was nothing growing over this
         * tile and it can be passed over, two means there was.
         */
        if (!run && hemmed && !wet && !PAVED.has(t0) && t0 !== TileType.Steps) {
          const seams = lit ? this.colors : this.memColors;
          const known = seams.flag(x, y);
          if (known !== 1) {
            const drew = this.hems(ctx, V, x, y, pts, zoom, lit);
            if (known === 0) seams.setFlag(x, y, drew ? 2 : 1);
          }
        }
        /*
         * And a path worn across it: the path itself on a trail, or the wedge
         * of one that crosses a corner of this tile on the diagonal. Asked of
         * every tile, off a mask kept beside the colour. Under water it went
         * down already, before the water (`seaTrail`, and before `drawPonds`).
         */
        if (!wet && !run) {
          const tm = this.trailMaskAt(x, y, lit);
          if (tm) this.drawTrail(ctx, x, y, tm, pts, lit, zoom);
        }
        // And a face of steep ground dressed as the rock in the pictures is: see `dressFace`.
        if (lit && !run) this.dressFace(ctx, x, y, pts, zoom, sea, pond);
        if (paved && !wet && !run && PAVED.has(t0)) this.paving(t0, x, y, world.viewData(x, y, lit), pts, paveRot, lit);
        // A flight of garden steps, built up the tile over its colour: see `steps.ts`.
        if (!wet && t0 === TileType.Steps) {
          drawSteps({ ctx, cam, world, zoom, season: this.season, light: this.stepsLight, dpr: this.canvas.dpr }, x, y);
        }
        // And the metal in the stone, where there is any. Plain rock is plain.
        // It keeps to its own tile without a clip: see `seams/paint.ts`.
        if (seamed && !wet && !run && t0 === TileType.Rock) {
          const kind = world.rockFace(x, y);
          if (kind > 0) seam(ctx, x, y, kind, pts, paveRot, zoom, this.canvas.dpr);
        }

        // What stands on a line behind and reaches out over this tile's ground: drawn again over the part of it under its feet.
        if (this.feet.length) this.footOver(ctx, d, pts, minY, maxY);

        const t = here;
        // A building over a cellar you are looking into is taken off, and everything in it with it.
        const cutHere = this.cut.size > 0 && this.cut.has(this.game.buildings.buildingAt(x, y)?.id ?? -1);
        // Pinned on a storey over the ground, what stands on the ground is hidden with the ground floor (`storeyview.ts`).
        const aloft = this.pinned !== null && this.pinned > 0;
        if (!lit) {
          // Remembered ground keeps its shape and its trees and nothing else:
          // no creatures, no piles, no detail, and a cold wash over the lot.
          // A Runestone stands in memory as it stands in sight: it is the landmark, and is drawn from its front tile.
          const stoneMem = world.solid !== null && world.solid.has(y * world.w + x) ? runestoneAt(x, y, world.w) : null;
          if (stoneMem && !aloft) this.takeStone(stoneMem, x, y, V);
          if (!stoneMem && (t === TileType.Tree || t === TileType.Bush || t === TileType.Stump)) {
            const data = world.viewData(x, y, false);
            const spr = t === TileType.Tree ? treeSprite(treeSpecies(data), treeVariant(data), this.year.season, this.year.day, this.treeAt(treeSpecies(data), x, y)) : t === TileType.Bush ? bushSprite(bushSpecies(data), this.year.season, this.year.day, this.bushAt(bushSpecies(data), x, y)) : stumpSprite(treeSpecies(data), this.year.season, this.year.day, this.stumpAt(treeSpecies(data), x, y));
            const avg = (c[0] + c[1] + c[2] + c[3]) / 4;
            this.take(t === TileType.Tree ? 'tree' : t === TileType.Bush ? 'bush' : 'stump', x, y, baseX + (spr.solid ? solidX : 0), baseY + hh - avg * hs + (spr.solid ? solidY : 0), spr);
          }
          if (this.structs.nearAny(x, y)) this.drawStructures(x, y, V, d > playerDepth);
          if (!aloft && this.hingeTiles.has(x * 65536 + y)) this.walls.drawGateAt(x, y, V);
          const top = raising ? this.raisedTop(x, y) : null;
          this.tileColumn(lineFog, pts, c, top, hs);
          // Come down over something waiting to take the wash off, which stands behind it, its wash and its water's: that goes first.
          if (this.lifted && !lineOver && this.over(this.liftFloor, e + washAt, pts, c, wet ? Math.max(top ?? -Infinity, pond ? this.pondTop : 0) : top, hs)) lineOver = true;
          continue;
        }
        // A Runestone's nine tiles: the stone is taken on its front one, and nothing that grows there is drawn under it.
        const stone = world.solid !== null && world.solid.has(y * world.w + x) ? runestoneAt(x, y, world.w) : null;
        if (stone && !aloft) this.takeStone(stone, x, y, V);
        // A stump with felled logs on its tile drawn as solids is drawn with them, in their picture (`log3dSprite`).
        const logged = t === TileType.Stump && !cutHere && !aloft && this.game.ground.size > 0 && this.game.groundAt(x, y).length > 0
          && !this.still && lyingSprite(this.game.groundAt(x, y), x, y, this.solidAt(x, y), this.year.season, true).solid === true;
        if (!stone && !logged && (t === TileType.Tree || t === TileType.Bush || t === TileType.Stump)) {
          const data = world.getData(x, y);
          const spr = t === TileType.Tree ? treeSprite(treeSpecies(data), treeVariant(data), this.year.season, this.year.day, this.treeAt(treeSpecies(data), x, y)) : t === TileType.Bush ? bushSprite(bushSpecies(data), this.year.season, this.year.day, this.bushAt(bushSpecies(data), x, y)) : stumpSprite(treeSpecies(data), this.year.season, this.year.day, this.stumpAt(treeSpecies(data), x, y));
          const avg = (c[0] + c[1] + c[2] + c[3]) / 4;
          this.take(t === TileType.Tree ? 'tree' : t === TileType.Bush ? 'bush' : 'stump', x, y, baseX + (spr.solid ? solidX : 0), baseY + hh - avg * hs + (spr.solid ? solidY : 0), spr);
        }
        if (!cutHere && !aloft && this.game.ground.size && this.game.groundAt(x, y).length) {
          const avg = (this.game.buildings.pierTiles.size ? this.game.pierDeckAt(x, y) : null) ?? (c[0] + c[1] + c[2] + c[3]) / 4;
          const lying = lyingSprite(this.game.groundAt(x, y), x, y, this.logsAt(x, y), this.year.season, t === TileType.Stump);
          const pile = this.take('pile', x, y, baseX + (lying.solid ? solidX : 0), baseY + hh - avg * hs + (lying.solid ? solidY : 0), lying);
          // A heap shines for the best thing in it: one fantastic hatchet under
          // a hundred rocks is still a fantastic hatchet lying in the grass.
          let best = 0;
          for (const it of this.game.groundAt(x, y)) if ((it.rare ?? 0) > best) best = it.rare ?? 0;
          if (best) pile.rare = best;
        }
        const deed = aloft ? undefined : this.game.tokenAt(x, y);
        if (deed) {
          // A settlement's token, ours or a neighbour's, as tall as the settlement's level has built it (`deedtotem.ts`).
          const avg = (c[0] + c[1] + c[2] + c[3]) / 4;
          this.take('token', x, y, baseX, baseY + hh - avg * hs, null).totem = { level: deedLevel(deed), variant: deedTotemVariant(x, y) };
        }
        // A water plant: what lies on the water goes down after the line's water; a lotus's stalks stand up among everything else.
        if (this.plantFrame) {
          const plant = this.game.waterPlantAt(x, y);
          if (plant) {
            this.plantRow.push(plant);
            if (standsUp(plant, this.plantFrame.now)) {
              const [px, py] = plantFoot(plant, this.plantFrame);
              this.take('waterplant', x, y, px, py, null).plant = plant;
            }
          }
        }
        // A mote swirl turning over the middle of the tile: over the water's surface where there is water (`./swirls`).
        if (this.game.swirls.size) {
          const swirl = this.game.swirlAt(x, y);
          if (swirl) {
            const avg = (c[0] + c[1] + c[2] + c[3]) / 4;
            const h = world.hasWater(x, y) ? Math.max(avg, world.surfaceAt(x, y)) : avg;
            this.take('swirl', x, y, cam.worldToScreenX(x + 0.5, y + 0.5), cam.worldToScreenY(x + 0.5, y + 0.5, h), null).swirl = swirl;
          }
        }
        // A crop on a garden bed, on whatever storey the bed is: at the bed's soil, as a field's crop stands on its ground.
        const bedCrop = this.game.crops.size && !cutHere ? this.game.cropAt(x, y) : undefined;
        if (bedCrop && bedCrop.level !== undefined) this.takeBedCrop(bedCrop, x, y, cam.rotation);
        if (t === TileType.Field && !aloft) {
          const fieldCrop = this.game.crops.size ? this.game.cropAt(x, y) : undefined;
          // Only the field's own: one on a bed over it is drawn up there.
          const crop = fieldCrop && fieldCrop.level === undefined ? fieldCrop : undefined;
          const avg = (c[0] + c[1] + c[2] + c[3]) / 4;
          const [mx, my] = V.staggered ? [baseX, baseY + hh] : [baseX + hw / 2, baseY + hh / 2];
          if (crop && this.still) {
            // The low-end graphics: drawn flat (`cropFlatSprite`), and a field lying fallow is its ground alone.
            const def = cropDef(crop.id);
            this.take('crop', x, y, mx, my - avg * hs,
              cropFlatSprite(crop.id, Math.min(3, crop.stage), def.look, def.colors[0], def.colors[1], this.dormant && !crop.glass, crop.tendedNow, !V.staggered));
          } else if (crop) {
            const def = cropDef(crop.id);
            /*
             * A field waits out a winter; what grows under glass does not
             * (`glasshouse.ts`). Stood at the tile's middle: the top corner and
             * a tile's height down on a diamond, and half across and half down
             * a rectangle -- where it used to stand on the rectangle's corner,
             * and a glasshouse's crops stood half out through its walls.
             */
            this.take('crop', x, y, mx, my - avg * hs,
              cropSprite(crop.id, Math.min(3, crop.stage), def.colors[0], def.colors[1], this.dormant && !crop.glass, crop.tendedNow, cam.rotation, this.cropStep,
                Math.floor(hash2(x, y, 6151) * FIELD_LAYOUTS))).tilt = this.fieldTilt(c, off, mx - baseX, my - baseY, avg, hs);
          } else if (!this.still) {
            // A field tilled and lying fallow: its ridges and furrows, rimed in a winter out of glass. Ground, so first on its line, under whoever stands on it.
            const rimed = this.dormant && !isGlasshouse(this.game.buildings, this.game.buildings.buildingAt(x, y));
            const bare = this.take('crop', x, y, mx, my - avg * hs, cropSprite('', -1, '', '', rimed, false, cam.rotation, this.cropStep));
            bare.key = -1e9;
            bare.tilt = this.fieldTilt(c, off, mx - baseX, my - baseY, avg, hs);
          }
        }
        /*
         * A bridge is not put down on a tile, it spans one, so it is asked
         * for on its own rather than through the count below.
         */
        if (this.game.bridges.size) {
          const found = this.game.bridgeAt(x, y);
          // Pinned on a storey, a bridge with an end on it; an aqueduct runs on the ground.
          const bridge = found && (this.pinned === null || bridgeLevels(found).includes(this.pinned)) ? found : undefined;
          // An aqueduct's bay is two pieces, its insides behind whoever stands under it and its face in front (`./aqueducts`).
          if (bridge?.kind === 'aqueduct') {
            const k = bridge.spans.findIndex((sp) => sp.x === x && sp.y === y);
            for (const part of ['back', 'front'] as const) {
              const [px, py] = this.aqueducts.sortPoint(bridge, x, y, part);
              this.take('deck', x, y, px, py, null).aq = { b: bridge, k, part };
            }
          }
          // And the fall at its foot goes with the tile it pours into, and the cut its water comes in by with the tile it draws from.
          for (const b of aloft ? [] : this.aqueducts.footAt(x, y) ?? []) {
            const [px, py] = this.aqueducts.sortPoint(b, x, y, 'spout');
            this.take('deck', x, y, px, py, null).aq = { b, k: b.spans.length - 1, part: 'spout' };
          }
          for (const b of aloft ? [] : this.aqueducts.headAt(x, y) ?? []) {
            const [px, py] = this.aqueducts.sortPoint(b, x, y, 'intake');
            this.take('deck', x, y, px, py, null).aq = { b, k: 0, part: 'intake' };
          }
          // And water poured onto a foundation at the foot going over its edge, with the tile it falls into.
          for (const { b } of aloft ? [] : this.aqueducts.offAt(x, y) ?? []) {
            const [px, py] = this.aqueducts.sortPoint(b, x, y, 'off');
            this.take('deck', x, y, px, py, null).aq = { b, k: b.spans.length - 1, part: 'off' };
          }
          // A drawbridge lying on the far bank is laid a span at a time; anything else of it is drawn at its hinge (`drawGateAt`).
          if (bridge && isDrawbridge(bridge)) {
            const i = bridge.spans.findIndex((sp) => sp.x === x && sp.y === y);
            if (i >= 0 && this.walls.drawbridgeUp(bridge) === 0) {
              const wx = x + 0.5, wy = y + 0.5;
              this.take('deck', x, y, cam.worldToScreenX(wx, wy), cam.worldToScreenY(wx, wy, bridge.height), null).deck =
                { kind: 'draw', done: Object.values(bridge.spans[i].needed).every((n) => n <= 0), drop: 0, id: bridge.id, span: i };
            }
          } else if (bridge && kitBridge(bridge)) {
            // A material bridge in its pieces, each sorted round whoever is under or on the deck (`bridgekit.ts`).
            for (const p of piecesAt(bridge, x, y, this.bridgeFrame())) {
              const be = this.take('deck', x, y, p.sx, p.sy, null);
              be.bp = p;
              be.key = p.key;
            }
          } else if (bridge && bridge.kind !== 'aqueduct') {
            const span = bridge.spans.find((sp) => sp.x === x && sp.y === y);
            const wx = x + 0.5;
            const wy = y + 0.5;
            // On a ramp the deck is at its own height at every point along it, up its slope (`deckHeight`).
            const mid = deckHeight(bridge, wx, wy);
            const dx = cam.worldToScreenX(wx, wy), dy = cam.worldToScreenY(wx, wy, mid);
            // The tile it spans, corner by corner at the deck's height there, so it is that tile at every turn of the view.
            const q = ([[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]] as Array<[number, number]>)
              .map(([a, b]): [number, number] => [(cam.worldToScreenX(a, b) - dx) / zoom, (cam.worldToScreenY(a, b, deckHeight(bridge, a, b)) - dy) / zoom]);
            const re = this.take('deck', x, y, dx, dy, null);
            // In front of anybody under it, behind anybody on it (`ropeKey`).
            re.key = ropeKey(this.bridgeFrame(), x, y);
            re.deck =
              { kind: bridge.kind, done: !!span && Object.values(span.needed).every((n) => n <= 0), drop: mid - world.centerHeight(x, y), id: bridge.id,
                shape: { q, along: bridge.ay === bridge.by ? 'x' : 'y' },
                // How far the moss on a stone arch has got (`greening.ts`): over water, always by it.
                green: greenShows(bridgeGreen(this.game, bridge, this.greenAt) ?? 0, 0, this.walls.wetness(x, y)) };
          }
        }
        /*
         * Everything put down, asked about only where something was put down.
         *
         * These are eight separate indexes and this used to ask all eight
         * about every tile on screen: eight map lookups per tile, and on all
         * but a handful of tiles all eight answers are nothing. One shared
         * count of what stands where — kept by the indexes themselves, so it
         * cannot fall out of step with them — turns that into a single
         * lookup, and the eight are opened only where there is anything in
         * them.
         */
        if (!cutHere && this.game.anythingPlaced(x, y)) {
          for (const sm of aloft ? [] : this.game.smeltersOnTile(x, y)) {
            const [wx, wy] = smelterCentre(sm);
            const se = this.take('smelter', x, y, cam.worldToScreenX(wx, wy), cam.worldToScreenY(wx, wy, this.standTop(wx, wy)), null);
            se.smelter = sm;
            if (sm.rare) se.rare = sm.rare;
          }
          for (const kl of aloft ? [] : this.game.kilnsOnTile(x, y)) {
            const [wx, wy] = kilnCentre(kl);
            const ke = this.take('kiln', x, y, cam.worldToScreenX(wx, wy), cam.worldToScreenY(wx, wy, this.standTop(wx, wy)), null);
            ke.kiln = kl;
            if (kl.rare) ke.rare = kl.rare;
          }
          for (const fu of this.game.furnitureOnTile(x, y)) {
            // A piece down in a cellar is drawn with the cellar (`drawCellarView`), and not at all from up top.
            if ((fu.level ?? 0) < 0) continue;
            // Pinned on a storey, the pieces on it, and whatever you are aboard or driving.
            if (this.pinned !== null && (fu.level ?? 0) !== this.pinned && player.aboard !== fu.id && this.helming !== fu && !fu.driven) continue;
            // A hull somebody else is steering is where their hands are, which is read a dozen times a second; where
            // she was set down is read once.
            const [wx, wy] = fu.helm ? this.game.hullCentre(fu) : furnitureCentre(fu);
            const fe = this.take('furniture', x, y, cam.worldToScreenX(wx, wy), cam.worldToScreenY(wx, wy, this.pieceBase(fu, wx, wy)), null);
            fe.piece = fu;
            fe.view = this.viewOf(fu);
            if (fu.rare) fe.rare = fu.rare;
            // On a bridge's deck, among its pieces (`deckKey`): a stall on an outer lane, a wagon crossing. Anything else is under it (`pieceOnDeck`).
            if (this.game.bridges.size && this.game.pieceOnDeck(fu, Math.floor(wx), Math.floor(wy))) this.onBridgeDeck(fe, wx, wy);
            if (fu.helm || fu.riders?.length || player.aboard === fu.id || this.helming === fu) this.takeAboard(fu, fe, x, y, zoom);
            // A cart on the move rocks and bumps on the track under her driver, and her driver with her (`cartSwayOf`).
            if (reinsTo(fu.kind)) fe.sway = this.cartSwayOf(fu, fe.sx, fe.sy, zoom);
          }
          for (const an of aloft ? [] : this.game.anvilsOnTile(x, y)) {
            const [wx, wy] = anvilCentre(an);
            const ae = this.take('anvil', x, y, cam.worldToScreenX(wx, wy), cam.worldToScreenY(wx, wy, this.standTop(wx, wy)), null);
            ae.anvil = an;
            if (an.rare) ae.rare = an.rare;
          }
          for (const po of aloft ? [] : this.game.postsOnTile(x, y)) {
            const [wx, wy] = postCentre(po);
            this.take('post', x, y, cam.worldToScreenX(wx, wy), cam.worldToScreenY(wx, wy, this.standTop(wx, wy)), null).post = po;
          }
          for (const tr of aloft ? [] : this.game.trapsOnTile(x, y)) {
            const [wx, wy] = trapCentre(tr);
            this.take('trap', x, y, cam.worldToScreenX(wx, wy), cam.worldToScreenY(wx, wy, this.standTop(wx, wy)), null).trap = tr;
          }
          for (const fire of aloft ? [] : this.game.campfiresOnTile(x, y)) {
            const [wx, wy] = fireCentre(fire);
            this.take('campfire', x, y, cam.worldToScreenX(wx, wy), cam.worldToScreenY(wx, wy, this.standTop(wx, wy)), null).fire = fire;
          }
          for (const crate of this.game.cratesOnTile(x, y)) {
            // A crate standing on a rack is drawn by the rack, up on its deck
            // where it actually is. Drawn here as well it would be a second
            // crate on the floor underneath the first. And one down in a cellar is drawn with the cellar.
            if ((crate.level ?? 0) < 0 || this.game.rackAt(crate.x, crate.y, crate.sx, crate.sy, crate.level)) continue;
            if (this.pinned !== null && (crate.level ?? 0) !== this.pinned) continue;
            const [wx, wy] = crateCentre(crate);
            const ce = this.take('crate', x, y, cam.worldToScreenX(wx, wy), cam.worldToScreenY(wx, wy, this.standTop(wx, wy)), crateSprite(crate.kind));
            ce.crateId = crate.id;
            if (crate.rare) ce.rare = crate.rare;
          }
        }
        // Other people on the island stand on tiles like anything else does.
        if (!cutHere && this.game.roster.size) {
          for (const peer of this.game.roster.atTile(x, y)) {
            // Down in a cellar: drawn with it, from down there, and not from up top.
            if (peer.level < 0 || (peer.uid && this.seated.has(peer.uid))) continue;
            // Pinned on a storey, those standing on it.
            if (this.pinned !== null && peer.level !== this.pinned) continue;
            const [px, py] = this.game.roster.drawnAt(peer);
            // Up a spiral staircase, round its post (`spiralBody`).
            const spiral = this.stairs.spiralBody(px, py, peer.level);
            if (spiral) {
              const pe = this.take('peer', x, y, cam.worldToScreenX(spiral.x, spiral.y), cam.worldToScreenY(spiral.x, spiral.y, spiral.h), null);
              pe.peer = peer;
              pe.key = spiral.key;
              continue;
            }
            const flight = peer.level === 0 ? this.onFlight(px, py) : null;
            // On a ladder, on it as far up as the climb has got (`ladderbody.ts`).
            const lb = peer.down ? null : ladderBody(this.game, px, py, peer.level);
            // Under a bridge's deck, at the ground's height or the water's, rather than on it (`bodyUnder`).
            const under = this.game.bridges.size > 0 && peer.level === 0
              && this.bodyUnder(`p${peer.id}`, Math.floor(px), Math.floor(py), [Math.floor(peer.fromX), Math.floor(peer.fromY)], peer.swimming);
            const onDeck = under ? null : this.peerDeck(px, py, peer.level);
            const pe = lb ? this.take('peer', x, y, cam.worldToScreenX(lb.x, lb.y), cam.worldToScreenY(lb.x, lb.y, lb.h), null)
              : this.take('peer', x, y, cam.worldToScreenX(px, py),
                cam.worldToScreenY(px, py, flight ? flight.h : onDeck
                  ?? (this.game.deckBase(Math.floor(px), Math.floor(py), peer.level) ?? this.footOn(px, py, peer.level)) + peer.level * WALL_HEIGHT), null);
            pe.peer = peer;
            if (lb) pe.ladder = lb;
            if (onDeck !== null) this.onBridgeDeck(pe, px, py);
            if (flight) pe.clip = flight.clip;
          }
        }
        if (!cutHere && this.game.creatures.list.size) {
          // Anything standing on a tile with a bridge's deck or a slab over it stands on that. No
          // creature goes onto a tile on piers (`Creatures.tileOk`), so the ground is all there is.
          const deckHere = this.game.laidOver(x, y);
          for (const cr of this.game.creatures.atTile(x, y)) {
            // One shut in a crate is drawn in the crate, by the crate.
            if (!inWorld(cr)) continue;
            // One in the traces of a wagon a storey up is up there with it (`driveStorey`), a mount ridden up a wide staircase (`rideRule`),
            // and a worker gone up a building's staircases to its work (`creature_way`).
            const up = this.game.creatureStorey(cr);
            // Pinned on a storey, those on it; and the one you ride or drive, under you whatever is pinned.
            if (this.pinned !== null && up !== this.pinned && !cr.ridden && !(cr.hitchedTo !== null && this.game.furniture.get(cr.hitchedTo)?.driven)) continue;
            // Under you, as high as you are drawn, on the way up a flight too; a worker as far up its flight as it is (`creatureLift`).
            const lift = cr.ridden ? player.visualLevel : this.game.creatureLift(cr);
            // Under a bridge's deck rather than on it, as whoever rides it is (`bodyUnder`).
            // Every one kept track of where there are bridges, so the tile it came from is known when it steps under one.
            const under = this.game.bridges.size > 0 && lift <= 0 && (cr.ridden ? this.game.underNow() : this.bodyUnder(`c${cr.id}`, x, y)) && deckHere !== null;
            const stand = under ? null : deckHere;
            // Ridden along a bridge's deck up a storey: at the deck's height there, as its rider is (`playerHeight`).
            const upDeck = lift > 0 && deckHere !== null && this.game.deckOnStorey(x, y, up) ? this.game.deckHeightAt(cr.x, cr.y) : null;
            const ce = this.take('creature', x, y, cam.worldToScreenX(cr.x, cr.y),
              cam.worldToScreenY(cr.x, cr.y, upDeck ?? (lift > 0 ? this.footOn(cr.x, cr.y, up) + lift * WALL_HEIGHT : stand ?? this.footAt(cr.x, cr.y))), null);
            ce.creature = cr;
            if (stand !== null && lift <= 0) this.onBridgeDeck(ce, cr.x, cr.y);
            // Somebody else up on it: on its saddle, a hair in front of it, as I am on mine.
            const rider = this.saddled.has(cr.id) ? this.riderOf(cr) : undefined;
            if (rider) {
              const pe = this.take('peer', x, y, ce.sx, ce.sy + 0.01, null);
              pe.peer = rider;
              pe.lift = this.saddleSeat(cr) * zoom;
              // Astride as I am on mine: they were sat on a cart's box, in the air over its back.
              pe.seat = this.saddleOn(cr);
            }
          }
        }
        // The line's foam so far goes down under anything built on it (`ShorePainter.flush`).
        if (this.game.foundations.size) {
          this.shore.flush(ctx);
          this.drawFoundation(x, y, lit);
        }
        // Only a tile near something built has anything of it to draw (`StructureWatch.nearAny`): once one building stood
        // anywhere, every tile on the screen went through all of this, and a tenth of a far view's frame with it.
        if (this.structs.nearAny(x, y)) {
          this.shore.flush(ctx);
          this.drawStructures(x, y, V, d > playerDepth);
        }
        if (!aloft && this.hingeTiles.has(x * 65536 + y)) {
          this.shore.flush(ctx);
          this.walls.drawGateAt(x, y, V);
        }
      }
      // The line's foam, over its water and under anything standing on it.
      this.shore.flush(ctx);

      // Down in a cellar you are drawn with it (`drawCellarView`), and from up top not at all.
      if (d === playerDepth && player.aboard === null && !this.helming && player.level >= 0) {
        // On a bridge you stand on the deck, not in whatever is under it.
        // On the deck unless you are in a hull passing under it.
        // In a building on piers, on its deck and the storeys over it (`piers.ts`).
        const piered = this.game.afloat() ? null : this.game.deckBase(player.tileX, player.tileY, player.level);
        const deck = this.game.afloat() || piered !== null || this.game.underNow() ? null : this.game.laidOver(player.tileX, player.tileY, player);
        // A driver is drawn on the seat, which is a lift in screen pixels
        // rather than in world height: the cart is under them, not the ground.
        const drivenBy = this.game.driving();
        const up = this.game.mounted();
        // Up a spiral staircase, round its post on the tread under you (`spiralBody`).
        const spiral = !drivenBy && !up ? this.stairs.spiralBody(player.x, player.y, player.visualLevel) : null;
        this.spiralLift = spiral;
        // On the head of a way down, in the hole on its tread.
        const flight = !spiral && piered === null && deck === null && player.level === 0 && !drivenBy && !up ? this.onFlight(player.x, player.y) : null;
        // Lain where you fell, while you may still pick where to wake (`../game/fell.ts`); on a ladder, on it (`ladderbody.ts`).
        const fell = this.game.lying();
        const lb = !fell && !spiral && piered === null && deck === null && !drivenBy && !up ? ladderBody(this.game, player.x, player.y, player.level) : null;
        // Afloat in deep water, at the top of it: the sea's surface, or a pond's; on stepping stones, on their tops.
        const ph = piered !== null ? piered + player.visualLevel * WALL_HEIGHT
          : deck !== null ? deck : flight ? flight.h : this.footOn(player.x, player.y, player.level) + player.visualLevel * WALL_HEIGHT;
        // A driver sorts with the vehicle rather than with their own feet, a
        // hair behind it, so the figure is drawn onto the seat and not under
        // the box it is sitting on.
        // Sat on the box, the driver goes where the box goes rather than where
        // their own feet are, and sorts a hair behind it so it is drawn first.
        const [vx, vy] = drivenBy ? furnitureCentre(drivenBy) : [player.x, player.y];
        // A rider sits where their mount stands, which is where they stand: a storey up too (`rideRule`).
        const seatBase = drivenBy ? this.pieceBase(drivenBy, vx, vy) : player.visualLevel > 0 ? this.footOn(vx, vy, player.level) + player.visualLevel * WALL_HEIGHT : world.heightAt(vx, vy);
        const sy = spiral ? cam.worldToScreenY(spiral.x, spiral.y, spiral.h) : drivenBy || up ? cam.worldToScreenY(vx, vy, seatBase) + 0.01 : cam.worldToScreenY(player.x, player.y, ph);
        const pe = fell ? this.take('player', Math.floor(fell.x), Math.floor(fell.y), cam.worldToScreenX(fell.x, fell.y), cam.worldToScreenY(fell.x, fell.y, this.footOn(fell.x, fell.y, fell.level) + fell.level * WALL_HEIGHT), null)
          : lb ? this.take('player', player.tileX, player.tileY, cam.worldToScreenX(lb.x, lb.y), cam.worldToScreenY(lb.x, lb.y, lb.h), null)
            : this.take('player', player.tileX, player.tileY, spiral ? cam.worldToScreenX(spiral.x, spiral.y) : cam.worldToScreenX(vx, vy), sy, null);
        if (lb) pe.ladder = lb;
        if (spiral) pe.key = spiral.key;
        this.spiralSeen = spiral ? { tx: player.tileX, ty: player.tileY, x: pe.sx, y: pe.sy, key: spiral.key } : null;
        pe.lift = this.driverSeat() * zoom;
        // On a bridge's deck: after its deck and before its near parapet, not under it (`deckKey`).
        if ((deck !== null || drivenBy) && !this.game.underNow()) this.onBridgeDeck(pe, vx, vy);
        if (flight) pe.clip = flight.clip;
        // At a helm on a deck of its own the driver stands there, not in her middle.
        if (drivenBy && furnitureDef(drivenBy.kind).boat?.helm) this.onDeck(pe, drivenBy, this.game.helmSpot(drivenBy), pe.lift, true);
        // Anything else with a seat, on that seat with what is to hand there.
        else if (drivenBy) {
          const reined = !!reinsTo(drivenBy.kind);
          this.seatOn(pe, drivenBy, zoom, reined ? this.cartRoll(drivenBy) ?? CART_LEVEL : undefined);
          if (reined) pe.sway = this.cartSwayOf(drivenBy, cam.worldToScreenX(vx, vy), cam.worldToScreenY(vx, vy, this.pieceBase(drivenBy, vx, vy)), zoom);
        }
        // A rider, astride.
        else if (up) {
          pe.seat = this.saddleOn(up);
        }
      }
      // A wall laid at the end of the line is laid again over one already laid, which took the wash off it then.
      this.wallLift = null;
      if (grain) {
        this.specks(ctx, this.grainDark, this.grainN, 'rgba(0,0,0,0.095)');
        this.specks(ctx, this.grainPale, this.grainM, 'rgba(255,255,255,0.07)');
      }
      // The line's wildflowers from far off, a fill a colour.
      for (let k = 0; k < this.flowerSpeckN.length; k++) {
        const n = this.flowerSpeckN[k];
        if (!n) continue;
        const buf = this.flowerSpecks[k];
        const sz = Math.max(2.3, 3.8 * zoom);
        ctx.beginPath();
        for (let i = 0; i < n; i += 2) ctx.rect(buf[i] - sz / 2, buf[i + 1] - sz / 2, sz, sz);
        ctx.fillStyle = FLOWER_COLOURS[k].petal;
        ctx.fill();
      }
      // The light on this line's ponds, and the streams, falls and springs whose water lies on it, over the ground and under what stands on it.
      if (water) this.springWater.row(ctx, d);
      // Then the stepping stones standing up out of all of it, before anybody standing on them; and the pads lying on it.
      if (this.stoneRow.length || this.stoneRowDim.length) this.stonesOnLine(ctx);

      if (this.plantRow.length && this.plantFrame) {
        drawPlantsFlat(ctx, this.plantRow, this.plantFrame);
        this.plantRow.length = 0;
      }
      // Petals and leaves lying on this line's ground and floating on its water.
      if (!this.fast) this.life.ground(ctx, d);
      // The line's pilasters, over every wall of it and under its roofs (`drawColumnsAt`).
      if (this.linePilasters.length) {
        for (const lay of this.linePilasters) {
          lay();
          this.occludeLine(null, lay);
        }
        this.linePilasters.length = 0;
      }
      // The roofs of the buildings whose last walls this line drew, before
      // anything standing in front of them.
      const roofs = this.roofQueue.get(d);
      if (roofs) {
        for (const bb of roofs) {
          // And so does its roof, over the water drawn beside its last tiles.
          if (this.wetPierBuildings?.has(bb.id)) this.waters.layWater(ctx, zoom);
          // Not over the bays of an aqueduct standing in front of it, drawn on the lines before this one.
          const cut = this.game.bridges.size ? this.aqueducts.before(bb.tiles, d, V) : null;
          if (cut?.length) {
            ctx.save();
            this.aqueducts.clipOut(ctx, cut);
          }
          this.roofs.drawPitchedRoof(bb);
          if (cut?.length) ctx.restore();
        }
      }
      // A drawbridge's gallows and a deck off the bank stand in front of any roof this line laid (`drawGateAt`).
      if (this.gateLate.length) {
        for (const draw of this.gateLate) {
          draw();
          this.occludeLine(null, draw);
        }
        this.gateLate.length = 0;
      }
      // And whatever small thing is in the air over it, sorted in with everything standing on it.
      if (!this.fast) for (const m of this.life.aloft(d)) this.take('life', m.tx, m.ty, m.sx, m.sy, null).mote = m;
      // What spells lay on this line's ground, under everything standing on it; and what of them stands here, sorted in with it.
      this.spells.groundLine(ctx, d);
      // And the shade of the trees drawn as solids that falls on it.
      if (this.solidShade) this.solidShadeLine(ctx, d);
      for (const rec of this.spells.itemsAt(d)) this.take('spell', Math.floor(rec.x), Math.floor(rec.y), rec.sx, rec.sy, null).fx = rec;
      // Whoever stands in a rune gate's opening is drawn on the line of its front tile, between its two pictures (`runegate.ts`):
      // they first, then the gates' fronts, then everything else on the line, which stands in front of both.
      if (this.walls.gateBodies(d, V)) {
        const rest = this.ents;
        this.ents = this.gateIn;
        this.drawEntities(ctx, zoom);
        this.ents = rest;
        this.gateIn = [];
      }
      this.walls.flushGateFront();
      if (this.ents.length) this.drawEntities(ctx, zoom);
      // Remembered ground on this line came down over what was waiting to take the wash off: the wash so far is laid, and that taken off it, first.
      if (lineOver) {
        wash ??= this.fogLayer(drawnAt);
        this.layWash(wash, gathered ? fogPath : null, liftPath);
        fogPath = new Path2D();
        liftPath = new Path2D();
        gathered = false;
        lineOver = false;
        this.lifted = false;
        this.liftFloor.fill(-Infinity);
      }
      if (lineAny) {
        fogPath.addPath(lineFog);
        lineFog = new Path2D();
        washed = true;
        gathered = true;
        lineAny = false;
      }
    }
    this.lineNow = null;
    this.feet.length = 0;
    // And pictures made of the blocks of ground this frame wanted and did not have, as long as the frame can spare.
    if (this.gf) this.bakeChunks();
    this.gf = null;
    // Anybody put off to a line past the last drawn, and any rune gate's front still waiting.
    if (this.gateDeferred.size) {
      this.ents.length = 0;
      for (const list of this.gateDeferred.values()) this.ents.push(...list);
      this.gateDeferred.clear();
      if (this.ents.length) this.drawEntities(ctx, zoom);
    }
    this.walls.flushGateFront();
    this.ents.length = 0;
    // What crossed the water, clipped to it, so no wake washes up over a beach standing in front of it.
    this.waters.drawWakes(ctx, zoom);
    this.drawAir(ctx, zoom);
    if (!this.fast && this.hazeOn) this.drawHaze(ctx, zoom);
    if (this.game.settings.stationRings) this.drawStationRings(ctx, zoom);
    this.drawFloaters(ctx, zoom);

    // One pass for all of it, so a remembered wood goes cold with its ground.
    if (this.lifted || wash) {
      wash ??= this.fogLayer(drawnAt);
      this.layWash(wash, gathered ? fogPath : null, this.lifted ? liftPath : null);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = FOG_ALPHA;
      ctx.drawImage(wash, 0, 0);
      ctx.restore();
    } else if (gathered) {
      ctx.fillStyle = FOG_COLOR;
      ctx.fill(fogPath);
    }

    // Every tile in view shaded for this step of the sun: the last step's colours are done with.
    if (this.colorsWas && !this.sunWasUsed) {
      this.colorsWas = null;
      this.trailPaintWas = null;
    }
    this.drawOverlays(ctx, zoom);
    if (this.pinned !== null && this.pinned > 0) this.drawRoofSites(ctx);
    if (this.planGhost?.length) this.drawPlanGhost(ctx, this.planGhost);
    this.drawFight(ctx, zoom);
    if (this.game.settings.markThreats) this.drawThreats(ctx, zoom);
    // Every name, over everything, laid out together so none covers another.
    this.names.flush(ctx);
  }

  /**
   * How this frame's blocks of ground are made and laid (`GroundChunks`), or
   * null for a frame drawn as it always was: the zoom still moving, the grid
   * on, a cellar being looked into, or a canvas turned or skewed. A new view,
   * zoom, screen or fraction of a pixel the camera sits on drops them all.
   */
  private groundFrame(V: View, zoom: number, W: number, H: number, at: DOMMatrix, grid: boolean, paveRot: number,
    grassy: boolean, hemmed: boolean, paved: boolean, seamed: boolean, water: WaterField | null, sun: [number, number, number], voidInk: string): GroundFrame | null {
    if (!this.bakeGround || zoom < GROUND_FROM || !this.zoomSettled || this.cellarFrame || at.b !== 0 || at.c !== 0 || at.a !== at.d) return null;
    const a = at.a;
    const cam = this.camera;
    if (cam.cx !== this.viewWas[0] || cam.cy !== this.viewWas[1]) {
      this.viewWas = [cam.cx, cam.cy];
      this.viewMovedAt = performance.now();
    }
    this.viewMoving = performance.now() - this.viewMovedAt < GROUND_STILL_MS;
    const stepW = HALF_W * V.unit;
    const stepH = HALF_H * V.unit;
    // Where the lattice's first point lands, in device pixels: the camera is on a whole one (`render`), so this keeps its fraction.
    const X0 = a * (W / 2 - cam.cx * zoom) + at.e;
    const Y0 = a * (H / 2 - cam.cy * zoom) + at.f;
    const frac = (v: number): number => (Math.abs(v - Math.round(v)) < 1e-4 ? 0 : v - Math.floor(v));
    const fx = frac(X0), fy = frac(Y0);
    const lines = Math.max(2, Math.min(64, Math.round(GROUND_BLOCK_H / (stepH * zoom * a))));
    const across = 2 * Math.max(2, Math.min(512, Math.ceil(this.canvas.el.width / (2 * stepW * zoom * a))));
    const key = `${cam.rotation}|${zoom}|${a}|${Math.round(fx * 1000)}|${Math.round(fy * 1000)}|${lines}|${across}|${grid}`;
    if (key !== this.chunks.key) this.chunks.reset(key, lines, across);
    else this.chunks.forgetTouched(V);
    for (const b of this.reachMoved) this.chunks.forgetBox(V, b[0] - 1, b[1] - 1, b[2] + 1, b[3] + 1, false);
    this.reachMoved.length = 0;
    this.chunkWants.clear();
    this.strokeAt.clear();
    const g = this.game;
    this.groundSig = `${this.structs.stamp}|${this.hingeTiles.size}|${g.bridges.size}|${g.foundations.size}|${g.buildings.pierTiles.size}|`
      + `${this.flowerSeasonNow}|${this.flowerBuildings}|${water ? this.frameNo : 0}|${Math.floor(this.greenAt / 60)}|${g.settings.fog}`;
    const voidSteady = voidInk === this.voidWas;
    this.voidWas = voidInk;
    const hw = stepW * zoom, hh = stepH * zoom;
    const off = new Float64Array(8);
    for (let i = 0; i < 4; i++) {
      off[i * 2] = V.shape[i][0] * hw;
      off[i * 2 + 1] = V.shape[i][1] * hh;
    }
    return {
      V, zoom, a, te: at.e, tf: at.f, sx: Math.round(X0 - fx), sy: Math.round(Y0 - fy), W, H, stepW, stepH, hs: HEIGHT_SCALE * zoom, off,
      co: V.corners, paveRot, grassy, hemmed, paved, seamed, grid, water, piers: this.game.buildings.pierTiles.size > 0, sun,
      voidInk, voidSteady,
    };
  }

  /**
   * What a tile is for its block's picture (`GroundChunks`): nought for one
   * drawn as it always was -- under water, folded over on a cliff, a flight of
   * steps, paving under the grid, flowers in it that nod, the foot of a pier --
   * or `BAKED`, with `VOID` for ground nobody has seen, `LIT` for ground in
   * sight and `AFTER` where something is drawn on it
   * after its ground. And the moss in a paved tile's joints, in `classMoss`.
   */
  private groundClass(x: number, y: number): number {
    const gf = this.gf!;
    const world = this.game.world;
    const co = gf.co;
    const c = this.classBuf;
    this.classMoss = -1;
    const fog = this.game.vision.state(x, y);
    if (fog === UNSEEN) return BAKED | VOID;
    const lit = fog === VISIBLE;
    for (let k = 0; k < 4; k++) c[k] = world.getHeight(x + co[k][0], y + co[k][1]);
    if (c[0] < 0 || c[1] < 0 || c[2] < 0 || c[3] < 0) return 0;
    if (gf.water !== null && gf.water.wet(x, y) && this.waters.pondsOn(gf.water, x, y, c, co)) return 0;
    const p = this.classPts;
    for (let k = 0; k < 4; k++) {
      p[k * 2] = gf.off[k * 2];
      p[k * 2 + 1] = gf.off[k * 2 + 1] - c[k] * gf.hs;
    }
    if (!gf.grid && !this.outsetTurn(p)) return 0;
    const here = world.viewTile(x, y, lit);
    const t0 = this.groundAt(x, y, lit);
    if (t0 === TileType.Steps) return 0;
    /*
     * Paving is laid on in `overlay`, which mixes with what is under it; under
     * the grid a tile's edge is not covered whole by its own colour, and what
     * shows through there is the line before, which a block's picture has not
     * got.
     */
    if (gf.grid && gf.paved && PAVED.has(t0)) return 0;
    if (lit && here === TileType.Grass && gf.zoom >= FLOWERS_DRAWN && (this.flowerAt(x, y) & 7) !== 0) return 0;
    const near = this.structs.nearAny(x, y);
    if (near && gf.piers) return 0;
    let k = BAKED | (lit ? LIT : 0);
    if (near || this.hingeTiles.has(x * 65536 + y) || (lit && this.game.foundations.size > 0 && this.game.foundationAt(x, y))) k |= AFTER;
    if (lit && gf.paved && PAVED.has(t0)) this.classMoss = this.mossStage(x, y);
    return k;
  }

  /**
   * The blocks across line `d` that its ground can be laid from: each one's
   * tiles in view checked against what it was made of, and a block wanted
   * (`bakeChunks`) where there is none, it is out of date, a tile has changed
   * or it was made under another sun. Says whether there is any.
   */
  private chunkLine(d: number, eMin: number, eMax: number): boolean {
    const ch = this.chunks;
    const V = this.gf!.V;
    const world = this.game.world;
    const cd = Math.floor(d / ch.lines);
    const li = d - cd * ch.lines;
    const ce0 = Math.floor(eMin / ch.across);
    const ce1 = Math.floor(eMax / ch.across);
    const out = this.lineChunks;
    const want = this.lineWant;
    out.length = 0;
    want.length = 0;
    this.lineCe0 = ce0;
    let any = false;
    const gf = this.gf!;
    for (let ce = ce0; ce <= ce1; ce++) {
      const c = ch.get(cd, ce);
      // Made under the sun before last or longer ago: not laid (the colours of one step back are, `colorsWas`).
      if (!c || c.dead || c.sun < this.sunEpoch - 1) {
        want.push(0);
        out.push(null);
        continue;
      }
      c.used = this.frameNo;
      // Unseen ground laid in another colour of the void: made again once the colour holds still.
      if (c.voidInk !== null && c.voidInk !== gf.voidInk) {
        want.push(gf.voidSteady ? 1 : -1);
        out.push(null);
        continue;
      }
      want.push(c.stale ? (performance.now() < c.hold ? -1 : 1) : c.sun !== this.sunEpoch ? 2 : -1);
      const L = c.lines[li];
      // Off the top or the bottom of the screen: nothing of it to lay.
      if (!L.runs.length || L.y1 + gf.sy < 0 || L.y0 + gf.sy > this.canvas.el.height) {
        out.push(null);
        continue;
      }
      const vision = this.game.vision.revision;
      if (L.sig === this.groundSig && L.vis >= c.vis) {
        out.push(L);
        any = true;
        continue;
      }
      let ok = true;
      const e0 = Math.max(eMin, ce * ch.across), e1 = Math.min(eMax, ce * ch.across + ch.across - 1);
      for (let e = e0; ok && e <= e1; e++) {
        if (V.staggered && ((e + d) & 1) !== 0) continue;
        const x = V.x[0] + V.x[1] * d + V.x[2] * e;
        const y = V.y[0] + V.y[1] * d + V.y[2] * e;
        if (x < 0 || y < 0 || x >= world.w || y >= world.h) continue;
        const s = e - ce * ch.across;
        if (this.groundClass(x, y) !== L.cls[s] || this.classMoss !== L.moss[s]) ok = false;
      }
      if (!ok) {
        staled(c, performance.now());
        if (performance.now() >= c.hold) want[want.length - 1] = 1;
      } else {
        L.sig = this.groundSig;
        L.vis = vision;
      }
      out.push(ok ? L : null);
      any ||= ok;
    }
    return any;
  }

  private wantChunk(cd: number, ce: number, soon: number): void {
    const id = cd * 65536 + ce;
    const had = this.chunkWants.get(id);
    if (!had || had[2] > soon) this.chunkWants.set(id, [cd, ce, soon]);
  }

  /** The run the tile at step `e` of the line being drawn is laid in, or null for one drawn as it always was. */
  private chunkRun(e: number): GroundRun | null {
    const ch = this.chunks;
    const ce = Math.floor(e / ch.across);
    const L = this.lineChunks[ce - this.lineCe0];
    if (!L) return null;
    const r = L.run[e - ce * ch.across];
    return r < 0 || L.runs[r].refused === this.frameNo ? null : L.runs[r];
  }

  /**
   * A tile on the screen: its block wanted where there is none to lay, it is
   * out of date or of an older sun -- only blocks with something on the
   * screen are made -- and, drawn as it always was, the state of the canvas
   * the grid was stroked in on it, for the block to be made in.
   */
  private chunkSeen(ctx: CanvasRenderingContext2D, d: number, e: number, run: GroundRun | null): void {
    if (this.viewMoving) return;
    const ch = this.chunks;
    const ce = Math.floor(e / ch.across);
    const w = this.lineWant[ce - this.lineCe0];
    if (w === undefined || w < 0) return;
    this.wantChunk(Math.floor(d / ch.lines), ce, w);
    if (!run && this.gf!.grid) this.strokeAt.set((d + 32768) * 65536 + e + 32768, [ctx.lineWidth, ctx.lineJoin, ctx.lineCap]);
  }

  /**
   * A run of a line's ground laid from its block's picture, a device pixel to
   * a device pixel, and the canvas left as its tiles would have left it. Under
   * the grid, which is stroked in whatever the canvas was left with, only where
   * that is what the run was made in; and not at all, and the block made again,
   * where it is not.
   */
  private layRun(ctx: CanvasRenderingContext2D, run: GroundRun, at: DOMMatrix, cd: number, ce: number): boolean {
    const gf = this.gf!;
    if (gf.grid && (ctx.lineWidth !== run.width0 || ctx.lineJoin !== run.join0 || ctx.lineCap !== run.cap0)) {
      run.refused = this.frameNo;
      const c = this.chunks.get(cd, ce);
      if (c) {
        staled(c, performance.now());
        if (performance.now() >= c.hold) this.lineWant[ce - this.lineCe0] = 1;
      }
      return false;
    }
    // Only what is on the screen of it.
    let x = run.dx + gf.sx, y = run.dy + gf.sy, sx = run.sx, sy = run.sy, w = run.w, h = run.h;
    const cut = (lo: number): number => Math.max(0, lo);
    const l = cut(-x), t = cut(-y);
    x += l; sx += l; w -= l + cut(x + w - l - this.canvas.el.width);
    y += t; sy += t; h -= t + cut(y + h - t - this.canvas.el.height);
    if (w > 0 && h > 0) {
      // Under a scale of one, two or four a device pixel is a whole number of the canvas's units over it, and the transform can stay.
      if (gf.a === 1 || gf.a === 2 || gf.a === 4) {
        const a = gf.a;
        ctx.drawImage(run.cv, sx, sy, w, h, (x - gf.te) / a, (y - gf.tf) / a, w / a, h / a);
      } else {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(run.cv, sx, sy, w, h, x, y, w, h);
        ctx.setTransform(at);
      }
    }
    if (run.width !== null) ctx.lineWidth = run.width;
    if (run.join !== null) ctx.lineJoin = run.join;
    if (run.cap !== null) ctx.lineCap = run.cap;
    run.laid = this.frameNo;
    return true;
  }

  /** How far the ferns and tufts on a steep face (`drawFace`) reach past where they stand, at zoom one: left, right, up, down. */
  private groundReach(): [number, number, number, number] {
    if (this.reach4) return this.reach4;
    const r: [number, number, number, number] = [0, 0, 0, 0];
    for (let v = 0; v < 3; v++) for (const kind of ['fern', 'tuft'] as const) {
      const b = sprigOf(kind, v);
      r[0] = Math.max(r[0], b.ax * 1.2);
      r[1] = Math.max(r[1], (b.w - b.ax) * 1.2);
      r[2] = Math.max(r[2], b.ay * 1.2);
      r[3] = Math.max(r[3], (b.h - b.ay) * 1.2);
    }
    this.reach4 = r;
    return r;
  }

  /** Whether a tile is steep enough to show its rock (`dressFace`). */
  private steep(x: number, y: number): boolean {
    const w = this.game.world;
    const h0 = w.getHeight(x, y), h1 = w.getHeight(x + 1, y), h2 = w.getHeight(x + 1, y + 1), h3 = w.getHeight(x, y + 1);
    return bareRock(Math.hypot((h1 + h2 - h0 - h3) / 2 / UNITS_PER_TILE, (h2 + h3 - h0 - h1) / 2 / UNITS_PER_TILE)) > 0;
  }

  /** A tile's screen corners this frame, as the ground pass works them out. */
  private chunkPts(d: number, e: number, x: number, y: number, out: Float64Array): void {
    const gf = this.gf!;
    const world = this.game.world;
    const cam = this.camera;
    const baseX = (e * gf.stepW - cam.cx) * gf.zoom + gf.W / 2;
    const baseY = (d * gf.stepH - cam.cy) * gf.zoom + gf.H / 2;
    for (let k = 0; k < 4; k++) {
      out[k * 2] = baseX + gf.off[k * 2];
      out[k * 2 + 1] = baseY + gf.off[k * 2 + 1] - world.getHeight(x + gf.co[k][0], y + gf.co[k][1]) * gf.hs;
    }
  }

  /** The blocks this frame wanted, soonest first, made as long as the frame can spare and there is room. */
  private bakeChunks(): void {
    if (!this.chunkWants.size || this.viewMoving) return;
    const wants = [...this.chunkWants.values()].sort((p, q) => p[2] - q[2]);
    this.chunkWants.clear();
    const until = performance.now() + GROUND_BAKE_MS;
    const most = Math.min(GROUND_PIXELS, GROUND_SCREENS * this.canvas.el.width * this.canvas.el.height);
    this.baking = true;
    try {
      for (const [cd, ce] of wants) {
        if (performance.now() > until) break;
        this.chunks.evict(most, this.frameNo);
        // One made again takes the place of the one it was.
        if (this.chunks.pixels - (this.chunks.get(cd, ce)?.pixels ?? 0) > most) break;
        this.bakeChunk(cd, ce);
      }
    } finally {
      this.baking = false;
      this.groundCtx = null;
    }
  }

  /**
   * A block's picture (`GroundChunks`): its lines' tiles sorted into runs, a
   * run's room in the picture its tiles' reach, and each run drawn as the
   * ground pass draws its tiles (`bakeTile`), where on the screen this frame
   * would have put them.
   */
  private bakeChunk(cd: number, ce: number): void {
    const gf = this.gf!;
    const ch = this.chunks;
    const world = this.game.world;
    const { V, a } = gf;
    const A = ch.across;
    const lines: GroundLine[] = [];
    const pend: Array<{ run: GroundRun; tiles: number[]; pts: Float64Array[]; x0: number; y0: number; x1: number; y1: number; seen: boolean; area: number; line: GroundLine }> = [];
    let mem = false;
    let unseen = false;
    for (let li = 0; li < ch.lines; li++) {
      const d = cd * ch.lines + li;
      const L: GroundLine = { cls: new Uint8Array(A), moss: new Int8Array(A).fill(-1), run: new Int16Array(A).fill(-1), runs: [], y0: Infinity, y1: -Infinity, sig: this.groundSig, vis: this.game.vision.revision };
      lines.push(L);
      let cur: (typeof pend)[number] | null = null;
      for (let s = 0; s < A; s++) {
        const e = ce * A + s;
        if (V.staggered && ((e + d) & 1) !== 0) continue;
        const x = V.x[0] + V.x[1] * d + V.x[2] * e;
        const y = V.y[0] + V.y[1] * d + V.y[2] * e;
        if (x < 0 || y < 0 || x >= world.w || y >= world.h) continue;
        const k = this.groundClass(x, y);
        L.cls[s] = k;
        L.moss[s] = this.classMoss;
        if (!k) {
          cur = null;
          continue;
        }
        const lit = (k & LIT) !== 0;
        if (k & VOID) unseen = true;
        else if (!lit) mem = true;
        const pts = new Float64Array(8);
        this.chunkPts(d, e, x, y, pts);
        // What it draws past its corners: its clumps and a steep face's ferns, a path's lobes, and a pixel or two of smoothing.
        const t0 = this.groundAt(x, y, lit);
        const here = world.viewTile(x, y, lit);
        const z = gf.zoom;
        const steep = lit && !(k & VOID) && this.steep(x, y);
        const [rl, rr, ru, rd] = steep && z >= 1 ? this.groundReach() : [0, 0, 0, 0];
        // A steep face's moss and lip hang over its edges as well.
        const pad = 2 + (gf.grid ? 1.5 : 0) + (steep ? 12 * z : 0) + (!(k & VOID) && this.trailMaskAt(x, y, lit) ? TRAIL_LOBE * 2 * z : 0);
        const box = this.reachBox;
        box[0] = box[1] = Infinity;
        box[2] = box[3] = -Infinity;
        for (let q = 0; q < 8; q += 2) {
          box[0] = Math.min(box[0], pts[q] - rl * z); box[2] = Math.max(box[2], pts[q] + rr * z);
          box[1] = Math.min(box[1], pts[q + 1] - ru * z); box[3] = Math.max(box[3], pts[q + 1] + rd * z);
        }
        if (gf.grassy && lit && !(k & VOID) && STREWN.has(t0) && here !== TileType.Trail) this.strewTile(t0, x, y, pts, gf.paveRot, z, lit, box);
        const x0 = Math.floor(a * (box[0] - pad) + gf.te);
        const x1 = Math.ceil(a * (box[2] + pad) + gf.te);
        const y0 = Math.floor(a * (box[1] - pad) + gf.tf);
        const y1 = Math.ceil(a * (box[3] + pad) + gf.tf);
        // A run whose box would be mostly empty -- over a hill, its tiles at heights far apart -- is cut, and goes on in another.
        const area = (x1 - x0) * (y1 - y0);
        if (cur && (Math.max(cur.x1, x1) - Math.min(cur.x0, x0)) * (Math.max(cur.y1, y1) - Math.min(cur.y0, y0)) > 2 * (cur.area + area)) cur = null;
        if (!cur) {
          cur = {
            run: {
              cv: null as unknown as HTMLCanvasElement, sx: 0, sy: 0, w: 0, h: 0, dx: 0, dy: 0, laid: -1, refused: -1,
              width0: 1, join0: 'round', cap0: 'butt', width: null, join: null, cap: null,
            },
            tiles: [], pts: [], x0, y0, x1, y1, seen: false, area: 0, line: L,
          };
          L.runs.push(cur.run);
          pend.push(cur);
        }
        // The canvas as the grid found it on the run's first tile drawn this frame: off the screen, a tile draws nothing to change it.
        const st = !cur.seen ? this.strokeAt.get((d + 32768) * 65536 + e + 32768) : undefined;
        if (st) {
          [cur.run.width0, cur.run.join0, cur.run.cap0] = st;
          cur.seen = true;
        }
        L.run[s] = L.runs.length - 1;
        cur.tiles.push(x, y, k);
        cur.area += area;
        cur.pts.push(pts);
        cur.x0 = Math.min(cur.x0, x0); cur.y0 = Math.min(cur.y0, y0);
        cur.x1 = Math.max(cur.x1, x1); cur.y1 = Math.max(cur.y1, y1);
        // Something drawn on it after its ground: the next tile's ground goes down after that, in a run of its own.
        if (k & AFTER) cur = null;
      }
    }
    // The runs packed in rows, tallest first, a row as wide as the picture's area squared or the widest run.
    let w = 0, h = 0, area = 0;
    for (const p of pend) {
      p.run.w = p.x1 - p.x0;
      p.run.h = p.y1 - p.y0;
      w = Math.max(w, p.run.w);
      area += p.run.w * p.run.h;
    }
    w = Math.max(w, Math.ceil(Math.sqrt(area * 1.15)));
    let rx = 0, ry = 0, rh = 0;
    for (const p of [...pend].sort((q, r) => r.run.h - q.run.h)) {
      if (rx + p.run.w > w) {
        ry += rh;
        rx = 0;
        rh = 0;
      }
      p.run.sx = rx;
      p.run.sy = ry;
      rx += p.run.w;
      rh = Math.max(rh, p.run.h);
    }
    h = ry + rh;
    let cv: HTMLCanvasElement | null = null;
    const g = w > 0 && h > 0 && w * h <= GROUND_BLOCK_MOST ? (cv = document.createElement('canvas'), cv.width = w, cv.height = h, cv.getContext('2d')) : null;
    if (!g || !cv) {
      // Nothing to lay, or too much: every tile drawn as it always was.
      for (const L of lines) {
        L.runs.length = 0;
        L.run.fill(-1);
      }
      cv = null;
    } else {
      this.groundCtx = g;
      for (const p of pend) {
        const r = p.run;
        r.cv = cv;
        r.dx = p.x0 - gf.sx;
        r.dy = p.y0 - gf.sy;
        p.line.y0 = Math.min(p.line.y0, r.dy);
        p.line.y1 = Math.max(p.line.y1, r.dy + r.h);
        // Kept to its own room in the picture, whatever reaches further than it was given.
        g.save();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.beginPath();
        g.rect(r.sx, r.sy, r.w, r.h);
        g.clip();
        g.setTransform(a, 0, 0, a, gf.te - p.x0 + r.sx, gf.tf - p.y0 + r.sy);
        /*
         * Under the grid, the canvas as its first tile found it; without, as
         * nothing on the ground ever leaves it, so that what its tiles change
         * is told from what they leave alone.
         */
        const [w0, j0, c0]: [number, CanvasLineJoin, CanvasLineCap] = gf.grid ? [r.width0, r.join0, r.cap0] : [0.125, 'bevel', 'square'];
        g.lineWidth = w0;
        g.lineJoin = j0;
        g.lineCap = c0;
        for (let i = 0; i < p.tiles.length; i += 3) this.bakeTile(g, p.tiles[i], p.tiles[i + 1], p.tiles[i + 2], p.pts[i / 3]);
        if (g.lineWidth !== w0) r.width = g.lineWidth;
        if (g.lineJoin !== j0) r.join = g.lineJoin;
        if (g.lineCap !== c0) r.cap = g.lineCap;
        g.restore();
      }
      this.groundCtx = null;
    }
    ch.set({
      cd, ce, lines, cv, pixels: cv ? w * h : 0, sun: this.sunEpoch, dead: false, stale: false, mem, used: this.frameNo,
      voidInk: unseen ? gf.voidInk : null, vis: this.game.vision.revision,
      made: performance.now(), holdFor: ch.get(cd, ce)?.holdFor ?? 0, hold: 0,
    });
  }

  /**
   * One tile's ground into a block's picture, as the ground pass draws a
   * dry tile (`renderFrame`): its colour, what is strewn on it, the edges of
   * the ground beside it, a path, a face's dressing, its paving and the metal
   * in it, in that order. What that pass lays a line at a time -- grain,
   * flowers from far off -- it still lays.
   */
  private bakeTile(g: CanvasRenderingContext2D, x: number, y: number, k: number, pts: Float64Array): void {
    const gf = this.gf!;
    const world = this.game.world;
    // Ground nobody has seen: its shape, flat and empty, as the line lays it.
    if (k & VOID) {
      g.beginPath();
      g.moveTo(pts[0], pts[1]);
      g.lineTo(pts[2], pts[3]);
      g.lineTo(pts[4], pts[5]);
      g.lineTo(pts[6], pts[7]);
      g.closePath();
      g.fillStyle = gf.voidInk;
      g.fill();
      return;
    }
    const lit = (k & LIT) !== 0;
    const here = world.viewTile(x, y, lit) as TileType;
    const t0 = this.groundAt(x, y, lit);
    const color = this.groundColor(x, y, lit, gf.sun);
    g.beginPath();
    const outset = !gf.grid && this.outsetTile(g, pts);
    if (!outset) {
      g.moveTo(pts[0], pts[1]);
      g.lineTo(pts[2], pts[3]);
      g.lineTo(pts[4], pts[5]);
      g.lineTo(pts[6], pts[7]);
      g.closePath();
    }
    g.fillStyle = color;
    g.fill();
    if (!outset) {
      g.strokeStyle = gf.grid ? GRID_COLOR : color;
      g.stroke();
    }
    // The wet band up a shore, as the line lays it (`seaShore`).
    const c = this.classBuf;
    for (let q = 0; q < 4; q++) c[q] = world.getHeight(x + gf.co[q][0], y + gf.co[q][1]);
    if (!this.fast && c[0] < SHORE_HIGH && c[1] < SHORE_HIGH && c[2] < SHORE_HIGH && c[3] < SHORE_HIGH && this.shoreField.on(x, y) && !this.waters.shoreBare(x, y)
      && this.shore.load(world, this.shoreField, x, y, gf.co, c, 0)) this.shore.wet(g, 0);
    if (gf.grassy && STREWN.has(t0) && here !== TileType.Trail) this.strewTile(t0, x, y, pts, gf.paveRot, gf.zoom, lit);
    if (gf.hemmed && !PAVED.has(t0) && t0 !== TileType.Steps) {
      const seams = lit ? this.colors : this.memColors;
      const known = seams.flag(x, y);
      // Straight into the block rather than through a picture of the tile's own (`hems`), which the block is.
      if (known !== 1) {
        const drew = this.swardEdges(g, gf.V, x, y, pts, gf.zoom, lit);
        if (known === 0) seams.setFlag(x, y, drew ? 2 : 1);
      }
    }
    const tm = this.trailMaskAt(x, y, lit);
    if (tm) this.drawTrail(g, x, y, tm, pts, lit, gf.zoom);
    if (lit) this.dressFace(g, x, y, pts, gf.zoom, false, false);
    if (gf.paved && PAVED.has(t0)) this.paving(t0, x, y, world.viewData(x, y, lit), pts, gf.paveRot, lit);
    if (gf.seamed && t0 === TileType.Rock) {
      const kind = world.rockFace(x, y);
      if (kind > 0) seam(g, x, y, kind, pts, gf.paveRot, gf.zoom, this.canvas.dpr);
    }
  }

  /** Where your feet were drawn this frame, on the screen. */
  private feetAt: { x: number; y: number } | null = null;

  /**
   * A creature's name, handed to the names drawn over the frame (`NameLabels`): every one of them at every zoom, by
   * its colour for whose it is, over its head and over whatever else is drawn there -- its health bar, the bar
   * `drawFight` puts over one after you, the red marker `drawThreats` puts over a hostile one and the ! of a heavy
   * blow coming -- which are kept clear of every other name as well. `tall` is how high its head is at zoom one.
   */
  private nameCreature(cr: Creature, def: (typeof SPECIES)[string], look: CreaturePose, tall: number, sway: Swayed | undefined, sx: number, sy: number, zoom: number): void {
    const [x, head] = swayedAt(sway, sx, sy - tall * zoom);
    const feet = swayedAt(sway, sx, sy)[1];
    const hostile = threatens(cr, def);
    let lift = Math.max(0, creatureTop(look) - tall) * zoom;
    const marked = this.game.fightTarget ?? this.game.marked;
    if (cr.mode === 'wild' && cr.health > 0 && (cr.enemy === PLAYER_ATTACKER || cr.id === marked)) lift = Math.max(lift, 3 * zoom + Math.max(3, 4 * zoom) + 1);
    if (hostile && this.game.settings.markThreats) {
      const r = 5 * Math.max(0.8, zoom);
      const mark = (cr.enemy === PLAYER_ATTACKER ? 14 * zoom + 3 * r : 6 * zoom + 1.6 * r) + (this.calm ? 0 : 2 * zoom);
      this.names.block(x - r, head - mark, 2 * r, mark);
      lift = Math.max(lift, mark);
    }
    if (cr.windup > 0) {
      const size = Math.max(11, Math.round(18 * zoom));
      this.names.block(x - size / 2, head - 16 * zoom - size, size, size);
      lift = Math.max(lift, 16 * zoom + size);
    }
    this.names.add({
      text: cr.name,
      ink: hostile ? 'hostile' : cr.mode === 'wild' ? 'wild' : cr.mine === false ? 'theirs' : 'mine',
      x,
      head,
      lift,
      z: feet,
    });
  }

  /**
   * Hostile creatures, marked over whatever stands in front of them: asked,
   * because a hunter in a wood could not be told from the wood. Each is drawn
   * again in red over the trees, buildings and anything else, and a red
   * marker hangs over its head; both stronger while it is hunting you. What
   * counts as hostile is `threatens`.
   */
  private drawThreats(ctx: CanvasRenderingContext2D, zoom: number): void {
    if (!this.threats.length) return;
    const red = inkOr('bad', '#e2553c');
    const bob = this.calm ? 0 : Math.sin(this.anim * 4) * 2 * zoom;
    for (const t of this.threats) {
      const { pad, g, ox, oy, side } = this.scratch(zoom);
      t.draw(g, ox, oy);
      this.stamp(red);
      ctx.globalAlpha = t.hunting ? THREAT_SHADE_HUNTING : THREAT_SHADE;
      ctx.drawImage(pad, t.sx - ox, t.sy - oy, side, side);
      ctx.globalAlpha = 1;
      // Over its head, and over the health bar a creature hunting you has (`drawFight`).
      const x = t.sx;
      const y = t.top - (t.hunting ? 14 : 6) * zoom + bob;
      const r = 5 * Math.max(0.8, zoom);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - r, y - r * 1.6);
      ctx.lineTo(x + r, y - r * 1.6);
      ctx.closePath();
      ctx.lineWidth = Math.max(1.5, zoom * 1.5);
      ctx.strokeStyle = 'rgba(20, 6, 4, 0.85)';
      ctx.stroke();
      ctx.globalAlpha = t.hunting ? (this.calm ? 0.95 : 0.75 + 0.25 * Math.sin(this.anim * 8)) : 0.8;
      ctx.fillStyle = red;
      ctx.fill();
      // Hunting you: a second marker over the first, so the shape says it as well as the pulse and the colour.
      if (t.hunting) {
        const y2 = y - r * 1.9;
        ctx.beginPath();
        ctx.moveTo(x, y2);
        ctx.lineTo(x - r * 0.7, y2 - r * 1.1);
        ctx.lineTo(x + r * 0.7, y2 - r * 1.1);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /**
   * The fight, over everything else: a bar over whatever is after you and
   * over what you are fighting or have marked, the swing in hand as a ring
   * filling at your feet, an arrow at the edge of the view for each thing
   * after you out of it, how far a hunter under the cursor notices you from,
   * and the edge of the view reddening when you are struck.
   */
  private drawFight(ctx: CanvasRenderingContext2D, zoom: number): void {
    const game = this.game;
    const cam = this.camera;
    const w = game.world;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const marked = game.fightTarget ?? game.marked;
    ctx.save();
    for (const hit of this.creatureHits) {
      if (hit.creature === undefined) continue;
      const c = game.creatures.get(hit.creature);
      if (!c || c.mode !== 'wild' || c.health <= 0 || (c.enemy !== PLAYER_ATTACKER && c.id !== marked)) continue;
      const k = Math.max(0, Math.min(1, c.health / maxHealth(c, game.creatures.species(c))));
      const bw = 34 * zoom;
      const bh = Math.max(3, 4 * zoom);
      const bx = hit.left + hit.w / 2 - bw / 2;
      const by = hit.top - bh - 3 * zoom;
      ctx.fillStyle = 'rgba(12, 8, 6, 0.75)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = k > 0.5 ? inkOr('good', '#7cc46a') : k > 0.25 ? inkOr('warn', '#e0b44a') : inkOr('bad', '#e2553c');
      ctx.fillRect(bx, by, bw * k, bh);
      if (c.id === marked) {
        ctx.strokeStyle = 'rgba(255, 220, 140, 0.9)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx - 2.5, by - 2.5, bw + 5, bh + 5);
      }
    }
    // The swing or the draw in hand, filling round your feet as it comes.
    const a = game.action;
    if (a && isFightJob(a.def.id) && a.state === 'performing' && this.feetAt) {
      const k = Math.max(0, Math.min(1, a.elapsed / Math.max(0.001, a.duration)));
      const rx = 0.5 * Math.SQRT2 * HALF_W * zoom;
      const ry = 0.5 * Math.SQRT2 * HALF_H * zoom;
      ctx.lineWidth = Math.max(2, 3 * zoom);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(this.feetAt.x, this.feetAt.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 214, 120, 0.95)';
      ctx.beginPath();
      ctx.ellipse(this.feetAt.x, this.feetAt.y, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
      ctx.stroke();
    }
    // A bow being drawn: the line to what it is drawn on, filling as the draw comes up,
    // in amber while it is within the bow's range and grey once it is not.
    if (a && a.def.id === 'shoot_creature' && a.state === 'performing' && a.target.kind === 'creature' && this.feetAt) {
      const t = game.creatures.get(a.target.id);
      if (t) {
        const k = Math.max(0, Math.min(1, a.elapsed / Math.max(0.001, a.duration)));
        const tx = cam.worldToScreenX(t.x, t.y);
        const ty = cam.worldToScreenY(t.x, t.y, w.heightAt(t.x, t.y));
        const fx = this.feetAt.x;
        const fy = this.feetAt.y;
        const inRange = inFightReach(game, 'shoot_creature', t);
        ctx.lineWidth = Math.max(1, 1.5 * zoom);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.lineWidth = Math.max(2, 2.5 * zoom);
        ctx.strokeStyle = inRange ? 'rgba(255, 214, 120, 0.95)' : 'rgba(170, 170, 170, 0.8)';
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + (tx - fx) * k, fy + (ty - fy) * k);
        ctx.stroke();
      }
    }
    // Your companion's fight: a line from it to what it is going for.
    ctx.setLineDash([5 * zoom, 4 * zoom]);
    for (const c of game.creatures.list.values()) {
      if (c.mode !== 'active' || c.mine === false || c.enemy === null || c.enemy === PLAYER_ATTACKER) continue;
      const e = game.creatures.get(c.enemy);
      if (!e) continue;
      const cx = cam.worldToScreenX(c.x, c.y);
      const cy = cam.worldToScreenY(c.x, c.y, w.heightAt(c.x, c.y));
      const ex = cam.worldToScreenX(e.x, e.y);
      const ey = cam.worldToScreenY(e.x, e.y, w.heightAt(e.x, e.y));
      ctx.lineWidth = Math.max(1.5, 2 * zoom);
      ctx.strokeStyle = 'rgba(120, 190, 255, 0.85)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.fillStyle = 'rgba(120, 190, 255, 0.95)';
      ctx.beginPath();
      ctx.arc(ex, ey, Math.max(2.5, 3.5 * zoom), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.setLineDash([]);
    // How far a hunter under the cursor will notice you from.
    const hc = this.hover?.creature !== undefined ? game.creatures.get(this.hover.creature) : undefined;
    if (hc && hc.mode === 'wild' && hc.enemy !== PLAYER_ATTACKER && game.creatures.species(hc).hunter) {
      const r = (game.creatures.species(hc).notice ?? HUNT_SIGHT) * game.awareNotice();
      const sx = cam.worldToScreenX(hc.x, hc.y);
      const sy = cam.worldToScreenY(hc.x, hc.y, w.heightAt(hc.x, hc.y));
      ctx.setLineDash([6 * zoom, 5 * zoom]);
      ctx.lineWidth = Math.max(1.5, 2 * zoom);
      ctx.strokeStyle = 'rgba(232, 150, 60, 0.85)';
      ctx.beginPath();
      ctx.ellipse(sx, sy, r * Math.SQRT2 * HALF_W * zoom, r * Math.SQRT2 * HALF_H * zoom, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // An arrow at the edge of the view for everything after you that is out of it.
    const m = 26;
    for (const c of game.creatures.list.values()) {
      if (c.mode !== 'wild' || c.health <= 0 || c.enemy !== PLAYER_ATTACKER) continue;
      const sx = cam.worldToScreenX(c.x, c.y);
      const sy = cam.worldToScreenY(c.x, c.y, w.heightAt(c.x, c.y));
      if (sx >= m && sx <= W - m && sy >= m && sy <= H - m) continue;
      const dx = sx - W / 2;
      const dy = sy - H / 2;
      const t = Math.min((W / 2 - m) / Math.max(1e-6, Math.abs(dx)), (H / 2 - m) / Math.max(1e-6, Math.abs(dy)));
      const ax = W / 2 + dx * t;
      const ay = H / 2 + dy * t;
      const ang = Math.atan2(dy, dx);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = inkOr('bad', 'rgba(226, 70, 50, 0.92)', 0.92);
      ctx.strokeStyle = 'rgba(20, 8, 6, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }
    // Struck: the edge of the view reddens for the length of the flash.
    const struck = this.flashOf(game.player.attackedAt, false);
    if (struck > 0) {
      const glow = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.72);
      glow.addColorStop(0, inkOr('bad', 'rgba(190, 28, 18, 0)', 0));
      glow.addColorStop(1, inkOr('bad', `rgba(190, 28, 18, ${(0.42 * struck).toFixed(3)})`, 0.42 * struck));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  /** The stepping stones of the line of the ground just drawn, over its water, each one out in the sea cut out of the sea the swell goes over. */
  private stonesOnLine(ctx: CanvasRenderingContext2D): void {
    const world = this.game.world;
    if (this.stoneRowDim.length) drawStones(ctx, this.camera, world, this.stoneRowDim, this.anim, false, this.seaPath);
    if (this.stoneRow.length) drawStones(ctx, this.camera, world, this.stoneRow, this.anim, true, this.seaPath);
    this.stoneRow.length = 0;
    this.stoneRowDim.length = 0;
  }

  /**
   * The height a piece stands at: the ground under it, or for a hull the
   * water she floats on. A boat is drawn from her waterline up, so she sits
   * on the surface however deep it is under her rather than on the bottom.
   */
  /**
   * The people on a hull: whoever has her helm and whoever is aboard as a
   * passenger, us among them. Each is drawn at their own place on her,
   * lifted to it: the helm to `seat`, sat in her middle or on their feet on a
   * deck of its own, and the passengers on their feet at her waist.
   *
   * And each is drawn among her, not over her. A hull with a deck of her own
   * is baked in layers split where each place on her comes in the order her
   * parts are drawn (`crewOf`, `crewOrder`), and whoever stands at a place
   * goes between the layer before it and the one after: a fore course nearer
   * you than the waist is drawn over the people in the waist, and the mizzen
   * behind them under. Everybody sorts a hair after her, and in that order.
   * Any other hull is one picture with its people after it, as they come.
   */
  private readonly seated = new Set<string>();
  /** The wildermon whose rider is drawn on its saddle this frame, by id: one a rider, and none for a rider seated on a hull or a wagon. */
  private readonly saddled = new Set<number>();
  /** The hull with a deck of her own that I have the helm of, this frame. */
  private helming: PlacedFurniture | null = null;
  /** Where the player is drawn on a spiral staircase this frame, and how far up its storey, for the way the body faces climbing it (`spiralBody`). */
  private spiralLift: { turn: number; t: number } | null = null;
  /** Where the player stands on a spiral staircase's tile on the screen this frame, and what the body sorts by: what of the stair in front of it goes see-through round it. */
  private spiralSeen: { tx: number; ty: number; x: number; y: number; key: number } | null = null;
  private takeAboard(f: PlacedFurniture, fe: Entity, x: number, y: number, zoom: number): void {
    const boat = furnitureDef(f.kind).boat;
    if (!boat) {
      /*
       * Somebody else on the reins of a cart or a wagon: sat on her box as I am on mine, and rocked with her. They were
       * left out of the people on the island for being at her reins, and drawn nowhere.
       */
      const peer = f.helm && reinsTo(f.kind) ? this.game.roster.list().find((p) => p.uid === f.helm) : undefined;
      if (!peer) return;
      const e = this.take('peer', x, y, fe.sx, fe.sy + 0.01, null);
      e.peer = peer;
      this.seatOn(e, f, zoom, this.cartRoll(f) ?? CART_LEVEL);
      e.sway = this.cartSwayOf(f, fe.sx, fe.sy, zoom);
      return;
    }
    const waist = boat.waist ?? boat.seat;
    const me = this.game.player;
    const sway = this.swayOf(f, fe, zoom);
    fe.sway = sway?.screen;
    const swayed = (e: Entity): Entity => {
      e.sway = sway?.screen;
      return e;
    };
    // Who is where: place 0 is her helm, and a passenger's place is their seat.
    const hands: Array<{ spot: number; take: (sy: number) => void }> = [];
    const aboard = (uid: string, spot: number, at: (peer: Peer) => [number, number], deck: number, standing: boolean): void => {
      const peer = this.game.roster.list().find((p) => p.uid === uid);
      if (!peer) return;
      hands.push({ spot, take: (sy) => {
        const e = swayed(this.take('peer', x, y, fe.sx, sy, null));
        e.peer = peer;
        this.onDeck(e, f, at(peer), deck * zoom, standing);
        // Whoever has the helm of a boat with no deck of its own to stand at it is sat at her oars or her tiller.
        if (spot === 0 && !standing) this.seatOn(e, f, zoom, sway?.at);
      } });
    };
    if (f.helm) aboard(f.helm, 0, () => this.game.helmSpot(f), boat.seat, !!boat.helm);
    if (this.helming === f) hands.push({ spot: 0, take: (sy) => {
      const e = swayed(this.take('player', x, y, fe.sx, sy, null));
      this.onDeck(e, f, this.game.helmSpot(f), boat.seat * zoom, !!boat.helm);
      // A helm with nowhere to stand at it is sat at, at her tiller, as when she had no layers.
      if (!boat.helm) this.seatOn(e, f, zoom, sway?.at);
    } });
    if (me.aboard === f.id) hands.push({ spot: me.seat ?? 0, take: (sy) => this.onDeck(swayed(this.take('player', x, y, fe.sx, sy, null)), f, [me.x, me.y], waist * zoom, true) });
    for (const r of f.riders ?? []) aboard(r.who, r.seat, (peer) => this.game.roster.drawnAt(peer), waist, true);

    const crew = crewOf(f.kind);
    const HAIR = 0.01;
    if (!crew || !fe.view) {
      hands.forEach((h, i) => h.take(fe.sy + HAIR * (i + 1)));
      return;
    }
    const order = crewOrder(zoom, f.kind, !!f.lit, dyeOf(f) ?? undefined, this.pieceTrim(f), fe.view, f.material, crew, this.manned(f));
    fe.layer = 0;
    order.forEach((spot, n) => {
      for (const h of hands) if (h.spot === spot) h.take(fe.sy + HAIR * (2 * n + 1));
      const le = swayed(this.take('hull', x, y, fe.sx, fe.sy + HAIR * (2 * n + 2), null));
      le.piece = f;
      le.view = fe.view;
      le.layer = n + 1;
      // Drawn where she is, whatever it sorts as.
      le.drawDy = -HAIR * (2 * n + 2);
    });
    // Anybody at a place she has no stand-in for goes over the lot.
    for (const h of hands) if (!order.includes(h.spot)) h.take(fe.sy + HAIR * (2 * order.length + 1));
  }

  /**
   * Somebody driving `f`, sat where its driver sits (`driverOn`): their feet
   * put that far from wherever they are drawn from now, and lifted to the
   * floor under the seat, which is what makes them a driver.
   */
  private seatOn(e: Entity, f: PlacedFurniture, zoom: number, sway?: { heel: number; pitch: number }): void {
    const d = driverOn(f.kind, this.viewOf(f));
    if (!d) return;
    e.lift = d.lift * zoom;
    e.drawDx = (e.drawDx ?? 0) + d.dx * zoom;
    e.drawDy = (e.drawDy ?? 0) + d.dy * zoom + e.lift;
    // A tiller in hand is of her wood; and the body balances against however she is heeled this moment.
    e.seat = d.seat.pivot || sway ? { ...d.seat, wood: d.seat.pivot ? woodHex(f.material) : undefined, sway } : d.seat;
    e.seatFacing = d.facing;
  }

  /** Whether somebody has `f`'s tiller in hand, which is then drawn with them rather than in her. */
  private manned(f: PlacedFurniture): boolean {
    return steeredByTiller(f.kind) && (!!f.helm || this.helming === f);
  }

  /**
   * How a boat steered by a tiller sits on the water this frame
   * (`boatSway` in `./furniture`), and that as a change to the screen about
   * where she is drawn, for her and everybody aboard her. Under sail is let
   * come on and off over a second or two, as she gathers way and loses it.
   */
  private readonly swaying = new Map<number, { under: number; seen: number }>();
  private swayOf(f: PlacedFurniture, fe: Entity, zoom: number): { at: { heel: number; pitch: number }; screen: NonNullable<Entity['sway']> } | null {
    if (!steeredByTiller(f.kind) || !fe.view) return null;
    const helm = this.helming === f ? this.game.player : f.helm ? this.game.roster.list().find((p) => p.uid === f.helm) : undefined;
    const going = helm?.moving ? 1 : 0;
    let w = this.swaying.get(f.id);
    if (!w || this.time - w.seen > 1) {
      w = { under: going, seen: this.time };
      this.swaying.set(f.id, w);
      if (this.swaying.size > 64) for (const [k, v] of this.swaying) if (this.time - v.seen > 10) this.swaying.delete(k);
    }
    const dt = Math.max(0, Math.min(0.1, this.time - w.seen));
    w.under += Math.max(-dt / 1.6, Math.min(dt / 1.6, going - w.under));
    w.seen = this.time;
    // Heeled to the side her sail is out on: the other side from the wind's, which is the sign of her trim.
    const lee = (this.pieceTrim(f) ?? 0.25) < 0 ? 1 : -1;
    const s = boatSway(this.anim, w.under, lee, (f.id * 7.31) % 97);
    return { at: { heel: s.heel, pitch: s.pitch }, screen: { ox: fe.sx, oy: fe.sy, ...swayOnScreen(fe.view, s, zoom) } };
  }

  /** Whoever has the reins of `f`: me, or somebody else on the island, while they hold them. */
  private driverOf(f: PlacedFurniture): { moving: boolean; walkPhase: number } | undefined {
    if (f.driven) return this.game.player;
    return f.helm ? this.game.roster.list().find((p) => p.uid === f.helm) : undefined;
  }

  /**
   * A cart or a wagon on the move, rocking and bumping on the track as her
   * driver does (`cartSway` in `./figure`, at their clock), as a change to the
   * screen about her floor contact, for her and her driver both. Nothing for
   * one stood still.
   */
  private cartSwayOf(f: PlacedFurniture, ox: number, oy: number, zoom: number): Swayed | undefined {
    const s = this.cartRoll(f);
    if (!s) return undefined;
    const def = furnitureDef(f.kind);
    return { ox, oy, ...swayOnScreen(this.viewOf(f), s, zoom, def.w / Math.max(1, def.h)) };
  }

  /**
   * Her rock and bump this frame, let come on and die away over `CART_EASE` as her driver sets off and stops: she stopped
   * dead, the box jumping level in a frame. Counted on once a frame; and where she has stopped, her driver's clock is
   * held where it was, so she settles from the roll she had rather than rocking on while she does.
   */
  private readonly carting = new Map<number, { on: number; phase: number; seen: number }>();
  private cartRoll(f: PlacedFurniture): { heel: number; pitch: number; lift: number } | undefined {
    if (this.held) return undefined;
    const by = this.driverOf(f), going = by?.moving ? 1 : 0;
    let w = this.carting.get(f.id);
    if (!w || this.time - w.seen > 1) {
      if (!going) return undefined;
      w = { on: 0, phase: by!.walkPhase, seen: this.time };
      this.carting.set(f.id, w);
      if (this.carting.size > 64) for (const [k, v] of this.carting) if (this.time - v.seen > 10) this.carting.delete(k);
    }
    if (w.seen !== this.time) {
      const dt = Math.max(0, Math.min(0.1, this.time - w.seen));
      w.on += Math.max(-dt / CART_EASE, Math.min(dt / CART_EASE, going - w.on));
      w.seen = this.time;
    }
    if (going) w.phase = by!.walkPhase;
    if (w.on <= 0) return undefined;
    const s = cartSway(w.phase, true), k = w.on * w.on * (3 - 2 * w.on);
    return { heel: s.heel * k, pitch: s.pitch * k, lift: s.lift * k };
  }

  /**
   * How far round the wheels of a cart or a wagon are, and how blurred, as her `trim` (`wheelTrim` in `./furniture`):
   * from how far she has come, so they roll as far as she goes and stop where she stops. They stood still under a cart
   * going along a track; then they were let turn at most four spokes a second, so as not to strobe, and crept round while
   * she covered the ground at seven times that, skidding. Now they turn at the true rate, and above what a frame can show
   * (`WHEEL_BLUR`, from the spokes gone by in a frame, steadied) the spokes go to a blur and the strake on the felloe goes
   * round once a turn, which a frame always can. Counted on once a frame, however often she is drawn in it.
   */
  private readonly rolled = new Map<number, { x: number; y: number; turns: number; rate: number; at: number; dt: number; blur: number }>();
  private wheelTurn(f: PlacedFurniture): number | undefined {
    const w = WHEELS[f.kind];
    if (!w) return undefined;
    // Driven by somebody else, she is where their hands are, which is read a dozen times a second; where she was set down
    // is read once, so her wheels stood still under her while she went along, and a re-read over two tiles was not rolled.
    // Animations off: where they were, sharp.
    if (this.held) return wheelTrim(f.kind, this.rolled.get(f.id)?.turns ?? 0, 0);
    const [x, y] = f.helm ? this.game.hullCentre(f) : furnitureCentre(f);
    let r = this.rolled.get(f.id);
    if (!r) {
      r = { x, y, turns: 0, rate: 0, at: this.time, dt: this.frameDt, blur: 0 };
      this.rolled.set(f.id, r);
      if (this.rolled.size > 64) for (const [k, v] of this.rolled) if (this.time - v.at > 10) this.rolled.delete(k);
    }
    if (r.at !== this.time) {
      const d = Math.hypot(x - r.x, y - r.y) * UNITS_PER_TILE, dt = this.time - r.at;
      // A jump -- set down somewhere else, or seen again after a while -- is not rolled.
      const turns = d < 2 * UNITS_PER_TILE ? d / (2 * Math.PI * w.r) : 0;
      r.turns = (r.turns + turns) % 1;
      if (dt > 0 && dt < 0.5) {
        r.rate += (turns / dt - r.rate) * Math.min(1, dt / 0.15);
        // The length of a frame, steadied over a quarter of a second: frames come uneven, and taken one by one, a pace
        // near a line went sharp, half and whole blur from one frame to the next.
        r.dt += (dt - r.dt) * Math.min(1, dt / WHEEL_FRAME_EASE);
      } else r.rate = 0;
      r.x = x;
      r.y = y;
      r.at = this.time;
      r.blur = wheelBlur(r.rate * w.spokes * r.dt, r.blur);
    }
    return wheelTrim(f.kind, r.turns, r.blur);
  }

  /** Somebody on `f`, drawn at `wx`, `wy` on her rather than where they sort, `lift` up. */
  private onDeck(e: Entity, f: PlacedFurniture, [wx, wy]: [number, number], lift: number, standing: boolean): void {
    const cam = this.camera;
    e.drawDx = cam.worldToScreenX(wx, wy) - e.sx;
    e.drawDy = cam.worldToScreenY(wx, wy, this.pieceBase(f, wx, wy)) - e.sy;
    e.lift = lift;
    e.standing = standing;
  }

  /**
   * The reins of a beast in the traces: from where its head is drawn back to
   * the driver's box of the cart or wagon it is put to, at the height of the
   * driver's hands, hanging a little between -- two lines of leather, a pair to
   * each beast, as a team is driven. Drawn over the beast, so they are seen
   * coming off its head; the box, drawn after it where it stands in front,
   * takes their other end.
   */
  private drawReins(ctx: CanvasRenderingContext2D, cr: Creature, sx: number, sy: number, facing: number, big: number, zoom: number): void {
    const f = cr.hitchedTo !== null ? this.game.furniture.get(cr.hitchedTo) : undefined;
    const to = f && reinsTo(f.kind);
    if (!f || !to) return;
    const cam = this.camera;
    // At the stage it is drawn at: a Haulhorn's head is not where its Cartling's was.
    const stage = stageOf(cr);
    const head = wildermonHead(cr.species, facing, stage) ?? [0, -(wildermonTop(cr.species, stage) ?? 20) * 0.8];
    const hx = sx + head[0] * zoom * big, hy = sy + head[1] * zoom * big;
    // The driver's hands: over the front of the box, toward the team, where the seat is.
    const [cx, cy] = furnitureCentre(f);
    const dx = cr.x - cx, dy = cr.y - cy, d = Math.hypot(dx, dy) || 1;
    // Where the driver's own reins come to (`Seat.grip`), so the two are one line.
    const wx = cx + (dx / d) * (to[0] / UNITS_PER_TILE), wy = cy + (dy / d) * (to[0] / UNITS_PER_TILE);
    const bx = cam.worldToScreenX(wx, wy);
    const by = cam.worldToScreenY(wx, wy, this.pieceBase(f, wx, wy)) - to[2] * HEIGHT_SCALE * zoom;
    // A pair a hand apart, sagging by a little of the length between.
    const nx = -(hy - by), ny = hx - bx, nl = Math.hypot(nx, ny) || 1;
    const sag = Math.min(14, Math.hypot(hx - bx, hy - by) * 0.12) * zoom;
    ctx.save();
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const ox = (nx / nl) * side * 1.1 * zoom, oy = (ny / nl) * side * 1.1 * zoom;
      const mx = (hx + bx) / 2 + ox, my = (hy + by) / 2 + oy + sag;
      for (const [ink, w] of [[REIN_LINE, 2.2], [REIN_LEATHER, 1.2]] as Array<[string, number]>) {
        ctx.strokeStyle = ink;
        ctx.lineWidth = Math.max(0.8, w * zoom * 0.6);
        ctx.beginPath();
        ctx.moveTo(bx + ox, by + oy);
        ctx.quadraticCurveTo(mx, my, hx + ox, hy + oy);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private pieceBase(f: { kind: string; level?: number }, wx: number, wy: number): number {
    // A wagon driven up a wide staircase stands on the floor of its storey, as a body up there does.
    const up = f.level ?? 0;
    if (up > 0) return this.footOn(wx, wy, up) + up * WALL_HEIGHT;
    const h = this.game.world.heightAt(wx, wy);
    // On a bridge's deck, or on the ground under it (`pieceOnDeck`).
    return furnitureDef(f.kind).boat ? Math.max(h, 0) : this.standTop(wx, wy, this.game.bridges.size > 0 && this.game.pieceOnDeck(f, Math.floor(wx), Math.floor(wy)));
  }

  /** Whether a tile stands on piers, for the pond painter (`WaterFrame.decked`). */
  private readonly pierOver = (x: number, y: number): boolean => this.game.buildings.onPiers(x, y);

  /**
   * How high a thing set down at a point stands: on the finished deck of a
   * tile on piers, on a poured slab, or on the deck of a bridge where it is set down on the deck (an outer
   * lane of a wide one, `deckLaneAt`, or `deck` as its caller has it), or on
   * the ground, which is under any other bridge's deck.
   */
  private standTop(wx: number, wy: number, deck = this.game.bridges.size > 0 && this.game.deckLaneAt(Math.floor(wx), Math.floor(wy))): number {
    return (this.game.buildings.pierTiles.size ? this.game.pierDeckAt(Math.floor(wx), Math.floor(wy)) : null)
      ?? (this.game.foundations.size ? this.game.dryTop(Math.floor(wx), Math.floor(wy)) : null)
      ?? (deck ? this.game.deckHeightAt(wx, wy) : null) ?? this.game.world.heightAt(wx, wy);
  }

  /**
   * Whether somebody other than the player, or a creature, is under a
   * bridge's deck rather than on it, as the player's own `underDeck` is
   * kept: off the tile they were on before (`Game.underAfter`), remembered
   * from frame to frame by `key`; in under it from wherever they were first
   * seen (`from`); and always, at the water's height (`low`), swimming.
   */
  private bodyUnder(key: string, x: number, y: number, from?: [number, number], low = false): boolean {
    if (this.underFrame !== this.frameNo) {
      this.underFrame = this.frameNo;
      this.underWas = this.underNow;
      this.underNow = new Map();
    }
    const had = this.underNow.get(key) ?? this.underWas.get(key);
    let under = false;
    if (this.game.onWalkedDeck(x, y)) {
      if (low) under = true;
      else if (had) under = had.x === x && had.y === y ? had.under : this.game.underAfter(had.x, had.y, x, y, had.under);
      else if (from && (from[0] !== x || from[1] !== y)) under = this.game.underAfter(from[0], from[1], x, y, false);
    }
    this.underNow.set(key, { x, y, under });
    return under;
  }
  private underFrame = -1;
  private underWas = new Map<string, { x: number; y: number; under: boolean }>();
  private underNow = new Map<string, { x: number; y: number; under: boolean }>();

  /** Something standing at a point on a bridge's walked deck sorts among the bridge's pieces as standing on it (`deckKey`). */
  private onBridgeDeck(ent: Entity, wx: number, wy: number): void {
    if (!this.game.bridges.size) return;
    const x = Math.floor(wx), y = Math.floor(wy);
    if (!this.game.onWalkedDeck(x, y) || this.game.deckHeightAt(wx, wy) === null) return;
    ent.key = deckKey(this.bridgeFrame(), x, y);
  }

  /**
   * How high off the ground the player is sitting: the deck of whatever they
   * are driving, or nothing at all when they are on their own two feet.
   */
  private driverSeat(): number {
    const f = this.game.driving();
    if (f) return furnitureDef(f.kind).vehicle?.seat ?? furnitureDef(f.kind).boat?.seat ?? 0;
    const up = this.game.mounted();
    return up ? this.saddleSeat(up) : 0;
  }

  /** A mount's saddle: where its model has it at the stage it has come to, drawn up as the mount is by its age and rarity. */
  /**
   * How a rider sits on `up`: astride, the reins out to its bit where its model has it, drawn up as the mount is; the legs
   * drawn up as far as it says, or, on one whose model says nothing, as far as its back is low (`saddleTuck`).
   */
  private saddleOn(up: Creature): Seat {
    const own = wildermonSaddle(up.species, stageOf(up)), k = ageDef(up, this.game.time).scale * bodySize(up);
    return own ? { ...SADDLE, grip: [own.grip[0] * k, own.grip[1] * k, own.grip[2] * k], tuck: own.tuck } : { ...SADDLE, tuck: saddleTuck(this.saddleSeat(up)) };
  }

  private saddleSeat(up: Creature): number {
    return (wildermonSeat(up.species, stageOf(up)) ?? SPECIES[up.species]?.mount ?? 0) * ageDef(up, this.game.time).scale * bodySize(up);
  }

  /** Somebody else up on a wildermon, on the ground or a storey up a wide staircase, when they are here to be drawn on it. */
  private riderOf(c: Creature): Peer | undefined {
    const p = c.riderUid ? this.game.roster.byUid(c.riderUid) : undefined;
    return p && p.level >= 0 ? p : undefined;
  }

  /**
   * The scratch one entity is drawn on when it has to be tinted whole. Tinting
   * with a canvas filter costs per drawing operation, and a wildermon is forty
   * of them; on the scratch it is one. It is kept between frames and only
   * resized when the zoom outgrows it.
   */
  private tintPad: HTMLCanvasElement | null = null;
  private tintCtx: CanvasRenderingContext2D | null = null;

  /**
   * The scratch, at the screen's own resolution: a pixel of it is a device
   * pixel, so a copy of what was drawn on it is as sharp as the thing drawn
   * straight onto the screen, and can stand in for it (`paint`). `side` is
   * its size in CSS pixels, and (ox, oy) where the thing's feet go on it.
   */
  private scratch(zoom: number): { pad: HTMLCanvasElement; g: CanvasRenderingContext2D; ox: number; oy: number; side: number } {
    const dpr = this.canvas.dpr;
    const want = Math.ceil(124 * Math.max(1, zoom) * dpr);
    if (!this.tintPad || this.tintPad.width < want) {
      this.tintPad = document.createElement('canvas');
      this.tintPad.width = want;
      this.tintPad.height = want;
      this.tintCtx = this.tintPad.getContext('2d');
    }
    const g = this.tintCtx as CanvasRenderingContext2D;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.tintPad.width, this.tintPad.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const side = this.tintPad.width / dpr;
    return { pad: this.tintPad, g, ox: side / 2, oy: side * 0.78, side };
  }

  /** The ring round the thing under the cursor, put together off the screen and laid down in one go (`paint`). */
  private ringPad: HTMLCanvasElement | null = null;
  /** And a copy of the thing as it was drawn, laid over the ring rather than drawing the thing a second time. */
  private keepPad: HTMLCanvasElement | null = null;
  private sized(had: HTMLCanvasElement | null, w: number, h: number): HTMLCanvasElement {
    const c = had ?? document.createElement('canvas');
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    return c;
  }

  /**
   * A flat stamp of whatever was last drawn on the scratch: its silhouette,
   * in one colour. `source-atop` paints only where something is already
   * there, so the shape comes out of the drawing itself and nothing has to
   * know what shape a rabba is.
   */
  private stamp(colour: string): void {
    const pad = this.tintPad as HTMLCanvasElement;
    const g = this.tintCtx as CanvasRenderingContext2D;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = colour;
    g.fillRect(0, 0, pad.width, pad.height);
    g.restore();
  }

  /**
   * Draw one thing, plainly or lit up.
   *
   * A canvas filter would do both of these in a line, and costs per drawing
   * operation rather than per thing — a wildermon is some forty operations, so
   * a dozen of them flashing at once turned a frame into half a second. This
   * does the same work with a silhouette taken off a scratch canvas: white
   * over the top for a blow, and stamped eight ways round the outside for the
   * thing under the cursor, which is a real outline rather than a glow round
   * a box. A flash is white unless `colour` says otherwise: a spell's tint on
   * a creature (`SpellStage.tintOf`) is the same thing in its own colour.
   */
  private paint(
    ctx: CanvasRenderingContext2D,
    zoom: number,
    effect: 'none' | 'flash' | 'hover',
    power: number,
    sx: number,
    sy: number,
    draw: (g: CanvasRenderingContext2D, px: number, py: number) => void,
    colour = '#ffffff',
    box?: [number, number, number, number],
  ): void {
    // Kept for picking by its pixels, with any roll it is drawn under.
    const cm = ctx.getTransform(), base = this.paintBase;
    const rolled = base && (cm.a !== base.a || cm.b !== base.b || cm.c !== base.c || cm.d !== base.d || cm.e !== base.e || cm.f !== base.f);
    this.entPaints.push({ draw, sx, sy, m: rolled && base ? base.inverse().multiply(cm) : null, alpha: ctx.globalAlpha });
    /*
     * After dark, drawn after a runestone and falling on its runes (its own
     * box, left, top, width and height on the screen, when the caller knows
     * it): kept off them (`RunestoneNight`). Plainly drawn and small enough,
     * it is drawn once onto the pad and laid from there on the screen and on
     * the stone's keeping both; otherwise drawn again onto the keeping by
     * the same drawing, under the same transform and clips.
     */
    if (this.runeNight.keeping) {
      const [bx, by, bw, bh] = box ?? [sx - 90 * zoom, sy - 230 * zoom, 180 * zoom, 250 * zoom];
      if (this.runeNight.falls(ctx, bx, by, bw, bh)) {
        if (effect === 'none') {
          const { pad, g, ox, oy, side } = this.scratch(zoom);
          const m = ctx.getTransform();
          if (m.b === 0 && m.c === 0 && bx >= sx - ox && by >= sy - oy && bx + bw <= sx - ox + side && by + bh <= sy - oy + side) {
            // Its corner on a whole pixel of the screen, so it is laid down sharp, as it would have been drawn there.
            const fx = (((sx - ox) * m.a + m.e) % 1 + 1) % 1, fy = (((sy - oy) * m.d + m.f) % 1 + 1) % 1;
            const px = ox + fx / m.a, py = oy + fy / m.d;
            draw(g, px, py);
            ctx.drawImage(pad, sx - px, sy - py, side, side);
            this.runeNight.occlude(ctx, pad, sx - px, sy - py, side, side, this.occClips);
            return;
          }
        }
        this.runeNight.occludeDraw(ctx, bx, by, bw, bh, (g) => draw(g, sx, sy), this.occClips);
      }
    }
    if (effect === 'none') {
      draw(ctx, sx, sy);
      return;
    }
    const { pad, g, ox, oy, side } = this.scratch(zoom);
    draw(g, ox, oy);
    const left = sx - ox;
    const top = sy - oy;
    if (effect === 'flash') {
      ctx.drawImage(pad, left, top, side, side);
      this.stamp(colour);
      ctx.globalAlpha = Math.max(0, Math.min(1, power));
      ctx.drawImage(pad, left, top, side, side);
      ctx.globalAlpha = 1;
      return;
    }
    // The outline goes down first and the thing on top of it, so what shows is
    // the part of the ring that sticks out past the edges. The thing is kept
    // as it was drawn before the scratch is stamped, and the ring is put
    // together off the screen: two copies onto the screen, where there were
    // eight and the whole thing drawn over again.
    const dpr = this.canvas.dpr;
    const keep = (this.keepPad = this.sized(this.keepPad, pad.width, pad.height));
    const kg = keep.getContext('2d') as CanvasRenderingContext2D;
    kg.globalCompositeOperation = 'copy';
    kg.drawImage(pad, 0, 0);
    kg.globalCompositeOperation = 'source-over';
    this.stamp(HOVER_INK);
    const r = Math.max(1.6, 2.1 * zoom);
    const m = Math.ceil(r * dpr) + 1;
    const ring = (this.ringPad = this.sized(this.ringPad, pad.width + 2 * m, pad.height + 2 * m));
    const rg = ring.getContext('2d') as CanvasRenderingContext2D;
    rg.clearRect(0, 0, ring.width, ring.height);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      rg.drawImage(pad, m + Math.cos(a) * r * dpr, m + Math.sin(a) * r * dpr);
    }
    ctx.globalAlpha = 0.9;
    ctx.drawImage(ring, left - m / dpr, top - m / dpr, ring.width / dpr, ring.height / dpr);
    ctx.globalAlpha = 1;
    ctx.drawImage(keep, left, top, side, side);
  }

  /**
   * Fishing (a rod's cast, a net's drag) stood still: the way to the water the line or the net goes into, as the island
   * finds it (`castAt`), so the body faces it and the rod or the net is out over the water; none at any other job.
   */
  private castAim(): [number, number] | null {
    const g = this.game, a = g.action, p = g.player;
    if (!a || a.state !== 'performing' || p.moving || (a.def.id !== 'fish' && a.def.id !== 'drag_net') || a.target.kind !== 'tile') { this.castSpot = null; return null; }
    const k = this.castSpot, t = a.target;
    if (!k || k.began !== a.began || k.job !== a.def.id || k.x !== t.x || k.y !== t.y) {
      const spot = castAt(g, t.x, t.y, a.def.id === 'drag_net' ? netReach(g) : undefined);
      const dx = spot ? spot.x + 0.5 - p.x : 0, dy = spot ? spot.y + 0.5 - p.y : 0;
      this.castSpot = { began: a.began, job: a.def.id, x: t.x, y: t.y, at: Math.hypot(dx, dy) > 0.05 ? [dx, dy] : null };
    }
    return this.castSpot!.at;
  }

  /**
   * Which of the eight ways something heading (dx, dy) through the world is
   * turned, as the screen sees it.
   *
   * The heading put through the projection rather than the world angle
   * quantised: the projection squashes one axis and not the other, so a figure
   * walking north and one walking east do not leave at the same angle, and the
   * screen is what it is being drawn on.
   */
  /**
   * A blow landing on a body at (x, y) facing `facing`, stamped at `at` on the drawing clock (`FigurePose.flinch`):
   * how far through, where, and from where the creature that struck it stands, round from the body's front toward its
   * left, as the screen has the two; from ahead when nothing says what struck.
   */
  private flinchOf(at: number | undefined, where: string | undefined, by: number | undefined, x: number, y: number, facing: number, heavy = false): FigurePose['flinch'] {
    // (a heavy blow's a stumble back, `STUMBLE_SECS` long: `FigurePose.heavy`)
    const t = heavy ? stumbleAt(at, performance.now() / 1000) : flinchAt(at, performance.now() / 1000);
    if (t === undefined) return undefined;
    const c = by === undefined ? undefined : this.game.creatures.get(by);
    if (!c) return { t, where };
    const cam = this.camera, dx = c.x - x, dy = c.y - y, du = cam.rotateX(dx, dy), dv = cam.rotateY(dx, dy);
    return { t, where, from: Math.atan2((du - dv) * HALF_W, (du + dv) * HALF_H) - (facing * Math.PI) / 4 };
  }

  private facingOnScreen(dx: number, dy: number, was?: number): number {
    const cam = this.camera;
    const du = cam.rotateX(dx, dy);
    const dv = cam.rotateY(dx, dy);
    return facingOf((du - dv) * HALF_W, (du + dv) * HALF_H, was);
  }

  /** Save the context and clip it to `clip`, when there is one: the caller restores it after drawing. */
  private clipTo(ctx: CanvasRenderingContext2D, clip: Array<[number, number]> | undefined): void {
    if (!clip) return;
    if (this.runeNight.keeping) {
      // And on whatever keeps it off a runestone's runes (`paint`).
      const path = new Path2D();
      clip.forEach(([cx, cy], i) => (i ? path.lineTo(cx, cy) : path.moveTo(cx, cy)));
      path.closePath();
      this.occClips.push({ path, m: ctx.getTransform() });
    }
    ctx.save();
    ctx.beginPath();
    clip.forEach(([cx, cy], i) => (i ? ctx.lineTo(cx, cy) : ctx.moveTo(cx, cy)));
    ctx.closePath();
    ctx.clip();
  }

  /* ---- spells ---------------------------------------------------------------------- */

  /**
   * Where the feet of somebody sat in what they drive are drawn (`seatOn`: the floor under the seat, drawn at `ex`, `ey`
   * less its lift), in the world: for the effects at their oars (`./fx/rowing.ts`). Nothing for anybody not sat so.
   */
  private seatedAt(ent: Entity, ex: number, ey: number, zoom: number): { x: number; y: number; z: number } | undefined {
    if (!ent.seat || !(ent.lift && ent.lift > 0)) return undefined;
    const w = this.game.world, tx = Math.floor(ent.x), ty = Math.floor(ent.y);
    const z = (w.inBounds(tx, ty) ? this.drawnSurface(tx, ty) ?? w.heightAt(ent.x, ent.y) : 0) + ent.lift / (zoom * HEIGHT_SCALE);
    const p = this.camera.screenToWorld(ex, ey - ent.lift, z);
    return { x: p.x, y: p.y, z };
  }

  /** Where somebody a spell is cast by or at stands this frame, as the stage wants them; nothing when they are gone. */
  private spellBody(w: Who): SpellBody | null {
    const game = this.game;
    if (w.kind === 'player') {
      const p = game.player;
      const z = this.footOn(p.x, p.y, Math.max(0, p.level)) + Math.max(0, p.visualLevel) * WALL_HEIGHT;
      return personBody(p.x, p.y, z, this.playerFacing, 'player', {
        id: 'player', phase: p.moving ? p.walkPhase : this.anim * 6, moving: p.moving, gait: 0, facing: this.playerFacing, swimming: p.swimming, working: false,
        look: p.look, gear: gearFrom(wornWire((slot) => game.shown(slot))),
      });
    }
    if (w.kind === 'peer') {
      const peer = game.roster.get(w.id);
      if (!peer || peer.level < 0) return null;
      const [x, y] = game.roster.drawnAt(peer);
      const z = this.footOn(x, y, peer.level) + peer.level * WALL_HEIGHT;
      return personBody(x, y, z, peer.facing, 'peer', {
        id: 'o' + peer.id, phase: peer.moving ? peer.stepPhase : this.anim * 6, moving: peer.moving, facing: peer.facing, swimming: peer.swimming, working: !!peer.working, job: peer.act,
        look: peer.look, gear: peer.gear,
      });
    }
    const cr = game.creatures.get(w.id);
    if (!cr || cr.health <= 0 || !inWorld(cr)) return null;
    const def = SPECIES[cr.species] ?? SPECIES.rabba;
    const big = ageDef(cr, game.time).scale * bodySize(cr);
    const tall = Math.max(22 * bodySize(cr), (wildermonTop(def.id) ?? 0) * big) / HEIGHT_SCALE;
    return {
      x: cr.x, y: cr.y, z: game.laidOver(Math.floor(cr.x), Math.floor(cr.y)) ?? this.footAt(cr.x, cr.y), tall, wide: creatureWide(def.id) * bodySize(cr),
      facing: this.beastFacing.get(cr.id) ?? 0, kind: 'creature', species: def.id, reach: beastReach(def),
      tame: cr.mode !== 'wild', companion: cr.mode === 'active', hostile: cr.enemy !== null,
      // What is on it that the payload says: a burn or a bleed still running, a trap holding it.
      burning: (cr.burnUntil ?? 0) > game.time, bleeding: cr.bleedRate > 0 && cr.bleedUntil > game.time, held: cr.trapped != null,
    };
  }

  /** Everybody and everything within `r` tiles of a point, for an area spell to find what it covers (`FxScene.bodiesWithin`). */
  private spellsNear(x: number, y: number, r: number): SpellBody[] {
    const game = this.game;
    const out: SpellBody[] = [];
    const add = (w: Who, wx: number, wy: number): void => {
      // A little over, for a body's middle moving on before the stage measures it again.
      if (Math.hypot(wx - x, wy - y) > r + 0.5) return;
      const b = this.spellBody(w);
      if (!b) return;
      b.who = w;
      out.push(b);
    };
    add(PLAYER_CASTS, game.player.x, game.player.y);
    for (const peer of game.roster.list()) {
      const [px, py] = game.roster.drawnAt(peer);
      add({ kind: 'peer', id: peer.id }, px, py);
    }
    for (const cr of game.creatures.list.values()) add({ kind: 'creature', id: cr.id }, cr.x, cr.y);
    return out;
  }

  /** How far off where they stand somebody is drawn while a spell carries them (`SpellStage.shiftOf`), in the screen's pixels. */
  private spellShift(w: Who): [number, number] {
    const sh = this.spells.shiftOf(w);
    if (!sh) return [0, 0];
    const cam = this.camera;
    return [cam.worldToScreenX(sh.x, sh.y) - cam.worldToScreenX(0, 0), cam.worldToScreenY(sh.x, sh.y, 0) - cam.worldToScreenY(0, 0, 0)];
  }

  /** Somebody turned to face what they are casting at, unless they are walking somewhere. */
  private spellTurn(w: Who, x: number, y: number): void {
    const game = this.game;
    const who = w.kind === 'player' ? game.player : w.kind === 'peer' ? game.roster.get(w.id) : undefined;
    if (!who || who.moving) return;
    const dx = x - who.x, dy = y - who.y, l = Math.hypot(dx, dy);
    if (l < 0.05) return;
    who.dirX = dx / l;
    who.dirY = dy / l;
  }

  /**
   * Play a spell's drawing from you, with no island and nothing done: for
   * checking how a spell looks (`wildermon.spell` in the console). At what is
   * under the cursor -- a creature, somebody, the ground -- unless told, or
   * at yourself for a spell cast only on yourself. Nothing is sent to anybody.
   * `from` plays it as though the island had just moved you there from that
   * spot (a Lunge); `companion` as though that creature were your companion.
   * What it did is worked out by the island's rules from who stands where
   * (`guessTold`): whom an area reaches, a monster's share of a hold; and a
   * spell the island would refuse on what it is aimed at is not played.
   */
  playSpell(spell: string, at?: CastAt, opts: { from?: { x: number; y: number }; companion?: number } = {}): boolean {
    const info = spellInfo(spell);
    const hover = this.hover;
    const p = this.game.player;
    let aim: CastAt;
    if (info && info.on.length === 1 && info.on[0] === 'self') aim = { kind: 'self' };
    else if (at) aim = at;
    else if (hover?.creature !== undefined) aim = { kind: 'creature', id: hover.creature };
    else if (hover?.peer !== undefined) {
      const peer = this.game.roster.list().find((q) => q.uid === hover.peer);
      aim = peer ? { kind: 'peer', id: peer.id } : { kind: 'self' };
    } else if (hover) aim = { kind: 'spot', x: hover.wx, y: hover.wy };
    else aim = { kind: 'spot', x: p.x + p.dirX * 3, y: p.y + p.dirY * 3 };
    const to = this.spellAim(aim);
    const standing = (w: Who | undefined, b: SpellBody | null): Standing | null =>
      w && b ? { who: w, x: b.x, y: b.y, kind: b.kind, species: b.species, tame: b.tame, hostile: b.hostile } : null;
    const me = standing(PLAYER_CASTS, this.spellBody(PLAYER_CASTS));
    if (!me) return false;
    const centre = to.kind === 'spot' ? to : me;
    const near = this.spellsNear(centre.x, centre.y, (info?.radius ?? 0) + (info?.fx.wide ?? 0) + 2)
      .map((b) => standing(b.who, b)).filter((q): q is Standing => !!q);
    const told = guessTold(spell, me, to.kind === 'spot' ? to : to.kind === 'self' ? null : standing(to, this.spellBody(to)), near);
    if (!told) return false;
    return this.spells.play(spell, PLAYER_CASTS, to, { mine: true, ...opts, told });
  }

  /** What the island said a cast did, as the stage takes it: everybody it reached by who they are on the screen. */
  private spellTold(t: CastTold): Told {
    const hit: Array<Told['hit'][number]> = [];
    for (const h of t.hit) {
      const at = this.spellAim(h.at);
      if (at.kind === 'spot' || at.kind === 'self') continue;
      hit.push({ who: at, ...(h.secs !== undefined ? { secs: h.secs } : {}), ...(h.held ? { held: true } : {}) });
    }
    return { hit, used: t.used, size: t.size, low: t.low };
  }

  /** What a cast was at, as the stage takes it. */
  private spellAim(at: CastAt): Aim {
    switch (at.kind) {
      case 'self': return { kind: 'self' };
      case 'you': return { kind: 'player' };
      case 'peer': return { kind: 'peer', id: at.id };
      case 'creature': return { kind: 'creature', id: at.id };
      case 'spot': return { kind: 'spot', x: at.x, y: at.y };
    }
  }

  private drawEntities(ctx: CanvasRenderingContext2D, zoom: number): void {
    const ents = this.ents;
    // Within a diagonal, whatever stands lower on screen is nearer the viewer.
    if (ents.length > 1) ents.sort((a, b) => (a.key ?? a.sy) - (b.key ?? b.sy) || a.sx - b.sx || (a.lift ?? 0) - (b.lift ?? 0));
    const player = this.game.player;
    // Round a spiral staircase's post, the way the climb goes round it, the stair turned as it is drawn (`spiralBody`).
    const lifting = player.lifting && this.spiralLift;
    const [fdx, fdy] = lifting ? spiralHeading(this.spiralLift!.t, player.lifting!.to > player.lifting!.from, this.spiralLift!.turn) : this.castAim() ?? [player.dirX, player.dirY];
    this.playerFacing = this.facingOnScreen(fdx, fdy, this.playerFacing);
    /*
     * What stands still on the ground under a jetty is behind the jetty's
     * floor (`underJetty`), cut out of it until the next thing is drawn.
     * Whoever and whatever moves about under one is drawn whole, as before:
     * a body, a beast, a bird is looked for, and under a floor that deep
     * would be lost.
     */
    let behind = false, swayed = false;
    this.paintBase = ctx.getTransform();
    for (const ent of ents) {
      this.footShown();
      this.entPaints.length = 0;
      if (swayed) {
        ctx.restore();
        swayed = false;
      }
      if (behind) {
        ctx.restore();
        behind = false;
      }
      this.occClips.length = 0;
      // Drawn in front of something whose foot is to be drawn again over the ground in front: drawn again after that foot (`footShy`).
      if (this.feet.length && ent.kind !== 'life' && ent.kind !== 'spell') this.footShy(ent, zoom);
      const under = ent.kind === 'life' || ent.kind === 'spell' || ent.kind === 'player' || ent.kind === 'peer' || ent.kind === 'creature' ? null : this.underJetty(ent);
      if (under) {
        ctx.save();
        ctx.clip(under, 'evenodd');
        behind = true;
        if (this.runeNight.keeping) this.occClips.push({ path: under, m: ctx.getTransform(), rule: 'evenodd' });
      }
      // A boat on the water, and whoever is aboard her, drawn as she rolls and pitches (`swayOf`).
      if (ent.sway) {
        swayIn(ctx, ent.sway);
        swayed = true;
      }
      if (ent.kind === 'life') {
        if (ent.mote) this.life.draw(ctx, ent.mote);
        continue;
      }
      if (ent.kind === 'spell') {
        if (ent.fx) this.spells.drawItem(ctx, ent.fx);
        continue;
      }
      // Being hit beats being pointed at: a blow should read as a blow even
      // while the cursor is sitting on the thing taking it.
      const hovering = this.isHovered(ent);
      if (ent.kind === 'player') {
        const struck = this.flashOf(player.attackedAt);
        // Carried from where a spell found you to where the island put you (a Lunge), while its cast plays.
        const [shx, shy] = this.spellShift(PLAYER_CASTS);
        const ex = ent.sx + (ent.drawDx ?? 0) + shx, ey = ent.sy + (ent.drawDy ?? 0) + shy;
        // Where your feet are on the screen, for the ring the swing in hand is drawn as (`drawFight`).
        this.feetAt = { x: ex, y: ey - (ent.lift ?? 0) };
        this.clipTo(ctx, ent.clip);
        const figBox: [number, number, number, number] = [ex - 34 * zoom, ey - (ent.lift ?? 0) - (FIGURE_TOP + 14) * zoom, 68 * zoom, (FIGURE_TOP + 22) * zoom];
        this.paint(ctx, zoom, struck > 0 ? 'flash' : 'none', struck * 0.75, ex, ey - (ent.lift ?? 0), (g, px, py) =>
          drawPlayer(g, px, py, zoom, this.actionFx.seen({
            id: 'player',
            phase: player.moving ? player.walkPhase : this.anim * 6,
            // On a deck it is the hull that is going somewhere, not the feet.
            moving: player.moving && !ent.standing,
            gait: this.gaits.of('player', player.x, player.y, this.frameDt),
            // (on a ladder, faced to it: `ladderbody.ts`)
            facing: ent.seatFacing ?? (ent.ladder?.climb !== undefined ? this.facingOnScreen(ent.ladder.dirX, ent.ladder.dirY, this.playerFacing) : this.playerFacing),
            swimming: player.swimming,
            working: this.game.action?.state === 'performing',
            // What at: meditating is done sat on the ground rather than at the bench (`FigurePose.job`).
            job: this.game.action?.def.id,
            // How far into its go, and how long a go takes, for a clip fitted to it (`FigurePose.act`).
            act: this.game.action?.state === 'performing' ? { t: this.game.wallNow() - (this.game.action.began ?? this.game.wallNow()), length: this.game.action.duration } : undefined,
            driving: (ent.lift ?? 0) > 0 && !ent.standing,
            seat: ent.seat,
            look: player.look,
            // Everything on, each piece drawn in its own material, dye and rarity.
            gear: enchantedFrom(gearFrom(wornWire((slot) => this.game.shown(slot))), (slot) => this.game.shown(slot)?.enchant),
            // The tool the job in hand uses (the best of its kind in the pack, `Inventory.tool`), in its own metal.
            tool: this.game.action?.state === 'performing' && this.game.action.def.tool ? toolPiece(this.game.inventory.tool(this.game.action.def.tool)) : undefined,
            // Both clocks here are `performance.now()`: the one the emote was
            // stamped on and the one the frames are drawn on.
            emote: player.emote,
            emoteT: emoteAt(player.emote, player.emoteAt, performance.now() / 1000) ?? undefined,
            cast: this.spells.poseOf(PLAYER_CASTS),
            block: blockAt(player.blockedAt, performance.now() / 1000),
            flinch: this.flinchOf(player.hurtAt, player.hurtWhere, player.hurtBy, player.x, player.y, ent.seatFacing ?? this.playerFacing, !!player.hurtHeavy),
            // knocked down, on a ladder, a heavy blow (`../sculpt/anim/clips/down-ko.ts`, `ladder.ts`, `stumble.ts`)
            ...(this.game.lying() ? { down: true } : {}),
            ...(ent.ladder?.climb !== undefined ? { climb: { h: ent.ladder.climb } } : {}),
            ...(player.hurtHeavy ? { heavy: true } : {}),
            veil: this.spells.veilOf(PLAYER_CASTS),
          }, this.seatedAt(ent, ex, ey, zoom))),
          undefined,
          figBox,
        );
        if (ent.clip) ctx.restore();
        // What this body last said, over its own head. No name drawn under it,
        // so the bubble sits where a peer's name would be.
        const mine = this.game.saidAloud;
        if (mine) this.words(ctx, ent.sway, ex, ey - (ent.lift ?? 0) - FIGURE_TOP * zoom, (x, y) => this.speechBubble(ctx, zoom, x, y, mine.text, mine.at));
        continue;
      }
      if (ent.kind === 'peer' && ent.peer) {
        const peer = ent.peer;
        // Somebody on a deck is drawn at their place on it, lifted to it; see `takeAboard`.
        const [shx, shy] = this.spellShift({ kind: 'peer', id: peer.id });
        const ex = ent.sx + (ent.drawDx ?? 0) + shx, ey = ent.sy + (ent.drawDy ?? 0) - (ent.lift ?? 0) + shy;
        // The same box a creature catches clicks with, because it is the same
        // figure at the same size. Without one, the only thing you could ever
        // do to another person was walk to the tile they were standing on.
        if (peer.uid) {
          const [hx, hy] = swayedAt(ent.sway, ex, ey);
          this.peerHits.push({ x: ent.x, y: ent.y, left: hx - 10 * zoom, top: hy - (FIGURE_TOP - 2) * zoom, w: 20 * zoom, h: FIGURE_TOP * zoom, peer: peer.uid });
        }
        peer.facing = ent.ladder?.climb !== undefined ? this.facingOnScreen(ent.ladder.dirX, ent.ladder.dirY, peer.facing) : this.facingOnScreen(peer.dirX, peer.dirY, peer.facing);
        this.clipTo(ctx, ent.clip);
        const peerBox: [number, number, number, number] = [ex - 34 * zoom, ey - (FIGURE_TOP + 14) * zoom, 68 * zoom, (FIGURE_TOP + 22) * zoom];
        this.paint(ctx, zoom, hovering ? 'hover' : 'none', 0, ex, ey, (g, px, py) =>
          drawPlayer(g, px, py, zoom, this.actionFx.seen({
            id: 'o' + peer.id,
            // On their own feet the ground they cover times their stride (`stepPhase`); on a seat, the clock times its rock.
            phase: peer.moving ? ((ent.lift ?? 0) > 0 && !ent.standing ? peer.walkPhase : peer.stepPhase) : this.anim * 6,
            moving: peer.moving && !ent.standing,
            gait: this.gaits.of('o' + peer.id, peer.x, peer.y, this.frameDt),
            facing: ent.seatFacing ?? peer.facing,
            swimming: peer.swimming,
            working: peer.working,
            job: peer.act,
            driving: (ent.lift ?? 0) > 0 && !ent.standing,
            seat: ent.seat,
            tunic: peer.tunic,
            trousers: peer.trousers,
            look: peer.look,
            gear: peer.gear,
            // The tool their job in hand uses, in its own metal, as the island took it from their pack (`toolFrom`).
            tool: peer.working ? peer.tool : undefined,
            emote: peer.emote,
            emoteT: emoteAt(peer.emote, peer.emoteAt, performance.now() / 1000) ?? undefined,
            cast: this.spells.poseOf({ kind: 'peer', id: peer.id }),
            block: blockAt(peer.blockedAt, performance.now() / 1000),
            flinch: this.flinchOf(peer.hurtAt, peer.hurtWhere, peer.hurtBy, peer.x, peer.y, ent.seatFacing ?? peer.facing, !!peer.hurtHeavy),
            // knocked down, on a ladder, a heavy blow (`../sculpt/anim/clips/down-ko.ts`, `ladder.ts`, `stumble.ts`)
            ...(peer.down ? { down: true } : {}),
            ...(ent.ladder?.climb !== undefined ? { climb: { h: ent.ladder.climb } } : {}),
            ...(peer.hurtHeavy ? { heavy: true } : {}),
            veil: this.spells.veilOf({ kind: 'peer', id: peer.id }),
          }, this.seatedAt(ent, ex, ey + (ent.lift ?? 0), zoom))),
          undefined,
          peerBox,
        );
        if (ent.clip) ctx.restore();
        /*
         * Somebody else is only somebody else if you can tell which one: their
         * name on a plate over their head (`NameLabels`), and what they are at
         * on the same plate over it.
         *
         * The figure already bends over when somebody is working, which says
         * that they are busy and nothing about what at — so a yard with four
         * people in it was four people bending over. The id crosses the wire
         * and the words are looked up here, out of the same table this
         * browser names its own actions from: an id we have never heard of
         * draws nothing rather than drawing whatever it says.
         *
         * And what they said over the plate, wherever the plate is put, so a
         * person talking while they dig reads top to bottom: what they said,
         * what they are doing, who they are.
         */
        const [nx, ny] = swayedAt(ent.sway, ex, ey - FIGURE_TOP * zoom);
        const said = peer.said;
        this.names.add({
          text: peer.name,
          note: peer.act ? ACTION_BY_ID.get(peer.act)?.verb : undefined,
          ink: 'player',
          x: nx,
          head: ny,
          z: swayedAt(ent.sway, ex, ey)[1],
          over: said ? (x, top) => this.speechBubble(ctx, zoom, x, top - 6 * zoom, said, peer.saidAt ?? 0) : undefined,
        });
        continue;
      }
      if (ent.kind === 'creature' && ent.creature) {
        const cr = ent.creature;
        const def = SPECIES[cr.species] ?? SPECIES.rabba;
        /*
         * Which of the eight ways it is turned, kept between frames so a walk
         * along a line that happens to sit on a boundary is not spent flicking
         * between two of them. It used to be a sign — the flank, or the flank
         * in the mirror — so a beast heading north and one heading east were
         * the same picture and walking the camera round one turned it on the
         * spot rather than showing you its other end.
         */
        const turned = this.facingOnScreen(cr.dirX, cr.dirY, this.beastFacing.get(cr.id));
        this.beastFacing.set(cr.id, turned);
        // Its age, and how rare it came into the world: a fantastic one stands three times the height of its kind.
        // And in the traces at draught size: a team that came up to the driver's chest read as foals next to the wagon (`TRACES_SCALE`).
        const big = ageDef(cr, this.game.time).scale * bodySize(cr) * (cr.hitchedTo !== null ? TRACES_SCALE : 1);
        const hit = this.flashOf(cr.attackedAt);
        // Drawing back for a heavy blow: its reach on the ground under it, filling as the blow comes (`WIND_UP`).
        if (cr.windup > 0) this.drawWindupReach(ctx, ent.sx, ent.sy, zoom, cr.windup);
        // Drawn back toward where it stood while a spell that moved it carries it over (`cast.pull`).
        const [csx, csy] = this.spellShift({ kind: 'creature', id: cr.id });
        // Tinted by a spell on it (sick, marked: `FxScene.tint`), on the creature itself, as a blow's flash is but in its colour.
        const tint = hit > 0 || hovering ? undefined : this.spells.tintOf({ kind: 'creature', id: cr.id });
        // As tall and as wide as it is drawn: a big one, or a rare one, is clicked by its head as well as its feet.
        const size = bodySize(cr);
        // The stage it has evolved to, which may be drawn as another body.
        const stage = stageOf(cr);
        const tall = Math.max(22 * size, (wildermonTop(def.id, stage, cr.variant) ?? 0) * big);
        const wide = 10 * size;
        // And the box it is drawn in, a long beast's length either way and a little over its head, for keeping it off a runestone's runes.
        const reach = Math.max(32 * big, wide * 3);
        const beastBox: [number, number, number, number] = [ent.sx + csx - reach * zoom, ent.sy + csy - (tall * 1.25 + 10) * zoom, 2 * reach * zoom, (tall * 1.25 + 18) * zoom];
        // Its look worked out once, so a second drawing of it in the frame (`drawThreats`) is the same picture and steps its gait once.
        const look = {
          species: def.id,
          facing: turned,
          phase: cr.walkPhase,
          moving: cr.moving,
          gait: this.gaits.of('c' + cr.id, cr.x, cr.y, this.frameDt, BEAST_WALK),
          colors: coatOf(cr, def),
          health: cr.health / maxHealth(cr, def),
          fleece: cr.fleece,
          scale: big,
          id: cr.id,
          graze: cr.state === 'forage',
          rare: cr.rare,
          stage,
          variant: cr.variant,
          act: actOf(cr, this.game.time),
          tacked: cr.tacked,
        };
        const draw = (g: CanvasRenderingContext2D, px: number, py: number): void => drawCreature(g, px, py, zoom, look);
        this.paint(ctx, zoom, hit > 0 || tint ? 'flash' : hovering ? 'hover' : 'none', tint ? tint.share : hit * 0.92, ent.sx + csx, ent.sy + csy, draw,
          tint?.colour,
          beastBox,
        );
        if (threatens(cr, def)) {
          this.threats.push({ sx: ent.sx + csx, sy: ent.sy + csy, top: ent.sy - tall * zoom, hunting: cr.enemy === PLAYER_ATTACKER, draw });
        }
        // In the traces: the reins back from its head to the box of what it pulls.
        if (cr.hitchedTo !== null) this.drawReins(ctx, cr, ent.sx, ent.sy, turned, big, zoom);
        // And a mark over it, for the second it has to be seen in.
        if (cr.windup > 0) this.drawWindupMark(ctx, ent.sx, ent.sy - (tall + 16) * zoom, zoom);
        this.nameCreature(cr, def, look, tall, ent.sway, ent.sx + csx, ent.sy + csy, zoom);
        this.creatureHits.push({ x: ent.x, y: ent.y, left: ent.sx - wide * zoom, top: ent.sy - tall * zoom, w: 2 * wide * zoom, h: (tall + 2) * zoom, creature: cr.id });
        continue;
      }
      // The layers of a hull in front of somebody on her deck; see `takeAboard`. Whoever is at her helm is seen through them:
      // anybody else's helmsman was hidden whole behind her sail at one heading in eight, as mine was.
      if (ent.kind === 'hull' && ent.piece && ent.view) {
        const piece = ent.piece;
        const helm = this.helming === piece ? 'player' : piece.helm ? this.game.roster.list().find((p) => p.uid === piece.helm) : undefined;
        const hb = drawFurniture(ctx, ent.sx, ent.sy + (ent.drawDy ?? 0), zoom, piece.kind, !!piece.lit, dyeOf(piece) ?? undefined, this.pieceTrim(piece), ent.view, piece.material, crewOf(piece.kind) ?? undefined, ent.layer, true,
          helm ? figurePicture(helm === 'player' ? helm : 'o' + helm.id) : null, this.manned(piece));
        // A hull is drawn in layers round her crew, not to be drawn again: in front of a runestone's runes, her box is kept off them.
        if (this.runeNight.keeping) this.runeNight.occludeRect(ctx, ent.sx + hb[0], ent.sy + (ent.drawDy ?? 0) + hb[1], hb[2] - hb[0], hb[3] - hb[1], this.occClips);
        continue;
      }
      if (ent.kind === 'furniture' && ent.piece) {
        const piece = ent.piece;
        const view = ent.view ?? this.viewOf(piece);
        const [W, D] = furnitureSpan(piece.kind);
        // What it covered when it was drawn, from its floor contact, for the box it is clicked by.
        let drawn: [number, number, number, number] | null = null;
        const h = FURNITURE_HEIGHT[piece.kind] ?? 14;
        // The box it stands in, and a margin for what it is drawn as past that, for keeping it off a runestone's runes (`paint`).
        const pieceBox: [number, number, number, number] = [ent.sx - W * 1.3 * zoom, ent.sy - (h + D + 8) * zoom, W * 2.6 * zoom, (h + 2 * D + 14) * zoom];
        /*
         * A wildermon crate with somebody in it: its far half, the wildermon
         * standing on its floor facing the door, and its near half and lid
         * over them, so it is seen inside rather than on top. No name over it:
         * a crated one is the one wildermon whose name is not drawn.
         */
        const inside = piece.kind === CREATURE_CRATE && piece.creature !== undefined ? this.game.creatures.get(piece.creature) : undefined;
        if (inside && inside.mode === 'stored') {
          const def = SPECIES[inside.species] ?? SPECIES.rabba;
          const [fx, fy] = CRATE_DOOR[pieceFacing(piece)];
          const turned = this.facingOnScreen(fx, fy, this.beastFacing.get(inside.id));
          this.beastFacing.set(inside.id, turned);
          const tint = dyeOf(piece) ?? undefined;
          this.paint(ctx, zoom, hovering ? 'hover' : 'none', 0, ent.sx, ent.sy, (g, px, py) => {
            drawFurniture(g, px, py, zoom, piece.kind, false, tint, 0, view, piece.material);
            drawStill(g, px, py - CRATE_FLOOR * zoom, zoom, {
              species: def.id,
              facing: turned,
              phase: 0,
              moving: false,
              colors: coatOf(inside, def),
              health: 1,
              fleece: inside.fleece,
              scale: ageDef(inside, this.game.time).scale * CRATE_SCALE,
              id: inside.id,
              rare: inside.rare,
              stage: stageOf(inside),
            }, this.stillsLeft);
            drawFurniture(g, px, py, zoom, piece.kind, false, tint, 1, view, piece.material);
          }, undefined, pieceBox);
        } else if (piece.kind === MEMORIAL) {
          /*
           * A memorial stone, drawn as the Runestones are (`memorial.ts`): its
           * runes and the line cut into it lit over its picture, and after
           * dark taken off the night in their own shapes, kept off whatever
           * stands in front of it. Clicked by its stone and its plinth.
           */
          const facing = pieceFacing(piece), turn = this.camera.rotation, dark = this.game.darkness();
          this.paint(ctx, zoom, hovering ? 'hover' : 'none', 0, ent.sx, ent.sy, (g, px, py) => {
            drawn = drawMemorial(g, px, py, zoom, facing, turn, piece.engraving, dark, this.anim);
          }, undefined, pieceBox);
          this.runeNight.source(ctx, ent.sx, ent.sy, zoom, memorialNight(facing, turn, zoom, piece.engraving), this.anim);
        } else if (piece.kind === 'fountain') {
          /*
           * A tiered fountain: its stone in three layers with its water drawn
           * live in between them, running while it holds a litre or more to
           * draw (`drawFountain`). Clicked by all three layers together.
           */
          const [wx, wy] = furnitureCentre(piece);
          const base = this.pieceBase(piece, wx, wy);
          const fv = fallView(this.camera, this.anim, this.canvas.width, this.canvas.height, HEIGHT_SCALE * zoom);
          const dark = this.game.darkness();
          const flowing = (piece.litres ?? 0) >= 1;
          if (flowing) this.fountainFoam ??= foamTexture();
          const foam = this.fountainFoam;
          let box: [number, number, number, number] | null = null;
          this.paint(ctx, zoom, hovering ? 'hover' : 'none', 0, ent.sx, ent.sy, (g, px, py) => {
            const v = { ...fv, ox: fv.ox + px - ent.sx, oy: fv.oy + py - ent.sy };
            drawFountain(g, { v, x: wx, y: wy, base, key: piece.id, flowing, dark, foamTex: foam }, (layer) => {
              const b = drawFurniture(g, px, py, zoom, piece.kind, false, undefined, layer, view, piece.material, undefined, 'all', false);
              box = box ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])] : b;
            });
          }, undefined, pieceBox);
          drawn = box;
        } else if (isDen(piece.kind)) {
          /*
           * A wildermon bed (`dens.ts`): its bake under the pointer's ring, and
           * whoever sleeps in it (`PlacedFurniture.sleeper`) curled on its
           * cushion in their own coat, breathing, the near rim over them and a
           * `z` rising off them. After dark its bells throw a soft pool of
           * light into the night's light layer (`denPools`), and their own
           * light is added here in the bed's place, turned up by what the
           * wash will still take off it (`nightOver`) -- so whatever stands in
           * front is drawn over it, and no frame pays the runestones' keeping
           * for a deed full of beds.
           */
          const look = this.denLook(piece), dark = this.game.darkness();
          this.paint(ctx, zoom, hovering ? 'hover' : 'none', 0, ent.sx, ent.sy, (g, px, py) => {
            drawDen(g, px, py, zoom, piece.kind, view, look, this.anim, false);
          }, undefined, pieceBox);
          // Clicked by its basket and its hood, not the grass at its foot.
          const [hl, ht, hr, hb] = denHit(piece.kind, view, zoom);
          drawn = [hl * zoom, ht * zoom, hr * zoom, hb * zoom];
          // Its bells' light turned up by what the wash will take off it there, their own pool of light having taken some (`denPools`).
          drawDenLive(ctx, ent.sx, ent.sy, zoom, piece.kind, view, look, this.anim, dark, dark > 0.02 ? this.nightOver(ent.sx, ent.sy - 24 * zoom, dark) : 0);
          // The turns either side of this one baked ahead while the browser is idle, so turning the camera finds them made.
          const rot = this.camera.rotation, facing = pieceFacing(piece);
          prewarmDen(piece.kind, [pieceView(facing, rot + 1), pieceView(facing, rot - 1)], zoom, look);
        } else if (isRuneLantern(piece)) {
          /*
           * A rune lantern post, drawn as the runestones are (`runelantern.ts`):
           * its bake under the pointer's ring, its runes' light and motes over
           * it, and after dark its runes taken off the night in their own
           * shapes, kept off whatever stands in front of it (`RunestoneNight`).
           */
          const look = this.runeLook(piece);
          const turn = this.camera.rotation, dark = this.game.darkness();
          const [hl, ht, hr, hb] = runeLanternHit(look, turn, zoom);
          const box: [number, number, number, number] = [ent.sx + (hl - 12) * zoom, ent.sy + (ht - 12) * zoom, (hr - hl + 24) * zoom, (hb - ht + 20) * zoom];
          // Its bloom under it, lighting the ground and whatever stands behind it, not its own stone.
          drawRuneLanternBloom(ctx, ent.sx, ent.sy, zoom, look, turn, dark, this.anim);
          this.paint(ctx, zoom, hovering ? 'hover' : 'none', 0, ent.sx, ent.sy, (g, px, py) => {
            drawRuneLantern(g, px, py, zoom, look, turn, dark, this.anim, false);
          }, undefined, box);
          drawRuneLanternLive(ctx, ent.sx, ent.sy, zoom, look, turn, dark, this.anim);
          this.runeNight.source(ctx, ent.sx, ent.sy, zoom, runeLanternNight(look, turn, zoom), this.anim);
          drawn = [hl * zoom, ht * zoom, hr * zoom, hb * zoom];
        } else {
          /*
           * Only the first of her layers when she is drawn in layers round her
           * crew, the rest coming after them; or all of them at once under the
           * pointer, so the ring round her is round the whole of her, and the
           * layers in front then drawn again over whoever is aboard.
           */
          const crew = ent.layer === 0 ? crewOf(piece.kind) ?? undefined : undefined;
          this.paint(ctx, zoom, hovering ? 'hover' : 'none', 0, ent.sx, ent.sy, (g, px, py) => {
            drawn = drawFurniture(g, px, py, zoom, piece.kind, !!piece.lit, dyeOf(piece) ?? undefined, this.pieceTrim(piece), view, piece.material, crew, crew && !hovering ? 0 : 'all', false, null, this.manned(piece));
          }, undefined, pieceBox);
          // What on it moves -- an altar's stars, a banner's cloth -- over it, and outside the
          // ring under the pointer: a ring round a bloom of light is a blot.
          drawFurnitureLive(ctx, ent.sx, ent.sy, zoom, piece.kind, view, this.game.darkness(), clothInWind(piece.kind) ? this.airOf(piece) : undefined);
          // A lantern burning on a post or a pillar blooms as the dark comes on (`lamps.ts`).
          if (lampBurning(piece)) drawLampBloom(ctx, ent.sx, ent.sy, zoom, piece.kind, view, this.game.darkness());
          /*
           * An enchanter's plinth's runes, over its stone and outside the ring under the pointer: faint at rest and
           * bright while somebody enchants at it (`plinth.ts`); after dark taken off the night in their own shapes and
           * kept off whatever stands in front of them, as a runestone's are (`RunestoneNight`).
           */
          if (piece.kind === ENCHANTERS_PLINTH) {
            const busy = plinthBusy(this.game, piece), trim = this.pieceTrim(piece), dark = this.game.darkness();
            drawPlinthRunes(ctx, ent.sx, ent.sy, zoom, view, trim, dark, busy, this.anim);
            if (dark > 0.02) {
              const lit = plinthNight(ent.sx, ent.sy, zoom, view, trim, busy, this.anim);
              this.runeNight.glowing(ctx, ...lit.box, lit.holes, lit.masks);
            }
          }
          // Not indoors: a roof or a wall stands in front of it there, and the night cut away at its stars would be cut out of that.
          if (glowsAtNight(piece.kind) && !this.game.buildings.buildingAt(Math.floor(piece.x), Math.floor(piece.y))) {
            /*
             * After dark, cut out of a copy of their own box at the screen's
             * pixels as the night goes down, as a runestone's runes are
             * (`RunestoneNight.lay`), and over whatever stands in front of
             * them, as they always were. An altar in view used to have the
             * whole night mixed at the screen's full size for the sake of its
             * stars: four times the pixels, every frame, at any zoom.
             */
            const holes = furnitureHoles(ent.sx, ent.sy, zoom, piece.kind, view);
            let L = Infinity, T = Infinity, R = -Infinity, B = -Infinity;
            for (const h of holes) {
              L = Math.min(L, h.x - h.r); T = Math.min(T, h.y - h.r);
              R = Math.max(R, h.x + h.r); B = Math.max(B, h.y + h.r);
            }
            const moved = (dx: number, dy: number): NightHole[] => holes.map((h) => ({ x: h.x + dx, y: h.y + dy, r: h.r, a: h.a }));
            if (!this.runeNight.glowing(ctx, L, T, R, B, moved, () => [], false)) this.glows.push({ sx: ent.sx, sy: ent.sy, kind: piece.kind, view });
          }
        }
        // A sign is a board made to be read, so what is written on it stands
        // over it in the world rather than waiting in a tooltip.
        if (piece.name && furnitureDef(piece.kind).sign && zoom >= 0.6) {
          const text = piece.name;
          ctx.font = `${Math.round(11 * zoom)}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          const w = ctx.measureText(text).width;
          const ty = ent.sy - (h + 6) * zoom;
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(ent.sx - w / 2 - 4 * zoom, ty - 11 * zoom, w + 8 * zoom, 14 * zoom);
          ctx.fillStyle = '#e7d7a8';
          ctx.fillText(text, ent.sx, ty);
          ctx.textAlign = 'left';
        }
        /*
         * Clicked by the box it stands in, or by what it is drawn as where that
         * is bigger. The box is its footprint and its height, which for most
         * things is what is drawn; a caravel lies out over the water at bow
         * and stern, half as long again as the tile she is built on, and could
         * only be clicked in her middle.
         */
        let [left, top, right, bottom] = [ent.sx - W * zoom, ent.sy - (h + D + 2) * zoom, ent.sx + W * zoom, ent.sy + (D + 2) * zoom];
        if (drawn) {
          left = Math.min(left, ent.sx + drawn[0]);
          top = Math.min(top, ent.sy + drawn[1]);
          right = Math.max(right, ent.sx + drawn[2]);
          bottom = Math.max(bottom, ent.sy + drawn[3]);
        }
        this.furnitureHits.push({ ...this.shaped(), x: ent.x, y: ent.y, left, top, w: right - left, h: bottom - top, furniture: piece.id });
        // On the ground, and not a hull on the water nor up on a storey, a deck or under a jetty: its foot over the lines in front (`standsOn`).
        if (!behind && !(piece.level ?? 0) && !furnitureDef(piece.kind).boat && !(this.game.bridges.size && this.game.pieceOnDeck(piece, Math.floor(piece.x), Math.floor(piece.y)))) {
          const [fw, fh] = furnitureFootprint(piece.kind, pieceFacing(piece));
          const [wx, wy] = furnitureCentre(piece);
          this.standsOn(wx, wy, ent.sy, Math.hypot(fw, fh) / 2 / SUBTILES + FOOT_PAST, zoom);
        }
        if (shines(ent.rare)) drawShine(ctx, ent.sx, ent.sy, zoom, ent.rare as number, piece.id, this.anim, W * 2 * zoom, h * zoom);
      }
      if (ent.kind === 'kiln' && ent.kiln) {
        /*
         * A kiln, drawn as a smelter is (`forge.ts`): its bake and the fire in
         * its mouth, vent and spy holes under the pointer's ring, and the
         * flare and tongue of flame at its vent over it while it fires. After
         * dark its fire and runes are added as light here, in its own place,
         * turned up by what the wash will take off them (`nightOver`).
         * Clicked by its solids.
         */
        const kiln = ent.kiln, turn = this.camera.rotation, dark = this.game.darkness();
        const look = { lit: kiln.lit, firing: kiln.lit && kiln.jobs.length > 0 };
        const [bl, bt, br, bb] = kilnBounds(turn, zoom);
        const box: [number, number, number, number] = [ent.sx + bl * zoom, ent.sy + bt * zoom, (br - bl) * zoom, (bb - bt) * zoom];
        this.paint(ctx, zoom, hovering ? 'hover' : 'none', 0, ent.sx, ent.sy, (g, px, py) => {
          drawKiln(g, px, py, zoom, turn, look, dark, this.anim, false);
        }, undefined, box);
        drawKilnLive(ctx, ent.sx, ent.sy, zoom, turn, look, dark, this.anim);
        // Its fire and runes after dark, added as light here in its own place, so what stands in front is drawn over it.
        if (look.lit && dark > 0.02) drawKilnNight(ctx, ent.sx, ent.sy, zoom, turn, look, dark, this.anim, this.nightOver(ent.sx, ent.sy - 24 * zoom, dark));
        const [hl, ht, hr, hb] = kilnHit(turn, zoom);
        this.kilnHits.push({ ...this.shaped(), x: ent.x, y: ent.y, left: ent.sx + hl * zoom, top: ent.sy + ht * zoom, w: (hr - hl) * zoom, h: (hb - ht) * zoom, kiln: kiln.id });
        if (!behind) this.standsOn(...kilnCentre(kiln), ent.sy, this.footReach(KILN_SUBTILES, KILN_SUBTILES, hl, hr), zoom);
        if (shines(ent.rare)) drawShine(ctx, ent.sx, ent.sy, zoom, ent.rare as number, kiln.id, this.anim, (hr - hl) * zoom, (hb - ht) * 0.75 * zoom);
        continue;
      }
      if (ent.kind === 'smelter' && ent.smelter) {
        /*
         * A smelter, drawn as the runestones are (`forge.ts`): its bake and
         * the fire in its mouth and flue under the pointer's ring, and its
         * flare and sparks over it. After dark the game's own light takes the
         * night off it (`Game.lights`), and its fire and runes are added as
         * light here, in its own place, turned up by what the wash will take
         * off them (`nightOver`) -- not the runestones' keeping, which costs a
         * frame a box of everything drawn after it. Clicked by its solids.
         */
        const sm = ent.smelter, turn = this.camera.rotation, dark = this.game.darkness();
        const look = { lit: sm.lit, working: sm.lit && sm.jobs.length > 0 };
        const [bl, bt, br, bb] = smelterBounds(turn, zoom);
        const box: [number, number, number, number] = [ent.sx + bl * zoom, ent.sy + bt * zoom, (br - bl) * zoom, (bb - bt) * zoom];
        this.paint(ctx, zoom, hovering ? 'hover' : 'none', 0, ent.sx, ent.sy, (g, px, py) => {
          drawSmelter(g, px, py, zoom, turn, look, dark, this.anim, false);
        }, undefined, box);
        drawSmelterLive(ctx, ent.sx, ent.sy, zoom, turn, look, dark, this.anim);
        // Its fire and runes after dark, added as light here in its own place, so what stands in front is drawn over it.
        if (look.lit && dark > 0.02) drawSmelterNight(ctx, ent.sx, ent.sy, zoom, turn, look, dark, this.anim, this.nightOver(ent.sx, ent.sy - 30 * zoom, dark));
        const [hl, ht, hr, hb] = smelterHit(turn, zoom);
        this.smelterHits.push({ ...this.shaped(), x: ent.x, y: ent.y, left: ent.sx + hl * zoom, top: ent.sy + ht * zoom, w: (hr - hl) * zoom, h: (hb - ht) * zoom, smelter: sm.id });
        if (!behind) this.standsOn(...smelterCentre(sm), ent.sy, this.footReach(SMELTER_W, SMELTER_H, hl, hr), zoom);
        if (shines(ent.rare)) drawShine(ctx, ent.sx, ent.sy, zoom, ent.rare as number, sm.id, this.anim, (hr - hl) * zoom, (hb - ht) * 0.75 * zoom);
        continue;
      }
      if (ent.kind === 'anvil' && ent.anvil) {
        // An anvil takes the colour of the metal it was cast from, on a block with a rune cut in it (`forge.ts`), lit over the night after dark.
        const an = ent.anvil, turn = this.camera.rotation, dark = this.game.darkness();
        let [face, shade] = anvilTone(an.metal) ?? ['', ''];
        if (!face) {
          // A metal with no colour of its own drawn: its ore's.
          const rock = ROCK_VARIANTS.find((r) => r.yields === `${an.metal}_ore`);
          const c = rock ? rock.color : ([150, 150, 156] as const);
          face = `rgb(${c[0]},${c[1]},${c[2]})`;
          shade = `rgb(${Math.round(c[0] * 0.68)},${Math.round(c[1] * 0.68)},${Math.round(c[2] * 0.68)})`;
        }
        const variant = anvilVariant(an.x, an.y, an.sx, an.sy);
        const [bl, bt, br, bb] = anvilBounds(face, shade, variant, turn, zoom);
        const box: [number, number, number, number] = [ent.sx + bl * zoom, ent.sy + bt * zoom, (br - bl) * zoom, (bb - bt) * zoom];
        this.paint(ctx, zoom, hovering ? 'hover' : 'none', 0, ent.sx, ent.sy, (g, px, py) => {
          drawAnvil(g, px, py, zoom, face, shade, turn, variant, dark, this.anim, false);
        }, undefined, box);
        drawAnvilLive(ctx, ent.sx, ent.sy, zoom, face, shade, turn, variant, dark, this.anim);
        if (dark > 0.02) {
          /*
           * Its rune's light here in its own place, turned up by what the wash
           * will take off it. Where that is most of it -- out of any light,
           * where no picture laid under the wash could come up through it --
           * the night is taken off the rune in its own shape as well, kept off
           * whatever stands in front (\`RunestoneNight\`); by a forge's fire it
           * needs none of that, and is spared its keeping.
           */
          const over = this.nightOver(ent.sx, ent.sy - 8 * zoom, dark);
          const dim = over > ANVIL_UNDER_WASH;
          drawAnvilNight(ctx, ent.sx, ent.sy, zoom, face, shade, turn, variant, dark, this.anim, dim ? 0 : over);
          if (dim) this.runeNight.source(ctx, ent.sx, ent.sy, zoom, anvilNight(face, shade, variant, turn, zoom), this.anim);
        }
        const [hl, ht, hr, hb] = anvilHit(face, shade, variant, turn, zoom);
        this.anvilHits.push({ ...this.shaped(), x: ent.x, y: ent.y, left: ent.sx + hl * zoom, top: ent.sy + ht * zoom, w: (hr - hl) * zoom, h: (hb - ht) * zoom, anvil: an.id });
        if (!behind) this.standsOn(...anvilCentre(an), ent.sy, this.footReach(ANVIL_SUBTILES, ANVIL_SUBTILES, hl, hr), zoom);
        if (shines(ent.rare)) drawShine(ctx, ent.sx, ent.sy, zoom, ent.rare as number, an.id, this.anim, (hr - hl) * zoom, (hb - ht) * 0.75 * zoom);
        continue;
      }
      if (ent.kind === 'post' && ent.post) {
        /*
         * A work post, drawn as an anvil is (`workpost.ts`): its bake and its
         * ribbon in the wind under the pointer's ring, and its rune's light over
         * it while a wildermon works from it. After dark that light goes in
         * here in its own place, turned up by what the wash will take off it;
         * out of any light, the night is taken off the rune in its own shape as
         * well, as an anvil's is (`ANVIL_UNDER_WASH`). Clicked by the post and
         * its ribbon.
         */
        const post = ent.post, turn = this.camera.rotation, dark = this.game.darkness();
        const look: WorkPostLook = {
          wood: post.material, left: postLeft(post) / postLife(post.ql), worked: post.worker !== null,
          variant: workPostVariant(post.x, post.y, post.sx, post.sy), seed: post.id, wind: { x: this.surf.dirX, y: this.surf.dirY, force: this.surf.force },
        };
        const [bl, bt, br, bb] = workPostBounds(look, turn, zoom);
        const box: [number, number, number, number] = [ent.sx + bl * zoom, ent.sy + bt * zoom, (br - bl) * zoom, (bb - bt) * zoom];
        this.paint(ctx, zoom, hovering ? 'hover' : 'none', 0, ent.sx, ent.sy, (g, px, py) => {
          drawWorkPost(g, px, py, zoom, look, turn, dark, this.anim, false);
        }, undefined, box);
        drawWorkPostLive(ctx, ent.sx, ent.sy, zoom, look, turn, dark, this.anim);
        if (look.worked && dark > 0.02) {
          const over = this.nightOver(ent.sx, ent.sy - 26 * zoom, dark);
          const dim = over > ANVIL_UNDER_WASH;
          drawWorkPostNight(ctx, ent.sx, ent.sy, zoom, look, turn, dark, this.anim, dim ? 0 : over);
          if (dim) this.runeNight.source(ctx, ent.sx, ent.sy, zoom, workPostNight(look, turn, zoom), this.anim);
        }
        const [hl, ht, hr, hb] = workPostHit(look, turn, zoom);
        this.postHits.push({ ...this.shaped(), x: ent.x, y: ent.y, left: ent.sx + hl * zoom, top: ent.sy + ht * zoom, w: (hr - hl) * zoom, h: (hb - ht) * zoom, post: post.id });
        continue;
      }
      if (ent.kind === 'waterplant' && ent.plant && this.plantFrame) {
        drawPlantUpright(ctx, ent.plant, this.plantFrame);
        continue;
      }
      if (ent.kind === 'token' && ent.totem) {
        /*
         * A settlement's token, drawn as the rune lantern post is
         * (`deedtotem.ts`): its bake under the pointer's ring, its runes'
         * light over it, and after dark its runes taken off the night in
         * their own shapes, kept off whatever stands in front of it
         * (`RunestoneNight`). Clicked by the parts of the totem standing up off
         * its tile, as its tile, so its hover and its menu are the token's. No
         * cast shadow: its bake lays its own on the ground, as a runestone's does.
         */
        const look = ent.totem, turn = this.camera.rotation, dark = this.game.darkness();
        // The box it is drawn in, turf and all, for keeping it off a runestone's runes (`paint`).
        const [bl, bt, br, bb] = deedTotemBounds(look, turn, zoom);
        const box: [number, number, number, number] = [ent.sx + bl * zoom, ent.sy + bt * zoom, (br - bl) * zoom, (bb - bt) * zoom];
        drawDeedTotemBloom(ctx, ent.sx, ent.sy, zoom, look, turn, dark, this.anim);
        this.paint(ctx, zoom, hovering ? 'hover' : 'none', 0, ent.sx, ent.sy, (g, px, py) => {
          drawDeedTotem(g, px, py, zoom, look, turn, dark, this.anim, false);
        }, undefined, box);
        drawDeedTotemLive(ctx, ent.sx, ent.sy, zoom, look, turn, dark, this.anim);
        this.runeNight.source(ctx, ent.sx, ent.sy, zoom, deedTotemNight(look, turn, zoom), this.anim);
        // A box round each part of it -- each block, the bowl, the wings, the crown -- and not the air between them.
        for (const [hl, ht, hr, hb] of deedTotemHits(look, turn, zoom)) {
          this.stoneHits.push({ x: ent.x, y: ent.y, left: ent.sx + hl * zoom, top: ent.sy + ht * zoom, w: (hr - hl) * zoom, h: (hb - ht) * zoom });
        }
        continue;
      }
      if (ent.kind === 'runestone' && ent.stone) {
        const id = ent.stone.id, turn = this.camera.rotation;
        drawRunestone(ctx, ent.sx, ent.sy, zoom, id, turn, this.game.darkness(), this.anim);
        // From here on whatever is drawn in front of its runes is kept off their light (`RunestoneNight`).
        this.runeNight.stone(ctx, ent.sx, ent.sy, zoom, id, turn, this.anim);
        const c = stoneCentre(ent.stone, this.game.world.w);
        const [l, t, r, b] = runestoneHit(id, turn);
        this.stoneHits.push({ x: c.x, y: c.y, left: ent.sx + l * zoom, top: ent.sy + t * zoom, w: (r - l) * zoom, h: (b - t) * zoom });
        continue;
      }
      if (ent.kind === 'swirl' && ent.swirl) {
        drawSwirl(ctx, ent.sx, ent.sy, zoom, ent.swirl.element, this.anim, ent.swirl.id);
        // And its light over the night, once the night is laid (`glowSwirl`).
        this.swirlsSeen.push({ s: ent.swirl, x: ent.sx, y: ent.sy });
        continue;
      }
      if (ent.kind === 'deck' && ent.aq) {
        const box = this.aqueducts.draw(ctx, ent.aq);
        // An aqueduct's bays are laid in pieces round what stands under them: in front of a runestone's runes, its box is kept off them.
        if (box && this.runeNight.keeping) this.runeNight.occludeRect(ctx, box.left, box.top, box.w, box.h, this.occClips);
        if (box) this.deckHits.push({ x: ent.x, y: ent.y, left: box.left, top: box.top, w: box.w, h: box.h, bridge: ent.aq.b.id, aq: box.shape });
        continue;
      }
      if (ent.kind === 'spiral' && ent.sp) {
        const a = ent.spAlpha ?? 1;
        if (a < 1) { ctx.save(); ctx.globalAlpha *= a; }
        // Laid over the player climbing it: see-through in a window round the body, so nobody loses themselves behind the turn.
        const seen = this.spiralSeen;
        if (seen && seen.tx === ent.sp.fl.x && seen.ty === ent.sp.fl.y && ent.sp.key > seen.key) {
          const cy = seen.y - FIGURE_TOP * zoom * 0.5, rx = 15 * zoom, ry = (FIGURE_TOP * 0.5 + 7) * zoom;
          // Feathered: whole outside the window, then rings toward the body, each fainter.
          const rings = [1.3, 1.15, 1, 0];
          rings.forEach((out, j) => {
            ctx.save();
            ctx.beginPath();
            if (j === 0) ctx.rect(-1e5, -1e5, 2e5, 2e5);
            else ctx.ellipse(seen.x, cy, rx * rings[j - 1], ry * rings[j - 1], 0, 0, Math.PI * 2);
            if (out > 0) ctx.ellipse(seen.x, cy, rx * out, ry * out, 0, 0, Math.PI * 2);
            ctx.clip('evenodd');
            ctx.globalAlpha *= j === 0 ? 1 : 1 - (1 - SPIRAL_SEE_THROUGH) * (j / (rings.length - 1));
            drawSpiralPiece(ctx, ent.sp!, zoom, this.camera.rotation);
            ctx.restore();
          });
        } else drawSpiralPiece(ctx, ent.sp, zoom, this.camera.rotation);
        if (a < 1) ctx.restore();
        // After dark, the night taken off round the runes cut in its cap.
        const glow = this.runeNight.isOpen && a >= 1 ? spiralCapGlow(ent.sp, zoom, this.camera.rotation) : null;
        if (glow) {
          const r = glow.r * 2;
          this.runeNight.glowing(ctx, glow.x - r, glow.y - r, glow.x + r, glow.y + r,
            (dx, dy) => [{ x: glow.x + dx, y: glow.y + dy, r: glow.r, a: 0.55 }], () => [], true);
        }
        continue;
      }
      if (ent.kind === 'deck' && ent.bp) {
        const bp = ent.bp;
        const rot = this.camera.rotation;
        let hit: [number, number, number, number] | null = null;
        this.paint(ctx, zoom, hovering ? 'hover' : 'none', 0, ent.sx, ent.sy, (g) => { hit = drawBridgePiece(g, bp, zoom, rot) ?? hit; });
        const box = hit as [number, number, number, number] | null;
        if (box) {
          this.deckHits.push({ x: ent.x, y: ent.y, left: box[0], top: box[1], w: box[2] - box[0], h: box[3] - box[1], bridge: bp.b.id });
          // After dark, the night taken off its rune line, its runes and its lamps (`bridgeNight`).
          const night = this.runeNight.isOpen ? bridgeNight(bp, zoom, rot) : null;
          if (night) this.runeNight.glowing(ctx, night.box[0], night.box[1], night.box[2], night.box[3], night.holes, night.masks, true);
        }
        continue;
      }
      if (ent.kind === 'deck' && ent.deck?.kind === 'draw') {
        const b = this.game.bridges.get(ent.deck.id);
        // Its chains go up to a gallows, which there is none of on a building's floor (`drawGateAt`).
        if (b) {
          const span = (g: CanvasRenderingContext2D): void => drawDrawbridgeSpan(g, this.project, this.walls.drawbridgeGeom(b), ent.deck!.span ?? 0, zoom, this.walls.deckLit(b), ent.deck!.done,
            bridgeDone(b) && !this.game.buildings.buildingAt(b.ax, b.ay));
          span(ctx);
          if (this.runeNight.keeping) this.runeNight.occludeDraw(ctx, ent.sx - 120 * zoom, ent.sy - 160 * zoom, 240 * zoom, 220 * zoom, span, this.occClips);
        }
        this.deckHits.push({ x: ent.x, y: ent.y, left: ent.sx - 40 * zoom, top: ent.sy - 22 * zoom, w: 80 * zoom, h: 44 * zoom, bridge: ent.deck.id });
        continue;
      }
      if (ent.kind === 'deck' && ent.deck) {
        const deck = ent.deck;
        this.paint(ctx, zoom, hovering ? 'hover' : 'none', 0, ent.sx, ent.sy, (g, px, py) => drawDeck(g, px, py, zoom, deck.kind, deck.done, deck.drop, deck.shape, deck.green, ent.x * 31 + ent.y * 17));
        // The deck as it is laid: the tile at the deck's height and its edge under it, not a box round it.
        const poly = deckOutline(deck.shape?.q, ent.sx, ent.sy, zoom);
        let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
        for (const o of poly) {
          for (let k = 0; k < o.length; k += 2) {
            l = Math.min(l, o[k]);
            r = Math.max(r, o[k]);
            t = Math.min(t, o[k + 1]);
            b = Math.max(b, o[k + 1]);
          }
        }
        // And the pier under it, which the deck is laid over.
        const pier = deckPier(deck.kind, deck.drop);
        if (pier > 0) this.deckHits.push({ x: ent.x, y: ent.y, left: ent.sx - 5 * zoom, top: ent.sy + 2 * zoom, w: 10 * zoom, h: pier * zoom, bridge: deck.id });
        this.deckHits.push({ x: ent.x, y: ent.y, left: l, top: t, w: r - l, h: b - t, bridge: deck.id, poly });
        continue;
      }
      if (ent.kind === 'trap' && ent.trap) {
        const trap = ent.trap;
        this.paint(ctx, zoom, hovering ? 'hover' : 'none', 0, ent.sx, ent.sy, (g, px, py) => drawTrap(g, px, py, zoom, trap.kind, !!trap.bait, trap.caught !== null));
        this.trapHits.push({ ...this.shaped(), x: ent.x, y: ent.y, left: ent.sx - 8 * zoom, top: ent.sy - 12 * zoom, w: 16 * zoom, h: 14 * zoom, trap: trap.id });
        continue;
      }
      if (ent.kind === 'campfire' && ent.fire) {
        const fire = ent.fire;
        this.paint(ctx, zoom, hovering ? 'hover' : 'none', 0, ent.sx, ent.sy, (g, px, py) => drawCampfire(g, px, py, zoom, fire.lit, fire.fuel, this.anim, this.camera.rotation, fire.ash ?? 0));
        // Its fire after dark, added as light in its own place (`kit/campfire.ts`), as a smelter's is.
        const dark = fire.lit ? this.game.darkness() : 0;
        if (dark > 0.02) drawCampfireNight(ctx, ent.sx, ent.sy, zoom, fire.fuel, dark, this.anim, this.nightOver(ent.sx, ent.sy - 12 * zoom, dark));
        this.fireHits.push({ ...this.shaped(), x: ent.x, y: ent.y, left: ent.sx - 22 * zoom, top: ent.sy - 20 * zoom, w: 44 * zoom, h: 30 * zoom, fire: fire.id });
        continue;
      }
      const spr = ent.spr;
      if (!spr) continue;
      /*
       * How big this particular one is.
       *
       * Every tree of a species and an age shares one baked sprite, so
       * without this a wood is one tree printed a hundred times and every
       * crown in it tops out on the same line -- which the eye reads as
       * horizontal banding long before it notices it is looking at trees.
       * It costs nothing: no second sprite, no second draw, just a different
       * size to blit the one sprite at, taken about the foot so a tree that
       * grew bigger does not also climb out of the ground.
       *
       * A fifth either way was not enough. A real wood is not one height
       * with a wobble on it, it is layers: a few emergents standing a head
       * and shoulders over everything, a thick middle rank, and an
       * understorey of small wide ones down in the shade of them. So the
       * roll is shaped rather than flat -- one tree in nine is half again
       * as big or better, one in four is half size or less, and the rest
       * fill the middle. That is what puts a top and a floor on a canopy.
       */
      // A stump drawn as a solid is the foot of the tree that grew there: bigger or smaller with it, by less (`stumpGrown`).
      const grew = ent.kind === 'tree' || ent.kind === 'bush' ? grownAt(ent.x, ent.y) : ent.kind === 'stump' && spr.solid ? stumpGrown(ent.x, ent.y) : 1;
      const dw = spr.w * zoom * grew;
      const dh = spr.h * zoom * grew;
      const left = ent.sx - spr.ax * zoom * grew;
      const top = ent.sy - spr.ay * zoom * grew;
      // Anything standing up throws a shadow away from the sun, long at the
      // ends of the day and gone at noon. The sprite's own contact shadow does
      // the rest, which is why this can be thrown away entirely at midday.
      if (ent.kind === 'tree' || ent.kind === 'bush') {
        this.drawnTrees.all++;
        if (spr.solid) this.drawnTrees.solid++;
        this.drawTree(ctx, ent, spr, zoom, grew);
        continue;
      }
      // A field's shade is its plants', thrown in its bake (`fieldBake`); a solid stump's or log's, at its foot and thrown, is in its own picture (`paintStump3d`, `paintLogs3d`).
      if ((ent.kind !== 'crop' || this.still) && !spr.solid && this.shadow.alpha > 0.012) this.castShadow(ctx, ent.sx, ent.sy, (spr.ay - (spr.h - spr.ay)) * 0.5 * zoom + dh * 0.12);
      const ready = this.atSize(spr.canvas, dw, dh);
      const tilt = ent.tilt;
      const ox = spr.ax * zoom * grew, oy = spr.ay * zoom * grew;
      this.paint(ctx, zoom, hovering ? 'hover' : 'none', 0, ent.sx, ent.sy, tilt
        // A field on a slope: its flat picture sheared onto the ground about its middle (`fieldTilt`).
        ? (g, px, py) => { g.save(); g.transform(1, tilt[0], 0, 1 + tilt[1], 0, -tilt[0] * px - tilt[1] * py); g.drawImage(ready, px - ox, py - oy, dw, dh); g.restore(); }
        : (g, px, py) => g.drawImage(ready, px - ox, py - oy, dw, dh), undefined,
        [left, top, dw, dh]);
      /*
       * And the shine, over the top of whatever it is, because the light comes
       * off the thing rather than out from behind it. The seed is the tile, so
       * a heap keeps the same motes in the same places from one frame to the
       * next and two heaps side by side do not shine in step.
       */
      if (shines(ent.rare)) drawShine(ctx, ent.sx, ent.sy, zoom, ent.rare as number, ent.x * 4099 + ent.y, this.anim, dw, spr.ay * zoom);
      if (ent.kind === 'crate' && ent.crateId !== undefined) {
        this.crateHits.push({ ...this.shaped(), x: ent.x, y: ent.y, left, top, w: dw, h: dh, crate: ent.crateId });
      }
    }
    this.footShown();
    if (swayed) ctx.restore();
    if (behind) ctx.restore();
    // Down a cellar it goes on once, over the whole of the cellar (`drawCellarView`).
    if (this.ghost && !this.inCellarPass) this.drawGhost(ctx, zoom, this.ghost);
  }

  /** The view a tree of a species drawn as a solid is baked for (`./trees3d`); nothing for any other. */
  private treeAt(species: number, x: number, y: number): TreeView | undefined {
    return TREE3D_SPECIES.has(species) && !this.still ? this.solidAt(x, y) : undefined;
  }

  /** And a bush's. */
  private bushAt(species: number, x: number, y: number): TreeView | undefined {
    return BUSH3D_SPECIES.has(species) && !this.still ? this.solidAt(x, y) : undefined;
  }

  /** And a stump's. */
  private stumpAt(species: number, x: number, y: number): TreeView | undefined {
    return STUMP3D_SPECIES.has(species) && !this.still ? this.solidAt(x, y) : undefined;
  }

  /** And felled logs': none on the low-end graphics, which draw them in the heap. */
  private logsAt(x: number, y: number): TreeView | undefined {
    return this.still ? undefined : this.solidAt(x, y);
  }

  private solidAt(x: number, y: number): TreeView {
    return { x, y, turn: this.camera.rotation, hour: this.solidHour, dark: this.solidDark, sway: this.solidSway ? swayAt(x, y, this.anim * 1000) : 0 };
  }

  /**
   * What the trees drawn as solids are baked for this frame, and the shade
   * they throw.
   *
   * The shade has to go down with the ground, a line at a time, before
   * anything standing on that line. So each line of ground has a picture of
   * all the shade falling on it, every tree's together so where two overlap
   * is no darker (`tree3dShadow`), laid with that line (`solidShadeLine`).
   *
   * A line's picture covers the screen and half a screen or more either side
   * of it, and the window it covers moves a quarter of a screen at a time: a
   * pan lays the same pictures further over and makes none. Which trees throw shade on which
   * line is read off the world when that window moves, the sun steps, or a
   * tile changes, not off what was drawn. And a picture is made again only
   * for so long a frame (`SHADE_MS`): a step of the sun or a move of the
   * window lays the last picture, a step behind, until its turn comes.
   */
  private solidFrame(ctx: CanvasRenderingContext2D, zoom: number, W: number, H: number, V: View, stepW: number, stepH: number, dLo: number, dHi: number): void {
    tree3dFrame();
    const hour = this.game.hourOfDay();
    this.solidHour = hour;
    this.solidDark = this.game.darkness();
    // The wind only while every frame of it for every tree in sight is a few screens of pictures.
    this.solidSway = !this.calm && this.zoomSettled && this.solidPx * SWAY_FRAMES < SWAY_PIXELS;
    this.solidPx = 0;
    const cam = this.camera;
    if (this.solidTurn !== cam.rotation) {
      this.solidTurn = cam.rotation;
      this.dropStrips(-Infinity, -Infinity);
    }
    this.solidShade = null;
    // How dark the shade is, in a few steps, so a dusk makes its pictures again only a few times.
    const alpha = Math.round(6 * (1 - this.solidDark)) * 0.045;
    this.solidAlpha = alpha < 0.02 ? 0 : alpha;
    // None drawn as solids with the low-end graphics: every tree and bush is flat and throws its own shade (`drawTree`).
    if ((!TREE3D_SPECIES.size && !BUSH3D_SPECIES.size) || alpha < 0.02 || this.still) {
      if (this.still) this.solidAlpha = 0;
      this.dropStrips(-Infinity, -Infinity);
      return;
    }
    const step = sunStepOf(hour, this.solidDark);
    const t = ctx.getTransform();
    const world = this.game.world;
    const season = this.year.season, day = this.year.day;
    // The window: the screen and at least half a screen either side, moved a quarter of a screen at a time.
    const qW = W / zoom / 4, halfH = H / zoom / 2;
    const wx0 = Math.floor((cam.cx - 4 * qW) / qW) * qW, wy0 = Math.floor((cam.cy - 2 * halfH) / halfH) * halfH;
    const wIso = 9 * qW;
    const scanKey = `${cam.rotation}|${wx0}|${wy0}|${this.solidRev}`;
    if (scanKey !== this.solidScan.key) {
      const trees: typeof this.solidScan.trees = [];
      // Room for the longest shade, thrown in from trees beyond the window.
      const pad = 8 * stepH;
      const d0 = Math.floor((wy0 - pad + world.minHeight * HEIGHT_SCALE) / stepH), d1 = Math.ceil((wy0 + 6 * halfH + pad + world.maxHeight * HEIGHT_SCALE) / stepH);
      const e0 = Math.floor((wx0 - pad * 2) / stepW) - 1, e1 = Math.ceil((wx0 + wIso + pad * 2) / stepW) + 1;
      let href = 0;
      const feet = new Map<number, number>();
      const footAt = new Map<number, Array<[number, number, number]>>();
      const footOf = new Map<number, [number, number, number, number]>();
      for (let d = d0; d <= d1; d++) {
        let e = e0;
        if (V.staggered && ((e + d) & 1) !== 0) e++;
        for (; e <= e1; e += V.staggered ? 2 : 1) {
          const x = V.x[0] + V.x[1] * d + V.x[2] * e, y = V.y[0] + V.y[1] * d + V.y[2] * e;
          if (!world.inBounds(x, y)) continue;
          const tile = world.getTile(x, y);
          if (tile !== TileType.Tree && tile !== TileType.Bush) continue;
          const data = world.getData(x, y);
          const bush = tile === TileType.Bush;
          const species = bush ? bushSpecies(data) : treeSpecies(data);
          if (!(bush ? BUSH3D_SPECIES : TREE3D_SPECIES).has(species)) continue;
          const variant = bush ? 0 : treeVariant(data);
          const u = cam.rotateX(x + 0.5, y + 0.5), v = cam.rotateY(x + 0.5, y + 0.5), h = world.centerHeight(x, y);
          const iy = (u + v) * HALF_H - h * HEIGHT_SCALE;
          const g = grownAt(x, y);
          trees.push({ ix: (u - v) * HALF_W, iy, x, y, species, variant, form: formAt(x, y), grew: g, h, bush });
          feet.set(d, Math.max(feet.get(d) ?? -Infinity, iy));
          let at = footAt.get(d);
          if (!at) footAt.set(d, (at = []));
          const reach = (bush ? bush3dFoot(species, x, y) : tree3dFoot(species, variant, x, y)) * g;
          at.push([(u - v) * HALF_W, iy, reach]);
          footOf.set(x * 65536 + y, [d, (u - v) * HALF_W, iy, reach]);
          href += h;
        }
      }
      // Rows of the screen to lines of ground, at about the height the trees stand at.
      this.solidScan = { key: scanKey, trees, top0: -(href / Math.max(1, trees.length)) * HEIGHT_SCALE, feet, footAt, footOf, lines: new Map(), linesKey: '' };
    }
    const scan = this.solidScan;
    // Where line d's band of shade starts: a step down for each line, and never above a foot on the line behind it.
    const bandTop = (d: number): number => Math.max(scan.top0 + d * stepH, scan.feet.get(d - 1) ?? -Infinity);
    // Which trees' shade falls on which line, and where, for this sun.
    const linesKey = `${step}|${season}${lookStep(day)}`;
    if (scan.linesKey !== linesKey) {
      // Kept as done only when every tree's shade is this sun's own, not one standing in for it.
      const was = tree3dStats.shadeStandIns;
      scan.lines = new Map();
      /*
       * Rows of the screen to lines of ground at the height the trees on the
       * screen stand at, not every tree in the window, which takes in trees on
       * other ground: a band a third of a line off the ground it is laid with
       * is covered by the next line's.
       */
      const sx0 = cam.cx - W / zoom / 2, sx1 = cam.cx + W / zoom / 2, sy0 = cam.cy - H / zoom / 2, sy1 = cam.cy + H / zoom / 2;
      const standing = scan.trees.filter((tr) => tr.ix > sx0 && tr.ix < sx1 && tr.iy > sy0 && tr.iy < sy1).map((tr) => tr.h).sort((a, b) => a - b);
      if (standing.length) scan.top0 = -standing[standing.length >> 1] * HEIGHT_SCALE;
      // Asked once for each shape a tree can be grown as, not once a tree.
      const shades = new Map<string, ReturnType<typeof tree3dShadow>>();
      for (const tr of scan.trees) {
        const kind = `${tr.bush ? 'b' : ''}${tr.species}|${tr.variant}|${tr.form}`;
        let shade = shades.get(kind);
        if (shade === undefined) shades.set(kind, (shade = tr.bush ? bush3dShadow(tr.species, season, day, tr.x, tr.y, step, cam.rotation) : tree3dShadow(tr.species, tr.variant, season, day, tr.x, tr.y, step, cam.rotation)));
        if (!shade) continue;
        const g = tr.grew;
        const [bx0, by0, bx1, by1] = shade.box;
        const part = { cv: shade.canvas, x: tr.ix + bx0 * g, y: tr.iy + by0 * g, w: (bx1 - bx0) * g, h: (by1 - by0) * g };
        for (let d = Math.floor((part.y - scan.top0) / stepH) - 1, end = Math.floor((part.y + part.h - scan.top0) / stepH) + 1; d <= end; d++) {
          let line = scan.lines.get(d);
          if (!line) scan.lines.set(d, (line = []));
          line.push(part);
        }
      }
      scan.linesKey = tree3dStats.shadeStandIns === was ? linesKey : '';
    }
    /*
     * The pictures: kept while nothing they show has changed, and made again
     * a few a frame when it has. When only the window has moved along the
     * line, the picture is moved over by as much and only the strip it has
     * not got yet is drawn: a pan along a wood lays the same shade.
     */
    const k = zoom * t.a * SHADE_RES;
    const sig = `${cam.rotation}|${this.solidRev}|${scan.linesKey}|${alpha}|${k.toFixed(3)}|${scan.top0}`;
    const t0 = performance.now();
    let remade = 0;
    const strips = new Map<number, { cv: HTMLCanvasElement; x: number; y: number; w: number; sx: number; sw: number; sh: number; h: number }>();
    const W1 = Math.ceil(wIso * k) + 2, H1 = Math.ceil(2 * stepH * k) + 2;
    const canvasFor = (cv?: HTMLCanvasElement): CanvasRenderingContext2D | null => {
      const c = cv ?? this.solidStripsFree.pop() ?? document.createElement('canvas');
      if (c.width < W1 || c.height < H1) {
        c.width = Math.max(c.width, W1);
        c.height = Math.max(c.height, H1);
      }
      return c.getContext('2d');
    };
    for (let d = dLo; d <= dHi; d++) {
      const parts = scan.lines.get(d);
      let had = this.solidStripsKept.get(d);
      if (!parts) {
        if (had) this.dropStrip(d, had);
        continue;
      }
      const top = bandTop(d);
      const bottom = Math.min(top + 2 * stepH, Math.max(top, bandTop(d + 1)));
      if (bottom <= top) {
        if (had) this.dropStrip(d, had);
        continue;
      }
      const fresh = !had || had.sig !== sig || had.top !== top || had.band !== bottom - top;
      const moved = !fresh && had!.x0 !== wx0;
      if (!had || ((fresh || moved) && performance.now() - t0 < SHADE_MS && remade < SHADE_PARTS)) {
        // What of the window is new: all of it, or the end it has moved on to.
        let from = 0, to = W1;
        let g: CanvasRenderingContext2D | null;
        if (!fresh && moved && had) {
          g = canvasFor();
          if (!g) continue;
          const dx = (had.x0 - wx0) * k;
          g.globalCompositeOperation = 'copy';
          g.drawImage(had.cv, dx, 0);
          g.globalCompositeOperation = 'source-over';
          if (dx > 0) { from = 0; to = Math.min(W1, Math.ceil(dx) + 1); } else { from = Math.max(0, Math.floor(W1 + dx) - 1); to = W1; }
          g.clearRect(from, 0, to - from, g.canvas.height);
          if (this.solidStripsFree.length < 64) this.solidStripsFree.push(had.cv);
        } else {
          g = canvasFor(had?.cv);
          if (!g) continue;
          g.globalCompositeOperation = 'source-over';
          g.clearRect(0, 0, g.canvas.width, g.canvas.height);
        }
        g.save();
        // Only its own band: a row more and the next line's shade would be laid twice there.
        g.beginPath();
        g.rect(from, 0, to - from, Math.ceil((bottom - top) * k));
        g.clip();
        let n = 0;
        for (const p of parts) {
          const px = (p.x - wx0) * k, pw = p.w * k;
          if (px + pw < from || px > to) continue;
          g.drawImage(p.cv, px, (p.y - top) * k, pw, p.h * k);
          n++;
        }
        // As see-through as it is laid, so laying it is a plain copy.
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = `rgba(30,56,66,${alpha})`;
        g.fillRect(from, 0, to - from, H1);
        g.restore();
        if (had) remade += n * zoom * zoom;
        had = { sig, cv: g.canvas, x0: wx0, top, wIso, k, band: bottom - top };
        this.solidStripsKept.set(d, had);
      }
      if (!had) continue;
      // Its rows on the screen, cut so each line's meet the next's with no row laid twice.
      const y0 = Math.round(t.d * ((had.top - cam.cy) * zoom + H / 2) + t.f);
      const y1 = Math.round(t.d * ((had.top + had.band - cam.cy) * zoom + H / 2) + t.f);
      if (y1 <= y0) continue;
      // Only what of it is on the screen.
      const x = t.a * ((had.x0 - cam.cx) * zoom + W / 2) + t.e;
      const per = had.k / (zoom * t.a);
      const sx0 = Math.max(0, -x * per), sx1 = Math.min(had.wIso * had.k, (ctx.canvas.width - x) * per);
      if (sx1 <= sx0) continue;
      strips.set(d, { cv: had.cv, x: x + sx0 / per, y: y0, w: (sx1 - sx0) / per, h: y1 - y0, sx: sx0, sw: sx1 - sx0, sh: had.band * had.k });
    }
    // Lines well off the screen are let go.
    this.dropStrips(dLo - 8, dHi + 8);
    if (strips.size) this.solidShade = { strips, kx: t.a * zoom, ox: t.a * (W / 2 - cam.cx * zoom) + t.e, ky: t.d * zoom, oy: t.d * (H / 2 - cam.cy * zoom) + t.f };
  }

  /** A line's kept shade picture put back to be used again. */
  private dropStrip(d: number, s: { cv: HTMLCanvasElement }): void {
    this.solidStripsKept.delete(d);
    if (this.solidStripsFree.length < 64) this.solidStripsFree.push(s.cv);
  }

  /** Every kept shade picture outside lines `lo` to `hi` let go. */
  private dropStrips(lo: number, hi: number): void {
    for (const [d, s] of this.solidStripsKept) if (d < lo || d > hi) this.dropStrip(d, s);
  }

  /**
   * The band of the solid trees' shade that line `d` of the ground lays
   * (`solidFrame`): not round the foot of a tree on the line behind, drawn
   * already, which had that much of it laid under it (`solidFoot`).
   */
  private solidShadeLine(ctx: CanvasRenderingContext2D, d: number): void {
    const shade = this.solidShade!;
    const strip = shade.strips.get(d);
    if (!strip) return;
    const t = ctx.getTransform();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const behind = this.solidScan.footAt.get(d - 1);
    let cut = false;
    if (behind) {
      const path = new Path2D();
      for (const [fx, fy, r] of behind) {
        const x = fx * shade.kx + shade.ox, y = fy * shade.ky + shade.oy, rx = r * shade.kx;
        if (x + rx < strip.x || x - rx > strip.x + strip.w || y + rx < strip.y || y - rx > strip.y + strip.h) continue;
        if (!cut) path.rect(strip.x, strip.y, strip.w, strip.h);
        cut = true;
        path.moveTo(x + rx, y);
        path.ellipse(x, y, rx, rx / 2, 0, 0, Math.PI * 2);
      }
      if (cut) {
        ctx.save();
        ctx.clip(path, 'evenodd');
      }
    }
    ctx.drawImage(strip.cv, strip.sx, 0, strip.sw, strip.sh, strip.x, strip.y, strip.w, strip.h);
    if (cut) ctx.restore();
    ctx.setTransform(t);
  }

  /**
   * The ground round a solid tree's or bush's foot, laid just before it: the
   * next line's shade there, which that line leaves out (`solidShadeLine`), so
   * the shade runs on under the tree with no edge; and a little darker still
   * right at the foot, fading to nothing.
   */
  private solidFoot(ctx: CanvasRenderingContext2D, ent: Entity, zoom: number): void {
    const shade = this.solidShade;
    const at = shade ? this.solidScan.footOf.get(ent.x * 65536 + ent.y) : undefined;
    if (!shade || !at) return;
    const [d, fx, fy, r] = at;
    const strip = shade.strips.get(d + 1);
    if (strip) {
      const t = ctx.getTransform();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const x = fx * shade.kx + shade.ox, y = fy * shade.ky + shade.oy, rx = r * shade.kx;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, rx / 2, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(strip.cv, strip.sx, 0, strip.sw, strip.sh, strip.x, strip.y, strip.w, strip.h);
      ctx.restore();
      ctx.setTransform(t);
    }
    const c = r * FOOT_CONTACT * zoom;
    ctx.globalAlpha = Math.min(1, this.solidAlpha / SOLID_ALPHA_DAY);
    ctx.drawImage(this.contactPicture(), ent.sx - c, ent.sy - c / 2, c * 2, c);
    ctx.globalAlpha = 1;
  }

  /** `contactPic`, made once: the ground shade's tone, darkest in the middle and gone at the rim. */
  private contactPicture(): HTMLCanvasElement {
    if (this.contactPic) return this.contactPic;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    if (g) {
      const ramp = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      for (const [at, a] of FOOT_CONTACT_RAMP) ramp.addColorStop(at, `rgba(30,56,66,${a})`);
      g.fillStyle = ramp;
      g.fillRect(0, 0, 128, 128);
    }
    return (this.contactPic = cv);
  }

  /** How far round its middle, in tiles, a thing of `w` by `h` subtiles stands that is drawn from `left` to `right` of it at zoom one (`standsOn`). */
  private footReach(w: number, h: number, left: number, right: number): number {
    return Math.max(Math.hypot(w, h) / 2 / SUBTILES, Math.max(-left, right) / (HALF_W * Math.SQRT2)) + FOOT_PAST;
  }

  /**
   * Something just drawn on the line being drawn that stands on the ground
   * (`Foot`): its middle in the world, `r` tiles round, drawn from the height
   * `sy` on the screen says. Its line's ground was laid before it, but the
   * lines in front of it lay theirs after: where that ground is under it, it
   * is drawn again over it (`footOver`), so it stands on its ground rather
   * than sunk into the next tile's. Under it is the round it stands over on
   * the screen, at the ground's height and at its own, and all between.
   */
  private standsOn(wx: number, wy: number, sy: number, r: number, zoom: number): void {
    if (this.lineNow === null || !this.entPaints.length || !this.paintBase) return;
    const cam = this.camera, world = this.game.world;
    const hb = (cam.worldToScreenY(wx, wy, 0) - sy) / (HEIGHT_SCALE * zoom);
    const xs: number[] = [], ys: number[] = [];
    for (let i = 0; i < FOOT_SIDES; i++) {
      const a = (i / FOOT_SIDES) * Math.PI * 2;
      const px = wx + Math.cos(a) * r, py = wy + Math.sin(a) * r, x = cam.worldToScreenX(px, py);
      xs.push(x, x);
      ys.push(cam.worldToScreenY(px, py, world.heightAt(px, py)), cam.worldToScreenY(px, py, hb));
    }
    const under = new Path2D();
    let l = Infinity, t = Infinity, rt = -Infinity, b = -Infinity;
    convexHull(xs, ys).forEach((i, k) => {
      if (k === 0) under.moveTo(xs[i], ys[i]);
      else under.lineTo(xs[i], ys[i]);
      l = Math.min(l, xs[i]);
      rt = Math.max(rt, xs[i]);
      t = Math.min(t, ys[i]);
      b = Math.max(b, ys[i]);
    });
    under.closePath();
    this.feet.push({ d: this.lineNow, under, box: [l - 2, t - 2, rt + 2, b + 2], shapes: this.entPaints.slice(), at: this.paintBase, after: [] });
  }

  /**
   * Something about to be drawn after a thing whose foot is drawn again over
   * the ground in front (`footOver`), and so in front of it: where it stands
   * near that foot, its drawings are kept to be drawn again after the foot
   * (`footShown`), so the foot does not come over it.
   */
  private footShy(ent: Entity, zoom: number): void {
    const body = ent.kind === 'player' || ent.kind === 'peer';
    const w = HALF_W * zoom * (body ? 0.45 : 0.7);
    const foot = ent.sy + (ent.drawDy ?? 0) - (ent.lift ?? 0) + HALF_H * zoom * 0.5;
    const l = ent.sx + (ent.drawDx ?? 0) - w, r = l + 2 * w, t = foot - HALF_H * zoom * 6;
    for (const f of this.feet) {
      if (f.box[0] > r || f.box[2] < l || f.box[1] > foot || f.box[3] < t) continue;
      (this.shyOf ??= []).push(f);
    }
  }

  /** The thing just drawn (`footShy`): its drawings kept with each foot it stands near. */
  private footShown(): void {
    if (!this.shyOf) return;
    for (const f of this.shyOf) f.after.push(...this.entPaints);
    this.shyOf = null;
  }

  /**
   * Tile (x, y) of line `d`, its ground laid, and what stands on a line
   * behind reaching out over it (`standsOn`): each drawn again over the part
   * of this tile's ground under it, before anything on this tile is. Ground
   * of this tile further out is in front of it, and a rise there still hides
   * it.
   */
  private footOver(ctx: CanvasRenderingContext2D, d: number, pts: ArrayLike<number>, minY: number, maxY: number): void {
    const minX = Math.min(pts[0], pts[2], pts[4], pts[6]), maxX = Math.max(pts[0], pts[2], pts[4], pts[6]);
    for (const f of this.feet) {
      if (f.d >= d || f.box[0] > maxX || f.box[2] < minX || f.box[1] > maxY || f.box[3] < minY) continue;
      ctx.save();
      try {
        ctx.beginPath();
        // The tile as its ground was laid, half a pixel bigger all round (`outsetTile`), and as far again as that edge is smoothed over.
        if (!this.outsetTile(ctx, pts, FOOT_SEAM)) {
          ctx.moveTo(pts[0], pts[1]);
          ctx.lineTo(pts[2], pts[3]);
          ctx.lineTo(pts[4], pts[5]);
          ctx.lineTo(pts[6], pts[7]);
          ctx.closePath();
        }
        ctx.clip();
        ctx.clip(f.under);
        for (const s of f.after.length ? [...f.shapes, ...f.after] : f.shapes) {
          ctx.setTransform(s.m ? f.at.multiply(s.m) : f.at);
          ctx.globalAlpha = s.alpha;
          s.draw(ctx, s.sx, s.sy);
        }
      } finally {
        ctx.restore();
      }
    }
  }




  /**
   * A tree or a bush, from a picture of it kept at exactly the size it is on
   * the screen, already leaning the way it grew and already mixed toward the
   * distance, put down on whole device pixels.
   *
   * It was rescaled and sheared afresh every frame for the wind, and those
   * are the two dearest things a picture can be put down with: a straight
   * copy of the same picture measured a seventh of the rescaled one and a
   * fifteenth of the sheared one, and a close view of a wood was spending
   * half its frame on nineteen trees. It does not sway: the wind's sway was
   * laid on as up to 24 bands of the picture, each a copy of its own, and a
   * wood in a breeze was three or four copies a tree every frame. Now it is
   * one.
   */
  private drawTree(ctx: CanvasRenderingContext2D, ent: Entity, spr: Sprite, zoom: number, grew: number): void {
    const dw = spr.w * zoom * grew;
    const dh = spr.h * zoom * grew;
    const left = ent.sx - spr.ax * zoom * grew;
    const top = ent.sy - spr.ay * zoom * grew;
    // A tree drawn as a solid throws its own shade, laid with the ground (`solidFrame`).
    if (!spr.solid && this.shadow.alpha > 0.012) this.castShadow(ctx, ent.sx, ent.sy, (spr.ay - (spr.h - spr.ay)) * 0.5 * zoom + dh * 0.12);
    // A solid one stands in the shade laid with the ground, which runs on under it (`solidFoot`).
    if (spr.solid && this.solidShade) this.solidFoot(ctx, ent, zoom);
    /*
     * Air between here and the back of the wood.
     *
     * Everything standing up was drawn at one strength whatever its
     * distance, so the far rank of a wood came forward as hard as the
     * near one and the whole thing flattened into a pattern. The screen
     * is the depth here -- in this projection a thing further away is a
     * thing higher up the picture -- so the top of the view is washed
     * toward the sky and the bottom is left alone. It is the same trick
     * the ground haze uses, and unlike the ground haze it has to keep
     * working when somebody zooms in, which is exactly where a wood
     * needed it most.
     */
    const far = Math.max(0, Math.min(1, 1 - (ent.sy + dh * 0.5) / (this.canvas.height * 0.82)));
    /*
     * The lean this one grew with: a shear about the foot, baked into its
     * picture (`treePicture`). There is no sway in the wind on top of it: a
     * tree stands still, and its picture is put down whole, in one copy.
     *
     * Nothing had one. Every tree on the island stood dead upright, which
     * is the single thing that made a wood read as one stamp printed a
     * hundred times however different the crowns were -- an array of
     * uprights is an array whatever is on top of the posts. Up to about
     * six degrees, its own for every tile, and either way.
     */
    const stand = (hash2(Math.round(ent.x), Math.round(ent.y), 9931) - 0.5) * 0.22;
    /*
     * Laid on thinner the further back it stands, so it takes up some of
     * whatever is behind it -- the meadow low down, the wood's own far
     * rank higher up, the sky over the top of all of it. In a picture
     * made of flat colour that is the whole of atmosphere: contrast and
     * chroma both come off with distance because the thing is literally
     * part ground now, and it costs one number.
     */
    /*
     * And a little off each tree on its own account, so no two of a
     * species are quite the same weight of green. A canopy is one sprite
     * per species per age however many hues the table carries, and sixty
     * tiles of one hue in a frame reads as one flat colour -- this is a
     * value jitter rather than a hue one, but against a ground it is the
     * same thing: every tree takes a different amount of the floor up
     * into itself.
     */
    // How far off it is, in steps, plus a little of its own so no two
    // trees of a species carry quite the same weight of colour.
    const own = 0.06 * hash2(Math.round(ent.x), Math.round(ent.y), 4231);
    const step = Math.min(HAZE_STEPS, Math.round((far * 0.94 + own) * HAZE_STEPS));
    const t = ctx.getTransform();
    if (t.b === 0 && t.c === 0 && t.a === t.d) {
      const wDev = Math.round(dw * t.a);
      const hDev = Math.round(dh * t.a);
      const pic = wDev > 0 && hDev > 0 ? this.treePicture(spr, `${ent.x},${ent.y}`, wDev, hDev, step, Math.round(stand * hDev)) : null;
      if (pic && spr.solid) this.solidPx += pic.cv.width * pic.cv.height;
      if (pic) {
        const cv = pic.cv;
        // How much it is stretched: not at all, unless it is this tree's picture at another size standing in while the zoom moves (`treePicture`).
        const k = hDev / pic.tall;
        const W = cv.width * k;
        const x = Math.round(t.a * ent.sx + t.e - pic.footX * k);
        const yf = t.d * ent.sy + t.f - pic.footY * k;
        const y = Math.round(yf);
        // A stretched one with its foot and head put on whole pixels.
        const d1 = Math.round(yf + cv.height * k);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (k === 1) ctx.drawImage(cv, x, y);
        else if (d1 > y) ctx.drawImage(cv, x, y, W, d1 - y);
        // In front of a runestone's runes after dark: the same picture, kept off them (`RunestoneNight`).
        if (this.runeNight.keeping) {
          this.runeNight.occludeDraw(ctx, x - 1, y, Math.ceil(W) + 2, Math.ceil(cv.height * k), (g) => {
            if (k === 1) g.drawImage(cv, x, y);
            else if (d1 > y) g.drawImage(cv, x, y, W, d1 - y);
          }, this.occClips);
        }
        ctx.restore();
        return;
      }
    }
    const ready = this.atSize(spr.canvas, dw, dh);
    const shown = step > 0 ? this.hazed(ready, step) : ready;
    if (Math.abs(stand) * dh < 1.5) {
      ctx.drawImage(shown, left, top, dw, dh);
      if (this.runeNight.keeping) this.runeNight.occlude(ctx, shown, left, top, dw, dh, this.occClips);
      return;
    }
    ctx.save();
    ctx.translate(ent.sx, ent.sy);
    ctx.transform(1, 0, stand, 1, 0, 0);
    ctx.drawImage(shown, left - ent.sx, top - ent.sy, dw, dh);
    // Under the same shear: what is kept off a runestone's runes is the tree as it leans.
    if (this.runeNight.keeping) this.runeNight.occlude(ctx, shown, left - ent.sx, top - ent.sy, dw, dh, this.occClips);
    ctx.restore();
  }

  /** The tree pictures (`drawTree`), most lately used last, and how many pixels they hold between them. */
  private treePics = new Map<string, TreePicture>();
  private treePixels = 0;
  private spriteIds = new WeakMap<HTMLCanvasElement, number>();
  /**
   * Each tree's latest picture at each haze step, whatever size it was made
   * at: what is put down, stretched, while the zoom moves, or while this
   * frame has made all the pictures it may (`TREE_PICTURE_MS`).
   */
  private treeOwn = new Map<string, (TreePicture | undefined)[]>();
  /** The colour the distance is mixed toward this frame, and the frame it was read in. */
  private hazeInk = '';
  private hazeRgb: [number, number, number] | null = null;
  private inkFrame = -1;
  /** The milliseconds spent making tree pictures in the frame `treeMakeFrame`, against `TREE_PICTURE_MS`. */
  private treeMadeMs = 0;
  /** How many device pixels of pictures of solid trees this frame has made (`SOLID_PICTURE_PX`). */
  private solidMade = 0;
  private treeMakeFrame = -1;

  /** A tree picture put away, and out of its tree's stand-ins if it was one. */
  private dropTreePicture(key: string, pic: TreePicture): void {
    this.treePics.delete(key);
    this.treePixels -= pic.cv.width * pic.cv.height;
    const own = this.treeOwn.get(pic.own);
    if (own?.[pic.haze] === pic) {
      own[pic.haze] = undefined;
      if (!own.some((p) => p)) this.treeOwn.delete(pic.own);
    }
  }

  /**
   * `spr` at `w` by `h` device pixels, sheared about its foot so its crown
   * stands `lean` pixels over, and mixed `haze` steps toward the distance:
   * the tree at `tree`.
   *
   * Made only for so long in a frame (`TREE_PICTURE_MS`), and while the
   * zoom moves only when the tree has none within `STAND_IN_MOST` of this
   * size. Otherwise the one it has stands in -- the same haze if it has it,
   * the nearest if not -- for whoever draws it to stretch: a zoom used to
   * make every tree on the screen afresh every frame of it, and threw them
   * all away the next. One mixed with the distance as it was earlier in the
   * day is made again as the light changes, in the same few milliseconds.
   * Null when the pictures in use this frame already fill `TREE_PIXELS`.
   */
  private treePicture(spr: Sprite, tree: string, w: number, h: number, haze: number, lean: number): TreePicture | null {
    let id = this.spriteIds.get(spr.canvas);
    if (id === undefined) {
      id = ++this.spriteCount;
      this.spriteIds.set(spr.canvas, id);
    }
    if (this.inkFrame !== this.frameNo) {
      this.inkFrame = this.frameNo;
      // Moved on only once the distance's colour has gone `HAZE_INK_STEP` off it: it moves through every dusk and dawn, and every move made every hazed tree again.
      const far = this.sky.far, was = this.hazeRgb;
      if (!was || Math.max(Math.abs(far[0] - was[0]), Math.abs(far[1] - was[1]), Math.abs(far[2] - was[2])) > HAZE_INK_STEP) {
        this.hazeRgb = [far[0], far[1], far[2]];
        this.hazeInk = css(far);
      }
    }
    const key = `${id}|${w}|${h}|${haze}|${lean}`;
    // A solid tree's bakes change with the sun, the turn and the wind, and any picture of the tree stands in for the next.
    const own = spr.solid ? `solid|${tree}` : `${id}|${tree}`;
    const had = this.treePics.get(key);
    const use = (pic: TreePicture, k: string): TreePicture => {
      pic.used = this.frameNo;
      this.treePics.delete(k);
      this.treePics.set(k, pic);
      return pic;
    };
    if (had && (haze === 0 || had.ink === this.hazeInk)) return use(had, key);
    if (this.treeMakeFrame !== this.frameNo) {
      this.treeMakeFrame = this.frameNo;
      this.treeMadeMs = 0;
      this.solidMade = 0;
    }
    // A solid tree's pictures are made a few a frame, too: a step of the sun changes every one of them at once (`SOLID_PICTURE_PX`).
    const may = this.treeMadeMs < TREE_PICTURE_MS && (!spr.solid || this.solidMade < SOLID_PICTURE_PX);
    if (had && (!may || !this.zoomSettled)) return use(had, key);
    if (!may || !this.zoomSettled) {
      const list = this.treeOwn.get(own);
      for (let d = 0; list && d <= HAZE_STEPS; d++) {
        const near = list[haze - d] ?? list[haze + d];
        if (near && (!may || (h <= near.tall * STAND_IN_MOST && h * STAND_IN_MOST >= near.tall))) return use(near, near.key);
        if (near) break;
      }
    }
    const t0 = performance.now();
    const made = this.makeTreePicture(spr, key, own, w, h, haze, lean);
    this.treeMadeMs += performance.now() - t0;
    if (spr.solid) this.solidMade += w * h;
    // No room for it: what this tree had stands in, rather than the sprite squeezed afresh every frame.
    if (!made && spr.solid) {
      const list = this.treeOwn.get(own);
      for (let d = 0; list && d <= HAZE_STEPS; d++) {
        const near = list[haze - d] ?? list[haze + d];
        if (near) return use(near, near.key);
      }
    }
    return made;
  }

  /** `treePicture`'s new picture, kept under `key`: null when there is no room. */
  private makeTreePicture(spr: Sprite, key: string, own: string, w: number, h: number, haze: number, lean: number): TreePicture | null {
    const had = this.treePics.get(key);
    if (had) this.dropTreePicture(key, had);
    const s = lean / h;
    const fx = (spr.ax / spr.w) * w;
    const fy = (spr.ay / spr.h) * h;
    /*
     * Only the part of it there is anything in, and a pixel round that for
     * the smoothing. A tree's sprite is cut with room for the biggest crown
     * and the longest lean the species has, and three quarters of a wood's
     * pictures were empty: copied every frame all the same, four screens of
     * pixels at zoom one where a screen does. Moved by whole pixels only, so
     * what is kept is the same picture to the pixel.
     */
    const [u0, v0, u1, v1] = this.spriteInk(spr);
    const x0 = Math.max(0, Math.floor(u0 * w) - 2), x1 = Math.min(w, Math.ceil(u1 * w) + 2);
    const y0 = Math.max(0, Math.floor(v0 * h) - 2), y1 = Math.min(h, Math.ceil(v1 * h) + 2);
    const ch = Math.max(1, y1 - y0);
    const lo = Math.min(0, s * (y0 - fy), s * (y1 - fy));
    const hi = Math.max(0, s * (y0 - fy), s * (y1 - fy));
    const ox = Math.ceil(-lo);
    const cw = Math.max(1, Math.ceil(x1 - x0 + ox + hi) + 1);
    // Room made by putting away what has gone longest unused, and never what this frame has drawn already.
    while (this.treePixels + cw * ch > TREE_PIXELS) {
      const first = this.treePics.entries().next();
      if (first.done || first.value[1].used === this.frameNo) return null;
      this.dropTreePicture(first.value[0], first.value[1]);
    }
    const cv = document.createElement('canvas');
    cv.width = cw;
    cv.height = ch;
    const g = cv.getContext('2d');
    if (!g) return null;
    g.setTransform(1, 0, s, 1, ox - x0 - s * fy, -y0);
    g.drawImage(spr.canvas, 0, 0, w, h);
    if (haze > 0) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = (haze / HAZE_STEPS) * 0.62;
      g.fillStyle = this.hazeInk;
      g.fillRect(0, 0, cw, ch);
    }
    const pic: TreePicture = { cv, footX: ox + fx - x0, footY: fy - y0, used: this.frameNo, own, haze, ink: this.hazeInk, key, tall: h };
    this.treePics.set(key, pic);
    this.treePixels += cw * ch;
    let list = this.treeOwn.get(own);
    if (!list) {
      list = [];
      this.treeOwn.set(own, list);
    }
    list[haze] = pic;
    return pic;
  }

  private spriteCount = 0;
  /** Where in each sprite there is anything, as shares of its width and height: left, top, right, bottom (`spriteInk`). */
  private inked = new WeakMap<HTMLCanvasElement, [number, number, number, number]>();

  /** The box round everything not see-through in a sprite, read off it once (`inkOf`), or as a solid tree's bake already read it. */
  private spriteInk(spr: Sprite): [number, number, number, number] {
    const src = spr.canvas;
    const had = this.inked.get(src);
    if (had) return had;
    const box = spr.ink ?? inkOf(src);
    this.inked.set(src, box);
    return box;
  }

  /** The ghost of what is being set down, over everything, and washed red where it will not go. */
  private drawGhost(ctx: CanvasRenderingContext2D, zoom: number, ghost: Ghost): void {
    const cam = this.camera;
    const world = this.game.world;
    /*
     * Over a cellar you are looking into, a piece goes down on its floor and
     * a way down stands in it, and both are drawn with the cellar; from up
     * top, a way down is the hole it would go down through.
     */
    const below = this.cellarFrame && this.game.buildings.cellarDone(ghost.x, ghost.y)
      && (ghost.kind === 'furniture' || ghost.level === 0);
    if (below !== this.inCellarPass) return;
    ctx.save();
    ctx.globalAlpha = 0.6;
    if (ghost.kind === 'furniture') {
      const [w, h] = furnitureFootprint(ghost.piece, ghost.facing);
      const wx = ghost.x + (ghost.sx + w / 2) / SUBTILES;
      const wy = ghost.y + (ghost.sy + h / 2) / SUBTILES;
      const px = cam.worldToScreenX(wx, wy);
      const py = cam.worldToScreenY(wx, wy, below ? cellarFloorHeight(this.game, ghost.x, ghost.y) : this.pieceBase({ kind: ghost.piece, level: ghost.level }, wx, wy));
      // A memorial stone is drawn as itself (`memorial.ts`), blank, as it will be set down.
      if (ghost.piece === MEMORIAL) drawMemorial(ctx, px, py, zoom, ghost.facing, cam.rotation, undefined, 0, this.anim);
      else if (isRuneLantern({ kind: ghost.piece })) {
        drawRuneLantern(ctx, px, py, zoom, { facing: ghost.facing, stage: 0, stages: PIECE_STAGES, variant: runeLanternVariant(ghost.x, ghost.y, ghost.sx, ghost.sy) }, cam.rotation, 0, this.anim);
      } else drawFurniture(ctx, px, py, zoom, ghost.piece, false, undefined, undefined, pieceView(ghost.facing, cam.rotation), ghost.material);
      if (!ghost.ok) {
        const [W, D] = furnitureSpan(ghost.piece);
        ctx.fillStyle = 'rgba(214, 58, 42, 0.5)';
        ctx.beginPath();
        ctx.ellipse(px, py, W * zoom, D * zoom, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const hand = ghost.floorKind === 'stairs' ? ghost.hand : undefined;
      const tile: FloorTile = { building: 0, level: ghost.level, x: ghost.x, y: ghost.y, material: ghost.material, kind: ghost.floorKind, facing: ghost.side, ...(hand ? { hand } : {}), ...floorBill(ghost.material, ghost.floorKind, undefined, hand) };
      // Out past the footprint, an outside staircase from the floor its head meets (`outsideStairBase`).
      const host = ghost.buildingId !== undefined && !this.game.buildings.buildingAt(ghost.x, ghost.y) ? this.game.buildings.list.get(ghost.buildingId) : undefined;
      const base = (host ? (hand === 's' ? spiralBase(this.game, host, ghost.x, ghost.y) : outsideStairBase(this.game, host, ghost.x, ghost.y, ghost.side)) : null)
        ?? this.game.buildings.buildingAt(ghost.x, ghost.y)?.deck ?? world.getHeight(ghost.x, ghost.y);
      if (ghost.level === 0 && !below && this.game.buildings.cellarDone(ghost.x, ghost.y)) this.cellars.drawOpening(tile, ghost.x, ghost.y, base, 0.6);
      else if (ghost.floorKind === 'stairs') this.stairs.drawStairs(tile, ghost.x, ghost.y, base, 0.6);
      else this.stairs.drawLadder(tile, ghost.x, ghost.y, base, 0.6, ghost.level > 0);
      if (!ghost.ok) {
        const px = cam.worldToScreenX(ghost.x + 0.5, ghost.y + 0.5);
        const py = cam.worldToScreenY(ghost.x + 0.5, ghost.y + 0.5, base + (ghost.level - 1) * WALL_HEIGHT);
        ctx.fillStyle = 'rgba(214, 58, 42, 0.5)';
        ctx.beginPath();
        ctx.ellipse(px, py, 18 * zoom, 9 * zoom, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * Which tiles are in the room the player is standing in, or null for
   * somebody out of doors.
   *
   * An unenclosed room still counts: a house with one wall left to build is
   * exactly the house you most want to see into, and a cutaway that waited
   * for the last wall would switch itself on at the moment it stopped being
   * needed.
   */
  private myRoom(): Set<string> | null {
    const p = this.game.player;
    const bld = this.game.buildings;
    if (!bld.list.size) return null;
    if (!bld.buildingAt(p.tileX, p.tileY) && !(p.level > 0 && bld.jettyAt(p.tileX, p.tileY))) return null;
    const room = bld.room(p.level, p.tileX, p.tileY);
    return room ? new Set(room.tiles) : null;
  }

  /** Whether a border is one of the room's own edges, or stands over it. */
  private wallsMyRoom(b: Border): boolean {
    return !!this.roomTiles && bordersRoom(this.roomTiles, b);
  }

  /**
   * Floors and walls belonging to a tile. Walls are drawn on the two borders
   * that are the tile's back edges under the current viewpoint, so every wall
   * is drawn exactly once, after the ground behind it and before whatever
   * stands in front. Walls of the player's own room go translucent once they
   * would hide the player, and what counts as "the player's" is the room they
   * are standing in rather than the whole building.
   *
   * Looked at square on — the four diagonal viewpoints — the two borders
   * running away from the viewer are edge on and draw as nothing at all, which
   * is what a wall seen end on looks like. Which of the pair is claimed still
   * matters: claim both sides of one border and it is drawn twice.
   */
  private drawStructures(x: number, y: number, V: View, inFront: boolean): void {
    const bld = this.game.buildings;
    const w = this.game.world;
    const inside = bld.buildingAt(this.game.player.tileX, this.game.player.tileY);
    const building = bld.buildingAt(x, y);
    const ground = w.getHeight(x, y);
    // A building on piers stands every storey on its deck (`piers.ts`); anything else on the ground.
    const base = building?.deck ?? ground;
    // A tile out past a footprint carrying a storey's floor: a jetty, at its building's floor height (`frame.ts`).
    const jetty = building ? undefined : bld.jettyAt(x, y);
    const floorBase = jetty ? (jettyBase(this.game, jetty, x, y) ?? base) : base;
    // One border across the top of the screen and one down a side, whichever
    // way we are looking: between them every wall on the island is claimed by
    // exactly one tile, and claimed by the tile in front of it.
    const backA: Border = borderOf(x, y, V.back[0]);
    const backB: Border = borderOf(x, y, V.back[1]);
    const playerLevel = this.game.player.level;
    const maxLevels = building ? building.levels : Math.max(1, this.maxLevelsAround(x, y));
    const cutaway = this.cutawayOn();
    // Looking into a cellar, a building with none under it is looked at as its ground floor is.
    const viewLevel = this.game.settings.viewLevel === null ? null : Math.max(0, this.game.settings.viewLevel);
    // Pinned on a storey, that storey and nothing else of any building (`storeyview.ts`).
    const pinned = this.game.pinnedStorey();
    // And one over a cellar is taken off, all of it, its jetties with it: only another building's wall on this tile's borders stands.
    const gone = (!!building && this.cut.has(building.id)) || (!!jetty && this.cut.has(jetty.id));
    // Pinned, only under a jetty with a floor on the storey shown.
    if (jetty && !gone && (pinned === null || bld.floor(pinned, x, y))) this.jettyShade(x, y, jetty);
    // Floors, stairs and ladders for each storey, walls of each storey, then the roof one level up.
    let columnsTo = -1;
    for (let level = 0; level <= maxLevels; level++) {
      /*
       * A ladder goes on after the walls of the storey it opens into: its
       * stiles stand up past the floor, in front of a wall on the far side
       * of the hatch, which laid after it covered them.
       */
      let late: (() => void) | null = null;
      // Under the ground floor of a tile on piers, the piers: see `piers.ts`.
      if (level === 0 && building && !gone && !this.storeyHidden(0) && bld.pierTiles.size && bld.onPiers(x, y)) this.drawPiers(x, y, V);
      const host = gone ? undefined : building ?? (level > 0 ? jetty : undefined);
      if (host) {
        const floor = bld.floor(level, x, y);
        /*
         * Looking at one storey means lifting the ceilings above it off, but
         * not the way up through them: a flight or a ladder stands in the
         * storey under the floor it climbs to, and a ladder loses only its
         * hatch.
         */
        const above = floor && viewLevel !== null ? floor.level - viewLevel : 0;
        const climb = !!floor && (floorKind(floor) === 'stairs' || floorKind(floor) === 'ladder');
        // Pinned, the storey's own floor, and the flights and ladders standing on it up to the next.
        if (floor && (pinned !== null ? above === 0 || (above === 1 && climb) : above <= 0 || (above === 1 && climb))) {
          // A floor over your head is the ceiling of the room you are in, and
          // only of that room: the far end of a longhouse keeps its own. A pinned storey's is drawn whole.
          const dim = pinned === null && level > playerLevel && !!this.roomTiles?.has(`${x},${y}`);
          const alpha = dim ? 0.35 : 1;
          // A way down from the ground floor is a hole in it, and only the top of the way down shows: see `drawOpening`.
          // Under a finished roof drawn whole over it -- you are not standing under it, nor looking into the storey --
          // it is not seen, and not drawn.
          const down = level === 0 && climb && !!bld.cellar(x, y);
          const lid = down && viewLevel === null && !this.roomTiles?.has(`${x},${y}`) ? bld.roofAt(host.levels, x, y) : undefined;
          if (down) {
            if (!lid || !isDone(lid)) this.cellars.drawOpening(floor, x, y, base, alpha);
          } else switch (floorKind(floor)) {
            case 'stairs':
              // A spiral staircase in its pieces, sorted with whoever climbs it (`takeSpiral`); pinned over it, only its head under the pinned floor.
              if (isSpiral(floor)) this.stairs.takeSpiral(floor, x, y, floorBase, alpha, pinned !== null && above === 0);
              // An outside staircase climbs from its building's floor, its top level with the storey it goes to (`jettyBase`).
              else this.stairs.drawStairs(floor, x, y, floorBase, alpha);
              break;
            case 'ladder':
              late = () => this.stairs.drawLadder(floor, x, y, base, alpha, above <= 0);
              break;
            case 'roof':
              // A flat roof is a deck, laid a tile at a time like a floor so
              // anybody out on it stands on it; a pitched one is laid whole,
              // after its walls: see `queueRoofs`.
              if (roofShapeOf(host) === 'flat') this.roofs.drawDeck(floor, x, y, floorBase, alpha);
              break;
            default:
              // A jetty overhangs on its joists or its corbels (`framing.ts`).
              if (jetty) this.drawJettyUnder(floor, jetty, x, y, floorBase, alpha);
              this.drawFloor(floor, x, y, floorBase, alpha);
          }
        }
      }
      if (level >= maxLevels || this.storeyHidden(level)) {
        late?.();
        // A railing round a flat roof stands on the roof's own level (`frame.ts`).
        if (level === maxLevels && !gone && !this.storeyHidden(level)) this.drawTerrace(x, y, level, [backA, backB], building ?? jetty, inFront);
        if (level >= maxLevels) break;
        continue;
      }
      // The shade of every wall round the tile, on the ground or on the floor
      // of the storey, before any wall of the storey stands on it -- on a
      // floor, that is: a hatch or a flight has none to take it.
      const slot = level ? bld.floor(level, x, y) : undefined;
      // Not on a jetty's floor, which stands at its building's height and not its ground's.
      if (!gone && (level === 0 || (!jetty && slot && (floorKind(slot) === 'floor' || floorKind(slot) === 'roof')))) this.groundShade(x, y, level, V);
      // The foot of a column put up before this tile, which its ground or floor has just covered.
      if (bld.columns.size) this.columnFootOn(x, y, V, level);
      for (const border of [backA, backB]) {
        const wall = bld.wallOnBorder(level, border);
        if (!wall) {
          /*
           * No wall here, planned or built. If the border is the edge of a
           * plan it is marked out instead, so a building that is nothing but
           * a footprint still looks like one.
           */
          const plan = bld.edgeOf(border);
          // A side with a column at an end of it is built, not marked out: it is open on purpose (`framing.ts`). Nor a side
          // marked No plan (`NoPlan`).
          if (plan && !(cutaway && building?.id !== plan.id) && !this.cut.has(plan.id) && !this.columnEnds(border) && !bld.noPlan(level, border)) {
            const [tx, ty] = border.dir === 'h'
              ? [border.x, bld.buildingAt(border.x, border.y) === plan ? border.y : border.y - 1]
              : [bld.buildingAt(border.x, border.y) === plan ? border.x : border.x - 1, border.y];
            // A finished deck on piers is built, not marked out: its edge is the edge of the deck.
            if (level === 0 && bld.pierTiles.size && this.game.pierDeckAt(tx, ty) !== null) continue;
            // Nothing stands in the air: an upper storey is only marked out
            // where there is a floor under it to mark out. Nor where the
            // storey goes on out over its own jetty, open to it (`frame.ts`).
            const [ox, oy] = border.dir === 'h' ? [tx, ty === border.y ? border.y - 1 : border.y] : [tx === border.x ? border.x - 1 : border.x, ty];
            if ((level === 0 || bld.floor(level, tx, ty)) && !(level > 0 && bld.floor(level, ox, oy)?.building === plan.id)) {
              this.drawScaffold(border, plan.deck ?? this.edgeGround(border), level, inside?.id === plan.id && inFront ? 0.35 : 1);
            }
          }
          // Two columns with no wall between them carry a beam (`framing.ts`).
          if (bld.columns.size) this.drawBeamOn(border, level, inFront);
          continue;
        }
        /*
         * Every wall is drawn once, by whichever tile has it as a back edge.
         * When that tile is not part of the wall's own building the wall
         * stands between the viewer and the inside: those are the ones a
         * cutaway takes away.
         */
        // A jetty's tile is its building's on the storeys it is floored on.
        const own = building ?? (level > 0 && jetty && bld.floor(level, x, y)?.building === jetty.id ? jetty : undefined);
        // A railing hides nothing behind it, and a balcony with its railings cut away is a shelf.
        if (cutaway && own?.id !== wall.building && wall.type !== 'railing' && !this.edgeOn(border)) continue;
        if (this.cut.has(wall.building)) continue;
        const dim = inFront && this.wallsMyRoom(border);
        // A railing hides little, and the edge you stand at reads as railed: it is let go no further than this.
        const alpha = dim ? (wall.type === 'railing' ? 0.7 : 0.3) : 1;
        // A building on piers stands its walls on its deck; a jetty's stand at its building's floor (`jettyWallBase`).
        const at = this.jettyWallBase(wall, border, (wall.building ? bld.list.get(wall.building)?.deck : undefined) ?? this.edgeGround(border));
        // Drawn after a pilaster it runs out from, it is drawn from the pilaster's face on.
        const guard = this.pilasterGuard(wall, border, at, V, x, y);
        if (guard) this.guardedWall(wall, border, at, alpha, guard);
        else this.walls.drawWall(wall, border, at, alpha);
        // And over a railing or a half wall between two columns, the beam they carry.
        if (bld.columns.size && WALL_TYPE_BY_ID.get(wall.type)?.low) this.drawBeamOn(border, level, inFront);
      }
      late?.();
      // The storey's columns on the corner this tile draws (`cornerClaim`), before the floor or the deck over them.
      if (bld.columns.size) this.drawColumnsAt(x, y, V, level, level);
      columnsTo = level;
    }
    // And any on storeys this tile's own did not reach (`drawColumnsAt` leaves out a hidden storey's).
    if (bld.columns.size) this.drawColumnsAt(x, y, V, columnsTo + 1, TOP_LEVELS);
  }

  /**
   * Whether a border runs straight away from the camera, so that a wall on it
   * has no face on the screen: at four of the eight turns, half the walls.
   * Such a wall stands between the viewer and nothing, so the cutaway leaves
   * it -- which side of its own line it is drawn from is a tie the sums
   * break either way, and the one it broke toward the street was taken away
   * with everything standing out of it, a shop counter's board and awning
   * among them.
   */
  private edgeOn(border: Border): boolean {
    const cam = this.camera;
    const [nx, ny] = border.dir === 'h' ? [0, 1] : [-1, 0];
    return Math.abs(cam.rotateX(nx, ny) + cam.rotateY(nx, ny)) < 1e-6;
  }

  /**
   * A tile on piers as its painter takes it (`piers.ts`), or null for one
   * that has no deck to stand under. Its open sides are the ones with no tile
   * of the building on piers beyond them; each corner's post is drawn by the
   * last of the building's tiles on piers round that corner to be drawn,
   * after the ground of every one of them, and kept off the decks of the
   * others, which were laid before it and stand over it (`hide`). `hide` is
   * only worked out when `withHide`, for the post; the feet do without it.
   */
  private pierTileAt(x: number, y: number, V: View, withHide: boolean): PierTile | null {
    const g = this.game;
    const bld = g.buildings;
    const b = bld.buildingAt(x, y);
    const deck = b?.deck;
    if (!b || deck == null) return null;
    const world = g.world;
    const mine = (tx: number, ty: number): boolean => bld.onPiers(tx, ty) && bld.buildingAt(tx, ty)?.id === b.id;
    const corners: Array<[number, number]> = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
    const posts = corners.map(([cx, cy]) => {
      const owner = this.drawnLast(V, cx, cy, mine);
      return !!owner && owner[0] === x && owner[1] === y;
    });
    const hide = corners.map(([cx, cy], i) => {
      if (!withHide || !posts[i]) return null;
      const decks: number[][] = [];
      for (const [tx, ty] of [[cx - 1, cy - 1], [cx, cy - 1], [cx - 1, cy], [cx, cy]] as Array<[number, number]>) {
        if ((tx !== x || ty !== y) && mine(tx, ty) && g.pierDeckAt(tx, ty) !== null) decks.push(slabOutline(this.camera, tx, ty, deck, deck - FLOOR_DEEP));
      }
      return decks.length ? decks : null;
    });
    const open = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => !mine(x + dx, y + dy));
    const floor = bld.floor(0, x, y);
    const planned = floor && floorKind(floor) === 'floor' ? floor : undefined;
    const water = world.hasWater(x, y) ? world.surfaceAt(x, y) : null;
    return {
      x, y, deck, ground: world.tileCorners(x, y), water,
      sea: water !== null && world.water?.levelAt(x, y) == null,
      open, posts, hide, material: planned?.material ?? null, progress: planned ? progressOf(planned) : 0,
      lit: g.vision.state(x, y) === VISIBLE,
      // The tile's own ground was edged a moment ago, half its width over the shade of the decks beside it.
      seam: Math.max(1, this.groundEdge) / 2,
    };
  }

  /** Of the tiles round a corner that pass `keep`, the one drawn last this frame: on the deepest line, and furthest along it. */
  private drawnLast(V: View, cx: number, cy: number, keep: (tx: number, ty: number) => boolean): [number, number] | null {
    const order = (tx: number, ty: number): number => depthOf(V, tx, ty) * 1e6 + V.e[0] + V.e[1] * tx + V.e[2] * ty;
    let best: [number, number] | null = null;
    for (const [tx, ty] of [[cx - 1, cy - 1], [cx, cy - 1], [cx - 1, cy], [cx, cy]] as Array<[number, number]>) {
      if (keep(tx, ty) && (!best || order(tx, ty) > order(best[0], best[1]))) best = [tx, ty];
    }
    return best;
  }

  /** The piers under a tile on piers, before its deck: see `piers.ts`. */
  private drawPiers(x: number, y: number, V: View): void {
    const p = this.pierTileAt(x, y, V, true);
    if (p) drawPierTile(this.canvas.ctx, this.camera, p);
  }

  /**
   * The water round the feet of the posts of a tile on piers, worked out as
   * its water goes down, before anything stands on it: each foot is laid
   * with the water of the tile in front of its corner, the last of the four
   * round it to be drawn -- now, if that is this tile, and otherwise when
   * that tile's water is down -- and never under the decks round it, in whose
   * shade it stands.
   */
  private pierFeetHere(x: number, y: number, V: View): void {
    const p = this.pierTileAt(x, y, V, false);
    if (!p || p.water === null) return;
    const bld = this.game.buildings;
    const cam = this.camera;
    for (const f of pierFeetOf(cam, p)) {
      const cx = Math.round(f.wx), cy = Math.round(f.wy);
      for (const [tx, ty] of [[cx - 1, cy - 1], [cx, cy - 1], [cx - 1, cy], [cx, cy]] as Array<[number, number]>) {
        if (!bld.onPiers(tx, ty)) continue;
        const q: number[] = [];
        for (const [qx, qy] of [[tx, ty], [tx + 1, ty], [tx + 1, ty + 1], [tx, ty + 1]]) q.push(cam.worldToScreenX(qx, qy), cam.worldToScreenY(qx, qy, f.h));
        f.under.push(q);
      }
      // A post with decks all round it stands in their shade, and nothing laps round it that shows.
      if (f.under.length === 4) continue;
      const front = this.drawnLast(V, cx, cy, () => true) ?? [x, y];
      const key = `${front[0]},${front[1]}`;
      const row = this.pierFeet.get(key);
      if (row) row.push(f);
      else this.pierFeet.set(key, [f]);
    }
  }

  /**
   * A name, or what somebody said, over a body: at once up top, and down in a
   * cellar once the whole of it is laid. A cellar is laid a line of the ground
   * at a time, and a flight standing in a nearer line went on over a name
   * that stood up into it.
   */
  /**
   * Words over somebody -- a name, what they said -- drawn level and square
   * at `x`, `y` on the screen. Aboard a boat they were drawn through her
   * sway with her, so a name leant and squashed with her heel: now only where
   * they go moves with her (`swayedAt`), and they are drawn out of it.
   */
  private words(ctx: CanvasRenderingContext2D, sway: Swayed | undefined, x: number, y: number, draw: (x: number, y: number) => void): void {
    const [ax, ay] = swayedAt(sway, x, y);
    if (!sway || this.inCellarPass) {
      this.cellars.overCellar(() => draw(ax, ay));
      return;
    }
    // Out of her sway, which is the last thing put on the canvas (`drawEntities`), and back into it after.
    ctx.restore();
    draw(ax, ay);
    swayIn(ctx, sway);
  }

  /**
   * The stretch across its tile a flight takes, in `stairPoint`'s coordinate
   * across: the whole of it for the wide one, and for a single one the half
   * on the hand it names as you climb -- which end of the run across that is
   * turns with the side it is climbed from.
   */
  static stairSpan(facing: Side, hand?: StairHand): [number, number] {
    return StairPainter.stairSpan(facing, hand);
  }

  /**
   * The shade the walls round a tile throw on it, laid over the tile's own
   * ground, or its floor on a storey, before anything stands on it.
   *
   * Entities cast a shadow and walls never had, which on three metres of
   * house nobody misses -- the wall is most of what you are looking at. On a
   * metre and a quarter of field wall the ground line is most of it, and a
   * plinth is the one course of a house that stands out past the face:
   * without the band of shade either puts on the grass it is a sticker laid
   * on the field.
   *
   * Every wall used to lay its own shade as it was drawn, and that went
   * wrong wherever two met. Two shades at a corner overlapped, and the
   * ground where they did was in the shade twice over: a darker square at
   * the foot of every corner of every house. And a wall's shade ran on past
   * its end into the tile across the corner, which is drawn after it, and
   * that tile's grass cut the shade off square. Laid here, all the shades
   * that reach a tile are one path and one fill, cut to the tile, so the
   * ground is in shade once however many walls put it there, and a tile
   * drawn later lays its own share rather than covering somebody else's.
   * Cut a hair past the tile: the tile in front strokes its outline half a
   * pixel into this one, and that half pixel is laid again by the tile that
   * covered it.
   */
  private groundShade(x: number, y: number, level: number, V: View): void {
    /*
     * From a picture of it (`baked`): the path and the clip cut to the tile,
     * every frame for every tile round every building, were over half of what a
     * settlement's buildings cost a frame from far out. Whether any shade
     * reaches the tile at all is kept beside the shades, so a tile with none
     * asks nothing.
     */
    const at = (level * 65536 + x) * 65536 + y;
    let any = this.shaded.get(at);
    if (any === undefined) {
      any = false;
      const b = this.shadeAsk;
      for (let i = 0; i < SHADE_BORDERS.length && !any; i += 3) {
        b.dir = SHADE_BORDERS[i] ? 'v' : 'h';
        b.x = x + SHADE_BORDERS[i + 1];
        b.y = y + SHADE_BORDERS[i + 2];
        any = this.shadeOf(level, b, V) !== null;
      }
      this.shaded.set(at, any);
    }
    if (!any) return;
    const cam = this.camera;
    const world = this.game.world;
    const rise = level * WALL_HEIGHT;
    const deck = this.game.buildings.buildingAt(x, y)?.deck;
    const h0 = deck ?? world.getHeight(x, y), h1 = deck ?? world.getHeight(x + 1, y);
    const h2 = deck ?? world.getHeight(x + 1, y + 1), h3 = deck ?? world.getHeight(x, y + 1);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [u, v, h] of [[0, 0, h0], [1, 0, h1], [1, 1, h2], [0, 1, h3]]) {
      const sx = cam.worldToScreenX(x + u, y + v), sy = cam.worldToScreenY(x + u, y + v, h + rise);
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    this.baked(`s|${level}|${x},${y}|${h0},${h1},${h2},${h3}`, cam.worldToScreenX(x, y), cam.worldToScreenY(x, y, h0 + rise), [x0 - 2, y0 - 2, x1 + 2, y1 + 2],
      () => this.groundShadeNow(x, y, level, V), this.structs.version(x, y, x, y), SHADE_BAKE);
  }

  /** `groundShade`, drawn. */
  private groundShadeNow(x: number, y: number, level: number, V: View): void {
    const cam = this.camera;
    const world = this.game.world;
    const ctx = this.canvas.ctx;
    ctx.beginPath();
    let any = false;
    // One border, moved round the twelve, rather than twelve made a tile: the shade is looked up by number (`shadeOf`).
    const b = this.shadeAsk;
    for (let i = 0; i < SHADE_BORDERS.length; i += 3) {
      b.dir = SHADE_BORDERS[i] ? 'v' : 'h';
      b.x = x + SHADE_BORDERS[i + 1];
      b.y = y + SHADE_BORDERS[i + 2];
      const p = this.shadeOf(level, b, V);
      if (!p) continue;
      any = true;
      // Four corners to a piece, each piece on one tile (`shadeOf`).
      for (let i = 0; i < p.length; i += 3) {
        const sx = cam.worldToScreenX(p[i], p[i + 1]), sy = cam.worldToScreenY(p[i], p[i + 1], p[i + 2]);
        if (i % 12 === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        if (i % 12 === 9) ctx.closePath();
      }
    }
    if (!any) return;
    const rise = level * WALL_HEIGHT;
    // On a building on piers, on its deck.
    const deck = this.game.buildings.buildingAt(x, y)?.deck;
    const corner = (cx: number, cy: number): [number, number] => [cam.worldToScreenX(cx, cy), cam.worldToScreenY(cx, cy, (deck ?? world.getHeight(cx, cy)) + rise)];
    const q = [corner(x, y), corner(x + 1, y), corner(x + 1, y + 1), corner(x, y + 1)];
    const mx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, my = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
    ctx.save();
    const clip = new Path2D();
    for (const [sx, sy] of q) {
      const l = Math.hypot(sx - mx, sy - my) || 1;
      clip.lineTo(sx + ((sx - mx) / l) * 0.8, sy + ((sy - my) / l) * 0.8);
    }
    clip.closePath();
    ctx.clip(clip);
    ctx.fillStyle = SHADE_INK;
    ctx.fill();
    ctx.restore();
  }

  /**
   * The ground a finished wall throws its shade on, as quads of world points
   * with their heights, four points to a quad and each quad on one tile, or
   * null for a wall that throws none.
   *
   * A garden wall shades both sides of itself, a distance out that goes with
   * how thick it is. A house wall on a masonry with a plinth shades the side
   * that is out of doors, further out: the plinth stands proud of the face.
   * A partition shades nothing. Along the run the shade goes from one end to
   * the other, and past an end only where the wall turns a corner and nothing
   * as big carries on: there it goes on round the corner as far as the other
   * wall's shade reaches, so the two together fill the angle outside it. At
   * a T or a cross it stops at the line of the wall across it, whose own
   * shade covers the rest.
   */
  private shadeOf(level: number, b: Border, V: View): Float64Array | null {
    const key = shadeKey(level, b);
    const had = this.shades.get(key);
    if (had !== undefined) return had;
    // Asked with `shadeAsk`, which the next ask moves: the rest of this is worked out from a copy.
    b = { dir: b.dir, x: b.x, y: b.y };
    const bld = this.game.buildings;
    const world = this.game.world;
    const found = (bb: Border): Wall | undefined => {
      const w = bld.wallOnBorder(level, bb);
      // A wall taken off over a cellar you are looking into throws nothing.
      return w && isDone(w) && !this.cut.has(w.building) ? w : undefined;
    };
    const halfOf = (w: Wall): number => {
      const k = WALL_TYPE_BY_ID.get(w.type);
      return (k?.railed ? FENCE_THICK : WALL_THICK) * (k?.thick ?? 1);
    };
    /** How far out a wall's shade reaches from its line, or 0 for a wall that throws none. */
    const reachOf = (w: Wall): number => {
      const cob = this.masonryOf(w);
      // A rune gate throws its own, under its pillars, in its picture (`runegate.ts`).
      if (!cob || isRuneGate(w)) return 0;
      if (WALL_TYPE_BY_ID.get(w.type)?.low) return 2.1 * halfOf(w);
      return cob.plinth && level === 0 ? 3.4 * halfOf(w) : 0;
    };
    /** The tile a border is drawn from: the one in front of it, which gives the wall its footing. */
    const from = (bb: Border): [number, number] => bb.dir === 'h'
      ? [bb.x, V.back.includes('n') ? bb.y : bb.y - 1]
      : [V.back.includes('w') ? bb.x : bb.x - 1, bb.y];
    const done = (out: Float64Array | null): Float64Array | null => { this.shades.set(key, out); return out; };
    const wall = found(b);
    if (!wall) return done(null);
    const [fx, fy] = from(b);
    // A wall the cutaway has taken away takes its shade with it: not one seen edge on, which it leaves (`edgeOn`).
    if (this.cutawayOn() && bld.buildingAt(fx, fy)?.id !== wall.building && !this.edgeOn(b)) return done(null);
    const reach = reachOf(wall);
    if (!reach) return done(null);
    const low = !!WALL_TYPE_BY_ID.get(wall.type)?.low;
    const [ax, ay] = borderPoints(b);
    const dx = b.dir === 'h' ? 1 : 0, dy = b.dir === 'h' ? 0 : 1;
    // Across the run: `+` is toward the tile at the border's own x and y for
    // a border along x, and away from it for one along y.
    const nx = -dy, ny = dx;
    const outside = (s: 1 | -1): boolean => {
      if (low) return true;
      const tx = b.dir === 'h' ? b.x : s > 0 ? b.x - 1 : b.x;
      const ty = b.dir === 'h' ? (s > 0 ? b.y : b.y - 1) : b.y;
      return bld.buildingAt(tx, ty)?.id !== wall.building;
    };
    const s0 = outside(-1) ? -reach : 0, s1 = outside(1) ? reach : 0;
    if (s0 === s1) return done(null);
    const tall = this.standing(wall, b), half = halfOf(wall);
    /** Where the shade stops at the `i` end, along the run. */
    const end = (i: -1 | 1): number => {
      const t = i < 0 ? 0 : 1, cx = ax + dx * t, cy = ay + dy * t;
      const next: Border = b.dir === 'h' ? { dir: 'h', x: b.x + i, y: b.y } : { dir: 'v', x: b.x, y: b.y + i };
      const on = found(next);
      if (on && this.standing(on, next) >= tall - 1e-6 && halfOf(on) >= half - 1e-9) return t;
      const arms = (b.dir === 'h'
        ? [{ dir: 'v', x: cx, y: cy - 1 }, { dir: 'v', x: cx, y: cy }]
        : [{ dir: 'h', x: cx - 1, y: cy }, { dir: 'h', x: cx, y: cy }]) as Border[];
      const met = arms.map(found).filter((w): w is Wall => !!w);
      if (met.length !== 1) return t;
      return t + i * Math.max(reachOf(met[0]), halfOf(met[0]));
    };
    const t0 = end(-1), t1 = end(1);
    /*
     * Laid on the ground it falls on, point by point: one height for the
     * whole of it put the half out of doors at the height of the wall's foot
     * over a slope falling away from it, and, looked at from the side the
     * tile in front is the one out of doors, at the height of that tile's far
     * corner -- a dark line a tile down the slope from the wall. Cut where
     * the run and the line of the wall cross a tile's edge, so each piece is
     * on one tile, and on a deck on piers at the deck's height.
     */
    const ts = [t0, ...[0, 1].filter((t) => t > t0 && t < t1), t1];
    const ss = s0 < 0 && s1 > 0 ? [s0, 0, s1] : [s0, s1];
    const rise = level * WALL_HEIGHT;
    const out = new Float64Array((ts.length - 1) * (ss.length - 1) * 12);
    let k = 0;
    for (let i = 0; i + 1 < ts.length; i++) {
      for (let j = 0; j + 1 < ss.length; j++) {
        const tm = (ts[i] + ts[i + 1]) / 2, sm = (ss[j] + ss[j + 1]) / 2;
        const deck = bld.buildingAt(Math.floor(ax + dx * tm + nx * sm), Math.floor(ay + dy * tm + ny * sm))?.deck;
        for (const [t, s] of [[ts[i], ss[j]], [ts[i + 1], ss[j]], [ts[i + 1], ss[j + 1]], [ts[i], ss[j + 1]]]) {
          const px = ax + dx * t + nx * s, py = ay + dy * t + ny * s;
          out[k++] = px;
          out[k++] = py;
          out[k++] = (deck ?? world.heightAt(px, py)) + rise;
        }
      }
    }
    return done(out);
  }

  /**
   * What a painted thing is the colour of.
   *
   * A limewash goes over the face and leaves the grain and the courses where
   * they are, so only the colours change and every line the material draws on
   * itself is drawn in the new one. Nothing is painted until somebody paints
   * it, so the common case costs one undefined check.
   */
  private painted(mat: MaterialDef, dye: string | undefined): MaterialDef {
    if (!dye) return mat;
    const d = dyeTint(dye);
    if (!d) return mat;
    const key = `${mat.id}:${dye}`;
    const had = this.paints.get(key);
    if (had) return had;
    const made: MaterialDef = { ...mat, color: hexRgb(d.colour), trim: hexRgb(d.shade), floor: hexRgb(d.colour) };
    this.paints.set(key, made);
    return made;
  }

  /** How a face turned the way a wall running `ux`, `uy` faces is lit: the light walls are drawn in. */
  private faceLight(ux: number, uy: number): number {
    const cam = this.camera;
    const vx = cam.rotateX(ux, uy);
    const along = Math.abs(vx);
    const into = Math.abs(cam.rotateY(ux, uy));
    const face = along / (along + into || 1);
    return 0.72 * (1 - face) + (vx > 0 ? 1 : 0.8) * face;
  }

  /**
   * A canvas the size of the screen, for something seen through: drawn on it
   * whole and then put over the picture at the alpha asked for, once, where
   * drawn straight on at that alpha every place two of its pieces overlap came
   * out darker than the rest. Cleared over `box` -- device pixels, the whole
   * of it when not given -- and set up to be drawn on as the screen is.
   */
  private seeThrough: CanvasRenderingContext2D | null = null;
  private seeThroughCtx(box?: [number, number, number, number]): CanvasRenderingContext2D {
    const el = this.canvas.el;
    if (!this.seeThrough || this.seeThrough.canvas.width !== el.width || this.seeThrough.canvas.height !== el.height) {
      const c = document.createElement('canvas');
      c.width = el.width;
      c.height = el.height;
      this.seeThrough = c.getContext('2d') as CanvasRenderingContext2D;
    }
    const g = this.seeThrough;
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (box) g.clearRect(...box);
    else g.clearRect(0, 0, g.canvas.width, g.canvas.height);
    g.setTransform(this.canvas.ctx.getTransform());
    g.globalAlpha = 1;
    g.lineJoin = 'round';
    return g;
  }

  // -------------------------------------------------------------------------
  // Jetties, railings and columns (`framing.ts`, `../game/frame.ts`).
  // -------------------------------------------------------------------------

  /**
   * Whether a storey's walls, floors, columns and beams are left out: looking
   * at one storey lifts every storey over it off, and looking into a cellar
   * every storey over the ground floor; pinned on a storey (`storeyview.ts`),
   * every storey but that one, under it as well as over it.
   */
  private storeyHidden(level: number): boolean {
    const v = this.game.settings.viewLevel;
    if (v === null) return false;
    return v < 0 ? level > 0 : level !== v;
  }

  /** Whether the walls between the eye and the inside are taken away: the cutaway button, pinned storey or not. */
  private cutawayOn(): boolean {
    return this.game.settings.cutaway;
  }

  /** Whether a column stands at either end of a border, on any storey. */
  private columnEnds(border: Border): boolean {
    const bld = this.game.buildings;
    if (!bld.columns.size) return false;
    const [ax, ay, bx, by] = borderPoints(border);
    return bld.hasColumnAt(ax, ay) || bld.hasColumnAt(bx, by);
  }

  /**
   * A crop on a garden bed (`gardenbed.ts`), stood on the bed's soil at the
   * middle of its tile: the height its floor is laid at (`drawFloorNow`), on
   * a jetty its building's floor. Seen as the floor under it is -- pinned on
   * that storey, or with nothing above the storey looked at taken off -- and
   * never waiting out a winter, as nothing on the glass clock does.
   */
  private takeBedCrop(crop: Crop, x: number, y: number, rotation: number): void {
    const level = crop.level ?? 0;
    const bld = this.game.buildings;
    if (this.pinned !== null && this.pinned !== level) return;
    const view = this.game.settings.viewLevel;
    if (view !== null && view >= 0 && level > view) return;
    const floor = bld.floor(level, x, y);
    if (!floor) return;
    const building = bld.buildingAt(x, y);
    const jetty = building ? undefined : bld.jettyAt(x, y);
    const ground = this.game.world.getHeight(x, y);
    const base = jetty ? (jettyBase(this.game, jetty, x, y) ?? ground) : (building?.deck ?? ground);
    const h = base + level * WALL_HEIGHT + 0.5;
    const cam = this.camera;
    const sx = cam.worldToScreenX(x + 0.5, y + 0.5), sy = cam.worldToScreenY(x + 0.5, y + 0.5, h);
    const def = cropDef(crop.id);
    const spr = this.still
      ? cropFlatSprite(crop.id, Math.min(3, crop.stage), def.look, def.colors[0], def.colors[1], false, crop.tendedNow, !cam.view.staggered)
      : cropSprite(crop.id, Math.min(3, crop.stage), def.colors[0], def.colors[1], false, crop.tendedNow, rotation, this.cropStep, Math.floor(hash2(x, y, 6151) * FIELD_LAYOUTS));
    this.take('crop', x, y, sx, sy, spr);
  }

  /** The height a building's floors are counted from: its deck on piers (`piers.ts`), or the ground at its first tile, as its own walls are drawn. */
  private buildingBase(id: number): number {
    const b = this.game.buildings.list.get(id);
    if (!b || !b.tiles.length) return 0;
    if (b.deck != null) return b.deck;
    const i = b.tiles[0].indexOf(',');
    return this.game.world.getHeight(+b.tiles[0].slice(0, i), +b.tiles[0].slice(i + 1));
  }

  /**
   * Where somebody else on the island stands on a bridge's deck at the storey
   * they are walking it at, up a ramp's slope too, as you do (`deckHeightAt`);
   * null off a deck, or under one walked at another storey.
   */
  private peerDeck(x: number, y: number, level: number): number | null {
    if (!this.game.bridges.size) return null;
    const b = this.game.bridgeAt(Math.floor(x), Math.floor(y));
    return b && bridgeLevels(b).includes(level) ? this.game.deckHeightAt(x, y) : null;
  }

  /** Where feet stand on a tile at a storey: up on a jetty, its building's floor; anywhere else, the ground. */
  private footOn(x: number, y: number, level: number): number {
    if (level > 0) {
      const j = this.game.buildings.jettyAt(Math.floor(x), Math.floor(y));
      const h = j ? jettyBase(this.game, j, Math.floor(x), Math.floor(y)) : null;
      if (h !== null) return h;
    }
    return this.footAt(x, y);
  }

  /**
   * The ground a wall, a railing or a plan's outline on a border stands on:
   * the corner the border starts from, which the tiles on both sides of it
   * share. Taken from the border and never from the tile that happens to draw
   * it, because which tile that is turns with the view: on a slope the other
   * tile's own corner is a tile away, and a wall drawn from it stood in the
   * air or down the face of a cliff. In the two views whose back edges are
   * the north and the west, the drawing tile's corner was this one already,
   * so those draw exactly as they did.
   */
  private edgeGround(border: Border): number {
    return this.game.world.getHeight(border.x, border.y);
  }

  /** The height a wall stands from: a jetty's at its building's floor, whatever the ground under it does. */
  private jettyWallBase(wall: Wall, border: Border, base: number): number {
    if (!wall.building) return base;
    const bld = this.game.buildings;
    const [ox, oy] = border.dir === 'h' ? [border.x, border.y - 1] : [border.x - 1, border.y];
    for (const [tx, ty] of [[border.x, border.y], [ox, oy]]) {
      const j = bld.jettyAt(tx, ty);
      if (j && j.id === wall.building) return jettyBase(this.game, j, tx, ty) ?? base;
    }
    return base;
  }

  /**
   * Where the floor of the jetty over a tile stands on the screen, as a cut
   * for what stands on the ground under it: the slab from its boards down
   * through the joists under it (`drawJettySupports`), which are over it and
   * in front of it wherever the two meet on the screen, while the walls on
   * the slab behind it are not. Drawn before the line's things (the tile is
   * on the line), so the thing is cut out of it rather than the slab laid
   * again. Null where no finished jetty floor is drawn over the tile: none,
   * the storey not looked at, or the building taken off over a cellar.
   * Worked out once a tile a frame.
   */
  private underJetty(ent: Entity): Path2D | null {
    const bld = this.game.buildings;
    const j = bld.jettyAt(ent.x, ent.y);
    if (!j) return null;
    const key = `${ent.x},${ent.y}`;
    const had = this.jettyCuts.get(key);
    if (had !== undefined) return had;
    let out: Path2D | null = null;
    for (let level = 1; level < j.levels && !this.cut.has(j.id); level++) {
      const f = bld.floor(level, ent.x, ent.y);
      if (!f || f.building !== j.id || floorKind(f) !== 'floor') continue;
      if (isDone(f) && !this.storeyHidden(level)) {
        const cam = this.camera;
        const top = (jettyBase(this.game, j, ent.x, ent.y) ?? this.game.world.getHeight(ent.x, ent.y)) + level * WALL_HEIGHT + 0.5;
        const pts: number[] = [];
        for (const h of [top, top - FLOOR_DEEP - JOIST_DEEP]) {
          for (const [px, py] of [[ent.x, ent.y], [ent.x + 1, ent.y], [ent.x + 1, ent.y + 1], [ent.x, ent.y + 1]]) {
            pts.push(cam.worldToScreenX(px, py), cam.worldToScreenY(px, py, h));
          }
        }
        const hull = hullOf(pts);
        out = new Path2D();
        out.rect(-1e5, -1e5, 2e5, 2e5);
        out.moveTo(hull[0], hull[1]);
        for (let i = 2; i < hull.length; i += 2) out.lineTo(hull[i], hull[i + 1]);
        out.closePath();
      }
      break;
    }
    this.jettyCuts.set(key, out);
    return out;
  }
  /** The jetty floors over tiles this frame, as `underJetty` cuts them. */
  private readonly jettyCuts = new Map<string, Path2D | null>();

  /** The ground under a jetty, in its shade: open ground, with a storey over it. */
  private jettyShade(x: number, y: number, jetty: Building): void {
    let over = false;
    for (let level = 1; level < jetty.levels && !over; level++) {
      const f = this.game.buildings.floor(level, x, y);
      // An outside staircase stands on the ground, and casts no storey's shade on it.
      over = !!f && f.building === jetty.id && isDone(f) && floorKind(f) !== 'stairs';
    }
    if (!over) return;
    const cam = this.camera;
    const w = this.game.world;
    const ctx = this.canvas.ctx;
    ctx.beginPath();
    for (const [cx, cy] of [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]]) {
      ctx.lineTo(cam.worldToScreenX(cx, cy), cam.worldToScreenY(cx, cy, w.getHeight(cx, cy)));
    }
    ctx.closePath();
    ctx.fillStyle = JETTY_SHADE;
    ctx.fill();
  }

  /** What a jetty's floor rests on, under it, before it is laid: its joists or its corbels, on the sides turned to the camera. */
  private drawJettyUnder(floor: FloorTile, jetty: Building, x: number, y: number, base: number, alpha: number): void {
    if (!isDone(floor) || floorKind(floor) !== 'floor') return;
    const bld = this.game.buildings;
    const steps: Array<[Side, number, number]> = [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]];
    // On its wall, or, that wall taken down, on the beam a column at each end of that side carries (`jettyOnWall`).
    const bears = bld.jettyBearer(jetty, floor.level, x, y)?.side
      ?? steps.find(([side, dx, dy]) => bld.tileIndex.get(`${x + dx},${y + dy}`) === jetty.id && bld.carried(floor.level - 1, borderOf(x, y, side)))?.[0];
    if (!bears) return;
    const open: Side[] = [];
    for (const [side, dx, dy] of steps) {
      if (side === bears) continue;
      const beyond = bld.floor(floor.level, x + dx, y + dy);
      if (beyond && beyond.building === jetty.id) continue;
      if (bld.tileIndex.get(`${x + dx},${y + dy}`) === jetty.id) continue;
      open.push(side);
    }
    drawJettySupports(this.canvas.ctx, this.camera, x, y, base + floor.level * WALL_HEIGHT + 0.5, floor.material, bears, open, alpha);
  }

  /** The railings round a flat roof that this tile draws: on its back borders, on the roof's own level. */
  private drawTerrace(x: number, y: number, level: number, backs: Border[], own: Building | undefined, inFront: boolean): void {
    const bld = this.game.buildings;
    const cutaway = this.cutawayOn();
    for (const border of backs) {
      const wall = bld.wallOnBorder(level, border);
      if (!wall || this.cut.has(wall.building)) continue;
      if (cutaway && own?.id !== wall.building && wall.type !== 'railing') continue;
      const dim = inFront && this.wallsMyRoom(border);
      const at = (wall.building ? bld.list.get(wall.building)?.deck : undefined) ?? this.edgeGround(border);
      this.walls.drawWall(wall, border, this.jettyWallBase(wall, border, at), dim ? (wall.type === 'railing' ? 0.7 : 0.3) : 1);
    }
  }

  /**
   * The beam two finished columns carry along a side with no full wall on it,
   * under what is over them. Seen through as the columns under it are: in
   * front of you in your room, or on a storey of it not your own.
   */
  private drawBeamOn(border: Border, level: number, inFront: boolean): void {
    const bld = this.game.buildings;
    if (!bld.carried(level, border)) return;
    const c = bld.column(level, border.x, border.y) as Column;
    if (this.cut.has(c.building)) return;
    const top = this.buildingBase(c.building) + (level + 1) * WALL_HEIGHT + 0.5 - FLOOR_DEEP;
    const dim = this.wallsMyRoom(border) && (inFront || level !== this.game.player.level);
    drawBeam(this.canvas.ctx, this.camera, border, top, c.material, dim ? 0.35 : 1);
  }

  /**
   * Per view, which of the four tiles round a corner draws its column, as an
   * offset back to the corner: the last but one of them to be drawn, after
   * the walls running away from the camera from the corner and before those
   * coming toward it. A pilaster is laid at the end of that tile's line
   * (`drawColumnsAt`).
   */
  private readonly claims = new Map<View, ReadonlyArray<readonly [number, number]>>();
  private cornerOrder(V: View): ReadonlyArray<readonly [number, number]> {
    const had = this.claims.get(V);
    if (had) return had;
    const offs: Array<[number, number]> = [[-1, -1], [0, -1], [-1, 0], [0, 0]];
    const key = ([ox, oy]: [number, number]): [number, number] => [V.d[1] * ox + V.d[2] * oy, V.e[1] * ox + V.e[2] * oy];
    offs.sort((a, b) => key(a)[0] - key(b)[0] || key(a)[1] - key(b)[1]);
    this.claims.set(V, offs);
    return offs;
  }
  private cornerClaim(V: View): readonly [number, number] {
    return this.cornerOrder(V)[2];
  }

  /** The four borders meeting on a corner, each with the way it runs out from it. */
  private static arms(cx: number, cy: number): Array<[Border, number, number]> {
    return [
      [{ dir: 'h', x: cx, y: cy }, 1, 0], [{ dir: 'h', x: cx - 1, y: cy }, -1, 0],
      [{ dir: 'v', x: cx, y: cy }, 0, 1], [{ dir: 'v', x: cx, y: cy - 1 }, 0, -1],
    ];
  }

  /** Half a finished wall's thickness, as it is drawn. */
  private static halfOf(w: Wall): number {
    const k = WALL_TYPE_BY_ID.get(w.type);
    return (k?.railed ? FENCE_THICK : WALL_THICK) * (k?.thick ?? 1);
  }

  /**
   * Whether a column stands engaged in walls: two or more finished full-height
   * walls of its storey meeting on its corner, which make it a pilaster
   * (`framing.ts`). As half the thickest of them, or 0 for a column standing free.
   */
  private engagedIn(level: number, cx: number, cy: number): number {
    const bld = this.game.buildings;
    let n = 0, half = 0;
    for (const [b] of Renderer.arms(cx, cy)) {
      const w = bld.wallOnBorder(level, b);
      if (!w || !isDone(w) || WALL_TYPE_BY_ID.get(w.type)?.low) continue;
      n++;
      half = Math.max(half, Renderer.halfOf(w));
    }
    return n >= 2 ? half : 0;
  }

  /**
   * Whether what stands on a border is drawn whole, as `drawStructures` draws
   * it: on a storey being looked at, not cut away, and not let go to be seen
   * through in front of you. A wall needs `w`; a beam is never cut away.
   */
  private drawnWhole(b: Border, level: number, V: View, w?: Wall): boolean {
    const cutaway = this.cutawayOn();
    if (this.storeyHidden(level)) return false;
    const bld = this.game.buildings;
    // The tile that draws it: the one it is a back edge of.
    const [tx, ty] = b.dir === 'h' ? (V.back.includes('n') ? [b.x, b.y] : [b.x, b.y - 1]) : (V.back.includes('w') ? [b.x, b.y] : [b.x - 1, b.y]);
    // Looking into a cellar, the building over it is not drawn at all; a beam is its columns'.
    if (this.cut.size && (w ? this.cut.has(w.building) : this.cut.has(bld.column(level, b.x, b.y)?.building ?? -1))) return false;
    if (w && cutaway && w.type !== 'railing' && !this.edgeOn(b)) {
      const building = bld.buildingAt(tx, ty);
      const jetty = building ? undefined : bld.jettyAt(tx, ty);
      const own = building ?? (level > 0 && jetty && bld.floor(level, tx, ty)?.building === jetty.id ? jetty : undefined);
      if (own?.id !== w.building) return false;
    }
    if (!this.wallsMyRoom(b)) return true;
    const p = this.game.player;
    const inFront = depthOf(V, tx, ty) > depthOf(V, p.tileX, p.tileY);
    return w ? !inFront : !(inFront || level !== p.level);
  }

  /**
   * What stands in front of a pilaster on corner `cx, cy`, or over it, and
   * hides it there: its storey's walls above its head, those coming toward the
   * camera from its face on, the beams on its head, and the walls and the
   * floors of the storey over it, each as it is drawn whole (`drawnWhole`).
   * It is drawn after all of them, with them cut out of it.
   */
  private pilasterCuts(level: number, cx: number, cy: number, base: number, head: number, r: number, V: View): Cut[] {
    const bld = this.game.buildings;
    const cam = this.camera;
    const cuts: Cut[] = [];
    const foot = base + level * WALL_HEIGHT;
    const arms = Renderer.arms(cx, cy);
    const c = bld.column(level, cx, cy);
    // How far past the corner a wall can run, joining the others there.
    let e = 0;
    for (const [b] of arms) for (const lv of [level, level + 1]) {
      const w = bld.wallOnBorder(lv, b);
      if (w && isDone(w)) e = Math.max(e, Renderer.halfOf(w));
    }
    for (const [b, dx, dy] of arms) {
      const w = bld.wallOnBorder(level, b);
      const full = !!w && isDone(w) && !WALL_TYPE_BY_ID.get(w.type)?.low;
      if (w && isDone(w) && this.drawnWhole(b, level, V, w)) {
        const half = w.type === 'railing' ? 0.05 : Renderer.halfOf(w);
        const top = foot + WALL_HEIGHT * this.standing(w, b);
        if (top > head) cuts.push({ x: cx, y: cy, dx, dy, t0: -e, t1: 1, half, h0: head, h1: top });
        if (cam.rotateX(dx, dy) + cam.rotateY(dx, dy) > 1e-6) {
          /*
           * A head level with the wall's top (`columnSpan`) is the stone at
           * the corner of the caps, and shows whole over them: only what of
           * it stands inside the wall, past its own reach, is cut.
           */
          const cap = top <= head + 1e-6 && c ? pilasterHead(c.material) : null;
          if (cap) {
            cuts.push({ x: cx, y: cy, dx, dy, t0: r, t1: 1, half, h0: foot, h1: top - cap.deep });
            cuts.push({ x: cx, y: cy, dx, dy, t0: r + cap.reach, t1: 1, half, h0: top - cap.deep, h1: top });
          } else cuts.push({ x: cx, y: cy, dx, dy, t0: r, t1: 1, half, h0: foot, h1: top });
        }
      }
      if (!full && bld.carried(level, b) && this.drawnWhole(b, level, V)) {
        const top = base + (level + 1) * WALL_HEIGHT + 0.5 - FLOOR_DEEP;
        cuts.push({ x: cx, y: cy, dx, dy, t0: 0, t1: 1, half: 0.05, h0: top - BEAM_DEEP, h1: top });
      }
      const up = bld.wallOnBorder(level + 1, b);
      if (up && isDone(up) && this.drawnWhole(b, level + 1, V, up)) {
        const h0 = foot + WALL_HEIGHT;
        cuts.push({ x: cx, y: cy, dx, dy, t0: -e, t1: 1, half: Renderer.halfOf(up), h0, h1: h0 + WALL_HEIGHT * this.standing(up, b) });
      }
    }
    // The floors and the decks of the storey over it round its corner, which lie over its head, drawn whole.
    const over = level + 1;
    if (!this.storeyHidden(over)) {
      const top = base + over * WALL_HEIGHT + 0.5;
      for (const [tx, ty] of [[cx - 1, cy - 1], [cx, cy - 1], [cx - 1, cy], [cx, cy]]) {
        const f = bld.floor(over, tx, ty);
        if (!f || !isDone(f)) continue;
        const kind = floorKind(f);
        const owner = bld.list.get(f.building);
        if (kind !== 'floor' && !(kind === 'roof' && owner && roofShapeOf(owner) === 'flat')) continue;
        // A ceiling over your room is let go to be seen through.
        if (over > this.game.player.level && this.roomTiles?.has(`${tx},${ty}`)) continue;
        cuts.push({ x: tx, y: ty + 0.5, dx: 1, dy: 0, t0: 0, t1: 1, half: 0.5, h0: top - FLOOR_DEEP, h1: top });
      }
    }
    return cuts;
  }

  /** Where a column stands on its storey and where its head is: under the floor or the eaves over it, or under a beam. */
  private columnSpan(level: number, cx: number, cy: number, base: number): [number, number] {
    const bld = this.game.buildings;
    const h0 = base + level * WALL_HEIGHT + (level > 0 ? 0.5 : 0);
    const round: Border[] = [{ dir: 'h', x: cx, y: cy }, { dir: 'h', x: cx - 1, y: cy }, { dir: 'v', x: cx, y: cy }, { dir: 'v', x: cx, y: cy - 1 }];
    const beamed = round.some((b) => bld.carried(level, b) && !(bld.wallOnBorder(level, b) && !WALL_TYPE_BY_ID.get(bld.wallOnBorder(level, b)!.type)?.low));
    /*
     * In the corner of walls with nothing over it -- no floor, no roof, no
     * storey -- it goes up to their head, and its own is the stone at the
     * corner of their caps. Stopped where a floor would have been, its head
     * stood a hand under the caps, a white notch at the corner of the top.
     */
    const walled = round.some((b) => {
      const w = bld.wallOnBorder(level, b);
      return !!w && isDone(w) && !WALL_TYPE_BY_ID.get(w.type)?.low && !WALL_TYPE_BY_ID.get(w.type)?.railed;
    });
    const open = walled && !beamed && !bld.column(level + 1, cx, cy)
      && ![[cx - 1, cy - 1], [cx, cy - 1], [cx - 1, cy], [cx, cy]].some(([x, y]) => bld.floor(level + 1, x, y))
      && !round.some((b) => bld.wallOnBorder(level + 1, b));
    return [h0, base + (level + 1) * WALL_HEIGHT + (open ? 0 : 0.5 - FLOOR_DEEP - (beamed ? BEAM_DEEP : 0))];
  }

  /**
   * The pilasters of the line of the ground being drawn, laid over its
   * structures and under its roofs and everything standing on it.
   */
  private readonly linePilasters: Array<() => void> = [];

  /**
   * The columns on the corner a tile draws (`cornerClaim`), storey by storey:
   * after the walls either side of the corner behind it and before those
   * coming toward the camera, and before the roof over them. A column
   * standing free goes up with the tile's own storey. A pilaster goes up at
   * the end of the tile's line (`linePilasters`), after every wall of the
   * line, with what hides it cut out of it (`pilasterCuts`), and before the
   * line's roofs and whatever stands on it in front. A wall coming toward the
   * camera from it whose tile is on a later line is drawn from its face on,
   * and what of that wall stands over its head goes on just before it
   * (`pilasterGuard`, `overHeads`).
   */
  private drawColumnsAt(x: number, y: number, V: View, from: number, to: number): void {
    const bld = this.game.buildings;
    const [ox, oy] = this.cornerClaim(V);
    const cx = x - ox, cy = y - oy;
    if (!bld.hasColumnAt(cx, cy)) return;
    for (let level = from; level <= to; level++) {
      const c = bld.column(level, cx, cy);
      // Looking into a cellar, a building over it goes, its columns with it.
      if (!c || this.storeyHidden(level) || this.cut.has(c.building)) continue;
      const engaged = this.engagedIn(level, cx, cy);
      // In sight from any tile round its corner, it takes the wash off remembered ground behind it (`liftColumn`).
      const lift = this.columnLift && this.cornerSeen(cx, cy) ? this.columnLift : null;
      if (engaged > 0) {
        this.linePilasters.push(() => {
          this.overHeads(level, cx, cy, V, engaged);
          this.columnOn(c, level, cx, cy, V, engaged, lift);
        });
      } else this.columnOn(c, level, cx, cy, V, engaged, lift);
    }
  }

  /** Whether any of the four tiles round corner `cx, cy` is in sight. */
  private cornerSeen(cx: number, cy: number): boolean {
    const v = this.game.vision;
    return v.state(cx - 1, cy - 1) === VISIBLE || v.state(cx, cy - 1) === VISIBLE || v.state(cx - 1, cy) === VISIBLE || v.state(cx, cy) === VISIBLE;
  }

  /**
   * One column, drawn: free, or a pilaster with what hides it cut out of it.
   * Seen through in the room you are in, in front of you or on a storey of it
   * not your own, as its walls are: a free column in front of you as the tile
   * that puts it up is, a pilaster as the last tile round its corner is, which
   * draws the walls coming toward the camera from it.
   */
  private columnOn(c: Column, level: number, cx: number, cy: number, V: View, engaged: number, lift: Path2D | null): void {
    const base = this.buildingBase(c.building);
    const [h0, h1] = this.columnSpan(level, cx, cy, base);
    const alpha = this.columnAlpha(level, cx, cy, V, engaged);
    const paint = c.dye ? this.painted(MATERIAL_BY_ID.get(c.material) as MaterialDef, c.dye).color : undefined;
    let cuts: Cut[] | undefined;
    if (engaged > 0) {
      // Worked out once a frame, though a pilaster is laid and its foot laid again.
      const key = `${level},${cx},${cy}`;
      cuts = this.frameCuts.get(key);
      if (!cuts) this.frameCuts.set(key, (cuts = this.pilasterCuts(level, cx, cy, base, h1, engaged + PILASTER_PROUD, V)));
    }
    /*
     * A head level with the walls' top is the stone at the corner of their
     * caps, so it is in the caps' stone (`Masonry.top`), not the column's own:
     * a white block on a marble house's dove-grey coping.
     */
    let cap: HeadTone | undefined;
    if (engaged > 0 && !paint && h1 >= base + (level + 1) * WALL_HEIGHT - 1e-6) {
      for (const [b] of Renderer.arms(cx, cy)) {
        const w = this.game.buildings.wallOnBorder(level, b);
        const top = w && isDone(w) ? this.masonryOf(w)?.top : undefined;
        if (!top) continue;
        cap = { body: top.shade, top: top.lit.map((v) => v / 1.18) as [number, number, number] };
        break;
      }
    }
    const laid = drawColumn(this.canvas.ctx, this.camera, cx, cy, h0, h1, c.material, progressOf(c), alpha, PLAN_COLOR, paint, this.canvas.dpr, level === 0, engaged, cuts, cap);
    if (lift && alpha >= 1 && laid !== null) this.liftColumn(lift, laid, cx, cy, h0, h1);
  }

  /**
   * Take the wash off a column in sight, where it comes up
   * the screen past the wash gathered behind it, as `liftWall` does a wall's:
   * its picture as it was laid (`liftPics`), or from far off its block, onto
   * `lift`. A column stands on a corner of the lattice, between two of the
   * wash's columns.
   */
  private liftColumn(lift: Path2D, laid: Body | number, cx: number, cy: number, h0: number, h1: number): void {
    const cam = this.camera;
    const e = Math.round((cam.worldToScreenX(cx, cy) - this.washX0) / this.washHw);
    const f = this.washFloor;
    const i = e * 2 - 1;
    if (i < 0 || i + 1 >= f.length) return;
    const top = typeof laid === 'number' ? cam.worldToScreenY(cx, cy, h1) - laid * this.washHw : laid.y;
    if (!(top < Math.max(f[i], f[i + 1]) - 0.5)) return;
    if (typeof laid === 'number') {
      const xs: number[] = [];
      const ys: number[] = [];
      for (const u of [-laid, laid]) for (const v of [-laid, laid]) for (const h of [h0, h1]) {
        xs.push(cam.worldToScreenX(cx + u, cy + v));
        ys.push(cam.worldToScreenY(cx + u, cy + v, h));
      }
      windOn(lift, xs, ys, convexHull(xs, ys));
    } else this.liftPics.push(laid);
    // Its foot, either side of its corner, is as far down the screen as it comes.
    const foot = typeof laid === 'number' ? cam.worldToScreenY(cx, cy, h0) + laid * this.washHw : laid.y + laid.h;
    const lf = this.liftFloor;
    lf[i] = Math.max(lf[i], foot);
    lf[i + 1] = Math.max(lf[i + 1], foot);
    this.lifted = true;
  }

  /** How far a column is let go to be seen through, as `columnOn` lays it. */
  private columnAlpha(level: number, cx: number, cy: number, V: View, engaged: number): number {
    const [ox, oy] = this.cornerOrder(V)[engaged > 0 ? 3 : 2];
    const p = this.game.player;
    const inFront = depthOf(V, cx + ox, cy + oy) > depthOf(V, p.tileX, p.tileY);
    const mine = !!this.roomTiles && [[cx - 1, cy - 1], [cx, cy - 1], [cx - 1, cy], [cx, cy]].some(([tx, ty]) => this.roomTiles?.has(`${tx},${ty}`));
    return mine && (inFront || level !== p.level) ? 0.35 : 1;
  }

  /** The pilasters' cuts of the frame being drawn (`columnOn`). */
  private readonly frameCuts = new Map<string, Cut[]>();

  /**
   * The foot of the column on the corner this tile is the last of the four
   * round, laid again over this tile's ground or floor: the column went up
   * before this tile was drawn (`drawColumnsAt`), and what of its foot stands
   * on this tile the ground laid since had covered.
   */
  private columnFootOn(x: number, y: number, V: View, level: number): void {
    const bld = this.game.buildings;
    const order = this.cornerOrder(V);
    const cx = x - order[3][0], cy = y - order[3][1];
    if (!bld.hasColumnAt(cx, cy)) return;
    const c = bld.column(level, cx, cy);
    if (!c || this.storeyHidden(level) || this.cut.has(c.building)) return;
    // The tile that put it up: a pilaster goes up at the end of its line, which is after this tile when this tile is on it.
    const engaged = this.engagedIn(level, cx, cy);
    if (engaged > 0 && depthOf(V, x, y) <= depthOf(V, cx + order[2][0], cy + order[2][1])) return;
    const w = this.game.world;
    const cam = this.camera;
    const ctx = this.canvas.ctx;
    const floorTop = this.buildingBase(c.building) + level * WALL_HEIGHT + 0.5;
    ctx.save();
    ctx.beginPath();
    for (const [px, py] of [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]]) {
      ctx.lineTo(cam.worldToScreenX(px, py), cam.worldToScreenY(px, py, level ? floorTop : w.getHeight(px, py)));
    }
    ctx.closePath();
    ctx.clip();
    this.columnOn(c, level, cx, cy, V, engaged, null);
    ctx.restore();
  }

  /**
   * How a finished wall running toward the camera from a pilaster's corner on
   * its storey is drawn when its tile is on a later line than the pilaster's
   * (on the diagonal turns). Inside the pilaster it is hidden, so it is drawn
   * from the pilaster's face on, as a railing's rails stop there
   * (`railEnds`): on the screen, on the `side` of `x` that the run goes, `x`
   * being where the face it shows meets the pilaster's face -- a true
   * vertical, put on a whole device pixel (`guardedWall`). Nearer the corner
   * than that it shows over the pilaster's head, and that stretch of it,
   * inside the box `over` on the screen, is laid just before the pilaster is,
   * which then covers what of the box is under its head (`overHeads`). Null
   * for any other wall, and for a railing, whose rails stop at the face
   * anyway.
   */
  private pilasterGuard(wall: Wall, border: Border, base: number, V: View, x: number, y: number): PilasterGuard | null {
    const bld = this.game.buildings;
    if (!bld.columns.size || !isDone(wall) || wall.type === 'railing') return null;
    const cam = this.camera;
    const [ax, ay, bx, by] = borderPoints(border);
    const [ox, oy] = this.cornerClaim(V);
    for (const [cx, cy, dx, dy] of [[ax, ay, bx - ax, by - ay], [bx, by, ax - bx, ay - by]]) {
      if (cam.rotateX(dx, dy) + cam.rotateY(dx, dy) <= 1e-6) continue;
      const c = bld.column(wall.level, cx, cy);
      if (!c || !isDone(c)) continue;
      // Drawn after the pilaster only if on a later line than the tile that lays it.
      if (depthOf(V, x, y) <= depthOf(V, cx + ox, cy + oy)) continue;
      const engaged = this.engagedIn(wall.level, cx, cy);
      if (!engaged) continue;
      // Which way the run goes across the screen. Seen end on, the pilaster's face is no line to stop at.
      const side = Math.sign(cam.worldToScreenX(cx + dx, cy + dy) - cam.worldToScreenX(cx, cy));
      if (!side) return null;
      // A point on the face the camera sees, `t` along from the corner and `s` faces out from the wall's line, as `drawWall` has it.
      const half = Renderer.halfOf(wall);
      const nx = -(by - ay) * half, ny = (bx - ax) * half;
      const toward = cam.nearSide(nx, ny);
      const at = (t: number, h: number, s = 1): [number, number] => {
        const wx = cx + dx * t + nx * toward * s, wy = cy + dy * t + ny * toward * s;
        return [cam.worldToScreenX(wx, wy), cam.worldToScreenY(wx, wy, h)];
      };
      const r = engaged + PILASTER_PROUD;
      const dpr = this.canvas.dpr;
      const edge = Math.round(at(r, 0)[0] * dpr) / dpr;
      const top = base + wall.level * WALL_HEIGHT + WALL_HEIGHT * this.standing(wall, border);
      const [, head] = this.columnSpan(wall.level, cx, cy, this.buildingBase(c.building));
      if (top <= head) {
        if (top < head - 1e-6) return { x: edge, side, over: null, head: null };
        /*
         * Its head is the stone at the corner of the caps and stands out
         * over this wall's top as far as it reaches: laid again over the
         * wall, kept to the head's box on the screen. Cut off at the
         * pilaster's face, the wall's cap was laid over the head's half.
         */
        const lv = wall.level;
        const cap = (): void => {
          const ctx = this.canvas.ctx;
          const { reach, deep } = pilasterHead(c.material);
          const R = engaged + PILASTER_PROUD + reach;
          const xs: number[] = [], ys: number[] = [];
          for (const u of [-R, R]) for (const v of [-R, R]) for (const h of [head - deep, head]) {
            xs.push(cam.worldToScreenX(cx + u, cy + v)); ys.push(cam.worldToScreenY(cx + u, cy + v, h));
          }
          ctx.save();
          ctx.beginPath();
          for (const i of convexHull(xs, ys)) ctx.lineTo(xs[i], ys[i]);
          ctx.closePath();
          ctx.clip();
          this.columnOn(c, lv, cx, cy, V, engaged, null);
          ctx.restore();
        };
        return { x: edge, side, over: null, head: null, cap };
      }
      /*
       * From the face's edge back past the corner as far as the face can run
       * on round it (`faceEnd`), from as low as the head's line along the
       * face goes there up to the back of the wall's top -- or past what
       * grows over the top, where nothing stands on it -- on whole device
       * pixels: a box, which costs a clip nothing.
       */
      let e = 0;
      for (const [b] of Renderer.arms(cx, cy)) {
        const w = bld.wallOnBorder(wall.level, b);
        if (w && isDone(w)) e = Math.max(e, Renderer.halfOf(w));
      }
      const far = -e - 0.02;
      const upper = bld.wallOnBorder(wall.level + 1, border);
      const crest = upper && isDone(upper) ? 0 : 6;
      const [hx, hy] = at(r, head), [fx, fy] = at(far, head);
      const low = Math.max(hy, fy);
      const high = Math.min(at(r, top + crest, -1.5)[1], at(far, top + crest, -1.5)[1]) - 1;
      const out = (v: number, up: boolean): number => (up ? Math.ceil(v * dpr) : Math.floor(v * dpr)) / dpr;
      const x0 = side > 0 ? out(fx, false) : edge, x1 = side > 0 ? edge : out(fx, true);
      // The head's line along the face, at either side of the box.
      const lineAt = (sx: number): number => hy + ((fy - hy) * (sx - hx)) / (fx - hx);
      return { x: edge, side, over: [x0, out(high, false), x1, out(low, true)], head: [lineAt(x0), lineAt(x1)] };
    }
    return null;
  }

  /**
   * A wall run toward the camera out of a pilaster laid before it, as its
   * guard says (`pilasterGuard`): from the pilaster's face on. What of it
   * stands over the pilaster's head nearer the corner went on before the
   * pilaster did (`overHeads`), and the two meet on a whole device pixel, so
   * nothing of the pilaster shows between them and nothing is laid twice.
   */
  private guardedWall(wall: Wall, border: Border, base: number, alpha: number, g: PilasterGuard): void {
    const ctx = this.canvas.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.side > 0 ? g.x : g.x - 1e5, -1e5, 1e5, 2e5);
    ctx.clip();
    this.walls.drawWall(wall, border, base, alpha);
    ctx.restore();
    g.cap?.();
  }

  /**
   * Where `drawStructures` draws the wall on a border on a storey, and how:
   * from the tile it is a back edge of, at that tile's base, let go to be
   * seen through in front of you in your room. Null where it is not drawn: on
   * a storey above the one looked at, past its tile's storeys, or cut away.
   */
  private wallAsDrawn(b: Border, level: number, V: View): { wall: Wall; base: number; alpha: number; x: number; y: number } | null {
    const bld = this.game.buildings;
    const wall = bld.wallOnBorder(level, b);
    if (!wall) return null;
    const cutaway = this.cutawayOn();
    if (this.storeyHidden(level)) return null;
    const [tx, ty] = b.dir === 'h' ? (V.back.includes('n') ? [b.x, b.y] : [b.x, b.y - 1]) : (V.back.includes('w') ? [b.x, b.y] : [b.x - 1, b.y]);
    const building = bld.buildingAt(tx, ty);
    if (level >= (building ? building.levels : Math.max(1, this.maxLevelsAround(tx, ty)))) return null;
    const jetty = building ? undefined : bld.jettyAt(tx, ty);
    const own = building ?? (level > 0 && jetty && bld.floor(level, tx, ty)?.building === jetty.id ? jetty : undefined);
    if (cutaway && own?.id !== wall.building && wall.type !== 'railing' && !this.edgeOn(b)) return null;
    if (this.cut.has(wall.building)) return null;
    const p = this.game.player;
    const dim = depthOf(V, tx, ty) > depthOf(V, p.tileX, p.tileY) && this.wallsMyRoom(b);
    // On its building's deck, on piers, as `drawStructures` stands it.
    const base = this.jettyWallBase(wall, b, (wall.building ? bld.list.get(wall.building)?.deck : undefined) ?? this.edgeGround(b));
    return { wall, base, alpha: dim ? (wall.type === 'railing' ? 0.7 : 0.3) : 1, x: tx, y: ty };
  }

  /**
   * What stands over a pilaster's head of the walls running toward the
   * camera from it whose tile draws them after it (`pilasterGuard`): the
   * back edges of the last tile round its corner, in the order that tile
   * draws them. Laid just before the pilaster, after every wall of its line,
   * so that the pilaster, and the column on its corner a storey up, which
   * stand over it, go on over it. A column standing free up there went up
   * with its tile, before this, and goes on again over it. Where the
   * pilaster is let go to be seen through, what of the wall is under its
   * head would show through it, so the box is cut along the head's line.
   */
  private overHeads(level: number, cx: number, cy: number, V: View, engaged: number): void {
    const ctx = this.canvas.ctx;
    const [ox, oy] = this.cornerOrder(V)[3];
    const ghost = this.columnAlpha(level, cx, cy, V, engaged) < 1;
    for (const b of [borderOf(cx + ox, cy + oy, V.back[0]), borderOf(cx + ox, cy + oy, V.back[1])]) {
      const d = this.wallAsDrawn(b, level, V);
      const g = d && this.pilasterGuard(d.wall, b, d.base, V, d.x, d.y);
      if (!d || !g?.over) continue;
      const [x0, y0, x1, y1] = g.over;
      ctx.save();
      ctx.beginPath();
      if (ghost && g.head) {
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, g.head[1]); ctx.lineTo(x0, g.head[0]);
        ctx.closePath();
      } else ctx.rect(x0, y0, x1 - x0, y1 - y0);
      ctx.clip();
      this.walls.drawWall(d.wall, b, d.base, d.alpha);
      const up = this.game.buildings.column(level + 1, cx, cy);
      if (up && !this.storeyHidden(level + 1) && !this.engagedIn(level + 1, cx, cy)) this.columnOn(up, level + 1, cx, cy, V, 0, null);
      ctx.restore();
    }
  }

  /** Storeys of any building touching a tile's borders, for tiles just outside a footprint. */
  private maxLevelsAround(x: number, y: number): number {
    let m = 0;
    for (const [dx, dy] of [
      [0, -1],
      [-1, 0],
      [1, 0],
      [0, 1],
    ]) {
      const b = this.game.buildings.buildingAt(x + dx, y + dy) ?? this.game.buildings.jettyAt(x + dx, y + dy);
      if (b && b.levels > m) m = b.levels;
    }
    return m;
  }

  /**
   * A slab poured over a tile, or the shuttering waiting for it.
   *
   * The top is one flat quad at the level chosen, drawn in whatever the tile
   * has been surfaced with — concrete until somebody paves it, and then the
   * paving, joints and all, because a foundation is ground you may pave. The
   * sides are the two the camera is on, each running from the ground's own
   * corner heights straight up to that level: that vertical face is the whole
   * of what a foundation is, and it is the thing you can put a wall against.
   */
  private drawFoundation(x: number, y: number, lit: boolean): void {
    const f = this.game.foundationAt(x, y);
    if (!f) return;
    const ctx = this.canvas.ctx;
    const cam = this.camera;
    const world = this.game.world;
    const c = world.tileCorners(x, y);
    /** The tile's four corners in world space, north, east, south, west. */
    const at: Array<[number, number]> = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
    /** Which way is out through the edge that leaves corner `i`. */
    const out: Array<[number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const px = (i: number): number => cam.worldToScreenX(at[i][0], at[i][1]);
    const py = (i: number, h: number): number => cam.worldToScreenY(at[i][0], at[i][1], h);
    const done = foundationDone(f);
    ctx.globalAlpha = lit ? 1 : 0.55;
    if (!done) {
      /*
       * Boards and string. A plan has no concrete in it yet, so drawing it as
       * a slab would be a lie you could walk into: what is there is the line
       * it will be poured to and the shutters holding it.
       */
      ctx.strokeStyle = PLAN_COLOR;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const p = i === 0 ? ctx.moveTo.bind(ctx) : ctx.lineTo.bind(ctx);
        p(px(i), py(i, f.top));
      }
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(px(i), py(i, c[i]));
        ctx.lineTo(px(i), py(i, f.top));
        ctx.stroke();
      }
      ctx.lineWidth = 1;
      ctx.globalAlpha = 1;
      return;
    }
    // The faces, nearest last so the one across the view lies over the one
    // running into it, as a wall's two faces do.
    const zoom = cam.zoom;
    /*
     * How far on the moss is (`greening.ts`): the days since it was poured or
     * scrubbed, a little further by water, as paving's is. On ground in sight
     * only, and not when the view is too far out to see a cushion.
     */
    const days = lit && zoom >= 0.6 ? slabGreen(this.game, f, this.greenAt) ?? 0 : 0;
    const wet = days > 0 ? this.walls.wetness(x, y) : 0;
    const grown = greenShows(days, 0, wet);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const [nx, ny] = out[i];
      if (cam.nearSide(nx, ny) <= 0) continue;
      const face = (): void => {
        ctx.beginPath();
        ctx.moveTo(px(i), py(i, f.top));
        ctx.lineTo(px(j), py(j, f.top));
        ctx.lineTo(px(j), py(j, c[j]));
        ctx.lineTo(px(i), py(i, c[i]));
        ctx.closePath();
      };
      // The face that runs across the view catches more light than the one
      // running into it: the same two tones every wall in the world uses.
      const lit = Math.abs(cam.rotateX(nx, ny)) > Math.abs(cam.rotateY(nx, ny)) ? 0.82 : 0.66;
      face();
      ctx.fillStyle = rgb(CONCRETE, lit);
      ctx.fill();
      /*
       * Board-marked, as concrete cast against shuttering is: a line where
       * each board met the next, every other board a shade off its
       * neighbour, and the holes the ties went through on every other line.
       * Straight across however the ground under it falls, because the
       * boards were set level and the ground was dug to them.
       */
      if (zoom >= 0.5) {
        ctx.save();
        face();
        ctx.clip();
        const lo = Math.min(c[i], c[j]);
        /** A point `t` of the way along the face, at height `h`. */
        const on = (t: number, h: number): [number, number] => {
          const wx = at[i][0] + (at[j][0] - at[i][0]) * t, wy = at[i][1] + (at[j][1] - at[i][1]) * t;
          return [cam.worldToScreenX(wx, wy), cam.worldToScreenY(wx, wy, h)];
        };
        for (let k = 0, h = f.top; h > lo; k++, h -= SHUTTER) {
          const [a0, b0] = [on(0, h), on(1, h)], [a1, b1] = [on(0, h - SHUTTER), on(1, h - SHUTTER)];
          if (k % 2) {
            ctx.beginPath();
            ctx.moveTo(a0[0], a0[1]); ctx.lineTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]); ctx.lineTo(a1[0], a1[1]);
            ctx.closePath();
            ctx.fillStyle = 'rgba(40, 36, 48, 0.05)';
            ctx.fill();
          }
          ctx.beginPath();
          ctx.moveTo(a1[0], a1[1]);
          ctx.lineTo(b1[0], b1[1]);
          ctx.strokeStyle = 'rgba(40, 36, 48, 0.2)';
          ctx.lineWidth = Math.max(0.7, zoom * 0.9);
          ctx.stroke();
          if (k % 2 === 1) {
            for (const t of [0.25, 0.75]) {
              const [tx, ty] = on(t, h - SHUTTER * 0.5);
              ctx.fillStyle = 'rgba(40, 36, 48, 0.35)';
              ctx.beginPath(); ctx.arc(tx, ty, Math.max(0.8, zoom * 1.1), 0, Math.PI * 2); ctx.fill();
            }
          }
        }
        ctx.restore();
      }
      /*
       * The moss on this face: cushions climbing from its foot along the
       * ground line, and a row along its top edge with the damp run down from
       * under it, more on a face turned from the sun in the south-east.
       */
      if (grown > 0) {
        // A north or a west face is the shady one, as a wall's is (`greenShows`).
        const st = Math.round(greenShows(days, nx + ny < 0 ? 1 : 0, wet) * PAVE_STAGES);
        const v = Math.floor(hashOf(x, y, i, 71) * 3);
        const lip = mossStrip('lip', v, st), foot = mossStrip('foot', (v + 1) % 3, st);
        if (lip || foot) {
          // Picture px to the screen: along the face, and straight down it at a metre to the metre.
          const up = (10 * HEIGHT_SCALE * zoom) / PPM;
          ctx.save();
          face();
          ctx.clip();
          if (lip) {
            ctx.save();
            ctx.transform((px(j) - px(i)) / (4 * PPM), (py(j, f.top) - py(i, f.top)) / (4 * PPM), 0, up, px(i), py(i, f.top));
            ctx.drawImage(lip, 0, 0);
            ctx.restore();
          }
          if (foot) {
            ctx.save();
            ctx.transform((px(j) - px(i)) / (4 * PPM), (py(j, c[j]) - py(i, c[i])) / (4 * PPM), 0, up, px(i), py(i, c[i]) - foot.height * up);
            ctx.drawImage(foot, 0, 0);
            ctx.restore();
          }
          ctx.restore();
        }
      }
      face();
      ctx.strokeStyle = rgb(CONCRETE_TRIM, 0.85);
      ctx.lineWidth = 1;
      ctx.stroke();
      // The arris along its top, where the light catches it.
      ctx.beginPath();
      ctx.moveTo(px(i), py(i, f.top));
      ctx.lineTo(px(j), py(j, f.top));
      ctx.strokeStyle = rgb(CONCRETE, Math.min(1.25, lit * 1.3));
      ctx.lineWidth = Math.max(1, zoom * 1.2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    const quad = new Float64Array(8);
    for (let i = 0; i < 4; i++) {
      quad[i * 2] = px(i);
      quad[i * 2 + 1] = py(i, f.top);
    }
    ctx.beginPath();
    ctx.moveTo(quad[0], quad[1]);
    ctx.lineTo(quad[2], quad[3]);
    ctx.lineTo(quad[4], quad[5]);
    ctx.lineTo(quad[6], quad[7]);
    ctx.closePath();
    const t = world.viewTile(x, y, lit) as TileType;
    const data = world.viewData(x, y, lit);
    const paved = PAVED.has(t);
    const base = !paved ? CONCRETE : t === TileType.Slabs ? SLAB_VARIANTS[slabVariant(data)].color : (TILE_DEFS[t]?.color ?? CONCRETE);
    ctx.fillStyle = rgb(base, 0.97);
    ctx.fill();
    ctx.strokeStyle = rgb(CONCRETE_TRIM, 0.9);
    ctx.stroke();
    // A floor's corners are already in the tile's own order, so nothing turns.
    if (cam.zoom >= 0.75) {
      if (paved) this.paving(t, x, y, data, quad, 0, lit);
      else {
        this.laidOver(concrete(), quad, 0, 'overlay');
        // And moss in the margin tooled round a bare top.
        const top = grown > 0 ? slabTopMoss(Math.round(grown * PAVE_STAGES)) : null;
        if (top) this.laidOver(top, quad, 0, 'source-over');
      }
    }
    if (f.pool) {
      const water = this.springWater;
      drawPool(ctx, cam, {
        x, y, top: f.top, time: lit ? this.anim : null, concrete: CONCRETE,
        poolTop: (px, py) => {
          const o = this.game.foundationAt(px, py);
          return o?.pool && foundationDone(o) ? o.top : null;
        },
        slabTop: (px, py) => {
          const o = this.game.foundationAt(px, py);
          return o && foundationDone(o) ? o.top : null;
        },
        spillsAt: (px, py) => world.water?.spillsAt(px, py),
        channels: this.game.bridges.size ? (px, py) => this.aqueducts.cutsAt(px, py) : undefined,
        ground: (cx, cy) => world.getHeight(cx, cy),
        falls: world.water ? {
          view: water.view,
          row: (tx, ty) => depthOf(cam.view, tx, ty),
          foot: (row, placed, u0, u1) => water.footAfter(row, placed, u0, u1),
          mist: (placed) => water.mistOf(placed),
          foam: water.foam,
        } : undefined,
        runs: this.poolRuns,
      });
    }
    ctx.globalAlpha = 1;
  }

  /**
   * A floor, laid rather than coloured in: see `flooring.ts` for what each
   * material lays one in.
   *
   * It was one lozenge of the material's floor colour a tile, with boards
   * ruled over the woods and a grid over every stone, so oak and pine were
   * one floor in two browns and brick, marble and slate one chequer in three
   * colours. The floor is a picture now, laid as a pattern fixed to the
   * world, so a room is one floor and a board runs on over the join between
   * two tiles of it. Boards run the way the building runs, which is what
   * makes a room of them read as one floor rather than as a grid of tiles
   * each doing its own thing.
   *
   * An upper floor has a thickness wherever nothing carries on from it and
   * the camera can see its edge: at the edge of the storey, and round the
   * well a flight comes up through. A ladder's hatch cuts its own.
   */
  private drawFloor(floor: FloorTile, x: number, y: number, base: number, alpha: number): void {
    /*
     * Seen through: as it always was. Otherwise a picture (`baked`), after dark
     * as well: nothing in a floor's drawing reads the light (a lamp's pool is
     * the night's, `lightLayers`), and every floor of a settlement was drawn
     * afresh every frame of every night for it.
     */
    if (alpha < 1) {
      this.drawFloorNow(floor, x, y, base, alpha);
      return;
    }
    const cam = this.camera;
    const h = base + floor.level * WALL_HEIGHT;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [u, v] of [[-0.4, -0.4], [1.4, -0.4], [1.4, 1.4], [-0.4, 1.4]]) {
      for (const z of [h - WALL_HEIGHT * 0.4, h + WALL_HEIGHT * 0.25]) {
        const sx = cam.worldToScreenX(x + u, y + v), sy = cam.worldToScreenY(x + u, y + v, z);
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
    }
    const key = `f|${floor.level}|${x},${y}|${floor.material}|${floor.kind ?? ''}|${floor.dye ?? ''}|${isDone(floor) ? 1 : 0}|${base}`;
    this.baked(key, cam.worldToScreenX(x, y), cam.worldToScreenY(x, y, h), [x0, y0, x1, y1], () => this.drawFloorNow(floor, x, y, base, alpha),
      this.structs.version(x, y, x, y), FLOOR_BAKE);
  }

  private drawFloorNow(floor: FloorTile, x: number, y: number, base: number, alpha: number): void {
    const ctx = this.canvas.ctx;
    const cam = this.camera;
    const bare = MATERIAL_BY_ID.get(floor.material);
    if (!bare) return;
    const paint = floor.dye ? this.painted(bare, floor.dye).color : undefined;
    const fl = flooring(floor.material, paint);
    const h = base + floor.level * WALL_HEIGHT + 0.5;
    const done = isDone(floor);
    /** A point on the deck, by its two shares across the tile, and `dh` under it. */
    const fx = (u: number, v: number): number => cam.worldToScreenX(x + u, y + v);
    const fy = (u: number, v: number, dh = 0): number => cam.worldToScreenY(x + u, y + v, h - dh);
    const corners: Array<[number, number]> = [[0, 0], [1, 0], [1, 1], [0, 1]];
    ctx.globalAlpha = alpha * (done ? 1 : 0.4);
    if (done) {
      /*
       * A hair past its own edges, so nothing of what is under it shows
       * between it and the next tile of it -- except seen through, where the
       * hair laid twice is a line across the ceiling.
       */
      const cx = fx(0.5, 0.5), cy = fy(0.5, 0.5), grow = alpha < 1 ? 0 : 0.5;
      ctx.beginPath();
      for (const [u, v] of corners) {
        const px = fx(u, v), py = fy(u, v), l = Math.hypot(px - cx, py - cy) || 1;
        ctx.lineTo(px + ((px - cx) / l) * grow, py + ((py - cy) / l) * grow);
      }
      ctx.closePath();
      // Glass over your head is a tint of its colour: its lead drawn faint was a second grid over the room under it.
      if (alpha < 1 && bare.seeThrough) {
        ctx.fillStyle = rgb(fl.mean, 0.4);
        ctx.fill();
        ctx.globalAlpha = 1;
        return;
      }
      const mip = this.roofs.roofMip(FLOOR_PPT), k = 1 / (FLOOR_PPT >> mip);
      // Boards run with the building: along one axis on one storey and across it on the next.
      const turned = fl.runs && (floor.building + floor.level) % 2 === 1;
      const key = `${floor.material}:${floor.dye ?? ''}:${mip}`;
      let pat = this.floorPatterns.get(key);
      if (!pat) {
        pat = ctx.createPattern(fl.mips[mip], 'repeat') ?? undefined;
        if (pat) this.floorPatterns.set(key, pat);
      }
      if (pat) {
        const sx = cam.worldToScreenX(0, 0), sy = cam.worldToScreenY(0, 0, h);
        const ax = cam.worldToScreenX(k, 0) - sx, ay = cam.worldToScreenY(k, 0, h) - sy;
        const bx = cam.worldToScreenX(0, k) - sx, by = cam.worldToScreenY(0, k, h) - sy;
        pat.setTransform(new DOMMatrix(turned ? [bx, by, ax, ay, sx, sy] : [ax, ay, bx, by, sx, sy]));
        ctx.fillStyle = pat;
      } else {
        ctx.fillStyle = rgb(fl.mean, 1);
      }
      ctx.fill();
    } else {
      ctx.beginPath();
      for (const [u, v] of corners) ctx.lineTo(fx(u, v), fy(u, v));
      ctx.closePath();
      ctx.fillStyle = rgb(fl.mean, 1);
      ctx.fill();
      // Out on a jetty the plan hangs in front of the wall under it, which a faint line is lost on.
      if (floor.level > 0 && !this.game.buildings.tileIndex.has(`${x},${y}`)) ctx.globalAlpha = alpha;
      ctx.strokeStyle = PLAN_COLOR;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    /*
     * And the edge of the deck, where there is nothing to carry on into. A
     * floor is joists and boards and it has a depth, under the deck walked
     * on: drawn without one it ends in a line, which is the one thing a floor
     * five metres up never does, and drawn standing up from its edge it is a
     * kerb round every hole in it. It is edged in what its flights are built
     * of, the board or the stone along their sides.
     */
    const bld = this.game.buildings;
    // The ground floor of a tile on piers is a deck standing clear of the ground, and it has an edge too.
    const decked = floor.level === 0 && bld.pierTiles.size > 0 && bld.onPiers(x, y);
    if (done && (floor.level > 0 || decked)) {
      const st = stairStyle(floor.material);
      const lum = (c: readonly [number, number, number]): number => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
      const C = (c: readonly [number, number, number], k: number, a = 1): string =>
        paint ? rgb(paint, k * Math.max(0.6, Math.min(1.3, lum(c) / Math.max(1, lum(st.string)))), a) : rgb(c, k, a);
      /*
       * The two edges facing the camera, whichever two those are: turn the
       * view and the other pair comes round, the same rule a wall uses to
       * pick the face it shows.
       */
      const edges: Array<[number, number, number, number, number, number]> = [
        [0, 0, 1, 0, 0, -1],
        [1, 0, 1, 1, 1, 0],
        [1, 1, 0, 1, 0, 1],
        [0, 1, 0, 0, -1, 0],
      ];
      for (const [u0, v0, u1, v1, nx, ny] of edges) {
        if (cam.rotateX(nx, ny) + cam.rotateY(nx, ny) < 1e-6) continue;
        // Nothing beyond it, or the well a flight comes up: a ladder's hatch is cut when the ladder goes in.
        const beyond = bld.floor(floor.level, x + nx, y + ny);
        if (!decked && beyond && floorKind(beyond) !== 'stairs') continue;
        // On a deck, beyond is the building's own floor at the deck's height: level ground, or another finished deck.
        if (decked && bld.buildingAt(x + nx, y + ny)?.id === floor.building
          && (!bld.onPiers(x + nx, y + ny) || (!!beyond && isDone(beyond)))) continue;
        const across = Math.abs(cam.rotateX(nx, ny)) > Math.abs(cam.rotateY(nx, ny));
        // The edge that runs across the view catches more of the light than
        // the one that runs into it, as a wall's two faces do.
        const lit = across ? 0.95 : 0.76;
        ctx.beginPath();
        ctx.moveTo(fx(u0, v0), fy(u0, v0));
        ctx.lineTo(fx(u1, v1), fy(u1, v1));
        ctx.lineTo(fx(u1, v1), fy(u1, v1, FLOOR_DEEP));
        ctx.lineTo(fx(u0, v0), fy(u0, v0, FLOOR_DEEP));
        ctx.closePath();
        ctx.fillStyle = C(st.string, lit);
        ctx.fill();
        ctx.strokeStyle = C(st.line, 1, 0.55);
        ctx.lineWidth = Math.max(0.8, cam.zoom);
        ctx.stroke();
        // The arris, where the light catches it.
        ctx.beginPath();
        ctx.moveTo(fx(u0, v0), fy(u0, v0));
        ctx.lineTo(fx(u1, v1), fy(u1, v1));
        ctx.strokeStyle = C(st.stringHi, lit * 1.05);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }
    ctx.globalAlpha = 1;
  }

  /**
   * A stake at each end of a border, a string between them and a brace across:
   * the site marked out, which is all a plan is until somebody builds on it.
   */
  private drawScaffold(border: Border, base: number, level: number, alpha: number): void {
    const ctx = this.canvas.ctx;
    const cam = this.camera;
    const [ax, ay, bx, by] = borderPoints(border);
    const h0 = base + level * WALL_HEIGHT;
    const h1 = h0 + WALL_HEIGHT * SCAFFOLD_HEIGHT;
    const px = (t: number): number => cam.worldToScreenX(ax + (bx - ax) * t, ay + (by - ay) * t);
    const py = (t: number, k: number): number => cam.worldToScreenY(ax + (bx - ax) * t, ay + (by - ay) * t, h0 + (h1 - h0) * k);
    const line = (t0: number, k0: number, t1: number, k1: number): void => {
      ctx.beginPath();
      ctx.moveTo(px(t0), py(t0, k0));
      ctx.lineTo(px(t1), py(t1, k1));
      ctx.stroke();
    };
    ctx.globalAlpha = alpha;
    // The chalk line on the ground, which is the line the wall will stand on.
    ctx.strokeStyle = PLAN_COLOR;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    line(0, 0, 1, 0);
    ctx.setLineDash([]);
    /*
     * And the string between the stakes, which is the whole of what a marked
     * out site is. It had a diagonal brace across it for a moment, and eight
     * of those round a two by two footprint read as a cat's cradle rather than
     * a building: the line a wall will stand on is the thing worth drawing.
     */
    ctx.strokeStyle = SCAFFOLD_LINE;
    ctx.lineWidth = 1.4;
    line(0.05, 1, 0.95, 1);
    // And the stakes themselves, which are the only solid thing about a plan.
    ctx.fillStyle = SCAFFOLD_POST;
    ctx.strokeStyle = SCAFFOLD_TRIM;
    ctx.lineWidth = 1;
    for (const t of [0.05, 0.95]) {
      const w = 0.045;
      ctx.beginPath();
      ctx.moveTo(px(t - w), py(t - w, 0));
      ctx.lineTo(px(t + w), py(t + w, 0));
      ctx.lineTo(px(t + w), py(t + w, 1));
      ctx.lineTo(px(t - w), py(t - w, 1));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private masonryOf(wall: { material: string; dye?: string }): Masonry | undefined {
    return wall.dye ? undefined
      : wall.material === 'cobblestone' ? cobble()
        : wall.material === 'clay_bricks' ? brickwork()
          : wall.material === 'stone_brick' ? stonework()
            : wall.material === 'sandstone' ? sandstone()
              : wall.material === 'slate' ? slatework()
                : wall.material === 'marble' ? marblework()
                  : wall.material === 'clay_adobe' ? adobe()
                    : wall.material === 'timbercraft' ? timbercraft()
                      : wall.material === 'log' ? logwork()
                        : wall.material === 'plank' ? planking()
                          : wall.material === 'ornate_silver' ? silverwork()
                            : wall.material === 'ornate_gold' ? goldwork()
                              : wall.material === 'stained_glass' ? glasswork()
                                : undefined;
  }

  /**
   * How tall a wall stands, as a share of a storey: its type's height, except
   * that on a masonry laid by hand, or framed, a gate hung in a run of taller
   * garden wall stands to that wall's height. Its piers or its posts are the
   * wall built up either side of it, and a gate a foot lower than the wall it
   * hangs in was a notch. On a masonry whose gates hang between piers, the
   * gate stands its piers' height over the tallest wall it hangs in.
   */
  private standing(wall: Wall, border: Border): number {
    const own = WALL_TYPE_BY_ID.get(wall.type)?.height ?? 1;
    const gate = (w: Wall): boolean => w.type === 'fence_gate' || w.type === 'iron_gate';
    const cob = gate(wall) ? this.masonryOf(wall) : undefined;
    if (!cob || !(cob.wrap || cob.piers)) return own;
    let near = 0;
    for (const i of [-1, 1]) {
      const b: Border = border.dir === 'h'
        ? { dir: 'h', x: border.x + i, y: border.y }
        : { dir: 'v', x: border.x, y: border.y + i };
      const w = this.game.buildings.wallOnBorder(wall.level, b);
      const k = w && WALL_TYPE_BY_ID.get(w.type);
      if (w && isDone(w) && !gate(w) && k?.low) near = Math.max(near, k.height ?? 1);
    }
    return Math.max(own, near + (cob.piers && near ? cob.piers : 0));
  }
  /** Walls, their openings, gates and doors (`walldraw.ts`). */
  private readonly walls = new WallPainter(this.wallHost());

  /**
   * Whether a wall is one of the two a building's floor joists rest on.
   *
   * A joist spans the short way across a house, because that is the length
   * of timber there is, so it rests on the two long walls and the gable walls
   * carry none. A square house has its joists run north to south, which puts
   * the beam ends on the fronts people build toward the sun.
   */
  /**
   * Walls and roofs, drawn once into a picture of their own and copied after
   * that: in a village they were most of a frame, every frame, and they change
   * when somebody builds, not when the camera moves.
   *
   * Like the ground's edges (`hems`) a picture is good only where it lands on
   * the same fraction of a pixel, which the camera's whole-pixel step keeps
   * true; `ax`, `ay` is a point on the screen that moves with the thing, to
   * tell.
   *
   * A picture is made again when something it was drawn from has changed,
   * and not otherwise. It used to be made again every `BAKE_LIFE` seconds
   * whatever happened, because nothing said when a wall's neighbours, its
   * paint or the floor over it had changed: in a village a fifth of the
   * pictures on the screen were drawn afresh every frame, and kept for good
   * the same village drew in four fifths of the time. What it reads is in
   * three parts:
   *
   *   * The buildings round it: `ver`, the count of the patches of the
   *     island it reads (`StructureWatch.version`), which goes up when
   *     anything built within `REACH` of it changes, or the ground under it.
   *     The caller says which tiles those are; a wall also puts in its key
   *     what it reads from further off (a counter's wares).
   *   * The view: the zoom, the turn, the screen's sharpness, the storey
   *     looked at, the cutaway and what is taken off over a cellar
   *     (`bakeEpoch`). All of them go at once when that changes, as the
   *     ground's edges do.
   *   * The light: the sun's step through the day, the dark in twentieths
   *     and whether the ivy is in flower (`bakeLight`) -- a glass roof
   *     throws the sun back. When that moves on, each is made again in its
   *     own turn over the next `BAKE_LIFE` seconds, by its key, so a village
   *     is not drawn afresh in one frame.
   *
   * And after `BAKE_KEEP` seconds whatever happens, for what nothing tells
   * of: ivy growing, water coming near enough to green it. What changes
   * faster than any of that -- a lamp behind it at night, a room it is seen
   * through, a portcullis on its way down -- is drawn as it always was
   * (`drawWall`, `drawPitchedRoof`).
   */
  private bakes = new Map<string, Baked>();
  private bakePixels = 0;
  /** The view the pictures are for, as a count that goes up when it changes, and what it was (`structuresFrame`). */
  private bakeEpoch = 0;
  private bakeView = '';
  /** And the view less the zoom, the same way: a picture made at another zoom in it can stand in while the zoom moves. */
  private bakeShape = 0;
  private bakeShapeWas = '';
  /** Pictures still to be made this frame where an older one could stand in (`BAKES_A_FRAME`). */
  private bakesLeft = 0;
  /** And while it moves, where none can (`BAKES_MOVING`). */
  private bakesMoving = 0;
  /** The light they are for, the same way, and when it last moved on. */
  private bakeLight = 0;
  private bakeLit = '';
  private bakeLightAt = -Infinity;

  /**
   * Once a frame, once the buildings taken off over a cellar are known:
   * what has changed about the buildings (`StructureWatch`), and the view
   * and the light the pictures of them are made for (`baked`), and whether
   * the shade the walls throw on the ground (`shadeOf`) still stands.
   */
  private structuresFrame(): void {
    const cam = this.camera;
    const settings = this.game.settings;
    this.structs.update(this.game.buildings);
    const cut = this.cut.size ? [...this.cut].join(',') : '';
    const shape = `${cam.rotation}|${this.canvas.dpr}|${settings.viewLevel}|${this.cutawayOn()}|${cut}`;
    const view = `${cam.zoom}|${shape}`;
    if (view !== this.bakeView) {
      this.bakeView = view;
      this.bakeEpoch++;
    }
    if (shape !== this.bakeShapeWas) {
      this.bakeShapeWas = shape;
      this.bakeShape++;
    }
    this.bakesLeft = BAKES_A_FRAME;
    this.bakesMoving = BAKES_MOVING;
    const lit = `${Math.floor((this.game.hourOfDay() / 24) * SUN_STEPS)}|${Math.round(this.game.darkness() * 20)}|${this.bloom}`;
    if (lit !== this.bakeLit) {
      this.bakeLit = lit;
      this.bakeLight++;
      this.bakeLightAt = this.time;
    }
    // The shade reads the walls, the ground under them, which way is the back of a tile, the cutaway and what is taken off.
    const shade = `${this.structs.stamp}|${cam.rotation}|${this.cutawayOn()}|${cut}`;
    if (shade !== this.shadeFor || this.shades.size > 200_000) {
      this.shadeFor = shade;
      this.shades.clear();
      this.shaded.clear();
    }
  }

  /** The pad a picture is drawn on before it is cut to what is in it (`bakeCropped`). */
  private bakePad: { cv: HTMLCanvasElement; g: CanvasRenderingContext2D } | null = null;

  private baked(key: string, ax: number, ay: number, box: [number, number, number, number], draw: () => void, ver: number,
    { occludes = true, lit = true }: BakeAs = {}): void {
    const ctx = this.canvas.ctx;
    const dpr = this.canvas.dpr;
    const zoom = this.camera.zoom;
    const had = this.bakes.get(key);
    if (had) this.bakeUsed(key, had);
    /*
     * One for this view that has gone out of date -- something read round it
     * has changed, the light has moved on, or it has been kept its time --
     * is drawn as it is until its turn comes to be made again, `BAKES_A_FRAME`
     * a frame: a whole village gone out of date at once was all made again
     * in the one frame.
     */
    if (had && had.epoch === this.bakeEpoch && (this.bakesLeft <= 0 || (had.ver === ver && this.time - had.at < had.life && this.time >= had.at
      && (!lit || had.light === this.bakeLight || this.time - this.bakeLightAt < had.wait)))) {
      const dx = (ax - had.ax) * dpr, dy = (ay - had.ay) * dpr;
      const rx = Math.round(dx), ry = Math.round(dy);
      if (Math.abs(dx - rx) < 0.02 && Math.abs(dy - ry) < 0.02) {
        const px = had.bx + rx / dpr, py = had.by + ry / dpr, pw = had.cv.width / dpr, ph = had.cv.height / dpr;
        // Wholly off the screen: nothing to put down (about a sixth of a settlement's pictures in a frame).
        if (px > this.canvas.el.width / dpr || py > this.canvas.el.height / dpr || px + pw < 0 || py + ph < 0) return;
        ctx.drawImage(had.cv, px, py, pw, ph);
        // In front of a runestone's runes after dark: the same picture kept off them (`RunestoneNight`).
        if (occludes && this.runeNight.keeping) this.runeNight.occlude(ctx, had.cv, had.bx + rx / dpr, had.by + ry / dpr, had.cv.width / dpr, had.cv.height / dpr);
        return;
      }
    }
    /*
     * While the zoom moves, and for as long after it as the pictures it left
     * behind take to be made again `BAKES_A_FRAME` at a time, the picture of
     * the same thing in the same view at the zoom it was made at stands in,
     * stretched about the point it hangs on, as the ground's edges and the
     * trees do. Every wall in sight was drawn afresh every frame of a zoom,
     * and every one of them made again in the frame it stopped.
     */
    const r = had && had.ver === ver && had.shape === this.bakeShape && had.zoom !== zoom ? zoom / had.zoom : 0;
    if (had && r && r <= STAND_IN_MOST && r * STAND_IN_MOST >= 1 && (!this.zoomSettled || this.bakesLeft <= 0)) {
      const x = ax + (had.bx - had.ax) * r, y = ay + (had.by - had.ay) * r, w = (had.cv.width / dpr) * r, h = (had.cv.height / dpr) * r;
      ctx.drawImage(had.cv, x, y, w, h);
      if (occludes && this.runeNight.keeping) this.runeNight.occlude(ctx, had.cv, x, y, w, h);
      return;
    }
    // One too far from this size to stretch, or none: a few a frame are made at this size, to stand in from the next.
    if (!this.hemSteady && this.bakesMoving-- <= 0) {
      draw();
      if (occludes) this.occludeLine(box, draw);
      return;
    }
    const bx = Math.floor(box[0] * dpr) - 2, by = Math.floor(box[1] * dpr) - 2;
    const w = Math.ceil(box[2] * dpr) + 2 - bx, h = Math.ceil(box[3] * dpr) + 2 - by;
    // Off the screen altogether, or too big to be worth keeping: drawn as it always was.
    const W = this.canvas.el.width, H = this.canvas.el.height;
    if (w <= 0 || h <= 0 || w * h > BAKE_MOST || bx > W || by > H || bx + w < 0 || by + h < 0) {
      draw();
      if (occludes) this.occludeLine(box, draw);
      return;
    }
    this.bakeCropped(key, had, ax, ay, bx, by, w, h, draw, ver, occludes, zoom);
  }

  /**
   * `baked`'s making of a picture: drawn on one kept pad (`READ_BACK`), then cut to the box round what was drawn and kept
   * at that size. A floor's box is 1.8 tiles each way and a wall's a whole storey, and four fifths of every such picture
   * was clear pixels put down every frame (a grown settlement: 28 screens of pixels a frame, 5 once cut).
   */
  private bakeCropped(key: string, had: Baked | undefined, ax: number, ay: number, bx: number, by: number, w: number, h: number, draw: () => void, ver: number, occludes: boolean, zoom: number): void {
    const ctx = this.canvas.ctx;
    const dpr = this.canvas.dpr;
    this.bakesLeft--;
    let cv = had?.cv;
    if (had) {
      this.bakePixels -= had.cv.width * had.cv.height;
      this.bakes.delete(key);
    }
    const pad = this.bakePad ??= (() => { const c = document.createElement('canvas'); return { cv: c, g: c.getContext('2d', READ_BACK) as CanvasRenderingContext2D }; })();
    if (pad.cv.width < w || pad.cv.height < h) { pad.cv.width = Math.max(pad.cv.width, w); pad.cv.height = Math.max(pad.cv.height, h); }
    else { (pad.g as CanvasRenderingContext2D & { reset?: () => void }).reset?.(); pad.g.setTransform(1, 0, 0, 1, 0, 0); pad.g.clearRect(0, 0, w, h); }
    const g = pad.g;
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.setTransform(dpr, 0, 0, dpr, -bx, -by);
    // What the screen's pen was left holding, which the drawing reads without setting: the ends of a line, the joins, the type.
    g.lineCap = ctx.lineCap;
    g.lineJoin = ctx.lineJoin;
    g.miterLimit = ctx.miterLimit;
    g.lineWidth = ctx.lineWidth;
    g.strokeStyle = ctx.strokeStyle;
    g.fillStyle = ctx.fillStyle;
    g.font = ctx.font;
    g.textAlign = ctx.textAlign;
    g.textBaseline = ctx.textBaseline;
    g.setLineDash(ctx.getLineDash());
    // Everything that draws a wall or a roof draws on `this.canvas.ctx`, so for the length of it that is the picture.
    const canvas = this.canvas as { ctx: CanvasRenderingContext2D };
    canvas.ctx = g;
    try {
      draw();
    } finally {
      canvas.ctx = ctx;
    }
    // The box round every pixel drawn (none: one clear pixel kept, so it is still known as made).
    const px = new Uint32Array(g.getImageData(0, 0, w, h).data.buffer);
    let cx0 = w, cy0 = h, cx1 = -1, cy1 = -1;
    for (let yy = 0; yy < h; yy++) {
      const row = yy * w;
      let first = -1, last = -1;
      for (let xx = 0; xx < w; xx++) if (px[row + xx]) { first = xx; break; }
      if (first < 0) continue;
      for (let xx = w - 1; xx >= first; xx--) if (px[row + xx]) { last = xx; break; }
      if (first < cx0) cx0 = first;
      if (last > cx1) cx1 = last;
      if (yy < cy0) cy0 = yy;
      cy1 = yy;
    }
    if (cx1 < 0) { cx0 = cy0 = 0; cx1 = cy1 = 0; }
    const cw = cx1 - cx0 + 1, ch = cy1 - cy0 + 1;
    if (!cv) cv = document.createElement('canvas');
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    else {
      // Its old picture's canvas, the same size: cleared, and its pen put back as a new one's is.
      const old = cv.getContext('2d') as CanvasRenderingContext2D & { reset?: () => void };
      if (old.reset) old.reset();
      else cv.width = cw;
    }
    (cv.getContext('2d') as CanvasRenderingContext2D).drawImage(pad.cv, cx0, cy0, cw, ch, 0, 0, cw, ch);
    const bx2 = bx + cx0, by2 = by + cy0;
    this.bakeRoom(cw * ch);
    // Its turn, by the key, so they come due apart: when the light moves on, and when it is kept no longer.
    let spread = 0;
    for (let i = 0; i < key.length; i++) spread = (spread * 31 + key.charCodeAt(i)) >>> 0;
    const turn = (spread % 1000) / 1000;
    this.bakes.set(key, {
      cv, ax, ay, bx: bx2 / dpr, by: by2 / dpr, at: this.time, life: BAKE_KEEP * (0.75 + turn / 2), wait: BAKE_LIFE * turn,
      ver, epoch: this.bakeEpoch, light: this.bakeLight, shape: this.bakeShape, zoom, used: this.frameNo,
    });
    this.bakePixels += cw * ch;
    ctx.drawImage(cv, bx2 / dpr, by2 / dpr, cw / dpr, ch / dpr);
    if (occludes && this.runeNight.keeping) this.runeNight.occlude(ctx, cv, bx2 / dpr, by2 / dpr, cw / dpr, ch / dpr);
  }

  /** A picture drawn: to the back of the order they are put away in (`bakeRoom`), once a frame. */
  private bakeUsed(key: string, b: Baked): void {
    if (b.used === this.frameNo) return;
    b.used = this.frameNo;
    this.bakes.delete(key);
    this.bakes.set(key, b);
  }

  /**
   * Room for `need` more device pixels of pictures, within `BAKE_PIXELS` for
   * the screen's sharpness: those gone longest undrawn put away, and never
   * one drawn this frame. It used to put the lot away, and on a sharp screen
   * a village's pictures were more than that by themselves: every one of them
   * was made again over and over, most of every frame.
   */
  private bakeRoom(need: number): void {
    const most = BAKE_PIXELS * this.canvas.dpr * this.canvas.dpr;
    for (const [key, b] of this.bakes) {
      if (this.bakePixels + need <= most || b.used === this.frameNo) break;
      this.bakePixels -= b.cv.width * b.cv.height;
      this.bakes.delete(key);
    }
  }

  /** Bodies put off to a later line, by the line: whoever stands in a rune gate's opening, on the tile behind it. */
  private gateDeferred = new Map<number, Entity[]>();
  /** This line's bodies standing in the opening of a rune gate drawn on it, drawn before its front picture. */
  private gateIn: Entity[] = [];
  /** This frame's drawbridges, by the border each is hinged on, and the tiles either side of each hinge. */
  private drawbridges = new Map<string, Bridge>();
  private landings = new Map<string, Bridge>();
  private hingeTiles = new Set<number>();
  /** What `drawGateAt` found on this line, laid after the line's roofs and before what stands on it. */
  private gateLate: Array<() => void> = [];
  /** A world point and a height, to the screen. */
  private readonly project = (x: number, y: number, h: number): [number, number] =>
    [this.camera.worldToScreenX(x, y), this.camera.worldToScreenY(x, y, h)];

  /** The deed's boundary as a line that follows the ground. */
  /** Ore a prospector has read, glowing until the marks fade. */
  private drawProspected(ctx: CanvasRenderingContext2D): void {
    const p = this.game.prospected;
    if (!p || this.game.time >= p.until) return;
    const w = this.game.world;
    // Fade out over the last few seconds rather than blinking off.
    const left = p.until - this.game.time;
    const pulse = this.calm ? 0.85 : 0.72 + Math.sin(this.anim * 3) * 0.22;
    ctx.save();
    ctx.globalAlpha = Math.min(1, left / 8) * pulse;
    for (const key of p.tiles) {
      const x = key % w.w;
      const y = (key - x) / w.w;
      this.tilePath(ctx, x, y);
      ctx.fillStyle = '#ffcf3d';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#5a3c00';
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff3c0';
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Your border, and your neighbours'.
   *
   * Theirs is drawn in the same line at half the weight, because knowing you
   * are standing in somebody's yard is the difference between "this game will
   * not let me build" and "this is not my land". It is only ever drawn for a
   * settlement near enough to be standing in — the island does not send the
   * distant ones — and it lights nothing: the fog is worked out from your own
   * eyes and your own settlement, and that is the whole reason these two are
   * kept apart.
   */
  private drawDeedBorder(ctx: CanvasRenderingContext2D): void {
    /*
     * Somebody else's border is faint; land you were asked onto is not.
     *
     * A citizen may build on three settlements besides their own, and a border
     * you may work inside is a different thing from one you are only standing
     * near — so it is drawn at the weight your own is.
     */
    for (const d of this.game.neighbourDeeds) this.deedRing(ctx, d, d.mine ? 0.8 : 0.45);
    const deed = this.game.deed;
    if (deed) this.deedRing(ctx, deed, 1);
  }

  /**
   * A settlement previewed before founding (`Game.foundPreview`), while a stake is still in the pack: its border at
   * the first level, and fainter at the last (`deedRadiusAt(MAX_DEED_LEVEL)`); in red where the island would refuse it.
   */
  private previewShown(): NonNullable<Game['foundPreview']> | null {
    const p = this.game.foundPreview;
    if (!p) return null;
    // Spent, or never made: the preview goes with the stake.
    if (!this.game.inventory.items.some((it) => it.id === 'deed_stake')) this.game.foundPreview = null;
    return this.game.foundPreview;
  }

  private drawFoundPreview(ctx: CanvasRenderingContext2D, p: NonNullable<Game['foundPreview']>): void {
    const colour = p.refusal ? PREVIEW_REFUSED : DEED_COLOR;
    this.deedRing(ctx, { x: p.x, y: p.y, radius: deedRadiusAt(MAX_DEED_LEVEL) }, PREVIEW_MAX_WEIGHT, colour);
    this.deedRing(ctx, { x: p.x, y: p.y, radius: deedRadiusAt(1) }, 1, colour);
    this.deedRing(ctx, { x: p.x, y: p.y, radius: 0 }, 1, colour);
  }

  private deedRing(ctx: CanvasRenderingContext2D, deed: { x: number; y: number; radius: number }, weight: number, colour = DEED_COLOR): void {
    const w = this.game.world;
    const cam = this.camera;
    const x0 = deed.x - deed.radius;
    const y0 = deed.y - deed.radius;
    const x1 = deed.x + deed.radius + 1;
    const y1 = deed.y + deed.radius + 1;
    ctx.save();
    ctx.globalAlpha = weight;
    ctx.beginPath();
    const pt = (x: number, y: number, first: boolean): void => {
      const sx = cam.worldToScreenX(x, y);
      const sy = cam.worldToScreenY(x, y, w.getHeight(x, y) + 0.5);
      if (first) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    };
    for (let x = x0; x <= x1; x++) pt(x, y0, x === x0);
    for (let y = y0 + 1; y <= y1; y++) pt(x1, y, false);
    for (let x = x1 - 1; x >= x0; x--) pt(x, y1, false);
    for (let y = y1 - 1; y > y0; y--) pt(x0, y, false);
    ctx.closePath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = DEED_SHADOW;
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = colour;
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.restore();
  }

  /** Water surface at height 0, clipped to the part of the tile that lies below it. Built in view space. */
  /**
   * The water lying on a tile. Its surface is drawn flat at sea level, not on
   * the drowned ground, so on screen it sits well clear of the tile's own
   * diamond — which is why remembered water used to stay bright while the land
   * around it went cold. `fogInto` takes the same shape so the wash covers
   * what was actually drawn rather than what is underneath it.
   */
  /**
   * Note where everything on open water is this frame. A swimmer drags a
   * narrow wake, a hull as wide as its beam; a wildermon out of its depth
   * leaves one too. Nothing on dry land leaves anything.
   */
  /**
   * Note what is walking about on dry ground. The dust is the colour of the
   * ground it came off, which is why a run across a beach and a run across a
   * ploughed field do not look the same.
   */
  private markDust(): void {
    if (this.camera.zoom < 0.6) return;
    const w = this.game.world;
    const now = this.time;
    const sun = this.sunNow;
    const dry = (x: number, y: number): boolean => w.heightAt(x, y) >= w.surfaceAt(Math.floor(x), Math.floor(y));
    const kick = (id: string, x: number, y: number): void => {
      const tx = Math.floor(x);
      const ty = Math.floor(y);
      if (!w.inBounds(tx, ty) || !dry(x, y)) return;
      this.dust.step(id, x, y, now, dustTone(this.groundColor(tx, ty, true, sun)), dustiness(w.viewTile(tx, ty, true)));
    };
    // Whether a thing counts as walking is settled by how far it has actually
    // gone, not by a flag: a pace covered is a pace, whoever or whatever moved
    // it. Standing still covers no ground and so raises none.
    const p = this.game.player;
    if (!p.swimming) kick('player', p.x, p.y);
    if (this.game.creatures.list.size) {
      for (const cr of this.game.creatures.list.values()) kick('c' + cr.id, cr.x, cr.y);
    }
  }

  /**
   * The dust in the air and the smoke over what is burning, both drawn after
   * everything on the ground because both of them are above it.
   */
  private drawAir(ctx: CanvasRenderingContext2D, zoom: number): void {
    const cam = this.camera;
    const w = this.game.world;
    for (const p of this.dust.live(this.time)) {
      const { radius, lift, alpha } = Dust.spread(p, this.time);
      if (alpha < 0.02) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.colour;
      ctx.beginPath();
      ctx.ellipse(cam.worldToScreenX(p.x, p.y), cam.worldToScreenY(p.x, p.y, w.heightAt(p.x, p.y)) - lift * zoom, radius * zoom, radius * 0.55 * zoom, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // The mist off the falls, which hangs over everything the same as smoke does.
    if (this.game.world.water) this.springWater.air(ctx);
    const fires = this.game.fires();
    if (!fires.length) return;
    const drift = this.lean.force * PUFF_DRIFT;
    for (const f of fires) {
      const sx = cam.worldToScreenX(f.x, f.y);
      const sy = cam.worldToScreenY(f.x, f.y, w.heightAt(f.x, f.y));
      const seed = (f.x * 0.37 + f.y * 0.71) % 1;
      for (let i = 0; i < PUFFS; i++) {
        const age = puffAge(i, this.anim, seed);
        const puff = puffOf(age, f.heat);
        // A plume of its own where it says so (`Game.fires`): a smelter's stack sends up a short, thin, pale one.
        const pl = f.plume, pale = pl?.pale ?? 0, size = pl?.size ?? 1;
        const alpha = puff.alpha * (1 - 0.3 * pale) * (pl ? 1.3 : 1);
        if (alpha < 0.012) continue;
        // Higher up it has been in the wind longer, so a plume leans over
        // rather than standing straight.
        const blown = drift * age * age * HALF_W * zoom;
        const px = sx + this.lean.x * blown + Math.sin(age * 7 + seed * 11) * 1.6 * zoom;
        // Off the ground, or out of the head of a stack (`lift`, in height units).
        const py = sy + this.lean.y * blown * 0.4 - (6 + age * PUFF_RISE * (pl?.rise ?? 1) + (f.lift ?? 0) * HEIGHT_SCALE) * zoom;
        // Dark and tight at the fire, pale and open once it has thinned; a pale plume pale from the first and a little warm.
        const grey = Math.round(64 + age * 168 + pale * (112 - age * 100));
        ctx.fillStyle = `rgba(${Math.min(255, grey + Math.round(10 * pale))},${grey - 4},${grey - 10 - Math.round(16 * pale)},${Math.min(1, alpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(px, py, puff.radius * size * zoom, puff.radius * size * 0.82 * zoom, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * Whether this is the thing under the cursor. Picking already knows what it
   * is by id; this asks the other way round, so an entity about to be drawn
   * can be told to light up.
   */
  private isHovered(ent: Entity): boolean {
    const h = this.hover;
    if (!h) return false;
    switch (ent.kind) {
      case 'creature':
        return h.creature !== undefined && h.creature === ent.creature?.id;
      case 'crate':
        return h.crate !== undefined && h.crate === ent.crateId;
      case 'campfire':
        return h.fire !== undefined && h.fire === ent.fire?.id;
      case 'smelter':
        return h.smelter !== undefined && h.smelter === ent.smelter?.id;
      case 'kiln':
        return h.kiln !== undefined && h.kiln === ent.kiln?.id;
      case 'furniture':
        return h.furniture !== undefined && h.furniture === ent.piece?.id;
      case 'anvil':
        return h.anvil !== undefined && h.anvil === ent.anvil?.id;
      case 'post':
        return h.post !== undefined && h.post === ent.post?.id;
      case 'trap':
        return h.trap !== undefined && h.trap === ent.trap?.id;
      case 'token':
        // Its own tile, with nothing else on it picked.
        return h.x === ent.x && h.y === ent.y && !h.down && (h.creature ?? h.peer ?? h.crate ?? h.fire ?? h.smelter ?? h.kiln ?? h.anvil ?? h.post ?? h.trap ?? h.furniture ?? h.bridge) === undefined;
      default:
        return false;
    }
  }

  /**
   * The light that comes up around whatever the cursor is on. It hugs the
   * silhouette rather than boxing it, which is the difference between knowing
   * a thing is selected and knowing which thing is selected — in a crowded
   * pen with four rabba standing on the same tile, a box round the tile tells
   * you nothing.
   */
  /**
   * Haze over the distance. In this view whatever is furthest away is highest
   * on the screen, so the distance is a band across the top, thickening toward
   * it. It is laid in the same colour as the far sky, which is what makes a
   * coastline eight hundred tiles off dissolve into the horizon instead of
   * sitting there as hard as the ground under your feet.
   *
   * Zoomed out there is more distance in view and so more of it; up close it
   * is almost nothing, which is right — you can see a wall in front of you
   * perfectly clearly on the haziest day there is.
   */
  private drawHaze(ctx: CanvasRenderingContext2D, zoom: number): void {
    const H = this.canvas.height;
    const strength = this.sky.haze * Math.max(0, Math.min(1, (1.35 - zoom) / 1.1));
    if (strength < 0.01) return;
    const g = ctx.createLinearGradient(0, 0, 0, H * HAZE_REACH);
    g.addColorStop(0, rgba(this.sky.far, strength));
    g.addColorStop(0.45, rgba(this.sky.far, strength * 0.42));
    g.addColorStop(1, rgba(this.sky.far, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.canvas.width, H * HAZE_REACH);
  }

  /**
   * The numbers and words standing over the world. They are drawn after
   * everything else on the ground and before the fog, so a number over a
   * wildermon in the dark is still readable — which is the whole point of it
   * being a number rather than a line in the log.
   */
  /**
   * A ring over every fire, oven, brazier, smelter and kiln near you: the outer
   * arc its fuel, out of the most it holds (`FIRE_CAPACITY`; a hearth's own,
   * `hearthCapacity`), orange while it burns and grey
   * while it is cold; the inner arc how far the piece at the front of it has
   * come, for a smelter or a kiln with work in it; and a dot when something is
   * finished and waiting to be taken out. Asked for so a station can be read
   * from across the yard instead of clicked to find out.
   */
  private drawStationRings(ctx: CanvasRenderingContext2D, zoom: number): void {
    if (zoom < RING_ZOOM) return;
    const cam = this.camera;
    const w = this.game.world;
    const p = this.game.player;
    const level = p.level ?? 0;
    const r = Math.max(6, Math.min(12, 8 * zoom));
    // Over the top of what it is drawn over: a fire is low, a smelter and a kiln stand chest high.
    const ring = (x: number, y: number, lift: number, fuel: number, lit: boolean, work: number | null, ready: boolean, full = FIRE_CAPACITY): void => {
      const sx = cam.worldToScreenX(x, y);
      const sy = cam.worldToScreenY(x, y, w.heightAt(x, y)) - lift * zoom - r;
      ctx.beginPath();
      ctx.arc(sx, sy, r + 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(12,12,14,0.62)';
      ctx.fill();
      const top = -Math.PI / 2;
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();
      const share = Math.max(0, Math.min(1, fuel / full));
      if (share > 0) {
        ctx.strokeStyle = lit ? 'rgb(240,150,52)' : 'rgb(150,146,138)';
        // Cold: dashed, so lit and cold differ by more than the colour.
        if (!lit) ctx.setLineDash([2.5, 3]);
        ctx.beginPath();
        ctx.arc(sx, sy, r, top, top + share * Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (work !== null) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgb(170,214,120)';
        ctx.beginPath();
        ctx.arc(sx, sy, r * 0.55, top, top + Math.max(0.02, Math.min(1, work)) * Math.PI * 2);
        ctx.stroke();
      }
      if (ready) {
        ctx.fillStyle = 'rgb(227,182,87)';
        ctx.beginPath();
        ctx.arc(sx + r * 0.75, sy - r * 0.75, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.lineCap = 'butt';
      ctx.lineWidth = 1;
    };
    const front = (jobs: Array<{ left: number; total: number }>): number | null =>
      jobs.length ? 1 - jobs[0].left / Math.max(0.001, jobs[0].total) : null;
    this.game.placed.campfires.around(p.x, p.y, RING_REACH, (f) => {
      const [x, y] = fireCentre(f);
      ring(x, y, 30, f.fuel, f.lit, null, false);
    }, level);
    // An oven and a brazier, which burn as a fire does and said nothing of it from across the yard.
    this.game.placed.furniture.around(p.x, p.y, RING_REACH, (f) => {
      if (!furnitureDef(f.kind).hearth) return;
      const [x, y] = furnitureCentre(f);
      ring(x, y, f.kind === 'brazier' ? HEARTH_LIFT.brazier : HEARTH_LIFT.oven, f.fuel ?? 0, !!f.lit, null, false, hearthCapacity(f));
    }, level);
    this.game.placed.smelters.around(p.x, p.y, RING_REACH, (s) => {
      const [x, y] = smelterCentre(s);
      ring(x, y, 64, s.fuel, s.lit, front(s.jobs), s.output.length > 0);
    }, level);
    // A kiln's just over the head of its vent, as it is drawn from where the camera looks (`kilnHit`), clear of the flare over it.
    const kilnTop = 10 - kilnHit(cam.rotation)[1];
    this.game.placed.kilns.around(p.x, p.y, RING_REACH, (k) => {
      const [x, y] = kilnCentre(k);
      ring(x, y, kilnTop, k.fuel, k.lit, front(k.jobs), k.output.length > 0);
    }, level);
  }

  private drawFloaters(ctx: CanvasRenderingContext2D, zoom: number): void {
    const live = this.floaters.live(this.time);
    if (!live.length) return;
    const cam = this.camera;
    const w = this.game.world;
    const size = Math.max(11, Math.round(13 * Math.min(1.4, zoom)));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    for (const f of live) {
      const { lift, alpha, scale } = Floaters.rise(f, this.time);
      if (alpha <= 0.01) continue;
      const sx = cam.worldToScreenX(f.x, f.y);
      // A row apiece for whatever went up together, so two things that happened
      // in the same instant over the same spot are two lines rather than one
      // unreadable one. The row is in screen pixels because that is where the
      // overlap is: it has to clear the glyphs, not the ground.
      const sy = cam.worldToScreenY(f.x, f.y, w.heightAt(f.x, f.y))
        - 26 * zoom - lift * zoom - f.lane * (size + 3);
      // A critical blow is written half as large again.
      ctx.font = `${f.kind === 'crit' ? 800 : 600} ${Math.round(size * scale * (f.kind === 'crit' ? 1.5 : 1))}px system-ui, sans-serif`;
      // Written twice: a dark surround first, so it stays legible over grass,
      // over sand, over water and over a wildermon.
      ctx.strokeStyle = `rgba(12,12,14,${(alpha * 0.85).toFixed(3)})`;
      ctx.lineWidth = 3.4;
      ctx.strokeText(f.text, sx, sy);
      ctx.fillStyle = `rgba(${(f.kind === 'taken' && WORLD_INK.bad) || FLOAT_COLOURS[f.kind]},${alpha.toFixed(3)})`;
      ctx.fillText(f.text, sx, sy);
    }
    ctx.lineWidth = 1;
    ctx.textAlign = 'left';
  }

  /**
   * How white a thing is from having just been hit. It is a short, hard flash
   * — long enough to see, short enough that a run of blows reads as a run of
   * blows rather than one long glow.
   */
  /**
   * The ground a heavy blow will land on: a ring of `HUNT_REACH` tiles round
   * the one drawing back for it, as the view draws a circle, filling as the
   * blow comes. Out of it by the time it is full is out of it.
   */
  private drawWindupReach(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number, left: number): void {
    const k = Math.max(0, Math.min(1, 1 - left / WIND_UP));
    const rx = HUNT_REACH * Math.SQRT2 * HALF_W * zoom;
    const ry = HUNT_REACH * Math.SQRT2 * HALF_H * zoom;
    ctx.save();
    ctx.fillStyle = inkOr('bad', `rgba(214, 62, 44, ${0.1 + 0.2 * k})`, 0.1 + 0.2 * k);
    ctx.beginPath();
    ctx.ellipse(sx, sy, Math.max(1, rx * k), Math.max(1, ry * k), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = inkOr('bad', `rgba(232, 74, 52, ${0.55 + 0.4 * k})`, 0.55 + 0.4 * k);
    ctx.lineWidth = Math.max(1.5, 2.2 * zoom);
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** A mark over the head of something drawing back for a heavy blow. */
  private drawWindupMark(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number): void {
    const size = Math.max(11, Math.round(18 * zoom));
    ctx.save();
    ctx.font = `bold ${size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = Math.max(2, 3 * zoom);
    ctx.strokeStyle = 'rgba(20, 10, 8, 0.75)';
    ctx.strokeText('!', sx, sy);
    ctx.fillStyle = inkOr('bad', '#ff5a3c');
    ctx.fillText('!', sx, sy);
    ctx.restore();
  }

  private flashOf(at: number, body = true): number {
    // Animations off: no flash over a body (the edge of the view still reddens).
    if (body && this.held) return 0;
    const since = this.game.time - at;
    if (since < 0 || since > Renderer.FLASH) return 0;
    return 1 - since / Renderer.FLASH;
  }
  /** The slope of the ground beside the water on the tile `pondBank` last laid, in the units `dressFace` measures in. */
  private bankGx = 0;
  private bankGy = 0;

  /**
   * A tile's outline on the screen: on the ground, on the floor of the cellar under it (`down`), or on the floor of
   * a pinned storey over the ground (`level`, `storeyview.ts`).
   */
  private tilePath(ctx: CanvasRenderingContext2D, x: number, y: number, down = false, level?: number): void {
    const w = this.game.world;
    const cam = this.camera;
    const aloft = !down && level !== undefined && level > 0 && this.game.pinnedStorey() === level;
    const floor = down ? cellarFloorHeight(this.game, x, y) : aloft ? storeyHeight(this.game, x, y, level) : 0;
    const h = (cx: number, cy: number): number => (down || aloft ? floor : w.getHeight(cx, cy));
    ctx.beginPath();
    ctx.moveTo(cam.worldToScreenX(x, y), cam.worldToScreenY(x, y, h(x, y)));
    ctx.lineTo(cam.worldToScreenX(x + 1, y), cam.worldToScreenY(x + 1, y, h(x + 1, y)));
    ctx.lineTo(cam.worldToScreenX(x + 1, y + 1), cam.worldToScreenY(x + 1, y + 1, h(x + 1, y + 1)));
    ctx.lineTo(cam.worldToScreenX(x, y + 1), cam.worldToScreenY(x, y + 1, h(x, y + 1)));
    ctx.closePath();
  }

  /**
   * A plan over an area, every piece of it, from the back to the front: a
   * floor or a roof tile as a sheet at the height its floor would be drawn
   * at (`storeyHeight`), a footprint's tile on the ground, and a wall as a
   * pane a storey high on its side. Washed in the plan's colour, or red
   * where the piece would be refused.
   */
  private drawPlanGhost(ctx: CanvasRenderingContext2D, pieces: PlanGhostPiece[]): void {
    const cam = this.camera;
    const w = this.game.world;
    const V = cam.view;
    const sorted = [...pieces].sort((a, b) => depthOf(V, a.x, a.y) - depthOf(V, b.x, b.y));
    ctx.save();
    ctx.lineWidth = 1.5;
    for (const p of sorted) {
      ctx.fillStyle = p.ok ? PLAN_GHOST_FILL : PLAN_GHOST_REFUSED;
      ctx.strokeStyle = p.ok ? PLAN_COLOR : PLAN_GHOST_REFUSED_LINE;
      if (p.kind === 'wall' && p.side) {
        const [ax, ay, bx, by] = borderPoints(borderOf(p.x, p.y, p.side));
        const h0 = storeyHeight(this.game, p.x, p.y, p.level);
        const h1 = h0 + WALL_HEIGHT;
        ctx.beginPath();
        ctx.moveTo(cam.worldToScreenX(ax, ay), cam.worldToScreenY(ax, ay, h0));
        ctx.lineTo(cam.worldToScreenX(bx, by), cam.worldToScreenY(bx, by, h0));
        ctx.lineTo(cam.worldToScreenX(bx, by), cam.worldToScreenY(bx, by, h1));
        ctx.lineTo(cam.worldToScreenX(ax, ay), cam.worldToScreenY(ax, ay, h1));
        ctx.closePath();
      } else {
        const flat = p.kind === 'tile' ? undefined : storeyHeight(this.game, p.x, p.y, p.level);
        const h = (cx: number, cy: number): number => flat ?? w.getHeight(cx, cy);
        ctx.beginPath();
        ctx.moveTo(cam.worldToScreenX(p.x, p.y), cam.worldToScreenY(p.x, p.y, h(p.x, p.y)));
        ctx.lineTo(cam.worldToScreenX(p.x + 1, p.y), cam.worldToScreenY(p.x + 1, p.y, h(p.x + 1, p.y)));
        ctx.lineTo(cam.worldToScreenX(p.x + 1, p.y + 1), cam.worldToScreenY(p.x + 1, p.y + 1, h(p.x + 1, p.y + 1)));
        ctx.lineTo(cam.worldToScreenX(p.x, p.y + 1), cam.worldToScreenY(p.x, p.y + 1, h(p.x, p.y + 1)));
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Pinned on the level a building's roof sits on (`storeyview.ts`), where
   * every storey under it is hidden: each of its roof's tiles not yet planned,
   * marked out at the height of its eaves, so the roof still to plan is there
   * to click on.
   */
  private drawRoofSites(ctx: CanvasRenderingContext2D): void {
    const level = this.pinned;
    if (level === null) return;
    const bld = this.game.buildings;
    const cam = this.camera;
    let any = false;
    for (const b of bld.list.values()) {
      if (b.levels !== level || this.cut.has(b.id)) continue;
      for (const [x, y] of bld.roofTiles(b)) {
        if (bld.floor(level, x, y)) continue;
        if (!any) {
          ctx.save();
          ctx.strokeStyle = PLAN_COLOR;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 4]);
          any = true;
        }
        const h = storeyHeight(this.game, x, y, level);
        ctx.beginPath();
        ctx.moveTo(cam.worldToScreenX(x, y), cam.worldToScreenY(x, y, h));
        ctx.lineTo(cam.worldToScreenX(x + 1, y), cam.worldToScreenY(x + 1, y, h));
        ctx.lineTo(cam.worldToScreenX(x + 1, y + 1), cam.worldToScreenY(x + 1, y + 1, h));
        ctx.lineTo(cam.worldToScreenX(x, y + 1), cam.worldToScreenY(x, y + 1, h));
        ctx.closePath();
        ctx.stroke();
      }
    }
    if (any) ctx.restore();
  }

  private cornerMarker(ctx: CanvasRenderingContext2D, cx: number, cy: number, zoom: number, color: string, flat?: number): void {
    const w = this.game.world;
    const sx = this.camera.worldToScreenX(cx, cy);
    const sy = this.camera.worldToScreenY(cx, cy, flat ?? w.getHeight(cx, cy));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx, sy, 3.5 * Math.max(0.8, zoom), 0, Math.PI * 2);
    ctx.fill();
  }

  private drawOverlays(ctx: CanvasRenderingContext2D, zoom: number): void {
    const game = this.game;
    const w = game.world;
    const cam = this.camera;
    // The way you are walking, and the tile you are working: over the cellar when you are looking into one, after it is drawn.
    const marks = (): void => {
      const path = game.player.path;
      if (path) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        for (const p of path) {
          const sx = cam.worldToScreenX(p.x + 0.5, p.y + 0.5);
          // A step down in a cellar is on its floor; and one up a storey, on a pinned storey's floor (`storeyview.ts`).
          const sy = cam.worldToScreenY(p.x + 0.5, p.y + 0.5, p.level < 0 ? cellarFloorHeight(game, p.x, p.y)
            : p.level > 0 && this.pinned !== null ? storeyHeight(game, p.x, p.y, p.level) : w.centerHeight(p.x, p.y));
          ctx.beginPath();
          ctx.arc(sx, sy, 2.5 * zoom, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const action = game.action;
      if (action && action.target.kind === 'tile') {
        const t = action.target;
        const pulse = this.calm ? 0.85 : 0.55 + 0.45 * Math.sin(this.anim * 6);
        ctx.lineWidth = 2;
        if (action.def.corner) {
          this.cornerMarker(ctx, t.cx, t.cy, zoom, `rgba(255,200,70,${pulse.toFixed(2)})`);
        } else {
          this.tilePath(ctx, t.x, t.y, this.cellarFrame && game.buildings.cellar(t.x, t.y) !== undefined);
          ctx.strokeStyle = `rgba(255,200,70,${pulse.toFixed(2)})`;
          ctx.stroke();
        }
        ctx.lineWidth = 1;
      }
    };
    if (!this.cellarFrame) marks();

    /*
     * Night: a cold wash over the whole world, with a hole burnt in it by
     * everything alight. The wash is laid down on its own layer so each light
     * can be taken back out of it with a soft-edged gradient; that is what
     * makes a lantern feel like a lantern rather than a brighter circle.
     * Markers and the hud sit on top of the lot.
     */
    const dark = game.darkness();
    // The warm end of the day arrives before the dark does, so the wash is
    // asked for whatever the darkness reads.
    const washes = skyWash(game.hourOfDay(), dark);
    if (washes.length) {
      // Gathered once at the top of the frame when it is dark enough to want them (`lightsNow`).
      const lights = dark > 0.02 ? this.lightsNow : game.lights();
      if (!lights.length && !this.glows.length && !this.runeNight.active) {
        for (const wash of washes) {
          ctx.fillStyle = `rgba(${wash.colour}, ${wash.alpha.toFixed(3)})`;
          ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
      } else {
        const W = this.canvas.width, H = this.canvas.height;
        const lit = this.lightLayers(lights, W, H);
        /*
         * The wash is one colour, so the night is mixed at the size its holes
         * were worked out at and laid over the screen scaled up. What has a
         * light of its own -- an altar's stars, a runestone's runes -- is
         * fine work, cut out of a copy of its own box at the screen's pixels
         * as the night goes down (`RunestoneNight.lay`), so it asks for the
         * full size only when two such boxes overlap.
         */
        const patch = this.runeNight.active && this.runeNight.separate;
        const res = this.runeNight.active && !patch ? 1 : LIGHT_RES;
        /*
         * At the lights' own size the night is mixed on their mask itself,
         * which is the night's shape already: the washes laid on it as one
         * colour, inside what the lights leave of it. It was a layer of its
         * own, cleared, washed and cut to the mask, every frame.
         */
        const night = res === LIGHT_RES ? lit.mask : this.nightLayer(res);
        this.night = night;
        const nc = night.getContext('2d') as CanvasRenderingContext2D;
        nc.setTransform(1, 0, 0, 1, 0, 0);
        if (res === LIGHT_RES) {
          nc.globalCompositeOperation = 'source-in';
          nc.fillStyle = washInk(washes);
          nc.fillRect(0, 0, night.width, night.height);
        } else {
          nc.globalCompositeOperation = 'source-over';
          nc.clearRect(0, 0, night.width, night.height);
          for (const wash of washes) {
            nc.fillStyle = `rgba(${wash.colour}, ${wash.alpha.toFixed(3)})`;
            nc.fillRect(0, 0, night.width, night.height);
          }
          // What the lights leave of it (`lightLayers`).
          nc.globalCompositeOperation = 'destination-in';
          nc.drawImage(lit.mask, 0, 0, lit.mask.width / LIGHT_RES, lit.mask.height / LIGHT_RES);
        }
        nc.globalCompositeOperation = 'destination-out';
        // And off whatever has a light of its own, where it was drawn this frame: at the layer's own size.
        nc.setTransform(res, 0, 0, res, 0, 0);
        for (const n of this.glows) {
          for (const h of furnitureHoles(n.sx, n.sy, zoom, n.kind, n.view)) softHole(nc, h.x, h.y, h.r, h.a);
        }
        nc.setTransform(1, 0, 0, 1, 0, 0);
        // And off the runestones' runes, in their own shapes, less whatever stands in front of them.
        if (!patch) this.runeNight.cut(nc);
        nc.globalCompositeOperation = 'source-over';
        if (patch) this.runeNight.lay(ctx, night, night.width / res, night.height / res);
        else ctx.drawImage(night, 0, 0, night.width / res, night.height / res);
        // A warm cast where the firelight actually falls, over the cold: the warmest light's at each spot, as dark as
        // it is, and only over the part of the screen any light reaches -- the rest of the layer is black.
        const [bx, by, bw, bh] = lit.box;
        if (bw > 0 && bh > 0) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = dark;
          ctx.drawImage(lit.warm, bx, by, bw, bh, bx / LIGHT_RES, by / LIGHT_RES, bw / LIGHT_RES, bh / LIGHT_RES);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.globalCompositeOperation = 'source-over';
        // And glass with a light burning under it, glowing through the dark (`glazing.ts`).
        if (this.glassNight.length) this.roofs.drawGlassGlow(ctx, dark);
      }
    }
    // The fireflies, which are lights: over the night, not under it.
    if (!this.fast) this.life.glow(ctx);
    // And the mote swirls' glow and glints, the same way (`glowSwirl`).
    if (dark > 0.02) for (const w of this.swirlsSeen) glowSwirl(ctx, w.x, w.y, zoom, w.s.element, this.anim, w.s.id, dark);
    // And the spells' light, over the night too, and the screen's tint for a great one of your own over that.
    this.spells.glowPass(ctx);
    this.spells.screenPass(ctx, this.canvas.width, this.canvas.height);
    // Down in a cellar, the cellar, over all of it; and the marks over that.
    if (this.cellarFrame) {
      this.cellars.drawCellarView(ctx, zoom);
      marks();
    } else this.cellarHulls.length = 0;

    // The chosen tile, marked whether or not the cursor is anywhere near it.
    const chosen = this.selected;
    if (chosen && w.inBounds(chosen.x, chosen.y)) {
      this.tilePath(ctx, chosen.x, chosen.y, !!chosen.down && this.cellarFrame, chosen.level);
      ctx.fillStyle = 'rgba(227,182,87,0.14)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(240,205,120,0.95)';
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    const hover = this.hover;
    this.drawProspected(ctx);
    // A settlement previewed draws the borders already standing beside it, as your own being on does.
    const previewed = this.previewShown();
    if ((game.deed && (game.settings.deedBorder || (hover && game.isMyToken(hover.x, hover.y)))) || previewed) this.drawDeedBorder(ctx);
    if (previewed) this.drawFoundPreview(ctx, previewed);
    if (hover) {
      this.tilePath(ctx, hover.x, hover.y, !!hover.down, hover.level);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.stroke();
      ctx.lineWidth = 1;
      const carryingCrate = game.inventory.items.some((it) => crateKindOfItem(it.id));
      if (carryingCrate && hover.crate === undefined) {
        // The 4 by 4 snap grid, with the spot a crate would take: on the cellar's floor, picked down there.
        const floor = hover.down ? cellarFloorHeight(game, hover.x, hover.y) : 0;
        const h = (wx: number, wy: number): number => (hover.down ? floor : w.heightAt(wx, wy)) + 0.3;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        for (let i = 1; i < SUBTILES; i++) {
          const f = i / SUBTILES;
          ctx.beginPath();
          ctx.moveTo(cam.worldToScreenX(hover.x + f, hover.y), cam.worldToScreenY(hover.x + f, hover.y, h(hover.x + f, hover.y)));
          ctx.lineTo(cam.worldToScreenX(hover.x + f, hover.y + 1), cam.worldToScreenY(hover.x + f, hover.y + 1, h(hover.x + f, hover.y + 1)));
          ctx.moveTo(cam.worldToScreenX(hover.x, hover.y + f), cam.worldToScreenY(hover.x, hover.y + f, h(hover.x, hover.y + f)));
          ctx.lineTo(cam.worldToScreenX(hover.x + 1, hover.y + f), cam.worldToScreenY(hover.x + 1, hover.y + f, h(hover.x + 1, hover.y + f)));
          ctx.stroke();
        }
        const [sx0, sy0] = subtileOf(hover.x, hover.y, hover.wx, hover.wy);
        const x0 = hover.x + sx0 / SUBTILES;
        const y0 = hover.y + sy0 / SUBTILES;
        const s = 1 / SUBTILES;
        ctx.beginPath();
        ctx.moveTo(cam.worldToScreenX(x0, y0), cam.worldToScreenY(x0, y0, h(x0, y0)));
        ctx.lineTo(cam.worldToScreenX(x0 + s, y0), cam.worldToScreenY(x0 + s, y0, h(x0 + s, y0)));
        ctx.lineTo(cam.worldToScreenX(x0 + s, y0 + s), cam.worldToScreenY(x0 + s, y0 + s, h(x0 + s, y0 + s)));
        ctx.lineTo(cam.worldToScreenX(x0, y0 + s), cam.worldToScreenY(x0, y0 + s, h(x0, y0 + s)));
        ctx.closePath();
        ctx.fillStyle = game.crateAt(hover.x, hover.y, sx0, sy0, hover.down ? CELLAR_LEVEL : 0) ? 'rgba(255,90,70,0.35)' : 'rgba(120,255,140,0.35)';
        ctx.fill();
      }
      const building = hover.down ? undefined : game.buildings.buildingAt(hover.x, hover.y);
      if (hover.down) {
        // Nothing is built down in a cellar: the floor is the whole of it.
      } else if (building) {
        // Show which border a wall would go on, at the storey being worked on: on a pinned storey, the one picked on.
        const side = nearestSide(hover.x, hover.y, hover.wx, hover.wy);
        const [ax, ay, bx, by] = borderPoints(borderOf(hover.x, hover.y, side));
        const storey = hover.level !== undefined ? Math.min(hover.level, building.levels) : game.storeyFor(building);
        const h = (building.deck ?? w.getHeight(hover.x, hover.y)) + storey * WALL_HEIGHT + 0.5;
        ctx.beginPath();
        ctx.moveTo(cam.worldToScreenX(ax, ay), cam.worldToScreenY(ax, ay, h));
        ctx.lineTo(cam.worldToScreenX(bx, by), cam.worldToScreenY(bx, by, h));
        ctx.lineWidth = 4;
        ctx.strokeStyle = PLAN_COLOR;
        ctx.stroke();
        ctx.lineWidth = 1;
      } else {
        // On a pinned storey's floor out past a footprint, on that floor.
        const flat = hover.level !== undefined && hover.level > 0 ? storeyHeight(game, hover.x, hover.y, hover.level) : undefined;
        this.cornerMarker(ctx, hover.cx, hover.cy, zoom, 'rgba(255,235,150,0.9)', flat);
      }
    }
  }

  /** Sides in drawing order, exported for menus. */
  static readonly SIDES = SIDES;

  /**
   * How a sail is set: which side it is out on and how full it is. A hull
   * nobody is sailing sits with the sail slack.
   */
  /**
   * The one number a piece carries into its own model.
   *
   * A sail wants how hard it is drawing; a crate rack wants which of its eight
   * spots have a crate on them, as a mask. Two pieces, one channel, because
   * nothing else has ever needed one and a second parameter for the second
   * user would be a parameter for every piece that has no use for either.
   */
  /**
   * Which way round a piece is drawn this frame.
   *
   * What is being driven or pulled points the way it is going, and stays
   * pointing the way it went when it stops; a hull somebody else is steering,
   * or with people on her deck, points the way the game has her pointing,
   * which is the way they are stood along her; anything else stands the way
   * it was set.
   */
  private viewOf(piece: PlacedFurniture): PieceView {
    const step = (Math.PI * 2) / 64;
    if ((piece.driven || piece.hitched) && this.game.player.moving) this.pieceHeadings.set(piece.id, Math.round(this.game.heading() / step) * step);
    if (piece.helm || piece.riders?.length) this.pieceHeadings.set(piece.id, Math.round(this.game.shipHeading(piece) / step) * step);
    const heading = this.pieceHeadings.get(piece.id);
    return heading !== undefined ? headingView(heading, this.camera.rotation) : pieceView(pieceFacing(piece), this.camera.rotation);
  }

  /** How a rune lantern post is drawn: the way it faces, its moss as the stage of a statue's would be, and which of its cuts it is. */
  /** Who sleeps in a wildermon bed, as it is drawn: their kind, the stage they are drawn at, their coat and markings (`DenLook`), or nobody. */
  private denLook(f: PlacedFurniture): DenLook {
    const cr = f.sleeper !== undefined ? this.game.creatures.get(f.sleeper) : undefined;
    if (!cr) return {};
    const def = SPECIES[cr.species];
    return { sleeper: { colors: def ? coatOf(cr, def) : ['#c8b49a', '#8a7060'], seed: cr.id, species: cr.species, stage: stageOf(cr) } };
  }

  private runeLook(f: PlacedFurniture): RuneLanternLook {
    const days = pieceGreen(this.game, f, this.greenAt) ?? 0;
    const stage = Math.round(greenShows(days, 0, this.walls.wetness(f.x, f.y)) * PIECE_STAGES);
    return { facing: pieceFacing(f), stage, stages: PIECE_STAGES, variant: runeLanternVariant(f.x, f.y, f.sx, f.sy) };
  }

  private pieceTrim(f: PlacedFurniture): number | undefined {
    // A cart's or a wagon's wheels, as far round as she has rolled.
    if (WHEELS[f.kind]) return this.wheelTurn(f);
    // A rowing boat somebody is rowing has her oars out in their hands, not shipped in her.
    if (rowedPiece(f.kind)) return f.driven || f.helm ? 1 : 0;
    // A lantern post or pillar, with its lantern in it or without (`lamps.ts`).
    if (isLampPiece(f)) return f.lamp ? 1 : 0;
    // A trellis's vine, as far as it has grown, and its grapes when they are ripe (`vineyard.ts`); grown its own way, by where it stands;
    // and run on into a trellis on the tile beside it along the same wall, either hand (`VINE_JOIN`): where the wall runs on
    // behind both, with no column standing in the corner between them.
    if (isTrellis(f)) {
      const facing = pieceFacing(f);
      const [ax, ay] = ACROSS_OF[facing];
      const bld = this.game.buildings;
      const mine = borderPoints(borderOf(f.x, f.y, facing));
      const joins = (k: number): boolean => {
        const nx = f.x + k * ax, ny = f.y + k * ay;
        if (!bld.wall(0, f.x, f.y, facing) || !bld.wall(0, nx, ny, facing)) return false;
        const theirs = borderPoints(borderOf(nx, ny, facing));
        // The corner the two sides share, where a column would part them.
        const [cx, cy] = mine[0] === theirs[2] && mine[1] === theirs[3] ? [mine[0], mine[1]] : [mine[2], mine[3]];
        if (bld.column(0, cx, cy)) return false;
        return this.game.furnitureOnTile(nx, ny).some((o) => isTrellis(o) && pieceFacing(o) === facing && (o.level ?? 0) === (f.level ?? 0));
      };
      return vineTrim(vineStage(f, this.game.wallNow()), Math.floor(hash2(f.x, f.y, 53) * VINE_VARIANTS), joins(-1), joins(1));
    }
    // An arch's roses or lavender: the variety, which is its place's, and how far it has grown (`roses.ts`).
    if (FURNITURE_BY_ID.get(f.kind)?.climber) {
      const r = roseStage(f.setAt, this.game.wallNow());
      return roseTrim(Math.floor(hash2(f.x * 4 + f.sx, f.y * 4 + f.sy, 71) * 4), r.days, r.blooms);
    }
    // The moss on a piece that gathers it (`greening.ts`), a stage every two days, and which way it faces.
    if (mossyPiece(f)) {
      const days = pieceGreen(this.game, f, this.greenAt) ?? 0;
      const g = greenShows(days, 0, this.walls.wetness(f.x, f.y));
      return mossTrim(Math.round(g * PIECE_STAGES), pieceFacing(f));
    }
    // A planter is drawn with what grows in it, at the stage it is at, tended or not.
    if (isPlanter(f)) {
      const c = this.game.planted.get(f.id);
      return c ? planterTrim(c.id, c.stage, c.tendedNow) : 0;
    }
    if (rackSpots(f)) {
      let mask = 0;
      const deck = rackDeck(f);
      for (let n = 0; n < deck.length; n++) {
        if (this.game.crateAt(f.x, f.y, deck[n][0], deck[n][1])) mask |= 1 << n;
      }
      return mask;
    }
    return this.sailTrim(f);
  }

  /**
   * What somebody just said, over their head.
   *
   * The drawing itself is `drawSpeech`, which takes an age rather than a stamp
   * so that it can be handed any moment of a bubble's life and drawn on its
   * own — which is how it was checked, nine of them side by side, rather than
   * by squinting at a game and hoping somebody typed something.
   */
  private speechBubble(ctx: CanvasRenderingContext2D, zoom: number, sx: number, sy: number, text: string, at: number): void {
    drawSpeech(ctx, zoom, sx, sy, text, performance.now() / 1000 - at);
  }

  /**
   * The weather on a piece's cloth this frame: the wind turned into the
   * piece's own frame, which way it faces being which way its cloth hangs; the
   * drawing clock; its dye; and the device of the settlement it stands on.
   */
  private airOf(f: PlacedFurniture): Air {
    const s = this.surf;
    const facing = pieceFacing(f);
    const [fx, fy] = FRONT_OF[facing], [ax, ay] = ACROSS_OF[facing];
    const deed = this.deedOver(f.x, f.y);
    return {
      x: s.dirX * ax + s.dirY * ay, y: s.dirX * fx + s.dirY * fy, force: s.force, t: this.anim,
      tint: dyeOf(f) ?? undefined, device: deed ? deviceOf(deed) : undefined,
    };
  }

  /** The name of the settlement over a tile, yours or anybody's, or null. */
  private deedOver(x: number, y: number): string | null {
    const own = this.game.deed;
    if (own && Math.abs(x - own.x) <= own.radius && Math.abs(y - own.y) <= own.radius) return own.name;
    return this.game.deedAt(x, y)?.name ?? null;
  }

  private sailTrim(f: PlacedFurniture): number | undefined {
    const def = FURNITURE_BY_ID.get(f.kind)?.boat;
    if (!def?.sail) return undefined;
    if (!f.driven) return 0.25;
    return sailTrim(this.game.heading(), this.game.wind());
  }

  /**
   * What is under the cursor, asked no oftener than it can have changed.
   *
   * `pick` walks eleven lists of hit boxes and then searches back along the
   * lattice for the tile under the point, and it was being asked on every
   * frame whether or not anything had moved — including while the cursor sat
   * still on a menu-less screen. A cursor that has not moved is re-asked a few
   * times a second, which is quicker than anything on the island can walk out
   * from under it and a sixth of the work.
   */
  hoverPick(sx: number, sy: number): Pick | null {
    return this.picker.hoverPick(sx, sy);
  }

  /** The cursor has left the canvas: what was under it is not under it now. */
  forgetPick(): void {
    this.picker.forgetPick();
  }

  /** What is under the cursor, and for a thing set down there, the ground behind it too (`Pick.ground`). */
  pick(sx: number, sy: number): Pick | null {
    return this.picker.pick(sx, sy);
  }

  /** This entity's hit box's place in the drawing order and what it was drawn as (`HitRect.seq`, `shapes`). */
  private shaped(): { seq: number; shapes: HitShape[] } {
    return { seq: this.hitSeq++, shapes: this.entPaints.slice() };
  }
}
