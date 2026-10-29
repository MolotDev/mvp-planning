import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DICTIONARY } from "@/constants/dictionary";
import { initiatorLabel } from "@/lib/missionCancellation";
import { DEFAULT_LAUNCH_TIME } from "@/lib/reportFormat";
import type { CancellationInitiatorRole } from "@/types/cancellation";

function currentHhMm(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

interface CancelMissionModalProps {
  role: CancellationInitiatorRole;
  onClose: () => void;
  onConfirm: (input: { cancelTime: string; reason: string }) => void;
}

export function CancelMissionModal({ role, onClose, onConfirm }: CancelMissionModalProps) {
  const text = DICTIONARY.common.cancellation;
  const [cancelTime, setCancelTime] = useState(currentHhMm);
  const [reason, setReason] = useState("");
  const initiator = useMemo(() => initiatorLabel(role), [role]);
  const reasonReady = reason.trim().length > 0;
  const timeReady = /^\d{2}:\d{2}$/.test(cancelTime.trim());

  return (
    <Modal
      title={text.title}
      onClose={onClose}
      onConfirm={() =>
        onConfirm({
          cancelTime: cancelTime.trim() || DEFAULT_LAUNCH_TIME,
          reason: reason.trim(),
        })
      }
      confirmLabel={text.confirm}
      confirmDisabled={!reasonReady || !timeReady}
      cancelLabel={DICTIONARY.common.actions.cancel}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>{text.initiator}</Label>
          <Input value={initiator} readOnly disabled className="disabled:opacity-80" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cancel-time">{text.cancel_time}</Label>
          <Input
            id="cancel-time"
            type="time"
            value={cancelTime}
            onChange={(event) => setCancelTime(event.target.value)}
            className="max-w-40"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cancel-reason">{text.reason}</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            placeholder={text.reason_placeholder}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
          />
        </div>
      </div>
    </Modal>
  );
}
