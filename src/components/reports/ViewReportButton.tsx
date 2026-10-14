import { Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DICTIONARY } from "@/constants/dictionary";
import { matchingReports } from "@/lib/reportAggregation";
import { useMissionStore } from "@/store/useMissionStore";
import { useReportStore } from "@/store/useReportStore";
import { detachmentName } from "@/lib/detachments";

export function ViewReportButton({ reportId, detachmentName }: { reportId: string, detachmentName: string }) {
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      className="h-8 self-end px-2"
      onClick={(event) => {
        event.stopPropagation();
        navigate(`/reports/${reportId}`);
      }}
    >
      <Eye className="h-4 w-4" aria-hidden="true" />
      {`${DICTIONARY.common.report} - ${detachmentName}`}
    </Button>
  );
}

export function ViewReportButtons({
  organizationIds,
  scheduledAt,
  missionId,
}: {
  organizationIds: string[];
  scheduledAt?: string | null;
  missionId?: string;
}) {
  const reports = useReportStore((state) => state.reports);
  const missionDate = useMissionStore((state) =>
    missionId ? (state.missions.find((mission) => mission.id === missionId)?.scheduled_at ?? null) : null,
  );
  const matches = matchingReports(reports, organizationIds, scheduledAt ?? missionDate);
  if (matches.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {matches.map((report) => (
        <ViewReportButton key={report.id} reportId={report.id} detachmentName={detachmentName(report.organization_id)} />
      ))}
    </div>
  );
}
