-- Tracking: a skill, and a go of Track from a kind's page in the field guide that reads the way to the nearest wild one.
--
-- Asked for: "Add a tracking skill. Players can click a Track button in the field guide to cast a tracking action. The
-- action directs towards the nearest of that species, with directions becoming more accurate and specific with a higher
-- tracking level. Can only track discovered wildermon".
--
-- The skill (`tracking`), the job (`track`, in `action_def`), and every number the rule reads come over in the defs
-- (`tracking.ts`: `track_range`, `track_err`, `track_band` and the band table, `track_far`, `track_point`). Here:
--
--   * `track_refusal`: a wildermon, not a monster, whose kind has a row in your `guide` (seen), and nothing else;
--   * `track_reading`: the true bearing put off by a roll taken evenly over `track_err` degrees either way, said to
--     the band's points of the compass (or the degree), and the distance far off or not, or rounded to the band's step
--     and never below it -- the browser's `trackReading`, step for step;
--   * `track_said`: what the log says, the browser's `trackSaid` word for word;
--   * `perform_track`: the nearest wild one of the kind, any stage, within `track_range` of where you stand, nearer
--     first and the lower id on a tie; kept ones are never tracked. The roll is the island's `random()`. It says the
--     line, hands your browser the arrow as a `tracked` line (`{"name","bearing","far","tiles"}`, put on the screen
--     rather than in the log, as a `charted` line is), and trains Tracking by a go, or by `try_learn` of one when there
--     was no sign in range;
--   * the three dispatchers (`act_ported`, `act_refusal_rules`, `act_perform`) taught the family, beside the swirls;
--   * and an index on the wild ones of each kind, so that the search reads one kind's wild rows and not the island's.
--     Measured on a 4096-tile island with 20,000 wild ones of 91 kinds: 3.5 ms through `creature_by_world` (every wild
--     row of the island, filtered), 0.45 ms through this one (the 218 of the kind).

set local lock_timeout = '3s';

create index if not exists creature_wild_kind on creature (world_id, species) where mode = 'wild';

/* ---- The rule ------------------------------------------------------------------------------------------------- */

-- The level a track is read at: the whole level below your Tracking, as the browser's `trackLevel`.
create or replace function track_level(p_skill double precision) returns int language sql immutable as $fn$
  select floor(greatest(0, least(skill_top(), p_skill)))::int
$fn$;

-- Degrees put into [0, 360), the same sum as the browser's.
create or replace function track_turn(p_deg double precision) returns double precision language sql immutable as $fn$
  select p_deg - 360 * floor(p_deg / 360)
$fn$;

-- The true bearing from one point to another, clockwise from north: north is up the map, y falling (`bearingTo`).
create or replace function track_bearing(p_fx double precision, p_fy double precision, p_tx double precision, p_ty double precision)
returns double precision language sql immutable as $fn$
  select track_turn(atan2(p_tx - p_fx, -(p_ty - p_fy)) * 180 / pi())
$fn$;

/*
 * What a track reads, from the true bearing and distance and a roll in [0, 1): the browser's `trackReading`. The
 * halves go up (`floor(x + 0.5)`), as `Math.floor(x + 0.5)` has them; `round` here would go to the even.
 */
create or replace function track_reading(p_level int, p_bearing double precision, p_dist double precision, p_roll double precision)
returns jsonb language plpgsql immutable as $fn$
declare v_band int := track_band(p_level); v_points int; v_step double precision; v_read double precision; v_i int; v_round int;
begin
  v_points := track_points(v_band);
  v_round := track_round(v_band);
  v_read := track_turn(p_bearing + (2 * p_roll - 1) * track_err(p_level));
  v_step := 360::double precision / v_points;
  v_i := floor(v_read / v_step + 0.5)::int % v_points;
  return jsonb_build_object(
    'band', v_band,
    'way', case when v_points = 360 then 'bearing ' || v_i || '°' else track_point(v_points, v_i) end,
    'bearing', v_i * v_step,
    'far', p_dist > track_far(),
    'tiles', case when v_round is null then null else greatest(v_round, floor(p_dist / v_round + 0.5)::int * v_round) end);
end $fn$;

-- How far a reading says: "far off", "not far off", "about 120 tiles" (`trackDistSays`).
create or replace function track_dist_says(p_reading jsonb) returns text language sql immutable as $fn$
  select case when p_reading->'tiles' is null or jsonb_typeof(p_reading->'tiles') = 'null'
              then case when (p_reading->>'far')::boolean then 'far off' else 'not far off' end
              else 'about ' || (p_reading->>'tiles') || ' tiles' end
$fn$;

/*
 * What a finished track says, for a kind (its own name) and what was found of it -- what it is called at its stage,
 * its level, whether it is on the move, and the reading -- or the no-sign line when the reading is null. The
 * browser's `trackSaid`, word for word.
 */
create or replace function track_said(p_kind text, p_range int, p_stage text, p_level int, p_moving boolean, p_reading jsonb)
returns text language plpgsql immutable as $fn$
declare v_band int; v_name text;
begin
  if p_reading is null then
    return 'You find no sign of ' || article(p_kind) || ' ' || p_kind || ' within ' || p_range || ' tiles.';
  end if;
  v_band := (p_reading->>'band')::int;
  v_name := case when track_stage(v_band) then p_stage else p_kind end;
  if track_detail(v_band) then
    return 'Fresh tracks: ' || article(v_name) || ' ' || v_name || ', level ' || p_level || ', ' || (p_reading->>'way') || ', '
      || track_dist_says(p_reading) || ', ' || case when p_moving then 'on the move' else 'standing still' end || '.';
  end if;
  if track_round(v_band) is null then
    return 'You pick up the trail of ' || article(v_name) || ' ' || v_name || ': somewhere to the ' || (p_reading->>'way') || ', '
      || track_dist_says(p_reading) || '.';
  end if;
  return 'Tracks of ' || article(v_name) || ' ' || v_name || ' lead ' || (p_reading->>'way') || ', ' || track_dist_says(p_reading) || '.';
end $fn$;

/* ---- The job -------------------------------------------------------------------------------------------------- */

-- Why a kind cannot be tracked, or null when it can: the browser's `trackRefusal`, in the same words and order.
create or replace function track_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
  language plpgsql stable as $fn$
declare sd species_def;
begin
  select * into sd from species_def d where d.id = p_target->>'species';
  if sd.id is null then return 'There is no such kind to track.'; end if;
  if sd.monster then
    return upper(left(article(sd.name), 1)) || substr(article(sd.name), 2) || ' ' || sd.name || ' is no wildermon, and leaves no trail you can read.';
  end if;
  if not exists (select 1 from guide g where g.world_id = p_world and g.uid = p_uid and g.species = sd.id) then
    return 'You have not seen ' || article(sd.name) || ' ' || sd.name || ' yet. Only a kind marked seen in your field guide can be tracked.';
  end if;
  return null;
end $fn$;

/*
 * A go of Track: the nearest wild one of the kind within reach, read and said, its arrow handed to your browser, and
 * a go of Tracking -- `try_learn` of one when there was no sign of one. Asked again first, as every family's go is.
 */
create or replace function perform_track(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns void
  language plpgsql as $fn$
declare v_why text; sd species_def; p player; v_level int; v_range int; v_id int; v_d double precision; c creature;
        v_r jsonb; v_stage int; v_name text; v_moving boolean;
begin
  v_why := track_refusal(p_world, p_uid, p_action, p_target);
  if v_why is not null then
    perform tell(p_world, p_uid, v_why, 'error');
    return;
  end if;
  select * into sd from species_def d where d.id = p_target->>'species';
  select * into p from player pl where pl.world_id = p_world and pl.uid = p_uid;
  v_level := track_level(skill_of(p_world, p_uid, tracking_skill()));
  v_range := track_range(v_level);
  -- One kind's wild rows (`creature_wild_kind`), where each is now along its leg.
  select w.id, w.d into v_id, v_d from (
    select c0.id, sqrt(power(creature_x(c0) - p.x, 2) + power(creature_y(c0) - p.y, 2)) as d
      from creature c0 where c0.world_id = p_world and c0.mode = 'wild' and c0.species = sd.id) w
   where w.d <= v_range order by w.d, w.id limit 1;
  if v_id is null then
    perform tell(p_world, p_uid, track_said(sd.name, v_range, null, null, null, null), 'event');
    perform skill_raise(p_world, p_uid, tracking_skill(), try_gain(false));
    return;
  end if;
  select * into c from creature c0 where c0.world_id = p_world and c0.id = v_id;
  v_r := track_reading(v_level, track_bearing(p.x, p.y, creature_x(c), creature_y(c)), v_d, random());
  v_stage := stage_of(c);
  v_name := case when v_stage > 0 and sd.stages is not null then sd.stages[v_stage] else sd.name end;
  v_moving := c.leg_ends > now() and (c.from_x <> c.to_x or c.from_y <> c.to_y);
  perform tell(p_world, p_uid, track_said(sd.name, v_range, v_name, creature_level(c.skills), v_moving, v_r), 'event');
  -- The arrow, for the screen: labelled with what the line called it, pointing the way it read.
  perform tell(p_world, p_uid, jsonb_build_object(
    'name', case when track_stage((v_r->>'band')::int) then v_name else sd.name end,
    'bearing', v_r->'bearing', 'far', v_r->'far', 'tiles', v_r->'tiles')::text, 'tracked');
  perform skill_raise(p_world, p_uid, tracking_skill(), try_gain(true));
end $fn$;

/* ---- Where the rest of the island hears of it ------------------------------------------------------------------ */

do $do$
declare v_def text; v_old text; v_new text; v_fn text; v_n int;
begin
  for v_fn, v_old, v_new in values
    ('act_ported',
     $$      or swirl_action(p_action)
$$,
     $$      or swirl_action(p_action)
      -- Reading a trail from the field guide (`tracking.ts`).
      or track_action(p_action)
$$),
    ('act_refusal_rules',
     $$  if swirl_action(p_action) then
    return swirl_refusal(p_world, p_uid, p_action, p_target);
  end if;
$$,
     $$  if swirl_action(p_action) then
    return swirl_refusal(p_world, p_uid, p_action, p_target);
  end if;
  -- And a track, which asks only that the kind is a wildermon in your field guide (`tracking.ts`).
  if track_action(p_action) then
    return track_refusal(p_world, p_uid, p_action, p_target);
  end if;
$$),
    ('act_perform',
     $$  if swirl_action(p_action) then
    perform perform_swirl(p_world, p_uid, p_action, p_target);
    return;
  end if;
$$,
     $$  if swirl_action(p_action) then
    perform perform_swirl(p_world, p_uid, p_action, p_target);
    return;
  end if;
  -- Reading a trail from the field guide (`tracking.ts`).
  if track_action(p_action) then
    perform perform_track(p_world, p_uid, p_action, p_target);
    return;
  end if;
$$)
  loop
    select pg_get_functiondef(f.oid) into v_def from pg_proc f join pg_namespace s on s.oid = f.pronamespace
     where s.nspname = 'public' and f.proname = v_fn;
    if v_def is null then raise exception '% is not there', v_fn; end if;
    v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    if v_n <> 1 then raise exception '% has % of the swirl branch, not 1', v_fn, v_n; end if;
    execute replace(v_def, v_old, v_new);
  end loop;
end $do$;

select private.lock_doors();
