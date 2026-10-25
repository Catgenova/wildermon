/**
 * The page `scripts/boot-check.mjs` opens to see the built game page's policy
 * refuse what it is there to refuse, under that page's own head as built:
 * every attempt here is one the Content-Security-Policy or the Trusted Types
 * policy (src/page-guard.ts) must stop, and two are ones it must let through.
 * Each result is true when the page behaved as it should. The violations these
 * raise are expected; the boot check counts them here and nowhere else.
 */
import '../../src/page-guard';
import { fixed, html, setMarkup } from '../../src/ui/html';

export interface PolicyProbe {
  /** Markup from `setMarkup` and `html` goes in, and what was put into it as text stays text. */
  markupPasses: boolean;
  /** A string straight into innerHTML throws. */
  rawHtmlRefused: boolean;
  /** insertAdjacentHTML and outerHTML with a string throw. */
  otherSinksRefused: boolean;
  /** A script from another site is refused at `src`. */
  foreignScriptRefused: boolean;
  /** One from this site, or Cloudflare Turnstile, may be named. */
  ownScriptAllowed: boolean;
  /** eval and new Function throw. */
  evalRefused: boolean;
  /** A style attribute in markup, and one set with setAttribute, are not applied. */
  styleAttrRefused: boolean;
  /** A <style> element is not applied. */
  styleElementRefused: boolean;
  /** element.style is applied: the page's own way of styling from script. */
  cssomAllowed: boolean;
  done: boolean;
}

const probe: PolicyProbe = {
  markupPasses: false, rawHtmlRefused: false, otherSinksRefused: false, foreignScriptRefused: false, ownScriptAllowed: false,
  evalRefused: false, styleAttrRefused: false, styleElementRefused: false, cssomAllowed: false, done: false,
};
(window as unknown as { probe: PolicyProbe }).probe = probe;

const throws = (fn: () => void): boolean => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};
const colour = (el: Element): string => getComputedStyle(el).color;
const box = document.createElement('div');
document.body.append(box);

const said = '<i onmouseover="x">tt-probe</i>';
setMarkup(box, html`<b class="probe-b">${said}</b>`);
probe.markupPasses = box.querySelector('b.probe-b')?.textContent === said && !box.querySelector('i');

probe.rawHtmlRefused = throws(() => { box.innerHTML = '<b>tt-probe</b>'; });
probe.otherSinksRefused = throws(() => box.insertAdjacentHTML('beforeend', '<b>tt-probe</b>'))
  && throws(() => { (box.firstElementChild as Element).outerHTML = '<b>tt-probe</b>'; });

probe.foreignScriptRefused = throws(() => { document.createElement('script').src = 'https://tt-probe.example/x.js'; });
probe.ownScriptAllowed = !throws(() => { document.createElement('script').src = './assets/tt-probe.js'; })
  && !throws(() => { document.createElement('script').src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'; });

probe.evalRefused = throws(() => (0, eval)('1')) && throws(() => new Function('return 1'));

const base = colour(box);
const attrs = document.createElement('div');
setMarkup(attrs, fixed('<span style="color: rgb(1, 2, 3)">a</span>'));
const viaMarkup = attrs.firstElementChild as HTMLElement;
const viaSet = document.createElement('span');
viaSet.setAttribute('style', 'color: rgb(1, 2, 3)');
box.append(attrs, viaSet);
probe.styleAttrRefused = colour(viaSet) === base && colour(viaMarkup) === base;

const sheet = document.createElement('style');
sheet.textContent = '.probe-s { color: rgb(1, 2, 3) }';
document.head.append(sheet);
const styled = document.createElement('span');
styled.className = 'probe-s';
box.append(styled);
probe.styleElementRefused = colour(styled) === base;

const own = document.createElement('span');
own.style.color = 'rgb(4, 5, 6)';
box.append(own);
probe.cssomAllowed = colour(own) === 'rgb(4, 5, 6)';

probe.done = true;
