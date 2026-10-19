/**
 * The dragon keeps to Volcano Isle, and a wildermon is not called what its kind used to be called.
 *
 * Asked about: "a dragon spawned on the crescent island, theyre only supposed to spawn on the northernmost island"
 * (Volcano Isle), and "Wildermon with the new names and models are still retaining the old names when tamed". Asked of
 * both sides:
 *
 *   * the island the dragon keeps to is the same island on both (`Region.lair`, `monster_isle`), and its middle too;
 *   * with nothing but a dragon left to stand up, nothing does on the Crescent, and a dragon does on Volcano Isle;
 *   * a grand map's hoard, which a dragon guards, is buried on Volcano Isle wherever the map turned up, and one buried
 *     elsewhere before now moves there when its map is asked where it points; a worn map's stays where it is;
 *   * no wildermon on the island is called its kind's old name, and a save holding one called so comes back calling it
 *     its kind's name now, while one somebody named keeps its name.
 *
 * The island half runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { chartRegion } from '../../src/world/chart';
import { lairOf, REGIONS } from '../../src/world/regions';
import { FORMER_NAME, MONSTER_CAP, SPECIES } from '../../src/game/creatures';
import { Game } from '../../src/game/game';
import { packLand, packWorld, unpack } from '../../src/game/save';
import { hoardOf, hoardSpot, TREASURE_TIERS } from '../../src/game/treasure';

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

const LAIR = lairOf('dragon')!;
const VOLCANO = REGIONS.indexOf(LAIR);
const CRESCENT = REGIONS.findIndex((R) => R.key === 'Crescent');
const GRAND = TREASURE_TIERS.find((t) => t.guard === 'dragon')!;
const WORN = TREASURE_TIERS.find((t) => t.guard !== 'dragon')!;

check(`the dragon keeps to ${LAIR.name} on both sides, the northernmost island of the chart`,
  psql(`select monster_isle('dragon')`) === String(VOLCANO) && psql(`select coalesce(monster_isle('goblin')::text, 'none')`) === 'none'
    && LAIR.at[1] === Math.min(...REGIONS.map((R) => R.at[1])),
  psql(`select monster_isle('dragon')`));
check('and its middle is the same on both', psql(`select array_to_string(region_middle(${VOLCANO}), ',')`) === LAIR.at.join(','),
  psql(`select array_to_string(region_middle(${VOLCANO}), ',')`));

/* ---- the island ---------------------------------------------------------- */

const isle = psql(`
begin;
create temp table said (k text, v text);
do $$
declare w uuid; me uuid; v_size int; cx int; cy int; vx int; vy int; v_map bigint; v_t treasure; i int; hx int; hy int;
begin
  -- The biggest island with somebody on it, its tokens set far off so that no tile is near one.
  select wd.id, wd.size into w, v_size from world wd where exists (select 1 from player p where p.world_id = wd.id) order by wd.size desc limit 1;
  select uid into me from player where world_id = w limit 1;
  update deed set x = -100000, y = -100000 where world_id = w;
  -- Nothing left with room under its cap but the dragon, and no dragon standing anywhere.
  update wild_table set cap = 0 where monster and species <> 'dragon';
  delete from creature where world_id = w and species = 'dragon';
  -- A tile on the Crescent and one on Volcano Isle.
  select gx, gy into cx, cy from generate_series(2, v_size - 3, greatest(1, v_size / 128)) gx, generate_series(2, v_size - 3, greatest(1, v_size / 128)) gy
   where region_at(w, gx + 0.5, gy + 0.5) = ${CRESCENT} order by gx, gy limit 1;
  select gx, gy into vx, vy from generate_series(2, v_size - 3, greatest(1, v_size / 128)) gx, generate_series(2, v_size - 3, greatest(1, v_size / 128)) gy
   where region_at(w, gx + 0.5, gy + 0.5) = ${VOLCANO} order by gx, gy limit 1;
  insert into said values ('FOUND', (cx is not null) || '|' || (vx is not null));
  insert into said select 'CRESCENT', coalesce(string_agg(distinct coalesce(pick_monster(w, cx, cy), 'none'), ','), 'none') from generate_series(1, 30);
  insert into said select 'VOLCANO', coalesce(string_agg(distinct coalesce(pick_monster(w, vx, vy), 'none'), ','), 'none') from generate_series(1, 30);
  -- Ground high enough to bury a hoard in round Volcano Isle's middle, for an island made flat for the suite.
  for hx in floor(${LAIR.at[0]} * v_size)::int - 40 .. floor(${LAIR.at[0]} * v_size)::int + 40 loop
    for hy in floor(${LAIR.at[1]} * v_size)::int - 40 .. floor(${LAIR.at[1]} * v_size)::int + 40 loop
      if hx between 0 and v_size and hy between 0 and v_size then perform land_set_height(w, hx, hy, 20); end if;
    end loop;
  end loop;
  -- A grand map turned up on the Crescent: its hoard on Volcano Isle.
  for i in 1 .. 5 loop
    v_map := bury_treasure(w, me, ${GRAND.minQl + 10}, cx, cy);
    insert into said select 'GRAND', region_at(w, t.x + 0.5, t.y + 0.5)::text from treasure t where t.item_id = v_map;
  end loop;
  -- One buried on the Crescent before now: moved there when its map is asked; a worn map's stays.
  update treasure set x = cx, y = cy where item_id = v_map;
  v_t := treasure_at(v_map);
  insert into said values ('ASTRAY', region_at(w, v_t.x + 0.5, v_t.y + 0.5)::text);
  update treasure set x = cx, y = cy, tier = '${WORN.id}' where item_id = v_map;
  v_t := treasure_at(v_map);
  insert into said values ('WORN', v_t.x || ',' || v_t.y || '|' || cx || ',' || cy);
end $$;
-- No wildermon anywhere still called what its kind used to be called.
insert into said select 'OLDNAMES', count(*)::text from creature c
  join (values ${Object.entries(FORMER_NAME).map(([id, n]) => `('${id}', '${n}')`).join(', ')}) was(species, name)
    on was.species = c.species and was.name = c.name;
select k || '=' || v from said;
rollback;
`);
const lines = isle.split('\n').filter((l) => l.includes('='));
const said = (k: string): string[] => lines.filter((l) => l.startsWith(`${k}=`)).map((l) => l.slice(k.length + 1));
check('on the island: a tile on the Crescent and one on Volcano Isle', said('FOUND')[0] === 'true|true', said('FOUND')[0]);
check('with only a dragon left to stand up, nothing does on the Crescent', said('CRESCENT')[0] === 'none', said('CRESCENT')[0]);
check(`and a dragon does on ${LAIR.name}`, said('VOLCANO')[0] === 'dragon', said('VOLCANO')[0]);
check(`a ${GRAND.name} turned up on the Crescent is a map to ${LAIR.name}, every time`,
  said('GRAND').length === 5 && said('GRAND').every((r) => r === String(VOLCANO)), said('GRAND').join(','));
check(`one buried on the Crescent before now moves to ${LAIR.name} when its map is asked`, said('ASTRAY')[0] === String(VOLCANO), said('ASTRAY')[0]);
check(`and a ${WORN.name}'s hoard, guarded by a ${WORN.guard}, stays where it was buried`, (() => { const [a, b] = (said('WORN')[0] ?? '').split('|'); return !!a && a === b; })(), said('WORN')[0]);
check('no wildermon on the island is called what its kind used to be called', said('OLDNAMES')[0] === '0', said('OLDNAMES')[0]);

/* ---- the browser --------------------------------------------------------- */

const game = Game.create(4242);
const size = game.world.w;
const tileOf = (region: number): [number, number] => {
  const R = REGIONS[region];
  for (let r = 0; r < size; r++) {
    for (let a = 0; a < 32; a++) {
      const x = Math.floor(R.at[0] * size + Math.cos((a / 32) * Math.PI * 2) * r);
      const y = Math.floor(R.at[1] * size + Math.sin((a / 32) * Math.PI * 2) * r);
      if (game.world.inBounds(x, y) && chartRegion(x + 0.5, y + 0.5, size) === region) return [x, y];
    }
  }
  return [-1, -1];
};
const [bcx, bcy] = tileOf(CRESCENT);
const [bvx, bvy] = tileOf(VOLCANO);
for (const c of [...game.creatures.list.values()]) game.creatures.remove(c.id);
game.deed = null;
const caps = { ...MONSTER_CAP };
for (const id of Object.keys(MONSTER_CAP)) if (id !== 'dragon') MONSTER_CAP[id] = 0;
const pick = (x: number, y: number): string => {
  const got = new Set<string>();
  for (let i = 0; i < 30; i++) got.add((game.creatures as unknown as { pickMonster(g: Game, x: number, y: number): string | null }).pickMonster(game, x, y) ?? 'none');
  return [...got].sort().join(',');
};
check('in the browser: with only a dragon left to stand up, nothing does on the Crescent', pick(bcx, bcy) === 'none', pick(bcx, bcy));
check(`and a dragon does on ${LAIR.name}`, pick(bvx, bvy) === 'dragon', pick(bvx, bvy));
Object.assign(MONSTER_CAP, caps);
const spots = Array.from({ length: 5 }, () => hoardSpot(game, bcx, bcy, 'dragon'));
check(`a ${GRAND.name}'s hoard is buried on ${LAIR.name} from the Crescent, every time`,
  spots.every((s) => !!s && chartRegion(s.x + 0.5, s.y + 0.5, size) === VOLCANO), spots.map((s) => s && chartRegion(s.x + 0.5, s.y + 0.5, size)).join(','));
game.hoards.push({ uid: 9001, x: bcx, y: bcy, tier: GRAND.id }, { uid: 9002, x: bcx, y: bcy, tier: WORN.id });
const astray = hoardOf(game, 9001), worn = hoardOf(game, 9002);
check(`and one buried on the Crescent before now moves to ${LAIR.name}; a ${WORN.name}'s stays`,
  !!astray && chartRegion(astray.x + 0.5, astray.y + 0.5, size) === VOLCANO && worn?.x === bcx && worn?.y === bcy,
  `${astray && chartRegion(astray.x + 0.5, astray.y + 0.5, size)} ${worn?.x},${worn?.y}`);

// A save from before: a Snufflet still called a Rabba, and one somebody called Horn.
const old = Game.create(5);
for (const c of [...old.creatures.list.values()]) old.creatures.remove(c.id);
const rabba = old.creatures.spawn('rabba', old.player.x + 2, old.player.y, 'active');
rabba.name = FORMER_NAME.rabba;
const horn = old.creatures.spawn('rabba', old.player.x + 3, old.player.y, 'active');
horn.name = 'Horn';
const back = await unpack(await packLand(old), packWorld(old));
check(`a save holding a ${SPECIES.rabba.name} called ${FORMER_NAME.rabba} comes back calling it ${SPECIES.rabba.name}, and one called Horn keeps its name`,
  back?.creatures.get(rabba.id)?.name === SPECIES.rabba.name && back?.creatures.get(horn.id)?.name === 'Horn',
  `${back?.creatures.get(rabba.id)?.name}, ${back?.creatures.get(horn.id)?.name}`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nthe dragon's island, and wildermon by their kinds' names — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
