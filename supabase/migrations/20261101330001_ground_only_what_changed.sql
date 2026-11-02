-- The ground read: only what changed since the last answer, and the water asked only of a well.
--
-- Measured on the live island (pg_stat_statements, a Medium instance): `rpc_ground` was 8% of all the database's
-- time, 35 ms a call. Every browser asks it once a second while it moves or works (`GROUND_EVERY`) and every
-- `GROUND_IDLE` seconds while it stands, and every answer built every piece set down within forty tiles again, with
-- its contents, its riders, its grave, its moss, whether or not anything about it had moved since the second before.
-- Measured on a test island sized like a settlement (114 pieces, 25 crates, 60 things lying about, 110 walls), the
-- burning half was 26 ms and 120 kB an answer, and a dozen of the pieces change from one second to the next.
--
-- ---- the same answer, cheaper -----------------------------------------------------------------------------
--
-- A third of that was `is_well`, asked twice of every piece (`placed_litres`, `placed_liquid`), a function call each.
-- Only a well's water is not its column, so only a piece of a kind that is a well (`furniture_def.well`) asks now.
-- The same answer, key for key (`supabase/test/grounddelta.ts` holds it against the read as it was).
--
-- ---- only what changed ------------------------------------------------------------------------------------
--
-- A browser that hands back the cursor of its last answer (`p_since`) is sent only what changed, as the creatures
-- read does (20261101290001):
--
--   * every answer in the new shape carries `at`: where the body stood, how far it read, how many things were in the
--     pieces within reach of it, and the snapshot it was read in, as `g1:<x>:<y>:<range>:<n>:v1:<ms>:<xmin>:<xmax>:<xip,...>`;
--   * handed back, the answer's `placed`, `lying` and `cellarLying` carry only the rows written since (a row version
--     not visible to that snapshot), and those not in range of where the body stood then; and `ids`, every id in each
--     list now, so the browser keeps those rows and lets the rest go;
--   * and, whatever their row says, the pieces whose answer moves without their row being written: one burning, a
--     grave, a shop counter, one with somebody at its reins or helm, a well, a mossy one, a boat; those come into reach
--     (six tiles, what `things` is said for) or gone out of it; and every one within reach of where the body stands
--     or stood when a thing in one of those has been written since or there are fewer of them;
--   * `crates` and the slow half are sent whole, as they always were;
--   * a cursor older than `private.since_most()` seconds, unreadable, or read over another range is answered whole,
--     with `full`; and a browser asks for the whole answer with every slow half: every `RECONCILE_EVERY` seconds and
--     after anything it does;
--   * a browser that says no cursor is sent what it always was, so a page from before this still works.

set local lock_timeout = '3s';

drop function if exists public.rpc_ground(uuid, double precision, boolean);

CREATE OR REPLACE FUNCTION public.rpc_ground(p_world uuid, p_range double precision DEFAULT 40, p_slow boolean DEFAULT true, p_since text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); p player; v_field double precision; v_box double precision; v_hand double precision;
        -- When greening came to this island (`greening.ts`).
        v_from timestamptz := (select w.green_from from world w where w.id = p_world);
        -- The kinds of furniture that are wells (`is_well`): only theirs is asked how much water is in them.
        v_wells text[] := array(select d.id from furniture_def d where d.well > 0);
        -- What the browser last saw (`since_snap`) and where the body stood then, or null for the whole answer.
        v_snap bigint[]; v_wx double precision; v_wy double precision; m text[];
        -- Pieces whose answer moves without their row being written: a well, a mossy one, a boat (who is aboard).
        v_hot text[];
        -- How many things are in the pieces within reach (`things`) of where the body stands, and stood; and whether
        -- what is in those it stood by has changed since (`v_reach`).
        v_n int; v_was_n int; v_reach boolean;
        v_at text; v_placed jsonb; v_lying jsonb; v_cellar jsonb;
        v_pids bigint[]; v_lids bigint[]; v_cids bigint[]; v_out jsonb;
begin
  perform private.pace(auth.uid(), 'look');
  p_range := least(greatest(coalesce(p_range, 0), 0), private.read_range_most());
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select * into p from player where world_id = p_world and uid = me;
  if not found then raise exception 'you are not on this island'; end if;
  /*
   * On the slow half only, because this writes.
   *
   * The fast read runs about once a second per body — everything burning, what
   * is on the tile under you — and a settle on that path is an update a second
   * per player whether or not anything is due. The crops ride the slow half
   * beside the settlements, and any of your own work forces one of those, so
   * sowing is seen at once and a stage is at worst one reconcile late.
   */
  if p_slow then
    perform crops_settle(p_world, p.x, p.y, p_range);
    perform planters_settle(p_world, p.x, p.y, p_range);
    -- Each clock read once, for every crop on it.
    v_field := crop_clock(false, now());
    v_box := crop_clock(true, now());
    v_hand := hand_clock(now());
  end if;
  /*
   * Only what changed since the cursor the browser hands back (`p_since`, `g1:<x>:<y>:<range>:<n>:<v1 cursor>`):
   * where the body stood, how far it read, how many things were in the pieces within reach of it, and the snapshot it
   * was read in (`since_snap`). Unreadable, too old, or read over another range: the whole answer.
   */
  if p_since is not null then
    m := regexp_match(p_since, '^g1:(-?[0-9.]+(?:e[-+]?[0-9]+)?):(-?[0-9.]+(?:e[-+]?[0-9]+)?):([0-9.]+(?:e[-+]?[0-9]+)?):([0-9]{1,9}):(v1:.*)$');
    if m is not null and m[3]::double precision = p_range then
      v_snap := private.since_snap(m[5]);
      v_wx := m[1]::double precision;
      v_wy := m[2]::double precision;
    end if;
  end if;
  if v_snap is not null then
    v_hot := array(select d.id from furniture_def d where d.well > 0 or d.mossy union select b.id from boat_def b);
  end if;
  /*
   * The cursor before anything is read: every statement below sees at least what this snapshot saw, so a row is
   * never counted as seen that was not, and one written in between is only sent twice.
   */
  v_at := floor(extract(epoch from now()) * 1000)::bigint || ':' || private.since_text(pg_current_snapshot());
  /*
   * What is in the pieces within reach, which the pieces' own rows do not say: counted where the body stands, for
   * the next cursor, and where it stood, against the count the cursor carries. A thing put in has a row written
   * since; one taken out is one fewer. Either way every piece within reach of either is sent again; otherwise only
   * those come into reach or gone out of it. Counted before the pieces are read, so a thing taken out in between is
   * one fewer next time rather than never.
   */
  if p_since is not null then
    select count(*) into v_n
      from item i join placed pl on pl.world_id = p_world and pl.id = i.placed
     where i.world_id = p_world and i.holder = 'furniture'
       and pl.x between floor(p.x - 6)::int - 1 and floor(p.x + 6)::int + 1
       and pl.y between floor(p.y - 6)::int - 1 and floor(p.y + 6)::int + 1
       and greatest(abs(pl.cx - p.x), abs(pl.cy - p.y)) <= 6;
    v_at := 'g1:' || p.x::text || ':' || p.y::text || ':' || p_range::text || ':' || v_n || ':v1:' || v_at;
  end if;
  if v_snap is not null then
    select count(*), coalesce(bool_or(private.since_new(i.xmin, v_snap)), false) into v_was_n, v_reach
      from item i join placed pl on pl.world_id = p_world and pl.id = i.placed
     where i.world_id = p_world and i.holder = 'furniture'
       and pl.x between floor(v_wx - 6)::int - 1 and floor(v_wx + 6)::int + 1
       and pl.y between floor(v_wy - 6)::int - 1 and floor(v_wy + 6)::int + 1
       and greatest(abs(pl.cx - v_wx), abs(pl.cy - v_wy)) <= 6;
    v_reach := v_reach or v_was_n <> m[4]::int;
  end if;
  select coalesce(jsonb_agg(
        (to_jsonb(pl) - 'world_id' - 'made_by' - 'since' - 'made_at' - 'cx' - 'cy' - 'crumbles_at')
        -- How much water is in it is asked only of a well, which is the only one it is not the column's (`placed_litres`).
        || jsonb_build_object('fuel', placed_fuel(pl), 'ash', placed_ash(pl),
                              'litres', case when pl.sub = any (v_wells) then placed_litres(pl) else pl.litres end,
                              'liquid', case when pl.sub = any (v_wells) then placed_liquid(pl) else pl.liquid end,
                              'lit', placed_lit(pl), 'mine', coalesce(pl.made_by = me, false),
        /*
         * And what is in it, which this never said.
         *
         * Reported as "i opened it and dragged my dirt into it and the dirt
         * vanished". It had not: the island had the dirt in the bin and told
         * nobody. Every chest, bin, larder and cart on an island read as
         * empty over there, so anything put away went out of the pack and was
         * never seen again — the same hole a crate fell down before crates
         * carried their contents, and closed the same way. Within six tiles
         * only: you must be within two and a half to reach into one, so six
         * is generous, and a yard of full chests is not worth a phone's
         * second.
         */
                              'things', case when pl.kind = 'furniture'
                                              and greatest(abs(pl.cx - p.x), abs(pl.cy - p.y)) <= 6
                                              -- A grave's, to whoever lies under it and nobody else.
                                              and (pl.crumbles_at is null or pl.made_by = me)
                                then coalesce((select jsonb_agg(jsonb_build_object(
                                       'id', i.id, 'def', i.def, 'ql', i.ql, 'dmg', i.dmg,
                                       'count', i.count, 'extra', i.extra,
                                       -- And its rarity, its colour and its enchantment, which a chest's name for it carries (`storedThing`).
                                       'rare', i.rare, 'dye', i.dye, 'enchant', i.enchant, 'creature', i.creature, 'occupant', case when i.creature is not null then occupant_name(i.world_id, i.creature) end, 'price', i.price) order by i.id)
                                     from item i
                                     where i.world_id = p_world and i.holder = 'furniture' and i.placed = pl.id),
                                   '[]'::jsonb)
                                else '[]'::jsonb end)
        /*
         * Whether a helm is as good as empty, its holder gone away, and who is
         * aboard as a passenger and in which place: only for a piece that has
         * either, so nothing else carries two more keys it does not need.
         */
        || case when pl.driver is null then '{}'::jsonb
                else jsonb_build_object('helm_open', coalesce((select r.away from player r
                       where r.world_id = p_world and r.uid = pl.driver), true)) end
        || coalesce((select jsonb_build_object('riders', jsonb_agg(jsonb_build_object('uid', r.uid, 'seat', r.seat)
                       order by r.seat))
                     from player r where r.world_id = p_world and r.aboard = pl.id
                     having count(*) > 0), '{}'::jsonb)
        /*
         * And a grave: whose it is, for what anybody else is told when they
         * try it; the seconds it has left, which a browser counts down on its
         * own clock rather than reading this island's; and, to its owner, how
         * many things are in it, which `things` only says from within reach --
         * the way `units` rides beside a crate's contents.
         */
        || case when pl.crumbles_at is null then '{}'::jsonb
                else jsonb_build_object('grave', jsonb_build_object('name', grave_owner(pl),
                       'left', greatest(0, extract(epoch from (pl.crumbles_at - now()))),
                       'units', case when pl.made_by = me then (select coalesce(sum(i.count), 0) from item i
                                  where i.placed = pl.id and i.holder = 'furniture') end)) end
        /*
         * And for a piece with roses on it, the moment it was set down, which
         * is what its roses grow from (`roses.ts`): the same moment for
         * everybody, and sent for nothing else.
         */
        || case when coalesce((select fd.roses from furniture_def fd where fd.id = pl.sub), false)
                then jsonb_build_object('set', extract(epoch from pl.made_at)) else '{}'::jsonb end
        /*
         * And for a piece that gathers moss -- a statue -- the seconds since
         * the moss on it began: since it was set down or last scrubbed, and
         * never from before greening came in (`greening.ts`). Only for those,
         * so nothing else carries a key it does not need.
         */
        || case when pl.kind = 'furniture' and pl.sub in (select fd.id from furniture_def fd where fd.mossy)
                then jsonb_build_object('green_ago', green_ago(greatest(pl.made_at,
                       (select gs.since from green_since gs where gs.world_id = p_world and gs.thing = 'piece'
                           and gs.x = pl.x and gs.y = pl.y and gs.k = pl.id)), v_from))
                else '{}'::jsonb end
        -- And for a shop counter's store, what is set out on it and for whom (`counters.ts`).
        || case when pl.kind = 'counter' then counter_json(pl, me, p.x, p.y) else '{}'::jsonb end
        order by pl.id) filter (where v_snap is null
          -- One written since, or one not in range of where the body stood then.
          or private.since_new(pl.xmin, v_snap)
          or not (greatest(abs(pl.cx - v_wx), abs(pl.cy - v_wy)) <= p_range)
          -- And those whose answer moves without their row being written: burning (its fuel, its ash), a grave (its
          -- seconds, what is in it), a shop counter (its wares, its keeper's name), one with somebody at its reins or
          -- helm (whether they are away), a well, a mossy one, a boat (`v_hot`).
          or pl.lit or pl.crumbles_at is not null or pl.kind = 'counter' or pl.driver is not null
          or pl.sub = any (v_hot)
          -- And what is in a piece (`things`, said within six tiles): come into reach or gone out of it, or every one
          -- within reach of where the body stands or stood when what is in them has changed (`v_reach`).
          or (greatest(abs(pl.cx - p.x), abs(pl.cy - p.y)) <= 6) <> (greatest(abs(pl.cx - v_wx), abs(pl.cy - v_wy)) <= 6)
          or (v_reach and (greatest(abs(pl.cx - p.x), abs(pl.cy - p.y)) <= 6
                           or greatest(abs(pl.cx - v_wx), abs(pl.cy - v_wy)) <= 6))), '[]'::jsonb),
         coalesce(array_agg(pl.id order by pl.id), '{}')
    into v_placed, v_pids
      from placed pl
      where pl.world_id = p_world
        -- The box first, in the whole tiles `placed_near` is keyed on, and then
        -- the exact question. A btree cannot look up a function of a column, so
        -- the exact test on its own read every placed thing on the island, on
        -- every ground poll, for every player. `x` is `floor(cx)` and `y` is
        -- `floor(cy)` -- `drag_along` and every placing write both together --
        -- so a tile of slack each way makes the box a superset of the answer
        -- and the line below still decides who is in it.
        and pl.x between floor(p.x - p_range)::int - 1 and floor(p.x + p_range)::int + 1
        and pl.y between floor(p.y - p_range)::int - 1 and floor(p.y + p_range)::int + 1
        and greatest(abs(pl.cx - p.x), abs(pl.cy - p.y)) <= p_range;
  /*
   * And what is lying on the ground, which this never carried.
   *
   * Reported as "killed a roxxa, no corpse dropped to butcher, or at least
   * isn't displaying". The corpse was there: `wound_beast` drops one where
   * the thing fell, and the suite has measured it since kills were ported.
   * This sent the fires, the crates, the crops and the walls, and never a
   * thing lying on the grass — and the browser's map of the ground was only
   * ever written by its own rules, which do not run on an island. So a
   * corpse, a log a worker put down, a hatchet somebody else dropped: all
   * in this table and drawn by nobody.
   *
   * On the fast half, because a corpse is looked for the second the thing
   * goes down; `item_on_ground` serves the box. The whole row, the way the
   * pack is sent, so the browser reads it with the same map.
   */
  -- Sent again: one written since, or one not in the box round where the body stood.
  select coalesce(jsonb_agg(to_jsonb(i) - 'world_id' - array['origin', 'origin_fn', 'origin_uid'] order by i.id)
           filter (where v_snap is null or private.since_new(i.xmin, v_snap)
                   or not (i.gx between floor(v_wx - p_range)::int and floor(v_wx + p_range)::int
                           and i.gy between floor(v_wy - p_range)::int and floor(v_wy + p_range)::int)), '[]'::jsonb),
         coalesce(array_agg(i.id order by i.id), '{}')
    into v_lying, v_lids
      from item i
      where i.world_id = p_world and i.holder = 'ground'
        and i.gx between floor(p.x - p_range)::int and floor(p.x + p_range)::int
        and i.gy between floor(p.y - p_range)::int and floor(p.y + p_range)::int;
  select coalesce(jsonb_agg(to_jsonb(i) - 'world_id' - array['origin', 'origin_fn', 'origin_uid'] order by i.id) -- cellar
           filter (where v_snap is null or private.since_new(i.xmin, v_snap)
                   or not (i.gx between floor(v_wx - p_range)::int and floor(v_wx + p_range)::int
                           and i.gy between floor(v_wy - p_range)::int and floor(v_wy + p_range)::int)), '[]'::jsonb),
         coalesce(array_agg(i.id order by i.id), '{}')
    into v_cellar, v_cids
      from item i
      where i.world_id = p_world and i.holder = 'cellar' -- cellar
        and i.gx between floor(p.x - p_range)::int and floor(p.x + p_range)::int -- cellar
        and i.gy between floor(p.y - p_range)::int and floor(p.y + p_range)::int; -- cellar
  v_out := jsonb_build_object(
    'placed', v_placed,
    'crates', crates_near(p_world, me, p_range),
    'lying', v_lying,
    -- cellar: and what is lying on the floors of the cellars in range, the same way (`item_in_cellar` serves the box).
    'cellarLying', v_cellar)
  /*
   * And the half that hardly ever moves.
   *
   * A fire burns down and a kiln works through its load while you stand and
   * watch it, which is why this is asked for every second. A wall is not like
   * that: it goes up when somebody builds it and then it is a wall. Sending
   * both at one pace meant a correlated subquery over `building_tile` per
   * building, a scan of `wall` and one of `floor_tile`, every second for every
   * player, to say that the house is still a house.
   *
   * So the caller says whether it wants them. A browser asks for the lot on
   * its twenty-second reconcile and after any of its own work, and for the
   * burning half the rest of the time. Left out rather than emptied: the
   * browser applies only the keys it is given, so what it holds stands.
   *
   * `p_slow` defaults true, so a page that has not been redeployed gets
   * exactly what it always got.
   */
  || case when not p_slow then '{}'::jsonb else jsonb_build_object(
    /*
     * And everybody ashore, on the slow half, which is the beat that already
     * carries the settlements. The map draws them; `folk_ashore` decides
     * whether there is anything to draw them at.
     */
    'folk', folk_ashore(p_world, me),
    /*
     * And every grave of yours, however far off: you wake a long way from
     * where you fell, and `placed` above is only what is in range. The map
     * marks them and takes the mark up when one goes. Off the index the
     * sweep uses, which holds nothing but graves.
     */
    'graves', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'x', g.x, 'y', g.y) order by g.id)
      from placed g
      where g.world_id = p_world and g.crumbles_at is not null and g.made_by = me), '[]'::jsonb),
    /*
     * What is growing here, settled first so the stage reported is the stage
     * it is actually at rather than the stage it was at when somebody last
     * touched it. Everything on this island settles lazily off a timestamp,
     * and for a crop nobody had ever been the one to ask.
     *
     * `grown` rather than `stage_at`: how far into its stage it has grown, in
     * growing seconds on the clock it grows on, which the browser lays on its
     * own reading of the same clock -- a winter between the stage's start and
     * now adds nothing to it. `ago`, the wall seconds, is what a page from
     * before the year reads.
     */
    'crops', coalesce((select jsonb_agg(jsonb_build_object(
        'x', c.x, 'y', c.y, 'id', c.id, 'stage', c.stage,
        'grown', case when c.hand and not c.glass then v_hand - hand_clock(c.stage_at) else crop_grown(c.glass, c.stage_at, v_field) end,
        'ago', extract(epoch from (now() - c.stage_at)),
        'tended', c.tended, 'tendedNow', c.tended_now, 'ql', c.ql, 'pace', c.pace)
        -- And a crop under glass says so, and `grown` is on the glass clock (`glasshouse.ts`).
        || case when c.glass then '{"glass": true}'::jsonb else '{}'::jsonb end
        -- And one sown with Love's Season's Hand, on its clock (`hand_clock`).
        || case when c.hand then '{"hand": true}'::jsonb else '{}'::jsonb end)
      from crop c
      where c.world_id = p_world
        and greatest(abs(c.x + 0.5 - p.x), abs(c.y + 0.5 - p.y)) <= p_range), '[]'::jsonb),
    -- And what grows in the planters, by the piece, on the planter's own clock.
    'planted', coalesce((select jsonb_agg(jsonb_build_object(
        'planter', c.placed, 'x', pl.x, 'y', pl.y, 'id', c.id, 'stage', c.stage,
        'grown', v_box - crop_clock(true, c.stage_at),
        'ago', extract(epoch from (now() - c.stage_at)),
        'tended', c.tended, 'tendedNow', c.tended_now, 'ql', c.ql, 'pace', c.pace) order by c.placed)
      from placed pl join planter_crop c on c.placed = pl.id
      where pl.world_id = p_world
        and pl.x between floor(p.x - p_range)::int - 1 and floor(p.x + p_range)::int + 1
        and pl.y between floor(p.y - p_range)::int - 1 and floor(p.y + p_range)::int + 1
        and greatest(abs(pl.cx - p.x), abs(pl.cy - p.y)) <= p_range), '[]'::jsonb),
    -- And the island's wall clock, which a field's clock is read off, so the browser reads it off the same one.
    'now', extract(epoch from now())::double precision,
    /*
     * The felling notches near you, and how long ago the woods last turned
     * over. Look reads both: "2 of 3 strokes in it", "the woods turn over in
     * 9 hours". A browser on an island keeps no clock of its own for the
     * woods, so this is the only place it hears the hour.
     */
    /*
     * The water lilies and lotus planted near you: when each was planted and
     * last picked, which is all of one. The browser works out the rest from
     * the year, as `water_plant_state` does.
     */
    'waterPlants', water_plants_near(p_world, p.x, p.y, p_range),
    'notches', coalesce((select jsonb_agg(jsonb_build_object('x', n.x, 'y', n.y, 'cuts', n.cuts))
      from tree_notch n
      where n.world_id = p_world
        and greatest(abs(n.x + 0.5 - p.x), abs(n.y + 0.5 - p.y)) <= p_range), '[]'::jsonb),
    'treesAgo', (select extract(epoch from (now() - w.trees_at)) from world w where w.id = p_world),
    -- The mark the ground is being worked to, which lives on the player row
    -- so that it is the same mark in every browser you open.
    'level', p.level_h,
    -- What you are on each of them, so the browser can say what you may do
    -- rather than finding out by being refused. Your own first one is your
    -- own or one you were asked onto; either way `deed_role` says which.
    'deed', (select jsonb_build_object(
        'name', d.name, 'x', d.x, 'y', d.y, 'radius', d.radius, 'level', d.level, 'mine', true,
        'role', deed_role(p_world, d.founded_by, me),
        'rank', (deed_rank_of(p_world, d.founded_by, me)).name,
        'perms', (deed_rank_of(p_world, d.founded_by, me)).perms,
        'baubles', deed_baubles_json(p_world, d.founded_by))
      from my_deed(p_world, me) d where d.world_id is not null),
    'deeds', coalesce((select jsonb_agg(jsonb_build_object(
        'name', d.name, 'x', d.x, 'y', d.y, 'radius', d.radius, 'level', d.level,
        -- Land you were asked onto is land you may work, so it is drawn as
        -- yours rather than as a stranger's border you happen to be inside.
        'mine', exists (select 1 from deed_member m where m.world_id = p_world
                          and m.uid = me and m.founder = d.founded_by),
        'role', deed_role(p_world, d.founded_by, me),
        'rank', (deed_rank_of(p_world, d.founded_by, me)).name,
        'perms', (deed_rank_of(p_world, d.founded_by, me)).perms,
        'holder', account_name(d.founded_by),
        -- And what is in its altar, for the settlements you are a citizen of.
        'baubles', case when exists (select 1 from deed_member m where m.world_id = p_world
                                       and m.uid = me and m.founder = d.founded_by)
                        then deed_baubles_json(p_world, d.founded_by) end) order by d.founded_at)
      from deed d
      where d.world_id = p_world and d.founded_by <> me
        and greatest(abs(d.x + 0.5 - p.x), abs(d.y + 0.5 - p.y)) <= p_range + d.radius),
      '[]'::jsonb),
    /*
     * And what is standing.
     *
     * `building`, `wall` and `floor_tile` have been kept here since buildings
     * were ported and have never been sent to anybody. The rules answered
     * about them, a plan went up in Postgres, and no browser ever drew a wall
     * of it — so on an island a building was invisible to everyone, the person
     * who planned it included.
     *
     * Shaped as the browser's own `BuildingsJSON`, so it is laid straight in.
     * A building comes along whole if any of its tiles is in range: half a
     * house is worse than none, and a house is a handful of rows.
     */
    'buildings', jsonb_build_object(
      -- cellar: what is dug out under the buildings sent (`BuildingsJSON.cellars`).
      'cellars', cellars_near(p_world, p.x, p.y, p_range),
      'nextId', coalesce((select max(b.id) + 1 from building b where b.world_id = p_world), 1),
      'list', coalesce((select jsonb_agg(jsonb_build_object(
          'id', b.id, 'name', b.name, 'levels', b.levels, 'workLevel', b.work_level,
          -- Frame: the shape of its roof, which says whether it is a terrace to rail.
          'roof', b.roof,
          'tiles', (select coalesce(jsonb_agg(bt.x || ',' || bt.y order by bt.y, bt.x), '[]'::jsonb)
                      from building_tile bt
                     where bt.world_id = p_world and bt.building = b.id))
          -- Piers: and its deck and its tiles on piers, if it has any (`piers_json`).
          || piers_json(p_world, b.id, b.deck) order by b.id)
        from building b
        where b.world_id = p_world
          and exists (select 1 from building_tile bt
                       where bt.world_id = p_world and bt.building = b.id
                         and greatest(abs(bt.x + 0.5 - p.x), abs(bt.y + 0.5 - p.y)) <= p_range)),
        '[]'::jsonb),
      'walls', coalesce((select jsonb_agg(jsonb_build_object(
          'building', w.building, 'level', w.level, 'x', w.x, 'y', w.y, 'dir', w.dir,
          -- gates: a hidden door its padlock does not admit is sent as the solid wall it looks like.
          'type', wall_seen_type(p_world, me, w), 'material', w.material, 'needed', w.needed, 'total', w.total,
          -- And the seconds since the ivy on a finished wall of stone or brick began (`greening.ts`).
          'greenAgo', case when bill_done(w.needed) and m.kind = 'stone' then green_ago(gs.since, v_from) end)
          -- gates: a portcullis let down, and a padlock this body may know of.
          || wall_gear(p_world, me, w)
          order by w.level, w.dir, w.x, w.y)
        from wall w
        left join build_material_def m on m.id = w.material
        left join green_since gs on gs.world_id = p_world and gs.thing = 'wall' and gs.x = w.x and gs.y = w.y
                                and gs.k = green_wall_k(w.level, w.dir)
        where w.world_id = p_world
          and greatest(abs(w.x + 0.5 - p.x), abs(w.y + 0.5 - p.y)) <= p_range), '[]'::jsonb),
      'floors', coalesce((select jsonb_agg(jsonb_build_object(
          'building', f.building, 'level', f.level, 'x', f.x, 'y', f.y,
          'material', f.material, 'kind', f.kind, 'facing', f.facing, 'hand', f.hand,
          'needed', f.needed, 'total', f.total) order by f.level, f.x, f.y)
        from floor_tile f
        where f.world_id = p_world
          and greatest(abs(f.x + 0.5 - p.x), abs(f.y + 0.5 - p.y)) <= p_range), '[]'::jsonb),
      -- Frame: the columns on the corners of its storeys.
      'columns', frame_columns_json(p_world, p.x, p.y, p_range),
      -- No plan: the sides drawn with no plan model (`no_plan_json`).
      'noPlan', no_plan_json(p_world, p.x, p.y, p_range)),
    /*
     * And the slabs, which are not buildings and do not go in with them: a
     * foundation is ground somebody poured, and the browser lays it beside the
     * terrain rather than inside a house.
     */
    'foundations', coalesce((select jsonb_agg(jsonb_build_object(
        'id', fo.id, 'x', fo.x, 'y', fo.y, 'top', fo.top, 'pool', fo.pool,
        'needed', fo.needed, 'total', fo.total,
        -- And the seconds since the moss on a poured one began.
        'greenAgo', case when bill_done(fo.needed) then green_ago(gs.since, v_from) end) order by fo.id)
      from foundation fo
      left join green_since gs on gs.world_id = p_world and gs.thing = 'slab' and gs.x = fo.x and gs.y = fo.y and gs.k = 0
      where fo.world_id = p_world
        and greatest(abs(fo.x + 0.5 - p.x), abs(fo.y + 0.5 - p.y)) <= p_range), '[]'::jsonb),
    'nextFoundationId', coalesce((select max(fo.id) + 1 from foundation fo where fo.world_id = p_world), 1),
    /*
     * And the bridges, shaped as the browser's own `Bridge`, spans and all.
     *
     * The island has kept `bridge` and `bridge_span` since bridges were ported
     * and never said a word about one, so on an island a bridge was drawn by
     * nobody and walked by nobody: the browser decides where its feet go, and
     * it had never heard of the deck. One comes whole if either end is in
     * range, and a stone arch with the seconds since the moss on it began.
     */
    'bridges', coalesce((select jsonb_agg(jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'ax', b.ax, 'ay', b.ay, 'bx', b.bx, 'by', b.by,
        'height', b.height, 'level', b.level, 'levelB', b.level_b, 'rise', b.rise, 'material', b.material,
        'spans', (select coalesce(jsonb_agg(jsonb_build_object('x', s.x, 'y', s.y, 'needed', s.needed, 'total', s.total)
                    order by s.n), '[]'::jsonb)
                  from bridge_span s where s.world_id = p_world and s.bridge = b.id),
        'greenAgo', case when bridge_mossy(b.kind) and not exists (select 1 from bridge_span s
                           where s.world_id = p_world and s.bridge = b.id and not span_done(s.needed))
                         then green_ago(gs.since, v_from) end)
        -- gates: a drawbridge drawn up, and the padlock on its winch.
        || bridge_gear(b) order by b.id)
      from bridge b
      left join green_since gs on gs.world_id = p_world and gs.thing = 'bridge' and gs.x = b.ax and gs.y = b.ay and gs.k = b.id
      where b.world_id = p_world
        and (greatest(abs(b.ax + 0.5 - p.x), abs(b.ay + 0.5 - p.y)) <= p_range
             or greatest(abs(b.bx + 0.5 - p.x), abs(b.by + 0.5 - p.y)) <= p_range)), '[]'::jsonb),
    /*
     * And the paving: the seconds since greening came in, which is when every
     * paved tile without a row of its own began, and the tiles in range paved
     * or scrubbed since, off the key's own box.
     */
    'greenFromAgo', extract(epoch from (now() - v_from))::double precision,
    'paving', coalesce((select jsonb_agg(jsonb_build_object('x', gs.x, 'y', gs.y, 'ago', green_ago(gs.since, v_from)))
      from green_since gs
      where gs.world_id = p_world and gs.thing = 'paving'
        and gs.x between floor(p.x - p_range)::int and floor(p.x + p_range)::int
        and gs.y between floor(p.y - p_range)::int and floor(p.y + p_range)::int), '[]'::jsonb)) end;
  -- A browser that said no cursor is sent what it always was.
  if p_since is null then return v_out; end if;
  /*
   * The new shape: the cursor, whether this is the whole answer, and, when it is not, every id in each list in
   * range (`ids`), so the browser keeps those and lets the rest go: `placed`, `lying` and `cellarLying` hold only
   * the rows sent again. `crates` and the slow half are whole, as they always were.
   */
  return v_out || jsonb_build_object('at', v_at, 'full', v_snap is null)
    || case when v_snap is null then '{}'::jsonb
            else jsonb_build_object('ids', jsonb_build_object('placed', to_jsonb(v_pids), 'lying', to_jsonb(v_lids), 'cellarLying', to_jsonb(v_cids))) end;
end $function$;

select private.lock_doors();
