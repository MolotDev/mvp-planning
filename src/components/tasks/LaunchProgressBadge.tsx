import { Badge } from "@/components/ui/badge";
import { DICTIONARY } from "@/constants/dictionary";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import { countProcessedLaunches } from "@/lib/launches";
import { cn } from "@/lib/utils";
import type { Launch } from "@/types/launch";

export function LaunchProgressBadge({ launches }: { launches: Launch[] }) {
  const { processed, total } = countProcessedLaunches(launches);
  return (
    <Badge className={cn("w-fit text-primitive-neutral-0", processed === total ? "bg-primitive-neutral-800" : "bg-primitive-red-500/20 text-primitive-red-500")}>
      {fillTemplate(DICTIONARY.tasks.launches_processed, { processed, total })}
    </Badge>
  );
}
