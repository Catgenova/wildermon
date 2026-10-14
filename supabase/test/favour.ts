/**
 * Your favour is the island's, on coming ashore and on every beat.
 *
 * The island kept `player.favour` and never sent it, so a browser coming
 * ashore drew favour from its own save -- nought after a reload -- and it
 * looked as though logging out had spent it. This asks that coming ashore
 * hands the favour over, that every beat says it with what has trickled in
 * since it was settled (capped at what faith holds), and that the browser
 * reads both.
 *
 * Runs against the database the suite leaves behind.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { FAVOUR_TRICKLE } from '../../src/game/faith';

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

const MIRA = 'fa70e000-0000-4000-8000-0000000000a1';
const AGO = 100;

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}';
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Favour', 164, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  insert into skill (world_id, uid, id, value) values (w, u, faith_skill(), 60)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  update player set favour = 40, favour_at = now() - interval '${AGO} seconds' where world_id = w and uid = u;
  insert into said values ('JOIN', (rpc_join(w, null)->'you'->>'favour'));
  update player set favour = 40, favour_at = now() - interval '${AGO} seconds' where world_id = w and uid = u;
  insert into said values ('BEAT', (rpc_settle(p_world => w)->>'favour'));
  insert into said values ('TRICKLE', favour_trickle()::text);
  insert into said values ('CAP', favour_cap(60)::text);
  update player set favour = favour_cap(60) - 0.01, favour_at = now() - interval '1 hour' where world_id = w and uid = u;
  insert into said values ('CAPPED', (rpc_settle(p_world => w)->>'favour'));
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const num = (k: string): number => Number(isle.get(k));

check('coming ashore hands over the favour banked', num('JOIN') >= 40 && num('JOIN') <= 40 + AGO * num('TRICKLE') + 1e-6, isle.get('JOIN') ?? '');
check('the beat says it with what has trickled in since', Math.abs(num('BEAT') - (40 + AGO * num('TRICKLE'))) < 0.05, `${isle.get('BEAT')} against ${40 + AGO * num('TRICKLE')}`);
check('never past what faith holds', Math.abs(num('CAPPED') - num('CAP')) < 1e-6, `${isle.get('CAPPED')} / ${isle.get('CAP')}`);
check('the browser trickles at the island\'s rate between beats', Math.abs(FAVOUR_TRICKLE - num('TRICKLE')) < 1e-9, `${FAVOUR_TRICKLE} / ${isle.get('TRICKLE')}`);

const play = readFileSync('src/net/play.ts', 'utf8');
check('the browser reads it coming ashore', play.includes('if (typeof me.favour === \'number\') game.player.favour = me.favour;'));
check('and on every beat', play.includes('if (typeof what.favour === \'number\') game.player.favour = what.favour;'));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nyour favour is the island's — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
