/*
 * A corner the island moves on its own is said to the browsers watching.
 *
 * `land_set_height` writes the corner and says nothing; a dig is announced by
 * `act_perform` afterwards, and `reconcile` announces a tile only when its
 * kind changes. So three things that move a corner were never heard at all:
 * a slab breaking away of its own accord while mining (which the browser
 * cannot foresee, being the island's roll), a corner chipped back, and dirt
 * dropped at your feet -- "changes to corner level from slabs breaking away
 * while mining don't show until refresh". Each now announces the four tiles
 * that share the corner, through `land_announce_corner`.
 *
 * perform_terrain: from 20261011021905_four_for_the_tools_a_job_is_done_with.sql,
 * the newest that defines it, with the three announcements added.
 */
create or replace function land_announce_corner(p_world uuid, p_cx int, p_cy int) returns void language plpgsql as $fn$
declare gx int; gy int; sz int := (select size from world where id = p_world);
begin
  for gy in (p_cy - 1)..p_cy loop
    for gx in (p_cx - 1)..p_cx loop
      if gx >= 0 and gy >= 0 and gx < sz and gy < sz then perform land_announce(p_world, gx, gy); end if;
    end loop;
  end loop;
end $fn$;

CREATE OR REPLACE FUNCTION public.perform_terrain(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare d action_def; cx int; cy int; tx int; ty int; t tile_def; r rock_def;
        s double precision; tq double precision; yields text; made_ql double precision; tool_id bigint; here int;
        v_n int; v_step int; v_level int;
begin
  select * into d from action_def where id = p_action;
  cx := (p_target->>'cx')::int; cy := (p_target->>'cy')::int;
  tx := (p_target->>'x')::int;  ty := (p_target->>'y')::int;
  s := case when d.skill is null then 50 else skill_of(p_world, p_uid, d.skill) end;
  tq := case when d.tool is null then 0 else tool_ql(p_world, p_uid, d.tool) end;
  if d.tool is not null then
    select i.id into tool_id from item i
      where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = d.tool
      order by tool_worth(i.ql, i.dmg, i.extra, i.rare, i.bless) desc limit 1;
    if tool_id is not null then perform wear_tool(tool_id); end if;
  end if;

  if p_action = 'mine' then
    -- A Miner's Sure Swing passes some of the swings that fail.
    if not perk_pass(skill_check(s, d.difficulty, tq), pk(p_world, p_uid, 'fail:mine', 1)) then
      -- The swing happened. It taught nothing at all until now.
      perform skill_raise(p_world, p_uid, d.skill, try_gain(false));
      perform tell(p_world, p_uid, 'The rock is hard and you fail to loosen anything.', 'event');
      return;
    end if;
    r := bedrock_at(p_world, tx, ty);
    yields := case when land_tile(p_world, tx, ty) = 4 then r.yields else 'rock_shards' end;
    -- The first ore out of the ground is a thing worth remembering.
    if yields like '%\_ore' then perform journal_note(p_world, p_uid, 'ore'); end if;
    made_ql := least(ore_max_ql((select seed from world where id = p_world), tx, ty), product_ql(s, tq));
    -- Two coal a go off a seam for a Coal Hand, now and then one more of
    -- anything for a Rich Seam, and now and then rare for a Rare Ore.
    v_n := case when yields = 'coal' then greatest(1, pk(p_world, p_uid, 'count:coal', 1)::int) else 1 end
         + case when random() < pk(p_world, p_uid, 'more:mine', 0) then 1 else 0 end;
    perform gather(p_world, p_uid, yields, v_n, made_ql, null, perk_rare(pk(p_world, p_uid, 'rare:mine', 0)));
    -- And one swing in a thousand that brings out something nobody quarried.
    perform maybe_map(p_world, p_uid, s, tq);
    -- And a stone, now and again, which is the other thing a miner is for.
    perform maybe_gem(p_world, p_uid, s, tq);
    perform tell(p_world, p_uid,
      case when v_n > 1 then 'You mine ' || v_n || ' × '
           when yields like '%lump' then 'You chip a ' else 'You mine some ' end
      || lower((select coalesce(name, yields) from item_def where id = yields))
      || case when v_n > 1 then '.' when yields like '%lump' then ' out of the vein.' else '.' end
      || ' (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');
    -- And one more, now and then, for a Lodestone on the pickaxe.
    perform enchant_more(p_world, p_uid, 'pickaxe', 'lode', yields, made_ql);
    -- Cutting the face back is its own job. Now and again one comes down anyway.
    if random() < mine_collapse() then
      perform land_set_height(p_world, cx, cy, land_height(p_world, cx, cy) - 1);
      perform land_set_dirt(p_world, cx, cy, 0);
      perform reconcile_around(p_world, cx, cy);
      -- And said to everybody watching, the way a dig is: the corner it dropped is under four tiles.
      perform land_announce_corner(p_world, cx, cy);
      perform tell(p_world, p_uid, 'A slab breaks away of its own accord and the face drops.', 'event');
      -- And with it, for a Miner's Rock Slide, more of what was being mined.
      v_n := pk(p_world, p_uid, 'slide:more', 0)::int;
      if v_n > 0 then
        perform gather(p_world, p_uid, yields, v_n, made_ql);
        perform tell(p_world, p_uid, 'It brings ' || v_n || ' × '
          || lower((select coalesce(name, yields) from item_def where id = yields)) || ' down with it.', 'event');
      end if;
    end if;
    perform skill_raise(p_world, p_uid, d.skill, 1);

  elsif p_action = 'chip_corner' then
    -- More often for a Miner's Chipper.
    if random() >= pk(p_world, p_uid, 'chip:chance', chip_chance()) then
      perform skill_raise(p_world, p_uid, d.skill, try_gain(false));
      perform tell(p_world, p_uid, 'You work at the corner and find no line in it. The face holds.', 'event');
      return;
    end if;
    -- Two steps for a Miner's Face Shaper, but never past a level taken.
    v_step := greatest(1, pk(p_world, p_uid, 'chip:step', 1)::int);
    v_level := (select level_h from player where world_id = p_world and uid = p_uid);
    if v_level is not null and land_height(p_world, cx, cy) > v_level then
      v_step := greatest(1, least(v_step, land_height(p_world, cx, cy) - v_level));
    end if;
    perform land_set_height(p_world, cx, cy, land_height(p_world, cx, cy) - v_step);
    perform land_set_dirt(p_world, cx, cy, 0);
    perform reconcile_around(p_world, cx, cy);
    perform land_announce_corner(p_world, cx, cy);
    r := bedrock_at(p_world, tx, ty);
    yields := case when land_tile(p_world, tx, ty) = 4 then r.yields else 'rock_shards' end;
    -- The first ore out of the ground is a thing worth remembering.
    if yields like '%\_ore' then perform journal_note(p_world, p_uid, 'ore'); end if;
    made_ql := least(ore_max_ql((select seed from world where id = p_world), tx, ty), product_ql(s, tq));
    perform gather(p_world, p_uid, yields, 1, made_ql);
    perform maybe_map(p_world, p_uid, s, tq);
    perform tell(p_world, p_uid, 'The corner breaks away and drops '
      || case when v_step > 1 then v_step || ' steps' else 'a step' end || '. You gather the '
      || lower((select coalesce(name, yields) from item_def where id = yields))
      || '. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');
    perform skill_raise(p_world, p_uid, d.skill, 1);

  elsif p_action = 'pack' then
    here := land_tile(p_world, tx, ty);
    perform land_set_tile(p_world, tx, ty, 2);
    perform land_announce(p_world, tx, ty);
    perform tell(p_world, p_uid, case when here <> 1
      then 'You cut the turf away and tread the ground down firm.'
      else 'You pack the dirt down firmly.' end, 'event');
    perform skill_raise(p_world, p_uid, d.skill, 1);

  elsif p_action = 'cultivate' then
    perform land_set_tile(p_world, tx, ty, 1);
    perform land_announce(p_world, tx, ty);
    perform tell(p_world, p_uid, 'You break up the packed earth.', 'event');
    perform skill_raise(p_world, p_uid, d.skill, 1);

  elsif p_action = 'pave_cobble' then
    -- A Frugal Cobbler's go now and then takes no brick; the rest take one.
    if random() >= pk(p_world, p_uid, 'keep:pave_cobble', 0) then
      if not consume(p_world, p_uid, 'stone_brick', 1) then return; end if;
    end if;
    perform land_set_tile(p_world, tx, ty, 14);
    perform land_announce(p_world, tx, ty);
    perform tell(p_world, p_uid, 'You lay the cobblestones.', 'event');
    perform skill_raise(p_world, p_uid, d.skill, 1);

  elsif p_action = 'drop_dirt_here' then
    if not consume(p_world, p_uid, 'dirt', 1) then return; end if;
    select round(x)::int, round(y)::int into cx, cy from player where world_id = p_world and uid = p_uid;
    perform land_set_height(p_world, cx, cy, land_height(p_world, cx, cy) + 1);
    perform land_set_dirt(p_world, cx, cy, land_dirt(p_world, cx, cy) + 1);
    perform reconcile_around(p_world, cx, cy);
    perform land_announce_corner(p_world, cx, cy);
    /*
     * And what the spadeful covered, which is the tile you are standing on.
     *
     * The corner this raises is the nearest one, which belongs to as many as
     * four tiles; the ground that took the dirt is the one under your feet.
     * `drop_dirt` at a corner covers the tile it names, and this covers that
     * one — the same spadeful and the same list either way.
     */
    select floor(x)::int, floor(y)::int into tx, ty from player where world_id = p_world and uid = p_uid;
    if exists (select 1 from buryable b where b.tile = land_tile(p_world, tx, ty)) then
      perform land_set_tile(p_world, tx, ty, 1);
      perform land_announce(p_world, tx, ty);
    end if;
    perform tell(p_world, p_uid, 'You drop the dirt at your feet, raising the ground.', 'event');
    perform skill_raise(p_world, p_uid, d.skill, 1);
  end if;

end $function$;

select private.lock_doors();
