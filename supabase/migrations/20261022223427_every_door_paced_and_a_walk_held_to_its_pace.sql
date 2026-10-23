-- Every door paced, and a walk held to its pace over time as well as a word at a time.
--
-- ---- pace: how often one person may knock -----------------------------------------------------
--
-- `too_fast` counts a minute's calls per account across the doors that ask it, and a minute is a
-- fixed window: all 480 can land in its first second. 29 doors never asked it at all. So
-- every `rpc_*` door now starts with `private.pace(uid, class)`: a token bucket per person and per
-- class of door, kept as one timestamp per class on the person's `caller` row (unlogged, one row
-- each, the row `too_fast` already writes; deleting it, as the tests do, resets both).
--
-- The bucket is GCRA: `paced[slot]` is the moment the bucket is next empty. A call moves it on by
-- one interval (1 / rate) from now or from where it was, whichever is later, and is refused when
-- that is more than `burst` intervals ahead of now. Refused: one line, raised, so the whole call
-- rolls back -- nothing done, and the bucket left where it was.
--
-- Budgets, against what the browser itself sends (`src/net/island.ts`, `src/game/keep.ts`):
--
--   class  rate/s  burst  doors                         the browser's own pace
--   move     3      30    rpc_move                      one a `MOVE_EVERY` (1 s), a few more at a stair
--   look    15     150    polls and reads               creatures 1/s, ground 1/s, the beat at most 2/s,
--                                                       springs 1/4 s, reconcile 3/20 s: under 5/s
--   act      5      60    work, your own settings,      a click each; a deed's ranks are a box ticked
--                         a deed's ranks                each, a dozen in a row
--   deal     2      60    trades, letters, market,      a click each
--                         notices, invites, say
--   land    20     600    rpc_put_land, rpc_ready       founding: one band a call
--
-- `private.pace_doors()` puts the call into any door that lacks it, with the class
-- `private.pace_class` gives it, and `private.lock_doors()` runs it, so a door added or rewritten
-- by a later migration is paced too. The six doors that were STABLE become VOLATILE: PostgREST runs
-- a stable function in a read-only transaction, where the bucket could not be written.
--
-- ---- a walk held to its pace -------------------------------------------------------------------
--
-- `rpc_move` allowed `(travel_speed * least(gap, 10) * 1.6 + 1.5) * crawl` a call: 60% over the
-- pace, a tile and a half on every call and the gap floored at 0.05 s, so a browser sending a word
-- every tenth of a second at 1.6 times its pace was never pulled. That check stays, for a link that
-- hiccups. Beside it, on the player row, `walk_ahead`: how far the body is ahead of its pace. Every
-- second that really passed takes the pace off it, every tile the body is let go goes on it, and it
-- may not pass `walk_slack_secs()` seconds of the pace and `walk_slack_tiles()` tiles. Time a word
-- did not use is not kept for a later one, so over any stretch of time -- the last ten seconds or
-- the last hour -- a body covers at most its pace for that time and the slack. Its pace is
-- `travel_speed` times the ground's own pace (`walk_ground`), which the browser walks at and
-- `travel_speed` leaves out. The move door no longer counts toward `too_fast`; it has its own class.
--
-- `too_fast` stays on the 77 other doors that ask it.

set local lock_timeout = '3s';

/* ---- pace ---------------------------------------------------------------------------------- */

alter table caller add column if not exists paced timestamptz[];

/*
 * For a class of door: its rate (calls a second, sustained), its burst (calls at once), and its slot on
 * `caller.paced`. Three scalar SQL functions rather than one row, because a scalar one is inlined into
 * `pace` and a row is a function call: 2 us against 40 on every knock.
 */
create or replace function private.pace_rate(p_class text) returns double precision language sql immutable as $$
  select (case p_class when 'move' then 3 when 'look' then 15 when 'act' then 5 when 'deal' then 2 when 'land' then 20 end)::double precision
$$;
create or replace function private.pace_burst(p_class text) returns int language sql immutable as $$
  select case p_class when 'move' then 30 when 'look' then 150 when 'act' then 60 when 'deal' then 60 when 'land' then 600 end
$$;
create or replace function private.pace_slot(p_class text) returns int language sql immutable as $$
  select case p_class when 'move' then 1 when 'look' then 2 when 'act' then 3 when 'deal' then 4 when 'land' then 5 end
$$;

/** Which class of door a door is. Anything not named is `act`. */
create or replace function private.pace_class(p_door text) returns text language sql immutable as $$
  select case
    when p_door = 'rpc_move' then 'move'
    when p_door in ('rpc_barter', 'rpc_boards', 'rpc_chat', 'rpc_classes', 'rpc_clock', 'rpc_creatures', 'rpc_deals',
                    'rpc_faith', 'rpc_fog', 'rpc_ground', 'rpc_guide', 'rpc_guide_seen', 'rpc_join', 'rpc_land_window',
                    'rpc_letters', 'rpc_market', 'rpc_my_look', 'rpc_my_name', 'rpc_name_free', 'rpc_notices_ashore',
                    'rpc_orders', 'rpc_owner_am_i', 'rpc_owner_online', 'rpc_parcels', 'rpc_prices',
                    'rpc_rune_gate_folk', 'rpc_settle', 'rpc_settlement', 'rpc_social', 'rpc_spells', 'rpc_springs',
                    'rpc_store_log', 'rpc_swirls', 'rpc_treasure_map', 'rpc_treasure_warm', 'rpc_tree',
                    'rpc_unported', 'rpc_worn') then 'look'
    when p_door in ('rpc_abandon', 'rpc_barter_accept', 'rpc_barter_answer', 'rpc_barter_ask', 'rpc_barter_cancel',
                    'rpc_barter_offer', 'rpc_buy', 'rpc_collect', 'rpc_deal', 'rpc_deal_answer', 'rpc_found',
                    'rpc_friend', 'rpc_unfriend', 'rpc_invite', 'rpc_invite_answer', 'rpc_join_answer', 'rpc_join_ask',
                    'rpc_join_withdraw', 'rpc_leave_deed', 'rpc_letter', 'rpc_parcel', 'rpc_notice_post',
                    'rpc_notice_drop', 'rpc_order', 'rpc_order_cancel', 'rpc_order_fill', 'rpc_price', 'rpc_takings',
                    'rpc_say', 'rpc_report_error') then 'deal'
    when p_door in ('rpc_put_land', 'rpc_ready') then 'land'
    else 'act' end
$$;

/**
 * One knock at a door of `p_class`, by `p_uid`: through, or refused with how long to wait.
 *
 * Nobody signed in (`rpc_name_free` is open to anon) is not counted here; the door says no itself.
 */
create or replace function private.pace(p_uid uuid, p_class text) returns void language plpgsql as $fn$
-- The interval in whole microseconds, rounded down, so `rate` calls fit in a second exactly.
declare v_slot int := private.pace_slot(p_class);
        v_every interval := make_interval(secs => floor(1e6 / private.pace_rate(p_class)) / 1e6);
        v_ahead interval; v_at timestamptz;
begin
  if p_uid is null then return; end if;
  if v_slot is null then raise exception 'no such class of door: %', p_class; end if;
  insert into public.caller as c (uid, paced[v_slot]) values (p_uid, now() + v_every)
  on conflict (uid) do update set paced[v_slot] = greatest(c.paced[v_slot], now()) + v_every
  returning c.paced[v_slot] into v_at;
  v_ahead := v_every * private.pace_burst(p_class);
  if v_at > now() + v_ahead then
    raise exception 'Too many requests: wait % s.', greatest(1, ceil(extract(epoch from v_at - now() - v_ahead)))::int
      using detail = p_class;
  end if;
end $fn$;

/**
 * Put `private.pace` at the top of every `rpc_*` door that lacks it, with its class.
 *
 * PL/pgSQL: the first statement after the body's first `begin`. SQL: a first statement of its own.
 * A door already paced under another class has its class put right. Returns how many it changed.
 */
create or replace function private.pace_doors() returns int language plpgsql as $fn$
declare f record; d text; v_class text; v_head int; v_body text; v_pre text; v_n int := 0; v_m text[];
begin
  for f in
    select p.oid, p.oid::regprocedure as sig, p.proname, l.lanname, p.provolatile
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace join pg_language l on l.oid = p.prolang
    where ns.nspname = 'public' and p.proname like 'rpc\_%' and p.prokind = 'f'
  loop
    v_class := private.pace_class(f.proname);
    d := pg_get_functiondef(f.oid);
    v_m := regexp_match(d, 'private\.pace\((?:auth\.uid\(\)|me), ''([a-z]+)''\)');
    if v_m is not null and v_m[1] = v_class and f.provolatile = 'v' then continue; end if;
    if v_m is not null then
      d := regexp_replace(d, '(private\.pace\((?:auth\.uid\(\)|me), '')[a-z]+(''\))', '\1' || v_class || '\2');
    else
      v_head := position(E'AS $function$\n' in d);
      if v_head = 0 then raise exception 'pace_doors: % has no $function$ body', f.proname; end if;
      v_head := v_head + length(E'AS $function$\n');
      v_body := substr(d, v_head);
      if f.lanname = 'sql' then
        v_body := format(E'  select private.pace(auth.uid(), %L);\n', v_class) || v_body;
      elsif f.lanname = 'plpgsql' then
        -- The body's own `begin`: the first line that is that word and nothing else, after a `declare` or none.
        if v_body like E'begin\n%' then v_pre := 'begin';
        elsif v_body ~ '^declare\M' and position(E'\nbegin\n' in v_body) > 0 then
          v_pre := substr(v_body, 1, position(E'\nbegin\n' in v_body) + length('begin'));
        else
          raise exception 'pace_doors: % has no begin on a line of its own', f.proname;
        end if;
        v_body := v_pre || format(E'\n  perform private.pace(auth.uid(), %L);', v_class) || substr(v_body, length(v_pre) + 1);
      else
        raise exception 'pace_doors: % is %', f.proname, f.lanname;
      end if;
      d := substr(d, 1, v_head - 1) || v_body;
    end if;
    execute d;
    if f.provolatile <> 'v' then execute format('alter function %s volatile', f.sig); end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $fn$;
revoke all on function private.pace(uuid, text) from public, anon, authenticated;
revoke all on function private.pace_doors() from public, anon, authenticated;
revoke all on function private.pace_rate(text), private.pace_burst(text), private.pace_slot(text) from public, anon, authenticated;
revoke all on function private.pace_class(text) from public, anon, authenticated;

/* ---- a walk held to its pace ------------------------------------------------------------- */

/** How far the body is ahead of its pace, in tiles, after its last word: 0 to the slack (`rpc_move`). */
alter table player add column if not exists walk_ahead double precision;

/** How far a walk may get ahead of its pace: this many seconds of it, and `walk_slack_tiles` on top. */
create or replace function walk_slack_secs() returns double precision language sql immutable as $$ select 1.0::double precision $$;
create or replace function walk_slack_tiles() returns double precision language sql immutable as $$ select 1.5::double precision $$;

/**
 * What the ground under a body does to its pace, as the browser has it (`Player.update`): the tile's
 * `speed`, which is past 1 on a made road (slabs 1.3, cobbles 1.25, packed dirt and trail 1.05) and on
 * every mount, seat and hull as well as on feet. `travel_speed` leaves it out; it was inside the old
 * 60%. Never under 1: slower ground only leaves the body further behind its pace.
 */
-- PL/pgSQL for its one cached plan: 15 us a call, where the same as a SQL function was planned every call at 140.
create or replace function walk_ground(p_world uuid, p_x double precision, p_y double precision)
  returns double precision language plpgsql stable as $$
declare v double precision;
begin
  -- On the island's far edge (x = size) there is no tile, and no byte to read.
  select d.speed into v from land_tile t
    join tile_def d on d.id = case when floor(p_x) between 0 and length(t.tiles) - 1 then get_byte(t.tiles, floor(p_x)::int) end
   where t.world_id = p_world and t.y = floor(p_y)::int;
  return greatest(1, coalesce(v, 1));
end $$;

do $do$
declare v_def text; v_old text; v_new text; i int;
  v_swap text[][] := array[
    -- declare: the pace and how far ahead of it
    [E'declare me uuid := auth.uid(); p player; w world;\n',
     E'declare me uuid := auth.uid(); p player; w world;\n        v_speed double precision; v_pace double precision; v_room double precision; v_ahead double precision;\n'],
    -- pace: this door's knock, in place of the minute's count
    [E'begin\n  if me is null then raise exception ''not signed in''; end if;\n  if too_fast(me) then raise exception ''you are asking too quickly; slow down''; end if;\n',
     E'begin\n  perform private.pace(me, ''move'');\n  if me is null then raise exception ''not signed in''; end if;\n'],
    -- over time as well as a word at a time
    [E'  allowed := (travel_speed(p_world, me) * least(gap, 10) * 1.6 + 1.5) * crawl;\n',
     E'  v_speed := travel_speed(p_world, me);\n'
     || E'  allowed := (v_speed * least(gap, 10) * 1.6 + 1.5) * crawl;\n'
     || E'  /*\n'
     || E'   * And over time. `walk_ahead` is how far the body was ahead of its pace after its last word; the\n'
     || E'   * seconds since (really since, not the floor of 0.05 above) take the pace off it, and below nought\n'
     || E'   * is time this word may use and no later one. A body may be `walk_slack_secs` of its pace and\n'
     || E'   * `walk_slack_tiles` ahead and no more, so over any stretch of time it covers its pace for that time\n'
     || E'   * and the slack. Its pace is `travel_speed` on the ground it stands on (`walk_ground`).\n'
     || E'   */\n'
     || E'  v_pace := v_speed * crawl * walk_ground(p_world, p.x, p.y);\n'
     || E'  v_room := v_pace * walk_slack_secs() + walk_slack_tiles() * crawl;\n'
     || E'  v_ahead := least(v_room, coalesce(p.walk_ahead, 0)) - v_pace * greatest(0, extract(epoch from (now() - p.moved_at)));\n'
     || E'  allowed := least(allowed, greatest(0, v_room - v_ahead));\n'],
    -- and what the walk let stand, paid
    [E'  update player set x = p_x, y = p_y, level = p_level, moved_at = now(), seen_at = now(), away = false\n    where world_id = p_world and uid = me;\n',
     E'  update player set x = p_x, y = p_y, level = p_level, moved_at = now(), seen_at = now(), away = false,\n'
     || E'         walk_ahead = greatest(0, v_ahead + sqrt(power(p_x - p.x, 2) + power(p_y - p.y, 2)))\n'
     || E'    where world_id = p_world and uid = me;\n']];
begin
  v_def := pg_get_functiondef('public.rpc_move(uuid, double precision, double precision, integer)'::regprocedure);
  for i in 1 .. array_length(v_swap, 1) loop
    v_old := v_swap[i][1];
    v_new := v_swap[i][2];
    if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
      raise exception 'rpc_move: anchor % not once', i;
    end if;
    v_def := replace(v_def, v_old, v_new);
  end loop;
  execute v_def;
end $do$;


/* ---- and every door, now and after ------------------------------------------------------- */

select private.pace_doors();

do $do$
declare v_def text; v_old text := E'  perform set_config(''lock_timeout'', ''4s'', true);\n';
begin
  v_def := pg_get_functiondef('private.lock_doors()'::regprocedure);
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'lock_doors: anchor not once';
  end if;
  -- Before the grants, so a door it rewrites is granted as every other.
  execute replace(v_def, v_old, v_old || E'  perform private.pace_doors();\n');
end $do$;

select private.lock_doors();
