-- The woods turn a second at a time: a day in the woods in parts of a second each, every part its own transaction.
--
-- Measured on the live island: `tree_tick` averaged 991 ms and its worst go took 98,846 ms. A go was a whole day
-- for a whole island in one transaction: every line of a 4096 island read, aged and written back, every tree that
-- died seeding, every sapling planted, all of it holding the row of every line it had written until the last line
-- was done -- so anybody cutting, digging or planting on a wooded line waited behind it, for as long as a minute
-- and a half. On a test island founded like the live one (4096, seed 7, 1.16 million trees) a day was 8-12 s, and
-- a day of the die-off 33 s, with 625,000 changes to the record in one commit.
--
-- Now `tree_day_part` does as much of a day as fits before a time it is given, writes down where it got to
-- (`private.tree_run`) and commits, and the next go carries on from there. The parts are the day's own:
--
--   1. the lines, in order: aged, faced, written, the record told, and the trees that died set down
--      (`private.tree_run_dead`); the cuts in those lines closed and their chunks forgotten as they go;
--   2. the seeding, sixteen lines of the dead at a time, as before, each band's picks set down
--      (`private.tree_run_pick`), numbered in the order they came;
--   3. the rolls that settle two picks of one spot, in that order;
--   4. the planting, a line at a time; a spot built on, ploughed or deeded since it was picked takes no sapling;
--   5. the worn ground (`trail_day`), the chunk cache, the day stamped.
--
-- With no time given (`tree_day`, and every test) the whole day is one go, the same day as before: the same draws
-- in the same order, so from one seed the same trees age, die, seed and stand, byte for byte, with the same record
-- (supabase/test/woodparts.ts). `tree_tick` gives a part `tree_part_secs()` and the clock comes round every five
-- seconds now, all day, rather than once a minute for the dawn's hour: an island owed nothing costs it a lookup.
-- The day's swirls (`swirl_day`) are put down by the go that finishes the woods, as before.

set local lock_timeout = '3s';

/** How long one go of the clock spends on a day in the woods, in seconds, before it commits and stops. */
create or replace function tree_part_secs() returns double precision language sql immutable as $fn$ select 1::double precision $fn$;

/** A day in the woods under way: which part, where in it, and what it has found so far. */
create table if not exists private.tree_run (
  -- No key to `world`: adding one locks `world` against the stocking clock's stamp, and a deploy would wait on it.
  -- A run whose island has gone is never picked (`tree_tick` asks `world`) and is cleared if it is asked for.
  world_id uuid primary key,
  -- 1 the lines, 2 the seeding, 3 the rolls, 4 the planting, 5 the rest.
  phase int not null default 1,
  -- The next line (1, 2, 4) or the next pick (3).
  cursor int not null default 0,
  new_year boolean not null,
  touched boolean not null default false,
  moved bigint not null default 0,
  picks int not null default 0,
  started_at timestamptz not null default now()
);
/** The trees that died today, by line, until the seeding has been past them. */
create table if not exists private.tree_run_dead (
  world_id uuid not null references private.tree_run(world_id) on delete cascade,
  y int not null,
  x int not null,
  sp int,
  primary key (world_id, y, x)
);
/** The spots the dead picked for a sapling, in the order they were picked, and the roll that settles a shared one. */
create table if not exists private.tree_run_pick (
  world_id uuid not null references private.tree_run(world_id) on delete cascade,
  k int not null,
  gx int not null,
  gy int not null,
  sp int,
  r double precision,
  primary key (world_id, k)
);
create index if not exists tree_run_pick_line on private.tree_run_pick (world_id, gy);
alter table private.tree_run enable row level security;
alter table private.tree_run_dead enable row level security;
alter table private.tree_run_pick enable row level security;
revoke all on table private.tree_run, private.tree_run_dead, private.tree_run_pick from public, anon, authenticated;

/**
 * As much of a day in the woods as fits before `p_until`, carried on from wherever the last part stopped: the
 * number of trees on the island that day when this part finished the day, or null when there is more to do.
 * At least one line, band, roll or sapling line is done a go, however little time it is given.
 */
create or replace function tree_day_part(p_world uuid, p_until timestamptz) returns integer language plpgsql as $fn$
declare w record; run private.tree_run; v_y int; v_tiles bytea; v_data bytea; v_row record;
        v_stump int := tile_id('Stump'); v_grass int := tile_id('Grass'); v_lawn int := tile_id('Lawn');
        v_next int[]; v_kind int[]; v_first int := tree_first(); v_reach int := tree_seed_reach()::int;
        v_moved bigint := 0; k int; v_did boolean := false; v_stop int; v_lo int; v_hi int; v_total bigint;
        v_sx int[]; v_sy int[]; v_ss int[]; v_cx int[]; v_cy int[];
        v_gx int[]; v_gy int[]; v_gs int[]; v_tx int[]; v_ts int[];
        v_px int[]; v_py int[]; v_near boolean; v_told int[];
        v_h0 bytea; v_h1 bytea; v_d0 bytea; v_d1 bytea;
        v_band int := 16; v_ya int; v_yb int; v_w0 int; v_w1 int; v_ground bytea;
        v_plant boolean[]; v_deeds deed[]; v_pick record;
        -- The tiles an aqueduct's spans are carried over, where no seed takes (`aqueduct_over`).
        v_aqx int[]; v_aqy int[];
        -- The bit that says a tile of grass has had its flowers picked this year.
        v_picked int := flowers_picked()::int;
        v_rolls int := 10000;
begin
  select * into w from world where id = p_world;
  if not found or not w.ready then
    delete from private.tree_run where world_id = p_world;
    return 0;
  end if;
  select * into run from private.tree_run r where r.world_id = p_world for update;
  if not found then
    -- Whether a new year has begun since the last turn, which is when every tile of picked flowers flowers again.
    insert into private.tree_run (world_id, new_year)
    values (p_world, w.trees_at is null or year_of(now()) <> year_of(w.trees_at))
    returning * into run;
  end if;

  -- ---------------------------------------------------------------- 1. the lines
  if run.phase = 1 then
    -- What each age becomes, read once rather than per tree. -1 is the end of it.
    select array_agg(coalesce(next, -1) order by id) into v_next from tree_age_def;
    -- And what kind of tree each data byte is, the same way.
    select array_agg(tree_species(b) order by b) into v_kind from generate_series(0, 255) b;
    -- And who is about, for the half of this that is only worth telling somebody who can see it happen.
    select array_agg(floor(p.x)::int), array_agg(floor(p.y)::int) into v_px, v_py
      from player p where p.world_id = p_world and not p.away
        and p.seen_at > now() - make_interval(secs => idle_logout());

    for v_y in run.cursor .. w.size - 1 loop
      if v_did and clock_timestamp() >= p_until then v_stop := v_y; exit; end if;
      v_did := true;
      /*
       * Read the line out, not the note that says where it is: both columns are stored packed, and a kept plan
       * that took the packed value as a parameter would unpack the whole line again for every byte read out of
       * it. Appending nothing unpacks it here, once.
       */
      select t.tiles || ''::bytea, t.data || ''::bytea into v_tiles, v_data
        from land_tile t where t.world_id = p_world and t.y = v_y;
      if not found then continue; end if;
      -- A line with nothing on it that the day moves is thrown out unread: no tree, no stump, and no grass with a
      -- count in it, or a picked tile on the day a new year clears it. Errs towards reading a line.
      if position('\x10'::bytea in v_tiles) = 0 and position(set_byte('\x00'::bytea, 0, v_stump) in v_tiles) = 0
         and not any_byte_between(v_data, 1, 7)
         and not any_byte_between(v_data, case when run.new_year then 8 else 9 end, 15) then continue; end if;

      /*
       * The whole line in one statement: the new faces, the new ages, how many trees were in it, which of them
       * went, and which columns moved at all. `dead` is the trees that went, which seed. `faced` is every tile
       * that is something else after the day. `stirred` is all of that and every tree that moved a stage.
       */
      select
        -- A tree that dies of age leaves grass; every stump is grass after the turn; grass kept cut on a deed for
        -- a third day is lawn.
        string_agg(set_byte('\x00'::bytea, 0, case
          when g.t = 16 and g.n < 0 then v_grass
          when g.t = v_stump then 0
          when g.t = v_grass and (g.d & 4) <> 0 and (g.d & 3) + 1 >= 3 then v_lawn
          else g.t end), ''::bytea order by g.gi) as tiles,
        -- And flowers picked this year stay picked beside the count, until a new year begins (`FLOWERS_PICKED`).
        string_agg(set_byte('\x00'::bytea, 0, case
          when g.t = v_stump then 0
          when g.t = v_grass and (g.d & 4) <> 0 then case when (g.d & 3) + 1 >= 3 then 0
            else ((g.d & 3) + 1) | case when run.new_year then 0 else g.d & v_picked end end
          when g.t = v_grass then case when run.new_year then 0 else g.d & v_picked end
          when g.t <> 16 then g.d
          when g.n < 0 then 0
          -- The species bits, low nibble and top bit, kept; the age between them moved on.
          else (g.d & 143) | (g.n << 4) end), ''::bytea order by g.gi) as data,
        count(*) filter (where g.t = 16) as here,
        array_agg(g.gi) filter (where (g.t = 16 and (g.n < 0 or g.n <> g.a)) or g.t = v_stump
                                   or (g.t = v_grass and ((g.d & 7) <> 0 or (run.new_year and (g.d & v_picked) <> 0)))) as stirred,
        array_agg(g.gi) filter (where (g.t = 16 and g.n < 0) or g.t = v_stump
                                   or (g.t = v_grass and (g.d & 4) <> 0 and (g.d & 3) + 1 >= 3)
                                   or (g.t = v_grass and run.new_year and (g.d & v_picked) <> 0)) as faced,
        array_agg(g.gi) filter (where g.t = 16 and g.n < 0) as dead
        into v_row
        -- `n` is what the age becomes: the next stage, -1 for the end of it, or the same age again for one with
        -- nothing written down. A null here would drop the byte out of the line and shorten it.
        from (select q.gi, q.t, q.d, q.a, coalesce(v_next[q.a + 1], q.a) as n
                from (select gi, get_byte(v_tiles, gi) as t, get_byte(v_data, gi) as d,
                             tree_age(get_byte(v_data, gi)) as a
                        from generate_series(0, w.size - 1) gi) q) g;
      if v_row.here = 0 and v_row.stirred is null then continue; end if;
      v_moved := v_moved + v_row.here;
      run.touched := true;
      v_lo := coalesce(v_lo, v_y);
      v_hi := v_y;

      update land_tile t set tiles = v_row.tiles, data = v_row.data
        where t.world_id = p_world and t.y = v_y;

      -- And the line's changes into the record, in one statement: the corners of every tile in a line live in
      -- two rows of `land_corner`, read out once, unpacked. What changed face goes in whoever is about.
      v_near := false;
      if v_px is not null then
        for k in 1 .. array_length(v_px, 1) loop
          if abs(v_py[k] - v_y) <= tree_tell_reach() then v_near := true; exit; end if;
        end loop;
      end if;
      v_told := case when v_near then v_row.stirred else v_row.faced end;
      if v_told is not null then
        select c.heights || ''::bytea, c.dirt || ''::bytea into v_h0, v_d0
          from land_corner c where c.world_id = p_world and c.y = v_y;
        select c.heights || ''::bytea, c.dirt || ''::bytea into v_h1, v_d1
          from land_corner c where c.world_id = p_world and c.y = v_y + 1;
        if found and v_h0 is not null then
          insert into tile_change (world_id, x, y, region, tile, data, corners, soil)
          select p_world, u.gi, v_y, region_of(u.gi, v_y),
                 get_byte(v_row.tiles, u.gi), get_byte(v_row.data, u.gi),
                 array[b_i16(v_h0, u.gi), b_i16(v_h0, u.gi + 1),
                       b_i16(v_h1, u.gi + 1), b_i16(v_h1, u.gi)],
                 array[get_byte(v_d0, u.gi), get_byte(v_d0, u.gi + 1),
                       get_byte(v_d1, u.gi + 1), get_byte(v_d1, u.gi)]
            from unnest(v_told) as u(gi);
        end if;
      end if;

      -- What the ones that went leave behind them is set down, not planted here: seeds land in the lines either
      -- side of this one, and a line is written once. Of the kind the line said before the day.
      if v_row.dead is not null then
        insert into private.tree_run_dead (world_id, y, x, sp)
        select p_world, v_y, u.gi, v_kind[get_byte(v_data, u.gi) + 1] from unnest(v_row.dead) as u(gi);
      end if;
    end loop;

    -- A year's growth closes whatever was cut into the lines this part turned.
    delete from tree_notch where world_id = p_world and y >= run.cursor and y < coalesce(v_stop, w.size);
    -- And the chunks those lines are in are forgotten now, not at the end of the day (`land_chunk`).
    if v_lo is not null then
      delete from land_chunk where world_id = p_world
        and cy between v_lo / chunk_size()::int and v_hi / chunk_size()::int;
      v_lo := null;
    end if;
    run.moved := run.moved + v_moved;
    if v_stop is not null then
      update private.tree_run set cursor = v_stop, touched = run.touched, moved = run.moved where world_id = p_world;
      return null;
    end if;
    run.phase := 2;
    run.cursor := 0;
  end if;

  -- What a seed may take: plantable ground, off any deed, not under an aqueduct.
  if run.phase in (2, 3, 4) then
    select array_agg(exists (select 1 from plantable p where p.tile = b) order by b) into v_plant
      from generate_series(0, 255) b;
    select array_agg(d) into v_deeds from deed d where d.world_id = p_world;
    select array_agg(s.x), array_agg(s.y) into v_aqx, v_aqy
      from bridge_span s join bridge b on b.world_id = s.world_id and b.id = s.bridge
     where s.world_id = p_world and b.kind = 'aqueduct';
  end if;

  -- ---------------------------------------------------------------- 2. the seeding
  /*
   * Sixteen lines of the dead at a time. Every tree that died asks the twenty-four tiles round it whether a seed
   * can take there, against the ground after the day -- except where one of the dead stood, which took the day to
   * clear. The lines a band can reach are read out once, end to end, and every candidate is one byte of that.
   *
   * What is drawn is what always was: one roll per tree, the spots it could take in a random order, as many as
   * the roll and the room allow.
   */
  if run.phase = 2 then
    loop
      select min(d.y) into v_ya from private.tree_run_dead d where d.world_id = p_world and d.y >= run.cursor;
      exit when v_ya is null;
      if v_did and clock_timestamp() >= p_until then
        update private.tree_run set phase = 2, cursor = run.cursor, touched = run.touched, moved = run.moved,
                                    picks = run.picks where world_id = p_world;
        return null;
      end if;
      v_did := true;
      -- The band: the dead in sixteen lines from the first line with any, in order of their line.
      select array_agg(d.x order by d.y, d.x), array_agg(d.y order by d.y, d.x), array_agg(d.sp order by d.y, d.x), max(d.y)
        into v_sx, v_sy, v_ss, v_yb
        from private.tree_run_dead d where d.world_id = p_world and d.y >= v_ya and d.y < v_ya + v_band;
      v_w0 := greatest(0, v_ya - v_reach);
      v_w1 := least(w.size - 1, v_yb + v_reach);
      select string_agg(t.tiles, ''::bytea order by t.y) into v_ground
        from land_tile t where t.world_id = p_world and t.y between v_w0 and v_w1;
      -- The dead in the lines the band reads: the band's own and those either side of it within a seed's reach.
      select array_agg(d.x order by d.y, d.x), array_agg(d.y order by d.y, d.x) into v_cx, v_cy
        from private.tree_run_dead d where d.world_id = p_world and d.y between v_w0 and v_w1;
      v_gx := '{}'; v_gy := '{}'; v_gs := '{}';

      for v_pick in
        with dead as (
          -- One roll per tree, not per spot it might take.
          select d.x, d.y, d.sp, random() as roll
            from unnest(v_sx, v_sy, v_ss) as d(x, y, sp)
           -- Nothing seeds on an island where trees do not grow of themselves.
           where not coalesce(region_treeless(region_at(p_world, d.x, d.y)), false)
        ), cand as (
          select d.x, d.y, d.sp, d.roll, d.x + q.dx as gx, d.y + q.dy as gy
          from dead d cross join (
            select dx, dy from generate_series(-v_reach, v_reach) dx,
                               generate_series(-v_reach, v_reach) dy
            where not (dx = 0 and dy = 0)) q
          where d.roll >= tree_seed_none()
            and d.x + q.dx between 0 and w.size - 1 and d.y + q.dy between 0 and w.size - 1
        ), cleared as (
          select k.x, k.y from unnest(v_cx, v_cy) as k(x, y)
        ), free as (
          select c.gx, c.gy, c.sp, c.roll,
                 row_number() over (partition by c.x, c.y order by random()) as rn,
                 count(*) over (partition by c.x, c.y) as room
          from cand c
          where v_plant[get_byte(v_ground, (c.gy - v_w0) * w.size + c.gx) + 1]
            and not exists (select 1 from cleared k where k.x = c.gx and k.y = c.gy)
            and (v_deeds is null or not exists (select 1 from unnest(v_deeds) d where deed_covers(d, c.gx, c.gy)))
            and (v_aqx is null or not exists (select 1 from unnest(v_aqx, v_aqy) a(x, y) where a.x = c.gx and a.y = c.gy))
        ), want as (
          -- What it wants, and what the ground will have: the roll averages a shade over replacement, the room
          -- keeps a thick wood from running away.
          select f.gx, f.gy, f.sp, f.rn, least(
            case when f.roll < tree_seed_none() then 0
                 when f.roll < 1 - tree_seed_both() then 1 else tree_seeds()::int end,
            case when f.room >= tree_room_two() then tree_seeds()::int
                 when f.room >= tree_room_one() then 1 else 0 end) as take
          from free f
        )
        select gx, gy, sp from want where rn <= take
      loop
        v_gx := v_gx || v_pick.gx;
        v_gy := v_gy || v_pick.gy;
        v_gs := v_gs || v_pick.sp;
      end loop;

      insert into private.tree_run_pick (world_id, k, gx, gy, sp)
      select p_world, run.picks + u.o::int, u.gx, u.gy, u.sp
        from unnest(v_gx, v_gy, v_gs) with ordinality as u(gx, gy, sp, o);
      run.picks := run.picks + coalesce(array_length(v_gx, 1), 0);
      -- No later band reaches back past its own first line less a seed's reach.
      delete from private.tree_run_dead d where d.world_id = p_world and d.y < v_ya + v_band - v_reach;
      run.cursor := v_ya + v_band;
    end loop;
    delete from private.tree_run_dead d where d.world_id = p_world;
    run.phase := 3;
    run.cursor := 1;
  end if;

  -- ---------------------------------------------------------------- 3. the rolls
  -- Two trees that picked the same spot plant one between them: one roll a pick, in the order picked, and the
  -- lowest roll of a spot has it.
  if run.phase = 3 then
    while run.cursor <= run.picks loop
      if v_did and clock_timestamp() >= p_until then
        update private.tree_run set phase = 3, cursor = run.cursor, touched = run.touched, moved = run.moved,
                                    picks = run.picks where world_id = p_world;
        return null;
      end if;
      v_did := true;
      with q as materialized (
        select g.k, random() as r from generate_series(run.cursor, least(run.picks, run.cursor + v_rolls - 1)) g(k))
      update private.tree_run_pick p set r = q.r from q where p.world_id = p_world and p.k = q.k;
      run.cursor := least(run.picks, run.cursor + v_rolls - 1) + 1;
    end loop;
    run.phase := 4;
    run.cursor := 0;
  end if;

  -- ---------------------------------------------------------------- 4. the planting
  /*
   * A line at a time: the line read out unpacked, a byte set for each sapling in it, the line written back once,
   * and each sapling into the record after the dead, as a tile can lose its stump and gain a neighbour's sapling
   * the same day. A spot that has stopped being plantable, or come under a deed or an aqueduct, since it was
   * picked takes no sapling: a later part of the day must not plant over somebody's work.
   */
  if run.phase = 4 then
    loop
      select min(p.gy) into v_y from private.tree_run_pick p where p.world_id = p_world and p.gy >= run.cursor;
      exit when v_y is null;
      if v_did and clock_timestamp() >= p_until then
        update private.tree_run set phase = 4, cursor = run.cursor, touched = run.touched, moved = run.moved,
                                    picks = run.picks where world_id = p_world;
        if v_lo is not null then
          delete from land_chunk where world_id = p_world
            and cy between v_lo / chunk_size()::int and v_hi / chunk_size()::int;
        end if;
        return null;
      end if;
      v_did := true;
      select t.tiles || ''::bytea, t.data || ''::bytea into v_tiles, v_data
        from land_tile t where t.world_id = p_world and t.y = v_y;
      if found then
        select array_agg(q.gx order by q.gx), array_agg(q.sp order by q.gx) into v_tx, v_ts
          from (select distinct on (p.gx) p.gx, p.sp from private.tree_run_pick p
                 where p.world_id = p_world and p.gy = v_y order by p.gx, p.r) q
         where v_plant[get_byte(v_tiles, q.gx) + 1]
           and (v_deeds is null or not exists (select 1 from unnest(v_deeds) d where deed_covers(d, q.gx, v_y)))
           and (v_aqx is null or not exists (select 1 from unnest(v_aqx, v_aqy) a(x, y) where a.x = q.gx and a.y = v_y));
        if v_tx is not null then
          for k in 1 .. array_length(v_tx, 1) loop
            v_tiles := set_byte(v_tiles, v_tx[k], 16);
            v_data := set_byte(v_data, v_tx[k], tree_pack(v_ts[k], v_first));
          end loop;
          update land_tile t set tiles = v_tiles, data = v_data
            where t.world_id = p_world and t.y = v_y;

          select c.heights || ''::bytea, c.dirt || ''::bytea into v_h0, v_d0
            from land_corner c where c.world_id = p_world and c.y = v_y;
          select c.heights || ''::bytea, c.dirt || ''::bytea into v_h1, v_d1
            from land_corner c where c.world_id = p_world and c.y = v_y + 1;
          if found and v_h0 is not null then
            insert into tile_change (world_id, x, y, region, tile, data, corners, soil)
            select p_world, u.gx, v_y, region_of(u.gx, v_y),
                   16, tree_pack(u.sp, v_first),
                   array[b_i16(v_h0, u.gx), b_i16(v_h0, u.gx + 1),
                         b_i16(v_h1, u.gx + 1), b_i16(v_h1, u.gx)],
                   array[get_byte(v_d0, u.gx), get_byte(v_d0, u.gx + 1),
                         get_byte(v_d1, u.gx + 1), get_byte(v_d1, u.gx)]
              from unnest(v_tx, v_ts) as u(gx, sp);
          end if;
          run.touched := true;
          v_lo := coalesce(v_lo, v_y);
          v_hi := v_y;
        end if;
      end if;
      delete from private.tree_run_pick p where p.world_id = p_world and p.gy = v_y;
      run.cursor := v_y + 1;
    end loop;
    run.phase := 5;
  end if;

  -- ---------------------------------------------------------------- 5. the rest
  if v_did and clock_timestamp() >= p_until then
    update private.tree_run set phase = 5, cursor = 0, touched = run.touched, moved = run.moved,
                                picks = run.picks where world_id = p_world;
    if v_lo is not null then
      delete from land_chunk where world_id = p_world
        and cy between v_lo / chunk_size()::int and v_hi / chunk_size()::int;
    end if;
    return null;
  end if;
  -- The worn ground: the day's fall off every tile feet have worn, after the saplings (`trail_day`).
  if trail_day(p_world) then run.touched := true; end if;
  -- And the chunk cache, dropped for the island in one statement: a chunk is only a cache.
  if run.touched then delete from land_chunk where world_id = p_world; end if;
  update world set trees_at = now() where id = p_world;
  v_total := run.moved;
  delete from private.tree_run where world_id = p_world;
  return v_total::int;
end $fn$;

/** A whole day in the woods for an island, in one go: the number of trees on it that day. */
create or replace function tree_day(p_world uuid) returns integer language plpgsql as $fn$
begin
  return tree_day_part(p_world, 'infinity'::timestamptz);
end $fn$;

create or replace function tree_tick() returns jsonb language plpgsql as $fn$
declare v_world uuid; v_grew int;
begin
  if not pg_try_advisory_lock(hashtext('tree_tick')::bigint) then
    return jsonb_build_object('isles', 0, 'busy', true);
  end if;
  -- One island a go: the one with its day under way first, then whichever is owed, drawn at random so that an
  -- island which cannot finish is not first in the queue every time.
  select w.id into v_world from world w
   where w.ready and (w.trees_at < tree_last_dawn() or exists (select 1 from private.tree_run r where r.world_id = w.id))
   order by exists (select 1 from private.tree_run r where r.world_id = w.id) desc, random() limit 1;
  if v_world is not null then
    v_grew := tree_day_part(v_world, clock_timestamp() + make_interval(secs => tree_part_secs()));
    -- And the day's mote swirls in place of yesterday's, after the woods (`swirl_day`).
    if v_grew is not null then perform swirl_day(v_world); end if;
  end if;
  perform pg_advisory_unlock(hashtext('tree_tick')::bigint);
  -- And every `wild_reset_days()` rollovers, the island's wild gone and restocked (`wild_reset_tick`).
  return jsonb_build_object('isles', case when v_world is null then 0 else 1 end, 'grew', v_grew,
                            'done', v_grew is not null, 'reset', wild_reset_tick());
end $fn$;

do $$
declare every text;
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then return; end if;
  -- Every five seconds where pg_cron can count seconds (1.5 and up), every minute where it cannot. All day: a go
  -- with nothing owed is a lookup, and a day under way carries on whenever it started.
  every := case when exists (select 1 from pg_extension where extname = 'pg_cron'
                               and string_to_array(extversion, '.')::int[] >= array[1, 5])
                then '5 seconds' else '* * * * *' end;
  -- `cron.schedule` is an upsert on the name, so this re-times the job rather than winding a second one beside it.
  perform cron.schedule('tree-tick', every, 'set statement_timeout = ''1min''; select public.tree_tick()');
exception when others then
  raise notice 'could not wind the woods (%)', sqlerrm;
end $$;

select private.lock_doors();
