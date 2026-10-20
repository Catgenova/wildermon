-- The island's messages and refusals for digging, mining, felling, building, travel, fighting and the
-- rest say the mechanic and stop: the same words as the browser's.
--
-- Asked for: "Review all game text for cryptic AI talk. We dont need 'a boat under oars'. Just say 'boat
-- row speed'. We want no prose." So "You dig up some dirt. (QL 23.4)" is "Dug: dirt, QL 23.4.", "You need
-- a shovel to dig." is "Need a shovel.", and every number a line gave is still in it. Text only: no rule,
-- number or order of anything changes.
--
-- Each function is patched in place (`pg_get_functiondef` and `replace`), every anchor asserted to occur
-- exactly as often as it did when this was written, so a function somebody else changed meanwhile fails
-- loudly here rather than quietly keeping its old words.

set local lock_timeout = '3s';

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('tree_outlook(uuid,tree_age_def)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$' It is clipped, and will stay as it is.'$tx6o$, ''))) / length($tx6o$' It is clipped, and will stay as it is.'$tx6o$);
  if n <> 1 then raise exception 'tree_outlook: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$' It is clipped, and will stay as it is.'$tx6o$, $tx6n$' Clipped: does not age.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$' Fell it for what timber is in it before then.'$tx6o$, ''))) / length($tx6o$' Fell it for what timber is in it before then.'$tx6o$);
  if n <> 1 then raise exception 'tree_outlook: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$' Fell it for what timber is in it before then.'$tx6o$, $tx6n$' Fell it before then for its logs.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$' Prune it to keep it.'$tx6o$, ''))) / length($tx6o$' Prune it to keep it.'$tx6o$);
  if n <> 1 then raise exception 'tree_outlook: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$' Prune it to keep it.'$tx6o$, $tx6n$' Prune to keep it alive.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_then := 'it will be gone';$tx6o$, ''))) / length($tx6o$v_then := 'it will be gone';$tx6o$);
  if n <> 1 then raise exception 'tree_outlook: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_then := 'it will be gone';$tx6o$, $tx6n$v_then := 'gone';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_then := 'it will be ' || lower(v_next.name);$tx6o$, ''))) / length($tx6o$v_then := 'it will be ' || lower(v_next.name);$tx6o$);
  if n <> 1 then raise exception 'tree_outlook: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_then := 'it will be ' || lower(v_next.name);$tx6o$, $tx6n$v_then := lower(v_next.name);$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_out := ' The woods turn over ' || v_when || ', and ' || v_then || '.';$tx6o$, ''))) / length($tx6o$v_out := ' The woods turn over ' || v_when || ', and ' || v_then || '.';$tx6o$);
  if n <> 1 then raise exception 'tree_outlook: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_out := ' The woods turn over ' || v_when || ', and ' || v_then || '.';$tx6o$, $tx6n$v_out := ' Next stage ' || v_when || ': ' || v_then || '.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('ground_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'The ground has to be packed flat before anything is laid on it.'$tx6o$, ''))) / length($tx6o$'The ground has to be packed flat before anything is laid on it.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The ground has to be packed flat before anything is laid on it.'$tx6o$, $tx6n$'Need packed dirt.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need a shovel.'$tx6o$, ''))) / length($tx6o$'You need a shovel.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need a shovel.'$tx6o$, $tx6n$'Need a shovel.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The water is too deep here to work in.'$tx6o$, ''))) / length($tx6o$'The water is too deep here to work in.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The water is too deep here to work in.'$tx6o$, $tx6n$'Water too deep.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need a shovel to dredge with.'$tx6o$, ''))) / length($tx6o$'You need a shovel to dredge with.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need a shovel to dredge with.'$tx6o$, $tx6n$'Need a shovel.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Dredging is done from a boat.'$tx6o$, ''))) / length($tx6o$'Dredging is done from a boat.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Dredging is done from a boat.'$tx6o$, $tx6n$'Must be in a boat.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That corner is above the water. Dig it from the shore.'$tx6o$, ''))) / length($tx6o$'That corner is above the water. Dig it from the shore.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That corner is above the water. Dig it from the shore.'$tx6o$, $tx6n$'Corner above water: dig it instead.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The bottom is too deep to reach from a boat.'$tx6o$, ''))) / length($tx6o$'The bottom is too deep to reach from a boat.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The bottom is too deep to reach from a boat.'$tx6o$, $tx6n$'Bottom too deep.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That corner is bare rock down there. A shovel will not bite on it.'$tx6o$, ''))) / length($tx6o$'That corner is bare rock down there. A shovel will not bite on it.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That corner is bare rock down there. A shovel will not bite on it.'$tx6o$, $tx6n$'Corner is bare rock.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need a shovel to flatten.'$tx6o$, ''))) / length($tx6o$'You need a shovel to flatten.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need a shovel to flatten.'$tx6o$, $tx6n$'Need a shovel.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The ground you stand on is too deep to work from.'$tx6o$, ''))) / length($tx6o$'The ground you stand on is too deep to work from.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The ground you stand on is too deep to work from.'$tx6o$, $tx6n$'Your tile is too deep under water.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That is not dirt, clay or sand.'$tx6o$, ''))) / length($tx6o$'That is not dirt, clay or sand.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is not dirt, clay or sand.'$tx6o$, $tx6n$'Not dirt, clay or sand.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You have no dirt, clay or sand to drop, and nothing beside you is holding any.'$tx6o$, ''))) / length($tx6o$'You have no dirt, clay or sand to drop, and nothing beside you is holding any.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You have no dirt, clay or sand to drop, and nothing beside you is holding any.'$tx6o$, $tx6n$'Need dirt, clay or sand, in the pack or a container beside you.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That wants a Mason who has learned to fill with rubble.'$tx6o$, ''))) / length($tx6o$'That wants a Mason who has learned to fill with rubble.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That wants a Mason who has learned to fill with rubble.'$tx6o$, $tx6n$'Needs perk: Rubble Fill (Mason).'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You have no concrete.'$tx6o$, ''))) / length($tx6o$'You have no concrete.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You have no concrete.'$tx6o$, $tx6n$'Need concrete.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need a pickaxe to prospect.'$tx6o$, ''))) / length($tx6o$'You need a pickaxe to prospect.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need a pickaxe to prospect.'$tx6o$, $tx6n$'Need a pickaxe.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no stump here.'$tx6o$, ''))) / length($tx6o$'There is no stump here.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no stump here.'$tx6o$, $tx6n$'No stump here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no tree here.'$tx6o$, ''))) / length($tx6o$'There is no tree here.'$tx6o$);
  if n <> 2 then raise exception 'ground_refusal: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'There is no tree here.'$tx6o$, $tx6n$'No tree here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no life in it to sprout.'$tx6o$, ''))) / length($tx6o$'There is no life in it to sprout.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no life in it to sprout.'$tx6o$, $tx6n$'Tree is dead.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no tree here to prune.'$tx6o$, ''))) / length($tx6o$'There is no tree here to prune.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no tree here to prune.'$tx6o$, $tx6n$'No tree here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no pruning a dead tree.'$tx6o$, ''))) / length($tx6o$'There is no pruning a dead tree.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no pruning a dead tree.'$tx6o$, $tx6n$'Tree is dead.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It is clipped as far as it goes.'$tx6o$, ''))) / length($tx6o$'It is clipped as far as it goes.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is clipped as far as it goes.'$tx6o$, $tx6n$'Already clipped.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no bush here.'$tx6o$, ''))) / length($tx6o$'There is no bush here.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no bush here.'$tx6o$, $tx6n$'No bush here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Nothing grows on this that you would eat.'$tx6o$, ''))) / length($tx6o$'Nothing grows on this that you would eat.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing grows on this that you would eat.'$tx6o$, $tx6n$'Bears no fruit.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Nothing hangs on a dead tree.'$tx6o$, ''))) / length($tx6o$'Nothing hangs on a dead tree.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing hangs on a dead tree.'$tx6o$, $tx6n$'Tree is dead.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You have no sprout to plant.'$tx6o$, ''))) / length($tx6o$'You have no sprout to plant.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You have no sprout to plant.'$tx6o$, $tx6n$'Need a sprout.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You would be planting it under your own feet. Step off the tile first.'$tx6o$, ''))) / length($tx6o$'You would be planting it under your own feet. Step off the tile first.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You would be planting it under your own feet. Step off the tile first.'$tx6o$, $tx6n$'Step off the tile first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no tree here to graft to.'$tx6o$, ''))) / length($tx6o$'There is no tree here to graft to.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no tree here to graft to.'$tx6o$, $tx6n$'No tree here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no life in it to graft to.'$tx6o$, ''))) / length($tx6o$'There is no life in it to graft to.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no life in it to graft to.'$tx6o$, $tx6n$'Tree is dead.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It bears already.'$tx6o$, ''))) / length($tx6o$'It bears already.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It bears already.'$tx6o$, $tx6n$'Already bears fruit.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That is not a fruit sprout.'$tx6o$, ''))) / length($tx6o$'That is not a fruit sprout.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is not a fruit sprout.'$tx6o$, $tx6n$'Not a fruit sprout.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You have no fruit sprout to graft.'$tx6o$, ''))) / length($tx6o$'You have no fruit sprout to graft.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You have no fruit sprout to graft.'$tx6o$, $tx6n$'Need a fruit sprout.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You need ' || number_word(pk(p_world, p_uid, 'rubble', 0)::int) || ' rock shards.';$tx6o$, ''))) / length($tx6o$return 'You need ' || number_word(pk(p_world, p_uid, 'rubble', 0)::int) || ' rock shards.';$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You need ' || number_word(pk(p_world, p_uid, 'rubble', 0)::int) || ' rock shards.';$tx6o$, $tx6n$return 'Need ' || pk(p_world, p_uid, 'rubble', 0)::int || ' rock shards.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The ' || lower(v_tree.name) || ' is too young to prune. Let it grow.';$tx6o$, ''))) / length($tx6o$return 'The ' || lower(v_tree.name) || ' is too young to prune. Let it grow.';$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The ' || lower(v_tree.name) || ' is too young to prune. Let it grow.';$tx6o$, $tx6n$return v_tree.name || ': too young to prune.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'Nothing on a ' || lower((select name from bush_def where id = bush_species(v_data))) || ' is worth a sickle.';$tx6o$, ''))) / length($tx6o$return 'Nothing on a ' || lower((select name from bush_def where id = bush_species(v_data))) || ' is worth a sickle.';$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'Nothing on a ' || lower((select name from bush_def where id = bush_species(v_data))) || ' is worth a sickle.';$tx6o$, $tx6n$return (select name from bush_def where id = bush_species(v_data)) || ': nothing to harvest.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You have had what this ' || lower(v_tree.name) || ' has on it. Come back later.';$tx6o$, ''))) / length($tx6o$return 'You have had what this ' || lower(v_tree.name) || ' has on it. Come back later.';$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You have had what this ' || lower(v_tree.name) || ' has on it. Come back later.';$tx6o$, $tx6n$return v_tree.name || ': already picked. Try later.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The ' || lower(v_tree.name) || ' is too young to bear. Leave it to grow.';$tx6o$, ''))) / length($tx6o$return 'The ' || lower(v_tree.name) || ' is too young to bear. Leave it to grow.';$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The ' || lower(v_tree.name) || ' is too young to bear. Leave it to grow.';$tx6o$, $tx6n$return v_tree.name || ': too young to bear.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You do not know enough of trees to graft one yet. It takes forestry ' || graft_skill() || '.';$tx6o$, ''))) / length($tx6o$return 'You do not know enough of trees to graft one yet. It takes forestry ' || graft_skill() || '.';$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You do not know enough of trees to graft one yet. It takes forestry ' || graft_skill() || '.';$tx6o$, $tx6n$return 'Needs forestry ' || graft_skill() || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You have had what this ' || lower((select name from bush_def where id = bush_species(v_data))) || ' has on it. Come back later.';$tx6o$, ''))) / length($tx6o$return 'You have had what this ' || lower((select name from bush_def where id = bush_species(v_data))) || ' has on it. Come back later.';$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You have had what this ' || lower((select name from bush_def where id = bush_species(v_data))) || ' has on it. Come back later.';$tx6o$, $tx6n$return (select name from bush_def where id = bush_species(v_data)) || ': already picked. Try later.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That wants a Forester who has learned to coppice.'$tx6o$, ''))) / length($tx6o$'That wants a Forester who has learned to coppice.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That wants a Forester who has learned to coppice.'$tx6o$, $tx6n$'Needs perk: Coppice (Forester).'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no tree here to coppice.'$tx6o$, ''))) / length($tx6o$'There is no tree here to coppice.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no tree here to coppice.'$tx6o$, $tx6n$'No tree here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no coppicing a dead tree.'$tx6o$, ''))) / length($tx6o$'There is no coppicing a dead tree.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no coppicing a dead tree.'$tx6o$, $tx6n$'Tree is dead.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That wants a Forester who has learned to tap resin.'$tx6o$, ''))) / length($tx6o$'That wants a Forester who has learned to tap resin.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That wants a Forester who has learned to tap resin.'$tx6o$, $tx6n$'Needs perk: Tap Resin (Forester).'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no tree here to tap.'$tx6o$, ''))) / length($tx6o$'There is no tree here to tap.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no tree here to tap.'$tx6o$, $tx6n$'No tree here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That wants a Forester who has learned to clear brush.'$tx6o$, ''))) / length($tx6o$'That wants a Forester who has learned to clear brush.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That wants a Forester who has learned to clear brush.'$tx6o$, $tx6n$'Needs perk: Clear Brush (Forester).'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no brush here to clear.'$tx6o$, ''))) / length($tx6o$'There is no brush here to clear.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no brush here to clear.'$tx6o$, $tx6n$'No brush here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need a trowel to bed a slab.'$tx6o$, ''))) / length($tx6o$'You need a trowel to bed a slab.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need a trowel to bed a slab.'$tx6o$, $tx6n$'Need a trowel.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need a cut slab to pave with.'$tx6o$, ''))) / length($tx6o$'You need a cut slab to pave with.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need a cut slab to pave with.'$tx6o$, $tx6n$'Need a cut slab.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need a pickaxe to break up paving.'$tx6o$, ''))) / length($tx6o$'You need a pickaxe to break up paving.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need a pickaxe to break up paving.'$tx6o$, $tx6n$'Need a pickaxe.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The ' || lower(v_tree.name) || ' is too young to coppice. Let it grow.';$tx6o$, ''))) / length($tx6o$return 'The ' || lower(v_tree.name) || ' is too young to coppice. Let it grow.';$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The ' || lower(v_tree.name) || ' is too young to coppice. Let it grow.';$tx6o$, $tx6n$return v_tree.name || ': too young to coppice.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then return 'Only a ' || lower(v_tree.name) || ' gives resin.'; end if;$tx6o$, ''))) / length($tx6o$then return 'Only a ' || lower(v_tree.name) || ' gives resin.'; end if;$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then return 'Only a ' || lower(v_tree.name) || ' gives resin.'; end if;$tx6o$, $tx6n$then return 'Only a ' || lower(v_tree.name) || '.'; end if;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'A dead ' || lower(v_tree.name) || ' gives no resin.';$tx6o$, ''))) / length($tx6o$return 'A dead ' || lower(v_tree.name) || ' gives no resin.';$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'A dead ' || lower(v_tree.name) || ' gives no resin.';$tx6o$, $tx6n$return 'Tree is dead.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The ' || lower(v_tree.name) || ' is too small to tap. Let it grow.';$tx6o$, ''))) / length($tx6o$return 'The ' || lower(v_tree.name) || ' is too small to tap. Let it grow.';$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The ' || lower(v_tree.name) || ' is too small to tap. Let it grow.';$tx6o$, $tx6n$return v_tree.name || ': too young to tap.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'This ' || lower(v_tree.name) || ' has given its resin today. It runs again at dawn.';$tx6o$, ''))) / length($tx6o$return 'This ' || lower(v_tree.name) || ' has given its resin today. It runs again at dawn.';$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'This ' || lower(v_tree.name) || ' has given its resin today. It runs again at dawn.';$tx6o$, $tx6n$return 'Tapped today. Again at dawn.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The grass here is still short.'$tx6o$, ''))) / length($tx6o$'The grass here is still short.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The grass here is still short.'$tx6o$, $tx6n$'Grass too short. Try later.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The moss here is still short.'$tx6o$, ''))) / length($tx6o$'The moss here is still short.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The moss here is still short.'$tx6o$, $tx6n$'Moss too short. Try later.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need a knife to cut reeds.'$tx6o$, ''))) / length($tx6o$'You need a knife to cut reeds.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need a knife to cut reeds.'$tx6o$, $tx6n$'Need a carving knife.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The reeds here are cut back to the water.'$tx6o$, ''))) / length($tx6o$'The reeds here are cut back to the water.'$tx6o$);
  if n <> 1 then raise exception 'ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The reeds here are cut back to the water.'$tx6o$, $tx6n$'Reeds already cut. Try later.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('steps_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'The ground has to be packed flat before anything is laid on it.'$tx6o$, ''))) / length($tx6o$'The ground has to be packed flat before anything is laid on it.'$tx6o$);
  if n <> 1 then raise exception 'steps_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The ground has to be packed flat before anything is laid on it.'$tx6o$, $tx6n$'Need packed dirt.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There are no steps here.'$tx6o$, ''))) / length($tx6o$'There are no steps here.'$tx6o$);
  if n <> 1 then raise exception 'steps_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There are no steps here.'$tx6o$, $tx6n$'No steps here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'A flight of stone steps takes ' || number_word(steps_slabs()::int) || ' cut slabs of one stone, '
        || number_word(steps_bricks()::int) || ' bricks of the same stone and ' || number_word(steps_mortar()::int) || ' mortar.';$tx6o$, ''))) / length($tx6o$return 'A flight of stone steps takes ' || number_word(steps_slabs()::int) || ' cut slabs of one stone, '
        || number_word(steps_bricks()::int) || ' bricks of the same stone and ' || number_word(steps_mortar()::int) || ' mortar.';$tx6o$);
  if n <> 1 then raise exception 'steps_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'A flight of stone steps takes ' || number_word(steps_slabs()::int) || ' cut slabs of one stone, '
        || number_word(steps_bricks()::int) || ' bricks of the same stone and ' || number_word(steps_mortar()::int) || ' mortar.';$tx6o$, $tx6n$return 'Need ' || steps_slabs()::int || ' cut slabs of one stone, '
        || steps_bricks()::int || ' bricks of the same stone and ' || steps_mortar()::int || ' mortar.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'A flight of timber steps takes ' || number_word(steps_planks()::int) || ' planks of one wood and '
        || number_word(steps_nails()::int) || ' nails.';$tx6o$, ''))) / length($tx6o$return 'A flight of timber steps takes ' || number_word(steps_planks()::int) || ' planks of one wood and '
        || number_word(steps_nails()::int) || ' nails.';$tx6o$);
  if n <> 1 then raise exception 'steps_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'A flight of timber steps takes ' || number_word(steps_planks()::int) || ' planks of one wood and '
        || number_word(steps_nails()::int) || ' nails.';$tx6o$, $tx6n$return 'Need ' || steps_planks()::int || ' planks of one wood and '
        || steps_nails()::int || ' nails.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('corner_under_building(uuid,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'There is a cellar dug out under that ground. The ground over a cellar is not dug, raised or levelled while the cellar is there.'$tx6o$, ''))) / length($tx6o$'There is a cellar dug out under that ground. The ground over a cellar is not dug, raised or levelled while the cellar is there.'$tx6o$);
  if n <> 1 then raise exception 'corner_under_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is a cellar dug out under that ground. The ground over a cellar is not dug, raised or levelled while the cellar is there.'$tx6o$, $tx6n$'Cellar under this ground: no digging, raising or levelling over it.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You cannot dig under a building.'$tx6o$, ''))) / length($tx6o$'You cannot dig under a building.'$tx6o$);
  if n <> 1 then raise exception 'corner_under_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You cannot dig under a building.'$tx6o$, $tx6n$'Not under a building.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('under_building(uuid,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'There is a cellar dug out under that ground. The ground over a cellar is not dug, raised or levelled while the cellar is there.'$tx6o$, ''))) / length($tx6o$'There is a cellar dug out under that ground. The ground over a cellar is not dug, raised or levelled while the cellar is there.'$tx6o$);
  if n <> 1 then raise exception 'under_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is a cellar dug out under that ground. The ground over a cellar is not dug, raised or levelled while the cellar is there.'$tx6o$, $tx6n$'Cellar under this ground: no digging, raising or levelling over it.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You cannot do that inside a building.'$tx6o$, ''))) / length($tx6o$'You cannot do that inside a building.'$tx6o$);
  if n <> 1 then raise exception 'under_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You cannot do that inside a building.'$tx6o$, $tx6n$'Not inside a building.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('spring_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You cannot do that inside a building.'$tx6o$, ''))) / length($tx6o$'You cannot do that inside a building.'$tx6o$);
  if n <> 1 then raise exception 'spring_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You cannot do that inside a building.'$tx6o$, $tx6n$'Not inside a building.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Dig a pool in the foundation first: a spring under a slab has nowhere to rise.'$tx6o$, ''))) / length($tx6o$'Dig a pool in the foundation first: a spring under a slab has nowhere to rise.'$tx6o$);
  if n <> 1 then raise exception 'spring_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Dig a pool in the foundation first: a spring under a slab has nowhere to rise.'$tx6o$, $tx6n$'Dig a pool in the foundation first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is water here already.'$tx6o$, ''))) / length($tx6o$'There is water here already.'$tx6o$);
  if n <> 1 then raise exception 'spring_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is water here already.'$tx6o$, $tx6n$'Already water here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A spring rises in this pool already.'$tx6o$, ''))) / length($tx6o$'A spring rises in this pool already.'$tx6o$);
  if n <> 1 then raise exception 'spring_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A spring rises in this pool already.'$tx6o$, $tx6n$'Pool already has a spring.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no spring here.'$tx6o$, ''))) / length($tx6o$'There is no spring here.'$tx6o$);
  if n <> 1 then raise exception 'spring_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no spring here.'$tx6o$, $tx6n$'No spring here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You need a shovel to ' || case when p_action = 'dig_spring' then 'dig for a spring' else 'stop up a spring' end || '.';$tx6o$, ''))) / length($tx6o$return 'You need a shovel to ' || case when p_action = 'dig_spring' then 'dig for a spring' else 'stop up a spring' end || '.';$tx6o$);
  if n <> 1 then raise exception 'spring_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You need a shovel to ' || case when p_action = 'dig_spring' then 'dig for a spring' else 'stop up a spring' end || '.';$tx6o$, $tx6n$return 'Need a shovel.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You keep ' || springs_each() || ' springs already. Stop one up before you dig another.';$tx6o$, ''))) / length($tx6o$return 'You keep ' || springs_each() || ' springs already. Stop one up before you dig another.';$tx6o$);
  if n <> 1 then raise exception 'spring_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You keep ' || springs_each() || ' springs already. Stop one up before you dig another.';$tx6o$, $tx6n$return 'Max ' || springs_each() || ' springs: stop one up first.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'Water here would run straight off downhill. Dig a spring at the bottom of a hollow that holds '$tx6o$, ''))) / length($tx6o$return 'Water here would run straight off downhill. Dig a spring at the bottom of a hollow that holds '$tx6o$);
  if n <> 1 then raise exception 'spring_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'Water here would run straight off downhill. Dig a spring at the bottom of a hollow that holds '$tx6o$, $tx6n$return 'Water would run off downhill: dig in a hollow holding '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'This hollow is too wide for a spring ever to fill: a pond spreads over ' || pond_most() || ' corners at most.';$tx6o$, ''))) / length($tx6o$return 'This hollow is too wide for a spring ever to fill: a pond spreads over ' || pond_most() || ' corners at most.';$tx6o$);
  if n <> 1 then raise exception 'spring_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'This hollow is too wide for a spring ever to fill: a pond spreads over ' || pond_most() || ' corners at most.';$tx6o$, $tx6n$return 'Hollow too wide: a pond covers ' || pond_most() || ' corners at most.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'Only whoever dug this spring may stop it up.';$tx6o$, ''))) / length($tx6o$return 'Only whoever dug this spring may stop it up.';$tx6o$);
  if n <> 1 then raise exception 'spring_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'Only whoever dug this spring may stop it up.';$tx6o$, $tx6n$return 'Only its digger, or builders of this settlement, may stop it up.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('level_stop(uuid,uuid,integer,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$return 'That corner is down to the level of ' || v_level || ' already.';$tx6o$, ''))) / length($tx6o$return 'That corner is down to the level of ' || v_level || ' already.';$tx6o$);
  if n <> 1 then raise exception 'level_stop: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'That corner is down to the level of ' || v_level || ' already.';$tx6o$, $tx6n$return 'Corner already at level ' || v_level || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'That corner is up to the level of ' || v_level || ' already.';$tx6o$, ''))) / length($tx6o$return 'That corner is up to the level of ' || v_level || ' already.';$tx6o$);
  if n <> 1 then raise exception 'level_stop: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'That corner is up to the level of ' || v_level || ' already.';$tx6o$, $tx6n$return 'Corner already at level ' || v_level || '.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('rock_raise_refusal(uuid,uuid,integer,integer,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$return 'There is soil on that corner. ' || p_what || ' goes on bare rock.';$tx6o$, ''))) / length($tx6o$return 'There is soil on that corner. ' || p_what || ' goes on bare rock.';$tx6o$);
  if n <> 1 then raise exception 'rock_raise_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'There is soil on that corner. ' || p_what || ' goes on bare rock.';$tx6o$, $tx6n$return 'Soil on that corner. ' || p_what || ' needs bare rock.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$p_what || ' will not set under more than ' || v_deep || ' of water.'$tx6o$, ''))) / length($tx6o$p_what || ' will not set under more than ' || v_deep || ' of water.'$tx6o$);
  if n <> 1 then raise exception 'rock_raise_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$p_what || ' will not set under more than ' || v_deep || ' of water.'$tx6o$, $tx6n$p_what || ': not under more than ' || v_deep || ' of water.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$else p_what || ' will not set under water.' end;$tx6o$, ''))) / length($tx6o$else p_what || ' will not set under water.' end;$tx6o$);
  if n <> 1 then raise exception 'rock_raise_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$else p_what || ' will not set under water.' end;$tx6o$, $tx6n$else p_what || ': not under water.' end;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'That corner is on a seam. ' || p_what || ' goes on plain rock.';$tx6o$, ''))) / length($tx6o$return 'That corner is on a seam. ' || p_what || ' goes on plain rock.';$tx6o$);
  if n <> 1 then raise exception 'rock_raise_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'That corner is on a seam. ' || p_what || ' goes on plain rock.';$tx6o$, $tx6n$return 'Corner on a seam. ' || p_what || ' needs plain rock.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('slope_refusal(uuid,uuid,text,integer,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$return 'That would leave a slope of ' || v_would || '. Your ' || p_skill || ' allows ' || v_cap$tx6o$, ''))) / length($tx6o$return 'That would leave a slope of ' || v_would || '. Your ' || p_skill || ' allows ' || v_cap$tx6o$);
  if n <> 1 then raise exception 'slope_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'That would leave a slope of ' || v_would || '. Your ' || p_skill || ' allows ' || v_cap$tx6o$, $tx6n$return 'Slope would be ' || v_would || '; ' || p_skill || ' allows ' || v_cap$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$|| '; it would take ' || p_skill || ' ' || to_char($tx6o$, ''))) / length($tx6o$|| '; it would take ' || p_skill || ' ' || to_char($tx6o$);
  if n <> 1 then raise exception 'slope_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$|| '; it would take ' || p_skill || ' ' || to_char($tx6o$, $tx6n$|| ', needs ' || p_skill || ' ' || to_char($tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('settlement_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Only whoever founded ' || dd.name || ' may disband it.'$tx6o$, ''))) / length($tx6o$'Only whoever founded ' || dd.name || ' may disband it.'$tx6o$);
  if n <> 1 then raise exception 'settlement_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Only whoever founded ' || dd.name || ' may disband it.'$tx6o$, $tx6n$'Only the founder of ' || dd.name || ' may disband it.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You have no settlement.'$tx6o$, ''))) / length($tx6o$'You have no settlement.'$tx6o$);
  if n <> 1 then raise exception 'settlement_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You have no settlement.'$tx6o$, $tx6n$'No settlement.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You have no work post to drive in.'$tx6o$, ''))) / length($tx6o$'You have no work post to drive in.'$tx6o$);
  if n <> 1 then raise exception 'settlement_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You have no work post to drive in.'$tx6o$, $tx6n$'Need a work post.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('ground_deed_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$return 'That ground is part of ' || v_name || '. Only its citizens may shape it.';$tx6o$, ''))) / length($tx6o$return 'That ground is part of ' || v_name || '. Only its citizens may shape it.';$tx6o$);
  if n <> 1 then raise exception 'ground_deed_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'That ground is part of ' || v_name || '. Only its citizens may shape it.';$tx6o$, $tx6n$return 'Part of ' || v_name || ': citizens only.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('item_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'That wants a Tailor who has learned to patch.'$tx6o$, ''))) / length($tx6o$'That wants a Tailor who has learned to patch.'$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That wants a Tailor who has learned to patch.'$tx6o$, $tx6n$'Needs perk: Patch (Tailor).'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That wants an Artisan who has learned to glaze.'$tx6o$, ''))) / length($tx6o$'That wants an Artisan who has learned to glaze.'$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That wants an Artisan who has learned to glaze.'$tx6o$, $tx6n$'Needs perk: Glaze (Artisan).'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is nothing wrong with it.'$tx6o$, ''))) / length($tx6o$'There is nothing wrong with it.'$tx6o$);
  if n <> 3 then raise exception 'item_refusal: % of an anchor, not 3', n; end if;
  v := replace(v, $tx6o$'There is nothing wrong with it.'$tx6o$, $tx6n$'Not damaged.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Only cloth or leather takes a patch.'$tx6o$, ''))) / length($tx6o$'Only cloth or leather takes a patch.'$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Only cloth or leather takes a patch.'$tx6o$, $tx6n$'Cloth or leather only.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A kit does not mend itself.'$tx6o$, ''))) / length($tx6o$'A kit does not mend itself.'$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A kit does not mend itself.'$tx6o$, $tx6n$'Not on a repair kit.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You have no repair kit.'$tx6o$, ''))) / length($tx6o$'You have no repair kit.'$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You have no repair kit.'$tx6o$, $tx6n$'Need a repair kit.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Sealant does not seal itself.'$tx6o$, ''))) / length($tx6o$'Sealant does not seal itself.'$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Sealant does not seal itself.'$tx6o$, $tx6n$'Not on sealant.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It is sealed already.'$tx6o$, ''))) / length($tx6o$'It is sealed already.'$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is sealed already.'$tx6o$, $tx6n$'Already sealed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Only a stone goes in a circlet.'$tx6o$, ''))) / length($tx6o$'Only a stone goes in a circlet.'$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Only a stone goes in a circlet.'$tx6o$, $tx6n$'Gems only.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need a file.'$tx6o$, ''))) / length($tx6o$'You need a file.'$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need a file.'$tx6o$, $tx6n$'Need a file.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Only a fired pot, bowl or jar, or an amphora, takes a glaze.'$tx6o$, ''))) / length($tx6o$'Only a fired pot, bowl or jar, or an amphora, takes a glaze.'$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Only a fired pot, bowl or jar, or an amphora, takes a glaze.'$tx6o$, $tx6n$'Fired pot, bowl, jar or amphora only.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It is glazed already.'$tx6o$, ''))) / length($tx6o$'It is glazed already.'$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is glazed already.'$tx6o$, $tx6n$'Already glazed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then return 'It is worn away to nothing and will not take another repair.'; end if;$tx6o$, ''))) / length($tx6o$then return 'It is worn away to nothing and will not take another repair.'; end if;$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then return 'It is worn away to nothing and will not take another repair.'; end if;$tx6o$, $tx6n$then return 'QL at 1: cannot repair.'; end if;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You need ' || patch_with(v_it.def) || ' to patch it with.';$tx6o$, ''))) / length($tx6o$return 'You need ' || patch_with(v_it.def) || ' to patch it with.';$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You need ' || patch_with(v_it.def) || ' to patch it with.';$tx6o$, $tx6n$return 'Need ' || patch_with(v_it.def) || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You need ' || v_it.count || ' sealant to seal all ' || v_it.count || ' of them; you have '$tx6o$, ''))) / length($tx6o$return 'You need ' || v_it.count || ' sealant to seal all ' || v_it.count || ' of them; you have '$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You need ' || v_it.count || ' sealant to seal all ' || v_it.count || ' of them; you have '$tx6o$, $tx6n$return 'Need ' || v_it.count || ' sealant; have '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You have no circlet with a setting empty: each takes ' || circlet_stones() || ' stones.';$tx6o$, ''))) / length($tx6o$return 'You have no circlet with a setting empty: each takes ' || circlet_stones() || ' stones.';$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You have no circlet with a setting empty: each takes ' || circlet_stones() || ' stones.';$tx6o$, $tx6n$return 'Need a circlet with an empty setting (' || circlet_stones() || ' per circlet).';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then return 'You need ashes to make a glaze of.'; end if;$tx6o$, ''))) / length($tx6o$then return 'You need ashes to make a glaze of.'; end if;$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then return 'You need ashes to make a glaze of.'; end if;$tx6o$, $tx6n$then return 'Need ' || glaze_ash() || ' ash.'; end if;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That is not something you can better.'$tx6o$, ''))) / length($tx6o$'That is not something you can better.'$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is not something you can better.'$tx6o$, $tx6n$'Cannot be improved.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That came ashore with you. There is nothing in it to better — make one of your own.'$tx6o$, ''))) / length($tx6o$'That came ashore with you. There is nothing in it to better — make one of your own.'$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That came ashore with you. There is nothing in it to better — make one of your own.'$tx6o$, $tx6n$'Starting kit cannot be improved: make your own.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It cannot be bettered.'$tx6o$, ''))) / length($tx6o$'It cannot be bettered.'$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It cannot be bettered.'$tx6o$, $tx6n$'Max QL.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no quench left in it.'$tx6o$, ''))) / length($tx6o$'There is no quench left in it.'$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no quench left in it.'$tx6o$, $tx6n$'Already quenched.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That wants a Smith who has learned to temper.'$tx6o$, ''))) / length($tx6o$'That wants a Smith who has learned to temper.'$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That wants a Smith who has learned to temper.'$tx6o$, $tx6n$'Needs perk: Temper Bath (Smith).'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need water to quench it in: stand at the water, or beside a barrel or a well of it.'$tx6o$, ''))) / length($tx6o$'You need water to quench it in: stand at the water, or beside a barrel or a well of it.'$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need water to quench it in: stand at the water, or beside a barrel or a well of it.'$tx6o$, $tx6n$'Need water: stand at water, or beside a barrel or well of it.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$if v_it.dmg > 10 then return 'It is too knocked about to work on. Repair it first.'; end if;$tx6o$, ''))) / length($tx6o$if v_it.dmg > 10 then return 'It is too knocked about to work on. Repair it first.'; end if;$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$if v_it.dmg > 10 then return 'It is too knocked about to work on. Repair it first.'; end if;$tx6o$, $tx6n$if v_it.dmg > 10 then return 'Damage over 10: repair it first.'; end if;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You need ' || (select string_agg(lower((select coalesce(name, t.tool) from item_def where id = t.tool)),
                                               ' and ' order by t.ord)
                             from improve_tool t where t.material = v_mat.id)
        || ' to work ' || v_mat.name || '.';$tx6o$, ''))) / length($tx6o$return 'You need ' || (select string_agg(lower((select coalesce(name, t.tool) from item_def where id = t.tool)),
                                               ' and ' order by t.ord)
                             from improve_tool t where t.material = v_mat.id)
        || ' to work ' || v_mat.name || '.';$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You need ' || (select string_agg(lower((select coalesce(name, t.tool) from item_def where id = t.tool)),
                                               ' and ' order by t.ord)
                             from improve_tool t where t.material = v_mat.id)
        || ' to work ' || v_mat.name || '.';$tx6o$, $tx6n$return 'Need ' || (select string_agg(lower((select coalesce(name, t.tool) from item_def where id = t.tool)),
                                               ' and ' order by t.ord)
                             from improve_tool t where t.material = v_mat.id)
        || ' for ' || v_mat.name || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You have no ' || lower(coalesce(v_made, v_mat.name))
        || ' to work into it, and nothing else will do.';$tx6o$, ''))) / length($tx6o$return 'You have no ' || lower(coalesce(v_made, v_mat.name))
        || ' to work into it, and nothing else will do.';$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You have no ' || lower(coalesce(v_made, v_mat.name))
        || ' to work into it, and nothing else will do.';$tx6o$, $tx6n$return 'Need ' || lower(coalesce(v_made, v_mat.name))
        || ' to work into it.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'Your ' || replace(v_what.skill, '_', ' ') || ' is not good enough to better it further.';$tx6o$, ''))) / length($tx6o$return 'Your ' || replace(v_what.skill, '_', ' ') || ' is not good enough to better it further.';$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'Your ' || replace(v_what.skill, '_', ' ') || ' is not good enough to better it further.';$tx6o$, $tx6n$return 'QL capped by your ' || replace(v_what.skill, '_', ' ') || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The ' || lower(item_name(v_it)) || ' is at QL '
        || to_char(v_it.ql, 'FM990.0') || ', which is what you asked for.';$tx6o$, ''))) / length($tx6o$return 'The ' || lower(item_name(v_it)) || ' is at QL '
        || to_char(v_it.ql, 'FM990.0') || ', which is what you asked for.';$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The ' || lower(item_name(v_it)) || ' is at QL '
        || to_char(v_it.ql, 'FM990.0') || ', which is what you asked for.';$tx6o$, $tx6n$return item_name(v_it) || ': QL '
        || to_char(v_it.ql, 'FM990.0') || ', target reached.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You are not tired.'$tx6o$, ''))) / length($tx6o$'You are not tired.'$tx6o$);
  if n <> 1 then raise exception 'item_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You are not tired.'$tx6o$, $tx6n$'Stamina already full.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('gather_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'There is no bed of anything here.'$tx6o$, ''))) / length($tx6o$'There is no bed of anything here.'$tx6o$);
  if n <> 1 then raise exception 'gather_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no bed of anything here.'$tx6o$, $tx6n$'Nothing to collect here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is nothing standing here to cut down.'$tx6o$, ''))) / length($tx6o$'There is nothing standing here to cut down.'$tx6o$);
  if n <> 1 then raise exception 'gather_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is nothing standing here to cut down.'$tx6o$, $tx6n$'No tree or bush here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'This spot has been picked clean for now.'$tx6o$, ''))) / length($tx6o$'This spot has been picked clean for now.'$tx6o$);
  if n <> 2 then raise exception 'gather_refusal: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'This spot has been picked clean for now.'$tx6o$, $tx6n$'Already searched. Try later.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('farm_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Moss is planted on a tile of dirt.'$tx6o$, ''))) / length($tx6o$'Moss is planted on a tile of dirt.'$tx6o$);
  if n <> 1 then raise exception 'farm_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Moss is planted on a tile of dirt.'$tx6o$, $tx6n$'Needs a dirt tile.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You cannot plant moss underwater.'$tx6o$, ''))) / length($tx6o$'You cannot plant moss underwater.'$tx6o$);
  if n <> 1 then raise exception 'farm_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You cannot plant moss underwater.'$tx6o$, $tx6n$'Not under water.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Grass is planted on a tile of dirt.'$tx6o$, ''))) / length($tx6o$'Grass is planted on a tile of dirt.'$tx6o$);
  if n <> 1 then raise exception 'farm_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Grass is planted on a tile of dirt.'$tx6o$, $tx6n$'Needs a dirt tile.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You cannot plant grass underwater.'$tx6o$, ''))) / length($tx6o$'You cannot plant grass underwater.'$tx6o$);
  if n <> 1 then raise exception 'farm_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You cannot plant grass underwater.'$tx6o$, $tx6n$'Not under water.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'It takes ' || moss_plant() || ' moss to plant a tile; you have ' || pack_count(p_world, p_uid, 'moss') || '.';$tx6o$, ''))) / length($tx6o$return 'It takes ' || moss_plant() || ' moss to plant a tile; you have ' || pack_count(p_world, p_uid, 'moss') || '.';$tx6o$);
  if n <> 1 then raise exception 'farm_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'It takes ' || moss_plant() || ' moss to plant a tile; you have ' || pack_count(p_world, p_uid, 'moss') || '.';$tx6o$, $tx6n$return 'Need ' || moss_plant() || ' moss; have ' || pack_count(p_world, p_uid, 'moss') || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'It takes ' || grass_plant() || ' mixed grass to plant a tile; you have ' || pack_count(p_world, p_uid, 'mixed_grass') || '.';$tx6o$, ''))) / length($tx6o$return 'It takes ' || grass_plant() || ' mixed grass to plant a tile; you have ' || pack_count(p_world, p_uid, 'mixed_grass') || '.';$tx6o$);
  if n <> 1 then raise exception 'farm_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'It takes ' || grass_plant() || ' mixed grass to plant a tile; you have ' || pack_count(p_world, p_uid, 'mixed_grass') || '.';$tx6o$, $tx6n$return 'Need ' || grass_plant() || ' mixed grass; have ' || pack_count(p_world, p_uid, 'mixed_grass') || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You cannot till underwater.'$tx6o$, ''))) / length($tx6o$'You cannot till underwater.'$tx6o$);
  if n <> 1 then raise exception 'farm_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You cannot till underwater.'$tx6o$, $tx6n$'Not under water.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The ground is too steep to work.'$tx6o$, ''))) / length($tx6o$'The ground is too steep to work.'$tx6o$);
  if n <> 1 then raise exception 'farm_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The ground is too steep to work.'$tx6o$, $tx6n$'Too steep: slope over 20.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Something is already growing there.'$tx6o$, ''))) / length($tx6o$'Something is already growing there.'$tx6o$);
  if n <> 1 then raise exception 'farm_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Something is already growing there.'$tx6o$, $tx6n$'Already growing a crop.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Sow on a tilled field.'$tx6o$, ''))) / length($tx6o$'Sow on a tilled field.'$tx6o$);
  if n <> 1 then raise exception 'farm_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Sow on a tilled field.'$tx6o$, $tx6n$'Needs a tilled field.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Choose a seed to sow.'$tx6o$, ''))) / length($tx6o$'Choose a seed to sow.'$tx6o$);
  if n <> 2 then raise exception 'farm_refusal: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'Choose a seed to sow.'$tx6o$, $tx6n$'Choose a seed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Nothing is growing there.'$tx6o$, ''))) / length($tx6o$'Nothing is growing there.'$tx6o$);
  if n <> 2 then raise exception 'farm_refusal: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'Nothing is growing there.'$tx6o$, $tx6n$'No crop there.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It is ripe. Harvest it.'$tx6o$, ''))) / length($tx6o$'It is ripe. Harvest it.'$tx6o$);
  if n <> 1 then raise exception 'farm_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is ripe. Harvest it.'$tx6o$, $tx6n$'Ripe: harvest it.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You have already tended it at this stage. Wait for it to grow on.'$tx6o$, ''))) / length($tx6o$'You have already tended it at this stage. Wait for it to grow on.'$tx6o$);
  if n <> 1 then raise exception 'farm_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You have already tended it at this stage. Wait for it to grow on.'$tx6o$, $tx6n$'Already tended at this stage.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no empty field in the patch to sow.'$tx6o$, ''))) / length($tx6o$'There is no empty field in the patch to sow.'$tx6o$);
  if n <> 1 then raise exception 'farm_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no empty field in the patch to sow.'$tx6o$, $tx6n$'No empty field in the patch.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Nothing in the patch wants tending.'$tx6o$, ''))) / length($tx6o$'Nothing in the patch wants tending.'$tx6o$);
  if n <> 1 then raise exception 'farm_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing in the patch wants tending.'$tx6o$, $tx6n$'Nothing in the patch needs tending.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'That wants a Farmer who has learned to sow a patch.'; end if;$tx6o$, ''))) / length($tx6o$return 'That wants a Farmer who has learned to sow a patch.'; end if;$tx6o$);
  if n <> 1 then raise exception 'farm_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'That wants a Farmer who has learned to sow a patch.'; end if;$tx6o$, $tx6n$return 'Needs perk: Sow a Patch (Farmer).'; end if;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'That wants a Farmer who has learned to tend a patch.'; end if;$tx6o$, ''))) / length($tx6o$return 'That wants a Farmer who has learned to tend a patch.'; end if;$tx6o$);
  if n <> 1 then raise exception 'farm_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'That wants a Farmer who has learned to tend a patch.'; end if;$tx6o$, $tx6n$return 'Needs perk: Tend a Patch (Farmer).'; end if;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'That wants a Farmer who has learned to harvest a patch.'; end if;$tx6o$, ''))) / length($tx6o$return 'That wants a Farmer who has learned to harvest a patch.'; end if;$tx6o$);
  if n <> 1 then raise exception 'farm_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'That wants a Farmer who has learned to harvest a patch.'; end if;$tx6o$, $tx6n$return 'Needs perk: Harvest a Patch (Farmer).'; end if;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'It is only ' || crop_stage_name(c.stage) || '. Let it grow.';$tx6o$, ''))) / length($tx6o$return 'It is only ' || crop_stage_name(c.stage) || '. Let it grow.';$tx6o$);
  if n <> 1 then raise exception 'farm_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'It is only ' || crop_stage_name(c.stage) || '. Let it grow.';$tx6o$, $tx6n$return 'Not ripe: ' || crop_stage_name(c.stage) || '.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_ground(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You turn a spadeful over and nothing is moving in it.'$tx6o$, ''))) / length($tx6o$'You turn a spadeful over and nothing is moving in it.'$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You turn a spadeful over and nothing is moving in it.'$tx6o$, $tx6n$'No worms found.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The shovel comes up with nothing but water.'$tx6o$, ''))) / length($tx6o$'The shovel comes up with nothing but water.'$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The shovel comes up with nothing but water.'$tx6o$, $tx6n$'Dredge failed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'What is still standing high here is bare rock. Mine it down.'$tx6o$, ''))) / length($tx6o$'What is still standing high here is bare rock. Mine it down.'$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'What is still standing high here is bare rock. Mine it down.'$tx6o$, $tx6n$'High corners are bare rock: mine them.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is nothing left to move here.'$tx6o$, ''))) / length($tx6o$'There is nothing left to move here.'$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is nothing left to move here.'$tx6o$, $tx6n$'Nothing left to move.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You move some dirt across the tile.'$tx6o$, ''))) / length($tx6o$'You move some dirt across the tile.'$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You move some dirt across the tile.'$tx6o$, $tx6n$'Dirt moved across the tile.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The tile is now flat at its lowest corner.'$tx6o$, ''))) / length($tx6o$'The tile is now flat at its lowest corner.'$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The tile is now flat at its lowest corner.'$tx6o$, $tx6n$'Flat, at its lowest corner.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The tile is now flat and level with the ground you stand on.'$tx6o$, ''))) / length($tx6o$'The tile is now flat and level with the ground you stand on.'$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The tile is now flat and level with the ground you stand on.'$tx6o$, $tx6n$'Flat, level with your tile.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You turn the dirt over and pick ' || v_n || ' worm'
      || case when v_n > 1 then 's' else '' end || ' out of it.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You turn the dirt over and pick ' || v_n || ' worm'
      || case when v_n > 1 then 's' else '' end || ' out of it.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You turn the dirt over and pick ' || v_n || ' worm'
      || case when v_n > 1 then 's' else '' end || ' out of it.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Found: ' || v_n || ' worm'
      || case when v_n > 1 then 's' else '' end || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You dredge up some ' || lower((select name from item_def where id = v_spoil))
      || ' off the bottom at the ' || corner_name(tx, ty, cx, cy) || ' corner. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You dredge up some ' || lower((select name from item_def where id = v_spoil))
      || ' off the bottom at the ' || corner_name(tx, ty, cx, cy) || ' corner. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You dredge up some ' || lower((select name from item_def where id = v_spoil))
      || ' off the bottom at the ' || corner_name(tx, ty, cx, cy) || ' corner. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Dredged: ' || lower((select name from item_def where id = v_spoil))
      || ', ' || corner_name(tx, ty, cx, cy) || ' corner, QL ' || to_char(v_ql, 'FM990.0') || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You scrape the ground down and pocket the '
        || lower((select name from item_def where id = v_spoil)) || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You scrape the ground down and pocket the '
        || lower((select name from item_def where id = v_spoil)) || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You scrape the ground down and pocket the '
        || lower((select name from item_def where id = v_spoil)) || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Lowered. Got: '
        || lower((select name from item_def where id = v_spoil)) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You need '
          || lower((select name from item_def where id = v_spoil))
          || ' or dirt to bring this ground up, in the pack or in something beside you.', 'error');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You need '
          || lower((select name from item_def where id = v_spoil))
          || ' or dirt to bring this ground up, in the pack or in something beside you.', 'error');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You need '
          || lower((select name from item_def where id = v_spoil))
          || ' or dirt to bring this ground up, in the pack or in something beside you.', 'error');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Need '
          || lower((select name from item_def where id = v_spoil))
          || ' or dirt, in the pack or a container beside you.', 'error');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You pack '
          || lower((select name from item_def where id = v_spoil))
          || ' in to bring the ground up.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You pack '
          || lower((select name from item_def where id = v_spoil))
          || ' in to bring the ground up.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You pack '
          || lower((select name from item_def where id = v_spoil))
          || ' in to bring the ground up.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Raised. Used: '
          || lower((select name from item_def where id = v_spoil))
          || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You drop the ' || lower((select name from item_def where id = v_spoil))
      || ' on the ' || corner_name(tx, ty, cx, cy) || ' corner, raising the ground.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You drop the ' || lower((select name from item_def where id = v_spoil))
      || ' on the ' || corner_name(tx, ty, cx, cy) || ' corner, raising the ground.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You drop the ' || lower((select name from item_def where id = v_spoil))
      || ' on the ' || corner_name(tx, ty, cx, cy) || ' corner, raising the ground.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Dropped: ' || lower((select name from item_def where id = v_spoil))
      || ', ' || corner_name(tx, ty, cx, cy) || ' corner raised.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You put the level away. Flattening works to the ground you stand on again.'$tx6o$, ''))) / length($tx6o$'You put the level away. Flattening works to the ground you stand on again.'$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You put the level away. Flattening works to the ground you stand on again.'$tx6o$, $tx6n$'Level cleared. Flatten works to your tile.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The rubble slides off the rock before it binds, and is lost.'$tx6o$, ''))) / length($tx6o$'The rubble slides off the rock before it binds, and is lost.'$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The rubble slides off the rock before it binds, and is lost.'$tx6o$, $tx6n$'Rubble failed: shards lost.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The concrete slumps off the rock before it sets, and is lost.'$tx6o$, ''))) / length($tx6o$'The concrete slumps off the rock before it sets, and is lost.'$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The concrete slumps off the rock before it sets, and is lost.'$tx6o$, $tx6n$'Concrete failed: concrete lost.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Your hatchet glances off and you fail to make headway.'$tx6o$, ''))) / length($tx6o$'Your hatchet glances off and you fail to make headway.'$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Your hatchet glances off and you fail to make headway.'$tx6o$, $tx6n$'Cut failed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You find no sprout worth picking.'$tx6o$, ''))) / length($tx6o$'You find no sprout worth picking.'$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You find no sprout worth picking.'$tx6o$, $tx6n$'No sprout found.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You sight the level at ' || land_height(p_world, cx, cy)
        || '. Flattening works to it, and digging, dropping and concrete stop at it.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You sight the level at ' || land_height(p_world, cx, cy)
        || '. Flattening works to it, and digging, dropping and concrete stop at it.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You sight the level at ' || land_height(p_world, cx, cy)
        || '. Flattening works to it, and digging, dropping and concrete stop at it.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Level set: ' || land_height(p_world, cx, cy)
        || '. Flatten works to it; dig, drop and concrete stop at it.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You pack rubble into the ' || corner_name(tx, ty, cx, cy)
      || ' corner and the rock stands a step higher.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You pack rubble into the ' || corner_name(tx, ty, cx, cy)
      || ' corner and the rock stands a step higher.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You pack rubble into the ' || corner_name(tx, ty, cx, cy)
      || ' corner and the rock stands a step higher.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Rubble packed: ' || corner_name(tx, ty, cx, cy)
      || ' corner raised.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$else ' It lies under ' || greatest(1, land_dirt(p_world, tx, ty)) || ' of ground.' end;$tx6o$, ''))) / length($tx6o$else ' It lies under ' || greatest(1, land_dirt(p_world, tx, ty)) || ' of ground.' end;$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$else ' It lies under ' || greatest(1, land_dirt(p_world, tx, ty)) || ' of ground.' end;$tx6o$, $tx6n$else ' Under ' || greatest(1, land_dirt(p_world, tx, ty)) || ' of ground.' end;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You sample the ' || lower(v_rock.name)
        || '. It needs mining ' || to_char($tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You sample the ' || lower(v_rock.name)
        || '. It needs mining ' || to_char($tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You sample the ' || lower(v_rock.name)
        || '. It needs mining ' || to_char($tx6o$, $tx6n$perform tell(p_world, p_uid, 'Here: ' || lower(v_rock.name)
        || '. Needs mining ' || to_char($tx6n$);
  n := (length(v) - length(replace(v, $tx6o$|| ' to work' || case when skill_of(p_world, p_uid, 'mining')$tx6o$, ''))) / length($tx6o$|| ' to work' || case when skill_of(p_world, p_uid, 'mining')$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$|| ' to work' || case when skill_of(p_world, p_uid, 'mining')$tx6o$, $tx6n$|| case when skill_of(p_world, p_uid, 'mining')$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then ', which you have' else '' end
        || ', and will give up nothing finer than quality ' || to_char(v_ql, 'FM990')$tx6o$, ''))) / length($tx6o$then ', which you have' else '' end
        || ', and will give up nothing finer than quality ' || to_char(v_ql, 'FM990')$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then ', which you have' else '' end
        || ', and will give up nothing finer than quality ' || to_char(v_ql, 'FM990')$tx6o$, $tx6n$then ' (you have it)' else '' end
        || '. Max QL ' || to_char(v_ql, 'FM990')$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'Plain ' || lower(v_rock.name)
        || ' beneath you, with no metal in it, and nothing finer than quality '
        || to_char(v_ql, 'FM990') || ' in the stone.' || v_buried, 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'Plain ' || lower(v_rock.name)
        || ' beneath you, with no metal in it, and nothing finer than quality '
        || to_char(v_ql, 'FM990') || ' in the stone.' || v_buried, 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'Plain ' || lower(v_rock.name)
        || ' beneath you, with no metal in it, and nothing finer than quality '
        || to_char(v_ql, 'FM990') || ' in the stone.' || v_buried, 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Here: plain ' || lower(v_rock.name)
        || ', no metal. Max QL '
        || to_char(v_ql, 'FM990') || '.' || v_buried, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You read the ground ' || v_rad
        || ' tiles about you and find no sign of anything worth mining.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You read the ground ' || v_rad
        || ' tiles about you and find no sign of anything worth mining.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You read the ground ' || v_rad
        || ' tiles about you and find no sign of anything worth mining.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'No seams within ' || v_rad
        || ' tiles.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'Within ' || v_rad || ' tiles you read '
        || (select string_agg(case when n > 1 then n || ' tiles of ' || nm
                                   else 'a tile of ' || nm end, ' and ' order by nm)$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'Within ' || v_rad || ' tiles you read '
        || (select string_agg(case when n > 1 then n || ' tiles of ' || nm
                                   else 'a tile of ' || nm end, ' and ' order by nm)$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'Within ' || v_rad || ' tiles you read '
        || (select string_agg(case when n > 1 then n || ' tiles of ' || nm
                                   else 'a tile of ' || nm end, ' and ' order by nm)$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Seams within ' || v_rad || ' tiles, buried or bare (tiles): '
        || (select string_agg(nm || ' ' || n, ', ' order by nm)$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$|| ', buried or bare. They are marked for a while.', 'event');$tx6o$, ''))) / length($tx6o$|| ', buried or bare. They are marked for a while.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$|| ', buried or bare. They are marked for a while.', 'event');$tx6o$, $tx6n$|| '. Marked for ' || (prospect_mark_time() / 60)::int || ' min.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The roots hold. You dig round the ' || lower(v_tree.name)
        || ' stump and it does not shift.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The roots hold. You dig round the ' || lower(v_tree.name)
        || ' stump and it does not shift.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The roots hold. You dig round the ' || lower(v_tree.name)
        || ' stump and it does not shift.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Dig failed: ' || lower(v_tree.name)
        || ' stump.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You dig the ' || lower(v_tree.name)
      || ' stump out. The ground is bare dirt where it stood.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You dig the ' || lower(v_tree.name)
      || ' stump out. The ground is bare dirt where it stood.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You dig the ' || lower(v_tree.name)
      || ' stump out. The ground is bare dirt where it stood.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Dug out: ' || lower(v_tree.name)
      || ' stump. Tile: dirt.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, case when v_n = 1 then 'You pick a ' || lower(v_tree.name) || ' sprout.'
      else 'You pick ' || number_word(v_n) || ' ' || lower(v_tree.name) || ' sprouts.' end, 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, case when v_n = 1 then 'You pick a ' || lower(v_tree.name) || ' sprout.'
      else 'You pick ' || number_word(v_n) || ' ' || lower(v_tree.name) || ' sprouts.' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, case when v_n = 1 then 'You pick a ' || lower(v_tree.name) || ' sprout.'
      else 'You pick ' || number_word(v_n) || ' ' || lower(v_tree.name) || ' sprouts.' end, 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Picked: ' || v_n || ' ' || lower(v_tree.name)
      || case when v_n = 1 then ' sprout.' else ' sprouts.' end, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You cut at the ' || lower(v_tree.name)
        || ' and take off nothing that matters.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You cut at the ' || lower(v_tree.name)
        || ' and take off nothing that matters.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You cut at the ' || lower(v_tree.name)
        || ' and take off nothing that matters.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Prune failed: ' || lower(v_tree.name)
        || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You prune the ' || lower(v_age.name) || ' ' || lower(v_tree.name)
      || ' back. It stands as a ' || lower(v_to.name) || ' ' || lower(v_tree.name) || ' now.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You prune the ' || lower(v_age.name) || ' ' || lower(v_tree.name)
      || ' back. It stands as a ' || lower(v_to.name) || ' ' || lower(v_tree.name) || ' now.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You prune the ' || lower(v_age.name) || ' ' || lower(v_tree.name)
      || ' back. It stands as a ' || lower(v_to.name) || ' ' || lower(v_tree.name) || ' now.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Pruned ' || lower(v_tree.name) || ': ' || lower(v_age.name)
      || ' to ' || lower(v_to.name) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You plant the '
      || lower((select name from tree_def where id = v_species)) || ' sprout.'$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You plant the '
      || lower((select name from tree_def where id = v_species)) || ' sprout.'$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You plant the '
      || lower((select name from tree_def where id = v_species)) || ' sprout.'$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Planted: '
      || lower((select name from tree_def where id = v_species)) || ' sprout.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$else ' It comes up a ' || lower((select name from tree_age_def where id = v_grown)) || ' '
                   || lower((select name from tree_def where id = v_species)) || '.' end, 'event');$tx6o$, ''))) / length($tx6o$else ' It comes up a ' || lower((select name from tree_age_def where id = v_grown)) || ' '
                   || lower((select name from tree_def where id = v_species)) || '.' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$else ' It comes up a ' || lower((select name from tree_age_def where id = v_grown)) || ' '
                   || lower((select name from tree_def where id = v_species)) || '.' end, 'event');$tx6o$, $tx6n$else ' Starts ' || lower((select name from tree_age_def where id = v_grown)) || '.' end, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You lay concrete on the ' || corner_name(tx, ty, cx, cy)
      || ' corner and the rock stands ' || case when v_n > 1 then number_word(v_n) || ' steps' else 'a step' end
      || ' higher.', 'event');$tx6o$, ''))) / length($tx6o$'You lay concrete on the ' || corner_name(tx, ty, cx, cy)
      || ' corner and the rock stands ' || case when v_n > 1 then number_word(v_n) || ' steps' else 'a step' end
      || ' higher.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You lay concrete on the ' || corner_name(tx, ty, cx, cy)
      || ' corner and the rock stands ' || case when v_n > 1 then number_word(v_n) || ' steps' else 'a step' end
      || ' higher.', 'event');$tx6o$, $tx6n$'Concrete laid: ' || corner_name(tx, ty, cx, cy)
      || ' corner raised' || case when v_n > 1 then ' ' || v_n || ' steps' else '' end || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The slab rocks on its bed however you set it. You leave it for now.'$tx6o$, ''))) / length($tx6o$'The slab rocks on its bed however you set it. You leave it for now.'$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The slab rocks on its bed however you set it. You leave it for now.'$tx6o$, $tx6n$'Slab failed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You break up the paving, leaving bare dirt.'$tx6o$, ''))) / length($tx6o$'You break up the paving, leaving bare dirt.'$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You break up the paving, leaving bare dirt.'$tx6o$, $tx6n$'Paving removed. Tile: dirt.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The ' || lower(v_sprout.extra) || ' graft does not take, and the sprout is spent.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The ' || lower(v_sprout.extra) || ' graft does not take, and the sprout is spent.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The ' || lower(v_sprout.extra) || ' graft does not take, and the sprout is spent.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Graft failed: ' || lower(v_sprout.extra) || ' sprout lost.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You graft the ' || lower(v_sprout.extra) || ' sprout onto the ' || lower(v_tree.name)
      || '. It is a ' || lower((select name from tree_age_def where id = tree_age(v_data))) || ' '
      || lower(v_sprout.extra) || ' tree now.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You graft the ' || lower(v_sprout.extra) || ' sprout onto the ' || lower(v_tree.name)
      || '. It is a ' || lower((select name from tree_age_def where id = tree_age(v_data))) || ' '
      || lower(v_sprout.extra) || ' tree now.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You graft the ' || lower(v_sprout.extra) || ' sprout onto the ' || lower(v_tree.name)
      || '. It is a ' || lower((select name from tree_age_def where id = tree_age(v_data))) || ' '
      || lower(v_sprout.extra) || ' tree now.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Grafted: ' || lower(v_tree.name)
      || ' to ' || lower((select name from tree_age_def where id = tree_age(v_data))) || ' '
      || lower(v_sprout.extra) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You cut the ' || lower(v_age.name) || ' ' || lower(v_tree.name)
      || ' back to the stool and get ' || v_n || case when v_n = 1 then ' log' else ' logs' end
      || '. (QL ' || to_char(v_ql, 'FM990.0') || ') It stands as a '
      || lower((select name from tree_age_def where id = planted_age(0))) || ' ' || lower(v_tree.name) || ' now.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You cut the ' || lower(v_age.name) || ' ' || lower(v_tree.name)
      || ' back to the stool and get ' || v_n || case when v_n = 1 then ' log' else ' logs' end
      || '. (QL ' || to_char(v_ql, 'FM990.0') || ') It stands as a '
      || lower((select name from tree_age_def where id = planted_age(0))) || ' ' || lower(v_tree.name) || ' now.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You cut the ' || lower(v_age.name) || ' ' || lower(v_tree.name)
      || ' back to the stool and get ' || v_n || case when v_n = 1 then ' log' else ' logs' end
      || '. (QL ' || to_char(v_ql, 'FM990.0') || ') It stands as a '
      || lower((select name from tree_age_def where id = planted_age(0))) || ' ' || lower(v_tree.name) || ' now.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Coppiced ' || lower(v_age.name) || ' ' || lower(v_tree.name)
      || ': ' || v_n || case when v_n = 1 then ' log' else ' logs' end
      || ', QL ' || to_char(v_ql, 'FM990.0') || '. Now '
      || lower((select name from tree_age_def where id = planted_age(0))) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You cut the ' || lower((select name from tree_def where id = resin_tree()))
      || '''s bark and collect ' || v_n || ' ' || lower((select name from item_def where id = 'tar'))
      || ' from it. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You cut the ' || lower((select name from tree_def where id = resin_tree()))
      || '''s bark and collect ' || v_n || ' ' || lower((select name from item_def where id = 'tar'))
      || ' from it. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You cut the ' || lower((select name from tree_def where id = resin_tree()))
      || '''s bark and collect ' || v_n || ' ' || lower((select name from item_def where id = 'tar'))
      || ' from it. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Tapped: ' || v_n || ' ' || lower((select name from item_def where id = 'tar'))
      || ', QL ' || to_char(v_ql, 'FM990.0') || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You clear the brush off ' || v_n || case when v_n = 1 then ' tile.' else ' tiles.' end, 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You clear the brush off ' || v_n || case when v_n = 1 then ' tile.' else ' tiles.' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You clear the brush off ' || v_n || case when v_n = 1 then ' tile.' else ' tiles.' end, 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Brush cleared: ' || v_n || case when v_n = 1 then ' tile.' else ' tiles.' end, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You bed the '
      || lower((select name from item_def where id = v_slab.def)) || ' down flat and true.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You bed the '
      || lower((select name from item_def where id = v_slab.def)) || ' down flat and true.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You bed the '
      || lower((select name from item_def where id = v_slab.def)) || ' down flat and true.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Laid: '
      || lower((select name from item_def where id = v_slab.def)) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You lever the '
        || regexp_replace(lower((select name from slab_def where id = v_kind)), 's$', '')
        || ' up whole. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You lever the '
        || regexp_replace(lower((select name from slab_def where id = v_kind)), 's$', '')
        || ' up whole. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You lever the '
        || regexp_replace(lower((select name from slab_def where id = v_kind)), 's$', '')
        || ' up whole. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Lifted whole: '
        || regexp_replace(lower((select name from slab_def where id = v_kind)), 's$', '')
        || ', QL ' || to_char(v_ql, 'FM990.0') || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You cut ' || number_word(v_cut) || ' bundles of mixed grass.'
        || case when 3 - v_n - 1 > 0
             then ' Kept cut, this will be lawn in ' || (3 - v_n - 1) || ' more day' || case when 3 - v_n - 1 = 1 then '' else 's' end || '.'
             else ' Kept cut, this will be lawn tomorrow.' end, 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You cut ' || number_word(v_cut) || ' bundles of mixed grass.'
        || case when 3 - v_n - 1 > 0
             then ' Kept cut, this will be lawn in ' || (3 - v_n - 1) || ' more day' || case when 3 - v_n - 1 = 1 then '' else 's' end || '.'
             else ' Kept cut, this will be lawn tomorrow.' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You cut ' || number_word(v_cut) || ' bundles of mixed grass.'
        || case when 3 - v_n - 1 > 0
             then ' Kept cut, this will be lawn in ' || (3 - v_n - 1) || ' more day' || case when 3 - v_n - 1 = 1 then '' else 's' end || '.'
             else ' Kept cut, this will be lawn tomorrow.' end, 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Cut: ' || v_cut || ' mixed grass.'
        || case when 3 - v_n - 1 > 0
             then ' Lawn in ' || (3 - v_n - 1) || ' more day' || case when 3 - v_n - 1 = 1 then '' else 's' end || ' if kept cut.'
             else ' Lawn tomorrow if kept cut.' end, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You cut ' || number_word(v_cut) || ' bundles of mixed grass.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You cut ' || number_word(v_cut) || ' bundles of mixed grass.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You cut ' || number_word(v_cut) || ' bundles of mixed grass.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Cut: ' || v_cut || ' mixed grass.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You cut ' || number_word(v_cut) || ' clumps of moss.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You cut ' || number_word(v_cut) || ' clumps of moss.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You cut ' || number_word(v_cut) || ' clumps of moss.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Cut: ' || v_cut || ' moss.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You cut ' || v_n || ' reeds out of the bed.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You cut ' || v_n || ' reeds out of the bed.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You cut ' || v_n || ' reeds out of the bed.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Cut: ' || v_n || ' reeds.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You pick ' || v_n || ' '
      || lower((select name from item_def where id = v_tree.fruit))
      || case when v_n = 1 then '' else 's' end
      || ' off the ' || lower(v_tree.name) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You pick ' || v_n || ' '
      || lower((select name from item_def where id = v_tree.fruit))
      || case when v_n = 1 then '' else 's' end
      || ' off the ' || lower(v_tree.name) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You pick ' || v_n || ' '
      || lower((select name from item_def where id = v_tree.fruit))
      || case when v_n = 1 then '' else 's' end
      || ' off the ' || lower(v_tree.name) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Picked: ' || v_n || ' '
      || lower((select name from item_def where id = v_tree.fruit))
      || case when v_n = 1 then '' else 's' end
      || ', QL ' || to_char(v_ql, 'FM990.0') || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You cut ' || v_n || ' '
      || lower((select name from item_def where id = (select yields from bush_def where id = bush_species(v_data))))
      || ' off the ' || lower((select name from bush_def where id = bush_species(v_data)))
      || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You cut ' || v_n || ' '
      || lower((select name from item_def where id = (select yields from bush_def where id = bush_species(v_data))))
      || ' off the ' || lower((select name from bush_def where id = bush_species(v_data)))
      || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You cut ' || v_n || ' '
      || lower((select name from item_def where id = (select yields from bush_def where id = bush_species(v_data))))
      || ' off the ' || lower((select name from bush_def where id = bush_species(v_data)))
      || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Harvested: ' || v_n || ' '
      || lower((select name from item_def where id = (select yields from bush_def where id = bush_species(v_data))))
      || ', QL ' || to_char(v_ql, 'FM990.0') || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You pack dirt in to bring the ground up.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You pack dirt in to bring the ground up.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You pack dirt in to bring the ground up.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Raised. Used: dirt.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('cellar_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You need a shovel to dig.'$tx6o$, ''))) / length($tx6o$'You need a shovel to dig.'$tx6o$);
  if n <> 1 then raise exception 'cellar_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need a shovel to dig.'$tx6o$, $tx6n$'Need a shovel.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need a pickaxe to mine.'$tx6o$, ''))) / length($tx6o$'You need a pickaxe to mine.'$tx6o$);
  if n <> 1 then raise exception 'cellar_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need a pickaxe to mine.'$tx6o$, $tx6n$'Need a pickaxe.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is nothing lying about here.'$tx6o$, ''))) / length($tx6o$'There is nothing lying about here.'$tx6o$);
  if n <> 1 then raise exception 'cellar_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is nothing lying about here.'$tx6o$, $tx6n$'Nothing here to pick up.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is nothing there any more.'$tx6o$, ''))) / length($tx6o$'There is nothing there any more.'$tx6o$);
  if n <> 1 then raise exception 'cellar_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is nothing there any more.'$tx6o$, $tx6n$'Nothing there.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need a shovel to fill it in.'$tx6o$, ''))) / length($tx6o$'You need a shovel to fill it in.'$tx6o$);
  if n <> 1 then raise exception 'cellar_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need a shovel to fill it in.'$tx6o$, $tx6n$'Need a shovel.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need dirt, clay or sand to fill it in, in the pack or in something beside you.'$tx6o$, ''))) / length($tx6o$'You need dirt, clay or sand to fill it in, in the pack or in something beside you.'$tx6o$);
  if n <> 1 then raise exception 'cellar_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need dirt, clay or sand to fill it in, in the pack or in something beside you.'$tx6o$, $tx6n$'Need dirt, clay or sand, in the pack or a container beside you.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The soil is dug through here, ' || coalesce((cellar_at(p_world, v_x, v_y)).dug, 0) || ' down. The rest is rock, for a pickaxe.';$tx6o$, ''))) / length($tx6o$return 'The soil is dug through here, ' || coalesce((cellar_at(p_world, v_x, v_y)).dug, 0) || ' down. The rest is rock, for a pickaxe.';$tx6o$);
  if n <> 1 then raise exception 'cellar_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The soil is dug through here, ' || coalesce((cellar_at(p_world, v_x, v_y)).dug, 0) || ' down. The rest is rock, for a pickaxe.';$tx6o$, $tx6n$return 'Soil dug through at ' || coalesce((cellar_at(p_world, v_x, v_y)).dug, 0) || ' down. Rock below: use a pickaxe.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'There is soil to dig out here first, ' || (cellar_soil(p_world, v_x, v_y) - coalesce((cellar_at(p_world, v_x, v_y)).dug, 0))
        || ' of it, for a shovel.';$tx6o$, ''))) / length($tx6o$return 'There is soil to dig out here first, ' || (cellar_soil(p_world, v_x, v_y) - coalesce((cellar_at(p_world, v_x, v_y)).dug, 0))
        || ' of it, for a shovel.';$tx6o$);
  if n <> 1 then raise exception 'cellar_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'There is soil to dig out here first, ' || (cellar_soil(p_world, v_x, v_y) - coalesce((cellar_at(p_world, v_x, v_y)).dug, 0))
        || ' of it, for a shovel.';$tx6o$, $tx6n$return 'Dig the soil first: ' || (cellar_soil(p_world, v_x, v_y) - coalesce((cellar_at(p_world, v_x, v_y)).dug, 0))
        || ' left, with a shovel.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return r.name || ' needs mining ' || rtrim(rtrim(to_char(v_need, 'FM990.99'), '0'), '.')
        || ' to work. Yours is ' || to_char(v_mining, 'FM990.0') || '.';$tx6o$, ''))) / length($tx6o$return r.name || ' needs mining ' || rtrim(rtrim(to_char(v_need, 'FM990.99'), '0'), '.')
        || ' to work. Yours is ' || to_char(v_mining, 'FM990.0') || '.';$tx6o$);
  if n <> 1 then raise exception 'cellar_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return r.name || ' needs mining ' || rtrim(rtrim(to_char(v_need, 'FM990.99'), '0'), '.')
        || ' to work. Yours is ' || to_char(v_mining, 'FM990.0') || '.';$tx6o$, $tx6n$return r.name || ': needs mining ' || rtrim(rtrim(to_char(v_need, 'FM990.99'), '0'), '.')
        || '; have ' || to_char(v_mining, 'FM990.0') || '.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('act_refusal_rules(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'The water is too deep here to work in.'$tx6o$, ''))) / length($tx6o$'The water is too deep here to work in.'$tx6o$);
  if n <> 2 then raise exception 'act_refusal_rules: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'The water is too deep here to work in.'$tx6o$, $tx6n$'Water too deep.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That corner is bare rock. Only a pickaxe will take it lower.'$tx6o$, ''))) / length($tx6o$'That corner is bare rock. Only a pickaxe will take it lower.'$tx6o$);
  if n <> 1 then raise exception 'act_refusal_rules: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That corner is bare rock. Only a pickaxe will take it lower.'$tx6o$, $tx6n$'Corner is bare rock: needs a pickaxe.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That wants a Terraformer who has learned to dig out a whole tile.'$tx6o$, ''))) / length($tx6o$'That wants a Terraformer who has learned to dig out a whole tile.'$tx6o$);
  if n <> 1 then raise exception 'act_refusal_rules: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That wants a Terraformer who has learned to dig out a whole tile.'$tx6o$, $tx6n$'Needs perk: Dig Out the Tile (Terraformer).'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A corner of it is bare rock. Only a pickaxe will take that lower.'$tx6o$, ''))) / length($tx6o$'A corner of it is bare rock. Only a pickaxe will take that lower.'$tx6o$);
  if n <> 1 then raise exception 'act_refusal_rules: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A corner of it is bare rock. Only a pickaxe will take that lower.'$tx6o$, $tx6n$'A corner is bare rock: needs a pickaxe.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That wants a Miner who has learned to pan.'$tx6o$, ''))) / length($tx6o$'That wants a Miner who has learned to pan.'$tx6o$);
  if n <> 1 then raise exception 'act_refusal_rules: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That wants a Miner who has learned to pan.'$tx6o$, $tx6n$'Needs perk: Pan (Miner).'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Panning is done on sand.'$tx6o$, ''))) / length($tx6o$'Panning is done on sand.'$tx6o$);
  if n <> 1 then raise exception 'act_refusal_rules: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Panning is done on sand.'$tx6o$, $tx6n$'Needs sand.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no water at this sand to wash it in.'$tx6o$, ''))) / length($tx6o$'There is no water at this sand to wash it in.'$tx6o$);
  if n <> 1 then raise exception 'act_refusal_rules: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no water at this sand to wash it in.'$tx6o$, $tx6n$'Needs water at a corner of the sand.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'An aqueduct is carried over that tile.'$tx6o$, ''))) / length($tx6o$'An aqueduct is carried over that tile.'$tx6o$);
  if n <> 1 then raise exception 'act_refusal_rules: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'An aqueduct is carried over that tile.'$tx6o$, $tx6n$'Aqueduct over that tile.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You need a ' || lower((select coalesce(name, d.tool) from item_def where id = d.tool)) || ' to ' || lower(d.label) || '.';$tx6o$, ''))) / length($tx6o$return 'You need a ' || lower((select coalesce(name, d.tool) from item_def where id = d.tool)) || ' to ' || lower(d.label) || '.';$tx6o$);
  if n <> 2 then raise exception 'act_refusal_rules: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$return 'You need a ' || lower((select coalesce(name, d.tool) from item_def where id = d.tool)) || ' to ' || lower(d.label) || '.';$tx6o$, $tx6n$return 'Need a ' || lower((select coalesce(name, d.tool) from item_def where id = d.tool)) || '.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('terrain_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'The water is too deep here to work in.'$tx6o$, ''))) / length($tx6o$'The water is too deep here to work in.'$tx6o$);
  if n <> 1 then raise exception 'terrain_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The water is too deep here to work in.'$tx6o$, $tx6n$'Water too deep.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need a stone brick to lay cobblestone.'$tx6o$, ''))) / length($tx6o$'You need a stone brick to lay cobblestone.'$tx6o$);
  if n <> 1 then raise exception 'terrain_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need a stone brick to lay cobblestone.'$tx6o$, $tx6n$'Need a stone brick.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return r.name || ' needs mining ' || rtrim(rtrim(to_char(v_needs, 'FM990.99'), '0'), '.')
          || ' to work. Yours is ' || to_char(mining, 'FM990.0') || '.';$tx6o$, ''))) / length($tx6o$return r.name || ' needs mining ' || rtrim(rtrim(to_char(v_needs, 'FM990.99'), '0'), '.')
          || ' to work. Yours is ' || to_char(mining, 'FM990.0') || '.';$tx6o$);
  if n <> 1 then raise exception 'terrain_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return r.name || ' needs mining ' || rtrim(rtrim(to_char(v_needs, 'FM990.99'), '0'), '.')
          || ' to work. Yours is ' || to_char(mining, 'FM990.0') || '.';$tx6o$, $tx6n$return r.name || ': needs mining ' || rtrim(rtrim(to_char(v_needs, 'FM990.99'), '0'), '.')
          || '; have ' || to_char(mining, 'FM990.0') || '.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_dig_tile(uuid,uuid,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You fail to dig anything useful.'$tx6o$, ''))) / length($tx6o$'You fail to dig anything useful.'$tx6o$);
  if n <> 1 then raise exception 'perform_dig_tile: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You fail to dig anything useful.'$tx6o$, $tx6n$'Dig failed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You dig the whole tile down and come away with ' || corners_per_tile()::int || ' × '
    || lower((select name from item_def where id = v_yield)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You dig the whole tile down and come away with ' || corners_per_tile()::int || ' × '
    || lower((select name from item_def where id = v_yield)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_dig_tile: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You dig the whole tile down and come away with ' || corners_per_tile()::int || ' × '
    || lower((select name from item_def where id = v_yield)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Dug whole tile: ' || corners_per_tile()::int || ' × '
    || lower((select name from item_def where id = v_yield)) || ', QL ' || to_char(v_ql, 'FM990.0') || '.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_cellar(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You fail to dig anything useful.'$tx6o$, ''))) / length($tx6o$'You fail to dig anything useful.'$tx6o$);
  if n <> 1 then raise exception 'perform_cellar: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You fail to dig anything useful.'$tx6o$, $tx6n$'Dig failed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The rock is hard and you fail to loosen anything.'$tx6o$, ''))) / length($tx6o$'The rock is hard and you fail to loosen anything.'$tx6o$);
  if n <> 1 then raise exception 'perform_cellar: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The rock is hard and you fail to loosen anything.'$tx6o$, $tx6n$'Mining failed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is nothing lying about here.'$tx6o$, ''))) / length($tx6o$'There is nothing lying about here.'$tx6o$);
  if n <> 1 then raise exception 'perform_cellar: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is nothing lying about here.'$tx6o$, $tx6n$'Nothing here to pick up.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You gather up ' || pile_text(v_took) || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You gather up ' || pile_text(v_took) || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_cellar: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You gather up ' || pile_text(v_took) || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Picked up: ' || pile_text(v_took) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You drop '
      || case when v_want > 1 then v_want || ' × ' || lower(item_name(it)) else 'the ' || lower(item_name(it)) end
      || ' on the cellar floor.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You drop '
      || case when v_want > 1 then v_want || ' × ' || lower(item_name(it)) else 'the ' || lower(item_name(it)) end
      || ' on the cellar floor.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_cellar: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You drop '
      || case when v_want > 1 then v_want || ' × ' || lower(item_name(it)) else 'the ' || lower(item_name(it)) end
      || ' on the cellar floor.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Dropped: '
      || case when v_want > 1 then v_want || ' × ' || lower(item_name(it)) else lower(item_name(it)) end
      || ', on the cellar floor.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You pick up ' ||
      case when it.count > 1$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You pick up ' ||
      case when it.count > 1$tx6o$);
  if n <> 1 then raise exception 'perform_cellar: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You pick up ' ||
      case when it.count > 1$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Picked up: ' ||
      case when it.count > 1$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You dig out some dirt from under the ground floor: ' || v_dug || ' of '
      || cellar_depth()::int || ' down. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You dig out some dirt from under the ground floor: ' || v_dug || ' of '
      || cellar_depth()::int || ' down. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_cellar: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You dig out some dirt from under the ground floor: ' || v_dug || ' of '
      || cellar_depth()::int || ' down. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Dug: dirt, QL ' || to_char(made_ql, 'FM990.0') || '. Cellar ' || v_dug || '/'
      || cellar_depth()::int || ' down.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The cellar is dug out here, the whole ' || cellar_depth()::int || ' down.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The cellar is dug out here, the whole ' || cellar_depth()::int || ' down.', 'event');$tx6o$);
  if n <> 2 then raise exception 'perform_cellar: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The cellar is dug out here, the whole ' || cellar_depth()::int || ' down.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Cellar fully dug: ' || cellar_depth()::int || ' down.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'Your shovel grates on rock ' || v_dug || ' down. The rest is for a pickaxe.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'Your shovel grates on rock ' || v_dug || ' down. The rest is for a pickaxe.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_cellar: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'Your shovel grates on rock ' || v_dug || ' down. The rest is for a pickaxe.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Rock at ' || v_dug || ' down: use a pickaxe.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You cut some ' || lower((select coalesce(name, r.yields) from item_def where id = r.yields))
      || ' out of the rock under the ground floor: ' || v_dug || ' of ' || cellar_depth()::int
      || ' down. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You cut some ' || lower((select coalesce(name, r.yields) from item_def where id = r.yields))
      || ' out of the rock under the ground floor: ' || v_dug || ' of ' || cellar_depth()::int
      || ' down. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_cellar: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You cut some ' || lower((select coalesce(name, r.yields) from item_def where id = r.yields))
      || ' out of the rock under the ground floor: ' || v_dug || ' of ' || cellar_depth()::int
      || ' down. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Mined: ' || lower((select coalesce(name, r.yields) from item_def where id = r.yields))
      || ', QL ' || to_char(made_ql, 'FM990.0') || '. Cellar ' || v_dug || '/' || cellar_depth()::int
      || ' down.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You pack the last of the ' || lower((select name from item_def where id = v_def))
        || ' in, and the ground under the floor here is whole again.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You pack the last of the ' || lower((select name from item_def where id = v_def))
        || ' in, and the ground under the floor here is whole again.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_cellar: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You pack the last of the ' || lower((select name from item_def where id = v_def))
        || ' in, and the ground under the floor here is whole again.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Filled in: ' || lower((select name from item_def where id = v_def))
        || '. Cellar gone from this tile.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You pack ' || lower((select name from item_def where id = v_def))
        || ' back in under the ground floor: ' || v_dug || ' of ' || cellar_depth()::int || ' down.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You pack ' || lower((select name from item_def where id = v_def))
        || ' back in under the ground floor: ' || v_dug || ' of ' || cellar_depth()::int || ' down.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_cellar: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You pack ' || lower((select name from item_def where id = v_def))
        || ' back in under the ground floor: ' || v_dug || ' of ' || cellar_depth()::int || ' down.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Filled in: ' || lower((select name from item_def where id = v_def))
        || '. Cellar ' || v_dug || '/' || cellar_depth()::int || ' down.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('act_perform(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You fail to dig anything useful.'$tx6o$, ''))) / length($tx6o$'You fail to dig anything useful.'$tx6o$);
  if n <> 1 then raise exception 'act_perform: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You fail to dig anything useful.'$tx6o$, $tx6n$'Dig failed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Your shovel grates on bare rock.'$tx6o$, ''))) / length($tx6o$'Your shovel grates on bare rock.'$tx6o$);
  if n <> 1 then raise exception 'act_perform: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Your shovel grates on bare rock.'$tx6o$, $tx6n$'Bare rock.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You dig up some ' || lower((select name from item_def where id = yield)) ||
      '. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$'You dig up some ' || lower((select name from item_def where id = yield)) ||
      '. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'act_perform: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You dig up some ' || lower((select name from item_def where id = yield)) ||
      '. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$'Dug: ' || lower((select name from item_def where id = yield)) ||
      ', QL ' || to_char(made_ql, 'FM990.0') || '.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('examine_tile_text(uuid,integer,integer,uuid)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$v_out := 'You see ' || an(lower(coalesce(v_age.name, 'young'))$tx6o$, ''))) / length($tx6o$v_out := 'You see ' || an(lower(coalesce(v_age.name, 'young'))$tx6o$);
  if n <> 1 then raise exception 'examine_tile_text: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_out := 'You see ' || an(lower(coalesce(v_age.name, 'young'))$tx6o$, $tx6n$v_out := 'Tree: ' || (lower(coalesce(v_age.name, 'young'))$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$|| ' ' || lower((select name from tree_def where id = tree_species(v_data))) || ' tree')$tx6o$, ''))) / length($tx6o$|| ' ' || lower((select name from tree_def where id = tree_species(v_data))) || ' tree')$tx6o$);
  if n <> 1 then raise exception 'examine_tile_text: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$|| ' ' || lower((select name from tree_def where id = tree_species(v_data))) || ' tree')$tx6o$, $tx6n$|| ' ' || lower((select name from tree_def where id = tree_species(v_data))))$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_out := v_out || ' It has ' || tree_cuts(p_world, p_x, p_y) || ' of ' || tree_hits(p_world, p_uid, v_age.hits)
        || ' strokes in it.';$tx6o$, ''))) / length($tx6o$v_out := v_out || ' It has ' || tree_cuts(p_world, p_x, p_y) || ' of ' || tree_hits(p_world, p_uid, v_age.hits)
        || ' strokes in it.';$tx6o$);
  if n <> 1 then raise exception 'examine_tile_text: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_out := v_out || ' It has ' || tree_cuts(p_world, p_x, p_y) || ' of ' || tree_hits(p_world, p_uid, v_age.hits)
        || ' strokes in it.';$tx6o$, $tx6n$v_out := v_out || ' Cuts: ' || tree_cuts(p_world, p_x, p_y) || '/' || tree_hits(p_world, p_uid, v_age.hits)
        || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_out := 'You see a ' || lower((select name from bush_def where id = bush_species(v_data)))$tx6o$, ''))) / length($tx6o$v_out := 'You see a ' || lower((select name from bush_def where id = bush_species(v_data)))$tx6o$);
  if n <> 1 then raise exception 'examine_tile_text: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_out := 'You see a ' || lower((select name from bush_def where id = bush_species(v_data)))$tx6o$, $tx6n$v_out := (select name from bush_def where id = bush_species(v_data))$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_out := 'You see the stump of ' || an(lower((select name from tree_def where id = tree_species(v_data))))
      || ' at (' || p_x || ', ' || p_y || '). Dig it out, or leave it a day.';$tx6o$, ''))) / length($tx6o$v_out := 'You see the stump of ' || an(lower((select name from tree_def where id = tree_species(v_data))))
      || ' at (' || p_x || ', ' || p_y || '). Dig it out, or leave it a day.';$tx6o$);
  if n <> 1 then raise exception 'examine_tile_text: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_out := 'You see the stump of ' || an(lower((select name from tree_def where id = tree_species(v_data))))
      || ' at (' || p_x || ', ' || p_y || '). Dig it out, or leave it a day.';$tx6o$, $tx6n$v_out := (select name from tree_def where id = tree_species(v_data)) || ' stump'
      || ' at (' || p_x || ', ' || p_y || '). Dig out, or grass at next dawn.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_out := 'You see ' || lower((select name from tile_def where id = v_t))$tx6o$, ''))) / length($tx6o$v_out := 'You see ' || lower((select name from tile_def where id = v_t))$tx6o$);
  if n <> 1 then raise exception 'examine_tile_text: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_out := 'You see ' || lower((select name from tile_def where id = v_t))$tx6o$, $tx6n$v_out := (select name from tile_def where id = v_t)$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_out := v_out || ' Kept cut: ' || ((v_data & 3) + case when (v_data & 4) <> 0 then 1 else 0 end) || ' of 3 days towards lawn.';$tx6o$, ''))) / length($tx6o$v_out := v_out || ' Kept cut: ' || ((v_data & 3) + case when (v_data & 4) <> 0 then 1 else 0 end) || ' of 3 days towards lawn.';$tx6o$);
  if n <> 1 then raise exception 'examine_tile_text: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_out := v_out || ' Kept cut: ' || ((v_data & 3) + case when (v_data & 4) <> 0 then 1 else 0 end) || ' of 3 days towards lawn.';$tx6o$, $tx6n$v_out := v_out || ' Mown: ' || ((v_data & 3) + case when (v_data & 4) <> 0 then 1 else 0 end) || '/3 days to lawn.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_out := v_out || ' Water laps over it.' || fish_journal(p_world, p_uid, p_x, p_y);$tx6o$, ''))) / length($tx6o$v_out := v_out || ' Water laps over it.' || fish_journal(p_world, p_uid, p_x, p_y);$tx6o$);
  if n <> 1 then raise exception 'examine_tile_text: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_out := v_out || ' Water laps over it.' || fish_journal(p_world, p_uid, p_x, p_y);$tx6o$, $tx6n$v_out := v_out || ' Under water.' || fish_journal(p_world, p_uid, p_x, p_y);$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_extra := v_extra || ' The settlement token of '
      || (deed_at(p_world, p_x, p_y)).name || ' stands here.';$tx6o$, ''))) / length($tx6o$v_extra := v_extra || ' The settlement token of '
      || (deed_at(p_world, p_x, p_y)).name || ' stands here.';$tx6o$);
  if n <> 1 then raise exception 'examine_tile_text: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_extra := v_extra || ' The settlement token of '
      || (deed_at(p_world, p_x, p_y)).name || ' stands here.';$tx6o$, $tx6n$v_extra := v_extra || ' Settlement token: '
      || (deed_at(p_world, p_x, p_y)).name || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_extra := v_extra || ' This is part of ' || (deed_at(p_world, p_x, p_y)).name || '.';$tx6o$, ''))) / length($tx6o$v_extra := v_extra || ' This is part of ' || (deed_at(p_world, p_x, p_y)).name || '.';$tx6o$);
  if n <> 1 then raise exception 'examine_tile_text: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_extra := v_extra || ' This is part of ' || (deed_at(p_world, p_x, p_y)).name || '.';$tx6o$, $tx6n$v_extra := v_extra || ' Settlement: ' || (deed_at(p_world, p_x, p_y)).name || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_extra := v_extra || ' It belongs to ' || b.name || ', '
        || case when b.levels = 1 then 'a single-storey building'
                else b.levels || ' storeys tall' end || '.';$tx6o$, ''))) / length($tx6o$v_extra := v_extra || ' It belongs to ' || b.name || ', '
        || case when b.levels = 1 then 'a single-storey building'
                else b.levels || ' storeys tall' end || '.';$tx6o$);
  if n <> 1 then raise exception 'examine_tile_text: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_extra := v_extra || ' It belongs to ' || b.name || ', '
        || case when b.levels = 1 then 'a single-storey building'
                else b.levels || ' storeys tall' end || '.';$tx6o$, $tx6n$v_extra := v_extra || ' Building: ' || b.name || ', '
        || case when b.levels = 1 then '1 storey'
                else b.levels || ' storeys' end || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$if n = 1 then v_extra := v_extra || ' A crate stands here.';
  elsif n > 1 then v_extra := v_extra || ' ' || n || ' crates stand here.'; end if;$tx6o$, ''))) / length($tx6o$if n = 1 then v_extra := v_extra || ' A crate stands here.';
  elsif n > 1 then v_extra := v_extra || ' ' || n || ' crates stand here.'; end if;$tx6o$);
  if n <> 1 then raise exception 'examine_tile_text: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$if n = 1 then v_extra := v_extra || ' A crate stands here.';
  elsif n > 1 then v_extra := v_extra || ' ' || n || ' crates stand here.'; end if;$tx6o$, $tx6n$if n >= 1 then v_extra := v_extra || ' Crates: ' || n || '.'; end if;$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('cellar_said(uuid,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$then ' A cellar is dug out under it, ' || cellar_depth()::int || ' deep.'$tx6o$, ''))) / length($tx6o$then ' A cellar is dug out under it, ' || cellar_depth()::int || ' deep.'$tx6o$);
  if n <> 1 then raise exception 'cellar_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then ' A cellar is dug out under it, ' || cellar_depth()::int || ' deep.'$tx6o$, $tx6n$then ' Cellar under it: ' || cellar_depth()::int || ' deep.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$else ' The ground under it is dug out ' || c.dug || ' of ' || cellar_depth()::int
                                    || ' down, for a cellar.' end$tx6o$, ''))) / length($tx6o$else ' The ground under it is dug out ' || c.dug || ' of ' || cellar_depth()::int
                                    || ' down, for a cellar.' end$tx6o$);
  if n <> 1 then raise exception 'cellar_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$else ' The ground under it is dug out ' || c.dug || ' of ' || cellar_depth()::int
                                    || ' down, for a cellar.' end$tx6o$, $tx6n$else ' Cellar under it: dug ' || c.dug || '/' || cellar_depth()::int
                                    || '.' end$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('taste_says(uuid,item)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$then 'fills ' || whole_pct(d.food::double precision * (0.7 + it.ql::double precision / 200) * mark_of(it.mark, 'fill'))
         || ' of the food bar'$tx6o$, ''))) / length($tx6o$then 'fills ' || whole_pct(d.food::double precision * (0.7 + it.ql::double precision / 200) * mark_of(it.mark, 'fill'))
         || ' of the food bar'$tx6o$);
  if n <> 1 then raise exception 'taste_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then 'fills ' || whole_pct(d.food::double precision * (0.7 + it.ql::double precision / 200) * mark_of(it.mark, 'fill'))
         || ' of the food bar'$tx6o$, $tx6n$then 'food bar +' || whole_pct(d.food::double precision * (0.7 + it.ql::double precision / 200) * mark_of(it.mark, 'fill'))$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$else 'quenches ' || whole_pct(coalesce(d.drink, 0)::double precision) || ' of the thirst bar' end;$tx6o$, ''))) / length($tx6o$else 'quenches ' || whole_pct(coalesce(d.drink, 0)::double precision) || ' of the thirst bar' end;$tx6o$);
  if n <> 1 then raise exception 'taste_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$else 'quenches ' || whole_pct(coalesce(d.drink, 0)::double precision) || ' of the thirst bar' end;$tx6o$, $tx6n$else 'thirst bar +' || whole_pct(coalesce(d.drink, 0)::double precision) end;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$select array_agg(f.nutrient || ' ' || whole_pct($tx6o$, ''))) / length($tx6o$select array_agg(f.nutrient || ' ' || whole_pct($tx6o$);
  if n <> 1 then raise exception 'taste_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select array_agg(f.nutrient || ' ' || whole_pct($tx6o$, $tx6n$select array_agg(f.nutrient || ' +' || whole_pct($tx6n$);
  n := (length(v) - length(replace(v, $tx6o$if v_feeds is not null then v_said := v_said || ('feeds ' || list_of(v_feeds)); end if;$tx6o$, ''))) / length($tx6o$if v_feeds is not null then v_said := v_said || ('feeds ' || list_of(v_feeds)); end if;$tx6o$);
  if n <> 1 then raise exception 'taste_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$if v_feeds is not null then v_said := v_said || ('feeds ' || list_of(v_feeds)); end if;$tx6o$, $tx6n$if v_feeds is not null then v_said := v_said || v_feeds; end if;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_said := v_said || ('gives a knack that lasts ' || clock_left($tx6o$, ''))) / length($tx6o$v_said := v_said || ('gives a knack that lasts ' || clock_left($tx6o$);
  if n <> 1 then raise exception 'taste_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_said := v_said || ('gives a knack that lasts ' || clock_left($tx6o$, $tx6n$v_said := v_said || ('knack ' || clock_left($tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return ' To your taste, a helping ' || list_of(v_said) || '.';$tx6o$, ''))) / length($tx6o$return ' To your taste, a helping ' || list_of(v_said) || '.';$tx6o$);
  if n <> 1 then raise exception 'taste_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return ' To your taste, a helping ' || list_of(v_said) || '.';$tx6o$, $tx6n$return ' Per helping: ' || array_to_string(v_said, ', ') || '.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('draw_dye(uuid,uuid,placed,item)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You draw ' || litres_word(v_n) || ' of dye out of the '$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You draw ' || litres_word(v_n) || ' of dye out of the '$tx6o$);
  if n <> 1 then raise exception 'draw_dye: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You draw ' || litres_word(v_n) || ' of dye out of the '$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Drew ' || litres_word(v_n) || ' of dye from the '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$|| '. The bucket holds ' || dye_says(v_mixed, v_total), 'event');$tx6o$, ''))) / length($tx6o$|| '. The bucket holds ' || dye_says(v_mixed, v_total), 'event');$tx6o$);
  if n <> 1 then raise exception 'draw_dye: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$|| '. The bucket holds ' || dye_says(v_mixed, v_total), 'event');$tx6o$, $tx6n$|| '. Bucket: ' || dye_says(v_mixed, v_total), 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_gather(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'Your shovel comes up with nothing but a smear of '
        || lower(t.name) || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'Your shovel comes up with nothing but a smear of '
        || lower(t.name) || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_gather: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'Your shovel comes up with nothing but a smear of '
        || lower(t.name) || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Collect failed: '
        || lower(t.name) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You fill a shovel with '$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You fill a shovel with '$tx6o$);
  if n <> 1 then raise exception 'perform_gather: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You fill a shovel with '$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Collected: '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$|| ' off the top of the bed. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$|| ' off the top of the bed. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_gather: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$|| ' off the top of the bed. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$|| ', QL ' || to_char(made_ql, 'FM990.0') || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is nothing standing here to cut down.'$tx6o$, ''))) / length($tx6o$'There is nothing standing here to cut down.'$tx6o$);
  if n <> 1 then raise exception 'perform_gather: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is nothing standing here to cut down.'$tx6o$, $tx6n$'No tree or bush here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Your hatchet glances off and you fail to make headway.'$tx6o$, ''))) / length($tx6o$'Your hatchet glances off and you fail to make headway.'$tx6o$);
  if n <> 1 then raise exception 'perform_gather: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Your hatchet glances off and you fail to make headway.'$tx6o$, $tx6n$'Cut failed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You hack the bush down.'$tx6o$, ''))) / length($tx6o$'You hack the bush down.'$tx6o$);
  if n <> 1 then raise exception 'perform_gather: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You hack the bush down.'$tx6o$, $tx6n$'Bush cut down.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You cut into the ' || lower(v_age.name) || ' '
          || lower(tree.name) || '. ' || (v_hits - v_cuts)
          || ' more like that and it comes down.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You cut into the ' || lower(v_age.name) || ' '
          || lower(tree.name) || '. ' || (v_hits - v_cuts)
          || ' more like that and it comes down.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_gather: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You cut into the ' || lower(v_age.name) || ' '
          || lower(tree.name) || '. ' || (v_hits - v_cuts)
          || ' more like that and it comes down.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Cut ' || lower(v_age.name) || ' '
          || lower(tree.name) || ': ' || (v_hits - v_cuts)
          || ' more to fell.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You clear the ' || lower(v_age.name) || ' '
            || lower(tree.name) || ' away. There is no timber in one that size.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You clear the ' || lower(v_age.name) || ' '
            || lower(tree.name) || ' away. There is no timber in one that size.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_gather: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You clear the ' || lower(v_age.name) || ' '
            || lower(tree.name) || ' away. There is no timber in one that size.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Cleared ' || lower(v_age.name) || ' '
            || lower(tree.name) || ': no logs at this age.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The ' || lower(v_age.name) || ' ' || lower(tree.name)
            || ' comes down. You get ' || logs || coalesce(' ' || v_rare, '')
            || case when logs = 1 then ' log' else ' logs' end || '. (QL ' || to_char(made_ql, 'FM990.0') || ')'
            || case when pk(p_world, p_uid, 'stump:clear', 0) > 0 then ' The ground is clear where it stood.'
                    else ' The stump is left.' end, 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The ' || lower(v_age.name) || ' ' || lower(tree.name)
            || ' comes down. You get ' || logs || coalesce(' ' || v_rare, '')
            || case when logs = 1 then ' log' else ' logs' end || '. (QL ' || to_char(made_ql, 'FM990.0') || ')'
            || case when pk(p_world, p_uid, 'stump:clear', 0) > 0 then ' The ground is clear where it stood.'
                    else ' The stump is left.' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_gather: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The ' || lower(v_age.name) || ' ' || lower(tree.name)
            || ' comes down. You get ' || logs || coalesce(' ' || v_rare, '')
            || case when logs = 1 then ' log' else ' logs' end || '. (QL ' || to_char(made_ql, 'FM990.0') || ')'
            || case when pk(p_world, p_uid, 'stump:clear', 0) > 0 then ' The ground is clear where it stood.'
                    else ' The stump is left.' end, 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Felled ' || lower(v_age.name) || ' ' || lower(tree.name)
            || ': ' || logs || coalesce(' ' || v_rare, '')
            || case when logs = 1 then ' log' else ' logs' end || ', QL ' || to_char(made_ql, 'FM990.0') || '.'
            || case when pk(p_world, p_uid, 'stump:clear', 0) > 0 then ' No stump.'
                    else ' Stump left.' end, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You find nothing edible.'$tx6o$, ''))) / length($tx6o$'You find nothing edible.'$tx6o$);
  if n <> 1 then raise exception 'perform_gather: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You find nothing edible.'$tx6o$, $tx6n$'Found nothing.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You find nothing of interest.'$tx6o$, ''))) / length($tx6o$'You find nothing of interest.'$tx6o$);
  if n <> 1 then raise exception 'perform_gather: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You find nothing of interest.'$tx6o$, $tx6n$'Found nothing.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'Something glints in the grass: a gold coin. (QL '
          || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'Something glints in the grass: a gold coin. (QL '
          || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_gather: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'Something glints in the grass: a gold coin. (QL '
          || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Found: gold coin, QL '
          || to_char(made_ql, 'FM990.0') || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You find some ' || list_of(found) || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You find some ' || list_of(found) || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_gather: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You find some ' || list_of(found) || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Found: ' || list_of(found) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You trim ' || number_word(v_n) || ' straight '
          || case when v_n = 1 then 'shaft' else 'shafts' end || ' out of it. (QL '
          || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You trim ' || number_word(v_n) || ' straight '
          || case when v_n = 1 then 'shaft' else 'shafts' end || ' out of it. (QL '
          || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_gather: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You trim ' || number_word(v_n) || ' straight '
          || case when v_n = 1 then 'shaft' else 'shafts' end || ' out of it. (QL '
          || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Kindling: ' || v_n || ' '
          || case when v_n = 1 then 'shaft' else 'shafts' end || ', QL '
          || to_char(made_ql, 'FM990.0') || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'A nest comes down with it: ' || number_word(v_n) || ' '
              || lower((select name from item_def where id = 'feather')) || '. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'A nest comes down with it: ' || number_word(v_n) || ' '
              || lower((select name from item_def where id = 'feather')) || '. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_gather: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'A nest comes down with it: ' || number_word(v_n) || ' '
              || lower((select name from item_def where id = 'feather')) || '. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Nest: ' || v_n || ' '
              || lower((select name from item_def where id = 'feather')) || ', QL ' || to_char(made_ql, 'FM990.0') || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'A wild hive in the trunk gives up ' || number_word(v_n) || ' '
              || lower((select name from item_def where id = 'honey')) || '. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'A wild hive in the trunk gives up ' || number_word(v_n) || ' '
              || lower((select name from item_def where id = 'honey')) || '. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_gather: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'A wild hive in the trunk gives up ' || number_word(v_n) || ' '
              || lower((select name from item_def where id = 'honey')) || '. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Wild hive: ' || v_n || ' '
              || lower((select name from item_def where id = 'honey')) || ', QL ' || to_char(made_ql, 'FM990.0') || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then 'You go over the ground ' || passes || ' times and find nothing'
             || case when p_action = 'forage' then ' edible.' else ' of interest.' end
        else case when p_action = 'forage' then 'Found nothing.' else 'Found nothing.' end$tx6o$, ''))) / length($tx6o$then 'You go over the ground ' || passes || ' times and find nothing'
             || case when p_action = 'forage' then ' edible.' else ' of interest.' end
        else case when p_action = 'forage' then 'Found nothing.' else 'Found nothing.' end$tx6o$);
  if n <> 1 then raise exception 'perform_gather: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then 'You go over the ground ' || passes || ' times and find nothing'
             || case when p_action = 'forage' then ' edible.' else ' of interest.' end
        else case when p_action = 'forage' then 'Found nothing.' else 'Found nothing.' end$tx6o$, $tx6n$then 'Found nothing (' || passes || ' passes).'
        else 'Found nothing.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_farm(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You plant ' || moss_plant() || ' moss and the dirt is moss now.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You plant ' || moss_plant() || ' moss and the dirt is moss now.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_farm: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You plant ' || moss_plant() || ' moss and the dirt is moss now.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Planted: ' || moss_plant() || ' moss. Tile: moss.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You plant ' || grass_plant() || ' mixed grass and the dirt is grass now.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You plant ' || grass_plant() || ' mixed grass and the dirt is grass now.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_farm: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You plant ' || grass_plant() || ' mixed grass and the dirt is grass now.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Planted: ' || grass_plant() || ' mixed grass. Tile: grass.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You rake the ground into a field, ready for sowing.'$tx6o$, ''))) / length($tx6o$'You rake the ground into a field, ready for sowing.'$tx6o$);
  if n <> 1 then raise exception 'perform_farm: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You rake the ground into a field, ready for sowing.'$tx6o$, $tx6n$'Tilled: field ready to sow.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$|| case when v_how = 'kept' then ' It cost you no seed.' else '' end, 'event');$tx6o$, ''))) / length($tx6o$|| case when v_how = 'kept' then ' It cost you no seed.' else '' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_farm: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$|| case when v_how = 'kept' then ' It cost you no seed.' else '' end, 'event');$tx6o$, $tx6n$|| case when v_how = 'kept' then ' Seed kept.' else '' end, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You weed and water the ' || lower(cd.name) || '. It should give '
      || yld[2] || ' ' || lower((select coalesce(name, cd.produce) from item_def where id = cd.produce))
      || ' and ' || yld[1] || ' seed'$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You weed and water the ' || lower(cd.name) || '. It should give '
      || yld[2] || ' ' || lower((select coalesce(name, cd.produce) from item_def where id = cd.produce))
      || ' and ' || yld[1] || ' seed'$tx6o$);
  if n <> 1 then raise exception 'perform_farm: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You weed and water the ' || lower(cd.name) || '. It should give '
      || yld[2] || ' ' || lower((select coalesce(name, cd.produce) from item_def where id = cd.produce))
      || ' and ' || yld[1] || ' seed'$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Tended: ' || lower(cd.name) || '. Expected yield: '
      || yld[2] || ' ' || lower((select coalesce(name, cd.produce) from item_def where id = cd.produce))
      || ', ' || yld[1] || ' seed'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You harvest ' || r.o_got || ' × ' || coalesce(r.o_rare || ' ', '')
      || lower((select coalesce(name, r.o_produce) from item_def where id = r.o_produce))
      || ' and ' || r.o_seeds || ' ' || lower((select coalesce(name, r.o_seed) from item_def where id = r.o_seed))
      || '. The field is ready to sow again. (QL ' || to_char(r.o_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You harvest ' || r.o_got || ' × ' || coalesce(r.o_rare || ' ', '')
      || lower((select coalesce(name, r.o_produce) from item_def where id = r.o_produce))
      || ' and ' || r.o_seeds || ' ' || lower((select coalesce(name, r.o_seed) from item_def where id = r.o_seed))
      || '. The field is ready to sow again. (QL ' || to_char(r.o_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_farm: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You harvest ' || r.o_got || ' × ' || coalesce(r.o_rare || ' ', '')
      || lower((select coalesce(name, r.o_produce) from item_def where id = r.o_produce))
      || ' and ' || r.o_seeds || ' ' || lower((select coalesce(name, r.o_seed) from item_def where id = r.o_seed))
      || '. The field is ready to sow again. (QL ' || to_char(r.o_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Harvested: ' || r.o_got || ' × ' || coalesce(r.o_rare || ' ', '')
      || lower((select coalesce(name, r.o_produce) from item_def where id = r.o_produce))
      || ', ' || r.o_seeds || ' ' || lower((select coalesce(name, r.o_seed) from item_def where id = r.o_seed))
      || ', QL ' || to_char(r.o_ql, 'FM990.0') || '. Field ready to sow.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then 'You turn the ' || lower(cd.name) || ' back into the soil' || case when v_packed then ' and pack the ground flat again' else '' end || '.'$tx6o$, ''))) / length($tx6o$then 'You turn the ' || lower(cd.name) || ' back into the soil' || case when v_packed then ' and pack the ground flat again' else '' end || '.'$tx6o$);
  if n <> 1 then raise exception 'perform_farm: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then 'You turn the ' || lower(cd.name) || ' back into the soil' || case when v_packed then ' and pack the ground flat again' else '' end || '.'$tx6o$, $tx6n$then 'Cleared: ' || lower(cd.name) || case when v_packed then '; ground packed' else '' end || '.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$else 'You break the field back up into plain dirt.' end, 'event');$tx6o$, ''))) / length($tx6o$else 'You break the field back up into plain dirt.' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_farm: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$else 'You break the field back up into plain dirt.' end, 'event');$tx6o$, $tx6n$else 'Field cleared: tile is dirt.' end, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You sow ' || v_n || case when v_n = 1 then ' field' else ' fields' end
      || ' with ' || lower(cd.name) || '.'$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You sow ' || v_n || case when v_n = 1 then ' field' else ' fields' end
      || ' with ' || lower(cd.name) || '.'$tx6o$);
  if n <> 1 then raise exception 'perform_farm: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You sow ' || v_n || case when v_n = 1 then ' field' else ' fields' end
      || ' with ' || lower(cd.name) || '.'$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Sown: ' || v_n || case when v_n = 1 then ' field' else ' fields' end
      || ' of ' || lower(cd.name) || '.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You weed and water ' || v_n || case when v_n = 1 then ' crop.' else ' crops.' end, 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You weed and water ' || v_n || case when v_n = 1 then ' crop.' else ' crops.' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_farm: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You weed and water ' || v_n || case when v_n = 1 then ' crop.' else ' crops.' end, 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Tended: ' || v_n || case when v_n = 1 then ' crop.' else ' crops.' end, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You harvest ' || v_n || case when v_n = 1 then ' field: ' else ' fields: ' end$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You harvest ' || v_n || case when v_n = 1 then ' field: ' else ' fields: ' end$tx6o$);
  if n <> 1 then raise exception 'perform_farm: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You harvest ' || v_n || case when v_n = 1 then ' field: ' else ' fields: ' end$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Harvested: ' || v_n || case when v_n = 1 then ' field: ' else ' fields: ' end$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$|| case when v_n = 1 then '. The field is' else '. The fields are' end || ' ready to sow again.', 'event');$tx6o$, ''))) / length($tx6o$|| case when v_n = 1 then '. The field is' else '. The fields are' end || ' ready to sow again.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_farm: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$|| case when v_n = 1 then '. The field is' else '. The fields are' end || ' ready to sow again.', 'event');$tx6o$, $tx6n$|| case when v_n = 1 then '. Field' else '. Fields' end || ' ready to sow.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$when v_kept = v_n then case when v_n = 1 then ' It' else ' They' end || ' cost you no seed.'
              else ' ' || v_kept || ' of them cost you no seed.' end, 'event');$tx6o$, ''))) / length($tx6o$when v_kept = v_n then case when v_n = 1 then ' It' else ' They' end || ' cost you no seed.'
              else ' ' || v_kept || ' of them cost you no seed.' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_farm: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$when v_kept = v_n then case when v_n = 1 then ' It' else ' They' end || ' cost you no seed.'
              else ' ' || v_kept || ' of them cost you no seed.' end, 'event');$tx6o$, $tx6n$else ' Seed kept: ' || v_kept || '.' end, 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('foundation_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You have no concrete.'$tx6o$, ''))) / length($tx6o$'You have no concrete.'$tx6o$);
  if n <> 1 then raise exception 'foundation_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You have no concrete.'$tx6o$, $tx6n$'Need concrete.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no shuttering here.'$tx6o$, ''))) / length($tx6o$'There is no shuttering here.'$tx6o$);
  if n <> 1 then raise exception 'foundation_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no shuttering here.'$tx6o$, $tx6n$'No shuttering here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It is poured.'$tx6o$, ''))) / length($tx6o$'It is poured.'$tx6o$);
  if n <> 1 then raise exception 'foundation_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is poured.'$tx6o$, $tx6n$'Already poured.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need a trowel to work concrete.'$tx6o$, ''))) / length($tx6o$'You need a trowel to work concrete.'$tx6o$);
  if n <> 2 then raise exception 'foundation_refusal: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'You need a trowel to work concrete.'$tx6o$, $tx6n$'Need a trowel.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need a pickaxe to break out a pool.'$tx6o$, ''))) / length($tx6o$'You need a pickaxe to break out a pool.'$tx6o$);
  if n <> 1 then raise exception 'foundation_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need a pickaxe to break out a pool.'$tx6o$, $tx6n$'Need a pickaxe.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no pool here.'$tx6o$, ''))) / length($tx6o$'There is no pool here.'$tx6o$);
  if n <> 1 then raise exception 'foundation_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no pool here.'$tx6o$, $tx6n$'No pool here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It is poured. That is a floor now, not a plan.'$tx6o$, ''))) / length($tx6o$'It is poured. That is a floor now, not a plan.'$tx6o$);
  if n <> 1 then raise exception 'foundation_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is poured. That is a floor now, not a plan.'$tx6o$, $tx6n$'Already poured: not a plan.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'Filling it in wants ' || pool_fill() || ' concrete, and you have ' || pack_count(p_world, p_uid, 'concrete') || '.';$tx6o$, ''))) / length($tx6o$return 'Filling it in wants ' || pool_fill() || ' concrete, and you have ' || pack_count(p_world, p_uid, 'concrete') || '.';$tx6o$);
  if n <> 1 then raise exception 'foundation_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'Filling it in wants ' || pool_fill() || ' concrete, and you have ' || pack_count(p_world, p_uid, 'concrete') || '.';$tx6o$, $tx6n$return 'Need ' || pool_fill() || ' concrete; have ' || pack_count(p_world, p_uid, 'concrete') || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That tile is already level. A foundation is for ground that is not.'$tx6o$, ''))) / length($tx6o$'That tile is already level. A foundation is for ground that is not.'$tx6o$);
  if n <> 1 then raise exception 'foundation_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That tile is already level. A foundation is for ground that is not.'$tx6o$, $tx6n$'Tile already level.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_terrain(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'The rock is hard and you fail to loosen anything.'$tx6o$, ''))) / length($tx6o$'The rock is hard and you fail to loosen anything.'$tx6o$);
  if n <> 1 then raise exception 'perform_terrain: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The rock is hard and you fail to loosen anything.'$tx6o$, $tx6n$'Mining failed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A slab breaks away of its own accord and the face drops.'$tx6o$, ''))) / length($tx6o$'A slab breaks away of its own accord and the face drops.'$tx6o$);
  if n <> 1 then raise exception 'perform_terrain: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A slab breaks away of its own accord and the face drops.'$tx6o$, $tx6n$'Face collapsed: corner lowered.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$case when v_n > 1 then 'You mine ' || v_n || ' × '
           when yields like '%lump' then 'You chip a ' else 'You mine some ' end$tx6o$, ''))) / length($tx6o$case when v_n > 1 then 'You mine ' || v_n || ' × '
           when yields like '%lump' then 'You chip a ' else 'You mine some ' end$tx6o$);
  if n <> 1 then raise exception 'perform_terrain: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$case when v_n > 1 then 'You mine ' || v_n || ' × '
           when yields like '%lump' then 'You chip a ' else 'You mine some ' end$tx6o$, $tx6n$case when v_n > 1 then 'Mined: ' || v_n || ' × ' else 'Mined: ' end$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$|| case when v_n > 1 then '.' when yields like '%lump' then ' out of the vein.' else '.' end
      || ' (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$|| case when v_n > 1 then '.' when yields like '%lump' then ' out of the vein.' else '.' end
      || ' (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_terrain: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$|| case when v_n > 1 then '.' when yields like '%lump' then ' out of the vein.' else '.' end
      || ' (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$|| ', QL ' || to_char(made_ql, 'FM990.0') || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You work at the corner and find no line in it. The face holds.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You work at the corner and find no line in it. The face holds.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_terrain: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You work at the corner and find no line in it. The face holds.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Cut failed.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You cut the turf away and tread the ground down firm.'$tx6o$, ''))) / length($tx6o$'You cut the turf away and tread the ground down firm.'$tx6o$);
  if n <> 1 then raise exception 'perform_terrain: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You cut the turf away and tread the ground down firm.'$tx6o$, $tx6n$'Turf cut; ground packed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You pack the dirt down firmly.'$tx6o$, ''))) / length($tx6o$'You pack the dirt down firmly.'$tx6o$);
  if n <> 1 then raise exception 'perform_terrain: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You pack the dirt down firmly.'$tx6o$, $tx6n$'Ground packed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You break up the packed earth.'$tx6o$, ''))) / length($tx6o$'You break up the packed earth.'$tx6o$);
  if n <> 1 then raise exception 'perform_terrain: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You break up the packed earth.'$tx6o$, $tx6n$'Cultivated: tile is dirt.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You lay the cobblestones.'$tx6o$, ''))) / length($tx6o$'You lay the cobblestones.'$tx6o$);
  if n <> 1 then raise exception 'perform_terrain: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You lay the cobblestones.'$tx6o$, $tx6n$'Cobblestones laid.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You drop the dirt at your feet, raising the ground.'$tx6o$, ''))) / length($tx6o$'You drop the dirt at your feet, raising the ground.'$tx6o$);
  if n <> 1 then raise exception 'perform_terrain: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You drop the dirt at your feet, raising the ground.'$tx6o$, $tx6n$'Dropped: dirt at your feet, corner raised.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The corner breaks away and drops '
      || case when v_step > 1 then v_step || ' steps' else 'a step' end || '. You gather the '
      || lower((select coalesce(name, yields) from item_def where id = yields))
      || '. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The corner breaks away and drops '
      || case when v_step > 1 then v_step || ' steps' else 'a step' end || '. You gather the '
      || lower((select coalesce(name, yields) from item_def where id = yields))
      || '. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_terrain: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The corner breaks away and drops '
      || case when v_step > 1 then v_step || ' steps' else 'a step' end || '. You gather the '
      || lower((select coalesce(name, yields) from item_def where id = yields))
      || '. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Cut: ' || corner_name(tx, ty, cx, cy) || ' corner lowered'
      || case when v_step > 1 then ' ' || v_step || ' steps' else '' end || '. Got '
      || lower((select coalesce(name, yields) from item_def where id = yields))
      || ', QL ' || to_char(made_ql, 'FM990.0') || '.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_pan(uuid,uuid,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You swirl the sand and water round the pan and find nothing in the bottom of it.'$tx6o$, ''))) / length($tx6o$'You swirl the sand and water round the pan and find nothing in the bottom of it.'$tx6o$);
  if n <> 1 then raise exception 'perform_pan: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You swirl the sand and water round the pan and find nothing in the bottom of it.'$tx6o$, $tx6n$'Panned: nothing.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'Something heavy settles in the bottom of the pan: '
    || lower((select name from item_def where id = v_ore)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'Something heavy settles in the bottom of the pan: '
    || lower((select name from item_def where id = v_ore)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_pan: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'Something heavy settles in the bottom of the pan: '
    || lower((select name from item_def where id = v_ore)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Panned: '
    || lower((select name from item_def where id = v_ore)) || ', QL ' || to_char(v_ql, 'FM990.0') || '.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_item(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You drink the cool water. It is refreshing.'$tx6o$, ''))) / length($tx6o$'You drink the cool water. It is refreshing.'$tx6o$);
  if n <> 1 then raise exception 'perform_item: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You drink the cool water. It is refreshing.'$tx6o$, $tx6n$'Drank water.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You eat the ' || v_name || '.'$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You eat the ' || v_name || '.'$tx6o$);
  if n <> 1 then raise exception 'perform_item: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You eat the ' || v_name || '.'$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Ate: ' || v_name || '.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The ' || v_name || ' is as sound as it will ever be again. (QL '
        || to_char(v_it.ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The ' || v_name || ' is as sound as it will ever be again. (QL '
        || to_char(v_it.ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_item: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The ' || v_name || ' is as sound as it will ever be again. (QL '
        || to_char(v_it.ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Fully repaired: ' || v_name || ', QL '
        || to_char(v_it.ql, 'FM990.0') || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You patch the ' || v_name || ' with ' || v_made || '. (damage '
      || to_char(greatest(0, v_it.dmg - v_healed), 'FM990.00') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You patch the ' || v_name || ' with ' || v_made || '. (damage '
      || to_char(greatest(0, v_it.dmg - v_healed), 'FM990.00') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_item: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You patch the ' || v_name || ' with ' || v_made || '. (damage '
      || to_char(greatest(0, v_it.dmg - v_healed), 'FM990.00') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Patched: ' || v_name || ', damage '
      || to_char(greatest(0, v_it.dmg - v_healed), 'FM990.00') || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You mend the ' || v_name || ' with a repair kit. (damage '
      || to_char(v_it.dmg, 'FM990.00') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You mend the ' || v_name || ' with a repair kit. (damage '
      || to_char(v_it.dmg, 'FM990.00') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_item: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You mend the ' || v_name || ' with a repair kit. (damage '
      || to_char(v_it.dmg, 'FM990.00') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Mended: ' || v_name || ', damage '
      || to_char(v_it.dmg, 'FM990.00') || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You work the sealant over the ' || lower(item_name(v_it)) || '. It will not decay now.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You work the sealant over the ' || lower(item_name(v_it)) || '. It will not decay now.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_item: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You work the sealant over the ' || lower(item_name(v_it)) || '. It will not decay now.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Sealed: ' || lower(item_name(v_it)) || '. No decay.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The ' || lower(v_gem) || ' will not seat, and you take it out again whole.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The ' || lower(v_gem) || ' will not seat, and you take it out again whole.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_item: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The ' || lower(v_gem) || ' will not seat, and you take it out again whole.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Setting failed: ' || lower(v_gem) || ' kept.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You seat the ' || lower(v_gem) || ' in the circlet and close the claws over it: '
      || coalesce(array_length(stones_of(v_circlet), 1), 0) || ' of its ' || circlet_stones() || ' settings are filled.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You seat the ' || lower(v_gem) || ' in the circlet and close the claws over it: '
      || coalesce(array_length(stones_of(v_circlet), 1), 0) || ' of its ' || circlet_stones() || ' settings are filled.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_item: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You seat the ' || lower(v_gem) || ' in the circlet and close the claws over it: '
      || coalesce(array_length(stones_of(v_circlet), 1), 0) || ' of its ' || circlet_stones() || ' settings are filled.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Set: ' || lower(v_gem) || '. Circlet '
      || coalesce(array_length(stones_of(v_circlet), 1), 0) || '/' || circlet_stones() || ' settings.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You brush an ash glaze over the ' || lower(item_name(v_it)) || ' and it takes. It will not decay now.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You brush an ash glaze over the ' || lower(item_name(v_it)) || ' and it takes. It will not decay now.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_item: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You brush an ash glaze over the ' || lower(item_name(v_it)) || ' and it takes. It will not decay now.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Glazed: ' || lower(item_name(v_it)) || '. No decay.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You take a drink from the ' || v_name || '.'$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You take a drink from the ' || v_name || '.'$tx6o$);
  if n <> 1 then raise exception 'perform_item: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You take a drink from the ' || v_name || '.'$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Drank: ' || v_name || '.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You work at the ' || v_name || ' and mark it. (damage '
        || to_char((select dmg from item where id = v_it.id), 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You work at the ' || v_name || ' and mark it. (damage '
        || to_char((select dmg from item where id = v_it.id), 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_item: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You work at the ' || v_name || ' and mark it. (damage '
        || to_char((select dmg from item where id = v_it.id), 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Improve failed: ' || v_name || ' damage '
        || to_char((select dmg from item where id = v_it.id), 'FM990.0') || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The ' || v_name || ' is better than it was. (QL '
      || to_char(v_it.ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The ' || v_name || ' is better than it was. (QL '
      || to_char(v_it.ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_item: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The ' || v_name || ' is better than it was. (QL '
      || to_char(v_it.ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Improved: ' || v_name || ', QL '
      || to_char(v_it.ql, 'FM990.0') || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You quench the ' || lower(item_name(v_it)) || ' and it comes out harder. (QL '
      || to_char(v_it.ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You quench the ' || lower(item_name(v_it)) || ' and it comes out harder. (QL '
      || to_char(v_it.ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_item: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You quench the ' || lower(item_name(v_it)) || ' and it comes out harder. (QL '
      || to_char(v_it.ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Quenched: ' || lower(item_name(v_it)) || ', QL '
      || to_char(v_it.ql, 'FM990.0') || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You drink the ' || v_name || '. It puts back ' || whole_pct(v_up)
      || ' of your stamina.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You drink the ' || v_name || '. It puts back ' || whole_pct(v_up)
      || ' of your stamina.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_item: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You drink the ' || v_name || '. It puts back ' || whole_pct(v_up)
      || ' of your stamina.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Drank: ' || v_name || '. Stamina +' || whole_pct(v_up)
      || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You take the tincture. ' || upper(left(v_said, 1)) || substr(v_said, 2)
      || ' each go in ' || whole_pct(tincture_bonus()) || ' faster for the next ' || clock_left(tincture_seconds()) || '.',$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You take the tincture. ' || upper(left(v_said, 1)) || substr(v_said, 2)
      || ' each go in ' || whole_pct(tincture_bonus()) || ' faster for the next ' || clock_left(tincture_seconds()) || '.',$tx6o$);
  if n <> 1 then raise exception 'perform_item: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You take the tincture. ' || upper(left(v_said, 1)) || substr(v_said, 2)
      || ' each go in ' || whole_pct(tincture_bonus()) || ' faster for the next ' || clock_left(tincture_seconds()) || '.',$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Tincture taken: ' || v_said
      || ' ' || whole_pct(tincture_bonus()) || ' faster for ' || clock_left(tincture_seconds()) || '.',$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You rub the salve into the '
      || (select name from wound_kind_def where id = v_hurt->>'kind') || ' on your ' || part_name(v_hurt->>'part')
      || '. It will not go bad under it.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You rub the salve into the '
      || (select name from wound_kind_def where id = v_hurt->>'kind') || ' on your ' || part_name(v_hurt->>'part')
      || '. It will not go bad under it.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_item: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You rub the salve into the '
      || (select name from wound_kind_def where id = v_hurt->>'kind') || ' on your ' || part_name(v_hurt->>'part')
      || '. It will not go bad under it.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Salved: '
      || (select name from wound_kind_def where id = v_hurt->>'kind') || ' on your ' || part_name(v_hurt->>'part')
      || '. It cannot go bad.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('holding_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'There is no bag with room for it.'$tx6o$, ''))) / length($tx6o$'There is no bag with room for it.'$tx6o$);
  if n <> 1 then raise exception 'holding_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no bag with room for it.'$tx6o$, $tx6n$'No bag with room.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no trash crate beside you.'$tx6o$, ''))) / length($tx6o$'There is no trash crate beside you.'$tx6o$);
  if n <> 1 then raise exception 'holding_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no trash crate beside you.'$tx6o$, $tx6n$'No trash crate beside you.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The trash crate is full. Wait for it to rot down.'$tx6o$, ''))) / length($tx6o$'The trash crate is full. Wait for it to rot down.'$tx6o$);
  if n <> 1 then raise exception 'holding_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The trash crate is full. Wait for it to rot down.'$tx6o$, $tx6n$'Trash crate full. Wait for it to rot down.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_holding(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You turn the '
      || lower((select name from item_def where id = it.def)) || ' out: ' || v_n
      || case when v_n = 1 then ' thing' else ' things' end || ' back in your pack.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You turn the '
      || lower((select name from item_def where id = it.def)) || ' out: ' || v_n
      || case when v_n = 1 then ' thing' else ' things' end || ' back in your pack.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_holding: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You turn the '
      || lower((select name from item_def where id = it.def)) || ' out: ' || v_n
      || case when v_n = 1 then ' thing' else ' things' end || ' back in your pack.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Emptied '
      || lower((select name from item_def where id = it.def)) || ': ' || v_n
      || case when v_n = 1 then ' item' else ' items' end || ' to pack.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You throw '
      || case when v_want > 1 then v_want || ' × ' else 'the ' end || lower(item_name(it))
      || ' in the trash crate. It will not last long in there.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You throw '
      || case when v_want > 1 then v_want || ' × ' else 'the ' end || lower(item_name(it))
      || ' in the trash crate. It will not last long in there.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_holding: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You throw '
      || case when v_want > 1 then v_want || ' × ' else 'the ' end || lower(item_name(it))
      || ' in the trash crate. It will not last long in there.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Trashed: '
      || case when v_want > 1 then v_want || ' × ' else '' end || lower(item_name(it))
      || '.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('liquid_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'That is not an empty bucket.'$tx6o$, ''))) / length($tx6o$'That is not an empty bucket.'$tx6o$);
  if n <> 1 then raise exception 'liquid_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is not an empty bucket.'$tx6o$, $tx6n$'Not an empty bucket.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need water: a shore, a well, or a barrel with something in it.'$tx6o$, ''))) / length($tx6o$'You need water: a shore, a well, or a barrel with something in it.'$tx6o$);
  if n <> 1 then raise exception 'liquid_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need water: a shore, a well, or a barrel with something in it.'$tx6o$, $tx6n$'Need water: shore, well, or a barrel with liquid.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It is already full.'$tx6o$, ''))) / length($tx6o$'It is already full.'$tx6o$);
  if n <> 1 then raise exception 'liquid_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is already full.'$tx6o$, $tx6n$'Already full.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need water: a shore, a well, or a barrel of it.'$tx6o$, ''))) / length($tx6o$'You need water: a shore, a well, or a barrel of it.'$tx6o$);
  if n <> 1 then raise exception 'liquid_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need water: a shore, a well, or a barrel of it.'$tx6o$, $tx6n$'Need water: shore, well, or a barrel of water.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You would not want to drink that.'$tx6o$, ''))) / length($tx6o$'You would not want to drink that.'$tx6o$);
  if n <> 1 then raise exception 'liquid_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You would not want to drink that.'$tx6o$, $tx6n$'Not drinkable.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It is dry.'$tx6o$, ''))) / length($tx6o$'It is dry.'$tx6o$);
  if n <> 1 then raise exception 'liquid_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is dry.'$tx6o$, $tx6n$'Empty.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You are not thirsty.'$tx6o$, ''))) / length($tx6o$'You are not thirsty.'$tx6o$);
  if n <> 1 then raise exception 'liquid_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You are not thirsty.'$tx6o$, $tx6n$'Not thirsty.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It is already empty.'$tx6o$, ''))) / length($tx6o$'It is already empty.'$tx6o$);
  if n <> 1 then raise exception 'liquid_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is already empty.'$tx6o$, $tx6n$'Already empty.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That is not a bucket of anything.'$tx6o$, ''))) / length($tx6o$'That is not a bucket of anything.'$tx6o$);
  if n <> 2 then raise exception 'liquid_refusal: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'That is not a bucket of anything.'$tx6o$, $tx6n$'Not a filled bucket.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no barrel beside you with room for '$tx6o$, ''))) / length($tx6o$'There is no barrel beside you with room for '$tx6o$);
  if n <> 1 then raise exception 'liquid_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no barrel beside you with room for '$tx6o$, $tx6n$'No barrel beside you with room for '$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_liquid(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You dip the bucket full of water.'$tx6o$, ''))) / length($tx6o$'You dip the bucket full of water.'$tx6o$);
  if n <> 1 then raise exception 'perform_liquid: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You dip the bucket full of water.'$tx6o$, $tx6n$'Filled: bucket of water.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then 'You draw a bucket of ' || (select name from liquid_def where id = v_kind)
           || ' out of the ' || lower(placed_name(v_from)) || '.'$tx6o$, ''))) / length($tx6o$then 'You draw a bucket of ' || (select name from liquid_def where id = v_kind)
           || ' out of the ' || lower(placed_name(v_from)) || '.'$tx6o$);
  if n <> 1 then raise exception 'perform_liquid: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then 'You draw a bucket of ' || (select name from liquid_def where id = v_kind)
           || ' out of the ' || lower(placed_name(v_from)) || '.'$tx6o$, $tx6n$then 'Filled: bucket of ' || (select name from liquid_def where id = v_kind)
           || ', from the ' || lower(placed_name(v_from)) || '.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You tip the '
      || lower((select name from item_def where id = it.def)) || ' out.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You tip the '
      || lower((select name from item_def where id = it.def)) || ' out.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_liquid: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You tip the '
      || lower((select name from item_def where id = it.def)) || ' out.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Emptied: '
      || lower((select name from item_def where id = it.def)) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You fill the '
      || lower((select name from item_def where id = it.def)) || ' with water.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You fill the '
      || lower((select name from item_def where id = it.def)) || ' with water.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_liquid: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You fill the '
      || lower((select name from item_def where id = it.def)) || ' with water.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Filled: '
      || lower((select name from item_def where id = it.def)) || ', water.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You pour ' || litres_word(v_n) || ' of dye into the '
        || lower(placed_name(v_from)) || '. It holds ' || dye_says(v_mixed, v_had + v_n), 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You pour ' || litres_word(v_n) || ' of dye into the '
        || lower(placed_name(v_from)) || '. It holds ' || dye_says(v_mixed, v_had + v_n), 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_liquid: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You pour ' || litres_word(v_n) || ' of dye into the '
        || lower(placed_name(v_from)) || '. It holds ' || dye_says(v_mixed, v_had + v_n), 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Poured: ' || litres_word(v_n) || ' of dye into the '
        || lower(placed_name(v_from)) || '. Holds: ' || dye_says(v_mixed, v_had + v_n), 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You pour ' || to_char(v_poured, 'FM990') || ' litres of '
      || (select name from liquid_def where id = v_kind) || ' into the '
      || lower(placed_name(v_from)) || '. '
      || to_char(placed_litres(v_from) + v_poured, 'FM990') || ' of '$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You pour ' || to_char(v_poured, 'FM990') || ' litres of '
      || (select name from liquid_def where id = v_kind) || ' into the '
      || lower(placed_name(v_from)) || '. '
      || to_char(placed_litres(v_from) + v_poured, 'FM990') || ' of '$tx6o$);
  if n <> 1 then raise exception 'perform_liquid: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You pour ' || to_char(v_poured, 'FM990') || ' litres of '
      || (select name from liquid_def where id = v_kind) || ' into the '
      || lower(placed_name(v_from)) || '. '
      || to_char(placed_litres(v_from) + v_poured, 'FM990') || ' of '$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Poured: ' || to_char(v_poured, 'FM990') || ' litres of '
      || (select name from liquid_def where id = v_kind) || ' into the '
      || lower(placed_name(v_from)) || '. '
      || to_char(placed_litres(v_from) + v_poured, 'FM990') || '/'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You tip the ' || v_kind || ' out of the '
      || lower(placed_name(p)) || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You tip the ' || v_kind || ' out of the '
      || lower(placed_name(p)) || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_liquid: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You tip the ' || v_kind || ' out of the '
      || lower(placed_name(p)) || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Emptied: ' || v_kind || ' from the '
      || lower(placed_name(p)) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You drink your fill from the ' || lower(placed_name(p)) || '.'$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You drink your fill from the ' || lower(placed_name(p)) || '.'$tx6o$);
  if n <> 1 then raise exception 'perform_liquid: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You drink your fill from the ' || lower(placed_name(p)) || '.'$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Drank from the ' || lower(placed_name(p)) || '.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('dye_source_refusal(uuid,uuid,item)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'It is already full.'$tx6o$, ''))) / length($tx6o$'It is already full.'$tx6o$);
  if n <> 1 then raise exception 'dye_source_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is already full.'$tx6o$, $tx6n$'Already full.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That is not a bucket of dye.'$tx6o$, ''))) / length($tx6o$'That is not a bucket of dye.'$tx6o$);
  if n <> 1 then raise exception 'dye_source_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is not a bucket of dye.'$tx6o$, $tx6n$'Not a bucket of dye.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no barrel of dye beside you to fill it from.'$tx6o$, ''))) / length($tx6o$'There is no barrel of dye beside you to fill it from.'$tx6o$);
  if n <> 1 then raise exception 'dye_source_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no barrel of dye beside you to fill it from.'$tx6o$, $tx6n$'No barrel of dye beside you.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_hands(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'There is nothing lying about here.'$tx6o$, ''))) / length($tx6o$'There is nothing lying about here.'$tx6o$);
  if n <> 1 then raise exception 'perform_hands: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is nothing lying about here.'$tx6o$, $tx6n$'Nothing here to pick up.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You gather up ' || pile_text(v_took) || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You gather up ' || pile_text(v_took) || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_hands: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You gather up ' || pile_text(v_took) || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Picked up: ' || pile_text(v_took) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You set the ' || lower(item_name(it))
        || ' aside. Nothing will spend it, drop it or feed it away until you say so.', 'info');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You set the ' || lower(item_name(it))
        || ' aside. Nothing will spend it, drop it or feed it away until you say so.', 'info');$tx6o$);
  if n <> 1 then raise exception 'perform_hands: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You set the ' || lower(item_name(it))
        || ' aside. Nothing will spend it, drop it or feed it away until you say so.', 'info');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Locked: ' || lower(item_name(it))
        || '. Not spent, dropped or fed until unlocked.', 'info');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The ' || lower(item_name(it)) || ' is fair game again.', 'info');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The ' || lower(item_name(it)) || ' is fair game again.', 'info');$tx6o$);
  if n <> 1 then raise exception 'perform_hands: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The ' || lower(item_name(it)) || ' is fair game again.', 'info');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Unlocked: ' || lower(item_name(it)) || '.', 'info');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You drop '
      || case when v_want > 1 then v_want || ' × ' || lower(item_name(it))
              else 'the ' || lower(item_name(it)) end
      || ' on the ground.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You drop '
      || case when v_want > 1 then v_want || ' × ' || lower(item_name(it))
              else 'the ' || lower(item_name(it)) end
      || ' on the ground.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_hands: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You drop '
      || case when v_want > 1 then v_want || ' × ' || lower(item_name(it))
              else 'the ' || lower(item_name(it)) end
      || ' on the ground.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Dropped: '
      || case when v_want > 1 then v_want || ' × ' || lower(item_name(it))
              else lower(item_name(it)) end
      || ', on the ground.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You pick up ' ||
      case when it.count > 1$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You pick up ' ||
      case when it.count > 1$tx6o$);
  if n <> 1 then raise exception 'perform_hands: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You pick up ' ||
      case when it.count > 1$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Picked up: ' ||
      case when it.count > 1$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'It goes back to being what it was.', 'info');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'It goes back to being what it was.', 'info');$tx6o$);
  if n <> 1 then raise exception 'perform_hands: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'It goes back to being what it was.', 'info');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Name removed.', 'info');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The ' || lower(coalesce(v_was, 'thing'))
        || ' is called ' || v_name || ' from now on.', 'info');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The ' || lower(coalesce(v_was, 'thing'))
        || ' is called ' || v_name || ' from now on.', 'info');$tx6o$);
  if n <> 1 then raise exception 'perform_hands: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The ' || lower(coalesce(v_was, 'thing'))
        || ' is called ' || v_name || ' from now on.', 'info');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Named: ' || lower(coalesce(v_was, 'thing'))
        || ' is now ' || v_name || '.', 'info');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('hands_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'There is nothing lying about here.'$tx6o$, ''))) / length($tx6o$'There is nothing lying about here.'$tx6o$);
  if n <> 1 then raise exception 'hands_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is nothing lying about here.'$tx6o$, $tx6n$'Nothing here to pick up.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is nothing there any more.'$tx6o$, ''))) / length($tx6o$'There is nothing there any more.'$tx6o$);
  if n <> 1 then raise exception 'hands_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is nothing there any more.'$tx6o$, $tx6n$'Nothing there.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('deed_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You already hold a settlement. Disband it first.'$tx6o$, ''))) / length($tx6o$'You already hold a settlement. Disband it first.'$tx6o$);
  if n <> 1 then raise exception 'deed_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You already hold a settlement. Disband it first.'$tx6o$, $tx6n$'Already founded a settlement. Disband it first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Too close to the edge of the world.'$tx6o$, ''))) / length($tx6o$'Too close to the edge of the world.'$tx6o$);
  if n <> 1 then raise exception 'deed_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Too close to the edge of the world.'$tx6o$, $tx6n$'Too close to the map edge.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The token must stand on dry land.'$tx6o$, ''))) / length($tx6o$'The token must stand on dry land.'$tx6o$);
  if n <> 1 then raise exception 'deed_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The token must stand on dry land.'$tx6o$, $tx6n$'Token needs dry land.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The token needs a clear tile.'$tx6o$, ''))) / length($tx6o$'The token needs a clear tile.'$tx6o$);
  if n <> 1 then raise exception 'deed_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The token needs a clear tile.'$tx6o$, $tx6n$'Token needs a clear tile.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('upgrade_reason(uuid,uuid)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You have no settlement.'$tx6o$, ''))) / length($tx6o$'You have no settlement.'$tx6o$);
  if n <> 1 then raise exception 'upgrade_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You have no settlement.'$tx6o$, $tx6n$'No settlement.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return dd.name || ' is as grand as a settlement gets.';$tx6o$, ''))) / length($tx6o$return dd.name || ' is as grand as a settlement gets.';$tx6o$);
  if n <> 1 then raise exception 'upgrade_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return dd.name || ' is as grand as a settlement gets.';$tx6o$, $tx6n$return dd.name || ': max level.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$if v_missing is not null then return 'Still wanted: ' || v_missing || '.'; end if;$tx6o$, ''))) / length($tx6o$if v_missing is not null then return 'Still wanted: ' || v_missing || '.'; end if;$tx6o$);
  if n <> 1 then raise exception 'upgrade_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$if v_missing is not null then return 'Still wanted: ' || v_missing || '.'; end if;$tx6o$, $tx6n$if v_missing is not null then return 'Still needed: ' || v_missing || '.'; end if;$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_settlement(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The settlement is now called ' || v_name || '.', 'system');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The settlement is now called ' || v_name || '.', 'system');$tx6o$);
  if n <> 1 then raise exception 'perform_settlement: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The settlement is now called ' || v_name || '.', 'system');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Settlement renamed: ' || v_name || '.', 'system');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, dd.name || ' is disbanded. '
      || v_freed || case when v_freed = 1 then ' wildermon runs' else ' wildermon run' end
      || ' wild and ' || v_tipped
      || case when v_tipped = 1 then ' thing is' else ' things are' end
      || ' tipped out where the crate stood.', 'system');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, dd.name || ' is disbanded. '
      || v_freed || case when v_freed = 1 then ' wildermon runs' else ' wildermon run' end
      || ' wild and ' || v_tipped
      || case when v_tipped = 1 then ' thing is' else ' things are' end
      || ' tipped out where the crate stood.', 'system');$tx6o$);
  if n <> 1 then raise exception 'perform_settlement: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, dd.name || ' is disbanded. '
      || v_freed || case when v_freed = 1 then ' wildermon runs' else ' wildermon run' end
      || ' wild and ' || v_tipped
      || case when v_tipped = 1 then ' thing is' else ' things are' end
      || ' tipped out where the crate stood.', 'system');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Disbanded: ' || dd.name || '. Deed stake to pack. Deed crate removed; '
      || v_tipped || case when v_tipped = 1 then ' item' else ' items' end
      || ' dropped where it stood. Wildermon gone wild: ' || v_freed || '.', 'system');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You pull the post up and coil the ribbon round it.'$tx6o$, ''))) / length($tx6o$'You pull the post up and coil the ribbon round it.'$tx6o$);
  if n <> 1 then raise exception 'perform_settlement: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You pull the post up and coil the ribbon round it.'$tx6o$, $tx6n$'Work post removed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You drive the post in and tack the ribbon to it. It will stand about '
      || round(post_life(p.ql) * kept_life(p) / 60) || ' minutes and reach ' || post_radius(p.ql)
      || ' tiles. Set a wildermon to it.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You drive the post in and tack the ribbon to it. It will stand about '
      || round(post_life(p.ql) * kept_life(p) / 60) || ' minutes and reach ' || post_radius(p.ql)
      || ' tiles. Set a wildermon to it.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_settlement: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You drive the post in and tack the ribbon to it. It will stand about '
      || round(post_life(p.ql) * kept_life(p) / 60) || ' minutes and reach ' || post_radius(p.ql)
      || ' tiles. Set a wildermon to it.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Work post placed: lasts about '
      || round(post_life(p.ql) * kept_life(p) / 60) || ' minutes, reach ' || post_radius(p.ql)
      || ' tiles. Assign a wildermon to it.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, dd.name || ' grows to level ' || v_level
      || '. The border reaches ' || deed_radius(v_level) || ' tiles from the token and '
      || worker_cap(p_world, dd.founded_by) || ' wildermon may work here.', 'system');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, dd.name || ' grows to level ' || v_level
      || '. The border reaches ' || deed_radius(v_level) || ' tiles from the token and '
      || worker_cap(p_world, dd.founded_by) || ' wildermon may work here.', 'system');$tx6o$);
  if n <> 1 then raise exception 'perform_settlement: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, dd.name || ' grows to level ' || v_level
      || '. The border reaches ' || deed_radius(v_level) || ' tiles from the token and '
      || worker_cap(p_world, dd.founded_by) || ' wildermon may work here.', 'system');$tx6o$, $tx6n$perform tell(p_world, p_uid, dd.name || ': level ' || v_level
      || '. Border ' || deed_radius(v_level) || ' tiles from the token; '
      || worker_cap(p_world, dd.founded_by) || ' wildermon may work here.', 'system');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_deed(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You found the settlement of ' || left(nm, 32)
    || '. The land ' || (deed_radius(1) * 2 + 1) || ' tiles across around the token is yours to build on.'
    || case when made is null then '' else ' A deed crate stands beside the token.' end, 'system');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You found the settlement of ' || left(nm, 32)
    || '. The land ' || (deed_radius(1) * 2 + 1) || ' tiles across around the token is yours to build on.'
    || case when made is null then '' else ' A deed crate stands beside the token.' end, 'system');$tx6o$);
  if n <> 1 then raise exception 'perform_deed: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You found the settlement of ' || left(nm, 32)
    || '. The land ' || (deed_radius(1) * 2 + 1) || ' tiles across around the token is yours to build on.'
    || case when made is null then '' else ' A deed crate stands beside the token.' end, 'system');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Founded: ' || left(nm, 32)
    || '. Build area: ' || (deed_radius(1) * 2 + 1) || '×' || (deed_radius(1) * 2 + 1) || ' tiles round the token.'
    || case when made is null then '' else ' Deed crate placed beside it.' end, 'system');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('examine_item_text(uuid,uuid,item)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$v_out := v_out || ' It is ' || r.id || ': better at what it is for by a '
      || case when r.boost > 1.3 then 'half' when r.boost > 1.15 then 'quarter' else 'tenth' end
      || ', slower to wear and to rot, and can be bettered ' || to_char(r.ceiling, 'FM990')
      || ' past your own skill.';$tx6o$, ''))) / length($tx6o$v_out := v_out || ' It is ' || r.id || ': better at what it is for by a '
      || case when r.boost > 1.3 then 'half' when r.boost > 1.15 then 'quarter' else 'tenth' end
      || ', slower to wear and to rot, and can be bettered ' || to_char(r.ceiling, 'FM990')
      || ' past your own skill.';$tx6o$);
  if n <> 1 then raise exception 'examine_item_text: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_out := v_out || ' It is ' || r.id || ': better at what it is for by a '
      || case when r.boost > 1.3 then 'half' when r.boost > 1.15 then 'quarter' else 'tenth' end
      || ', slower to wear and to rot, and can be bettered ' || to_char(r.ceiling, 'FM990')
      || ' past your own skill.';$tx6o$, $tx6n$v_out := v_out || ' ' || upper(left(r.id, 1)) || substr(r.id, 2) || ': effect ×' || r.boost::text
      || ', wear and rot ×' || r.keep::text
      || ', improvable to ' || to_char(r.ceiling, 'FM990')
      || ' QL past your skill.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_out := v_out || ' It favours '$tx6o$, ''))) / length($tx6o$v_out := v_out || ' It favours '$tx6o$);
  if n <> 1 then raise exception 'examine_item_text: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_out := v_out || ' It favours '$tx6o$, $tx6n$v_out := v_out || ' Knack: '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_out := v_out || ' It works as a ' || to_char(v_worth, 'FM990.0') || ' today.';$tx6o$, ''))) / length($tx6o$v_out := v_out || ' It works as a ' || to_char(v_worth, 'FM990.0') || ' today.';$tx6o$);
  if n <> 1 then raise exception 'examine_item_text: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_out := v_out || ' It works as a ' || to_char(v_worth, 'FM990.0') || ' today.';$tx6o$, $tx6n$v_out := v_out || ' Works as QL ' || to_char(v_worth, 'FM990.0') || ' now.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('dye_item_says(item)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$then ' It holds ' || dye_says($tx6o$, ''))) / length($tx6o$then ' It holds ' || dye_says($tx6o$);
  if n <> 1 then raise exception 'dye_item_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then ' It holds ' || dye_says($tx6o$, $tx6n$then ' Holds: ' || dye_says($tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then ' It is dyed ' || dye_hex_of(it.dye) || '.'$tx6o$, ''))) / length($tx6o$then ' It is dyed ' || dye_hex_of(it.dye) || '.'$tx6o$);
  if n <> 1 then raise exception 'dye_item_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then ' It is dyed ' || dye_hex_of(it.dye) || '.'$tx6o$, $tx6n$then ' Dyed: ' || dye_hex_of(it.dye) || '.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('bauble_said(uuid,uuid)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The baubles in the altar make that '$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The baubles in the altar make that '$tx6o$);
  if n <> 1 then raise exception 'bauble_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The baubles in the altar make that '$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Altar baubles: yield now '$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('aqueduct_plan(uuid,uuid,integer,integer,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'An aqueduct runs straight: its head due north, south, east or west of the tile it pours into.'$tx6o$, ''))) / length($tx6o$'An aqueduct runs straight: its head due north, south, east or west of the tile it pours into.'$tx6o$);
  if n <> 1 then raise exception 'aqueduct_plan: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'An aqueduct runs straight: its head due north, south, east or west of the tile it pours into.'$tx6o$, $tx6n$'Aqueduct head must be due north, south, east or west of its foot.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That water is right beside it: there is nothing for an aqueduct to carry it over.'$tx6o$, ''))) / length($tx6o$'That water is right beside it: there is nothing for an aqueduct to carry it over.'$tx6o$);
  if n <> 1 then raise exception 'aqueduct_plan: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That water is right beside it: there is nothing for an aqueduct to carry it over.'$tx6o$, $tx6n$'Water is adjacent: nothing to span.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The sea is below everything: an aqueduct carries a spring''s water, from a pond or a pool.'$tx6o$, ''))) / length($tx6o$'The sea is below everything: an aqueduct carries a spring''s water, from a pond or a pool.'$tx6o$);
  if n <> 1 then raise exception 'aqueduct_plan: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The sea is below everything: an aqueduct carries a spring''s water, from a pond or a pool.'$tx6o$, $tx6n$'Not from the sea: draw from a pond or pool.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no pond or pool there for an aqueduct to draw from.'$tx6o$, ''))) / length($tx6o$'There is no pond or pool there for an aqueduct to draw from.'$tx6o$);
  if n <> 1 then raise exception 'aqueduct_plan: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no pond or pool there for an aqueduct to draw from.'$tx6o$, $tx6n$'No pond or pool there to draw from.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Dig a pool in the foundation first: the water would run straight off its top.'$tx6o$, ''))) / length($tx6o$'Dig a pool in the foundation first: the water would run straight off its top.'$tx6o$);
  if n <> 1 then raise exception 'aqueduct_plan: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Dig a pool in the foundation first: the water would run straight off its top.'$tx6o$, $tx6n$'Dig a pool in the foundation first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'An aqueduct pours into a pool, a pond, a fountain or a hollow, not the sea.'$tx6o$, ''))) / length($tx6o$'An aqueduct pours into a pool, a pond, a fountain or a hollow, not the sea.'$tx6o$);
  if n <> 1 then raise exception 'aqueduct_plan: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'An aqueduct pours into a pool, a pond, a fountain or a hollow, not the sea.'$tx6o$, $tx6n$'Not into the sea: pour into a pool, pond, fountain or hollow.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That is the water it would draw from.'$tx6o$, ''))) / length($tx6o$'That is the water it would draw from.'$tx6o$);
  if n <> 2 then raise exception 'aqueduct_plan: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'That is the water it would draw from.'$tx6o$, $tx6n$'That is the water it draws from.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A bridge is carried over one end of it already.'$tx6o$, ''))) / length($tx6o$'A bridge is carried over one end of it already.'$tx6o$);
  if n <> 1 then raise exception 'aqueduct_plan: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A bridge is carried over one end of it already.'$tx6o$, $tx6n$'A bridge already spans one end.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'An aqueduct already runs from there to here.'$tx6o$, ''))) / length($tx6o$'An aqueduct already runs from there to here.'$tx6o$);
  if n <> 1 then raise exception 'aqueduct_plan: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'An aqueduct already runs from there to here.'$tx6o$, $tx6n$'Already an aqueduct from there to here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That is part of ' || v_name || '. Only its builders may lead water from it or to it.'));$tx6o$, ''))) / length($tx6o$'That is part of ' || v_name || '. Only its builders may lead water from it or to it.'));$tx6o$);
  if n <> 1 then raise exception 'aqueduct_plan: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is part of ' || v_name || '. Only its builders may lead water from it or to it.'));$tx6o$, $tx6n$'Part of ' || v_name || ': builders only.'));$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return jsonb_build_object('refused', 'That hollow is too wide ever to fill: a pond spreads over ' || pond_most() || ' corners at most.');$tx6o$, ''))) / length($tx6o$return jsonb_build_object('refused', 'That hollow is too wide ever to fill: a pond spreads over ' || pond_most() || ' corners at most.');$tx6o$);
  if n <> 1 then raise exception 'aqueduct_plan: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return jsonb_build_object('refused', 'That hollow is too wide ever to fill: a pond spreads over ' || pond_most() || ' corners at most.');$tx6o$, $tx6n$return jsonb_build_object('refused', 'Hollow too wide: a pond covers ' || pond_most() || ' corners at most.');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return jsonb_build_object('refused', 'Water poured here would run straight off downhill: the foot of an aqueduct wants a pool, a pond, a fountain, or a hollow that holds '$tx6o$, ''))) / length($tx6o$return jsonb_build_object('refused', 'Water poured here would run straight off downhill: the foot of an aqueduct wants a pool, a pond, a fountain, or a hollow that holds '$tx6o$);
  if n <> 1 then raise exception 'aqueduct_plan: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return jsonb_build_object('refused', 'Water poured here would run straight off downhill: the foot of an aqueduct wants a pool, a pond, a fountain, or a hollow that holds '$tx6o$, $tx6n$return jsonb_build_object('refused', 'Foot needs a pool, pond, fountain, or a hollow holding '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return jsonb_build_object('refused', 'The aqueduct from ' || ob.ax || ', ' || ob.ay || ' draws from that water already.');$tx6o$, ''))) / length($tx6o$return jsonb_build_object('refused', 'The aqueduct from ' || ob.ax || ', ' || ob.ay || ' draws from that water already.');$tx6o$);
  if n <> 1 then raise exception 'aqueduct_plan: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return jsonb_build_object('refused', 'The aqueduct from ' || ob.ax || ', ' || ob.ay || ' draws from that water already.');$tx6o$, $tx6n$return jsonb_build_object('refused', 'Already drawn by the aqueduct from ' || ob.ax || ', ' || ob.ay || '.');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return jsonb_build_object('refused', 'The water there stands at ' || v_level || ', over the ' || v_top
      || ' its head stands at: water only runs downhill.');$tx6o$, ''))) / length($tx6o$return jsonb_build_object('refused', 'The water there stands at ' || v_level || ', over the ' || v_top
      || ' its head stands at: water only runs downhill.');$tx6o$);
  if n <> 1 then raise exception 'aqueduct_plan: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return jsonb_build_object('refused', 'The water there stands at ' || v_level || ', over the ' || v_top
      || ' its head stands at: water only runs downhill.');$tx6o$, $tx6n$return jsonb_build_object('refused', 'Water there at ' || v_level || ', above the head at ' || v_top
      || ': water runs downhill only.');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return jsonb_build_object('refused', 'A ' || case when land_tile(p_world, r.x, r.y) = tile_id('Tree') then 'tree' else 'bush' end
        || ' stands at ' || r.x || ', ' || r.y || ', under where a span would go. Cut it down first.');$tx6o$, ''))) / length($tx6o$return jsonb_build_object('refused', 'A ' || case when land_tile(p_world, r.x, r.y) = tile_id('Tree') then 'tree' else 'bush' end
        || ' stands at ' || r.x || ', ' || r.y || ', under where a span would go. Cut it down first.');$tx6o$);
  if n <> 1 then raise exception 'aqueduct_plan: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return jsonb_build_object('refused', 'A ' || case when land_tile(p_world, r.x, r.y) = tile_id('Tree') then 'tree' else 'bush' end
        || ' stands at ' || r.x || ', ' || r.y || ', under where a span would go. Cut it down first.');$tx6o$, $tx6n$return jsonb_build_object('refused', case when land_tile(p_world, r.x, r.y) = tile_id('Tree') then 'Tree' else 'Bush' end
        || ' at ' || r.x || ', ' || r.y || ' under a span: cut it down first.');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$|| ' at ' || r.x || ', ' || r.y || ' stands within '
        || to_char(clearance() / 10.0, 'FM990.0') || ' m of the channel''s bed: an aqueduct is carried over '
        || case when fs.id is null then 'the ground' when fs.pool then 'the water' else 'a foundation' end || ', not through it.');$tx6o$, ''))) / length($tx6o$|| ' at ' || r.x || ', ' || r.y || ' stands within '
        || to_char(clearance() / 10.0, 'FM990.0') || ' m of the channel''s bed: an aqueduct is carried over '
        || case when fs.id is null then 'the ground' when fs.pool then 'the water' else 'a foundation' end || ', not through it.');$tx6o$);
  if n <> 1 then raise exception 'aqueduct_plan: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$|| ' at ' || r.x || ', ' || r.y || ' stands within '
        || to_char(clearance() / 10.0, 'FM990.0') || ' m of the channel''s bed: an aqueduct is carried over '
        || case when fs.id is null then 'the ground' when fs.pool then 'the water' else 'a foundation' end || ', not through it.');$tx6o$, $tx6n$|| ' at ' || r.x || ', ' || r.y || ' is within '
        || to_char(clearance() / 10.0, 'FM990.0') || ' m of the channel bed.');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Something is already bridged across there.'$tx6o$, ''))) / length($tx6o$'Something is already bridged across there.'$tx6o$);
  if n <> 1 then raise exception 'aqueduct_plan: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Something is already bridged across there.'$tx6o$, $tx6n$'Already bridged there.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return jsonb_build_object('refused', 'An aqueduct spans ' || (select d.span from bridge_def d where d.id = 'aqueduct')
      || ' tiles; that is ' || n || '.');$tx6o$, ''))) / length($tx6o$return jsonb_build_object('refused', 'An aqueduct spans ' || (select d.span from bridge_def d where d.id = 'aqueduct')
      || ' tiles; that is ' || n || '.');$tx6o$);
  if n <> 1 then raise exception 'aqueduct_plan: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return jsonb_build_object('refused', 'An aqueduct spans ' || (select d.span from bridge_def d where d.id = 'aqueduct')
      || ' tiles; that is ' || n || '.');$tx6o$, $tx6n$return jsonb_build_object('refused', 'Aqueduct: max span ' || (select d.span from bridge_def d where d.id = 'aqueduct')
      || ' tiles; this is ' || n || '.');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('aqueduct_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'An aqueduct is set out from the pool, pond, fountain or hollow it pours into, not thrown from a bank.'$tx6o$, ''))) / length($tx6o$'An aqueduct is set out from the pool, pond, fountain or hollow it pours into, not thrown from a bank.'$tx6o$);
  if n <> 1 then raise exception 'aqueduct_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'An aqueduct is set out from the pool, pond, fountain or hollow it pours into, not thrown from a bank.'$tx6o$, $tx6n$'Aqueducts are set out from the pool, pond, fountain or hollow they pour into.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It is finished.'$tx6o$, ''))) / length($tx6o$'It is finished.'$tx6o$);
  if n <> 1 then raise exception 'aqueduct_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is finished.'$tx6o$, $tx6n$'Finished.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Work from one end. Walk to the open part of the span.'$tx6o$, ''))) / length($tx6o$'Work from one end. Walk to the open part of the span.'$tx6o$);
  if n <> 1 then raise exception 'aqueduct_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Work from one end. Walk to the open part of the span.'$tx6o$, $tx6n$'Stand by the open span.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You need a ' || lower((select coalesce(name, 'trowel') from item_def where id = 'trowel')) || '.';$tx6o$, ''))) / length($tx6o$return 'You need a ' || lower((select coalesce(name, 'trowel') from item_def where id = 'trowel')) || '.';$tx6o$);
  if n <> 1 then raise exception 'aqueduct_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You need a ' || lower((select coalesce(name, 'trowel') from item_def where id = 'trowel')) || '.';$tx6o$, $tx6n$return 'Need a ' || lower((select coalesce(name, 'trowel') from item_def where id = 'trowel')) || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'That span wants ' || span_wants(s.needed) || '; you have no '
        || lower((select coalesce(name, v_short) from item_def where id = v_short)) || ' to hand.';$tx6o$, ''))) / length($tx6o$return 'That span wants ' || span_wants(s.needed) || '; you have no '
        || lower((select coalesce(name, v_short) from item_def where id = v_short)) || ' to hand.';$tx6o$);
  if n <> 1 then raise exception 'aqueduct_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'That span wants ' || span_wants(s.needed) || '; you have no '
        || lower((select coalesce(name, v_short) from item_def where id = v_short)) || ' to hand.';$tx6o$, $tx6n$return 'Span needs ' || span_wants(s.needed) || '; no '
        || lower((select coalesce(name, v_short) from item_def where id = v_short)) || ' to hand.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return coalesce(v_rank, 'That is part of ' || v_short || '. Only its builders may '$tx6o$, ''))) / length($tx6o$return coalesce(v_rank, 'That is part of ' || v_short || '. Only its builders may '$tx6o$);
  if n <> 1 then raise exception 'aqueduct_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return coalesce(v_rank, 'That is part of ' || v_short || '. Only its builders may '$tx6o$, $tx6n$return coalesce(v_rank, 'Part of ' || v_short || ': only builders may '$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('carried_over(uuid,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'An aqueduct is carried over that tile.'$tx6o$, ''))) / length($tx6o$'An aqueduct is carried over that tile.'$tx6o$);
  if n <> 1 then raise exception 'carried_over: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'An aqueduct is carried over that tile.'$tx6o$, $tx6n$'Aqueduct over that tile.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A bridge is carried over that tile.'$tx6o$, ''))) / length($tx6o$'A bridge is carried over that tile.'$tx6o$);
  if n <> 1 then raise exception 'carried_over: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A bridge is carried over that tile.'$tx6o$, $tx6n$'Bridge over that tile.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('extend_reason(uuid,uuid,integer,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'An aqueduct is carried over that tile.'$tx6o$, ''))) / length($tx6o$'An aqueduct is carried over that tile.'$tx6o$);
  if n <> 1 then raise exception 'extend_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'An aqueduct is carried over that tile.'$tx6o$, $tx6n$'Aqueduct over that tile.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You may only build on your own deed.'$tx6o$, ''))) / length($tx6o$'You may only build on your own deed.'$tx6o$);
  if n <> 1 then raise exception 'extend_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You may only build on your own deed.'$tx6o$, $tx6n$'Only on your own deed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The settlement token stands here.'$tx6o$, ''))) / length($tx6o$'The settlement token stands here.'$tx6o$);
  if n <> 1 then raise exception 'extend_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The settlement token stands here.'$tx6o$, $tx6n$'Settlement token here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That tile is already part of a building.'$tx6o$, ''))) / length($tx6o$'That tile is already part of a building.'$tx6o$);
  if n <> 1 then raise exception 'extend_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That tile is already part of a building.'$tx6o$, $tx6n$'Already part of a building.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Buildings need flat packed dirt. Pack the tile first.'$tx6o$, ''))) / length($tx6o$'Buildings need flat packed dirt. Pack the tile first.'$tx6o$);
  if n <> 2 then raise exception 'extend_reason: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'Buildings need flat packed dirt. Pack the tile first.'$tx6o$, $tx6n$'Needs packed dirt.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The foundation here is only shuttered. Pour it first.'$tx6o$, ''))) / length($tx6o$'The foundation here is only shuttered. Pour it first.'$tx6o$);
  if n <> 1 then raise exception 'extend_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The foundation here is only shuttered. Pour it first.'$tx6o$, $tx6n$'Foundation not poured yet.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You cannot build in water.'$tx6o$, ''))) / length($tx6o$'You cannot build in water.'$tx6o$);
  if n <> 1 then raise exception 'extend_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You cannot build in water.'$tx6o$, $tx6n$'Not in a pool.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Clear away the items lying there first.'$tx6o$, ''))) / length($tx6o$'Clear away the items lying there first.'$tx6o$);
  if n <> 1 then raise exception 'extend_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Clear away the items lying there first.'$tx6o$, $tx6n$'Items on the tile: clear them first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The slab here is poured to ' || v_slab.top || ' and the floor of ' || b.name || ' stands at ' || b.deck
        || '. A floor is level.';$tx6o$, ''))) / length($tx6o$return 'The slab here is poured to ' || v_slab.top || ' and the floor of ' || b.name || ' stands at ' || b.deck
        || '. A floor is level.';$tx6o$);
  if n <> 1 then raise exception 'extend_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The slab here is poured to ' || v_slab.top || ' and the floor of ' || b.name || ' stands at ' || b.deck
        || '. A floor is level.';$tx6o$, $tx6n$return 'Slab at ' || v_slab.top || '; ' || b.name || ' floor at ' || b.deck
        || '. Must match.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A bridge comes ashore on this tile. Build clear of its ends.'$tx6o$, ''))) / length($tx6o$'A bridge comes ashore on this tile. Build clear of its ends.'$tx6o$);
  if n <> 1 then raise exception 'extend_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A bridge comes ashore on this tile. Build clear of its ends.'$tx6o$, $tx6n$'Bridge end on this tile.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('frame_outside_stair_refusal(uuid,uuid,building,integer,integer,text,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'An aqueduct is carried over that tile.'$tx6o$, ''))) / length($tx6o$'An aqueduct is carried over that tile.'$tx6o$);
  if n <> 1 then raise exception 'frame_outside_stair_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'An aqueduct is carried over that tile.'$tx6o$, $tx6n$'Aqueduct over that tile.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You may only build on your own deed.'$tx6o$, ''))) / length($tx6o$'You may only build on your own deed.'$tx6o$);
  if n <> 1 then raise exception 'frame_outside_stair_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You may only build on your own deed.'$tx6o$, $tx6n$'Only on your own deed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A bridge crosses that tile.'$tx6o$, ''))) / length($tx6o$'A bridge crosses that tile.'$tx6o$);
  if n <> 1 then raise exception 'frame_outside_stair_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A bridge crosses that tile.'$tx6o$, $tx6n$'Bridge over that tile.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'An outside staircase stands on open ground: clear the tree or the bush from it first.'$tx6o$, ''))) / length($tx6o$'An outside staircase stands on open ground: clear the tree or the bush from it first.'$tx6o$);
  if n <> 1 then raise exception 'frame_outside_stair_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'An outside staircase stands on open ground: clear the tree or the bush from it first.'$tx6o$, $tx6n$'Needs open ground: clear the tree or bush first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'An outside staircase stands on dry ground, not in water.'$tx6o$, ''))) / length($tx6o$'An outside staircase stands on dry ground, not in water.'$tx6o$);
  if n <> 1 then raise exception 'frame_outside_stair_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'An outside staircase stands on dry ground, not in water.'$tx6o$, $tx6n$'Not in water.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'An outside staircase climbs from the ground to storey ' || v_storey || ': plan storey ' || v_storey
        || ' of ' || p_b.name || ' first.';$tx6o$, ''))) / length($tx6o$return 'An outside staircase climbs from the ground to storey ' || v_storey || ': plan storey ' || v_storey
        || ' of ' || p_b.name || ' first.';$tx6o$);
  if n <> 1 then raise exception 'frame_outside_stair_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'An outside staircase climbs from the ground to storey ' || v_storey || ': plan storey ' || v_storey
        || ' of ' || p_b.name || ' first.';$tx6o$, $tx6n$return 'Outside staircase: ground to storey ' || v_storey || '. Plan ' || p_b.name
        || ' storey ' || v_storey || ' first.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'An outside staircase climbs from the ground to storey ' || v_storey || ': work on storey ' || v_storey
        || ' to plan one.';$tx6o$, ''))) / length($tx6o$return 'An outside staircase climbs from the ground to storey ' || v_storey || ': work on storey ' || v_storey
        || ' to plan one.';$tx6o$);
  if n <> 1 then raise exception 'frame_outside_stair_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'An outside staircase climbs from the ground to storey ' || v_storey || ': work on storey ' || v_storey
        || ' to plan one.';$tx6o$, $tx6n$return 'Outside staircase: ground to storey ' || v_storey || '. Switch to storey ' || v_storey
        || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'Its head goes against ' || p_b.name || ' and its foot out on the ground: turn it to climb toward the building.';$tx6o$, ''))) / length($tx6o$return 'Its head goes against ' || p_b.name || ' and its foot out on the ground: turn it to climb toward the building.';$tx6o$);
  if n <> 1 then raise exception 'frame_outside_stair_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'Its head goes against ' || p_b.name || ' and its foot out on the ground: turn it to climb toward the building.';$tx6o$, $tx6n$return 'Must climb toward ' || p_b.name || ': turn it.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The ground under it rises above the floor of storey ' || p_level || ': dig it down first.';$tx6o$, ''))) / length($tx6o$return 'The ground under it rises above the floor of storey ' || p_level || ': dig it down first.';$tx6o$);
  if n <> 1 then raise exception 'frame_outside_stair_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The ground under it rises above the floor of storey ' || p_level || ': dig it down first.';$tx6o$, $tx6n$return 'Ground under it above storey ' || p_level || ' floor: dig it down first.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'A drawbridge''s winch stands on that tile, and its gallows rise over it.';$tx6o$, ''))) / length($tx6o$return 'A drawbridge''s winch stands on that tile, and its gallows rise over it.';$tx6o$);
  if n <> 1 then raise exception 'frame_outside_stair_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'A drawbridge''s winch stands on that tile, and its gallows rise over it.';$tx6o$, $tx6n$return 'Drawbridge winch on that tile: no jetty over it.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('frame_jetty_refusal(uuid,uuid,building,integer,integer,text,integer,build_material_def,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'An aqueduct is carried over that tile.'$tx6o$, ''))) / length($tx6o$'An aqueduct is carried over that tile.'$tx6o$);
  if n <> 1 then raise exception 'frame_jetty_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'An aqueduct is carried over that tile.'$tx6o$, $tx6n$'Aqueduct over that tile.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You may only build on your own deed.'$tx6o$, ''))) / length($tx6o$'You may only build on your own deed.'$tx6o$);
  if n <> 1 then raise exception 'frame_jetty_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You may only build on your own deed.'$tx6o$, $tx6n$'Only on your own deed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A bridge crosses that tile.'$tx6o$, ''))) / length($tx6o$'A bridge crosses that tile.'$tx6o$);
  if n <> 1 then raise exception 'frame_jetty_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A bridge crosses that tile.'$tx6o$, $tx6n$'Bridge over that tile.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A ladder goes inside the footprint, not out on a jetty.'$tx6o$, ''))) / length($tx6o$'A ladder goes inside the footprint, not out on a jetty.'$tx6o$);
  if n <> 1 then raise exception 'frame_jetty_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A ladder goes inside the footprint, not out on a jetty.'$tx6o$, $tx6n$'Ladders: inside the footprint only, not on a jetty.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Work on storey 2 or above to floor a jetty here.'$tx6o$, ''))) / length($tx6o$'Work on storey 2 or above to floor a jetty here.'$tx6o$);
  if n <> 1 then raise exception 'frame_jetty_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Work on storey 2 or above to floor a jetty here.'$tx6o$, $tx6n$'Floor a jetty from storey 2 or above.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A jetty is floored out from a storey above the ground: plan another storey and work on it.'$tx6o$, ''))) / length($tx6o$'A jetty is floored out from a storey above the ground: plan another storey and work on it.'$tx6o$);
  if n <> 1 then raise exception 'frame_jetty_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A jetty is floored out from a storey above the ground: plan another storey and work on it.'$tx6o$, $tx6n$'Jetties need an upper storey: plan one first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A jetty is built over open ground: clear the tree or the bush from under it first.'$tx6o$, ''))) / length($tx6o$'A jetty is built over open ground: clear the tree or the bush from under it first.'$tx6o$);
  if n <> 1 then raise exception 'frame_jetty_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A jetty is built over open ground: clear the tree or the bush from under it first.'$tx6o$, $tx6n$'Needs open ground under it: clear the tree or bush first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'A roof goes out past the footprint only over a finished jetty of storey ' || p_b.levels || '.';$tx6o$, ''))) / length($tx6o$return 'A roof goes out past the footprint only over a finished jetty of storey ' || p_b.levels || '.';$tx6o$);
  if n <> 1 then raise exception 'frame_jetty_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'A roof goes out past the footprint only over a finished jetty of storey ' || p_b.levels || '.';$tx6o$, $tx6n$return 'Roof past the footprint: only over a finished storey ' || p_b.levels || ' jetty.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'That jetty is shut off from storey ' || p_b.levels
          || ' by a wall or a door, which makes it a balcony, and a balcony takes no roof.';$tx6o$, ''))) / length($tx6o$return 'That jetty is shut off from storey ' || p_b.levels
          || ' by a wall or a door, which makes it a balcony, and a balcony takes no roof.';$tx6o$);
  if n <> 1 then raise exception 'frame_jetty_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'That jetty is shut off from storey ' || p_b.levels
          || ' by a wall or a door, which makes it a balcony, and a balcony takes no roof.';$tx6o$, $tx6n$return 'Jetty walled off from storey ' || p_b.levels
          || ': balcony, no roof.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The ground under it rises above the floor of storey ' || p_level || ': dig it down, or floor the jetty out a storey higher.';$tx6o$, ''))) / length($tx6o$return 'The ground under it rises above the floor of storey ' || p_level || ': dig it down, or floor the jetty out a storey higher.';$tx6o$);
  if n <> 1 then raise exception 'frame_jetty_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The ground under it rises above the floor of storey ' || p_level || ': dig it down, or floor the jetty out a storey higher.';$tx6o$, $tx6n$return 'Ground under it above storey ' || p_level || ' floor: dig it down, or build the jetty a storey higher.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'A jetty rests on a finished full-height wall of storey ' || p_level || ': build one on a side this tile shares with '
        || p_b.name || ' first.';$tx6o$, ''))) / length($tx6o$return 'A jetty rests on a finished full-height wall of storey ' || p_level || ': build one on a side this tile shares with '
        || p_b.name || ' first.';$tx6o$);
  if n <> 1 then raise exception 'frame_jetty_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'A jetty rests on a finished full-height wall of storey ' || p_level || ': build one on a side this tile shares with '
        || p_b.name || ' first.';$tx6o$, $tx6n$return 'Jetty needs a finished full-height storey ' || p_level || ' wall on a side shared with '
        || p_b.name || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return p_mat.name || ' is too heavy to lay out past the walls. The walls under it carry ' || heft_word(bears) || ', no more.';$tx6o$, ''))) / length($tx6o$return p_mat.name || ' is too heavy to lay out past the walls. The walls under it carry ' || heft_word(bears) || ', no more.';$tx6o$);
  if n <> 1 then raise exception 'frame_jetty_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return p_mat.name || ' is too heavy to lay out past the walls. The walls under it carry ' || heft_word(bears) || ', no more.';$tx6o$, $tx6n$return p_mat.name || ' too heavy past the walls: they carry ' || heft_word(bears) || ' at most.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'A drawbridge''s winch stands on that tile, and its gallows rise over it.';$tx6o$, ''))) / length($tx6o$return 'A drawbridge''s winch stands on that tile, and its gallows rise over it.';$tx6o$);
  if n <> 1 then raise exception 'frame_jetty_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'A drawbridge''s winch stands on that tile, and its gallows rise over it.';$tx6o$, $tx6n$return 'Drawbridge winch on that tile: no jetty over it.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('aqueduct_says(uuid,bridge)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'It keeps the fountain at its foot full.'$tx6o$, ''))) / length($tx6o$'It keeps the fountain at its foot full.'$tx6o$);
  if n <> 1 then raise exception 'aqueduct_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It keeps the fountain at its foot full.'$tx6o$, $tx6n$'Keeps the fountain at its foot full.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It pours onto the foundation at its foot and runs off its lowest edge.'$tx6o$, ''))) / length($tx6o$'It pours onto the foundation at its foot and runs off its lowest edge.'$tx6o$);
  if n <> 1 then raise exception 'aqueduct_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It pours onto the foundation at its foot and runs off its lowest edge.'$tx6o$, $tx6n$'Pours onto the foundation; runs off its lowest edge.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The pool at its foot is full already, and spills over its lowest edge.'$tx6o$, ''))) / length($tx6o$'The pool at its foot is full already, and spills over its lowest edge.'$tx6o$);
  if n <> 1 then raise exception 'aqueduct_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The pool at its foot is full already, and spills over its lowest edge.'$tx6o$, $tx6n$'Pool at its foot full; spills over its lowest edge.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The pool at its foot is full already, and nothing beside it is lower: it keeps the water.'$tx6o$, ''))) / length($tx6o$'The pool at its foot is full already, and nothing beside it is lower: it keeps the water.'$tx6o$);
  if n <> 1 then raise exception 'aqueduct_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The pool at its foot is full already, and nothing beside it is lower: it keeps the water.'$tx6o$, $tx6n$'Pool at its foot full; nothing lower beside it, so it holds.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The pond at its foot is full already, and spills over its lip.'$tx6o$, ''))) / length($tx6o$'The pond at its foot is full already, and spills over its lip.'$tx6o$);
  if n <> 1 then raise exception 'aqueduct_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The pond at its foot is full already, and spills over its lip.'$tx6o$, $tx6n$'Pond at its foot full; spills over its lip.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It pours out onto the ground at its foot and runs away downhill.'$tx6o$, ''))) / length($tx6o$'It pours out onto the ground at its foot and runs away downhill.'$tx6o$);
  if n <> 1 then raise exception 'aqueduct_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It pours out onto the ground at its foot and runs away downhill.'$tx6o$, $tx6n$'Pours onto the ground; runs downhill.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The last span is laid. No spring''s water stands at its head at ' || b.height
      || ' or over, so the channel stays dry until some does.';$tx6o$, ''))) / length($tx6o$return 'The last span is laid. No spring''s water stands at its head at ' || b.height
      || ' or over, so the channel stays dry until some does.';$tx6o$);
  if n <> 1 then raise exception 'aqueduct_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The last span is laid. No spring''s water stands at its head at ' || b.height
      || ' or over, so the channel stays dry until some does.';$tx6o$, $tx6n$return 'Last span laid. Channel dry: no spring water at its head at ' || b.height
      || ' or over.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$when v_into ? 'volume' then 'It fills the hollow it runs into to ' || (v_into->>'level') || ' in '
      || fill_words((v_into->>'volume')::double precision / aqueduct_lps()) || ', and then spills over its lip and runs on.'$tx6o$, ''))) / length($tx6o$when v_into ? 'volume' then 'It fills the hollow it runs into to ' || (v_into->>'level') || ' in '
      || fill_words((v_into->>'volume')::double precision / aqueduct_lps()) || ', and then spills over its lip and runs on.'$tx6o$);
  if n <> 1 then raise exception 'aqueduct_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$when v_into ? 'volume' then 'It fills the hollow it runs into to ' || (v_into->>'level') || ' in '
      || fill_words((v_into->>'volume')::double precision / aqueduct_lps()) || ', and then spills over its lip and runs on.'$tx6o$, $tx6n$when v_into ? 'volume' then 'Fills the hollow to ' || (v_into->>'level') || ' in '
      || fill_words((v_into->>'volume')::double precision / aqueduct_lps()) || ', then spills over its lip.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The last span is laid and water runs along the channel, ' || aqueduct_flow()
    || ' litres a minute, out of its head instead of over that water''s lip. ' || v_foot;$tx6o$, ''))) / length($tx6o$return 'The last span is laid and water runs along the channel, ' || aqueduct_flow()
    || ' litres a minute, out of its head instead of over that water''s lip. ' || v_foot;$tx6o$);
  if n <> 1 then raise exception 'aqueduct_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The last span is laid and water runs along the channel, ' || aqueduct_flow()
    || ' litres a minute, out of its head instead of over that water''s lip. ' || v_foot;$tx6o$, $tx6n$return 'Last span laid. Flow ' || aqueduct_flow()
    || ' litres/min out of its head, not over its lip. ' || v_foot;$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('last_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'It is finished.'$tx6o$, ''))) / length($tx6o$'It is finished.'$tx6o$);
  if n <> 1 then raise exception 'last_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is finished.'$tx6o$, $tx6n$'Finished.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Work from one end. Walk to the open part of the span.'$tx6o$, ''))) / length($tx6o$'Work from one end. Walk to the open part of the span.'$tx6o$);
  if n <> 1 then raise exception 'last_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Work from one end. Walk to the open part of the span.'$tx6o$, $tx6n$'Stand by the open span.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You need a ' || lower((select coalesce(name, d.tool) from item_def where id = d.tool)) || '.';$tx6o$, ''))) / length($tx6o$return 'You need a ' || lower((select coalesce(name, d.tool) from item_def where id = d.tool)) || '.';$tx6o$);
  if n <> 1 then raise exception 'last_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You need a ' || lower((select coalesce(name, d.tool) from item_def where id = d.tool)) || '.';$tx6o$, $tx6n$return 'Need a ' || lower((select coalesce(name, d.tool) from item_def where id = d.tool)) || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'That span wants ' || span_wants(s.needed) || '; you have no '
          || lower((select coalesce(name, v_short) from item_def where id = v_short)) || ' to hand.';$tx6o$, ''))) / length($tx6o$return 'That span wants ' || span_wants(s.needed) || '; you have no '
          || lower((select coalesce(name, v_short) from item_def where id = v_short)) || ' to hand.';$tx6o$);
  if n <> 1 then raise exception 'last_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'That span wants ' || span_wants(s.needed) || '; you have no '
          || lower((select coalesce(name, v_short) from item_def where id = v_short)) || ' to hand.';$tx6o$, $tx6n$return 'Span needs ' || span_wants(s.needed) || '; no '
          || lower((select coalesce(name, v_short) from item_def where id = v_short)) || ' to hand.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return coalesce(v_rank, 'That is part of ' || v_short || '. Only its builders may '$tx6o$, ''))) / length($tx6o$return coalesce(v_rank, 'That is part of ' || v_short || '. Only its builders may '$tx6o$);
  if n <> 1 then raise exception 'last_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return coalesce(v_rank, 'That is part of ' || v_short || '. Only its builders may '$tx6o$, $tx6n$return coalesce(v_rank, 'Part of ' || v_short || ': only builders may '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It has taken no colour.'$tx6o$, ''))) / length($tx6o$'It has taken no colour.'$tx6o$);
  if n <> 1 then raise exception 'last_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It has taken no colour.'$tx6o$, $tx6n$'No colour to remove.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Nothing will take on that.'$tx6o$, ''))) / length($tx6o$'Nothing will take on that.'$tx6o$);
  if n <> 1 then raise exception 'last_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing will take on that.'$tx6o$, $tx6n$'Cannot be dyed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need a bucket of lye to strip it.'$tx6o$, ''))) / length($tx6o$'You need a bucket of lye to strip it.'$tx6o$);
  if n <> 1 then raise exception 'last_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need a bucket of lye to strip it.'$tx6o$, $tx6n$'Need a bucket of lye.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That is not a bed.'$tx6o$, ''))) / length($tx6o$'That is not a bed.'$tx6o$);
  if n <> 1 then raise exception 'last_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is not a bed.'$tx6o$, $tx6n$'Not a bed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You already wake up here.'$tx6o$, ''))) / length($tx6o$'You already wake up here.'$tx6o$);
  if n <> 1 then raise exception 'last_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You already wake up here.'$tx6o$, $tx6n$'Already your home.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That is not a bell.'$tx6o$, ''))) / length($tx6o$'That is not a bell.'$tx6o$);
  if n <> 1 then raise exception 'last_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is not a bell.'$tx6o$, $tx6n$'Not a bell.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Ring it on a settlement of yours; a bell in the wild calls nobody.'$tx6o$, ''))) / length($tx6o$'Ring it on a settlement of yours; a bell in the wild calls nobody.'$tx6o$);
  if n <> 1 then raise exception 'last_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Ring it on a settlement of yours; a bell in the wild calls nobody.'$tx6o$, $tx6n$'Only on your settlement.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'It is ' || world_clock(p_world) || ' and broad daylight. Sleep when it is dark.';$tx6o$, ''))) / length($tx6o$return 'It is ' || world_clock(p_world) || ' and broad daylight. Sleep when it is dark.';$tx6o$);
  if n <> 1 then raise exception 'last_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'It is ' || world_clock(p_world) || ' and broad daylight. Sleep when it is dark.';$tx6o$, $tx6n$return world_clock(p_world) || ': night only.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_aqueduct(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You take the aqueduct down.'$tx6o$, ''))) / length($tx6o$'You take the aqueduct down.'$tx6o$);
  if n <> 1 then raise exception 'perform_aqueduct: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You take the aqueduct down.'$tx6o$, $tx6n$'Aqueduct removed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$' The water at its head goes over its own lip again.'$tx6o$, ''))) / length($tx6o$' The water at its head goes over its own lip again.'$tx6o$);
  if n <> 1 then raise exception 'perform_aqueduct: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$' The water at its head goes over its own lip again.'$tx6o$, $tx6n$' Head spills over its lip again.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You set out an aqueduct of ' || v_n || ' span' || case when v_n > 1 then 's' else '' end
      || ' from the ' || (v_plan->>'head') || ' to the ' || (v_plan->>'foot') || ', its channel at ' || (v_plan->>'height')
      || '. Each span wants '$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You set out an aqueduct of ' || v_n || ' span' || case when v_n > 1 then 's' else '' end
      || ' from the ' || (v_plan->>'head') || ' to the ' || (v_plan->>'foot') || ', its channel at ' || (v_plan->>'height')
      || '. Each span wants '$tx6o$);
  if n <> 1 then raise exception 'perform_aqueduct: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You set out an aqueduct of ' || v_n || ' span' || case when v_n > 1 then 's' else '' end
      || ' from the ' || (v_plan->>'head') || ' to the ' || (v_plan->>'foot') || ', its channel at ' || (v_plan->>'height')
      || '. Each span wants '$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Aqueduct planned: ' || v_n || ' span' || case when v_n > 1 then 's' else '' end
      || ', ' || (v_plan->>'head') || ' to ' || (v_plan->>'foot') || ', channel at ' || (v_plan->>'height')
      || '. Per span: '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You work a ' || lower((select coalesce(name, v_want) from item_def where id = v_want))
        || ' into the span. It still wants ' || span_wants(s.needed) || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You work a ' || lower((select coalesce(name, v_want) from item_def where id = v_want))
        || ' into the span. It still wants ' || span_wants(s.needed) || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_aqueduct: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You work a ' || lower((select coalesce(name, v_want) from item_def where id = v_want))
        || ' into the span. It still wants ' || span_wants(s.needed) || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Added: ' || lower((select coalesce(name, v_want) from item_def where id = v_want))
        || '. Span needs ' || span_wants(s.needed) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'That span is laid. ' || v_left || ' still open.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'That span is laid. ' || v_left || ' still open.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_aqueduct: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'That span is laid. ' || v_left || ' still open.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Span laid. ' || v_left || ' open.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$case when array_length(v_parts, 1) > 0 then 'You take the aqueduct down and save ' || array_to_string(v_parts, ', ') || '.'$tx6o$, ''))) / length($tx6o$case when array_length(v_parts, 1) > 0 then 'You take the aqueduct down and save ' || array_to_string(v_parts, ', ') || '.'$tx6o$);
  if n <> 1 then raise exception 'perform_aqueduct: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$case when array_length(v_parts, 1) > 0 then 'You take the aqueduct down and save ' || array_to_string(v_parts, ', ') || '.'$tx6o$, $tx6n$case when array_length(v_parts, 1) > 0 then 'Aqueduct removed. Salvaged: ' || array_to_string(v_parts, ', ') || '.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('ramp_refusal(integer,integer,double precision,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$select case when p_la <> p_lb
              then 'One end is on ' || case when p_la = 0 then 'the ground' else 'storey ' || (p_la + 1) end
                || ' and the other on ' || case when p_lb = 0 then 'the ground' else 'storey ' || (p_lb + 1) end || ','
              else 'The two ends are' end
      || ' ' || to_char(p_apart, 'FM990') || ' apart in height. A deck rises at most ' || ramp_slope()::int
      || ' a tile, so that wants ' || ceil(p_apart / ramp_slope())::int || ' tiles of deck; this one has ' || p_n || '.'$tx6o$, ''))) / length($tx6o$select case when p_la <> p_lb
              then 'One end is on ' || case when p_la = 0 then 'the ground' else 'storey ' || (p_la + 1) end
                || ' and the other on ' || case when p_lb = 0 then 'the ground' else 'storey ' || (p_lb + 1) end || ','
              else 'The two ends are' end
      || ' ' || to_char(p_apart, 'FM990') || ' apart in height. A deck rises at most ' || ramp_slope()::int
      || ' a tile, so that wants ' || ceil(p_apart / ramp_slope())::int || ' tiles of deck; this one has ' || p_n || '.'$tx6o$);
  if n <> 1 then raise exception 'ramp_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select case when p_la <> p_lb
              then 'One end is on ' || case when p_la = 0 then 'the ground' else 'storey ' || (p_la + 1) end
                || ' and the other on ' || case when p_lb = 0 then 'the ground' else 'storey ' || (p_lb + 1) end || ','
              else 'The two ends are' end
      || ' ' || to_char(p_apart, 'FM990') || ' apart in height. A deck rises at most ' || ramp_slope()::int
      || ' a tile, so that wants ' || ceil(p_apart / ramp_slope())::int || ' tiles of deck; this one has ' || p_n || '.'$tx6o$, $tx6n$select 'Ends ' || to_char(p_apart, 'FM990') || ' apart in height'
      || case when p_la <> p_lb
              then ' (' || case when p_la = 0 then 'the ground' else 'storey ' || (p_la + 1) end
                || ' to ' || case when p_lb = 0 then 'the ground' else 'storey ' || (p_lb + 1) end || ')'
              else '' end
      || '. Max rise ' || ramp_slope()::int
      || '/tile: needs ' || ceil(p_apart / ramp_slope())::int || ' tiles of deck; has ' || p_n || '.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('bridge_reason(uuid,uuid,text,integer,integer,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Choose what to build it out of.'$tx6o$, ''))) / length($tx6o$'Choose what to build it out of.'$tx6o$);
  if n <> 1 then raise exception 'bridge_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Choose what to build it out of.'$tx6o$, $tx6n$'Choose a material.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A bridge runs straight. Pick an end level with this one, north, south, east or west.'$tx6o$, ''))) / length($tx6o$'A bridge runs straight. Pick an end level with this one, north, south, east or west.'$tx6o$);
  if n <> 1 then raise exception 'bridge_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A bridge runs straight. Pick an end level with this one, north, south, east or west.'$tx6o$, $tx6n$'Bridges run straight: pick an end due north, south, east or west.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is nothing between those two. Bridge a gap.'$tx6o$, ''))) / length($tx6o$'There is nothing between those two. Bridge a gap.'$tx6o$);
  if n <> 1 then raise exception 'bridge_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is nothing between those two. Bridge a gap.'$tx6o$, $tx6n$'No gap between those tiles.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A bridge lands on a finished deck: build the deck at that end first.'$tx6o$, ''))) / length($tx6o$'A bridge lands on a finished deck: build the deck at that end first.'$tx6o$);
  if n <> 1 then raise exception 'bridge_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A bridge lands on a finished deck: build the deck at that end first.'$tx6o$, $tx6n$'Needs a finished deck at that end.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Both ends want dry, solid ground to stand on.'$tx6o$, ''))) / length($tx6o$'Both ends want dry, solid ground to stand on.'$tx6o$);
  if n <> 1 then raise exception 'bridge_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Both ends want dry, solid ground to stand on.'$tx6o$, $tx6n$'Both ends need dry, solid ground.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'One end is already under a bridge.'$tx6o$, ''))) / length($tx6o$'One end is already under a bridge.'$tx6o$);
  if n <> 1 then raise exception 'bridge_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'One end is already under a bridge.'$tx6o$, $tx6n$'An end is already under a bridge.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Something is already bridged across there.'$tx6o$, ''))) / length($tx6o$'Something is already bridged across there.'$tx6o$);
  if n <> 1 then raise exception 'bridge_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Something is already bridged across there.'$tx6o$, $tx6n$'Already bridged there.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'A ' || lower(d.name) || ' spans ' || pk(p_world, p_uid, 'span:' || ('bridge_' || p_kind), d.span)::int
        || ' tiles; that is ' || n || '.';$tx6o$, ''))) / length($tx6o$return 'A ' || lower(d.name) || ' spans ' || pk(p_world, p_uid, 'span:' || ('bridge_' || p_kind), d.span)::int
        || ' tiles; that is ' || n || '.';$tx6o$);
  if n <> 1 then raise exception 'bridge_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'A ' || lower(d.name) || ' spans ' || pk(p_world, p_uid, 'span:' || ('bridge_' || p_kind), d.span)::int
        || ' tiles; that is ' || n || '.';$tx6o$, $tx6n$return d.name || ': max span ' || pk(p_world, p_uid, 'span:' || ('bridge_' || p_kind), d.span)::int
        || ' tiles; this is ' || n || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'A ' || lower(d.name) || ' goes from ground to ground, not to a storey.';$tx6o$, ''))) / length($tx6o$return 'A ' || lower(d.name) || ' goes from ground to ground, not to a storey.';$tx6o$);
  if n <> 1 then raise exception 'bridge_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'A ' || lower(d.name) || ' goes from ground to ground, not to a storey.';$tx6o$, $tx6n$return d.name || ': ground to ground only, not to a storey.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The two ends are ' || to_char(abs(ha - hb), 'FM990')
      || ' apart in height. One deck will not meet both; level one of them.';$tx6o$, ''))) / length($tx6o$return 'The two ends are ' || to_char(abs(ha - hb), 'FM990')
      || ' apart in height. One deck will not meet both; level one of them.';$tx6o$);
  if n <> 1 then raise exception 'bridge_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The two ends are ' || to_char(abs(ha - hb), 'FM990')
      || ' apart in height. One deck will not meet both; level one of them.';$tx6o$, $tx6n$return 'Ends ' || to_char(abs(ha - hb), 'FM990')
      || ' apart in height; max ' || end_slop() || '. Level one.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then return 'That is not a gap, it is ground. Walk it.'; end if;$tx6o$, ''))) / length($tx6o$then return 'That is not a gap, it is ground. Walk it.'; end if;$tx6o$);
  if n <> 1 then raise exception 'bridge_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then return 'That is not a gap, it is ground. Walk it.'; end if;$tx6o$, $tx6n$then return 'Ground under the span: needs ' || clearance() || ' clearance.'; end if;$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('pier_refusal(uuid,integer,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Piers go down on bare ground or what grows flat on it. Clear what stands or is laid here first.'$tx6o$, ''))) / length($tx6o$'Piers go down on bare ground or what grows flat on it. Clear what stands or is laid here first.'$tx6o$);
  if n <> 1 then raise exception 'pier_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Piers go down on bare ground or what grows flat on it. Clear what stands or is laid here first.'$tx6o$, $tx6n$'Piers need bare ground or flat growth: clear the tile first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$if v_plant is not null then return 'A ' || v_plant || ' grows here. Pull it up first.'; end if;$tx6o$, ''))) / length($tx6o$if v_plant is not null then return 'A ' || v_plant || ' grows here. Pull it up first.'; end if;$tx6o$);
  if n <> 1 then raise exception 'pier_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$if v_plant is not null then return 'A ' || v_plant || ' grows here. Pull it up first.'; end if;$tx6o$, $tx6n$if v_plant is not null then return 'Pull up the ' || v_plant || ' first.'; end if;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The ground here rises to ' || g.high || ', over the deck at ' || p_deck
      || '. A deck is level: plan a building on piers from its highest tile.';$tx6o$, ''))) / length($tx6o$return 'The ground here rises to ' || g.high || ', over the deck at ' || p_deck
      || '. A deck is level: plan a building on piers from its highest tile.';$tx6o$);
  if n <> 1 then raise exception 'pier_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The ground here rises to ' || g.high || ', over the deck at ' || p_deck
      || '. A deck is level: plan a building on piers from its highest tile.';$tx6o$, $tx6n$return 'Ground rises to ' || g.high || ', above the deck at ' || p_deck
      || ': plan from the highest tile.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The water here is ' || metres(g.water - g.low) || ' m deep. A pier stands in '
      || metres(pier_water()) || ' m of water at most.';$tx6o$, ''))) / length($tx6o$return 'The water here is ' || metres(g.water - g.low) || ' m deep. A pier stands in '
      || metres(pier_water()) || ' m of water at most.';$tx6o$);
  if n <> 1 then raise exception 'pier_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The water here is ' || metres(g.water - g.low) || ' m deep. A pier stands in '
      || metres(pier_water()) || ' m of water at most.';$tx6o$, $tx6n$return 'Water ' || metres(g.water - g.low) || ' m deep; piers stand in '
      || metres(pier_water()) || ' m at most.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The water here stands at ' || g.water || ' and the deck would be at ' || p_deck
      || '. A deck clears the water by ' || metres(pier_clear()) || ' m.';$tx6o$, ''))) / length($tx6o$return 'The water here stands at ' || g.water || ' and the deck would be at ' || p_deck
      || '. A deck clears the water by ' || metres(pier_clear()) || ' m.';$tx6o$);
  if n <> 1 then raise exception 'pier_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The water here stands at ' || g.water || ' and the deck would be at ' || p_deck
      || '. A deck clears the water by ' || metres(pier_clear()) || ' m.';$tx6o$, $tx6n$return 'Water at ' || g.water || ', deck at ' || p_deck
      || ': deck must clear water by ' || metres(pier_clear()) || ' m.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The ground falls ' || metres(p_deck - g.low) || ' m under the deck. A pier spans '
      || metres(pier_drop()) || ' m at most.';$tx6o$, ''))) / length($tx6o$return 'The ground falls ' || metres(p_deck - g.low) || ' m under the deck. A pier spans '
      || metres(pier_drop()) || ' m at most.';$tx6o$);
  if n <> 1 then raise exception 'pier_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The ground falls ' || metres(p_deck - g.low) || ' m under the deck. A pier spans '
      || metres(pier_drop()) || ' m at most.';$tx6o$, $tx6n$return 'Ground falls ' || metres(p_deck - g.low) || ' m under the deck; piers span '
      || metres(pier_drop()) || ' m at most.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('pier_says(uuid,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$' The deck is not built: nothing stands on the tile until it is.'$tx6o$, ''))) / length($tx6o$' The deck is not built: nothing stands on the tile until it is.'$tx6o$);
  if n <> 1 then raise exception 'pier_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$' The deck is not built: nothing stands on the tile until it is.'$tx6o$, $tx6n$' Deck not built: nothing stands on it yet.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$select ' It stands on piers under a deck at ' || b.deck || ', ' || metres(pier_drop_at(p_world, p_x, p_y))
        || ' m over the lowest ground under it.'$tx6o$, ''))) / length($tx6o$select ' It stands on piers under a deck at ' || b.deck || ', ' || metres(pier_drop_at(p_world, p_x, p_y))
        || ' m over the lowest ground under it.'$tx6o$);
  if n <> 1 then raise exception 'pier_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select ' It stands on piers under a deck at ' || b.deck || ', ' || metres(pier_drop_at(p_world, p_x, p_y))
        || ' m over the lowest ground under it.'$tx6o$, $tx6n$select ' On piers: deck at ' || b.deck || ', ' || metres(pier_drop_at(p_world, p_x, p_y))
        || ' m above the lowest ground.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then ' The water under it has risen to ' || g.water || ', '
                  || case when g.water < b.deck then metres(b.deck - g.water) || ' m under the deck' else 'over the deck' end || '.'$tx6o$, ''))) / length($tx6o$then ' The water under it has risen to ' || g.water || ', '
                  || case when g.water < b.deck then metres(b.deck - g.water) || ' m under the deck' else 'over the deck' end || '.'$tx6o$);
  if n <> 1 then raise exception 'pier_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then ' The water under it has risen to ' || g.water || ', '
                  || case when g.water < b.deck then metres(b.deck - g.water) || ' m under the deck' else 'over the deck' end || '.'$tx6o$, $tx6n$then ' Water under it: ' || g.water || ', '
                  || case when g.water < b.deck then metres(b.deck - g.water) || ' m below the deck' else 'over the deck' end || '.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_last(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You set out a ' || lower(d.name) || ' of ' || v_n || ' span'
      || case when v_n > 1 then 's' else '' end || ' across' || bridge_set_out(b.level, b.level_b, b.rise) || '. Each one wants '$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You set out a ' || lower(d.name) || ' of ' || v_n || ' span'
      || case when v_n > 1 then 's' else '' end || ' across' || bridge_set_out(b.level, b.level_b, b.rise) || '. Each one wants '$tx6o$);
  if n <> 1 then raise exception 'perform_last: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You set out a ' || lower(d.name) || ' of ' || v_n || ' span'
      || case when v_n > 1 then 's' else '' end || ' across' || bridge_set_out(b.level, b.level_b, b.rise) || '. Each one wants '$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Planned: ' || lower(d.name) || ', ' || v_n || ' span'
      || case when v_n > 1 then 's' else '' end || bridge_set_out(b.level, b.level_b, b.rise) || '. Per span: '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'That span is decked. ' || v_left || ' still open.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'That span is decked. ' || v_left || ' still open.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_last: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'That span is decked. ' || v_left || ' still open.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Span decked. ' || v_left || ' open.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The last span is decked and the ' || lower(bridge_name(b))
          || ' is open. ' || case when d.carts then 'A cart will cross it.'
                                  else 'Foot traffic only; nothing with a wheel.' end, 'system');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The last span is decked and the ' || lower(bridge_name(b))
          || ' is open. ' || case when d.carts then 'A cart will cross it.'
                                  else 'Foot traffic only; nothing with a wheel.' end, 'system');$tx6o$);
  if n <> 1 then raise exception 'perform_last: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The last span is decked and the ' || lower(bridge_name(b))
          || ' is open. ' || case when d.carts then 'A cart will cross it.'
                                  else 'Foot traffic only; nothing with a wheel.' end, 'system');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Last span decked: ' || lower(bridge_name(b))
          || ' open. ' || case when d.carts then 'Carts may cross.'
                                  else 'Foot traffic only.' end, 'system');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You work a '
        || lower((select coalesce(name, v_want) from item_def where id = v_want))
        || ' into the span. It still wants ' || span_wants(s.needed) || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You work a '
        || lower((select coalesce(name, v_want) from item_def where id = v_want))
        || ' into the span. It still wants ' || span_wants(s.needed) || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_last: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You work a '
        || lower((select coalesce(name, v_want) from item_def where id = v_want))
        || ' into the span. It still wants ' || span_wants(s.needed) || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Added: '
        || lower((select coalesce(name, v_want) from item_def where id = v_want))
        || '. Span needs ' || span_wants(s.needed) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then 'You take the ' || lower(bridge_name(b)) || ' down and save '
           || array_to_string(v_parts, ', ') || '.'
      else 'You take the ' || lower(bridge_name(b)) || ' down.' end, 'event');$tx6o$, ''))) / length($tx6o$then 'You take the ' || lower(bridge_name(b)) || ' down and save '
           || array_to_string(v_parts, ', ') || '.'
      else 'You take the ' || lower(bridge_name(b)) || ' down.' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_last: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then 'You take the ' || lower(bridge_name(b)) || ' down and save '
           || array_to_string(v_parts, ', ') || '.'
      else 'You take the ' || lower(bridge_name(b)) || ' down.' end, 'event');$tx6o$, $tx6n$then 'Removed: ' || lower(bridge_name(b)) || '. Salvaged: '
           || array_to_string(v_parts, ', ') || '.'
      else 'Removed: ' || lower(bridge_name(b)) || '.' end, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'It will not take. You tip the whole soured lot out of the '
        || lower(placed_name(pc)) || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'It will not take. You tip the whole soured lot out of the '
        || lower(placed_name(pc)) || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_last: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'It will not take. You tip the whole soured lot out of the '
        || lower(placed_name(pc)) || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Brew failed: '
        || lower(placed_name(pc)) || ' emptied.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, bd.done || ' (about ' || floor(bd.seconds / 60 + 0.5)::bigint || ' minutes)', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, bd.done || ' (about ' || floor(bd.seconds / 60 + 0.5)::bigint || ' minutes)', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_last: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, bd.done || ' (about ' || floor(bd.seconds / 60 + 0.5)::bigint || ' minutes)', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, bd.done || ' Ready in about ' || floor(bd.seconds / 60 + 0.5)::bigint || ' minutes.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You work ' || litres_word(v_n) || ' of ' || colour_word(v_want)
      || ' dye through it. It comes out ' || colour_word(v_want) || ', ' || v_want || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You work ' || litres_word(v_n) || ' of ' || colour_word(v_want)
      || ' dye through it. It comes out ' || colour_word(v_want) || ', ' || v_want || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_last: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You work ' || litres_word(v_n) || ' of ' || colour_word(v_want)
      || ' dye through it. It comes out ' || colour_word(v_want) || ', ' || v_want || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Dyed: ' || colour_word(v_want)
      || ' (' || v_want || '). Dye used: ' || litres_word(v_n) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You boil it out in lye. It is back to the colour of '$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You boil it out in lye. It is back to the colour of '$tx6o$);
  if n <> 1 then raise exception 'perform_last: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You boil it out in lye. It is back to the colour of '$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Dye removed: plain '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You make up the ' || lower(placed_name(pc))
      || '. This is where you will wake, whatever happens to you.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You make up the ' || lower(placed_name(pc))
      || '. This is where you will wake, whatever happens to you.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_last: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You make up the ' || lower(placed_name(pc))
      || '. This is where you will wake, whatever happens to you.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Home set: ' || lower(placed_name(pc))
      || '. You respawn here.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You ring the ' || lower(placed_name(pc)) || ' and it sounds over ' || r.name || '. '
      || case when v_n > 0 then v_n || ' wildermon ' || case when v_n = 1 then 'comes' else 'come' end || ' at the sound'
              else 'Nothing is working the deed to come' end
      || ', and every citizen hears where it hangs: ' || pc.x || ', ' || pc.y || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You ring the ' || lower(placed_name(pc)) || ' and it sounds over ' || r.name || '. '
      || case when v_n > 0 then v_n || ' wildermon ' || case when v_n = 1 then 'comes' else 'come' end || ' at the sound'
              else 'Nothing is working the deed to come' end
      || ', and every citizen hears where it hangs: ' || pc.x || ', ' || pc.y || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_last: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You ring the ' || lower(placed_name(pc)) || ' and it sounds over ' || r.name || '. '
      || case when v_n > 0 then v_n || ' wildermon ' || case when v_n = 1 then 'comes' else 'come' end || ' at the sound'
              else 'Nothing is working the deed to come' end
      || ', and every citizen hears where it hangs: ' || pc.x || ', ' || pc.y || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Rang: ' || lower(placed_name(pc)) || ' at ' || pc.x || ', ' || pc.y || '. Deed workers called: '
      || v_n || '. Citizens of ' || r.name || ' notified.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('bridge_state(uuid,bigint)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$|| '% · ' || left_n || ' still open';$tx6o$, ''))) / length($tx6o$|| '% · ' || left_n || ' still open';$tx6o$);
  if n <> 1 then raise exception 'bridge_state: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$|| '% · ' || left_n || ' still open';$tx6o$, $tx6n$|| '% · ' || left_n || ' open';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('bridge_set_out(integer,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$then ', its deck ' || case when p_rise > 0 then 'rising' else 'falling' end || ' ' || abs(p_rise)
                || ' from this end to the far one'$tx6o$, ''))) / length($tx6o$then ', its deck ' || case when p_rise > 0 then 'rising' else 'falling' end || ' ' || abs(p_rise)
                || ' from this end to the far one'$tx6o$);
  if n <> 1 then raise exception 'bridge_set_out: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then ', its deck ' || case when p_rise > 0 then 'rising' else 'falling' end || ' ' || abs(p_rise)
                || ' from this end to the far one'$tx6o$, $tx6n$then ', deck ' || case when p_rise > 0 then 'rising' else 'falling' end || ' ' || abs(p_rise)
                || ' toward the far end'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('deck_carries(uuid,integer,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$then m.name || ' is too heavy for the ' || lower(d.name) || ' deck under ' || b.name
      || ': a deck on piers carries what it is laid in, ' || heft_word(d.heft) || ', no more.' end$tx6o$, ''))) / length($tx6o$then m.name || ' is too heavy for the ' || lower(d.name) || ' deck under ' || b.name
      || ': a deck on piers carries what it is laid in, ' || heft_word(d.heft) || ', no more.' end$tx6o$);
  if n <> 1 then raise exception 'deck_carries: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then m.name || ' is too heavy for the ' || lower(d.name) || ' deck under ' || b.name
      || ': a deck on piers carries what it is laid in, ' || heft_word(d.heft) || ', no more.' end$tx6o$, $tx6n$then m.name || ' too heavy for the ' || lower(d.name) || ' deck under ' || b.name
      || ': it carries ' || heft_word(d.heft) || ' at most.' end$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('deck_bears(uuid,integer,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$then m.name || ' will not carry the ' || heft_word(w.over) || ' standing on ' || b.name
      || ': a deck on piers carries what it is laid in.' end$tx6o$, ''))) / length($tx6o$then m.name || ' will not carry the ' || heft_word(w.over) || ' standing on ' || b.name
      || ': a deck on piers carries what it is laid in.' end$tx6o$);
  if n <> 1 then raise exception 'deck_bears: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then m.name || ' will not carry the ' || heft_word(w.over) || ' standing on ' || b.name
      || ': a deck on piers carries what it is laid in.' end$tx6o$, $tx6n$then m.name || ' cannot carry the ' || heft_word(w.over) || ' on ' || b.name || '.' end$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('dig_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You need a trowel to go through the soil carefully.'$tx6o$, ''))) / length($tx6o$'You need a trowel to go through the soil carefully.'$tx6o$);
  if n <> 1 then raise exception 'dig_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need a trowel to go through the soil carefully.'$tx6o$, $tx6n$'Need a trowel.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You have been over this ground already. Try somewhere else.'$tx6o$, ''))) / length($tx6o$'You have been over this ground already. Try somewhere else.'$tx6o$);
  if n <> 1 then raise exception 'dig_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You have been over this ground already. Try somewhere else.'$tx6o$, $tx6n$'Already searched this tile.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That is not a fragment of anything.'$tx6o$, ''))) / length($tx6o$'That is not a fragment of anything.'$tx6o$);
  if n <> 1 then raise exception 'dig_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is not a fragment of anything.'$tx6o$, $tx6n$'Not a fragment.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That is not a book.'$tx6o$, ''))) / length($tx6o$'That is not a book.'$tx6o$);
  if n <> 1 then raise exception 'dig_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is not a book.'$tx6o$, $tx6n$'Not a book.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The pages are too far gone to read. Repair it first.'$tx6o$, ''))) / length($tx6o$'The pages are too far gone to read. Repair it first.'$tx6o$);
  if n <> 1 then raise exception 'dig_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The pages are too far gone to read. Repair it first.'$tx6o$, $tx6n$'Damage 90 or more: repair it first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You are missing ' || array_length(v_missing, 1) || ' of the ' || r.parts
      || ' pieces of the ' || r.name || ' (' || array_to_string(v_missing, ', ') || ').';$tx6o$, ''))) / length($tx6o$return 'You are missing ' || array_length(v_missing, 1) || ' of the ' || r.parts
      || ' pieces of the ' || r.name || ' (' || array_to_string(v_missing, ', ') || ').';$tx6o$);
  if n <> 1 then raise exception 'dig_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You are missing ' || array_length(v_missing, 1) || ' of the ' || r.parts
      || ' pieces of the ' || r.name || ' (' || array_to_string(v_missing, ', ') || ').';$tx6o$, $tx6n$return r.name || ': missing ' || array_length(v_missing, 1) || '/' || r.parts
      || ' pieces (' || array_to_string(v_missing, ', ') || ').';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_dig(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You go through the soil and turn up nothing but roots and small stones.'$tx6o$, ''))) / length($tx6o$'You go through the soil and turn up nothing but roots and small stones.'$tx6o$);
  if n <> 1 then raise exception 'perform_dig: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You go through the soil and turn up nothing but roots and small stones.'$tx6o$, $tx6n$'Found nothing.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You turn up a scrap of something worked, but you cannot tell what it was and it crumbles.'$tx6o$, ''))) / length($tx6o$'You turn up a scrap of something worked, but you cannot tell what it was and it crumbles.'$tx6o$);
  if n <> 1 then raise exception 'perform_dig: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You turn up a scrap of something worked, but you cannot tell what it was and it crumbles.'$tx6o$, $tx6n$'Found nothing: no relic within your archaeology.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'Your trowel turns up a Bauble of Regret, whole. It undoes one of your trades, '
        || 'in the Trades window. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'Your trowel turns up a Bauble of Regret, whole. It undoes one of your trades, '
        || 'in the Trades window. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_dig: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'Your trowel turns up a Bauble of Regret, whole. It undoes one of your trades, '
        || 'in the Trades window. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Found: Bauble of Regret, QL ' || to_char(v_ql, 'FM990.0') || '. Undoes one trade '
        || '(Trades window).', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'Your trowel turns up a tarnished ' || v_relic
        || ' bauble. Restore it to see what it does. (QL ' || to_char(v_ql, 'FM990.0')
        || ', damage ' || to_char(v_dmg, 'FM990') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'Your trowel turns up a tarnished ' || v_relic
        || ' bauble. Restore it to see what it does. (QL ' || to_char(v_ql, 'FM990.0')
        || ', damage ' || to_char(v_dmg, 'FM990') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_dig: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'Your trowel turns up a tarnished ' || v_relic
        || ' bauble. Restore it to see what it does. (QL ' || to_char(v_ql, 'FM990.0')
        || ', damage ' || to_char(v_dmg, 'FM990') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Found: tarnished ' || v_relic
        || ' bauble, QL ' || to_char(v_ql, 'FM990.0')
        || ', damage ' || to_char(v_dmg, 'FM990') || '. Restore it to use it.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'Your trowel turns up a fragment of ' || r.name || ', piece '
      || v_part || ' of ' || r.parts || '. (QL ' || to_char(v_ql, 'FM990.0')
      || ', damage ' || to_char(v_dmg, 'FM990') || ')'
      || case when v_left > 0 then ' ' || v_left || ' of ' || r.parts || ' still missing.'
              else ' That is all ' || r.parts || ' of them.' end, 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'Your trowel turns up a fragment of ' || r.name || ', piece '
      || v_part || ' of ' || r.parts || '. (QL ' || to_char(v_ql, 'FM990.0')
      || ', damage ' || to_char(v_dmg, 'FM990') || ')'
      || case when v_left > 0 then ' ' || v_left || ' of ' || r.parts || ' still missing.'
              else ' That is all ' || r.parts || ' of them.' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_dig: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'Your trowel turns up a fragment of ' || r.name || ', piece '
      || v_part || ' of ' || r.parts || '. (QL ' || to_char(v_ql, 'FM990.0')
      || ', damage ' || to_char(v_dmg, 'FM990') || ')'
      || case when v_left > 0 then ' ' || v_left || ' of ' || r.parts || ' still missing.'
              else ' That is all ' || r.parts || ' of them.' end, 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Found: ' || r.name || ' fragment '
      || v_part || '/' || r.parts || ', QL ' || to_char(v_ql, 'FM990.0')
      || ', damage ' || to_char(v_dmg, 'FM990') || '.'
      || case when v_left > 0 then ' Missing: ' || v_left || '/' || r.parts || '.'
              else ' All ' || r.parts || ' pieces held.' end, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You work through the ' || lower(item_name(it)) || '.'$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You work through the ' || lower(item_name(it)) || '.'$tx6o$);
  if n <> 1 then raise exception 'perform_dig: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You work through the ' || lower(item_name(it)) || '.'$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Studied: ' || lower(item_name(it)) || '.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then ' The lectern holds it open at the right angle and you make good use of the hour.'
              else ' Held in one hand, it is hard going. A lectern would be better.' end
      || case when v_gain > 0.0005 then '' else ' There is nothing left in it you do not already know.' end,$tx6o$, ''))) / length($tx6o$then ' The lectern holds it open at the right angle and you make good use of the hour.'
              else ' Held in one hand, it is hard going. A lectern would be better.' end
      || case when v_gain > 0.0005 then '' else ' There is nothing left in it you do not already know.' end,$tx6o$);
  if n <> 1 then raise exception 'perform_dig: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then ' The lectern holds it open at the right angle and you make good use of the hour.'
              else ' Held in one hand, it is hard going. A lectern would be better.' end
      || case when v_gain > 0.0005 then '' else ' There is nothing left in it you do not already know.' end,$tx6o$, $tx6n$then ' Lectern: skill gain ×' || lectern_gain() || '.'
              else ' No lectern (one gives ×' || lectern_gain() || ' skill gain).' end
      || case when v_gain > 0.0005 then '' else ' Nothing left to learn from it.' end,$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The pieces of the ' || r.name
      || case when pk(p_world, p_uid, 'harm:restore_relic', 1) <= 0
              then ' will not sit together, and they take no harm from the trying.'
              else ' will not sit together and you mark them trying.' end, 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The pieces of the ' || r.name
      || case when pk(p_world, p_uid, 'harm:restore_relic', 1) <= 0
              then ' will not sit together, and they take no harm from the trying.'
              else ' will not sit together and you mark them trying.' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_dig: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The pieces of the ' || r.name
      || case when pk(p_world, p_uid, 'harm:restore_relic', 1) <= 0
              then ' will not sit together, and they take no harm from the trying.'
              else ' will not sit together and you mark them trying.' end, 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Restore failed: ' || r.name
      || case when pk(p_world, p_uid, 'harm:restore_relic', 1) <= 0
              then ', no damage.'
              else ' pieces damaged.' end, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The pieces go back together and the ' || r.name || ' is whole: '
    || lower((select item_name(i) from item i where i.id = v_new))
    || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The pieces go back together and the ' || r.name || ' is whole: '
    || lower((select item_name(i) from item i where i.id = v_new))
    || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_dig: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The pieces go back together and the ' || r.name || ' is whole: '
    || lower((select item_name(i) from item i where i.id = v_new))
    || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Restored: '
    || lower((select item_name(i) from item i where i.id = v_new))
    || ', QL ' || to_char(v_ql, 'FM990.0') || '.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('restore_bauble(uuid,uuid,item)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The tarnish will not lift from the ' || t.id || ' bauble'
      || case when v_harm <= 0 then ', and it takes no harm from the trying.' else ' and you mark it trying.' end, 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The tarnish will not lift from the ' || t.id || ' bauble'
      || case when v_harm <= 0 then ', and it takes no harm from the trying.' else ' and you mark it trying.' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'restore_bauble: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The tarnish will not lift from the ' || t.id || ' bauble'
      || case when v_harm <= 0 then ', and it takes no harm from the trying.' else ' and you mark it trying.' end, 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Restore failed: ' || t.id || ' bauble'
      || case when v_harm <= 0 then ', no damage.' else ' damaged.' end, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, case when t.id = found_t.id then 'The tarnish comes away and the bauble is whole: '
      else 'The tarnish comes away and the ' || found_t.id || ' bauble is '
           || case when t.id ~ '^[aeiou]' then 'an ' else 'a ' end || t.id || ' one: ' end
    || lower((select item_name(i) from item i where i.id = v_new)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, case when t.id = found_t.id then 'The tarnish comes away and the bauble is whole: '
      else 'The tarnish comes away and the ' || found_t.id || ' bauble is '
           || case when t.id ~ '^[aeiou]' then 'an ' else 'a ' end || t.id || ' one: ' end
    || lower((select item_name(i) from item i where i.id = v_new)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'restore_bauble: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, case when t.id = found_t.id then 'The tarnish comes away and the bauble is whole: '
      else 'The tarnish comes away and the ' || found_t.id || ' bauble is '
           || case when t.id ~ '^[aeiou]' then 'an ' else 'a ' end || t.id || ' one: ' end
    || lower((select item_name(i) from item i where i.id = v_new)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Restored: '
    || lower((select item_name(i) from item i where i.id = v_new)) || ', QL ' || to_char(v_ql, 'FM990.0') || '.'
    || case when t.id = found_t.id then '' else ' Tier up: ' || found_t.id || ' to ' || t.id || '.' end, 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('build_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'That wants a Mason who has learned to repoint.'$tx6o$, ''))) / length($tx6o$'That wants a Mason who has learned to repoint.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That wants a Mason who has learned to repoint.'$tx6o$, $tx6n$'Needs perk: Repoint (Mason).'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no wall there.'$tx6o$, ''))) / length($tx6o$'There is no wall there.'$tx6o$);
  if n <> 3 then raise exception 'build_refusal: % of an anchor, not 3', n; end if;
  v := replace(v, $tx6o$'There is no wall there.'$tx6o$, $tx6n$'No wall there.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Only a wall of stone is repointed.'$tx6o$, ''))) / length($tx6o$'Only a wall of stone is repointed.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Only a wall of stone is repointed.'$tx6o$, $tx6n$'Stone walls only.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Finish it before you repoint it.'$tx6o$, ''))) / length($tx6o$'Finish it before you repoint it.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Finish it before you repoint it.'$tx6o$, $tx6n$'Finish it first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Choose the stone to lay it in.'$tx6o$, ''))) / length($tx6o$'Choose the stone to lay it in.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Choose the stone to lay it in.'$tx6o$, $tx6n$'Choose a stone.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no building next to this tile.'$tx6o$, ''))) / length($tx6o$'There is no building next to this tile.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no building next to this tile.'$tx6o$, $tx6n$'No building next to this tile.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The footprint cannot change once upper floors are planned.'$tx6o$, ''))) / length($tx6o$'The footprint cannot change once upper floors are planned.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The footprint cannot change once upper floors are planned.'$tx6o$, $tx6n$'Footprint fixed once upper storeys are planned.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Remove the upper floors first.'$tx6o$, ''))) / length($tx6o$'Remove the upper floors first.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Remove the upper floors first.'$tx6o$, $tx6n$'Remove the upper storeys first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Fill in the cellar under it first.'$tx6o$, ''))) / length($tx6o$'Fill in the cellar under it first.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Fill in the cellar under it first.'$tx6o$, $tx6n$'Fill in the cellar first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Remove the walls and floor on this tile first.'$tx6o$, ''))) / length($tx6o$'Remove the walls and floor on this tile first.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Remove the walls and floor on this tile first.'$tx6o$, $tx6n$'Remove this tile''s walls and floor first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Choose a side, a wall type and a material.'$tx6o$, ''))) / length($tx6o$'Choose a side, a wall type and a material.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Choose a side, a wall type and a material.'$tx6o$, $tx6n$'Choose a side, wall type and material.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Build the floor of this storey first.'$tx6o$, ''))) / length($tx6o$'Build the floor of this storey first.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Build the floor of this storey first.'$tx6o$, $tx6n$'Build this storey''s floor first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is already a wall on that side.'$tx6o$, ''))) / length($tx6o$'There is already a wall on that side.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is already a wall on that side.'$tx6o$, $tx6n$'Already a wall on that side.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Choose a side, a kind and a material.'$tx6o$, ''))) / length($tx6o$'Choose a side, a kind and a material.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Choose a side, a kind and a material.'$tx6o$, $tx6n$'Choose a side, kind and material.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Only fences and half walls stand on their own.'$tx6o$, ''))) / length($tx6o$'Only fences and half walls stand on their own.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Only fences and half walls stand on their own.'$tx6o$, $tx6n$'Only fences and half walls stand alone.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That is part of a building: plan a wall instead.'$tx6o$, ''))) / length($tx6o$'That is part of a building: plan a wall instead.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is part of a building: plan a wall instead.'$tx6o$, $tx6n$'Part of a building: plan a wall.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A building stands on the other side of that border.'$tx6o$, ''))) / length($tx6o$'A building stands on the other side of that border.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A building stands on the other side of that border.'$tx6o$, $tx6n$'Building on the other side of that border.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That border is the edge of the world.'$tx6o$, ''))) / length($tx6o$'That border is the edge of the world.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That border is the edge of the world.'$tx6o$, $tx6n$'Map edge.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Fences do not stand in water.'$tx6o$, ''))) / length($tx6o$'Fences do not stand in water.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Fences do not stand in water.'$tx6o$, $tx6n$'Not in water.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no room for posts there.'$tx6o$, ''))) / length($tx6o$'There is no room for posts there.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no room for posts there.'$tx6o$, $tx6n$'No room for posts.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is already something on that border.'$tx6o$, ''))) / length($tx6o$'There is already something on that border.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is already something on that border.'$tx6o$, $tx6n$'Border already taken.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no wall planned there.'$tx6o$, ''))) / length($tx6o$'There is no wall planned there.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no wall planned there.'$tx6o$, $tx6n$'No wall planned there.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That wall is finished.'$tx6o$, ''))) / length($tx6o$'That wall is finished.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That wall is finished.'$tx6o$, $tx6n$'Wall finished.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Finish it before you paint it.'$tx6o$, ''))) / length($tx6o$'Finish it before you paint it.'$tx6o$);
  if n <> 2 then raise exception 'build_refusal: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'Finish it before you paint it.'$tx6o$, $tx6n$'Finish it first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It has taken no colour.'$tx6o$, ''))) / length($tx6o$'It has taken no colour.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It has taken no colour.'$tx6o$, $tx6n$'No colour to remove.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need a bucket of lye to scrub it back.'$tx6o$, ''))) / length($tx6o$'You need a bucket of lye to scrub it back.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need a bucket of lye to scrub it back.'$tx6o$, $tx6n$'Need a bucket of lye.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no floor here.'$tx6o$, ''))) / length($tx6o$'There is no floor here.'$tx6o$);
  if n <> 2 then raise exception 'build_refusal: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'There is no floor here.'$tx6o$, $tx6n$'No floor here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Take the roof off first.'$tx6o$, ''))) / length($tx6o$'Take the roof off first.'$tx6o$);
  if n <> 2 then raise exception 'build_refusal: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'Take the roof off first.'$tx6o$, $tx6n$'Remove the roof first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Nothing rests on a fence, a half wall or a railing: the storey below needs walls, or finished columns at both ends of every open side.'$tx6o$, ''))) / length($tx6o$'Nothing rests on a fence, a half wall or a railing: the storey below needs walls, or finished columns at both ends of every open side.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing rests on a fence, a half wall or a railing: the storey below needs walls, or finished columns at both ends of every open side.'$tx6o$, $tx6n$'Storey below needs walls, or finished columns at both ends of each open side. Fences, half walls and railings carry nothing.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Plan the floor of the storey below first.'$tx6o$, ''))) / length($tx6o$'Plan the floor of the storey below first.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Plan the floor of the storey below first.'$tx6o$, $tx6n$'Plan the floor below first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is already roof planned here.'$tx6o$, ''))) / length($tx6o$'There is already roof planned here.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is already roof planned here.'$tx6o$, $tx6n$'Roof already planned here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is already a floor planned here.'$tx6o$, ''))) / length($tx6o$'There is already a floor planned here.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is already a floor planned here.'$tx6o$, $tx6n$'Floor already planned here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is nothing planned here.'$tx6o$, ''))) / length($tx6o$'There is nothing planned here.'$tx6o$);
  if n <> 2 then raise exception 'build_refusal: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'There is nothing planned here.'$tx6o$, $tx6n$'Nothing planned here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That is already finished.'$tx6o$, ''))) / length($tx6o$'That is already finished.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is already finished.'$tx6o$, $tx6n$'Already finished.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is nothing here to remove.'$tx6o$, ''))) / length($tx6o$'There is nothing here to remove.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is nothing here to remove.'$tx6o$, $tx6n$'Nothing to remove.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Somebody is down in the cellar, and this is a way up out of it.'$tx6o$, ''))) / length($tx6o$'Somebody is down in the cellar, and this is a way up out of it.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Somebody is down in the cellar, and this is a way up out of it.'$tx6o$, $tx6n$'Someone is in the cellar: this is its way out.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Take down the walls standing on it first.'$tx6o$, ''))) / length($tx6o$'Take down the walls standing on it first.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Take down the walls standing on it first.'$tx6o$, $tx6n$'Remove the walls on it first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no upper storey.'$tx6o$, ''))) / length($tx6o$'There is no upper storey.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no upper storey.'$tx6o$, $tx6n$'No upper storey.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Take down the walls of the top storey first.'$tx6o$, ''))) / length($tx6o$'Take down the walls of the top storey first.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Take down the walls of the top storey first.'$tx6o$, $tx6n$'Remove the top storey''s walls first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Tear up the floors of the top storey first.'$tx6o$, ''))) / length($tx6o$'Tear up the floors of the top storey first.'$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Tear up the floors of the top storey first.'$tx6o$, $tx6n$'Remove the top storey''s floors first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return mat.name || ' is too heavy to raise over what is under it. This storey carries '$tx6o$, ''))) / length($tx6o$return mat.name || ' is too heavy to raise over what is under it. This storey carries '$tx6o$);
  if n <> 2 then raise exception 'build_refusal: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$return mat.name || ' is too heavy to raise over what is under it. This storey carries '$tx6o$, $tx6n$return mat.name || ' too heavy for what is under it: this storey carries '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$|| heft_word(bears) || ', no more.';$tx6o$, ''))) / length($tx6o$|| heft_word(bears) || ', no more.';$tx6o$);
  if n <> 2 then raise exception 'build_refusal: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$|| heft_word(bears) || ', no more.';$tx6o$, $tx6n$|| heft_word(bears) || ' at most.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'Raising a ' || (b.levels + 1) || nth(b.levels + 1) || ' storey over '
          || lower(under.name) || ' takes ' || under.skill || ' '
          || least(100, b.levels * storey_skill()) || '. You have '$tx6o$, ''))) / length($tx6o$return 'Raising a ' || (b.levels + 1) || nth(b.levels + 1) || ' storey over '
          || lower(under.name) || ' takes ' || under.skill || ' '
          || least(100, b.levels * storey_skill()) || '. You have '$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'Raising a ' || (b.levels + 1) || nth(b.levels + 1) || ' storey over '
          || lower(under.name) || ' takes ' || under.skill || ' '
          || least(100, b.levels * storey_skill()) || '. You have '$tx6o$, $tx6n$return 'Storey ' || (b.levels + 1) || ' over '
          || lower(under.name) || ' needs ' || under.skill || ' '
          || least(100, b.levels * storey_skill()) || '; have '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return coalesce(worst.name, 'What this is built of') || ' will not stand '
          || (cap + 1) || ' storeys. ' || cap || ' is as high as it goes.';$tx6o$, ''))) / length($tx6o$return coalesce(worst.name, 'What this is built of') || ' will not stand '
          || (cap + 1) || ' storeys. ' || cap || ' is as high as it goes.';$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return coalesce(worst.name, 'What this is built of') || ' will not stand '
          || (cap + 1) || ' storeys. ' || cap || ' is as high as it goes.';$tx6o$, $tx6n$return coalesce(worst.name, 'Its material') || ': max '
          || cap || ' storeys.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return mat.name || ' will not stand ' || b.levels || ' storeys. ' || v_stands || ' is as high as it goes.';$tx6o$, ''))) / length($tx6o$return mat.name || ' will not stand ' || b.levels || ' storeys. ' || v_stands || ' is as high as it goes.';$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return mat.name || ' will not stand ' || b.levels || ' storeys. ' || v_stands || ' is as high as it goes.';$tx6o$, $tx6n$return mat.name || ': max ' || v_stands || ' storeys; this is ' || b.levels || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'Buildings cannot be taller than ' || (max_levels()::int + tall_of(p_world, b.id)) || ' storeys.';$tx6o$, ''))) / length($tx6o$return 'Buildings cannot be taller than ' || (max_levels()::int + tall_of(p_world, b.id)) || ' storeys.';$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'Buildings cannot be taller than ' || (max_levels()::int + tall_of(p_world, b.id)) || ' storeys.';$tx6o$, $tx6n$return 'Max ' || (max_levels()::int + tall_of(p_world, b.id)) || ' storeys.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return mat.name || ' will not carry the ' || heft_word(v_over) || ' standing on it.';$tx6o$, ''))) / length($tx6o$return mat.name || ' will not carry the ' || heft_word(v_over) || ' standing on it.';$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return mat.name || ' will not carry the ' || heft_word(v_over) || ' standing on it.';$tx6o$, $tx6n$return mat.name || ' cannot carry the ' || heft_word(v_over) || ' above it.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'Work on storey 2 or above to plan ' || case when kind = 'ladder' then 'a ladder' else 'stairs' end || ' here.';$tx6o$, ''))) / length($tx6o$return 'Work on storey 2 or above to plan ' || case when kind = 'ladder' then 'a ladder' else 'stairs' end || ' here.';$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'Work on storey 2 or above to plan ' || case when kind = 'ladder' then 'a ladder' else 'stairs' end || ' here.';$tx6o$, $tx6n$return 'Plan ' || case when kind = 'ladder' then 'a ladder' else 'stairs' end || ' from storey 2 or above.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$if mat.id = v_was.id then return 'It is ' || lower(mat.name) || ' already.'; end if;$tx6o$, ''))) / length($tx6o$if mat.id = v_was.id then return 'It is ' || lower(mat.name) || ' already.'; end if;$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$if mat.id = v_was.id then return 'It is ' || lower(mat.name) || ' already.'; end if;$tx6o$, $tx6n$if mat.id = v_was.id then return 'Already ' || lower(mat.name) || '.'; end if;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You need ' || bill_text(w.material, w.needed) || '.';$tx6o$, ''))) / length($tx6o$return 'You need ' || bill_text(w.material, w.needed) || '.';$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You need ' || bill_text(w.material, w.needed) || '.';$tx6o$, $tx6n$return 'Need ' || bill_text(w.material, w.needed) || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You need ' || bill_text(f.material, f.needed) || '.';$tx6o$, ''))) / length($tx6o$return 'You need ' || bill_text(f.material, f.needed) || '.';$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You need ' || bill_text(f.material, f.needed) || '.';$tx6o$, $tx6n$return 'Need ' || bill_text(f.material, f.needed) || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You need ' || bill_text(mat.id, v_bill) || '.';$tx6o$, ''))) / length($tx6o$return 'You need ' || bill_text(mat.id, v_bill) || '.';$tx6o$);
  if n <> 1 then raise exception 'build_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You need ' || bill_text(mat.id, v_bill) || '.';$tx6o$, $tx6n$return 'Need ' || bill_text(mat.id, v_bill) || '.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('cellar_flight_refusal(uuid,integer,integer,integer,text,boolean)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Stairs and ladders belong to an upper storey; plan another storey first.'$tx6o$, ''))) / length($tx6o$'Stairs and ladders belong to an upper storey; plan another storey first.'$tx6o$);
  if n <> 1 then raise exception 'cellar_flight_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Stairs and ladders belong to an upper storey; plan another storey first.'$tx6o$, $tx6n$'Stairs and ladders need an upper storey: plan one first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is a field here: clear the field before you plan a way down through it.'$tx6o$, ''))) / length($tx6o$'There is a field here: clear the field before you plan a way down through it.'$tx6o$);
  if n <> 1 then raise exception 'cellar_flight_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is a field here: clear the field before you plan a way down through it.'$tx6o$, $tx6n$'Field here: clear it first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'Dig the cellar out under it first: it is ' || coalesce(c.dug, 0) || ' of ' || cellar_depth()::int || ' down.';$tx6o$, ''))) / length($tx6o$return 'Dig the cellar out under it first: it is ' || coalesce(c.dug, 0) || ' of ' || cellar_depth()::int || ' down.';$tx6o$);
  if n <> 1 then raise exception 'cellar_flight_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'Dig the cellar out under it first: it is ' || coalesce(c.dug, 0) || ' of ' || cellar_depth()::int || ' down.';$tx6o$, $tx6n$return 'Dig the cellar first: ' || coalesce(c.dug, 0) || '/' || cellar_depth()::int || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'Its foot would come down on ' || v_fx || ',' || v_fy || ', and there is no cellar dug out there to come down on.';$tx6o$, ''))) / length($tx6o$return 'Its foot would come down on ' || v_fx || ',' || v_fy || ', and there is no cellar dug out there to come down on.';$tx6o$);
  if n <> 1 then raise exception 'cellar_flight_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'Its foot would come down on ' || v_fx || ',' || v_fy || ', and there is no cellar dug out there to come down on.';$tx6o$, $tx6n$return 'Foot would land on ' || v_fx || ',' || v_fy || ': no cellar dug there.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('frame_refusal(uuid,uuid,text,jsonb,building)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Take down the columns on its corners first.'$tx6o$, ''))) / length($tx6o$'Take down the columns on its corners first.'$tx6o$);
  if n <> 1 then raise exception 'frame_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Take down the columns on its corners first.'$tx6o$, $tx6n$'Remove the corner columns first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Build the floor of this storey first.'$tx6o$, ''))) / length($tx6o$'Build the floor of this storey first.'$tx6o$);
  if n <> 1 then raise exception 'frame_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Build the floor of this storey first.'$tx6o$, $tx6n$'Build this storey''s floor first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Take down the railing standing on it first.'$tx6o$, ''))) / length($tx6o$'Take down the railing standing on it first.'$tx6o$);
  if n <> 1 then raise exception 'frame_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Take down the railing standing on it first.'$tx6o$, $tx6n$'Remove the railing on it first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Take down the columns of the top storey first.'$tx6o$, ''))) / length($tx6o$'Take down the columns of the top storey first.'$tx6o$);
  if n <> 1 then raise exception 'frame_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Take down the columns of the top storey first.'$tx6o$, $tx6n$'Remove the top storey''s columns first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return mat.name || ' is too heavy to raise over what is under it. This storey carries '
          || heft_word(bears) || ', no more.';$tx6o$, ''))) / length($tx6o$return mat.name || ' is too heavy to raise over what is under it. This storey carries '
          || heft_word(bears) || ', no more.';$tx6o$);
  if n <> 1 then raise exception 'frame_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return mat.name || ' is too heavy to raise over what is under it. This storey carries '
          || heft_word(bears) || ', no more.';$tx6o$, $tx6n$return mat.name || ' too heavy for what is under it: this storey carries '
          || heft_word(bears) || ' at most.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'A jetty of storey ' || (v_lvl + 1) || ' rests on this wall: raise a column at each end of it, or tear the jetty up, first.';$tx6o$, ''))) / length($tx6o$return 'A jetty of storey ' || (v_lvl + 1) || ' rests on this wall: raise a column at each end of it, or tear the jetty up, first.';$tx6o$);
  if n <> 1 then raise exception 'frame_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'A jetty of storey ' || (v_lvl + 1) || ' rests on this wall: raise a column at each end of it, or tear the jetty up, first.';$tx6o$, $tx6n$return 'Storey ' || (v_lvl + 1) || ' jetty rests on this wall: add a column at each end, or remove the jetty, first.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You need ' || bill_text(col.material, col.needed) || '.';$tx6o$, ''))) / length($tx6o$return 'You need ' || bill_text(col.material, col.needed) || '.';$tx6o$);
  if n <> 1 then raise exception 'frame_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You need ' || bill_text(col.material, col.needed) || '.';$tx6o$, $tx6n$return 'Need ' || bill_text(col.material, col.needed) || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Only a flat roof is a terrace.'$tx6o$, ''))) / length($tx6o$'Only a flat roof is a terrace.'$tx6o$);
  if n <> 1 then raise exception 'frame_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Only a flat roof is a terrace.'$tx6o$, $tx6n$'Terraces: flat roofs only.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Only a railing goes round a terrace.'$tx6o$, ''))) / length($tx6o$'Only a railing goes round a terrace.'$tx6o$);
  if n <> 1 then raise exception 'frame_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Only a railing goes round a terrace.'$tx6o$, $tx6n$'Terraces: railings only.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Finish the roof on this tile first.'$tx6o$, ''))) / length($tx6o$'Finish the roof on this tile first.'$tx6o$);
  if n <> 1 then raise exception 'frame_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Finish the roof on this tile first.'$tx6o$, $tx6n$'Finish this tile''s roof first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A railing goes on the edge of a storey above the ground, of a deck on piers, or round a terrace. On the ground, plan a fence.'$tx6o$, ''))) / length($tx6o$'A railing goes on the edge of a storey above the ground, of a deck on piers, or round a terrace. On the ground, plan a fence.'$tx6o$);
  if n <> 1 then raise exception 'frame_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A railing goes on the edge of a storey above the ground, of a deck on piers, or round a terrace. On the ground, plan a fence.'$tx6o$, $tx6n$'Railings: upper storey edges, decks on piers or terraces. On the ground, plan a fence.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The roof is over that jetty: take it off first. A balcony takes no roof.'$tx6o$, ''))) / length($tx6o$'The roof is over that jetty: take it off first. A balcony takes no roof.'$tx6o$);
  if n <> 1 then raise exception 'frame_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The roof is over that jetty: take it off first. A balcony takes no roof.'$tx6o$, $tx6n$'Roof over that jetty: remove it first. Balconies take no roof.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Choose a corner of the tile.'$tx6o$, ''))) / length($tx6o$'Choose a corner of the tile.'$tx6o$);
  if n <> 2 then raise exception 'frame_refusal: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'Choose a corner of the tile.'$tx6o$, $tx6n$'Choose a corner.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is already a column on that corner.'$tx6o$, ''))) / length($tx6o$'There is already a column on that corner.'$tx6o$);
  if n <> 1 then raise exception 'frame_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is already a column on that corner.'$tx6o$, $tx6n$'Already a column on that corner.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Move what stands in that corner first.'$tx6o$, ''))) / length($tx6o$'Move what stands in that corner first.'$tx6o$);
  if n <> 1 then raise exception 'frame_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Move what stands in that corner first.'$tx6o$, $tx6n$'Something placed in that corner: move it first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no column planned there.'$tx6o$, ''))) / length($tx6o$'There is no column planned there.'$tx6o$);
  if n <> 1 then raise exception 'frame_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no column planned there.'$tx6o$, $tx6n$'No column planned there.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That column is finished.'$tx6o$, ''))) / length($tx6o$'That column is finished.'$tx6o$);
  if n <> 1 then raise exception 'frame_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That column is finished.'$tx6o$, $tx6n$'Column finished.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no column there.'$tx6o$, ''))) / length($tx6o$'There is no column there.'$tx6o$);
  if n <> 1 then raise exception 'frame_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no column there.'$tx6o$, $tx6n$'No column there.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_building(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You take up the flooring there.'$tx6o$, ''))) / length($tx6o$'You take up the flooring there.'$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You take up the flooring there.'$tx6o$, $tx6n$'Flooring removed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You plan ' || nm || ' here. Extend it onto neighbouring flat packed '
      || 'tiles, then plan walls on its borders.'), 'event');$tx6o$, ''))) / length($tx6o$'You plan ' || nm || ' here. Extend it onto neighbouring flat packed '
      || 'tiles, then plan walls on its borders.'), 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You plan ' || nm || ' here. Extend it onto neighbouring flat packed '
      || 'tiles, then plan walls on its borders.'), 'event');$tx6o$, $tx6n$'Planned: ' || nm || '. Next: extend onto adjacent packed '
      || 'tiles, then plan walls on its borders.'), 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You add the tile to ' || b.name || '.'), 'event');$tx6o$, ''))) / length($tx6o$'You add the tile to ' || b.name || '.'), 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You add the tile to ' || b.name || '.'), 'event');$tx6o$, $tx6n$'Added to ' || b.name || '.'), 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You remove the tile from ' || b.name || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You remove the tile from ' || b.name || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You remove the tile from ' || b.name || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Removed from ' || b.name || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You remove the last of ' || b.name || '''s plan.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You remove the last of ' || b.name || '''s plan.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You remove the last of ' || b.name || '''s plan.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Plan removed: ' || b.name || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The building is now called ' || nm || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The building is now called ' || nm || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The building is now called ' || nm || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Building renamed: ' || nm || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You mark out a ' || lower(mat.name) || ' ' || lower(wt.name)
        || ' on the ' || side_name(side) || ' border. It needs ' || bill_text(mat.id, bill) || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You mark out a ' || lower(mat.name) || ' ' || lower(wt.name)
        || ' on the ' || side_name(side) || ' border. It needs ' || bill_text(mat.id, bill) || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You mark out a ' || lower(mat.name) || ' ' || lower(wt.name)
        || ' on the ' || side_name(side) || ' border. It needs ' || bill_text(mat.id, bill) || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Planned: ' || lower(mat.name) || ' ' || lower(wt.name)
        || ', ' || side_name(side) || ' border. Needs ' || bill_text(mat.id, bill) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, plan_line(wt.id, mat.id, side) || ' It needs ' || bill_text(mat.id, bill) || '.'$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, plan_line(wt.id, mat.id, side) || ' It needs ' || bill_text(mat.id, bill) || '.'$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, plan_line(wt.id, mat.id, side) || ' It needs ' || bill_text(mat.id, bill) || '.'$tx6o$, $tx6n$perform tell(p_world, p_uid, plan_line(wt.id, mat.id, side) || ' Needs ' || bill_text(mat.id, bill) || '.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You finish the ' || lower(mat.name) || ' ' || what || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You finish the ' || lower(mat.name) || ' ' || what || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You finish the ' || lower(mat.name) || ' ' || what || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Built: ' || lower(mat.name) || ' ' || what || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You fit ' || laid_text(v_laid) || ' into the wall. Still needed: '$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You fit ' || laid_text(v_laid) || ' into the wall. Still needed: '$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You fit ' || laid_text(v_laid) || ' into the wall. Still needed: '$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Added: ' || laid_text(v_laid) || '. Still needed: '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You take down the '
      || case when wt.low then lower(wt.name) else 'wall' end
      || ' on the ' || side_name(side) || ' side'
      || case when v_back > 0 then ' and save ' || v_back || ' ' || material_name(v_stone, v_back) else '' end$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You take down the '
      || case when wt.low then lower(wt.name) else 'wall' end
      || ' on the ' || side_name(side) || ' side'
      || case when v_back > 0 then ' and save ' || v_back || ' ' || material_name(v_stone, v_back) else '' end$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You take down the '
      || case when wt.low then lower(wt.name) else 'wall' end
      || ' on the ' || side_name(side) || ' side'
      || case when v_back > 0 then ' and save ' || v_back || ' ' || material_name(v_stone, v_back) else '' end$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Removed: '
      || case when wt.low then lower(wt.name) else 'wall' end
      || ', ' || side_name(side) || ' side'
      || case when v_back > 0 then '. Returned: ' || v_back || ' ' || material_name(v_stone, v_back) else '' end$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You take the ' || lower(v_was.name) || ' out of the wall on the '
      || side_name(side) || ' side and lay it again in ' || lower(mat.name)
      || case when v_back > 0 then ', and save ' || v_back || ' ' || material_name(v_stone, v_back) else '' end$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You take the ' || lower(v_was.name) || ' out of the wall on the '
      || side_name(side) || ' side and lay it again in ' || lower(mat.name)
      || case when v_back > 0 then ', and save ' || v_back || ' ' || material_name(v_stone, v_back) else '' end$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You take the ' || lower(v_was.name) || ' out of the wall on the '
      || side_name(side) || ' side and lay it again in ' || lower(mat.name)
      || case when v_back > 0 then ', and save ' || v_back || ' ' || material_name(v_stone, v_back) else '' end$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Repointed: '
      || side_name(side) || ' wall, ' || lower(v_was.name) || ' to ' || lower(mat.name)
      || case when v_back > 0 then '. Returned: ' || v_back || ' ' || material_name(v_stone, v_back) else '' end$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You plan storey ' || b.levels || ' of ' || b.name
      || '. Plan and build its floor tiles, then raise walls on them.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You plan storey ' || b.levels || ' of ' || b.name
      || '. Plan and build its floor tiles, then raise walls on them.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You plan storey ' || b.levels || ' of ' || b.name
      || '. Plan and build its floor tiles, then raise walls on them.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Planned: ' || b.name || ' storey ' || b.levels
      || '. Next: floor tiles, then walls.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You plan a '
      || case when kind = 'ladder' then 'ladder'$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You plan a '
      || case when kind = 'ladder' then 'ladder'$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You plan a '
      || case when kind = 'ladder' then 'ladder'$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Planned: '
      || case when kind = 'ladder' then 'ladder'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$|| '. It needs ' || bill_text(mat.id, bill) || '.', 'event');

  elsif p_action = 'build_floor' then$tx6o$, ''))) / length($tx6o$|| '. It needs ' || bill_text(mat.id, bill) || '.', 'event');

  elsif p_action = 'build_floor' then$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$|| '. It needs ' || bill_text(mat.id, bill) || '.', 'event');

  elsif p_action = 'build_floor' then$tx6o$, $tx6n$|| '. Needs ' || bill_text(mat.id, bill) || '.', 'event');

  elsif p_action = 'build_floor' then$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You finish the ' || what || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You finish the ' || what || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You finish the ' || what || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Built: ' || what || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You work ' || laid_text(v_laid) || ' into the '
        || floor_name(f.kind, f.hand) || '. Still needed: ' || bill_text(f.material, bill) || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You work ' || laid_text(v_laid) || ' into the '
        || floor_name(f.kind, f.hand) || '. Still needed: ' || bill_text(f.material, bill) || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You work ' || laid_text(v_laid) || ' into the '
        || floor_name(f.kind, f.hand) || '. Still needed: ' || bill_text(f.material, bill) || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Added: ' || laid_text(v_laid) || '. Still needed: ' || bill_text(f.material, bill) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You remove the ' || floor_name(f.kind, f.hand) || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You remove the ' || floor_name(f.kind, f.hand) || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You remove the ' || floor_name(f.kind, f.hand) || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Removed: ' || floor_name(f.kind, f.hand) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You brush ' || litres_word(dye_litres_of('wall')) || ' of ' || colour_word(nm)
      || ' dye over the wall on the ' || side_name(side) || ' side. It comes up ' || colour_word(nm) || ', ' || nm || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You brush ' || litres_word(dye_litres_of('wall')) || ' of ' || colour_word(nm)
      || ' dye over the wall on the ' || side_name(side) || ' side. It comes up ' || colour_word(nm) || ', ' || nm || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You brush ' || litres_word(dye_litres_of('wall')) || ' of ' || colour_word(nm)
      || ' dye over the wall on the ' || side_name(side) || ' side. It comes up ' || colour_word(nm) || ', ' || nm || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Painted: ' || side_name(side) || ' wall, ' || colour_word(nm)
      || ' (' || nm || '). Dye used: ' || litres_word(dye_litres_of('wall')) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You scrub the wall back to bare '$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You scrub the wall back to bare '$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You scrub the wall back to bare '$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Paint removed: bare '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You work ' || litres_word(dye_litres_of('floor')) || ' of ' || colour_word(nm)
      || ' dye into the boards. The floor comes up ' || colour_word(nm) || ', ' || nm || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You work ' || litres_word(dye_litres_of('floor')) || ' of ' || colour_word(nm)
      || ' dye into the boards. The floor comes up ' || colour_word(nm) || ', ' || nm || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You work ' || litres_word(dye_litres_of('floor')) || ' of ' || colour_word(nm)
      || ' dye into the boards. The floor comes up ' || colour_word(nm) || ', ' || nm || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Painted: floor, ' || colour_word(nm)
      || ' (' || nm || '). Dye used: ' || litres_word(dye_litres_of('floor')) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, b.name || ' is back to '
      || case when b.levels = 1 then 'a single storey' else b.levels || ' storeys' end || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, b.name || ' is back to '
      || case when b.levels = 1 then 'a single storey' else b.levels || ' storeys' end || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_building: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, b.name || ' is back to '
      || case when b.levels = 1 then 'a single storey' else b.levels || ' storeys' end || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, b.name || ': '
      || case when b.levels = 1 then '1 storey' else b.levels || ' storeys' end || '.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('deck_refusal(uuid,uuid,integer,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Clear what stands or lies on the deck first.'$tx6o$, ''))) / length($tx6o$'Clear what stands or lies on the deck first.'$tx6o$);
  if n <> 1 then raise exception 'deck_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Clear what stands or lies on the deck first.'$tx6o$, $tx6n$'Clear the deck first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A bridge lands on the deck. Take the bridge down first.'$tx6o$, ''))) / length($tx6o$'A bridge lands on the deck. Take the bridge down first.'$tx6o$);
  if n <> 1 then raise exception 'deck_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A bridge lands on the deck. Take the bridge down first.'$tx6o$, $tx6n$'Bridge end on the deck: remove the bridge first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Somebody is standing on the deck.'$tx6o$, ''))) / length($tx6o$'Somebody is standing on the deck.'$tx6o$);
  if n <> 1 then raise exception 'deck_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Somebody is standing on the deck.'$tx6o$, $tx6n$'Someone is on the deck.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('need_tool(uuid,uuid,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$else 'You need a ' || lower((select coalesce(name, p_tool) from item_def where id = p_tool))
         || ' for that.' end$tx6o$, ''))) / length($tx6o$else 'You need a ' || lower((select coalesce(name, p_tool) from item_def where id = p_tool))
         || ' for that.' end$tx6o$);
  if n <> 1 then raise exception 'need_tool: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$else 'You need a ' || lower((select coalesce(name, p_tool) from item_def where id = p_tool))
         || ' for that.' end$tx6o$, $tx6n$else 'Need a ' || lower((select coalesce(name, p_tool) from item_def where id = p_tool))
         || '.' end$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('cellar_stack_refusal(uuid,integer,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$then (select 'The ' || floor_kind_name(f.kind) || ' down to the cellar is there.' from floor_tile f$tx6o$, ''))) / length($tx6o$then (select 'The ' || floor_kind_name(f.kind) || ' down to the cellar is there.' from floor_tile f$tx6o$);
  if n <> 1 then raise exception 'cellar_stack_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then (select 'The ' || floor_kind_name(f.kind) || ' down to the cellar is there.' from floor_tile f$tx6o$, $tx6n$then (select upper(left(floor_kind_name(f.kind), 1)) || substr(floor_kind_name(f.kind), 2) || ' down to the cellar is there.' from floor_tile f$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then (select 'The ' || floor_kind_name(f.kind) || ' up to the next storey is there.' from floor_tile f$tx6o$, ''))) / length($tx6o$then (select 'The ' || floor_kind_name(f.kind) || ' up to the next storey is there.' from floor_tile f$tx6o$);
  if n <> 1 then raise exception 'cellar_stack_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then (select 'The ' || floor_kind_name(f.kind) || ' up to the next storey is there.' from floor_tile f$tx6o$, $tx6n$then (select upper(left(floor_kind_name(f.kind), 1)) || substr(floor_kind_name(f.kind), 2) || ' up to the next storey is there.' from floor_tile f$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('stand_on_piers(uuid,uuid,integer,integer,integer,boolean)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$return 'You plan ' || b.name || ' here on piers: its deck at ' || v_deck || ', ' || metres(v_deck - v_low)
      || ' m over the lowest ground under it. Plan the deck to build it and the piers under it, then plan walls on it.';$tx6o$, ''))) / length($tx6o$return 'You plan ' || b.name || ' here on piers: its deck at ' || v_deck || ', ' || metres(v_deck - v_low)
      || ' m over the lowest ground under it. Plan the deck to build it and the piers under it, then plan walls on it.';$tx6o$);
  if n <> 1 then raise exception 'stand_on_piers: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You plan ' || b.name || ' here on piers: its deck at ' || v_deck || ', ' || metres(v_deck - v_low)
      || ' m over the lowest ground under it. Plan the deck to build it and the piers under it, then plan walls on it.';$tx6o$, $tx6n$return 'Planned: ' || b.name || ', on piers. Deck at ' || v_deck || ', ' || metres(v_deck - v_low)
      || ' m over the lowest ground. Next: plan the deck (builds the piers), then walls.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You add the tile to ' || b.name || ' on piers: under its deck at ' || v_deck || ', ' || metres(v_deck - v_low)
    || ' m over the lowest ground under it.';$tx6o$, ''))) / length($tx6o$return 'You add the tile to ' || b.name || ' on piers: under its deck at ' || v_deck || ', ' || metres(v_deck - v_low)
    || ' m over the lowest ground under it.';$tx6o$);
  if n <> 1 then raise exception 'stand_on_piers: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You add the tile to ' || b.name || ' on piers: under its deck at ' || v_deck || ', ' || metres(v_deck - v_low)
    || ' m over the lowest ground under it.';$tx6o$, $tx6n$return 'Added to ' || b.name || ', on piers: deck at ' || v_deck || ', ' || metres(v_deck - v_low)
    || ' m over the lowest ground.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('laid_text(text[])'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$else number_word(g.n) || ' ' || material_name(g.item, g.n) end, ' and ' order by g.first)$tx6o$, ''))) / length($tx6o$else number_word(g.n) || ' ' || material_name(g.item, g.n) end, ' and ' order by g.first)$tx6o$);
  if n <> 1 then raise exception 'laid_text: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$else number_word(g.n) || ' ' || material_name(g.item, g.n) end, ' and ' order by g.first)$tx6o$, $tx6n$else g.n || ' ' || material_name(g.item, g.n) end, ' and ' order by g.first)$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('brew_reason(uuid,uuid,placed,brew_def)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'It is already working. Leave it alone.'$tx6o$, ''))) / length($tx6o$'It is already working. Leave it alone.'$tx6o$);
  if n <> 1 then raise exception 'brew_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is already working. Leave it alone.'$tx6o$, $tx6n$'Already brewing.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'A brew is started in water. Empty the ' || lower(placed_name(p))
      || ' and fill it from a well.';$tx6o$, ''))) / length($tx6o$return 'A brew is started in water. Empty the ' || lower(placed_name(p))
      || ' and fill it from a well.';$tx6o$);
  if n <> 1 then raise exception 'brew_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'A brew is started in water. Empty the ' || lower(placed_name(p))
      || ' and fill it from a well.';$tx6o$, $tx6n$return 'Needs water: empty the ' || lower(placed_name(p))
      || ' and fill it from a well.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'That takes ' || to_char(b.litres, 'FM990') || ' litres of water; there are '
      || to_char(placed_litres(p), 'FM990') || ' in it.';$tx6o$, ''))) / length($tx6o$return 'That takes ' || to_char(b.litres, 'FM990') || ' litres of water; there are '
      || to_char(placed_litres(p), 'FM990') || ' in it.';$tx6o$);
  if n <> 1 then raise exception 'brew_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'That takes ' || to_char(b.litres, 'FM990') || ' litres of water; there are '
      || to_char(placed_litres(p), 'FM990') || ' in it.';$tx6o$, $tx6n$return 'Need ' || to_char(b.litres, 'FM990') || ' litres of water; has '
      || to_char(placed_litres(p), 'FM990') || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'That takes ' || b.count || ' × '
      || lower((select coalesce(name, b.input) from item_def where id = b.input))
      || '; you have ' || have || '.';$tx6o$, ''))) / length($tx6o$return 'That takes ' || b.count || ' × '
      || lower((select coalesce(name, b.input) from item_def where id = b.input))
      || '; you have ' || have || '.';$tx6o$);
  if n <> 1 then raise exception 'brew_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'That takes ' || b.count || ' × '
      || lower((select coalesce(name, b.input) from item_def where id = b.input))
      || '; you have ' || have || '.';$tx6o$, $tx6n$return 'Need ' || b.count || ' × '
      || lower((select coalesce(name, b.input) from item_def where id = b.input))
      || '; have ' || have || '.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('level_gap(uuid,integer,integer,double precision,double precision)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Storey ' || (p_level + 1) || ' is not closed in: '$tx6o$, ''))) / length($tx6o$'Storey ' || (p_level + 1) || ' is not closed in: '$tx6o$);
  if n <> 1 then raise exception 'level_gap: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Storey ' || (p_level + 1) || ' is not closed in: '$tx6o$, $tx6n$'Storey ' || (p_level + 1) || ' not enclosed: '$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('material_only_refusal(text,text,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$(select upper(left(an(lower(t.name)), 1)) || substr(an(lower(t.name)), 2) || ' is laid in ' || lower(m.name) || ' and nothing else.'$tx6o$, ''))) / length($tx6o$(select upper(left(an(lower(t.name)), 1)) || substr(an(lower(t.name)), 2) || ' is laid in ' || lower(m.name) || ' and nothing else.'$tx6o$);
  if n <> 1 then raise exception 'material_only_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$(select upper(left(an(lower(t.name)), 1)) || substr(an(lower(t.name)), 2) || ' is laid in ' || lower(m.name) || ' and nothing else.'$tx6o$, $tx6n$(select t.name || ': ' || lower(m.name) || ' only.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('rpc_buy(uuid,bigint)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'That is not for sale.'$tx6o$, ''))) / length($tx6o$'That is not for sale.'$tx6o$);
  if n <> 2 then raise exception 'rpc_buy: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'That is not for sale.'$tx6o$, $tx6n$'Not for sale.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return jsonb_build_object('why', 'It is your own ' || sells_word(v_pl) || '. Take it back off the counter instead.');$tx6o$, ''))) / length($tx6o$return jsonb_build_object('why', 'It is your own ' || sells_word(v_pl) || '. Take it back off the counter instead.');$tx6o$);
  if n <> 1 then raise exception 'rpc_buy: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return jsonb_build_object('why', 'It is your own ' || sells_word(v_pl) || '. Take it back off the counter instead.');$tx6o$, $tx6n$return jsonb_build_object('why', 'Your own ' || sells_word(v_pl) || ': take it back off instead.');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return jsonb_build_object('why', 'You cannot afford it. It is ' || v_it.price || ' silver.');$tx6o$, ''))) / length($tx6o$return jsonb_build_object('why', 'You cannot afford it. It is ' || v_it.price || ' silver.');$tx6o$);
  if n <> 1 then raise exception 'rpc_buy: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return jsonb_build_object('why', 'You cannot afford it. It is ' || v_it.price || ' silver.');$tx6o$, $tx6n$return jsonb_build_object('why', 'Cannot afford: ' || v_it.price || ' silver.');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, v_pl.made_by, folk_name(p_world, me) || ' buys your ' || v_name
      || ' for ' || v_it.price || ' silver.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, v_pl.made_by, folk_name(p_world, me) || ' buys your ' || v_name
      || ' for ' || v_it.price || ' silver.', 'event');$tx6o$);
  if n <> 1 then raise exception 'rpc_buy: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, v_pl.made_by, folk_name(p_world, me) || ' buys your ' || v_name
      || ' for ' || v_it.price || ' silver.', 'event');$tx6o$, $tx6n$perform tell(p_world, v_pl.made_by, 'Sold: ' || v_name || ' to ' || folk_name(p_world, me)
      || ', ' || v_it.price || ' silver.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('counter_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Stand at a counter of yours.'$tx6o$, ''))) / length($tx6o$'Stand at a counter of yours.'$tx6o$);
  if n <> 1 then raise exception 'counter_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Stand at a counter of yours.'$tx6o$, $tx6n$'Stand at your counter.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('set_out_line(integer,text,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$select 'You set ' || case when p_count > 1 then p_count || ' × ' else 'the ' end || lower(p_what) || ' out on the counter.'
      || case when p_left > 0 then ' The other ' || p_left || ' would not fit.' else '' end$tx6o$, ''))) / length($tx6o$select 'You set ' || case when p_count > 1 then p_count || ' × ' else 'the ' end || lower(p_what) || ' out on the counter.'
      || case when p_left > 0 then ' The other ' || p_left || ' would not fit.' else '' end$tx6o$);
  if n <> 1 then raise exception 'set_out_line: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select 'You set ' || case when p_count > 1 then p_count || ' × ' else 'the ' end || lower(p_what) || ' out on the counter.'
      || case when p_left > 0 then ' The other ' || p_left || ' would not fit.' else '' end$tx6o$, $tx6n$select 'On the counter: ' || case when p_count > 1 then p_count || ' × ' else '' end || lower(p_what) || '.'
      || case when p_left > 0 then ' No room for ' || p_left || '.' else '' end$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('take_back_line(integer,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$select 'You take ' || case when p_count > 1 then p_count || ' × ' else 'the ' end || lower(p_what) || ' back off the counter.'$tx6o$, ''))) / length($tx6o$select 'You take ' || case when p_count > 1 then p_count || ' × ' else 'the ' end || lower(p_what) || ' back off the counter.'$tx6o$);
  if n <> 1 then raise exception 'take_back_line: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select 'You take ' || case when p_count > 1 then p_count || ' × ' else 'the ' end || lower(p_what) || ' back off the counter.'$tx6o$, $tx6n$select 'Off the counter: ' || case when p_count > 1 then p_count || ' × ' else '' end || lower(p_what) || '.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('milked_says(text,integer,double precision,boolean)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$return 'You milk ' || p_name || ' into the bucket' || case when p_another then ' and fill another' else '' end
      || '. (QL ' || to_char(p_ql, 'FM990.0') || ')';$tx6o$, ''))) / length($tx6o$return 'You milk ' || p_name || ' into the bucket' || case when p_another then ' and fill another' else '' end
      || '. (QL ' || to_char(p_ql, 'FM990.0') || ')';$tx6o$);
  if n <> 1 then raise exception 'milked_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You milk ' || p_name || ' into the bucket' || case when p_another then ' and fill another' else '' end
      || '. (QL ' || to_char(p_ql, 'FM990.0') || ')';$tx6o$, $tx6n$return 'Milked ' || p_name || ': bucket full' || case when p_another then ', and another filled' else '' end
      || '. QL ' || to_char(p_ql, 'FM990.0') || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You milk ' || p_name || ' into the bucket. It holds ' || p_litres || ' of ' || bucket_litres()::int
    || ' litres. (QL ' || to_char(p_ql, 'FM990.0') || ')';$tx6o$, ''))) / length($tx6o$return 'You milk ' || p_name || ' into the bucket. It holds ' || p_litres || ' of ' || bucket_litres()::int
    || ' litres. (QL ' || to_char(p_ql, 'FM990.0') || ')';$tx6o$);
  if n <> 1 then raise exception 'milked_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You milk ' || p_name || ' into the bucket. It holds ' || p_litres || ' of ' || bucket_litres()::int
    || ' litres. (QL ' || to_char(p_ql, 'FM990.0') || ')';$tx6o$, $tx6n$return 'Milked ' || p_name || ': bucket ' || p_litres || '/' || bucket_litres()::int
    || ' litres. QL ' || to_char(p_ql, 'FM990.0') || '.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_creature(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, c.name || ' drinks the bucket of whey. The bucket comes back empty.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, c.name || ' drinks the bucket of whey. The bucket comes back empty.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_creature: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, c.name || ' drinks the bucket of whey. The bucket comes back empty.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Fed whey: ' || c.name || '. Bucket emptied.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('post_settle(bigint)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p.world_id, c.keeper, 'The ' || lower(post_name(p))
        || ' has rotted through and gone over. ' || c.name || ' comes home.', 'system');$tx6o$, ''))) / length($tx6o$perform tell(p.world_id, c.keeper, 'The ' || lower(post_name(p))
        || ' has rotted through and gone over. ' || c.name || ' comes home.', 'system');$tx6o$);
  if n <> 1 then raise exception 'post_settle: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p.world_id, c.keeper, 'The ' || lower(post_name(p))
        || ' has rotted through and gone over. ' || c.name || ' comes home.', 'system');$tx6o$, $tx6n$perform tell(p.world_id, c.keeper, post_name(p)
        || ' rotted away: ' || c.name || ' returns home.', 'system');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('cellar_piece_reason(text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Nothing that burns an open fire goes down into a cellar.'$tx6o$, ''))) / length($tx6o$'Nothing that burns an open fire goes down into a cellar.'$tx6o$);
  if n <> 1 then raise exception 'cellar_piece_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing that burns an open fire goes down into a cellar.'$tx6o$, $tx6n$'No open fires in a cellar.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Nothing on wheels or afloat goes down into a cellar.'$tx6o$, ''))) / length($tx6o$'Nothing on wheels or afloat goes down into a cellar.'$tx6o$);
  if n <> 1 then raise exception 'cellar_piece_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing on wheels or afloat goes down into a cellar.'$tx6o$, $tx6n$'No carts, vehicles or boats in a cellar.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then case when lower(left(d.name, 1)) in ('a', 'e', 'i', 'o', 'u') then 'An ' else 'A ' end || lower(d.name)
           || ' does not go down into a cellar.'$tx6o$, ''))) / length($tx6o$then case when lower(left(d.name, 1)) in ('a', 'e', 'i', 'o', 'u') then 'An ' else 'A ' end || lower(d.name)
           || ' does not go down into a cellar.'$tx6o$);
  if n <> 1 then raise exception 'cellar_piece_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then case when lower(left(d.name, 1)) in ('a', 'e', 'i', 'o', 'u') then 'An ' else 'A ' end || lower(d.name)
           || ' does not go down into a cellar.'$tx6o$, $tx6n$then upper(left(lower(d.name), 1)) || substr(lower(d.name), 2)
           || ': not in a cellar.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('cellar_gate(uuid,uuid,text,jsonb,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'That is in another building''s cellar.'$tx6o$, ''))) / length($tx6o$'That is in another building''s cellar.'$tx6o$);
  if n <> 1 then raise exception 'cellar_gate: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is in another building''s cellar.'$tx6o$, $tx6n$'In another building''s cellar.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You are down in the cellar. Go up to do that.'$tx6o$, ''))) / length($tx6o$'You are down in the cellar. Go up to do that.'$tx6o$);
  if n <> 1 then raise exception 'cellar_gate: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You are down in the cellar. Go up to do that.'$tx6o$, $tx6n$'Go up out of the cellar first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That is down in the cellar.'$tx6o$, ''))) / length($tx6o$'That is down in the cellar.'$tx6o$);
  if n <> 1 then raise exception 'cellar_gate: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is down in the cellar.'$tx6o$, $tx6n$'Down in the cellar.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('cellar_dig_reason(uuid,uuid,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'A cellar is dug out under a building.'$tx6o$, ''))) / length($tx6o$'A cellar is dug out under a building.'$tx6o$);
  if n <> 1 then raise exception 'cellar_dig_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A cellar is dug out under a building.'$tx6o$, $tx6n$'Cellars go under a building.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A cellar is not dug out under a deck on piers.'$tx6o$, ''))) / length($tx6o$'A cellar is not dug out under a deck on piers.'$tx6o$);
  if n <> 1 then raise exception 'cellar_dig_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A cellar is not dug out under a deck on piers.'$tx6o$, $tx6n$'Not under a deck on piers.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Dig it out from inside that building, on its ground floor or down in its cellar.'$tx6o$, ''))) / length($tx6o$'Dig it out from inside that building, on its ground floor or down in its cellar.'$tx6o$);
  if n <> 1 then raise exception 'cellar_dig_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Dig it out from inside that building, on its ground floor or down in its cellar.'$tx6o$, $tx6n$'Stand inside that building: ground floor or cellar.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A cellar is not dug out under a poured foundation.'$tx6o$, ''))) / length($tx6o$'A cellar is not dug out under a poured foundation.'$tx6o$);
  if n <> 1 then raise exception 'cellar_dig_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A cellar is not dug out under a poured foundation.'$tx6o$, $tx6n$'Not under a poured foundation.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The cellar is dug out here, the whole ' || cellar_depth()::int || ' down.';$tx6o$, ''))) / length($tx6o$return 'The cellar is dug out here, the whole ' || cellar_depth()::int || ' down.';$tx6o$);
  if n <> 1 then raise exception 'cellar_dig_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The cellar is dug out here, the whole ' || cellar_depth()::int || ' down.';$tx6o$, $tx6n$return 'Cellar fully dug: ' || cellar_depth()::int || ' down.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The rock lies ' || v_shallow || ' under the ground floor at the shallowest corner here. A cellar is begun in soil, '
      || cellar_least_soil()::int || ' of it at every corner.';$tx6o$, ''))) / length($tx6o$return 'The rock lies ' || v_shallow || ' under the ground floor at the shallowest corner here. A cellar is begun in soil, '
      || cellar_least_soil()::int || ' of it at every corner.';$tx6o$);
  if n <> 1 then raise exception 'cellar_dig_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The rock lies ' || v_shallow || ' under the ground floor at the shallowest corner here. A cellar is begun in soil, '
      || cellar_least_soil()::int || ' of it at every corner.';$tx6o$, $tx6n$return 'Rock ' || v_shallow || ' under the ground floor at the shallowest corner; needs '
      || cellar_least_soil()::int || ' of soil at every corner.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The ground floor here stands at ' || v_h || '. A cellar ' || cellar_depth()::int
      || ' deep under it would lie under the sea: it wants the ground floor ' || cellar_depth()::int || ' over the water.';$tx6o$, ''))) / length($tx6o$return 'The ground floor here stands at ' || v_h || '. A cellar ' || cellar_depth()::int
      || ' deep under it would lie under the sea: it wants the ground floor ' || cellar_depth()::int || ' over the water.';$tx6o$);
  if n <> 1 then raise exception 'cellar_dig_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The ground floor here stands at ' || v_h || '. A cellar ' || cellar_depth()::int
      || ' deep under it would lie under the sea: it wants the ground floor ' || cellar_depth()::int || ' over the water.';$tx6o$, $tx6n$return 'Ground floor at ' || v_h || ': needs ' || cellar_depth()::int
      || ' above sea level for a ' || cellar_depth()::int || '-deep cellar.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('cellar_fill_reason(uuid,uuid,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'There is no cellar dug out under this tile.'$tx6o$, ''))) / length($tx6o$'There is no cellar dug out under this tile.'$tx6o$);
  if n <> 1 then raise exception 'cellar_fill_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no cellar dug out under this tile.'$tx6o$, $tx6n$'No cellar under this tile.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Fill it in from inside that building, on its ground floor or down in its cellar.'$tx6o$, ''))) / length($tx6o$'Fill it in from inside that building, on its ground floor or down in its cellar.'$tx6o$);
  if n <> 1 then raise exception 'cellar_fill_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Fill it in from inside that building, on its ground floor or down in its cellar.'$tx6o$, $tx6n$'Stand inside that building: ground floor or cellar.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You are standing on it. Step off it first.'$tx6o$, ''))) / length($tx6o$'You are standing on it. Step off it first.'$tx6o$);
  if n <> 1 then raise exception 'cellar_fill_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You are standing on it. Step off it first.'$tx6o$, $tx6n$'Step off it first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Clear away what is lying down there first.'$tx6o$, ''))) / length($tx6o$'Clear away what is lying down there first.'$tx6o$);
  if n <> 1 then raise exception 'cellar_fill_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Clear away what is lying down there first.'$tx6o$, $tx6n$'Pick up what lies down there first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Carry out what stands down there first.'$tx6o$, ''))) / length($tx6o$'Carry out what stands down there first.'$tx6o$);
  if n <> 1 then raise exception 'cellar_fill_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Carry out what stands down there first.'$tx6o$, $tx6n$'Remove the furniture down there first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The ' || floor_kind_name(v_kind) || ' down to the cellar stands on it. Take it out first.';$tx6o$, ''))) / length($tx6o$return 'The ' || floor_kind_name(v_kind) || ' down to the cellar stands on it. Take it out first.';$tx6o$);
  if n <> 1 then raise exception 'cellar_fill_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The ' || floor_kind_name(v_kind) || ' down to the cellar stands on it. Take it out first.';$tx6o$, $tx6n$return 'Remove the ' || floor_kind_name(v_kind) || ' to the cellar first.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('cellar_floor_said(uuid,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$then 'You see the floor of the cellar under ' || v_name || ' at (' || p_x || ', ' || p_y || '): ' || v_floor || ', '
                   || cellar_depth()::int || ' under the ground floor, at height ' || v_h || '.'
              else 'You see the bottom of the cellar being dug under ' || v_name || ' at (' || p_x || ', ' || p_y || '): '
                   || v_floor || ', ' || c.dug || ' of ' || cellar_depth()::int || ' down, at height ' || v_h || '.' end
      || case when n = 0 then ' Nothing lies on it.' when n = 1 then ' 1 thing lies on it.' else ' ' || n || ' things lie on it.' end;$tx6o$, ''))) / length($tx6o$then 'You see the floor of the cellar under ' || v_name || ' at (' || p_x || ', ' || p_y || '): ' || v_floor || ', '
                   || cellar_depth()::int || ' under the ground floor, at height ' || v_h || '.'
              else 'You see the bottom of the cellar being dug under ' || v_name || ' at (' || p_x || ', ' || p_y || '): '
                   || v_floor || ', ' || c.dug || ' of ' || cellar_depth()::int || ' down, at height ' || v_h || '.' end
      || case when n = 0 then ' Nothing lies on it.' when n = 1 then ' 1 thing lies on it.' else ' ' || n || ' things lie on it.' end;$tx6o$);
  if n <> 1 then raise exception 'cellar_floor_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then 'You see the floor of the cellar under ' || v_name || ' at (' || p_x || ', ' || p_y || '): ' || v_floor || ', '
                   || cellar_depth()::int || ' under the ground floor, at height ' || v_h || '.'
              else 'You see the bottom of the cellar being dug under ' || v_name || ' at (' || p_x || ', ' || p_y || '): '
                   || v_floor || ', ' || c.dug || ' of ' || cellar_depth()::int || ' down, at height ' || v_h || '.' end
      || case when n = 0 then ' Nothing lies on it.' when n = 1 then ' 1 thing lies on it.' else ' ' || n || ' things lie on it.' end;$tx6o$, $tx6n$then 'Cellar floor under ' || v_name || ' at (' || p_x || ', ' || p_y || '): ' || v_floor || ', '
                   || cellar_depth()::int || ' under the ground floor, height ' || v_h || '.'
              else 'Cellar being dug under ' || v_name || ' at (' || p_x || ', ' || p_y || '): '
                   || v_floor || ', ' || c.dug || '/' || cellar_depth()::int || ' down, height ' || v_h || '.' end
      || ' Items on it: ' || n || '.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('dye_boil_refusal(uuid,uuid,text,text,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$else 'It takes ' || dye_kg_said(dye_boil_grams(p_world, p_uid, p_recipe)) || ' kg of '
                   || lower((select d.name from item_def d where d.id = p_item)) || ' for '
                   || dye_boil_litres()::int || ' litres of lye; you have ' || dye_kg_said(p_have * dye_grams_of(p_item)) || ' kg.' end$tx6o$, ''))) / length($tx6o$else 'It takes ' || dye_kg_said(dye_boil_grams(p_world, p_uid, p_recipe)) || ' kg of '
                   || lower((select d.name from item_def d where d.id = p_item)) || ' for '
                   || dye_boil_litres()::int || ' litres of lye; you have ' || dye_kg_said(p_have * dye_grams_of(p_item)) || ' kg.' end$tx6o$);
  if n <> 1 then raise exception 'dye_boil_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$else 'It takes ' || dye_kg_said(dye_boil_grams(p_world, p_uid, p_recipe)) || ' kg of '
                   || lower((select d.name from item_def d where d.id = p_item)) || ' for '
                   || dye_boil_litres()::int || ' litres of lye; you have ' || dye_kg_said(p_have * dye_grams_of(p_item)) || ' kg.' end$tx6o$, $tx6n$else 'Need ' || dye_kg_said(dye_boil_grams(p_world, p_uid, p_recipe)) || ' kg of '
                   || lower((select d.name from item_def d where d.id = p_item)) || ' per '
                   || dye_boil_litres()::int || ' litres of lye; have ' || dye_kg_said(p_have * dye_grams_of(p_item)) || ' kg.' end$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('dye_boil_said(text,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$select 'You boil down ' || dye_kg_said(p_used * dye_grams_of(p_item)) || ' kg of '
      || lower((select d.name from item_def d where d.id = p_item)) || ', ' || p_used || ' of '
      || case when p_used = 1 then 'it' else 'them' end || ', in ' || dye_boil_litres()::int || ' litres of lye.'$tx6o$, ''))) / length($tx6o$select 'You boil down ' || dye_kg_said(p_used * dye_grams_of(p_item)) || ' kg of '
      || lower((select d.name from item_def d where d.id = p_item)) || ', ' || p_used || ' of '
      || case when p_used = 1 then 'it' else 'them' end || ', in ' || dye_boil_litres()::int || ' litres of lye.'$tx6o$);
  if n <> 1 then raise exception 'dye_boil_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select 'You boil down ' || dye_kg_said(p_used * dye_grams_of(p_item)) || ' kg of '
      || lower((select d.name from item_def d where d.id = p_item)) || ', ' || p_used || ' of '
      || case when p_used = 1 then 'it' else 'them' end || ', in ' || dye_boil_litres()::int || ' litres of lye.'$tx6o$, $tx6n$select 'Boiled: ' || dye_kg_said(p_used * dye_grams_of(p_item)) || ' kg of '
      || lower((select d.name from item_def d where d.id = p_item)) || ' (' || p_used
      || '), in ' || dye_boil_litres()::int || ' litres of lye.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('no_dye()'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$select 'You have no dye in your pack or in a barrel within ' || craft_reach()$tx6o$, ''))) / length($tx6o$select 'You have no dye in your pack or in a barrel within ' || craft_reach()$tx6o$);
  if n <> 1 then raise exception 'no_dye: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select 'You have no dye in your pack or in a barrel within ' || craft_reach()$tx6o$, $tx6n$select 'No dye in your pack or a barrel within ' || craft_reach()$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('too_little_dye(integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$select 'It takes ' || litres_word(p_litres) || ' of dye, and the most any one bucket or barrel of it holds is '
      || litres_word(p_most) || '. A dyeing draws from one only.'$tx6o$, ''))) / length($tx6o$select 'It takes ' || litres_word(p_litres) || ' of dye, and the most any one bucket or barrel of it holds is '
      || litres_word(p_most) || '. A dyeing draws from one only.'$tx6o$);
  if n <> 1 then raise exception 'too_little_dye: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select 'It takes ' || litres_word(p_litres) || ' of dye, and the most any one bucket or barrel of it holds is '
      || litres_word(p_most) || '. A dyeing draws from one only.'$tx6o$, $tx6n$select 'Need ' || litres_word(p_litres) || ' of dye from one bucket or barrel; the most in one is '
      || litres_word(p_most) || '.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('dye_gone(integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$select 'The dye you chose is gone or holds less than ' || litres_word(p_litres) || ' now. Choose again.'$tx6o$, ''))) / length($tx6o$select 'The dye you chose is gone or holds less than ' || litres_word(p_litres) || ' now. Choose again.'$tx6o$);
  if n <> 1 then raise exception 'dye_gone: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select 'The dye you chose is gone or holds less than ' || litres_word(p_litres) || ' now. Choose again.'$tx6o$, $tx6n$select 'Chosen dye gone or under ' || litres_word(p_litres) || '. Choose again.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('dyed_already(text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$select 'It is ' || colour_word(p_hex) || ' already, ' || p_hex || '.'$tx6o$, ''))) / length($tx6o$select 'It is ' || colour_word(p_hex) || ' already, ' || p_hex || '.'$tx6o$);
  if n <> 1 then raise exception 'dyed_already: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select 'It is ' || colour_word(p_hex) || ' already, ' || p_hex || '.'$tx6o$, $tx6n$select 'Already ' || colour_word(p_hex) || ' (' || p_hex || ').'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('fight_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You are out of arrows.'$tx6o$, ''))) / length($tx6o$'You are out of arrows.'$tx6o$);
  if n <> 1 then raise exception 'fight_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You are out of arrows.'$tx6o$, $tx6n$'Out of arrows.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You have nothing to dress it with.'$tx6o$, ''))) / length($tx6o$'You have nothing to dress it with.'$tx6o$);
  if n <> 2 then raise exception 'fight_refusal: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'You have nothing to dress it with.'$tx6o$, $tx6n$'Nothing to dress it with.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Every wound on you that has not gone bad is already dressed at least as well as what you carry would dress it. '$tx6o$, ''))) / length($tx6o$'Every wound on you that has not gone bad is already dressed at least as well as what you carry would dress it. '$tx6o$);
  if n <> 1 then raise exception 'fight_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Every wound on you that has not gone bad is already dressed at least as well as what you carry would dress it. '$tx6o$, $tx6n$'Every uninfected wound is already dressed as well or better. '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A dressing only goes over one that closes the wound slower.'$tx6o$, ''))) / length($tx6o$'A dressing only goes over one that closes the wound slower.'$tx6o$);
  if n <> 2 then raise exception 'fight_refusal: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'A dressing only goes over one that closes the wound slower.'$tx6o$, $tx6n$'A dressing only replaces one that heals slower.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is nothing wrong with you.'$tx6o$, ''))) / length($tx6o$'There is nothing wrong with you.'$tx6o$);
  if n <> 1 then raise exception 'fight_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is nothing wrong with you.'$tx6o$, $tx6n$'Not hurt.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Nothing is open. You are only tired and thin.'$tx6o$, ''))) / length($tx6o$'Nothing is open. You are only tired and thin.'$tx6o$);
  if n <> 1 then raise exception 'fight_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing is open. You are only tired and thin.'$tx6o$, $tx6n$'No wounds to dress.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Nothing on you has gone bad.'$tx6o$, ''))) / length($tx6o$'Nothing on you has gone bad.'$tx6o$);
  if n <> 1 then raise exception 'fight_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing on you has gone bad.'$tx6o$, $tx6n$'No infected wounds.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need a bucket of lye to clean it out with.'$tx6o$, ''))) / length($tx6o$'You need a bucket of lye to clean it out with.'$tx6o$);
  if n <> 1 then raise exception 'fight_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need a bucket of lye to clean it out with.'$tx6o$, $tx6n$'Need a bucket of lye.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It will not stand still for you while it is wild.'$tx6o$, ''))) / length($tx6o$'It will not stand still for you while it is wild.'$tx6o$);
  if n <> 1 then raise exception 'fight_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It will not stand still for you while it is wild.'$tx6o$, $tx6n$'Not while it is wild.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You have no bandages. Cut some from cloth.'$tx6o$, ''))) / length($tx6o$'You have no bandages. Cut some from cloth.'$tx6o$);
  if n <> 1 then raise exception 'fight_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You have no bandages. Cut some from cloth.'$tx6o$, $tx6n$'Need a bandage: cut one from cloth.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need to be beside it.'$tx6o$, ''))) / length($tx6o$'You need to be beside it.'$tx6o$);
  if n <> 1 then raise exception 'fight_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need to be beside it.'$tx6o$, $tx6n$'Stand beside it.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$if c.health >= max_health(c) then return c.name || ' is not hurt.'; end if;$tx6o$, ''))) / length($tx6o$if c.health >= max_health(c) then return c.name || ' is not hurt.'; end if;$tx6o$);
  if n <> 1 then raise exception 'fight_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$if c.health >= max_health(c) then return c.name || ' is not hurt.'; end if;$tx6o$, $tx6n$if c.health >= max_health(c) then return c.name || ': not hurt.'; end if;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$if jsonb_array_length(coalesce(pt.wounds, '[]'::jsonb)) = 0 then return coalesce(pt.name, 'They') || ' has nothing open to dress.'; end if;$tx6o$, ''))) / length($tx6o$if jsonb_array_length(coalesce(pt.wounds, '[]'::jsonb)) = 0 then return coalesce(pt.name, 'They') || ' has nothing open to dress.'; end if;$tx6o$);
  if n <> 1 then raise exception 'fight_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$if jsonb_array_length(coalesce(pt.wounds, '[]'::jsonb)) = 0 then return coalesce(pt.name, 'They') || ' has nothing open to dress.'; end if;$tx6o$, $tx6n$if jsonb_array_length(coalesce(pt.wounds, '[]'::jsonb)) = 0 then return coalesce(pt.name, 'They') || ': no wounds to dress.'; end if;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The ' || (select name from wound_kind_def where id = hurt->>'kind') || ' on '
          || coalesce(pt.name, 'their') || '''s ' || part_name(hurt->>'part')
          || ' has gone bad. It wants cleaning out before anything will hold on it.';$tx6o$, ''))) / length($tx6o$return 'The ' || (select name from wound_kind_def where id = hurt->>'kind') || ' on '
          || coalesce(pt.name, 'their') || '''s ' || part_name(hurt->>'part')
          || ' has gone bad. It wants cleaning out before anything will hold on it.';$tx6o$);
  if n <> 1 then raise exception 'fight_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The ' || (select name from wound_kind_def where id = hurt->>'kind') || ' on '
          || coalesce(pt.name, 'their') || '''s ' || part_name(hurt->>'part')
          || ' has gone bad. It wants cleaning out before anything will hold on it.';$tx6o$, $tx6n$return 'The ' || (select name from wound_kind_def where id = hurt->>'kind') || ' on '
          || coalesce(pt.name, 'their') || '''s ' || part_name(hurt->>'part')
          || ': infected. It needs cleaning with lye first.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'Every wound on ' || coalesce(pt.name, 'them') || ' that has not gone bad is already dressed at least as well as what you carry would dress it. '$tx6o$, ''))) / length($tx6o$return 'Every wound on ' || coalesce(pt.name, 'them') || ' that has not gone bad is already dressed at least as well as what you carry would dress it. '$tx6o$);
  if n <> 1 then raise exception 'fight_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'Every wound on ' || coalesce(pt.name, 'them') || ' that has not gone bad is already dressed at least as well as what you carry would dress it. '$tx6o$, $tx6n$return 'Every uninfected wound on ' || coalesce(pt.name, 'them') || ' is already dressed as well or better. '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The ' || (select name from wound_kind_def where id = hurt->>'kind')
        || ' on your ' || part_name(hurt->>'part')
        || ' has gone bad. Clean it out before anything will hold on it.';$tx6o$, ''))) / length($tx6o$return 'The ' || (select name from wound_kind_def where id = hurt->>'kind')
        || ' on your ' || part_name(hurt->>'part')
        || ' has gone bad. Clean it out before anything will hold on it.';$tx6o$);
  if n <> 1 then raise exception 'fight_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The ' || (select name from wound_kind_def where id = hurt->>'kind')
        || ' on your ' || part_name(hurt->>'part')
        || ' has gone bad. Clean it out before anything will hold on it.';$tx6o$, $tx6n$return 'The ' || (select name from wound_kind_def where id = hurt->>'kind')
        || ' on your ' || part_name(hurt->>'part')
        || ': infected. Clean it with lye first.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$if not coalesce((hurt->>'infected')::boolean, false) then return wound_on_your(hurt) || ' has not gone bad.'; end if;$tx6o$, ''))) / length($tx6o$if not coalesce((hurt->>'infected')::boolean, false) then return wound_on_your(hurt) || ' has not gone bad.'; end if;$tx6o$);
  if n <> 1 then raise exception 'fight_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$if not coalesce((hurt->>'infected')::boolean, false) then return wound_on_your(hurt) || ' has not gone bad.'; end if;$tx6o$, $tx6n$if not coalesce((hurt->>'infected')::boolean, false) then return wound_on_your(hurt) || ': not infected.'; end if;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is nothing to butcher.'$tx6o$, ''))) / length($tx6o$'There is nothing to butcher.'$tx6o$);
  if n <> 1 then raise exception 'fight_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is nothing to butcher.'$tx6o$, $tx6n$'Nothing to butcher.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You cannot make sense of this carcass.'$tx6o$, ''))) / length($tx6o$'You cannot make sense of this carcass.'$tx6o$);
  if n <> 1 then raise exception 'fight_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You cannot make sense of this carcass.'$tx6o$, $tx6n$'Unknown carcass.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('spell_cast_refusal(uuid,uuid,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You are out of arrows.'$tx6o$, ''))) / length($tx6o$'You are out of arrows.'$tx6o$);
  if n <> 1 then raise exception 'spell_cast_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You are out of arrows.'$tx6o$, $tx6n$'Out of arrows.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$if v_left > 0 then return s.name || ' can be called again in ' || ceil(v_left)::int || ' seconds.'; end if;$tx6o$, ''))) / length($tx6o$if v_left > 0 then return s.name || ' can be called again in ' || ceil(v_left)::int || ' seconds.'; end if;$tx6o$);
  if n <> 1 then raise exception 'spell_cast_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$if v_left > 0 then return s.name || ' can be called again in ' || ceil(v_left)::int || ' seconds.'; end if;$tx6o$, $tx6n$if v_left > 0 then return s.name || ': cooldown ' || ceil(v_left)::int || ' s.'; end if;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You do not have that spell.'$tx6o$, ''))) / length($tx6o$'You do not have that spell.'$tx6o$);
  if n <> 1 then raise exception 'spell_cast_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You do not have that spell.'$tx6o$, $tx6n$'Spell not known.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('hurt_player(uuid,uuid,double precision,text,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You block the blow with your shield.'$tx6o$, ''))) / length($tx6o$'You block the blow with your shield.'$tx6o$);
  if n <> 1 then raise exception 'hurt_player: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You block the blow with your shield.'$tx6o$, $tx6n$'Blocked with shield.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The ward goes with a sound like ice, and the rest of it reaches you.'$tx6o$, ''))) / length($tx6o$'The ward goes with a sound like ice, and the rest of it reaches you.'$tx6o$);
  if n <> 1 then raise exception 'hurt_player: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The ward goes with a sound like ice, and the rest of it reaches you.'$tx6o$, $tx6n$'Ward broken; the rest of the blow hits.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'Your ' || lower((select name from item_def where id = piece.def))
        || ' is beaten to pieces and falls away.', 'fight');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'Your ' || lower((select name from item_def where id = piece.def))
        || ' is beaten to pieces and falls away.', 'fight');$tx6o$);
  if n <> 1 then raise exception 'hurt_player: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'Your ' || lower((select name from item_def where id = piece.def))
        || ' is beaten to pieces and falls away.', 'fight');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Destroyed: ' || lower((select name from item_def where id = piece.def))
        || ' (' || damage_max()::int || ' damage).', 'fight');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$note := ', though your ' || lower((select name from item_def where id = piece.def)) || ' takes the worst of it';$tx6o$, ''))) / length($tx6o$note := ', though your ' || lower((select name from item_def where id = piece.def)) || ' takes the worst of it';$tx6o$);
  if n <> 1 then raise exception 'hurt_player: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$note := ', though your ' || lower((select name from item_def where id = piece.def)) || ' takes the worst of it';$tx6o$, $tx6n$note := ' (' || lower((select name from item_def where id = piece.def)) || ' absorbed some)';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, p_what || note || '. You have ' || wound_text(w) || '.', 'fight');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, p_what || note || '. You have ' || wound_text(w) || '.', 'fight');$tx6o$);
  if n <> 1 then raise exception 'hurt_player: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, p_what || note || '. You have ' || wound_text(w) || '.', 'fight');$tx6o$, $tx6n$perform tell(p_world, p_uid, p_what || note || '. Wound: ' || wound_text(w) || '.', 'fight');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You dodge the '$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You dodge the '$tx6o$);
  if n <> 1 then raise exception 'hurt_player: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You dodge the '$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Dodged: '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The ward takes ' || p_what || ', and holds.', 'fight');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The ward takes ' || p_what || ', and holds.', 'fight');$tx6o$);
  if n <> 1 then raise exception 'hurt_player: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The ward takes ' || p_what || ', and holds.', 'fight');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Ward absorbed: ' || p_what || '.', 'fight');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('frame_roof_on_wall(uuid,wall)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'The roof over the jetty rests on this wall: raise a column at each end of it, or take the roof off, first.'$tx6o$, ''))) / length($tx6o$'The roof over the jetty rests on this wall: raise a column at each end of it, or take the roof off, first.'$tx6o$);
  if n <> 1 then raise exception 'frame_roof_on_wall: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The roof over the jetty rests on this wall: raise a column at each end of it, or take the roof off, first.'$tx6o$, $tx6n$'Jetty roof rests on this wall: add a column at each end, or remove the roof, first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The roof over the jetty rests on the ' || v_end || ' end of this wall: raise a column there, or take the roof off, first.';$tx6o$, ''))) / length($tx6o$return 'The roof over the jetty rests on the ' || v_end || ' end of this wall: raise a column there, or take the roof off, first.';$tx6o$);
  if n <> 1 then raise exception 'frame_roof_on_wall: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The roof over the jetty rests on the ' || v_end || ' end of this wall: raise a column there, or take the roof off, first.';$tx6o$, $tx6n$return 'Jetty roof rests on this wall''s ' || v_end || ' end: add a column there, or remove the roof, first.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('frame_floor_holds(uuid,building,integer,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Take the roof over it off first.'$tx6o$, ''))) / length($tx6o$'Take the roof over it off first.'$tx6o$);
  if n <> 1 then raise exception 'frame_floor_holds: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Take the roof over it off first.'$tx6o$, $tx6n$'Remove the roof above first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'Take down the column on its ' || side_name(case when c.y = p_y then 'n' else 's' end) || '-'
        || side_name(case when c.x = p_x then 'w' else 'e' end) || ' corner first.';$tx6o$, ''))) / length($tx6o$return 'Take down the column on its ' || side_name(case when c.y = p_y then 'n' else 's' end) || '-'
        || side_name(case when c.x = p_x then 'w' else 'e' end) || ' corner first.';$tx6o$);
  if n <> 1 then raise exception 'frame_floor_holds: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'Take down the column on its ' || side_name(case when c.y = p_y then 'n' else 's' end) || '-'
        || side_name(case when c.x = p_x then 'w' else 'e' end) || ' corner first.';$tx6o$, $tx6n$return 'Remove the ' || side_name(case when c.y = p_y then 'n' else 's' end) || '-'
        || side_name(case when c.x = p_x then 'w' else 'e' end) || ' corner column first.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The floor of storey ' || (p_level + 2) || ' rests on it: take that up first.';$tx6o$, ''))) / length($tx6o$return 'The floor of storey ' || (p_level + 2) || ' rests on it: take that up first.';$tx6o$);
  if n <> 1 then raise exception 'frame_floor_holds: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The floor of storey ' || (p_level + 2) || ' rests on it: take that up first.';$tx6o$, $tx6n$return 'Storey ' || (p_level + 2) || ' floor rests on it: remove that first.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('frame_jetty_roof_rests(uuid,building,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$return 'A roof over the jetty rests on walls or columns: raise a column on its '$tx6o$, ''))) / length($tx6o$return 'A roof over the jetty rests on walls or columns: raise a column on its '$tx6o$);
  if n <> 1 then raise exception 'frame_jetty_roof_rests: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'A roof over the jetty rests on walls or columns: raise a column on its '$tx6o$, $tx6n$return 'Jetty roof needs walls or columns: add a column on its '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$|| ' corner first. A railing carries nothing.';$tx6o$, ''))) / length($tx6o$|| ' corner first. A railing carries nothing.';$tx6o$);
  if n <> 1 then raise exception 'frame_jetty_roof_rests: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$|| ' corner first. A railing carries nothing.';$tx6o$, $tx6n$|| ' corner first. Railings carry nothing.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('frame_jetty_over(uuid,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$then b.name || '''s outside staircase stands on that tile.'
              else 'That tile is under ' || b.name || '''s jetty.' end$tx6o$, ''))) / length($tx6o$then b.name || '''s outside staircase stands on that tile.'
              else 'That tile is under ' || b.name || '''s jetty.' end$tx6o$);
  if n <> 1 then raise exception 'frame_jetty_over: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then b.name || '''s outside staircase stands on that tile.'
              else 'That tile is under ' || b.name || '''s jetty.' end$tx6o$, $tx6n$then b.name || ' outside staircase on that tile.'
              else 'Under ' || b.name || ' jetty.' end$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('frame_storey_on_wall(uuid,wall)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$select 'Storey ' || (p_w.level + 2) || ' stands on this wall: raise a column at each end of it, or take down the wall over it, first.'$tx6o$, ''))) / length($tx6o$select 'Storey ' || (p_w.level + 2) || ' stands on this wall: raise a column at each end of it, or take down the wall over it, first.'$tx6o$);
  if n <> 1 then raise exception 'frame_storey_on_wall: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select 'Storey ' || (p_w.level + 2) || ' stands on this wall: raise a column at each end of it, or take down the wall over it, first.'$tx6o$, $tx6n$select 'Storey ' || (p_w.level + 2) || ' rests on this wall: add a column at each end, or remove the wall above, first.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('frame_column_carries(uuid,building_column)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$return 'The ' || side_name(r.side) || ' side of ' || r.tx || ',' || r.ty
        || ' is carried on this column: wall it, or take off what is over it, first.';$tx6o$, ''))) / length($tx6o$return 'The ' || side_name(r.side) || ' side of ' || r.tx || ',' || r.ty
        || ' is carried on this column: wall it, or take off what is over it, first.';$tx6o$);
  if n <> 1 then raise exception 'frame_column_carries: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The ' || side_name(r.side) || ' side of ' || r.tx || ',' || r.ty
        || ' is carried on this column: wall it, or take off what is over it, first.';$tx6o$, $tx6n$return upper(left(side_name(r.side), 1)) || substr(side_name(r.side), 2) || ' side of ' || r.tx || ',' || r.ty
        || ' rests on this column: wall it, or remove what is above, first.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The roof over the jetty rests on this column: wall the ' || v_side || ', or take the roof off, first.';$tx6o$, ''))) / length($tx6o$return 'The roof over the jetty rests on this column: wall the ' || v_side || ', or take the roof off, first.';$tx6o$);
  if n <> 1 then raise exception 'frame_column_carries: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The roof over the jetty rests on this column: wall the ' || v_side || ', or take the roof off, first.';$tx6o$, $tx6n$return 'Jetty roof rests on this column: wall the ' || v_side || ', or remove the roof, first.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_frame(uuid,uuid,text,jsonb,building)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You plan a ' || lower(mat.name) || ' column on the ' || v_corner
      || ' corner. It needs ' || bill_text(mat.id, bill) || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You plan a ' || lower(mat.name) || ' column on the ' || v_corner
      || ' corner. It needs ' || bill_text(mat.id, bill) || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_frame: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You plan a ' || lower(mat.name) || ' column on the ' || v_corner
      || ' corner. It needs ' || bill_text(mat.id, bill) || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Planned: ' || lower(mat.name) || ' column, ' || v_corner
      || ' corner. Needs ' || bill_text(mat.id, bill) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You finish the ' || lower(mat.name) || ' column.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You finish the ' || lower(mat.name) || ' column.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_frame: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You finish the ' || lower(mat.name) || ' column.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Built: ' || lower(mat.name) || ' column.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You fit ' || laid_text(v_laid) || ' into the column. Still needed: '$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You fit ' || laid_text(v_laid) || ' into the column. Still needed: '$tx6o$);
  if n <> 1 then raise exception 'perform_frame: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You fit ' || laid_text(v_laid) || ' into the column. Still needed: '$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Added: ' || laid_text(v_laid) || '. Still needed: '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You take down the column on the ' || v_corner || ' corner.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You take down the column on the ' || v_corner || ' corner.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_frame: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You take down the column on the ' || v_corner || ' corner.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Removed: column, ' || v_corner || ' corner.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('frame_says(uuid,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$then ' On it is an outside staircase up to ' || j.name || '''s storey ' || (v_f.level + 1)$tx6o$, ''))) / length($tx6o$then ' On it is an outside staircase up to ' || j.name || '''s storey ' || (v_f.level + 1)$tx6o$);
  if n <> 1 then raise exception 'frame_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then ' On it is an outside staircase up to ' || j.name || '''s storey ' || (v_f.level + 1)$tx6o$, $tx6n$then ' Outside staircase: up to ' || j.name || ' storey ' || (v_f.level + 1)$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$else ' An outside staircase up to ' || j.name || '''s storey ' || (v_f.level + 1) || ' is planned on it.' end;$tx6o$, ''))) / length($tx6o$else ' An outside staircase up to ' || j.name || '''s storey ' || (v_f.level + 1) || ' is planned on it.' end;$tx6o$);
  if n <> 1 then raise exception 'frame_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$else ' An outside staircase up to ' || j.name || '''s storey ' || (v_f.level + 1) || ' is planned on it.' end;$tx6o$, $tx6n$else ' Outside staircase planned: up to ' || j.name || ' storey ' || (v_f.level + 1) || '.' end;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_out := v_out || ' A jetty of ' || j.name || '''s storey ' || (v_f.level + 1) || ' is planned over it.';$tx6o$, ''))) / length($tx6o$v_out := v_out || ' A jetty of ' || j.name || '''s storey ' || (v_f.level + 1) || ' is planned over it.';$tx6o$);
  if n <> 1 then raise exception 'frame_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_out := v_out || ' A jetty of ' || j.name || '''s storey ' || (v_f.level + 1) || ' is planned over it.';$tx6o$, $tx6n$v_out := v_out || ' Jetty planned over it: ' || j.name || ' storey ' || (v_f.level + 1) || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_out := v_out || ' Over it is a jetty of ' || j.name || '''s storey ' || (v_f.level + 1)
          || ', part of that storey: its open sides want a wall, a railing or columns to close the storey in, and a roof over it rests on walls or columns, never on a railing.';$tx6o$, ''))) / length($tx6o$v_out := v_out || ' Over it is a jetty of ' || j.name || '''s storey ' || (v_f.level + 1)
          || ', part of that storey: its open sides want a wall, a railing or columns to close the storey in, and a roof over it rests on walls or columns, never on a railing.';$tx6o$);
  if n <> 1 then raise exception 'frame_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_out := v_out || ' Over it is a jetty of ' || j.name || '''s storey ' || (v_f.level + 1)
          || ', part of that storey: its open sides want a wall, a railing or columns to close the storey in, and a roof over it rests on walls or columns, never on a railing.';$tx6o$, $tx6n$v_out := v_out || ' Jetty over it: ' || j.name || ' storey ' || (v_f.level + 1)
          || ', part of that storey. Open sides need a wall, railing or columns to enclose it; a roof over it needs walls or columns, not railings.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_out := v_out || ' Over it is a balcony of ' || j.name || '''s storey ' || (v_f.level + 1)
          || ', shut off from the storey by a wall or a door: it takes a railing, and no roof.';$tx6o$, ''))) / length($tx6o$v_out := v_out || ' Over it is a balcony of ' || j.name || '''s storey ' || (v_f.level + 1)
          || ', shut off from the storey by a wall or a door: it takes a railing, and no roof.';$tx6o$);
  if n <> 1 then raise exception 'frame_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_out := v_out || ' Over it is a balcony of ' || j.name || '''s storey ' || (v_f.level + 1)
          || ', shut off from the storey by a wall or a door: it takes a railing, and no roof.';$tx6o$, $tx6n$v_out := v_out || ' Balcony over it: ' || j.name || ' storey ' || (v_f.level + 1)
          || ', walled off from the storey. Railing only, no roof.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_out := v_out || ' Under a roof on columns: what is left here decays at ' || round(indoors_decay() * 100)::int
      || '% of the rate in the open, but a bed here is in the open: the ×' || indoors_rest()
      || ' rest of a bed indoors wants walls all round.';$tx6o$, ''))) / length($tx6o$v_out := v_out || ' Under a roof on columns: what is left here decays at ' || round(indoors_decay() * 100)::int
      || '% of the rate in the open, but a bed here is in the open: the ×' || indoors_rest()
      || ' rest of a bed indoors wants walls all round.';$tx6o$);
  if n <> 1 then raise exception 'frame_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_out := v_out || ' Under a roof on columns: what is left here decays at ' || round(indoors_decay() * 100)::int
      || '% of the rate in the open, but a bed here is in the open: the ×' || indoors_rest()
      || ' rest of a bed indoors wants walls all round.';$tx6o$, $tx6n$v_out := v_out || ' Under a roof on columns: decay ×' || indoors_decay()
      || '. Beds here count as outdoors (indoor rest ×' || indoors_rest()
      || ' needs walls all round).';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('cast_reason(uuid,uuid,text,bigint)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Choose something to lay it on.'$tx6o$, ''))) / length($tx6o$'Choose something to lay it on.'$tx6o$);
  if n <> 1 then raise exception 'cast_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Choose something to lay it on.'$tx6o$, $tx6n$'Choose an item.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'What you washed ashore with has nothing in it to work on.'$tx6o$, ''))) / length($tx6o$'What you washed ashore with has nothing in it to work on.'$tx6o$);
  if n <> 1 then raise exception 'cast_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'What you washed ashore with has nothing in it to work on.'$tx6o$, $tx6n$'Not on starting-kit tools.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Nothing travels with you.'$tx6o$, ''))) / length($tx6o$'Nothing travels with you.'$tx6o$);
  if n <> 1 then raise exception 'cast_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing travels with you.'$tx6o$, $tx6n$'No active companion.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Nothing is open on you.'$tx6o$, ''))) / length($tx6o$'Nothing is open on you.'$tx6o$);
  if n <> 1 then raise exception 'cast_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing is open on you.'$tx6o$, $tx6n$'No wounds.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You have no settlement, and so no fields.'$tx6o$, ''))) / length($tx6o$'You have no settlement, and so no fields.'$tx6o$);
  if n <> 1 then raise exception 'cast_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You have no settlement, and so no fields.'$tx6o$, $tx6n$'No settlement.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return d.name || ' takes ' || to_char(d.level, 'FM990') || ' faith; you have '$tx6o$, ''))) / length($tx6o$return d.name || ' takes ' || to_char(d.level, 'FM990') || ' faith; you have '$tx6o$);
  if n <> 1 then raise exception 'cast_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return d.name || ' takes ' || to_char(d.level, 'FM990') || ' faith; you have '$tx6o$, $tx6n$return d.name || ' needs faith ' || to_char(d.level, 'FM990') || '; have '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return d.name || ' costs ' || to_char(d.cost, 'FM990') || ' favour; you hold '$tx6o$, ''))) / length($tx6o$return d.name || ' costs ' || to_char(d.cost, 'FM990') || ' favour; you hold '$tx6o$);
  if n <> 1 then raise exception 'cast_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return d.name || ' costs ' || to_char(d.cost, 'FM990') || ' favour; you hold '$tx6o$, $tx6n$return d.name || ' costs ' || to_char(d.cost, 'FM990') || ' favour; have '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'There is nothing wrong with the ' || lower(item_name(it)) || '.';$tx6o$, ''))) / length($tx6o$return 'There is nothing wrong with the ' || lower(item_name(it)) || '.';$tx6o$);
  if n <> 1 then raise exception 'cast_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'There is nothing wrong with the ' || lower(item_name(it)) || '.';$tx6o$, $tx6n$return item_name(it) || ': not damaged.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The ' || lower(item_name(it)) || ' has taken all it will take.';$tx6o$, ''))) / length($tx6o$return 'The ' || lower(item_name(it)) || ' has taken all it will take.';$tx6o$);
  if n <> 1 then raise exception 'cast_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The ' || lower(item_name(it)) || ' has taken all it will take.';$tx6o$, $tx6n$return item_name(it) || ': max ' || round(bless_cap()) || ' casts reached.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('do_cast(uuid,uuid,text,bigint)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Nothing comes.'$tx6o$, ''))) / length($tx6o$'Nothing comes.'$tx6o$);
  if n <> 1 then raise exception 'do_cast: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing comes.'$tx6o$, $tx6n$'No companion came.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The wind comes round behind you and settles there.'$tx6o$, ''))) / length($tx6o$'The wind comes round behind you and settles there.'$tx6o$);
  if n <> 1 then raise exception 'do_cast: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The wind comes round behind you and settles there.'$tx6o$, $tx6n$'Wind turned to behind you.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Nothing is in the ground to come on.'$tx6o$, ''))) / length($tx6o$'Nothing is in the ground to come on.'$tx6o$);
  if n <> 1 then raise exception 'do_cast: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing is in the ground to come on.'$tx6o$, $tx6n$'No crops to grow.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Nothing happens.'$tx6o$, ''))) / length($tx6o$'Nothing happens.'$tx6o$);
  if n <> 1 then raise exception 'do_cast: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing happens.'$tx6o$, $tx6n$'No effect.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return c.name || ' is beside you, and gives no sign of having travelled.';$tx6o$, ''))) / length($tx6o$return c.name || ' is beside you, and gives no sign of having travelled.';$tx6o$);
  if n <> 1 then raise exception 'do_cast: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return c.name || ' is beside you, and gives no sign of having travelled.';$tx6o$, $tx6n$return c.name || ' is beside you.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'Every mark of use goes out of the ' || lower(item_name(it)) || '.';$tx6o$, ''))) / length($tx6o$return 'Every mark of use goes out of the ' || lower(item_name(it)) || '.';$tx6o$);
  if n <> 1 then raise exception 'do_cast: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'Every mark of use goes out of the ' || lower(item_name(it)) || '.';$tx6o$, $tx6n$return 'Repaired: ' || lower(item_name(it)) || ', 0 damage.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return case when n = 1 then 'The wound closes over, and what had gone bad is clean.'
                else 'All ' || n || ' of them close over, and what had gone bad is clean.' end;$tx6o$, ''))) / length($tx6o$return case when n = 1 then 'The wound closes over, and what had gone bad is clean.'
                else 'All ' || n || ' of them close over, and what had gone bad is clean.' end;$tx6o$);
  if n <> 1 then raise exception 'do_cast: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return case when n = 1 then 'The wound closes over, and what had gone bad is clean.'
                else 'All ' || n || ' of them close over, and what had gone bad is clean.' end;$tx6o$, $tx6n$return 'Healed: ' || n || case when n = 1 then ' wound' else ' wounds' end || '; infection cured.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The ' || lower(item_name(it)) || ' comes out of it working '
      || round(least(bless_cap(), coalesce(it.bless, 0)) * bless_step()) || '% better than it was made. ('
      || it.bless || ' of ' || round(bless_cap()) || ')';$tx6o$, ''))) / length($tx6o$return 'The ' || lower(item_name(it)) || ' comes out of it working '
      || round(least(bless_cap(), coalesce(it.bless, 0)) * bless_step()) || '% better than it was made. ('
      || it.bless || ' of ' || round(bless_cap()) || ')';$tx6o$);
  if n <> 1 then raise exception 'do_cast: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The ' || lower(item_name(it)) || ' comes out of it working '
      || round(least(bless_cap(), coalesce(it.bless, 0)) * bless_step()) || '% better than it was made. ('
      || it.bless || ' of ' || round(bless_cap()) || ')';$tx6o$, $tx6n$return item_name(it) || ': +'
      || round(least(bless_cap(), coalesce(it.bless, 0)) * bless_step()) || '% ('
      || it.bless || '/' || round(bless_cap()) || ' casts).';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return case when n > 0 then 'Every field on the settlement comes on a stage: ' || n || ' of them.'$tx6o$, ''))) / length($tx6o$return case when n > 0 then 'Every field on the settlement comes on a stage: ' || n || ' of them.'$tx6o$);
  if n <> 1 then raise exception 'do_cast: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return case when n > 0 then 'Every field on the settlement comes on a stage: ' || n || ' of them.'$tx6o$, $tx6n$return case when n > 0 then 'Crops grown 1 stage: ' || n || '.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('faith_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Kneel at the altar.'$tx6o$, ''))) / length($tx6o$'Kneel at the altar.'$tx6o$);
  if n <> 1 then raise exception 'faith_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Kneel at the altar.'$tx6o$, $tx6n$'Stand at the altar.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You prayed less than ' || round(prayer_rest() / 60) || ' minutes ago. ' || ceil(rest / 60) || ' minutes to go.';$tx6o$, ''))) / length($tx6o$return 'You prayed less than ' || round(prayer_rest() / 60) || ' minutes ago. ' || ceil(rest / 60) || ' minutes to go.';$tx6o$);
  if n <> 1 then raise exception 'faith_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You prayed less than ' || round(prayer_rest() / 60) || ' minutes ago. ' || ceil(rest / 60) || ' minutes to go.';$tx6o$, $tx6n$return 'Prayer cooldown: ' || round(prayer_rest() / 60) || ' min. ' || ceil(rest / 60) || ' min left.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('sacrifice_setting(uuid,uuid,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Kneel at the altar.'$tx6o$, ''))) / length($tx6o$'Kneel at the altar.'$tx6o$);
  if n <> 1 then raise exception 'sacrifice_setting: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Kneel at the altar.'$tx6o$, $tx6n$'Stand at the altar.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That is not an altar.'$tx6o$, ''))) / length($tx6o$'That is not an altar.'$tx6o$);
  if n <> 1 then raise exception 'sacrifice_setting: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is not an altar.'$tx6o$, $tx6n$'Not an altar.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A soul is not given up. Absorb it into something instead.'$tx6o$, ''))) / length($tx6o$'A soul is not given up. Absorb it into something instead.'$tx6o$);
  if n <> 1 then raise exception 'sacrifice_setting: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A soul is not given up. Absorb it into something instead.'$tx6o$, $tx6n$'Souls cannot be sacrificed: absorb it into an item.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It is kept back. Put it back in the pack first.'$tx6o$, ''))) / length($tx6o$'It is kept back. Put it back in the pack first.'$tx6o$);
  if n <> 1 then raise exception 'sacrifice_setting: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is kept back. Put it back in the pack first.'$tx6o$, $tx6n$'Set aside: return it to the pack first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Let the wildermon out first.'$tx6o$, ''))) / length($tx6o$'Let the wildermon out first.'$tx6o$);
  if n <> 1 then raise exception 'sacrifice_setting: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Let the wildermon out first.'$tx6o$, $tx6n$'Release the wildermon first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$o_why := 'Choose a rare, supreme or fantastic thing to give up.'$tx6o$, ''))) / length($tx6o$o_why := 'Choose a rare, supreme or fantastic thing to give up.'$tx6o$);
  if n <> 1 then raise exception 'sacrifice_setting: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$o_why := 'Choose a rare, supreme or fantastic thing to give up.'$tx6o$, $tx6n$o_why := 'Choose a rare, supreme or fantastic item.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$o_why := 'Only a rare, supreme or fantastic thing may be given up.'$tx6o$, ''))) / length($tx6o$o_why := 'Only a rare, supreme or fantastic thing may be given up.'$tx6o$);
  if n <> 1 then raise exception 'sacrifice_setting: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$o_why := 'Only a rare, supreme or fantastic thing may be given up.'$tx6o$, $tx6n$o_why := 'Only rare, supreme or fantastic items.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('planter_refusal(uuid,uuid,text,placed,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Something is already growing there.'$tx6o$, ''))) / length($tx6o$'Something is already growing there.'$tx6o$);
  if n <> 1 then raise exception 'planter_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Something is already growing there.'$tx6o$, $tx6n$'Already growing a crop.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Choose a seed to sow.'$tx6o$, ''))) / length($tx6o$'Choose a seed to sow.'$tx6o$);
  if n <> 1 then raise exception 'planter_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Choose a seed to sow.'$tx6o$, $tx6n$'Choose a seed.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Nothing is growing there.'$tx6o$, ''))) / length($tx6o$'Nothing is growing there.'$tx6o$);
  if n <> 4 then raise exception 'planter_refusal: % of an anchor, not 4', n; end if;
  v := replace(v, $tx6o$'Nothing is growing there.'$tx6o$, $tx6n$'No crop there.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It is ripe. Harvest it.'$tx6o$, ''))) / length($tx6o$'It is ripe. Harvest it.'$tx6o$);
  if n <> 1 then raise exception 'planter_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is ripe. Harvest it.'$tx6o$, $tx6n$'Ripe: harvest it.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You have already tended it at this stage. Wait for it to grow on.'$tx6o$, ''))) / length($tx6o$'You have already tended it at this stage. Wait for it to grow on.'$tx6o$);
  if n <> 1 then raise exception 'planter_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You have already tended it at this stage. Wait for it to grow on.'$tx6o$, $tx6n$'Already tended at this stage.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then return 'It is only ' || crop_stage_name(v_stage) || '. Let it grow.'; end if;$tx6o$, ''))) / length($tx6o$then return 'It is only ' || crop_stage_name(v_stage) || '. Let it grow.'; end if;$tx6o$);
  if n <> 1 then raise exception 'planter_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then return 'It is only ' || crop_stage_name(v_stage) || '. Let it grow.'; end if;$tx6o$, $tx6n$then return 'Not ripe: ' || crop_stage_name(v_stage) || '.'; end if;$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_faith(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$then 'You kneel in the half light and it goes better than it usually does.'
           else 'You kneel at the stone.' end
      || ' Favour ' || floor(got) || ' of ' || floor(cap) || '.', 'event');$tx6o$, ''))) / length($tx6o$then 'You kneel in the half light and it goes better than it usually does.'
           else 'You kneel at the stone.' end
      || ' Favour ' || floor(got) || ' of ' || floor(cap) || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_faith: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then 'You kneel in the half light and it goes better than it usually does.'
           else 'You kneel at the stone.' end
      || ' Favour ' || floor(got) || ' of ' || floor(cap) || '.', 'event');$tx6o$, $tx6n$then 'Prayed (dawn or dusk bonus).'
           else 'Prayed.' end
      || ' Favour ' || floor(got) || '/' || floor(cap) || '.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('sown_said(text,boolean,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$select 'You sow ' || lower(p_name) || case when p_planter then ' in the planter' else '' end$tx6o$, ''))) / length($tx6o$select 'You sow ' || lower(p_name) || case when p_planter then ' in the planter' else '' end$tx6o$);
  if n <> 1 then raise exception 'sown_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select 'You sow ' || lower(p_name) || case when p_planter then ' in the planter' else '' end$tx6o$, $tx6n$select 'Sown: ' || lower(p_name) || case when p_planter then ', planter' else '' end$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('sown_said_on(text,text,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$select 'You sow ' || lower(p_name)
      || case p_clock when 'planter' then ' in the planter' when 'glass' then ' under glass' else '' end$tx6o$, ''))) / length($tx6o$select 'You sow ' || lower(p_name)
      || case p_clock when 'planter' then ' in the planter' when 'glass' then ' under glass' else '' end$tx6o$);
  if n <> 1 then raise exception 'sown_said_on: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select 'You sow ' || lower(p_name)
      || case p_clock when 'planter' then ' in the planter' when 'glass' then ' under glass' else '' end$tx6o$, $tx6n$select 'Sown: ' || lower(p_name)
      || case p_clock when 'planter' then ', planter' when 'glass' then ', under glass' else '' end$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_planter(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$|| case when v_how = 'kept' then ' It cost you no seed.' else '' end, 'event');$tx6o$, ''))) / length($tx6o$|| case when v_how = 'kept' then ' It cost you no seed.' else '' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_planter: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$|| case when v_how = 'kept' then ' It cost you no seed.' else '' end, 'event');$tx6o$, $tx6n$|| case when v_how = 'kept' then ' Seed kept.' else '' end, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You weed and water the ' || lower(cd.name) || '. It should give '
      || yld[2] || ' ' || lower((select coalesce(name, cd.produce) from item_def where id = cd.produce))
      || ' and ' || yld[1] || ' seed'$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You weed and water the ' || lower(cd.name) || '. It should give '
      || yld[2] || ' ' || lower((select coalesce(name, cd.produce) from item_def where id = cd.produce))
      || ' and ' || yld[1] || ' seed'$tx6o$);
  if n <> 1 then raise exception 'perform_planter: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You weed and water the ' || lower(cd.name) || '. It should give '
      || yld[2] || ' ' || lower((select coalesce(name, cd.produce) from item_def where id = cd.produce))
      || ' and ' || yld[1] || ' seed'$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Tended: ' || lower(cd.name) || '. Expected yield: '
      || yld[2] || ' ' || lower((select coalesce(name, cd.produce) from item_def where id = cd.produce))
      || ', ' || yld[1] || ' seed'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You harvest ' || r.o_got || ' × ' || coalesce(r.o_rare || ' ', '')
      || lower((select coalesce(name, r.o_produce) from item_def where id = r.o_produce))
      || ' and ' || r.o_seeds || ' ' || lower((select coalesce(name, r.o_seed) from item_def where id = r.o_seed))
      || '. The planter is ready to sow again. (QL ' || to_char(r.o_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You harvest ' || r.o_got || ' × ' || coalesce(r.o_rare || ' ', '')
      || lower((select coalesce(name, r.o_produce) from item_def where id = r.o_produce))
      || ' and ' || r.o_seeds || ' ' || lower((select coalesce(name, r.o_seed) from item_def where id = r.o_seed))
      || '. The planter is ready to sow again. (QL ' || to_char(r.o_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_planter: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You harvest ' || r.o_got || ' × ' || coalesce(r.o_rare || ' ', '')
      || lower((select coalesce(name, r.o_produce) from item_def where id = r.o_produce))
      || ' and ' || r.o_seeds || ' ' || lower((select coalesce(name, r.o_seed) from item_def where id = r.o_seed))
      || '. The planter is ready to sow again. (QL ' || to_char(r.o_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Harvested: ' || r.o_got || ' × ' || coalesce(r.o_rare || ' ', '')
      || lower((select coalesce(name, r.o_produce) from item_def where id = r.o_produce))
      || ', ' || r.o_seeds || ' ' || lower((select coalesce(name, r.o_seed) from item_def where id = r.o_seed))
      || ', QL ' || to_char(r.o_ql, 'FM990.0') || '. Planter ready to sow.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You turn the ' || lower(cd.name) || ' back into the soil.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You turn the ' || lower(cd.name) || ' back into the soil.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_planter: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You turn the ' || lower(cd.name) || ' back into the soil.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Cleared: ' || lower(cd.name) || '.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('dress_refusal_for(uuid,uuid,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You have nothing to dress it with.'$tx6o$, ''))) / length($tx6o$'You have nothing to dress it with.'$tx6o$);
  if n <> 1 then raise exception 'dress_refusal_for: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You have nothing to dress it with.'$tx6o$, $tx6n$'Nothing to dress it with.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return wound_on_your(w) || ' has gone bad. Clean it out before anything will hold on it.';$tx6o$, ''))) / length($tx6o$return wound_on_your(w) || ' has gone bad. Clean it out before anything will hold on it.';$tx6o$);
  if n <> 1 then raise exception 'dress_refusal_for: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return wound_on_your(w) || ' has gone bad. Clean it out before anything will hold on it.';$tx6o$, $tx6n$return wound_on_your(w) || ': infected. Clean it with lye first.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return wound_on_your(w) || ' is already dressed at least as well as what you carry would dress it.';$tx6o$, ''))) / length($tx6o$return wound_on_your(w) || ' is already dressed at least as well as what you carry would dress it.';$tx6o$);
  if n <> 1 then raise exception 'dress_refusal_for: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return wound_on_your(w) || ' is already dressed at least as well as what you carry would dress it.';$tx6o$, $tx6n$return wound_on_your(w) || ': already dressed as well or better.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_fight(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$when not clean then 'The dressing slips and you make a poor job of it. ' || coalesce(pt.name, 'They')
          || ' still has ' || wound_text(hurt) || '.'
        else 'You dress the ' || v_kind || ' on ' || coalesce(pt.name, 'their') || '''s ' || part_name(hurt->>'part')
          || case when suits then ' with ' || got || ', which suits it.' when got <> '' then ' with ' || got || '.'
                  else ' with cloth.' end$tx6o$, ''))) / length($tx6o$when not clean then 'The dressing slips and you make a poor job of it. ' || coalesce(pt.name, 'They')
          || ' still has ' || wound_text(hurt) || '.'
        else 'You dress the ' || v_kind || ' on ' || coalesce(pt.name, 'their') || '''s ' || part_name(hurt->>'part')
          || case when suits then ' with ' || got || ', which suits it.' when got <> '' then ' with ' || got || '.'
                  else ' with cloth.' end$tx6o$);
  if n <> 1 then raise exception 'perform_fight: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$when not clean then 'The dressing slips and you make a poor job of it. ' || coalesce(pt.name, 'They')
          || ' still has ' || wound_text(hurt) || '.'
        else 'You dress the ' || v_kind || ' on ' || coalesce(pt.name, 'their') || '''s ' || part_name(hurt->>'part')
          || case when suits then ' with ' || got || ', which suits it.' when got <> '' then ' with ' || got || '.'
                  else ' with cloth.' end$tx6o$, $tx6n$when not clean then 'Dressing failed: ' || coalesce(pt.name, 'They')
          || ' still has ' || wound_text(hurt) || '.'
        else 'Dressed: ' || v_kind || ' on ' || coalesce(pt.name, 'their') || '''s ' || part_name(hurt->>'part')
          || case when suits then ', ' || got || ' (right herb).' when got <> '' then ', ' || got || '.'
                  else ', cloth.' end$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then ' dresses the ' || v_kind || ' on your ' || part_name(hurt->>'part') || '.'
        else ' tries to dress the ' || v_kind || ' on your ' || part_name(hurt->>'part') || ' and makes a poor job of it.' end,$tx6o$, ''))) / length($tx6o$then ' dresses the ' || v_kind || ' on your ' || part_name(hurt->>'part') || '.'
        else ' tries to dress the ' || v_kind || ' on your ' || part_name(hurt->>'part') || ' and makes a poor job of it.' end,$tx6o$);
  if n <> 1 then raise exception 'perform_fight: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then ' dresses the ' || v_kind || ' on your ' || part_name(hurt->>'part') || '.'
        else ' tries to dress the ' || v_kind || ' on your ' || part_name(hurt->>'part') || ' and makes a poor job of it.' end,$tx6o$, $tx6n$then ' dressed the ' || v_kind || ' on your ' || part_name(hurt->>'part') || '.'
        else ' failed to dress the ' || v_kind || ' on your ' || part_name(hurt->>'part') || '.' end,$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$when not clean then 'The dressing slips and you make a poor job of it. You still have '
        || wound_text(hurt) || '.'$tx6o$, ''))) / length($tx6o$when not clean then 'The dressing slips and you make a poor job of it. You still have '
        || wound_text(hurt) || '.'$tx6o$);
  if n <> 1 then raise exception 'perform_fight: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$when not clean then 'The dressing slips and you make a poor job of it. You still have '
        || wound_text(hurt) || '.'$tx6o$, $tx6n$when not clean then 'Dressing failed: '
        || wound_text(hurt) || ' remains.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$when suits then 'You lay the ' || got || ' cover on the ' || v_kind || ' on your ' || part_name(hurt->>'part')
        || ' and bind it. The bleeding stops at once and it is already closing.'
      when got <> '' then 'You bind the ' || got || ' cover over the ' || v_kind || ' on your ' || part_name(hurt->>'part')
        || '. It is the wrong herb for a ' || v_kind || ', but it holds and the bleeding stops.'
      else 'You clean the ' || v_kind || ' on your ' || part_name(hurt->>'part')
        || ' and bind it with cloth. The bleeding stops, though it will be slow to close.'$tx6o$, ''))) / length($tx6o$when suits then 'You lay the ' || got || ' cover on the ' || v_kind || ' on your ' || part_name(hurt->>'part')
        || ' and bind it. The bleeding stops at once and it is already closing.'
      when got <> '' then 'You bind the ' || got || ' cover over the ' || v_kind || ' on your ' || part_name(hurt->>'part')
        || '. It is the wrong herb for a ' || v_kind || ', but it holds and the bleeding stops.'
      else 'You clean the ' || v_kind || ' on your ' || part_name(hurt->>'part')
        || ' and bind it with cloth. The bleeding stops, though it will be slow to close.'$tx6o$);
  if n <> 1 then raise exception 'perform_fight: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$when suits then 'You lay the ' || got || ' cover on the ' || v_kind || ' on your ' || part_name(hurt->>'part')
        || ' and bind it. The bleeding stops at once and it is already closing.'
      when got <> '' then 'You bind the ' || got || ' cover over the ' || v_kind || ' on your ' || part_name(hurt->>'part')
        || '. It is the wrong herb for a ' || v_kind || ', but it holds and the bleeding stops.'
      else 'You clean the ' || v_kind || ' on your ' || part_name(hurt->>'part')
        || ' and bind it with cloth. The bleeding stops, though it will be slow to close.'$tx6o$, $tx6n$when suits then 'Dressed: the ' || v_kind || ' on your ' || part_name(hurt->>'part')
        || ', ' || got || ' cover. Bleeding stopped; heals fast.'
      when got <> '' then 'Dressed: the ' || v_kind || ' on your ' || part_name(hurt->>'part')
        || ', ' || got || ' cover (wrong herb for a ' || v_kind || '). Bleeding stopped.'
      else 'Dressed: the ' || v_kind || ' on your ' || part_name(hurt->>'part')
        || ', cloth. Bleeding stopped; heals slowly.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You scour the '
        || (select name from wound_kind_def where id = hurt->>'kind')
        || ' out and it is no better for it. The lye is gone.', 'error');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You scour the '
        || (select name from wound_kind_def where id = hurt->>'kind')
        || ' out and it is no better for it. The lye is gone.', 'error');$tx6o$);
  if n <> 1 then raise exception 'perform_fight: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You scour the '
        || (select name from wound_kind_def where id = hurt->>'kind')
        || ' out and it is no better for it. The lye is gone.', 'error');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Cleaning failed: '
        || (select name from wound_kind_def where id = hurt->>'kind')
        || ' still infected. Lye used.', 'error');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You scour the '
      || (select name from wound_kind_def where id = hurt->>'kind') || ' on your '
      || part_name(hurt->>'part') || ' out with lye. It is open and clean again, and bleeding. Dress it.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You scour the '
      || (select name from wound_kind_def where id = hurt->>'kind') || ' on your '
      || part_name(hurt->>'part') || ' out with lye. It is open and clean again, and bleeding. Dress it.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_fight: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You scour the '
      || (select name from wound_kind_def where id = hurt->>'kind') || ' on your '
      || part_name(hurt->>'part') || ' out with lye. It is open and clean again, and bleeding. Dress it.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Cleaned: '
      || (select name from wound_kind_def where id = hurt->>'kind') || ' on your '
      || part_name(hurt->>'part') || '. Infection gone; bleeding again. Dress it.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then 'You dress ' || c.name || '''s wounds with the '
        || lower((select name from item_def where id = 'bandage')) || '. It is up to '
      else c.name || ' will not hold still and the dressing goes on badly. It is up to '
      end || ceil(c.health) || ' of ' || top || '.', 'event');$tx6o$, ''))) / length($tx6o$then 'You dress ' || c.name || '''s wounds with the '
        || lower((select name from item_def where id = 'bandage')) || '. It is up to '
      else c.name || ' will not hold still and the dressing goes on badly. It is up to '
      end || ceil(c.health) || ' of ' || top || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_fight: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then 'You dress ' || c.name || '''s wounds with the '
        || lower((select name from item_def where id = 'bandage')) || '. It is up to '
      else c.name || ' will not hold still and the dressing goes on badly. It is up to '
      end || ceil(c.health) || ' of ' || top || '.', 'event');$tx6o$, $tx6n$then 'Treated ' || c.name || ': '
        || lower((select name from item_def where id = 'bandage')) || ' used. Health '
      else 'Treatment went badly (35% effect): ' || c.name || ' health '
      end || ceil(c.health) || '/' || top || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You need both hands for that, so the '
          || lower((select name from item_def where id = shield.def)) || ' goes on your back.', 'info');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You need both hands for that, so the '
          || lower((select name from item_def where id = shield.def)) || ' goes on your back.', 'info');$tx6o$);
  if n <> 1 then raise exception 'perform_fight: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You need both hands for that, so the '
          || lower((select name from item_def where id = shield.def)) || ' goes on your back.', 'info');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Needs both hands: '
          || lower((select name from item_def where id = shield.def)) || ' unequipped.', 'info');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You '
      || case when slot in ('weapon', 'offhand') then 'take up' else 'put on' end
      || ' the ' || lower((select name from item_def where id = it.def)) || '.', 'info');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You '
      || case when slot in ('weapon', 'offhand') then 'take up' else 'put on' end
      || ' the ' || lower((select name from item_def where id = it.def)) || '.', 'info');$tx6o$);
  if n <> 1 then raise exception 'perform_fight: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You '
      || case when slot in ('weapon', 'offhand') then 'take up' else 'put on' end
      || ' the ' || lower((select name from item_def where id = it.def)) || '.', 'info');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Equipped: '
      || lower((select name from item_def where id = it.def)) || '.', 'info');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You put the '
      || lower((select name from item_def where id = it.def)) || ' away.', 'info');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You put the '
      || lower((select name from item_def where id = it.def)) || ' away.', 'info');$tx6o$);
  if n <> 1 then raise exception 'perform_fight: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You put the '
      || lower((select name from item_def where id = it.def)) || ' away.', 'info');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Unequipped: '
      || lower((select name from item_def where id = it.def)) || '.', 'info');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'Something rattles as the belly opens: ' || array_length(lumps, 1)
        || ' lumps of what it had been sleeping on. '$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'Something rattles as the belly opens: ' || array_length(lumps, 1)
        || ' lumps of what it had been sleeping on. '$tx6o$);
  if n <> 1 then raise exception 'perform_fight: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'Something rattles as the belly opens: ' || array_length(lumps, 1)
        || ' lumps of what it had been sleeping on. '$tx6o$, $tx6n$perform tell(p_world, p_uid, 'In its belly: ' || array_length(lumps, 1)
        || ' lumps. '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You make a mess of the ' || lower(sp.name)
        || ' carcass and salvage nothing.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You make a mess of the ' || lower(sp.name)
        || ' carcass and salvage nothing.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_fight: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You make a mess of the ' || lower(sp.name)
        || ' carcass and salvage nothing.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Butchering failed: ' || lower(sp.name)
        || ' carcass lost.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You butcher the ' || lower(sp.name) || ' and take '
        || array_to_string(taken, ', ') || ' (QL ' || to_char(greatest(1, least(100, made_ql)), 'FM990.0') || ').'
        || case when knife_ql is null then ' Bare hands waste most of a carcass.' else '' end, 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You butcher the ' || lower(sp.name) || ' and take '
        || array_to_string(taken, ', ') || ' (QL ' || to_char(greatest(1, least(100, made_ql)), 'FM990.0') || ').'
        || case when knife_ql is null then ' Bare hands waste most of a carcass.' else '' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_fight: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You butcher the ' || lower(sp.name) || ' and take '
        || array_to_string(taken, ', ') || ' (QL ' || to_char(greatest(1, least(100, made_ql)), 'FM990.0') || ').'
        || case when knife_ql is null then ' Bare hands waste most of a carcass.' else '' end, 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Butchered: ' || lower(sp.name) || '. Got '
        || array_to_string(taken, ', ') || ', QL ' || to_char(greatest(1, least(100, made_ql)), 'FM990.0') || '.'
        || case when knife_ql is null then ' No knife: most of the carcass wasted.' else '' end, 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('fish_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'There is no water close enough to drag a net through. Wade in.'$tx6o$, ''))) / length($tx6o$'There is no water close enough to drag a net through. Wade in.'$tx6o$);
  if n <> 1 then raise exception 'fish_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no water close enough to drag a net through. Wade in.'$tx6o$, $tx6n$'No water in net reach: wade in.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The water is too thin to drag a net through.'$tx6o$, ''))) / length($tx6o$'The water is too thin to drag a net through.'$tx6o$);
  if n <> 1 then raise exception 'fish_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The water is too thin to drag a net through.'$tx6o$, $tx6n$'Water too shallow for a net.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no water within reach deep enough to hold anything. Walk to the bank.'$tx6o$, ''))) / length($tx6o$'There is no water within reach deep enough to hold anything. Walk to the bank.'$tx6o$);
  if n <> 1 then raise exception 'fish_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no water within reach deep enough to hold anything. Walk to the bank.'$tx6o$, $tx6n$'No fishable water in reach: walk to the bank.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Nothing you could land runs in water this shallow.'$tx6o$, ''))) / length($tx6o$'Nothing you could land runs in water this shallow.'$tx6o$);
  if n <> 1 then raise exception 'fish_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing you could land runs in water this shallow.'$tx6o$, $tx6n$'No fish here at your fishing skill.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_fish(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'The net comes up with nothing in it but weed.'$tx6o$, ''))) / length($tx6o$'The net comes up with nothing in it but weed.'$tx6o$);
  if n <> 1 then raise exception 'perform_fish: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The net comes up with nothing in it but weed.'$tx6o$, $tx6n$'Net: no fish here at your fishing skill.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The net comes up empty.'$tx6o$, ''))) / length($tx6o$'The net comes up empty.'$tx6o$);
  if n <> 1 then raise exception 'perform_fish: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The net comes up empty.'$tx6o$, $tx6n$'Net came up empty.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Something takes it and comes off again.'$tx6o$, ''))) / length($tx6o$'Something takes it and comes off again.'$tx6o$);
  if n <> 1 then raise exception 'perform_fish: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Something takes it and comes off again.'$tx6o$, $tx6n$'Bite lost.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, case when bait is null then 'Bite lost.'
        else 'Something takes the ' || lower((select coalesce(name, bait) from item_def where id = bait))
             || ' and comes off again.' end, 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, case when bait is null then 'Bite lost.'
        else 'Something takes the ' || lower((select coalesce(name, bait) from item_def where id = bait))
             || ' and comes off again.' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_fish: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, case when bait is null then 'Bite lost.'
        else 'Something takes the ' || lower((select coalesce(name, bait) from item_def where id = bait))
             || ' and comes off again.' end, 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, case when bait is null then 'Bite lost.'
        else 'Bite lost: ' || lower((select coalesce(name, bait) from item_def where id = bait))
             || ' taken.' end, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You land '
        || case when coalesce(v_rare, lower((select name from fish_def where id = got))) ~ '^[aeiou]' then 'an ' else 'a ' end
        || coalesce(v_rare || ' ', '') || lower((select name from fish_def where id = got))
        || case when bait is null then '' else ' on the '
             || lower((select coalesce(name, bait) from item_def where id = bait)) end
        || '. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You land '
        || case when coalesce(v_rare, lower((select name from fish_def where id = got))) ~ '^[aeiou]' then 'an ' else 'a ' end
        || coalesce(v_rare || ' ', '') || lower((select name from fish_def where id = got))
        || case when bait is null then '' else ' on the '
             || lower((select coalesce(name, bait) from item_def where id = bait)) end
        || '. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_fish: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You land '
        || case when coalesce(v_rare, lower((select name from fish_def where id = got))) ~ '^[aeiou]' then 'an ' else 'a ' end
        || coalesce(v_rare || ' ', '') || lower((select name from fish_def where id = got))
        || case when bait is null then '' else ' on the '
             || lower((select coalesce(name, bait) from item_def where id = bait)) end
        || '. (QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Caught: '
        || coalesce(v_rare || ' ', '') || lower((select name from fish_def where id = got))
        || ', QL ' || to_char(made_ql, 'FM990.0') || '.'
        || case when bait is null then '' else ' Bait: '
             || lower((select coalesce(name, bait) from item_def where id = bait)) || '.' end, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You walk the net round and haul it in: '
      || array_to_string(parts, ', ') || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You walk the net round and haul it in: '
      || array_to_string(parts, ', ') || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_fish: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You walk the net round and haul it in: '
      || array_to_string(parts, ', ') || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Netted: '
      || array_to_string(parts, ', ') || '.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('fish_journal(uuid,uuid,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$return ' ' || v_deep || ' Nothing you could land runs here.';$tx6o$, ''))) / length($tx6o$return ' ' || v_deep || ' Nothing you could land runs here.';$tx6o$);
  if n <> 1 then raise exception 'fish_journal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return ' ' || v_deep || ' Nothing you could land runs here.';$tx6o$, $tx6n$return ' ' || v_deep || ' No fish here at your fishing skill.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$|| case when v_bait is null then 'With a bare hook'
            else 'With the ' || lower((select coalesce(d.name, v_bait) from item_def d where d.id = v_bait)) || ' you carry' end
    || ', the bites here are ' || list_of(v_shares) || ', and ' || floor(v_on * 100 + 0.5)::int || '% of them stay on.';$tx6o$, ''))) / length($tx6o$|| case when v_bait is null then 'With a bare hook'
            else 'With the ' || lower((select coalesce(d.name, v_bait) from item_def d where d.id = v_bait)) || ' you carry' end
    || ', the bites here are ' || list_of(v_shares) || ', and ' || floor(v_on * 100 + 0.5)::int || '% of them stay on.';$tx6o$);
  if n <> 1 then raise exception 'fish_journal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$|| case when v_bait is null then 'With a bare hook'
            else 'With the ' || lower((select coalesce(d.name, v_bait) from item_def d where d.id = v_bait)) || ' you carry' end
    || ', the bites here are ' || list_of(v_shares) || ', and ' || floor(v_on * 100 + 0.5)::int || '% of them stay on.';$tx6o$, $tx6n$|| 'Bites (' || case when v_bait is null then 'bare hook'
            else lower((select coalesce(d.name, v_bait) from item_def d where d.id = v_bait)) end
    || '): ' || array_to_string(v_shares, ', ') || '. Stay on: ' || floor(v_on * 100 + 0.5)::int || '%.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_steps(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'The treads rock on their bed however you set them. You take them up again.'$tx6o$, ''))) / length($tx6o$'The treads rock on their bed however you set them. You take them up again.'$tx6o$);
  if n <> 1 then raise exception 'perform_steps: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The treads rock on their bed however you set them. You take them up again.'$tx6o$, $tx6n$'Steps failed: materials kept.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The boards will not sit square on their bearers. You knock them loose again.'$tx6o$, ''))) / length($tx6o$'The boards will not sit square on their bearers. You knock them loose again.'$tx6o$);
  if n <> 1 then raise exception 'perform_steps: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The boards will not sit square on their bearers. You knock them loose again.'$tx6o$, $tx6n$'Steps failed: materials kept.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You lay a flight of ' || lower(steps_name(v_data)) || ' up the slope.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You lay a flight of ' || lower(steps_name(v_data)) || ' up the slope.', 'event');$tx6o$);
  if n <> 2 then raise exception 'perform_steps: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You lay a flight of ' || lower(steps_name(v_data)) || ' up the slope.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Laid: ' || lower(steps_name(v_data)) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You take up the ' || v_name || ' and keep ' || number_word(v_n)
        || ' planks whole. The ground under them is packed dirt.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You take up the ' || v_name || ' and keep ' || number_word(v_n)
        || ' planks whole. The ground under them is packed dirt.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_steps: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You take up the ' || v_name || ' and keep ' || number_word(v_n)
        || ' planks whole. The ground under them is packed dirt.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Removed: ' || v_name || '. Got ' || v_n
        || ' planks. Tile: packed dirt.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You take up the ' || v_name || ' and keep '
        || number_word(v_n) || ' ' || lower((select name from item_def where id = v_slab)) || case when v_n = 1 then '' else 's' end
        || ' and ' || number_word(v_m) || ' ' || lower((select name from item_def where id = steps_brick(v_slab))) || 's'
        || ' whole. The ground under them is packed dirt.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You take up the ' || v_name || ' and keep '
        || number_word(v_n) || ' ' || lower((select name from item_def where id = v_slab)) || case when v_n = 1 then '' else 's' end
        || ' and ' || number_word(v_m) || ' ' || lower((select name from item_def where id = steps_brick(v_slab))) || 's'
        || ' whole. The ground under them is packed dirt.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_steps: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You take up the ' || v_name || ' and keep '
        || number_word(v_n) || ' ' || lower((select name from item_def where id = v_slab)) || case when v_n = 1 then '' else 's' end
        || ' and ' || number_word(v_m) || ' ' || lower((select name from item_def where id = steps_brick(v_slab))) || 's'
        || ' whole. The ground under them is packed dirt.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Removed: ' || v_name || '. Got '
        || v_n || ' ' || lower((select name from item_def where id = v_slab)) || case when v_n = 1 then '' else 's' end
        || ' and ' || v_m || ' ' || lower((select name from item_def where id = steps_brick(v_slab))) || 's'
        || '. Tile: packed dirt.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('foundation_reason(uuid,uuid,integer,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$return 'This tile still has ' || v_soil || ' soil over rock on its corners. A foundation goes on bare rock, '
      || 'seam or ore: dig every corner down to the rock first.';$tx6o$, ''))) / length($tx6o$return 'This tile still has ' || v_soil || ' soil over rock on its corners. A foundation goes on bare rock, '
      || 'seam or ore: dig every corner down to the rock first.';$tx6o$);
  if n <> 1 then raise exception 'foundation_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'This tile still has ' || v_soil || ' soil over rock on its corners. A foundation goes on bare rock, '
      || 'seam or ore: dig every corner down to the rock first.';$tx6o$, $tx6n$return 'Soil left over rock: ' || v_soil || ' (all corners). '
      || 'Dig every corner down to rock first.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The settlement token stands there.'$tx6o$, ''))) / length($tx6o$'The settlement token stands there.'$tx6o$);
  if n <> 1 then raise exception 'foundation_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The settlement token stands there.'$tx6o$, $tx6n$'Settlement token there.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is already a foundation on that tile.'$tx6o$, ''))) / length($tx6o$'There is already a foundation on that tile.'$tx6o$);
  if n <> 1 then raise exception 'foundation_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is already a foundation on that tile.'$tx6o$, $tx6n$'Already a foundation.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That tile is already level. A foundation is for ground that is not.'$tx6o$, ''))) / length($tx6o$'That tile is already level. A foundation is for ground that is not.'$tx6o$);
  if n <> 1 then raise exception 'foundation_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That tile is already level. A foundation is for ground that is not.'$tx6o$, $tx6n$'Tile already level.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Clear away the things lying there first: the pour would bury them.'$tx6o$, ''))) / length($tx6o$'Clear away the things lying there first: the pour would bury them.'$tx6o$);
  if n <> 1 then raise exception 'foundation_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Clear away the things lying there first: the pour would bury them.'$tx6o$, $tx6n$'Items on the tile: clear them first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'A foundation fills a tile up, never down. Its high corner is at ' || v_high
      || '; sight a level at or above that.';$tx6o$, ''))) / length($tx6o$return 'A foundation fills a tile up, never down. Its high corner is at ' || v_high
      || '; sight a level at or above that.';$tx6o$);
  if n <> 1 then raise exception 'foundation_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'A foundation fills a tile up, never down. Its high corner is at ' || v_high
      || '; sight a level at or above that.';$tx6o$, $tx6n$return 'Foundations fill up only. High corner ' || v_high
      || ': set a level at or above it.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return v_name || ' is too close. A foundation wants a tile clear of any building or plan.';$tx6o$, ''))) / length($tx6o$return v_name || ' is too close. A foundation wants a tile clear of any building or plan.';$tx6o$);
  if n <> 1 then raise exception 'foundation_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return v_name || ' is too close. A foundation wants a tile clear of any building or plan.';$tx6o$, $tx6n$return v_name || ' too close: needs a tile clear of buildings and plans.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'A pour ' || v_lift || ' deep wants ' || to_char(v_want, 'FM990.0')
      || ' masonry and you have ' || to_char(v_have, 'FM990.0')
      || '. At your skill the deepest you can shutter is '$tx6o$, ''))) / length($tx6o$return 'A pour ' || v_lift || ' deep wants ' || to_char(v_want, 'FM990.0')
      || ' masonry and you have ' || to_char(v_have, 'FM990.0')
      || '. At your skill the deepest you can shutter is '$tx6o$);
  if n <> 1 then raise exception 'foundation_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'A pour ' || v_lift || ' deep wants ' || to_char(v_want, 'FM990.0')
      || ' masonry and you have ' || to_char(v_have, 'FM990.0')
      || '. At your skill the deepest you can shutter is '$tx6o$, $tx6n$return 'Pour ' || v_lift || ' deep needs masonry ' || to_char(v_want, 'FM990.0')
      || '; have ' || to_char(v_have, 'FM990.0')
      || '. Your max depth: '$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_foundation(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You shutter a foundation over the tile, to be poured level at ' || v_top
      || '. It wants ' || v_want || ' concrete. The ground around it will not move: the slab fills the hole instead.',$tx6o$, ''))) / length($tx6o$'You shutter a foundation over the tile, to be poured level at ' || v_top
      || '. It wants ' || v_want || ' concrete. The ground around it will not move: the slab fills the hole instead.',$tx6o$);
  if n <> 1 then raise exception 'perform_foundation: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You shutter a foundation over the tile, to be poured level at ' || v_top
      || '. It wants ' || v_want || ' concrete. The ground around it will not move: the slab fills the hole instead.',$tx6o$, $tx6n$'Foundation planned: top at ' || v_top
      || '. Needs ' || v_want || ' concrete. Surrounding ground is unchanged.',$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You break the middle out of the slab down to ' || (f.top - pool_depth()) || ', leaving a lip round it, and it holds water at '
      || (f.top - pool_lip()) || ': ' || to_char((pool_depth() - pool_lip()) / 10.0, 'FM990.0')
      || ' m deep. A pool beside it poured to the same top is the same pool; dig a spring in it and it spills over its lowest edge.',$tx6o$, ''))) / length($tx6o$'You break the middle out of the slab down to ' || (f.top - pool_depth()) || ', leaving a lip round it, and it holds water at '
      || (f.top - pool_lip()) || ': ' || to_char((pool_depth() - pool_lip()) / 10.0, 'FM990.0')
      || ' m deep. A pool beside it poured to the same top is the same pool; dig a spring in it and it spills over its lowest edge.',$tx6o$);
  if n <> 1 then raise exception 'perform_foundation: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You break the middle out of the slab down to ' || (f.top - pool_depth()) || ', leaving a lip round it, and it holds water at '
      || (f.top - pool_lip()) || ': ' || to_char((pool_depth() - pool_lip()) / 10.0, 'FM990.0')
      || ' m deep. A pool beside it poured to the same top is the same pool; dig a spring in it and it spills over its lowest edge.',$tx6o$, $tx6n$'Pool dug: floor at ' || (f.top - pool_depth()) || ', water at '
      || (f.top - pool_lip()) || ', ' || to_char((pool_depth() - pool_lip()) / 10.0, 'FM990.0')
      || ' m deep. Joins adjacent pools of the same top. A spring in it spills over its lowest edge.',$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You fill the pool in with ' || pool_fill() || ' concrete, level with the top of the slab at ' || f.top
      || '. A spring that rose in it stops.', 'event');$tx6o$, ''))) / length($tx6o$'You fill the pool in with ' || pool_fill() || ' concrete, level with the top of the slab at ' || f.top
      || '. A spring that rose in it stops.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_foundation: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You fill the pool in with ' || pool_fill() || ' concrete, level with the top of the slab at ' || f.top
      || '. A spring that rose in it stops.', 'event');$tx6o$, $tx6n$'Pool filled: ' || pool_fill() || ' concrete, top at ' || f.top
      || '. Any spring in it stops.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You strike the shuttering' ||
      case when v_back > 0 then ' and break out ' || v_back || ' barrowful'
                                 || case when v_back > 1 then 's' else '' end || ' of set concrete as shards'
           else '' end || '.', 'event');$tx6o$, ''))) / length($tx6o$'You strike the shuttering' ||
      case when v_back > 0 then ' and break out ' || v_back || ' barrowful'
                                 || case when v_back > 1 then 's' else '' end || ' of set concrete as shards'
           else '' end || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_foundation: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You strike the shuttering' ||
      case when v_back > 0 then ' and break out ' || v_back || ' barrowful'
                                 || case when v_back > 1 then 's' else '' end || ' of set concrete as shards'
           else '' end || '.', 'event');$tx6o$, $tx6n$'Shuttering struck.' ||
      case when v_back > 0 then ' Got ' || v_back || ' rock shards.'
           else '' end, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You work another barrowful into the shuttering. ' || v_left || ' to go.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You work another barrowful into the shuttering. ' || v_left || ' to go.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_foundation: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You work another barrowful into the shuttering. ' || v_left || ' to go.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Concrete poured. ' || v_left || ' to go.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The last of it goes in and the slab stands level at ' || f.top
    || '. You can build on it, pave it, or bring a bridge to it.', 'event');$tx6o$, ''))) / length($tx6o$'The last of it goes in and the slab stands level at ' || f.top
    || '. You can build on it, pave it, or bring a bridge to it.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_foundation: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The last of it goes in and the slab stands level at ' || f.top
    || '. You can build on it, pave it, or bring a bridge to it.', 'event');$tx6o$, $tx6n$'Foundation done: top at ' || f.top
    || '. Can be built on, paved or bridged to.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('path_pick_refusal(uuid,uuid,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'There is no such pick.'$tx6o$, ''))) / length($tx6o$'There is no such pick.'$tx6o$);
  if n <> 1 then raise exception 'path_pick_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no such pick.'$tx6o$, $tx6n$'No such pick.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('faith_spell_cast(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Nothing is written behind that spell yet.'$tx6o$, ''))) / length($tx6o$'Nothing is written behind that spell yet.'$tx6o$);
  if n <> 1 then raise exception 'faith_spell_cast: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing is written behind that spell yet.'$tx6o$, $tx6n$'Spell has no effect yet.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That is not here.'$tx6o$, ''))) / length($tx6o$'That is not here.'$tx6o$);
  if n <> 1 then raise exception 'faith_spell_cast: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is not here.'$tx6o$, $tx6n$'Target not here.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('path_technique_cast(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Nothing is written behind that spell yet.'$tx6o$, ''))) / length($tx6o$'Nothing is written behind that spell yet.'$tx6o$);
  if n <> 1 then raise exception 'path_technique_cast: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing is written behind that spell yet.'$tx6o$, $tx6n$'Spell has no effect yet.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('class_spell_cast(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Nothing is written behind that spell yet.'$tx6o$, ''))) / length($tx6o$'Nothing is written behind that spell yet.'$tx6o$);
  if n <> 1 then raise exception 'class_spell_cast: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing is written behind that spell yet.'$tx6o$, $tx6n$'Spell has no effect yet.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That is not here.'$tx6o$, ''))) / length($tx6o$'That is not here.'$tx6o$);
  if n <> 1 then raise exception 'class_spell_cast: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is not here.'$tx6o$, $tx6n$'Target not here.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('pier_site_refusal(uuid,uuid,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'A bridge lands on this tile. Take the bridge down first.'$tx6o$, ''))) / length($tx6o$'A bridge lands on this tile. Take the bridge down first.'$tx6o$);
  if n <> 1 then raise exception 'pier_site_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A bridge lands on this tile. Take the bridge down first.'$tx6o$, $tx6n$'Bridge end on this tile: remove the bridge first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Move what stands on the tile first.'$tx6o$, ''))) / length($tx6o$'Move what stands on the tile first.'$tx6o$);
  if n <> 1 then raise exception 'pier_site_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Move what stands on the tile first.'$tx6o$, $tx6n$'Something placed on the tile: move it first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Somebody is standing on that tile.'$tx6o$, ''))) / length($tx6o$'Somebody is standing on that tile.'$tx6o$);
  if n <> 1 then raise exception 'pier_site_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Somebody is standing on that tile.'$tx6o$, $tx6n$'Someone is on that tile.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('journal_made(uuid,uuid,text,double precision,integer,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The first ' || v_name
      || ' you have ever made. (Ledger, J)', 'skill');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The first ' || v_name
      || ' you have ever made. (Ledger, J)', 'skill');$tx6o$);
  if n <> 1 then raise exception 'journal_made: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The first ' || v_name
      || ' you have ever made. (Ledger, J)', 'skill');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'First ' || v_name
      || ' made. (Journal: Ledger tab, J)', 'skill');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The best ' || v_name || ' you have made: QL '
      || to_char(p_ql, 'FM990.0') || ', over ' || to_char(was, 'FM990.0') || '.', 'skill');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The best ' || v_name || ' you have made: QL '
      || to_char(p_ql, 'FM990.0') || ', over ' || to_char(was, 'FM990.0') || '.', 'skill');$tx6o$);
  if n <> 1 then raise exception 'journal_made: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The best ' || v_name || ' you have made: QL '
      || to_char(p_ql, 'FM990.0') || ', over ' || to_char(was, 'FM990.0') || '.', 'skill');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Best ' || v_name || ' made: QL '
      || to_char(p_ql, 'FM990.0') || ', was ' || to_char(was, 'FM990.0') || '.', 'skill');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('body_settle(uuid,uuid)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'The rest goes out of you. Skills go in at their ordinary pace again.'$tx6o$, ''))) / length($tx6o$'The rest goes out of you. Skills go in at their ordinary pace again.'$tx6o$);
  if n <> 1 then raise exception 'body_settle: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The rest goes out of you. Skills go in at their ordinary pace again.'$tx6o$, $tx6n$'Rested ended: normal skill gain.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You are exhausted and swallowing water. Get to shore!'$tx6o$, ''))) / length($tx6o$'You are exhausted and swallowing water. Get to shore!'$tx6o$);
  if n <> 1 then raise exception 'body_settle: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You are exhausted and swallowing water. Get to shore!'$tx6o$, $tx6n$'Drowning: no stamina. Get to shore.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('body_refusal(uuid,uuid,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You are too exhausted to do that. Rest a moment.'$tx6o$, ''))) / length($tx6o$'You are too exhausted to do that. Rest a moment.'$tx6o$);
  if n <> 1 then raise exception 'body_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You are too exhausted to do that. Rest a moment.'$tx6o$, $tx6n$'Too exhausted. Rest.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('fight_back(uuid,uuid,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You turn on the ' || coalesce(v_species, 'thing') || '.', 'fight');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You turn on the ' || coalesce(v_species, 'thing') || '.', 'fight');$tx6o$);
  if n <> 1 then raise exception 'fight_back: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You turn on the ' || coalesce(v_species, 'thing') || '.', 'fight');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Fighting back: ' || coalesce(v_species, 'thing') || '.', 'fight');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('skill_said(uuid,uuid,text,double precision)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$|| ' is now ' || floor(now_at)::int || '.'$tx6o$, ''))) / length($tx6o$|| ' is now ' || floor(now_at)::int || '.'$tx6o$);
  if n <> 1 then raise exception 'skill_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$|| ' is now ' || floor(now_at)::int || '.'$tx6o$, $tx6n$|| ': ' || floor(now_at)::int || '.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then ' You can keep ' || queue_capacity(now_at) || ' jobs in your head.'$tx6o$, ''))) / length($tx6o$then ' You can keep ' || queue_capacity(now_at) || ' jobs in your head.'$tx6o$);
  if n <> 1 then raise exception 'skill_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then ' You can keep ' || queue_capacity(now_at) || ' jobs in your head.'$tx6o$, $tx6n$then ' Job queue: ' || queue_capacity(now_at) || '.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$|| ' increased by '
    || to_char(p_gained, case when p_gained < 0.0001 then 'FM0.000000' else 'FM0.0000' end)
    || ' to ' || to_char(now_at, 'FM990.0000') || '.', 'skill');$tx6o$, ''))) / length($tx6o$|| ' increased by '
    || to_char(p_gained, case when p_gained < 0.0001 then 'FM0.000000' else 'FM0.0000' end)
    || ' to ' || to_char(now_at, 'FM990.0000') || '.', 'skill');$tx6o$);
  if n <> 1 then raise exception 'skill_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$|| ' increased by '
    || to_char(p_gained, case when p_gained < 0.0001 then 'FM0.000000' else 'FM0.0000' end)
    || ' to ' || to_char(now_at, 'FM990.0000') || '.', 'skill');$tx6o$, $tx6n$|| ' ' || to_char(now_at, 'FM990.0000')
    || ' (+' || to_char(p_gained, case when p_gained < 0.0001 then 'FM0.000000' else 'FM0.0000' end)
    || ').', 'skill');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('settle(uuid,uuid)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You start ' || d.verb || '.', 'info');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You start ' || d.verb || '.', 'info');$tx6o$);
  if n <> 1 then raise exception 'settle: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You start ' || d.verb || '.', 'info');$tx6o$, $tx6n$perform tell(p_world, p_uid, upper(left(d.verb, 1)) || substr(d.verb, 2) || '.', 'info');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$coalesce(act_refusal(p_world, p_uid, p.act, p.act_target) || ' That was '
                     || (coalesce(p.act_left, 1)) || ' to go.',
                     'You stop ' || d.verb || '.'), 'info');$tx6o$, ''))) / length($tx6o$coalesce(act_refusal(p_world, p_uid, p.act, p.act_target) || ' That was '
                     || (coalesce(p.act_left, 1)) || ' to go.',
                     'You stop ' || d.verb || '.'), 'info');$tx6o$);
  if n <> 1 then raise exception 'settle: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$coalesce(act_refusal(p_world, p_uid, p.act, p.act_target) || ' That was '
                     || (coalesce(p.act_left, 1)) || ' to go.',
                     'You stop ' || d.verb || '.'), 'info');$tx6o$, $tx6n$coalesce(act_refusal(p_world, p_uid, p.act, p.act_target) || ' Left: '
                     || (coalesce(p.act_left, 1)) || '.',
                     'Stopped ' || d.verb || '.'), 'info');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('rpc_act(uuid,text,jsonb,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, me, 'You start ' || d.verb || '.', 'info');$tx6o$, ''))) / length($tx6o$perform tell(p_world, me, 'You start ' || d.verb || '.', 'info');$tx6o$);
  if n <> 1 then raise exception 'rpc_act: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, me, 'You start ' || d.verb || '.', 'info');$tx6o$, $tx6n$perform tell(p_world, me, upper(left(d.verb, 1)) || substr(d.verb, 2) || '.', 'info');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, me, d.label || ' is next, ' || jsonb_array_length(p.act_queue) + 1 || ' of ' || cap || ' in hand.', 'info');$tx6o$, ''))) / length($tx6o$perform tell(p_world, me, d.label || ' is next, ' || jsonb_array_length(p.act_queue) + 1 || ' of ' || cap || ' in hand.', 'info');$tx6o$);
  if n <> 1 then raise exception 'rpc_act: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, me, d.label || ' is next, ' || jsonb_array_length(p.act_queue) + 1 || ' of ' || cap || ' in hand.', 'info');$tx6o$, $tx6n$perform tell(p_world, me, 'Queued: ' || d.label || ' (' || jsonb_array_length(p.act_queue) + 1 || '/' || cap || ').', 'info');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$why := 'You can only keep ' || cap || ' jobs in your head at once. Mind logic is what widens that.';$tx6o$, ''))) / length($tx6o$why := 'You can only keep ' || cap || ' jobs in your head at once. Mind logic is what widens that.';$tx6o$);
  if n <> 1 then raise exception 'rpc_act: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$why := 'You can only keep ' || cap || ' jobs in your head at once. Mind logic is what widens that.';$tx6o$, $tx6n$why := 'Job queue full: ' || cap || '. Mind logic raises it.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('settle_fault(uuid,uuid,text,text,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You stop ' || coalesce(v_verb, 'working')
      || '. The island failed to finish it: "' || p_error || '". What had come due of it is undone,'
      || ' and anything queued after it is cleared.', 'error');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You stop ' || coalesce(v_verb, 'working')
      || '. The island failed to finish it: "' || p_error || '". What had come due of it is undone,'
      || ' and anything queued after it is cleared.', 'error');$tx6o$);
  if n <> 1 then raise exception 'settle_fault: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You stop ' || coalesce(v_verb, 'working')
      || '. The island failed to finish it: "' || p_error || '". What had come due of it is undone,'
      || ' and anything queued after it is cleared.', 'error');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Stopped ' || coalesce(v_verb, 'working')
      || '. Island error: "' || p_error || '". Its due goes undone,'
      || ' queue cleared.', 'error');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The island failed to bring you up to date: "' || p_error || '".', 'error');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The island failed to bring you up to date: "' || p_error || '".', 'error');$tx6o$);
  if n <> 1 then raise exception 'settle_fault: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The island failed to bring you up to date: "' || p_error || '".', 'error');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Island error while catching up: "' || p_error || '".', 'error');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('sleep_until_morning(uuid,uuid,double precision,text,double precision)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You sleep in the ' || p_what || ' and wake at '
    || world_clock(p_world) || ', rested.'$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You sleep in the ' || p_what || ' and wake at '
    || world_clock(p_world) || ', rested.'$tx6o$);
  if n <> 1 then raise exception 'sleep_until_morning: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You sleep in the ' || p_what || ' and wake at '
    || world_clock(p_world) || ', rested.'$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Slept in the ' || p_what || ': woke at '
    || world_clock(p_world) || '.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then ' You have ' || clock_left(banked) || ' of rest in you; while it burns, '
            || 'everything teaches you twice as much.'$tx6o$, ''))) / length($tx6o$then ' You have ' || clock_left(banked) || ' of rest in you; while it burns, '
            || 'everything teaches you twice as much.'$tx6o$);
  if n <> 1 then raise exception 'sleep_until_morning: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then ' You have ' || clock_left(banked) || ' of rest in you; while it burns, '
            || 'everything teaches you twice as much.'$tx6o$, $tx6n$then ' Rested: ' || clock_left(banked) || ', skill gain ×'
            || rest_mult()::int || '.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('earn_knacks(uuid,uuid,text,double precision)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You have a knack for '
    || lower((select name from skill_def where id = v_id)) || ' now. It goes in '
    || round(knack_bonus(had + 1) * 100) || '% faster.', 'skill');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You have a knack for '
    || lower((select name from skill_def where id = v_id)) || ' now. It goes in '
    || round(knack_bonus(had + 1) * 100) || '% faster.', 'skill');$tx6o$);
  if n <> 1 then raise exception 'earn_knacks: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You have a knack for '
    || lower((select name from skill_def where id = v_id)) || ' now. It goes in '
    || round(knack_bonus(had + 1) * 100) || '% faster.', 'skill');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Knack: '
    || lower((select name from skill_def where id = v_id)) || ', skill gain +'
    || round(knack_bonus(had + 1) * 100) || '%.', 'skill');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('earn_titles(uuid,uuid,text,double precision,double precision)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'They will call you ' || t.name
      || ' for that. (Skills, to wear it)', 'skill');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'They will call you ' || t.name
      || ' for that. (Skills, to wear it)', 'skill');$tx6o$);
  if n <> 1 then raise exception 'earn_titles: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'They will call you ' || t.name
      || ' for that. (Skills, to wear it)', 'skill');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Title earned: ' || t.name
      || '. (Skills window to wear it)', 'skill');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('nourish(uuid,uuid,text,double precision,double precision)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$return 'You could not eat another thing. Everything you do goes in '
      || whole_pct(greatest(table_best(), pk(p_world, p_uid, 'table:best', table_best()))) || ' faster while it lasts.';$tx6o$, ''))) / length($tx6o$return 'You could not eat another thing. Everything you do goes in '
      || whole_pct(greatest(table_best(), pk(p_world, p_uid, 'table:best', table_best()))) || ' faster while it lasts.';$tx6o$);
  if n <> 1 then raise exception 'nourish: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You could not eat another thing. Everything you do goes in '
      || whole_pct(greatest(table_best(), pk(p_world, p_uid, 'table:best', table_best()))) || ' faster while it lasts.';$tx6o$, $tx6n$return 'All nutrients full: skill gain +'
      || whole_pct(greatest(table_best(), pk(p_world, p_uid, 'table:best', table_best()))) || ' while it lasts.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'That is as much ' || array_to_string(v_filled, ' and ') || ' as you can hold.';$tx6o$, ''))) / length($tx6o$return 'That is as much ' || array_to_string(v_filled, ' and ') || ' as you can hold.';$tx6o$);
  if n <> 1 then raise exception 'nourish: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'That is as much ' || array_to_string(v_filled, ' and ') || ' as you can hold.';$tx6o$, $tx6n$return 'Full: ' || array_to_string(v_filled, ' and ') || '.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('pool_reason(uuid,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Dig a pool in a poured foundation.'$tx6o$, ''))) / length($tx6o$'Dig a pool in a poured foundation.'$tx6o$);
  if n <> 1 then raise exception 'pool_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Dig a pool in a poured foundation.'$tx6o$, $tx6n$'Needs a poured foundation.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is a pool here already.'$tx6o$, ''))) / length($tx6o$'There is a pool here already.'$tx6o$);
  if n <> 1 then raise exception 'pool_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is a pool here already.'$tx6o$, $tx6n$'Already a pool.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The settlement token stands there.'$tx6o$, ''))) / length($tx6o$'The settlement token stands there.'$tx6o$);
  if n <> 1 then raise exception 'pool_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The settlement token stands there.'$tx6o$, $tx6n$'Settlement token there.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Clear away the things lying there first: they would go into the water.'$tx6o$, ''))) / length($tx6o$'Clear away the things lying there first: they would go into the water.'$tx6o$);
  if n <> 1 then raise exception 'pool_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Clear away the things lying there first: they would go into the water.'$tx6o$, $tx6n$'Items on the tile: clear them first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Move what stands on the slab first: it would go into the water.'$tx6o$, ''))) / length($tx6o$'Move what stands on the slab first: it would go into the water.'$tx6o$);
  if n <> 1 then raise exception 'pool_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Move what stands on the slab first: it would go into the water.'$tx6o$, $tx6n$'Something placed on the slab: move it first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$if v_name is not null then return v_name || ' stands on it.'; end if;$tx6o$, ''))) / length($tx6o$if v_name is not null then return v_name || ' stands on it.'; end if;$tx6o$);
  if n <> 1 then raise exception 'pool_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$if v_name is not null then return v_name || ' stands on it.'; end if;$tx6o$, $tx6n$if v_name is not null then return v_name || ' is on it.'; end if;$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('trap_place_reason(uuid,uuid,text,integer,integer,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'A creel goes in the water. Set it off a bank with some depth to it.'$tx6o$, ''))) / length($tx6o$'A creel goes in the water. Set it off a bank with some depth to it.'$tx6o$);
  if n <> 1 then raise exception 'trap_place_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A creel goes in the water. Set it off a bank with some depth to it.'$tx6o$, $tx6n$'Creel needs water 1 deep or more.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Too far out. Set it within reach of where you stand.'$tx6o$, ''))) / length($tx6o$'Too far out. Set it within reach of where you stand.'$tx6o$);
  if n <> 1 then raise exception 'trap_place_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Too far out. Set it within reach of where you stand.'$tx6o$, $tx6n$'Too far: within 3.6 tiles.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Nothing wild comes inside your own borders. Set it out in the country.'$tx6o$, ''))) / length($tx6o$'Nothing wild comes inside your own borders. Set it out in the country.'$tx6o$);
  if n <> 1 then raise exception 'trap_place_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing wild comes inside your own borders. Set it out in the country.'$tx6o$, $tx6n$'Not on your deed: wild creatures do not enter it.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A trap needs dry ground it can be covered on.'$tx6o$, ''))) / length($tx6o$'A trap needs dry ground it can be covered on.'$tx6o$);
  if n <> 1 then raise exception 'trap_place_reason: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A trap needs dry ground it can be covered on.'$tx6o$, $tx6n$'Trap needs dry, open ground.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('trap_settle(bigint)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform spring_trap(p_id, 'The ' || lower(trap_name(p))
        || ' rots through and whatever was in it walks away.');$tx6o$, ''))) / length($tx6o$perform spring_trap(p_id, 'The ' || lower(trap_name(p))
        || ' rots through and whatever was in it walks away.');$tx6o$);
  if n <> 1 then raise exception 'trap_settle: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform spring_trap(p_id, 'The ' || lower(trap_name(p))
        || ' rots through and whatever was in it walks away.');$tx6o$, $tx6n$perform spring_trap(p_id, trap_name(p)
        || ' rotted: catch escaped.');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p.world_id, p.made_by, 'A ' || lower(trap_name(p))
        || ' has rotted through out in the country.', 'system');$tx6o$, ''))) / length($tx6o$perform tell(p.world_id, p.made_by, 'A ' || lower(trap_name(p))
        || ' has rotted through out in the country.', 'system');$tx6o$);
  if n <> 1 then raise exception 'trap_settle: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p.world_id, p.made_by, 'A ' || lower(trap_name(p))
        || ' has rotted through out in the country.', 'system');$tx6o$, $tx6n$perform tell(p.world_id, p.made_by, 'Rotted away: ' || lower(trap_name(p))
        || '.', 'system');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p.world_id, p.made_by, 'The bait is gone out of a creel. '
            || 'It will take nothing more until it is baited again.', 'system');$tx6o$, ''))) / length($tx6o$perform tell(p.world_id, p.made_by, 'The bait is gone out of a creel. '
            || 'It will take nothing more until it is baited again.', 'system');$tx6o$);
  if n <> 1 then raise exception 'trap_settle: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p.world_id, p.made_by, 'The bait is gone out of a creel. '
            || 'It will take nothing more until it is baited again.', 'system');$tx6o$, $tx6n$perform tell(p.world_id, p.made_by, 'Creel bait used up: '
            || 'rebait to catch.', 'system');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p.world_id, p.made_by, 'Something took the bait out of your '
            || lower(trap_name(p)) || ' and was gone. It was too much trap for.', 'system');$tx6o$, ''))) / length($tx6o$perform tell(p.world_id, p.made_by, 'Something took the bait out of your '
            || lower(trap_name(p)) || ' and was gone. It was too much trap for.', 'system');$tx6o$);
  if n <> 1 then raise exception 'trap_settle: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p.world_id, p.made_by, 'Something took the bait out of your '
            || lower(trap_name(p)) || ' and was gone. It was too much trap for.', 'system');$tx6o$, $tx6n$perform tell(p.world_id, p.made_by, ''
            || trap_name(p) || ': bait taken, catch too big for it.', 'system');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p.world_id, p.made_by, 'Your ' || lower(trap_name(p))
      || ' has sprung. There is a ' || lower(s.name) || ' in it.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p.world_id, p.made_by, 'Your ' || lower(trap_name(p))
      || ' has sprung. There is a ' || lower(s.name) || ' in it.', 'event');$tx6o$);
  if n <> 1 then raise exception 'trap_settle: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p.world_id, p.made_by, 'Your ' || lower(trap_name(p))
      || ' has sprung. There is a ' || lower(s.name) || ' in it.', 'event');$tx6o$, $tx6n$perform tell(p.world_id, p.made_by, trap_name(p)
      || ' sprung: ' || lower(s.name) || ' caught.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('cart_full(uuid,uuid,placed)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The ' || lower(placed_name(p_cart))
    || ' is full. What does not fit goes in your pack.', 'error');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The ' || lower(placed_name(p_cart))
    || ' is full. What does not fit goes in your pack.', 'error');$tx6o$);
  if n <> 1 then raise exception 'cart_full: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The ' || lower(placed_name(p_cart))
    || ' is full. What does not fit goes in your pack.', 'error');$tx6o$, $tx6n$perform tell(p_world, p_uid, placed_name(p_cart)
    || ' full: the rest goes to your pack.', 'error');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('read_ground(uuid,integer,integer,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, c.keeper, c.name || ' scratches at the ground and stands over '
    || (select string_agg(distinct nm, ' and ') from unnest(v_names) nm) || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, c.keeper, c.name || ' scratches at the ground and stands over '
    || (select string_agg(distinct nm, ' and ') from unnest(v_names) nm) || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'read_ground: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, c.keeper, c.name || ' scratches at the ground and stands over '
    || (select string_agg(distinct nm, ' and ') from unnest(v_names) nm) || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, c.keeper, c.name || ' found ore: '
    || (select string_agg(distinct nm, ', ') from unnest(v_names) nm) || '.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('gate_plan_refusal(uuid,uuid,text,text,integer,boolean)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'A hidden door is planned with Plan wall, then Hidden door.'$tx6o$, ''))) / length($tx6o$'A hidden door is planned with Plan wall, then Hidden door.'$tx6o$);
  if n <> 1 then raise exception 'gate_plan_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A hidden door is planned with Plan wall, then Hidden door.'$tx6o$, $tx6n$'Plan a hidden door via Plan wall, then Hidden door.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'A ' || lower(wt.name) || ' is laid in stone or brick, with a trowel.';$tx6o$, ''))) / length($tx6o$return 'A ' || lower(wt.name) || ' is laid in stone or brick, with a trowel.';$tx6o$);
  if n <> 1 then raise exception 'gate_plan_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'A ' || lower(wt.name) || ' is laid in stone or brick, with a trowel.';$tx6o$, $tx6n$return wt.name || ': stone or brick only, with a trowel.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'A ' || lower(wt.name) || ' stands in a wall on the ground floor.' || case when p_out then '' else ' Work on storey 1 to plan one.' end;$tx6o$, ''))) / length($tx6o$return 'A ' || lower(wt.name) || ' stands in a wall on the ground floor.' || case when p_out then '' else ' Work on storey 1 to plan one.' end;$tx6o$);
  if n <> 1 then raise exception 'gate_plan_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'A ' || lower(wt.name) || ' stands in a wall on the ground floor.' || case when p_out then '' else ' Work on storey 1 to plan one.' end;$tx6o$, $tx6n$return wt.name || ': ground floor only.' || case when p_out then '' else ' Switch to storey 1.' end;$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('hidden_door_wants(uuid,uuid)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'A hidden door takes a padlock when it is planned. Forge one at a smelter.'$tx6o$, ''))) / length($tx6o$'A hidden door takes a padlock when it is planned. Forge one at a smelter.'$tx6o$);
  if n <> 1 then raise exception 'hidden_door_wants: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A hidden door takes a padlock when it is planned. Forge one at a smelter.'$tx6o$, $tx6n$'Hidden door needs a padlock (cast at a smelter).'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then 'A hidden door takes ' || number_word(hidden_door_hinges()) || ' hinges when it is planned.'$tx6o$, ''))) / length($tx6o$then 'A hidden door takes ' || number_word(hidden_door_hinges()) || ' hinges when it is planned.'$tx6o$);
  if n <> 1 then raise exception 'hidden_door_wants: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then 'A hidden door takes ' || number_word(hidden_door_hinges()) || ' hinges when it is planned.'$tx6o$, $tx6n$then 'Hidden door needs ' || hidden_door_hinges() || ' hinges.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('hidden_door_said(boolean,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$' and to you, on your own land'$tx6o$, ''))) / length($tx6o$' and to you, on your own land'$tx6o$);
  if n <> 1 then raise exception 'hidden_door_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$' and to you, on your own land'$tx6o$, $tx6n$' and you (your land)'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$select 'You set a padlock and ' || number_word(hidden_door_hinges())
      || ' hinges in it and cut its key. It is a door to whoever holds that key'$tx6o$, ''))) / length($tx6o$select 'You set a padlock and ' || number_word(hidden_door_hinges())
      || ' hinges in it and cut its key. It is a door to whoever holds that key'$tx6o$);
  if n <> 1 then raise exception 'hidden_door_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select 'You set a padlock and ' || number_word(hidden_door_hinges())
      || ' hinges in it and cut its key. It is a door to whoever holds that key'$tx6o$, $tx6n$select 'Hidden door: padlock and ' || hidden_door_hinges()
      || ' hinges fitted, key cut. Opens for the key holder'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$when p_deed is not null then ' and to the founder of ' || p_deed else '' end
      || ', and a solid wall to everybody else.'$tx6o$, ''))) / length($tx6o$when p_deed is not null then ' and to the founder of ' || p_deed else '' end
      || ', and a solid wall to everybody else.'$tx6o$);
  if n <> 1 then raise exception 'hidden_door_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$when p_deed is not null then ' and to the founder of ' || p_deed else '' end
      || ', and a solid wall to everybody else.'$tx6o$, $tx6n$when p_deed is not null then ' and the founder of ' || p_deed else '' end
      || '; solid wall to everyone else.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('bridge_end_refusal(uuid,uuid,text,integer,integer,integer,integer,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'A bridge starts and ends on open ground, on a finished deck or on an upper storey, not inside on a ground floor.'$tx6o$, ''))) / length($tx6o$'A bridge starts and ends on open ground, on a finished deck or on an upper storey, not inside on a ground floor.'$tx6o$);
  if n <> 1 then raise exception 'bridge_end_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A bridge starts and ends on open ground, on a finished deck or on an upper storey, not inside on a ground floor.'$tx6o$, $tx6n$'Bridge ends: open ground, a finished deck or an upper storey; not inside on a ground floor.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then 'A ' || lower(d.name) || '''s winch stands outside, on open ground.'$tx6o$, ''))) / length($tx6o$then 'A ' || lower(d.name) || '''s winch stands outside, on open ground.'$tx6o$);
  if n <> 1 then raise exception 'bridge_end_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then 'A ' || lower(d.name) || '''s winch stands outside, on open ground.'$tx6o$, $tx6n$then d.name || ' winch: open ground only, not inside.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$else 'A ' || lower(d.name) || ' comes down outside, on open ground.' end;$tx6o$, ''))) / length($tx6o$else 'A ' || lower(d.name) || ' comes down outside, on open ground.' end;$tx6o$);
  if n <> 1 then raise exception 'bridge_end_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$else 'A ' || lower(d.name) || ' comes down outside, on open ground.' end;$tx6o$, $tx6n$else d.name || ' lands on open ground only, not inside.' end;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'A ' || lower(d.name) || '''s winch is not set under a jetty: its gallows rise over it.';$tx6o$, ''))) / length($tx6o$return 'A ' || lower(d.name) || '''s winch is not set under a jetty: its gallows rise over it.';$tx6o$);
  if n <> 1 then raise exception 'bridge_end_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'A ' || lower(d.name) || '''s winch is not set under a jetty: its gallows rise over it.';$tx6o$, $tx6n$return d.name || ' winch: not under a jetty.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return upper(left(an(v_what), 1)) || substr(an(v_what), 2)
          || ' stands across one end of it. A bridge goes out through a doorway, an archway or an open side.';$tx6o$, ''))) / length($tx6o$return upper(left(an(v_what), 1)) || substr(an(v_what), 2)
          || ' stands across one end of it. A bridge goes out through a doorway, an archway or an open side.';$tx6o$);
  if n <> 1 then raise exception 'bridge_end_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return upper(left(an(v_what), 1)) || substr(an(v_what), 2)
          || ' stands across one end of it. A bridge goes out through a doorway, an archway or an open side.';$tx6o$, $tx6n$return upper(left(v_what, 1)) || substr(v_what, 2)
          || ' across one end. Bridges exit through a doorway, archway or open side.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('gate_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'There is no portcullis there.'$tx6o$, ''))) / length($tx6o$'There is no portcullis there.'$tx6o$);
  if n <> 2 then raise exception 'gate_refusal: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'There is no portcullis there.'$tx6o$, $tx6n$'No portcullis there.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The portcullis is up already.'$tx6o$, ''))) / length($tx6o$'The portcullis is up already.'$tx6o$);
  if n <> 1 then raise exception 'gate_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The portcullis is up already.'$tx6o$, $tx6n$'Portcullis already up.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The portcullis is down already.'$tx6o$, ''))) / length($tx6o$'The portcullis is down already.'$tx6o$);
  if n <> 1 then raise exception 'gate_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The portcullis is down already.'$tx6o$, $tx6n$'Portcullis already down.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That is not a drawbridge.'$tx6o$, ''))) / length($tx6o$'That is not a drawbridge.'$tx6o$);
  if n <> 1 then raise exception 'gate_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is not a drawbridge.'$tx6o$, $tx6n$'Not a drawbridge.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Deck every span of the drawbridge first.'$tx6o$, ''))) / length($tx6o$'Deck every span of the drawbridge first.'$tx6o$);
  if n <> 1 then raise exception 'gate_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Deck every span of the drawbridge first.'$tx6o$, $tx6n$'Finish every span first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The drawbridge is up already.'$tx6o$, ''))) / length($tx6o$'The drawbridge is up already.'$tx6o$);
  if n <> 1 then raise exception 'gate_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The drawbridge is up already.'$tx6o$, $tx6n$'Drawbridge already up.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The drawbridge is down already.'$tx6o$, ''))) / length($tx6o$'The drawbridge is down already.'$tx6o$);
  if n <> 1 then raise exception 'gate_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The drawbridge is down already.'$tx6o$, $tx6n$'Drawbridge already down.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('gate_said(text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You winch the portcullis up. People, carts and beasts pass under it.'$tx6o$, ''))) / length($tx6o$'You winch the portcullis up. People, carts and beasts pass under it.'$tx6o$);
  if n <> 1 then raise exception 'gate_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You winch the portcullis up. People, carts and beasts pass under it.'$tx6o$, $tx6n$'Portcullis raised: all pass.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You let the portcullis down. Nothing passes it until it is raised; it is still seen through.'$tx6o$, ''))) / length($tx6o$'You let the portcullis down. Nothing passes it until it is raised; it is still seen through.'$tx6o$);
  if n <> 1 then raise exception 'gate_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You let the portcullis down. Nothing passes it until it is raised; it is still seen through.'$tx6o$, $tx6n$'Portcullis lowered: nothing passes; still see-through.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You winch the drawbridge up. Nothing crosses it until it is let down.'$tx6o$, ''))) / length($tx6o$'You winch the drawbridge up. Nothing crosses it until it is let down.'$tx6o$);
  if n <> 1 then raise exception 'gate_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You winch the drawbridge up. Nothing crosses it until it is let down.'$tx6o$, $tx6n$'Drawbridge raised: nothing crosses.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$else 'You let the drawbridge down. It carries people and beasts'
      || case when (select d.carts from bridge_def d where d.id = 'draw') then ', and carts' else '' end || '.'$tx6o$, ''))) / length($tx6o$else 'You let the drawbridge down. It carries people and beasts'
      || case when (select d.carts from bridge_def d where d.id = 'draw') then ', and carts' else '' end || '.'$tx6o$);
  if n <> 1 then raise exception 'gate_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$else 'You let the drawbridge down. It carries people and beasts'
      || case when (select d.carts from bridge_def d where d.id = 'draw') then ', and carts' else '' end || '.'$tx6o$, $tx6n$else 'Drawbridge lowered: people and beasts'
      || case when (select d.carts from bridge_def d where d.id = 'draw') then ' and carts' else '' end || ' cross.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('plan_line(text,text,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$then 'You plan ' || an(lower(wt.name)) || ' ' || lower(m.name) || ' wall on the ' || side_name(p_side) || ' side.'$tx6o$, ''))) / length($tx6o$then 'You plan ' || an(lower(wt.name)) || ' ' || lower(m.name) || ' wall on the ' || side_name(p_side) || ' side.'$tx6o$);
  if n <> 1 then raise exception 'plan_line: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then 'You plan ' || an(lower(wt.name)) || ' ' || lower(m.name) || ' wall on the ' || side_name(p_side) || ' side.'$tx6o$, $tx6n$then 'Planned: ' || lower(wt.name) || ' ' || lower(m.name) || ' wall, ' || side_name(p_side) || ' side.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then 'You plan ' || an(lower(m.name)) || ' railing on the ' || side_name(p_side) || ' side.'$tx6o$, ''))) / length($tx6o$then 'You plan ' || an(lower(m.name)) || ' railing on the ' || side_name(p_side) || ' side.'$tx6o$);
  if n <> 1 then raise exception 'plan_line: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then 'You plan ' || an(lower(m.name)) || ' railing on the ' || side_name(p_side) || ' side.'$tx6o$, $tx6n$then 'Planned: ' || lower(m.name) || ' railing, ' || side_name(p_side) || ' side.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$else 'You plan ' || an(lower(wt.name)) || ' in ' || lower(m.name) || ' on the ' || side_name(p_side) || ' side.' end$tx6o$, ''))) / length($tx6o$else 'You plan ' || an(lower(wt.name)) || ' in ' || lower(m.name) || ' on the ' || side_name(p_side) || ' side.' end$tx6o$);
  if n <> 1 then raise exception 'plan_line: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$else 'You plan ' || an(lower(wt.name)) || ' in ' || lower(m.name) || ' on the ' || side_name(p_side) || ' side.' end$tx6o$, $tx6n$else 'Planned: ' || lower(wt.name) || ', ' || lower(m.name) || ', ' || side_name(p_side) || ' side.' end$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('hidden_door_short()'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$select 'A padlock and ' || number_word(hidden_door_hinges())
      || ' hinges were no longer in your pack, so it is a solid wall.'$tx6o$, ''))) / length($tx6o$select 'A padlock and ' || number_word(hidden_door_hinges())
      || ' hinges were no longer in your pack, so it is a solid wall.'$tx6o$);
  if n <> 1 then raise exception 'hidden_door_short: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select 'A padlock and ' || number_word(hidden_door_hinges())
      || ' hinges were no longer in your pack, so it is a solid wall.'$tx6o$, $tx6n$select 'No padlock and ' || hidden_door_hinges()
      || ' hinges in pack: solid wall.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('green_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'There is no finished wall of stone or brick there.'$tx6o$, ''))) / length($tx6o$'There is no finished wall of stone or brick there.'$tx6o$);
  if n <> 1 then raise exception 'green_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no finished wall of stone or brick there.'$tx6o$, $tx6n$'No finished stone or brick wall there.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no paving or poured foundation here.'$tx6o$, ''))) / length($tx6o$'There is no paving or poured foundation here.'$tx6o$);
  if n <> 1 then raise exception 'green_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no paving or poured foundation here.'$tx6o$, $tx6n$'No paving or poured foundation here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You need a ' || lower((select coalesce(i.name, d.tool) from item_def i where i.id = d.tool))
        || ' to ' || lower(d.label) || '.';$tx6o$, ''))) / length($tx6o$return 'You need a ' || lower((select coalesce(i.name, d.tool) from item_def i where i.id = d.tool))
        || ' to ' || lower(d.label) || '.';$tx6o$);
  if n <> 1 then raise exception 'green_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You need a ' || lower((select coalesce(i.name, d.tool) from item_def i where i.id = d.tool))
        || ' to ' || lower(d.label) || '.';$tx6o$, $tx6n$return 'Need a ' || lower((select coalesce(i.name, d.tool) from item_def i where i.id = d.tool))
        || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return coalesce(v_rank, 'That is part of ' || v_name || '. Only its builders may ' || lower(d.label) || ' there.');$tx6o$, ''))) / length($tx6o$return coalesce(v_rank, 'That is part of ' || v_name || '. Only its builders may ' || lower(d.label) || ' there.');$tx6o$);
  if n <> 1 then raise exception 'green_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return coalesce(v_rank, 'That is part of ' || v_name || '. Only its builders may ' || lower(d.label) || ' there.');$tx6o$, $tx6n$return coalesce(v_rank, 'Part of ' || v_name || ': only builders may ' || lower(d.label) || ' there.');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('green_again()'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$select 'It starts again from bare stone and is as green as it gets in ' || green_span() || ' days.'$tx6o$, ''))) / length($tx6o$select 'It starts again from bare stone and is as green as it gets in ' || green_span() || ' days.'$tx6o$);
  if n <> 1 then raise exception 'green_again: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select 'It starts again from bare stone and is as green as it gets in ' || green_span() || ' days.'$tx6o$, $tx6n$select 'Fully green again in ' || green_span() || ' days.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('green_nothing_yet()'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$select 'Nothing has grown on it yet. It greens a day at a time, over ' || green_span()
      || ' days from when it was built, laid, set down or last cleared.'$tx6o$, ''))) / length($tx6o$select 'Nothing has grown on it yet. It greens a day at a time, over ' || green_span()
      || ' days from when it was built, laid, set down or last cleared.'$tx6o$);
  if n <> 1 then raise exception 'green_nothing_yet: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select 'Nothing has grown on it yet. It greens a day at a time, over ' || green_span()
      || ' days from when it was built, laid, set down or last cleared.'$tx6o$, $tx6n$select 'Nothing grown yet. Greens over ' || green_span()
      || ' days from when built, laid, set down or last cleared.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_green(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You clear the ivy off the ' || side_name(v_side) || ' wall. ' || green_again(), 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You clear the ivy off the ' || side_name(v_side) || ' wall. ' || green_again(), 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_green: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You clear the ivy off the ' || side_name(v_side) || ' wall. ' || green_again(), 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Ivy cleared: ' || side_name(v_side) || ' wall. ' || green_again(), 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You scrub the moss off the '$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You scrub the moss off the '$tx6o$);
  if n <> 2 then raise exception 'perform_green: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You scrub the moss off the '$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Moss scrubbed: the '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You scrub the moss off '$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You scrub the moss off '$tx6o$);
  if n <> 1 then raise exception 'perform_green: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You scrub the moss off '$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Moss scrubbed: '$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('rpc_order(uuid,text,integer,bigint,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'There is no such thing to ask for.'$tx6o$, ''))) / length($tx6o$'There is no such thing to ask for.'$tx6o$);
  if n <> 1 then raise exception 'rpc_order: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no such thing to ask for.'$tx6o$, $tx6n$'No such item.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('rank_member_refusal(uuid,uuid,uuid,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$then 'You are not a citizen of ' || (select d.name from deed d where d.world_id = p_world and d.founded_by = p_founder) || '.'$tx6o$, ''))) / length($tx6o$then 'You are not a citizen of ' || (select d.name from deed d where d.world_id = p_world and d.founded_by = p_founder) || '.'$tx6o$);
  if n <> 1 then raise exception 'rank_member_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then 'You are not a citizen of ' || (select d.name from deed d where d.world_id = p_world and d.founded_by = p_founder) || '.'$tx6o$, $tx6n$then 'Not a citizen of ' || (select d.name from deed d where d.world_id = p_world and d.founded_by = p_founder) || '.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('lock_refusal(uuid,uuid,bigint,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'It is locked, and you have no key to it.'$tx6o$, ''))) / length($tx6o$'It is locked, and you have no key to it.'$tx6o$);
  if n <> 1 then raise exception 'lock_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is locked, and you have no key to it.'$tx6o$, $tx6n$'Locked: no key.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('gate_lock_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'There is a padlock on it already.'$tx6o$, ''))) / length($tx6o$'There is a padlock on it already.'$tx6o$);
  if n <> 1 then raise exception 'gate_lock_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is a padlock on it already.'$tx6o$, $tx6n$'Already padlocked.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You have no padlock. Forge one at a smelter.'$tx6o$, ''))) / length($tx6o$'You have no padlock. Forge one at a smelter.'$tx6o$);
  if n <> 1 then raise exception 'gate_lock_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You have no padlock. Forge one at a smelter.'$tx6o$, $tx6n$'Need a padlock: forge one at a smelter.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no padlock on it.'$tx6o$, ''))) / length($tx6o$'There is no padlock on it.'$tx6o$);
  if n <> 1 then raise exception 'gate_lock_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no padlock on it.'$tx6o$, $tx6n$'No padlock on it.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('lock_refusal_for(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'There is a padlock on it already.'$tx6o$, ''))) / length($tx6o$'There is a padlock on it already.'$tx6o$);
  if n <> 1 then raise exception 'lock_refusal_for: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is a padlock on it already.'$tx6o$, $tx6n$'Already padlocked.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You have no padlock. Forge one at a smelter.'$tx6o$, ''))) / length($tx6o$'You have no padlock. Forge one at a smelter.'$tx6o$);
  if n <> 1 then raise exception 'lock_refusal_for: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You have no padlock. Forge one at a smelter.'$tx6o$, $tx6n$'Need a padlock: forge one at a smelter.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no padlock on it.'$tx6o$, ''))) / length($tx6o$'There is no padlock on it.'$tx6o$);
  if n <> 1 then raise exception 'lock_refusal_for: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no padlock on it.'$tx6o$, $tx6n$'No padlock on it.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('grave_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Nothing goes into a grave and nothing moves it. Take what is in it out before it crumbles.'$tx6o$, ''))) / length($tx6o$'Nothing goes into a grave and nothing moves it. Take what is in it out before it crumbles.'$tx6o$);
  if n <> 1 then raise exception 'grave_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing goes into a grave and nothing moves it. Take what is in it out before it crumbles.'$tx6o$, $tx6n$'Graves take nothing in and cannot be moved: empty it before it crumbles.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'That is ' || grave_owner(g) || '''s grave. Nobody but ' || grave_owner(g)
      || ' can open it, take from it or move it.';$tx6o$, ''))) / length($tx6o$return 'That is ' || grave_owner(g) || '''s grave. Nobody but ' || grave_owner(g)
      || ' can open it, take from it or move it.';$tx6o$);
  if n <> 1 then raise exception 'grave_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'That is ' || grave_owner(g) || '''s grave. Nobody but ' || grave_owner(g)
      || ' can open it, take from it or move it.';$tx6o$, $tx6n$return grave_owner(g) || '''s grave: only ' || grave_owner(g)
      || ' can open, take from or move it.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('rpc_join(uuid,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Your journey continues where you left off.'$tx6o$, ''))) / length($tx6o$'Your journey continues where you left off.'$tx6o$);
  if n <> 1 then raise exception 'rpc_join: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Your journey continues where you left off.'$tx6o$, $tx6n$'Resumed where you left off.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('grave_sweep(uuid)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, g.made_by, 'Your grave at ' || g.x || ', ' || g.y || ' has crumbled. '
        || case when g.lost = 1 then 'The one thing still in it is lost.'
                else 'The ' || g.lost || ' things still in it are lost.' end, 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, g.made_by, 'Your grave at ' || g.x || ', ' || g.y || ' has crumbled. '
        || case when g.lost = 1 then 'The one thing still in it is lost.'
                else 'The ' || g.lost || ' things still in it are lost.' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'grave_sweep: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, g.made_by, 'Your grave at ' || g.x || ', ' || g.y || ' has crumbled. '
        || case when g.lost = 1 then 'The one thing still in it is lost.'
                else 'The ' || g.lost || ' things still in it are lost.' end, 'event');$tx6o$, $tx6n$perform tell(p_world, g.made_by, 'Your grave at ' || g.x || ', ' || g.y || ' crumbled. Lost: '
        || g.lost || case when g.lost = 1 then ' item.'
                else ' items.' end, 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('forge_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'There is still a candle in it.'$tx6o$, ''))) / length($tx6o$'There is still a candle in it.'$tx6o$);
  if n <> 1 then raise exception 'forge_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is still a candle in it.'$tx6o$, $tx6n$'Candle still in it.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no candle in it.'$tx6o$, ''))) / length($tx6o$'There is no candle in it.'$tx6o$);
  if n <> 1 then raise exception 'forge_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no candle in it.'$tx6o$, $tx6n$'No candle in it.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It is already lit.'$tx6o$, ''))) / length($tx6o$'It is already lit.'$tx6o$);
  if n <> 1 then raise exception 'forge_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is already lit.'$tx6o$, $tx6n$'Already lit.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It is not lit.'$tx6o$, ''))) / length($tx6o$'It is not lit.'$tx6o$);
  if n <> 1 then raise exception 'forge_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is not lit.'$tx6o$, $tx6n$'Not lit.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Nothing goes in a torch.'$tx6o$, ''))) / length($tx6o$'Nothing goes in a torch.'$tx6o$);
  if n <> 1 then raise exception 'forge_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing goes in a torch.'$tx6o$, $tx6n$'Not in a torch.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then return 'Coins are struck from gold alone.'; end if;$tx6o$, ''))) / length($tx6o$then return 'Coins are struck from gold alone.'; end if;$tx6o$);
  if n <> 1 then raise exception 'forge_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then return 'Coins are struck from gold alone.'; end if;$tx6o$, $tx6n$then return 'Coins: gold only.'; end if;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It is packed as full as it will take.'$tx6o$, ''))) / length($tx6o$'It is packed as full as it will take.'$tx6o$);
  if n <> 1 then raise exception 'forge_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is packed as full as it will take.'$tx6o$, $tx6n$'Fuel full.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It is already burning.'$tx6o$, ''))) / length($tx6o$'It is already burning.'$tx6o$);
  if n <> 1 then raise exception 'forge_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is already burning.'$tx6o$, $tx6n$'Already lit.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is nothing in the firebox. Feed it some wood.'$tx6o$, ''))) / length($tx6o$'There is nothing in the firebox. Feed it some wood.'$tx6o$);
  if n <> 1 then raise exception 'forge_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is nothing in the firebox. Feed it some wood.'$tx6o$, $tx6n$'No fuel: add wood.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There are no ashes worth taking yet.'$tx6o$, ''))) / length($tx6o$'There are no ashes worth taking yet.'$tx6o$);
  if n <> 1 then raise exception 'forge_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There are no ashes worth taking yet.'$tx6o$, $tx6n$'No ashes yet.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$if not found then return 'An oven takes what a fire takes: ' || fuel_said() || '.'; end if;$tx6o$, ''))) / length($tx6o$if not found then return 'An oven takes what a fire takes: ' || fuel_said() || '.'; end if;$tx6o$);
  if n <> 1 then raise exception 'forge_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$if not found then return 'An oven takes what a fire takes: ' || fuel_said() || '.'; end if;$tx6o$, $tx6n$if not found then return 'Need fuel: ' || fuel_said() || '.'; end if;$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('lamp_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'There is still a candle in it.'$tx6o$, ''))) / length($tx6o$'There is still a candle in it.'$tx6o$);
  if n <> 1 then raise exception 'lamp_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is still a candle in it.'$tx6o$, $tx6n$'Candle still in it.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There is no candle in it.'$tx6o$, ''))) / length($tx6o$'There is no candle in it.'$tx6o$);
  if n <> 1 then raise exception 'lamp_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no candle in it.'$tx6o$, $tx6n$'No candle in it.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It is already lit.'$tx6o$, ''))) / length($tx6o$'It is already lit.'$tx6o$);
  if n <> 1 then raise exception 'lamp_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is already lit.'$tx6o$, $tx6n$'Already lit.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'It is not lit.'$tx6o$, ''))) / length($tx6o$'It is not lit.'$tx6o$);
  if n <> 1 then raise exception 'lamp_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is not lit.'$tx6o$, $tx6n$'Not lit.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_lamp(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'no candle in it.'$tx6o$, ''))) / length($tx6o$'no candle in it.'$tx6o$);
  if n <> 1 then raise exception 'perform_lamp: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'no candle in it.'$tx6o$, $tx6n$'no candle.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You fit the lantern to the ' || v_word || '. It throws '
      || lantern_reach(it.ql) || ' tiles, and has '
      || case when v_left > 0 then time_words(v_left) || ' of candle in it' || case when p.lit then ', alight' else '' end || '.'
              else 'no candle.' end, 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You fit the lantern to the ' || v_word || '. It throws '
      || lantern_reach(it.ql) || ' tiles, and has '
      || case when v_left > 0 then time_words(v_left) || ' of candle in it' || case when p.lit then ', alight' else '' end || '.'
              else 'no candle.' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_lamp: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You fit the lantern to the ' || v_word || '. It throws '
      || lantern_reach(it.ql) || ' tiles, and has '
      || case when v_left > 0 then time_words(v_left) || ' of candle in it' || case when p.lit then ', alight' else '' end || '.'
              else 'no candle.' end, 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Lantern fitted: ' || v_word || '. Light '
      || lantern_reach(it.ql) || ' tiles; '
      || case when v_left > 0 then 'candle ' || time_words(v_left) || case when p.lit then ', lit' else '' end || '.'
              else 'no candle.' end, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You take the lantern down off the ' || v_word || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You take the lantern down off the ' || v_word || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_lamp: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You take the lantern down off the ' || v_word || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Lantern taken down: ' || v_word || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You set a candle in the lantern on the ' || v_word || '. It will burn '
      || time_words(v_left) || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You set a candle in the lantern on the ' || v_word || '. It will burn '
      || time_words(v_left) || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_lamp: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You set a candle in the lantern on the ' || v_word || '. It will burn '
      || time_words(v_left) || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Candle in: the lantern on the ' || v_word || '. Burns '
      || time_words(v_left) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You take a light off the ' || v_from || ' and the lantern on the ' || v_word
      || ' throws it ' || lantern_reach((v_lamp->>'ql')::double precision) || ' tiles.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You take a light off the ' || v_from || ' and the lantern on the ' || v_word
      || ' throws it ' || lantern_reach((v_lamp->>'ql')::double precision) || ' tiles.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_lamp: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You take a light off the ' || v_from || ' and the lantern on the ' || v_word
      || ' throws it ' || lantern_reach((v_lamp->>'ql')::double precision) || ' tiles.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Lit from the ' || v_from || ': the lantern on the ' || v_word
      || ', light ' || lantern_reach((v_lamp->>'ql')::double precision) || ' tiles.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You pinch the wick out. ' || time_words(greatest(0, v_left)) || ' of candle saved.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You pinch the wick out. ' || time_words(greatest(0, v_left)) || ' of candle saved.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_lamp: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You pinch the wick out. ' || time_words(greatest(0, v_left)) || ' of candle saved.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Put out. Candle left: ' || time_words(greatest(0, v_left)) || '.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_forge(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You set a candle in the lantern. '
        || ceil(held_burn(it) / 60) || ' minutes of it, at a guess.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You set a candle in the lantern. '
        || ceil(held_burn(it) / 60) || ' minutes of it, at a guess.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_forge: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You set a candle in the lantern. '
        || ceil(held_burn(it) / 60) || ' minutes of it, at a guess.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Candle in: lantern. About '
        || ceil(held_burn(it) / 60) || ' minutes.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then 'You touch the torch to the ' || flame_near(p_world, p_uid, it.id)
             || ' and it takes. ' || ceil(candle_left(it) / 60) || ' minutes of it, throwing '
             || held_reach_of(it) || ' tiles.'
        else 'You take a light off the ' || flame_near(p_world, p_uid, it.id)
             || ' and the lantern throws it ' || held_reach_of(it) || ' tiles.' end, 'event');$tx6o$, ''))) / length($tx6o$then 'You touch the torch to the ' || flame_near(p_world, p_uid, it.id)
             || ' and it takes. ' || ceil(candle_left(it) / 60) || ' minutes of it, throwing '
             || held_reach_of(it) || ' tiles.'
        else 'You take a light off the ' || flame_near(p_world, p_uid, it.id)
             || ' and the lantern throws it ' || held_reach_of(it) || ' tiles.' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_forge: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then 'You touch the torch to the ' || flame_near(p_world, p_uid, it.id)
             || ' and it takes. ' || ceil(candle_left(it) / 60) || ' minutes of it, throwing '
             || held_reach_of(it) || ' tiles.'
        else 'You take a light off the ' || flame_near(p_world, p_uid, it.id)
             || ' and the lantern throws it ' || held_reach_of(it) || ' tiles.' end, 'event');$tx6o$, $tx6n$then 'Torch lit from the ' || flame_near(p_world, p_uid, it.id)
             || ': ' || ceil(candle_left(it) / 60) || ' minutes, light '
             || held_reach_of(it) || ' tiles.'
        else 'Lantern lit from the ' || flame_near(p_world, p_uid, it.id)
             || ': light ' || held_reach_of(it) || ' tiles.' end, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then 'You smother the torch. ' || ceil(v_left / 60)
             || ' minutes of it left, if it will take again.'
        else 'You pinch the wick out. ' || ceil(v_left / 60) || ' minutes of candle saved.' end, 'event');$tx6o$, ''))) / length($tx6o$then 'You smother the torch. ' || ceil(v_left / 60)
             || ' minutes of it left, if it will take again.'
        else 'You pinch the wick out. ' || ceil(v_left / 60) || ' minutes of candle saved.' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_forge: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then 'You smother the torch. ' || ceil(v_left / 60)
             || ' minutes of it left, if it will take again.'
        else 'You pinch the wick out. ' || ceil(v_left / 60) || ' minutes of candle saved.' end, 'event');$tx6o$, $tx6n$then 'Torch put out: ' || ceil(v_left / 60)
             || ' minutes left.'
        else 'Lantern put out: ' || ceil(v_left / 60) || ' minutes of candle left.' end, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You feed '
        || case when v_fits > 1 then v_fits || ' × ' else 'a ' end
        || lower((select name from item_def where id = it.def)) || ' into the oven. '$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You feed '
        || case when v_fits > 1 then v_fits || ' × ' else 'a ' end
        || lower((select name from item_def where id = it.def)) || ' into the oven. '$tx6o$);
  if n <> 1 then raise exception 'perform_forge: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You feed '
        || case when v_fits > 1 then v_fits || ' × ' else 'a ' end
        || lower((select name from item_def where id = it.def)) || ' into the oven. '$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Fuelled: '
        || case when v_fits > 1 then v_fits || ' × ' else '' end
        || lower((select name from item_def where id = it.def)) || '. Oven: '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The oven draws and the fire takes hold. '
        || oven_burns_for(p.fuel) || ' of fuel.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The oven draws and the fire takes hold. '
        || oven_burns_for(p.fuel) || ' of fuel.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_forge: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The oven draws and the fire takes hold. '
        || oven_burns_for(p.fuel) || ' of fuel.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Lit: oven, '
        || oven_burns_for(p.fuel) || ' of fuel.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You rake the fire out of the oven. It will keep its heat for nobody.', 'event');$tx6o$, ''))) / length($tx6o$'You rake the fire out of the oven. It will keep its heat for nobody.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_forge: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You rake the fire out of the oven. It will keep its heat for nobody.', 'event');$tx6o$, $tx6n$'Put out: oven. Heat lost.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('firing_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$return 'That is not made of metal the fire would give back.';$tx6o$, ''))) / length($tx6o$return 'That is not made of metal the fire would give back.';$tx6o$);
  if n <> 1 then raise exception 'firing_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'That is not made of metal the fire would give back.';$tx6o$, $tx6n$return 'Not meltable metal.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('rpc_queue_order(uuid,jsonb,integer[])'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$why := 'The jobs waiting changed before that arrived: nothing was moved.';$tx6o$, ''))) / length($tx6o$why := 'The jobs waiting changed before that arrived: nothing was moved.';$tx6o$);
  if n <> 1 then raise exception 'rpc_queue_order: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$why := 'The jobs waiting changed before that arrived: nothing was moved.';$tx6o$, $tx6n$why := 'Queue changed first: nothing moved.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$why := 'That is not an order of the jobs waiting: nothing was moved.';$tx6o$, ''))) / length($tx6o$why := 'That is not an order of the jobs waiting: nothing was moved.';$tx6o$);
  if n <> 1 then raise exception 'rpc_queue_order: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$why := 'That is not an order of the jobs waiting: nothing was moved.';$tx6o$, $tx6n$why := 'Not an order of the queued jobs: nothing moved.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, me, 'You put ' || lower(v_dropped[1]) || ' out of your mind.', 'info');$tx6o$, ''))) / length($tx6o$perform tell(p_world, me, 'You put ' || lower(v_dropped[1]) || ' out of your mind.', 'info');$tx6o$);
  if n <> 1 then raise exception 'rpc_queue_order: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, me, 'You put ' || lower(v_dropped[1]) || ' out of your mind.', 'info');$tx6o$, $tx6n$perform tell(p_world, me, 'Dropped from queue: ' || lower(v_dropped[1]) || '.', 'info');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, me, 'You put ' || array_length(v_dropped, 1) || ' jobs out of your mind.', 'info');$tx6o$, ''))) / length($tx6o$perform tell(p_world, me, 'You put ' || array_length(v_dropped, 1) || ' jobs out of your mind.', 'info');$tx6o$);
  if n <> 1 then raise exception 'rpc_queue_order: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, me, 'You put ' || array_length(v_dropped, 1) || ' jobs out of your mind.', 'info');$tx6o$, $tx6n$perform tell(p_world, me, 'Dropped from queue: ' || array_length(v_dropped, 1) || ' jobs.', 'info');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_lock(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$' and throw the key in after it'$tx6o$, ''))) / length($tx6o$' and throw the key in after it'$tx6o$);
  if n <> 1 then raise exception 'perform_lock: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$' and throw the key in after it'$tx6o$, $tx6n$', key returned with it'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You fit the padlock and cut its key. Nothing opens it now but that key'$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You fit the padlock and cut its key. Nothing opens it now but that key'$tx6o$);
  if n <> 1 then raise exception 'perform_lock: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You fit the padlock and cut its key. Nothing opens it now but that key'$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Padlock fitted; key made. Only that key opens it'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You take the padlock off'
    || case when v_key.id is not null then ', key returned with it' else '' end
    || '. It is open to anybody again.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You take the padlock off'
    || case when v_key.id is not null then ', key returned with it' else '' end
    || '. It is open to anybody again.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_lock: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You take the padlock off'
    || case when v_key.id is not null then ', key returned with it' else '' end
    || '. It is open to anybody again.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Padlock removed'
    || case when v_key.id is not null then ', key returned with it' else '' end
    || '. Open to anyone.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_gate_lock(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$' and throw the key in after it'$tx6o$, ''))) / length($tx6o$' and throw the key in after it'$tx6o$);
  if n <> 1 then raise exception 'perform_gate_lock: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$' and throw the key in after it'$tx6o$, $tx6n$', key returned with it'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You fit the padlock and cut its key. Nothing opens it now but that key'$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You fit the padlock and cut its key. Nothing opens it now but that key'$tx6o$);
  if n <> 1 then raise exception 'perform_gate_lock: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You fit the padlock and cut its key. Nothing opens it now but that key'$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Padlock fitted; key made. Only that key opens it'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You take the padlock off'
    || case when v_key.id is not null then ', key returned with it' else '' end
    || '. It is open to anybody again.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You take the padlock off'
    || case when v_key.id is not null then ', key returned with it' else '' end
    || '. It is open to anybody again.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_gate_lock: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You take the padlock off'
    || case when v_key.id is not null then ', key returned with it' else '' end
    || '. It is open to anybody again.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Padlock removed'
    || case when v_key.id is not null then ', key returned with it' else '' end
    || '. Open to anyone.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('vessel_says(placed)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'It is empty.'$tx6o$, ''))) / length($tx6o$'It is empty.'$tx6o$);
  if n <> 1 then raise exception 'vessel_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'It is empty.'$tx6o$, $tx6n$'Empty.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$when placed_dye(p) is not null then 'It holds ' || dye_says($tx6o$, ''))) / length($tx6o$when placed_dye(p) is not null then 'It holds ' || dye_says($tx6o$);
  if n <> 1 then raise exception 'vessel_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$when placed_dye(p) is not null then 'It holds ' || dye_says($tx6o$, $tx6n$when placed_dye(p) is not null then 'Holds: ' || dye_says($tx6n$);
  n := (length(v) - length(replace(v, $tx6o$else 'It holds ' || round(placed_litres(p))::bigint || ' litres of '$tx6o$, ''))) / length($tx6o$else 'It holds ' || round(placed_litres(p))::bigint || ' litres of '$tx6o$);
  if n <> 1 then raise exception 'vessel_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$else 'It holds ' || round(placed_litres(p))::bigint || ' litres of '$tx6o$, $tx6n$else 'Holds: ' || round(placed_litres(p))::bigint || ' litres of '$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('ride_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Stand beside the shafts.'$tx6o$, ''))) / length($tx6o$'Stand beside the shafts.'$tx6o$);
  if n <> 1 then raise exception 'ride_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Stand beside the shafts.'$tx6o$, $tx6n$'Stand beside it.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You already have a cart behind you.'$tx6o$, ''))) / length($tx6o$'You already have a cart behind you.'$tx6o$);
  if n <> 1 then raise exception 'ride_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You already have a cart behind you.'$tx6o$, $tx6n$'Already pulling a cart.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Somebody else has the helm.'$tx6o$, ''))) / length($tx6o$'Somebody else has the helm.'$tx6o$);
  if n <> 2 then raise exception 'ride_refusal: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'Somebody else has the helm.'$tx6o$, $tx6n$'Someone else has the helm.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Somebody else has the reins.'$tx6o$, ''))) / length($tx6o$'Somebody else has the reins.'$tx6o$);
  if n <> 1 then raise exception 'ride_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Somebody else has the reins.'$tx6o$, $tx6n$'Someone else has the reins.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You are aboard another vessel. Step ashore first.'$tx6o$, ''))) / length($tx6o$'You are aboard another vessel. Step ashore first.'$tx6o$);
  if n <> 2 then raise exception 'ride_refusal: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'You are aboard another vessel. Step ashore first.'$tx6o$, $tx6n$'Aboard another vessel: step ashore first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Stand beside it first.'$tx6o$, ''))) / length($tx6o$'Stand beside it first.'$tx6o$);
  if n <> 2 then raise exception 'ride_refusal: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'Stand beside it first.'$tx6o$, $tx6n$'Stand beside it.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You are already driving something.'$tx6o$, ''))) / length($tx6o$'You are already driving something.'$tx6o$);
  if n <> 2 then raise exception 'ride_refusal: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'You are already driving something.'$tx6o$, $tx6n$'Already driving.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'She is aground. Push her off first.'$tx6o$, ''))) / length($tx6o$'She is aground. Push her off first.'$tx6o$);
  if n <> 2 then raise exception 'ride_refusal: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'She is aground. Push her off first.'$tx6o$, $tx6n$'Aground: push off first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'She carries nobody but whoever steers her.'$tx6o$, ''))) / length($tx6o$'She carries nobody but whoever steers her.'$tx6o$);
  if n <> 1 then raise exception 'ride_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'She carries nobody but whoever steers her.'$tx6o$, $tx6n$'No passenger places.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You are aboard her already.'$tx6o$, ''))) / length($tx6o$'You are aboard her already.'$tx6o$);
  if n <> 1 then raise exception 'ride_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You are aboard her already.'$tx6o$, $tx6n$'Already aboard.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Get down off your mount first.'$tx6o$, ''))) / length($tx6o$'Get down off your mount first.'$tx6o$);
  if n <> 1 then raise exception 'ride_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Get down off your mount first.'$tx6o$, $tx6n$'Dismount first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Stand beside her first.'$tx6o$, ''))) / length($tx6o$'Stand beside her first.'$tx6o$);
  if n <> 1 then raise exception 'ride_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Stand beside her first.'$tx6o$, $tx6n$'Stand beside it.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You are not aboard her.'$tx6o$, ''))) / length($tx6o$'You are not aboard her.'$tx6o$);
  if n <> 1 then raise exception 'ride_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You are not aboard her.'$tx6o$, $tx6n$'Not aboard.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then 'Nothing is in the yokes. ' || placed_name(p) || ' needs ' || v.needs || ' to move.'
          else 'Only ' || n || ' of ' || v.yokes || ' yokes are filled. It needs ' || v.needs || '.' end;$tx6o$, ''))) / length($tx6o$then 'Nothing is in the yokes. ' || placed_name(p) || ' needs ' || v.needs || ' to move.'
          else 'Only ' || n || ' of ' || v.yokes || ' yokes are filled. It needs ' || v.needs || '.' end;$tx6o$);
  if n <> 1 then raise exception 'ride_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then 'Nothing is in the yokes. ' || placed_name(p) || ' needs ' || v.needs || ' to move.'
          else 'Only ' || n || ' of ' || v.yokes || ' yokes are filled. It needs ' || v.needs || '.' end;$tx6o$, $tx6n$then 'Yokes empty: ' || placed_name(p) || ' needs ' || v.needs || ' to move.'
          else 'Yokes ' || n || '/' || v.yokes || ': needs ' || v.needs || '.' end;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'Every one of her ' || n || ' places is taken.';$tx6o$, ''))) / length($tx6o$return 'Every one of her ' || n || ' places is taken.';$tx6o$);
  if n <> 1 then raise exception 'ride_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'Every one of her ' || n || ' places is taken.';$tx6o$, $tx6n$return 'All ' || n || ' places taken.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('no_mixing(text,text,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$|| ' will not mix with ' || (select name from liquid_def where id = p_into) || '. The ' || p_vessel
      || ' holds ' || (select name from liquid_def where id = p_into) || ': empty it, or use one that is empty or holds '$tx6o$, ''))) / length($tx6o$|| ' will not mix with ' || (select name from liquid_def where id = p_into) || '. The ' || p_vessel
      || ' holds ' || (select name from liquid_def where id = p_into) || ': empty it, or use one that is empty or holds '$tx6o$);
  if n <> 1 then raise exception 'no_mixing: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$|| ' will not mix with ' || (select name from liquid_def where id = p_into) || '. The ' || p_vessel
      || ' holds ' || (select name from liquid_def where id = p_into) || ': empty it, or use one that is empty or holds '$tx6o$, $tx6n$|| ' and ' || (select name from liquid_def where id = p_into) || ' do not mix. The ' || p_vessel
      || ' holds ' || (select name from liquid_def where id = p_into) || ': empty it, or use an empty one or one with '$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('over_the_side(placed)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$select 'You go over the side of the ' || lower(placed_name(p)) || ' into the water. She stays where she is.'$tx6o$, ''))) / length($tx6o$select 'You go over the side of the ' || lower(placed_name(p)) || ' into the water. She stays where she is.'$tx6o$);
  if n <> 1 then raise exception 'over_the_side: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select 'You go over the side of the ' || lower(placed_name(p)) || ' into the water. She stays where she is.'$tx6o$, $tx6n$select 'Over the side of the ' || lower(placed_name(p)) || ': swimming. The boat stays.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_ride(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You take up the shafts of the ' || lower(placed_name(p))
      || '. It will follow you now, and what you gather goes into it.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You take up the shafts of the ' || lower(placed_name(p))
      || '. It will follow you now, and what you gather goes into it.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ride: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You take up the shafts of the ' || lower(placed_name(p))
      || '. It will follow you now, and what you gather goes into it.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Pulling: ' || lower(placed_name(p))
      || '. It follows you; gathered items go into it.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You set the ' || lower(placed_name(p))
      || ' down and let go of the shafts.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You set the ' || lower(placed_name(p))
      || ' down and let go of the shafts.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ride: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You set the ' || lower(placed_name(p))
      || ' down and let go of the shafts.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Let go: ' || lower(placed_name(p))
      || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You push off and climb into the ' || lower(placed_name(p)) || '. '
        || case when v_sail then 'The sail fills and she comes round.'
                else 'You ship the oars and take a stroke.' end, 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You push off and climb into the ' || lower(placed_name(p)) || '. '
        || case when v_sail then 'The sail fills and she comes round.'
                else 'You ship the oars and take a stroke.' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ride: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You push off and climb into the ' || lower(placed_name(p)) || '. '
        || case when v_sail then 'The sail fills and she comes round.'
                else 'You ship the oars and take a stroke.' end, 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'At the helm: ' || lower(placed_name(p))
        || case when v_sail then ', under sail.'
                else ', rowing.' end, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You climb onto the ' || lower(placed_name(p)) || ' and take the reins. '
      || coalesce(v_names, 'Nothing') || ' lean into the traces. What you gather from the seat goes into it.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You climb onto the ' || lower(placed_name(p)) || ' and take the reins. '
      || coalesce(v_names, 'Nothing') || ' lean into the traces. What you gather from the seat goes into it.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ride: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You climb onto the ' || lower(placed_name(p)) || ' and take the reins. '
      || coalesce(v_names, 'Nothing') || ' lean into the traces. What you gather from the seat goes into it.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Driving: ' || lower(placed_name(p)) || ', team '
      || coalesce(v_names, 'none') || '. Gathered items go into it.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You climb aboard the ' || lower(placed_name(p)) || ' and find a place on deck. '
      || (select count(*) from player pp where pp.world_id = p_world and pp.aboard = p.id) || ' of '
      || boat_places(p) || ' places are taken.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You climb aboard the ' || lower(placed_name(p)) || ' and find a place on deck. '
      || (select count(*) from player pp where pp.world_id = p_world and pp.aboard = p.id) || ' of '
      || boat_places(p) || ' places are taken.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ride: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You climb aboard the ' || lower(placed_name(p)) || ' and find a place on deck. '
      || (select count(*) from player pp where pp.world_id = p_world and pp.aboard = p.id) || ' of '
      || boat_places(p) || ' places are taken.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Aboard: ' || lower(placed_name(p)) || '. Places taken: '
      || (select count(*) from player pp where pp.world_id = p_world and pp.aboard = p.id) || '/'
      || boat_places(p) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You step ashore from the ' || lower(placed_name(p)) || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You step ashore from the ' || lower(placed_name(p)) || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ride: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You step ashore from the ' || lower(placed_name(p)) || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Stepped ashore from the ' || lower(placed_name(p)) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$else 'You bring the ' || lower(placed_name(p)) || ' alongside and step ashore.' end, 'event');$tx6o$, ''))) / length($tx6o$else 'You bring the ' || lower(placed_name(p)) || ' alongside and step ashore.' end, 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ride: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$else 'You bring the ' || lower(placed_name(p)) || ' alongside and step ashore.' end, 'event');$tx6o$, $tx6n$else 'Stepped ashore from the ' || lower(placed_name(p)) || '.' end, 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You climb down off the ' || lower(placed_name(p)) || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You climb down off the ' || lower(placed_name(p)) || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_ride: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You climb down off the ' || lower(placed_name(p)) || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Got down from the ' || lower(placed_name(p)) || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You let ' || case when v_n = 1 then 'it' else 'them' end
      || ' out of the traces of the ' || lower(placed_name(p)) || '.'$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You let ' || case when v_n = 1 then 'it' else 'them' end
      || ' out of the traces of the ' || lower(placed_name(p)) || '.'$tx6o$);
  if n <> 1 then raise exception 'perform_ride: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You let ' || case when v_n = 1 then 'it' else 'them' end
      || ' out of the traces of the ' || lower(placed_name(p)) || '.'$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Unhitched: ' || v_n
      || ' from the ' || lower(placed_name(p)) || '.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('class_person_why(uuid,uuid,jsonb,double precision)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'That is not here.'$tx6o$, ''))) / length($tx6o$'That is not here.'$tx6o$);
  if n <> 2 then raise exception 'class_person_why: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'That is not here.'$tx6o$, $tx6n$'Target not here.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('spell_target(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'That is not here.'$tx6o$, ''))) / length($tx6o$'That is not here.'$tx6o$);
  if n <> 1 then raise exception 'spell_target: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is not here.'$tx6o$, $tx6n$'Target not here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That is tame, not an enemy.'$tx6o$, ''))) / length($tx6o$'That is tame, not an enemy.'$tx6o$);
  if n <> 1 then raise exception 'spell_target: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is tame, not an enemy.'$tx6o$, $tx6n$'Tame, not an enemy.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'That is after you.'$tx6o$, ''))) / length($tx6o$'That is after you.'$tx6o$);
  if n <> 1 then raise exception 'spell_target: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is after you.'$tx6o$, $tx6n$'It is hunting you.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return jsonb_build_object('why', s.name || ' is cast on ' || listed_or(array($tx6o$, ''))) / length($tx6o$return jsonb_build_object('why', s.name || ' is cast on ' || listed_or(array($tx6o$);
  if n <> 1 then raise exception 'spell_target: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return jsonb_build_object('why', s.name || ' is cast on ' || listed_or(array($tx6o$, $tx6n$return jsonb_build_object('why', s.name || ': cast on ' || listed_or(array($tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return jsonb_build_object('why', 'That is more than ' || spell_reach() || ' tiles away.');$tx6o$, ''))) / length($tx6o$return jsonb_build_object('why', 'That is more than ' || spell_reach() || ' tiles away.');$tx6o$);
  if n <> 1 then raise exception 'spell_target: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return jsonb_build_object('why', 'That is more than ' || spell_reach() || ' tiles away.');$tx6o$, $tx6n$return jsonb_build_object('why', 'Too far: max ' || spell_reach() || ' tiles.');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('patron_refusal(uuid,uuid,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'There is no such patron.'$tx6o$, ''))) / length($tx6o$'There is no such patron.'$tx6o$);
  if n <> 1 then raise exception 'patron_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no such patron.'$tx6o$, $tx6n$'No such patron.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return coalesce((select name from patron_def where id = p.patron), p.patron)
        || ' is your patron already, and a patron is for good.';$tx6o$, ''))) / length($tx6o$return coalesce((select name from patron_def where id = p.patron), p.patron)
        || ' is your patron already, and a patron is for good.';$tx6o$);
  if n <> 1 then raise exception 'patron_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return coalesce((select name from patron_def where id = p.patron), p.patron)
        || ' is your patron already, and a patron is for good.';$tx6o$, $tx6n$return 'Patron already ' || coalesce((select name from patron_def where id = p.patron), p.patron)
        || '; permanent.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'A patron is taken at ' || patron_at()::int || ' ' || faith_word() || '; you have ' || floor(v_faith)::int || '.';$tx6o$, ''))) / length($tx6o$return 'A patron is taken at ' || patron_at()::int || ' ' || faith_word() || '; you have ' || floor(v_faith)::int || '.';$tx6o$);
  if n <> 1 then raise exception 'patron_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'A patron is taken at ' || patron_at()::int || ' ' || faith_word() || '; you have ' || floor(v_faith)::int || '.';$tx6o$, $tx6n$return 'Needs ' || faith_word() || ' ' || patron_at()::int || '; have ' || floor(v_faith)::int || '.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('faith_spell_refusal(uuid,uuid,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You have that already.'$tx6o$, ''))) / length($tx6o$'You have that already.'$tx6o$);
  if n <> 1 then raise exception 'faith_spell_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You have that already.'$tx6o$, $tx6n$'Already taken.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$if v_other is not null then return 'You took ' || v_other || ' at this tier.'; end if;$tx6o$, ''))) / length($tx6o$if v_other is not null then return 'You took ' || v_other || ' at this tier.'; end if;$tx6o$);
  if n <> 1 then raise exception 'faith_spell_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$if v_other is not null then return 'You took ' || v_other || ' at this tier.'; end if;$tx6o$, $tx6n$if v_other is not null then return 'Already took ' || v_other || ' at this tier.'; end if;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'This tier opens at ' || v_at || ' ' || faith_word() || '; you have ' || floor(v_faith)::int || '.';$tx6o$, ''))) / length($tx6o$return 'This tier opens at ' || v_at || ' ' || faith_word() || '; you have ' || floor(v_faith)::int || '.';$tx6o$);
  if n <> 1 then raise exception 'faith_spell_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'This tier opens at ' || v_at || ' ' || faith_word() || '; you have ' || floor(v_faith)::int || '.';$tx6o$, $tx6n$return 'Tier needs ' || faith_word() || ' ' || v_at || '; have ' || floor(v_faith)::int || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'That is ' || coalesce((select name from patron_def where id = s.patron), s.patron) || '’s, and '
        || coalesce((select name from patron_def where id = p.patron), p.patron) || ' is your patron.';$tx6o$, ''))) / length($tx6o$return 'That is ' || coalesce((select name from patron_def where id = s.patron), s.patron) || '’s, and '
        || coalesce((select name from patron_def where id = p.patron), p.patron) || ' is your patron.';$tx6o$);
  if n <> 1 then raise exception 'faith_spell_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'That is ' || coalesce((select name from patron_def where id = s.patron), s.patron) || '’s, and '
        || coalesce((select name from patron_def where id = p.patron), p.patron) || ' is your patron.';$tx6o$, $tx6n$return coalesce((select name from patron_def where id = s.patron), s.patron) || ' spell; your patron is '
        || coalesce((select name from patron_def where id = p.patron), p.patron) || '.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('spell_slot_refusal(uuid,uuid,integer,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'There is no such slot.'$tx6o$, ''))) / length($tx6o$'There is no such slot.'$tx6o$);
  if n <> 1 then raise exception 'spell_slot_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no such slot.'$tx6o$, $tx6n$'No such slot.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You do not have that spell.'$tx6o$, ''))) / length($tx6o$'You do not have that spell.'$tx6o$);
  if n <> 1 then raise exception 'spell_slot_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You do not have that spell.'$tx6o$, $tx6n$'Spell not known.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$if v_school <> v_want then return 'That slot is for ' || v_want || ' spells.'; end if;$tx6o$, ''))) / length($tx6o$if v_school <> v_want then return 'That slot is for ' || v_want || ' spells.'; end if;$tx6o$);
  if n <> 1 then raise exception 'spell_slot_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$if v_school <> v_want then return 'That slot is for ' || v_want || ' spells.'; end if;$tx6o$, $tx6n$if v_school <> v_want then return 'Slot for ' || v_want || ' spells only.'; end if;$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('rpc_cast_spell(uuid,integer,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'There is no such slot.'$tx6o$, ''))) / length($tx6o$'There is no such slot.'$tx6o$);
  if n <> 1 then raise exception 'rpc_cast_spell: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There is no such slot.'$tx6o$, $tx6n$'No such slot.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('salve_refusal(jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'A salve goes on over a dressing. Dress the wound first.'$tx6o$, ''))) / length($tx6o$'A salve goes on over a dressing. Dress the wound first.'$tx6o$);
  if n <> 1 then raise exception 'salve_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A salve goes on over a dressing. Dress the wound first.'$tx6o$, $tx6n$'Dress the wound first: a salve goes over a dressing.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Nothing dressed on you can go bad.'$tx6o$, ''))) / length($tx6o$'Nothing dressed on you can go bad.'$tx6o$);
  if n <> 1 then raise exception 'salve_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing dressed on you can go bad.'$tx6o$, $tx6n$'No dressed wound that can go bad.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('salve_refusal_for(jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'A salve goes on over a dressing. Dress the wound first.'$tx6o$, ''))) / length($tx6o$'A salve goes on over a dressing. Dress the wound first.'$tx6o$);
  if n <> 1 then raise exception 'salve_refusal_for: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A salve goes on over a dressing. Dress the wound first.'$tx6o$, $tx6n$'Dress the wound first: a salve goes over a dressing.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then wound_on_your(w) || ' has gone bad. Clean it out before anything will hold on it.'$tx6o$, ''))) / length($tx6o$then wound_on_your(w) || ' has gone bad. Clean it out before anything will hold on it.'$tx6o$);
  if n <> 1 then raise exception 'salve_refusal_for: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then wound_on_your(w) || ' has gone bad. Clean it out before anything will hold on it.'$tx6o$, $tx6n$then wound_on_your(w) || ': infected. Clean it with lye first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then wound_on_your(w) || ' has a salve on it already.'$tx6o$, ''))) / length($tx6o$then wound_on_your(w) || ' has a salve on it already.'$tx6o$);
  if n <> 1 then raise exception 'salve_refusal_for: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then wound_on_your(w) || ' has a salve on it already.'$tx6o$, $tx6n$then wound_on_your(w) || ': already salved.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then wound_on_your(w) || ' is under the ' || (w->>'dressing') || ' that suits it, and cannot go bad.'$tx6o$, ''))) / length($tx6o$then wound_on_your(w) || ' is under the ' || (w->>'dressing') || ' that suits it, and cannot go bad.'$tx6o$);
  if n <> 1 then raise exception 'salve_refusal_for: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then wound_on_your(w) || ' is under the ' || (w->>'dressing') || ' that suits it, and cannot go bad.'$tx6o$, $tx6n$then wound_on_your(w) || ': under its right herb (' || (w->>'dressing') || '), cannot go bad.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('rank_name_refusal(uuid,uuid,text,bigint)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Founder is whoever founded the settlement, not a rank.'$tx6o$, ''))) / length($tx6o$'Founder is whoever founded the settlement, not a rank.'$tx6o$);
  if n <> 1 then raise exception 'rank_name_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Founder is whoever founded the settlement, not a rank.'$tx6o$, $tx6n$'Founder is not a rank name.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$when length(btrim(p_name)) > rank_name_max() then 'A rank''s name is at most ' || rank_name_max() || ' characters.'$tx6o$, ''))) / length($tx6o$when length(btrim(p_name)) > rank_name_max() then 'A rank''s name is at most ' || rank_name_max() || ' characters.'$tx6o$);
  if n <> 1 then raise exception 'rank_name_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$when length(btrim(p_name)) > rank_name_max() then 'A rank''s name is at most ' || rank_name_max() || ' characters.'$tx6o$, $tx6n$when length(btrim(p_name)) > rank_name_max() then 'Rank name: max ' || rank_name_max() || ' characters.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$|| ' already has a rank called ' || btrim(p_name) || '.'$tx6o$, ''))) / length($tx6o$|| ' already has a rank called ' || btrim(p_name) || '.'$tx6o$);
  if n <> 1 then raise exception 'rank_name_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$|| ' already has a rank called ' || btrim(p_name) || '.'$tx6o$, $tx6n$|| ' already has a rank named ' || btrim(p_name) || '.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('rank_lacks(uuid,uuid,uuid,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$select 'Your rank at ' || d.name || ', ' || r.name || ', may not ' || p.may_not || '.'$tx6o$, ''))) / length($tx6o$select 'Your rank at ' || d.name || ', ' || r.name || ', may not ' || p.may_not || '.'$tx6o$);
  if n <> 1 then raise exception 'rank_lacks: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select 'Your rank at ' || d.name || ', ' || r.name || ', may not ' || p.may_not || '.'$tx6o$, $tx6n$select 'Your rank at ' || d.name || ' (' || r.name || ') cannot ' || p.may_not || '.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('rpc_rank_add(uuid,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$return jsonb_build_object('why', d.name || ' has ' || rank_cap()
      || ' ranks besides its founder, which is as many as a settlement may have.');$tx6o$, ''))) / length($tx6o$return jsonb_build_object('why', d.name || ' has ' || rank_cap()
      || ' ranks besides its founder, which is as many as a settlement may have.');$tx6o$);
  if n <> 1 then raise exception 'rpc_rank_add: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return jsonb_build_object('why', d.name || ' has ' || rank_cap()
      || ' ranks besides its founder, which is as many as a settlement may have.');$tx6o$, $tx6n$return jsonb_build_object('why', d.name || ': max ' || rank_cap()
      || ' ranks besides the founder.');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('rpc_rank_move(uuid,bigint,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$if not found then return jsonb_build_object('why', r.name || ' is already the highest rank.'); end if;$tx6o$, ''))) / length($tx6o$if not found then return jsonb_build_object('why', r.name || ' is already the highest rank.'); end if;$tx6o$);
  if n <> 1 then raise exception 'rpc_rank_move: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$if not found then return jsonb_build_object('why', r.name || ' is already the highest rank.'); end if;$tx6o$, $tx6n$if not found then return jsonb_build_object('why', r.name || ': already the highest rank.'); end if;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$if not found then return jsonb_build_object('why', r.name || ' is already the lowest rank.'); end if;$tx6o$, ''))) / length($tx6o$if not found then return jsonb_build_object('why', r.name || ' is already the lowest rank.'); end if;$tx6o$);
  if n <> 1 then raise exception 'rpc_rank_move: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$if not found then return jsonb_build_object('why', r.name || ' is already the lowest rank.'); end if;$tx6o$, $tx6n$if not found then return jsonb_build_object('why', r.name || ': already the lowest rank.'); end if;$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('rpc_rank_drop(uuid,bigint)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$return jsonb_build_object('why', r.name || ' is the rank newcomers are given. Choose another for them first.');$tx6o$, ''))) / length($tx6o$return jsonb_build_object('why', r.name || ' is the rank newcomers are given. Choose another for them first.');$tx6o$);
  if n <> 1 then raise exception 'rpc_rank_drop: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return jsonb_build_object('why', r.name || ' is the rank newcomers are given. Choose another for them first.');$tx6o$, $tx6n$return jsonb_build_object('why', r.name || ' is the newcomer rank: choose another first.');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return jsonb_build_object('why', v_n || case when v_n = 1 then ' citizen holds ' else ' citizens hold ' end
      || r.name || '. Give them another rank first.');$tx6o$, ''))) / length($tx6o$return jsonb_build_object('why', v_n || case when v_n = 1 then ' citizen holds ' else ' citizens hold ' end
      || r.name || '. Give them another rank first.');$tx6o$);
  if n <> 1 then raise exception 'rpc_rank_drop: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return jsonb_build_object('why', v_n || case when v_n = 1 then ' citizen holds ' else ' citizens hold ' end
      || r.name || '. Give them another rank first.');$tx6o$, $tx6n$return jsonb_build_object('why', r.name || ' held by ' || v_n || case when v_n = 1 then ' citizen' else ' citizens' end
      || ': give them another rank first.');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('stone_ground_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$return 'That is the ground of ' || runestone_name(v_id) || '. Nothing can be dug, built, planted or set down on it.';$tx6o$, ''))) / length($tx6o$return 'That is the ground of ' || runestone_name(v_id) || '. Nothing can be dug, built, planted or set down on it.';$tx6o$);
  if n <> 1 then raise exception 'stone_ground_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'That is the ground of ' || runestone_name(v_id) || '. Nothing can be dug, built, planted or set down on it.';$tx6o$, $tx6n$return 'Ground of ' || runestone_name(v_id) || ': no digging, building, planting or setting down.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('ground_says(uuid,integer,integer,timestamp with time zone)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$v_said := v_said || ' ' || runestone_name(v_stone) || ', a Runestone, stands here. A Telestone can take you to it.';$tx6o$, ''))) / length($tx6o$v_said := v_said || ' ' || runestone_name(v_stone) || ', a Runestone, stands here. A Telestone can take you to it.';$tx6o$);
  if n <> 1 then raise exception 'ground_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_said := v_said || ' ' || runestone_name(v_stone) || ', a Runestone, stands here. A Telestone can take you to it.';$tx6o$, $tx6n$v_said := v_said || ' Runestone: ' || runestone_name(v_stone) || '. Telestone destination.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_said := v_said || ' ' || case when v_swirl ~ '^[aeiou]' then 'An' else 'A' end || ' ' || v_swirl
      || ' mote swirl turns over it until the next turn of the woods.';$tx6o$, ''))) / length($tx6o$v_said := v_said || ' ' || case when v_swirl ~ '^[aeiou]' then 'An' else 'A' end || ' ' || v_swirl
      || ' mote swirl turns over it until the next turn of the woods.';$tx6o$);
  if n <> 1 then raise exception 'ground_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_said := v_said || ' ' || case when v_swirl ~ '^[aeiou]' then 'An' else 'A' end || ' ' || v_swirl
      || ' mote swirl turns over it until the next turn of the woods.';$tx6o$, $tx6n$v_said := v_said || ' Mote swirl: ' || v_swirl
      || ', until the woods next turn.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_said := ' Worn bare out of ' || v_was || ': ' || v_worn || ' of ' || wear_most()::int
      || ' wear. It loses ' || wear_fall()::int || ' at each turn of the woods and is '
      || v_was || ' again with none left.';$tx6o$, ''))) / length($tx6o$v_said := ' Worn bare out of ' || v_was || ': ' || v_worn || ' of ' || wear_most()::int
      || ' wear. It loses ' || wear_fall()::int || ' at each turn of the woods and is '
      || v_was || ' again with none left.';$tx6o$);
  if n <> 1 then raise exception 'ground_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_said := ' Worn bare out of ' || v_was || ': ' || v_worn || ' of ' || wear_most()::int
      || ' wear. It loses ' || wear_fall()::int || ' at each turn of the woods and is '
      || v_was || ' again with none left.';$tx6o$, $tx6n$v_said := ' Trail (was ' || v_was || '): wear ' || v_worn || '/' || wear_most()::int
      || '. Loses ' || wear_fall()::int || ' each woods turn; back to '
      || v_was || ' at 0.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_said := ' Walked: ' || v_worn || ' of ' || wear_trail()::int || ' wear towards a trail.';$tx6o$, ''))) / length($tx6o$v_said := ' Walked: ' || v_worn || ' of ' || wear_trail()::int || ' wear towards a trail.';$tx6o$);
  if n <> 1 then raise exception 'ground_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_said := ' Walked: ' || v_worn || ' of ' || wear_trail()::int || ' wear towards a trail.';$tx6o$, $tx6n$v_said := ' Wear: ' || v_worn || '/' || wear_trail()::int || ' to become a trail.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_said := v_said || ' In flower: ' || case when v_n = 1 then 'a clump' else number_word(v_n) || ' clumps' end
        || ' of wildflowers.';$tx6o$, ''))) / length($tx6o$v_said := v_said || ' In flower: ' || case when v_n = 1 then 'a clump' else number_word(v_n) || ' clumps' end
        || ' of wildflowers.';$tx6o$);
  if n <> 1 then raise exception 'ground_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_said := v_said || ' In flower: ' || case when v_n = 1 then 'a clump' else number_word(v_n) || ' clumps' end
        || ' of wildflowers.';$tx6o$, $tx6n$v_said := v_said || ' Wildflowers: ' || v_n || case when v_n = 1 then ' clump' else ' clumps' end
        || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_said := v_said || ' Its flowers have been picked: none until spring.';$tx6o$, ''))) / length($tx6o$v_said := v_said || ' Its flowers have been picked: none until spring.';$tx6o$);
  if n <> 1 then raise exception 'ground_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_said := v_said || ' Its flowers have been picked: none until spring.';$tx6o$, $tx6n$v_said := v_said || ' Flowers picked: again in spring.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_telestone(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You hold up the Telestone and are standing beside ' || s.name
    || '. You can travel by Telestone again in ' || time_words(v_rest) || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You hold up the Telestone and are standing beside ' || s.name
    || '. You can travel by Telestone again in ' || time_words(v_rest) || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_telestone: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You hold up the Telestone and are standing beside ' || s.name
    || '. You can travel by Telestone again in ' || time_words(v_rest) || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Travelled to ' || s.name
    || '. Telestone cooldown: ' || time_words(v_rest) || '.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('telestone_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$return v_pet || ' follows you and would be left behind. Send it to your deed or into a crate first.';$tx6o$, ''))) / length($tx6o$return v_pet || ' follows you and would be left behind. Send it to your deed or into a crate first.';$tx6o$);
  if n <> 1 then raise exception 'telestone_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return v_pet || ' follows you and would be left behind. Send it to your deed or into a crate first.';$tx6o$, $tx6n$return v_pet || ' would be left behind: send it to your deed or into a crate first.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return s.name || ' is ' || floor(v_d + 0.5)::bigint || ' tiles away. This Telestone reaches ' || floor(v_reach + 0.5)::bigint || '.';$tx6o$, ''))) / length($tx6o$return s.name || ' is ' || floor(v_d + 0.5)::bigint || ' tiles away. This Telestone reaches ' || floor(v_reach + 0.5)::bigint || '.';$tx6o$);
  if n <> 1 then raise exception 'telestone_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return s.name || ' is ' || floor(v_d + 0.5)::bigint || ' tiles away. This Telestone reaches ' || floor(v_reach + 0.5)::bigint || '.';$tx6o$, $tx6n$return s.name || ': ' || floor(v_d + 0.5)::bigint || ' tiles away; this Telestone reaches ' || floor(v_reach + 0.5)::bigint || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$if v_wait > 0 then return 'You can travel by Telestone again in ' || time_words(v_wait) || '.'; end if;$tx6o$, ''))) / length($tx6o$if v_wait > 0 then return 'You can travel by Telestone again in ' || time_words(v_wait) || '.'; end if;$tx6o$);
  if n <> 1 then raise exception 'telestone_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$if v_wait > 0 then return 'You can travel by Telestone again in ' || time_words(v_wait) || '.'; end if;$tx6o$, $tx6n$if v_wait > 0 then return 'Telestone cooldown: ' || time_words(v_wait) || '.'; end if;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'There is no free ground beside ' || s.name || ' to arrive on.';$tx6o$, ''))) / length($tx6o$return 'There is no free ground beside ' || s.name || ' to arrive on.';$tx6o$);
  if n <> 1 then raise exception 'telestone_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'There is no free ground beside ' || s.name || ' to arrive on.';$tx6o$, $tx6n$return 'No free ground beside ' || s.name || ' to arrive on.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('absorb_setting(uuid,uuid,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Choose something to absorb it into.'$tx6o$, ''))) / length($tx6o$'Choose something to absorb it into.'$tx6o$);
  if n <> 1 then raise exception 'absorb_setting: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Choose something to absorb it into.'$tx6o$, $tx6n$'Choose an item.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A soul will not go into another soul.'$tx6o$, ''))) / length($tx6o$'A soul will not go into another soul.'$tx6o$);
  if n <> 1 then raise exception 'absorb_setting: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A soul will not go into another soul.'$tx6o$, $tx6n$'Not into another soul.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'A bauble''s rarity is rolled when it is restored.'$tx6o$, ''))) / length($tx6o$'A bauble''s rarity is rolled when it is restored.'$tx6o$);
  if n <> 1 then raise exception 'absorb_setting: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'A bauble''s rarity is rolled when it is restored.'$tx6o$, $tx6n$'Not on a bauble: its rarity is rolled when restored.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$o_why := 'Only an ordinary thing takes a soul, and this is ' || o_item.rare || ' already.'; return;$tx6o$, ''))) / length($tx6o$o_why := 'Only an ordinary thing takes a soul, and this is ' || o_item.rare || ' already.'; return;$tx6o$);
  if n <> 1 then raise exception 'absorb_setting: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$o_why := 'Only an ordinary thing takes a soul, and this is ' || o_item.rare || ' already.'; return;$tx6o$, $tx6n$o_why := 'Only ordinary items take a soul; this is ' || o_item.rare || '.'; return;$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('fed_said()'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$select upper(left(x.l, 1)) || substr(x.l, 2) || ' are all at their fullest.'$tx6o$, ''))) / length($tx6o$select upper(left(x.l, 1)) || substr(x.l, 2) || ' are all at their fullest.'$tx6o$);
  if n <> 1 then raise exception 'fed_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select upper(left(x.l, 1)) || substr(x.l, 2) || ' are all at their fullest.'$tx6o$, $tx6n$select upper(left(x.l, 1)) || substr(x.l, 2) || ': full.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_sacrifice(uuid,uuid,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You give up the ' || v_name || ' at the altar. ' || fed_said(), 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You give up the ' || v_name || ' at the altar. ' || fed_said(), 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_sacrifice: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You give up the ' || v_name || ' at the altar. ' || fed_said(), 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Sacrificed: ' || v_name || '. ' || fed_said(), 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'A ' || (s.o_item).rare || ' soul is left where the ' || v_name || ' was.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'A ' || (s.o_item).rare || ' soul is left where the ' || v_name || ' was.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_sacrifice: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'A ' || (s.o_item).rare || ' soul is left where the ' || v_name || ' was.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Got: ' || (s.o_item).rare || ' soul.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_absorb(uuid,uuid,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'The ' || v_soul || ' sinks into the ' || v_name || ', and it is ' || (s.o_soul).rare || ' now.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'The ' || v_soul || ' sinks into the ' || v_name || ', and it is ' || (s.o_soul).rare || ' now.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_absorb: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'The ' || v_soul || ' sinks into the ' || v_name || ', and it is ' || (s.o_soul).rare || ' now.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Absorbed: ' || v_soul || ' into ' || v_name || '. Now ' || (s.o_soul).rare || '.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('spring_says(jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'on into the sea'$tx6o$, ''))) / length($tx6o$'on into the sea'$tx6o$);
  if n <> 2 then raise exception 'spring_says: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'on into the sea'$tx6o$, $tx6n$'into the sea'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'away into the ground'$tx6o$, ''))) / length($tx6o$'away into the ground'$tx6o$);
  if n <> 2 then raise exception 'spring_says: % of an anchor, not 2', n; end if;
  v := replace(v, $tx6o$'away into the ground'$tx6o$, $tx6n$'into the ground'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Water wells up in the pool. Nothing beside it is lower than its water, so it stays full and goes nowhere.'$tx6o$, ''))) / length($tx6o$'Water wells up in the pool. Nothing beside it is lower than its water, so it stays full and goes nowhere.'$tx6o$);
  if n <> 1 then raise exception 'spring_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Water wells up in the pool. Nothing beside it is lower than its water, so it stays full and goes nowhere.'$tx6o$, $tx6n$'Spring in the pool: stays full, no outflow (nothing lower beside it).'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Water wells up in the pool and spills over its lowest edge, falling '$tx6o$, ''))) / length($tx6o$'Water wells up in the pool and spills over its lowest edge, falling '$tx6o$);
  if n <> 1 then raise exception 'spring_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Water wells up in the pool and spills over its lowest edge, falling '$tx6o$, $tx6n$'Spring in the pool: spills over its lowest edge, falls '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$|| ', and runs '
      || case when p_chain->'ponds'->-1 ? 'tiles' and not (p_chain->'ponds'->-1 ? 'spill') then
           'down into ' || (jsonb_array_length(p_chain->'ponds') - 1)
           || ' more pond' || case when jsonb_array_length(p_chain->'ponds') = 2 then '' else 's' end
           || ' below it, where it stays'$tx6o$, ''))) / length($tx6o$|| ', and runs '
      || case when p_chain->'ponds'->-1 ? 'tiles' and not (p_chain->'ponds'->-1 ? 'spill') then
           'down into ' || (jsonb_array_length(p_chain->'ponds') - 1)
           || ' more pond' || case when jsonb_array_length(p_chain->'ponds') = 2 then '' else 's' end
           || ' below it, where it stays'$tx6o$);
  if n <> 1 then raise exception 'spring_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$|| ', and runs '
      || case when p_chain->'ponds'->-1 ? 'tiles' and not (p_chain->'ponds'->-1 ? 'spill') then
           'down into ' || (jsonb_array_length(p_chain->'ponds') - 1)
           || ' more pond' || case when jsonb_array_length(p_chain->'ponds') = 2 then '' else 's' end
           || ' below it, where it stays'$tx6o$, $tx6n$|| ', then flows '
      || case when p_chain->'ponds'->-1 ? 'tiles' and not (p_chain->'ponds'->-1 ? 'spill') then
           'into ' || (jsonb_array_length(p_chain->'ponds') - 1)
           || ' more pond' || case when jsonb_array_length(p_chain->'ponds') = 2 then '' else 's' end
           || ' below and stays'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$then 'down into ' || (jsonb_array_length(p_chain->'ponds') - 1)
                     || ' more pond' || case when jsonb_array_length(p_chain->'ponds') = 2 then '' else 's' end
                     || ' below it, and from the last of those '$tx6o$, ''))) / length($tx6o$then 'down into ' || (jsonb_array_length(p_chain->'ponds') - 1)
                     || ' more pond' || case when jsonb_array_length(p_chain->'ponds') = 2 then '' else 's' end
                     || ' below it, and from the last of those '$tx6o$);
  if n <> 1 then raise exception 'spring_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$then 'down into ' || (jsonb_array_length(p_chain->'ponds') - 1)
                     || ' more pond' || case when jsonb_array_length(p_chain->'ponds') = 2 then '' else 's' end
                     || ' below it, and from the last of those '$tx6o$, $tx6n$then 'into ' || (jsonb_array_length(p_chain->'ponds') - 1)
                     || ' more pond' || case when jsonb_array_length(p_chain->'ponds') = 2 then '' else 's' end
                     || ' below, then from the last '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Water wells up at the bottom of the hollow. It will stand '$tx6o$, ''))) / length($tx6o$'Water wells up at the bottom of the hollow. It will stand '$tx6o$);
  if n <> 1 then raise exception 'spring_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Water wells up at the bottom of the hollow. It will stand '$tx6o$, $tx6n$'Spring: pond '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$|| ' corners, then spill over the lowest point of its rim and run '
      || case when jsonb_array_length(p_chain->'ponds') > 1
              then 'down into ' || (jsonb_array_length(p_chain->'ponds') - 1)
                   || ' more pond' || case when jsonb_array_length(p_chain->'ponds') = 2 then '' else 's' end
                   || ' below it, and from the last of those '$tx6o$, ''))) / length($tx6o$|| ' corners, then spill over the lowest point of its rim and run '
      || case when jsonb_array_length(p_chain->'ponds') > 1
              then 'down into ' || (jsonb_array_length(p_chain->'ponds') - 1)
                   || ' more pond' || case when jsonb_array_length(p_chain->'ponds') = 2 then '' else 's' end
                   || ' below it, and from the last of those '$tx6o$);
  if n <> 1 then raise exception 'spring_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$|| ' corners, then spill over the lowest point of its rim and run '
      || case when jsonb_array_length(p_chain->'ponds') > 1
              then 'down into ' || (jsonb_array_length(p_chain->'ponds') - 1)
                   || ' more pond' || case when jsonb_array_length(p_chain->'ponds') = 2 then '' else 's' end
                   || ' below it, and from the last of those '$tx6o$, $tx6n$|| ' corners, then spills over its rim and flows '
      || case when jsonb_array_length(p_chain->'ponds') > 1
              then 'into ' || (jsonb_array_length(p_chain->'ponds') - 1)
                   || ' more pond' || case when jsonb_array_length(p_chain->'ponds') = 2 then '' else 's' end
                   || ' below, then from the last '$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_spring(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'You pack the spring shut. Its water sinks away, and the ponds it kept go dry.'$tx6o$, ''))) / length($tx6o$'You pack the spring shut. Its water sinks away, and the ponds it kept go dry.'$tx6o$);
  if n <> 1 then raise exception 'perform_spring: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You pack the spring shut. Its water sinks away, and the ponds it kept go dry.'$tx6o$, $tx6n$'Spring stopped: its ponds drain.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('aqueduct_spring_says(uuid,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$v_go := 'along the aqueduct from ' || b.ax || ', ' || b.ay || ', ' || aqueduct_flow() || ' litres a minute';
  v_more := k || ' more pond' || case when k = 1 then '' else 's' end || ' below it, and from the last of those';$tx6o$, ''))) / length($tx6o$v_go := 'along the aqueduct from ' || b.ax || ', ' || b.ay || ', ' || aqueduct_flow() || ' litres a minute';
  v_more := k || ' more pond' || case when k = 1 then '' else 's' end || ' below it, and from the last of those';$tx6o$);
  if n <> 1 then raise exception 'aqueduct_spring_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_go := 'along the aqueduct from ' || b.ax || ', ' || b.ay || ', ' || aqueduct_flow() || ' litres a minute';
  v_more := k || ' more pond' || case when k = 1 then '' else 's' end || ' below it, and from the last of those';$tx6o$, $tx6n$v_go := 'along the aqueduct from ' || b.ax || ', ' || b.ay || ', ' || aqueduct_flow() || ' litres/min';
  v_more := k || ' more pond' || case when k = 1 then '' else 's' end || ' below, then from the last';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return case when k > 0 then 'Water wells up in the pool. It runs down into ' || v_more || ' ' || v_go || '.'
                else 'Water wells up in the pool. It goes ' || v_go || ', instead of over its edge.' end;$tx6o$, ''))) / length($tx6o$return case when k > 0 then 'Water wells up in the pool. It runs down into ' || v_more || ' ' || v_go || '.'
                else 'Water wells up in the pool. It goes ' || v_go || ', instead of over its edge.' end;$tx6o$);
  if n <> 1 then raise exception 'aqueduct_spring_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return case when k > 0 then 'Water wells up in the pool. It runs down into ' || v_more || ' ' || v_go || '.'
                else 'Water wells up in the pool. It goes ' || v_go || ', instead of over its edge.' end;$tx6o$, $tx6n$return case when k > 0 then 'Spring in the pool: flows into ' || v_more || ' ' || v_go || '.'
                else 'Spring in the pool: flows ' || v_go || ', not over its edge.' end;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_stand := 'Water wells up at the bottom of the hollow. It will stand '$tx6o$, ''))) / length($tx6o$v_stand := 'Water wells up at the bottom of the hollow. It will stand '$tx6o$);
  if n <> 1 then raise exception 'aqueduct_spring_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_stand := 'Water wells up at the bottom of the hollow. It will stand '$tx6o$, $tx6n$v_stand := 'Spring: pond '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return case when k > 0 then v_stand || ', then spill over the lowest point of its rim and run down into ' || v_more || ' ' || v_go || '.'
              else v_stand || ', then go ' || v_go || ', instead of over its rim.' end;$tx6o$, ''))) / length($tx6o$return case when k > 0 then v_stand || ', then spill over the lowest point of its rim and run down into ' || v_more || ' ' || v_go || '.'
              else v_stand || ', then go ' || v_go || ', instead of over its rim.' end;$tx6o$);
  if n <> 1 then raise exception 'aqueduct_spring_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return case when k > 0 then v_stand || ', then spill over the lowest point of its rim and run down into ' || v_more || ' ' || v_go || '.'
              else v_stand || ', then go ' || v_go || ', instead of over its rim.' end;$tx6o$, $tx6n$return case when k > 0 then v_stand || ', then spills over its rim into ' || v_more || ' ' || v_go || '.'
              else v_stand || ', then flows ' || v_go || ', not over its rim.' end;$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('store_unsettled_said()'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Only a store standing on a settlement can be one of its stores.'$tx6o$, ''))) / length($tx6o$'Only a store standing on a settlement can be one of its stores.'$tx6o$);
  if n <> 1 then raise exception 'store_unsettled_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Only a store standing on a settlement can be one of its stores.'$tx6o$, $tx6n$'Not on a settlement.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('store_markable_refusal(placed)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Only a crate or a piece of storage furniture can be a settlement store: not a stall, a trash crate, '$tx6o$, ''))) / length($tx6o$'Only a crate or a piece of storage furniture can be a settlement store: not a stall, a trash crate, '$tx6o$);
  if n <> 1 then raise exception 'store_markable_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Only a crate or a piece of storage furniture can be a settlement store: not a stall, a trash crate, '$tx6o$, $tx6n$'Settlement stores: crates and storage furniture only; not stalls, trash crates, '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'a mailbox, or anything driven, pulled or sailed.'$tx6o$, ''))) / length($tx6o$'a mailbox, or anything driven, pulled or sailed.'$tx6o$);
  if n <> 1 then raise exception 'store_markable_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'a mailbox, or anything driven, pulled or sailed.'$tx6o$, $tx6n$'mailboxes, or anything driven, pulled or sailed.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('store_refusal(uuid,uuid,deed,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$else 'The ' || p_what || ' is a store of ' || d.name
      || '. Only its founder and the citizens whose rank holds Use the stores may open it.' end$tx6o$, ''))) / length($tx6o$else 'The ' || p_what || ' is a store of ' || d.name
      || '. Only its founder and the citizens whose rank holds Use the stores may open it.' end$tx6o$);
  if n <> 1 then raise exception 'store_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$else 'The ' || p_what || ' is a store of ' || d.name
      || '. Only its founder and the citizens whose rank holds Use the stores may open it.' end$tx6o$, $tx6n$else upper(left(p_what, 1)) || substr(p_what, 2) || ': store of ' || d.name
      || '. Opens for its founder and ranks with Use the stores only.' end$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('store_move_said(text,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$select 'The ' || p_what || ' is a store of ' || p_deed
    || '. Only whoever set it down and its founder may move it or pick it up.'$tx6o$, ''))) / length($tx6o$select 'The ' || p_what || ' is a store of ' || p_deed
    || '. Only whoever set it down and its founder may move it or pick it up.'$tx6o$);
  if n <> 1 then raise exception 'store_move_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select 'The ' || p_what || ' is a store of ' || p_deed
    || '. Only whoever set it down and its founder may move it or pick it up.'$tx6o$, $tx6n$select upper(left(p_what, 1)) || substr(p_what, 2) || ': store of ' || p_deed
    || '. Only whoever set it down and its founder may move or pick it up.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('rpc_store_mark(uuid,text,bigint,boolean)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$return jsonb_build_object('why', 'The ' || v_what || ' is already a store of ' || v_d.name || '.');$tx6o$, ''))) / length($tx6o$return jsonb_build_object('why', 'The ' || v_what || ' is already a store of ' || v_d.name || '.');$tx6o$);
  if n <> 1 then raise exception 'rpc_store_mark: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return jsonb_build_object('why', 'The ' || v_what || ' is already a store of ' || v_d.name || '.');$tx6o$, $tx6n$return jsonb_build_object('why', upper(left(v_what, 1)) || substr(v_what, 2) || ': already a store of ' || v_d.name || '.');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return jsonb_build_object('why', 'The ' || v_what || ' is not a settlement store.');$tx6o$, ''))) / length($tx6o$return jsonb_build_object('why', 'The ' || v_what || ' is not a settlement store.');$tx6o$);
  if n <> 1 then raise exception 'rpc_store_mark: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return jsonb_build_object('why', 'The ' || v_what || ' is not a settlement store.');$tx6o$, $tx6n$return jsonb_build_object('why', upper(left(v_what, 1)) || substr(v_what, 2) || ': not a settlement store.');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('treasure_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'That is not a map.'$tx6o$, ''))) / length($tx6o$'That is not a map.'$tx6o$);
  if n <> 1 then raise exception 'treasure_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'That is not a map.'$tx6o$, $tx6n$'Not a map.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'The hide is worn blank. Whatever was drawn on it is gone.'$tx6o$, ''))) / length($tx6o$'The hide is worn blank. Whatever was drawn on it is gone.'$tx6o$);
  if n <> 1 then raise exception 'treasure_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The hide is worn blank. Whatever was drawn on it is gone.'$tx6o$, $tx6n$'Map is blank: its hoard is gone.'$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_treasure(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'The spade goes through rotten board and the hoard is open — '$tx6o$, ''))) / length($tx6o$'The spade goes through rotten board and the hoard is open — '$tx6o$);
  if n <> 1 then raise exception 'perform_treasure: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The spade goes through rotten board and the hoard is open — '$tx6o$, $tx6n$'Hoard opened: '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'Hoard opened: '
    || v_tier.lumps || ' lump' || case when v_tier.lumps = 1 then '' else 's' end
    || ' and ' || v_tier.things || ' thing' || case when v_tier.things = 1 then '' else 's' end
    || ' lying where they fell. And something was left to watch over it.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'Hoard opened: '
    || v_tier.lumps || ' lump' || case when v_tier.lumps = 1 then '' else 's' end
    || ' and ' || v_tier.things || ' thing' || case when v_tier.things = 1 then '' else 's' end
    || ' lying where they fell. And something was left to watch over it.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_treasure: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'Hoard opened: '
    || v_tier.lumps || ' lump' || case when v_tier.lumps = 1 then '' else 's' end
    || ' and ' || v_tier.things || ' thing' || case when v_tier.things = 1 then '' else 's' end
    || ' lying where they fell. And something was left to watch over it.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Hoard opened: '
    || v_tier.lumps || ' lump' || case when v_tier.lumps = 1 then '' else 's' end
    || ' and ' || v_tier.things || ' item' || case when v_tier.things = 1 then '' else 's' end
    || '. A guardian appears.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('rpc_treasure_warm(uuid,bigint)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'say', coalesce(v_why, 'The ground under your feet is the ground on the map.'));$tx6o$, ''))) / length($tx6o$'say', coalesce(v_why, 'The ground under your feet is the ground on the map.'));$tx6o$);
  if n <> 1 then raise exception 'rpc_treasure_warm: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'say', coalesce(v_why, 'The ground under your feet is the ground on the map.'));$tx6o$, $tx6n$'say', coalesce(v_why, 'On the spot: dig here.'));$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('bury_treasure(uuid,uuid,double precision,double precision,double precision)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'Oiled hide, folded small and waxed at the edge: a '
    || v_tier.name || '. (QL ' || to_char(p_ql, 'FM990.0')
    || ') Read it to see what country it is a picture of.', 'skill');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'Oiled hide, folded small and waxed at the edge: a '
    || v_tier.name || '. (QL ' || to_char(p_ql, 'FM990.0')
    || ') Read it to see what country it is a picture of.', 'skill');$tx6o$);
  if n <> 1 then raise exception 'bury_treasure: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'Oiled hide, folded small and waxed at the edge: a '
    || v_tier.name || '. (QL ' || to_char(p_ql, 'FM990.0')
    || ') Read it to see what country it is a picture of.', 'skill');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Found: '
    || v_tier.name || ', QL ' || to_char(p_ql, 'FM990.0')
    || '. Read it for the distance to its hoard.', 'skill');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('motes_word(integer,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$select case when p_n = 1 then case when p_element ~ '^[aeiou]' then 'an ' else 'a ' end || p_element || ' mote'
              else number_word(p_n) || ' ' || p_element || ' motes' end$tx6o$, ''))) / length($tx6o$select case when p_n = 1 then case when p_element ~ '^[aeiou]' then 'an ' else 'a ' end || p_element || ' mote'
              else number_word(p_n) || ' ' || p_element || ' motes' end$tx6o$);
  if n <> 1 then raise exception 'motes_word: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select case when p_n = 1 then case when p_element ~ '^[aeiou]' then 'an ' else 'a ' end || p_element || ' mote'
              else number_word(p_n) || ' ' || p_element || ' motes' end$tx6o$, $tx6n$select p_n || ' ' || p_element || ' mote' || case when p_n = 1 then '' else 's' end$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_swirl(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You collect ' || motes_word(v_n, s.element) || ' from the swirl, and it is gone.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You collect ' || motes_word(v_n, s.element) || ' from the swirl, and it is gone.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_swirl: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You collect ' || motes_word(v_n, s.element) || ' from the swirl, and it is gone.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Collected: ' || motes_word(v_n, s.element) || '. Swirl gone.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('rpc_treasure_map(uuid,bigint)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$return jsonb_build_object('why', 'The hide is worn blank.');$tx6o$, ''))) / length($tx6o$return jsonb_build_object('why', 'The hide is worn blank.');$tx6o$);
  if n <> 1 then raise exception 'rpc_treasure_map: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return jsonb_build_object('why', 'The hide is worn blank.');$tx6o$, $tx6n$return jsonb_build_object('why', 'Map is blank: its hoard is gone.');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('grapes_said(integer,double precision)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$return 'You pick ' || p_n || ' ' || lower((select d.name from item_def d where d.id = grape_item()))
    || case when p_n = 1 then '' else 's' end || ' off the vine. (QL ' || fixed_to(p_ql, 1) || ')';$tx6o$, ''))) / length($tx6o$return 'You pick ' || p_n || ' ' || lower((select d.name from item_def d where d.id = grape_item()))
    || case when p_n = 1 then '' else 's' end || ' off the vine. (QL ' || fixed_to(p_ql, 1) || ')';$tx6o$);
  if n <> 1 then raise exception 'grapes_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You pick ' || p_n || ' ' || lower((select d.name from item_def d where d.id = grape_item()))
    || case when p_n = 1 then '' else 's' end || ' off the vine. (QL ' || fixed_to(p_ql, 1) || ')';$tx6o$, $tx6n$return 'Picked: ' || p_n || ' ' || lower((select d.name from item_def d where d.id = grape_item()))
    || case when p_n = 1 then '' else 's' end || ', QL ' || fixed_to(p_ql, 1) || '.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('cut_vine_said(double precision)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$return 'You cut a ' || lower((select d.name from item_def d where d.id = grape_cutting_item()))
    || ' off the wild vine in the ' || lower(wild_vine()) || '. (QL ' || fixed_to(p_ql, 1) || ')';$tx6o$, ''))) / length($tx6o$return 'You cut a ' || lower((select d.name from item_def d where d.id = grape_cutting_item()))
    || ' off the wild vine in the ' || lower(wild_vine()) || '. (QL ' || fixed_to(p_ql, 1) || ')';$tx6o$);
  if n <> 1 then raise exception 'cut_vine_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You cut a ' || lower((select d.name from item_def d where d.id = grape_cutting_item()))
    || ' off the wild vine in the ' || lower(wild_vine()) || '. (QL ' || fixed_to(p_ql, 1) || ')';$tx6o$, $tx6n$return 'Cut: ' || lower((select d.name from item_def d where d.id = grape_cutting_item()))
    || ', QL ' || fixed_to(p_ql, 1) || '.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('flower_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Wildflowers grow on grass.'$tx6o$, ''))) / length($tx6o$'Wildflowers grow on grass.'$tx6o$);
  if n <> 1 then raise exception 'flower_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Wildflowers grow on grass.'$tx6o$, $tx6n$'Wildflowers grow on grass only.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Nothing flowers inside a building.'$tx6o$, ''))) / length($tx6o$'Nothing flowers inside a building.'$tx6o$);
  if n <> 1 then raise exception 'flower_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing flowers inside a building.'$tx6o$, $tx6n$'Not inside a building.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There are no flowers here.'$tx6o$, ''))) / length($tx6o$'There are no flowers here.'$tx6o$);
  if n <> 1 then raise exception 'flower_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There are no flowers here.'$tx6o$, $tx6n$'No flowers here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'Nothing is in flower in ' || v_season || ': wildflowers bloom in ' || flower_seasons_said() || '.';$tx6o$, ''))) / length($tx6o$return 'Nothing is in flower in ' || v_season || ': wildflowers bloom in ' || flower_seasons_said() || '.';$tx6o$);
  if n <> 1 then raise exception 'flower_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'Nothing is in flower in ' || v_season || ': wildflowers bloom in ' || flower_seasons_said() || '.';$tx6o$, $tx6n$return 'No flowers in ' || v_season || ': wildflowers bloom in ' || flower_seasons_said() || '.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The flowers here have been picked. Nothing flowers here again until spring.';$tx6o$, ''))) / length($tx6o$return 'The flowers here have been picked. Nothing flowers here again until spring.';$tx6o$);
  if n <> 1 then raise exception 'flower_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The flowers here have been picked. Nothing flowers here again until spring.';$tx6o$, $tx6n$return 'Already picked: flowers again in spring.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_flowers(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You pick '
    || case when v_n = 1 then 'a wildflower' else number_word(v_n) || ' wildflowers' end
    || '. Nothing flowers here again until spring.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You pick '
    || case when v_n = 1 then 'a wildflower' else number_word(v_n) || ' wildflowers' end
    || '. Nothing flowers here again until spring.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_flowers: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You pick '
    || case when v_n = 1 then 'a wildflower' else number_word(v_n) || ' wildflowers' end
    || '. Nothing flowers here again until spring.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Picked: ' || v_n
    || case when v_n = 1 then ' wildflower' else ' wildflowers' end
    || '. Flowers again in spring.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('skep_says(integer,text,double precision)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$v_rate := 'It is ' || p_season || ': the ' || v_s || ' makes nothing until '$tx6o$, ''))) / length($tx6o$v_rate := 'It is ' || p_season || ': the ' || v_s || ' makes nothing until '$tx6o$);
  if n <> 1 then raise exception 'skep_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_rate := 'It is ' || p_season || ': the ' || v_s || ' makes nothing until '$tx6o$, $tx6n$v_rate := upper(left(p_season, 1)) || substr(p_season, 2) || ': no honey until '$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_rate := 'No wildflowers are in flower within ' || skep_reach() || ' tiles of the ' || v_s
      || ' this ' || p_season || ': it makes nothing.';$tx6o$, ''))) / length($tx6o$v_rate := 'No wildflowers are in flower within ' || skep_reach() || ' tiles of the ' || v_s
      || ' this ' || p_season || ': it makes nothing.';$tx6o$);
  if n <> 1 then raise exception 'skep_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_rate := 'No wildflowers are in flower within ' || skep_reach() || ' tiles of the ' || v_s
      || ' this ' || p_season || ': it makes nothing.';$tx6o$, $tx6n$v_rate := 'No wildflowers within ' || skep_reach() || ' tiles'
      || ' this ' || p_season || ': no honey.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$v_rate := p_flowers || ' ' || case when p_flowers = 1 then 'clump' else 'clumps' end
      || ' of wildflowers within ' || skep_reach() || ' tiles this ' || p_season || ': it makes '
      || skep_rate_said(p_flowers, p_season) || ' ' || v_h || ' an hour, a ' || v_h || ' every '
      || skep_clump_hours() || ' hours for each clump.';$tx6o$, ''))) / length($tx6o$v_rate := p_flowers || ' ' || case when p_flowers = 1 then 'clump' else 'clumps' end
      || ' of wildflowers within ' || skep_reach() || ' tiles this ' || p_season || ': it makes '
      || skep_rate_said(p_flowers, p_season) || ' ' || v_h || ' an hour, a ' || v_h || ' every '
      || skep_clump_hours() || ' hours for each clump.';$tx6o$);
  if n <> 1 then raise exception 'skep_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v_rate := p_flowers || ' ' || case when p_flowers = 1 then 'clump' else 'clumps' end
      || ' of wildflowers within ' || skep_reach() || ' tiles this ' || p_season || ': it makes '
      || skep_rate_said(p_flowers, p_season) || ' ' || v_h || ' an hour, a ' || v_h || ' every '
      || skep_clump_hours() || ' hours for each clump.';$tx6o$, $tx6n$v_rate := 'Wildflowers within ' || skep_reach() || ' tiles: ' || p_flowers || ' ' || case when p_flowers = 1 then 'clump' else 'clumps' end
      || '. Rate: '
      || skep_rate_said(p_flowers, p_season) || ' ' || v_h || '/hour (1 per '
      || skep_clump_hours() || ' hours per clump).';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return v_rate || ' In it: ' || v_honey || ' ' || v_h || ' and ' || floor(v_honey::double precision / skep_wax_every())::int
    || ' ' || v_w || ', of the ' || skep_holds() || ' ' || v_h || ' it holds (a ' || v_w || ' for every '
    || skep_wax_every() || ' ' || v_h || ').';$tx6o$, ''))) / length($tx6o$return v_rate || ' In it: ' || v_honey || ' ' || v_h || ' and ' || floor(v_honey::double precision / skep_wax_every())::int
    || ' ' || v_w || ', of the ' || skep_holds() || ' ' || v_h || ' it holds (a ' || v_w || ' for every '
    || skep_wax_every() || ' ' || v_h || ').';$tx6o$);
  if n <> 1 then raise exception 'skep_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return v_rate || ' In it: ' || v_honey || ' ' || v_h || ' and ' || floor(v_honey::double precision / skep_wax_every())::int
    || ' ' || v_w || ', of the ' || skep_holds() || ' ' || v_h || ' it holds (a ' || v_w || ' for every '
    || skep_wax_every() || ' ' || v_h || ').';$tx6o$, $tx6n$return v_rate || ' In it: ' || v_honey || '/' || skep_holds() || ' ' || v_h || ', ' || floor(v_honey::double precision / skep_wax_every())::int
    || ' ' || v_w || ' (1 ' || v_w || ' per '
    || skep_wax_every() || ' ' || v_h || ').';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('skep_took_said(integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$return 'You take ' || p_honey || ' ' || skep_word('honey')
    || case when p_wax > 0 then ' and ' || p_wax || ' ' || skep_word('wax') else '' end
    || ' from the ' || skep_word(skep_kind()) || '. It starts filling again from empty.';$tx6o$, ''))) / length($tx6o$return 'You take ' || p_honey || ' ' || skep_word('honey')
    || case when p_wax > 0 then ' and ' || p_wax || ' ' || skep_word('wax') else '' end
    || ' from the ' || skep_word(skep_kind()) || '. It starts filling again from empty.';$tx6o$);
  if n <> 1 then raise exception 'skep_took_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You take ' || p_honey || ' ' || skep_word('honey')
    || case when p_wax > 0 then ' and ' || p_wax || ' ' || skep_word('wax') else '' end
    || ' from the ' || skep_word(skep_kind()) || '. It starts filling again from empty.';$tx6o$, $tx6n$return 'Took: ' || p_honey || ' ' || skep_word('honey')
    || case when p_wax > 0 then ', ' || p_wax || ' ' || skep_word('wax') else '' end
    || '. ' || upper(left(skep_word(skep_kind()), 1)) || substr(skep_word(skep_kind()), 2) || ' empty.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('chart_square(integer,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$select 'the ' || (p_r * 2 + 1) || ' by ' || (p_r * 2 + 1) || ' tiles round ' || p_x || ', ' || p_y$tx6o$, ''))) / length($tx6o$select 'the ' || (p_r * 2 + 1) || ' by ' || (p_r * 2 + 1) || ' tiles round ' || p_x || ', ' || p_y$tx6o$);
  if n <> 1 then raise exception 'chart_square: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$select 'the ' || (p_r * 2 + 1) || ' by ' || (p_r * 2 + 1) || ' tiles round ' || p_x || ', ' || p_y$tx6o$, $tx6n$select (p_r * 2 + 1) || '×' || (p_r * 2 + 1) || ' tiles round ' || p_x || ', ' || p_y$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('chart_item_says(text,text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$' It holds ' || chart_square(c[1], c[2], c[3]) || ', ' || c[3] || ' each way from where it was drawn. Study it and all '
    || ((c[3] * 2 + 1) * (c[3] * 2 + 1)) || ' of them go on your own map.' end$tx6o$, ''))) / length($tx6o$' It holds ' || chart_square(c[1], c[2], c[3]) || ', ' || c[3] || ' each way from where it was drawn. Study it and all '
    || ((c[3] * 2 + 1) * (c[3] * 2 + 1)) || ' of them go on your own map.' end$tx6o$);
  if n <> 1 then raise exception 'chart_item_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$' It holds ' || chart_square(c[1], c[2], c[3]) || ', ' || c[3] || ' each way from where it was drawn. Study it and all '
    || ((c[3] * 2 + 1) * (c[3] * 2 + 1)) || ' of them go on your own map.' end$tx6o$, $tx6n$' Map: ' || chart_square(c[1], c[2], c[3]) || '. Study it to add all '
    || ((c[3] * 2 + 1) * (c[3] * 2 + 1)) || ' tiles to your map.' end$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('chart_done_said(text,integer,integer,integer,double precision)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$when 'draw_map' then 'You draw ' || chart_square(p_x, p_y, p_r) || ' onto the sheet. (QL ' || chart_ql_text(p_ql)
      || ', ' || p_r || ' tiles each way)'
    when 'study_map' then 'You study the map: ' || chart_square(p_x, p_y, p_r) || ' are on your own map now.'
    else 'You copy the map onto a fresh sheet: ' || chart_square(p_x, p_y, p_r) || '. (QL ' || chart_ql_text(p_ql)
      || ', ' || p_r || ' tiles each way)' end$tx6o$, ''))) / length($tx6o$when 'draw_map' then 'You draw ' || chart_square(p_x, p_y, p_r) || ' onto the sheet. (QL ' || chart_ql_text(p_ql)
      || ', ' || p_r || ' tiles each way)'
    when 'study_map' then 'You study the map: ' || chart_square(p_x, p_y, p_r) || ' are on your own map now.'
    else 'You copy the map onto a fresh sheet: ' || chart_square(p_x, p_y, p_r) || '. (QL ' || chart_ql_text(p_ql)
      || ', ' || p_r || ' tiles each way)' end$tx6o$);
  if n <> 1 then raise exception 'chart_done_said: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$when 'draw_map' then 'You draw ' || chart_square(p_x, p_y, p_r) || ' onto the sheet. (QL ' || chart_ql_text(p_ql)
      || ', ' || p_r || ' tiles each way)'
    when 'study_map' then 'You study the map: ' || chart_square(p_x, p_y, p_r) || ' are on your own map now.'
    else 'You copy the map onto a fresh sheet: ' || chart_square(p_x, p_y, p_r) || '. (QL ' || chart_ql_text(p_ql)
      || ', ' || p_r || ' tiles each way)' end$tx6o$, $tx6n$when 'draw_map' then 'Drawn: ' || chart_square(p_x, p_y, p_r) || ', QL ' || chart_ql_text(p_ql)
      || '.'
    when 'study_map' then 'Studied: ' || chart_square(p_x, p_y, p_r) || ' added to your map.'
    else 'Copied: ' || chart_square(p_x, p_y, p_r) || ', QL ' || chart_ql_text(p_ql)
      || '.' end$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('stones_refusal(uuid,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Stepping stones stand on the bottom of the water, not on a poured slab.'$tx6o$, ''))) / length($tx6o$'Stepping stones stand on the bottom of the water, not on a poured slab.'$tx6o$);
  if n <> 1 then raise exception 'stones_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Stepping stones stand on the bottom of the water, not on a poured slab.'$tx6o$, $tx6n$'Not on a poured slab.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Stepping stones are laid here already.'$tx6o$, ''))) / length($tx6o$'Stepping stones are laid here already.'$tx6o$);
  if n <> 1 then raise exception 'stones_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Stepping stones are laid here already.'$tx6o$, $tx6n$'Stepping stones already here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Stepping stones are laid across water: the edge of the sea, a pond, or where a stream runs.'$tx6o$, ''))) / length($tx6o$'Stepping stones are laid across water: the edge of the sea, a pond, or where a stream runs.'$tx6o$);
  if n <> 1 then raise exception 'stones_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Stepping stones are laid across water: the edge of the sea, a pond, or where a stream runs.'$tx6o$, $tx6n$'Stepping stones go in water: sea edge, pond or stream.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Stepping stones go on bare ground or what grows flat on it. Clear what stands or is laid here first.'$tx6o$, ''))) / length($tx6o$'Stepping stones go on bare ground or what grows flat on it. Clear what stands or is laid here first.'$tx6o$);
  if n <> 1 then raise exception 'stones_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Stepping stones go on bare ground or what grows flat on it. Clear what stands or is laid here first.'$tx6o$, $tx6n$'Stepping stones need bare ground or flat growth: clear the tile first.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'The water here is too deep. A stepping stone stands on the bottom only where it is '
        || metres(stones_depth()) || ' m deep or less.';$tx6o$, ''))) / length($tx6o$return 'The water here is too deep. A stepping stone stands on the bottom only where it is '
        || metres(stones_depth()) || ' m deep or less.';$tx6o$);
  if n <> 1 then raise exception 'stones_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'The water here is too deep. A stepping stone stands on the bottom only where it is '
        || metres(stones_depth()) || ' m deep or less.';$tx6o$, $tx6n$return 'Too deep: stepping stones need water '
        || metres(stones_depth()) || ' m deep or less.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$if v_kind is not null then return 'A ' || water_plant_word(v_kind) || ' grows here. Pull it up first.'; end if;$tx6o$, ''))) / length($tx6o$if v_kind is not null then return 'A ' || water_plant_word(v_kind) || ' grows here. Pull it up first.'; end if;$tx6o$);
  if n <> 1 then raise exception 'stones_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$if v_kind is not null then return 'A ' || water_plant_word(v_kind) || ' grows here. Pull it up first.'; end if;$tx6o$, $tx6n$if v_kind is not null then return 'Pull up the ' || water_plant_word(v_kind) || ' first.'; end if;$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('plant_refusal(uuid,text,integer,integer)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Stepping stones are laid here.'$tx6o$, ''))) / length($tx6o$'Stepping stones are laid here.'$tx6o$);
  if n <> 1 then raise exception 'plant_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Stepping stones are laid here.'$tx6o$, $tx6n$'Stepping stones here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'A ' || v_name || ' is planted in still water: a pond, a pool or the shallows of the sea.';$tx6o$, ''))) / length($tx6o$return 'A ' || v_name || ' is planted in still water: a pond, a pool or the shallows of the sea.';$tx6o$);
  if n <> 1 then raise exception 'plant_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'A ' || v_name || ' is planted in still water: a pond, a pool or the shallows of the sea.';$tx6o$, $tx6n$return upper(left(v_name, 1)) || substr(v_name, 2) || ': needs still water (pond, pool or sea shallows).';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$if water_runs(p_world, p_x, p_y) then return 'The water runs here. A ' || v_name || ' takes root only in still water.'; end if;$tx6o$, ''))) / length($tx6o$if water_runs(p_world, p_x, p_y) then return 'The water runs here. A ' || v_name || ' takes root only in still water.'; end if;$tx6o$);
  if n <> 1 then raise exception 'plant_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$if water_runs(p_world, p_x, p_y) then return 'The water runs here. A ' || v_name || ' takes root only in still water.'; end if;$tx6o$, $tx6n$if water_runs(p_world, p_x, p_y) then return upper(left(v_name, 1)) || substr(v_name, 2) || ': needs still water, not running.'; end if;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'A ' || v_name || ' takes root where the water is ' || metres(water_plant_shallowest())$tx6o$, ''))) / length($tx6o$return 'A ' || v_name || ' takes root where the water is ' || metres(water_plant_shallowest())$tx6o$);
  if n <> 1 then raise exception 'plant_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'A ' || v_name || ' takes root where the water is ' || metres(water_plant_shallowest())$tx6o$, $tx6n$return upper(left(v_name, 1)) || substr(v_name, 2) || ': needs water ' || metres(water_plant_shallowest())$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$if v_kind is not null then return 'A ' || water_plant_word(v_kind) || ' grows here already.'; end if;$tx6o$, ''))) / length($tx6o$if v_kind is not null then return 'A ' || water_plant_word(v_kind) || ' grows here already.'; end if;$tx6o$);
  if n <> 1 then raise exception 'plant_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$if v_kind is not null then return 'A ' || water_plant_word(v_kind) || ' grows here already.'; end if;$tx6o$, $tx6n$if v_kind is not null then return 'Already planted: ' || water_plant_word(v_kind) || '.'; end if;$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('pick_refusal(uuid,integer,integer,timestamp with time zone)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Nothing is planted here.'$tx6o$, ''))) / length($tx6o$'Nothing is planted here.'$tx6o$);
  if n <> 1 then raise exception 'pick_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing is planted here.'$tx6o$, $tx6n$'Nothing planted here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'Its water is gone. It lies in the mud until the water comes back.'$tx6o$, ''))) / length($tx6o$'Its water is gone. It lies in the mud until the water comes back.'$tx6o$);
  if n <> 1 then raise exception 'pick_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Its water is gone. It lies in the mud until the water comes back.'$tx6o$, $tx6n$'No water: dormant until it returns.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'It has not rooted yet. A ' || v_name || ' roots ' || water_rooting_said() || ' after it is planted.';$tx6o$, ''))) / length($tx6o$return 'It has not rooted yet. A ' || v_name || ' roots ' || water_rooting_said() || ' after it is planted.';$tx6o$);
  if n <> 1 then raise exception 'pick_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'It has not rooted yet. A ' || v_name || ' roots ' || water_rooting_said() || ' after it is planted.';$tx6o$, $tx6n$return 'Not rooted yet: roots ' || water_rooting_said() || ' after planting.';$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$if v_state[4] = 'none' then return 'A ' || v_name || ' ' || water_year_says(w.kind) || ', and it is ' || v_state[1] || ' now.'; end if;$tx6o$, ''))) / length($tx6o$if v_state[4] = 'none' then return 'A ' || v_name || ' ' || water_year_says(w.kind) || ', and it is ' || v_state[1] || ' now.'; end if;$tx6o$);
  if n <> 1 then raise exception 'pick_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$if v_state[4] = 'none' then return 'A ' || v_name || ' ' || water_year_says(w.kind) || ', and it is ' || v_state[1] || ' now.'; end if;$tx6o$, $tx6n$if v_state[4] = 'none' then return upper(left(v_name, 1)) || substr(v_name, 2) || ': ' || water_year_says(w.kind) || '. Now: ' || v_state[1] || '.'; end if;$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'Its ' || case when v_state[4] = 'seed' then 'seed head was' else 'flower was' end
        || ' picked this ' || v_state[1] || '. There is no other until the season turns.';$tx6o$, ''))) / length($tx6o$return 'Its ' || case when v_state[4] = 'seed' then 'seed head was' else 'flower was' end
        || ' picked this ' || v_state[1] || '. There is no other until the season turns.';$tx6o$);
  if n <> 1 then raise exception 'pick_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'Its ' || case when v_state[4] = 'seed' then 'seed head was' else 'flower was' end
        || ' picked this ' || v_state[1] || '. There is no other until the season turns.';$tx6o$, $tx6n$return case when v_state[4] = 'seed' then 'Seed head' else 'Flower' end
        || ' already picked this ' || v_state[1] || '. Next one next season.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('water_garden_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'Nothing is planted here.'$tx6o$, ''))) / length($tx6o$'Nothing is planted here.'$tx6o$);
  if n <> 1 then raise exception 'water_garden_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'Nothing is planted here.'$tx6o$, $tx6n$'Nothing planted here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need a trowel to set a stone.'$tx6o$, ''))) / length($tx6o$'You need a trowel to set a stone.'$tx6o$);
  if n <> 1 then raise exception 'water_garden_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need a trowel to set a stone.'$tx6o$, $tx6n$'Need a trowel.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'You need a cut slab to break into stepping stones.'$tx6o$, ''))) / length($tx6o$'You need a cut slab to break into stepping stones.'$tx6o$);
  if n <> 1 then raise exception 'water_garden_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'You need a cut slab to break into stepping stones.'$tx6o$, $tx6n$'Need a cut stone slab.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$'There are no stepping stones here.'$tx6o$, ''))) / length($tx6o$'There are no stepping stones here.'$tx6o$);
  if n <> 1 then raise exception 'water_garden_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'There are no stepping stones here.'$tx6o$, $tx6n$'No stepping stones here.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$return 'You have no ' || lower((select i.name from item_def i join water_plant_def w on w.from_item = i.id where w.id = v_kind))
          || ' to plant.';$tx6o$, ''))) / length($tx6o$return 'You have no ' || lower((select i.name from item_def i join water_plant_def w on w.from_item = i.id where w.id = v_kind))
          || ' to plant.';$tx6o$);
  if n <> 1 then raise exception 'water_garden_refusal: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$return 'You have no ' || lower((select i.name from item_def i join water_plant_def w on w.from_item = i.id where w.id = v_kind))
          || ' to plant.';$tx6o$, $tx6n$return 'Need ' || lower((select i.name from item_def i join water_plant_def w on w.from_item = i.id where w.id = v_kind))
          || '.';$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('perform_water_garden(uuid,uuid,text,jsonb)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$'The stone rocks on the bottom however you set it. You leave it for now.'$tx6o$, ''))) / length($tx6o$'The stone rocks on the bottom however you set it. You leave it for now.'$tx6o$);
  if n <> 1 then raise exception 'perform_water_garden: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$'The stone rocks on the bottom however you set it. You leave it for now.'$tx6o$, $tx6n$'Stepping stones failed: slab kept.'$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You break the ' || lower((select name from item_def where id = v_slab.def))
      || ' into flat stones and set them on the bottom, a stride apart.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You break the ' || lower((select name from item_def where id = v_slab.def))
      || ' into flat stones and set them on the bottom, a stride apart.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_water_garden: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You break the ' || lower((select name from item_def where id = v_slab.def))
      || ' into flat stones and set them on the bottom, a stride apart.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Stepping stones laid: ' || lower((select name from item_def where id = v_slab.def))
      || ' used.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You lift the stones out of the water, a '
      || lower((select i.name from item_def i join slab_def s on s.item = i.id where s.id = v_kind))
      || '''s worth. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You lift the stones out of the water, a '
      || lower((select i.name from item_def i join slab_def s on s.item = i.id where s.id = v_kind))
      || '''s worth. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_water_garden: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You lift the stones out of the water, a '
      || lower((select i.name from item_def i join slab_def s on s.item = i.id where s.id = v_kind))
      || '''s worth. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Stepping stones removed. Got: '
      || lower((select i.name from item_def i join slab_def s on s.item = i.id where s.id = v_kind))
      || ', QL ' || to_char(v_ql, 'FM990.0') || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You press the ' || lower((select name from item_def where id = pd.from_item))
      || ' into the mud under the water. It will root in ' || water_rooting_said() || '.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You press the ' || lower((select name from item_def where id = pd.from_item))
      || ' into the mud under the water. It will root in ' || water_rooting_said() || '.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_water_garden: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You press the ' || lower((select name from item_def where id = pd.from_item))
      || ' into the mud under the water. It will root in ' || water_rooting_said() || '.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Planted: ' || lower((select name from item_def where id = pd.from_item))
      || '. Roots in ' || water_rooting_said() || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You break the ' || lower(pd.name) || ' seed head open: ' || number_word(pd.seed_count)
        || ' ' || lower((select name from item_def where id = pd.seed_item)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You break the ' || lower(pd.name) || ' seed head open: ' || number_word(pd.seed_count)
        || ' ' || lower((select name from item_def where id = pd.seed_item)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_water_garden: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You break the ' || lower(pd.name) || ' seed head open: ' || number_word(pd.seed_count)
        || ' ' || lower((select name from item_def where id = pd.seed_item)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Picked: ' || lower(pd.name) || ' seed head. Got ' || pd.seed_count
        || ' ' || lower((select name from item_def where id = pd.seed_item)) || ', QL ' || to_char(v_ql, 'FM990.0') || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You pick a ' || lower((select name from item_def where id = pd.flower_item))
        || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You pick a ' || lower((select name from item_def where id = pd.flower_item))
        || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_water_garden: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You pick a ' || lower((select name from item_def where id = pd.flower_item))
        || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Picked: ' || lower((select name from item_def where id = pd.flower_item))
        || ', QL ' || to_char(v_ql, 'FM990.0') || '.', 'event');$tx6n$);
  n := (length(v) - length(replace(v, $tx6o$perform tell(p_world, p_uid, 'You pull up the ' || lower(pd.name) || ', root and all.', 'event');$tx6o$, ''))) / length($tx6o$perform tell(p_world, p_uid, 'You pull up the ' || lower(pd.name) || ', root and all.', 'event');$tx6o$);
  if n <> 1 then raise exception 'perform_water_garden: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$perform tell(p_world, p_uid, 'You pull up the ' || lower(pd.name) || ', root and all.', 'event');$tx6o$, $tx6n$perform tell(p_world, p_uid, 'Pulled up: ' || lower(pd.name) || '.', 'event');$tx6n$);
  execute v;
end $do$;

do $do$
declare v text; n int;
begin
  v := pg_get_functiondef('water_year_says(text)'::regprocedure);
  n := (length(v) - length(replace(v, $tx6o$v := 'flowers in ' || list_of(d.flowers);
  if cardinality(d.seeds) > 0 then v := list_of(array[v, 'carries its seed heads in ' || list_of(d.seeds)]); end if;$tx6o$, ''))) / length($tx6o$v := 'flowers in ' || list_of(d.flowers);
  if cardinality(d.seeds) > 0 then v := list_of(array[v, 'carries its seed heads in ' || list_of(d.seeds)]); end if;$tx6o$);
  if n <> 1 then raise exception 'water_year_says: % of an anchor, not 1', n; end if;
  v := replace(v, $tx6o$v := 'flowers in ' || list_of(d.flowers);
  if cardinality(d.seeds) > 0 then v := list_of(array[v, 'carries its seed heads in ' || list_of(d.seeds)]); end if;$tx6o$, $tx6n$v := 'flowers: ' || array_to_string(d.flowers, ', ');
  if cardinality(d.seeds) > 0 then v := v || '; seed heads: ' || array_to_string(d.seeds, ', '); end if;$tx6n$);
  execute v;
end $do$;

select private.lock_doors();
