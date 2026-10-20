-- What a craft, a store, a crate, a fire, a smelter, a kiln and an anvil say, in the browser's new words.
--
-- Asked for: "Review all game text for cryptic AI talk. We dont need 'a boat under oars'. Just say 'boat row speed'.
-- We want no prose." The browser's lines for these (`recipes.ts`, `furniture.ts`, `crates.ts`, `items.ts`,
-- `campfire.ts`, `smelter.ts`, `kiln.ts`, `anvil.ts`) are now labels with their numbers: "Made: 3 × plank, pine,
-- QL 23.4.", "Fuelled: 2 × coal. Fuel: 12 minutes.", "Need 4 planks.". The island says each of them in the same
-- words. Nothing a rule does changes: only what is said.
--
-- A craft's line is now built off the go itself rather than off the recipe's `done` (`craft_made_said`, the
-- browser's `madeSaid`): how many of what, the material and the QL, then the recipe's note on what to do with it,
-- which is all `done` holds now. A failed go says what failed and what was lost, off the recipe (`fail`, filled by
-- the definitions); a recipe's own narration of the failure is gone.
--
-- The functions written whole here are short ones that are nothing but their words; the rest are patched where
-- they speak, each anchor asserted to be there once.

set local lock_timeout = '3s';

-- The first letter up, as the browser's `capital` has it.
create or replace function initcap_first(p text) returns text language sql immutable as $fn$
  select case when p is null or p = '' then p else upper(left(p, 1)) || substr(p, 2) end
$fn$;

-- A craft's line: "Made: 3 × plank, pine, QL 23.4." and the recipe's note (`madeSaid`).
create or replace function craft_made_said(p_result text, p_n int, p_mat text, p_ql double precision, p_note text)
returns text language sql stable as $fn$
  select 'Made: ' || case when p_n > 1 then p_n || ' × ' else '' end
    || lower(coalesce((select d.name from item_def d where d.id = p_result), p_result))
    || case when coalesce(p_mat, '') <> '' then ', ' || lower(p_mat) else '' end
    || ', QL ' || to_char(p_ql, 'FM990.0') || '.'
    || case when coalesce(p_note, '') <> '' then ' ' || p_note else '' end
$fn$;

-- What a put says (`storedLine`).
create or replace function stored_line(p_count integer, p_what text, p_where text, p_left integer)
returns text language sql immutable as $fn$
  select 'Stored: ' || p_count || ' × ' || lower(p_what) || ' in ' || lower(p_where) || '.'
    || case when p_left > 0 then ' ' || p_left || ' did not fit.' else '' end
$fn$;

-- What a load of a rack says (`rackPutLine`).
create or replace function rack_put_line(p_put integer, p_want integer, p_what text, p_crates integer, p_one text, p_rack text)
returns text language sql immutable as $fn$
  select 'Stored: ' || case when p_put = p_want then p_put::text else p_put || ' of ' || p_want end || ' × '
    || lower(p_what) || ' in '
    || case when p_crates = 1 then lower(p_one) else p_crates || ' crates' end
    || ' on ' || lower(p_rack) || '.'
    || case when p_want > p_put then ' ' || (p_want - p_put) || ' did not fit.' else '' end
$fn$;

-- Why a bag will not take something (`bagRefuses`).
create or replace function bag_refuses(p_bag item, p_def text, p_count integer)
returns text language sql stable as $fn$
  select case
    when not is_bag(p_bag.def) then initcap_first(lower((select name from item_def where id = p_bag.def))) || ': not a container.'
    when is_bag(p_def) then 'No bags inside bags.'
    -- An Artisan's amphora: food and drink, and one kind of it at a time.
    when (select one_kind from item_def where id = p_bag.def)
         and coalesce((select category from item_def where id = p_def), '') <> 'food' then
      initcap_first(lower((select name from item_def where id = p_bag.def))) || ': food and drink only.'
    when (select one_kind from item_def where id = p_bag.def)
         and exists (select 1 from item i where i.inside = p_bag.id and i.holder = 'bag' and i.def <> p_def) then
      initcap_first(lower((select name from item_def where id = p_bag.def))) || ': one kind at a time; holds '
        || lower((select d.name from item i join item_def d on d.id = i.def
                   where i.inside = p_bag.id and i.holder = 'bag' order by i.id limit 1)) || '.'
    when bag_units(p_bag.id) + p_count > bag_room(p_bag) then
      initcap_first(lower((select name from item_def where id = p_bag.def))) || ' full.'
    end
$fn$;

-- Why nothing mends an unrestored relic (`NOT_RESTORED`).
create or replace function not_restored_says() returns text language sql immutable as $fn$
  select 'Not restored: cannot be repaired. Gone if it breaks first.'::text
$fn$;

-- Why a team is not yoked a storey up (`tracesStoreyRefusal`).
create or replace function traces_storey_refusal(p placed) returns text language sql stable as $fn$
  select case when coalesce(p.level, 0) > 0
              then 'Bring the ' || lower(placed_name(p)) || ' to the ground floor first: teams yoke and unyoke on the ground only.'
         end
$fn$;

-- What the five restricted stores say to the rest (`TAKES`).
create or replace function furniture_takes(p_takes text, p_def text) returns text language sql stable as $fn$
  select case p_takes
    when 'raw' then case when item_raw(p_def) then null else
      'Raw material bin: raw materials only (ore, logs, dirt, shards, wool).' end
    when 'worked' then case when item_worked(p_def) then null else
      'Craft material bin: worked materials only (planks, nails, ribbons, hinges).' end
    when 'food' then case when (select d.category = 'food' or coalesce(d.larder, false)
                                  from item_def d where d.id = p_def) then null else
      'Larder: food, drink, flour, dough and cornmeal only.' end
    when 'seed' then case when exists (select 1 from crop_def c where c.seed = p_def) then null else
      'Seed bin: seeds only.' end
    when 'sprout' then case when p_def = 'sprout' then null else
      'Sprout bin: sprouts only.' end
    end
$fn$;

-- Why a piece will not take something (`furnitureRefuses`).
create or replace function furniture_refuses(p placed, p_def text) returns text language sql stable as $fn$
  select case
    when holds_liquid(p) then d.name || ': liquids only.'
    when d.hive is not null then d.name || ': take only; nothing goes in.'
    when d.pond is not null then d.name || ': take fish only; nothing goes in.'
    when not furniture_holds(p) then d.name || ': holds nothing.'
    when p_def = 'creature_crate' and not coalesce(d.stall, false)
      then 'Creature crates go on a stall only.'
    else furniture_takes(d.takes, p_def)
    end
  from furniture_def d
  where d.id = p.sub
$fn$;

-- perform_craft: its words, as the browser now says them.
do $do$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef('public.perform_craft(uuid, uuid, text, jsonb)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, $tx$then 'The claw goes over too far and the silver is spoiled, but you have the stone out whole.'$tx$, ''))) / length($tx$then 'The claw goes over too far and the silver is spoiled, but you have the stone out whole.'$tx$);
  if v_n <> 1 then raise exception 'perform_craft: % of the anchor %, wanted one', v_n, 'then ''The claw goes over too far and the silver is spoiled, '; end if;
  v_def := replace(v_def, $tx$then 'The claw goes over too far and the silver is spoiled, but you have the stone out whole.'$tx$, $tx$then 'Failed: focus. Silver lost; gem kept.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$else coalesce(r.fail, 'You fail to make ' || lower($tx$, ''))) / length($tx$else coalesce(r.fail, 'You fail to make ' || lower($tx$);
  if v_n <> 1 then raise exception 'perform_craft: % of the anchor %, wanted one', v_n, 'else coalesce(r.fail, ''You fail to make '' || lower('; end if;
  v_def := replace(v_def, $tx$else coalesce(r.fail, 'You fail to make ' || lower($tx$, $tx$else coalesce(r.fail, 'Failed: ' || lower($tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'Nothing that went into it is lost.'$tx$, ''))) / length($tx$'Nothing that went into it is lost.'$tx$);
  if v_n <> 1 then raise exception 'perform_craft: % of the anchor %, wanted one', v_n, '''Nothing that went into it is lost.'''; end if;
  v_def := replace(v_def, $tx$'Nothing that went into it is lost.'$tx$, $tx$'Nothing Wasted: inputs kept.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'There is enough left in the bucket for another.'$tx$, ''))) / length($tx$'There is enough left in the bucket for another.'$tx$);
  if v_n <> 1 then raise exception 'perform_craft: % of the anchor %, wanted one', v_n, '''There is enough left in the bucket for another.'''; end if;
  v_def := replace(v_def, $tx$'There is enough left in the bucket for another.'$tx$, $tx$'Lye Saver: bucket not used up.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$perform tell(p_world, p_uid, 'You save '$tx$, ''))) / length($tx$perform tell(p_world, p_uid, 'You save '$tx$);
  if v_n <> 1 then raise exception 'perform_craft: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You save '''; end if;
  v_def := replace(v_def, $tx$perform tell(p_world, p_uid, 'You save '$tx$, $tx$perform tell(p_world, p_uid, 'Frugal Cook: '$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$|| ' from the pot.', 'event');$tx$, ''))) / length($tx$|| ' from the pot.', 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_craft: % of the anchor %, wanted one', v_n, '|| '' from the pot.'', ''event'');'; end if;
  v_def := replace(v_def, $tx$|| ' from the pot.', 'event');$tx$, $tx$|| ' kept.', 'event');$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$  perform tell(p_world, p_uid, count_said(r.done, r.count, v_base) || ' (' || case when mat is not null then lower(mat) || ', ' else '' end
    || 'QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx$, ''))) / length($tx$  perform tell(p_world, p_uid, count_said(r.done, r.count, v_base) || ' (' || case when mat is not null then lower(mat) || ', ' else '' end
    || 'QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_craft: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, count_said(r.done, r.count, v_b'; end if;
  v_def := replace(v_def, $tx$  perform tell(p_world, p_uid, count_said(r.done, r.count, v_base) || ' (' || case when mat is not null then lower(mat) || ', ' else '' end
    || 'QL ' || to_char(made_ql, 'FM990.0') || ')', 'event');$tx$, $tx$  perform tell(p_world, p_uid, craft_made_said(r.result, v_base, mat, made_ql, r.done), 'event');$tx$);
  execute v_def;
end $do$;

-- craft_refusal: its words, as the browser now says them.
do $do$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef('public.craft_refusal(uuid, uuid, text, bigint)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, $tx$'That wants a Cook who has learned to make broth.'$tx$, ''))) / length($tx$'That wants a Cook who has learned to make broth.'$tx$);
  if v_n <> 1 then raise exception 'craft_refusal: % of the anchor %, wanted one', v_n, '''That wants a Cook who has learned to make broth.'''; end if;
  v_def := replace(v_def, $tx$'That wants a Cook who has learned to make broth.'$tx$, $tx$'Need perk: Broth (Cook).'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'That wants a Cook who has learned to distil.'$tx$, ''))) / length($tx$'That wants a Cook who has learned to distil.'$tx$);
  if v_n <> 1 then raise exception 'craft_refusal: % of the anchor %, wanted one', v_n, '''That wants a Cook who has learned to distil.'''; end if;
  v_def := replace(v_def, $tx$'That wants a Cook who has learned to distil.'$tx$, $tx$'Need perk: Distil (Cook).'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'That wants a Tailor who has learned to make a tent.'$tx$, ''))) / length($tx$'That wants a Tailor who has learned to make a tent.'$tx$);
  if v_n <> 1 then raise exception 'craft_refusal: % of the anchor %, wanted one', v_n, '''That wants a Tailor who has learned to make a tent.'''; end if;
  v_def := replace(v_def, $tx$'That wants a Tailor who has learned to make a tent.'$tx$, $tx$'Need perk: Tent (Tailor).'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'That wants a Naturalist who has learned to make herb tea.'$tx$, ''))) / length($tx$'That wants a Naturalist who has learned to make herb tea.'$tx$);
  if v_n <> 1 then raise exception 'craft_refusal: % of the anchor %, wanted one', v_n, '''That wants a Naturalist who has learned to make herb tea.'''; end if;
  v_def := replace(v_def, $tx$'That wants a Naturalist who has learned to make herb tea.'$tx$, $tx$'Need perk: Herb Tea (Naturalist).'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'That wants a Naturalist who has learned to make a salve.'$tx$, ''))) / length($tx$'That wants a Naturalist who has learned to make a salve.'$tx$);
  if v_n <> 1 then raise exception 'craft_refusal: % of the anchor %, wanted one', v_n, '''That wants a Naturalist who has learned to make a salve.'''; end if;
  v_def := replace(v_def, $tx$'That wants a Naturalist who has learned to make a salve.'$tx$, $tx$'Need perk: Salve (Naturalist).'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'That wants a Naturalist who has learned to make a tincture.'$tx$, ''))) / length($tx$'That wants a Naturalist who has learned to make a tincture.'$tx$);
  if v_n <> 1 then raise exception 'craft_refusal: % of the anchor %, wanted one', v_n, '''That wants a Naturalist who has learned to make a tincture.'; end if;
  v_def := replace(v_def, $tx$'That wants a Naturalist who has learned to make a tincture.'$tx$, $tx$'Need perk: Tincture (Naturalist).'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'That wants a Fisher who has learned to smoke fish.'$tx$, ''))) / length($tx$'That wants a Fisher who has learned to smoke fish.'$tx$);
  if v_n <> 1 then raise exception 'craft_refusal: % of the anchor %, wanted one', v_n, '''That wants a Fisher who has learned to smoke fish.'''; end if;
  v_def := replace(v_def, $tx$'That wants a Fisher who has learned to smoke fish.'$tx$, $tx$'Need perk: Smoke Fish (Fisher).'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'That wants a Fisher who has learned to make a fish pond.'$tx$, ''))) / length($tx$'That wants a Fisher who has learned to make a fish pond.'$tx$);
  if v_n <> 1 then raise exception 'craft_refusal: % of the anchor %, wanted one', v_n, '''That wants a Fisher who has learned to make a fish pond.'''; end if;
  v_def := replace(v_def, $tx$'That wants a Fisher who has learned to make a fish pond.'$tx$, $tx$'Need perk: Fish Pond (Fisher).'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'That wants a Mender who has learned to make a repair kit.'$tx$, ''))) / length($tx$'That wants a Mender who has learned to make a repair kit.'$tx$);
  if v_n <> 1 then raise exception 'craft_refusal: % of the anchor %, wanted one', v_n, '''That wants a Mender who has learned to make a repair kit.'''; end if;
  v_def := replace(v_def, $tx$'That wants a Mender who has learned to make a repair kit.'$tx$, $tx$'Need perk: Repair Kit (Mender).'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'That wants a Mender who has learned to make sealant.'$tx$, ''))) / length($tx$'That wants a Mender who has learned to make sealant.'$tx$);
  if v_n <> 1 then raise exception 'craft_refusal: % of the anchor %, wanted one', v_n, '''That wants a Mender who has learned to make sealant.'''; end if;
  v_def := replace(v_def, $tx$'That wants a Mender who has learned to make sealant.'$tx$, $tx$'Need perk: Sealant (Mender).'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'That wants an Artisan who has learned to make a circlet.'$tx$, ''))) / length($tx$'That wants an Artisan who has learned to make a circlet.'$tx$);
  if v_n <> 1 then raise exception 'craft_refusal: % of the anchor %, wanted one', v_n, '''That wants an Artisan who has learned to make a circlet.'''; end if;
  v_def := replace(v_def, $tx$'That wants an Artisan who has learned to make a circlet.'$tx$, $tx$'Need perk: Circlet (Artisan).'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'That wants an Artisan who has learned to shape an amphora.'$tx$, ''))) / length($tx$'That wants an Artisan who has learned to shape an amphora.'$tx$);
  if v_n <> 1 then raise exception 'craft_refusal: % of the anchor %, wanted one', v_n, '''That wants an Artisan who has learned to shape an amphora.'''; end if;
  v_def := replace(v_def, $tx$'That wants an Artisan who has learned to shape an amphora.'$tx$, $tx$'Need perk: Amphora (Artisan).'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'That wants an Artisan who has learned to build a potter''s wheel.'$tx$, ''))) / length($tx$'That wants an Artisan who has learned to build a potter''s wheel.'$tx$);
  if v_n <> 1 then raise exception 'craft_refusal: % of the anchor %, wanted one', v_n, '''That wants an Artisan who has learned to build a potter''''s '; end if;
  v_def := replace(v_def, $tx$'That wants an Artisan who has learned to build a potter''s wheel.'$tx$, $tx$'Need perk: Potter''s Wheel (Artisan).'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'That wants an Artisan who has learned to write a trade book.'$tx$, ''))) / length($tx$'That wants an Artisan who has learned to write a trade book.'$tx$);
  if v_n <> 1 then raise exception 'craft_refusal: % of the anchor %, wanted one', v_n, '''That wants an Artisan who has learned to write a trade book'; end if;
  v_def := replace(v_def, $tx$'That wants an Artisan who has learned to write a trade book.'$tx$, $tx$'Need perk: Trade Book (Artisan).'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$      return 'You know too little of ' || lower((select s.name from skill_def s where s.id = substr(p_recipe, 18)))
        || ' to write a book on it: that wants ' || trade_book_at() || '.';$tx$, ''))) / length($tx$      return 'You know too little of ' || lower((select s.name from skill_def s where s.id = substr(p_recipe, 18)))
        || ' to write a book on it: that wants ' || trade_book_at() || '.';$tx$);
  if v_n <> 1 then raise exception 'craft_refusal: % of the anchor %, wanted one', v_n, 'return ''You know too little of '' || lower((select s.name fro'; end if;
  v_def := replace(v_def, $tx$      return 'You know too little of ' || lower((select s.name from skill_def s where s.id = substr(p_recipe, 18)))
        || ' to write a book on it: that wants ' || trade_book_at() || '.';$tx$, $tx$      return 'Need ' || lower((select s.name from skill_def s where s.id = substr(p_recipe, 18)))
        || ' ' || trade_book_at() || '.';$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$    return 'You need a ' || lower((select coalesce(name, r.tool) from item_def where id = r.tool)) || '.';$tx$, ''))) / length($tx$    return 'You need a ' || lower((select coalesce(name, r.tool) from item_def where id = r.tool)) || '.';$tx$);
  if v_n <> 1 then raise exception 'craft_refusal: % of the anchor %, wanted one', v_n, 'return ''You need a '' || lower((select coalesce(name, r.tool)'; end if;
  v_def := replace(v_def, $tx$    return 'You need a ' || lower((select coalesce(name, r.tool) from item_def where id = r.tool)) || '.';$tx$, $tx$    return 'Need ' || case when lower((select coalesce(name, r.tool) from item_def where id = r.tool)) ~ '^[aeiou]' then 'an ' else 'a ' end
      || lower((select coalesce(name, r.tool) from item_def where id = r.tool)) || '.';$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$    return 'You need to stand at a ' || station_name(r.station) || '.';$tx$, ''))) / length($tx$    return 'You need to stand at a ' || station_name(r.station) || '.';$tx$);
  if v_n <> 1 then raise exception 'craft_refusal: % of the anchor %, wanted one', v_n, 'return ''You need to stand at a '' || station_name(r.station) '; end if;
  v_def := replace(v_def, $tx$    return 'You need to stand at a ' || station_name(r.station) || '.';$tx$, $tx$    return 'Need: ' || station_name(r.station) || '.';$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'You can only build this standing on a settlement of yours.'$tx$, ''))) / length($tx$'You can only build this standing on a settlement of yours.'$tx$);
  if v_n <> 1 then raise exception 'craft_refusal: % of the anchor %, wanted one', v_n, '''You can only build this standing on a settlement of yours.'''; end if;
  v_def := replace(v_def, $tx$'You can only build this standing on a settlement of yours.'$tx$, $tx$'Build only on a settlement of yours.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'This settlement already has an altar, and a settlement may have only one.'$tx$, ''))) / length($tx$'This settlement already has an altar, and a settlement may have only one.'$tx$);
  if v_n <> 1 then raise exception 'craft_refusal: % of the anchor %, wanted one', v_n, '''This settlement already has an altar, and a settlement may '; end if;
  v_def := replace(v_def, $tx$'This settlement already has an altar, and a settlement may have only one.'$tx$, $tx$'Settlement already has an altar; one per settlement.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$      return (select coalesce(name, r.result) from item_def where id = r.result)
        || ' takes ' || recipe_need(p_world, p_uid, p_recipe, i.count) || ' '$tx$, ''))) / length($tx$      return (select coalesce(name, r.result) from item_def where id = r.result)
        || ' takes ' || recipe_need(p_world, p_uid, p_recipe, i.count) || ' '$tx$);
  if v_n <> 1 then raise exception 'craft_refusal: % of the anchor %, wanted one', v_n, 'return (select coalesce(name, r.result) from item_def where '; end if;
  v_def := replace(v_def, $tx$      return (select coalesce(name, r.result) from item_def where id = r.result)
        || ' takes ' || recipe_need(p_world, p_uid, p_recipe, i.count) || ' '$tx$, $tx$      return 'Need ' || recipe_need(p_world, p_uid, p_recipe, i.count) || ' '$tx$);
  execute v_def;
end $do$;

-- fire_refusal: its words, as the browser now says them.
do $do$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef('public.fire_refusal(uuid, uuid, text, jsonb)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, $tx$'You can only set this down on a settlement of yours.'$tx$, ''))) / length($tx$'You can only set this down on a settlement of yours.'$tx$);
  if v_n <> 1 then raise exception 'fire_refusal: % of the anchor %, wanted one', v_n, '''You can only set this down on a settlement of yours.'''; end if;
  v_def := replace(v_def, $tx$'You can only set this down on a settlement of yours.'$tx$, $tx$'Set down only on a settlement of yours.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'This settlement already has an altar, and a settlement may have only one.'$tx$, ''))) / length($tx$'This settlement already has an altar, and a settlement may have only one.'$tx$);
  if v_n <> 1 then raise exception 'fire_refusal: % of the anchor %, wanted one', v_n, '''This settlement already has an altar, and a settlement may '; end if;
  v_def := replace(v_def, $tx$'This settlement already has an altar, and a settlement may have only one.'$tx$, $tx$'Settlement already has an altar; one per settlement.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'It is already burning.'$tx$, ''))) / length($tx$'It is already burning.'$tx$);
  if v_n <> 1 then raise exception 'fire_refusal: % of the anchor %, wanted one', v_n, '''It is already burning.'''; end if;
  v_def := replace(v_def, $tx$'It is already burning.'$tx$, $tx$'Already lit.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'There is nothing left to burn. Feed it some wood.'$tx$, ''))) / length($tx$'There is nothing left to burn. Feed it some wood.'$tx$);
  if v_n <> 1 then raise exception 'fire_refusal: % of the anchor %, wanted one', v_n, '''There is nothing left to burn. Feed it some wood.'''; end if;
  v_def := replace(v_def, $tx$'There is nothing left to burn. Feed it some wood.'$tx$, $tx$'No fuel.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$return 'Fires take ' || fuel_said() || '.';$tx$, ''))) / length($tx$return 'Fires take ' || fuel_said() || '.';$tx$);
  if v_n <> 1 then raise exception 'fire_refusal: % of the anchor %, wanted one', v_n, 'return ''Fires take '' || fuel_said() || ''.'';'; end if;
  v_def := replace(v_def, $tx$return 'Fires take ' || fuel_said() || '.';$tx$, $tx$return 'Need fuel: ' || fuel_said() || '.';$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'It is already piled as high as it will take.'$tx$, ''))) / length($tx$'It is already piled as high as it will take.'$tx$);
  if v_n <> 1 then raise exception 'fire_refusal: % of the anchor %, wanted one', v_n, '''It is already piled as high as it will take.'''; end if;
  v_def := replace(v_def, $tx$'It is already piled as high as it will take.'$tx$, $tx$'Fuel full.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'There are no ashes worth taking yet.'$tx$, ''))) / length($tx$'There are no ashes worth taking yet.'$tx$);
  if v_n <> 1 then raise exception 'fire_refusal: % of the anchor %, wanted one', v_n, '''There are no ashes worth taking yet.'''; end if;
  v_def := replace(v_def, $tx$'There are no ashes worth taking yet.'$tx$, $tx$'No ashes yet.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'Something is in the way of turning it.'$tx$, ''))) / length($tx$'Something is in the way of turning it.'$tx$);
  if v_n <> 1 then raise exception 'fire_refusal: % of the anchor %, wanted one', v_n, '''Something is in the way of turning it.'''; end if;
  v_def := replace(v_def, $tx$'Something is in the way of turning it.'$tx$, $tx$'Blocked.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'There are people aboard her.'$tx$, ''))) / length($tx$'There are people aboard her.'$tx$);
  if v_n < 1 then raise exception 'fire_refusal: % of the anchor %, wanted some', v_n, '''There are people aboard her.'''; end if;
  v_def := replace(v_def, $tx$'There are people aboard her.'$tx$, $tx$'Passengers aboard.'$tx$);
  execute v_def;
end $do$;

-- furniture_turn_reason: its words, as the browser now says them.
do $do$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef('public.furniture_turn_reason(placed)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, $tx$'Something is in the way of turning it.'$tx$, ''))) / length($tx$'Something is in the way of turning it.'$tx$);
  if v_n <> 1 then raise exception 'furniture_turn_reason: % of the anchor %, wanted one', v_n, '''Something is in the way of turning it.'''; end if;
  v_def := replace(v_def, $tx$'Something is in the way of turning it.'$tx$, $tx$'Blocked.'$tx$);
  execute v_def;
end $do$;

-- perform_fire: its words, as the browser now says them.
do $do$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef('public.perform_fire(uuid, uuid, text, jsonb)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, $tx$'You lay a campfire from 2 shafts. Light it, or feed it more wood first.'$tx$, ''))) / length($tx$'You lay a campfire from 2 shafts. Light it, or feed it more wood first.'$tx$);
  if v_n <> 1 then raise exception 'perform_fire: % of the anchor %, wanted one', v_n, '''You lay a campfire from 2 shafts. Light it, or feed it more'; end if;
  v_def := replace(v_def, $tx$'You lay a campfire from 2 shafts. Light it, or feed it more wood first.'$tx$, $tx$'Campfire built: 2 × shaft. Unlit.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$    perform tell(p_world, p_uid, 'You set the ' ||
      lower(coalesce((select name from furniture_def where id = sub),
        case when p_action = 'place_kiln' then 'kiln' else 'smelter' end)) || ' down'
      || coalesce(' with ' || (select c.name from creature c where p_action = 'place_furniture'
                                 and c.world_id = p_world and c.id = it.creature) || ' in it', '')$tx$, ''))) / length($tx$    perform tell(p_world, p_uid, 'You set the ' ||
      lower(coalesce((select name from furniture_def where id = sub),
        case when p_action = 'place_kiln' then 'kiln' else 'smelter' end)) || ' down'
      || coalesce(' with ' || (select c.name from creature c where p_action = 'place_furniture'
                                 and c.world_id = p_world and c.id = it.creature) || ' in it', '')$tx$);
  if v_n <> 1 then raise exception 'perform_fire: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You set the '' ||'; end if;
  v_def := replace(v_def, $tx$    perform tell(p_world, p_uid, 'You set the ' ||
      lower(coalesce((select name from furniture_def where id = sub),
        case when p_action = 'place_kiln' then 'kiln' else 'smelter' end)) || ' down'
      || coalesce(' with ' || (select c.name from creature c where p_action = 'place_furniture'
                                 and c.world_id = p_world and c.id = it.creature) || ' in it', '')$tx$, $tx$    perform tell(p_world, p_uid, 'Set down: ' ||
      lower(coalesce((select name from furniture_def where id = sub),
        case when p_action = 'place_kiln' then 'kiln' else 'smelter' end))
      || coalesce(', with ' || (select c.name from creature c where p_action = 'place_furniture'
                                 and c.world_id = p_world and c.id = it.creature), '')$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$    perform tell(p_world, p_uid, 'The kindling catches and the ' || p.kind || ' burns. It has '
      || burns_for(p.fuel / placed_burn_rate(p)) || ' of fuel.', 'event');$tx$, ''))) / length($tx$    perform tell(p_world, p_uid, 'The kindling catches and the ' || p.kind || ' burns. It has '
      || burns_for(p.fuel / placed_burn_rate(p)) || ' of fuel.', 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_fire: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''The kindling catches and the '''; end if;
  v_def := replace(v_def, $tx$    perform tell(p_world, p_uid, 'The kindling catches and the ' || p.kind || ' burns. It has '
      || burns_for(p.fuel / placed_burn_rate(p)) || ' of fuel.', 'event');$tx$, $tx$    perform tell(p_world, p_uid, 'Lit: ' || p.kind || '. Fuel: '
      || burns_for(p.fuel / placed_burn_rate(p)) || '.', 'event');$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$    perform tell(p_world, p_uid, case p_action
        when 'damp_smelter' then 'You damp the smelter down.'
        when 'damp_kiln' then 'You close the kiln down and let it cool.'
        else 'You smother the fire.' end
      || ' Its ' || burns_for(p.fuel / placed_burn_rate(p)) || ' of fuel keeps for later.', 'event');$tx$, ''))) / length($tx$    perform tell(p_world, p_uid, case p_action
        when 'damp_smelter' then 'You damp the smelter down.'
        when 'damp_kiln' then 'You close the kiln down and let it cool.'
        else 'You smother the fire.' end
      || ' Its ' || burns_for(p.fuel / placed_burn_rate(p)) || ' of fuel keeps for later.', 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_fire: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, case p_action'; end if;
  v_def := replace(v_def, $tx$    perform tell(p_world, p_uid, case p_action
        when 'damp_smelter' then 'You damp the smelter down.'
        when 'damp_kiln' then 'You close the kiln down and let it cool.'
        else 'You smother the fire.' end
      || ' Its ' || burns_for(p.fuel / placed_burn_rate(p)) || ' of fuel keeps for later.', 'event');$tx$, $tx$    perform tell(p_world, p_uid, 'Put out: ' || p.kind
      || '. Fuel kept: ' || burns_for(p.fuel / placed_burn_rate(p)) || '.', 'event');$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$    perform tell(p_world, p_uid, 'You feed ' || case when fits > 1 then fits || ' × ' else 'a ' end
      || lower((select name from item_def where id = it.def)) || ' to the fire. '
      || burns_for(least(fire_capacity(), p.fuel + per * fits) / placed_burn_rate(p)) || ' of fuel.', 'event');$tx$, ''))) / length($tx$    perform tell(p_world, p_uid, 'You feed ' || case when fits > 1 then fits || ' × ' else 'a ' end
      || lower((select name from item_def where id = it.def)) || ' to the fire. '
      || burns_for(least(fire_capacity(), p.fuel + per * fits) / placed_burn_rate(p)) || ' of fuel.', 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_fire: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You feed '' || case when fits >'; end if;
  v_def := replace(v_def, $tx$    perform tell(p_world, p_uid, 'You feed ' || case when fits > 1 then fits || ' × ' else 'a ' end
      || lower((select name from item_def where id = it.def)) || ' to the fire. '
      || burns_for(least(fire_capacity(), p.fuel + per * fits) / placed_burn_rate(p)) || ' of fuel.', 'event');$tx$, $tx$    perform tell(p_world, p_uid, 'Fuelled: ' || case when fits > 1 then fits || ' × ' else '' end
      || lower((select name from item_def where id = it.def)) || '. Fuel: '
      || burns_for(least(fire_capacity(), p.fuel + per * fits) / placed_burn_rate(p)) || '.', 'event');$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$    perform tell(p_world, p_uid, 'You rake ' || whole || case when whole = 1 then ' lot' else ' lots' end
      || ' of ashes out of the ' || p.kind || '. (QL 20)', 'event');$tx$, ''))) / length($tx$    perform tell(p_world, p_uid, 'You rake ' || whole || case when whole = 1 then ' lot' else ' lots' end
      || ' of ashes out of the ' || p.kind || '. (QL 20)', 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_fire: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You rake '' || whole || case wh'; end if;
  v_def := replace(v_def, $tx$    perform tell(p_world, p_uid, 'You rake ' || whole || case when whole = 1 then ' lot' else ' lots' end
      || ' of ashes out of the ' || p.kind || '. (QL 20)', 'event');$tx$, $tx$    perform tell(p_world, p_uid, 'Raked out: ' || whole || ' × ashes, QL 20.', 'event');$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'You take the campfire apart and save what will burn again.'$tx$, ''))) / length($tx$'You take the campfire apart and save what will burn again.'$tx$);
  if v_n <> 1 then raise exception 'perform_fire: % of the anchor %, wanted one', v_n, '''You take the campfire apart and save what will burn again.'''; end if;
  v_def := replace(v_def, $tx$'You take the campfire apart and save what will burn again.'$tx$, $tx$'Taken apart: campfire. Recovered: 2 × shaft.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$    perform tell(p_world, p_uid, 'You turn the ' || lower(placed_name(p)) || ' to face ' || side_name(back) || '.', 'event');$tx$, ''))) / length($tx$    perform tell(p_world, p_uid, 'You turn the ' || lower(placed_name(p)) || ' to face ' || side_name(back) || '.', 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_fire: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You turn the '' || lower(placed'; end if;
  v_def := replace(v_def, $tx$    perform tell(p_world, p_uid, 'You turn the ' || lower(placed_name(p)) || ' to face ' || side_name(back) || '.', 'event');$tx$, $tx$    perform tell(p_world, p_uid, 'Turned: ' || lower(placed_name(p)) || ', facing ' || side_name(back) || '.', 'event');$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$    perform tell(p_world, p_uid, 'You take up the '
      || lower(coalesce((select name from furniture_def where id = p.sub), p.sub, p.kind))
      || coalesce(' with ' || (select c.name from creature c where c.world_id = p_world and c.id = p.creature) || ' in it', '')$tx$, ''))) / length($tx$    perform tell(p_world, p_uid, 'You take up the '
      || lower(coalesce((select name from furniture_def where id = p.sub), p.sub, p.kind))
      || coalesce(' with ' || (select c.name from creature c where c.world_id = p_world and c.id = p.creature) || ' in it', '')$tx$);
  if v_n <> 1 then raise exception 'perform_fire: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You take up the '''; end if;
  v_def := replace(v_def, $tx$    perform tell(p_world, p_uid, 'You take up the '
      || lower(coalesce((select name from furniture_def where id = p.sub), p.sub, p.kind))
      || coalesce(' with ' || (select c.name from creature c where c.world_id = p_world and c.id = p.creature) || ' in it', '')$tx$, $tx$    perform tell(p_world, p_uid, 'Picked up: '
      || lower(coalesce((select name from furniture_def where id = p.sub), p.sub, p.kind))
      || coalesce(', with ' || (select c.name from creature c where c.world_id = p_world and c.id = p.creature), '')$tx$);
  execute v_def;
end $do$;

-- perform_firing: its words, as the browser now says them.
do $do$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef('public.perform_firing(uuid, uuid, text, jsonb)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, $tx$    perform tell(p_world, p_uid, case when p_action = 'kiln_take_all' then 'You unpack ' else 'You draw ' end
      || array_to_string(v_names, ', ')
      || case when p_action = 'kiln_take_all' then ' from the kiln.' else ' from the smelter.' end, 'event');$tx$, ''))) / length($tx$    perform tell(p_world, p_uid, case when p_action = 'kiln_take_all' then 'You unpack ' else 'You draw ' end
      || array_to_string(v_names, ', ')
      || case when p_action = 'kiln_take_all' then ' from the kiln.' else ' from the smelter.' end, 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_firing: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, case when p_action = ''kiln_take'; end if;
  v_def := replace(v_def, $tx$    perform tell(p_world, p_uid, case when p_action = 'kiln_take_all' then 'You unpack ' else 'You draw ' end
      || array_to_string(v_names, ', ')
      || case when p_action = 'kiln_take_all' then ' from the kiln.' else ' from the smelter.' end, 'event');$tx$, $tx$    perform tell(p_world, p_uid, case when p_action = 'kiln_take_all' then 'Taken from kiln: ' else 'Taken from smelter: ' end
      || array_to_string(v_names, ', ') || '.', 'event');$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$    perform tell(p_world, p_uid, 'You charge the smelter with '
      || (v_n * ore_per_lump()::int) || ' × '
      || lower((select name from item_def where id = v_it.def))
      || case when v_n > 1 then ', ' || v_n || ' charges of it' else '' end
      || '. Each charge is about ' || round(v_secs) || ' seconds of heat and comes out as one lump.', 'event');$tx$, ''))) / length($tx$    perform tell(p_world, p_uid, 'You charge the smelter with '
      || (v_n * ore_per_lump()::int) || ' × '
      || lower((select name from item_def where id = v_it.def))
      || case when v_n > 1 then ', ' || v_n || ' charges of it' else '' end
      || '. Each charge is about ' || round(v_secs) || ' seconds of heat and comes out as one lump.', 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_firing: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You charge the smelter with '''; end if;
  v_def := replace(v_def, $tx$    perform tell(p_world, p_uid, 'You charge the smelter with '
      || (v_n * ore_per_lump()::int) || ' × '
      || lower((select name from item_def where id = v_it.def))
      || case when v_n > 1 then ', ' || v_n || ' charges of it' else '' end
      || '. Each charge is about ' || round(v_secs) || ' seconds of heat and comes out as one lump.', 'event');$tx$, $tx$    perform tell(p_world, p_uid, 'Charged: '
      || (v_n * ore_per_lump()::int) || ' × '
      || lower((select name from item_def where id = v_it.def))
      || case when v_n > 1 then ', ' || v_n || ' charges' else '' end
      || '. Per charge: about ' || round(v_secs) || ' seconds of heat, one lump.', 'event');$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$    perform tell(p_world, p_uid, 'You put ' || case when v_n > 1 then v_n || ' × ' else 'the ' end
      || made_name(v_it.def, v_it.piece) || ' into the smelter to melt down.'
      || ' It will come back as ' || v_need || ' ' || lower(v_metal.name) || ' lump'
      || case when v_need > 1 then 's' else '' end || ', at about ' || round(v_ql) || ' quality.', 'event');$tx$, ''))) / length($tx$    perform tell(p_world, p_uid, 'You put ' || case when v_n > 1 then v_n || ' × ' else 'the ' end
      || made_name(v_it.def, v_it.piece) || ' into the smelter to melt down.'
      || ' It will come back as ' || v_need || ' ' || lower(v_metal.name) || ' lump'
      || case when v_need > 1 then 's' else '' end || ', at about ' || round(v_ql) || ' quality.', 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_firing: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You put '' || case when v_n > 1'; end if;
  v_def := replace(v_def, $tx$    perform tell(p_world, p_uid, 'You put ' || case when v_n > 1 then v_n || ' × ' else 'the ' end
      || made_name(v_it.def, v_it.piece) || ' into the smelter to melt down.'
      || ' It will come back as ' || v_need || ' ' || lower(v_metal.name) || ' lump'
      || case when v_need > 1 then 's' else '' end || ', at about ' || round(v_ql) || ' quality.', 'event');$tx$, $tx$    perform tell(p_world, p_uid, 'Melting: ' || case when v_n > 1 then v_n || ' × ' else '' end
      || made_name(v_it.def, v_it.piece) || '.'
      || ' Gives ' || v_need || ' × ' || lower(v_metal.name) || ' lump, about QL ' || round(v_ql) || '.', 'event');$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$    perform tell(p_world, p_uid, 'You pack '
      || case when v_n > 1 then v_n || ' × ' else '' end
      || lower((select name from item_def where id = v_it.def))
      || ' into the kiln. Each needs about ' || round(v_secs) || ' seconds of heat.', 'event');$tx$, ''))) / length($tx$    perform tell(p_world, p_uid, 'You pack '
      || case when v_n > 1 then v_n || ' × ' else '' end
      || lower((select name from item_def where id = v_it.def))
      || ' into the kiln. Each needs about ' || round(v_secs) || ' seconds of heat.', 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_firing: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You pack '''; end if;
  v_def := replace(v_def, $tx$    perform tell(p_world, p_uid, 'You pack '
      || case when v_n > 1 then v_n || ' × ' else '' end
      || lower((select name from item_def where id = v_it.def))
      || ' into the kiln. Each needs about ' || round(v_secs) || ' seconds of heat.', 'event');$tx$, $tx$    perform tell(p_world, p_uid, 'Packed: '
      || case when v_n > 1 then v_n || ' × ' else '' end
      || lower((select name from item_def where id = v_it.def))
      || '. About ' || round(v_secs) || ' seconds of heat each.', 'event');$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$    perform tell(p_world, p_uid, 'You pour ' || v_need || ' lumps of ' || lower(v_metal.name)
      || ' into the anvil mould. It needs about ' || round(v_secs) || ' seconds to cool.', 'event');$tx$, ''))) / length($tx$    perform tell(p_world, p_uid, 'You pour ' || v_need || ' lumps of ' || lower(v_metal.name)
      || ' into the anvil mould. It needs about ' || round(v_secs) || ' seconds to cool.', 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_firing: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You pour '' || v_need || '' lump'; end if;
  v_def := replace(v_def, $tx$    perform tell(p_world, p_uid, 'You pour ' || v_need || ' lumps of ' || lower(v_metal.name)
      || ' into the anvil mould. It needs about ' || round(v_secs) || ' seconds to cool.', 'event');$tx$, $tx$    perform tell(p_world, p_uid, 'Poured: ' || v_need || ' × ' || lower(v_metal.name)
      || ' lump into the anvil mould. Cools in about ' || round(v_secs) || ' seconds.', 'event');$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$    perform tell(p_world, p_uid, 'You pour '
      || case when v_need > 1 then v_need || ' lumps' else 'a lump' end
      || ' of ' || lower(v_metal.name) || ' into the ' || lower(d.name)
      || '. It needs about ' || round(v_secs) || ' seconds to cool.'
      || case when v_broke then ' The mould cracks through and is done.'
              else ' The mould has ' || mould_uses_left(v_mould.ql, v_mould.dmg + v_wear, mark_of(v_mould.mark, 'last'))
                   || ' fillings left.' end, 'event');$tx$, ''))) / length($tx$    perform tell(p_world, p_uid, 'You pour '
      || case when v_need > 1 then v_need || ' lumps' else 'a lump' end
      || ' of ' || lower(v_metal.name) || ' into the ' || lower(d.name)
      || '. It needs about ' || round(v_secs) || ' seconds to cool.'
      || case when v_broke then ' The mould cracks through and is done.'
              else ' The mould has ' || mould_uses_left(v_mould.ql, v_mould.dmg + v_wear, mark_of(v_mould.mark, 'last'))
                   || ' fillings left.' end, 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_firing: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You pour '''; end if;
  v_def := replace(v_def, $tx$    perform tell(p_world, p_uid, 'You pour '
      || case when v_need > 1 then v_need || ' lumps' else 'a lump' end
      || ' of ' || lower(v_metal.name) || ' into the ' || lower(d.name)
      || '. It needs about ' || round(v_secs) || ' seconds to cool.'
      || case when v_broke then ' The mould cracks through and is done.'
              else ' The mould has ' || mould_uses_left(v_mould.ql, v_mould.dmg + v_wear, mark_of(v_mould.mark, 'last'))
                   || ' fillings left.' end, 'event');$tx$, $tx$    perform tell(p_world, p_uid, 'Poured: ' || v_need || ' × '
      || lower(v_metal.name) || ' lump into the ' || lower(d.name)
      || '. Cools in about ' || round(v_secs) || ' seconds.'
      || case when v_broke then ' Mould broken.'
              else ' Mould: ' || mould_uses_left(v_mould.ql, v_mould.dmg + v_wear, mark_of(v_mould.mark, 'last'))
                   || ' fillings left.' end, 'event');$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$    perform tell(p_world, p_uid, 'You pour ' || ingot_lumps() || ' lumps of ' || lower(v_metal.name)
      || ' into an ingot. (QL ' || to_char(v_bar.ql, 'FM990.0') || ')', 'event');$tx$, ''))) / length($tx$    perform tell(p_world, p_uid, 'You pour ' || ingot_lumps() || ' lumps of ' || lower(v_metal.name)
      || ' into an ingot. (QL ' || to_char(v_bar.ql, 'FM990.0') || ')', 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_firing: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You pour '' || ingot_lumps() ||'; end if;
  v_def := replace(v_def, $tx$    perform tell(p_world, p_uid, 'You pour ' || ingot_lumps() || ' lumps of ' || lower(v_metal.name)
      || ' into an ingot. (QL ' || to_char(v_bar.ql, 'FM990.0') || ')', 'event');$tx$, $tx$    perform tell(p_world, p_uid, 'Poured: ' || ingot_lumps() || ' × ' || lower(v_metal.name)
      || ' lump into an ingot, QL ' || to_char(v_bar.ql, 'FM990.0') || '.', 'event');$tx$);
  execute v_def;
end $do$;

-- firing_refusal: its words, as the browser now says them.
do $do$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef('public.firing_refusal(uuid, uuid, text, jsonb)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, $tx$'Smelters take ore.'$tx$, ''))) / length($tx$'Smelters take ore.'$tx$);
  if v_n <> 1 then raise exception 'firing_refusal: % of the anchor %, wanted one', v_n, '''Smelters take ore.'''; end if;
  v_def := replace(v_def, $tx$'Smelters take ore.'$tx$, $tx$'Ore only.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$return 'A charge is ' || ore_per_lump()::int || ' ore; you have ' || v_it.count || '.';$tx$, ''))) / length($tx$return 'A charge is ' || ore_per_lump()::int || ' ore; you have ' || v_it.count || '.';$tx$);
  if v_n <> 1 then raise exception 'firing_refusal: % of the anchor %, wanted one', v_n, 'return ''A charge is '' || ore_per_lump()::int || '' ore; you h'; end if;
  v_def := replace(v_def, $tx$return 'A charge is ' || ore_per_lump()::int || ' ore; you have ' || v_it.count || '.';$tx$, $tx$return 'Need ' || ore_per_lump()::int || ' ore; have ' || v_it.count || '.';$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'The furnace is charged as full as it will go.'$tx$, ''))) / length($tx$'The furnace is charged as full as it will go.'$tx$);
  if v_n < 1 then raise exception 'firing_refusal: % of the anchor %, wanted some', v_n, '''The furnace is charged as full as it will go.'''; end if;
  v_def := replace(v_def, $tx$'The furnace is charged as full as it will go.'$tx$, $tx$'Smelter full.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'A kiln takes unfired clay.'$tx$, ''))) / length($tx$'A kiln takes unfired clay.'$tx$);
  if v_n <> 1 then raise exception 'firing_refusal: % of the anchor %, wanted one', v_n, '''A kiln takes unfired clay.'''; end if;
  v_def := replace(v_def, $tx$'A kiln takes unfired clay.'$tx$, $tx$'Unfired clay only.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'The kiln is packed as full as it will go.'$tx$, ''))) / length($tx$'The kiln is packed as full as it will go.'$tx$);
  if v_n <> 1 then raise exception 'firing_refusal: % of the anchor %, wanted one', v_n, '''The kiln is packed as full as it will go.'''; end if;
  v_def := replace(v_def, $tx$'The kiln is packed as full as it will go.'$tx$, $tx$'Kiln full.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'An anvil is cast whole: pour it with Cast an anvil.'$tx$, ''))) / length($tx$'An anvil is cast whole: pour it with Cast an anvil.'$tx$);
  if v_n <> 1 then raise exception 'firing_refusal: % of the anchor %, wanted one', v_n, '''An anvil is cast whole: pour it with Cast an anvil.'''; end if;
  v_def := replace(v_def, $tx$'An anvil is cast whole: pour it with Cast an anvil.'$tx$, $tx$'Use Cast an anvil.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'You have no metal to pour.'$tx$, ''))) / length($tx$'You have no metal to pour.'$tx$);
  if v_n <> 1 then raise exception 'firing_refusal: % of the anchor %, wanted one', v_n, '''You have no metal to pour.'''; end if;
  v_def := replace(v_def, $tx$'You have no metal to pour.'$tx$, $tx$'Need metal.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$return 'That takes ' || v_need || ' lumps.';$tx$, ''))) / length($tx$return 'That takes ' || v_need || ' lumps.';$tx$);
  if v_n <> 1 then raise exception 'firing_refusal: % of the anchor %, wanted one', v_n, 'return ''That takes '' || v_need || '' lumps.'';'; end if;
  v_def := replace(v_def, $tx$return 'That takes ' || v_need || ' lumps.';$tx$, $tx$return 'Need ' || v_need || ' lumps.';$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'You need an anvil mould.'$tx$, ''))) / length($tx$'You need an anvil mould.'$tx$);
  if v_n <> 1 then raise exception 'firing_refusal: % of the anchor %, wanted one', v_n, '''You need an anvil mould.'''; end if;
  v_def := replace(v_def, $tx$'You need an anvil mould.'$tx$, $tx$'Need an anvil mould.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$return 'An anvil takes ' || v_need || ' lumps of ' || lower(v_metal.name) || '.';$tx$, ''))) / length($tx$return 'An anvil takes ' || v_need || ' lumps of ' || lower(v_metal.name) || '.';$tx$);
  if v_n <> 1 then raise exception 'firing_refusal: % of the anchor %, wanted one', v_n, 'return ''An anvil takes '' || v_need || '' lumps of '' || lower('; end if;
  v_def := replace(v_def, $tx$return 'An anvil takes ' || v_need || ' lumps of ' || lower(v_metal.name) || '.';$tx$, $tx$return 'Need ' || v_need || ' lumps of ' || lower(v_metal.name) || '.';$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'That wants a Smith who has learned to pour ingots.'$tx$, ''))) / length($tx$'That wants a Smith who has learned to pour ingots.'$tx$);
  if v_n <> 1 then raise exception 'firing_refusal: % of the anchor %, wanted one', v_n, '''That wants a Smith who has learned to pour ingots.'''; end if;
  v_def := replace(v_def, $tx$'That wants a Smith who has learned to pour ingots.'$tx$, $tx$'Need perk: Ingots (Smith).'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$return 'An ingot takes ' || ingot_lumps() || ' lumps; you have ' || v_it.count || '.';$tx$, ''))) / length($tx$return 'An ingot takes ' || ingot_lumps() || ' lumps; you have ' || v_it.count || '.';$tx$);
  if v_n <> 1 then raise exception 'firing_refusal: % of the anchor %, wanted one', v_n, 'return ''An ingot takes '' || ingot_lumps() || '' lumps; you ha'; end if;
  v_def := replace(v_def, $tx$return 'An ingot takes ' || ingot_lumps() || ' lumps; you have ' || v_it.count || '.';$tx$, $tx$return 'Need ' || ingot_lumps() || ' lumps; have ' || v_it.count || '.';$tx$);
  execute v_def;
end $do$;

-- forge_refusal: its words, as the browser now says them.
do $do$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef('public.forge_refusal(uuid, uuid, text, jsonb)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, $tx$'You have no anvil to set down.'$tx$, ''))) / length($tx$'You have no anvil to set down.'$tx$);
  if v_n <> 1 then raise exception 'forge_refusal: % of the anchor %, wanted one', v_n, '''You have no anvil to set down.'''; end if;
  v_def := replace(v_def, $tx$'You have no anvil to set down.'$tx$, $tx$'Need an anvil.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'You need a coin die.'$tx$, ''))) / length($tx$'You need a coin die.'$tx$);
  if v_n <> 1 then raise exception 'forge_refusal: % of the anchor %, wanted one', v_n, '''You need a coin die.'''; end if;
  v_def := replace(v_def, $tx$'You need a coin die.'$tx$, $tx$'Need a coin die.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'You have no metal to strike.'$tx$, ''))) / length($tx$'You have no metal to strike.'$tx$);
  if v_n <> 1 then raise exception 'forge_refusal: % of the anchor %, wanted one', v_n, '''You have no metal to strike.'''; end if;
  v_def := replace(v_def, $tx$'You have no metal to strike.'$tx$, $tx$'Need metal.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'Pour a mould at the smelter first.'$tx$, ''))) / length($tx$'Pour a mould at the smelter first.'$tx$);
  if v_n <> 1 then raise exception 'forge_refusal: % of the anchor %, wanted one', v_n, '''Pour a mould at the smelter first.'''; end if;
  v_def := replace(v_def, $tx$'Pour a mould at the smelter first.'$tx$, $tx$'Need a casting (pour a mould at a smelter).'$tx$);
  execute v_def;
end $do$;

-- perform_forge: its words, as the browser now says them.
do $do$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef('public.perform_forge(uuid, uuid, text, jsonb)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, $tx$      perform tell(p_world, p_uid, 'You rake ' || v_whole
        || case when v_whole = 1 then ' lot' else ' lots' end
        || ' of ashes out of the oven. (QL 20)', 'event');$tx$, ''))) / length($tx$      perform tell(p_world, p_uid, 'You rake ' || v_whole
        || case when v_whole = 1 then ' lot' else ' lots' end
        || ' of ashes out of the oven. (QL 20)', 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_forge: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You rake '' || v_whole'; end if;
  v_def := replace(v_def, $tx$      perform tell(p_world, p_uid, 'You rake ' || v_whole
        || case when v_whole = 1 then ' lot' else ' lots' end
        || ' of ashes out of the oven. (QL 20)', 'event');$tx$, $tx$      perform tell(p_world, p_uid, 'Raked out: ' || v_whole || ' × ashes, QL 20.', 'event');$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$    perform tell(p_world, p_uid, 'You set the ' || lower(anvil_name(p))
      || ' down. Bring a casting to it.', 'event');$tx$, ''))) / length($tx$    perform tell(p_world, p_uid, 'You set the ' || lower(anvil_name(p))
      || ' down. Bring a casting to it.', 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_forge: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You set the '' || lower(anvil_n'; end if;
  v_def := replace(v_def, $tx$    perform tell(p_world, p_uid, 'You set the ' || lower(anvil_name(p))
      || ' down. Bring a casting to it.', 'event');$tx$, $tx$    perform tell(p_world, p_uid, 'Set down: ' || lower(anvil_name(p)) || '.', 'event');$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$    perform tell(p_world, p_uid, 'You heave the ' || lower(anvil_name(p))
      || ' up onto your shoulder.', 'event');$tx$, ''))) / length($tx$    perform tell(p_world, p_uid, 'You heave the ' || lower(anvil_name(p))
      || ' up onto your shoulder.', 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_forge: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You heave the '' || lower(anvil'; end if;
  v_def := replace(v_def, $tx$    perform tell(p_world, p_uid, 'You heave the ' || lower(anvil_name(p))
      || ' up onto your shoulder.', 'event');$tx$, $tx$    perform tell(p_world, p_uid, 'Picked up: ' || lower(anvil_name(p)) || '.', 'event');$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$      perform tell(p_world, p_uid, case when v_struck then 'The gold is too poor to take the die and the blanks crack'
                                        else 'The blanks come out smeared' end || '; the lump is lost.'
        || case when v_broke then ' The die is worn through.' else '' end, 'event');$tx$, ''))) / length($tx$      perform tell(p_world, p_uid, case when v_struck then 'The gold is too poor to take the die and the blanks crack'
                                        else 'The blanks come out smeared' end || '; the lump is lost.'
        || case when v_broke then ' The die is worn through.' else '' end, 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_forge: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, case when v_struck then ''The go'; end if;
  v_def := replace(v_def, $tx$      perform tell(p_world, p_uid, case when v_struck then 'The gold is too poor to take the die and the blanks crack'
                                        else 'The blanks come out smeared' end || '; the lump is lost.'
        || case when v_broke then ' The die is worn through.' else '' end, 'event');$tx$, $tx$      perform tell(p_world, p_uid, 'Failed: coins, ' || case when v_struck then 'gold too poor for the die'
                                        else 'skill check' end || '. Lump lost.'
        || case when v_broke then ' Coin die worn out.' else '' end, 'event');$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$    perform tell(p_world, p_uid, 'You strike ' || coins_per_lump()::int || ' ' || lower(m.name)
      || ' coins on the ' || lower(anvil_name(p)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')'
      || case when v_broke then ' The die is worn through and done.'
              else ' The die has ' || ceil((100 - (v_mould.dmg + die_wear())) / die_wear())::int || ' strikes left.' end, 'event');$tx$, ''))) / length($tx$    perform tell(p_world, p_uid, 'You strike ' || coins_per_lump()::int || ' ' || lower(m.name)
      || ' coins on the ' || lower(anvil_name(p)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')'
      || case when v_broke then ' The die is worn through and done.'
              else ' The die has ' || ceil((100 - (v_mould.dmg + die_wear())) / die_wear())::int || ' strikes left.' end, 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_forge: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You strike '' || coins_per_lump'; end if;
  v_def := replace(v_def, $tx$    perform tell(p_world, p_uid, 'You strike ' || coins_per_lump()::int || ' ' || lower(m.name)
      || ' coins on the ' || lower(anvil_name(p)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')'
      || case when v_broke then ' The die is worn through and done.'
              else ' The die has ' || ceil((100 - (v_mould.dmg + die_wear())) / die_wear())::int || ' strikes left.' end, 'event');$tx$, $tx$    perform tell(p_world, p_uid, 'Struck: ' || coins_per_lump()::int || ' × ' || lower(m.name)
      || ' coin, QL ' || to_char(v_ql, 'FM990.0') || '.'
      || case when v_broke then ' Coin die worn out.'
              else ' Coin die: ' || ceil((100 - (v_mould.dmg + die_wear())) / die_wear())::int || ' strikes left.' end, 'event');$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$    perform tell(p_world, p_uid, 'The '
      || lower((select name from item_def where id = d.makes))
      || ' comes out misshapen and '
      || case when v_kept then 'goes back into the fire: the casting is kept.' else 'you throw the metal back.' end, 'event');$tx$, ''))) / length($tx$    perform tell(p_world, p_uid, 'The '
      || lower((select name from item_def where id = d.makes))
      || ' comes out misshapen and '
      || case when v_kept then 'goes back into the fire: the casting is kept.' else 'you throw the metal back.' end, 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_forge: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''The '''; end if;
  v_def := replace(v_def, $tx$    perform tell(p_world, p_uid, 'The '
      || lower((select name from item_def where id = d.makes))
      || ' comes out misshapen and '
      || case when v_kept then 'goes back into the fire: the casting is kept.' else 'you throw the metal back.' end, 'event');$tx$, $tx$    perform tell(p_world, p_uid, 'Failed: '
      || lower((select name from item_def where id = d.makes)) || '. '
      || case when v_kept then 'Second Heat: casting kept.' else 'Casting lost.' end, 'event');$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$  perform tell(p_world, p_uid, 'You beat out '
    || case when v_count > 1 then v_count || ' ' else 'a ' end
    || lower(m.name) || ' '
    || case when v_count > 1 and right(lower((select name from item_def where id = d.makes)), 1) <> 's'
            then lower((select name from item_def where id = d.makes)) || 's'
            else lower((select name from item_def where id = d.makes)) end
    || ' on the ' || lower(anvil_name(p)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx$, ''))) / length($tx$  perform tell(p_world, p_uid, 'You beat out '
    || case when v_count > 1 then v_count || ' ' else 'a ' end
    || lower(m.name) || ' '
    || case when v_count > 1 and right(lower((select name from item_def where id = d.makes)), 1) <> 's'
            then lower((select name from item_def where id = d.makes)) || 's'
            else lower((select name from item_def where id = d.makes)) end
    || ' on the ' || lower(anvil_name(p)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_forge: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You beat out '''; end if;
  v_def := replace(v_def, $tx$  perform tell(p_world, p_uid, 'You beat out '
    || case when v_count > 1 then v_count || ' ' else 'a ' end
    || lower(m.name) || ' '
    || case when v_count > 1 and right(lower((select name from item_def where id = d.makes)), 1) <> 's'
            then lower((select name from item_def where id = d.makes)) || 's'
            else lower((select name from item_def where id = d.makes)) end
    || ' on the ' || lower(anvil_name(p)) || '. (QL ' || to_char(v_ql, 'FM990.0') || ')', 'event');$tx$, $tx$  perform tell(p_world, p_uid, 'Smithed: '
    || case when v_count > 1 then v_count || ' × ' else '' end
    || lower(m.name) || ' ' || lower((select name from item_def where id = d.makes))
    || ', QL ' || to_char(v_ql, 'FM990.0') || '.', 'event');$tx$);
  execute v_def;
end $do$;

-- holding_refusal: its words, as the browser now says them.
do $do$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef('public.holding_refusal(uuid, uuid, text, jsonb)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, $tx$'One bag will not go inside another.'$tx$, ''))) / length($tx$'One bag will not go inside another.'$tx$);
  if v_n <> 1 then raise exception 'holding_refusal: % of the anchor %, wanted one', v_n, '''One bag will not go inside another.'''; end if;
  v_def := replace(v_def, $tx$'One bag will not go inside another.'$tx$, $tx$'No bags inside bags.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$return 'The ' || lower(placed_name(p)) || ' is full.';$tx$, ''))) / length($tx$return 'The ' || lower(placed_name(p)) || ' is full.';$tx$);
  if v_n <> 1 then raise exception 'holding_refusal: % of the anchor %, wanted one', v_n, 'return ''The '' || lower(placed_name(p)) || '' is full.'';'; end if;
  v_def := replace(v_def, $tx$return 'The ' || lower(placed_name(p)) || ' is full.';$tx$, $tx$return placed_name(p) || ' full.';$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$return 'The ' || lower(placed_name(v_other)) || ' is full.';$tx$, ''))) / length($tx$return 'The ' || lower(placed_name(v_other)) || ' is full.';$tx$);
  if v_n <> 1 then raise exception 'holding_refusal: % of the anchor %, wanted one', v_n, 'return ''The '' || lower(placed_name(v_other)) || '' is full.'';'; end if;
  v_def := replace(v_def, $tx$return 'The ' || lower(placed_name(v_other)) || ' is full.';$tx$, $tx$return placed_name(v_other) || ' full.';$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'Stand next to something that will take it.'$tx$, ''))) / length($tx$'Stand next to something that will take it.'$tx$);
  if v_n <> 1 then raise exception 'holding_refusal: % of the anchor %, wanted one', v_n, '''Stand next to something that will take it.'''; end if;
  v_def := replace(v_def, $tx$'Stand next to something that will take it.'$tx$, $tx$'No store in reach takes it.'$tx$);
  execute v_def;
end $do$;

-- perform_holding: its words, as the browser now says them.
do $do$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef('public.perform_holding(uuid, uuid, text, jsonb)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, $tx$    perform tell(p_world, p_uid, 'You take ' || v_names || ' out of the '
      || lower(placed_name(p)) || '.', 'event');$tx$, ''))) / length($tx$    perform tell(p_world, p_uid, 'You take ' || v_names || ' out of the '
      || lower(placed_name(p)) || '.', 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_holding: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You take '' || v_names || '' out'; end if;
  v_def := replace(v_def, $tx$    perform tell(p_world, p_uid, 'You take ' || v_names || ' out of the '
      || lower(placed_name(p)) || '.', 'event');$tx$, $tx$    perform tell(p_world, p_uid, 'Taken from ' || lower(placed_name(p)) || ': ' || v_names || '.', 'event');$tx$);
  execute v_def;
end $do$;

-- crate_refusal: its words, as the browser now says them.
do $do$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef('public.crate_refusal(uuid, uuid, text, jsonb)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, $tx$'That is not a crate.'$tx$, ''))) / length($tx$'That is not a crate.'$tx$);
  if v_n <> 1 then raise exception 'crate_refusal: % of the anchor %, wanted one', v_n, '''That is not a crate.'''; end if;
  v_def := replace(v_def, $tx$'That is not a crate.'$tx$, $tx$'Not a crate.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'Crates need dry, open ground.'$tx$, ''))) / length($tx$'Crates need dry, open ground.'$tx$);
  if v_n < 1 then raise exception 'crate_refusal: % of the anchor %, wanted some', v_n, '''Crates need dry, open ground.'''; end if;
  v_def := replace(v_def, $tx$'Crates need dry, open ground.'$tx$, $tx$'Need dry, open ground.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'The ground is too steep for a crate to stand.'$tx$, ''))) / length($tx$'The ground is too steep for a crate to stand.'$tx$);
  if v_n <> 1 then raise exception 'crate_refusal: % of the anchor %, wanted one', v_n, '''The ground is too steep for a crate to stand.'''; end if;
  v_def := replace(v_def, $tx$'The ground is too steep for a crate to stand.'$tx$, $tx$'Too steep.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$      return 'A ' || lower((select name from item_def where id = v_it.def))
        || ' will not sit on the runners. The rack takes plank crates.';$tx$, ''))) / length($tx$      return 'A ' || lower((select name from item_def where id = v_it.def))
        || ' will not sit on the runners. The rack takes plank crates.';$tx$);
  if v_n <> 1 then raise exception 'crate_refusal: % of the anchor %, wanted one', v_n, 'return ''A '' || lower((select name from item_def where id = v'; end if;
  v_def := replace(v_def, $tx$      return 'A ' || lower((select name from item_def where id = v_it.def))
        || ' will not sit on the runners. The rack takes plank crates.';$tx$, $tx$      return 'Plank crates only on a rack.';$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'There is already a crate on that spot.'$tx$, ''))) / length($tx$'There is already a crate on that spot.'$tx$);
  if v_n <> 1 then raise exception 'crate_refusal: % of the anchor %, wanted one', v_n, '''There is already a crate on that spot.'''; end if;
  v_def := replace(v_def, $tx$'There is already a crate on that spot.'$tx$, $tx$'Spot taken.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$                      'The ' || lower(crate_name(v_c)) || ' is not yours.');$tx$, ''))) / length($tx$                      'The ' || lower(crate_name(v_c)) || ' is not yours.');$tx$);
  if v_n <> 1 then raise exception 'crate_refusal: % of the anchor %, wanted one', v_n, '''The '' || lower(crate_name(v_c)) || '' is not yours.'');'; end if;
  v_def := replace(v_def, $tx$                      'The ' || lower(crate_name(v_c)) || ' is not yours.');$tx$, $tx$                      'Not yours: ' || lower(crate_name(v_c)) || '.');$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'A crate does not go in a crate.'$tx$, ''))) / length($tx$'A crate does not go in a crate.'$tx$);
  if v_n < 1 then raise exception 'crate_refusal: % of the anchor %, wanted some', v_n, '''A crate does not go in a crate.'''; end if;
  v_def := replace(v_def, $tx$'A crate does not go in a crate.'$tx$, $tx$'No crates inside crates.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$return 'The ' || lower(crate_name(v_c)) || ' is full.';$tx$, ''))) / length($tx$return 'The ' || lower(crate_name(v_c)) || ' is full.';$tx$);
  if v_n <> 1 then raise exception 'crate_refusal: % of the anchor %, wanted one', v_n, 'return ''The '' || lower(crate_name(v_c)) || '' is full.'';'; end if;
  v_def := replace(v_def, $tx$return 'The ' || lower(crate_name(v_c)) || ' is full.';$tx$, $tx$return crate_name(v_c) || ' full.';$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$return 'There are no crates on the ' || lower(placed_name(v_pl)) || '.';$tx$, ''))) / length($tx$return 'There are no crates on the ' || lower(placed_name(v_pl)) || '.';$tx$);
  if v_n <> 1 then raise exception 'crate_refusal: % of the anchor %, wanted one', v_n, 'return ''There are no crates on the '' || lower(placed_name(v_'; end if;
  v_def := replace(v_def, $tx$return 'There are no crates on the ' || lower(placed_name(v_pl)) || '.';$tx$, $tx$return 'No crates on ' || lower(placed_name(v_pl)) || '.';$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$return 'Every crate on the ' || lower(placed_name(v_pl)) || ' is full.';$tx$, ''))) / length($tx$return 'Every crate on the ' || lower(placed_name(v_pl)) || ' is full.';$tx$);
  if v_n <> 1 then raise exception 'crate_refusal: % of the anchor %, wanted one', v_n, 'return ''Every crate on the '' || lower(placed_name(v_pl)) || '; end if;
  v_def := replace(v_def, $tx$return 'Every crate on the ' || lower(placed_name(v_pl)) || ' is full.';$tx$, $tx$return 'All crates on ' || lower(placed_name(v_pl)) || ' full.';$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$        return 'The ' || lower(crate_name(v_c)) || ' is not yours.';$tx$, ''))) / length($tx$        return 'The ' || lower(crate_name(v_c)) || ' is not yours.';$tx$);
  if v_n <> 1 then raise exception 'crate_refusal: % of the anchor %, wanted one', v_n, 'return ''The '' || lower(crate_name(v_c)) || '' is not yours.'';'; end if;
  v_def := replace(v_def, $tx$        return 'The ' || lower(crate_name(v_c)) || ' is not yours.';$tx$, $tx$        return 'Not yours: ' || lower(crate_name(v_c)) || '.';$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$'That is on somebody else''s stall. Buy it at the counter.'$tx$, ''))) / length($tx$'That is on somebody else''s stall. Buy it at the counter.'$tx$);
  if v_n <> 1 then raise exception 'crate_refusal: % of the anchor %, wanted one', v_n, '''That is on somebody else''''s stall. Buy it at the counter.'''; end if;
  v_def := replace(v_def, $tx$'That is on somebody else''s stall. Buy it at the counter.'$tx$, $tx$'Someone else''s stall: buy it at the counter.'$tx$);
  execute v_def;
end $do$;

-- crate_refusal: its words, as the browser now says them.
do $do$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef('public.crate_refusal(uuid, uuid, text, jsonb)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, $tx$' The others are full.'$tx$, ''))) / length($tx$' The others are full.'$tx$);
  if v_n <> 1 then raise exception 'crate_refusal: % of the anchor %, wanted one', v_n, ''' The others are full.'''; end if;
  v_def := replace(v_def, $tx$' The others are full.'$tx$, $tx$' Others full.'$tx$);
  execute v_def;
end $do$;

-- perform_crate: its words, as the browser now says them.
do $do$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef('public.perform_crate(uuid, uuid, text, jsonb)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, $tx$perform tell(p_world, p_uid, 'You set the ' || lower(crate_name(v_c)) || ' down.', 'event');$tx$, ''))) / length($tx$perform tell(p_world, p_uid, 'You set the ' || lower(crate_name(v_c)) || ' down.', 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_crate: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You set the '' || lower(crate_n'; end if;
  v_def := replace(v_def, $tx$perform tell(p_world, p_uid, 'You set the ' || lower(crate_name(v_c)) || ' down.', 'event');$tx$, $tx$perform tell(p_world, p_uid, 'Set down: ' || lower(crate_name(v_c)) || '.', 'event');$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$    perform tell(p_world, p_uid, 'You pick up the '
      || lower((select name from crate_def where crate_def.kind = v_c.kind)) || '.'
      || case when v_c.deed then ' Deed workers will leave their finds by the token until a deed crate stands again.'$tx$, ''))) / length($tx$    perform tell(p_world, p_uid, 'You pick up the '
      || lower((select name from crate_def where crate_def.kind = v_c.kind)) || '.'
      || case when v_c.deed then ' Deed workers will leave their finds by the token until a deed crate stands again.'$tx$);
  if v_n <> 1 then raise exception 'perform_crate: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You pick up the '''; end if;
  v_def := replace(v_def, $tx$    perform tell(p_world, p_uid, 'You pick up the '
      || lower((select name from crate_def where crate_def.kind = v_c.kind)) || '.'
      || case when v_c.deed then ' Deed workers will leave their finds by the token until a deed crate stands again.'$tx$, $tx$    perform tell(p_world, p_uid, 'Picked up: '
      || lower((select name from crate_def where crate_def.kind = v_c.kind)) || '.'
      || case when v_c.deed then ' Deed workers leave their finds by the token until a deed crate is set down.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$perform tell(p_world, p_uid, 'You take ' || array_to_string(v_names, ', ') || ' from the crate.', 'event');$tx$, ''))) / length($tx$perform tell(p_world, p_uid, 'You take ' || array_to_string(v_names, ', ') || ' from the crate.', 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_crate: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You take '' || array_to_string('; end if;
  v_def := replace(v_def, $tx$perform tell(p_world, p_uid, 'You take ' || array_to_string(v_names, ', ') || ' from the crate.', 'event');$tx$, $tx$perform tell(p_world, p_uid, 'Taken from crate: ' || array_to_string(v_names, ', ') || '.', 'event');$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$    perform tell(p_world, p_uid, 'You take '
      || case when v_want > 1 then v_want || ' × ' else 'the ' end
      || lower((select coalesce(name, v_it.def) from item_def where id = v_it.def))
      || ' out.', 'event');$tx$, ''))) / length($tx$    perform tell(p_world, p_uid, 'You take '
      || case when v_want > 1 then v_want || ' × ' else 'the ' end
      || lower((select coalesce(name, v_it.def) from item_def where id = v_it.def))
      || ' out.', 'event');$tx$);
  if v_n <> 1 then raise exception 'perform_crate: % of the anchor %, wanted one', v_n, 'perform tell(p_world, p_uid, ''You take '''; end if;
  v_def := replace(v_def, $tx$    perform tell(p_world, p_uid, 'You take '
      || case when v_want > 1 then v_want || ' × ' else 'the ' end
      || lower((select coalesce(name, v_it.def) from item_def where id = v_it.def))
      || ' out.', 'event');$tx$, $tx$    perform tell(p_world, p_uid, coalesce('Taken from ' || lower(v_store) || ': ', 'Taken: ')
      || case when v_want > 1 then v_want || ' × ' else '' end
      || lower((select coalesce(name, v_it.def) from item_def where id = v_it.def))
      || '.', 'event');$tx$);
  execute v_def;
end $do$;

-- mark_says: its words, as the browser now says them.
do $do$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef('public.mark_says(jsonb)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, $tx$else ' Its maker''s hand is in it: it ' || list_of($tx$, ''))) / length($tx$else ' Its maker''s hand is in it: it ' || list_of($tx$);
  if v_n <> 1 then raise exception 'mark_says: % of the anchor %, wanted one', v_n, 'else '' Its maker''''s hand is in it: it '' || list_of('; end if;
  v_def := replace(v_def, $tx$else ' Its maker''s hand is in it: it ' || list_of($tx$, $tx$else ' Maker''s mark: ' || list_of($tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$then ' It is sealed and never decays.'$tx$, ''))) / length($tx$then ' It is sealed and never decays.'$tx$);
  if v_n <> 1 then raise exception 'mark_says: % of the anchor %, wanted one', v_n, 'then '' It is sealed and never decays.'''; end if;
  v_def := replace(v_def, $tx$then ' It is sealed and never decays.'$tx$, $tx$then ' Sealed: never decays.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$then ' It is glazed and never decays.'$tx$, ''))) / length($tx$then ' It is glazed and never decays.'$tx$);
  if v_n <> 1 then raise exception 'mark_says: % of the anchor %, wanted one', v_n, 'then '' It is glazed and never decays.'''; end if;
  v_def := replace(v_def, $tx$then ' It is glazed and never decays.'$tx$, $tx$then ' Glazed: never decays.'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$when 'last' then 'lasts ' || times_said(m) || ' as many fillings'$tx$, ''))) / length($tx$when 'last' then 'lasts ' || times_said(m) || ' as many fillings'$tx$);
  if v_n <> 1 then raise exception 'mark_says: % of the anchor %, wanted one', v_n, 'when ''last'' then ''lasts '' || times_said(m) || '' as many fill'; end if;
  v_def := replace(v_def, $tx$when 'last' then 'lasts ' || times_said(m) || ' as many fillings'$tx$, $tx$when 'last' then 'lasts ' || rtrim(to_char(round(m::numeric, 2), 'FM9999990.99'), '.') || '× the fillings'$tx$);
  v_n := (length(v_def) - length(replace(v_def, $tx$when 'keeps' then 'keeps what is put up in it ' || times_said(1 / m) || ' as long'$tx$, ''))) / length($tx$when 'keeps' then 'keeps what is put up in it ' || times_said(1 / m) || ' as long'$tx$);
  if v_n <> 1 then raise exception 'mark_says: % of the anchor %, wanted one', v_n, 'when ''keeps'' then ''keeps what is put up in it '' || times_sai'; end if;
  v_def := replace(v_def, $tx$when 'keeps' then 'keeps what is put up in it ' || times_said(1 / m) || ' as long'$tx$, $tx$when 'keeps' then 'keeps what is put up in it ' || rtrim(to_char(round((1 / m)::numeric, 2), 'FM9999990.99'), '.') || '× as long'$tx$);
  execute v_def;
end $do$;

-- crate_put_shut: its words, as the browser now says them.
do $do$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef('public.crate_put_shut(uuid, uuid, crate)'::regprocedure);
  v_n := (length(v_def) - length(replace(v_def, $tx$'The ' || lower(crate_name(c)) || ' is not yours to put anything in.'$tx$, ''))) / length($tx$'The ' || lower(crate_name(c)) || ' is not yours to put anything in.'$tx$);
  if v_n <> 1 then raise exception 'crate_put_shut: % of the anchor %, wanted one', v_n, '''The '' || lower(crate_name(c)) || '' is not yours to put anyt'; end if;
  v_def := replace(v_def, $tx$'The ' || lower(crate_name(c)) || ' is not yours to put anything in.'$tx$, $tx$'Not yours: ' || lower(crate_name(c)) || ', nothing goes in.'$tx$);
  execute v_def;
end $do$;

select private.lock_doors();
