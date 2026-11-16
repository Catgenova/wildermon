/*
 * Where to wake after a death: the body held on the spawn until it picks, and the death said over the chooser.
 *
 * Reported again: "still getting no prompt on where to spawn when I died, should be the ability to spawn at my
 * settlement totem or a runestone of my choice". The offer (`respawn_offer`) stands only while the body is on the
 * tile death woke it on (`respawn_fall`). A death puts the body there (`player_die`), and the browser does not know
 * until the island tells it: a body walking when it died -- fleeing, chasing, a click away -- says where it walked
 * to next, from the ground it fell on. `rpc_move` took that word as a walk from the spawn, pulled it a walk's worth
 * towards the fall (`allowed`, several tiles), and answered "held to its pace" (`pulled`, not `blocked`), so the
 * browser took the walk up again from there. The body was off the spawn tile on the first word after the death, the
 * next beat withdrew the offer, and the chooser never showed. The fix of 2 November ended the walk in the browser,
 * but only for a put that was not a pull, and the island had already moved the body.
 *
 *   * `rpc_move`: while the offer stands, a word claiming more than a walk could have gone, or any word off the
 *     tile in the first `respawn_hold` seconds after the death, is from before it: the body stays on the spawn, and
 *     the answer says held (`pulled` and `blocked`), so the walk is not taken up from there.
 *
 * And asked for: a card over the chooser with how you died. The fall keeps it (`private.fallen`), and the offer
 * says it:
 *
 *   * `cause`: what took the last of the health, set by whatever did (`island.death`, read by `player_die`): a blow
 *     (`hurt_player`), bleeding (`wounds_settle`), the water, lava or the heat (`body_settle`), a Feral Bond
 *     (`class_bond_give`) or an oath (`faith_oath`); a blow or bleeding named by the last blow's creature;
 *   * `blows`: the last `death_blows` blows that landed in the `death_blows_secs` before it (`private.blow`, kept by
 *     `hurt_player`): what struck, the wound, where, the health taken, the killing one marked;
 *   * `things`: the death grace's seconds left, or the grave and how many things are in it, or nothing carried
 *     (`grave` false);
 *   * the offer adds when (`at`, and `clock`: the island's clock then), and the region it fell in (`region_at`).
 */
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

-- Seconds after a death in which any word off the spawn tile is taken as said before it (`rpc_move`).
create or replace function respawn_hold() returns double precision language sql immutable as $$ select 10::double precision $$;
-- The most blows a death card lists, and how far back before the death a blow is one of them, in seconds.
create or replace function death_blows() returns int language sql immutable as $$ select 5 $$;
create or replace function death_blows_secs() returns double precision language sql immutable as $$ select 300::double precision $$;

-- How the body died, its last blows, and what became of what it carried: said by the offer (`respawn_offer`).
alter table private.fallen add column if not exists cause jsonb;
alter table private.fallen add column if not exists blows jsonb;
alter table private.fallen add column if not exists things jsonb;

/* Each blow that landed on a body (`hurt_player`), the last `death_blows` kept; taken off at its death. */
create table if not exists private.blow (
  world_id uuid not null,
  uid uuid not null,
  n bigint generated always as identity,
  at timestamptz not null default now(),
  -- What struck: its kind as named in a fight (`kind_name_at`), and its own name where that is not its kind's.
  by text,
  name text,
  -- The wound (`wound_kind_def`), where (`hit_location`), and the health it took.
  what text,
  part text,
  taken double precision,
  primary key (world_id, uid, n)
);
alter table private.blow enable row level security;
revoke all on table private.blow from public, anon, authenticated;

/* A blow that landed, kept for the death card: the newest `death_blows` of a body. */
create or replace function private.blow_note(p_world uuid, p_uid uuid, c creature, p_what text, p_kind text, p_part text, p_taken double precision)
returns void language plpgsql as $$
begin
  insert into private.blow (world_id, uid, by, name, what, part, taken)
  values (p_world, p_uid, coalesce(kind_name_at(c), p_what),
          case when c.id is not null and c.name is distinct from (select sd.name from species_def sd where sd.id = c.species) then c.name end,
          p_kind, p_part, p_taken);
  delete from private.blow b
   where b.world_id = p_world and b.uid = p_uid
     and b.n <= (select o.n from private.blow o where o.world_id = p_world and o.uid = p_uid
                  order by o.n desc offset death_blows() limit 1);
end $$;

/*
 * What a death keeps for its card (`player_die`, last): the cause said by what killed it (`island.death`, taken off
 * as it is read), the last blows, and what became of what it carried.
 */
create or replace function private.fall_note(p_world uuid, p_uid uuid, p_grace double precision)
returns void language plpgsql as $$
declare v_cause jsonb; v_blows jsonb; v_last jsonb; v_things jsonb; g placed;
begin
  v_cause := coalesce(nullif(current_setting('island.death', true), '')::jsonb, '{}'::jsonb);
  perform set_config('island.death', '', true);
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'by', b.by, 'name', b.name, 'what', b.what, 'part', b.part, 'taken', b.taken, 'at', b.at,
           'kill', case when b.kill then true end))
         order by b.n), '[]'::jsonb)
    into v_blows
    -- The killing blow: the newest, landed this moment, of a death by a blow.
    from (select l.*, v_cause->>'kind' = 'blow' and l.at = now() and l.n = max(l.n) over () as kill
            from (select * from private.blow o
                   where o.world_id = p_world and o.uid = p_uid and o.at > now() - make_interval(secs => death_blows_secs())
                   order by o.n desc limit death_blows()) l) b;
  -- A blow, or bleeding, named by the last blow's creature.
  v_last := v_blows -> -1;
  if v_cause->>'kind' in ('blow', 'bled') and v_cause->>'by' is null and v_last is not null then
    v_cause := v_cause || jsonb_strip_nulls(jsonb_build_object('by', v_last->'by', 'name', v_last->'name'));
  end if;
  delete from private.blow where world_id = p_world and uid = p_uid;
  -- The grave `bury` dug this moment, and what is in it.
  select * into g from placed pl
   where pl.world_id = p_world and pl.made_by = p_uid and pl.kind = 'furniture' and pl.sub = 'grave'
     and pl.crumbles_at = now() + make_interval(secs => grave_keeps())
   order by pl.id desc limit 1;
  v_things := case
    when p_grace is not null then jsonb_build_object('grace', p_grace)
    when g.id is not null then jsonb_build_object('grave', jsonb_build_object('x', g.x, 'y', g.y,
      'n', (select count(*) from item i where i.world_id = p_world and i.placed = g.id), 'keeps', grave_keeps()))
    -- Nothing carried: false, which the offer's stripping of nulls keeps.
    else jsonb_build_object('grave', false) end;
  update private.fallen set cause = case when v_cause ? 'kind' then v_cause end, blows = v_blows, things = v_things
   where world_id = p_world and uid = p_uid;
end $$;

revoke all on function private.blow_note(uuid, uuid, creature, text, text, text, double precision) from public, anon, authenticated;
revoke all on function private.fall_note(uuid, uuid, double precision) from public, anon, authenticated;

select pg_temp.patch_fn('player_die(uuid, uuid)',
  $o$  perform tell(p_world, p_uid, v_said, 'error');$o$,
  $n$  -- How it died, its last blows and what became of what it carried, for the card over the chooser (`private.fall_note`).
  perform private.fall_note(p_world, p_uid, v_grace);
  perform tell(p_world, p_uid, v_said, 'error');$n$);

-- Each blow that lands, kept for the death card.
select pg_temp.patch_fn('hurt_player(uuid, uuid, double precision, text, text)',
  $o$  perform tell(p_world, p_uid, p_what || note || '. Wound: ' || wound_text(w) || '.', 'fight');$o$,
  $n$  perform tell(p_world, p_uid, p_what || note || '. Wound: ' || wound_text(w) || '.', 'fight');
  perform private.blow_note(p_world, p_uid, v_from, p_what, p_kind, part, taken);$n$);

-- And what took the last of the health, for `player_die` (`private.fall_note`).
select pg_temp.patch_fn('hurt_player(uuid, uuid, double precision, text, text)',
  $o$  elsif health <= 0 then perform player_die(p_world, p_uid);$o$,
  $n$  elsif health <= 0 then perform set_config('island.death', '{"kind": "blow"}', true); perform player_die(p_world, p_uid);$n$);
select pg_temp.patch_fn('wounds_settle(uuid, uuid)',
  $o$  if health <= 0 then perform player_die(p_world, p_uid); end if;$o$,
  $n$  if health <= 0 then perform set_config('island.death', '{"kind": "bled"}', true); perform player_die(p_world, p_uid); end if;$n$);
select pg_temp.patch_fn('body_settle(uuid, uuid)',
  $o$  if hp <= 0 then perform player_die(p_world, p_uid); end if;$o$,
  $n$  if hp <= 0 then
    -- The water, lava underfoot, or the heat.
    perform set_config('island.death', jsonb_strip_nulls(jsonb_build_object('kind',
      case when gasped > 0 then 'drowned' when v_on then 'lava' when v_heat > 0 then 'heat' end))::text, true);
    perform player_die(p_world, p_uid);
  end if;$n$);
select pg_temp.patch_fn('class_bond_give(uuid, creature, double precision)',
  $o$    perform player_die(p_world, c.keeper);$o$,
  $n$    perform set_config('island.death', jsonb_strip_nulls(jsonb_build_object('kind', 'bond', 'by', kind_name_at(c)))::text, true);
    perform player_die(p_world, c.keeper);$n$);
select pg_temp.patch_fn('faith_oath(uuid, uuid, double precision)',
  $o$then perform player_die(p_world, o); end if;$o$,
  $n$then
    perform set_config('island.death', jsonb_strip_nulls(jsonb_build_object('kind', 'oath',
      'by', (select pl.name from player pl where pl.world_id = p_world and pl.uid = p_uid)))::text, true);
    perform player_die(p_world, o);
  end if;$n$);

-- The offer says the death: when, the island's clock then, the region, the cause, the last blows, what was kept.
select pg_temp.patch_fn('respawn_offer(uuid, uuid)',
  $o$  return jsonb_build_object('x', f.x, 'y', f.y, 'deeds', coalesce(($o$,
  $n$  return jsonb_strip_nulls(jsonb_build_object('at', f.at,
           'clock', (select extract(epoch from (f.at - w.epoch)) from world w where w.id = p_world),
           'region', region_at(p_world, f.x, f.y), 'cause', f.cause, 'blows', f.blows, 'things', f.things))
    || jsonb_build_object('x', f.x, 'y', f.y, 'deeds', coalesce(($n$);

/*
 * A word from before the death (`rpc_move`): while the body may pick where to wake (`respawn_fall`), a word claiming
 * more than a walk could have gone, or any word off the spawn tile in the first `respawn_hold` seconds, leaves the
 * body on the spawn, held (`blocked`) so the browser does not take the walk up from there.
 */
select pg_temp.patch_fn('rpc_move(uuid, double precision, double precision, integer, jsonb)',
  $o$v_turn jsonb; v_leg int;$o$,
  $n$v_turn jsonb; v_leg int; v_fall private.fallen;$n$);
select pg_temp.patch_fn('rpc_move(uuid, double precision, double precision, integer, jsonb)',
  $o$  if far > allowed then
    if array_length(v_xs, 1) > 2 then$o$,
  $n$  v_fall := private.respawn_fall(p_world, me);
  if v_fall.uid is not null and (far > allowed
       or (v_fall.at > now() - make_interval(secs => respawn_hold())
           and (floor(p_x)::int <> v_fall.wx or floor(p_y)::int <> v_fall.wy or coalesce(p_level, 0) <> 0))) then
    p_x := p.x; p_y := p.y; p_level := coalesce(p.level, 0);
    far := 0;
    v_xs := array[p.x, p.x]; v_ys := array[p.y, p.y];
    pulled := true; blocked := true;
  end if;
  if far > allowed then
    if array_length(v_xs, 1) > 2 then$n$);

select private.lock_doors();
