/*
 * A thing kept back is refused in the words the menu uses for it.
 *
 * The pack's menu says "Keep this back" and "Put it back in the pack", and the
 * list reads "kept back"; but a sacrifice, a melt and a Bauble of Regret
 * refused it as "put by" and said to "Unlock it first", which is no word the
 * game uses anywhere a player can find it. So the refusal pointed nowhere, and
 * somebody looking for a way to protect a thing from the altar never found
 * the one there is. The same sentences, in the browser's new words, wherever
 * the island wrote them out: `firing_refusal`, `rpc_regret_class` and
 * `sacrifice_setting`, rewritten in place so nothing else in them moves.
 */
do $kept$
declare f regprocedure; d text;
begin
  for f in select p.oid::regprocedure from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.prosrc like '%put by. Unlock it first.%'
  loop
    d := pg_get_functiondef(f);
    d := replace(d, 'Your Bauble of Regret is put by. Unlock it first.', 'Your Bauble of Regret is kept back. Put it back in the pack first.');
    d := replace(d, 'It is put by. Unlock it first.', 'It is kept back. Put it back in the pack first.');
    execute d;
  end loop;
end $kept$;

select private.lock_doors();
