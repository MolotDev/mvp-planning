export type CancellationOutcome =
  | "cancelled_before_exit"
  | "cancelled_without_launches"
  | "partially_completed";

export type CancellationInitiatorRole = "CENTER" | "DETACHMENT";

export interface CancellationMetadata {
  reason: string;
  initiator: string;
  initiator_role: CancellationInitiatorRole;
  cancel_time: string;
  cancelled_at: string;
  outcome: CancellationOutcome;
}
