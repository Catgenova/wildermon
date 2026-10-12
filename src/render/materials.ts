/**
 * The island's materials, as colours: the woods a board is sawn from, the
 * metals, linen, and the wall-builders' plank, log and marble. Each was
 * written where it was first drawn (furniture.ts, figure.ts, masonry.ts) and
 * is kept here instead, with nothing imported, so the same colours can paint
 * what is not the island: Runecut's window frames (`src/ui/runecut-frames.ts`),
 * which a page outside the game bundles.
 */

/**
 * The woods, sawn and planed: what a board of each looks like on a bench,
 * rather than the bark on the tree. Oak is honey, pine and birch are pale,
 * cedar and cherry run red, plum is darkest.
 */
export const WOOD_TONE: Record<string, string> = {
  pine: '#dcc093', birch: '#e4d2ae', oak: '#bb8f5c', maple: '#d8b489', willow: '#cfbe9a', cedar: '#bf7d5e',
  apple: '#bf8f72', cherry: '#ad6a4e', olive: '#bba27a', pear: '#c69e86', plum: '#955f50', peach: '#cfa682',
  fig: '#d2bb93', lemon: '#dcc692', pomegranate: '#a26e56', apricot: '#cc9f67', quince: '#caa87d',
};

/** Iron, brass and linen as the furniture is painted: a body, and the ink round it. */
export const IRON_PAINT = { body: '#6b6873', ink: '#34323b' } as const;
export const BRASS_PAINT = { body: '#d9b460', ink: '#7c5e28' } as const;
export const LINEN_PAINT = { body: '#efe9dc', ink: '#9a8f7e' } as const;

/**
 * The metals, worked, in the island's range, as gear is forged of them
 * (figure.ts): each one chalky and a shade toward blue in its shadow, steel
 * the palest of the working metals, copper and bronze warm, and the rare ones
 * each a colour nobody could take for iron.
 */
export const METAL_TONE: Record<string, [number, number, number]> = {
  iron: [138, 147, 164], steel: [160, 170, 188], copper: [188, 128, 104], bronze: [180, 148, 106], brass: [200, 180, 120],
  tin: [196, 200, 204], zinc: [176, 188, 198], lead: [124, 130, 148], silver: [212, 218, 228], gold: [222, 190, 112],
  electrum: [222, 204, 142], pewter: [164, 168, 172], adamantine: [104, 136, 166], glimmersteel: [210, 226, 240],
  mithril: [170, 198, 232], seryll: [214, 198, 152],
};

/** A plank wall's boards (masonry.ts): pine gone pale in the weather, the battens over the joints, and the ink. */
export const PLANK = {
  board: '#c9b395', boardShade: '#b49e81', boardHi: '#d8c5aa', boardDark: '#a18a6d',
  batten: '#b09678', battenShade: '#8e785f', battenHi: '#c5ad90',
  line: '#473935',
} as const;

/** A log wall's logs (masonry.ts): their side in the light, their underside, the light along their top, and the end grain. */
export const LOG = {
  side: '#98806c', under: '#6c5a57', top: '#b59e86',
  grain: '#c8ad8b', ring: '#a38a70',
  line: '#473935',
} as const;

/** Marble as the walls are laid in it (masonry.ts): the cool white, its shade, the light on an arris, its darkest, the joint and the soft grey ink. */
export const MARBLE = {
  stone: '#edeff1', shade: '#e0e3e7', hi: '#f8f9fa', dark: '#d3d7dc',
  joint: '#c3c7cd', line: '#9aa1ab',
} as const;
