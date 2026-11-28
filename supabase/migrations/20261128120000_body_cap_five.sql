/*
 * New bodies a connection may make in a day: 5, was 3. Asked for while the Unity client's performance tours were
 * being set up ("Change the limit to 5 for now"): each tour came ashore as a new Wanderer and three ran out the day.
 * Tours keep one Wanderer of their own now; this is the room to make it. `ip_body_take` reads it, so nothing else moves.
 */
create or replace function private.ip_body_cap() returns int language sql immutable as $$ select 5 $$;
select private.lock_doors();
