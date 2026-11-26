/**
 * The zinc set (`tools/sculpt/garments/metalsets.mjs`): its helm, chest & arms, shawl, leggings and boots on both
 * bodies, a chunk of its own fetched the first time a zinc piece is worn (`./lowpoly.ts` METAL_SETS).
 */
import MALE_HELM from './assets/lowmetalzinchelm-male.json';
import FEMALE_HELM from './assets/lowmetalzinchelm-female.json';
import MALE_CHEST from './assets/lowmetalzincchest-male.json';
import FEMALE_CHEST from './assets/lowmetalzincchest-female.json';
import MALE_MANTLE from './assets/lowmetalzincmantle-male.json';
import FEMALE_MANTLE from './assets/lowmetalzincmantle-female.json';
import MALE_LEGS from './assets/lowmetalzinclegs-male.json';
import FEMALE_LEGS from './assets/lowmetalzinclegs-female.json';
import MALE_BOOTS from './assets/lowmetalzincboots-male.json';
import FEMALE_BOOTS from './assets/lowmetalzincboots-female.json';

export const SET = {
  helm: { male: MALE_HELM, female: FEMALE_HELM },
  chest: { male: MALE_CHEST, female: FEMALE_CHEST },
  mantle: { male: MALE_MANTLE, female: FEMALE_MANTLE },
  legs: { male: MALE_LEGS, female: FEMALE_LEGS },
  boots: { male: MALE_BOOTS, female: FEMALE_BOOTS },
};
