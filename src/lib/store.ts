import { Plant, freshPlant } from "./loop";

const g = globalThis as unknown as { __abz?: Plant };

export function getPlant(): Plant {
  if (!g.__abz) g.__abz = freshPlant("scalar");
  return g.__abz;
}

export function setPlant(p: Plant) {
  g.__abz = p;
  return p;
}

export function resetPlant(mode: Plant["mode"] = "scalar") {
  g.__abz = freshPlant(mode);
  return g.__abz;
}