import { type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { DICTIONARY } from "@/constants/dictionary";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  wrapperClassName?: string;
  optional?: boolean;
  labelClassName?: string;
  children: ReactNode;
}

export function FormField({ id, label, optional = false, children, wrapperClassName = "", labelClassName = "" }: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
      <Label htmlFor={id} className={labelClassName}>
        {label}
        {optional ? (
          <span className="ml-1 italic text-primitive-neutral-500">{DICTIONARY.common.optional}</span>
        ) : null}
      </Label>
      {children}
      {/* {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-primitive-red-500">
          {error}
        </p>
      ) : null} */}
    </div>
  );
}
