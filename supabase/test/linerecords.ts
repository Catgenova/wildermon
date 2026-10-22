/**
 * Bred records: per island, per kind, the best ever bred.
 *
 * Asked for: "per island, per kind, the best ever bred: highest of each base
 * stat at birth and the most traits / highest tier total, with the
 * wildermon's name, its breeder and the date. Kept when the wildermon dies or
 * is released. Updated at birth on the island (one cheap upsert)." Tested:
 * "records update only on a better birth, survive death, read back the same
 * on both sides."
 *
 * Asked of the island, a pair bred a dozen times over:
 *
 *   * that every young one's figures are the browser's: each base stat as
 *     `bloodMul` reads it at birth, and its trait total as `bredScore` does;
 *   * that after each birth the records are the best so far, stat by stat, a
 *     tie going to the first, with its name, its breeder and its birth;
 *   * that a worse young one changes nothing, a tie keeps the first, and a
 *     better one takes the stat it beats and no other;
 *   * that a record holder put down and another let go leave every record
 *     where it stood;
 *   * that `rpc_bred_records` and the boards' `records` hand out the same, the
 *     breeder named, yours marked yours and nobody else's; that nobody signed
 *     out or off the island is answered; and that the words a page prints for a
 *     record are its figures;
 *   * and what a birth's upsert costs.
 *
 * Runs against the database the suite leaves behind, in one transaction that is
 * rolled back.
 */
import { execFileSync } from 'node:child_process';
// `game` first: the root of the module graph, so nothing below comes out half-built.
import '../../src/game/game';
import { bloodMul, type Creature } from '../../src/game/creatures';
import { bredScore, dayOf, RECORD_STATS, recordFigure, recordSaid, type BredRecord, type RecordStat } from '../../src/game/boards';
import { BOARD_RULES } from '../../src/ui/panels/boards';
import type { Line, TraitChannel } from '../../src/game/traits';

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

const arr = (xs: string[]): string => `array[${xs.map((x) => `'${x}'`).join(',')}]::text[]`;
const U = '7e5b0000-0000-4000-8000-0000000000d1';
const U2 = '7e5b0000-0000-4000-8000-0000000000d2';
const U3 = '7e5b0000-0000-4000-8000-0000000000d3';
const BIRTHS = 12;
const SIRE = ['swift', 'fanged_rare', 'thick_hided'];
const DAM = ['willing', 'fleet', 'horned_supreme'];
/** Fantastic fighting blood on health and damage, for a young one that beats every trait total there is. */
const BEST = ['big_boned_fantastic', 'heavy_pawed_fantastic', 'stout_fantastic'];
const COST_GOES = 200;
/** What a birth's note may cost, at most, on a busy runner: it is one statement, made once a birth. */
const NOTE_MS = 5;

/** A young one as the island writes it down. */
interface Young { id: number; name: string; species: string; traits: string[]; rare: number; line: Line | null; born: number }
interface Row { species: string; stat: RecordStat; value: number; id: number; name: string; breeder: string | null; at: number }

const youngSql = (id: string): string => `(select jsonb_build_object('id', c.id, 'name', c.name, 'species', c.species, 'traits', to_jsonb(c.traits),
  'rare', coalesce(rarity_step(c.rare), 0), 'line', c.pedigree->'line', 'born', floor(extract(epoch from c.born) * 1000)) from creature c where c.world_id = w and c.id = ${id})::text`;
const recordsSql = `(select coalesce(jsonb_agg(jsonb_build_object('species', r.species, 'stat', r.stat, 'value', r.value, 'id', r.creature_id, 'name', r.name,
  'breeder', r.breeder, 'at', floor(extract(epoch from r.born_at) * 1000)) order by r.species, r.stat), '[]') from bred_record r where r.world_id = w)::text`;
const figuresSql = (id: string): string => `(select jsonb_object_agg(f.stat, f.value) from creature c cross join lateral record_figures(c) f
  where c.world_id = w and c.id = ${id})::text`;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; u2 uuid := '${U2}'; px double precision; py double precision; v_dam int; v_sire int; v_young int;
  v_x int; v_t0 timestamptz; v_err text;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Records', 255, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u2)::text, true);
  perform rpc_join(w, 'Onlooker');
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Breeder');
  select x, y into px, py from player where world_id = w and uid = u;
  insert into said values ('EMPTY', ${recordsSql});

  v_dam := creature_spawn(w, 'rabba', px + 0.5, py, 'deed', now() - interval '3 hours', u);
  v_sire := creature_spawn(w, 'rabba', px - 0.5, py, 'deed', now() - interval '3 hours', u);
  update creature set sex = 'female', name = 'Snow', traits = ${arr(DAM)}, hunger = 1 where world_id = w and id = v_dam;
  update creature set sex = 'male', name = 'Horn', traits = ${arr(SIRE)}, hunger = 1 where world_id = w and id = v_sire;
  for i in 1..${BIRTHS} loop
    perform pair_them(w, v_dam, v_sire, 100, u);
    update creature set due = now() - interval '1 second' where world_id = w and id = v_dam;
    v_young := give_birth(w, v_dam);
    insert into said values ('YOUNG:' || i, ${youngSql('v_young')});
    insert into said values ('FIG:' || i, ${figuresSql('v_young')});
    insert into said values ('SNAP:' || i, ${recordsSql});
  end loop;

  -- A worse one, a tie and a better one, put to the records as a birth puts them.
  v_x := creature_spawn(w, 'rabba', px, py + 1, 'deed', now(), u);
  update creature set name = 'Plain', traits = '{}', rare = null, pedigree = null where world_id = w and id = v_x;
  perform bred_record_note(w, v_x, u);
  insert into said values ('WORSE', ${recordsSql});
  update creature set name = 'Twin', rare = null, pedigree = null,
    traits = (select c.traits from creature c where c.world_id = w and c.id = (select r.creature_id from bred_record r where r.world_id = w and r.stat = 'traits'))
   where world_id = w and id = v_x;
  insert into said values ('TIEFIG', ${figuresSql('v_x')});
  perform bred_record_note(w, v_x, u);
  insert into said values ('TIE', ${recordsSql});
  update creature set name = 'Best', traits = ${arr(BEST)}, rare = null, pedigree = null where world_id = w and id = v_x;
  insert into said values ('BEST', ${youngSql('v_x')});
  perform bred_record_note(w, v_x, u2);
  insert into said values ('BETTER', ${recordsSql});
  delete from creature where world_id = w and id = v_x;

  -- One holder put down, one let go: the records stand.
  delete from creature where world_id = w and id = (select r.creature_id from bred_record r where r.world_id = w and r.stat = 'work');
  insert into said values ('GONE', (select count(*) from creature c join bred_record r on r.world_id = c.world_id and r.creature_id = c.id where c.world_id = w and r.stat = 'work'));
  update creature set mode = 'wild', keeper = null where world_id = w and id = (select r.creature_id from bred_record r where r.world_id = w and r.stat = 'speed');
  insert into said values ('AFTER', ${recordsSql});

  -- Read through the doors.
  insert into said values ('RPC', rpc_bred_records(w)::text);
  insert into said values ('BOARDS', (rpc_boards(w)->'records')::text);
  perform set_config('request.jwt.claims', json_build_object('sub', u2)::text, true);
  insert into said values ('RPC2', rpc_bred_records(w)::text);
  perform set_config('request.jwt.claims', json_build_object('sub', '${U3}')::text, true);
  begin
    perform rpc_bred_records(w);
    insert into said values ('OFF', 'answered');
  exception when others then
    get stacked diagnostics v_err = message_text;
    insert into said values ('OFF', v_err);
  end;
  perform set_config('request.jwt.claims', '', true);
  begin
    perform rpc_bred_records(w);
    insert into said values ('OUT', 'answered');
  exception when others then
    get stacked diagnostics v_err = message_text;
    insert into said values ('OUT', v_err);
  end;

  -- What a birth's note costs, against records it does not beat.
  v_t0 := clock_timestamp();
  for i in 1..${COST_GOES} loop perform bred_record_note(w, v_young, u); end loop;
  insert into said values ('COST', extract(epoch from clock_timestamp() - v_t0) * 1000 / ${COST_GOES});
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const got = <T>(k: string): T => JSON.parse(isle.get(k) ?? 'null') as T;

/** A young one's figures as the browser reads them, at birth: no stage, no pot. */
const figures = (y: Young): Record<RecordStat, number> => {
  const c = { species: y.species, skills: {}, traits: y.traits, rare: y.rare, pedigree: y.line ? { line: y.line } : null, boosts: undefined } as unknown as Creature;
  return Object.fromEntries(RECORD_STATS.map((s) => [s.id, s.id === 'traits' ? bredScore(y.traits) : bloodMul(c, s.id as TraitChannel)])) as Record<RecordStat, number>;
};
/** The island keeps a trait's figure as a single float: alike to a millionth. */
const close = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6;
const key = (rows: Row[]): string => JSON.stringify(rows.map((r) => [r.species, r.stat, Math.round(r.value * 1e6), r.id, r.name, r.breeder, r.at]));

console.log('--- the island');
check('no records on a new island', JSON.stringify(got('EMPTY')) === '[]', isle.get('EMPTY'));
const young: Young[] = [];
const best = new Map<RecordStat, { value: number; y: Young }>();
let held = 0;
let figsOk = true;
let snapsOk = true;
let detail = '';
for (let i = 1; i <= BIRTHS; i++) {
  const y = got<Young>(`YOUNG:${i}`);
  young.push(y);
  const mine = figures(y);
  const theirs = got<Record<string, number>>(`FIG:${i}`);
  for (const s of RECORD_STATS) {
    if (!close(mine[s.id], theirs[s.id])) {
      figsOk = false;
      detail ||= `${y.name} ${s.id} ${mine[s.id]} / ${theirs[s.id]}`;
    }
    const was = best.get(s.id);
    if (!was || theirs[s.id] > was.value) best.set(s.id, { value: theirs[s.id], y });
    else if (i > 1) held++;
  }
  const want: Row[] = RECORD_STATS.map((s) => ({ species: 'rabba', stat: s.id, value: best.get(s.id)!.value, id: best.get(s.id)!.y.id, name: best.get(s.id)!.y.name, breeder: U, at: best.get(s.id)!.y.born }))
    .sort((a, b) => a.stat.localeCompare(b.stat));
  if (key(got<Row[]>(`SNAP:${i}`)) !== key(want)) {
    snapsOk = false;
    detail ||= `after ${i}: ${isle.get(`SNAP:${i}`)} // ${JSON.stringify(want)}`;
  }
}
check(`every one of ${BIRTHS} young ones' figures are the browser's: ${RECORD_STATS.map((s) => s.name.toLowerCase()).join(', ')}`, figsOk && young.length === BIRTHS, detail);
check(`after each of ${BIRTHS} births the records are the best so far, stat by stat, the first to reach it, with its name, breeder and birth`,
  snapsOk, detail);
check('and some births beat nothing: the records changed only on a better birth', held > 0, `${held} stats held`);
const last = got<Row[]>(`SNAP:${BIRTHS}`);
check('a worse young one changes nothing', key(got<Row[]>('WORSE')) === key(last));
{
  const tieFig = got<Record<string, number>>('TIEFIG');
  const tie = got<Row[]>('TIE');
  check('a tie keeps the first', key(tie) === key(last) && close(tieFig.traits, last.find((r) => r.stat === 'traits')!.value), `${tieFig.traits}`);
  const b = got<Young>('BEST');
  const bf = figures(b);
  const better = got<Row[]>('BETTER');
  const wantBetter = last.map((r) => (bf[r.stat] > r.value + 1e-6 ? { ...r, value: bf[r.stat], id: b.id, name: 'Best', breeder: U2, at: b.born } : r));
  check('a better one takes each stat it beats, under its breeder, and leaves the rest',
    key(better) === key(wantBetter) && better.find((r) => r.stat === 'traits')?.name === 'Best' && better.some((r) => r.name !== 'Best'),
    `${isle.get('BETTER')}`);
  check('a record holder put down and another let go leave every record standing', key(got<Row[]>('AFTER')) === key(better) && isle.get('GONE') === '0',
    `${isle.get('AFTER')} (${isle.get('GONE')} left)`);
}

console.log('--- read back');
{
  const after = got<Row[]>('AFTER');
  const rpc = got<BredRecord[]>('RPC');
  const rpc2 = got<BredRecord[]>('RPC2');
  const name = (uid: string | null): string => (uid === U ? 'Breeder' : uid === U2 ? 'Onlooker' : 'somebody');
  const same = (rows: BredRecord[], me: string): boolean => rows.length === after.length && rows.every((r, i) => {
    const a = after[i];
    return r.species === a.species && r.stat === a.stat && close(r.value, a.value) && r.name === a.name && r.breeder === name(a.breeder) && r.at === a.at
      && r.mine === (a.breeder === me);
  });
  check('rpc_bred_records hands out every record, its breeder named, yours marked yours', same(rpc, U) && rpc.some((r) => r.mine) && rpc.some((r) => !r.mine),
    isle.get('RPC'));
  check('and to somebody else the same, theirs marked theirs', same(rpc2, U2) && rpc2.filter((r) => r.mine).length === rpc.filter((r) => !r.mine).length, isle.get('RPC2'));
  check('the boards carry the same records', isle.get('BOARDS') === isle.get('RPC'));
  check('nobody off the island is answered', isle.get('OFF') === 'you are not on this island', isle.get('OFF'));
  check('nobody signed out is answered', isle.get('OUT') === 'not signed in', isle.get('OUT'));
  const hardy = rpc.find((r) => r.stat === 'hardy')!;
  const traits = rpc.find((r) => r.stat === 'traits')!;
  check('a page says a record by its figures', recordSaid(hardy) === `Record: Health ${recordFigure('hardy', hardy.value)} (${hardy.name}, ${hardy.breeder}, ${dayOf(hardy.at)})`
    && recordSaid(traits) === `Record: Trait total ${bredScore(BEST)} (Best, Onlooker, ${dayOf(traits.at)})`, `${recordSaid(hardy)} | ${recordSaid(traits)}`);
  check('the board names what it keeps', RECORD_STATS.every((s) => BOARD_RULES.records.includes(s.name.toLowerCase())), BOARD_RULES.records);
}
{
  const ms = Number(isle.get('COST'));
  console.log(`   a birth's note: ${ms.toFixed(3)} ms`);
  check(`a birth's note is one statement, under ${NOTE_MS} ms`, ms < NOTE_MS, `${ms} ms`);
}

for (const l of [...ok, ...bad]) console.log(l);
console.log(`\nbred records — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
