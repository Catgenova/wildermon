-- Winter fur and critter caches (`winter.ts`, `cacheAction.ts`).
--
-- Asked for, from a player's winter ideas: "critter caches that you can search for, possibly utilizing tracking" with
-- loot that is not "nuts and roots", and "increased fur gain from butchering could be a nice little perk to winter
-- activity". Every number and word comes over in the definitions snapshot before this one (`winter_fur`,
-- `caches_for`, `cache_ground`, `cache_spot_at`, `cache_draws`, `cache_loot`, `cache_pick`, `cache_said`,
-- `cache_search_said`, ...). Here:
--
--   * `winter_now`: the season fruit keeps is winter (`fruit_season`, which a test pins with `wildermon.season`);
--   * the butcher branch of `perform_fight`: in winter, `winter_fur` times the fur;
--   * `critter_cache`, which nothing may read: where this winter's caches lie, and `cache_winter`, which winter an
--     island's were laid for;
--   * `caches_owed`: outside winter every cache goes; in winter, once a winter, `caches_for` the island's size laid on
--     tiles of `cache_ground`, on land, off Runestones, buildings and springs, and `cache_deed_gap` tiles clear of
--     every settlement. Asked at each dawn after the woods (`tree_tick`) and by every search;
--   * `cache_refusal`: winter only; a tile; and for a dig, within reach and a cache of this winter on it;
--   * `perform_cache`: a search reads the nearest within a track's reach as a track reads (`track_reading`), names
--     the tile within `cache_spot_at` (a `cached` line for the browser), and trains Tracking as a track does; a dig
--     takes the cache for good -- first come -- and gives `cache_draws` draws of `cache_loot` by `cache_pick`, at one
--     quality of your Tracking, and a full go of Tracking;
--   * the three dispatchers taught the family, beside the track.
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

/* ---- The season ---- */

-- Whether it is winter on the island now (`winterNow`). Before the year is counted there is no winter.
create or replace function winter_now() returns boolean language sql stable as $fn$
  select coalesce(fruit_season(wild_now()) = winter_season(), false)
$fn$;

-- The season under way, by its first dawn: what this winter's caches are laid for.
create or replace function cache_winter_now() returns timestamptz language sql stable as $fn$
  select season_began(wild_now())
$fn$;

/* ---- Winter fur ---- */

select pg_temp.patch_fn('public.perform_fight(uuid,uuid,text,jsonb)'::regprocedure,
$o$      v_n := floor(r.n * v_share)::int;
      -- The remainder is a chance at one more, so a poor job still gives something.
      if random() < r.n * v_share - v_n then v_n := v_n + 1; end if;
$o$,
$n$      -- And `winter_fur` times the fur in winter (`WINTER_FUR`).
      v_n := floor(r.n * (case when r.part = winter_fur_part() and winter_now() then winter_fur() else 1 end) * v_share)::int;
      -- The remainder is a chance at one more, so a poor job still gives something.
      if random() < r.n * (case when r.part = winter_fur_part() and winter_now() then winter_fur() else 1 end) * v_share - v_n then
        v_n := v_n + 1;
      end if;
$n$);

/* ---- Where caches lie: nothing may read it ---- */

create table if not exists critter_cache (
  world_id uuid not null references world (id) on delete cascade,
  x integer not null,
  y integer not null,
  -- The first dawn of the winter it was laid for (`cache_winter_now`).
  winter timestamptz not null,
  primary key (world_id, x, y)
);
alter table critter_cache enable row level security;
revoke all on table critter_cache from anon, authenticated;

create table if not exists cache_winter (
  world_id uuid primary key references world (id) on delete cascade,
  winter timestamptz not null
);
alter table cache_winter enable row level security;
revoke all on table cache_winter from anon, authenticated;

/*
 * This winter's caches, laid once a winter; outside winter, every one gone. Drawn as the day's mote swirls are: points
 * at random over the island, kept where the ground takes a cache, the first drawn first, in rounds until there are
 * enough or the rounds run out. Returns how many it laid.
 */
create or replace function caches_owed(p_world uuid) returns int language plpgsql as $fn$
declare w world; v_winter timestamptz; v_want int; v_n int := 0; v_k int; v_round int := 0;
begin
  if not winter_now() then
    delete from critter_cache c where c.world_id = p_world;
    delete from cache_winter c where c.world_id = p_world;
    return 0;
  end if;
  v_winter := cache_winter_now();
  if exists (select 1 from cache_winter c where c.world_id = p_world and c.winter = v_winter) then return 0; end if;
  -- One at a time for an island: a search and the dawn could otherwise both lay a winter.
  perform pg_advisory_xact_lock(hashtext('caches_owed:' || p_world::text)::bigint);
  if exists (select 1 from cache_winter c where c.world_id = p_world and c.winter = v_winter) then return 0; end if;
  select * into w from world where id = p_world;
  if not found or not w.ready then return 0; end if;
  delete from critter_cache c where c.world_id = p_world;
  v_want := caches_for(w.size);
  while v_n < v_want and v_round < 6 loop
    v_round := v_round + 1;
    insert into critter_cache (world_id, x, y, winter)
    select p_world, o.x, o.y, v_winter from (
      select s.x, s.y from (
        select c.x, c.y, c.k, get_byte(t.tiles, c.x) as tile,
               least(b_i16(h0.heights, c.x), b_i16(h0.heights, c.x + 1),
                     b_i16(h1.heights, c.x + 1), b_i16(h1.heights, c.x)) as low
          from (select distinct on (q.x, q.y) q.x, q.y, q.k
                  from (select floor(random() * w.size)::int as x, floor(random() * w.size)::int as y, g.k
                          from generate_series(1, (v_want - v_n) * 8) g(k)) q) c
          join land_tile t on t.world_id = p_world and t.y = c.y
          join land_corner h0 on h0.world_id = p_world and h0.y = c.y
          join land_corner h1 on h1.world_id = p_world and h1.y = c.y + 1) s
       where cache_ground(s.tile) and s.low >= 0
         and runestone_on(w.size, s.x, s.y) is null
         and not exists (select 1 from building_tile b where b.world_id = p_world and b.x = s.x and b.y = s.y)
         and not exists (select 1 from spring_tile st where st.world_id = p_world and st.x = s.x and st.y = s.y)
         and not exists (select 1 from deed d where d.world_id = p_world
                            and abs(s.x - d.x) <= d.radius + cache_deed_gap() and abs(s.y - d.y) <= d.radius + cache_deed_gap())
         and not exists (select 1 from critter_cache cc where cc.world_id = p_world and cc.x = s.x and cc.y = s.y)
       order by s.k
       limit v_want - v_n) o
    on conflict (world_id, x, y) do nothing;
    get diagnostics v_k = row_count;
    v_n := v_n + v_k;
  end loop;
  insert into cache_winter (world_id, winter) values (p_world, v_winter)
    on conflict (world_id) do update set winter = excluded.winter;
  return v_n;
end $fn$;

/* ---- The jobs ---- */

-- Why a search or a dig cannot be made, or null: the browser's `cacheSearchRefusal` and `cacheDigRefusal`, word for word.
create or replace function cache_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
  language plpgsql stable as $fn$
declare d action_def; p player; tx int; ty int;
begin
  if not winter_now() then return cache_said('season'); end if;
  if p_target->>'kind' is distinct from 'tile' then return cache_said('ground'); end if;
  if p_action = cache_search_action() then return null; end if;
  tx := (p_target->>'x')::int; ty := (p_target->>'y')::int;
  if not in_bounds(p_world, tx, ty) then return cache_said('none'); end if;
  select * into d from action_def where id = p_action;
  select * into p from player where world_id = p_world and uid = p_uid;
  if not in_reach(p.x, p.y, p_target, false, d.range) then return 'You are too far away from that.'; end if;
  if not exists (select 1 from critter_cache c
                  where c.world_id = p_world and c.x = tx and c.y = ty and c.winter = cache_winter_now()) then
    return cache_said('none');
  end if;
  return null;
end $fn$;

/*
 * A go of either. A search: the nearest of this winter's caches within a track's reach of where you stand, nearer
 * first and then by x and y; within `cache_spot_at` its tile is said and handed your browser as a `cached` line,
 * otherwise the way and distance as a track reads them, and the arrow as a `tracked` line. A dig: the cache taken out
 * of the table first, so that of two at one cache whoever finishes first has it, and then its draws.
 */
create or replace function perform_cache(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns void
  language plpgsql as $fn$
declare v_why text; p player; v_skill double precision; v_level int; v_range int; v_x int; v_y int; v_d double precision;
        v_r jsonb; c critter_cache; v_ql double precision; v_i int; v_o int; l record; v_got jsonb := '{}';
        v_said text[] := '{}'; v_tier text; v_new bigint; v_n int;
begin
  v_why := cache_refusal(p_world, p_uid, p_action, p_target);
  if v_why is not null then
    perform tell(p_world, p_uid, v_why, 'error');
    -- A dig where none is: the tile your browser knew of forgotten.
    if p_action = cache_dig_action() and v_why = cache_said('none') then perform tell(p_world, p_uid, '{}', 'cached'); end if;
    return;
  end if;
  select * into p from player pl where pl.world_id = p_world and pl.uid = p_uid;
  v_skill := skill_of(p_world, p_uid, tracking_skill());
  v_level := track_level(v_skill);

  if p_action = cache_search_action() then
    perform caches_owed(p_world);
    v_range := floor(track_range(v_level) * (1 + aware_share(p_world, p_uid)))::int;
    select w.x, w.y, w.d into v_x, v_y, v_d from (
      select c0.x, c0.y, sqrt(power(c0.x + 0.5 - p.x, 2) + power(c0.y + 0.5 - p.y, 2)) as d
        from critter_cache c0 where c0.world_id = p_world and c0.winter = cache_winter_now()) w
     where w.d <= v_range order by w.d, w.x, w.y limit 1;
    if v_x is null then
      perform tell(p_world, p_uid, cache_search_said(v_range, null, null, null), 'event');
      perform skill_raise(p_world, p_uid, tracking_skill(), try_gain(false));
      perform char_told(p_world, p_uid, 'awareness', track_aware());
      return;
    end if;
    if v_d <= cache_spot_at(v_level) then
      perform tell(p_world, p_uid, cache_search_said(v_range, null, v_x, v_y), 'event');
      perform tell(p_world, p_uid, jsonb_build_object('x', v_x, 'y', v_y)::text, 'cached');
    else
      v_r := track_reading(v_level, track_bearing(p.x, p.y, v_x + 0.5, v_y + 0.5), v_d, random());
      perform tell(p_world, p_uid, cache_search_said(v_range, v_r, null, null), 'event');
      perform tell(p_world, p_uid, jsonb_build_object(
        'name', cache_arrow(), 'bearing', v_r->'bearing', 'far', v_r->'far', 'tiles', v_r->'tiles')::text, 'tracked');
    end if;
    perform skill_raise(p_world, p_uid, tracking_skill(), try_gain(true));
    perform char_told(p_world, p_uid, 'awareness', track_aware());
    return;
  end if;

  delete from critter_cache c0
   where c0.world_id = p_world and c0.x = (p_target->>'x')::int and c0.y = (p_target->>'y')::int
     and c0.winter = cache_winter_now()
  returning c0.* into c;
  if c.world_id is null then
    -- Somebody else's spade was quicker.
    perform tell(p_world, p_uid, cache_said('none'), 'error');
    perform tell(p_world, p_uid, '{}', 'cached');
    return;
  end if;
  v_ql := product_ql(v_skill);
  -- The draws, each a line of the table open at your Tracking; a line drawn twice gives twice as many.
  for v_i in 1 .. cache_draws(v_level) loop
    v_o := cache_pick(v_level, random());
    v_got := v_got || jsonb_build_object(v_o::text, coalesce((v_got->>v_o::text)::int, 0) + 1);
  end loop;
  for l in select cl.ord, cl.item, cl.n * (v_got->>cl.ord::text)::int as n
             from cache_loot() cl where v_got ? cl.ord::text order by cl.ord loop
    if l.item = 'tarnished_bauble' then
      -- Of a tier rolled as a trowel's find is, and as damaged (`perform_dig`).
      for v_i in 1 .. l.n loop
        v_tier := bauble_tier_roll();
        v_new := give(p_world, p_uid, l.item, 1, v_ql, v_tier);
        update item set dmg = 18 + random() * 50 where id = v_new;
        v_said := v_said || ('tarnished ' || v_tier || ' bauble');
      end loop;
    else
      if item_stackable(l.item) then
        perform give(p_world, p_uid, l.item, l.n, v_ql);
      else
        for v_i in 1 .. l.n loop perform give(p_world, p_uid, l.item, 1, v_ql); end loop;
      end if;
      v_n := l.n;
      v_said := v_said || (case when v_n > 1 then v_n || ' × ' else '' end || lower((select d.name from item_def d where d.id = l.item)));
    end if;
  end loop;
  perform tell(p_world, p_uid, 'Cache dug: ' || array_to_string(v_said, ', ') || ', QL ' || to_char(v_ql, 'FM990.0') || '.', 'event');
  perform tell(p_world, p_uid, '{}', 'cached');
  perform skill_raise(p_world, p_uid, tracking_skill(), 1);
end $fn$;

/* ---- Where the rest of the island hears of it ---- */

select pg_temp.patch_fn('public.act_ported(text)'::regprocedure,
$o$      or track_action(p_action)
$o$,
$n$      or track_action(p_action)
      -- Critter caches, in winter (`winter.ts`).
      or cache_action(p_action)
$n$);

select pg_temp.patch_fn('public.act_refusal_rules(uuid,uuid,text,jsonb)'::regprocedure,
$o$  if track_action(p_action) then
    return track_refusal(p_world, p_uid, p_action, p_target);
  end if;
$o$,
$n$  if track_action(p_action) then
    return track_refusal(p_world, p_uid, p_action, p_target);
  end if;
  -- And a critter cache, searched for or dug up: winter only (`winter.ts`).
  if cache_action(p_action) then
    return cache_refusal(p_world, p_uid, p_action, p_target);
  end if;
$n$);

select pg_temp.patch_fn('public.act_perform(uuid,uuid,text,jsonb)'::regprocedure,
$o$  if track_action(p_action) then
    perform perform_track(p_world, p_uid, p_action, p_target);
    return;
  end if;
$o$,
$n$  if track_action(p_action) then
    perform perform_track(p_world, p_uid, p_action, p_target);
    return;
  end if;
  -- Critter caches, in winter (`winter.ts`).
  if cache_action(p_action) then
    perform perform_cache(p_world, p_uid, p_action, p_target);
    return;
  end if;
$n$);

-- And each dawn, after the woods and the swirls: this winter's caches laid, or last winter's gone.
select pg_temp.patch_fn('public.tree_tick()'::regprocedure,
$o$    if v_grew is not null then perform swirl_day(v_world); end if;
$o$,
$n$    if v_grew is not null then perform swirl_day(v_world); end if;
    -- And the critter caches of the season: laid at the first dawn of winter, gone at the first after it (`caches_owed`).
    if v_grew is not null then perform caches_owed(v_world); end if;
$n$);

select private.lock_doors();
