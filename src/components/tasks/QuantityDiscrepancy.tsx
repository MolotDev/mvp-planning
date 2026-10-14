import { Badge } from "@/components/ui/badge";
import { DICTIONARY } from "@/constants/dictionary";
import { fillTemplate } from "@/lib/battleGroupCapacity";

interface QuantityDiscrepancyProps {
  planned: number;
  actual: number;
}

export function QuantityDiscrepancy({ planned, actual }: QuantityDiscrepancyProps) {
  return (
    <Badge role="alert" className="w-fit bg-primitive-red-500/20 font-medium text-primitive-red-500">
      {fillTemplate(DICTIONARY.tasks.discrepancy_error, { planned, actual })}
    </Badge>
  );
}
