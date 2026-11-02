-- What a back carries, worked out in one pass over the pack rather than three function calls a thing.
--
-- `rpc_move` asks `over_carry` on every step, and on a body with a full pack that was most of the step:
-- `carried_weight` called `item_weight` on every thing carried, which called `unit_weight`, which called
-- `mat_of` -- SQL functions with sub-selects in them, so none of them is inlined and each is a call of its own,
-- about a tenth of a millisecond a thing. Two hundred things was 28 ms of a 40 ms step. And `over_carry` asked
-- `carry_limit` twice, each of which looked up a Packmule on every thing carried, enchanted or not.
--
-- So:
--   * `carried_weight` reads a thing's weight in the same pass that reads the thing: the same sum, in the same
--     order, of the same expression `unit_weight` and `item_weight` work out (the vessel's empty weight and its
--     litres, else the make's weight, times the material's; times the count, plus what is inside it), so the
--     total is the same number to the last bit. What is inside a thing is still weighed by `unit_weight`.
--   * `carry_limit` adds up the Packmules of the enchanted things only. A thing with no enchantment adds nought
--     (`enchant_of`), and adding nought changes no sum.
--   * `over_carry` asks `carry_limit` once.
--
-- The same number from each, for every body; nothing a player sees changes, only how long a step takes.

set local lock_timeout = '3s';

/** What a body carries, in kg: every thing as `item_weight` weighs it, and a perk makes of it by kind. */
create or replace function carried_weight(p_world uuid, p_uid uuid) returns double precision language sql stable as $fn$
  -- What a perk makes of a thing's weight in the pack, by its kind: a Soil Porter's dirt.
  select coalesce(sum((
           -- `unit_weight`, inline: a vessel is its empty make and its litres, anything else its make; times its material.
           (coalesce((select (select e.weight from item_def e where e.id = v.empty) + item_litres(i) * litre_kg()
                        from vessel_def v where v.item = i.def),
                     (select d.weight from item_def d where d.id = i.def))
            * coalesce((select md.weight from material_def md where md.id = lower(coalesce(i.extra, ''))), 1))::double precision
           -- `item_weight`: times the count, and what is inside it.
           * i.count
           + coalesce((select sum(unit_weight(c) * c.count) from item c where c.inside = i.id), 0)
         ) * pk(m.mul, 'weight:' || i.def, 1)), 0)
    from item i
    cross join (select coalesce((select pl.class_mul from player pl
                                  where pl.world_id = p_world and pl.uid = p_uid), '{}'::jsonb) as mul) m
  where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid and i.inside is null
$fn$;

/** What a back takes: the base, and more for every point of body strength. */
create or replace function carry_limit(p_world uuid, p_uid uuid) returns double precision language sql stable as $fn$
  select (carry_base() + skill_of(p_world, p_uid, 'body_strength') * carry_per_strength()
       -- And a Terraformer's Strong Back.
       + pk(p_world, p_uid, 'carry', 0)
       -- And Power's Pack Mule.
       + path_fx(p_world, p_uid, 'mule', 0)
       -- And a Packmule on each pack carried (`carryLimit`): a pack in a pack is held by that pack, not the body.
       -- Only an enchanted thing has one; anything else adds nought (`enchant_of`).
       + coalesce((select sum(enchant_of(i, 'mule')) from item i
                    where i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid
                      and i.enchant is not null), 0))
       -- And all of it by the bags worn (`bags_carry`).
       * (1 + bags_carry(p_world, p_uid))
$fn$;

/** What is on a body as a share of what it takes: one is exactly full. */
create or replace function over_carry(p_world uuid, p_uid uuid) returns double precision language sql stable as $fn$
  select case when l.kg > 0 then carried_weight(p_world, p_uid) / l.kg else 0 end
    from (select carry_limit(p_world, p_uid) as kg) l
$fn$;

select private.lock_doors();
