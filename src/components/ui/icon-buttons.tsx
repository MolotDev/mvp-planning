import {
  Archive,
  ArrowLeft,
  Check,
  Eye,
  ListRestart,
  Pencil,
  RotateCcw,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DICTIONARY } from "@/constants/dictionary";
import { cn } from "@/lib/utils";

interface IconOnlyButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  tabIndex?: number;
}

function IconOnlyButton({
  title,
  icon: Icon,
  onClick,
  disabled,
  className,
  tabIndex
}: IconOnlyButtonProps & { title: string; icon: LucideIcon }) {
  return (
    <Button
      tabIndex={tabIndex}
      type="button"
      variant="icon"
      size="icon"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={cn("h-8 w-8 hover:shadow-md", className)}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}

export function GoBackIconButton(props: IconOnlyButtonProps) {
  return <IconOnlyButton title={DICTIONARY.common.actions.go_back} icon={ArrowLeft} {...props} />;
}

export function ArchiveIconButton(props: IconOnlyButtonProps) {
  return <IconOnlyButton title={DICTIONARY.common.actions.archive} icon={Archive} {...props} />;
}

export function ResetIconButton(props: IconOnlyButtonProps) {
  return <IconOnlyButton title={DICTIONARY.common.actions.restore} icon={RotateCcw} {...props} />;
}

export function EditIconButton({ title, ...props }: IconOnlyButtonProps) {
  return <IconOnlyButton title={title ?? DICTIONARY.common.actions.edit} icon={Pencil} {...props} />;
}

export function SaveIconButton(props: IconOnlyButtonProps) {
  return <IconOnlyButton title={DICTIONARY.common.actions.save} icon={Check} {...props} />;
}

export function CancelChangesIconButton(props: IconOnlyButtonProps) {
  return <IconOnlyButton title={DICTIONARY.tasks.launch_board.cancel_changes} icon={X} {...props} />;
}

export function PreviewIconButton(props: IconOnlyButtonProps) {
  return <IconOnlyButton title={DICTIONARY.common.actions.preview} icon={Eye} {...props} />;
}

export function CloseIconButton(props: IconOnlyButtonProps) {
  return <IconOnlyButton title={DICTIONARY.common.actions.close} icon={X} {...props} />;
}

export function DeleteIconButton(props: IconOnlyButtonProps) {
  return <IconOnlyButton tabIndex={props.tabIndex ?? 0} title={DICTIONARY.common.actions.delete} icon={Trash2} {...props} />;
}

export function ResetFiltersIconButton(props: IconOnlyButtonProps) {
  return <IconOnlyButton title={DICTIONARY.tasks.buttons.reset_filters} icon={ListRestart} {...props} />;
}
