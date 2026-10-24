set local lock_timeout = '3s';

-- Asked for: "After first storey is complete, no longer require completed storeys to plan 3+". Planning another storey
-- asked the storey under it to be closed in (`level_gap`) every time. Now only the second storey asks it, of the ground
-- storey; a third and up plans over a storey still going up. A railing or half wall under it still carries nothing
-- (`has_low_wall`), and the material, its height cap and the skill still answer.

do $do$
declare v_def text; v_old text; v_new text; v_n int;
begin
  v_def := pg_get_functiondef('build_refusal'::regproc);
  v_old := $$    v_gap := level_gap(p_world, b.id, b.levels - 1, p_uid);
    if v_gap is not null then return v_gap; end if;
    return null;

  elsif p_action = 'plan_floor' then$$;
  v_new := $$    -- Only the ground storey closed in before a second; a third and up plans over one still going up.
    if b.levels = 1 then
      v_gap := level_gap(p_world, b.id, b.levels - 1, p_uid);
      if v_gap is not null then return v_gap; end if;
    end if;
    return null;

  elsif p_action = 'plan_floor' then$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'build_refusal has % of the add_floor gap check, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();
