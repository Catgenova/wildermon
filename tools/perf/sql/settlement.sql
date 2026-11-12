-- Fill Solara (128,128) with :houses houses of :storeys storeys, :pieces stores holding :things things each,
-- :crates crates holding :cthings each, :lying things on the ground over 7 tiles, :workers deed workers,
-- :followers following and :stored crated. Clears what was there first.
\set ON_ERROR_STOP on
set client_min_messages = warning;
select id as world from world \gset
delete from item where world_id = :'world' and holder in ('furniture', 'crate', 'ground');
delete from creature where world_id = :'world';
delete from placed where world_id = :'world';
delete from crate where world_id = :'world';
delete from wall where world_id = :'world';
delete from floor_tile where world_id = :'world';
delete from building_tile where world_id = :'world';
delete from building where world_id = :'world';
create temp table taken (tx int, ty int, primary key (tx, ty)) on commit preserve rows;
truncate taken;
do $$
declare w uuid := (select id from world limit 1); me uuid := '11111111-1111-1111-1111-111111111111';
        b int; lv int; x int; y int; x0 int; y0 int; c int; r int; k int; pid bigint; mats text[] := array['stone_brick','plank','cobblestone','marble'];
        defs text[] := array['log','plank','rock_shards','iron_lump','clay','shaft','nail','brick','mortar','sand','timber','ribbon'];
        subs text[] := array['chest','barrel','shelves','larder','bulk_bin','craft_bin','coffer','wardrobe','cupboard','bookshelf'];
        cells int[][] := '{}'; n_cells int := 0; i int; nid bigint := 1;
        houses int := current_setting('perf.houses')::int; storeys int := current_setting('perf.storeys')::int;
        pieces int := current_setting('perf.pieces')::int; things int := current_setting('perf.things')::int;
        crates int := current_setting('perf.crates')::int; cthings int := current_setting('perf.cthings')::int;
        lying int := current_setting('perf.lying')::int; workers int := current_setting('perf.workers')::int;
        followers int := current_setting('perf.followers')::int; stored int := current_setting('perf.stored')::int;
        jobs text[][] := array[['cobbe','hod'],['crawler','sand'],['noot','clay'],['awla','shaft'],['dowse','nail'],['rippa','saw'],
                               ['glossa','mortar'],['mudda','brick'],['magga','fetch'],['chissa','chisel'],['crakka','concrete'],['quarra','quarry']];
        sp text; job text; fx double precision; fy double precision;
begin
  -- Houses on 9x8 cells round the totem, nearest first.
  for b in 1..houses loop
    select cx, cy into x0, y0 from (
      select 128 - 22 + cc * 9 as cx, 128 - 20 + rr * 8 as cy from generate_series(0, 4) cc, generate_series(0, 4) rr
       where not (cc = 2 and rr = 2)
       order by (128 - 22 + cc * 9 + 3 - 128)^2 + (128 - 20 + rr * 8 + 2 - 128)^2, cc, rr
    ) q offset ((b - 1) % 24) limit 1;
    insert into building (world_id, id, name, levels, work_level) values (w, b, 'House ' || b, storeys, storeys - 1);
    for y in y0..y0 + 4 loop for x in x0..x0 + 5 loop
      insert into building_tile (world_id, building, x, y) values (w, b, x, y) on conflict do nothing;
      insert into taken values (x, y) on conflict do nothing;
    end loop; end loop;
    for lv in 0..storeys - 1 loop
      for y in y0..y0 + 4 loop for x in x0..x0 + 5 loop
        insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total)
        values (w, lv, x, y, b, mats[1 + b % 4], 'floor', '{}', '{}') on conflict do nothing;
      end loop; end loop;
      for x in x0..x0 + 5 loop
        insert into wall (world_id, level, dir, x, y, building, type, material, needed, total) values
          (w, lv, 'h', x, y0, b, case when x = x0 + 1 then 'window' else 'solid' end, mats[1 + b % 4], '{}', '{}'),
          (w, lv, 'h', x, y0 + 5, b, case when lv = 0 and x = x0 + 3 then 'door' else 'solid' end, mats[1 + b % 4], '{}', '{}') on conflict do nothing;
      end loop;
      for y in y0..y0 + 4 loop
        insert into wall (world_id, level, dir, x, y, building, type, material, needed, total) values
          (w, lv, 'v', x0, y, b, 'solid', mats[1 + b % 4], '{}', '{}'),
          (w, lv, 'v', x0 + 6, y, b, 'solid', mats[1 + b % 4], '{}', '{}') on conflict do nothing;
      end loop;
    end loop;
  end loop;
  -- Stores out in the open, nearest the totem first, marked the settlement's, each holding `things` things.
  k := 0;
  for i in 1..pieces + stored loop
    loop
      x := 128 - 22 + floor(random() * 45)::int; y := 128 - 20 + floor(random() * 40)::int;
      exit when not exists (select 1 from taken t where t.tx = x and t.ty = y) and greatest(abs(x - 128), abs(y - 128)) > 1;
    end loop;
    insert into taken values (x, y);
    insert into placed (world_id, kind, sub, x, y, cx, cy, ql, made_by, material, store_of, facing)
    values (w, 'furniture', case when i <= pieces then subs[1 + i % array_length(subs, 1)] else 'creature_crate' end, x, y, x + 0.5, y + 0.5, 40, me, 'oak',
            case when i <= pieces then me end, 's') returning id into pid;
    if i <= pieces then
      insert into item (world_id, holder, placed, def, ql, count)
      select w, 'furniture', pid, defs[1 + (pid + g) % array_length(defs, 1)], 20 + (g % 50), 1 + g % 5 from generate_series(1, things) g;
    else
      insert into creature (world_id, id, species, name, mode, from_x, from_y, to_x, to_y, health, sex, keeper, skills)
      values (w, nid, (array['quarra','orse','seavic','mola','rabba','tinka','woola','noot'])[1 + nid % 8], 'Stored ' || nid, 'stored', x + 0.5, y + 0.5, x + 0.5, y + 0.5, 1, 'male', me, '{"haul": 30}');
      update placed set creature = nid where id = pid;
      nid := nid + 1;
    end if;
  end loop;
  for i in 1..crates loop
    loop
      x := 128 - 22 + floor(random() * 45)::int; y := 128 - 20 + floor(random() * 40)::int;
      exit when not exists (select 1 from taken t where t.tx = x and t.ty = y);
    end loop;
    insert into taken values (x, y);
    insert into crate (world_id, id, kind, x, y, sx, sy, material, deed, made_by, ql, store_of) values (w, 100000 + i, 'plank', x, y, 0, 0, 'oak', true, me, 30, me);
    insert into item (world_id, holder, crate, def, ql, count) select w, 'crate', 100000 + i, 'plank', 30, 1 from generate_series(1, cthings);
  end loop;
  -- Things lying on 7 tiles south-east of the totem.
  insert into item (world_id, holder, gx, gy, def, ql, count)
  select w, 'ground', 130 + (g % 7), 131, defs[1 + g % array_length(defs, 1)], 30, 1 + g % 6 from generate_series(1, lying) g;
  -- Workers: a job each, keepers me, at work round the totem.
  for i in 1..workers loop
    sp := jobs[1 + (i - 1) % 12][1]; job := jobs[1 + (i - 1) % 12][2];
    fx := 128 - 16 + random() * 32; fy := 128 - 14 + random() * 28;
    insert into creature (world_id, id, species, name, mode, from_x, from_y, to_x, to_y, health, sex, keeper, job, phase, skills, settled_at)
    values (w, nid, sp, 'Worker ' || nid, 'deed', fx, fy, fx, fy, 1, 'female', me, job, 'out', jsonb_build_object('haul', 30), now());
    nid := nid + 1;
  end loop;
  for i in 1..followers loop
    insert into creature (world_id, id, species, name, mode, from_x, from_y, to_x, to_y, health, sex, keeper, skills)
    values (w, nid, (array['roxxen','seavic','woola','quarra','orse'])[1 + i % 5], 'Follower ' || nid, 'active', 128.5 + cos(i), 128.5 + sin(i), 128.5 + cos(i), 128.5 + sin(i), 1, 'male', me, '{"haul": 30}');
    nid := nid + 1;
  end loop;
  -- At heel and well, as companions mostly are.
  update creature fc set health = max_health(fc) where fc.world_id = w and fc.mode = 'active';
end $$;
analyze;
select (select count(*) from placed) placed, (select count(*) from crate) crates, (select count(*) from item where holder in ('furniture','crate','ground')) items,
       (select count(*) from wall) walls, (select count(*) from floor_tile) floors, (select count(*) from creature) creatures;
