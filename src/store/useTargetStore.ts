import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DICTIONARY } from "@/constants/dictionary";
import { SEED_AIMING_POINTS, SEED_TARGETS } from "@/data/targetSeed";
import { formatMGRSDisplay, isMGRSValid, sanitizeMGRSInput, sameMgrs } from "@/lib/validation";
import { notifyCrossTab } from "@/services/crossTabSync";
import type { AimingPoint, StatusFilter, Target } from "@/types/target";

export const TARGET_STORE_KEY = "military_crm_target_store";

export interface TargetStoreState {
  targets: Target[];
  aimingPoints: AimingPoint[];
  targetSeq: number;
  aimingPointSeq: number;
  createTarget: (
    input: Omit<Target, "id" | "label" | "created_at" | "updated_at" | "archived_at" | "aiming_point_ids">,
  ) => Target;
  updateTarget: (
    id: string,
    input: Omit<Target, "id" | "label" | "created_at" | "updated_at" | "archived_at" | "aiming_point_ids">,
  ) => Target | null;
  archiveTarget: (id: string) => void;
  restoreTarget: (id: string) => void;
  createAimingPoint: (
    targetId: string,
    input: Omit<AimingPoint, "id" | "label" | "target_id" | "created_at" | "updated_at" | "archived_at">,
  ) => AimingPoint | null;
  updateAimingPoint: (
    id: string,
    input: Omit<AimingPoint, "id" | "label" | "target_id" | "created_at" | "updated_at" | "archived_at">,
  ) => AimingPoint | null;
  archiveAimingPoint: (id: string) => void;
  restoreAimingPoint: (id: string) => void;
  nextTargetLabel: () => string;
  nextAimingPointLabel: () => string;
  isTargetDisplayedIdTaken: (displayedId: string, excludeId?: string) => boolean;
  isTargetNameTaken: (name: string, excludeId?: string) => boolean;
  isTargetMgrsTaken: (mgrs: string, excludeId?: string) => boolean;
  findTargetByMgrs: (mgrs: string, excludeId?: string) => Target | null;
  isAimingPointDisplayedIdTaken: (targetId: string, displayedId: string, excludeId?: string) => boolean;
  isAimingPointMgrsTaken: (mgrs: string, excludeId?: string) => boolean;
}

function cloneSeedTargets(): Target[] {
  return SEED_TARGETS.map((target) => ({ ...target, aiming_point_ids: [...target.aiming_point_ids] }));
}

function cloneSeedAimingPoints(): AimingPoint[] {
  return SEED_AIMING_POINTS.map((point) => ({ ...point }));
}

export function createInitialTargetState(): Pick<
  TargetStoreState,
  "targets" | "aimingPoints" | "targetSeq" | "aimingPointSeq"
> {
  return {
    targets: cloneSeedTargets(),
    aimingPoints: cloneSeedAimingPoints(),
    targetSeq: SEED_TARGETS.length,
    aimingPointSeq: SEED_AIMING_POINTS.length,
  };
}

function createId(): string {
  return crypto.randomUUID();
}

function matchesQuery(target: Target, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  return (
    target.name.toLowerCase().includes(q) ||
    // target.displayed_id.toLowerCase().includes(q) ||
    target.mgrs.toLowerCase().includes(q)
  );
}

function matchesStatus(archivedAt: string | null, filter: StatusFilter): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "archived") {
    return archivedAt !== null;
  }
  return archivedAt === null;
}

export function filterTargets(targets: Target[], query: string, status: StatusFilter): Target[] {
  return targets.filter((target) => matchesQuery(target, query) && matchesStatus(target.archived_at, status));
}

export function getActiveAimingPointCount(aimingPoints: AimingPoint[], targetId: string): number {
  return aimingPoints.filter((point) => point.target_id === targetId && point.archived_at === null).length;
}

export const useTargetStore = create<TargetStoreState>()(
  persist(
    (set, get) => ({
      ...createInitialTargetState(),
      nextTargetLabel: () => `MT${get().targetSeq + 1}`,
      nextAimingPointLabel: () => `AP${get().aimingPointSeq + 1}`,
      isTargetDisplayedIdTaken: (displayedId, excludeId) =>
        get().targets.some(
          (target) => target.displayed_id === displayedId.trim() && target.id !== excludeId,
        ),
      isTargetNameTaken: (name, excludeId) => {
        const needle = name.trim().toLowerCase();
        return get().targets.some(
          (target) =>
            target.archived_at === null &&
            target.id !== excludeId &&
            target.name.trim().toLowerCase() === needle,
        );
      },
      isTargetMgrsTaken: (mgrs, excludeId) => get().findTargetByMgrs(mgrs, excludeId) !== null,
      findTargetByMgrs: (mgrs, excludeId) => {
        const needle = sanitizeMGRSInput(mgrs);
        if (!needle) {
          return null;
        }
        return (
          get().targets.find(
            (target) =>
              target.archived_at === null &&
              target.id !== excludeId &&
              sameMgrs(target.mgrs, needle),
          ) ?? null
        );
      },
      isAimingPointDisplayedIdTaken: (targetId, _displayedId, excludeId) =>
        get().aimingPoints.some(
          (point) =>
            point.target_id === targetId &&
            // point.displayed_id === displayedId.trim() &&
            point.id !== excludeId,
        ),
      isAimingPointMgrsTaken: (mgrs, excludeId) =>
        get().aimingPoints.some(
          (point) => point.archived_at === null && point.id !== excludeId && sameMgrs(point.mgrs, mgrs),
        ),
      createTarget: (input) => {
        const now = new Date().toISOString();
        const stamp = Date.now();
        const mgrs = isMGRSValid(input.mgrs) ? formatMGRSDisplay(input.mgrs) : input.mgrs.trim();
        const aimingPointId = `ap_${stamp}_00`;
        const targetSeq = get().targetSeq + 1;
        const aimingPointSeq = get().aimingPointSeq + 1;
        const target: Target = {
          ...input,
          id: `target_${stamp}`,
          label: `MT${targetSeq}`,
          displayed_id: "",
          name: input.name.trim(),
          address: input.address.trim(),
          mgrs,
          image_url: input.image_url?.trim() ? input.image_url.trim() : null,
          aiming_point_ids: [aimingPointId],
          created_at: now,
          updated_at: now,
          archived_at: null,
        };
        const primaryPoint: AimingPoint = {
          id: aimingPointId,
          target_id: target.id,
          label: `AP${aimingPointSeq}`,
          displayed_id: "MP00",
          name: DICTIONARY.tasks.allocation.primary_target,
          mgrs,
          agl_msl: 0,
          feat_hgt_msl: 0,
          created_at: now,
          updated_at: now,
          archived_at: null,
        };
        set((state) => ({
          targets: [target, ...state.targets],
          aimingPoints: [...state.aimingPoints, primaryPoint],
          targetSeq,
          aimingPointSeq,
        }));
        notifyCrossTab("SYNC_ALL");
        return target;
      },
      updateTarget: (id, input) => {
        const existing = get().targets.find((target) => target.id === id);
        if (!existing) {
          return null;
        }
        const now = new Date().toISOString();
        const mgrs = isMGRSValid(input.mgrs) ? formatMGRSDisplay(input.mgrs) : input.mgrs.trim();
        const updated: Target = {
          ...existing,
          ...input,
          displayed_id: "",
          name: input.name.trim(),
          address: input.address.trim(),
          mgrs,
          image_url: input.image_url?.trim() ? input.image_url.trim() : null,
          updated_at: now,
        };
        set((state) => ({
          targets: state.targets.map((target) => (target.id === id ? updated : target)),
        }));
        notifyCrossTab("SYNC_ALL");
        return updated;
      },
      archiveTarget: (id) => {
        const archivedAt = new Date().toISOString();
        set((state) => ({
          targets: state.targets.map((target) =>
            target.id === id ? { ...target, archived_at: archivedAt, updated_at: archivedAt } : target,
          ),
          aimingPoints: state.aimingPoints.map((point) =>
            point.target_id === id
              ? { ...point, archived_at: archivedAt, updated_at: archivedAt }
              : point,
          ),
        }));
        notifyCrossTab("SYNC_ALL");
      },
      restoreTarget: (id) => {
        const now = new Date().toISOString();
        set((state) => ({
          targets: state.targets.map((target) =>
            target.id === id ? { ...target, archived_at: null, updated_at: now } : target,
          ),
        }));
        notifyCrossTab("SYNC_ALL");
      },
      createAimingPoint: (targetId, input) => {
        const parent = get().targets.find((target) => target.id === targetId);
        if (!parent) {
          return null;
        }
        const now = new Date().toISOString();
        const point: AimingPoint = {
          ...input,
          id: createId(),
          target_id: targetId,
          label: `AP${get().aimingPointSeq + 1}`,
          displayed_id: input.displayed_id.trim(),
          name: input.name.trim(),
          mgrs: input.mgrs.trim(),
          created_at: now,
          updated_at: now,
          archived_at: null,
        };
        set((state) => ({
          aimingPoints: [...state.aimingPoints, point],
          aimingPointSeq: state.aimingPointSeq + 1,
          targets: state.targets.map((target) =>
            target.id === targetId
              ? {
                  ...target,
                  aiming_point_ids: [...target.aiming_point_ids, point.id],
                  updated_at: now,
                }
              : target,
          ),
        }));
        notifyCrossTab("SYNC_ALL");
        return point;
      },
      updateAimingPoint: (id, input) => {
        const existing = get().aimingPoints.find((point) => point.id === id);
        if (!existing) {
          return null;
        }
        const now = new Date().toISOString();
        const updated: AimingPoint = {
          ...existing,
          ...input,
          displayed_id: input.displayed_id.trim(),
          name: input.name.trim(),
          mgrs: input.mgrs.trim(),
          updated_at: now,
        };
        set((state) => ({
          aimingPoints: state.aimingPoints.map((point) => (point.id === id ? updated : point)),
        }));
        notifyCrossTab("SYNC_ALL");
        return updated;
      },
      archiveAimingPoint: (id) => {
        const now = new Date().toISOString();
        set((state) => ({
          aimingPoints: state.aimingPoints.map((point) =>
            point.id === id ? { ...point, archived_at: now, updated_at: now } : point,
          ),
        }));
        notifyCrossTab("SYNC_ALL");
      },
      restoreAimingPoint: (id) => {
        const now = new Date().toISOString();
        set((state) => ({
          aimingPoints: state.aimingPoints.map((point) =>
            point.id === id ? { ...point, archived_at: null, updated_at: now } : point,
          ),
        }));
        notifyCrossTab("SYNC_ALL");
      },
    }),
    {
      name: TARGET_STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        targets: state.targets,
        aimingPoints: state.aimingPoints,
        targetSeq: state.targetSeq,
        aimingPointSeq: state.aimingPointSeq,
      }),
    },
  ),
);

export function resetTargetStore() {
  useTargetStore.persist.clearStorage();
  useTargetStore.setState(createInitialTargetState());
}
