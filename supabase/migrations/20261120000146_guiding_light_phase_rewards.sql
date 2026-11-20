-- A Guiding Light phase's reward (`PATH_REWARDS`, `thepath_rewards`): once every step of a phase is ticked (done, not
-- skipped), a kit tool a better one, its head or handle, at `PATH_REWARD_QL`, given once (`thepath.rewarded`).
--
-- Asked for: a Guiding Light reward per phase, a starter tool at a higher quality.

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

-- The state keeps the phases rewarded.
create or replace function public.thepath_state(p jsonb)
 returns jsonb
 language sql
 immutable
as $function$
  select jsonb_build_object(
    'on', coalesce((p->>'on')::boolean, false),
    'skip', case when jsonb_typeof(p->'skip') = 'array' then p->'skip' else '[]'::jsonb end,
    'supply', case when jsonb_typeof(p->'supply') = 'object' then p->'supply' else '{}'::jsonb end,
    'did', case when jsonb_typeof(p->'did') = 'object' then p->'did' else '{}'::jsonb end,
    'stocked', case when jsonb_typeof(p->'stocked') = 'object' then p->'stocked' else '{}'::jsonb end,
    'crates', case when jsonb_typeof(p->'crates') = 'object' then p->'crates' else '{}'::jsonb end,
    'rewarded', case when jsonb_typeof(p->'rewarded') = 'array' then p->'rewarded' else '[]'::jsonb end)
$function$;

-- Every phase whose steps are all ticked and whose reward is not yet given: the reward, into the pack, and said.
create or replace function private.thepath_reward(p_world uuid, p_uid uuid)
 returns void
 language plpgsql
 set search_path to 'public'
as $function$
declare p player; v jsonb; r record;
begin
  select * into p from player pl where pl.world_id = p_world and pl.uid = p_uid for update;
  if not found then return; end if;
  v := thepath_state(p.thepath);
  for r in select w.phase, w.name, w.item, w.extra, w.ql from thepath_rewards() w loop
    continue when v->'rewarded' ? r.phase;
    continue when exists (
      select 1 from thepath_phases() s
       where s.phase = r.phase and not (coalesce(p.ticked, '[]'::jsonb) ? ('path:' || s.step)));
    insert into item (world_id, holder, holder_uid, def, ql, extra)
    values (p_world, 'player', p_uid, r.item, r.ql, nullif(r.extra, ''));
    v := v || jsonb_build_object('rewarded', (v->'rewarded') || to_jsonb(r.phase));
    update player set thepath = v where world_id = p_world and uid = p_uid;
    perform tell(p_world, p_uid, 'Guiding Light: ' || r.name || ' done. Reward: '
      || (select i.name from item_def i where i.id = r.item) || ' (' || r.extra || ') QL ' || r.ql || '.', 'event');
  end loop;
end $function$;

-- Looked at whenever a step of the Guiding Light ticks.
select pg_temp.patch_fn('public.rpc_settle(bigint,uuid,bigint,boolean,jsonb)'::regprocedure,
  $o$      perform private.thepath_stock(v_world, me);$o$,
  $n$      perform private.thepath_stock(v_world, me);
      perform private.thepath_reward(v_world, me);$n$);

select private.lock_doors();
