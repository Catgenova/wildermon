/*
 * Mayors invite, and ranks are set.
 *
 * `deed_member.role` has held mayor, builder or guest since
 * `ranks_and_a_padlock`, and nothing on the island ever wrote it: every
 * citizen was the builder an invitation makes, and nobody could be made a
 * mayor. `rpc_invite` was the founder's alone, and so was sending anybody away.
 *
 * The rule now:
 *
 *   rank        the founder sets any citizen of theirs to mayor, builder or
 *               guest. A mayor sets a citizen below mayor -- a builder or a
 *               guest -- to builder or guest. Only the founder makes or
 *               unmakes a mayor, and nobody changes the founder's rank or
 *               their own. (`rpc_rank`)
 *   invite      the founder or a mayor of the settlement named. Called with
 *               two arguments, as a browser from before today does, it is the
 *               settlement the caller founded, as it always was. (`rpc_invite`)
 *   send away   the founder sends away anybody on the roll; a mayor sends
 *               away its builders and guests, not another mayor.
 *               (`rpc_leave_deed`)
 *
 * Upgrading, renaming and disbanding stay with the founder:
 * `settlement_refusal` reads `founded_by` and is untouched.
 *
 * An invitation is still the settlement's -- `deed_invite` is keyed by its
 * founder, so "already asked" holds whoever asked -- and now says who asked
 * (`asked_by`), so the person asked is told who it was and whoever asked hears
 * the answer as well as the founder.
 *
 * `rpc_social` says, for each settlement of yours, your rank on it and
 * everybody's on its roll, and lists the invitations out from every
 * settlement you may invite to, so the window refuses in the island's words.
 * `supabase/test/mayors.ts` holds the two sides to each other.
 *
 * Rewritten here, each from the newest migration that defines it:
 *   rpc_invite         -- 20260916310000_one_of_your_own_and_three_besides.sql
 *   rpc_invite_answer  -- 20260916310000_one_of_your_own_and_three_besides.sql
 *   rpc_leave_deed     -- 20260916310000_one_of_your_own_and_three_besides.sql
 *   rpc_social         -- 20261012230000_a_citizen_of_three_may_still_be_asked.sql
 */
set local lock_timeout = '3s';

alter table deed_invite add column if not exists asked_by uuid;

-- An invitation is between the two of them, and whoever sent it on the
-- settlement's behalf.
drop policy if exists deed_invite_read on deed_invite;
create policy deed_invite_read on deed_invite for select to authenticated
  using (uid = (select auth.uid()) or founder = (select auth.uid())
         or asked_by = (select auth.uid()));

/**
 * What a rank lets you do on a settlement, after "you may": the words the
 * person ranked is told, and the browser's `RANK_MAY`.
 */
create or replace function rank_may(p_role text) returns text
  language sql immutable as $fn$
  select case p_role
    when 'mayor' then 'build, invite people, send away its builders and guests, and make them builders or guests'
    when 'builder' then 'shape its ground, build on it and take from its stores'
    when 'guest' then 'walk it and shape nothing'
  end
$fn$;

/**
 * Set somebody's rank on a settlement.
 *
 * The founder sets anybody else on the roll to mayor, builder or guest. A
 * mayor sets a builder or a guest to builder or guest. Nobody changes the
 * founder's rank or their own. The refusals are the browser's
 * `rankRefusal`, in its order and its words.
 */
create or replace function rpc_rank(p_world uuid, p_founder uuid, p_uid uuid, p_role text)
  returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); d deed; v_mine int; v_theirs text; v_name text; v_by text;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  if p_role is null or p_role not in ('mayor', 'builder', 'guest') then
    return jsonb_build_object('why', 'A rank is mayor, builder or guest.');
  end if;
  select * into d from deed where world_id = p_world and founded_by = p_founder;
  if not found then return jsonb_build_object('why', 'That settlement is gone.'); end if;
  v_mine := deed_rank(deed_role(p_world, p_founder, me));
  if v_mine < deed_rank('mayor') then
    return jsonb_build_object('why', 'Only the founder or a mayor of ' || d.name
      || ' may change anybody''s rank.');
  end if;
  if p_uid is null or p_uid = me then
    return jsonb_build_object('why', 'Nobody may change their own rank.');
  end if;
  if p_uid = p_founder then
    return jsonb_build_object('why', 'Nobody may change the rank of whoever founded ' || d.name || '.');
  end if;
  v_name := folk_name(p_world, p_uid);
  v_theirs := deed_role(p_world, p_founder, p_uid);
  if v_theirs is null then
    return jsonb_build_object('why', v_name || ' is not a citizen of ' || d.name || '.');
  end if;
  if v_mine < deed_rank('founder')
     and (deed_rank(v_theirs) >= deed_rank('mayor') or deed_rank(p_role) >= deed_rank('mayor')) then
    return jsonb_build_object('why', 'Only whoever founded ' || d.name || ' may make or unmake a mayor.');
  end if;
  if v_theirs = p_role then
    return jsonb_build_object('why', v_name || ' is already a ' || p_role || ' of ' || d.name || '.');
  end if;
  update deed_member set role = p_role
   where world_id = p_world and founder = p_founder and uid = p_uid;
  v_by := folk_name(p_world, me);
  perform tell(p_world, p_uid, v_by || ' makes you a ' || p_role || ' of ' || d.name
    || ': you may ' || rank_may(p_role) || '.', 'system');
  perform tell(p_world, me, v_name || ' is now a ' || p_role || ' of ' || d.name || '.', 'event');
  if me <> p_founder then
    perform tell(p_world, p_founder, v_by || ' makes ' || v_name || ' a ' || p_role
      || ' of ' || d.name || '.', 'event');
  end if;
  return jsonb_build_object('ranked', v_name, 'role', p_role, 'deed', d.name);
end $fn$;

/**
 * Ask somebody to come and live on a settlement: its founder, or a mayor of it.
 *
 * Which settlement is named by its founder. Left out -- as a browser from
 * before mayors leaves it -- it is the one the caller founded, which is all it
 * ever was. Holding land of their own is no bar to the person asked, but a
 * full roll of three is, and saying so by name is kinder than an invitation
 * that cannot be answered.
 */
create or replace function rpc_invite(p_world uuid, p_uid uuid, p_founder uuid default null) returns jsonb
  language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); d deed; v_name text;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  if p_uid is null or p_uid = me then
    return jsonb_build_object('why', 'You are already here.');
  end if;
  select * into d from deed where world_id = p_world and founded_by = coalesce(p_founder, me);
  if not found then
    if p_founder is null or p_founder = me then
      return jsonb_build_object('why', 'You hold no settlement to invite anybody to.');
    end if;
    return jsonb_build_object('why', 'That settlement is gone.');
  end if;
  if deed_rank(deed_role(p_world, d.founded_by, me)) < deed_rank('mayor') then
    return jsonb_build_object('why', 'Only the founder or a mayor of ' || d.name
      || ' may invite anybody to it.');
  end if;
  if not exists (select 1 from player where world_id = p_world and uid = p_uid) then
    return jsonb_build_object('why', 'Nobody by that name is on this island.');
  end if;
  v_name := folk_name(p_world, p_uid);
  if p_uid = d.founded_by
     or exists (select 1 from deed_member m where m.world_id = p_world and m.uid = p_uid
                  and m.founder = d.founded_by) then
    return jsonb_build_object('why', v_name || ' already lives here.');
  end if;
  if deeds_joined_by(p_world, p_uid) >= deeds_joined()::int then
    return jsonb_build_object('why', v_name || ' is a citizen of '
      || deeds_joined()::int || ' settlements already, which is as many as anybody may be.');
  end if;
  if exists (select 1 from deed_invite i where i.world_id = p_world and i.founder = d.founded_by
               and i.uid = p_uid) then
    return jsonb_build_object('why', v_name || ' has already been asked, and has not answered.');
  end if;
  insert into deed_invite (world_id, founder, uid, asked_by) values (p_world, d.founded_by, p_uid, me);
  perform tell(p_world, p_uid, folk_name(p_world, me) || ' invites you to live at '
    || d.name || '. (Social, to answer)', 'system');
  return jsonb_build_object('asked', v_name, 'deed', d.name);
end $fn$;

-- The two-argument door goes, or a call naming two arguments would find two
-- functions and take neither. The three-argument one answers it.
drop function if exists rpc_invite(uuid, uuid);

/**
 * Yes or no to an invitation.
 *
 * Yes is allowed while you hold land of your own: the one you founded stays
 * first in `deeds_of`, so nothing has to choose between them. The only thing
 * that refuses is a full roll. The founder hears the answer, and so does a
 * mayor who sent it.
 */
create or replace function rpc_invite_answer(p_world uuid, p_founder uuid, p_yes boolean)
  returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); d deed; v_n int; v_asker uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select * into d from deed where world_id = p_world and founded_by = p_founder;
  if not found or not exists (select 1 from deed_invite i
        where i.world_id = p_world and i.founder = p_founder and i.uid = me) then
    return jsonb_build_object('why', 'There is no invitation waiting from there.');
  end if;
  select i.asked_by into v_asker from deed_invite i
   where i.world_id = p_world and i.founder = p_founder and i.uid = me;
  if v_asker = p_founder then v_asker := null; end if;
  if not coalesce(p_yes, false) then
    delete from deed_invite where world_id = p_world and founder = p_founder and uid = me;
    perform tell(p_world, p_founder, folk_name(p_world, me) || ' will not come to '
      || d.name || '.', 'event');
    if v_asker is not null then
      perform tell(p_world, v_asker, folk_name(p_world, me) || ' will not come to '
        || d.name || '.', 'event');
    end if;
    return jsonb_build_object('joined', false, 'deed', d.name);
  end if;
  v_n := deeds_joined_by(p_world, me);
  if v_n >= deeds_joined()::int then
    -- The invitation is left standing: leave one of the three and it is still
    -- there to answer.
    return jsonb_build_object('why', 'You are a citizen of ' || v_n
      || ' settlements already, which is as many as anybody may be. Leave one first.');
  end if;
  delete from deed_invite where world_id = p_world and founder = p_founder and uid = me;
  insert into deed_member (world_id, founder, uid) values (p_world, p_founder, me);
  perform tell(p_world, me, 'You are a citizen of ' || d.name
    || '. Its land is yours to work.', 'system');
  perform tell(p_world, p_founder, folk_name(p_world, me) || ' has come to live at '
    || d.name || '.', 'system');
  if v_asker is not null then
    perform tell(p_world, v_asker, folk_name(p_world, me) || ' has come to live at '
      || d.name || '.', 'system');
  end if;
  return jsonb_build_object('joined', true, 'deed', d.name);
end $fn$;

/**
 * Off one roll: yourself, or somebody the founder or a mayor is sending away.
 *
 * The founder sends away anybody on the roll; a mayor sends away builders and
 * guests. The refusals are the browser's `sendAwayRefusal`, in its order and
 * its words.
 */
create or replace function rpc_leave_deed(p_world uuid, p_founder uuid, p_uid uuid default null)
  returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare me uuid := auth.uid(); who uuid; d deed; v_mine int;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  who := coalesce(p_uid, me);
  select * into d from deed where world_id = p_world and founded_by = p_founder;
  if found and who <> me and who = p_founder then
    return jsonb_build_object('why', 'Nobody may send away whoever founded ' || d.name || '.');
  end if;
  if not exists (select 1 from deed_member m
        where m.world_id = p_world and m.uid = who and m.founder = p_founder) then
    return jsonb_build_object('why', 'Nobody there to send away.');
  end if;
  if who <> me then
    v_mine := deed_rank(deed_role(p_world, p_founder, me));
    if v_mine < deed_rank('mayor') then
      return jsonb_build_object('why', 'Only the founder or a mayor of ' || d.name
        || ' may send anybody away.');
    end if;
    if v_mine < deed_rank('founder')
       and deed_rank(deed_role(p_world, p_founder, who)) >= deed_rank('mayor') then
      return jsonb_build_object('why', 'Only whoever founded ' || d.name || ' may send a mayor away.');
    end if;
  end if;
  delete from deed_member where world_id = p_world and uid = who and founder = p_founder;
  if who = me then
    perform tell(p_world, me, 'You are no longer a citizen of ' || d.name || '.', 'system');
    if p_founder <> me then
      perform tell(p_world, p_founder, folk_name(p_world, me) || ' has left ' || d.name || '.', 'event');
    end if;
  else
    perform tell(p_world, who, 'You are no longer welcome at ' || d.name || '.', 'error');
    perform tell(p_world, me, folk_name(p_world, who) || ' is off the roll of ' || d.name || '.', 'event');
    if p_founder <> me then
      perform tell(p_world, p_founder, folk_name(p_world, me) || ' has taken '
        || folk_name(p_world, who) || ' off the roll of ' || d.name || '.', 'event');
    end if;
  end if;
  return jsonb_build_object('left', d.name);
end $fn$;

CREATE OR REPLACE FUNCTION public.rpc_social(p_world uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  if not exists (select 1 from player where world_id = p_world and uid = me) then
    raise exception 'you are not on this island';
  end if;
  return jsonb_build_object(
    /*
     * Every settlement that is yours, the one you founded first.
     *
     * A list rather than the one it used to be: a person holds at most one and
     * may be a citizen of `deeds_joined` others, and a window that showed only
     * the first of four would be hiding three places somebody lives.
     *
     * Each carries its own roll — founder included, you left off it — with
     * whereabouts, because people off the same land are near by definition.
     * And your rank on it, and everybody's on its roll by uid, which is what
     * says where you may invite, send away and set ranks.
     */
    'deeds', coalesce((select jsonb_agg(jsonb_build_object(
        'name', d.name, 'x', d.x, 'y', d.y, 'level', d.level, 'radius', d.radius,
        'founder', d.founded_by, 'by', folk_name(p_world, d.founded_by),
        'mine', d.founded_by = me,
        'role', deed_role(p_world, d.founded_by, me),
        'ranks', coalesce((select jsonb_object_agg(m.uid, m.role) from deed_member m
                  where m.world_id = p_world and m.founder = d.founded_by), '{}'::jsonb),
        'folk', coalesce((
          select jsonb_agg(folk_row(p_world, q.uid, true)
                 order by q.ord, folk_name(p_world, q.uid))
            from (select d.founded_by as uid, 0 as ord
                  union all
                  select m.uid, 1 from deed_member m
                   where m.world_id = p_world and m.founder = d.founded_by) q
            where q.uid <> me), '[]'::jsonb))
        order by d.founded_by = me desc, d.founded_at)
      from deeds_of(p_world, me) d), '[]'::jsonb),
    -- And how many more you may join, which is what the window says when the
    -- answer is none.
    'room', greatest(0, deeds_joined()::int - deeds_joined_by(p_world, me)),
    /*
     * And how many other people's settlements everybody else is a citizen
     * of, by uid, leaving out whoever is on none. The window's Invite reads
     * it to say "Citizen of 3" where the cap is the bar, in the words
     * `rpc_invite` would refuse in.
     */
    'joined', coalesce((select jsonb_object_agg(q.uid, deeds_joined_by(p_world, q.uid))
      from (select distinct m.uid from deed_member m
             where m.world_id = p_world and m.uid <> me) q), '{}'::jsonb),
    -- Asked to live somewhere, and waiting on you: by whoever asked.
    'invites', coalesce((select jsonb_agg(jsonb_build_object(
        'founder', i.founder, 'by', folk_name(p_world, coalesce(i.asked_by, i.founder)),
        'deed', dd.name, 'at', extract(epoch from i.made_at)) order by i.made_at)
      from deed_invite i join deed dd
        on dd.world_id = i.world_id and dd.founded_by = i.founder
      where i.world_id = p_world and i.uid = me), '[]'::jsonb),
    -- And the ones out from every settlement you may invite to: its founder's
    -- and its mayors', whoever sent them, which settlement each is for.
    'sent', coalesce((select jsonb_agg(jsonb_build_object(
        'uid', i.uid, 'name', folk_name(p_world, i.uid),
        'founder', i.founder, 'deed', dd.name,
        'by', folk_name(p_world, coalesce(i.asked_by, i.founder)),
        'at', extract(epoch from i.made_at)) order by i.made_at)
      from deed_invite i join deed dd
        on dd.world_id = i.world_id and dd.founded_by = i.founder
      where i.world_id = p_world
        and deed_rank(deed_role(p_world, i.founder, me)) >= deed_rank('mayor')), '[]'::jsonb),
    'friends', coalesce((select jsonb_agg(folk_row(p_world, f.other, true)
        order by afoot(p_world, f.other) desc, folk_name(p_world, f.other))
      from friend f where f.world_id = p_world and f.uid = me and f.state = 'friends'), '[]'::jsonb),
    'asked', coalesce((select jsonb_agg(jsonb_build_object(
        'uid', f.uid, 'name', folk_name(p_world, f.uid),
        'at', extract(epoch from f.at)) order by f.at)
      from friend f where f.world_id = p_world and f.other = me and f.state = 'asked'), '[]'::jsonb),
    'asking', coalesce((select jsonb_agg(jsonb_build_object(
        'uid', f.other, 'name', folk_name(p_world, f.other),
        'at', extract(epoch from f.at)) order by f.at)
      from friend f where f.world_id = p_world and f.uid = me and f.state = 'asked'), '[]'::jsonb),
    -- Letters waiting, by whoever wrote them, so the window can put a number
    -- against a name rather than a bare total nobody can act on.
    'unread', coalesce((select jsonb_agg(jsonb_build_object(
        'uid', q.sender, 'name', folk_name(p_world, q.sender), 'n', q.n) order by q.n desc)
      from (select l.sender, count(*)::int as n from letter l
             where l.world_id = p_world and l.reader = me and l.read_at is null
             group by l.sender) q), '[]'::jsonb),
    /*
     * And everybody ashore. Whereabouts with them while the island is quiet
     * and not once there are people in it — a list of every body on the
     * island with a position beside it is a radar, and it is also, on an
     * island with six people on four thousand tiles, the only way any of them
     * ever meets another.
     */
    'here', folk_ashore(p_world, me),
    -- Which side of that line the island is on, so the window can say why.
    'open', folk_seen(p_world),
    'crowd', crowd_hides()::int);
end $function$;

select private.lock_doors();

notify pgrst, 'reload schema';
