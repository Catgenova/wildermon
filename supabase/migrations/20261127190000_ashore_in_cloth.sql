-- Ashore in cloth: a new body comes ashore the first time wearing a cloth tunic, trousers and shoes, at the kit's QL
-- (`starter_kit`, the first coming ashore only; the browser's `STARTER_WEAR`, game.ts), worn in its chest, legs and feet
-- slots (`player.equipped`). Not issued: worn, worn out and buried as any cloth is (and what is worn stays on the body
-- at a death, `bury`). Asked for: "new players should start with cloth chest, legs, boots equipped".

create or replace function pg_temp.patch_fn(p_sig regprocedure, p_old text, p_new text, p_times int default 1) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_times then
    raise exception '% has % of the lines to change, not %', p_sig, v_n, p_times;
  end if;
  execute replace(v_def, p_old, p_new);
end $p$;

select pg_temp.patch_fn('public.starter_kit(uuid, uuid)'::regprocedure,
  $o$  values (p_world, 'player', p_uid, 'cheese', 20, 5);$o$,
  $n$  values (p_world, 'player', p_uid, 'cheese', 20, 5);
  -- And dressed, the first time only: cloth over chest, legs and feet, worn (`STARTER_WEAR`).
  declare v_tunic bigint; v_trousers bigint; v_shoes bigint;
  begin
    insert into item (world_id, holder, holder_uid, def, ql) values (p_world, 'player', p_uid, 'cloth_tunic', 20) returning id into v_tunic;
    insert into item (world_id, holder, holder_uid, def, ql) values (p_world, 'player', p_uid, 'cloth_trousers', 20) returning id into v_trousers;
    insert into item (world_id, holder, holder_uid, def, ql) values (p_world, 'player', p_uid, 'cloth_shoes', 20) returning id into v_shoes;
    update player set equipped = coalesce(equipped, '{}'::jsonb)
        || jsonb_build_object('chest', v_tunic, 'legs', v_trousers, 'feet', v_shoes)
     where world_id = p_world and uid = p_uid;
  end;$n$);

select private.lock_doors();
