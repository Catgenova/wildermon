/**
 * Talk kept apart, and kept longer.
 *
 * Reported: "the total logged messages of any kind reaches a limit and it
 * empties out the Talk tab." The browser kept one list of every line, so a
 * worker's run of work lines pushed the last thing anybody said out of it,
 * and the island kept chat a day and handed back sixty lines of it.
 *
 *   * the browser keeps `TALK_LOG` lines of talk however many lines of
 *     anything else come after them, and still lets go of the oldest of
 *     each past its own count;
 *   * the island keeps a line said aloud `chat_keep` (three of `event_keep`'s
 *     days), and lets go of every other line, and of talk past that, as
 *     before;
 *   * and hands back as many lines on arriving as the browser keeps.
 *
 * Runs against the database the suite leaves behind, in a transaction it
 * rolls back: Hoarding.
 */
import { execFileSync } from 'node:child_process';
import { CHAT_KEEP_DAYS, EVENT_KEEP_DAYS, isTalk, TALK_LOG, type LogEntry, type LogKind } from '../../src/game/events';
import { trimLog } from '../../src/game/game';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
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

/* ---- the browser ---- */
const log: LogEntry[] = [];
let clock = 0;
const add = (kind: LogKind, text: string): void => {
  log.push({ time: clock++, text, kind });
  trimLog(log);
};
for (let i = 0; i < 20; i++) add('chat', `said ${i}`);
for (let i = 0; i < 1000; i++) add(i % 2 ? 'wildermon' : 'event', `worked ${i}`);
const talk = log.filter((e) => isTalk(e.kind));
check('twenty lines said, then a thousand lines of work: all twenty still in the Talk tab',
  talk.length === 20 && talk[0].text === 'said 0', `${talk.length} lines of talk kept, ${log.length - talk.length} of the rest`);
for (let i = 20; i < TALK_LOG + 50; i++) add(i % 5 ? 'chat' : 'system', `said ${i}`);
const talk2 = log.filter((e) => isTalk(e.kind));
check('and past its own count, the oldest talk is let go of, never the newest',
  talk2.length === TALK_LOG && talk2[talk2.length - 1].text === `said ${TALK_LOG + 49}` && talk2[0].text === 'said 50',
  `${talk2.length} kept, first "${talk2[0]?.text}", last "${talk2[talk2.length - 1]?.text}"`);
check('and the rest keep their own count, in order',
  log.filter((e) => !isTalk(e.kind)).length === 400 && log.every((e, i) => i === 0 || e.time > log[i - 1].time),
  `${log.filter((e) => !isTalk(e.kind)).length} of the rest kept`);

/* ---- the island ---- */
const out = psql(`
begin;
create temp table said (k text, v text) on commit drop;
do $$
declare w uuid; u uuid;
begin
  select id into w from world where name = 'Hoarding';
  select uid into u from player where world_id = w limit 1;
  delete from event where world_id = w;
  insert into event (world_id, uid, text, kind, at) values
    (w, null, 'said two days ago', 'chat', now() - interval '48 hours'),
    (w, null, 'said four days ago', 'chat', now() - interval '96 hours'),
    (w, u, 'worked two days ago', 'event', now() - interval '48 hours'),
    (w, u, 'told two days ago', 'chat', now() - interval '48 hours'),
    (w, null, 'said just now', 'chat', now());
  perform prune_events(w);
  insert into said select 'left', string_agg(text, '|' order by text) from event where world_id = w;
  insert into said values ('keep', (chat_keep() / 86400)::text), ('days', (event_keep() / 86400)::text), ('lines', chat_lines()::text);
  insert into said values ('capped', (pg_get_functiondef('rpc_chat'::regproc) like '%chat_lines()%')::text);
end $$;
select string_agg(k || '=' || coalesce(v, 'null'), E'\\n' order by k) from said;
rollback;`);
const said = (k: string): string => out.split('\n').find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1) ?? 'unsaid';

check('on the island, a line said aloud two days ago is kept, and one said four days ago is not',
  said('left').split('|').includes('said two days ago') && !said('left').includes('said four days ago'), said('left'));
check('and every other line two days old is let go of as before, a line to one body included',
  !said('left').includes('worked two days ago') && !said('left').includes('told two days ago'), said('left'));
check('talk is kept as many days on the island as the browser says, and every other line too',
  said('keep') === String(CHAT_KEEP_DAYS) && said('days') === String(EVENT_KEEP_DAYS),
  `island ${said('keep')} and ${said('days')} days, browser ${CHAT_KEEP_DAYS} and ${EVENT_KEEP_DAYS}`);
check('and as many lines are handed back on arriving as the browser keeps',
  said('lines') === String(TALK_LOG) && said('capped') === 'true', `island ${said('lines')}, browser ${TALK_LOG}`);

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`talk kept apart and kept longer — ${ok.length} of ${ok.length}`);
