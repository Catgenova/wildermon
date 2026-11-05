-- The dragon's three subspecies.
--
-- Asked for: "All 3 dragons": every dragon is a Runewing Dragon, a Runestone Drake or a Stormcoil Dragon, by its variant,
-- as every ogre is one of its three (`SpeciesDef.subspecies`). The dragon has three variants now, not four (the
-- definitions after this one set `species_def.variants`), and `creature_spawn` rolls evenly among them as it always has.
-- A dragon already out in the fourth, the lilac one dropped, is put in one of the three by its id, so the browser, which
-- calls and draws it by its variant, has a subspecies for it.

set local lock_timeout = '3s';

update creature set variant = id % 3 where species = 'dragon' and variant not between 0 and 2;

select private.lock_doors();
