/**
 * The ground read asked by a browser that keeps what it holds: a piece's contents only when they may have changed,
 * and the walls and floors only as they changed since its own cursor for them.
 *
 * Read off the island (2026-11-17): the ground read a browser asks every second was 33 kB for a player driving a
 * loaded wagon, 33.0 kB of it the wagon's 171 stacks, sent again every second because the wagon's row is written as
 * it moves; and the slow half, every minute and after every building job, 382 kB on Solara, 267 kB of it the walls
 * and floors in range. Asked with `p_keep` and `p_build_since` (`GroundHeld`):
 *
 *   * a driven wagon sent again leaves out its 150 stacks, and the browser keeps them: what it holds is what the whole
 *     answer says, and the read is a fraction of the one without `p_keep`;
 *   * a thing put into the wagon, and one taken out of a chest within reach, bring their contents again;
 *   * walking off past reach, the wagon comes with its contents as the whole answer has them (none);
 *   * the slow half with the cursor for walls and floors: nothing changed sends none of them; a wall written, a floor
 *     taken up, a wall's planned change put down and taken away, each sends only what it must, and what the browser
 *     holds after each is what the whole answer says, wall for wall and floor for floor;
 *   * a hidden door is sent every time (whose padlock admits whom is not its row);
 *   * a browser that asks without `p_keep` gets what it always got.
 *
 * Every ask is its own transaction, as a browser's are. Makes its own island, and takes it away again.
 */
import { GroundHeld, type GroundAnswer } from '../../src/net/groundsync';
import { psql, check, finish } from './harness';

const ME = 'fdd30000-0000-4000-8000-0000000000c1';
const ISLE = 'Groundkeep';
const W = `(select id from world where name = '${ISLE}')`;
const as = (who: string): string =>
  `select set_config('request.jwt.claims', json_build_object('sub', '${who}')::text, false) \\g /dev/null\n`;
const q = (s: string | null): string => (s === null ? 'null' : `'${s.replace(/'/g, "''")}'`);
const call = (slow: boolean, since: string, keep: boolean, build: string | null): string =>
  `rpc_ground(${W}, 40, ${slow}, ${q(since)}, ${keep}, ${q(build)})`;

/** The read asked after `change` (its own transaction), and the whole answer, both in one transaction after it. */
const both = (change: string, slow: boolean, since: string, build: string | null, keep = true): { delta: GroundAnswer; whole: Record<string, unknown>; bytes: number } => {
  if (change) psql(change);
  const out = psql(`${as(ME)}begin;
delete from caller where uid = '${ME}';
select ${call(slow, since, keep, build)}::text;
delete from caller where uid = '${ME}';
select ${call(slow, '', keep, null)}::text;
commit;`).split('\n');
  return { delta: JSON.parse(out[0]) as GroundAnswer, whole: JSON.parse(out[1]) as Record<string, unknown>, bytes: out[0].length };
};

/* ---- the island ------------------------------------------------------------------------------------------------- */

const made = psql(`
delete from world where name = '${ISLE}';
create temp table gk (k text, id bigint);
do $t$
declare w uuid; me uuid := '${ME}'; v bigint; gx int; gy int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('${ISLE}', 333, 200, 100, 100, true) returning id into w;
  perform land_blank(w, 200);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(40, 180) x, generate_series(40, 160) y;
  perform set_config('request.jwt.claims', json_build_object('sub', me)::text, true);
  perform rpc_join(w, 'Keeper');
  update player set x = 100.5, y = 100.5, body_at = now(), swim_at = now(), seen_at = now(), away = false where world_id = w and uid = me;
  -- A wagon, driven, with 150 stacks in it; and a chest within reach.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, made_at, driver, material)
    values (w, 'furniture', 'wagon', 101, 101, 0, 0, 101.5, 101.5, 30, me, now() - interval '5 days', me, 'oak') returning id into v;
  insert into gk values ('WAGON', v);
  insert into item (world_id, holder, placed, def, ql, count) select w, 'furniture', v, 'log', 10 + g % 80, 1 from generate_series(1, 150) g;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, made_at, material)
    values (w, 'furniture', 'chest', 102, 99, 0, 0, 102.5, 99.5, 40, me, now() - interval '3 days', 'oak') returning id into v;
  insert into gk values ('CHEST', v);
  insert into item (world_id, holder, placed, def, ql, count) select w, 'furniture', v, d, 30, 2 from unnest(array['log', 'stone', 'plank']) d;
  -- A hall of two storeys at 90..93, its walls round both, a floor over the ground storey, and a hidden door.
  insert into building (world_id, id, name, levels, planned_by) values (w, 1, 'Hall', 2, me);
  for gx in 90 .. 93 loop for gy in 90 .. 93 loop
    insert into building_tile (world_id, building, x, y) values (w, 1, gx, gy);
    insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total) values (w, 1, gx, gy, 1, 'log', 'floor', '{"log": 0}', '{"log": 2}');
  end loop; end loop;
  for gx in 90 .. 93 loop
    insert into wall (world_id, level, dir, x, y, building, type, material, needed, total)
      select w, l, 'h', gx, yy, 1, case when l = 0 and gx = 91 and yy = 90 then 'hidden_door' else 'solid' end, 'log', '{"log": 0}', '{"log": 4}'
        from generate_series(0, 1) l, unnest(array[90, 94]) yy;
    insert into wall (world_id, level, dir, x, y, building, type, material, needed, total)
      select w, l, 'v', xx, gx, 1, 'solid', 'log', '{"log": 0}', '{"log": 4}' from generate_series(0, 1) l, unnest(array[90, 94]) xx;
  end loop;
end $t$;
select string_agg(k || '=' || id, ',' order by k) from gk;
`);
const ID: Record<string, number> = Object.fromEntries(made.split('\n').pop()!.split(',').map((kv) => {
  const [k, v] = kv.split('=');
  return [k, Number(v)];
}));
check('the island is made with its pieces', ID.WAGON > 0 && ID.CHEST > 0, made.split('\n').pop());

type Rec = Record<string, unknown>;
const placedOf = (g: Rec, id: number): Rec | undefined => (g.placed as Rec[] | undefined)?.find((r) => r.id === id);
const thingsOf = (g: Rec, id: number): string => JSON.stringify(placedOf(g, id)?.things ?? null);
const key = (r: Rec): string => [r.level, r.dir ?? '', r.x, r.y].join(',');
/** Walls or floors, each as it says, in one order, its ivy's seconds rounded off (the two reads are a moment apart). */
const rows = (b: unknown, k: 'walls' | 'floors'): string =>
  JSON.stringify(((b as Rec | undefined)?.[k] as Rec[] ?? []).map((r) => ({ ...r, greenAgo: typeof r.greenAgo === 'number' ? Math.round(r.greenAgo) : r.greenAgo }))
    .sort((a, b2) => (key(a) < key(b2) ? -1 : key(a) > key(b2) ? 1 : 0)));

const held = new GroundHeld();

/* ---- a wagon's contents ----------------------------------------------------------------------------------------- */

const first = both('', true, '', null);
const firstLaid = held.take(first.delta);
check('the whole answer, slow half and all, is laid; it carries a cursor for the walls and floors',
  !!firstLaid && typeof held.at === 'string' && typeof held.bat === 'string' && held.bat.startsWith('b1:'), String(held.bat));
check('the wagon comes with its 150 stacks', JSON.parse(thingsOf(firstLaid ?? {}, ID.WAGON)).length === 150, thingsOf(firstLaid ?? {}, ID.WAGON).slice(0, 60));

const old = both('', false, held.at!, null, false);
const kept = both('', false, held.at!, null);
const sent = placedOf(kept.delta as Rec, ID.WAGON);
check('asked again, the driven wagon is sent again for its row, without its contents',
  !!sent && !('things' in sent), JSON.stringify(sent ?? null).slice(0, 120));
const keptLaid = held.take(kept.delta);
check('the browser keeps the wagon\'s 150 stacks, as the whole answer has them',
  !!keptLaid && thingsOf(keptLaid, ID.WAGON) === thingsOf(kept.whole, ID.WAGON) && JSON.parse(thingsOf(keptLaid, ID.WAGON)).length === 150);
check(`the read is ${kept.bytes} bytes, against ${old.bytes} asked without p_keep (a fifth of it at most)`,
  kept.bytes * 5 <= old.bytes, `${kept.bytes} / ${old.bytes}`);
const oldWagon = placedOf(old.delta as Rec, ID.WAGON);
check('asked without p_keep, the wagon comes with its contents, as it always did',
  !!oldWagon && Array.isArray(oldWagon.things) && (oldWagon.things as unknown[]).length === 150);

const put = both(`insert into item (world_id, holder, placed, def, ql, count) values (${W}, 'furniture', ${ID.WAGON}, 'stone', 30, 1);`, false, held.at!, null);
const putLaid = held.take(put.delta);
check('a thing put into the wagon: its contents come again, 151, as the whole answer has them',
  'things' in (placedOf(put.delta as Rec, ID.WAGON) ?? {}) && !!putLaid && thingsOf(putLaid, ID.WAGON) === thingsOf(put.whole, ID.WAGON)
  && JSON.parse(thingsOf(putLaid, ID.WAGON)).length === 151);

const took = both(`delete from item where id = (select min(id) from item where placed = ${ID.CHEST});`, false, held.at!, null);
const tookLaid = held.take(took.delta);
check('a thing taken out of a chest within reach: the chest as the whole answer has it, and the wagon too',
  !!tookLaid && thingsOf(tookLaid, ID.CHEST) === thingsOf(took.whole, ID.CHEST) && JSON.parse(thingsOf(tookLaid, ID.CHEST)).length === 2
  && thingsOf(tookLaid, ID.WAGON) === thingsOf(took.whole, ID.WAGON));

const walked = both(`update player set x = 110.5 where world_id = ${W} and uid = '${ME}';`, false, held.at!, null);
const walkedLaid = held.take(walked.delta);
check('walked off past reach: the wagon and the chest as the whole answer has them, with nothing in them',
  !!walkedLaid && thingsOf(walkedLaid, ID.WAGON) === thingsOf(walked.whole, ID.WAGON) && thingsOf(walkedLaid, ID.WAGON) === '[]'
  && thingsOf(walkedLaid, ID.CHEST) === '[]');
const back = both(`update player set x = 100.5 where world_id = ${W} and uid = '${ME}';`, false, held.at!, null);
const backLaid = held.take(back.delta);
check('and back: the wagon\'s 151 stacks again', !!backLaid && thingsOf(backLaid, ID.WAGON) === thingsOf(back.whole, ID.WAGON)
  && JSON.parse(thingsOf(backLaid, ID.WAGON)).length === 151);

/* ---- the walls and floors --------------------------------------------------------------------------------------- */

const wallsIn = (g: GroundAnswer): Rec[] => ((g.buildings as Rec | undefined)?.walls as Rec[] | undefined) ?? [];
const floorsIn = (g: GroundAnswer): Rec[] => ((g.buildings as Rec | undefined)?.floors as Rec[] | undefined) ?? [];
const slow = (what: string, change: string): { delta: GroundAnswer; laid: Rec | null; whole: Rec; bytes: number; wholeBytes: number } => {
  const r = both(change, true, held.at!, held.bat);
  const laid = held.take(r.delta);
  const wholeBytes = JSON.stringify(r.whole.buildings ?? null).length;
  check(`${what}: the walls and floors held are the whole answer's, wall for wall and floor for floor`,
    !!laid && rows(laid.buildings, 'walls') === rows(r.whole.buildings, 'walls') && rows(laid.buildings, 'floors') === rows(r.whole.buildings, 'floors')
      && (r.whole.buildings as Rec).walls !== undefined,
    `${(laid?.buildings as Rec | undefined)?.walls ? ((laid!.buildings as Rec).walls as unknown[]).length : '-'} walls held / ${((r.whole.buildings as Rec).walls as unknown[]).length}`);
  return { delta: r.delta, laid, whole: r.whole, bytes: JSON.stringify(r.delta.buildings ?? null).length, wholeBytes };
};

const still = slow('nothing changed', '');
const stillB = still.delta.buildings as Rec;
check('nothing changed: the buildings say delta, with the hidden door and no other wall, no floor, and no keys',
  stillB.delta === true && wallsIn(still.delta).length === 1 && wallsIn(still.delta)[0].type === 'hidden_door' && floorsIn(still.delta).length === 0
    && !('wallKeys' in stillB) && !('floorKeys' in stillB),
  JSON.stringify({ walls: wallsIn(still.delta).length, floors: floorsIn(still.delta).length, keys: 'wallKeys' in stillB }));
check(`and the buildings are ${still.bytes} bytes against ${still.wholeBytes} whole`, still.bytes * 5 <= still.wholeBytes, `${still.bytes} / ${still.wholeBytes}`);

const built = slow('a wall built up', `update wall set needed = '{"log": 1}' where world_id = ${W} and level = 1 and dir = 'h' and x = 92 and y = 94;`);
check('a wall built up: it is sent, with the hidden door, and the keys',
  wallsIn(built.delta).length === 2 && wallsIn(built.delta).some((w) => w.x === 92 && w.y === 94 && w.level === 1) && 'wallKeys' in (built.delta.buildings as Rec),
  JSON.stringify(wallsIn(built.delta).map(key)));

slow('a floor taken up', `delete from floor_tile where world_id = ${W} and level = 1 and x = 90 and y = 90;`);
const upB = (held as unknown as { floors: Map<string, unknown> }).floors;
check('a floor taken up: the browser lets it go', !!upB && upB.size === 15 && !upB.has('1,90,90'), String(upB?.size));

const planned = slow('a change planned for a wall', `insert into wall_change (world_id, level, dir, x, y, type, material, needed, total)
  values (${W}, 0, 'v', 90, 92, 'window', 'log', '{"log": 0}', '{"log": 2}');`);
check('a change planned for a wall: that wall is sent, with its change',
  wallsIn(planned.delta).some((w) => w.x === 90 && w.y === 92 && w.dir === 'v' && w.level === 0 && !!w.change), JSON.stringify(wallsIn(planned.delta).map(key)));
const dropped = slow('the change taken away', `delete from wall_change where world_id = ${W};`);
check('the change taken away: every wall is sent again, and the wall has no change',
  wallsIn(dropped.delta).length === wallsIn(dropped.whole as GroundAnswer).length
    && !wallsIn(dropped.delta).some((w) => w.x === 90 && w.y === 92 && w.dir === 'v' && w.level === 0 && !!w.change));

const walk2 = slow('walked 20 tiles off and asked again', `update player set x = 120.5 where world_id = ${W} and uid = '${ME}';`);
check('walked off: the walls and floors as the whole answer has them', !!walk2.laid);

// A cursor read over another range, or one that cannot be read, is answered with every wall and floor.
const odd = both('', true, held.at!, 'b1:nonsense');
check('a walls-and-floors cursor that cannot be read is answered whole', (odd.delta.buildings as Rec).delta === undefined
  && wallsIn(odd.delta).length === wallsIn(odd.whole as GroundAnswer).length);

psql(`delete from world where name = '${ISLE}';`);
finish('The ground read, kept by the browser');
