import { mix, pastel, type Kind } from './beasts';
import { place, type RGB, type V3 } from './figure';
import { MONSTER_GROWTH } from './monster-size';
import { ghostKind, HALLOWMIRE_LOOK, type Ghost } from './wild-ghost';
import { FORTIGRAN_LOOK, golemKind, type Golem } from './wild-golem';
import { EMBERKIT_LOOK, emberKind, type Ember } from './wild-ember';

/**
 * Volcano Isle's three kinds (`game/volcano.ts`), each on the bones, build and moves of a wildermon line the island
 * already draws -- its walk, its strike, its standing loop -- and taken to ash and fire: the kit's pastels pulled toward
 * a warm grey, the splash molten orange, an ember glow on each.
 *
 *   * The ash wraith, on the Whispet line's ghost: its shroud ash-grey, its hem and curls soot, its lantern a coal,
 *     its eyes burning; the Cinderveil, the Soot and the Ember-eyed Wraith on the line's three stages.
 *   * The magma golem, on the Chissa line's golem: its stones basalt, its mortar and shards molten; the Basalt, the
 *     Slag and the Glassback Golem on the Brickorn's and the Fortigran's builds.
 *   * The cinder hound, on the Cindra line's fox: its coat charcoal, rust or ash, its belly ash, its tail's plume fire;
 *     the Charcoal, the Rust and the Ashpelt Hound on the line's three stages.
 *
 * Each is drawn bigger than the wildermon it is built on, as every monster is (`MONSTER_GROWTH`), and each kind's
 * variants are its subspecies, as the island rolls them (`SpeciesDef.subspecies`).
 */

/** Ash, soot and the fire in them. */
const ASH: RGB = [196, 186, 192];
const SOOT: RGB = [98, 86, 100];
const MOLTEN: RGB = [255, 150, 60];
const HOT: RGB = [255, 222, 136];
const EMBER: RGB = [236, 92, 60];

/** A kind made over: its palette's own colours over its line's, bigger, and an ember's glow at a bone of it. */
type Own = Partial<ReturnType<Kind['palette']>>;
function volcanic(base: Kind, grow: number, own: (coat: RGB, mark: RGB) => Own, ember: { bone: string; at: V3; r: number }): Kind {
  return {
    ...base,
    palette: (coat, mark) => ({ ...base.palette(coat, mark), ...own(coat, mark) }),
    size: (base.size ?? 1) * grow,
    glow: (b, a) => [
      ...(base.glow?.(b, a) ?? []),
      ...(b[ember.bone] ? [{ p: place(b[ember.bone], ember.at), r: ember.r, c: MOLTEN, a: 0.55 }] : []),
    ],
    motes: [ASH, MOLTEN],
  };
}

/* ---- the ash wraith ------------------------------------------------------------------------------------------- */

const wraithOwn = (coat: RGB, mark: RGB): Own => {
  const shroud = mix(pastel(coat, 300), ASH, 0.55);
  const hem = mix(mark, SOOT, 0.78);
  return {
    coat: shroud, coatLight: mix(shroud, [244, 236, 236], 0.5), coatDark: mix(shroud, SOOT, 0.45),
    feather: mix(shroud, hem, 0.5), mark: hem, featherDark: mix(hem, [56, 42, 60], 0.4),
    membrane: mix(shroud, MOLTEN, 0.25), eye: [70, 30, 30], lid: [92, 70, 84], flame: MOLTEN,
    // The pumpkins, the hat and the leaves of the line it is drawn on, burnt: coals, soot and ash.
    bloom: EMBER, billDark: [168, 64, 46], shell: [104, 92, 106], shellDark: [70, 60, 76], spot: mix(ASH, MOLTEN, 0.3),
    stem: [92, 80, 88], leaf: [150, 140, 146], leafDark: [110, 100, 110], horn: [150, 134, 128], hornDark: [104, 90, 92],
    crystal: HOT, crystalDark: MOLTEN, inner: [236, 140, 110], claw: SOOT,
  };
};
/**
 * The wraiths' looks, on the Hallowmire's ghost: no hat, no lanterns, no blush; the hem torn to
 * ragged points, the face hushed and shaded, and each its own shape.
 *
 *   * The Cinderveil: tall, a torn veil over its shoulders, two long tendrils spread at its sides.
 *   * The Soot Wraith: its torn veil, no tendrils, a hem of soot curls.
 *   * The Ember-eyed Wraith: tall and narrow, no veil, its tendrils, its eyes bigger.
 */
const bare = (g: Ghost, own: Partial<Ghost>): Ghost => ({ ...g, hat: undefined, lanterns: undefined, ...own, face: { ...g.face, blush: 0, shade: true, hush: true, ...(own.face ?? {}) } });
const CINDERVEIL: Ghost = bare(HALLOWMIRE_LOOK, { hem: { ...HALLOWMIRE_LOOK.hem, jag: 0.9 } });
const SOOT_LOOK: Ghost = bare(HALLOWMIRE_LOOK, { tendril: undefined, hem: { ...HALLOWMIRE_LOOK.hem, jag: 0.5, curls: 9 } });
const EMBER_EYED: Ghost = bare(HALLOWMIRE_LOOK, {
  cape: undefined, hem: { ...HALLOWMIRE_LOOK.hem, jag: 1.0, curls: 4 },
  face: { ...HALLOWMIRE_LOOK.face, size: 0.34, blush: 0, shade: true, hush: true },
});
const WRAITH_GROW = MONSTER_GROWTH * 1.1;
const wraith = (look: Ghost): Kind => volcanic(ghostKind(look), WRAITH_GROW, wraithOwn, { bone: 'body', at: [0, 0.6, 1.4], r: 0.7 });
/** The Cinderveil, the Soot and the Ember-eyed Wraith, by variant. */
export const ASH_WRAITHS: readonly Kind[] = [wraith(CINDERVEIL), wraith(SOOT_LOOK), wraith(EMBER_EYED)];

/* ---- the magma golem ------------------------------------------------------------------------------------------ */

const golemOwn = (coat: RGB, mark: RGB): Own => {
  const basalt = mix(pastel(coat, 330), [150, 112, 120], 0.55);
  const seam = mix(mark, MOLTEN, 0.6);
  return {
    coat: basalt, coatDark: mix(basalt, [84, 46, 58], 0.55), coatLight: mix(basalt, [236, 206, 200], 0.45),
    stone: mix(basalt, [96, 54, 66], 0.6), stoneDark: [74, 42, 56],
    // The bricks its line is bound with are clinker, and the mortar between them fire.
    shell: mix(basalt, EMBER, 0.45), shellDark: mix(basalt, [120, 50, 48], 0.6), hoof: seam,
    horn: mix(basalt, [226, 196, 196], 0.4), hornDark: mix(basalt, [132, 92, 104], 0.5),
    crystal: HOT, crystalDark: MOLTEN, ember: HOT, flame: MOLTEN, moss: EMBER, mark: seam,
  };
};
/**
 * The golems' looks, on the Fortigran's build: no watchtower and no moss; molten shards down the back where its line
 * has amber ones, and each its own.
 *
 *   * The Basalt Golem: a row of short shards, clinker bands round its forearms and shins.
 *   * The Slag Golem: bound in clinker, a glowing plate in its chest, few shards.
 *   * The Glassback Golem: a ridge of long shards, no bands.
 */
const magma = (own: Partial<Golem>): Golem => ({ ...FORTIGRAN_LOOK, tower: null, moss: 0, arches: false, ...own });
const BASALT_LOOK = magma({ shards: { count: 7, len: 0.9 }, brick: { fore: 2, shin: 2, shoulder: false } });
const SLAG_LOOK = magma({ shards: { count: 3, len: 0.7 }, brick: { fore: 3, shin: 2, shoulder: true }, plate: 0.5 });
const GLASSBACK_LOOK = magma({ shards: { count: 10, len: 1.5 }, brick: { fore: 0, shin: 0, shoulder: false } });
const GOLEM_GROW = MONSTER_GROWTH * 1.25;
const golem = (look: Golem): Kind => volcanic(golemKind(look), GOLEM_GROW, golemOwn, { bone: 'chest', at: [0, 0.4, 0.8], r: 0.9 });
/** The Basalt, the Slag and the Glassback Golem, by variant. */
export const MAGMA_GOLEMS: readonly Kind[] = [golem(BASALT_LOOK), golem(SLAG_LOOK), golem(GLASSBACK_LOOK)];

/* ---- the cinder hound ----------------------------------------------------------------------------------------- */

const houndOwn = (coat: RGB, mark: RGB): Own => {
  const pelt = mix(pastel(coat, 300), SOOT, 0.35);
  const belly = mix(mark, ASH, 0.5);
  return {
    coat: pelt, coatLight: mix(pelt, mark, 0.35), coatDark: mix(pelt, [50, 36, 44], 0.5),
    belly, mark: mix(ASH, EMBER, 0.45), muzzle: mix(belly, [240, 230, 224], 0.3), feather: mix(pelt, EMBER, 0.3), featherDark: mix(pelt, [70, 40, 40], 0.5),
    petal: HOT, ember: MOLTEN, flame: HOT, crystal: MOLTEN, shell: EMBER, shellDark: [140, 56, 44],
    horn: mix(ASH, HOT, 0.2), hornDark: EMBER, eye: [72, 26, 22],
  };
};
/**
 * The hounds' looks, on the Emberkit's fox: longer in the leg and the body, a narrower head, shorter ears laid back,
 * no spirals, its curled tail a plume of fire; each its own.
 *
 *   * The Charcoal Hound: lean and long-legged, its tail low.
 *   * The Rust Hound: heavier in the chest and the ruff.
 *   * The Ashpelt Hound: the longest, its tail high.
 */
const houndLook = (own: Partial<Ember>): Ember => ({
  ...EMBERKIT_LOOK,
  len: 1.6, fore: [0.46, 0.42, 0.14], hind: [0.52, 0.44, 0.3], high: 1.1,
  head: { r: [0.34, 0.5, 0.34], up: 0.1, pitch: 0 },
  snout: { len: 0.7, w: 0.14, h: 0.15 },
  eye: { dir: [0.52, 0.74, 0.28], size: 0.08 },
  ear: { at: [0.2, -0.16, 0.3], len: 0.66, w: 0.26, splay: 22, back: 36, turn: 30 },
  spiral: 0, claws: 3.4, dapples: 16,
  gait: { duty: [0.6, 0.4], swing: [0.34, 0.42], step: 0.24, bob: 0.05 },
  ...own,
});
const CHARCOAL_LOOK = houndLook({ tail: { ...EMBERKIT_LOOK.tail!, lift: 30, curl: 16 } });
const RUST_LOOK = houndLook({ ruff: { c: [0, 0.72, 0.1], r: [0.5, 0.4, 0.42], len: 0.3, rows: 3, across: 7 }, thick: 0.21 });
const ASHPELT_LOOK = houndLook({ len: 1.8, tail: { ...EMBERKIT_LOOK.tail!, lift: 70, curl: 40 } });
const HOUND_GROW = MONSTER_GROWTH * 0.9;
const hound = (look: Ember): Kind => volcanic(emberKind(look), HOUND_GROW, houndOwn, { bone: 'head', at: [0, 0.3, 0.1], r: 0.35 });
/** The Charcoal, the Rust and the Ashpelt Hound, by variant. */
export const CINDER_HOUNDS: readonly Kind[] = [hound(CHARCOAL_LOOK), hound(RUST_LOOK), hound(ASHPELT_LOOK)];
