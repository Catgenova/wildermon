/**
 * A queue put in order.
 *
 * Both sides off the same names (`src/game/jobqueue.ts` and
 * `a_queue_put_in_order.sql`). What this asks:
 *
 *   * the jobs waiting go into the order asked, and the job in hand stays
 *     where it is, in hand, on both sides;
 *   * a place left out of the order is a job put out of mind, said in the same
 *     words on both sides, for one and for more;
 *   * a list that changed since it was seen is refused, and so is an order
 *     that is not one (a place twice, a place past the end), in the same words
 *     on both sides, and nothing moves;
 *   * a job put down by a walk is no longer in hand and moves like any other;
 *   * the island answers with the list as it now is, in `rpc_act`'s shape.
 *
 * Runs against the database the suite leaves behind.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID } from '../../src/game/actions';
import { Game } from '../../src/game/game';
import { dropOrder, moveOrder, QUEUE_MOVED, QUEUE_NO_ORDER, queueDropped, seenOf, type SeenJob } from '../../src/game/jobqueue';

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
const label = (id: string): string => {
  const def = ACTION_BY_ID.get(id);
  if (!def) throw new Error(`no ${id}`);
  return def.label;
};

/** In hand, and the three behind it, as both sides start. */
const IN_HAND = 'make_planks';
const WAITING: SeenJob[] = [
  { action: 'make_shafts', goes: 2 },
  { action: 'make_log_crate', goes: 1 },
  { action: 'make_mallet', goes: 3 },
];
const ids = (q: readonly SeenJob[]): string => q.map((j) => `${j.action}x${j.goes}`).join(',');

/* ---- The browser's half ----------------------------------------------- */

const g = Game.create(4242);
g.skills.values.set('mind_logic', 60);
g.player.stats.stamina = 1;
const log = g.inventory.add('log', { count: 20, extra: 'Pine' });
const asked = (id: string, goes: number): void => g.requestAction(ACTION_BY_ID.get(id)!, { kind: 'item', uid: log.uid }, goes);
asked(IN_HAND, 3);
for (const j of WAITING) asked(j.action, j.goes);
const hand = g.action;
const last = (): string => g.log[g.log.length - 1]?.text ?? '';
check('the browser lines up three behind the job in hand', hand?.def.id === IN_HAND && ids(seenOf(g.queue)) === ids(WAITING), ids(seenOf(g.queue)));

let seen = seenOf(g.queue);
let why = g.putQueueInOrder(seen, [2, 0, 1]);
const moved = [WAITING[2], WAITING[0], WAITING[1]];
check('browser: the jobs waiting go into the order asked', why === null && ids(seenOf(g.queue)) === ids(moved), ids(seenOf(g.queue)));
check('browser: the job in hand is the same job, still in hand, with the same goes', g.action === hand && g.action?.def.id === IN_HAND && g.action?.left === 3);

why = g.putQueueInOrder(seen, [0, 1, 2]);
check('browser: a list seen before it changed is refused in the island\'s words', why === QUEUE_MOVED && last() === QUEUE_MOVED, `${why} / ${last()}`);
check('browser: and nothing moves', ids(seenOf(g.queue)) === ids(moved));

seen = seenOf(g.queue);
for (const order of [[0, 0, 1], [0, 1, 3], [-1], [0.5]]) {
  why = g.putQueueInOrder(seen, order);
  check(`browser: ${JSON.stringify(order)} is no order, in the island's words, and nothing moves`, why === QUEUE_NO_ORDER && ids(seenOf(g.queue)) === ids(moved), String(why));
}

why = g.putQueueInOrder(seen, [0, 2]);
check('browser: a place left out is a job put out of mind', why === null && ids(seenOf(g.queue)) === ids([moved[0], moved[2]]), ids(seenOf(g.queue)));
check('browser: and it is said', last() === queueDropped([label(moved[1].action)]), last());
const browserDropOne = last();

// Walked off: the job in hand goes to the front of the list, and is no longer in hand.
g.pauseAction();
seen = seenOf(g.queue);
check('browser: a walk puts the job in hand at the front of the list', !g.action && seen[0]?.action === IN_HAND, ids(seen));
why = g.putQueueInOrder(seen, moveOrder(seen.length, 0, seen.length - 1));
check('browser: and a job put down moves like any other', why === null && seenOf(g.queue)[seen.length - 1]?.action === IN_HAND, ids(seenOf(g.queue)));

seen = seenOf(g.queue);
why = g.putQueueInOrder(seen, []);
check('browser: an empty order puts the lot out of mind', why === null && g.queue.length === 0 && !g.held, String(g.queue.length));
check('browser: and says how many', last() === queueDropped(seen.map((j) => label(j.action))), last());
const browserDropMany = last();

check('moveOrder and dropOrder', JSON.stringify(moveOrder(4, 3, 0)) === '[3,0,1,2]' && JSON.stringify(moveOrder(4, 0, 2)) === '[1,2,0,3]'
  && JSON.stringify(dropOrder(3, 1)) === '[0,2]');

/* ---- The island's half, in one go -------------------------------------- */

const lit = (s: string): string => `'${s.replace(/'/g, "''")}'`;
const queueJson = JSON.stringify(WAITING.map((j) => ({ ...j, target: { kind: 'item', id: 1 } })));
const asSeen = (q: readonly SeenJob[]): string => lit(JSON.stringify(q));

const out = psql(`
begin;
create temp table said (k text, v text);
do $b$
declare w record; r jsonb;
begin
  -- The largest island with land, and somebody stood on it at its spawn: what the suite leaves behind can be anywhere,
  -- off the edge of a sixteen-tile island included, and a settle there faults before it reaches the queue.
  select p.world_id, p.uid, wd.spawn_x, wd.spawn_y into w from player p join world wd on wd.id = p.world_id
   where exists (select 1 from land_tile lt where lt.world_id = wd.id)
   order by wd.size desc, p.world_id, p.uid limit 1;
  update player set x = w.spawn_x + 0.5, y = w.spawn_y + 0.5, level = 0, aboard = null, away = false
    where world_id = w.world_id and uid = w.uid;
  update player set act = ${lit(IN_HAND)}, act_target = '{"kind":"item","id":1}'::jsonb, act_started = now(),
         act_ends = now() + interval '1 hour', act_left = 3, act_goes = 3,
         act_queue = ${lit(queueJson)}::jsonb
    where world_id = w.world_id and uid = w.uid;
  perform set_config('request.jwt.claims', json_build_object('sub', w.uid)::text, false);

  r := rpc_queue_order(w.world_id, ${asSeen(WAITING)}::jsonb, '{2,0,1}');
  insert into said values ('MOVED', (r->>'ordered') || '|' || (r->'queue')::text);
  insert into said select 'HAND', act || '|' || act_left || '|' || (act_ends > now() + interval '50 minutes')::text
    from player where world_id = w.world_id and uid = w.uid;
  insert into said select 'KEPT', (act_queue->0->'target')::text from player where world_id = w.world_id and uid = w.uid;

  r := rpc_queue_order(w.world_id, ${asSeen(WAITING)}::jsonb, '{0,1,2}');
  insert into said values ('STALE', coalesce(r->>'why', '') || '|' || (r->'queue')::text);
  insert into said select 'STALE_SAID', text from event where world_id = w.world_id and uid = w.uid order by n desc limit 1;

  r := rpc_queue_order(w.world_id, ${asSeen(moved)}::jsonb, '{0,0,1}');
  insert into said values ('TWICE', coalesce(r->>'why', '') || '|' || (r->'queue')::text);
  r := rpc_queue_order(w.world_id, ${asSeen(moved)}::jsonb, '{0,1,3}');
  insert into said values ('PAST', coalesce(r->>'why', '') || '|' || (r->'queue')::text);
  r := rpc_queue_order(w.world_id, ${asSeen(moved)}::jsonb, '{-1}');
  insert into said values ('BELOW', coalesce(r->>'why', '') || '|' || (r->'queue')::text);

  r := rpc_queue_order(w.world_id, ${asSeen(moved)}::jsonb, '{0,2}');
  insert into said values ('DROP', (r->>'ordered') || '|' || (r->'queue')::text);
  insert into said select 'DROP_SAID', text from event where world_id = w.world_id and uid = w.uid order by n desc limit 1;

  -- A walk: the job in hand to the front of the list, as \`rpc_hold\` puts it.
  perform rpc_hold(w.world_id);
  insert into said select 'HELD', coalesce(act, '') || '|' || (act_queue->0->>'action') from player where world_id = w.world_id and uid = w.uid;
  r := rpc_queue_order(w.world_id, (select jsonb_agg(jsonb_build_object('action', q->>'action', 'goes', (q->>'goes')::int) order by o)
                                      from player, jsonb_array_elements(act_queue) with ordinality t(q, o)
                                     where world_id = w.world_id and uid = w.uid), '{1,2,0}');
  insert into said values ('HELD_MOVED', (r->>'ordered') || '|' || (r->'queue')::text);

  r := rpc_queue_order(w.world_id, r->'queue', '{}');
  insert into said values ('EMPTY', (r->>'ordered') || '|' || (r->'queue')::text);
  insert into said select 'EMPTY_SAID', text from event where world_id = w.world_id and uid = w.uid order by n desc limit 1;
end $b$;
select k || '=' || v from said;
rollback;
`);

const island = new Map(out.split('\n').map((l) => {
  const at = l.indexOf('=');
  return [l.slice(0, at), l.slice(at + 1)] as [string, string];
}));
const listOf = (v: string | undefined): string => {
  const json = (v ?? '').split('|').slice(1).join('|');
  try {
    return ids((JSON.parse(json) as SeenJob[]));
  } catch {
    return `unreadable: ${json}`;
  }
};
const [movedOk] = (island.get('MOVED') ?? '').split('|');
check('island: the jobs waiting go into the order asked', movedOk === 'true' && listOf(island.get('MOVED')) === ids(moved), island.get('MOVED'));
check('island: the job in hand is the same job, still in hand, with the same goes and the same end', island.get('HAND') === `${IN_HAND}|3|true`, island.get('HAND'));
check('island: a job moved keeps what it was aimed at', island.get('KEPT') === '{"id": 1, "kind": "item"}', island.get('KEPT'));
check('island: a list seen before it changed is refused in the browser\'s words',
  (island.get('STALE') ?? '').startsWith(`${QUEUE_MOVED}|`) && island.get('STALE_SAID') === QUEUE_MOVED, island.get('STALE'));
check('island: and it says the list as it is, so the browser\'s goes back to it', listOf(island.get('STALE')) === ids(moved), island.get('STALE'));
for (const k of ['TWICE', 'PAST', 'BELOW']) {
  check(`island: ${k.toLowerCase()} is no order, in the browser's words, and nothing moves`,
    (island.get(k) ?? '').startsWith(`${QUEUE_NO_ORDER}|`) && listOf(island.get(k)) === ids(moved), island.get(k));
}
check('island: a place left out is a job put out of mind', listOf(island.get('DROP')) === ids([moved[0], moved[2]]), island.get('DROP'));
check('island: and it is said in the browser\'s words', island.get('DROP_SAID') === browserDropOne, `${island.get('DROP_SAID')} / ${browserDropOne}`);
check('island: a walk puts the job in hand at the front of the list', island.get('HELD') === `|${IN_HAND}`, island.get('HELD'));
check('island: and a job put down moves like any other', listOf(island.get('HELD_MOVED')) === ids([moved[0], moved[2], { action: IN_HAND, goes: 3 }])
  && (island.get('HELD_MOVED') ?? '').startsWith('true|'), island.get('HELD_MOVED'));
check('island: an empty order puts the lot out of mind', listOf(island.get('EMPTY')) === '', island.get('EMPTY'));
check('island: and says how many, in the browser\'s words', island.get('EMPTY_SAID') === queueDropped(['a', 'b', 'c']) && browserDropMany === queueDropped(['a', 'b', 'c']),
  `${island.get('EMPTY_SAID')} / ${browserDropMany}`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
if (bad.length) process.exit(1);
