/**
 * A trade between two people: the Trade window.
 *
 * On an island of its own, Tradewater, with Ivar and Hild standing two tiles
 * apart, Stig beside them with no part in it, Fara across the island and Ama
 * away:
 *
 *   * nobody signed in may call a door, and no browser may read either table;
 *   * asking: yourself, somebody away, somebody too far off and somebody
 *     already trading are refused, in the browser's words (`barterSaid`);
 *   * the one asked says yes; the asker cannot answer for them, and nothing
 *     goes on a side before the yes;
 *   * putting in: a coin stack, a worn thing, a thing kept back, more than a
 *     stack holds, more silver than is carried, more than a side holds and
 *     somebody else's thing are each refused, in the same words the browser
 *     refuses them in where it can see why (`barterPutRefusal`);
 *   * a change to either side takes both Accepts back, and an Accept pressed
 *     against the trade as it was is refused;
 *   * at the Accept, a thing gone from its owner's pack, one put on since, one
 *     kept back since, and silver spent since are each refused -- told to both
 *     in the same words, nothing moved, both Accepts taken back;
 *   * the full swap: part of a stack, a bag and what is in it, a whole stack
 *     and silver both ways, every thing and coin accounted for;
 *   * the same Accept sent again after, and both Accepts pressed at once
 *     with a second from one of them, move nothing twice;
 *   * cancel and no, walking apart, going away and sitting idle each end it
 *     and say so to both;
 *   * Stig can neither see nor touch a trade he is not in, and is told of none
 *     of it on his topic;
 *   * and the window would refuse nothing for weight: pickup does not either.
 *
 * Makes and removes everything it uses, so it runs on the database the suite
 * leaves behind or on any other with the migrations in it.
 */
import { execFile, execFileSync } from 'node:child_process';
import { BARTER_IDLE, BARTER_MOST, BARTER_REACH, BARTER_SAID, barterPutRefusal, barterSaid, barterThing, sideWords, type Barter } from '../../src/game/barter';

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
/** As the owner of the database: the setting up and the looking. */
const psql = (text: string): string => {
  const r = sql(text);
  if (r.err) throw new Error(r.err);
  return r.out;
};
const asText = (who: string | null, text: string): string =>
  `select set_config('request.jwt.claims', '${who ? JSON.stringify({ sub: who }) : ''}', false) \\g /dev/null\n`
  + `set role authenticated;\n${text}\n`;
/** Through the role a browser has, as somebody signed in. */
const as = (who: string | null, text: string): Ran => sql(asText(who, text));
/** The same, without waiting: for two presses at once. */
const asLater = (who: string, text: string): Promise<Ran> => new Promise((done) => {
  const child = execFile('psql', ARGS, { encoding: 'utf8', env: ENV }, (e, out, err) => done({ out: (out ?? '').trim(), err: e ? (err || String(e)) : '' }));
  child.stdin?.end(asText(who, text));
});
const anon = (text: string): Ran => sql(`set role anon;\n${text}\n`);

interface Said { why?: string; barter?: Barter | null; done?: boolean; cancelled?: boolean; declined?: boolean }
const said = (r: Ran): Said => {
  if (r.err) return { why: `ERROR ${r.err}` };
  try {
    return JSON.parse(r.out) as Said;
  } catch {
    return { why: `UNREADABLE ${r.out}` };
  }
};

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const W = 'bb000000-0000-4000-8000-0000000000a1';
const IVAR = 'bb000000-0000-4000-8000-000000000001';
const HILD = 'bb000000-0000-4000-8000-000000000002';
const STIG = 'bb000000-0000-4000-8000-000000000003';
const FARA = 'bb000000-0000-4000-8000-000000000004';
const AMA = 'bb000000-0000-4000-8000-000000000005';
const ALL = [IVAR, HILD, STIG, FARA, AMA];
const list = (xs: string[]): string => xs.map((x) => `'${x}'`).join(', ');

const CLEAN = `
delete from world where id = '${W}';
delete from auth.users where id in (${list(ALL)});
delete from caller where uid in (${list(ALL)});
delete from realtime.messages where topic like '%:${W}%';
`;
psql(CLEAN);
const BODY = `'{"health":1,"stamina":1,"hunger":1,"thirst":1}'::jsonb`;
psql(`
insert into auth.users (id, email) values
  ('${IVAR}', 'ivar@trade.test'), ('${HILD}', 'hild@trade.test'), ('${STIG}', 'stig@trade.test'),
  ('${FARA}', 'fara@trade.test'), ('${AMA}', 'ama@trade.test');
insert into world (id, name, seed, size, spawn_x, spawn_y, ready, made_by) values ('${W}', 'Tradewater', 3, 48, 10, 10, true, '${IVAR}');
select land_blank('${W}', 48) \\g /dev/null
insert into player (world_id, uid, name, x, y, stats) values
  ('${W}', '${IVAR}', 'Ivar', 10.5, 10.5, ${BODY}), ('${W}', '${HILD}', 'Hild', 12.5, 10.5, ${BODY}),
  ('${W}', '${STIG}', 'Stig', 11.5, 11.5, ${BODY}), ('${W}', '${FARA}', 'Fara', 40.5, 40.5, ${BODY}),
  ('${W}', '${AMA}', 'Ama', 11.5, 9.5, ${BODY});
update player set away = true where world_id = '${W}' and uid = '${AMA}';
`);

/** A row in somebody's pack, made here: its id. */
const give = (uid: string, def: string, count = 1, more = ''): number =>
  Number(psql(`insert into item (world_id, holder, holder_uid, def, ql, count${more ? `, ${more.split('=')[0]}` : ''})
    values ('${W}', 'player', '${uid}', '${def}', 30, ${count}${more ? `, ${more.split('=')[1]}` : ''}) returning id;`));
const coins = (uid: string, gold: number, silver: number): void => {
  if (gold) psql(`insert into item (world_id, holder, holder_uid, def, ql, count, extra) values ('${W}', 'player', '${uid}', 'coin', 50, ${gold}, 'Gold');`);
  if (silver) psql(`insert into item (world_id, holder, holder_uid, def, ql, count, extra) values ('${W}', 'player', '${uid}', 'coin', 50, ${silver}, 'Silver');`);
};
const purseOf = (uid: string): number => Number(psql(`select purse('${W}', '${uid}');`));

// Ivar: ten logs, a backpack with a rope in it, a long sword in his hand, a hatchet kept back, and 35 silver.
const LOGS = give(IVAR, 'log', 10);
const PACK = give(IVAR, 'backpack');
const INNER = Number(psql(`insert into item (world_id, holder, holder_uid, inside, def, ql, count)
  values ('${W}', 'bag', '${IVAR}', ${PACK}, 'rope', 30, 1) returning id;`));
const SWORD = give(IVAR, 'long_sword');
psql(`update player set equipped = jsonb_build_object('weapon', ${SWORD}) where world_id = '${W}' and uid = '${IVAR}';`);
const KEPT = give(IVAR, 'hatchet', 1, 'locked=true');
coins(IVAR, 3, 5);
const IVAR_COIN = Number(psql(`select min(id) from item where world_id = '${W}' and holder_uid = '${IVAR}' and def = 'coin';`));
// Hild: a hatchet, a rope, and 2 silver. Stig: a rope of his own.
const AXE = give(HILD, 'hatchet');
const ROPE = give(HILD, 'rope');
coins(HILD, 0, 2);
const STIGS = give(STIG, 'rope');

const name = (uid: string): string => psql(`select folk_name('${W}', '${uid}');`);
const [nIvar, nHild, nStig, nFara, nAma] = ALL.map(name);
check('the five are named on the island as the browser would name them', nIvar === 'Ivar' && nHild === 'Hild' && nAma === 'Ama', `${nIvar} ${nHild} ${nStig} ${nFara} ${nAma}`);

const lastLine = (uid: string): string => psql(`select text from event where world_id = '${W}' and uid = '${uid}' order by n desc limit 1;`);
const sent = (uid: string): number => Number(psql(`select count(*) from realtime.messages where topic = 'own:${W}:${uid}' and event = 'barter';`));
const read = (uid: string): Said => said(as(uid, `select rpc_barter('${W}');`));
const ask = (by: string, to: string): Said => said(as(by, `select rpc_barter_ask('${W}', '${to}');`));
const answer = (by: string, n: number, yes: boolean): Said => said(as(by, `select rpc_barter_answer('${W}', ${n}, ${yes});`));
const offer = (by: string, n: number, things: Array<[number, number]>, silver: number): Said =>
  said(as(by, `select rpc_barter_offer('${W}', ${n}, array[${things.map((t) => t[0]).join(',')}]::bigint[], array[${things.map((t) => t[1]).join(',')}]::int[], ${silver});`));
const accept = (by: string, n: number, rev: number): Said => said(as(by, `select rpc_barter_accept('${W}', ${n}, ${rev});`));
const cancel = (by: string, n: number): Said => said(as(by, `select rpc_barter_cancel('${W}', ${n});`));
const rev = (n: number): number => Number(psql(`select rev from barter where world_id = '${W}' and n = ${n};`));
const oks = (n: number): string => psql(`select asker_ok || ',' || other_ok from barter where world_id = '${W}' and n = ${n};`);
const where = (id: number): string => psql(`select coalesce((select holder || ':' || coalesce(holder_uid::text, '') || ':' || count from item where id = ${id}), 'gone');`);

/* ---- nobody else gets in ------------------------------------------------------ */
console.log('--- who may not');
for (const door of ["rpc_barter('W')", "rpc_barter_ask('W', 'U')", "rpc_barter_answer('W', 1, true)",
  "rpc_barter_offer('W', 1, '{}', '{}', 0)", "rpc_barter_accept('W', 1, 0)", "rpc_barter_cancel('W', 1)"]) {
  const a = anon(`select ${door.replace('W', W).replace('U', HILD)};`);
  check(`${door.split('(')[0]}: nobody signed in may not call it`, a.err.includes('permission denied for function'), a.err || a.out);
}
for (const t of ['barter', 'barter_item']) {
  const r = as(STIG, `select count(*) from ${t};`);
  check(`no browser reads the ${t} table`, r.err.includes('permission denied'), r.err || r.out);
  const w = as(IVAR, `update ${t} set world_id = world_id;`);
  check(`and none writes it`, w.err.includes('permission denied'), w.err || w.out);
}
const helper = as(IVAR, `select barter_move_side(null::barter, '${IVAR}', '${HILD}');`);
check('nor calls the island\'s own helpers', helper.err.includes('permission denied'), helper.err || helper.out);

/* ---- asking -------------------------------------------------------------------- */
console.log('--- asking');
check('yourself', ask(IVAR, IVAR).why === barterSaid('self'), ask(IVAR, IVAR).why);
check('somebody away', ask(IVAR, AMA).why === barterSaid('gone', { who: nAma }), ask(IVAR, AMA).why);
check(`somebody more than ${BARTER_REACH} tiles off`, ask(IVAR, FARA).why === barterSaid('far'), ask(IVAR, FARA).why);
const asked = ask(IVAR, HILD);
const n = asked.barter?.n ?? 0;
check('Ivar asks Hild, and is shown the trade waiting', !!asked.barter && asked.barter.state === 'asked' && asked.barter.asker, JSON.stringify(asked));
check('Hild is told who asks, in the browser\'s words', lastLine(HILD) === barterSaid('asked', { who: nIvar }), lastLine(HILD));
check('and both browsers are told on their own topics, and Stig\'s on none',
  sent(IVAR) === 1 && sent(HILD) === 1 && sent(STIG) === 0, `${sent(IVAR)} ${sent(HILD)} ${sent(STIG)}`);
check('somebody already asked is busy to a third', ask(STIG, HILD).why === barterSaid('busyThem', { who: nHild }), ask(STIG, HILD).why);
check('and somebody already asked cannot ask another', ask(HILD, STIG).why === barterSaid('busy'), ask(HILD, STIG).why);
check('Hild sees it, from Ivar', read(HILD).barter?.theirs.name === nIvar && read(HILD).barter?.asker === false, JSON.stringify(read(HILD)));
check('nothing goes on a side before the yes', offer(IVAR, n, [[LOGS, 1]], 0).why === barterSaid('notYet', { who: nHild }), offer(IVAR, n, [[LOGS, 1]], 0).why);
check('the asker cannot answer for the one asked', answer(IVAR, n, true).why === barterSaid('notYours', { who: nHild }), answer(IVAR, n, true).why);

/* ---- a stranger --------------------------------------------------------------- */
console.log('--- Stig, who is not in it');
check('sees no trade of his', read(STIG).barter === null, JSON.stringify(read(STIG)));
for (const [door, r] of [['answer', answer(STIG, n, true)], ['offer', offer(STIG, n, [[STIGS, 1]], 0)],
  ['accept', accept(STIG, n, 0)], ['cancel', cancel(STIG, n)]] as Array<[string, Said]>) {
  check(`is answered as if there were none, to ${door}`, r.why === barterSaid('none'), JSON.stringify(r));
}
check('and a number that never was is answered the same', cancel(IVAR, n + 1000).why === barterSaid('none'));
check('nothing Stig did changed it', psql(`select state || ',' || rev from barter where world_id = '${W}' and n = ${n};`) === 'asked,0');

/* ---- open --------------------------------------------------------------------- */
console.log('--- putting things in');
const yes = answer(HILD, n, true);
check('Hild says yes, and both are told they are trading', yes.barter?.state === 'open'
  && lastLine(IVAR) === barterSaid('opened', { who: nHild }) && lastLine(HILD) === barterSaid('opened', { who: nIvar }), `${lastLine(IVAR)} / ${lastLine(HILD)}`);
const browserItem = (id: string, extra: { locked?: boolean; count?: number } = {}) => ({ id, count: extra.count ?? 1, locked: extra.locked });
const refusedPut = (what: string, island: Said, browser: string | null): void =>
  check(`${what}, in the same words on both sides`, !!browser && island.why === browser, `${island.why} / ${browser}`);
refusedPut('a stack of coins', offer(IVAR, n, [[IVAR_COIN, 1]], 0), barterPutRefusal(browserItem('coin', { count: 3 }), false, 1, nIvar));
refusedPut('the sword in his hand', offer(IVAR, n, [[SWORD, 1]], 0), barterPutRefusal(browserItem('long_sword'), true, 1, nIvar));
refusedPut('a hatchet kept back', offer(IVAR, n, [[KEPT, 1]], 0), barterPutRefusal(browserItem('hatchet', { locked: true }), false, 1, nIvar));
refusedPut('more logs than the stack holds', offer(IVAR, n, [[LOGS, 11]], 0), barterPutRefusal(browserItem('log', { count: 10 }), false, 11, nIvar));
check('more silver than he carries', offer(IVAR, n, [], 36).why === barterSaid('coins', { who: nIvar, n: 36 }), offer(IVAR, n, [], 36).why);
check(`more than ${BARTER_MOST} things`, offer(IVAR, n, Array.from({ length: BARTER_MOST + 1 }, (_, i) => [LOGS + 100000 + i, 1] as [number, number]), 0).why === barterSaid('most'));
check('somebody else\'s rope, named as no kind of thing', offer(IVAR, n, [[STIGS, 1]], 0).why === barterSaid('missing', { who: nIvar, what: 'thing' }),
  offer(IVAR, n, [[STIGS, 1]], 0).why);
check('none of that changed the trade', rev(n) === 1, String(rev(n)));

const mine = offer(IVAR, n, [[LOGS, 4], [PACK, 1]], 15);
check('Ivar puts in four of his ten logs, the backpack and 15 silver', mine.barter?.mine.things.length === 2 && mine.barter?.mine.coins === 15
  && mine.barter.mine.things[0].has === 10, JSON.stringify(mine.barter?.mine));
const hers = offer(HILD, n, [[AXE, 1]], 2);
check('Hild puts in her hatchet and 2 silver, and sees his side', hers.barter?.theirs.coins === 15 && hers.barter.mine.things[0]?.def === 'hatchet',
  JSON.stringify(hers.barter?.theirs));
check('the same side sent again changes nothing', offer(HILD, n, [[AXE, 1]], 2).barter?.rev === rev(n) && rev(n) === 3, String(rev(n)));
check('and each side reads in words', sideWords(hers.barter!.theirs) === '4 × log, backpack and 15 silver', sideWords(hers.barter!.theirs));

/* ---- Accept, and a change taking it back --------------------------------------- */
console.log('--- accepting');
const r3 = rev(n);
const first = accept(IVAR, n, r3);
check('Ivar accepts; Hild is told', first.barter?.mine.ok === true && lastLine(HILD) === barterSaid('accepts', { who: nIvar }), lastLine(HILD));
check('pressing it again does nothing more', accept(IVAR, n, r3).barter?.mine.ok === true && oks(n) === 'true,false', oks(n));
offer(HILD, n, [[AXE, 1]], 1);
check('Hild changes her silver: both Accepts are taken back', oks(n) === 'false,false' && rev(n) === r3 + 1, `${oks(n)} rev ${rev(n)}`);
check('and an Accept against the trade as it was is refused', accept(HILD, n, r3).why === barterSaid('changed') && oks(n) === 'false,false', oks(n));
accept(IVAR, n, rev(n));
accept(HILD, n, rev(n) + 5);
offer(IVAR, n, [[LOGS, 4], [PACK, 1]], 14);
check('a change by whoever accepted takes it back too', oks(n) === 'false,false' && rev(n) === r3 + 2, `${oks(n)} rev ${rev(n)}`);
offer(IVAR, n, [[LOGS, 4], [PACK, 1]], 15);
offer(HILD, n, [[AXE, 1]], 2);

/* ---- refused at the Accept ---------------------------------------------------- */
console.log('--- refused when both have accepted');
/** Every row on the island: where it is, whose, and how many. */
const rows = (): string => psql(`select string_agg(id || ':' || holder || ':' || coalesce(holder_uid::text, '') || ':' || count || ':' || locked, ',' order by id) from item where world_id = '${W}';`);
const before = rows();
/** Both accept with `spoil` done in between, and see what the island says to each. */
const refusedAt = (what: string, spoil: string, mend: string, want: string): void => {
  const rv = rev(n);
  accept(IVAR, n, rv);
  psql(spoil);
  const spoilt = rows();
  const r = accept(HILD, n, rv);
  const refused = rows();
  check(`${what}: refused`, r.why === want, `${r.why} / ${want}`);
  check(`${what}: told to both in the same words`, lastLine(IVAR) === want && lastLine(HILD) === want, `${lastLine(IVAR)} / ${lastLine(HILD)}`);
  check(`${what}: both Accepts taken back`, oks(n) === 'false,false' && rev(n) === rv + 1, `${oks(n)} rev ${rev(n)}`);
  check(`${what}: and not a thing or a coin moved`, refused === spoilt);
  psql(mend);
  check(`${what}: mended, every thing is where it was`, rows() === before);
};
refusedAt('her hatchet dropped since', `update item set holder = 'ground', holder_uid = null, gx = 12, gy = 10 where id = ${AXE};`,
  `update item set holder = 'player', holder_uid = '${HILD}', gx = null, gy = null where id = ${AXE};`,
  barterSaid('missing', { who: nHild, what: barterThing('hatchet') }));
refusedAt('her hatchet held out in a deal since', `update item set deal = -1 where id = ${AXE};`, `update item set deal = null where id = ${AXE};`,
  barterSaid('missing', { who: nHild, what: barterThing('hatchet') }));
refusedAt('her hatchet taken in hand since', `update player set equipped = jsonb_build_object('weapon', ${AXE}) where world_id = '${W}' and uid = '${HILD}';`,
  `update player set equipped = '{}' where world_id = '${W}' and uid = '${HILD}';`, barterSaid('worn', { who: nHild, what: barterThing('hatchet') }));
refusedAt('his logs kept back since', `update item set locked = true where id = ${LOGS};`, `update item set locked = false where id = ${LOGS};`,
  barterSaid('locked', { who: nIvar, what: barterThing('log') }));
refusedAt('his logs burnt down to three since', `update item set count = 3 where id = ${LOGS};`, `update item set count = 10 where id = ${LOGS};`,
  barterSaid('fewer', { who: nIvar, what: barterThing('log') }));
refusedAt('her silver spent since', `update item set count = 1 where world_id = '${W}' and holder_uid = '${HILD}' and def = 'coin';`,
  `update item set count = 2 where world_id = '${W}' and holder_uid = '${HILD}' and def = 'coin';`, barterSaid('coins', { who: nHild, n: 2 }));
check('no weight is refused: picking up never is either, so the trade has no carry rule to hold to',
  !('carry' in BARTER_SAID));

/* ---- the swap ---------------------------------------------------------------- */
console.log('--- the swap');
const coinsBefore = purseOf(IVAR) + purseOf(HILD);
const unitsBefore = psql(`select sum(count) filter (where def <> 'coin') from item where world_id = '${W}';`);
const rv = rev(n);
accept(HILD, n, rv);
const done = accept(IVAR, n, rv);
check('both accept: it is done', done.done === true, JSON.stringify(done));
check('and both are told so', lastLine(IVAR) === barterSaid('done', { who: nHild }) && lastLine(HILD) === barterSaid('done', { who: nIvar }),
  `${lastLine(IVAR)} / ${lastLine(HILD)}`);
check('Ivar keeps six logs', where(LOGS) === `player:${IVAR}:6`, where(LOGS));
check('Hild has four', psql(`select sum(count) from item where world_id = '${W}' and holder = 'player' and holder_uid = '${HILD}' and def = 'log';`) === '4');
check('the backpack is hers, and the rope inside it with it', where(PACK) === `player:${HILD}:1` && where(INNER) === `bag:${HILD}:1`, `${where(PACK)} ${where(INNER)}`);
check('the hatchet is Ivar\'s', where(AXE) === `player:${IVAR}:1`, where(AXE));
check('Ivar paid 15 and got 2; Hild paid 2 and got 15', purseOf(IVAR) === 22 && purseOf(HILD) === 15, `${purseOf(IVAR)} ${purseOf(HILD)}`);
check('not a coin or a thing made or lost', purseOf(IVAR) + purseOf(HILD) === coinsBefore
  && psql(`select sum(count) filter (where def <> 'coin') from item where world_id = '${W}';`) === unitsBefore);
check('the trade is over', read(IVAR).barter === null && read(HILD).barter === null);

/* ---- sent again ---------------------------------------------------------------- */
console.log('--- the same Accept again');
const snapshot = (): string => psql(`select string_agg(def || ':' || holder || ':' || coalesce(holder_uid::text, '') || ':' || count, ',' order by def, holder_uid, count) from item where world_id = '${W}';`);
const after = snapshot();
check('Ivar\'s Accept sent again is over', accept(IVAR, n, rv).why === barterSaid('over'));
check('and Hild\'s', accept(HILD, n, rv).why === barterSaid('over'));
check('and nothing moved', snapshot() === after);

/* ---- both at once -------------------------------------------------------------- */
console.log('--- both at once');
const n2 = ask(HILD, IVAR).barter?.n ?? 0;
answer(IVAR, n2, true);
offer(HILD, n2, [[ROPE, 1]], 3);
offer(IVAR, n2, [[AXE, 1]], 0);
const rv2 = rev(n2);
const coins2 = purseOf(IVAR) + purseOf(HILD);
const all2 = snapshot();
const presses = await Promise.all([
  asLater(IVAR, `select rpc_barter_accept('${W}', ${n2}, ${rv2});`),
  asLater(HILD, `select rpc_barter_accept('${W}', ${n2}, ${rv2});`),
  asLater(IVAR, `select rpc_barter_accept('${W}', ${n2}, ${rv2});`),
  asLater(HILD, `select rpc_barter_accept('${W}', ${n2}, ${rv2});`),
]);
check('four presses at once, none of them an error', presses.every((p) => !p.err), presses.map((p) => p.err).join(' | '));
check('exactly one of them did the swap', presses.filter((p) => said(p).done).length === 1, presses.map((p) => p.out).join(' | '));
check('the rope is Ivar\'s and the hatchet Hild\'s, once', where(ROPE) === `player:${IVAR}:1` && where(AXE) === `player:${HILD}:1`, `${where(ROPE)} ${where(AXE)}`);
check('3 silver went over, once', purseOf(IVAR) + purseOf(HILD) === coins2 && purseOf(HILD) === 12 && purseOf(IVAR) === 25, `${purseOf(IVAR)} ${purseOf(HILD)}`);
check('and nothing else changed', all2 !== snapshot() && psql(`select count(*) from item where world_id = '${W}' and def = 'rope';`) === '3');

/* ---- ending one -------------------------------------------------------------- */
console.log('--- ending one');
const n3 = ask(IVAR, HILD).barter?.n ?? 0;
check('a no, said to both', answer(HILD, n3, false).declined === true
  && lastLine(IVAR) === barterSaid('declined', { who: nHild }) && lastLine(HILD) === barterSaid('youDeclined', { who: nIvar }));
const n4 = ask(IVAR, HILD).barter?.n ?? 0;
answer(HILD, n4, true);
offer(IVAR, n4, [[LOGS, 1]], 0);
const hush = snapshot();
check('a cancel, from either side', cancel(HILD, n4).cancelled === true
  && lastLine(IVAR) === barterSaid('cancelled', { who: nHild }) && lastLine(HILD) === barterSaid('youCancelled', { who: nIvar }),
  `${lastLine(IVAR)} / ${lastLine(HILD)}`);
check('after which nothing goes in, nothing is accepted and nothing moved',
  offer(IVAR, n4, [[LOGS, 2]], 0).why === barterSaid('over') && accept(IVAR, n4, rev(n4)).why === barterSaid('over') && snapshot() === hush);

const ended = (what: string, spoil: string, mend: string, key: 'apart' | 'left' | 'lapsed', whoFor: (uid: string) => string): void => {
  const m = ask(IVAR, HILD).barter?.n ?? 0;
  answer(HILD, m, true);
  psql(spoil.replace('{n}', String(m)));
  const r = read(IVAR);
  check(`${what}: the next look ends it`, r.barter === null && r.why === barterSaid(key, { who: nHild }), JSON.stringify(r));
  check(`${what}: and the line says so`, lastLine(IVAR) === barterSaid(key, { who: nHild })
    && (key === 'left' || lastLine(HILD) === barterSaid(key, { who: whoFor(HILD) })), `${lastLine(IVAR)} / ${lastLine(HILD)}`);
  psql(mend);
};
ended(`walking more than ${BARTER_REACH} tiles apart`, `update player set x = ${12.5 + BARTER_REACH} where world_id = '${W}' and uid = '${HILD}';`,
  `update player set x = 12.5 where world_id = '${W}' and uid = '${HILD}';`, 'apart', () => nIvar);
ended('Hild going away', `update player set away = true where world_id = '${W}' and uid = '${HILD}';`,
  `update player set away = false where world_id = '${W}' and uid = '${HILD}';`, 'left', () => nIvar);
ended(`${BARTER_IDLE} seconds with no change`, `update barter set at = now() - interval '${BARTER_IDLE + 1} seconds' where world_id = '${W}' and n = {n};`,
  'select 1;', 'lapsed', () => nIvar);
check('Stig was told of none of it on his topic', sent(STIG) === 0, String(sent(STIG)));

psql(CLEAN);
console.log(ok.join('\n'));
if (bad.length) {
  console.log(bad.join('\n'));
  console.log(`\n${bad.length} of ${ok.length + bad.length} failed`);
  process.exit(1);
}
console.log(`\nall ${ok.length} passed`);
