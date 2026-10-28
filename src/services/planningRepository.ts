import { SEED_ASSETS } from "@/data/assetSeed";
import { CHECKPOINTS } from "@/data/checkpoints";
import {
  PRIMARY_AIMING_POINT,
  type AimingPointCode,
  type Crew,
  type Detachment,
  type Launch,
  type Mission,
  type MissionPlan,
  type Platoon,
  type Target,
  type Task,
} from "@/types/database";
import type { Asset } from "@/types/asset";

export const PLANNING_STORAGE_KEYS = {
  detachments: "ls_detachments",
  platoons: "ls_platoons",
  crews: "ls_crews",
  targets: "ls_targets",
  missions: "ls_missions",
  tasks: "ls_tasks",
  launches: "ls_launches",
  checkpoints: "ls_checkpoints",
  assets: "ls_assets",
  launchReports: "ls_launch_reports",
  checkpointReports: "ls_checkpoint_reports",
} as const;

const LEGACY_STORAGE_KEY = "military_crm_planning_mock";

export interface CheckpointCatalogItem {
  id: string;
  code: string;
  name: string;
  title: string;
  order: number;
}

export interface StoredLaunchReport {
  launch_id: string;
  task_id: string;
  battle_group_id: string;
  status: string | null;
  actual_launch_time: string | null;
  comments: string;
  reported_by_role: string;
  source_channel: string;
  reported_at: string;
  history: Array<{ status: string; time: string | null; reason: string; updated_by: string }>;
}

export interface StoredCheckpointReport {
  task_id: string;
  battle_group_id: string;
  checkpoint_id: string;
  code: string;
  title: string;
  status: string | null;
  fixed_time: string | null;
  comments: string;
  reported_at: string;
}

interface PlanningStore {
  detachments: Detachment[];
  platoons: Platoon[];
  crews: Crew[];
  targets: Target[];
  missions: Mission[];
  tasks: Task[];
  launches: Launch[];
}

const DETACHMENTS: Detachment[] = [
  { id: "1_Загін", name: "1_Загін" },
  { id: "2_Загін", name: "2_Загін" },
  { id: "3_Загін", name: "3_Загін" },
];

function seedPlatoons(): Platoon[] {
  return DETACHMENTS.flatMap((detachment) => {
    const prefix = detachment.id.slice(0, 1);
    return [1, 2].map((index) => ({
      id: `${prefix}.${index}`,
      detachment_id: detachment.id,
      name: index === 1 ? "1-й Взвод" : "2-й Взвод",
    }));
  });
}

function seedCrews(platoons: Platoon[]): Crew[] {
  return platoons.flatMap((platoon) =>
      [1, 2, 3].map((index) => ({
        id: `${platoon.id}.${index}`,
        organization_id: platoon.detachment_id,
        platoon_id: platoon.id,
        name: `${platoon.id}.${index}`,
        is_active: true,
      })),
    );
}

function emptyStore(): PlanningStore {
  const platoons = seedPlatoons();
  return {
    detachments: DETACHMENTS,
    platoons,
    crews: seedCrews(platoons),
    targets: [],
    missions: [],
    tasks: [],
    launches: [],
  };
}

function seedCheckpoints(): CheckpointCatalogItem[] {
  return CHECKPOINTS.map((checkpoint, index) => ({
    id: checkpoint.id,
    code: checkpoint.id,
    name: checkpoint.name,
    title: checkpoint.name,
    order: index,
  }));
}

function readList<T>(key: string, seed: T[]): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) {
    localStorage.setItem(key, JSON.stringify(seed));
    return seed.map((item) => ({ ...item }));
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : seed;
  } catch {
    localStorage.setItem(key, JSON.stringify(seed));
    return seed.map((item) => ({ ...item }));
  }
}

function writeList<T>(key: string, rows: T[]): void {
  localStorage.setItem(key, JSON.stringify(rows));
}

function migrateLegacyStore(): void {
  if (localStorage.getItem(PLANNING_STORAGE_KEYS.missions)) {
    return;
  }
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    return;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PlanningStore>;
    if (Array.isArray(parsed.missions)) {
      writeList(PLANNING_STORAGE_KEYS.missions, parsed.missions);
    }
    if (Array.isArray(parsed.tasks)) {
      writeList(PLANNING_STORAGE_KEYS.tasks, parsed.tasks);
    }
    if (Array.isArray(parsed.launches)) {
      writeList(PLANNING_STORAGE_KEYS.launches, parsed.launches);
    }
    if (Array.isArray(parsed.targets) && parsed.targets.length > 0) {
      writeList(PLANNING_STORAGE_KEYS.targets, parsed.targets);
    }
  } catch {
    return;
  }
}

function readStore(): PlanningStore {
  migrateLegacyStore();
  const base = emptyStore();
  return {
    detachments: readList(PLANNING_STORAGE_KEYS.detachments, base.detachments),
    platoons: readList(PLANNING_STORAGE_KEYS.platoons, base.platoons),
    crews: readList(PLANNING_STORAGE_KEYS.crews, base.crews),
    targets: readList(PLANNING_STORAGE_KEYS.targets, base.targets),
    missions: readList(PLANNING_STORAGE_KEYS.missions, base.missions),
    tasks: readList(PLANNING_STORAGE_KEYS.tasks, base.tasks),
    launches: readList(PLANNING_STORAGE_KEYS.launches, base.launches),
  };
}

function writeStore(store: PlanningStore): void {
  writeList(PLANNING_STORAGE_KEYS.detachments, store.detachments);
  writeList(PLANNING_STORAGE_KEYS.platoons, store.platoons);
  writeList(PLANNING_STORAGE_KEYS.crews, store.crews);
  writeList(PLANNING_STORAGE_KEYS.targets, store.targets);
  writeList(PLANNING_STORAGE_KEYS.missions, store.missions);
  writeList(PLANNING_STORAGE_KEYS.tasks, store.tasks);
  writeList(PLANNING_STORAGE_KEYS.launches, store.launches);
}

function upsert<T extends { id: string }>(rows: T[], row: T): T[] {
  const index = rows.findIndex((item) => item.id === row.id);
  if (index === -1) {
    return [...rows, row];
  }
  return rows.map((item) => (item.id === row.id ? row : item));
}

export function normalizeAimingPoint(value: string | null | undefined): AimingPointCode {
  if (value && /^MP\d{2}$/.test(value)) {
    const code = Number(value.slice(2));
    if (code >= 0 && code <= 99) {
      return value as AimingPointCode;
    }
  }
  return PRIMARY_AIMING_POINT;
}

function normalizeMission(mission: Mission): Mission {
  return {
    ...mission,
    name: mission.name?.trim() || null,
    notes: mission.notes?.trim() || null,
    scheduled_date: mission.scheduled_date.slice(0, 10),
  };
}

function normalizeTask(task: Task): Task {
  return {
    ...task,
    platoon_id: task.platoon_id,
    crew_id: task.crew_id,
    aiming_point: normalizeAimingPoint(task.aiming_point),
    planned_quantity: task.planned_quantity,
  };
}

function normalizeLaunch(launch: Launch): Launch {
  return {
    ...launch,
    aiming_point: normalizeAimingPoint(launch.aiming_point),
    asset_serial_number: launch.asset_serial_number?.trim() || null,
    tracker_model_id: launch.tracker_model_id,
    tracker_model_serial_number: launch.tracker_model_serial_number?.trim() || null,
    trajectory_name: launch.trajectory_name?.trim() || null,
    ammo_model_id: launch.ammo_model_id?.trim() || null,
    ammo_quantity: launch.ammo_quantity,
    comments: launch.comments?.trim() || null,
    cause_launch_problem_id: launch.cause_launch_problem_id?.trim() || null,
  };
}

export const planningRepository = {
  async listDetachments(): Promise<Detachment[]> {
    return readStore().detachments;
  },

  async listPlatoons(detachmentId?: string): Promise<Platoon[]> {
    const platoons = readStore().platoons;
    return detachmentId ? platoons.filter((platoon) => platoon.detachment_id === detachmentId) : platoons;
  },

  async listCrews(platoonId?: string): Promise<Crew[]> {
    const crews = readStore().crews.filter((crew) => crew.is_active);
    return platoonId ? crews.filter((crew) => crew.platoon_id === platoonId) : crews;
  },

  async listTargets(): Promise<Target[]> {
    return readStore().targets;
  },

  async saveTarget(target: Target): Promise<Target> {
    const store = readStore();
    const next = { ...target, address: target.address?.trim() || null, external_id: target.external_id };
    store.targets = upsert(store.targets, next);
    writeStore(store);
    return next;
  },

  async listMissions(): Promise<Mission[]> {
    return readStore().missions;
  },

  async getMission(id: string): Promise<Mission | null> {
    return readStore().missions.find((mission) => mission.id === id) ?? null;
  },

  async saveMission(mission: Mission): Promise<Mission> {
    const store = readStore();
    const next = normalizeMission(mission);
    store.missions = upsert(store.missions, next);
    writeStore(store);
    return next;
  },

  async listTasks(missionId?: string): Promise<Task[]> {
    const tasks = readStore().tasks;
    return missionId ? tasks.filter((task) => task.mission_id === missionId) : tasks;
  },

  async saveTask(task: Task): Promise<Task> {
    const store = readStore();
    const next = normalizeTask(task);
    store.tasks = upsert(store.tasks, next);
    writeStore(store);
    return next;
  },

  async listLaunches(taskId?: string): Promise<Launch[]> {
    const launches = readStore().launches;
    return taskId ? launches.filter((launch) => launch.task_id === taskId) : launches;
  },

  async saveLaunch(launch: Launch): Promise<Launch> {
    const store = readStore();
    const next = normalizeLaunch(launch);
    store.launches = upsert(store.launches, next);
    writeStore(store);
    return next;
  },

  async savePlan(plan: MissionPlan): Promise<MissionPlan> {
    const store = readStore();
    const mission = normalizeMission(plan.mission);
    const tasks = plan.tasks.map((task) => normalizeTask({ ...task, mission_id: mission.id }));
    const taskIds = new Set(tasks.map((task) => task.id));
    const previousTaskIds = new Set(store.tasks.filter((task) => task.mission_id === mission.id).map((task) => task.id));
    const launches = plan.launches
      .filter((launch) => taskIds.has(launch.task_id))
      .map((launch) => normalizeLaunch(launch));
    store.missions = upsert(store.missions, mission);
    store.tasks = [...store.tasks.filter((task) => task.mission_id !== mission.id), ...tasks];
    store.launches = [
      ...store.launches.filter((launch) => !previousTaskIds.has(launch.task_id) && !taskIds.has(launch.task_id)),
      ...launches,
    ];
    writeStore(store);
    return { mission, tasks, launches };
  },

  async loadPlan(missionId: string): Promise<MissionPlan | null> {
    const store = readStore();
    const mission = store.missions.find((item) => item.id === missionId);
    if (!mission) {
      return null;
    }
    const tasks = store.tasks.filter((task) => task.mission_id === missionId);
    const taskIds = new Set(tasks.map((task) => task.id));
    return {
      mission,
      tasks,
      launches: store.launches.filter((launch) => taskIds.has(launch.task_id)),
    };
  },

  async listCheckpoints(): Promise<CheckpointCatalogItem[]> {
    return readList(PLANNING_STORAGE_KEYS.checkpoints, seedCheckpoints());
  },

  async listAssets(): Promise<Asset[]> {
    return readList(PLANNING_STORAGE_KEYS.assets, SEED_ASSETS);
  },

  async listLaunchReports(): Promise<StoredLaunchReport[]> {
    return readList<StoredLaunchReport>(PLANNING_STORAGE_KEYS.launchReports, []);
  },

  async saveLaunchReports(rows: StoredLaunchReport[]): Promise<StoredLaunchReport[]> {
    const current = readList<StoredLaunchReport>(PLANNING_STORAGE_KEYS.launchReports, []);
    const next = [...current];
    for (const row of rows) {
      const index = next.findIndex((item) => item.launch_id === row.launch_id);
      if (index === -1) {
        next.push(row);
      } else {
        next[index] = row;
      }
    }
    writeList(PLANNING_STORAGE_KEYS.launchReports, next);
    return next;
  },

  async listCheckpointReports(): Promise<StoredCheckpointReport[]> {
    return readList<StoredCheckpointReport>(PLANNING_STORAGE_KEYS.checkpointReports, []);
  },

  async saveCheckpointReports(rows: StoredCheckpointReport[]): Promise<StoredCheckpointReport[]> {
    const current = readList<StoredCheckpointReport>(PLANNING_STORAGE_KEYS.checkpointReports, []);
    const next = [...current];
    for (const row of rows) {
      const index = next.findIndex(
        (item) =>
          item.task_id === row.task_id &&
          item.battle_group_id === row.battle_group_id &&
          item.checkpoint_id === row.checkpoint_id,
      );
      if (index === -1) {
        next.push(row);
      } else {
        next[index] = row;
      }
    }
    writeList(PLANNING_STORAGE_KEYS.checkpointReports, next);
    return next;
  },
};

export const mockPlanningService = planningRepository;
