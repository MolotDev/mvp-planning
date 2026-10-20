import { ArchiveIconButton, PreviewIconButton, ResetIconButton } from "@/components/ui/icon-buttons";
import { Badge, TargetIdBadge } from "@/components/ui/badge";
import { EntityStatusBadge } from "@/components/ui/entity-status-badge";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { DICTIONARY } from "@/constants/dictionary";
import { getEntityState } from "@/lib/entityState";
import { getActiveAimingPointCount } from "@/store/useTargetStore";
import { useTargetStore } from "@/store/useTargetStore";
import type { Target } from "@/types/target";
import { formattingMGRS } from "@/lib/formattingMGRS";

interface TargetCardProps {
  target: Target;
  onPreview: (target: Target) => void;
  onEdit: (target: Target) => void;
  onArchive: (target: Target) => void;
  onRestore: (target: Target) => void;
}

export function TargetCard({ target, onPreview, onArchive, onRestore }: TargetCardProps) {
  const aimingPoints = useTargetStore((state) => state.aimingPoints);
  const activePoints = getActiveAimingPointCount(aimingPoints, target.id);
  const location = `${target.name}, ${target.address}`;
  const isArchived = target.archived_at !== null;

  return (
    <Card
      className="hover:cursor-pointer"
      onClick={() => onPreview(target)}
    >
      <CardHeader>
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-medium text-primitive-neutral-200">{target.label}</span>
          <EntityStatusBadge status={getEntityState(target)} />
          <Badge
            className="bg-primitive-neutral-800 text-primitive-neutral-200"
            title={DICTIONARY.targets_catalog.mission_assigning}
          >
            0
          </Badge>
        </div>
        <div className="flex items-center" onClick={(event) => event.stopPropagation()}>
          <PreviewIconButton onClick={() => onPreview(target)} />
        </div>
      </CardHeader>
      <CardBody>
        <p className="h-10 line-clamp-2 text-sm text-primitive-neutral-0" title={location}>
          {location}
        </p>
        <Badge className="mt-2 w-fit bg-primitive-neutral-800 text-primitive-neutral-0">{target.type}</Badge>
        <p className="my-4 text-center text-lg font-semibold tracking-wide text-primitive-neutral-0">
          {formattingMGRS.spacing(target.mgrs)}
        </p>
        <p className="text-sm flex items-center gap-1">
          <TargetIdBadge>{target.displayed_id || target.label || "—"}</TargetIdBadge>
          <span className="text-primitive-neutral-500"> // </span>
          <Badge className="text-primitive-neutral-200">{target.distance_from_hot_line} {DICTIONARY.common.units.km}</Badge>
        </p>
      </CardBody>
      <CardFooter>
        <span className="text-sm text-primitive-neutral-300">
          {DICTIONARY.targets_catalog.aiming_points_count}: {activePoints}
        </span>
        <div onClick={(event) => event.stopPropagation()}>
          {isArchived ? (
            <ResetIconButton onClick={() => onRestore(target)} />
          ) : (
            <ArchiveIconButton onClick={() => onArchive(target)} />
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
