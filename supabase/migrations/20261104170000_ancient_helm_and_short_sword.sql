-- An ancient helm and an ancient short sword, restored, and nothing improves or repairs them.
--
-- Asked for: "Implement that ancient Helms and ancient short swords cant be improved or repaired, even with ancient
-- whetstones. Ancient Helms provide +3 tile sight radius. Ancient swords swing 25% faster."
--
-- The relics 'ancient helm' and 'old blade' restore into `ancient_helm` and `ancient_short_sword` from now on
-- (`relic_def.result`, which the snapshot after this one gives the rulebook, with the two items, their `armour_def` and
-- `weapon_def` rows, and the browser's `RELICS`). Each is worn or wielded as a helm and a short sword are, at the same
-- armour, damage, reach and weight; the sword's `weapon_def.swing` is a short sword's times the browser's
-- `ANCIENT_SWORD_SWING`, which every swing on the island reads (`swung_with`, `act_base`). The helm's sight is the
-- browser's alone (`ANCIENT_HELM_SIGHT`, `Vision.sightRange`): the island works out no body's sight radius.
--
-- A helm or a short sword restored before this came back the same as a smith's, and nothing stored marks one: they stay
-- what they are, as the old pots and files did (20261019180000).
--
-- Nothing improves or repairs one (`unmendable`, the browser's `UNMENDABLE`), in the browser's words
-- (`unmendable_says`, `unmendableSays`): "Ancient helm: cannot be improved or repaired."
--
--   * Improve, Repair and a repair kit refuse it (`item_refusal`); neither is in `improvable_def`;
--   * an ancient whetstone does (`relic_use_refusal`), and Mend (`cast_reason`);
--   * a worker mending the stores passes it by (`damaged_in_stores`, and `errand_do`'s own pick).
--
-- And the journal's Restore all relics counts a relic by what it restores into (`restored:<id>`): whoever restored an
-- ancient helm or an old blade before this has `restored:helm` or `restored:short_sword` counted, which nothing else
-- counts, and is counted `restored:ancient_helm` or `restored:ancient_short_sword` as well.
--
-- `supabase/test/ancientgear.ts` holds the two sides to each other.

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

/** Restored gear that nothing improves or repairs: an ancient helm and an ancient short sword (`UNMENDABLE`). */
create or replace function unmendable(p_def text) returns boolean language sql immutable as $fn$
  select p_def in ('ancient_helm', 'ancient_short_sword')
$fn$;

/** Why, in the browser's words (`unmendableSays`): "Ancient helm: cannot be improved or repaired." */
create or replace function unmendable_says(p_def text) returns text language sql stable as $fn$
  select coalesce((select d.name from item_def d where d.id = p_def), p_def) || ': cannot be improved or repaired.'
$fn$;

-- Repair and a repair kit, after a find nobody has restored, before anything else is asked of it.
select pg_temp.patch_fn('public.item_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    if unrestored(v_it.def) then return not_restored_says(); end if;
    if v_it.dmg <= 0 then return 'Not damaged.'; end if;
$o$,
  $n$    if unrestored(v_it.def) then return not_restored_says(); end if;
    if unmendable(v_it.def) then return unmendable_says(v_it.def); end if;
    if v_it.dmg <= 0 then return 'Not damaged.'; end if;
$n$, 2);

-- Improve, before it is asked what the thing is made of.
select pg_temp.patch_fn('public.item_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    select * into v_what from improvable_def where item = v_it.def;
    if not found then return 'Cannot be improved.'; end if;
$o$,
  $n$    if unmendable(v_it.def) then return unmendable_says(v_it.def); end if;
    select * into v_what from improvable_def where item = v_it.def;
    if not found then return 'Cannot be improved.'; end if;
$n$);

-- An ancient whetstone.
select pg_temp.patch_fn('public.relic_use_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    if unrestored(v_it.def) then return not_restored_says(); end if;
    if v_it.dmg <= 0 then return 'Not damaged.'; end if;
$o$,
  $n$    if unrestored(v_it.def) then return not_restored_says(); end if;
    if unmendable(v_it.def) then return unmendable_says(v_it.def); end if;
    if v_it.dmg <= 0 then return 'Not damaged.'; end if;
$n$);

-- Mend.
select pg_temp.patch_fn('public.cast_reason(uuid,uuid,text,bigint)'::regprocedure,
  $o$  if p_cast = 'mend' and it.id is not null and unrestored(it.def) then return not_restored_says(); end if;
$o$,
  $n$  if p_cast = 'mend' and it.id is not null and unrestored(it.def) then return not_restored_says(); end if;
  if p_cast = 'mend' and it.id is not null and unmendable(it.def) then return unmendable_says(it.def); end if;
$n$);

-- A worker mending the stores: what it looks for, and what it mends in a go.
select pg_temp.patch_fn('public.damaged_in_stores(uuid,uuid)'::regprocedure,
  $o$and not unrestored(i.def)$o$, $n$and not unrestored(i.def) and not unmendable(i.def)$n$);
select pg_temp.patch_fn('public.errand_do(uuid,integer,boolean,text)'::regprocedure,
  $o$and not unrestored(i.def)$o$, $n$and not unrestored(i.def) and not unmendable(i.def)$n$);

-- Restore all relics, for those restored before this.
update player set tally = tally || jsonb_build_object('restored:ancient_helm', tally->'restored:helm')
  where tally ? 'restored:helm' and not tally ? 'restored:ancient_helm';
update player set tally = tally || jsonb_build_object('restored:ancient_short_sword', tally->'restored:short_sword')
  where tally ? 'restored:short_sword' and not tally ? 'restored:ancient_short_sword';

select private.lock_doors();
