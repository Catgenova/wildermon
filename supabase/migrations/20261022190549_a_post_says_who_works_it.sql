-- A work post says who works out of it.
--
-- The island keeps the post a worker works out of on the worker (`creature.post`), and `rpc_creatures` only ever said
-- whether it had one (`idlePost`), and only of one standing idle. So the browser never knew which post anybody was on:
-- every worked post was drawn with its ribbon furled and its rune dark, and its menu offered to set a wildermon to it
-- that already had one. Now every creature that works out of a post says which, to anybody who can see it: the post
-- stands in the open and whoever looks at it can see who is at it. The browser reads it back onto the post
-- (`teamsFromCreatures`).

set local lock_timeout = '3s';

do $do$
declare v_def text;
  v_old text := $a$      -- And what it did this island day and the one before, for its keeper.
$a$;
  v_new text := $a$      -- The work post it works out of, to anybody: the post is in the open.
      || case when c.post is null then '{}'::jsonb else jsonb_build_object('post', c.post) end
      -- And what it did this island day and the one before, for its keeper.
$a$;
begin
  select pg_get_functiondef('public.rpc_creatures'::regproc) into v_def;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'rpc_creatures does not say its ledger where it was expected to';
  end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();
