-- Soul strength: more uses and more sources, all at one rate and one gain.
--
-- Asked for, of the Soul strength review: "1. Add to those other uses. 2. Add those sources as well. 3. Keep small.
-- 4. Fix text." Every new use takes one multiplier, 1 + 0.125% per level over the starting mark (+10% at a hundred,
-- `soul_mul`, the browser's `soulAbove`): favour per prayer, Calm per sitting, and a Beastmaster spell's heal, blow
-- and bonus (`soul_fx`, which of each spell's numbers by `soul_fx_how`). Tame chance stays +0.2 points a level. Soul
-- strength now rises from a prayer, a sitting and a sacrifice at an altar as well as an offering, each by the one
-- gain (`soul_gain`, which `tame_nerve` already is). Nothing frightens a player on the island, so there is no fear
-- for soul strength to shorten.

set local lock_timeout = '3s';

create or replace function soul_mul(p_world uuid, p_uid uuid) returns double precision
language sql stable as $fn$
  select 1 + greatest(0, skill_of(p_world, p_uid, 'soul_strength') - char_start()) * soul_per_level()
$fn$;

-- A spell's number as this player casts it: a whole one by the multiplier, a bonus on what it adds (`soulFx`).
create or replace function soul_fx(p_world uuid, p_uid uuid, p_spell text, p_key text) returns double precision
language sql stable as $fn$
  select case soul_fx_how(p_spell, p_key)
           when 'whole' then spell_fx(p_spell, p_key) * soul_mul(p_world, p_uid)
           when 'bonus' then 1 + (spell_fx(p_spell, p_key) - 1) * soul_mul(p_world, p_uid)
           else spell_fx(p_spell, p_key) end
$fn$;

do $do$
declare v_def text; v_old text; v_new text; v_from int; v_to int; v_block text; v_k text; v_n int;
begin
  -- A prayer: favour by soul strength, and soul strength for the prayer; a sitting: soul strength for it.
  v_def := pg_get_functiondef('perform_faith'::regproc);
  v_old := $q$                                                     * (1 + worn_enchant(p_world, p_uid, 'favour')));$q$;
  v_new := $q$                                                     * (1 + worn_enchant(p_world, p_uid, 'favour'))
                                                     -- And soul strength's share (`soul_mul`).
                                                     * soul_mul(p_world, p_uid));$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_faith: favour anchor not once'; end if;
  v_def := replace(v_def, v_old, v_new);
  v_old := $q$    perform skill_raise(p_world, p_uid, praying_skill(), try_gain(true));
$q$;
  v_new := $q$    perform skill_raise(p_world, p_uid, praying_skill(), try_gain(true));
    -- And soul strength, as every one of its sources teaches it (`SOUL_GAIN`).
    perform skill_told(p_world, p_uid, 'soul_strength', try_gain(true, soul_gain()));
$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_faith: prayer gain anchor not once'; end if;
  v_def := replace(v_def, v_old, v_new);
  v_old := $q$    perform skill_raise(p_world, p_uid, meditation_skill(), sit.gain);
$q$;
  v_new := $q$    perform skill_raise(p_world, p_uid, meditation_skill(), sit.gain);
    perform skill_told(p_world, p_uid, 'soul_strength', try_gain(true, soul_gain()));
$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_faith: sitting gain anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  -- The Calm a sitting banks, by soul strength.
  v_def := pg_get_functiondef('sitting_worth'::regproc);
  v_old := $q$  calm := sit_calm() * r.place * (1 + worn_enchant(p_world, p_uid, 'calm'));$q$;
  v_new := $q$  calm := sit_calm() * r.place * (1 + worn_enchant(p_world, p_uid, 'calm')) * soul_mul(p_world, p_uid);$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'sitting_worth: calm anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  -- A sacrifice: soul strength for it, after the soul's roll.
  v_def := pg_get_functiondef('perform_sacrifice'::regproc);
  v_old := $q$    perform tell(p_world, p_uid, 'Got: ' || (s.o_item).rare || ' soul.', 'event');
  end if;
$q$;
  v_new := $q$    perform tell(p_world, p_uid, 'Got: ' || (s.o_item).rare || ' soul.', 'event');
  end if;
  -- And soul strength, as every one of its sources teaches it (`SOUL_GAIN`).
  perform skill_told(p_world, p_uid, 'soul_strength', try_gain(true, soul_gain()));
$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'perform_sacrifice: anchor not once'; end if;
  execute replace(v_def, v_old, v_new);

  -- A Beastmaster's spells: from Sic to Primal Fury, each heal, blow and bonus as this player casts it (`soul_fx`).
  v_def := pg_get_functiondef('class_spell_cast'::regproc);
  v_old := $q$  when 'beastmaster_sic' then$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'class_spell_cast: first anchor not once'; end if;
  v_from := strpos(v_def, v_old);
  v_old := $q$  when 'beastmaster_call_of_the_wild' then$q$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'class_spell_cast: last anchor not once'; end if;
  v_to := strpos(v_def, v_old);
  v_block := substr(v_def, v_from, v_to - v_from);
  foreach v_k in array array['more', 'heal', 'quick'] loop
    v_old := 'spell_fx(p_spell, ''' || v_k || ''')';
    v_n := (length(v_block) - length(replace(v_block, v_old, ''))) / length(v_old);
    -- Sic, Pounce, Drag Down, Disembowel, Vengeance, Bloodlust twice and Primal Fury twice; Lick Wounds twice; Primal Fury twice.
    if v_n <> (array[9, 2, 2])[array_position(array['more', 'heal', 'quick'], v_k)] then
      raise exception 'class_spell_cast: % found % times', v_k, v_n;
    end if;
    v_block := replace(v_block, v_old, 'soul_fx(p_world, p_uid, p_spell, ''' || v_k || ''')');
  end loop;
  execute substr(v_def, 1, v_from - 1) || v_block || substr(v_def, v_to);
end
$do$;

select private.lock_doors();
