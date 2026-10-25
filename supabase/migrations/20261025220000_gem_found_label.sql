/*
 * Mining review, point 4: a gem found says what it is and its QL, as a label
 * (`gemFound`), not "Something glints in the rubble".
 */
set local lock_timeout = '3s';

do $do$
declare v_def text; v_old text; v_n int;
begin
  v_def := pg_get_functiondef('maybe_gem'::regproc);
  v_old := $$'Something glints in the rubble: a ' || lower(v_gem) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')'$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'maybe_gem has % of its line, not 1', v_n; end if;
  execute replace(v_def, v_old, $$'Found: ' || lower(v_gem) || ', QL ' || to_char(v_ql, 'FM990.0') || '.'$$);
end $do$;

select private.lock_doors();
