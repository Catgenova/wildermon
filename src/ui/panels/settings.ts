import { AUTO_EAT_AT } from '../../game/autoeat';
import { HEAL_FED } from '../../game/body';
import { ROT_LOOK, ROT_SOON } from '../../game/rot';
import { DAMAGE_MAX, DAMAGE_WARN, NIGHT_ENDS, NIGHT_STARTS, type Game } from '../../game/game';
import { applyLook, islandTime, LOCAL_NIGHT_ENDS, LOCAL_NIGHT_STARTS } from '../theme';
import { BINDS, BIND_GROUPS, keyName, keyReserved, MAX_KEYS, type Keybinds } from '../../game/keybinds';
import { whoAmI } from '../../net/accounts';
import { RARITIES } from '../../game/items';
import { CRAFT_REACH } from '../../game/recipes';
import { FIGHT_BACK_STILL, FIGHT_QUIET } from '../../game/fight';
import { LAYOUT_SLOTS, type UIWindow, type WindowManager } from '../windows';
import { setUiSize, UI_SIZE_MAX, UI_SIZE_MIN, uiSizeShown } from '../screen';
import { FAST_DPR, FRAME_CAPS, FULL_DPR, type UiColours, type UiFrames, type UiLight, type UiStyle } from '../../game/settings';
import { FRAME_REACH, FRAME_REACHES, FRAME_RIM, FRAMES, frameLabel, frameOddities, RIM, RIMS } from '../runecut-art';
import { lifeWords } from '../runecut-life';
import { LAYERS, TIMING_WINDOW, TRIAL_SECONDS } from '../../render/timings';
import { listed, numberWord, percent } from '../../game/words';
import { DONE_AFTER, NOTICE_MS } from '../notices';
import { RING_FADE_MS } from '../pointerring';
import { BANNER_AGAIN, BANNER_DEPTH, BANNER_MS, LEAVING_MS } from '../deedbanner';
import { RING_REACH, THREAT_SHADE, THREAT_SHADE_HUNTING } from '../../render/renderer';
import { FIRE_CAPACITY, fireBurnsFor, type PlacedCampfire } from '../../game/campfire';
import { keepControlKeys } from '../controlkeys';

interface Toggle {
  input: HTMLInputElement;
  read: () => boolean;
}

/**
 * Two tabs: what the island looks like, and what the keys do.
 *
 * The keys half is the only part of the UI that has to *stop* being the game
 * for a moment — while it is listening for a key, every press belongs to it and
 * none of them reach `main`. `grabbing` is that moment, and `grab()` is how the
 * key handler asks whether this press is one of the game's or not.
 */
export class SettingsPanel {
  private toggles: Toggle[] = [];
  private tabs = new Map<string, HTMLButtonElement>();
  private pages = new Map<string, HTMLDivElement>();
  private tab = 'display';
  /** The slot waiting for a key, and the button showing that it is waiting. */
  private grabbing: { id: string; slot: number; btn: HTMLButtonElement } | null = null;
  private note: HTMLParagraphElement;
  private keyRows = new Map<string, HTMLButtonElement[]>();
  /** Rows for a keeper of the island alone, hidden until the island says this body is one. */
  private keeperRows: HTMLDivElement[] = [];
  /** The window layouts' rows: the name, Use, and the key that does the same. */
  private layoutRows: Array<{ name: HTMLInputElement; use: HTMLButtonElement; key: HTMLElement }> = [];
  /** The see-through switches, one a window that can be made see-through. */
  private seeRows: Array<{ input: HTMLInputElement; win: UIWindow }> = [];

  constructor(
    win: UIWindow,
    game: Game,
    private readonly keys: Keybinds,
    openLook: (() => void) | null,
    private readonly windows: WindowManager,
  ) {
    win.body.classList.add('settings-body');
    // A slot waiting for a key takes Tab, Enter and Space as keys to bind.
    keepControlKeys(win.body, 'button, select, summary, input[type="checkbox"]', () => this.grabbing !== null);
    const bar = document.createElement('div');
    bar.className = 'log-tabs';
    for (const [id, label, title] of [
      ['display', 'Display', 'What the island looks like'],
      ['windows', 'Windows', 'Window layouts, and windows you can see through'],
      ['keys', 'Keys', 'What every key does'],
    ] as Array<[string, string, string]>) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tb-btn tb-small log-tab' + (id === this.tab ? ' tb-on' : '');
      b.textContent = label;
      b.title = title;
      b.addEventListener('click', () => this.show(id));
      this.tabs.set(id, b);
      bar.append(b);
    }
    win.body.append(bar);

    const display = document.createElement('div');
    display.className = 'settings-page';
    const keyPage = document.createElement('div');
    keyPage.className = 'settings-page keys-page';
    keyPage.hidden = true;
    const winPage = document.createElement('div');
    winPage.className = 'settings-page';
    winPage.hidden = true;
    this.pages.set('display', display);
    this.pages.set('windows', winPage);
    this.pages.set('keys', keyPage);
    win.body.append(display, winPage, keyPage);
    this.buildWindows(winPage);

    const add = (label: string, hint: string, read: () => boolean, write: (v: boolean) => void): void => {
      const row = document.createElement('label');
      row.className = 'setting-row';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = read();
      input.addEventListener('change', () => write(input.checked));
      const text = document.createElement('span');
      text.innerHTML = `<b>${label}</b><small>${hint}</small>`;
      row.append(input, text);
      display.append(row);
      this.toggles.push({ input, read });
    };
    /** A heading over the run of rows after it on the Display tab. */
    const head = (text: string): void => {
      const h = document.createElement('h4');
      h.className = 'keys-group';
      h.textContent = text;
      display.append(h);
    };
    head('Sound');
    /**
     * The one setting here that is not a yes or a no.
     *
     * It sits at the top because it is the one somebody reaches for in a
     * hurry — the island has only just learned to make a noise at all, and
     * the first thing anybody wants from a game that has started making one
     * is the means to stop it.
     */
    {
      const row = document.createElement('label');
      row.className = 'setting-row setting-pick';
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = '100';
      input.step = '5';
      input.value = String(Math.round(game.settings.volume * 100));
      const text = document.createElement('span');
      const say = (): void => {
        const pc = Math.round(game.settings.volume * 100);
        text.innerHTML = `<b>Volume &mdash; ${pc === 0 ? 'silent' : `${pc}%`}</b><small>How loud footfalls, tools and blows are. Each one comes from its side of the screen, quieter the farther it is from the middle.</small>`;
      };
      say();
      input.addEventListener('input', () => {
        game.settings.volume = Number(input.value) / 100;
        say();
      });
      row.append(input, text);
      display.append(row);
    }
    /*
     * How big the interface is drawn: "Text and window size. There's no
     * setting for it, and that matters on a phone."
     *
     * Put on when the slider is let go rather than while it moves, because
     * this window is part of what it scales: resized under the pointer, the
     * slider would slide out from under the drag that is setting it. The
     * number in the caption follows the drag, so you can see where you are.
     */
    head('Interface');
    {
      const row = document.createElement('label');
      row.className = 'setting-row setting-pick';
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(Math.round(UI_SIZE_MIN * 100));
      input.max = String(Math.round(UI_SIZE_MAX * 100));
      input.step = '10';
      input.value = String(Math.round(game.settings.uiSize * 100));
      const text = document.createElement('span');
      const say = (): void => {
        const asked = Number(input.value);
        const put = Math.round(game.settings.uiSize * 100);
        const shown = Math.round(uiSizeShown() * 100);
        // Only once it has been put on, and only if the screen held it back.
        const held = asked === put && shown < put ? ` This screen has room for ${shown}%.` : '';
        text.innerHTML = `<b>Text and window size &mdash; ${asked}%</b><small>Every window, menu and bar, and the writing in them, at ${asked}% of their size on this screen. The island itself is not scaled: zoom that with the mouse wheel or a pinch.${held}</small>`;
      };
      say();
      input.addEventListener('input', say);
      input.addEventListener('change', () => {
        game.settings.uiSize = Number(input.value) / 100;
        setUiSize(game.settings.uiSize);
        say();
      });
      row.append(input, text);
      display.append(row);
    }
    /*
     * How hard the screen is worked: a choice of two rather than a yes or no,
     * so a list rather than a tick box. Every figure in the words comes from
     * the setting itself.
     */
    const choose = <T extends string | number>(label: string, hint: string, options: Array<[T, string]>, read: () => T, write: (v: T) => void): void => {
      const row = document.createElement('label');
      row.className = 'setting-row setting-pick';
      const select = document.createElement('select');
      for (const [value, name] of options) {
        const o = document.createElement('option');
        o.value = String(value);
        o.textContent = name;
        select.append(o);
      }
      select.value = String(read());
      select.addEventListener('change', () => write(options.find(([v]) => String(v) === select.value)![0]));
      const text = document.createElement('span');
      text.innerHTML = `<b>${label}</b><small>${hint}</small>`;
      row.append(select, text);
      display.append(row);
    };
    /*
     * The interface's look, and Runecut's light. Both take effect at once:
     * they are two attributes on the page (`src/ui/theme.ts`).
     */
    const relook = (): void => applyLook(game.settings, game.isNight());
    choose<UiStyle>(
      'Interface look',
      'Runecut draws every window, menu, tooltip and bar as pale carved stone with dark writing, with the window\'s rune at the head of its title, '
        + 'in Alegreya Sans at 14 pixels. Classic draws them dark with pale writing in the system font at 13 pixels, as before Runecut.',
      [['runecut', 'Runecut'], ['classic', 'Classic']],
      () => game.settings.uiStyle,
      (v) => {
        game.settings.uiStyle = v;
        relook();
      },
    );
    choose<UiLight>(
      'Runecut light',
      'Day is pale stone with dark writing. Night is dark stone with pale writing, and the rune of the window in front glows. '
        + `Island clock: Night from ${islandTime(NIGHT_STARTS)} to ${islandTime(NIGHT_ENDS)} island time, Day the rest of the island's day. `
        + `My computer's clock: Night from ${islandTime(LOCAL_NIGHT_STARTS)} to ${islandTime(LOCAL_NIGHT_ENDS)} by this computer's clock, Day the rest. `
        + 'Always day and Always night never change. The life on the frames keeps the same night. No effect in Classic.',
      [['clock', 'Island clock'], ['local', "My computer's clock"], ['day', 'Always day'], ['night', 'Always night']],
      () => game.settings.uiLight,
      (v) => {
        game.settings.uiLight = v;
        relook();
      },
    );
    // The colours that carry a meaning (`data-cb` in src/style.css); every place also has a mark that is not a colour, whichever is chosen.
    choose<UiColours>(
      'Colours',
      'Changes only the colours that mean something, in Runecut, in Classic and on the island. '
        + 'Red-green safe, for deuteranopia and protanopia: good is blue instead of green, bad vermilion instead of red, a warning yellow. '
        + 'Blue-yellow safe, for tritanopia: good is teal, bad crimson, a warning amber. '
        + 'Whichever you choose, each of these also has a mark that is not a colour.'
        + '<details class="setting-more"><summary>Where, and the mark each has</summary><ul>'
        + '<li>Better and worse on a compare card: ▲ and ▼ before the difference.</li>'
        + '<li>A wildermon\'s trait figures: ▲ a gain, ▼ a loss.</li>'
        + '<li>Crafting: ✓ before what you have, ✗ before what you lack.</li>'
        + '<li>The target panel: Easy, Even or Hard before the blows each way, and ⚠︎ when it draws back for a heavy blow.</li>'
        + '<li>What is on you, on the status panel: what helps in a round mark on the left, what harms (a wound, a load) in a square one on the right.</li>'
        + '<li>Overloaded: ⚠︎ on the pack\'s weight line, and its load bar striped past the mark and cross-hatched past the end.</li>'
        + '<li>Leave, disband and the other buttons that cannot be undone: a striped foot.</li>'
        + '<li>The four bars, each named: red-green safe, Health vermilion, Stamina yellow, Food purple, Water blue; '
        + 'blue-yellow safe, Health crimson, Stamina amber, Food green, Water dark blue.</li>'
        + '<li>On the island: the health bar over a beast (also its length), the ring and ! of a heavy blow coming, '
        + 'the arrows at the edge of the view for what is after you (also their shape), the edge of the view when you are struck, '
        + 'and the health you lose (also its −).</li>'
        + '</ul></details>',
      [['standard', 'Standard'], ['rg', 'Red–green safe'], ['by', 'Blue–yellow safe']],
      () => game.settings.uiColours,
      (v) => {
        game.settings.uiColours = v;
        relook();
      },
    );
    {
      const framed = FRAMES.reduce((n, f) => n + f.for.length, 0);
      const of = (id: string): string => frameLabel(id).toLowerCase();
      choose<UiFrames>(
        'Window frames',
        `Runecut only. Themed: the border is drawn as the stuff of what the window holds, in ${FRAMES.length} kinds over ${framed} windows and bars: `
          + `the pack in a ${of('inventory')}, a crate or the stores in a ${of('crate')}, crafting on a ${of('craft')}, events on a ${of('events')}, the map on ${of('map')} with a compass rose. `
          + 'Any other window has plain stone. Stone: every border is the plain stone rim. The room inside a window is the same either way.'
          + '<details class="setting-more"><summary>Border widths, and what stands past them</summary>'
          + `The border round each window is ${RIM} pixels wide (${frameOddities(FRAME_RIM)} when themed; ${RIMS.phone} on a phone, ${RIMS.hud} on the status panel, ${RIMS.toolbar} on the toolbar). `
          + `A knob, knot or seal stands up to ${FRAME_REACH} pixels past the window's edge (${frameOddities(FRAME_REACHES)}), and clicks go through it.</details>`,
        [['themed', 'Themed'], ['stone', 'Stone']],
        () => game.settings.uiFrames,
        (v) => {
          game.settings.uiFrames = v;
          relook();
        },
      );
    }
    add(
      'Frame life',
      'Small animals and lights on the window frames. They keep to the frame and what stands past it, never over what is inside a window, and take no clicks. '
        + 'Runecut with themed frames only; not on a phone\'s screen, with Fast graphics, or when your system asks for less motion.'
        + `<details class="setting-more"><summary>What lives on which frame</summary><ul>${lifeWords().split('; ').map((w) => `<li>${w}</li>`).join('')}</ul></details>`,
      () => game.settings.uiLife,
      (v) => (game.settings.uiLife = v),
    );
    // The job in hand at the pointer (src/ui/pointerring.ts), and a settlement's name at its border (src/ui/deedbanner.ts).
    add(
      'Progress ring at the pointer',
      'A ring round the mouse pointer fills clockwise from the top as the job in hand goes, reading what the action bar reads; '
        + `in a fight it fills once for every swing or draw. Drawn full and faded over ${RING_FADE_MS / 1000} seconds when the job ends. `
        + 'Only while the pointer is over the island: not over a window, a bar or a menu, and not on a touch screen.',
      () => game.settings.pointerRing,
      (v) => (game.settings.pointerRing = v),
    );
    add(
      'Settlement names at the border',
      `A settlement's name near the top of the screen for ${BANNER_MS / 1000} seconds once you are ${numberWord(BANNER_DEPTH)} tile${BANNER_DEPTH === 1 ? '' : 's'} inside its border, `
        + "with your rank under it where you are a citizen and its founder's name where you are not; "
        + `and "Leaving" with its name for ${LEAVING_MS / 1000} seconds once you are ${numberWord(BANNER_DEPTH)} tile${BANNER_DEPTH === 1 ? '' : 's'} outside. `
        + `Walking back in within ${BANNER_AGAIN} seconds of leaving shows nothing.`,
      () => game.settings.deedBanner,
      (v) => (game.settings.deedBanner = v),
    );
    head('Performance');
    choose<'full' | 'fast'>(
      'Graphics',
      `Fast draws ${FAST_DPR} pixel for each screen pixel on a high-density screen instead of up to ${FULL_DPR}, `
        + `which is ${Math.round((1 - (FAST_DPR / FULL_DPR) ** 2) * 100)}% fewer pixels on a ${FULL_DPR}× screen, and leaves out the swell on the sea, `
        + 'the haze over distant country, the butterflies, dragonflies, fireflies, petals and falling leaves, and the life on the window frames.',
      [['full', 'Full'], ['fast', 'Fast']],
      () => game.settings.graphics,
      (v) => {
        game.settings.graphics = v;
        game.graphicsChanged?.();
      },
    );
    choose<number>(
      'Frame rate limit',
      `Draws at most this many frames a second. With no limit a screen that refreshes faster than ${FRAME_CAPS[1]} times a second is `
        + 'drawn for every refresh, which costs more and looks the same.',
      FRAME_CAPS.map((n): [number, string] => [n, n === 0 ? 'No limit' : `${n} a second`]),
      () => game.settings.frameCap,
      (v) => (game.settings.frameCap = v),
    );
    add(
      'Show drawing times',
      `Under the frame rate: how long each frame takes, and how many milliseconds of it go on drawing the ground, ${listed(Object.keys(LAYERS))}, `
        + `averaged over ${TIMING_WINDOW * 1000} milliseconds. A frame much longer than its drawing is waiting on the graphics chip.`,
      () => game.settings.timings,
      (v) => (game.settings.timings = v),
    );
    {
      const row = document.createElement('div');
      row.className = 'setting-row setting-look';
      const text = document.createElement('span');
      text.innerHTML = `<b>Measure each layer</b><small>Leaves each of ${listed(Object.keys(LAYERS))} out of the picture for ${numberWord(TRIAL_SECONDS)} second in turn, `
        + `${numberWord((Object.keys(LAYERS).length + 2) * TRIAL_SECONDS)} seconds in all, and writes under the frame rate how many frames a second come without it. `
        + 'Close this window first so it is your view being measured.</small>';
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'tb-btn tb-small';
      go.textContent = 'Measure';
      go.addEventListener('click', () => game.measureDrawing?.());
      row.append(text, go);
      display.append(row);
    }
    head('The island view');
    add('Show tile grid', 'Outline every tile. Also toggled with G.', () => game.settings.grid, (v) => (game.settings.grid = v));
    add(
      'Show the first-steps card',
      'A card over the action bar saying what to do next, while the first chapter of the journal is unfinished. It stands down on its own once the stake is in the ground; untick to put it away now.',
      () => game.settings.guide,
      (v) => (game.settings.guide = v),
    );
    add(
      'Cut away walls facing you',
      'Take away the walls standing between you and the inside of a building. Also toggled with X, or the ◪ button beside the storey arrows.',
      () => game.settings.cutaway,
      (v) => (game.settings.cutaway = v),
    );
    add(
      'Fog of war',
      'Hide the land nobody has laid eyes on, and show ground that is out of sight as it was when you last saw it. Turning it off shows the whole island and simulates every creature at once.',
      () => game.settings.fog,
      (v) => {
        game.settings.fog = v;
        game.vision.invalidate();
      },
    );
    add(
      'Open the tile window on a click',
      'Clicking a tile shows everything you could do to it in the Tile window (T). Untick to keep to the right-click menu.',
      () => game.settings.tileWindow,
      (v) => (game.settings.tileWindow = v),
    );
    add(
      'Keep the camera on you',
      'The view follows you about. Pushing it away with the keys, or dragging it, turns this off for the moment; C, or the Centre button, takes it back. Untick to leave the camera wherever it was put.',
      () => game.settings.follow,
      (v) => (game.settings.follow = v),
    );
    add(
      'Push the view at the screen edge',
      'Resting the cursor against the edge of the screen slides the view that way, the harder the closer to the edge. Untick if you would rather only drag.',
      () => game.settings.edgePan,
      (v) => (game.settings.edgePan = v),
    );
    add(
      'Always show deed border',
      'Draw the green boundary of your settlement at all times. Otherwise it only shows while pointing at the token.',
      () => game.settings.deedBorder,
      (v) => (game.settings.deedBorder = v),
    );
    add('Mark hostile creatures',
      `Every wild creature of a kind that hunts on sight, and any creature hunting you, is laid over in red on top of the trees and buildings in front of it, at ${percent(THREAT_SHADE)} strength or ${percent(THREAT_SHADE_HUNTING)} while it is hunting you, with a red marker over its head that pulses while it is hunting you.`,
      () => game.settings.markThreats, (v) => (game.settings.markThreats = v));
    add('Rings over fires, smelters and kilns', `Over each one within ${RING_REACH} tiles: an outer ring of its fuel, full at ${fireBurnsFor({ fuel: FIRE_CAPACITY } as PlacedCampfire)} of burning, orange while it burns and grey while it is cold; an inner ring of how far the piece at the front of it has come; and a gold dot when something is finished and waiting to be taken out.`,
      () => game.settings.stationRings, (v) => (game.settings.stationRings = v));

    /*
     * What a craft may take. "A toggle in settings for allowing or
     * disallowing crafting from nearby containers", and "another setting that
     * disallows the automatic use of any rare material in crafting". Both
     * reach the island as well (`craftPrefsChanged`), which is where a job's
     * stock is spent.
     */
    head('Crafting');
    const rareNames = RARITIES.slice(1).map((r) => r.name);
    const rareWords = `${rareNames.slice(0, -1).join(', ')} or ${rareNames[rareNames.length - 1]}`;
    add(
      'Use stores within reach',
      `A craft, and work at a station that uses something up, takes it from your pack, then the bags on your back, then crates, pieces and vehicles within ${CRAFT_REACH} tiles; building a wall, floor, frame, bridge or aqueduct takes it from your pack, then a crate on the tile, then the same stores. Untick to take it from your pack and bags only (and, building, a crate on the tile).`,
      () => game.settings.fromStores,
      (v) => {
        game.settings.fromStores = v;
        game.craftPrefsChanged?.();
      },
    );
    add(
      'Keep rare materials out of crafting',
      `A craft or a station never picks a ${rareWords} stack by itself. It still uses one you point it at: the stack you right-click to make something, or one you choose off a station's menu.`,
      () => game.settings.spareRare,
      (v) => {
        game.settings.spareRare = v;
        game.craftPrefsChanged?.();
      },
    );

    /*
     * Fighting: whether a bite turns you on what bit you. Kept on the island as
     * well (`fightPrefsChanged`), which is where the bite lands.
     */
    head('Fighting');
    add(
      'Turn on what bites you',
      `When something wild bites you and your feet have been still for ${FIGHT_BACK_STILL} seconds, you swing back at it until it is dead or out of reach, and the job in hand waits at the front of the line. A bite while you walk never turns you round. Untick to fight only what you attack yourself.`,
      () => game.settings.fightBack,
      (v) => {
        game.settings.fightBack = v;
        game.fightPrefsChanged?.();
      },
    );
    add(
      'One line for a whole fight',
      `What each skill comes up by in a fight is held back and said once, ${FIGHT_QUIET} seconds after the last blow, with how long it lasted, what you dealt and what you took, rather than a line after every swing. Untick to see every gain as it comes.`,
      () => game.settings.compactFight,
      (v) => (game.settings.compactFight = v),
    );

    // Notices (src/ui/notices.ts): a line near the top of the screen, gone after a few seconds; the event log says the same either way.
    head('Notices');
    const seconds = Math.round(NOTICE_MS / 1000 * 10) / 10;
    const noticeLead = document.createElement('p');
    noticeLead.className = 'keys-lead';
    noticeLead.textContent = `Each is a line at the top of the screen for ${seconds} seconds. The event log says the same whether they are on or off.`;
    display.append(noticeLead);
    add('A skill at a new whole number', `A line for ${seconds} seconds when a skill reaches its next whole number, naming the skill and the number.`,
      () => game.settings.noticeLevel, (v) => (game.settings.noticeLevel = v));
    add('A knack', `A line for ${seconds} seconds when a go leaves a knack behind.`,
      () => game.settings.noticeKnack, (v) => (game.settings.noticeKnack = v));
    add('Work done', `A line for ${seconds} seconds when a job and everything queued behind it is finished, after ${DONE_AFTER} seconds or more of work. Not when you stop it yourself.`,
      () => game.settings.noticeDone, (v) => (game.settings.noticeDone = v));
    add('A birth', `A line for ${seconds} seconds when one of your wildermon gives birth.`,
      () => game.settings.noticeBirth, (v) => (game.settings.noticeBirth = v));
    add('Wearing out', `A line for ${seconds} seconds when something you wear or hold reaches ${DAMAGE_WARN}% damage; at ${DAMAGE_MAX}% it breaks.`,
      () => game.settings.noticeWear, (v) => (game.settings.noticeWear = v));
    add('Food about to rot', `A line for ${seconds} seconds when food lying on the ground within ${ROT_LOOK} tiles of you has under ${Math.round(ROT_SOON / 60)} minutes before it rots away. Nothing rots in a pack or a store.`,
      () => game.settings.noticeRot, (v) => (game.settings.noticeRot = v));

    // Eating by itself (src/game/autoeat.ts).
    head('Eating');
    choose<number>(
      'Eat by yourself',
      `When Food falls under this, eat from your pack after the job in hand, until it is back over it. Below ${Math.round(HEAL_FED * 100)}% Food you stop healing. A locked stack, or food in a bag, is never eaten.`,
      AUTO_EAT_AT.map((v) => [v, v ? `Under ${Math.round(v * 100)}% Food` : 'Never']),
      () => game.settings.autoEat,
      (v) => (game.settings.autoEat = v),
    );
    add('Worst food first', 'Eat the lowest quality food first, to use it up, rather than whatever fills the most.',
      () => game.settings.autoEatWorst, (v) => (game.settings.autoEatWorst = v));

    /**
     * Who you are, and the one thing the game can do about it.
     *
     * Setting up an account happens on a page of its own rather than in a
     * window here, so all this can do is point at it — and pointing at it is
     * the whole job, because a landing page nobody can find from the game is a
     * landing page nobody lands on.
     *
     * The line starts out saying you have no account and is corrected once the
     * island keeper answers. That way round on purpose: a browser with no
     * session never asks anybody anything, and a browser that cannot reach the
     * keeper is told the truth about what it can prove, which is nothing.
     */
    head('Account');
    const who = document.createElement('p');
    who.className = 'setting-note';
    display.append(who);
    const door = document.createElement('a');
    door.href = './account.html';
    const sayWho = (line: string, label: string): void => {
      who.textContent = `${line} `;
      door.textContent = label;
      who.append(door);
    };
    sayWho('No account here, so on an island you are whatever name the address bar says.', 'Set one up');
    void whoAmI().then(
      (name) => { if (name) sayWho(`Signed in as ${name}.`, 'Change account'); },
      () => {},
    );
    /*
     * How you look, chosen on the account page as an account is made: this
     * goes back there, to the same creator, on the look you have on. Only on
     * an island, where there is an account to keep it with.
     */
    if (openLook) {
      const row = document.createElement('div');
      row.className = 'setting-row setting-look';
      const text = document.createElement('span');
      text.innerHTML = '<b>How you look</b><small>Leaves the island for the character creator you started in: build, skin, hair, hair colour, eyes, beard, shirt and trousers. <i>Step ashore</i> there wears the new look and brings you back; leaving by <i>On to the island</i> changes nothing.</small>';
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'tb-btn tb-small';
      open.textContent = 'Customize character';
      open.addEventListener('click', openLook);
      row.append(text, open);
      display.append(row);
    }

    // ---- The keys ----
    const lead = document.createElement('p');
    lead.className = 'keys-lead';
    lead.innerHTML =
      '<b>Click a key to set it</b>, then press the one you want: <kbd>Esc</kbd> leaves it as it was, <kbd>Backspace</kbd> leaves it unbound. ' +
      'These keys move the <i>view</i> and open things, and never move you: a left click walks to a tile and a right click asks what can be done to it. ' +
      'The number keys <kbd>1</kbd>–<kbd>0</kbd> are not listed: they always answer to whatever the Tile window or the toolbelt is offering.';
    keyPage.append(lead);

    this.note = document.createElement('p');
    this.note.className = 'keys-note';
    this.note.hidden = true;
    keyPage.append(this.note);

    for (const group of BIND_GROUPS) {
      const rows = BINDS.filter((b) => b.group === group);
      if (!rows.length) continue;
      const h = document.createElement('h4');
      h.className = 'keys-group';
      h.textContent = group;
      keyPage.append(h);
      const table = document.createElement('div');
      table.className = 'keys-table';
      for (const bind of rows) {
        const row = document.createElement('div');
        row.className = 'keys-row';
        const text = document.createElement('span');
        text.className = 'keys-what';
        text.innerHTML = `<b>${bind.label}</b><small>${bind.hint}</small>`;
        const slots = document.createElement('span');
        slots.className = 'keys-slots';
        const btns: HTMLButtonElement[] = [];
        for (let slot = 0; slot < MAX_KEYS; slot++) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'tb-btn tb-small keys-key';
          b.addEventListener('click', () => this.listen(bind.id, slot, b));
          btns.push(b);
          slots.append(b);
        }
        this.keyRows.set(bind.id, btns);
        row.append(text, slots);
        if (bind.keeper) {
          row.hidden = true;
          this.keeperRows.push(row);
        }
        table.append(row);
      }
      keyPage.append(table);
    }

    const foot = document.createElement('div');
    foot.className = 'keys-foot';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'tb-btn tb-small';
    reset.textContent = 'Put the keys back';
    reset.title = 'Every key back to what it was out of the box';
    // Every key you have set goes at once, so it is asked first.
    reset.addEventListener('click', () => {
      this.stopListening();
      void game.hooks.confirm('Put every key back to how it came? Every key you have set is lost.').then((yes) => {
        if (!yes) return;
        this.keys.reset();
        this.say('Back to the keys it came with.');
      });
    });
    foot.append(reset);
    keyPage.append(foot);

    // Who redraws on a rebinding is `UI`'s business: the toolbar has to hear
    // about it too, and this panel is not the only thing that shows a key.
    this.drawKeys();
  }

  /**
   * The Windows tab: the layouts, kept and called back, and which windows are
   * see-through.
   */
  private buildWindows(page: HTMLDivElement): void {
    const intro = document.createElement('p');
    intro.className = 'setting-note';
    intro.innerHTML = '<b>Window layouts</b><small>Each keeps every window&rsquo;s place, size, and whether it is open, expanded or see-through. <b>Keep</b> stores the windows as they are now; <b>Use</b>, or the layout&rsquo;s key, puts them all back. Shift and the key keeps instead of using. A window dragged near the edge of the screen or of another window is put against it; hold Alt while dragging to place it freely.</small>';
    page.append(intro);
    const note = document.createElement('p');
    note.className = 'keys-note';
    note.hidden = true;
    const sayHere = (text: string): void => {
      note.textContent = text;
      note.hidden = false;
    };
    for (let slot = 0; slot < LAYOUT_SLOTS; slot++) {
      const row = document.createElement('div');
      row.className = 'setting-row layout-row';
      const name = document.createElement('input');
      name.type = 'text';
      name.id = `layout-name-${slot + 1}`;
      name.className = 'layout-name';
      name.maxLength = 24;
      name.value = this.windows.layoutName(slot);
      name.title = 'What this layout is called';
      name.addEventListener('keydown', (e) => e.stopPropagation());
      name.addEventListener('change', () => {
        this.windows.renameLayout(slot, name.value);
        this.drawLayouts();
      });
      const keep = document.createElement('button');
      keep.type = 'button';
      keep.className = 'tb-btn tb-small';
      keep.textContent = 'Keep';
      keep.title = 'Store the windows as they are now in this layout';
      keep.addEventListener('click', () => {
        this.windows.saveLayout(slot);
        this.drawLayouts();
        sayHere(`The windows as they are now are kept as “${this.windows.layoutName(slot)}”.`);
      });
      const use = document.createElement('button');
      use.type = 'button';
      use.className = 'tb-btn tb-small';
      use.textContent = 'Use';
      use.addEventListener('click', () => {
        if (this.windows.useLayout(slot)) sayHere(`The windows are where “${this.windows.layoutName(slot)}” keeps them.`);
      });
      const key = document.createElement('kbd');
      row.append(name, keep, use, key);
      page.append(row);
      this.layoutRows.push({ name, use, key });
    }
    page.append(note);
    const seeHead = document.createElement('p');
    seeHead.className = 'setting-note';
    seeHead.innerHTML = '<b>See-through windows</b><small>Dimmed, and every click on them goes to the island underneath; only the title bar still takes hold of one, to move it or make it solid again. Hold Alt to click or scroll in one. The ◐ on its title bar does the same as the box here.</small>';
    page.append(seeHead);
    for (const w of this.windows.windows.values()) {
      if (!w.opts.seeThrough) continue;
      const row = document.createElement('label');
      row.className = 'setting-row';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = `see-${w.opts.id}`;
      input.checked = w.isSeeThrough;
      input.addEventListener('change', () => w.setSeeThrough(input.checked));
      const text = document.createElement('span');
      text.innerHTML = `<b>${w.opts.title}</b>`;
      row.append(input, text);
      page.append(row);
      this.seeRows.push({ input, win: w });
    }
    this.drawLayouts();
  }

  /** The layouts' names, whether each has anything kept, and their keys. */
  drawLayouts(): void {
    this.layoutRows.forEach((r, slot) => {
      if (document.activeElement !== r.name) r.name.value = this.windows.layoutName(slot);
      const kept = this.windows.layoutKept(slot);
      r.use.disabled = !kept;
      r.use.title = kept ? 'Put every window where this layout keeps it' : 'Nothing is kept in this layout yet: arrange the windows and press Keep';
      const k = this.keys.label(`layout_${slot + 1}`);
      r.key.textContent = k;
      r.key.title = k === 'unbound' ? 'No key: set one under Keys' : `${k} uses it; Shift+${k} keeps the windows as they are now`;
    });
  }

  /**
   * Every row on the Display and Windows tabs, by what it is called, for the
   * Find anything box: opening one shows its tab and lights the row up.
   */
  findables(): Array<{ label: string; hint: string; reveal: () => void }> {
    const out: Array<{ label: string; hint: string; reveal: () => void }> = [];
    for (const tab of ['display', 'windows']) {
      const page = this.pages.get(tab);
      if (!page) continue;
      for (const row of page.querySelectorAll<HTMLElement>('.setting-row, .setting-note')) {
        const b = row.querySelector('b');
        const label = (b?.textContent ?? '').replace(/\s+—.*$/, '').trim();
        if (!label) continue;
        out.push({
          label,
          hint: row.querySelector('small')?.textContent ?? '',
          reveal: () => {
            this.show(tab);
            row.scrollIntoView({ block: 'center' });
            row.classList.remove('found-flash');
            void row.offsetWidth;
            row.classList.add('found-flash');
          },
        });
      }
    }
    return out;
  }

  /** The island says this body keeps it: its keys are listed with the rest. */
  showKeeper(): void {
    for (const row of this.keeperRows) row.hidden = false;
  }

  /** Switch tabs. */
  private show(id: string): void {
    if (!this.pages.has(id)) return;
    this.stopListening();
    this.tab = id;
    for (const [key, el] of this.tabs) el.classList.toggle('tb-on', key === id);
    for (const [key, el] of this.pages) el.hidden = key !== id;
  }

  /**
   * Take the next press for this slot.
   *
   * Clicking the slot that is already listening puts it back rather than
   * leaving somebody stuck waiting for a key they did not mean to change.
   */
  private listen(id: string, slot: number, btn: HTMLButtonElement): void {
    if (this.grabbing?.id === id && this.grabbing.slot === slot) {
      this.stopListening();
      return;
    }
    this.stopListening();
    this.grabbing = { id, slot, btn };
    btn.classList.add('keys-listening');
    btn.textContent = 'press…';
    this.say('Press the key you want. Esc to leave it as it was, Backspace to unbind it.');
  }

  private stopListening(): void {
    if (!this.grabbing) return;
    this.grabbing.btn.classList.remove('keys-listening');
    this.grabbing = null;
    this.drawKeys();
  }

  /**
   * A press, while a slot is listening.
   *
   * Answers whether the key was swallowed, which is what keeps `Escape` from
   * cancelling your work and `I` from opening the inventory behind the window
   * you are binding it in.
   */
  grab(code: string): boolean {
    const g = this.grabbing;
    if (!g) return false;
    if (code === 'Escape') {
      this.stopListening();
      this.say('Left as it was.');
      return true;
    }
    if (code === 'Backspace' || code === 'Delete') {
      this.keys.clear(g.id, g.slot);
      this.stopListening();
      this.say('Unbound.');
      return true;
    }
    const reserved = keyReserved(code);
    if (reserved) {
      this.say(reserved);
      return true;
    }
    const took = this.keys.bind(g.id, g.slot, code);
    this.stopListening();
    if (!took.ok) this.say(took.why ?? 'That key will not do.');
    else if (took.took) {
      const from = BINDS.find((b) => b.id === took.took);
      this.say(`${keyName(code)} set. It was ${from ? from.label.toLowerCase() : 'something else'}, which is now unbound.`);
    } else this.say(`${keyName(code)} set.`);
    return true;
  }

  private say(text: string): void {
    this.note.textContent = text;
    this.note.hidden = false;
  }

  /** Put every slot's caption back in step with the table. */
  drawKeys(): void {
    for (const [id, btns] of this.keyRows) {
      const codes = this.keys.codes(id);
      btns.forEach((b, i) => {
        const code = codes[i];
        b.textContent = code ? keyName(code) : '—';
        b.classList.toggle('keys-empty', !code);
        b.title = code ? `${keyName(code)} — click to change` : 'Unbound — click to set a key';
      });
    }
  }

  /** Keep the boxes in step with hotkeys that change the same settings. */
  refresh(): void {
    for (const t of this.toggles) {
      const v = t.read();
      if (t.input.checked !== v) t.input.checked = v;
    }
    for (const r of this.seeRows) if (r.input.checked !== r.win.isSeeThrough) r.input.checked = r.win.isSeeThrough;
  }
}
