/**
 * The rune gate (`runegate.ts`), the same on both sides.
 *
 * Asked for: two rune pillars flanking a settlement's way in, "placed on a
 * tile edge like a gate or a wall opening, passable, built with masonry from
 * stone bricks and light motes", that does not close and holds no lock, and
 * whose runes light while a citizen of the settlement it stands on is between
 * them -- and not for a stranger.
 *
 * One stretch of Hoarding, flat grass, and Ida's settlement over it. Four
 * people: Ida, who founded it; Bea, a builder on it; Gus, a guest on it; and
 * Tom, a stranger. So this asks:
 *
 *   * what it is and costs, on both sides: the same row in `wall_type_def`
 *     -- passable, wide, no beast stopped, standing on its own border, on the
 *     ground floor, waist-high work nothing rests on, laid in stone brick --
 *     the same light motes over the stone, the same bill;
 *   * where it may be planned and in what, in the same words: Plan fence in
 *     stone brick is taken, and in any other material, stone or timber,
 *     refused with the same sentence both sides hold (`laidInSaid`,
 *     `material_only_refusal`); and every other wall type and material is
 *     answered as it was;
 *   * planning one, on both sides, and the wall it leaves on the island;
 *   * what gets through it, fed what the island said: a person, a cart and a
 *     beast, and the eye;
 *   * who lights it: the rolls the island sends (`rpc_rune_gate_folk`) --
 *     founder, mayors and builders, never a guest or a stranger, only for a
 *     settlement a rune gate stands on, the tile either side of it -- and
 *     only to somebody ashore; and a browser fed them lighting it for Ida
 *     playing and for Bea drawn in the opening, not for Gus or Tom, within
 *     `RUNE_GATE_REACH` of the middle and not past it, coming up at once and
 *     going out over `RUNE_GATE_FADE`, and a gate not yet finished dark;
 *   * and its light after dark, as strong as it is lit.
 *
 * Runs against the database the suite leaves behind, and puts Hoarding's
 * ground back as it found it.
 *
 *   npx esbuild supabase/test/runegate.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/runegate.mjs && node node_modules/.cache/runegate.mjs
 */
import { execFileSync } from 'node:child_process';
import { Game, type IslandGround } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { laidInSaid, MATERIALS, onlyRefusal, onlySaid, WALL_TYPE_BY_ID, WALL_TYPES, wallBill, type Side } from '../../src/game/building';
import {
  citizenInGate, gateMiddle, RUNE_GATE, RUNE_GATE_FADE, RUNE_GATE_GLOW, RUNE_GATE_GLOW_REACH, RUNE_GATE_REACH, runeGateLights, runeGateLit,
  runeGatesHeld, sawGateFolk,
} from '../../src/game/runegate';
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
const same = (a: Record<string, number>, b: Record<string, number>): boolean =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, n]) => b[k] === n);
const said = (bill: Record<string, number>): string => Object.entries(bill).map(([k, n]) => `${n} ${k}`).join(', ');

const W = `(select id from world where name = 'Hoarding')`;
const WHO = {
  ida: 'b4e00000-0001-4000-8000-0000000000a1',
  bea: 'b4e00000-0002-4000-8000-0000000000b2',
  gus: 'b4e00000-0003-4000-8000-0000000000c3',
  tom: 'b4e00000-0004-4000-8000-0000000000d4',
} as const;
type Who = keyof typeof WHO;
const EVERYBODY = Object.values(WHO).map((u) => `'${u}'`).join(', ');

/* ---- the scene ----------------------------------------------------------------
 *
 * Flat grass at forty from 44 to 56 each way. Ida's settlement reaches from
 * 46 to 52 each way, its token at (49, 49). The gate stands on the south side
 * of (50, 52): the border between (50, 52), inside the settlement, and
 * (50, 53), outside it -- the way in at its edge.
 */
const BOX = { x0: 44, y0: 44, x1: 56, y1: 56 };
const FLAT = 40;
const MAT = 'stone_brick';
const GATE = { x: 50, y: 52, side: 's' as Side };
const BORDER = { dir: 'h' as const, x: 50, y: 53 };
const MID = gateMiddle(BORDER);

const before = psql(`
select string_agg(gx || ',' || gy || ',' || coalesce(land_height(${W}, gx, gy), 0), ';')
  from generate_series(${BOX.x0}, ${BOX.x1}) gx cross join generate_series(${BOX.y0}, ${BOX.y1}) gy;
select string_agg(gx || ',' || gy || ',' || coalesce(land_tile(${W}, gx, gy), 0), ';')
  from generate_series(${BOX.x0}, ${BOX.x1 - 1}) gx cross join generate_series(${BOX.y0}, ${BOX.y1 - 1}) gy;`).split('\n');

const scene = (): void => {
  psql(`
do $$
declare w uuid; gx int; gy int; v_full jsonb := '{"health":1,"stamina":1,"hunger":1,"thirst":1}'::jsonb;
begin
  select id into w from world where name = 'Hoarding';
  delete from wall where world_id = w and x between ${BOX.x0} and ${BOX.x1} and y between ${BOX.y0} and ${BOX.y1};
  delete from deed_member where world_id = w and (founder in (${EVERYBODY}) or uid in (${EVERYBODY}));
  delete from deed where world_id = w and founded_by in (${EVERYBODY});
  delete from item where world_id = w and holder = 'player' and holder_uid in (${EVERYBODY});
  delete from player where world_id = w and uid in (${EVERYBODY});
  insert into player (world_id, uid, name, x, y, stats) values
    (w, '${WHO.ida}', 'Ida', 50.5, 52.5, v_full), (w, '${WHO.bea}', 'Bea', 50.5, 52.5, v_full),
    (w, '${WHO.gus}', 'Gus', 50.5, 52.5, v_full), (w, '${WHO.tom}', 'Tom', 50.5, 52.5, v_full);
  insert into deed (world_id, name, x, y, radius, founded_by) values (w, 'Runehold', 49, 49, 3, '${WHO.ida}');
  insert into deed_member (world_id, founder, uid, role) values
    (w, '${WHO.ida}', '${WHO.bea}', 'builder'), (w, '${WHO.ida}', '${WHO.gus}', 'guest');
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', '${WHO.ida}', 'trowel', 40, 1), (w, 'player', '${WHO.ida}', 'mallet', 40, 1);
  for gx in ${BOX.x0}..${BOX.x1} loop for gy in ${BOX.y0}..${BOX.y1} loop
    perform land_set_height(w, gx, gy, ${FLAT});
  end loop; end loop;
  for gx in ${BOX.x0}..${BOX.x1 - 1} loop for gy in ${BOX.y0}..${BOX.y1 - 1} loop
    perform land_set_tile(w, gx, gy, tile_id('Grass'));
  end loop; end loop;
end $$;`);
};
scene();

/** The ground a browser stands on: the same box, shaped the same. */
const shape = (g: Game): void => {
  for (let x = BOX.x0; x <= BOX.x1; x++) for (let y = BOX.y0; y <= BOX.y1; y++) g.world.setHeight(x, y, FLAT);
  for (let x = BOX.x0; x < BOX.x1; x++) for (let y = BOX.y0; y < BOX.y1; y++) g.world.setTile(x, y, TileType.Grass);
};
/** What the island tells somebody standing at (x, y), as `rpc_ground` says it. */
const groundFor = (who: Who, x = 50.5, y = 54.5): IslandGround => JSON.parse(psql(`
update player set x = ${x}, y = ${y}, level = 0 where world_id = ${W} and uid = '${WHO[who]}';
select set_config('request.jwt.claims', json_build_object('sub', '${WHO[who]}')::text, false) \\g /dev/null
select rpc_ground(${W}, 40, true)::text;`).split('\n').pop() as string) as IslandGround;
/** A browser in somebody's shoes: the same ground, the island's word about it, a trowel. */
const browserFor = (who: Who, x = 50.5, y = 54.5): Game => {
  const g = Game.create(4242);
  shape(g);
  g.sawGround(groundFor(who, x, y));
  g.inventory.add('trowel', { ql: 40 });
  g.inventory.add('mallet', { ql: 40 });
  g.player.x = x;
  g.player.y = y;
  g.player.level = 0;
  return g;
};
const tileT = (x: number, y: number, side: Side, wallType: string, material: string): Target =>
  ({ kind: 'tile', x, y, cx: x, cy: y, side, wallType, material } as unknown as Target);
const tj = (t: Target): string => JSON.stringify(t).replace(/'/g, "''");
const islandSays = (who: Who, action: string, t: Target, x = 50.5, y = 52.5): string => psql(`
update player set x = ${x}, y = ${y}, level = 0 where world_id = ${W} and uid = '${WHO[who]}';
select coalesce(act_refusal(${W}, '${WHO[who]}', '${action}', '${tj(t)}'::jsonb), 'ALLOWED');`).split('\n').pop() as string;

/* ---- 1. what it is and what it costs ------------------------------------------- */

const def = WALL_TYPE_BY_ID.get(RUNE_GATE);
const row = psql(`select factor || ' ' || passable || ' ' || coalesce(height::text, '-') || ' ' || low || ' ' || railed || ' ' || standalone || ' '
  || wide || ' ' || beast_proof || ' ' || stone || ' ' || ground || ' ' || coalesce(laid_in, '-') from wall_type_def where id = '${RUNE_GATE}'`);
const rowHere = def ? `${def.factor} ${def.passable} ${def.height ?? '-'} ${!!def.low} ${!!def.railed} ${!!def.standalone} ${!!def.wide} ${!!def.beastProof} ${!!def.stone} ${!!def.ground} ${def.laidIn ?? '-'}` : '';
check('a rune gate is the same wall type on both sides: passable, wide, no beast stopped, on a border of its own, on the ground floor, nothing on it, laid in stone brick',
  !!def && row === rowHere && def.passable && !!def.wide && !def.beastProof && !!def.standalone && !!def.ground && !!def.low && !def.opaque && def.laidIn === MAT,
  `island ${row}; browser ${rowHere}`);
const fit = psql(`select string_agg(item || ' ' || count, ', ' order by item) from wall_fitting where type = '${RUNE_GATE}'`);
check('and a light mote is set in each pillar over the stone, on both sides',
  fit === [...(def?.fittings ?? [])].sort().map(([k, n]) => `${k} ${n}`).join(', ') && (def?.fittings ?? []).some(([k, n]) => k === 'light_mote' && n === 2), fit);
const billThere = JSON.parse(psql(`select wall_bill('${MAT}', '${RUNE_GATE}')`)) as Record<string, number>;
check('and it costs the same on both sides', same(wallBill(MAT, RUNE_GATE).total, billThere), `island ${said(billThere)}; browser ${said(wallBill(MAT, RUNE_GATE).total)}`);
check('and it holds no lock and nothing hangs in it: it has no hinge and no padlock', !(def?.fittings ?? []).some(([k]) => k === 'hinge' || k === 'padlock'), JSON.stringify(def?.fittings));

/* ---- 2. what it is laid in, in the same words ------------------------------------ */

{
  // Every material against every wall type, as `material_only_refusal` and `onlyRefusal` answer.
  const pairs = MATERIALS.flatMap((m) => WALL_TYPES.map((w) => [m.id, w.id] as const));
  const theirs = psql(`select string_agg(coalesce(material_only_refusal(m, w, null), '-'), '|' order by o)
    from unnest(array[${pairs.map(([m]) => `'${m}'`).join(', ')}]::text[], array[${pairs.map(([, w]) => `'${w}'`).join(', ')}]::text[]) with ordinality u(m, w, o)`).split('|');
  const mine = pairs.map(([m, w]) => onlyRefusal(m, { wall: w }) ?? '-');
  const differ = pairs.filter((_, i) => theirs[i] !== mine[i]).map(([m, w], i) => `${m}/${w}: "${mine[i]}" against "${theirs[i]}"`);
  const gateAnswers = MATERIALS.map((m) => onlyRefusal(m.id, { wall: RUNE_GATE }));
  check(`what every one of the ${MATERIALS.length} materials may be laid as, against every one of the ${WALL_TYPES.length} wall types, is answered in the same words on both sides`,
    differ.length === 0, differ.slice(0, 3).join('; '));
  check('a rune gate is taken in stone brick and in nothing else, with one sentence for the rest',
    // A material laid as only some things says so first: stained glass is a solid wall's, and says that.
    gateAnswers.every((a, i) => (MATERIALS[i].id === MAT ? a === null : a === (MATERIALS[i].only ? onlySaid(MATERIALS[i]) : laidInSaid(def!))))
      && laidInSaid(def!) === 'Rune gate: stone brick only.',
    `"${laidInSaid(def!)}"`);
  check('and no other wall type is held to one material', WALL_TYPES.filter((w) => w.laidIn).map((w) => w.id).join(',') === RUNE_GATE
    && psql(`select string_agg(id, ',') from wall_type_def where laid_in is not null`) === RUNE_GATE);
}

const PLAN_FENCE = ACTION_BY_ID.get('plan_fence');
const planBoth = (what: string, t: Target, want: string | null): void => {
  const g = browserFor('ida', 50.5, 52.5);
  const mine = PLAN_FENCE?.check?.(t, g) ?? 'ALLOWED';
  const theirs = islandSays('ida', 'plan_fence', t);
  check(what, mine === theirs && (want === null ? mine === 'ALLOWED' : mine === want), `browser "${mine}", island "${theirs}"`);
};
planBoth('Plan fence will not lay a rune gate in marble, in the same words', tileT(GATE.x, GATE.y, GATE.side, RUNE_GATE, 'marble'), laidInSaid(def!));
planBoth('nor in logs', tileT(GATE.x, GATE.y, GATE.side, RUNE_GATE, 'log'), laidInSaid(def!));
planBoth('but in stone brick it is planned', tileT(GATE.x, GATE.y, GATE.side, RUNE_GATE, MAT), null);
planBoth('while a half wall is still laid in marble', tileT(GATE.x, GATE.y, GATE.side, 'half_wall', 'marble'), null);

/* ---- 3. planning one ------------------------------------------------------------------ */

{
  const t = tileT(GATE.x, GATE.y, GATE.side, RUNE_GATE, MAT);
  const g = browserFor('ida', 50.5, 52.5);
  g.log.length = 0;
  PLAN_FENCE?.perform(t, g);
  const mine = g.log.map((l) => l.text).pop() ?? 'NOTHING SAID';
  const theirs = psql(`
update player set x = 50.5, y = 52.5, level = 0 where world_id = ${W} and uid = '${WHO.ida}';
delete from event where world_id = ${W} and uid = '${WHO.ida}';
select act_perform(${W}, '${WHO.ida}', 'plan_fence', '${tj(t)}'::jsonb) \\g /dev/null
select coalesce((select text from event where world_id = ${W} and uid = '${WHO.ida}' order by n desc limit 1), 'NOTHING SAID');`).split('\n').pop() as string;
  check('planning one says the same on both sides, naming it a rune gate and its bill', mine === theirs && mine.includes('rune gate') && mine.includes('light mote'),
    `browser "${mine}", island "${theirs}"`);
  const w = psql(`select type || ' ' || material || ' ' || level || ' ' || total::text from wall where world_id = ${W} and dir = 'h' and x = ${BORDER.x} and y = ${BORDER.y}`);
  const here = g.buildings.wallOnBorder(0, BORDER);
  check('and leaves the same wall on the border, its bill whole, on both sides',
    w.startsWith(`${RUNE_GATE} ${MAT} 0 `) && !!here && here.type === RUNE_GATE && same(here.total, JSON.parse(w.split(' ').slice(3).join(' '))), w);
  check('and the browser holds a rune gate, so it asks the island for the rolls', runeGatesHeld(g));
}

// Finished, on the island: its bill all in.
psql(`update wall set needed = (select jsonb_object_agg(k, 0) from jsonb_object_keys(total) k) where world_id = ${W} and dir = 'h' and x = ${BORDER.x} and y = ${BORDER.y};`);

/* ---- 4. what gets through ----------------------------------------------------------------- */

{
  const g = browserFor('tom', 50.5, 54.5);
  const person = !g.buildings.blocksAt(0, 50, 52, 50, 53);
  const beast = !g.buildings.blocksAt(0, 50, 52, 50, 53, true);
  const cart = !g.buildings.blocksVehicle(50, 52, 50, 53);
  check('a stranger, a beast and a cart all go through it: it shuts nothing out', person && beast && cart, `person ${person}, beast ${beast}, cart ${cart}`);
  g.player.x = 50.5;
  g.player.y = 54.5;
  g.vision.invalidate();
  g.vision.update();
  check('and the eye goes through it', g.vision.isVisible(50, 51), 'from 50,54 to 50,51');
  const fence = WALL_TYPE_BY_ID.get('fence');
  check('where a fence beside it stops all three', !!fence && !fence.passable, '');
}

/* ---- 5. who lights it ------------------------------------------------------------------------ */

const folkRows = (who: Who): string => psql(`select set_config('request.jwt.claims', json_build_object('sub', '${WHO[who]}')::text, false) \\g /dev/null
select rpc_rune_gate_folk(${W})::text;`).split('\n').pop() as string;
{
  const rows = JSON.parse(folkRows('tom')) as Array<{ x: number; y: number; folk: string[] }>;
  const mine = rows.find((r) => r.x === 49 && r.y === 49);
  check('the island sends whoever is ashore, a stranger too, the roll of the settlement a rune gate stands on: its founder and its builder, not its guest',
    !!mine && [...mine.folk].sort().join(',') === [WHO.ida, WHO.bea].sort().join(','), JSON.stringify(mine));
  check('and no settlement with no rune gate on it', rows.every((r) => psql(`select count(*) from wall w join deed d on d.world_id = w.world_id and d.x = ${r.x} and d.y = ${r.y}
    where w.world_id = ${W} and w.type = '${RUNE_GATE}'`) !== '0'), JSON.stringify(rows.map((r) => [r.x, r.y])));
  const refused = psql(`select set_config('request.jwt.claims', json_build_object('sub', 'b4e00000-0009-4000-8000-0000000000ff')::text, false) \\g /dev/null
do $$ begin perform rpc_rune_gate_folk(${W}); perform set_config('gate.ask', 'answered', false);
exception when others then perform set_config('gate.ask', sqlerrm, false); end $$;
select current_setting('gate.ask');`).split('\n').pop();
  check('and nobody who is not ashore', refused === 'you are not on this island', String(refused));
  // A gate whose own tile is outside the settlement and whose other side is in it stands on it as well.
  // Reaching from 53 to 59 it takes in only (50, 53), the tile the border is the north edge of; from 45 to 51, neither.
  psql(`update deed set y = 56 where world_id = ${W} and founded_by = '${WHO.ida}';`);
  const far = JSON.parse(folkRows('tom')) as Array<{ x: number; y: number }>;
  psql(`update deed set y = 48 where world_id = ${W} and founded_by = '${WHO.ida}';`);
  const neither = JSON.parse(folkRows('tom')) as Array<{ x: number; y: number }>;
  psql(`update deed set y = 49 where world_id = ${W} and founded_by = '${WHO.ida}';`);
  check('a settlement whose border takes in either tile of the gate\'s border has it, and one that takes in neither has not',
    far.some((r) => r.x === 49 && r.y === 56) && !neither.some((r) => r.x === 49 && r.y === 48),
    `reaching 53 to 59: ${JSON.stringify(far)}; reaching 45 to 51: ${JSON.stringify(neither)}`);
}

/** A browser playing `who`, the island's rolls in it, with `others` drawn standing where they are. */
const lighting = (who: Who, at: { x: number; y: number }, others: Array<[Who, { x: number; y: number }]> = []): Game => {
  const g = browserFor(who, at.x, at.y);
  sawGateFolk(g, JSON.parse(folkRows(who)) as unknown[]);
  others.forEach(([o, p], i) => g.roster.saw({
    id: i + 1, name: o, uid: WHO[o], x: p.x, y: p.y, dirX: 0, dirY: 1, level: 0, moving: false, swimming: false, working: false,
  }));
  g.player.x = at.x;
  g.player.y = at.y;
  return g;
};
const wallOf = (g: Game) => g.buildings.wallOnBorder(0, BORDER)!;
const inside = { x: MID.x, y: MID.y };
const away = { x: MID.x, y: MID.y + 2 };
const near = { x: MID.x, y: MID.y + RUNE_GATE_REACH - 0.01 };
const past = { x: MID.x, y: MID.y + RUNE_GATE_REACH + 0.01 };
{
  const g = lighting('ida', inside);
  check('Ida, who founded it, lights it standing in the opening', citizenInGate(g, BORDER) && runeGateLit(g, wallOf(g), 100).lit === 1);
  const g2 = lighting('ida', near);
  const g3 = lighting('ida', past);
  check(`within ${RUNE_GATE_REACH} of a tile of the middle of the opening and not past it`, citizenInGate(g2, BORDER) && !citizenInGate(g3, BORDER));
  const b = lighting('bea', inside);
  check('Bea, a builder on it, lights it playing', citizenInGate(b, BORDER));
  const tomSeesBea = lighting('tom', away, [['bea', inside]]);
  check('and a stranger\'s browser lights it for Bea drawn in the opening, off the roll the island sent', citizenInGate(tomSeesBea, BORDER));
  const tomSeesGus = lighting('tom', away, [['gus', inside], ['tom', inside]]);
  check('but not for Gus, a guest, nor for another stranger, in the opening', !citizenInGate(tomSeesGus, BORDER));
  check('nor for Gus playing, nor Tom', !citizenInGate(lighting('gus', inside), BORDER) && !citizenInGate(lighting('tom', inside), BORDER));
  const idaAway = lighting('ida', away, [['bea', past]]);
  check('nor while the nearest citizen is outside its reach', !citizenInGate(idaAway, BORDER));
  const noRolls = browserFor('tom', away.x, away.y);
  noRolls.roster.saw({ id: 1, name: 'bea', uid: WHO.bea, x: inside.x, y: inside.y, dirX: 0, dirY: 1, level: 0, moving: false, swimming: false, working: false });
  check('and a browser that has not had the rolls lights it for nobody else', !citizenInGate(noRolls, BORDER));

  // Its light: up at once, held while she stays, out over the fade once she goes.
  const w = wallOf(g);
  const t0 = 1000;
  const at0 = runeGateLit(g, w, t0);
  // Asked every frame, as the renderer asks it: a tenth of a second at a time for five seconds.
  for (let s = 0.1; s < 5; s += 0.1) runeGateLit(g, w, t0 + s);
  const held = runeGateLit(g, w, t0 + 5);
  g.player.x = away.x;
  g.player.y = away.y;
  const quarter = runeGateLit(g, w, t0 + 5 + RUNE_GATE_FADE / 4);
  const lights = runeGateLights(g, t0 + 5 + RUNE_GATE_FADE / 4, () => true);
  const half = runeGateLit(g, w, t0 + 5 + RUNE_GATE_FADE / 2);
  const gone = runeGateLit(g, w, t0 + 5 + RUNE_GATE_FADE + 0.01);
  check(`it lights at once, stays lit while she is in it, and goes out over ${RUNE_GATE_FADE} seconds once she is not`,
    at0.lit === 1 && at0.since === 0 && held.lit === 1 && Math.abs(held.since - 5) < 1e-9 && Math.abs(quarter.lit - 0.75) < 1e-9
      && Math.abs(half.lit - 0.5) < 1e-9 && gone.lit === 0,
    `lit ${at0.lit} ${held.lit} ${quarter.lit} ${half.lit} ${gone.lit}; since ${at0.since} ${held.since}`);
  check(`and after dark it throws pale gold ${RUNE_GATE_GLOW_REACH} tiles round the middle of its opening, as strong as it is lit`,
    lights.length === 1 && lights[0].radius === RUNE_GATE_GLOW_REACH && Math.abs(lights[0].strength - RUNE_GATE_GLOW * 0.75) < 1e-9
      && lights[0].x === MID.x && lights[0].y === MID.y, JSON.stringify(lights[0]));
  // Unfinished, it is dark whoever is in it.
  const u = lighting('ida', inside);
  const uw = wallOf(u);
  for (const k of Object.keys(uw.needed)) uw.needed[k] = uw.total[k];
  check('a rune gate not yet finished stays dark', runeGateLit(u, uw, 50).lit === 0);
}

/* ---- put Hoarding back ---------------------------------------------------------------------- */

psql(`
do $$
declare w uuid; r text;
begin
  select id into w from world where name = 'Hoarding';
  delete from wall where world_id = w and x between ${BOX.x0} and ${BOX.x1} and y between ${BOX.y0} and ${BOX.y1};
  delete from deed_member where world_id = w and (founder in (${EVERYBODY}) or uid in (${EVERYBODY}));
  delete from deed where world_id = w and founded_by in (${EVERYBODY});
  delete from item where world_id = w and holder = 'player' and holder_uid in (${EVERYBODY});
  delete from event where world_id = w and uid in (${EVERYBODY});
  delete from player where world_id = w and uid in (${EVERYBODY});
  foreach r in array string_to_array('${before[0]}', ';') loop
    perform land_set_height(w, split_part(r, ',', 1)::int, split_part(r, ',', 2)::int, split_part(r, ',', 3)::int);
  end loop;
  foreach r in array string_to_array('${before[1]}', ';') loop
    perform land_set_tile(w, split_part(r, ',', 1)::int, split_part(r, ',', 2)::int, split_part(r, ',', 3)::int);
  end loop;
end $$;`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
if (bad.length) process.exit(1);
