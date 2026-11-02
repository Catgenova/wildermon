-- Reported: "Still cant travel under bridges", driving a wagon with Monolithumps and a Wagonox.
--
-- Wheels were asked about a bridge's deck on every tile it covers (`walk_share`, `deck_wheels`): a vehicle was held
-- short of any tile under a deck that does not carry it -- a rope bridge, one lane of deck under a wagon, any bridge
-- up a storey -- on the road under it as much as at its end. A deck is driven on from its end. So now:
--
--   * onto a bridge's end on the ground, any lane's, and from it onto its deck, only wheels its deck carries, as before
--     (`bridge_ground_end`); an end up a storey is over the wheels, and the ground floor under it is ground;
--   * under any other deck the wheels are on the ground, asked what any ground is asked: its slope and the step onto
--     it (`v_over`), as the browser's `driveRule` does (`deckWheels`).
--
-- supabase/test/underbridge.ts holds the two sides to each other.

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

-- The bridge with an end on this tile, any lane's, that lands on the ground, its deck down; null where none has. The
-- browser's `bridgeEndAt` with `bridgeEndLevel` nought.
create or replace function public.bridge_ground_end(p_world uuid, p_x integer, p_y integer) returns bigint
language sql stable as $fn$
  select b.id from bridge b
   cross join lateral bridge_lanes(b.width, b.side) l
   cross join lateral (select case when b.ay = b.by and b.ax <> b.bx then 0 else 1 end as px,
                              case when b.ay = b.by and b.ax <> b.bx then 1 else 0 end as py) p
   where b.world_id = p_world and b.kind <> 'aqueduct' and not b.raised
     and ((b.ax + l.o * p.px = p_x and b.ay + l.o * p.py = p_y and b.level = 0)
          or (b.bx + l.o * p.px = p_x and b.by + l.o * p.py = p_y and coalesce(b.level_b, b.level) = 0))
   limit 1
$fn$;

select pg_temp.patch_fn('public.walk_share(uuid, uuid, integer, double precision, double precision, double precision, double precision)'::regprocedure,
  'v_drop double precision;',
  'v_drop double precision;
        v_over bigint;');

select pg_temp.patch_fn('public.walk_share(uuid, uuid, integer, double precision, double precision, double precision, double precision)'::regprocedure,
  $o$      -- Onto a bridge's deck, a cart where carts cross and a wagon from `wagon_width` lanes (`deck_wheels`).
      if cart.id is not null and not afloat and spans and deck_at(p_world, tx, ty) is not null
         and not deck_wheels(p_world, deck_at(p_world, tx, ty), cart.sub) then
        return (i - 1)::double precision / n;
      end if;$o$,
  $n$      -- The deck over this tile that bears the body: none for wheels it does not carry, which go under it on the
      -- ground, lane to lane too (`deck_wheels`, the browser's `deckWheels`).
      v_over := case when spans then deck_at(p_world, tx, ty) end;
      if v_over is not null and cart.id is not null and not afloat and not deck_wheels(p_world, v_over, cart.sub) then
        -- From its end on the ground onto it: onto that deck all the same, and held.
        if bridge_ground_end(p_world, fx, fy) = v_over then return (i - 1)::double precision / n; end if;
        v_over := null;
      end if;
      -- Onto a bridge's end on the ground, any lane's, a cart where carts cross and a wagon from `wagon_width` lanes. An
      -- end up a storey is over the wheels (`bridge_ground_end`).
      if cart.id is not null and not afloat and spans and not deck_wheels(p_world, bridge_ground_end(p_world, tx, ty), cart.sub) then
        return (i - 1)::double precision / n;
      end if;$n$);

-- Its slope and the step onto it, asked of the ground wherever no deck bears the body (`v_over`).
select pg_temp.patch_fn('public.walk_share(uuid, uuid, integer, double precision, double precision, double precision, double precision)'::regprocedure,
  '(not spans or deck_at(p_world, tx, ty) is null)', 'v_over is null', 3);

select private.lock_doors();
