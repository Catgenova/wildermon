-- A meal boost comes only off a dish made from a shut recipe, for the skills written on it.
--
-- Asked for: "remove knack buffs from non-recipe foods. Knack buffs will now only be on reciped foods", brews, spirits
-- and tinctures included. A dish's skills were dealt off the island's seed over `boon_skill` (`boon_of`); now they
-- are the dish's own, `item_def.knack_skills` (`ItemDef.knackSkills`, `boons.ts`), and anything with none gives
-- nothing: ordinary food, every drink, every brew and spirit. A tincture is taken no more. Boons already running
-- run out as they were. The browser's `grantBoon`, `knackSays`, `tasteSays` and Examine say the same.

set local lock_timeout = '3s';

create or replace function pg_temp.patch_fn(p_sig regprocedure, p_old text, p_new text, p_times int default 1) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_times then
    raise exception '%: % of "%", wanted %', p_sig, v_n, left(p_old, 120), p_times;
  end if;
  execute replace(v_def, p_old, p_new);
end $p$;

-- What a helping's meal boost is, as a label: "Meal boost: butchering skill gain +50%". Empty for none. The browser's `knackSays`.
create or replace function public.knack_says(p_item text) returns text
language sql stable set search_path to 'public' as $f$
  select coalesce((
    select 'Meal boost: ' || string_agg(lower(coalesce(s.name, k.skill)), ', ' order by k.ord)
      || ' skill gain +' || round(boon_bonus() * 100)::int || '%'
    from item_def d, unnest(d.knack_skills) with ordinality as k(skill, ord)
    left join skill_def s on s.id = k.skill
    where d.id = p_item
    having count(*) > 0), '')
$f$;

-- The first skill a dish's meal boost names, or null: no longer dealt off the seed.
create or replace function public.boon_of(p_seed bigint, p_item text) returns text
language sql stable set search_path to 'public' as $f$
  select d.knack_skills[1] from item_def d where d.id = p_item
$f$;

-- Eat or drink a dish off a shut recipe: each skill on it goes in faster for a while. Anything else gives nothing.
create or replace function public.grant_boon(p_world uuid, p_uid uuid, p_item text, p_ql double precision, p_knack double precision default 1)
returns text
language plpgsql set search_path to 'public' as $f$
declare v_skills text[]; v_skill text; v_secs double precision; v_boons jsonb; v_out jsonb := '[]'::jsonb;
        v_one jsonb; v_have text[] := '{}'; v_until double precision; v_now double precision;
begin
  select knack_skills into v_skills from item_def where id = p_item;
  if v_skills is null or cardinality(v_skills) = 0 then return null; end if;
  -- And longer for its maker's hand in it (a Cook's Flavoursome), and for Love's Long Table.
  v_secs := boon_time(p_item, p_ql, p_knack) * path_fx(p_world, p_uid, 'table', 1);
  v_now := world_time(p_world);
  v_until := v_now + v_secs;
  select boons into v_boons from player where world_id = p_world and uid = p_uid;
  for v_one in select * from jsonb_array_elements(coalesce(v_boons, '[]'::jsonb)) loop
    -- Drop what has already run out rather than letting the list grow for ever.
    if (v_one->>'until')::double precision <= v_now then continue; end if;
    -- A dish's own, never one left over from a tincture.
    if v_one->>'skill' = any(v_skills) and v_one->>'kind' is null then
      v_one := jsonb_set(v_one, '{until}', to_jsonb(greatest((v_one->>'until')::double precision, v_until)));
      v_have := v_have || (v_one->>'skill');
    end if;
    v_out := v_out || v_one;
  end loop;
  foreach v_skill in array v_skills loop
    if not v_skill = any(v_have) then
      v_out := v_out || jsonb_build_object('skill', v_skill, 'bonus', boon_bonus(),
        'until', v_until, 'from', lower((select coalesce(name, p_item) from item_def where id = p_item)));
    end if;
  end loop;
  update player set boons = v_out where world_id = p_world and uid = p_uid;
  return knack_says(p_item) || ', ' || clock_left(v_secs) || '.';
end $f$;

-- A tincture gives nothing now.
create or replace function public.grant_tincture(p_world uuid, p_uid uuid) returns void
language plpgsql set search_path to 'public' as $f$
begin
  return;
end $f$;

-- Per helping, to a Cook's tongue: the meal boost by name and how long it holds at this helping.
select pg_temp.patch_fn('public.taste_says(uuid,item)'::regprocedure,
  $o$  v_skill := boon_of((select seed from world where id = p_world), it.def);
  if v_skill is not null then
    v_said := v_said || (case when coalesce(d.food, 0) > 0 then 'meal' else 'drink' end || ' boost ' || clock_left(boon_time(it.def, it.ql, mark_of(it.mark, 'knack'))));
  end if;$o$,
  $n$  v_skill := knack_says(it.def);
  if v_skill <> '' then
    v_said := v_said || (lower(left(v_skill, 1)) || substr(v_skill, 2) || ', ' || clock_left(boon_time(it.def, it.ql, mark_of(it.mark, 'knack'))));
  end if;$n$);

-- Examine: the meal boost by name and how long it holds at this helping.
select pg_temp.patch_fn('public.examine_item_text(uuid,uuid,item)'::regprocedure,
  $o$  v_skill := boon_of((select seed from world where id = p_world), it.def);
  if v_skill is not null then
    v_out := v_out || case when coalesce(d.food, 0) > 0 then ' Meal' else ' Drink' end || ' boost: '
      || lower(coalesce((select name from skill_def where id = v_skill), v_skill)) || '.';
  end if;$o$,
  $n$  v_skill := knack_says(it.def);
  if v_skill <> '' then
    v_out := v_out || ' ' || v_skill || ', ' || clock_left(boon_time(it.def, it.ql, mark_of(it.mark, 'knack'))) || '.';
  end if;$n$);

-- A tincture is taken no more: nothing used up, nothing said.
select pg_temp.patch_fn('public.perform_item(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  -- And a tincture: the Naturalist's four trades go in faster for a while.
  elsif p_action = 'take_tincture' then
    if not consume(p_world, p_uid, v_it.def, 1, v_it.id) then return; end if;
    perform grant_tincture(p_world, p_uid);
    v_said := tincture_names();
    perform tell(p_world, p_uid, 'Tincture taken: ' || v_said
      || ' ' || whole_pct(tincture_bonus()) || ' faster for ' || clock_left(tincture_seconds()) || '.',
      'event');$o$,
  $n$  -- A tincture is taken no more: it gave a meal boost, and only a dish off a shut recipe gives one.
  elsif p_action = 'take_tincture' then
    return;$n$);

select pg_temp.patch_fn('public.perform_item(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    -- A dish favours a trade, and having eaten it you are better at that
    -- trade for a while.$o$,
  $n$    -- A dish off a shut recipe: the skills it names go in faster for a while.$n$);

select pg_temp.patch_fn('public.perform_item(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    -- Milk and anything brewed favour a trade the way a cooked dish does,
    -- and for longer for its brewer's hand in it (a Cook's Strong Brew).$o$,
  $n$    -- Only a dish off a shut recipe carries a meal boost (`knack_skills`); a brew, milk or a spirit gives none.$n$);

-- A maker's mark on a dish: a meal boost now, and only on a dish off a shut recipe. The browser's `MARK_SAYS.knack`.
select pg_temp.patch_fn('public.mark_says(jsonb)'::regprocedure,
  $o$'gives a meal or drink boost that lasts '$o$,
  $n$'gives a meal boost (dishes off a shut recipe) that lasts '$n$);

select private.lock_doors();
