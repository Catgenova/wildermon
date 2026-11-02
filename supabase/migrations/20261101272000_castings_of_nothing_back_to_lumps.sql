-- The castings a smelter worker put away without their piece, back to lumps of their metal.
--
-- Asked, of the castings `20261101271000_a_casting_keeps_its_piece_in_the_stores.sql` stops being made ("Casting
-- (bronze)", no piece, no anvil will take one): "Turn into lumps". Nothing kept which mould each was poured from, so
-- each becomes the lumps the smallest single mould takes (`mould_def.lumps`, one piece a filling), of its metal, at its
-- quality and damage, where it is. Each player who held some, or had them put away for them, is told how many.

set local lock_timeout = '3s';

create temp table pieceless as
  select i.id, i.world_id, coalesce(i.holder_uid, i.origin_uid) as owner, i.count, m.lump, m.name as metal,
         (select min(md.lumps) from mould_def md where coalesce(md.per, 1) = 1)::int as each
    from item i join metal_def m on lower(m.name) = lower(i.extra)
   where i.def = 'casting' and i.piece is null;

update item i set def = p.lump, count = i.count * p.each, extra = null
  from pieceless p where i.id = p.id;

select tell(t.world_id, t.owner, format('Castings with no piece: %s × %s casting now %s × %s lump.',
            t.n, lower(t.metal), t.n * t.each, lower(t.metal)), 'system')
  from (select world_id, owner, metal, each, sum(count)::int as n from pieceless where owner is not null
         group by world_id, owner, metal, each) t
 where exists (select 1 from player p where p.world_id = t.world_id and p.uid = t.owner);

drop table pieceless;

select private.lock_doors();
