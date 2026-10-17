import { useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { CancelChangesIconButton, DeleteIconButton, EditIconButton, SaveIconButton } from "@/components/ui/icon-buttons";
import { DICTIONARY } from "@/constants/dictionary";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import { conflictingLaunchIndex, type LaunchSerialEntry } from "@/lib/taskCrewMatrix";
import { notifyError, notifySuccess } from "@/lib/toasts";
import { cn } from "@/lib/utils";
import { useLaunchStore } from "@/store/useLaunchStore";
import type { Launch } from "@/types/launch";

interface TaskLaunchRowProps {
  launch: Launch;
  index: number;
  showActions: boolean;
  locked: boolean;
  editing: boolean;
  entries: LaunchSerialEntry[];
  onEdit: () => void;
  onClose: () => void;
  onDelete?: () => void;
}

const fieldClassName = "h-8 bg-primitive-neutral-950/90 px-2 text-xs bg-primitive-neutral-800 relative";

export function TaskLaunchRow({
  launch,
  index,
  showActions,
  locked,
  editing,
  entries,
  onEdit,
  onClose,
  onDelete,
}: TaskLaunchRowProps) {
  return (
    <tr className="border-b border-primitive-neutral-800">
      <td className="px-2 py-2 text-primitive-neutral-0">{`#${index}`}</td>
      {editing ? (
        <LaunchRowEditor launch={launch} entries={entries} onClose={onClose} />
      ) : (
        <>
          <td className={cn("px-2 py-2 text-primitive-neutral-0", !launch.trajectory_name && "text-red-600")}>
            <span>{launch.trajectory_name || "-"}</span>
          </td>
          <td className={cn("px-2 py-2 text-primitive-neutral-0", !launch.asset_serial_number && "text-red-600")}>
            <span>{launch.asset_serial_number.trim() || "-"}</span>
          </td>
          <td className="px-2 py-2">
            <span>{launch.tracker_model_serial_number || "-"}</span>
          </td>
          {showActions ? (
            <td className="px-2 py-2">
              <div className="flex items-center gap-1">
                <EditIconButton disabled={locked} onClick={onEdit} />
                {onDelete ? <DeleteIconButton disabled={locked} onClick={onDelete} /> : null}
              </div>
            </td>
          ) : null}
        </>
      )}
    </tr>
  );
}

function LaunchRowEditor({
  launch,
  entries,
  onClose,
}: {
  launch: Launch;
  entries: LaunchSerialEntry[];
  onClose: () => void;
}) {
  const updateLaunch = useLaunchStore((state) => state.updateLaunch);
  const text = DICTIONARY.tasks.details;
  const [trajectory, setTrajectory] = useState(launch.trajectory_name ?? "");
  const [serial, setSerial] = useState(launch.asset_serial_number);
  const [tracker, setTracker] = useState(launch.tracker_model_serial_number ?? "");
  const {index: serialConflict, crewName: serialCrewName} = conflictingLaunchIndex(entries, launch.id, "serial", serial);
  const {index: trackerConflict, crewName: trackerCrewName} = conflictingLaunchIndex(entries, launch.id, "tracker", tracker);

  const serialWarning =
    serialConflict === null
      ? ""
      : `${fillTemplate(text.duplicate_serial, { value: serial.trim(), index: serialConflict })} ${serialCrewName ? `Екіпаж (${serialCrewName})` : ""}`;
  const trackerWarning =
    trackerConflict === null
      ? ""
      : `${fillTemplate(text.duplicate_tracker, { value: tracker.trim(), index: trackerConflict })} ${trackerCrewName ? `Екіпаж (${trackerCrewName})` : ""}`;
  const blocked = Boolean(serialWarning || trackerWarning);

  const save = () => {
    if (blocked) {
      return;
    }
    const saved = updateLaunch(launch.id, {
      asset_serial_number: serial.trim(),
      tracker_model_serial_number: tracker.trim(),
      trajectory_name: trajectory.trim() || null,
    });
    if (!saved) {
      notifyError(text.launch_save_failed);
      return;
    }
    notifySuccess(text.launch_saved);
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <>
      <td className="px-2 py-2">
        <Input
          aria-label={text.column_trajectory}
          value={trajectory}
          onChange={(event) => setTrajectory(event.target.value)}
          onKeyDown={onKeyDown}
          className={fieldClassName}
        />
      </td>
      <td className="px-2 py-2 relative">
        <Input
          aria-label={text.column_serial}
          aria-invalid={Boolean(serialWarning)}
          title={serialWarning || undefined}
          value={serial}
          onChange={(event) => setSerial(event.target.value)}
          onKeyDown={onKeyDown}
          className={cn(fieldClassName, serialWarning && "border-red-600 focus:border-red-600")}
        />
        {serialWarning ? (
          <p role="alert" className="mt-1 text-xs text-red-600 absolute top-1 right-2 w-2/3">
            {serialWarning}
          </p>
        ) : null}
      </td>
      <td className="px-2 py-2 relative">
        <Input
          aria-label={text.column_tracker}
          aria-invalid={Boolean(trackerWarning)}
          title={trackerWarning || undefined}
          value={tracker}
          onChange={(event) => setTracker(event.target.value)}
          onKeyDown={onKeyDown}
          className={cn(fieldClassName, trackerWarning && "border-red-600 focus:border-red-600")}
        />
        {trackerWarning ? (
          <p role="alert" className="mt-1 text-xs text-red-600 absolute top-1 right-2 w-2/3">
            {trackerWarning}
          </p>
        ) : null}
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1">
          <SaveIconButton disabled={blocked} onClick={save} />
          <CancelChangesIconButton onClick={onClose} />
        </div>
      </td>
    </>
  );
}
