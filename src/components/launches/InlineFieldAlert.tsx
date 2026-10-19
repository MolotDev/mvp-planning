import { cn } from "@/lib/utils";

export function InlineFieldAlert({ message, className }: { message: string; className?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p
      role="alert"
      title={message}
      className={cn(
        "pointer-events-none absolute top-0 right-0 z-10 max-w-[75%] truncate px-1 text-[10px] leading-8 text-primitive-red-500",
        className,
      )}
    >
      {message}
    </p>
  );
}
