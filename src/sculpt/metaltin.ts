/**
 * The tin set (`tools/sculpt/garments/metalsets.mjs`): its helm, chest & arms, shawl, leggings and boots on both
 * bodies, a chunk of its own fetched the first time a tin piece is worn (`./lowpoly.ts` METAL_SETS).
 */
import MALE_HELM from './assets/lowmetaltinhelm-male.json';
import FEMALE_HELM from './assets/lowmetaltinhelm-female.json';
import MALE_CHEST from './assets/lowmetaltinchest-male.json';
import FEMALE_CHEST from './assets/lowmetaltinchest-female.json';
import MALE_MANTLE from './assets/lowmetaltinmantle-male.json';
import FEMALE_MANTLE from './assets/lowmetaltinmantle-female.json';
import MALE_LEGS from './assets/lowmetaltinlegs-male.json';
import FEMALE_LEGS from './assets/lowmetaltinlegs-female.json';
import MALE_BOOTS from './assets/lowmetaltinboots-male.json';
import FEMALE_BOOTS from './assets/lowmetaltinboots-female.json';

export const SET = {
  helm: { male: MALE_HELM, female: FEMALE_HELM },
  chest: { male: MALE_CHEST, female: FEMALE_CHEST },
  mantle: { male: MALE_MANTLE, female: FEMALE_MANTLE },
  legs: { male: MALE_LEGS, female: FEMALE_LEGS },
  boots: { male: MALE_BOOTS, female: FEMALE_BOOTS },
};
