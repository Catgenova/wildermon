/**
 * A campfire, a smelter, a kiln and an anvil set down as a piece of furniture
 * is, and decaying off a settlement (`src/game/stations.ts`,
 * 20261120000065_stations_set_down_and_decay).
 *
 * Asked: "Campfires, smelters, etc should be placeable like furniture, instead
 * of having their own dedicated right click option that doesnt allow
 * alignment." and "Campfires and other utilities off deed should be able to
 * decay." Held to, on both sides:
 *
 *   * a station's block of spots turns with the way it faces, and is anchored
 *     in its tile the same way (`stationFootprint`, `stationAnchor`;
 *     `placed_size`, `perform_fire`);
 *   * a campfire, a smelter, a kiln and an anvil keep the way they were set
 *     down, at the spot asked;
 *   * refused where anything stands, a campfire too, and a smelter off a
 *     settlement of yours, in the browser's words;
 *   * off a settlement a station takes its item's damage an hour on the
 *     ground (a campfire its shafts'), the same number on both sides, charged
 *     by the world's round and gone at a hundred; on a settlement, none;
 *   * picked up, its damage to now goes into the pack.
 *
 * The island half runs in one transaction that is rolled back.
 */
import { Game } from '../../src/game/game';
import { ACTION_BY_ID } from '../../src/game/actions';
import { DEED_PLACE } from '../../src/game/furniture';
import { groundDecayRate } from '../../src/game/items';
import { STATIONS, STATION_KINDS, stationAnchor, stationDecayAt, stationFootprint, stationTurn } from '../../src/game/stations';
import { TileType } from '../../src/world/tiles';
import { psql, check, finish } from './harness';

/* ---- 1. the browser's side ---------------------------------------------------------------------- */

check('a smelter is 3 by 2 facing south or north, 2 by 3 facing east or west',
  stationFootprint('smelter', 's').join() === '3,2' && stationFootprint('smelter', 'n').join() === '3,2'
  && stationFootprint('smelter', 'e').join() === '2,3' && stationFootprint('smelter', 'w').join() === '2,3');
check('a campfire, a kiln and an anvil are 2 by 2 whichever way they face',
  (['campfire', 'kiln', 'anvil'] as const).every((k) => stationFootprint(k, 'e').join() === '2,2' && stationFootprint(k, 's').join() === '2,2'));
check('with the cursor on the last spot, a smelter is kept inside its tile, turned or not',
  stationAnchor('smelter', 3, 3, 's').join() === '1,2' && stationAnchor('smelter', 3, 3, 'e').join() === '2,1');
check('and the drawing turns a quarter (two eighths) a facing', [stationTurn('s'), stationTurn('e'), stationTurn('n'), stationTurn('w')].join() === '0,2,4,6');
check('every station is set down by the job it always had',
  STATION_KINDS.every((k) => !!ACTION_BY_ID.get(STATIONS[k].action)), STATION_KINDS.map((k) => STATIONS[k].action).join(','));

const g = Game.create(4242);
// Dry, level grass round the spot.
for (let y = 28; y <= 33; y++) for (let x = 28; x <= 33; x++) {
  g.world.setHeight(x, y, 8);
  g.world.setTile(x, y, TileType.Grass);
}
g.player.x = 30.5;
g.player.y = 30.5;
const fireDef = ACTION_BY_ID.get('build_campfire')!;
g.inventory.add('shaft', { count: 4, ql: 30 });
const fire = g.addCampfire(30, 30, 0, 0, 0, false, 'e');
const browserTaken = fireDef.check?.({ kind: 'tile', x: 30, y: 30, cx: 30, cy: 30, sx: 1, sy: 1, facing: 's' }, g) ?? null;
check('the browser refuses a campfire on a spot a campfire stands on', browserTaken === 'Something is already standing there.', String(browserTaken));
check('and keeps the way one was laid', fire.facing === 'e');

/* ---- 2. the island ------------------------------------------------------------------------------ */

const MIRA = 'f0e15a00-0000-4000-8000-00000000057a';
const TILE = (x: number, y: number, sx: number, sy: number, facing: string, item = 'null'): string =>
  `jsonb_build_object('kind', 'tile', 'x', ${x}, 'y', ${y}, 'cx', ${x}, 'cy', ${y}, 'sx', ${sx}, 'sy', ${sy}, 'facing', '${facing}', 'itemUid', ${item})`;
const at = (x: number, y: number): string => `update player set x = ${x + 0.5}, y = ${y + 0.5}, body_at = now(), level = 0 where world_id = w and uid = u;`;
const ask = (key: string, action: string, target: string): string =>
  `insert into said values ('${key}', coalesce(act_refusal(w, u, '${action}', ${target}), 'none'));`;
const act = (action: string, target: string): string => `perform act_perform(w, u, '${action}', ${target});`;
const row = (key: string, kind: string): string =>
  `insert into said select '${key}', concat_ws('|', sx, sy, facing) from placed where world_id = w and kind = '${kind}' order by id desc limit 1;`;
const item = (def: string, extra = 'null'): string =>
  `v_it := give(w, u, '${def}', 1, 50, ${extra});`;

const out = psql(`
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; v_it bigint; v_fire bigint; v_sm bigint; v_an bigint; v_n int; v_back bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Stationfield', 57, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player';
  update player set body_at = now(), swim_at = now(), equipped = '{}'::jsonb,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w;
  -- Mira's settlement: 6..18 each way.
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Home', 12, 12, 6, 1, u);
  perform deed_ranks_seed(w, u);
  insert into said values ('SIZE', array_to_string(placed_size('smelter', null, 'e'), ',') || '|' || array_to_string(placed_size('smelter', null, 's'), ','));

  -- 1. A campfire off the settlement, laid facing east at spot 1,1; another on its block refused, one beside it not.
  ${at(30, 30)}
  perform give(w, u, 'shaft', 4, 30, 'Pine');
  ${ask('FIRE:ask', 'build_campfire', TILE(30, 30, 0, 0, 'e'))}
  ${act('build_campfire', TILE(30, 30, 0, 0, 'e'))}
  ${row('FIRE:row', 'campfire')}
  select id into v_fire from placed where world_id = w and kind = 'campfire' order by id desc limit 1;
  ${ask('FIRE:taken', 'build_campfire', TILE(30, 30, 1, 1, 's'))}
  ${ask('FIRE:beside', 'build_campfire', TILE(30, 30, 2, 2, 's'))}

  -- 2. A smelter off the settlement refused; on it, facing east with the cursor on the last spot.
  ${at(30, 34)}
  ${item('smelter')}
  ${ask('SM:off', 'place_smelter', TILE(30, 34, 0, 0, 's', 'v_it'))}
  ${at(12, 12)}
  ${ask('SM:on', 'place_smelter', TILE(12, 12, 3, 3, 'e', 'v_it'))}
  ${act('place_smelter', TILE(12, 12, 3, 3, 'e', 'v_it'))}
  ${row('SM:row', 'smelter')}
  select id into v_sm from placed where world_id = w and kind = 'smelter' order by id desc limit 1;
  -- A second one beside it: across its block facing south refused, in the two spots left facing east allowed.
  ${item('smelter')}
  ${ask('SM:across', 'place_smelter', TILE(12, 12, 0, 0, 's', 'v_it'))}
  ${ask('SM:beside', 'place_smelter', TILE(12, 12, 0, 0, 'e', 'v_it'))}

  -- 3. A kiln and an anvil keep the way they were set down.
  ${at(30, 38)}
  ${item('kiln')}
  ${act('place_kiln', TILE(30, 38, 0, 0, 'n', 'v_it'))}
  ${row('KILN:row', 'kiln')}
  ${item('anvil', "'iron'")}
  ${ask('AN:ask', 'place_anvil', TILE(30, 38, 2, 2, 'w', 'v_it'))}
  ${act('place_anvil', TILE(30, 38, 2, 2, 'w', 'v_it'))}
  ${row('AN:row', 'anvil')}
  select id into v_an from placed where world_id = w and kind = 'anvil' order by id desc limit 1;
  ${item('anvil', "'iron'")}
  ${ask('AN:taken', 'place_anvil', TILE(30, 38, 2, 2, 's', 'v_it'))}

  -- 4. Decay: each rate an hour, off the settlement and on it.
  insert into said select 'RATE:' || pl.kind, station_decay_rate(pl)::text from placed pl
   where pl.world_id = w and pl.kind in ('campfire', 'kiln', 'anvil');
  insert into said select 'RATE:on', station_decay_rate(pl)::text from placed pl where pl.id = v_sm;
  insert into said select 'QL:' || pl.kind, pl.ql::text from placed pl where pl.world_id = w and pl.kind in ('campfire', 'kiln', 'anvil');
  -- Two hours on the clock for all of them, and the round.
  update placed set decay_at = now() - interval '2 hours' where world_id = w;
  v_n := station_sweep(w);
  insert into said values ('SWEEP', v_n::text);
  insert into said select 'DMG:' || pl.kind, pl.dmg::text from placed pl where pl.world_id = w;
  insert into said values ('QUIET', station_sweep(w)::text);
  -- The world's round charges them as well.
  insert into said values ('TICK', (position('station_sweep(w.id)' in pg_get_functiondef('world_tick()'::regprocedure)) > 0)::text);

  -- 5. Picked up, its damage to now goes into the pack.
  update placed set dmg = 10, decay_at = now() - interval '1 hour' where id = v_an;
  ${at(30, 38)}
  ${act('pick_up_anvil', "jsonb_build_object('kind', 'anvil', 'id', v_an)")}
  insert into said select 'PICKED', round(dmg::numeric, 3)::text
    from item where world_id = w and holder_uid = u and def = 'anvil' order by id desc limit 1;

  -- 6. Worn through off the settlement: gone, and on it never.
  update placed set dmg = 99.9, decay_at = now() - interval '2 hours' where id in (v_fire, v_sm);
  perform station_sweep(w);
  insert into said values ('GONE', (not exists (select 1 from placed where id = v_fire))::text || '|' || (exists (select 1 from placed where id = v_sm))::text);
end $t$;
select k || '=' || v from said order by k;
rollback;
`);
const island = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const said = (k: string): string => island.get(k) ?? 'MISSING';

check('the island turns a smelter\'s block the same way', said('SIZE') === '2,3|3,2', said('SIZE'));
check('a campfire laid off a settlement is allowed', said('FIRE:ask') === 'none', said('FIRE:ask'));
check('and lies at the spot asked, facing the way asked', said('FIRE:row') === '0|0|e', said('FIRE:row'));
check('another on its block is refused, in the browser\'s words', said('FIRE:taken') === browserTaken, said('FIRE:taken'));
check('and one beside it is allowed', said('FIRE:beside') === 'none', said('FIRE:beside'));
check('a smelter off a settlement of yours is refused, in the browser\'s words', said('SM:off') === DEED_PLACE, said('SM:off'));
check('on one it is allowed', said('SM:on') === 'none', said('SM:on'));
const [ax, ay] = stationAnchor('smelter', 3, 3, 'e');
check('and stands where the browser anchored it, facing east', said('SM:row') === `${ax}|${ay}|e`, `${said('SM:row')} against ${ax}|${ay}|e`);
check('a second smelter across its turned block is refused', said('SM:across') === 'Something is already standing there.', said('SM:across'));
check('and turned east into the two spots beside it, allowed', said('SM:beside') === 'none', said('SM:beside'));
check('a kiln keeps the way it was set down', said('KILN:row') === '0|0|n', said('KILN:row'));
check('an anvil is allowed and keeps the way it was set down', said('AN:ask') === 'none' && said('AN:row') === '2|2|w', `${said('AN:ask')}, ${said('AN:row')}`);
check('another anvil on its block is refused', said('AN:taken') === 'Something is already standing there.', said('AN:taken'));

for (const kind of ['campfire', 'kiln'] as const) {
  const ql = Number(said(`QL:${kind}`));
  const here = stationDecayAt(kind, ql);
  const isle = Number(said(`RATE:${kind}`));
  check(`${kind} off a settlement: ${here.toFixed(3)} damage an hour at QL ${ql}, the same on the island`, Math.abs(here - isle) < 1e-6 && here > 0, String(isle));
  const dmg = Number(said(`DMG:${kind}`));
  check(`and two hours of the round charge it two hours' worth`, Math.abs(dmg - 2 * here) < 0.01, `${dmg} against ${2 * here}`);
}
{
  const ql = Number(said('QL:anvil'));
  const here = groundDecayRate({ uid: 0, id: STATIONS.anvil.decaysAs, ql, dmg: 0, count: 1, extra: 'iron' });
  check(`an iron anvil off a settlement: ${here.toFixed(3)} an hour, the same on the island`, Math.abs(here - Number(said('RATE:anvil'))) < 1e-6, said('RATE:anvil'));
}
check('a campfire decays at its shafts\' rate', STATIONS.campfire.decaysAs === 'shaft');
check('on a settlement a station decays not at all', Number(said('RATE:on')) === 0 && Number(said('DMG:smelter')) === 0, `${said('RATE:on')}, ${said('DMG:smelter')}`);
check('a round charges every station due', Number(said('SWEEP')) === 4, said('SWEEP'));
check('and one charged a moment ago is left alone', said('QUIET') === '0', said('QUIET'));
check('the world\'s round sweeps the stations', said('TICK') === 'true', said('TICK'));
check('worn through off a settlement it is gone; on one it stands', said('GONE') === 'true|true', said('GONE'));
check('picked up, its damage to now goes into the pack', Number(said('PICKED')) > 10, said('PICKED'));

finish('a campfire, a smelter, a kiln and an anvil set down as furniture is, and decaying off a settlement');
