-- The starting kit, now, for every player holding no piece of it, and for Soda.
--
-- Asked: "Add those tools to soda. And any new players who had none". `kit_topup` gives a player any kit tool they
-- hold no issued copy of; it runs on coming ashore and on waking after a death (20261031180000). This runs it once,
-- here, for each player who holds no issued item at all (a kit lost to a grave before issued gear stayed on the
-- body), and for any player named Soda, and tells each one given anything.

set local lock_timeout = '3s';

do $do$
declare r record; v_n int;
begin
  for r in
    select p.world_id, p.uid from player p
     where lower(p.name) = 'soda'
        or not exists (select 1 from item i where i.world_id = p.world_id and i.holder_uid = p.uid and i.issued)
  loop
    v_n := kit_topup(r.world_id, r.uid);
    if v_n > 0 then
      perform tell(r.world_id, r.uid, 'Starting kit: missing tools given.', 'system');
    end if;
  end loop;
end $do$;
