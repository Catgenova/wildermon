-- A bronze mirror, used on a wildermon of yours: the young of its next covering get its best trait as it carries it.
--
-- Asked for: "Copy a trait to a newborn: at breeding, the newborn gets the parent's best trait at that parent's value
-- instead of rolling it. Used up on the birth." The mirror's item, its description and the action are the snapshot's
-- before this (`bronze_mirror`, `use_bronze_mirror`). Here, as the browser has it (`creatureActions.ts`, `traits.ts`,
-- `Creatures.pair`):
--
--   * used from its menu on a wildermon of yours, the mirror marks it (`boosts.mirror`, `mirrored`), one mark at a time;
--     refused and kept on one already mirrored or with no traits;
--   * its best trait is the highest-tier one it carries, the first of them in its own order on a tie (`mirror_trait`);
--   * at its next covering that takes, that trait goes into the young (a twin too) as it carries it, before the draw,
--     the dam's before the sire's and a name once (`mirror_copy`, `breed_traits`' `p_copy`); those slots are not drawn
--     and no mutation takes them; the rest are drawn as ever;
--   * and the mark is used up at that covering, and said (`pair_them`).

set local lock_timeout = '3s';

-- Whether a wildermon carries a bronze mirror's mark (`mirrored`).
create or replace function mirrored(c creature) returns boolean language sql immutable as $fn$
  select coalesce((c.boosts->>'mirror')::double precision, 0) > 0
$fn$;

-- The trait a bronze mirror copies: the highest-tier one, the first in its own order on a tie; null with none
-- (`mirrorTrait`).
create or replace function mirror_trait(p_traits text[]) returns text language sql stable as $fn$
  select u.id from unnest(coalesce(p_traits, '{}'::text[])) with ordinality u(id, i)
    left join trait_def d on d.id = u.id left join tier_odds t on t.tier = d.tier
   order by coalesce(t.ord, 0) desc, u.i limit 1
$fn$;

-- What a covering copies: each mirrored parent's best trait, the dam's first (`mirrorCopy`).
create or replace function mirror_copy(dam creature, sire creature) returns text[] language sql stable as $fn$
  select coalesce(array_agg(x.id order by x.ord), '{}'::text[])
    from (select 1 as ord, case when mirrored(dam) then mirror_trait(dam.traits) end as id
          union all
          select 2, case when mirrored(sire) then mirror_trait(sire.traits) end) x
   where x.id is not null
$fn$;

-- A trait as a bronze mirror names it: "fleet (rare)", a fighting trait's grade already in its name (`mirrorNames`).
create or replace function mirror_names(p_id text) returns text language sql stable as $fn$
  select d.name || case when d.family is null then ' (' || d.tier || ')' else '' end from trait_def d where d.id = p_id
$fn$;

/*
 * The draw, with a bronze mirror's copies in it: `p_copy` goes in first, as the parent carries each, and is not drawn;
 * no mutation takes those slots. Patched from what stands, with the old signature dropped for the new one.
 */
do $do$
declare v_def text; v_n int; r record;
begin
  select pg_get_functiondef('breed_traits(text[], text[], double precision, double precision, double precision, double precision)'::regprocedure)
    into v_def;
  for r in select * from (values
    (1, $a$p_up_plus double precision DEFAULT 0)$a$,
        $a$p_up_plus double precision DEFAULT 0, p_copy text[] DEFAULT '{}'::text[])$a$),
    (2, $a$v_from jsonb := '{}'; v_source text; v_slot int; v_new text;$a$,
        $a$v_from jsonb := '{}'; v_source text; v_slot int; v_new text; v_fixed int := 0; v_c text;$a$),
    (3, $a$  for slot in 1..trait_slots() loop$a$,
        $a$  -- A bronze mirror's copies first, as the mirrored parent carries them, the dam's before the sire's, a name once;
  -- whose each was, as a draw from the pair says it.
  foreach v_c in array coalesce(p_copy, '{}'::text[]) loop
    if coalesce(array_length(out_t, 1), 0) < trait_slots()
       and not coalesce(trait_family(v_c) = any(trait_families(out_t)), false) then
      out_t := out_t || v_c;
      v_from := v_from || jsonb_build_object(v_c, case when v_c = any(coalesce(p_dam, '{}')) then
                  case when v_c = any(coalesce(p_sire, '{}')) then 'both' else 'dam' end else 'sire' end);
    end if;
  end loop;
  v_fixed := coalesce(array_length(out_t, 1), 0);
  for slot in v_fixed + 1..trait_slots() loop$a$),
    (4, $a$       order by coalesce(t.ord, 0), random() limit 1;$a$,
        $a$       where u.i > v_fixed
       order by coalesce(t.ord, 0), random() limit 1;$a$)
  ) as t(ord, old, new) order by ord loop
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception 'breed_traits has % of %, not 1', v_n, r.old; end if;
    v_def := replace(v_def, r.old, r.new);
  end loop;
  drop function breed_traits(text[], text[], double precision, double precision, double precision, double precision);
  execute v_def;
end $do$;

do $do$
declare r record; v_def text; v_n int; i int;
begin
  for r in select * from (values
    -- The mirror is an artifact, and the item it uses (the browser's `ARTIFACT_FOR`).
    (1, 'artifact_item', array[$$when 'use_ancient_brace' then 'ancient_brace'$$],
       array[$$when 'use_ancient_brace' then 'ancient_brace'
                       when 'use_bronze_mirror' then 'bronze_mirror'$$], array[1]),
    (2, 'artifact_refusal', array[$$  if p_action = 'use_ancient_brace' and brace_points(c) >= brace_most() then$$],
       array[$$  if p_action = 'use_bronze_mirror' and mirrored(c) then return c.name || ': already mirrored.'; end if;
  if p_action = 'use_bronze_mirror' and mirror_trait(c.traits) is null then return c.name || ': no traits to copy.'; end if;
  if p_action = 'use_ancient_brace' and brace_points(c) >= brace_most() then$$], array[1]),
    (3, 'perform_artifact', array[$$  elsif p_action = 'use_ancient_brace' then$$],
       array[$$  elsif p_action = 'use_bronze_mirror' then
    -- The mark, used up at its next covering (`pair_them`).
    update creature set boosts = coalesce(boosts, '{}'::jsonb) || jsonb_build_object('mirror', 1)
     where world_id = p_world and id = c.id;
    perform tell(p_world, p_uid, upper(left(v_name, 1)) || substr(v_name, 2) || ' used on ' || c.name || ': '
      || coalesce(mirror_names(mirror_trait(c.traits)), 'nothing') || ' to its next young.', 'event');

  elsif p_action = 'use_ancient_brace' then$$], array[1]),
    -- The covering: each mirrored parent's best trait in every young of it, and the marks used up and said.
    (4, 'pair_them', array[$$v_sex text; v_rest double precision;$$,
                           $$v_bred := breed_traits(sire.traits, dam.traits, p_husbandry, v_care, v_keep, v_up);$$,
                           $$v_twin := breed_traits(sire.traits, dam.traits, p_husbandry, v_care, v_keep, v_up);$$,
                           $$  update creature set bred_at = now() - make_interval(secs => v_rest) where world_id = p_world and id = p_sire;$$],
       array[$$v_sex text; v_rest double precision; v_copy text[]; v_m creature;$$,
             $$v_copy := mirror_copy(dam, sire);
  v_bred := breed_traits(sire.traits, dam.traits, p_husbandry, v_care, v_keep, v_up, v_copy);$$,
             $$v_twin := breed_traits(sire.traits, dam.traits, p_husbandry, v_care, v_keep, v_up, v_copy);$$,
             $$  update creature set bred_at = now() - make_interval(secs => v_rest) where world_id = p_world and id = p_sire;
  -- And each mirror's mark used up, and said, the dam's first.
  for v_m in select * from creature m where m.world_id = p_world and m.id in (p_dam, p_sire) and mirrored(m)
              order by (m.id <> p_dam) loop
    update creature set boosts = nullif(boosts - 'mirror', '{}'::jsonb) where world_id = p_world and id = v_m.id;
    if mirror_trait(v_m.traits) is not null then
      perform tell(p_world, p_uid, 'Bronze mirror: ' || mirror_names(mirror_trait(v_m.traits)) || ' from ' || v_m.name
        || ' to the young. Mark used up.', 'event');
    end if;
  end loop;$$],
       array[1, 1, 1, 1])
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
