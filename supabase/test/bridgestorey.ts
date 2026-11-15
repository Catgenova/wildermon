/**
 * A bridge planned from a storey to a storey lands on those two storeys, on both sides.
 *
 * Reported: "this bridge was planned from storey 4 > 4, but planned and built 4 > 5". Storey 4 pinned on the storey
 * control, the player on storey 4 of one building, the far end picked on storey 4 of another. The storey picked was
 * never sent: each end landed on the highest finished floor of its tile (`top_deck` on the island, `topDeck` in the
 * browser), so a far tile with a finished storey 5 made a ramp up to storey 5, and a storey 5 floor over the player
 * one down from it.
 *
 * Three pairs of ends, on level ground at four, a rope bridge of four tiles of deck (six on the last), planned with
 * storey 4 picked at the far end (`level` on the target, as `bridgeFromHere` sends it) by a body on storey 4:
 *
 *   * row 50: the far building has a finished storey 5 floor on its end tile; the near one does not;
 *   * row 53: the near building has a finished storey 5 floor over the body, and the far end stands 8 higher;
 *   * row 56: the far end is open ground: a ramp down to it, as before.
 *
 * Asked of each, on the island (`last_refusal`, `perform_last`) and in the browser (`plan_bridge`'s check and
 * perform): allowed, its two storeys, its rise and its height; and built (every span decked), on the island and in the
 * browser, every tile of deck holds a body at storey 4 and none at storey 5.
 *
 * Runs against the database the suite leaves behind: Faraway, and Ivar on it, in one transaction rolled back.
 */
import { ACTION_BY_ID } from '../../src/game/actions';
import { WALL_HEIGHT } from '../../src/game/building';
import { bridgeLevels, spanTiles } from '../../src/game/bridges';
import { Game } from '../../src/game/game';
import { TileType } from '../../src/world/tiles';
import { psql, check, finish } from './harness';
import { SKILL_GATES } from '../../src/game/skillgates';

/** The level that opens every gate of a kind in a skill (`skillgates.ts`): what this test's builder works at. */
const gatesOpen = (kind: string, skill: string): number =>
  Math.max(1, ...SKILL_GATES.filter((g) => g.kind === kind && g.skill === skill).map((g) => g.level));

/** Storey 4 and storey 5, as both sides count storeys: the ground is nought. */
const FOUR = 3;
const FIVE = 4;
const BASE = 4;
const AX = 40;
const X0 = 36, X1 = 50, Y0 = 48, Y1 = 58;

interface Case {
  name: string;
  y: number;
  bx: number;
  /** The finished floors on each end's tile, by level; none, open ground. */
  floorsA: number[];
  floorsB: number[] | null;
  /** How much higher the far end's tile stands than the near one's. */
  raiseB: number;
  want: { levels: [number, number]; rise: number; height: number };
}
const upTo = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);
const CASES: Case[] = [
  { name: 'storey 4 to storey 4 of a building with a storey 5 floor at its end', y: 50, bx: AX + 5,
    floorsA: upTo(FOUR), floorsB: upTo(FIVE), raiseB: 0,
    want: { levels: [FOUR, FOUR], rise: 0, height: BASE + FOUR * WALL_HEIGHT } },
  { name: 'storey 4 under a storey 5 floor to storey 4 of a building on ground 8 higher', y: 53, bx: AX + 5,
    floorsA: upTo(FIVE), floorsB: upTo(FOUR), raiseB: 8,
    want: { levels: [FOUR, FOUR], rise: 0, height: BASE + FOUR * WALL_HEIGHT + 4 } },
  { name: 'storey 4 to open ground, storey 4 picked over it', y: 56, bx: AX + 7,
    floorsA: upTo(FOUR), floorsB: null, raiseB: 0,
    want: { levels: [FOUR, 0], rise: -FOUR * WALL_HEIGHT, height: BASE + (FOUR * WALL_HEIGHT) / 2 } },
];
const targetOf = (c: Case) => ({ kind: 'tile', x: c.bx, y: c.y, cx: c.bx + 0.5, cy: c.y + 0.5, material: 'rope', level: FOUR });
const deckOf = (c: Case): Array<[number, number]> => spanTiles(AX, c.y, c.bx, c.y);

/* ---- the browser ------------------------------------------------------------ */

const said = new Map<string, string>();
for (const c of CASES) {
  const g = Game.create(4243);
  g.skills.values.set('carpentry', gatesOpen('bridge', 'carpentry'));
  g.skills.values.set('masonry', gatesOpen('bridge', 'masonry'));
  for (let y = Y0; y <= Y1 + 1; y++) for (let x = X0; x <= X1 + 1; x++) g.world.setHeight(x, y, BASE);
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) g.world.setTile(x, y, TileType.Grass, 0);
  for (const [cx, cy] of [[c.bx, c.y], [c.bx + 1, c.y], [c.bx, c.y + 1], [c.bx + 1, c.y + 1]]) g.world.setHeight(cx, cy, BASE + c.raiseB);
  for (const [x, floors] of [[AX, c.floorsA], [c.bx, c.floorsB]] as Array<[number, number[] | null]>) {
    if (!floors) continue;
    const b = g.buildings.create(`Tower ${x}`, x, c.y);
    b.levels = FIVE + 1;
    for (const l of floors) {
      const f = g.buildings.setFloor(b, l, x, c.y, 'plank', 'floor');
      for (const k of Object.keys(f.needed)) f.needed[k] = 0;
    }
  }
  g.player.x = AX + 0.5;
  g.player.y = c.y + 0.5;
  g.player.level = FOUR;
  const plan = ACTION_BY_ID.get('plan_bridge')!;
  const t = targetOf(c);
  said.set(`browser:${c.y}:why`, plan.check!(t as never, g) ?? 'ALLOWED');
  plan.perform(t as never, g);
  const b = [...g.bridges.values()][0];
  said.set(`browser:${c.y}:plan`, b ? `${bridgeLevels(b).join('>')}|${b.rise ?? 0}|${b.height}` : 'NONE');
  if (b) {
    for (const s of b.spans) for (const k of Object.keys(s.needed)) s.needed[k] = 0;
    g.reindexDecks();
  }
  said.set(`browser:${c.y}:four`, deckOf(c).filter(([x, y]) => g.footing(x, y, FOUR) === FOUR).length.toString());
  said.set(`browser:${c.y}:five`, deckOf(c).filter(([x, y]) => g.footing(x, y, FIVE) === FIVE).length.toString());
}

/* ---- the island ------------------------------------------------------------- */

const q = (v: unknown): string => `'${JSON.stringify(v)}'::jsonb`;
const out = psql(`begin;
create temp table said (k text, v text);
do $$
declare w uuid := (select id from world where name = 'Faraway');
        u uuid := (select uid from player where world_id = w and name = 'Ivar');
        gx int; gy int; v_b bigint; v_id int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  delete from bridge_span where world_id = w;
  delete from bridge where world_id = w;
  for gx in ${X0}..${X1 + 1} loop for gy in ${Y0}..${Y1 + 1} loop perform land_set_height(w, gx, gy, ${BASE}); end loop; end loop;
  for gx in ${X0}..${X1} loop for gy in ${Y0}..${Y1} loop
    perform land_set_tile(w, gx, gy, tile_id('Grass')); perform land_set_data(w, gx, gy, 0);
  end loop; end loop;
  delete from floor_tile f where f.world_id = w and f.x between ${X0} and ${X1} and f.y between ${Y0} and ${Y1};
  delete from wall f where f.world_id = w and f.x between ${X0} and ${X1 + 1} and f.y between ${Y0} and ${Y1 + 1};
  delete from building_tile f where f.world_id = w and f.x between ${X0} and ${X1} and f.y between ${Y0} and ${Y1};
  ${CASES.map((c) => `
  ${[[c.bx, c.y], [c.bx + 1, c.y], [c.bx, c.y + 1], [c.bx + 1, c.y + 1]].map(([x, y]) => `perform land_set_height(w, ${x}, ${y}, ${BASE + c.raiseB});`).join(' ')}
  ${([[AX, c.floorsA], [c.bx, c.floorsB]] as Array<[number, number[] | null]>).filter(([, f]) => f).map(([x, floors]) => `
  v_id := coalesce((select max(id) from building where world_id = w), 0) + 1;
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, v_id, 'Tower ${x},${c.y}', ${FIVE + 1}, ${FIVE}, u);
  insert into building_tile (world_id, building, x, y) values (w, v_id, ${x}, ${c.y});
  insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total)
    select w, l, ${x}, ${c.y}, v_id, 'plank', 'floor', '{}', '{}' from unnest(array[${floors!.join(', ')}]) l;`).join('')}
  update player set x = ${AX + 0.5}, y = ${c.y + 0.5}, level = ${FOUR}, body_at = now(), act = null, act_queue = '[]'::jsonb
    where world_id = w and uid = u;
  insert into skill (world_id, uid, id, value) values (w, u, 'carpentry', ${gatesOpen('bridge', 'carpentry')}), (w, u, 'masonry', ${gatesOpen('bridge', 'masonry')})
    on conflict (world_id, uid, id) do update set value = greatest(skill.value, excluded.value);
  insert into said values ('island:${c.y}:why', coalesce(last_refusal(w, u, 'plan_bridge', ${q(targetOf(c))}), 'ALLOWED'));
  perform perform_last(w, u, 'plan_bridge', ${q(targetOf(c))});
  select id into v_b from bridge where world_id = w and ay = ${c.y};
  insert into said select 'island:${c.y}:plan', coalesce((select b.level || '>' || coalesce(b.level_b, b.level) || '|' || b.rise || '|' || b.height
    from bridge b where b.world_id = w and b.id = v_b), 'NONE');
  update bridge_span set needed = '{}' where world_id = w and bridge = v_b;
  insert into said select 'island:${c.y}:four', count(*)::text from unnest(array[${deckOf(c).map(([x]) => x).join(', ')}]) x
    where frame_stands(w, x, ${c.y}, ${FOUR});
  insert into said select 'island:${c.y}:five', count(*)::text from unnest(array[${deckOf(c).map(([x]) => x).join(', ')}]) x
    where frame_stands(w, x, ${c.y}, ${FIVE});`).join('\n')}
end $$;
select k || '=' || v from said;
rollback;`);
for (const l of out.split('\n')) if (l.includes('=')) said.set(l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1));

for (const c of CASES) {
  const want = `${c.want.levels.join('>')}|${c.want.rise}|${c.want.height}`;
  for (const side of ['browser', 'island']) {
    const at = `${side}:${c.y}`;
    check(`${side}: ${c.name}: allowed`, said.get(`${at}:why`) === 'ALLOWED', said.get(`${at}:why`));
    check(`${side}: ${c.name}: planned ${c.want.levels.map((l) => (l ? `storey ${l + 1}` : 'the ground')).join(' to ')}, rise ${c.want.rise}, deck at ${c.want.height}`,
      said.get(`${at}:plan`) === want, `${said.get(`${at}:plan`)}; want ${want}`);
    const deck = deckOf(c).length;
    // A ramp down to the ground is walked at storey 4 only from its top end; a level deck at storey 4 the whole way.
    if (c.want.levels[1] === FOUR) {
      check(`${side}: ${c.name}: built, every tile of deck holds a body at storey 4`, said.get(`${at}:four`) === String(deck),
        `${said.get(`${at}:four`)} of ${deck}`);
    }
    check(`${side}: ${c.name}: built, no tile of deck holds a body at storey 5`, said.get(`${at}:five`) === '0', `${said.get(`${at}:five`)} of ${deck}`);
  }
}

finish('a bridge planned from a storey to a storey lands on those two storeys, on both sides');
