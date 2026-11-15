/*
 * A roof over an open well.
 *
 * Reported: "if previously removing a floor, the option to make a roof
 * disappears. fix". A two-storey building with storey 2's floor taken up over
 * three tiles along its south side: the roof was refused over the whole of it,
 * for good.
 *
 * `level_gap` asked a wall or columns on every outside side of the storey's
 * area, and the area is the footprint whether or not the storey has a floor on
 * a tile of it. A tile of storey 2 with no floor slot takes no wall on any side
 * (`plan_wall`: "Build this storey's floor first"), and its outside sides were
 * counted bare all the same: a storey nobody could ever close in, so a roof
 * nobody could ever plan.
 *
 * Now a tile of storey 2 and up with nothing on its floor slot is an open well
 * over the storey under it, and its sides are asked nothing. Every other
 * outside side still wants a finished wall or a column at each end, and a wall
 * planned anywhere on the storey and not finished, round the well too, is
 * still going up. A storey with no floor at all is a storey not started, and
 * every side of it is asked for, as before. The ground storey is unchanged:
 * its walls stand on the ground.
 *
 * And the refusal points at the nearest of every wall still going up, inside
 * the storey as well as round it: "4 still going up" with walls planned round
 * a well said nothing of where they were. A wall inside is named by the tile
 * its border is the north or west side of.
 *
 * The browser asks the same in the same words (`Buildings.levelGaps`), and
 * offers Plan roof on the top storey's own menu while it is pinned, greyed
 * with the refusal when there is one.
 */
set local lock_timeout = '3s';

create or replace function level_gap(p_world uuid, p_building integer, p_level integer, p_x double precision, p_y double precision)
 returns text
 language sql
 stable
as $function$
  with area as (select * from frame_storey(p_world, p_building, p_level)),
  floored as (
    select t.x, t.y from area t
    where exists (select 1 from floor_tile f where f.world_id = p_world and f.level = p_level and f.x = t.x and f.y = t.y)),
  -- An open well: a tile of storey 2 and up with nothing on its floor slot takes no wall, and none is asked of it.
  -- A storey with no floor at all is a storey not started, and every side of it is asked for.
  asked as (
    select t.x, t.y from area t
    where p_level < 1 or not exists (select 1 from floored)
       or exists (select 1 from floored q where q.x = t.x and q.y = t.y)),
  sides as (
    select t.x, t.y, s.side, b.dir, b.x as bx, b.y as by
    from asked t
    cross join lateral (values ('n'), ('e'), ('s'), ('w')) as s(side)
    cross join lateral across(t.x, t.y, s.side) a
    cross join lateral border_of(t.x, t.y, s.side) b
    where not exists (select 1 from area q where q.x = a.x and q.y = a.y)),
  holes as (
    select s.x, s.y, s.side, (w.type is null) as bare
    from sides s
    left join wall w on w.world_id = p_world and w.level = p_level
      and w.dir = s.dir and w.x = s.bx and w.y = s.by
    where (w.type is null and not frame_carried(p_world, p_level, s.dir, s.bx, s.by))
       or (w.type is not null and not bill_done(w.needed))),
  -- And anything planned inside it and never finished, which stops a storey
  -- being closed in just as surely as a hole in the outside wall: named by the
  -- tile its border is the north or west side of.
  within as (
    select w.x, w.y, case when w.dir = 'h' then 'n' else 'w' end as side from wall w
    where w.world_id = p_world and w.building = p_building and w.level = p_level
      and not bill_done(w.needed)
      and not exists (select 1 from sides s where s.dir = w.dir and s.bx = w.x and s.by = w.y)),
  named as (
    select h.x, h.y, h.side from holes h
    union all
    select i.x, i.y, i.side from within i),
  tally as (
    select (select count(*) filter (where bare) from holes)::int as bare,
           ((select count(*) filter (where not bare) from holes) + (select count(*) from within))::int as going,
           (select ', nearest the ' || side_name(n.side) || ' side of ' || n.x || ',' || n.y
              from named n
             order by (n.x + 0.5 - p_x) ^ 2 + (n.y + 0.5 - p_y) ^ 2, n.x, n.y, strpos('nesw', n.side)
             limit 1) as at)
  select case when bare = 0 and going = 0 then null else
    'Storey ' || (p_level + 1) || ' not enclosed: '
      || array_to_string(array_remove(array[
           case when bare > 0 then bare || ' side' || case when bare = 1 then '' else 's' end
                                  || ' with no wall or columns' end,
           case when going > 0 then going || ' still going up' end], null), ' and ')
      || coalesce(at, '') || '.' end
  from tally
$function$;

select private.lock_doors();
