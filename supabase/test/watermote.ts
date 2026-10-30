/**
 * A water mote for water, the same on both sides.
 *
 * Asked for: "implement that digging a spring takes 1 water mote. crafts like
 * fountain, pool, pond, well, all take 1 water mote now as well". Dig a spring
 * and Dig a pool take `WATER_MOTES_EACH` water motes, refused without them in
 * `WATER_MOTE_NEED` (the island's `water_mote_need`); a fish pond, a well and a
 * tiered fountain have as many in their bills, refused without them as any
 * craft is. For each of the five, on the island and in the browser:
 *
 *   * refused without a water mote, in the same words on both sides;
 *   * allowed with one;
 *   * done, and the mote used up.
 *
 * Runs against the database the suite leaves behind (Hoarding, Crowd2 digging
 * and Dane on a settlement building), and puts it back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, ACTIONS, WATER_MOTE_USES, type ActionDef, type Target } from '../../src/game/actions';
import { RECIPE_BY_ID, recipeReason } from '../../src/game/recipes';
import { WATER_MOTE, WATER_MOTE_NEED, WATER_MOTES_EACH } from '../../src/game/motes';
import { itemDef } from '../../src/game/items';
import { furnitureDef } from '../../src/game/furniture';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wurm',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

/** The three pieces, by recipe. */
const PIECES = [
  { id: 'fish_pond', recipe: 'make_fish_pond' },
  { id: 'well', recipe: 'make_well' },
  { id: 'fountain', recipe: 'make_fountain' },
] as const;
const recipe = (id: string) => {
  const r = RECIPE_BY_ID.get(id);
  if (!r) throw new Error(`no recipe ${id}`);
  return r;
};
const PLATEAU = 200;
const TOP = 60;

check(`every piece's bill has ${WATER_MOTES_EACH} water mote, and its recipe as many`,
  PIECES.every((p) => furnitureDef(p.id).bill.some(([i, n]) => i === WATER_MOTE && n === WATER_MOTES_EACH)
    && recipe(p.recipe).inputs.some((i) => i.item === WATER_MOTE && (i.count ?? 1) === WATER_MOTES_EACH)),
  PIECES.map((p) => `${p.id}: ${furnitureDef(p.id).bill.map(([i, n]) => `${n} ${i}`).join(', ')}`).join(' / '));
check('the water mote says what it is spent on',
  WATER_MOTE_USES.length === 5 && WATER_MOTE_USES.every(([what, n]) => itemDef(WATER_MOTE).description?.includes(`${what} ${n}`)),
  itemDef(WATER_MOTE).description ?? '');

/* ---- On the island ------------------------------------------------------------------------------ */

const motes = (who: string): string =>
  `(select coalesce(sum(i.count), 0) from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = ${who} and i.def = '${WATER_MOTE}')`;
const island = psql(`
begin;
create temp table said (k text, v text);
create or replace function skill_check(p_skill double precision, p_difficulty double precision,
   p_tool_ql double precision default 0, p_ease double precision default 0)
   returns boolean language sql as 'select true';
create or replace function product_ql(p_skill double precision, p_tool_ql double precision default 0)
  returns double precision language sql as 'select 40::double precision';
do $b$
declare w uuid; me uuid; u uuid; v_x int; v_y int; v_first bigint;
begin
  select id into w from world where name = 'Hoarding';
  select uid into me from player where world_id = w and name = 'Crowd2';
  select uid into u from player where world_id = w and name = 'Dane';
  perform set_config('request.jwt.claims', json_build_object('sub', me)::text, true);
  delete from spring where world_id = w;
  delete from foundation where world_id = w;
  delete from item where world_id = w and holder = 'player' and holder_uid in (me, u);
  update player set body_at = now(), x = 48.5, y = 12.5, act = null, act_queue = '[]'::jsonb, level = 0 where world_id = w and uid = me;
  insert into item (world_id, def, holder, holder_uid, ql, count) values
    (w, 'shovel', 'player', me, 40, 1), (w, 'pickaxe', 'player', me, 40, 1);

  /* ---- Dig a spring: the bowl in a plateau of springs.ts. ---- */
  perform land_set_height(w, x, y, ${PLATEAU}) from generate_series(42, 58) x, generate_series(6, 20) y;
  perform land_set_height(w, x, y, ${PLATEAU - 10}) from generate_series(49, 51) x, generate_series(11, 13) y;
  perform land_set_height(w, 50, 12, ${PLATEAU - 20});
  insert into said values ('spring:without', coalesce(act_refusal(w, me, 'dig_spring', '{"kind":"tile","x":49,"y":11}'), 'ALLOWED'));
  perform give(w, me, '${WATER_MOTE}', ${WATER_MOTES_EACH}, 30);
  insert into said values ('spring:with', coalesce(act_refusal(w, me, 'dig_spring', '{"kind":"tile","x":49,"y":11}'), 'ALLOWED'));
  perform act_perform(w, me, 'dig_spring', '{"kind":"tile","x":49,"y":11}');
  insert into said values ('spring:done', (select count(*) from spring where world_id = w)::text || '|' || ${motes('me')});

  /* ---- Dig a pool: the plinth of pools.ts. ---- */
  update player set body_at = now(), x = 9.5, y = 40.5 where world_id = w and uid = me;
  perform land_set_height(w, x, y, 30) from generate_series(0, 20) x, generate_series(34, 46) y;
  insert into foundation (world_id, id, x, y, top, needed, total, made_by) values
    (w, 1, 10, 40, ${TOP}, '{"concrete":0}', '{"concrete":1}', me);
  insert into said values ('pool:without', coalesce(act_refusal(w, me, 'dig_pool', '{"kind":"tile","x":10,"y":40}'), 'ALLOWED'));
  perform give(w, me, '${WATER_MOTE}', ${WATER_MOTES_EACH}, 30);
  insert into said values ('pool:with', coalesce(act_refusal(w, me, 'dig_pool', '{"kind":"tile","x":10,"y":40}'), 'ALLOWED'));
  perform act_perform(w, me, 'dig_pool', '{"kind":"tile","x":10,"y":40}');
  insert into said values ('pool:done', (select pool::text from foundation where world_id = w and id = 1) || '|' || ${motes('me')});

  /* ---- The pieces: Dane, a Fisher with the Fish Pond perk, on a settlement of his own. ---- */
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  for v_x in 18 .. 26 loop for v_y in 22 .. 30 loop
    perform land_set_height(w, v_x, v_y, 40);
    perform land_set_tile(w, v_x, v_y, tile_id('Grass'));
  end loop; end loop;
  update player set body_at = now(), x = 21.5, y = 26.5, level = 0, act = null, act_target = null, act_started = null, act_ends = null,
         act_left = null, act_goes = null, act_queue = '[]', craft_class = 'fisher',
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, founded_by) values (w, 'Latecomer', 21, 26, 5, u)
    on conflict (world_id, founded_by) do update set x = 21, y = 26, radius = 5;
  delete from player_node where world_id = w and uid = u;
  insert into player_node (world_id, uid, node) values (w, u, 'fisher_fish_pond');
  perform class_fold(w, u);
  ${PIECES.map((p) => {
    const r = recipe(p.recipe);
    const rest = r.inputs.filter((i) => i.item !== WATER_MOTE);
    return `delete from item where world_id = w and holder = 'player' and holder_uid = u;
  ${r.tool ? `perform give(w, u, '${r.tool}', 1, 40);` : ''}
  ${rest.map((i) => `perform give(w, u, '${i.item}', ${i.count ?? 1}, 30);`).join('\n  ')}
  select i.id into v_first from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def = '${rest[0].item}' limit 1;
  insert into said values ('${p.id}:without', coalesce(act_refusal(w, u, '${p.recipe}', jsonb_build_object('kind', 'item', 'uid', null)), 'ALLOWED'));
  perform give(w, u, '${WATER_MOTE}', ${WATER_MOTES_EACH}, 30);
  insert into said values ('${p.id}:with', coalesce(act_refusal(w, u, '${p.recipe}', jsonb_build_object('kind', 'item', 'uid', null)), 'ALLOWED'));
  perform perform_craft(w, u, '${p.recipe}', jsonb_build_object('kind', 'item', 'uid', v_first));
  insert into said values ('${p.id}:done', (select coalesce(sum(i.count), 0) from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def = '${r.result}')::text
    || '|' || ${motes('u')});`;
  }).join('\n  ')}
end $b$;
select k || E'\\t' || coalesce(v, '') from said;
rollback;
`);
const isaid = new Map(island.split('\n').filter(Boolean).map((l) => {
  const [k, ...v] = l.split('\t');
  return [k, v.join('\t')];
}));
const say = (k: string): string => isaid.get(k) ?? 'unsaid';

check(`island: Dig a spring refused without a water mote: "${WATER_MOTE_NEED}"`, say('spring:without') === WATER_MOTE_NEED, say('spring:without'));
check('island: and allowed with one, the spring dug and the mote used up', say('spring:with') === 'ALLOWED' && say('spring:done') === '1|0',
  `${say('spring:with')} / ${say('spring:done')}`);
check(`island: Dig a pool refused without a water mote: "${WATER_MOTE_NEED}"`, say('pool:without') === WATER_MOTE_NEED, say('pool:without'));
check('island: and allowed with one, the pool dug and the mote used up', say('pool:with') === 'ALLOWED' && say('pool:done') === 'true|0',
  `${say('pool:with')} / ${say('pool:done')}`);
for (const p of PIECES) {
  check(`island: ${p.recipe} refused without a water mote: "${WATER_MOTE_NEED}"`, say(`${p.id}:without`) === WATER_MOTE_NEED, say(`${p.id}:without`));
  check(`island: and allowed with one, the ${p.id} made and the mote used up`, say(`${p.id}:with`) === 'ALLOWED' && say(`${p.id}:done`) === '1|0',
    `${say(`${p.id}:with`)} / ${say(`${p.id}:done`)}`);
}

/* ---- In the browser ------------------------------------------------------------------------------ */

const act = (id: string): ActionDef => ACTIONS.find((a) => a.id === id) as ActionDef;
const tile = (x: number, y: number): Target => ({ kind: 'tile', x, y, cx: x, cy: y });
const ask = (id: string, t: Target, g: Game): string => act(id).check?.(t, g) ?? 'ALLOWED';

{
  // Dig a spring: the same bowl beside where the player stands.
  const g = Game.create(31337, 128);
  const w = g.world;
  const [px, py] = [g.player.tileX, g.player.tileY];
  const bx = px + 2;
  const by = py;
  for (let y = by - 7; y <= by + 7; y++) for (let x = bx - 7; x <= bx + 8; x++) w.setHeight(x, y, PLATEAU);
  for (let y = by - 1; y <= by + 1; y++) for (let x = bx - 1; x <= bx + 1; x++) w.setHeight(x, y, PLATEAU - 10);
  w.setHeight(bx, by, PLATEAU - 20);
  g.update(0.01);
  if (!g.inventory.has('shovel')) g.inventory.add('shovel', { ql: 40 });
  const here = tile(bx - 1, by - 1);
  const without = ask('dig_spring', here, g);
  g.inventory.add(WATER_MOTE, { count: WATER_MOTES_EACH, ql: 30 });
  const allowed = ask('dig_spring', here, g);
  act('dig_spring').perform(here, g);
  check('browser: Dig a spring refused without a water mote, in the island\'s words', without === say('spring:without'), without);
  check('browser: and allowed with one, the spring dug and the mote used up',
    allowed === 'ALLOWED' && g.springs.list.size === 1 && g.inventory.count(WATER_MOTE) === 0, `${allowed} / ${g.springs.list.size} / ${g.inventory.count(WATER_MOTE)}`);
}
{
  // Dig a pool: the same plinth beside where the player stands.
  const g = Game.create(31337, 128);
  const w = g.world;
  const [px, py] = [g.player.tileX, g.player.tileY];
  const bx = px + 2;
  const by = py;
  for (let y = by - 6; y <= by + 6; y++) for (let x = bx - 6; x <= bx + 8; x++) w.setHeight(x, y, 30);
  const f = g.addFoundation(bx, by, TOP, 1);
  f.needed.concrete = 0;
  if (!g.inventory.has('pickaxe')) g.inventory.add('pickaxe', { ql: 40 });
  g.update(0.01);
  const without = ask('dig_pool', tile(bx, by), g);
  g.inventory.add(WATER_MOTE, { count: WATER_MOTES_EACH, ql: 30 });
  const allowed = ask('dig_pool', tile(bx, by), g);
  act('dig_pool').perform(tile(bx, by), g);
  check('browser: Dig a pool refused without a water mote, in the island\'s words', without === say('pool:without'), without);
  check('browser: and allowed with one, the pool dug and the mote used up',
    allowed === 'ALLOWED' && !!g.slabAt(bx, by)?.pool && g.inventory.count(WATER_MOTE) === 0, `${allowed} / ${g.slabAt(bx, by)?.pool} / ${g.inventory.count(WATER_MOTE)}`);
}
{
  // The pieces: a Fisher with the Fish Pond perk, on a settlement of their own.
  const g = Game.create(4242);
  g.setPerks({ fish_pond: 1 });
  g.deed = { name: 'Latecomer', x: g.player.tileX, y: g.player.tileY, radius: 5, level: 1, mine: true } as typeof g.deed;
  g.sureCheck = () => true;
  g.productQl = () => 40;
  for (const p of PIECES) {
    const r = recipe(p.recipe);
    for (const it of [...g.inventory.items]) g.inventory.remove(it.uid, it.count);
    if (r.tool) g.inventory.add(r.tool, { ql: 40 });
    const rest = r.inputs.filter((i) => i.item !== WATER_MOTE);
    for (const i of rest) g.inventory.add(i.item, { count: i.count ?? 1, ql: 30 });
    /*
     * The browser says the whole bill after the count it is short of, where
     * the island's craft refusal stops at the count -- as for every recipe of
     * more than one thing (`runelantern.ts`): the sentence before it is held to
     * the same words.
     */
    const without = (recipeReason(r, g) ?? 'ALLOWED').replace(/ \([^)]*\)\.$/, '.');
    g.inventory.add(WATER_MOTE, { count: WATER_MOTES_EACH, ql: 30 });
    const allowed = recipeReason(r, g) ?? 'ALLOWED';
    const first = g.inventory.find(rest[0].item)!;
    ACTION_BY_ID.get(r.id)!.perform({ kind: 'item', uid: first.uid } as Target, g);
    check(`browser: ${p.recipe} refused without a water mote, in the island's words, the browser's whole bill after it aside`,
      without === say(`${p.id}:without`) && without === WATER_MOTE_NEED, `${without} / ${say(`${p.id}:without`)}`);
    check(`browser: and allowed with one, the ${p.id} made and the mote used up`,
      allowed === 'ALLOWED' && g.inventory.count(r.result) === 1 && g.inventory.count(WATER_MOTE) === 0,
      `${allowed} / ${g.inventory.count(r.result)} / ${g.inventory.count(WATER_MOTE)}`);
  }
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not the same on both sides`);
  process.exit(1);
}
console.log(`a water mote for water — ${ok.length} of ${ok.length}`);
