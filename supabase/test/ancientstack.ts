/**
 * Ancient finds stack.
 *
 * Asked for: "items like ancient comb, ancient seed pot, ancient file should stack". A relic's restored thing was not
 * stackable, so every one was a row of its own. This asks, of both sides:
 *
 *   * that every one of them stacks, and the restored gear (helm, short sword) does not;
 *   * that two given at different QL are one pile at the average by the unit;
 *   * that a pile of stamps pressed has one taken off it, its goes on it alone, the started one pressed before a fresh
 *     one is started, and gone after its last;
 *   * and that the migration's one-off fold puts the piles already apart together -- in a pack and in a store -- and
 *     leaves a kept one as it is.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Game } from '../../src/game/game';
import { ITEM_DEFS } from '../../src/game/items';
import { pressStamp, STAMP, STAMP_GOES } from '../../src/game/relicuse';
import { psql, check, finish } from './harness';

const FINDS = ['bronze_mirror', 'ancient_comb', 'ancient_file', 'ancient_lamp', 'ancient_pot', 'ancient_collar',
  'ancient_bridle', 'ancient_brace', 'ancient_whetstone', 'ancient_seed_jar', 'ancient_stamp', 'rune_tablet'];
const GEAR = ['ancient_helm', 'ancient_short_sword'];
const U = 'a5c1e0a7-0000-4000-8000-00000000ac0b';
const MIGRATION = readFileSync(resolve('supabase/migrations/20261128010900_ancient_finds_stack.sql'), 'utf8');
const FOLD = MIGRATION.slice(MIGRATION.indexOf('do $$'), MIGRATION.indexOf('end $$;') + 'end $$;'.length);
const sqlList = (ids: string[]): string => ids.map((id) => `'${id}'`).join(', ');

/* ---- on the island ----------------------------------------------------------------- */

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create temp table w_id (w uuid, cart bigint);
do $t$
declare w uuid; u uuid := '${U}'; v_def text; v_stamps text := ''; i int; v_cart bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Ancient piles', 733, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Delver');
  delete from item where world_id = w and holder = 'player' and holder_uid = u;

  insert into said select 'STACKABLE', string_agg(id || ':' || coalesce(stackable, false), ',' order by id)
    from item_def where id in (${sqlList([...FINDS, ...GEAR])});

  -- Two of each given apart: one pile each, at the average.
  foreach v_def in array array[${sqlList(FINDS)}]::text[] loop
    perform give(w, u, v_def, 1, 20);
    perform give(w, u, v_def, 1, 40);
  end loop;
  insert into said select 'PILES', string_agg(def || ':' || n || ':' || units || ':' || q, ',' order by def)
    from (select def, count(*) as n, sum(count) as units, round(avg(ql)::numeric, 1) as q from item
           where world_id = w and holder = 'player' and holder_uid = u group by def) p;

  -- A pile of three stamps, pressed until one is left.
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  perform give(w, u, 'ancient_stamp', 3, 30);
  for i in 1 .. ${STAMP_GOES + 1} loop
    perform press_stamp(w, u, 0.01);
    v_stamps := v_stamps || coalesce((select string_agg(count || ':' || coalesce(charges, -1), ' ' order by charges nulls last)
      from item where world_id = w and holder = 'player' and holder_uid = u and def = 'ancient_stamp'), 'gone') || ',';
  end loop;
  insert into said values ('STAMPS', v_stamps);

  -- Rows already apart, as the island left them before: in the pack, a kept one among them, and in a cart.
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  insert into item (world_id, holder, holder_uid, def, ql, count, locked) values
    (w, 'player', u, 'ancient_comb', 10, 1, false), (w, 'player', u, 'ancient_comb', 30, 2, false),
    (w, 'player', u, 'ancient_comb', 90, 1, true), (w, 'player', u, 'ancient_file', 50, 1, false);
  insert into placed (world_id, kind, sub, x, y, cx, cy, made_by, ql)
    values (w, 'furniture', 'cart', 17, 16, 17.5, 16.5, u, 50) returning id into v_cart;
  insert into item (world_id, holder, placed, def, ql, count) values
    (w, 'furniture', v_cart, 'ancient_seed_jar', 20, 1), (w, 'furniture', v_cart, 'ancient_seed_jar', 40, 1);
  insert into w_id values (w, v_cart);
end $t$;
${FOLD}
insert into said select 'FOLDPACK', string_agg(def || ':' || count || ':' || round(ql::numeric, 1) || ':' || locked, ',' order by def, locked)
  from item i join w_id on i.world_id = w_id.w where i.holder = 'player';
insert into said select 'FOLDCART', string_agg(def || ':' || count || ':' || round(ql::numeric, 1), ',' order by def)
  from item i join w_id on i.world_id = w_id.w where i.holder = 'furniture' and i.placed = w_id.cart;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

const wantStackable = [...FINDS, ...GEAR].sort().map((id) => `${id}:${FINDS.includes(id)}`).join(',');
check('every ancient find stacks on the island, the helm and short sword do not', at('STACKABLE') === wantStackable, at('STACKABLE'));
check('and in the browser the same', [...FINDS, ...GEAR].every((id) => !!ITEM_DEFS[id]?.stackable === FINDS.includes(id)));
const wantPiles = [...FINDS].sort().map((id) => `${id}:1:2:30.0`).join(',');
check('on the island, two of each given at QL 20 and 40: one pile of two at 30', at('PILES') === wantPiles, at('PILES'));

/*
 * Three fresh stamps of `STAMP_GOES` goes: one off the pile with a go fewer, down to gone, the pile of two untouched;
 * then the next one off the pile.
 */
const STAMP_WANT = [
  ...Array.from({ length: STAMP_GOES - 1 }, (_, i) => `1:${STAMP_GOES - 1 - i} 2:-1`),
  '2:-1',
  `1:${STAMP_GOES - 1} 1:-1`,
].join(',') + ',';
check('on the island, a pile of stamps pressed: one off it at a time, worn out before the next is started',
  at('STAMPS') === STAMP_WANT, `${at('STAMPS')} | ${STAMP_WANT}`);

check('the migration folds the pack: 10 and 30×2 one pile of three at 23.3, the kept one left apart',
  at('FOLDPACK') === 'ancient_comb:3:23.3:false,ancient_comb:1:90.0:true,ancient_file:1:50.0:false', at('FOLDPACK'));
check('and a store: two seed jars in a cart one pile at 30', at('FOLDCART') === 'ancient_seed_jar:2:30.0', at('FOLDCART'));

/* ---- in the browser ---------------------------------------------------------------- */

const g = Game.create(733);
for (const it of [...g.inventory.items]) g.inventory.remove(it.uid, it.count);
g.inventory.add('ancient_comb', { ql: 20 });
g.inventory.add('ancient_comb', { ql: 40 });
const combs = g.inventory.items.filter((it) => it.id === 'ancient_comb');
check('in the browser, two combs at QL 20 and 40: one pile of two at 30',
  combs.length === 1 && combs[0].count === 2 && combs[0].ql === 30, combs.map((c) => `${c.count}@${c.ql}`).join(','));

g.inventory.add(STAMP, { ql: 30, count: 3 });
const stamps: string[] = [];
for (let i = 0; i <= STAMP_GOES; i++) {
  pressStamp(g, 0.01);
  const rows = g.inventory.items.filter((it) => it.id === STAMP)
    .sort((a, b) => (a.charges ?? Infinity) - (b.charges ?? Infinity));
  stamps.push(rows.length ? rows.map((it) => `${it.count}:${it.charges ?? -1}`).join(' ') : 'gone');
}
check('in the browser, a pile of stamps pressed the same as on the island', `${stamps.join(',')},` === STAMP_WANT, stamps.join(','));

finish('ancient finds stack');
