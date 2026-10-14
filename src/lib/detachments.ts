import { DETACHMENT_REFS } from "@/data/crews";

export function detachmentName(id: string): string {
  return DETACHMENT_REFS.find((detachment) => detachment.id === id)?.name ?? id;
}

export function detachmentId(value: string): string {
  if (!value) {
    return "";
  }
  return DETACHMENT_REFS.find((detachment) => detachment.id === value || detachment.name === value)?.id ?? value;
}

export function sameDetachment(left: string, right: string): boolean {
  if (!left || !right) {
    return false;
  }
  return detachmentId(left) === detachmentId(right);
}