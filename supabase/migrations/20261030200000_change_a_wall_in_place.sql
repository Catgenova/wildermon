/*
 * Change a wall: a wall of a building planned anew as another type or material where it stands.
 *
 * Asked: "when a wall can't be removed, add an option to change it." A solid wall that storey 3 rests on could not be
 * taken down ("Storey 3 rests on this wall: add a column at each end, or remove the wall above, first.") and so could
 * not be made a door, a window, an arch or a glass wall either. `change_wall` plans the new type and material on it in
 * one go, whether or not Remove is allowed:
 *
 *   * A wall still going up is planned again in place: its type, material and bill are the new ones, from nothing in,
 *     and the line is a plan's (`plan_line`).
 *   * A finished wall stands as it is, with the change planned on it: a `wall_change` row, keyed as its wall is, with
 *     the new type, material and bill ("Change planned: door, marble, west side. Needs ..." -- `change_line`). The
 *     wall standing stays shut and carries what rests on it while the change is built, a unit a go by `build_wall`
 *     (`change_build_refusal`, `perform_change_build`), and with the last of it the row becomes the wall in that one
 *     update: no moment with the border open, and none with what rests on it unsupported.
 *   * What it may be changed to is asked as a wall planned on the border (`plan_wall`) is asked: the glass rule, a
 *     mallet, what stands round it, a counter's street, a lantern post's arm, the deck and what is under it carrying
 *     the new material, a portcullis's ground floor and stone; and as a Repoint asks it, the new material carrying what
 *     stands on it and standing as many storeys as the building has. And as Remove asks it of the wall standing: a
 *     full-height wall a storey, a jetty or a roof rests on changes only to another full-height wall, which carries it
 *     as the old one did -- a fence, a half wall or a railing carries nothing, and is refused in Remove's words -- and
 *     a counter with anything on it, or a padlocked portcullis, not at all (nor is a change built over one).
 *   * Asked again for the wall standing, with a change planned, it drops the change ("Change dropped: west side.").
 *
 * The browser asks and does the same in the same words (`changeWallReason`, `change_wall` and `build_wall` in
 * `src/game/buildActions.ts`); `supabase/test/changewall.ts` holds the two sides to them. The change is sent with its
 * wall in the ground read (`wall_gear`, `Wall.change`).
 */
set local lock_timeout = '3s';

select private.shut($ddl$
create table if not exists wall_change (
  world_id uuid not null,
  level int not null,
  dir text not null check (dir in ('h', 'v')),
  x int not null,
  y int not null,
  type text not null,
  material text not null,
  needed jsonb not null,
  total jsonb not null,
  planned_by uuid,
  primary key (world_id, level, dir, x, y),
  foreign key (world_id, level, dir, x, y) references wall (world_id, level, dir, x, y)
    on update cascade on delete cascade
)$ddl$);
-- Read through the ground read, as a wall is; a signed-in body may read its own islands' rows, as `wall_read` has it.
select private.shut('alter table wall_change enable row level security');
do $do$
begin
  if not exists (select 1 from pg_policy where polrelid = 'public.wall_change'::regclass and polname = 'wall_change_read') then
    perform private.shut($p$create policy wall_change_read on public.wall_change for select to authenticated
      using (world_id = any (private.my_islands()))$p$);
  end if;
end $do$;
revoke all on table wall_change from public, anon, authenticated;
grant select on table wall_change to authenticated;

/* A wall by its type and material, as a plan names it: "solid stone brick wall", "log railing", "door, marble" (`wallWords`). */
create or replace function wall_words(p_type text, p_material text) returns text language sql stable as $fn$
  select case when p_type = 'solid' then lower(wt.name) || ' ' || lower(m.name) || ' wall'
              when p_type = 'railing' then lower(m.name) || ' railing'
              else lower(wt.name) || ', ' || lower(m.name) end
    from wall_type_def wt, build_material_def m where wt.id = p_type and m.id = p_material
$fn$;

/* What a change planned for a finished wall says (`changeLine`). */
create or replace function change_line(p_type text, p_material text, p_side text) returns text language sql stable as $fn$
  select 'Change planned: ' || wall_words(p_type, p_material) || ', ' || side_name(p_side) || ' side.'
$fn$;

/* The change planned for a wall, if there is one. */
create or replace function wall_change_of(p_world uuid, w wall) returns wall_change language sql stable as $fn$
  select c.* from wall_change c
   where c.world_id = p_world and c.level = w.level and c.dir = w.dir and c.x = w.x and c.y = w.y
$fn$;

/* Why a wall may not go, taken down or changed into another, by what it is: a counter not empty, a padlocked portcullis. */
create or replace function wall_goes_refusal(p_world uuid, p_uid uuid, w wall) returns text language sql stable as $fn$
  select coalesce(counter_remove_refusal(p_world, w),
                  case when w.type = 'portcullis' then lock_refusal(p_world, p_uid, w.lock, w.x, w.y) end)
$fn$;

/* Why a wall may not be changed to the type and material a target asks, or null (`changeWallReason`). */
create or replace function change_wall_refusal(p_world uuid, p_uid uuid, p_target jsonb, p_b building)
returns text language plpgsql stable as $fn$
declare tx int := (p_target->>'x')::int; ty int := (p_target->>'y')::int; v_side text := p_target->>'side';
        wt wall_type_def; mat build_material_def; w wall; ch wall_change;
        lvl int; bears int; v_over int; v_stands int; v_why text; v_lvl int;
begin
  select * into wt from wall_type_def where id = p_target->>'wallType';
  select * into mat from build_material_def where id = p_target->>'material';
  if v_side is null or wt.id is null or mat.id is null then return 'Choose a side, wall type and material.'; end if;
  if p_b.id is null then return 'No building here.'; end if;
  w := frame_wall_at(p_world, tx, ty, v_side, p_target);
  if w.world_id is null or w.building = 0 then return 'No wall there.'; end if;
  ch := wall_change_of(p_world, w);
  -- The wall standing: with a change planned, asked for again it drops the change.
  if wall_seen_type(p_world, p_uid, w) = wt.id and w.material = mat.id then
    return case when ch.world_id is null then 'Already that wall.' end;
  end if;
  if ch.type = wt.id and ch.material = mat.id then return 'Change already planned.'; end if;
  -- Glass as a solid wall and nothing else, and a type laid in one material only (`material_only_refusal`).
  v_why := material_only_refusal(mat.id, wt.id, null);
  if v_why is not null then return v_why; end if;
  v_why := need_tool(p_world, p_uid, 'mallet');
  if v_why is not null then return v_why; end if;
  -- What stands round it, as a wall planned there is asked (`frame_refusal`).
  if coalesce((p_target->>'terrace')::boolean, false) then
    if roof_shape_of(p_world, p_b.id) <> 'flat' then return 'Terraces: flat roofs only.'; end if;
    if wt.id <> 'railing' then return 'Terraces: railings only.'; end if;
    if not exists (select 1 from floor_tile ft where ft.world_id = p_world and ft.level = p_b.levels
                     and ft.x = tx and ft.y = ty and ft.kind = 'roof' and bill_done(ft.needed)) then
      return 'Finish this tile''s roof first.';
    end if;
  else
    if wt.id = 'railing' and frame_job_level(p_b, p_target) < 1 and not on_piers(p_world, tx, ty) then
      return 'Railings: upper storey edges, decks on piers or terraces. On the ground, plan a fence.';
    end if;
    -- A railing changed to a full-height wall shutting a roofed jetty out of its storey would make a roofed balcony.
    if not coalesce(wt.low, false) and is_low_wall(w.type) and w.level = p_b.levels - 1
       and frame_roof_cut_off(p_world, p_b, w.dir, w.x, w.y) then
      return 'Roof over that jetty: remove it first. Balconies take no roof.';
    end if;
  end if;
  lvl := w.level;
  -- A shop counter faces the street from the ground floor (`counters.ts`).
  if wt.id = 'counter' then
    v_why := counter_plan_refusal(p_world, lvl, tx, ty, v_side);
    if v_why is not null then return v_why; end if;
  end if;
  -- Nor does a wall close over a lantern post's arm (`lamps.ts`).
  v_why := lamp_wall_refusal(p_world, lvl, tx, ty, v_side, wt.id);
  if v_why is not null then return v_why; end if;
  -- What is under it carries the new material, and the new material what stands on it, as a Repoint asks.
  v_why := case when p_b.deck is not null then deck_carries(p_world, p_b.id, mat.id) end;
  if v_why is not null then return v_why; end if;
  bears := coalesce(bearing(p_world, p_b.id, lvl), 9);
  if mat.heft > bears then
    return mat.name || ' too heavy for what is under it: this storey carries ' || heft_word(bears) || ' at most.';
  end if;
  select max(m2.heft) into v_over from wall w2 join build_material_def m2 on m2.id = w2.material
   where w2.world_id = p_world and w2.building = p_b.id and w2.level > lvl;
  -- Glass under any storey, however heavy, as it is planned there (`GLASS_UNDER_ANY`).
  if mat.heft < coalesce(v_over, 0) and mat.id <> 'glass' then
    return mat.name || ' cannot carry the ' || heft_word(v_over) || ' above it.';
  end if;
  v_stands := mat.storeys + floor(pk(p_world, p_uid, 'storeys:' || build_work(mat.kind), 0))::int;
  if p_b.levels > v_stands then
    return mat.name || ': max ' || v_stands || ' storeys; this is ' || p_b.levels || '.';
  end if;
  -- gates: a portcullis in stone on the ground floor; a hidden door is planned on a bare side.
  v_why := gate_plan_refusal(p_world, p_uid, wt.id, mat.id, lvl, building_at(p_world, tx, ty) is null);
  if v_why is not null then return v_why; end if;
  -- A fence, a half wall or a railing carries nothing: not in place of a wall something rests on (`frame_refusal`).
  if coalesce(wt.low, false) then
    v_lvl := frame_bears_jetty(p_world, w);
    if v_lvl is not null then
      return 'Storey ' || (v_lvl + 1) || ' jetty rests on this wall: add a column at each end, or remove the jetty, first.';
    end if;
    v_why := coalesce(frame_roof_on_wall(p_world, w), frame_storey_on_wall(p_world, w));
    if v_why is not null then return v_why; end if;
  end if;
  return wall_goes_refusal(p_world, p_uid, w);
end $fn$;

/* Plan a change on a wall, plan a wall still going up again, or drop a change, and say so (`change_wall`). */
create or replace function perform_change_wall(p_world uuid, p_uid uuid, p_target jsonb, p_b building)
returns void language plpgsql as $fn$
declare tx int := (p_target->>'x')::int; ty int := (p_target->>'y')::int; v_side text := p_target->>'side';
        wt wall_type_def; mat build_material_def; w wall; v_bill jsonb;
begin
  if change_wall_refusal(p_world, p_uid, p_target, p_b) is not null then return; end if;
  select * into wt from wall_type_def where id = p_target->>'wallType';
  select * into mat from build_material_def where id = p_target->>'material';
  w := frame_wall_at(p_world, tx, ty, v_side, p_target);
  if wall_seen_type(p_world, p_uid, w) = wt.id and w.material = mat.id then
    delete from wall_change c where c.world_id = p_world and c.level = w.level and c.dir = w.dir and c.x = w.x and c.y = w.y;
    perform tell(p_world, p_uid, 'Change dropped: ' || side_name(v_side) || ' side.', 'event');
    return;
  end if;
  -- A fence, a gate or a half wall for less of its material: a Carpenter's Fence Builder, as `plan_wall` has it.
  v_bill := wall_bill(mat.id, wt.id, case when wt.standalone then pk(p_world, p_uid, 'bill:fence', 1) else 1 end);
  if bill_done(w.needed) then
    insert into wall_change (world_id, level, dir, x, y, type, material, needed, total, planned_by)
    values (p_world, w.level, w.dir, w.x, w.y, wt.id, mat.id, v_bill, v_bill, p_uid)
    on conflict (world_id, level, dir, x, y) do update
      set type = excluded.type, material = excluded.material, needed = excluded.needed, total = excluded.total,
          planned_by = excluded.planned_by;
    perform tell(p_world, p_uid, change_line(wt.id, mat.id, v_side) || ' Needs ' || bill_text(mat.id, v_bill) || '.', 'event');
  else
    -- Nothing stands yet: the plan is the new one, from nothing in.
    update wall set type = wt.id, material = mat.id, needed = v_bill, total = v_bill, lock = null, lowered = false, glass = null
     where world_id = p_world and level = w.level and dir = w.dir and x = w.x and y = w.y;
    delete from wall_change c where c.world_id = p_world and c.level = w.level and c.dir = w.dir and c.x = w.x and c.y = w.y;
    perform tell(p_world, p_uid, plan_line(wt.id, mat.id, v_side) || ' Needs ' || bill_text(mat.id, v_bill) || '.', 'event');
  end if;
end $fn$;

/* Why a go of building a change planned for a wall may not be done, or null: `build_wall`'s, of the change. */
create or replace function change_build_refusal(p_world uuid, p_uid uuid, w wall, p_x int, p_y int, p_side text)
returns text language plpgsql stable as $fn$
declare ch wall_change := wall_change_of(p_world, w); mat build_material_def; v_why text;
begin
  if bill_done(ch.needed) then return 'Wall finished.'; end if;
  -- And the standing one goes with the last of it: not a counter with anything on it, nor a padlocked portcullis.
  v_why := wall_goes_refusal(p_world, p_uid, w);
  if v_why is not null then return v_why; end if;
  -- Nor is one raised over a lantern post's arm (`lamps.ts`).
  v_why := lamp_wall_refusal(p_world, w.level, p_x, p_y, p_side, ch.type);
  if v_why is not null then return v_why; end if;
  select * into mat from build_material_def where id = ch.material;
  if mat.id is not null then
    v_why := need_tool(p_world, p_uid, mat.tool);
    if v_why is not null then return v_why; end if;
  end if;
  if next_material(p_world, p_uid, ch.material, ch.needed, p_x, p_y) is null then
    return 'Need ' || bill_text(ch.material, ch.needed) || '.';
  end if;
  return null;
end $fn$;

/*
 * A go of building a change planned for a wall: a unit into the change's bill, or as many as a Mason's Two at a Time
 * lays on stone, the wall standing as it is. With the last of it the change is the wall, in one update: its type,
 * material and bill, bare of paint, no padlock and no pane's colour; the standing one's counter shut and the new one's
 * opened; said as a wall finished is.
 */
create or replace function perform_change_build(p_world uuid, p_uid uuid, w wall, p_x int, p_y int)
returns void language plpgsql as $fn$
declare ch wall_change := wall_change_of(p_world, w); mat build_material_def; wt wall_type_def;
        bill jsonb; used text; v_laid text[] := '{}'; v_i int;
begin
  if ch.world_id is null or bill_done(ch.needed) then return; end if;
  select * into mat from build_material_def where id = ch.material;
  bill := ch.needed;
  for v_i in 1 .. greatest(1, floor(pk(p_world, p_uid, 'lay:' || build_work(mat.kind), 1))::int) loop
    exit when bill_done(bill);
    used := next_material(p_world, p_uid, ch.material, bill, p_x, p_y);
    exit when used is null or not take_material(p_world, p_uid, used, p_x, p_y, ch.material);
    bill := jsonb_set(bill, array[used], to_jsonb((bill->>used)::int - 1));
    v_laid := v_laid || used;
  end loop;
  if coalesce(array_length(v_laid, 1), 0) = 0 then return; end if;
  perform skill_raise(p_world, p_uid, mat.skill, 0.4);
  if not bill_done(bill) then
    update wall_change set needed = bill
     where world_id = p_world and level = w.level and dir = w.dir and x = w.x and y = w.y;
    perform tell(p_world, p_uid, 'Added: ' || laid_text(v_laid) || '. Still needed: '
      || bill_text(ch.material, bill) || '.', 'event');
    return;
  end if;
  perform counter_gone(p_world, w);
  delete from wall_change where world_id = p_world and level = w.level and dir = w.dir and x = w.x and y = w.y;
  update wall set type = ch.type, material = ch.material, needed = bill, total = ch.total,
         dye = null, glass = null, lock = null, lowered = false, planned_by = coalesce(ch.planned_by, planned_by)
   where world_id = p_world and level = w.level and dir = w.dir and x = w.x and y = w.y
  returning * into w;
  -- A shop counter's store opens as it is finished (`counters.ts`).
  perform counter_finished(p_world, w);
  select * into wt from wall_type_def where id = ch.type;
  -- A wall of a building finished, for the journal, and by its type; a fence is not one.
  if not coalesce(wt.low, false) then perform journal_note(p_world, p_uid, 'walled'); end if;
  perform journal_note(p_world, p_uid, 'built:' || ch.type);
  perform tell(p_world, p_uid, 'Built: ' || lower(mat.name) || ' '
    || case when wt.low then lower(wt.name) else 'wall' end || '.', 'event');
end $fn$;

/* The ground read: a wall's gear, and the change planned for it (`Wall.change`). */
create or replace function wall_gear(p_world uuid, p_uid uuid, w wall) returns jsonb language sql stable as $fn$
  select case when w.lowered then jsonb_build_object('lowered', true) else '{}'::jsonb end
      || case when w.lock is null then '{}'::jsonb
              when wall_seen_type(p_world, p_uid, w) = 'solid' then '{}'::jsonb
              else jsonb_build_object('lock', w.lock) end
      -- Dyed glass: the colour of a window's or a bay window's glass (`Wall.glass`).
      || case when w.glass is null then '{}'::jsonb else jsonb_build_object('glass', w.glass) end
      -- A change planned for it (`change_wall`).
      || coalesce((select jsonb_build_object('change', jsonb_build_object(
                     'type', c.type, 'material', c.material, 'needed', c.needed, 'total', c.total))
                     from wall_change c
                    where c.world_id = p_world and c.level = w.level and c.dir = w.dir and c.x = w.x and c.y = w.y),
                  '{}'::jsonb)
$fn$;

/* ---- the job, in the building machinery ------------------------------------------------------- */
do $do$
declare v_def text; v_old text; v_new text; v_n int;
begin
  -- build_action: the id.
  v_def := pg_get_functiondef('build_action'::regproc);
  v_old := $$    'no_plan', 'mark_out')$$;
  v_new := $$    'no_plan', 'mark_out',
    -- Change a wall where it stands (`change_wall_refusal`).
    'change_wall')$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'build_action has % of the mark_out id, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);

  -- A storey job: on the storey it names, and on a jetty's for the building it names.
  v_def := pg_get_functiondef('private.storey_job'::regproc);
  v_old := $$'repoint_wall', 'no_plan', 'mark_out')$$;
  v_new := $$'repoint_wall', 'no_plan', 'mark_out', 'change_wall')$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'storey_job has % of the mark_out id, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);

  v_def := pg_get_functiondef('frame_storey_action'::regproc);
  v_old := $$'repoint_wall',$$;
  v_new := $$'repoint_wall', 'change_wall',$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'frame_storey_action has % of the repoint_wall id, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);

  -- build_refusal: asked after whose building it is, as every building job is; and a change built as a wall is.
  v_def := pg_get_functiondef('build_refusal'::regproc);
  v_old := $$  elsif p_action = 'remove_storey' then
    if b.id is null or b.levels <= 1 then return 'No upper storey.'; end if;$$;
  v_new := $$  -- Change a wall where it stands (`change_wall_refusal`).
  elsif p_action = 'change_wall' then
    return change_wall_refusal(p_world, p_uid, p_target, b);

  elsif p_action = 'remove_storey' then
    if b.id is null or b.levels <= 1 then return 'No upper storey.'; end if;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'build_refusal has % of the remove_storey branch, not 1', v_n; end if;
  v_def := replace(v_def, v_old, v_new);
  v_old := $$    if w.world_id is null then return 'No wall planned there.'; end if;
    if bill_done(w.needed) then return 'Wall finished.'; end if;$$;
  v_new := $$    if w.world_id is null then return 'No wall planned there.'; end if;
    -- A change planned for a finished wall is built as a wall is, the wall standing till it is done (`change_wall`).
    if (wall_change_of(p_world, w)).world_id is not null then return change_build_refusal(p_world, p_uid, w, tx, ty, side); end if;
    if bill_done(w.needed) then return 'Wall finished.'; end if;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'build_refusal has % of the build_wall lines, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);

  -- perform_building.
  v_def := pg_get_functiondef('perform_building'::regproc);
  v_old := $$  elsif p_action = 'remove_storey' then
    if b.id is null or b.levels <= 1 then return; end if;$$;
  v_new := $$  -- Change a wall where it stands (`perform_change_wall`).
  elsif p_action = 'change_wall' then
    perform perform_change_wall(p_world, p_uid, p_target, b);

  elsif p_action = 'remove_storey' then
    if b.id is null or b.levels <= 1 then return; end if;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'perform_building has % of the remove_storey branch, not 1', v_n; end if;
  v_def := replace(v_def, v_old, v_new);
  v_old := $$  elsif p_action = 'build_wall' then
    w := frame_wall_at(p_world, tx, ty, side, p_target);  -- Frame: on the job's storey.
    if w.world_id is null or bill_done(w.needed) then return; end if;$$;
  v_new := $$  elsif p_action = 'build_wall' then
    w := frame_wall_at(p_world, tx, ty, side, p_target);  -- Frame: on the job's storey.
    -- A change planned for a finished wall is built as a wall is (`perform_change_build`).
    if w.world_id is not null and (wall_change_of(p_world, w)).world_id is not null then
      perform perform_change_build(p_world, p_uid, w, tx, ty);
      return;
    end if;
    if w.world_id is null or bill_done(w.needed) then return; end if;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'perform_building has % of the build_wall lines, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

revoke all on function wall_words(text, text) from public, anon, authenticated;
revoke all on function change_line(text, text, text) from public, anon, authenticated;
revoke all on function wall_change_of(uuid, wall) from public, anon, authenticated;
revoke all on function wall_goes_refusal(uuid, uuid, wall) from public, anon, authenticated;
revoke all on function change_wall_refusal(uuid, uuid, jsonb, building) from public, anon, authenticated;
revoke all on function perform_change_wall(uuid, uuid, jsonb, building) from public, anon, authenticated;
revoke all on function change_build_refusal(uuid, uuid, wall, int, int, text) from public, anon, authenticated;
revoke all on function perform_change_build(uuid, uuid, wall, int, int) from public, anon, authenticated;

select private.lock_doors();
