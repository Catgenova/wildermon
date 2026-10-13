/*
 * A trade between two people: the Trade window.
 *
 * Until now things changed hands by being dropped and picked up, laid on a
 * stall or a counter, posted, or offered as a deal whose terms were fixed
 * when it went out. This is the one where two people stand together and
 * haggle:
 *
 *   * one asks (`rpc_barter_ask`), from the other's menu or the Social
 *     window, and the other says yes or no (`rpc_barter_answer`);
 *   * each puts things from their pack and a sum of silver on their side
 *     (`rpc_barter_offer`, the whole side at once);
 *   * each presses Accept (`rpc_barter_accept`), naming the `rev` it was
 *     pressed against. Any change to either side bumps `rev` and takes both
 *     Accepts back, so an Accept is always for what was on the screen;
 *   * with both standing, everything moves in one go: every thing on each
 *     side to the other, every coin, or -- if any one of them cannot go --
 *     nothing at all, both Accepts taken back and both told why, in the same
 *     words;
 *   * either may cancel (`rpc_barter_cancel`); two people more than
 *     `barter_reach()` tiles apart, or one of them gone, call it off, and so
 *     does `barter_idle()` seconds with nothing changing. That is found by
 *     whichever door looks at the trade next (`barter_sweep`) -- the open
 *     window asks every few seconds (`rpc_barter`) -- so nothing runs on a
 *     clock.
 *
 * Called a barter in here, because a trade on this island is the craft you
 * follow (`trade_book_at`, the Trades window). The constants and every
 * sentence are the browser's (`src/game/barter.ts`), read as `barter_reach`,
 * `barter_idle`, `barter_most` and `barter_said`.
 *
 * Nothing in a trade is held out of the pack while it stands: what is on a
 * side is looked for again, under lock, at the moment both have accepted.
 * A thing eaten, dropped, sold, posted, put in a deal, put on, or kept back
 * since it was put in is refused then, by name.
 *
 * What is moved is the same row, so a bag keeps what is in it (and what is in
 * it changes owner with it) and a creature crate keeps its wildermon. Part of
 * a stack is split off into a row of its own for the receiver.
 *
 * Nobody but the two in it can read or touch one: both tables are shut to
 * browsers, and every door answers somebody else's trade as it answers one
 * that never was.
 *
 * Each change is told to both browsers on their own topic
 * (`own:<island>:<uid>`, event `barter`), which is how the other window
 * knows to look again; the lines go to the log through `tell` as always.
 */

set local lock_timeout = '3s';

create table if not exists barter (
  world_id uuid not null references world on delete cascade,
  n bigint generated always as identity,
  -- Who asked, and who was asked.
  asker uuid not null,
  other uuid not null,
  -- asked → open → done, or closed early: declined, cancelled, apart, left, lapsed.
  state text not null default 'asked',
  asker_coins bigint not null default 0,
  other_coins bigint not null default 0,
  asker_ok boolean not null default false,
  other_ok boolean not null default false,
  -- Bumped on every change to either side; an Accept names the one it saw.
  rev int not null default 0,
  -- The last change, which the idle lapse counts from.
  at timestamptz not null default now(),
  made_at timestamptz not null default now(),
  closed_at timestamptz,
  primary key (world_id, n),
  constraint barter_sides check (asker <> other),
  constraint barter_coins check (asker_coins >= 0 and other_coins >= 0),
  constraint barter_state check (state in ('asked', 'open', 'done', 'declined', 'cancelled', 'apart', 'left', 'lapsed')),
  constraint barter_closed check ((closed_at is null) = (state in ('asked', 'open')))
);
create index if not exists barter_open_asker on barter (world_id, asker) where closed_at is null;
create index if not exists barter_open_other on barter (world_id, other) where closed_at is null;

/*
 * What is on each side: the thing by its row, whose it is, how many of it go,
 * and its kind, kept so a thing that has gone can still be named.
 * Deliberately not a foreign key onto `item`: a thing that has been eaten is
 * exactly what an Accept has to find and refuse.
 */
create table if not exists barter_item (
  world_id uuid not null,
  n bigint not null,
  item bigint not null,
  owner uuid not null,
  def text not null,
  count int not null,
  ord int not null,
  primary key (world_id, n, item),
  foreign key (world_id, n) references barter (world_id, n) on delete cascade,
  constraint barter_item_count check (count > 0)
);

-- Nobody reads or writes either but the doors below.
alter table barter enable row level security;
alter table barter_item enable row level security;
revoke all on barter from anon, authenticated;
revoke all on barter_item from anon, authenticated;

/* ---- the words and the ground ------------------------------------------------ */

/** One of the browser's sentences (`barterSaid`), filled in. */
create or replace function barter_line(p_key text, p_who text default null, p_what text default null, p_n bigint default null)
returns text language plpgsql stable as $fn$
begin
  return replace(replace(replace(barter_said(p_key), '{who}', coalesce(p_who, '')),
                         '{what}', coalesce(p_what, '')), '{n}', coalesce(p_n, 0)::text);
end $fn$;

/** How far apart two bodies stand, across the grid; null when either has none here. */
create or replace function barter_apart(p_world uuid, p_a uuid, p_b uuid) returns double precision
language sql stable as $fn$
  select greatest(abs(a.x - b.x), abs(a.y - b.y))
    from player a, player b
   where a.world_id = p_world and a.uid = p_a and b.world_id = p_world and b.uid = p_b
$fn$;

/** Whether somebody has a body on this island and is not away. */
create or replace function barter_ashore(p_world uuid, p_uid uuid) returns boolean
language sql stable as $fn$
  select exists (select 1 from player where world_id = p_world and uid = p_uid and not away)
$fn$;

/** Tell both browsers the trade changed, on each one's own topic: they ask `rpc_barter` again. */
create or replace function barter_send(b barter) returns void
language plpgsql as $fn$
declare u uuid;
begin
  foreach u in array array[b.asker, b.other] loop
    if private.here(b.world_id, u) then
      perform private.send('own:' || b.world_id || ':' || u, 'barter',
        jsonb_build_object('n', b.n, 'state', b.state, 'rev', b.rev));
    end if;
  end loop;
end $fn$;

/**
 * Close a trade, tell each of the two what became of it, and tell both
 * browsers. `p_by` is whoever closed it, for a cancel or a no.
 */
create or replace function barter_close(b barter, p_state text, p_by uuid default null) returns barter
language plpgsql as $fn$
declare na text := folk_name(b.world_id, b.asker); no text := folk_name(b.world_id, b.other);
begin
  update barter set state = p_state, closed_at = now(), asker_ok = false, other_ok = false
   where world_id = b.world_id and n = b.n returning * into b;
  if p_state = 'declined' then
    perform tell(b.world_id, b.asker, barter_line('declined', no), 'event');
    perform tell(b.world_id, b.other, barter_line('youDeclined', na), 'event');
  elsif p_state = 'cancelled' then
    perform tell(b.world_id, case when p_by = b.asker then b.other else b.asker end,
                 barter_line('cancelled', case when p_by = b.asker then na else no end), 'event');
    perform tell(b.world_id, p_by, barter_line('youCancelled', case when p_by = b.asker then no else na end), 'event');
  elsif p_state = 'done' then
    perform tell(b.world_id, b.asker, barter_line('done', no), 'event');
    perform tell(b.world_id, b.other, barter_line('done', na), 'event');
  elsif p_state = 'left' then
    -- Told to whoever is still here, about whoever is not.
    if barter_ashore(b.world_id, b.asker) then perform tell(b.world_id, b.asker, barter_line('left', no), 'error'); end if;
    if barter_ashore(b.world_id, b.other) then perform tell(b.world_id, b.other, barter_line('left', na), 'error'); end if;
  else
    perform tell(b.world_id, b.asker, barter_line(p_state, no), 'error');
    perform tell(b.world_id, b.other, barter_line(p_state, na), 'error');
  end if;
  perform barter_send(b);
  return b;
end $fn$;

/**
 * Call a trade off if it can no longer stand: one of the two gone or away,
 * the two of them further apart than `barter_reach()`, or nothing changed in
 * it for `barter_idle()` seconds. Returns the trade as it now is. The caller
 * holds its row.
 */
create or replace function barter_sweep(b barter) returns barter
language plpgsql as $fn$
declare v_apart double precision;
begin
  if b.closed_at is not null then return b; end if;
  if not barter_ashore(b.world_id, b.asker) or not barter_ashore(b.world_id, b.other) then
    return barter_close(b, 'left');
  end if;
  v_apart := barter_apart(b.world_id, b.asker, b.other);
  if v_apart is null or v_apart > barter_reach() then return barter_close(b, 'apart'); end if;
  if b.at < now() - make_interval(secs => barter_idle()) then return barter_close(b, 'lapsed'); end if;
  return b;
end $fn$;

/** The refusal, in the browser's words, of the trade a sweep just closed; null while it stands. */
create or replace function barter_swept_why(b barter, p_me uuid) returns text
language plpgsql stable as $fn$
declare them uuid := case when p_me = b.asker then b.other else b.asker end;
begin
  if b.state in ('apart', 'left', 'lapsed') then return barter_line(b.state, folk_name(b.world_id, them)); end if;
  if b.closed_at is not null then return barter_said('over'); end if;
  return null;
end $fn$;

/** One side, as the window draws it. */
create or replace function barter_side(b barter, p_uid uuid) returns jsonb
language plpgsql stable as $fn$
begin
  return jsonb_build_object(
    'uid', p_uid, 'name', folk_name(b.world_id, p_uid),
    'coins', case when p_uid = b.asker then b.asker_coins else b.other_coins end,
    'ok', case when p_uid = b.asker then b.asker_ok else b.other_ok end,
    'things', coalesce((select jsonb_agg(jsonb_build_object(
        'id', bi.item, 'def', bi.def, 'count', bi.count,
        -- What the pack holds of it now: nought when it has gone from there.
        'has', case when i.holder = 'player' and i.holder_uid = p_uid and i.deal is null then i.count else 0 end,
        'ql', coalesce(i.ql, 0), 'dmg', coalesce(i.dmg, 0), 'extra', i.extra, 'rare', i.rare) order by bi.ord)
      from barter_item bi left join item i on i.world_id = bi.world_id and i.id = bi.item
      where bi.world_id = b.world_id and bi.n = b.n and bi.owner = p_uid), '[]'::jsonb));
end $fn$;

/** A trade as one of the two in it sees it. */
create or replace function barter_view(b barter, p_me uuid) returns jsonb
language plpgsql stable as $fn$
begin
  return jsonb_build_object(
    'n', b.n, 'rev', b.rev, 'state', b.state, 'asker', b.asker = p_me,
    'mine', barter_side(b, p_me),
    'theirs', barter_side(b, case when p_me = b.asker then b.other else b.asker end),
    'left', greatest(0, round(barter_idle() - extract(epoch from now() - b.at))),
    'apart', round(coalesce(barter_apart(b.world_id, b.asker, b.other), 0)::numeric, 1));
end $fn$;

/**
 * Why one thing may not go on a side, or null: not in its owner's pack (or
 * held in a deal), fewer in the stack than are going, a coin, worn or held,
 * or kept back. The same questions at the putting in and at the Accept.
 */
create or replace function barter_thing_refusal(p_world uuid, p_owner uuid, p_item bigint, p_count int, p_def text)
returns text language plpgsql stable as $fn$
declare it item; v_who text := folk_name(p_world, p_owner); v_what text;
begin
  select * into it from item where world_id = p_world and id = p_item;
  v_what := lower(coalesce((select name from item_def where id = coalesce(p_def, it.def)), 'thing'));
  if it.id is null or it.holder <> 'player' or it.holder_uid is distinct from p_owner or it.deal is not null then
    return barter_line('missing', v_who, v_what);
  end if;
  if it.def = 'coin' then return barter_said('coin'); end if;
  if exists (select 1 from player pl cross join jsonb_each_text(pl.equipped) e
              where pl.world_id = p_world and pl.uid = p_owner and e.value = it.id::text) then
    return barter_line('worn', v_who, v_what);
  end if;
  if it.locked then return barter_line('locked', v_who, v_what); end if;
  if coalesce(p_count, 0) > it.count then return barter_line('fewer', v_who, v_what); end if;
  return null;
end $fn$;

/** Why one side cannot go as it stands, or null: each thing in the order it was put in, then the silver. */
create or replace function barter_side_refusal(b barter, p_owner uuid) returns text
language plpgsql stable as $fn$
declare r record; why text; v_coins bigint := case when p_owner = b.asker then b.asker_coins else b.other_coins end;
begin
  for r in select * from barter_item where world_id = b.world_id and n = b.n and owner = p_owner order by ord loop
    why := barter_thing_refusal(b.world_id, p_owner, r.item, r.count, r.def);
    if why is not null then return why; end if;
  end loop;
  if v_coins > 0 and purse(b.world_id, p_owner) < v_coins then
    return barter_line('coins', folk_name(b.world_id, p_owner), null, v_coins);
  end if;
  return null;
end $fn$;

/**
 * Part of a stack, split off into a row of its own in somebody's pack:
 * everything about it copied but its number and whose it is, and the stack
 * it came from that many fewer. Returns the new row.
 */
create or replace function barter_split(p_id bigint, p_count int, p_to uuid) returns bigint
language plpgsql as $fn$
declare v_cols text; v_new bigint;
begin
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into v_cols
    from pg_attribute a
   where a.attrelid = 'public.item'::regclass and a.attnum > 0 and not a.attisdropped
     and a.attidentity = '' and a.attgenerated = ''
     and a.attname not in ('id', 'count', 'holder', 'holder_uid');
  execute format('insert into item (holder, holder_uid, count, %s) select ''player'', $1, $2, %s from item where id = $3 returning id',
                 v_cols, v_cols)
    into v_new using p_to, p_count, p_id;
  update item set count = count - p_count where id = p_id;
  return v_new;
end $fn$;

/**
 * Move every thing on one side into the other's pack: the whole row, and
 * whatever is in it, or part of a stack split off. Raises if anything is not
 * where it was found, so the caller's whole move goes back.
 */
create or replace function barter_move_side(b barter, p_from uuid, p_to uuid) returns void
language plpgsql as $fn$
declare r record; it item;
begin
  for r in select * from barter_item where world_id = b.world_id and n = b.n and owner = p_from order by ord loop
    select * into it from item where world_id = b.world_id and id = r.item
      and holder = 'player' and holder_uid = p_from and deal is null;
    if not found or it.count < r.count then raise exception 'barter: a thing moved under the trade'; end if;
    if r.count < it.count then
      perform barter_split(it.id, r.count, p_to);
    else
      update item set holder_uid = p_to, crate = null, placed = null, price = null, locked = false
        where id = it.id;
      -- And what is in it, however deep: a bag's contents are its owner's.
      with recursive inner_of(id) as (
        select c.id from item c where c.inside = it.id
        union all
        select c.id from item c join inner_of o on c.inside = o.id)
      update item set holder_uid = p_to where id in (select id from inner_of);
    end if;
  end loop;
end $fn$;

/* ---- the doors --------------------------------------------------------------- */

/** The trade this body is in, if any, held for the rest of the statement. */
create or replace function barter_mine(p_world uuid, p_me uuid) returns barter
language sql as $fn$
  select * from barter where world_id = p_world and closed_at is null and p_me in (asker, other)
   order by n desc limit 1 for update
$fn$;

/**
 * Ask somebody to trade. Both must be ashore, within `barter_reach()` of each
 * other, and in no other trade.
 */
create or replace function rpc_barter_ask(p_world uuid, p_uid uuid) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid(); b barter; r barter;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  if not exists (select 1 from player where world_id = p_world and uid = me) then
    raise exception 'you are not on this island';
  end if;
  if p_uid is null or p_uid = me then return jsonb_build_object('why', barter_said('self')); end if;
  if not barter_ashore(p_world, p_uid) then
    return jsonb_build_object('why', barter_line('gone', folk_name(p_world, p_uid)));
  end if;
  -- Whatever either is already in, looked at first: one that has lapsed or come apart is closed now.
  -- Trades before bodies, the order every door here holds them in.
  for r in select * from barter where world_id = p_world and closed_at is null
                and (asker in (me, p_uid) or other in (me, p_uid)) order by n for update loop
    perform barter_sweep(r);
  end loop;
  -- Both bodies held, in one order, so two asks crossing cannot make two trades: the second sees the first's.
  perform 1 from player where world_id = p_world and uid in (me, p_uid) order by uid for update;
  if exists (select 1 from barter where world_id = p_world and closed_at is null and me in (asker, other)) then
    return jsonb_build_object('why', barter_said('busy'));
  end if;
  if exists (select 1 from barter where world_id = p_world and closed_at is null and p_uid in (asker, other)) then
    return jsonb_build_object('why', barter_line('busyThem', folk_name(p_world, p_uid)));
  end if;
  if coalesce(barter_apart(p_world, me, p_uid), 'Infinity') > barter_reach() then
    return jsonb_build_object('why', barter_said('far'));
  end if;
  insert into barter (world_id, asker, other) values (p_world, me, p_uid) returning * into b;
  perform tell(p_world, p_uid, barter_line('asked', folk_name(p_world, me)), 'system');
  perform tell(p_world, me, barter_line('asking', folk_name(p_world, p_uid)), 'event');
  perform barter_send(b);
  return jsonb_build_object('barter', barter_view(b, me));
end $fn$;

/** Say yes or no to being asked. Only the one asked answers. */
create or replace function rpc_barter_answer(p_world uuid, p_n bigint, p_yes boolean) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid(); b barter; why text;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select * into b from barter where world_id = p_world and n = p_n and me in (asker, other) for update;
  if not found then return jsonb_build_object('why', barter_said('none')); end if;
  if b.closed_at is not null then return jsonb_build_object('why', barter_said('over')); end if;
  if me = b.asker then
    return jsonb_build_object('why', barter_line('notYours', folk_name(p_world, b.other)));
  end if;
  if not coalesce(p_yes, false) then
    b := barter_close(b, 'declined', me);
    return jsonb_build_object('declined', true);
  end if;
  b := barter_sweep(b);
  why := barter_swept_why(b, me);
  if why is not null then return jsonb_build_object('why', why); end if;
  if b.state = 'asked' then
    update barter set state = 'open', at = now(), rev = rev + 1 where world_id = p_world and n = b.n returning * into b;
    perform tell(p_world, b.asker, barter_line('opened', folk_name(p_world, b.other)), 'event');
    perform tell(p_world, b.other, barter_line('opened', folk_name(p_world, b.asker)), 'event');
    perform barter_send(b);
  end if;
  return jsonb_build_object('barter', barter_view(b, me));
end $fn$;

/**
 * The trade you are in, as you see it, or null. Looks at it first, so one
 * that has lapsed, or whose two sides have walked apart, is closed by the
 * asking -- which the open window does every few seconds.
 */
create or replace function rpc_barter(p_world uuid) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid(); b barter;
begin
  if me is null then raise exception 'not signed in'; end if;
  b := barter_mine(p_world, me);
  if b.n is null then return jsonb_build_object('barter', null); end if;
  b := barter_sweep(b);
  if b.closed_at is not null then
    return jsonb_build_object('barter', null, 'why', barter_swept_why(b, me));
  end if;
  return jsonb_build_object('barter', barter_view(b, me), 'reach', barter_reach(), 'idle', barter_idle());
end $fn$;

/**
 * Put your whole side as it is to be: these things, these many of each, and
 * this much silver. Refused whole, in the browser's words, if any of it
 * cannot go. A side changed takes both Accepts back; one sent as it already
 * stands changes nothing.
 */
create or replace function rpc_barter_offer(p_world uuid, p_n bigint, p_items bigint[], p_counts int[], p_coins bigint)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid(); b barter; why text; v_len int := coalesce(array_length(p_items, 1), 0);
        i int; it item; v_was jsonb; v_now jsonb; v_coins bigint := coalesce(p_coins, 0);
begin
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
  insert into barter_item (world_id, n, item, owner, def, count, ord)
    select p_world, b.n, p_items[k], me, (select def from item where id = p_items[k]), p_counts[k], k
      from generate_series(1, v_len) k;
  update barter set asker_coins = case when me = asker then v_coins else asker_coins end,
                    other_coins = case when me = other then v_coins else other_coins end,
                    asker_ok = false, other_ok = false, rev = rev + 1, at = now()
   where world_id = p_world and n = b.n returning * into b;
  perform barter_send(b);
  return jsonb_build_object('barter', barter_view(b, me));
end $fn$;

/**
 * Accept the trade as it stood at `p_rev`. With both sides accepted,
 * everything moves at once -- or, if any one thing or coin cannot, nothing
 * does, both Accepts are taken back, and both are told why. An Accept from a
 * trade that has changed since, or one that is over, does nothing; so a
 * second press, or the same press sent twice, can never move anything twice.
 */
create or replace function rpc_barter_accept(p_world uuid, p_n bigint, p_rev int) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid(); b barter; why text;
begin
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
   * in both purses held, in that order, and every one of them asked again
   * under the lock.
   */
  perform 1 from player where world_id = p_world and uid in (b.asker, b.other) order by uid for update;
  perform 1 from item where world_id = p_world and holder = 'player' and holder_uid in (b.asker, b.other)
     and (def = 'coin' or id in (select item from barter_item where world_id = p_world and n = b.n))
   order by id for update;
  why := coalesce(barter_side_refusal(b, b.asker), barter_side_refusal(b, b.other));
  if why is null then
    begin
      perform barter_move_side(b, b.asker, b.other);
      perform barter_move_side(b, b.other, b.asker);
      if b.asker_coins > 0 then
        if not take_coins(p_world, b.asker, b.asker_coins) then raise exception 'barter: coins'; end if;
        perform give_coins(p_world, b.other, b.asker_coins);
      end if;
      if b.other_coins > 0 then
        if not take_coins(p_world, b.other, b.other_coins) then raise exception 'barter: coins'; end if;
        perform give_coins(p_world, b.asker, b.other_coins);
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
end $fn$;

/** Call the trade off, asked or open, from either side. Nothing changes hands. */
create or replace function rpc_barter_cancel(p_world uuid, p_n bigint) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid(); b barter;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select * into b from barter where world_id = p_world and n = p_n and me in (asker, other) for update;
  if not found then return jsonb_build_object('why', barter_said('none')); end if;
  if b.closed_at is not null then return jsonb_build_object('why', barter_said('over')); end if;
  b := barter_close(b, 'cancelled', me);
  return jsonb_build_object('cancelled', true);
end $fn$;

select private.lock_doors();

notify pgrst, 'reload schema';
