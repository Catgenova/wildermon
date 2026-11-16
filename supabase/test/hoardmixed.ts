/**
 * A Chestkit moves every item named for, not only mortar.
 *
 * Reported from the island: "hoardback is moving mortar perfectly, but isn't moving any of my Ancient Whetstones,
 * Marble Bricks, or anything else", the whetstones in a wagon and a trash crate named "Ancient Whetstone" for them.
 * The containers a named sort read were crates and the pieces that may be marked a store, less the marked ones: a
 * wagon, a cart, the settlement's marked stores and a trash crate were none of them read. Asked of the island and of
 * the browser, the same settlement:
 *
 *   * sources: a craft material bin "spill" with mortar and marble bricks; a chest marked a settlement store with
 *     marble bricks and a whetstone; an unnamed crate with a whetstone; a parked wagon with two (one to a row, they do
 *     not stack);
 *   * never sources: a cart in hand (pulled), and an unnamed trash crate, each with a whetstone;
 *   * targets: a craft material bin "Mortar", one "Marble  Bricks" (two spaces inside), and a trash crate "Ancient
 *     Whetstone": every item goes, the same loads in the same order on both sides, and then nothing to move;
 *   * what goes into the named trash crate is timed for it there (`binned_at`), as anything put into one is
 *     (`trashdecay.ts`);
 *   * a hatchet with only a craft material bin named for it, "HATCHETS", which takes no hatchet: it stays, and the
 *     idle reason names the item and the bin's own refusal, on both sides, and is sent to its card.
 *
 * The island half makes its own island and rolls it back.
 */
import { Game } from '../../src/game/game';
import { SPECIES, workRangeOf, type Creature, type GatherKind } from '../../src/game/creatures';
import { furnitureCentre, type PlacedFurniture } from '../../src/game/furniture';
import { crateCentre, type PlacedCrate } from '../../src/game/crates';
import type { Item } from '../../src/game/items';
import { idleSays, type Idle, type IdleWhy } from '../../src/game/workerlog';
import { TileType } from '../../src/world/tiles';
import { psql, check, finish } from './harness';

const T = 60;
const U = '7e5b0000-0000-4000-8000-000000000b01';
const DEED = 'Mixstead';
const SPILL = [T + 2, T] as const;
const STORE = [T - 3, T] as const;
const CRATE = [T, T + 3] as const;
const WAGON = [T - 5, T - 6] as const;
const CART = [T + 3, T - 5] as const;
const BIN = [T - 8, T - 2] as const;
const MORTAR = [T + 5, T] as const;
const BRICKS = [T + 6, T + 4] as const;
const TRASH = [T - 6, T + 4] as const;
const WRONG = [T + 8, T - 4] as const;
const NAMES = { spill: 'spill', mortar: 'Mortar', bricks: 'Marble  Bricks', trash: 'Ancient Whetstone', wrong: 'HATCHETS' };

/* ---- the browser -------------------------------------------------------- */

const g = Game.create(259, 512);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
g.deed = { name: DEED, x: T, y: T, radius: 10, level: 5 };
let uid = 1;
const it = (id: string, count: number, ql = 30): Item => ({ uid: uid++, id, ql, dmg: 0, count });
const spill = g.addFurniture('craft_bin', SPILL[0], SPILL[1], 0, 0, 50, [it('mortar', 50), it('marble_brick', 20)]);
spill.name = NAMES.spill;
const store = g.addFurniture('chest', STORE[0], STORE[1], 0, 0, 50, [it('marble_brick', 10), it('ancient_whetstone', 1)]);
store.storeOf = U;
const crate: PlacedCrate = g.addCrate('log', CRATE[0], CRATE[1], 0, 0, [it('ancient_whetstone', 1)]);
const wagon = g.addFurniture('wagon', WAGON[0], WAGON[1], 0, 0, 50, [it('ancient_whetstone', 1), it('ancient_whetstone', 1)]);
const cart = g.addFurniture('cart', CART[0], CART[1], 0, 0, 50, [it('ancient_whetstone', 1)]);
cart.hitched = true;
const bin = g.addFurniture('trash_crate', BIN[0], BIN[1], 0, 0, 50, [it('ancient_whetstone', 1)]);
const mortar = g.addFurniture('craft_bin', MORTAR[0], MORTAR[1], 0, 0, 50, []);
mortar.name = NAMES.mortar;
const bricks = g.addFurniture('craft_bin', BRICKS[0], BRICKS[1], 0, 0, 50, []);
bricks.name = NAMES.bricks;
const trash = g.addFurniture('trash_crate', TRASH[0], TRASH[1], 0, 0, 50, []);
trash.name = NAMES.trash;
const magga = g.creatures.spawn('magga', T + 0.5, T + 0.5, 'deed', () => 0.5, -1e9);
magga.traits = [];
const step = (c: Creature): void =>
  (g.creatures as unknown as { updateWorker(c: Creature, dt: number, game: Game): void }).updateWorker(c, 0.25, g);
const run = (secs: number): string => {
  const seq: string[] = [];
  let last = '';
  for (let t = 0; t < secs; t += 0.25) {
    g.time += 0.25;
    magga.hunger = 1;
    step(magga);
    const now = magga.carrying ? `${magga.carrying.id}:${magga.carrying.count}` : '';
    if (now !== last && now) seq.push(now);
    last = now;
  }
  return seq.join(',');
};
const n = (items: Item[], id: string): number => items.filter((x) => x.id === id).reduce((k, x) => k + x.count, 0);
const idleOf = (c: Creature): string => (c.idle ? `${c.idle.why}|${Math.round(c.idle.n)}|${(c.idle.what ?? []).join(',')}` : '');
const state = (): string => [
  `spill ${n(spill.items, 'mortar')}/${n(spill.items, 'marble_brick')}`,
  `store ${n(store.items, 'marble_brick')}/${n(store.items, 'ancient_whetstone')}/${n(store.items, 'hatchet')}`,
  `crate ${n(crate.items, 'ancient_whetstone')}`,
  `wagon ${n(wagon.items, 'ancient_whetstone')}`,
  `cart ${n(cart.items, 'ancient_whetstone')}`,
  `bin ${n(bin.items, 'ancient_whetstone')}`,
  `mortar ${n(mortar.items, 'mortar')}`,
  `bricks ${n(bricks.items, 'marble_brick')}`,
  `trash ${n(trash.items, 'ancient_whetstone')}`,
].join(' ');

const browser: Record<string, string> = {};
browser.SEQ = run(1800);
browser.STATE = state();
browser.IDLE = idleOf(magga);
// A hatchet in the store, and a craft material bin named for hatchets, which takes none.
store.items.push(it('hatchet', 1));
const wrong = g.addFurniture('craft_bin', WRONG[0], WRONG[1], 0, 0, 50, []);
wrong.name = NAMES.wrong;
browser.SEQ2 = run(300);
browser.STATE2 = `${state()} wrong ${n(wrong.items, 'hatchet')}`;
browser.IDLE2 = idleOf(magga);

/* ---- the island ----------------------------------------------------------- */

const centre = (f: PlacedFurniture): string => furnitureCentre(f).join(', ');
const placed = (sub: string, f: PlacedFurniture, extra = ''): string =>
  `'furniture', '${sub}', ${f.x}, ${f.y}, ${f.sx}, ${f.sy}, ${centre(f)}, 50, u${extra}`;
const STATE_SQL = `'spill ' || pg_temp.n(v_spill, 'mortar') || '/' || pg_temp.n(v_spill, 'marble_brick')
    || ' store ' || pg_temp.n(v_store, 'marble_brick') || '/' || pg_temp.n(v_store, 'ancient_whetstone') || '/' || pg_temp.n(v_store, 'hatchet')
    || ' crate ' || pg_temp.c(v_crate, 'ancient_whetstone') || ' wagon ' || pg_temp.n(v_wagon, 'ancient_whetstone')
    || ' cart ' || pg_temp.n(v_cart, 'ancient_whetstone') || ' bin ' || pg_temp.n(v_bin, 'ancient_whetstone')
    || ' mortar ' || pg_temp.n(v_mortar, 'mortar') || ' bricks ' || pg_temp.n(v_bricks, 'marble_brick')
    || ' trash ' || pg_temp.n(v_trash, 'ancient_whetstone')`;
const IDLE_SQL = `coalesce(idle_why, '') || '|' || coalesce(round(idle_n)::text, '') || '|' || coalesce(array_to_string(idle_what, ','), '')`;
const isle = new Map(psql(`
discard temp;
begin;
create temp table said (k text, v text);
create function pg_temp.settle(w uuid, m int, k int) returns text language plpgsql as $f$
declare i int; seq text := ''; v_now text; v_last text := '';
begin
  for i in 1..k loop
    update creature set until = now() - interval '1 millisecond', leg_at = now() - interval '2 milliseconds',
           leg_ends = now() - interval '1 millisecond', hunger = 1
     where world_id = w and id = m;
    perform worker_settle(w, m);
    select coalesce((carrying->>'def') || ':' || coalesce(carrying->>'count', '1'), '') into v_now from creature where world_id = w and id = m;
    if v_now <> v_last and v_now <> '' then seq := seq || case when seq = '' then '' else ',' end || v_now; end if;
    v_last := v_now;
  end loop;
  return seq;
end $f$;
create function pg_temp.n(p bigint, p_def text) returns int language sql as $f$
  select coalesce(sum(count), 0)::int from item where placed = p and def = p_def $f$;
create function pg_temp.c(p bigint, p_def text) returns int language sql as $f$
  select coalesce(sum(count), 0)::int from item where holder = 'crate' and crate = p and def = p_def $f$;
do $t$
declare w uuid; u uuid := '${U}'; m int; v_spill bigint; v_store bigint; v_crate bigint; v_wagon bigint; v_cart bigint; v_bin bigint;
        v_mortar bigint; v_bricks bigint; v_trash bigint; v_wrong bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Hoardmixed', 259, 400, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 400);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(${T - 30}, ${T + 30}) x, generate_series(${T - 30}, ${T + 30}) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mixer');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, '${DEED}', ${T}, ${T}, 10, 5, u);
  update player set x = ${T} + 0.5, y = ${T} + 0.5, body_at = now(), swim_at = now(), seen_at = now() where world_id = w;

  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, name) values (w, ${placed('craft_bin', spill)}, '${NAMES.spill}') returning id into v_spill;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_spill, 'mortar', 30, 50), (w, 'furniture', v_spill, 'marble_brick', 30, 20);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, store_of) values (w, ${placed('chest', store)}, u) returning id into v_store;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_store, 'marble_brick', 30, 10), (w, 'furniture', v_store, 'ancient_whetstone', 30, 1);
  v_crate := coalesce((select max(id) from crate), 0) + 1;
  insert into crate (world_id, id, kind, x, y, sx, sy, made_by) values (w, v_crate, 'log', ${CRATE[0]}, ${CRATE[1]}, 0, 0, u);
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', v_crate, 'ancient_whetstone', 30, 1);
  insert into said values ('CRATEXY', (select crate_centre_x(cr) || ', ' || crate_centre_y(cr) from crate cr where cr.world_id = w and cr.id = v_crate));
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by) values (w, ${placed('wagon', wagon)}) returning id into v_wagon;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_wagon, 'ancient_whetstone', 30, 1), (w, 'furniture', v_wagon, 'ancient_whetstone', 30, 1);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, puller) values (w, ${placed('cart', cart)}, u) returning id into v_cart;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_cart, 'ancient_whetstone', 30, 1);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by) values (w, ${placed('trash_crate', bin)}) returning id into v_bin;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_bin, 'ancient_whetstone', 30, 1);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, name) values (w, ${placed('craft_bin', mortar)}, '${NAMES.mortar}') returning id into v_mortar;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, name) values (w, ${placed('craft_bin', bricks)}, '${NAMES.bricks}') returning id into v_bricks;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, name) values (w, ${placed('trash_crate', trash)}, '${NAMES.trash}') returning id into v_trash;
  m := creature_spawn(w, 'magga', ${T} + 0.5, ${T} + 0.5, 'deed', now() - interval '60 days', u);
  update creature set traits = '{}', rare = null, form_size = null, keeper = u, phase = 'idle', carrying = null, job = null, post = null, hunger = 1,
         from_x = ${T} + 0.5, from_y = ${T} + 0.5, to_x = ${T} + 0.5, to_y = ${T} + 0.5
   where world_id = w and id = m;

  insert into said values ('SEQ', pg_temp.settle(w, m, 300));
  insert into said values ('STATE', ${STATE_SQL});
  insert into said select 'IDLE', ${IDLE_SQL} from creature where world_id = w and id = m;
  insert into said values ('RANGE', (select work_range(c)::text from creature c where world_id = w and id = m));
  insert into said values ('KEPT', (select coalesce(sum(count), 0) || '|' || round(coalesce(max(dmg), 0)) || '|' || bool_and(binned_at is not null) from item where placed = v_trash and def = 'ancient_whetstone'));

  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_store, 'hatchet', 30, 1);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, name) values (w, ${placed('craft_bin', wrong)}, '${NAMES.wrong}') returning id into v_wrong;
  insert into said values ('SEQ2', pg_temp.settle(w, m, 60));
  insert into said values ('STATE2', ${STATE_SQL} || ' wrong ' || pg_temp.n(v_wrong, 'hatchet'));
  insert into said select 'IDLE2', ${IDLE_SQL} from creature where world_id = w and id = m;
  -- What its card is sent (\`rpc_creatures\`): the item and the bin with the reason.
  insert into said select 'SENT', coalesce((e->>'idleWhy') || '|' || coalesce((e->'idleWhat')::text, ''), '')
    from jsonb_array_elements(rpc_creatures(w, 40)) e where (e->>'id')::int = m;
end $t$;
select k || '=' || coalesce(v, '') from said;
rollback;
`).split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

/* ---- the two side by side -------------------------------------------------- */

const [ccx, ccy] = crateCentre(crate);
check('the crate stands where both sides say', isle.get('CRATEXY') === `${ccx}, ${ccy}`, `${isle.get('CRATEXY')} / ${ccx}, ${ccy}`);
const STATE = 'spill 0/0 store 0/0/0 crate 0 wagon 0 cart 1 bin 1 mortar 50 bricks 30 trash 4';
const seq = browser.SEQ.split(',');
check(`every item named for goes, the same loads in the same order on both sides: ${browser.SEQ}`,
  isle.get('SEQ') === browser.SEQ && seq.filter((l) => l === 'ancient_whetstone:1').length === 4
  && seq.includes('mortar:50') && seq.includes('marble_brick:20') && seq.includes('marble_brick:10'), `${isle.get('SEQ')} / ${browser.SEQ}`);
check('out of "spill", the marked store, the crate and the parked wagon; into "Mortar", "Marble  Bricks" and the trash crate "Ancient Whetstone"; never out of a pulled cart or an unnamed trash crate',
  isle.get('STATE') === STATE && browser.STATE === STATE, `${isle.get('STATE')} / ${browser.STATE}`);
const reach = workRangeOf(magga, SPECIES.magga);
check('nothing left: nothing to move, on both sides', isle.get('IDLE') === `nomove|${reach}|` && browser.IDLE === `nomove|${reach}|`
  && isle.get('RANGE') === String(reach), `${isle.get('IDLE')} / ${browser.IDLE}`);
check('the trash crate named for them holds the 4 whetstones, undamaged, each timed from put in',
  isle.get('KEPT') === '4|0|true', isle.get('KEPT'));

const says = (k: string): string => {
  const [why, nn, what] = k.split('|');
  return idleSays({ why: why as IdleWhy, n: Number(nn), ...(what ? { what: what.split(',') } : {}) } as Idle, SPECIES.magga.gathers as GatherKind);
};
check('a hatchet with only a craft material bin named for it stays where it is, on both sides',
  isle.get('SEQ2') === '' && browser.SEQ2 === '' && isle.get('STATE2') === `${STATE.replace('store 0/0/0', 'store 0/0/1')} wrong 0`
  && browser.STATE2 === isle.get('STATE2'), `${isle.get('SEQ2')} ${isle.get('STATE2')} / ${browser.SEQ2} ${browser.STATE2}`);
const REFUSED = `namedrefuses|${reach}|hatchet,craft_bin`;
check(`and says so: "${says(REFUSED)}", on both sides`, isle.get('IDLE2') === REFUSED && browser.IDLE2 === REFUSED,
  `${isle.get('IDLE2')} / ${browser.IDLE2}`);
check('its card is sent the item and the bin', isle.get('SENT') === 'namedrefuses|["hatchet", "craft_bin"]', isle.get('SENT'));
check('the reason names the item and the bin\'s own refusal', says(REFUSED).includes('hatchet refused: Craft material bin: worked materials only'),
  says(REFUSED));

finish('every item named for, not only mortar');
