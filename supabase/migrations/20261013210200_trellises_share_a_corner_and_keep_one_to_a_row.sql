/*
 * Trellises share a corner, say why they will not stand, and keep one to a row
 * (`src/game/vineyard.ts`).
 *
 * After 20261013210100_trellises_stand_against_a_wall.sql. The definitions
 * crossed the sentences: `vine_said` 'upstairs', 'inside', 'noWall' and
 * 'unfinished', `trellis_against_said` (a wall of a type that takes no
 * trellis, by its type) and `trellis_returned_said`. What is here:
 *
 *   * `trellis_wall_refusal`, from that migration: each way of missing the
 *     wall says which -- upstairs, the inside of a building, no wall on that
 *     side, a wall of a type that takes none, a wall not finished -- in the
 *     browser's order and words (`trellisWallRefusal`);
 *   * `piece_block_taken`: `block_taken`, but for a trellis, which shares the
 *     corner spot of its row with a trellis at right angles to it -- the row
 *     along a tile's north side and the row along its west side both hold
 *     the spot in their corner, and an inner corner of a house takes a
 *     trellis on each wall (`trellisShares`). Asked by `fire_refusal`, from
 *     that migration, where a piece is set down and where a trellis turns;
 *   * `trellis_settle`: one trellis to a row on every island. A trellis took
 *     a single spot before, and there were often several on one tile facing
 *     the same way, which the last migration put into the same row. Of those,
 *     the one with a vine is kept before one without and the oldest before a
 *     newer, if nothing but another trellis stands in its row; the rest go
 *     back to whoever set them down, a vine as a grape cutting, and they are
 *     told why. One whose owner has left the island is left on the ground of
 *     its tile. The browser's `settleTrellises`, asked of a game it loads.
 *
 * `supabase/test/vineyard.ts` holds the two sides to each other.
 */
set local lock_timeout = '3s';
-- The bodies below call what the definitions write out; the settling at the foot runs them, after the definitions.
set check_function_bodies = off;

/** Why a trellis will not stand on tile (x, y) against its side `p_facing`, or null, for `p_uid` setting it down from storey `p_level` (`trellisWallRefusal`). */
create or replace function trellis_wall_refusal(p_world uuid, p_uid uuid, p_x int, p_y int, p_facing text, p_level int) returns text
language plpgsql stable as $fn$
declare w wall; v_seen text;
begin
  if coalesce(p_level, 0) <> 0 then return vine_said('upstairs'); end if;
  if building_at(p_world, p_x, p_y) is not null then return vine_said('inside'); end if;
  select wl.* into w from border_of(p_x, p_y, p_facing) bd
    join wall wl on wl.world_id = p_world and wl.level = 0 and wl.dir = bd.dir and wl.x = bd.x and wl.y = bd.y;
  if not found then return vine_said('noWall'); end if;
  v_seen := wall_seen_type(p_world, p_uid, w);
  if not coalesce((select t.trellis from wall_type_def t where t.id = v_seen), false) then return trellis_against_said(v_seen); end if;
  if not bill_done(w.needed) then return vine_said('unfinished'); end if;
  return null;
end $fn$;

/**
 * Whether the block of spots a piece of `p_sub` facing `p_facing` would take
 * is taken: `block_taken`, but a trellis's block is not taken by another
 * trellis at right angles to it, and with `p_any_trellis` by no trellis at
 * all (`trellis_settle` asks after everything else in a row).
 */
create or replace function piece_block_taken(p_world uuid, p_sub text, p_facing text, p_x int, p_y int, p_sx int, p_sy int, p_w int, p_h int,
                                             p_except bigint default null, p_any_trellis boolean default false) returns boolean
language plpgsql stable as $fn$
begin
  if p_sub is distinct from vine_kind() then return block_taken(p_world, p_x, p_y, p_sx, p_sy, p_w, p_h, p_except); end if;
  return exists (select 1 from placed o
                 where o.world_id = p_world and o.x = p_x and o.y = p_y and o.id is distinct from p_except
                   and same_floor(o.level, o.world_id, o.x, o.y)
                   and o.sx < p_sx + p_w and o.sx + (placed_size(o.kind, o.sub, o.facing))[1] > p_sx
                   and o.sy < p_sy + p_h and o.sy + (placed_size(o.kind, o.sub, o.facing))[2] > p_sy
                   and not (o.kind = 'furniture' and o.sub = vine_kind()
                            and (p_any_trellis or (o.facing in ('e', 'w')) <> (p_facing in ('e', 'w')))))
      or exists (select 1 from crate c
                 where c.world_id = p_world and c.x = p_x and c.y = p_y and same_floor(c.level, c.world_id, c.x, c.y)
                   and c.sx >= p_sx and c.sx < p_sx + p_w and c.sy >= p_sy and c.sy < p_sy + p_h)
      or (same_floor(0, p_world, p_x, p_y) and frame_column_corner(p_world, p_x, p_y, p_sx, p_sy, p_w, p_h));
end $fn$;

/** A trellis taken up and handed back: to whoever set it down, a vine as a cutting, and told why; to the ground of its tile if they have left the island. */
create or replace function trellis_return(p_world uuid, pl placed) returns void
language plpgsql as $fn$
begin
  delete from placed where id = pl.id;
  if pl.made_by is not null and exists (select 1 from player r where r.world_id = p_world and r.uid = pl.made_by) then
    perform give(p_world, pl.made_by, vine_kind(), 1, pl.ql, pl.material, pl.rare);
    if pl.vine_at is not null then perform give(p_world, pl.made_by, grape_cutting_item(), 1, pl.ql); end if;
    perform tell(p_world, pl.made_by, trellis_returned_said(pl.x, pl.y, pl.vine_at is not null), 'event');
  else
    perform drop_on_ground(p_world, pl.x, pl.y, vine_kind(), pl.ql, pl.material);
    if pl.vine_at is not null then perform drop_on_ground(p_world, pl.x, pl.y, grape_cutting_item(), pl.ql); end if;
  end if;
end $fn$;

/** One trellis to a row on an island, the rest handed back; how many were (`settleTrellises`). */
create or replace function trellis_settle(p_world uuid) returns int
language plpgsql as $fn$
declare r record; pl placed; sz int[]; v_at int[]; v_first boolean; v_taken boolean; v_n int := 0;
begin
  for r in select distinct t.x, t.y, t.facing from placed t
            where t.world_id = p_world and t.kind = 'furniture' and t.sub = vine_kind() and t.level >= 0 loop
    v_first := true;
    v_taken := false;
    for pl in select * from placed t
               where t.world_id = p_world and t.kind = 'furniture' and t.sub = vine_kind() and t.level >= 0
                 and t.x = r.x and t.y = r.y and t.facing = r.facing
               order by (t.vine_at is null), t.id loop
      sz := placed_size(pl.kind, pl.sub, pl.facing);
      v_at := piece_anchor(pl.sub, pl.facing, pl.sx, pl.sy, sz);
      update placed set sx = v_at[1], sy = v_at[2],
          cx = pl.x + (v_at[1] + sz[1] / 2.0) / subtiles(), cy = pl.y + (v_at[2] + sz[2] / 2.0) / subtiles()
        where id = pl.id;
      if v_first then
        -- Kept, unless anything but a trellis stands in its row; then the whole row goes back.
        v_taken := piece_block_taken(p_world, pl.sub, pl.facing, pl.x, pl.y, v_at[1], v_at[2], sz[1], sz[2], pl.id, true);
        v_first := false;
        if not v_taken then continue; end if;
      end if;
      perform trellis_return(p_world, pl);
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end $fn$;

/* ---- fire_refusal: from 20261013210100_trellises_stand_against_a_wall.sql, the newest. A trellis's block, shared at the corner. ---- */
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
    -- A trellis shares the corner spot with one at right angles to it (`piece_block_taken`).
    if piece_block_taken(p_world, sub, v_face, (p_target->>'x')::int, (p_target->>'y')::int, v_at[1], v_at[2], sz[1], sz[2]) then
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
      if piece_block_taken(p_world, p.sub, v_face, p.x, p.y, v_at[1], v_at[2], sz[1], sz[2], p.id) then
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

reset check_function_bodies;

/*
 * What a trellis handed back says, as the definitions write it out
 * (`trellis_returned_said`): written here only where they have not landed
 * yet, so the settling below can run whichever comes first.
 */
do $said$
begin
  if to_regprocedure('trellis_returned_said(integer,integer,boolean)') is null then
    execute $def$create or replace function trellis_returned_said(p_x int, p_y int, p_vine boolean) returns text language sql immutable as $fn$ select case when p_vine then 'Your trellis at ' || p_x || ', ' || p_y || ' is back in your pack, and its vine with it as a grape cutting: a trellis takes the whole row of spots along its side of a tile now, and another trellis or another piece stands in that row.' else 'Your trellis at ' || p_x || ', ' || p_y || ' is back in your pack: a trellis takes the whole row of spots along its side of a tile now, and another trellis or another piece stands in that row.' end $fn$$def$;
  end if;
end $said$;

/*
 * The settle itself runs once, in `20261013210300_trellises_settled_by_their_own_footprint`,
 * with the trellis's own footprint and a return that keeps a trellis's rarity: run here
 * too, before either existed, it handed back what it found with the old ones first.
 */

select private.lock_doors();
