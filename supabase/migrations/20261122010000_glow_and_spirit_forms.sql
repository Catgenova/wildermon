-- Glow and spirit forms: two more wild forms, rarer than the colour form.
--
-- Asked for: "two new wild mutations, Glow and Spirit ... each stocked wild one (not a monster) rolls it: Glow under 1 in
-- aura_form_odds(), Spirit under the next 1 in aura_form_odds(), aura_form_odds() = 5000 (a tenth as common as the colour
-- form) ... the young gets a parent's aura at form_pass() for each parent that has it (if both differ, pick one)".
--
-- One column on the creature (`form_aura`, 'glow' or 'spirit', null for neither: never both). One stood up in the
-- country is rolled for it off a roll of its own (`wild_aura_roll`, the browser's `wildAuraRoll`), never a monster, by
-- the same door the other forms come through (`wild_form_put`, which takes a third roll, defaulted, so every caller is
-- as it was). A covering settles the young one's off its parents' at `form_pass` for each parent that has one, the
-- dam's before the sire's where both have one (`bred_aura`, `bredAura`), as the size form is, and the birth gives it
-- (`drop_young`). The browser hears it with the creature and on a trade (`formAura`), draws it, and names it on its
-- card. The field guide keeps it under `species/glow` and `species/spirit`, seen while one in it stands near
-- (`rpc_guide_seen`) and tamed with its kind (`guide_mark_forms`, `form_keys`).

set local lock_timeout = '3s';

-- The number comes in with the definitions (`dump-defs.ts`); this is what it is until then.
create or replace function aura_form_odds() returns double precision language sql immutable as $fn$ select 5000::double precision $fn$;

select private.shut('alter table creature add column if not exists form_aura text check (form_aura in (''glow'', ''spirit''))');

-- Its glow or spirit form off a roll of its own (`wildAuraRoll`): glow under one in `aura_form_odds`, spirit under the
-- next one in `aura_form_odds`. Never a monster.
create or replace function wild_aura_roll(p_species text, p_aura double precision) returns text
language sql stable as $fn$
  select case when sd.monster then null
              when p_aura < 1 / aura_form_odds() then 'glow'
              when p_aura < 2 / aura_form_odds() then 'spirit' end
    from species_def sd where sd.id = p_species
$fn$;

-- A young one's off its parents' and a roll (`bredAura`): at `form_pass` for each parent that has one, the dam's before
-- the sire's where both have one.
create or replace function bred_aura(p_dam text, p_sire text, p_roll double precision) returns text
language sql immutable as $fn$
  select (array_remove(array[p_dam, p_sire], null))[floor(p_roll / form_pass())::int + 1]
$fn$;

-- One just put out in the country, now and then in a form (`standWild`), its glow or spirit form off a third roll.
-- The old four-argument door goes, so a call with two, three or four arguments finds this one and no other.
drop function if exists wild_form_put(uuid, int, double precision, double precision);
create or replace function wild_form_put(p_world uuid, p_id int, p_colour double precision default random(),
                                         p_size double precision default random(),
                                         p_aura double precision default random()) returns int
language plpgsql as $fn$
declare c creature; f record; v_aura text;
begin
  if p_id is null then return null; end if;
  select * into c from creature where world_id = p_world and id = p_id;
  if not found or c.mode <> 'wild' then return p_id; end if;
  f := wild_form_roll(c.species, p_colour, p_size);
  v_aura := wild_aura_roll(c.species, p_aura);
  if not coalesce(f.form_colour, false) and f.form_size is null and v_aura is null then return p_id; end if;
  update creature set form_colour = coalesce(f.form_colour, false), form_size = f.form_size, form_aura = v_aura
    where world_id = p_world and id = p_id returning * into c;
  if f.form_size is not null then
    update creature set health = max_health(c) where world_id = p_world and id = p_id;
  end if;
  return p_id;
end $fn$;

-- The forms a creature is in, as guide keys (`formKey`): and its glow or spirit form. The old three-argument one goes, so
-- a call with three arguments finds this one.
drop function if exists form_keys(text, boolean, text);
create or replace function form_keys(p_species text, p_colour boolean, p_size text, p_aura text default null)
returns text[] language sql immutable as $fn$
  select array_remove(array[case when p_colour then p_species || '/colour' end,
                            case when p_size is not null then p_species || '/' || p_size end,
                            case when p_aura is not null then p_species || '/' || p_aura end], null)
$fn$;

-- A kind and each form it is in marked (`guideMarkKind`): and its glow or spirit form.
create or replace function guide_mark_forms(p_world uuid, p_uid uuid, c creature, p_what text) returns void language sql as $fn$
  select guide_mark(p_world, p_uid, k, p_what)
    from unnest(array[c.species]
                || case when p_what = 'tamed' and stage_of(c) > 0 then array[c.species || ':' || stage_of(c)] else '{}'::text[] end
                || form_keys(c.species, c.form_colour, c.form_size, c.form_aura)) k
$fn$;

-- A form's key in the book (`formKey`): `species/glow` and `species/spirit` beside the others, for a kind that can be kept.
create or replace function guide_kind(p_key text) returns boolean language sql stable as $fn$
  select case when position('/' in p_key) > 0 then
           split_part(p_key, '/', 2) in ('colour', 'large', 'small', 'glow', 'spirit') and split_part(p_key, '/', 3) = ''
           and exists (select 1 from species_def d where d.id = split_part(p_key, '/', 1) and not d.monster)
         else exists (select 1 from species_def d
                  where d.id = split_part(p_key, ':', 1)
                    and (position(':' in p_key) = 0
                         or (split_part(p_key, ':', 2) ~ '^[0-9]+$'
                             and split_part(p_key, ':', 2)::int between 1 and coalesce(array_length(d.stages, 1), 0)))) end
$fn$;

-- A wildermon as a trade's side shows it: and its glow or spirit form, for one in either. Left off for one in neither, so a
-- side recorded before this (`barter_item.beast`) is still the wildermon as it is shown, and no Accept is taken back.
create or replace function barter_beast(p_world uuid, p_creature int, p_me uuid default null) returns jsonb
language sql stable as $$
  select jsonb_build_object(
      'id', c.id, 'name', c.name, 'species', c.species, 'variant', c.variant, 'sex', c.sex,
      'age', age_of(c.born, old_of(c), age_pace(c)), 'level', creature_level(c.skills, c.species), 'skills', c.skills,
      'traits', to_jsonb(c.traits), 'formColour', c.form_colour, 'formSize', c.form_size, 'rare', c.rare,
      'pedigree', case when c.pedigree is null or p_me is null or c.keeper = p_me then c.pedigree
                       else pedigree_seen(p_world, p_me, c.pedigree) end,
      'due', c.due is not null)
    || case when c.form_aura is null then '{}'::jsonb else jsonb_build_object('formAura', c.form_aura) end
    from creature c where c.world_id = p_world and c.id = p_creature
$$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- A covering settles the young one's glow or spirit form off its parents' (`bred_aura`), and a twin's its own.
    (1, 'pair_them', 2, $a$'formSize', f.form_size))$a$,
     $a$'formSize', f.form_size, 'formAura', bred_aura(dam.form_aura, sire.form_aura, random())))$a$),
    -- And the birth gives it, and it is a wild form for the journal.
    (2, 'drop_young', 1, $a$form_size = v_coming->>'formSize',$a$,
     $a$form_size = v_coming->>'formSize', form_aura = v_coming->>'formAura',$a$),
    (3, 'drop_young', 1, $a$or v_coming->>'formSize' is not null then$a$,
     $a$or v_coming->>'formSize' is not null or v_coming->>'formAura' is not null then$a$),
    -- A glow or spirit form handed over as seen is taken while one in it stands near.
    (4, 'rpc_guide_seen', 1, $a$or c.form_size = split_part(s, '/', 2))$a$,
     $a$or c.form_size = split_part(s, '/', 2) or c.form_aura = split_part(s, '/', 2))$a$),
    -- The browser hears it with the creature, to anybody, packed or not (`formAura`).
    (5, 'rpc_creatures', 1, $a$              then jsonb_build_object('formColour', c.form_colour, 'formSize', c.form_size) else '{}'::jsonb end
$a$, $a$              then jsonb_build_object('formColour', c.form_colour, 'formSize', c.form_size) else '{}'::jsonb end
      -- And its glow or spirit form (`formAura`), which the browser draws and its card names.
      || case when c.form_aura is null then '{}'::jsonb else jsonb_build_object('formAura', c.form_aura) end
$a$)
  ) as t(n, fn, want, old, new) order by n loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.want then raise exception '% has % of anchor %, not %', r.fn, v_n, r.n, r.want; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
