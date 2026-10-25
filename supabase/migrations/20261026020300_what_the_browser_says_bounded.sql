-- What the browser says, bounded where the island took it as said.
--
-- Every `rpc_*` door was read for the values a browser hands it that set where a thing goes, how many,
-- of what, at what quality, called what, or for how much. Most were already worked out on the island or
-- held to a range. These were not:
--
--   * Nine jobs that set something down or dig into a tile took the tile from the target and never asked
--     how far it was: a campfire, a smelter, a kiln, a piece of furniture, an anvil, a work post, a crate
--     and a trap could be put down anywhere on the island, and a tile investigated from across it. The
--     browser walks to within the job's range first (`Game.inRange`); the island now asks the same
--     (`in_reach`, the job's `range`, 1 when it has none), and a crate's subtile is one of the four.
--   * And past those nine, no job pointed at a tile reaches further than `private.reach_most()` tiles,
--     whatever family answers for it: a ceiling under every reach the island has, for the next one that
--     forgets its own.
--   * `rpc_creatures`, `rpc_ground` and `rpc_springs` read as far round you as the browser asked: the whole
--     island, settling every crop and creature on it in one call. Now `private.read_range_most()` tiles.
--   * `rpc_found` put the spawn wherever it was told, on the island or off it, and a name past the 40
--     characters `world` holds failed on its check constraint; both are refused at the door now.
--   * `rpc_deal` kept a negative price; `rpc_price`, `rpc_order` and `rpc_deal` any price at all. Now no
--     price is under nought or over `private.price_most()` silver.
--
-- Each is a statement at the very top of its function (`private.door_guard`), refused as a bad request in
-- one line, or for the jobs in the job's own words.

set local lock_timeout = '3s';

/** The furthest any job pointed at a tile reaches, in tiles: past every range the island gives one. */
create or replace function private.reach_most() returns int language sql immutable as $fn$ select 32 $fn$;
/** The furthest round you the island reads the ground, the creatures and the springs, in tiles. */
create or replace function private.read_range_most() returns double precision language sql immutable as $fn$ select 64::double precision $fn$;
/** The most silver a price, an order or a deal asks or offers. */
create or replace function private.price_most() returns bigint language sql immutable as $fn$ select 1000000000::bigint $fn$;
/** The longest name an island is founded with: `world.name`'s own check. */
create or replace function private.island_name_most() returns int language sql immutable as $fn$ select 40 $fn$;

/** The jobs that set a thing down on a tile, or dig into one, and answer for no reach of their own. */
create or replace function private.set_down_job(p_action text) returns boolean language sql immutable as $fn$
  select p_action in ('build_campfire', 'place_smelter', 'place_kiln', 'place_furniture', 'place_anvil', 'place_post',
                      'place_crate', 'set_trap', 'investigate')
$fn$;

/** A bad request: one line, in the shape `check_args` raises. */
create or replace function private.bad_request(p_door text, p_what text) returns void language plpgsql as $fn$
begin
  raise exception 'Bad request: % %.', p_door, p_what using errcode = '22023';
end $fn$;

/**
 * Whether a job pointed at a tile is in reach of the body asking: the set-down jobs at their own range and
 * on one of a tile's subtiles, and every job under `reach_most`. Null when it is, or when the target is not
 * a tile.
 */
create or replace function private.reach_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql stable as $fn$
declare v_x double precision; v_y double precision; v_d action_def; v_most int := private.reach_most();
begin
  if p_target is null or coalesce(p_target->>'kind', 'tile') not in ('tile', 'ground') then return null; end if;
  select pl.x, pl.y into v_x, v_y from player pl where pl.world_id = p_world and pl.uid = p_uid;
  if v_x is null then return null; end if;
  if (jsonb_typeof(p_target->'x') = 'number' and abs(floor(v_x) - floor((p_target->>'x')::double precision)) > v_most)
     or (jsonb_typeof(p_target->'y') = 'number' and abs(floor(v_y) - floor((p_target->>'y')::double precision)) > v_most)
     or (jsonb_typeof(p_target->'cx') = 'number' and abs(floor(v_x) - floor((p_target->>'cx')::double precision)) > v_most)
     or (jsonb_typeof(p_target->'cy') = 'number' and abs(floor(v_y) - floor((p_target->>'cy')::double precision)) > v_most) then
    return 'You are too far away from that.';
  end if;
  if not private.set_down_job(p_action) then return null; end if;
  if (p_target ? 'sx' and case when jsonb_typeof(p_target->'sx') = 'number'
                               then (p_target->>'sx')::numeric not between 0 and subtiles() - 1 else true end)
     or (p_target ? 'sy' and case when jsonb_typeof(p_target->'sy') = 'number'
                                  then (p_target->>'sy')::numeric not between 0 and subtiles() - 1 else true end) then
    return 'Choose a spot.';
  end if;
  select * into v_d from action_def where id = p_action;
  if in_reach(v_x, v_y, p_target, v_d.corner, v_d.range) is false then return 'You are too far away from that.'; end if;
  return null;
end $fn$;

revoke all on function private.reach_most(), private.read_range_most(), private.price_most(), private.island_name_most(),
  private.set_down_job(text), private.bad_request(text, text), private.reach_refusal(uuid, uuid, text, jsonb)
  from public, anon, authenticated;

insert into private.door_guard (door, ord, line) values
  ('act_refusal', 10,
   'why := private.reach_refusal(p_world, p_uid, p_action, p_target); if why is not null then return why; end if;'),
  ('rpc_creatures', 30, 'p_range := least(greatest(coalesce(p_range, 0), 0), private.read_range_most());'),
  ('rpc_ground', 30, 'p_range := least(greatest(coalesce(p_range, 0), 0), private.read_range_most());'),
  ('rpc_springs', 30, 'p_range := least(greatest(coalesce(p_range, 0), 0), private.read_range_most());'),
  ('rpc_found', 30, 'if p_spawn_x < 0 or p_spawn_y < 0 or p_spawn_x >= p_size or p_spawn_y >= p_size then perform private.bad_request(''rpc_found'', ''p_spawn: off the island''); end if;'),
  ('rpc_found', 31, 'if char_length(p_name) > private.island_name_most() then perform private.bad_request(''rpc_found'', ''p_name: too long''); end if;'),
  ('rpc_deal', 30, 'if coalesce(p_want, 0) not between 0 and private.price_most() or coalesce(p_give, 0) not between 0 and private.price_most() then perform private.bad_request(''rpc_deal'', ''p_want, p_give: out of range''); end if;'),
  ('rpc_price', 30, 'if coalesce(p_silver, 0) > private.price_most() then perform private.bad_request(''rpc_price'', ''p_silver: out of range''); end if;'),
  ('rpc_order', 30, 'if coalesce(p_price, 0) > private.price_most() then perform private.bad_request(''rpc_order'', ''p_price: out of range''); end if;')
on conflict do nothing;

select private.lock_doors();
