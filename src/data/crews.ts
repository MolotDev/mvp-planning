import type { Crew, Detachment, Platoon } from "@/types/battleGroup";

export const DETACHMENT_REFS: Detachment[] = [
  { id: "detachment_1", name: "1_Загін" },
  { id: "detachment_2", name: "2_Загін" },
  { id: "detachment_3", name: "3_Загін" },
];

export const PLATOONS: Platoon[] = [
  // 1-й Загін
  { id: "platoon_1_1", detachment_id: "detachment_1", name: "1-й Взвод" },
  { id: "platoon_1_2", detachment_id: "detachment_1", name: "2-й Взвод" },
  // 2-й Загін
  { id: "platoon_2_1", detachment_id: "detachment_2", name: "1-й Взвод" },
  { id: "platoon_2_2", detachment_id: "detachment_2", name: "2-й Взвод" },
  // 3-й Загін
  { id: "platoon_3_1", detachment_id: "detachment_3", name: "1-й Взвод" },
  { id: "platoon_3_2", detachment_id: "detachment_3", name: "2-й Взвод" },
];

export const CREWS: Crew[] = [
  // Загін 1, Взвод 1 (1.1.x)
  { id: "1.1.1", name: "1.1.1", organization_id: "detachment_1", platoon_id: "platoon_1_1", is_active: true },
  { id: "1.1.2", name: "1.1.2", organization_id: "detachment_1", platoon_id: "platoon_1_1", is_active: true },
  { id: "1.1.3", name: "1.1.3", organization_id: "detachment_1", platoon_id: "platoon_1_1", is_active: true },
  // Загін 1, Взвод 2 (1.2.x)
  { id: "1.2.1", name: "1.2.1", organization_id: "detachment_1", platoon_id: "platoon_1_2", is_active: true },
  { id: "1.2.2", name: "1.2.2", organization_id: "detachment_1", platoon_id: "platoon_1_2", is_active: true },
  { id: "1.2.3", name: "1.2.3", organization_id: "detachment_1", platoon_id: "platoon_1_2", is_active: true },

  // Загін 2, Взвод 1 (2.1.x)
  { id: "2.1.1", name: "2.1.1", organization_id: "detachment_2", platoon_id: "platoon_2_1", is_active: true },
  { id: "2.1.2", name: "2.1.2", organization_id: "detachment_2", platoon_id: "platoon_2_1", is_active: true },
  { id: "2.1.3", name: "2.1.3", organization_id: "detachment_2", platoon_id: "platoon_2_1", is_active: true },
  // Загін 2, Взвод 2 (2.2.x)
  { id: "2.2.1", name: "2.2.1", organization_id: "detachment_2", platoon_id: "platoon_2_2", is_active: true },
  { id: "2.2.2", name: "2.2.2", organization_id: "detachment_2", platoon_id: "platoon_2_2", is_active: true },
  { id: "2.2.3", name: "2.2.3", organization_id: "detachment_2", platoon_id: "platoon_2_2", is_active: true },

  // Загін 3, Взвод 1 (3.1.x)
  { id: "3.1.1", name: "3.1.1", organization_id: "detachment_3", platoon_id: "platoon_3_1", is_active: true },
  { id: "3.1.2", name: "3.1.2", organization_id: "detachment_3", platoon_id: "platoon_3_1", is_active: true },
  { id: "3.1.3", name: "3.1.3", organization_id: "detachment_3", platoon_id: "platoon_3_1", is_active: true },
  // Загін 3, Взвод 2 (3.2.x)
  { id: "3.2.1", name: "3.2.1", organization_id: "detachment_3", platoon_id: "platoon_3_2", is_active: true },
  { id: "3.2.2", name: "3.2.2", organization_id: "detachment_3", platoon_id: "platoon_3_2", is_active: true },
  { id: "3.2.3", name: "3.2.3", organization_id: "detachment_3", platoon_id: "platoon_3_2", is_active: true },
];

export function platoonsForOrganization(organizationId: string): Platoon[] {
  const detachment = DETACHMENT_REFS.find((item) => item.id === organizationId || item.name === organizationId);
  if (!detachment) {
    return PLATOONS;
  }
  return PLATOONS.filter((platoon) => platoon.detachment_id === detachment.id);
}

export function crewsForOrganization(organizationId: string): Crew[] {
  const detachment = DETACHMENT_REFS.find(
    (item) => item.id === organizationId || item.name === organizationId,
  );
  if (!detachment) {
    return CREWS;
  }
  return CREWS.filter((crew) => crew.organization_id === detachment.id);
}
