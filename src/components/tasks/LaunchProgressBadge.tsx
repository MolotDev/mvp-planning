import { Badge } from "@/components/ui/badge";
import { DICTIONARY } from "@/constants/dictionary";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import { countProcessedLaunches } from "@/lib/launches";
import type { Launch } from "@/types/launch";

export function LaunchProgressBadge({ launches }: { launches: Launch[] }) {
  const { processed, total } = countProcessedLaunches(launches);
  const status = !processed || !total ? "error" : processed === total ? "success" : "warning";
  return (
    <Badge className="progress-badge" data-status={status}>
      {fillTemplate(DICTIONARY.tasks.launches_processed, { processed, total })}
    </Badge>
  );
}
