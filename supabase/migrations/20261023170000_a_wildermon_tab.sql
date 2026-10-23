set local lock_timeout = '3s';

-- A Wildermon tab in the log, and a line there for each worker's finished work.
--
-- Asked for: "Add a wildermon event tab and put everything there instead of Talk. Add wildermon deed actions to this
-- tab". Every line about one's own wildermon is said as kind `wildermon` (`wtell`), short of a refusal, a blow or a
-- word said (`error`, `fight`, `chat`), which keep their tabs; the browser's Wildermon tab keeps that kind. And a
-- worker's settling says, to its keeper, what it put into the stores and what its errands took from its arms, once a
-- settling with any (`work_done_line`, the browser's `workDoneLine`), on the same counts as its ledger.

/** A line about wildermon: said as `wildermon`, unless it is a refusal, a blow or a word said. */
create or replace function wtell(p_world uuid, p_uid uuid, p_text text, p_kind text default 'event')
  returns void language sql as $fn$
  insert into event (world_id, uid, text, kind)
  values (p_world, p_uid, p_text, case when p_kind in ('event', 'info', 'system', 'skill') then 'wildermon' else p_kind end)
$fn$;

/** So many of an item added to one part (`stored`, `handled`) of a settling's work done; nothing for none. */
create or replace function did_add(p_did jsonb, p_part text, p_item text, p_n int) returns jsonb
  language sql immutable as $fn$
  select case when p_item is null or coalesce(p_n, 0) <= 0 then p_did
    else coalesce(p_did, '{}'::jsonb) || jsonb_build_object(p_part, coalesce(p_did -> p_part, '{}'::jsonb)
      || jsonb_build_object(p_item, coalesce((p_did -> p_part ->> p_item)::int, 0) + p_n)) end
$fn$;

/** A worker's finished work as its keeper's log says it: "Bevere: stored 12 × log; handled 4 × brick." The browser's `workDoneLine`. */
create or replace function work_done_line(p_name text, p_did jsonb) returns text language sql stable as $fn$
  with parts as (
    select k.part, k.o, (select string_agg(e.value || ' × ' || coalesce(lower(d.name), e.key), ', ' order by e.key collate "C")
                         from jsonb_each_text(p_did -> k.part) e left join item_def d on d.id = e.key
                         where e.value::int > 0) as said
    from (values ('stored', 1), ('handled', 2)) k(part, o))
  select case when count(said) = 0 then '' else p_name || ': ' || string_agg(part || ' ' || said, '; ' order by o) || '.' end
  from parts where said is not null
$fn$;

do $do$
declare v_def text; v_n int; i int;
  -- Every line in these is about one's own wildermon.
  v_all text[][] := array[
    array['perform_creature', '21'], array['perform_crate_open', '3'], array['post_release', '4'],
    array['worker_settle', '1'], array['worker_nowhere', '1'], array['worker_learn_paced', '1'],
    array['worker_idle', '2'], array['companion_settle', '1'], array['read_ground', '1'],
    array['gear_wear', '1'], array['perform_gear', '2'], array['gear_off', '1'], array['milk_go', '1'],
    array['pair_them', '1'], array['drop_young', '1'], array['perform_artifact', '9']];
  -- And these lines, in functions that say other things too: the anchor, how many times, what it becomes.
  v_fix text[][] := array[
    array['perform_settlement', 'perform tell(p_world, p_uid, c.name || '' will ''', '1'],
    array['perform_last', 'perform tell(p_world, p_uid, ''Paired: ''', '1'],
    array['perform_last', 'perform tell(p_world, p_uid, blood_read(', '1'],
    array['perform_trap', 'perform tell(p_world, p_uid, ''Taken: '' || lower(s.name)', '2'],
    array['perform_ride', 'perform tell(p_world, p_uid, ''Saddled and bridled: ''', '1'],
    array['perform_ride', 'perform tell(p_world, p_uid, ''Shod: ''', '1'],
    array['perform_ride', 'perform tell(p_world, p_uid, ''Tack removed: ''', '1'],
    array['perform_ride', 'perform tell(p_world, p_uid, ''Mounted: ''', '1'],
    array['perform_ride', 'perform tell(p_world, p_uid, ''Dismounted: ''', '1'],
    array['perform_ride', 'perform tell(p_world, p_uid, ''Hitched''', '1'],
    array['perform_ride', 'perform tell(p_world, p_uid, ''Unhitched: ''', '2']];
  -- A worker's settling, adding up what it finished and telling its keeper once at the end.
  v_work text[][] := array[
    array['v_trip record; v_made int[];', 'v_trip record; v_made int[]; v_did jsonb;'],
    array['          c.ledger := ledger_add(c.ledger, v_day, 1, 0, v_held->>''def'',
                                 greatest(0, coalesce((v_held->>''count'')::int, 1) - v_left));',
          '          c.ledger := ledger_add(c.ledger, v_day, 1, 0, v_held->>''def'',
                                 greatest(0, coalesce((v_held->>''count'')::int, 1) - v_left));
          v_did := did_add(v_did, ''handled'', v_held->>''def'', greatest(0, coalesce((v_held->>''count'')::int, 1) - v_left));'],
    array['c.ledger := ledger_add(c.ledger, v_day, 0, 0, ''honey'', v_made[1]);',
          'c.ledger := ledger_add(c.ledger, v_day, 0, 0, ''honey'', v_made[1]); v_did := did_add(v_did, ''stored'', ''honey'', v_made[1]);'],
    array['c.ledger := ledger_add(c.ledger, v_day, 0, 0, ''wax'', v_made[2]);',
          'c.ledger := ledger_add(c.ledger, v_day, 0, 0, ''wax'', v_made[2]); v_did := did_add(v_did, ''stored'', ''wax'', v_made[2]);'],
    array['c.ledger := ledger_add(c.ledger, v_day, 0, 0, c.carrying->>''def'', coalesce((c.carrying->>''count'')::int, 1));',
          'c.ledger := ledger_add(c.ledger, v_day, 0, 0, c.carrying->>''def'', coalesce((c.carrying->>''count'')::int, 1));
          v_did := did_add(v_did, ''stored'', c.carrying->>''def'', coalesce((c.carrying->>''count'')::int, 1));'],
    array['    where world_id = p_world and id = p_id;
  return done;
end',
          '    where world_id = p_world and id = p_id;
  if v_did is not null and c.keeper is not null then perform wtell(p_world, c.keeper, work_done_line(c.name, v_did)); end if;
  return done;
end']];
begin
  for i in 1 .. array_length(v_all, 1) loop
    v_def := pg_get_functiondef(v_all[i][1]::regproc);
    v_n := (length(v_def) - length(replace(v_def, 'perform tell(', ''))) / length('perform tell(');
    if v_n <> v_all[i][2]::int then raise exception '% has % of perform tell(, not %', v_all[i][1], v_n, v_all[i][2]; end if;
    execute replace(v_def, 'perform tell(', 'perform wtell(');
  end loop;
  for i in 1 .. array_length(v_fix, 1) loop
    v_def := pg_get_functiondef(v_fix[i][1]::regproc);
    v_n := (length(v_def) - length(replace(v_def, v_fix[i][2], ''))) / length(v_fix[i][2]);
    if v_n <> v_fix[i][3]::int then raise exception '% has % of %, not %', v_fix[i][1], v_n, v_fix[i][2], v_fix[i][3]; end if;
    execute replace(v_def, v_fix[i][2], replace(v_fix[i][2], 'perform tell(', 'perform wtell('));
  end loop;
  -- worker_settle again, after its one tell above: what it finished.
  v_def := pg_get_functiondef('worker_settle'::regproc);
  for i in 1 .. array_length(v_work, 1) loop
    v_n := (length(v_def) - length(replace(v_def, v_work[i][1], ''))) / length(v_work[i][1]);
    if v_n <> 1 then raise exception 'worker_settle has % of %', v_n, v_work[i][1]; end if;
    v_def := replace(v_def, v_work[i][1], v_work[i][2]);
  end loop;
  execute v_def;
end $do$;

select private.lock_doors();
