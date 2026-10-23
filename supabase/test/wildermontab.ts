/**
 * A Wildermon tab in the log, and a line there for each worker's finished work.
 *
 * Asked for: "Add a wildermon event tab and put everything there instead of Talk. Add wildermon deed actions to this
 * tab". Asks:
 *
 *   * the log has a Wildermon tab keeping kind `wildermon`, and no other tab but All keeps it;
 *   * the browser says its own wildermon lines (a tame, into a crate and out) as `wildermon`;
 *   * on the island (rolled back), a tame, a wildermon into its crate and out, a worker putting a load away, an
 *     evolution and a birth each tell the keeper as `wildermon`, and a refusal stays `error`;
 *   * a load put away tells the keeper what was stored, in the browser's words (`work_done_line`, `workDoneLine`), and
 *     the two agree for any work done;
 *   * no line in the functions that are about wildermon alone is said by plain `tell` any more.
 *
 * Runs against the database the suite leaves behind (Dane on Hoarding).
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import type { Creature } from '../../src/game/creatures';
import { CREATURE_CRATE } from '../../src/game/creaturecrate';
import { TABS } from '../../src/ui/panels/eventlog';
import { workDoneLine, type WorkDone } from '../../src/game/workerlog';

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
const j = (v: unknown): string => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;

/* ---- the tab --------------------------------------------------------------- */

const tab = TABS.find((t) => t.id === 'wildermon');
check('the log has a Wildermon tab keeping kind wildermon', tab?.label === 'Wildermon' && JSON.stringify(tab.kinds) === '["wildermon"]',
  JSON.stringify(tab));
const keepers = TABS.filter((t) => !t.kinds || t.kinds.includes('wildermon')).map((t) => t.label);
check('and only it and All keep it', keepers.join(',') === 'All,Wildermon', keepers.join(','));
const talk = TABS.find((t) => t.label === 'Talk');
check('Talk keeps chat and system lines still', JSON.stringify(talk?.kinds) === '["chat","system"]', JSON.stringify(talk?.kinds));

/* ---- the browser ----------------------------------------------------------- */

const game = Game.create(4242);
game.rand = () => 0;
game.skills.values.set('taming', 90);
for (const c of [...game.creatures.list.values()]) if (c.mode !== 'wild') c.mode = 'wild';
game.inventory.add('potato', { count: 40, ql: 30 });
const act = (id: string) => ACTION_BY_ID.get(id)!;
const at = (c: Creature): Target => ({ kind: 'creature', id: c.id });
const last = (): { text: string; kind: string } => game.log[game.log.length - 1] ?? { text: '', kind: '' };
const first = game.creatures.spawn('rabba', game.player.x + 0.3, game.player.y, 'wild', game.rand, 0);
act('tame').perform(at(first), game);
const tamed = game.log.find((e) => e.text.startsWith('Tamed: '));
check('a tame in the browser is a wildermon line', tamed?.kind === 'wildermon', `${tamed?.kind}: ${tamed?.text}`);
const crate = game.inventory.add(CREATURE_CRATE, { ql: 30 });
act('crate_creature').perform(at(first), game);
check('and into a crate', last().kind === 'wildermon' && first.mode === 'stored', `${last().kind}: ${last().text}`);
act('crate_follow').perform({ kind: 'item', uid: crate.uid } as Target, game);
check('and out of it', last().kind === 'wildermon' && first.mode === 'active', `${last().kind}: ${last().text}`);

/* ---- the island ------------------------------------------------------------ */

const DONE: WorkDone[] = [
  { stored: { log: 12 } },
  { stored: { stone: 3, log: 1, honey: 2 }, handled: { brick: 4 } },
  { handled: { wax: 1, log: 2 } },
  { stored: { onion_seeds: 1, acorn: 2, seed_potato: 1 } },
  {},
];
const WHOLE = ['perform_creature', 'perform_crate_open', 'post_release', 'worker_settle', 'worker_nowhere', 'worker_learn_paced',
  'worker_idle', 'companion_settle', 'read_ground', 'gear_wear', 'perform_gear', 'gear_off', 'milk_go', 'pair_them', 'drop_young',
  'perform_artifact'];

const out = psql(`
begin;
create temp table said (k text, v text);
do $b$
declare w uuid; me uuid; v_x double precision; v_y double precision; v_first int; v_second int; v_crate bigint;
        v_tries int; v_n bigint; v_worker int; v_dam int; r record; c creature;
begin
  select id into w from world where name = 'Hoarding';
  select uid into me from player where world_id = w and name = 'Dane';
  perform set_config('request.jwt.claims', json_build_object('sub', me)::text, true);
  update player set act = null, act_queue = '[]'::jsonb where world_id = w and uid = me;
  select x, y into v_x, v_y from player where world_id = w and uid = me;
  update creature set mode = 'wild', keeper = null where world_id = w and keeper = me and mode in ('active', 'stored', 'deed');
  delete from item where world_id = w and holder = 'player' and holder_uid = me and def = 'creature_crate';
  update deed set level = 5 where world_id = w and founded_by = me;
  perform give(w, me, 'potato', 80, 30);
  insert into skill (world_id, uid, id, value) values (w, me, 'taming', 90)
    on conflict (world_id, uid, id) do update set value = 90;
  select coalesce(max(n), 0) into v_n from event where world_id = w;

  -- A tame.
  v_first := creature_spawn(w, 'rabba', v_x + 0.3, v_y, 'wild', now() - interval '3 hours');
  v_second := creature_spawn(w, 'rabba', v_x - 0.3, v_y, 'wild', now() - interval '3 hours');
  for v_tries in 1..60 loop
    exit when (select mode from creature where world_id = w and id = v_first) <> 'wild';
    perform act_perform(w, me, 'tame', jsonb_build_object('kind', 'creature', 'id', v_first));
  end loop;
  insert into said select 'TAME', kind || '|' || text from event where world_id = w and uid = me and n > v_n and text like 'Tamed: %'
    order by n desc limit 1;
  -- The next refused for want of a crate, in Trouble.
  select coalesce(max(n), 0) into v_n from event where world_id = w;
  perform perform_creature(w, me, 'tame', jsonb_build_object('kind', 'creature', 'id', v_second));
  insert into said select 'REFUSED', kind || '|' || text from event where world_id = w and uid = me and n > v_n order by n desc limit 1;

  -- Into a crate, and out of it to work the settlement.
  v_crate := give(w, me, 'creature_crate', 1, 30);
  select coalesce(max(n), 0) into v_n from event where world_id = w;
  perform act_perform(w, me, 'crate_creature', jsonb_build_object('kind', 'creature', 'id', v_first));
  insert into said select 'CRATED', kind || '|' || text from event where world_id = w and uid = me and n > v_n order by n desc limit 1;
  select coalesce(max(n), 0) into v_n from event where world_id = w;
  perform act_perform(w, me, 'crate_work', jsonb_build_object('kind', 'item', 'uid', v_crate));
  insert into said select 'OUT', kind || '|' || text from event where world_id = w and uid = me and n > v_n order by n desc limit 1;
  insert into said select 'WORKER', mode from creature where world_id = w and id = v_first;

  -- A load of two logs put away, standing at the store it goes in.
  delete from item where world_id = w and holder in ('crate', 'furniture');
  select * into c from creature where world_id = w and id = v_first;
  select * into r from worker_store(w, c, 'log', 2);
  insert into said values ('STORE', coalesce(r.kind, 'nowhere'));
  update creature set from_x = r.cx, from_y = r.cy, to_x = r.cx, to_y = r.cy, post = null, name = 'Biscuit',
      phase = 'home', carrying = jsonb_build_object('def', 'log', 'count', 2, 'ql', 30, 'extra', 'oak'),
      leg_at = now() - interval '1 second', leg_ends = now() - interval '1 second',
      until = now() - interval '0.5 seconds', settled_at = now()
    where world_id = w and id = v_first;
  select coalesce(max(n), 0) into v_n from event where world_id = w;
  perform worker_settle(w, v_first);
  insert into said select 'DELIVERED', coalesce(string_agg(kind || '|' || text, ' / ' order by n), 'nothing')
    from event where world_id = w and uid = me and n > v_n;
  -- And a settle with nothing due says nothing.
  select coalesce(max(n), 0) into v_n from event where world_id = w;
  update creature set until = now() + interval '1 minute' where world_id = w and id = v_first;
  perform worker_settle(w, v_first);
  insert into said select 'QUIET', count(*)::text from event where world_id = w and uid = me and n > v_n;

  -- An evolution.
  update creature set skills = jsonb_build_object('foraging', evolve_at_1() - 0.0001) where world_id = w and id = v_first;
  select coalesce(max(n), 0) into v_n from event where world_id = w;
  for v_tries in 1..50 loop
    perform worker_learn(w, v_first, 'foraging', 5);
    exit when (select stage_of(cr) from creature cr where cr.world_id = w and cr.id = v_first) = 1;
  end loop;
  insert into said select 'EVOLVED', kind || '|' || text from event where world_id = w and uid = me and n > v_n and text like '% evolved: %'
    order by n desc limit 1;

  -- A birth.
  v_dam := creature_spawn(w, 'rabba', v_x, v_y + 0.3, 'stored', now() - interval '3 hours', me);
  update creature set sex = 'female', unborn = jsonb_build_object('traits', '[]'::jsonb, 'sex', 'male'), due = now() - interval '1 second'
    where world_id = w and id = v_dam;
  select coalesce(max(n), 0) into v_n from event where world_id = w;
  perform give_birth(w, v_dam);
  insert into said select 'BORN', kind || '|' || text from event where world_id = w and uid = me and n > v_n and text like 'Born to %'
    order by n desc limit 1;
end $b$;
${DONE.map((d, i) => `insert into said values ('LINE${i}', work_done_line('Biscuit', ${j(d)}));`).join('\n')}
${WHOLE.map((fn) => `insert into said values ('F:${fn}', (length(pg_get_functiondef('${fn}'::regproc)) - length(replace(pg_get_functiondef('${fn}'::regproc), 'perform tell(', ''))) / 13 || '|' || (length(pg_get_functiondef('${fn}'::regproc)) - length(replace(pg_get_functiondef('${fn}'::regproc), 'perform wtell(', ''))) / 14);`).join('\n')}
select k || '=' || replace(coalesce(v, 'null'), E'\\n', ' ') from said order by k;
rollback;
`);
const said = new Map<string, string>();
for (const line of out.split('\n')) {
  const eq = line.indexOf('=');
  if (eq > 0) said.set(line.slice(0, eq), line.slice(eq + 1));
}
const island = (k: string): string => said.get(k) ?? 'MISSING';
const kindOf = (k: string): string => island(k).split('|')[0];

check('a tame tells its tamer as wildermon', kindOf('TAME') === 'wildermon', island('TAME'));
check('a tame refused for want of a crate stays in Trouble', kindOf('REFUSED') === 'error', island('REFUSED'));
check('into its crate, as wildermon', kindOf('CRATED') === 'wildermon' && island('CRATED').includes('into the wildermon crate'), island('CRATED'));
check('out of it to work the settlement, as wildermon', kindOf('OUT') === 'wildermon' && island('WORKER') === 'deed',
  `${island('OUT')}; ${island('WORKER')}`);
check('the worker has somewhere to put a load', island('STORE') !== 'nowhere', island('STORE'));
const want = workDoneLine('Biscuit', { stored: { log: 2 } });
check(`a load put away tells the keeper, as wildermon: ${want}`, island('DELIVERED') === `wildermon|${want}`, island('DELIVERED'));
check('a settle with nothing due tells nothing', island('QUIET') === '0', island('QUIET'));
check('an evolution tells its keeper as wildermon', kindOf('EVOLVED') === 'wildermon', island('EVOLVED'));
check('a birth tells its keeper as wildermon', kindOf('BORN') === 'wildermon', island('BORN'));
DONE.forEach((d, i) => {
  const mine = workDoneLine('Biscuit', d);
  check(`work_done_line is workDoneLine for ${JSON.stringify(d)}: "${mine}"`, island(`LINE${i}`) === mine, island(`LINE${i}`));
});
for (const fn of WHOLE) {
  const [plain, w] = island(`F:${fn}`).split('|').map(Number);
  check(`${fn}: every line said by wtell (${w})`, plain === 0 && w > 0, island(`F:${fn}`));
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`the Wildermon tab — ${ok.length} of ${ok.length}`);
