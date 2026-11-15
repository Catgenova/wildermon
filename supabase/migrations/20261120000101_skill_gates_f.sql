-- Skill gates, the sixth set (batch F): the sweep's recommended gates, and a trade's first steps brought down.
--
--   * Rows of `skill_gate` (`20261120000093_defs.sql`, `npm run defs`): Graft (forestry 50) and a listed cross (animal
--     husbandry 50) onto the rule; the water lily 10 and the lotus 20 (botanizing); a treasure map by its tier (digging:
--     worn 1, sound 20, fine 40, grand 60); every bridge (a material bridge at its material's gate, the garden
--     footbridge 10, the rope bridge 20, the drawbridge 50, the aqueduct 70); smelting an ore and working a casting at
--     the anvil by the metal, both off the pouring table (`METAL_GATE`: copper and iron 1, tin 10 …; an alloy at its mixing recipe's,
--     batch G), a casting in the trade its mould is worked in; a stone set in a circlet by its rarity (jewellery
--     30/40/50/60); the six spells at their levels (1 and 30). A lily root and a treasure map are unidentified under
--     their gate (`skill_gate_item`). The bowstring, the short bow, the awl, leather, papyrus, the paper press and rope
--     come down to 1.
--   * Every one refused in the one rule's words (`skill_gate_refusal`): "Tin smelting: needs smelting 10; have 2.3.";
--     a lily root and a map named as the reader sees them ("Unidentified map: needs digging 20; have 4.0.").
--   * Workers at their own level in the gate's skill: a smelter worker or a stoker takes only ore its smelting smelts,
--     a water planter only roots and seeds its botanizing plants (idle `gate` naming the lowest, "in your settlement
--     stores"), a hod carrier fits only spans of a bridge its own level in the bridge's trade may build, and a nail or
--     ribbon smith beats out only metal whose casting its blacksmithing works.

set local lock_timeout = '3s';

create or replace function pg_temp.patch_fn(p_sig regprocedure, p_old text, p_new text, p_times int default 1) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_times then
    raise exception '%: % of "%", wanted %', p_sig, v_n, left(p_old, 120), p_times;
  end if;
  execute replace(v_def, p_old, p_new);
end $p$;

/* ---- The one check, by kind and id ---------------------------------------------------------------------------- */

-- A thing's gate for somebody, in the one rule's words, or null (`kindGateRefusal`).
create or replace function kind_gate_refusal(p_world uuid, p_uid uuid, p_kind text, p_id text) returns text
language sql stable as $$
  select skill_gate_refusal(g.name, g.skill, skill_of(p_world, p_uid, g.skill), g.level)
    from skill_gate g where g.kind = p_kind and g.id = p_id
$$;

/* ---- Graft, a listed cross, spells: onto the rule ------------------------------------------------------------- */

select pg_temp.patch_fn('ground_refusal(uuid,uuid,text,jsonb)',
$o$    -- Grafting is the forester's finest work, and a beginner's graft is a
    -- sprout thrown away.
    if skill_of(p_world, p_uid, 'forestry') < graft_skill() then
      return 'Needs forestry ' || graft_skill() || '.';
    end if;$o$,
$n$    -- Its gate (kind `graft`): "Graft: needs forestry 50; have 12.0."
    if kind_gate_refusal(p_world, p_uid, 'graft', 'graft') is not null then
      return kind_gate_refusal(p_world, p_uid, 'graft', 'graft');
    end if;$n$);

select pg_temp.patch_fn('cross_refuses(uuid,uuid,creature,creature)',
$o$  v_skill := skill_of(p_world, p_uid, 'animal_husbandry');
  if v_skill < cross_skill() then
    return 'Cross: animal husbandry ' || cross_skill()::int || ' needed, yours ' || floor(v_skill)::int || '.';
  end if;$o$,
$n$  -- Its gate (kind `cross`): "Cross: needs animal husbandry 50; have 12.0."
  if kind_gate_refusal(p_world, p_uid, 'cross', 'cross') is not null then
    return kind_gate_refusal(p_world, p_uid, 'cross', 'cross');
  end if;$n$);

select pg_temp.patch_fn('spell_refusal(uuid,uuid,text)',
$o$  if skill_of(p_world, p_uid, sc.skill) < d.level then
    return d.name || ' takes ' || d.level::int || ' ' || sc.id || '; you have '
        || floor(skill_of(p_world, p_uid, sc.skill))::int || '.';
  end if;$o$,
$n$  -- Its gate (kind `spell`): "Pyre: needs kindling 30; have 12.0."
  if kind_gate_refusal(p_world, p_uid, 'spell', d.id) is not null then
    return kind_gate_refusal(p_world, p_uid, 'spell', d.id);
  end if;$n$);

/* ---- Water plants ----------------------------------------------------------------------------------------------- */

-- Planting a water plant under its gate, named as the planter sees what is planted: "Unidentified root: needs
-- botanizing 10; have 2.0.", "Lotus: needs botanizing 20; have 4.0."; or null (`waterPlantGateRefusal`).
create or replace function water_plant_gate_refusal(p_world uuid, p_uid uuid, p_kind text) returns text
language sql stable as $$
  select skill_gate_refusal(seen_name(p_world, p_uid, w.from_item, null, g.name), g.skill, skill_of(p_world, p_uid, g.skill), g.level)
    from water_plant_def w join skill_gate g on g.kind = 'water_plant' and g.id = w.id
   where w.id = p_kind
$$;

-- The roots and seeds a worker's own botanizing plants (`workerWaterPlantOpen`), in the plants' order.
create or replace function worker_roots(c creature) returns text[]
language sql stable as $$
  select coalesce(array_agg(w.from_item order by w.id), '{}')
    from water_plant_def w where worker_gate_open(c, skill_gate_of('water_plant', w.id))
$$;

select pg_temp.patch_fn('water_garden_refusal(uuid,uuid,text,jsonb)',
$o$          || '.';
    end if;
    return null;
  end if;
  if p_action = 'pick_water_plant'$o$,
$n$          || '.';
    end if;
    return water_plant_gate_refusal(p_world, p_uid, v_kind);
  end if;
  if p_action = 'pick_water_plant'$n$);

-- A lily pond's lily, as one planted in open water.
select pg_temp.patch_fn('adorn_refusal(uuid,uuid,text,jsonb)',
$o$                                and i.def = 'lily_root' and not i.locked) then null else adorn_said('noLily', null, null, null) end;$o$,
$n$                                and i.def = 'lily_root' and not i.locked) then water_plant_gate_refusal(p_world, p_uid, 'lily')
                else adorn_said('noLily', null, null, null) end;$n$);

-- A water planter: only roots and seeds its own botanizing plants; with only others in the stores, `gate` naming the
-- lowest.
select pg_temp.patch_fn('errand_step(uuid,integer,text)',
$o$    declare v_s record; v_at record; v_roots text[] := array(select w.from_item from water_plant_def w order by w.id);
            v_hold boolean := coalesce(c.carrying->>'def' = any(array(select w.from_item from water_plant_def w)), false);$o$,
$n$    declare v_s record; v_at record; v_roots text[] := worker_roots(c);
            v_hold boolean := coalesce(c.carrying->>'def' = any(worker_roots(c)), false);$n$);
select pg_temp.patch_fn('errand_step(uuid,integer,text)',
$o$        select * into v_s from store_holding(p_world, c.keeper, v_roots, c.to_x, c.to_y);
        if v_s.x is null then why := 'stock'; why_n := null; return next; return; end if;$o$,
$n$        select * into v_s from store_holding(p_world, c.keeper, v_roots, c.to_x, c.to_y);
        if v_s.x is null then
          why := 'stock'; why_n := null;
          select array['water_plant', g.id] into why_what
            from water_plant_def w join skill_gate g on g.kind = 'water_plant' and g.id = w.id
           where stores_count(p_world, c.keeper, w.from_item) > 0 order by g.level, g.id collate "C" limit 1;
          if why_what is not null then why := 'gate'; end if;
          return next; return;
        end if;$n$);
select pg_temp.patch_fn('errand_do(uuid,integer,boolean,text)',
$o$    declare v_kind text; v_hold boolean := coalesce(c.carrying->>'def' = any(array(select w.from_item from water_plant_def w)), false);$o$,
$n$    declare v_kind text; v_hold boolean := coalesce(c.carrying->>'def' = any(worker_roots(c)), false);$n$);
select pg_temp.patch_fn('errand_do(uuid,integer,boolean,text)',
$o$take_some_stored(p_world, c.keeper, array(select w.from_item from water_plant_def w order by w.id),$o$,
$n$take_some_stored(p_world, c.keeper, worker_roots(c),$n$);

/* ---- Treasure maps, by tier ------------------------------------------------------------------------------------- */

-- Dig it up (and how warm, which is its refusal): under the map's tier's gate, named as the reader sees it.
select pg_temp.patch_fn('treasure_refusal(uuid,uuid,text,jsonb)',
$o$  if v_map.def <> 'treasure_map' then return 'Not a map.'; end if;$o$,
$n$  if v_map.def <> 'treasure_map' then return 'Not a map.'; end if;
  -- Its tier's gate (kind `hoard`): "Unidentified map: needs digging 20; have 4.0."
  if item_gate_refusal(p_world, p_uid, v_map) is not null then return item_gate_refusal(p_world, p_uid, v_map); end if;$n$);

-- Found: named as the finder sees it.
select pg_temp.patch_fn('bury_treasure(uuid,uuid,double precision,double precision,double precision)',
$o$  perform tell(p_world, p_uid, 'Found: '
    || v_tier.name || ', QL '$o$,
$n$  perform tell(p_world, p_uid, 'Found: '
    || lower(seen_name(p_world, p_uid, 'treasure_map', v_tier.id, v_tier.name)) || ', QL '$n$);

/* ---- Bridges and aqueducts -------------------------------------------------------------------------------------- */

select pg_temp.patch_fn('last_refusal(uuid,uuid,text,jsonb)',
$o$    v_kind := coalesce(p_target->>'material', 'rope');
    return bridge_reason($o$,
$n$    v_kind := coalesce(p_target->>'material', 'rope');
    -- Its gate (kind `bridge`): "Drawbridge: needs carpentry 50; have 12.0."
    if kind_gate_refusal(p_world, p_uid, 'bridge', v_kind) is not null then
      return kind_gate_refusal(p_world, p_uid, 'bridge', v_kind);
    end if;
    return bridge_reason($n$);
select pg_temp.patch_fn('last_refusal(uuid,uuid,text,jsonb)',
$o$      if not found then return 'Finished.'; end if;
      if tool_ql(p_world, p_uid, d.tool) <= 0 then$o$,
$n$      if not found then return 'Finished.'; end if;
      -- Adding to it, under its gate as planning it is.
      if kind_gate_refusal(p_world, p_uid, 'bridge', b.kind) is not null then
        return kind_gate_refusal(p_world, p_uid, 'bridge', b.kind);
      end if;
      if tool_ql(p_world, p_uid, d.tool) <= 0 then$n$);

select pg_temp.patch_fn('aqueduct_refusal(uuid,uuid,text,jsonb)',
$o$    return aqueduct_plan(p_world, p_uid, (p_target->'head'->>0)::int,$o$,
$n$    if kind_gate_refusal(p_world, p_uid, 'bridge', 'aqueduct') is not null then
      return kind_gate_refusal(p_world, p_uid, 'bridge', 'aqueduct');
    end if;
    return aqueduct_plan(p_world, p_uid, (p_target->'head'->>0)::int,$n$);
select pg_temp.patch_fn('aqueduct_refusal(uuid,uuid,text,jsonb)',
$o$    if not found then return 'Finished.'; end if;
    if tool_ql(p_world, p_uid, 'trowel') <= 0 then$o$,
$n$    if not found then return 'Finished.'; end if;
    if kind_gate_refusal(p_world, p_uid, 'bridge', 'aqueduct') is not null then
      return kind_gate_refusal(p_world, p_uid, 'bridge', 'aqueduct');
    end if;
    if tool_ql(p_world, p_uid, 'trowel') <= 0 then$n$);

-- A hod carrier fits a span only of a bridge its own level in the bridge's trade may build (`hodMay`).
select pg_temp.patch_fn('hod_may(uuid,creature,text,integer,text,integer,integer)',
$o$    else true end$o$,
$n$    when 'span' then coalesce((select bool_and(worker_gate_open(c, skill_gate_of('bridge', b.kind)))
                                 from bridge_span sp join bridge b on b.world_id = sp.world_id and b.id = sp.bridge
                                where sp.world_id = p_world and sp.x = p_x and sp.y = p_y and not span_done(sp.needed)), true)
    else true end$n$);

/* ---- Smelting and working a casting, by the metal -------------------------------------------------------------- */

select pg_temp.patch_fn('firing_refusal(uuid,uuid,text,jsonb)',
$o$    if not found or (metal_by_ore(v_it.def)).id is null then return 'Ore only.'; end if;$o$,
$n$    if not found or (metal_by_ore(v_it.def)).id is null then return 'Ore only.'; end if;
    -- Its metal's gate (kind `smelt`, off the pouring table): "Tin smelting: needs smelting 10; have 2.3."
    if kind_gate_refusal(p_world, p_uid, 'smelt', (metal_by_ore(v_it.def)).id) is not null then
      return kind_gate_refusal(p_world, p_uid, 'smelt', (metal_by_ore(v_it.def)).id);
    end if;$n$);

-- The ore a worker's own smelting smelts (`workerSmeltOpen`); a kiln's greenware as it was.
create or replace function worker_furnace_fits(c creature, p_kind text) returns text[]
language sql stable as $$
  select case when p_kind = 'smelt'
    then (select coalesce(array_agg(m.ore), '{}') from metal_def m
           where m.ore is not null and worker_gate_open(c, skill_gate_of('smelt', m.id)))
    else furnace_fits(p_kind) end
$$;

select pg_temp.patch_fn('errand_step(uuid,integer,text)',
  $o$furnace_fits(kind)$o$, $n$worker_furnace_fits(c, kind)$n$, 2);
select pg_temp.patch_fn('errand_step(uuid,integer,text)',
$o$        select * into v_s from store_holding(p_world, c.keeper, v_fits, c.to_x, c.to_y);
        if v_s.x is null then why := 'stock'; why_n := null; return next; return; end if;$o$,
$n$        select * into v_s from store_holding(p_world, c.keeper, v_fits, c.to_x, c.to_y);
        if v_s.x is null then
          why := 'stock'; why_n := null;
          -- Only ore over its own smelting in the stores: `gate`, naming the lowest.
          if kind = 'smelt' then
            select array['smelt', g.id] into why_what
              from metal_def m join skill_gate g on g.kind = 'smelt' and g.id = m.id
             where m.ore is not null and stores_count(p_world, c.keeper, m.ore) > 0 order by g.level, g.id collate "C" limit 1;
            if why_what is not null then why := 'gate'; end if;
          end if;
          return next; return;
        end if;$n$);
select pg_temp.patch_fn('errand_do(uuid,integer,boolean,text)',
  $o$furnace_fits(kind)$o$, $n$worker_furnace_fits(c, kind)$n$, 2);

-- Ore, a root it may not use, out of the stores: said "in your settlement stores".
select pg_temp.patch_fn('worker_idle(uuid,creature,text,integer,integer,integer,bigint)',
  $o$c.idle_what[1] in ('recipe', 'relic', 'bauble', 'metal')$o$,
  $n$c.idle_what[1] in ('recipe', 'relic', 'bauble', 'metal', 'smelt', 'water_plant')$n$);

-- The gate on working a casting of a piece out at the anvil: its metal's, in the trade its mould is worked in; none for a
-- piece cast whole (`castingGate`).
create or replace function casting_gate(p_piece text, p_metal text) returns skill_gate
language sql stable as $$
  select g.* from mould_def d join metal_def m on lower(m.name) = lower(p_metal)
    join skill_gate g on g.kind = 'casting' and g.id = d.skill || ':' || m.id
   where d.makes = p_piece and d.makes not like '%\_casting'
$$;

-- Working a casting under its gate: "Tin casting: needs weaponsmithing 10; have 2.3.", or null (`castingGateRefusal`).
create or replace function casting_gate_refusal(p_world uuid, p_uid uuid, it item) returns text
language sql stable as $$
  select skill_gate_refusal(g.name, g.skill, skill_of(p_world, p_uid, g.skill), g.level)
    from casting_gate(it.piece, it.extra) g where g.kind is not null
$$;

select pg_temp.patch_fn('forge_refusal(uuid,uuid,text,jsonb)',
$o$  if not exists (select 1 from mould_def where makes = v_cast.piece) then return 'Choose a casting.'; end if;$o$,
$n$  if not exists (select 1 from mould_def where makes = v_cast.piece) then return 'Choose a casting.'; end if;
  -- Its metal's gate in the trade it is worked in (kind `casting`, off the pouring table).
  if casting_gate_refusal(p_world, p_uid, v_cast) is not null then return casting_gate_refusal(p_world, p_uid, v_cast); end if;$n$);

-- A nail or ribbon smith beats out only metal its own blacksmithing pours and works out of a casting (`workerSmithOpen`).
create or replace function worker_smith_lumps(c creature, p_kind text) returns text[]
language sql stable as $$
  select coalesce(array_agg(u.l order by u.o), '{}')
    from unnest(smith_lumps(p_kind)) with ordinality u(l, o) join metal_def md on md.lump = u.l
   where worker_gate_open(c, skill_gate_of('metal', md.id))
     and worker_gate_open(c, casting_gate((select d.makes from mould_def d where d.id = smith_mould(p_kind)), md.name))
$$;

/* ---- A stone in a circlet --------------------------------------------------------------------------------------- */

select pg_temp.patch_fn('item_refusal(uuid,uuid,text,jsonb)',
$o$    if (circlet_with_room(p_world, p_uid)).id is null then
      return 'Need a circlet with an empty setting (' || circlet_stones() || ' per circlet).';
    end if;$o$,
$n$    if (circlet_with_room(p_world, p_uid)).id is null then
      return 'Need a circlet with an empty setting (' || circlet_stones() || ' per circlet).';
    end if;
    -- The stone's gate, by its rarity (kind `gem`): "Diamond setting: needs jewellery 60; have 31.0."
    if kind_gate_refusal(p_world, p_uid, 'gem', (select g.id from gem_def g where lower(g.name) = lower(v_it.extra))) is not null then
      return kind_gate_refusal(p_world, p_uid, 'gem', (select g.id from gem_def g where lower(g.name) = lower(v_it.extra)));
    end if;$n$);

select private.lock_doors();
