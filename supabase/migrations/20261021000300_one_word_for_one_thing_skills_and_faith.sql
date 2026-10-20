-- One word for one thing, in the island's words as in the browser's: skills, perks, classes, faith, meditation,
-- enchanting, the Skills window and the rest of what they say.
--
-- Asked for: 'Everywhere change "per go" to "per action". Identify other potentially ambiguous verbiage.' and, of the
-- list, "Do them all": the skill `prayer` is shown "Devotion" and `praying` "Praying"; a tier says whose (perk, path,
-- faith, class); a stage says which (growth stage, age); a work unit is an action; heights are in metres; the daily
-- reset is called that. Text only: each line below is patched in place (each anchor asserted to occur once), and
-- the rest of the text reaches the island through the definitions.

set local lock_timeout = '3s';

do $do$
declare v_def text; v_n int; v_pairs text[] := array[[$q$'Tier already taken: '$q$, $q$case when c.kind = 'combat' then 'Class' else 'Perk' end || ' tier already taken: '$q$], [$q$'Tier opens at class level '$q$, $q$'Class tier opens at class level '$q$], [$q$'Tier opens at ' || replace(c.main$q$, $q$'Perk tier opens at ' || replace(c.main$q$]]; i int;
begin
  select pg_get_functiondef(p.oid) into strict v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'perk_refusal';
  for i in 1 .. array_length(v_pairs, 1) loop
    v_n := (length(v_def) - length(replace(v_def, v_pairs[i][1], ''))) / length(v_pairs[i][1]);
    if v_n <> 1 then raise exception 'perk_refusal has % of %, not 1', v_n, v_pairs[i][1]; end if;
    v_def := replace(v_def, v_pairs[i][1], v_pairs[i][2]);
  end loop;
  execute v_def;
end $do$;

do $do$
declare v_def text; v_n int; v_pairs text[] := array[[$q$': still on steps, not tiers.'$q$, $q$': still on steps, not path tiers.'$q$], [$q$'Tier already taken: '$q$, $q$'Path tier already taken: '$q$], [$q$'Tier opens at meditation '$q$, $q$'Path tier opens at meditation '$q$]]; i int;
begin
  select pg_get_functiondef(p.oid) into strict v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'path_pick_refusal';
  for i in 1 .. array_length(v_pairs, 1) loop
    v_n := (length(v_def) - length(replace(v_def, v_pairs[i][1], ''))) / length(v_pairs[i][1]);
    if v_n <> 1 then raise exception 'path_pick_refusal has % of %, not 1', v_n, v_pairs[i][1]; end if;
    v_def := replace(v_def, v_pairs[i][1], v_pairs[i][2]);
  end loop;
  execute v_def;
end $do$;

do $do$
declare v_def text; v_n int; v_pairs text[] := array[[$q$' grew a stage.'$q$, $q$' grew one age.'$q$], [$q$': tier ' || r.tier || ' open. Pick one: '$q$, $q$': path tier ' || r.tier || ' open. Pick one: '$q$]]; i int;
begin
  select pg_get_functiondef(p.oid) into strict v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'perform_faith';
  for i in 1 .. array_length(v_pairs, 1) loop
    v_n := (length(v_def) - length(replace(v_def, v_pairs[i][1], ''))) / length(v_pairs[i][1]);
    if v_n <> 1 then raise exception 'perform_faith has % of %, not 1', v_n, v_pairs[i][1]; end if;
    v_def := replace(v_def, v_pairs[i][1], v_pairs[i][2]);
  end loop;
  execute v_def;
end $do$;

do $do$
declare v_def text; v_n int; v_pairs text[] := array[[$q$' needs faith ' || to_char(d.level$q$, $q$' needs ' || faith_word() || ' ' || to_char(d.level$q$]]; i int;
begin
  select pg_get_functiondef(p.oid) into strict v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'cast_reason';
  for i in 1 .. array_length(v_pairs, 1) loop
    v_n := (length(v_def) - length(replace(v_def, v_pairs[i][1], ''))) / length(v_pairs[i][1]);
    if v_n <> 1 then raise exception 'cast_reason has % of %, not 1', v_n, v_pairs[i][1]; end if;
    v_def := replace(v_def, v_pairs[i][1], v_pairs[i][2]);
  end loop;
  execute v_def;
end $do$;

do $do$
declare v_def text; v_n int; v_pairs text[] := array[[$q$' faith (have '$q$, $q$' ' || faith_word() || ' (have '$q$]]; i int;
begin
  select pg_get_functiondef(p.oid) into strict v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'rite_refusal';
  for i in 1 .. array_length(v_pairs, 1) loop
    v_n := (length(v_def) - length(replace(v_def, v_pairs[i][1], ''))) / length(v_pairs[i][1]);
    if v_n <> 1 then raise exception 'rite_refusal has % of %, not 1', v_n, v_pairs[i][1]; end if;
    v_def := replace(v_def, v_pairs[i][1], v_pairs[i][2]);
  end loop;
  execute v_def;
end $do$;

do $do$
declare v_def text; v_n int; v_pairs text[] := array[[$q$' at this tier.'$q$, $q$' at this faith tier.'$q$], [$q$'Tier needs ' || faith_word()$q$, $q$'Faith tier needs ' || faith_word()$q$]]; i int;
begin
  select pg_get_functiondef(p.oid) into strict v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'faith_spell_refusal';
  for i in 1 .. array_length(v_pairs, 1) loop
    v_n := (length(v_def) - length(replace(v_def, v_pairs[i][1], ''))) / length(v_pairs[i][1]);
    if v_n <> 1 then raise exception 'faith_spell_refusal has % of %, not 1', v_n, v_pairs[i][1]; end if;
    v_def := replace(v_def, v_pairs[i][1], v_pairs[i][2]);
  end loop;
  execute v_def;
end $do$;

do $do$
declare v_def text; v_n int; v_pairs text[] := array[[$q$'Crops grown 1 stage: '$q$, $q$'Crops grown 1 growth stage: '$q$]]; i int;
begin
  select pg_get_functiondef(p.oid) into strict v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'do_cast';
  for i in 1 .. array_length(v_pairs, 1) loop
    v_n := (length(v_def) - length(replace(v_def, v_pairs[i][1], ''))) / length(v_pairs[i][1]);
    if v_n <> 1 then raise exception 'do_cast has % of %, not 1', v_n, v_pairs[i][1]; end if;
    v_def := replace(v_def, v_pairs[i][1], v_pairs[i][2]);
  end loop;
  execute v_def;
end $do$;

do $do$
declare v_def text; v_n int; v_pairs text[] := array[[$q$' goes with a success roll: success.'$q$, $q$' actions with a success check: success.'$q$]]; i int;
begin
  select pg_get_functiondef(p.oid) into strict v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'path_technique_cast';
  for i in 1 .. array_length(v_pairs, 1) loop
    v_n := (length(v_def) - length(replace(v_def, v_pairs[i][1], ''))) / length(v_pairs[i][1]);
    if v_n <> 1 then raise exception 'path_technique_cast has % of %, not 1', v_n, v_pairs[i][1]; end if;
    v_def := replace(v_def, v_pairs[i][1], v_pairs[i][2]);
  end loop;
  execute v_def;
end $do$;

do $do$
declare v_def text; v_n int; v_pairs text[] := array[[$q$('over ' || sit_thin_at() || ' high ×'$q$, $q$('over ' || to_char(sit_thin_at() / 10.0, 'FM990.0') || ' m high ×'$q$], [$q$('over ' || sit_high_at() || ' high, off your settlement ×'$q$, $q$('over ' || to_char(sit_high_at() / 10.0, 'FM990.0') || ' m high, off your settlement ×'$q$], [$q$said := 'Sitting: '$q$, $q$said := 'Meditation and Calm gained: '$q$]]; i int;
begin
  select pg_get_functiondef(p.oid) into strict v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'sit_place';
  for i in 1 .. array_length(v_pairs, 1) loop
    v_n := (length(v_def) - length(replace(v_def, v_pairs[i][1], ''))) / length(v_pairs[i][1]);
    if v_n <> 1 then raise exception 'sit_place has % of %, not 1', v_n, v_pairs[i][1]; end if;
    v_def := replace(v_def, v_pairs[i][1], v_pairs[i][2]);
  end loop;
  execute v_def;
end $do$;

do $do$
declare v_def text; v_n int; v_pairs text[] := array[[$q$'Not on a bauble: its rarity is rolled when restored.'$q$, $q$'Not on a bauble: its rarity is set by chance when restored.'$q$]]; i int;
begin
  select pg_get_functiondef(p.oid) into strict v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'absorb_setting';
  for i in 1 .. array_length(v_pairs, 1) loop
    v_n := (length(v_def) - length(replace(v_def, v_pairs[i][1], ''))) / length(v_pairs[i][1]);
    if v_n <> 1 then raise exception 'absorb_setting has % of %, not 1', v_n, v_pairs[i][1]; end if;
    v_def := replace(v_def, v_pairs[i][1], v_pairs[i][2]);
  end loop;
  execute v_def;
end $do$;

do $do$
declare v_def text; v_n int; v_pairs text[] := array[[$q$' Tier up: '$q$, $q$' Grade up: '$q$]]; i int;
begin
  select pg_get_functiondef(p.oid) into strict v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'restore_bauble';
  for i in 1 .. array_length(v_pairs, 1) loop
    v_n := (length(v_def) - length(replace(v_def, v_pairs[i][1], ''))) / length(v_pairs[i][1]);
    if v_n <> 1 then raise exception 'restore_bauble has % of %, not 1', v_n, v_pairs[i][1]; end if;
    v_def := replace(v_def, v_pairs[i][1], v_pairs[i][2]);
  end loop;
  execute v_def;
end $do$;

do $do$
declare v_def text; v_n int; v_pairs text[] := array[[$q$'. Undoes one trade '$q$, $q$'. Undoes one class '$q$]]; i int;
begin
  select pg_get_functiondef(p.oid) into strict v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'perform_dig';
  for i in 1 .. array_length(v_pairs, 1) loop
    v_n := (length(v_def) - length(replace(v_def, v_pairs[i][1], ''))) / length(v_pairs[i][1]);
    if v_n <> 1 then raise exception 'perform_dig has % of %, not 1', v_n, v_pairs[i][1]; end if;
    v_def := replace(v_def, v_pairs[i][1], v_pairs[i][2]);
  end loop;
  execute v_def;
end $do$;

do $do$
declare v_def text; v_n int; v_pairs text[] := array[[$q$', until the woods next turn.'$q$, $q$', until the next daily reset (' || lpad(tree_dawn_utc()::int::text, 2, '0') || ':00 UTC).'$q$]]; i int;
begin
  select pg_get_functiondef(p.oid) into strict v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'ground_says';
  for i in 1 .. array_length(v_pairs, 1) loop
    v_n := (length(v_def) - length(replace(v_def, v_pairs[i][1], ''))) / length(v_pairs[i][1]);
    if v_n <> 1 then raise exception 'ground_says has % of %, not 1', v_n, v_pairs[i][1]; end if;
    v_def := replace(v_def, v_pairs[i][1], v_pairs[i][2]);
  end loop;
  execute v_def;
end $do$;

do $do$
declare v_def text; v_n int; v_pairs text[] := array[[$q$', and a new tier opens in the Trades window.'$q$, $q$', and a new class tier opens in the Trades window.'$q$]]; i int;
begin
  select pg_get_functiondef(p.oid) into strict v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'class_learn';
  for i in 1 .. array_length(v_pairs, 1) loop
    v_n := (length(v_def) - length(replace(v_def, v_pairs[i][1], ''))) / length(v_pairs[i][1]);
    if v_n <> 1 then raise exception 'class_learn has % of %, not 1', v_n, v_pairs[i][1]; end if;
    v_def := replace(v_def, v_pairs[i][1], v_pairs[i][2]);
  end loop;
  execute v_def;
end $do$;

select private.lock_doors();
