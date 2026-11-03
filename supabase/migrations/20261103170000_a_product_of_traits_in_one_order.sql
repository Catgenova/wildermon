-- A product of traits taken in one order, so it is the same number every time it is asked.
--
-- A trait's effect on a channel, an aura's, a workshop's pace are each a product of several factors, worked out as
-- `exp(sum(ln(...)))` over the rows that hold them, in whatever order the plan reads them. In floating point a sum
-- depends on its order in the last bit: live run 41712405658 (writeload.ts, shard 3) had one Budscarab's evade
-- 0.2950395804826025 asked one way and 0.29503958048260254 the other, the same function over the same rows, planned
-- twice. Each sum now goes in a fixed order -- by trait, by creature then trait, by piece -- and gives one answer.
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

select pg_temp.patch_fn('public.trait_mul(text[],text)'::regprocedure,
  $o$exp(sum(ln(nullif(e.mul, 0))))$o$, $n$exp(sum(ln(nullif(e.mul, 0)) order by e.trait))$n$);

select pg_temp.patch_fn('public.trait_worth(text[])'::regprocedure,
  $o$select e.channel, sum(e.mul) as n,
             case when bool_or(e.mul = 0) then 0 else exp(sum(ln(nullif(e.mul, 0)))) end as m$o$,
  $n$select e.channel, sum(e.mul order by e.trait) as n,
             case when bool_or(e.mul = 0) then 0 else exp(sum(ln(nullif(e.mul, 0)) order by e.trait)) end as m$n$);

select pg_temp.patch_fn('public.deed_aura_of(uuid,uuid,bigint,text)'::regprocedure,
  $o$exp(sum(ln(nullif(e.mul, 0))))$o$, $n$exp(sum(ln(nullif(e.mul, 0)) order by o.id, e.trait))$n$);

select pg_temp.patch_fn('public.piece_pace(uuid,uuid,text)'::regprocedure,
  $o$exp(sum(ln(f.pace)))$o$, $n$exp(sum(ln(f.pace) order by f.id))$n$);

select private.lock_doors();
