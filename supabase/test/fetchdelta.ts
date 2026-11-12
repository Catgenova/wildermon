/**
 * The creatures read: the same answer for less, and only what changed since the last one.
 *
 * Asked for: "streamline cpu". `rpc_creatures` was 31% of the live island's database time, every browser asking it
 * once a second for everything within forty tiles. Measured here:
 *
 *   * the read with its short cuts (panniers asked only of a kept one of a kind that carries them, a stun only while
 *     anything is stunned, a settlement's trade counts only when a worker of yours is in it) says what the same read
 *     says with every short cut taken out, key for key, to the keeper of a full pannier and to somebody else;
 *   * a browser that says neither cursor nor ids (a page from before this) gets the list it always got;
 *   * handed back its cursor and the ids it holds, the read sends exactly what changed: a creature that walked off on
 *     a new leg, one hurt, one stunned, one of yours in a crate written to, one come into the world; says which went,
 *     killed or walked out of range; and sends nothing else but the few whose answer moves without their row being
 *     written (a kept one with panniers, one ridden);
 *   * a browser laying those answers (`MobsHeld`, the browser's own) holds, after every turn of the clock, what the
 *     whole answer says at that moment: the same creatures, every key the same, what counts down within a breath;
 *   * a cursor that is unreadable, too old, or comes without the ids is answered whole; and more ids than any answer
 *     holds are refused at the door;
 *   * asked for packed (`p_pack`), every row is its values in the order of `cols` and one object of the rest, and
 *     unpacks (`unpack`, the browser's own) to the object the whole answer says, key for key, to the keeper of a full
 *     pannier and to somebody else; and a browser laying packed answers holds what the whole answer says too;
 *   * and the browser asks for the whole answer well within the time a cursor is good for.
 *
 * Every step is its own transaction, as a browser's asks are: a cursor is a snapshot, and only rows written by
 * transactions after it are new to it. Makes its own island, and takes it away again.
 */
import { execFileSync } from 'node:child_process';
import { AWAY_SLOWER, MOBS_EVERY } from '../../src/game/keep';
import type { IslandCreature } from '../../src/game/creatures';
import { MobsHeld, unpack, type MobsAnswer } from '../../src/net/mobsync';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wildermon',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const ME = 'fdd10000-0000-4000-8000-0000000000a1';
const YOU = 'fdd10000-0000-4000-8000-0000000000a2';
const ISLE = 'Fetchdelta';
const W = `(select id from world where name = '${ISLE}')`;

/*
 * The read as the island has it, but for the sweep it runs on a database without `pg_cron` (this one): there the
 * clock is the only thing that writes a creature between two asks, as it is on the island, rather than each ask
 * settling the ones whose turn is due. The sweep's own writes are asked about on their own, below.
 */
const READ = `do $r$
declare d text := pg_get_functiondef('public.rpc_creatures(uuid,double precision,text,integer[],boolean)'::regprocedure);
        s text := 'perform creature_sweep(p_world, p.x, p.y, p_range);';
begin
  if (length(d) - length(replace(d, s, ''))) / length(s) <> 1 then raise exception 'the read has no sweep to leave out'; end if;
  execute replace(replace(d, 'FUNCTION public.rpc_creatures(', 'FUNCTION pg_temp.rpc_creatures_read('), s, 'null;');
end $r$;`;

/** As `who`, one call of the read (`sweep`: the island's own, sweep and all), in a transaction of its own; the answer as JSON. */
const ask = (who: string, args: string, sweep = false): unknown => {
  const out = psql(`${sweep ? '' : READ}
select set_config('request.jwt.claims', json_build_object('sub', '${who}')::text, false) \\g /dev/null
delete from caller where uid = '${who}';
select ${sweep ? 'public.rpc_creatures' : 'pg_temp.rpc_creatures_read'}(${W}, 40${args})::text;`);
  return JSON.parse(out);
};
const sqlInts = (xs: number[]): string => `'{${xs.join(',')}}'::int[]`;
const delta = (who: string, held: MobsHeld): MobsAnswer =>
  ask(who, `, '${held.at}', ${sqlInts(held.have())}`) as MobsAnswer;
const idsOf = (rows: unknown): number[] => (rows as IslandCreature[]).map((r) => r.id).sort((a, b) => a - b);
const same = (a: number[], b: number[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/* ---- the island ------------------------------------------------------------------------------------------------- */

const made = psql(`
delete from world where name = '${ISLE}';
create temp table fd (k text, id int);
do $t$
declare w uuid; me uuid := '${ME}'; you uuid := '${YOU}'; v int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('${ISLE}', 331, 200, 100, 100, true) returning id into w;
  perform land_blank(w, 200);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(40, 180) x, generate_series(40, 160) y;
  perform set_config('request.jwt.claims', json_build_object('sub', you)::text, true);
  perform rpc_join(w, 'Fetchee');
  perform set_config('request.jwt.claims', json_build_object('sub', me)::text, true);
  perform rpc_join(w, 'Fetcher');
  update player set x = 100.5, y = 100.5, body_at = now(), swim_at = now(), seen_at = now(), away = false where world_id = w and uid = me;
  update player set x = 104.5, y = 100.5, body_at = now(), swim_at = now(), seen_at = now(), away = false where world_id = w and uid = you;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Fetchstead', 90, 90, 5, 5, me);
  insert into fd values
    ('W1', creature_spawn(w, 'roxxen', 110.5, 100.5)),
    ('W2', creature_spawn(w, 'rabba', 95.5, 105.5)),
    ('W3', creature_spawn(w, 'roxxen', 120.5, 110.5)),
    ('W4', creature_spawn(w, 'quarra', 130.5, 100.5)),
    ('W5', creature_spawn(w, 'rabba', 100.5, 120.5)),
    ('W6', creature_spawn(w, 'roxxen', 85.5, 85.5)),
    ('W7', creature_spawn(w, 'quarra', 115.5, 90.5)),
    ('FAR', creature_spawn(w, 'roxxen', 170.5, 150.5)),
    ('O1', creature_spawn(w, 'tinka', 101.5, 101.5, 'active', now() - interval '30 days', me)),
    ('O2', creature_spawn(w, 'rabba', 100.5, 100.5, 'stored', now() - interval '30 days', me)),
    ('O3', creature_spawn(w, 'tinka', 90.5, 90.5, 'deed', now() - interval '60 days', me)),
    ('Y1', creature_spawn(w, 'bura', 104.5, 101.5, 'active', now() - interval '30 days', you)),
    ('Y2', creature_spawn(w, 'roxxen', 104.5, 99.5, 'active', now() - interval '30 days', you)),
    ('Y3', creature_spawn(w, 'rabba', 106.5, 100.5, 'active', now() - interval '30 days', you));
  -- Nothing due: the read's own sweep (a database without pg_cron) and the clock leave them be until asked.
  update creature set until = now() + interval '1 day', leg_at = now() - interval '10 seconds', leg_ends = now() - interval '5 seconds',
         phase = 'idle'
   where world_id = w;
  -- One walking a long leg, which counts down between answers.
  update creature set from_x = 80.5, from_y = 85.5, to_x = 90.5, to_y = 85.5, leg_at = now() - interval '5 seconds', leg_ends = now() + interval '200 seconds'
   where world_id = w and id = (select id from fd where k = 'W6');
  update creature set rare = 'rare', form_size = 'large', form_colour = true where world_id = w and id = (select id from fd where k = 'W7');
  -- Your mount's panniers, with things in them; a mount ridden; one bred.
  insert into item (world_id, holder, pannier, def, ql, count)
    select w, 'pannier', (select id from fd where k = 'Y1'), d, 30, 2 from unnest(array['log', 'stone']) d;
  update creature set rider = you, tacked = true where world_id = w and id = (select id from fd where k = 'Y2');
  update creature set pedigree = '{"dam": {"id": 1, "name": "A"}, "sire": {"id": 2, "name": "B"}, "from": {}, "line": {}}'::jsonb
   where world_id = w and id = (select id from fd where k = 'Y3');
  update creature set job = null, post = null where world_id = w and id = (select id from fd where k = 'O3');
end $t$;
select string_agg(k || '=' || id, ',' order by k) from fd;
`);
const ID: Record<string, number> = Object.fromEntries(made.split('\n').pop()!.split(',').map((kv) => {
  const [k, v] = kv.split('=');
  return [k, Number(v)];
}));
check('the island is made with its creatures', Object.keys(ID).length === 14 && Object.values(ID).every((v) => v > 0), made.split('\n').pop());

/* ---- the same answer, cheaper ----------------------------------------------------------------------------------- */

// The read with every short cut taken out, as it was: each short cut's condition replaced with `true`.
const CUTS = [
  "c.keeper is not null and c.species = any (array(select d.id from species_def d where d.panniers is not null))\n              then pannier_sent",
  "exists (select 1 from class_mark m where m.world_id = p_world and m.kind = 'stun' and m.until > now())",
];
const sameSaid = psql(`
begin;
insert into class_mark (world_id, creature_id, kind, val, until) values (${W}, ${ID.W5}, 'stun', 1, now() + interval '30 seconds');
do $t$
declare d text := pg_get_functiondef('public.rpc_creatures(uuid,double precision,text,integer[],boolean)'::regprocedure); c text; n int;
begin
  d := replace(d, 'FUNCTION public.rpc_creatures(', 'FUNCTION pg_temp.rpc_creatures_whole(');
  foreach c in array array[${CUTS.map((c) => `$c$${c}$c$`).join(', ')}] loop
    n := (length(d) - length(replace(d, c, ''))) / length(c);
    if n <> 1 then raise exception 'short cut found % times: %', n, c; end if;
    d := replace(d, c, case when c like '%then pannier_sent' then E'true\\n              then pannier_sent' else 'true' end);
  end loop;
  execute d;
end $t$;
create temp table said (k text, v text);
do $t$
declare u uuid; a jsonb; b jsonb; c jsonb;
begin
  foreach u in array array['${ME}', '${YOU}']::uuid[] loop
    perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
    delete from caller where uid = u;
    a := pg_temp.rpc_creatures_whole(${W}, 40);
    delete from caller where uid = u;
    b := rpc_creatures(${W}, 40);
    delete from caller where uid = u;
    c := rpc_creatures(${W}, 40, '', '{}')->'rows';
    insert into said values (u::text, jsonb_array_length(a) || '|' || (a = b)::text || '|' || (a = c)::text || '|'
      || coalesce((select jsonb_array_length(e->'pannier') from jsonb_array_elements(a) e where (e->>'id')::int = ${ID.Y1}), -1) || '|'
      || coalesce((select (e->>'stunned')::numeric > 0 from jsonb_array_elements(a) e where (e->>'id')::int = ${ID.W5}), false)::text);
  end loop;
end $t$;
select k || '=' || v from said;
rollback;
`);
const sameBy = new Map(sameSaid.split('\n').filter((l) => l.includes('=')).map((l) => l.split('=') as [string, string]));
for (const [who, name] of [[ME, 'somebody else'], [YOU, 'the keeper of a full pannier']] as const) {
  const [n, whole, full, pannier, stunned] = (sameBy.get(who) ?? '').split('|');
  check(`to ${name}, the read says what it says with every short cut taken out, key for key (${n} creatures)`,
    whole === 'true' && Number(n) > 8, sameBy.get(who));
  check(`and its whole answer in the new shape says the same rows`, full === 'true', sameBy.get(who));
  check(`and the stunned one says so (${name})`, stunned === 'true', sameBy.get(who));
  if (who === YOU) check('the keeper is shown the two things in the panniers', pannier === '2', pannier);
  else check('and nobody else is shown them', pannier === '-1', pannier);
}

/* ---- an old browser -------------------------------------------------------------------------------------------- */

const oldSaid = psql(`
begin;
select set_config('request.jwt.claims', json_build_object('sub', '${ME}')::text, true) \\g /dev/null
delete from caller where uid = '${ME}';
create temp table o (a jsonb, b jsonb, c jsonb);
insert into o select rpc_creatures(${W}, 40), null, null;
delete from caller where uid = '${ME}';
update o set b = rpc_creatures(${W}, 40, null, null);
delete from caller where uid = '${ME}';
update o set c = rpc_creatures(${W}, 40, '', '{}');
select jsonb_typeof(a) || '|' || (a = b)::text || '|' || (a = c->'rows')::text || '|' || (c->>'full') || '|' || jsonb_typeof(c->'at') from o;
rollback;
`);
check('a browser that says neither cursor nor ids gets the list it always got', oldSaid === 'array|true|true|true|string', oldSaid);

/* ---- packed ---------------------------------------------------------------------------------------------------- */

/** Two answers alike key for key, whatever order each names its keys in. */
const sortedKeys = (v: unknown): unknown => Array.isArray(v) ? v.map(sortedKeys)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortedKeys((v as Record<string, unknown>)[k])])) : v;
for (const [who, name] of [[ME, 'somebody else'], [YOU, 'the keeper of a full pannier']] as const) {
  const [plainSaid, packedSaid] = psql(`select set_config('request.jwt.claims', json_build_object('sub', '${who}')::text, false) \\g /dev/null
begin;
delete from caller where uid = '${who}';
select rpc_creatures(${W}, 40)::text;
delete from caller where uid = '${who}';
select rpc_creatures(${W}, 40, '', '{}', true)::text;
rollback;`).split('\n');
  const plain = JSON.parse(plainSaid) as IslandCreature[];
  const packed = JSON.parse(packedSaid) as MobsAnswer & { rows: unknown[]; cols: string[] };
  const opened = packed.rows.map((r) => unpack(r, packed.cols));
  check(`packed, to ${name}: every row is its values and one object of the rest (${packed.rows.length} rows, ${packed.cols?.length} keys)`,
    Array.isArray(packed.cols) && packed.rows.every((r) => Array.isArray(r)) && opened.every((r) => r !== null), JSON.stringify(packed.cols));
  check(`and unpacked, the rows are the whole answer's, key for key`,
    JSON.stringify(sortedKeys(opened)) === JSON.stringify(sortedKeys(plain)),
    `${JSON.stringify(sortedKeys(opened)).length} / ${JSON.stringify(sortedKeys(plain)).length} characters`);
  check('and fewer characters for it', packedSaid.length < plainSaid.length * 0.7, `${packedSaid.length} for ${plainSaid.length}`);
}

/* ---- only what changed ----------------------------------------------------------------------------------------- */

const held = new Map<string, MobsHeld>([[ME, new MobsHeld()], [YOU, new MobsHeld()]]);
const lay = (who: string, said: MobsAnswer, t = Date.now()): IslandCreature[] | null => held.get(who)!.take(said, t);

const first = ask(ME, `, '', '{}'`) as MobsAnswer & { rows: IslandCreature[] };
lay(ME, first);
check('the first answer is the whole one, with a cursor', first.full === true && typeof first.at === 'string'
  && /^v1:\d+:\d+:\d+:[\d,]*$/.test(String(first.at)), String(first.at));
const view0 = idsOf(first.rows);
const inView = (k: string): boolean => view0.includes(ID[k]);
check('it holds everything in range and your own in their crate, and nothing past the range',
  ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'O1', 'O2', 'O3', 'Y1', 'Y2', 'Y3'].every(inView) && !inView('FAR'),
  view0.join(','));

// What happens between two asks, each its own transaction as the clock's writes are.
const sprung = psql(`
update creature set from_x = 110.5, from_y = 100.5, to_x = 112.5, to_y = 100.5, leg_at = now(), leg_ends = now() + interval '4 seconds'
 where world_id = ${W} and id = ${ID.W1};
update creature set health = health - 5 where world_id = ${W} and id = ${ID.W2};
delete from creature where world_id = ${W} and id = ${ID.W3};
update creature set from_x = 170.5, to_x = 170.5 where world_id = ${W} and id = ${ID.W4};
insert into class_mark (world_id, creature_id, kind, val, until) values (${W}, ${ID.W5}, 'stun', 1, now() + interval '30 seconds');
update creature set care = 0.5 where world_id = ${W} and id = ${ID.O2};
select creature_spawn(${W}, 'rabba', 99.5, 99.5);
`);
const W8 = Number(sprung.split('\n').pop());
psql(`update creature set until = now() + interval '1 day', leg_at = now() - interval '10 seconds', leg_ends = now() - interval '5 seconds'
 where world_id = ${W} and id = ${W8};`);

const d1 = delta(ME, held.get(ME)!) as MobsAnswer & { rows: IslandCreature[]; gone: number[] };
const ALWAYS = [ID.Y1, ID.Y2];
const want1 = [ID.W1, ID.W2, ID.W5, ID.O2, W8, ...ALWAYS].sort((a, b) => a - b);
check('handed back, the read sends what changed: one walked off, one hurt, one stunned, one of yours written to, one new',
  same(idsOf(d1.rows), want1) && d1.full === false, `${idsOf(d1.rows).join(',')} for ${want1.join(',')}`);
check('and says which went: one killed, one walked out of range',
  same([...(d1.gone ?? [])].sort((a, b) => a - b), [ID.W3, ID.W4].sort((a, b) => a - b)), JSON.stringify(d1.gone));
const r1 = new Map(d1.rows.map((r) => [r.id, r]));
check('the one walked off is sent on its new leg', r1.get(ID.W1)?.toX === 112.5 && (r1.get(ID.W1)?.legLeft ?? 0) > 0, JSON.stringify(r1.get(ID.W1)?.toX));
check('the stunned one with its stun', (r1.get(ID.W5)?.stunned ?? 0) > 0, String(r1.get(ID.W5)?.stunned));
lay(ME, d1);

const d2 = delta(ME, held.get(ME)!) as MobsAnswer & { rows: IslandCreature[]; gone: number[] };
check('asked again with nothing written, only the kept one with panniers and the one ridden come',
  same(idsOf(d2.rows), [...ALWAYS].sort((a, b) => a - b)) && (d2.gone ?? []).length === 0,
  `${idsOf(d2.rows).join(',')}; gone ${JSON.stringify(d2.gone)}`);
lay(ME, d2);

/* ---- a browser laying them holds what the whole answer says ---------------------------------------------------- */

/** Keys that count down between an answer and the next, and how far two readings a breath apart may differ. */
const LOOSE: Record<string, number> = { legLeft: 1, windup: 1, stunned: 1, slowed: 1, fedLeft: 1, dueIn: 1, idleN: 1, x: 0.75, y: 0.75 };
const differs = (a: IslandCreature, b: IslandCreature): string | null => {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.join() !== kb.join()) return `keys ${ka.filter((k) => !kb.includes(k))} / ${kb.filter((k) => !ka.includes(k))}`;
  for (const k of ka) {
    const va = (a as unknown as Record<string, unknown>)[k];
    const vb = (b as unknown as Record<string, unknown>)[k];
    if (k in LOOSE && typeof va === 'number' && typeof vb === 'number') {
      if (Math.abs(va - vb) > LOOSE[k]) return `${k} ${va} / ${vb}`;
    } else if (JSON.stringify(va) !== JSON.stringify(vb)) return `${k} ${JSON.stringify(va)} / ${JSON.stringify(vb)}`;
  }
  return null;
};

let rounds = 0;
let worst = '';
let sent = 0;
let whole = 0;
// And the same asked for packed, each body's held on its own.
const packedHeld = new Map<string, MobsHeld>([[ME, new MobsHeld()], [YOU, new MobsHeld()]]);
for (let round = 0; round < 6; round++) {
  // Some of them due, the clock turned, and what each body is told.
  psql(`update creature set until = now() where world_id = ${W} and mode = 'wild' and id % 3 = ${round % 3};
select world_tick() \\g /dev/null`);
  if (round === 3) psql(`update creature set leg_ends = now() + interval '1 second', from_x = to_x - 1, leg_at = now()
    where world_id = ${W} and id = ${ID.W7};`);
  for (const who of [ME, YOU]) {
    const h = held.get(who)!;
    const said = (h.at === null ? ask(who, `, '', '{}'`) : delta(who, h)) as MobsAnswer & { rows: IslandCreature[] };
    if (lay(who, said) === null) worst ||= 'an answer that was not one';
    sent += said.rows.length;
    const hp = packedHeld.get(who)!;
    const saidPacked = ask(who, hp.at === null ? `, '', '{}', true` : `, '${hp.at}', ${sqlInts(hp.have())}, true`) as MobsAnswer;
    if (hp.take(saidPacked, Date.now()) === null) worst ||= 'a packed answer that was not one';
    const t = Date.now();
    const full = ask(who, '') as IslandCreature[];
    whole += full.length;
    for (const [kind, from] of [['', h], ['packed, ', hp]] as const) {
      const mine = from.all(Date.now() - (Date.now() - t) / 2);
      if (!same(mine.map((r) => r.id), idsOf(full))) worst ||= `${kind}round ${round}: held ${mine.map((r) => r.id)} / whole ${idsOf(full)}`;
      const byId = new Map(mine.map((r) => [r.id, r]));
      for (const r of full) {
        const why = byId.has(r.id) ? differs(byId.get(r.id)!, r) : 'missing';
        if (why) worst ||= `${kind}round ${round}, creature ${r.id}: ${why}`;
      }
    }
    rounds++;
  }
}
check(`a browser laying only what changed holds what the whole answer says, after each of ${rounds} turns of the clock, packed or not`,
  worst === '', worst);
check('and was sent fewer rows than the whole answers held', sent < whole, `${sent} rows for ${whole}`);

/* ---- what a read writes itself ----------------------------------------------------------------------------------- */

// On a database without pg_cron the read settles what is due round you before it reads: its own writes are in what it
// sends, and its cursor counts them among the running, so the next answer sends them again rather than never.
psql(`update creature set until = now() - interval '1 second' where world_id = ${W} and id = ${ID.W6};`);
const swept = ask(ME, `, '${held.get(ME)!.at}', ${sqlInts(held.get(ME)!.have())}`, true) as MobsAnswer & { rows: IslandCreature[] };
const sweptBy = psql(`select xmin::text from creature where world_id = ${W} and id = ${ID.W6}`);
const running = String(swept.at).split(':')[4].split(',').map((x) => Number(BigInt(x) % 4294967296n));
check('a creature the read itself settled is sent', idsOf(swept.rows).includes(ID.W6), idsOf(swept.rows).join(','));
check('and its cursor counts what the read wrote as not yet seen', running.includes(Number(sweptBy)), `${sweptBy} in ${running}`);
lay(ME, swept);

/* ---- a cursor it cannot read ----------------------------------------------------------------------------------- */

const h = held.get(ME)!;
const oldAt = String(h.at).replace(/^v1:\d+:/, `v1:${Date.now() - 1000 * 1000}:`);
const wholeFor = (args: string): unknown => (ask(ME, args) as MobsAnswer).full;
check('an unreadable cursor is answered whole', wholeFor(`, 'v1:nonsense', ${sqlInts(h.have())}`) === true);
check('and one too old', wholeFor(`, '${oldAt}', ${sqlInts(h.have())}`) === true, oldAt);
check('and one without the ids it holds', wholeFor(`, '${h.at}', null`) === true);
check('and a good one is not', wholeFor(`, '${h.at}', ${sqlInts(h.have())}`) === false);
const tooMany = psql(`select set_config('request.jwt.claims', json_build_object('sub', '${ME}')::text, false) \\g /dev/null
delete from caller where uid = '${ME}';
create temp table r (v text);
do $t$ begin
  perform rpc_creatures(${W}, 40, '', array(select generate_series(1, private.have_most() + 1)));
  insert into r values ('taken');
exception when others then insert into r values (sqlstate || ' ' || sqlerrm);
end $t$;
select v from r;`);
check('more ids than any answer holds are refused at the door', tooMany === '22023 Bad request: rpc_creatures p_have: too many.', tooMany);

const most = Number(psql('select private.since_most()'));
// Every answer hands back a cursor of its own, so what a cursor must outlast is the longest wait between two asks: a tab in the background.
const longest = MOBS_EVERY * AWAY_SLOWER;
check(`the longest wait between two asks, ${longest} s in a background tab, is within the ${most} s a cursor is good for`,
  longest <= most, `${longest} / ${most}`);

psql(`delete from world where name = '${ISLE}';`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nthe creatures read, only what changed — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
