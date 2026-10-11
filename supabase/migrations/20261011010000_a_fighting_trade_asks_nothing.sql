/*
 * A fighting trade asks for no skill.
 *
 * The owner: "Remove minimum requirements for picking a combat class." A craft
 * trade still opens at `class_at()` in any skill it covers; a fighting trade is
 * open to anybody from the first day, as `classOpen` says on the browser's
 * side. `class_refusal`, `rpc_classes` and `rpc_take_class` all ask this one
 * function, so it is the only thing rewritten.
 *
 * Rewritten from 20260920120000_fourteen_trades_and_one_of_them_yours.sql, its
 * only definition.
 */
create or replace function class_open(p_world uuid, p_uid uuid, p_class text) returns boolean
  language sql stable as $fn$
  select exists (select 1 from class_def c where c.id = p_class and c.kind = 'combat')
      or exists (select 1 from class_skill cs
                  where cs.class = p_class and skill_of(p_world, p_uid, cs.skill) >= class_at())
$fn$;

notify pgrst, 'reload schema';
select private.lock_doors();
