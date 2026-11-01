/*
 * The Cindra is the Emberkit line: the Emberkit, an Emberbrush at its second
 * stage and an Ashsweeper at its third. Its task, its numbers and its id
 * (`cindra`) are as they were; what changes is in the definitions before this
 * (`20261101200000_defs.sql`): the kind's name and its old one (`was`), its
 * two stages' names, its words, and its line's own skill at its third stage,
 * actions per cycle +1 (`species_def.perk` 'loads', `perk_n`), which
 * `stage_loads` already adds to what `errand_go` has a hands trade do in a
 * go: a hearth raked out or a batch of lye leached, as it does a Peltling's
 * hides.
 *
 * A definitions migration does not lock the doors; this one does.
 */
select private.lock_doors();
