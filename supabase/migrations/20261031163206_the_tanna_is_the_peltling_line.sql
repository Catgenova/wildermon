set local lock_timeout = '3s';

-- The Tanna is the Peltling line: a Peltipede at 25 and a Hideweaver at 50; the Hideweaver tans one more hide a cycle
-- (`stage_loads`). All of it is in the definitions just before this (20261031163205_defs.sql); shut the doors behind
-- them as after every change.
select private.lock_doors();
