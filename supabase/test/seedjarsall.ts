/**
 * Ancient seed jars: Open, All (N).
 *
 * Asked for: "add an open all option on ancient jars". The goes of one job are asked of the job's own target, so Open
 * opens the jar named while it is carried and else the next one in the pack, lowest uid first. Seed jars stack now
 * (`20261128010900_ancient_finds_stack.sql`), so five given at QL 11 to 15 are one pile at their average. This asks,
 * of both sides:
 *
 *   * that Open All (5) on a pile of five opens all five, one a go, each at the pile's QL, to 5 × `JAR_SEEDS` seeds;
 *   * that with no jar left Open is refused, in the same words;
 *   * and of the browser's menu, that two or more jars offer One and All (N), N to `JOB_GOES_MOST`, and one a plain Open.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type ActionDef, type Target } from '../../src/game/actions';
import { CROP_BY_SEED } from '../../src/game/farming';
import { JOB_GOES_MOST } from '../../src/game/mending';
import { JAR_SEEDS, SEED_JAR, seedJarOpened } from '../../src/game/relicuse';
import { allOfKindEntry } from '../../src/ui/beltmenu';
import { psql, check, finish } from './harness';

const U = '5eed0a11-0000-4000-8000-00000000a11a';
const QLS = [11, 12, 13, 14, 15];
const NAMED = 2; // the third given, which joined the pile
/** Every jar opened at the pile's QL, the average of the five given. */
const PILE_QL = QLS.reduce((a, b) => a + b, 0) / QLS.length;
const ORDER = QLS.map(() => PILE_QL.toFixed(1)).join(',');

/* ---- on the island ----------------------------------------------------------------- */

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
create or replace function pg_temp.run(w uuid, u uuid, most int) returns int language plpgsql as $r$
declare k int := 0;
begin
  while k < most and exists (select 1 from player where world_id = w and uid = u and act is not null) loop
    update player set act_ends = now() - interval '1 second', body_at = now(),
           stats = coalesce(stats, '{}'::jsonb) || '{"stamina": 1, "hunger": 1, "thirst": 1}'::jsonb
     where world_id = w and uid = u;
    perform settle(w, u);
    k := k + 1;
  end loop;
  return k;
end $r$;
do $t$
declare w uuid; u uuid := '${U}'; v_jars bigint[] := '{}'; v_q double precision; v_named jsonb; v_one bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Seed jars', 717, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Opener');
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  foreach v_q in array array[${QLS.join(', ')}]::double precision[] loop
    v_jars := v_jars || give(w, u, 'ancient_seed_jar', 1, v_q);
  end loop;
  v_named := jsonb_build_object('kind', 'item', 'uid', v_jars[${NAMED + 1}]);
  insert into said values ('ASK', coalesce((rpc_act(w, 'open_seed_jar', v_named, ${QLS.length}))->>'why', 'taken'));
  insert into said values ('GOES', pg_temp.run(w, u, 20)::text);
  insert into said select 'ORDER', string_agg(substring(text from 'QL ([0-9.]+)\\.$'), ',' order by n)
    from event where world_id = w and uid = u and text like 'Seed jar opened:%';
  insert into said select 'SEEDS', coalesce(sum(i.count), 0) || '|' || pack_count(w, u, 'ancient_seed_jar')
    from item i join crop_def c on c.seed = i.def where i.world_id = w and i.holder = 'player' and i.holder_uid = u;
  insert into said values ('NONE', coalesce(act_refusal(w, u, 'open_seed_jar', v_named), '-'));
  insert into said select 'STOPPED', coalesce(string_agg(text, ' / ' order by n), '-') from event
    where world_id = w and uid = u and text like 'Open:%';
  -- The named jar gone, one other carried: that one.
  v_one := give(w, u, 'ancient_seed_jar', 1, 20);
  insert into said values ('OTHER', coalesce(act_refusal(w, u, 'open_seed_jar', v_named), '-') || '|'
    || ((seed_jar_opened(w, u, v_named)).id = v_one)::text);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

check(`Open All (${QLS.length}) on ${QLS.length} jars is taken on the island, and runs ${QLS.length} goes`,
  at('ASK') === 'taken' && at('GOES') === String(QLS.length), `${at('ASK')} ${at('GOES')}`);
check('on the island, each jar at the pile\'s QL',at('ORDER') === ORDER, `${at('ORDER')} | ${ORDER}`);
check(`on the island, ${QLS.length} × ${JAR_SEEDS} seeds, no jar left`, at('SEEDS') === `${QLS.length * JAR_SEEDS}|0`, at('SEEDS'));
check('on the island, no jar left: refused, "It is gone."; the run ended with no refusal said',
  at('NONE') === 'It is gone.' && at('STOPPED') === '-', `${at('NONE')} | ${at('STOPPED')}`);
check('on the island, the named jar gone and another carried: Open opens that one', at('OTHER') === '-|true', at('OTHER'));

/* ---- in the browser ---------------------------------------------------------------- */

const g = Game.create(717);
const open = ACTION_BY_ID.get('open_seed_jar')!;
for (const it of [...g.inventory.items]) g.inventory.remove(it.uid, it.count);
const jars = QLS.map((ql) => g.inventory.add(SEED_JAR, { ql }));
const named: Target = { kind: 'item', uid: jars[NAMED].uid };

// The menu, with five: One and All (5), each asking the island for its goes.
const asked: (number | undefined)[] = [];
g.requestAction = (_def: ActionDef, _t: Target, goes?: number): void => { asked.push(goes); };
const five = allOfKindEntry(g, open, named, SEED_JAR);
five?.children?.forEach((c) => c.onSelect?.());
check(`the menu on one of ${QLS.length} jars: Open, One and All (${QLS.length})`,
  !!open.allOfKind && five?.label === 'Open' && five.children?.map((c) => c.label).join(',') === `One,All (${QLS.length})`
    && asked.join(',') === `,${QLS.length}`, `${five?.children?.map((c) => c.label)} ${asked}`);

const ql = (it: { ql: number } | undefined): string => (it ? it.ql.toFixed(1) : '-');
const opened: string[] = [];
for (let i = 0; i < QLS.length; i++) {
  if (open.check?.(named, g)) break;
  opened.push(ql(seedJarOpened(g, named)));
  open.perform(named, g);
}
const seeds = g.inventory.items.filter((it) => CROP_BY_SEED.has(it.id));
check('in the browser, each jar at the pile\'s QL, as on the island',
  opened.join(',') === ORDER && at('ORDER') === opened.join(','), opened.join(','));
check(`in the browser, ${QLS.length} × ${JAR_SEEDS} seeds, no jar left`,
  seeds.reduce((n, it) => n + it.count, 0) === QLS.length * JAR_SEEDS && g.inventory.countAll(SEED_JAR) === 0,
  seeds.map((it) => `${it.id}:${it.count}`).join(','));
check('in the browser, no jar left: refused in the island\'s words', open.check?.(named, g) === at('NONE'), String(open.check?.(named, g)));

// One jar: a plain Open. And a pack of more than the goes cap: All to the cap.
const one = g.inventory.add(SEED_JAR, { ql: 20 });
check('with one jar, a plain Open', allOfKindEntry(g, open, { kind: 'item', uid: one.uid }, SEED_JAR) === null
  && open.check?.(named, g) === null && seedJarOpened(g, named) === one, 'one');
for (let i = 0; i < JOB_GOES_MOST + 4; i++) g.inventory.add(SEED_JAR, { ql: 20 });
const many = allOfKindEntry(g, open, { kind: 'item', uid: one.uid }, SEED_JAR);
check(`with more than ${JOB_GOES_MOST} jars, All (${JOB_GOES_MOST})`, many?.children?.[1]?.label === `All (${JOB_GOES_MOST})`, many?.children?.[1]?.label);
check('a job not marked all-of-kind is offered no All', allOfKindEntry(g, ACTION_BY_ID.get('hone_whetstone')!, named, SEED_JAR) === null);

finish('ancient seed jars: Open, All (N)');
