import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar } from "lucide-react";
import { BattleGroupCrewLine } from "@/components/launches/BattleGroupCrewLine";
import { ClearTrackerButton } from "@/components/launches/ClearTrackerButton";
import { Badge, TargetIdBadgeLink } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CloseIconButton, DeleteIconButton } from "@/components/ui/icon-buttons";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { TRACKERS } from "@/data/launchCatalog";
import { DICTIONARY } from "@/constants/dictionary";
import { canEditLaunchField, canEditLaunchFields } from "@/lib/access";
import { ammosForAsset } from "@/lib/assets";
import { uavName } from "@/lib/battleGroup";
import { formatDateUk } from "@/lib/dates";
import { isLaunchReadOnly, launchLockKind, processedTransitionPatch, trackerName } from "@/lib/launches";
import { notifyError, notifySuccess } from "@/lib/toasts";
import { useAuthStore } from "@/store/useAuthStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import type { BattleGroup, BattleGroupInput } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Mission, Task } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";
import { formattingMGRS } from "@/lib/formattingMGRS";
import { cn } from "@/lib/utils";
import { extractNumeric } from "@/lib/validation";

const selectClassName =
  "h-9 w-full min-w-[80px] rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-2 text-sm text-primitive-neutral-0 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

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
  updateBattleGroup: (id: string, input: BattleGroupInput) => void;
}

function defaultAmmoId(launch: Launch): string {
  if (launch.ammo_model_id) {
    return launch.ammo_model_id;
  }
  const options = ammosForAsset(launch.asset_id);
  return options.length === 1 ? options[0].id : "";
}

function draftFromLaunch(launch: Launch): RowDraft {
  return {
    aiming_point_mgrs: launch.aiming_point_mgrs,
    trajectory_name: launch.trajectory_name ?? "",
    asset_serial_number: launch.asset_serial_number,
    tracker_model_serial_number: launch.tracker_model_serial_number ?? "",
    ammo_model_id: defaultAmmoId(launch),
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

function ApplyPopover({
  anchor,
  label,
  onApply,
  onClose,
}: {
  anchor: HTMLElement;
  label: string;
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
      className="fixed z-[60] rounded-md border border-primitive-neutral-800 bg-primitive-neutral-900 p-2 shadow-md"
      style={{
        top: placeAbove ? box.top - 2 : box.bottom + 2,
        left: box.left,
        transform: placeAbove ? "translateY(-100%)" : undefined,
      }}
    >
      <div className="flex items-center gap-3">
        <Button className="h-5 px-1.5 text-[12px] leading-none hover:cursor-pointer hover:shadow-md" onClick={onApply}>
          {label}
        </Button>
        <CloseIconButton className="h-5 w-5" onClick={onClose} />
      </div>
    </div>,
    document.body,
  );
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
  updateBattleGroup,
}: LaunchEditorProps) {
  const role = useAuthStore((state) => state.role);
  const crewLimited = canEditLaunchFields(role);
  const updateLaunch = useLaunchStore((state) => state.updateLaunch);
  const archiveLaunch = useLaunchStore((state) => state.archiveLaunch);
  const storedLaunches = useLaunchStore((state) => state.launches);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteOfBattleGroup, setDeleteOfBattleGroup] = useState<BattleGroup | null>(null);
  const [baseDrafts, setBaseDrafts] = useState<Record<string, RowDraft>>(() =>
    Object.fromEntries(launches.map((launch) => [launch.id, draftFromLaunch(launch)])),
  );
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>(() => cloneDrafts(baseDrafts));
  const [ammoOffer, setAmmoOffer] = useState<{ launchId: string; ammoId: string; anchor: HTMLElement } | null>(null);
  const [trajectoryNameOffer, setTrajectoryNameOffer] = useState<{ launchId: string; value: string; anchor: HTMLElement } | null>(null);
  const isDirty = !draftsMatch(drafts, baseDrafts);
  const liveLaunch = (launch: Launch) => storedLaunches.find((item) => item.id === launch.id) ?? launch;
  const rowLocked = (launch: Launch) => locked || isLaunchReadOnly(liveLaunch(launch), task, mission ?? null);
  const fieldsEnabled = editing && !locked;
  const pointIds = new Set(task.allocations.map((line) => line.aiming_point_id).filter(Boolean));
  const points = aimingPoints.filter((point) => pointIds.has(point.id) && point.archived_at === null);
  const headingName = mission?.name?.trim() ? mission.name : (target?.name ?? "");
  const scheduledAt = task.scheduled_at || mission?.scheduled_at || task.created_at;
  const columns = DICTIONARY.tasks.launch_board.columns;

  const inheritedAiming = (draft: RowDraft) =>
    draft.aiming_point_mgrs.trim() || (points.length === 1 ? points[0].mgrs : "") || target?.mgrs || "";

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

  const handleSave = () => {
    let failed = false;
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
      }
    });
    if (failed) {
      notifyError(DICTIONARY.common.error);
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
    if (deleteOfBattleGroup) {
      updateBattleGroup(deleteOfBattleGroup.id, {
        ...deleteOfBattleGroup,
        uav_quantity: deleteOfBattleGroup.uav_quantity - 1,
      });
    }
    notifySuccess(DICTIONARY.launches.toasts.deleted);
    setPendingDeleteId(null);
    setDeleteOfBattleGroup(null);
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <p className="flex flex-wrap items-center gap-1 text-[20px] text-primitive-neutral-0">
          <Calendar className="h-5 w-5 shrink-0" aria-hidden="true" />
          <Badge className="bg-primitive-neutral-800 text-[20px]">{formatDateUk(scheduledAt)}</Badge>
          {headingName ? (
            <>
              <span>—</span>
              <span>{headingName}</span>
            </>
          ) : null}
        </p>
        {target ? (
          <div className="flex flex-wrap items-baseline gap-2 text-[16px] font-semibold">
            <TargetIdBadgeLink id={target.id}>{target.displayed_id || target.label}</TargetIdBadgeLink>
            <span className="text-primitive-neutral-0">{target.name}</span>
            <Badge className="bg-primitive-neutral-800 text-[16px] font-semibold tracking-wide text-primitive-neutral-0">
              {formattingMGRS.spacing(target.mgrs)}
            </Badge>
          </div>
        ) : null}
        {battleGroups.map((group) => {
          const rows = launches.filter((launch) => launch.battle_group_id === group.id);
          if (rows.length === 0) {
            return null;
          }
          return (
            <div key={group.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm text-primitive-neutral-300">{columns.battle_group}</span>
                <BattleGroupCrewLine group={group} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] border-collapse text-left text-sm">
                  <thead className="f-full text-primitive-neutral-300">
                    <tr>
                      <th className="px-2 py-1 font-medium">№ з.п</th>
                      <th className="px-2 py-1 font-medium">{columns.aiming_mgrs}</th>
                      <th className="px-2 py-1 font-medium">{DICTIONARY.launches.fields.trajectory_name}</th>
                      <th className="px-2 py-1 font-medium">{DICTIONARY.common.asset}</th>
                      {/* <th className="px-2 py-1 font-medium">{DICTIONARY.assets.fields.antenna}</th> */}
                      <th className="px-2 py-1 font-medium">{columns.uav_serial}</th>
                      <th className="px-2 py-1 font-medium">{columns.tracker}</th>
                      <th className="px-2 py-1 font-medium">{columns.tracker_serial}</th>
                      <th className="px-2 py-1 font-medium">{columns.ammo}</th>
                      <th className="px-2 py-1 font-medium">{columns.ammo_quantity}</th>
                      <th className="px-2 py-1 font-medium">{columns.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="f-full">
                    {rows.map((launch, index) => {
                      const stored = liveLaunch(launch);
                      const draft = drafts[launch.id];
                      const rowDisabled = !fieldsEnabled || rowLocked(stored);
                      const planningDisabled = rowDisabled || crewLimited;
                      const lockKind = launchLockKind(stored, task, mission ?? null);
                      const trackerId =
                        draft.tracker_model_serial_number.trim() && TRACKERS.length === 1 ? TRACKERS[0].id : null;
                      const trackerLabel = trackerName(trackerId);
                      const showTrackerClear =
                        !rowDisabled &&
                        (trackerLabel !== "" || draft.tracker_model_serial_number.trim() !== "");
                      return (
                        <tr key={launch.id} className="w-full border-t border-primitive-neutral-800">
                          <td className="text-center">
                            {index + 1}
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              aria-label={`${columns.aiming_mgrs} ${launch.id}`}
                              value={formattingMGRS.spacing(inheritedAiming(draft))}
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
                              <ApplyPopover
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
                          {/* <td className="px-2 py-2">
                            <select
                              aria-label={`${DICTIONARY.assets.fields.antenna} ${launch.id}`}
                              value={antennasForAsset(launch.asset_id)[0]?.id ?? ""}
                              disabled
                              className={cn(selectClassName, "max-h-7 max-w-[100px]")}
                            >
                              {antennasForAsset(launch.asset_id).map((antenna) => (
                                <option key={antenna.id} value={antenna.id}>
                                  {antenna.name}
                                </option>
                              ))}
                            </select>
                          </td> */}
                          <td className="px-2 py-2">
                            <Input
                              data-error={!draft.asset_serial_number.trim()}
                              className="max-h-7 max-w-[200px] text-md px-1.5"
                              tabIndex={draft.asset_serial_number ? -1 : 0}
                              aria-label={`${columns.uav_serial} ${launch.id}`}
                              value={draft.asset_serial_number}
                              disabled={rowDisabled}
                              onChange={(event) => patchDraft(launch.id, { asset_serial_number: event.target.value })}
                            />
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
                            <Input
                              className="max-h-7 max-w-[200px] text-md px-1.5"
                              tabIndex={draft.tracker_model_serial_number ? -1 : 0}
                              aria-label={`${columns.tracker_serial} ${launch.id}`}
                              value={draft.tracker_model_serial_number}
                              disabled={rowDisabled}
                              onChange={(event) =>
                                patchDraft(launch.id, { tracker_model_serial_number: event.target.value })
                              }
                            />
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
                            {!locked && !crewLimited && (
                              <DeleteIconButton tabIndex={-1} onClick={() => {
                                setPendingDeleteId(launch.id);
                                setDeleteOfBattleGroup(group);
                              }} disabled={rowDisabled} />
                            ) }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        {fieldsEnabled ? (
          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" className="hover:cursor-pointer hover:shadow-md" onClick={resetToBase}>
              {DICTIONARY.tasks.launch_board.reset_to_base}
            </Button>
            <Button className="hover:shadow-md" disabled={!isDirty} onClick={handleSave}>
              {DICTIONARY.common.actions.save}
            </Button>
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
