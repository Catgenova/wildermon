/**
 * The Ironemole line mines any bare seam; a miner's idle line says what is wrong; a kind's range per step is its own.
 *
 * Asked for: "Remove ore level requirements for oremander line". Reported first: an Ironemole at mining 1 by bare rock
 * near the totem, its card "Idle: no bare rock with a seam in it within 8 tiles of the totem". Asked of the island and
 * of the browser, on a settlement on grass with a fathom of soil:
 *
 *   * an Ironemole at mining 1 mines a bare iron seam (mining 5 for anybody else);
 *   * a miner of another kind at mining 1 does not, and says so: "Idle: Iron vein 4 tiles from the totem needs mining 5
 *     (yours 1.0); copper vein and coal seam: 1.", with copper it takes;
 *   * nor do you: "Iron vein: needs mining 5";
 *   * bare rock with no seam in any of it: "Idle: no seam in the bare rock within 8 tiles of the totem.";
 *   * seams under soil only: "no bare rock with a seam in it", as before;
 *   * a kind's range per ten levels is its own on the island too: an Ironemole at mining 55 has 8 + 5 × 5 tiles.
 *
 * The island half makes its own island and rolls it back.
 */
import { Game } from '../../src/game/game';
import { GATHER_SKILL, RANGE_PER_STEP, SKILL_STEP, SPECIES, workRangeOf, type Creature } from '../../src/game/creatures';
import { idleSays } from '../../src/game/workerlog';
import { creatureLines } from '../../src/ui/creatureinfo';
import { ROCK_VARIANTS, TileType } from '../../src/world/tiles';
import { psql, check, finish } from './harness';

const U = '7e5b0000-0000-4000-8000-0000000a0e01';
const T = 40;
const IRON = ROCK_VARIANTS.findIndex((r) => r.yields === 'iron_ore');
const PLAIN = ROCK_VARIANTS.findIndex((r) => r.yields === 'rock_shards');
const IRON_LEVEL = ROCK_VARIANTS[IRON].level ?? 0;
// The other miner: a Quarra set to mining; any kind but the Ironemole's line.
const OTHER = 'quarra';

/* ---- the island ----------------------------------------------------------- */

const isle = new Map(psql(`
discard temp;
begin;
create temp table said (k text, v text);
create function pg_temp.bare(w uuid, x int, y int, rock int) returns void language plpgsql as $b$
declare dx int; dy int;
begin
  perform land_set_rock(w, x, y, rock);
  for dy in 0..1 loop for dx in 0..1 loop
    perform land_set_dirt(w, x + dx, y + dy, 0);
    perform reconcile_around(w, x + dx, y + dy);
  end loop; end loop;
end $b$;
create function pg_temp.run(w uuid, p_id int, n int) returns void language plpgsql as $r$
declare i int;
begin
  for i in 1..n loop
    update creature set until = now() - interval '60 seconds', settled_at = now() - interval '60 seconds',
           leg_at = now() - interval '61 seconds', leg_ends = now() - interval '60 seconds', from_x = to_x, from_y = to_y,
           worn = 0, hunger = 1
     where world_id = w and id = p_id and mode = 'deed';
    perform worker_settle(w, p_id);
  end loop;
end $r$;
create function pg_temp.mole(w uuid, u uuid, kind text, skill double precision) returns int language plpgsql as $m$
declare v int; j jsonb;
begin
  v := creature_spawn(w, kind, ${T}.5, ${T}.5, 'active', now() - interval '60 days', u);
  update creature set traits = '{}', rare = null, form_size = null, name = 'Pip',
         skills = jsonb_build_object('mining', skill) where world_id = w and id = v;
  j := rpc_act(w, 'assign_deed', jsonb_build_object('kind', 'creature', 'id', v));
  update creature set job = 'mine' where world_id = w and id = v;
  return v;
end $m$;
create function pg_temp.idle(w uuid, p_id int) returns text language sql as $i$
  select coalesce(idle_why, '') || '|' || coalesce(round(idle_n::numeric)::text, '') || '|' || coalesce(array_to_string(idle_what, ','), '')
    from creature where world_id = $1 and id = $2;
$i$;
do $t$
declare w uuid; u uuid := '${U}'; v_m int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Seams', 305, 120, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 120);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 119) x, generate_series(0, 119) y;
  perform land_set_height(w, x, y, 50) from generate_series(0, 120) x, generate_series(0, 120) y;
  perform land_set_dirt(w, x, y, 14) from generate_series(0, 120) x, generate_series(0, 120) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Keeper');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Seamstead', ${T}, ${T}, 15, 5, u);
  update player set x = ${T}.5, y = ${T + 1}.5, body_at = now(), seen_at = now() where world_id = w and uid = u;
  insert into said values ('ANY', (select string_agg(id, ',' order by id) from species_def where any_seam)),
                          ('PER_STEP', (select string_agg(id || ':' || range_per_step, ',' order by id) from species_def where range_per_step is not null)),
                          ('PER_STEP_DEFAULT', range_per_step()::text), ('SKILL_STEP', skill_step()::text);

  -- Seams under the soil only.
  perform land_set_rock(w, ${T + 4}, ${T}, ${IRON});
  v_m := pg_temp.mole(w, u, 'mola', 1);
  perform pg_temp.run(w, v_m, 1);
  insert into said values ('BURIED', pg_temp.idle(w, v_m));
  delete from creature where world_id = w and id = v_m;

  -- Bare plain rock only.
  perform pg_temp.bare(w, ${T}, ${T + 4}, ${PLAIN});
  v_m := pg_temp.mole(w, u, 'mola', 1);
  perform pg_temp.run(w, v_m, 1);
  insert into said values ('NOSEAM', pg_temp.idle(w, v_m));
  delete from creature where world_id = w and id = v_m;

  -- And the iron dug down to: another kind at mining 1 does not take it, and says so.
  perform pg_temp.bare(w, ${T + 4}, ${T}, ${IRON});
  v_m := pg_temp.mole(w, u, '${OTHER}', 1);
  perform pg_temp.run(w, v_m, 1);
  insert into said values ('OTHER', pg_temp.idle(w, v_m));
  insert into said select 'OTHER_MAY', worker_gatherable(w, ${T + 4}, ${T}, 'mine', c)::text from creature c where world_id = w and id = v_m;
  insert into said select 'OTHER_SENT', coalesce(e->>'idleWhy', '') || '|' || coalesce(e->'idleWhat'->>0, '')
    from jsonb_array_elements(rpc_creatures(w, 40)) e where (e->>'id')::int = v_m;
  delete from creature where world_id = w and id = v_m;
  -- Nor do you, beside it.
  perform give(w, u, 'pickaxe', 1, 40, null);
  update player set x = ${T + 3}.5, y = ${T}.5 where world_id = w and uid = u;
  insert into said values ('YOU', coalesce(act_refusal(w, u, 'mine', jsonb_build_object('kind', 'tile', 'x', ${T + 4}, 'y', ${T}, 'cx', ${T + 4}, 'cy', ${T})), 'none'));

  -- An Ironemole at mining 1 does.
  update player set x = ${T}.5, y = ${T + 1}.5 where world_id = w and uid = u;
  v_m := pg_temp.mole(w, u, 'mola', 1);
  insert into said select 'MOLE_MAY', worker_gatherable(w, ${T + 4}, ${T}, 'mine', c)::text from creature c where world_id = w and id = v_m;
  perform pg_temp.run(w, v_m, 4);
  insert into said select 'MOLE', coalesce(carrying->>'def', '') || '|' || coalesce((ledger->'now'->>'goes'), '0') || '|' || coalesce(idle_why, '')
    from creature where world_id = w and id = v_m;
  -- And its range at mining 55, as the island searches it.
  update creature set skills = jsonb_build_object('mining', 55) where world_id = w and id = v_m;
  insert into said select 'RANGE55', work_range(c)::text from creature c where world_id = w and id = v_m;
end $t$;
select k || '=' || v from said;
rollback;
`).split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

const said = (k: string): string[] => (isle.get(k) ?? '').split('|');

/* ---- the browser ---------------------------------------------------------- */

const fresh = (): Game => {
  const g = Game.create(305, 120);
  const w = g.world;
  w.water = null;
  w.heights.fill(50);
  w.tiles.fill(TileType.Grass);
  w.data.fill(0);
  w.dirt.fill(14);
  for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
  g.deed = { name: 'Seamstead', x: T, y: T, radius: 15, level: 5 } as typeof g.deed;
  g.player.x = T + 0.5;
  g.player.y = T + 1.5;
  return g;
};
const buried = (g: Game, x: number, y: number, rock: number): void => {
  g.world.rockKind(x, y);
  g.world.rock[y * g.world.w + x] = rock;
};
const bare = (g: Game, x: number, y: number, rock: number): void => {
  buried(g, x, y, rock);
  g.world.setTile(x, y, TileType.Rock, rock);
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) g.world.dirt[(y + dy) * g.world.cw + x + dx] = 0;
};
const mole = (g: Game, kind: string, skill: number): Creature => {
  const c = g.creatures.spawn(kind, T + 0.5, T + 0.5, 'deed', () => 0.5, -1e9);
  c.traits = [];
  c.name = 'Pip';
  c.skills = { [GATHER_SKILL.mine]: skill };
  c.trade = 'mine';
  return c;
};
const run = (g: Game, c: Creature, secs: number): void => {
  const stepper = g.creatures as unknown as { updateWorker(c: Creature, dt: number, game: Game): void };
  for (let t = 0; t < secs; t += 0.25) {
    g.time += 0.25;
    c.hunger = 1;
    c.worn = 0;
    stepper.updateWorker(c, 0.25, g);
  }
};
const line = (c: Creature): string => (c.idle ? idleSays(c.idle, 'mine', null, c.skills[GATHER_SKILL.mine]) : '');

const range1 = workRangeOf({ skills: { mining: 1 }, species: 'mola' } as unknown as Creature, SPECIES.mola);
const ironSays = idleSays({ why: 'seam', n: 4, what: ['iron_ore'] }, 'mine', null, 1);

// The defs: one rule on both sides.
{
  const per = Object.values(SPECIES).filter((d) => d.rangePerStep !== undefined).map((d) => `${d.id}:${d.rangePerStep}`).sort().join(',');
  check('a kind\'s range per step is in the defs the island reads, the same as the browser\'s',
    isle.get('PER_STEP') === per && Number(isle.get('PER_STEP_DEFAULT')) === RANGE_PER_STEP && Number(isle.get('SKILL_STEP')) === SKILL_STEP,
    `island ${isle.get('PER_STEP')} / browser ${per}`);
  check('the Ironemole\'s line, and only it, takes any seam, in the defs', isle.get('ANY') === 'mola' && !!SPECIES.mola.anySeam, isle.get('ANY'));
  const want = SPECIES.mola.workRange + Math.floor(55 / SKILL_STEP) * (SPECIES.mola.rangePerStep ?? RANGE_PER_STEP);
  check(`an Ironemole at mining 55: range ${want} tiles, on both sides`,
    Number(isle.get('RANGE55')) === want && workRangeOf({ skills: { mining: 55 }, species: 'mola' } as unknown as Creature, SPECIES.mola) === want,
    `island ${isle.get('RANGE55')} / browser ${want}`);
}

// Seams under the soil only.
{
  const g = fresh();
  buried(g, T + 4, T, IRON);
  const c = mole(g, 'mola', 1);
  run(g, c, 2);
  check('seams under soil only: "no bare rock with a seam in it", on both sides',
    c.idle?.why === 'range' && said('BURIED')[0] === 'range' && line(c).includes('no bare rock with a seam in it'), `${isle.get('BURIED')} / "${line(c)}"`);
}
// Bare rock, no seam.
{
  const g = fresh();
  bare(g, T, T + 4, PLAIN);
  const c = mole(g, 'mola', 1);
  run(g, c, 2);
  const says = idleSays({ why: 'noseam', n: range1 }, 'mine');
  check(`bare rock and no seam in it: "${says}", on both sides`,
    c.idle?.why === 'noseam' && said('NOSEAM')[0] === 'noseam' && Number(said('NOSEAM')[1]) === range1 && line(c) === says, `${isle.get('NOSEAM')} / "${line(c)}"`);
}
// Another kind at mining 1 by bare iron.
{
  const g = fresh();
  bare(g, T + 4, T, IRON);
  const c = mole(g, OTHER, 1);
  run(g, c, 2);
  check(`another miner (${OTHER}) at mining 1 by bare iron: not taken, "${ironSays}", on both sides`,
    isle.get('OTHER_MAY') === 'false' && isle.get('OTHER') === 'seam|4|iron_ore' && c.idle?.why === 'seam'
      && line(c) === ironSays && !c.carrying,
    `island ${isle.get('OTHER')} / browser "${line(c)}"`);
  check('and the browser is sent its seam', isle.get('OTHER_SENT') === 'seam|iron_ore', isle.get('OTHER_SENT'));
  check(`and its card says it: "${ironSays}"`, creatureLines(g, c).includes(ironSays), creatureLines(g, c).join(' / '));
  check(`nor you at mining 1: "needs mining ${IRON_LEVEL}"`, (isle.get('YOU') ?? '').includes(`needs mining ${IRON_LEVEL}`), isle.get('YOU'));
}
// An Ironemole at mining 1 by bare iron.
{
  const g = fresh();
  bare(g, T + 4, T, IRON);
  const c = mole(g, 'mola', 1);
  run(g, c, 120);
  const [held, goes] = said('MOLE');
  check(`an Ironemole at mining 1 mines bare iron (mining ${IRON_LEVEL} for anybody else), on both sides`,
    isle.get('MOLE_MAY') === 'true' && (held === 'iron_ore' || Number(goes) > 0) && (c.carrying?.id === 'iron_ore' || (c.ledger?.now?.goes ?? 0) > 0),
    `island ${isle.get('MOLE_MAY')} ${isle.get('MOLE')} / browser ${c.carrying?.id ?? 'empty'} ${c.idle?.why ?? ''}`);
}

finish('The Ironemole line mines any bare seam; a miner says why it is idle');
