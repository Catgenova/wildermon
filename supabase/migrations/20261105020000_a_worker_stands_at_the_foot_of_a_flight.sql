-- A worker stands at the foot of a flight a storey up, where the flight below comes off.
--
-- Reported: "Find out why my bastiondrakes cant go up my stairs now". In Solara Manor a staircase climbs north two
-- storeys in a line: a flight up to storey 2 at 2580, 3024, and the flight on up to storey 3 on the next tile, 2580,
-- 3025, where the first comes off. A wall planned on storey 2 on the north side of 2580, 3025 is fitted standing on
-- that tile (`hod_stand`), at the foot of the second flight. The way there (`creature_way`) stepped off the first
-- flight onto the second and up it every time, and never stopped on the tile itself: no way, so both Bastiondrakes
-- stood with `stairs`, storey 2, while 60 other pieces in reach waited behind that one wall.
--
-- Now a step onto the foot of a flight going up from a storey, where that tile on that storey is where the way is
-- going, stops there. The way on up is as it was.

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

select pg_temp.patch_fn('public.creature_way(uuid,int,int,int,int,int,int)'::regprocedure,
  $o$      if l + 1 <= top and st[kn + wh] in (2, 4) then
        -- Onto a flight going up from this storey, from its foot: up it. A ladder: no.$o$,
  $n$      if l + 1 <= top and st[kn + wh] = 2 and ft[kn + wh] = op[d] and goal[kn] and par[kn] = 0 then
        -- Where it is going: the foot of a flight up from this storey (a wall on that tile's side is fitted from
        -- there, `hod_stand`). It stops there rather than going on up.
        par[kn] := k; hit := kn; exit search;
      end if;
      if l + 1 <= top and st[kn + wh] in (2, 4) then
        -- Onto a flight going up from this storey, from its foot: up it. A ladder: no.$n$);

select private.lock_doors();
