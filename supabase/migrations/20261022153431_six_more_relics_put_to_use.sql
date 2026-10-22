-- Six more relics, and what each is good for, as the browser has them (`creatureActions.ts`, `relicuse.ts`).
--
-- Asked for: "Old collar, old bridle, seed jar, old whetstone, makers stamp, rune tablet". The relics themselves, what
-- they restore into and the numbers are the snapshot's before this (`relic_def`, `item_def`, `collar_cut`,
-- `bridle_pace`, `jar_seeds`, `stamp_goes`, `stamp_rare`, `tablet_gain`, `tablet_below`). What they do:
--
--   * an ancient collar and an ancient bridle are fitted on a wildermon of yours from its menu, once each and for good,
--     kept in `boosts` beside the pot points (`fitted`): the collar takes `collar_cut` off its upkeep (`pot_mul` on
--     `appetite`), the bridle puts `bridle_pace` on its speed ridden (`tack_speed`) and its share of a team's
--     (`bridle_team`, in `vehicle_speed`), past the cap as tack is;
--   * an ancient whetstone takes all the damage off a damaged tool or weapon in the pack, its QL kept (`hone_whetstone`);
--   * an ancient seed jar opens to `jar_seeds` seeds of one crop at random, at the jar's QL (`open_seed_jar`);
--   * a rune tablet puts `tablet_gain` into a skill under `tablet_below`, chosen in the Skills window
--     (`read_rune_tablet`, the skill on the target);
--   * an ancient stamp carried puts `stamp_rare` on the first step of rarity of each craft and forging, a go off it
--     each, `stamp_goes` in a fresh one, gone after the last (`press_stamp`), its goes in its name.

set local lock_timeout = '3s';

-- Whether a wildermon has an ancient collar or bridle fitted (`fitted`).
create or replace function fitted(c creature, p_fit text) returns boolean language sql immutable as $fn$
  select coalesce((c.boosts->>p_fit)::double precision, 0) > 0
$fn$;

-- A team's bridles on its pace: the share of it bridled, each at `bridle_pace` more (`bridleTeam`).
create or replace function bridle_team(p_world uuid, p_id bigint) returns double precision language sql stable as $fn$
  select coalesce(1 + bridle_pace() * count(*) filter (where fitted(t, 'bridle'))::double precision / nullif(count(*), 0), 1)
  from team_of(p_world, p_id) t
$fn$;

-- What ancient pots make of a channel, and a collar of its upkeep (`potMul`).
create or replace function pot_mul(c creature, p_channel text) returns double precision language sql stable as $fn$
  select case when p_channel = any(base_stats()) then 1 + pot_step() * pot_points(c, p_channel)
              when p_channel = 'appetite' and fitted(c, 'collar') then 1 - collar_cut()
              else 1 end
$fn$;

-- The tack on a mount, a Fleetfoot in it, and an ancient bridle (`tackSpeed`).
create or replace function tack_speed(c creature) returns double precision language sql stable as $fn$
  select greatest(1, coalesce(max(mark_of(c.tack -> t.item, 'speed')), 1))
         * (1 + tack_enchant_of(c, 'fleet'))
         * case when fitted(c, 'bridle') then 1 + bridle_pace() else 1 end
  from tack_def t
$fn$;

/*
 * A craft or a forging with an ancient stamp carried: the first step of rarity at `stamp_rare` its odds, and a go off
 * the stamp, gone after its last; the odds as they came in with none (`pressStamp`).
 */
create or replace function press_stamp(p_world uuid, p_uid uuid, p_first double precision) returns double precision
language plpgsql as $fn$
declare v_it item; v_left int;
begin
  select * into v_it from item i
   where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.def = 'ancient_stamp'
     and coalesce(i.charges, stamp_goes()::int) > 0
   order by i.id limit 1;
  if v_it.id is null then return p_first; end if;
  v_left := coalesce(v_it.charges, stamp_goes()::int) - 1;
  if v_left <= 0 then
    perform spend_stack(p_world, p_uid, v_it.id, 1);
    perform tell(p_world, p_uid, 'Ancient stamp: rare chance ×' || stamp_rare()::int || '. Last go; stamp used up.', 'event');
  else
    update item set charges = v_left where id = v_it.id;
    perform tell(p_world, p_uid, 'Ancient stamp: rare chance ×' || stamp_rare()::int || '. ' || v_left || ' of '
      || stamp_goes()::int || ' goes left.', 'event');
  end if;
  return least(1, p_first * stamp_rare());
end $fn$;

-- The three relics used from your pack and the Skills window.
create or replace function relic_use_action(p_action text) returns boolean language sql immutable as $fn$
  select p_action in ('hone_whetstone', 'open_seed_jar', 'read_rune_tablet')
$fn$;

-- Why one will not go ahead, word for word as the browser's `honeRefusal` and `tabletRefusal`.
create or replace function relic_use_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql stable as $fn$
declare v_it item; v_skill text := p_target->>'skill'; v_name text;
begin
  v_it := carried(p_world, p_uid, target_item(p_target));
  if v_it.id is null then return 'It is gone.'; end if;
  if p_action = 'hone_whetstone' then
    if pack_count(p_world, p_uid, 'ancient_whetstone') <= 0 then return 'Need an ancient whetstone.'; end if;
    if unrestored(v_it.def) then return not_restored_says(); end if;
    if v_it.dmg <= 0 then return 'Not damaged.'; end if;
    return null;
  end if;
  if p_action = 'open_seed_jar' then
    return case when v_it.def = 'ancient_seed_jar' then null else 'It is gone.' end;
  end if;
  if v_it.def <> 'rune_tablet' then return 'It is gone.'; end if;
  select d.name into v_name from skill_def d where d.id = v_skill;
  if v_skill is null or v_name is null then return 'Choose a skill in the Skills window.'; end if;
  if skill_standing(p_world, p_uid, v_skill) >= tablet_below() then
    return v_name || ': ' || tablet_below()::int || ' or over, nothing to learn.';
  end if;
  return null;
end $fn$;

create or replace function perform_relic_use(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns void
language plpgsql as $fn$
declare v_it item; v_stone item; v_seed text; v_skill text := p_target->>'skill'; v_was double precision;
        v_now double precision;
begin
  if relic_use_refusal(p_world, p_uid, p_action, p_target) is not null then return; end if;
  v_it := carried(p_world, p_uid, target_item(p_target));

  if p_action = 'hone_whetstone' then
    -- All the damage off, the QL as it was; the whetstone used up.
    if not consume(p_world, p_uid, 'ancient_whetstone', 1) then return; end if;
    update item set dmg = 0 where id = v_it.id returning * into v_it;
    perform tell(p_world, p_uid, 'Honed: ' || lower(item_name(v_it)) || ', all damage off, QL '
      || round(v_it.ql::numeric, 1) || '. Whetstone used up.', 'event');

  elsif p_action = 'open_seed_jar' then
    -- `jar_seeds` seeds of one crop at random, at the jar's QL.
    select c.seed into v_seed from crop_def c order by random() limit 1;
    if not spend_stack(p_world, p_uid, v_it.id, 1) then return; end if;
    perform give(p_world, p_uid, v_seed, jar_seeds()::int, v_it.ql);
    perform tell(p_world, p_uid, 'Seed jar opened: ' || jar_seeds()::int || ' × '
      || lower((select d.name from item_def d where d.id = v_seed)) || ', QL ' || round(v_it.ql::numeric, 1) || '.', 'event');

  else
    -- `tablet_gain` into the skill chosen, all at once; the tablet used up.
    if not spend_stack(p_world, p_uid, v_it.id, 1) then return; end if;
    v_was := skill_standing(p_world, p_uid, v_skill);
    v_now := v_was + tablet_gain();
    insert into skill (world_id, uid, id, value) values (p_world, p_uid, v_skill, v_now)
      on conflict (world_id, uid, id) do update set value = excluded.value;
    update player set skills_at = now() where world_id = p_world and uid = p_uid;
    perform earn_titles(p_world, p_uid, v_skill, v_was, v_now);
    perform tell(p_world, p_uid, 'Rune tablet read: ' || (select d.name from skill_def d where d.id = v_skill) || ' '
      || to_char(v_now, 'FM999990.0000') || ' (+' || to_char(tablet_gain(), 'FM990.0') || '). Tablet used up.', 'skill');
  end if;
end $fn$;

do $do$
declare r record; v_def text; v_n int; i int;
begin
  for r in select * from (values
    -- The collar and the bridle are artifacts, and the item each uses (the browser's `ARTIFACT_FOR`).
    (1, 'artifact_item', array[$$when 'use_ancient_lamp' then 'ancient_lamp'$$],
       array[$$when 'use_ancient_lamp' then 'ancient_lamp'
                       when 'use_ancient_collar' then 'ancient_collar'
                       when 'use_ancient_bridle' then 'ancient_bridle'$$], array[1]),
    -- Once each.
    (2, 'artifact_refusal', array[$$  if p_action = 'use_ancient_pot' and not exists$$],
       array[$$  if p_action = 'use_ancient_collar' and fitted(c, 'collar') then return c.name || ': ancient collar already fitted.'; end if;
  if p_action = 'use_ancient_bridle' and fitted(c, 'bridle') then return c.name || ': ancient bridle already fitted.'; end if;
  if p_action = 'use_ancient_pot' and not exists$$], array[1]),
    -- And fitted, for good, beside the pot points.
    (3, 'perform_artifact', array[$$  elsif p_action = 'use_ancient_lamp' then$$],
       array[$$  elsif p_action in ('use_ancient_collar', 'use_ancient_bridle') then
    update creature set boosts = coalesce(boosts, '{}'::jsonb)
        || jsonb_build_object(case when p_action = 'use_ancient_collar' then 'collar' else 'bridle' end, 1)
     where world_id = p_world and id = c.id;
    perform tell(p_world, p_uid, upper(left(v_name, 1)) || substr(v_name, 2) || ' fitted on ' || c.name || ': '
      || case when p_action = 'use_ancient_collar' then 'upkeep −' || whole_pct(collar_cut())
              else 'speed ridden and in a team +' || whole_pct(bridle_pace()) end || '.', 'event');

  elsif p_action = 'use_ancient_lamp' then$$], array[1]),
    -- A team's bridles, past the cap as the builder's mark is.
    (4, 'vehicle_speed', array[$$    * vehicle_ql_pace(p.ql);$$],
       array[$$    * vehicle_ql_pace(p.ql) * bridle_team(p_world, p_id);$$], array[1]),
    -- The stamp on a craft's roll (`pressStamp`).
    (5, 'perform_craft', array[$$  rare := rarity_roll_from(v_used, pk(p_world, p_uid, 'rare:' || p_recipe, (select d.odds from rarity_def d order by d.ord limit 1)));$$],
       array[$$  rare := rarity_roll_from(v_used, press_stamp(p_world, p_uid, pk(p_world, p_uid, 'rare:' || p_recipe, (select d.odds from rarity_def d order by d.ord limit 1))));$$], array[1]),
    -- And a forging's.
    (6, 'perform_forge', array[$$  v_rare := rarity_roll_from(rarity_one(v_cast.rare), pk(p_world, p_uid, 'rare:smith', (select r.odds from rarity_def r order by r.ord limit 1)));$$],
       array[$$  v_rare := rarity_roll_from(rarity_one(v_cast.rare), press_stamp(p_world, p_uid, pk(p_world, p_uid, 'rare:smith', (select r.odds from rarity_def r order by r.ord limit 1))));$$], array[1]),
    -- A stamp says the goes it has left: an Ancient stamp (3 goes).
    (7, 'item_name', array[$$              when d.charges is not null or it.def = 'milk_part' then ' (' || item_litres(it)::text || ' L)'$$],
       array[$$              when d.charges is not null or it.def = 'milk_part' then ' (' || item_litres(it)::text || ' L)'
              when it.def = 'ancient_stamp' then ' (' || greatest(0, coalesce(it.charges, stamp_goes()::int)) || ' goes)'$$], array[1]),
    -- The three relics used from the pack and the Skills window, asked and done.
    (8, 'act_refusal_rules', array[$$  if lamp_action(p_action) then return lamp_refusal(p_world, p_uid, p_action, p_target); end if;$$],
       array[$$  if lamp_action(p_action) then return lamp_refusal(p_world, p_uid, p_action, p_target); end if;
  if relic_use_action(p_action) then return relic_use_refusal(p_world, p_uid, p_action, p_target); end if;$$], array[1]),
    (9, 'act_perform', array[$$  if lamp_action(p_action) then perform perform_lamp(p_world, p_uid, p_action, p_target); return; end if;$$],
       array[$$  if lamp_action(p_action) then perform perform_lamp(p_world, p_uid, p_action, p_target); return; end if;
  if relic_use_action(p_action) then perform perform_relic_use(p_world, p_uid, p_action, p_target); return; end if;$$], array[1]),
    (10, 'act_ported', array[$$      or counter_action(p_action) or lamp_action(p_action)$$],
       array[$$      or counter_action(p_action) or lamp_action(p_action) or relic_use_action(p_action)$$], array[1])
  ) as t(ord, fn, olds, news, ns) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not there', r.fn; end if;
    for i in 1 .. array_length(r.olds, 1) loop
      v_n := (length(v_def) - length(replace(v_def, r.olds[i], ''))) / length(r.olds[i]);
      if v_n <> r.ns[i] then raise exception '% has % of %, not %', r.fn, v_n, r.olds[i], r.ns[i]; end if;
      v_def := replace(v_def, r.olds[i], r.news[i]);
    end loop;
    execute v_def;
  end loop;
end $do$;

select private.lock_doors();
