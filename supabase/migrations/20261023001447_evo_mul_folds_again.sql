set local lock_timeout = '3s';

/*
 * What its stage makes of one channel of its blood, and its line's own third-stage skill on it (`evoMul`), with no
 * sublink in it, so that it folds into `beast_mul` and `max_health` (`folded`): a plpgsql body is never folded, nor is
 * one with a sublink, and every creature the world tick moves asks it. Health, growth and work are asked most and no
 * line's skill is on them (`stagethree` holds the table to that), so they are its stage alone; on the other channels
 * its line's skill is looked up (`evo_perk`), and only there.
 */
create or replace function evo_perk(c creature, p_channel text) returns double precision language sql stable as $fn$
  select coalesce((select sd.perk_n from species_def sd
                    where sd.id = c.species and sd.perk = 'blood' and sd.perk_channel = p_channel), 1)
$fn$;

create or replace function evo_mul(c creature, p_channel text) returns double precision language sql stable as $fn$
  select case
    when p_channel = 'hardy' then stage_mul_hardy() ^ stage_of(c)
    when p_channel = 'work' then stage_mul_work() ^ stage_of(c)
    when p_channel = 'grow' then stage_mul_grow() ^ stage_of(c)
    when p_channel = 'tough' then stage_mul_tough() ^ stage_of(c) * case when stage_of(c) >= perk_stage() then evo_perk(c, p_channel) else 1 end
    when p_channel = 'speed' then stage_mul_speed() ^ stage_of(c) * case when stage_of(c) >= perk_stage() then evo_perk(c, p_channel) else 1 end
    else case when stage_of(c) >= perk_stage() then evo_perk(c, p_channel) else 1 end
  end::double precision
$fn$;

select private.lock_doors();
