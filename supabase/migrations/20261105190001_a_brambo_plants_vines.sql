/*
 * A brambo plants vines.
 *
 * Asked for: "Planting vines should go to bramba". The rootle is gone (`20261105190000_the_rootle_is_gone.sql`), and its
 * task (`vine`) is the brambo's alongside its own (`bush`), as a stoker took up the smelters
 * (`20261026230000_a_stoker_burns_tar_first_and_works_the_smelters.sql`). From `bush_vines_at()` (every stage), with
 * nothing to pick in its reach (`find_work_tile` empty), a bush picker goes for the vine planter's errand: grape cuttings
 * out of the stores, its stage's a trip, one planted at the foot of each trellis of yours with no vine (`errand_step` and
 * `errand_do` asked for `vine`). While it holds a cutting, or walks to the stores for one (`fetching`), it is on that
 * errand. Holding one with no trellis left for it, it carries them back to the stores. The browser's `BUSH_VINES_AT` and
 * `otherErrand`.
 *
 * `errand_go` and `private.errand_go_made` take the trade to work as, by name (`p_kind`), as `errand_step` and
 * `errand_do` already do, and default to the species' own as before.
 */
set local lock_timeout = '3s';

create or replace function pg_temp.patch_fn(p_sig regprocedure, p_old text, p_new text, p_times int default 1) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_times then
    raise exception '%: % of "%", wanted %', p_sig, v_n, left(p_old, 120), p_times;
  end if;
  execute replace(v_def, p_old, p_new);
end $p$;

-- What the definitions write, here until they do, so the functions below have it to call.
create or replace function bush_vines_at() returns int language sql immutable as $fn$ select 0 $fn$;

-- A go at an errand of a trade asked for by name (`p_kind`): the vine planter's for a brambo.
do $do$
declare v_def text;
begin
  if to_regprocedure('errand_go(uuid,integer)') is not null then
    v_def := pg_get_functiondef('errand_go(uuid,integer)'::regprocedure);
    v_def := replace(v_def, 'errand_go(p_world uuid, p_id integer)', 'errand_go(p_world uuid, p_id integer, p_kind text DEFAULT NULL::text)');
    v_def := replace(v_def, 'if not errand_do(p_world, p_id) then', 'if not errand_do(p_world, p_id, false, p_kind) then');
    v_def := replace(v_def, 'exit when not errand_do(p_world, p_id, true);', 'exit when not errand_do(p_world, p_id, true, p_kind);');
    v_def := replace(v_def, 'v_kind := (select sd.gathers from species_def sd where sd.id = c.species);',
                            'v_kind := coalesce(p_kind, (select sd.gathers from species_def sd where sd.id = c.species));');
    if v_def not like '%errand_do(p_world, p_id, false, p_kind)%' or v_def not like '%errand_do(p_world, p_id, true, p_kind)%'
       or v_def not like '%coalesce(p_kind, (select sd.gathers%' then
      raise exception 'errand_go is not as this migration knows it';
    end if;
    execute v_def;
    drop function errand_go(uuid, integer);
  end if;
  if to_regprocedure('private.errand_go_made(uuid,integer)') is not null then
    v_def := pg_get_functiondef('private.errand_go_made(uuid,integer)'::regprocedure);
    v_def := replace(v_def, 'errand_go_made(p_world uuid, p_id integer)', 'errand_go_made(p_world uuid, p_id integer, p_kind text DEFAULT NULL::text)');
    v_def := replace(v_def, 'v := errand_go(p_world, p_id);', 'v := errand_go(p_world, p_id, p_kind);');
    if v_def not like '%errand_go(p_world, p_id, p_kind)%' then
      raise exception 'private.errand_go_made is not as this migration knows it';
    end if;
    execute v_def;
    drop function private.errand_go_made(uuid, integer);
  end if;
end $do$;

-- Whether it is on the vine errand, worked out at each step.
select pg_temp.patch_fn('public.worker_settle(uuid,integer)'::regprocedure,
  $o$        v_lv int; v_once int; v_routed boolean := true; -- storeys$o$,
  $n$        v_lv int; v_once int; v_routed boolean := true; -- storeys
        v_vine boolean := false; -- a bush picker planting vines$n$);

select pg_temp.patch_fn('public.worker_settle(uuid,integer)'::regprocedure,
  $o$    for v_once in 1..1 loop
$o$,
  $n$    for v_once in 1..1 loop
    /*
     * A bush picker from `bush_vines_at()` on: on the vine planter's errand while it holds grape cuttings with a trellis
     * for them, or walks to the stores for them (`fetching`). Holding them with no trellis left, back to the stores.
     */
    v_vine := false;
    if kind = 'bush' and c.phase <> 'home' and stage_of(c) >= bush_vines_at() then
      if c.fetching = grape_cutting_item() and c.phase in ('out', 'work') then
        v_vine := true;
      elsif coalesce(c.carrying->>'def' = grape_cutting_item(), false) then
        v_vine := c.phase in ('out', 'work') or (vine_target(p_world, c, cx, cy)).id is not null;
        if not v_vine and c.phase = 'idle' then
          select * into v_store from worker_store(p_world, c, c.carrying->>'def', coalesce((c.carrying->>'count')::int, 1));
          if v_store.id is null then
            perform worker_nowhere(p_world, c); c.idle_what := null; c.idle_why := 'full'; c.idle_n := null;
            c.until := now() + interval '30 seconds';
            exit settle;
          end if;
          dist := sqrt((v_store.cx - cx) ^ 2 + (v_store.cy - cy) ^ 2);
          c.fetching := null;
          c.from_x := cx; c.from_y := cy; c.to_x := v_store.cx; c.to_y := v_store.cy;
          c.leg_at := c.until;
          c.leg_ends := c.leg_at + make_interval(secs => greatest(0.2, dist / greatest(0.1, pace)));
          c.until := c.leg_ends;
          c.phase := 'home';
          continue;
        end if;
      end if;
    end if;
    if kind = 'bush' and not v_vine and c.fetching is not null then c.fetching := null; end if;
$n$);

select pg_temp.patch_fn('public.worker_settle(uuid,integer)'::regprocedure,
  $o$    if worker_errand(kind) then$o$,
  $n$    if worker_errand(kind) or v_vine then$n$);

select pg_temp.patch_fn('public.worker_settle(uuid,integer)'::regprocedure,
  $o$private.errand_go_made(p_world, p_id)$o$,
  $n$private.errand_go_made(p_world, p_id, case when v_vine then 'vine' end)$n$);

select pg_temp.patch_fn('public.worker_settle(uuid,integer)'::regprocedure,
  $o$errand_step(p_world, p_id);$o$,
  $n$errand_step(p_world, p_id, case when v_vine then 'vine' end);$n$);

-- Nothing to pick in its reach: the vine planter's errand, before it stands about.
select pg_temp.patch_fn('public.worker_settle(uuid,integer)'::regprocedure,
  $o$      if spot.x is null and c.carrying is not null then
$o$,
  $n$      if spot.x is null and kind = 'bush' and c.carrying is null and stage_of(c) >= bush_vines_at() then
        -- Everything the errand asks about is on the row, so the row goes down before it is asked.
        update creature set from_x = c.from_x, from_y = c.from_y, to_x = c.to_x, to_y = c.to_y, carrying = c.carrying,
            storey = c.storey
          where world_id = p_world and id = p_id;
        select * into step from errand_step(p_world, p_id, 'vine');
        if step.gx is not null then
          c.work_x := step.wx; c.work_y := step.wy;
          c.idle_since := null; c.idle_what := null; c.idle_why := null; c.idle_n := null;
          c.fetching := coalesce(step.want, grape_cutting_item());
          v_lv := step.gl;
          dist := sqrt((step.gx - cx) ^ 2 + (step.gy - cy) ^ 2);
          c.from_x := cx; c.from_y := cy; c.to_x := step.gx; c.to_y := step.gy;
          c.leg_at := c.until;
          c.leg_ends := c.leg_at + make_interval(secs => greatest(0.2, dist / greatest(0.1, pace)));
          c.until := c.leg_ends;
          c.phase := 'out';
          continue;
        end if;
      end if;
      if spot.x is null and c.carrying is not null then
$n$);

select private.lock_doors();
