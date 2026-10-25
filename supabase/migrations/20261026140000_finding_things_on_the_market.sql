/*
 * Finding things on the market.
 *
 * The stalls sold, but finding a thing on them did not work: the board listed
 * every stall with what was on it, and that was all -- no quality, no price of
 * one, nothing to compare it with but a month of daily averages on another
 * tab, and once you stepped away from the token to walk to the stall, the
 * board was gone and so was where the stall stood. The browser now finds a
 * thing across every stall on the board and walks to it or pins it; what the
 * island adds is three things it alone knows:
 *
 *   * the quality of what sold: `sale.ql`, the average by the unit, written
 *     down by `rpc_buy` (the thing bought) and `rpc_order_fill` (what was
 *     brought, poorest first), and handed back a day at a time by
 *     `rpc_prices`;
 *   * a thing's last sales one by one, newest first (`rpc_sales`): when, how
 *     many, the silver for them and their quality. The island's sales, not who
 *     made them;
 *   * away from the board, the nearest settlement token, where the board is
 *     read (`rpc_market`'s `token`), so the window can say where to go. A
 *     settlement token is where anybody reads the board; a mailbox is
 *     somebody's own and is not named.
 */
set local lock_timeout = '3s';

/* ---- the quality of what sold --------------------------------------------------------------- */

-- The average quality of what went, by the unit. Null for a sale from before it was written down.
alter table public.sale add column if not exists ql double precision;

/** A sale with its quality, and the same thing's sales from before the month out. */
create or replace function public.note_sale(p_world uuid, p_def text, p_count bigint, p_silver bigint, p_ql double precision)
returns void language plpgsql as $fn$
begin
  if p_def is null or coalesce(p_count, 0) < 1 then return; end if;
  insert into sale (world_id, def, count, silver, ql)
    values (p_world, p_def, p_count, greatest(0, coalesce(p_silver, 0)), p_ql);
  delete from sale where world_id = p_world and def = p_def and at < now() - make_interval(days => sale_days());
end $fn$;

/** A sale whose quality is not known: what any caller from before this writes. */
create or replace function public.note_sale(p_world uuid, p_def text, p_count bigint, p_silver bigint) returns void
language plpgsql as $fn$
begin
  perform note_sale(p_world, p_def, p_count, p_silver, null::double precision);
end $fn$;

/** How many of a thing's last sales `rpc_sales` hands back. The browser's `SALES_SHOWN` says the same. */
create or replace function public.sales_shown() returns int language sql immutable as $$ select 12 $$;

/**
 * A thing's last `sales_shown()` sales on the island in the month, newest first: how many seconds ago,
 * how many went, the silver for them all and their average quality (null from before it was written down).
 * For anybody on the island, wherever they stand, as `rpc_prices` is.
 */
create or replace function public.rpc_sales(p_world uuid, p_def text) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from player where world_id = p_world and uid = me) then
    raise exception 'you are not on this island';
  end if;
  -- No kind of thing has a longer id than this.
  if p_def is null or length(p_def) > 64 then return jsonb_build_object('def', null, 'sales', '[]'::jsonb); end if;
  return jsonb_build_object('def', p_def, 'sales', coalesce((
    select jsonb_agg(jsonb_build_object(
             'ago', greatest(0, floor(extract(epoch from now() - s.at)))::bigint,
             'n', s.count, 'silver', s.silver, 'ql', round(s.ql::numeric, 1)::double precision) order by s.at desc, s.n desc)
      from (select * from sale
             where world_id = p_world and def = p_def and at >= now() - make_interval(days => sale_days())
             order by at desc, n desc limit sales_shown()) s), '[]'::jsonb));
end $fn$;

/** Away from the board: the nearest settlement token to somebody, where it is read, and its settlement's name. */
create or replace function public.board_token(p_world uuid, p_uid uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object('x', d.x, 'y', d.y, 'deed', d.name)
    from deed d join player p on p.world_id = d.world_id and p.uid = p_uid
   where d.world_id = p_world
   order by (d.x + 0.5 - p.x) ^ 2 + (d.y + 0.5 - p.y) ^ 2, d.x, d.y
   limit 1
$$;

/* ---- the doors, each changed where it says, once -------------------------------------------- */

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- What was bought, with its quality.
    (1, 'public.rpc_buy(uuid, bigint)'::regprocedure, 1,
     $$perform note_sale(p_world, v_it.def, v_it.count, v_it.price);$$,
     $$perform note_sale(p_world, v_it.def, v_it.count, v_it.price, v_it.ql);$$),
    -- What was brought to an order: the quality of each part summed by the unit as it goes, and averaged.
    (2, 'public.rpc_order_fill(uuid, bigint, integer)'::regprocedure, 1,
     $$v_take int; v_letter bigint; v_paid bigint; v_words text;$$,
     $$v_take int; v_letter bigint; v_paid bigint; v_words text; v_qls double precision := 0;$$),
    (3, 'public.rpc_order_fill(uuid, bigint, integer)'::regprocedure, 1,
     $$    v_owed := v_owed - v_take;$$,
     $$    v_qls := v_qls + r.ql * v_take;
    v_owed := v_owed - v_take;$$),
    (4, 'public.rpc_order_fill(uuid, bigint, integer)'::regprocedure, 1,
     $$perform note_sale(p_world, o.def, p_count, v_paid);$$,
     $$perform note_sale(p_world, o.def, p_count, v_paid, v_qls / p_count);$$),
    -- A day's sales with the average quality of what went.
    (5, 'public.rpc_prices(uuid)'::regprocedure, 1,
     $$'lo', lo, 'hi', hi)$$,
     $$'lo', lo, 'hi', hi, 'ql', round(ql::numeric, 1)::double precision)$$),
    (6, 'public.rpc_prices(uuid)'::regprocedure, 1,
     $$max(s.silver::double precision / s.count) as hi$$,
     $$max(s.silver::double precision / s.count) as hi,
                 sum(s.ql * s.count) / nullif(sum(s.count) filter (where s.ql is not null), 0) as ql$$),
    -- Away from the board, the nearest token.
    (7, 'public.rpc_market(uuid)'::regprocedure, 1,
     $$'board', v_board,$$,
     $$'board', v_board,
    'token', case when not v_board then board_token(p_world, me) end,$$),
    -- `rpc_sales` is a read, paced as `rpc_prices` is.
    (8, 'private.pace_class(text)'::regprocedure, 1,
     $$'rpc_prices',$$,
     $$'rpc_prices', 'rpc_sales',$$)
  ) as t(ord, fn, times, old, new) order by ord loop
    v_def := pg_get_functiondef(r.fn);
    -- Run before: nothing to do.
    continue when position(r.new in v_def) > 0;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.times then raise exception '% has % of change %, not %', r.fn, v_n, r.ord, r.times; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
