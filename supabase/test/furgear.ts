/**
 * The fur set, held to its rules on both sides.
 *
 *   * five pieces, one to each place armour is worn, the class between leather and chain in soak and in burden, its
 *     weight counted at three quarters against a swing, thick against a bite and a blunt blow and poor against a point
 *     and fire; each the same on both sides, its line saying its numbers;
 *   * each piece's recipe the same on both sides, fur on leather, stitched with an awl at leatherworking; made on the
 *     island; improved with leather at leatherworking on both sides;
 *   * drawn: each piece its own garment on both bodies, a glowing part lit only when it is enchanted.
 *
 * Runs against the database the suite leaves behind, and puts it back.
 */
import { ACTIONS } from '../../src/game/actions';
import { ARMOUR, ARMOUR_CLASSES, ARMOUR_SLOTS } from '../../src/game/gear';
import { ARMOUR_SWING_BY, ARMOUR_VS, armourSays } from '../../src/game/fight';
import { ITEM_DEFS } from '../../src/game/items';
import { improvable } from '../../src/game/improve';
import { RECIPE_BY_ID, type Recipe } from '../../src/game/recipes';
import { lowScene, outfitOf } from '../../src/sculpt/lowpoly';
import { DEFAULT_LOOK } from '../../src/game/look';
import { readFileSync } from 'node:fs';
import { psql, check, finish } from './harness';

void ACTIONS.length;

const recipe = (id: string): Recipe => {
  const r = RECIPE_BY_ID.get(id);
  if (!r) throw new Error(`there is no recipe ${id}`);
  return r;
};
const sql1 = (q: string): string => psql(q).split('\n')[0]?.trim() ?? '';

/* ---- the class and its pieces ------------------------------------------------------------------- */
const F = ARMOUR_CLASSES.fur, L = ARMOUR_CLASSES.leather, C = ARMOUR_CLASSES.chain;
check('fur: between leather and chain in soak and in burden', L.soak < F.soak && F.soak < C.soak && L.burden < F.burden && F.burden < C.burden, `${F.soak} ${F.burden}`);
check('and the same on both sides',
  sql1(`select name || '|' || skill || '|' || soak || '|' || burden from armour_class_def where id = 'fur';`) === `${F.name}|${F.skill}|${F.soak}|${F.burden}`,
  sql1(`select name || '|' || skill || '|' || soak || '|' || burden from armour_class_def where id = 'fur';`));
check('its weight counted at three quarters against a swing, between leather and chain, on both sides',
  ARMOUR_SWING_BY.fur === 0.75 && ARMOUR_SWING_BY.leather < ARMOUR_SWING_BY.fur && ARMOUR_SWING_BY.fur < ARMOUR_SWING_BY.chain
    && Number(sql1(`select armour_swing_by('fur');`)) === ARMOUR_SWING_BY.fur, sql1(`select armour_swing_by('fur');`));
const vs = ARMOUR_VS.fur;
check('thick against a bite and a blunt blow, poor against a point and fire', vs.bite > 1 && vs.crush > 1 && vs.pierce < 1 && vs.burn < 1, JSON.stringify(vs));
for (const kind of Object.keys(vs) as Array<keyof typeof vs>) {
  const theirs = Number(sql1(`select armour_vs('fur', '${kind}');`));
  check(`fur against ${kind}: ${vs[kind]} on both sides`, theirs === vs[kind], String(theirs));
}

const PIECES = ARMOUR.filter((a) => a.cls === 'fur');
check('five fur pieces, one to each place armour is worn', PIECES.length === 5 && ARMOUR_SLOTS.every((s) => PIECES.filter((a) => a.slot === s).length === 1), PIECES.map((a) => a.id).join(','));
for (const a of PIECES) {
  const d = ITEM_DEFS[a.id], theirs = sql1(`select slot || '|' || cls || '|' || (select weight from item_def where id = '${a.id}') from armour_def where id = '${a.id}';`);
  check(`${d.name}: ${a.slot}, fur, ${d.weight} kg on both sides`, theirs === `${a.slot}|fur|${d.weight}`, `island ${theirs}`);
  check(`${d.name}: its line says its numbers, derived`, (d.description ?? '').includes(armourSays('fur')) && (d.description ?? '').includes(`${Math.round(F.soak * 100)}%`) && !(d.description ?? '').includes('{'), d.description ?? '');
  const r = recipe(`make_${a.id}`);
  const said = [r.result, r.skill, r.tool, r.difficulty, r.inputs.map((i) => `${i.item}x${i.count ?? 1}`).join(',')].join('|');
  const there = sql1(`select r.result || '|' || r.skill || '|' || r.tool || '|' || r.difficulty || '|'
      || (select string_agg(i.item || 'x' || i.count, ',' order by i.ord) from recipe_input i where i.recipe = r.id) from recipe r where r.id = '${r.id}';`);
  check(`${r.label}: ${said} on both sides`, there === said && r.skill === 'leatherworking' && r.tool === 'awl' && r.inputs.some((i) => i.item === 'fur') && r.inputs.some((i) => i.item === 'leather'), `island ${there}`);
  check(`${d.name}: improved with leather at leatherworking on both sides`,
    improvable(a.id)?.material.id === 'leather' && improvable(a.id)?.skill === 'leatherworking'
      && sql1(`select material || '|' || skill from improvable_of('${a.id}', null);`) === 'leather|leatherworking');
}

/* ---- made on the island ------------------------------------------------------------------------- */
const VEST = recipe('make_fur_vest');
const count = (def: string): string =>
  `(select coalesce(sum(i.count), 0) from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def = '${def}')`;
const fur = VEST.inputs.find((i) => i.item === 'fur')!.count ?? 1, leather = VEST.inputs.find((i) => i.item === 'leather')!.count ?? 1;
const out = psql(`
begin;
create temp table said (k text, v text);
do $$
declare w uuid; u uuid;
begin
  select id into w from world where name = 'Stonehaven';
  select p.uid into u from player p where p.world_id = w order by p.uid limit 1;
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  update player set body_at = now(), x = 9.5, y = 9.5, act = null, act_target = null, act_queue = '[]', craft_from_stores = false,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w and uid = u;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  insert into skill (world_id, uid, id, value) values (w, u, 'leatherworking', 60)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  create or replace function skill_check(p_skill double precision, p_difficulty double precision,
     p_tool_ql double precision default 0, p_ease double precision default 0) returns boolean language sql as 'select true';
  perform give(w, u, 'fur', ${fur}, 50, null, null, null, null, null);
  perform give(w, u, 'leather', ${leather}, 50, null, null, null, null, null);
  insert into said values ('NOAWL', coalesce(craft_refusal(w, u, '${VEST.id}', null), 'ALLOWED'));
  perform give(w, u, 'awl', 1, 40, 'Iron', null, null, null, null);
  insert into said values ('AWL', coalesce(craft_refusal(w, u, '${VEST.id}', null), 'ALLOWED'));
  perform perform_craft(w, u, '${VEST.id}', jsonb_build_object('kind', 'item', 'uid', (select i.id from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def = 'fur' order by i.id desc limit 1)));
  insert into said values ('VEST', ${count('fur_vest')}::text || '|' || ${count('fur')} || '|' || ${count('leather')});
end $$;
select k || '=' || v from said order by k;
rollback;`);
const got = (k: string): string => out.split('\n').find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1) ?? 'MISSING';
check('the island refuses a fur vest without an awl, and allows it with one', got('NOAWL') !== 'ALLOWED' && got('AWL') === 'ALLOWED', `${got('NOAWL')} / ${got('AWL')}`);
check('the island stitches a fur vest from its fur and leather', got('VEST') === '1|0|0', got('VEST'));

/* ---- drawn --------------------------------------------------------------------------------------- */
type Asset = { mats: string[]; enchanted: Array<{ kind: number }>; plain: Array<{ kind: number }>; weights: number[][]; base: number; bones: unknown[] };
// (read when the test runs, from the repository's root, as CI runs it)
const asset = (file: string, who: string): Asset => JSON.parse(readFileSync(`src/sculpt/assets/lowfur${file}-${who}.json`, 'utf8')) as Asset;
const FILE: Record<string, string> = { fur_hood: 'helm', fur_vest: 'chest', fur_cloak: 'mantle', fur_leggings: 'legs', fur_boots: 'boots' };
const ASSETS: Record<string, Record<string, Asset>> = Object.fromEntries(Object.entries(FILE).map(([id, f]) => [id, { male: asset(f, 'male'), female: asset(f, 'female') }]));
const look = (gender: 'man' | 'woman') => ({ ...DEFAULT_LOOK, gender, hair: 'none', beard: 'none' });
const tris = (gender: 'man' | 'woman', gear: object) => lowScene({ facing: 0, swimming: false, look: look(gender), gear, phase: 0, moving: false, working: false }).baked.nTris;
for (const a of PIECES) {
  for (const [who, A] of Object.entries(ASSETS[a.id])) {
    check(`${a.id} (${who}): a glow lit only when enchanted`, A.mats.some((_, i) => A.enchanted[i].kind === 1 && A.plain[i].kind !== 1), A.mats.join(' '));
    check(`${a.id} (${who}): on the body's bones alone, every point's weights summing to one`, A.bones.length === 0 && A.base === 59 && A.weights.every((w) => Math.abs(w.filter((_, j) => j % 2 === 1).reduce((s, x) => s + x, 0) - 1) < 0.01));
  }
  const o = outfitOf({ [a.slot]: { id: a.id, enchanted: true, glow: '#5cb8ff' } });
  check(`${a.id}: worn as its own garment, its glow in the outfit`, Object.values(o.glow ?? {}).includes('#5cb8ff') && Object.entries(o).some(([k, v]) => k.startsWith('fur') && v === true), JSON.stringify(o));
  for (const g of ['man', 'woman'] as const) {
    const bare = tris(g, {}), on = tris(g, { [a.slot]: { id: a.id } });
    check(`${g} in ${a.id}: drawn`, on > bare, `${bare} -> ${on}`);
  }
}
finish('The fur set, on both sides');
