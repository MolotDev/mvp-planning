import { AMMOS } from "@/data/launchCatalog";
import type { Asset } from "@/types/asset";

const created = "2026-03-01T08:00:00.000Z";
const ammoIds = AMMOS.map((ammo) => ammo.id);

export const ASSET_1_ID = "uav_1";
export const ASSET_2_ID = "uav_2";
export const ASSET_3_ID = "uav_3";

export const SEED_ASSETS: Asset[] = [
  {
    id: ASSET_1_ID,
    label: "Ворон",
    antenna_id: "antenna_1",
    ammo_ids: [ammoIds[0]],
    created_at: created,
    updated_at: created,
    archived_at: null,
  },
  {
    id: ASSET_2_ID,
    label: "Сова",
    antenna_id: "antenna_2",
    ammo_ids: [ammoIds[1]],
    created_at: created,
    updated_at: created,
    archived_at: null,
  },
  {
    id: ASSET_3_ID,
    label: "Сокіл",
    antenna_id: "antenna_3",
    ammo_ids: [ammoIds[2]],
    created_at: created,
    updated_at: created,
    archived_at: null,
  },
];
