-- Trophies (item_def.trophy) cannot be improved or repaired: `unmendable` says so for them, as for restored gear
-- and moulds, so Improve, Repair, a repair kit, Mend, an ancient whetstone and a worker mending the stores all
-- refuse them. The browser's `unmendable` the same.
--
-- And an Improve pass says the stock it took: "Improved: long sword, QL 41.2. Used: 1 iron lump." (a failed
-- pass the same, it takes the stock all the same).

set local lock_timeout = '3s';

create or replace function public.unmendable(p_def text)
 returns boolean
 language sql
 stable
as $function$
  select p_def in ('ancient_helm', 'ancient_short_sword')
      or exists (select 1 from mould_def m where m.id = p_def)
      or coalesce((select d.trophy from item_def d where d.id = p_def), false)
$function$;

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

select pg_temp.patch_fn('public.perform_item(uuid,uuid,text,jsonb)'::regprocedure,
  $o$v_full text; v_name text;$o$, $n$v_full text; v_used text; v_name text;$n$);

select pg_temp.patch_fn('public.perform_item(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    if v_stock.id is null or not spend_stack(p_world, p_uid, v_stock.id, 1) then return; end if;$o$,
  $n$    if v_stock.id is null then return; end if;
    v_used := ' Used: 1 ' || lower(item_name(v_stock)) || '.';
    if not spend_stack(p_world, p_uid, v_stock.id, 1) then return; end if;$n$);

select pg_temp.patch_fn('public.perform_item(uuid,uuid,text,jsonb)'::regprocedure,
  $o$ || ' damage.' || fail_why(v_it.extra, skill_of(p_world, p_uid, 'mind_logic')), 'event');$o$,
  $n$ || ' damage.' || v_used || fail_why(v_it.extra, skill_of(p_world, p_uid, 'mind_logic')), 'event');$n$);

select pg_temp.patch_fn('public.perform_item(uuid,uuid,text,jsonb)'::regprocedure,
  $o$      || to_char(v_it.ql, 'FM990.0') || '.', 'event');

  elsif p_action = 'quench_item' then$o$,
  $n$      || to_char(v_it.ql, 'FM990.0') || '.' || v_used, 'event');

  elsif p_action = 'quench_item' then$n$);

select private.lock_doors();
