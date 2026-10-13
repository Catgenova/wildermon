/*
 * Trellises settled by their own footprint, whenever the definitions land
 * (`src/game/vineyard.ts`).
 *
 * 20261013210200_trellises_share_a_corner_and_keep_one_to_a_row.sql settles
 * one trellis to a row (`trellis_settle`) as it is applied. On a deploy the
 * definitions are written after the newest migration, so it ran while
 * `furniture_def` still had a trellis a single spot across, and `placed_size`
 * read that: the centre it wrote (`cx`, `cy`, which reach is measured from)
 * was a spot in from the end of the row rather than its middle, and a row
 * taken by another piece anywhere but at its first spot was kept.
 *
 *   * `trellis_size`: the block a trellis takes, worked out from `subtiles()`
 *     and the way it faces -- the row along that side of its tile, one deep
 *     (`furnitureFootprint` of `FurnitureDef.vine`) -- and not from the
 *     definitions;
 *   * `trellis_settle`, from that migration: settled by `trellis_size`. Its
 *     row is asked after with `piece_block_taken`, which measures every piece
 *     but a trellis, and so asks nothing of a trellis's size;
 *   * `trellis_return`, from that migration: a trellis left on the ground of
 *     its tile, by an owner who has left the island, keeps its rarity;
 *   * the trellis's footprint written into `furniture_def` here too, as the
 *     definitions write it, so whatever reads it before they land reads it
 *     right; and the settling run again, which puts every trellis's centre in
 *     the middle of its row and hands back one whose row is taken. Run where
 *     the last one already ran right, it changes nothing.
 *
 * `supabase/test/vineyard.ts` settles with `furniture_def` holding a trellis a
 * spot across, and holds the result to the browser's (`settleTrellises`).
 */
set local lock_timeout = '3s';
set check_function_bodies = off;

/** The block of spots a trellis facing `p_facing` takes: the row along that side of its tile, one deep (`furnitureFootprint`). */
create or replace function trellis_size(p_facing text) returns int[]
language sql stable as $fn$
  select case when p_facing in ('e', 'w') then array[1, subtiles()] else array[subtiles(), 1] end
$fn$;

/** A trellis taken up and handed back: to whoever set it down, a vine as a cutting, and told why; to the ground of its tile, rarity and all, if they have left the island. */
create or replace function trellis_return(p_world uuid, pl placed) returns void
language plpgsql as $fn$
declare v_dropped bigint;
begin
  delete from placed where id = pl.id;
  if pl.made_by is not null and exists (select 1 from player r where r.world_id = p_world and r.uid = pl.made_by) then
    perform give(p_world, pl.made_by, vine_kind(), 1, pl.ql, pl.material, pl.rare);
    if pl.vine_at is not null then perform give(p_world, pl.made_by, grape_cutting_item(), 1, pl.ql); end if;
    perform tell(p_world, pl.made_by, trellis_returned_said(pl.x, pl.y, pl.vine_at is not null), 'event');
  else
    v_dropped := drop_on_ground(p_world, pl.x, pl.y, vine_kind(), pl.ql, pl.material);
    update item set rare = pl.rare where id = v_dropped;
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
      -- Its own footprint, whatever the definitions say yet.
      sz := trellis_size(pl.facing);
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

reset check_function_bodies;

-- The trellis's footprint as the definitions write it (`FurnitureDef.vine`), for whatever reads it before they land.
update furniture_def set w = subtiles(), h = 1 where id = vine_kind();

/* Every island, one trellis to a row, again: by its own footprint this time. */
select trellis_settle(id) from world;

select private.lock_doors();
