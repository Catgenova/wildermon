-- The iron vein at 2625, 2995 on the live island, put back.
--
-- An exposed Iron vein, buried by Change tile at a corner it shares: a spadeful of soil on any corner of a bare rock
-- tile turns it to Dirt (`reconcile`), and Change tile raised the corner and laid soil on it. On 11-04 the tile read
-- Dirt with 0.1 m of soil on its north-west corner. Change tile no longer raises anything, and Drop dirt is refused
-- at a corner touching rock (20261104120000); this puts back what was lost before that.
--
-- The rock under the tile set to Iron vein, the soil off its four corners, and every tile round those corners brought
-- in line with its soil as the island always does it (`reconcile_around`): the tile is bare Iron vein again. Heights
-- are left as they are. Only on the island it happened on; anywhere else, nothing.
set local lock_timeout = '3s';

do $fix$
declare w uuid; v_x int := 2625; v_y int := 2995; v_iron int;
begin
  select id into w from world where id::text like 'f3a88670%';
  if w is null then return; end if;
  select id into v_iron from rock_def where yields = 'iron_ore';
  -- Not under anything built: a slab or a building on it is somebody's, and not this fix's to touch.
  if exists (select 1 from foundation f where f.world_id = w and f.x = v_x and f.y = v_y)
     or exists (select 1 from building_tile b where b.world_id = w and b.x = v_x and b.y = v_y) then
    raise notice 'the tile at %, % has something built on it: left as it is', v_x, v_y;
    return;
  end if;
  perform land_set_rock(w, v_x, v_y, v_iron);
  perform land_set_dirt(w, v_x, v_y, 0);
  perform land_set_dirt(w, v_x + 1, v_y, 0);
  perform land_set_dirt(w, v_x + 1, v_y + 1, 0);
  perform land_set_dirt(w, v_x, v_y + 1, 0);
  perform reconcile_around(w, v_x, v_y);
  perform reconcile_around(w, v_x + 1, v_y);
  perform reconcile_around(w, v_x + 1, v_y + 1);
  perform reconcile_around(w, v_x, v_y + 1);
  -- Rock already, and so left alone by `reconcile`: its kind said all the same.
  perform land_set_data(w, v_x, v_y, v_iron);
  perform land_announce(w, v_x, v_y);
  perform land_announce_corner(w, v_x, v_y);
  perform land_announce_corner(w, v_x + 1, v_y);
  perform land_announce_corner(w, v_x + 1, v_y + 1);
  perform land_announce_corner(w, v_x, v_y + 1);
  raise notice 'the tile at %, % is %, kind %', v_x, v_y,
    (select name from tile_def where id = land_tile(w, v_x, v_y)), land_data(w, v_x, v_y);
end $fix$;

select private.lock_doors();
