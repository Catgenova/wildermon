-- A post's wildermon goes into an empty wildermon crate in your pack first, as the browser's `leavePost` has it.
--
-- Asked for: "Removing a workpost needs to put the wildermon into crate > follow > settlement > wild in that order. Last
-- night I lost 2 chiplings on an island 2000 tiles from my settlement." Pulled up, rotted away or called off
-- (`post_release`), a post let its worker follow you when nothing did, from where the post stood: a follower left
-- 2000 tiles from you; and back to work at your settlement whether or not it had room, which put Solara at 7 workers
-- of 5. Now: into the first empty wildermon crate in your pack; else to follow you, set down beside you; else back to
-- work at your settlement if it has a working slot free (`workers_on_deed` under `worker_cap`); else wild. Each said in
-- the browser's words, as kind `wildermon`.

set local lock_timeout = '3s';

create or replace function post_release(p_world uuid, p placed, p_why text) returns void
language plpgsql as $fn$
declare c creature; dd deed; v_crate bigint; pl player;
begin
  for c in select * from creature where world_id = p_world and post = p.id for update loop
    if c.keeper is null then
      update creature set post = null, mode = 'wild', phase = 'idle' where world_id = p_world and id = c.id;
      continue;
    end if;
    v_crate := empty_crate(p_world, c.keeper);
    if v_crate is not null then
      update creature set post = null, phase = 'idle', enemy = null, hunting = null where world_id = p_world and id = c.id;
      perform crate_shut_in(p_world, c.id, v_crate, null);
      perform wtell(p_world, c.keeper, 'Post ' || p_why || ': ' || c.name || ' into the wildermon crate in your pack.', 'system');
      continue;
    end if;
    select * into pl from player where world_id = p_world and uid = c.keeper;
    if companion_of(p_world, c.keeper) is null and pl.uid is not null then
      update creature set post = null, mode = 'active', phase = 'idle', enemy = null, hunting = null,
          from_x = pl.x, from_y = pl.y, to_x = pl.x, to_y = pl.y,
          leg_at = now(), leg_ends = now(), until = now(), settled_at = now()
        where world_id = p_world and id = c.id;
      perform wtell(p_world, c.keeper, 'Post ' || p_why || ': ' || c.name || ' returns to you.', 'system');
      continue;
    end if;
    select * into dd from my_deed(p_world, c.keeper) md where md.world_id is not null;
    if dd.world_id is not null and workers_on_deed(p_world, c.keeper) < worker_cap(p_world, c.keeper) then
      update creature set post = null, mode = 'deed', phase = 'idle', enemy = null, hunting = null,
          from_x = dd.x + 0.5, from_y = dd.y + 1.5, to_x = dd.x + 0.5, to_y = dd.y + 1.5,
          leg_at = now(), leg_ends = now(), until = now(), settled_at = now()
        where world_id = p_world and id = c.id;
      perform wtell(p_world, c.keeper, 'Post ' || p_why || ': ' || c.name || ' back to work at ' || dd.name || '.', 'system');
    else
      update creature set post = null, mode = 'wild', phase = 'idle' where world_id = p_world and id = c.id;
      perform wtell(p_world, c.keeper, 'Post ' || p_why || ': no empty wildermon crate, active slot taken, no settlement slot free. '
        || c.name || ' went wild.', 'error');
    end if;
  end loop;
end $fn$;

select private.lock_doors();
