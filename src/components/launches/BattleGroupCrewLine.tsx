import { battleGroupCrewParts } from "@/lib/launchBoard";
import type { BattleGroup } from "@/types/battleGroup";
import { Users } from "lucide-react";

export function BattleGroupCrewLine({ group }: { group: BattleGroup | undefined }) {
  const { lead, support } = battleGroupCrewParts(group);
  return (
    <p className="flex flex-wrap items-baseline gap-2">
      <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="text-[16px] font-medium text-primitive-neutral-0">{lead}</span>
      {support.length > 0 ? (
        <span className="text-[14px] text-primitive-neutral-300">({support.join(", ")})</span>
      ) : null}
    </p>
  );
}
