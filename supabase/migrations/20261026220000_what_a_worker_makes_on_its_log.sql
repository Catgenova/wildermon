/*
 * What a worker makes in place, on its work log.
 *
 * Reported: "Dowse does not appear to be making nails or giving an error." Dowse 599 at its anvil: ledger
 * `{"now": {"goes": 1, "made": {}}}`. A go at an errand (`errand_go`) counted to the day's ledger only what left the
 * worker's arms; a trade worked in place -- smithing, spinning, sawing, cooking, tanning, milling, raking ash,
 * restoring, harvesting a planter, milking, shearing, butchering, emptying a furnace -- carries nothing, and what it
 * put into the stores (`worker_put`) was never counted.
 *
 * Now what a go puts into the stores as its work is counted with it, onto the day's ledger (`ledger_add`, so its
 * lifetime with it, `work_stats_keep`) and the line to its keeper as stored (`did_add`):
 *
 *   * `private.errand_go_made` is `errand_go` with `wurm.made` set to an empty list for the go, transaction-local;
 *   * `worker_put` notes the thing and its count on that list while it is set, and does nothing more otherwise;
 *   * `private.worker_made_take` reads the list and clears it, for `worker_settle` to count;
 *   * and what is put back rather than made is not noted (`private.worker_put_back`): a load carried back into the
 *     stores, which is counted as what left its arms already, and what a recipe hands back (`recipe_gives` returns).
 *
 * The browser's `intoStores` and `making` the same.
 */
set local lock_timeout = '3s';

/** Read what the go being counted put into the stores as its work, as [[def, count], ...], and stop noting. */
create or replace function private.worker_made_take() returns jsonb language plpgsql as $fn$
declare v jsonb := coalesce(nullif(current_setting('wurm.made', true), '')::jsonb, '[]'::jsonb);
begin
  perform set_config('wurm.made', '', true);
  return v;
end $fn$;

/** An errand's go (`errand_go`), noting what it puts into the stores as its work for `worker_made_take`. */
create or replace function private.errand_go_made(p_world uuid, p_id int) returns boolean language plpgsql as $fn$
declare v boolean;
begin
  perform set_config('wurm.made', '[]', true);
  v := errand_go(p_world, p_id);
  if not v then perform set_config('wurm.made', '', true); end if;
  return v;
end $fn$;

/** `worker_put` for what is put back rather than made: a load carried back, what a recipe hands back. Not noted. */
create or replace function private.worker_put_back(p_world uuid, c creature, p_def text, p_count int, p_ql double precision,
                                                   p_x int, p_y int, p_extra text default null) returns void language plpgsql as $fn$
declare v text := coalesce(current_setting('wurm.made', true), '');
begin
  if v <> '' then perform set_config('wurm.made', '', true); end if;
  perform worker_put(p_world, c, p_def, p_count, p_ql, p_x, p_y, p_extra);
  if v <> '' then perform set_config('wurm.made', v, true); end if;
end $fn$;

/** Each [def, count] onto a day's ledger (`ledger_add`), no goes. */
create or replace function private.ledger_add_made(l jsonb, p_day int, p_made jsonb) returns jsonb language plpgsql immutable as $fn$
declare v jsonb := l; e jsonb;
begin
  for e in select * from jsonb_array_elements(coalesce(p_made, '[]'::jsonb)) loop
    v := ledger_add(v, p_day, 0, 0, e->>0, (e->>1)::int);
  end loop;
  return v;
end $fn$;

/** Each [def, count] onto the line to its keeper as stored (`did_add`). */
create or replace function private.did_add_made(p_did jsonb, p_made jsonb) returns jsonb language plpgsql immutable as $fn$
declare v jsonb := p_did; e jsonb;
begin
  for e in select * from jsonb_array_elements(coalesce(p_made, '[]'::jsonb)) loop
    v := did_add(v, 'stored', e->>0, (e->>1)::int);
  end loop;
  return v;
end $fn$;

revoke all on function private.worker_made_take(), private.errand_go_made(uuid, int),
  private.worker_put_back(uuid, creature, text, int, double precision, int, int, text),
  private.ledger_add_made(jsonb, int, jsonb), private.did_add_made(jsonb, jsonb) from public, anon, authenticated;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- Noted while a go is being counted; one setting read otherwise.
    (1, 'worker_put(uuid,creature,text,integer,double precision,integer,integer,text)'::regprocedure, 1,
     $$begin
  for v_at in$$,
     $$begin
  -- An errand's go being counted (`private.errand_go_made`): this put is what it made (made log).
  if coalesce(current_setting('wurm.made', true), '') <> '' then
    perform set_config('wurm.made', (current_setting('wurm.made')::jsonb || jsonb_build_array(jsonb_build_array(p_def, p_count)))::text, true);
  end if;
  for v_at in$$),
    -- A load carried back into the stores: counted as what left its arms, not as made.
    (2, 'errand_do(uuid,integer,boolean)'::regprocedure, 5,
     $$perform worker_put(p_world, c, c.carrying->>'def',$$,
     $$perform private.worker_put_back(p_world, c, c.carrying->>'def',$$),
    (3, 'errand_do(uuid,integer,boolean)'::regprocedure, 1,
     $$perform worker_put(p_world, c, v_def, coalesce((c.carrying->>'count')::int, 1),$$,
     $$perform private.worker_put_back(p_world, c, v_def, coalesce((c.carrying->>'count')::int, 1),$$),
    -- What a recipe hands back: not what it made.
    (4, 'errand_do(uuid,integer,boolean)'::regprocedure, 5,
     $$perform worker_put(p_world, c, ri.item, ri.count, 40, c.work_x, c.work_y);$$,
     $$perform private.worker_put_back(p_world, c, ri.item, ri.count, 40, c.work_x, c.work_y);$$),
    -- And the go's made, counted with it.
    (5, 'worker_settle(uuid,integer)'::regprocedure, 1,
     $$v_did jsonb; v_tire int;$$,
     $$v_did jsonb; v_tire int; v_put jsonb; -- made log$$),
    (6, 'worker_settle(uuid,integer)'::regprocedure, 1,
     $$        v_held := c.carrying;
        if errand_go(p_world, p_id) then
          done := done + 1;
          select * into c from creature where world_id = p_world and id = p_id;
          v_left := case when c.carrying->>'def' = v_held->>'def' then coalesce((c.carrying->>'count')::int, 1) else 0 end;
          c.ledger := ledger_add(c.ledger, v_day, 1, 0, v_held->>'def',
                                 greatest(0, coalesce((v_held->>'count')::int, 1) - v_left));
          v_did := did_add(v_did, 'handled', v_held->>'def', greatest(0, coalesce((v_held->>'count')::int, 1) - v_left));
$$,
     $$        v_held := c.carrying;
        if private.errand_go_made(p_world, p_id) then
          done := done + 1;
          v_put := private.worker_made_take();
          select * into c from creature where world_id = p_world and id = p_id;
          v_left := case when c.carrying->>'def' = v_held->>'def' then coalesce((c.carrying->>'count')::int, 1) else 0 end;
          c.ledger := ledger_add(c.ledger, v_day, 1, 0, v_held->>'def',
                                 greatest(0, coalesce((v_held->>'count')::int, 1) - v_left));
          v_did := did_add(v_did, 'handled', v_held->>'def', greatest(0, coalesce((v_held->>'count')::int, 1) - v_left));
          -- And what it put into the stores as its work (`worker_put`): made in place.
          c.ledger := private.ledger_add_made(c.ledger, v_day, v_put);
          v_did := private.did_add_made(v_did, v_put);
$$)
  ) as t(ord, fn, times, old, new) order by ord loop
    v_def := pg_get_functiondef(r.fn);
    continue when position(r.new in v_def) > 0;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.times then raise exception '% has % of change %, not %', r.fn, v_n, r.ord, r.times; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
