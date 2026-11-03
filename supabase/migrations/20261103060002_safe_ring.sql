-- A safe ring round the spawn and every Runestone.
--
-- Asked: "a safe ring around spawn — no aggressive monsters within N tiles of the spawn point and of the runestones."
-- Everybody starts beside a Runestone now (first join, respawn), and the quiet beach (`peace_reach`, twenty-four tiles
-- each way from the spawn) covered only the spawn, where nobody starts any more.
--
-- The ring is `safe_ring()` tiles (the definitions before this one, 20261103060000_defs.sql; the browser's
-- `SAFE_RING`), measured straight from the middle of the spawn tile and of each stone's centre tile
-- (`safe_ring_on` in those definitions, the browser's `inSafeRing`). It takes over from the beach, which it holds:
-- `peace_reach()` is the same number under its old name.
--
--   1. Nothing the ring keeps out (`ring_keeps_out`: a monster, a hunter, a kind that stands aggressive) is put out
--      inside it (`pick_wild`): a kind that roams the wild there is rolled from the rest, so the ring carries as many
--      wild things as anywhere else. Nor is one rolled outside moved into it to find ground that suits it
--      (`creature_stock_block`).
--   2. No hunt of a creature's own starts while either it or the one it would hunt stands in the ring, and one that
--      comes into the ring, or is after somebody in it, lets go, turns for home and leaves hunting alone for
--      `hunt_rest()` (`hunt_settle`), as at the end of its leash. A hunt of its own is one no blow started:
--      `hunt_settle` clears `threat_at` when it starts one, and every blow, Challenge, Summons and Watchful sets it.
--      So a fight a player starts, or joins by striking, runs to its end inside the ring as outside it.
--   3. What is in the ring already, of a kind it keeps out, wild and held by nothing, goes (once, below).
--
-- A Sanctuary still ends every hunt on somebody inside it, as before (`in_sanctuary`). Tame creatures are not wild
-- and neither hunt nor are put out.
--
-- Cost: one `world` row and six squared distances, written out as one expression, per ask (about 9 us, against the
-- beach's 13 with a Sanctuary's ask in it); a stocking throw asks once, a hunter's settle at most twice, and only once
-- a hunt is about to start or is under way. The start branch asks for the beach after its notice check now rather than
-- before it, so a hunter with nobody in sight asks nothing at all.

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

-- ---- Where it is ----------------------------------------------------------------------------------------------------

-- `safe_ring_on`, whether a point is in the ring of a world of a size with its spawn where it is, is in the definitions
-- (20261103060000_defs.sql), written out stone by stone from `RUNESTONES` so that it is one expression and no query.

/**
 * Whether a point is in the safe ring of an island. PL/pgSQL, so the one query in it is planned once a session: as
 * SQL, inlined with the ring's expression into every caller, it was planned again at each ask, 300 us an ask against
 * the beach's 13.
 */
create or replace function in_safe_ring(p_world uuid, p_x double precision, p_y double precision)
  returns boolean language plpgsql stable as $$
declare v_size int; v_sx int; v_sy int;
begin
  select w.size, w.spawn_x, w.spawn_y into v_size, v_sx, v_sy from world w where w.id = p_world;
  return coalesce(safe_ring_on(v_size, v_sx, v_sy, p_x, p_y), false);
end $$;

/** Whether a point is inside a Sanctuary while it lasts. */
create or replace function in_sanctuary(p_world uuid, p_x double precision, p_y double precision)
  returns boolean language sql stable as $$
  select exists (select 1 from faith_zone z where z.world_id = p_world and z.kind = 'sanctuary' and z.until > now()
                   and (p_x - z.x) ^ 2 + (p_y - z.y) ^ 2 <= z.r ^ 2)
$$;

/** Where nothing hunts: the safe ring (was: the landing beach, `peace_reach` each way from the spawn), and a Sanctuary. */
create or replace function at_peace(p_world uuid, p_x double precision, p_y double precision)
  returns boolean language sql stable as $$
  select in_safe_ring(p_world, p_x, p_y) or in_sanctuary(p_world, p_x, p_y)
$$;

/** The kinds the ring keeps out: a monster, a hunter, a kind that stands aggressive. The browser's `ringKeepsOut`. */
create or replace function ring_keeps_out(p_species text) returns boolean language sql stable as $$
  select coalesce((select coalesce(s.monster, false) or coalesce(s.hunter, false) or s.default_stance is not distinct from 'aggressive'
                     from species_def s where s.id = p_species), false)
$$;

-- ---- 1. Not put out there -------------------------------------------------------------------------------------------

select pg_temp.patch_fn('public.pick_wild(uuid, integer, integer)'::regprocedure,
  'declare got text;', 'declare got text; v_ring boolean;');
select pg_temp.patch_fn('public.pick_wild(uuid, integer, integer)'::regprocedure,
  '  if not at_peace(p_world, p_x + 0.5, p_y + 0.5) and random() < monster_share() then',
  '  v_ring := in_safe_ring(p_world, p_x + 0.5, p_y + 0.5);
  if not (v_ring or in_sanctuary(p_world, p_x + 0.5, p_y + 0.5)) and random() < monster_share() then');
select pg_temp.patch_fn('public.pick_wild(uuid, integer, integer)'::regprocedure,
  'select species into got from wild_table where not monster
',
  'select species into got from wild_table where not monster
    -- In the safe ring, none of the kinds it keeps out (`ring_keeps_out`).
    and not (v_ring and ring_keeps_out(species))
');

select pg_temp.patch_fn('public.creature_stock_block(uuid, integer, integer)'::regprocedure,
  '      if v_site.x is null then continue; end if;
',
  '      if v_site.x is null then continue; end if;
      -- Never into the safe ring, a kind it keeps out.
      if ring_keeps_out(v_got) and in_safe_ring(p_world, v_site.x + 0.5, v_site.y + 0.5) then continue; end if;
');

-- And a throw in the ring that puts nothing out, in monster country, where nothing else is put out either, is not
-- monster country full: it does not count towards the eight that end a block's stocking. The live island's rings are
-- clear of monster country; a test's island of sixty-four, all of it inside the spawn's ring, has an eighth of it in it.
select pg_temp.patch_fn('public.creature_stock_block(uuid, integer, integer)'::regprocedure,
  '      v_none := v_none + 1;
',
  '      if not in_safe_ring(p_world, v_x + 0.5, v_y + 0.5) then v_none := v_none + 1; end if;
');

-- ---- 2. No hunt there -------------------------------------------------------------------------------------------------

-- A hunt of its own that came into the ring, or is after somebody in it: let go, home, and leave hunting alone, as at
-- the end of the leash.
select pg_temp.patch_fn('public.hunt_settle(uuid, creature, species_def, age_def)'::regprocedure,
  '         > hunt_home() then',
  '         > hunt_home()
       -- Or a hunt of its own, which no blow started, in the safe ring: it, or the one it is after (`safe_ring`).
       or (c.threat_at is null and (in_safe_ring(p_world, p.x, p.y) or in_safe_ring(p_world, v_cx, v_cy))) then');
-- A fight somebody started runs on in the ring; a Sanctuary still ends it.
select pg_temp.patch_fn('public.hunt_settle(uuid, creature, species_def, age_def)'::regprocedure,
  'or at_peace(p_world, p.x, p.y) or p.d > faith_shroud(p_world, p.uid) then',
  'or in_sanctuary(p_world, p.x, p.y) or p.d > faith_shroud(p_world, p.uid) then');
-- None starts while either stands in the ring, asked once one would start rather than first.
select pg_temp.patch_fn('public.hunt_settle(uuid, creature, species_def, age_def)'::regprocedure,
  '    -- Nothing comes for you across ground it cannot stand on, and nothing
    -- comes for you at all while you are still standing on the beach.
    if at_peace(p_world, p.x, p.y) then return c; end if;
',
  '    -- Nothing comes for you across ground it cannot stand on.
');
select pg_temp.patch_fn('public.hunt_settle(uuid, creature, species_def, age_def)'::regprocedure,
  '    c.hunting := p.uid;
    -- Where the leash is tied, and a fresh count of blows.',
  '    -- Nor while you stand in the safe ring or a Sanctuary (`at_peace`), or it stands in the ring.
    if at_peace(p_world, p.x, p.y) or in_safe_ring(p_world, v_cx, v_cy) then return c; end if;
    c.hunting := p.uid;
    -- A hunt of its own: no blow started it, so the safe ring may call it off; the first blow struck sets it again.
    c.threat_at := null;
    -- Where the leash is tied, and a fresh count of blows.');

-- ---- 3. What is there already ---------------------------------------------------------------------------------------

-- Every wild one of a kind the ring keeps out standing in it, or with its home in it, that nothing has hold of: the
-- holds `wild_turnover` asks for, monsters included, but for a pack's: the whole pack goes, and one left outside the
-- ring with its leader gone turns tail as when a leader dies.
with held as (
  select e.world_id, h.id from creature e
    cross join lateral unnest(array[e.enemy, e.brawl,
      case when e.hurt_at > now() - make_interval(secs => blow_memory()) then e.hurt_by end]) as h(id)
   where h.id is not null
     and (e.enemy is not null or e.brawl is not null or e.hurt_by is not null)
  union
  select p.world_id, (p.act_target->>'id')::int from player p
   where p.act is not null and p.act_target->>'kind' in ('creature', 'enemy', 'wildermon')
  union
  select p.world_id, (p.stats->>'hurtBy')::int from player p where p.stats ? 'hurtBy'
  union
  select m.world_id, m.creature_id from class_mark m where m.until > now()
  union
  select m.world_id, m.creature_id from faith_mark m where m.until > now()
  union
  select m.world_id, m.creature_id from faith_weak m where m.until > now()
  union
  select o.world_id, o.creature_id from faith_owed o
), gone as (
  delete from creature c using world w
   where w.id = c.world_id and c.mode = 'wild' and ring_keeps_out(c.species)
     and (safe_ring_on(w.size, w.spawn_x, w.spawn_y, c.to_x, c.to_y)
          or (c.home_x is not null and safe_ring_on(w.size, w.spawn_x, w.spawn_y, c.home_x, c.home_y)))
     and c.keeper is null and c.trapped is null and c.hitched_to is null and c.rider is null and c.post is null
     and c.enemy is null and c.brawl is null and c.hunting is null
     and (c.hurt_at is null or c.hurt_at <= now() - make_interval(secs => blow_memory()))
     and not exists (select 1 from held where held.world_id = c.world_id and held.id = c.id)
  returning c.world_id, c.id
), freed as (
  update creature e set enemy = null from gone g where e.world_id = g.world_id and e.enemy = g.id returning 1
), unmarked as (
  delete from class_mark m using gone g where m.world_id = g.world_id and m.creature_id = g.id returning 1
), unjudged as (
  delete from faith_mark m using gone g where m.world_id = g.world_id and m.creature_id = g.id returning 1
), unweakened as (
  delete from faith_weak m using gone g where m.world_id = g.world_id and m.creature_id = g.id returning 1
)
select count(*) as cleared_from_the_ring from gone;

select private.lock_doors();
