/**
 * A Vesp works its hive as bees work a skep, as its trade.
 *
 * Asked: "vesp should work beehives as their trade", and then "Implement that Vesp work hives like bees for their
 * deed trade, producing honey". This asks, of both sides:
 *
 *   * a Vesp's trade is its hive, and it can be set to work a deed;
 *   * where it goes (`vespTrip`, the island's `vesp_trip`): the nearest hive with room in its range, and of the tiles
 *     within `SKEP_REACH` of it in flower the next in its turn, the same tile on both sides turn by turn and a
 *     different one each turn; or why not, the same on both sides: no hive in range, `SKEP_IDLE`, no wildflowers in
 *     reach of its hive, every hive full;
 *   * what it brings: a skep's honey there for the trip (`vespHoney`, `vesp_honey`), and into the hive whole honey
 *     and a beeswax with every `SKEP_WAX_EVERY`th, the same on both sides put after put (`hiveTakes`, `vesp_put`);
 *   * its day on the island, step by step: out to the flower, a go there, back to the hive with honey in its arms
 *     and when it set off, and into the hive a skep's honey for the trip and the second after it; and over minutes
 *     of work, a skep's honey an hour there; and the same in the browser;
 *   * a Vesp following you fills no hive: the flat fill is gone on both sides;
 *   * with no hive in reach it says so, as any worker with no work does; and what it says, every number off the rule.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back. The island is held in
 * summer for its day (`season_at`), as the browser is by its wall clock, so it runs the same whatever day it is run on.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { CREATURE_ACTION_BY_ID } from '../../src/game/creatureActions';
import { deedJobLine } from '../../src/game/creaturecrate';
import { GATHER_DO, GATHER_SKILL, SPECIES, type Creature } from '../../src/game/creatures';
import {
  HOUR, SKEP_CLUMP_HOURS, SKEP_IDLE, SKEP_REACH, SKEP_WAX_EVERY, skepFlowers, skepRate, hiveTakes, VESP_REST, vespHoney, vespTrip, type VespTrip,
} from '../../src/game/bees';
import { furnitureCapacity, furnitureCentre, type PlacedFurniture } from '../../src/game/furniture';
import { ITEM_DEFS } from '../../src/game/items';
import { DAY_SECONDS } from '../../src/game/pace';
import { idleSays } from '../../src/game/workerlog';
import { SEASON_DAYS, SEASONS, YEAR_DAYS, YEAR_FROM, type Season } from '../../src/world/calendar';
import { TileType } from '../../src/world/tiles';

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
const near = (a: number, b: number, by = 1e-9): boolean => Math.abs(a - b) <= by;

/* ---- the browser's island, made first: where the flowers are ----------------------------------------------------- */

const SEED = 2718;
const SIZE = 64;
const g = Game.create(SEED, SIZE);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
for (const f of [...g.furniture.values()]) g.removeFurniture(f.id);
g.crates.clear();

/** A moment so many hours into a season of the island's second year, in epoch seconds. */
const SEASON = SEASON_DAYS * DAY_SECONDS;
const YEAR = YEAR_FROM + YEAR_DAYS * DAY_SECONDS;
const at = (season: Season, hours = 0): number => YEAR + SEASONS.indexOf(season) * SEASON + hours * HOUR;
const SUMMER = at('summer', 5);

// The tile in the interior whose reach is fullest in summer: where the hive stands.
let rich = { x: 0, y: 0, n: -1 };
for (let y = 12; y < SIZE - 12; y++) for (let x = 12; x < SIZE - 12; x++) {
  const n = skepFlowers(g, x, y, SUMMER);
  if (n > rich.n) rich = { x, y, n };
}
const R = { x: rich.x, y: rich.y };
const N_SU = rich.n;
/** The totem, three tiles west of the hive; the range its trips are asked at; the Vesp, at the hive. */
const TOK = { x: R.x - 3, y: R.y };
const RANGE = 8;
const hive = g.addFurniture('hive', R.x, R.y, 0, 0, 50);
const [HX, HY] = furnitureCentre(hive);
const CAP = furnitureCapacity(hive);
check(`the hive at ${R.x},${R.y} has ${N_SU} clumps within ${SKEP_REACH} tiles in summer`, N_SU > 0, String(N_SU));

const TURNS = 6;
const said = (t: VespTrip): string => ('hive' in t ? `${t.hive.x},${t.hive.y}>${t.x},${t.y}` : `${t.why}:${t.n}`);
const browserTrips = Array.from({ length: TURNS }, (_, k) => said(vespTrip(g, HX, HY, TOK.x, TOK.y, RANGE, k, SUMMER)));
const browserWhy = {
  season: said(vespTrip(g, HX, HY, TOK.x, TOK.y, RANGE, 0, at(SKEP_IDLE, 5))),
  autumn: said(vespTrip(g, HX, HY, TOK.x, TOK.y, RANGE, 0, at('autumn', 5))),
  range: said(vespTrip(g, HX, HY, TOK.x, TOK.y, 2, 0, SUMMER)),
};
hive.items.push({ uid: g.inventory.nextUid++, id: 'honey', ql: 50, dmg: 0, count: CAP });
const browserFull = said(vespTrip(g, HX, HY, TOK.x, TOK.y, RANGE, 0, SUMMER));
hive.items.splice(0);

/** What goes into a hive put after put, and what each makes. */
const PUTS = [0.6, 0.6, 3.3, 4.75, 0.2];
const browserPuts: string[] = [];
{
  const f = { ...hive, items: [], nectar: undefined, nectarQl: undefined, honeys: undefined } as PlacedFurniture;
  for (const [i, p] of PUTS.entries()) {
    const m = hiveTakes(f, p, 20 + 10 * i);
    if (m.honey) f.items.push({ uid: 0, id: 'honey', ql: m.ql, dmg: 0, count: m.honey });
    if (m.wax) f.items.push({ uid: 0, id: 'wax', ql: m.ql, dmg: 0, count: m.wax });
    browserPuts.push(`${m.honey}/${m.wax}/${(f.nectar ?? 0).toFixed(6)}/${(f.nectarQl ?? 0).toFixed(6)}`);
  }
}

/* ---- on the island --------------------------------------------------------------------------------------------- */

const MIRA = '7e5b0000-0000-4000-8000-0000000000a1';
const ts = (t: number): string => `to_timestamp(${t})`;
const reach: Array<[number, number]> = [];
for (let y = R.y - SKEP_REACH; y <= R.y + SKEP_REACH; y++) for (let x = R.x - SKEP_REACH; x <= R.x + SKEP_REACH; x++) reach.push([x, y]);
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; v_vesp int; v_hive bigint; v_h2 bigint; c creature; v_m int[];
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Hives', ${SEED}, ${SIZE}, ${TOK.x}, ${TOK.y}, true) returning id into w;
  perform land_blank(w, ${SIZE});
  ${reach.map(([x, y]) => `perform land_set_tile(w, ${x}, ${y}, tile_id('Grass'));`).join('\n  ')}
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set x = ${TOK.x + 0.5}, y = ${TOK.y + 0.5}, body_at = now(), swim_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Hivesend', ${TOK.x}, ${TOK.y}, 10, 3, u);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'hive', ${R.x}, ${R.y}, ${hive.sx}, ${hive.sy}, ${HX}, ${HY}, 50, u) returning id into v_hive;
  v_vesp := creature_spawn(w, 'vesp', ${HX}, ${HY}, 'active', now() - interval '30 days', u);
  update creature set hunger = 1, settled_at = now(), until = now(), leg_at = now(), leg_ends = now(), from_x = to_x, from_y = to_y,
         traits = '{}', rare = null, stance = 'passive', worn = 0
    where world_id = w and id = v_vesp;

  insert into said values ('TRADE', (select gathers from species_def where id = 'vesp'));
  insert into said values ('ASK', coalesce(act_refusal(w, u, 'assign_deed', jsonb_build_object('kind', 'creature', 'id', v_vesp)), 'none'));
  perform act_perform(w, u, 'assign_deed', jsonb_build_object('kind', 'creature', 'id', v_vesp));
  select * into c from creature where world_id = w and id = v_vesp;
  insert into said values ('MODE', c.mode);
  insert into said values ('LINE', deed_job_line(c));

  -- 1. Where it goes, turn by turn, and why not.
  insert into said select 'TRIP:' || g.k, coalesce(t.hx || ',' || t.hy || '>' || t.fx || ',' || t.fy, t.why || ':' || t.n)
    from generate_series(0, ${TURNS - 1}) g(k), vesp_trip(w, ${HX}, ${HY}, ${TOK.x}, ${TOK.y}, ${RANGE}, g.k, ${ts(SUMMER)}) t;
  insert into said select 'WHY:season', coalesce(t.hx || ',' || t.hy || '>' || t.fx || ',' || t.fy, t.why || ':' || t.n)
    from vesp_trip(w, ${HX}, ${HY}, ${TOK.x}, ${TOK.y}, ${RANGE}, 0, ${ts(at(SKEP_IDLE, 5))}) t;
  insert into said select 'WHY:autumn', coalesce(t.hx || ',' || t.hy || '>' || t.fx || ',' || t.fy, t.why || ':' || t.n)
    from vesp_trip(w, ${HX}, ${HY}, ${TOK.x}, ${TOK.y}, ${RANGE}, 0, ${ts(at('autumn', 5))}) t;
  insert into said select 'WHY:range', coalesce(t.hx || ',' || t.hy || '>' || t.fx || ',' || t.fy, t.why || ':' || t.n)
    from vesp_trip(w, ${HX}, ${HY}, ${TOK.x}, ${TOK.y}, 2, 0, ${ts(SUMMER)}) t;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_hive, 'honey', 50, ${CAP});
  insert into said select 'WHY:room', coalesce(t.hx || ',' || t.hy || '>' || t.fx || ',' || t.fy, t.why || ':' || t.n)
    from vesp_trip(w, ${HX}, ${HY}, ${TOK.x}, ${TOK.y}, ${RANGE}, 0, ${ts(SUMMER)}) t;
  delete from item where world_id = w and placed = v_hive;

  -- 2. What a trip brings, and what goes into a hive put after put.
  insert into said values ('HONEY', vesp_honey(${N_SU}, 'summer', 3600)::text || '|' || vesp_honey(${N_SU}, '${SKEP_IDLE}', 3600)::text
    || '|' || vesp_honey(${N_SU}, 'spring', 90)::text);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'hive', ${R.x + 20}, ${R.y}, ${hive.sx}, ${hive.sy}, ${HX + 20}, ${HY}, 50, u) returning id into v_h2;
  ${PUTS.map((p, i) => `v_m := vesp_put(w, v_h2, ${p}, ${20 + 10 * i});
  insert into said select 'PUT:${i}', v_m[1] || '/' || v_m[2] || '/' || to_char((p.state->>'nectar')::numeric, 'FM0.000000')
      || '/' || to_char((p.state->>'nectar_ql')::numeric, 'FM990.000000') from placed p where p.id = v_h2;`).join('\n  ')}
  insert into said select 'PUTS', string_agg(def || ':' || count, ',' order by def) from item where world_id = w and placed = v_h2;
  delete from item where world_id = w and placed = v_h2;
  delete from placed where id = v_h2;

  -- 3. Its day, held in summer: out to the flower, a go there, back, and into the hive. Each step's clock run out by hand.
  create or replace function season_at(p_at timestamptz default now()) returns text language sql stable as $f$ select 'summer' $f$;
  update creature set phase = 'idle', until = now() - interval '1 millisecond', worn = 0, ledger = null, carrying = null,
         from_x = ${HX}, from_y = ${HY}, to_x = ${HX}, to_y = ${HY}
    where world_id = w and id = v_vesp;
  perform worker_settle(w, v_vesp);
  select * into c from creature where world_id = w and id = v_vesp;
  insert into said values ('OUT', c.phase || '|' || c.work_x || ',' || c.work_y || '|' || (floor(c.to_x)::int) || ',' || (floor(c.to_y)::int)
    || '|' || (c.to_x - floor(c.to_x)) || ',' || (c.to_y - floor(c.to_y)) || '|' || coalesce(c.carrying::text, 'nothing'));
  update creature set until = now() - interval '1 millisecond' where world_id = w and id = v_vesp;
  perform worker_settle(w, v_vesp);
  select * into c from creature where world_id = w and id = v_vesp;
  insert into said values ('WORK', c.phase || '|' || round(sqrt((c.to_x - c.from_x) ^ 2 + (c.to_y - c.from_y) ^ 2)::numeric, 3));
  update creature set until = now() - interval '1 millisecond' where world_id = w and id = v_vesp;
  perform worker_settle(w, v_vesp);
  select * into c from creature where world_id = w and id = v_vesp;
  insert into said values ('HOME', c.phase || '|' || c.to_x || ',' || c.to_y || '|' || coalesce(c.carrying->>'def', '-') || '|'
    || coalesce(c.carrying->>'count', '-') || '|' || coalesce(c.carrying->>'ql', '-') || '|' || coalesce((c.ledger->'now'->>'goes'), '0'));
  insert into said values ('SINCE', (c.carrying->>'since'));
  update creature set until = now() - interval '1 millisecond' where world_id = w and id = v_vesp;
  insert into said values ('PUTAT', extract(epoch from (select until from creature where world_id = w and id = v_vesp))::text);
  perform worker_settle(w, v_vesp);
  select * into c from creature where world_id = w and id = v_vesp;
  insert into said values ('PUT', c.phase || '|' || coalesce(c.carrying::text, 'nothing') || '|'
    || (select coalesce(state->>'nectar', '-') from placed where id = v_hive) || '|'
    || (select count(*) from item where world_id = w and placed = v_hive));
  insert into said values ('RESTAT', extract(epoch from c.until)::text);
  -- And the next trip, its next turn: the second tile.
  insert into said values ('NEXT', c.phase || '|' || (floor(c.to_x)::int) || ',' || (floor(c.to_y)::int));

  -- 4. Minutes of it, held in summer: a skep's honey an hour.
  update placed set state = '{}'::jsonb where id = v_hive;
  delete from item where world_id = w and placed = v_hive;
  update creature set phase = 'idle', until = now() - interval '120 seconds', worn = 0, ledger = null, carrying = null,
         from_x = ${HX}, from_y = ${HY}, to_x = ${HX}, to_y = ${HY}, idle_why = null, idle_n = null
    where world_id = w and id = v_vesp;
  perform worker_settle(w, v_vesp);
  select * into c from creature where world_id = w and id = v_vesp;
  -- Caught at a flower: its go run out, so that when it set off rides in its arms.
  if c.phase = 'work' then
    update creature set until = now() - interval '1 millisecond' where world_id = w and id = v_vesp;
    perform worker_settle(w, v_vesp);
    select * into c from creature where world_id = w and id = v_vesp;
  end if;
  insert into said values ('RUN', c.phase || '|' || coalesce(c.carrying->>'since', '-') || '|' || extract(epoch from c.leg_at) || '|'
    || coalesce((select state->>'nectar' from placed where id = v_hive), '0') || '|'
    || coalesce((select sum(count) from item where world_id = w and placed = v_hive and def = 'honey'), 0) || '|'
    || coalesce((c.ledger->'now'->>'goes'), '0') || '|' || extract(epoch from now()) || '|' || extract(epoch from c.until));

  -- 5. A Vesp following you fills no hive: the flat fill is gone.
  insert into said values ('SWEEP', coalesce(to_regproc('hive_sweep')::text, 'gone'));

  -- 6. With no hive in reach, an hour of standing about, and it says so.
  delete from item where world_id = w and placed = v_hive;
  delete from placed where id = v_hive;
  delete from event where world_id = w and uid = u;
  update creature set until = now() - interval '5 seconds', settled_at = now() - interval '5 seconds', phase = 'idle',
         work_x = null, work_y = null, idle_since = now() - interval '2 hours', told_at = null, carrying = null
    where world_id = w and id = v_vesp;
  perform worker_settle(w, v_vesp);
  insert into said select 'IDLE', coalesce(string_agg(text, ' / '), 'nothing') from event where world_id = w and uid = u and kind = 'error';
  insert into said select 'IDLEWHY', idle_why || ':' || idle_n from creature where world_id = w and id = v_vesp;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const say = (k: string): string => isle.get(k) ?? '(not said)';

check('on the island, a Vesp\'s trade is its hive', say('TRADE') === 'hive', say('TRADE'));
check('so it can be set to work the deed', say('ASK') === 'none' && say('MODE') === 'deed', `${say('ASK')} / ${say('MODE')}`);

/* ---- where it goes ---------------------------------------------------------------------------------------------- */

const islandTrips = Array.from({ length: TURNS }, (_, k) => say(`TRIP:${k}`));
check(`turn by turn, the same hive and the same flower on both sides (${TURNS} turns)`, islandTrips.join(' ') === browserTrips.join(' '),
  `${islandTrips.join(' ')} / ${browserTrips.join(' ')}`);
const tiles = browserTrips.map((s) => s.split('>')[1]);
check(`each a tile in flower within ${SKEP_REACH} tiles of the hive`, browserTrips.every((s) => s.startsWith(`${R.x},${R.y}>`)) && tiles.every((t) => {
  const [x, y] = t.split(',').map(Number);
  return Math.max(Math.abs(x - R.x), Math.abs(y - R.y)) <= SKEP_REACH && skepFlowers(g, x, y, SUMMER) > 0;
}), tiles.join(' '));
check('and a different one each turn while there are more', new Set(tiles).size === Math.min(TURNS, tiles.length), tiles.join(' '));
check(`in ${SKEP_IDLE}: nothing, on both sides`, say('WHY:season') === 'season:0' && browserWhy.season === 'season:0', `${say('WHY:season')} / ${browserWhy.season}`);
check(`with nothing in flower (autumn): no wildflowers within ${SKEP_REACH} tiles of its hive`, say('WHY:autumn') === `flowers:${SKEP_REACH}` && browserWhy.autumn === `flowers:${SKEP_REACH}`,
  `${say('WHY:autumn')} / ${browserWhy.autumn}`);
check('with no hive in its range: none', say('WHY:range') === 'range:2' && browserWhy.range === 'range:2', `${say('WHY:range')} / ${browserWhy.range}`);
check(`with its hive full (${CAP}): no room`, say('WHY:room') === 'room:0' && browserFull === 'room:0', `${say('WHY:room')} / ${browserFull}`);
const next = SEASONS[(SEASONS.indexOf(SKEP_IDLE) + 1) % SEASONS.length];
check('and what each says, every number off the rule',
  idleSays({ why: 'season', n: 0 }, 'hive') === `Idle: ${SKEP_IDLE}, no honey until ${next}.`
  && idleSays({ why: 'flowers', n: SKEP_REACH }, 'hive') === `Idle: no wildflowers within ${SKEP_REACH} tiles of its hive.`
  && idleSays({ why: 'room', n: 0 }, 'hive') === 'Idle: no hive on the settlement has room for honey.'
  && idleSays({ why: 'range', n: 2 }, 'hive') === 'Idle: no hive to tend within 2 tiles of the totem.',
  [idleSays({ why: 'season', n: 0 }, 'hive'), idleSays({ why: 'flowers', n: SKEP_REACH }, 'hive'), idleSays({ why: 'room', n: 0 }, 'hive')].join(' / '));

/* ---- what it brings ------------------------------------------------------------------------------------------- */

const [hSu, hIdle, hSp] = say('HONEY').split('|').map(Number);
check(`a trip's honey is a skep's there: ${skepRate(N_SU, 'summer')} an hour off ${N_SU} clumps in summer, none in ${SKEP_IDLE}`,
  near(hSu, vespHoney(N_SU, 'summer', HOUR)) && near(hSu, skepRate(N_SU, 'summer')) && hIdle === 0 && near(hSp, vespHoney(N_SU, 'spring', 90)), say('HONEY'));
const islandPuts = PUTS.map((_, i) => say(`PUT:${i}`));
check(`into a hive put after put, the same honey, beeswax (1 per ${SKEP_WAX_EVERY} honey), part honey and its quality on both sides`,
  islandPuts.join(' ') === browserPuts.join(' '), `${islandPuts.join(' ')} / ${browserPuts.join(' ')}`);
const total = PUTS.reduce((a, b) => a + b, 0);
check(`${total} honey put in: ${Math.floor(total)} honey and ${Math.floor(Math.floor(total) / SKEP_WAX_EVERY)} beeswax`,
  say('PUTS') === `honey:${Math.floor(total)},wax:${Math.floor(Math.floor(total) / SKEP_WAX_EVERY)}`, say('PUTS'));

/* ---- its day on the island ------------------------------------------------------------------------------------ */

const [outPhase, outWork, outTile, outIn, outArms] = say('OUT').split('|');
check('set off: out to the first flower of its turn, its hive its work, nothing in its arms',
  outPhase === 'out' && outWork === `${R.x},${R.y}` && outTile === browserTrips[0].split('>')[1] && outIn === '0.5,0.5' && outArms === 'nothing', say('OUT'));
check('there, a go at the flower', say('WORK').startsWith('work|'), say('WORK'));
const [homePhase, homeTo, homeDef, homeCount, homeQl, homeGoes] = say('HOME').split('|');
check('the go done: back to the hive with honey in its arms, at the quality of its skill, a go on its ledger',
  homePhase === 'home' && homeTo === `${HX},${HY}` && homeDef === 'honey' && homeCount === '0' && Number(homeQl) >= 1 && homeGoes === '1', say('HOME'));
const since = Number(say('SINCE'));
const putAt = Number(say('PUTAT'));
const [putPhase, putArms, putNectar] = say('PUT').split('|');
const want = vespHoney(N_SU, 'summer', putAt - since + VESP_REST);
check(`at the hive: a skep's honey for the trip and the ${VESP_REST} s after (${(putAt - since).toFixed(3)} s): ${want.toFixed(6)}`,
  putPhase === 'idle' && putArms === 'nothing' && near(Number(putNectar), want, 1e-9), `${say('PUT')} / ${want}`);
check(`and it sets off again ${VESP_REST} s after`, near(Number(say('RESTAT')) - putAt, VESP_REST, 1e-3), `${Number(say('RESTAT')) - putAt}`);
const [runPhase, runSince, runLeg, runNectar, runHoney, runGoes, runNow, runUntil] = say('RUN').split('|');
{
  // From when it first set off to when it set off on the trip it is on now (or sets off next): every round's honey, back to back.
  const setOff = runPhase === 'home' ? Number(runSince) : runPhase === 'out' ? Number(runLeg) : runPhase === 'idle' ? Number(runUntil) : NaN;
  const made = Number(runNectar) + Number(runHoney);
  const start = Number(runNow) - 120;
  const rate = skepRate(N_SU, 'summer');
  const wantRun = (rate * (setOff - start)) / HOUR;
  check(`over two minutes of trips (${runGoes}), a skep's honey there: ${rate} an hour`, Number(runGoes) >= 2 && near(made, wantRun, 1e-6), `${say('RUN')} / ${wantRun}`);
}

/* ---- the flat fill gone; no hive in reach -------------------------------------------------------------------- */

check('a Vesp following you fills no hive: the flat fill is gone on the island', say('SWEEP') === 'gone', say('SWEEP'));
check('with no hive in reach, it says so', / idle: no hive to tend within /.test(say('IDLE')) && say('IDLEWHY').startsWith('range:'), `${say('IDLE')} / ${say('IDLEWHY')}`);

/* ---- in the browser ---------------------------------------------------------------------------------------------- */

check('in the browser, a Vesp\'s trade is its hive', SPECIES.vesp.gathers === 'hive' && GATHER_SKILL.hive === 'animal_husbandry');
g.wallClock = () => SUMMER;
g.deed = { name: 'Hivesend', x: TOK.x, y: TOK.y, radius: 10, level: 3, mine: true };
g.rand = () => 0.5;
const cr = g.creatures as unknown as Record<string, (...a: unknown[]) => unknown>;
/** A step of the clock, a power of two so that the clock lands on a second after the hive exactly. */
const DT = 1 / 16;
const step = (c: Creature, dt: number): void => {
  g.time += dt;
  cr.updateWorker.call(g.creatures, c, dt, g);
};
const v = g.creatures.spawn('vesp', HX, HY, 'deed', g.rand, g.time - 3600 * 24 * 30);
v.traits = [];
v.rare = 0;
v.hunger = 1;
v.stance = 'passive';
v.until = g.time - 1;
{
  step(v, DT);
  check('set off: out to the same first flower as on the island, its hive its work',
    v.state === 'toForage' && `${Math.floor(v.tx)},${Math.floor(v.ty)}` === browserTrips[0].split('>')[1] && v.workX === R.x && v.workY === R.y,
    `${v.state} ${v.tx},${v.ty}`);
  const off = v.tripAt ?? NaN;
  let guard = 0;
  while (v.state !== 'forage' && guard++ < 2000) step(v, DT);
  check('there, a go at the flower', v.state === 'forage', v.state);
  while (!v.carrying && guard++ < 4000) step(v, DT);
  check('the go done: honey in its arms for the hive, a go on its ledger', v.carrying?.id === 'honey' && v.carrying.count === 0 && v.ledger?.now.goes === 1,
    `${v.carrying?.id} ${v.ledger?.now.goes}`);
  while (v.carrying && guard++ < 6000) step(v, DT);
  const putTime = g.time;
  const wantB = vespHoney(N_SU, 'summer', putTime - off + VESP_REST);
  check(`at the hive: a skep's honey for the trip and the ${VESP_REST} s after (${(putTime - off).toFixed(2)} s)`,
    near(hive.nectar ?? 0, wantB, 1e-9) && v.state === 'idle' && near(v.until - putTime, VESP_REST, 1e-9), `${hive.nectar} / ${wantB}`);
  // Twenty trips more of it, short of tiring: a skep's honey there, round after round.
  hive.nectar = 0;
  hive.items.splice(0);
  v.worn = 0;
  while (g.time < v.until) step(v, DT);
  const start = v.tripAt ?? NaN;
  const goes = v.ledger?.now.goes ?? 0;
  while ((v.ledger?.now.goes ?? 0) < goes + 20 && guard++ < 200000) step(v, DT);
  while (v.carrying && guard++ < 200000) step(v, DT);
  while (g.time < v.until && guard++ < 200000) step(v, DT);
  const honey = (hive.nectar ?? 0) + hive.items.filter((i) => i.id === 'honey').reduce((n, i) => n + i.count, 0);
  const setOff = v.tripAt ?? NaN;
  const wantRun = (skepRate(N_SU, 'summer') * (setOff - start)) / HOUR;
  check(`over twenty trips (${(setOff - start).toFixed(0)} s), a skep's honey there: ${skepRate(N_SU, 'summer')} an hour`,
    near(honey, wantRun, 1e-6) && v.state === 'toForage', `${honey} / ${wantRun}, ${v.state}`);
}
{
  // A Vesp following you on the settlement: the hive as it was.
  hive.nectar = 0;
  hive.items.splice(0);
  const f = g.creatures.spawn('vesp', HX + 1, HY, 'active', g.rand, g.time - 3600 * 24 * 30);
  for (let i = 0; i < 100; i++) (g as unknown as { runPlaceables(dt: number): void }).runPlaceables(1);
  check('a Vesp following you fills no hive in the browser either', hive.items.length === 0 && (hive.nectar ?? 0) === 0, String(hive.items.length));
  g.creatures.remove(f.id);
}

/* ---- the words ------------------------------------------------------------------------------------------------- */

// The reach is each creature's own (its skill and its blood), so the words are compared and not the number.
const words = (s: string): string => s.replace(/\d+/g, 'N');
check('it says what it will do in the island\'s words, with nothing about the crate',
  words(deedJobLine(v)) === words(say('LINE')) && words(say('LINE')) === `${GATHER_DO.hive} within N tiles of the totem` && !/crate/.test(say('LINE')),
  `${deedJobLine(v)} / ${say('LINE')}`);
check('its description says the rule, every number off it',
  SPECIES.vesp.description.includes(`within ${SKEP_REACH} tiles of the hive`) && SPECIES.vesp.description.includes(`a honey per ${SKEP_CLUMP_HOURS} hours worked`)
  && SPECIES.vesp.description.includes(`a beeswax per ${SKEP_WAX_EVERY} honey`) && SPECIES.vesp.description.includes(`none in ${SKEP_IDLE}`)
  && !/\{/.test(SPECIES.vesp.description), SPECIES.vesp.description);
check('and the hive\'s', (ITEM_DEFS.hive.description ?? '').includes(`a honey per ${SKEP_CLUMP_HOURS} hours worked per wildflower clump within ${SKEP_REACH} tiles`)
  && !/\{/.test(ITEM_DEFS.hive.description ?? ''), ITEM_DEFS.hive.description);
const assign = CREATURE_ACTION_BY_ID.get('assign_deed');
v.mode = 'active';
const why = assign?.check?.({ kind: 'creature', id: v.id }, g) ?? 'none';
check('it is no longer refused for having no trade', !/no trade/.test(why), why);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na Vesp works its hive as bees work a skep — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
