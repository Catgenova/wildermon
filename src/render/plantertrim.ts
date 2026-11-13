import { CROP_LIST, CROP_STAGES, RIPE, type CropDef } from '../game/farming';

/**
 * What a planter is drawn holding, as the one number its bake is kept under
 * (the piece's `trim`): nought for bare earth, and otherwise which crop and
 * at what stage, with `TENDED` added once a stage before ripe is tended
 * (`Crop.tendedNow`). The model reads it back with `planterHolds`.
 */
const TENDED = 1 << 8;
export const planterTrim = (cropId: string, stage: number, tended = false): number => {
  const i = CROP_LIST.findIndex((c) => c.id === cropId);
  const s = Math.max(0, Math.min(CROP_STAGES - 1, stage));
  return i < 0 ? 0 : 1 + i * CROP_STAGES + s + (tended && s < RIPE ? TENDED : 0);
};
/** What a planter's `trim` says it holds: the crop, its stage, and whether the stage is tended (never at ripe). */
export const planterHolds = (trim: number | undefined): { crop: CropDef; stage: number; tended: boolean } | null => {
  if (!trim || trim < 1 || !Number.isInteger(trim)) return null;
  const tended = trim >= TENDED;
  const n = tended ? trim - TENDED : trim;
  const crop = CROP_LIST[Math.floor((n - 1) / CROP_STAGES)];
  return crop ? { crop, stage: (n - 1) % CROP_STAGES, tended } : null;
};
