/**
 * The Whispet.
 *
 * Asked for: "Add a Halloween event wildermon only available October 15-november 15. Combat creature, has a fear
 * ability on cooldown". This asks, of both sides, that:
 *
 *   * the kind is the same: a Whispet, a Lanternveil at the first of `EVOLVE_AT` and a Hallowmire at the second, its
 *     season `HALLOW_SEASON`, out after dark, with a Fear for its ability and only glands in its carcass;
 *   * its season holds from 15 October 00:00 to 15 November 23:59 in UTC, and not on 14 October or 16 November;
 *   * nothing puts a wild one down outside its season, nor by day; the spawner takes the wild ones off once the season
 *     is over, and leaves the tamed ones and every other kind where they are;
 *   * one of yours, fighting, frightens what it fights instead of a blow: it runs from it for `FEAR_SECS`, strikes
 *     nothing meanwhile even when struck again, and the Whispet rests `FEAR_REST`, a blow inside the rest being a plain
 *     one; a monster is not frightened, a blow of yours ends a fright, and a wild one frightens nothing.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game, DAY_SECONDS } from '../../src/game/game';
import { BUTCHER_PARTS } from '../../src/game/butcher';
import {
  Creatures, EVOLVE_AT, FEAR_REST, FEAR_SECS, HALLOW_SEASON, markOn, maxHealth, seasonDay, seasonHolds, SPECIES, wildInSeason, type Creature,
  type IslandCreature,
} from '../../src/game/creatures';
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
      PGUSER: process.env.PGUSER ?? 'wurm',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const near = (a: number, b: number, by = 0.25): boolean => Math.abs(a - b) <= by;

const W = SPECIES.whispet;
/** The moments the season is asked about, each with whether it holds. */
const MOMENTS: Array<[string, boolean]> = [
  ['2026-10-14T23:59:59Z', false],
  ['2026-10-15T00:00:00Z', true],
  ['2026-10-31T12:00:00Z', true],
  ['2026-11-15T23:59:00Z', true],
  ['2026-11-16T00:00:00Z', false],
  ['2026-07-01T12:00:00Z', false],
  ['2027-10-20T06:00:00Z', true],
];
const IN = Date.parse('2026-10-31T12:00:00Z') / 1000;
const OUT = Date.parse('2026-11-16T00:00:00Z') / 1000;

/* ---- on the island ----------------------------------------------------------------- */

const MIRA = '7e5b0000-0000-4000-8000-0000000000f9';
const pin = (secs: number): string => `perform set_config('wurm.wild_now', '${secs}', true);`;
const mark = (key: string, kind: string, on: string): string =>
  `insert into said select '${key}', coalesce((select round(val::numeric, 2) || '|' || round(extract(epoch from until - now())::numeric) from class_mark where world_id = w and creature_id = ${on} and kind = '${kind}' and until > now()), '-');`;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; a int; t int; g int; ww int; tame int; ul int; c creature; v_h double precision; v_d double precision;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Whispet', 179, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set x = 14.5, y = 14.5, body_at = now(), swim_at = now() where world_id = w and uid = u;

  -- The kind.
  insert into said select 'ROW', name || '|' || array_to_string(stages, ',') || '|' || season_from || '|' || season_to || '|'
    || ability || '|' || nocturnal || '|' || ability_rest(ability) || '|' || fear_secs() || '|' || ability_name(ability)
    from species_def where id = 'whispet';
  insert into said select 'WORDS', description from species_def where id = 'whispet';
  insert into said select 'CUT', string_agg(b.item || ':' || sb.n, ',' order by b.ord)
    from butcher_part b join species_butcher sb on sb.part = b.part where sb.species = 'whispet';
  insert into said select 'WILDTABLE', weight::text from wild_table where species = 'whispet';

  -- The season, at each moment.
${MOMENTS.map(([m], i) => `  insert into said select 'HOLDS:${i}', season_holds(${seasonDay(HALLOW_SEASON.from)}, ${seasonDay(HALLOW_SEASON.to)}, '${m}'::timestamptz)::text;`).join('\n')}
  ${pin(OUT)}
  insert into said values ('KINDOUT', wild_in_season('whispet') || '|' || wild_in_season('ulva'));
  ${pin(IN)}
  insert into said values ('KINDIN', wild_in_season('whispet') || '|' || wild_in_season('ulva'));

  -- Put down: at midnight and by day, in season and out of it.
  update world set epoch = now() where id = w;
  ${pin(IN)}
  insert into said values ('SUITS:night:in', suits(w, 'whispet', 20, 20)::text);
  ${pin(OUT)}
  insert into said values ('SUITS:night:out', suits(w, 'whispet', 20, 20)::text || '|' || suits(w, 'ulva', 20, 20)::text);
  update world set epoch = now() - make_interval(secs => 0.5 * day_seconds()) where id = w;
  ${pin(IN)}
  insert into said values ('SUITS:day:in', suits(w, 'whispet', 20, 20)::text);
  update world set epoch = now() where id = w;

  -- The spawner: a wild one, a tamed one and a wild ulva, looked at in season and then out of it. The wild ones born
  -- an hour ago, inside their span (wild_stay), so that only their season takes them off.
  ww := creature_spawn(w, 'whispet', 30.5, 30.5, 'wild', now() - interval '1 hour', null);
  tame := creature_spawn(w, 'whispet', 31.5, 30.5, 'deed', now() - interval '60 days', u);
  ul := creature_spawn(w, 'ulva', 32.5, 30.5, 'wild', now() - interval '1 hour', null);
  ${pin(IN)}
  perform creature_stock_block(w, 0, 0);
  insert into said select 'STOCK:in', string_agg(id::text, ',' order by id) from creature where world_id = w and id in (ww, tame, ul);
  ${pin(OUT)}
  -- Looked at again once its turn comes round.
  update world_stocked set at = now() - make_interval(secs => restock_every() + 1) where world_id = w;
  perform creature_stock_block(w, 0, 0);
  insert into said select 'STOCK:out', string_agg(id::text, ',' order by id) from creature where world_id = w and id in (ww, tame, ul);
  insert into said select 'STOCK:wild', count(*)::text from creature where world_id = w and species = 'whispet' and mode = 'wild';
  insert into said values ('STOCK:ids', ww || ',' || tame || ',' || ul);
  -- And the whole island's stocking takes one off as well.
  ww := creature_spawn(w, 'whispet', 30.5, 31.5, 'wild', now() - interval '1 hour', null);
  perform creature_stock(w);
  insert into said select 'STOCKALL', count(*)::text from creature where world_id = w and id = ww;
  delete from creature where world_id = w; delete from class_mark where world_id = w;
  ${pin(IN)}

  -- A Fear: one of yours beside a wild ulva with health to spare.
  a := creature_spawn(w, 'whispet', 16.5, 16.5, 'active', now() - interval '60 days', u);
  t := creature_spawn(w, 'ulva', 17.5, 16.5, 'wild', now() - interval '60 days', null);
  update creature set health = 5000, brawl = a, threat_at = now() - interval '1 hour' where world_id = w and id = t;
  -- No blood and no rarity, which would lift the Fear and its rest (\`fear\`, \`cooldown\`).
  update creature set traits = '{}', rare = null where world_id = w and id in (a, t);
  select * into c from creature where world_id = w and id = t;
  v_d := sqrt((creature_x(c) - 16.5) ^ 2 + (creature_y(c) - 16.5) ^ 2);
  -- What its keeper is told of it before and after: when the rest after its ability runs out.
  insert into said select 'CASTBEFORE', coalesce((select (e->'cast')::text from jsonb_array_elements(rpc_creatures(w, 30)) e where (e->>'id')::int = a), 'missing');
  perform creature_attack(w, a, t);
  insert into said select 'CASTAFTER', coalesce((select round((e->>'cast')::numeric - extract(epoch from now())::numeric)::text
    from jsonb_array_elements(rpc_creatures(w, 30)) e where (e->>'id')::int = a), 'missing');
  select * into c from creature where world_id = w and id = t;
  insert into said values ('FEAR', (c.health = 5000)::text || '|' || round(extract(epoch from c.until - now())::numeric) || '|'
    || round(extract(epoch from c.hunt_again - now())::numeric) || '|' || coalesce(c.brawl::text, '-') || '|' || coalesce(c.hunting::text, '-') || '|'
    || (sqrt((c.to_x - 16.5) ^ 2 + (c.to_y - 16.5) ^ 2) > v_d + 1)::text);
  ${mark('FEARMARK', 'fear', 't')}
  ${mark('FEARREST', 'ability', 'a')}
  -- Struck again while it runs, it turns on the Whispet and lands nothing on it until the fright is out.
  select health into v_h from creature where world_id = w and id = a;
  perform beast_threat(w, t, a);
  perform creature_settle(w, t);
  insert into said select 'RUNNING', (brawl = a)::text || '|' || ((select health from creature where world_id = w and id = a) = v_h)::text
    from creature where world_id = w and id = t;
  -- Inside its rest, a plain blow.
  perform creature_attack(w, a, t);
  insert into said select 'AGAIN', (health < 5000)::text from creature where world_id = w and id = t;
  -- A blow of yours ends a fright, once nothing else holds it: its turn comes at once.
  update creature set brawl = null, threat_at = now() - interval '1 hour' where world_id = w and id = t;
  perform engage_beast(w, t, u);
  insert into said select 'ENDED', (until <= now())::text || '|' || coalesce(hunting::text, '-') from creature where world_id = w and id = t;
  delete from creature where world_id = w; delete from class_mark where world_id = w;

  -- A monster is not frightened: struck instead, and the rest not spent.
  a := creature_spawn(w, 'whispet', 16.5, 16.5, 'active', now() - interval '60 days', u);
  g := creature_spawn(w, 'goblin', 17.5, 16.5, 'wild', now() - interval '60 days', null);
  update creature set health = 5000 where world_id = w and id = g;
  perform creature_attack(w, a, g);
  insert into said select 'MONSTER', (health < 5000)::text || '|' || (until <= now() + interval '1 second')::text from creature where world_id = w and id = g;
  ${mark('MONSTERMARK', 'fear', 'g')}
  ${mark('MONSTERREST', 'ability', 'a')}
  delete from creature where world_id = w; delete from class_mark where world_id = w;

  -- A wild one fights as any other does.
  a := creature_spawn(w, 'whispet', 16.5, 16.5, 'wild', now() - interval '60 days', null);
  t := creature_spawn(w, 'gasha', 17.5, 16.5, 'active', now() - interval '60 days', u);
  update creature set health = 5000 where world_id = w and id = t;
  perform creature_attack(w, a, t);
  insert into said select 'WILD', (health < 5000)::text from creature where world_id = w and id = t;
  ${mark('WILDMARK', 'fear', 't')}
  ${mark('WILDREST', 'ability', 'a')}
end $t$;
select k || '=' || replace(v, chr(10), ' ') from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- the kind ---------------------------------------------------------------------- */

check(`a Whispet, a Lanternveil at ${EVOLVE_AT[0]} and a Hallowmire at ${EVOLVE_AT[1]}, out after dark from ${seasonDay(HALLOW_SEASON.from)} to ${seasonDay(HALLOW_SEASON.to)}, with a Fear of ${FEAR_SECS} s every ${FEAR_REST} s, on both sides`,
  W.name === 'Whispet' && W.stages?.map((s) => s.name).join(',') === 'Lanternveil,Hallowmire' && W.season === HALLOW_SEASON && !!W.nocturnal && W.ability === 'fear'
    && at('ROW') === `Whispet|Lanternveil,Hallowmire|${seasonDay(HALLOW_SEASON.from)}|${seasonDay(HALLOW_SEASON.to)}|fear|true|${FEAR_REST}|${FEAR_SECS}|Fear`, at('ROW'));
check('its words are the same on both sides, and say its Fear, its rest and its season in their own numbers',
  at('WORDS') === W.description && W.description.includes(`for ${FEAR_SECS} seconds`) && W.description.includes(`cooldown ${FEAR_REST} seconds`)
    && W.description.includes('15 October to 15 November (UTC)') && !/[{}]/.test(W.description), W.description);
const cut = BUTCHER_PARTS.filter(([p]) => (W.butcher[p] ?? 0) > 0).map(([p, item]) => `${item}:${W.butcher[p]}`).join(',');
check('butchered it gives glands and nothing else, the same on both sides', cut === `gland:${W.butcher.gland}` && at('CUT') === cut, `browser ${cut}, island ${at('CUT')}`);
check('and the wild roll has it at the same weight on both sides', at('WILDTABLE') !== '(not said)' && Number(at('WILDTABLE')) === 4, at('WILDTABLE'));
check('its guide page says when it is found wild', whereItLives(W).some((l) => l.startsWith('Wild only 15 October to 15 November')));

/* ---- the season -------------------------------------------------------------------- */

MOMENTS.forEach(([m, holds], i) => {
  const secs = Date.parse(m) / 1000;
  check(`at ${m} the season ${holds ? 'holds' : 'does not hold'}, on both sides`,
    seasonHolds(HALLOW_SEASON, secs) === holds && wildInSeason(W, secs) === holds && at(`HOLDS:${i}`) === String(holds), at(`HOLDS:${i}`));
});
check('every other kind is in season all year, and the island reads its pinned clock', at('KINDOUT') === 'false|true' && at('KINDIN') === 'true|true'
  && wildInSeason(SPECIES.ulva, OUT), `${at('KINDOUT')} ${at('KINDIN')}`);

/* ---- put down, and taken off ----------------------------------------------------- */

check('on the island one may be put down at night in its season, not out of it, and not by day; an ulva either way',
  at('SUITS:night:in') === 'true' && at('SUITS:night:out') === 'false|true' && at('SUITS:day:in') === 'false',
  `${at('SUITS:night:in')} ${at('SUITS:night:out')} ${at('SUITS:day:in')}`);
const [ww, tame, ul] = at('STOCK:ids').split(',');
check('the spawner leaves a wild one where it is in its season',
  at('STOCK:in') === `${ww},${tame},${ul}`, at('STOCK:in'));
check('and once the season is over takes the wild one off, leaving the tamed one, the ulva, and no wild one of the kind',
  at('STOCK:out') === `${tame},${ul}` && at('STOCK:wild') === '0', `${at('STOCK:out')} ${at('STOCK:wild')}`);
check('and so does the whole island\'s stocking', at('STOCKALL') === '0', at('STOCKALL'));

const g = Game.create(4256);
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
const nightIn = g.creatures.suits(g, W, 25, 25);
dateAt(OUT);
const nightOut = g.creatures.suits(g, W, 25, 25) || !g.creatures.suits(g, SPECIES.ulva, 25, 25);
g.time = MIDNIGHT + DAY_SECONDS / 2;
dateAt(IN);
const dayIn = g.creatures.suits(g, W, 25, 25);
check('in the browser one may be put down at night in its season, not out of it, and not by day; an ulva either way',
  g.isNight() === false && nightIn && !nightOut && !dayIn, `${nightIn} ${nightOut} ${dayIn}`);
g.time = MIDNIGHT;
dateAt(OUT);
const putOut = g.creatures.spawnSpecies(g, 'whispet', 5, 0);
clear();
dateAt(IN);
const putIn = g.creatures.spawnSpecies(g, 'whispet', 5, 0);
check('and out of its season nothing puts one down, where in it the same ask does', putOut === 0 && putIn > 0, `${putOut} out, ${putIn} in`);
clear();
{
  const cr = g.creatures as unknown as { stream: (g: Game) => void };
  // The wild ones an hour old, inside their span (`WILD_STAY`), so that only the season takes one off.
  const wild = g.creatures.spawn('whispet', g.player.x + 2, g.player.y, 'wild', g.rand, g.time - 3600);
  const kept = g.creatures.spawn('whispet', g.player.x + 3, g.player.y, 'deed', g.rand, g.time - 3600 * 24 * 30);
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

/* ---- a Fear, on the island ---------------------------------------------------------- */

const [unhurt, ran, hunt, brawl, hunting, away] = at('FEAR').split('|');
check(`on the island a Whispet of yours frightens the ulva instead of a blow: it runs ${FEAR_SECS} s, away from it, its fight and its hunt dropped`,
  unhurt === 'true' && Number(ran) === FEAR_SECS && Number(hunt) === FEAR_SECS && brawl === '-' && hunting === '-' && away === 'true', at('FEAR'));
check(`and it is frightened for ${FEAR_SECS} s, and the Whispet rests ${FEAR_REST} s`,
  at('FEARMARK') === `1.00|${FEAR_SECS}` && at('FEARREST') === `1.00|${FEAR_REST}`, `${at('FEARMARK')} ${at('FEARREST')}`);
check('struck again while it runs, it turns on the Whispet and lands nothing on it', at('RUNNING') === 'true|true', at('RUNNING'));
check('inside the rest, the next go is a plain blow', at('AGAIN') === 'true', at('AGAIN'));
check('a blow of yours ends the fright: its turn is at once, and it is after you', at('ENDED') === `true|${MIRA}`, at('ENDED'));
check('a monster is not frightened: it is struck, does not run, and the rest is not spent',
  at('MONSTER') === 'true|true' && at('MONSTERMARK') === '-' && at('MONSTERREST') === '-', `${at('MONSTER')} ${at('MONSTERMARK')} ${at('MONSTERREST')}`);
check('a wild Whispet strikes as any other wild thing, and frightens nothing',
  at('WILD') === 'true' && at('WILDMARK') === '-' && at('WILDREST') === '-', `${at('WILD')} ${at('WILDMARK')} ${at('WILDREST')}`);

check(`and its keeper is told it used it: when its ability's rest runs out, ${FEAR_REST} s on, where before it had none`,
  at('CASTBEFORE') === 'null' && at('CASTAFTER') === String(FEAR_REST), `${at('CASTBEFORE')} ${at('CASTAFTER')}`);
{
  // The browser plays that as its Fear, as it would in a game of your own, and not at the first word of one.
  const seen = new Creatures();
  seen.fromIsland = true;
  const row = (cast: number | null): IslandCreature => ({
    id: 7, species: 'whispet', name: 'Boo', variant: 0, mode: 'active', stance: 'aggressive', x: 10, y: 12,
    health: 28, phase: 'idle', cast,
  } as unknown as IslandCreature);
  seen.sawAll([row(1000)], 5);
  const first = seen.list.get(7)?.act;
  seen.sawAll([row(1000)], 6);
  const same = seen.list.get(7)?.act;
  seen.sawAll([row(1020)], 7);
  const c = seen.list.get(7);
  check('in the browser a new end to its rest plays its Fear, the first word of one and the same one again do not',
    first === undefined && same === undefined && c?.act === 'cast' && c?.actAt === 7, `${first} ${same} ${c?.act} ${c?.actAt}`);
}

/* ---- a Fear, in the browser --------------------------------------------------------- */

g.time = MIDNIGHT;
dateAt(IN);
const px = g.player.x;
const py = g.player.y;
const mine = (): Creature => {
  const c = g.creatures.spawn('whispet', px + 2, py, 'active', g.rand, g.time - 3600 * 24 * 30);
  c.stance = 'passive';
  c.traits = [];
  c.rare = 0;
  // At the health it has without them, or its first settle takes off what its blood had put on.
  c.health = maxHealth(c, SPECIES.whispet);
  return c;
};
const wildOne = (id: string, health = 5000): Creature => {
  const c = g.creatures.spawn(id, px + 3, py, 'wild', g.rand, g.time - 3600 * 24 * 30);
  c.health = health;
  c.traits = [];
  c.rare = 0;
  return c;
};
{
  const a = mine();
  const t = wildOne('ulva');
  t.brawl = a.id;
  const was = Math.hypot(t.x - a.x, t.y - a.y);
  g.creatures.attack(g, a, t);
  check(`in the browser a Whispet of yours frightens the ulva instead of a blow: it runs ${FEAR_SECS} s, away from it, its fight dropped`,
    t.health === 5000 && t.state === 'flee' && near(t.until - g.time, FEAR_SECS) && t.brawl === null && t.enemy === null
      && Math.hypot(t.tx - a.x, t.ty - a.y) > was + 1);
  check(`and it is frightened for ${FEAR_SECS} s, and the Whispet rests ${FEAR_REST} s`,
    near((t.marks?.fear?.until ?? 0) - g.time, FEAR_SECS) && near((a.marks?.ability?.until ?? 0) - g.time, FEAR_REST));
  // Struck again while it runs, it turns on the Whispet and lands nothing on it.
  t.brawl = a.id;
  t.threatAt = g.time;
  const health = a.health;
  for (let i = 0; i < Math.floor((FEAR_SECS - 1) * 10); i++) {
    g.creatures.update(0.1, g);
    g.time += 0.1;
  }
  check('struck again while it runs, it lands nothing on the Whispet, and keeps running', a.health === health && t.state === 'flee'
    && Math.hypot(t.x - a.x, t.y - a.y) > was, `${a.health} of ${health}, ${t.state}`);
  g.creatures.attack(g, a, t);
  check('inside the rest, the next go is a plain blow', t.health < 5000);
  t.brawl = null;
  t.threatAt = -1e9;
  g.creatures.engage(g, t);
  check('a blow of yours ends the fright: its turn is at once, and it is after you', t.state !== 'flee' && markOn(g, t, 'fear', 0) === 0 && t.enemy !== null);
  clear();
}
{
  const a = mine();
  const t = wildOne('goblin');
  g.creatures.attack(g, a, t);
  check('a monster is not frightened: it is struck, does not run, and the rest is not spent',
    t.health < 5000 && t.state !== 'flee' && markOn(g, t, 'fear', 0) === 0 && markOn(g, a, 'ability', 0) === 0);
  clear();
}
{
  const a = g.creatures.spawn('whispet', px + 2, py, 'wild', g.rand, g.time - 3600 * 24 * 30);
  const t = g.creatures.spawn('gasha', px + 3, py, 'active', g.rand, g.time - 3600 * 24 * 30);
  t.health = 5000;
  g.creatures.attack(g, a, t);
  check('a wild Whispet strikes as any other wild thing, and frightens nothing', t.health < 5000 && markOn(g, t, 'fear', 0) === 0 && markOn(g, a, 'ability', 0) === 0);
  clear();
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nthe whispet — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
