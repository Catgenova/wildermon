-- Catgenova's two chiptails, into wildermon crates in their pack, and grown.
--
-- Asked: "Last night I lost 2 chiplings on an island 2000 tiles from my settlement. Return them to my crates and age
-- them to Grown." Chiptails 5048 and 5440: their post pulled up at 03:07, each went back to work at Solara, 2000 tiles
-- from catgenova; 5048 young from an ancient comb at 01:45. Each into the first empty wildermon crate in catgenova's
-- pack (a fresh one if none), and either one young made grown, as one only just grown. Matched by id, kind, keeper and
-- mode, so it does nothing anywhere else.

set local lock_timeout = '3s';

do $do$
declare v_world uuid; v_id int; v_keeper uuid; v_name text; v_crate bigint; v_n int := 0; c creature;
begin
  for v_world, v_id, v_keeper, v_name in
    select cr.world_id, cr.id, cr.keeper, cr.name from creature cr join player p on p.world_id = cr.world_id and p.uid = cr.keeper
     where cr.id in (5048, 5440) and cr.species = 'quarra' and cr.mode = 'deed' and cr.post is null
       and p.name = 'catgenova'
     for update of cr
  loop
    select * into c from creature where world_id = v_world and id = v_id;
    if age_of(c.born, old_of(c), age_pace(c)) = 'young' then
      update creature set born = now() - make_interval(secs => young_for() / age_pace(c) + 60)
        where world_id = v_world and id = v_id;
    end if;
    v_crate := empty_crate(v_world, v_keeper);
    if v_crate is null then
      insert into item (world_id, holder, holder_uid, def, ql, count)
        values (v_world, 'player', v_keeper, 'creature_crate', 20, 1)
        returning id into v_crate;
    end if;
    perform crate_shut_in(v_world, v_id, v_crate, null);
    perform wtell(v_world, v_keeper, v_name || ': into a wildermon crate in your pack, grown.', 'system');
    v_n := v_n + 1;
  end loop;
  raise notice 'chiptails crated: %', v_n;
end $do$;

select private.lock_doors();
