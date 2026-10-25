/*
 * Everybody's wildermon at its own level and stage.
 *
 * Reported: "Players see each other's wildermon always as level 1 and 1st
 * stage evolution." Its level is its best skill and its stage follows from
 * that (`creatureLevel`, `stageOf`); `rpc_creatures` sent the skills of your
 * own and of wild ones only, so somebody else's read the book's 1.00 and was
 * drawn and named as a first stage. Its skills now go to everybody; the rest
 * of its working life (care, ledger, what it is fed) stays its keeper's.
 */
set local lock_timeout = '3s';

do $do$
declare v_def text; v_old text; v_n int;
begin
  v_def := pg_get_functiondef('rpc_creatures'::regproc);
  v_old := $$|| case when c.mode = 'wild' then jsonb_build_object('skills', c.skills) else '{}'::jsonb end$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'rpc_creatures has % of its wild skills, not 1', v_n; end if;
  execute replace(v_def, v_old,
    $$|| case when c.keeper is distinct from me then jsonb_build_object('skills', c.skills) else '{}'::jsonb end$$);
end $do$;

select private.lock_doors();
