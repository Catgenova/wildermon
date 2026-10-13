/*
 * A trellis stands against the outside of a wall (`src/game/vineyard.ts`).
 *
 * The definitions crossed the trellis's new footprint (a row of subtiles the
 * width of its tile, one deep: `furniture_def.w`), the wall types it is set
 * against (`wall_type_def.trellis`: a solid wall and a window) and its two
 * sentences (`vine_said('wall')`, `vine_said('turn')`). What is here is the
 * asking:
 *
 *   * `trellis_wall_refusal`: set down from the ground, on a tile that is no
 *     building's, against a finished wall on the side it faces whose type --
 *     as the one setting it down sees it, so a hidden door is a solid wall to
 *     all but whoever its padlock admits (`wall_seen_type`) -- takes a
 *     trellis. One sentence for every way of missing it. The browser's
 *     `trellisWallRefusal`;
 *   * `piece_anchor`: the block a piece takes kept inside its tile, and a
 *     trellis's in the row of subtiles along the side it faces, wherever on
 *     the tile it was asked for (`furnitureAnchor`);
 *   * `trellis_turns_to`: a trellis turned goes round to the next side of its
 *     tile with such a wall, and is refused where there is none
 *     (`trellisTurnsTo`, `vine_said('turn')`);
 *   * `fire_refusal`, from 20261002115207_shop_counters_and_lantern_posts.sql,
 *     and `perform_fire`, from 20261011060546_memorial_stones.sql, the newest
 *     that define them: the wall asked when a trellis is set down and when it
 *     is turned, and the block it takes put where `piece_anchor` puts it.
 *
 * The wall is asked for then and at no other time: a trellis whose wall comes
 * down after stays standing, vine and all, and so does every trellis set down
 * before this, wherever it stands. Those are put into the row along the side
 * they face here, once, so the block they take is the one they are drawn on.
 *
 * `supabase/test/vineyard.ts` holds the two sides to each other.
 */
set local lock_timeout = '3s';
-- The bodies below call what the definitions write out; nothing here runs them.
set check_function_bodies = off;

alter table wall_type_def add column if not exists trellis boolean not null default false;

/**
 * Why a trellis will not stand on tile (x, y) against its side `p_facing`, or
 * null, for `p_uid` setting it down from storey `p_level` (`trellisWallRefusal`).
 */
create or replace function trellis_wall_refusal(p_world uuid, p_uid uuid, p_x int, p_y int, p_facing text, p_level int) returns text
language plpgsql stable as $fn$
begin
  if coalesce(p_level, 0) <> 0 or building_at(p_world, p_x, p_y) is not null then return vine_said('wall'); end if;
  if exists (select 1 from border_of(p_x, p_y, p_facing) bd
               join wall w on w.world_id = p_world and w.level = 0 and w.dir = bd.dir and w.x = bd.x and w.y = bd.y
               join wall_type_def t on t.id = wall_seen_type(p_world, p_uid, w)
              where t.trellis and bill_done(w.needed)) then
    return null;
  end if;
  return vine_said('wall');
end $fn$;

/**
 * The top-left subtile of the block of `p_size` a piece takes, asked for at
 * (sx, sy): kept inside the tile, and a trellis's in the row along the side
 * it faces (`furnitureAnchor`).
 */
create or replace function piece_anchor(p_sub text, p_facing text, p_sx int, p_sy int, p_size int[]) returns int[]
language plpgsql stable as $fn$
declare ax int := least(subtiles() - p_size[1], greatest(0, p_sx));
        ay int := least(subtiles() - p_size[2], greatest(0, p_sy));
begin
  if p_sub is distinct from vine_kind() then return array[ax, ay]; end if;
  return array[case p_facing when 'w' then 0 when 'e' then subtiles() - p_size[1] else ax end,
               case p_facing when 'n' then 0 when 's' then subtiles() - p_size[2] else ay end];
end $fn$;

/** Which way a trellis faces after a turn: the next side round to the right with its wall, or null (`trellisTurnsTo`). */
create or replace function trellis_turns_to(p_world uuid, p_uid uuid, p placed) returns text
language plpgsql stable as $fn$
declare f text := p.facing;
begin
  for i in 1 .. 3 loop
    f := turned_facing(f, 1);
    if trellis_wall_refusal(p_world, p_uid, p.x, p.y, f, coalesce(p.level, 0)) is null then return f; end if;
  end loop;
  return null;
end $fn$;

/* ---- fire_refusal: from 20261002115207_shop_counters_and_lantern_posts.sql, the newest. A trellis's wall, and the block it takes. ---- */
create or replace function fire_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
declare p placed; it item; n int; sub text; sz int[]; v_shut text; v_at int[]; v_face text;
begin
  -- Opening a creature crate, which is furniture standing on the ground.
  if p_action in ('crate_follow', 'crate_work') then
    return crate_open_refusal(p_world, p_uid, p_action, p_target);
  end if;
  if p_action = 'build_campfire' then
    if p_target->>'sx' is null or p_target->>'sy' is null then return 'Choose a spot.'; end if;
    if pack_count(p_world, p_uid, 'shaft') < 2 then return 'A campfire takes 2 shafts.'; end if;
    return null;
  end if;

  if p_action in ('place_smelter', 'place_furniture', 'place_kiln') then
    select * into it from item
      where id = target_item(p_target) and world_id = p_world
        and holder = 'player' and holder_uid = p_uid;
    if not found then return 'You are not carrying that.'; end if;
    if p_action = 'place_smelter' and it.def <> 'smelter' then return 'That is not a smelter.'; end if;
    if p_action = 'place_kiln' and it.def <> 'kiln' then return 'That is not a kiln.'; end if;
    if p_action = 'place_furniture' then
      sub := replace(it.def, 'furniture_', '');
      if not exists (select 1 from furniture_def where id = sub) then return 'That is not something you can set down.'; end if;
      -- A piece built only on a settlement of yours stands only on one: the same flag, off its own recipe.
      if exists (select 1 from recipe where id = 'make_' || sub and deed)
         and not on_my_deed(p_world, p_uid, (p_target->>'x')::int, (p_target->>'y')::int) then
        return 'You can only set this down on a settlement of yours.';
      end if;
      -- And one altar to a settlement: none set down on one that has its altar.
      if exists (select 1 from furniture_def f where f.id = sub and f.altar)
         and altar_on_deed(p_world, p_uid, (p_target->>'x')::int, (p_target->>'y')::int) then
        return 'This settlement already has an altar, and a settlement may have only one.';
      end if;
      -- A trellis against the outer face of a wall, from the ground (`vineyard.ts`, `trellisWallRefusal`).
      if sub = vine_kind() then
        v_shut := trellis_wall_refusal(p_world, p_uid, (p_target->>'x')::int, (p_target->>'y')::int,
          case when p_target->>'facing' in ('n', 'e', 's', 'w') then p_target->>'facing' else 's' end,
          (select r.level from player r where r.world_id = p_world and r.uid = p_uid));
        if v_shut is not null then return v_shut; end if;
      end if;
    end if;
    -- And the block of spots it would take, which used to be the browser's to refuse alone.
    v_face := case when p_target->>'facing' in ('n', 'e', 's', 'w') then p_target->>'facing' else 's' end;
    sz := placed_size(case p_action when 'place_smelter' then 'smelter' when 'place_kiln' then 'kiln' else 'furniture' end, sub, v_face);
    -- Kept inside the tile, and a trellis in the row along the side it faces (`piece_anchor`).
    v_at := piece_anchor(sub, v_face, coalesce((p_target->>'sx')::int, 0), coalesce((p_target->>'sy')::int, 0), sz);
    if block_taken(p_world, (p_target->>'x')::int, (p_target->>'y')::int, v_at[1], v_at[2], sz[1], sz[2]) then
      return 'Something is already standing there.';
    end if;
    -- And a lantern post's arm not into a wall (`lamps.ts`).
    if p_action = 'place_furniture' then
      return lamp_arm_refusal(p_world, sub, (p_target->>'x')::int, (p_target->>'y')::int, v_at[1], v_at[2], v_face);
    end if;
    return null;
  end if;

  p := target_placed(p_world, p_target);
  if p.id is null then return 'It is gone.'; end if;
  if not placed_in_reach(p_world, p_uid, p.id) then
    return 'Stand next to the ' || coalesce(p.sub, p.kind) || '.';
  end if;
  -- A planter is sown, tended, harvested and pulled up as a field is, and says no as a field does.
  if farm_action(p_action) then
    return planter_refusal(p_world, p_uid, p_action, p, p_target);
  end if;

  if p_action in ('light_campfire', 'light_smelter', 'light_kiln') then
    if placed_lit(p) then return 'It is already burning.'; end if;
    if placed_fuel(p) <= 0 then return 'There is nothing left to burn. Feed it some wood.'; end if;
  elsif p_action in ('put_out_campfire', 'damp_smelter', 'damp_kiln') then
    if not placed_lit(p) then return 'It is not burning.'; end if;
  elsif p_action in ('fuel_campfire', 'fuel_smelter', 'fuel_kiln') then
    -- From what is at hand: the pack, a bag, or a store within reach.
    select i.* into it from craft_stock(p_world, p_uid, target_item(p_target)) s join item i on i.id = s.id
      where (s.id = target_item(p_target) or fuel_value(s.def) is not null)
      order by (s.id = target_item(p_target)) desc, s.draw limit 1;
    if not found or fuel_value(it.def) is null then
      return 'Fires take ' || fuel_said() || '.';
    end if;
    if placed_fuel(p) >= fire_capacity() then return 'It is already piled as high as it will take.'; end if;
  elsif p_action in ('take_ashes_fire', 'take_ashes_smelter', 'take_ashes_kiln') then
    if floor(placed_ash(p)) < 1 then return 'There are no ashes worth taking yet.'; end if;
  elsif p_action = 'turn_furniture' then
    if p.kind <> 'furniture' then return 'Only furniture turns.'; end if;
    if placed_lit(p) then return 'Put it out first.'; end if;
    if p.puller is not null then return 'Let go of it first.'; end if;
    if p.driver is not null then return 'Get down off it first.'; end if;
    if exists (select 1 from player r where r.world_id = p_world and r.aboard = p.id) then
      return 'There are people aboard her.';
    end if;
    if crates_on_rack(p_world, p.id) > 0 then return 'Take the crates off it first.'; end if;
    -- A trellis goes round to the next side of its tile with a wall it stands against, and stays put with none (`vineyard.ts`).
    if p.sub = vine_kind() then
      v_face := trellis_turns_to(p_world, p_uid, p);
      if v_face is null then return vine_said('turn'); end if;
      sz := placed_size(p.kind, p.sub, v_face);
      v_at := piece_anchor(p.sub, v_face, p.sx, p.sy, sz);
      if block_taken(p_world, p.x, p.y, v_at[1], v_at[2], sz[1], sz[2], p.id) then
        return 'Something is in the way of turning it.';
      end if;
      return null;
    end if;
    return furniture_turn_reason(p);
  elsif p_action in ('take_apart_campfire', 'pick_up_smelter', 'pick_up_furniture', 'pick_up_kiln') then
    if placed_lit(p) then return 'Put it out first.'; end if;
    if p_action = 'pick_up_furniture' then
      -- Locked, it stays where it is: lifting a ship or a cart and setting it
      -- down somewhere else is taking it, padlock and all.
      v_shut := lock_refusal(p_world, p_uid, p.lock, p.x, p.y);
      if v_shut is not null then return v_shut; end if;
      -- What is inside it, and what is in front of it.
      if exists (select 1 from item i where i.holder = 'furniture' and i.placed = p.id) then
        return 'Empty it first.';
      end if;
      -- A crop is not carried about in a box of earth: it is harvested, or turned back into the soil.
      if exists (select 1 from planter_crop pc where pc.placed = p.id) then
        return planter_growing_said();
      end if;
      -- A rack holds nothing of its own, so the check above passes however
      -- loaded it is: what stands on it are crates of somebody else's, and
      -- lifting the rack out from under them would leave them in the air.
      if crates_on_rack(p_world, p.id) > 0 then
        return 'Take the ' || case when crates_on_rack(p_world, p.id) = 1 then 'crate'
                                   else crates_on_rack(p_world, p.id) || ' crates' end || ' off it first.';
      end if;
      if placed_litres(p) > 0 then return 'Empty it out first.'; end if;
      -- A crate with somebody else's wildermon in it is theirs to carry off.
      if p.creature is not null and exists (select 1 from creature q where q.world_id = p_world
            and q.id = p.creature and q.mode = 'stored' and q.keeper is distinct from p_uid) then
        return (select q.name from creature q where q.world_id = p_world and q.id = p.creature)
          || ' is not yours to carry off.';
      end if;
      if p.puller is not null then return 'Let go of it first.'; end if;
      if team_size(p_world, p.id) > 0 then return 'Unhitch the team first.'; end if;
      if p.driver is not null then return 'Get down off it first.'; end if;
      if exists (select 1 from player r where r.world_id = p_world and r.aboard = p.id) then
        return 'There are people aboard her.';
      end if;
    end if;
  end if;
  return null;
end $function$;

/* ---- perform_fire: from 20261011060546_memorial_stones.sql, the newest. A trellis set down and turned into its row. ---- */
create or replace function perform_fire(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare p placed; it item; sz int[]; ax int; ay int; per double precision; room double precision;
        fits int; whole int; sub text; made bigint; back text; v_at int[];
begin
  if p_action = 'build_campfire' then
    ax := least(subtiles() - 2, greatest(0, (p_target->>'sx')::int));
    ay := least(subtiles() - 2, greatest(0, (p_target->>'sy')::int));
    if not consume(p_world, p_uid, 'shaft', 2) then return; end if;
    insert into placed (world_id, kind, x, y, sx, sy, cx, cy, fuel, made_by)
    values (p_world, 'campfire', (p_target->>'x')::int, (p_target->>'y')::int, ax, ay,
            (p_target->>'x')::int + (ax + 1.0) / subtiles(), (p_target->>'y')::int + (ay + 1.0) / subtiles(),
            120, p_uid);
    perform tell(p_world, p_uid, 'You lay a campfire from 2 shafts. Light it, or feed it more wood first.', 'event');
    perform land_announce(p_world, (p_target->>'x')::int, (p_target->>'y')::int);
    return;
  end if;

  if p_action in ('place_smelter', 'place_furniture', 'place_kiln') then
    select * into it from item where id = target_item(p_target);
    -- A piece stands there as whatever it was in the pack. This read the def
    -- through replace(it.def, 'furniture_', '') for as long as the pick-up put
    -- that prefix on, which meant the two halves disagreed about what an item
    -- is called and only one of them ever said so. Neither does now.
    sub := case when p_action = 'place_furniture' then it.def end;
    -- Which way it faces, which is the browser's to say and south when it says nothing.
    back := case when p_target->>'facing' in ('n', 'e', 's', 'w') then p_target->>'facing' else 's' end;
    sz := placed_size(case p_action when 'place_smelter' then 'smelter'
                                    when 'place_kiln' then 'kiln' else 'furniture' end, sub, back);
    -- Kept inside the tile, and a trellis in the row along the side it faces (`piece_anchor`).
    v_at := piece_anchor(sub, back, coalesce((p_target->>'sx')::int, 0), coalesce((p_target->>'sy')::int, 0), sz);
    ax := v_at[1];
    ay := v_at[2];
    /*
     * The quality, and -- new here -- the rarity and the wood.
     *
     * A piece set down used to reach the ground with nothing but its quality.
     * Its rarity went in the bin, so a rare chest was a rare chest right up
     * until somebody put it in a room and then it was a chest; and its wood
     * went with it, so an oak chest and a pine one were the same chest the
     * moment they were standing. Both are on the item being consumed here,
     * and both come across now.
     */
    insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, facing, rare, material, creature, mark, dye, enchant, dmg, engraving)
    values (p_world, case p_action when 'place_smelter' then 'smelter'
                                   when 'place_kiln' then 'kiln' else 'furniture' end, sub,
            (p_target->>'x')::int, (p_target->>'y')::int, ax, ay,
            (p_target->>'x')::int + (ax + sz[1] / 2.0) / subtiles(),
            (p_target->>'y')::int + (ay + sz[2] / 2.0) / subtiles(),
            it.ql, p_uid, back, it.rare, it.extra,
            case when p_action = 'place_furniture' then it.creature end,
            -- And its maker's mark, which it carries wherever it stands.
            it.mark,
            -- And its colour: a banner, a flag or a sail dyed in the pack stands dyed.
            it.dye,
            -- And its enchantment and its wear, which it keeps standing and takes up again (`enchanting.ts`).
            it.enchant, it.dmg,
            -- And a memorial stone's line, which it reads standing as it did in the pack.
            it.engraving)
    returning id into made;
    delete from item where id = it.id;
    -- And whoever is shut in it stands where it stands, and is seen in it.
    if p_action = 'place_furniture' and it.creature is not null then
      update creature c set from_x = pl.cx, from_y = pl.cy, to_x = pl.cx, to_y = pl.cy,
          leg_at = now(), leg_ends = now(), until = now(), settled_at = now()
        from placed pl where pl.id = made and c.world_id = p_world and c.id = it.creature;
    end if;
    perform tell(p_world, p_uid, 'You set the ' ||
      lower(coalesce((select name from furniture_def where id = sub),
        case when p_action = 'place_kiln' then 'kiln' else 'smelter' end)) || ' down'
      || coalesce(' with ' || (select c.name from creature c where p_action = 'place_furniture'
                                 and c.world_id = p_world and c.id = it.creature) || ' in it', '')
      || '.', 'event');
    perform land_announce(p_world, (p_target->>'x')::int, (p_target->>'y')::int);
    return;
  end if;

  perform placed_settle(nullif(p_target->>'id', '')::bigint);
  p := target_placed(p_world, p_target);
  if p.id is null then return; end if;

  if p_action in ('light_campfire', 'light_smelter', 'light_kiln') then
    update placed set lit = true, since = now() where id = p.id;
    if p_action = 'light_campfire' then perform journal_note(p_world, p_uid, 'fire'); end if;
    perform tell(p_world, p_uid, 'The kindling catches and the ' || p.kind || ' burns. It has '
      || burns_for(p.fuel / placed_burn_rate(p)) || ' of fuel.', 'event');
  elsif p_action in ('put_out_campfire', 'damp_smelter', 'damp_kiln') then
    update placed set lit = false, since = now() where id = p.id;
    perform tell(p_world, p_uid, 'You smother the fire. The wood is saved for later.', 'event');
  elsif p_action in ('fuel_campfire', 'fuel_smelter', 'fuel_kiln') then
    -- From what is at hand: the pack, a bag, or a store within reach.
    select i.* into it from craft_stock(p_world, p_uid, target_item(p_target)) s join item i on i.id = s.id
      where (s.id = target_item(p_target) or fuel_value(s.def) is not null)
      order by (s.id = target_item(p_target)) desc, s.draw limit 1;
    per := fuel_value(it.def);
    room := greatest(0, fire_capacity() - p.fuel);
    /*
     * How many you asked for, which this never read.
     *
     * Reported as "attempting to feed one coal to a smelter puts four coal
     * in". The menu offers one or all and sends the count either way; this
     * fed as much as would fit whatever it was told, so a firebox with room
     * in it swallowed the whole pile on a single "one". The browser has read
     * the count since fuelling was written.
     */
    fits := greatest(1, least(least(coalesce((p_target->>'count')::int, 1), it.count),
                              ceil(room / per)::int));
    if not spend_stack(p_world, p_uid, it.id, fits) then return; end if;
    update placed set fuel = least(fire_capacity(), p.fuel + per * fits), since = now() where id = p.id;
    perform tell(p_world, p_uid, 'You feed ' || case when fits > 1 then fits || ' × ' else 'a ' end
      || lower((select name from item_def where id = it.def)) || ' to the fire. '
      || burns_for(least(fire_capacity(), p.fuel + per * fits) / placed_burn_rate(p)) || ' of fuel.', 'event');
  elsif p_action in ('take_ashes_fire', 'take_ashes_smelter', 'take_ashes_kiln') then
    whole := floor(p.ash)::int;
    update placed set ash = p.ash - whole, since = now() where id = p.id;
    perform give(p_world, p_uid, 'ash', whole, 20);
    perform tell(p_world, p_uid, 'You rake ' || whole || case when whole = 1 then ' lot' else ' lots' end
      || ' of ashes out of the ' || p.kind || '. (QL 20)', 'event');
  elsif p_action = 'take_apart_campfire' then
    -- Coal burns but is never got back, so a pile of logs cannot be turned
    -- into coal by rebuilding the fire.
    delete from placed where id = p.id;
    perform give(p_world, p_uid, 'shaft', 2, 20);
    perform tell(p_world, p_uid, 'You take the campfire apart and save what will burn again.', 'event');
    perform land_announce(p_world, p.x, p.y);
  elsif p_action = 'turn_furniture' then
    -- A quarter turn to the right, walked to the nearest spot the turned block fits.
    -- On round past a facing a post's arm would go into a wall (`lamps.ts`); a trellis to the next side with its wall (`vineyard.ts`).
    back := case when p.sub = vine_kind() then coalesce(trellis_turns_to(p_world, p_uid, p), p.facing)
                 else lamp_turns_to(p_world, p) end;
    sz := placed_size(p.kind, p.sub, back);
    v_at := piece_anchor(p.sub, back, p.sx, p.sy, sz);
    ax := v_at[1];
    ay := v_at[2];
    update placed set facing = back, sx = ax, sy = ay,
        cx = p.x + (ax + sz[1] / 2.0) / subtiles(), cy = p.y + (ay + sz[2] / 2.0) / subtiles()
      where id = p.id;
    perform tell(p_world, p_uid, 'You turn the ' || lower(placed_name(p)) || ' to face ' || side_name(back) || '.', 'event');
    perform land_announce(p_world, p.x, p.y);

  elsif p_action in ('pick_up_smelter', 'pick_up_furniture', 'pick_up_kiln') then
    /*
     * What goes back in the pack is the thing's own definition, which for a
     * piece of furniture is its `sub` and nothing else.
     *
     * It used to be 'furniture_' || p.sub. There is no such item: the
     * catalogue calls a wagon a wagon, so picking one up put a row in your
     * pack with a definition nothing has ever heard of. It showed as its own
     * id under OTHER, weighed whatever the fallback weighs, and could not be
     * set down again, because the browser asks `isFurniture` of the id it is
     * holding and the answer was no. The wagon was not lost, but it was not a
     * wagon either.
     *
     * The other half of the pair hid it: `place_furniture` reads its `sub`
     * with replace(it.def, 'furniture_', ''), so it would have accepted the
     * broken id perfectly well and nothing on this side ever complained.
     */
    back := case p.kind when 'smelter' then 'smelter' when 'kiln' then 'kiln'
                        else p.sub end;
    -- And back the same way: what it stood there as is what goes in the pack.
    -- `give` has taken a material and a rarity since the day it was written.
    -- Given before the piece comes up, so a crate's wildermon is never in no crate at all.
    made := give(p_world, p_uid, back, 1, p.ql, p.material, p.rare);
    if p.mark is not null then update item set mark = p.mark where id = made; end if;
    -- And its colour, back on the thing in the pack.
    if p.dye is not null then update item set dye = p.dye where id = made; end if;
    -- And its enchantment and its wear, back on the thing in the pack.
    update item set enchant = p.enchant, dmg = p.dmg where id = made;
    -- And a memorial stone's line, carried in the pack as it stood.
    if p.engraving is not null then update item set engraving = p.engraving where id = made; end if;
    if p.creature is not null then
      update item set creature = p.creature where id = made;
      update creature c set from_x = py.x, from_y = py.y, to_x = py.x, to_y = py.y,
          leg_at = now(), leg_ends = now(), until = now(), settled_at = now()
        from player py where py.world_id = p_world and py.uid = p_uid
          and c.world_id = p_world and c.id = p.creature;
    end if;
    delete from placed where id = p.id;
    perform tell(p_world, p_uid, 'You take up the '
      || lower(coalesce((select name from furniture_def where id = p.sub), p.sub, p.kind))
      || coalesce(' with ' || (select c.name from creature c where c.world_id = p_world and c.id = p.creature) || ' in it', '')
      || '.', 'event');
    perform land_announce(p_world, p.x, p.y);
  end if;
end $function$;

/*
 * Every trellis already standing, into the row of subtiles along the side it
 * faces, at the middle of that row: where it is drawn, and the block it takes
 * now it runs the width of its tile. None is taken up, turned or moved off
 * its tile, and its vine is as it was.
 */
update placed set
    sx = case facing when 'e' then subtiles() - 1 else 0 end,
    sy = case facing when 'n' then 0 when 'e' then 0 when 'w' then 0 else subtiles() - 1 end,
    cx = x + case facing when 'e' then (subtiles() - 0.5) / subtiles() when 'w' then 0.5 / subtiles() else 0.5 end,
    cy = y + case facing when 'n' then 0.5 / subtiles() when 'e' then 0.5 when 'w' then 0.5 else (subtiles() - 0.5) / subtiles() end
  where kind = 'furniture' and sub = 'trellis';

reset check_function_bodies;
select private.lock_doors();
