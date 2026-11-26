/**
 * The copper set (`tools/sculpt/garments/metalsets.mjs`): its helm, chest & arms, shawl, leggings and boots on both
 * bodies, a chunk of its own fetched the first time a copper piece is worn (`./lowpoly.ts` METAL_SETS).
 */
import MALE_HELM from './assets/lowmetalcopperhelm-male.json';
import FEMALE_HELM from './assets/lowmetalcopperhelm-female.json';
import MALE_CHEST from './assets/lowmetalcopperchest-male.json';
import FEMALE_CHEST from './assets/lowmetalcopperchest-female.json';
import MALE_MANTLE from './assets/lowmetalcoppermantle-male.json';
import FEMALE_MANTLE from './assets/lowmetalcoppermantle-female.json';
import MALE_LEGS from './assets/lowmetalcopperlegs-male.json';
import FEMALE_LEGS from './assets/lowmetalcopperlegs-female.json';
import MALE_BOOTS from './assets/lowmetalcopperboots-male.json';
import FEMALE_BOOTS from './assets/lowmetalcopperboots-female.json';

export const SET = {
  helm: { male: MALE_HELM, female: FEMALE_HELM },
  chest: { male: MALE_CHEST, female: FEMALE_CHEST },
  mantle: { male: MALE_MANTLE, female: FEMALE_MANTLE },
  legs: { male: MALE_LEGS, female: FEMALE_LEGS },
  boots: { male: MALE_BOOTS, female: FEMALE_BOOTS },
};
