/**
 * The same thing, asked for at once.
 *
 * Every go that moves a thing between holders -- out of a crate, into one,
 * onto a rack, across a trade, off a stall, off the ground, into a settlement's
 * work -- is fired from several connections at the same instant at the same
 * row, and every thing and every coin is counted before and after: nothing
 * made, nothing lost, no count below one, and nobody's own pile any smaller
 * than it was unless they gave from it.
 *
 * The calls are held at a gate (an advisory lock one session keeps until
 * every call is waiting on it) and let go together. Each keeps its
 * transaction open a moment after its work, so that the others' reads land
 * while its writes are still uncommitted: the window a slow island opens on
 * its own, opened every time. A go is run the way the clock runs one
 * (`settle` with the job due), a door the way a browser calls it.
 *
 * Covered, each with identical calls:
 *   * take from a crate; put into a crate, a thing an ask and many in one (`rpc_act_many`); empty a crate;
 *     load a rack;
 *   * both Accepts of a trade pressed twice over;
 *   * buy the same thing off a stall;
 *   * pick up the same thing off the ground, and the same body's drop beaten
 *     out by every beat at once;
 *   * deliver to the same settlement work;
 *   * workers fetching the same stack out of the settlement's stores;
 * and the pairs that touch the same row by two different doors:
 *   * a buy folding into the stack that is going into a crate;
 *   * a drop of part of the stack that is being delivered;
 *   * a trade's silver and a stall's price, paid from the same coins.
 *
 * Makes and removes everything it uses, on an island of its own.
 */
import { execFile, execFileSync } from 'node:child_process';

const ENV = {
  ...process.env,
  PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
  PGPORT: process.env.PGPORT ?? '5433',
  PGUSER: process.env.PGUSER ?? 'wurm',
  PGDATABASE: process.env.PGDATABASE ?? 'postgres',
};
const ARGS = ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'];

interface Ran { out: string; err: string }
const sql = (text: string): Ran => {
  try {
    return { out: execFileSync('psql', ARGS, { input: text, encoding: 'utf8', env: ENV, stdio: ['pipe', 'pipe', 'pipe'] }).trim(), err: '' };
  } catch (e) {
    const x = e as { stdout?: string; stderr?: string };
    return { out: (x.stdout ?? '').trim(), err: (x.stderr ?? '').trim() || String(e) };
  }
};
const psql = (text: string): string => {
  const r = sql(text);
  if (r.err) throw new Error(r.err);
  return r.out;
};
const later = (text: string): Promise<Ran> => new Promise((done) => {
  const child = execFile('psql', ARGS, { encoding: 'utf8', env: ENV }, (e, out, err) =>
    done({ out: (out ?? '').trim(), err: e ? (err || String(e)) : '' }));
  child.stdin?.end(text);
});

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const W = 'cc000000-0000-4000-8000-0000000000c1';
const N = 6;
const FOLK = Array.from({ length: N }, (_, i) => `cc000000-0000-4000-8000-00000000000${i + 1}`);
const [A, B] = FOLK;
const list = (xs: string[]): string => xs.map((x) => `'${x}'`).join(', ');

const CLEAN = `
delete from world where id = '${W}';
delete from auth.users where id in (${list(FOLK)});
delete from caller where uid in (${list(FOLK)});
delete from realtime.messages where topic like '%:${W}%';
`;
psql(CLEAN);
const BODY = `'{"health":1,"stamina":1,"hunger":1,"thirst":1}'::jsonb`;
psql(`
insert into auth.users (id, email) values ${FOLK.map((u, i) => `('${u}', 'twice${i + 1}@twice.test')`).join(', ')};
insert into world (id, name, seed, size, spawn_x, spawn_y, ready, made_by) values ('${W}', 'Twicewater', 7, 32, 10, 10, true, '${A}');
select land_blank('${W}', 32) \\g /dev/null
insert into player (world_id, uid, name, x, y, stats) values
  ${FOLK.map((u, i) => `('${W}', '${u}', 'Twin${String.fromCharCode(65 + i)}', ${10.2 + i * 0.1}, 10.5, ${BODY})`).join(',\n  ')};
`);

/* ---- the gate ----------------------------------------------------------------- */

const GATE = 4242;
let gateKey = Math.floor(Date.now() / 1000) % 100000;

/**
 * Fire every call at once, each on its own connection, as `who` (null: the
 * owner, the way the clock runs), and hold each open `hold` seconds after.
 */
const race = async (calls: Array<{ who: string | null; text: string }>, hold = 0.3): Promise<Ran[]> => {
  const key = ++gateKey;
  const waiting = `(select count(*) from pg_locks where locktype = 'advisory' and classid = ${GATE} and objid = ${key} and objsubid = 2 and not granted)`;
  const opener = later(`
select pg_advisory_lock(${GATE}, ${key}) \\g /dev/null
do $$ declare t0 timestamptz := clock_timestamp(); begin
  loop
    exit when ${waiting} >= ${calls.length};
    if clock_timestamp() - t0 > interval '30 seconds' then raise exception 'the calls never all came to the gate'; end if;
    perform pg_sleep(0.01);
  end loop;
end $$;
select pg_advisory_unlock(${GATE}, ${key}) \\g /dev/null
`);
  // The gate shut before anybody comes to it.
  for (let i = 0; i < 3000; i += 1) {
    if (psql(`select count(*) from pg_locks where locktype = 'advisory' and classid = ${GATE} and objid = ${key} and objsubid = 2 and granted`) === '1') break;
  }
  const runs = calls.map((c) => later(`
${c.who ? `select set_config('request.jwt.claims', '${JSON.stringify({ sub: c.who })}', false) \\g /dev/null` : ''}
begin;
select pg_advisory_xact_lock_shared(${GATE}, ${key}) \\g /dev/null
${c.who ? 'set local role authenticated;' : ''}
${c.text}
reset role;
select pg_sleep(${hold}) \\g /dev/null
commit;
`));
  const [gate, ...ran] = await Promise.all([opener, ...runs]);
  if (gate.err) throw new Error(`the gate: ${gate.err}`);
  return ran;
};

/* ---- counting ----------------------------------------------------------------- */

/** Every row of a kind on the island, by who or what holds it: holder:whose → units. */
const holdings = (def: string): Map<string, number> => {
  const m = new Map<string, number>();
  const rows = psql(`select k || '|' || sum(count) from (
      select holder || ':' || coalesce(holder_uid::text, crate::text, placed::text, gx || ',' || gy, '') as k, count
        from item where world_id = '${W}' and def = '${def}') q group by k order by k;`);
  for (const r of rows.split('\n').filter(Boolean)) {
    const [k, v] = r.split('|');
    m.set(k, Number(v));
  }
  return m;
};
const total = (m: Map<string, number>): number => [...m.values()].reduce((a, b) => a + b, 0);
const show = (m: Map<string, number>): string => [...m.entries()].map(([k, v]) => `${k.replace(/cc000000-0000-4000-8000-0000000000/g, 'p')}=${v}`).join(' ');
const lowest = (): number => Number(psql(`select coalesce(min(count), 1) from item where world_id = '${W}';`));
const faults = (): string => psql(`select coalesce(string_agg(text, ' | '), '') from event where world_id = '${W}' and text like '%Island error%';`);
const silver = (): number => Number(psql(`select coalesce(sum(coin_worth(extra) * count), 0) from item where world_id = '${W}' and def = 'coin';`))
  + Number(psql(`select coalesce(sum(till), 0) from placed where world_id = '${W}';`));

/** Units before and after: the same in all, and nobody's own pile smaller unless it was the one given from. */
const conserved = (what: string, before: Map<string, number>, after: Map<string, number>, givers: string[] = []): void => {
  check(`${what}: not one made or lost`, total(before) === total(after), `${total(before)} → ${total(after)}: ${show(before)} → ${show(after)}`);
  const shrunk = [...before.entries()].filter(([k, v]) => !givers.includes(k) && (after.get(k) ?? 0) < v);
  check(`${what}: nobody's own pile any smaller`, shrunk.length === 0, shrunk.map(([k]) => k).join(' '));
};
const noFault = (what: string): void => {
  const f = faults();
  check(`${what}: no go fell over`, f === '', f);
  psql(`delete from event where world_id = '${W}';`);
};

/** A go due now, for the clock to run. */
const due = (uid: string, action: string, target: object): void => {
  psql(`update player set act = '${action}', act_target = '${JSON.stringify(target)}'::jsonb, act_started = now() - interval '2 seconds',
    act_ends = now() - interval '1 second', act_left = 1, act_goes = 1, act_queue = '[]'::jsonb, body_at = now()
    where world_id = '${W}' and uid = '${uid}';`);
};
const settle = (uid: string): { who: null; text: string } => ({ who: null, text: `select settle('${W}', '${uid}') \\g /dev/null` });
const reset = (): void => {
  psql(`delete from item where world_id = '${W}'; delete from crate where world_id = '${W}'; delete from placed where world_id = '${W}';
    delete from barter_item where world_id = '${W}'; delete from barter where world_id = '${W}';
    delete from deed_work where world_id = '${W}'; delete from deed_member where world_id = '${W}'; delete from deed where world_id = '${W}';
    delete from event where world_id = '${W}'; delete from caller where uid in (${list(FOLK)});
    update player set act = null, act_target = null, act_started = null, act_ends = null, act_left = null, act_goes = null,
      act_queue = '[]'::jsonb, equipped = '{}'::jsonb, away = false, seen_at = now(), body_at = now(), stats = ${BODY}
      where world_id = '${W}';`);
};
const put = (holder: string, def: string, count: number, more = ''): number =>
  Number(psql(`insert into item (world_id, holder, def, ql, count${more ? `, ${more.split('=')[0]}` : ''})
    values ('${W}', '${holder}', '${def}', 30, ${count}${more ? `, ${more.split('=')[1]}` : ''}) returning id;`));
const carry = (uid: string, def: string, count: number, extra = 'null'): number =>
  Number(psql(`insert into item (world_id, holder, holder_uid, def, ql, count, extra)
    values ('${W}', 'player', '${uid}', '${def}', 30, ${count}, ${extra}) returning id;`));
/** A crate set down by `by`, or by nobody: anybody's to put in and take from. */
const crate = (id: number, x: number, y: number, by: string | null, sx = 0, sy = 0): void => {
  psql(`insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by, material)
    values ('${W}', ${id}, 'plank', ${x}, ${y}, ${sx}, ${sy}, false, ${by ? `'${by}'` : 'null'}, 'pine');`);
};
/** The first of two calls a moment behind the other, the way round each round. */
const behind = (seconds: number, call: { who: string | null; text: string }): { who: string | null; text: string } =>
  ({ who: call.who, text: `select pg_sleep(${seconds}) \\g /dev/null\n${call.text}` });
const inTurn = (r: number, one: { who: string | null; text: string }, two: { who: string | null; text: string }): Array<{ who: string | null; text: string }> =>
  (r % 2 === 0 ? [one, behind(0.1, two)] : [behind(0.1, one), two]);
const room = (id: number): number => Number(psql(`select crate_spare('${W}', c) from crate c where c.world_id = '${W}' and c.id = ${id};`));
const fill = (id: number, leave: number): void => {
  psql(`insert into item (world_id, holder, crate, def, ql, count)
    select '${W}', 'crate', c.id, 'rock_shards', 20, crate_capacity(c) - ${leave} from crate c where c.world_id = '${W}' and c.id = ${id};`);
};
const coins = (uid: string, silver: number): void => {
  psql(`insert into item (world_id, holder, holder_uid, def, ql, count, extra) values ('${W}', 'player', '${uid}', 'coin', 50, ${silver}, 'Silver');`);
};
const ROUNDS = 4;

/* ---- take from a crate --------------------------------------------------------- */
console.log('--- take from a crate');
for (let r = 0; r < ROUNDS; r += 1) {
  reset();
  // Anybody's crate: one of A's own is "Not yours" to the rest, which every go is now asked again (`settle`).
  crate(1, 10, 10, null);
  const ore = put('crate', 'iron_ore', 10, 'crate=1');
  for (const u of FOLK) due(u, 'take_from_store', { kind: 'item', uid: ore, count: 3 });
  const before = holdings('iron_ore');
  await race(FOLK.map(settle));
  const after = holdings('iron_ore');
  conserved(`take from a crate (${r + 1})`, before, after, ['crate:1']);
  check(`take from a crate (${r + 1}): all ten taken, and nobody more than the three asked for`,
    !after.has('crate:1') && [...after.values()].every((v) => v <= 3), show(after));
  noFault(`take from a crate (${r + 1})`);
}

/* ---- put into a crate ---------------------------------------------------------- */
console.log('--- put into a crate');
for (let r = 0; r < ROUNDS; r += 1) {
  reset();
  crate(1, 10, 10, null);
  fill(1, 10);
  const mine = FOLK.map((u) => carry(u, 'iron_ore', 4));
  FOLK.forEach((u, i) => due(u, 'store_in_crate', { kind: 'item', uid: mine[i], count: 4, into: 1 }));
  const before = holdings('iron_ore');
  await race(FOLK.map(settle));
  const after = holdings('iron_ore');
  conserved(`put into a crate (${r + 1})`, before, after, FOLK.map((u) => `player:${u}`));
  check(`put into a crate (${r + 1}): ten went in, and no more`, after.get('crate:1') === 10 && room(1) === 0, `${show(after)}, room ${room(1)}`);
  noFault(`put into a crate (${r + 1})`);
}

/* ---- put many into a crate, in one ask each ------------------------------------ */
console.log('--- put many into a crate');
for (let r = 0; r < ROUNDS; r += 1) {
  reset();
  crate(1, 10, 10, null);
  fill(1, 10);
  // Two stacks each, the way Put all in asks them (`rpc_act_many`), every body at once.
  const mine = FOLK.map((u) => [carry(u, 'iron_ore', 2), carry(u, 'iron_ore', 2, "'odd'")]);
  const before = holdings('iron_ore');
  await race(FOLK.map((u, i) => ({
    who: u,
    text: `select rpc_act_many('${W}', 'store_in_crate', '${JSON.stringify(mine[i].map((uid) => ({ kind: 'item', uid, count: 2, into: 1 })))}'::jsonb) \\g /dev/null`,
  })));
  const after = holdings('iron_ore');
  conserved(`put many into a crate (${r + 1})`, before, after, FOLK.map((u) => `player:${u}`));
  check(`put many into a crate (${r + 1}): ten went in, and no more`, after.get('crate:1') === 10 && room(1) === 0, `${show(after)}, room ${room(1)}`);
  noFault(`put many into a crate (${r + 1})`);
}

/* ---- empty a crate ------------------------------------------------------------- */
console.log('--- empty a crate');
for (let r = 0; r < ROUNDS; r += 1) {
  reset();
  crate(1, 10, 10, A);
  put('crate', 'iron_ore', 7, 'crate=1');
  put('crate', 'iron_ore', 5, 'crate=1');
  for (const u of FOLK) due(u, 'crate_take_all', { kind: 'crate', id: 1 });
  const before = holdings('iron_ore');
  await race(FOLK.map(settle));
  const after = holdings('iron_ore');
  conserved(`empty a crate (${r + 1})`, before, after, ['crate:1']);
  check(`empty a crate (${r + 1}): the crate is empty`, !after.has('crate:1'), show(after));
  noFault(`empty a crate (${r + 1})`);
}

/* ---- load a rack --------------------------------------------------------------- */
console.log('--- load a rack');
for (let r = 0; r < ROUNDS; r += 1) {
  reset();
  const rack = Number(psql(`insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, made_by, ql)
    values ('${W}', 'furniture', 'crate_shelf', 12, 10, 0, 0, 12.5, 10.5, '${A}', 20) returning id;`));
  crate(1, 12, 10, null, 0, 0);
  crate(2, 12, 10, null, 1, 0);
  const on = psql(`select count(*) from rack_crates('${W}', (select p from placed p where p.id = ${rack}))`);
  fill(1, 6);
  fill(2, 6);
  const mine = FOLK.map((u) => carry(u, 'iron_ore', 5));
  FOLK.forEach((u, i) => due(u, 'rack_put', { kind: 'item', uid: mine[i], count: 5, into: rack }));
  const before = holdings('iron_ore');
  await race(FOLK.map(settle));
  const after = holdings('iron_ore');
  conserved(`load a rack (${r + 1})`, before, after, FOLK.map((u) => `player:${u}`));
  check(`load a rack (${r + 1}): twelve went onto its ${on} crates, and no more`,
    (after.get('crate:1') ?? 0) + (after.get('crate:2') ?? 0) === 12 && room(1) === 0 && room(2) === 0, `${show(after)}, room ${room(1)},${room(2)}`);
  noFault(`load a rack (${r + 1})`);
}

/* ---- a trade, both Accepts pressed twice --------------------------------------- */
console.log('--- a trade');
const said = (r: Ran): Record<string, unknown> => { try { return JSON.parse(r.out) as Record<string, unknown>; } catch { return { why: r.err || r.out }; } };
const as = (who: string, text: string): Ran => sql(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: who })}', false) \\g /dev/null
set role authenticated;
${text}`);
const trade = (gives: Array<[number, number]>, takes: Array<[number, number]>, silverIn: number): { n: number; rev: number } => {
  const n = Number((said(as(A, `select rpc_barter_ask('${W}', '${B}');`)).barter as { n: number } | undefined)?.n ?? 0);
  as(B, `select rpc_barter_answer('${W}', ${n}, true);`);
  as(A, `select rpc_barter_offer('${W}', ${n}, array[${gives.map((t) => t[0]).join(',')}]::bigint[], array[${gives.map((t) => t[1]).join(',')}]::int[], ${silverIn});`);
  as(B, `select rpc_barter_offer('${W}', ${n}, array[${takes.map((t) => t[0]).join(',')}]::bigint[], array[${takes.map((t) => t[1]).join(',')}]::int[], 0);`);
  return { n, rev: Number(psql(`select rev from barter where world_id = '${W}' and n = ${n};`)) };
};
for (let r = 0; r < ROUNDS; r += 1) {
  reset();
  const logs = carry(A, 'log', 10);
  const rope = carry(B, 'rope', 3);
  coins(A, 20);
  const { n, rev } = trade([[logs, 4]], [[rope, 2]], 5);
  const logs0 = holdings('log');
  const rope0 = holdings('rope');
  const silver0 = silver();
  const presses = await race([A, B, A, B].map((u) => ({ who: u, text: `select rpc_barter_accept('${W}', ${n}, ${rev});` })));
  check(`a trade (${r + 1}): exactly one press did the swap`, presses.filter((p) => said(p).done === true).length === 1,
    presses.map((p) => p.out || p.err).join(' | '));
  conserved(`a trade (${r + 1}), the logs`, logs0, holdings('log'), [`player:${A}`]);
  conserved(`a trade (${r + 1}), the rope`, rope0, holdings('rope'), [`player:${B}`]);
  check(`a trade (${r + 1}): four logs and two rope went over, once`,
    holdings('log').get(`player:${B}`) === 4 && holdings('rope').get(`player:${A}`) === 2, `${show(holdings('log'))} ${show(holdings('rope'))}`);
  check(`a trade (${r + 1}): not a coin made or lost`, silver() === silver0, `${silver0} → ${silver()}`);
}

/* ---- buy off a stall ----------------------------------------------------------- */
console.log('--- buy off a stall');
const stall = (by: string): number => Number(psql(`insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, made_by)
  values ('${W}', 'furniture', 'stall', 10, 11, 0, 0, 10.5, 11.5, '${by}') returning id;`));
for (let r = 0; r < ROUNDS; r += 1) {
  reset();
  const st = stall(A);
  const sword = put('furniture', 'long_sword', 1, `placed,price=${st},5`);
  const buyers = FOLK.slice(1);
  for (const u of buyers) coins(u, 10);
  const silver0 = silver();
  const before = holdings('long_sword');
  const got = await race(buyers.map((u) => ({ who: u, text: `select rpc_buy('${W}', ${sword});` })));
  const after = holdings('long_sword');
  conserved(`buy off a stall (${r + 1})`, before, after, [`furniture:${st}`]);
  check(`buy off a stall (${r + 1}): sold once`, got.filter((g) => said(g).bought).length === 1 && total(after) === 1
    && [...after.keys()].every((k) => k.startsWith('player:')), `${show(after)} ${got.map((g) => g.out || g.err).join(' | ')}`);
  check(`buy off a stall (${r + 1}): five silver in the till, and not a coin made or lost`,
    silver() === silver0 && psql(`select till from placed where id = ${st};`) === '5', `${silver0} → ${silver()}`);
}

/* ---- pick up off the ground ---------------------------------------------------- */
console.log('--- pick up');
for (let r = 0; r < ROUNDS; r += 1) {
  reset();
  const axe = put('ground', 'hatchet', 1, 'gx,gy=10,10');
  const pile = put('ground', 'iron_ore', 5, 'gx,gy=11,10');
  FOLK.forEach((u) => carry(u, 'iron_ore', 2));
  FOLK.forEach((u, i) => due(u, 'pick_up', i % 2 === 0 ? { kind: 'tile', x: 10, y: 10, uid: axe } : { kind: 'tile', x: 11, y: 10, uid: pile }));
  const axes0 = holdings('hatchet');
  const ore0 = holdings('iron_ore');
  await race(FOLK.map(settle));
  const axes = holdings('hatchet');
  const ore = holdings('iron_ore');
  conserved(`pick up (${r + 1}), the hatchet`, axes0, axes, ['ground:10,10']);
  conserved(`pick up (${r + 1}), the ore`, ore0, ore, ['ground:11,10']);
  check(`pick up (${r + 1}): one pair of hands has the hatchet`, axes.size === 1 && [...axes.keys()][0].startsWith('player:'), show(axes));
  check(`pick up (${r + 1}): one pair of hands has the five ore`,
    !ore.has('ground:11,10') && [...ore.values()].filter((v) => v === 7).length === 1 && [...ore.values()].filter((v) => v === 2).length === N - 1, show(ore));
  const told = Number(psql(`select count(*) from event where world_id = '${W}' and text like 'Picked up:%';`));
  check(`pick up (${r + 1}): and only those two are told they picked anything up`, told === 2, `${told} told`);
  noFault(`pick up (${r + 1})`);
}

/* ---- drop: one body's drop, every beat at once --------------------------------- */
console.log('--- drop');
for (let r = 0; r < ROUNDS; r += 1) {
  reset();
  const ore = carry(A, 'iron_ore', 10);
  due(A, 'drop', { kind: 'item', uid: ore, count: 3 });
  const before = holdings('iron_ore');
  await race(FOLK.map(() => settle(A)));
  const after = holdings('iron_ore');
  conserved(`drop (${r + 1})`, before, after, [`player:${A}`]);
  check(`drop (${r + 1}): three on the ground, once`, after.get(`player:${A}`) === 7 && total(after) === 10, show(after));
  noFault(`drop (${r + 1})`);
}

/* ---- deliver to a settlement's work -------------------------------------------- */
console.log('--- deliver to the work');
const settlement = (): number => {
  psql(`insert into deed (world_id, name, x, y, radius, founded_by) values ('${W}', 'Twiceby', 14, 14, 6, '${A}');
    insert into deed_member (world_id, founder, uid, role) select '${W}', '${A}', u, 'builder' from unnest(array[${list(FOLK.slice(1))}]::uuid[]) u;
    select place_deed_crate('${W}', '${A}') \\g /dev/null
    update player set x = 14.5 + (random() - 0.5), y = 14.5 where world_id = '${W}';`);
  return Number(psql(`insert into deed_work (world_id, founder, def, want, set_by) values ('${W}', '${A}', 'iron_ore', 10, '${A}') returning id;`));
};
const deedCrate = (): number => Number(psql(`select (deed_crate('${W}', '${A}')).id;`));
for (let r = 0; r < ROUNDS; r += 1) {
  reset();
  const work = settlement();
  const dc = deedCrate();
  FOLK.forEach((u) => carry(u, 'iron_ore', 4));
  const before = holdings('iron_ore');
  const got = await race(FOLK.map((u) => ({ who: u, text: `select rpc_work_deliver('${W}', '${A}', ${work});` })));
  const after = holdings('iron_ore');
  conserved(`deliver (${r + 1})`, before, after, FOLK.map((u) => `player:${u}`));
  check(`deliver (${r + 1}): ten in the settlement crate and ten on the work`,
    after.get(`crate:${dc}`) === 10 && psql(`select got from deed_work where id = ${work};`) === '10',
    `${show(after)} got ${psql(`select got from deed_work where id = ${work};`)}; ${got.map((g) => g.out || g.err).join(' | ').slice(0, 400)}`);
  psql(`update player set x = ${10.5}, y = 10.5 where world_id = '${W}';`);
}

/* ---- workers fetching out of the stores ---------------------------------------- */
console.log('--- out of the stores');
for (let r = 0; r < ROUNDS; r += 1) {
  reset();
  settlement();
  crate(21, 13, 13, A);
  put('crate', 'iron_ore', 5, 'crate=21');
  const before = total(holdings('iron_ore'));
  const got = await race(FOLK.map(() => ({ who: null, text: `select coalesce((take_some_stored('${W}', '${A}', array['iron_ore'], 5, 13, 13)->>'count')::int, 0);` })));
  const taken = got.reduce((a, g) => a + Number(g.out || 0), 0);
  const left = total(holdings('iron_ore'));
  check(`out of the stores (${r + 1}): what the workers carry off and what is left are what there was`,
    taken + left === before && got.every((g) => !g.err), `${before} there, ${taken} carried off (${got.map((g) => g.out || g.err).join(',')}), ${left} left`);
  psql(`update player set x = ${10.5}, y = 10.5 where world_id = '${W}';`);
}

/* ---- two doors, one row -------------------------------------------------------- */
console.log('--- a buy folding into a stack going into a crate');
for (let r = 0; r < ROUNDS; r += 1) {
  reset();
  crate(1, 10, 10, B);
  const st = stall(A);
  put('furniture', 'iron_ore', 1, `placed,price=${st},1`);
  const sale = Number(psql(`select id from item where world_id = '${W}' and placed = ${st};`));
  const mine = carry(B, 'iron_ore', 10);
  coins(B, 5);
  due(B, 'store_in_crate', { kind: 'item', uid: mine, count: 5, into: 1 });
  const before = holdings('iron_ore');
  const got = await race(inTurn(r, settle(B), { who: B, text: `select rpc_buy('${W}', ${sale});` }));
  const after = holdings('iron_ore');
  conserved(`buy and store at once (${r + 1})`, before, after, [`player:${B}`, `furniture:${st}`]);
  check(`buy and store at once (${r + 1}): five in the crate, six in the pack`,
    after.get('crate:1') === 5 && after.get(`player:${B}`) === 6, `${show(after)} ${got.map((g) => g.out || g.err).join(' | ')}`);
  noFault(`buy and store at once (${r + 1})`);
}

console.log('--- a drop out of a stack being delivered');
for (let r = 0; r < ROUNDS; r += 1) {
  reset();
  const work = settlement();
  const dc = deedCrate();
  psql(`update deed_work set want = 4 where id = ${work};`);
  const mine = carry(B, 'iron_ore', 10);
  due(B, 'drop', { kind: 'item', uid: mine, count: 3 });
  const before = holdings('iron_ore');
  const got = await race(inTurn(r, settle(B), { who: B, text: `select rpc_work_deliver('${W}', '${A}', ${work});` }));
  const after = holdings('iron_ore');
  conserved(`drop and deliver at once (${r + 1})`, before, after, [`player:${B}`]);
  check(`drop and deliver at once (${r + 1}): four delivered, three dropped, three kept`,
    after.get(`crate:${dc}`) === 4 && after.get(`player:${B}`) === 3, `${show(after)} ${got.map((g) => g.out || g.err).join(' | ').slice(0, 300)}`);
  noFault(`drop and deliver at once (${r + 1})`);
  psql(`update player set x = ${10.5}, y = 10.5 where world_id = '${W}';`);
}

console.log('--- the same coins for a trade and a stall');
for (let r = 0; r < ROUNDS; r += 1) {
  reset();
  const st = stall(FOLK[2]);
  const sale = put('furniture', 'long_sword', 1, `placed,price=${st},6`);
  const rope = carry(B, 'rope', 1);
  coins(A, 6);
  const { n, rev } = trade([], [[rope, 1]], 6);
  as(A, `select rpc_barter_accept('${W}', ${n}, ${rev});`);
  const rev2 = Number(psql(`select rev from barter where world_id = '${W}' and n = ${n};`));
  const silver0 = silver();
  const got = await race(inTurn(r, { who: B, text: `select rpc_barter_accept('${W}', ${n}, ${rev2});` }, { who: A, text: `select rpc_buy('${W}', ${sale});` }));
  const paid = Number(got.map((g) => said(g).paid ?? 0).reduce((a, b) => Number(a) + Number(b), 0)) + (got.some((g) => said(g).done) ? 6 : 0);
  check(`six silver spent twice at once (${r + 1}): paid for once, and not a coin made`,
    silver() === silver0 && paid <= 6, `${silver0} → ${silver()}, paid ${paid}: ${got.map((g) => g.out || g.err).join(' | ').slice(0, 300)}`);
}

check('no count below one anywhere', lowest() >= 1);
psql(CLEAN);
for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`the same thing asked for at once — ${ok.length} of ${ok.length}`);
