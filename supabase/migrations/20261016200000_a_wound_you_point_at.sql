-- A wound you point at.
--
-- Asked: a Health window where you click a wound to bandage or treat it. A
-- dressing, the lye and a salve each picked their own wound -- the worst a
-- dressing would do good, the first gone bad, the worst a salve could guard --
-- so clicking one wound could treat another. An ask may now name the wound
-- (`Target.wound`): that one is treated, or the ask is refused saying why,
-- never another. Left out, each picks its own as before.
--
-- The island keeps no number on a wound, and two of a kind on one part can be
-- open at once when one has gone bad, so a wound is named by its kind, its
-- part and when it was opened (`woundKey`).

create or replace function wound_key(w jsonb) returns text language sql immutable as $fn$
  select (w->>'kind') || '|' || (w->>'part') || '|' || coalesce(w->>'at', '')
$fn$;

-- The wound an ask names, or null when it has closed since (or none is named).
create or replace function wound_named(p_wounds jsonb, p_target jsonb) returns jsonb language sql immutable as $fn$
  select x from jsonb_array_elements(coalesce(p_wounds, '[]'::jsonb)) x
   where p_target ? 'wound' and wound_key(x) = p_target->>'wound'
   limit 1
$fn$;

-- "The cut on your arm" (`onYour`, capitalised).
create or replace function wound_on_your(w jsonb) returns text language sql stable as $fn$
  select 'The ' || (select name from wound_kind_def where id = w->>'kind') || ' on your ' || part_name(w->>'part')
$fn$;

-- Why a dressing out of your pack will not go on this one wound, or null (`dressRefusalFor`).
create or replace function dress_refusal_for(p_world uuid, p_uid uuid, w jsonb) returns text language plpgsql stable as $fn$
declare use item;
begin
  if w is null then return 'That wound has closed.'; end if;
  if coalesce((w->>'infected')::boolean, false) then
    return wound_on_your(w) || ' has gone bad. Clean it out before anything will hold on it.';
  end if;
  use := dressing_for(p_world, p_uid, w);
  if use.id is null then return 'You have nothing to dress it with.'; end if;
  if not dressing_pace(w, dressing_put(use)) > dressing_pace(w, w->>'dressing') then
    return wound_on_your(w) || ' is already dressed at least as well as what you carry would dress it.';
  end if;
  return null;
end $fn$;

-- Why a salve will not go on this one wound, or null (`salveRefusalFor`).
create or replace function salve_refusal_for(w jsonb) returns text language sql stable as $fn$
  select case
    when w is null then 'That wound has closed.'
    when coalesce((w->>'infected')::boolean, false) then wound_on_your(w) || ' has gone bad. Clean it out before anything will hold on it.'
    when w->>'dressing' is null then 'A salve goes on over a dressing. Dress the wound first.'
    when coalesce((w->>'salved')::boolean, false) then wound_on_your(w) || ' has a salve on it already.'
    when w->>'dressing' = (select herb from wound_kind_def where id = w->>'kind')
      then wound_on_your(w) || ' is under the ' || (w->>'dressing') || ' that suits it, and cannot go bad.'
    else null end
$fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- A dressing asked for one wound: that one, or why not.
    (1, 'fight_refusal', $$    if jsonb_array_length(coalesce(p.wounds, '[]'::jsonb)) = 0 then
$$, $$    if p_target ? 'wound' then return dress_refusal_for(p_world, p_uid, wound_named(p.wounds, p_target)); end if;
    if jsonb_array_length(coalesce(p.wounds, '[]'::jsonb)) = 0 then
$$),
    -- The lye asked for one wound: it has to be the one gone bad.
    (2, 'fight_refusal', $$    if not exists (select 1 from jsonb_array_elements(coalesce(p.wounds, '[]'::jsonb)) x
$$, $$    if p_target ? 'wound' then
      hurt := wound_named(p.wounds, p_target);
      if hurt is null then return 'That wound has closed.'; end if;
      if not coalesce((hurt->>'infected')::boolean, false) then return wound_on_your(hurt) || ' has not gone bad.'; end if;
    end if;
    if not exists (select 1 from jsonb_array_elements(coalesce(p.wounds, '[]'::jsonb)) x
$$),
    -- The dressing goes on the wound asked for while it would still do it good, and on no other.
    (3, 'perform_fight', $$    hurt := wound_to_dress(p_world, p_uid, pt.wounds);
$$, $$    hurt := wound_to_dress(p_world, p_uid, pt.wounds);
    if not v_other and p_target ? 'wound' then
      hurt := wound_named(pt.wounds, p_target);
      if dress_refusal_for(p_world, p_uid, hurt) is not null then return; end if;
    end if;
$$),
    -- The lye on the wound asked for, or the first gone bad.
    (4, 'perform_fight', $$    select x into hurt from jsonb_array_elements(p.wounds) x where (x->>'infected')::boolean limit 1;
$$, $$    hurt := wound_named(p.wounds, p_target);
    if hurt is null or not coalesce((hurt->>'infected')::boolean, false) then
      select x into hurt from jsonb_array_elements(p.wounds) x where (x->>'infected')::boolean limit 1;
    end if;
$$),
    -- A salve asked for one wound: that one, or why not.
    (5, 'item_refusal', $$    return salve_refusal(v_p.wounds);
$$, $$    if p_target ? 'wound' then return salve_refusal_for(wound_named(v_p.wounds, p_target)); end if;
    return salve_refusal(v_p.wounds);
$$),
    (6, 'perform_item', $$    v_hurt := salve_for(v_p.wounds);
$$, $$    v_hurt := case when p_target ? 'wound' then wound_named(v_p.wounds, p_target) else salve_for(v_p.wounds) end;
    if p_target ? 'wound' and salve_refusal_for(v_hurt) is not null then return; end if;
$$)
  ) as t(ord, fn, old, new) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of change %, not 1', r.fn, v_n, r.ord; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
