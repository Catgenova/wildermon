-- Garden steps are driven: a cart or a wagon takes a flight as a walker or a mount does.
--
-- Asked: "Steps should be traverseable by wagon and carts and mounts". `walk_share` refused wheels onto a tile of
-- steps (the browser's `Game.driveRule` the same); that refusal is gone, so wheels are held to a flight as a body is:
-- the tile stepped onto standable at the flight's cap (`stand_cap`), and no step between centres on or off it.
-- Mounts were never refused one.
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

select pg_temp.patch_fn('public.walk_share(uuid,uuid,integer,double precision,double precision,double precision,double precision)'::regprocedure,
$o$      -- A flight of garden steps is climbed, not driven: no wheel takes one.
      if cart.id is not null and not afloat and there_tile = steps_tile() then
        return (i - 1)::double precision / n;
      end if;
$o$, '');

select private.lock_doors();
