-- A restored statuette enchanted into a patron's statue, and a prayer said with one from the pack.
--
-- Asked for: "The restored statue can be Enchanted using one of each mote to be statue of x diety and can be used for
-- mobile prayer instead of needing to be at an altar". And decided: one option for each patron, anybody any of the
-- three; and only a follower of the statue's patron prays with it.
--
-- `enchant_statue` (a relic use, `relic_use_refusal`, `perform_relic_use`), on a statuette in the pack with the patron
-- chosen on the target (`patron`, which `private.spec_target` takes from now on): `statue_motes` of every element's mote,
-- all used up, and the statuette made `patron_statue(patron)` where it lies, its QL, damage and rarity as they were.
-- Done anywhere, with enchanting, as a job: it never fails, and trains enchanting a full go. Refused, in the browser's
-- words (`statueEnchantRefusal`):
--
--   * on anything but a restored statuette (a fragment of one among them): "Restored statuettes only.";
--   * without a patron that is one: "Choose a patron.";
--   * short of motes, naming every element short: "Need 1 dark mote and 1 light mote."
--
-- `pray_statue` (a faith action, `faith_refusal`, `perform_faith`), on a patron's statue in the pack: the altar's prayer
-- at the statue's QL -- the same wait between prayers (`prayer_rest`, in the same words), the same favour
-- (`prayer_worth`, the hour, Prayer, a Favoured worn and soul strength), the same faith, Prayer and soul strength
-- trained. Refused to anybody whose patron is not the statue's, no patron at all included, in the browser's words
-- (`statueFollowers`): "Statue of Chaos: followers of Chaos only." The altar's prayer is as it was.
--
-- The three statues, the motes and the two names (`statuette`, `statue_motes`, `patron_statue`, `statue_patron`) are
-- the rulebook's, in the snapshot after this one. No player's row or thing is changed.
--
-- `supabase/test/patronstatue.ts` holds the two sides to each other.

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

/** "a, b and c", as the browser's `listed` says a list. */
create or replace function listed(p text[]) returns text language sql immutable as $fn$
  select case when coalesce(array_length(p, 1), 0) < 2 then coalesce(p[1], '')
              else array_to_string(p[1:array_length(p, 1) - 1], ', ') || ' and ' || p[array_length(p, 1)] end
$fn$;

/** Why a statue is not prayed with by you, in the browser's words (`statueFollowers`): "Statue of Chaos: followers of Chaos only." */
create or replace function statue_followers(p_def text) returns text language plpgsql stable as $fn$
begin
  return coalesce((select d.name from item_def d where d.id = p_def), p_def) || ': followers of '
      || coalesce((select pd.name from patron_def pd where pd.id = statue_patron(p_def)), '') || ' only.';
end $fn$;

-- The patron a statuette is made the statue of, on the target as the browser sends it.
select pg_temp.patch_fn('private.spec_target()'::regprocedure,
  $o$"brew": {"t": "text"}, "dyeFrom": {"t": "text"}$o$,
  $n$"brew": {"t": "text"}, "dyeFrom": {"t": "text"}, "patron": {"t": "text"}$n$);

/* ---- Enchanting a statuette ---------------------------------------------------------------------- */

create or replace function relic_use_action(p_action text) returns boolean language sql immutable as $fn$
  select p_action in ('hone_whetstone', 'open_seed_jar', 'read_rune_tablet', 'enchant_statue')
$fn$;

select pg_temp.patch_fn('public.relic_use_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$declare v_it item; v_skill text := p_target->>'skill'; v_name text;$o$,
  $n$declare v_it item; v_skill text := p_target->>'skill'; v_name text; v_short text[];$n$);
select pg_temp.patch_fn('public.relic_use_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  if p_action = 'open_seed_jar' then$o$,
  $n$  if p_action = 'enchant_statue' then
    -- A restored statuette, a patron, and `statue_motes` of every element in the pack (`statueEnchantRefusal`).
    if v_it.def <> statuette() then
      return 'Restored ' || lower(coalesce((select d.name from item_def d where d.id = statuette()), statuette())) || 's only.';
    end if;
    if not exists (select 1 from patron_def pd where pd.id = p_target->>'patron') then return 'Choose a patron.'; end if;
    select array_agg(statue_motes() || ' ' || m.e || ' mote' || case when statue_motes() = 1 then '' else 's' end order by m.n)
      into v_short from unnest(mote_elements()) with ordinality m(e, n)
     where pack_count(p_world, p_uid, m.e || '_mote') < statue_motes();
    if v_short is not null then return 'Need ' || listed(v_short) || '.'; end if;
    return null;
  end if;
  if p_action = 'open_seed_jar' then$n$);

select pg_temp.patch_fn('public.perform_relic_use(uuid,uuid,text,jsonb)'::regprocedure,
  $o$declare v_it item; v_stone item; v_seed text;$o$,
  $n$declare v_it item; v_stone item; v_seed text; v_e text;$n$);
select pg_temp.patch_fn('public.perform_relic_use(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  else
    -- `tablet_gain` into the skill chosen, all at once; the tablet used up.$o$,
  $n$  elsif p_action = 'enchant_statue' then
    -- `statue_motes` of every element used up, and the statuette the patron's statue where it lies, as it was.
    foreach v_e in array mote_elements() loop
      perform consume(p_world, p_uid, v_e || '_mote', statue_motes());
    end loop;
    update item set def = patron_statue(p_target->>'patron') where id = v_it.id returning * into v_it;
    perform skill_raise(p_world, p_uid, enchanting_skill(), 1);
    perform tell(p_world, p_uid, 'Enchanted: ' || (select d.name from item_def d where d.id = v_it.def) || ', QL '
      || to_char(v_it.ql, 'FM990.0') || '. ' || statue_motes() * array_length(mote_elements(), 1) || ' motes used up.', 'event');

  else
    -- `tablet_gain` into the skill chosen, all at once; the tablet used up.$n$);

/* ---- Praying with a statue ----------------------------------------------------------------------- */

create or replace function faith_action(p_action text) returns boolean language sql immutable as $fn$
  select p_action in ('pray', 'pray_statue', 'cast', 'meditate', 'choose_path', 'use_ability')
$fn$;

select pg_temp.patch_fn('public.faith_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$declare p player; pc placed; rest double precision; med double precision;$o$,
  $n$declare p player; pc placed; rest double precision; med double precision; v_statue item;$n$);
select pg_temp.patch_fn('public.faith_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  elsif p_action = 'cast' then$o$,
  $n$  elsif p_action = 'pray_statue' then
    -- A patron's statue in the pack, anywhere, by a follower of its patron, at the altar's wait (`statuePrayRefusal`).
    v_statue := carried(p_world, p_uid, target_item(p_target));
    if v_statue.id is null or statue_patron(v_statue.def) is null then return 'It is gone.'; end if;
    if p.patron is distinct from statue_patron(v_statue.def) then return statue_followers(v_statue.def); end if;
    rest := prayer_rest() - extract(epoch from (now() - coalesce(p.prayed_at, 'epoch')));
    if rest > 0 then
      return 'Prayer cooldown: ' || round(prayer_rest() / 60) || ' min. ' || ceil(rest / 60) || ' min left.';
    end if;
    return null;

  elsif p_action = 'cast' then$n$);

select pg_temp.patch_fn('public.perform_faith(uuid,uuid,text,jsonb)'::regprocedure,
  $o$declare p player; pc placed; faith double precision;$o$,
  $n$declare p player; pc placed; v_statue item; v_ql double precision; faith double precision;$n$);
select pg_temp.patch_fn('public.perform_faith(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  if p_action = 'pray' then
    select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint;
    if not found then return; end if;
$o$,
  $n$  if p_action in ('pray', 'pray_statue') then
    -- At an altar, its QL; with a patron's statue in the pack, the statue's, for a follower of its patron (`prayed`).
    if p_action = 'pray_statue' then
      v_statue := carried(p_world, p_uid, target_item(p_target));
      if v_statue.id is null or statue_patron(v_statue.def) is null or statue_patron(v_statue.def) is distinct from p.patron then
        return;
      end if;
      v_ql := v_statue.ql;
    else
      select * into pc from placed where world_id = p_world and id = (p_target->>'id')::bigint;
      if not found then return; end if;
      v_ql := pc.ql;
    end if;
$n$);
select pg_temp.patch_fn('public.perform_faith(uuid,uuid,text,jsonb)'::regprocedure,
  $o$prayer_worth(pc.ql, hour,$o$, $n$prayer_worth(v_ql, hour,$n$);

select private.lock_doors();
