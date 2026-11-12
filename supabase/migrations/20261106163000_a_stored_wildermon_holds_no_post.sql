-- A stored wildermon holds no post and works round nobody, whatever put it in its crate.
--
-- Reported, after the last: "my posts keep saying that oremander is working out of them but they're crated". A post's
-- worker is whichever wildermon has it as its post, on both sides (`Game.teamsFromCreatures`, `settlement_refusal`),
-- so a stored row with its post still on it kept the post taken. The one way into a crate now clears both, and this
-- makes it the row's own rule: on any insert or update that leaves a wildermon stored, its post and its `around` are
-- null, whichever function wrote it. And every stored row still holding either is put right.

set local lock_timeout = '3s';

create or replace function private.creature_stored_rests() returns trigger language plpgsql as $fn$
begin
  if new.mode = 'stored' then
    new.post := null;
    new.around := null;
  end if;
  return new;
end $fn$;

drop trigger if exists creature_stored_rests on creature;
create trigger creature_stored_rests before insert or update of mode, post, around on creature
  for each row execute function private.creature_stored_rests();

update creature set post = null, around = null where mode = 'stored' and (post is not null or around is not null);

select private.lock_doors();
