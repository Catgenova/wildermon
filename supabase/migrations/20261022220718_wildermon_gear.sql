-- Wildermon gear: a pack, a harness and barding, fitted on a wildermon of yours, as the browser has them (`wildgear.ts`,
-- `wildgearActions.ts`).
--
-- Asked for: "wildermon gear (#17), player-crafted gear fitted on a wildermon, one item per slot". The items, the
-- recipes, the six actions and the numbers are the snapshot's before this (`item_def`, `recipe`, `action_def`,
-- `pack_loads`, `harness_pace`, `barding_cut`, `gear_floor`, `worn_span`, `worn_floor`). What they do:
--
--   * a piece is kept on the creature, the whole item row a slot, in `creature.gear` (as a crate keeps the creature in
--     it, by a column of the holder): fitted from the pack (`fit_gear_<slot>`, the piece chosen as `itemUid` or the
--     best of its size carried) and given back as it was (`remove_gear_<slot>`, and every piece on a release or a cull,
--     `gear_off`), in the browser's words (`gear_refusal`);
--   * it fits the size of bed it sleeps in (`den_class`), and on one grown out of it does nothing (`gear_on`); its QL
--     puts it between `gear_floor` of the full figure and the whole, its damage dragged down as a tool's (`gear_share`,
--     `worn_share`);
--   * a pack puts `pack_loads` on its loads a trip at a trade that carries loads (`pack_loads_of`, in `stage_loads`); a
--     harness `harness_pace` at its share on its team's pace (`harness_team`, in `vehicle_speed`); barding
--     `barding_cut` at its share off a blow on it (`barding_mul`, in `wound_beast`);
--   * each wears a use as a tool of its QL does (`wear_per_use`): a pack a cycle worked at a trade it carries for
--     (`worker_settle`), a harness a tile pulled (`rpc_move`), barding a blow taken (`wound_beast`); at `damage_max` it
--     is gone and its keeper told (`gear_wear`);
--   * and your own's are sent with it (`rpc_creatures`, `gear`).

set local lock_timeout = '3s';

alter table creature add column if not exists gear jsonb;

-- The slots and the sizes, by `den_class` (`GEAR_SLOTS`, `GEAR_SIZES`).
create or replace function gear_slots() returns text[] language sql immutable as $fn$
  select array['pack', 'harness', 'barding']
$fn$;
create or replace function gear_sizes() returns text[] language sql immutable as $fn$
  select array['small', 'medium', 'large']
$fn$;
-- The item a slot and a size make: `wild_pack_small` (`gearId`).
create or replace function gear_id(p_slot text, p_size int) returns text language sql immutable as $fn$
  select 'wild_' || p_slot || '_' || (gear_sizes())[p_size + 1]
$fn$;
-- The slot and the size of an item, or null for anything that is not wildermon gear (`gearOf`).
create or replace function gear_slot_of(p_def text) returns text language sql immutable as $fn$
  select s from unnest(gear_slots()) s, unnest(gear_sizes()) z where p_def = 'wild_' || s || '_' || z
$fn$;
create or replace function gear_size_of(p_def text) returns int language sql immutable as $fn$
  select (z.n - 1)::int from unnest(gear_slots()) s, unnest(gear_sizes()) with ordinality z(sz, n) where p_def = 'wild_' || s || '_' || z.sz
$fn$;

-- Damage one use puts on a thing of this quality, as a tool takes it (`wearPerUse`; `wear_tool` has the same).
create or replace function wear_per_use(p_ql double precision) returns double precision language sql immutable as $fn$
  select 0.06 + 3 / (10 + p_ql)
$fn$;
-- What is left of a thing's worth at this damage (`wornShare`; `tool_worth` has the same).
create or replace function worn_share(p_dmg double precision) returns double precision language sql immutable as $fn$
  select greatest(worn_floor(), 1 - p_dmg / worn_span())
$fn$;
-- What a piece gives of the full figure: `gear_floor` at QL 0, the whole at `ql_top` (`gearShare`).
create or replace function gear_share(p jsonb) returns double precision language sql immutable as $fn$
  select gear_floor() + (1 - gear_floor()) * greatest(0, least(ql_top(), (p->>'ql')::double precision))
         * worn_share(coalesce((p->>'dmg')::double precision, 0)) / ql_top()
$fn$;
-- What is fitted in a slot and fits the size it is now, or null (`gearOn`).
create or replace function gear_on(c creature, p_slot text) returns jsonb language sql stable as $fn$
  select case when c.gear ? p_slot and gear_size_of(c.gear->p_slot->>'def') = den_class(c) then c.gear->p_slot end
$fn$;
-- What a piece does, in the browser's words: "loads a trip +1", "team pace +7.5%", "damage taken −15%" (`gearSays`).
create or replace function gear_says(p_slot text, p jsonb) returns text language sql immutable as $fn$
  select case p_slot when 'pack' then 'loads a trip +' || pack_loads()::int
                     when 'harness' then 'team pace +' || enchant_pct(harness_pace() * gear_share(p))
                     else 'damage taken −' || enchant_pct(barding_cut() * gear_share(p)) end
$fn$;

-- A pack's loads a trip, at a trade that carries loads and a pack of its size (`packLoads`).
create or replace function pack_loads_of(c creature) returns int language sql stable as $fn$
  select case when c.gear is null or not c.gear ? 'pack' then 0
              when load_trade(coalesce(c.job, (select sd.gathers from species_def sd where sd.id = c.species)))
                   and gear_on(c, 'pack') is not null then pack_loads()::int
              else 0 end
$fn$;
-- Asked of nearly every worker's every step, so a creature with no gear on it is not asked any further.
create or replace function stage_loads(c creature) returns int language sql stable as $fn$
  select stage_loads_at(stage_of(c)) + case when c.gear is null then 0 else pack_loads_of(c) end
$fn$;

-- A team's harnesses on its pace: `harness_pace` at each one's share, over the team (`harnessTeam`).
create or replace function harness_team(p_world uuid, p_id bigint) returns double precision language sql stable as $fn$
  select coalesce(1 + harness_pace() * sum(case when t.gear ? 'harness' then coalesce(gear_share(gear_on(t, 'harness')), 0) else 0 end)
                      / nullif(count(*), 0), 1)
  from team_of(p_world, p_id) t
$fn$;
-- What barding of its size makes of a blow on it (`bardingMul`).
create or replace function barding_mul(c creature) returns double precision language sql stable as $fn$
  select case when c.gear is null or gear_on(c, 'barding') is null then 1
              else 1 - barding_cut() * gear_share(gear_on(c, 'barding')) end
$fn$;

/*
 * Uses' wear on the piece in a slot, as a tool of its QL takes it: its gear as it is after, without the piece once it
 * reaches `damage_max`, at which its keeper is told (`wearGear`, `gearGoneSays`).
 */
create or replace function gear_wear(p_world uuid, c creature, p_slot text, p_uses int default 1) returns jsonb
language plpgsql as $fn$
declare v_it jsonb := c.gear->p_slot; v_dmg double precision;
begin
  if v_it is null or p_uses <= 0 then return c.gear; end if;
  v_dmg := least(damage_max(), coalesce((v_it->>'dmg')::double precision, 0) + wear_per_use((v_it->>'ql')::double precision) * p_uses);
  if v_dmg < damage_max() then
    return jsonb_set(c.gear, array[p_slot, 'dmg'], to_jsonb(v_dmg));
  end if;
  if c.keeper is not null then
    perform tell(p_world, c.keeper, coalesce((select d.name from item_def d where d.id = v_it->>'def'), v_it->>'def')
      || ' on ' || c.name || ': damage ' || damage_max()::int || ', gone.', 'event');
  end if;
  return nullif(c.gear - p_slot, '{}'::jsonb);
end $fn$;

-- Gear as your own's card is sent it: the item, its QL and its damage, a slot.
create or replace function gear_sent(p_gear jsonb) returns jsonb language sql immutable as $fn$
  select jsonb_object_agg(k, jsonb_build_object('def', v->>'def', 'ql', (v->>'ql')::double precision, 'dmg', (v->>'dmg')::double precision))
  from jsonb_each(p_gear) e(k, v)
$fn$;

-- "a " before a slot's name, and nothing before barding, which is never one of (`gearA`).
create or replace function gear_a(p_slot text) returns text language sql immutable as $fn$
  select case when p_slot = 'barding' then '' else 'a ' end
$fn$;

-- The six actions, fit and remove a slot each (`fitGearId`, `removeGearId`).
create or replace function gear_action(p_action text) returns boolean language sql immutable as $fn$
  select p_action in ('fit_gear_pack', 'fit_gear_harness', 'fit_gear_barding',
                      'remove_gear_pack', 'remove_gear_harness', 'remove_gear_barding')
$fn$;
create or replace function gear_action_slot(p_action text) returns text language sql immutable as $fn$
  select regexp_replace(p_action, '^(fit|remove)_gear_', '')
$fn$;

-- The piece a fitting would use: the one chosen, or the best of the slot at its size carried (`pieceFor`).
create or replace function gear_piece(p_world uuid, p_uid uuid, c creature, p_slot text, p_target jsonb) returns item
language sql stable as $fn$
  select i.* from item i
   where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and not i.locked
     and case when target_item(p_target) is not null then i.id = target_item(p_target)
              else i.def = gear_id(p_slot, den_class(c)) end
   order by gear_share(jsonb_build_object('ql', i.ql, 'dmg', i.dmg)) desc, i.id
   limit 1
$fn$;

-- Why a piece cannot be fitted or taken off, or null, in the browser's words (`fitRefusal`, `removeRefusal`). Reach is
-- `creature_refusal`'s, asked before this as it is of everything done beside a creature.
create or replace function gear_refusal(p_world uuid, p_uid uuid, p_action text, c creature, p_target jsonb) returns text
language plpgsql stable as $fn$
declare v_slot text := gear_action_slot(p_action); v_size text := (gear_sizes())[den_class(c) + 1]; v_it item;
begin
  if c.mode = 'wild' then return 'Not yours.'; end if;
  if c.keeper is distinct from p_uid then return c.name || ': not yours.'; end if;
  if c.mode = 'stored' then return c.name || ' is in a wildermon crate: open it first.'; end if;
  if p_action like 'remove_%' then
    return case when c.gear ? v_slot then null else c.name || ': no ' || v_slot || ' fitted.' end;
  end if;
  if target_item(p_target) is not null then
    v_it := carried(p_world, p_uid, target_item(p_target));
    if v_it.id is null or v_it.holder <> 'player' or v_it.locked then return 'It is gone.'; end if;
    -- The wrong slot: a harness chosen to fit as a pack.
    if gear_slot_of(v_it.def) is distinct from v_slot then
      return (select d.name from item_def d where d.id = v_it.def) || ': not ' || gear_a(v_slot) || 'wildermon ' || v_slot || '.';
    end if;
  end if;
  if c.gear ? v_slot then return c.name || ': ' || v_slot || ' already fitted.'; end if;
  if not exists (select 1 from item i where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
                   and not i.locked and gear_slot_of(i.def) = v_slot) then
    return 'Need ' || gear_a(v_slot) || v_size || ' wildermon ' || v_slot || '.';
  end if;
  -- The wrong size: it fits its own only (`den_class`).
  v_it := gear_piece(p_world, p_uid, c, v_slot, p_target);
  if v_it.id is null or gear_size_of(v_it.def) is distinct from den_class(c) then
    return c.name || ': ' || v_size || ' gear only.';
  end if;
  return null;
end $fn$;

-- A piece off it and back in its keeper's pack as it was, its QL, damage and the rest kept; the item it became.
create or replace function gear_unfit(p_world uuid, p_uid uuid, p_id int, p_slot text) returns bigint
language plpgsql as $fn$
declare v_it jsonb; v_new bigint;
begin
  select c.gear->p_slot into v_it from creature c where c.world_id = p_world and c.id = p_id for update;
  if v_it is null then return null; end if;
  v_new := give(p_world, p_uid, v_it->>'def', 1, (v_it->>'ql')::double precision, v_it->>'extra', v_it->>'rare',
                v_it->>'maker', v_it->>'piece', v_it->'mark');
  update item set dmg = coalesce((v_it->>'dmg')::real, 0), dye = v_it->>'dye', bless = (v_it->>'bless')::real,
                  enchant = v_it->'enchant', engraving = v_it->>'engraving'
   where id = v_new;
  update creature set gear = nullif(gear - p_slot, '{}'::jsonb) where world_id = p_world and id = p_id;
  return v_new;
end $fn$;

-- Every piece off one released or culled, back in your pack, each said as Remove says it (`takeGear`).
create or replace function gear_off(p_world uuid, p_uid uuid, p_id int) returns void language plpgsql as $fn$
declare v_slot text; v_def text; v_name text;
begin
  select c.name into v_name from creature c where c.world_id = p_world and c.id = p_id;
  foreach v_slot in array gear_slots() loop
    select c.gear->v_slot->>'def' into v_def from creature c where c.world_id = p_world and c.id = p_id;
    if v_def is not null and gear_unfit(p_world, p_uid, p_id, v_slot) is not null then
      perform tell(p_world, p_uid, (select d.name from item_def d where d.id = v_def) || ' removed from ' || v_name || '.', 'event');
    end if;
  end loop;
end $fn$;

-- Fitted or taken off: the browser's `fitAction` and `removeAction`. Asked again first.
create or replace function perform_gear(p_world uuid, p_uid uuid, p_action text, c creature, p_target jsonb) returns void
language plpgsql as $fn$
declare v_slot text := gear_action_slot(p_action); v_it item; v_on jsonb; v_def text := c.gear->v_slot->>'def';
begin
  if gear_refusal(p_world, p_uid, p_action, c, p_target) is not null then return; end if;
  if p_action like 'remove_%' then
    if gear_unfit(p_world, p_uid, c.id, v_slot) is null then return; end if;
    perform tell(p_world, p_uid, (select d.name from item_def d where d.id = v_def) || ' removed from ' || c.name || '.', 'event');
    return;
  end if;
  v_it := gear_piece(p_world, p_uid, c, v_slot, p_target);
  if v_it.id is null then return; end if;
  -- The whole row, its place in the world left behind, a single one.
  v_on := to_jsonb(v_it) - array['id', 'world_id', 'holder', 'holder_uid', 'gx', 'gy', 'inside', 'crate', 'placed', 'price',
                                 'letter', 'deal', 'creature', 'locked', 'keyed'] || jsonb_build_object('count', 1);
  if not spend_stack(p_world, p_uid, v_it.id, 1) then return; end if;
  update creature set gear = coalesce(gear, '{}'::jsonb) || jsonb_build_object(v_slot, v_on) where world_id = p_world and id = c.id;
  perform tell(p_world, p_uid, (select d.name from item_def d where d.id = v_it.def) || ' fitted on ' || c.name || ': '
    || gear_says(v_slot, v_on) || '.', 'event');
end $fn$;

-- The six are creature actions, asked and done as the rest are.
create or replace function creature_action(p_action text) returns boolean language sql immutable as $function$
  select p_action in ('examine_creature', 'tame', 'feed', 'groom', 'shear', 'milk_creature',
                      'set_stance', 'order_attack', 'order_heel', 'rename_creature', 'take_creature', 'crate_creature',
                      'crate_follow', 'crate_work',
                      'release_creature', 'cull_creature', 'assign_deed')
      -- An ancient comb, file or pot used on one (`artifact_action`).
      or artifact_action(p_action)
      -- Wildermon gear fitted and taken off (`gear_action`).
      or gear_action(p_action)
$function$;

do $do$
declare r record; v_def text; v_n int; i int;
begin
  for r in select * from (values
    -- Asked once it is known to be within reach, beside the artifacts.
    (1, 'creature_refusal', array[$$  if artifact_action(p_action) then return artifact_refusal(p_world, p_uid, p_action, c); end if;$$],
       array[$$  if artifact_action(p_action) then return artifact_refusal(p_world, p_uid, p_action, c); end if;
  -- Wildermon gear (`gear_refusal`).
  if gear_action(p_action) then return gear_refusal(p_world, p_uid, p_action, c, p_target); end if;$$], array[1]),
    (2, 'perform_creature', array[$$  if artifact_action(p_action) then
    perform perform_artifact(p_world, p_uid, p_action, c);
    return;
  end if;$$],
       array[$$  if artifact_action(p_action) then
    perform perform_artifact(p_world, p_uid, p_action, c);
    return;
  end if;
  -- Wildermon gear (`perform_gear`).
  if gear_action(p_action) then
    perform perform_gear(p_world, p_uid, p_action, c, p_target);
    return;
  end if;$$], array[1]),
    -- Released or culled: its gear back to you first (`gear_off`).
    (3, 'perform_creature', array[$$    if c.mode = 'stored' then perform crate_let_out(p_world, c.id); end if;
    -- Blood takes generations to build and a moment to walk away.$$,
                                  $$    select * into c from creature where world_id = p_world and id = c.id;
    if c.world_id is null then return; end if;
    if c.carrying is not null then$$],
       array[$$    if c.mode = 'stored' then perform crate_let_out(p_world, c.id); end if;
    perform gear_off(p_world, p_uid, c.id);
    -- Blood takes generations to build and a moment to walk away.$$,
             $$    select * into c from creature where world_id = p_world and id = c.id;
    if c.world_id is null then return; end if;
    perform gear_off(p_world, p_uid, c.id);
    if c.carrying is not null then$$], array[1, 1]),
    -- Your own's gear, for its card.
    (4, 'rpc_creatures', array[$$           'boosts', c.boosts,
$$], array[$$           'boosts', c.boosts,
           -- The wildermon gear on it, its QL and damage a slot (`gear_sent`).
           'gear', gear_sent(c.gear),
$$], array[1]),
    -- A team's harnesses, past the cap as its bridles are.
    (5, 'vehicle_speed', array[$$    * vehicle_ql_pace(p.ql) * bridle_team(p_world, p_id);$$],
       array[$$    * vehicle_ql_pace(p.ql) * bridle_team(p_world, p_id) * harness_team(p_world, p_id);$$], array[1]),
    -- Barding on a blow, and a blow's wear on it.
    (6, 'wound_beast', array[$$    * herd_heart(c, 'taken');$$,
                             $$  update creature set health = c.health - v_taken, hurt_at = now(), hurt_by = p_by,$$],
       array[$$    * herd_heart(c, 'taken')
    -- And less for wildermon barding on it (`barding_mul`).
    * barding_mul(c);$$,
             $$  update creature set health = c.health - v_taken, hurt_at = now(), hurt_by = p_by,
      gear = case when c.gear ? 'barding' then gear_wear(p_world, c, 'barding', 1) else c.gear end,$$], array[1, 1]),
    -- A harness in the traces wears a tile pulled, as each beast in them learns one.
    (7, 'rpc_move', array[$$            perform beast_learns(p_world, v_puller.id, 'pull');
          end loop;
        end loop;
$$],
       array[$$            perform beast_learns(p_world, v_puller.id, 'pull');
          end loop;
        end loop;
        -- And a wildermon harness in them wears a tile (`gear_wear`).
        update creature t set gear = gear_wear(p_world, t, 'harness', v_tiles)
         where t.world_id = p_world and t.hitched_to = cart.id and t.gear ? 'harness';
$$], array[1]),
    -- A pack that carries for it wears a cycle worked, at its task and at an errand; and its gear goes down with the row.
    (8, 'worker_settle', array[$$c.worn := c.worn + 1;
$$, $$worn = c.worn,$$],
       array[$$c.worn := c.worn + 1;
      if c.gear is not null and pack_loads_of(c) > 0 then c.gear := gear_wear(p_world, c, 'pack', 1); end if;
$$, $$worn = c.worn, gear = c.gear,$$], array[2, 4])
  ) as t(ord, fn, olds, news, ns) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not there', r.fn; end if;
    for i in 1 .. array_length(r.olds, 1) loop
      v_n := (length(v_def) - length(replace(v_def, r.olds[i], ''))) / length(r.olds[i]);
      if v_n <> r.ns[i] then raise exception '% has % of %, not %', r.fn, v_n, r.olds[i], r.ns[i]; end if;
      v_def := replace(v_def, r.olds[i], r.news[i]);
    end loop;
    execute v_def;
  end loop;
end $do$;

select private.lock_doors();
