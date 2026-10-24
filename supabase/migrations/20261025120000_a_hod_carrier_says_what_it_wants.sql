-- A hod carrier says what the work in its range wants that the stores do not hold, and puts back what none of it wants.
--
-- Seen on the island: three hod carriers idle with `range` ("no planned building work within 30 tiles"), nine floors
-- a storey up within that range wanting marble brick and a wall wanting glass, and the stores holding neither. And
-- one of them holding four mortar none of that work wanted, which it kept holding.
--
--   * Work within reach wanting only what the stores do not hold is `stock`, with what it wants (`idle_what`, the
--     first `idle_wants` of them, nearest the token first, then by name) and how many things that is (`idle_n`):
--     "Idle: no marble brick or glass in your settlement stores." `range` is now only no such work within reach at
--     all (`hod_wanted`).
--   * A piece in its arms that nothing within reach wants goes back to the nearest store with room for it
--     (`worker_store`, `worker_put`), as a herdsman's bucket does, before anything else is fetched. Before, it held it;
--     and when it went to fetch something else, what it held was written over and lost.
--
-- The browser's `hodStep`, `Game.hodWanted` and `idleSays` do the same.

set local lock_timeout = '3s';

alter table creature add column if not exists idle_what text[];

-- How many of what work in range wants a `stock` reason names: the browser's `IDLE_WANTS`.
create or replace function idle_wants() returns int language sql immutable as $fn$ select 3 $fn$;

-- Everything planned work within `p_range` of (p_cx, p_cy) still wants, whether the stores hold it or not: the first
-- `idle_wants` things, each once, nearest the work wanting it first and then by name, and how many things there are.
-- The browser's `Game.hodWanted`.
create or replace function hod_wanted(p_world uuid, p_cx int, p_cy int, p_range int)
  returns table (items text[], n int) language sql stable as $fn$
  with each_ as (
    select e.key as item, min((w.x - p_cx) ^ 2 + (w.y - p_cy) ^ 2) as d
    from hod_work(p_world, p_cx, p_cy, p_range) w cross join lateral jsonb_each_text(w.needed) e
    where e.value::int > 0
    group by e.key
  )
  select (array_agg(item order by d, item collate "C"))[1:idle_wants()], count(*)::int from each_
$fn$;

-- What a hod carrier finds to run: the piece in hand to the work wanting it; a piece nothing wants back to the stores;
-- else the nearest work the stores can feed; else why not, and what the work wants (`why_what`).
do $do$
declare v_def text; n int;
  v_ret_old text := 'RETURNS TABLE(gx double precision, gy double precision, want text, wx integer, wy integer, why text, why_n double precision)';
  v_ret_new text := 'RETURNS TABLE(gx double precision, gy double precision, want text, wx integer, wy integer, why text, why_n double precision, why_what text[])';
  v_old text := $a$  elsif kind = 'hod' then
    -- Carrying a piece some work within reach still wants: that work. Otherwise the nearest work wanting something
    -- the stores hold, and the store nearest it holding that, crates and furniture alike (`hod_needing_stocked`).
    select * into v_job from hod_needing(p_world, dd.x, dd.y, rng, c.carrying->>'def');
    if c.carrying is null or v_job.item is distinct from c.carrying->>'def' then
      select * into v_job from hod_needing_stocked(p_world, c.keeper, dd.x, dd.y, rng);
      if v_job.item is null then why := 'range'; why_n := rng; return next; return; end if;
$a$;
  v_new text := $a$  elsif kind = 'hod' then
    -- Carrying a piece some work within reach still wants: that work. Otherwise the nearest work wanting something
    -- the stores hold, and the store nearest it holding that, crates and furniture alike (`hod_needing_stocked`).
    select * into v_job from hod_needing(p_world, dd.x, dd.y, rng, c.carrying->>'def');
    -- A piece in its arms nothing within reach wants: back to the nearest store with room for it, first.
    if c.carrying is not null and v_job.item is distinct from c.carrying->>'def' then
      select * into v_spot from worker_store(p_world, c, c.carrying->>'def', coalesce((c.carrying->>'count')::int, 1));
      if v_spot.id is null then why := 'full'; why_n := null; return next; return; end if;
      gx := v_spot.cx; gy := v_spot.cy; want := null; wx := floor(v_spot.cx)::int; wy := floor(v_spot.cy)::int;
      return next;
      return;
    end if;
    if c.carrying is null then
      select * into v_job from hod_needing_stocked(p_world, c.keeper, dd.x, dd.y, rng);
      if v_job.item is null then
        -- Work within reach wanting only what the stores do not hold: `stock`, and what it wants. None: `range`.
        select * into v_wet from hod_wanted(p_world, dd.x, dd.y, rng);
        if coalesce(v_wet.n, 0) > 0 then why := 'stock'; why_n := v_wet.n; why_what := v_wet.items;
        else why := 'range'; why_n := rng; end if;
        return next;
        return;
      end if;
$a$;
begin
  select pg_get_functiondef('public.errand_step(uuid,integer)'::regprocedure) into v_def;
  n := (length(v_def) - length(replace(v_def, v_ret_old, ''))) / length(v_ret_old);
  if n <> 1 then raise exception 'errand_step has % of its returns, not 1', n; end if;
  n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if n <> 1 then raise exception 'errand_step has % of its hod branch, not 1', n; end if;
  v_def := replace(replace(v_def, v_ret_old, v_ret_new), v_old, v_new);
  drop function errand_step(uuid, integer);
  execute v_def;
end $do$;

-- At the store it walked to, the piece nothing within reach wants goes in.
do $do$
declare v_def text; n int;
  v_old text := $a$    select * into v_job from hod_needing(p_world, c.work_x, c.work_y, 0, c.carrying->>'def');
    if v_job.item is null or v_job.item is distinct from c.carrying->>'def' then return false; end if;
$a$;
  v_new text := $a$    select * into v_job from hod_needing(p_world, c.work_x, c.work_y, 0, c.carrying->>'def');
    if v_job.item is null or v_job.item is distinct from c.carrying->>'def' then
      -- Nothing within reach wants it (`errand_step`): into the store it walked to, or the nearest with room.
      if p_again then return false; end if;
      select * into v_job from my_deed(p_world, c.keeper) md where md.world_id is not null;
      if not found then return false; end if;
      if (select h.item from hod_needing(p_world, v_job.x, v_job.y, work_range(c), c.carrying->>'def') h) is not null then
        return false;
      end if;
      perform worker_put(p_world, c, c.carrying->>'def', coalesce((c.carrying->>'count')::int, 1),
                         (c.carrying->>'ql')::double precision, c.work_x, c.work_y, c.carrying->>'extra');
      update creature set carrying = null where world_id = p_world and id = p_id;
      return true;
    end if;
$a$;
begin
  select pg_get_functiondef('public.errand_do(uuid,integer,boolean)'::regprocedure) into v_def;
  n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if n <> 1 then raise exception 'errand_do has % of the hod fit, not 1', n; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

-- The settle loop keeps what it wants with the reason: cleared with every reason it sets, set from the errand's.
do $do$
declare v_def text; n int;
begin
  select pg_get_functiondef('public.worker_settle'::regproc) into v_def;
  n := (length(v_def) - length(replace(v_def, 'c.idle_why := ', ''))) / length('c.idle_why := ');
  if n < 20 then raise exception 'worker_settle has % reasons set, fewer than expected', n; end if;
  v_def := replace(v_def, 'c.idle_why := ', 'c.idle_what := null; c.idle_why := ');
  n := (length(v_def) - length(replace(v_def, 'c.idle_what := null; c.idle_why := step.why;', '')))
       / length('c.idle_what := null; c.idle_why := step.why;');
  if n <> 1 then raise exception 'worker_settle has % of the errand''s reason, not 1', n; end if;
  v_def := replace(v_def, 'c.idle_what := null; c.idle_why := step.why;', 'c.idle_what := step.why_what; c.idle_why := step.why;');
  n := (length(v_def) - length(replace(v_def, 'idle_why = c.idle_why,', ''))) / length('idle_why = c.idle_why,');
  if n < 4 then raise exception 'worker_settle writes the reason % times, fewer than expected', n; end if;
  v_def := replace(v_def, 'idle_why = c.idle_why,', 'idle_why = c.idle_why, idle_what = c.idle_what,');
  execute v_def;
end $do$;

-- And the browser is told, with `stock` only.
do $do$
declare v_def text; n int;
  v_old text := $a$else jsonb_build_object('idleWhy', c.idle_why, 'idleN', c.idle_n, 'idlePost', c.post is not null) end$a$;
  v_new text := $a$else jsonb_build_object('idleWhy', c.idle_why, 'idleN', c.idle_n, 'idlePost', c.post is not null,
                'idleWhat', case when c.idle_why = 'stock' then to_jsonb(c.idle_what) end) end$a$;
begin
  select pg_get_functiondef('public.rpc_creatures'::regproc) into v_def;
  n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if n <> 1 then raise exception 'rpc_creatures has % of the reason, not 1', n; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();
