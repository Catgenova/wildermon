/**
 * The help's search puts the sections with it in their heading first.
 *
 * Asked for: "could the help search prioritize by hits on section headers? i just did a search on aqueducts and the
 * actual aqueducts section is a ways down on the results". Searching kept every section that answered, in the help's
 * own order, so a section that only mentioned aqueducts sat above the one about them. Now those found in their
 * heading come first, then the rest by how often it is found (`helpRank`). Browser only: the help is the browser's.
 */
import { helpRank, helpText } from '../../src/ui/panels/help';

let bad = 0;
let n = 0;
const say = (what: string, ok: boolean, detail = ''): void => {
  n++;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

// The help as its sections, cut at each heading as the panel cuts it, with the markup taken out.
const plain = (s: string): string => s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ');
const sections = helpText().split(/<h3[^>]*>/).slice(1).map((part) => {
  const [title, ...rest] = part.split('</h3>');
  return { title: plain(title).trim(), body: plain(rest.join('</h3>')) };
});
say('the help has sections', sections.length > 20, `${sections.length}`);

const titleOf = (i: number): string => sections[i]?.title ?? '?';
const ranked = helpRank(sections, 'aqueduct');
const firstBody = ranked.findIndex((i) => !titleOf(i).toLowerCase().includes('aqueduct'));
say('"aqueduct": a section with it in its heading comes first', titleOf(ranked[0]).toLowerCase().includes('aqueduct'), titleOf(ranked[0]));
say('and every one with it in its heading before any with it only in its text',
  firstBody < 0 || ranked.slice(firstBody).every((i) => !titleOf(i).toLowerCase().includes('aqueduct')),
  ranked.slice(0, 4).map(titleOf).join(' | '));
say('and the sections with it only in their text are still there',
  ranked.length === sections.filter((s) => `${s.title} ${s.body}`.toLowerCase().includes('aqueduct')).length, `${ranked.length}`);

const toy = [
  { title: 'Wells', body: 'aqueduct aqueduct aqueduct' },
  { title: 'Water', body: 'an aqueduct' },
  { title: 'Aqueducts', body: 'one aqueduct' },
  { title: 'Bridges', body: 'nothing here' },
];
say('heading first, then by how often, then the help\'s order', helpRank(toy, 'Aqueduct').join(',') === '2,0,1', helpRank(toy, 'aqueduct').join(','));
say('nothing for an empty search', helpRank(toy, '  ').length === 0);

console.log(`\nthe help's search, headings first — ${n - bad} of ${n}`);
if (bad) process.exit(1);
