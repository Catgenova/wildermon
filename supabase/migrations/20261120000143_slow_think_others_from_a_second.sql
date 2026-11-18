-- What else was running, kept with every slow think (`slow_think_ms()`, 1 s), not only those of 5 s or more.
--
-- The thinks that were 1.1-1.7 s are 40-70 ms since a worker's search for its next tile went in bands (migration 138),
-- so a stall of the whole database like 11-17 22:20 and 22:46 (every think 30 to 65 times its usual) now shows as
-- thinks of 1.5 to 3 s, under the 5 s `slow_stall_ms()` was; reading pg_stat_activity once a slow think is cheap.

set local lock_timeout = '3s';

create or replace function public.slow_stall_ms() returns double precision language sql immutable as $fn$ select 1000::double precision $fn$;

select private.lock_doors();
