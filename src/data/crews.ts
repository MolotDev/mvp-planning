import type { Crew, Detachment } from "@/types/battleGroup";

export const DETACHMENT_REFS: Detachment[] = [
  { id: "detachment_1", name: "1-й Загін" },
  { id: "detachment_2", name: "2-й Загін" },
  { id: "detachment_3", name: "3-й Загін" },
];

export const CREWS: Crew[] = [
  { id: "1.1.1", name: "1.1.1", organization_id: "detachment_1" },
  { id: "1.1.2", name: "1.1.2", organization_id: "detachment_1" },
  { id: "1.1.3", name: "1.1.3", organization_id: "detachment_1" },
  { id: "2.1.1", name: "2.1.1", organization_id: "detachment_2" },
  { id: "2.1.2", name: "2.1.2", organization_id: "detachment_2" },
  { id: "2.1.3", name: "2.1.3", organization_id: "detachment_2" },
  { id: "3.1.1", name: "3.1.1", organization_id: "detachment_3" },
  { id: "3.1.2", name: "3.1.2", organization_id: "detachment_3" },
  { id: "3.1.3", name: "3.1.3", organization_id: "detachment_3" },
];

export function crewsForOrganization(organizationId: string): Crew[] {
  const detachment = DETACHMENT_REFS.find(
    (item) => item.id === organizationId || item.name === organizationId,
  );
  if (!detachment) {
    return CREWS;
  }
  return CREWS.filter((crew) => crew.organization_id === detachment.id);
}
