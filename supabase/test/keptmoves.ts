/**
 * A kept thing stays kept (20261026180000).
 *
 * Reported: "Something is unlocking my supreme mortars over and over." What
 * this asks, on the island, in a transaction rolled back, of a pack holding a
 * kept pile of ten supreme mortar and a loose pile of four beside it:
 *
 *   * of every action there is, asked of the kept pile as a thing and as two of
 *     it, only Unlock unlocks it;
 *   * three of it put in a bag are three kept there, and seven kept left;
 *   * the rest put in a bag already holding a loose pile of the same are a kept
 *     pile of their own there, and the loose one is as it was;
 *   * taken back into a pack holding a loose pile of the same, they are kept;
 *   * and a loose pile taken back joins the kept pile in the pack, as anything
 *     made or picked up does (`keptStack`);
 *   * a pile kept while the whole pack is being folded (`pack_fold`) is not
 *     folded into the loose pile beside it.
 *
 * And in the browser, against a keeper that is a stub on `fetch`: two asks out
 * at once, answered newest first, leave the newest answer's pack on the screen
 * -- the older one does not put the kept pile back as loose (`Island.act`).
 *
 * Runs against the database the suite leaves behind.
 */
import { execFileSync } from 'node:child_process';
import { Island, type ItemRow } from '../../src/net/island';

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

/* ---- the island ----------------------------------------------------------------------------------- */

const out = psql(`
set client_min_messages = warning;
begin;
create temp table said (k text, v text);
select p.world_id, p.uid, p.name into temp who from player p order by p.world_id, p.uid limit 1;
-- Nothing in hand or lined up, so every action is asked of the pile alone.
update player p set act = null, act_target = null, act_ends = null, act_queue = '[]'::jsonb
  from who w where p.world_id = w.world_id and p.uid = w.uid;
delete from item i using who w where i.world_id = w.world_id and i.holder_uid = w.uid and i.def in ('mortar', 'backpack');
create temp table ids (k text primary key, id bigint);
with k as (insert into item (world_id, holder, holder_uid, def, ql, count, rare, maker, locked)
  select w.world_id, 'player', w.uid, 'mortar', 40, 10, 'supreme', w.name, true from who w returning id)
insert into ids select 'kept', id from k;
with k as (insert into item (world_id, holder, holder_uid, def, ql, count, rare, maker)
  select w.world_id, 'player', w.uid, 'mortar', 30, 4, 'supreme', w.name from who w returning id)
insert into ids select 'loose', id from k;
with k as (insert into item (world_id, holder, holder_uid, def, ql, count)
  select w.world_id, 'player', w.uid, 'backpack', 60, 1 from who w returning id)
insert into ids select 'bag', id from k;

-- 1. Every action, of the kept pile and of two of it: what leaves it unkept, or out of the pack.
do $$
declare w who; a record; tg jsonb; v_k bigint := (select id from ids where k = 'kept'); v item; v_hit text[] := '{}';
begin
  select * into w from who;
  foreach tg in array array[jsonb_build_object('kind', 'item', 'uid', v_k),
                            jsonb_build_object('kind', 'item', 'uid', v_k, 'count', 2)] loop
    for a in select id from action_def order by id loop
      begin
        if act_refusal(w.world_id, w.uid, a.id, tg) is null then
          perform act_perform(w.world_id, w.uid, a.id, tg);
          select * into v from item where id = v_k;
          if v.id is null or not v.locked or v.holder <> 'player' then
            v_hit := v_hit || (a.id || coalesce('×' || (tg->>'count'), ''));
          end if;
        end if;
        raise exception using errcode = 'WK999';
      exception when others then
        null;
      end;
    end loop;
  end loop;
  -- Written down out here: each action's own work is undone, and what it said with it.
  insert into said select 'UNKEPT', h from unnest(v_hit) h;
end $$;

-- 2. Three of it into the bag.
select act_perform(w.world_id, w.uid, 'stow_item', jsonb_build_object('kind', 'item', 'uid', (select id from ids where k = 'kept'), 'count', 3))
  from who w \\g /dev/null
insert into said select 'BAG3', string_agg(i.count || ':' || i.locked, ',' order by i.id) from item i
 where i.holder = 'bag' and i.inside = (select id from ids where k = 'bag') and i.def = 'mortar';
insert into said select 'LEFT3', i.count || ':' || i.locked from item i where i.id = (select id from ids where k = 'kept');

-- 3. A loose pile of the same in the bag, and then the rest of the kept pile.
insert into item (world_id, holder, holder_uid, inside, def, ql, count, rare, maker)
select w.world_id, 'bag', w.uid, (select id from ids where k = 'bag'), 'mortar', 20, 2, 'supreme', w.name from who w;
select act_perform(w.world_id, w.uid, 'stow_item', jsonb_build_object('kind', 'item', 'uid', (select id from ids where k = 'kept'), 'count', 7))
  from who w \\g /dev/null
insert into said select 'BAG10', string_agg(i.count || ':' || i.locked, ',' order by i.locked desc, i.id) from item i
 where i.holder = 'bag' and i.inside = (select id from ids where k = 'bag') and i.def = 'mortar';

-- 4. The kept ones back into the pack, which holds the loose pile of four.
select act_perform(w.world_id, w.uid, 'take_from_store', jsonb_build_object('kind', 'item', 'count', 10,
         'uid', (select i.id from item i where i.holder = 'bag' and i.inside = (select id from ids where k = 'bag')
                   and i.def = 'mortar' and i.locked order by i.id limit 1)))
  from who w \\g /dev/null
insert into said select 'PACK', string_agg(i.count || ':' || i.locked, ',' order by i.locked desc, i.id) from item i, who w
 where i.world_id = w.world_id and i.holder = 'player' and i.holder_uid = w.uid and i.def = 'mortar';

-- 5. And the loose two out of the bag: onto the kept pile.
select act_perform(w.world_id, w.uid, 'take_from_store', jsonb_build_object('kind', 'item', 'count', 2,
         'uid', (select i.id from item i where i.holder = 'bag' and i.inside = (select id from ids where k = 'bag')
                   and i.def = 'mortar' and not i.locked order by i.id desc limit 1)))
  from who w \\g /dev/null
insert into said select 'LOOSEBACK', string_agg(i.count || ':' || i.locked, ',' order by i.locked desc, i.id) from item i, who w
 where i.world_id = w.world_id and i.holder = 'player' and i.holder_uid = w.uid and i.def = 'mortar';

-- 6. Two piles of two rows each, and each pile's fold locks the other's second row before that pile is held.
delete from item i using who w where i.world_id = w.world_id and i.holder_uid = w.uid and i.def in ('mortar', 'peat');
with r as (insert into item (world_id, holder, holder_uid, def, ql, count)
  select w.world_id, 'player', w.uid, d, 30, 2 from who w, (values ('mortar'), ('mortar'), ('peat'), ('peat')) v(d)
  returning id)
insert into ids select 'm' || row_number() over (order by id), id from r;
create function pg_temp.kept_mid_fold() returns trigger language plpgsql as $f$
begin
  if new.id = (select id from ids where k = 'm1') then
    update item set locked = true where id = (select id from ids where k = 'm4');
  elsif new.id = (select id from ids where k = 'm3') then
    update item set locked = true where id = (select id from ids where k = 'm2');
  end if;
  return null;
end $f$;
create trigger kept_mid_fold after update of count on item for each row execute function pg_temp.kept_mid_fold();
select pack_fold(w.world_id, w.uid) from who w \\g /dev/null
drop trigger kept_mid_fold on item;
insert into said select 'MIDFOLD', string_agg(i.def || ':' || i.count || ':' || i.locked, ',' order by i.def, i.locked, i.id) from item i, who w
 where i.world_id = w.world_id and i.holder = 'player' and i.holder_uid = w.uid and i.def in ('mortar', 'peat');

select k || '|' || coalesce(v, '') from said;
rollback;
`);

const said = new Map<string, string[]>();
for (const line of out.split('\n').filter(Boolean)) {
  const [k, v] = line.split('|');
  said.set(k, [...(said.get(k) ?? []), v]);
}
const one = (k: string): string => (said.get(k) ?? [''])[0];

const unkept = said.get('UNKEPT') ?? [];
check('of every action asked of a kept pile, only Unlock unlocks it',
  unkept.length > 0 && unkept.every((a) => a.startsWith('unlock_item')), unkept.join(', '));
check('three of a kept pile put in a bag are three kept there', one('BAG3') === '3:true', one('BAG3'));
check('and seven kept left in the pack', one('LEFT3') === '7:true', one('LEFT3'));
check('the rest into a bag holding a loose pile of the same: a kept pile of their own, the loose one as it was',
  one('BAG10') === '10:true,2:false', one('BAG10'));
check('taken back into a pack holding a loose pile of the same, they are kept', one('PACK') === '10:true,4:false', one('PACK'));
check('a loose pile taken back joins the kept pile', one('LOOSEBACK') === '12:true,4:false', one('LOOSEBACK'));
// Whichever pile is folded first, the other's second row is kept before that pile is held: it stands alone and kept.
const mid = one('MIDFOLD').split(',');
check('a pile kept while the pack is folded is not folded into the loose one',
  mid.length === 3 && mid.filter((r) => r.endsWith(':true')).length === 1 && mid.some((r) => r.endsWith(':4:false')),
  one('MIDFOLD'));

/* ---- the browser ---------------------------------------------------------------------------------- */

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const row = (locked: boolean): ItemRow => ({
  id: 7, def: 'mortar', ql: 40, dmg: 0, count: 10, extra: null, holder: 'player', charges: null, locked, issued: false,
  rare: 'supreme', dye: null, bless: null, maker: 'Ivar', piece: null, lit: false, lit_at: null, inside: null, gx: null, gy: null,
});
/** The keeper: `rpc_act` answers each ask when it is let go, with the pack as that ask left it. */
const held: Array<{ action: string; go: () => void }> = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.endsWith('/rest/v1/rpc/rpc_act')) return json([]);
  const body = JSON.parse(String(init?.body ?? '{}')) as { p_action?: string };
  const action = body.p_action ?? '';
  return new Promise<Response>((done) => {
    held.push({ action, go: () => done(json({ started: true, done: true, pack: [row(action === 'lock_item')], crates: [] })) });
  });
}) as typeof fetch;

const isle = new Island({} as never);
isle.info = { id: 'w', name: 'w', seed: 1, size: 64, spawn_x: 0, spawn_y: 0, ready: true, epoch: '2026-01-01T00:00:00Z' };
let shown: ItemRow[] = [];
isle.hooks.pack = (items) => {
  shown = items;
};
const waitFor = async (n: number): Promise<void> => {
  for (let i = 0; i < 200 && held.length < n; i++) await new Promise((r) => setTimeout(r, 5));
};
// A craft goes out, then a lock; the lock is answered first and the craft after.
const craft = isle.act('make_mortar', { kind: 'item' }, 1);
await waitFor(1);
const lock = isle.act('lock_item', { kind: 'item', uid: 7 }, 1);
await waitFor(2);
held[1].go();
await lock;
check('the newer answer is laid', shown[0]?.locked === true, JSON.stringify(shown.map((r) => r.locked)));
held[0].go();
await craft;
check('and an older answer arriving after it does not put the kept pile back as loose',
  shown[0]?.locked === true, JSON.stringify(shown.map((r) => r.locked)));
// And in order, each is laid.
held.length = 0;
const third = isle.act('unlock_item', { kind: 'item', uid: 7 }, 1);
await waitFor(1);
held[0].go();
await third;
check('an answer to the newest ask is laid as ever', shown[0]?.locked === false, JSON.stringify(shown.map((r) => r.locked)));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
// The answers armed a beat on the island; nothing more is asked of it here.
process.exit(bad.length ? 1 : 0);
