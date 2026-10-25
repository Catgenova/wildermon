/**
 * Text made safe to put inside HTML: the five characters that can open a tag,
 * an entity or an attribute value, as entities.
 *
 * Anything written as HTML that did not come out of this source -- a player's
 * name, chat, a letter, a sign, a wildermon's or a settlement's name, an item's
 * label, a stored key binding -- goes through this first, or goes in as
 * `textContent` instead. The `html` template tag (src/ui/html.ts) calls it on
 * every `${…}`, and `setMarkup` there is the only writer of `innerHTML`.
 * `scripts/html-sinks.mjs` lists every such sink and fails on one nobody has
 * looked at (`scripts/html-sinks.allow`).
 */
export function esc(text: unknown): string {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
