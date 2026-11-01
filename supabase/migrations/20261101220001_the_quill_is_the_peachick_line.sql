/*
 * The Quill is the Peachick line: the Peachick, a Plumecrest at its second
 * stage and a Featherbourne at its third. Its plucking, its numbers and its id
 * (`quill`) are as they were; what changes is in the definitions before this
 * (`20261101220000_defs.sql`): the kind's name and its old one (`was`), its two
 * stages' names, its words, and its line's own skill at its third stage, a
 * feather more a plucking (`species_def.perk` 'wool', `perk_n` 1), which
 * `perform_creature` (plucked by its keeper) and `errand_do` (plucked by a
 * dairy hand) already add for any kind, whatever comes off it (`perk_n(c,
 * 'wool')`).
 *
 * A definitions migration does not lock the doors; this one does.
 */
select private.lock_doors();
