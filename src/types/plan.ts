import type { Launch, Mission, Task } from "@/types/database";

export type {
  AimingPointCode,
  Crew,
  Detachment,
  Launch,
  LaunchStatus,
  Mission,
  MissionPlan,
  MissionStatus,
  Platoon,
  Target,
  Task,
  TaskStatus,
} from "@/types/database";

export interface MissionPlanTree {
  mission: Mission | null;
  tasks: Task[];
  launches: Launch[];
}
