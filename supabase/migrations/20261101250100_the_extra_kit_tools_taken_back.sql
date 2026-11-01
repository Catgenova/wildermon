-- The extra starting-kit tools taken back: one of each kept per player.
--
-- Asked, of the copies already given by putting one away and coming ashore again (before
-- 20261101250000_a_kit_tool_put_away_is_still_yours.sql): "Delete extras". For each player and each kit tool, the
-- issued copies held by them or issued to them (`origin_uid`), wherever they are; the one kept is the one they carry
-- if they carry one, else the least worn, then the best, then the first given. What is inside one moves up to where it
-- was (`inside` cascades). Each player who had extras is told how many. A copy that says nobody's (put away before
-- every row carried its origin) is left where it is.

set local lock_timeout = '3s';

create temp table kit_extra as
  select id, world_id, owner, inside from (
    select i.id, i.world_id, coalesce(i.holder_uid, i.origin_uid) as owner, i.inside,
           row_number() over (partition by i.world_id, coalesce(i.holder_uid, i.origin_uid), i.def
                              order by (i.holder = 'player' and i.holder_uid is not null) desc,
                                       i.dmg asc, i.ql desc, i.id asc) as n
      from item i
     where i.issued and coalesce(i.holder_uid, i.origin_uid) is not null
       and i.def in ('hatchet', 'shovel', 'pickaxe', 'carving_knife', 'chisel', 'mallet', 'trowel', 'saw',
                     'butchering_knife', 'rake', 'sickle', 'hammer', 'file', 'whetstone', 'awl', 'needle',
                     'rope_tool', 'brush', 'fishing_rod', 'fishing_net', 'quern', 'water_skin')) t
   where n > 1;

update item c set inside = x.inside from kit_extra x where c.inside = x.id;

select tell(t.world_id, t.owner, format('Starting kit: %s extra %s removed (one of each kept).', t.n,
            case when t.n = 1 then 'copy' else 'copies' end), 'system')
  from (select world_id, owner, count(*) as n from kit_extra group by world_id, owner) t
 where exists (select 1 from player p where p.world_id = t.world_id and p.uid = t.owner);

delete from item i using kit_extra x where i.id = x.id;
drop table kit_extra;

select private.lock_doors();
