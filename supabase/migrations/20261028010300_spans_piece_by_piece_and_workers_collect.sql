-- Bridge and aqueduct spans built piece by piece; sand and clay workers Collect off the bed; a well's water as it stands.
--
-- Asked for: "implement that bridges are build piece by piece, like walls, instead of needing all pieces at once". A
-- span was refused unless every material it still wanted was to hand (`last_refusal`, `aqueduct_refusal`), though a go
-- only ever fits one piece of one of them (`perform_last`, `perform_aqueduct`). Now it is refused only when none of
-- them is to hand: "Span needs …; none to hand.", as the browser's `build_bridge` and `build_aqueduct` say.
--
-- Asked for: "wildermon that gather peat sand clay etc should be doing the Collect action not the Dig action". A sand
-- or clay worker took a step of soil off the tile and wanted soil left to do it (`worker_gatherable`, `worker_do`),
-- so a Mudlet by a pond sat idle. Now it collects off the top as a peat cutter does and as the player's Collect does:
-- the ground left as it was, the tile marked worked (`mark_foraged`, 'dig') until the forage cooldown is past. Its idle
-- reason says "clay to collect" (`work_words`), as the browser's does.
--
-- Reported with a screenshot: a well beside the dough recipe counted as "1 L + 0.00098 L stored". The island sent a
-- well's litres as of its last draw and left out when that was (`rpc_ground`), so it read as near empty however long it
-- had been refilling. It sends what is in it now.

set local lock_timeout = '3s';

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    ('last_refusal', $$        where (e.value)::int > 0 and build_to_hand(p_world, p_uid, e.key, s.x, s.y, null) < 1 order by e.key limit 1;
      if v_short is not null then
        return 'Span needs ' || span_wants(s.needed) || '; no '
          || lower((select coalesce(name, v_short) from item_def where id = v_short)) || ' to hand.';
$$, $$        where (e.value)::int > 0 and not exists (select 1 from jsonb_each(s.needed) e3
          where (e3.value)::int > 0 and build_to_hand(p_world, p_uid, e3.key, s.x, s.y, null) > 0) order by e.key limit 1;
      -- Piece by piece, as a wall: refused only when nothing it wants is to hand.
      if v_short is not null then
        return 'Span needs ' || span_wants(s.needed) || '; none to hand.';
$$),
    ('aqueduct_refusal', $$      where (e.value)::int > 0 and build_to_hand(p_world, p_uid, e.key, s.x, s.y, null) < 1 order by e.key limit 1;
    if v_short is not null then
      return 'Span needs ' || span_wants(s.needed) || '; no '
        || lower((select coalesce(name, v_short) from item_def where id = v_short)) || ' to hand.';
$$, $$      where (e.value)::int > 0 and not exists (select 1 from jsonb_each(s.needed) e3
        where (e3.value)::int > 0 and build_to_hand(p_world, p_uid, e3.key, s.x, s.y, null) > 0) order by e.key limit 1;
    -- Piece by piece, as a bridge: refused only when nothing it wants is to hand.
    if v_short is not null then
      return 'Span needs ' || span_wants(s.needed) || '; none to hand.';
$$),
    ('worker_gatherable', $$    return here = tile_id(case p_kind when 'sand' then 'Sand' else 'Clay' end)
       and land_dirt(p_world, p_x, p_y) > 0 and creature_tile_ok(p_world, p_x, p_y);
$$, $$    -- Collected off the top, as a peat cutter's bed: worked again once the forage cooldown is past.
    return here = tile_id(case p_kind when 'sand' then 'Sand' else 'Clay' end)
       and not is_foraged(p_world, p_x, p_y, 'dig') and creature_tile_ok(p_world, p_x, p_y);
$$),
    ('worker_do', $$  elsif kind in ('sand', 'clay') then
    if land_dirt(p_world, wx, wy) <= 0 then return null; end if;
    perform land_set_dirt(p_world, wx, wy, land_dirt(p_world, wx, wy) - 1);
    return jsonb_build_object('def', kind, 'count', 1, 'ql', made_ql);
$$, $$  elsif kind in ('sand', 'clay') then
    -- Collected, as the player's Collect: the ground left as it was.
    if here <> tile_id(case kind when 'sand' then 'Sand' else 'Clay' end) then return null; end if;
    perform mark_foraged(p_world, wx, wy, 'dig');
    return jsonb_build_object('def', kind, 'count', 1, 'ql', made_ql);
$$),
    -- A well's or a fountain's water as it stands now (`placed_litres`), not as it stood at its last draw: the row's
    -- `since` is not sent, so the browser read a drawn-down well as empty until the next draw.
    ('rpc_ground', $$        || jsonb_build_object('fuel', placed_fuel(pl), 'ash', placed_ash(pl),
$$, $$        || jsonb_build_object('fuel', placed_fuel(pl), 'ash', placed_ash(pl), 'litres', placed_litres(pl),
$$),
    -- Why it stands idle, in the browser's words (`IDLE_SOURCE`).
    ('work_words', $$    when 'sand'    then 'sand to dig'
    when 'clay'    then 'clay to dig'
    when 'peat'    then 'peat to cut'
$$, $$    when 'sand'    then 'sand to collect'
    when 'clay'    then 'clay to collect'
    when 'peat'    then 'peat to collect'
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
