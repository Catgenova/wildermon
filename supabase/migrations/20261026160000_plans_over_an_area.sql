/*
 * Plans over an area, and the last plan taken back.
 *
 * Asked for: "previews for multi-tile plans (ghost of the whole plan before
 * committing), cost totals before you commit (sum of every material across
 * the plan, against what you carry/store), undo for a misplaced plan
 * (cancel/remove a plan just placed, refunding anything already delivered per
 * the island's existing rules)".
 *
 * The browser lays a plan out over a whole storey's walls, a whole storey's
 * floor, a whole roof or a footprint's rectangle, and draws it before it is
 * asked for (`src/game/planarea.ts`). `rpc_plan_area` is asked for the
 * pieces that pass, up to `plan_area_most()`, in one call:
 *
 *   * each is a plan a single click asks for -- `plan_wall`, `plan_fence`,
 *     `plan_floor`, `plan_building`, `add_to_building` -- and is asked of
 *     `act_refusal` and done by `act_perform`, with the go's perks and its
 *     storey set as `settle` sets them for a go; the wind of one plan is
 *     spent for the lot (`spend_wind`), so a plan is never refused half way
 *     for the wind it would take;
 *   * the body has to be within the job's reach of one piece of it, as it
 *     would to plan that piece alone; for the rest the reach a single plan
 *     asks is waived (`private.area_reach`) and the ceiling every job keeps
 *     (`private.reach_most`) still holds;
 *   * a piece refused is left out, and counted; the lines each plan would
 *     tell are held back and one is told for the lot (`private.hushed`).
 *
 * The plans a body makes, a single click's or a whole area's, are kept as
 * its last plan (`private.plan_undo`): every plan done in the one
 * transaction is one plan, and the next replaces it. `rpc_plan_undo` takes
 * it back within `plan_undo_seconds()`: every piece of it still there and
 * still planned by that body, last first, by the job that takes one down by
 * hand -- `remove_wall`, `remove_floor`, `remove_from_plan` -- each asked of
 * `act_refusal` and done by `act_perform`. So what a piece gives back is
 * what taking it down by hand gives back: a Mason's Salvage share of the
 * stone laid in a wall, and nothing else, as everywhere on the island.
 */
set local lock_timeout = '3s';

/** The most pieces one plan over an area asks for: the browser's `PLAN_AREA_MOST`. */
create or replace function plan_area_most() returns int language sql immutable as $fn$ select 64 $fn$;
/** How long the last plan stays to be taken back, in seconds: the browser's `PLAN_UNDO_SECONDS`. */
create or replace function plan_undo_seconds() returns int language sql immutable as $fn$ select 300 $fn$;

/** The plans a plan over an area is made of, and the single plans kept to undo. */
create or replace function private.area_plan_job(p_action text) returns boolean language sql immutable as $fn$
  select p_action in ('plan_wall', 'plan_fence', 'plan_floor', 'plan_building', 'add_to_building')
$fn$;

/** The job that takes a plan's piece down by hand. */
create or replace function private.undo_job(p_action text) returns text language sql immutable as $fn$
  select case p_action when 'plan_wall' then 'remove_wall' when 'plan_fence' then 'remove_wall'
                       when 'plan_floor' then 'remove_floor' else 'remove_from_plan' end
$fn$;

/**
 * Whether a job's reach is waived just now: a plan of an area's, or a piece of the last plan taken back, while
 * `rpc_plan_area` or `rpc_plan_undo` has it so. Every other job, and these anywhere else, reach as they always did.
 */
create or replace function private.area_reach(p_action text) returns boolean language sql stable as $fn$
  select coalesce(current_setting('wurm.area', true), '') = 'on'
     and (private.area_plan_job(p_action) or p_action in ('remove_wall', 'remove_floor', 'remove_from_plan'))
$fn$;

/** Whether the lines a job tells are held back just now: each piece of a plan over an area, said once for the lot. */
create or replace function private.hushed() returns boolean language sql stable as $fn$
  select coalesce(current_setting('wurm.hush', true), '') = 'on'
$fn$;

/** A body's last plan: the pieces it planned in one transaction, to take back within `plan_undo_seconds()`. */
create table if not exists private.plan_undo (
  world_id uuid not null references public.world (id) on delete cascade,
  uid uuid not null,
  at timestamptz not null default now(),
  txid bigint not null,
  pieces jsonb not null default '[]'::jsonb,
  primary key (world_id, uid)
);
alter table private.plan_undo enable row level security;
revoke all on table private.plan_undo from public, anon, authenticated;

/**
 * A plan of a body's, kept as its last: added to the plan made in this
 * transaction, or the start of a new one. Called by `act_perform` as each plan
 * is done, a single click's or a piece of an area's.
 */
create or replace function private.plan_note(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns void
language plpgsql as $fn$
begin
  if p_uid is null or not private.area_plan_job(p_action) then return; end if;
  insert into private.plan_undo as u (world_id, uid, at, txid, pieces)
    values (p_world, p_uid, now(), txid_current(), jsonb_build_array(jsonb_build_object('action', p_action, 'target', p_target)))
  on conflict (world_id, uid) do update
    set pieces = case when u.txid = excluded.txid then u.pieces || excluded.pieces else excluded.pieces end,
        at = excluded.at, txid = excluded.txid;
end $fn$;

/** Whether a piece of a body's last plan is still there, and still its own plan: nobody else's since. */
create or replace function private.plan_still_mine(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns boolean
language plpgsql stable as $fn$
declare v_x int := (p_target->>'x')::int; v_y int := (p_target->>'y')::int; v_w wall; v_b int; v_kind text;
begin
  if p_action in ('plan_wall', 'plan_fence') then
    v_w := frame_wall_at(p_world, v_x, v_y, p_target->>'side', p_target);
    return v_w.world_id is not null and v_w.planned_by is not distinct from p_uid;
  elsif p_action = 'plan_floor' then
    v_b := coalesce(building_at(p_world, v_x, v_y), nullif(p_target->>'buildingId', '')::int);
    if v_b is null then return false; end if;
    v_kind := coalesce(p_target->>'floorKind', 'floor');
    return exists (select 1 from floor_tile f where f.world_id = p_world and f.x = v_x and f.y = v_y
                     and f.level = frame_floor_level(p_world, v_b, v_kind, p_target) and f.planned_by is not distinct from p_uid);
  end if;
  return building_at(p_world, v_x, v_y) is not null;
end $fn$;

/** One job done as `settle` does a go: the go's perks, its storey and whose go it is set for it. */
create or replace function private.area_go(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns void
language plpgsql as $fn$
declare p player;
begin
  select * into p from player where world_id = p_world and uid = p_uid;
  perform set_config('wurm.pk', coalesce(p.class_mul->'fx', '{}'::jsonb)::text, true);
  perform set_config('wurm.pk_act', p_action, true);
  perform set_config('wurm.floor', floor_said(p_world, p.level, p.x, p.y), true);
  perform set_config('wurm.source', 'act:' || p_action, true);
  perform set_config('wurm.uid', p_uid::text, true);
  perform set_config('wurm.go_at', extract(epoch from now())::text, true);
  perform act_perform(p_world, p_uid, p_action, p_target);
  perform set_config('wurm.source', '', true);
  perform set_config('wurm.uid', '', true);
  perform set_config('wurm.go_at', '', true);
  perform set_config('wurm.pk', '', true);
  perform set_config('wurm.pk_act', '', true);
  perform set_config('wurm.floor', '', true);
end $fn$;

/** What a count of a plan's pieces is called: "12 walls", "1 roof tile". */
create or replace function private.plan_count_word(p_action text, p_target jsonb, p_n int) returns text
language sql immutable as $fn$
  select p_n || ' ' || case
    when p_action in ('plan_wall', 'plan_fence') then case when p_n = 1 then 'wall' else 'walls' end
    when p_action = 'plan_floor' and p_target->>'floorKind' = 'roof' then case when p_n = 1 then 'roof tile' else 'roof tiles' end
    when p_action = 'plan_floor' then case when p_n = 1 then 'floor tile' else 'floor tiles' end
    else case when p_n = 1 then 'tile' else 'tiles' end end
$fn$;

/**
 * A plan over an area: up to `plan_area_most()` single plans in one call,
 * `[{"action": ..., "target": {...}}, ...]`. Refused whole when the body is
 * within reach of none of them, or the first a single click would be refused
 * for something else; otherwise each is planned or left out by its own
 * refusal, and how many of each is said once.
 */
create or replace function rpc_plan_area(p_world uuid, p_asks jsonb) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid(); p player; a jsonb; why text; first_why text; v_done int := 0; v_refused int := 0;
        v_near boolean := false; v_d action_def; v_was_area text; v_was_hush text; v_line text;
begin
  if me is null then raise exception 'not signed in'; end if;
  if jsonb_typeof(p_asks) is distinct from 'array' or jsonb_array_length(p_asks) not between 1 and plan_area_most() then
    perform private.bad_request('rpc_plan_area', 'p_asks: 1 to ' || plan_area_most() || ' plans');
  end if;
  if exists (select 1 from jsonb_array_elements(p_asks) e
              where jsonb_typeof(e) is distinct from 'object' or not private.area_plan_job(e->>'action')
                 or jsonb_typeof(e->'target') is distinct from 'object' or e->'target'->>'kind' is distinct from 'tile'
                 or jsonb_typeof(e->'target'->'x') is distinct from 'number' or jsonb_typeof(e->'target'->'y') is distinct from 'number') then
    perform private.bad_request('rpc_plan_area', 'p_asks: plans of tiles only');
  end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  perform settle(p_world, me);
  select * into p from player where world_id = p_world and uid = me;
  if not found then raise exception 'not on this island'; end if;
  -- From beside a piece of it, as a single plan is planned.
  for a in select e from jsonb_array_elements(p_asks) e loop
    select * into v_d from action_def where id = a->>'action';
    if in_reach(p.x, p.y, a->'target', coalesce(v_d.corner, false), v_d.range) then v_near := true; exit; end if;
  end loop;
  if not v_near then
    why := 'You are too far away from that.';
    perform tell(p_world, me, why, 'error');
    return jsonb_build_object('planned', 0, 'why', why);
  end if;
  v_was_area := coalesce(current_setting('wurm.area', true), '');
  v_was_hush := coalesce(current_setting('wurm.hush', true), '');
  perform set_config('wurm.area', 'on', true);
  for a in select e from jsonb_array_elements(p_asks) e loop
    why := act_refusal(p_world, me, a->>'action', a->'target');
    if why is null then
      perform set_config('wurm.hush', 'on', true);
      perform private.area_go(p_world, me, a->>'action', a->'target');
      perform set_config('wurm.hush', v_was_hush, true);
      v_done := v_done + 1;
    else
      v_refused := v_refused + 1;
      first_why := coalesce(first_why, why);
    end if;
  end loop;
  perform set_config('wurm.area', v_was_area, true);
  -- The wind of one plan for the lot: a plan over an area is not refused half way for the wind it would take.
  if v_done > 0 then perform spend_wind(p_world, me, p_asks->0->>'action'); end if;
  v_line := case when v_done > 0 then 'Planned: ' || private.plan_count_word(p_asks->0->>'action', p_asks->0->'target', v_done) || '.' end;
  if v_refused > 0 then
    v_line := concat_ws(' ', v_line, 'Refused ' || v_refused || ': ' || first_why);
  end if;
  perform tell(p_world, me, v_line, case when v_done > 0 then 'event' else 'error' end);
  return held_now(p_world, me) || jsonb_build_object('planned', v_done, 'refused', v_refused, 'why', case when v_done = 0 then first_why end);
end $fn$;

/**
 * Your last plan taken back, within `plan_undo_seconds()`: every piece of it
 * still there and still yours, last first, by the job that takes one down by
 * hand, and what that gives back. Said once for the lot.
 */
create or replace function rpc_plan_undo(p_world uuid) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid(); u record; a jsonb; why text; first_why text; v_done int := 0; v_job text; v_t jsonb;
        v_was_area text; v_was_hush text; v_line text;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  perform settle(p_world, me);
  if not exists (select 1 from player where world_id = p_world and uid = me) then raise exception 'not on this island'; end if;
  select * into u from private.plan_undo where world_id = p_world and uid = me for update;
  if not found or u.at < now() - make_interval(secs => plan_undo_seconds()) then
    why := 'No plan to undo.';
    perform tell(p_world, me, why, 'error');
    return jsonb_build_object('removed', 0, 'why', why);
  end if;
  delete from private.plan_undo where world_id = p_world and uid = me;
  v_was_area := coalesce(current_setting('wurm.area', true), '');
  v_was_hush := coalesce(current_setting('wurm.hush', true), '');
  perform set_config('wurm.area', 'on', true);
  for a in select e from jsonb_array_elements(u.pieces) with ordinality t(e, o) order by o desc loop
    if not private.plan_still_mine(p_world, me, a->>'action', a->'target') then continue; end if;
    v_job := private.undo_job(a->>'action');
    v_t := (a->'target') - 'material' - 'wallType' - 'roofShape' - 'name';
    why := act_refusal(p_world, me, v_job, v_t);
    if why is null then
      perform set_config('wurm.hush', 'on', true);
      perform private.area_go(p_world, me, v_job, v_t);
      perform set_config('wurm.hush', v_was_hush, true);
      v_done := v_done + 1;
    else
      first_why := coalesce(first_why, why);
    end if;
  end loop;
  perform set_config('wurm.area', v_was_area, true);
  if v_done > 0 then perform spend_wind(p_world, me, private.undo_job(u.pieces->0->>'action')); end if;
  -- What taking them down kept back said with it: the stone a Mason's Salvage saves (`remove_wall`).
  v_line := case when v_done > 0 then 'Undone: ' || private.plan_count_word(u.pieces->0->>'action', u.pieces->0->'target', v_done) || '.'
                 else coalesce(first_why, 'Nothing of that plan is left to undo.') end;
  if v_done > 0 and first_why is not null then v_line := v_line || ' Kept: ' || first_why; end if;
  perform tell(p_world, me, v_line, case when v_done > 0 then 'event' else 'error' end);
  return held_now(p_world, me) || jsonb_build_object('removed', v_done, 'why', case when v_done = 0 then coalesce(first_why, v_line) end);
end $fn$;

revoke all on function private.area_plan_job(text), private.undo_job(text), private.area_reach(text), private.hushed(),
  private.plan_note(uuid, uuid, text, jsonb), private.plan_still_mine(uuid, uuid, text, jsonb),
  private.area_go(uuid, uuid, text, jsonb), private.plan_count_word(text, jsonb, int)
  from public, anon, authenticated;

-- ---------------------------------------------------------------- the patches, each exactly once
do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- A plan done is kept as the body's last plan, a single click's or an area's (`private.plan_note`).
    (1, 'act_perform(uuid,uuid,text,jsonb)'::regprocedure,
     $$begin
  -- cellar: digging out, mining out and filling in a cellar, and a drop, a pick up or a sweep down there.
$$, $$begin
  -- A plan done is kept as the body's last plan, to undo (`rpc_plan_undo`).
  if private.area_plan_job(p_action) then perform private.plan_note(p_world, p_uid, p_action, p_target); end if;
  -- cellar: digging out, mining out and filling in a cellar, and a drop, a pick up or a sweep down there.
$$),
    -- The reach a single plan asks, waived for the rest of a plan over an area and for an undo (`private.area_reach`).
    (2, 'act_refusal_rules(uuid,uuid,text,jsonb)'::regprocedure,
     $$  if not in_reach(p.x, p.y, p_target, d.corner, case p_action when 'fish'$$,
     $$  if not private.area_reach(p_action) and not in_reach(p.x, p.y, p_target, d.corner, case p_action when 'fish'$$),
    -- Each piece's own line held back, the lot said once (`private.hushed`).
    (3, 'tell(uuid,uuid,text,text)'::regprocedure,
     $$  insert into event (world_id, uid, text, kind) values (p_world, p_uid, p_text, p_kind)
$$, $$  insert into event (world_id, uid, text, kind) select p_world, p_uid, p_text, p_kind where not private.hushed()
$$)
  ) as t(ord, fn, old, new) order by ord loop
    v_def := pg_get_functiondef(r.fn);
    continue when position(r.new in v_def) > 0;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of change %, not 1', r.fn, v_n, r.ord; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
