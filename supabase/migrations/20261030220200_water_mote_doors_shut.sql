set local lock_timeout = '3s';

-- The water mote's generated words (`water_mote`, `water_motes_each`, `water_mote_need`) came in with the definitions
-- after the doors were last shut, open to a player as every new function is; shut them as all the rest are.
select private.lock_doors();
