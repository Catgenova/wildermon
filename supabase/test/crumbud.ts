/**
 * The Crumbud.
 *
 * Asked for: "New wildermon, Christmas special running dec 1 > dec 25th annually. Crumbud gingerbark yuleheart. Combat
 * pet that taunts all nearby targets on a cooldown". This asks, of both sides, that:
 *
 *   * the kind is the same: a Crumbud, a Gingerbark at the first of `EVOLVE_AT` and a Yuleheart at the second, its season
 *     `YULE_SEASON`, out by day and by night, a Taunt for its ability, its stats and its stage-3 skill the same;
 *   * its season holds from 1 December 00:00 to 25 December 23:59 in UTC, any year, and not on 30 November or 26
 *     December; the Whispet's (`HALLOW_SEASON`) is as it was;
 *   * nothing puts a wild one down outside its season; the spawner takes the wild ones off once it is over, and leaves the
 *     tamed ones and every other kind where they are;
 *   * one of yours, fighting, taunts: every wild creature within `TAUNT_REACH` tiles that is after anybody, and every
 *     hunter and monster there, turns on it for `TAUNT_SECS` with a 'taunt' mark as long; not one that is timid, idle and
 *     no hunter, frightened, or a step past the reach. It strikes as well, and rests `TAUNT_REST`; inside the rest, and
 *     with none to turn, it only strikes and nothing is spent. A wild one taunts nothing, and a passive one, which does
 *     not fight, never taunts.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game, DAY_SECONDS } from '../../src/game/game';
import { BUTCHER_PARTS } from '../../src/game/butcher';
import {
  Creatures, EVOLVE_AT, HALLOW_SEASON, levelSkill, markOn, maxHealth, PLAYER_ATTACKER, seasonDay, seasonHolds, SPECIES, STAGE_PERKS, stageOf, TAUNT_REACH, TAUNT_REST,
  TAUNT_SECS, wildInSeason, YULE_SEASON, type Creature, type IslandCreature,
} from '../../src/game/creatures';
import { THREAT_HOLD } from '../../src/game/fight';
import { whereItLives } from '../../src/game/guide';
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
      PGUSER: process.env.PGUSER ?? 'wildermon',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const near = (a: number, b: number, by = 0.25): boolean => Math.abs(a - b) <= by;

const C = SPECIES.crumbud;
/** The moments the season is asked about, each with whether it holds; and the Whispet's, as it was. */
const MOMENTS: Array<[string, boolean, boolean]> = [
  ['2026-11-30T23:59:59Z', false, false],
  ['2026-12-01T00:00:00Z', true, false],
  ['2026-12-12T12:00:00Z', true, false],
  ['2026-12-25T23:59:00Z', true, false],
  ['2026-12-26T00:00:00Z', false, false],
  ['2026-07-01T12:00:00Z', false, false],
  ['2026-10-31T12:00:00Z', false, true],
  ['2027-12-01T06:00:00Z', true, false],
  ['2031-12-25T18:00:00Z', true, false],
  ['2031-12-26T00:00:01Z', false, false],
];
const IN = Date.parse('2026-12-12T12:00:00Z') / 1000;
const OUT = Date.parse('2026-12-26T00:00:00Z') / 1000;

/* ---- the kind, in the browser -------------------------------------------------------- */

const perk = STAGE_PERKS.crumbud;
/** The skill its level is, and its rest once a Yuleheart. */
const SKILL = levelSkill(C)!;
const STAGE3_REST = TAUNT_REST * (1 - (perk?.n ?? 0));

/* ---- on the island ----------------------------------------------------------------- */

const MIRA = '7e5b0000-0000-4000-8000-0000000000fa';
const pin = (secs: number): string => `perform set_config('wildermon.wild_now', '${secs}', true);`;
const mark = (key: string, kind: string, on: string): string =>
  `insert into said select '${key}', coalesce((select round(val::numeric, 2) || '|' || round(extract(epoch from until - now())::numeric) from class_mark where world_id = w and creature_id = ${on} and kind = '${kind}' and until > now()), '-');`;
/** Whether one turned on the Crumbud `a`: on it, how long it is held there, and its mark. */
const turned = (key: string, on: string): string =>
  `insert into said select '${key}', (o.brawl is not distinct from a)::text || '|' || coalesce(round(extract(epoch from o.threat_at - now())::numeric, 1)::text, '-')
     from creature o where o.world_id = w and o.id = ${on};
  ${mark(`${key}:mark`, 'taunt', on)}`;
/** Where each is put, from the Crumbud at (16.5, 16.5): how far, and what it is doing. */
const EDGE_IN = TAUNT_REACH - 0.06;
const EDGE_OUT = TAUNT_REACH + 0.2;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; a int; ww int; tame int; ul int;
        hunts int; idle int; timid int; hunter int; gin int; gout int; feared int; other int; brawls int; late int; t int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Crumbud', 1225, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  -- Where the Crumbud stands, so that one following you stays where it is put.
  update player set x = 16.5, y = 16.5, body_at = now(), swim_at = now() where world_id = w and uid = u;

  -- The kind.
  insert into said select 'ROW', name || '|' || array_to_string(stages, ',') || '|' || season_from || '|' || season_to || '|'
    || ability || '|' || nocturnal || '|' || ability_rest(ability) || '|' || taunt_secs() || '|' || taunt_reach() || '|' || ability_name(ability)
    from species_def where id = 'crumbud';
  insert into said select 'STATS', health || '|' || attack || '|' || speed || '|' || tame_level || '|' || tame_chance || '|' || s.timid || '|'
    || defensive || '|' || wound || '|' || gathers || '|' || work_range || '|' || coalesce(perk, '-') || '|' || coalesce(perk_n::text, '-')
    from species_def s where s.id = 'crumbud';
  insert into said select 'WORDS', description from species_def where id = 'crumbud';
  insert into said select 'CUT', coalesce((select string_agg(b.item || ':' || sb.n, ',' order by b.ord)
    from butcher_part b join species_butcher sb on sb.part = b.part where sb.species = 'crumbud'), '-');
  insert into said select 'WILDTABLE', weight::text from wild_table where species = 'crumbud';
  insert into said select 'HALLOW', season_from || '|' || season_to from species_def where id = 'whispet';
  insert into said values ('THREATHOLD', threat_hold()::text);

  -- The season, at each moment, and the Whispet's.
${MOMENTS.map(([m], i) => `  insert into said select 'HOLDS:${i}', season_holds(${seasonDay(YULE_SEASON.from)}, ${seasonDay(YULE_SEASON.to)}, '${m}'::timestamptz)::text
    || '|' || season_holds(s.season_from, s.season_to, '${m}'::timestamptz)::text from species_def s where s.id = 'whispet';`).join('\n')}
  ${pin(OUT)}
  insert into said values ('KINDOUT', wild_in_season('crumbud') || '|' || wild_in_season('ulva'));
  ${pin(IN)}
  insert into said values ('KINDIN', wild_in_season('crumbud') || '|' || wild_in_season('ulva'));

  -- Put down: by day and at midnight, in season and out of it.
  update world set epoch = now() where id = w;
  ${pin(IN)}
  insert into said values ('SUITS:night:in', suits(w, 'crumbud', 20, 20)::text);
  ${pin(OUT)}
  insert into said values ('SUITS:night:out', suits(w, 'crumbud', 20, 20)::text || '|' || suits(w, 'ulva', 20, 20)::text);
  update world set epoch = now() - make_interval(secs => 0.5 * day_seconds()) where id = w;
  ${pin(IN)}
  insert into said values ('SUITS:day:in', suits(w, 'crumbud', 20, 20)::text);
  update world set epoch = now() where id = w;

  -- The spawner: a wild one, a tamed one and a wild ulva, looked at in season and then out of it.
  ww := creature_spawn(w, 'crumbud', 30.5, 30.5, 'wild', now() - interval '1 hour', null);
  tame := creature_spawn(w, 'crumbud', 31.5, 30.5, 'deed', now() - interval '60 days', u);
  ul := creature_spawn(w, 'ulva', 32.5, 30.5, 'wild', now() - interval '1 hour', null);
  ${pin(IN)}
  perform creature_stock_block(w, 0, 0);
  insert into said select 'STOCK:in', string_agg(id::text, ',' order by id) from creature where world_id = w and id in (ww, tame, ul);
  ${pin(OUT)}
  update world_stocked set at = now() - make_interval(secs => restock_every() + 1) where world_id = w;
  perform creature_stock_block(w, 0, 0);
  insert into said select 'STOCK:out', string_agg(id::text, ',' order by id) from creature where world_id = w and id in (ww, tame, ul);
  insert into said select 'STOCK:wild', count(*)::text from creature where world_id = w and species = 'crumbud' and mode = 'wild';
  insert into said values ('STOCK:ids', ww || ',' || tame || ',' || ul);
  delete from creature where world_id = w; delete from class_mark where world_id = w;
  ${pin(IN)}

  -- A Taunt: one of yours, and round it what is after you, what is idle, a timid one after you, an idle hunter, a monster
  -- just inside its reach and one just past it, one after you running from a Fear, and one in a brawl with another of yours.
  a := creature_spawn(w, 'crumbud', 16.5, 16.5, 'active', now() - interval '60 days', u);
  other := creature_spawn(w, 'thumpa', 34.5, 34.5, 'active', now() - interval '60 days', u);
  hunts := creature_spawn(w, 'ulva', 19.5, 16.5, 'wild', now() - interval '60 days', null);
  idle := creature_spawn(w, 'ulva', 16.5, 18.5, 'wild', now() - interval '60 days', null);
  timid := creature_spawn(w, 'rabba', 14.5, 16.5, 'wild', now() - interval '60 days', null);
  hunter := creature_spawn(w, 'rowl', 16.5, 13.5, 'wild', now() - interval '60 days', null);
  gin := creature_spawn(w, 'goblin', ${16.5 + EDGE_IN / Math.SQRT2}, ${16.5 + EDGE_IN / Math.SQRT2}, 'wild', now() - interval '60 days', null);
  gout := creature_spawn(w, 'goblin', ${16.5 - EDGE_OUT}, 16.5, 'wild', now() - interval '60 days', null);
  feared := creature_spawn(w, 'ulva', 18.5, 18.5, 'wild', now() - interval '60 days', null);
  brawls := creature_spawn(w, 'ulva', 17.5, 14.5, 'wild', now() - interval '60 days', null);
  update creature set health = 5000, traits = '{}', rare = null, hunting = null, brawl = null, enemy = null where world_id = w and id not in (a, other);
  update creature set traits = '{}', rare = null where world_id = w and id in (a, other);
  update creature set hunting = u where world_id = w and id in (hunts, timid, feared);
  update creature set brawl = other where world_id = w and id = brawls;
  perform class_mark_put(w, feared, 'fear', 1, 30, null);
  insert into said select 'CASTBEFORE', coalesce((select (e->'cast')::text from jsonb_array_elements(rpc_creatures(w, 30)) e where (e->>'id')::int = a), 'missing');
  perform creature_attack(w, a, hunts);
  insert into said select 'CASTAFTER', coalesce((select round((e->>'cast')::numeric - extract(epoch from now())::numeric)::text
    from jsonb_array_elements(rpc_creatures(w, 30)) e where (e->>'id')::int = a), 'missing');
  insert into said select 'STRUCK', (health < 5000)::text from creature where world_id = w and id = hunts;
  ${turned('T:hunts', 'hunts')}
  ${turned('T:idle', 'idle')}
  ${turned('T:timid', 'timid')}
  ${turned('T:hunter', 'hunter')}
  ${turned('T:gin', 'gin')}
  ${turned('T:gout', 'gout')}
  ${turned('T:feared', 'feared')}
  ${turned('T:brawls', 'brawls')}
  ${mark('REST', 'ability', 'a')}
  insert into said values ('DIST', round(sqrt((creature_x((select c from creature c where world_id = w and id = gin)) - 16.5) ^ 2
    + (creature_y((select c from creature c where world_id = w and id = gin)) - 16.5) ^ 2)::numeric, 2) || '|'
    || round(sqrt((creature_x((select c from creature c where world_id = w and id = gout)) - 16.5) ^ 2
    + (creature_y((select c from creature c where world_id = w and id = gout)) - 16.5) ^ 2)::numeric, 2));
  -- Inside its rest: one come after you since is not turned, and the blow lands.
  late := creature_spawn(w, 'ulva', 15.5, 17.5, 'wild', now() - interval '60 days', null);
  update creature set health = 5000, traits = '{}', rare = null, hunting = u where world_id = w and id = late;
  update creature set health = 5000 where world_id = w and id = hunts;
  perform creature_attack(w, a, hunts);
  ${turned('T:late', 'late')}
  insert into said select 'AGAIN', (health < 5000)::text from creature where world_id = w and id = hunts;
  delete from creature where world_id = w; delete from class_mark where world_id = w;

  -- None to turn: it strikes, and the rest is not spent.
  a := creature_spawn(w, 'crumbud', 16.5, 16.5, 'active', now() - interval '60 days', u);
  t := creature_spawn(w, 'ulva', 17.5, 16.5, 'wild', now() - interval '60 days', null);
  update creature set health = 5000, traits = '{}', rare = null where world_id = w and id = t;
  update creature set traits = '{}', rare = null where world_id = w and id = a;
  perform creature_attack(w, a, t);
  insert into said select 'NONE', (health < 5000)::text from creature where world_id = w and id = t;
  ${mark('NONEREST', 'ability', 'a')}
  delete from creature where world_id = w; delete from class_mark where world_id = w;

  -- A wild one fights as any other does, and taunts nothing.
  a := creature_spawn(w, 'crumbud', 16.5, 16.5, 'wild', now() - interval '60 days', null);
  t := creature_spawn(w, 'thumpa', 17.5, 16.5, 'active', now() - interval '60 days', u);
  hunts := creature_spawn(w, 'ulva', 18.5, 16.5, 'wild', now() - interval '60 days', null);
  update creature set health = 5000 where world_id = w and id = t;
  update creature set hunting = u, brawl = null where world_id = w and id = hunts;
  perform creature_attack(w, a, t);
  insert into said select 'WILD', (health < 5000)::text from creature where world_id = w and id = t;
  ${turned('WILD:hunts', 'hunts')}
  ${mark('WILDREST', 'ability', 'a')}
  delete from creature where world_id = w; delete from class_mark where world_id = w;

  -- A Yuleheart: its stage-3 skill cuts the rest.
  a := creature_spawn(w, 'crumbud', 16.5, 16.5, 'active', now() - interval '60 days', u);
  t := creature_spawn(w, 'ulva', 17.5, 16.5, 'wild', now() - interval '60 days', null);
  update creature set traits = '{}', rare = null, skills = skills || jsonb_build_object('${SKILL}', ${EVOLVE_AT[1]}) where world_id = w and id = a;
  update creature set health = 5000, traits = '{}', rare = null, hunting = u where world_id = w and id = t;
  insert into said select 'STAGE3', stage_of(c)::text from creature c where world_id = w and id = a;
  perform creature_attack(w, a, t);
  ${turned('STAGE3:t', 't')}
  ${mark('STAGE3REST', 'ability', 'a')}
end $t$;
select k || '=' || replace(v, chr(10), ' ') from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- the kind ---------------------------------------------------------------------- */

check(`a Crumbud, a Gingerbark at ${EVOLVE_AT[0]} and a Yuleheart at ${EVOLVE_AT[1]}, out by day and night from ${seasonDay(YULE_SEASON.from)} to ${seasonDay(YULE_SEASON.to)}, with a Taunt of ${TAUNT_SECS} s over ${TAUNT_REACH} tiles every ${TAUNT_REST} s, on both sides`,
  C.name === 'Crumbud' && C.stages?.map((s) => s.name).join(',') === 'Gingerbark,Yuleheart' && C.season === YULE_SEASON && !C.nocturnal && C.ability === 'taunt'
    && at('ROW') === `Crumbud|Gingerbark,Yuleheart|${seasonDay(YULE_SEASON.from)}|${seasonDay(YULE_SEASON.to)}|taunt|false|${TAUNT_REST}|${TAUNT_SECS}|${TAUNT_REACH}|Taunt`, at('ROW'));
check('its stats and its stage-3 skill are the same on both sides: a tank, health above attack, strikes back',
  at('STATS') === `${C.health}|${C.attack}|${C.speed}|${C.tameLevel}|${C.tameChance}|false|true|${C.wound}|${C.gathers}|${C.workRange}|${perk?.kind ?? '-'}|${perk?.n ?? '-'}`
    && C.health >= 50 && C.attack <= 5 && !!C.defensive && perk?.kind === 'rest', `${at('STATS')}`);
check('its words are the same on both sides, and say its Taunt, its rest and its season in their own numbers',
  at('WORDS') === C.description && C.description.includes(`within ${TAUNT_REACH} tiles`) && C.description.includes(`for ${TAUNT_SECS} seconds`)
    && C.description.includes(`cooldown ${TAUNT_REST} seconds`) && C.description.includes('1 December to 25 December (UTC)') && !/[{}]/.test(C.description), C.description);
const cut = BUTCHER_PARTS.filter(([p]) => (C.butcher[p] ?? 0) > 0).map(([p, item]) => `${item}:${C.butcher[p]}`).join(',');
check('butchered it gives glands and nothing else, the same on both sides', cut === `gland:${C.butcher.gland}` && at('CUT') === cut, `browser ${cut}, island ${at('CUT')}`);
check('and the wild roll has it at the same weight on both sides', Number(at('WILDTABLE')) === 3, at('WILDTABLE'));
check('its guide page says when it is found wild', whereItLives(C).some((l) => l.startsWith('Wild only 1 December to 25 December')));
check('the Whispet\'s season is as it was: 15 October to 15 November, on both sides',
  seasonDay(HALLOW_SEASON.from) === 1015 && seasonDay(HALLOW_SEASON.to) === 1115 && SPECIES.whispet.season === HALLOW_SEASON && at('HALLOW') === '1015|1115', at('HALLOW'));

/* ---- the season -------------------------------------------------------------------- */

MOMENTS.forEach(([m, holds, hallow], i) => {
  const secs = Date.parse(m) / 1000;
  check(`at ${m} its season ${holds ? 'holds' : 'does not hold'} and the Whispet's ${hallow ? 'does' : 'does not'}, on both sides`,
    seasonHolds(YULE_SEASON, secs) === holds && wildInSeason(C, secs) === holds && wildInSeason(SPECIES.whispet, secs) === hallow
      && at(`HOLDS:${i}`) === `${holds}|${hallow}`, at(`HOLDS:${i}`));
});
check('every other kind is in season all year, and the island reads its pinned clock', at('KINDOUT') === 'false|true' && at('KINDIN') === 'true|true'
  && wildInSeason(SPECIES.ulva, OUT), `${at('KINDOUT')} ${at('KINDIN')}`);

/* ---- put down, and taken off ----------------------------------------------------- */

check('on the island one may be put down by day or night in its season, and not out of it; an ulva either way',
  at('SUITS:night:in') === 'true' && at('SUITS:night:out') === 'false|true' && at('SUITS:day:in') === 'true',
  `${at('SUITS:night:in')} ${at('SUITS:night:out')} ${at('SUITS:day:in')}`);
const [ww, tame, ul] = at('STOCK:ids').split(',');
check('the spawner leaves a wild one where it is in its season', at('STOCK:in') === `${ww},${tame},${ul}`, at('STOCK:in'));
check('and once the season is over takes the wild one off, leaving the tamed one, the ulva, and no wild one of the kind',
  at('STOCK:out') === `${tame},${ul}` && at('STOCK:wild') === '0', `${at('STOCK:out')} ${at('STOCK:wild')}`);

const g = Game.create(1225);
for (let y = 10; y <= 40; y++) for (let x = 10; x <= 40; x++) { g.world.setHeight(x, y, 4); g.world.setDirt(x, y, 3); }
for (let y = 10; y <= 39; y++) for (let x = 10; x <= 39; x++) g.world.setTile(x, y, TileType.Grass, 0);
g.player.x = 15.5;
g.player.y = 20.5;
const clear = (): void => { for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id); };
clear();
const MIDNIGHT = Math.ceil(g.time / DAY_SECONDS + 1) * DAY_SECONDS;
const dateAt = (secs: number): void => { g.wallClock = () => secs; };
g.time = MIDNIGHT;
dateAt(IN);
const nightIn = g.creatures.suits(g, C, 25, 25);
dateAt(OUT);
const nightOut = g.creatures.suits(g, C, 25, 25) || !g.creatures.suits(g, SPECIES.ulva, 25, 25);
g.time = MIDNIGHT + DAY_SECONDS / 2;
dateAt(IN);
const dayIn = g.creatures.suits(g, C, 25, 25);
check('in the browser one may be put down by day or night in its season, and not out of it; an ulva either way',
  nightIn && !nightOut && dayIn, `${nightIn} ${nightOut} ${dayIn}`);
dateAt(OUT);
const putOut = g.creatures.spawnSpecies(g, 'crumbud', 5, 0);
clear();
dateAt(IN);
const putIn = g.creatures.spawnSpecies(g, 'crumbud', 5, 0);
check('and out of its season nothing puts one down, where in it the same ask does', putOut === 0 && putIn > 0, `${putOut} out, ${putIn} in`);
clear();
{
  const cr = g.creatures as unknown as { stream: (g: Game) => void };
  const wild = g.creatures.spawn('crumbud', g.player.x + 2, g.player.y, 'wild', g.rand, g.time - 3600);
  const kept = g.creatures.spawn('crumbud', g.player.x + 3, g.player.y, 'deed', g.rand, g.time - 3600 * 24 * 30);
  const ulva = g.creatures.spawn('ulva', g.player.x + 4, g.player.y, 'wild', g.rand, g.time - 3600);
  dateAt(IN);
  cr.stream(g);
  const stays = g.creatures.list.has(wild.id) && g.creatures.list.has(kept.id) && g.creatures.list.has(ulva.id);
  dateAt(OUT);
  cr.stream(g);
  check('in the browser the streamer leaves a wild one beside you in its season, and once it is over takes it off and leaves the kept one and the ulva',
    stays && !g.creatures.list.has(wild.id) && g.creatures.list.has(kept.id) && g.creatures.list.has(ulva.id));
  clear();
}

/* ---- a Taunt, on the island --------------------------------------------------------- */

const held = TAUNT_SECS - Number(at('THREATHOLD'));
const isTurned = (k: string): boolean => {
  const [on, secs] = at(k).split('|');
  return on === 'true' && near(Number(secs), held, 0.3) && at(`${k}:mark`) === `1.00|${TAUNT_SECS}`;
};
const notTurned = (k: string): boolean => at(k).startsWith('false|') && at(`${k}:mark`) === '-';
check(`island and browser hold one taunted on it for the same time: ${TAUNT_SECS} s less the threat hold`, Number(at('THREATHOLD')) === THREAT_HOLD, at('THREATHOLD'));
check(`on the island a Crumbud of yours turns what is after you, an idle hunter and a monster ${EDGE_IN} tiles off onto it for ${TAUNT_SECS} s, each marked`,
  isTurned('T:hunts') && isTurned('T:hunter') && isTurned('T:gin'), `${at('T:hunts')} ${at('T:hunter')} ${at('T:gin')} ${at('T:gin:mark')}`);
check('and one in a brawl with another of yours', isTurned('T:brawls'), at('T:brawls'));
check(`and not one idle and no hunter, a timid one, one running from a Fear, or a monster ${EDGE_OUT} tiles off`,
  notTurned('T:idle') && notTurned('T:timid') && notTurned('T:feared') && notTurned('T:gout'),
  `${at('T:idle')} ${at('T:timid')} ${at('T:feared')} ${at('T:gout')} (${at('DIST')})`);
check('the two at its reach stood where they were put', at('DIST') === `${EDGE_IN.toFixed(2)}|${EDGE_OUT.toFixed(2)}`, at('DIST'));
check(`it strikes as well, and rests ${TAUNT_REST} s`, at('STRUCK') === 'true' && at('REST') === `1.00|${TAUNT_REST}`, `${at('STRUCK')} ${at('REST')}`);
check('inside the rest, one come after you since is not turned, and the blow lands', notTurned('T:late') && at('AGAIN') === 'true', `${at('T:late')} ${at('AGAIN')}`);
check('with none to turn it strikes, and the rest is not spent', at('NONE') === 'true' && at('NONEREST') === '-', `${at('NONE')} ${at('NONEREST')}`);
check(`on the island a Yuleheart (stage 3) rests ${STAGE3_REST} s, its Taunt's rest less ${Math.round((perk?.n ?? 0) * 100)}%`,
  at('STAGE3') === '2' && isTurned('STAGE3:t') && at('STAGE3REST') === `1.00|${STAGE3_REST}`, `${at('STAGE3')} ${at('STAGE3:t')} ${at('STAGE3REST')}`);
check('a wild Crumbud strikes as any other wild thing, and taunts nothing',
  at('WILD') === 'true' && notTurned('WILD:hunts') && at('WILDREST') === '-', `${at('WILD')} ${at('WILD:hunts')} ${at('WILDREST')}`);
check(`and its keeper is told it used it: when its ability's rest runs out, ${TAUNT_REST} s on, where before it had none`,
  at('CASTBEFORE') === 'null' && at('CASTAFTER') === String(TAUNT_REST), `${at('CASTBEFORE')} ${at('CASTAFTER')}`);
{
  const seen = new Creatures();
  seen.fromIsland = true;
  const row = (cast: number | null): IslandCreature => ({
    id: 7, species: 'crumbud', name: 'Crumbs', variant: 0, mode: 'active', stance: 'aggressive', x: 10, y: 12,
    health: 52, phase: 'idle', cast,
  } as unknown as IslandCreature);
  seen.sawAll([row(1000)], 5);
  seen.sawAll([row(1020)], 7);
  const c = seen.list.get(7);
  check('in the browser a new end to its rest plays its Taunt', c?.act === 'cast' && c?.actAt === 7, `${c?.act} ${c?.actAt}`);
}

/* ---- a Taunt, in the browser --------------------------------------------------------- */

g.time = MIDNIGHT;
dateAt(IN);
const px = g.player.x;
const py = g.player.y;
const mine = (stance: Creature['stance'] = 'passive'): Creature => {
  const c = g.creatures.spawn('crumbud', px, py - 4, 'active', g.rand, g.time - 3600 * 24 * 30);
  c.stance = stance;
  c.traits = [];
  c.rare = 0;
  c.health = maxHealth(c, C);
  return c;
};
const wildAt = (id: string, dx: number, dy: number): Creature => {
  const c = g.creatures.spawn(id, px + dx, py - 4 + dy, 'wild', g.rand, g.time - 3600 * 24 * 30);
  c.health = 5000;
  c.traits = [];
  c.rare = 0;
  c.enemy = null;
  c.brawl = null;
  return c;
};
const on = (o: Creature, a: Creature): boolean =>
  o.brawl === a.id && near(o.threatAt - g.time, TAUNT_SECS - THREAT_HOLD) && near(markOn(g, o, 'taunt', 0), 1, 0.01)
    && near((o.marks?.taunt?.until ?? 0) - g.time, TAUNT_SECS);
const off = (o: Creature, a: Creature): boolean => o.brawl !== a.id && markOn(g, o, 'taunt', 0) === 0;
{
  const a = mine();
  const kin = g.creatures.spawn('thumpa', px + 10, py + 10, 'active', g.rand, g.time - 3600 * 24 * 30);
  const hunts = wildAt('ulva', 3, 0);
  hunts.enemy = PLAYER_ATTACKER;
  const idle = wildAt('ulva', 0, 2);
  const timid = wildAt('rabba', -2, 0);
  timid.enemy = PLAYER_ATTACKER;
  const hunter = wildAt('rowl', 0, -3);
  const gin = wildAt('goblin', EDGE_IN / Math.SQRT2, EDGE_IN / Math.SQRT2);
  const gout = wildAt('goblin', -EDGE_OUT, 0);
  const feared = wildAt('ulva', 2, 2);
  feared.enemy = PLAYER_ATTACKER;
  feared.marks = { ...(feared.marks ?? {}), fear: { val: 1, until: g.time + 30 } } as Creature['marks'];
  const brawls = wildAt('ulva', 1, -2);
  brawls.enemy = kin.id;
  g.creatures.attack(g, a, hunts);
  check(`in the browser a Crumbud of yours turns what is after you, an idle hunter, a monster ${EDGE_IN} tiles off and one after another of yours onto it for ${TAUNT_SECS} s, each marked`,
    on(hunts, a) && on(hunter, a) && on(gin, a) && on(brawls, a));
  check(`and not one idle and no hunter, a timid one, one running from a Fear, or a monster ${EDGE_OUT} tiles off`,
    off(idle, a) && off(timid, a) && off(feared, a) && off(gout, a));
  check(`it strikes as well, and rests ${TAUNT_REST} s`, hunts.health < 5000 && near((a.marks?.ability?.until ?? 0) - g.time, TAUNT_REST));
  const late = wildAt('ulva', -1, 1);
  late.enemy = PLAYER_ATTACKER;
  hunts.health = 5000;
  g.creatures.attack(g, a, hunts);
  check('inside the rest, one come after you since is not turned, and the blow lands', off(late, a) && hunts.health < 5000);
  clear();
}
{
  const a = mine();
  const t = wildAt('ulva', 1, 0);
  g.creatures.attack(g, a, t);
  check('with none to turn it strikes, and the rest is not spent', t.health < 5000 && markOn(g, a, 'ability', 0) === 0);
  clear();
}
{
  const a = g.creatures.spawn('crumbud', px, py - 4, 'wild', g.rand, g.time - 3600 * 24 * 30);
  const t = g.creatures.spawn('thumpa', px + 1, py - 4, 'active', g.rand, g.time - 3600 * 24 * 30);
  t.health = 5000;
  const hunts = wildAt('ulva', 2, 0);
  hunts.enemy = PLAYER_ATTACKER;
  g.creatures.attack(g, a, t);
  check('a wild Crumbud strikes as any other wild thing, and taunts nothing',
    t.health < 5000 && off(hunts, a) && markOn(g, a, 'ability', 0) === 0);
  clear();
}
{
  // A passive one does not fight, and so never taunts, with one after you beside it.
  const a = mine('passive');
  const hunts = wildAt('ulva', 2, 0);
  hunts.enemy = PLAYER_ATTACKER;
  for (let i = 0; i < 20; i++) {
    g.creatures.update(0.1, g);
    g.time += 0.1;
  }
  check('a passive Crumbud of yours never taunts, with one after you beside it', off(hunts, a) && markOn(g, a, 'ability', 0) === 0);
  clear();
}
{
  // A Yuleheart's stage-3 skill cuts the rest by its share.
  const a = mine();
  a.skills = { ...a.skills, [SKILL]: EVOLVE_AT[1] };
  const t = wildAt('ulva', 1, 0);
  t.enemy = PLAYER_ATTACKER;
  g.creatures.attack(g, a, t);
  check(`in the browser a Yuleheart (stage ${stageOf(a) + 1}) rests ${STAGE3_REST} s, its Taunt's rest less ${Math.round((perk?.n ?? 0) * 100)}%`,
    stageOf(a) === 2 && on(t, a) && near((a.marks?.ability?.until ?? 0) - g.time, STAGE3_REST, 0.01));
  clear();
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nthe crumbud — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
