/**
 * Dye recipes (`dyes.ts`): a dye written down on papyrus, and boiled again, on both sides.
 *
 * Make a recipe, on a bucket of dye or a barrel of it, turns a sheet of papyrus into a recipe that records the
 * dye's parts and QL; Boil from recipe boils a bucket of lye and each primary's dyestuff, by its share of a whole
 * boil's weight, into a bucket of exactly those parts at the QL the boil rolls, never above the recipe's. So this
 * asks:
 *
 *   * of the arithmetic, over hundreds of seeded mixes: what Examine says of a recipe (the colour, the mix, the
 *     kilos and items of each dyestuff per bucket of lye, the QL at most), how hard a boil from it is, and its
 *     name, the same on both sides; and that each primary's kilos are its share of what a whole boil takes;
 *   * of the tables: the dyestuff named for each primary, the refusals, and that a boil from a recipe is worked on
 *     the same trade, for the same seconds and wind and with the same sound as a dyestuff's;
 *   * of the island, playing it, and of the browser on the same: a recipe made from a bucket and from a barrel takes
 *     one sheet and records the dye, the dye untouched; a barrel out of reach, a bucket with no dye and no sheet
 *     are refused in the browser's words; a boil from it with no lye, or short of a dyestuff, is refused in kilos;
 *     a boil gives exactly the recipe's parts at the hands' QL under the recipe's, and at the recipe's when the
 *     hands are better, takes each share's items and the lye, and keeps the recipe; a Double Boil takes half the
 *     weight; a failed boil damages the dyestuffs and the lye by their QL and hands nothing back.
 *
 * Everything random is seeded, and the island's dice are taken out of it (a check that passes or fails as asked,
 * a product QL that is fixed). The island half is rolled back.
 *
 *   npx esbuild supabase/test/dyerecipes.ts --bundle --platform=node --format=esm --packages=external \
 *     --outfile=node_modules/.cache/dyerecipes.mjs && node node_modules/.cache/dyerecipes.mjs
 */
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { itemName, type Item } from '../../src/game/items';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { failDamage, failDamagedSaid, failPartSaid } from '../../src/game/faildamage';
import {
  colourWord, DYE_PARTS, DYE_QL_BLACK, DYE_QL_WHITE, DYE_RECIPE, dyeHex, dyeRecipeId, dyeText, PRIMARIES, pureDye, mixDye, RECIPE_STUFF, type DyeLiquid,
  DYESTUFFS,
} from '../../src/game/dyestuffs';
import {
  BOIL_DYE_RECIPE, BOIL_IN, BOIL_LITRES, countForGrams, DYE_RECIPE_SAID, MAKE_DYE_RECIPE, recipeBoilOf, recipeDifficulty, recipeSays, recipeShares, shareGrams,
  weightRefusal,
} from '../../src/game/dyes';
import { PERK_BY_ID } from '../../src/game/perks';
import { BUCKET_LITRES, type PlacedFurniture } from '../../src/game/furniture';
import { strokeOf } from '../../src/audio/sound';
import { mulberry32 } from '../../src/world/noise';
import { psql, ok, bad, check } from './harness';

const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;
const firstDiff = (a: string[], b: string[]): string => {
  const i = a.findIndex((x, k) => x !== b[k]);
  return i < 0 ? (a.length === b.length ? '' : `${a.length} against ${b.length}`) : `at ${i}: island ${a[i]}, browser ${b[i]}`;
};

/* ---- the arithmetic, over many mixes ------------------------------------------ */

const rand = mulberry32(20261101);
const int = (n: number): number => Math.floor(rand() * n);
const MIXES: DyeLiquid[] = [pureDye('red', 50), pureDye('yellow', 40), pureDye('blue', 60),
  { red: 500, yellow: 0, blue: 500, ql: 40 }, { red: 334, yellow: 333, blue: 333, ql: 50 }, { red: 1, yellow: 0, blue: 999, ql: 12.34 }];
while (MIXES.length < 400) {
  const r = int(DYE_PARTS + 1);
  const y = int(DYE_PARTS - r + 1);
  MIXES.push({ red: r, yellow: y, blue: DYE_PARTS - r - y, ql: [DYE_QL_BLACK, DYE_QL_WHITE, 1 + int(9900) / 100][int(10) < 8 ? 2 : int(2)] });
}
const asRows = (ls: DyeLiquid[]): string =>
  `unnest(array[${ls.map((l) => l.red).join(',')}]::int[], array[${ls.map((l) => l.yellow).join(',')}]::int[],
          array[${ls.map((l) => l.blue).join(',')}]::int[], array[${ls.map((l) => l.ql).join(',')}]::double precision[]) with ordinality u(r, y, b, ql, o)`;
const mixOf = 'row(u.r, u.y, u.b, u.ql, null)::dye_mix';

{
  // Each between brackets, so the space it opens with is not trimmed off the first.
  const isle = psql(`select string_agg('[' || dye_recipe_says(${mixOf}) || '#' || dye_recipe_hard(${mixOf}) || '#' || dye_recipe_job(${mixOf}) || ']', '|' order by o)
    from ${asRows(MIXES)}`).split('|');
  const here = MIXES.map((l) => `[${recipeSays(l)}#${recipeDifficulty(l)}#${recipeBoilOf(l)}]`);
  check(`what Examine says of a recipe, how hard a boil from it is and the boil it is rolled as are the same on both sides for ${MIXES.length} seeded mixes`,
    isle.join('|') === here.join('|'), firstDiff(isle, here));
  const shares = psql(`select string_agg(s.item || ':' || s.grams || ':' || s.n, ',' order by u.o, s.o) from ${asRows(MIXES)}
    cross join lateral dye_recipe_shares(null, null, ${mixOf}) s`).split(',');
  const sharesHere = MIXES.flatMap((l) => recipeShares(l).map((s) => `${s.from}:${s.grams}:${s.count}`));
  check('and each share, its dyestuff, grams and items, the same on both sides', shares.join(',') === sharesHere.join(','), firstDiff(shares, sharesHere));
  // A whole boil's weight is a kilo a litre of the lye; each primary takes its parts of it, to the gram over.
  const whole = BOIL_LITRES * 1000;
  const wrong = MIXES.filter((l) => recipeShares(l).some((s) => s.grams !== Math.ceil(whole * l[s.primary] / DYE_PARTS - 1e-6)
    || s.count !== countForGrams(s.from, s.grams) || s.from !== RECIPE_STUFF[s.primary]));
  check(`each primary's kilos are its parts of the ${whole / 1000} kg a ${BOIL_LITRES}-litre bucket of lye takes, in the fewest whole items over them`,
    wrong.length === 0 && recipeShares({ red: 500, yellow: 0, blue: 500, ql: 40 }).map((s) => `${s.from}:${s.grams}`).join(',') === 'raspberry:2500,blueberry:2500',
    wrong.slice(0, 3).map((l) => dyeText(l)).join(' '));
}

/* ---- the tables -------------------------------------------------------------------- */

{
  const isle = psql(`select string_agg(p || ':' || dye_recipe_stuff(p), ' ' order by o) from unnest(array['red', 'yellow', 'blue']) with ordinality x(p, o)`);
  const here = PRIMARIES.map((p) => `${p}:${RECIPE_STUFF[p]}`).join(' ');
  const easiest = PRIMARIES.every((p) => DYESTUFFS.filter((d) => d.primary === p).every((d) => d.difficulty >= DYESTUFFS.find((x) => x.from === RECIPE_STUFF[p])!.difficulty));
  check(`a recipe names the easiest dyestuff of each primary, the same on both sides: ${here}`, isle === here && easiest, isle);
  const said = psql(`select string_agg(k || '=' || dye_recipe_said(k), '|' order by k) from unnest(array[${Object.keys(DYE_RECIPE_SAID).map(q).join(',')}]) k`);
  const saidHere = Object.entries(DYE_RECIPE_SAID).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('|');
  check('and every refusal in the same words', said === saidHere, said);
  const boil = RECIPE_BY_ID.get(dyeRecipeId('raspberry'))!;
  const mine = ACTION_BY_ID.get(BOIL_DYE_RECIPE)!;
  const rows = psql(`select string_agg(id || ':' || coalesce(skill, '-') || ':' || base_time || ':' || stamina, ' ' order by id) from action_def where id in (${q(BOIL_DYE_RECIPE)}, ${q(boil.id)})`);
  check('a boil from a recipe is worked on the same trade, for the same seconds and wind, and sounds the same, as a dyestuff\'s boil, on both sides',
    mine.skill === boil.skill && mine.baseTime === boil.baseTime && mine.stamina === boil.stamina && strokeOf(mine) === strokeOf(ACTION_BY_ID.get(boil.id)!)
      && rows === `${BOIL_DYE_RECIPE}:${boil.skill}:${boil.baseTime}:${boil.stamina} ${boil.id}:${boil.skill}:${boil.baseTime}:${boil.stamina}`,
    `${rows}; sound ${strokeOf(mine)}`);
  check('and making one makes a sound', strokeOf(ACTION_BY_ID.get(MAKE_DYE_RECIPE)!) !== null, String(strokeOf(ACTION_BY_ID.get(MAKE_DYE_RECIPE)!)));
}

/* ---- the island, played ------------------------------------------------------------ */

const MIRA = 'd7e00000-0000-4000-8000-0000000000a1';
const HANDS_QL = 37.5;
const PURPLE: DyeLiquid = mixDye(pureDye('red', 40), 2, pureDye('blue', 40), 2);
const PURPLE4 = dyeText(PURPLE, 4);
const DIM: DyeLiquid = { red: 600, yellow: 300, blue: 100, ql: 30 };
const DIM_BARREL = dyeText(DIM);
const DOUBLE = PERK_BY_ID.get('naturalist_double_boil')!.fx['litres:dye'];
const SHARES = recipeShares(PURPLE);
const DIM_SHARES = recipeShares(DIM);
const halfShares = recipeShares(PURPLE, (p) => shareGrams(PURPLE[p], DOUBLE));
const giveShares = (shares: typeof SHARES, less = 0): string =>
  shares.map((s, i) => `perform give(w, u, ${q(s.from)}, ${s.count - (i === 0 ? less : 0)}, 30);`).join('\n    ');
const out = psql(`
begin;
create temp table said (k text, v text);
create temp table fails (no boolean);
insert into fails values (false);
create or replace function skill_check(p_skill double precision, p_difficulty double precision,
  p_tool_ql double precision default 0, p_ease double precision default 0) returns boolean language sql as 'select not (select no from fails)';
create or replace function product_ql(p_skill double precision, p_tool_ql double precision default 0)
  returns double precision language sql as 'select ${HANDS_QL}::double precision';
do $t$
declare w uuid; u uuid := '${MIRA}'; v_b bigint; v_barrel bigint; v_far bigint; v_rec bigint; v_dim bigint; v_mul jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Recipes', 4246, 64, 30, 30, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set body_at = now(), x = 30.5, y = 30.5, level = 0 where world_id = w and uid = u;
  delete from item where world_id = w and holder_uid = u;

  -- 1. From a bucket of purple: no sheet, then two sheets and one is taken.
  v_b := give(w, u, 'dye_bucket', 1, 40); update item set dye = ${q(PURPLE4)} where id = v_b;
  insert into said values ('NO_SHEET', coalesce(act_refusal(w, u, '${MAKE_DYE_RECIPE}', jsonb_build_object('kind', 'item', 'uid', v_b)), 'ALLOWED'));
  perform give(w, u, 'papyrus', 2, 30);
  insert into said values ('MAKE_ASK', coalesce(act_refusal(w, u, '${MAKE_DYE_RECIPE}', jsonb_build_object('kind', 'item', 'uid', v_b)), 'ALLOWED'));
  delete from event where world_id = w and uid = u;
  perform act_perform(w, u, '${MAKE_DYE_RECIPE}', jsonb_build_object('kind', 'item', 'uid', v_b));
  insert into said select 'MADE', string_agg(i.def || ':' || coalesce(i.dye, '-') || ':' || i.ql || ':' || i.count, ',' order by i.def) from item i where i.world_id = w and i.holder_uid = u;
  insert into said select 'MADE_SAID', string_agg(e.text, '#' order by e.n) from event e where e.world_id = w and e.uid = u and e.kind = 'event';
  select id into v_rec from item where world_id = w and holder_uid = u and def = '${DYE_RECIPE}';
  insert into said select 'NAME', item_name(i) from item i where i.id = v_rec;
  insert into said select 'LOOK', examine_item_text(w, u, i) from item i where i.id = v_rec;
  v_b := give(w, u, 'bucket', 1, 20);
  insert into said values ('NO_DYE', coalesce(act_refusal(w, u, '${MAKE_DYE_RECIPE}', jsonb_build_object('kind', 'item', 'uid', v_b)), 'ALLOWED'));

  -- 2. From a barrel beside you, and not from one out of reach.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, litres, liquid, dye, since)
    values (w, 'furniture', 'barrel', 31, 30, 0, 0, 31.5, 30.5, 40, u, 20, 'dye', ${q(DIM_BARREL)}, now()) returning id into v_barrel;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, litres, liquid, dye, since)
    values (w, 'furniture', 'barrel', 40, 30, 0, 0, 40.5, 30.5, 40, u, 20, 'dye', ${q(DIM_BARREL)}, now()) returning id into v_far;
  insert into said values ('FAR', coalesce(act_refusal(w, u, '${MAKE_DYE_RECIPE}', jsonb_build_object('kind', 'furniture', 'id', v_far)), 'ALLOWED'));
  insert into said values ('BARREL_ASK', coalesce(act_refusal(w, u, '${MAKE_DYE_RECIPE}', jsonb_build_object('kind', 'furniture', 'id', v_barrel)), 'ALLOWED'));
  perform act_perform(w, u, '${MAKE_DYE_RECIPE}', jsonb_build_object('kind', 'furniture', 'id', v_barrel));
  select id into v_dim from item where world_id = w and holder_uid = u and def = '${DYE_RECIPE}' and id <> v_rec;
  insert into said select 'FROM_BARREL', (select i.dye || ':' || i.ql || ':' || item_name(i) from item i where i.id = v_dim)
    || '#' || (select p.litres || ':' || p.dye from placed p where p.id = v_barrel)
    || '#' || (select coalesce(sum(count), 0) from item where world_id = w and holder_uid = u and def = 'papyrus');

  -- 3. Boiling the purple: no lye, short of the first dyestuff, then all of it.
  delete from item where world_id = w and holder_uid = u and def not in ('${DYE_RECIPE}');
  insert into said values ('NO_LYE', coalesce(act_refusal(w, u, '${BOIL_DYE_RECIPE}', jsonb_build_object('kind', 'item', 'uid', v_rec)), 'ALLOWED'));
  perform give(w, u, '${BOIL_IN}', 1, 30);
  ${giveShares(SHARES, 1)}
  insert into said values ('SHORT', coalesce(act_refusal(w, u, '${BOIL_DYE_RECIPE}', jsonb_build_object('kind', 'item', 'uid', v_rec)), 'ALLOWED'));
  perform give(w, u, ${q(SHARES[0].from)}, 1, 30);
  insert into said values ('BOIL_ASK', coalesce(act_refusal(w, u, '${BOIL_DYE_RECIPE}', jsonb_build_object('kind', 'item', 'uid', v_rec)), 'ALLOWED'));
  delete from event where world_id = w and uid = u;
  perform act_perform(w, u, '${BOIL_DYE_RECIPE}', jsonb_build_object('kind', 'item', 'uid', v_rec));
  insert into said select 'BOILED', string_agg(i.def || ':' || coalesce(i.dye, '-') || ':' || i.ql || ':' || i.count, ',' order by i.def, i.id) from item i where i.world_id = w and i.holder_uid = u;
  insert into said select 'BOILED_SAID', string_agg(e.text, '#' order by e.n) from event e where e.world_id = w and e.uid = u and e.kind = 'event';

  -- 4. The dim one, at QL 30 under hands of ${HANDS_QL}: it comes off at 30.
  delete from item where world_id = w and holder_uid = u and def not in ('${DYE_RECIPE}');
  perform give(w, u, '${BOIL_IN}', 1, 30);
  ${giveShares(DIM_SHARES)}
  perform act_perform(w, u, '${BOIL_DYE_RECIPE}', jsonb_build_object('kind', 'item', 'uid', v_dim));
  insert into said select 'CAPPED', string_agg(i.def || ':' || coalesce(i.dye, '-') || ':' || i.ql || ':' || i.count, ',' order by i.def, i.id) from item i where i.world_id = w and i.holder_uid = u;

  -- 5. A Double Boil: half the weight.
  delete from item where world_id = w and holder_uid = u and def not in ('${DYE_RECIPE}');
  v_mul := (select class_mul from player where world_id = w and uid = u);
  update player set class_mul = coalesce(class_mul, '{}'::jsonb)
      || jsonb_build_object('fx', coalesce(class_mul->'fx', '{}'::jsonb) || jsonb_build_object('litres:dye', ${DOUBLE}))
    where world_id = w and uid = u;
  perform give(w, u, '${BOIL_IN}', 1, 30);
  ${giveShares(SHARES)}
  insert into said values ('DOUBLE_ASK', coalesce(act_refusal(w, u, '${BOIL_DYE_RECIPE}', jsonb_build_object('kind', 'item', 'uid', v_rec)), 'ALLOWED'));
  perform act_perform(w, u, '${BOIL_DYE_RECIPE}', jsonb_build_object('kind', 'item', 'uid', v_rec));
  insert into said select 'DOUBLE', string_agg(i.def || ':' || coalesce(i.dye, '-') || ':' || i.count, ',' order by i.def, i.id) from item i where i.world_id = w and i.holder_uid = u;
  update player set class_mul = v_mul where world_id = w and uid = u;

  -- 6. A boil that fails.
  delete from item where world_id = w and holder_uid = u and def not in ('${DYE_RECIPE}');
  update fails set no = true;
  perform give(w, u, '${BOIL_IN}', 1, 30);
  ${giveShares(SHARES)}
  delete from event where world_id = w and uid = u;
  perform act_perform(w, u, '${BOIL_DYE_RECIPE}', jsonb_build_object('kind', 'item', 'uid', v_rec));
  insert into said select 'FAILED', string_agg(i.def || ':' || coalesce(i.dye, '-') || ':' || i.count || ':' || i.dmg, ',' order by i.def, i.id) from item i where i.world_id = w and i.holder_uid = u;
  insert into said select 'FAILED_SAID', string_agg(e.text, '#' order by e.n) from event e where e.world_id = w and e.uid = u and e.kind = 'event';
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? `(${k} unsaid)`;

/* ---- the browser, the same way --------------------------------------------------- */

const g = Game.create(4246);
g.rand = mulberry32(4246);
let fails = false;
g.sureCheck = () => !fails;
(g as unknown as { productQl: () => number }).productQl = () => HANDS_QL;
const said = (fn: () => void): string => {
  g.log.length = 0;
  fn();
  return g.log.filter((l) => l.kind === 'event').map((l) => l.text).join('#');
};
const give = (id: string, ql: number, count = 1, dye?: string): Item => {
  const it = g.inventory.add(id, { ql, count });
  if (dye) it.dye = dye;
  return it;
};
const itemT = (it: Item): Target => ({ kind: 'item', uid: it.uid });
const ask = (id: string, t: Target): string => ACTION_BY_ID.get(id)?.check?.(t, g) ?? 'ALLOWED';
const act = (id: string, t: Target): string => said(() => { ACTION_BY_ID.get(id)?.perform(t, g); });
/** The pack as the island lists it: by kind, then by number. */
const pack = (withQl = true): string => [...g.inventory.items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : a.uid - b.uid))
  .map((i) => `${i.id}:${i.dye ?? '-'}:${withQl ? `${i.ql}:` : ''}${i.count}`).join(',');
const keepRecipes = (): void => { g.inventory.items = g.inventory.items.filter((i) => i.id === DYE_RECIPE); };
const giveShares2 = (shares: typeof SHARES, less = 0): void => shares.forEach((s, i) => { give(s.from, 30, s.count - (i === 0 ? less : 0)); });
const px = Math.floor(g.player.x), py = Math.floor(g.player.y);
g.player.x = px + 0.5;
g.player.y = py + 0.5;
g.inventory.items.length = 0;

let rec: Item | undefined;
{
  const bucket = give('dye_bucket', 40, 1, PURPLE4);
  const noSheet = ask(MAKE_DYE_RECIPE, itemT(bucket));
  check('a recipe with no papyrus in the pack is refused, in the same words on both sides', noSheet === at('NO_SHEET') && noSheet === DYE_RECIPE_SAID.noSheet,
    `island "${at('NO_SHEET')}", browser "${noSheet}"`);
  give('papyrus', 30, 2);
  const asked = ask(MAKE_DYE_RECIPE, itemT(bucket));
  const made = act(MAKE_DYE_RECIPE, itemT(bucket));
  rec = g.inventory.items.find((i) => i.id === DYE_RECIPE);
  check(`a recipe made from a bucket of purple takes one sheet and records its parts and QL, ${dyeText(PURPLE)} at QL ${PURPLE.ql}, the bucket untouched, on both sides`,
    asked === 'ALLOWED' && at('MAKE_ASK') === 'ALLOWED' && pack() === at('MADE') && rec?.dye === dyeText(PURPLE) && rec?.ql === PURPLE.ql
      && bucket.dye === PURPLE4 && g.inventory.count('papyrus') === 1,
    `island ${at('MADE')}, browser ${pack()}`);
  check('and says what it wrote, in the same words', made === at('MADE_SAID'), `island "${at('MADE_SAID')}", browser "${made}"`);
  check(`its name says the colour and the hex, the same on both sides: "${rec ? itemName(rec) : ''}"`,
    !!rec && itemName(rec) === at('NAME') && itemName(rec).toLowerCase() === `${colourWord(dyeHex(PURPLE))} dye recipe (${dyeHex(PURPLE)})`,
    `island ${at('NAME')}, browser ${rec ? itemName(rec) : '-'}`);
  const look = rec ? act('examine_item', itemT(rec)) : '';
  check('and Examine says the mix, the kilos of each dyestuff per bucket of lye and the QL at most, in the island\'s words',
    look === at('LOOK') && look.includes(recipeSays(PURPLE)), `island "${at('LOOK')}", browser "${look}"`);
  const plain = give('bucket', 20);
  const noDye = ask(MAKE_DYE_RECIPE, itemT(plain));
  check('an empty bucket has no dye to write down, in the same words', noDye === at('NO_DYE') && noDye === DYE_RECIPE_SAID.noDye, `island "${at('NO_DYE')}", browser "${noDye}"`);
}

let dimRec: Item | undefined;
{
  const barrel = g.addFurniture('barrel', px + 1, py, 0, 0, 40) as PlacedFurniture;
  const far = g.addFurniture('barrel', px + 10, py, 0, 0, 40) as PlacedFurniture;
  for (const f of [barrel, far]) {
    f.litres = 20;
    f.liquid = 'dye';
    f.dye = DIM_BARREL;
  }
  const farAsk = ask(MAKE_DYE_RECIPE, { kind: 'furniture', id: far.id });
  check('a barrel out of reach is refused, in the same words', farAsk === at('FAR') && farAsk === DYE_RECIPE_SAID.far, `island "${at('FAR')}", browser "${farAsk}"`);
  const asked = ask(MAKE_DYE_RECIPE, { kind: 'furniture', id: barrel.id });
  act(MAKE_DYE_RECIPE, { kind: 'furniture', id: barrel.id });
  dimRec = g.inventory.items.find((i) => i.id === DYE_RECIPE && i !== rec);
  const mine = `${dimRec?.dye}:${dimRec?.ql}:${dimRec ? itemName(dimRec) : '-'}#${barrel.litres}:${barrel.dye}#${g.inventory.count('papyrus')}`;
  check('a recipe made from a barrel beside you records its dye and takes the last sheet, the barrel untouched, on both sides',
    asked === 'ALLOWED' && at('BARREL_ASK') === 'ALLOWED' && mine === at('FROM_BARREL') && dimRec?.dye === DIM_BARREL && barrel.litres === 20,
    `island ${at('FROM_BARREL')}, browser ${mine}`);
}

{
  keepRecipes();
  const noLye = ask(BOIL_DYE_RECIPE, itemT(rec!));
  check('a boil from a recipe with no bucket of lye is refused, in the same words', noLye === at('NO_LYE') && noLye === DYE_RECIPE_SAID.noLye,
    `island "${at('NO_LYE')}", browser "${noLye}"`);
  give(BOIL_IN, 30);
  giveShares2(SHARES, 1);
  const short = ask(BOIL_DYE_RECIPE, itemT(rec!));
  const want = weightRefusal(SHARES[0].from, SHARES[0].grams, SHARES[0].count - 1);
  check(`one ${SHARES[0].from} short, it is refused in kilos, "${want}", on both sides`, short === at('SHORT') && short === want, `island "${at('SHORT')}", browser "${short}"`);
  give(SHARES[0].from, 30);
  const asked = ask(BOIL_DYE_RECIPE, itemT(rec!));
  const boiled = act(BOIL_DYE_RECIPE, itemT(rec!));
  const bucket = g.inventory.items.find((i) => i.id === 'dye_bucket');
  const wantDye = dyeText({ ...PURPLE, ql: HANDS_QL }, BOIL_LITRES);
  check(`with ${SHARES.map((s) => `${s.count} ${s.from}`).join(' and ')} and a bucket of lye, it boils into ${BOIL_LITRES} litres of exactly the recipe's parts at the hands' QL ${HANDS_QL}, under its ${PURPLE.ql}; all of them taken and the recipe kept, on both sides`,
    asked === 'ALLOWED' && at('BOIL_ASK') === 'ALLOWED' && pack() === at('BOILED') && bucket?.dye === wantDye && bucket?.ql === HANDS_QL
      && g.inventory.items.length === 3 && !g.inventory.items.some((i) => i.id === BOIL_IN || SHARES.some((s) => s.from === i.id)),
    `island ${at('BOILED')}, browser ${pack()}`);
  check('and says what it took and made, in the same words', boiled === at('BOILED_SAID'), `island "${at('BOILED_SAID')}", browser "${boiled}"`);
}

{
  keepRecipes();
  give(BOIL_IN, 30);
  giveShares2(DIM_SHARES);
  act(BOIL_DYE_RECIPE, itemT(dimRec!));
  const bucket = g.inventory.items.find((i) => i.id === 'dye_bucket');
  check(`a recipe at QL ${DIM.ql} boiled by hands of ${HANDS_QL} comes off at ${DIM.ql} and not higher, on both sides`,
    pack() === at('CAPPED') && bucket?.dye === dyeText(DIM, BOIL_LITRES) && bucket?.ql === DIM.ql, `island ${at('CAPPED')}, browser ${pack()}`);
}

{
  keepRecipes();
  g.setPerks({ 'litres:dye': DOUBLE });
  give(BOIL_IN, 30);
  giveShares2(SHARES);
  const asked = ask(BOIL_DYE_RECIPE, itemT(rec!));
  act(BOIL_DYE_RECIPE, itemT(rec!));
  const left = halfShares.map((s, i) => `${s.from}:${SHARES[i].count - s.count}`);
  check(`with a Double Boil it takes half the weight, ${halfShares.map((s) => `${s.count} ${s.from}`).join(' and ')}, on both sides`,
    asked === 'ALLOWED' && at('DOUBLE_ASK') === 'ALLOWED' && pack(false) === at('DOUBLE')
      && left.every((x) => { const [id, n] = x.split(':'); return g.inventory.count(id) === Number(n); }),
    `island ${at('DOUBLE')}, browser ${pack(false)}`);
  g.setPerks({});
}

{
  keepRecipes();
  fails = true;
  give(BOIL_IN, 30);
  giveShares2(SHARES);
  const failed = act(BOIL_DYE_RECIPE, itemT(rec!));
  const hurt = [...g.inventory.items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : a.uid - b.uid))
    .map((i) => `${i.id}:${i.dye ?? '-'}:${i.count}:${i.dmg}`).join(',');
  const spoilt = (id: string): boolean => g.inventory.items.some((i) => i.id === id && i.dmg === failDamage(30));
  check(`a boil that fails damages the dyestuffs and the lye by ${failDamage(30)} and hands nothing back, the recipe kept, on both sides`,
    hurt === at('FAILED') && !g.inventory.items.some((i) => i.id === 'bucket' || i.id === 'dye_bucket')
      && g.inventory.items.filter((i) => i.id === DYE_RECIPE).length === 2 && spoilt(BOIL_IN) && SHARES.every((x) => spoilt(x.from)),
    `island ${at('FAILED')}, browser ${hurt}`);
  const words = failDamagedSaid(DYE_RECIPE_SAID.failed, [...SHARES.map((x) => failPartSaid(x.from, x.count, failDamage(30), false)),
    failPartSaid(BOIL_IN, 1, failDamage(30), false)]);
  check('and says so in the same words', failed === at('FAILED_SAID') && failed === words, `island "${at('FAILED_SAID')}", browser "${failed}", wanted "${words}"`);
  fails = false;
}
check(`a bucket of lye is ${BUCKET_LITRES} litres, what a recipe is written per`, BOIL_LITRES === BUCKET_LITRES);

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`dye recipes, written and boiled again — ${ok.length} of ${ok.length}`);
