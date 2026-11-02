-- Work around me: only the wildermon following you, and one at a time.
--
-- Asked for: "Capped to only the wildermon following you". One in a crate, in your pack or standing, is refused in the
-- words a post uses for one that is not following ("<name> is not following you."), and with one already working
-- round you another is refused ("Already working around you: <name>."). What it came from is therefore always
-- following (`around` = {"was": "follow"}); `around_end` keeps its crate branch for rows set before this, and its
-- fallback (`worker_return`) for when something else follows you by the time it stops.

create or replace function around_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql as $function$
declare c creature; d species_def; v_kind text; v_other text;
begin
  if p_action = 'stop_work_around' then
    if not exists (select 1 from creature q where q.world_id = p_world and q.keeper = p_uid and q.around is not null) then
      return 'Nothing works around you.';
    end if;
    return null;
  end if;
  c := target_creature(p_world, p_target);
  if c.world_id is null then return 'Gone.'; end if;
  select * into d from species_def where id = c.species;
  if c.mode = 'wild' or c.keeper is distinct from p_uid then return c.name || ' is not yours to set to work.'; end if;
  if c.hitched_to is not null or c.rider is not null then return c.name || ' is in harness.'; end if;
  if c.around is not null then return c.name || ' already works around you.'; end if;
  -- Only the one following you, within a post's reach of you.
  if c.mode <> 'active' then return c.name || ' is not following you.'; end if;
  if not creature_in_reach(p_world, p_uid, c, 4) then return c.name || ' is too far.'; end if;
  -- One at a time.
  select q.name into v_other from creature q
   where q.world_id = p_world and q.keeper = p_uid and q.around is not null order by q.id limit 1;
  if v_other is not null then return 'Already working around you: ' || v_other || '.'; end if;
  v_kind := coalesce(c.job, d.gathers);
  if v_kind is null then return d.name || ': no task.'; end if;
  if not worker_job_ported(v_kind) then
    return 'Not on islands yet: ' || (select verb from gather_def where id = v_kind) || '.';
  end if;
  if not around_trade(v_kind) then
    return 'Settlement only: ' || (select verb from gather_def where id = v_kind) || '.';
  end if;
  return null;
end $function$;

create or replace function perform_around(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns void
language plpgsql as $function$
declare c creature; r record;
begin
  if p_action = 'stop_work_around' then
    for r in select q.id from creature q where q.world_id = p_world and q.keeper = p_uid and q.around is not null order by q.id loop
      perform around_end(p_world, r.id, 'Work around me stopped');
    end loop;
    return;
  end if;
  c := target_creature(p_world, p_target);
  if c.world_id is null or c.mode <> 'active' then return; end if;
  update creature set mode = 'deed', around = jsonb_build_object('was', 'follow'), post = null, phase = 'idle', enemy = null, hunting = null,
      work_x = null, work_y = null, fetching = null, way = null,
      idle_why = null, idle_what = null, idle_n = null, idle_since = null,
      from_x = creature_x(c), from_y = creature_y(c), to_x = creature_x(c), to_y = creature_y(c),
      leg_at = now(), leg_ends = now(), until = now(), settled_at = now()
    where world_id = p_world and id = c.id;
  select * into c from creature where world_id = p_world and id = c.id;
  perform wtell(p_world, p_uid, 'Work around me: ' || c.name || ', '
    || (select g.verb from gather_def g where g.id = coalesce(c.job, (select s.gathers from species_def s where s.id = c.species)))
    || ' within ' || work_range(c) || ' tiles of you.', 'system');
end $function$;

select private.lock_doors();
