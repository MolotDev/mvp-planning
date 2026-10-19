import { useState } from "react";
import { ApplyBelowPopover } from "@/components/launches/ApplyBelowPopover";
import { InlineFieldAlert } from "@/components/launches/InlineFieldAlert";
import { AimingPointBadge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DeleteIconButton } from "@/components/ui/icon-buttons";
import { Modal } from "@/components/ui/modal";
import { DICTIONARY } from "@/constants/dictionary";
import { ammosForAsset, defaultAmmoId } from "@/lib/assets";
import { ammoName } from "@/lib/launches";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import { duplicateValueMessage, type LaunchSerialEntry } from "@/lib/taskCrewMatrix";
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

export interface LaunchAimingSection {
  id: string;
  label: string;
  mgrs: string;
  launchIds: string[];
}

interface LaunchDetailsModalProps {
  crewName: string;
  assetName: string;
  aimingName: string;
  launches: Launch[];
  sections: LaunchAimingSection[];
  entries: LaunchSerialEntry[];
  canEdit: boolean;
  lockedIds: ReadonlySet<string>;
  plannedQuantity: number;
  onClose: () => void;
}

const fieldClassName = "h-8 bg-primitive-neutral-950 px-2 text-xs";

function draftsFromLaunches(launches: Launch[]): LaunchDraft[] {
  return launches.map((launch) => ({
    id: launch.id,
    trajectory: launch.trajectory_name ?? "",
    serial: launch.asset_serial_number,
    tracker: launch.tracker_model_serial_number ?? "",
    ammoId: defaultAmmoId(launch.asset_id, launch.ammo_model_id),
  }));
}

export function LaunchDetailsModal({
  crewName,
  assetName,
  aimingName,
  launches,
  sections,
  entries,
  canEdit,
  lockedIds,
  plannedQuantity,
  onClose,
}: LaunchDetailsModalProps) {
  const text = DICTIONARY.tasks.details;
  const updateLaunch = useLaunchStore((state) => state.updateLaunch);
  const archiveLaunch = useLaunchStore((state) => state.archiveLaunch);
  const [drafts, setDrafts] = useState<LaunchDraft[]>(() => draftsFromLaunches(launches));
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [trajectoryOffer, setTrajectoryOffer] = useState<{ launchId: string; value: string; anchor: HTMLElement } | null>(null);
  const duplicateTemplates = { crew: text.crew_title };

  const liveEntries = entries.map((entry) => {
    const draft = drafts.find((item) => item.id === entry.id);
    if (!draft) {
      return entry;
    }
    return { ...entry, serial: draft.serial, tracker: draft.tracker || null };
  });

  const warnings = drafts.map((draft) => ({
    id: draft.id,
    serial: duplicateValueMessage(liveEntries, draft.id, "serial", draft.serial, {
      ...duplicateTemplates,
      duplicate: text.duplicate_serial,
    }),
    tracker: duplicateValueMessage(liveEntries, draft.id, "tracker", draft.tracker, {
      ...duplicateTemplates,
      duplicate: text.duplicate_tracker,
    }),
  }));
  const blocked = warnings.some((item) => !lockedIds.has(item.id) && (item.serial || item.tracker));
  const canRemoveExcess = canEdit && plannedQuantity > 0 && drafts.length > plannedQuantity;

  const patch = (id: string, next: Partial<LaunchDraft>) => {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, ...next } : draft)));
  };

  const applyTrajectoryBelow = () => {
    if (!trajectoryOffer) {
      return;
    }
    const orderedIds = (sections.length > 0 ? sections : [{ launchIds: drafts.map((draft) => draft.id) }]).flatMap(
      (section) => section.launchIds,
    );
    const below = new Set(orderedIds.slice(orderedIds.indexOf(trajectoryOffer.launchId) + 1));
    setDrafts((current) =>
      current.map((draft) =>
        below.has(draft.id) && !lockedIds.has(draft.id) ? { ...draft, trajectory: trajectoryOffer.value } : draft,
      ),
    );
    setTrajectoryOffer(null);
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) {
      return;
    }
    const removed = archiveLaunch(pendingDeleteId);
    if (!removed) {
      notifyError(text.launch_save_failed);
      return;
    }
    setDrafts((current) => current.filter((draft) => draft.id !== pendingDeleteId));
    notifySuccess(DICTIONARY.launches.toasts.deleted);
    setPendingDeleteId(null);
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
    <>
      <Modal
        className="max-w-4xl"
        title={fillTemplate(text.launch_modal_title, { crew: crewName, asset: assetName, target: aimingName })}
        confirmLabel={DICTIONARY.common.actions.save}
        confirmDisabled={blocked}
        showConfirm={canEdit}
        onClose={onClose}
        onConfirm={save}
      >
        <div className="flex flex-col gap-4">
          {(sections.length > 0 ? sections : [{ id: "all", label: "", mgrs: "", launchIds: drafts.map((draft) => draft.id) }]).map((section) => {
            const sectionDrafts = section.launchIds
              .map((id) => drafts.find((draft) => draft.id === id))
              .filter((draft): draft is LaunchDraft => Boolean(draft));
            return (
              <div key={section.id} className="flex flex-col gap-2">
                {section.label ? <AimingPointBadge label={section.label} mgrs={section.mgrs} /> : null}
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-primitive-neutral-800 text-xs text-primitive-neutral-400">
                <th scope="col" className="px-2 py-2 font-medium">{text.column_index}</th>
                <th scope="col" className="px-2 py-2 font-medium">{text.column_trajectory}</th>
                <th scope="col" className="px-2 py-2 font-medium">{text.column_serial_full}</th>
                <th scope="col" className="px-2 py-2 font-medium">{text.column_tracker}</th>
                <th scope="col" className="px-2 py-2 font-medium">{text.column_warhead}</th>
                {canRemoveExcess ? (
                  <th scope="col" className="px-2 py-2 font-medium">{DICTIONARY.tasks.launch_board.columns.actions}</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {sectionDrafts.map((draft, index) => {
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
                        onChange={(event) => {
                          const value = event.target.value;
                          patch(draft.id, { trajectory: value });
                          setTrajectoryOffer(
                            !locked && value.trim()
                              ? { launchId: draft.id, value, anchor: event.currentTarget }
                              : null,
                          );
                        }}
                        className={fieldClassName}
                      />
                      {trajectoryOffer?.launchId === draft.id && !locked ? (
                        <ApplyBelowPopover
                          anchor={trajectoryOffer.anchor}
                          label={DICTIONARY.tasks.launch_board.apply_to_listed_launches_below}
                          onApply={applyTrajectoryBelow}
                          onClose={() => setTrajectoryOffer(null)}
                        />
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <div className="relative">
                        <Input
                          aria-label={text.column_serial_full}
                          aria-invalid={Boolean(warning?.serial)}
                          title={warning?.serial || undefined}
                          value={draft.serial}
                          readOnly={locked}
                          onChange={(event) => patch(draft.id, { serial: event.target.value })}
                          className={cn(fieldClassName, warning?.serial && "border-primitive-red-500 pr-[75%]")}
                        />
                        <InlineFieldAlert message={warning?.serial ?? ""} />
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="relative">
                        <Input
                          aria-label={text.column_tracker}
                          aria-invalid={Boolean(warning?.tracker)}
                          title={warning?.tracker || undefined}
                          value={draft.tracker}
                          readOnly={locked}
                          onChange={(event) => patch(draft.id, { tracker: event.target.value })}
                          className={cn(fieldClassName, warning?.tracker && "border-primitive-red-500 pr-[75%]")}
                        />
                        <InlineFieldAlert message={warning?.tracker ?? ""} />
                      </div>
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
                    {canRemoveExcess ? (
                      <td className="px-2 py-2">
                        {locked ? null : <DeleteIconButton onClick={() => setPendingDeleteId(draft.id)} />}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
              </div>
            );
          })}
        </div>
      </Modal>
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
    </>
  );
}
