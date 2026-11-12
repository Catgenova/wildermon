/**
 * Haulers take shoes, at half a mount's.
 *
 * Asked for: "Allow shoeing haulers at half bonus". A draught beast takes shoes as a mount does, and in a vehicle's
 * traces a shod beast is worth `HAUL_SHOE_SHARE` of a mount's shoes, at its share of the team: that share of
 * `SHOE_PACE`'s gain on laid stone and of `SHOE_STEP`.
 *
 * Asks that the share is the browser's on the island; that in the browser a Cartling can be shod, and a large cart
 * with one shod Cartling of two goes the right shade quicker on cobblestone, no quicker on grass, and steps the right
 * shade higher; and on the island, in a rolled-back transaction, that the shoeing act no longer refuses a Cartling and
 * that the same cart's pace and step move by the same shares.
 *
 * Runs against the database the suite leaves behind: Faraway, and Ivar on it.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { HAUL_SHOE_SHARE, SHOE_PACE, SHOE_STEP, SHOES_PER_MOUNT, SPECIES, shoeable, type Creature } from '../../src/game/creatures';
import { CREATURE_ACTION_BY_ID } from '../../src/game/creatureActions';
import { TileType } from '../../src/world/tiles';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
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
const near = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) <= eps;

/* ---- the rule, on both sides ---------------------------------------------- */

check('haul_shoe_share is the browser\'s on the island', Number(psql('select haul_shoe_share()')) === HAUL_SHOE_SHARE,
  `${psql('select haul_shoe_share()')} vs ${HAUL_SHOE_SHARE}`);
check('a Cartling, a mount and a pet: shoes for the first two only',
  shoeable(SPECIES.roxxen) && shoeable(SPECIES.orse) && !shoeable(SPECIES.rabba));

// With one of two shod: the pace on laid stone and the step move by half a mount's shoes, at half the team.
const PACE = 1 + (SHOE_PACE - 1) * HAUL_SHOE_SHARE * 0.5;
const STEP = SHOE_STEP * HAUL_SHOE_SHARE * 0.5;

/* ---- the browser --------------------------------------------------------- */

{
  const g = Game.create(4848);
  for (const f of [...g.furniture.values()]) g.removeFurniture(f.id);
  const px = Math.floor(g.player.x), py = Math.floor(g.player.y);
  const grown = g.time - 3600 * 24 * 60;
  const beast = (x: number, y: number): Creature => {
    const c = g.creatures.spawn('roxxen', x, y, 'active', g.rand, grown);
    c.hunger = 1;
    c.traits = [];
    c.skills = {};
    return c;
  };

  // The shoeing act, on a Cartling at heel.
  const heel = beast(px + 0.5, py + 1.5);
  g.inventory.add('horseshoe', { ql: 40, count: SHOES_PER_MOUNT });
  g.inventory.add('mallet', { ql: 40 });
  const shoe = CREATURE_ACTION_BY_ID.get('shoe_creature');
  if (!shoe) throw new Error('shoe_creature is missing');
  const at = { kind: 'creature' as const, id: heel.id };
  check('in the browser a grown Cartling within reach can be shod', shoe.applies(at, g) && !shoe.check?.(at, g),
    shoe.check?.(at, g) ?? 'nothing in the way');
  shoe.perform(at, g);
  check('and it is', heel.shodAt === g.time && g.inventory.count('horseshoe') === 0, `shod at ${heel.shodAt}, ${g.inventory.count('horseshoe')} shoes left`);

  // A large cart with two Cartlings in its yokes, on grass and then on cobblestone.
  const cart = g.addFurniture('large_cart', px + 3, py, 0, 0, 40, [], 'Pine');
  const team = [beast(px + 4.5, py + 0.5), beast(px + 4.5, py + 1.5)];
  for (const c of team) c.hitchedTo = cart.id;
  cart.team = team.map((c) => c.id);
  g.world.setTile(cart.x, cart.y, TileType.Grass);
  const grass = g.vehicleSpeed(cart), step = g.vehicleStep(cart);
  g.world.setTile(cart.x, cart.y, TileType.Cobblestone);
  const stone = g.vehicleSpeed(cart);
  team[0].shodAt = g.time;
  const shodStone = g.vehicleSpeed(cart), shodStep = g.vehicleStep(cart);
  g.world.setTile(cart.x, cart.y, TileType.Grass);
  const shodGrass = g.vehicleSpeed(cart);
  check(`in the browser one shod of two takes the cart ×${PACE} on cobblestone`, grass > 0 && near(shodStone / stone, PACE),
    `${stone} → ${shodStone}`);
  check('and no quicker on grass', near(shodGrass, grass), `${grass} → ${shodGrass}`);
  check(`and up a step ${STEP} higher`, near(shodStep - step, STEP), `${step} → ${shodStep}`);
}

/* ---- the island ----------------------------------------------------------- */

const IVAR = `(select uid from player where world_id = (select id from world where name = 'Faraway') and name = 'Ivar')`;
const out = psql(`
begin;
create temp table said (k text, v text);
select set_config('request.jwt.claims', json_build_object('sub', ${IVAR})::text, true) \\g /dev/null
do $t$
declare w uuid; u uuid; v_cart bigint; v_a int; v_b int; v_heel int;
begin
  select id into w from world where name = 'Faraway';
  select uid into u from player where world_id = w and name = 'Ivar';
  update creature set rider = null where world_id = w and rider = u;
  delete from placed where world_id = w and driver = u;
  update player set x = 40.5, y = 40.5, level = 0, aboard = null where world_id = w and uid = u;
  perform land_set_tile(w, 40, 41, tile_id('Grass'));
  perform land_set_tile(w, 43, 40, tile_id('Grass'));

  -- The shoeing act, on a Cartling at heel.
  v_heel := creature_spawn(w, 'roxxen', 40.5, 41.5, 'active', now() - interval '60 days', u);
  perform give(w, u, 'horseshoe', ${SHOES_PER_MOUNT}, 40);
  perform give(w, u, 'mallet', 1, 40);
  insert into said values ('REFUSAL', coalesce(ride_refusal(w, u, 'shoe_creature',
    jsonb_build_object('kind', 'creature', 'id', v_heel)), 'none'));

  -- A large cart with two Cartlings in its yokes.
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql, material)
    values (w, 'furniture', 'large_cart', 43, 40, 43.5, 40.5, 40, 'Pine') returning id into v_cart;
  v_a := creature_spawn(w, 'roxxen', 44.5, 40.5, 'active', now() - interval '60 days', u);
  v_b := creature_spawn(w, 'roxxen', 44.5, 41.5, 'active', now() - interval '60 days', u);
  update creature set hitched_to = v_cart, hunger = 1, traits = '{}', skills = '{}', shod_at = null
    where world_id = w and id in (v_a, v_b);
  insert into said values ('GRASS', vehicle_speed(w, v_cart)::text), ('STEP', vehicle_step(w, v_cart)::text);
  perform land_set_tile(w, 43, 40, tile_id('Cobblestone'));
  insert into said values ('STONE', vehicle_speed(w, v_cart)::text);
  update creature set shod_at = now() where world_id = w and id = v_a;
  insert into said values ('SHODSTONE', vehicle_speed(w, v_cart)::text), ('SHODSTEP', vehicle_step(w, v_cart)::text);
  perform land_set_tile(w, 43, 40, tile_id('Grass'));
  insert into said values ('SHODGRASS', vehicle_speed(w, v_cart)::text);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const say = (k: string): string => isle.get(k) ?? 'unsaid';
const n = (k: string): number => Number(say(k));

check('on the island the shoeing act takes a Cartling', say('REFUSAL') === 'none', say('REFUSAL'));
check(`on the island one shod of two takes the cart ×${PACE} on cobblestone`, n('GRASS') > 0 && near(n('SHODSTONE') / n('STONE'), PACE, 1e-6),
  `${say('STONE')} → ${say('SHODSTONE')}`);
check('and no quicker on grass', near(n('SHODGRASS'), n('GRASS'), 1e-9), `${say('GRASS')} → ${say('SHODGRASS')}`);
check(`and up a step ${STEP} higher`, near(n('SHODSTEP') - n('STEP'), STEP, 1e-9), `${say('STEP')} → ${say('SHODSTEP')}`);

for (const l of [...ok, ...bad]) console.log(l);
console.log(`haulers take shoes, at half a mount's — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
