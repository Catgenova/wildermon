/**
 * A four-pointed star, tapered, centred on the origin: the one a rare thing
 * wears (`shine.ts`), the altar's stars (`furniture.ts`) and a runestone's
 * motes. On its own, with nothing imported, so that drawing a star does not
 * bring the game's items with it -- which a page painting only stone (the
 * Runecut proposal, `src/ui/runecut-art.ts`) cannot load.
 */
export function star(g: CanvasRenderingContext2D, r: number, waist: number): void {
  g.beginPath();
  g.moveTo(0, -r);
  g.quadraticCurveTo(waist * 0.3, -waist * 0.3, waist, 0);
  g.quadraticCurveTo(waist * 0.3, waist * 0.3, 0, r);
  g.quadraticCurveTo(-waist * 0.3, waist * 0.3, -waist, 0);
  g.quadraticCurveTo(-waist * 0.3, -waist * 0.3, 0, -r);
  g.closePath();
}

