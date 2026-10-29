-- A wall on the edge of a settlement is the settlement's: a hod carrier builds it.
--
-- Asked: "Bastiondrake is still not moving despite all materials being on my deed". Since a hod carrier fits only
-- work on its keeper's settlement (20261029020000, `on_my_deed`), work was tested by the tile its key names. A wall is
-- keyed by the line it stands on: 'v' at x is the line between tiles x - 1 and x, 'h' at y the line between y - 1 and
-- y (`borderOf`). So the east wall of a building's easternmost tile, on the settlement's last column, is keyed one
-- tile past its edge, and none of Solara Manor's east wall was anybody's work: three idle carriers, 'stock'.
--
-- Now a wall is the keeper's when either tile it stands between is on the keeper's settlement (`hod_work_mine`), in
-- `hod_needing`, `hod_wanted` and `hod_needing_stocked`. The browser's `Game.workOnDeed` the same.

set local lock_timeout = '3s';

create or replace function hod_work_mine(p_world uuid, p_uid uuid, p_dir text, p_x integer, p_y integer)
 returns boolean
 language sql
 stable
as $function$
  select on_my_deed(p_world, p_uid, p_x, p_y)
      or (p_dir = 'v' and on_my_deed(p_world, p_uid, p_x - 1, p_y))
      or (p_dir = 'h' and on_my_deed(p_world, p_uid, p_x, p_y - 1))
$function$;

do $do$
declare r record; v text; v_n int;
begin
  for r in select * from (values
    ('hod_needing', $o$(p_keeper is null or on_my_deed(p_world, p_keeper, w.x, w.y))$o$,
                    $n$(p_keeper is null or hod_work_mine(p_world, p_keeper, w.dir, w.x, w.y))$n$),
    ('hod_wanted', $o$(p_keeper is null or on_my_deed(p_world, p_keeper, w.x, w.y))$o$,
                   $n$(p_keeper is null or hod_work_mine(p_world, p_keeper, w.dir, w.x, w.y))$n$),
    ('hod_needing_stocked', $o$and on_my_deed(p_world, p_uid, w.x, w.y)$o$,
                            $n$and hod_work_mine(p_world, p_uid, w.dir, w.x, w.y)$n$)
  ) as t(fn, old, new) loop
    select pg_get_functiondef(p.oid) into v from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    v_n := (length(v) - length(replace(v, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of the line to change, not 1', r.fn, v_n; end if;
    execute replace(v, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
