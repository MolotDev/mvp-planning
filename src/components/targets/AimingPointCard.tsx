import { ArchiveIconButton, PreviewIconButton, ResetIconButton } from "@/components/ui/icon-buttons";
import { AimingPointIdBadge, Badge } from "@/components/ui/badge";
import { EntityStatusBadge } from "@/components/ui/entity-status-badge";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { DICTIONARY } from "@/constants/dictionary";
import { getEntityState } from "@/lib/entityState";
import type { AimingPoint } from "@/types/target";
import { formattingMGRS } from "@/lib/formattingMGRS";

interface AimingPointCardProps {
  point: AimingPoint;
  onPreview: (point: AimingPoint) => void;
  onArchive: (point: AimingPoint) => void;
  onRestore: (point: AimingPoint) => void;
}

export function AimingPointCard({ point, onPreview, onArchive, onRestore }: AimingPointCardProps) {
  const isArchived = point.archived_at !== null;

  return (
    <Card
      className="min-w-0 hover:cursor-pointer"
      onClick={() => onPreview(point)}
    >
      <CardHeader>
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-medium text-primitive-neutral-200">{point.label}</span>
          <EntityStatusBadge status={getEntityState(point)} />
          <Badge
            className="bg-primitive-neutral-800 text-primitive-neutral-200"
            title={DICTIONARY.targets_catalog.mission_assigning}
          >
            0
          </Badge>
        </div>
        <div onClick={(event) => event.stopPropagation()}>
          <PreviewIconButton onClick={() => onPreview(point)} />
        </div>
      </CardHeader>
      <CardBody>
        <p className="line-clamp-2 text-sm flex items-center gap-1" title={`${point.displayed_id || point.label} — ${point.name}`}>
          <AimingPointIdBadge>{point.displayed_id || point.label}</AimingPointIdBadge>
          <span className="text-primitive-neutral-500"> — </span>
          <span className="text-primitive-neutral-0">{point.name}</span>
        </p>
        <p className="my-4 text-center text-base font-semibold tracking-wide text-primitive-neutral-0">
          {formattingMGRS.spacing(point.mgrs)}
        </p>
        <p className="text-sm text-primitive-neutral-300">
          {DICTIONARY.targets_catalog.feat_hgt}: {point.feat_hgt_msl} // {DICTIONARY.targets_catalog.agl}:{" "}
          {point.agl_msl}
        </p>
      </CardBody>
      <CardFooter>
        <div onClick={(event) => event.stopPropagation()}>
          {isArchived ? (
            <ResetIconButton onClick={() => onRestore(point)} />
          ) : (
            <ArchiveIconButton onClick={() => onArchive(point)} />
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
