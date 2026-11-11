-- Breed with, and pregnant.
--
-- Asked for: "Some more wording changes ... in husbandry: "put to x" > "breed with x", "in young" > "pregnant"".
-- The menu label is the generated `action_def` row ("Breed with a mate"); here the island's words for a dam carrying
-- young: the refusal to pair one already carrying (`pair_refuses`, `last_refusal`) and Look it over (`blood_read`). The
-- browser's `pairRefuses`, the `pair_creature` check and `read_blood` in src/game/husbandry.ts say the same.

set local lock_timeout = '3s';

create or replace function pg_temp.patch_fn(p_fn regproc, p_old text, p_new text, p_times int default 1) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_fn);
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_times then
    raise exception '%: % of "%", wanted %', p_fn, v_n, left(p_old, 120), p_times;
  end if;
  execute replace(v_def, p_old, p_new);
end $p$;

select pg_temp.patch_fn('public.pair_refuses'::regproc,
  $o$ is already in young.'$o$, $n$ is already pregnant.'$n$);
select pg_temp.patch_fn('public.last_refusal'::regproc,
  $o$ is already in young.'$o$, $n$ is already pregnant.'$n$);
select pg_temp.patch_fn('public.blood_read'::regproc,
  $o$' In young, due in '$o$, $n$' Pregnant, due in '$n$);

select private.lock_doors();
