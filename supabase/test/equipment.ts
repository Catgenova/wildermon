/**
 * The Equipment window's numbers are the fight's own.
 *
 * Asked: an Equipment window where things are dragged on and off a figure of
 * you, with every combat number and the skills behind them. Whatever it says
 * has to be what a fight would do, so each number it shows is set against the
 * rule that decides it in a fight, for a body in a sword, a mail shirt, a
 * leather cap and boots and a wooden shield, with more in the pack:
 *
 *   * a blow: damage (`weaponDamage` in the stance), time (`Game.swingTime`),
 *     landing (`hitChance`), critical (`myCritChance`, `critMul`) and reach;
 *   * a blow taken: what gets through of each kind (`Game.expectedBlow`), the
 *     dodge (`Game.dodge`), the block (`blockChance`), and what each place
 *     turns (`pieceSoak`);
 *   * each skill's line: what the rule gives at your level against at where
 *     the skill starts, and at the next level;
 *   * the shelf: what in the pack goes on and where, and its number against
 *     what is on there;
 *   * and putting on and taking off goes through the same jobs as the pack's
 *     menu (`equip`, `unequip`), into the place the thing is worn.
 *
 * No database: the window is the browser's, and the jobs are the ones the
 * island already runs.
 */
import { ACTION_BY_ID } from '../../src/game/actions';
import { blockChance, critMul, myCritChance, stanceDealt } from '../../src/game/fight';
import { Game } from '../../src/game/game';
import { ARMOUR_BY_ID, ARMOUR_CLASSES, hitChance, pieceSoak, SHIELDS, SLOTS, slotOf, WEAPON_BY_ID, weaponDamage } from '../../src/game/gear';
import { SKILL_BY_ID } from '../../src/game/skills';
import { equipReport, fitsSlot } from '../../src/ui/equipment';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const near = (a: number, b: number, by = 1e-9): boolean => Math.abs(a - b) <= by * Math.max(1, Math.abs(b));

const g = Game.create(4242);
const inv = g.inventory;
for (const it of [...inv.items]) inv.remove(it.uid, it.count);
const put = (id: string, ql: number, extra?: string): number => {
  const it = inv.add(id, { ql, ...(extra ? { extra } : {}) });
  const slot = slotOf(id);
  if (slot) g.player.equipped[slot] = it.uid;
  return it.uid;
};
put('sword', 42, 'Iron');
put('chain_hauberk', 35, 'Iron');
put('leather_cap', 28);
put('leather_boots', 30);
put('wooden_shield', 33, 'Oak');
const better = inv.add('long_sword', { ql: 70, extra: 'Steel' });
const coif = inv.add('chain_coif', { ql: 40, extra: 'Iron' });
inv.add('plate_legs', { ql: 25, extra: 'Iron' });
g.skills.values.set('swords', 23.4);
g.skills.values.set('fighting', 18.2);
g.skills.values.set('chain_armour', 12.6);
g.skills.values.set('shields', 9.3);

const r = equipReport(g);
const stat = (list: typeof r.offence, key: string): number => list.find((s) => s.key === key)?.value ?? NaN;
const sword = WEAPON_BY_ID.get('sword');
const held = g.worn('weapon') ?? null;
if (!sword) throw new Error('no sword');
const perk = (k: string, o: number): number => g.perk(k, o);

/* ---- a blow ---- */
check('a blow does what `weaponDamage` says, in the stance',
  near(stat(r.offence, 'damage'), weaponDamage(g, sword, held) * stanceDealt(g.settings.fightStance, perk)), `${stat(r.offence, 'damage')}`);
check('a swing takes what `Game.swingTime` says', near(stat(r.offence, 'swing'), g.swingTime(sword, held).secs), `${stat(r.offence, 'swing')}`);
check('it lands as often as `hitChance` says', near(stat(r.offence, 'lands'), hitChance(g, sword, held)), `${stat(r.offence, 'lands')}`);
check('and is critical as often as `myCritChance` says, as hard as `critMul`',
  near(stat(r.offence, 'crit'), myCritChance(g, sword)) && (r.offence.find((s) => s.key === 'crit')?.says ?? '').includes(`×${+critMul(g, sword).toFixed(2)}`),
  r.offence.find((s) => s.key === 'crit')?.says);
const dps = stat(r.offence, 'damage') * stat(r.offence, 'lands') * (1 + stat(r.offence, 'crit') * (critMul(g, sword) - 1)) / stat(r.offence, 'swing');
check('damage a second is a blow, landing and criticals, over its time', near(stat(r.offence, 'dps'), dps), `${stat(r.offence, 'dps')}`);
check('the four up top are the same numbers', near(r.head[0].value, stat(r.offence, 'damage')) && near(r.head[1].value, stat(r.offence, 'lands')));

/* ---- a blow taken ---- */
check('of each kind of blow, what gets through is `Game.expectedBlow` of it', r.through.every((t) => near(t.share, g.expectedBlow(1, t.kind))),
  r.through.map((t) => `${t.kind} ${t.share.toFixed(3)}`).join(', '));
check('the dodge is `Game.dodge`', near(stat(r.defence, 'dodge'), g.dodge()));
const sh = SHIELDS.wooden_shield;
const shield = g.worn('offhand');
check('the block is `blockChance` of the shield on',
  !!shield && near(stat(r.defence, 'block'), Math.min(1, blockChance(sh.block, shield.ql, g.skills.get('shields'), perk) + g.wornEnchant('block'))));
const chest = r.slots.find((s) => s.slot === 'chest');
const mail = g.worn('chest');
const mailDef = mail && ARMOUR_BY_ID.get(mail.id);
check('what the chest turns is `pieceSoak` of the mail on it',
  !!mail && !!mailDef && near(chest?.soak ?? NaN, Math.min(0.92, pieceSoak(mailDef, mail, g.skills.get(ARMOUR_CLASSES[mailDef.cls].skill)) * g.pathFx('hide', 1))),
  `${chest?.soak}`);
check('a place with nothing on it turns nothing', r.slots.find((s) => s.slot === 'arms')?.soak === null);

/* ---- the skills ---- */
const swords = r.skills.find((s) => s.id === 'swords');
const dealt = stanceDealt(g.settings.fightStance, perk);
const at = (v: number): number => {
  const was = g.skills.get('swords');
  g.skills.values.set('swords', v);
  const d = weaponDamage(g, sword, held) * dealt;
  g.skills.values.set('swords', was);
  return d;
};
const start = SKILL_BY_ID.get('swords')?.start ?? 0;
const blowLine = swords?.gives.find((x) => x.what === 'A blow');
const wantNow = `${at(start).toFixed(1)} → ${at(23.4).toFixed(1)}`;
// The next level is said only where it moves the number as shown.
const wantNext = at(24).toFixed(1) === at(23.4).toFixed(1) ? null : `${at(24).toFixed(1)} at 24`;
check('Swords: a blow is the rule at where the skill starts → at your level, and at the next level where that moves it',
  !!blowLine && blowLine.now === wantNow && blowLine.next === wantNext,
  `${blowLine?.now} / ${blowLine?.next} against ${wantNow} / ${wantNext}`);
check('the skills it lists are the ones the fight reads off what is on: the weapon\'s, fighting, strength, control, shields and the mail\'s',
  ['swords', 'fighting', 'body_strength', 'body_control', 'shields', 'chain_armour'].every((id) => r.skills.some((s) => s.id === id)),
  r.skills.map((s) => s.id).join(', '));

/* ---- the shelf ---- */
check('the shelf holds what in the pack goes on and is not on, each in its own place',
  r.shelf.length === 3 && r.shelf.every((s) => slotOf(s.item.id) === s.slot && !g.isEquipped(s.item.uid)), r.shelf.map((s) => s.item.id).join(', '));
const ls = r.shelf.find((s) => s.item.uid === better.uid);
const blowWith = weaponDamage(g, WEAPON_BY_ID.get('long_sword') ?? sword, better) * dealt;
const wantBlow = `A blow ${stat(r.offence, 'damage').toFixed(1)} → ${blowWith.toFixed(1)}`;
check('a better sword says a blow now → with it on, for the better',
  !!ls && ls.main?.better === true && ls.main.text === wantBlow, `${ls?.main?.text ?? ''} against ${wantBlow}`);
const cs = r.shelf.find((s) => s.item.uid === coif.uid);
check('a coif where a cap is says how much more the head turns, for the better',
  cs?.main?.better === true && /^[\d.]+% → [\d.]+% turned$/.test(cs.main.text), cs?.main?.text ?? '');
const hand = r.slots.find((v) => v.slot === 'weapon');
check('a two-handed sword with a shield on is a trade, not an upgrade: it says the shield comes off and what more gets through',
  !!WEAPON_BY_ID.get('long_sword')?.twoHanded && hand?.upgrade === 'trade' && !!ls?.effects.some((e) => !e.better && e.text === 'two-handed: shield off')
    && !!ls?.effects.some((e) => !e.better && e.text.startsWith('through +')), `${hand?.upgrade}: ${hand?.upgradeSays}`);
check('a coif where a cap is: an upgrade, as all it costs is a slower swing, and its tooltip names that',
  r.slots.find((v) => v.slot === 'head')?.upgrade === 'up' && (r.slots.find((v) => v.slot === 'head')?.upgradeSays ?? '').includes('; worse: swing +'), r.slots.find((v) => v.slot === 'head')?.upgradeSays ?? '');
const order = r.shelf.map((x) => x.verdict);
check('the shelf puts clean upgrades before trades, and trades before what does less',
  order.every((v, i) => i === 0 || ({ up: 0, trade: 1, down: 2 })[order[i - 1]] <= ({ up: 0, trade: 1, down: 2 })[v]) && ls?.verdict === 'trade', order.join(', '));
check('each socket takes only what is worn there', SLOTS.every((slot) => fitsSlot(coif.id, slot) === (slot === 'head')));

/* ---- on and off ---- */
const equip = ACTION_BY_ID.get('equip');
const unequip = ACTION_BY_ID.get('unequip');
equip?.perform({ kind: 'item', uid: coif.uid }, g);
const on = g.worn('head')?.uid === coif.uid;
unequip?.perform({ kind: 'item', uid: coif.uid }, g);
check('putting on goes into the place it is worn, and taking off empties it, by the pack\'s own jobs', on && !g.worn('head'));
const after = equipReport(g);
check('and the window then says the head is bare', after.slots.find((s) => s.slot === 'head')?.item === null);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nthe Equipment window's numbers are the fight's own — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
