-- Nine more ancient baubles: coppice, pruning, butchery, shearing, orchard, vineyard, tapping, reeds and botany.
--
-- Each adds `ancient_plus()` times its rarity to every yield of its job, as the six before them do: the rows are
-- `bauble_ancient`'s (the definitions migration after this one, from `ANCIENT_EFFECTS`), and `bauble_roll`,
-- `bauble_read`, `bauble_text` and `bauble_yield` read that table, so they take the nine as they stand. Every one of
-- the nine jobs gives what it gives through `gather`, which is where `bauble_yield` adds it.
--
-- What is here: a trellis vine picked (`pick_grapes`) counts as a bush harvested (`harvest_bush`) for the vineyard
-- bauble, as a patch harvest counts as a harvest and a shovel filled as a dig (`BAUBLE_JOB_AS`).

set local lock_timeout = '3s';

create or replace function public.bauble_plus(p_world uuid, p_uid uuid, p_action text)
 returns integer
 language sql
 stable
as $function$
  select coalesce((select round(bauble_sum(p_world, p_uid, 'plus', a.id))::int
                     from bauble_ancient a
                    -- A Farmer's patch harvest is so many harvests, a shovel filled off a bed is a dig, and a trellis
                    -- vine picked is a bush harvested.
                    where a.action = case p_action when 'harvest_patch' then 'harvest_crop' when 'collect' then 'dig'
                                                   when 'pick_grapes' then 'harvest_bush' else p_action end), 0)
$function$;

select private.lock_doors();
