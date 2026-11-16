/*
 * A worn bag's carry limit bonus by its rarity, as its room is.
 *
 * Asked for: "backpack rarity should increase storage capacity like with containers", and asked whether rarity should
 * raise the carry limit bonus a worn bag gives too: "Yes it should raise carry capacity". A bag's room already takes
 * `rarity_room()` more a rarity step (`room_for`); its carry limit bonus now takes the same, of the bonus, unrounded:
 *
 *   * `rarity_share`: a share by a thing's rarity, `rarity_room()` more of it a step (the browser's `rarityShare`);
 *   * `bag_carry`: what one worn bag adds, its share at QL 100 times QL / 100, by its rarity (`bagCarry`);
 *   * `bags_carry`: the bags worn, each by `bag_carry`;
 *   * `bag_carry_pct`, `bag_text`: examine says this bag's room and carry limit bonus in the kind's text, "Holds 66
 *     things" and "carry limit +55%" for "Holds 60 things" and "carry limit +50% × QL%" (`bagCarryPct`, `bagText`).
 */
set local lock_timeout = '3s';

create or replace function pg_temp.patch_fn(p_sig regprocedure, p_old text, p_new text, p_times int default 1) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_times then
    raise exception '%: % of "%", wanted %', p_sig, v_n, left(p_old, 120), p_times;
  end if;
  execute replace(v_def, p_old, p_new);
end $p$;

-- A share by a thing's rarity: `rarity_room()` more of it a step, unrounded (`rarityShare`). Plpgsql, so a step that
-- asks it through `carry_limit` plans its lookup once a session (20261101351002).
create or replace function rarity_share(p_share double precision, p_rare text) returns double precision
language plpgsql stable as $$
begin
  return p_share * (1 + rarity_room() * least(3, coalesce((select ord from rarity_def where id = p_rare), 0)));
end $$;

-- What one worn bag adds to the carry limit, as a share of it: its share at QL 100, times QL / 100, by its rarity (`bagCarry`).
create or replace function bag_carry(it item) returns double precision
language sql stable as $$
  select rarity_share(case it.def when 'backpack' then bag_carry_backpack() when 'sack' then bag_carry_sack() else 0 end
                      * least(100, it.ql) / 100, it.rare)
$$;

/** What the bags worn add to the carry limit, as a share of it: a backpack on the back, a sack at the side, by QL and rarity. */
create or replace function bags_carry(p_world uuid, p_uid uuid) returns double precision
  language plpgsql stable as $function$
#variable_conflict use_column
begin
  return (
  select coalesce(sum(bag_carry(i)), 0)
    from player p
    join item i on i.world_id = p.world_id and i.holder = 'player' and i.holder_uid = p.uid
     and i.id in ((p.equipped->>'back')::bigint, (p.equipped->>'side')::bigint)
   where p.world_id = p_world and p.uid = p_uid
  );
end
$function$;

-- A worn bag's carry limit bonus as a percent to a tenth: "45.7%" (`bagCarryPct`).
create or replace function bag_carry_pct(p_share double precision) returns text
language sql immutable as $$
  select (floor(p_share * 1000 + 0.5) / 10)::text || '%'
$$;

-- A kind's text, said of this one: its room (`bag_room`) and a worn bag's carry limit bonus (`bag_carry`) (`bagText`).
create or replace function bag_text(it item, p_text text) returns text
language sql stable as $$
  select case when it.def in ('backpack', 'sack')
              then regexp_replace(a.t, 'carry limit \+[0-9.]+% × QL%', 'carry limit +' || bag_carry_pct(bag_carry(it)), 'g')
              else a.t end
    from (select case when coalesce((select holds from item_def where id = it.def), 0) > 0
                      then replace(p_text, 'Holds ' || bag_room(it.def) || ' ', 'Holds ' || bag_room(it) || ' ')
                      else p_text end as t) a
$$;

select pg_temp.patch_fn('examine_item_text(uuid, uuid, item)',
  $o$  if d.description is not null then v_out := v_out || ' ' || d.description; end if;$o$,
  $n$  -- A bag's room and a worn bag's carry limit bonus, this one's (`bag_text`).
  if d.description is not null then v_out := v_out || ' ' || bag_text(it, d.description); end if;$n$);

select private.lock_doors();
