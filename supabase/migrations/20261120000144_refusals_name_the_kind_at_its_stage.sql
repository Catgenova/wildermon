-- A creature's refusals name it as it is at its stage (`kind_name_at`), not as the kind it started as.
--
-- Reported: trying to tame a Vinehunter too far off said "Tame: Snarepup: too far." `creature_refusal` named the
-- species' first stage (`species_def.name`) in five of its words (too far, cannot be tamed, no task, not one of its
-- tasks, cannot be brushed), as did Work around me's and a wildermon crate's "no task". The browser's own words the same
-- (`kindName`).

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

select pg_temp.patch_fn('public.creature_refusal(uuid,uuid,text,jsonb)'::regprocedure, 'd.name || ''', 'kind_name_at(c) || ''', 5);
select pg_temp.patch_fn('public.around_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$return d.name || ': no task.';$o$, $n$return kind_name_at(c) || ': no task.';$n$);
select pg_temp.patch_fn('public.crate_open_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$return v_d.name || ': no task.';$o$, $n$return kind_name_at(v_c) || ': no task.';$n$);

select private.lock_doors();
