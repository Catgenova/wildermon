-- Awareness: more uses, more sources, a start at 20.
--
-- Asked for, from the review of Awareness: "1 add those [uses], 2 add those [sources], 3 start at 20, 4 keep [the
-- curve], 5 add both [Skills window line and Help numbers]".
--
-- Uses, one share for every level over the starting mark (`aware_share`, `Game.awareShare`: `aware_per_level` a
-- level, a tenth at 100):
--   * a hunter notices you from that much closer (`aware_notice`, in `hunt_settle` beside the Shadowcloak's);
--   * a track reaches that much further, in whole tiles (`perform_track`, `trackReach`);
--   * a swing or a shot lands that much more often × darkness, over `night_eyes_from` or below ground, inside the
--     ceiling (`hit_chance`, `hitChance`);
--   * a trait reads on one level less animal husbandry for every `aware_trait_step` levels, never below 0
--     (`blood_seen`, `traitReadNeeds`).
-- Sources (`char_told`), each × darkness and nothing at or under `night_eyes_from` but the track's:
--   * every tile walked on your own feet in the dark, `dark_walk` (`rpc_move`);
--   * every go of Forage and of fishing, rod or net, in the dark, `dark_work` (`perform_gather`, `perform_fish`);
--   * every go of Track, at any hour, `track_aware` (`perform_track`).
-- The start is the defs' (`skill_def`); every awareness under it is raised to it here.

set local lock_timeout = '3s';

create or replace function aware_share(p_world uuid, p_uid uuid) returns double precision
language sql stable as $fn$
  select greatest(0, skill_of(p_world, p_uid, 'awareness') - char_start()) * aware_per_level()
$fn$;

create or replace function aware_notice(p_world uuid, p_uid uuid) returns double precision
language sql stable as $fn$ select 1 - aware_share(p_world, p_uid) $fn$;

-- Darkness as awareness reads it (`Game.awareDark`): 1 below ground, 0 at or under `night_eyes_from`.
create or replace function aware_dark(p_world uuid, p_uid uuid) returns double precision
language sql stable as $fn$
  select case when q.d > night_eyes_from() then q.d else 0 end
    from (select case when exists (select 1 from player pl where pl.world_id = p_world and pl.uid = p_uid and pl.level < 0) then 1
                      else coalesce(darkness(p_world), 0) end as d) q
$fn$;

create or replace function aware_trait_ease(p_world uuid, p_uid uuid) returns double precision
language sql stable as $fn$
  select greatest(0, floor((skill_of(p_world, p_uid, 'awareness') - char_start()) / aware_trait_step()))
$fn$;

-- A go of awareness × darkness as it reads it, and none in the light.
create or replace function aware_dark_told(p_world uuid, p_uid uuid, p_base double precision) returns void
language plpgsql as $fn$
declare dark double precision := aware_dark(p_world, p_uid);
begin
  if dark > 0 then perform char_told(p_world, p_uid, 'awareness', p_base * dark); end if;
end $fn$;

do $do$
declare v_def text; v_old text; v_new text;
begin
  -- A hunter notices you from closer.
  v_def := pg_get_functiondef('hunt_settle(uuid, creature, species_def, age_def)'::regprocedure);
  v_old := $q$least(coalesce(d.notice, hunt_sight()) * enchant_shadow(p_world, p.uid), faith_shroud(p_world, p.uid))$q$;
  v_new := $q$least(coalesce(d.notice, hunt_sight()) * enchant_shadow(p_world, p.uid) * aware_notice(p_world, p.uid), faith_shroud(p_world, p.uid))$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'hunt_settle: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  -- A swing or a shot in the dark lands more often, inside the ceiling.
  v_def := pg_get_functiondef('hit_chance(uuid, uuid, text, double precision)'::regprocedure);
  v_old := $q$    * coalesce(p_aim, 1))$q$;
  v_new := $q$    * coalesce(p_aim, 1)
    -- And awareness in the dark (`aware_dark`), inside the ceiling too.
    + aware_share(p_world, p_uid) * aware_dark(p_world, p_uid))$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'hit_chance: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  -- A track reaches further, and every go of it teaches awareness.
  v_def := pg_get_functiondef('perform_track'::regproc);
  v_old := $q$v_range := track_range(v_level);$q$;
  v_new := $q$v_range := floor(track_range(v_level) * (1 + aware_share(p_world, p_uid)))::int;$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_track: range anchor not once'; end if;
  v_def := replace(v_def, v_old, v_new);
  v_old := $q$perform skill_raise(p_world, p_uid, tracking_skill(), try_gain(false));$q$;
  v_new := $q$perform skill_raise(p_world, p_uid, tracking_skill(), try_gain(false));
    perform char_told(p_world, p_uid, 'awareness', track_aware());$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_track: none anchor not once'; end if;
  v_def := replace(v_def, v_old, v_new);
  v_old := $q$perform skill_raise(p_world, p_uid, tracking_skill(), try_gain(true));$q$;
  v_new := $q$perform skill_raise(p_world, p_uid, tracking_skill(), try_gain(true));
  perform char_told(p_world, p_uid, 'awareness', track_aware());$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_track: found anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  -- A trait reads on less husbandry.
  v_def := pg_get_functiondef('blood_seen'::regproc);
  v_old := $q$skill_of(p_world, p_uid, 'animal_husbandry') >= 1 + o.level$q$;
  v_new := $q$skill_of(p_world, p_uid, 'animal_husbandry') >= greatest(0, 1 + o.level - aware_trait_ease(p_world, p_uid))$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'blood_seen: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  -- Every tile walked on your own feet in the dark, below ground or up a storey too.
  v_def := pg_get_functiondef('rpc_move'::regproc);
  v_old := $q$  if cart.id is not null and p_level = 0 and p.level = 0 then
$q$;
  v_new := $q$  -- And awareness, a go of `dark_walk` × darkness for every tile your own feet went into (`aware_dark_told`).
  if cart.id is null and beast.id is null then
    v_tiles := least(20, abs(floor(p_x) - floor(p.x)) + abs(floor(p_y) - floor(p.y)))::int;
    for i in 1 .. v_tiles loop
      perform aware_dark_told(p_world, me, dark_walk());
    end loop;
  end if;
  if cart.id is not null and p_level = 0 and p.level = 0 then
$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'rpc_move: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  -- Every go of Forage in the dark.
  v_def := pg_get_functiondef('perform_gather'::regproc);
  v_old := $q$perform skill_raise(p_world, p_uid, d.skill, try_gain(array_length(found, 1) is not null));$q$;
  v_new := $q$perform skill_raise(p_world, p_uid, d.skill, try_gain(array_length(found, 1) is not null));
    if p_action = 'forage' then perform aware_dark_told(p_world, p_uid, dark_work()); end if;$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_gather: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  -- And every go of fishing in the dark, rod or net, landed or not.
  v_def := pg_get_functiondef('perform_fish'::regproc);
  v_old := $q$try_gain(got is not null, rod_gain()));$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_fish: rod anchor not once'; end if;
  v_def := replace(v_def, v_old, v_old || $q$
    perform aware_dark_told(p_world, p_uid, dark_work());$q$);
  v_old := $q$try_gain(false, net_gain()));$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 2 then raise exception 'perform_fish: empty net anchor not twice'; end if;
  v_def := replace(v_def, v_old, v_old || $q$
      perform aware_dark_told(p_world, p_uid, dark_work());$q$);
  v_old := $q$try_gain(true, net_gain()));$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_fish: net anchor not once'; end if;
  execute replace(v_def, v_old, v_old || $q$
    perform aware_dark_told(p_world, p_uid, dark_work());$q$);
end
$do$;

-- And everybody already ashore starts where a newcomer does.
update skill set value = 20 where id = 'awareness' and value < 20;

select private.lock_doors();
