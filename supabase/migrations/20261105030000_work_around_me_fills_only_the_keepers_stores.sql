-- Work around me fills only its keeper's storage.
--
-- Reported: "diglett is running to Cats place like Digimon was". Meri's Diglett works around Meri (`around`), and its
-- storage in reach (`around_stores`) was any store Meri may put into: a bin nobody marked a store and nobody locked is
-- shut to no hand, so beside catgenova's settlement it filled catgenova's bins, and drew its makings from them, as
-- Meri's Oremander did at its post before 20261104220000. Now storage in reach is the keeper's to fill by the same
-- rule as a post's (`private.worker_crate_ok`, `private.worker_piece_ok`, `private.worker_may`): their own, their
-- settlement's, or a store their settlement keeps; and the cart or wagon they pull or drive and the boat they are
-- aboard, as before.

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

select pg_temp.patch_fn('public.around_stores(uuid,uuid,integer,integer,integer)'::regprocedure,
  $o$     and crate_put_shut(p_world, p_uid, k.cr) is null$o$,
  $n$     -- The keeper's to fill, as at a post (`worker_crate_ok`).
     and private.worker_crate_ok(p_world, p_uid, k.cr)$n$);

select pg_temp.patch_fn('public.around_stores(uuid,uuid,integer,integer,integer)'::regprocedure,
  $o$     and store_shut_piece(p_world, p_uid, b.p) is null$o$,
  $n$     and store_shut_piece(p_world, p_uid, b.p) is null
     -- The keeper's to fill, as at a post (`worker_piece_ok`); or what they pull, drive or are aboard.
     and ((b.p).puller = p_uid or (b.p).driver = p_uid or (b.p).id in (select ab.aboard from aboard ab)
          or private.worker_piece_ok(p_world, p_uid, b.p))$n$);

select private.lock_doors();
