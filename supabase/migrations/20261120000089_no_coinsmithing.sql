/*
 * No coinsmithing.
 *
 * Asked: "Coinsmithing needs to be removed entirely." Striking coins at an
 * anvil goes, and with it the coin die and the coin die mould. Coins stay as
 * the currency: found foraging (`coin_find_one_in`, `coin_finds_a_day`),
 * paid out as change (`give_coins`), and moved by deals, stalls, orders and
 * barter.
 *
 *   * `strike_coins` leaves the anvil's dispatch (`forge_action`), the forge's
 *     work list (`forge_work`), its refusal (`forge_refusal`), its performer
 *     (`perform_forge`) and the craft kinds a thing came from
 *     (`private.origin_act_kind`); what only it read goes: `die_wear`,
 *     `coin_difficulty`, `coin_ql_weight` and `metal_def.coins`.
 *   * The definitions (`20261120000090_defs.sql`, after this) take the action,
 *     the die, the mould and its recipe off the tables.
 *   * Every coin die anywhere -- a pack, a bag, a crate, a store, a stall, a
 *     parcel, the ground -- comes back where it was as the lumps it was cast
 *     from (`melt_def`, read here while it still has the die: two), of its
 *     metal (`extra`) and at its quality. One with no metal named is deleted.
 *     Every coin die mould is deleted: sand, no metal. A player who held
 *     either is told.
 *   * The market: an open buy order for either is withdrawn and its silver
 *     given back (`order_close`); a settlement's open work for either is
 *     dropped; either is taken off an open barter; their sale history goes.
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

/* ---- the action ---------------------------------------------------------------------------------- */

select pg_temp.patch_fn('forge_action(text)',
  $o$'place_anvil', 'pick_up_anvil', 'smith', 'strike_coins')$o$,
  $n$'place_anvil', 'pick_up_anvil', 'smith')$n$);

select pg_temp.patch_fn('forge_work(text)',
  $o$'smith', 'strike_coins')$o$,
  $n$'smith')$n$);

select pg_temp.patch_fn('forge_refusal(uuid, uuid, text, jsonb)',
  $o$  if p_action = 'strike_coins' then
    -- Coins: a die in the pack, and a lump of a metal that coins, in the
    -- words the browser uses.
    if pack_count(p_world, p_uid, 'coin_die') < 1 then return 'Need a coin die.'; end if;
    v_lump := smith_lump(p_world, p_uid, target_item(p_target));
    if v_lump.id is null then return 'Need metal.'; end if;
    if not coalesce((metal_by_bar(v_lump.def)).coins, false) then return 'Coins: gold only.'; end if;
    return null;
  end if;
$o$,
  $n$$n$);

select pg_temp.patch_fn('perform_forge(uuid, uuid, text, jsonb)',
  $o$  if p_action = 'strike_coins' then
    -- The die wears with every strike, good or bad, and no die can be mended.
    select * into v_mould from item where world_id = p_world and holder = 'player' and holder_uid = p_uid
      and def = 'coin_die' order by tool_worth(ql, dmg, extra, rare, bless) desc limit 1;
    v_lump := smith_lump(p_world, p_uid, target_item(p_target));
    m := metal_by_bar(v_lump.def);
    if v_mould.id is null or v_lump.id is null or m.id is null or not m.coins then return; end if;
    -- A bar is broken into for the lump a strike takes (a Smith's Ingots).
    v_lump := unbar(p_world, p_uid, v_lump.id, 1);
    if v_lump.id is null or v_lump.count < 1 or not at_hand(p_world, p_uid, v_lump.id) then return; end if;
    v_mould_ql := greatest(1, v_mould.ql - v_mould.dmg / 2);
    v_broke := v_mould.dmg + die_wear() >= 100;
    if v_broke then
      delete from item where id = v_mould.id;
    else
      update item set dmg = least(100, v_mould.dmg + die_wear()) where id = v_mould.id;
    end if;
    v_hard := coin_difficulty() + (mat_of(v_lump.extra)).difficulty;
    -- The smith's hand, and then the gold itself: poor metal will not take the
    -- die however well it is struck (`coinPurity`). A Smith's Sure Hammer fails
    -- half as often (`fail:` and the job). The lump is gone either way.
    v_struck := skill_check(skill_of(p_world, p_uid, 'blacksmithing'), v_hard, anvil_ql(p), mind_ease(p_world, p_uid));
    v_pure := random() < 1 - coin_ql_weight() * (1 - least(100, greatest(0, v_lump.ql)) / 100);
    if not perk_pass(v_struck and v_pure, pk(p_world, p_uid, 'fail:' || p_action, 1)) then
      perform skill_raise(p_world, p_uid, 'blacksmithing', try_gain(false, smith_gain()));
      perform tell(p_world, p_uid, fail_damaged_said('Failed: coins, ' || case when v_struck then 'gold too poor for the die'
                                        else 'skill check' end || '.', fail_damage_item(v_lump.id, 1))
        || case when v_broke then ' Coin die worn out.' else '' end, 'event');
      return;
    end if;
    if not spend_stack(p_world, p_uid, v_lump.id, 1) then return; end if;
    -- And higher for a Masterwork on the anvil (`enchanting.ts`).
    v_ql := least(100, smith_ql(p_world, p_uid, 'blacksmithing', v_mould_ql, v_lump.ql, anvil_ql(p)) + placed_enchant(p, 'master'));
    perform skill_raise(p_world, p_uid, 'blacksmithing', try_gain(true, smith_gain()));
    -- The one lump a strike uses is all that goes into it, so a rare lump is the whole of it (`rarity_roll_from`).
    v_rare := rarity_roll_from(rarity_one(v_lump.rare), null);
    if v_lump.rare is not null then perform tell(p_world, p_uid, rare_input_said(rarity_one(v_lump.rare)), 'event'); end if;
    v_made := give(p_world, p_uid, 'coin', coins_per_lump()::int, v_ql, m.name, v_rare, maker_mark(p_world, p_uid, v_rare));
    perform journal_made(p_world, p_uid, 'coin', v_ql, coins_per_lump()::int, v_rare);
    perform journal_note(p_world, p_uid, 'minted');
    if v_rare is not null then
      perform journal_note(p_world, p_uid, v_rare);
      perform tell(p_world, p_uid, rarity_word(v_rare), 'skill');
    end if;
    perform tell(p_world, p_uid, 'Struck: ' || coins_per_lump()::int || ' × ' || lower(m.name)
      || ' coin, QL ' || to_char(v_ql, 'FM990.0') || '.'
      || case when v_broke then ' Coin die worn out.'
              else ' Coin die: ' || ceil((100 - (v_mould.dmg + die_wear())) / die_wear())::int || ' strikes left.' end, 'event');
    return;
  end if;

$o$,
  $n$$n$);

select pg_temp.patch_fn('private.origin_act_kind(text)',
  $o$array['smith', 'strike_coins', 'quench_item']$o$,
  $n$array['smith', 'quench_item']$n$);

-- Read by the strike alone.
drop function if exists die_wear();
drop function if exists coin_difficulty();
drop function if exists coin_ql_weight();
select private.shut('alter table metal_def drop column if exists coins');

/* ---- the dies and the moulds, wherever they are ------------------------------------------------- */

-- Rows written here read as the migration's (`item_origin`).
select set_config('wildermon.source', 'migration', true);

create temp table gone_die as
  select i.id, i.world_id, i.holder, i.holder_uid, i.def, i.count, i.ql, m.lump, m.name as metal,
         case when i.def = 'coin_die' and m.lump is not null
              then (i.count * coalesce((select content from melt_def where item = 'coin_die'), 0))::int else 0 end as lumps
    from item i left join metal_def m on i.def = 'coin_die' and i.extra is not null and lower(m.name) = lower(i.extra)
   where i.def in ('coin_die', 'coin_die_mould');

-- Off any barter it was put on.
delete from barter_item b using gone_die g where b.world_id = g.world_id and b.item = g.id;

-- The lumps, where the die was.
insert into item (world_id, holder, holder_uid, gx, gy, inside, crate, placed, creature, pannier, letter, def, ql, count, extra)
  select i.world_id, i.holder, i.holder_uid, i.gx, i.gy, i.inside, i.crate, i.placed, i.creature, i.pannier, i.letter,
         g.lump, i.ql, g.lumps, g.metal
    from gone_die g join item i on i.id = g.id
   where g.lumps > 0;

select tell(g.world_id, g.holder_uid,
            case when g.lumps > 0 then 'Removed: coin die. Refunded: ' || g.lumps || ' × ' || lower(g.metal) || ' lump, QL '
                                       || to_char(g.ql, 'FM990.0') || '.'
                 else 'Removed: ' || lower(coalesce((select name from item_def where id = g.def), g.def)) || '.' end, 'system')
  from gone_die g
 where g.holder = 'player' and g.holder_uid is not null
   and exists (select 1 from player p where p.world_id = g.world_id and p.uid = g.holder_uid);

delete from item i using gone_die g where i.id = g.id;
drop table gone_die;

/* ---- the market ------------------------------------------------------------------------------------ */

select order_close(o, 'withdrawn') from buy_order o
 where o.def in ('coin_die', 'coin_die_mould') and o.closed_at is null;

update deed_work set closed_at = now(), how = 'dropped'
 where def in ('coin_die', 'coin_die_mould') and closed_at is null;

delete from sale where def in ('coin_die', 'coin_die_mould');

select private.lock_doors();
