import { TRACKER_POOL_SIZE, type Tracker } from "@/types/tracker";

export function formatTrackerNumber(index: number): string {
  return `TRK-${String(index).padStart(2, "0")}`;
}

export function createInitialTrackersPool(size = TRACKER_POOL_SIZE): Tracker[] {
  return Array.from({ length: size }, (_, index) => {
    const n = index + 1;
    return {
      id: `trk_${n}`,
      number: formatTrackerNumber(n),
      status: "available",
      assigned_mission_id: null,
      assigned_task_id: null,
      assigned_launch_id: null,
      assigned_asset_id: null,
    };
  });
}

export function normalizeTrackersPool(raw: unknown): Tracker[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return createInitialTrackersPool();
  }
  const byId = new Map<string, Tracker>();
  raw.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }
    const row = item as Partial<Tracker>;
    const id = typeof row.id === "string" ? row.id : "";
    const number = typeof row.number === "string" ? row.number : "";
    if (!id || !number) {
      return;
    }
    const status = row.status === "assigned" || row.status === "expended" ? row.status : "available";
    byId.set(id, {
      id,
      number,
      status,
      assigned_mission_id: row.assigned_mission_id ?? null,
      assigned_task_id: row.assigned_task_id ?? null,
      assigned_launch_id: row.assigned_launch_id ?? null,
      assigned_asset_id: row.assigned_asset_id ?? null,
    });
  });
  if (byId.size === 0) {
    return createInitialTrackersPool();
  }
  const seeded = createInitialTrackersPool();
  return seeded.map((seed) => byId.get(seed.id) ?? seed);
}

export function findTrackerByRef(trackers: Tracker[], ref: string | null | undefined): Tracker | undefined {
  const raw = (ref ?? "").trim();
  if (!raw) {
    return undefined;
  }
  return trackers.find((item) => item.id === raw || item.number === raw);
}

function normalizeTrackerKey(value: string): string {
  return value.trim().toUpperCase();
}

/** Available trackers for a launch, plus the currently selected one. Occupied elsewhere are hidden. */
export function trackerOptionsForLaunch(
  trackers: Tracker[],
  currentSerial: string | null | undefined,
  occupiedSerials: Array<string | null | undefined> = [],
): Tracker[] {
  const current = findTrackerByRef(trackers, currentSerial);
  const occupied = new Set(
    occupiedSerials
      .map((item) => (item ?? "").trim())
      .filter(Boolean)
      .map(normalizeTrackerKey),
  );
  if (current) {
    occupied.delete(normalizeTrackerKey(current.number));
    occupied.delete(normalizeTrackerKey(current.id));
  }
  return trackers.filter((item) => {
    if (current && item.id === current.id) {
      return true;
    }
    if (item.status !== "available") {
      return false;
    }
    return !occupied.has(normalizeTrackerKey(item.number)) && !occupied.has(normalizeTrackerKey(item.id));
  });
}
