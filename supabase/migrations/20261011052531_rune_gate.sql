/*
 * The rune gate (`runegate.ts`): two pillars cut with runes under a lintel,
 * a wall type planned with Plan fence on any border on the ground, laid in
 * stone brick and nothing else, a light mote set in each pillar. Nothing
 * hangs in it and nothing locks it.
 *
 * The defs just before this crossed its row (`wall_type_def`, and the new
 * `laid_in`: the one material a wall type is laid in) and its fittings. What
 * is new here is small:
 *
 *   * `material_only_refusal` asks a wall type's `laid_in` as well as a
 *     material's `only`, at every point it was already asked -- planning a
 *     wall, planning a fence and repointing -- in the browser's words
 *     (`onlyRefusal`, `laidInSaid`): "A rune gate is laid in stone brick and
 *     nothing else.";
 *   * and the rolls of the settlements rune gates stand on, for whoever is
 *     ashore (`rpc_rune_gate_folk`): the uids of each one's founder, mayors
 *     and builders. Its runes light while one of them is in the opening, and
 *     that is the browser's own doing from where it draws everybody; this is
 *     the one thing it could not know for anybody but itself.
 *
 * Rewritten here, from the newest migration that defines it:
 *   material_only_refusal -- 20261004211641_mosaic_only.sql
 */

/**
 * Why a material will not be laid as this wall type or this floor kind, or
 * null (`onlyRefusal`): a material with an `only` is laid as that and nothing
 * else; and a wall type with a `laid_in` is laid in that and nothing else.
 */
create or replace function material_only_refusal(p_material text, p_wall text, p_floor text)
returns text language sql stable as $$
  select coalesce(
    (select d.only_said from build_material_def d
      where d.id = p_material and d.only_said is not null
        and ((p_wall is not null and p_wall <> '' and not (p_wall = any(coalesce(d.only_walls, array[]::text[]))))
          or (p_floor is not null and p_floor <> '' and not (p_floor = any(coalesce(d.only_floors, array[]::text[])))))),
    (select upper(left(an(lower(t.name)), 1)) || substr(an(lower(t.name)), 2) || ' is laid in ' || lower(m.name) || ' and nothing else.'
       from wall_type_def t join build_material_def m on m.id = t.laid_in
      where p_material is not null and p_material <> '' and p_wall is not null
        and t.id = p_wall and t.laid_in is distinct from p_material))
$$;

/**
 * The citizens of every settlement a rune gate stands on: whose border takes
 * in the tile on either side of the gate's border. Each its token's `x` and
 * `y` and, in `folk`, the uids of its founder and of everybody on its roll at
 * builder or above -- never a guest (`RUNE_GATE_RANK`). A gate still being
 * built counts: its roll is sent before its last brick is in.
 */
create or replace function rune_gate_folk(p_world uuid) returns jsonb language sql stable as $fn$
  select coalesce(jsonb_agg(jsonb_build_object(
           'x', d.x, 'y', d.y,
           'folk', (select jsonb_agg(f.uid order by f.uid)
                      from (select d.founded_by as uid
                            union
                            select m.uid from deed_member m
                             where m.world_id = p_world and m.founder = d.founded_by
                               and deed_rank(m.role) >= deed_rank('builder')) f))
         order by d.x, d.y), '[]'::jsonb)
    from deed d
   where d.world_id = p_world
     and exists (select 1 from wall w
                  where w.world_id = p_world and w.type = 'rune_gate' and w.level = 0
                    and (deed_covers(d, w.x, w.y)
                         or deed_covers(d, w.x - case when w.dir = 'v' then 1 else 0 end,
                                           w.y - case when w.dir = 'h' then 1 else 0 end)))
$fn$;

/** The rolls a browser lights rune gates by, for whoever is ashore (`refreshGateFolk`). */
create or replace function rpc_rune_gate_folk(p_world uuid) returns jsonb
  language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  if not exists (select 1 from player where world_id = p_world and uid = me) then raise exception 'you are not on this island'; end if;
  return rune_gate_folk(p_world);
end $fn$;

notify pgrst, 'reload schema';
select private.lock_doors();
