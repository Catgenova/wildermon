/*
 * Furniture under a bridge's deck again.
 *
 * A piece set down on a tile of a bridge's deck goes on the deck on an outer
 * lane of a material bridge `stall_width` lanes wide, finished, as before;
 * anywhere else it goes on the ground under the deck, as it did before
 * bridges had lanes, where the deck stands `clearance` or more over the
 * ground there (`bridge_deck_over`). The browser's `deckLane` and
 * `deckFurnitureRefusal`, held to these by `supabase/test/bridgewidth.ts`.
 */
set local lock_timeout = '3s';

/* The height of a bridge's deck over the middle of a tile, finished or not, up a ramp's slope (`deckHeight`). */
create or replace function bridge_deck_over(b bridge, p_x int, p_y int)
returns double precision language sql stable as $fn$
  select ramp_deck(b.height, b.rise,
                   (select count(*)::int from bridge_span s where s.world_id = b.world_id and s.bridge = b.id),
                   case when b.ay = b.by then case when b.bx > b.ax then p_x + 0.5 - (b.ax + 1) else b.ax - (p_x + 0.5) end
                        else case when b.by > b.ay then p_y + 0.5 - (b.ay + 1) else b.ay - (p_y + 0.5) end end)
$fn$;

/*
 * Why a piece may not be set down on this tile of a bridge's deck, or under
 * it, or null: on the deck of an outer lane of a finished material bridge
 * `stall_width` lanes wide; anywhere else on the ground under the deck,
 * `clearance` or more under it (`deckFurnitureRefusal`).
 */
create or replace function bridge_furniture_refusal(p_world uuid, p_x int, p_y int)
returns text language plpgsql stable as $fn$
declare b bridge; d bridge_def; v_o int;
begin
  select * into b from bridge where world_id = p_world and id = bridge_at(p_world, p_x, p_y);
  if b.id is null or b.kind = 'aqueduct' then return null; end if;
  v_o := bridge_deck_lane(b, p_x, p_y);
  -- An end tile is the ground it lands on.
  if v_o is null then return null; end if;
  select * into d from bridge_def where id = b.kind;
  -- On the deck (`deckLane`).
  if d.material is not null and b.width >= stall_width() and v_o <> 0 then
    if bridge_left(p_world, b.id) > 0 then return 'Bridge deck not finished.'; end if;
    return null;
  end if;
  -- Under it.
  if bridge_deck_over(b, p_x, p_y) - surface_height(p_world, p_x, p_y) >= clearance() then return null; end if;
  return 'Under a bridge deck: needs ' || metres(clearance()) || ' m clearance.';
end $fn$;

select private.lock_doors();
