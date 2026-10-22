/**
 * CAPTCHA on the way into an account: Cloudflare Turnstile, ready and off.
 *
 * Supabase Auth checks a CAPTCHA token on sign-up, password sign-in and
 * anonymous sign-in once "Enable CAPTCHA protection" is on in the project
 * (dashboard /project/_/auth/protection: Bot and Abuse Protection, provider
 * Turnstile, with the widget's secret key). supabase-js carries the token as `options.captchaToken` on
 * `signUp`, `signInWithPassword` and `signInAnonymously`.
 *
 * Off until `TURNSTILE_SITE_KEY` is set: with it empty no script is loaded and
 * no token is sent, so nothing changes. Turn it on in this order, or every
 * sign-in is refused in between: set the key here and deploy the page, then
 * switch the protection on in the dashboard. The page's Content-Security-Policy
 * has to allow `https://challenges.cloudflare.com` for scripts and frames.
 *
 * A token is good for one request, so every call asks for a fresh one. The
 * widget is drawn only when Cloudflare wants a click (`interaction-only`).
 */

/** The Turnstile widget's public site key (Cloudflare dashboard > Turnstile). Empty: no CAPTCHA. */
export const TURNSTILE_SITE_KEY = '';

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
/** How long a challenge may wait for an answer before the sign-in gives up, in seconds. */
export const CAPTCHA_WAIT_S = 120;

interface Turnstile {
  render(el: HTMLElement, opts: Record<string, unknown>): string | undefined;
  remove(id: string): void;
}

export const captchaOn = (): boolean => TURNSTILE_SITE_KEY !== '';

let loading: Promise<Turnstile> | null = null;

function load(): Promise<Turnstile> {
  const have = (window as { turnstile?: Turnstile }).turnstile;
  if (have) return Promise.resolve(have);
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => {
      const t = (window as { turnstile?: Turnstile }).turnstile;
      if (t) resolve(t);
      else reject(new Error('CAPTCHA did not load.'));
    };
    s.onerror = () => {
      loading = null;
      s.remove();
      reject(new Error('CAPTCHA could not be reached (challenges.cloudflare.com).'));
    };
    document.head.append(s);
  });
  return loading;
}

/** One fresh token. Throws when the challenge fails, expires or goes unanswered for `CAPTCHA_WAIT_S`. */
async function solve(): Promise<string> {
  const turnstile = await load();
  const holder = document.createElement('div');
  holder.className = 'captcha';
  holder.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483647;max-width:calc(100vw - 32px);';
  document.body.append(holder);
  let id: string | undefined;
  try {
    return await new Promise<string>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error(`CAPTCHA: no answer in ${CAPTCHA_WAIT_S} s. Try again.`)), CAPTCHA_WAIT_S * 1000);
      const done = (fn: () => void) => () => { window.clearTimeout(timer); fn(); };
      id = turnstile.render(holder, {
        sitekey: TURNSTILE_SITE_KEY,
        appearance: 'interaction-only',
        callback: (token: string) => done(() => resolve(token))(),
        'error-callback': done(() => reject(new Error('CAPTCHA failed. Try again.'))),
        'expired-callback': done(() => reject(new Error('CAPTCHA expired. Try again.'))),
        'timeout-callback': done(() => reject(new Error('CAPTCHA timed out. Try again.'))),
      });
    });
  } finally {
    if (id) {
      try { turnstile.remove(id); } catch { /* already gone */ }
    }
    holder.remove();
  }
}

/** What to spread into an Auth call's `options`: `{ captchaToken }` when CAPTCHA is on, nothing when it is off. */
export async function captchaOptions(): Promise<{ captchaToken?: string }> {
  if (!captchaOn()) return {};
  return { captchaToken: await solve() };
}
