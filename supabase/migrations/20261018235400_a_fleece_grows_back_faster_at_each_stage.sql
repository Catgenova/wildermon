-- Asked for: the Cloudlet's fleece grows back faster at each stage ("Yes, faster regrowth"). A stage now multiplies the
-- `grow` channel too -- how fast a fleece grows back and milk comes in -- by `stage_mul_grow` over the one before, as the
-- browser's `STAGE_MUL.grow`, the same share it is quicker at a task by. `creature_settle` grows a fleece through
-- `beast_mul(c, 'grow')`, which reads it here.

-- What its stage makes of one channel of its blood (`evoMul`).
create or replace function evo_mul(c creature, p_channel text) returns double precision language sql stable as $fn$
  select case when p_channel not in ('hardy', 'tough', 'speed', 'work', 'grow') then 1::double precision
              else (case p_channel when 'hardy' then stage_mul_hardy() when 'tough' then stage_mul_tough()
                                   when 'speed' then stage_mul_speed() when 'grow' then stage_mul_grow()
                                   else stage_mul_work() end) ^ stage_of(c) end
$fn$;

select private.lock_doors();
