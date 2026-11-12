-- A wildermon in a crate: everything about it held as it went in but its age, and settled once an island day.
--
-- Asked for: "Players are almost certainly going to amass crated creatures. When crated, everything except ages should
-- freeze, and age only ticks once daily." A crated one was settled every ten seconds (`stored_settle`) like one at
-- heel: hungry, mending, its care fading, its fleece growing, fed from the stores, put where its crate was, and so
-- written and sent to its keeper's browser every ten seconds, for every crate they own.
--
--   In a crate (`creature_settle`): nothing but where its crate is, once an island day (`stored_settle`, `day_seconds`).
--     Its age is counted from its birth (`age_row`), so it goes on.
--   Its hunger, health, care, fleece and lessons are held: none of it is reckoned while it is in, and the time in the
--     crate is not reckoned when it comes out (`settled_at`, set as it leaves).
--   What runs on a clock is held too: a pregnancy, a meal's bonus, a bleed and a slow have the time it spent in the
--     crate added to them as it comes out (`stored_at`, the time it went in); and none is born in a crate (`herd_settle`).
--   Its keeper's browser is not sent it again on every read for its panniers, which it cannot be asked for in a crate.

set local lock_timeout = '3s';

alter table creature add column if not exists stored_at timestamptz;
update creature set stored_at = now() where mode = 'stored' and stored_at is null;

/** How often a wildermon in a crate is settled: once an island day. */
create or replace function public.stored_settle() returns double precision
language sql immutable as $fn$ select day_seconds() $fn$;

create or replace function private.creature_stored_rests() returns trigger
language plpgsql as $fn$
declare v_held interval;
begin
  if new.mode = 'stored' then
    new.post := null;
    new.around := null;
    if tg_op = 'INSERT' or old.mode is distinct from 'stored' then new.stored_at := now(); end if;
  elsif tg_op = 'UPDATE' and old.mode = 'stored' then
    -- Out of the crate: the clocks it carries take up where they stopped, and its body from now.
    v_held := greatest(interval '0', now() - coalesce(old.stored_at, now()));
    new.due := new.due + v_held;
    new.fed_until := new.fed_until + v_held;
    new.bleed_until := new.bleed_until + v_held;
    new.slow_until := new.slow_until + v_held;
    new.settled_at := now();
    new.stored_at := null;
  end if;
  return new;
end $fn$;
revoke all on function private.creature_stored_rests() from public, anon, authenticated;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    ('public', 'creature_settle', 1,
     $$  c0 := c;
$$,
     $$  c0 := c;
  -- In a crate: nothing but where the crate is, once an island day. Its age is counted from its birth (`age_row`).
  if c.mode = 'stored' then
    select pl.cx as x, pl.cy as y into home from placed pl where pl.world_id = p_world and pl.creature = p_id limit 1;
    if not found then
      select py.x, py.y into home from player py where py.world_id = p_world and py.uid = c.keeper;
    end if;
    update creature set
        from_x = coalesce(home.x, c.to_x), from_y = coalesce(home.y, c.to_y),
        to_x = coalesce(home.x, c.to_x), to_y = coalesce(home.y, c.to_y),
        leg_at = now(), leg_ends = now(), until = now() + make_interval(secs => stored_settle()), settled_at = now()
      where world_id = p_world and id = p_id;
    return true;
  end if;
$$),
    ('public', 'herd_settle', 1,
     $$where world_id = p_world and due is not null and due <= now()$$,
     $$where world_id = p_world and due is not null and due <= now() and mode <> 'stored'$$),
    ('public', 'rpc_creatures', 1,
     $$        or (c.keeper is not null and c.species = any (array(select d.id from species_def d where d.panniers is not null)))),$$,
     $$        or (c.keeper is not null and c.mode <> 'stored' and c.species = any (array(select d.id from species_def d where d.panniers is not null)))),$$)
  ) as t(sch, fn, times, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = r.sch and p.proname = r.fn;
    if v_def is null then raise exception '%.% is not on this island', r.sch, r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.times then raise exception '%.% has % of the lines to change, not %', r.sch, r.fn, v_n, r.times; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
