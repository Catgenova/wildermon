-- A vein over your prospecting is unidentified on the wire too, not only in words.
--
-- Asked for: "prospecting will still show all glowing veins, but anything above the prospect gates just shows as
-- unidentified metals", and that the unidentified state be honest: the land the island sends carried every tile's rock
-- kind, so a browser knew each seam whatever its reader's prospecting.
--
--   * `rpc_land_window` sends a seam over the reader's prospecting gate (`skill_gate` kind 'vein') as
--     `unidentified_rock()` (255): a vein, and nothing that would name it. The browser's `UNIDENTIFIED_ROCK`, drawn and
--     named as "Unidentified metal" (`rockDef`, `seenRock`).
--   * The data byte of a bare Rock tile repeats its rock kind; a seam's is not sent at all (`rock_data_sent`), in the
--     window or in `tile_change`: what a face shows is read off the rock, never off that byte.

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

-- The rock kind a seam is sent as to somebody who cannot name it (`UNIDENTIFIED_ROCK`): past the sixteen kinds stored.
create or replace function unidentified_rock() returns int language sql immutable as 'select 255';

-- The rock kinds a reader cannot name: every seam over their prospecting gate (`seenRock`).
create or replace function rock_unseen(p_world uuid, p_uid uuid) returns int[]
language sql stable as $$
  select coalesce(array_agg(r.id order by r.id), '{}')
    from rock_def r join skill_gate g on g.kind = 'vein' and g.id = r.yields
   where r.seam and skill_of(p_world, p_uid, g.skill) < g.level
$$;

-- A row of rock kinds as `p_hide`'s reader is sent it: each hidden kind as `unidentified_rock()`. Found by `position`,
-- a kind at a time, rather than byte by byte: a seam is a few tiles in a row of hundreds.
create or replace function mask_rock(p_rock bytea, p_hide int[]) returns bytea
language plpgsql immutable as $$
declare v bytea := p_rock; k int; b bytea; at int;
begin
  if p_rock is null or coalesce(cardinality(p_hide), 0) = 0 then return p_rock; end if;
  foreach k in array p_hide loop
    b := set_byte('\x00'::bytea, 0, k);
    loop
      at := position(b in v);
      exit when at = 0;
      v := set_byte(v, at - 1, unidentified_rock());
    end loop;
  end loop;
  return v;
end $$;

-- A tile's data byte as it is sent: a bare Rock tile's names its rock, so a seam's goes with its low four bits clear.
create or replace function rock_data_sent(p_tile int, p_data int) returns int
language sql stable as $$
  select case when p_tile = tile_id('Rock') and exists (select 1 from rock_def r where r.id = p_data & 15 and r.seam)
              then p_data & 240 else p_data end
$$;

-- A row of data bytes as it is sent, over its row of tiles (`rock_data_sent`): only the Rock tiles are looked at.
create or replace function mask_rock_data(p_tiles bytea, p_data bytea) returns bytea
language plpgsql stable as $$
declare v bytea := p_data; b bytea; at int; from_i int := 0; d int; v_seam int[];
begin
  if p_tiles is null or p_data is null then return p_data; end if;
  b := set_byte('\x00'::bytea, 0, tile_id('Rock'));
  v_seam := array(select id from rock_def where seam);
  loop
    at := position(b in substring(p_tiles from from_i + 1));
    exit when at = 0;
    from_i := from_i + at;
    if from_i <= length(v) then
      d := get_byte(v, from_i - 1);
      if (d & 15) = any(v_seam) then v := set_byte(v, from_i - 1, d & 240); end if;
    end if;
  end loop;
  return v;
end $$;

select pg_temp.patch_fn('rpc_land_window(uuid,integer,integer,integer,integer)',
$o$  v_size int; v_n bigint;$o$,
$n$  v_size int; v_n bigint;
  -- The seams this reader cannot name, sent as unidentified (`rock_unseen`).
  v_hide int[] := rock_unseen(p_world, auth.uid());$n$);
select pg_temp.patch_fn('rpc_land_window(uuid,integer,integer,integer,integer)',
$o$encode(substring(t.data  from x0 + 1 for (x1 - x0 + 1)), 'base64')$o$,
$n$encode(mask_rock_data(substring(t.tiles from x0 + 1 for (x1 - x0 + 1)), substring(t.data  from x0 + 1 for (x1 - x0 + 1))), 'base64')$n$);
select pg_temp.patch_fn('rpc_land_window(uuid,integer,integer,integer,integer)',
$o$encode(substring(t.rock  from x0 + 1 for (x1 - x0 + 1)), 'base64')$o$,
$n$encode(mask_rock(substring(t.rock  from x0 + 1 for (x1 - x0 + 1)), v_hide), 'base64')$n$);

-- And the history: a seam's data byte is not in it either.
create or replace function land_announce(p_world uuid, p_x int, p_y int) returns void
language sql as $$
  insert into tile_change (world_id, x, y, region, tile, data, corners, soil)
  values (p_world, p_x, p_y, region_of(p_x, p_y),
          land_tile(p_world, p_x, p_y), rock_data_sent(land_tile(p_world, p_x, p_y), land_data(p_world, p_x, p_y)),
          array[land_height(p_world, p_x, p_y), land_height(p_world, p_x + 1, p_y),
                land_height(p_world, p_x + 1, p_y + 1), land_height(p_world, p_x, p_y + 1)],
          array[land_dirt(p_world, p_x, p_y), land_dirt(p_world, p_x + 1, p_y),
                land_dirt(p_world, p_x + 1, p_y + 1), land_dirt(p_world, p_x, p_y + 1)])
$$;

select private.lock_doors();
