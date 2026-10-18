import { useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { DICTIONARY } from "@/constants/dictionary";
import { DETACHMENT_REFS } from "@/data/crews";
import { crewWord, fillTemplate } from "@/lib/battleGroupCapacity";
import { launchesForLine } from "@/lib/missionDashboard";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Mission, Task } from "@/types/mission";

interface MissionLaunchMonitorProps {
  mission: Mission;
  tasks: Task[];
  groups: BattleGroup[];
  launches: Launch[];
}

export function MissionLaunchMonitor({ mission, tasks, groups, launches }: MissionLaunchMonitorProps) {
  const text = DICTIONARY.missions.command;
  const [openOrgId, setOpenOrgId] = useState<string | null>(null);
  const related = tasks.filter(
    (task) => task.archived_at === null && task.allocations.some((line) => line.mission_id === mission.id),
  );
  const orgIds = [...new Set(related.map((task) => task.organization_id))];
  const openTask = related.find((task) => task.organization_id === openOrgId);
  const openLaunches = openTask
    ? openTask.allocations
        .filter((line) => line.mission_id === mission.id)
        .flatMap((line) => launchesForLine(openTask, line, launches))
    : [];
  const openName = DETACHMENT_REFS.find((item) => item.id === openOrgId)?.name ?? openOrgId ?? "";

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 p-4">
      <h2 className="text-sm font-semibold text-primitive-neutral-0">{text.monitor_title}</h2>
      {orgIds.map((orgId) => {
        const orgTasks = related.filter((task) => task.organization_id === orgId);
        const orgLaunches = orgTasks.flatMap((task) =>
          task.allocations
            .filter((line) => line.mission_id === mission.id)
            .flatMap((line) => launchesForLine(task, line, launches)),
        );
        const crewIds = new Set(
          groups
            .filter(
              (group) =>
                group.archived_at === null && orgTasks.some((task) => task.id === group.task_id),
            )
            .map((group) => group.lead_crew_id),
        );
        const routes = [...new Set(orgLaunches.map((launch) => launch.trajectory_name?.trim() || "").filter(Boolean))];
        const trackers = orgLaunches.filter((launch) => Boolean(launch.tracker_model_serial_number?.trim())).length;
        const name = DETACHMENT_REFS.find((item) => item.id === orgId)?.name ?? orgId;
        return (
          <article key={orgId} className="flex flex-col gap-2 rounded-md border border-primitive-neutral-800 p-3">
            <p className="text-sm font-medium text-primitive-neutral-0">
              {fillTemplate(text.monitor_crews, { name, count: crewIds.size, crew_word: crewWord(crewIds.size) })}
            </p>
            <p className="text-sm text-primitive-neutral-200">
              {fillTemplate(text.monitor_metrics, {
                done: trackers,
                total: orgLaunches.length,
                routes: routes.join(", ") || DICTIONARY.tasks.details.empty_value,
              })}
            </p>
            <div className="flex justify-end">
              <Button variant="ghost" className="border border-primitive-neutral-700" onClick={() => setOpenOrgId(orgId)}>
                <Eye className="h-4 w-4" aria-hidden="true" />
                {text.open_launches}
              </Button>
            </div>
          </article>
        );
      })}
      {openOrgId ? (
        <Modal
          className="max-w-3xl"
          title={fillTemplate(text.launch_modal_title, { name: openName })}
          confirmLabel={DICTIONARY.common.actions.close}
          showConfirm={false}
          onClose={() => setOpenOrgId(null)}
          onConfirm={() => setOpenOrgId(null)}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-primitive-neutral-800 text-xs text-primitive-neutral-400">
                  <th scope="col" className="px-2 py-2 font-medium">{DICTIONARY.tasks.details.column_index}</th>
                  <th scope="col" className="px-2 py-2 font-medium">{DICTIONARY.tasks.details.column_trajectory}</th>
                  <th scope="col" className="px-2 py-2 font-medium">{DICTIONARY.tasks.details.column_serial_full}</th>
                  <th scope="col" className="px-2 py-2 font-medium">{DICTIONARY.tasks.details.column_tracker}</th>
                </tr>
              </thead>
              <tbody>
                {openLaunches.map((launch, index) => (
                  <tr key={launch.id} className="border-b border-primitive-neutral-800">
                    <td className="px-2 py-2 text-primitive-neutral-0">{index + 1}</td>
                    <td className="px-2 py-2 text-primitive-neutral-0">{launch.trajectory_name || DICTIONARY.tasks.details.empty_value}</td>
                    <td className="px-2 py-2 text-primitive-neutral-0">{launch.asset_serial_number.trim() || DICTIONARY.tasks.details.empty_value}</td>
                    <td className="px-2 py-2 text-primitive-neutral-0">{launch.tracker_model_serial_number || DICTIONARY.tasks.details.empty_value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
