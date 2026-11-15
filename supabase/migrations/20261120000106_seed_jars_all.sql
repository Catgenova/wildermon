/*
 * Ancient seed jars: Open, All (N).
 *
 * Asked: "add an open all option on ancient jars". Seed jars do not stack, so
 * each is its own row, and the goes of one job are asked again of the job's
 * own target (`settle`): a run of Open on one jar was refused, "It is gone.",
 * after its first go. Open now opens the jar named while it is carried, else
 * the first other loose one in the pack, lowest id first (`seed_jar_opened`,
 * `seedJarOpened` in the browser), and is refused only with no seed jar
 * carried. So each go of Open All (N) opens the next jar; the browser offers
 * One and All (N), N the jars carried to the goes cap (`allOfKindEntry`).
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

-- The seed jar an Open opens: the one named while it is carried, else the first other loose one in the pack, lowest
-- id first; none, with no seed jar carried (`seedJarOpened`).
create or replace function seed_jar_opened(p_world uuid, p_uid uuid, p_target jsonb) returns item
language sql stable as $$
  select coalesce(
    (select n from carried(p_world, p_uid, target_item(p_target)) n where n.def = 'ancient_seed_jar'),
    (select i from item i
      where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
        and i.def = 'ancient_seed_jar' and not i.locked
      order by i.id limit 1))
$$;

-- Refused only with no seed jar carried, before the named one is asked for.
select pg_temp.patch_fn('relic_use_refusal(uuid, uuid, text, jsonb)',
$o$  v_it := carried(p_world, p_uid, target_item(p_target));
  if v_it.id is null then return 'It is gone.'; end if;$o$,
$n$  v_it := carried(p_world, p_uid, target_item(p_target));
  -- The jar named, or the next one carried (`seed_jar_opened`).
  if p_action = 'open_seed_jar' then
    return case when (seed_jar_opened(p_world, p_uid, p_target)).id is null then 'It is gone.' end;
  end if;
  if v_it.id is null then return 'It is gone.'; end if;$n$);

select pg_temp.patch_fn('relic_use_refusal(uuid, uuid, text, jsonb)',
$o$  if p_action = 'open_seed_jar' then
    return case when v_it.def = 'ancient_seed_jar' then null else 'It is gone.' end;
  end if;
$o$, '');

-- And opens that one.
select pg_temp.patch_fn('perform_relic_use(uuid, uuid, text, jsonb)',
$o$    select c.seed into v_seed from crop_def c order by random() limit 1;
    if not spend_stack(p_world, p_uid, v_it.id, 1) then return; end if;$o$,
$n$    v_it := seed_jar_opened(p_world, p_uid, p_target);
    select c.seed into v_seed from crop_def c order by random() limit 1;
    if v_it.id is null or not spend_stack(p_world, p_uid, v_it.id, 1) then return; end if;$n$);

select private.lock_doors();
