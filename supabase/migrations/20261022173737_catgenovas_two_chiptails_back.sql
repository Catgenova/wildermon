-- Catgenova's two chiptails, back into wildermon crates in their pack.
--
-- Reported: "have a player that lost 2 chiptails". Chiptail 5048: its post pulled up before `post_release`, left a
-- settlement worker 1531 tiles from Solara with nothing in reach, idle. Chiptail 5440: its post rotted at 12:59 and it
-- went home to Solara, 2080 tiles from catgenova. Each into a fresh wildermon crate in catgenova's pack, where their
-- other two chiptails are. Matched by id, kind, keeper and mode, so it does nothing anywhere else.

set local lock_timeout = '3s';

do $do$
declare v_world uuid; v_id int; v_keeper uuid; v_name text; v_crate bigint; v_n int := 0;
begin
  for v_world, v_id, v_keeper, v_name in
    select cr.world_id, cr.id, cr.keeper, cr.name from creature cr join player p on p.world_id = cr.world_id and p.uid = cr.keeper
     where cr.id in (5048, 5440) and cr.species = 'quarra' and cr.mode = 'deed' and cr.post is null
       and p.name = 'catgenova'
     for update of cr
  loop
    insert into item (world_id, holder, holder_uid, def, ql, count)
      values (v_world, 'player', v_keeper, 'creature_crate', 20, 1)
      returning id into v_crate;
    perform crate_shut_in(v_world, v_id, v_crate, null);
    perform tell(v_world, v_keeper, v_name || ': into a wildermon crate in your pack.', 'system');
    v_n := v_n + 1;
  end loop;
  raise notice 'chiptails crated: %', v_n;
end $do$;

select private.lock_doors();
