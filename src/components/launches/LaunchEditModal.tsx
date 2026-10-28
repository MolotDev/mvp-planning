import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { ApplyBelowPopover } from "@/components/launches/ApplyBelowPopover";
import { BattleGroupCrewLine } from "@/components/launches/BattleGroupCrewLine";
import { ClearTrackerButton } from "@/components/launches/ClearTrackerButton";
import { InlineFieldAlert } from "@/components/launches/InlineFieldAlert";
import { AimingPointBadge, Badge, ProgressBadge, TargetBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CloseIconButton, DeleteIconButton } from "@/components/ui/icon-buttons";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { TRACKERS } from "@/data/launchCatalog";
import { DICTIONARY } from "@/constants/dictionary";
import { canEditLaunchField, canEditLaunchFields } from "@/lib/access";
import { ammosForAsset, defaultAmmoId } from "@/lib/assets";
import { crewName, uavName } from "@/lib/battleGroup";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import { detachmentName } from "@/lib/detachments";
import { formatStoredAimingPoint } from "@/lib/formatters";
import { formattingMGRS } from "@/lib/formattingMGRS";
import { allocationForLaunch, resolveLaunchAimingPoint } from "@/lib/launchAiming";
import { isLaunchProcessed, isLaunchReadOnly, launchLockKind, processedTransitionPatch, quantityDiscrepancy, trackerName } from "@/lib/launches";
import { duplicateValueMessage, groupLaunchesByCrew } from "@/lib/taskCrewMatrix";
import { QuantityDiscrepancy } from "@/components/tasks/QuantityDiscrepancy";
import { notifyError, notifySuccess } from "@/lib/toasts";
import { publishLaunchesToSupabase } from "@/services/launchService";
import { useAuthStore } from "@/store/useAuthStore";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useTargetStore } from "@/store/useTargetStore";
import { useTaskStore } from "@/store/useTaskStore";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Mission, Task } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";
import { cn } from "@/lib/utils";
import { extractNumeric } from "@/lib/validation";

const selectClassName =
  "h-9 w-full min-w-[80px] rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-2 text-sm text-primitive-neutral-0 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

interface CenterAimingGroup {
  key: string;
  point: AimingPoint | null;
  rows: Launch[];
}

interface CenterCrewGroup {
  key: string;
  crewId: string;
  group: BattleGroup | undefined;
  aiming: CenterAimingGroup[];
}

interface CenterAssetGroup {
  key: string;
  assetId: string;
  quantity: number;
  crews: CenterCrewGroup[];
}

interface CenterDetachmentGroup {
  key: string;
  detachmentId: string;
  assets: CenterAssetGroup[];
}

interface CenterTargetGroup {
  key: string;
  target: Target | undefined;
  detachments: CenterDetachmentGroup[];
}

function compareUk(left: string, right: string): number {
  return left.localeCompare(right, "uk");
}

function countProcessed(rows: Launch[]): { processed: number; total: number } {
  return {
    processed: rows.filter(isLaunchProcessed).length,
    total: rows.length,
  };
}

function singleValue(values: string[]): string | undefined {
  const unique = [...new Set(values.filter(Boolean))];
  return unique.length === 1 ? unique[0] : undefined;
}

function buildCenterLaunchTree(
  launches: Launch[],
  battleGroups: BattleGroup[],
  tasks: Task[],
  fallbackTask: Task,
  aimingPoints: AimingPoint[],
  targets: Target[],
  fallbackTarget: Target | undefined,
): CenterTargetGroup[] {
  const targetsById = new Map<string, { target: Target | undefined; detachments: Map<string, { detachmentId: string; assets: Map<string, { assetId: string; crews: Map<string, { crewId: string; group: BattleGroup | undefined; aiming: Map<string, CenterAimingGroup> }> }> }> }>();
  launches.forEach((launch) => {
    const owner = battleGroups.find((item) => item.id === launch.battle_group_id);
    const itemTask = tasks.find((item) => item.id === launch.task_id) ?? fallbackTask;
    const line = allocationForLaunch(itemTask, launch, owner);
    const targetId = line?.target_id ?? singleValue(itemTask.allocations.map((item) => item.target_id));
    const resolvedTarget = (targetId ? targets.find((item) => item.id === targetId) : undefined) ?? fallbackTarget;
    const targetKey = resolvedTarget?.id ?? "target";
    const targetBucket = targetsById.get(targetKey) ?? { target: resolvedTarget, detachments: new Map() };
    const detachmentId = itemTask.organization_id || "detachment";
    const detachmentBucket = targetBucket.detachments.get(detachmentId) ?? { detachmentId, assets: new Map() };
    const assetId = owner?.asset_id || launch.asset_id || "asset";
    const assetBucket = detachmentBucket.assets.get(assetId) ?? { assetId, crews: new Map() };
    const crewId = owner?.lead_crew_id || launch.battle_group_id;
    const crewBucket = assetBucket.crews.get(crewId) ?? { crewId, group: owner, aiming: new Map() };
    const point = resolveLaunchAimingPoint(itemTask, launch, owner, aimingPoints) ?? null;
    const pointKey = point?.id || "primary";
    const aimingBucket = crewBucket.aiming.get(pointKey) ?? { key: pointKey, point, rows: [] };
    aimingBucket.rows.push(launch);
    crewBucket.aiming.set(pointKey, aimingBucket);
    assetBucket.crews.set(crewId, crewBucket);
    detachmentBucket.assets.set(assetId, assetBucket);
    targetBucket.detachments.set(detachmentId, detachmentBucket);
    targetsById.set(targetKey, targetBucket);
  });
  return [...targetsById.entries()]
    .map(([key, targetBucket]) => ({
      key,
      target: targetBucket.target,
      detachments: [...targetBucket.detachments.values()]
        .map((detachment) => ({
          key: detachment.detachmentId,
          detachmentId: detachment.detachmentId,
          assets: [...detachment.assets.values()]
            .map((asset) => {
              const crews = [...asset.crews.values()]
                .map((crew) => ({
                  key: crew.crewId,
                  crewId: crew.crewId,
                  group: crew.group,
                  aiming: [...crew.aiming.values()].sort((left, right) =>
                    compareUk(
                      formatStoredAimingPoint(left.point, targetBucket.target?.name).badge,
                      formatStoredAimingPoint(right.point, targetBucket.target?.name).badge,
                    ),
                  ),
                }))
                .sort((left, right) => compareUk(left.crewId, right.crewId));
              return {
                key: asset.assetId,
                assetId: asset.assetId,
                quantity: crews.reduce((sum, crew) => sum + crew.aiming.reduce((inner, item) => inner + item.rows.length, 0), 0),
                crews,
              };
            })
            .sort((left, right) => compareUk(uavName(left.assetId), uavName(right.assetId))),
        }))
        .sort((left, right) => compareUk(detachmentName(left.detachmentId), detachmentName(right.detachmentId))),
    }))
    .sort((left, right) => compareUk(left.target?.name ?? "", right.target?.name ?? ""));
}

function CollapseSection({
  sectionKey,
  open,
  depth,
  title,
  onToggle,
  children,
}: {
  sectionKey: string;
  open: boolean;
  depth: number;
  title: ReactNode;
  onToggle: (key: string) => void;
  children: ReactNode;
}) {
  return (
    <details open={open} className={cn("flex flex-col gap-2", depth > 0 && "ml-4")}>
      <summary
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggle(sectionKey);
        }}
        className="flex list-none flex-wrap items-center justify-between gap-2 rounded-lg bg-primitive-neutral-800 px-2 py-1 text-primitive-neutral-0 hover:cursor-pointer hover:shadow-md [&::-webkit-details-marker]:hidden"
      >
        <div className="flex min-w-0 items-center gap-2">{title}</div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open ? "" : "rotate-180")} aria-hidden="true" />
      </summary>
      {children}
    </details>
  );
}

interface RowDraft {
  aiming_point_mgrs: string;
  trajectory_name: string;
  asset_serial_number: string;
  tracker_model_serial_number: string;
  ammo_model_id: string;
  ammo_quantity: string;
}

interface LaunchEditorProps {
  task: Task;
  mission: Mission | undefined;
  target: Target | undefined;
  aimingPoints: AimingPoint[];
  battleGroups: BattleGroup[];
  launches: Launch[];
  editing: boolean;
  locked: boolean;
}

function draftFromLaunch(launch: Launch): RowDraft {
  return {
    aiming_point_mgrs: launch.aiming_point_mgrs,
    trajectory_name: launch.trajectory_name ?? "",
    asset_serial_number: launch.asset_serial_number,
    tracker_model_serial_number: launch.tracker_model_serial_number ?? "",
    ammo_model_id: defaultAmmoId(launch.asset_id, launch.ammo_model_id),
    ammo_quantity: launch.ammo_quantity > 0 ? String(launch.ammo_quantity) : "1",
  };
}

function sameDraft(left: RowDraft, right: RowDraft): boolean {
  return (
    left.aiming_point_mgrs === right.aiming_point_mgrs &&
    left.trajectory_name === right.trajectory_name &&
    left.asset_serial_number === right.asset_serial_number &&
    left.tracker_model_serial_number === right.tracker_model_serial_number &&
    left.ammo_model_id === right.ammo_model_id &&
    left.ammo_quantity === right.ammo_quantity
  );
}

function draftsMatch(current: Record<string, RowDraft>, base: Record<string, RowDraft>): boolean {
  return Object.keys(base).every((id) => current[id] !== undefined && sameDraft(current[id], base[id]));
}

function cloneDrafts(source: Record<string, RowDraft>): Record<string, RowDraft> {
  return Object.fromEntries(Object.entries(source).map(([id, draft]) => [id, { ...draft }]));
}

function AmmoApplyPopover({
  anchor,
  onApply,
  onClose,
}: {
  anchor: HTMLElement;
  onApply: () => void;
  onClose: () => void;
}) {
  const [box, setBox] = useState(() => anchor.getBoundingClientRect());

  useEffect(() => {
    const update = () => setBox(anchor.getBoundingClientRect());
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [anchor]);

  const placeAbove = box.top > 56;

  return createPortal(
    <div
      className="fixed z-[60] rounded-sm border border-primitive-neutral-700 bg-primitive-neutral-900 p-1 shadow-md"
      style={{
        top: placeAbove ? box.top - 2 : box.bottom + 2,
        left: box.left,
        transform: placeAbove ? "translateY(-100%)" : undefined,
      }}
    >
      <div className="flex items-center gap-3">
        <Button className="h-5 px-1.5 text-[12px] leading-none hover:cursor-pointer hover:shadow-md" onClick={onApply}>
          {DICTIONARY.tasks.launch_board.apply_ammo_all}
        </Button>
        <CloseIconButton className="h-5 w-5" onClick={onClose} />
      </div>
    </div>,
    document.body,
  );
}

export function LaunchEditor({
  task,
  mission,
  target,
  aimingPoints,
  battleGroups,
  launches,
  editing,
  locked,
}: LaunchEditorProps) {
  const role = useAuthStore((state) => state.role);
  const catalogTasks = useTaskStore((state) => state.tasks);
  const catalogTargets = useTargetStore((state) => state.targets);
  const crewLimited = canEditLaunchFields(role);
  const updateLaunch = useLaunchStore((state) => state.updateLaunch);
  const archiveLaunch = useLaunchStore((state) => state.archiveLaunch);
  const storedLaunches = useLaunchStore((state) => state.launches);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const allGroups = useBattleGroupStore((state) => state.battleGroups);
  const [baseDrafts, setBaseDrafts] = useState<Record<string, RowDraft>>(() =>
    Object.fromEntries(launches.map((launch) => [launch.id, draftFromLaunch(launch)])),
  );
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>(() => cloneDrafts(baseDrafts));
  const [ammoOffer, setAmmoOffer] = useState<{ launchId: string; ammoId: string; anchor: HTMLElement } | null>(null);
  const [trajectoryNameOffer, setTrajectoryNameOffer] = useState<{ launchId: string; value: string; anchor: HTMLElement } | null>(null);
  const isDirty = !draftsMatch(drafts, baseDrafts);
  const detailsText = DICTIONARY.tasks.details;
  const serialEntries = useMemo(
    () =>
      groupLaunchesByCrew(task, allGroups, storedLaunches).flatMap((group) =>
        group.launches.map((launch, index) => ({
          id: launch.id,
          index: index + 1,
          serial: launch.asset_serial_number,
          tracker: launch.tracker_model_serial_number,
          crewName: group.crewId ? crewName(group.crewId) : null,
          crewId: group.crewId ?? null,
        })),
      ),
    [allGroups, storedLaunches, task],
  );
  const liveEntries = serialEntries.map((entry) => {
    const draft = drafts[entry.id];
    if (!draft) {
      return entry;
    }
    return {
      ...entry,
      serial: draft.asset_serial_number,
      tracker: draft.tracker_model_serial_number || null,
    };
  });
  const duplicateMessages = new Map(
    launches.map((launch) => {
      const draft = drafts[launch.id];
      if (!draft) {
        return [launch.id, { serial: "", tracker: "" }] as const;
      }
      return [
        launch.id,
        {
          serial: duplicateValueMessage(liveEntries, launch.id, "serial", draft.asset_serial_number, {
            duplicate: detailsText.duplicate_serial,
            crew: detailsText.crew_title,
          }),
          tracker: duplicateValueMessage(liveEntries, launch.id, "tracker", draft.tracker_model_serial_number, {
            duplicate: detailsText.duplicate_tracker,
            crew: detailsText.crew_title,
          }),
        },
      ] as const;
    }),
  );
  const liveLaunch = (launch: Launch) => storedLaunches.find((item) => item.id === launch.id) ?? launch;
  const rowLocked = (launch: Launch) => locked || isLaunchReadOnly(liveLaunch(launch), task, mission ?? null);
  const hasDuplicate = launches.some((launch) => {
    if (rowLocked(launch)) {
      return false;
    }
    const message = duplicateMessages.get(launch.id);
    return Boolean(message?.serial || message?.tracker);
  });
  const fieldsEnabled = editing && !locked;
  const columns = DICTIONARY.tasks.launch_board.columns;

  const commitTransition = (launchId: string, draft: RowDraft) => {
    const stored = useLaunchStore.getState().launches.find((item) => item.id === launchId);
    if (!stored || isLaunchReadOnly(stored, task, mission ?? null)) {
      return;
    }
    const transition = processedTransitionPatch(stored, draft, 0);
    if (transition) {
      updateLaunch(launchId, transition);
    }
  };

  const clearTracker = (launchId: string) => {
    setDrafts((existing) => ({
      ...existing,
      [launchId]: { ...existing[launchId], tracker_model_serial_number: "" },
    }));
  };

  const patchDraft = (launchId: string, patch: Partial<RowDraft>) => {
    const current = drafts[launchId];
    const source = storedLaunches.find((item) => item.id === launchId) ?? launches.find((item) => item.id === launchId);
    if (!current || !source || isLaunchReadOnly(source, task, mission ?? null)) {
      return;
    }
    if (
      patch.tracker_model_serial_number !== undefined &&
      patch.tracker_model_serial_number.trim() === "" &&
      current.tracker_model_serial_number.trim() !== ""
    ) {
      clearTracker(launchId);
      return;
    }
    const next = { ...current, ...patch };
    setDrafts((existing) => ({ ...existing, [launchId]: next }));
    commitTransition(launchId, next);
  };

  const restoreOpenedFields = () => {
    launches.forEach((launch) => {
      const base = baseDrafts[launch.id];
      const stored = useLaunchStore.getState().launches.find((item) => item.id === launch.id);
      if (!base || !stored || isLaunchReadOnly(stored, task, mission ?? null)) {
        return;
      }
      const baseline = processedTransitionPatch(stored, base, 0);
      if (
        baseline ||
        stored.aiming_point_mgrs !== base.aiming_point_mgrs ||
        (stored.trajectory_name ?? "") !== base.trajectory_name ||
        stored.asset_serial_number !== base.asset_serial_number ||
        stored.ammo_model_id !== base.ammo_model_id ||
        String(stored.ammo_quantity > 0 ? stored.ammo_quantity : "") !== base.ammo_quantity
      ) {
        const quantity = base.ammo_quantity.trim() === "" ? 0 : Number(base.ammo_quantity);
        if (!Number.isFinite(quantity)) {
          return;
        }
        updateLaunch(launch.id, {
          aiming_point_mgrs: base.aiming_point_mgrs.trim(),
          trajectory_name: base.trajectory_name.trim() || null,
          asset_serial_number: base.asset_serial_number,
          ammo_model_id: base.ammo_model_id,
          ammo_quantity: quantity,
        });
      }
    });
  };

  const resetToBase = () => {
    restoreOpenedFields();
    setDrafts(cloneDrafts(baseDrafts));
    setAmmoOffer(null);
    setTrajectoryNameOffer(null);
  };

  const applyToListedBelow = (index: number, field: keyof RowDraft, value: string) => {
    const next = { ...drafts };
    Object.keys(next).slice(index+1).forEach((id) => {
      const source = storedLaunches.find((item) => item.id === id) ?? launches.find((item) => item.id === id);
      if (source && isLaunchReadOnly(source, task, mission ?? null)) {
        return;
      }
      next[id] = { ...next[id], [field]: value };
      commitTransition(id, next[id]);
    });
    setDrafts(next);
    setAmmoOffer(null);
    setTrajectoryNameOffer(null);
  };
  const applyAmmoToAll = (ammoId: string) => {
    const next = { ...drafts };
    Object.keys(next).forEach((id) => {
      const source = storedLaunches.find((item) => item.id === id) ?? launches.find((item) => item.id === id);
      if (source && isLaunchReadOnly(source, task, mission ?? null)) {
        return;
      }
      next[id] = { ...next[id], ammo_model_id: ammoId };
      commitTransition(id, next[id]);
    });
    setDrafts(next);
    setAmmoOffer(null);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const handleSave = async () => {
    if (hasDuplicate || isSubmitting) {
      return;
    }
    let failed = false;
    const published: Launch[] = [];
    launches.forEach((launch) => {
      if (isLaunchReadOnly(liveLaunch(launch), task, mission ?? null)) {
        return;
      }
      const draft = drafts[launch.id];
      if (!draft) {
        return;
      }
      const quantity = draft.ammo_quantity.trim() === "" ? 0 : Number(draft.ammo_quantity);
      if (!Number.isFinite(quantity)) {
        failed = true;
        return;
      }
      const saved = updateLaunch(launch.id, {
        aiming_point_mgrs: draft.aiming_point_mgrs.trim(),
        trajectory_name: draft.trajectory_name.trim() || null,
        asset_serial_number: draft.asset_serial_number,
        tracker_model_serial_number: draft.tracker_model_serial_number,
        ammo_model_id: draft.ammo_model_id,
        ammo_quantity: quantity,
      });
      if (!saved) {
        failed = true;
        return;
      }
      published.push(saved);
    });
    if (failed) {
      notifyError(DICTIONARY.common.error);
      return;
    }
    setIsSubmitting(true);
    setPublishError(null);
    const publishedResult = await publishLaunchesToSupabase(published);
    setIsSubmitting(false);
    if (!publishedResult.ok) {
      setPublishError(DICTIONARY.launches.toasts.publish_failed);
      notifyError(DICTIONARY.launches.toasts.publish_failed);
      return;
    }
    notifySuccess(DICTIONARY.tasks.launch_board.saved);
    setBaseDrafts(cloneDrafts(drafts));
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) {
      return;
    }
    const removed = archiveLaunch(pendingDeleteId);
    if (!removed) {
      notifyError(DICTIONARY.common.error);
      return;
    }
    notifySuccess(DICTIONARY.launches.toasts.deleted);
    setPendingDeleteId(null);
  };

  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [sectionOverrides, setSectionOverrides] = useState<Record<string, boolean>>({});
  const sectionOpen = (key: string, defaultOpen = true) => sectionOverrides[key] ?? defaultOpen;
  const toggleClosedSection = (key: string, defaultOpen = true) => {
    setSectionOverrides((current) => ({
      ...current,
      [key]: !(current[key] ?? defaultOpen),
    }));
  };
  const toggleOpenSection = (sectionId: string) => {
    setOpenSections((existing) => {
      const next = new Set(existing);
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId);
      return next;
    });
  };

  const renderLaunchTable = (tableRows: Launch[]) => (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] border-collapse text-left text-sm">
                  <thead className="f-full text-primitive-neutral-300">
                    <tr>
                      <th className="px-2 py-1 font-medium">№ з.п</th>
                      <th className="px-2 py-1 font-medium">{columns.aiming_mgrs}</th>
                      <th className="px-2 py-1 font-medium">{DICTIONARY.launches.fields.trajectory_name}</th>
                      <th className="px-2 py-1 font-medium">{DICTIONARY.common.asset}</th>
                      <th className="px-2 py-1 font-medium">{columns.uav_serial}</th>
                      <th className="px-2 py-1 font-medium">{columns.tracker}</th>
                      <th className="px-2 py-1 font-medium">{columns.tracker_serial}</th>
                      <th className="px-2 py-1 font-medium">{columns.ammo}</th>
                      <th className="px-2 py-1 font-medium">{columns.ammo_quantity}</th>
                      <th className="px-2 py-1 font-medium">{columns.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="f-full">
                    {tableRows.map((launch, index) => {
                      const stored = liveLaunch(launch);
                      const draft = drafts[launch.id];
                      if (!draft) {
                        return null;
                      }
                      const rowDisabled = !fieldsEnabled || rowLocked(stored);
                      const planningDisabled = rowDisabled || crewLimited;
                      const lockKind = launchLockKind(stored, catalogTasks.find((item) => item.id === launch.task_id) ?? task, mission ?? null);
                      const trackerId =
                        draft.tracker_model_serial_number.trim() && TRACKERS.length === 1 ? TRACKERS[0].id : null;
                      const trackerLabel = trackerName(trackerId);
                      const warning = duplicateMessages.get(launch.id);
                      const owner = battleGroups.find((item) => item.id === launch.battle_group_id);
                      const rowTask = catalogTasks.find((item) => item.id === launch.task_id) ?? task;
                      const rowLine = allocationForLaunch(rowTask, launch, owner);
                      const rowTargetName = catalogTargets.find((item) => item.id === rowLine?.target_id)?.name ?? target?.name;
                      const rowAiming = formatStoredAimingPoint(
                        resolveLaunchAimingPoint(rowTask, launch, owner, aimingPoints) ?? null,
                        rowTargetName,
                      );
                      const ownerCount = launches.filter((item) => item.battle_group_id === owner?.id).length;
                      const canRemoveExcess = owner !== undefined && ownerCount > owner.uav_quantity;
                      const showTrackerClear =
                        !rowDisabled &&
                        (trackerLabel !== "" || draft.tracker_model_serial_number.trim() !== "");
                      return (
                        <tr
                          key={launch.id}
                          className={cn(
                            "w-full border-t border-primitive-neutral-800",
                            canRemoveExcess && "bg-primitive-red-500/10",
                          )}
                        >
                          <td className="text-center">
                            {index + 1}
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              aria-label={`${columns.aiming_mgrs} ${launch.id}`}
                              value={rowAiming.badge}
                              disabled
                              readOnly
                              className="text-xs leading-none max-h-7"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              tabIndex={draft.trajectory_name ? -1 : 0}
                              data-error={!draft.trajectory_name.trim()}
                              aria-label={`${DICTIONARY.launches.fields.trajectory_name} ${launch.id}`}
                              value={draft.trajectory_name}
                              pattern="^[1-9][0-9]*$"
                              placeholder={DICTIONARY.launches.fields.trajectory_name_placeholder}
                              disabled={rowDisabled}
                              onChange={(event) => {
                                if (rowDisabled) {
                                  return;
                                }
                                const value = extractNumeric(event.target.value);
                                setTrajectoryNameOffer(
                                  value && fieldsEnabled
                                    ? { launchId: launch.id, value, anchor: event.currentTarget }
                                    : null,
                                );
                                patchDraft(launch.id, { trajectory_name: value});
                              }}
                              className="max-h-7 max-w-[100px] text-xs"
                            />
                            {trajectoryNameOffer?.launchId === launch.id && !rowDisabled ? (
                              <ApplyBelowPopover
                                anchor={trajectoryNameOffer.anchor}
                                label={DICTIONARY.tasks.launch_board.apply_to_listed_launches_below}
                                onApply={() => applyToListedBelow(index, "trajectory_name", trajectoryNameOffer.value.trim() || "")}
                                onClose={() => setTrajectoryNameOffer(null)}
                              />
                            ) : null}
                          </td>
                          <td className="px-2 py-2">
                            <Input aria-label={`${DICTIONARY.common.asset} ${launch.id}`} value={uavName(launch.asset_id)} disabled className="max-h-7 max-w-[140px]" />
                          </td>
                          <td className="px-2 py-2">
                            <div className="relative max-w-[200px]">
                              <Input
                                data-error={!draft.asset_serial_number.trim()}
                                className={cn(
                                  "max-h-7 w-full text-md px-1.5",
                                  warning?.serial && "border-primitive-red-500 pr-[75%]",
                                )}
                                tabIndex={draft.asset_serial_number ? -1 : 0}
                                aria-label={`${columns.uav_serial} ${launch.id}`}
                                aria-invalid={Boolean(warning?.serial)}
                                title={warning?.serial || undefined}
                                value={draft.asset_serial_number}
                                disabled={rowDisabled}
                                onChange={(event) => patchDraft(launch.id, { asset_serial_number: event.target.value })}
                              />
                              <InlineFieldAlert message={warning?.serial ?? ""} className="leading-7" />
                            </div>
                          </td>
                          <td className="group/tracker px-2 py-2">
                            <div className="flex items-center gap-1 min-w-[92px] max-w-[100px] max-h-7">
                              {trackerLabel ? (
                                <Badge className="bg-primitive-neutral-800 text-primitive-neutral-0">{trackerLabel}</Badge>
                              ) : null}
                              {lockKind && fieldsEnabled ? (
                                <Badge className="bg-primitive-neutral-700 text-primitive-neutral-0">
                                  {lockKind === "archived"
                                    ? DICTIONARY.launches.labels.archived_status
                                    : DICTIONARY.launches.labels.reported_status}
                                </Badge>
                              ) : null}
                              {showTrackerClear ? <ClearTrackerButton onClick={() => clearTracker(launch.id)} /> : null}
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <div className="relative max-w-[200px]">
                              <Input
                                className={cn(
                                  "max-h-7 w-full text-md px-1.5",
                                  warning?.tracker && "border-primitive-red-500 pr-[75%]",
                                )}
                                tabIndex={draft.tracker_model_serial_number ? -1 : 0}
                                aria-label={`${columns.tracker_serial} ${launch.id}`}
                                aria-invalid={Boolean(warning?.tracker)}
                                title={warning?.tracker || undefined}
                                value={draft.tracker_model_serial_number}
                                disabled={rowDisabled}
                                onChange={(event) =>
                                  patchDraft(launch.id, { tracker_model_serial_number: event.target.value })
                                }
                              />
                              <InlineFieldAlert message={warning?.tracker ?? ""} className="leading-7" />
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <select
                              tabIndex={draft.ammo_model_id ? -1 : 0}
                              aria-label={`${columns.ammo} ${launch.id}`}
                              value={draft.ammo_model_id}
                              disabled={!canEditLaunchField(role, "ammo_model_id")}
                              onChange={(event) => {
                                const ammoId = event.target.value;
                                patchDraft(launch.id, { ammo_model_id: ammoId });
                                setAmmoOffer(
                                  ammoId && fieldsEnabled
                                    ? { launchId: launch.id, ammoId, anchor: event.currentTarget }
                                    : null,
                                );
                              }}
                              className={cn(selectClassName, "max-h-7 max-w-[100px]")}
                            >
                              <option value="">{DICTIONARY.launches.fields.select_ammo}</option>
                              {ammosForAsset(launch.asset_id, draft.ammo_model_id).map((ammo) => (
                                <option key={ammo.id} value={ammo.id}>
                                  {ammo.name}
                                </option>
                              ))}
                            </select>
                            {ammoOffer?.launchId === launch.id && !planningDisabled ? (
                              <AmmoApplyPopover
                                anchor={ammoOffer.anchor}
                                onApply={() => applyAmmoToAll(ammoOffer.ammoId)}
                                onClose={() => setAmmoOffer(null)}
                              />
                            ) : null}
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              data-error={!draft.ammo_quantity}
                              className="max-h-7 max-w-[100px]"
                              tabIndex={draft.ammo_quantity ? -1 : 0}
                              aria-label={`${columns.ammo_quantity} ${launch.id}`}
                              pattern="^[1-9][0-9]*$"
                              value={draft.ammo_quantity}
                              disabled={!canEditLaunchField(role, "ammo_quantity")}
                              onChange={(event) => patchDraft(launch.id, { ammo_quantity: extractNumeric(event.target.value)})}
                            />
                          </td>
                          <td className="px-2 py-2">
                            {!locked && canRemoveExcess && !rowLocked(stored) ? (
                              <DeleteIconButton
                                tabIndex={-1}
                                onClick={() => setPendingDeleteId(launch.id)}
                                disabled={rowDisabled}
                              />
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
  );

  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        {(() => {
          const groupByCrew = role === "DETACHMENT";
          const sectionMap = new Map<string, { id: string; point: (typeof aimingPoints)[number] | null; rows: Launch[] }>();
          launches.forEach((launch) => {
            const owner = battleGroups.find((item) => item.id === launch.battle_group_id);
            const point = resolveLaunchAimingPoint(task, launch, owner, aimingPoints) ?? null;
            const id = point?.id ?? "";
            const section = sectionMap.get(id) ?? { id, point, rows: [] };
            section.rows.push(launch);
            sectionMap.set(id, section);
          });
          const sections = [...sectionMap.values()].sort((left, right) => {
            if (!left.point) {
              return 1;
            }
            if (!right.point) {
              return -1;
            }
            return (left.point.displayed_id || left.point.name).localeCompare(right.point.displayed_id || right.point.name, "uk");
          });
          return (
            <>
              {battleGroups.map((group) => {
                const discrepancy = quantityDiscrepancy(group.uav_quantity, storedLaunches, group.id);
                return discrepancy ? (
                  <QuantityDiscrepancy key={group.id} planned={discrepancy.planned} actual={discrepancy.actual} />
                ) : null;
              })}
              {role === "CENTER"
                ? buildCenterLaunchTree(
                    launches,
                    battleGroups,
                    catalogTasks,
                    task,
                    aimingPoints,
                    catalogTargets,
                    target,
                  ).map((targetGroup) => {
                    const targetKey = `target:${targetGroup.key}`;
                    return (
                      <CollapseSection
                        key={targetKey}
                        sectionKey={targetKey}
                        open={sectionOpen(targetKey)}
                        depth={0}
                        onToggle={toggleClosedSection}
                        title={
                          targetGroup.target ? (
                            <TargetBadge
                              targetId={targetGroup.target.id}
                              mgrs={formattingMGRS.spacing(targetGroup.target.mgrs)}
                              label={targetGroup.target.name}
                              targetClasses="text-xs"
                              wrapperClasses="items-center"
                            />
                          ) : (
                            <span className="text-base font-medium">{target?.name ?? ""}</span>
                          )
                        }
                      >
                        {targetGroup.detachments.map((detachment) => {
                          const detachmentKey = `${targetKey}/detachment:${detachment.key}`;
                          return (
                            <CollapseSection
                              key={detachmentKey}
                              sectionKey={detachmentKey}
                              open={sectionOpen(detachmentKey)}
                              depth={1}
                              onToggle={toggleClosedSection}
                              title={<span className="text-base font-medium">{detachmentName(detachment.detachmentId)}</span>}
                            >
                              {detachment.assets.map((asset) => {
                                const assetKey = `${detachmentKey}/asset:${asset.key}`;
                                const assetRows = asset.crews.flatMap((crew) => crew.aiming.flatMap((point) => point.rows));
                                const assetProgress = countProcessed(assetRows);
                                return (
                                  <CollapseSection
                                    key={assetKey}
                                    sectionKey={assetKey}
                                    open={sectionOpen(assetKey)}
                                    depth={2}
                                    onToggle={toggleClosedSection}
                                    title={
                                      <ProgressBadge
                                        label={fillTemplate(DICTIONARY.launches.labels.asset_group, {
                                          asset: uavName(asset.assetId),
                                          quantity: asset.quantity,
                                        })}
                                        processed={assetProgress.processed}
                                        total={assetProgress.total}
                                        className="text-sm"
                                      />
                                    }
                                  >
                                    {asset.crews.map((crewGroup) => {
                                      const crewKey = `${assetKey}/crew:${crewGroup.key}`;
                                      const crewRows = crewGroup.aiming.flatMap((point) => point.rows);
                                      const crewProgress = countProcessed(crewRows);
                                      return (
                                        <CollapseSection
                                          key={crewKey}
                                          sectionKey={crewKey}
                                          open={sectionOpen(crewKey, false)}
                                          depth={3}
                                          onToggle={(key) => toggleClosedSection(key, false)}
                                          title={
                                            <div className="flex items-center gap-2">
                                              <BattleGroupCrewLine group={crewGroup.group} />
                                              <ProgressBadge
                                                label={`${crewProgress.processed} / ${crewProgress.total}`}
                                                processed={crewProgress.processed}
                                                total={crewProgress.total}
                                              />
                                            </div>
                                          }
                                        >
                                          {crewGroup.aiming.map((pointGroup) => {
                                            const pointKey = `${crewKey}/aiming:${pointGroup.key}`;
                                            const aimingLabel = formatStoredAimingPoint(
                                              pointGroup.point,
                                              targetGroup.target?.name ?? target?.name,
                                            );
                                            return (
                                              <CollapseSection
                                                key={pointKey}
                                                sectionKey={pointKey}
                                                open={sectionOpen(pointKey)}
                                                depth={4}
                                                onToggle={toggleClosedSection}
                                                title={<AimingPointBadge label={aimingLabel.label} mgrs={aimingLabel.badge} />}
                                              >
                                                {renderLaunchTable(pointGroup.rows)}
                                              </CollapseSection>
                                            );
                                          })}
                                        </CollapseSection>
                                      );
                                    })}
                                  </CollapseSection>
                                );
                              })}
                            </CollapseSection>
                          );
                        })}
                      </CollapseSection>
                    );
                  })
                : sections.map((section, index) => {
          const rows = section.rows;
          const aiming = formatStoredAimingPoint(section.point, target?.name);
          const crewTables = groupByCrew
            ? [...rows.reduce((buckets, launch) => {
                const owner = battleGroups.find((item) => item.id === launch.battle_group_id);
                const key = owner?.lead_crew_id || launch.battle_group_id;
                const bucket = buckets.get(key) ?? { key, group: owner, rows: [] as Launch[] };
                bucket.rows.push(launch);
                buckets.set(key, bucket);
                return buckets;
              }, new Map<string, { key: string; group: BattleGroup | undefined; rows: Launch[] }>()).values()].sort(
                (left, right) => (left.group?.lead_crew_id ?? left.key).localeCompare(right.group?.lead_crew_id ?? right.key, "uk"),
              )
            : [{ key: "all", group: undefined, rows }];
          return (
            <details open={openSections.has(section.id || "target") || index === 0} key={section.id || "target"} className="flex flex-col gap-2">
              <summary onClick={() => toggleOpenSection(section.id)} className="flex flex-wrap items-center justify-between gap-1 text-[20px] text-primitive-neutral-0 hover:cursor-pointer hover:shadow-md px-2 rounded-lg bg-primitive-neutral-800">
                <AimingPointBadge label={aiming.label} mgrs={aiming.badge} />
                <ChevronDown className={cn("h-4 w-4 transition-transform", !openSections.has(section.id || "target") ? "rotate-180" : "")} aria-hidden="true" />
              </summary>
              {crewTables.map((crew) => (
              <div key={crew.key} className="flex flex-col gap-2">
              {groupByCrew && crew.group ? <BattleGroupCrewLine group={crew.group} /> : null}
              {renderLaunchTable(crew.rows)}
              </div>
              ))}
            </details>
          );
              })}
            </>
          );
        })()}
        {fieldsEnabled ? (
          <div className="flex flex-col items-end gap-2">
            {publishError ? (
              <p role="alert" className="text-sm text-primitive-red-500">
                {publishError}
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                className="hover:cursor-pointer hover:shadow-md"
                disabled={isSubmitting}
                onClick={resetToBase}
              >
                {DICTIONARY.tasks.launch_board.reset_to_base}
              </Button>
              <Button
                className="hover:shadow-md"
                disabled={!isDirty || hasDuplicate || isSubmitting}
                onClick={() => void handleSave()}
              >
                {isSubmitting ? DICTIONARY.launches.buttons.publishing : DICTIONARY.common.actions.save}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      {pendingDeleteId ? (
        <Modal
          title={DICTIONARY.common.actions.delete}
          confirmLabel={DICTIONARY.common.actions.delete}
          onClose={() => setPendingDeleteId(null)}
          onConfirm={confirmDelete}
        >
          <p className="text-sm text-primitive-neutral-200">{DICTIONARY.launches.confirm_delete}</p>
        </Modal>
      ) : null}
    </div>
  );
}
