-- A tamed wildermon's keeper, by name, wherever it is seen.
--
-- Asked for: "Make it apparent who tamed wildermon belong to". The creatures read (`rpc_creatures`) said only `mine`,
-- true or false: a browser could colour somebody else's name over it and could not say whose it was. The keeper's
-- uid never went out, and the browser holds names only for the bodies near it (the roster), so a keeper offline or
-- across the island had no name to look up.
--
--   rpc_creatures      each tamed row says `keeperName`: its keeper as anybody else is named (`folk_name`: the
--                      account's name, else the body's). Your own as you are named, worked out once a read; anybody
--                      else's a row, and only for the rows the read sends (the delta's, not every creature in range).
--                      A wild one says none, a keeper left on its row or not.
--   perform_creature   Examine of a tamed one: "Owner: <name>." after its name and kind, as `examine_creature` in
--                      `src/game/creatureActions.ts` says it.
--
-- Deploy: the browser reads `keeperName` as optional. One that comes before this migration reads no name for anybody
-- else's and its own name for yours; one this migration reaches before the site does ignores the key.

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

-- The reader's own name, once a read.
select pg_temp.patch_fn('public.rpc_creatures(uuid,double precision,text,integer[],boolean)'::regprocedure,
  $o$        v_pack boolean := p_pack and (p_since is not null or p_have is not null);
$o$,
  $n$        v_pack boolean := p_pack and (p_since is not null or p_have is not null);
        -- The reader as anybody else names them (`folk_name`), for their own rows' `keeperName`.
        v_me_name text;
$n$);
select pg_temp.patch_fn('public.rpc_creatures(uuid,double precision,text,integer[],boolean)'::regprocedure,
  $o$  if not found then raise exception 'you are not on this island'; end if;
$o$,
  $n$  if not found then raise exception 'you are not on this island'; end if;
  v_me_name := coalesce(account_name(me), p.name);
$n$);
-- Each kept row: its keeper's name.
select pg_temp.patch_fn('public.rpc_creatures(uuid,double precision,text,integer[],boolean)'::regprocedure,
  $o$      || case when c.post is null then '{}'::jsonb else jsonb_build_object('post', c.post) end
$o$,
  $n$      || case when c.post is null then '{}'::jsonb else jsonb_build_object('post', c.post) end
      -- Whose it is, by name, to anybody: a wild one says none, whatever keeper it was let go by.
      || case when c.keeper is null or c.mode = 'wild' then '{}'::jsonb
              when c.keeper = me then jsonb_build_object('keeperName', v_me_name)
              else jsonb_build_object('keeperName', folk_name(p_world, c.keeper)) end
$n$);

-- Examine of a tamed one: its owner, after its name and kind.
select pg_temp.patch_fn('public.perform_creature(uuid,uuid,text,jsonb)'::regprocedure,
  $o$        || '): ' || case when d.description <> '' then d.description || ' ' else '' end || 'Level ' || creature_level(c.skills, c.species)$o$,
  $n$        || '): ' || case when c.keeper is not null then 'Owner: ' || folk_name(p_world, c.keeper) || '. ' else '' end
        || case when d.description <> '' then d.description || ' ' else '' end || 'Level ' || creature_level(c.skills, c.species)$n$);

select private.lock_doors();
