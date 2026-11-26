/**
 * The metal sets (`src/sculpt/lowpoly.ts` METAL_SETS, `tools/sculpt/garments/metalsets.mjs`): each metal with a set of
 * its own draws its helm, chest & arms, shawl, leggings and boots as that set once it is in, the plate set's until then;
 * every piece has a glow that lights when it is enchanted; an enchanted piece glows in its enchantment's element's colour
 * (`enchantGlow`, `ELEMENT_GLOW`).
 *
 * Asked for: armour that looks different for each metal (copper first; silver is the plate set), each piece with a glowing
 * section for when it is enchanted, the glow taking the enchantment's colour.
 *
 *   npx esbuild supabase/test/metalsets.ts --bundle --platform=node --format=esm --loader:.png=dataurl \
 *     --outfile=node_modules/.cache/metalsets.mjs && node node_modules/.cache/metalsets.mjs
 */
import { lowLoadMetal, lowScene, outfitOf } from '../../src/sculpt/lowpoly';
import { DEFAULT_LOOK } from '../../src/game/look';
import { ELEMENT_GLOW, ENCHANTMENTS, enchantGlow } from '../../src/game/enchant';
import { MOTE_ELEMENTS } from '../../src/game/motes';
import { SET as COPPER } from '../../src/sculpt/metalcopper';
import { SET as IRON } from '../../src/sculpt/metaliron';
import { SET as BRONZE } from '../../src/sculpt/metalbronze';
import { SET as STEEL } from '../../src/sculpt/metalsteel';
import { SET as TIN } from '../../src/sculpt/metaltin';
import { SET as ZINC } from '../../src/sculpt/metalzinc';
import { SET as LEAD } from '../../src/sculpt/metallead';
import { SET as PEWTER } from '../../src/sculpt/metalpewter';
import { SET as BRASS } from '../../src/sculpt/metalbrass';
import { SET as GOLD } from '../../src/sculpt/metalgold';
import { SET as ELECTRUM } from '../../src/sculpt/metalelectrum';
import { SET as FIRESTEEL } from '../../src/sculpt/metalfiresteel';
import { SET as ADAMANTINE } from '../../src/sculpt/metaladamantine';
import { SET as GLIMMERSTEEL } from '../../src/sculpt/metalglimmersteel';
import { SET as MITHRIL } from '../../src/sculpt/metalmithril';
import { SET as SERYLL } from '../../src/sculpt/metalseryll';
import { check, finish } from './harness';

const SETS = { copper: COPPER, iron: IRON, bronze: BRONZE, steel: STEEL, tin: TIN, zinc: ZINC, lead: LEAD, pewter: PEWTER, brass: BRASS, gold: GOLD, electrum: ELECTRUM, firesteel: FIRESTEEL, adamantine: ADAMANTINE, glimmersteel: GLIMMERSTEEL, mithril: MITHRIL, seryll: SERYLL } as const;
const PIECES = { helm: ['head', 'helm'], chest: ['chest', 'plate_breastplate'], mantle: ['shawl', 'plate_shawl'], legs: ['legs', 'plate_legs'], boots: ['feet', 'plate_boots'] } as const;

// every element has a glow, and every enchantment's is its first mote's element's
check('every element has a glow colour', MOTE_ELEMENTS.every((e) => /^#[0-9a-f]{6}$/.test(ELEMENT_GLOW[e] ?? '')));
check('each enchantment glows in its first mote\'s element\'s colour', Object.values(ENCHANTMENTS).every((e) => enchantGlow(e.id) === ELEMENT_GLOW[e.mote.replace(/_mote$/, '')]));
check('an unknown enchantment has no glow of its own', enchantGlow('nonesuch') === undefined && enchantGlow(undefined) === undefined);

for (const [m, set] of Object.entries(SETS)) {
  for (const [piece, bodies] of Object.entries(set)) for (const [who, A] of Object.entries(bodies) as Array<[string, { mats: string[]; enchanted: Array<{ kind: number }>; plain: Array<{ kind: number }>; polys: unknown[]; weights: number[][]; base: number; bones: unknown[]; hides?: number[] }]>) {
    const glow = A.mats.map((_, i) => A.enchanted[i].kind === 1 && A.plain[i].kind !== 1);
    check(`${m} ${piece} (${who}): a glow lit only when enchanted`, glow.some(Boolean), A.mats.join(' '));
    check(`${m} ${piece} (${who}): on the body's bones alone, every point's weights summing to one`, A.bones.length === 0 && A.base === 59 && A.weights.every((w) => Math.abs(w.filter((_, j) => j % 2 === 1).reduce((s, x) => s + x, 0) - 1) < 0.01));
  }
  // the plate set's pieces drawn until the set is in, the set's own after
  const look = (gender: 'man' | 'woman') => ({ ...DEFAULT_LOOK, gender, hair: 'none', beard: 'none' });
  const tris = (gender: 'man' | 'woman', piece: keyof typeof PIECES) => { const [slot, id] = PIECES[piece]; return lowScene({ facing: 0, swimming: false, look: look(gender), gear: { [slot]: { id, material: m } }, phase: 0, moving: false, working: false }).baked.nTris; };
  const before = (['man', 'woman'] as const).map((g) => Object.fromEntries(Object.keys(PIECES).map((p) => [p, tris(g, p as keyof typeof PIECES)])));
  await lowLoadMetal(m);
  (['man', 'woman'] as const).forEach((gender, gi) => {
    const bare = lowScene({ facing: 0, swimming: false, look: look(gender), gear: {}, phase: 0, moving: false, working: false }).baked.nTris;
    for (const p of Object.keys(PIECES) as Array<keyof typeof PIECES>) {
      const after = tris(gender, p);
      check(`${gender} in ${m} ${p}: the plate set's piece before the set is in, the ${m} set's after`, before[gi][p] !== after && after > bare, `${before[gi][p]} -> ${after}`);
    }
  });
  void set;
}
// a piece names its metal as the game does (\`Iron\`, \`Fire-tempered steel\`): drawn in that metal's set as by its id
{
  const look = { ...DEFAULT_LOOK, gender: 'man' as const, hair: 'none', beard: 'none' };
  const tris = (material: string) => lowScene({ facing: 0, swimming: false, look, gear: { chest: { id: 'plate_breastplate', material } }, phase: 0, moving: false, working: false }).baked.nTris;
  check('a piece of Fire-tempered steel is drawn in the firesteel set, of Iron in the iron set', tris('Fire-tempered steel') === tris('firesteel') && tris('Iron') === tris('iron') && tris('Fire-tempered steel') !== tris('Iron'), `${tris('Fire-tempered steel')} ${tris('firesteel')} ${tris('Iron')}`);
}
// an enchanted piece's glow reaches the outfit by its enchantment key
const o = outfitOf({ chest: { id: 'plate_breastplate', material: 'copper', enchanted: true, glow: '#ff8a34' }, legs: { id: 'plate_legs', material: 'copper' } });
check('an enchanted piece\'s glow in the outfit, by its key; a plain one none', o.glow?.chest === '#ff8a34' && o.glow?.legs === undefined && o.enchanted?.chest === true, JSON.stringify(o.glow));
finish('Each metal its own set, its glow its enchantment\'s colour');
