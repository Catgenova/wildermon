/**
 * Glass walls, the same on both sides.
 *
 * Glass is laid as a solid wall and as a pitched roof and as nothing else
 * (`GLASS_ROOF.only`, the island's `build_material_def.only_*`). This puts the
 * browser (`glassPlanRefusal`, `onlyRefusal`) and the island (`glass_refusal`,
 * `material_only_refusal`, `frame_refusal`) to the same questions:
 *
 *   * a solid wall of glass is planned on both sides, at the same bill: a
 *     solid wall's of the material, `wallBill('glass', 'solid')`, which the
 *     island's `wall_bill` gives too;
 *   * every other wall type, every fence, every floor kind but a roof, and a
 *     column, refused in glass in the same words on both sides;
 *   * a one-storey building walled all round in glass, each wall built a unit
 *     a go through the doors, under a finished glass roof, is a glasshouse on
 *     both sides -- and not while one glass wall is still going up;
 *   * a hod carrier is sent to a planned glass wall with glass, on both sides.
 *
 * Runs against the database the suite leaves behind (Hoarding, and Dane on
 * it), and puts it back.
 */
import { Game } from '../../src/game/game';
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { FLOOR_KIND_NAMES, GLASS_ROOF, isDone, MATERIALS_WITH_GLASS, takesAs, wallBill, WALL_TYPES, type FloorKind, type Side } from '../../src/game/building';
import { GLASS, GLASS_ONLY, isGlasshouse, walledRound } from '../../src/game/glasshouse';
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
const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;
const tileT = (x: number, y: number, extra: Record<string, unknown> = {}): string => q(JSON.stringify({ kind: 'tile', x, y, ...extra }));
const sameBill = (a: Record<string, number>, b: Record<string, number>): boolean =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);

/** A glasshouse of two by two tiles, a free border off it for the fences, and the side its first wall goes on. */
const FOOT: Array<[number, number]> = [[20, 26], [21, 26], [20, 27], [21, 27]];
const SIDES: Array<[number, number, Side]> = [
  [20, 26, 'n'], [21, 26, 'n'], [20, 27, 's'], [21, 27, 's'], [20, 26, 'w'], [20, 27, 'w'], [21, 26, 'e'], [21, 27, 'e'],
];
const OUT: [number, number] = [24, 25];
const border = (x: number, y: number, s: Side): [string, number, number] =>
  s === 'n' ? ['h', x, y] : s === 's' ? ['h', x, y + 1] : s === 'w' ? ['v', x, y] : ['v', x + 1, y];
/** Every wall type but a solid wall, each asked of glass on the footprint's side, and the free-standing ones as a fence too. */
const OTHER = WALL_TYPES.filter((w) => w.id !== 'solid');
const FENCES = WALL_TYPES.filter((w) => w.standalone);
const FLOORS = (Object.keys(FLOOR_KIND_NAMES) as FloorKind[]).filter((k) => k !== 'roof');
const BILL = wallBill(GLASS, 'solid');
const UNITS = Object.values(BILL.total).reduce((a, b) => a + b, 0);

check(`the wall menus offer glass under Solid and no other type: ${WALL_TYPES.filter((w) => MATERIALS_WITH_GLASS.some((m) => m.id === GLASS && takesAs(m, { wall: w.id }))).map((w) => w.name).join(', ')}`,
  WALL_TYPES.filter((w) => takesAs(GLASS_ROOF, { wall: w.id })).map((w) => w.id).join(',') === 'solid' && MATERIALS_WITH_GLASS.includes(GLASS_ROOF));

const island = psql(`
begin;
create temp table said (k text, v text);
create or replace function skill_check(p_skill double precision, p_difficulty double precision,
   p_tool_ql double precision default 0, p_ease double precision default 0)
   returns boolean language sql as 'select true';
create or replace function product_ql(p_skill double precision, p_tool_ql double precision default 0)
  returns double precision language sql as 'select 40::double precision';
do $$
declare w uuid; u uuid; v_x int; v_y int; v_n int; v_goes int := 0;
begin
  select id into w from world where name = 'Hoarding';
  select uid into u from player where world_id = w and name = 'Dane';
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  delete from wall where world_id = w;
  delete from floor_tile where world_id = w;
  delete from building_column where world_id = w;
  delete from building_tile where world_id = w;
  delete from building where world_id = w;
  delete from crop where world_id = w;
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  update player set body_at = now(), x = 20.5, y = 26.5, level = 0, act = null, act_target = null, act_started = null, act_ends = null,
         act_left = null, act_goes = null, act_queue = '[]',
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, founded_by) values (w, 'Latecomer', 21, 26, 5, u)
    on conflict (world_id, founded_by) do update set x = 21, y = 26, radius = 5;
  insert into skill (world_id, uid, id, value) values (w, u, 'carpentry', 50)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  for v_x in 18 .. 26 loop for v_y in 24 .. 31 loop
    perform land_set_height(w, v_x, v_y, 40);
    perform land_set_tile(w, v_x, v_y, tile_id('Grass'));
  end loop; end loop;
  ${FOOT.map(([x, y]) => `perform land_set_tile(w, ${x}, ${y}, tile_id('Packed dirt'));`).join('\n  ')}
  insert into building (world_id, id, name, levels, work_level, planned_by, roof) values (w, 1, 'Glasshouse', 1, 0, u, 'hip');
  insert into building_tile (world_id, building, x, y) values ${FOOT.map(([x, y]) => `(w, 1, ${x}, ${y})`).join(', ')};
  insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total) values
    ${FOOT.map(([x, y]) => `(w, 1, ${x}, ${y}, 1, 'glass', 'roof', '{"glass":0,"timber":0}', floor_bill('glass', 'roof', 'hip'))`).join(',\n    ')};
  perform give(w, u, 'mallet', 1, 40);
  perform give(w, u, 'trowel', 1, 40);

  -- Every wall type but a solid one, every fence, every floor kind but a roof, and a column: refused in glass.
  ${OTHER.map((t) => `insert into said values ('W:${t.id}', coalesce(act_refusal(w, u, 'plan_wall', ${tileT(20, 26, { side: 'n', wallType: t.id, material: 'glass' })}), 'ALLOWED'));`).join('\n  ')}
  update player set body_at = now(), x = ${OUT[0] + 0.5}, y = ${OUT[1] + 0.5} where world_id = w and uid = u;
  ${FENCES.map((t) => `insert into said values ('F:${t.id}', coalesce(act_refusal(w, u, 'plan_fence', ${tileT(OUT[0], OUT[1], { side: 'n', wallType: t.id, material: 'glass' })}), 'ALLOWED'));`).join('\n  ')}
  update player set body_at = now(), x = 20.5, y = 26.5 where world_id = w and uid = u;
  ${FLOORS.map((k) => `insert into said values ('K:${k}', coalesce(act_refusal(w, u, 'plan_floor', ${tileT(20, 26, { material: 'glass', floorKind: k })}), 'ALLOWED'));`).join('\n  ')}
  insert into said values ('COLUMN', coalesce(act_refusal(w, u, 'plan_column', ${tileT(20, 26, { cx: 20, cy: 26, material: 'glass', level: 0 })}), 'ALLOWED'));
  insert into said values ('WALLBILL', wall_bill('glass', 'solid')::text);

  -- A solid wall of glass: asked, planned, and the bill it was planned at.
  insert into said values ('SOLID', coalesce(act_refusal(w, u, 'plan_wall', ${tileT(20, 26, { side: 'n', wallType: 'solid', material: 'glass' })}), 'ALLOWED'));
  perform act_perform(w, u, 'plan_wall', ${tileT(20, 26, { side: 'n', wallType: 'solid', material: 'glass' })});
  insert into said select 'PLANNED', wl.type || '|' || wl.material || '|' || wl.total::text || '|' || wl.needed::text
    from wall wl where wl.world_id = w and wl.level = 0 and wl.dir = 'h' and wl.x = 20 and wl.y = 26;
  -- A hod carrier holding glass is sent to it.
  insert into said select 'HOD', h.kind || '|' || h.dir || '|' || h.x || ',' || h.y || '|' || h.item from hod_needing(w, 21, 26, 6, 'glass') h;

  -- The rest of the walls round it, all of them glass, each built a unit a go through the doors.
  ${SIDES.slice(1).map(([x, y, s]) => `perform act_perform(w, u, 'plan_wall', ${tileT(x, y, { side: s, wallType: 'solid', material: 'glass' })});`).join('\n  ')}
  perform give(w, u, 'glass', ${BILL.total.glass * SIDES.length}, 40);
  perform give(w, u, 'timber', ${BILL.total.timber * SIDES.length}, 40);
  ${SIDES.map(([x, y, s], i) => {
    const [d, bx, by] = border(x, y, s);
    return `v_n := 0;
  while not bill_done((select wl.needed from wall wl where wl.world_id = w and wl.level = 0 and wl.dir = '${d}' and wl.x = ${bx} and wl.y = ${by})) and v_n < 200 loop
    perform act_perform(w, u, 'build_wall', ${tileT(x, y, { side: s })});
    v_n := v_n + 1;
  end loop;
  v_goes := v_goes + v_n;${i === SIDES.length - 2 ? `
  insert into said values ('ONELEFT', walled_round(w, 1) || '|' || glasshouse(w, 1));` : ''}`;
  }).join('\n  ')}
  insert into said values ('GOES', v_goes::text);
  insert into said values ('ROUND', walled_round(w, 1) || '|' || glasshouse(w, 1));
  insert into said values ('BUILT', coalesce((select e.text from event e where e.world_id = w and e.uid = u and e.text like 'Built: %' order by e.n desc limit 1), 'unsaid'));
end $$;
select k || E'\\t' || coalesce(v, '') from said;
rollback;
`);
const isaid = new Map(island.split('\n').filter(Boolean).map((l) => {
  const [k, ...v] = l.split('\t');
  return [k, v.join('\t')];
}));
const say = (k: string): string => isaid.get(k) ?? 'unsaid';

check(`the island refuses glass as every wall type but a solid wall, in so many words: "${GLASS_ONLY}"`,
  OTHER.every((t) => say(`W:${t.id}`) === GLASS_ONLY), OTHER.map((t) => `${t.id}: ${say(`W:${t.id}`)}`).join(' / '));
check('and as every fence', FENCES.every((t) => say(`F:${t.id}`) === GLASS_ONLY), FENCES.map((t) => `${t.id}: ${say(`F:${t.id}`)}`).join(' / '));
check(`and as every floor kind but a roof: ${FLOORS.join(', ')}`, FLOORS.every((k) => say(`K:${k}`) === GLASS_ONLY), FLOORS.map((k) => `${k}: ${say(`K:${k}`)}`).join(' / '));
check('and as a column', say('COLUMN') === GLASS_ONLY, say('COLUMN'));
{
  const [type, mat, total, needed] = say('PLANNED').split('|');
  check(`a solid wall of glass is planned on the island at a solid wall's bill: ${BILL.total.glass} glass and ${BILL.total.timber} timber`,
    say('SOLID') === 'ALLOWED' && type === 'solid' && mat === GLASS && sameBill(BILL.total, JSON.parse(total)) && sameBill(BILL.needed, JSON.parse(needed))
      && sameBill(BILL.total, JSON.parse(say('WALLBILL'))),
    `${say('SOLID')} / ${say('PLANNED')} / ${say('WALLBILL')}`);
}
check('a hod carrier holding glass is sent to the glass wall', say('HOD') === 'wall|h|20,26|glass', say('HOD'));
check(`walled all round in glass under a glass roof, each wall ${UNITS} goes, it is a glasshouse on the island, and not with one wall still going up`,
  say('ONELEFT') === 'false|false' && say('ROUND') === 'true|true' && Number(say('GOES')) === UNITS * SIDES.length,
  `${say('ONELEFT')} / ${say('ROUND')} / ${say('GOES')}`);

/* ---- and the same in the browser ---------------------------------------------------------------- */

const game = Game.create(4242);
for (const c of [...game.creatures.list.values()]) game.creatures.remove(c.id);
game.creatures.fromIsland = true;
const bld = game.buildings;
for (let x = 18; x <= 27; x++) for (let y = 24; y <= 32; y++) game.world.setHeight(x, y, 40);
for (let x = 18; x <= 26; x++) for (let y = 24; y <= 31; y++) game.world.setTile(x, y, TileType.Grass);
for (const [x, y] of FOOT) game.world.setTile(x, y, TileType.PackedDirt);
const gh = bld.create('Glasshouse', 20, 26);
for (const [x, y] of FOOT.slice(1)) bld.addTile(gh, x, y);
gh.roof = 'hip';
for (const [x, y] of FOOT) {
  const f = bld.setFloor(gh, 1, x, y, GLASS, 'roof');
  for (const k of Object.keys(f.needed)) f.needed[k] = 0;
}
game.deed = { name: 'Latecomer', x: 21, y: 26, radius: 5, level: 1, mine: true } as typeof game.deed;
game.inventory.add('mallet', { ql: 40 });
game.inventory.add('trowel', { ql: 40 });
game.setPerks({});
game.skills.values.set('carpentry', 50);
game.productQl = () => 40;
const at = (x: number, y: number, extra: Record<string, unknown> = {}): Target => ({ kind: 'tile', x, y, cx: x, cy: y, ...extra } as Target);
const ask = (id: string, t: Target): string => ACTION_BY_ID.get(id)!.check?.(t, game) ?? 'ALLOWED';
const run = (id: string, t: Target): unknown => ACTION_BY_ID.get(id)!.perform(t, game);
const stand = (x: number, y: number): void => { game.player.x = x + 0.5; game.player.y = y + 0.5; };

stand(20, 26);
const walls = OTHER.map((t) => [t.id, ask('plan_wall', at(20, 26, { side: 'n', wallType: t.id, material: GLASS }))] as const);
check('the browser refuses glass as every other wall type in the island\'s words',
  walls.every(([id, s]) => s === say(`W:${id}`)), walls.filter(([id, s]) => s !== say(`W:${id}`)).map(([id, s]) => `${id}: ${s}`).join(' / '));
stand(OUT[0], OUT[1]);
const fences = FENCES.map((t) => [t.id, ask('plan_fence', at(OUT[0], OUT[1], { side: 'n', wallType: t.id, material: GLASS }))] as const);
check('and as every fence', fences.every(([id, s]) => s === say(`F:${id}`)), fences.map(([id, s]) => `${id}: ${s}`).join(' / '));
stand(20, 26);
const floors = FLOORS.map((k) => [k, ask('plan_floor', at(20, 26, { material: GLASS, floorKind: k }))] as const);
check('and as every floor kind but a roof', floors.every(([k, s]) => s === say(`K:${k}`)), floors.map(([k, s]) => `${k}: ${s}`).join(' / '));
const column = ask('plan_column', at(20, 26, { cx: 20, cy: 26, material: GLASS, level: 0 }));
check('and as a column', column === say('COLUMN'), column);

const solid = ask('plan_wall', at(20, 26, { side: 'n', wallType: 'solid', material: GLASS }));
run('plan_wall', at(20, 26, { side: 'n', wallType: 'solid', material: GLASS }));
const first = bld.wall(0, 20, 26, 'n');
check('and plans a solid wall of glass at the same bill as the island',
  solid === say('SOLID') && first?.type === 'solid' && first.material === GLASS && sameBill(first.total, BILL.total) && sameBill(first.needed, BILL.needed)
    && `${first.type}|${first.material}|${JSON.stringify(first.total)}|${JSON.stringify(first.needed)}`.split('|').slice(0, 2).join('|') === say('PLANNED').split('|').slice(0, 2).join('|'),
  `${solid} / ${JSON.stringify(first?.total)}`);
{
  const job = game.hodNeeding(() => true, 'glass', { x: 21, y: 26 }, () => true);
  const t = job?.target;
  const said = t?.kind === 'wall' ? `wall|${t.wall.dir}|${t.wall.x},${t.wall.y}|${job?.item}` : `${t?.kind ?? 'none'}`;
  check('and a hod carrier holding glass is sent to it, as on the island', said === say('HOD'), `${said} / ${say('HOD')}`);
}

for (const [x, y, s] of SIDES.slice(1)) run('plan_wall', at(x, y, { side: s, wallType: 'solid', material: GLASS }));
game.inventory.add('glass', { count: BILL.total.glass * SIDES.length, ql: 40 });
game.inventory.add('timber', { count: BILL.total.timber * SIDES.length, ql: 40 });
let goes = 0;
let oneLeft = '';
SIDES.forEach(([x, y, s], i) => {
  stand(x, y);
  let n = 0;
  while (n < 200 && !isDone(bld.wall(0, x, y, s)!)) {
    run('build_wall', at(x, y, { side: s }));
    n++;
  }
  goes += n;
  if (i === SIDES.length - 2) oneLeft = `${walledRound(bld, gh)}|${isGlasshouse(bld, gh)}`;
});
check('and walled all round in glass, the same goes, it is a glasshouse in the browser too, and not with one wall still going up',
  oneLeft === say('ONELEFT') && `${walledRound(bld, gh)}|${isGlasshouse(bld, gh)}` === say('ROUND') && goes === Number(say('GOES')),
  `${oneLeft} / ${walledRound(bld, gh)}|${isGlasshouse(bld, gh)} / ${goes}`);
{
  const heard = [...game.log].reverse().find((l) => l.text.startsWith('Built: '))?.text ?? 'unsaid';
  check(`and says it is built in the island's words: "${say('BUILT')}"`, heard === say('BUILT'), heard);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not the same on both sides`);
  process.exit(1);
}
console.log(`glass walls — ${ok.length} of ${ok.length}`);
