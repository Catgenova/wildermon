-- Wild forms, and a wildermon's lifetime at work.
--
-- Wild forms. Asked for: "rare forms in the wild: a colour form (a fifth palette per kind, distinct from its four
-- variants) at 1 in 500 wild spawns, and a size form (large +15% drawn size and +10% health, or small −15% size and +10%
-- speed) at 1 in 200, independent. Exact odds as constants. Kept when tamed; passed to young with a stated chance."
-- One stood up in the country by the stocking is rolled for, each form off a roll of its own (`wild_form_put`,
-- `wild_form_roll`; the browser's `standWild`, `wildFormRoll`), never a monster. They are kept on the row
-- (`form_colour`, `form_size`), so a taming keeps them; a covering settles the young one's off its parents', each at
-- `form_pass` for each parent that has it (`bred_form`, `pair_them`), and the birth gives them it (`give_birth`). A
-- large one's health and a small one's speed are its blood (`form_mul`, in `beast_mul`). The browser hears them with the
-- creature (`formColour`, `formSize`), draws its colours and its size, and names them on its card. The field guide
-- keeps each form of a kind under `species/form` (`colour`, `large`, `small`), seen while one in it stands near
-- (`rpc_guide_seen`) and tamed with its kind (`guide_mark_forms`).
--
-- A lifetime at work. Asked for: "per wildermon lifetime work stats from the existing work ledger: lifetime output by
-- thing, best day (count and date), total time working and total time idle (with the top idle reason). Keep lifetime
-- counters on the island cheaply (one small jsonb/columns update where the ledger is already written)". One jsonb on the
-- creature (`work_stats`), put right in the same row write as the ledger and the reason by a trigger that fires only on a
-- deed worker's row and only when those are written (`work_stats_keep`): what that write added to the day's ledger goes
-- onto the lifetime (`work_stats_ledger`, the browser's `workFromLedger`), and the seconds since the last settle onto
-- the reason the worker stood about for them, or work (`work_stats_time`, `workTime`); a settle more than `idle_stale`
-- past its turn counts that much as idle, `away`. Sent to its keeper only (`rpc_creatures`, `work`).

set local lock_timeout = '3s';

-- The numbers come in with the definitions (`dump-defs.ts`); these are what they are until then.
create or replace function colour_form_odds() returns double precision language sql immutable as $fn$ select 500::double precision $fn$;
create or replace function size_form_odds() returns double precision language sql immutable as $fn$ select 200::double precision $fn$;
create or replace function large_health() returns double precision language sql immutable as $fn$ select 1.1::double precision $fn$;
create or replace function small_speed() returns double precision language sql immutable as $fn$ select 1.1::double precision $fn$;
create or replace function form_pass() returns double precision language sql immutable as $fn$ select 0.25::double precision $fn$;
create or replace function work_items() returns double precision language sql immutable as $fn$ select 12::double precision $fn$;

select private.shut('alter table creature add column if not exists form_colour boolean not null default false');
select private.shut('alter table creature add column if not exists form_size text check (form_size in (''large'', ''small''))');
select private.shut('alter table creature add column if not exists work_stats jsonb');

/* ---- Wild forms -------------------------------------------------------------------------------------------------- */

-- Its forms off two rolls (`wildFormRoll`): the colour form under one in `colour_form_odds`, and under one in
-- `size_form_odds` a size form, large for the lower half and small for the upper. Never a monster.
create or replace function wild_form_roll(p_species text, p_colour double precision, p_size double precision,
                                          out form_colour boolean, out form_size text)
language sql stable as $fn$
  select not sd.monster and p_colour < 1 / colour_form_odds(),
         case when sd.monster then null
              when p_size < 1 / (2 * size_form_odds()) then 'large'
              when p_size < 1 / size_form_odds() then 'small' end
    from species_def sd where sd.id = p_species
$fn$;

-- One just put out in the country, now and then in a form (`standWild`). Its id, as `wild_stage_put` hands it on.
create or replace function wild_form_put(p_world uuid, p_id int, p_colour double precision default random(),
                                         p_size double precision default random()) returns int
language plpgsql as $fn$
declare c creature; f record;
begin
  if p_id is null then return null; end if;
  select * into c from creature where world_id = p_world and id = p_id;
  if not found or c.mode <> 'wild' then return p_id; end if;
  f := wild_form_roll(c.species, p_colour, p_size);
  if not coalesce(f.form_colour, false) and f.form_size is null then return p_id; end if;
  update creature set form_colour = coalesce(f.form_colour, false), form_size = f.form_size
    where world_id = p_world and id = p_id returning * into c;
  if f.form_size is not null then
    update creature set health = max_health(c) where world_id = p_world and id = p_id;
  end if;
  return p_id;
end $fn$;

-- A young one's forms off its parents' and two rolls (`bredForm`): each at `form_pass` for each parent that has it, the
-- dam's size before the sire's where both have one.
create or replace function bred_form(p_dam_colour boolean, p_dam_size text, p_sire_colour boolean, p_sire_size text,
                                     p_colour double precision, p_size double precision,
                                     out form_colour boolean, out form_size text)
language sql immutable as $fn$
  select p_colour < form_pass() * (coalesce(p_dam_colour, false)::int + coalesce(p_sire_colour, false)::int),
         (array_remove(array[p_dam_size, p_sire_size], null))[floor(p_size / form_pass())::int + 1]
$fn$;

-- What its size form does to its blood on a channel (`formMul`).
create or replace function form_mul(c creature, p_channel text) returns double precision language sql immutable as $fn$
  select case when c.form_size = 'large' and p_channel = 'hardy' then large_health()
              when c.form_size = 'small' and p_channel = 'speed' then small_speed() else 1 end
$fn$;

-- The forms a creature is in, as guide keys (`formKey`).
create or replace function form_keys(p_species text, p_colour boolean, p_size text) returns text[] language sql immutable as $fn$
  select array_remove(array[case when p_colour then p_species || '/colour' end,
                            case when p_size is not null then p_species || '/' || p_size end], null)
$fn$;

-- A kind and each form it is in marked (`guideMarkKind`): the kind as before, and each form seen and tamed with it.
create or replace function guide_mark_forms(p_world uuid, p_uid uuid, c creature, p_what text) returns void language sql as $fn$
  select guide_mark(p_world, p_uid, k, p_what)
    from unnest(array[c.species] || form_keys(c.species, c.form_colour, c.form_size)) k
$fn$;

/* ---- A lifetime at work ------------------------------------------------------------------------------------------ */

-- What one write of the ledger added, onto the lifetime (`workFromLedger`): the day's counters as they now stand less
-- what they stood at before (nothing before, on a day the write rolled it onto; nothing at all for a day gone back),
-- at most `work_items` kinds of thing, and the day the best if it has now handled more than the best.
create or replace function work_stats_ledger(s jsonb, was jsonb, nw jsonb) returns jsonb language plpgsql immutable as $fn$
declare v jsonb := coalesce(s, '{"goes": 0, "skill": 0, "made": {}, "best": null, "work": 0, "rest": 0, "idle": {}}'::jsonb);
        b jsonb; k text; n int; more int; handled int := 0;
begin
  if nw is null then return v; end if;
  if was is not null and (nw->>'day')::int < (was->>'day')::int then return v; end if;
  b := case when was is not null and (was->>'day')::int = (nw->>'day')::int then was->'now' end;
  v := jsonb_set(v, '{goes}', to_jsonb((v->>'goes')::int + (nw->'now'->>'goes')::int - coalesce((b->>'goes')::int, 0)));
  v := jsonb_set(v, '{skill}', to_jsonb((v->>'skill')::double precision + (nw->'now'->>'skill')::double precision
                                        - coalesce((b->>'skill')::double precision, 0)));
  for k, n in select e.key, e.value::int from jsonb_each_text(nw->'now'->'made') e loop
    handled := handled + n;
    more := n - coalesce((b->'made'->>k)::int, 0);
    if more > 0 and (v->'made' ? k or (select count(*) from jsonb_object_keys(v->'made')) < work_items()) then
      v := jsonb_set(v, array['made', k], to_jsonb(coalesce((v->'made'->>k)::int, 0) + more));
    end if;
  end loop;
  if handled > 0 and handled > coalesce((v->'best'->>'n')::int, 0) then
    v := jsonb_set(v, '{best}', jsonb_build_object('day', (nw->>'day')::int, 'n', handled));
  end if;
  return v;
end $fn$;

-- So many seconds onto the lifetime by why it stood about for them (`workTime`): resting for `rest`, `bed` and `tired`,
-- idle by the reason for the rest, at work for none.
create or replace function work_stats_time(s jsonb, p_secs double precision, p_why text) returns jsonb language sql immutable as $fn$
  select case
    when not (p_secs > 0) then v
    when p_why is null then jsonb_set(v, '{work}', to_jsonb((v->>'work')::double precision + p_secs))
    when p_why in ('rest', 'bed', 'tired') then jsonb_set(v, '{rest}', to_jsonb((v->>'rest')::double precision + p_secs))
    else jsonb_set(v, array['idle', p_why], to_jsonb(coalesce((v->'idle'->>p_why)::double precision, 0) + p_secs)) end
  from (select coalesce(s, '{"goes": 0, "skill": 0, "made": {}, "best": null, "work": 0, "rest": 0, "idle": {}}'::jsonb) v) x
$fn$;

-- Put right as a deed worker's row is written: what the ledger gained, and the seconds since it was last settled on the
-- reason it stood about for them. `at` is when that was (epoch seconds), started afresh as it comes onto a settlement.
create or replace function work_stats_keep() returns trigger language plpgsql as $fn$
declare v_at double precision; v_now double precision; v_late double precision;
begin
  if new.mode <> 'deed' then return new; end if;
  if old.mode <> 'deed' then
    new.work_stats := jsonb_set(coalesce(new.work_stats, work_stats_time(null, 0, null)), '{at}',
                                to_jsonb(extract(epoch from coalesce(new.settled_at, now()))));
    return new;
  end if;
  if new.ledger is distinct from old.ledger then
    new.work_stats := work_stats_ledger(new.work_stats, old.ledger, new.ledger);
  end if;
  if new.settled_at is distinct from old.settled_at and new.settled_at is not null then
    v_now := extract(epoch from new.settled_at);
    v_at := coalesce((new.work_stats->>'at')::double precision, v_now);
    if v_now > v_at then
      -- Past its turn by more than `idle_stale`: the clock was not settling it, and that much was idle.
      v_late := v_now - greatest(v_at, extract(epoch from coalesce(old.until, new.settled_at)));
      if v_late > idle_stale() then
        new.work_stats := work_stats_time(work_stats_time(new.work_stats, v_now - v_at - v_late, old.idle_why), v_late, 'away');
      else
        new.work_stats := work_stats_time(new.work_stats, v_now - v_at, old.idle_why);
      end if;
    end if;
    new.work_stats := jsonb_set(coalesce(new.work_stats, work_stats_time(null, 0, null)), '{at}', to_jsonb(v_now));
  end if;
  return new;
end $fn$;

select private.shut('drop trigger if exists work_stats_keep on public.creature');
select private.shut($ddl$create trigger work_stats_keep before update of ledger, settled_at, mode on public.creature
  for each row when (new.mode = 'deed') execute function work_stats_keep()$ddl$);

/* ---- Where they go in ----------------------------------------------------------------------------------------- */

-- A form's key in the book, beside its kind's page (`formKey`): `species/colour`, `species/large`, `species/small`, for a
-- kind that can be kept.
create or replace function guide_kind(p_key text) returns boolean language sql stable as $fn$
  select case when position('/' in p_key) > 0 then
           split_part(p_key, '/', 2) in ('colour', 'large', 'small') and split_part(p_key, '/', 3) = ''
           and exists (select 1 from species_def d where d.id = split_part(p_key, '/', 1) and not d.monster)
         else exists (select 1 from species_def d
                  where d.id = split_part(p_key, ':', 1)
                    and (position(':' in p_key) = 0
                         or (split_part(p_key, ':', 2) ~ '^[0-9]+$'
                             and split_part(p_key, ':', 2)::int between 1 and coalesce(array_length(d.stages, 1), 0)))) end
$fn$;

create or replace function guide_mark(p_world uuid, p_uid uuid, p_species text, p_what text) returns void language sql as $fn$
  insert into guide as g (world_id, uid, species, tamed, bred)
  select p_world, p_uid, p_species, p_what = 'tamed', p_what = 'bred'
   where p_uid is not null and p_what in ('seen', 'tamed', 'bred')
     and guide_kind(p_species)
     -- A stage's page is marked seen and nothing else; a form seen and tamed (`guideMarks`).
     and (position(':' in p_species) = 0 or p_what = 'seen')
     and (position('/' in p_species) = 0 or p_what in ('seen', 'tamed'))
     and exists (select 1 from player pl where pl.world_id = p_world and pl.uid = p_uid)
  on conflict (world_id, uid, species) do update
    set tamed = g.tamed or excluded.tamed, bred = g.bred or excluded.bred
    where (excluded.tamed and not g.tamed) or (excluded.bred and not g.bred)
$fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- The stocking: each one put out is rolled for its forms (`wild_form_put`), after its stage.
    (1, 'creature_stock', $a$    perform wild_stage_put(p_world, creature_spawn(p_world, got, gx + 0.5, gy + 0.5, 'wild',
      now() - make_interval(secs => random() * 6 * 3600 * 1.6)));$a$,
     $a$    -- And now and then in a wild form (`wild_form_put`).
    perform wild_form_put(p_world, wild_stage_put(p_world, creature_spawn(p_world, got, gx + 0.5, gy + 0.5, 'wild',
      now() - make_interval(secs => random() * 6 * 3600 * 1.6))));$a$),
    (2, 'creature_stock_block', $a$    perform wild_stage_put(p_world, creature_spawn(p_world, v_got, v_x + 0.5, v_y + 0.5, 'wild',
      now() - make_interval(secs => random() * 6 * 3600 * 1.6)));$a$,
     $a$    -- And now and then in a wild form (`wild_form_put`).
    perform wild_form_put(p_world, wild_stage_put(p_world, creature_spawn(p_world, v_got, v_x + 0.5, v_y + 0.5, 'wild',
      now() - make_interval(secs => random() * 6 * 3600 * 1.6))));$a$),
    -- Its blood: a large one's health and a small one's speed (`form_mul`), with no look-up for one in no size form.
    (3, 'beast_mul', $a$       * case when p_channel in ('work', 'learn') then care_mul(c) else 1 end
$a$, $a$       * case when p_channel in ('work', 'learn') then care_mul(c) else 1 end
       -- And its size form (`form_mul`).
       * case when c.form_size is null then 1 else form_mul(c, p_channel) end
$a$),
    -- A covering settles the young one's forms off its parents' (`bred_form`), and a twin's its own.
    (4, 'pair_them', $a$        'line', bred_line(array(select jsonb_array_elements_text(v_bred->'traits')),
                          dam.traits, dam.pedigree->'line', sire.traits, sire.pedigree->'line'))
        || case when v_twin is null then '{}'::jsonb else jsonb_build_object('twin', v_twin) end,$a$,
     $a$        'line', bred_line(array(select jsonb_array_elements_text(v_bred->'traits')),
                          dam.traits, dam.pedigree->'line', sire.traits, sire.pedigree->'line'))
        -- And its parents' forms, at `form_pass` for each that has one (`bred_form`).
        || (select jsonb_strip_nulls(jsonb_build_object('formColour', case when f.form_colour then true end, 'formSize', f.form_size))
              from bred_form(dam.form_colour, dam.form_size, sire.form_colour, sire.form_size, random(), random()) f)
        || case when v_twin is null then '{}'::jsonb else jsonb_build_object('twin', v_twin
             || (select jsonb_strip_nulls(jsonb_build_object('formColour', case when f.form_colour then true end, 'formSize', f.form_size))
                   from bred_form(dam.form_colour, dam.form_size, sire.form_colour, sire.form_size, random(), random()) f)) end,$a$),
    -- And the birth gives them it.
    (5, 'drop_young', $a$  update creature set traits = coalesce(v_traits, '{}'), sex = v_coming->>'sex',
      hunger = 0.9, care = 0.5,$a$,
     $a$  update creature set traits = coalesce(v_traits, '{}'), sex = v_coming->>'sex',
      hunger = 0.9, care = 0.5,
      -- Its forms, as the covering settled them (`bred_form`).
      form_colour = coalesce((v_coming->>'formColour')::boolean, false), form_size = v_coming->>'formSize',$a$),
    -- Tamed by an offering, out of a trap, by a Call of the Wild: the kind and each form it is in (`guide_mark_forms`).
    (6, 'perform_creature', $a$perform guide_mark(p_world, p_uid, c.species, 'tamed');$a$, $a$perform guide_mark_forms(p_world, p_uid, c, 'tamed');$a$),
    (7, 'perform_trap', $a$perform guide_mark(p_world, p_uid, c.species, 'tamed');$a$, $a$perform guide_mark_forms(p_world, p_uid, c, 'tamed');$a$),
    (8, 'class_spell_cast', $a$perform guide_mark(p_world, p_uid, c.species, 'tamed');$a$, $a$perform guide_mark_forms(p_world, p_uid, c, 'tamed');$a$),
    -- A form handed over as seen is taken while one in it stands near.
    (9, 'rpc_guide_seen', $a$                  where c.world_id = p_world and c.species = split_part(s, ':', 1) and c.mode <> 'stored'
                    and (position(':' in s) = 0 or stage_of(c) = split_part(s, ':', 2)::int)$a$,
     $a$                  where c.world_id = p_world and c.species = split_part(split_part(s, ':', 1), '/', 1) and c.mode <> 'stored'
                    and (position(':' in s) = 0 or stage_of(c) = split_part(s, ':', 2)::int)
                    and (position('/' in s) = 0 or (split_part(s, '/', 2) = 'colour' and c.form_colour)
                         or c.form_size = split_part(s, '/', 2))$a$),
    -- The browser hears its forms, to anybody, and its lifetime at work, its keeper only.
    (10, 'rpc_creatures', $a$      || case when c.rare is null then '{}'::jsonb else jsonb_build_object('rare', c.rare) end
$a$, $a$      || case when c.rare is null then '{}'::jsonb else jsonb_build_object('rare', c.rare) end
      -- And its wild forms (`formColour`, `formSize`), which the browser draws and its card names.
      || case when c.form_colour or c.form_size is not null
              then jsonb_build_object('formColour', c.form_colour, 'formSize', c.form_size) else '{}'::jsonb end
      -- And its lifetime at work, for its keeper, without the island's own clock (`work_stats`).
      || case when c.keeper = me and c.work_stats is not null then jsonb_build_object('work', c.work_stats - 'at') else '{}'::jsonb end
$a$)
  ) as t(n, fn, old, new) order by n loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of anchor %, not 1', r.fn, v_n, r.n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
