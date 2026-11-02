/*
 * The Salva is the Herbpup line: the Herbpup, a Herbfox at its second stage
 * and a Herbwarden at its third. Its task, its numbers and its id (`salva`)
 * are as they were; what changes is in the definitions before this
 * (`20261101360000_defs.sql`): the kind's name and its old one (`was`), its two
 * stages' names, and its line's own skill at its third stage, one more of your
 * wildermon dressed a cycle (`species_def.perk` 'loads', `perk_n` 1), which
 * `stage_loads` adds on the island as it does the Whispling's brushings: the
 * dressings `hands_trade` takes out of the stores at a go, and the ones it
 * sees to in that go, are `stage_loads` many.
 *
 * A definitions migration does not lock the doors; this one does.
 */
select private.lock_doors();
