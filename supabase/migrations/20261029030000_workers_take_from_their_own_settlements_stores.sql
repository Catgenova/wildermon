-- A worker takes from its own settlement's stores only, not every settlement its keeper is a citizen of.
--
-- Asked: "Bastiondrakes were travelling to Marcaronis house to eat". A worker's stores (`deed_store_items`, under
-- `store_holding`, `take_*_stored`, `hod_needing_stocked`, `stores_count` and the rest) were every store on every
-- settlement its keeper belongs to (`deeds_of`: the one founded, then each one joined). So a hod carrier short of
-- bricks at Solara walked to the nearest store holding them, on a settlement 110 tiles off its keeper was a citizen of,
-- and ate there. Its work, its bed and its puts are all its keeper's own settlement (`my_deed`, `work_site`); now so
-- are its takes. The browser's `deedStores` the same.

set local lock_timeout = '3s';

do $do$
declare v text; v_n int;
  v_old text := $o$    select d.x, d.y, d.radius from deeds_of(p_world, p_uid) d
$o$;
  v_new text := $n$    select d.x, d.y, d.radius from my_deed(p_world, p_uid) d where d.world_id is not null
$n$;
begin
  select pg_get_functiondef('deed_store_items'::regproc) into v;
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'deed_store_items has % of the line to change, not 1', v_n; end if;
  execute replace(v, v_old, v_new);
end $do$;

select private.lock_doors();
