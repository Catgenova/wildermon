/*
 * Kick, bar, and player reports.
 *
 * ## Kick and bar
 *
 *   rpc_owner_kick(world, uid, seconds)  the body logged off now, as the idle
 *                     log-out does it (away, what it was doing stopped, its
 *                     queue emptied) and off whatever it rode, drove, pulled or
 *                     was aboard; its browser sent `kicked` and gone to the
 *                     sign-in page. `seconds` 0 bars nothing, a number bars for
 *                     that long, null bars until a keeper lifts it; a second
 *                     bar replaces the first. Not on yourself, nor on another
 *                     keeper of the island.
 *   rpc_owner_unbar  lifted.
 *   rpc_barred       the bar's line for whoever asks, about themselves: what
 *                    the sign-in page shows.
 *
 * Where a bar is held, at no cost to a body that is not barred:
 *
 *   `settle(world, uid)`  every door that acts loads the caller's body through
 *                    it first (rpc_move, rpc_act and the rest). For the
 *                    caller's own body only (`p_uid = auth.uid()`), so the
 *                    clock and a keeper settle a barred body as ever. One
 *                    primary-key probe of `private.island_bar`, nearly always
 *                    empty.
 *   `player.away` going false  a kicked body is away, and every way back in
 *                    (rpc_join, a step, an act) writes `away = false`. A trigger
 *                    on that change only -- never on the step that writes false
 *                    over false -- refuses it while the bar holds.
 *   `private.muted_why`  every door that carries words (rpc_say, rpc_letter, a
 *                    parcel's note, an engraving) asks it; a bar answers first.
 *
 * Each refuses with one line, "Barred from this island for 58 minutes more,
 * until 22 Oct 15:05 UTC." (`private.barred_why`), which the browser knows by
 * its first words and goes to the sign-in page on.
 *
 * ## Reports
 *
 *   rpc_report_player(world, uid, reason, note)  anybody with a body about
 *                    anybody else with one: a reason from
 *                    `private.report_reasons()`, a note of at most
 *                    `private.report_note_max()` characters. At most
 *                    `private.reports_a_day()` in any 24 hours, and one about
 *                    the same body. The one reported is not told.
 *   rpc_owner_reports            the open ones, newest first, for a keeper.
 *   rpc_owner_report_handled     one marked handled.
 *
 * Bounded: the limits cap what one body can write, and every report sent
 * deletes what is past keeping -- handled ones after
 * `private.report_handled_days()`, every one after `private.report_open_days()`.
 *
 * Every keeper door writes `private.owner_log`. No browser reads either table.
 */
set local lock_timeout = '3s';

select private.shut($ddl$
  create table if not exists private.island_bar (
    world_id uuid not null references public.world (id) on delete cascade,
    uid uuid not null,
    until timestamptz,
    by_uid uuid not null,
    at timestamptz not null default now(),
    primary key (world_id, uid)
  )
$ddl$);
select private.shut('alter table private.island_bar enable row level security');

select private.shut($ddl$
  create table if not exists private.player_report (
    n bigint generated always as identity primary key,
    world_id uuid not null references public.world (id) on delete cascade,
    at timestamptz not null default now(),
    by_uid uuid not null,
    whom uuid not null,
    reason text not null,
    note text,
    handled_by uuid,
    handled_at timestamptz
  )
$ddl$);
select private.shut('create index if not exists player_report_open on private.player_report (world_id, n) where handled_at is null');
select private.shut('create index if not exists player_report_by on private.player_report (world_id, by_uid, at)');
select private.shut('create index if not exists player_report_at on private.player_report (at)');
select private.shut('alter table private.player_report enable row level security');

revoke all on table private.island_bar, private.player_report from public, anon, authenticated;

/* The numbers, which `src/game/keeper.ts` holds too and supabase/test/kick.ts holds them together. */
create or replace function private.report_reasons() returns text[]
language sql immutable set search_path = '' as $fn$ select array['cheating', 'abuse', 'griefing', 'other'] $fn$;
create or replace function private.report_note_max() returns int
language sql immutable set search_path = '' as $fn$ select 200 $fn$;
create or replace function private.reports_a_day() returns int
language sql immutable set search_path = '' as $fn$ select 5 $fn$;
create or replace function private.report_handled_days() returns int
language sql immutable set search_path = '' as $fn$ select 30 $fn$;
create or replace function private.report_open_days() returns int
language sql immutable set search_path = '' as $fn$ select 90 $fn$;
revoke all on function private.report_reasons(), private.report_note_max(), private.reports_a_day(),
  private.report_handled_days(), private.report_open_days() from public, anon, authenticated;

/* How long a bar lasts, as a line says it: "for 1 hour, until 25 Sep 15:05 UTC", "until a keeper lifts it". */
create or replace function private.bar_span(p_until timestamptz) returns text
language sql stable set search_path = '' as $fn$
  select case when p_until is null then 'until a keeper lifts it'
              else 'for ' || public.time_words(extract(epoch from p_until - now())) || ', ' || private.mute_ends(p_until) end
$fn$;
revoke all on function private.bar_span(timestamptz) from public, anon, authenticated;

/*
 * Why somebody may not use this island's doors: the line every door refuses a
 * barred body with, or null. A bar whose time has passed is no bar; its row is
 * left for the next kick or unbar to replace.
 */
create or replace function private.barred_why(p_world uuid, p_uid uuid) returns text
language plpgsql stable set search_path = '' as $fn$
declare v_until timestamptz;
begin
  select b.until into v_until from private.island_bar b
   where b.world_id = p_world and b.uid = p_uid and (b.until is null or b.until > now());
  if not found then return null; end if;
  return 'Barred from this island '
    || case when v_until is null then 'until a keeper lifts it'
            else 'for ' || public.time_words(extract(epoch from v_until - now())) || ' more, ' || private.mute_ends(v_until) end
    || '.';
end $fn$;
revoke all on function private.barred_why(uuid, uuid) from public, anon, authenticated;

/* A barred body is not heard either: the words doors ask `muted_why`, and a bar answers first. */
do $do$
declare v_def text; v_old text;
begin
  v_def := pg_get_functiondef('private.muted_why(uuid, uuid)'::regprocedure);
  v_old := 'declare v_until timestamptz;
begin
';
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'muted_why: anchor not once'; end if;
  execute replace(v_def, v_old, 'declare v_until timestamptz; v_bar text;
begin
  v_bar := private.barred_why(p_world, p_uid);
  if v_bar is not null then return v_bar; end if;
');
end $do$;

/*
 * `settle`, which every door that acts loads the caller's body through: a
 * barred caller is refused there, before anything of theirs is settled. The
 * probe first, which on an island with nobody barred finds nothing at once;
 * `auth.uid()` only after, so the clock and a keeper settle a barred body.
 * Outside the block that catches a job's faults, so it is raised, not kept.
 */
do $do$
declare v_def text; v_at int;
begin
  v_def := pg_get_functiondef('public.settle(uuid, uuid)'::regprocedure);
  if v_def not like '%perform wounds_settle(p_world, p_uid);%' then raise exception 'settle: not the settle this patches'; end if;
  if v_def like '%private.island_bar%' then return; end if;
  v_at := position(E'\nbegin\n' in v_def);
  if v_at = 0 then raise exception 'settle: no begin'; end if;
  execute overlay(v_def placing E'\nbegin\n'
    || E'  -- Barred from this island by a keeper (`rpc_owner_kick`): the caller''s own body only.\n'
    || E'  if exists (select 1 from private.island_bar b where b.world_id = p_world and b.uid = p_uid\n'
    || E'                and (b.until is null or b.until > now()))\n'
    || E'     and p_uid = auth.uid() then\n'
    || E'    raise exception ''%'', private.barred_why(p_world, p_uid);\n'
    || E'  end if;\n'
    from v_at for length(E'\nbegin\n'));
end $do$;

/*
 * Every way back in writes `away = false` (rpc_join, a step, an act). A kicked
 * body is away, so while it is barred that write is refused. Fires only on the
 * change from away to not, never on the step that writes false over false.
 */
create or replace function private.bar_holds() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare v_why text;
begin
  if new.uid = auth.uid() then
    v_why := private.barred_why(new.world_id, new.uid);
    if v_why is not null then raise exception '%', v_why; end if;
  end if;
  return new;
end $fn$;
revoke all on function private.bar_holds() from public, anon, authenticated;
drop trigger if exists bar_holds on public.player;
create trigger bar_holds before update of away on public.player
  for each row when (old.away and not new.away) execute function private.bar_holds();

/*
 * Logged off now, and barred for `p_seconds` (0: not barred; null: until a
 * keeper lifts it). What was due of its work lands first; the rest of the job
 * and its queue are dropped; it is taken off whatever it rode, drove, pulled or
 * was aboard. It is told who did it and for how long, and its browser is sent
 * `kicked`, which takes it to the sign-in page.
 */
create or replace function public.rpc_owner_kick(p_world uuid, p_uid uuid, p_seconds integer default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid(); p player; q placed; r record; v_here boolean; v_until timestamptz;
        v_verb text; v_queued int; v_off text[] := '{}'; v_span text; v_name text;
begin
  if not private.is_island_owner(p_world, me) then
    raise exception 'only a keeper of this island may do that';
  end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  if not exists (select 1 from player where world_id = p_world and uid = p_uid) then
    return jsonb_build_object('why', 'That person has no body on this island.');
  end if;
  if p_uid = me then return jsonb_build_object('why', 'A keeper cannot kick themselves.'); end if;
  v_name := folk_name(p_world, p_uid);
  if private.is_island_owner(p_world, p_uid) then
    return jsonb_build_object('why', v_name || ' keeps this island: a keeper cannot be kicked.');
  end if;
  if p_seconds is not null and p_seconds < 0 then
    return jsonb_build_object('why', 'A bar lasts 0 or more seconds, or until it is lifted.');
  end if;

  v_here := private.here(p_world, p_uid);
  -- What is due is done. Stopping is for what is still in their hands.
  perform settle(p_world, p_uid);
  select * into p from player where world_id = p_world and uid = p_uid for update;
  select a.verb into v_verb from action_def a where a.id = p.act;
  v_queued := coalesce(jsonb_array_length(p.act_queue), 0);

  -- Off whatever they were on. What they were on stays where it is.
  for r in update creature set rider = null where world_id = p_world and rider = p_uid returning name loop
    v_off := v_off || ('riding ' || r.name);
  end loop;
  for q in update placed set driver = null where world_id = p_world and driver = p_uid returning * loop
    v_off := v_off || ('driving the ' || lower(placed_name(q)));
  end loop;
  for q in update placed set puller = null where world_id = p_world and puller = p_uid returning * loop
    v_off := v_off || ('pulling the ' || lower(placed_name(q)));
  end loop;
  if p.aboard is not null then
    select * into q from placed where id = p.aboard;
    if found then v_off := v_off || ('aboard the ' || lower(placed_name(q))); end if;
  end if;

  -- Logged off, as the idle log-out does it.
  update player set away = true, left_at = now(), aboard = null, seat = null,
         act = null, act_target = null, act_started = null, act_ends = null, act_left = null,
         act_goes = null, act_queue = '[]'::jsonb
   where world_id = p_world and uid = p_uid;

  if p_seconds is null or p_seconds > 0 then
    v_until := case when p_seconds is not null then now() + make_interval(secs => p_seconds) end;
    insert into private.island_bar (world_id, uid, until, by_uid, at)
    values (p_world, p_uid, v_until, me, now())
    on conflict (world_id, uid) do update set until = excluded.until, by_uid = excluded.by_uid, at = excluded.at;
    v_span := private.bar_span(v_until);
  end if;

  perform tell(p_world, p_uid, folk_name(p_world, me) || ', who keeps this island, has logged you off'
    || case when v_span is not null then ' and barred you ' || v_span else '' end || '.', 'system');
  perform tell(p_world, me, 'You log ' || v_name || ' off'
    || case when v_span is not null then ' and bar them ' || v_span else '' end || '.'
    || case when private.move_stops(v_verb, v_queued, false) <> '' then ' ' || private.move_stops(v_verb, v_queued, false) else '' end
    || case when cardinality(v_off) > 0 then ' They are no longer ' || array_to_string(v_off, ' or ') || '.' else '' end,
    'system');
  -- And the browser, which leaves for the sign-in page.
  if v_here then
    perform private.send('own:' || p_world || ':' || p_uid, 'kicked', jsonb_build_object('barred', v_span is not null));
  end if;
  perform private.owner_note(me, p_world, 'kick', p_uid, jsonb_build_object(
    'secs', p_seconds, 'until', v_until, 'barred', v_span is not null, 'was_here', v_here,
    'stopped', p.act, 'queued', v_queued, 'off', to_jsonb(v_off)));
  return jsonb_build_object('kicked', true, 'barred', v_span is not null, 'secs', p_seconds, 'until', v_until,
    'stopped', p.act, 'queued', v_queued, 'off', to_jsonb(v_off));
end $function$;

/* The bar lifted, and said so to the one it was on. */
create or replace function public.rpc_owner_unbar(p_world uuid, p_uid uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid(); v_until timestamptz; v_live boolean;
begin
  if not private.is_island_owner(p_world, me) then
    raise exception 'only a keeper of this island may do that';
  end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  delete from private.island_bar b where b.world_id = p_world and b.uid = p_uid
    returning b.until, (b.until is null or b.until > now()) into v_until, v_live;
  if not found or not v_live then
    return jsonb_build_object('why', folk_name(p_world, p_uid) || ' is not barred.');
  end if;
  perform tell(p_world, p_uid, folk_name(p_world, me) || ', who keeps this island, has lifted your bar.', 'system');
  perform tell(p_world, me, 'You lift ' || folk_name(p_world, p_uid) || '''s bar.', 'system');
  perform private.owner_note(me, p_world, 'unbar', p_uid, jsonb_build_object('until', v_until));
  return jsonb_build_object('barred', false);
end $function$;

/*
 * Whether you are barred from this island, in the line the doors refuse you
 * with; null when you are not. The one door a barred body may use: the sign-in
 * page asks it after a kick.
 */
create or replace function public.rpc_barred(p_world uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  return jsonb_build_object('line', private.barred_why(p_world, me));
end $function$;

/*
 * A report about somebody on this island, to its keepers. The one reported is
 * not told. Words cleaned as a letter's are, and cut at the most a note keeps.
 */
create or replace function public.rpc_report_player(p_world uuid, p_uid uuid, p_reason text, p_note text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid(); v_note text; v_why text; v_sent int; v_first timestamptz; v_n bigint;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  if not exists (select 1 from player where world_id = p_world and uid = me) then
    raise exception 'you are not on this island';
  end if;
  v_why := private.barred_why(p_world, me);
  if v_why is not null then raise exception '%', v_why; end if;
  if p_uid is null or p_uid = me then return jsonb_build_object('why', 'You cannot report yourself.'); end if;
  if not exists (select 1 from player where world_id = p_world and uid = p_uid) then
    return jsonb_build_object('why', 'That person has no body on this island.');
  end if;
  if p_reason is null or not (p_reason = any (private.report_reasons())) then
    return jsonb_build_object('why', 'Reason: ' || array_to_string(private.report_reasons(), ', ') || '.');
  end if;
  v_note := btrim(regexp_replace(
    regexp_replace(coalesce(p_note, ''), '[\r\n\t]+', ' ', 'g'), '\s{2,}', ' ', 'g'));
  v_note := nullif(left(v_note, private.report_note_max()), '');

  select count(*), min(r.at) into v_sent, v_first from private.player_report r
   where r.world_id = p_world and r.by_uid = me and r.at > now() - interval '1 day';
  if v_sent >= private.reports_a_day() then
    return jsonb_build_object('why', 'Report limit: ' || private.reports_a_day() || ' in 24 hours. Next in '
      || time_words(extract(epoch from v_first + interval '1 day' - now())) || '.');
  end if;
  select max(r.at) into v_first from private.player_report r
   where r.world_id = p_world and r.by_uid = me and r.whom = p_uid and r.at > now() - interval '1 day';
  if v_first is not null then
    return jsonb_build_object('why', 'Already reported ' || folk_name(p_world, p_uid) || ' in the last 24 hours. Next in '
      || time_words(extract(epoch from v_first + interval '1 day' - now())) || '.');
  end if;

  -- What is past keeping goes as the next one comes.
  delete from private.player_report r
   where r.at < now() - make_interval(days => private.report_handled_days())
     and (r.handled_at is not null or r.at < now() - make_interval(days => private.report_open_days()));
  insert into private.player_report (world_id, by_uid, whom, reason, note)
  values (p_world, me, p_uid, p_reason, v_note) returning n into v_n;
  return jsonb_build_object('reported', true, 'n', v_n);
end $function$;

/*
 * The open reports, newest first, at most a hundred: who sent each, about
 * whom, why, the note, how long ago, and how many are open on the same body.
 */
create or replace function public.rpc_owner_reports(p_world uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid(); v jsonb;
begin
  if not private.is_island_owner(p_world, me) then
    raise exception 'only a keeper of this island may do that';
  end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'n', r.n,
           'ago', greatest(0, floor(extract(epoch from now() - r.at)))::bigint,
           'by', jsonb_build_object('uid', r.by_uid, 'name', folk_name(p_world, r.by_uid)),
           'whom', jsonb_build_object('uid', r.whom, 'name', folk_name(p_world, r.whom)),
           'reason', r.reason, 'note', r.note, 'against', r.against)
         order by r.n desc), '[]'::jsonb)
    into v
    from (select o.*, count(*) over (partition by o.whom) as against from private.player_report o
           where o.world_id = p_world and o.handled_at is null
           order by o.n desc limit 100) r;
  return jsonb_build_object('reports', v);
end $function$;

/* A report off the open list. The one who sent it is not told. */
create or replace function public.rpc_owner_report_handled(p_world uuid, p_n bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid(); r private.player_report;
begin
  if not private.is_island_owner(p_world, me) then
    raise exception 'only a keeper of this island may do that';
  end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  update private.player_report o set handled_by = me, handled_at = now()
   where o.world_id = p_world and o.n = p_n and o.handled_at is null
  returning * into r;
  if not found then return jsonb_build_object('why', 'That report is not open.'); end if;
  perform private.owner_note(me, p_world, 'handled', r.whom, jsonb_build_object(
    'report', r.n, 'by', r.by_uid, 'reason', r.reason, 'at', r.at));
  return jsonb_build_object('handled', true);
end $function$;

/* Who is on, with who is barred and for how much longer (`barred_for` null for until lifted). */
do $do$
declare v_def text; v_old text; v_new text;
begin
  v_def := pg_get_functiondef('public.rpc_owner_online(uuid)'::regprocedure);
  v_old := $q$           'muted_for', case when m.until is not null then ceil(extract(epoch from m.until - now()))::bigint end,
$q$;
  v_new := v_old || $q$           'barred', b.uid is not null,
           'barred_for', case when b.until is not null then ceil(extract(epoch from b.until - now()))::bigint end,
$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'rpc_owner_online: field anchor not once'; end if;
  v_def := replace(v_def, v_old, v_new);
  v_old := $q$    left join deed d on d.world_id = p.world_id and d.founded_by = p.uid
$q$;
  v_new := $q$    left join private.island_bar b on b.world_id = p.world_id and b.uid = p.uid
                                  and (b.until is null or b.until > now())
$q$ || v_old;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'rpc_owner_online: join anchor not once'; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();
