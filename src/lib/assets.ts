import { ANTENNAS } from "@/data/antennas";
import { AMMOS } from "@/data/launchCatalog";
import { useAssetStore } from "@/store/useAssetStore";
import type { Antenna } from "@/types/asset";
import type { AmmoModel } from "@/types/launch";

export function assetName(id: string): string {
  return useAssetStore.getState().assets.find((asset) => asset.id === id)?.label ?? id;
}

export function antennaName(id: string): string {
  return ANTENNAS.find((antenna) => antenna.id === id)?.name ?? id;
}

export function antennasForAsset(assetId: string): Antenna[] {
  const asset = useAssetStore.getState().assets.find((item) => item.id === assetId);
  if (!asset) {
    return [];
  }
  return ANTENNAS.filter((antenna) => antenna.id === asset.antenna_id);
}

export function ammosForAsset(assetId: string, currentId = ""): AmmoModel[] {
  const asset = useAssetStore.getState().assets.find((item) => item.id === assetId);
  if (!asset) {
    return [];
  }
  const allowed = new Set(asset.ammo_ids);
  const options = AMMOS.filter((ammo) => allowed.has(ammo.id));
  if (currentId && !options.some((ammo) => ammo.id === currentId)) {
    const current = AMMOS.find((ammo) => ammo.id === currentId);
    if (current) {
      return [current, ...options];
    }
  }
  return options;
}
