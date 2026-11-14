/**
 * Milliseconds a frame the sculpted bodies may take, on average (`takeAsked` in `./bodies.ts`): a quarter of a frame at
 * sixty a second, the rest left for the ground, the trees, the wildermon and the browser. On a graphics card a body costs
 * well under a millisecond in a batch, so this is several a frame; on a processor-drawn GL a body costs more than a frame's
 * share, and one is drawn every few frames. In a module of its own so the measures can read it (`supabase/test/bodies.ts`).
 */
export const BODY_BUDGET_MS = 4;
