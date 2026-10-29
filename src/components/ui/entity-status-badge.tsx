import { entityStatusBadgeStyle } from "@/components/reports/reportStatusBadge";
import { Badge } from "@/components/ui/badge";
import { DICTIONARY } from "@/constants/dictionary";
import { cancellationBadgeClassName, cancellationBadgeStyle } from "@/lib/executionBadge";
import { isCancellationOutcome } from "@/lib/entityState";
import { cn } from "@/lib/utils";
import type { EntityStatus } from "@/types/target";

export function EntityStatusBadge({ status }: { status: EntityStatus }) {
  if (isCancellationOutcome(status)) {
    return (
      <Badge className={cn("w-full !rounded-md", cancellationBadgeClassName(status))} style={cancellationBadgeStyle(status)}>
        {DICTIONARY.common.states[status]}
      </Badge>
    );
  }
  return (
    <Badge className="w-full rounded-md" style={entityStatusBadgeStyle(status)}>
      {DICTIONARY.common.states[status]}
    </Badge>
  );
}
