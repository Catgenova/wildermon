/*
 * A prune gives a log of the tree's kind, and a pruner carries it home.
 *
 * Asked for: "Implement that pruning a tree also gives 1 log of that type. Wildermon that prune bring that log to
 * settlement storage."
 *
 *   * `prune_logs`: logs a prune gives, of the tree's kind (the browser's `PRUNE_LOGS`); none off an age that fells for
 *     none, a sapling (`pruneLogs`);
 *   * `perform_ground`, 'prune': the log the way a felled tree's go, through `gather` -- a cart worked from, else the
 *     pack -- the same item and wood (`log`, the tree's name), at the prune's quality: forestry and the sickle;
 *   * `worker_do`, 'prune': the log in a pruner's arms, at a feller's quality, home to the settlement stores as every
 *     load is;
 *   * `load_trade`: pruning now brings a load home, so it carries its stage's loads a trip as felling does
 *     (`LOAD_TRADES`);
 *   * `tree_outlook`: Examine on a tree to prune says the log, "Prune to keep it alive: +1 log." (`treeOutlook`).
 */
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

-- Logs a prune gives, of the tree's kind (`PRUNE_LOGS`).
create or replace function prune_logs() returns int
language sql immutable as $$ select 1 $$;

select pg_temp.patch_fn('perform_ground(uuid, uuid, text, jsonb)',
  $o$    perform land_set_data(p_world, tx, ty, tree_pack(tree_species(v_data), v_to.id));
    perform land_announce(p_world, tx, ty);
    perform tell(p_world, p_uid, 'Pruned ' || lower(v_tree.name) || ': ' || lower(v_age.name)
      || ' to ' || lower(v_to.name) || '.', 'event');$o$,
  $n$    perform land_set_data(p_world, tx, ty, tree_pack(tree_species(v_data), v_to.id));
    perform land_announce(p_world, tx, ty);
    -- And a log of its kind, as felling gives one (`prune_logs`), none off a sapling (`pruneLogs`).
    v_n := least(prune_logs(), v_age.logs);
    v_ql := product_ql(v_skill, v_tool);
    if v_n > 0 then perform gather(p_world, p_uid, 'log', v_n, v_ql, v_tree.name); end if;
    perform tell(p_world, p_uid, 'Pruned ' || lower(v_tree.name) || ': ' || lower(v_age.name)
      || ' to ' || lower(v_to.name) || '.'
      || case when v_n > 0 then ' ' || v_n || case when v_n = 1 then ' log' else ' logs' end
                                || ', QL ' || to_char(v_ql, 'FM990.0') || '.' else '' end, 'event');$n$);

select pg_temp.patch_fn('worker_do(uuid, integer)',
  $o$    -- A stage back, as under a sickle: the age and nothing else. It carries
    -- nothing home.
    if here <> tile_id('Tree') then return null; end if;
    data := land_data(p_world, wx, wy);
    select * into v_age from tree_age_def where id = tree_age(data);
    if v_age.pruned is null then return null; end if;
    perform land_set_data(p_world, wx, wy, tree_pack(tree_species(data), v_age.pruned));
    perform land_announce(p_world, wx, wy);
    return null;$o$,
  $n$    -- A stage back, as under a sickle: the age, and a log of its kind home (`prune_logs`), as a player's prune gives.
    if here <> tile_id('Tree') then return null; end if;
    data := land_data(p_world, wx, wy);
    select * into tree from tree_def where id = tree_species(data);
    select * into v_age from tree_age_def where id = tree_age(data);
    if v_age.pruned is null then return null; end if;
    perform land_set_data(p_world, wx, wy, tree_pack(tree_species(data), v_age.pruned));
    perform land_announce(p_world, wx, wy);
    logs := least(prune_logs(), v_age.logs);
    if logs <= 0 then return null; end if;
    return jsonb_build_object('def', 'log', 'count', logs, 'ql', made_ql, 'extra', tree.name);$n$);

-- Pruning brings a load home now, so it carries its stage's loads a trip (`LOAD_TRADES`).
create or replace function load_trade(p_kind text) returns boolean
language sql immutable as $$
  select p_kind in ('forage', 'botanize', 'woodcut', 'farm', 'mine', 'sand', 'clay', 'quarry', 'fetch', 'peat', 'reed', 'fish',
                    'seek', 'fruit', 'bush', 'grass', 'pan', 'worm', 'sprout', 'resin', 'flower', 'compost', 'moss', 'prune',
                    'water', 'hod', 'stoke', 'plant', 'lamp', 'patch', 'fill', 'vine', 'lily')
$$;

select pg_temp.patch_fn('tree_outlook(uuid, tree_age_def)',
  $o$    v_out := v_out || ' Prune to keep it alive.';$o$,
  $n$    v_out := v_out || ' Prune to keep it alive: +' || least(prune_logs(), p_age.logs)
      || case when least(prune_logs(), p_age.logs) = 1 then ' log.' else ' logs.' end;$n$);

select private.lock_doors();
