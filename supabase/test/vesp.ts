/**
 * A vesp tends the hives, as its trade.
 *
 * Asked: "vesp should work beehives as their trade". A vesp had no trade, so
 * it could not be set to work a deed, and the hives a swarm fills filled only
 * for one kept following you about the settlement. This asks, of both sides:
 *
 *   * a vesp's trade is tending the hives, and it can be set to work a deed;
 *   * set to work, it goes to a hive in reach of the token and works there,
 *     bringing nothing to the crate, and the hive fills while it does;
 *   * with no hive in reach it says so, as any worker with no work does;
 *   * the browser says what it will do in the island's words.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { CREATURE_ACTION_BY_ID } from '../../src/game/creatureActions';
import { deedJobLine } from '../../src/game/creaturecrate';
import { GATHER_DO, SPECIES } from '../../src/game/creatures';

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

/* ---- on the island --------------------------------------------------------------- */

const MIRA = '7e5b0000-0000-4000-8000-0000000000a1';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}'; v_vesp int; v_hive bigint; c creature;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Hives', 170, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  update player set x = 16.5, y = 16.5, body_at = now(), swim_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Hivesend', 16, 16, 8, 3, u);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'hive', 19, 16, 0, 0, 19.25, 16.125, 50, u) returning id into v_hive;
  v_vesp := creature_spawn(w, 'vesp', 16.6, 16.6, 'active', now() - interval '30 days', u);
  update creature set hunger = 1, settled_at = now(), until = now(), leg_at = now(), leg_ends = now(), from_x = to_x, from_y = to_y
    where world_id = w and id = v_vesp;

  insert into said values ('TRADE', (select gathers from species_def where id = 'vesp'));
  insert into said values ('ASK', coalesce(act_refusal(w, u, 'assign_deed', jsonb_build_object('kind', 'creature', 'id', v_vesp)), 'none'));
  perform act_perform(w, u, 'assign_deed', jsonb_build_object('kind', 'creature', 'id', v_vesp));
  select * into c from creature where world_id = w and id = v_vesp;
  insert into said values ('MODE', c.mode);
  insert into said values ('LINE', deed_job_line(c));

  -- A minute of its day: it goes to the hive and works there, carrying nothing home.
  update creature set until = now() - interval '60 seconds', settled_at = now() - interval '60 seconds', phase = 'idle'
    where world_id = w and id = v_vesp;
  perform worker_settle(w, v_vesp);
  select * into c from creature where world_id = w and id = v_vesp;
  insert into said values ('AT', coalesce(c.work_x::text, '-') || ',' || coalesce(c.work_y::text, '-') || '|'
    || round(sqrt((c.to_x - 19.25) ^ 2 + (c.to_y - 16.125) ^ 2)::numeric, 1) || '|' || coalesce(c.carrying::text, 'nothing'));

  -- And the hive fills while it does.
  update placed set state = jsonb_build_object('comb', 0.999, 'hive_at', now() - interval '5 seconds') where id = v_hive;
  perform hive_sweep(w);
  insert into said values ('FILLED', (select coalesce(sum(count), 0) from item where world_id = w and holder = 'furniture' and placed = v_hive)::text);

  -- With no hive in reach, an hour of standing about, and it says so.
  delete from item where world_id = w and placed = v_hive;
  delete from placed where id = v_hive;
  delete from event where world_id = w and uid = u;
  update creature set until = now() - interval '5 seconds', settled_at = now() - interval '5 seconds', phase = 'idle',
         work_x = null, work_y = null, idle_since = now() - interval '2 hours', told_at = null
    where world_id = w and id = v_vesp;
  perform worker_settle(w, v_vesp);
  insert into said select 'IDLE', coalesce(string_agg(text, ' / '), 'nothing') from event where world_id = w and uid = u and kind = 'error';
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

check('on the island, a vesp\'s trade is tending the hives', at('TRADE') === 'hive', at('TRADE'));
check('so it can be set to work the deed', at('ASK') === 'none' && at('MODE') === 'deed', `${at('ASK')} / ${at('MODE')}`);
const [spot, off, carried] = at('AT').split('|');
check('set to work, it goes to the hive and works there', spot === '19,16' && Number(off) < 1.5, at('AT'));
check('carrying nothing home', carried === 'nothing', carried);
check('and the hive fills while it does', Number(at('FILLED')) >= 1, at('FILLED'));
check('with no hive in reach, it says so', at('IDLE').startsWith('Vesp idle: no hive to tend within ') || / idle: no hive to tend within /.test(at('IDLE')), at('IDLE'));

/* ---- in the browser ---------------------------------------------------------------- */

check('in the browser, a vesp\'s trade is tending the hives', SPECIES.vesp.gathers === 'hive' && GATHER_DO.hive === 'tend the hives');
const g = Game.create(4247);
const v = g.creatures.spawn('vesp', g.player.x + 1, g.player.y, 'active', g.rand, g.time - 3600 * 24 * 30);
v.mode = 'deed';
// The reach is each creature's own (its skill and its blood), so the words are compared and not the number.
const words = (s: string): string => s.replace(/\d+/g, 'N');
check('and it says what it will do in the island\'s words, with nothing about the crate',
  words(deedJobLine(v)) === words(at('LINE')) && words(at('LINE')) === 'tend the hives within N tiles of the token', `${deedJobLine(v)} / ${at('LINE')}`);
const assign = CREATURE_ACTION_BY_ID.get('assign_deed');
v.mode = 'active';
const why = assign?.check?.({ kind: 'creature', id: v.id }, g) ?? 'none';
check('it is no longer refused for having no trade', !/no trade/.test(why), why);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na vesp tends the hives — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
