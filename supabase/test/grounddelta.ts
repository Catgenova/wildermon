/**
 * The ground read: the same answer for less, and only what changed since the last one.
 *
 * Asked for: "streamline cpu". `rpc_ground` was 8% of the live island's database time, every browser asking it once
 * a second while it moves or works for everything set down within forty tiles. Measured here:
 *
 *   * the read with its short cut (the water asked only of a well) says what the same read says with the short cut
 *     taken out, key for key, on the burning half and the slow one; and its whole answer in the new shape says the
 *     same, with a cursor;
 *   * a browser that says no cursor (a page from before this) gets what it always got;
 *   * handed back its cursor, the read sends exactly what changed: a piece renamed, one set down, a thing put in a
 *     chest within reach and one taken out of another, a thing dropped; says which went (a piece taken up, a thing
 *     picked up) by leaving it out of `ids`; and sends nothing else but those whose answer moves without their row
 *     being written (burning, a well, a mossy one, a grave, a counter, a boat, one driven);
 *   * a browser laying those answers (`GroundHeld`, the browser's own) holds, after every one of them, what the whole
 *     answer says at that moment, key for key: each asked in the same transaction as the whole answer it is held
 *     against, so the clock is the same for both; walking off, and things changing about it, included;
 *   * asked in one round trip with the creatures (`rpc_near`), each is what it says on its own;
 *   * a cursor that is unreadable, too old, or read over another range is answered whole;
 *   * and the browser asks for the whole answer well within the time a cursor is good for.
 *
 * Every step is its own transaction, as a browser's asks are: a cursor is a snapshot, and only rows written by
 * transactions after it are new to it. Makes its own island, and takes it away again.
 */
import { execFileSync } from 'node:child_process';
import { RECONCILE_EVERY } from '../../src/game/keep';
import { GroundHeld, GROUND_LISTS, type GroundAnswer } from '../../src/net/groundsync';

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

const ME = 'fdd20000-0000-4000-8000-0000000000b1';
const YOU = 'fdd20000-0000-4000-8000-0000000000b2';
const ISLE = 'Grounddelta';
const W = `(select id from world where name = '${ISLE}')`;
const as = (who: string): string =>
  `select set_config('request.jwt.claims', json_build_object('sub', '${who}')::text, false) \\g /dev/null\n`;
const call = (args: string): string => `rpc_ground(${W}, 40${args})`;

/** One ask in a transaction of its own; the answer as JSON. */
const ask = (args: string): GroundAnswer => JSON.parse(psql(`${as(ME)}delete from caller where uid = '${ME}';
select ${call(args)}::text;`)) as GroundAnswer;

/**
 * The delta handed back `at` and the whole answer as a page from before this asks it, in one transaction, so both
 * read the same rows on the same clock.
 */
const both = (at: string, slow = false): { delta: GroundAnswer; whole: Record<string, unknown> } => {
  const out = psql(`${as(ME)}begin;
delete from caller where uid = '${ME}';
select ${call(`, ${slow}, '${at}'`)}::text;
delete from caller where uid = '${ME}';
select ${call(`, ${slow}`)}::text;
commit;`).split('\n');
  return { delta: JSON.parse(out[0]) as GroundAnswer, whole: JSON.parse(out[1]) as Record<string, unknown> };
};

/* ---- the island ------------------------------------------------------------------------------------------------- */

const made = psql(`
delete from world where name = '${ISLE}';
create temp table gd (k text, id bigint);
do $t$
declare w uuid; me uuid := '${ME}'; you uuid := '${YOU}'; v bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('${ISLE}', 332, 200, 100, 100, true) returning id into w;
  perform land_blank(w, 200);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(40, 180) x, generate_series(40, 160) y;
  perform set_config('request.jwt.claims', json_build_object('sub', you)::text, true);
  perform rpc_join(w, 'Groundee');
  perform set_config('request.jwt.claims', json_build_object('sub', me)::text, true);
  perform rpc_join(w, 'Grounder');
  update player set x = 100.5, y = 100.5, body_at = now(), swim_at = now(), seen_at = now(), away = false where world_id = w and uid = me;
  update player set x = 104.5, y = 100.5, body_at = now(), swim_at = now(), seen_at = now(), away = false where world_id = w and uid = you;
  -- A chest within reach and one past it, each with things in it.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, made_at, material)
    values (w, 'furniture', 'chest', 102, 101, 0, 0, 102.5, 101.5, 40, me, now() - interval '3 days', 'oak') returning id into v;
  insert into gd values ('NEAR', v);
  insert into item (world_id, holder, placed, def, ql, count) select w, 'furniture', v, d, 30, 2 from unnest(array['log', 'stone', 'plank']) d;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, made_at, material)
    values (w, 'furniture', 'chest', 120, 100, 0, 0, 120.5, 100.5, 40, me, now() - interval '3 days', 'oak') returning id into v;
  insert into gd values ('FAR', v);
  insert into item (world_id, holder, placed, def, ql, count) select w, 'furniture', v, d, 30, 2 from unnest(array['log', 'stone']) d;
  -- A second chest past reach the other way, which walking brings into it.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, made_at, material)
    values (w, 'furniture', 'barrel', 89, 100, 0, 0, 89.5, 100.5, 40, you, now() - interval '3 days', 'oak') returning id into v;
  insert into gd values ('WEST', v);
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v, 'log', 20, 5);
  -- A table nobody touches, and one past the range that walking brings into it.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, made_at) values (w, 'furniture', 'table', 110, 110, 0, 0, 110.5, 110.5, 30, me, now() - interval '2 days') returning id into v;
  insert into gd values ('TABLE', v);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, made_at) values (w, 'furniture', 'table', 55, 100, 0, 0, 55.5, 100.5, 30, me, now() - interval '2 days') returning id into v;
  insert into gd values ('OFF', v);
  -- A fire burning and one out; a well filling; a statue greening; a counter with wares; your grave; a boat; a cart driven.
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, lit, ash, since, made_by, state)
    values (w, 'campfire', 95, 95, 0, 0, 95.5, 95.5, 40, 300, true, 1, now() - interval '30 seconds', me, '{}') returning id into v;
  insert into gd values ('LIT', v);
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, fuel, lit, ash, since, made_by, state)
    values (w, 'campfire', 96, 115, 0, 0, 96.5, 115.5, 40, 50, false, 3, now() - interval '30 seconds', me, '{}') returning id into v;
  insert into gd values ('OUT', v);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, made_at, litres, since)
    values (w, 'furniture', 'well', 90, 110, 0, 0, 90.5, 110.5, 50, me, now() - interval '5 days', 3, now() - interval '20 seconds') returning id into v;
  insert into gd values ('WELL', v);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, made_at)
    values (w, 'furniture', 'statue', 112, 92, 0, 0, 112.5, 92.5, 50, me, now() - interval '5 days') returning id into v;
  insert into gd values ('STATUE', v);
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, made_by, till) values (w, 'counter', 98, 104, 0, 0, 98.5, 104.5, 40, you, 10) returning id into v;
  insert into gd values ('COUNTER', v);
  insert into item (world_id, holder, placed, def, ql, count, price) select w, 'counter', v, d, 30, 1, 7 from unnest(array['log', 'stone']) d;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, made_at, crumbles_at)
    values (w, 'furniture', 'grave', 108, 97, 0, 0, 108.5, 97.5, 1, me, now() - interval '1 hour', now() + interval '2 hours') returning id into v;
  insert into gd values ('GRAVE', v);
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v, 'hatchet', 30, 1);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, made_at)
    values (w, 'furniture', 'rowing_boat', 125, 120, 0, 0, 125.5, 120.5, 30, you, now() - interval '5 days') returning id into v;
  insert into gd values ('BOAT', v);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, made_at, driver)
    values (w, 'furniture', 'cart', 104, 102, 0, 0, 104.5, 102.5, 30, you, now() - interval '5 days', you) returning id into v;
  insert into gd values ('CART', v);
  -- Things lying about, on the grass and on a cellar floor; and crates.
  insert into item (world_id, holder, gx, gy, def, ql, count) values (w, 'ground', 101, 99, 'log', 20, 1) returning id into v;
  insert into gd values ('LOG', v);
  insert into item (world_id, holder, gx, gy, def, ql, count) values (w, 'ground', 115, 120, 'stone', 20, 3) returning id into v;
  insert into gd values ('STONE', v);
  insert into item (world_id, holder, gx, gy, def, ql, count) values (w, 'cellar', 103, 103, 'plank', 20, 2) returning id into v;
  insert into gd values ('CELLAR', v);
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by) values (w, 1, 'plank', 99, 99, 0, 0, false, me), (w, 2, 'plank', 118, 110, 0, 0, false, me);
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 1, 'log', 20, 4), (w, 'crate', 2, 'stone', 20, 6);
end $t$;
select string_agg(k || '=' || id, ',' order by k) from gd;
`);
const ID: Record<string, number> = Object.fromEntries(made.split('\n').pop()!.split(',').map((kv) => {
  const [k, v] = kv.split('=');
  return [k, Number(v)];
}));
check('the island is made with its pieces', Object.keys(ID).length === 16 && Object.values(ID).every((v) => v > 0), made.split('\n').pop());

/* ---- the same answer, cheaper ----------------------------------------------------------------------------------- */

// The read with its short cut taken out: the water asked of every piece, as it was.
const CUTS: Array<[string, string]> = [
  ['case when pl.sub = any (v_wells) then placed_litres(pl) else pl.litres end', 'placed_litres(pl)'],
  ['case when pl.sub = any (v_wells) then placed_liquid(pl) else pl.liquid end', 'placed_liquid(pl)'],
];
const sameSaid = psql(`${as(ME)}begin;
do $t$
declare d text := pg_get_functiondef('public.rpc_ground(uuid,double precision,boolean,text)'::regprocedure); c text[]; n int;
begin
  d := replace(d, 'FUNCTION public.rpc_ground(', 'FUNCTION pg_temp.rpc_ground_whole(');
  foreach c slice 1 in array array[${CUTS.map(([a, b]) => `array[$c$${a}$c$, $c$${b}$c$]`).join(', ')}] loop
    n := (length(d) - length(replace(d, c[1], ''))) / length(c[1]);
    if n <> 1 then raise exception 'short cut found % times: %', n, c[1]; end if;
    d := replace(d, c[1], c[2]);
  end loop;
  execute d;
end $t$;
create temp table said (k text, v text);
do $t$
declare s boolean; a jsonb; b jsonb; c jsonb;
begin
  foreach s in array array[false, true] loop
    delete from caller where uid = '${ME}';
    a := pg_temp.rpc_ground_whole(${W}, 40, s);
    delete from caller where uid = '${ME}';
    b := rpc_ground(${W}, 40, s);
    delete from caller where uid = '${ME}';
    c := rpc_ground(${W}, 40, s, '');
    insert into said values (s::text, jsonb_array_length(a->'placed') || '|' || (a = b)::text || '|' || (a = c - 'at' - 'full')::text
      || '|' || (c->>'full') || '|' || jsonb_typeof(c->'at') || '|' || (b ? 'at')::text
      || '|' || (select (e->>'litres')::numeric > 3 from jsonb_array_elements(a->'placed') e where (e->>'id')::bigint = ${ID.WELL}));
  end loop;
end $t$;
select k || '=' || v from said;
rollback;`);
for (const line of sameSaid.split('\n').filter((l) => l.includes('='))) {
  const [half, v] = line.split('=');
  const [n, same, newShape, full, at, oldAt, filling] = v.split('|');
  const name = half === 'true' ? 'with the slow half' : 'the burning half';
  check(`${name}: the read says what it says with the short cut taken out, key for key (${n} pieces)`, same === 'true' && Number(n) >= 12, v);
  check(`${name}: its whole answer in the new shape says the same, with a cursor`, newShape === 'true' && full === 'true' && at === 'string', v);
  check(`${name}: a browser that says no cursor gets what it always got, and no cursor`, oldAt === 'false', v);
  check(`${name}: the well has filled since it was drawn`, filling === 'true', v);
}

/* ---- only what changed ----------------------------------------------------------------------------------------- */

const held = new GroundHeld();
const first = ask(`, false, ''`);
const firstLaid = held.take(first);
check('the first answer is the whole one, with a cursor', first.full === true && firstLaid !== null
  && /^g1:[\d.e+-]+:[\d.e+-]+:[\d.e+-]+:\d+:v1:\d+:\d+:\d+:[\d,]*$/.test(String(first.at)), String(first.at));
const idsIn = (rows: unknown): number[] => (rows as Array<{ id: number }>).map((r) => r.id).sort((a, b) => a - b);
const has = (rows: unknown, k: string): boolean => idsIn(rows).includes(ID[k]);
check('it holds everything in range, and nothing past it',
  ['NEAR', 'FAR', 'WEST', 'TABLE', 'LIT', 'OUT', 'WELL', 'STATUE', 'COUNTER', 'GRAVE', 'BOAT', 'CART'].every((k) => has(first.placed, k))
    && !has(first.placed, 'OFF') && has(first.lying, 'LOG') && has(first.lying, 'STONE') && has(first.cellarLying, 'CELLAR'),
  idsIn(first.placed).join(','));

/** Where the held answer and the whole one differ, or null. */
const differs = (mine: Record<string, unknown>, whole: Record<string, unknown>): string | null => {
  const ka = Object.keys(mine).sort();
  const kb = Object.keys(whole).sort();
  if (ka.join() !== kb.join()) return `keys ${ka} / ${kb}`;
  for (const k of ka) {
    const a = mine[k];
    const b = whole[k];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (Array.isArray(a) && Array.isArray(b)) {
      const byId = new Map((a as Array<{ id: number }>).map((r) => [r.id, r]));
      for (const r of b as Array<{ id: number }>) {
        const m = byId.get(r.id);
        if (!m) return `${k}: ${r.id} missing`;
        if (JSON.stringify(m) !== JSON.stringify(r)) {
          const why = Object.keys(r).find((f) => JSON.stringify((m as Record<string, unknown>)[f]) !== JSON.stringify((r as Record<string, unknown>)[f]));
          return `${k} ${r.id}.${why}: ${JSON.stringify((m as Record<string, unknown>)[why ?? ''])} / ${JSON.stringify((r as Record<string, unknown>)[why ?? ''])}`;
        }
      }
      return `${k}: ${idsIn(a)} / ${idsIn(b)}`;
    }
    return `${k} ${JSON.stringify(a)} / ${JSON.stringify(b)}`;
  }
  return null;
};

/** One step: what happens between two asks (its own transaction), then the delta laid and held against the whole answer. */
const step = (what: string, change: string): { sent: Record<string, number[]>; ids: Record<string, number[]>; worst: string | null } => {
  if (change) psql(change);
  const { delta, whole } = both(held.at!);
  const laid = held.take(delta);
  const sent = Object.fromEntries(GROUND_LISTS.map((k) => [k, idsIn(delta[k])]));
  const ids = (delta.ids ?? {}) as Record<string, number[]>;
  let worst = delta.full === false ? null : `answered whole (${what})`;
  if (!laid) worst ||= `not laid (${what})`;
  else worst ||= differs(laid, whole);
  return { sent, ids, worst };
};
const same = (a: number[], b: number[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);
const sorted = (...ks: string[]): number[] => ks.map((k) => ID[k]).sort((a, b) => a - b);
// Sent every time: burning, the well, the statue, the counter, the grave, the boat, the cart driven.
const ALWAYS = ['LIT', 'WELL', 'STATUE', 'COUNTER', 'GRAVE', 'BOAT', 'CART'];

const s0 = step('nothing', '');
check('asked again with nothing written, only those whose answer moves without their row being written come',
  same(s0.sent.placed, sorted(...ALWAYS)) && s0.sent.lying.length === 0 && s0.sent.cellarLying.length === 0, JSON.stringify(s0.sent));
check('and the ids of everything in range', same(s0.ids.placed ?? [], idsIn(first.placed)) && same(s0.ids.lying ?? [], idsIn(first.lying)),
  JSON.stringify(s0.ids));
check('and the browser laying it holds what the whole answer says', s0.worst === null, s0.worst ?? '');

const s1 = step('a chest renamed, a thing put in one past reach', `
update placed set name = 'Spare' where world_id = ${W} and id = ${ID.FAR};
insert into item (world_id, holder, placed, def, ql, count) values (${W}, 'furniture', ${ID.TABLE}, 'nail', 10, 1);
insert into item (world_id, holder, placed, def, ql, count) values (${W}, 'furniture', ${ID.FAR}, 'nail', 10, 1);`);
check('a piece renamed is sent; a thing put in a piece past reach sends nothing (it says nothing of what is in it)',
  same(s1.sent.placed, sorted(...ALWAYS, 'FAR')), JSON.stringify(s1.sent.placed));
check('and what is held is what the whole answer says', s1.worst === null, s1.worst ?? '');

const s2 = step('a thing taken out of the chest within reach', `delete from item where world_id = ${W} and placed = ${ID.NEAR} and def = 'stone';`);
check('a thing taken out of a chest within reach sends it again', s2.sent.placed.includes(ID.NEAR), JSON.stringify(s2.sent.placed));
check('and what is held is what the whole answer says (it is gone from the chest)', s2.worst === null, s2.worst ?? '');

const s3 = step('a thing put in the chest within reach', `insert into item (world_id, holder, placed, def, ql, count) values (${W}, 'furniture', ${ID.NEAR}, 'nail', 10, 9);`);
check('a thing put in a chest within reach sends it again', s3.sent.placed.includes(ID.NEAR), JSON.stringify(s3.sent.placed));
check('and what is held is what the whole answer says (it is in the chest)', s3.worst === null, s3.worst ?? '');

const s4 = step('a piece taken up, one set down, a thing dropped, one picked up, a cellar floor swept', `
delete from placed where world_id = ${W} and id = ${ID.TABLE};
insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, made_at) values (${W}, 'furniture', 'bench', 111, 111, 0, 0, 111.5, 111.5, 30, '${ME}', now());
insert into item (world_id, holder, gx, gy, def, ql, count) values (${W}, 'ground', 100, 102, 'plank', 20, 1);
delete from item where world_id = ${W} and id = ${ID.LOG};
delete from item where world_id = ${W} and id = ${ID.CELLAR};`);
const bench = Number(psql(`select id from placed where world_id = ${W} and sub = 'bench'`));
check('a piece set down is sent, and one taken up is not in the ids', s4.sent.placed.includes(bench)
  && !(s4.ids.placed ?? []).includes(ID.TABLE), JSON.stringify(s4.sent.placed));
check('a thing dropped is sent, and one picked up is not in the ids', s4.sent.lying.length === 1 && !(s4.ids.lying ?? []).includes(ID.LOG)
  && (s4.ids.cellarLying ?? []).length === 0, JSON.stringify([s4.sent, s4.ids.lying]));
check('and what is held is what the whole answer says', s4.worst === null, s4.worst ?? '');

const s5 = step('walked west', `update player set x = 88.5, y = 100.5 where world_id = ${W} and uid = '${ME}';`);
check('walked off: the pieces come into range and into reach are sent, and the ones gone out of reach',
  s5.sent.placed.includes(ID.OFF) && s5.sent.placed.includes(ID.WEST) && s5.sent.placed.includes(ID.NEAR),
  JSON.stringify(s5.sent.placed));
check('and what is held is what the whole answer says (what is in each, said only within reach)', s5.worst === null, s5.worst ?? '');

const s6 = step('nothing again', '');
check('and asked again standing by the west barrel, nothing in it changed, only those that always come are sent',
  same(s6.sent.placed, sorted(...ALWAYS)), JSON.stringify(s6.sent.placed));
check('and what is held is what the whole answer says', s6.worst === null, s6.worst ?? '');

/* ---- a browser laying them holds what the whole answer says, round after round ---------------------------------- */

let worst = '';
let sent = 0;
let whole = 0;
let rounds = 0;
const changes = [
  `update placed set fuel = fuel + 10, since = now() where world_id = ${W} and id = ${ID.LIT};`,
  `insert into item (world_id, holder, placed, def, ql, count) values (${W}, 'furniture', ${ID.WEST}, 'stone', 10, 1);`,
  `update player set x = 101.5, y = 99.5 where world_id = ${W} and uid = '${ME}';`,
  `update item set count = count + 1 where world_id = ${W} and placed = ${ID.NEAR} and def = 'log';`,
  `update player set name = 'Groundee II' where world_id = ${W} and uid = '${YOU}';`,
  `update placed set lit = true, since = now() where world_id = ${W} and id = ${ID.OUT};`,
  `update item set holder = 'player', holder_uid = '${ME}', placed = null where world_id = ${W} and placed = ${ID.NEAR} and def = 'nail';`,
  `update player set x = 130.5, y = 118.5 where world_id = ${W} and uid = '${ME}';`,
  `update placed set cx = cx + 0.25, x = floor(cx + 0.25) where world_id = ${W} and id = ${ID.BOAT};`,
  `update player set x = 100.5, y = 100.5 where world_id = ${W} and uid = '${ME}';`,
];
for (const change of changes) {
  const r = step(change, change);
  if (r.worst) worst ||= `${change}: ${r.worst}`;
  sent += r.sent.placed.length + r.sent.lying.length + r.sent.cellarLying.length;
  whole += (r.ids.placed?.length ?? 0) + (r.ids.lying?.length ?? 0) + (r.ids.cellarLying?.length ?? 0);
  rounds++;
}
check(`a browser laying only what changed holds what the whole answer says, key for key, after each of ${rounds} changes`, worst === '', worst);
check('and was sent fewer rows than the whole answers held', sent < whole, `${sent} rows for ${whole}`);

// A browser out of step (an answer naming a row it does not hold) lays nothing, and asks for the whole answer next.
const lost = new GroundHeld();
lost.take(first);
const named = lost.take({ at: 'g1:x', full: false, placed: [], lying: [], cellarLying: [], crates: [], ids: { placed: [987654321], lying: [], cellarLying: [] } });
check('a browser out of step with the island lays nothing and asks for the whole answer next', named === null && lost.at === null);

/* ---- the creatures and the ground in one round trip ------------------------------------------------------------- */

psql(`select creature_spawn(${W}, 'rabba', 101.5, 103.5); select creature_spawn(${W}, 'shaggan', 97.5, 99.5);
update creature set until = now() + interval '1 day' where world_id = ${W};`);
for (const [what, near, mobs, ground] of [
  ['whole', `'', '{}', true, 40, true, ''`, `'', '{}', true`, `true, ''`],
  ['handed back', `'', '{}', true, 40, false, '${held.at}'`, `'', '{}', true`, `false, '${held.at}'`],
] as const) {
  const [n, c, g] = psql(`${as(ME)}begin;
delete from caller where uid = '${ME}';
select rpc_near(${W}, 40, ${near})::text;
delete from caller where uid = '${ME}';
select rpc_creatures(${W}, 40, ${mobs})::text;
delete from caller where uid = '${ME}';
select rpc_ground(${W}, 40, ${ground})::text;
rollback;`).split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);
  const bare = (v: unknown): string => { const o = { ...(v as Record<string, unknown>) }; delete o.at; return JSON.stringify(o); };
  check(`one round trip (${what}): the creatures and the ground as each says them on its own`,
    bare(n.creatures) === bare(c) && bare(n.ground) === bare(g) && ((c.rows as unknown[]) ?? []).length === 2,
    `${bare(n.creatures).length}/${bare(c).length}, ${bare(n.ground).length}/${bare(g).length}`);
}

/* ---- a cursor it cannot read ----------------------------------------------------------------------------------- */

const at = held.at!;
const oldAt = at.replace(/:v1:\d+:/, `:v1:${Date.now() - 1000 * 1000}:`);
const fullFor = (args: string): unknown => ask(args).full;
check('an unreadable cursor is answered whole', fullFor(`, false, 'g1:nonsense'`) === true);
check('and one too old', fullFor(`, false, '${oldAt}'`) === true, oldAt);
check('and one read over another range', fullFor(`, false, '${at.replace(/^(g1:[^:]+:[^:]+:)40:/, '$130:')}'`) === true);
check('and a good one is not', fullFor(`, false, '${at}'`) === false);

const most = Number(psql('select private.since_most()'));
check(`the browser asks for the whole answer every ${RECONCILE_EVERY} s, well within the ${most} s a cursor is good for`,
  RECONCILE_EVERY * 2 <= most, `${RECONCILE_EVERY} / ${most}`);

psql(`delete from world where name = '${ISLE}';`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nthe ground read, only what changed — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
