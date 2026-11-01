/*
 * The Dulla is the Mossnib line: the Mossnib, a Mossshear at its second stage
 * and a Mossreaver at its third. Its task, its numbers and its id (`dulla`)
 * are as they were; what changes is in the definitions before this
 * (`20261101113000_defs.sql`): the kind's name and its old one (`was`), its
 * two stages' names, and its line's own skill at its third stage, moss per
 * cut +1 (`species_def.perk` 'more', `perk_n`), which `worker_settle` already
 * adds to what `worker_do` cuts (`perk_more`), as it does a Sprigmant's grass.
 *
 * A definitions migration does not lock the doors; this one does.
 */
select private.lock_doors();
