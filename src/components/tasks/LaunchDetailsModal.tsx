import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { DICTIONARY } from "@/constants/dictionary";
import { ammosForAsset } from "@/lib/assets";
import { ammoName } from "@/lib/launches";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import { conflictingLaunchIndex, type LaunchSerialEntry } from "@/lib/taskCrewMatrix";
import { notifyError, notifySuccess } from "@/lib/toasts";
import { cn } from "@/lib/utils";
import { useLaunchStore } from "@/store/useLaunchStore";
import type { Launch } from "@/types/launch";

interface LaunchDraft {
  id: string;
  trajectory: string;
  serial: string;
  tracker: string;
  ammoId: string;
}

interface LaunchDetailsModalProps {
  crewName: string;
  assetName: string;
  aimingName: string;
  launches: Launch[];
  entries: LaunchSerialEntry[];
  canEdit: boolean;
  lockedIds: ReadonlySet<string>;
  onClose: () => void;
}

const fieldClassName = "h-8 bg-primitive-neutral-950 px-2 text-xs";

function draftsFromLaunches(launches: Launch[]): LaunchDraft[] {
  return launches.map((launch) => ({
    id: launch.id,
    trajectory: launch.trajectory_name ?? "",
    serial: launch.asset_serial_number,
    tracker: launch.tracker_model_serial_number ?? "",
    ammoId: launch.ammo_model_id,
  }));
}

export function LaunchDetailsModal({
  crewName,
  assetName,
  aimingName,
  launches,
  entries,
  canEdit,
  lockedIds,
  onClose,
}: LaunchDetailsModalProps) {
  const text = DICTIONARY.tasks.details;
  const updateLaunch = useLaunchStore((state) => state.updateLaunch);
  const [drafts, setDrafts] = useState<LaunchDraft[]>(() => draftsFromLaunches(launches));

  const liveEntries = entries.map((entry) => {
    const draft = drafts.find((item) => item.id === entry.id);
    if (!draft) {
      return entry;
    }
    return { ...entry, serial: draft.serial, tracker: draft.tracker || null };
  });

  const warnings = drafts.map((draft) => {
    const serial = conflictingLaunchIndex(liveEntries, draft.id, "serial", draft.serial);
    const tracker = conflictingLaunchIndex(liveEntries, draft.id, "tracker", draft.tracker);
    return {
      id: draft.id,
      serial:
        serial.index === null
          ? ""
          : `${fillTemplate(text.duplicate_serial, { value: draft.serial.trim(), index: serial.index })} ${serial.crewName ? fillTemplate(text.crew_title, { name: serial.crewName }) : ""}`.trim(),
      tracker:
        tracker.index === null
          ? ""
          : `${fillTemplate(text.duplicate_tracker, { value: draft.tracker.trim(), index: tracker.index })} ${tracker.crewName ? fillTemplate(text.crew_title, { name: tracker.crewName }) : ""}`.trim(),
    };
  });
  const blocked = warnings.some((item) => !lockedIds.has(item.id) && (item.serial || item.tracker));

  const patch = (id: string, next: Partial<LaunchDraft>) => {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, ...next } : draft)));
  };

  const save = () => {
    if (!canEdit || blocked) {
      return;
    }
    for (const draft of drafts) {
      if (lockedIds.has(draft.id)) {
        continue;
      }
      const launch = launches.find((item) => item.id === draft.id);
      if (!launch) {
        continue;
      }
      const saved = updateLaunch(draft.id, {
        trajectory_name: draft.trajectory.trim() || null,
        asset_serial_number: draft.serial.trim(),
        tracker_model_serial_number: draft.tracker.trim(),
        ammo_model_id: draft.ammoId,
      });
      if (!saved) {
        notifyError(text.launch_save_failed);
        return;
      }
    }
    notifySuccess(text.launch_saved);
    onClose();
  };

  return (
    <Modal
      className="max-w-4xl"
      title={fillTemplate(text.launch_modal_title, { crew: crewName, asset: assetName, target: aimingName })}
      confirmLabel={DICTIONARY.common.actions.save}
      confirmDisabled={blocked}
      showConfirm={canEdit}
      onClose={onClose}
      onConfirm={save}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-primitive-neutral-800 text-xs text-primitive-neutral-400">
              <th scope="col" className="px-2 py-2 font-medium">{text.column_index}</th>
              <th scope="col" className="px-2 py-2 font-medium">{text.column_trajectory}</th>
              <th scope="col" className="px-2 py-2 font-medium">{text.column_serial_full}</th>
              <th scope="col" className="px-2 py-2 font-medium">{text.column_tracker}</th>
              <th scope="col" className="px-2 py-2 font-medium">{text.column_warhead}</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((draft, index) => {
              const launch = launches.find((item) => item.id === draft.id);
              const warning = warnings.find((item) => item.id === draft.id);
              const locked = !canEdit || lockedIds.has(draft.id);
              const ammoOptions = ammosForAsset(launch?.asset_id ?? "", draft.ammoId);
              return (
                <tr key={draft.id} className="border-b border-primitive-neutral-800 align-top">
                  <td className="px-2 py-2 text-primitive-neutral-0">{index + 1}</td>
                  <td className="px-2 py-2">
                    <Input
                      aria-label={text.column_trajectory}
                      value={draft.trajectory}
                      readOnly={locked}
                      onChange={(event) => patch(draft.id, { trajectory: event.target.value })}
                      className={fieldClassName}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      aria-label={text.column_serial_full}
                      aria-invalid={Boolean(warning?.serial)}
                      title={warning?.serial || undefined}
                      value={draft.serial}
                      readOnly={locked}
                      onChange={(event) => patch(draft.id, { serial: event.target.value })}
                      className={cn(fieldClassName, warning?.serial && "border-primitive-red-500")}
                    />
                    {warning?.serial ? <p role="alert" className="mt-1 text-xs text-primitive-red-500">{warning.serial}</p> : null}
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      aria-label={text.column_tracker}
                      aria-invalid={Boolean(warning?.tracker)}
                      title={warning?.tracker || undefined}
                      value={draft.tracker}
                      readOnly={locked}
                      onChange={(event) => patch(draft.id, { tracker: event.target.value })}
                      className={cn(fieldClassName, warning?.tracker && "border-primitive-red-500")}
                    />
                    {warning?.tracker ? <p role="alert" className="mt-1 text-xs text-primitive-red-500">{warning.tracker}</p> : null}
                  </td>
                  <td className="px-2 py-2">
                    {locked ? (
                      <span className="text-primitive-neutral-0">{ammoName(draft.ammoId) || text.empty_value}</span>
                    ) : (
                      <select
                        aria-label={text.column_warhead}
                        value={draft.ammoId}
                        onChange={(event) => patch(draft.id, { ammoId: event.target.value })}
                        className="h-8 w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-2 text-xs text-primitive-neutral-0 hover:cursor-pointer hover:shadow-md"
                      >
                        <option value="">{DICTIONARY.launches.fields.select_ammo}</option>
                        {ammoOptions.map((ammo) => (
                          <option key={ammo.id} value={ammo.id}>
                            {ammo.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
