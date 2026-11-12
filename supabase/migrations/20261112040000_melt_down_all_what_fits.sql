-- Melt down all: what fits goes in, and what comes back is said
--
-- Reported: "putting all to melt down doesn't work, or it doesn't give game
-- messages when something is returned." Both. "All" of a stack whose lumps
-- were more than the furnace had room for was refused whole ("Smelter full.")
-- however empty the furnace stood: three hundred nails are thirty lumps and a
-- smelter holds twenty. And the lumps a melt gave back came out unsaid to
-- whoever melted them: a furnace told its maker alone, in "The smelter
-- finishes 5 pieces, the last of them a iron lump", with no count of each
-- kind and no QL.
--
-- So a melt takes the most of the stack whose lumps fit (`melt_fits`, the
-- browser's `meltFits`) and says how many stayed in the pack, in the words a
-- store uses for it (`melting_said`, the browser's `meltingSaid`):
--   Melting: 200 × nails. Gives 20 × iron lump, QL 28.0. 100 did not fit.
-- Each job a furnace is given now carries whose it is (`by`), and work that
-- comes out is told to that body, the maker when nobody is named, one line
-- for all that came out of one look (`furnace_made_said`, the browser's
-- `furnaceMadeSaid`):
--   Smelter made: 5 × iron lump, QL 32.2.

/** How many of `p_count` go in with `p_room` jobs free: the most whose lumps fit, 0 when not one does. The browser's `meltFits`. */
create or replace function melt_fits(it item, p_count integer, p_room integer, p_share double precision)
returns integer language plpgsql stable as $fn$
declare per double precision := coalesce(item_metal(it), 0) * p_share; n int;
begin
  if p_count < 1 or p_room < 1 then return 0; end if;
  n := case when per > 0 then least(p_count, greatest(0, ceil((p_room + 0.5) / per)::int - 1)) else p_count end;
  while n > 0 and melt_lumps(it, n, p_share) > p_room loop n := n - 1; end loop;
  while n < p_count and melt_lumps(it, n + 1, p_share) <= p_room loop n := n + 1; end loop;
  return n;
end $fn$;

/** What a melt says. The browser's `meltingSaid`. */
create or replace function melting_said(p_n integer, p_what text, p_lumps integer, p_metal text, p_ql double precision, p_left integer)
returns text language sql immutable as $fn$
  select 'Melting: ' || case when p_n > 1 then p_n || ' × ' else '' end || lower(p_what) || '.'
    || ' Gives ' || p_lumps || ' × ' || lower(p_metal) || ' lump, QL ' || fixed_to(p_ql, 1) || '.'
    || case when p_left > 0 then ' ' || p_left || ' did not fit.' else '' end
$fn$;

/** What a furnace says when work comes out, off a folded output ({def, piece, count, ql}). The browser's `furnaceMadeSaid`. */
create or replace function furnace_made_said(p_kind text, p_made jsonb)
returns text language sql stable as $fn$
  select case when p_kind = 'kiln' then 'Kiln fired' else 'Smelter made' end || ': '
    || string_agg(case when coalesce((m->>'count')::int, 1) > 1 then (m->>'count') || ' × ' else '' end
         || made_name(m->>'def', m->>'piece') || ', QL ' || fixed_to((m->>'ql')::double precision, 1), '; ' order by o)
    || '.'
  from jsonb_array_elements(p_made) with ordinality as e(m, o)
$fn$;

CREATE OR REPLACE FUNCTION public.firing_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare v_p placed; v_it item; v_mould item; v_metal metal_def; v_need int; d mould_def;
begin
  perform furnace_settle(p_world, nullif(p_target->>'id', '')::bigint);
  v_p := target_placed(p_world, p_target);
  if v_p.id is null then return 'It is gone.'; end if;
  if not placed_in_reach(p_world, p_uid, v_p.id, 2.6) then
    return 'Stand next to the ' || v_p.kind || '.';
  end if;

  if p_action in ('smelter_take_all', 'kiln_take_all') then
    if jsonb_array_length(furnace_output(v_p)) = 0 then
      return case when p_action = 'kiln_take_all' then 'Nothing is fired yet.' else 'Nothing is finished yet.' end;
    end if;
    return null;
  end if;

  -- What goes in is at hand: in the pack, a bag, or a store within reach.
  select * into v_it from item where id = target_item(p_target)
    and world_id = p_world and at_hand(p_world, p_uid, id);

  if p_action = 'smelt_ore' then
    if not found or (metal_by_ore(v_it.def)).id is null then return 'Ore only.'; end if;
    -- A charge is twenty kilograms of ore, which is `ore_per_lump` of them.
    if v_it.count < ore_per_lump() then
      return 'Need ' || ore_per_lump()::int || ' ore; have ' || v_it.count || '.';
    end if;
    if jsonb_array_length(furnace_jobs(v_p)) >= furnace_capacity(v_p) then
      return 'Smelter full.';
    end if;
    return null;

  elsif p_action = 'melt_down' then
    -- Scrap goes back into the fire: anything cast from metal, or hafted to a
    -- cast head, in the words the browser uses.
    if not found then return 'Choose something to melt down.'; end if;
    if v_it.locked then return 'It is kept back. Put it back in the pack first.'; end if;
    v_metal := metal_by_name(v_it.extra);
    if v_metal.id is null or item_metal(v_it) is null then
      return 'Not meltable metal.';
    end if;
    -- "All" melts what fits; full is when not one of it does.
    if melt_fits(v_it, least(greatest(1, coalesce((p_target->>'count')::int, 1)), v_it.count),
                 furnace_capacity(v_p) - jsonb_array_length(furnace_jobs(v_p)),
                 pk(p_world, p_uid, 'melt:share', melt_share())) < 1 then
      return 'Smelter full.';
    end if;
    return null;

  elsif p_action = 'load_kiln' then
    if not found then
      select i.* into v_it from craft_stock(p_world, p_uid) s join item i on i.id = s.id
        where exists (select 1 from pottery_def where unfired = s.def) order by s.draw limit 1;
    end if;
    if not found or not exists (select 1 from pottery_def where unfired = v_it.def) then
      return 'Unfired clay only.';
    end if;
    if jsonb_array_length(furnace_jobs(v_p)) >= furnace_capacity(v_p) then
      return 'Kiln full.';
    end if;
    return null;

  elsif p_action = 'pour_mould' then
    -- Every mould but the anvil's is filled here and cools into a casting for
    -- the anvil, in the words the browser uses.
    select * into v_mould from item where world_id = p_world and id = target_mould(p_target)
      and holder = 'player' and holder_uid = p_uid;
    if v_mould.id is null then return 'Choose a mould.'; end if;
    select * into d from mould_def where id = v_mould.def;
    if d.id is null then return 'Choose a mould.'; end if;
    if d.makes = 'anvil' then return 'Use Cast an anvil.'; end if;
    if need_tool(p_world, p_uid, smith_tool()) is not null then return need_tool(p_world, p_uid, smith_tool()); end if;
    v_metal := metal_by_bar(v_it.def);
    if v_it.id is null or v_metal.id is null then return 'Need metal.'; end if;
    v_need := mould_lumps(d.id, v_metal.id);
    -- An ingot counts as its lumps (a Smith's Ingots).
    if v_it.count * (case when v_it.def = v_metal.lump then 1 else ingot_lumps() end) < v_need then
      return 'Need ' || v_need || ' lumps.';
    end if;
    if jsonb_array_length(furnace_jobs(v_p)) >= furnace_capacity(v_p) then
      return 'Smelter full.';
    end if;
    return null;

  elsif p_action = 'cast_anvil' then
    if pack_count(p_world, p_uid, 'anvil_mould') <= 0 then return 'Need an anvil mould.'; end if;
    if need_tool(p_world, p_uid, smith_tool()) is not null then return need_tool(p_world, p_uid, smith_tool()); end if;
    v_metal := metal_by_bar(v_it.def);
    if not found or v_metal.id is null then return 'Choose the metal to pour.'; end if;
    v_need := mould_lumps('anvil_mould', v_metal.id);
    if v_it.count * (case when v_it.def = v_metal.lump then 1 else ingot_lumps() end) < v_need then
      return 'Need ' || v_need || ' lumps of ' || lower(v_metal.name) || '.';
    end if;
    return null;

  elsif p_action = 'pour_ingot' then
    -- In the words the browser uses.
    if pk(p_world, p_uid, 'ingot', 0) <= 0 then return 'Need perk: Ingots (Smith).'; end if;
    v_metal := metal_by_lump(v_it.def);
    if not found or v_metal.id is null then return 'Choose the metal to pour.'; end if;
    if v_it.count < ingot_lumps() then
      return 'Need ' || ingot_lumps() || ' lumps; have ' || v_it.count || '.';
    end if;
    return null;
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.perform_firing(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare v_p placed; v_it item; v_mould item; v_metal metal_def; v_need int; v_n int;
        v_secs double precision; v_ql double precision; v_jobs jsonb; v_out jsonb;
        v_one jsonb; v_names text[] := '{}'; v_makes text; v_i int;
        d mould_def; v_mould_ql double precision; v_wear double precision; v_broke boolean;
        v_bar item; v_want int;
begin
  v_p := target_placed(p_world, p_target);
  if v_p.id is null then return; end if;

  if p_action in ('smelter_take_all', 'kiln_take_all') then
    v_out := furnace_output(v_p);
    for v_one in select * from jsonb_array_elements(v_out) loop
      -- With its shaper's mark, which a pot, a bowl or a jar carries through the fire.
      perform give(p_world, p_uid, v_one->>'def', (v_one->>'count')::int,
        (v_one->>'ql')::double precision, v_one->>'extra', null, null, v_one->>'piece', nullif(v_one->'mark', 'null'::jsonb));
      v_names := v_names || ((case when (v_one->>'count')::int > 1 then (v_one->>'count') || ' × ' else '' end)
        || made_name(v_one->>'def', v_one->>'piece'));
    end loop;
    if array_length(v_names, 1) is null then return; end if;
    update placed set state = jsonb_set(state, '{output}', '[]'::jsonb) where id = v_p.id;
    perform tell(p_world, p_uid, case when p_action = 'kiln_take_all' then 'Taken from kiln: ' else 'Taken from smelter: ' end
      || array_to_string(v_names, ', ') || '.', 'event');
    return;
  end if;

  select * into v_it from item where id = target_item(p_target);
  v_jobs := furnace_jobs(v_p);

  if p_action = 'smelt_ore' then
    v_metal := metal_by_ore(v_it.def);
    if v_metal.id is null then return; end if;
    /*
     * Charges, not ore. One charge is `ore_per_lump` of it and comes out as one
     * lump, so "all" of a stack of fifty-seven is five charges with seven left
     * over rather than fifty-seven lumps.
     */
    v_n := least(greatest(1, floor(coalesce((p_target->>'count')::int, 1) / ore_per_lump())::int),
                 floor(v_it.count / ore_per_lump())::int,
                 furnace_capacity(v_p) - jsonb_array_length(v_jobs));
    if v_n < 1 then return; end if;
    if not spend_stack(p_world, p_uid, v_it.id, v_n * ore_per_lump()::int) then return; end if;
    v_secs := smelt_seconds(v_metal.id, v_it.ql, v_p.ql);
    for v_i in 1..v_n loop
      v_jobs := v_jobs || jsonb_build_object('makes', v_metal.lump, 'left', v_secs,
        'total', v_secs, 'ql', v_it.ql, 'by', p_uid);
    end loop;
    update placed set state = jsonb_set(coalesce(state, '{}'::jsonb), '{jobs}', v_jobs) where id = v_p.id;
    perform tell(p_world, p_uid, 'Charged: '
      || (v_n * ore_per_lump()::int) || ' × '
      || lower((select name from item_def where id = v_it.def))
      || case when v_n > 1 then ', ' || v_n || ' charges' else '' end
      || '. Per charge: about ' || round(v_secs) || ' seconds of heat, one lump.', 'event');
    -- Smelting, for the journal: ore into the fire, which is the job; the lump comes back on the furnace's clock.
    perform journal_note(p_world, p_uid, 'smelted');

  elsif p_action = 'melt_down' then
    v_metal := metal_by_name(v_it.extra);
    if v_metal.id is null or item_metal(v_it) is null then return; end if;
    v_want := least(greatest(1, coalesce((p_target->>'count')::int, 1)), v_it.count);
    -- "All" of a stack melts what fits and leaves the rest in the pack.
    -- More of it, and better, for a Smith's Reclaimer.
    v_n := melt_fits(v_it, v_want, furnace_capacity(v_p) - jsonb_array_length(v_jobs),
                     pk(p_world, p_uid, 'melt:share', melt_share()));
    if v_n < 1 then return; end if;
    v_need := melt_lumps(v_it, v_n, pk(p_world, p_uid, 'melt:share', melt_share()));
    v_ql := melt_ql(v_it.ql, v_it.dmg, pk(p_world, p_uid, 'melt:keep', melt_keep()));
    -- Scrap is quicker than ore: it has been through the fire once already.
    v_secs := smelt_seconds(v_metal.id, v_it.ql, v_p.ql) * melt_heat();
    if not spend_stack(p_world, p_uid, v_it.id, v_n) then return; end if;
    for v_i in 1..v_need loop
      v_jobs := v_jobs || jsonb_build_object('makes', v_metal.lump, 'left', v_secs, 'total', v_secs, 'ql', v_ql, 'by', p_uid);
    end loop;
    update placed set state = jsonb_set(coalesce(state, '{}'::jsonb), '{jobs}', v_jobs) where id = v_p.id;
    perform journal_note(p_world, p_uid, 'melted');
    perform tell(p_world, p_uid, melting_said(v_n, made_name(v_it.def, v_it.piece), v_need, v_metal.name, v_ql, v_want - v_n), 'event');

  elsif p_action = 'load_kiln' then
    if v_it.id is null then
      select i.* into v_it from craft_stock(p_world, p_uid) s join item i on i.id = s.id
        where exists (select 1 from pottery_def where unfired = s.def) order by s.draw limit 1;
    end if;
    v_makes := (select fired from pottery_def where unfired = v_it.def);
    if v_makes is null then return; end if;
    v_n := greatest(1, least(least(coalesce((p_target->>'count')::int, 1), v_it.count),
      furnace_capacity(v_p) - jsonb_array_length(v_jobs)));
    if not spend_stack(p_world, p_uid, v_it.id, v_n) then return; end if;
    v_secs := fire_seconds(v_it.def, v_p.ql);
    v_ql := fired_ql(v_it.ql, v_p.ql);
    for v_i in 1..v_n loop
      v_jobs := v_jobs || jsonb_build_object('makes', v_makes, 'left', v_secs, 'total', v_secs, 'ql', v_ql, 'mark', v_it.mark, 'by', p_uid);
    end loop;
    update placed set state = jsonb_set(coalesce(state, '{}'::jsonb), '{jobs}', v_jobs) where id = v_p.id;
    perform journal_note(p_world, p_uid, 'fired:' || v_makes, v_n);
    perform tell(p_world, p_uid, 'Packed: '
      || case when v_n > 1 then v_n || ' × ' else '' end
      || lower((select name from item_def where id = v_it.def))
      || '. About ' || round(v_secs) || ' seconds of heat each.', 'event');

  elsif p_action = 'cast_anvil' then
    v_metal := metal_by_bar(v_it.def);
    v_need := mould_lumps('anvil_mould', v_metal.id);
    select i.* into v_mould from item i where i.world_id = p_world and i.holder = 'player'
      and i.holder_uid = p_uid and i.def = 'anvil_mould' order by i.ql desc limit 1;
    if v_metal.id is null or v_mould.id is null then return; end if;
    -- Bars count as their lumps (a Smith's Ingots): broken into for what it takes.
    if v_it.def <> v_metal.lump then
      if v_it.count * ingot_lumps() < v_need then return; end if;
      v_it := unbar(p_world, p_uid, v_it.id, v_need);
      if v_it.id is null then return; end if;
    end if;
    if v_it.count < v_need then return; end if;
    if not spend_stack(p_world, p_uid, v_it.id, v_need) then return; end if;
    -- The mould is spent by a piece this size, whatever quality it was.
    if not consume(p_world, p_uid, 'anvil_mould', 1, v_mould.id) then return; end if;
    v_ql := greatest(1, least(100, (v_it.ql + v_mould.ql
      + product_ql(skill_of(p_world, p_uid, 'blacksmithing'))) / 3));
    v_secs := cast_seconds(v_metal.id, v_ql);
    -- An anvil remembers what it was poured from; that is what `extra` is for.
    v_jobs := v_jobs || jsonb_build_object('makes', 'anvil', 'left', v_secs, 'total', v_secs,
      'ql', v_ql, 'extra', v_metal.id, 'by', p_uid);
    update placed set state = jsonb_set(coalesce(state, '{}'::jsonb), '{jobs}', v_jobs) where id = v_p.id;
    perform tell(p_world, p_uid, 'Poured: ' || v_need || ' × ' || lower(v_metal.name)
      || ' lump into the anvil mould. Cools in about ' || round(v_secs) || ' seconds.', 'event');
    perform skill_raise(p_world, p_uid, mould_skill(), 1);

  elsif p_action = 'pour_mould' then
    select * into v_mould from item where world_id = p_world and id = target_mould(p_target)
      and holder = 'player' and holder_uid = p_uid;
    select * into d from mould_def where id = v_mould.def;
    v_metal := metal_by_bar(v_it.def);
    if v_mould.id is null or d.id is null or d.makes = 'anvil' or v_metal.id is null then return; end if;
    v_need := mould_lumps(d.id, v_metal.id);
    if jsonb_array_length(v_jobs) >= furnace_capacity(v_p) then return; end if;
    -- Bars count as their lumps (a Smith's Ingots): broken into for what it takes.
    if v_it.def <> v_metal.lump then
      if v_it.count * ingot_lumps() < v_need then return; end if;
      v_it := unbar(p_world, p_uid, v_it.id, v_need);
      if v_it.id is null then return; end if;
    end if;
    if v_it.count < v_need then return; end if;
    if not spend_stack(p_world, p_uid, v_it.id, v_need) then return; end if;
    -- Every filling wears the mould, and a hard metal takes more out of it;
    -- no mould can be mended.
    -- A worn mould pours worse by half its damage, or not at all for a Smith's Clean Pour.
    v_mould_ql := greatest(1, v_mould.ql - v_mould.dmg * pk(p_world, p_uid, 'pour:wear', 0.5));
    -- And a mould its maker marked to last (a Smith's Hard Sand) takes that much less a filling.
    v_wear := mould_wear(v_mould.ql) * (1 + (mat_of(v_metal.name)).difficulty / 30) / mark_of(v_mould.mark, 'last');
    v_broke := v_mould.dmg + v_wear >= 100;
    if v_broke then
      delete from item where id = v_mould.id;
    else
      update item set dmg = least(100, v_mould.dmg + v_wear) where id = v_mould.id;
    end if;
    -- The pour is the smelter's work: the metal, the mould and the hands at the furnace.
    v_ql := greatest(1, least(100, (v_it.ql + v_mould_ql
      + product_ql(skill_of(p_world, p_uid, 'smelting'))) / 3));
    v_secs := pour_seconds(d.id, v_metal.id, v_ql);
    -- A bell or a statue is a casting already and wants no anvil; everything
    -- else comes out as a casting of the piece, for the anvil to beat true.
    v_jobs := v_jobs || case when right(d.makes, 8) = '_casting'
      then jsonb_build_object('makes', d.makes, 'left', v_secs, 'total', v_secs, 'ql', v_ql,
                              'extra', v_metal.name, 'by', p_uid)
      else jsonb_build_object('makes', 'casting', 'left', v_secs, 'total', v_secs, 'ql', v_ql,
                              'extra', v_metal.name, 'piece', d.makes, 'by', p_uid) end;
    update placed set state = jsonb_set(coalesce(state, '{}'::jsonb), '{jobs}', v_jobs) where id = v_p.id;
    perform tell(p_world, p_uid, 'Poured: ' || v_need || ' × '
      || lower(v_metal.name) || ' lump into the ' || lower(d.name)
      || '. Cools in about ' || round(v_secs) || ' seconds.'
      || case when v_broke then ' Mould broken.'
              else ' Mould: ' || mould_uses_left(v_mould.ql, v_mould.dmg + v_wear, mark_of(v_mould.mark, 'last'))
                   || ' fillings left.' end, 'event');
    perform skill_raise(p_world, p_uid, mould_skill(), 1);

  elsif p_action = 'pour_ingot' then
    -- A Smith's Ingots: five lumps of one metal into a bar at their quality.
    v_metal := metal_by_lump(v_it.def);
    if v_metal.id is null or pk(p_world, p_uid, 'ingot', 0) <= 0 or v_it.count < ingot_lumps() then return; end if;
    v_bar := v_it;
    if not spend_stack(p_world, p_uid, v_it.id, ingot_lumps()) then return; end if;
    perform give(p_world, p_uid, v_metal.id || '_ingot', 1, v_bar.ql, null, v_bar.rare, v_bar.maker);
    perform tell(p_world, p_uid, 'Poured: ' || ingot_lumps() || ' × ' || lower(v_metal.name)
      || ' lump into an ingot, QL ' || to_char(v_bar.ql, 'FM990.0') || '.', 'event');
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.furnace_settle(p_world uuid, p_id bigint)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare p placed; budget double precision; jobs jsonb; out_j jsonb; done jsonb;
        v_job jsonb; v_left double precision; made int := 0; was_lit boolean;
        v_whose jsonb := '{}'::jsonb; v_to text;
begin
  select * into p from placed where id = p_id and world_id = p_world for update;
  if not found then return 0; end if;
  -- Seconds of burning it has done since anybody last looked. A furnace that
  -- ran out of fuel on Tuesday gets Tuesday's seconds and not a moment more.
  -- Fuel burnt, over the fuel a second of heat takes: more seconds of it for an Ember Heart (`placed_burn_rate`).
  budget := case when p.lit then least(placed_fuel_spent(p), p.fuel) / placed_burn_rate(p) else 0 end;
  was_lit := p.lit;
  perform placed_settle(p_id);
  select * into p from placed where id = p_id;

  jobs := furnace_jobs(p);
  done := furnace_output(p);
  out_j := '[]'::jsonb;

  for v_job in select * from jsonb_array_elements(jobs) loop
    v_left := (v_job->>'left')::double precision;
    if budget <= 0 then
      out_j := out_j || v_job;
      continue;
    end if;
    if v_left > budget then
      out_j := out_j || jsonb_set(v_job, '{left}', to_jsonb(v_left - budget));
      budget := 0;
      continue;
    end if;
    -- It came out. Whatever is left of the budget goes on the next one.
    budget := budget - v_left;
    -- Folded into what is waiting of its kind, the way a pack folds it: one
    -- entry of twenty rather than twenty of one, and the quality the average.
    done := furnace_fold(done, v_job);
    -- And folded again under whoever put it in, to be told: the maker when nobody is named.
    v_to := coalesce(v_job->>'by', p.made_by::text);
    if v_to is not null then
      v_whose := jsonb_set(v_whose, array[v_to], furnace_fold(coalesce(v_whose->v_to, '[]'::jsonb), v_job));
    end if;
    made := made + 1;
  end loop;

  update placed set state = jsonb_set(jsonb_set(coalesce(state, '{}'::jsonb),
      '{jobs}', out_j), '{output}', done)
    where id = p_id;

  -- What came out, said to whoever put it in: each kind, its count and its QL.
  for v_to in select jsonb_object_keys(v_whose) loop
    perform tell(p_world, v_to::uuid, furnace_made_said(p.kind, v_whose->v_to), 'event');
  end loop;
  if was_lit and not (select lit from placed where id = p_id) then
    if p.made_by is not null then
      perform tell(p_world, p.made_by, 'A ' || p.kind
        || ' burns through the last of its fuel and goes cold.', 'event');
    end if;
  end if;
  return made;
end $function$
;

select private.lock_doors();
