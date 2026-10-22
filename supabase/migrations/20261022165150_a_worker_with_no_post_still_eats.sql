-- A worker with no post still eats.
--
-- The work post's meal (20261022154231) read its post into a record only when it had one, and then asked that record
-- whether it had a post: on a settlement worker, which has none, the record was never filled and the question was an
-- error, so every settlement worker's meal stopped the round. Kept in plain variables, which start out empty.

set local lock_timeout = '3s';

create or replace function worker_feed(p_world uuid, p_id integer, p_care double precision default null)
returns text language plpgsql as $fn$
declare c creature; v_deed deed; v_it item; v_px int; v_py int; v_pr int; v_post bigint;
begin
  select * into c from creature where world_id = p_world and id = p_id;
  if not found or c.mode = 'wild' then return null; end if;
  if c.post is not null then
    select ws.x, ws.y, ws.radius, ws.post into v_px, v_py, v_pr, v_post from work_site(p_world, c) ws where ws.post is not null;
  end if;
  if v_post is null then
    select * into v_deed from deed_covering(p_world, floor(creature_x(c))::int, floor(creature_y(c))::int) limit 1;
    if v_deed.world_id is null then return null; end if;
  end if;
  /*
   * Any container: what holds things and is not the trash crate. Not a locked thing, a thing with a price on it, or a
   * letter or parcel under a deal, whatever it is in.
   */
  select i.* into v_it
    from (
      select i.*
        from crate k
        join item i on i.world_id = k.world_id and i.holder = 'crate' and i.crate = k.id
       where k.world_id = p_world
         and case when v_post is not null
                  then abs(k.x - v_px) <= v_pr and abs(k.y - v_py) <= v_pr and k.made_by = c.keeper
                  else deed_covers(v_deed, k.x, k.y) end
      union all
      select i.*
        from placed p
        join furniture_def fd on fd.id = p.sub
        join item i on i.world_id = p.world_id and i.holder = 'furniture' and i.placed = p.id
       where p.world_id = p_world and p.kind = 'furniture'
         and coalesce(fd.capacity, 0) > 0 and coalesce(fd.trash, 0) = 0
         and case when v_post is not null
                  then abs(p.x - v_px) <= v_pr and abs(p.y - v_py) <= v_pr and p.made_by = c.keeper
                  else deed_covers(v_deed, p.x, p.y) end) i
   where not i.locked and i.price is null and i.letter is null and i.deal is null
     and exists (select 1 from species_diet sd where sd.species = c.species and sd.item = i.def)
   order by i.ql, i.id
   limit 1;
  if v_it.id is null then return null; end if;
  if v_it.count > 1 then update item set count = count - 1 where id = v_it.id;
  else delete from item where id = v_it.id; end if;
  update creature set hunger = least(1, hunger + graze_fill())
    where world_id = p_world and id = p_id;
  -- And what it is worth to its learning and its care, by its quality (`beast_fed`).
  perform beast_fed(p_world, p_id, v_it.def, v_it.ql, p_care);
  return v_it.def;
end $fn$;

select private.lock_doors();
