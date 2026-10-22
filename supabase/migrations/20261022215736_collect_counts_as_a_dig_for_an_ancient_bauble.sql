-- Collect counts as a dig for an ancient bauble.
--
-- Reported: an ancient bauble for digging, "+1 output per dig", set in Solara's altar, gave nothing on Collect: a
-- shovel filled off a bed of sand, clay, peat or tar is its own job (`collect`), and `bauble_plus` matched the job's id
-- to the bauble's and found no `collect`. A shovel filled is a dig now, as a patch harvest is a harvest, on both sides
-- (`BAUBLE_JOB_AS`); the bauble says so (`bauble_ancient.said`, from the snapshot before this one).

set local lock_timeout = '3s';

create or replace function public.bauble_plus(p_world uuid, p_uid uuid, p_action text)
 returns integer
 language sql
 stable
as $function$
  select coalesce((select round(bauble_sum(p_world, p_uid, 'plus', a.id))::int
                     from bauble_ancient a
                    -- A Farmer's patch harvest is so many harvests, and a shovel filled off a bed is a dig.
                    where a.action = case p_action when 'harvest_patch' then 'harvest_crop' when 'collect' then 'dig' else p_action end), 0)
$function$;

select private.lock_doors();
