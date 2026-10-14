import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "@/components/ui/modal";
import { AppDatePicker } from "@/components/ui/date-picker";
import { FormSelect } from "@/components/ui/form-select";
import { Label } from "@/components/ui/label";
import { DICTIONARY } from "@/constants/dictionary";
import { DETACHMENT_REFS } from "@/data/crews";
import { formatIsoDate } from "@/lib/dates";
import { notifySuccess, notifyWarning } from "@/lib/toasts";
import { useReportStore } from "@/store/useReportStore";

export function CreateReportModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const createManual = useReportStore((state) => state.createManual);
  const [organizationId, setOrganizationId] = useState("");
  const [date, setDate] = useState<Date | null>(null);
  const reportDate = date ? formatIsoDate(date) : "";
  const canCreate = Boolean(organizationId && reportDate);

  const submit = () => {
    if (!canCreate) {
      return;
    }
    const result = createManual(organizationId, reportDate);
    if (!result) {
      return;
    }
    if (result.created) {
      notifySuccess(DICTIONARY.reports.toasts.created);
    } else {
      notifyWarning(DICTIONARY.reports.toasts.already_exists);
    }
    onClose();
    navigate(`/reports/${result.report.id}?mode=edit`);
  };

  return (
    <Modal
      title={DICTIONARY.reports.modals.create.title}
      onClose={onClose}
      onConfirm={submit}
      confirmLabel={DICTIONARY.reports.modals.create.submit_button}
      confirmDisabled={!canCreate}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="report-detachment">{DICTIONARY.reports.modals.create.detachment_label}</Label>
          <FormSelect
            id="report-detachment"
            value={organizationId}
            placeholder={DICTIONARY.missions.select_detachment}
            options={DETACHMENT_REFS.map((detachment) => ({
              value: detachment.id,
              label: detachment.name,
            }))}
            onChange={setOrganizationId}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="report-date">{DICTIONARY.reports.modals.create.date_label}</Label>
          <AppDatePicker
            id="report-date"
            selected={date}
            onChange={setDate}
            placeholder={DICTIONARY.reports.date_filter}
          />
        </div>
      </div>
    </Modal>
  );
}
