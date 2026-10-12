/*
 * Somebody who already lives on a settlement may still be asked onto yours.
 *
 * Reported from the island: "You're supposed to be able to be a citizen of
 * three deeds, right? I don't have an invite option for you and [another
 * player] since we're already in a deed I believe."
 *
 * The island never refused that. `rpc_invite` has held the rule since
 * `one_of_your_own_and_three_besides`: the founder asks, and the one bar is a
 * person already on `deeds_joined()` other people's rolls. It was the Social
 * window that withheld it -- Invite sat only on "Everybody else ashore", which
 * leaves out your friends and everybody you share a settlement with, so the
 * people most likely to be asked were the ones with no way to ask them.
 *
 * The window offers it beside everybody now, and says when the cap is what
 * stops it rather than leaving the island to refuse. For that it has to know
 * how many rolls each person is on, which is all this adds: `joined`, by uid,
 * for everybody on at least one, counted by `deeds_joined_by` -- the same
 * count `rpc_invite` and `rpc_invite_answer` refuse on, so the window cannot
 * say a person has room the island will then deny.
 *
 * The rest of `rpc_social` is as `everybody_on_the_map` left it.
 * `supabase/test/citizen.ts` holds the two sides to each other.
 */
set local lock_timeout = '3s';

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
     */
    'deeds', coalesce((select jsonb_agg(jsonb_build_object(
        'name', d.name, 'x', d.x, 'y', d.y, 'level', d.level, 'radius', d.radius,
        'founder', d.founded_by, 'by', folk_name(p_world, d.founded_by),
        'mine', d.founded_by = me,
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
    -- Asked to live somewhere, and waiting on you.
    'invites', coalesce((select jsonb_agg(jsonb_build_object(
        'founder', i.founder, 'by', folk_name(p_world, i.founder),
        'deed', dd.name, 'at', extract(epoch from i.made_at)) order by i.made_at)
      from deed_invite i join deed dd
        on dd.world_id = i.world_id and dd.founded_by = i.founder
      where i.world_id = p_world and i.uid = me), '[]'::jsonb),
    -- And the ones you have out, which only a founder ever has.
    'sent', coalesce((select jsonb_agg(jsonb_build_object(
        'uid', i.uid, 'name', folk_name(p_world, i.uid),
        'at', extract(epoch from i.made_at)) order by i.made_at)
      from deed_invite i where i.world_id = p_world and i.founder = me), '[]'::jsonb),
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
