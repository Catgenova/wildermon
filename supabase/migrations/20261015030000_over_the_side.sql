-- Off a hull into the water, and aboard her out of it.
--
-- Asked: "Allow disembarking from a ship into water, and embarking into a ship
-- from water". Leaving her asked for land within reach and refused without it,
-- at the helm and on her deck alike. Now, with land in reach you step ashore as
-- before, and with none you go over the side into the water where she is, to
-- swim; she stays where she is (`overTheSide`). Coming aboard already asks only
-- that you are beside her, wherever you are standing or swimming, which
-- `aboard.ts` now asks of somebody in the water.

-- Leaving a hull with no land in reach, in the browser's words (`overTheSide`).
create or replace function over_the_side(p placed) returns text
language sql stable as $fn$
  select 'You go over the side of the ' || lower(placed_name(p)) || ' into the water. She stays where she is.'
$fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    (1, 'ride_refusal', $$    if not exists (select 1 from player pl, lateral shore_near(p_world, pl.x, pl.y)
                   where pl.world_id = p_world and pl.uid = p_uid) then
      return 'There is no shore within reach. Wait until she comes in close.';
    end if;
$$, '', 1),
    (2, 'ride_refusal', $$    if is_boat(p) and not exists (select 1 from player pl, lateral shore_near(p_world, pl.x, pl.y)
                                  where pl.world_id = p_world and pl.uid = p_uid) then
      return 'There is no shore within reach. Bring her in first, or swim for it.';
    end if;
$$, $$    -- Ashore with land in reach, and over the side into the water without it: nothing to refuse.
    null;
$$, 1),
    (3, 'perform_ride', $$    if v_shore.x is null then return; end if;
    update player set aboard = null, seat = null, x = v_shore.x + 0.5, y = v_shore.y + 0.5, moved_at = now()$$,
                        $$    if v_shore.x is null then
      -- No land in reach: over the side into the water where she is, to swim.
      update player set aboard = null, seat = null, x = p.cx, y = p.cy, level = 0, moved_at = now()
        where world_id = p_world and uid = p_uid;
      perform tell(p_world, p_uid, over_the_side(p), 'event');
      return;
    end if;
    update player set aboard = null, seat = null, x = v_shore.x + 0.5, y = v_shore.y + 0.5, moved_at = now()$$, 1),
    (4, 'perform_ride', $$      perform tell(p_world, p_uid, 'You bring the ' || lower(placed_name(p))
        || ' alongside and step ashore.', 'event');$$,
                        $$      perform tell(p_world, p_uid, case when v_shore.x is null then over_the_side(p)
        else 'You bring the ' || lower(placed_name(p)) || ' alongside and step ashore.' end, 'event');$$, 1)
  ) as t(ord, fn, old, new, n) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.n then raise exception '% has % of change %, not %', r.fn, v_n, r.ord, r.n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
