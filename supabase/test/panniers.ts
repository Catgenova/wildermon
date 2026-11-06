/**
 * A pack beast's panniers: the Packlet line's (`bura`), a store on its own back.
 *
 * Asked for: "Pannier capacity by stage: 200 items at stage 1, 500 at stage 2, 1000 at stage 3"; "Its panniers open
 * like a storage container ... for its keeper (and whoever else may use the keeper's stores, as a chest on their
 * settlement would)"; "Its panniers count as nearby storage"; "It cannot be crated or released unless its panniers
 * are empty".
 *
 * One spread, asked of both sides, and the answers held together:
 *
 *   * what they hold at each stage, and with a hauling trait on it, is the same number on both;
 *   * a stack of 250 logs put in at stage 1 leaves 200 in them and 50 in the pack; a second put is refused, full, in the
 *     same words; 30 taken out by the store window's door come back to the pack;
 *   * a craft counts what is in them while the beast stands within reach (`CRAFT_REACH`), and not once it stands
 *     further off, nor with the stores out of a craft; and building (`hod_stock`) counts them too;
 *   * somebody else is refused them, in the same words; a rank on the keeper's settlement that may use its stores is
 *     not, while the beast stands on it, and one that may not is; the island sends them only where they open;
 *   * from too far off they are refused, in the same words;
 *   * crated, released, culled, sent into a crate to make way for another, or into the crate one is let out of: all
 *     refused while anything is in them, in the same words, and allowed once they are empty;
 *   * and on the island, a beast turned loose without being let go sets what is in them down where it stands, and a
 *     dead one takes it with it.
 *
 * Runs against the database the suite leaves behind: Hoarding, Dane and Hunger on it, in one transaction that is
 * rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { SPECIES, type Creature } from '../../src/game/creatures';
import { companionSwap } from '../../src/game/creatureActions';
import { CREATURE_CRATE } from '../../src/game/creaturecrate';
import { STORE_REACH } from '../../src/game/crates';
import { CRAFT_REACH } from '../../src/game/recipes';
import { pannierCap, pannierExitSaid, pannierUnits } from '../../src/game/panniers';
import type { Item } from '../../src/game/items';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
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

const NAME = 'Pip';
const LOAD = 250;
const TAKE = 30;
const [STAGE_2, STAGE_3] = [25, 50];
const def = SPECIES.bura;

/* ---- the browser --------------------------------------------------------- */

const game = Game.create(4242);
let spot: [number, number] | null = null;
for (let r = 0; r < 80 && !spot; r++) {
  for (let dx = -r; dx <= r && !spot; dx++) {
    for (const dy of [-r, r]) {
      const [x, y] = [64 + dx, 64 + dy];
      let dry = true;
      for (let j = -6; j <= 6 && dry; j++) {
        for (let i = -6; i <= 6 && dry; i++) dry = game.world.isPassable(x + i, y + j) && !game.world.hasWater(x + i, y + j);
      }
      if (dry) {
        spot = [x, y];
        break;
      }
    }
  }
}
const [px, py] = spot ?? [64, 64];
game.player.x = px + 0.5;
game.player.y = py + 0.5;
game.deed = null;
game.settings.fromStores = true;
game.settings.spareRare = false;
for (const c of [...game.crates.values()]) game.removeCrate(c.id);
for (const f of [...game.furniture.values()]) game.removeFurniture(f.id);
for (const c of [...game.creatures.list.values()]) game.creatures.remove(c.id);
const pack = game.inventory;
for (const it of [...pack.items]) if (['log', CREATURE_CRATE].includes(it.id) || it.inside) pack.remove(it.uid, it.count);

const beast: Creature = game.creatures.spawn('bura', px + 1.5, py + 0.5, 'active', game.rand, game.time - 3600 * 24);
beast.name = NAME;
beast.traits = [];
const act = (id: string): NonNullable<ReturnType<typeof ACTION_BY_ID.get>> => {
  const a = ACTION_BY_ID.get(id);
  if (!a) throw new Error(`no ${id}`);
  return a;
};
const ask = (id: string, t: Target): string => act(id).check?.(t, game) ?? 'none';
const count = (items: Item[], id: string): number => items.filter((it) => it.id === id).reduce((n, it) => n + it.count, 0);

const b: Record<string, string> = {};
// What they hold at each stage, and with a hauling trait.
beast.skills = {};
b.CAP1 = String(pannierCap(beast));
beast.skills = { body_strength: STAGE_2 };
b.CAP2 = String(pannierCap(beast));
beast.skills = { body_strength: STAGE_3 };
b.CAP3 = String(pannierCap(beast));
beast.traits = ['broad_backed'];
b.CAPT = String(pannierCap(beast));
beast.traits = [];
beast.skills = {};

// In, full, out.
const logs = pack.add('log', { count: LOAD, ql: 30, extra: 'Pine' });
const into = (uid: number, n: number): Target => ({ kind: 'item', uid, count: n, into: beast.id } as Target);
b.PUT = ask('store_in_pannier', into(logs.uid, LOAD));
act('store_in_pannier').perform(into(logs.uid, LOAD), game);
b.AFTER = `${pannierUnits(beast)},${count(pack.items, 'log')}`;
const rest = pack.items.find((it) => it.id === 'log');
b.FULL = rest ? ask('store_in_pannier', into(rest.uid, rest.count)) : '(no logs left)';
const row = beast.pannier.find((it) => it.id === 'log')!;
const out = { kind: 'item', uid: row.uid, count: TAKE } as Target;
b.TAKE = ask('take_from_store', out);
act('take_from_store').perform(out, game);
b.TAKEN = `${pannierUnits(beast)},${count(pack.items, 'log')}`;

// Crafting from the stores within reach.
b.STOCK = String(game.stockCount('log'));
beast.x = px + 0.5 + CRAFT_REACH + 2;
b.FAR = String(game.stockCount('log'));
beast.x = px + 1.5;
game.settings.fromStores = false;
b.NOSTORES = String(game.stockCount('log'));
game.settings.fromStores = true;
b.BUILD = String(game.storesWithin(CRAFT_REACH).reduce((n, s) => n + count(s.items, 'log'), 0));

// Whose they are.
const rowNow = beast.pannier.find((it) => it.id === 'log')!;
beast.mine = false;
b.OTHER = ask('take_from_store', { kind: 'item', uid: rowNow.uid, count: 1 } as Target);
beast.panniersOpen = true;
b.RANK = ask('take_from_store', { kind: 'item', uid: rowNow.uid, count: 1 } as Target);
beast.mine = true;
beast.panniersOpen = undefined;
// From too far off.
beast.x = px + 0.5 + STORE_REACH + 1.5;
b.REACH = ask('take_from_store', { kind: 'item', uid: rowNow.uid, count: 1 } as Target);
beast.x = px + 1.5;

// The ways out of your keeping.
pack.add(CREATURE_CRATE, { ql: 30 });
const me = { kind: 'creature', id: beast.id } as Target;
b.CRATE = ask('crate_creature', me);
b.RELEASE = ask('release_creature', me);
b.CULL = ask('cull_creature', me);
const other = game.creatures.spawn('rabba', px + 0.5, py + 1.5, 'deed', game.rand, game.time - 3600 * 24);
other.name = 'Nub';
const swap = companionSwap(game, other);
b.SWAP = swap && 'refused' in swap ? swap.refused : 'none';
// One in a crate, let out to follow you: the one following you goes into the crate it leaves.
pack.add(CREATURE_CRATE, { ql: 30 });
act('crate_creature').perform({ kind: 'creature', id: other.id } as Target, game);
const shut = pack.items.find((it) => it.id === CREATURE_CRATE && it.creature === other.id);
b.FOLLOW = shut ? ask('crate_follow', { kind: 'item', uid: shut.uid } as Target) : '(not crated)';
// Emptied, and every one of them is open again.
for (const it of [...beast.pannier]) act('take_from_store').perform({ kind: 'item', uid: it.uid, count: it.count } as Target, game);
b.EMPTY = String(pannierUnits(beast));
b.CRATE0 = ask('crate_creature', me);
b.RELEASE0 = ask('release_creature', me);
b.CULL0 = ask('cull_creature', me);
b.FOLLOW0 = shut ? ask('crate_follow', { kind: 'item', uid: shut.uid } as Target) : '(not crated)';

console.log('--- the browser');
check('panniers hold 200, 500 and 1000 by stage',
  b.CAP1 === String(def.pannier![0]) && b.CAP2 === String(def.pannier![1]) && b.CAP3 === String(def.pannier![2])
  && b.CAP1 === '200' && b.CAP2 === '500' && b.CAP3 === '1000', `${b.CAP1}, ${b.CAP2}, ${b.CAP3}`);
check('and a hauling trait carries more', b.CAPT === String(Math.round(1000 * 1.12)), b.CAPT);
check('250 logs put in at stage 1: 200 in, 50 left in the pack', b.PUT === 'none' && b.AFTER === '200,50', `${b.PUT}; ${b.AFTER}`);
check('a second put is refused, full', b.FULL === `${NAME}'s panniers full.`, b.FULL);
check('30 taken out come back to the pack', b.TAKE === 'none' && b.TAKEN === '170,80', `${b.TAKE}; ${b.TAKEN}`);
check('a craft counts them while it stands within reach', b.STOCK === '250', b.STOCK);
check('and not once it stands further off', b.FAR === '80', b.FAR);
check('nor with the stores out of a craft', b.NOSTORES === '80', b.NOSTORES);
check('and building reaches into them', b.BUILD === '170', b.BUILD);
check('somebody else is refused them', b.OTHER === `Not yours: ${NAME}'s panniers.`, b.OTHER);
check('and whoever the island sent them to is not', b.RANK === 'none', b.RANK);
check('from too far off they are refused', b.REACH === `Stand next to ${NAME}.`, b.REACH);
const exit = pannierExitSaid(NAME);
check('crated, released or culled: refused with anything in them',
  b.CRATE === exit && b.RELEASE === exit && b.CULL === exit, `${b.CRATE} | ${b.RELEASE} | ${b.CULL}`);
check('and into a crate to make way for another, or into the crate one is let out of', b.SWAP === exit && b.FOLLOW === exit,
  `${b.SWAP} | ${b.FOLLOW}`);
check('emptied, all of them are open again', b.EMPTY === '0' && b.CRATE0 === 'none' && b.RELEASE0 === 'none' && b.CULL0 === 'none'
  && b.FOLLOW0 === 'none', `${b.EMPTY}: ${b.CRATE0} | ${b.RELEASE0} | ${b.CULL0} | ${b.FOLLOW0}`);

/* ---- the island ---------------------------------------------------------- */

const isle = psql(`
begin;
create temp table said (k text);
do $$
declare w uuid; me uuid; them uuid; v_x int; v_y int; v_b int; v_nub int; v_logs bigint; v_row bigint; v_crate bigint;
        c creature; v_seen jsonb;
begin
  select id into w from world where name = 'Hoarding';
  select uid into me from player where world_id = w and name = 'Dane';
  select uid into them from player where world_id = w and name = 'Hunger';
  select gx, gy into v_x, v_y
    from generate_series(20, 200, 7) gx, generate_series(20, 200, 7) gy
   where not exists (select 1 from deed d where d.world_id = w
                      and abs(d.x - gx) <= d.radius + 8 and abs(d.y - gy) <= d.radius + 8)
   order by gx, gy limit 1;
  update player set body_at = now(), x = v_x + 0.5, y = v_y + 0.5, act = null, act_queue = '[]'::jsonb,
      craft_from_stores = true, craft_spare_rare = false, level = 0
   where world_id = w and uid in (me, them);
  delete from item i where i.world_id = w and i.holder = 'player' and i.holder_uid in (me, them)
    and (i.def in ('log', 'creature_crate') or is_bag(i.def));
  delete from creature where world_id = w and keeper in (me, them);
  delete from deed_member where world_id = w and (uid in (me, them) or founder in (me, them));
  delete from deed where world_id = w and founded_by in (me, them);
  perform creature_spawn(w, 'bura', v_x + 1.5, v_y + 0.5, 'active', now() - interval '1 day', me);
  -- Its spawn rolls a rarity, a form and traits, each a multiplier on what it carries (beast_mul): pinned, so both sides hold the same.
  update creature set rare = null, form_size = null, traits = '{}'::text[] where world_id = w and species = 'bura';
  select id into v_b from creature where world_id = w and keeper = me and species = 'bura';
  update creature set name = '${NAME}', traits = '{}', skills = '{}', settled_at = now(), until = now() + interval '1 hour',
      from_x = v_x + 1.5, from_y = v_y + 0.5, to_x = v_x + 1.5, to_y = v_y + 0.5, leg_at = now(), leg_ends = now()
   where world_id = w and id = v_b;

  -- What they hold at each stage, and with a hauling trait.
  select * into c from creature where world_id = w and id = v_b;
  insert into said values ('CAP1|' || pannier_cap(c));
  c.skills := '{"body_strength": ${STAGE_2}}'; insert into said values ('CAP2|' || pannier_cap(c));
  c.skills := '{"body_strength": ${STAGE_3}}'; insert into said values ('CAP3|' || pannier_cap(c));
  c.traits := '{broad_backed}'; insert into said values ('CAPT|' || pannier_cap(c));

  -- In, full, out.
  v_logs := give(w, me, 'log', ${LOAD}, 30, 'Pine');
  insert into said values ('PUT|' || coalesce(act_refusal(w, me, 'store_in_pannier',
    jsonb_build_object('kind', 'item', 'uid', v_logs, 'count', ${LOAD}, 'into', v_b)), 'none'));
  perform act_perform(w, me, 'store_in_pannier', jsonb_build_object('kind', 'item', 'uid', v_logs, 'count', ${LOAD}, 'into', v_b));
  insert into said values ('AFTER|' || pannier_units(w, v_b) || ','
    || (select coalesce(sum(count), 0) from item where world_id = w and holder = 'player' and holder_uid = me and def = 'log'));
  insert into said values ('FULL|' || coalesce(act_refusal(w, me, 'store_in_pannier', jsonb_build_object('kind', 'item',
    'uid', (select id from item where world_id = w and holder = 'player' and holder_uid = me and def = 'log' limit 1),
    'count', ${LOAD - 200}, 'into', v_b)), 'none'));
  select id into v_row from item where world_id = w and holder = 'pannier' and pannier = v_b;
  insert into said values ('TAKE|' || coalesce(act_refusal(w, me, 'take_from_store',
    jsonb_build_object('kind', 'item', 'uid', v_row, 'count', ${TAKE})), 'none'));
  perform act_perform(w, me, 'take_from_store', jsonb_build_object('kind', 'item', 'uid', v_row, 'count', ${TAKE}));
  insert into said values ('TAKEN|' || pannier_units(w, v_b) || ','
    || (select coalesce(sum(count), 0) from item where world_id = w and holder = 'player' and holder_uid = me and def = 'log'));

  -- Crafting from the stores within reach, and building.
  insert into said values ('STOCK|' || craft_count(w, me, 'log'));
  update creature set from_x = v_x + 0.5 + ${CRAFT_REACH + 2}, to_x = v_x + 0.5 + ${CRAFT_REACH + 2} where world_id = w and id = v_b;
  insert into said values ('FAR|' || craft_count(w, me, 'log'));
  update creature set from_x = v_x + 1.5, to_x = v_x + 1.5 where world_id = w and id = v_b;
  update player set craft_from_stores = false where world_id = w and uid = me;
  insert into said values ('NOSTORES|' || craft_count(w, me, 'log'));
  update player set craft_from_stores = true where world_id = w and uid = me;
  insert into said values ('BUILD|' || (select coalesce(sum(h.count), 0) from hod_stock(w, me, 'log', ${CRAFT_REACH}) h));

  -- Whose they are: somebody else; a rank on the keeper's settlement that may use its stores, and one that may not.
  insert into said values ('OTHER|' || coalesce(act_refusal(w, them, 'take_from_store',
    jsonb_build_object('kind', 'item', 'uid', v_row, 'count', 1)), 'none'));
  insert into said values ('OTHERPUT|' || coalesce(act_refusal(w, them, 'store_in_pannier',
    jsonb_build_object('kind', 'item', 'uid', give(w, them, 'log', 1, 30, 'Pine'), 'count', 1, 'into', v_b)), 'none'));
  select * into c from creature where world_id = w and id = v_b;
  insert into said values ('OTHERSENT|' || (pannier_sent(w, them, c) ? 'pannier') || ',' || (pannier_sent(w, me, c) ? 'pannier'));
  insert into said values ('OTHERSTOCK|' || craft_count(w, them, 'log'));
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Packstead', v_x, v_y, 5, 1, me);
  insert into deed_member (world_id, founder, uid, role) values (w, me, them, 'guest');
  insert into said values ('RANK|' || coalesce(act_refusal(w, them, 'take_from_store',
    jsonb_build_object('kind', 'item', 'uid', v_row, 'count', 1)), 'none'));
  insert into said values ('RANKSENT|' || (pannier_sent(w, them, c) ? 'pannier'));
  insert into said values ('RANKSTOCK|' || craft_count(w, them, 'log'));
  update deed_rank_def set perms = perms & ~power_bit('stores') where world_id = w and founder = me and name = 'Guest';
  insert into said values ('NORANK|' || coalesce(act_refusal(w, them, 'take_from_store',
    jsonb_build_object('kind', 'item', 'uid', v_row, 'count', 1)), 'none'));
  insert into said values ('NORANKSENT|' || (pannier_sent(w, them, c) ? 'pannier'));
  delete from deed_member where world_id = w and founder = me;
  delete from deed where world_id = w and founded_by = me;

  -- And what rpc_creatures hands its keeper.
  perform set_config('request.jwt.claims', json_build_object('sub', me)::text, true);
  v_seen := rpc_creatures(w, 10);
  insert into said values ('SEEN|' || coalesce((select (e->'pannier'->0->>'count') || ',' || (e->'pannier'->0->>'def')
    from jsonb_array_elements(v_seen) e where (e->>'id')::int = v_b), 'none'));

  -- From too far off.
  update creature set from_x = v_x + 0.5 + ${STORE_REACH + 1.5}, to_x = v_x + 0.5 + ${STORE_REACH + 1.5} where world_id = w and id = v_b;
  insert into said values ('REACH|' || coalesce(act_refusal(w, me, 'take_from_store',
    jsonb_build_object('kind', 'item', 'uid', v_row, 'count', 1)), 'none'));
  update creature set from_x = v_x + 1.5, to_x = v_x + 1.5 where world_id = w and id = v_b;

  -- The ways out of your keeping.
  perform give(w, me, 'creature_crate', 1, 30);
  insert into said values ('CRATE|' || coalesce(act_refusal(w, me, 'crate_creature', jsonb_build_object('kind', 'creature', 'id', v_b)), 'none'));
  insert into said values ('RELEASE|' || coalesce(act_refusal(w, me, 'release_creature', jsonb_build_object('kind', 'creature', 'id', v_b)), 'none'));
  insert into said values ('CULL|' || coalesce(act_refusal(w, me, 'cull_creature', jsonb_build_object('kind', 'creature', 'id', v_b)), 'none'));
  perform creature_spawn(w, 'rabba', v_x + 0.5, v_y + 1.5, 'deed', now() - interval '1 day', me);
  select id into v_nub from creature where world_id = w and keeper = me and species = 'rabba';
  update creature set name = 'Nub', mode = 'deed', settled_at = now(), until = now() + interval '1 hour',
      from_x = v_x + 0.5, from_y = v_y + 1.5, to_x = v_x + 0.5, to_y = v_y + 1.5, leg_at = now(), leg_ends = now()
   where world_id = w and id = v_nub;
  insert into said values ('SWAP|' || coalesce((select (companion_swap(w, me, n)).v_why from creature n where n.world_id = w and n.id = v_nub), 'none'));
  -- Nub in a crate of its own, to be let out to follow you.
  update creature set mode = 'stored' where world_id = w and id = v_nub;
  v_crate := give(w, me, 'creature_crate', 1, 30);
  update item set creature = v_nub where id = v_crate;
  insert into said values ('FOLLOW|' || coalesce(act_refusal(w, me, 'crate_follow', jsonb_build_object('kind', 'item', 'uid', v_crate)), 'none'));
  for v_row in select id from item where world_id = w and holder = 'pannier' and pannier = v_b loop
    perform act_perform(w, me, 'take_from_store', jsonb_build_object('kind', 'item', 'uid', v_row, 'count', 1000));
  end loop;
  insert into said values ('EMPTY|' || pannier_units(w, v_b));
  insert into said values ('CRATE0|' || coalesce(act_refusal(w, me, 'crate_creature', jsonb_build_object('kind', 'creature', 'id', v_b)), 'none'));
  insert into said values ('RELEASE0|' || coalesce(act_refusal(w, me, 'release_creature', jsonb_build_object('kind', 'creature', 'id', v_b)), 'none'));
  insert into said values ('CULL0|' || coalesce(act_refusal(w, me, 'cull_creature', jsonb_build_object('kind', 'creature', 'id', v_b)), 'none'));
  insert into said values ('FOLLOW0|' || coalesce(act_refusal(w, me, 'crate_follow', jsonb_build_object('kind', 'item', 'uid', v_crate)), 'none'));

  -- Turned loose without being let go: what is in them is set down where it stands. And dead: gone with it.
  v_logs := give(w, me, 'log', 12, 30, 'Pine');
  insert into said values ('LOOSE?|' || coalesce(act_refusal(w, me, 'store_in_pannier',
    jsonb_build_object('kind', 'item', 'uid', v_logs, 'count', 12, 'into', v_b)), 'none') || ',' || (select mode from creature where world_id = w and id = v_b));
  perform act_perform(w, me, 'store_in_pannier', jsonb_build_object('kind', 'item', 'uid', v_logs, 'count', 12, 'into', v_b));
  select * into c from creature where world_id = w and id = v_b;
  update creature set mode = 'wild' where world_id = w and id = v_b;
  insert into said values ('LOOSE|' || pannier_units(w, v_b) || ','
    || (select coalesce(sum(count), 0) from item where world_id = w and holder = 'ground' and def = 'log' and pannier is null
          and gx = floor(creature_x(c))::int and gy = floor(creature_y(c))::int));
  update creature set mode = 'active' where world_id = w and id = v_b;
  v_logs := give(w, me, 'log', 7, 30, 'Pine');
  perform act_perform(w, me, 'store_in_pannier', jsonb_build_object('kind', 'item', 'uid', v_logs, 'count', 7, 'into', v_b));
  insert into said values ('ALIVE|' || pannier_units(w, v_b));
  delete from creature where world_id = w and id = v_b;
  insert into said values ('DEAD|' || (select count(*) from item where world_id = w and holder = 'pannier' and pannier = v_b));
end $$;
select string_agg(k, E'\\n') from said;
rollback;
`);
const said = (key: string): string => isle.split('\n').find((l) => l.startsWith(`${key}|`))?.slice(key.length + 1) ?? '(nothing)';

console.log('--- the island');
const same = (key: string): boolean => said(key) === b[key];
for (const key of ['CAP1', 'CAP2', 'CAP3', 'CAPT']) check(`what they hold (${key}) is the browser's number`, same(key), `${said(key)} vs ${b[key]}`);
check('250 logs put in at stage 1: 200 in, 50 left in the pack', same('PUT') && same('AFTER'), `${said('PUT')}; ${said('AFTER')}`);
check('a second put is refused, full, in the same words', same('FULL'), `${said('FULL')} vs ${b.FULL}`);
check('30 taken out come back to the pack', same('TAKE') && same('TAKEN'), `${said('TAKE')}; ${said('TAKEN')}`);
check('a craft counts them while it stands within reach', same('STOCK'), `${said('STOCK')} vs ${b.STOCK}`);
check('and not once it stands further off', same('FAR'), `${said('FAR')} vs ${b.FAR}`);
check('nor with the stores out of a craft', same('NOSTORES'), `${said('NOSTORES')} vs ${b.NOSTORES}`);
check('and building reaches into them', same('BUILD'), `${said('BUILD')} vs ${b.BUILD}`);
check('somebody else is refused them, in the same words', same('OTHER') && said('OTHERPUT') === b.OTHER,
  `${said('OTHER')} | ${said('OTHERPUT')} vs ${b.OTHER}`);
// The one log they were refused putting in is the only one a craft of theirs counts.
check('and is not sent them, nor does a craft of theirs count them', said('OTHERSENT') === 'false,true' && said('OTHERSTOCK') === '1',
  `${said('OTHERSENT')}; ${said('OTHERSTOCK')}`);
check('a rank on the keeper\'s settlement that may use its stores is not refused, is sent them, and crafts from them',
  same('RANK') && said('RANKSENT') === 'true' && said('RANKSTOCK') === String(Number(said('TAKEN').split(',')[0]) + 1),
  `${said('RANK')}; ${said('RANKSENT')}; ${said('RANKSTOCK')}`);
check('one whose rank may not is refused, in the same words', said('NORANK') === b.OTHER && said('NORANKSENT') === 'false',
  `${said('NORANK')}; ${said('NORANKSENT')}`);
check('rpc_creatures hands its keeper what is in them', said('SEEN') === `${said('TAKEN').split(',')[0]},log`, said('SEEN'));
check('from too far off they are refused, in the same words', same('REACH'), `${said('REACH')} vs ${b.REACH}`);
check('crated, released or culled: refused with anything in them, in the same words',
  same('CRATE') && same('RELEASE') && same('CULL'), `${said('CRATE')} | ${said('RELEASE')} | ${said('CULL')}`);
check('and into a crate to make way for another, or into the crate one is let out of',
  same('SWAP') && same('FOLLOW'), `${said('SWAP')} | ${said('FOLLOW')}`);
check('emptied, all of them are open again', same('EMPTY') && same('CRATE0') && same('RELEASE0') && same('CULL0') && same('FOLLOW0'),
  `${said('EMPTY')}: ${said('CRATE0')} | ${said('RELEASE0')} | ${said('CULL0')} | ${said('FOLLOW0')}`);
check('turned loose without being let go, what is in them is set down where it stands', said('LOOSE') === '0,12', `${said('LOOSE?')}; ${said('LOOSE')}`);
check('and a dead one takes what is in them with it', said('ALIVE') === '7' && said('DEAD') === '0', `${said('ALIVE')}; ${said('DEAD')}`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`${ok.length} passed, ${bad.length} failed`);
if (bad.length) process.exit(1);
