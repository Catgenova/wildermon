/*
 * A wildermon traded in its crate, through the Trade window.
 *
 * Asked for: "Trading wildermon. A secure trade window between two players,
 * with the pedigree shown."
 *
 * A crate with a wildermon in it already went on a side like any thing in the
 * pack, and whoever the crate goes to already keeps what is in it: its keeper
 * follows the crate's holder (`crate_changes_hands`), and with the keeper what
 * the keeper's perks make of keeping it (`creature_kept_stamp`), no work post
 * and no work around anybody (`around_off`). Its name, sex, traits, forms,
 * rarity, skills, stance and pedigree are the creature's own and go with it
 * untouched. What was missing:
 *
 *   * the window showed a wildermon crate and nothing of what was in it, so
 *     nobody could see what they were accepting. Each thing on a side now
 *     carries the wildermon in it (`barter_beast`): name, kind, sex, age
 *     stage, level, skills, traits, forms, rarity, pedigree and whether it
 *     carries young -- the pedigree whole to its keeper and, to anybody else,
 *     by the rule its card keeps (`pedigree_seen`);
 *   * a crate's wildermon could change under an Accept. Ivar accepts, lets
 *     Pip out of the crate while Tag follows him, Tag goes into the crate in
 *     Pip's place, Hild accepts -- and Hild gets Tag, who was never on the
 *     window. Each thing now keeps the wildermon it held when it went on
 *     (`barter_item.creature`) and that wildermon as it was shown
 *     (`barter_item.beast`). The next look at the trade (every door into it,
 *     the window's own every few seconds) that finds either changed takes
 *     both Accepts back, says so to both (`stirred`) and shows the new one;
 *     and the deal itself, under its locks, refuses a crate not as recorded;
 *   * refused on a side, in the browser's words: a dam carrying young
 *     (`young`), whose young would be born to whoever has her and were never
 *     shown; one whose panniers carry things (`loaded`), which would go with
 *     it unseen -- a crate is never shut on loaded panniers, so this is the
 *     same rule held at the trade; and a crate that names a wildermon not shut
 *     in it, or not its holder's (`loose`).
 *
 * A wildermon at heel, at work or in a crate standing on the ground is not a
 * thing in the pack, and nothing else goes on a side: it is picked up into
 * the pack in its crate first. There is no cap on the wildermon one keeps or
 * the crates one carries, so the receiver is refused nothing for either. The
 * field guide's "tamed" is for taming, and a "tamed" form is a journal goal,
 * so a wildermon traded gives none; it is "seen" the way any is, once out.
 */
set local lock_timeout = '3s';

alter table barter_item add column if not exists creature int;
alter table barter_item add column if not exists beast jsonb;

/*
 * A wildermon as a side shows it. `p_me`: who is looking, for its pedigree;
 * null for the record a side keeps of it, which is whole.
 */
create or replace function barter_beast(p_world uuid, p_creature int, p_me uuid default null) returns jsonb
language sql stable as $$
  select jsonb_build_object(
      'id', c.id, 'name', c.name, 'species', c.species, 'variant', c.variant, 'sex', c.sex,
      'age', age_of(c.born, old_of(c), age_pace(c)), 'level', creature_level(c.skills, c.species), 'skills', c.skills,
      'traits', to_jsonb(c.traits), 'formColour', c.form_colour, 'formSize', c.form_size, 'rare', c.rare,
      'pedigree', case when c.pedigree is null or p_me is null or c.keeper = p_me then c.pedigree
                       else pedigree_seen(p_world, p_me, c.pedigree) end,
      'due', c.due is not null)
    from creature c where c.world_id = p_world and c.id = p_creature
$$;

/* One side, as `p_me` sees it: each thing with the wildermon in it, for an occupied crate. */
drop function if exists barter_side(barter, uuid);
create or replace function barter_side(b barter, p_uid uuid, p_me uuid default null) returns jsonb
language plpgsql stable as $$
begin
  return jsonb_build_object(
    'uid', p_uid, 'name', folk_name(b.world_id, p_uid),
    'coins', case when p_uid = b.asker then b.asker_coins else b.other_coins end,
    'ok', case when p_uid = b.asker then b.asker_ok else b.other_ok end,
    'things', coalesce((select jsonb_agg(jsonb_build_object(
        'id', bi.item, 'def', bi.def, 'count', bi.count,
        -- What the pack holds of it now: nought when it has gone from there.
        'has', case when i.holder = 'player' and i.holder_uid = p_uid and i.deal is null then i.count else 0 end,
        'ql', coalesce(i.ql, 0), 'dmg', coalesce(i.dmg, 0), 'extra', i.extra, 'rare', i.rare,
        -- The wildermon in it, while it is still in the pack.
        'beast', case when i.creature is not null and i.holder = 'player' and i.holder_uid = p_uid
                      then barter_beast(b.world_id, i.creature, coalesce(p_me, p_uid)) end) order by bi.ord)
      from barter_item bi left join item i on i.world_id = bi.world_id and i.id = bi.item
      where bi.world_id = b.world_id and bi.n = b.n and bi.owner = p_uid), '[]'::jsonb));
end $$;

create or replace function barter_view(b barter, p_me uuid) returns jsonb
language plpgsql stable as $$
begin
  return jsonb_build_object(
    'n', b.n, 'rev', b.rev, 'state', b.state, 'asker', b.asker = p_me,
    'mine', barter_side(b, p_me, p_me),
    'theirs', barter_side(b, case when p_me = b.asker then b.other else b.asker end, p_me),
    'left', greatest(0, round(barter_idle() - extract(epoch from now() - b.at))),
    'apart', round(coalesce(barter_apart(b.world_id, b.asker, b.other), 0)::numeric, 1));
end $$;

/* Why a thing may not go on a side, or be dealt: as it was, and a crated wildermon's three. */
create or replace function barter_thing_refusal(p_world uuid, p_owner uuid, p_item bigint, p_count integer, p_def text)
returns text language plpgsql stable as $$
declare it item; c creature; v_who text := folk_name(p_world, p_owner); v_what text;
begin
  select * into it from item where world_id = p_world and id = p_item;
  v_what := lower(coalesce((select name from item_def where id = coalesce(p_def, it.def)), 'thing'));
  if it.id is null or it.holder <> 'player' or it.holder_uid is distinct from p_owner or it.deal is not null then
    return barter_line('missing', v_who, v_what);
  end if;
  if it.def = 'coin' then return barter_said('coin'); end if;
  if it.issued then return barter_said('starter'); end if;
  if exists (select 1 from player pl cross join jsonb_each_text(pl.equipped) e
              where pl.world_id = p_world and pl.uid = p_owner and e.value = it.id::text) then
    return barter_line('worn', v_who, v_what);
  end if;
  if it.locked then return barter_line('locked', v_who, v_what); end if;
  if coalesce(p_count, 0) > it.count then return barter_line('fewer', v_who, v_what); end if;
  if it.creature is not null then
    select * into c from creature where world_id = p_world and id = it.creature;
    if c.id is null or c.mode <> 'stored' or c.keeper is distinct from p_owner then
      return barter_line('loose', v_who, coalesce(c.name, v_what));
    end if;
    if c.due is not null then return barter_line('young', v_who, c.name); end if;
    if pannier_units(p_world, c.id) > 0 then return barter_line('loaded', v_who, c.name); end if;
  end if;
  return null;
end $$;

/*
 * A whole side, at the deal, under its locks: every thing as `barter_thing_refusal`
 * asks it, and each crate's wildermon the one recorded and as it was shown --
 * which the look before it may have missed by a moment.
 */
create or replace function barter_side_refusal(b barter, p_owner uuid) returns text
language plpgsql stable as $$
declare r record; why text; v_coins bigint := case when p_owner = b.asker then b.asker_coins else b.other_coins end;
begin
  for r in select bi.*, i.creature as now_creature from barter_item bi
             left join item i on i.world_id = bi.world_id and i.id = bi.item
            where bi.world_id = b.world_id and bi.n = b.n and bi.owner = p_owner order by bi.ord loop
    why := barter_thing_refusal(b.world_id, p_owner, r.item, r.count, r.def);
    if why is not null then return why; end if;
    if r.now_creature is distinct from r.creature
       or (r.creature is not null and barter_beast(b.world_id, r.creature) is distinct from r.beast) then
      return barter_said('changed');
    end if;
  end loop;
  if v_coins > 0 and purse(b.world_id, p_owner) < v_coins then
    return barter_line('coins', folk_name(b.world_id, p_owner), null, v_coins);
  end if;
  return null;
end $$;

/*
 * Looked at, the way every door into a trade looks at it first: called off
 * when the two have gone or come apart or let it sit; and when a crate on a
 * side holds another wildermon than it did, or the one it held is not as it
 * was shown, that is a change to the trade like any other -- recorded as it
 * is now, both Accepts taken back, and told to both.
 */
create or replace function barter_sweep(b barter) returns barter
language plpgsql as $$
declare v_apart double precision; r record; v_said text;
begin
  if b.closed_at is not null then return b; end if;
  if not barter_ashore(b.world_id, b.asker) or not barter_ashore(b.world_id, b.other) then
    return barter_close(b, 'left');
  end if;
  v_apart := barter_apart(b.world_id, b.asker, b.other);
  if v_apart is null or v_apart > barter_reach() then return barter_close(b, 'apart'); end if;
  if b.at < now() - make_interval(secs => barter_idle()) then return barter_close(b, 'lapsed'); end if;
  for r in select bi.item, bi.owner, bi.def, i.creature as now_creature from barter_item bi
             join item i on i.world_id = bi.world_id and i.id = bi.item
            where bi.world_id = b.world_id and bi.n = b.n
              and i.holder = 'player' and i.holder_uid = bi.owner
              and (i.creature is distinct from bi.creature
                   or (i.creature is not null and barter_beast(b.world_id, i.creature) is distinct from bi.beast))
            order by bi.owner = b.asker desc, bi.ord loop
    update barter_item set creature = r.now_creature,
           beast = case when r.now_creature is not null then barter_beast(b.world_id, r.now_creature) end
     where world_id = b.world_id and n = b.n and item = r.item;
    v_said := coalesce(v_said, barter_line('stirred', folk_name(b.world_id, r.owner),
                                            lower(coalesce((select name from item_def where id = r.def), 'thing'))));
  end loop;
  if v_said is not null then
    update barter set asker_ok = false, other_ok = false, rev = rev + 1, at = now()
     where world_id = b.world_id and n = b.n returning * into b;
    perform tell(b.world_id, b.asker, v_said, 'event');
    perform tell(b.world_id, b.other, v_said, 'event');
    perform barter_send(b);
  end if;
  return b;
end $$;

/* A side put in: as it was, with each crate's wildermon recorded as it is shown. */
CREATE OR REPLACE FUNCTION public.rpc_barter_offer(p_world uuid, p_n bigint, p_items bigint[], p_counts integer[], p_coins bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); b barter; why text; v_len int := coalesce(array_length(p_items, 1), 0);
        i int; it item; v_was jsonb; v_now jsonb; v_coins bigint := coalesce(p_coins, 0);
begin
  perform private.pace(auth.uid(), 'deal');
  perform private.once();
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select * into b from barter where world_id = p_world and n = p_n and me in (asker, other) for update;
  if not found then return jsonb_build_object('why', barter_said('none')); end if;
  if b.closed_at is not null then return jsonb_build_object('why', barter_said('over')); end if;
  b := barter_sweep(b);
  why := barter_swept_why(b, me);
  if why is not null then return jsonb_build_object('why', why); end if;
  if b.state = 'asked' then
    return jsonb_build_object('why', barter_line('notYet', folk_name(p_world, b.other)));
  end if;
  if v_len <> coalesce(array_length(p_counts, 1), 0)
     or exists (select 1 from unnest(p_items) x where x is null)
     or (select count(distinct x) from unnest(p_items) x) <> v_len
     or exists (select 1 from unnest(p_counts) c where c is null or c <= 0)
     or v_coins < 0 then
    raise exception 'that is not a side of a trade';
  end if;
  if v_len > barter_most() then return jsonb_build_object('why', barter_said('most')); end if;
  for i in 1 .. v_len loop
    why := barter_thing_refusal(p_world, me, p_items[i], p_counts[i], null);
    if why is not null then
      -- Somebody else's thing is named as no kind of thing at all, so a door asked about any row tells nothing.
      if not exists (select 1 from item where world_id = p_world and id = p_items[i] and holder_uid = me) then
        why := barter_line('missing', folk_name(p_world, me), 'thing');
      end if;
      return jsonb_build_object('why', why);
    end if;
  end loop;
  if v_coins > 0 and purse(p_world, me) < v_coins then
    return jsonb_build_object('why', barter_line('coins', folk_name(p_world, me), null, v_coins));
  end if;

  v_was := coalesce((select jsonb_agg(jsonb_build_array(item, count) order by ord) from barter_item
                      where world_id = p_world and n = b.n and owner = me), '[]'::jsonb);
  v_now := coalesce((select jsonb_agg(jsonb_build_array(p_items[k], p_counts[k]) order by k)
                       from generate_series(1, v_len) k), '[]'::jsonb);
  if v_was = v_now and v_coins = (case when me = b.asker then b.asker_coins else b.other_coins end) then
    return jsonb_build_object('barter', barter_view(b, me));
  end if;
  delete from barter_item where world_id = p_world and n = b.n and owner = me;
  insert into barter_item (world_id, n, item, owner, def, count, ord, creature, beast)
    select p_world, b.n, p_items[k], me, x.def, p_counts[k], k, x.creature,
           case when x.creature is not null then barter_beast(p_world, x.creature) end
      from generate_series(1, v_len) k
      left join lateral (select t.def, t.creature from item t where t.world_id = p_world and t.id = p_items[k]) x on true;
  update barter set asker_coins = case when me = asker then v_coins else asker_coins end,
                    other_coins = case when me = other then v_coins else other_coins end,
                    asker_ok = false, other_ok = false, rev = rev + 1, at = now()
   where world_id = p_world and n = b.n returning * into b;
  perform barter_send(b);
  return jsonb_build_object('barter', barter_view(b, me));
end $function$;

/* Accepted: as it was, with every crated wildermon on either side held too before the sides are asked again. */
CREATE OR REPLACE FUNCTION public.rpc_barter_accept(p_world uuid, p_n bigint, p_rev integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); b barter; why text;
begin
  perform private.pace(auth.uid(), 'deal');
  perform private.once();
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select * into b from barter where world_id = p_world and n = p_n and me in (asker, other) for update;
  if not found then return jsonb_build_object('why', barter_said('none')); end if;
  if b.closed_at is not null then return jsonb_build_object('why', barter_said('over')); end if;
  b := barter_sweep(b);
  why := barter_swept_why(b, me);
  if why is not null then return jsonb_build_object('why', why); end if;
  if b.state = 'asked' then
    return jsonb_build_object('why', barter_line('notYet', folk_name(p_world, b.other)));
  end if;
  if p_rev is distinct from b.rev then return jsonb_build_object('why', barter_said('changed')); end if;
  if (me = b.asker and b.asker_ok) or (me = b.other and b.other_ok) then
    return jsonb_build_object('barter', barter_view(b, me));
  end if;
  update barter set asker_ok = asker_ok or me = asker, other_ok = other_ok or me = other
   where world_id = p_world and n = b.n returning * into b;
  if not (b.asker_ok and b.other_ok) then
    perform tell(p_world, case when me = b.asker then b.other else b.asker end,
                 barter_line('accepts', folk_name(p_world, me)), 'event');
    perform barter_send(b);
    return jsonb_build_object('barter', barter_view(b, me));
  end if;

  /*
   * Both have accepted. Both bodies, every thing on both sides and every coin
   * in both purses held, in that order, then the wildermon in any crate on a
   * side, and every one of them asked again under the lock.
   */
  perform 1 from player where world_id = p_world and uid in (b.asker, b.other) order by uid for update;
  perform 1 from item where world_id = p_world and holder = 'player' and holder_uid in (b.asker, b.other)
     and (def = 'coin' or id in (select item from barter_item where world_id = p_world and n = b.n))
   order by id for update;
  perform 1 from creature where world_id = p_world
     and id in (select i.creature from barter_item bi join item i on i.world_id = bi.world_id and i.id = bi.item
                 where bi.world_id = p_world and bi.n = b.n and i.creature is not null
                union select bi.creature from barter_item bi where bi.world_id = p_world and bi.n = b.n and bi.creature is not null)
   order by id for update;
  why := coalesce(barter_side_refusal(b, b.asker), barter_side_refusal(b, b.other));
  if why is null then
    begin
      perform barter_move_side(b, b.asker, b.other);
      perform barter_move_side(b, b.other, b.asker);
      if b.asker_coins > 0 then
        if not take_coins(p_world, b.asker, b.asker_coins) then raise exception 'barter: coins'; end if;
        perform give_coins(p_world, b.other, b.asker_coins);
        perform private.watch_handed(p_world, b.asker, b.other, 'rpc_barter_accept', 0, b.asker_coins);
      end if;
      if b.other_coins > 0 then
        if not take_coins(p_world, b.other, b.other_coins) then raise exception 'barter: coins'; end if;
        perform give_coins(p_world, b.asker, b.other_coins);
        perform private.watch_handed(p_world, b.other, b.asker, 'rpc_barter_accept', 0, b.other_coins);
      end if;
      perform pack_fold(p_world, b.asker);
      perform pack_fold(p_world, b.other);
    exception when others then
      -- Whatever moved goes back with the block; the words are the Accept's own.
      why := barter_said('changed');
    end;
  end if;
  if why is not null then
    update barter set asker_ok = false, other_ok = false, rev = rev + 1, at = now()
     where world_id = p_world and n = b.n returning * into b;
    perform tell(p_world, b.asker, why, 'error');
    perform tell(p_world, b.other, why, 'error');
    perform barter_send(b);
    return jsonb_build_object('why', why, 'barter', barter_view(b, me));
  end if;
  b := barter_close(b, 'done');
  return jsonb_build_object('done', true);
end $function$;

select private.lock_doors();
