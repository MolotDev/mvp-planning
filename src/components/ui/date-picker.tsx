import DatePicker, { registerLocale } from "react-datepicker";
import { uk } from "date-fns/locale/uk";
import { cn } from "@/lib/utils";
import "react-datepicker/dist/react-datepicker.css";

registerLocale("uk", uk);

const pickerClassName =
  "h-9 w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-3 text-sm text-primitive-neutral-0";

interface SingleDatePickerProps {
  id?: string;
  selected: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  isError?: boolean;
}

export function AppDatePicker({
  id,
  selected,
  onChange,
  placeholder,
  disabled = false,
  isError = false,
}: SingleDatePickerProps) {
  return (
    <DatePicker
      autoComplete="off"
      id={id}
      locale="uk"
      selected={selected}
      onChange={onChange}
      dateFormat="dd.MM.yyyy"
      placeholderText={placeholder}
      disabled={disabled}
      className={cn(pickerClassName, "min-h-[38px] hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", isError ? "border-primitive-red-500" : "")}
      calendarClassName="crm-datepicker"
      popperClassName="crm-datepicker-popper"
      wrapperClassName="w-full"
    />
  );
}

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (range: [Date | null, Date | null]) => void;
  placeholder?: string;
}

export function AppDateRangePicker({
  startDate,
  endDate,
  onChange,
  placeholder,
}: DateRangePickerProps) {
  return (
    <DatePicker
      locale="uk"
      selectsRange
      startDate={startDate}
      endDate={endDate}
      onChange={(update) => {
        const [start, end] = update as [Date | null, Date | null];
        onChange([start, end]);
      }}
      dateFormat="dd.MM.yyyy"
      placeholderText={placeholder}
      isClearable
      className={cn(pickerClassName, "hover:cursor-pointer")}
      calendarClassName="crm-datepicker"
      popperClassName="crm-datepicker-popper"
      wrapperClassName="w-full"
    />
  );
}
