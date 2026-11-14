-- Elementalism past the swirls (`infusion.ts`, `infuseActions.ts`).
--
-- Asked for, with the numbers:
--   * Infusing: a job at an enchanter's plinth puts 3 motes of one element, off one stack, into a thing that element
--     goes into, one element to a thing, for 7 days; each infusion trains Elementalism a full go. Its strength, as a
--     share of the element's most, is (Elementalism/100) × (the motes' QL/100), ×1.2 for the element you are attuned
--     to (`infuse_share`). What each does at its most:
--       fire, in a campfire, an oven, a smelter or a kiln: fuel lasts ×1.5 (`placed_burn_rate`);
--       earth, in a shovel or a pickaxe: +1 to what a dig or a mining go yields on 20% of goes (`earth_more`);
--       wind, in a sailing boat, a caravel, a large cart or a wagon: speed +8% (`travel_speed`, `vehicle_speed`);
--       water, in a well: fills ×2 as fast (`placed_litres`);
--       life, in a planter: growth stage time ×0.75 (`planter_per`);
--       light, in a lantern, a lantern post or a lantern pillar: burns no candle, and lights with none (`candle_left`,
--       `placed_fuel`, `placed_burn_rate`);
--       dark, in a weapon, armour or a shield, wielded or worn: a creature's blow at you misses 10% more (`dark_miss`).
--     Ice goes into nothing: nothing a larder, a barrel or a crate holds decays, so there is nothing for it to slow.
--     An infusion stays with the thing through being picked up and set down (`perform_fire`).
--   * Mote QL: a swirl's motes have come off at `product_ql` of Elementalism since swirls were ported; the infusion's
--     strength reads it.
--   * Attunement: the element you collected most of over the last 7 days (`mote_attuned`, off `mote_take`): its swirls
--     give 1 mote more, its infusions 20% more strength; kept in `player.stats.attune` for the skill page.
--   * Sensing: once an hour, the swirls within 20 + 0.8 × Elementalism tiles counted and marked on the map; trains
--     Elementalism a quarter of a go (`perform_sense`).

set local lock_timeout = '3s';

alter table item add column if not exists infuse jsonb;
alter table placed add column if not exists infuse jsonb;

-- Every swirl collected, by element, for attunement.
create table if not exists mote_take (
  world_id uuid not null references world on delete cascade,
  uid uuid not null,
  at timestamptz not null default now(),
  element text not null,
  n int not null
);
create index if not exists mote_take_who on mote_take (world_id, uid, at);
alter table mote_take enable row level security;

create or replace function infuse_share(p_skill double precision, p_ql double precision, p_attuned boolean) returns double precision
language sql immutable as $fn$
  select greatest(0, least(100, p_skill)) / 100 * greatest(0, least(100, p_ql)) / 100
       * case when p_attuned then 1 + attune_strength() else 1 end
$fn$;

-- A thing's infusion of this element now, as a share: nought for none, another element or one run out.
create or replace function infuse_on(p_infuse jsonb, p_el text) returns double precision language sql stable as $fn$
  select case when p_infuse is not null and p_infuse->>'el' = p_el
                   and (p_infuse->>'until')::double precision > extract(epoch from now())
              then (p_infuse->>'str')::double precision else 0 end
$fn$;

-- The element collected most over the last `attune_days` days; the latest of two alike; null for none.
create or replace function mote_attuned(p_world uuid, p_uid uuid) returns text language sql stable as $fn$
  select t.element from mote_take t
   where t.world_id = p_world and t.uid = p_uid and t.at > now() - make_interval(days => attune_days()::int)
   group by t.element order by sum(t.n) desc, max(t.at) desc limit 1
$fn$;
-- And kept on the body for the skill page, by its place among the elements.
create or replace function mote_attune_kept(p_world uuid, p_uid uuid) returns void language sql as $fn$
  update player set stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('attune',
           coalesce(array_position(array['earth', 'wind', 'fire', 'ice', 'dark', 'light', 'water', 'life'], mote_attuned(p_world, p_uid)) - 1, -1))
   where world_id = p_world and uid = p_uid
$fn$;

-- What an infusion target is called: its item's name, or its kind (`infuseName`).
create or replace function infuse_name(p_def text) returns text language sql stable as $fn$
  select coalesce((select d.name from item_def d where d.id = p_def), upper(left(replace(p_def, '_', ' '), 1)) || substr(replace(p_def, '_', ' '), 2))
$fn$;

-- The words an infusion says on a thing (`infuseSays`): its element, strength, what it does, and its time left.
create or replace function infuse_num(p double precision, p_places int) returns text language sql immutable as $fn$
  select rtrim(rtrim(to_char(round(p::numeric, p_places), 'FM999999990.' || repeat('0', p_places)), '0'), '.')
$fn$;
create or replace function infuse_says(p_infuse jsonb) returns text language plpgsql stable as $fn$
declare el text := p_infuse->>'el'; s double precision := (p_infuse->>'str')::double precision;
        secs double precision; d int; h int; m int; v_said text;
begin
  if p_infuse is null or (p_infuse->>'until')::double precision <= extract(epoch from now()) then return ''; end if;
  secs := (p_infuse->>'until')::double precision - extract(epoch from now());
  d := floor(secs / 86400); h := floor((secs - 86400 * floor(secs / 86400)) / 3600); m := floor((secs - 3600 * floor(secs / 3600)) / 60);
  v_said := case el
    when 'fire' then 'Fuel lasts: ×' || infuse_num(1 + infuse_most('fire') * s, 2)
    when 'earth' then 'Digging and mining yield +1, chance: ' || infuse_num(infuse_most('earth') * s * 100, 1) || '%'
    when 'wind' then 'Speed: +' || infuse_num(infuse_most('wind') * s * 100, 1) || '%'
    when 'water' then 'Fills: ×' || infuse_num(1 + infuse_most('water') * s, 2) || ' as fast'
    when 'life' then 'Growth stage time: ×' || infuse_num(1 - infuse_most('life') * s, 2)
    when 'light' then 'Candle: not needed'
    when 'dark' then 'Blows on the wearer or wielder: miss chance: +' || infuse_num(infuse_most('dark') * s * 100, 1) || '%'
  end;
  return 'Infused: ' || el || ', strength ' || round((s * 100)::numeric)::int || '%.' || coalesce(' ' || v_said || '.', '') || ' '
    || case when d > 0 then d || ' d ' || h || ' h' when h > 0 then h || ' h ' || m || ' min' else greatest(1, m) || ' min' end || ' left.';
end $fn$;

-- One more out of a dig or a mining go, now and then, for earth in the tool it is done with; no roll without it.
create or replace function earth_more(p_world uuid, p_uid uuid, p_tool text) returns int language plpgsql as $fn$
declare v double precision;
begin
  if p_tool is null then return 0; end if;
  select infuse_on(i.infuse, 'earth') into v from item i where i.id = held_tool(p_world, p_uid, p_tool);
  if coalesce(v, 0) <= 0 then return 0; end if;
  return case when random() < infuse_most('earth') * v then 1 else 0 end;
end $fn$;

-- The most dark infused in what you wield or wear, as a chance a creature's blow at you misses.
create or replace function dark_miss(p_world uuid, p_uid uuid) returns double precision language sql stable as $fn$
  select infuse_most('dark') * coalesce(max(infuse_on(i.infuse, 'dark')), 0)
    from player p cross join lateral jsonb_each_text(coalesce(p.equipped, '{}'::jsonb)) e
    join item i on i.world_id = p.world_id and i.holder = 'player' and i.holder_uid = p.uid
                and e.value ~ '^[0-9]+$' and i.id = e.value::bigint
   where p.world_id = p_world and p.uid = p_uid
$fn$;

-- What fire and light make of how fast a piece burns: fire lasts longer, light burns nothing.
create or replace function placed_burn_rate(p placed) returns double precision language sql stable as $fn$
  select case when infuse_on(p.infuse, 'light') > 0 then 0::double precision
              else (case when is_brazier(p) then brazier_burn(p.ql) else 1 end) * (1 - placed_enchant(p, 'ember'))
                   / (1 + infuse_most('fire') * infuse_on(p.infuse, 'fire')) end
$fn$;
-- And a lantern post or pillar with light in it lights with no candle.
create or replace function placed_fuel(p placed) returns double precision language sql stable as $fn$
  select greatest(case when infuse_on(p.infuse, 'light') > 0 then 1 else 0 end,
                  case when p.lit then greatest(0, p.fuel - extract(epoch from (now() - p.since)) * placed_burn_rate(p))
                       else p.fuel end)
$fn$;
-- And a lantern in hand with light in it burns none of its candle, and lights with none.
create or replace function candle_left(it item) returns double precision language sql stable as $fn$
  select case when infuse_on(it.infuse, 'light') > 0 then greatest(1, coalesce(it.charges, 0))
              else greatest(0, case when it.lit and it.lit_at is not null
                                    then coalesce(it.charges, 0) - extract(epoch from (now() - it.lit_at))
                                    else coalesce(it.charges, 0) end) end
$fn$;
-- Life in a planter: its stage time.
create or replace function planter_per(c planter_crop, p placed) returns double precision language plpgsql stable as $fn$
begin
  return crop_per(c.world_id, c.id, c.pace, p.x, p.y) * (1 - infuse_most('life') * infuse_on(p.infuse, 'life'));
end $fn$;

/* ---- the jobs ------------------------------------------------------------------------------------------------- */

create or replace function sense_range(p_skill double precision) returns double precision language sql immutable as $fn$
  select sense_base() + sense_per_level() * greatest(0, least(100, p_skill))
$fn$;

-- The thing an infusion is aimed at: in the pack, or standing within reach; its id, its kind and its infusion.
create or replace function infuse_target(p_world uuid, p_uid uuid, p_target jsonb, out o_item bigint, out o_placed bigint,
                                         out o_def text, out o_infuse jsonb, out o_far boolean) language plpgsql stable as $fn$
declare p placed;
begin
  o_far := false;
  if p_target->>'kind' = 'item' then
    select i.id, i.def, i.infuse into o_item, o_def, o_infuse from item i
     where i.world_id = p_world and i.id = target_item(p_target) and i.holder = 'player' and i.holder_uid = p_uid;
    return;
  end if;
  select * into p from placed where world_id = p_world and id = (p_target->>'id')::bigint
     and kind in ('furniture', 'smelter', 'kiln', 'campfire');
  if p.id is null then return; end if;
  o_placed := p.id;
  o_def := case when p.kind = 'furniture' then p.sub else p.kind end;
  o_infuse := p.infuse;
  o_far := not placed_in_reach(p_world, p_uid, p.id);
end $fn$;

create or replace function infuse_refusal(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns text
language plpgsql stable as $fn$
declare m item; el text; t record;
begin
  if p_action = sense_action() then
    if extract(epoch from now()) < coalesce((select (pl.stats->>'sensedAt')::double precision from player pl
                                              where pl.world_id = p_world and pl.uid = p_uid), 0) + sense_every() then
      return 'Sensed within the hour: again in '
        || ceil(((select (pl.stats->>'sensedAt')::double precision from player pl where pl.world_id = p_world and pl.uid = p_uid)
                 + sense_every() - extract(epoch from now())) / 60)::int || ' min.';
    end if;
    return null;
  end if;
  select * into m from item where world_id = p_world and id = (p_target->>'item')::bigint and holder = 'player' and holder_uid = p_uid;
  el := case when m.def like '%\_mote' then left(m.def, length(m.def) - 5) end;
  if m.id is null or el is null or el not in ('earth', 'wind', 'fire', 'ice', 'dark', 'light', 'water', 'life')
     or m.count < infuse_motes() then
    return infuse_said_motes();
  end if;
  if not at_station(p_world, p_uid, 'enchanters_plinth') then return infuse_said_plinth(); end if;
  select * into t from infuse_target(p_world, p_uid, p_target);
  if t.o_def is null then return infuse_said_gone(); end if;
  if t.o_far then return infuse_said_reach(); end if;
  if not infuse_fits(el, t.o_def) then return infuse_fits_said(el); end if;
  if t.o_infuse is not null and (t.o_infuse->>'until')::double precision > extract(epoch from now()) then
    return 'Already infused: ' || (t.o_infuse->>'el') || '.';
  end if;
  return null;
end $fn$;

create or replace function perform_infuse(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns void language plpgsql as $fn$
declare why text; m item; el text; t record; v_i jsonb; v_skill double precision; v_n int; v_range double precision; pl player;
begin
  why := infuse_refusal(p_world, p_uid, p_action, p_target);
  if why is not null then
    perform tell(p_world, p_uid, why, 'error');
    return;
  end if;
  v_skill := skill_of(p_world, p_uid, elementalism_skill());
  if p_action = sense_action() then
    select * into pl from player where world_id = p_world and uid = p_uid;
    v_range := sense_range(v_skill);
    select count(*) into v_n from mote_swirl s
     where s.world_id = p_world and sqrt(power(s.x - floor(pl.x), 2) + power(s.y - floor(pl.y), 2)) <= v_range;
    update player set stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('sensedAt', floor(extract(epoch from now())))
     where world_id = p_world and uid = p_uid;
    perform mote_attune_kept(p_world, p_uid);
    perform skill_raise(p_world, p_uid, elementalism_skill(), sense_learn());
    perform tell(p_world, p_uid, sensed_word() || ' ' || v_n || ' mote swirl' || case when v_n = 1 then '' else 's' end
      || ' within ' || round(v_range::numeric)::int || ' tiles. Marked on your map.', 'event');
    return;
  end if;
  select * into m from item where world_id = p_world and id = (p_target->>'item')::bigint;
  el := left(m.def, length(m.def) - 5);
  select * into t from infuse_target(p_world, p_uid, p_target);
  v_i := jsonb_build_object('el', el, 'str', infuse_share(v_skill, m.ql, mote_attuned(p_world, p_uid) = el),
                            'until', extract(epoch from now()) + infuse_secs());
  if not consume(p_world, p_uid, m.def, infuse_motes()::int, m.id) then return; end if;
  if t.o_item is not null then update item set infuse = v_i where id = t.o_item;
  else update placed set infuse = v_i where id = t.o_placed;
       perform land_announce(p_world, (select x from placed where id = t.o_placed), (select y from placed where id = t.o_placed));
  end if;
  perform skill_raise(p_world, p_uid, elementalism_skill(), 1);
  perform tell(p_world, p_uid, infuse_name(t.o_def) || ': ' || infuse_says(v_i), 'event');
end $fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- The jobs, on the island.
    ('public', 'act_ported', 1,
     $$      or swirl_action(p_action)$$,
     $$      or swirl_action(p_action)
      -- Infusing motes, and sensing swirls (`infuseActions.ts`).
      or mote_action(p_action)$$),
    ('public', 'act_refusal_rules', 1,
     $$  if sail_action(p_action) then$$,
     $$  if mote_action(p_action) then
    return infuse_refusal(p_world, p_uid, p_action, p_target);
  end if;
  if sail_action(p_action) then$$),
    ('public', 'act_perform', 1,
     $$  if sail_action(p_action) then$$,
     $$  if mote_action(p_action) then
    perform perform_infuse(p_world, p_uid, p_action, p_target);
    return;
  end if;
  if sail_action(p_action) then$$),
    -- Attunement: a mote more off a swirl of its element, and every swirl noted.
    ('public', 'perform_swirl', 1,
     $$  v_n := motes_for(v_skill) + path_fx(p_world, p_uid, 'motes', 0)::int;$$,
     $$  v_n := motes_for(v_skill) + path_fx(p_world, p_uid, 'motes', 0)::int;
  -- And one more of the element you are attuned to (`mote_attuned`), and the swirl noted for attunement after.
  v_n := v_n + case when mote_attuned(p_world, p_uid) = s.element then attune_motes()::int else 0 end;
  insert into mote_take (world_id, uid, element, n) values (p_world, p_uid, s.element, v_n);
  perform mote_attune_kept(p_world, p_uid);$$),
    -- Wind in a hull and in a cart.
    ('public', 'travel_speed', 1,
     $$* mark_of(p.mark, sails_mark())$$,
     $$* mark_of(p.mark, sails_mark()) * (1 + infuse_most('wind') * infuse_on(p.infuse, 'wind'))$$),
    ('public', 'vehicle_speed', 1,
     $$    * vehicle_ql_pace(p.ql) * bridle_team(p_world, p_id) * harness_team(p_world, p_id);$$,
     $$    * vehicle_ql_pace(p.ql) * bridle_team(p_world, p_id) * harness_team(p_world, p_id)
    -- And wind infused in it (`infusion.ts`).
    * (1 + infuse_most('wind') * infuse_on(p.infuse, 'wind'));$$),
    -- Earth in a shovel and a pickaxe.
    ('public', 'act_perform', 1,
     $$    perform gather(p_world, p_uid, yield, 1, made_ql, null, perk_rare(pkx('rare:dig', 0)));$$,
     $$    perform gather(p_world, p_uid, yield, 1 + earth_more(p_world, p_uid, d.tool), made_ql, null, perk_rare(pkx('rare:dig', 0)));$$),
    ('public', 'perform_terrain', 1,
     $$         + case when random() < pk(p_world, p_uid, 'more:mine', 0) then 1 else 0 end;$$,
     $$         + case when random() < pk(p_world, p_uid, 'more:mine', 0) then 1 else 0 end
         -- And one more, now and then, for earth infused in the pickaxe (`earth_more`).
         + earth_more(p_world, p_uid, d.tool);$$),
    -- Water in a well.
    ('public', 'placed_litres', 1,
     $$p.litres + (well_rate(p.ql)$$,
     $$p.litres + (well_rate(p.ql) * (1 + infuse_most('water') * infuse_on(p.infuse, 'water'))$$),
    -- Dark in what you wield or wear.
    ('public', 'hurt_player', 1,
     $$  -- No roll at all while there is no chance, so nothing else's luck moves.
  v_dodge := dodge_chance($$,
     $$  -- A creature's blow misses more for dark infused in what you wield or wear (`dark_miss`); no roll without it.
  if v_from.id is not null and dark_miss(p_world, p_uid) > 0 and random() < dark_miss(p_world, p_uid) then
    perform tell(p_world, p_uid, 'Missed: ' || coalesce((select lower(name) from species_def where id = v_from.species), 'blow')
      || ', dark infusion.', 'fight');
    perform fight_back(p_world, p_uid, (p.stats->>'hurtBy')::int);
    return;
  end if;
  -- No roll at all while there is no chance, so nothing else's luck moves.
  v_dodge := dodge_chance($$),
    -- An infusion stays with a thing set down and picked up.
    ('public', 'perform_fire', 1,
     $$mark, dye, enchant, dmg, engraving)$$,
     $$mark, dye, enchant, dmg, engraving, infuse)$$),
    ('public', 'perform_fire', 1,
     $$            it.engraving)
    returning id into made;$$,
     $$            it.engraving, it.infuse)
    returning id into made;$$),
    ('public', 'perform_fire', 1,
     $$    update item set enchant = p.enchant, dmg = p.dmg where id = made;$$,
     $$    update item set enchant = p.enchant, dmg = p.dmg, infuse = p.infuse where id = made;$$),
    -- And it is said on Examine.
    ('public', 'examine_item_text', 1,
     $$  v_out := v_out || enchant_says(it.enchant);$$,
     $$  v_out := v_out || enchant_says(it.enchant);
  -- And the motes infused into it, while they last (`infuseSays`).
  v_out := v_out || coalesce(nullif(' ' || infuse_says(it.infuse), ' '), '');$$)
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
