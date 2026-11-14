/**
 * Work around me: a worker round you left behind comes to you.
 *
 * Reported: a Sapgnaw working round its keeper showed "Working around you · felling trees 9.8 · range 8 tiles" and
 * "Idle: walking to you, 98 tiles away." for good: "stuck on Working Near Me while walking back to his owner". Off
 * its ground it walked after its keeper two tiles a leg in a straight line, and with nothing open that way it stood
 * and looked again every four seconds, for as long as they stayed online. Asked of the island and of the browser:
 *
 *   * its keeper `AROUND_LEASH` tiles and more away: on their tile at once, working round them still;
 *   * a wood between them, nearer than that: on their tile at once, working round them still;
 *   * its keeper nearer than that with the way open: it walks, a leg at a time, saying "walking to you";
 *   * its keeper out on water with no land within `PIER_SHOO` of them: Work around me stops (`AROUND_LEFT`), and it
 *     follows them;
 *   * the island's leash and words are the browser's;
 *   * and its card names its task once: one "Working around you" line, no "no task" under it.
 *
 * The island half makes its own island and rolls it back.
 */
import { Game } from '../../src/game/game';
import { AROUND_ACTION_BY_ID } from '../../src/game/around';
import { AROUND_LEASH, AROUND_LEFT, HOME_SLACK, workRangeOf, SPECIES, type Creature } from '../../src/game/creatures';
import { PIER_SHOO } from '../../src/game/piers';
import { creatureLines } from '../../src/ui/creatureinfo';
import { TileType } from '../../src/world/tiles';
import { psql, check, finish } from './harness';

const U = '7e5b0000-0000-4000-8000-0000000a0b01';
const FAR = 100;
const NEAR = 25;
const WOOD = 3;

/* ---- the island ----------------------------------------------------------- */

const isle = new Map(psql(`
discard temp;
begin;
create temp table said (k text, v text);
-- Due, \`secs\` of the clock since its last settle, rested and fed.
create function pg_temp.run(w uuid, p_id int, secs double precision) returns void language plpgsql as $r$
begin
  update creature set until = now() - make_interval(secs => secs), settled_at = now() - make_interval(secs => secs),
         leg_at = now() - make_interval(secs => secs + 1), leg_ends = now() - make_interval(secs => secs), from_x = to_x, from_y = to_y,
         worn = 0, hunger = 1
   where world_id = w and id = p_id and mode = 'deed';
  perform worker_settle(w, p_id);
end $r$;
create function pg_temp.at(w uuid, u uuid, x double precision, y double precision) returns void language sql as $a$
  update player set x = $3, y = $4, body_at = now(), swim_at = now(), seen_at = now(), away = false where world_id = $1 and uid = $2;
$a$;
create function pg_temp.pet(w uuid, u uuid, x double precision, y double precision) returns int language plpgsql as $p$
declare v int; j jsonb;
begin
  perform pg_temp.at(w, u, x - 1, y);
  v := creature_spawn(w, 'rabba', x, y, 'active', now() - interval '60 days', u);
  update creature set traits = '{}', rare = null, form_size = null, name = 'Pip' where world_id = w and id = v;
  j := rpc_act(w, 'work_around', jsonb_build_object('kind', 'creature', 'id', v));
  if not coalesce((j->>'done')::boolean, false) then raise exception 'not set to work round its keeper: %', j; end if;
  return v;
end $p$;
create function pg_temp.row(w uuid, p_id int) returns text language sql as $s$
  select mode || '|' || coalesce(around->>'was', 'none') || '|' || round(to_x::numeric, 1) || '|' || round(to_y::numeric, 1)
         || '|' || coalesce(idle_why, '') || '|' || coalesce(round(idle_n::numeric, 1)::text, '')
    from creature where world_id = $1 and id = $2;
$s$;
do $t$
declare w uuid; u uuid := '${U}'; v_a int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Behind', 302, 240, 20, 20, true) returning id into w;
  perform land_blank(w, 240);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 239) x, generate_series(0, 239) y;
  -- A wood ${WOOD} tiles east of where the third is set to work, the height of the island below y 80; and the sea east
  -- of x 140 above it.
  perform land_set_tile(w, 20 + ${WOOD}, y, tile_id('Tree')) from generate_series(80, 239) y;
  perform land_set_height(w, x, y, -40) from generate_series(140, 239) x, generate_series(0, 79) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Keeper');
  insert into said values ('LEASH', around_leash()::text), ('LEFT', around_left()), ('SLACK', home_slack()::text);

  -- Its keeper ${FAR} tiles off over open grass.
  v_a := pg_temp.pet(w, u, 20.5, 20.5);
  perform pg_temp.at(w, u, 20.5 + ${FAR}, 20.5);
  perform pg_temp.run(w, v_a, 2);
  insert into said values ('FAR', pg_temp.row(w, v_a));
  delete from creature where world_id = w and id = v_a;

  -- ${NEAR} tiles off with the way open: it walks.
  v_a := pg_temp.pet(w, u, 20.5, 60.5);
  perform pg_temp.at(w, u, 20.5 + ${NEAR}, 60.5);
  perform pg_temp.run(w, v_a, 2);
  insert into said values ('WALK', pg_temp.row(w, v_a));
  delete from creature where world_id = w and id = v_a;

  -- ${NEAR} tiles off with the wood between.
  v_a := pg_temp.pet(w, u, 20.5, 100.5);
  perform pg_temp.at(w, u, 20.5 + ${NEAR}, 100.5);
  perform pg_temp.run(w, v_a, 30);
  insert into said values ('WOOD', pg_temp.row(w, v_a));
  delete from creature where world_id = w and id = v_a;

  -- Its keeper out on the sea, ${PIER_SHOO} tiles and more from any land.
  v_a := pg_temp.pet(w, u, 100.5, 20.5);
  perform pg_temp.at(w, u, 200.5, 40.5);
  perform pg_temp.run(w, v_a, 2);
  insert into said values ('SEA', pg_temp.row(w, v_a));
  insert into said select 'SEA_TOLD', string_agg(regexp_replace(text, 'Pip[0-9]*', 'Pip', 'g'), ' / ' order by n)
    from (select text, n from event where world_id = w and uid = u and text like 'Work around me stopped%' order by n desc limit 1) e;
end $t$;
select k || '=' || v from said;
rollback;
`).split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

const row = (k: string): { mode: string; was: string; x: number; y: number; why: string; n: number } => {
  const [mode, was, x, y, why, n] = (isle.get(k) ?? '').split('|');
  return { mode, was, x: Number(x), y: Number(y), why, n: Number(n) };
};

check('the island\'s leash and words are the browser\'s',
  Number(isle.get('LEASH')) === AROUND_LEASH && isle.get('LEFT') === AROUND_LEFT && Number(isle.get('SLACK')) === HOME_SLACK,
  `island ${isle.get('LEASH')} "${isle.get('LEFT')}" / browser ${AROUND_LEASH} "${AROUND_LEFT}"`);
{
  const r = row('FAR');
  check(`island: its keeper ${FAR} tiles off (past ${AROUND_LEASH}): on their tile, working round them, not walking`,
    r.mode === 'deed' && r.was === 'follow' && r.x === 20.5 + FAR && r.y === 20.5 && r.why !== 'far', isle.get('FAR'));
}
{
  const r = row('WALK');
  check(`island: ${NEAR} tiles off, the way open: walks a leg at a time, "walking to you"`,
    r.mode === 'deed' && r.was === 'follow' && r.x > 20.5 && r.x < 20.5 + NEAR - 10 && r.why === 'far', isle.get('WALK'));
}
{
  const r = row('WOOD');
  check(`island: ${NEAR} tiles off behind a wood: on their tile, working round them`,
    r.mode === 'deed' && r.was === 'follow' && r.x === 20.5 + NEAR && r.y === 100.5 && r.why !== 'far', isle.get('WOOD'));
}
{
  const r = row('SEA');
  check(`island: its keeper out on water, no land within ${PIER_SHOO} tiles: following them, "${AROUND_LEFT}: Pip follows you."`,
    r.mode === 'active' && r.was === 'none' && isle.get('SEA_TOLD') === `${AROUND_LEFT}: Pip follows you.`, `${isle.get('SEA')} / ${isle.get('SEA_TOLD')}`);
}

/* ---- the browser ---------------------------------------------------------- */

const work = AROUND_ACTION_BY_ID.get('work_around')!;
const fresh = (): Game => {
  const g = Game.create(302, 256);
  const w = g.world;
  w.water = null;
  w.heights.fill(10);
  w.tiles.fill(TileType.Grass);
  w.data.fill(0);
  for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
  g.deed = null;
  return g;
};
const pet = (g: Game, x: number, y: number): Creature => {
  g.player.x = x - 1;
  g.player.y = y;
  const c = g.creatures.spawn('rabba', x, y, 'active', () => 0.5, -1e9);
  c.traits = [];
  c.name = 'Pip';
  work.perform({ kind: 'creature', id: c.id }, g);
  return c;
};
const run = (g: Game, c: Creature, secs: number): void => {
  const stepper = g.creatures as unknown as { updateWorker(c: Creature, dt: number, game: Game): void };
  for (let t = 0; t < secs; t += 0.25) {
    g.time += 0.25;
    if (c.mode !== 'deed') return;
    c.hunger = 1;
    c.worn = 0;
    stepper.updateWorker(c, 0.25, g);
  }
};

{
  const g = fresh();
  const c = pet(g, 20.5, 20.5);
  g.player.x = 20.5 + FAR;
  run(g, c, 1);
  check(`browser: its keeper ${FAR} tiles off: on their tile, working round them`,
    c.mode === 'deed' && !!c.around && Math.hypot(c.x - g.player.x, c.y - g.player.y) < 1 && c.idle?.why !== 'far',
    `${c.mode} at ${c.x.toFixed(1)},${c.y.toFixed(1)} ${c.idle?.why ?? ''}`);
  // Its card: its task named once.
  const lines = creatureLines(g, c);
  const role = lines.filter((l) => l.startsWith('Working around you'));
  const range = workRangeOf(c, SPECIES.rabba);
  check('its card: one "Working around you" line, its task and range, and no "no task"',
    role.length === 1 && role[0].includes(`range ${range} tiles`) && !lines.some((l) => l.includes('no task')), role.join(' / '));
}
{
  const g = fresh();
  const c = pet(g, 20.5, 60.5);
  g.player.x = 20.5 + NEAR;
  run(g, c, 1);
  check(`browser: ${NEAR} tiles off, the way open: walks, "walking to you"`,
    c.mode === 'deed' && !!c.around && c.x > 20.5 && c.x < 20.5 + NEAR - 10 && c.idle?.why === 'far', `${c.x.toFixed(1)} ${c.idle?.why ?? ''}`);
}
{
  const g = fresh();
  for (let y = 0; y < 256; y++) g.world.setTile(20 + WOOD, y, TileType.Tree);
  const c = pet(g, 20.5, 100.5);
  g.player.x = 20.5 + NEAR;
  run(g, c, 30);
  check(`browser: ${NEAR} tiles off behind a wood: on their tile, working round them`,
    c.mode === 'deed' && !!c.around && c.x > 20 + WOOD, `${c.mode} at ${c.x.toFixed(1)},${c.y.toFixed(1)} ${c.idle?.why ?? ''}`);
}
{
  const g = fresh();
  for (let x = 140; x <= 256; x++) for (let y = 0; y <= 80; y++) g.world.setHeight(x, y, -40);
  const said: string[] = [];
  const logOf = g.logMsg.bind(g);
  g.logMsg = (m: string, k?: Parameters<typeof logOf>[1]) => {
    said.push(m);
    logOf(m, k);
  };
  const c = pet(g, 100.5, 20.5);
  g.player.x = 200.5;
  g.player.y = 40.5;
  run(g, c, 1);
  check(`browser: its keeper out on water: following them, "${AROUND_LEFT}: Pip follows you."`,
    c.mode === 'active' && !c.around && said.includes(`${AROUND_LEFT}: Pip follows you.`), `${c.mode} / ${said.slice(-1)[0]}`);
}

finish('Work around me: a worker round you left behind comes to you');
