-- The wildermon's words, one word for one thing, in the island's text as in the browser's.
--
-- Asked for: 'Everywhere change "per go" to "per action". Identify other potentially ambiguous verbiage.', and of the
-- list of ambiguous terms, "Do them all". For the wildermon and their work that is: a settlement worker's job is a
-- "task" ("Deed job" / "no trade" read "Settlement task" / "no task"), "settlement", never "deed", and the settlement's
-- token a "totem"; a trait's tier is its "rarity" ("tier-up" reads "rarity-up"); a blow's figure says "damage"; and the
-- daily reset is called that, with its hour. The rest of the words (species, tasks, traits, baits) come from the
-- definitions.
--
-- Each line below swaps one phrase in one function's text, and refuses to run unless that phrase is there exactly once.

set local lock_timeout = '3s';

do $do$
declare
  r record; v_def text; v_n int;
begin
  for r in
    select * from (values
      ('creature_refusal', $o$d.name || ': no trade.'$o$, $n$d.name || ': no task.'$n$),
      ('creature_refusal', $o$': not one of its trades.'$o$, $n$': not one of its tasks.'$n$),
      ('crate_open_refusal', $o$v_d.name || ': no trade.'$o$, $n$v_d.name || ': no task.'$n$),
      ('deed_job_line', $o$' tiles of the token'$o$, $n$' tiles of the totem'$n$),
      ('deed_job_line', $o$'no trade')$o$, $n$'no task')$n$),
      ('lamp_says', $o$', a tier above '$o$, $n$', a rarity above '$n$),
      ('lamp_says', $o$' Tier-up chance: 1 in '$o$, $n$' Rarity-up chance: 1 in '$n$),
      ('stud_book', $o$'%, tier-up '$o$, $n$'%, rarity-up '$n$),
      ('last_refusal', $o$'Need a settlement: the young go to its token.'$o$, $n$'Need a settlement: the young go to its totem.'$n$),
      ('worker_idle', $o$else 'the token' end$o$, $n$else 'the totem' end$n$),
      ('rpc_owner_move', $o$v_where := 'the token of '$o$, $n$v_where := 'the totem of '$n$),
      ('perform_creature', $o$|| to_char(attack_of(c), 'FM990') || '. Cannot be tamed.'$o$,
                           $n$|| to_char(attack_of(c), 'FM990') || ' damage. Cannot be tamed.'$n$),
      ('ground_says', $o$' each woods turn; back to '$o$,
                      $n$' each daily reset (' || lpad(tree_dawn_utc()::int::text, 2, '0') || ':00 UTC); back to '$n$)
    ) as t(fn, old, new)
  loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not there', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of %, not 1', r.fn, v_n, r.old; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

-- What a keeper's Move tells, of the queue it clears: actions, as the queue calls them.
do $do$
declare
  r record; v_def text; v_n int;
begin
  for r in
    select * from (values
      ($o$then ' job' else ' jobs' end$o$, $n$then ' action' else ' actions' end$n$),
      ($o$then ' job ' else ' jobs ' end$o$, $n$then ' action ' else ' actions ' end$n$)
    ) as t(old, new)
  loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'private' and p.proname = 'move_stops';
    if v_def is null then raise exception 'private.move_stops is not there'; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception 'private.move_stops has % of %, not 1', v_n, r.old; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
