-- A crated wildermon works round nobody, and a posted one neither.
--
-- Reported: "crated wildermon that are still counting as also working on posts, and a wildermon that is both working
-- around me and assigned to a post. Unable to assign crated wildermon to open posts." Shutting a wildermon into its
-- crate (`crate_shut_in`: the crate action, Work around me ending with its crate to hand, a trap, a spell, a team
-- out of its crate) cleared its post but not its `around`, so one put away from Work around me stayed counted as
-- working round its keeper while stored; and setting a wildermon to a post (`assign_post`) cleared neither, so one
-- taken out of that crate onto a post was on the post and round its keeper at once. Both now clear `around`; the
-- browser's `shutIn` and `assign_post` do the same. And every row left that way is put right: no stored wildermon
-- and no posted one works round anybody.

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

select pg_temp.patch_fn('public.crate_shut_in(uuid,integer,bigint,bigint)'::regprocedure,
  $o$  update creature set mode = 'stored', post = null, phase = 'idle', carrying = null,$o$,
  $n$  update creature set mode = 'stored', post = null, around = null, phase = 'idle', carrying = null,$n$);

select pg_temp.patch_fn('public.perform_settlement(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    update creature set post = p.id, mode = 'deed', phase = 'idle', enemy = null, hunting = null,
        from_x = p.cx, from_y = p.cy + 0.6, to_x = p.cx, to_y = p.cy + 0.6,$o$,
  $n$    update creature set post = p.id, mode = 'deed', around = null, phase = 'idle', enemy = null, hunting = null,
        from_x = p.cx, from_y = p.cy + 0.6, to_x = p.cx, to_y = p.cy + 0.6,$n$);

-- The rows left that way.
update creature set around = null where around is not null and (mode = 'stored' or post is not null);

select private.lock_doors();
