-- Asked for: "a grace period after death for new players -- no penalty for dying during a character's first 24 hours of
-- playtime (time actually played, not time since sign-up)".
--
--   * `player.played`: seconds a character has played on this island. `body_settle`, which every beat, walk and job
--     already runs, adds the stretch it settles while the body is in the game: not away, heard from (`seen_at`)
--     within `played_gap`, and settled last no further back than that. A tab shut, logged off, asleep in a bed or
--     come back after any of those: nothing. No new work: one more column on an update that is made anyway.
--   * While `played` is under `death_grace` (`death_grace_left`), a death (`player_die`) digs no grave: what was
--     carried stays carried, nothing comes out of the hands or off the belt, and stamina, food and water are not
--     lowered to a death's 50%, 60% and 60%. The body wakes whole on the spawn and is offered where to wake, as after
--     any death, and is told the grace left. Past it, a death is as it was.
--   * The beat says the grace left (`rpc_settle`'s `grace`), for the effects row; the join hands over the row, `played`
--     with it.
--
-- Characters already on an island: past the grace, unless they came ashore under `death_grace` ago by the wall clock,
-- which they cannot have played more than; those start at the time since they came ashore, so never with more grace
-- than they can have had left.
--
-- The browser's numbers and words are `src/game/deathgrace.ts`; supabase/test/deathgrace.ts holds the two together.

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

-- Hours of played time a character dies in without losing anything; the browser's `DEATH_GRACE_HOURS`.
create or replace function public.death_grace_hours() returns double precision language sql immutable as $fn$ select 24::double precision $fn$;
-- The same in seconds, as `played` is counted; `DEATH_GRACE`.
create or replace function public.death_grace() returns double precision language sql immutable as $fn$ select death_grace_hours() * 3600 $fn$;
-- The longest stretch counted as played: two heartbeats; `PLAYED_GAP`.
create or replace function public.played_gap() returns double precision language sql immutable as $fn$ select 120::double precision $fn$;

-- The grace left, as a label: "Death grace: 18 h 20 min of 24 h played left"; the browser's `graceSaid`.
create or replace function public.death_grace_said(p_left double precision) returns text language sql immutable as $fn$
  select 'Death grace: ' || wait_words(p_left) || ' of ' || wait_words(death_grace()) || ' played left'
$fn$;

-- Existing rows past the grace, without a rewrite (a default that is not volatile is kept in the catalogue); new ones at nought.
alter table player add column if not exists played double precision not null default death_grace();
alter table player alter column played set default 0;
-- Ashore under the grace ago: no more played than that.
update player set played = greatest(0, extract(epoch from now() - joined_at))
 where joined_at > now() - make_interval(secs => death_grace());

-- Seconds of the grace left to this body, or null once it is over (or for nobody).
create or replace function public.death_grace_left(p_world uuid, p_uid uuid) returns double precision language sql stable as $fn$
  select death_grace() - p.played from player p
   where p.world_id = p_world and p.uid = p_uid and p.played < death_grace()
$fn$;

-- The count: the stretch `body_settle` settles, while the body is in the game.
select pg_temp.patch_fn('public.body_settle(uuid, uuid)'::regprocedure,
  $o$  update player set body_at = now(), swim_at = swim_from, drowned_at = nagged,$o$,
  $n$  update player set body_at = now(), swim_at = swim_from, drowned_at = nagged,
    -- Played time (`death_grace_left`): this stretch, while in the game -- not away, heard from and settled within `played_gap`.
    played = played + case when not p.away and now() - p.seen_at <= make_interval(secs => played_gap())
                                and now() - p.body_at <= make_interval(secs => played_gap()) then secs else 0 end,$n$);

-- A death in the grace: no grave, and nothing lowered.
select pg_temp.patch_fn('public.player_die(uuid, uuid)'::regprocedure,
  $o$declare w world; v_said text;$o$,
  $n$declare w world; v_said text; v_grace double precision;$n$);
select pg_temp.patch_fn('public.player_die(uuid, uuid)'::regprocedure,
  $o$  v_said := bury(p_world, p_uid);$o$,
  $n$  -- Inside the death grace (`death_grace_left`) nothing goes into a grave, and the line says the grace left.
  v_grace := death_grace_left(p_world, p_uid);
  v_said := case when v_grace is null then bury(p_world, p_uid)
                 else 'You have died. ' || death_grace_said(v_grace) || '; nothing lost.' end;$n$);
select pg_temp.patch_fn('public.player_die(uuid, uuid)'::regprocedure,
  $o$      stats = jsonb_build_object('health', 1, 'stamina', 0.5, 'hunger', 0.6, 'thirst', 0.6,$o$,
  $n$      -- And inside the grace, stamina, food and water no lower than they were.
      stats = jsonb_build_object('health', 1,
                                 'stamina', greatest(0.5, case when v_grace is null then 0 else coalesce((stats->>'stamina')::double precision, 1) end),
                                 'hunger', greatest(0.6, case when v_grace is null then 0 else coalesce((stats->>'hunger')::double precision, 1) end),
                                 'thirst', greatest(0.6, case when v_grace is null then 0 else coalesce((stats->>'thirst')::double precision, 1) end),$n$);

-- And the beat says the grace left, for the effects row.
select pg_temp.patch_fn('public.rpc_settle(bigint, uuid, bigint, boolean, jsonb)'::regprocedure,
  $o$    || jsonb_build_object('fallen', respawn_offer(v_world, me))$o$,
  $n$    || jsonb_build_object('fallen', respawn_offer(v_world, me))
    -- Seconds of the death grace left, or null once it is over (`death_grace_left`).
    || jsonb_build_object('grace', death_grace_left(v_world, me))$n$);

select private.lock_doors();
