/**
 * The Game Rules, as given: shown in Settings (its own tab) and on the
 * landing page. Kept word for word; built as text nodes, so nothing in it
 * goes through an HTML sink.
 */

export const RULES_TITLE = 'Game Rules';

const RULES: Array<{ h: string; items: string[] }> = [
  { h: '1. Be Respectful', items: [
    'No harassment, hate speech, threats, doxxing, or spam in chat.',
    'No sexual, graphic, or otherwise offensive content in chat, usernames, or guild names.',
  ] },
  { h: '2. No Cheating', items: [
    'Do not modify the client, or run bots, scripts, or external automation (beyond the game’s own opt-in auto features).',
    'Do not manipulate the economy, the leaderboard, or any shared system.',
  ] },
  { h: '3. No Exploiting Bugs', items: [
    'If you find a duplication or economy exploit, stop and report it. Knowingly exploiting a bug may result in a rollback or ban.',
  ] },
  { h: '4. Play Fair in Shared Systems', items: [
    'Use the Auction House, guild banks, and dungeons in good faith, no scamming, impersonation, or deliberate market manipulation.',
    'Do not trade accounts, items, or gold for real money or outside goods.',
  ] },
  { h: '5. Names & Accounts', items: [
    'Usernames and guild names must not impersonate other players or staff, or be offensive.',
    'You are responsible for your own account and password.',
  ] },
];

/** The rules, as an element to put in a window or an overlay. */
export function gameRules(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'privacy-policy game-rules';
  const h1 = document.createElement('h1');
  h1.textContent = RULES_TITLE;
  const lead = document.createElement('p');
  lead.textContent = 'These Game Rules keep Fantasy Frontiers fair and welcoming for everyone. Breaking them may lead to warnings, muting, rollbacks, or a ban.';
  root.append(h1, lead);
  for (const r of RULES) {
    const h = document.createElement('h2');
    h.textContent = r.h;
    const ul = document.createElement('ul');
    for (const t of r.items) {
      const li = document.createElement('li');
      li.textContent = t;
      ul.append(li);
    }
    root.append(h, ul);
  }
  return root;
}
