/*
 * What things have sold for on the island, over the last month.
 *
 * Asked for as "a small 30-day chart of sale prices on an item's tooltip and
 * in the Market window": a price set on a stall was a guess, because nothing
 * anywhere said what the same thing had gone for the week before.
 *
 * A sale is a thing bought off a stall or a shop counter (`rpc_buy`) or
 * brought to a buy order (`rpc_order_fill`): what it was, how many, and the
 * silver that changed hands for all of them. Kept for `SALE_DAYS` days and no
 * longer -- each sale clears out what is older of the same thing, so the
 * table holds a month of trade and never grows past it.
 */
set local lock_timeout = '3s';

select private.shut($ddl$
create table if not exists sale (
  world_id uuid not null references world on delete cascade,
  n bigint generated always as identity,
  def text not null,
  count int not null check (count > 0),
  -- For all of them together.
  silver bigint not null check (silver >= 0),
  at timestamptz not null default now(),
  primary key (world_id, n)
)$ddl$);
select private.shut('create index if not exists sale_def_at on sale (world_id, def, at)');
select private.shut('alter table sale enable row level security');
-- Read through `rpc_prices` alone.
select private.shut('revoke all on sale from anon, authenticated');

/** How many days of sales are kept and shown. The browser's `SALE_DAYS` says the same. */
create or replace function sale_days() returns int language sql immutable as $$ select 30 $$;

/** A sale, and the same thing's sales from before the month out. */
create or replace function note_sale(p_world uuid, p_def text, p_count bigint, p_silver bigint) returns void
language plpgsql as $fn$
begin
  if p_def is null or coalesce(p_count, 0) < 1 then return; end if;
  insert into sale (world_id, def, count, silver) values (p_world, p_def, p_count, greatest(0, coalesce(p_silver, 0)));
  delete from sale where world_id = p_world and def = p_def and at < now() - make_interval(days => sale_days());
end $fn$;

/**
 * Every thing sold on the island in the last month, a row a day it sold on:
 * how many went, the silver for them all, and the least and most paid for one.
 * Days count back from today, nought being today. For anybody on the island,
 * wherever they stand: what things fetch is common knowledge.
 */
create or replace function rpc_prices(p_world uuid) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from player where world_id = p_world and uid = me) then
    raise exception 'you are not on this island';
  end if;
  return jsonb_build_object('days', sale_days(), 'sold', coalesce((
    select jsonb_object_agg(def, days) from (
      select def, jsonb_agg(jsonb_build_object('ago', ago, 'n', n, 'silver', silver, 'lo', lo, 'hi', hi) order by ago) as days
        from (
          select s.def,
                 (current_date - (s.at at time zone 'utc')::date) as ago,
                 sum(s.count) as n, sum(s.silver) as silver,
                 min(s.silver::double precision / s.count) as lo,
                 max(s.silver::double precision / s.count) as hi
            from sale s
           where s.world_id = p_world and s.at >= now() - make_interval(days => sale_days())
           group by s.def, ago
        ) d
       group by def
    ) t), '{}'::jsonb));
end $fn$;

/*
 * The two doors goods are bought through, as they were, each noting what it
 * sold (`note_sale`).
 */
CREATE OR REPLACE FUNCTION public.rpc_buy(p_world uuid, p_item bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); v_it item; v_pl placed; p player; v_name text; v_why text;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select * into p from player where world_id = p_world and uid = me;
  if not found then raise exception 'you are not on this island'; end if;
  select * into v_it from item where world_id = p_world and id = p_item for update;
  if not found or v_it.price is null or v_it.placed is null then
    return jsonb_build_object('why', 'That is not for sale.');
  end if;
  select * into v_pl from placed where world_id = p_world and id = v_it.placed;
  -- A stall, or a shop counter still standing (`counters.ts`).
  if not found or not sells(v_pl) or (v_pl.kind = 'counter' and not counter_standing(v_pl)) then
    return jsonb_build_object('why', 'That is not for sale.');
  end if;
  if v_pl.made_by = me then
    return jsonb_build_object('why', 'It is your own ' || sells_word(v_pl) || '. Take it back off the counter instead.');
  end if;
  -- At it, and at a counter on its street side.
  v_why := sells_reach_refusal(v_pl, p.x, p.y, true);
  if v_why is not null then return jsonb_build_object('why', v_why); end if;
  if purse(p_world, me) < v_it.price then
    return jsonb_build_object('why', 'You cannot afford it. It is ' || v_it.price || ' silver.');
  end if;
  if not take_coins(p_world, me, v_it.price) then
    return jsonb_build_object('why', 'You cannot afford it.');
  end if;
  update placed set till = till + v_it.price where world_id = p_world and id = v_pl.id;
  v_name := lower(coalesce((select name from item_def where id = v_it.def), v_it.def));
  update item set holder = 'player', holder_uid = me, placed = null, price = null
    where world_id = p_world and id = v_it.id;
  perform pack_fold_one(v_it.id);
  perform note_sale(p_world, v_it.def, v_it.count, v_it.price);
  if v_pl.made_by is not null then
    perform tell(p_world, v_pl.made_by, folk_name(p_world, me) || ' buys your ' || v_name
      || ' for ' || v_it.price || ' silver.', 'event');
    perform away_count(p_world, v_pl.made_by, 'sold', v_it.def, v_it.count, v_it.price);
  end if;
  return jsonb_build_object('bought', v_name, 'paid', v_it.price);
end $function$;

create or replace function rpc_order_fill(p_world uuid, p_n bigint, p_count integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); p player; o buy_order; r item; v_left int; v_have bigint; v_owed int;
        v_take int; v_letter bigint; v_paid bigint; v_words text;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  perform settle(p_world, me);
  select * into p from player where world_id = p_world and uid = me;
  if not found then raise exception 'you are not on this island'; end if;
  if not board_at(p_world, me) then
    return jsonb_build_object('why', 'Stand at a settlement token or a mailbox to fill an order.');
  end if;
  select * into o from buy_order where world_id = p_world and n = p_n and closed_at is null for update;
  if not found then return jsonb_build_object('why', 'That order is gone.'); end if;
  if o.at <= now() - make_interval(secs => order_life()) then
    perform order_close(o, 'lapsed');
    return jsonb_build_object('why', 'That order has lapsed.');
  end if;
  if o.poster = me then
    return jsonb_build_object('why', 'It is your own order. Take it back instead.');
  end if;
  v_left := o.want - o.got;
  if coalesce(p_count, 0) < 1 then return jsonb_build_object('why', 'Bring at least one.'); end if;
  if p_count > v_left then
    return jsonb_build_object('why', 'It wants only ' || v_left || ' more.');
  end if;

  perform 1 from item where world_id = p_world and holder = 'player' and holder_uid = me and def = o.def
    order by id for update;
  select coalesce(sum(f.count), 0) into v_have from order_fits(p_world, me, o.def, o.ql) f;
  if v_have < p_count then
    return jsonb_build_object('why', case when v_have = 0 then 'You have none in your pack that will do.'
      else 'You have only ' || v_have || ' in your pack that will do.' end);
  end if;

  -- The letter it rides in, which is what makes it a parcel and says who it is from.
  v_words := order_words(o.def, p_count, 0);
  insert into letter (world_id, sender, reader, text)
    values (p_world, me, o.poster, 'For your order: ' || v_words || '.') returning n into v_letter;
  v_owed := p_count;
  for r in select * from order_fits(p_world, me, o.def, o.ql) f order by f.ql, f.id loop
    exit when v_owed <= 0;
    v_take := least(r.count, v_owed);
    if v_take = r.count then
      update item set holder = 'post', holder_uid = o.poster, letter = v_letter,
                      crate = null, placed = null, price = null
        where id = r.id;
    else
      -- Some of a stack: the rest stays in the pack, and what goes is the same stuff.
      update item set count = count - v_take where id = r.id;
      insert into item (world_id, holder, holder_uid, letter, def, ql, dmg, count, extra, rare, dye, bless,
                        charges, issued, made_at, lit, lit_at, rot_at, maker, piece, keyed)
        values (p_world, 'post', o.poster, v_letter, r.def, r.ql, r.dmg, v_take, r.extra, r.rare, r.dye, r.bless,
                r.charges, r.issued, r.made_at, r.lit, r.lit_at, r.rot_at, r.maker, r.piece, r.keyed);
    end if;
    v_owed := v_owed - v_take;
  end loop;

  v_paid := p_count::bigint * o.price;
  perform give_coins(p_world, me, v_paid);
  perform pack_fold(p_world, me);
  perform note_sale(p_world, o.def, p_count, v_paid);
  update buy_order set got = got + p_count,
         closed_at = case when got + p_count >= want then now() end,
         closed = case when got + p_count >= want then 'filled' end
   where world_id = p_world and n = o.n;
  perform tell(p_world, o.poster, folk_name(p_world, me) || ' brings ' || v_words || ' to your order, for '
    || v_paid || ' silver of what it held. '
    || case when p_count >= v_left then 'That is all it wanted.' else 'It still wants ' || (v_left - p_count) || '.' end
    || ' It waits for you at any mailbox.', 'event');
  perform away_count(p_world, o.poster, 'bought', o.def, p_count, v_paid);
  perform tell(p_world, me, 'You bring ' || v_words || ' to ' || folk_name(p_world, o.poster)
    || '''s order and are paid ' || v_paid || ' silver. It goes to them by the post.', 'event');
  return jsonb_build_object('brought', p_count, 'paid', v_paid, 'left', v_left - p_count);
end $$;

select private.lock_doors();
