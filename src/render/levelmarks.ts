/**
 * The level's marks on the ground (`Renderer.drawLevelMarks`): how far round
 * the cursor's corner they reach and their colours. On their own so the help
 * can say the reach without loading the renderer.
 */

/** How far round the cursor's corner (or your own, with no cursor) corners are marked against the level, in corners. */
export const LEVEL_REACH = 3;
/** A corner at the level, above it (to dig down) and below it (to fill up), as `r,g,b`. */
export const LEVEL_AT = '120,225,140';
export const LEVEL_ABOVE = '255,170,70';
export const LEVEL_BELOW = '90,170,255';
