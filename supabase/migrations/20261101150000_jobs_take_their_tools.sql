-- Jobs that went without a tool take one, and every job with a tool wears it.
--
-- Asked: sewing cloth clothes takes a needle; fitting a head or a blade to a shaft a hammer; cutting grass, moss and a
-- vine and harvesting a sickle; tending and clearing a field a rake; paving with cobblestones and mixing mortar and
-- concrete a trowel; glazing and painting a brush. The recipes' and the actions' `tool` comes over in the definitions
-- (20261101141451, from `jobtools.ts`), and the general checks (`craft_refusal`, `act_refusal_rules`) refuse without
-- it. Two families answer before the general check, and each says it here, in the browser's words and order:
-- a planter's crop (`planter_refusal`) and a glaze (`item_refusal`).
--
-- And asked: "Enforce that any task that requires a tool also damages that tool". The browser wears a go's worth of
-- the job's tool after every go (`Game.completeAction`, off `ActionDef.tool` or `toolFor`); the island wore it only
-- where a performer's branch did. Now every go goes through `private.act_go`, which wears the job's tool
-- (`private.job_tool`: its `action_def.tool`, or a building job's mallet or material's tool) by the browser's `wear`
-- (`private.job_wear`) unless the performer already wore it in that go (`wear_tool` notes what it wore). Improving
-- wears every tool its material asks for (`perform_item`), as the browser's `improve_item` does. Settlement workers
-- do their work through `errand_do`, which wears nothing.

set local lock_timeout = '3s';

-- What a go wears its tool by, where it is not one go's worth: the browser's `ActionDef.wear`.
create or replace function private.job_wear(p_action text) returns double precision language sql immutable as $fn$
  select case p_action when 'dig_worms' then 0.4 when 'fish' then 0.5 when 'drag_net' then 1.4 when 'groom' then 3
                       else 1 end::double precision
$fn$;

/*
 * The tool a building job asks for, where it is not always the same: the browser's `toolFor` on each. Planning a
 * building, a wall, a floor, a storey, a column and a change, and building a ladder, take a mallet; a fence, a wall, a
 * floor and a column are built with their material's tool (a wall being changed, the new material's). Asked for what
 * stands, a change is dropped and asks for no mallet (`change_wall_refusal`).
 */
create or replace function private.build_job_tool(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
returns text language plpgsql stable as $fn$
declare tx int := (p_target->>'x')::int; ty int := (p_target->>'y')::int; b building; w wall; f floor_tile; v_mat text;
begin
  if p_action in ('plan_building', 'add_to_building', 'plan_wall', 'add_floor', 'plan_floor', 'plan_column') then
    return 'mallet';
  elsif p_action = 'change_wall' then
    w := frame_wall_at(p_world, tx, ty, p_target->>'side', p_target);
    if w.world_id is not null and wall_seen_type(p_world, p_uid, w) = p_target->>'wallType'
       and w.material = p_target->>'material' then
      return null;
    end if;
    return 'mallet';
  elsif p_action = 'plan_fence' then
    v_mat := p_target->>'material';
  elsif p_action = 'build_wall' then
    w := frame_wall_at(p_world, tx, ty, p_target->>'side', p_target);
    if w.world_id is null then return null; end if;
    v_mat := coalesce((wall_change_of(p_world, w)).material, w.material);
  elsif p_action in ('build_floor', 'build_column') then
    select * into b from building where world_id = p_world and id = building_at(p_world, tx, ty);
    b := frame_building(p_world, p_action, p_target, b);
    if b.id is null then return null; end if;
    if p_action = 'build_floor' then
      select * into f from floor_tile where world_id = p_world and x = tx and y = ty
         and level = frame_floor_level(p_world, b.id, coalesce(p_target->>'floorKind', 'floor'), p_target);
      if f.world_id is null then return null; end if;
      if f.kind = 'ladder' then return 'mallet'; end if;
      v_mat := f.material;
    else
      select c.material into v_mat from building_column c
       where c.world_id = p_world and c.level = frame_job_level(b, p_target)
         and c.x = (p_target->>'cx')::int and c.y = (p_target->>'cy')::int;
    end if;
  else
    return null;
  end if;
  return (select m.tool from build_material_def m where m.id = v_mat);
end $fn$;

-- The tool a go of a job asks for: the browser's `ActionDef.tool`, or its `toolFor`.
create or replace function private.job_tool(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
returns text language sql stable as $fn$
  select coalesce(action_tool(p_action), private.build_job_tool(p_world, p_uid, p_action, p_target))
$fn$;

-- A go: the job, and then its tool's wear where the performer did not wear it (`Game.completeAction`).
create or replace function private.act_go(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
returns void language plpgsql as $fn$
declare v_tool text;
begin
  -- Asked before the go changes what it is asked of: a wall's material, as the wall is finished.
  v_tool := private.job_tool(p_world, p_uid, p_action, p_target);
  perform set_config('wurm.worn', '', true);
  perform act_perform(p_world, p_uid, p_action, p_target);
  if v_tool is not null and position(',' || v_tool || ',' in ',' || coalesce(current_setting('wurm.worn', true), '')) = 0 then
    perform wear_tool(held_tool(p_world, p_uid, v_tool), private.job_wear(p_action));
  end if;
  perform set_config('wurm.worn', '', true);
end $fn$;

do $do$
declare r record; v_def text; v_n int;
  v_need constant text := $$need_tool(p_world, p_uid, action_tool(p_action))$$;
begin
  for r in select * from (values
    -- What a go wore, for `private.act_go`.
    ('public', 'wear_tool',
     $$  select * into it from item where id = p_item;
  if not found then return; end if;$$,
     $$  select * into it from item where id = p_item;
  if not found then return; end if;
  perform set_config('wurm.worn', coalesce(current_setting('wurm.worn', true), '') || it.def || ',', true);$$),
    -- Every go of a job, and every piece of a plan laid out over an area, through `private.act_go`.
    ('public', 'settle',
     $$      perform act_perform(p_world, p_uid, p.act, p.act_target);$$,
     $$      perform private.act_go(p_world, p_uid, p.act, p.act_target);$$),
    ('private', 'area_go',
     $$  perform act_perform(p_world, p_uid, p_action, p_target);$$,
     $$  perform private.act_go(p_world, p_uid, p_action, p_target);$$),
    -- A planter's crop: its tool first, as the general tool check is asked of a field's (`act_refusal_rules`).
    ('public', 'planter_refusal',
     $$begin
  if not is_planter(p.sub) then$$,
     $$begin
  if action_tool(p_action) is not null and $$ || v_need || $$ is not null then return $$ || v_need || $$; end if;
  if not is_planter(p.sub) then$$),
    -- A glaze's brush, after whether it is glazed and before the ash (`glaze_item`).
    ('public', 'item_refusal',
     $$    if coalesce(v_it.mark, '{}'::jsonb) ? 'glaze' then return 'Already glazed.'; end if;$$,
     $$    if coalesce(v_it.mark, '{}'::jsonb) ? 'glaze' then return 'Already glazed.'; end if;
    if $$ || v_need || $$ is not null then return $$ || v_need || $$; end if;$$),
    -- Improving wears every tool its material asks for (`improve_item`).
    ('public', 'perform_item',
     $$    if v_stock.id is null or not spend_stack(p_world, p_uid, v_stock.id, 1) then return; end if;$$,
     $$    if v_stock.id is null or not spend_stack(p_world, p_uid, v_stock.id, 1) then return; end if;
    perform wear_tool(held_tool(p_world, p_uid, t.tool)) from improve_tool t where t.material = v_mat.id order by t.ord;$$)
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
