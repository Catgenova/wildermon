-- A worker climbs a staircase of flights in a line to any storey of it, and comes back down.
--
-- Reported, with a screenshot of two Bastiondrakes idle on the ground beside a marble staircase: "bastiondrakes cant
-- go to storey 4 despite stairs right next to them?". The manor's staircase climbs in a line (2580, 3024 up to storey
-- 2, 2580, 3025 on up to storey 3, and on), each flight's head the foot of the next. A beast's way (`creature_way`)
-- stepped off a flight only at its head or its foot, never over its rails:
--
--   * up: off a flight's head is onto the next flight, so it went on up every flight to the top storey and never onto
--     a storey between. Work on storey 4 with a flight on up to storey 5 had no way to it: `stairs`, storey 4, while
--     `storey_reached` counted a finished flight on every storey under it and kept giving the hod carrier that work;
--   * down: off a flight's foot was onto a floor only, never onto the head of the flight under it, so from the top
--     storey there was no way down at all: `stranded`.
--
-- Now, as a body walks it (`Game.step`: off a flight's sides as well as its ends):
--
--   * a flight whose head is the foot of the next flight up, the two climbed the same way, has a landing at its head:
--     a beast steps off it there to either side, onto the storey between the two, and onto it from either side;
--   * off a flight's foot onto the head of a flight under it, climbed the same way, is on down that flight.
--
-- Nothing else about a flight changes: no other is stepped off or onto over its rails.

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

-- The head tile of a flight and whether the next flight up stands on it, climbed the same way (`lk`, and inline).
select pg_temp.patch_fn('public.creature_way(uuid,int,int,int,int,int,int)'::regprocedure,
  $o$r record; fx int; fy int; blk boolean; ok boolean;$o$,
  $n$r record; fx int; fy int; blk boolean; ok boolean; hx int; hy int; hk int; lk boolean;$n$);

select pg_temp.patch_fn('public.creature_way(uuid,int,int,int,int,int,int)'::regprocedure,
  $o$    l := (k - 1) / wh; x := bx0 + (k - 1) % w; y := by0 + ((k - 1) / w) % h;
$o$,
  $n$    l := (k - 1) / wh; x := bx0 + (k - 1) % w; y := by0 + ((k - 1) / w) % h;
    -- On a flight whose head is the foot of the next flight up, the two climbed the same way: a landing at its head.
    lk := false;
    if st[k] = 2 and l + 1 <= top then
      hx := x + dxs[op[ft[k]]]; hy := y + dys[op[ft[k]]];
      if hx between bx0 and bx1 and hy between by0 and by1 then
        hk := ((l + 1) * h + (hy - by0)) * w + (hx - bx0) + 1;
        lk := st[hk] = 2 and ft[hk] = ft[k];
      end if;
    end if;
$n$);

select pg_temp.patch_fn('public.creature_way(uuid,int,int,int,int,int,int)'::regprocedure,
  $o$        elsif st[kn - wh] in (1, 3) and par[kn - wh] = 0 then$o$,
  $n$        -- Or onto the head of the flight under it, climbed the same way: on down that one.
        elsif (st[kn - wh] in (1, 3) or (st[kn - wh] = 2 and ft[kn - wh] = d)) and par[kn - wh] = 0 then$n$);

select pg_temp.patch_fn('public.creature_way(uuid,int,int,int,int,int,int)'::regprocedure,
  $o$      -- Its rails: off a flight only at its head or its foot.
      continue when st[k] = 2 and d <> op[ft[k]];$o$,
  $n$      -- Its rails: off a flight only at its head or its foot, and at a landing (above) off its sides too.
      continue when st[k] = 2 and d <> op[ft[k]] and not lk;$n$);

select pg_temp.patch_fn('public.creature_way(uuid,int,int,int,int,int,int)'::regprocedure,
  $o$        -- Onto the head of a flight up to this storey, from the storey's side: on its way down.
        if ft[kn] = d and par[kn] = 0 then$o$,
  $n$        -- Onto the head of a flight up to this storey, from the storey's side: on its way down. Onto a landing (above)
        -- from either side too.
        hx := nx + dxs[op[ft[kn]]]; hy := ny + dys[op[ft[kn]]];
        hk := ((l + 1) * h + (hy - by0)) * w + (hx - bx0) + 1;
        if par[kn] = 0 and (ft[kn] = d
            or (d <> op[ft[kn]] and l + 1 <= top and hx between bx0 and bx1 and hy between by0 and by1
                and st[hk] = 2 and ft[hk] = ft[kn])) then$n$);

select private.lock_doors();
