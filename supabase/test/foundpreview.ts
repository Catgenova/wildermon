/**
 * Founding a settlement, seen before the stake is spent; and the Runestones' no-settlement rings on the map.
 *
 * Asked: "Before the stake is spent, the player can see where the settlement would be and whether it would be
 * refused", and "show each runestone's name at its position and a ring of radius DEED_STONE_GAP tiles" on the map.
 *
 * The preview (`foundingPreview`, the tile menu's Preview settlement here) asks the rule founding asks
 * (`foundingRefusal`), measured from every settlement the island lists (`rpc_settlements`). So this asks both sides
 * the same three spots on the suite's four-thousand-tile Bigness, with a settlement of somebody else's put down for it
 * (rolled back):
 *
 *   * a token one tile short of `DEED_SPACING` from that settlement's;
 *   * a token fifty tiles from the Crownstone;
 *   * and a token neither, exactly `DEED_SPACING` from that settlement's;
 *
 * and the browser's preview, handed the island's own `rpc_settlements` answer and nothing from a ground read, says
 * what the island's `act_refusal` says for the body standing there, word for word. The browser's world is the same
 * size as the island's and dry everywhere, and every spot is one the island holds dry, open and off any slab, so only
 * the settlements and the stones can tell them apart.
 *
 * And the map (`mapStones`): every Runestone the island has (`runestone_centres`), by name at its centre tile, its
 * ring `deed_stone_gap()` tiles out from the stone's edge (`stone_half()` from its centre), with the ring's edge
 * through the middle of the nearest tile the island would allow a token on.
 */
import { execFileSync } from 'node:child_process';
import { foundingPreview, foundingRefusal, ACTION_BY_ID, deedAcrossAt } from '../../src/game/actions';
import { DEED_SPACING, DEED_STONE_GAP, deedNearStone, deedTooClose, Game, MAX_DEED_LEVEL } from '../../src/game/game';
import { RUNESTONES, stoneGap } from '../../src/game/runestones';
import { World } from '../../src/world/world';
import { MAP_LEGEND, mapStones, type MapSettlement } from '../../src/ui/panels/minimap';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
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

/* ---- the island ------------------------------------------------------------ */

const NEIGHBOUR = 'Previewholm';
const isle = psql(`
begin;
create temp table said (k text);
do $$
declare w uuid; n int; u uuid; other uuid; c record; ax int; ay int; nx int; ny int; dy int; s int;
        aim jsonb; spot record;
begin
  select id, size into w, n from world where name = 'Bigness';
  insert into said values ('SIZE|' || n);
  -- Somebody with no settlement of their own, holding a stake; and somebody else, whose settlement this puts down.
  select uid into u from player where world_id = w order by uid limit 1;
  select p.uid into other from player p where p.world_id = w and p.uid <> u
     and not exists (select 1 from deed d where d.world_id = w and d.founded_by = p.uid)
   order by p.uid limit 1;
  delete from deed where world_id = w and founded_by = u;
  delete from item where world_id = w and holder = 'player' and holder_uid = u and def = 'deed_stake';
  perform give(w, u, 'deed_stake', 1, 50);

  -- Allowed: the first tile on a coarse grid that is dry, open and off any slab, as is the tile west of it, both
  -- deed_stone_gap() or more from every stone and deed_spacing() off every token, with room west of them for one more.
  select gx, gy into ax, ay
    from generate_series(300, n - 300, 41) gx, generate_series(300, n - 300, 41) gy
   where not exists (select 1 from generate_series(0, 1) k
                      where has_water(w, gx - k, gy) or not passable(w, gx - k, gy) or slab_at(w, gx - k, gy) is not null)
     and not exists (select 1 from runestone_centres(n) r
                      where sqrt(power(greatest(0, abs(gx - 1 - r.x) - stone_half()), 2)
                               + power(greatest(0, abs(gy - r.y) - stone_half()), 2)) < deed_stone_gap() + 2)
     and not exists (select 1 from deed d where d.world_id = w
                      and abs(d.x - gx) < 2 * deed_spacing() + 2 and abs(d.y - gy) < 2 * deed_spacing() + 2)
   order by gx, gy limit 1;
  -- Somebody else's settlement deed_spacing() west of it: the tile there is allowed, the one west of that is one short.
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, '${NEIGHBOUR}', ax - deed_spacing(), ay, deed_radius(1), 1, other);

  -- Near a stone: fifty tiles west of the Crownstone, on the first tile north or south of that line that is dry,
  -- open and off any slab.
  select * into c from runestone_centres(n) where id = 'crownstone';
  nx := c.x - 50;
  <<find>> for dy in 0..59 loop
    foreach s in array array[1, -1] loop
      if not has_water(w, nx, c.y + s * dy) and passable(w, nx, c.y + s * dy) and slab_at(w, nx, c.y + s * dy) is null then
        ny := c.y + s * dy; exit find;
      end if;
    end loop;
  end loop;

  -- Every settlement on the island, as the preview asks for it.
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  insert into said values ('ALL|' || rpc_settlements(w)::text);

  for spot in select * from (values ('ALLOWED', ax, ay), ('TOKEN', ax - 1, ay), ('STONE', nx, ny)) v(k, x, y) loop
    update player set body_at = now(), x = spot.x + 0.5, y = spot.y + 0.5, act = null, act_queue = '[]'::jsonb
     where world_id = w and uid = u;
    aim := jsonb_build_object('kind', 'tile', 'x', spot.x, 'y', spot.y, 'cx', spot.x, 'cy', spot.y, 'name', 'Newport');
    insert into said values (spot.k || '|' || spot.x || '|' || spot.y || '|'
      || coalesce(act_refusal(w, u, 'found_settlement', aim), 'none'));
  end loop;

  -- The stones and their rings, as the island has them: each stone's centre, the gap, the stone's half, and the
  -- gap of the tile the map's ring passes through the middle of, west of it, and of the one inside it.
  insert into said values ('GAP|' || deed_stone_gap() || '|' || stone_half());
  insert into said select 'STONE_AT|' || r.id || '|' || r.name || '|' || r.x || '|' || r.y || '|'
    || sqrt(power(greatest(0, abs((r.x - stone_half() - deed_stone_gap()) - r.x) - stone_half()), 2))::numeric || '|'
    || sqrt(power(greatest(0, abs((r.x - stone_half() - deed_stone_gap() + 1) - r.x) - stone_half()), 2))::numeric
    from runestone_centres(n) r order by r.ord;
end $$;
select string_agg(k, E'\\n') from said;
rollback;
`);
const lines = isle.split('\n');
const said = (key: string): string[] => lines.find((l) => l.startsWith(`${key}|`))?.split('|').slice(1) ?? [];
const size = Number(said('SIZE')[0]);
const all = (JSON.parse(said('ALL').join('|') || '{"deeds":[]}') as { deeds: MapSettlement[] }).deeds;

/* ---- the browser, over the island's answers --------------------------------- */

// The island's size, dry and open everywhere but the stones' own tiles: the island holds every spot asked dry and open.
const game = new Game({ seed: 1, world: new World(size, size), spawn: { x: size >> 1, y: size >> 1 } });
game.inventory.add('deed_stake');
game.deed = null;
game.neighbourDeeds = [];

console.log('--- the preview, against the island');
check(`the suite's island is the live one's size, with the stones on it`, size === 4096 && mapStones(size).length === RUNESTONES.length, String(size));
check(`the island lists ${NEIGHBOUR} among every settlement on it`, all.some((d) => d.name === NEIGHBOUR), all.map((d) => d.name).join(', '));
const expect: Record<string, (x: number, y: number) => string> = {
  ALLOWED: () => 'none',
  TOKEN: () => deedTooClose(NEIGHBOUR, DEED_SPACING - 1),
  STONE: (x, y) => deedNearStone(RUNESTONES[0].name, stoneGap(RUNESTONES[0], size, x, y)),
};
const found = ACTION_BY_ID.get('found_settlement')!;
for (const key of ['ALLOWED', 'TOKEN', 'STONE']) {
  const [xs, ys, island] = said(key);
  const x = Number(xs), y = Number(ys);
  const seen = foundingPreview(game, x, y, all);
  const browser = seen.refusal ?? 'none';
  check(`${key.toLowerCase()} (${x}, ${y}): the preview says what the island's act_refusal says`, browser === island, `${browser} / ${island}`);
  check(`${key.toLowerCase()}: and it is the refusal asked for`, island === expect[key](x, y), island);
  // The same rule founding asks, once the settlements are those it measures from.
  game.neighbourDeeds = all.map((d) => ({ ...d, level: 1, holder: null }));
  const asked = found.check?.({ kind: 'tile', x, y, cx: x, cy: y }, game) ?? null;
  game.neighbourDeeds = [];
  check(`${key.toLowerCase()}: founding there refuses it in the same words`, (asked ?? 'none') === browser && foundingRefusal(game, x, y, all) === seen.refusal, String(asked));
  const first = deedAcrossAt(1), last = deedAcrossAt(MAX_DEED_LEVEL);
  check(`${key.toLowerCase()}: the log line says it, and the sizes when allowed`,
    seen.said === `Settlement preview (${x}, ${y}): ${seen.refusal ? `refused. ${seen.refusal}` : `allowed. Border ${first} × ${first} tiles at level 1, ${last} × ${last} at level ${MAX_DEED_LEVEL}.`}`,
    seen.said);
}

console.log('--- the map, against the island');
const [gap, half] = said('GAP').map(Number);
const islandStones = lines.filter((l) => l.startsWith('STONE_AT|')).map((l) => l.split('|').slice(1));
const drawn = mapStones(size);
check(`the map lists every stone the island has: ${islandStones.length}`, drawn.length === islandStones.length && drawn.length === RUNESTONES.length,
  `${drawn.length} / ${islandStones.length}`);
for (const [id, name, xs, ys, edge, inside] of islandStones) {
  const d = drawn.find((s) => s.name === name);
  check(`${name} (${id}): by name, at the island's centre tile (${xs}, ${ys})`, !!d && d.x === Number(xs) && d.y === Number(ys), d ? `(${d.x}, ${d.y})` : 'not drawn');
  check(`${name}: its ring ${gap} tiles out from the stone's edge, ${half} from its centre`, !!d && d.ring === gap && d.half === half && d.ring === DEED_STONE_GAP,
    d ? `${d.ring}, ${d.half}` : '');
  check(`${name}: the ring's edge through the middle of the nearest tile the island allows, the next in refused`,
    Number(edge) === gap && Number(inside) < gap, `${edge}, ${inside}`);
}
check('the legend names the ring with its number', MAP_LEGEND.some((l) => l.kind === 'ring' && l.label.includes(String(DEED_STONE_GAP))),
  MAP_LEGEND.map((l) => l.label).join('; '));

for (const l of [...ok, ...bad]) console.log(l);
console.log(`settlement preview and the Runestones' rings — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
