-- Enchanting part 3e: Fair Wind, Deep Hold, True Axle and Bag of Holding.
--
-- Fair Wind (3 wind, a sailing boat or a caravel): QL/10 % faster under sail,
-- on every point of sail (travel_speed). Deep Hold (2 water, any boat), True
-- Axle (2 earth, a cart or a wagon) and Bag of Holding (dark + earth, anything
-- that holds things: furniture that keeps things, kilos or litres, the crates
-- and every bag): what it holds times 1 + its share (room_mul), in whichever
-- measure it is counted -- QL/4 % for the first two, times 1 + 2 × QL/100 for
-- the last, three times at QL 100. What is inside still weighs what it weighs.
-- Crates are enchanted where they stand as the placed things are, and carry
-- the enchantment and their wear through being picked up and set down.
--
-- Rewritten from their newest definitions:
--   travel_speed        20261011020352_six_for_what_is_worn.sql
--   furniture_capacity  20260927105414_the_fisher_moved_onto_perks.sql
--   furniture_heft      20260927032000_a_barrel_holds_what_its_wood_holds.sql
--   liquid_capacity     20260927032000_a_barrel_holds_what_its_wood_holds.sql
--   bag_room            20260927080235_the_tailor_moved_onto_perks.sql
--   crate_capacity      20260927032000_a_barrel_holds_what_its_wood_holds.sql
--   perform_crate       20260921150000_a_crate_comes_back_up_at_what_it_went_down_as.sql
--   enchant_refusal     20261011031657_enchanted_where_it_stands.sql
--   perform_enchant     20261011031657_enchanted_where_it_stands.sql

select private.shut('alter table crate add column if not exists enchant jsonb');
select private.shut('alter table crate add column if not exists dmg real not null default 0');

/** What a thing holding Deep Hold, True Axle or a Bag of Holding holds, times what it held (`roomMul`). */
create or replace function room_mul(p_enchant jsonb) returns double precision language sql immutable as $fn$
  select 1 + coalesce((select greatest(0, least(ql_top(), (p_enchant->>'ql')::double precision)) * e.per_ql
                         from enchantments() e where e.id = p_enchant->>'id' and e.effect in ('room', 'bag')), 0)
$fn$;

/** Why this scroll will not go into this crate, or the scroll, the crate and the enchantment when it will (`enchantSetting`). */
create or replace function enchant_setting_crate(p_world uuid, p_uid uuid, p_target jsonb,
  out o_why text, out o_scroll item, out o_crate crate, out o_id text)
  language plpgsql stable as $fn$
declare v_p player;
begin
  select * into o_scroll from item i where i.world_id = p_world and i.id = nullif(p_target->>'scroll', '')::bigint
    and i.holder = 'player' and i.holder_uid = p_uid;
  select e.id into o_id from enchantments() e where e.scroll = o_scroll.def;
  if o_scroll.id is null or o_id is null then o_why := enchant_said('scroll'); return; end if;
  o_crate := target_crate(p_world, p_target);
  if o_crate.id is null then o_why := enchant_said('gone'); return; end if;
  select * into v_p from player where world_id = p_world and uid = p_uid;
  if sqrt(power(crate_centre_x(o_crate) - v_p.x, 2) + power(crate_centre_y(o_crate) - v_p.y, 2)) > 2.4 then
    o_why := enchant_said('reach'); return;
  end if;
  o_why := lock_refusal(p_world, p_uid, o_crate.lock, o_crate.x, o_crate.y);
  if o_why is not null then return; end if;
  if not enchant_fits(enchant_on(o_id), (select d.item from crate_def d where d.kind = o_crate.kind)) then o_why := enchant_wrong_kind(o_id); return; end if;
  if o_crate.dmg >= damage_max() then o_why := enchant_said('broken'); return; end if;
  if o_crate.enchant is not null then
    o_why := 'It already holds ' || coalesce((select e.name from enchantments() e where e.id = o_crate.enchant->>'id'), o_crate.enchant->>'id')
      || ' at QL ' || enchant_ql_word((o_crate.enchant->>'ql')::double precision) || '.';
    return;
  end if;
end $fn$;

/** A scroll set into a crate where it stands, as `perform_enchant_placed` does for the placed things. */
create or replace function perform_enchant_crate(p_world uuid, p_uid uuid, p_target jsonb) returns void
  language plpgsql as $fn$
declare s record; e record; q record; v_skill double precision; v_name text; v_kind text; v_dmg double precision;
        v_sql double precision; v_r1 double precision; v_r2 double precision;
begin
  v_r1 := random();
  v_r2 := random();
  select * into s from enchant_setting_crate(p_world, p_uid, p_target);
  if s.o_why is not null then
    perform tell(p_world, p_uid, s.o_why, 'error');
    return;
  end if;
  select * into e from enchantments() x where x.id = s.o_id;
  v_skill := skill_of(p_world, p_uid, enchanting_skill());
  v_name := lower(crate_name(s.o_crate));
  v_kind := lower((select d.name from item_def d where d.id = (select c.item from crate_def c where c.kind = (s.o_crate).kind)));
  v_sql := (s.o_scroll).ql;
  perform consume(p_world, p_uid, (s.o_scroll).def, 1, (s.o_scroll).id);
  if v_r1 < enchant_chance(v_skill, v_sql) then
    select * into q from enchant_ql(v_skill, v_sql, (s.o_crate).ql, v_r2);
    update crate set enchant = jsonb_build_object('id', e.id, 'ql', q.o_ql) where world_id = p_world and id = (s.o_crate).id;
    perform skill_raise(p_world, p_uid, enchanting_skill(), 1);
    perform tell(p_world, p_uid, enchanted_said(e.name, v_name, v_kind, q.o_ql, q.o_held, v_sql, (s.o_crate).ql), 'event');
  else
    perform skill_raise(p_world, p_uid, enchanting_skill(), try_gain(false));
    v_dmg := placed_harm((s.o_crate).dmg);
    update crate set dmg = v_dmg where world_id = p_world and id = (s.o_crate).id;
    perform tell(p_world, p_uid, placed_not_taken_said(e.name, v_name, v_dmg - (s.o_crate).dmg, v_dmg), 'error');
  end if;
  perform land_announce(p_world, (s.o_crate).x, (s.o_crate).y);
end $fn$;

CREATE OR REPLACE FUNCTION public.travel_speed(p_world uuid, p_uid uuid)
 RETURNS double precision
 LANGUAGE plpgsql
 STABLE
AS $function$
declare c creature; p placed; v double precision; pl player;
begin
  p := driving(p_world, p_uid);
  if p.id is not null then
    -- As fast as she can go under the hands at her helm, and her builder's
    -- hand in her too: a Carpenter's Keel Layer. And the helm's own Sailing
    -- (`sailing_pace`), as the browser's `boatSpeed` has it.
    if is_boat(p) then
      -- And a Fair Wind set into her, on every point of sail (`boatSpeed`).
      return hull_speed(p_world, p_uid, p) * mark_of(p.mark, 'speed')
           * sailing_pace(skill_of(p_world, p_uid, sailing_skill())) * (1 + placed_enchant(p, 'sail'));
    end if;
    v := vehicle_speed(p_world, p.id);
    -- And the driver's Driving on the reins (`driving_pace`), past the cap as the mark is.
    if v > 0 then return v * driving_pace(skill_of(p_world, p_uid, driving_skill())); end if;
    return base_speed();
  end if;
  c := mount_of(p_world, p_uid);
  if c.id is not null then
    -- Shod, it goes quicker on laid stone and gravel.
    select * into pl from player where world_id = p_world and uid = p_uid;
    -- The cap comes after the shoes, as the browser has it: a mount at the cap is at the cap.
    -- And quicker again in tack its maker's hand is in (a Tailor's Saddler), past the cap, as a vehicle's mark is.
    return least(max_mount_speed(), mount_speed(c) * case when shod(c) and paved(land_tile(p_world, floor(pl.x)::int, floor(pl.y)::int))
                                                          then shoe_pace() else 1 end) * tack_speed(c);
  end if;
  -- On foot, and on a made road, a Terraformer's Road Legs; and quicker while a Skirmisher's Hit and Run holds.
  select * into pl from player where world_id = p_world and uid = p_uid;
  v := case when (pl.blessings->'hit_and_run'->>'until')::timestamptz > now()
            then (pl.blessings->'hit_and_run'->>'pace')::double precision else 1 end
    -- And Power's Long Stride, and a Surge while it holds (`pathPace`).
    * path_fx(p_world, p_uid, 'stride', 1)
    -- And a Featherstep's boots (`pathPace`).
    * (1 + worn_enchant(p_world, p_uid, 'stride'))
    * case when (pl.blessings->'path_surge'->>'until')::timestamptz > now()
           then coalesce((select (k.fx->>'pace')::double precision from path_pick k where k.id = 'power_surge'), 1) else 1 end;
  if coalesce((select t.road from tile_def t
                where t.id = land_tile(p_world, floor(pl.x)::int, floor(pl.y)::int)), false) then
    return base_speed() * pk(pl.class_mul, 'walk:road', 1) * v;
  end if;
  return base_speed() * v;
end $function$;

CREATE OR REPLACE FUNCTION public.furniture_capacity(p placed)
 RETURNS integer
 LANGUAGE sql
 STABLE
AS $function$
  select room_for(coalesce((select coalesce(capacity, hive, pond, 0) from furniture_def where id = p.sub), 0)
    * mat_hold(p.material) * mark_of(p.mark, 'hold') * room_mul(p.enchant), p.rare)
$function$;

create or replace function furniture_heft(p placed)
 returns double precision language sql stable as $fn$
  select room_for(coalesce((select heft from furniture_def where id = p.sub), 0)
    * mat_hold(p.material) * mark_of(p.mark, 'hold') * room_mul(p.enchant), p.rare)::double precision
$fn$;

create or replace function liquid_capacity(p placed)
 returns double precision language sql stable as $fn$
  select case when d.liquid is not null
              then floor(d.liquid * mat_hold(p.material) * mark_of(p.mark, 'hold') * room_mul(p.enchant) + 0.5)
              else coalesce(d.well, 0) end
  from furniture_def d where d.id = p.sub
$fn$;

CREATE OR REPLACE FUNCTION public.bag_room(b item)
 RETURNS integer
 LANGUAGE sql
 STABLE
AS $function$
  -- Its make, its maker's mark (a Tailor's Sack Maker and Deep Pockets), and its rarity.
  select room_for((select holds from item_def where id = b.def) * mark_of(b.mark, 'hold') * room_mul(b.enchant), b.rare)
$function$;

create or replace function crate_capacity(c crate)
 returns integer language sql stable as $fn$
  select room_for((select capacity from crate_def where kind = c.kind) * mat_hold(c.material) * room_mul(c.enchant), c.rare)
$fn$;

CREATE OR REPLACE FUNCTION public.perform_crate(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare v_p player; v_it item; v_c crate; v_back bigint; v_tx int; v_ty int; v_sx int; v_sy int; v_new_id int;
        v_want int; v_fit int; v_names text[] := '{}'; v_r record; v_kind text;
begin
  select * into v_p from player where world_id = p_world and uid = p_uid;

  if p_action = 'place_crate' then
    v_tx := (p_target->>'x')::int; v_ty := (p_target->>'y')::int;
    v_sx := (p_target->>'sx')::int; v_sy := (p_target->>'sy')::int;
    select * into v_it from item where id = target_item(p_target);
    v_kind := crate_kind_of_item(v_it.def);
    if v_kind is null or not consume(p_world, p_uid, v_it.def, 1, v_it.id) then return; end if;
    select coalesce(max(id), 0) + 1 into v_new_id from crate where world_id = p_world;
    -- The wood was already coming across; the rarity was not, so a rare crate
    -- stopped being rare the moment it stood on the ground -- and a rare crate
    -- is the one that holds more.
    -- And its enchantment and its wear, which it keeps standing and takes up again (`enchanting.ts`).
    insert into crate (world_id, id, kind, x, y, sx, sy, material, made_by, rare, ql, enchant, dmg)
    values (p_world, v_new_id, v_kind, v_tx, v_ty, v_sx, v_sy, v_it.extra, p_uid, v_it.rare, v_it.ql, v_it.enchant, v_it.dmg);
    select * into v_c from crate where world_id = p_world and id = v_new_id;
    perform journal_note(p_world, p_uid, 'crate');
    perform tell(p_world, p_uid, 'You set the ' || lower(crate_name(v_c)) || ' down.', 'event');

  elsif p_action = 'pick_up_crate' then
    v_c := target_crate(p_world, p_target);
    if v_c.id is null or crate_units(p_world, v_c.id) > 0 then return; end if;
    delete from crate where world_id = p_world and id = v_c.id;
    v_back := give(p_world, p_uid, (select item from crate_def where crate_def.kind = v_c.kind), 1, v_c.ql, v_c.material, v_c.rare);
    update item set enchant = v_c.enchant, dmg = v_c.dmg where id = v_back;
    perform tell(p_world, p_uid, 'You pick up the '
      || lower((select name from crate_def where crate_def.kind = v_c.kind)) || '.'
      || case when v_c.deed then ' Deed workers will leave their finds by the token until a deed crate stands again.'
              else '' end, 'event');

  elsif p_action = 'crate_take_all' then
    v_c := target_crate(p_world, p_target);
    if v_c.id is null then return; end if;
    for v_r in select * from item where world_id = p_world and holder = 'crate' and crate = v_c.id order by id loop
      v_names := v_names || (case when v_r.count > 1 then v_r.count || ' × ' else '' end
        || made_name(v_r.def, v_r.piece));
      update item set holder = 'player', holder_uid = p_uid, crate = null, gx = null, gy = null
        where id = v_r.id;
    end loop;
    -- And onto the piles already in the pack. Emptying a crate is the loudest
    -- of these: a worker fills it a load at a time, so a crate of seeds is a
    -- dozen stacks, and taking them all used to put a dozen stacks in the pack.
    perform pack_fold(p_world, p_uid);
    if array_length(v_names, 1) is null then return; end if;
    perform tell(p_world, p_uid, 'You take ' || array_to_string(v_names, ', ') || ' from the crate.', 'event');

  elsif p_action = 'store_in_crate' then
    v_c := named_crate(p_world, v_p.x, v_p.y, p_target);
    if v_c.id is null then v_c := nearest_crate(p_world, v_p.x, v_p.y); end if;
    select * into v_it from item where id = target_item(p_target);
    if v_c.id is null or not found then return; end if;
    v_want := greatest(1, least(v_it.count, coalesce((p_target->>'count')::int, 1)));
    if coalesce((select stackable from item_def where id = v_it.def), false) then
      -- Stackables merge into the crate's own stack of them, a part at a time,
      -- and as far as there is room: what is over stays in the pack.
      v_fit := least(v_want, crate_spare(p_world, v_c));
      if v_fit <= 0 or not crate_add(p_world, v_c.id, v_it.def, v_fit, v_it.ql, v_it.extra, v_it.piece) then
        perform tell(p_world, p_uid, 'The ' || lower(crate_name(v_c)) || ' is full.', 'error');
        return;
      end if;
      if v_fit >= v_it.count then delete from item where id = v_it.id;
      else update item set count = count - v_fit where id = v_it.id; end if;
    else
      -- Anything else is the same row moved into the crate, so a bag keeps
      -- what is in it: the contents belong to the bag, wherever the bag is.
      -- The row used to be copied and the original deleted, and the deletion
      -- took the bag's contents with it.
      if crate_units(p_world, v_c.id) + v_it.count > crate_capacity(v_c) then
        perform tell(p_world, p_uid, 'The ' || lower(crate_name(v_c)) || ' is full.', 'error');
        return;
      end if;
      update item set holder = 'crate', holder_uid = null, crate = v_c.id, gx = v_c.x, gy = v_c.y, inside = null, placed = null
        where id = v_it.id;
      v_fit := v_it.count;
    end if;
    perform tell(p_world, p_uid,
      stored_line(v_fit, made_name(v_it.def, v_it.piece), crate_name(v_c), v_want - v_fit), 'event');

  elsif p_action = 'take_from_store' then
    select * into v_it from item where id = target_item(p_target) and world_id = p_world;
    if not found or v_it.holder not in ('crate', 'furniture', 'bag') then return; end if;
    v_want := greatest(1, least(v_it.count, coalesce((p_target->>'count')::int, 1)));
    -- `move_part` splits the stack, merges into one you already carry, and
    -- clears whichever of `crate` and `placed` was holding it.
    if move_part(v_it.id, v_want, 'player', p_uid, null, null) is null then return; end if;
    perform tell(p_world, p_uid, 'You take '
      || case when v_want > 1 then v_want || ' × ' else 'the ' end
      || lower((select coalesce(name, v_it.def) from item_def where id = v_it.def))
      || ' out.', 'event');
  end if;
end $function$
;

create or replace function enchant_refusal(p_world uuid, p_uid uuid, p_target jsonb) returns text
  language sql stable as $fn$
  select case when p_target->>'kind' = 'crate' then (select s.o_why from enchant_setting_crate(p_world, p_uid, p_target) s)
              when enchant_placed_kind(p_target) then (select s.o_why from enchant_setting_placed(p_world, p_uid, p_target) s)
              else (select s.o_why from enchant_setting(p_world, p_uid, p_target) s) end
$fn$;

create or replace function perform_enchant(p_world uuid, p_uid uuid, p_target jsonb) returns void
  language plpgsql as $fn$
declare s record; e record; q record; v_skill double precision; v_name text; v_kind text; v_dmg double precision;
        v_sql double precision; v_iql double precision; v_r1 double precision; v_r2 double precision;
begin
  -- A thing standing where it was set down is enchanted where it stands (`perform_enchant_placed`).
  if p_target->>'kind' = 'crate' then
    perform perform_enchant_crate(p_world, p_uid, p_target);
    return;
  end if;
  if enchant_placed_kind(p_target) then
    perform perform_enchant_placed(p_world, p_uid, p_target);
    return;
  end if;
  -- Both rolls first, as the browser takes them: whether it takes, then its quality or whether the weapon breaks.
  v_r1 := random();
  v_r2 := random();
  select * into s from enchant_setting(p_world, p_uid, p_target);
  if s.o_why is not null then
    perform tell(p_world, p_uid, s.o_why, 'error');
    return;
  end if;
  select * into e from enchantments() x where x.id = s.o_id;
  v_skill := skill_of(p_world, p_uid, enchanting_skill());
  v_name := lower(item_name(s.o_item));
  v_kind := lower((select d.name from item_def d where d.id = (s.o_item).def));
  v_sql := (s.o_scroll).ql;
  v_iql := (s.o_item).ql;
  perform consume(p_world, p_uid, (s.o_scroll).def, 1, (s.o_scroll).id);
  if v_r1 < enchant_chance(v_skill, v_sql) then
    select * into q from enchant_ql(v_skill, v_sql, v_iql, v_r2);
    update item set enchant = jsonb_build_object('id', e.id, 'ql', q.o_ql) where id = (s.o_item).id;
    perform skill_raise(p_world, p_uid, enchanting_skill(), 1);
    perform tell(p_world, p_uid, enchanted_said(e.name, v_name, v_kind, q.o_ql, q.o_held, v_sql, v_iql), 'event');
    return;
  end if;
  perform skill_raise(p_world, p_uid, enchanting_skill(), try_gain(false));
  if v_r2 < enchant_break() then
    perform enchant_lose(p_world, p_uid, (s.o_item).id);
    perform tell(p_world, p_uid, not_taken_said(e.name, v_name, 'broke', damage_max()), 'error');
    return;
  end if;
  v_dmg := least(damage_max(), (s.o_item).dmg + enchant_harm());
  if v_dmg >= damage_max() then
    perform enchant_lose(p_world, p_uid, (s.o_item).id);
    perform tell(p_world, p_uid, not_taken_said(e.name, v_name, 'harmBroke', damage_max()), 'error');
  else
    update item set dmg = v_dmg where id = (s.o_item).id;
    perform tell(p_world, p_uid, not_taken_said(e.name, v_name, 'harm', v_dmg), 'error');
  end if;
end $fn$;

select private.lock_doors();
