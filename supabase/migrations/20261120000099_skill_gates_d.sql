-- Skill gates, the fourth set: the user's answers to the open questions.
--
--   * Stone brick walls at masonry 10, the trees spread so the ladder has no empty step from 1 to 90 (plum and quince
--     40, apple and pear 50, pomegranate 60, cedar 70, olive 80): rows of `skill_gate`, `npm run defs`.
--   * Casting a mould stays its own recipe's gate; pouring is gated by the metal poured (`skill_gate` kind 'metal', in
--     blacksmithing): a mined metal at its seam's mining gate, an alloy at the highest of the metals in it. Pour a mould
--     and Cast an anvil refuse in the one rule's words (`metal_gate_refusal`): "Iron pouring: needs blacksmithing 5;
--     have 2.3."; a nail or ribbon smith pours only the metals its own blacksmithing may (`worker_smith_lumps`), and
--     with only others in the stores is idle `gate`, naming the first.
--   * A bare vein (a Rock tile) is always named, to everybody, and still mining-gated by name; only a buried one (under
--     soil or water) is "Unidentified metal" over the reader's prospecting gate: in Prospect's lines, a prospector's
--     find and the tile's reading (`seen_vein_at`, `vein_tip_at`), on the wire (`mask_rock` leaves Rock tiles alone)
--     and in `tile_change`, which now carries the rock of a square that is bare rock (`rock`). An unidentified vein
--     says no level, which would name it: "More prospecting required to identify this vein."

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

/* ---- Pouring, by the metal --------------------------------------------------------------------------------------- */

-- Pouring a metal under its gate (`metalGateRefusal`): "Iron pouring: needs blacksmithing 5; have 2.3.", or null.
create or replace function metal_gate_refusal(p_world uuid, p_uid uuid, p_metal text) returns text
language sql stable as $$
  select skill_gate_refusal(g.name, g.skill, skill_of(p_world, p_uid, g.skill), g.level)
    from skill_gate g where g.kind = 'metal' and g.id = p_metal
$$;

-- Pour a mould: after the metal is chosen, before its lumps are counted, as the browser's `pour_mould` asks it.
select pg_temp.patch_fn('firing_refusal(uuid,uuid,text,jsonb)',
$o$    v_metal := metal_by_bar(v_it.def);
    if v_it.id is null or v_metal.id is null then return 'Need metal.'; end if;$o$,
$n$    v_metal := metal_by_bar(v_it.def);
    if v_it.id is null or v_metal.id is null then return 'Need metal.'; end if;
    -- Its metal's pouring gate (`craftgates.ts`).
    if metal_gate_refusal(p_world, p_uid, v_metal.id) is not null then return metal_gate_refusal(p_world, p_uid, v_metal.id); end if;$n$);
-- Cast an anvil, the same.
select pg_temp.patch_fn('firing_refusal(uuid,uuid,text,jsonb)',
$o$    v_metal := metal_by_bar(v_it.def);
    if not found or v_metal.id is null then return 'Choose the metal to pour.'; end if;$o$,
$n$    v_metal := metal_by_bar(v_it.def);
    if not found or v_metal.id is null then return 'Choose the metal to pour.'; end if;
    if metal_gate_refusal(p_world, p_uid, v_metal.id) is not null then return metal_gate_refusal(p_world, p_uid, v_metal.id); end if;$n$);

-- The lumps of a smithing trade a worker's own blacksmithing pours (`workerMetalOpen`), in the trade's order.
create or replace function worker_smith_lumps(c creature, p_kind text) returns text[]
language sql stable as $$
  select coalesce(array_agg(u.l order by u.o), '{}')
    from unnest(smith_lumps(p_kind)) with ordinality u(l, o)
   where worker_gate_open(c, skill_gate_of('metal', (select md.id from metal_def md where md.lump = u.l)))
$$;

select pg_temp.patch_fn('errand_step(uuid,integer,text)',
$o$      if not exists (select 1 from unnest(smith_lumps(kind)) l where stores_count(p_world, c.keeper, l) > 0) then
        why := 'stock'; why_n := null; return next; return;
      end if;$o$,
$n$      if not exists (select 1 from unnest(worker_smith_lumps(c, kind)) l where stores_count(p_world, c.keeper, l) > 0) then
        why := 'stock'; why_n := null;
        -- Only metals over its own blacksmithing in the stores: `gate`, naming the first.
        select array['metal', md.id] into why_what
          from unnest(smith_lumps(kind)) with ordinality u(l, o) join metal_def md on md.lump = u.l
         where stores_count(p_world, c.keeper, u.l) > 0 order by u.o limit 1;
        if why_what is not null then why := 'gate'; end if;
        return next; return;
      end if;$n$);
select pg_temp.patch_fn('errand_do(uuid,integer,boolean,text)',
  $o$unnest(smith_lumps(kind)) with ordinality u(l, o)$o$, $n$unnest(worker_smith_lumps(c, kind)) with ordinality u(l, o)$n$);

-- What it would pour out of the stores is in the stores, not tiles off.
select pg_temp.patch_fn('worker_idle(uuid,creature,text,integer,integer,integer,bigint)',
  $o$c.idle_what[1] in ('recipe', 'relic', 'bauble')$o$, $n$c.idle_what[1] in ('recipe', 'relic', 'bauble', 'metal')$n$);

/* ---- Veins: a bare one named, a buried one by prospecting ---------------------------------------------------------- */

-- Why a vein is "Unidentified metal" to somebody, with no level that would name it (`veinTip`), or null.
create or replace function vein_tip(p_world uuid, p_uid uuid, r rock_def) returns text
language sql stable as $$
  select 'More ' || lower(coalesce((select s.name from skill_def s where s.id = g.skill), g.skill))
         || ' required to identify this vein.'
    from skill_gate g where g.kind = 'vein' and g.id = r.yields and skill_of(p_world, p_uid, g.skill) < g.level
$$;

-- The same of the vein under a square: null where it is bare rock, which everybody names (`veinTip`, exposed).
create or replace function vein_tip_at(p_world uuid, p_uid uuid, p_x int, p_y int) returns text
language sql stable as $$
  select case when land_tile(p_world, p_x, p_y) = tile_id('Rock') then null
              else vein_tip(p_world, p_uid, bedrock_at(p_world, p_x, p_y)) end
$$;

-- The vein under a square as somebody sees it: bare, its name; buried, its name at its prospecting gate, else
-- "Unidentified metal" (`seenVein`).
create or replace function seen_vein_at(p_world uuid, p_uid uuid, p_x int, p_y int) returns text
language sql stable as $$
  select case when vein_tip_at(p_world, p_uid, p_x, p_y) is null then (bedrock_at(p_world, p_x, p_y)).name
              else 'Unidentified metal' end
$$;

-- Prospect: the tally by each square's exposure, and the reading where you stand.
select pg_temp.patch_fn('perform_ground(uuid,uuid,text,jsonb)',
  $o$seen_vein(p_world, p_uid, bedrock_at(p_world, x, y)) as nm$o$, $n$seen_vein_at(p_world, p_uid, x, y) as nm$n$);
select pg_temp.patch_fn('perform_ground(uuid,uuid,text,jsonb)',
$o$    if v_rock.seam and vein_tip(p_world, p_uid, v_rock) is not null then
      perform tell(p_world, p_uid, 'Here: ' || lower(seen_vein(p_world, p_uid, v_rock)) || '. '
        || vein_tip(p_world, p_uid, v_rock) || ' Max QL ' || to_char(v_ql, 'FM990') || '.' || v_buried, 'event');$o$,
$n$    if v_rock.seam and vein_tip_at(p_world, p_uid, tx, ty) is not null then
      perform tell(p_world, p_uid, 'Here: ' || lower(seen_vein_at(p_world, p_uid, tx, ty)) || '. '
        || vein_tip_at(p_world, p_uid, tx, ty) || ' Max QL ' || to_char(v_ql, 'FM990') || '.' || v_buried, 'event');$n$);

-- A prospector's find, by the keeper's prospecting and each square's exposure.
select pg_temp.patch_fn('read_ground(uuid,integer,integer,integer,integer)',
  $o$seen_vein(p_world, c.keeper, bedrock_at(p_world, x, y)) as nm$o$, $n$seen_vein_at(p_world, c.keeper, x, y) as nm$n$);

-- A row of rock kinds as `p_hide`'s reader is sent it: each hidden kind as `unidentified_rock()`, but on a Rock tile,
-- which is bare and named to everybody (`seenRock`).
create or replace function mask_rock(p_rock bytea, p_tiles bytea, p_hide int[]) returns bytea
language plpgsql stable as $$
declare v bytea := p_rock; k int; b bytea; at int; from_i int; v_bare int := tile_id('Rock');
begin
  if p_rock is null or coalesce(cardinality(p_hide), 0) = 0 then return p_rock; end if;
  foreach k in array p_hide loop
    b := set_byte('\x00'::bytea, 0, k);
    from_i := 0;
    loop
      at := position(b in substring(v from from_i + 1));
      exit when at = 0;
      from_i := from_i + at;
      if p_tiles is null or from_i > length(p_tiles) or get_byte(p_tiles, from_i - 1) <> v_bare then
        v := set_byte(v, from_i - 1, unidentified_rock());
      end if;
    end loop;
  end loop;
  return v;
end $$;

select pg_temp.patch_fn('rpc_land_window(uuid,integer,integer,integer,integer)',
$o$mask_rock(substring(t.rock  from x0 + 1 for (x1 - x0 + 1)), v_hide)$o$,
$n$mask_rock(substring(t.rock  from x0 + 1 for (x1 - x0 + 1)), substring(t.tiles from x0 + 1 for (x1 - x0 + 1)), v_hide)$n$);
drop function if exists mask_rock(bytea, int[]);

-- The rock of a square that is bare rock, in its change: a vein dug out from under the soil comes named.
alter table tile_change add column if not exists rock int;

create or replace function land_announce(p_world uuid, p_x int, p_y int) returns void
language sql as $$
  insert into tile_change (world_id, x, y, region, tile, data, corners, soil, rock)
  values (p_world, p_x, p_y, region_of(p_x, p_y),
          land_tile(p_world, p_x, p_y), rock_data_sent(land_tile(p_world, p_x, p_y), land_data(p_world, p_x, p_y)),
          array[land_height(p_world, p_x, p_y), land_height(p_world, p_x + 1, p_y),
                land_height(p_world, p_x + 1, p_y + 1), land_height(p_world, p_x, p_y + 1)],
          array[land_dirt(p_world, p_x, p_y), land_dirt(p_world, p_x + 1, p_y),
                land_dirt(p_world, p_x + 1, p_y + 1), land_dirt(p_world, p_x, p_y + 1)],
          case when land_tile(p_world, p_x, p_y) = tile_id('Rock') then (bedrock_at(p_world, p_x, p_y)).id end)
$$;

-- And in the land Broadcast.
select pg_temp.patch_fn('private.land_out()',
  $o$'corners', f.corners, 'soil', f.soil)$o$, $n$'corners', f.corners, 'soil', f.soil, 'rock', f.rock)$n$);

select private.lock_doors();
