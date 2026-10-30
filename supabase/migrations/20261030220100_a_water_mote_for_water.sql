set local lock_timeout = '3s';

-- Asked for: "implement that digging a spring takes 1 water mote. crafts like fountain, pool, pond, well, all take 1
-- water mote now as well".
--
--   * Dig a spring and Dig a pool: refused without `water_motes_each()` water motes in the pack, after the tool, in
--     the browser's words (`water_mote_need()`, `WATER_MOTE_NEED`), and use them up when dug.
--   * The fish pond, the well and the tiered fountain have as many in their bills: that is the generated recipe
--     inputs (`recipe_input`), which every craft's refusal and use already reads. Nothing here for them.
--
-- `water_mote`, `water_motes_each` and `water_mote_need` are generated (`scripts/dump-defs.ts`, off `motes.ts`);
-- these are plpgsql and read them when they run. `supabase/test/watermote.ts` holds the two sides together.

do $do$
declare v_def text; v_old text; v_new text; v_n int;
begin
  -- spring_refusal: after the shovel, for a dig.
  v_def := pg_get_functiondef('spring_refusal'::regproc);
  v_old := $$  if tool_ql(p_world, p_uid, 'shovel') <= 0 then
    return 'Need a shovel.';
  end if;
$$;
  v_new := v_old || $$  if p_action = 'dig_spring' and pack_count(p_world, p_uid, water_mote()) < water_motes_each() then
    return water_mote_need();
  end if;
$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'spring_refusal has % of the shovel check, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);

  -- perform_spring: the motes go when the spring is dug.
  v_def := pg_get_functiondef('perform_spring'::regproc);
  v_old := $$  if p_action = 'dig_spring' then
    v_c := spring_corner(p_world, tx, ty);$$;
  v_new := $$  if p_action = 'dig_spring' then
    if not consume(p_world, p_uid, water_mote(), water_motes_each()) then return; end if;
    v_c := spring_corner(p_world, tx, ty);$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'perform_spring has % of the dig, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);

  -- foundation_refusal: after the pickaxe, for a pool.
  v_def := pg_get_functiondef('foundation_refusal'::regproc);
  v_old := $$    if need_tool(p_world, p_uid, 'pickaxe') is not null then return 'Need a pickaxe.'; end if;
    return pool_reason(p_world, tx, ty);$$;
  v_new := $$    if need_tool(p_world, p_uid, 'pickaxe') is not null then return 'Need a pickaxe.'; end if;
    if pack_count(p_world, p_uid, water_mote()) < water_motes_each() then return water_mote_need(); end if;
    return pool_reason(p_world, tx, ty);$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'foundation_refusal has % of the pickaxe check, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);

  -- perform_foundation: the motes go when the pool is dug.
  v_def := pg_get_functiondef('perform_foundation'::regproc);
  v_old := $$  if p_action = 'dig_pool' then
    if pool_reason(p_world, tx, ty) is not null then return; end if;$$;
  v_new := v_old || $$
    if not consume(p_world, p_uid, water_mote(), water_motes_each()) then return; end if;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'perform_foundation has % of the pool dig, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();
