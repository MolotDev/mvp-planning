import { DICTIONARY } from "@/constants/dictionary";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface StatusFilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  mode?: "lifecycle" | "report" | 'asset';
  className?: string;
}

export function StatusFilterSelect({ value, onChange, mode = "lifecycle", className }: StatusFilterSelectProps) {
  const labels = DICTIONARY.common.status_filter;
  // const options =
  //   mode === "report"
  //     ? [
  //         { value: "all", label: labels.all },
  //         { value: "submitted", label: DICTIONARY.common.metrics.submitted },
  //         { value: "draft", label: DICTIONARY.common.metrics.draft },
  //         { value: "archived", label: labels.archived },
  //       ]
  //     : [
  //         { value: "all", label: labels.all },
  //         { value: "reported", label: labels.completed },
  //         { value: "active", label: labels.active },
  //         { value: "archived", label: labels.archived },
  //       ];

  const options = useMemo(() => {
    if (mode === "report") {
      return [
        { value: "all", label: labels.all },
        { value: "submitted", label: DICTIONARY.common.metrics.submitted },
        { value: "draft", label: DICTIONARY.common.metrics.draft },
        { value: "archived", label: labels.archived },
      ];
    }
    if (mode === "asset") {
      return [
        { value: "all", label: labels.all },
        { value: "active", label: labels.active },
        { value: "archived", label: labels.archived },
      ];
    }
    return [
      { value: "all", label: labels.all },
      { value: "reported", label: labels.completed },
      { value: "active", label: labels.active },
      { value: "archived", label: labels.archived },
    ];
  }, [mode, labels]);

  return (
    <select
      value={value}
      aria-label={DICTIONARY.assets.columns.status}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-3 text-sm text-primitive-neutral-0 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
