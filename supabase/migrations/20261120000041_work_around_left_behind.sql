-- Work around me: a worker round you left behind comes to you.
--
-- Reported: a Sapgnaw working round its keeper, "Idle: walking to you, 98 tiles away", for good. Off its ground it
-- walked after its keeper two tiles a leg in a straight line (`chase_leg`), and with nothing open that way (water, a
-- wall, a cliff, its keeper out in a boat) it stood and looked again every four seconds, still working round them,
-- for as long as they stayed online.
--
-- Now, off its ground (`home_slack` past its range) and either more than `around_leash` tiles from its keeper or with
-- no leg open toward them: on its keeper's tile, or the nearest tile it may stand on within `pier_shoo` of it, idle
-- and working on (`around_catch_up`), as a follower at heel is; with neither, Work around me stops (`around_left`) and
-- it follows them (`around_end`). The browser's `AROUND_LEASH`, `AROUND_LEFT` and `catchUp`.

set local lock_timeout = '3s';

create or replace function around_leash() returns double precision language sql immutable as $fn$ select 40::double precision $fn$;
create or replace function around_left() returns text language sql immutable as $fn$ select 'Work around me stopped (left behind)'::text $fn$;

-- Where a worker round its keeper left behind is put: their tile if it may stand there, else the nearest it may within
-- `pier_shoo` of it (`pier_shoo_to`); null with neither, or no keeper.
create or replace function around_catch_up(p_world uuid, p_uid uuid, out x double precision, out y double precision)
returns record language plpgsql stable as $fn$
declare pl player; v_to record;
begin
  select * into pl from player where world_id = p_world and uid = p_uid;
  if pl.uid is null then return; end if;
  if creature_tile_ok(p_world, floor(pl.x)::int, floor(pl.y)::int) then
    x := pl.x; y := pl.y;
    return;
  end if;
  select * into v_to from pier_shoo_to(p_world, floor(pl.x)::int, floor(pl.y)::int);
  if v_to.x is not null then x := v_to.x + 0.5; y := v_to.y + 0.5; end if;
end $fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    ('public', 'worker_settle', 1,
     $$        v_hy_tried boolean := false; -- a hybrid that has looked for its second trade's work$$,
     $$        v_hy_tried boolean := false; -- a hybrid that has looked for its second trade's work
        v_behind boolean; v_lost boolean := false; -- round its keeper and left behind (`around_leash`)$$),
    ('public', 'worker_settle', 1,
     $$      c.idle_what := null; c.idle_why := 'far'; c.idle_n := dist;
      select * into v_step from chase_leg(p_world, cx, cy,
        cx + (v_site.x + 0.5 - cx) * home_leg() / dist, cy + (v_site.y + 0.5 - cy) * home_leg() / dist);
      if v_step.x is null then$$,
     $$      c.idle_what := null; c.idle_why := 'far'; c.idle_n := dist;
      -- Round its keeper, past `around_leash` of them: no walk after them, left behind.
      v_behind := c.around is not null and dist > around_leash();
      if not v_behind then
        select * into v_step from chase_leg(p_world, cx, cy,
          cx + (v_site.x + 0.5 - cx) * home_leg() / dist, cy + (v_site.y + 0.5 - cy) * home_leg() / dist);
        -- Or with no leg open toward them.
        v_behind := c.around is not null and v_step.x is null;
      end if;
      if v_behind then
        -- Beside them, idle and working on (`around_catch_up`); nowhere beside them to stand: following them.
        select * into v_step from around_catch_up(p_world, c.keeper);
        if v_step.x is null then
          -- After its row is written, below.
          v_lost := true;
          exit settle;
        end if;
        c.from_x := v_step.x; c.from_y := v_step.y; c.to_x := v_step.x; c.to_y := v_step.y;
        c.storey := 0; c.storey_from := 0;
        c.leg_at := c.until; c.leg_ends := c.until;
        c.idle_what := null; c.idle_why := null; c.idle_n := null;
        continue;
      end if;
      if v_step.x is null then$$),
    ('public', 'worker_settle', 1,
     $$  if v_did is not null and c.keeper is not null then perform wtell(p_world, c.keeper, work_done_line(c.name, v_did)); end if;$$,
     $$  if v_did is not null and c.keeper is not null then perform wtell(p_world, c.keeper, work_done_line(c.name, v_did)); end if;
  -- Left behind with nowhere beside its keeper to stand: following them (`around_end`).
  if v_lost then perform around_end(p_world, p_id, around_left()); end if;$$)
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
