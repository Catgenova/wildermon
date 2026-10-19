-- A ramp bridge, rising at most 15 a tile: "Is it possible to plan a bridge stretching up from 1st to 3rd floor?"
--
-- A bridge's two ends were held within `end_slop` of each other in height and to one storey, so a deck went from a
-- storey to the same storey and nowhere else. Past `end_slop` a deck is now a ramp: it rises evenly from one end to
-- the other (`ramp_deck`), from the edge of one end's tile to the edge of the other's, so long as it rises no more than
-- `ramp_slope` for every tile of deck between them. Its ends may be on two storeys, or on the ground and a storey, or
-- on two banks; a drawbridge, whose deck stands on end over its hinge, is still carried level. The deck is walked at
-- the storey of the end it was stepped onto from, and stepped off at the storey of the end it is stepped off onto
-- (`frame_stands`); a body on it stands at the deck's height there (`deck_height_at`). A span costs what it did.
--
-- And a bridge set out on the island now keeps what its ends land on, which it never had: its height off the floors
-- its ends are on (`deck_height`) rather than off the ground under them, and its storey. The browser's
-- `bridgeReason`, `rampRefusal`, `deckHeight` and `setOutWords` say all of it, word for word.

-- The most a deck rises over one tile of its length, which the definitions that come in after this carry as well.
create or replace function ramp_slope() returns double precision language sql immutable as $fn$ select 15::double precision $fn$;

-- The storey a ramp's far end lands on, where it is not its near end's, and how much higher its deck is there.
set local lock_timeout = '3s';
alter table bridge add column if not exists level_b integer, add column if not exists rise integer not null default 0;

-- The rise of a deck between ends at these heights: nought within `end_slop`, where it is carried level (`rampRise`).
-- Rounded half up, as the browser's `Math.round` is, a falling one too.
create or replace function ramp_rise(p_ha double precision, p_hb double precision) returns integer
language sql immutable as $fn$
  select case when abs(p_hb - p_ha) > end_slop() then floor(p_hb - p_ha + 0.5)::int else 0 end
$fn$;

-- The height of a deck `p_s` tiles along it from the edge of its near end's tile, of `p_n` tiles carried at `p_height`
-- in its middle and rising `p_rise` from its near end's edge to its far end's (`rampDeck`).
create or replace function ramp_deck(p_height double precision, p_rise double precision, p_n integer, p_s double precision)
returns double precision language sql immutable as $fn$
  select case when p_rise = 0 then p_height
              else p_height + p_rise * (least(1, greatest(0, p_s / p_n)) - 0.5) end
$fn$;

-- Why a ramp may not climb from one end to the other over so few tiles (`rampRefusal`).
create or replace function ramp_refusal(p_la integer, p_lb integer, p_apart double precision, p_n integer) returns text
language sql immutable as $fn$
  select case when p_la <> p_lb
              then 'One end is on ' || case when p_la = 0 then 'the ground' else 'storey ' || (p_la + 1) end
                || ' and the other on ' || case when p_lb = 0 then 'the ground' else 'storey ' || (p_lb + 1) end || ','
              else 'The two ends are' end
      || ' ' || to_char(p_apart, 'FM990') || ' apart in height. A deck rises at most ' || ramp_slope()::int
      || ' a tile, so that wants ' || ceil(p_apart / ramp_slope())::int || ' tiles of deck; this one has ' || p_n || '.'
$fn$;

-- Where a bridge set out goes, as it is said when it is (`setOutWords`).
create or replace function bridge_set_out(p_la integer, p_lb integer, p_rise integer) returns text
language sql immutable as $fn$
  select case when p_la <> 0 or coalesce(p_lb, p_la) <> 0
              then ', ' || case when p_la = 0 then 'the ground' else 'storey ' || (p_la + 1) end
                || ' to ' || case when coalesce(p_lb, p_la) = 0 then 'the ground' else 'storey ' || (coalesce(p_lb, p_la) + 1) end
              else '' end
      || case when p_rise <> 0
              then ', its deck ' || case when p_rise > 0 then 'rising' else 'falling' end || ' ' || abs(p_rise)
                || ' from this end to the far one'
              else '' end
$fn$;

-- The height of finished deck at a point, up a ramp's slope, or null for open ground (`deckHeightAt`): where a body
-- walking it stands. Over its spans, not its ends, which are the ground or the floor they land on. An aqueduct's deck
-- is water and a drawbridge drawn up has none (`deck_at`).
create or replace function deck_height_at(p_world uuid, p_x double precision, p_y double precision) returns double precision
language sql stable as $fn$
  select ramp_deck(b.height, b.rise,
                   (select count(*)::int from bridge_span s where s.world_id = b.world_id and s.bridge = b.id),
                   case when b.ay = b.by then case when b.bx > b.ax then p_x - (b.ax + 1) else b.ax - p_x end
                        else case when b.by > b.ay then p_y - (b.ay + 1) else b.ay - p_y end end)
    from bridge b
   where b.world_id = p_world and b.id = deck_at(p_world, floor(p_x)::int, floor(p_y)::int)
     and exists (select 1 from bridge_span s where s.world_id = b.world_id and s.bridge = b.id
                   and s.x = floor(p_x)::int and s.y = floor(p_y)::int)
     and not exists (select 1 from bridge_span s where s.world_id = b.world_id and s.bridge = b.id and not span_done(s.needed))
$fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- Past `end_slop` a deck is a ramp, at `ramp_slope` a tile at most, its ends on any storeys; a drawbridge is level.
    (1, 'bridge_reason',
     $$        la int; lb int;$$,
     $$        la int; lb int; v_rise int;$$, 1),
    (2, 'bridge_reason',
     $$  if la <> lb then
    return 'One end is on ' || case when la = 0 then 'the ground' else 'storey ' || (la + 1) end
        || ' and the other on ' || case when lb = 0 then 'the ground' else 'storey ' || (lb + 1) end
        || '. A deck meets one storey or the other.';
  end if;
  ha := deck_height(p_world, p_ax, p_ay);
  hb := deck_height(p_world, p_bx, p_by);
  if abs(ha - hb) > end_slop() then
    return 'The two ends are ' || to_char(abs(ha - hb), 'FM990')
      || ' apart in height. One deck will not meet both; level one of them.';
  end if;
  h := round((ha + hb) / 2);$$,
     $$  ha := deck_height(p_world, p_ax, p_ay);
  hb := deck_height(p_world, p_bx, p_by);
  -- Past `end_slop` a deck is a ramp, from one storey to another or from bank to bank, at `ramp_slope` a tile at most.
  if abs(ha - hb) > end_slop() and d.grounded then
    return 'The two ends are ' || to_char(abs(ha - hb), 'FM990')
      || ' apart in height. One deck will not meet both; level one of them.';
  end if;
  if abs(ha - hb) > end_slop() and abs(ha - hb) > ramp_slope() * n then
    return ramp_refusal(la, lb, abs(ha - hb), n);
  end if;
  h := round((ha + hb) / 2);
  v_rise := ramp_rise(ha, hb);$$, 1),
    -- At the deck's height over the middle of each tile, up a ramp's slope.
    (3, 'bridge_reason',
     $$    if h - surface_height(p_world, r.x, r.y) < clearance() then$$,
     $$    if ramp_deck(h, v_rise, n, r.n - 0.5) - surface_height(p_world, r.x, r.y) < clearance() then$$, 1),
    -- Set out off what its ends land on, storeys and all, as the browser's `topDeck` has it, and a ramp's rise.
    (4, 'perform_last',
     $$    v_h := round((centre_height(p_world, floor(p.x)::int, floor(p.y)::int)
                + centre_height(p_world, (p_target->>'x')::int, (p_target->>'y')::int)) / 2);
    insert into bridge (world_id, kind, ax, ay, bx, by, height, material, made_by)
    values (p_world, v_kind, floor(p.x)::int, floor(p.y)::int,
            (p_target->>'x')::int, (p_target->>'y')::int, v_h,
            case when v_kind = 'stone' then null else 'Oak' end, p_uid)
    returning id into v_id;$$,
     $$    v_h := round((deck_height(p_world, floor(p.x)::int, floor(p.y)::int)
                + deck_height(p_world, (p_target->>'x')::int, (p_target->>'y')::int)) / 2);
    insert into bridge (world_id, kind, ax, ay, bx, by, height, material, made_by, level, level_b, rise)
    values (p_world, v_kind, floor(p.x)::int, floor(p.y)::int,
            (p_target->>'x')::int, (p_target->>'y')::int, v_h,
            case when v_kind = 'stone' then null else 'Oak' end, p_uid,
            top_deck(p_world, floor(p.x)::int, floor(p.y)::int),
            nullif(top_deck(p_world, (p_target->>'x')::int, (p_target->>'y')::int),
                   top_deck(p_world, floor(p.x)::int, floor(p.y)::int)),
            ramp_rise(deck_height(p_world, floor(p.x)::int, floor(p.y)::int),
                      deck_height(p_world, (p_target->>'x')::int, (p_target->>'y')::int)))
    returning * into b;
    v_id := b.id;$$, 1),
    (5, 'perform_last',
     $$|| case when v_n > 1 then 's' else '' end || ' across. Each one wants '$$,
     $$|| case when v_n > 1 then 's' else '' end || ' across' || bridge_set_out(b.level, b.level_b, b.rise) || '. Each one wants '$$, 1),
    -- A ramp's deck is walked at the storey of either of its ends.
    (6, 'frame_stands',
     $$where b.world_id = p_world and b.level = p_level$$,
     $$where b.world_id = p_world and p_level in (b.level, coalesce(b.level_b, b.level))$$, 1),
    -- And the browser hears of both.
    (7, 'rpc_ground',
     $$'height', b.height, 'level', b.level, 'material', b.material,$$,
     $$'height', b.height, 'level', b.level, 'levelB', b.level_b, 'rise', b.rise, 'material', b.material,$$, 1)
  ) as t(ord, fn, old, new, n) order by ord loop
    -- The one of that name that holds the change: `bridge_reason` has a short form without a body to ask about.
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn and strpos(pg_get_functiondef(p.oid), r.old) > 0;
    if v_def is null then raise exception '% has no change %', r.fn, r.ord; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.n then raise exception '% has % of change %, not %', r.fn, v_n, r.ord, r.n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
