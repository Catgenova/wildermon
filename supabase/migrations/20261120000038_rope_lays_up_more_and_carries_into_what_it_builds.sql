-- Ropemaking: what the skill does past its recipes, and what rope carries into what it is built into (`ropework.ts`).
--
-- Asked for, with the numbers:
--   * rope per lay-up 1, +1 per 30 levels (`rope_per_lay_up`): a go of "Lay up a rope" or "Lay up thick rope" makes
--     its count times that, before a perk on the count;
--   * time per action −0.5% per level on ropemaking (`rope_time`), after the floor as a perk's time is, on every go of a
--     ropemaking job (`rope_pace`, in `rpc_act` and both of `settle`'s timings);
--   * above level 50 a failed lay-up "loses half the fibre, not all": a failed go here loses nothing and damages what it
--     would have used (`faildamage.ts`), so above 50 a failed lay-up damages half its fibre's units, rounded up, and
--     leaves the rest untouched (`rope_fail_units`);
--   * a rope walk: a lay-up worked standing at one takes 0.6 of the time and comes out 5 QL better, to 100
--     (`rope_walk_ql`, `rope_pace`);
--   * rope QL carries through: a boat takes 15% and a trap 25% of what it is made at from the QL of the rope and thick
--     rope in it, by mass, off the stacks a go spends first (`recipe.rope_share`, `rope_ql`);
--   * a bell rope is needed to ring a bell, and its QL sets how far the ring is heard: workers further than that from
--     the bell are not called and citizens further than that are not told (`bell_heard`, `bell_heard_by`);
--   * a lead rope: a tamed wildermon with no saddle and bridle may be mounted by somebody carrying one, and goes at 0.8
--     of its pace while it is (`lead_pace`);
--   * a twine snare is used up by its first catch: gone once what it holds is taken, let go or walks off with it
--     (`trap_def.once`).

set local lock_timeout = '3s';

create or replace function rope_per_lay_up(p_skill double precision) returns int language sql immutable as $fn$
  select (lay_up_base() + floor(greatest(0, least(100, p_skill)) / lay_up_every()))::int
$fn$;

create or replace function rope_time(p_skill double precision) returns double precision language sql immutable as $fn$
  select 1 - rope_time_per_level() * greatest(0, least(100, p_skill))
$fn$;

create or replace function rope_fail_units(p_n int, p_skill double precision) returns int language sql immutable as $fn$
  select case when p_skill > lay_up_spare_above() then ceil(p_n * lay_up_fail_share())::int else p_n end
$fn$;

-- A go at a ropemaking job, as a share of its time after the floor: the skill's own pace, and a rope walk for a lay-up.
create or replace function rope_pace(p_world uuid, p_uid uuid, p_action text, p_skill text) returns double precision
language sql stable as $fn$
  select case when p_skill is distinct from ropemaking_skill() then 1::double precision
              else rope_time(skill_of(p_world, p_uid, ropemaking_skill()))
                 * case when rope_lay_up(p_action) and at_station(p_world, p_uid, rope_walk_kind()) then rope_walk_time() else 1 end end
$fn$;

create or replace function rope_walk_ql(p_world uuid, p_uid uuid, p_recipe text) returns double precision language sql stable as $fn$
  select case when rope_lay_up(p_recipe) and at_station(p_world, p_uid, rope_walk_kind()) then rope_walk_ql_more() else 0 end
$fn$;

-- The QL of the rope and thick rope a go of the recipe would spend, by mass, off the stacks it spends first; null with none.
create or replace function rope_ql(p_world uuid, p_uid uuid, p_recipe text, p_prefer bigint, p_mat text) returns double precision
language plpgsql as $fn$
declare i record; v_one double precision; v_share double precision; v_total double precision := 0; v_mass double precision := 0;
        v_only boolean;
begin
  for i in select ri.* from recipe_input ri where ri.recipe = p_recipe and rope_input(ri.item) order by ri.ord loop
    v_only := p_mat is not null and craft_count(p_world, p_uid, i.item, p_mat, p_prefer) >= recipe_need(p_world, p_uid, p_recipe, i.count);
    v_one := null;
    select st.ql into v_one from craft_stock(p_world, p_uid, p_prefer) st
     where st.def = i.item and (not v_only or st.extra is not distinct from p_mat)
     order by (st.id = p_prefer) desc, st.draw limit 1;
    if v_one is not null then
      v_share := coalesce((select d.weight from item_def d where d.id = i.item), 1) * i.count;
      v_total := v_total + v_one * v_share;
      v_mass := v_mass + v_share;
    end if;
  end loop;
  return case when v_mass > 0 then v_total / v_mass end;
end $fn$;

create or replace function bell_heard(p_ql double precision) returns double precision language sql immutable as $fn$
  select bell_heard_base() + bell_heard_per_ql() * greatest(0, least(100, coalesce(p_ql, 0)))
$fn$;

-- How far a ring is heard rung by this body: off the best bell rope it carries.
create or replace function bell_heard_by(p_world uuid, p_uid uuid) returns double precision language sql stable as $fn$
  select bell_heard(coalesce((select max(i.ql) from item i where i.world_id = p_world and i.holder = 'player'
                                and i.holder_uid = p_uid and i.def = bell_rope_item() and not i.locked), 0))
$fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- The lay-ups: the count, the failed go, the rope walk; and the rope's share of a boat's or a trap's QL.
    ('public', 'perform_craft', 1,
     $$        v_scroll boolean; v_sheet double precision; v_harm text; v_used int[]; v_hurt text[] := '{}';$$,
     $$        v_scroll boolean; v_sheet double precision; v_harm text; v_used int[]; v_hurt text[] := '{}';
        v_rope double precision;$$),
    ('public', 'perform_craft', 1,
     $$          v_hurt := v_hurt || craft_fail_damage(p_world, p_uid, i.item, recipe_need(p_world, p_uid, p_recipe, i.count), prefer, mat);$$,
     $$          -- Above Ropemaking 50 a failed lay-up damages half its fibre, the rest untouched (`rope_fail_units`).
          v_hurt := v_hurt || craft_fail_damage(p_world, p_uid, i.item,
            case when rope_lay_up(p_recipe) then rope_fail_units(recipe_need(p_world, p_uid, p_recipe, i.count), s)
                 else recipe_need(p_world, p_uid, p_recipe, i.count) end, prefer, mat);$$),
    ('public', 'perform_craft', 1,
     $$  -- The quality of what is about to be used up, worked out before it is used$$,
     $$  -- The rope in it, by mass, for a boat's or a trap's share of its QL (`rope_ql`), read before it is spent.
  if coalesce(r.rope_share, 0) > 0 then v_rope := rope_ql(p_world, p_uid, p_recipe, prefer, mat); end if;
  -- The quality of what is about to be used up, worked out before it is used$$),
    ('public', 'perform_craft', 1,
     $$    made_ql := product_ql(s, tq);
  end if;$$,
     $$    made_ql := product_ql(s, tq);
  end if;
  -- And the rope's share of it, for a boat or a trap (`ropeBlend`).
  if v_rope is not null then made_ql := made_ql * (1 - r.rope_share) + v_rope * r.rope_share; end if;$$),
    ('public', 'perform_craft', 1,
     $$  made_ql := least(100, made_ql * pk(p_world, p_uid, 'ql:' || p_recipe, 1) + station_master(p_world, p_uid, r.station));$$,
     $$  -- And better at a rope walk, for a lay-up (`rope_walk_ql`).
  made_ql := least(100, made_ql * pk(p_world, p_uid, 'ql:' || p_recipe, 1) + station_master(p_world, p_uid, r.station)
                        + rope_walk_ql(p_world, p_uid, p_recipe));$$),
    ('public', 'perform_craft', 1,
     $$  v_base := pk(p_world, p_uid, 'count:' || r.result, r.count)::int;$$,
     $$  -- A lay-up's count by Ropemaking (`rope_per_lay_up`), before a perk on it.
  v_base := pk(p_world, p_uid, 'count:' || r.result,
               r.count * case when rope_lay_up(p_recipe) then rope_per_lay_up(s) else 1 end)::int;$$),
    -- Ropemaking's pace on its own jobs, after the floor, wherever a go is timed.
    ('public', 'rpc_act', 1,
     $$                 * piece_pace(p_world, me, d.skill) * faith_steady(p_world, me, d.tool) end;$$,
     $$                 * piece_pace(p_world, me, d.skill) * faith_steady(p_world, me, d.tool)
                 -- And Ropemaking's own pace, and a rope walk for a lay-up (`rope_pace`).
                 * rope_pace(p_world, me, p_action, d.skill) end;$$),
    ('public', 'settle', 1,
     $$                 * piece_pace(p_world, p_uid, d.skill) * faith_steady(p_world, p_uid, d.tool))
$$,
     $$                 * piece_pace(p_world, p_uid, d.skill) * faith_steady(p_world, p_uid, d.tool)
                 * rope_pace(p_world, p_uid, d.id, d.skill))
$$),
    ('public', 'settle', 1,
     $$                     * piece_pace(p_world, p_uid, d.skill) * faith_steady(p_world, p_uid, d.tool)),$$,
     $$                     * piece_pace(p_world, p_uid, d.skill) * faith_steady(p_world, p_uid, d.tool)
                     * rope_pace(p_world, p_uid, d.id, d.skill)),$$),
    -- A bell is rung on a bell rope, and heard as far as its QL carries it.
    ('public', 'last_refusal', 1,
     $$      return 'Only on your settlement.';
    end if;
    return null;

  elsif p_action in ('sleep', 'set_home') then$$,
     $$      return 'Only on your settlement.';
    end if;
    -- Rung on a bell rope (`ropework.ts`).
    if pack_count(p_world, p_uid, bell_rope_item()) < 1 then return no_bell_rope_said(); end if;
    return null;

  elsif p_action in ('sleep', 'set_home') then$$),
    ('public', 'perform_last', 1,
     $$             where cr.world_id = p_world and cr.mode = 'deed' and cr.hitched_to is null
$$,
     $$             where cr.world_id = p_world and cr.mode = 'deed' and cr.hitched_to is null
               -- Within hearing of the bell (`bell_heard_by`).
               and sqrt(power(cr.to_x - pc.cx, 2) + power(cr.to_y - pc.cy, 2)) <= bell_heard_by(p_world, p_uid)
$$),
    ('public', 'perform_last', 1,
     $$      if e.uid <> p_uid then
        perform tell(p_world, e.uid, 'The bell rings out over '$$,
     $$      if e.uid <> p_uid and exists (select 1 from player q where q.world_id = p_world and q.uid = e.uid
                                      and sqrt(power(q.x - pc.cx, 2) + power(q.y - pc.cy, 2)) <= bell_heard_by(p_world, p_uid)) then
        perform tell(p_world, e.uid, 'The bell rings out over '$$),
    ('public', 'perform_last', 1,
     $$    perform tell(p_world, p_uid, 'Rang: ' || lower(placed_name(pc)) || ' at ' || pc.x || ', ' || pc.y || '. Settlement workers called: '
      || v_n || '. Citizens of ' || r.name || ' notified.', 'event');$$,
     $$    perform tell(p_world, p_uid, 'Rang: ' || lower(placed_name(pc)) || ' at ' || pc.x || ', ' || pc.y || '. Heard within '
      || floor(bell_heard_by(p_world, p_uid) + 0.5)::int || ' tiles. Settlement workers called: '
      || v_n || '. Citizens of ' || r.name || ' in hearing notified.', 'event');$$),
    -- A lead rope stands in for the saddle and bridle, at its pace.
    ('public', 'ride_refusal', 1,
     $$      if not c.tacked then return c.name || ': no saddle and bridle.'; end if;$$,
     $$      if not c.tacked and pack_count(p_world, p_uid, lead_rope_item()) < 1 then
        return c.name || ': no saddle and bridle, no lead rope.';
      end if;$$),
    ('public', 'travel_speed', 1,
     $$* tack_speed(c);$$,
     $$* tack_speed(c)
      -- Led on a lead rope rather than bridled (`lead_pace`).
      * case when c.tacked then 1 else lead_pace() end;$$),
    -- A twine snare is used up by its first catch.
    ('public', 'spring_trap', 1,
     $$  update placed set caught = null, bait = null, bait_ql = null where id = p_id;
$$,
     $$  update placed set caught = null, bait = null, bait_ql = null where id = p_id;
  -- Used up by its first catch, let go or walked off with (`trap_def.once`).
  if coalesce((select t.once from trap_def t where t.id = p.sub), false) then
    delete from placed where id = p_id;
    perform land_announce(p.world_id, p.x, p.y);
  end if;
$$),
    ('public', 'perform_trap', 1,
     $$  elsif p_action = 'free_catch' then$$,
     $$    -- Used up by its first catch, taken (`trap_def.once`).
    if d.once then
      delete from placed where id = p.id;
      perform tell(p_world, p_uid, 'Used up: ' || lower(trap_name(p)) || '.', 'event');
      perform land_announce(p_world, p.x, p.y);
    end if;

  elsif p_action = 'free_catch' then$$)
  ) as t(sch, fn, times, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = r.sch and p.proname = r.fn;
    if v_def is null then raise exception '%.% is not on this island', r.sch, r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.times then raise exception '%.% has % of the lines to change, not %', r.sch, r.fn, v_n, r.times; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
