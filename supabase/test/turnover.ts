/**
 * A wild thing goes after its span, and what comes out in its place is the mix the weights ask for now.
 *
 * Asked: "I havent seen a single one of the new 60 wildermon. Are they populated on the island?" Fifty-two of them had
 * not one wild head: a stretch of country was put out once and only ever topped up for what was killed, so the island
 * stayed the mix it was the day it was first walked. This asks, of both sides, that:
 *
 *   * the span is the same number (`WILD_STAY`, `wild_stay()`) and each one's own share of it is the same to the bit
 *     (`wildStayOf`, `wild_stay_of`);
 *   * at its stretch's stocking an old wild one that has nothing to do with anybody goes, and one just past its own
 *     span goes while one just short of it stays; a young one, a tamed one, one fighting, one being fought, one in a
 *     trap, a monster, one under a mark, one being coaxed and one somebody is acting on all stay; a mark run out on
 *     the one that went goes with it; and the stocking tops the stretch back up with new ones;
 *   * the one-off sweep (`wild_turnover` with `p_any`) takes every such one whatever its age, leaves the rest, and the
 *     stretch owed its stocking at once is full again on the next pass;
 *   * stocked over and over, a stretch comes out as every kind its ground suits, near its weight, the newest included;
 *   * and in the browser the streamer takes the same old one off and leaves the same others, putting it back on the
 *     books so that what comes out in its place is rolled afresh.
 *
 * The island half runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { BLOW_MEMORY, COAX_LAPSE, OLD_AT, SPECIES, WILD_SPECIES, WILD_STAY, wildStayOf } from '../../src/game/creatures';
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

/* ---- the span ----------------------------------------------------------------------- */

const IDS = [1, 2, 3, 7, 50, 333, 4096, 123457];
check(`the span is ${WILD_STAY / 3600} hours on both sides`, psql('select wild_stay()') === String(WILD_STAY), psql('select wild_stay()'));
check('and each one\'s own span, by its id, is the same to the bit on both',
  psql(`select string_agg(wild_stay_of(i)::text, ',' order by o) from unnest(array[${IDS.join(',')}]) with ordinality as t(i, o)`)
    === IDS.map((i) => String(wildStayOf(i))).join(','),
  psql(`select string_agg(wild_stay_of(i)::text, ',' order by o) from unnest(array[${IDS.join(',')}]) with ordinality as t(i, o)`));
const spans = Array.from({ length: 1000 }, (_, i) => wildStayOf(i + 1));
check(`between once and twice the span, spread across it: ${Math.round(Math.min(...spans) / 3600)} to ${Math.round(Math.max(...spans) / 3600)} hours`,
  Math.min(...spans) >= WILD_STAY && Math.max(...spans) < 2 * WILD_STAY
    && spans.filter((s) => s < 1.5 * WILD_STAY).length > 450 && spans.filter((s) => s < 1.5 * WILD_STAY).length < 550);
check('and no shorter than the furthest back either side dates a new one\'s birth, so nothing new is gone on the next pass',
  WILD_STAY >= OLD_AT * 1.6 && WILD_STAY >= 6 * 3600 * 1.6, `${WILD_STAY} against ${OLD_AT * 1.6} and ${6 * 3600 * 1.6}`);

/* ---- on the island -------------------------------------------------------------------- */

const MIRA = '7e5b0000-0000-4000-8000-0000000000fa';
const ROLLS = 15;
const out = psql(`
discard temp;
begin;
-- The stocking's rolls are the island's random(), seeded so every run puts out the same heads. Unseeded, one pass over
-- a plain of grass put out anywhere from a third to all of what the stretch was owed (it gives up at twelve tries a
-- head), so the half asked of it below failed about one run in four (live run 1389).
select setseed(0.5);
create temp table said (k text, v text);
create temp table seen (species text);
do $t$
declare w uuid; u uuid := '${MIRA}'; v_old int; v_young int; v_out int; v_in int; v_tame int; v_fight int; v_fought int;
        v_trap int; v_monster int; v_marked int; v_coaxed int; v_acted int; v_top int; i int; x int; y int;
        v_stays int[];
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Turnover', 181, 64, 32, 32, true) returning id into w;
  perform land_blank(w, 64);
  for x in 0 .. 64 loop for y in 0 .. 64 loop perform land_set_height(w, x, y, 20); end loop; end loop;
  perform land_set_tile(w, gx, gy, tile_id('Grass')) from generate_series(0, 63) gx, generate_series(0, 63) gy;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set x = 2.5, y = 2.5, body_at = now(), swim_at = now() where world_id = w and uid = u;
  update deed set x = -100000, y = -100000 where world_id = w;

  -- Every one old enough to go but for what holds it, and three that are about their span.
  v_old := creature_spawn(w, 'ulva', 30.5, 30.5, 'wild', now() - interval '3 days', null);
  v_young := creature_spawn(w, 'ulva', 31.5, 30.5, 'wild', now() - interval '1 hour', null);
  v_out := creature_spawn(w, 'ulva', 32.5, 30.5, 'wild', now(), null);
  update creature set born = now() - make_interval(secs => wild_stay_of(v_out) + 120) where world_id = w and id = v_out;
  v_in := creature_spawn(w, 'ulva', 33.5, 30.5, 'wild', now(), null);
  update creature set born = now() - make_interval(secs => wild_stay_of(v_in) - 120) where world_id = w and id = v_in;
  v_tame := creature_spawn(w, 'ulva', 34.5, 30.5, 'deed', now() - interval '3 days', u);
  v_fight := creature_spawn(w, 'ulva', 35.5, 30.5, 'wild', now() - interval '3 days', null);
  update creature set enemy = v_tame, brawl = v_tame where world_id = w and id = v_fight;
  v_fought := creature_spawn(w, 'ulva', 36.5, 30.5, 'wild', now() - interval '3 days', null);
  update creature set enemy = v_fought where world_id = w and id = v_tame;
  v_trap := creature_spawn(w, 'ulva', 37.5, 30.5, 'wild', now() - interval '3 days', null);
  update creature set trapped = 424242 where world_id = w and id = v_trap;
  v_monster := creature_spawn(w, 'goblin', 38.5, 30.5, 'wild', now() - interval '3 days', null);
  v_marked := creature_spawn(w, 'ulva', 39.5, 30.5, 'wild', now() - interval '3 days', null);
  insert into class_mark (world_id, creature_id, kind, val, until) values (w, v_marked, 'root', 1, now() + interval '1 minute');
  v_coaxed := creature_spawn(w, 'ulva', 40.5, 30.5, 'wild', now() - interval '3 days', null);
  update creature set coaxed = 2, coaxed_at = now() where world_id = w and id = v_coaxed;
  v_acted := creature_spawn(w, 'ulva', 41.5, 30.5, 'wild', now() - interval '3 days', null);
  update player set act = 'tame', act_target = jsonb_build_object('kind', 'creature', 'id', v_acted), act_ends = now() + interval '1 minute'
   where world_id = w and uid = u;
  -- A mark run out on the old one, which goes with it.
  insert into class_mark (world_id, creature_id, kind, val, until) values (w, v_old, 'root', 1, now() - interval '1 hour');
  v_stays := array[v_young, v_in, v_tame, v_fight, v_fought, v_trap, v_monster, v_marked, v_coaxed, v_acted];
  insert into said values ('IDS', v_old || '|' || v_out || '|' || array_to_string(v_stays, ','));
  select max(id) into v_top from creature where world_id = w;

  -- Its stretch stocked, seeded again here: the seed above has been drawn on by the join and the spawns, by as many
  -- calls as the database left behind them makes, so the stocking saw a different roll in the suite (43 of 87 owed,
  -- push runs 1414 and 1444) than on its own (87).
  perform setseed(0.5);
  perform creature_stock_block(w, 0, 0);
  insert into said select 'GONE', string_agg(q.n::text, ',' order by q.n) from unnest(array[v_old, v_out] || v_stays) q(n)
    where not exists (select 1 from creature c where c.world_id = w and c.id = q.n);
  insert into said select 'OLDMARK', count(*)::text from class_mark where world_id = w and creature_id = v_old;
  insert into said select 'TOPPED', count(*) filter (where id > v_top) || '|' || count(*) || '|' || greatest(wild_floor(), 4)
    from creature where world_id = w and mode = 'wild';
  insert into said select 'FRESH', bool_and(born > now() - make_interval(secs => 6 * 3600 * 1.6 + 60))::text
    from creature where world_id = w and mode = 'wild' and id > v_top;
  -- Straight after, nothing more goes: the new ones are inside their span.
  update world_stocked set at = now() - make_interval(secs => restock_every() + 1) where world_id = w;
  insert into said select 'AGAIN', wild_turnover(w, 0, 0, 64, 64)::text;

  -- The sweep: every one that has nothing to do with anybody, whatever its age.
  insert into said select 'SWEPT', wild_turnover(w, 0, 0, 64, 64, true)::text;
  insert into said select 'LEFT', string_agg(c.id::text, ',' order by c.id) from creature c join species_def s on s.id = c.species
   where c.world_id = w and c.mode = 'wild' and not coalesce(s.monster, false);
  insert into said select 'HELD', string_agg(q.n::text, ',' order by q.n) from unnest(v_stays) q(n)
    where q.n <> v_young and q.n <> v_in and exists (select 1 from creature c where c.world_id = w and c.id = q.n);
  update world_stocked set at = '-infinity' where world_id = w;
  insert into said values ('DUE', stock_due(w, 0, 0)::text);
  select max(id) into v_top from creature where world_id = w;
  perform creature_stock_block(w, 0, 0);
  insert into said select 'REFILLED', count(*) filter (where id > v_top) || '|' || count(*) from creature where world_id = w and mode = 'wild';

  -- Stocked over and over: what comes out.
  for i in 1 .. ${ROLLS} loop
    delete from creature where world_id = w and mode = 'wild' and trapped is null and enemy is null and id <> all(v_stays);
    update world_stocked set at = '-infinity' where world_id = w;
    perform creature_stock_block(w, 0, 0);
    insert into seen select species from creature where world_id = w and mode = 'wild' and id <> all(v_stays);
  end loop;
  insert into said select 'SUITS', string_agg(species || ':' || weight, ',') from wild_table t
    where not t.monster and suits(w, t.species, 20, 20);
end $t$;
insert into said select 'SEEN', species || ':' || count(*) from seen group by species;
select k || '=' || v from said;
rollback;
`);
const lines = out.split('\n').filter((l) => l.includes('='));
const said = (k: string): string[] => lines.filter((l) => l.startsWith(`${k}=`)).map((l) => l.slice(k.length + 1));
const at = (k: string): string => said(k)[0] ?? '';

const [oldId, outId, staysList] = at('IDS').split('|');
const stays = staysList.split(',');
check('at its stretch\'s stocking the old one with nothing to do with anybody goes, and so does one just past its own span; '
  + 'a young one, one just short of its span, a tamed one, one fighting, one being fought, one in a trap, a monster, one under a mark, '
  + 'one being coaxed and one somebody is acting on all stay',
  at('GONE') === [oldId, outId].sort((a, b) => Number(a) - Number(b)).join(','), `gone: ${at('GONE')}; ids ${at('IDS')}`);
check('and a mark run out on the one that went goes with it', at('OLDMARK') === '0', at('OLDMARK'));
const [made, wild, want] = at('TOPPED').split('|').map(Number);
/*
 * Topped up as any stocking tops up: rolls the ground does not suit cost it throws, and it gives up at twelve a head,
 * so on a plain of grass it puts out most of what it is owed rather than all of it, and more by night than by day.
 */
const stillWild = stays.length - 1;
check(`and the stocking tops the stretch back up with new ones: ${made} new for the ${want - stillWild} it was owed, ${wild} wild of the ${want} it holds`,
  made >= (want - stillWild) / 2 && wild <= want, at('TOPPED'));
check('the new ones born no further back than a stocking dates them', at('FRESH') === 'true', at('FRESH'));
check('and straight after, nothing more goes: the new ones are inside their span', at('AGAIN') === '0', at('AGAIN'));
const left = at('LEFT').split(',');
const heldWild = stays.slice(2).filter((id) => id !== stays[2] && id !== stays[6]);
check(`the sweep takes every wild one with nothing to do with anybody whatever its age, the young one and the new ones with them: ${at('SWEPT')} went`,
  Number(at('SWEPT')) > 0 && [...left].sort().join(',') === [...heldWild].sort().join(','), `left ${at('LEFT')}, held ${heldWild.join(',')}`);
check('and leaves every one something holds, and the monster', at('HELD') === stays.slice(2).sort((a, b) => Number(a) - Number(b)).join(','),
  `${at('HELD')} of ${stays.slice(2).join(',')}`);
const [refilled, refilledAll] = at('REFILLED').split('|').map(Number);
check(`and the stretch owed its stocking at once is stocked again on the next pass: ${refilled} new, ${refilledAll} wild of the ${want} it holds`,
  at('DUE') === 'true' && refilled >= (want - heldWild.length - 1) / 2 && refilledAll <= want, `${at('DUE')} ${at('REFILLED')}`);

// What came out, against the weights of the kinds the ground suits.
const suitW = new Map(at('SUITS').split(',').filter(Boolean).map((s) => { const [k, v] = s.split(':'); return [k, Number(v)] as [string, number]; }));
const got = new Map(said('SEEN').map((s) => { const [k, v] = s.split(':'); return [k, Number(v)] as [string, number]; }));
const rolls = [...got.entries()].filter(([k]) => suitW.has(k)).reduce((n, [, v]) => n + v, 0);
const sumW = [...suitW.values()].reduce((a, b) => a + b, 0);
const expected = [...suitW.entries()].map(([k, wgt]) => [k, (rolls * wgt) / sumW] as [string, number]);
const likely = expected.filter(([, e]) => e >= 8);
const missing = likely.filter(([k]) => !got.has(k)).map(([k]) => k);
check(`stocked ${ROLLS} times, every kind plain grass suits that ${rolls} rolls should show 8 or more of comes out (${likely.length - missing.length} of ${likely.length}); `
  + `${[...got.keys()].filter((k) => suitW.has(k)).length} of the ${suitW.size} kinds it suits came out at all`,
  likely.length >= 10 && missing.length === 0, missing.join(','));
const far = expected.filter(([, e]) => e >= 30).filter(([k, e]) => Math.abs((got.get(k) ?? 0) - e) > 4 * Math.sqrt(e) + 3);
check('and each near its weight', far.length === 0, far.map(([k, e]) => `${k} ${got.get(k) ?? 0} for ${e.toFixed(1)}`).join(', '));
// The kinds put in last: the end of the table, which is where a kind is added.
const NEWEST = WILD_SPECIES.slice(-20).map(([k]) => k).filter((k) => suitW.has(k));
const newSeen = NEWEST.filter((k) => got.has(k));
check(`and the newest kinds among them: ${newSeen.length} of the ${NEWEST.length} of the last twenty in the table that grass suits (${newSeen.map((k) => SPECIES[k].name).join(', ')})`,
  NEWEST.length === 0 || newSeen.length >= Math.ceil(NEWEST.length / 2), NEWEST.filter((k) => !got.has(k)).join(','));

/* ---- in the browser --------------------------------------------------------------------- */

const g = Game.create(4257);
for (let y = 10; y <= 40; y++) for (let x = 10; x <= 40; x++) { g.world.setHeight(x, y, 4); g.world.setDirt(x, y, 3); }
for (let y = 10; y <= 39; y++) for (let x = 10; x <= 39; x++) g.world.setTile(x, y, TileType.Grass, 0);
g.player.x = 15.5;
g.player.y = 20.5;
g.deed = null;
for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
g.time = Math.max(g.time, 10 * WILD_STAY);
const DAYS3 = g.time - 3 * 24 * 3600;
const put = (id: string, dx: number, mode: 'wild' | 'deed' = 'wild', born = DAYS3) =>
  g.creatures.spawn(id, g.player.x + dx, g.player.y + 2, mode, g.rand, born);
const bOld = put('ulva', 1);
const bYoung = put('ulva', 2, 'wild', g.time - 3600);
const bOut = put('ulva', 3);
bOut.born = g.time - wildStayOf(bOut.id) - 120;
const bIn = put('ulva', 4);
bIn.born = g.time - wildStayOf(bIn.id) + 120;
const bTame = put('ulva', 5, 'deed');
bTame.mine = true;
const bFight = put('ulva', 6);
bFight.enemy = bTame.id;
const bFought = put('ulva', 7);
bTame.enemy = bFought.id;
const bTrap = put('ulva', 8);
bTrap.trapped = 424242;
const bMonster = put('goblin', 9);
const bMarked = put('ulva', 10);
bMarked.marks = { root: { val: 1, until: g.time + 60 } };
const bCoaxed = put('ulva', 11);
bCoaxed.coaxed = 2;
bCoaxed.coaxedAt = g.time - COAX_LAPSE / 2;
const bStruck = put('ulva', 12);
bStruck.attackedBy = bTame.id;
bStruck.attackedAt = g.time - BLOW_MEMORY / 2;
(g.creatures as unknown as { banked: Map<number, number> }).banked.clear();
const banked = g.creatures.bankedTotal();
(g.creatures as unknown as { stream: (g: Game) => void }).stream(g);
const bStays = [bYoung, bIn, bTame, bFight, bFought, bTrap, bMonster, bMarked, bCoaxed, bStruck];
check('in the browser the streamer takes off the same old one and the one just past its span, and leaves the same others and one struck inside its memory',
  !g.creatures.list.has(bOld.id) && !g.creatures.list.has(bOut.id) && bStays.every((c) => g.creatures.list.has(c.id)),
  bStays.filter((c) => !g.creatures.list.has(c.id)).map((c) => c.species + c.id).join(','));
check('and puts them back on the books, so what comes out in their place is rolled afresh', g.creatures.bankedTotal() === banked + 2,
  `${banked} then ${g.creatures.bankedTotal()}`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nwild things come and go — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
