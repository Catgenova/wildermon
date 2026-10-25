/**
 * A stack split without SQL built at run time, doing what it did before.
 *
 * `barter_split` and `rpc_work_deliver` copied part of a stack into a row of its own by building an
 * insert out of `item`'s columns and running it. They copy the row itself now (20261026020200). This
 * puts the old SQL back beside each, as it was, and runs old and new on the same things in the same
 * state, rolled back between: every row they leave, what they answer, the work, the ledger and what
 * they tell, the same -- ids apart, which a sequence hands out.
 *
 *   * a trade's part of a stack, every column of the row set to something;
 *   * a thing that is not there;
 *   * a delivery that splits a stack, one the crate's room splits, and one that takes whole stacks.
 *
 * Makes its own island and rolls it back.
 */
import { execFileSync } from 'node:child_process';

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

/* ---- the old SQL, put back ------------------------------------------------------------------------ */

/** [what is there now, what was there before] in each function, as 20261026020200 swapped them. */
const SPLIT: Array<[string, string]> = [
  ['declare v_part item; v_new bigint;\n', 'declare v_cols text; v_new bigint;\n'],
  [`  -- The whole row, so a column added later comes too, with how many and whose set on it.
  select * into v_part from item where id = p_id;
  if found then
    v_part.id := nextval(pg_get_serial_sequence('public.item', 'id'));
    v_part.holder := 'player'; v_part.holder_uid := p_to; v_part.count := p_count;
    insert into item overriding system value values (v_part.*) returning id into v_new;
  end if;
`, `  select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into v_cols
    from pg_attribute a
   where a.attrelid = 'public.item'::regclass and a.attnum > 0 and not a.attisdropped
     and a.attidentity = '' and a.attgenerated = ''
     and a.attname not in ('id', 'count', 'holder', 'holder_uid');
  execute format('insert into item (holder, holder_uid, count, %s) select ''player'', $1, $2, %s from item where id = $3 returning id',
                 v_cols, v_cols)
    into v_new using p_to, p_count, p_id;
`],
];
const DELIVER: Array<[string, string]> = [
  ['        v_what text; v_part item; v_by text; v_done boolean := false;\n',
    '        v_what text; v_cols text; v_by text; v_done boolean := false;\n'],
  [`      -- The whole row, so a column added later comes too; where it is set on it, and the rest as a new row has it.
      select * into v_part from item where id = it.id;
      v_part.id := nextval(pg_get_serial_sequence('public.item', 'id'));
      v_part.holder := 'crate'; v_part.holder_uid := null; v_part.crate := cr.id;
      v_part.gx := cr.x; v_part.gy := cr.y; v_part.count := v_take;
      v_part.inside := null; v_part.placed := null; v_part.price := null; v_part.locked := false; v_part.deal := null;
      insert into item overriding system value values (v_part.*);
`, `      select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into v_cols
        from pg_attribute a
       where a.attrelid = 'public.item'::regclass and a.attnum > 0 and not a.attisdropped
         and a.attidentity = '' and a.attgenerated = ''
         and a.attname not in ('id', 'count', 'holder', 'holder_uid', 'crate', 'gx', 'gy', 'inside', 'placed',
                               'price', 'locked', 'deal');
      execute format('insert into item (holder, crate, gx, gy, count, %s) select ''crate'', $1, $2, $3, $4, %s from item where id = $5',
                     v_cols, v_cols)
        using cr.id, cr.x, cr.y, v_take, it.id;
`],
];

/** The function as it was: the swaps undone, each found exactly once, under a name of its own in pg_temp. */
const was = (fn: string, sig: string, swaps: Array<[string, string]>): string => {
  let def = psql(`select pg_get_functiondef('public.${fn}(${sig})'::regprocedure)`);
  for (const [now, before] of swaps) {
    const n = def.split(now).length - 1;
    if (n !== 1) throw new Error(`${fn}: what 20261026020200 put there is in it ${n} times`);
    def = def.replace(now, () => before);
  }
  if (!def.includes('execute format(')) throw new Error(`${fn}: the old SQL did not go back`);
  return `${def.replace(`FUNCTION public.${fn}(`, `FUNCTION pg_temp.${fn}_was(`)};`;
};
const splitWas = was('barter_split', 'bigint, integer, uuid', SPLIT);
const deliverWas = was('rpc_work_deliver', 'uuid, uuid, bigint', DELIVER);

/* ---- old and new on the same things --------------------------------------------------------------- */

const BOSS = 'a0e00000-0000-4000-8000-0000000000e1';
const TO = 'a0e00000-0000-4000-8000-0000000000e2';

const out = psql(`
begin;
create temp table said (k text, v text);
${splitWas}
${deliverWas}
-- Everything on the island that the two could have touched, ids apart, in an order that does not depend on them.
create function pg_temp.state(w uuid) returns jsonb language sql as $f$
  select jsonb_build_object(
    'items', (select jsonb_agg(to_jsonb(i) - 'id' - 'inside' - 'letter' order by i.holder, i.holder_uid, i.crate, i.def, i.ql, i.count, i.extra)
                from item i where i.world_id = w),
    'work', (select jsonb_agg(to_jsonb(x) - 'at' - 'closed_at' order by x.id) from deed_work x where x.world_id = w),
    'ledger', (select jsonb_agg(to_jsonb(l) - 'n' - 'id' - 'at' order by l.what, l.count) from deed_ledger l where l.world_id = w),
    'told', (select jsonb_agg(e.text order by e.n) from event e where e.world_id = w))
$f$;
do $t$
declare w uuid; boss uuid := '${BOSS}'; v_to uuid := '${TO}'; cr crate; v_it bigint; v_work bigint; v_got jsonb;
        v_old jsonb; v_new jsonb; v_case text; v_a text; v_b text;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Splithold', 195, 40, 16, 16, true) returning id into w;
  perform land_blank(w, 40);
  perform set_config('request.jwt.claims', json_build_object('sub', v_to)::text, true);
  perform rpc_join(w, 'Tobin');
  perform set_config('request.jwt.claims', json_build_object('sub', boss)::text, true);
  perform rpc_join(w, 'Bosk');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Splithold', 16, 16, 5, 1, boss);
  perform place_deed_crate(w, boss);
  cr := deed_crate(w, boss);
  delete from item where world_id = w;
  update player set x = 16.5, y = 16.5, body_at = now(), equipped = '{}'::jsonb where world_id = w;

  -- A stack with every column of the row set to something.
  insert into item (world_id, holder, holder_uid, gx, gy, def, ql, dmg, count, extra, rare, dye, bless, charges,
                    locked, issued, made_at, lit, lit_at, rot_at, maker, piece, keyed, mark, cool, enchant, engraving)
  values (w, 'player', boss, 3, 4, 'log', 41.5, 7.25, 10, 'oak', 'rare', '#a03020', 0.4, 6,
          false, true, now() - interval '3 days', true, now() - interval '1 hour', now() + interval '2 days', 'Bosk', 'trunk', 77,
          '{"by": "Bosk", "ql": 41}'::jsonb, 0.5, '{"keen": 12}'::jsonb, 'B.')
  returning id into v_it;

  -- Each run in a block undone after it (a raise rolls the block back; what it said is kept in variables).
  for v_case in select unnest(array['split', 'none']) loop
    begin
      v_got := to_jsonb(pg_temp.barter_split_was(case v_case when 'split' then v_it else -1 end, 3, v_to) is not null);
      v_old := pg_temp.state(w) || jsonb_build_object('answer', v_got);
      raise exception 'undone';
    exception when others then if sqlerrm <> 'undone' then raise; end if;
    end;
    begin
      v_got := to_jsonb(barter_split(case v_case when 'split' then v_it else -1 end, 3, v_to) is not null);
      v_new := pg_temp.state(w) || jsonb_build_object('answer', v_got);
      raise exception 'undone';
    exception when others then if sqlerrm <> 'undone' then raise; end if;
    end;
    insert into said values ('SPLIT_' || v_case, (v_old = v_new)::text || '|' || jsonb_array_length(v_new->'items')
      || '|' || (v_new->>'answer') || case when v_old = v_new then '' else '|' || v_old::text || ' <> ' || v_new::text end);
  end loop;

  -- Deliveries: a split stack, a split by the crate's room, and whole stacks.
  for v_case in select unnest(array['split', 'room', 'whole']) loop
    begin
      delete from item where world_id = w and id <> v_it;
      delete from deed_work where world_id = w;
      insert into item (world_id, holder, holder_uid, def, ql, count, extra, rare, made_at, maker)
      values (w, 'player', boss, 'log', 30, case v_case when 'whole' then 2 else 7 end, 'pine', null, now() - interval '1 day', 'Bosk'),
             (w, 'player', boss, 'log', 60, 3, 'birch', 'supreme', now() - interval '2 days', null);
      if v_case = 'room' then
        -- A crate with room for 4 more.
        insert into item (world_id, holder, crate, gx, gy, def, ql, count)
        values (w, 'crate', cr.id, cr.x, cr.y, 'dirt', 10, greatest(0, crate_spare(w, cr) - 4));
      end if;
      delete from caller;
      v_work := (rpc_work_set(w, boss, 'log', 5)->>'set')::bigint;
      begin
        delete from caller;
        v_old := pg_temp.state(w) || jsonb_build_object('answer', pg_temp.rpc_work_deliver_was(w, boss, v_work));
        raise exception 'undone';
      exception when others then if sqlerrm <> 'undone' then raise; end if;
      end;
      begin
        delete from caller;
        v_new := pg_temp.state(w) || jsonb_build_object('answer', rpc_work_deliver(w, boss, v_work));
        raise exception 'undone';
      exception when others then if sqlerrm <> 'undone' then raise; end if;
      end;
      raise exception 'undone';
    exception when others then if sqlerrm <> 'undone' then raise; end if;
    end;
    insert into said values ('DELIVER_' || v_case, (v_old = v_new)::text || '|' || (v_new->'answer')::text
      || case when v_old = v_new then '' else '|' || v_old::text || ' <> ' || v_new::text end);
  end loop;
end $t$;
select k || '=' || v from said order by k;
rollback;
`);

const said = new Map<string, string>();
for (const line of out.split('\n')) {
  const i = line.indexOf('=');
  if (i > 0) said.set(line.slice(0, i), line.slice(i + 1));
}
const same = (k: string): [boolean, string] => {
  const v = said.get(k) ?? 'false|nothing said';
  return [v.startsWith('true|'), v.length > 600 ? `${v.slice(0, 600)}...` : v];
};

{
  const [same1, v] = same('SPLIT_split');
  check('a trade\'s part of a stack, every column set: the same rows as the old SQL left', same1 && v.split('|')[1] === '2', v);
}
check('and a thing that is not there: nothing, as before', ...same('SPLIT_none'));
check('a delivery that splits a stack leaves what the old SQL left, and answers the same', ...same('DELIVER_split'));
check('and one the crate\'s room splits', ...same('DELIVER_room'));
check('and one that takes whole stacks', ...same('DELIVER_whole'));
{
  const v = said.get('DELIVER_split') ?? '';
  check('the split delivery delivered five', v.includes('"delivered": 5'), v.slice(0, 200));
  const r = said.get('DELIVER_room') ?? '';
  check('the room-split one four', r.includes('"delivered": 4'), r.slice(0, 200));
}

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na stack split without built SQL — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
