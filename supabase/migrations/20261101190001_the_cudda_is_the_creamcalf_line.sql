/*
 * The Cudda is the Creamcalf line: the Creamcalf, a Milkmere at its second
 * stage and a Lactisovereign at its third. Its milking, its numbers and its id
 * (`cudda`) are as they were; what changes is in the definitions before this
 * (`20261101190000_defs.sql`): the kind's name and its old one (`was`), its two
 * stages' names, its words, the dairy hand's and the Milkmaid's words, and its
 * line's own skill at its third stage, twin chance ×1.2 (`species_def.perk`
 * 'blood', `perk_n`, `perk_channel` 'twins'), which `evo_mul` already looks up
 * off the table (`evo_perk`) for every channel but health, growth and work, and
 * `twin_chance` already reads through `beast_mul(dam, 'twins')` at a covering.
 *
 * A definitions migration does not lock the doors; this one does.
 */
select private.lock_doors();
