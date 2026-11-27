/**
 * The numbers the sculpted bodies' shading is drawn by that a player reads too (What's new): on their own, with nothing
 * imported, so the text that names them takes them from here and not the renderer.
 */

/**
 * A metal's glint (`./gl.ts`): on the facets turned halfway between the light and the viewer, [how far toward the sheen's
 * colour on a metal at full brightness (a darker one by the square root of its brightest channel), from the cosine to
 * the half way, full at it].
 */
export const METAL_GLINT = [0.38, 0.955, 0.99];
/** The sheen's and the glint's colour: the metal's own hue at its brightest, this far from white. */
export const METAL_TINT = 0.4;
/** How much a metal's sheen and glint show, by its lustre (`Material.lustre`): none given, dull, plain, bright. */
export const METAL_LUSTRE = [1, 0.45, 1, 1.45];
/** Each metal's lustre, by its id: 1 dull, 2 plain, 3 bright; a metal not here plain. */
export const LUSTRE: Readonly<Record<string, 1 | 2 | 3>> = {
  lead: 1, pewter: 1, zinc: 1,
  copper: 2, iron: 2, bronze: 2, tin: 2, adamantine: 2, firesteel: 2,
  silver: 3, gold: 3, brass: 3, electrum: 3, steel: 3, glimmersteel: 3, mithril: 3, seryll: 3,
};

/** A low-poly body's occlusion (`./ao.ts`): how dark the most occluded polygon is drawn, its light times one less this. */
export const AO_MOST = 0.38;

/**
 * After dark, a body's brightness (as luma) spread out round the middle by one and this much at full night, so its forms
 * still read under the night's wash (`./gl.ts`).
 */
export const NIGHT_LIFT = 0.32;
