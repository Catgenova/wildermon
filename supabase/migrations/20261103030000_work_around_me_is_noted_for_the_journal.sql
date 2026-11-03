-- Asked for: two journal goals for new players, "Tame a wildermon" and "Set a wildermon to Work around me".
--
-- Taming is noted already (`perform_creature`, 'tamed'). Starting Work around me was noted by nothing, so a goal that
-- reads it could never tick on the island. It is noted now for whoever set it going ('around'), once it has started:
-- `around_refusal` has passed and the wildermon is at work round them.
--
-- supabase/test/journal.ts holds the island's note to the goal that reads it.

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

select pg_temp.patch_fn('public.perform_around(uuid, uuid, text, jsonb)'::regprocedure,
  $o$  select * into c from creature where world_id = p_world and id = c.id;
$o$,
  $n$  select * into c from creature where world_id = p_world and id = c.id;
  -- The journal's "Set a wildermon to Work around me".
  perform journal_note(p_world, p_uid, 'around');
$n$);

select private.lock_doors();
