// First: out of another site's frame, and the page's Trusted Types policy (src/page-guard.ts).
import './page-guard';
import {
  Unchecked, breachCount, breachWord, createAccount, foldName, writtenName,
  myLook, nameEmail, nameFree, nameTrouble, passwordTrouble, passwordVerdict,
  sentOffLine, setLook, signInAs, signOut, whoAmI,
} from './net/accounts';
import { LOOK_TABLES, cleanLook, randomLook, type Look } from './game/look';
import { Creator } from './ui/creator';
import { CODE_DIGITS, CODE_SECONDS, finishEnrol, myFactor, removeFactor, startEnrol } from './net/mfa';
import { nameRefusal } from './game/playertext';
import { PRIVACY_TITLE, privacyPolicy } from './ui/privacy';
import { RULES_TITLE, gameRules } from './ui/rules';

/**
 * The landing page: a username, a password, and a way back in.
 *
 * It is a page of its own rather than a window inside the game, because the
 * game is a canvas that takes the whole screen and nails the document down to
 * do it, and because this is the one screen somebody might arrive at from a
 * link before they have ever seen an island.
 *
 * It does two jobs with the same two fields. Making an account and coming back
 * to one both ask for a name and a password and nothing else, so putting them
 * on separate pages would be two pages to keep in step for no gain — and a
 * page that could only ever make a *new* account would strand everybody on
 * their second visit, which is not a landing page, it is a trap.
 */

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const card = document.querySelector('.card') as HTMLElement;
const form = $<HTMLFormElement>('form');
const nameBox = $<HTMLInputElement>('name');
const pwBox = $<HTMLInputElement>('pw');
const nameNote = $<HTMLParagraphElement>('name-note');
const pwNote = $<HTMLParagraphElement>('pw-note');
const go = $<HTMLButtonElement>('go');
const said = $<HTMLParagraphElement>('say');
const tabNew = $<HTMLButtonElement>('tab-new');
const tabBack = $<HTMLButtonElement>('tab-back');
const peek = $<HTMLButtonElement>('peek');
const lede = $<HTMLParagraphElement>('lede');
const maker = $<HTMLElement>('maker');
const ashore = $<HTMLButtonElement>('ashore');


/**
 * Whatever island this page was sent here on behalf of, carried through.
 *
 * A link that says "come and join my island, you will need an account" has to
 * survive the account being made, or the first thing a new player does after
 * signing up is go and find the invitation again. Only the island parameters
 * travel — there is no `next=` and no redirect target, so there is nothing
 * here that a crafted link could point somewhere else.
 */
const carried = new URLSearchParams();
for (const key of ['island', 'found', 'size', 'seed']) {
  const had = new URLSearchParams(location.search).get(key);
  if (had !== null) carried.set(key, had);
}
const toGame = `./index.html${carried.toString() ? `?${carried}` : ''}`;
/*
 * There is no longer a way past this page onto the island.
 *
 * "Or go straight ashore with no account" was here, and everybody took it —
 * which is how every body on the island came to be an anonymous session called
 * Wanderer, with its skills hanging off a uid kept in `localStorage`.
 */

type Mode = 'new' | 'back';
let mode: Mode = 'new';

/** What the page is saying at the bottom, and in what tone. */
function say(text: string, tone: '' | 'bad' | 'good' = ''): void {
  said.textContent = text;
  said.className = `say${tone ? ` ${tone}` : ''}`;
}

function note(el: HTMLElement, text: string, tone: '' | 'bad' | 'good' = ''): void {
  el.textContent = text;
  el.className = `note${tone ? ` ${tone}` : ''}`;
}

function setMode(next: Mode): void {
  mode = next;
  tabNew.classList.toggle('on', next === 'new');
  tabBack.classList.toggle('on', next === 'back');
  tabNew.setAttribute('aria-selected', String(next === 'new'));
  tabBack.setAttribute('aria-selected', String(next === 'back'));
  go.textContent = next === 'new' ? 'Make the account' : 'Come back in';
  pwBox.autocomplete = next === 'new' ? 'new-password' : 'current-password';
  // Under each field nothing until there is something to say: what is wrong with what was typed, or how it stands.
  note(nameNote, '');
  note(pwNote, '');
  say('');
  checkName();
}

tabNew.addEventListener('click', () => setMode('new'));
tabBack.addEventListener('click', () => setMode('back'));

peek.addEventListener('click', () => {
  const hidden = pwBox.type === 'password';
  pwBox.type = hidden ? 'text' : 'password';
  peek.textContent = hidden ? 'hide' : 'show';
  peek.setAttribute('aria-label', hidden ? 'Hide the password' : 'Show the password');
  pwBox.focus();
});

/**
 * Is the name free?
 *
 * Asked while you type, and only ever as a courtesy — the answer can go stale
 * between here and the sign-up, and the sign-up is what actually reserves the
 * name. Each answer carries the name it was about, so a slow reply about a
 * name you have since typed past is dropped rather than shown against the
 * wrong word.
 */
let asking = 0;
let timer = 0;
function checkName(): void {
  window.clearTimeout(timer);
  const typed = writtenName(nameBox.value);
  if (!typed) return note(nameNote, '');
  const bad = nameTrouble(typed);
  if (bad) return note(nameNote, bad, 'bad');
  if (mode === 'back') return note(nameNote, `Signing in as ${typed}.`);
  const reserved = nameRefusal(typed);
  if (reserved) return note(nameNote, reserved, 'bad');
  note(nameNote, `Asking whether ${typed} is taken…`);
  const mine = ++asking;
  timer = window.setTimeout(() => {
    void nameFree(typed).then(
      (free) => {
        if (mine !== asking) return;
        if (free) note(nameNote, `${typed} is free.`, 'good');
        else note(nameNote, `${typed} is taken. Try another.`, 'bad');
      },
      (e: Error) => {
        if (mine !== asking) return;
        note(nameNote, `Could not ask whether ${typed} is taken (${e.message}). You can still try.`);
      },
    );
  }, 350);
}

// Left as you type it: the capitals are yours, and the name on the screen is the name you are going to get.
nameBox.addEventListener('input', () => checkName());

pwBox.addEventListener('input', () => {
  if (mode === 'back') return note(pwNote, '');
  const bad = pwBox.value ? passwordTrouble(pwBox.value) : null;
  note(pwNote, bad ?? '', bad ? 'bad' : '');
});

/**
 * Passwords already cleared against the breach list.
 *
 * So that a sign-up turned back for a taken name does not spend another round
 * trip on the same password when you try again with a different one. Only
 * clean verdicts are remembered — a failure to reach the list is exactly the
 * thing a retry is meant to retry.
 */
const cleared = new Set<string>();

async function verdictFor(pw: string): Promise<string | null> {
  if (cleared.has(pw)) return null;
  const bad = await passwordVerdict(pw);
  if (!bad) cleared.add(pw);
  return bad;
}

let busy = false;

form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  if (busy) return;
  void attempt();
});

async function attempt(): Promise<void> {
  const name = writtenName(nameBox.value);
  const pw = pwBox.value;

  const badName = nameTrouble(name);
  if (badName) {
    note(nameNote, badName, 'bad');
    nameBox.focus();
    return say(badName, 'bad');
  }

  busy = true;
  go.disabled = true;
  try {
    if (mode === 'back') {
      if (!pw) { say('And the password.', 'bad'); pwBox.focus(); return; }
      say('Looking you up…');
      await signInAs(name, pw);
      return await onward('Welcome back.');
    }

    say('Checking the password against the breach list…');
    const badPw = await verdictFor(pw);
    if (badPw) {
      note(pwNote, badPw, 'bad');
      pwBox.focus();
      return say(badPw, 'bad');
    }
    note(pwNote, 'Not on the breach list.', 'good');

    say(`Making the account…`);
    const made = await createAccount(name, pw);
    if (made.unconfirmed) {
      /**
       * Auth made the account and will not let anybody in until a
       * confirmation mail is answered — and the address is a name at a host
       * with no mailbox behind it, so that mail reached nobody and never
       * will. Said plainly, with the
       * setting named, because the alternative is a page that looks like it
       * worked and an account that can never be used.
       */
      return say(
        `The account ${made.name} was made, but the island keeper is holding it until a confirmation mail is answered — and ${nameEmail(made.name)} reaches no one, by design. Whoever runs the project needs to turn off "Confirm email" in its Auth settings; the account will work the moment they do.`,
        'bad',
      );
    }
    await onward(`You are ${made.name} now.`);
  } catch (e) {
    if (e instanceof Unchecked) {
      /**
       * Fail closed. The instruction was to deny breached passwords, and a
       * password nobody could check is not a password anybody has cleared —
       * so this is a refusal with a retry, not a warning that gets waved past.
       */
      say(`${e.message} Nothing was made: a password that cannot be checked is not one this page will let through. Press the button again to have another go.`, 'bad');
    } else {
      say(e instanceof Error ? e.message : 'Something went wrong on the way to the island keeper.', 'bad');
    }
  } finally {
    busy = false;
    go.disabled = false;
  }
}

/** Signed in and done with. Say who, and hold the door open rather than leaping through it. */
function settle(line: string): void {
  lede.textContent = LEDE_ACCOUNT;
  card.classList.remove('making');
  card.classList.add('settled');
  maker.hidden = true;
  say(`${line} Taking you to the island…`, 'good');
  window.setTimeout(() => { location.href = toGame; }, 900);
}

/**
 * Signed in, and whether that is the end of it.
 *
 * An account with no face goes to the creator rather than to the island: it is
 * the second half of setting one up, not a thing to go and find later. An
 * account that has one goes straight through — being asked about your hair
 * every time you sign in would be a worse page than one that never asked.
 */
async function onward(line: string): Promise<void> {
  let had: Look | null = null;
  try {
    had = await myLook();
  } catch {
    had = null;
  }
  if (had && !lookAgain) {
    creator.look = had;
    return settle(line);
  }
  say(had ? `${line} Change whatever you like, then step ashore.` : `${line} Now, who are you?`, 'good');
  toMaker(had ?? randomLook());
}

/* ---- Step two: who you are ---------------------------------------------- */

/** Sent here from the game's Settings to choose a look again: the creator, on the one worn, rather than a door held open. */
const lookAgain = new URLSearchParams(location.search).has('look');

/** The creator, put in ahead of the button that keeps what it chose. */
const creator = new Creator(randomLook(), () => !maker.hidden);
maker.prepend(creator.el);

const LEDE_ACCOUNT = lede.textContent ?? '';
const LEDE_MAKER = 'Skin, hair, eyes, build and what you washed ashore in. None of it is fixed — you can come back and change any of it whenever you like.';

function toMaker(start: Look): void {
  lede.textContent = LEDE_MAKER;
  creator.look = start;
  card.classList.remove('settled');
  card.classList.add('making');
  maker.hidden = false;
  creator.wake();
}

ashore.addEventListener('click', () => {
  void (async () => {
    ashore.disabled = true;
    say('Writing you down…');
    try {
      // What comes back is what was stored. The keeper clamps every field
      // against its own tables, so drawing anything else here would be a
      // mirror showing a face nobody else would ever see.
      creator.look = await setLook(creator.look);
      settle('That is you.');
    } catch (e) {
      say(e instanceof Error ? e.message : 'The island keeper would not take that face.', 'bad');
      ashore.disabled = false;
    }
  })();
});

/**
 * Somebody who is already signed in does not need the form.
 *
 * `whoAmI` asks the island keeper rather than reading the name out of the
 * stored session, so what is shown here is what the database would say about
 * this browser and not what this browser would like to be true. An account
 * that has never chosen a face goes straight to the second step, because it
 * has not finished being set up.
 */
async function onArrival(): Promise<void> {
  let name: string | null = null;
  try {
    name = await whoAmI();
  } catch {
    name = null;
  }
  if (!name) return;
  let had: Look | null = null;
  try {
    had = await myLook();
  } catch {
    had = null;
  }
  if (!had) {
    say(`Signed in as ${name}. Now, who are you?`, 'good');
    toMaker(randomLook());
    return;
  }
  creator.look = had;
  card.classList.add('settled');
  say(`Signed in as ${name}.`, 'good');
  // Sent here off the island by a keeper (`play.ts`): the island's own line for it, never words from the link.
  const offFrom = new URLSearchParams(location.search).has('off') ? carried.get('island') : null;
  if (offFrom) {
    const line = await sentOffLine(offFrom).catch(() => null);
    say(line ?? 'Logged off by a keeper of the island.', 'bad');
  }
  const row = document.createElement('p');
  row.className = 'fine';
  const on = document.createElement('a');
  on.href = toGame;
  on.textContent = 'On to the island';
  const again = document.createElement('a');
  again.href = '#';
  again.id = 'again';
  again.textContent = 'change how you look';
  again.addEventListener('click', (ev) => {
    ev.preventDefault();
    say(`Signed in as ${name}.`, 'good');
    toMaker(had ?? randomLook());
  });
  const out = document.createElement('a');
  out.href = '#';
  out.textContent = 'sign out';
  out.addEventListener('click', (ev) => {
    ev.preventDefault();
    void signOut().then(() => location.reload());
  });
  row.append(on, document.createTextNode(' — or '), again, document.createTextNode(', or '), out,
             document.createTextNode(' and be somebody else.'));
  card.insertBefore(row, said.nextSibling);
  void showMfa();
  if (lookAgain) {
    say(`Signed in as ${name}. Change whatever you like, then step ashore.`, 'good');
    toMaker(had);
  }
}

/* ---- Two-step sign-in ------------------------------------------------------ */

const mfa = $<HTMLElement>('mfa');
const mfaState = $<HTMLParagraphElement>('mfa-state');
const mfaQr = $<HTMLDivElement>('mfa-qr');
const mfaImg = $<HTMLImageElement>('mfa-img');
const mfaSecret = $<HTMLElement>('mfa-secret');
const mfaCodeRow = $<HTMLDivElement>('mfa-code-row');
const mfaCode = $<HTMLInputElement>('mfa-code');
const mfaGo = $<HTMLButtonElement>('mfa-go');
const mfaCancel = $<HTMLButtonElement>('mfa-cancel');
const mfaSaid = $<HTMLParagraphElement>('mfa-say');

/** Off, on, or a step of turning it on or off. */
type MfaStep = { s: 'off' } | { s: 'on' } | { s: 'enrol'; id: string } | { s: 'remove' };
let mfaStep: MfaStep = { s: 'off' };

const MFA_ON = `On: authenticator app, ${CODE_DIGITS}-digit code, new every ${CODE_SECONDS} s. Island keeper tools: code once per sign-in.`;
const MFA_OFF = 'Off. Island keeper tools: no code.';

function mfaSay(text: string, tone: '' | 'bad' | 'good' = ''): void {
  mfaSaid.textContent = text;
  mfaSaid.className = `say${tone ? ` ${tone}` : ''}`;
}

function drawMfa(): void {
  const st = mfaStep.s;
  mfaState.textContent = st === 'on' || st === 'remove' ? MFA_ON : st === 'enrol' ? 'Authenticator app: scan the QR code or type the key, then enter its code.' : MFA_OFF;
  mfaQr.hidden = st !== 'enrol';
  mfaCodeRow.hidden = st !== 'enrol' && st !== 'remove';
  mfaCancel.hidden = st !== 'enrol' && st !== 'remove';
  mfaGo.textContent = st === 'off' ? 'Turn on' : st === 'on' ? 'Turn off' : st === 'enrol' ? 'Confirm' : 'Confirm turn off';
  if (!mfaCodeRow.hidden) mfaCode.focus();
}

/** For a signed-in named account: whether two-step sign-in is on, and the button to change it. */
async function showMfa(): Promise<void> {
  try {
    mfaStep = (await myFactor()) ? { s: 'on' } : { s: 'off' };
  } catch (e) {
    mfa.hidden = false;
    mfaGo.hidden = true;
    mfaSay(`Two-step sign-in: no answer (${e instanceof Error ? e.message : 'error'}). Reload to retry.`, 'bad');
    return;
  }
  mfa.hidden = false;
  drawMfa();
}

mfaGo.addEventListener('click', () => {
  void (async () => {
    mfaGo.disabled = true;
    mfaSay('');
    try {
      if (mfaStep.s === 'off') {
        const e = await startEnrol();
        mfaImg.src = e.qr;
        mfaSecret.textContent = e.secret;
        mfaCode.value = '';
        mfaStep = { s: 'enrol', id: e.id };
      } else if (mfaStep.s === 'enrol') {
        await finishEnrol(mfaStep.id, mfaCode.value);
        mfaStep = { s: 'on' };
        mfaSay('Two-step sign-in on.', 'good');
      } else if (mfaStep.s === 'on') {
        mfaCode.value = '';
        mfaStep = { s: 'remove' };
      } else {
        await removeFactor(mfaCode.value);
        mfaStep = { s: 'off' };
        mfaSay('Two-step sign-in off.', 'good');
      }
      if (mfaStep.s === 'on' || mfaStep.s === 'off') mfaCode.value = '';
      drawMfa();
    } catch (e) {
      mfaSay(e instanceof Error ? e.message : 'Refused.', 'bad');
    } finally {
      mfaGo.disabled = false;
    }
  })();
});

mfaCancel.addEventListener('click', () => {
  mfaStep = mfaStep.s === 'remove' ? { s: 'on' } : { s: 'off' };
  mfaImg.removeAttribute('src');
  mfaSecret.textContent = '';
  mfaCode.value = '';
  mfaSay('');
  drawMfa();
});

mfaCode.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') { ev.preventDefault(); mfaGo.click(); }
});

/* ---- The papers: the Privacy Policy and the Game Rules --------------------- */

const paper = $<HTMLDialogElement>('paper');
const paperTitle = $<HTMLHeadingElement>('paper-title');
const paperBody = $<HTMLDivElement>('paper-body');
const paperBox = paper.querySelector('.paper') as HTMLElement;
const PAPERS: Record<string, { title: string; build: () => HTMLElement }> = {
  'open-privacy': { title: PRIVACY_TITLE, build: privacyPolicy },
  'open-rules': { title: RULES_TITLE, build: gameRules },
};

/** One of the papers, over the cove in a box of its own: closed by its button, by Esc (the dialog's own), or by a click on the dimmed cove round it. */
function openPaper(title: string, build: () => HTMLElement): void {
  paperTitle.textContent = title;
  paperBody.replaceChildren(build());
  paperBody.scrollTop = 0;
  if (!paper.open) paper.showModal();
  $<HTMLButtonElement>('paper-close').focus();
}

for (const [id, p] of Object.entries(PAPERS)) $<HTMLButtonElement>(id).addEventListener('click', () => openPaper(p.title, p.build));
$<HTMLButtonElement>('paper-close').addEventListener('click', () => paper.close());
paper.addEventListener('click', (ev) => {
  if (ev.target === paper) paper.close();
});
paper.addEventListener('close', () => paperBody.replaceChildren());

/* ---- The Faith box's dress, and the cove behind it -------------------------- */

/*
 * Neither is in this page's first script. The dress is Runecut's painters
 * (src/landing/faithbox.ts); until they are in, the boxes are the plain stone
 * plate src/account.css draws. The cove is the game's renderer and the
 * world it draws (src/landing/backdrop.ts), asked for once the form has been
 * on the screen for a frame, so nothing about signing in waits on it; if it
 * cannot be drawn, the sea under it stays.
 */
void import('./landing/faithbox').then(({ dressFaith }) => {
  dressFaith(card);
  dressFaith(paperBox);
}).catch(() => {});
requestAnimationFrame(() => window.setTimeout(() => {
  void import('./landing/backdrop').then(({ startBackdrop, WIDE }) => startBackdrop($<HTMLCanvasElement>('cove'), () => {
    // The screen less the box: right of it on a wide screen, over it on a narrow one; the whole of it while the creator fills the middle.
    const W = innerWidth, H = innerHeight;
    if (card.classList.contains('making')) return { x0: 0, y0: 0, x1: W, y1: H };
    if (W >= WIDE) return { x0: Math.min(W * 0.6, card.offsetLeft + card.offsetWidth + 24), y0: 0, x1: W, y1: H };
    return { x0: 0, y0: 0, x1: W, y1: Math.max(120, card.offsetTop) };
  })).catch(() => {});
}, 0));

setMode('new');
void onArrival();

declare global {
  interface Window {
    /** Console handle, and what the browser tests drive the rules through. */
    wurmAccount: {
      nameTrouble: typeof nameTrouble;
      passwordTrouble: typeof passwordTrouble;
      passwordVerdict: typeof passwordVerdict;
      breachCount: typeof breachCount;
      breachWord: typeof breachWord;
      nameEmail: typeof nameEmail;
      foldName: typeof foldName;
      Unchecked: typeof Unchecked;
      LOOK_TABLES: typeof LOOK_TABLES;
      cleanLook: typeof cleanLook;
      randomLook: typeof randomLook;
      /** What the creator is showing at this moment. */
      look: () => Look;
      /** Open the creator on a look without an account behind it, to look at; stepping ashore still needs one. */
      openMaker: (start?: Look) => void;
    };
  }
}
window.wurmAccount = {
  nameTrouble, passwordTrouble, passwordVerdict, breachCount, breachWord, nameEmail, foldName, Unchecked, LOOK_TABLES, cleanLook, randomLook,
  look: () => creator.look,
  openMaker: (start) => toMaker(start ?? randomLook()),
};
