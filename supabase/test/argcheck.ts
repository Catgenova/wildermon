/**
 * What a browser hands the island, checked at the door and bounded where it was taken as said.
 *
 * Structured input (`private.check_args`): each of the ten doors that take jsonb refuses a value of the
 * wrong shape before it does anything, in one line that names the door, the argument and the key -- and
 * takes every shape the browser sends, built here from the browser's own types (`Target`, `SpellAim`,
 * `Lined`, `Look`).
 *
 * Bounds (`private.reach_refusal` and the guards of 20261026020300):
 *   * the nine set-down jobs are refused past their reach, and a crate off its tile's four subtiles;
 *   * no job pointed at a tile reaches past `reach_most`;
 *   * the ground, the creatures and the springs are read no further round you than `read_range_most`;
 *   * an island is founded with its spawn on it and a name of `island_name_most` at most;
 *   * no price, order or deal is under nought or over `price_most` silver.
 *
 * Makes its own island and rolls it back.
 */
import { execFileSync } from 'node:child_process';
import type { Target } from '../../src/game/actions';
import { randomLook } from '../../src/game/look';
import type { Lined } from '../../src/net/island';
import type { SpellAim } from '../../src/ui/spellbar';

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
const lit = (v: unknown): string => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;

const ME = 'a0d00000-0000-4000-8000-0000000000d1';
const YOU = 'a0d00000-0000-4000-8000-0000000000d2';
/** Where the body stands, and the tile next to it. */
const AT = 20;

/* ---- what the browser sends ----------------------------------------------------------------------- */

// Every kind of target, with the keys a menu puts on each (`ui.ts`, `frameMenu.ts`, `game.ts`, `play.ts`).
const targets: Array<[string, Target & Record<string, unknown>]> = [
  ['dig', { kind: 'tile', x: AT + 1, y: AT, cx: AT + 1, cy: AT }],
  ['plan_wall', { kind: 'tile', x: AT, y: AT, cx: AT, cy: AT, side: 'n', wallType: 'solid', material: 'log', level: 0 }],
  ['plan_floor', { kind: 'tile', x: AT, y: AT, cx: AT, cy: AT, floorKind: 'roof', roofShape: 'gable', material: 'thatch', buildingId: 1, terrace: false }],
  ['plan_floor', { kind: 'tile', x: AT, y: AT, cx: AT, cy: AT, floorKind: 'stairs', side: 'e', hand: 'l', down: true }],
  ['plan_bridge', { kind: 'tile', x: AT + 1, y: AT, cx: AT + 1, cy: AT, material: 'plank', width: 2, side: 'w' }],
  ['plan_aqueduct', { kind: 'tile', x: AT + 1, y: AT, cx: AT + 1, cy: AT, head: [AT, AT] }],
  ['place_furniture', { kind: 'tile', x: AT + 1, y: AT, cx: AT + 1, cy: AT, sx: 1, sy: 2, itemUid: 1, facing: 'e', level: 0 }],
  ['track', { kind: 'tile', x: AT, y: AT, cx: AT, cy: AT, species: 'shaggan' }],
  ['cast', { kind: 'tile', x: AT, y: AT, cx: AT, cy: AT, spell: 'none' }],
  ['store_in_crate', { kind: 'crate', id: 1, scroll: 2 }],
  ['bind_wound', { kind: 'person', uid: YOU, name: 'Yonne' }],
  ['fuel_campfire', { kind: 'campfire', id: 1, itemUid: 1, count: 3 }],
  ['pour_mould', { kind: 'smelter', id: 1, itemUid: 1, count: 1, mouldUid: 2 }],
  ['load_kiln', { kind: 'kiln', id: 1, itemUid: 1, count: 1 }],
  ['start_brew', { kind: 'furniture', id: 1, itemUid: 1, count: 1, brew: 'ale', slot: 0 }],
  ['smith', { kind: 'anvil', id: 1, itemUid: 1 }],
  ['assign_post', { kind: 'post', id: 1, creature: 2 }],
  ['bait_trap', { kind: 'trap', id: 1 }],
  ['build_bridge', { kind: 'bridge', id: 1 }],
  ['store_in_crate', { kind: 'item', uid: 1, count: 2, into: 3 }],
  ['improve_item', { kind: 'item', uid: 1, upto: 60 }],
  ['apply_salve', { kind: 'item', uid: 1, wound: 'arm:0' }],
  ['read_rune_tablet', { kind: 'item', uid: 1, skill: 'mining' }],
  ['travel_runestone', { kind: 'item', uid: 1, stone: 'north' }],
  ['absorb_soul', { kind: 'item', uid: 1, soul: 2, spell: 'x' }],
  ['pick_up', { kind: 'ground', x: AT, y: AT, uid: null }],
  ['pick_up', { kind: 'ground', x: AT, y: AT, uid: 4, down: true }],
  ['set_stance', { kind: 'creature', id: 1, stance: 'defensive', itemUid: 1, job: 'mining', sex: 'female', foe: 2, arrow: 'arrow' }],
  // And what a menu adds on the way: a name, a yes, which dye.
  ['name_thing', { kind: 'item', uid: 1, name: 'Old Faithful', sure: true, dyeFrom: 'barrel:1' }],
];
const aims: SpellAim[] = [
  { kind: 'self' }, { kind: 'player', uid: YOU }, { kind: 'creature', id: 3 }, { kind: 'item', id: 4 },
  { kind: 'placed', id: 5 }, { kind: 'area' }, { kind: 'area', x: AT + 2.5, y: AT - 1.25 },
];
const seen: Lined[] = [{ action: 'dig', goes: 3 }, { action: 'cut_down', goes: 1 }];
const known: Record<string, number> = { 1: 0, 42: 3 };
const look = randomLook(() => 0.5);

/* ---- and what it must not ------------------------------------------------------------------------- */

// [door, the SQL call, what the refusal says]
const refused: Array<[string, string, string]> = [
  ['rpc_act', `rpc_act($1, 'dig', ${lit({ kind: 'tile', x: '21', y: AT })})`, 'Bad request: rpc_act p_target.x: want a number.'],
  ['rpc_act', `rpc_act($1, 'dig', ${lit({ kind: 'tile', x: AT, y: AT, cx: AT, cy: AT, sx: 2.5 })})`, 'Bad request: rpc_act p_target.sx: want a whole number.'],
  ['rpc_act', `rpc_act($1, 'dig', ${lit({ kind: 'tile', x: 1e9, y: AT })})`, 'Bad request: rpc_act p_target.x: out of range.'],
  ['rpc_act', `rpc_act($1, 'dig', ${lit({ kind: 'tile', x: AT, y: AT, owner: 'me' })})`, 'Bad request: rpc_act p_target.owner: not a key.'],
  ['rpc_act', `rpc_act($1, 'dig', ${lit({ kind: 'castle', x: AT, y: AT })})`, 'Bad request: rpc_act p_target.kind: not one of its kinds.'],
  ['rpc_act', `rpc_act($1, 'name_thing', ${lit({ kind: 'item', uid: 1, name: 'x'.repeat(201) })})`, 'Bad request: rpc_act p_target.name: too long.'],
  ['rpc_act', `rpc_act($1, 'plan_aqueduct', ${lit({ kind: 'tile', x: AT, y: AT, head: [AT] })})`, 'Bad request: rpc_act p_target.head: too few.'],
  ['rpc_act', `rpc_act($1, 'bind_wound', ${lit({ kind: 'person', uid: 'somebody' })})`, 'Bad request: rpc_act p_target.uid: not int or uuid.'],
  ['rpc_act', `rpc_act($1, 'dig', '[1, 2]'::jsonb)`, 'Bad request: rpc_act p_target: want an object.'],
  ['rpc_plan_hidden_wall', `rpc_plan_hidden_wall($1, ${lit({ kind: 'tile', x: AT, y: AT, side: { n: 1 } })})`, 'Bad request: rpc_plan_hidden_wall p_target.side: want text.'],
  ['rpc_cast_spell', `rpc_cast_spell($1, 1, ${lit({ kind: 'player', uid: 7 })})`, 'Bad request: rpc_cast_spell p_target.uid: want text.'],
  ['rpc_spell', `rpc_spell($1, 'ember', ${lit({ id: 'one' })})`, 'Bad request: rpc_spell p_target.id: want a number.'],
  ['rpc_queue_order', `rpc_queue_order($1, ${lit([{ goes: 1 }])}, '{0}')`, 'Bad request: rpc_queue_order p_seen[0].action: missing.'],
  ['rpc_springs', `rpc_springs($1, 40, ${lit({ one: 1 })})`, 'Bad request: rpc_springs p_known.one: not a key.'],
  ['rpc_springs', `rpc_springs($1, 40, ${lit({ 1: 'v1' })})`, 'Bad request: rpc_springs p_known.1: want a number.'],
  ['rpc_put_land', `rpc_put_land($2, ${lit([{ heights: 'AA==' }])})`, 'Bad request: rpc_put_land p_rows[0].y: missing.'],
  ['rpc_move', `rpc_move($1, ${AT}.5, ${AT}.5, 0, ${lit([[AT, 'a']])})`, 'Bad request: rpc_move p_via[0][1]: want a number.'],
  ['rpc_set_look', `rpc_set_look(${lit({ skin: 5 })})`, 'Bad request: rpc_set_look p_look.skin: want text.'],
  ['rpc_settle', `rpc_settle(null, $1, null, false, ${lit(Array.from({ length: 501 }, (_, i) => `goal${i}`))})`, 'Bad request: rpc_settle p_ticked: too many.'],
  ['rpc_settle', `rpc_settle(null, $1, null, false, ${lit({ goal: true })})`, 'Bad request: rpc_settle p_ticked: want a list.'],
];

/* ---- the island ----------------------------------------------------------------------------------- */

const doorOf = (sql: string): string => sql.slice(0, sql.indexOf('('));
/** A call as text for `pg_temp.asked`, which runs it with the island as $1 and the one being laid down as $2. */
const dollar = (sql: string): string => `$sql$${sql}$sql$`;
const ISLE = `current_setting('my.w')::uuid, current_setting('my.new')::uuid`;

const out = psql(`
begin;
create temp table said (k text, v text);
-- A door asked, and what it said when it raised: nothing when it did not.
create function pg_temp.asked(p_sql text, w uuid, v_new uuid) returns text language plpgsql as $f$
declare v text;
begin
  delete from caller;
  execute 'select (' || p_sql || ')::text' using w, v_new;
  return '';
exception when others then
  return sqlstate || ' ' || sqlerrm;
end $f$;
do $t$
declare w uuid; me uuid := '${ME}'; v_new uuid; v_out text; v_n int := 0; v_bad text := '';
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Argshold', 194, 160, ${AT}, ${AT}, true) returning id into w;
  perform land_blank(w, 160);
  perform set_config('request.jwt.claims', json_build_object('sub', '${YOU}')::text, true);
  perform rpc_join(w, 'Yonne');
  perform set_config('request.jwt.claims', json_build_object('sub', me)::text, true);
  perform rpc_join(w, 'Arjen');
  update player set x = ${AT}.5, y = ${AT}.5, stats = jsonb_set(coalesce(stats, '{}'::jsonb), '{stamina}', '1'), body_at = now()
   where world_id = w;
  perform set_config('my.w', w::text, true);
  -- An island being laid down, for rpc_put_land.
  v_new := rpc_found('Argsfound', 1, 8, 2, 2);
  perform set_config('my.new', v_new::text, true);
end $t$;

-- Every shape the browser sends, through its door: not one refused as a bad request.
${[
  ...targets.map(([a, t]) => `rpc_act($1, '${a}', ${lit(t)})`),
  ...targets.filter(([a]) => a === 'plan_wall').map(([, t]) => `rpc_plan_hidden_wall($1, ${lit(t)})`),
  ...aims.map((aim) => `rpc_cast_spell($1, 1, ${lit(aim)})`),
  `rpc_spell($1, 'ember', ${lit({ id: 3 })})`,
  `rpc_queue_order($1, ${lit(seen)}, '{0,1}')`,
  `rpc_springs($1, 40, ${lit(known)})`,
  `rpc_springs($1, 40, '{}'::jsonb)`,
  `rpc_put_land($2, ${lit([{ y: 0, heights: 'AAAAAAAAAAAAAAAAAAAAAAAA', dirt: 'AAAAAAAAAAAA', tiles: 'AAAAAAAAAAA=', data: 'AAAAAAAAAAA=', rock: 'AAAAAAAAAAA=' }])})`,
  `rpc_move($1, ${AT}.5, ${AT}.5, 0, ${lit([[AT, AT], [AT + 0.5, AT]])})`,
  `rpc_move($1, ${AT}.5, ${AT}.5, 0, null)`,
  `rpc_set_look(${lit(look)})`,
  `rpc_settle(null, $1, null, false, ${lit(['first_dig', 'first_log'])})`,
  `rpc_settle(null, $1, null, false, null)`,
].map((sql, i) => `insert into said select 'GOOD${String(i).padStart(3, '0')}', '${doorOf(sql)}|' || pg_temp.asked(${dollar(sql)}, ${ISLE});`).join('\n')}

-- And every shape it must not: refused, in one line naming the door, the argument and the key.
${refused.map(([, sql], i) => `insert into said select 'BAD${String(i).padStart(3, '0')}', pg_temp.asked(${dollar(sql)}, ${ISLE});`).join('\n')}

-- Bounds: what is set down, how far a job reaches, how far a read reaches, an island's spawn and name, a price.
do $t$
declare w uuid := current_setting('my.w')::uuid; me uuid := '${ME}'; v_crate bigint; v_chest bigint; v_snare bigint;
        v_far int := ${AT} + 6; a text; v_out text := '';
begin
  perform set_config('request.jwt.claims', json_build_object('sub', me)::text, true);
  v_crate := give(w, me, 'crate_log', 1, 50, null, null, null, null, null);
  v_chest := give(w, me, 'chest', 1, 50, null, null, null, null, null);
  v_snare := give(w, me, 'snare', 1, 50, null, null, null, null, null);
  perform give(w, me, 'shaft', 2, 50, null, null, null, null, null);
  perform give(w, me, 'anvil', 1, 50, null, null, null, null, null);
  perform give(w, me, 'work_post', 1, 50, null, null, null, null, null);
  insert into said values ('CRATE_NEAR', coalesce(act_refusal(w, me, 'place_crate',
    jsonb_build_object('kind', 'tile', 'x', ${AT} + 1, 'y', ${AT}, 'sx', 1, 'sy', 3, 'itemUid', v_crate)), 'ok'));
  insert into said values ('CRATE_SUB', coalesce(act_refusal(w, me, 'place_crate',
    jsonb_build_object('kind', 'tile', 'x', ${AT} + 1, 'y', ${AT}, 'sx', 4, 'sy', 0, 'itemUid', v_crate)), 'ok'));
  for a in select unnest(array['place_crate', 'build_campfire', 'place_furniture', 'place_anvil', 'place_post',
                               'set_trap', 'investigate', 'place_smelter', 'place_kiln']) loop
    v_out := v_out || a || '=' || coalesce(act_refusal(w, me, a, jsonb_build_object('kind', 'tile', 'x', v_far, 'y', ${AT},
      'cx', v_far, 'cy', ${AT}, 'sx', 0, 'sy', 0,
      'itemUid', case a when 'place_crate' then v_crate when 'place_furniture' then v_chest when 'set_trap' then v_snare end)), 'ok') || ';';
  end loop;
  insert into said values ('FAR', v_out);
  insert into said values ('NEAR', coalesce(act_refusal(w, me, 'place_furniture',
    jsonb_build_object('kind', 'tile', 'x', ${AT} + 1, 'y', ${AT}, 'sx', 0, 'sy', 0, 'itemUid', v_chest)), 'ok'));
  insert into said values ('MOST', coalesce(act_refusal(w, me, 'meditate',
    jsonb_build_object('kind', 'tile', 'x', ${AT} + private.reach_most() + 1, 'y', ${AT})), 'ok')
    || '|' || coalesce(act_refusal(w, me, 'pick_up_all', jsonb_build_object('kind', 'ground', 'x', ${AT}, 'y', ${AT} + 90, 'uid', null)), 'ok'));
  insert into said values ('MOST_LIT', private.reach_most()::text);

  -- Two creatures, one in reach of a read and one past the most a read reaches.
  insert into creature (world_id, id, species, name, mode, from_x, from_y, to_x, to_y, health, sex) values
    (w, 9701, 'shaggan', 'Near', 'wild', ${AT} + 30.5, ${AT}.5, ${AT} + 30.5, ${AT}.5, 90, 'female'),
    (w, 9702, 'shaggan', 'Far', 'wild', ${AT} + 100.5, ${AT}.5, ${AT} + 100.5, ${AT}.5, 90, 'female');
  delete from caller;
  insert into said select 'READ', coalesce(string_agg(c->>'name', ',' order by c->>'name'), '')
    from jsonb_array_elements(rpc_creatures(w, 1000)) c where (c->>'id')::int in (9701, 9702);
  insert into said values ('READ_MOST', private.read_range_most()::text);
end $t$;
insert into said select 'FOUND_OFF', pg_temp.asked($q$rpc_found('Offshore', 1, 16, 16, 3)$q$, null, null);
insert into said select 'FOUND_LONG', pg_temp.asked(format('rpc_found(%L, 1, 16, 3, 3)', repeat('n', private.island_name_most() + 1)), null, null);
insert into said select 'FOUND_OK', pg_temp.asked(format('rpc_found(%L, 1, 16, 15, 0)', repeat('n', private.island_name_most())), null, null);
insert into said select 'DEAL_LESS', pg_temp.asked($q$rpc_deal($1, '${YOU}', '{}', -5, 0)$q$, current_setting('my.w')::uuid, null);
insert into said select 'DEAL_MORE', pg_temp.asked($q$rpc_deal($1, '${YOU}', '{}', 0, private.price_most() + 1)$q$, current_setting('my.w')::uuid, null);
insert into said select 'PRICE_MORE', pg_temp.asked($q$rpc_price($1, 1, private.price_most() + 1)$q$, current_setting('my.w')::uuid, null);
insert into said select 'ORDER_MORE', pg_temp.asked($q$rpc_order($1, 'log', 1, private.price_most() + 1)$q$, current_setting('my.w')::uuid, null);
insert into said select 'PRICE_OK', pg_temp.asked($q$rpc_price($1, 1, private.price_most())$q$, current_setting('my.w')::uuid, null);
select k || '=' || v from said order by k;
rollback;
`);

const said = new Map<string, string>();
for (const line of out.split('\n')) {
  const i = line.indexOf('=');
  if (i > 0) said.set(line.slice(0, i), line.slice(i + 1));
}

const goods = [...said].filter(([k]) => k.startsWith('GOOD'));
const turned = goods.filter(([, v]) => v.includes('Bad request'));
check(`every shape the browser sends goes through its door (${goods.length} of them, ten doors)`,
  goods.length > 40 && turned.length === 0, turned.map(([, v]) => v).join(' / ') || `${goods.length} through`);
const doors = new Set(goods.map(([, v]) => v.split('|')[0]));
check('and they reach all ten doors', doors.size === 10, [...doors].join(', '));
refused.forEach(([door, , words], i) => {
  const got = said.get(`BAD${String(i).padStart(3, '0')}`) ?? '';
  check(`${door} refuses a bad shape in one line: "${words}"`, got === `22023 ${words}`, got);
});

const far: Record<string, string> = Object.fromEntries((said.get('FAR') ?? '').split(';').filter(Boolean).map((kv) => kv.split('=')));
const tooFar = 'You are too far away from that.';
for (const [a, why] of Object.entries(far)) {
  check(`${a} six tiles off is out of reach`, why === tooFar, why);
}
check('the nine set-down jobs were all asked', Object.keys(far).length === 9, Object.keys(far).join(', '));
check('a piece set down next to you is not refused for reach', said.get('NEAR') !== tooFar, said.get('NEAR'));
check('a crate next to you on a subtile of its tile is not refused for reach or spot',
  said.get('CRATE_NEAR') !== tooFar && said.get('CRATE_NEAR') !== 'Choose a spot.', said.get('CRATE_NEAR'));
check('a crate off its tile\'s four subtiles is refused', said.get('CRATE_SUB') === 'Choose a spot.', said.get('CRATE_SUB'));
check(`no job pointed at a tile reaches past ${said.get('MOST_LIT')} tiles, nor a pile picked up from 90 off`,
  said.get('MOST') === `${tooFar}|${tooFar}`, said.get('MOST'));
check(`the creatures are read ${said.get('READ_MOST')} tiles round you at most, whatever is asked`,
  said.get('READ') === 'Near', said.get('READ'));
check('an island founded with its spawn off it is refused', said.get('FOUND_OFF') === '22023 Bad request: rpc_found p_spawn: off the island.', said.get('FOUND_OFF'));
check('and with too long a name', said.get('FOUND_LONG') === '22023 Bad request: rpc_found p_name: too long.', said.get('FOUND_LONG'));
check('and one with its spawn on its last tile and the longest name is founded', said.get('FOUND_OK') === '', said.get('FOUND_OK'));
check('a deal asking less than nothing is refused', said.get('DEAL_LESS') === '22023 Bad request: rpc_deal p_want, p_give: out of range.', said.get('DEAL_LESS'));
check('and one offering past the most', said.get('DEAL_MORE') === '22023 Bad request: rpc_deal p_want, p_give: out of range.', said.get('DEAL_MORE'));
check('a price past the most is refused', said.get('PRICE_MORE') === '22023 Bad request: rpc_price p_silver: out of range.', said.get('PRICE_MORE'));
check('and an order at one', said.get('ORDER_MORE') === '22023 Bad request: rpc_order p_price: out of range.', said.get('ORDER_MORE'));
check('a price at the most is not', said.get('PRICE_OK') === '', said.get('PRICE_OK'));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nwhat a browser hands the island — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
