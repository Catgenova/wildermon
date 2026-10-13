/*
 * Shields block, and weapons reach (`src/game/fight.ts`, `src/game/gear.ts`).
 *
 * A shield in the off hand already blocked a blow outright on both sides,
 * after the dodge and before the armour (`hurt_player`, `Game.absorb`). What
 * changes:
 *
 *   * the numbers in its chance are named and crossed by the defs
 *     (`block_ql_from`, `block_ql_span`, `block_per_skill`), so
 *     `shield_block` reads them rather than literals;
 *   * a blocked blow wears the shield by `shield_wear` for every whole health
 *     of the blow, which was a literal 3;
 *   * the log says "You block the blow with your shield.", the same words as
 *     the browser's `BLOCKED_SAID`.
 *
 * And a swing reaches as far as its weapon's family (`WEAPON_REACH`): the
 * defs cross `weapon_reach`, one reach for every weapon held in the hand, and
 * `fist_reach` for bare hands and a bow, and `melee_reach` reads those rather
 * than a spear's `range` past a pace. A Pikeman's Long Reach and a
 * Skirmisher's Long Throw still add theirs (`length:<kind>`).
 *
 * Replaced: shield_block(uuid, uuid, shield_def, double precision),
 * melee_reach(uuid, uuid) and hurt_player(uuid, uuid, double precision, text, text),
 * each from its newest definition.
 *
 * Whether the defs land before or after this: the two sql functions are made
 * with check_function_bodies off, and hurt_player is plpgsql.
 */
set check_function_bodies = off;

create or replace function public.shield_block(p_world uuid, p_uid uuid, p_sh shield_def, p_ql double precision)
 returns double precision
 language sql
 stable
as $function$
  select least(pk(p_world, p_uid, 'blockcap:shield', block_most()),
               (p_sh.block * (block_ql_from() + p_ql / block_ql_span()) + skill_of(p_world, p_uid, 'shields') * block_per_skill())
               * class_mul(p_world, p_uid, 'guard', 'shields') + pk(p_world, p_uid, 'block:shield', 0))
$function$;

create or replace function public.melee_reach(p_world uuid, p_uid uuid)
 returns double precision
 language sql
 stable
as $function$
  select coalesce((select weapon_reach(w.id) + pk(p_world, p_uid, 'length:' || w.kind, 0) from weapon_def w
    where w.id = (worn(p_world, p_uid, 'weapon')).def and w.ammo is null), fist_reach())
$function$;

create or replace function public.hurt_player(p_world uuid, p_uid uuid, p_raw double precision, p_what text, p_kind text DEFAULT 'bite'::text)
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
        -- By `shield_wear` for every whole health of the blow.
        update item set dmg = least(100, dmg + p_raw * shield_wear() * pk(p_world, p_uid, 'worn:shield', 1)) where id = shield.id;
        perform skill_raise(p_world, p_uid, 'shields', 0.5);
        -- The same words as the browser's (`BLOCKED_SAID`).
        perform tell(p_world, p_uid, 'You block the blow with your shield.', 'fight');
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

reset check_function_bodies;

select private.lock_doors();
