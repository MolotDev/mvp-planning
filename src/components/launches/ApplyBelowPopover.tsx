import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { CloseIconButton } from "@/components/ui/icon-buttons";

export function ApplyBelowPopover({
  anchor,
  label,
  onApply,
  onClose,
}: {
  anchor: HTMLElement;
  label: string;
  onApply: () => void;
  onClose: () => void;
}) {
  const [box, setBox] = useState(() => anchor.getBoundingClientRect());

  useEffect(() => {
    const update = () => setBox(anchor.getBoundingClientRect());
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [anchor]);

  const placeAbove = box.top > 56;

  return createPortal(
    <div
      className="fixed z-[60] rounded-md border border-primitive-neutral-800 bg-primitive-neutral-900 p-2 shadow-md"
      style={{
        top: placeAbove ? box.top - 2 : box.bottom + 2,
        left: box.left,
        transform: placeAbove ? "translateY(-100%)" : undefined,
      }}
    >
      <div className="flex items-center gap-3">
        <Button className="h-5 px-1.5 text-[12px] leading-none hover:cursor-pointer hover:shadow-md" onClick={onApply}>
          {label}
        </Button>
        <CloseIconButton className="h-5 w-5" onClick={onClose} />
      </div>
    </div>,
    document.body,
  );
}
