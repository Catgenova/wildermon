/*
 * No plan: a bare side of storey 2 and up drawn with no plan model on it.
 *
 * Asked for: "On storey 2+ you can select a wall option 'no plan' that removes
 * the plan model and leaves the wall blank." Every bare outside side of a
 * building's storey is drawn with its plan model (stakes and a string) until a
 * wall goes on it. `no_plan` marks such a side on storey 2 and up so that none
 * is drawn there; `mark_out` takes the mark off again.
 *
 * The mark is what is drawn and nothing else: the side stays open for every
 * rule that asks a storey closed in (`level_gap`'s bare count, a roof, a
 * glasshouse), unchanged here. Only on a bare outside side of the footprint
 * (no wall planned or built there, the tile across not the same building's),
 * on the storey the job names (`frame_job_level`), storey 2 and up. Asked as
 * every building job is, of whoever may build there (`build_refusal`), at
 * plan_wall's reach, with no tool and nothing to pay for. The browser asks the
 * same in the same words (`noPlanReason`).
 *
 * `no_plan_side`, a row a marked border a storey, keyed as `wall` is. A wall
 * inserted on the border clears it (`no_plan_walled`), a storey removed clears
 * the marks on it and above (`no_plan_storeys`), and a building removed clears
 * its marks with it (the foreign key). Sent with the ground read as
 * `buildings.noPlan` (`no_plan_json`, `BuildingsJSON.noPlan`).
 */
set local lock_timeout = '3s';

select private.shut($ddl$
create table if not exists no_plan_side (
  world_id uuid not null references world (id) on delete cascade,
  level int not null check (level >= 1),
  dir text not null check (dir in ('h', 'v')),
  x int not null,
  y int not null,
  building int not null,
  marked_by uuid,
  primary key (world_id, level, dir, x, y),
  foreign key (world_id, building) references building (world_id, id) on delete cascade
)$ddl$);
select private.shut('create index if not exists no_plan_side_by_building on no_plan_side (world_id, building, level)');
-- Read through the ground read, as a wall is; a signed-in body may read its own islands' rows, as `wall_read` has it.
select private.shut('alter table no_plan_side enable row level security');
do $do$
begin
  if not exists (select 1 from pg_policy where polrelid = 'public.no_plan_side'::regclass and polname = 'no_plan_side_read') then
    perform private.shut($p$create policy no_plan_side_read on public.no_plan_side for select to authenticated
      using (world_id = any (private.my_islands()))$p$);
  end if;
end $do$;
revoke all on table no_plan_side from public, anon, authenticated;
grant select on table no_plan_side to authenticated;

/* Why a side cannot be marked No plan, or the mark taken off it, or null (`noPlanReason`). */
create or replace function no_plan_refusal(p_world uuid, p_action text, p_target jsonb, p_b building)
returns text language plpgsql stable as $fn$
declare tx int := (p_target->>'x')::int; ty int := (p_target->>'y')::int; v_side text := p_target->>'side';
        lvl int; bd record; o record; v_marked boolean;
begin
  if v_side is null or v_side not in ('n', 'e', 's', 'w') then return 'Choose a side.'; end if;
  if p_b.id is null then return 'No building here.'; end if;
  lvl := frame_job_level(p_b, p_target);
  if lvl < 1 then return 'Storey 2 and up only.'; end if;
  select * into o from across(tx, ty, v_side);
  if building_at(p_world, o.x, o.y) is not distinct from p_b.id then return 'Outside sides only.'; end if;
  select * into bd from border_of(tx, ty, v_side);
  if exists (select 1 from wall w where w.world_id = p_world and w.level = lvl
               and w.dir = bd.dir and w.x = bd.x and w.y = bd.y) then
    return 'Already a wall on that side.';
  end if;
  v_marked := exists (select 1 from no_plan_side m where m.world_id = p_world and m.level = lvl
                        and m.dir = bd.dir and m.x = bd.x and m.y = bd.y);
  if p_action = 'no_plan' and v_marked then return 'Already no plan.'; end if;
  if p_action = 'mark_out' and not v_marked then return 'Already marked out.'; end if;
  return null;
end $fn$;

/* Mark a side No plan, or take the mark off, and say so (`no_plan`, `mark_out` in `buildActions.ts`). */
create or replace function perform_no_plan(p_world uuid, p_uid uuid, p_action text, p_target jsonb, p_b building)
returns void language plpgsql as $fn$
declare tx int := (p_target->>'x')::int; ty int := (p_target->>'y')::int; v_side text := p_target->>'side';
        lvl int; bd record;
begin
  if no_plan_refusal(p_world, p_action, p_target, p_b) is not null then return; end if;
  lvl := frame_job_level(p_b, p_target);
  select * into bd from border_of(tx, ty, v_side);
  if p_action = 'no_plan' then
    insert into no_plan_side (world_id, level, dir, x, y, building, marked_by)
    values (p_world, lvl, bd.dir, bd.x, bd.y, p_b.id, p_uid)
    on conflict do nothing;
    perform tell(p_world, p_uid, 'No plan: ' || side_name(v_side) || ' side, storey ' || (lvl + 1) || '.', 'event');
  else
    delete from no_plan_side m where m.world_id = p_world and m.level = lvl
       and m.dir = bd.dir and m.x = bd.x and m.y = bd.y;
    perform tell(p_world, p_uid, 'Marked out: ' || side_name(v_side) || ' side, storey ' || (lvl + 1) || '.', 'event');
  end if;
end $fn$;

/* The sides marked No plan near a point, as `BuildingsJSON.noPlan`. */
create or replace function no_plan_json(p_world uuid, p_x double precision, p_y double precision, p_range double precision)
returns jsonb language sql stable as $fn$
  select coalesce(jsonb_agg(jsonb_build_object(
      'building', m.building, 'level', m.level, 'x', m.x, 'y', m.y, 'dir', m.dir) order by m.level, m.dir, m.x, m.y), '[]'::jsonb)
    from no_plan_side m
   where m.world_id = p_world
     and greatest(abs(m.x + 0.5 - p_x), abs(m.y + 0.5 - p_y)) <= p_range
$fn$;

/* A wall planned on a side marked No plan clears the mark. */
create or replace function no_plan_walled() returns trigger language plpgsql as $fn$
begin
  delete from no_plan_side m where m.world_id = new.world_id and m.level = new.level
     and m.dir = new.dir and m.x = new.x and m.y = new.y;
  return null;
end $fn$;
select private.shut('drop trigger if exists no_plan_walled on wall');
select private.shut($t$create trigger no_plan_walled after insert or update of level, dir, x, y on wall for each row
  when (new.level >= 1) execute function no_plan_walled()$t$);

/* A storey removed clears the marks on it and above. */
create or replace function no_plan_storeys() returns trigger language plpgsql as $fn$
begin
  delete from no_plan_side m where m.world_id = new.world_id and m.building = new.id and m.level >= new.levels;
  return null;
end $fn$;
select private.shut('drop trigger if exists no_plan_storeys on building');
select private.shut($t$create trigger no_plan_storeys after update of levels on building for each row
  when (new.levels < old.levels) execute function no_plan_storeys()$t$);

/* ---- the two jobs, in the building machinery -------------------------------------------------- */
do $do$
declare v_def text; v_old text; v_new text; v_n int;
begin
  -- build_action: the two ids.
  v_def := pg_get_functiondef('build_action'::regproc);
  v_old := $$    'repoint_wall')$$;
  v_new := $$    'repoint_wall',
    -- No plan: a bare side of storey 2 and up drawn with no plan model, and the mark taken off (`no_plan_refusal`).
    'no_plan', 'mark_out')$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'build_action has % of the repoint_wall id, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);

  -- build_refusal: asked after whose building it is, as every building job is.
  v_def := pg_get_functiondef('build_refusal'::regproc);
  v_old := $$  elsif p_action = 'remove_storey' then
    if b.id is null or b.levels <= 1 then return 'No upper storey.'; end if;$$;
  v_new := $$  -- No plan: a bare outside side of storey 2 and up (`no_plan_refusal`).
  elsif p_action in ('no_plan', 'mark_out') then
    return no_plan_refusal(p_world, p_action, p_target, b);

  elsif p_action = 'remove_storey' then
    if b.id is null or b.levels <= 1 then return 'No upper storey.'; end if;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'build_refusal has % of the remove_storey branch, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);

  -- perform_building.
  v_def := pg_get_functiondef('perform_building'::regproc);
  v_old := $$  elsif p_action = 'remove_storey' then
    if b.id is null or b.levels <= 1 then return; end if;$$;
  v_new := $$  -- No plan: mark the side, or take the mark off (`perform_no_plan`).
  elsif p_action in ('no_plan', 'mark_out') then
    perform perform_no_plan(p_world, p_uid, p_action, p_target, b);

  elsif p_action = 'remove_storey' then
    if b.id is null or b.levels <= 1 then return; end if;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'perform_building has % of the remove_storey branch, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);

  -- rpc_ground: the marks, with the columns.
  v_def := pg_get_functiondef('rpc_ground'::regproc);
  v_old := $$      'columns', frame_columns_json(p_world, p.x, p.y, p_range)),$$;
  v_new := $$      'columns', frame_columns_json(p_world, p.x, p.y, p_range),
      -- No plan: the sides drawn with no plan model (`no_plan_json`).
      'noPlan', no_plan_json(p_world, p.x, p.y, p_range)),$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'rpc_ground has % of the columns line, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

revoke all on function no_plan_refusal(uuid, text, jsonb, building) from public, anon, authenticated;
revoke all on function perform_no_plan(uuid, uuid, text, jsonb, building) from public, anon, authenticated;
revoke all on function no_plan_json(uuid, double precision, double precision, double precision) from public, anon, authenticated;
revoke all on function no_plan_walled() from public, anon, authenticated;
revoke all on function no_plan_storeys() from public, anon, authenticated;

select private.lock_doors();
