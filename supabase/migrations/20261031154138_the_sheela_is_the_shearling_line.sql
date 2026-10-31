/*
 * The Sheela is the Shearling line: the Shearling, a Clipperoo at its second
 * stage and a Shearlord at its third. Its task, its numbers and its id
 * (`sheela`) are as they were; what changes is in the definitions before this
 * (`20261031154137_defs.sql`): the kind's name and its old one (`was`), its
 * two stages' names, and its line's own skill at its third stage, work range
 * x1.2 (`species_def.perk`, `perk_n`, `perk_channel`), which `evo_mul` reads
 * on the island as it does the Kilnspire's, the Timberback's and the
 * Pressmere's.
 *
 * A definitions migration does not lock the doors; this one does.
 */
select private.lock_doors();
