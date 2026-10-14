import { entityStatusBadgeStyle } from "@/components/reports/reportStatusBadge";
import { Badge } from "@/components/ui/badge";
import { DICTIONARY } from "@/constants/dictionary";
import type { EntityStatus } from "@/types/target";

export function EntityStatusBadge({ status }: { status: EntityStatus }) {
  return <Badge className="w-fit" style={entityStatusBadgeStyle(status)}>{DICTIONARY.common.states[status]}</Badge>;
}
