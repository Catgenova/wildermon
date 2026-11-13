// The mohawk: the game's 'mohawk', "Mohawk". Built by tools/sculpt/lowmohawk.mjs: one closed shell along the head's
// middle line from the forehead's hairline over the crown to the nape, standing up in a crest of faceted spikes (the
// tallest over the crown), the sides shaved (the swept back's shave and buzz, tools/sculpt/hairs/swept.mjs). Angles in
// degrees over the head's middle line (0 straight ahead at the skull's centre, 90 straight up, 180 straight back);
// lengths in the male's head units (scaled by each body's skull, lowmohawk.mjs k).
export default {
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhairasset.mjs)
  name: 'Mohawk',
  // the strip's ends: the front this many degrees behind the forehead's hairline (the head's t0), the back this many
  // past the back of the skull (bk), down the nape
  front: 3, back: 30,
  // the strip's half-width across the skull along it (its share of the way front to back, evenly between)
  width: [0.14, 0.2, 0.21, 0.2, 0.18, 0.14, 0.1],
  // the spikes along the strip: each its base's middle (share of the strip), its tip's height off the skin, its lean
  // (degrees from straight out toward the back), and its tip's sway across (+ the head's left)
  spikes: [
    { at: 0.07, h: 0.36, lean: -4, sway: 0.015 },
    { at: 0.21, h: 0.54, lean: 2, sway: -0.02 },
    { at: 0.35, h: 0.63, lean: 8, sway: 0.02 },
    { at: 0.49, h: 0.58, lean: 16, sway: -0.015 },
    { at: 0.63, h: 0.47, lean: 24, sway: 0.01 },
    { at: 0.77, h: 0.32, lean: 34, sway: -0.01 },
    { at: 0.91, h: 0.15, lean: 55, sway: 0 },
  ],
  // a spike's shoulders (the corners each side of its tip, this share of the half-width out) stand this share of its
  // height off the skin
  shoulder: 0.65, shoulderH: 0.45,
  // a spike's flanks: a ring each side of its tip this share of the way to the valley, its middle this share of the
  // tip's height and its shoulders this share of the tip ring's (a convex cone of facets, not one flat plane a side)
  flank: { at: 0.5, h: 0.7, shoulder: 0.85 },
  // the valley between two spikes: its middle and its shoulders this far off the skin (the crest's body under the
  // spikes)
  valley: 0.2, valleyShoulder: 0.11,
  // the shades (src/sculpt/gl.ts HAIR_VALLEYS steps, 1 the darkest): a face down into a valley between two spikes, and
  // the strip's low sides (a shoulder to the border)
  shadeValley: 3, shadeLow: 4,
  // the shell's borders and its underside sunk this far into the scalp; on the nape's polygons (the neck moves them),
  // and from this many degrees before the back of the skull on, this far off the skin instead
  sink: 0.03, lift: 0.015, liftFrom: 8,
  // the sides: the swept back's shave and buzz (tools/sculpt/hairs/swept.mjs)
  sides: 'swept',
};
