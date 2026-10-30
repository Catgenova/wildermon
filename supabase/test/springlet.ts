/**
 * The Springlet: a water mount, slow on land, a hare's pace in water, found only in deep water.
 *
 * Asked: "Add a new wildermon line. This is a water mount that walks very slowly on land (unmounted player walking
 * speed .5) but operates same speed as a hare mount when swimming in water. Rarely found, only spawns in deep water.
 * Eats fish. Requires saddle and bridle to mount like land mount". On both sides, on a strip of ground with deep sea
 * beside it:
 *
 *   * ridden on land it goes at half a walker's pace (`BASE_SPEED`), flat;
 *   * ridden in water it goes at what a Thistlekit (`orse`) in the same state goes at on land, worked or green;
 *   * the island's walk check holds a rider to those paces: the land pace on land, the water pace in water;
 *   * it takes a rider into deep water, and a Thistlekit does not;
 *   * the wild puts it down in deep water only, its wild legs keep to it, and it is the rarest weight in the table;
 *   * it eats fish, and it needs a saddle and a bridle to be ridden.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
// `game` first: the root of the module graph, so nothing below comes out half-built.
import { Game } from '../../src/game/game';
import { ageDef, deepTile, footing, HAUL_SKILL, MONSTER_SHARE, SPECIES, SPRINGLET_LAND, waterOver, WILD_SPECIES, type Creature } from '../../src/game/creatures';
import { FISH } from '../../src/game/fishing';
import { wildShare } from '../../src/game/guide';
import { BASE_SPEED } from '../../src/game/player';
import { TileType } from '../../src/world/tiles';

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
/** Equal but for a `real` column's rounding. */
const near = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));

/*
 * The strip, the same on both sides: corners west of `SHORE` at `LAND` and the rest at `SEA`, so the tiles up to
 * `SHORE - 1` are dry ground, and every tile from `SHORE` east has water over it deeper than a swimmer's depth.
 */
const X0 = 2, X1 = 60, Y0 = 15, Y1 = 27, SHORE = 22, LAND = 4, SEA = -20, ROW = 21;
const LAND_PACE = SPRINGLET_LAND * BASE_SPEED;
const WORKED = 55;
const GAP = 5;

check('its own speed, unridden, is half a walker\'s pace', near(SPECIES.springlet.speed, BASE_SPEED / 2) && SPRINGLET_LAND === 0.5, `${SPECIES.springlet.speed}`);
check('its water pace is a Thistlekit\'s speed', SPECIES.springlet.swimSpeed === SPECIES.orse.speed, `${SPECIES.springlet.swimSpeed}`);

/* ---- the island ------------------------------------------------------------------------ */

const IVAR = `(select uid from player where world_id = (select id from world where name = 'Faraway') and name = 'Ivar')`;
const out = psql(`
begin;
create temp table said (k text, v text);
select set_config('request.jwt.claims', json_build_object('sub', ${IVAR})::text, true) \\g /dev/null
do $t$
declare w uuid; u uuid; gx int; gy int; v_s int; v_o int; v_wild int; i int; v_bad int := 0; v_moved int := 0;
        v_found int := 0; v_off int := 0; r record; v_x double precision; v_y double precision; v_mis int := 0; v_said jsonb;
begin
  select id into w from world where name = 'Faraway';
  select uid into u from player where world_id = w and name = 'Ivar';
  for gx in ${X0}..${X1} loop for gy in ${Y0}..${Y1} loop
    perform land_set_height(w, gx, gy, case when gx <= ${SHORE} then ${LAND} else ${SEA} end);
    perform land_set_tile(w, gx, gy, case when gx < ${SHORE} then tile_id('Grass') else tile_id('Sand') end);
  end loop; end loop;
  delete from creature where world_id = w and species = 'springlet';
  update creature set rider = null where world_id = w and rider = u;
  delete from placed where world_id = w and driver = u;
  update player set x = ${SHORE - 2}.5, y = ${ROW}.5, level = 0, aboard = null, away = false, walk_ahead = 0,
         moved_at = now() - interval '${GAP} seconds', body_at = now() where world_id = w and uid = u;

  insert into said values ('OVER', water_over(w, ${SHORE - 1}, ${ROW}) || '|' || water_over(w, ${SHORE}, ${ROW}));
  insert into said values ('DEEP', deep_tile(w, ${SHORE - 1}, ${ROW}) || '|' || deep_tile(w, ${SHORE}, ${ROW}) || '|' || deep_tile(w, ${SHORE + 5}, ${ROW}));

  -- A Springlet and a Thistlekit, grown, in the same state: no blood, no skills, fed, no tack.
  v_s := creature_spawn(w, 'springlet', ${SHORE - 2}.5, ${ROW}.5, 'active', now() - interval '60 days', u);
  v_o := creature_spawn(w, 'orse', ${SHORE - 2}.5, ${ROW}.5, 'active', now() - interval '60 days', u);
  update creature set traits = '{}', skills = '{}', hunger = 1, rare = null, pedigree = null, boosts = null, form_size = null,
         kept = null, tack = null, tack_enchant = null, tacked = false, shod_at = null where world_id = w and id in (v_s, v_o);
  insert into said select 'AGE', (age_row(c.born, old_of(c), age_pace(c))).speed::text from creature c where c.world_id = w and c.id = v_s;

  -- Saddle and bridle: refused bare, allowed tacked.
  insert into said values ('BARE', coalesce(ride_refusal(w, u, 'mount_creature', jsonb_build_object('id', v_s)), '-'));
  update creature set tacked = true where world_id = w and id in (v_s, v_o);
  insert into said values ('TACKED', coalesce(ride_refusal(w, u, 'mount_creature', jsonb_build_object('id', v_s)), '-'));

  -- Green: on land, in water, and the Thistlekit on land.
  update creature set rider = u where world_id = w and id = v_s;
  insert into said values ('LAND', travel_speed(w, u)::text);
  update player set x = ${SHORE + 8}.5 where world_id = w and uid = u;
  insert into said values ('WATER', travel_speed(w, u)::text);
  update creature set rider = null where world_id = w and id = v_s;
  update creature set rider = u where world_id = w and id = v_o;
  update player set x = ${SHORE - 2}.5 where world_id = w and uid = u;
  insert into said values ('ORSE', travel_speed(w, u)::text);
  update creature set rider = null where world_id = w and id = v_o;

  -- Worked: climbing to its third stage, and half fed.
  update creature set skills = jsonb_build_object('climbing', ${WORKED}), hunger = 0.5 where world_id = w and id in (v_s, v_o);
  update creature set rider = u where world_id = w and id = v_s;
  insert into said values ('WLAND', travel_speed(w, u)::text);
  update player set x = ${SHORE + 8}.5 where world_id = w and uid = u;
  insert into said values ('WWATER', travel_speed(w, u)::text);
  update creature set rider = null where world_id = w and id = v_s;
  update creature set rider = u where world_id = w and id = v_o;
  update player set x = ${SHORE - 2}.5 where world_id = w and uid = u;
  insert into said values ('WORSE', travel_speed(w, u)::text);
  update creature set rider = null where world_id = w and id = v_o;
  update creature set skills = '{}', hunger = 1 where world_id = w and id = v_s;

  -- The walk check: on land, a land pace's walk stands and a water pace's is pulled back; in water a water pace's stands.
  update creature set rider = u where world_id = w and id = v_s;
  update player set x = ${SHORE - 1}.5, walk_ahead = 0, moved_at = now() - interval '${GAP} seconds' where world_id = w and uid = u;
  v_said := rpc_move(w, ${SHORE - 1}.5 - travel_speed(w, u) * ${GAP}, ${ROW}.5, 0);
  insert into said select 'LANDWALK', (v_said->>'pulled') || '|' || x from player where world_id = w and uid = u;
  update player set x = ${SHORE - 1}.5, walk_ahead = 0, moved_at = now() - interval '${GAP} seconds' where world_id = w and uid = u;
  v_said := rpc_move(w, ${SHORE - 1}.5 - ${SPECIES.orse.speed * footing(0)} * ${GAP}, ${ROW}.5, 0);
  insert into said select 'LANDFAST', (v_said->>'pulled') || '|' || x from player where world_id = w and uid = u;
  update player set x = ${SHORE + 4}.5, walk_ahead = 0, moved_at = now() - interval '${GAP} seconds' where world_id = w and uid = u;
  -- (Its climbing has come up a little under the walks above, which its water pace reads.)
  insert into said values ('SWIMPACE', travel_speed(w, u)::text);
  v_said := rpc_move(w, ${SHORE + 4}.5 + travel_speed(w, u) * ${GAP}, ${ROW}.5, 0);
  insert into said select 'SWIM', (v_said->>'pulled') || '|' || x from player where world_id = w and uid = u;
  update creature set rider = null where world_id = w and id = v_s;

  -- What it eats, its weight in the wild, and what the island keeps of it.
  insert into said select 'DIET', string_agg(item, ',' order by item) from species_diet where species = 'springlet';
  insert into said select 'WEIGHT', weight::text from wild_table where species = 'springlet';
  insert into said select 'SHARE', ((select weight from wild_table where species = 'springlet')
    / (select sum(weight) from wild_table where not monster) * (1 - monster_share()))::text;
  insert into said select 'LEAST', (select min(weight) from wild_table where not monster)::text;
  insert into said select 'SWIMS', string_agg(id || ':' || swims, ',' order by id) from species_def where id in ('springlet', 'orse');
  insert into said select 'LEVEL', level_skill('springlet');

  -- Where it suits: deep water and nothing else, tile by tile across the strip.
  for gx in ${X0}..${X1 - 1} loop
    if suits(w, 'springlet', gx, ${ROW}) <> deep_tile(w, gx, ${ROW}) then v_mis := v_mis + 1; end if;
    if suits(w, 'springlet', gx, ${ROW}) and gx < ${SHORE} then v_mis := v_mis + 1; end if;
  end loop;
  insert into said values ('SUITS', v_mis::text);
  -- A place looked for on a roll that landed on dry ground: two hundred looks, every one found in deep water.
  for i in 1..200 loop
    select s.x, s.y into v_x, v_y from site_for(w, ${X0}, ${Y0}, ${X1 - X0}, ${Y1 - Y0}, 'springlet', 8) s;
    if v_x is not null then
      v_found := v_found + 1;
      if not deep_tile(w, v_x::int, v_y::int) then v_off := v_off + 1; end if;
    end if;
    v_x := null;
  end loop;
  insert into said values ('SITES', v_found || '|' || v_off);

  -- Wild, at the edge of the deep water: sixty rounds of its legs, never once onto a tile that is not deep.
  v_wild := creature_spawn(w, 'springlet', ${SHORE}.5, ${ROW}.5, 'wild', now() - interval '60 days');
  for i in 1..60 loop
    update creature set until = now() - interval '1 minute', settled_at = now() - interval '1 second'
      where world_id = w and id = v_wild;
    perform creature_settle(w, v_wild);
    select * into r from creature where world_id = w and id = v_wild;
    if not deep_tile(w, floor(r.to_x)::int, floor(r.to_y)::int) then v_bad := v_bad + 1; end if;
    if r.to_x <> ${SHORE}.5 or r.to_y <> ${ROW}.5 then v_moved := v_moved + 1; end if;
  end loop;
  insert into said values ('LEGS', v_bad || '|' || v_moved);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const say = (k: string): string => isle.get(k) ?? 'unsaid';

check('on the island, in water is any water over the bed, and deep water past a swimmer\'s depth',
  say('OVER') === 'false|true' && say('DEEP') === 'false|true|true', `${say('OVER')}; ${say('DEEP')}`);
check('on the island it needs a saddle and a bridle to be mounted', say('BARE').includes('no saddle and bridle') && say('TACKED') === '-',
  `${say('BARE')} / ${say('TACKED')}`);
const age = Number(say('AGE'));
check(`on the island, ridden on land: half a walker's pace, ${LAND_PACE.toFixed(3)} tiles a second`, near(Number(say('LAND')), LAND_PACE), say('LAND'));
check('and worked, half fed, the same: flat', near(Number(say('WLAND')), LAND_PACE), say('WLAND'));
check(`on the island, ridden in water: a Thistlekit's pace in the same state, ${(SPECIES.orse.speed * footing(0) * age).toFixed(2)} green`,
  near(Number(say('WATER')), Number(say('ORSE'))) && near(Number(say('WATER')), SPECIES.orse.speed * footing(0) * age), `${say('WATER')} vs ${say('ORSE')}`);
check('and worked to its third stage, half fed: still a Thistlekit\'s', near(Number(say('WWATER')), Number(say('WORSE'))) && Number(say('WWATER')) > Number(say('WATER')) * 0.5,
  `${say('WWATER')} vs ${say('WORSE')}`);
const [landPulled, landX] = say('LANDWALK').split('|');
check(`on the island, a land pace's walk on land stands (${GAP} seconds)`, landPulled === 'false' && near(Number(landX), SHORE - 1 + 0.5 - Number(say('LAND')) * GAP), say('LANDWALK'));
const [fastPulled, fastX] = say('LANDFAST').split('|');
check('and a water pace\'s walk on land is pulled back to well short of it', fastPulled === 'true' && SHORE - 0.5 - Number(fastX) < SPECIES.orse.speed * footing(0) * GAP / 2, say('LANDFAST'));
const [swimPulled, swimX] = say('SWIM').split('|');
check(`and a water pace's walk in water stands (${GAP} seconds)`, swimPulled === 'false' && Number(say('SWIMPACE')) >= Number(say('WATER'))
  && near(Number(swimX), SHORE + 4.5 + Number(say('SWIMPACE')) * GAP), `${say('SWIM')} at ${say('SWIMPACE')}`);
check('on the island it eats every fish a line brings up, and cooked fish',
  say('DIET') === [...FISH.map((f) => f.id), 'cooked_fish'].sort().join(','), say('DIET'));
check('on the island it swims with a rider, and a Thistlekit does not', say('SWIMS') === 'orse:false,springlet:true', say('SWIMS'));
check('on the island its level is climbing, learned under a rider', say('LEVEL') === HAUL_SKILL, say('LEVEL'));
check('on the island it suits deep water on the strip and nothing else', say('SUITS') === '0', say('SUITS'));
const [found, off] = say('SITES').split('|').map(Number);
check('on the island a place looked for it is deep water every time', found > 50 && off === 0, say('SITES'));
const [legsOff, legsMoved] = say('LEGS').split('|').map(Number);
check('on the island its wild legs keep to deep water', legsOff === 0 && legsMoved > 10, say('LEGS'));
const weight = WILD_SPECIES.find(([id]) => id === 'springlet')?.[1];
check('it is the rarest weight in the wild table, on both sides', weight === 1 && Number(say('WEIGHT')) === weight
  && Number(say('LEAST')) === Math.min(...WILD_SPECIES.map(([, n]) => n)), `${weight}, island ${say('WEIGHT')}`);
check(`and its share of the wild's roll is 1 in ${Math.round(1 / wildShare(SPECIES.springlet))} on both sides`,
  near(Number(say('SHARE')), wildShare(SPECIES.springlet)) && near(wildShare(SPECIES.springlet), weight! / WILD_SPECIES.reduce((n, [, w]) => n + w, 0) * (1 - MONSTER_SHARE)),
  `${say('SHARE')} vs ${wildShare(SPECIES.springlet)}`);

/* ---- in the browser --------------------------------------------------------------------- */
{
  const g = Game.create(5151);
  for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
  // The same strip, somewhere on its island.
  const BX = 300, BY = 300;
  for (let gx = X0; gx <= X1; gx++) for (let gy = Y0; gy <= Y1; gy++) g.world.setHeight(BX + gx, BY + gy, gx <= SHORE ? LAND : SEA);
  for (let gx = X0; gx < X1; gx++) for (let gy = Y0; gy < Y1; gy++) g.world.setTile(BX + gx, BY + gy, gx < SHORE ? TileType.Grass : TileType.Sand);
  const at = (gx: number): void => {
    g.player.x = BX + gx + 0.5;
    g.player.y = BY + ROW + 0.5;
  };
  check('in the browser, in water is any water over the bed, and deep water past a swimmer\'s depth',
    !waterOver(g.world, BX + SHORE - 1, BY + ROW) && waterOver(g.world, BX + SHORE, BY + ROW)
    && !deepTile(g, BX + SHORE - 1, BY + ROW) && deepTile(g, BX + SHORE, BY + ROW) && deepTile(g, BX + SHORE + 5, BY + ROW));

  const born = g.time - 3600 * 24 * 60;
  const plain = (c: Creature): Creature => {
    c.traits = [];
    c.skills = {};
    c.hunger = 1;
    // And none of the rest a spawn may roll: a rarity, a size form, a line.
    c.rare = 0;
    c.formSize = undefined;
    c.pedigree = null;
    c.boosts = undefined;
    return c;
  };
  const s = plain(g.creatures.spawn('springlet', BX + SHORE - 1.5, BY + ROW + 0.5, 'active', g.rand, born));
  const o = plain(g.creatures.spawn('orse', BX + SHORE - 1.5, BY + ROW + 0.5, 'active', g.rand, born));
  at(SHORE - 2);
  check('in the browser it needs a saddle and a bridle to be mounted', !g.mount(s) && ((s.tacked = true), g.mount(s)));
  g.dismount();

  at(SHORE - 2);
  const land = g.mountSpeed(s);
  at(SHORE + 8);
  const water = g.mountSpeed(s);
  at(SHORE - 2);
  const orse = g.mountSpeed(o);
  check(`in the browser, ridden on land: half a walker's pace, ${LAND_PACE.toFixed(3)} tiles a second`, land === LAND_PACE, `${land}`);
  // The island's grown one and the browser's are each as old as their own clocks make them: its age's pace taken out.
  const bAge = ageDef(s, g.time).speed;
  check('in the browser, ridden in water: a Thistlekit\'s pace in the same state, the island\'s for its age',
    water === orse && near(water / bAge, Number(say('WATER')) / age), `${water} vs ${orse}; island ${say('WATER')} at age pace ${age}, here ${bAge}`);
  for (const c of [s, o]) {
    c.skills = { [HAUL_SKILL]: WORKED };
    c.hunger = 0.5;
  }
  at(SHORE - 2);
  const wland = g.mountSpeed(s);
  at(SHORE + 8);
  const wwater = g.mountSpeed(s);
  at(SHORE - 2);
  const worse = g.mountSpeed(o);
  check('and worked, half fed: flat on land, a Thistlekit\'s in water', wland === LAND_PACE && wwater === worse, `${wland}; ${wwater} vs ${worse}`);
  check('and both sides agree on the worked water pace, for its age', near(wwater / bAge, Number(say('WWATER')) / age), `${wwater} vs ${say('WWATER')}`);

  // Into deep water with a rider: from deep water to deep water, a Springlet goes and a Thistlekit does not.
  s.skills = {};
  o.tacked = true;
  at(SHORE + 8);
  g.mount(s);
  const swims = g.rideRule(BX + SHORE + 8, BY + ROW, 0, BX + SHORE + 9, BY + ROW);
  g.dismount();
  g.mount(o);
  const wades = g.rideRule(BX + SHORE + 8, BY + ROW, 0, BX + SHORE + 9, BY + ROW);
  g.dismount();
  check('in the browser it takes a rider into deep water, and a Thistlekit does not', swims === 0 && wades === null, `${swims} / ${wades}`);

  // Put down wild: fifty of them, every one in deep water.
  for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
  const placed = g.creatures.spawnSpecies(g, 'springlet', 50, 0);
  const wild = [...g.creatures.list.values()].filter((c) => c.species === 'springlet');
  const dry = wild.filter((c) => !deepTile(g, Math.floor(c.x), Math.floor(c.y)));
  check('in the browser the wild puts it down in deep water only', placed > 20 && wild.length === placed && !dry.length, `${placed} placed, ${dry.length} not in deep water`);
  check('in the browser it suits deep water on the strip and nothing else', Array.from({ length: X1 - X0 }, (_, i) => X0 + i)
    .every((gx) => g.creatures.suits(g, SPECIES.springlet, BX + gx, BY + ROW) === deepTile(g, BX + gx, BY + ROW)));
  check('in the browser it eats every fish a line brings up, and cooked fish',
    FISH.every((f) => SPECIES.springlet.diet.includes(f.id)) && SPECIES.springlet.diet.includes('cooked_fish') && SPECIES.springlet.baitHint === 'fish');
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`the Springlet — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
