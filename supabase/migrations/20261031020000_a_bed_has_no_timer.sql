-- A bed of sand, clay, peat or tar has no timer for a worker, as it has none for a player.
--
-- Reported: "Sandpip should be collecting sand which should have no timer. It is tripping the investigation timer on
-- the sand." A sand, clay or peat worker marked the tile it collected off with 'dig' (`worker_do`), which is the mark
-- Investigate leaves, and would not work it again until the forage cooldown was past (`worker_gatherable`,
-- `worker_wait_left`). So a Sandpip with one bed in reach worked it once in three minutes, and the player could not
-- investigate that sand. The player's Collect takes off the top and leaves no mark; the workers now do the same. A
-- relic seeker still marks the ground it noses over.

set local lock_timeout = '3s';

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    ('worker_gatherable', $$  elsif p_kind in ('sand', 'clay') then
    -- Collected off the top, as a peat cutter's bed: worked again once the forage cooldown is past.
    return here = tile_id(case p_kind when 'sand' then 'Sand' else 'Clay' end)
       and not is_foraged(p_world, p_x, p_y, 'dig') and creature_tile_ok(p_world, p_x, p_y);
  elsif p_kind = 'peat' then
    return here in (tile_id('Peat'), tile_id('Tar')) and not is_foraged(p_world, p_x, p_y, 'dig')
       and creature_tile_ok(p_world, p_x, p_y);
$$, $$  elsif p_kind in ('sand', 'clay') then
    -- Collected off the top, as the player's Collect: no timer on the bed.
    return here = tile_id(case p_kind when 'sand' then 'Sand' else 'Clay' end)
       and creature_tile_ok(p_world, p_x, p_y);
  elsif p_kind = 'peat' then
    return here in (tile_id('Peat'), tile_id('Tar')) and creature_tile_ok(p_world, p_x, p_y);
$$),
    ('worker_do', $$    if here <> tile_id(case kind when 'sand' then 'Sand' else 'Clay' end) then return null; end if;
    perform mark_foraged(p_world, wx, wy, 'dig');
    return jsonb_build_object('def', kind, 'count', 1, 'ql', made_ql);

  elsif kind = 'peat' then
    perform mark_foraged(p_world, wx, wy, 'dig');
    return jsonb_build_object('def', case when here = tile_id('Tar') then 'tar' else 'peat' end,
$$, $$    if here <> tile_id(case kind when 'sand' then 'Sand' else 'Clay' end) then return null; end if;
    return jsonb_build_object('def', kind, 'count', 1, 'ql', made_ql);

  elsif kind = 'peat' then
    return jsonb_build_object('def', case when here = tile_id('Tar') then 'tar' else 'peat' end,
$$),
    ('worker_wait_left', $$       when 'sand' then f.kind = 'dig' and land_tile(p_world, f.x, f.y) = tile_id('Sand')
       when 'clay' then f.kind = 'dig' and land_tile(p_world, f.x, f.y) = tile_id('Clay')
       when 'peat' then f.kind = 'dig' and land_tile(p_world, f.x, f.y) in (tile_id('Peat'), tile_id('Tar'))
       when 'seek' then f.kind = 'dig'
$$, $$       when 'seek' then f.kind = 'dig'
$$)
  ) as t(fn, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of the lines to change, not 1', r.fn, v_n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
