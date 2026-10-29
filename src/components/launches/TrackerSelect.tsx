import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { invalidControlClass } from "@/components/ui/control-class";
import { Input } from "@/components/ui/input";
import { DICTIONARY } from "@/constants/dictionary";
import { trackerOptionsForLaunch } from "@/lib/trackerPool";
import { cn } from "@/lib/utils";
import { useTrackerStore } from "@/store/useTrackerStore";

interface TrackerSelectProps {
  id?: string;
  value: string;
  onChange: (trackerNumber: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  tabIndex?: number;
  "aria-label"?: string;
  /** Current launch — excludes this launch when collecting occupied serials from the store. */
  launchId?: string;
  /** Extra occupied serials from unsaved sibling drafts. */
  occupiedSerials?: string[];
  assetId?: string | null;
  taskId?: string | null;
  missionId?: string | null;
}

function matchesQuery(label: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  return label.toLowerCase().includes(q);
}

export function TrackerSelect({
  id,
  value,
  onChange,
  disabled = false,
  invalid = false,
  className,
  tabIndex,
  "aria-label": ariaLabel,
  launchId,
  occupiedSerials = [],
  assetId,
  taskId,
  missionId,
}: TrackerSelectProps) {
  const trackers = useTrackerStore((state) => state.trackers);
  const syncLaunchAssignment = useTrackerStore((state) => state.syncLaunchAssignment);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Occupancy comes from the pool (assigned), not launch serial leftovers on aborted/cancelled launches.
  const storeOccupied = useMemo(
    () =>
      trackers
        .filter(
          (tracker) =>
            tracker.status === "assigned" &&
            tracker.assigned_launch_id != null &&
            tracker.assigned_launch_id !== launchId,
        )
        .flatMap((tracker) => [tracker.number, tracker.id]),
    [trackers, launchId],
  );

  const options = useMemo(
    () =>
      trackerOptionsForLaunch(trackers, value, [...storeOccupied, ...occupiedSerials]).map((tracker) => ({
        value: tracker.number,
        label: tracker.number,
      })),
    [trackers, value, storeOccupied, occupiedSerials],
  );

  const visible = useMemo(
    () => options.filter((option) => matchesQuery(option.label, query)),
    [options, query],
  );
  const selected = options.find((option) => option.value === value);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      return;
    }
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(160, Math.min(280, openUp ? spaceAbove : spaceBelow));
      setMenuBox({
        top: openUp ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 160),
        maxHeight,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    searchRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const commit = (next: string) => {
    if (launchId) {
      syncLaunchAssignment(launchId, value, next, {
        assetId: assetId ?? null,
        taskId: taskId ?? null,
        missionId: missionId ?? null,
      });
    }
    onChange(next);
    setOpen(false);
  };

  const text = DICTIONARY.launches.fields;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        tabIndex={tabIndex}
        disabled={disabled}
        aria-invalid={invalid}
        aria-label={ariaLabel ?? text.select_tracker}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current);
          }
        }}
        className={cn(
          "flex h-7 min-w-28 items-center justify-between gap-1 rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-2 text-left text-sm text-primitive-neutral-0",
          "hover:cursor-pointer hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50",
          invalid && invalidControlClass,
          className,
        )}
      >
        <span className="truncate">{selected?.label ?? text.select_tracker}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-primitive-neutral-400" aria-hidden="true" />
      </button>
      {open && menuBox
        ? createPortal(
            <div
              ref={menuRef}
              style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width }}
              className="fixed z-[80] rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 py-2 shadow-md"
            >
              <div className="px-2 pb-2">
                <Input
                  ref={searchRef}
                  value={query}
                  aria-label={text.search_tracker}
                  placeholder={text.search_tracker}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-8"
                />
              </div>
              {visible.length === 0 ? (
                <p className="px-3 pb-1 text-sm text-primitive-neutral-300">{text.search_tracker_empty}</p>
              ) : (
                <ul
                  id={listId}
                  role="listbox"
                  style={{ maxHeight: menuBox.maxHeight - 52 }}
                  className="overflow-y-auto overscroll-contain"
                >
                  {value ? (
                    <li role="option">
                      <button
                        type="button"
                        className="flex w-full px-3 py-1.5 text-left text-sm text-primitive-neutral-300 hover:cursor-pointer hover:bg-primitive-neutral-800 hover:shadow-md"
                        onClick={() => commit("")}
                      >
                        {text.clear_tracker}
                      </button>
                    </li>
                  ) : null}
                  {visible.map((option) => (
                    <li key={option.value} role="option" aria-selected={option.value === value}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full px-3 py-1.5 text-left font-mono text-sm hover:cursor-pointer hover:bg-primitive-neutral-800 hover:shadow-md",
                          option.value === value
                            ? "bg-primitive-neutral-800 text-primitive-neutral-0"
                            : "text-primitive-neutral-0",
                        )}
                        onClick={() => commit(option.value)}
                      >
                        {option.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
