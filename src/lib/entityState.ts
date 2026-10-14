import type { EntityStatus } from "@/types/target";

export function getEntityState(entity: {
  archived_at: string | null;
  reported_at?: string | null;
}): EntityStatus {
  if (entity.archived_at !== null) {
    return "archived";
  }
  if (entity.reported_at != null && entity.reported_at !== "") {
    return "reported";
  }
  return "active";
}
