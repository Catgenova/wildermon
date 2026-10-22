/**
 * Each species' look, in `TREE_DEFS` order. Looked up by name, so the order
 * of the table and of this file can never drift apart; a species missing
 * here is an error at load rather than a tree drawn as somebody else.
 */
import { TREE_DEFS } from '../../world/tiles';
import type { TreeLook } from './types';
import { apple } from './species/apple';
import { apricot } from './species/apricot';
import { birch } from './species/birch';
import { cedar } from './species/cedar';
import { cherry } from './species/cherry';
import { fig } from './species/fig';
import { lemon } from './species/lemon';
import { maple } from './species/maple';
import { oak } from './species/oak';
import { olive } from './species/olive';
import { peach } from './species/peach';
import { pear } from './species/pear';
import { pine } from './species/pine';
import { plum } from './species/plum';
import { pomegranate } from './species/pomegranate';
import { quince } from './species/quince';
import { willow } from './species/willow';

const BY_NAME: Readonly<Record<string, TreeLook>> = {
  Birch: birch, Pine: pine, Oak: oak, Maple: maple, Willow: willow, Cedar: cedar, Apple: apple, Cherry: cherry,
  Olive: olive, Pear: pear, Plum: plum, Peach: peach, Fig: fig, Lemon: lemon, Pomegranate: pomegranate,
  Apricot: apricot, Quince: quince,
};

export const TREE_LOOKS: readonly TreeLook[] = TREE_DEFS.map((d) => {
  const look = BY_NAME[d.name];
  if (!look) throw new Error(`no tree look for ${d.name}`);
  return look;
});
