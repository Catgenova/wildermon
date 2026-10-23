/**
 * Each metal an anvil is cast from, as the colour of a face full in the light
 * and one turned away from it: every one its own hue, kept in the island's
 * pastels so it sits with the stone, and far enough from the next that an
 * anvil says what it is made of from across a deed.
 */
export const ANVIL_METALS: Readonly<Record<string, readonly [string, string]>> = {
  iron: ['#a6b2c6', '#535d78'],
  steel: ['#c6ccd8', '#5e6476'],
  copper: ['#eba48a', '#8c4c4a'],
  bronze: ['#d8a878', '#7a5440'],
  brass: ['#e6cf86', '#87703c'],
  gold: ['#f6dc7a', '#a07a2e'],
  electrum: ['#ece4a6', '#88814e'],
  tin: ['#d2c6ac', '#7a6f5c'],
  pewter: ['#bcb8ae', '#6c6862'],
  zinc: ['#b6c8c2', '#5d716c'],
  lead: ['#9894aa', '#4c4862'],
  silver: ['#eaeef6', '#8a94ac'],
  adamantine: ['#8cc0a6', '#3c6a5c'],
  glimmersteel: ['#ace8ee', '#4a8c9e'],
  mithril: ['#b6cbf4', '#566ca6'],
  seryll: ['#d2baee', '#6c5894'],
};
