-- A worker fills only its keeper's storage.
--
-- Reported: "Meri's oremander is bringing copper to my storage, fix". The live look: Meri's Oremander Digimon (606),
-- a deed worker of Meris Meadow with no post, sent its copper to catgenova's bulk bin (189, at 2586, 3017, by Solara):
-- `worker_store` took the nearest bin within its settlement's square, and Meris Meadow's square reaches over it. A
-- bin nobody marked a store, unlocked, is shut to no hand (`store_shut_piece` asks only the lock), and whose it was
-- was never asked. The same held beside a post ("Beside the post first") and on the tile a load is put down on
-- (`worker_put`).
--
-- A worker is its keeper's hands, so it fills what is its keeper's: a crate or piece its keeper may put into by hand
-- (`crate_put_shut`, `store_shut_piece`) that is a settlement store its keeper may use, or its keeper's own, or on a
-- settlement of its keeper's where they hold the stores right and made by nobody or by somebody of that settlement
-- (`worker_may`). Not somebody else's under the square of a settlement of yours: squares reach over each other. At home, beside a post, and on the tile it unloads on. The
-- browser's `storeFor` (src/game/creatures.ts) by the same rule (`workerMay`).

set local lock_timeout = '3s';

create or replace function pg_temp.patch_fn(p_sig regprocedure, p_old text, p_new text, p_times int default 1) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_times then
    raise exception '%: % of "%", wanted %', p_sig, v_n, left(p_old, 120), p_times;
  end if;
  execute replace(v_def, p_old, p_new);
end $p$;

/*
 * Whether a worker may fill a store for its keeper, once its keeper may put into it by hand (`crate_put_shut`,
 * `store_shut_piece`): a settlement store its keeper may use, or its keeper's own, or on a settlement of its keeper's
 * where they hold the stores right and made by nobody or by somebody of that settlement. Somebody else's storage
 * under the square of a settlement of yours is still theirs: settlements' squares can reach over each other's ground.
 */
create or replace function private.worker_may(p_world uuid, p_uid uuid, p_made_by uuid, p_store_of uuid, p_x integer, p_y integer)
returns boolean language sql stable as $f$
  select (store_kept(p_world, p_store_of, p_x, p_y)).founded_by is not null
      or coalesce(p_made_by = p_uid, false)
      or (deed_may_at(p_world, p_uid, p_x, p_y, power_bit('stores'))
          and exists (select 1 from deed d
                       where d.world_id = p_world and deed_covers(d, p_x, p_y)
                         and (d.founded_by = p_uid or exists (select 1 from deed_member m where m.world_id = p_world
                                                                and m.founder = d.founded_by and m.uid = p_uid))
                         and (p_made_by is null or p_made_by = d.founded_by
                              or exists (select 1 from deed_member m where m.world_id = p_world
                                           and m.founder = d.founded_by and m.uid = p_made_by))))
$f$;
revoke execute on function private.worker_may(uuid, uuid, uuid, uuid, integer, integer) from public;

create or replace function private.worker_crate_ok(p_world uuid, p_uid uuid, c crate) returns boolean
language sql stable as $f$
  select p_uid is null
      or (crate_put_shut(p_world, p_uid, c) is null and private.worker_may(p_world, p_uid, c.made_by, c.store_of, c.x, c.y))
$f$;
revoke execute on function private.worker_crate_ok(uuid, uuid, crate) from public;

create or replace function private.worker_piece_ok(p_world uuid, p_uid uuid, p placed) returns boolean
language sql stable as $f$
  select p_uid is null
      or (store_shut_piece(p_world, p_uid, p) is null and private.worker_may(p_world, p_uid, p.made_by, p.store_of, p.x, p.y))
$f$;
revoke execute on function private.worker_piece_ok(uuid, uuid, placed) from public;

-- Beside the post: the keeper's, and nobody else's.
select pg_temp.patch_fn('public.worker_store(uuid,creature,text,integer)'::regprocedure,
  $o$      where abs((k.cr).x + 0.5 - v_site.x) <= v_site.radius and abs((k.cr).y + 0.5 - v_site.y) <= v_site.radius
        and crate_units(p_world, (k.cr).id) + p_count <= crate_capacity(k.cr)$o$,
  $n$      where abs((k.cr).x + 0.5 - v_site.x) <= v_site.radius and abs((k.cr).y + 0.5 - v_site.y) <= v_site.radius
        and crate_units(p_world, (k.cr).id) + p_count <= crate_capacity(k.cr)
        -- Only its keeper's (`worker_crate_ok`).
        and private.worker_crate_ok(p_world, c.keeper, k.cr)$n$);
select pg_temp.patch_fn('public.worker_store(uuid,creature,text,integer)'::regprocedure,
  $o$      where abs((b.p).x + 0.5 - v_site.x) <= v_site.radius and abs((b.p).y + 0.5 - v_site.y) <= v_site.radius
        and furniture_holds(b.p) and furniture_refuses(b.p, p_def) is null$o$,
  $n$      where abs((b.p).x + 0.5 - v_site.x) <= v_site.radius and abs((b.p).y + 0.5 - v_site.y) <= v_site.radius
        and furniture_holds(b.p) and furniture_refuses(b.p, p_def) is null
        -- Only its keeper's (`worker_piece_ok`).
        and private.worker_piece_ok(p_world, c.keeper, b.p)$n$);

-- At home: the same.
select pg_temp.patch_fn('public.worker_store(uuid,creature,text,integer)'::regprocedure,
  $o$    where abs((k.cr).x - v_d.x) <= v_d.radius and abs((k.cr).y - v_d.y) <= v_d.radius
      and crate_units(p_world, (k.cr).id) + p_count <= crate_capacity(k.cr)$o$,
  $n$    where abs((k.cr).x - v_d.x) <= v_d.radius and abs((k.cr).y - v_d.y) <= v_d.radius
      and crate_units(p_world, (k.cr).id) + p_count <= crate_capacity(k.cr)
      and private.worker_crate_ok(p_world, c.keeper, k.cr)$n$);
select pg_temp.patch_fn('public.worker_store(uuid,creature,text,integer)'::regprocedure,
  $o$    where abs((b.p).x - v_d.x) <= v_d.radius and abs((b.p).y - v_d.y) <= v_d.radius
      and furniture_holds(b.p) and furniture_refuses(b.p, p_def) is null$o$,
  $n$    where abs((b.p).x - v_d.x) <= v_d.radius and abs((b.p).y - v_d.y) <= v_d.radius
      and furniture_holds(b.p) and furniture_refuses(b.p, p_def) is null
      and private.worker_piece_ok(p_world, c.keeper, b.p)$n$);

-- And on the tile a load is put down on.
select pg_temp.patch_fn('public.worker_put(uuid,creature,text,integer,double precision,integer,integer,text,text)'::regprocedure,
  $o$       and crate_units(p_world, cr.id) + p_count <= crate_capacity(cr)$o$,
  $n$       and crate_units(p_world, cr.id) + p_count <= crate_capacity(cr)
       and private.worker_crate_ok(p_world, c.keeper, cr)$n$);
select pg_temp.patch_fn('public.worker_put(uuid,creature,text,integer,double precision,integer,integer,text,text)'::regprocedure,
  $o$       and furniture_holds(p) and furniture_refuses(p, p_def) is null and p_count <= furniture_room(p, p_def)$o$,
  $n$       and furniture_holds(p) and furniture_refuses(p, p_def) is null and p_count <= furniture_room(p, p_def)
       and private.worker_piece_ok(p_world, c.keeper, p)$n$);

select private.lock_doors();
