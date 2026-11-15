/*
 * Why it failed: a failed skill check's line names the term that cost it most
 * (`src/game/failwhy.ts`).
 *
 * A check's chance (`skill_odds`, what `skill_check` always rolled against):
 *
 *   0.6 + skill / 100 * 0.38 + tool QL / 500 - difficulty / 150, between 0.3 and 0.98,
 *
 * where the difficulty is the job's, plus its material's on a craft or an
 * improve, less what mind logic eases (`mind_ease`, never more than half) on a
 * check that takes it; and a perk on the job lets only a share of failures
 * stand (`perk_pass`), so the chance is 1 - (1 - that) * the share.
 *
 * A failed check keeps what it was rolled at, for this transaction only
 * (`wildermon.fail_odds`), and a perk's share is folded into it when the
 * perk's own roll fails too. The failure line then asks `fail_why`: each term
 * moved to its best -- skill to `skill_top`, the tool's QL to `ql_top`, the
 * material's difficulty to 0, mind logic to `skill_top` -- with the others
 * held, and the one whose best would have added most to the chance named, with
 * its number and those points: "Dig failed. Biggest factor: tool QL 12 (−18%)."
 * None that would have added a point (`fail_least`): nothing said. A tie goes
 * to the term first in `fail_factor_label`'s order.
 *
 * Nothing is stored: the line is the only thing that changes. The same
 * reckoning in the browser (`failFactor`) shows on hover of the dig and mine
 * odds in the Skills window.
 */

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

-- A check's chance, as `skill_check` has always worked it out (`skillOdds`).
create or replace function public.skill_odds(p_skill double precision, p_difficulty double precision,
                                             p_tool_ql double precision default 0, p_ease double precision default 0)
returns double precision language sql immutable as $$
  select least(0.98, greatest(0.3,
    0.6 + (p_skill / 100) * 0.38 + p_tool_ql / 500
      - (case when p_ease > 0 then greatest(p_difficulty * 0.5, p_difficulty - p_ease) else p_difficulty end) / 150))
$$;

-- The difficulty mind logic at this level takes off a check that takes it (`mindEaseAt`).
create or replace function public.mind_ease_at(p_mind double precision)
returns double precision language sql immutable as $$
  select greatest(0, (p_mind - char_start()) * 0.2)
$$;

create or replace function public.mind_ease(p_world uuid, p_uid uuid)
returns double precision language sql stable as $$
  select mind_ease_at(skill_of(p_world, p_uid, 'mind_logic'))
$$;

create or replace function public.skill_check(p_skill double precision, p_difficulty double precision,
                                              p_tool_ql double precision default 0, p_ease double precision default 0)
returns boolean language plpgsql as $function$
declare v_ok boolean;
begin
  perform set_config('wildermon.fail_odds', '', true);
  if coalesce(current_setting('wildermon.foreknow', true), '') = 'on' then
    perform set_config('wildermon.foreknown', 'on', true);
    return true;
  end if;
  v_ok := random() < skill_odds(p_skill, p_difficulty, p_tool_ql, p_ease);
  -- A failure keeps what it was rolled at, for its line to name the term that cost it most (`fail_why`).
  if not v_ok then
    perform set_config('wildermon.fail_odds', jsonb_build_object(
      's', p_skill, 'd', p_difficulty, 't', p_tool_ql, 'e', p_ease, 'f', 1)::text, true);
  end if;
  return v_ok;
end $function$;

-- The same draws as ever; a failure that stands keeps the share of failures the perk let stand, for `fail_why`,
-- and one the perk passes is forgotten.
create or replace function public.perk_pass(p_ok boolean, p_fail double precision)
returns boolean language plpgsql as $function$
declare v jsonb;
begin
  if p_ok then return true; end if;
  if random() >= p_fail then
    perform set_config('wildermon.fail_odds', '', true);
    return true;
  end if;
  v := nullif(current_setting('wildermon.fail_odds', true), '')::jsonb;
  if v is not null then
    perform set_config('wildermon.fail_odds',
      jsonb_set(v, '{f}', to_jsonb(p_fail * (v->>'f')::double precision))::text, true);
  end if;
  return false;
end $function$;

-- A term is named only when its best would have added this much to the chance (`FAIL_LEAST`).
create or replace function public.fail_least() returns double precision language sql immutable as $$ select 0.01::double precision $$;

-- What a failure line calls each term, in the order a tie goes (`FAIL_FACTORS`).
create or replace function public.fail_factor_label(p_id text) returns text language sql stable as $$
  select case p_id
    when 'skill' then 'skill'
    when 'tool' then 'tool QL'
    when 'material' then 'material difficulty'
    when 'mind' then (select name from skill_def where id = 'mind_logic')
  end
$$;

-- The term that cost a check most against its best, the others held; no row when none cost `fail_least` (`failFactor`).
create or replace function public.fail_factor(p_skill double precision, p_difficulty double precision,
                                              p_tool_ql double precision default 0, p_ease double precision default 0,
                                              p_fail double precision default 1, p_material double precision default 0,
                                              p_mind double precision default null)
returns table (id text, n double precision, cost double precision) language sql stable as $$
  with t (o, id, n, best) as (
    select 1, 'skill', p_skill, skill_odds(skill_top(), p_difficulty, p_tool_ql, p_ease)
    union all select 2, 'tool', p_tool_ql, skill_odds(p_skill, p_difficulty, ql_top(), p_ease) where p_tool_ql > 0
    union all select 3, 'material', p_material, skill_odds(p_skill, p_difficulty - p_material, p_tool_ql, p_ease) where p_material > 0
    union all select 4, 'mind', p_mind, skill_odds(p_skill, p_difficulty, p_tool_ql, mind_ease_at(skill_top())) where p_mind is not null
  ), c as (
    select t.o, t.id, t.n, p_fail * (t.best - skill_odds(p_skill, p_difficulty, p_tool_ql, p_ease)) as cost from t
  )
  select c.id, c.n, c.cost from c where c.cost >= fail_least() order by c.cost desc, c.o limit 1
$$;

-- " Biggest factor: tool QL 12 (−18%).", or nothing (`failFactorSaid`). Rounded half up, as the browser rounds.
create or replace function public.fail_factor_said(p_id text, p_n double precision, p_cost double precision)
returns text language sql stable as $$
  select case when p_id is null then '' else
    ' Biggest factor: ' || fail_factor_label(p_id) || ' ' || floor(p_n + 0.5)::bigint
      || ' (−' || floor(p_cost * 100 + 0.5)::bigint || '%).' end
$$;

/*
 * What the last failed check in this transaction cost most, said for the end
 * of its line, and forgotten: the material it was made of (a craft's, an
 * improve's) and mind logic where the check takes it are the caller's to say.
 */
create or replace function public.fail_why(p_mat text default null, p_mind double precision default null)
returns text language plpgsql as $function$
declare v jsonb; f record;
begin
  v := nullif(current_setting('wildermon.fail_odds', true), '')::jsonb;
  perform set_config('wildermon.fail_odds', '', true);
  if v is null then return ''; end if;
  select * into f from fail_factor((v->>'s')::double precision, (v->>'d')::double precision, (v->>'t')::double precision,
    (v->>'e')::double precision, (v->>'f')::double precision, mat_difficulty(p_mat), p_mind);
  return fail_factor_said(f.id, f.n, f.cost);
end $function$;

/* ---- the failure lines -------------------------------------------------- */

-- A craft, and a scroll written: read before anything is damaged.
select pg_temp.patch_fn('public.perform_craft(uuid,uuid,text,jsonb)'::regprocedure,
  $o$        v_rope double precision; v_sail double precision;$o$,
  $n$        v_rope double precision; v_sail double precision; v_why text;$n$);
select pg_temp.patch_fn('public.perform_craft(uuid,uuid,text,jsonb)'::regprocedure,
  $o$skill_check(s, hard, tq), pk(p_world, p_uid, 'fail:' || p_recipe, 1)) then
$o$,
  $n$skill_check(s, hard, tq), pk(p_world, p_uid, 'fail:' || p_recipe, 1)) then
    v_why := fail_why(mat);
$n$);
select pg_temp.patch_fn('public.perform_craft(uuid,uuid,text,jsonb)'::regprocedure,
  $o$concat_ws(' ', r.fail, nullif(scroll_harm_said(v_harm), ''))$o$,
  $n$concat_ws(' ', r.fail || v_why, nullif(scroll_harm_said(v_harm), ''))$n$);
select pg_temp.patch_fn('public.perform_craft(uuid,uuid,text,jsonb)'::regprocedure,
  $o$coalesce(r.fail, 'Failed: ' || lower((select coalesce(name, r.result) from item_def where id = r.result)) || '.'), v_hurt)$o$,
  $n$coalesce(r.fail, 'Failed: ' || lower((select coalesce(name, r.result) from item_def where id = r.result)) || '.') || v_why, v_hurt)$n$);

-- Felling and collecting.
select pg_temp.patch_fn('public.perform_gather(uuid,uuid,text,jsonb)'::regprocedure,
  $o$'Cut failed.', 'event'$o$, $n$'Cut failed.' || fail_why(), 'event'$n$);
select pg_temp.patch_fn('public.perform_gather(uuid,uuid,text,jsonb)'::regprocedure,
  $o$'Collect failed: '
        || lower(t.name) || '.', 'event'$o$,
  $n$'Collect failed: '
        || lower(t.name) || '.' || fail_why(), 'event'$n$);

-- Digging and mining.
select pg_temp.patch_fn('public.act_perform(uuid,uuid,text,jsonb)'::regprocedure,
  $o$'Dig failed.', 'event'$o$, $n$'Dig failed.' || fail_why(), 'event'$n$);
select pg_temp.patch_fn('public.perform_dig_tile(uuid,uuid,jsonb)'::regprocedure,
  $o$'Dig failed.', 'event'$o$, $n$'Dig failed.' || fail_why(), 'event'$n$);
select pg_temp.patch_fn('public.perform_cellar(uuid,uuid,text,jsonb)'::regprocedure,
  $o$'Dig failed.', 'event'$o$, $n$'Dig failed.' || fail_why(), 'event'$n$);
select pg_temp.patch_fn('public.perform_cellar(uuid,uuid,text,jsonb)'::regprocedure,
  $o$'Mining failed.', 'event'$o$, $n$'Mining failed.' || fail_why(), 'event'$n$);
select pg_temp.patch_fn('public.perform_terrain(uuid,uuid,text,jsonb)'::regprocedure,
  $o$'Mining failed.', 'event'$o$, $n$'Mining failed.' || fail_why(), 'event'$n$);
select pg_temp.patch_fn('public.perform_outcrop(uuid,uuid,text,jsonb)'::regprocedure,
  $o$'Mining failed.', 'event'$o$, $n$'Mining failed.' || fail_why(), 'event'$n$);

-- Garden steps, stone and timber.
select pg_temp.patch_fn('public.perform_steps(uuid,uuid,text,jsonb)'::regprocedure,
  $o$'Steps failed: materials kept.', 'event'$o$, $n$'Steps failed: materials kept.' || fail_why(), 'event'$n$, 2);

-- The ground: concrete, rubble, dredging, pruning, grafting, a bush cut, a stump dug.
select pg_temp.patch_fn('public.perform_ground(uuid,uuid,text,jsonb)'::regprocedure,
  $o$'Concrete failed: concrete lost.', 'event'$o$, $n$'Concrete failed: concrete lost.' || fail_why(), 'event'$n$);
select pg_temp.patch_fn('public.perform_ground(uuid,uuid,text,jsonb)'::regprocedure,
  $o$'Rubble failed: shards lost.', 'event'$o$, $n$'Rubble failed: shards lost.' || fail_why(), 'event'$n$);
select pg_temp.patch_fn('public.perform_ground(uuid,uuid,text,jsonb)'::regprocedure,
  $o$'Dredge failed.', 'event'$o$, $n$'Dredge failed.' || fail_why(), 'event'$n$);
select pg_temp.patch_fn('public.perform_ground(uuid,uuid,text,jsonb)'::regprocedure,
  $o$'Prune failed: ' || lower(v_tree.name)
        || '.', 'event'$o$,
  $n$'Prune failed: ' || lower(v_tree.name)
        || '.' || fail_why(), 'event'$n$);
select pg_temp.patch_fn('public.perform_ground(uuid,uuid,text,jsonb)'::regprocedure,
  $o$' sprout lost.', 'event'$o$, $n$' sprout lost.' || fail_why(), 'event'$n$);
select pg_temp.patch_fn('public.perform_ground(uuid,uuid,text,jsonb)'::regprocedure,
  $o$'Cut failed.', 'event'$o$, $n$'Cut failed.' || fail_why(), 'event'$n$);
select pg_temp.patch_fn('public.perform_ground(uuid,uuid,text,jsonb)'::regprocedure,
  $o$' stump.', 'event'$o$, $n$' stump.' || fail_why(), 'event'$n$);

-- An improve pass: its material and mind logic are terms of it.
select pg_temp.patch_fn('public.perform_item(uuid,uuid,text,jsonb)'::regprocedure,
  $o$'FM990.0') || ' damage.', 'event'$o$,
  $n$'FM990.0') || ' damage.' || fail_why(v_it.extra, skill_of(p_world, p_uid, 'mind_logic')), 'event'$n$);

select private.lock_doors();
