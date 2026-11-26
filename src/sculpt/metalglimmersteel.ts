/**
 * The glimmersteel set (`tools/sculpt/garments/metalsets.mjs`): its helm, chest & arms, shawl, leggings and boots on both
 * bodies, a chunk of its own fetched the first time a glimmersteel piece is worn (`./lowpoly.ts` METAL_SETS).
 */
import MALE_HELM from './assets/lowmetalglimmersteelhelm-male.json';
import FEMALE_HELM from './assets/lowmetalglimmersteelhelm-female.json';
import MALE_CHEST from './assets/lowmetalglimmersteelchest-male.json';
import FEMALE_CHEST from './assets/lowmetalglimmersteelchest-female.json';
import MALE_MANTLE from './assets/lowmetalglimmersteelmantle-male.json';
import FEMALE_MANTLE from './assets/lowmetalglimmersteelmantle-female.json';
import MALE_LEGS from './assets/lowmetalglimmersteellegs-male.json';
import FEMALE_LEGS from './assets/lowmetalglimmersteellegs-female.json';
import MALE_BOOTS from './assets/lowmetalglimmersteelboots-male.json';
import FEMALE_BOOTS from './assets/lowmetalglimmersteelboots-female.json';

export const SET = {
  helm: { male: MALE_HELM, female: FEMALE_HELM },
  chest: { male: MALE_CHEST, female: FEMALE_CHEST },
  mantle: { male: MALE_MANTLE, female: FEMALE_MANTLE },
  legs: { male: MALE_LEGS, female: FEMALE_LEGS },
  boots: { male: MALE_BOOTS, female: FEMALE_BOOTS },
};
