import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Pin } from "lucide-react";
import { invalidControlClass } from "@/components/ui/control-class";
import { Input } from "@/components/ui/input";
import { DICTIONARY } from "@/constants/dictionary";
import { cn } from "@/lib/utils";

const PINNED_EVENT_IDS_KEY = "ls_pinned_event_ids";

export interface EventTypeOption {
  id: string;
  label: string;
}

interface EventTypeComboboxProps {
  id: string;
  value: string;
  options: EventTypeOption[];
  disabled?: boolean;
  invalid?: boolean;
  onChange: (eventTypeId: string) => void;
}

function readPinnedEventIds(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_EVENT_IDS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writePinnedEventIds(ids: string[]): void {
  localStorage.setItem(PINNED_EVENT_IDS_KEY, JSON.stringify(ids));
}

function matchesQuery(label: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return needle.length === 0 || label.toLowerCase().includes(needle);
}

export function EventTypeCombobox({
  id,
  value,
  options,
  disabled = false,
  invalid = false,
  onChange,
}: EventTypeComboboxProps) {
  const text = DICTIONARY.reports.tables.event_log;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => readPinnedEventIds());
  const [menuBox, setMenuBox] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    listMaxHeight: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.id === value);
  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);
  const visible = useMemo(
    () => options.filter((option) => matchesQuery(option.label, query)),
    [options, query],
  );
  const pinned = useMemo(
    () =>
      pinnedIds.flatMap((pinnedId) => {
        const option = visible.find((item) => item.id === pinnedId);
        return option ? [option] : [];
      }),
    [pinnedIds, visible],
  );
  const rest = useMemo(() => visible.filter((option) => !pinnedSet.has(option.id)), [pinnedSet, visible]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      return;
    }
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const gap = 4;
      const pad = 8;
      const width = Math.max(rect.width, 280);
      const left = Math.min(Math.max(pad, rect.left), Math.max(pad, window.innerWidth - width - pad));
      const spaceBelow = window.innerHeight - rect.bottom - gap - pad;
      const spaceAbove = rect.top - gap - pad;
      const openUpward = spaceBelow < 180 && spaceAbove > spaceBelow;
      const available = Math.max(0, openUpward ? spaceAbove : spaceBelow);
      const listMaxHeight = Math.min(240, Math.max(40, available - 56));
      setMenuBox(
        openUpward
          ? { bottom: window.innerHeight - rect.top + gap, left, width, listMaxHeight }
          : { top: rect.bottom + gap, left, width, listMaxHeight },
      );
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
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
      setQuery("");
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    searchRef.current?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, menuBox]);

  const choose = (eventTypeId: string) => {
    onChange(eventTypeId);
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  };

  const togglePin = (eventTypeId: string) => {
    setPinnedIds((current) => {
      const next = current.includes(eventTypeId)
        ? current.filter((item) => item !== eventTypeId)
        : [...current, eventTypeId];
      writePinnedEventIds(next);
      return next;
    });
  };

  const renderOption = (option: EventTypeOption) => {
    const pinned = pinnedSet.has(option.id);
    return (
      <li key={option.id} role="none" className="flex items-center gap-1 pr-1">
        <button
          type="button"
          role="option"
          aria-selected={option.id === value}
          onClick={() => choose(option.id)}
          className={cn(
            "flex min-w-0 flex-1 px-3 py-2 text-left text-sm text-primitive-neutral-0 hover:cursor-pointer hover:bg-primitive-blue-500 hover:shadow-md",
            option.id === value && "bg-primitive-blue-500",
          )}
        >
          <span className="truncate">{option.label}</span>
        </button>
        <button
          type="button"
          title={pinned ? text.unpin_event : text.pin_event}
          aria-label={pinned ? text.unpin_event : text.pin_event}
          aria-pressed={pinned}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            togglePin(option.id);
          }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-primitive-neutral-200 hover:cursor-pointer hover:bg-primitive-neutral-800 hover:shadow-md"
        >
          <Pin className={cn("h-4 w-4", pinned && "fill-current text-primitive-blue-500")} aria-hidden="true" />
        </button>
      </li>
    );
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        disabled={disabled}
        aria-invalid={invalid}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) {
            return;
          }
          setOpen((current) => !current);
        }}
        className={cn(
          "flex h-7 min-w-40 flex-1 items-center justify-between gap-2 rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-3 text-left text-sm text-primitive-neutral-0 hover:cursor-pointer hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50",
          invalid && invalidControlClass,
        )}
      >
        <span className="truncate">{selected?.label ?? text.select_event}</span>
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>
      {open && menuBox
        ? createPortal(
            <div
              ref={menuRef}
              style={{
                top: menuBox.top,
                bottom: menuBox.bottom,
                left: menuBox.left,
                width: menuBox.width,
              }}
              className="fixed z-[80] rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 py-2 shadow-md"
            >
              <div className="px-2 pb-2">
                <Input
                  ref={searchRef}
                  value={query}
                  aria-label={text.search_event}
                  placeholder={text.search_event}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-8"
                />
              </div>
              {visible.length === 0 ? (
                <p className="px-3 pb-1 text-sm text-primitive-neutral-300">{text.search_empty}</p>
              ) : (
                <ul
                  id={listId}
                  role="listbox"
                  aria-labelledby={id}
                  style={{ maxHeight: menuBox.listMaxHeight }}
                  className="overflow-y-auto overscroll-contain"
                >
                  {pinned.map(renderOption)}
                  {pinned.length > 0 && rest.length > 0 ? (
                    <li role="separator" className="mx-2 my-1 border-t border-primitive-neutral-700" />
                  ) : null}
                  {rest.map(renderOption)}
                </ul>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
