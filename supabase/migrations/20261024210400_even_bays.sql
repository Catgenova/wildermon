/*
 * A bridge's bays all one length.
 *
 * As many bays as a bay of its material takes to cover the deck, as before,
 * but every one `n / k` tiles long, whole or not (`bridgeBays`): three tiles
 * at a bay of two are two bays of one and a half, not one and two. A pier
 * stands between every two, `j * n / k` tiles along, and is billed on the
 * span whose tile that point is in; on a point between two tiles, the one
 * before it (`pierSpans`). Held to the browser by `supabase/test/bridgewidth.ts`.
 */
set local lock_timeout = '3s';

drop function if exists bridge_bays(int, int);

/* The bays a deck of `p_n` tiles is carried in, end a's first, all one length (`bridgeBays`). */
create or replace function bridge_bays(p_n int, p_bay int)
returns double precision[] language sql immutable as $fn$
  select case when p_n is null or p_n <= 0 then '{}'::double precision[]
              when p_bay is null or p_bay <= 0 then array[p_n::double precision]
              else array_fill(p_n::double precision / ceil(p_n::numeric / p_bay)::int, array[ceil(p_n::numeric / p_bay)::int]) end
$fn$;

/* The spans, by `bridge_span.n`, that carry a pier: the one holding each point between two bays, the one before a point between two tiles (`pierSpans`). */
create or replace function bridge_piers(p_n int, p_bay int)
returns int[] language sql immutable as $fn$
  select coalesce((select array_agg((j * p_n + k - 1) / k order by j)
                     from (select ceil(p_n::numeric / p_bay)::int as k) c, generate_series(1, c.k - 1) j), '{}'::int[])
   where p_n > 0 and p_bay > 0
  union all
  select '{}'::int[] where not (coalesce(p_n, 0) > 0 and coalesce(p_bay, 0) > 0)
$fn$;

select private.lock_doors();
