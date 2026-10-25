/*
 * Sprouts: none off a sapling, and one pick a tree an hour.
 *
 * Reported: "players can pick sprouts from saplings. Saplings should only be
 * able to be picked from trees hourly." A stage with no timber in it (a
 * sapling, or one clipped to a shrub) has no sprouts, and a tree a sprout was
 * picked off is marked `foraged` (kind `sprout`) for `sprout_cooldown`,
 * whoever picked it, a worker included (`SPROUT_COOLDOWN`).
 */
set local lock_timeout = '3s';

/* Seconds between sprouts off one tree (`SPROUT_COOLDOWN`). */
create or replace function sprout_cooldown() returns double precision
language sql immutable as $$ select 3600 $$;

create or replace function is_foraged(p_world uuid, p_x int, p_y int, p_kind text)
  returns boolean language sql stable as $$
  select exists (select 1 from foraged
    where world_id = p_world and x = p_x and y = p_y and kind = p_kind
      and now() - at < make_interval(secs => case when p_kind = 'sprout' then sprout_cooldown() else forage_cooldown() end))
$$;

do $do$
declare v_def text; v_old text; v_new text; v_n int;
begin
  -- The door: a sapling has none, and a tree picked within the hour has none yet.
  v_def := pg_get_functiondef('ground_refusal'::regproc);
  v_old := $$  elsif p_action = 'pick_sprout' then
    if here <> 16 then return 'No tree here.'; end if;
    if not coalesce((select alive from tree_age_def where id = tree_age(v_data)), true) then
      return 'Tree is dead.';
    end if;
$$;
  v_new := v_old || $$    if coalesce((select logs = 0 from tree_age_def where id = tree_age(v_data)), false) then
      return (select name from tree_age_def where id = tree_age(v_data)) || ': no sprouts.';
    end if;
    if is_foraged(p_world, tx, ty, 'sprout') then return 'Sprout already picked. Try later.'; end if;
$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'ground_refusal has % of its pick_sprout, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);

  -- And a pick marks the tree.
  v_def := pg_get_functiondef('perform_ground'::regproc);
  v_old := $$    perform gather(p_world, p_uid, 'sprout', v_n,
      product_ql(skill_of(p_world, p_uid, 'forestry')), v_tree.name);
$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'perform_ground has % of its sprout gather, not 1', v_n; end if;
  execute replace(v_def, v_old, v_old || $$    perform mark_foraged(p_world, tx, ty, 'sprout');
$$);

  -- A worker no more than a body.
  v_def := pg_get_functiondef('worker_gatherable'::regproc);
  v_old := $$coalesce((select a.alive from tree_age_def a where a.id = tree_age(land_data(p_world, p_x, p_y))), false)$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'worker_gatherable has % of its sprout age, not 1', v_n; end if;
  execute replace(v_def, v_old, $$coalesce((select a.alive and a.logs > 0 from tree_age_def a where a.id = tree_age(land_data(p_world, p_x, p_y))), false)$$);
end $do$;

select private.lock_doors();
