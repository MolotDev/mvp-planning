import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PreviewActionButtonProps {
  label: string;
  onClick: () => void;
}

export function PreviewActionButton({ label, onClick }: PreviewActionButtonProps) {
  return (
    <Button variant="ghost" className="h-8 self-start px-2 hover:shadow-md" onClick={onClick}>
      <Eye className="h-4 w-4 mr-1" aria-hidden="true" />
      {label}
    </Button>
  );
}
