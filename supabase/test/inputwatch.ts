/**
 * Input timing on the island's watch (20261026050100, src/engine/cadence.ts).
 *
 * On an island of its own, Tickmoor, kept by Kell, with Anna, Bram, Cora and
 * Dov on it and Eli on none, each summary counted by the browser's own
 * `Cadence` from events handed to it as a page would:
 *
 *   * the counting: clicks a second apart to the millisecond are a run of no
 *     spread; clicks a person makes are not; held-key repeats are left out; a
 *     click at the same spot with no movement before it is still, one after
 *     the mouse moved is not, and a tap is not a mouse click; an event a
 *     script dispatched is synthetic; nothing counted is nothing to send;
 *   * the flags: Anna's clicks like a metronome, Bram's keys the same, Cora's
 *     mouse clicks with no movement and Dov's synthetic clicks each raise an
 *     `input` flag naming why, with the numbers; a person's summary raises
 *     none;
 *   * the pace: a second summary inside `watch_input_mins()` is not read, one
 *     after it is, and a body is flagged once a day however often it says so;
 *   * what is dropped: a summary from somebody not on the island, one that is
 *     not an object or is too long; numbers past their range are held to it;
 *   * the keeper: the flag is listed by `rpc_owner_flags` under its label,
 *     with a line of numbers; the window's numbers are the island's;
 *   * and no browser reads the table or calls the helpers, and nobody signed
 *     out calls the door.
 *
 * Makes and removes everything it uses.
 */
import { execFileSync } from 'node:child_process';
import { Cadence, type InputNote } from '../../src/engine/cadence';
import {
  flagLabel, flagLine, WATCH_INPUT_CV, WATCH_INPUT_MINS, WATCH_INPUT_RUN, WATCH_INPUT_STILL, WATCH_INPUT_SYNTHETIC,
  type WatchFlags,
} from '../../src/game/watch';

const ENV = {
  ...process.env,
  PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
  PGPORT: process.env.PGPORT ?? '5433',
  PGUSER: process.env.PGUSER ?? 'wurm',
  PGDATABASE: process.env.PGDATABASE ?? 'postgres',
};

interface Ran { out: string; err: string }
const sql = (text: string): Ran => {
  try {
    const out = execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'],
      { input: text, encoding: 'utf8', env: ENV, stdio: ['pipe', 'pipe', 'pipe'] });
    return { out: out.trim(), err: '' };
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
const as = (who: string, text: string): Ran => sql(
  `select set_config('request.jwt.claims', '${JSON.stringify({ sub: who })}', false) \\g /dev/null\nset role authenticated;\n${text}\n`);

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const W = 'ec000000-0000-4000-8000-0000000000a1';
const KELL = 'ec000000-0000-4000-8000-000000000001';
const ANNA = 'ec000000-0000-4000-8000-000000000002';
const BRAM = 'ec000000-0000-4000-8000-000000000003';
const CORA = 'ec000000-0000-4000-8000-000000000004';
const DOV = 'ec000000-0000-4000-8000-000000000005';
const ELI = 'ec000000-0000-4000-8000-000000000006'; // on no island
const ALL = [KELL, ANNA, BRAM, CORA, DOV, ELI];
const list = (xs: string[]): string => xs.map((x) => `'${x}'`).join(', ');

const CLEAN = `
delete from private.watch_flag where world_id = '${W}';
delete from private.watch_input where world_id = '${W}' or uid in (${list(ALL)});
delete from private.owner_log where world_id = '${W}';
delete from world where id = '${W}';
delete from auth.users where id in (${list(ALL)});
delete from caller where uid in (${list(ALL)});
`;
psql(CLEAN);
const BODY = `'{"health":1,"stamina":1,"hunger":1,"thirst":1}'::jsonb`;
psql(`
insert into auth.users (id, email) values
  ('${KELL}', 'kell@tick.test'), ('${ANNA}', 'anna@tick.test'), ('${BRAM}', 'bram@tick.test'),
  ('${CORA}', 'cora@tick.test'), ('${DOV}', 'dov@tick.test'), ('${ELI}', 'eli@tick.test');
insert into world (id, name, seed, size, spawn_x, spawn_y, ready, made_by) values ('${W}', 'Tickmoor', 1, 32, 5, 5, true, '${KELL}');
insert into player (world_id, uid, name, x, y, stats) values
  ('${W}', '${KELL}', 'Kell', 20.5, 20.5, ${BODY}), ('${W}', '${ANNA}', 'Anna', 5.5, 5.5, ${BODY}),
  ('${W}', '${BRAM}', 'Bram', 6.5, 5.5, ${BODY}), ('${W}', '${CORA}', 'Cora', 7.5, 5.5, ${BODY}),
  ('${W}', '${DOV}', 'Dov', 8.5, 5.5, ${BODY});
`);

/* ---- the browser's counting ------------------------------------------------------ */

type Handler = (e: Record<string, unknown>) => void;
/** A window to hand events to, as the page's would arrive. */
const page = (): { cadence: Cadence; fire: (type: string, e: Record<string, unknown>) => void } => {
  const on = new Map<string, Handler[]>();
  const target = {
    addEventListener: (type: string, fn: Handler) => on.set(type, [...(on.get(type) ?? []), fn]),
  } as unknown as Window;
  const cadence = new Cadence(target);
  return { cadence, fire: (type, e) => { for (const fn of on.get(type) ?? []) fn({ isTrusted: true, ...e }); } };
};
/** `n` mouse clicks, `gap(i)` ms apart, at `spot(i)`, moving the mouse before each when `moves`. */
const clicks = (p: ReturnType<typeof page>, n: number, gap: (i: number) => number, opts: {
  moves?: boolean; trusted?: boolean; type?: string; spot?: (i: number) => [number, number];
} = {}): void => {
  let t = 1000;
  for (let i = 0; i < n; i++) {
    const [x, y] = opts.spot?.(i) ?? [400, 300];
    if (opts.moves) p.fire('pointermove', { pointerType: 'mouse', clientX: x - 3, clientY: y - 2, timeStamp: t - 50 });
    p.fire('pointerdown', { pointerType: opts.type ?? 'mouse', clientX: x, clientY: y, timeStamp: t, isTrusted: opts.trusted ?? true });
    p.fire('click', { timeStamp: t + 80, isTrusted: opts.trusted ?? true });
    t += gap(i);
  }
};
/** A person's gaps: 300 ms to 2.5 s, from a fixed sequence so the test is the same every time. */
let seed = 7;
const human = (): number => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return 300 + (seed % 2200);
};
const spotOf = (i: number): [number, number] => [200 + ((i * 37) % 400), 150 + ((i * 53) % 300)];

console.log('--- counting');
const metronome = page();
clicks(metronome, 60, () => 1000, { moves: true, spot: spotOf });
const annaNote = metronome.cadence.take();
check('clicks a second apart are one run of no spread', annaNote?.clicks === 59 && annaNote.click_ms === 1000 && annaNote.click_cv === 0,
  JSON.stringify(annaNote));
check('and after a take there is nothing to send', metronome.cadence.take() === null);

const person = page();
clicks(person, 60, human, { moves: true, spot: spotOf });
for (let i = 0, t = 200_000; i < 50; i++, t += human()) person.fire('keydown', { timeStamp: t, repeat: false });
const personNote = person.cadence.take();
check('a person\'s clicks and keys spread far past the line', !!personNote
  && personNote.click_cv > WATCH_INPUT_CV * 5 && personNote.key_cv > WATCH_INPUT_CV * 5 && personNote.still === 0,
  JSON.stringify(personNote));

const typist = page();
for (let i = 0, t = 0; i < 50; i++, t += 250) {
  typist.fire('keydown', { timeStamp: t, repeat: false });
  typist.fire('keydown', { timeStamp: t + 30, repeat: true });
}
const bramNote = typist.cadence.take();
check('keys a quarter second apart are a run of no spread, held-key repeats left out',
  bramNote?.keys === 49 && bramNote.key_ms === 250 && bramNote.key_cv === 0, JSON.stringify(bramNote));

const still = page();
clicks(still, 50, human);
const coraNote = still.cadence.take();
check('clicks at one spot with no movement are still, all but the first', coraNote?.mouse === 50 && coraNote.still === 49,
  JSON.stringify(coraNote));
const moving = page();
clicks(moving, 50, human, { moves: true });
const tapping = page();
clicks(tapping, 50, human, { type: 'touch' });
check('a click after the mouse moved is not still, and a tap is not a mouse click',
  moving.cadence.take()?.still === 0 && tapping.cadence.take()?.mouse === 0);

const scripted = page();
clicks(scripted, 12, human, { trusted: false, moves: true, spot: spotOf });
const dovNote = scripted.cadence.take();
check('events a script dispatched are synthetic', dovNote?.synthetic === 24, JSON.stringify(dovNote));
const gaps = page();
clicks(gaps, 30, (i) => (i === 14 ? 20_000 : 1000));
check('a gap of over 10 s ends a run', gaps.cadence.take()?.clicks === 14);

/* ---- the island's flags ---------------------------------------------------------- */

const note = (who: string, n: unknown): { read?: boolean; flag?: boolean; err?: string } => {
  psql(`delete from caller where uid = '${who}';`);
  const r = as(who, `select rpc_input_note('${W}', '${JSON.stringify(n).replace(/'/g, "''")}'::jsonb);`);
  return r.err ? { err: r.err } : JSON.parse(r.out) as { read?: boolean; flag?: boolean };
};
const flags = (): Array<{ uid: string; detail: Record<string, unknown> }> => {
  const out = psql(`select coalesce(jsonb_agg(jsonb_build_object('uid', uid, 'detail', detail) order by n), '[]')
    from private.watch_flag where world_id = '${W}' and kind = 'input';`);
  return JSON.parse(out) as Array<{ uid: string; detail: Record<string, unknown> }>;
};
const whyOf = (uid: string): string[] => (flags().find((f) => f.uid === uid)?.detail.why as string[] | undefined) ?? [];
const later = (uid: string): void => {
  psql(`update private.watch_input set at = now() - make_interval(mins => private.watch_input_mins() + 1)
    where world_id = '${W}' and uid = '${uid}';`);
};

console.log('--- flags');
const kellSaid = note(KELL, personNote);
check('a person\'s summary is read and raises nothing', kellSaid.read === true && kellSaid.flag === false && flags().length === 0,
  JSON.stringify(kellSaid));
const annaSaid = note(ANNA, annaNote);
check('clicks like a metronome raise an input flag', annaSaid.flag === true && whyOf(ANNA).join() === 'clicks', JSON.stringify(annaSaid));
const annaFlag = flags().find((f) => f.uid === ANNA)?.detail ?? {};
check('with the run\'s numbers', annaFlag.clicks === 59 && annaFlag.click_ms === 1000 && annaFlag.click_cv === 0, JSON.stringify(annaFlag));
note(BRAM, bramNote);
check('keys the same', whyOf(BRAM).join() === 'keys', whyOf(BRAM).join());
note(CORA, coraNote);
check('mouse clicks with no movement', whyOf(CORA).join() === 'still', whyOf(CORA).join());
note(DOV, dovNote);
check('clicks a script dispatched', whyOf(DOV).join() === 'synthetic', whyOf(DOV).join());

console.log('--- pace');
const soon = note(ANNA, annaNote);
check(`a second summary inside ${WATCH_INPUT_MINS} min is not read`, soon.read === false, JSON.stringify(soon));
later(ANNA);
const after = note(ANNA, annaNote);
check('one after it is', after.read === true, JSON.stringify(after));
check('and a body is flagged once a day however often it says so', after.flag === false
  && flags().filter((f) => f.uid === ANNA).length === 1);

console.log('--- dropped');
const eli = note(ELI, annaNote);
check('a summary from somebody not on the island is not read', eli.read === false && !eli.err, JSON.stringify(eli));
later(KELL);
check('nor one that is not an object', note(KELL, [1, 2, 3]).read === false);
later(KELL);
check('nor one too long to be a summary', note(KELL, { ...personNote, pad: 'x'.repeat(3000) }).read === false);
later(KELL);
const wild = note(KELL, { clicks: -5, click_ms: 'soon', click_cv: 1e12, mouse: 3, still: 900, synthetic: 2.7 });
const heldTo = psql(`select note from private.watch_input where world_id = '${W}' and uid = '${KELL}';`);
const held = JSON.parse(heldTo) as InputNote;
check('numbers past their range are held to it', wild.read === true && held.clicks === 0 && held.click_ms === 0
  && held.click_cv === 100000 && held.still === 3 && held.synthetic === 2, heldTo);

console.log('--- the keeper');
psql(`delete from caller where uid = '${KELL}';`);
const listed = as(KELL, `select rpc_owner_flags('${W}');`);
const shown = listed.err ? null : JSON.parse(listed.out) as WatchFlags;
const rows = shown?.flags.filter((f) => f.kind === 'input') ?? [];
check('the keeper lists each input flag under its label, with a line of numbers', rows.length === 4
  && rows.every((f) => flagLabel(f.kind) === 'Input timing' && /\d/.test(flagLine(f)) && !flagLine(f).includes('undefined')),
  listed.err || rows.map((f) => `${f.name}: ${flagLine(f)}`).join(' / '));
for (const f of rows) console.log(`  ${flagLabel(f.kind)}: ${f.name} — ${flagLine(f)}`);
const numbers = psql(`select private.watch_input_run() || '|' || private.watch_input_cv() || '|' || private.watch_input_still()
  || '|' || private.watch_input_synthetic() || '|' || private.watch_input_mins();`);
check('the window\'s numbers are the island\'s', numbers
  === [WATCH_INPUT_RUN, WATCH_INPUT_CV, WATCH_INPUT_STILL, WATCH_INPUT_SYNTHETIC, WATCH_INPUT_MINS].join('|'), numbers);

console.log('--- shut');
check('no browser reads the summaries', as(ANNA, 'select count(*) from private.watch_input;').err.includes('permission denied'));
const helpers = [`watch_input_take('${W}', '${ANNA}', '{}')`, `watch_input_int('{}', 'x', 1)`, 'watch_input_run()', 'watch_input_mins()']
  .filter((h) => !as(ANNA, `select private.${h};`).err);
check('or calls the helpers', helpers.length === 0, helpers.join(' '));
check('nobody signed out calls the door', sql(`set role anon;\nselect rpc_input_note('${W}', '{}');`).err.includes('permission denied'));

psql(CLEAN);
for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`input timing on the watch — ${ok.length} of ${ok.length}`);
