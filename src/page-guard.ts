/**
 * What every page does before anything else in it runs. Imported first by
 * `main.ts` and `account.ts`.
 *
 * Framing. A page that runs inside another site's frame can be dressed so the
 * player clicks what they cannot see. `frame-ancestors` would refuse that, but
 * it works only as a header and GitHub Pages sends none, so the page checks for
 * itself: in a frame whose top is another origin it shows `FRAMED` with a link
 * out, and throws, so no module after this one starts.
 *
 * Trusted Types. The pages' Content-Security-Policy says
 * `require-trusted-types-for 'script'; trusted-types default`: a string reaches
 * an HTML, script or script-URL sink only through the one policy named
 * `default`, made here. It passes HTML only when `vouch()` (called by
 * `setMarkup` in `src/ui/html.ts`, the one writer of HTML) has just handed it
 * that exact text; script never; a script URL only from this origin or
 * `SCRIPT_ORIGINS`. Anything else is refused: the browser throws at the sink
 * and reports it as a Content-Security-Policy violation, which
 * `scripts/boot-check.mjs` fails on.
 */

/** The words shown in a frame on another site. */
export const FRAMED = 'Framed by another site';
/** The link out of it. */
export const FRAMED_LINK = 'Open in its own tab';

/** Where a script may be loaded from besides this site: Cloudflare Turnstile (`src/net/captcha.ts`). */
export const SCRIPT_ORIGINS = ['https://challenges.cloudflare.com'];

/** Whether this page is in a frame whose top, or any frame between, is another origin. */
export function framedByStranger(): boolean {
  // Not in a page at all: the Node tests, which import the modules this guards.
  if (typeof window === 'undefined' || window.top === window.self) return false;
  const ancestors = (location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins;
  if (ancestors) for (let i = 0; i < ancestors.length; i++) if (ancestors.item(i) !== location.origin) return true;
  try {
    return window.top?.location.origin !== location.origin;
  } catch {
    return true;
  }
}

if (framedByStranger()) {
  const box = document.createElement('div');
  box.className = 'framed';
  Object.assign(box.style, {
    position: 'fixed', inset: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '12px', background: '#14110d', color: '#e8dcc4', font: '16px system-ui, sans-serif', zIndex: '2147483647',
  });
  const say = document.createElement('b');
  say.textContent = FRAMED;
  const out = document.createElement('a');
  out.textContent = FRAMED_LINK;
  out.href = location.href;
  out.target = '_top';
  out.rel = 'noopener noreferrer';
  out.style.color = '#e8b04a';
  box.append(say, out);
  document.body.replaceChildren(box);
  throw new Error(`${FRAMED}: not started.`);
}

/* ---- Trusted Types ---------------------------------------------------------- */

interface Policy {
  createHTML(text: string): unknown;
}
interface PolicyFactory {
  createPolicy(name: string, rules: {
    createHTML?: (text: string, ...rest: unknown[]) => string | null;
    createScript?: (text: string, ...rest: unknown[]) => string | null;
    createScriptURL?: (text: string, ...rest: unknown[]) => string | null;
  }): Policy;
}

/** The HTML `setMarkup` is writing this moment; the policy passes that and nothing else. */
let vouched: string | null = null;

/** Whether a script may be loaded from `url`: this site, or one of `SCRIPT_ORIGINS`. */
export function scriptURLAllowed(url: string): boolean {
  try {
    const at = new URL(url, location.href);
    return at.origin === location.origin || SCRIPT_ORIGINS.includes(at.origin);
  } catch {
    return false;
  }
}

const policy: Policy | null = (() => {
  const factory = (globalThis as { trustedTypes?: PolicyFactory }).trustedTypes;
  if (!factory) return null;
  try {
    return factory.createPolicy('default', {
      createHTML: (text) => (text === vouched ? text : null),
      createScript: () => null,
      createScriptURL: (text) => (scriptURLAllowed(text) ? text : null),
    });
  } catch {
    // Made already: a module run twice (Vite's hot reload). The one made first stands.
    return null;
  }
})();

/**
 * `text` as the page's sinks will take it: a TrustedHTML from the default
 * policy where the browser has Trusted Types, the string itself where it does
 * not. For `setMarkup` (`src/ui/html.ts`) only.
 */
export function vouch(text: string): string {
  if (!policy) return text;
  vouched = text;
  try {
    return policy.createHTML(text) as string;
  } finally {
    vouched = null;
  }
}
