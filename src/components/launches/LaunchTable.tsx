import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { BattleGroupCrewLine } from "@/components/launches/BattleGroupCrewLine";
import { HoverPopover } from "@/components/launches/HoverPopover";
import { Badge, TargetIdBadge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CancelChangesIconButton, DeleteIconButton, EditIconButton, SaveIconButton } from "@/components/ui/icon-buttons";
import { Modal } from "@/components/ui/modal";
import { TRACKERS } from "@/data/launchCatalog";
import { DICTIONARY } from "@/constants/dictionary";
import { canAdminister, canEditLaunchFields, crewOwnsGroup } from "@/lib/access";
import { ammosForAsset } from "@/lib/assets";
import { uavName } from "@/lib/battleGroup";
import { formatDateUk } from "@/lib/dates";
import type { LaunchRowContext } from "@/lib/launchBoard";
import { ammoName, isLaunchReadOnly, launchLockKind, processedTransitionPatch, trackerName } from "@/lib/launches";
import { notifyError, notifySuccess } from "@/lib/toasts";
import { useAuthStore } from "@/store/useAuthStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import type { Launch } from "@/types/launch";
import { extractNumeric } from "@/lib/validation";

interface RowDraft {
  aiming_point_mgrs: string;
  trajectory_name: string;
  asset_serial_number: string;
  tracker_model_serial_number: string;
  ammo_model_id: string;
  ammo_quantity: string;
}

function draftFromLaunch(launch: Launch): RowDraft {
  return {
    aiming_point_mgrs: launch.aiming_point_mgrs,
    trajectory_name: launch.trajectory_name ?? "",
    asset_serial_number: launch.asset_serial_number,
    tracker_model_serial_number: launch.tracker_model_serial_number ?? "",
    ammo_model_id:
      launch.ammo_model_id ||
      (ammosForAsset(launch.asset_id).length === 1 ? ammosForAsset(launch.asset_id)[0].id : ""),
    ammo_quantity: launch.ammo_quantity > 0 ? String(launch.ammo_quantity) : "1",
  };
}

function displayedAmmoQuantity(quantity: number): number {
  return quantity > 0 ? quantity : 1;
}

const selectClassName =
  "h-9 w-full min-w-[120px] rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-2 text-sm text-primitive-neutral-0 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

function EntityPopup({
  displayedId,
  name,
  mgrs,
  tone,
}: {
  displayedId: string;
  name: string;
  mgrs: string;
  tone: "target" | "aiming";
}) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Badge className={tone === "target" ? "font-semibold text-primitive-red-500" : "font-semibold text-primitive-blue-500"}>
        {displayedId}
      </Badge>
      <span className="text-sm text-primitive-neutral-0">{name}</span>
      <Badge className="bg-primitive-neutral-800 text-primitive-neutral-0">{mgrs}</Badge>
    </span>
  );
}

function popupForAiming(context: LaunchRowContext) {
  if (context.aimingPoint) {
    return (
      <EntityPopup
        displayedId={context.aimingPoint.displayed_id || context.aimingPoint.label || "—"}
        name={context.aimingPoint.name}
        mgrs={context.aimingPoint.mgrs}
        tone="aiming"
      />
    );
  }
  if (context.target) {
    return (
      <EntityPopup
        displayedId={context.target.displayed_id || context.target.label}
        name={context.target.name}
        mgrs={context.target.mgrs}
        tone="target"
      />
    );
  }
  return null;
}

function LaunchLockBadge({ kind, title }: { kind: "archived" | "reported"; title: string }) {
  const label =
    kind === "archived" ? DICTIONARY.launches.labels.archived_status : DICTIONARY.launches.labels.reported_status;
  return (
    <span className="inline-flex items-center gap-1" title={title}>
      <Lock className="h-4 w-4 text-primitive-neutral-300" aria-hidden="true" />
      <Badge
        className={
          kind === "archived"
            ? "bg-primitive-neutral-700 text-primitive-neutral-0"
            : "bg-primitive-blue-500/20 text-primitive-blue-500"
        }
      >
        {label}
      </Badge>
    </span>
  );
}

export function LaunchTable({ rows }: { rows: LaunchRowContext[] }) {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.role);
  const entityId = useAuthStore((state) => state.entityId);
  const crewEditor = canEditLaunchFields(role);
  const canDeleteLaunches = canAdminister(role, "launches");
  const updateLaunch = useLaunchStore((state) => state.updateLaunch);
  const archiveLaunch = useLaunchStore((state) => state.archiveLaunch);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RowDraft | null>(null);
  const [baseline, setBaseline] = useState<Launch | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Launch | null>(null);
  const trackerNotice = useRef<string | null>(null);
  const columns = DICTIONARY.tasks.launch_board.columns;

  const clearTracker = (launch: Launch) => {
    if (editingId === launch.id) {
      setDraft((current) => (current ? { ...current, tracker_model_serial_number: "" } : current));
      return;
    }
    if (trackerNotice.current === launch.id) {
      return;
    }
    const cleared = useLaunchStore.getState().clearLaunchTracker(launch.id);
    if (!cleared) {
      notifyError(DICTIONARY.common.error);
      return;
    }
    trackerNotice.current = launch.id;
    notifySuccess(DICTIONARY.launches.toasts.tracker_cleared);
  };

  const startEdit = (context: LaunchRowContext) => {
    if (isLaunchReadOnly(context.launch, context.task ?? null, context.mission ?? null)) {
      return;
    }
    if (baseline && baseline.id !== context.launch.id) {
      useLaunchStore.getState().restoreLaunch(baseline);
    }
    const current = useLaunchStore.getState().launches.find((item) => item.id === context.launch.id) ?? context.launch;
    trackerNotice.current = null;
    setEditingId(current.id);
    setDraft(draftFromLaunch(current));
    setBaseline({ ...current });
  };

  const cancelEdit = () => {
    if (baseline) {
      useLaunchStore.getState().restoreLaunch(baseline);
    }
    setEditingId(null);
    setDraft(null);
    setBaseline(null);
  };

  const changeDraft = (launch: Launch, patch: Partial<RowDraft>) => {
    if (!draft || editingId !== launch.id) {
      return;
    }
    if (
      patch.tracker_model_serial_number !== undefined &&
      patch.tracker_model_serial_number.trim() === "" &&
      draft.tracker_model_serial_number.trim() !== ""
    ) {
      setDraft({ ...draft, tracker_model_serial_number: "" });
      return;
    }
    const next = { ...draft, ...patch };
    setDraft(next);
    const stored = useLaunchStore.getState().launches.find((item) => item.id === launch.id) ?? launch;
    const transition = processedTransitionPatch(stored, next, 1);
    if (transition) {
      updateLaunch(launch.id, transition);
    }
  };

  const saveEdit = () => {
    if (!editingId || !draft) {
      return;
    }
    const quantity = draft.ammo_quantity.trim() === "" ? 1 : Number(draft.ammo_quantity);
    if (!Number.isFinite(quantity)) {
      notifyError(DICTIONARY.common.error);
      return;
    }
    const hadTracker = Boolean(baseline?.tracker_model_id?.trim() || baseline?.tracker_model_serial_number?.trim());
    const clearedTracker = hadTracker && draft.tracker_model_serial_number.trim() === "";
    const saved = updateLaunch(editingId, {
      aiming_point_mgrs: draft.aiming_point_mgrs.trim(),
      trajectory_name: draft.trajectory_name.trim() || null,
      asset_serial_number: draft.asset_serial_number,
      tracker_model_serial_number: draft.tracker_model_serial_number,
      ammo_model_id: draft.ammo_model_id,
      ammo_quantity: quantity,
    });
    if (!saved) {
      notifyError(DICTIONARY.common.error);
      return;
    }
    if (clearedTracker) {
      notifySuccess(DICTIONARY.launches.toasts.tracker_cleared);
    }
    setEditingId(null);
    setDraft(null);
    setBaseline(null);
  };

  const confirmDelete = () => {
    if (!pendingDelete) {
      return;
    }
    const removed = archiveLaunch(pendingDelete.id);
    if (!removed) {
      notifyError(DICTIONARY.common.error);
      return;
    }
    if (editingId === pendingDelete.id) {
      setEditingId(null);
      setDraft(null);
      setBaseline(null);
    }
    notifySuccess(DICTIONARY.launches.toasts.deleted);
    setPendingDelete(null);
  };

  return (
    <div className="min-w-[320px] overflow-x-auto rounded-lg border border-primitive-neutral-800">
      <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
        <thead className="bg-primitive-neutral-900 text-primitive-neutral-300">
          <tr>
            <th className="px-3 py-2 font-medium">{columns.date}</th>
            <th className="px-3 py-2 font-medium">{columns.battle_group}</th>
            <th className="px-3 py-2 font-medium">{columns.target_id}</th>
            <th className="px-3 py-2 font-medium">{columns.aiming_mgrs}</th>
            <th className="px-3 py-2 font-medium">{DICTIONARY.launches.fields.trajectory_name}</th>
            <th className="px-3 py-2 font-medium">{DICTIONARY.common.asset}</th>
            {/* <th className="px-3 py-2 font-medium">{DICTIONARY.assets.fields.antenna}</th> */}
            <th className="px-3 py-2 font-medium">{columns.uav_serial}</th>
            <th className="px-3 py-2 font-medium">{columns.tracker}</th>
            <th className="px-3 py-2 font-medium">{columns.tracker_serial}</th>
            <th className="px-3 py-2 font-medium">{columns.ammo}</th>
            <th className="px-3 py-2 font-medium">{columns.ammo_quantity}</th>
            <th className="px-3 py-2 font-medium">{columns.actions}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((context) => {
            const { launch, target, mission, task } = context;
            const editing = editingId === launch.id && draft !== null;
            const rowDraft = editing ? draft : null;
            const locked = isLaunchReadOnly(launch, task ?? null, mission ?? null);
            const lockKind = launchLockKind(launch, task ?? null, mission ?? null);
            const lockTitle =
              launch.archived_at !== null || launch.reported_at !== null
                ? lockKind === "archived"
                  ? DICTIONARY.launches.labels.archived_status
                  : DICTIONARY.launches.labels.reported_status
                : DICTIONARY.launches.labels.read_only_locked;
            const scheduledAt = mission?.scheduled_at ?? task?.created_at ?? launch.created_at;
            const trackerSerial = rowDraft?.tracker_model_serial_number ?? launch.tracker_model_serial_number ?? "";
            const trackerId = rowDraft
              ? trackerSerial.trim() && TRACKERS.length === 1
                ? TRACKERS[0].id
                : null
              : trackerSerial.trim() && TRACKERS.length === 1
                ? TRACKERS[0].id
                : launch.tracker_model_id;
            const trackerLabel = trackerName(trackerId);
            const rowOwned = crewOwnsGroup(context.battleGroup, entityId);
            const canEditRow = crewEditor && rowOwned && !locked;
            const showTrackerClear = editing && !locked && !crewEditor && rowDraft?.tracker_model_serial_number;
            const isShowFormFields = editing && !locked && rowDraft && canEditRow;
            const planningEditable = isShowFormFields && !crewEditor;
            return (
              <tr key={launch.id} className="border-t border-primitive-neutral-800">
                <td className="px-3 py-2 text-primitive-neutral-200">{formatDateUk(scheduledAt)}</td>
                <td className="px-3 py-2">
                  <BattleGroupCrewLine group={context.battleGroup} />
                </td>
                <td className="px-3 py-2">
                  {target ? (
                    <HoverPopover
                      content={
                        <EntityPopup
                          displayedId={target.displayed_id || target.label}
                          name={target.name}
                          mgrs={target.mgrs}
                          tone="target"
                        />
                      }
                    >
                      <button
                        type="button" 
                        onDoubleClick={() => {
                          if (target) {
                            navigate(`/catalogs/targets/${target.id}`);
                          }
                        }}
                      >
                        <TargetIdBadge className="text-md" id={target.id ?? "—"}>{target.displayed_id || target.label}</TargetIdBadge>
                      </button>
                    </HoverPopover>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  {isShowFormFields && rowDraft ? (
                    <Input
                      aria-label={`${columns.aiming_mgrs} ${launch.id}`}
                      value={rowDraft.aiming_point_mgrs.trim() || target?.mgrs || ""}
                      disabled
                      readOnly
                      className="h-9 max-w-[220px]"
                    />
                  ) : (
                    <HoverPopover content={popupForAiming(context)}>
                      <span className="text-sm text-primitive-neutral-200">
                        {launch.aiming_point_mgrs.trim() || target?.mgrs || ""}
                      </span>
                    </HoverPopover>
                  )}
                </td>
                <td className="px-3 py-2">
                  {isShowFormFields ? (
                    <Input
                      aria-label={`${DICTIONARY.launches.fields.trajectory_name} ${launch.id}`}
                      value={rowDraft.trajectory_name}
                      placeholder={DICTIONARY.launches.fields.trajectory_name_placeholder}
                      disabled={locked}
                      onChange={(event) => changeDraft(launch, { trajectory_name: event.target.value })}
                      className="h-9 max-w-[180px]"
                    />
                  ) : (
                    <span className="text-sm text-primitive-neutral-200">{launch.trajectory_name ?? ""}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-primitive-neutral-200">{uavName(launch.asset_id)}</td>
                {/* <td className="px-3 py-2">
                  <select
                    aria-label={`${DICTIONARY.assets.fields.antenna} ${launch.id}`}
                    value={antennasForAsset(launch.asset_id)[0]?.id ?? ""}
                    disabled
                    className={selectClassName}
                  >
                    {antennasForAsset(launch.asset_id).map((antenna) => (
                      <option key={antenna.id} value={antenna.id}>
                        {antenna.name}
                      </option>
                    ))}
                  </select>
                </td> */}
                <td className="px-3 py-2">
                  {isShowFormFields ? (
                    <Input
                      aria-label={`${columns.uav_serial} ${launch.id}`}
                      value={rowDraft.asset_serial_number}
                      disabled={locked}
                      onChange={(event) => changeDraft(launch, { asset_serial_number: event.target.value })}
                    />
                  ) : (
                    <span className="text-primitive-neutral-200">{launch.asset_serial_number}</span>
                  )}
                </td>
                <td className="group/tracker px-3 py-2">
                  <div className="flex items-center gap-1">
                    {trackerLabel ? (
                      <Badge className="bg-primitive-neutral-800 text-primitive-neutral-0">{trackerLabel}</Badge>
                    ) : null}
                    {showTrackerClear ? <DeleteIconButton onClick={() => clearTracker(launch)} /> : null}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {isShowFormFields ? (
                    <Input
                      aria-label={`${columns.tracker_serial} ${launch.id}`}
                      value={rowDraft.tracker_model_serial_number}
                      onChange={(event) => changeDraft(launch, { tracker_model_serial_number: event.target.value })}
                    />
                  ) : (
                    <span className="text-primitive-neutral-200">{trackerSerial}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {planningEditable ? (
                    <select
                      aria-label={`${columns.ammo} ${launch.id}`}
                      value={rowDraft.ammo_model_id}
                      disabled={locked}
                      onChange={(event) => changeDraft(launch, { ammo_model_id: event.target.value })}
                      className={selectClassName}
                    >
                      <option value="">{DICTIONARY.launches.fields.select_ammo}</option>
                      {ammosForAsset(launch.asset_id, rowDraft.ammo_model_id).map((ammo) => (
                        <option key={ammo.id} value={ammo.id}>
                          {ammo.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-primitive-neutral-200">{ammoName(launch.ammo_model_id)}</span>
                  )}
                </td>
                <td className="px-3 py-2 min-w-[80px] w-[80px]">
                  {planningEditable ? (
                    <Input
                      aria-label={`${columns.ammo_quantity} ${launch.id}`}
                      pattern="^[1-9][0-9]*$"
                      value={rowDraft.ammo_quantity}
                      disabled={locked}
                      onChange={(event) => changeDraft(launch, { ammo_quantity: extractNumeric(event.target.value) })}
                      className="px-2"
                    />
                  ) : (
                    <span className="text-primitive-neutral-200">{displayedAmmoQuantity(launch.ammo_quantity)}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-between gap-1">
                    {locked && lockKind ? (
                      <LaunchLockBadge kind={lockKind} title={lockTitle} />
                    ) : editing ? (
                      <>
                        <SaveIconButton onClick={saveEdit} />
                        <CancelChangesIconButton onClick={cancelEdit} />
                      </>
                    ) : canEditRow ? (
                      <EditIconButton onClick={() => startEdit(context)} />
                    ) : null}
                    {!locked && canDeleteLaunches && (
                      <DeleteIconButton onClick={() => setPendingDelete(launch)} />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {pendingDelete ? (
        <Modal
          title={DICTIONARY.common.actions.delete}
          confirmLabel={DICTIONARY.common.actions.delete}
          onClose={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        >
          <p className="text-sm text-primitive-neutral-200">{DICTIONARY.launches.confirm_delete}</p>
        </Modal>
      ) : null}
    </div>
  );
}
