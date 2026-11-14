-- A mould is past mending: no Repair, repair kit, Mend, ancient whetstone, nor a mender in the stores.
--
-- Reported: "Moulds should not be able to be repaired". A mould wears with every filling, and the help and its
-- description always said it cannot be mended; Repair took it all the same. Every mould (`mould_def`) is now gear
-- nothing mends, beside the ancient helm and short sword: the browser's `unmendable`.

set local lock_timeout = '3s';

create or replace function unmendable(p_def text) returns boolean language sql stable as $fn$
  select p_def in ('ancient_helm', 'ancient_short_sword') or exists (select 1 from mould_def m where m.id = p_def)
$fn$;

select private.lock_doors();
