-- The creatures read: only what changed since the last answer, and half the work for the rest.
--
-- Measured on the live island (pg_stat_statements, a Medium instance): `rpc_creatures` was 31% of all the
-- database's time, 138 ms a call at about three calls a second. Every browser asks it once a second
-- (`MOBS_EVERY`) for everything within forty tiles, and every answer built every creature's row again: its
-- health ceiling, its stage, its age, its panniers, its pedigree, each a function call or several, whether or
-- not anything about it had moved since the second before. Measured on a test island sized like the live one,
-- five to ten in a hundred of the rows a body is sent change from one second to the next.
--
-- ---- the same answer, cheaper -----------------------------------------------------------------------------
--
-- Profiled per function (`track_functions`): half of the read was `pannier_sent`, asked of every creature, whose
-- `pannier_shut` looks up its keeper's settlements and rights. Only a kept creature of a kind that carries
-- panniers (`species_def.panniers`) can have them open to anybody, so nothing else asks now. And `stun_left` is
-- asked only while anything on the island is stunned at all, and the settlement's trade counts
-- (`deed_trade_counts`) only when a worker of your own is in the answer. The rows are the same, key for key
-- (`supabase/test/fetchdelta.ts` holds the read against itself with every short cut taken out).
--
-- ---- only what changed ------------------------------------------------------------------------------------
--
-- A browser that says what it holds is sent only what changed (`p_since`, `p_have`):
--
--   * every answer in the new shape carries `at`, a cursor: the moment and the snapshot it was read in
--     (`pg_current_snapshot`), as `v1:<ms>:<xmin>:<xmax>:<xip,...>`;
--   * a browser hands back the last `at` it was given and the ids it holds, and is sent the rows of every creature
--     in its answer whose row was written since (a row version not visible to that snapshot: no column, no trigger,
--     nothing for the clock to write), every one it does not hold, and `gone`, the ids it holds that are no longer
--     in its answer;
--   * and, whatever their row says, the ones whose answer moves without their row being written: a worker resting,
--     going to bed or not settled for a turn (`idleWhy`), one ridden (its rider's storey), a kept one with panniers
--     (what is in them), and one with a class mark written since (a stun, an ability's rest). What counts down on a
--     row (a leg, a blow drawn back, a stun, a slow, a meal, young due) the browser counts down itself;
--   * a cursor older than `private.since_most()` seconds, unreadable, or without `p_have`, is answered whole, with
--     `full`; and a browser asks for the whole answer every `RECONCILE_EVERY` seconds and after anything it does,
--     which is what puts right what only moves with the clock (an age, a shoe worn out, a health ceiling a keeper's
--     class moved);
--   * a browser that says neither is sent the list it always was, so a page from before this still works.

set local lock_timeout = '3s';

/** How old a cursor (`rpc_creatures` `p_since`) may be and still be answered with what changed since it, in seconds. */
create or replace function private.since_most() returns double precision language sql immutable as $fn$ select 60::double precision $fn$;
revoke all on function private.since_most() from public, anon, authenticated;

/** The most ids a browser may say it holds (`rpc_creatures` `p_have`). */
create or replace function private.have_most() returns int language sql immutable as $fn$ select 5000 $fn$;
revoke all on function private.have_most() from public, anon, authenticated;

/**
 * A cursor (`v1:<ms>:<xmin>:<xmax>:<xip,...>`) as the low 32 bits of its snapshot's xmin, xmax and running ids, in
 * that order; or null for one that is unreadable, older than `since_most`, or from ahead of this clock.
 */
create or replace function private.since_snap(p_since text) returns bigint[] language plpgsql stable as $fn$
declare m text[]; v_at timestamptz;
begin
  if p_since is null or length(p_since) > 4000 then return null; end if;
  m := regexp_match(p_since, '^v1:([0-9]{1,15}):([0-9]{1,19}):([0-9]{1,19}):([0-9]{1,19}(,[0-9]{1,19})*)?$');
  if m is null then return null; end if;
  v_at := to_timestamp(m[1]::numeric / 1000);
  if v_at < now() - make_interval(secs => private.since_most()) or v_at > now() + interval '5 seconds' then return null; end if;
  return array[m[2]::numeric % 4294967296, m[3]::numeric % 4294967296]::bigint[]
      || coalesce((select array_agg(x::numeric % 4294967296) from unnest(string_to_array(m[4], ',')) x), '{}')::bigint[];
end $fn$;
revoke all on function private.since_snap(text) from public, anon, authenticated;

/**
 * Whether a row version written by `p_xid` is newer than a snapshot (`since_snap`): not visible to it, as
 * `pg_visible_in_snapshot` decides, on the low 32 bits the way Postgres compares them. A frozen or bootstrap id is
 * visible to everything.
 */
create or replace function private.since_new(p_xid xid, p_snap bigint[]) returns boolean language sql immutable as $fn$
  select not (p_xid::text::bigint < 3
              or (p_xid::text::bigint - p_snap[1] + 4294967296) % 4294967296 >= 2147483648
              or ((p_xid::text::bigint - p_snap[2] + 4294967296) % 4294967296 >= 2147483648
                  and not (p_xid::text::bigint = any (p_snap[3:]))))
$fn$;
revoke all on function private.since_new(xid, bigint[]) from public, anon, authenticated;

/**
 * A snapshot as a cursor's last three fields (`xmin:xmax:xip,...`), with this transaction's own id among the running
 * when it has one: a row it wrote itself (a sweep on a database without `pg_cron`) is read by it but not yet seen by
 * anybody it answers, so the next answer counts it as new.
 */
create or replace function private.since_text(p_snap pg_snapshot) returns text language sql volatile as $fn$
  select case when pg_current_xact_id_if_assigned() is null then p_snap::text
              else least(pg_snapshot_xmin(p_snap), pg_current_xact_id_if_assigned())::text || ':' || pg_snapshot_xmax(p_snap)::text || ':'
                   || (select string_agg(x::text, ',' order by x)
                         from (select pg_snapshot_xip(p_snap) as x union select pg_current_xact_id_if_assigned()) q) end
$fn$;
revoke all on function private.since_text(pg_snapshot) from public, anon, authenticated;

drop function if exists public.rpc_creatures(uuid, double precision);

CREATE OR REPLACE FUNCTION public.rpc_creatures(p_world uuid, p_range double precision DEFAULT 40, p_since text DEFAULT NULL::text, p_have integer[] DEFAULT NULL::integer[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); p player;
        -- What the browser last saw (`since_snap`), or null for the whole answer.
        v_snap bigint[];
        v_rows jsonb; v_ids int[]; v_at text;
begin
  perform private.pace(auth.uid(), 'look');
  p_range := least(greatest(coalesce(p_range, 0), 0), private.read_range_most());
  if cardinality(p_have) > private.have_most() then
    raise exception 'Bad request: rpc_creatures p_have: too many.' using errcode = '22023';
  end if;
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select * into p from player where world_id = p_world and uid = me;
  if not found then raise exception 'you are not on this island'; end if;
  /*
   * And the wildlife is not moved from in here any more.
   *
   * This is a read. It ran `creature_sweep`, which settles every creature in
   * forty tiles whose turn is due — up to a hundred and twenty of them, each
   * one a piece of animal thinking, some of it pathing. On the call a browser
   * makes every second, for every player, while the browser waits for the
   * answer.
   *
   * And `world_tick` already does it. It takes the same list of live bodies,
   * dedupes them onto their tiles, and sweeps forty tiles round each one, once
   * a second, on a clock nobody is waiting for. So this was the same work a
   * second time, on the worst possible thread to do it on: measured here at
   * 257 to 466 ms a call against 2.7 ms for the ground read beside it, which
   * is why an island would hand over a deed in a few seconds and its wildlife
   * not at all — eight PostgREST slots, and this sitting in them.
   *
   * Where there is no `pg_cron` there is no other clock, so it still happens
   * here: the suite's bare postgres and any project without the extension are
   * exactly as they were. The guard is the one `world_tick` already uses for
   * the stocking, for the same reason and with the same shape.
   */
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform creature_sweep(p_world, p.x, p.y, p_range);
  end if;
  -- A cursor is only answered with what changed when the browser says what it holds.
  if p_have is not null then v_snap := private.since_snap(p_since); end if;
  /*
   * One statement, so the cursor handed back is the snapshot the rows were read in: a row written after it is
   * newer than the cursor and goes in the next answer, and none is ever counted as seen that was not.
   */
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'species', c.species, 'name', c.name, 'variant', c.variant,
      'mode', c.mode, 'stance', c.stance, 'job', c.job, 'shod', shod(c), 'tacked', c.tacked, 'tack', c.tack, 'tack_enchant', c.tack_enchant,
      'x', creature_x(c), 'y', creature_y(c),
      'fromX', c.from_x, 'fromY', c.from_y, 'toX', c.to_x, 'toY', c.to_y,
      /*
       * How long the leg is and how much of it is left, in seconds.
       *
       * It used to hand over the two instants themselves, which asks a browser
       * to agree with this database about what time it is. A phone whose clock
       * is twenty seconds out pins every leg at one end or the other and then
       * re-pins it on the next answer, which reads as a thing jumping about —
       * and the action bar learnt this lesson already: "a browser whose clock
       * is a minute out still draws the right bar".
       */
      'legFor', case when c.leg_ends > c.leg_at
                     then extract(epoch from (c.leg_ends - c.leg_at)) else 0 end,
      'legLeft', greatest(0, extract(epoch from (c.leg_ends - now()))),
      'health', c.health, 'max', max_health(c), 'hunger', c.hunger,
      'sex', c.sex, 'age', age_of(c.born, old_of(c), age_pace(c)), 'traits', c.traits,
      'hunting', c.hunting = me, 'mine', coalesce(c.keeper = me, false), 'ridden', coalesce(c.rider = me, false), 'rider', c.rider,
      -- How long is left of a heavy blow it is drawing back for, so it can be seen coming.
      'windup', case when c.windup_at > now() then extract(epoch from (c.windup_at - now())) end,
      -- And how long is left of a stun on it (`enchant_stun`), for the target panel.
      -- (Asked of a creature only while anything on the island is stunned at all, once an answer.)
      'stunned', case when exists (select 1 from class_mark m where m.world_id = p_world and m.kind = 'stun' and m.until > now())
                      then stun_left(p_world, c.id) end,
      -- And how long is left of a slow on it, and the share of its pace it goes at (`enchant_frost`, a Hamstring's, a Binder's).
      'slowed', case when c.slow_until > now() and coalesce(c.slow, 1) < 1 then extract(epoch from (c.slow_until - now())) end,
      'slowPace', case when c.slow_until > now() and coalesce(c.slow, 1) < 1 then c.slow end,
      -- Which one leads the pack it hunts with, which the browser says of the leader.
      'lead', c.pack_lead,
      -- And the tame one it has turned on, when it has.
      'brawl', c.brawl,
      -- What its keeper's perks make of keeping it, which the browser ages and feeds it by.
      'kept', c.kept,
      -- Which vehicle it is in the traces of, which no browser has ever been told.
      'hitchedTo', c.hitched_to)
      -- And the storey its rider rides it on, up a wide staircase (`Game.rideRule`).
      || case when c.rider is null and c.storey = 0 and c.storey_from = 0 and c.way is null then '{}'::jsonb
              when c.rider is null then jsonb_build_object('storey', c.storey, 'storeyFrom', c.storey_from, 'way', c.way)
              else jsonb_build_object('storey', (select greatest(0, r.level) from player r where r.world_id = p_world and r.uid = c.rider)) end
      /*
       * And, for your own only, what the card has been making up.
       *
       * A worker's trade, its learning, its brushing and what is in its arms
       * are all here and none of them have ever gone out, so the browser
       * filled them in from the book: every wildermon on an island read
       * Foraging 1.00, Experience 0.0, Care 0% and "Looking for work", however
       * long it had been at it. Yours only, because it is a card you open
       * about your own and nobody needs five numbers about a wild boar.
       */
      || case when c.keeper = me then jsonb_build_object(
           'care', c.care, 'xp', c.xp, 'skills', c.skills,
           -- What a meal is putting on its learning, and the seconds of it left (`beast_fed`).
           'fed', case when c.fed_until > now() then c.fed_bonus end,
           'fedLeft', case when c.fed_until > now() then extract(epoch from (c.fed_until - now())) end,
           'phase', c.phase, 'carrying', c.carrying,
           -- When its ability's rest runs out, which moves at each use of it: the browser plays it as it is used.
           'cast', (select extract(epoch from m.until) from class_mark m
                     where m.world_id = p_world and m.creature_id = c.id and m.kind = 'ability'),
           -- How much fleece has grown back, for Shear and Milk to read before they ask.
           'fleece', c.fleece,
           -- What ancient pots have put into its base stats, which its card says beside each.
           'boosts', c.boosts,
           -- The wildermon gear on it, its QL and damage a slot (`gear_sent`).
           'gear', gear_sent(c.gear),
           -- When her young are due, in seconds from now: null when she carries none.
           'dueIn', case when c.due > now() then extract(epoch from c.due - now()) end,
           -- What it is fighting, for the line drawn to it.
           'enemy', c.enemy)
         else '{}'::jsonb end
      -- And a wild one's skills, which are its level and so its stage (`wild_stage_put`).
      || case when c.keeper is distinct from me then jsonb_build_object('skills', c.skills) else '{}'::jsonb end
      /*
       * And its pedigree, for anything bred: whole for your own, and for
       * anybody else's saying where a trait came from only for the traits
       * you can read, by the rule the card's chips keep.
       */
      || case when c.pedigree is null then '{}'::jsonb
              when c.keeper = me then jsonb_build_object('pedigree', c.pedigree)
              else jsonb_build_object('pedigree', pedigree_seen(p_world, me, c.pedigree)) end
      -- And how rare it came into the world, for a rare one: the browser draws it bigger and shining, and reckons with it.
      || case when c.rare is null then '{}'::jsonb else jsonb_build_object('rare', c.rare) end
      -- And its wild forms (`formColour`, `formSize`), which the browser draws and its card names.
      || case when c.form_colour or c.form_size is not null
              then jsonb_build_object('formColour', c.form_colour, 'formSize', c.form_size) else '{}'::jsonb end
      -- And its lifetime at work, for its keeper, without the island's own clock (`work_stats`).
      || case when c.keeper = me and c.work_stats is not null then jsonb_build_object('work', c.work_stats - 'at') else '{}'::jsonb end
      /*
       * Why a worker is standing about, as its card says it (`idleSays`). One
       * whose turn is long overdue is one the clock is not settling at all:
       * its keeper is away, or nobody awake is near enough (`sweep_reach`).
       */
      || case when c.mode <> 'deed' then '{}'::jsonb
              when c.until < now() - make_interval(secs => idle_stale()) then jsonb_build_object(
                'idleWhy', case when exists (select 1 from player k where k.world_id = p_world and k.uid = c.keeper
                                               and not k.away and k.seen_at > now() - make_interval(secs => idle_logout()))
                                then 'unswept' else 'away' end,
                'idleN', sweep_reach(), 'idlePost', c.post is not null)
              -- Resting: in its bed while it lies in it, and the seconds left (`idleSays`); or on its way to a bed.
              when c.phase = 'rest' then jsonb_build_object(
                'idleWhy', case when exists (select 1 from placed b where b.id = c.bed and b.sleeper = c.id) then 'bed' else 'rest' end,
                'idleN', greatest(0, extract(epoch from c.until - now())), 'idlePost', c.post is not null,
                'idleBed', (select b.sub from placed b where b.id = c.bed and b.sleeper = c.id))
              when c.phase = 'bed' then jsonb_build_object('idleWhy', 'tired', 'idleN', 0, 'idlePost', c.post is not null,
                'idleBed', (select b.sub from placed b where b.id = c.bed))
              else jsonb_build_object('idleWhy', c.idle_why, 'idleN', c.idle_n, 'idlePost', c.post is not null,
                'idleWhat', case when c.idle_why = 'stock' then to_jsonb(c.idle_what) end) end
      -- What is in its panniers, to whoever they open for (`pannier_sent`): only a kept one of a kind that carries any
      -- can have them open to anybody (`pannier_shut`), so nothing else is asked, which was half of this read.
      || case when c.keeper is not null and c.species = any (array(select d.id from species_def d where d.panniers is not null))
              then pannier_sent(p_world, me, c) else '{}'::jsonb end
      -- The work post it works out of, to anybody: the post is in the open.
      || case when c.post is null then '{}'::jsonb else jsonb_build_object('post', c.post) end
      -- And what it did this island day and the one before, for its keeper.
      || case when c.keeper = me and c.mode = 'deed' then jsonb_build_object('ledger', c.ledger, 'worn', c.worn, 'unfed', c.unfed, 'sparWith', c.spar_with,
           'specialty', coalesce(((select deed_trade_counts(p_world, me))->>coalesce(c.job, (select sd.gathers from species_def sd where sd.id = c.species)))::int, 0))
         else '{}'::jsonb end
      order by c.id) filter (where v_snap is null
        -- One it does not hold, or whose row was written since.
        or not (c.id = any (p_have))
        or private.since_new(c.xmin, v_snap)
        or c.id = any (array(select m.creature_id from class_mark m where m.world_id = p_world and private.since_new(m.xmin, v_snap)))
        -- And those whose answer moves without their row being written.
        or (c.mode = 'deed' and (c.until < now() - make_interval(secs => idle_stale()) or c.phase in ('rest', 'bed')))
        or c.rider is not null
        or (c.keeper is not null and c.species = any (array(select d.id from species_def d where d.panniers is not null)))),
      '[]'::jsonb),
      coalesce(array_agg(c.id), '{}'),
      'v1:' || floor(extract(epoch from now()) * 1000)::bigint || ':' || private.since_text(pg_current_snapshot())
    into v_rows, v_ids, v_at
    from creature c
    -- Your own in crates, wherever the crates are; and everything within range.
    where (c.world_id = p_world and c.keeper = me and c.mode in ('stored', 'deed'))
       or (c.world_id = p_world
      /*
       * Where the leg ends, first, because that is what there is an index on.
       *
       * The exact answer below is where the thing is *now*, which is a point
       * on the leg it is walking and so a function of four columns and the
       * clock — nothing a btree can help with, and it was being worked out for
       * every creature on the island before being thrown away. This narrows to
       * the neighbourhood first, generously: `leg_slack` is far longer than
       * any leg the rules make (the longest measured on a real island is 2.13
       * tiles), and anything walking further than that in one leg was already
       * invisible to `creature_sweep`, which has bounded itself this way since
       * it was written.
       */
      and c.to_x between p.x - (p_range + leg_slack()) and p.x + (p_range + leg_slack())
      and c.to_y between p.y - (p_range + leg_slack()) and p.y + (p_range + leg_slack())
      and greatest(abs(creature_x(c) - p.x), abs(creature_y(c) - p.y)) <= p_range);
  -- A browser that said neither is sent the list it always was.
  if p_since is null and p_have is null then return v_rows; end if;
  return jsonb_build_object('at', v_at, 'rows', v_rows, 'full', v_snap is null,
    'gone', coalesce((select jsonb_agg(h order by h) from unnest(p_have) h where not (h = any (v_ids))), '[]'::jsonb));
end $function$;

select private.lock_doors();
