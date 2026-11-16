/**
 * Remove floor: never the roof, and a floor under walls that stand on something else comes up, for a higher ceiling.
 *
 * Reported: "clicking remove floor removed the roof"; and asked for: "allow removing floors after walls have been
 * constructed, to allow players to have higher ceilings". A house of two storeys and a roof over them, 3 by 3, walls
 * all round both storeys and one across storey 2 inside (v, between (1,1) and (2,1)) with none under it:
 *
 *   * Remove floor on the middle tile with no storey named: storey 2's floor comes up, the roof over it stays;
 *   * an edge tile's storey-2 floor, its wall standing on storey 1's wall under it: comes up;
 *   * the inside wall's east tile: comes up, the wall standing on the floor across it;
 *   * and then its west tile: refused, the wall with nothing else under it.
 */
import { psql, check, finish } from './harness';

const U = '7e5b0000-0000-4000-8000-00000f100a11';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; b int := 1; gx int; gy int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Floors', 133, 32, 10, 10, true) returning id into w;
  perform land_blank(w, 32);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Floorer');
  insert into building (world_id, id, name, levels, planned_by) values (w, b, 'House', 3, u);
  for gx in 10..12 loop for gy in 10..12 loop
    insert into building_tile (world_id, building, x, y) values (w, b, gx, gy);
    insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total, planned_by) values
      (w, 0, gx, gy, b, 'plank', 'floor', '{}', '{}', u), (w, 1, gx, gy, b, 'plank', 'floor', '{}', '{}', u),
      (w, 2, gx, gy, b, 'thatch', 'roof', '{}', '{}', u);
  end loop; end loop;
  for l in 0..1 loop
    for gx in 10..12 loop
      insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by) values
        (w, l, 'h', gx, 10, b, 'solid', 'plank', '{}', '{}', u), (w, l, 'h', gx, 13, b, 'solid', 'plank', '{}', '{}', u);
    end loop;
    for gy in 10..12 loop
      insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by) values
        (w, l, 'v', 10, gy, b, 'solid', 'plank', '{}', '{}', u), (w, l, 'v', 13, gy, b, 'solid', 'plank', '{}', '{}', u);
    end loop;
  end loop;
  -- Across storey 2 inside, with nothing under it.
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by) values
    (w, 1, 'v', 12, 11, b, 'solid', 'plank', '{}', '{}', u);

  -- The middle tile, no storey named: storey 2's floor, not the roof.
  insert into said values ('MID_REFUSED', coalesce(build_refusal(w, u, 'remove_floor', '{"kind":"tile","x":11,"y":10}'::jsonb), 'none'));
  perform perform_building(w, u, 'remove_floor', '{"kind":"tile","x":11,"y":10}'::jsonb);
  insert into said select 'MID_LEFT', string_agg(level || ':' || kind, ',' order by level) from floor_tile where world_id = w and x = 11 and y = 10;
  -- An edge tile's storey 2, its wall on storey 1's wall.
  insert into said values ('EDGE', coalesce(build_refusal(w, u, 'remove_floor', '{"kind":"tile","x":10,"y":12,"level":1}'::jsonb), 'none'));
  -- The inside wall's east tile, then its west tile.
  insert into said values ('EAST', coalesce(build_refusal(w, u, 'remove_floor', '{"kind":"tile","x":12,"y":11,"level":1}'::jsonb), 'none'));
  perform perform_building(w, u, 'remove_floor', '{"kind":"tile","x":12,"y":11,"level":1}'::jsonb);
  insert into said values ('WEST', coalesce(build_refusal(w, u, 'remove_floor', '{"kind":"tile","x":11,"y":11,"level":1}'::jsonb), 'none'));
end $t$;
select k || '=' || v from said;
rollback;`);
const said = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
check('Remove floor with no storey named, on the middle of a roofed house: allowed', said.get('MID_REFUSED') === 'none', said.get('MID_REFUSED'));
check('and it takes up storey 2\'s floor, the roof over it left', said.get('MID_LEFT') === '0:floor,2:roof', said.get('MID_LEFT'));
check('an edge tile\'s storey-2 floor, its wall standing on the wall under it: comes up', said.get('EDGE') === 'none', said.get('EDGE'));
check('a floor beside a wall standing on the floor across it: comes up', said.get('EAST') === 'none', said.get('EAST'));
check('and the floor across, the wall then with nothing under it: refused', said.get('WEST') === 'Remove the walls on it first.', said.get('WEST'));
finish('remove floor under walls');
