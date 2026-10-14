import { LaunchProgressBadge } from "@/components/tasks/LaunchProgressBadge";
import { Badge } from "@/components/ui/badge";
import { DICTIONARY } from "@/constants/dictionary";
import { crewName, formatBattleGroupSummary, uavName } from "@/lib/battleGroup";
import { useLaunchStore } from "@/store/useLaunchStore";
import type { BattleGroup } from "@/types/battleGroup";

interface BattleGroupSummaryProps {
  group: BattleGroup;
}

export function BattleGroupSummary({ group }: BattleGroupSummaryProps) {
  const support = group.support_crew_ids.map(crewName);
  const summary = formatBattleGroupSummary(group);
  const assetLabel = `${group.uav_quantity} * ${uavName(group.asset_id)}`;

  return (
    <p className="flex flex-wrap items-baseline gap-2" title={summary}>
      <span className="text-[18px] font-semibold text-primitive-neutral-0">{crewName(group.lead_crew_id)}</span>
      {support.length > 0 ? (
        <span className="text-[12px] text-primitive-neutral-300">({support.join(", ")})</span>
      ) : null}
      <Badge className="bg-primitive-neutral-800 text-primitive-neutral-0">{assetLabel}</Badge>
    </p>
  );
}

interface BattleGroupSummaryListProps {
  groups: BattleGroup[];
  showProgress?: boolean;
}

export function BattleGroupSummaryList({ groups, showProgress = false }: BattleGroupSummaryListProps) {
  const launches = useLaunchStore((state) => state.launches);
  if (groups.length === 0) {
    return (
      <Badge className="w-fit bg-primitive-red-500/20 font-medium text-primitive-red-500">
        {DICTIONARY.tasks.no_crews_assigned}
      </Badge>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-1">
          <BattleGroupSummary group={group} />
          {showProgress ? (
            <LaunchProgressBadge
              launches={launches.filter((launch) => launch.battle_group_id === group.id)}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
