-- The altar's casts are gone.
--
-- Asked for: "remove all 'call on it' options at the altar. Those spells are going away." Call, Mend, Light of the
-- dawn, Circle of cunning, Fair wind and Bounty: no longer cast. The door takes no `cast` action, the faith refusal and
-- perform lose their branches, and the two functions and the table behind them go. A tool already blessed keeps its
-- blessings (`bless`, read by `bless_bonus`); praying, favour and the patrons' spells are untouched.

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

select pg_temp.patch_fn('public.faith_action(text)'::regprocedure,
  $o$  select p_action in ('pray', 'pray_statue', 'cast', 'meditate', 'choose_path', 'use_ability')$o$,
  $n$  select p_action in ('pray', 'pray_statue', 'meditate', 'choose_path', 'use_ability')$n$);

select pg_temp.patch_fn('public.faith_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  elsif p_action = 'cast' then
    return cast_reason(p_world, p_uid, p_target->>'spell', target_item(p_target));

$o$, '');

select pg_temp.patch_fn('public.perform_faith(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  elsif p_action = 'cast' then
    if cast_reason(p_world, p_uid, p_target->>'spell', target_item(p_target)) is not null then
      return;
    end if;
    perform journal_note(p_world, p_uid, 'cast:' || (p_target->>'spell'));
    perform tell(p_world, p_uid,
      do_cast(p_world, p_uid, p_target->>'spell', target_item(p_target)), 'event');
$o$, '');

drop function if exists public.do_cast(uuid, uuid, text, bigint);
drop function if exists public.cast_reason(uuid, uuid, text, bigint);
drop table if exists public.cast_def;

select private.lock_doors();
