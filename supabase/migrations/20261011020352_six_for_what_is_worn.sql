/*
 * Enchanting, part 2c: six for what is worn and held (`enchant.ts`,
 * `enchanting.ts`). Each worn piece adds its share; Stoneskin, Emberward and
 * Thornhide are held to a cap together (`worn_cap`).
 *
 *   * Stoneskin (two earth, any armour or clothing): every blow that reaches
 *     you lands QL/20 percent lighter a piece, 15 percent at most together.
 *   * Emberward (two ice, any armour or clothing): a burn lands QL/5 percent
 *     lighter a piece, half at most together.
 *   * Featherstep (two wind, boots and shoes): you walk QL/20 percent faster
 *     (`travel_speed`).
 *   * Thornhide (two life, any armour or clothing): what a creature's blow did
 *     you, QL/10 percent of it a piece back on it, as a blow of yours that size,
 *     a quarter at most together; owed and paid as a Retribution is.
 *   * Shadowcloak (two dark, what is worn on the chest: the game has no
 *     cloaks): at night a hunter notices you from QL/4 percent closer
 *     (`hunt_settle`).
 *   * Bulwark (two earth, a shield): QL/10 points on the shield's chance of a
 *     block, past its ceiling.
 *
 * Rewritten here, each from the newest migration that defines it:
 *   hurt_player, travel_speed, hunt_settle -- 20261010072602_love_and_power_move_onto_tiers.sql
 */

/** What every piece worn and held of one enchantment comes to together, held to its cap (`wornEnchant`). */
create or replace function worn_enchant(p_world uuid, p_uid uuid, p_effect text) returns double precision language sql stable as $fn$
  select least(coalesce(worn_cap(p_effect), 1e9), coalesce(sum(enchant_of(i, p_effect)), 0))
    from player p cross join lateral jsonb_each_text(coalesce(p.equipped, '{}'::jsonb)) e
    join item i on i.world_id = p.world_id and i.id = nullif(e.value, 'null')::bigint and i.holder = 'player' and i.holder_uid = p.uid
   where p.world_id = p_world and p.uid = p_uid
$fn$;

/** What is left of a blow of this kind after the Stoneskin and Emberward worn (`enchantTaken`). */
create or replace function enchant_guard(p_world uuid, p_uid uuid, p_kind text) returns double precision language sql stable as $fn$
  select (1 - worn_enchant(p_world, p_uid, 'guard'))
       * case when p_kind = 'burn' then 1 - worn_enchant(p_world, p_uid, 'fireguard') else 1 end
$fn$;

/** How far a hunter notices this one from, as a share: less at night in a Shadowcloak (`shadowNotice`). */
create or replace function enchant_shadow(p_world uuid, p_uid uuid) returns double precision language sql stable as $fn$
  select case when is_night(p_world) then 1 - least(1, worn_enchant(p_world, p_uid, 'shadow')) else 1 end
$fn$;

/* ---- hurt_player: from 20261010072602_love_and_power_move_onto_tiers.sql, the newest that defines it. Stoneskin, Emberward, Thornhide and Bulwark. ---- */

CREATE OR REPLACE FUNCTION public.hurt_player(p_world uuid, p_uid uuid, p_raw double precision, p_what text, p_kind text DEFAULT 'bite'::text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare p player; shield item; sh shield_def; chance double precision; roll double precision;
        part text; piece item; cls armour_class_def; soak double precision; taken double precision;
        health double precision; ws jsonb; had jsonb; found_w boolean := false; out_w jsonb := '[]'::jsonb;
        w jsonb; k wound_kind_def; note text; aegis double precision; v_worn double precision;
        v_from creature; v_venom boolean := false; v_dodge double precision; v_guard uuid; v_watch uuid;
begin
  select * into p from player where world_id = p_world and uid = p_uid for update;
  if not found then return; end if;
  -- Dodged, before anything else has its say (`dodge_chance`): your body control, less the armour on you.
  select * into v_from from creature where world_id = p_world and id = (p.stats->>'hurtBy')::int;
  -- Nothing is struck inside a Truce, nor by anything standing in one (`faith_truce`).
  if faith_truce(p_world, p.x, p.y)
     or (v_from.id is not null and faith_truce(p_world, creature_x(v_from), creature_y(v_from))) then
    return;
  end if;
  -- A creature's blow lands on an Archer's Decoy instead, while it holds.
  if v_from.id is not null and (p.blessings->'decoy'->>'until')::timestamptz > now() then
    perform tell(p_world, p_uid, 'The ' || coalesce((select lower(name) from species_def where id = v_from.species), 'creature')
      || ' strikes your decoy.', 'fight');
    return;
  end if;
  -- And none lands at all inside a Warder's Unbreakable.
  if v_from.id is not null and (p.blessings->'unbreakable'->>'until')::timestamptz > now() then
    perform tell(p_world, p_uid, 'The ' || coalesce((select lower(name) from species_def where id = v_from.species), 'creature')
      || '’s blow does not land: ' || (select name from class_spell where id = 'warder_unbreakable') || '.', 'fight');
    perform fight_back(p_world, p_uid, (p.stats->>'hurtBy')::int);
    return;
  end if;
  -- A Sworn Blade's Guardian standing near may take it on a shield instead (`class_guardian`).
  if v_from.id is not null then
    v_guard := class_guardian(p_world, p.x, p.y, p_uid);
    if v_guard is not null then
      perform class_guard_take(p_world, v_guard, p_raw,
        coalesce((select lower(name) from species_def where id = v_from.species), 'creature'), p.name);
      perform tell(p_world, p_uid, (select name from player where world_id = p_world and uid = v_guard)
        || ' takes the ' || coalesce((select lower(name) from species_def where id = v_from.species), 'creature')
        || '’s blow on a shield.', 'fight');
      perform fight_back(p_world, p_uid, (p.stats->>'hurtBy')::int);
      return;
    end if;
  end if;
  -- No roll at all while there is no chance, so nothing else's luck moves.
  v_dodge := dodge_chance(skill_of(p_world, p_uid, 'body_control'), worn_kg(p_world, p_uid));
  if v_dodge > 0 and random() < v_dodge then
    perform skill_raise(p_world, p_uid, 'body_control', dodge_gain());
    perform tell(p_world, p_uid, 'You dodge the '
      || coalesce((select lower(name) from species_def where id = v_from.species), 'blow') || '.', 'fight');
    -- And answered, for a Skirmisher's Riposte: owed now, struck once its row is written (`class_riposte`).
    if v_from.id is not null and pk(p_world, p_uid, 'riposte:blow', 0) > 0 then
      insert into class_mark (world_id, creature_id, kind, val, n, until, by_uid)
        values (p_world, v_from.id, 'riposte', pk(p_world, p_uid, 'riposte:blow', 0), 1, now(), p_uid)
        on conflict (world_id, creature_id, kind) do update set n = coalesce(class_mark.n, 0) + 1
          where class_mark.by_uid = excluded.by_uid;
    end if;
    perform fight_back(p_world, p_uid, (p.stats->>'hurtBy')::int);
    return;
  end if;
  /*
   * A blow that lands. A Warder's Thorns answers it with its share of the
   * creature's own attack, and the nearest other Warder with Watchful within
   * their reach of you turns it on themselves -- both owed now and paid once
   * its row is written (`class_owed_pay`).
   */
  if v_from.id is not null then
    if pk(p.class_mul, 'thorns:attack', 0) > 0 then
      insert into class_mark (world_id, creature_id, kind, val, until, by_uid)
        values (p_world, v_from.id, 'thorns', attack_of(v_from) * pk(p.class_mul, 'thorns:attack', 0), now(), p_uid)
        on conflict (world_id, creature_id, kind) do update set val = class_mark.val + excluded.val, by_uid = excluded.by_uid;
    end if;
    select w.uid into v_watch from player w
     where w.world_id = p_world and w.uid <> p_uid and not w.away and w.combat_class = 'warder'
       and pk(w.class_mul, 'watch:reach', 0) > 0 and v_from.hunting is distinct from w.uid
       and (w.x - p.x) ^ 2 + (w.y - p.y) ^ 2 <= pk(w.class_mul, 'watch:reach', 0) ^ 2
     order by (w.x - p.x) ^ 2 + (w.y - p.y) ^ 2, w.uid limit 1;
    if v_watch is not null then
      insert into class_mark (world_id, creature_id, kind, val, until, by_uid)
        values (p_world, v_from.id, 'watched', 1, now(), v_watch)
        on conflict (world_id, creature_id, kind) do update set by_uid = excluded.by_uid;
    end if;
  end if;
  -- A venomous bite leaves venom in what it opens (`venom_secs`).
  -- A Ward, and then a Shield of Dawn, before anything else is asked of the blow (`faith_blunt`).
  p_raw := faith_blunt(p_world, p_uid, p_raw);
  if p_raw <= 0 then
    perform fight_back(p_world, p_uid, (p.stats->>'hurtBy')::int);
    return;
  end if;
  -- A striker made to Cower lands its share less (`faith_weakened`).
  p_raw := p_raw * faith_weakened(p_world, v_from.id);
  -- And one Disarming Cut left on it lands its share less, counted off (`class_disarm_take`).
  p_raw := p_raw * class_disarm_take(p_world, v_from.id);
  -- And one that is burning lands its share less on a Kindler's Flame Ward (`class_burning`).
  if v_from.id is not null and pk(p.class_mul, 'ward:burning', 1) <> 1 and class_burning(p_world, v_from.id) then
    p_raw := p_raw * pk(p.class_mul, 'ward:burning', 1);
  end if;
  -- And one held, rooted or slowed lands its share less on a Binder's Frost Ward (`class_stilled`),
  if v_from.id is not null and pk(p.class_mul, 'ward:stilled', 1) <> 1 and class_stilled(p_world, v_from) then
    p_raw := p_raw * pk(p.class_mul, 'ward:stilled', 1);
  end if;
  -- and one inside a Dull Claws lands its share less on anybody (`class_dull`),
  if v_from.id is not null then p_raw := p_raw * class_dull(p_world, v_from.id); end if;
  -- and every blow its share less inside a Binder's Still Skin,
  if (p.blessings->'still_skin'->>'until')::timestamptz > now() then
    p_raw := p_raw * (1 - (p.blessings->'still_skin'->>'cut')::double precision);
  end if;
  -- and inside a Warder's Stoneskin, and again inside a Bastion of Stone.
  if (p.blessings->'stoneskin'->>'until')::timestamptz > now() then
    p_raw := p_raw * (1 - (p.blessings->'stoneskin'->>'cut')::double precision);
  end if;
  if (p.blessings->'bastion_stone'->>'until')::timestamptz > now() then
    p_raw := p_raw * (1 - (p.blessings->'bastion_stone'->>'cut')::double precision);
  end if;
  -- And lighter for a Stoneskin you wear, and a burn lighter for an Emberward (`enchantTaken`).
  p_raw := p_raw * enchant_guard(p_world, p_uid, p_kind);
  v_venom := coalesce((select venom from species_def where id = v_from.species), false);
  -- Harder or softer for the way you stand (`stance_taken`), before anything has its say,
  p_raw := p_raw * my_stance_taken(p_world, p_uid, p.fight_stance)
    -- and less inside a Sworn Blade's Last Stand,
    * case when (p.blessings->'last_stand'->>'until')::timestamptz > now()
           then 1 - (p.blessings->'last_stand'->>'cut')::double precision else 1 end
    -- and more inside a Berserker's Battle Rage,
    * case when (p.blessings->'battle_rage'->>'until')::timestamptz > now()
           then (p.blessings->'battle_rage'->>'taken')::double precision else 1 end
    -- and less on a Pikeman's feet that have not moved (Bastion), as `hurtPlayer` has it, which `fight_back` asks the same of;
    * case when p.moved_at is null or p.moved_at <= now() - make_interval(secs => fight_back_still())
           then pk(p.class_mul, 'still:taken', 1) else 1 end;
  -- and harder from something on you that is not what you are fighting: it is at your back (`flank_hit`).
  if is_fight(p.act) and p.act_target->>'kind' = 'creature' and p.stats ? 'hurtBy'
     and (p.act_target->>'id')::int is distinct from (p.stats->>'hurtBy')::int then
    p_raw := p_raw * flank_hit();
  end if;

  -- Being hit in the dark teaches more about watching than hitting does, and
  -- before the shield, because a blow you turned is still a blow you did not
  -- see coming.
  perform fought_in_dark(p_world, p_uid, dark_hit());

  /*
   * The skin a warder put over you, which takes the blow instead and is spent
   * doing it.
   *
   * Before the shield, because it is not a thing you are holding -- it is
   * between the blow and everything you are holding. A skin that covers the
   * whole blow stops it dead; one that does not goes, and what is left of the
   * blow carries on into the shield and the armour as it always did. Nothing
   * downstream of here knows it happened.
   */
  aegis := coalesce((p.stats->>'aegis')::double precision, 0);
  if aegis > 0 then
    if aegis >= p_raw then
      update player set stats = jsonb_set(stats, '{aegis}', to_jsonb(aegis - p_raw))
        where world_id = p_world and uid = p_uid;
      perform tell(p_world, p_uid, 'The ward takes ' || p_what || ', and holds.', 'fight');
      -- Taken to the last of it: a Second Wind, and a Ward Link of whoever laid it (`warder_skin_spent`).
      if aegis - p_raw <= 1e-9 then perform warder_skin_spent(p_world, p_uid); end if;
      perform fight_back(p_world, p_uid, (p.stats->>'hurtBy')::int);
      return;
    end if;
    update player set stats = jsonb_set(stats, '{aegis}', to_jsonb(0::double precision))
      where world_id = p_world and uid = p_uid;
    p_raw := p_raw - aegis;
    perform tell(p_world, p_uid, 'The ward goes with a sound like ice, and the rest of it reaches you.', 'fight');
    perform warder_skin_spent(p_world, p_uid);
  end if;

  -- The shield, next.
  shield := worn(p_world, p_uid, 'offhand');
  if shield.id is not null then
    select * into sh from shield_def where id = shield.def;
    if found then
      -- With what a Sworn Blade's Shield Mastery adds, under the ceiling it raises (`shield_block`).
      -- And a Bulwark's points on top, past the ceiling (`worn_enchant`).
      chance := (shield_block(p_world, p_uid, sh, shield.ql) + worn_enchant(p_world, p_uid, 'block'))
        -- Less of one for every other thing on you than the one that struck (`crowd_block`).
        * greatest(0, 1 - crowd_block() * (select count(*) from creature o
            where o.world_id = p_world and o.hunting = p_uid and o.mode = 'wild' and o.health > 0 and o.brawl is null
              and o.id is distinct from (p.stats->>'hurtBy')::int));
      perform skill_raise(p_world, p_uid, 'shields', 0.12);
      if random() < chance then
        -- Less for a Mender's Armour Care.
        update item set dmg = least(100, dmg + p_raw * 3 * pk(p_world, p_uid, 'worn:shield', 1)) where id = shield.id;
        perform skill_raise(p_world, p_uid, 'shields', 0.5);
        perform tell(p_world, p_uid, 'You take ' || p_what || ' on your '
          || lower((select name from item_def where id = shield.def)) || '.', 'fight');
        if v_from.id is not null then
          -- A Sworn Blade's Counterweight: its next blow put back, paid by its own turn (`class_stagger_owed`).
          if pk(p.class_mul, 'stagger:block', 0) > 0 then
            insert into class_mark (world_id, creature_id, kind, val, until, by_uid)
              values (p_world, v_from.id, 'stagger', pk(p.class_mul, 'stagger:block', 0), now() + interval '1 minute', p_uid)
              on conflict (world_id, creature_id, kind) do update set val = class_mark.val + excluded.val, until = excluded.until;
          end if;
          -- And a Deflect sends its share of the blow back, paid as a Retribution's is (`faith_owed`).
          if (p.blessings->'deflect'->>'until')::timestamptz > now() then
            insert into faith_owed (world_id, creature_id, dmg, from_uid)
              values (p_world, v_from.id, p_raw * (p.blessings->'deflect'->>'share')::double precision / blow_share(), p_uid);
          end if;
        end if;
        -- A blow turned is still a blow, and you turn on whatever struck it.
        perform fight_back(p_world, p_uid, (p.stats->>'hurtBy')::int);
        return;
      end if;
    end if;
  end if;

  -- Then wherever it lands.
  roll := random();
  select h.slot into part from (
    select slot, sum(share) over (order by ord) as upto from hit_location) h
  where roll <= h.upto order by h.upto limit 1;
  part := coalesce(part, 'chest');

  taken := p_raw;
  note := '';
  piece := worn(p_world, p_uid, part);
  if piece.id is not null and exists (select 1 from armour_def where id = piece.def) then
    select c.* into cls from armour_def a join armour_class_def c on c.id = a.cls where a.id = piece.def;
    -- And the trade, on the line of armour this piece belongs to: a pikeman's
    -- harness does nothing for the leather an archer is wearing.
    soak := piece_soak(piece, skill_of(p_world, p_uid, cls.skill))
          * class_mul(p_world, p_uid, 'guard', cls.skill)
          -- And what this class of armour makes of this kind of blow (`armour_vs`).
          * armour_vs(cls.id, p_kind)
          -- And more for Power's Ironhide (`absorb`).
          * path_fx(p_world, p_uid, 'hide', 1);
    -- Armour is learned by being hit in it, and worn out the same way.
    perform skill_raise(p_world, p_uid, cls.skill, 0.4);
    -- Less for a Mender's Armour Care.
    -- And a burn wears it out `burn_wear` times as fast.
    v_worn := p_raw * 4 * pk(p_world, p_uid, 'worn:armour', 1) * case when p_kind = 'burn' then burn_wear() else 1 end;
    update item set dmg = least(100, dmg + v_worn) where id = piece.id;
    if (select i.dmg from item i where i.id = piece.id) >= 100 then
      delete from item where id = piece.id;
      update player set equipped = equipped - part where world_id = p_world and uid = p_uid;
      perform tell(p_world, p_uid, 'Your ' || lower((select name from item_def where id = piece.def))
        || ' is beaten to pieces and falls away.', 'fight');
    else
      note := ', though your ' || lower((select name from item_def where id = piece.def)) || ' takes the worst of it';
    end if;
    taken := p_raw * (1 - least(0.92, soak));
  end if;

  select * into k from wound_kind_def where id = p_kind;
  -- Open a wound, or deepen one of the same kind already in that place.
  for w in select * from jsonb_array_elements(coalesce(p.wounds, '[]'::jsonb)) loop
    if not found_w and w->>'kind' = p_kind and w->>'part' = part and not (w->>'infected')::boolean then
      -- Less of a wound than of a blow for a Sworn Blade's Battle-Hardened; the health it takes is the same.
      w := jsonb_set(w, '{severity}', to_jsonb((w->>'severity')::double precision + taken * pk(p.class_mul, 'severity:wound', 1)));
      if k.bleed > 0.001 then w := jsonb_set(w, '{bleeding}', 'true'); end if;
      if v_venom then w := jsonb_set(w, '{venom}', to_jsonb(venom_secs())); end if;
      found_w := true;
    end if;
    out_w := out_w || w;
  end loop;
  if not found_w then
    -- A bruise does not bleed; everything else does until it is seen to. And a fresh one less deep for a Pikeman's Scarred.
    w := jsonb_build_object('kind', p_kind, 'part', part,
      'severity', taken * pk(p.class_mul, 'severity:wound', 1) * pk(p.class_mul, 'severity:new', 1),
      'bleeding', p_kind <> 'crush', 'infected', false, 'dressing', null, 'at', now())
      || case when v_venom then jsonb_build_object('venom', venom_secs()) else '{}'::jsonb end;
    out_w := out_w || w;
  end if;

  -- A Retribution's share of what landed goes back to whatever struck, paid when it is next settled (`faith_owed`).
  if v_from.id is not null and (p.blessings->'retribution'->>'until')::timestamptz > now() then
    insert into faith_owed (world_id, creature_id, dmg, from_uid)
      values (p_world, v_from.id, taken * (p.blessings->'retribution'->>'share')::double precision / blow_share(), p_uid);
  end if;
  -- And a Thornhide's share of what landed back on whatever struck, paid as a Retribution's is (`faith_owed`).
  if v_from.id is not null and worn_enchant(p_world, p_uid, 'thorns') > 0 then
    insert into faith_owed (world_id, creature_id, dmg, from_uid)
      values (p_world, v_from.id, taken * worn_enchant(p_world, p_uid, 'thorns') / blow_share(), p_uid);
  end if;
  -- And answered by your companion inside a Beastmaster's Vengeance: owed now, struck once its row is written (`class_vengeance`).
  if v_from.id is not null and (p.blessings->'vengeance'->>'until')::timestamptz > now() then
    insert into class_mark (world_id, creature_id, kind, val, n, until, by_uid)
      values (p_world, v_from.id, 'vengeance', (p.blessings->'vengeance'->>'more')::double precision, 1, now(), p_uid)
      on conflict (world_id, creature_id, kind) do update set n = coalesce(class_mark.n, 0) + 1
        where class_mark.by_uid = excluded.by_uid;
  end if;
  -- And set alight for a Kindler's Burning Retort: owed now, lit once its row is written (`class_owed_pay`).
  if v_from.id is not null and pk(p.class_mul, 'retort:each', 0) > 0 then
    insert into class_mark (world_id, creature_id, kind, val, until, by_uid)
      values (p_world, v_from.id, 'retort', pk(p.class_mul, 'retort:each', 0), now(), p_uid)
      on conflict (world_id, creature_id, kind) do update set val = excluded.val, by_uid = excluded.by_uid;
  end if;
  -- A share of it on your companion, for a Beastmaster's Feral Bond or Shared Wounds (`class_bond_take`).
  taken := class_bond_take(p_world, p_uid, taken, v_from.id);
  -- And an Oath puts half of it on the friend sworn to (`faith_oath`).
  taken := faith_oath(p_world, p_uid, taken);
  health := greatest(0, coalesce((p.stats->>'health')::double precision, 1) - taken);
  /*
   * Built from the row as it stands rather than from the copy taken at the top
   * of this function.
   *
   * `p` is a snapshot, and writing `p.stats` back puts everything in it back
   * -- including anything this function itself changed on the way down. That
   * was harmless while nothing did, and the ward is the first thing that does:
   * it was spent against the blow, and then handed straight back, so a warder's
   * skin absorbed for ever. Measured, before the fix: a 0.15 skin took 0.15 of
   * a 0.20 blow, the remaining 0.05 opened a wound as it should -- and the skin
   * read 0.15 again afterwards.
   *
   * Unqualified, `stats` is the column of the row being updated, which is the
   * live value. Nothing else in here reads it after this point.
   */
  update player set wounds = out_w,
      stats = jsonb_set(jsonb_set(stats, '{health}', to_jsonb(health)),
                        '{hurtSettled}', to_jsonb(now()))
    where world_id = p_world and uid = p_uid;
  -- And a sitting it lands in is over, with nothing come of it (`sitting_struck`), before anything turns to fight.
  perform sitting_struck(p_world, p_uid);
  perform tell(p_world, p_uid, p_what || note || '. You have ' || wound_text(w) || '.', 'fight');
  -- And a Second Life, which the killing blow spends instead of you (`faith_second_life`).
  -- Undying holds you at its floor and is not spent; a Second Life is.
  if health <= 0 and faith_undying(p_world, p_uid) then perform fight_back(p_world, p_uid, (p.stats->>'hurtBy')::int);
  elsif health <= 0 and faith_second_life(p_world, p_uid) then perform fight_back(p_world, p_uid, (p.stats->>'hurtBy')::int);
  -- And Power's Hard to Kill, once in so long (`path_hard_to_kill`).
  elsif health <= 0 and path_hard_to_kill(p_world, p_uid) then perform fight_back(p_world, p_uid, (p.stats->>'hurtBy')::int);
  elsif health <= 0 then perform player_die(p_world, p_uid);
  else perform fight_back(p_world, p_uid, (p.stats->>'hurtBy')::int); end if;
end $function$;

/* ---- travel_speed: from 20261010072602_love_and_power_move_onto_tiers.sql, the newest that defines it. Featherstep. ---- */

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
      return hull_speed(p_world, p_uid, p) * mark_of(p.mark, 'speed')
           * sailing_pace(skill_of(p_world, p_uid, sailing_skill()));
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

/* ---- hunt_settle: from 20261010072602_love_and_power_move_onto_tiers.sql, the newest that defines it. Shadowcloak. ---- */

CREATE OR REPLACE FUNCTION public.hunt_settle(p_world uuid, c creature, d species_def, a age_def)
 RETURNS creature
 LANGUAGE plpgsql
AS $function$
declare p record; v_dist double precision; v_pace double precision; v_guard int := 0;
        v_cx double precision; v_cy double precision; v_secs double precision;
        v_ax double precision; v_ay double precision; v_step record;
        m creature; l creature; v_n int := 0; v_k int := 0; v_slot double precision; v_own double precision;
        v_turn double precision; v_b double precision; v_run double precision; v_nerve boolean := false;
        v_bl jsonb; v_fend double precision; v_brace double precision; v_braced boolean := false; v_t double precision;
begin
  v_cx := creature_x(c); v_cy := creature_y(c);
  -- A Radiance burns what is hunting somebody inside it (`faith_radiance`).
  if c.hunting is not null then c := faith_radiance(p_world, c, v_cx, v_cy); end if;
  /*
   * One of a pack that is not after anybody hears another of its kind within
   * `pack_call` that is, and comes for the same one (`packmateOn`).
   */
  if c.hunting is null and d.hunter and d.pack and (c.hunt_again is null or c.hunt_again <= now()) then
    select mm.* into m from creature mm
      where mm.world_id = p_world and mm.hunting is not null and mm.species = c.species
        and mm.id <> c.id and mm.mode = 'wild'
        and (creature_x(mm) - v_cx) ^ 2 + (creature_y(mm) - v_cy) ^ 2 <= pack_call() ^ 2
      order by (creature_x(mm) - v_cx) ^ 2 + (creature_y(mm) - v_cy) ^ 2, mm.id
      limit 1;
  end if;
  /*
   * Whoever it is already after, if anybody: a beast you struck stays on you
   * (`engage_beast`) rather than on whoever happens to be nearer. Then whoever
   * its pack is after, and otherwise the nearest, for a hunter to notice.
   */
  if c.hunting is not null then
    select pl.uid, pl.x, pl.y, sqrt((pl.x - v_cx) ^ 2 + (pl.y - v_cy) ^ 2) as d into p
      from player pl where pl.world_id = p_world and pl.uid = c.hunting;
  elsif m.id is not null then
    select pl.uid, pl.x, pl.y, sqrt((pl.x - v_cx) ^ 2 + (pl.y - v_cy) ^ 2) as d into p
      from player pl where pl.world_id = p_world and pl.uid = m.hunting;
  else
    select * into p from nearest_player(p_world, v_cx, v_cy);
  end if;
  if not found then c.hunting := null; return c; end if;

  if c.hunting is not null then
    /*
     * How far it has come from where it started, which is the one measure that
     * grows while it chases.
     *
     * Reported as being chased until you are dead, and that is exactly what
     * happened: every give-up here was about the gap between hunter and
     * hunted, and a hunter runs at `speed * 1.15` — so the gap it was measured
     * against was a gap it was closing. Outrunning one was the only way to
     * lose it, and most things on this island are faster than a body carrying
     * a pack.
     *
     * So the leash is tied where the chase began. It gives up at the end of it
     * and then wants nothing to do with hunting for `hunt_rest`, because
     * otherwise it drops you at thirty tiles, notices you again on the next
     * breath because you are still well inside its sight, and measures a fresh
     * leash from there — which is the same endless chase with a stutter in it.
     */
    /*
     * And how far it is from its own home ground, which is what stops a
     * hunter that had already strayed from taking you another thirty tiles
     * beyond where it strayed to. Both are asked; the first to run out ends
     * it.
     */
    if sqrt((v_cx - coalesce(c.hunt_x, v_cx)) ^ 2 + (v_cy - coalesce(c.hunt_y, v_cy)) ^ 2)
         > (case when d.hunter then hunt_leash() else fight_leash() end)
       or sqrt((v_cx - coalesce(c.home_x, v_cx)) ^ 2 + (v_cy - coalesce(c.home_y, v_cy)) ^ 2)
         > hunt_home() then
      c.hunting := null;
      c.windup_at := null;
      c.hunt_again := now() + make_interval(secs => hunt_rest());
      -- And back to its own country, rather than standing wherever it
      -- happened to stop. A hunter that gave up ten valleys from home and
      -- stayed there is how a range stops meaning anything.
      if c.home_x is not null then
        c.from_x := v_cx; c.from_y := v_cy;
        -- No further than a Root or a Tether lets it (`class_leash_point`).
        select lp.x, lp.y into c.to_x, c.to_y from class_leash_point(p_world, c.id, c.home_x, c.home_y) lp;
        c.leg_at := now();
        c.leg_ends := now() + make_interval(secs => greatest(1,
          sqrt((v_cx - c.home_x) ^ 2 + (v_cy - c.home_y) ^ 2)
            / greatest(0.1, d.speed * a.speed * beast_mul(c, 'speed') * 0.7)));
        c.until := c.leg_ends;
      end if;
      return c;
    end if;
    -- Far enough off, or on the beach: let go.
    if p.d > (case when not d.hunter then fight_give_up() when d.monster then hunt_give_up() * 2.2 else hunt_give_up() end)
       or at_peace(p_world, p.x, p.y) or p.d > faith_shroud(p_world, p.uid) then
      c.hunting := null;
      c.windup_at := null;
      return c;
    end if;
    /*
     * Its nerve (`nerveGoes`): a hunter hurt below what its kind stands, one
     * whose pack's leader is dead or has run, or a coward below `coward_drag`
     * with another of its kind within `pack_call` already run. Anything else
     * fights a fight it did not go looking for to the end.
     */
    if d.hunter then
      if c.health < max_health(c) * turns_at(d) then v_nerve := true; end if;
      if not v_nerve and c.pack_lead is not null and c.pack_lead <> c.id then
        select * into l from creature where world_id = p_world and id = c.pack_lead;
        if l.id is null or l.mode <> 'wild' or l.health <= 0 or l.hunt_again > now() then v_nerve := true; end if;
      end if;
      if not v_nerve and d.coward and c.health < max_health(c) * coward_drag() then
        v_nerve := exists (select 1 from creature o
          where o.world_id = p_world and o.species = c.species and o.id <> c.id and o.mode = 'wild'
            and o.hunt_again > now()
            and o.to_x between v_cx - (pack_call() + leg_slack()) and v_cx + (pack_call() + leg_slack())
            and o.to_y between v_cy - (pack_call() + leg_slack()) and v_cy + (pack_call() + leg_slack())
            and (creature_x(o) - v_cx) ^ 2 + (creature_y(o) - v_cy) ^ 2 <= pack_call() ^ 2);
      end if;
    end if;
    if v_nerve then
      -- It turns tail (`turnTail`): away from you, and no interest in you for a while.
      c.hunting := null;
      c.windup_at := null;
      c.hunt_again := now() + make_interval(secs => hunt_rest());
      v_run := d.speed * flee_pace() * flee_secs();
      select * into v_step from class_chase_leg(p_world, c.id, v_cx, v_cy,
        v_cx + (v_cx - p.x) / greatest(0.001, p.d) * v_run, v_cy + (v_cy - p.y) / greatest(0.001, p.d) * v_run);
      c.from_x := v_cx; c.from_y := v_cy;
      c.to_x := coalesce(v_step.x, v_cx); c.to_y := coalesce(v_step.y, v_cy);
      c.leg_at := now();
      c.leg_ends := now() + make_interval(secs => greatest(0.2, sqrt((c.to_x - v_cx) ^ 2 + (c.to_y - v_cy) ^ 2)
                                                 / greatest(0.1, d.speed * a.speed * beast_mul(c, 'speed') * flee_pace())));
      c.until := greatest(c.leg_ends, now() + make_interval(secs => flee_secs()));
      perform tell(p_world, p.uid, 'The ' || lower(d.name) || ' turns tail.', 'fight');
      return c;
    end if;
    c.hunting := p.uid;
  else
    -- Only a hunter goes looking for a fight.
    if not d.hunter then return c; end if;
    -- Nothing comes for you across ground it cannot stand on, and nothing
    -- comes for you at all while you are still standing on the beach.
    if at_peace(p_world, p.x, p.y) then return c; end if;
    if c.hunt_again is not null and c.hunt_again > now() then return c; end if;
    -- One of its pack already on you brings it from wherever it can hear; anything else has to notice you.
    -- And from closer by night to one in a Shadowcloak (`shadowNotice`).
    if m.id is null and p.d > least(coalesce(d.notice, hunt_sight()) * enchant_shadow(p_world, p.uid), faith_shroud(p_world, p.uid)) then return c; end if;
    if not creature_tile_ok(p_world, floor(p.x)::int, floor(p.y)::int) then return c; end if;
    -- Nor on somebody who warned it off with a Pikeman's Warning Thrust, alone or with its pack, while that holds.
    if exists (select 1 from class_mark cm where cm.world_id = p_world and cm.creature_id = c.id and cm.kind = 'warned'
                 and cm.by_uid = p.uid and cm.until > now()) then
      return c;
    end if;
    c.hunting := p.uid;
    -- Where the leash is tied, and a fresh count of blows.
    c.hunt_x := v_cx; c.hunt_y := v_cy;
    c.fight_blows := 0; c.windup_at := null;
    -- The first of a pack leads it; the rest follow whoever the one they heard follows.
    c.pack_lead := case when not d.pack then null when m.id is not null then coalesce(m.pack_lead, m.id) else c.id end;
    perform tell(p_world, p.uid, case when m.id is not null then 'Another ' || lower(d.name) || ' comes with it.'
                                      else 'A ' || lower(d.name) || ' has your scent.' end, 'fight');
  end if;

  -- What the one it is after holds that changes its steps: a Pikeman's Fend Off, and Brace for the Charge at the edge of their reach.
  select pl.blessings into v_bl from player pl where pl.world_id = p_world and pl.uid = p.uid;
  if (v_bl->'fend_off'->>'until')::timestamptz > now() then v_fend := (v_bl->'fend_off'->>'push')::double precision; end if;
  if (v_bl->'brace'->>'until')::timestamptz > now() then v_brace := melee_reach(p_world, p.uid); end if;

  -- Only the last few seconds of the gap were spent on you.
  if c.until < now() - make_interval(secs => hunt_window()) then
    c.from_x := v_cx; c.from_y := v_cy; c.to_x := v_cx; c.to_y := v_cy;
    c.until := now() - make_interval(secs => hunt_window());
    c.leg_at := c.until; c.leg_ends := c.until;
  end if;

  v_pace := d.speed * a.speed * beast_mul(c, 'speed') * 1.15;
  /*
   * Its own side of you, when it hunts with a pack (`packWay`): the leader's is
   * where the leader is, and the rest share the circle out evenly from there,
   * in the order they came into the world.
   */
  if c.pack_lead is not null then
    select count(*), count(*) filter (where mm.id < c.id and mm.id <> c.pack_lead) into v_n, v_k
      from creature mm
      where mm.world_id = p_world and mm.hunting = p.uid and mm.pack_lead = c.pack_lead
        and mm.mode = 'wild' and mm.id <> c.id;
    v_n := v_n + 1;
    v_k := case when c.id = c.pack_lead then 0 else v_k + 1 end;
    if v_n >= 2 then
      select * into l from creature where world_id = p_world and id = c.pack_lead;
      v_slot := case when l.id is null then atan2(v_cy - p.y, v_cx - p.x)
                     else atan2(creature_y(l) - p.y, creature_x(l) - p.x) end + 2 * pi() * v_k / v_n;
    end if;
  end if;
  while c.until <= now() and v_guard < 12 loop
    v_guard := v_guard + 1;
    v_dist := sqrt((p.x - c.to_x) ^ 2 + (p.y - c.to_y) ^ 2);
    /*
     * A Pikeman's Fend Off: come within its reach of them to strike, a heavy
     * blow drawn back included, it is pushed back instead, over ground it
     * could walk (`shove_point`), and comes on again from there.
     */
    if v_fend is not null and v_dist <= hunt_reach() then
      select * into v_step from shove_point(p_world, c.to_x, c.to_y, p.x, p.y, v_fend);
      if v_step.x is not null then
        c.windup_at := null;
        c.from_x := c.to_x; c.from_y := c.to_y;
        c.to_x := v_step.x; c.to_y := v_step.y;
        c.leg_at := c.until;
        c.leg_ends := c.leg_at + make_interval(secs => sqrt((c.to_x - c.from_x) ^ 2 + (c.to_y - c.from_y) ^ 2) / shove_pace());
        c.until := c.leg_ends;
        perform tell(p_world, p.uid, (select name from class_spell where id = 'pikeman_fend_off') || ': you push the '
          || lower(d.name) || ' back.', 'fight');
        continue;
      end if;
    end if;
    /*
     * A heavy blow drawn back for (`windup_at`): it stood where it was for
     * `wind_up`, and lands on whatever is still in its reach.
     */
    if c.windup_at is not null then
      c.windup_at := null;
      c.fight_blows := c.fight_blows + 1;
      if v_dist <= hunt_reach() then
        perform mark_attacker(p_world, p.uid, c.id);
        -- With less of its extra weight on Power's Unshaken (`heavyOn`).
        perform hurt_player(p_world, p.uid, attack_of(c) * 0.012 * (1 + (heavy_hit() - 1) * path_fx(p_world, p.uid, 'heavy', 1)),
          'The ' || lower(d.name) || '''s heavy blow lands', coalesce(d.wound, 'bite'));
      else
        perform tell(p_world, p.uid, 'The ' || lower(d.name) || '''s heavy blow falls short.', 'fight');
      end if;
      c.until := c.until + make_interval(secs => blow_every(d) / (beast_mul(c, 'haste') * class_limbs(p_world, c.id))) + class_stagger_owed(p_world, c.id);
      continue;
    end if;
    /*
     * A thrower (`throwStep`): backs away from you inside `keep_off -
     * back_slack`, and with nowhere to back to fights hand to hand below;
     * within `throw_reach` it stands and throws; further, it closes to
     * `keep_off`, round to its own side of you when it runs with a pack.
     */
    if d.throws then
      if v_dist < keep_off() - back_slack() then
        select * into v_step from class_chase_leg(p_world, c.id, c.to_x, c.to_y,
          c.to_x + (c.to_x - p.x) / greatest(0.001, v_dist) * 2, c.to_y + (c.to_y - p.y) / greatest(0.001, v_dist) * 2);
        if v_step.x is not null and (v_step.x - c.to_x) ^ 2 + (v_step.y - c.to_y) ^ 2 > 0.01 then
          c.from_x := c.to_x; c.from_y := c.to_y;
          c.to_x := v_step.x; c.to_y := v_step.y;
          c.leg_at := c.until;
          c.leg_ends := c.leg_at + make_interval(secs => greatest(0.2, sqrt((c.to_x - c.from_x) ^ 2 + (c.to_y - c.from_y) ^ 2)
                                                         / greatest(0.1, d.speed * a.speed * beast_mul(c, 'speed') * back_pace())));
          c.until := c.leg_ends;
          continue;
        end if;
      elsif v_dist <= throw_reach() then
        c.fight_blows := c.fight_blows + 1;
        perform mark_attacker(p_world, p.uid, c.id);
        perform hurt_player(p_world, p.uid, attack_of(c) * 0.012 * throw_hit(),
          'The ' || lower(d.name) || '''s stone finds you', 'crush');
        c.until := c.until + make_interval(secs => blow_every(d) / (beast_mul(c, 'haste') * class_limbs(p_world, c.id))) + class_stagger_owed(p_world, c.id);
        continue;
      else
        v_ax := null;
        if v_slot is not null then
          v_own := atan2(c.to_y - p.y, c.to_x - p.x);
          v_turn := turn_to(v_own, v_slot);
          if abs(v_turn) > circle_arc() then
            v_b := v_own + sign(v_turn) * least(abs(v_turn), circle_arc());
            v_ax := p.x + cos(v_b) * keep_off(); v_ay := p.y + sin(v_b) * keep_off();
          end if;
        end if;
        if v_ax is null then
          v_ax := p.x + (c.to_x - p.x) / v_dist * keep_off(); v_ay := p.y + (c.to_y - p.y) / v_dist * keep_off();
        end if;
        select * into v_step from class_chase_leg(p_world, c.id, c.to_x, c.to_y, v_ax, v_ay);
        if v_step.x is null then
          c.hunting := null;
          exit;
        end if;
        c.from_x := c.to_x; c.from_y := c.to_y;
        c.to_x := v_step.x; c.to_y := v_step.y;
        c.leg_at := c.until;
        c.leg_ends := c.leg_at + make_interval(secs => greatest(0.2, sqrt((c.to_x - c.from_x) ^ 2 + (c.to_y - c.from_y) ^ 2)
                                                       / greatest(0.1, v_pace)));
        c.until := c.leg_ends;
        continue;
      end if;
    end if;
    if v_dist > hunt_reach() then
      -- Round to its own side of you first, when it runs with a pack and is not on it yet (`circlePoint`).
      v_ax := null;
      if v_slot is not null then
        v_own := atan2(c.to_y - p.y, c.to_x - p.x);
        v_turn := turn_to(v_own, v_slot);
        if abs(v_turn) > circle_arc() then
          v_b := v_own + sign(v_turn) * least(abs(v_turn), circle_arc());
          v_ax := p.x + cos(v_b) * circle_r(); v_ay := p.y + sin(v_b) * circle_r();
        end if;
      end if;
      -- Otherwise a leg that ends a pace short of your feet, round whatever is between.
      if v_ax is null then
        v_ax := c.to_x + (p.x - c.to_x) * (v_dist - 1) / v_dist;
        v_ay := c.to_y + (p.y - c.to_y) * (v_dist - 1) / v_dist;
      end if;
      select * into v_step from class_chase_leg(p_world, c.id, c.to_x, c.to_y, v_ax, v_ay);
      if v_step.x is null then
        c.hunting := null;
        exit;
      end if;
      c.from_x := c.to_x; c.from_y := c.to_y;
      c.to_x := v_step.x; c.to_y := v_step.y;
      /*
       * A Pikeman braced for the charge: a leg that would carry it from outside
       * their reach into it stops at the edge, where the blow is waiting
       * (`class_owed_pay`), and the first such leg spends the brace.
       */
      if v_brace is not null and v_dist > v_brace and (c.to_x - p.x) ^ 2 + (c.to_y - p.y) ^ 2 < v_brace ^ 2 then
        v_t := circle_entry(c.from_x, c.from_y, c.to_x, c.to_y, p.x, p.y, v_brace);
        c.to_x := c.from_x + (c.to_x - c.from_x) * v_t; c.to_y := c.from_y + (c.to_y - c.from_y) * v_t;
        v_braced := true;
      end if;
      v_secs := greatest(0.2, sqrt((c.to_x - c.from_x) ^ 2 + (c.to_y - c.from_y) ^ 2)
                              / greatest(0.1, v_pace));
      c.leg_at := c.until;
      c.leg_ends := c.leg_at + make_interval(secs => v_secs);
      c.until := c.leg_ends;
      if v_braced then
        insert into class_mark (world_id, creature_id, kind, val, n, until, by_uid)
          values (p_world, c.id, 'brace', 1, 0, c.until, p.uid)
          on conflict (world_id, creature_id, kind) do update set val = excluded.val, n = excluded.n, until = excluded.until, by_uid = excluded.by_uid;
        update player set blessings = blessings - 'brace' where world_id = p_world and uid = p.uid;
        v_brace := null; v_braced := false;
      end if;
    elsif d.heavy and (c.fight_blows + 1) % heavy_every()::int = 0 then
      -- Every `heavy_every`th blow of a kind that hits heavy is drawn back for first.
      c.windup_at := c.until + make_interval(secs => wind_up());
      c.until := c.windup_at;
      perform tell(p_world, p.uid, 'The ' || lower(d.name) || ' draws back for a heavy blow. Step out of its reach.', 'fight');
    else
      c.fight_blows := c.fight_blows + 1;
      perform mark_attacker(p_world, p.uid, c.id);
      perform hurt_player(p_world, p.uid, attack_of(c) * 0.012,
        'The ' || lower(d.name) || ' is on you', coalesce(d.wound, 'bite'));
      c.until := c.until + make_interval(secs => blow_every(d) / (beast_mul(c, 'haste') * class_limbs(p_world, c.id))) + class_stagger_owed(p_world, c.id);
    end if;
  end loop;
  return c;
end $function$;

notify pgrst, 'reload schema';
select private.lock_doors();
