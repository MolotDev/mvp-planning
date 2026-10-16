import { type ReactNode } from "react";
import { CloseIconButton } from "@/components/ui/icon-buttons";
import { Button } from "@/components/ui/button";
import { DICTIONARY } from "@/constants/dictionary";
import { cn } from "@/lib/utils";

interface ModalProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmDisabled?: boolean;
  showConfirm?: boolean;
  cancelLabel?: string;
  footerStart?: ReactNode;
  headerExtra?: ReactNode;
  className?: string;
}

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  onConfirm,
  confirmLabel,
  confirmDisabled = false,
  showConfirm = true,
  cancelLabel = DICTIONARY.common.actions.cancel,
  footerStart,
  headerExtra,
  className,
}: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="presentation">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 shadow-lg",
          className,
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-primitive-neutral-800 px-4 py-3">
          <h2 id="modal-title" className="min-w-0 flex-1 text-base font-semibold text-primitive-neutral-0">
            {title}
            {subtitle ? (
              <span className="ml-2 font-normal text-primitive-neutral-300">{subtitle}</span>
            ) : null}
          </h2>
          {headerExtra}
          <CloseIconButton onClick={onClose} />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        <footer
          className={cn(
            "flex items-center gap-3 border-t border-primitive-neutral-800 px-4 py-3",
            footerStart ? "justify-between" : "justify-end",
          )}
        >
          {footerStart ? <div className="min-w-0 text-sm text-primitive-neutral-300">{footerStart}</div> : null}
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="hover:shadow-md" onClick={onClose}>
              {cancelLabel}
            </Button>
            {showConfirm ? (
              <Button onClick={onConfirm} disabled={confirmDisabled}>
                {confirmLabel}
              </Button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  );
}
