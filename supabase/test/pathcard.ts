/**
 * The Path's card (`src/ui/pathcard.ts`, `src/ui/pathpreview.ts`; `how`, `why`, `show` and `watchPathCards` in
 * `src/game/path.ts`).
 *
 * Asked for: "Path needs to also display as a popup as each task is completed, with no-prose description of what to
 * do next, how, and why. Bonus points if we can add a gif of the action(s) to that popup." So this asks:
 *
 *   * that every step has its how and its why, built from the rules: no figure written into their text (the source
 *     read, as `benefit.ts` reads it), the menu labels, tools and skills the actions' and recipes' own, a tame step's
 *     kind, where it lives, its bait and its taming, an upgrade's requirements the deed's, and the numbers each why
 *     names (logs for the walls, shards for the bricks, the smelter's bill, the anvil's lumps, an upgrade's border
 *     and workers, Track's seconds) the rules' own, with the step each names being the one that takes it;
 *   * that every step's picture plays a clip of its own (not the placeholder), an emote there is, or the walk, and a
 *     tame step's has its kind beside it;
 *   * in the rules: a look that ticks a step puts one card up naming it and the next step; one that ticks several at
 *     once, one card naming them all; a look that ticks nothing, none; the first look of a page opened with the Path
 *     on, none however much it ticks; the Path turned on mid-game, one card with the next step and no list of what
 *     was met before, and nothing more until a step ticks;
 *   * and in Chromium (`pathcard-page.ts`), the card itself: up on a tick with Done, Next, How and Why, its three
 *     buttons, its picture drawn and moving; Skip next names the step after; the Path tab button opens the tab; a job
 *     started inside `PATH_CARD_HOLD` seconds leaves it up and one after takes it down; Path pop-ups Off puts none
 *     up; Animations Off draws one still frame and then nothing.
 *
 * With `PATHCARD_SHOTS` set to a directory, it saves pictures of the card there: a tame step, a craft step and an
 * upgrade step, and the frames of its picture playing.
 *
 * Needs no database. Run from the repository root:
 *
 *   npx esbuild supabase/test/pathcard.ts --bundle --platform=node --format=esm \
 *     --external:typescript --external:esbuild --external:playwright-core \
 *     --outfile=node_modules/.cache/pathcard.mjs && node node_modules/.cache/pathcard.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { build } from 'esbuild';
import { chromium, type LaunchOptions } from 'playwright-core';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID } from '../../src/game/actions';
import { layingBill } from '../../src/game/buildActions';
import { DEED_UPGRADES } from '../../src/game/deed';
import { deedRadiusAt, deedWorkersAt } from '../../src/game/deedsize';
import { EMOTE_BY_ID } from '../../src/game/emotes';
import { SPECIES } from '../../src/game/creatures';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { SKILL_BY_ID } from '../../src/game/skills';
import { itemDef } from '../../src/game/items';
import { TRACK_SHOW } from '../../src/game/tracking';
import {
  ANVIL_LUMPS, currentStep, pathCardSays, pathCheck, PATH_BUILD, PATH_CARD_HOLD, PATH_DETOURS, PATH_STEP_BY_ID, PATH_STEPS,
  SMELTER_BRICKS, SMELTER_MORTAR, stepNumber, UNMET_MARK, watchPathCards,
} from '../../src/game/path';
import { PLACEHOLDER, workClipOf } from '../../src/sculpt/anim';
import type { CardView } from './pathcard-page';
import { check, finish } from './harness';
import { SKILL_GATES } from '../../src/game/skillgates';
import { listedOr } from '../../src/game/words';

/* ---- every step's how and why, from the rules ------------------------------------------------------------------- */

{
  const g = Game.create(5151);
  for (const s of PATH_STEPS) {
    const how = s.how(g), why = s.why(g);
    check(`${stepNumber(s)}. ${s.id}: a how and a why`, how.length > 0 && why.length > 0 && [...how, ...why].every((l) => l.trim().length > 0),
      JSON.stringify({ how, why }));
  }
}

// The source, read: no figure in the fixed text of a how, a why or the helpers that make them.
{
  const file = 'src/game/path.ts';
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  /** The helpers the card's lines are made by. */
  const HELPERS = new Set(['jobSays', 'craftSays', 'livesSays', 'trackSays', 'assignSays', 'tameHow', 'workSays', 'wantsSays', 'upgradeHow', 'thenSays', 'eatenBy', 'doneSays', 'toolSays', 'stepOf', 'baitSays', 'upgradeLine']);
  const written: string[] = [];
  const read = (node: ts.Node, where: string): void => {
    const texts: string[] = [];
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) texts.push(node.text);
    else if (ts.isTemplateExpression(node)) texts.push(node.head.text, ...node.templateSpans.map((sp) => sp.literal.text));
    // (a step's id, "up2", is a name, not a figure)
    for (const t of texts) if (/\d/.test(t) && !PATH_STEP_BY_ID.has(t)) written.push(`${where}: "${t}"`);
    ts.forEachChild(node, (n) => read(n, where));
  };
  let fields = 0, helpers = 0;
  let inSteps = false;
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'PATH_STEPS') {
      inSteps = true;
      ts.forEachChild(node, visit);
      inSteps = false;
      return;
    }
    if (inSteps && ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && (node.name.text === 'how' || node.name.text === 'why')) {
      fields++;
      read(node.initializer, `${node.name.text} ${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
    }
    const name = ts.isFunctionDeclaration(node) ? node.name?.text
      : ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isArrowFunction(node.initializer) ? node.name.text : undefined;
    if (name && HELPERS.has(name)) {
      helpers++;
      read(node, name);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  check(`the source: ${fields} how and why fields, ${helpers} helpers, no figure written into their text`,
    fields === PATH_STEPS.length * 2 && helpers === HELPERS.size && written.length === 0, written.join('; ') || `${fields} ${helpers}`);
}

// The numbers each names, the rules' own, and the step it names the one that takes it.
{
  const g = Game.create(5152);
  const step = (id: string): string => `step ${stepNumber(PATH_STEP_BY_ID.get(id)!)}`;
  const how = (id: string): string => PATH_STEP_BY_ID.get(id)!.how(g).join(' | ');
  const why = (id: string): string => PATH_STEP_BY_ID.get(id)!.why(g).join(' | ');
  const skill = (id: string): string => SKILL_BY_ID.get(id)!.name;
  const cut = ACTION_BY_ID.get('cut_down')!;
  // The trees your woodcutting fells (`skillgates.ts`): "a birch or pine" at 1.
  const fells = listedOr(SKILL_GATES.filter((x) => x.kind === 'tree' && x.level <= g.skills.get(x.skill)).map((x) => x.name.toLowerCase()));
  check('a job: where, its menu label, its tool and whether carried, its skill',
    how('tree') === `Right-click: a ${fells} · ${cut.label} · ${itemDef(cut.tool!).name} (${g.inventory.count(cut.tool!) > 0 ? 'pack' : 'not carried'}) · ${skill(cut.skill!)}`, how('tree'));
  const shafts = RECIPE_BY_ID.get('make_shafts')!;
  check('a recipe: Crafting, its label, its bill and what it makes, its tool, its skill',
    how('shafts').startsWith(`Crafting (R): ${shafts.label} · ${itemDef('log').name} ×${shafts.inputs[0].count ?? 1} → ${itemDef('shaft').name} ×${shafts.count}`)
    && how('shafts').endsWith(skill(shafts.skill)), how('shafts'));
  const bevere = SPECIES.bevere;
  check('a tame step: where its kind lives, Tame and its taming, its bait',
    how('tame').includes('Within') && how('tame').includes('water') && how('tame').includes(`${ACTION_BY_ID.get('tame')!.label} · ${skill('taming')} ${bevere.tameLevel}`)
    && how('tame').includes('Bait: '), how('tame'));
  const logs = 2 * (PATH_BUILD + PATH_BUILD) * (layingBill('log', 'solid').total.log ?? 0);
  check(`its why: the logs the walls take, ${logs}, and the walls' step`, why('tame').includes(`×${logs} for log walls (${step('walls')})`), why('tame'));
  const brick = RECIPE_BY_ID.get('make_stone_brick')!;
  const shards = Math.ceil(SMELTER_BRICKS() / (brick.count ?? 1)) * (brick.inputs[0].count ?? 1);
  check(`the Chiptail's: the shards the smelter's bricks take, ${shards}`, why('chiptail').includes(`×${shards} for stone bricks (${step('bricks')})`), why('chiptail'));
  check(`the bricks' and the mortar's: the smelter's bill, ${SMELTER_BRICKS()} and ${SMELTER_MORTAR()}`,
    why('bricks').includes(`×${SMELTER_BRICKS()} (${step('smelter')})`) && why('mortar').includes(`×${SMELTER_MORTAR()} (${step('smelter')})`), `${why('bricks')} ${why('mortar')}`);
  check(`the smelter's: needed for level 3, and the anvil's lumps, ${ANVIL_LUMPS}`,
    why('smelter').includes(DEED_UPGRADES[3][0].label) && why('smelter').includes(`×${ANVIL_LUMPS} (${step('anvil')})`), why('smelter'));
  for (const lv of [2, 3, 4, 5]) {
    check(`upgrade to ${lv}: its border and workers; how: what it needs, each marked`,
      why(`up${lv}`).startsWith(`Upgrade → ${lv}: border ${deedRadiusAt(lv)}, workers ${deedWorkersAt(lv)}`)
      && DEED_UPGRADES[lv].every((r) => how(`up${lv}`).includes(`${r.label} ${UNMET_MARK}`)), `${how(`up${lv}`)} / ${why(`up${lv}`)}`);
  }
  check(`Track: the arrow's seconds, ${TRACK_SHOW}`, why('track').includes(`${TRACK_SHOW} s`), why('track'));
  check('the crate and the campfire: what level 2 asks', why('crate').includes(DEED_UPGRADES[2][0].label) && why('campfire').includes(DEED_UPGRADES[2][1].label));
}

// The pictures: a clip of its own, an emote there is, or the walk; a tame step's kind beside it.
{
  const off = PATH_STEPS.filter((s) => {
    const sh = s.show;
    if (sh.job) return !ACTION_BY_ID.has(sh.job) || workClipOf(sh.job) === PLACEHOLDER;
    if (sh.emote) return !EMOTE_BY_ID.has(sh.emote);
    return !sh.walk;
  });
  check('every step\'s picture plays a clip of its own, an emote or the walk', off.length === 0, off.map((s) => s.id).join(' '));
  const kinds = PATH_STEPS.filter((s) => s.tame && s.show.job === 'tame' && s.show.kind !== s.tame);
  check('every tame step\'s picture has its kind beside it', kinds.length === 0 && PATH_STEPS.filter((s) => s.show.kind).length >= 5, kinds.map((s) => s.id).join(' '));
}

/* ---- when a card goes up ------------------------------------------------------------------------------------------- */

/** A game whose steps are met as the set says, the Path on or off, and the cards it would put up. */
function rig(on: boolean): { g: Game; met: Set<string>; cards: string[][] } {
  const g = Game.create(5153);
  const met = new Set<string>();
  for (const s of [...PATH_STEPS, ...PATH_DETOURS]) (s as { met: (x: Game) => boolean }).met = (x) => x === g ? met.has(s.id) : false;
  g.thePath = { on, skip: [], supply: {}, did: {} };
  const cards: string[][] = [];
  watchPathCards(g, (done) => cards.push(done));
  return { g, met, cards };
}
const look = (g: Game): void => {
  g.time += 1;
  pathCheck(g);
};
{
  const { g, met, cards } = rig(true);
  met.add('cheese');
  met.add('forage');
  look(g);
  check('a page opened with the Path on: its first look puts no card up, whatever it ticks', cards.length === 0 && g.pathDone.has('forage'), JSON.stringify(cards));
  met.add('track');
  look(g);
  const said = pathCardSays(g, cards[0] ?? []);
  check('a tick: one card naming the step, and the next step', cards.length === 1 && cards[0].join() === 'track'
    && said.done[0] === `Track ${SPECIES.bevere.name}`
    && said.next?.id === 'tame' && said.next.line.startsWith(`${stepNumber(PATH_STEP_BY_ID.get('tame')!)}/${PATH_STEPS.length}`), JSON.stringify(said));
  look(g);
  check('a look that ticks nothing: no card', cards.length === 1);
  for (const id of ['tame', 'around', 'tree', 'snufflet']) met.add(id);
  look(g);
  check('several at once: one card naming them all, a detour among them', cards.length === 2 && cards[1].join() === 'tame,around,tree,snufflet', JSON.stringify(cards));
  check('and the next step after them', pathCardSays(g, cards[1]).next?.id === currentStep(g)?.id && currentStep(g)?.id === 'shafts', currentStep(g)?.id);
}
{
  const { g, met, cards } = rig(false);
  for (const s of PATH_STEPS.slice(0, 20)) met.add(s.id);
  look(g);
  check('off: no card', cards.length === 0);
  g.thePath = { ...g.thePath!, on: true };
  g.events.emit('pathTurned', true);
  look(g);
  check('turned on mid-game: one card, the next step alone, no list of what was met before',
    cards.length === 1 && cards[0].length === 0 && pathCardSays(g, cards[0]).next?.id === PATH_STEPS[20].id && g.pathDone.size >= 20, JSON.stringify(cards));
  look(g);
  look(g);
  check('and nothing more until a step ticks', cards.length === 1);
  met.add(PATH_STEPS[20].id);
  look(g);
  check('then a card for that one', cards.length === 2 && cards[1].join() === PATH_STEPS[20].id, JSON.stringify(cards));
  // Off and on again between two looks: the look after the switch is the first, whatever it ticks.
  g.thePath = { ...g.thePath!, on: false };
  g.thePath = { ...g.thePath, on: true };
  met.add(PATH_STEPS[21].id);
  g.events.emit('pathTurned', true);
  look(g);
  check('off and on between two looks: one card with the next step, not a list', cards.length === 3 && cards[2].length === 0, JSON.stringify(cards));
}

/* ---- the card itself, in Chromium -------------------------------------------------------------------------------- */

function browserOptions(): LaunchOptions | null {
  const args = ['--no-sandbox', '--disable-dev-shm-usage'];
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, args };
  const kept = join(process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers', 'chromium');
  if (existsSync(kept)) return { executablePath: kept, args };
  for (const chrome of ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(chrome)) return { executablePath: chrome, args };
  }
  return null;
}

type Api = {
  ready: Promise<void>; meet: (ids: string[]) => void; look: () => CardView; turn: (on: boolean) => Promise<void>; pageOn: () => void;
  view: () => CardView; picture: () => { share: number; sum: number }; frames: () => number; redraws: () => number;
  animations: (on: boolean) => void; popups: (on: boolean) => void; click: (text: string) => CardView; startJob: (id: string, secs: number) => CardView;
  wait: (ms: number) => Promise<void>; stats: () => string; frameAt: (t: number) => void; goLength: () => number; freeze: () => void;
};
/** Frames saved of a go of the picture, with `PATHCARD_SHOTS`. */
const GIF_FRAMES = 36;

const options = browserOptions();
const browser = options ? await chromium.launch(options).catch(() => null) : null;
if (!browser) {
  console.log('pathcard: no Chromium here (set CHROME_PATH); the card is not drawn.');
  if (process.env.PATHCARD_STRICT) check('drawn: Chromium', false);
} else {
  const shots = process.env.PATHCARD_SHOTS;
  if (shots) mkdirSync(shots, { recursive: true });
  try {
    const bundled = await build({
      entryPoints: [resolve('supabase/test/pathcard-page.ts')],
      bundle: true, format: 'iife', write: false, logLevel: 'error',
      loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
      define: { 'import.meta.env': '{}' },
    });
    const tab = await (await browser.newContext({ viewport: { width: 1100, height: 640 }, deviceScaleFactor: 2 })).newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
    await tab.addStyleTag({ content: `${readFileSync('src/style.css', 'utf8')}\nbody { margin: 0; background: #5d7a45; } #ui { position: relative; width: 100vw; height: 100vh; }` });
    await tab.addScriptTag({ content: bundled.outputFiles[0].text });
    const call = <T>(f: string, ...args: unknown[]): Promise<T> =>
      tab.evaluate(([f, args]) => {
        const api = (window as unknown as { pathcard: Record<string, (...a: unknown[]) => unknown> }).pathcard;
        return api[f as string](...(args as unknown[]));
      }, [f, args]) as Promise<T>;
    await tab.evaluate(() => (window as unknown as { pathcard: Api }).pathcard.ready);
    const shot = async (name: string): Promise<void> => {
      if (shots) await tab.locator('.path-card').screenshot({ path: join(shots, name) });
    };
    /** The card with its picture playing: a go of the job, `GIF_FRAMES` pictures of the card, each frame drawn in turn. */
    const play = async (name: string): Promise<void> => {
      if (!shots) return;
      await call('freeze');
      const len = await call<number>('goLength');
      for (let i = 0; i < GIF_FRAMES; i++) {
        await call('frameAt', (i / GIF_FRAMES) * len);
        await tab.locator('.path-card').screenshot({ path: join(shots, `${name}-${String(i).padStart(3, '0')}.png`) });
      }
    };

    // Opened with the Path on: nothing; a step ticked: the card.
    await call('pageOn');
    await call('meet', ['cheese', 'forage']);
    const first = await call<CardView>('look');
    check('drawn: a page opened with the Path on, no card on its first look', !first.open && first.shown === 0, JSON.stringify(first));
    await call('meet', ['track']);
    const v = await call<CardView>('look');
    check('drawn: a tick puts the card up: Done, Next, How, Why',
      v.open && v.done.startsWith('Done: ') && v.done.includes('Track') && v.next.startsWith(`Next ${stepNumber(PATH_STEP_BY_ID.get('tame')!)}/`)
      && v.how[0]?.startsWith('How: ') && v.why[0]?.startsWith('Why: '), JSON.stringify(v));
    check('drawn: Close, Skip next, the Path tab', v.buttons.join('|') === 'Close|Skip next|Path tab (End)', v.buttons.join('|'));
    // (on this machine's software GL a frame of a body this size costs over a tenth of a second, so the next waits for it)
    await call('wait', 1500);
    const p1 = await call<{ share: number; sum: number }>('picture');
    await call('wait', 3000);
    const p2 = await call<{ share: number; sum: number }>('picture');
    check('drawn: the picture, you and the kind beside you, moving', p1.share > 0.08 && p1.sum !== p2.sum, `${p1.share.toFixed(3)} ${p1.sum} ${p2.sum}; ${await call<string>('stats')}`);
    await shot('tame-step.png');
    await play('tame');
    // A job: inside the hold, the card stays; after it, down.
    const kept = await call<CardView>('startJob', 'forage', 1);
    const gone = await call<CardView>('startJob', 'cut_down', PATH_CARD_HOLD);
    check(`drawn: a job started inside ${PATH_CARD_HOLD} s leaves it up, another after takes it down`, kept.open && !gone.open);

    // A craft step, then an upgrade step: everything before met at once.
    await call('meet', ['tame', 'around', 'tree']);
    const craft = await call<CardView>('look');
    check('drawn: several at once, one card naming them all, then the craft step', craft.open && craft.done.split(' · ').length >= 3 && craft.next.includes('Shafts'), JSON.stringify(craft));
    await call('wait', 1200);
    await shot('craft-step.png');
    await play('craft');
    await call('meet', PATH_STEPS.slice(0, PATH_STEPS.findIndex((s) => s.id === 'up2')).map((s) => s.id));
    const up = await call<CardView>('look');
    check('drawn: an upgrade step, what it needs and what it gives', up.next.includes('Upgrade → 2') && up.how.some((l) => l.includes(DEED_UPGRADES[2][0].label)), JSON.stringify(up));
    await call('wait', 1200);
    await shot('upgrade-step.png');

    // Skip next: the step after named; the Path tab opens the tab and closes the card.
    const skipped = await call<CardView>('click', 'Skip next');
    await call('wait', 50);
    const after = await call<CardView>('view');
    check('drawn: Skip next, the step after it next', skipped.open && after.next.includes(`${stepNumber(PATH_STEP_BY_ID.get('clay')!)}/`), after.next);
    const tabbed = await call<CardView>('click', `Path tab (End)`);
    check('drawn: the Path tab button opens the tab and takes the card down', !tabbed.open && tabbed.tabOpened === 1);

    // Animations off: one still frame, then nothing.
    await call('animations', false);
    await call('meet', ['clay']);
    await call<CardView>('look');
    await call('wait', 4000);
    const r1 = await call<number>('frames');
    await call('wait', 4000);
    const r2 = await call<number>('frames');
    const still = await call<{ share: number; sum: number }>('picture');
    check('drawn: Animations Off, a still frame and no more drawing', r1 === r2 && still.share > 0.03, `${r1} → ${r2}, ${still.share.toFixed(3)}`);
    await call('animations', true);
    await call('click', 'Close');

    // Turned on mid-game: one card, the next step.
    await call('turn', false);
    await call('look');
    await call('meet', PATH_STEPS.slice(0, 24).map((s) => s.id));
    const before = (await call<CardView>('view')).shown;
    await call('turn', true);
    const on = await call<CardView>('look');
    await call('look');
    const later = await call<CardView>('view');
    check('drawn: turned on mid-game, one card with the next step and no Done',
      on.open && on.shown === before + 1 && on.done === 'Path' && later.shown === before + 1, JSON.stringify(on));
    await shot('turned-on.png');
    await call('click', 'Close');

    // Path pop-ups Off: none.
    await call('popups', false);
    await call('meet', [PATH_STEPS[24].id]);
    const none = await call<CardView>('look');
    check('drawn: Path pop-ups Off puts none up', !none.open && none.shown === later.shown, JSON.stringify(none));
    check('drawn: nothing thrown', thrown.length === 0, thrown.join('; '));
    if (shots) writeFileSync(join(shots, 'README.txt'), 'tame-step.png, craft-step.png, upgrade-step.png, turned-on.png; tame-*.png, craft-*.png: the card with its picture playing.\n');
  } finally {
    await browser.close();
  }
}

finish('the Path card');
