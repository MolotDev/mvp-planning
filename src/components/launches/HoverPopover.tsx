import { useRef, useState, type ReactNode } from "react";

interface HoverPopoverProps {
  content: ReactNode;
  children: ReactNode;
}

export function HoverPopover({ content, children }: HoverPopoverProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  return (
    <span
      ref={anchorRef}
      className="inline-flex"
      onMouseEnter={() => {
        const rect = anchorRef.current?.getBoundingClientRect();
        if (!rect) {
          return;
        }
        const left = Math.min(rect.left, window.innerWidth - 280);
        setPosition({ top: rect.bottom + 4, left: Math.max(8, left) });
      }}
      onMouseLeave={() => setPosition(null)}
    >
      {children}
      {position ? (
        <span
          className="fixed z-50 flex min-w-[220px] flex-col gap-1 rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 p-2 shadow-md"
          style={{ top: position.top, left: position.left }}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
