/**
 * The colours drawings on the canvas give a meaning to: a beast's health bar
 * going from good through warn to bad, the ring and the ! of a heavy blow
 * coming, the arrows at the edge of the view for what is after you, the edge
 * reddening when you are struck, and the blood you lose over your head.
 *
 * Null while the colours are standard, and each drawing keeps its own. With a
 * colour-blind palette on (Settings, Colours) `applyLook` in src/ui/theme.ts
 * fills these from the stylesheet's `--cb-world-*` tokens, so the canvas and
 * the windows swap to the same pair. Each is "r, g, b", ready for `rgba()`.
 */
export const WORLD_INK: Record<'good' | 'warn' | 'bad', string | null> = { good: null, warn: null, bad: null };

/** `fallback` with standard colours; otherwise the palette's colour for `role`, at `alpha`. */
export function inkOr(role: keyof typeof WORLD_INK, fallback: string, alpha = 1): string {
  const rgb = WORLD_INK[role];
  return rgb === null ? fallback : alpha >= 1 ? `rgb(${rgb})` : `rgba(${rgb}, ${alpha})`;
}
