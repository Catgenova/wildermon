/*
 * Input timing, on the island's watch (20261022195208): a flag, never a
 * refusal and never a penalty.
 *
 * The browser counts its own clicks and keypresses (src/engine/cadence.ts)
 * and, every `watch_input_mins()` while there was any, hands the island one
 * summary through `rpc_input_note`:
 *
 *   clicks, click_ms, click_cv   the longest-kept run of clicks with no gap
 *                                over 10 s: how many intervals, their mean in
 *                                ms, and their spread (standard deviation over
 *                                mean) in parts per thousand;
 *   keys, key_ms, key_cv         the same for keys pressed (held-key repeats
 *                                left out);
 *   mouse, still                 mouse clicks, and those with no pointer
 *                                movement since the click before, at the same
 *                                spot;
 *   synthetic                    clicks and keys not made by the person
 *                                (`isTrusted` false: dispatched by a script).
 *
 * An `input` flag, once a day per body, when any of these holds:
 *
 *   regular clicks  clicks >= watch_input_run() and click_cv <= watch_input_cv();
 *   regular keys    keys >= watch_input_run() and key_cv <= watch_input_cv();
 *   still           mouse >= watch_input_run() and still is at least
 *                   watch_input_still() per thousand of mouse;
 *   synthetic       synthetic >= watch_input_synthetic().
 *
 * One summary per body per `watch_input_mins()` is read; one sooner is
 * dropped. A summary from somebody not on the island is dropped.
 */
set local lock_timeout = '3s';

/** Intervals in a run before its timing counts. */
create or replace function private.watch_input_run() returns int language sql immutable as $fn$ select 40 $fn$;
/** Spread of a run's intervals, parts per thousand of their mean, at or under which it is regular. */
create or replace function private.watch_input_cv() returns int language sql immutable as $fn$ select 30 $fn$;
/** Parts per thousand of mouse clicks with no movement before them that is a flag. */
create or replace function private.watch_input_still() returns int language sql immutable as $fn$ select 950 $fn$;
/** Clicks and keys dispatched by a script that are a flag. */
create or replace function private.watch_input_synthetic() returns int language sql immutable as $fn$ select 10 $fn$;
/** Minutes between the summaries the island reads from one body. */
create or replace function private.watch_input_mins() returns int language sql immutable as $fn$ select 4 $fn$;

revoke all on function private.watch_input_run(), private.watch_input_cv(), private.watch_input_still(),
                        private.watch_input_synthetic(), private.watch_input_mins() from public, anon, authenticated;

create table if not exists private.watch_input (
  world_id uuid not null,
  uid uuid not null,
  at timestamptz not null default now(),
  note jsonb not null default '{}'::jsonb,
  primary key (world_id, uid)
);
alter table private.watch_input enable row level security;
revoke all on table private.watch_input from public, anon, authenticated;

/* A whole number out of the summary, held to 0..p_most; anything else is 0. */
create or replace function private.watch_input_int(p_note jsonb, p_key text, p_most int) returns int
language sql immutable as $fn$
  select case when jsonb_typeof(p_note -> p_key) = 'number'
              then least(greatest(floor((p_note ->> p_key)::numeric), 0), p_most)::int else 0 end
$fn$;

/*
 * One summary, read: kept as the body's last, and an `input` flag when it
 * says one of the four things at the head of this file. Returns whether it was
 * read (false: too soon, or nobody on the island) and whether it raised a flag.
 */
create or replace function private.watch_input_take(p_world uuid, p_uid uuid, p_note jsonb) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v jsonb; v_why text[] := '{}'; v_raised boolean := false;
  v_run int := private.watch_input_run(); v_cv int := private.watch_input_cv();
begin
  if p_uid is null or p_world is null then return jsonb_build_object('read', false); end if;
  if not exists (select 1 from player p where p.world_id = p_world and p.uid = p_uid) then
    return jsonb_build_object('read', false);
  end if;
  v := jsonb_build_object(
    'clicks', private.watch_input_int(p_note, 'clicks', 100000),
    'click_ms', private.watch_input_int(p_note, 'click_ms', 600000),
    'click_cv', private.watch_input_int(p_note, 'click_cv', 100000),
    'keys', private.watch_input_int(p_note, 'keys', 100000),
    'key_ms', private.watch_input_int(p_note, 'key_ms', 600000),
    'key_cv', private.watch_input_int(p_note, 'key_cv', 100000),
    'mouse', private.watch_input_int(p_note, 'mouse', 100000),
    'still', private.watch_input_int(p_note, 'still', 100000),
    'synthetic', private.watch_input_int(p_note, 'synthetic', 100000));
  if (v->>'still')::int > (v->>'mouse')::int then v := v || jsonb_build_object('still', (v->>'mouse')::int); end if;

  insert into private.watch_input as w (world_id, uid, at, note) values (p_world, p_uid, now(), v)
  on conflict (world_id, uid) do update set at = now(), note = excluded.note
   where w.at <= now() - make_interval(mins => private.watch_input_mins());
  if not found then return jsonb_build_object('read', false); end if;

  if (v->>'clicks')::int >= v_run and (v->>'click_cv')::int <= v_cv then v_why := array_append(v_why, 'clicks'); end if;
  if (v->>'keys')::int >= v_run and (v->>'key_cv')::int <= v_cv then v_why := array_append(v_why, 'keys'); end if;
  if (v->>'mouse')::int >= v_run and (v->>'still')::int * 1000 >= private.watch_input_still() * (v->>'mouse')::int then
    v_why := array_append(v_why, 'still');
  end if;
  if (v->>'synthetic')::int >= private.watch_input_synthetic() then v_why := array_append(v_why, 'synthetic'); end if;
  if cardinality(v_why) > 0 then
    v_raised := private.watch_raise(p_world, p_uid, 'input', 'input:' || p_uid::text,
                                    v || jsonb_build_object('why', to_jsonb(v_why)));
  end if;
  return jsonb_build_object('read', true, 'flag', v_raised);
end $fn$;
revoke all on function private.watch_input_take(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function private.watch_input_int(jsonb, text, int) from public, anon, authenticated;

/* The browser's summary of its input timing. Never refuses: what it says is only ever a flag. */
create or replace function public.rpc_input_note(p_world uuid, p_note jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid();
begin
  if me is null or p_note is null or jsonb_typeof(p_note) <> 'object' or octet_length(p_note::text) > 2000 then
    return jsonb_build_object('read', false);
  end if;
  return private.watch_input_take(p_world, me, p_note);
end $function$;

-- Kept as long as the rest of the watch: a body not heard from in 30 days goes.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then return; end if;
  perform cron.schedule('watch-input-keep', '41 0 * * *',
    $job$delete from private.watch_input where at < now() - make_interval(days => private.watch_keep_days())$job$);
exception when others then
  raise notice 'could not wind the input keeping (%)', sqlerrm;
end $$;

select private.lock_doors();
