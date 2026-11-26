/**
 * The fire-tempered steel set (`tools/sculpt/garments/metalsets.mjs`): its helm, chest & arms, shawl, leggings and boots on both
 * bodies, a chunk of its own fetched the first time a fire-tempered steel piece is worn (`./lowpoly.ts` METAL_SETS).
 */
import MALE_HELM from './assets/lowmetalfiresteelhelm-male.json';
import FEMALE_HELM from './assets/lowmetalfiresteelhelm-female.json';
import MALE_CHEST from './assets/lowmetalfiresteelchest-male.json';
import FEMALE_CHEST from './assets/lowmetalfiresteelchest-female.json';
import MALE_MANTLE from './assets/lowmetalfiresteelmantle-male.json';
import FEMALE_MANTLE from './assets/lowmetalfiresteelmantle-female.json';
import MALE_LEGS from './assets/lowmetalfiresteellegs-male.json';
import FEMALE_LEGS from './assets/lowmetalfiresteellegs-female.json';
import MALE_BOOTS from './assets/lowmetalfiresteelboots-male.json';
import FEMALE_BOOTS from './assets/lowmetalfiresteelboots-female.json';

export const SET = {
  helm: { male: MALE_HELM, female: FEMALE_HELM },
  chest: { male: MALE_CHEST, female: FEMALE_CHEST },
  mantle: { male: MALE_MANTLE, female: FEMALE_MANTLE },
  legs: { male: MALE_LEGS, female: FEMALE_LEGS },
  boots: { male: MALE_BOOTS, female: FEMALE_BOOTS },
};
