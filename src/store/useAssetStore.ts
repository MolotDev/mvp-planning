import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { SEED_ASSETS } from "@/data/assetSeed";
import type { Asset, AssetInput, AssetStatusFilter } from "@/types/asset";

export const ASSET_STORE_KEY = "military_crm_assets_store";

interface AssetStoreState {
  assets: Asset[];
  createAsset: (input: AssetInput) => Asset | null;
  updateAsset: (id: string, input: AssetInput) => Asset | null;
  archiveAsset: (id: string) => void;
  restoreAsset: (id: string) => void;
  isLabelTaken: (label: string, excludeId?: string) => boolean;
  nextAssetLabel: () => string;
}

function cloneSeed(): Asset[] {
  return SEED_ASSETS.map((asset) => ({ ...asset, ammo_ids: [...asset.ammo_ids] }));
}

function createId(): string {
  return crypto.randomUUID();
}

export function nextAssetLabelFromCount(total: number): string {
  return `AT-${String(total + 1).padStart(2, "0")}`;
}

export function isActiveAssetLabelTaken(assets: Asset[], label: string, excludeId?: string): boolean {
  const normalized = label.trim();
  return assets.some(
    (asset) =>
      asset.archived_at === null &&
      asset.id !== excludeId &&
      asset.label.trim() === normalized,
  );
}

export function getAssetMetrics(assets: Asset[]) {
  return {
    total: assets.length,
    active: assets.filter((asset) => asset.archived_at === null).length,
    archived: assets.filter((asset) => asset.archived_at !== null).length,
  };
}

export function filterAssets(assets: Asset[], query: string, status: AssetStatusFilter): Asset[] {
  const q = query.trim().toLowerCase();
  return assets
    .filter((asset) => {
      if (status === "reported") {
        return false;
      }
      if (status === "active" && asset.archived_at !== null) {
        return false;
      }
      if (status === "archived" && asset.archived_at === null) {
        return false;
      }
      if (!q) {
        return true;
      }
      return asset.label.toLowerCase().includes(q);
    })
    .sort((left, right) => left.created_at.localeCompare(right.created_at) || left.label.localeCompare(right.label));
}

export const useAssetStore = create<AssetStoreState>()(
  persist(
    (set, get) => ({
      assets: cloneSeed(),
      nextAssetLabel: () => nextAssetLabelFromCount(get().assets.length),
      isLabelTaken: (label, excludeId) => isActiveAssetLabelTaken(get().assets, label, excludeId),
      createAsset: (input) => {
        const label = input.label.trim();
        if (!label || !input.antenna_id || get().isLabelTaken(label)) {
          return null;
        }
        const now = new Date().toISOString();
        const asset: Asset = {
          id: createId(),
          label,
          antenna_id: input.antenna_id,
          ammo_ids: [...input.ammo_ids],
          created_at: now,
          updated_at: now,
          archived_at: null,
        };
        set((state) => ({ assets: [...state.assets, asset] }));
        return asset;
      },
      updateAsset: (id, input) => {
        const existing = get().assets.find((asset) => asset.id === id);
        const label = input.label.trim();
        if (!existing || !label || !input.antenna_id || get().isLabelTaken(label, id)) {
          return null;
        }
        const now = new Date().toISOString();
        const updated: Asset = {
          ...existing,
          label,
          antenna_id: input.antenna_id,
          ammo_ids: [...input.ammo_ids],
          updated_at: now,
        };
        set((state) => ({
          assets: state.assets.map((asset) => (asset.id === id ? updated : asset)),
        }));
        return updated;
      },
      archiveAsset: (id) => {
        const now = new Date().toISOString();
        set((state) => ({
          assets: state.assets.map((asset) =>
            asset.id === id ? { ...asset, archived_at: now, updated_at: now } : asset,
          ),
        }));
      },
      restoreAsset: (id) => {
        const now = new Date().toISOString();
        set((state) => ({
          assets: state.assets.map((asset) =>
            asset.id === id ? { ...asset, archived_at: null, updated_at: now } : asset,
          ),
        }));
      },
    }),
    {
      name: ASSET_STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ assets: state.assets }),
    },
  ),
);

export function resetAssetStore() {
  useAssetStore.persist.clearStorage();
  useAssetStore.setState({ assets: cloneSeed() });
}
