import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DICTIONARY } from "@/constants/dictionary";

export function ClearTrackerButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="icon"
      size="icon"
      title={DICTIONARY.launches.tracker.delete_tooltip}
      aria-label={DICTIONARY.launches.tracker.delete_tooltip}
      onClick={onClick}
      className="h-8 w-8 opacity-0 group-hover/tracker:opacity-100 focus-visible:opacity-100"
    >
      <X className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
