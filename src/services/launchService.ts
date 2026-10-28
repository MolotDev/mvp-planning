import { saveCompleteMissionPlan, updateSingleLaunch } from "@/services/planSyncService";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useTaskStore } from "@/store/useTaskStore";
import type { Launch } from "@/types/launch";
import { Mission } from "@/types/mission";

export interface LaunchPublishResult {
  ok: boolean;
  message?: string;
}

export async function publishLaunchesToSupabase(launches: Launch[]): Promise<LaunchPublishResult> {
  if (launches.length === 0) {
    return { ok: true };
  }

  const tasks = useTaskStore.getState().tasks;
  const missions = useMissionStore.getState().missions;
  const groups = useBattleGroupStore.getState().battleGroups;
  const byMission = new Map<string, Launch[]>();
  const launchPromises: Promise<LaunchPublishResult>[] = [];
  for (const launch of launches) {
    const task = tasks.find((item) => item.id === launch.task_id);
    const missionId = task?.mission_id || task?.allocations[0]?.mission_id || "";
    const bucket = byMission.get(missionId) ?? [];
    bucket.push(launch);
    byMission.set(missionId, bucket);
    // launchPromises.push(updateSingleLaunch(launch.id, launch));
  }
  // const results = await Promise.all(launchPromises);
  // if (results.some((result) => !result.ok)) {
  //   return { ok: false, message: "Не вдалося оновити пуски в Supabase." };
  // }
  // return { ok: true };і

  for (const [missionId, missionLaunches] of byMission) {
    const mission = resolveMission(missions, missionId, missionLaunches);
    if (!mission) {
      const message = "Не знайдено місію для збереження плану.";
      console.error("Не вдалося зберегти план місії в Supabase:", message);
      return { ok: false, message };
    }
    const taskIds = new Set(missionLaunches.map((launch) => launch.task_id));
    
    const result = await saveCompleteMissionPlan({
      mission,
      tasks: tasks.filter((task) => taskIds.has(task.id)),
      battleGroups: groups.filter((group) => taskIds.has(group.task_id)),
      launches: missionLaunches,
    });
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
  }

  return { ok: true };
}

function resolveMission(missions: Mission[], missionId: string, launches: Launch[]): Mission | null {
  const stored = missions.find((mission) => mission.id === missionId);
  if (stored) {
    return stored;
  }
  const taskIds = launches.map((launch) => launch.task_id);
  return missions.find((mission) => mission.task_ids.some((taskId) => taskIds.includes(taskId))) ?? null;
}
