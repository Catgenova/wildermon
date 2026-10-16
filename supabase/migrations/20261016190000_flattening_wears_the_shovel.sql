-- Flattening wears the shovel, and four other jobs on the ground their tools.
--
-- Reported: "Flattening, 2x shovel, both not taking any dmg". It was not the
-- two: on an island a go at flattening wore no shovel at all, one or two.
-- `perform_ground` wears the tool in most of its branches, and five were
-- written without it: flattening (shovel), bedding a paving slab (trowel),
-- taking paving up (pickaxe), cutting reeds (carving knife) and prospecting
-- (pickaxe). A browser game of your own wears the job's tool on every go
-- (`completeAction`), so each of these now does the same on the island: every
-- go wears the best one of its tool in the pack, by one use's wear.

do $do$
declare r record; v_def text; v_n int;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'perform_ground';
  if v_def is null then raise exception 'perform_ground is not on this island'; end if;
  for r in select * from (values
    ('flatten', $$    v_target := flatten_target(p_world, p_uid, tx, ty);
$$),
    ('pave_slabs', $$  elsif p_action = 'pave_slabs' then
$$),
    ('remove_paving', $$  elsif p_action = 'remove_paving' then
$$),
    ('cut_reeds', $$  elsif p_action = 'cut_reeds' then
$$),
    ('prospect', $$  elsif p_action = 'prospect' then
$$)
  ) as t(job, old) loop
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception 'perform_ground has % of the % line, not 1', v_n, r.job; end if;
    v_def := replace(v_def, r.old, case when r.job = 'flatten'
      then '    -- Every go wears the best of its tool in the pack, as in a game of your own (`completeAction`).' || chr(10)
        || '    perform wear_tool(held_tool(p_world, p_uid, (select a.tool from action_def a where a.id = p_action)));' || chr(10) || r.old
      else r.old
        || '    -- Every go wears the best of its tool in the pack, as in a game of your own (`completeAction`).' || chr(10)
        || '    perform wear_tool(held_tool(p_world, p_uid, (select a.tool from action_def a where a.id = p_action)));' || chr(10)
      end);
  end loop;
  execute v_def;
end $do$;

select private.lock_doors();
