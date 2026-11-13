// The afro: the game's 'afro', "Afro". Built by tools/sculpt/lowafro.mjs: one closed shell, a rounded mass of tight
// curls standing out evenly all round the head, wider than it, the hairline at the forehead and the temples, the ears
// showing under its lower edge, the nape short. No reference sheet: modelled from the description. Angles in degrees;
// lengths in head units (the male skull's, scaled to each body's own: tools/sculpt/lowafro.mjs `k`).
export default {
  // the name the game shows for it (src/sculpt/assets/lowhair-styles.json, written by tools/sculpt/lowhairasset.mjs)
  name: 'Afro',
  // the rings' axis: straight up from the skull's middle tipped this far toward the back, so the hairline (the forehead
  // high, the nape low) lies near the rings' equator all round
  tilt: 32,
  // the hairline on the skin, by the head's azimuth (0 the front, 90 over the ear, 180 the nape; both sides alike): its
  // height as a landmark's plus an offset. front: the forehead's top (lowhead t0); ear: the ear's top; nape: the back of
  // the skull at the brows' level (lowhead bk)
  hairline: [[0, 'front', -0.03], [28, 'front', -0.07], [50, 'front', -0.2], [68, 'ear', 0.17], [84, 'ear', 0.07], [100, 'ear', 0.05], [118, 'ear', -0.04], [145, 'nape', -0.3], [180, 'nape', -0.38]],
  // the mass's outline: an egg about a centre this far from the skull's middle ([x, up, forward]), its radii across,
  // up and down, forward and back
  centre: [0, 0.38, -0.12], across: 1.22, up: 1.15, down: 1.0, forward: 1.0, back: 1.15,
  // the rings: this many degrees apart (each ring's points as far apart round it), the pole one point
  step: 6,
  // the last rows before the hairline (shares of the way from the pole to it): the rounded lower edge turned in to the skin
  hemRows: [0.95, 0.985, 1],
  // the lower edge's roundness: from this share of the way on, the mass's thickness falls as a quarter circle to the
  // hairline; by the head's azimuth (earlier toward the back: the nape tapered short)
  edgeFrom: [[0, 0.8], [90, 0.76], [135, 0.68], [180, 0.58]],
  // the hair's least thickness off the skin (at the nape, the short hair); at the hairline, its edge's thickness
  minThick: 0.045, lip: 0.02,
  // the inside: sunk into the scalp; its rings this many degrees apart; at the hairline just inside the outside
  sink: 0.04, innerStep: 16, innerLip: 0.006,
  // the curls: domes about centres this many degrees apart (a Fibonacci spread, each moved by up to `curlJitter` of the
  // spacing), each this many head units high; each outer corner moved up to `jitter` more, its own way
  curlSpacing: 17, curlJitter: 0.3, curlHeight: 0.15, jitter: 0.015,
  // the curls fade out over the lower edge from this share of the way on (none at the hairline)
  curlFade: [0.85, 1],
  // the valleys between the curls: a face whose corners stand lower in their domes than `valleyFrom` (1 at a dome's foot)
  // shaded (tools/sculpt/lowhair.mjs shadeOf) by how far lower, times `valleyGain`
  valleyFrom: 0.55, valleyGain: 1.0,
  // the underside (between the lower edge and the skin) and the inside, in this valley step
  undersideShade: 2, insideShade: 1,
};
