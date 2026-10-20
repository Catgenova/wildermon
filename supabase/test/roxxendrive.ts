/**
 * A Roxxen learns driving in the traces.
 *
 * Asked for: "Roxxen need to have the Driving trade and gain experience in it
 * when pulling a large cart or wagon". A Roxxen kept climbing, as every
 * draught beast does; now its one skill, and so its level, is driving, and
 * what teaches it is pulling (`LearnsBy` 'pull'): a go at `PULL_LEARN` for
 * every tile a large cart or a wagon it is in the traces of goes into under
 * its driver, which is the tile that teaches the driver Driving. So this asks,
 * of both sides:
 *
 *   * the Roxxen learns driving by pulling and nothing else does, at the same
 *     base the driver is paid, and only a large cart and a wagon have traces;
 *   * a wagon driven a few tiles teaches each Roxxen in its traces a go a tile,
 *     within what the luck of a go allows, and the Orse beside them nothing;
 *   * a Roxxen standing in the traces, one in the traces of a cart nobody is
 *     driving, and one walking at heel learn nothing;
 *   * a Roxxen's driving stands in the traces where climbing does, in the same
 *     average a team's pace and pitch are read off, on both sides;
 *   * and one that had climbing keeps its level: a saved game's and the
 *     island's alike come back with it as driving.
 *
 * The island half runs against the database the suite leaves behind, in one
 * transaction that is rolled back.
 *
 *   npx esbuild supabase/test/roxxendrive.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/roxxendrive.mjs && node node_modules/.cache/roxxendrive.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Game } from '../../src/game/game';
import { creatureLevel, Creatures, HAUL_SKILL, LEARNS_GAIN, learnPace, PULL_LEARN, SPECIES, tracesSkill, type Creature } from '../../src/game/creatures';
import { FURNITURE } from '../../src/game/furniture';
import { PLACEABLE_ACTION_BY_ID } from '../../src/game/placeables';
import { skillGain } from '../../src/game/skills';
import { DRIVING, DRIVING_LEARN } from '../../src/game/travel';

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
const near = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) <= eps;

/* ---- the rule, on both sides ---------------------------------------------- */

const roxxen = SPECIES.roxxen;
const kinds = Object.values(SPECIES).filter((d) => d.learns?.by === 'pull').map((d) => d.id);
const isleKinds = psql(`select string_agg(id || ':' || learns, ',' order by id) from species_def where learns_by = 'pull'`);
check('the Roxxen, and only the Roxxen, learns driving by pulling, on both sides',
  kinds.join(',') === 'roxxen' && roxxen.learns?.skill === DRIVING && isleKinds === `roxxen:${DRIVING}`,
  `browser ${kinds.join(',')}, island ${isleKinds}`);
const isleGain = Number(psql('select learns_gain_pull()'));
check('a tile pulled is worth what a tile driven teaches the driver, on both sides',
  PULL_LEARN === DRIVING_LEARN && LEARNS_GAIN.pull === PULL_LEARN && isleGain === PULL_LEARN,
  `browser ${LEARNS_GAIN.pull}, island ${isleGain}, the driver's ${DRIVING_LEARN}`);
const yoked = Object.values(FURNITURE).filter((d) => d.vehicle).map((d) => d.id).sort();
const isleYoked = psql(`select string_agg(id, ',' order by id) from vehicle_def`);
check('only a large cart and a wagon have traces, on both sides',
  yoked.join(',') === 'large_cart,wagon' && isleYoked === 'large_cart,wagon', `browser ${yoked.join(',')}, island ${isleYoked}`);
check('a new Roxxen starts with driving and no climbing; an Orse still keeps climbing',
  tracesSkill(roxxen) === DRIVING && tracesSkill(SPECIES.orse) === HAUL_SKILL
    && JSON.stringify(new Creatures().spawn('roxxen', 0, 0, 'active').skills) === JSON.stringify({ [DRIVING]: 1 }),
  JSON.stringify(new Creatures().spawn('roxxen', 0, 0, 'active').skills));

/* ---- the browser --------------------------------------------------------- */

const game = Game.create(4646);
// Open, dry, level ground with room for a wagon and a dozen tiles east of it.
let spot: [number, number] | null = null;
const clear = (x0: number, y0: number): boolean => {
  for (let y = y0 - 4; y <= y0 + 4; y++) {
    for (let x = x0 - 4; x <= x0 + 16; x++) {
      if (!game.world.isPassable(x, y) || game.world.hasWater(x, y) || game.world.slope(x, y) >= 12) return false;
    }
  }
  return true;
};
for (let r = 0; r < 200 && !spot; r++) {
  for (let dx = -r; dx <= r && !spot; dx++) {
    for (const dy of [-r, r]) {
      if (clear(96 + dx, 96 + dy)) {
        spot = [96 + dx, 96 + dy];
        break;
      }
    }
  }
}
check('a stretch of open ground to drive on', spot !== null, spot ? `${spot[0]}, ${spot[1]}` : 'none found');
const [px, py] = spot ?? [96, 96];
for (const f of [...game.furniture.values()]) game.removeFurniture(f.id);
game.player.x = px + 0.5;
game.player.y = py + 0.5;

const grown = game.time - 3600 * 24;
const wagon = game.addFurniture('wagon', px + 1, py, 0, 0, 40, [], 'Pine');
const beast = (species: string, x: number, y: number): Creature => {
  const c = game.creatures.spawn(species, x, y, 'active', game.rand, grown);
  c.hunger = 1;
  c.traits = [];
  return c;
};
// Two Roxxen and two Orse in the wagon's four yokes.
const team = [beast('roxxen', px + 2.5, py + 0.5), beast('roxxen', px + 2.5, py + 1.5), beast('orse', px + 2.5, py + 2.5), beast('orse', px + 2.5, py - 0.5)];
for (const c of team) c.hitchedTo = wagon.id;
wagon.team = team.map((c) => c.id);
const [rox1, rox2, orse1] = team;
// A Roxxen in the traces of a large cart nobody drives, well out of the way.
const cart = game.addFurniture('large_cart', px - 3, py + 3, 0, 0, 40, [], 'Pine');
const parked = beast('roxxen', px - 1.5, py + 3.5);
parked.hitchedTo = cart.id;
cart.team = [parked.id];
// And one that is out of the traces altogether, at heel.
const loose = beast('roxxen', px + 0.5, py + 1.5);

const board = PLACEABLE_ACTION_BY_ID.get('board_vehicle');
if (!board) throw new Error('board_vehicle is missing');
const reins = { kind: 'furniture' as const, id: wagon.id };
check('the reins of the wagon are there to take', board.applies(reins, game) && !board.check?.(reins, game),
  board.check?.(reins, game) ?? 'nothing in the way');
board.perform(reins, game);

// Count the goes as they are paid, and the tiles the wagon goes into as it goes.
const goes = new Map<number, number>();
const learnBy = game.creatures.learnBy.bind(game.creatures);
game.creatures.learnBy = (g, c, by) => {
  if (by === 'pull') goes.set(c.id, (goes.get(c.id) ?? 0) + 1);
  learnBy(g, c, by);
};
const before = new Map(team.concat(parked, loose).map((c) => [c.id, c.skills[DRIVING] ?? 0] as [number, number]));
const climbed = orse1.skills[HAUL_SKILL];
// What each go is worth at the least and the most, at each one's learning (its blood, its care).
const bounds = (c: Creature): [number, number] => {
  // At what a go of its trade is worth against every other trade's (`LEARN_PACE`).
  const base = PULL_LEARN * game.creatures.learnMul(c, game.time) * learnPace(c, DRIVING);
  return [skillGain(2, base, 0.6), skillGain(1, base, 1.4)];
};
check('and they take us somewhere', game.moveTo(px + 12, py));
let tiles = 0;
let [tx, ty] = [Math.floor(game.player.x), Math.floor(game.player.y)];
const wasAt = wagon.x;
for (let t = 0; t < 400 && game.player.path; t++) {
  game.update(0.1);
  const [nx, ny] = [Math.floor(game.player.x), Math.floor(game.player.y)];
  tiles += Math.abs(nx - tx) + Math.abs(ny - ty);
  [tx, ty] = [nx, ny];
}
check('driven, the wagon comes along', game.driving() === wagon && wagon.x > wasAt + 4, `${wagon.x - wasAt} tiles east, ${tiles} tiles gone into`);
for (const [i, c] of [rox1, rox2].entries()) {
  const gained = (c.skills[DRIVING] ?? 0) - (before.get(c.id) ?? 0);
  const [lo, hi] = bounds(c);
  check(`Roxxen ${i + 1} in the traces has a go of driving for every tile the wagon went into, and learns what those goes teach`,
    goes.get(c.id) === tiles && tiles > 0 && gained >= tiles * lo - 1e-12 && gained <= tiles * hi + 1e-12 && creatureLevel(c) === Math.floor(c.skills[DRIVING]),
    `${goes.get(c.id)} goes for ${tiles} tiles, driving +${gained.toFixed(5)} (${(tiles * lo).toFixed(5)} to ${(tiles * hi).toFixed(5)})`);
}
check('the Orse beside them learns no driving, and keeps its climbing',
  team.slice(2).every((c) => c.skills[DRIVING] === undefined && c.skills[HAUL_SKILL] !== undefined) && orse1.skills[HAUL_SKILL] >= climbed,
  team.slice(2).map((c) => JSON.stringify(c.skills)).join(' '));
check('a Roxxen in the traces of a cart nobody is driving, and one at heel, learn nothing',
  parked.skills[DRIVING] === before.get(parked.id) && loose.skills[DRIVING] === before.get(loose.id) && !goes.has(parked.id) && !goes.has(loose.id),
  `${parked.skills[DRIVING]} and ${loose.skills[DRIVING]}`);
{
  // Stood still on the seat for ten seconds.
  const was = rox1.skills[DRIVING];
  const paid = goes.get(rox1.id);
  for (let t = 0; t < 100; t++) game.update(0.1);
  check('standing in the traces teaches nothing', rox1.skills[DRIVING] === was && goes.get(rox1.id) === paid, `${was} → ${rox1.skills[DRIVING]}`);
}
{
  // A Roxxen's driving is what the team is read off for its pace and pitch, where an Orse's climbing is.
  rox1.skills[DRIVING] = 60;
  rox2.skills[DRIVING] = 30;
  team[2].skills[HAUL_SKILL] = 20;
  team[3].skills[HAUL_SKILL] = 10;
  check('in the traces a Roxxen\'s driving counts where another beast\'s climbing does',
    near(game.teamClimb(wagon), (60 + 30 + 20 + 10) / 4), `${game.teamClimb(wagon)}`);
}
{
  // A game saved with a Roxxen that had climbing.
  const saved = Creatures.fromJSON({
    nextId: 3,
    list: [
      { ...JSON.parse(JSON.stringify(rox1)), id: 1, skills: { [HAUL_SKILL]: 37.5 } },
      { ...JSON.parse(JSON.stringify(rox1)), id: 2, skills: { [HAUL_SKILL]: 12.25, [DRIVING]: 20 } },
      { ...JSON.parse(JSON.stringify(orse1)), id: 3, skills: { [HAUL_SKILL]: 41 } },
    ],
  });
  const [a, b, o] = [saved.get(1)!, saved.get(2)!, saved.get(3)!];
  check('a saved Roxxen comes back with its climbing as its driving, and the level it had',
    JSON.stringify(a.skills) === JSON.stringify({ [DRIVING]: 37.5 }) && creatureLevel(a) === 37
      && JSON.stringify(b.skills) === JSON.stringify({ [DRIVING]: 20 }) && o.skills[HAUL_SKILL] === 41 && o.skills[DRIVING] === undefined,
    `${JSON.stringify(a.skills)} level ${creatureLevel(a)}; ${JSON.stringify(b.skills)}; the Orse ${JSON.stringify(o.skills)}`);
}

/* ---- the island ----------------------------------------------------------- */

// The statement the migration moved every Roxxen's climbing over with, run again over these.
const migration = readFileSync('supabase/migrations/20261019210000_a_roxxen_learns_driving_in_the_traces.sql', 'utf8');
const carry = migration.match(/update creature\s+set skills[\s\S]*?;/)?.[0];
check('the migration carries climbing over to driving', !!carry, carry ? '' : 'no update in it');

const IVAR = `(select uid from player where world_id = (select id from world where name = 'Faraway') and name = 'Ivar')`;
const out = psql(`
begin;
create temp table said (k text, v text);
select set_config('request.jwt.claims', json_build_object('sub', ${IVAR})::text, true) \\g /dev/null
do $t$
declare w uuid; u uuid; gx int; gy int; v_wagon bigint; v_cart bigint; r1 int; r2 int; o1 int; o2 int; v_parked int; v_loose int;
        v_old int; v_both int; v_orse int;
begin
  select id into w from world where name = 'Faraway';
  select uid into u from player where world_id = w and name = 'Ivar';
  -- Flat grass to go over, and nothing of Ivar's under him or in his hands.
  for gx in 12..34 loop for gy in 15..27 loop
    perform land_set_height(w, gx, gy, 4); perform land_set_tile(w, gx, gy, tile_id('Grass'));
  end loop; end loop;
  update creature set rider = null where world_id = w and rider = u;
  delete from placed where world_id = w and driver = u;
  update player set x = 20.5, y = 21.5, level = 0, aboard = null, away = false,
         moved_at = now() - interval '10 seconds' where world_id = w and uid = u;

  -- On the box of a wagon with two Roxxen and two Orse in its yokes.
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql, driver)
    values (w, 'furniture', 'wagon', 20, 21, 20.5, 21.5, 50, u) returning id into v_wagon;
  r1 := creature_spawn(w, 'roxxen', 22.5, 21.5, 'active', now() - interval '2 years', u);
  r2 := creature_spawn(w, 'roxxen', 22.5, 22.5, 'active', now() - interval '2 years', u);
  o1 := creature_spawn(w, 'orse', 22.5, 20.5, 'active', now() - interval '2 years', u);
  o2 := creature_spawn(w, 'orse', 22.5, 23.5, 'active', now() - interval '2 years', u);
  update creature set hitched_to = v_wagon, hunger = 1, traits = '{}', skills = '{}' where world_id = w and id in (r1, r2, o1, o2);
  -- A Roxxen in the traces of a large cart nobody drives, and one at heel.
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql)
    values (w, 'furniture', 'large_cart', 14, 17, 14.5, 17.5, 50) returning id into v_cart;
  v_parked := creature_spawn(w, 'roxxen', 15.5, 17.5, 'active', now() - interval '2 years', u);
  v_loose := creature_spawn(w, 'roxxen', 20.5, 22.5, 'active', now() - interval '2 years', u);
  update creature set hitched_to = v_cart, hunger = 1, traits = '{}', skills = '{}' where world_id = w and id = v_parked;
  update creature set hunger = 1, traits = '{}', skills = '{}' where world_id = w and id = v_loose;
  insert into said values ('SPEED', vehicle_speed(w, v_wagon)::text);
  insert into said select 'BOUNDS' || c.id, skill_gain_of(1, learns_gain_pull() * beast_mul(c, 'learn') * learn_pace(c, 'driving'), 0.6)
    || '|' || skill_gain_of(1, learns_gain_pull() * beast_mul(c, 'learn') * learn_pace(c, 'driving'), 1.4) from creature c where c.world_id = w and c.id in (r1, r2);

  -- Four tiles east.
  perform rpc_move(w, 24.5, 21.5, 0);
  insert into said select 'MOVED', x::text from player where world_id = w and uid = u;
  insert into said select 'AFTER' || c.id, coalesce(c.skills->>'driving', '-') || '|' || coalesce(c.skills->>'climbing', '-')
    from creature c where c.world_id = w and c.id in (r1, r2, o1, o2, v_parked, v_loose);
  insert into said values ('IDS', concat_ws('|', r1, r2, o1, o2, v_parked, v_loose));

  -- And a walk that goes nowhere.
  update player set moved_at = now() - interval '10 seconds' where world_id = w and uid = u;
  perform rpc_move(w, 24.5, 21.5, 0);
  insert into said select 'STILL', coalesce(c.skills->>'driving', '-') from creature c where c.world_id = w and c.id = r1;

  -- What the team is read off: a Roxxen's driving where an Orse's climbing is.
  update creature set skills = '{"driving": 60}' where world_id = w and id = r1;
  update creature set skills = '{"driving": 30}' where world_id = w and id = r2;
  update creature set skills = '{"climbing": 20}' where world_id = w and id = o1;
  update creature set skills = '{"climbing": 10}' where world_id = w and id = o2;
  insert into said values ('CLIMB', team_climb(w, v_wagon)::text);

  -- A Roxxen with climbing, one with both, and an Orse with climbing, carried over as the migration did.
  v_old := creature_spawn(w, 'roxxen', 30.5, 25.5, 'active', now() - interval '2 years', u);
  v_both := creature_spawn(w, 'roxxen', 31.5, 25.5, 'active', now() - interval '2 years', u);
  v_orse := creature_spawn(w, 'orse', 32.5, 25.5, 'active', now() - interval '2 years', u);
  update creature set skills = '{"climbing": 37.5}' where world_id = w and id = v_old;
  update creature set skills = '{"climbing": 12.25, "driving": 20}' where world_id = w and id = v_both;
  update creature set skills = '{"climbing": 41}' where world_id = w and id = v_orse;
  insert into said select 'LEVEL', creature_level(skills)::text from creature where world_id = w and id = v_old;
  ${carry ?? ''}
  insert into said select 'CARRIED', string_agg(skills::text || '@' || creature_level(skills), ' ' order by id)
    from creature where world_id = w and id in (v_old, v_both, v_orse);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const [r1, r2, o1, o2, parkedId, looseId] = (isle.get('IDS') ?? '').split('|');
const after = (id: string): [string, string] => (isle.get(`AFTER${id}`) ?? '-|-').split('|') as [string, string];
const moved = Number(isle.get('MOVED')) - 20.5;

check('on the island the wagon is pulled, and goes the four tiles', Number(isle.get('SPEED')) > 0 && moved === 4,
  `team pace ${isle.get('SPEED')}, ${moved} tiles`);
for (const [i, id] of [r1, r2].entries()) {
  const [lo, hi] = (isle.get(`BOUNDS${id}`) ?? '0|0').split('|').map(Number);
  const gained = Number(after(id)[0]) - 1;
  check(`on the island Roxxen ${i + 1} in the traces learns four goes of driving, one a tile, and no climbing`,
    gained >= 4 * lo * 0.999 && gained <= 4 * hi * 1.001 && after(id)[1] === '-',
    `driving ${after(id)[0]} (+${(4 * lo).toFixed(5)} to +${(4 * hi).toFixed(5)}), climbing ${after(id)[1]}`);
}
check('on the island the Orse beside them learn no driving', after(o1)[0] === '-' && after(o2)[0] === '-',
  `${after(o1).join('/')} and ${after(o2).join('/')}`);
check('on the island a Roxxen in the traces of a cart nobody drives, and one at heel, learn nothing',
  after(parkedId)[0] === '-' && after(looseId)[0] === '-', `${after(parkedId).join('/')} and ${after(looseId).join('/')}`);
check('on the island standing in the traces teaches nothing', isle.get('STILL') === after(r1)[0], `${after(r1)[0]} → ${isle.get('STILL')}`);
check('on the island a Roxxen\'s driving counts where another beast\'s climbing does, as in the browser',
  near(Number(isle.get('CLIMB')), (60 + 30 + 20 + 10) / 4), isle.get('CLIMB') ?? 'unsaid');
check('on the island a Roxxen keeps its level: its climbing is its driving, the higher where it had both, and an Orse is left be',
  isle.get('LEVEL') === '37'
    && isle.get('CARRIED') === '{"driving": 37.5}@37 {"driving": 20}@20 {"climbing": 41}@41',
  `level ${isle.get('LEVEL')} before; ${isle.get('CARRIED')}`);

console.log(ok.concat(bad).join('\n'));
console.log(`a roxxen learns driving in the traces — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
