-- Enchanting part 3c: Fleetfoot and Tamer's Bridle.
--
-- Fleetfoot (2 wind, a saddle): a mount wearing it carries you QL/10 %
-- faster, after its makers' marks on its tack (tack_speed). Tamer's Bridle
-- (2 life, a bridle): an offering made with it in the pack QL/4 % likelier to
-- tame (tame_chance, the bridle as the job's tool), and a mount wearing it
-- never breaks off a fight however far from its keeper it goes
-- (companion_target, as Love's Steady Herd). The enchantments ride on the
-- mount with the tack (creature.tack_enchant, new; perform_ride) and come back
-- into the pack with it (give_enchanted), and an enchanted saddle or bridle is
-- a pile of its own (stack_key, as the browser's `sameStack`). rpc_creatures
-- carries them to the browser.
--
-- Rewritten from their newest definitions:
--   stack_key         20260927030350_the_carpenter_moved_onto_perks.sql
--   tack_speed        20260927080235_the_tailor_moved_onto_perks.sql
--   perform_ride      20260927080235_the_tailor_moved_onto_perks.sql
--   companion_target  20261010072602_love_and_power_move_onto_tiers.sql
--   tame_chance       20261010072602_love_and_power_move_onto_tiers.sql
--   rpc_creatures     20261011014703_three_for_a_bow.sql

select private.shut('alter table creature add column if not exists tack_enchant jsonb');

/** What one enchantment holding this effect comes to at its quality, or nothing (`swingEnchant`). */
create or replace function enchant_value(p_enchant jsonb, p_effect text) returns double precision language sql immutable as $fn$
  select coalesce((select greatest(0, least(ql_top(), (p_enchant->>'ql')::double precision)) * e.per_ql
                     from enchantments() e where e.id = p_enchant->>'id' and e.effect = p_effect), 0)
$fn$;

/** What the enchantments in a mount's tack come to for this effect: the most of any one piece (`tackEnchant`). */
create or replace function tack_enchant_of(c creature, p_effect text) returns double precision language sql stable as $fn$
  select coalesce(max(enchant_value(c.tack_enchant -> t.item, p_effect)), 0) from tack_def t
$fn$;

/**
 * A piece of tack back into the pack, its makers' mark and its enchantment
 * with it: onto a pile just like it (`stack_key`), or a pile of its own. The
 * one-at-a-time `give` with an enchantment the row carries.
 */
create or replace function give_enchanted(p_world uuid, p_uid uuid, p_item text, p_ql double precision, p_mark jsonb, p_enchant jsonb)
  returns bigint language plpgsql as $fn$
declare found bigint; fresh item;
begin
  if p_enchant is null then return give(p_world, p_uid, p_item, 1, p_ql, null, null, null, null, p_mark); end if;
  if item_stackable(p_item) then
    fresh.def := p_item; fresh.mark := p_mark; fresh.enchant := p_enchant;
    fresh.locked := false; fresh.lit := false; fresh.issued := false;
    select i.id into found from item i
     where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
       and i.def = p_item and stack_key(i) = stack_key(fresh)
     order by i.id limit 1;
    if found is not null then
      update item set ql = (ql * count + greatest(0, least(100, p_ql))) / (count + 1), count = count + 1 where id = found;
      return found;
    end if;
  end if;
  insert into item (world_id, holder, holder_uid, def, ql, count, mark, enchant)
  values (p_world, 'player', p_uid, p_item, greatest(0, least(100, p_ql)), 1, p_mark, p_enchant)
  returning id into found;
  return found;
end $fn$;

CREATE OR REPLACE FUNCTION public.stack_key(i item)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case when i.locked or i.lit then null
              else jsonb_build_array(i.def, i.inside, i.extra, i.rare, i.dye, i.bless,
                                     i.maker, i.piece, i.issued, i.charges, i.keyed, i.mark,
                                     -- An enchanted saddle or bridle is a pile of its own (`sameStack`).
                                     i.enchant) end
$function$;

create or replace function tack_speed(c creature) returns double precision
  language sql stable as $$
  select greatest(1, coalesce(max(mark_of(c.tack -> t.item, 'speed')), 1))
         -- And a Fleetfoot in its saddle on top (`tackSpeed`).
         * (1 + tack_enchant_of(c, 'fleet')) from tack_def t
$$;

CREATE OR REPLACE FUNCTION public.companion_target(p_world uuid, c creature, k player)
 RETURNS creature
 LANGUAGE plpgsql
 STABLE
AS $function$
declare q creature; v_threat int;
        -- As far as it looks and as far as it follows a fight: further for its keeper's Long Leash.
        v_sight double precision := pk(k.class_mul, 'sight:companion', companion_sight());
        v_leash double precision := pk(k.class_mul, 'leash:companion', companion_leash());
begin
  if k.away then return null; end if;
  -- Fallen back (`order_heel`): at your side, and no fight of its own until the time is up.
  if c.heel_until is not null and c.heel_until > now() then return null; end if;
  -- What it is on, whatever its stance: a passive one is on something only when told (`order_attack`).
  if c.enemy is not null then
    select * into q from creature where world_id = p_world and id = c.enemy;
    if found and q.mode = 'wild' and q.hitched_to is null
       and sqrt((creature_x(q) - k.x) ^ 2 + (creature_y(q) - k.y) ^ 2)
           -- However far for Love's Steady Herd, or a Tamer's Bridle on it.
           <= (case when path_fx(p_world, k.uid, 'steady', 0) > 0 or (c.tacked and tack_enchant_of(c, 'tame') > 0) then 'Infinity'::double precision
                    when c.stance = 'guard' then guard_range() else v_leash end) then
      return q;
    end if;
    return null;
  end if;
  if c.stance = 'passive' then return null; end if;
  -- Guarding you: whatever is hunting you within `companion_sight`, nearest first, before it lands a blow.
  if c.stance = 'guard' then
    select qq.* into q from creature qq
      where qq.world_id = p_world and qq.hunting = k.uid and qq.mode = 'wild' and qq.hitched_to is null
        and sqrt((creature_x(qq) - k.x) ^ 2 + (creature_y(qq) - k.y) ^ 2) <= v_sight
      order by (creature_x(qq) - k.x) ^ 2 + (creature_y(qq) - k.y) ^ 2, qq.id
      limit 1;
    if found then return q; end if;
  end if;
  if c.stance = 'aggressive' then
    select qq.* into q from creature qq
      where qq.world_id = p_world and qq.mode = 'wild' and qq.hitched_to is null
        -- The box first, which the index can serve; the circle second.
        and qq.to_x between k.x - (v_sight + leg_slack()) and k.x + (v_sight + leg_slack())
        and qq.to_y between k.y - (v_sight + leg_slack()) and k.y + (v_sight + leg_slack())
        and sqrt((creature_x(qq) - k.x) ^ 2 + (creature_y(qq) - k.y) ^ 2) <= v_sight
      order by (creature_x(qq) - k.x) ^ 2 + (creature_y(qq) - k.y) ^ 2, qq.id
      limit 1;
    if not found then return null; end if;
    return q;
  end if;
  v_threat := case
    when c.hurt_at > now() - make_interval(secs => blow_memory()) then c.hurt_by
    when (k.stats->>'hurtAt')::timestamptz > now() - make_interval(secs => blow_memory())
      then (k.stats->>'hurtBy')::int
  end;
  if v_threat is null or v_threat = c.id then return null; end if;
  select * into q from creature where world_id = p_world and id = v_threat and mode = 'wild'
    and hitched_to is null;
  if not found then return null; end if;
  return q;
end $function$;

CREATE OR REPLACE FUNCTION public.tame_chance(p_world uuid, p_uid uuid, c creature)
 RETURNS double precision
 LANGUAGE sql
 STABLE
AS $function$
  select case when d.monster then 0
    -- Love's Old Friend: a kind you have tamed before is taken at the first offering (`tameChance`).
    when path_fx(p_world, p_uid, 'sure', 0) > 0
         and exists (select 1 from guide g where g.world_id = p_world and g.uid = p_uid and g.species = c.species and g.tamed) then 1
    else
    -- And a Kinship's points on top of whatever the rest comes to (`faith_kinship`).
    least(0.95, greatest(0, least(0.95, (d.tame_chance
      + (skill_of(p_world, p_uid, 'taming') - d.tame_level) / 200
      + case when c.hunger < 0.5 then 0.1 else 0 end
      + coax_bonus(c, pk(p_world, p_uid, 'coax:step', coax_step()))
      + greatest(0, (skill_of(p_world, p_uid, 'soul_strength') - 20) * 0.002))
      -- A young one easier still for a Herdsman's Young Trust.
      * case when age_of(c.born, old_of(c), age_pace(c)) = 'young' then pk(p_world, p_uid, 'tame:young', (age_row(c.born, old_of(c), age_pace(c))).tame)
             else (age_row(c.born, old_of(c), age_pace(c))).tame end
      -- Love's Gentle Hand.
      * path_fx(p_world, p_uid, 'tame', 1)
      -- And a Tamer's Bridle in the pack (`tameChance`).
      * (1 + tool_enchant(p_world, p_uid, 'bridle', 'tame'))
      * class_mul(p_world, p_uid, 'tame', 'soul_strength')
      -- And every offering so many points likelier for a Herdsman's Soft Hand, over all the rest of it.
      + pk(p_world, p_uid, 'tame:offer', 0))) + faith_kinship(p_world, p_uid, c.id)) end
  from species_def d where d.id = c.species
$function$;

CREATE OR REPLACE FUNCTION public.perform_ride(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare c creature; p placed; v vehicle_def; r record; v_names text; v_short text; v_n int; v_it item; v_tack jsonb; v_ench jsonb;
        v_was bigint; v_shore record; v_sail boolean; v_aboard bigint; v_seat int;
begin
  if ride_beast_action(p_action) then
    c := target_creature(p_world, p_target);
    if c.world_id is null then return; end if;

    if p_action = 'tack_creature' then
      -- What each piece carries of its maker's hand goes onto the mount with it (a Tailor's Saddler).
      v_tack := '{}'::jsonb;
      -- And what each is enchanted with (Fleetfoot, Tamer's Bridle).
      v_ench := '{}'::jsonb;
      for r in select item from tack_def order by ord loop
        select * into v_it from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
          and i.def = r.item and not i.locked order by i.id limit 1;
        if v_it.id is null or not consume(p_world, p_uid, r.item, 1, v_it.id) then return; end if;
        if v_it.mark is not null and v_it.mark <> '{}'::jsonb then v_tack := v_tack || jsonb_build_object(r.item, v_it.mark); end if;
        if v_it.enchant is not null then v_ench := v_ench || jsonb_build_object(r.item, v_it.enchant); end if;
      end loop;
      update creature set tacked = true, tack = nullif(v_tack, '{}'::jsonb), tack_enchant = nullif(v_ench, '{}'::jsonb)
        where world_id = p_world and id = c.id;
      perform tell(p_world, p_uid, 'You saddle ' || c.name
        || ' and slip the bit into its mouth. It stands for it.', 'event');

    elsif p_action = 'shoe_creature' then
      if not consume(p_world, p_uid, 'horseshoe', shoes_per_mount()::int) then return; end if;
      update creature set shod_at = now() where world_id = p_world and id = c.id;
      perform tell(p_world, p_uid, 'You nail four shoes onto ' || c.name
        || '''s hooves. They will hold a week: quicker on stone, and up what it would have baulked at.', 'event');

    elsif p_action = 'untack_creature' then
      update creature set tacked = false, tack = null, tack_enchant = null where world_id = p_world and id = c.id;
      for r in select item from tack_def order by ord loop
        perform give_enchanted(p_world, p_uid, r.item, 40, c.tack -> r.item, c.tack_enchant -> r.item);
      end loop;
      perform tell(p_world, p_uid, 'You strip the saddle and bridle off ' || c.name || '.', 'event');

    elsif p_action = 'mount_creature' then
      -- One seat at a time: whoever was up gets down without being asked.
      update creature set rider = null where world_id = p_world and rider = p_uid;
      update creature set rider = p_uid, enemy = null, hunting = null,
          from_x = pl.x, from_y = pl.y, to_x = pl.x, to_y = pl.y,
          leg_at = now(), leg_ends = now(), settled_at = now()
        from player pl
        where creature.world_id = p_world and creature.id = c.id
          and pl.world_id = p_world and pl.uid = p_uid;
      perform journal_note(p_world, p_uid, 'mounted');
      perform tell(p_world, p_uid, 'You take a fistful of mane and swing up onto '
        || c.name || '.', 'event');

    elsif p_action = 'dismount_creature' then
      update creature set rider = null where world_id = p_world and id = c.id;
      perform tell(p_world, p_uid, 'You swing down off ' || c.name || '.', 'event');

    elsif p_action = 'hitch_creature' then
      p := vehicle_for(p_world, p_uid, c);
      if p.id is null or not hitch_up(p_world, c.id, p.id) then
        -- Never in silence: whatever stopped it, in the words the ask uses.
        perform tell(p_world, p_uid, coalesce(ride_refusal(p_world, p_uid, p_action, p_target),
          'You could not get ' || c.name || ' into the traces.'), 'error');
        return;
      end if;
      select * into v from vehicle_def where id = p.sub;
      v_n := team_size(p_world, p.id);
      v_short := case when v_n < v.needs
        then ' It needs ' || (v.needs - v_n) || ' more before it will move.' else '' end;
      perform journal_note(p_world, p_uid, 'hitched');
      perform tell(p_world, p_uid, 'You back ' || c.name || ' into a yoke of the '
        || lower(placed_name(p)) || '. ' || v_n || ' of ' || v.yokes || ' filled.' || v_short, 'event');

    elsif p_action = 'unhitch_creature' then
      v_was := unhitch_one(p_world, c.id);
      perform tell(p_world, p_uid, 'You unbuckle ' || c.name || ' from the '
        || coalesce(lower((select placed_name(q) from placed q where q.id = v_was)), 'traces') || '.', 'event');
    end if;
    return;
  end if;

  select * into p from placed where world_id = p_world and id = (p_target->>'id')::bigint;
  if not found then return; end if;

  if p_action = 'pull_cart' then
    update placed set puller = p_uid where world_id = p_world and id = p.id;
    perform tell(p_world, p_uid, 'You take up the shafts of the ' || lower(placed_name(p))
      || '. It will follow you now, and what you gather goes into it.', 'event');

  elsif p_action = 'drop_cart' then
    update placed set puller = null where world_id = p_world and id = p.id;
    perform tell(p_world, p_uid, 'You set the ' || lower(placed_name(p))
      || ' down and let go of the shafts.', 'event');

  elsif p_action = 'board_vehicle' then
    /*
     * Out of a place on her deck and to her helm: the place is somebody
     * else's to have now -- and a helmsman who had gone away is put in it, so
     * that nobody is left in the sea when she moves off.
     */
    select aboard, seat into v_aboard, v_seat from player where world_id = p_world and uid = p_uid;
    if v_aboard = p.id then
      update player set aboard = null, seat = null where world_id = p_world and uid = p_uid;
      if p.driver is not null and p.driver <> p_uid then
        update player set aboard = p.id, seat = v_seat where world_id = p_world and uid = p.driver;
      end if;
    end if;
    update placed set driver = p_uid where world_id = p_world and id = p.id;
    if is_boat(p) then
      select sail into v_sail from boat_def where id = p.sub;
      perform tell(p_world, p_uid, 'You push off and climb into the ' || lower(placed_name(p)) || '. '
        || case when v_sail then 'The sail fills and she comes round.'
                else 'You ship the oars and take a stroke.' end, 'event');
      return;
    end if;
    select string_agg(t.name, ' and ' order by t.id) into v_names from team_of(p_world, p.id) t;
    perform tell(p_world, p_uid, 'You climb onto the ' || lower(placed_name(p)) || ' and take the reins. '
      || coalesce(v_names, 'Nothing') || ' lean into the traces. What you gather from the seat goes into it.', 'event');

  elsif p_action = 'board_passenger' then
    -- One at a time: two people asking for the last place do not both get it.
    perform 1 from placed where world_id = p_world and id = p.id for update;
    select min(s) into v_seat from generate_series(1, boat_places(p)) s
      where not exists (select 1 from player pp where pp.world_id = p_world and pp.aboard = p.id and pp.seat = s);
    if v_seat is null then return; end if;
    update player set aboard = p.id, seat = v_seat, x = p.cx, y = p.cy, level = 0, moved_at = now()
      where world_id = p_world and uid = p_uid;
    perform tell(p_world, p_uid, 'You climb aboard the ' || lower(placed_name(p)) || ' and find a place on deck. '
      || (select count(*) from player pp where pp.world_id = p_world and pp.aboard = p.id) || ' of '
      || boat_places(p) || ' places are taken.', 'event');

  elsif p_action = 'leave_passenger' then
    select s.x, s.y into v_shore from player pl, lateral shore_near(p_world, pl.x, pl.y) s
      where pl.world_id = p_world and pl.uid = p_uid;
    if v_shore.x is null then return; end if;
    update player set aboard = null, seat = null, x = v_shore.x + 0.5, y = v_shore.y + 0.5, moved_at = now()
      where world_id = p_world and uid = p_uid;
    perform tell(p_world, p_uid, 'You step ashore from the ' || lower(placed_name(p)) || '.', 'event');

  elsif p_action = 'leave_vehicle' then
    if is_boat(p) then
      select s.x, s.y into v_shore from player pl, lateral shore_near(p_world, pl.x, pl.y) s
        where pl.world_id = p_world and pl.uid = p_uid;
      perform leave_vehicle(p_world, p.id);
      if v_shore.x is not null then
        update player set x = v_shore.x + 0.5, y = v_shore.y + 0.5, moved_at = now()
          where world_id = p_world and uid = p_uid;
      end if;
      perform tell(p_world, p_uid, 'You bring the ' || lower(placed_name(p))
        || ' alongside and step ashore.', 'event');
      return;
    end if;
    perform leave_vehicle(p_world, p.id);
    perform tell(p_world, p_uid, 'You climb down off the ' || lower(placed_name(p)) || '.', 'event');

  elsif p_action = 'unhitch_team' then
    v_n := unhitch_all(p_world, p.id);
    perform tell(p_world, p_uid, 'You let ' || case when v_n = 1 then 'it' else 'them' end
      || ' out of the traces of the ' || lower(placed_name(p)) || '.', 'event');
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.rpc_creatures(p_world uuid, p_range double precision DEFAULT 40)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); p player;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select * into p from player where world_id = p_world and uid = me;
  if not found then raise exception 'you are not on this island'; end if;
  /*
   * And the wildlife is not moved from in here any more.
   *
   * This is a read. It ran `creature_sweep`, which settles every creature in
   * forty tiles whose turn is due — up to a hundred and twenty of them, each
   * one a piece of animal thinking, some of it pathing. On the call a browser
   * makes every second, for every player, while the browser waits for the
   * answer.
   *
   * And `world_tick` already does it. It takes the same list of live bodies,
   * dedupes them onto their tiles, and sweeps forty tiles round each one, once
   * a second, on a clock nobody is waiting for. So this was the same work a
   * second time, on the worst possible thread to do it on: measured here at
   * 257 to 466 ms a call against 2.7 ms for the ground read beside it, which
   * is why an island would hand over a deed in a few seconds and its wildlife
   * not at all — eight PostgREST slots, and this sitting in them.
   *
   * Where there is no `pg_cron` there is no other clock, so it still happens
   * here: the suite's bare postgres and any project without the extension are
   * exactly as they were. The guard is the one `world_tick` already uses for
   * the stocking, for the same reason and with the same shape.
   */
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform creature_sweep(p_world, p.x, p.y, p_range);
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'species', c.species, 'name', c.name, 'variant', c.variant,
      'mode', c.mode, 'stance', c.stance, 'job', c.job, 'shod', shod(c), 'tack', c.tack, 'tack_enchant', c.tack_enchant,
      'x', creature_x(c), 'y', creature_y(c),
      'fromX', c.from_x, 'fromY', c.from_y, 'toX', c.to_x, 'toY', c.to_y,
      /*
       * How long the leg is and how much of it is left, in seconds.
       *
       * It used to hand over the two instants themselves, which asks a browser
       * to agree with this database about what time it is. A phone whose clock
       * is twenty seconds out pins every leg at one end or the other and then
       * re-pins it on the next answer, which reads as a thing jumping about —
       * and the action bar learnt this lesson already: "a browser whose clock
       * is a minute out still draws the right bar".
       */
      'legFor', case when c.leg_ends > c.leg_at
                     then extract(epoch from (c.leg_ends - c.leg_at)) else 0 end,
      'legLeft', greatest(0, extract(epoch from (c.leg_ends - now()))),
      'health', c.health, 'max', max_health(c), 'hunger', c.hunger,
      'sex', c.sex, 'age', age_of(c.born, old_of(c), age_pace(c)), 'traits', c.traits,
      'hunting', c.hunting = me, 'mine', coalesce(c.keeper = me, false),
      -- How long is left of a heavy blow it is drawing back for, so it can be seen coming.
      'windup', case when c.windup_at > now() then extract(epoch from (c.windup_at - now())) end,
      -- And how long is left of a stun on it (`enchant_stun`), for the target panel.
      'stunned', stun_left(p_world, c.id),
      -- And how long is left of a slow on it, and the share of its pace it goes at (`enchant_frost`, a Hamstring's, a Binder's).
      'slowed', case when c.slow_until > now() and coalesce(c.slow, 1) < 1 then extract(epoch from (c.slow_until - now())) end,
      'slowPace', case when c.slow_until > now() and coalesce(c.slow, 1) < 1 then c.slow end,
      -- Which one leads the pack it hunts with, which the browser says of the leader.
      'lead', c.pack_lead,
      -- And the tame one it has turned on, when it has.
      'brawl', c.brawl,
      -- What its keeper's perks make of keeping it, which the browser ages and feeds it by.
      'kept', c.kept,
      -- Which vehicle it is in the traces of, which no browser has ever been told.
      'hitchedTo', c.hitched_to)
      /*
       * And, for your own only, what the card has been making up.
       *
       * A worker's trade, its learning, its brushing and what is in its arms
       * are all here and none of them have ever gone out, so the browser
       * filled them in from the book: every wildermon on an island read
       * Foraging 1.00, Experience 0.0, Care 0% and "Looking for work", however
       * long it had been at it. Yours only, because it is a card you open
       * about your own and nobody needs five numbers about a wild boar.
       */
      || case when c.keeper = me then jsonb_build_object(
           'care', c.care, 'xp', c.xp, 'skills', c.skills,
           'phase', c.phase, 'carrying', c.carrying,
           -- What it is fighting, for the line drawn to it.
           'enemy', c.enemy)
         else '{}'::jsonb end
      /*
       * And its pedigree, for anything bred: whole for your own, and for
       * anybody else's saying where a trait came from only for the traits
       * you can read, by the rule the card's chips keep.
       */
      || case when c.pedigree is null then '{}'::jsonb
              when c.keeper = me then jsonb_build_object('pedigree', c.pedigree)
              else jsonb_build_object('pedigree', pedigree_seen(p_world, me, c.pedigree)) end
      -- And how rare it came into the world, for a rare one: the browser draws it bigger and shining, and reckons with it.
      || case when c.rare is null then '{}'::jsonb else jsonb_build_object('rare', c.rare) end
      order by c.id)
    from creature c
    -- Your own in crates, wherever the crates are; and everything within range.
    where (c.world_id = p_world and c.keeper = me and c.mode = 'stored')
       or (c.world_id = p_world
      /*
       * Where the leg ends, first, because that is what there is an index on.
       *
       * The exact answer below is where the thing is *now*, which is a point
       * on the leg it is walking and so a function of four columns and the
       * clock — nothing a btree can help with, and it was being worked out for
       * every creature on the island before being thrown away. This narrows to
       * the neighbourhood first, generously: `leg_slack` is far longer than
       * any leg the rules make (the longest measured on a real island is 2.13
       * tiles), and anything walking further than that in one leg was already
       * invisible to `creature_sweep`, which has bounded itself this way since
       * it was written.
       */
      and c.to_x between p.x - (p_range + leg_slack()) and p.x + (p_range + leg_slack())
      and c.to_y between p.y - (p_range + leg_slack()) and p.y + (p_range + leg_slack())
      and greatest(abs(creature_x(c) - p.x), abs(creature_y(c) - p.y)) <= p_range)), '[]'::jsonb);
end $function$;

select private.lock_doors();
