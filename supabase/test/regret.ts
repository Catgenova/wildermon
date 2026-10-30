/**
 * The Bauble of Regret.
 *
 * Asked for: "Add a 3% chance for Bauble of Regret in archaeology. Bauble of
 * regret allows for the undoing of Class selection." What this asks, of both
 * sides and in the same words:
 *
 *   * the share of finds that are one is the same number on the island as in
 *     the browser, and is asked off the same roll as a tarnished bauble, so a
 *     tarnished bauble is still its own share of finds and the relics give up
 *     the difference;
 *   * one comes out of the ground whole, and says so;
 *   * breaking one (`rpc_regret_class`) is refused, in the browser's words,
 *     for a trade that is not a slot, a slot that is empty, a pack without
 *     one and a pack with only one put by; one in a bag is carried;
 *   * it puts the one trade down with its tree and leaves the other slot as it
 *     was, uses the bauble up, and says so; and the next trade taken up in
 *     that slot costs nothing;
 *   * no silver buys a change of trade: taking another up in a slot already
 *     held breaks a bauble and leaves the purse alone, and without one (or
 *     with only one kept back) it is refused in the browser's words, on the
 *     card and at the door;
 *   * it undoes a patron (`rpc_regret_patron`): the patron, its spells and
 *     their places on the spell bar go, and another patron may be taken;
 *   * and a path (`rpc_regret_path`): the path, its picks and its techniques
 *     on the bar go, a kept beast loses what Kin gave it, and a path may be
 *     chosen again; each refused, in the browser's words, with nothing to
 *     undo, without a bauble, and with only one kept back.
 *
 * Runs against the database the suite leaves behind, and puts it back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID } from '../../src/game/actions';
import { ITEM_DEFS } from '../../src/game/items';
import { CLASS_AT, CLASSES, PERK_CLASSES } from '../../src/game/classes';
import {
  BAUBLE_SHARE, classChanged, findKind, REGRET, REGRET_SAID, REGRET_SHARE, regretDone, regretEmpty, regretPathDone, regretPatronDone,
  TARNISHED,
} from '../../src/game/baubles';
import { perksOf } from '../../src/game/perks';
import { PATRON_AT, PATRON_BY_ID, spellsOf } from '../../src/game/patrons';
import { CHOOSE_AT, PATH_PICKS, PATHS } from '../../src/game/meditation';
import { FAITH } from '../../src/game/faith';

/** A Blessing spell of the first faith tier, to be cleared with the patron. */
const BLESS = spellsOf('blessing', 1)[0].id;
/** Love's first technique, for the path slot, and Kin, which reaches the beasts you keep (`kept:`). */
const REFRESH = PATH_PICKS.find((k) => k.path === 'love' && k.tier === 1 && k.kind === 'technique')!.id;
const KIN = PATH_PICKS.find((k) => k.path === 'love' && Object.keys(k.fx).some((f) => f.startsWith('kept:')))!.id;

// The Terraformer holds perks rather than a tree now: two of them, a tier apart.
const [TF_A, , , TF_B] = perksOf('terraformer').map((p) => p.id);
/** A Sworn Blade's first passive, which is a perk of the fighting trade like any other. */
const BLADE_PERK = perksOf('blade').find((p) => p.tier === 1 && Object.keys(p.fx).length > 0)!.id;

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wurm',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;
const nameOf = (id: string): string => CLASSES.find((c) => c.id === id)!.name;

/* ---- the same numbers ------------------------------------------------------ */
check('the island turns one up as often as the browser', psql('select regret_share()') === String(REGRET_SHARE), psql('select regret_share()'));
check('out of the same roll as a tarnished bauble', psql('select bauble_share()') === String(BAUBLE_SHARE), psql('select bauble_share()'));
check('both sides know it by the same name', psql(`select name from item_def where id = '${REGRET}'`) === ITEM_DEFS[REGRET].name,
  psql(`select name from item_def where id = '${REGRET}'`));
check('and the island has no price for a change of trade',
  psql("select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'class_change_cost'") === '0');
check('nor does any function on the island ask one', psql(`select coalesce(string_agg(p.proname, ','), 'none') from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f' and strpos(p.prosrc, 'class_change_cost') > 0`) === 'none');
check('and its description names no silver', !/silver/i.test(ITEM_DEFS[REGRET].description ?? ''), ITEM_DEFS[REGRET].description ?? '');
check('both sides describe it the same', psql(`select description from item_def where id = '${REGRET}'`) === ITEM_DEFS[REGRET].description,
  psql(`select description from item_def where id = '${REGRET}'`));

/* ---- the island ------------------------------------------------------------- */
const DIGS = 2500;
const out = psql(`
begin;
create temp table said (k text, v text);
do $$
declare w uuid; u uuid; tx int; ty int; j jsonb; b1 bigint; b2 bigint; bag bigint; v_purse bigint; c1 bigint; v_slot int; v_pslot int;
begin
  -- The suite's own island, sixteen a side, by name, and somebody on it.
  select id into w from world where name = 'Stonehaven';
  select p.uid into u from player p where p.world_id = w order by p.uid limit 1;
  for tx in 0..15 loop for ty in 0..15 loop
    perform land_set_height(w, tx, ty, 40); perform land_set_tile(w, tx, ty, tile_id('Dirt'));
  end loop; end loop;
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  delete from player_node where world_id = w and uid = u;
  update player set body_at = now(), x = 8.5, y = 8.5, act = null, act_queue = '[]', craft_class = null, combat_class = null
   where world_id = w and uid = u;

  /* What the trowel turns up, many times over, at the real share. */
  perform give(w, u, 'trowel', 1, 90);
  insert into skill (world_id, uid, id, value) values (w, u, 'archaeology', 90)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  for tx in 1..${DIGS} loop
    perform perform_dig(w, u, 'investigate', jsonb_build_object('kind', 'tile', 'x', 9, 'y', 9));
  end loop;
  insert into said select 'FINDS',
    coalesce(sum(i.count) filter (where i.def = '${REGRET}'), 0) || '|'
    || coalesce(sum(i.count) filter (where i.def = 'tarnished_bauble'), 0) || '|'
    || coalesce(sum(i.count) filter (where i.def = 'fragment'), 0)
    from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u;
  delete from item where world_id = w and holder = 'player' and holder_uid = u and def in ('${REGRET}', 'tarnished_bauble', 'fragment');

  /* And one, whatever the dice say. */
  create or replace function regret_share() returns double precision language sql immutable as 'select 1::double precision';
  -- A find is not always made; dig until one is.
  for tx in 1..40 loop
    perform perform_dig(w, u, 'investigate', jsonb_build_object('kind', 'tile', 'x', 9, 'y', 9));
    exit when exists (select 1 from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def = '${REGRET}');
  end loop;
  insert into said select 'WHOLE', count(*) || '|' || coalesce(min(i.ql) >= 1 and max(i.ql) <= 100, false) || '|'
    || coalesce(bool_and(i.dmg = 0), false)
    from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def = '${REGRET}';
  insert into said select 'FOUNDSAID', e.text from event e where e.world_id = w and e.uid = u and e.text like 'Found: Bauble%'
    order by e.n desc limit 1;
  insert into said select 'NOTARNISHED', count(*)::text from item i
   where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def in ('tarnished_bauble', 'fragment');
  delete from item where world_id = w and holder = 'player' and holder_uid = u and def = '${REGRET}';

  /* Breaking one. */
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  update player set craft_class = 'terraformer', combat_class = 'blade' where world_id = w and uid = u;
  insert into player_node (world_id, uid, node) values
    (w, u, '${TF_A}'), (w, u, '${TF_B}'), (w, u, '${BLADE_PERK}');
  perform class_fold(w, u);
  insert into said values ('KIND', coalesce(rpc_regret_class(w, 'fishing')->>'why', 'IT WENT THROUGH'));
  insert into said values ('NONE', coalesce(rpc_regret_class(w, 'craft')->>'why', 'IT WENT THROUGH'));
  update player set combat_class = null where world_id = w and uid = u;
  insert into said values ('EMPTY', coalesce(rpc_regret_class(w, 'combat')->>'why', 'IT WENT THROUGH'));
  update player set combat_class = 'blade' where world_id = w and uid = u;
  perform class_fold(w, u);
  -- One put by is not broken, and nothing is undone.
  b1 := give(w, u, '${REGRET}', 1, 40);
  update item set locked = true where id = b1;
  insert into said values ('LOCKED', coalesce(rpc_regret_class(w, 'craft')->>'why', 'IT WENT THROUGH'));
  insert into said select 'LOCKEDKEPT', coalesce(craft_class, 'none') || '|' || (select count(*) from item where id = b1)
    from player where world_id = w and uid = u;
  update item set locked = false where id = b1;
  -- And the second in a bag, which is still carried.
  bag := give(w, u, 'satchel', 1, 40);
  b2 := give(w, u, '${REGRET}', 1, 40);
  update item set inside = bag where id = b2;

  j := rpc_regret_class(w, 'craft');
  insert into said values ('UNDONE', coalesce(j->>'undone', '-') || '|' || coalesce(j->>'kind', '-') || '|' || coalesce(j->>'why', '-'));
  insert into said select 'SLOTS', coalesce(craft_class, 'none') || '|' || coalesce(combat_class, 'none')
    from player where world_id = w and uid = u;
  insert into said select 'NODES', coalesce(string_agg(node, ',' order by node), 'none')
    from player_node where world_id = w and uid = u;
  insert into said select 'FOLDED', coalesce((select string_agg(s, ',' order by s) from jsonb_array_elements_text(class_mul->'skills') s), 'none')
    from player where world_id = w and uid = u;
  insert into said select 'BAUBLES', count(*)::text from item i
   where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def = '${REGRET}';
  insert into said select 'UNDONESAID', e.text from event e where e.world_id = w and e.uid = u order by e.n desc limit 1;

  -- The next crafting trade, for nothing, with nothing in the purse.
  delete from item where world_id = w and holder = 'player' and holder_uid = u and def = 'coin';
  insert into skill (world_id, uid, id, value) values (w, u, 'mining', class_at())
    on conflict (world_id, uid, id) do update set value = class_at();
  j := rpc_take_class(w, 'miner');
  insert into said values ('NEXT', coalesce(j->>'took', 'nothing') || '|' || coalesce(j->>'regret', '?') || '|' || coalesce(j->>'why', '-'));

  -- And the other slot, with the last one, from the bag.
  j := rpc_regret_class(w, 'combat');
  insert into said select 'BAGGED', count(*)::text from item where id = b2;
  insert into said select 'COMBAT', coalesce(j->>'undone', '-') || '|' || coalesce(craft_class, 'none') || '|' || coalesce(combat_class, 'none')
    || '|' || (select coalesce(string_agg(node, ',' order by node), 'none') from player_node where world_id = w and uid = u)
    from player where world_id = w and uid = u;
  insert into said select 'COMBATSAID', e.text from event e where e.world_id = w and e.uid = u order by e.n desc limit 1;
  update player set combat_class = 'blade' where world_id = w and uid = u;
  insert into said values ('SPENT', coalesce(rpc_regret_class(w, 'combat')->>'why', 'IT WENT THROUGH'));

  /* A change of trade: a bauble, never silver. Miner held; Terraformer asked for, with silver in the purse. */
  insert into skill (world_id, uid, id, value) values (w, u, 'digging', class_at())
    on conflict (world_id, uid, id) do update set value = class_at();
  perform give_coins(w, u, 5000);
  v_purse := purse(w, u);
  delete from caller where uid = u;
  insert into said select 'SWAPCARD', coalesce(c->>'why', 'none') from jsonb_array_elements(rpc_classes(w)->'classes') c
   where c->>'id' = 'terraformer';
  j := rpc_take_class(w, 'terraformer');
  insert into said select 'SWAPNONE', coalesce(j->>'why', 'IT WENT THROUGH') || '|' || coalesce(craft_class, 'none') || '|' || (v_purse - purse(w, u))
    from player where world_id = w and uid = u;
  b1 := give(w, u, '${REGRET}', 1, 40);
  update item set locked = true where id = b1;
  insert into said select 'SWAPLOCKEDCARD', coalesce(c->>'why', 'none') from jsonb_array_elements(rpc_classes(w)->'classes') c
   where c->>'id' = 'terraformer';
  j := rpc_take_class(w, 'terraformer');
  insert into said select 'SWAPLOCKED', coalesce(j->>'why', 'IT WENT THROUGH') || '|' || coalesce(craft_class, 'none') || '|'
    || (select count(*) from item where id = b1) from player where world_id = w and uid = u;
  update item set locked = false where id = b1;
  insert into said select 'SWAPOPEN', coalesce(c->>'why', 'none') from jsonb_array_elements(rpc_classes(w)->'classes') c
   where c->>'id' = 'terraformer';
  delete from event where world_id = w and uid = u;
  j := rpc_take_class(w, 'terraformer');
  insert into said select 'SWAP', coalesce(j->>'took', '-') || '|' || coalesce(j->>'regret', '-') || '|' || coalesce(craft_class, 'none') || '|'
    || (v_purse - purse(w, u)) || '|' || (select count(*) from item where id = b1)
    from player where world_id = w and uid = u;
  insert into said select 'SWAPSAID', e.text from event e where e.world_id = w and e.uid = u and e.text like 'Class changed:%'
   order by e.n desc limit 1;
  delete from item where world_id = w and holder = 'player' and holder_uid = u and def = 'coin';

  /* A patron undone: Blessing, a spell of it on the bar. */
  insert into skill (world_id, uid, id, value) values (w, u, '${FAITH}', ${PATRON_AT})
    on conflict (world_id, uid, id) do update set value = excluded.value;
  update player set patron = null where world_id = w and uid = u;
  delete from player_spell where world_id = w and uid = u;
  delete from caller where uid = u;
  insert into said values ('NOPATRON', coalesce(rpc_regret_patron(w)->>'why', 'IT WENT THROUGH'));
  update player set patron = 'blessing' where world_id = w and uid = u;
  insert into player_spell (world_id, uid, spell) values (w, u, '${BLESS}');
  select min(s.slot) into v_slot from spell_slot s where s.school = 'faith';
  perform spell_bar_put(w, u, v_slot, '${BLESS}');
  insert into said select 'PATRONBAR', coalesce(spell_bar->>v_slot, 'empty') from player where world_id = w and uid = u;
  insert into said values ('PATRONNONE', coalesce(rpc_regret_patron(w)->>'why', 'IT WENT THROUGH'));
  b1 := give(w, u, '${REGRET}', 1, 40);
  update item set locked = true where id = b1;
  insert into said select 'PATRONLOCKED', coalesce(rpc_regret_patron(w)->>'why', 'IT WENT THROUGH') || '|' || coalesce(patron, 'none') || '|'
    || (select count(*) from item where id = b1) from player where world_id = w and uid = u;
  update item set locked = false where id = b1;
  delete from event where world_id = w and uid = u;
  j := rpc_regret_patron(w);
  insert into said select 'PATRONUNDONE', coalesce(j->>'why', '-') || '|' || coalesce(j->>'patron', 'none') || '|' || coalesce(patron, 'none') || '|'
    || (select count(*) from player_spell ps where ps.world_id = w and ps.uid = u) || '|'
    || coalesce(spell_bar->>v_slot, 'empty') || '|' || (select count(*) from item where id = b1)
    from player where world_id = w and uid = u;
  insert into said select 'PATRONSAID', e.text from event e where e.world_id = w and e.uid = u order by e.n desc limit 1;
  delete from caller where uid = u;
  j := rpc_take_patron(w, 'chaos');
  insert into said select 'PATRONAGAIN', coalesce(j->>'why', '-') || '|' || coalesce(patron, 'none') from player where world_id = w and uid = u;
  update player set patron = null where world_id = w and uid = u;
  delete from player_spell where world_id = w and uid = u;

  /* A path undone: Love, its technique on the bar, Kin on a beast kept. */
  insert into skill (world_id, uid, id, value) values (w, u, 'meditation', ${CHOOSE_AT})
    on conflict (world_id, uid, id) do update set value = excluded.value;
  update player set way = null where world_id = w and uid = u;
  delete from path_taken where world_id = w and uid = u;
  delete from caller where uid = u;
  insert into said values ('NOPATH', coalesce(rpc_regret_path(w)->>'why', 'IT WENT THROUGH'));
  update player set way = 'love', calm = 7, path_marks = '{"x":1}'::jsonb where world_id = w and uid = u;
  insert into path_taken (world_id, uid, pick) values (w, u, '${REFRESH}'), (w, u, '${KIN}');
  select min(s.slot) into v_pslot from spell_slot s where s.school = 'path';
  perform spell_bar_put(w, u, v_pslot, '${REFRESH}');
  insert into said select 'PATHBAR', coalesce(spell_bar->>v_pslot, 'empty') from player where world_id = w and uid = u;
  c1 := creature_spawn(w, 'rabba', 8.5, 10.5, 'active', now() - interval '60 days', u);
  update creature set kept = kept_of(w, u) where world_id = w and id = c1;
  insert into said select 'KEPTBEFORE', coalesce(kept::text, 'none') from creature where world_id = w and id = c1;
  insert into said values ('PATHNONE', coalesce(rpc_regret_path(w)->>'why', 'IT WENT THROUGH'));
  b1 := give(w, u, '${REGRET}', 1, 40);
  update item set locked = true where id = b1;
  insert into said select 'PATHLOCKED', coalesce(rpc_regret_path(w)->>'why', 'IT WENT THROUGH') || '|' || coalesce(way, 'none') || '|'
    || (select count(*) from item where id = b1) from player where world_id = w and uid = u;
  update item set locked = false where id = b1;
  delete from event where world_id = w and uid = u;
  j := rpc_regret_path(w);
  insert into said select 'PATHUNDONE', coalesce(j->>'why', '-') || '|' || coalesce(j->'path'->>'way', 'none') || '|' || coalesce(way, 'none') || '|'
    || (select count(*) from path_taken pt where pt.world_id = w and pt.uid = u) || '|'
    || coalesce(spell_bar->>v_pslot, 'empty') || '|' || (select count(*) from item where id = b1) || '|'
    || coalesce((select kept::text from creature where world_id = w and id = c1), 'none') || '|' || calm || '|' || path_marks::text
    from player where world_id = w and uid = u;
  insert into said select 'PATHSAID', e.text from event e where e.world_id = w and e.uid = u order by e.n desc limit 1;
  perform perform_faith(w, u, 'choose_path', '{"kind":"tile","material":"power"}');
  insert into said select 'PATHAGAIN', coalesce(way, 'none') from player where world_id = w and uid = u;
  delete from creature where world_id = w and id = c1;
end $$;
select k || E'\\t' || coalesce(v, 'null') from said;
rollback;
`);
const said = new Map(out.split('\n').filter(Boolean).map((l) => {
  const at = l.indexOf('\t');
  return [l.slice(0, at), l.slice(at + 1)] as [string, string];
}));
const say = (k: string): string => said.get(k) ?? '(nothing)';

const [iRegret, iTarnished, iFragments] = say('FINDS').split('|').map(Number);
const iFinds = iRegret + iTarnished + iFragments;
check(`the island turns up a Bauble of Regret for about ${pct(REGRET_SHARE)} of finds`,
  iFinds > DIGS / 3 && Math.abs(iRegret / iFinds - REGRET_SHARE) < 0.015, `${iRegret} of ${iFinds} (${pct(iRegret / iFinds)})`);
check(`and a tarnished bauble for about ${pct(BAUBLE_SHARE)} still`,
  Math.abs(iTarnished / iFinds - BAUBLE_SHARE) < 0.04, `${iTarnished} of ${iFinds} (${pct(iTarnished / iFinds)})`);
check('one comes up whole, of a quality, and nothing else with it', say('WHOLE') === '1|true|true' && say('NOTARNISHED') === '0',
  `${say('WHOLE')} / ${say('NOTARNISHED')}`);
const FOUND = /^Found: Bauble of Regret, QL \d+\.\d\. Undoes a class, patron or path\.$/;
check('and says so', FOUND.test(say('FOUNDSAID')), say('FOUNDSAID'));
check('a trade that is not a slot is refused', say('KIND') === REGRET_SAID.kind, say('KIND'));
check('as is breaking one without one', say('NONE') === REGRET_SAID.none, say('NONE'));
check('or with only one put by', say('LOCKED') === REGRET_SAID.locked, say('LOCKED'));
check('which is kept, and the trade with it', say('LOCKEDKEPT') === 'terraformer|1', say('LOCKEDKEPT'));
check('and an empty slot', say('EMPTY') === regretEmpty('combat'), say('EMPTY'));
check('one undoes the crafting trade', say('UNDONE') === 'terraformer|craft|-', say('UNDONE'));
check('and leaves the fighting one', say('SLOTS') === 'none|blade', say('SLOTS'));
check('its perks go with it, and the other trade’s stay', say('NODES') === BLADE_PERK, say('NODES'));
check('and what it gave is gone from the body',
  !CLASSES.find((c) => c.id === 'terraformer')!.skills.some((s) => say('FOLDED').split(',').includes(s))
    && CLASSES.find((c) => c.id === 'blade')!.skills.every((s) => say('FOLDED').split(',').includes(s)),
  say('FOLDED'));
check('one bauble is used up of two', say('BAUBLES') === '1', say('BAUBLES'));
check('said as the browser says it', say('UNDONESAID') === regretDone(nameOf('terraformer'), PERK_CLASSES.has('terraformer')),
  say('UNDONESAID'));
check('the next crafting trade in the empty slot breaks no bauble, with an empty purse', say('NEXT') === 'miner|false|-', say('NEXT'));
check('the fighting trade is undone the same way, with the one in the bag, and the crafting one kept',
  say('COMBAT') === 'blade|miner|none|none', say('COMBAT'));
check('the one in the bag is the one used', say('BAGGED') === '0', say('BAGGED'));
check('said as the browser says it', say('COMBATSAID') === regretDone(nameOf('blade'), PERK_CLASSES.has('blade')),
  say('COMBATSAID'));
check('and with none left, it is refused', say('SPENT') === REGRET_SAID.none, say('SPENT'));

check(`a change of trade without one is shut on its card, at ${CLASS_AT}, in the browser's words`, say('SWAPCARD') === REGRET_SAID.none, say('SWAPCARD'));
check('and refused at the door, silver or none: nothing changes, nothing paid', say('SWAPNONE') === `${REGRET_SAID.none}|miner|0`, say('SWAPNONE'));
check('with only one kept back, the card says so', say('SWAPLOCKEDCARD') === REGRET_SAID.locked, say('SWAPLOCKEDCARD'));
check('and so does the door, keeping it and the trade', say('SWAPLOCKED') === `${REGRET_SAID.locked}|miner|1`, say('SWAPLOCKED'));
check('back in the pack, the card is open', say('SWAPOPEN') === 'none', say('SWAPOPEN'));
check('and the change breaks it, and takes no silver', say('SWAP') === 'terraformer|true|terraformer|0|0', say('SWAP'));
check('said as the browser says it', say('SWAPSAID').startsWith(classChanged(nameOf('miner'), nameOf('terraformer'))), say('SWAPSAID'));

const PATH_NAME = PATHS.love.name;
const PATRON_NAME = PATRON_BY_ID.get('blessing')!.name;
check('no patron to undo, in the browser\'s words', say('NOPATRON') === REGRET_SAID.patron, say('NOPATRON'));
check('a patron without one is refused', say('PATRONNONE') === REGRET_SAID.none, say('PATRONNONE'));
check('or with one kept back, which is kept, and the patron', say('PATRONLOCKED') === `${REGRET_SAID.locked}|blessing|1`, say('PATRONLOCKED'));
check('its spell is on the bar first', say('PATRONBAR') === BLESS, say('PATRONBAR'));
check('one undoes the patron, its spells and its place on the bar, and is used up',
  say('PATRONUNDONE') === '-|none|none|0|empty|0', say('PATRONUNDONE'));
check('said as the browser says it', say('PATRONSAID') === regretPatronDone(PATRON_NAME), say('PATRONSAID'));
check('and another patron may be taken', say('PATRONAGAIN') === '-|chaos', say('PATRONAGAIN'));

check('no path to undo, in the browser\'s words', say('NOPATH') === REGRET_SAID.path, say('NOPATH'));
check('its technique is on the bar first', say('PATHBAR') === REFRESH, say('PATHBAR'));
check('Kin is on the kept beast first', say('KEPTBEFORE') !== 'none', say('KEPTBEFORE'));
check('a path without one is refused', say('PATHNONE') === REGRET_SAID.none, say('PATHNONE'));
check('or with one kept back, which is kept, and the path', say('PATHLOCKED') === `${REGRET_SAID.locked}|love|1`, say('PATHLOCKED'));
check('one undoes the path, its picks, its technique on the bar and Kin on the beast; Calm stays, the marks go',
  say('PATHUNDONE') === '-|none|none|0|empty|0|none|7|{}', say('PATHUNDONE'));
check('said as the browser says it', say('PATHSAID') === regretPathDone(PATH_NAME), say('PATHSAID'));
check('and a path may be chosen again', say('PATHAGAIN') === 'power', say('PATHAGAIN'));

/* ---- the browser ------------------------------------------------------------ */
check('under the share is a Bauble of Regret', findKind(0) === 'regret' && findKind(REGRET_SHARE - 1e-9) === 'regret');
check('above it, the next share is a tarnished bauble',
  findKind(REGRET_SHARE) === 'bauble' && findKind(REGRET_SHARE + BAUBLE_SHARE - 1e-9) === 'bauble');
check('and the rest are relics', findKind(REGRET_SHARE + BAUBLE_SHARE) === 'relic' && findKind(0.999999) === 'relic');

const game = Game.create(2718);
for (const it of [...game.inventory.items]) game.inventory.remove(it.uid, it.count);
game.inventory.add('trowel', { ql: 90 });
game.skills.values.set('archaeology', 90);
const dig = ACTION_BY_ID.get('investigate')!;
const N = 6000;
for (let i = 0; i < N; i++) {
  const x = 36 + (i % 12);
  const y = 36 + (Math.floor(i / 12) % 12);
  dig.perform({ kind: 'tile', x, y, cx: x, cy: y }, game);
}
const count = (id: string): number => game.inventory.items.filter((i) => i.id === id).reduce((n, i) => n + i.count, 0);
const bRegret = count(REGRET);
const bTarnished = count(TARNISHED);
const bFinds = bRegret + bTarnished + count('fragment');
check(`the browser turns one up for about ${pct(REGRET_SHARE)} of finds too`,
  bFinds > N / 3 && Math.abs(bRegret / bFinds - REGRET_SHARE) < 0.01, `${bRegret} of ${bFinds} (${pct(bRegret / bFinds)})`);
check(`and a tarnished bauble for about ${pct(BAUBLE_SHARE)} still`,
  Math.abs(bTarnished / bFinds - BAUBLE_SHARE) < 0.03, `${bTarnished} of ${bFinds} (${pct(bTarnished / bFinds)})`);
check('whole, every one of them', game.inventory.items.filter((i) => i.id === REGRET).every((i) => i.dmg === 0 && i.ql >= 1 && i.ql <= 100));
const logged = game.log.filter((l) => l.text.startsWith('Found: Bauble')).map((l) => l.text);
check('said as the island says it', logged.length > 0 && logged.every((t) => FOUND.test(t))
  && logged[0].replace(/QL [\d.]+/, 'QL') === say('FOUNDSAID').replace(/QL [\d.]+/, 'QL'), logged[0] ?? '(nothing)');

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
if (bad.length) process.exit(1);
