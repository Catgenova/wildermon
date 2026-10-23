set local lock_timeout = '3s';

-- A harder tame teaches more taming: an attempt's gain once over, and once more for every `tame_hard` taming the one
-- tried needs (`tame_needs`). An offering (`perform_creature`), taking one out of a trap (`perform_trap`) and the
-- Beastmaster's Call of the Wild (`class_spell_cast`). The browser's `tameLearn`.
create or replace function tame_learn(c creature) returns double precision language sql stable as $fn$
  select coalesce(1 + (tame_needs(c)).level / tame_hard(), 1)
$fn$;

do $do$
declare v_def text; v_n int;
  v_fix text[][] := array[
    array['perform_creature', 'try_gain(true, tame_gain())', 'try_gain(true, tame_gain() * tame_learn(c))', '1'],
    array['perform_creature', 'try_gain(false, tame_gain())', 'try_gain(false, tame_gain() * tame_learn(c))', '1'],
    array['class_spell_cast', 'try_gain(true, tame_gain())', 'try_gain(true, tame_gain() * tame_learn(c))', '1'],
    array['perform_trap', 'try_gain(v_clean, free_gain())', 'try_gain(v_clean, free_gain() * tame_learn(c))', '1']];
  i int;
begin
  for i in 1 .. array_length(v_fix, 1) loop
    v_def := pg_get_functiondef(v_fix[i][1]::regproc);
    v_n := (length(v_def) - length(replace(v_def, v_fix[i][2], ''))) / length(v_fix[i][2]);
    if v_n <> v_fix[i][4]::int then raise exception '% has % of %', v_fix[i][1], v_n, v_fix[i][2]; end if;
    execute replace(v_def, v_fix[i][2], v_fix[i][3]);
  end loop;
end $do$;

select private.lock_doors();
