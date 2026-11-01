-- Dye scrubbed off with a brush.
--
-- Asked: "Add the option to scrub dye off an object/surface using a brush". Three jobs, each with a brush and no lye,
-- the other way to remove a dye than boiling it out (`strip_dye`, `strip_wall_paint`, both left as they were):
--   * `scrub_dye`, Scrub off dye: a dyed thing in the pack, or a piece set down that took a dye (a banner, a flagpole,
--     a sailing boat, a caravel), whose padlock admits you as lifting it asks (`pick_up_furniture`). In the last
--     family, with its own refusal and go (`private.scrub_refusal`, `private.perform_scrub`).
--   * `scrub_wall_paint`, Scrub off paint: a painted side of a wall or a fence.
--   * `scrub_floor_paint`, Scrub off floor paint: a painted floor.
-- The two building jobs are storey jobs as painting is (`private.storey_job`, `frame_storey_action`), refused and done
-- in `build_refusal` and `perform_building`, the brush asked first by the general tool check (`act_refusal_rules`).
-- No skill, so a go is worked at 50; the time, the wind and the brush come with the definitions
-- (20261101270000_defs.sql, `action_def`), and the brush is worn a go's worth every go by `act_go` off `action_def.tool`.
-- The words are the lye removals' own: "Dye removed: plain banner.", "Paint removed: bare oak.", "No colour to remove."

set local lock_timeout = '3s';

/*
 * Why a scrubbing off a thing in the pack or a piece set down will not go, or null (`scrubRefusal`): the brush, as the
 * general tool check words it; a piece gone, out of reach, or padlocked against you; and a colour to remove.
 */
create or replace function private.scrub_refusal(p_world uuid, p_uid uuid, p_target jsonb)
returns text language plpgsql stable as $fn$
declare it item; pc placed; v_tool text := action_tool('scrub_dye'); v_why text;
begin
  if tool_ql(p_world, p_uid, v_tool) <= 0 then
    return 'Need a ' || lower((select coalesce(name, v_tool) from item_def where id = v_tool)) || '.';
  end if;
  if p_target->>'kind' = 'furniture' then
    pc := target_placed(p_world, p_target);
    if pc.id is null then return 'It is gone.'; end if;
    if not placed_in_reach(p_world, p_uid, pc.id) then
      return 'Stand next to the ' || coalesce(pc.sub, pc.kind) || '.';
    end if;
    v_why := lock_refusal(p_world, p_uid, pc.lock, pc.x, pc.y);
    if v_why is not null then return v_why; end if;
    if pc.kind <> 'furniture' or pc.dye is null or not takes_dye(pc.sub) then return 'No colour to remove.'; end if;
    return null;
  end if;
  select * into it from item where world_id = p_world and id = target_item(p_target)
    and holder = 'player' and holder_uid = p_uid;
  if not found or it.dye is null or not takes_dye(it.def) then return 'No colour to remove.'; end if;
  return null;
end $fn$;

/* A go of Scrub off dye: the colour off the whole stack, as Remove dye takes it, or off the piece where it stands. */
create or replace function private.perform_scrub(p_world uuid, p_uid uuid, p_target jsonb)
returns void language plpgsql as $fn$
declare it item; pc placed;
begin
  if private.scrub_refusal(p_world, p_uid, p_target) is not null then return; end if;
  if p_target->>'kind' = 'furniture' then
    pc := target_placed(p_world, p_target);
    update placed set dye = null where world_id = p_world and id = pc.id;
    perform tell(p_world, p_uid, 'Dye removed: plain '
      || lower(coalesce((select f.name from furniture_def f where f.id = pc.sub), pc.sub)) || '.', 'event');
    return;
  end if;
  select * into it from item where world_id = p_world and id = target_item(p_target);
  update item set dye = null where id = it.id;
  perform tell(p_world, p_uid, 'Dye removed: plain '
    || lower((select coalesce(name, it.def) from item_def where id = it.def)) || '.', 'event');
end $fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- The last family takes Scrub off dye.
    ('public', 'last_action',
     $$'dye_item', 'strip_dye', $$,
     $$'dye_item', 'strip_dye', 'scrub_dye', $$),
    ('public', 'last_refusal',
     $$  if p_action = 'set_bauble' then
    return bauble_refusal(p_world, p_uid, p_target);
  end if;
$$,
     $$  if p_action = 'set_bauble' then
    return bauble_refusal(p_world, p_uid, p_target);
  end if;
  -- Scrub off dye: a brush, no lye (`private.scrub_refusal`).
  if p_action = 'scrub_dye' then
    return private.scrub_refusal(p_world, p_uid, p_target);
  end if;
$$),
    ('public', 'perform_last',
     $$  if p_action = 'set_bauble' then
    perform perform_bauble(p_world, p_uid, p_target);
    return;
  end if;
$$,
     $$  if p_action = 'set_bauble' then
    perform perform_bauble(p_world, p_uid, p_target);
    return;
  end if;
  if p_action = 'scrub_dye' then
    perform private.perform_scrub(p_world, p_uid, p_target);
    return;
  end if;
$$),
    -- The building family takes the paint scrubbed off a side and a floor, storey jobs both.
    ('public', 'build_action',
     $$    'paint_wall', 'strip_wall_paint', 'paint_floor',
$$,
     $$    'paint_wall', 'strip_wall_paint', 'paint_floor',
    -- Scrubbed off with a brush.
    'scrub_wall_paint', 'scrub_floor_paint',
$$),
    ('public', 'frame_storey_action',
     $$'paint_wall', 'strip_wall_paint', 'repoint_wall',$$,
     $$'paint_wall', 'strip_wall_paint', 'scrub_wall_paint', 'repoint_wall',$$),
    ('public', 'frame_storey_action',
     $$'remove_floor', 'paint_floor',$$,
     $$'remove_floor', 'paint_floor', 'scrub_floor_paint',$$),
    ('private', 'storey_job',
     $$'paint_wall', 'strip_wall_paint', 'paint_floor', $$,
     $$'paint_wall', 'strip_wall_paint', 'paint_floor', 'scrub_wall_paint', 'scrub_floor_paint', $$),
    ('public', 'build_refusal',
     $$  elsif p_action = 'paint_floor' then
    if b.id is null then return 'No floor here.'; end if;
$$,
     $$  -- Scrubbed off with a brush, which the general tool check has asked for (`act_refusal_rules`).
  elsif p_action = 'scrub_wall_paint' then
    if side is null then return 'Choose a side.'; end if;
    w := frame_wall_at(p_world, tx, ty, side, p_target);  -- Frame: on the job's storey.
    if w.world_id is null then return 'No wall there.'; end if;
    if w.dye is null then return 'No colour to remove.'; end if;
    return null;

  elsif p_action = 'scrub_floor_paint' then
    if b.id is null then return 'No floor here.'; end if;
    lvl := frame_job_level(b, p_target);  -- Frame: on the job's storey.
    select * into f from floor_tile where world_id = p_world and level = lvl and x = tx and y = ty;
    if not found then return 'No floor here.'; end if;
    if f.dye is null then return 'No colour to remove.'; end if;
    return null;

  elsif p_action = 'paint_floor' then
    if b.id is null then return 'No floor here.'; end if;
$$),
    ('public', 'perform_building',
     $$  elsif p_action = 'paint_floor' then
    if b.id is null then return; end if;
$$,
     $$  elsif p_action = 'scrub_wall_paint' then
    w := frame_wall_at(p_world, tx, ty, side, p_target);  -- Frame: on the job's storey.
    if w.world_id is null or w.dye is null then return; end if;
    update wall set dye = null where world_id = p_world and level = w.level
      and dir = w.dir and x = w.x and y = w.y;
    select * into mat from build_material_def where id = w.material;
    perform tell(p_world, p_uid, 'Paint removed: bare '
      || coalesce(lower(mat.name), 'stone') || '.', 'event');

  elsif p_action = 'scrub_floor_paint' then
    if b.id is null then return; end if;
    lvl := frame_job_level(b, p_target);  -- Frame: on the job's storey.
    select * into f from floor_tile where world_id = p_world and level = lvl and x = tx and y = ty;
    if not found or f.dye is null then return; end if;
    update floor_tile set dye = null where world_id = p_world and level = lvl and x = tx and y = ty;
    select * into mat from build_material_def where id = f.material;
    perform tell(p_world, p_uid, 'Paint removed: bare '
      || coalesce(lower(mat.name), 'stone') || '.', 'event');

  elsif p_action = 'paint_floor' then
    if b.id is null then return; end if;
$$)
  ) as t(sch, fn, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = r.sch and p.proname = r.fn;
    if v_def is null then raise exception '%.% is not on this island', r.sch, r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '%.% has % of the lines to change, not 1', r.sch, r.fn, v_n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
