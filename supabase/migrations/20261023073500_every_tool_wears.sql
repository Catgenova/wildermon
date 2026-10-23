set local lock_timeout = '3s';

-- Every tool wears with its action.
--
-- Asked for: "Butchering knife should take dmg from butchering", and then "sweep other tools for missing actions". The
-- browser wears an action's tool a go's worth after every action that names one (`wearTool`). Swept on the island, eight
-- actions with a tool took no wear: butcher (butchering knife), shear (carving knife), till (rake), investigate (trowel),
-- repoint_wall (trowel), clear_ivy and scrub_moss (sickle, brush), and the foundation's plan_foundation (mallet),
-- dig_pool (pickaxe), fill_pool and pour_foundation (trowel). Each now wears the best of its tool in the pack
-- (`wear_tool`, `held_tool`), once its go is under way.
do $do$
declare r record; v_def text; v_n int;
  v_wear constant text := 'perform wear_tool(held_tool(p_world, p_uid, (select a.tool from action_def a where a.id = p_action)));';
begin
  for r in select * from (values
    ('perform_fight', $a$    perform skill_raise(p_world, p_uid, 'butchering', 1);
$a$, '    '),
    ('perform_creature', $a$  elsif p_action = 'shear' then
$a$, '    '),
    ('perform_farm', $a$  if p_action = 'till' then
$a$, '    '),
    ('perform_dig', $a$    perform mark_foraged(p_world, tx, ty, 'dig');
$a$, '    '),
    ('perform_building', $a$    if w.world_id is null or mat.id is null or v_was.id is null then return; end if;
$a$, '    '),
    ('perform_green', $a$  if green_refusal(p_world, p_uid, p_action, p_target) is not null then return; end if;
$a$, '  '),
    ('perform_foundation', $a$    if foundation_reason(p_world, p_uid, tx, ty, v_top) is not null then return; end if;
$a$, '    '),
    ('perform_foundation', $a$    if pool_reason(p_world, tx, ty) is not null then return; end if;
$a$, '    '),
    ('perform_foundation', $a$    if not consume(p_world, p_uid, 'concrete', pool_fill()) then return; end if;
$a$, '    '),
    ('perform_foundation', $a$  if not consume(p_world, p_uid, 'concrete', 1) then return; end if;
$a$, '  ')
  ) as t(fn, anchor, ind) loop
    v_def := pg_get_functiondef(r.fn::regproc);
    v_n := (length(v_def) - length(replace(v_def, r.anchor, ''))) / length(r.anchor);
    if v_n <> 1 then raise exception '% has % of its anchor, not 1: %', r.fn, v_n, r.anchor; end if;
    execute replace(v_def, r.anchor, r.anchor || r.ind || '-- Its tool takes a go''s wear (`wearTool`).' || chr(10) || r.ind || v_wear || chr(10));
  end loop;
end $do$;

select private.lock_doors();
