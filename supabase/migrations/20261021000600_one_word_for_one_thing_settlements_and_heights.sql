-- One word for one thing, in the island's words as in the browser's: settlements, totems, heights in metres,
-- the action queue, the member list and the daily reset.
--
-- Asked for: 'Everywhere change "per go" to "per action". Identify other potentially ambiguous verbiage.' The
-- ambiguous terms were listed, and the answer was "Do them all". This is the island's half of the settlement, rank,
-- building and digging texts (the browser's are `deed.ts`, `ranks.ts`, `noticeboard.ts`, `cellar.ts`,
-- `foundations.ts`, `bridges.ts`, `aqueducts.ts`, `piers.ts`, `actions.ts`, `game.ts` and the windows over them):
--
--   * "settlement", never "deed", and the settlement's token is its totem;
--   * every height, depth, slope and step printed in metres (`metres`, units / 10 to a tenth, then " m");
--   * a settlement's list of members is its member list, not its roll;
--   * the job queue is the action queue;
--   * the daily reset is called one thing, "daily reset (13:00 UTC)", the hour from `tree_dawn_utc()`;
--   * a tree's next stage is its next age; a meal's knack is its meal boost; QL on Examine is Quality.
--
-- Text only: no rule, number or behaviour changes.

set local lock_timeout = '3s';

-- The daily reset's name, with its hour as the hud shows one (`DAILY_RESET` in `world/tiles.ts`).
create or replace function daily_reset_words() returns text language sql immutable as $fn$
  select 'daily reset (' || lpad(tree_dawn_utc()::int::text, 2, '0') || ':00 UTC)'
$fn$;

-- Each patch: (function, the text as it stands, what it says now, how many times it stands there). Every function of
-- that name is read and rewritten; the count over all of them must be exactly the one given, or nothing changes.
do $do$
declare v_p text[]; r record; v_def text; v_n int; v_total int;
begin
  foreach v_p slice 1 in array array[
    array[$q$pier_refusal$q$, $q$'Ground rises to ' || g.high || ', above the deck at ' || p_deck$q$, $q$'Ground rises to ' || metres(g.high) || ' m, above the deck at ' || metres(p_deck) || ' m'$q$, $q$1$q$],
    array[$q$pier_refusal$q$, $q$'Water at ' || g.water || ', deck at ' || p_deck$q$, $q$'Water at ' || metres(g.water) || ' m, deck at ' || metres(p_deck) || ' m'$q$, $q$1$q$],
    array[$q$pier_says$q$, $q$' On piers: deck at ' || b.deck || ', '$q$, $q$' On piers: deck at ' || metres(b.deck) || ' m, '$q$, $q$1$q$],
    array[$q$pier_says$q$, $q$' Water under it: ' || g.water || ', '$q$, $q$' Water under it: ' || metres(g.water) || ' m, '$q$, $q$1$q$],
    array[$q$stand_on_piers$q$, $q$', on piers. Deck at ' || v_deck || ', '$q$, $q$', on piers. Deck at ' || metres(v_deck) || ' m, '$q$, $q$1$q$],
    array[$q$stand_on_piers$q$, $q$', on piers: deck at ' || v_deck || ', '$q$, $q$', on piers: deck at ' || metres(v_deck) || ' m, '$q$, $q$1$q$],
    array[$q$cellar_dig_reason$q$, $q$'Cellar fully dug: ' || cellar_depth()::int || ' down.'$q$, $q$'Cellar fully dug: ' || metres(cellar_depth()) || ' m down.'$q$, $q$1$q$],
    array[$q$cellar_dig_reason$q$, $q$'Rock ' || v_shallow || ' under the ground floor at the shallowest corner; needs '
      || cellar_least_soil()::int || ' of soil at every corner.'$q$, $q$'Rock ' || metres(v_shallow) || ' m under the ground floor at the shallowest corner; needs '
      || metres(cellar_least_soil()) || ' m of soil at every corner.'$q$, $q$1$q$],
    array[$q$cellar_dig_reason$q$, $q$'Ground floor at ' || v_h || ': needs ' || cellar_depth()::int
      || ' above sea level for a ' || cellar_depth()::int || '-deep cellar.'$q$, $q$'Ground floor at ' || metres(v_h) || ' m: needs ' || metres(cellar_depth())
      || ' m above sea level for a ' || metres(cellar_depth()) || ' m deep cellar.'$q$, $q$1$q$],
    array[$q$cellar_floor_said$q$, $q$v_h := to_char(land_height(p_world, p_x, p_y) - c.dug, 'FM990.0');$q$, $q$v_h := metres(land_height(p_world, p_x, p_y) - c.dug);$q$, $q$1$q$],
    array[$q$cellar_floor_said$q$, $q$|| cellar_depth()::int || ' under the ground floor, height ' || v_h || '.'$q$, $q$|| metres(cellar_depth()) || ' m under the ground floor, height ' || v_h || ' m.'$q$, $q$1$q$],
    array[$q$cellar_floor_said$q$, $q$|| v_floor || ', ' || c.dug || '/' || cellar_depth()::int || ' down, height ' || v_h || '.' end$q$, $q$|| v_floor || ', ' || metres(c.dug) || ' m of ' || metres(cellar_depth()) || ' m dug, height ' || v_h || ' m.' end$q$, $q$1$q$],
    array[$q$cellar_refusal$q$, $q$'Soil dug through at ' || coalesce((cellar_at(p_world, v_x, v_y)).dug, 0) || ' down.$q$, $q$'Soil dug through at ' || metres(coalesce((cellar_at(p_world, v_x, v_y)).dug, 0)) || ' m down.$q$, $q$1$q$],
    array[$q$cellar_refusal$q$, $q$'Dig the soil first: ' || (cellar_soil(p_world, v_x, v_y) - coalesce((cellar_at(p_world, v_x, v_y)).dug, 0))$q$, $q$'Dig the soil first: ' || metres(cellar_soil(p_world, v_x, v_y) - coalesce((cellar_at(p_world, v_x, v_y)).dug, 0)) || ' m'$q$, $q$1$q$],
    array[$q$perform_cellar$q$, $q$'. Cellar ' || v_dug || '/'
      || cellar_depth()::int || ' down.'$q$, $q$'. Cellar ' || metres(v_dug) || ' m of '
      || metres(cellar_depth()) || ' m dug.'$q$, $q$1$q$],
    array[$q$perform_cellar$q$, $q$'Cellar fully dug: ' || cellar_depth()::int || ' down.'$q$, $q$'Cellar fully dug: ' || metres(cellar_depth()) || ' m down.'$q$, $q$2$q$],
    array[$q$perform_cellar$q$, $q$'Rock at ' || v_dug || ' down: use a pickaxe.'$q$, $q$'Rock at ' || metres(v_dug) || ' m down: use a pickaxe.'$q$, $q$1$q$],
    array[$q$perform_cellar$q$, $q$'. Cellar ' || v_dug || '/' || cellar_depth()::int
      || ' down.'$q$, $q$'. Cellar ' || metres(v_dug) || ' m of ' || metres(cellar_depth())
      || ' m dug.'$q$, $q$1$q$],
    array[$q$perform_cellar$q$, $q$'. Cellar ' || v_dug || '/' || cellar_depth()::int || ' down.'$q$, $q$'. Cellar ' || metres(v_dug) || ' m of ' || metres(cellar_depth()) || ' m dug.'$q$, $q$1$q$],
    array[$q$cellar_flight_refusal$q$, $q$'Dig the cellar first: ' || coalesce(c.dug, 0) || '/' || cellar_depth()::int || '.'$q$, $q$'Dig the cellar first: ' || metres(coalesce(c.dug, 0)) || ' m of ' || metres(cellar_depth()) || ' m dug.'$q$, $q$1$q$],
    array[$q$cellar_said$q$, $q$' Cellar under it: ' || cellar_depth()::int || ' deep.'$q$, $q$' Cellar under it: ' || metres(cellar_depth()) || ' m deep.'$q$, $q$1$q$],
    array[$q$cellar_said$q$, $q$' Cellar under it: dug ' || c.dug || '/' || cellar_depth()::int
                                    || '.'$q$, $q$' Cellar under it: ' || metres(c.dug) || ' m of ' || metres(cellar_depth())
                                    || ' m dug.'$q$, $q$1$q$],
    array[$q$perform_foundation$q$, $q$'Foundation planned: top at ' || v_top$q$, $q$'Foundation planned: top at ' || metres(v_top) || ' m'$q$, $q$1$q$],
    array[$q$perform_foundation$q$, $q$'Pool dug: floor at ' || (f.top - pool_depth()) || ', water at '
      || (f.top - pool_lip()) || ', ' || to_char((pool_depth() - pool_lip()) / 10.0, 'FM990.0')$q$, $q$'Pool dug: floor at ' || metres(f.top - pool_depth()) || ' m, water at '
      || metres(f.top - pool_lip()) || ' m, ' || metres(pool_depth() - pool_lip())$q$, $q$1$q$],
    array[$q$perform_foundation$q$, $q$' concrete, top at ' || f.top
$q$, $q$' concrete, top at ' || metres(f.top) || ' m'
$q$, $q$1$q$],
    array[$q$perform_foundation$q$, $q$'Foundation done: top at ' || f.top$q$, $q$'Foundation done: top at ' || metres(f.top) || ' m'$q$, $q$1$q$],
    array[$q$foundation_reason$q$, $q$'Soil left over rock: ' || v_soil || ' (all corners). '$q$, $q$'Soil left over rock: ' || metres(v_soil) || ' m (all corners). '$q$, $q$1$q$],
    array[$q$foundation_reason$q$, $q$'Foundations fill up only. High corner ' || v_high
$q$, $q$'Foundations fill up only. High corner ' || metres(v_high) || ' m'
$q$, $q$1$q$],
    array[$q$foundation_reason$q$, $q$'Pour ' || v_lift || ' deep needs masonry '$q$, $q$'Pour ' || metres(v_lift) || ' m deep needs masonry '$q$, $q$1$q$],
    array[$q$foundation_reason$q$, $q$|| to_char(v_have * lift_per_masonry(), 'FM990') || '.';$q$, $q$|| metres(v_have * lift_per_masonry()) || ' m.';$q$, $q$1$q$],
    array[$q$extend_reason$q$, $q$'Slab at ' || v_slab.top || '; ' || b.name || ' floor at ' || b.deck$q$, $q$'Slab at ' || metres(v_slab.top) || ' m; ' || b.name || ' floor at ' || metres(b.deck) || ' m'$q$, $q$1$q$],
    array[$q$bridge_reason$q$, $q$'Ends ' || to_char(abs(ha - hb), 'FM990')
      || ' apart in height; max ' || end_slop() || '. Level one.'$q$, $q$'Ends ' || metres(abs(ha - hb))
      || ' m apart in height; max ' || metres(end_slop()) || ' m. Level one.'$q$, $q$1$q$],
    array[$q$bridge_reason$q$, $q$'Ground under the span: needs ' || clearance() || ' clearance.'$q$, $q$'Ground under the span: needs ' || metres(clearance()) || ' m clearance.'$q$, $q$1$q$],
    array[$q$ramp_refusal$q$, $q$select 'Ends ' || to_char(p_apart, 'FM990') || ' apart in height'$q$, $q$select 'Ends ' || metres(p_apart) || ' m apart in height'$q$, $q$1$q$],
    array[$q$ramp_refusal$q$, $q$|| '. Max rise ' || ramp_slope()::int
      || '/tile: needs '$q$, $q$|| '. Max rise ' || metres(ramp_slope())
      || ' m/tile: needs '$q$, $q$1$q$],
    array[$q$bridge_set_out$q$, $q$'rising' else 'falling' end || ' ' || abs(p_rise)
                || ' toward the far end'$q$, $q$'rising' else 'falling' end || ' ' || metres(abs(p_rise))
                || ' m toward the far end'$q$, $q$1$q$],
    array[$q$aqueduct_plan$q$, $q$|| to_char(spring_depth() / 10.0, 'FM990.0') || ' m of water or more.');$q$, $q$|| metres(spring_depth()) || ' m of water or more.');$q$, $q$1$q$],
    array[$q$aqueduct_plan$q$, $q$'Water there at ' || v_level || ', above the head at ' || v_top$q$, $q$'Water there at ' || metres(v_level) || ' m, above the head at ' || metres(v_top) || ' m'$q$, $q$1$q$],
    array[$q$aqueduct_plan$q$, $q$|| to_char(clearance() / 10.0, 'FM990.0') || ' m of the channel bed.');$q$, $q$|| metres(clearance()) || ' m of the channel bed.');$q$, $q$1$q$],
    array[$q$aqueduct_says$q$, $q$'Last span laid. Channel dry: no spring water at its head at ' || b.height$q$, $q$'Last span laid. Channel dry: no spring water at its head at ' || metres(b.height) || ' m'$q$, $q$1$q$],
    array[$q$aqueduct_says$q$, $q$'Fills the hollow to ' || (v_into->>'level') || ' in '$q$, $q$'Fills the hollow to ' || metres((v_into->>'level')::int) || ' m in '$q$, $q$1$q$],
    array[$q$perform_aqueduct$q$, $q$', channel at ' || (v_plan->>'height')$q$, $q$', channel at ' || metres((v_plan->>'height')::int) || ' m'$q$, $q$1$q$],
    array[$q$spring_refusal$q$, $q$|| to_char(spring_depth() / 10.0, 'FM990.0') || ' m of water or more.';$q$, $q$|| metres(spring_depth()) || ' m of water or more.';$q$, $q$1$q$],
    array[$q$steps_ground_refusal$q$, $q$'Steps are laid on a slope of ' || steps_least()::int || ' to ' || steps_most()::int
      || '. This one is ' || f.slope || '.'$q$, $q$'Steps are laid on a slope of ' || metres(steps_least()) || ' m to ' || metres(steps_most())
      || ' m. This one is ' || metres(f.slope) || ' m.'$q$, $q$1$q$],
    array[$q$steps_ground_refusal$q$, $q$'The two corners at each end of a flight have to be within ' || steps_twist()::int
      || ' of each other. These are ' || f.twist || ' apart.'$q$, $q$'The two corners at each end of a flight have to be within ' || metres(steps_twist())
      || ' m of each other. These are ' || metres(f.twist) || ' m apart.'$q$, $q$1$q$],
    array[$q$level_stop$q$, $q$'Corner already at level ' || v_level || '.'$q$, $q$'Corner already at level ' || metres(v_level) || ' m.'$q$, $q$2$q$],
    array[$q$slope_refusal$q$, $q$'Slope would be ' || v_would || '; ' || p_skill || ' allows ' || v_cap$q$, $q$'Slope would be ' || metres(v_would) || ' m; ' || p_skill || ' allows ' || metres(v_cap) || ' m'$q$, $q$1$q$],
    array[$q$rock_raise_refusal$q$, $q$': not under more than ' || v_deep || ' of water.'$q$, $q$': not under more than ' || metres(v_deep) || ' m of water.'$q$, $q$1$q$],
    array[$q$perform_ground$q$, $q$'Level set: ' || land_height(p_world, cx, cy)
$q$, $q$'Level set: ' || metres(land_height(p_world, cx, cy)) || ' m'
$q$, $q$1$q$],
    array[$q$examine_tile_text$q$, $q$' Height ' || to_char(centre_height(p_world, p_x, p_y), 'FM990.0')
    || ', slope ' || tile_slope(p_world, p_x, p_y) || '.'$q$, $q$' Height ' || metres(centre_height(p_world, p_x, p_y)) || ' m'
    || ', slope ' || metres(tile_slope(p_world, p_x, p_y)) || ' m.'$q$, $q$1$q$],
    array[$q$farm_refusal$q$, $q$'Too steep: slope over 20.'$q$, $q$'Too steep: slope over ' || metres(20) || ' m.'$q$, $q$1$q$],
    array[$q$trap_place_reason$q$, $q$if water_depth(p_world, p_x, p_y) < 1 then
      return 'Creel needs water 1 deep or more.';$q$, $q$if water_depth(p_world, p_x, p_y) < 1 then
      return 'Creel needs water ' || metres(1) || ' m deep or more.';$q$, $q$1$q$],
    array[$q$upgrade_wants$q$, $q$label := 'a crate on the deed';$q$, $q$label := 'a crate on the settlement';$q$, $q$1$q$],
    array[$q$upgrade_wants$q$, $q$label := 'a campfire on the deed';$q$, $q$label := 'a campfire on the settlement';$q$, $q$1$q$],
    array[$q$upgrade_wants$q$, $q$label := 'a stone smelter on the deed';$q$, $q$label := 'a stone smelter on the settlement';$q$, $q$1$q$],
    array[$q$upgrade_wants$q$, $q$label := 'an anvil set down on the deed';$q$, $q$label := 'an anvil set down on the settlement';$q$, $q$1$q$],
    array[$q$upgrade_wants$q$, $q$label := '3 wildermon working the deed';$q$, $q$label := '3 wildermon working the settlement';$q$, $q$1$q$],
    array[$q$perform_settlement$q$, $q$' tiles from the token; '$q$, $q$' tiles from the totem; '$q$, $q$1$q$],
    array[$q$perform_settlement$q$, $q$'. Deed stake to pack. Deed crate removed; '$q$, $q$'. ' || (select d.name from item_def d where d.id = 'deed_stake') || ' to pack. Settlement crate removed; '$q$, $q$1$q$],
    array[$q$perform_deed$q$, $q$' tiles round the token.'$q$, $q$' tiles round the totem.'$q$, $q$1$q$],
    array[$q$perform_deed$q$, $q$' Deed crate placed beside it.'$q$, $q$' Settlement crate placed beside it.'$q$, $q$1$q$],
    array[$q$deed_refusal$q$, $q$'Token needs dry land.'$q$, $q$'Totem needs dry land.'$q$, $q$1$q$],
    array[$q$deed_refusal$q$, $q$'Token needs a clear tile.'$q$, $q$'Totem needs a clear tile.'$q$, $q$1$q$],
    array[$q$deed_refusal$q$, $q$then return 'You have no deed stake.'; end if;$q$, $q$then return 'You have no ' || (select lower(d.name) from item_def d where d.id = 'deed_stake') || '.'; end if;$q$, $q$1$q$],
    array[$q$frame_jetty_refusal$q$, $q$'Only on your own deed.'$q$, $q$'Only on your own settlement.'$q$, $q$1$q$],
    array[$q$frame_outside_stair_refusal$q$, $q$'Only on your own deed.'$q$, $q$'Only on your own settlement.'$q$, $q$1$q$],
    array[$q$extend_reason$q$, $q$'Only on your own deed.'$q$, $q$'Only on your own settlement.'$q$, $q$1$q$],
    array[$q$extend_reason$q$, $q$'Settlement token here.'$q$, $q$'Settlement totem here.'$q$, $q$1$q$],
    array[$q$foundation_reason$q$, $q$'Settlement token there.'$q$, $q$'Settlement totem there.'$q$, $q$1$q$],
    array[$q$pool_reason$q$, $q$'Settlement token there.'$q$, $q$'Settlement totem there.'$q$, $q$1$q$],
    array[$q$trap_place_reason$q$, $q$'Not on your deed: wild creatures do not enter it.'$q$, $q$'Not on your settlement: wild creatures do not enter it.'$q$, $q$1$q$],
    array[$q$telestone_refusal$q$, $q$' would be left behind: send it to your deed or into a crate first.'$q$, $q$' would be left behind: send it to your settlement or into a crate first.'$q$, $q$1$q$],
    array[$q$examine_tile_text$q$, $q$' Settlement token: '$q$, $q$' Settlement totem: '$q$, $q$1$q$],
    array[$q$rpc_join_ask$q$, $q$'No settlement token here.'$q$, $q$'No settlement totem here.'$q$, $q$1$q$],
    array[$q$rpc_order$q$, $q$'Stand at a settlement token or a mailbox to put up an order.'$q$, $q$'Stand at a settlement totem or a mailbox to put up an order.'$q$, $q$1$q$],
    array[$q$rpc_order_fill$q$, $q$'Stand at a settlement token or a mailbox to fill an order.'$q$, $q$'Stand at a settlement totem or a mailbox to fill an order.'$q$, $q$1$q$],
    array[$q$tree_outlook$q$, $q$v_out := ' Next stage ' || v_when$q$, $q$v_out := ' Next age ' || v_when$q$, $q$1$q$],
    array[$q$examine_tile_text$q$, $q$'). Dig out, or grass at next dawn.'$q$, $q$'). Dig out, or grass at the next ' || daily_reset_words() || '.'$q$, $q$1$q$],
    array[$q$ground_refusal$q$, $q$'Tapped today. Again at dawn.'$q$, $q$'Tapped today. Again at the ' || daily_reset_words() || '.'$q$, $q$1$q$],
    array[$q$examine_item_text$q$, $q$item_name(it) || ': QL '$q$, $q$item_name(it) || ': Quality '$q$, $q$1$q$],
    array[$q$examine_item_text$q$, $q$' Works as QL '$q$, $q$' Works as Quality '$q$, $q$1$q$],
    array[$q$examine_item_text$q$, $q$|| ' QL past your skill.';$q$, $q$|| ' quality past your skill.';$q$, $q$1$q$],
    array[$q$examine_item_text$q$, $q$v_out := v_out || ' Knack: '$q$, $q$v_out := v_out || case when coalesce(d.food, 0) > 0 then ' Meal' else ' Drink' end || ' boost: '$q$, $q$1$q$],
    array[$q$taste_says$q$, $q$v_said := v_said || ('knack ' || clock_left($q$, $q$v_said := v_said || (case when coalesce(d.food, 0) > 0 then 'meal' else 'drink' end || ' boost ' || clock_left($q$, $q$1$q$],
    array[$q$rpc_leave_deed$q$, $q$'Not on the roll.'$q$, $q$'Not on the member list.'$q$, $q$1$q$],
    array[$q$rpc_leave_deed$q$, $q$' is off the roll of '$q$, $q$' is off the member list of '$q$, $q$1$q$],
    array[$q$rpc_leave_deed$q$, $q$' off the roll of '$q$, $q$' off the member list of '$q$, $q$1$q$],
    array[$q$rpc_queue_order$q$, $q$'Not an order of the queued jobs: nothing moved.'$q$, $q$'Not an order of the queued actions: nothing moved.'$q$, $q$1$q$],
    array[$q$rpc_queue_order$q$, $q$|| ' jobs.', 'info');$q$, $q$|| ' actions.', 'info');$q$, $q$1$q$],
    array[$q$skill_said$q$, $q$' Job queue: '$q$, $q$' Action queue: '$q$, $q$1$q$],
    array[$q$rpc_act$q$, $q$'Job queue full: '$q$, $q$'Action queue full: '$q$, $q$1$q$],
    array[$q$farm_refusal$q$, $q$'Already tended at this stage.'$q$, $q$'Already tended at this growth stage.'$q$, $q$1$q$],
    array[$q$planter_refusal$q$, $q$'Already tended at this stage.'$q$, $q$'Already tended at this growth stage.'$q$, $q$1$q$],
    array[$q$gate_said$q$, $q$'Drawbridge lowered: people and beasts'$q$, $q$'Drawbridge lowered: people and creatures'$q$, $q$1$q$],
    array[$q$store_refusal$q$, $q$'. Opens for its founder and ranks with Use the stores only.'$q$, $q$'. Opens for its founder and ranks with Use the settlement stores only.'$q$, $q$1$q$],
    array[$q$examine_item_text$q$, $q$|| ', damage ' || to_char(it.dmg, 'FM990.00')$q$, $q$|| ', damage ' || to_char(it.dmg, 'FM990.00') || '%'$q$, $q$1$q$],
    array[$q$perform_item$q$, $q$'Patched: ' || v_name || ', damage '
      || to_char(greatest(0, v_it.dmg - v_healed), 'FM990.00') || '.'$q$, $q$'Patched: ' || v_name || ', damage '
      || to_char(greatest(0, v_it.dmg - v_healed), 'FM990.00') || '%.'$q$, $q$1$q$],
    array[$q$perform_item$q$, $q$'Mended: ' || v_name || ', damage '
      || to_char(v_it.dmg, 'FM990.00') || '.'$q$, $q$'Mended: ' || v_name || ', damage '
      || to_char(v_it.dmg, 'FM990.00') || '%.'$q$, $q$1$q$],
    array[$q$hurt_player$q$, $q$|| ' (' || damage_max()::int || ' damage).'$q$, $q$|| ' (' || damage_max()::int || '% damage).'$q$, $q$1$q$]
  ] loop
    v_total := 0;
    for r in select p.oid from pg_proc p join pg_namespace s on s.oid = p.pronamespace
              where s.nspname = 'public' and p.proname = v_p[1] loop
      v_def := pg_get_functiondef(r.oid);
      v_n := (length(v_def) - length(replace(v_def, v_p[2], ''))) / length(v_p[2]);
      if v_n > 0 then
        v_total := v_total + v_n;
        execute replace(v_def, v_p[2], v_p[3]);
      end if;
    end loop;
    if v_total <> v_p[4]::int then
      raise exception '% has % of %, not %', v_p[1], v_total, v_p[2], v_p[4];
    end if;
  end loop;
end $do$;

select private.lock_doors();
