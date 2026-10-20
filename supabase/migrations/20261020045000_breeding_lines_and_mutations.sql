-- Breeding: how deep a line runs, a mutation one young in two hundred, and one rule for a wild roll.
--
-- Asked for, three things:
--
--   * "Pedigree milestones. Each creature carries, per trait channel, a line depth: the number of consecutive
--     generations, ending with itself, in which the creature on that line carried a trait on that channel. At birth: a
--     foal's depth on a channel = 1 + max(dam's depth, sire's depth) on that channel if the foal carries a trait on
--     that channel, else 0. Wild-caught or spawned ones: 1 on each channel they carry a trait on, else 0. Cap at
--     PEDIGREE_MOST = 5. On each channel, the creature's trait multiplier on that channel is raised by
--     PEDIGREE_STEP = 0.02 x (depth - 1)."
--
--     A young one's line is settled at the covering with its traits (`pair_them`, `bred_line`), off both parents as
--     they stand then, and kept in its pedigree as `line`: the channels it runs past one on, by channel. A channel
--     with nothing written is one where the creature carries a trait on it (`line_depth`) -- which is the rule for
--     anything caught or spawned, and the backfill asked for: every creature already on an island stands at one on
--     each channel it carries a trait on, with no row written and nothing gained past one. What it is worth goes into
--     `beast_mul` beside what its rarity is worth, and as much less on a channel where less is better (`line_mul`);
--     nothing is looked up for a creature with no line past one on the channel asked about, which is nearly all of
--     them. Somebody else's is sent only for the channels of the traits they can read (`pedigree_seen`).
--
--   * "Mutations. One birth in MUTATION_ODDS = 200, the foal gets a trait that neither parent carries (compared by
--     family), at one tier above the best tier among the parents' traits (capped at the top tier). It takes the
--     foal's lowest-tier trait slot after normal inheritance (an empty slot first)." The last step of
--     `breed_traits`, in the browser's order: the roll, the slot (one at random of those sharing the lowest tier, as
--     an ancient lamp takes it), and the trait by `lamp_trait`'s rule, never a name either parent or the young one
--     carries. Its source is `mutation`, and the birth says so and what came (`mutation_said`).
--
--   * "Breeding preview ... if the island's formulas differ in any way, fix the difference (one rule)." They differed
--     in one place: a wild roll that came up with a name already carried. The browser's `rollTrait` rolls again,
--     whole, up to twelve times, and then takes anything not carried; `roll_trait` here kept the tier and the kind
--     it had rolled and took another name of them, which comes out at other odds. It rolls as the browser does now.

set local lock_timeout = '3s';

-- The rule's numbers, which the definitions snapshot also writes from the browser's (`PEDIGREE_MOST`, `PEDIGREE_STEP`,
-- `MUTATION_ODDS`), in the snapshot's own form; written here as well so that what follows does not wait on it.
create or replace function pedigree_most() returns double precision language sql immutable as $fn$ select 5::double precision $fn$;
create or replace function pedigree_step() returns double precision language sql immutable as $fn$ select 0.02::double precision $fn$;
create or replace function mutation_odds() returns double precision language sql immutable as $fn$ select 200::double precision $fn$;

-- Whether a set of traits carries anything on a channel (`carriesOn`).
create or replace function carries_on(p_traits text[], p_channel text)
returns boolean language sql stable as $fn$
  select exists (select 1 from trait_effect e where e.trait = any(coalesce(p_traits, '{}')) and e.channel = p_channel)
$fn$;

-- How deep a line runs on a channel: nought where it carries no trait on it, what is written where there is something,
-- and one otherwise; never past `pedigree_most` (`lineDepth`).
create or replace function line_depth(p_traits text[], p_line jsonb, p_channel text)
returns int language sql stable as $fn$
  select case when carries_on(p_traits, p_channel)
              then greatest(1, least(pedigree_most()::int, coalesce((p_line->>p_channel)::int, 1))) else 0 end
$fn$;

-- What a line this deep is worth on a channel: `pedigree_step` more a generation past the first, as much less where
-- less is better (`depthMul`).
create or replace function depth_mul(p_depth int, p_channel text)
returns double precision language sql stable as $fn$
  select case when coalesce(ch.up, true) then x.k else 1 / x.k end
    from (select 1 + pedigree_step() * (greatest(1, least(pedigree_most()::int, p_depth)) - 1) as k) x
    left join channel_def ch on ch.id = p_channel
$fn$;

-- What its line is worth on a channel; one where nothing past one is written (`lineMul`).
create or replace function line_mul(p_traits text[], p_line jsonb, p_channel text)
returns double precision language sql stable as $fn$
  select case when coalesce((p_line->>p_channel)::int, 1) <= 1 then 1::double precision
              else depth_mul(line_depth(p_traits, p_line, p_channel), p_channel) end
$fn$;

-- A young one's line: each channel it carries a trait on, one past the deeper of its parents' there, where that is
-- past one (`bredLine`).
create or replace function bred_line(p_young text[], p_dam text[], p_dam_line jsonb, p_sire text[], p_sire_line jsonb)
returns jsonb language sql stable as $fn$
  select coalesce(jsonb_object_agg(ch.id, d.depth), '{}'::jsonb)
    from channel_def ch
   cross join lateral (select least(pedigree_most()::int, 1 + greatest(line_depth(p_dam, p_dam_line, ch.id),
                                                                   line_depth(p_sire, p_sire_line, ch.id))) as depth) d
   where carries_on(p_young, ch.id) and d.depth > 1
$fn$;

-- The tier a mutation comes in at: one above the best either parent carries, and the top tier at the top (`mutationTier`).
create or replace function mutation_tier(p_sire text[], p_dam text[])
returns text language sql stable as $fn$
  select coalesce((select t.tier from tier_odds t where t.ord = b.ord + 1), (select t.tier from tier_odds t where t.ord = b.ord))
    from (select coalesce(max(o.ord), 0) as ord
            from unnest(coalesce(p_sire, '{}') || coalesce(p_dam, '{}')) u(id)
            join trait_def d on d.id = u.id join tier_odds o on o.tier = d.tier) b
$fn$;

-- What a birth says of a mutation, after its traits, a fighting trait's grade already in its name; nothing for a young one
-- without one (`mutationSaid`).
create or replace function mutation_said(p_from jsonb)
returns text language sql stable as $fn$
  select coalesce((select ' It is born with a mutation: ' || d.name || case when d.family is null then ' (' || d.tier || ')' else '' end
                          || ', which neither parent carries: '
                          || trait_says(d.id) || '.'
                     from jsonb_each_text(coalesce(p_from, '{}'::jsonb)) e join trait_def d on d.id = e.key
                    where e.value = 'mutation' limit 1), '')
$fn$;

-- A wild roll, as the browser's `rollTrait` makes it: fighting blood `fight_share` of the time, a name and its grade;
-- otherwise a plain trait of the tier rolled; a name already carried rolled again, whole, up to twelve times, and
-- then anything not carried.
create or replace function roll_trait(p_taken text[], p_husbandry double precision default 0, p_rare integer default 0)
returns text language plpgsql as $fn$
declare v_lift double precision := greatest(0, least(100, p_husbandry)) / 100 + greatest(0, coalesce(p_rare, 0));
        v_tier text; v_got text; v_families text[]; v_i int;
begin
  v_families := trait_families(p_taken);
  for v_i in 1..12 loop
    select t.tier into v_tier from tier_odds t
    order by -ln(greatest(1e-12, random())) / greatest(1e-9, t.weight * greatest(0, case t.tier
        when 'common' then 1 - v_lift * 0.35 when 'rare' then 1 + v_lift * 1.5
        when 'supreme' then 1 + v_lift * 3 else 1 + v_lift * 5 end))
    limit 1;
    if random() < fight_share() then
      select d.id into v_got from trait_def d where d.family is not null and d.tier = v_tier order by random() limit 1;
    else
      select d.id into v_got from trait_def d where d.family is null and d.tier = v_tier order by random() limit 1;
    end if;
    if v_got is not null and not (trait_family(v_got) = any(v_families)) then return v_got; end if;
  end loop;
  select d.id into v_got from trait_def d
    where not (coalesce(d.family, d.id) = any(v_families)) order by random() limit 1;
  return v_got;
end $fn$;

-- The draw, as before, and then the one young in `mutation_odds` that is born with something neither parent has.
create or replace function breed_traits(p_sire text[], p_dam text[], p_husbandry double precision, p_care double precision,
                                        p_keep_plus double precision default 0, p_up_plus double precision default 0)
returns jsonb language plpgsql as $fn$
declare pool text[]; keep double precision; up double precision; lift double precision; out_t text[] := '{}';
        slot int; left_t text[]; weights double precision[]; total double precision; r double precision;
        i int; pick text; v_above text; v_family text; v_up text;
        v_from jsonb := '{}'; v_source text; v_slot int; v_new text;
begin
  select array_agg(distinct t) into pool from unnest(p_sire || p_dam) t;
  pool := coalesce(pool, '{}');
  -- More of the pair and more of it a tier better, for a breeder's True Blood and Bred Up; never past certain.
  keep := least(1, inherit_chance(p_husbandry, p_care) + p_keep_plus);
  up := least(1, upgrade_chance(p_husbandry, p_care) + p_up_plus);
  lift := greatest(0, least(100, p_husbandry)) / 100;
  for slot in 1..trait_slots() loop
    -- What the pair carry that the foal does not, by name.
    select array_agg(t) into left_t from unnest(pool) t where not (trait_family(t) = any(trait_families(out_t)));
    left_t := coalesce(left_t, '{}');
    pick := null; v_source := 'roll';
    if array_length(left_t, 1) > 0 and random() < keep then
      -- A good keeper's eye falls on the best of what the pair carry.
      select array_agg(1 + (select o.ord from trait_def d join tier_odds o on o.tier = d.tier
                            where d.id = t) * lift * 2.4)
        into weights from unnest(left_t) t;
      select sum(w) into total from unnest(weights) w;
      r := random() * total;
      pick := left_t[array_length(left_t, 1)];
      for i in 1..array_length(left_t, 1) loop
        r := r - weights[i];
        if r < 0 then pick := left_t[i]; exit; end if;
      end loop;
      -- Whose it was: which of them carries that very trait, grade and all.
      v_source := case when pick = any(coalesce(p_dam, '{}')) then
                    case when pick = any(coalesce(p_sire, '{}')) then 'both' else 'dam' end
                  else 'sire' end;
    else
      pick := roll_trait(out_t, p_husbandry);
    end if;
    if pick is null then continue; end if;
    -- And then the chance that it comes through better than it went in.
    if random() < up then
      v_above := null; v_up := null;
      select o2.tier into v_above from trait_def d
        join tier_odds o on o.tier = d.tier join tier_odds o2 on o2.ord = o.ord + 1
        where d.id = pick;
      if v_above is not null then
        select d.family into v_family from trait_def d where d.id = pick;
        if v_family is not null then
          select d.id into v_up from trait_def d where d.family = v_family and d.tier = v_above;
        else
          select d.id into v_up from trait_def d
            where d.tier = v_above and d.family is null and not (d.id = any(out_t))
            order by random() limit 1;
        end if;
        if v_up is not null then pick := v_up; v_source := 'up'; end if;
      end if;
    end if;
    if not (trait_family(pick) = any(trait_families(out_t))) then
      out_t := out_t || pick;
      v_from := v_from || jsonb_build_object(pick, v_source);
    end if;
  end loop;
  -- A short straw in the draw never leaves a foal with fewer than three.
  while coalesce(array_length(out_t, 1), 0) < trait_slots() loop
    pick := roll_trait(out_t, p_husbandry);
    exit when pick is null;
    out_t := out_t || pick;
    v_from := v_from || jsonb_build_object(pick, 'roll');
  end loop;
  -- One young in `mutation_odds`: its lowest-tier slot, an empty one first, one at random of those sharing the lowest
  -- tier; a trait a tier above the best of the parents', never a name either of them or the young one carries.
  if random() < 1.0 / mutation_odds() then
    if coalesce(array_length(out_t, 1), 0) < trait_slots() then
      v_slot := coalesce(array_length(out_t, 1), 0) + 1;
    else
      select u.i into v_slot from unnest(out_t) with ordinality u(id, i)
        left join trait_def d on d.id = u.id left join tier_odds t on t.tier = d.tier
       order by coalesce(t.ord, 0), random() limit 1;
    end if;
    v_new := lamp_trait(mutation_tier(p_sire, p_dam), coalesce(p_sire, '{}') || coalesce(p_dam, '{}') || out_t);
    if v_new is not null then
      if v_slot <= coalesce(array_length(out_t, 1), 0) then v_from := v_from - out_t[v_slot]; end if;
      out_t[v_slot] := v_new;
      v_from := v_from || jsonb_build_object(v_new, 'mutation');
    end if;
  end if;
  return jsonb_build_object('traits', to_jsonb(out_t), 'from', v_from);
end $fn$;

-- Somebody else's pedigree says where a trait came from, and how deep its line runs, only for the traits they can read.
create or replace function pedigree_seen(p_world uuid, p_uid uuid, p_pedigree jsonb)
returns jsonb language sql stable as $fn$
  with seen as (
    select s.id from unnest(blood_seen(p_world, p_uid,
             array(select jsonb_object_keys(coalesce(p_pedigree->'from', '{}'::jsonb))))) s(id))
  select (p_pedigree - 'from' - 'line')
    || jsonb_build_object('from', coalesce((select jsonb_object_agg(s.id, p_pedigree->'from'->s.id) from seen s), '{}'::jsonb))
    || case when p_pedigree ? 'line' then jsonb_build_object('line', coalesce((
         select jsonb_object_agg(l.key, l.value) from jsonb_each(p_pedigree->'line') l
          where carries_on(array(select s.id from seen s), l.key)), '{}'::jsonb))
       else '{}'::jsonb end
$fn$;

-- Text patches, on what others may be changing too: each anchor must be there exactly once, and each is read afresh.
do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- What its line is worth, in its blood beside its rarity.
    ('beast_mul', $a$trait_mul(c.traits, p_channel) * deed_aura(c, p_channel)$a$,
$a$trait_mul(c.traits, p_channel) * deed_aura(c, p_channel)
       -- And how deep its line runs (`line_mul`); nothing is looked up for one with no line past one on this channel.
       * case when c.pedigree is null or not coalesce(c.pedigree->'line' ? p_channel, false) then 1
              else line_mul(c.traits, c.pedigree->'line', p_channel) end$a$),
    -- The young one's line, and a twin's, settled at the covering off both parents as they stand.
    ('pair_them', $a$'from', v_bred->'from')$a$,
$a$'from', v_bred->'from',
        'line', bred_line(array(select jsonb_array_elements_text(v_bred->'traits')),
                          dam.traits, dam.pedigree->'line', sire.traits, sire.pedigree->'line'))$a$),
    ('pair_them', $a$v_twin := jsonb_build_object('traits', v_twin->'traits', 'from', v_twin->'from',$a$,
$a$v_twin := jsonb_build_object('traits', v_twin->'traits', 'from', v_twin->'from',
      'line', bred_line(array(select jsonb_array_elements_text(v_twin->'traits')),
                        dam.traits, dam.pedigree->'line', sire.traits, sire.pedigree->'line'),$a$),
    -- Born with it in its pedigree; and a birth that mutated says so, and what came.
    ('drop_young', $a$'from', coalesce(v_coming->'from', '{}'::jsonb)) end$a$,
$a$'from', coalesce(v_coming->'from', '{}'::jsonb))
        || case when v_coming ? 'line' then jsonb_build_object('line', v_coming->'line') else '{}'::jsonb end end$a$),
    ('drop_young', $a$'.' || v_where$a$, $a$'.' || mutation_said(v_coming->'from') || v_where$a$)
  ) v(fn, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not there', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of %, not 1', r.fn, v_n, r.old; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
