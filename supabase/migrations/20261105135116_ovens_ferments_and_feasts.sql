-- An oven as a station of its own, ferments and ageings sealed and opened, and a dish served out to a group.
--
-- The mechanics the drop recipes need and nothing of the recipes themselves (`recipes.ts`, `ferment.ts`, `feast.ts`):
--
--   * `oven` (at_station): an oven alight within reach. A brazier is a hearth but bakes nothing; `campfire` still takes
--     any lit hearth, as it did.
--   * a ferment (`ferment_recipes`): a go uses its inputs, its vessel among them, and gives a Sealed vessel (`sealed_item`)
--     at the go's QL and rarity, its title in `extra`, ready at `charges` (world time). Before then `open_ferment` says
--     how long is left; after, it gives the recipe's result at the vessel's QL and the vessel back at `vessel_back_ql`.
--     One that wants a cellar is refused standing anywhere but under the ground (`ferment_cellar_says`).
--   * a dish for a group (`serve_dishes`): `serve_dish` uses it up and hands one share to each other player awake and
--     ashore in reach, nearest first, up to one fewer than its count, and the rest to the server.

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

/* ---- The oven ------------------------------------------------------------------------------------- */

select pg_temp.patch_fn('public.at_station(uuid,uuid,text)'::regprocedure,
  $o$    when 'smelter' then$o$,
  $n$    -- An oven, alight: no other hearth (`Game.litOvenNear`).
    when 'oven' then
      exists (select 1 from placed_near(p_world, p_uid, 'furniture', 'oven', 2.6) p where placed_lit(p))
    when 'smelter' then$n$);

/* ---- A ferment wanting a cellar ------------------------------------------------------------------- */

select pg_temp.patch_fn('public.craft_refusal(uuid,uuid,text,bigint)'::regprocedure,
  $o$    return 'Need: ' || station_name(r.station) || '.';
  end if;$o$,
  $n$    return 'Need: ' || station_name(r.station) || '.';
  end if;
  -- A ferment that wants a cellar, set going only under the ground (`fermentPlaceOk`).
  if exists (select 1 from ferment_recipes() f where f.id = p_recipe and f.cellar)
     and coalesce((select pl.level from player pl where pl.world_id = p_world and pl.uid = p_uid), 0) >= 0 then
    return ferment_cellar_says();
  end if;$n$);

/* ---- A ferment sealed ----------------------------------------------------------------------------- */

select pg_temp.patch_fn('public.perform_craft(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  if item_stackable(r.result) then
    v_made := give($o$,
  $n$  -- Set going rather than made: sealed in its vessel, to be opened when ready (`sealFerment`).
  if exists (select 1 from ferment_recipes() f where f.id = p_recipe) then
    if rare_input_said(v_used) is not null then perform tell(p_world, p_uid, rare_input_said(v_used), 'event'); end if;
    v_made := give(p_world, p_uid, sealed_item(), 1, made_ql, (select f.title from ferment_recipes() f where f.id = p_recipe), rare);
    update item set charges = ceil(world_time(p_world) + (select f.seconds from ferment_recipes() f where f.id = p_recipe))::int
     where id = v_made;
    perform skill_raise(p_world, p_uid, r.skill, 1);
    perform skill_raise(p_world, p_uid, 'mind_logic', try_gain(true, craft_head()));
    perform tell(p_world, p_uid, 'Sealed: ' || lower((select f.title from ferment_recipes() f where f.id = p_recipe))
      || '. Ready in ' || clock_left((select f.seconds from ferment_recipes() f where f.id = p_recipe)) || '.', 'event');
    return;
  end if;
  if item_stackable(r.result) then
    v_made := give($n$);

/* ---- Opening one, and serving a dish: relic uses ------------------------------------------------------ */

select pg_temp.patch_fn('public.relic_use_action(text)'::regprocedure,
  $o$'enchant_statue', 'read_recipe')$o$,
  $n$'enchant_statue', 'read_recipe', 'open_ferment', 'serve_dish')$n$);

select pg_temp.patch_fn('public.relic_use_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  if p_action = 'read_recipe' then$o$,
  $n$  if p_action = 'open_ferment' then
    -- A sealed vessel of a ferment, and its time come (`openFermentRefusal`).
    if v_it.def <> sealed_item() or not exists (select 1 from ferment_recipes() f where f.title = v_it.extra) then
      return 'It is gone.';
    end if;
    if coalesce(v_it.charges, 0) > world_time(p_world) then
      return 'Ready in ' || clock_left(v_it.charges - world_time(p_world)) || '.';
    end if;
    return null;
  end if;
  if p_action = 'serve_dish' then
    -- A dish for a group (`FEAST_ACTIONS`).
    if not exists (select 1 from serve_dishes() s where s.item = v_it.def) then return 'It is gone.'; end if;
    return null;
  end if;
  if p_action = 'read_recipe' then$n$);

select pg_temp.patch_fn('public.perform_relic_use(uuid,uuid,text,jsonb)'::regprocedure,
  $o$declare v_it item; v_stone item; v_recipe text;$o$,
  $n$declare v_it item; v_stone item; v_recipe text; v_ferment record; v_rc recipe; v_serve record; v_other record;
        v_shares int; v_me player;$n$);

select pg_temp.patch_fn('public.perform_relic_use(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  elsif p_action = 'read_recipe' then$o$,
  $n$  elsif p_action = 'open_ferment' then
    -- What it was set going to make, at its QL and rarity, and the vessel back (`FERMENT_ACTIONS`).
    select * into v_ferment from ferment_recipes() f where f.title = v_it.extra;
    select * into v_rc from recipe where id = v_ferment.id;
    if v_rc.id is null or not spend_stack(p_world, p_uid, v_it.id, 1) then return; end if;
    perform give(p_world, p_uid, v_rc.result, v_rc.count, v_it.ql, v_rc.extra, v_it.rare);
    perform give(p_world, p_uid, v_ferment.vessel, 1, vessel_back_ql());
    perform journal_made(p_world, p_uid, v_rc.result, v_it.ql, v_rc.count, v_it.rare);
    perform tell(p_world, p_uid, craft_made_said(v_rc.result, v_rc.count, null, v_it.ql, v_rc.done), 'event');

  elsif p_action = 'serve_dish' then
    -- One share to each other player awake and ashore in reach, nearest first, the rest to the server (`FEAST_ACTIONS`).
    select * into v_serve from serve_dishes() s where s.item = v_it.def;
    select * into v_me from player pl where pl.world_id = p_world and pl.uid = p_uid;
    if v_serve.item is null or not spend_stack(p_world, p_uid, v_it.id, 1) then return; end if;
    v_shares := 0;
    for v_other in
      select o.uid from player o
       where o.world_id = p_world and o.uid <> p_uid and not o.away
         and o.seen_at > now() - make_interval(secs => idle_logout())
         and sqrt((o.x - v_me.x) ^ 2 + (o.y - v_me.y) ^ 2) <= v_serve.reach
       order by sqrt((o.x - v_me.x) ^ 2 + (o.y - v_me.y) ^ 2)
       limit greatest(0, v_serve.count - 1)
    loop
      perform give(p_world, v_other.uid, v_serve.serving, 1, v_it.ql);
      perform tell(p_world, v_other.uid, 'Served to you: ' || lower((select d.name from item_def d where d.id = v_serve.serving))
        || ', by ' || v_me.name || '.', 'event');
      v_shares := v_shares + 1;
    end loop;
    perform give(p_world, p_uid, v_serve.serving, v_serve.count - v_shares, v_it.ql);
    perform tell(p_world, p_uid, 'Served: ' || lower((select d.name from item_def d where d.id = v_it.def))
      || '. Shares: ' || v_shares || ' to others, ' || (v_serve.count - v_shares) || ' to you.', 'event');

  elsif p_action = 'read_recipe' then$n$);

select private.lock_doors();
