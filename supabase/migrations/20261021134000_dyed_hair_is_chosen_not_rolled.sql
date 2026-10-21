-- Dyed hair: blue, purple, pink and the rest, to choose in the creator; a look rolled at random never comes with it.
--
-- Asked for: "add additional fun hues to character hair color choices such as blue, purple, pink." The colours
-- reach the island as look options through the definitions, with the list of dyed ones (`dyed_hair()`); here
-- `look_random` leaves those out of a rolled look's hair colour, as the browser's `randomLook` does.

set local lock_timeout = '3s';

create or replace function look_random() returns jsonb language sql as $fn$
  select coalesce(jsonb_object_agg(k, (
    select o.id from look_option o where o.kind = k
      and not (k = 'hairColour' and o.id = any(dyed_hair()))
    order by md5(gen_random_uuid()::text) limit 1)), '{}'::jsonb)
  from unnest(look_kinds()) k
$fn$;

select private.lock_doors();
